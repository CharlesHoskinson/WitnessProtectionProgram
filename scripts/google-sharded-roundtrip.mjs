import { fork } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GoogleBackupCoordinator, parseBackupCheckpoint, writeBackupCheckpointFile } from '../dist/backup/index.js';
import { isPathInsideRoot } from '../dist/google/client.js';
import {
  GoogleError,
  authorizeInstalledApp,
  launchSystemBrowser,
  loadInstalledAppClientFile,
} from '../dist/google/index.js';
import { createOwnedOAuth2Client } from '../dist/google/transport.js';
import { CiphertextJournal } from '../dist/journal/index.js';
import { UnlockedVault } from '../dist/kernel/index.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SELF = fileURLToPath(import.meta.url);

const HELP = `Usage:
  node scripts/google-sharded-roundtrip.mjs --help
  node scripts/google-sharded-roundtrip.mjs --client-file PATH --state-dir PATH --mode MODE

Modes:
  new-vault              Create synthetic recovery material and publish one snapshot.
  selected-checkpoint    Reopen recovery material and publish from the stored checkpoint.
  publish-unchanged      Re-read current live objects. Do not add observations.
  restore                Restore one snapshot from the stored checkpoint.

Flags:
  --client-file PATH       Installed-app OAuth client JSON. Keep this file outside the repository.
  --state-dir PATH         Private directory for recovery, journal, and checkpoint. Keep it outside the repository.
  --checkpoint-file PATH   Checkpoint JSON. Default: STATE_DIR/checkpoint.json
  --recovery-file PATH     Recovery pack wire. Default: STATE_DIR/recovery.pack
  --recovery-key-file PATH Recovery key. Default: STATE_DIR/recovery.key
  --package-sha256 HEX     Snapshot digest for restore. Default: STATE_DIR/last-package.json
  --cold-restore           Run restore in a new process. Do not open the parent journal.
  --payload-utf8 TEXT      Synthetic snapshot message. Default: synthetic-roundtrip

The command uses authorizeInstalledApp PKCE and GoogleBackupCoordinator.
npm test does not run this command.
The command does not print tokens, recovery keys, root secrets, or witness plaintext.
`;

function fail(code) {
  process.stderr.write(`${code}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    help: false,
    clientFile: undefined,
    stateDir: undefined,
    mode: undefined,
    checkpointFile: undefined,
    recoveryFile: undefined,
    recoveryKeyFile: undefined,
    packageSha256: undefined,
    coldRestore: false,
    payloadUtf8: 'synthetic-roundtrip',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    if (arg === '--cold-restore') {
      out.coldRestore = true;
      continue;
    }
    const named = [
      ['--client-file', 'clientFile'],
      ['--state-dir', 'stateDir'],
      ['--mode', 'mode'],
      ['--checkpoint-file', 'checkpointFile'],
      ['--recovery-file', 'recoveryFile'],
      ['--recovery-key-file', 'recoveryKeyFile'],
      ['--package-sha256', 'packageSha256'],
      ['--payload-utf8', 'payloadUtf8'],
    ];
    let matched = false;
    for (const [flag, key] of named) {
      if (arg === flag) {
        const next = argv[i + 1];
        if (typeof next !== 'string' || next.length === 0) {
          fail('WPP_BACKUP_SCHEMA');
        }
        out[key] = next;
        i += 1;
        matched = true;
        break;
      }
      if (arg.startsWith(`${flag}=`)) {
        out[key] = arg.slice(flag.length + 1);
        matched = true;
        break;
      }
    }
    if (!matched) {
      fail('WPP_BACKUP_SCHEMA');
    }
  }
  return out;
}

function utf8(text) {
  return Buffer.from(text, 'utf8');
}

function b64(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

function outsideRepo(path) {
  if (typeof path !== 'string' || path.length === 0) {
    fail('WPP_BACKUP_SCHEMA');
  }
  if (isPathInsideRoot(path, ROOT)) {
    fail('GOOGLE_CLIENT_CONFIG');
  }
  return path;
}

function codec() {
  return { id: 'wpp.synthetic-vector', validate() {} };
}

function randomRoot() {
  return {
    format: 'wpp-root-record',
    version: 1,
    revisionId: b64(randomBytes(32)),
    parents: [],
    vaultId: b64(randomBytes(16)),
    vaultSalt: b64(randomBytes(32)),
    catalogScopeId: b64(randomBytes(32)),
    catalogRecordId: b64(randomBytes(32)),
    epochs: [
      {
        rootEpoch: b64(randomBytes(16)),
        secretRoot: b64(randomBytes(32)),
        createdAt: '2026-09-19T00:00:00Z',
        status: 'active',
      },
    ],
  };
}

function metadata() {
  return {
    network: { id: 'synthetic-local', genesisHash: null },
    accountBinding: { scheme: 'synthetic-fixture', value: 'fixture-account' },
    applicationId: 'wpp-vector-fixture',
    contract: { address: 'synthetic-contract', codeHash: null },
    privateStateIds: ['fixture-state'],
    codec: {
      id: 'wpp.synthetic-vector',
      version: 1,
      producerPackage: 'wpp-format-vectors',
      producerVersion: '0.1.0',
      sourceCommit: '0000000000000000000000000000000000000000',
    },
    capturedAt: '2026-09-19T00:00:00Z',
    lifecycle: { status: 'unassociated', transactionId: null, blockHash: null },
    parents: [],
    retentionClass: 'retained-application-witness',
  };
}

function payloadBytes(message) {
  return utf8(
    JSON.stringify({
      payloadVersion: 1,
      metadata: metadata(),
      content: { message },
    }),
  );
}

function expectedOf(scopeId, recordId) {
  const meta = metadata();
  return {
    scopeId,
    recordId,
    network: structuredClone(meta.network),
    accountBinding: structuredClone(meta.accountBinding),
    applicationId: meta.applicationId,
    contract: structuredClone(meta.contract),
    codec: structuredClone(meta.codec),
  };
}

function ensureStateDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
}

function writePrivate(path, bytes) {
  writeFileSync(path, bytes, { mode: 0o600 });
  chmodSync(path, 0o600);
}

async function launchOrPrint(url) {
  try {
    await launchSystemBrowser(url);
  } catch {
    process.stdout.write(`Open this URL in a browser:\n${url}\n`);
  }
}

function capturingCreateAuthClient(counter) {
  return (args) => {
    const client = createOwnedOAuth2Client(args);
    const inner = client.request.bind(client);
    client.request = async (opts) => {
      counter.requests += 1;
      const body = opts?.data ?? opts?.body;
      if (body instanceof Uint8Array) {
        counter.uploadBytes += body.byteLength;
      }
      const res = await inner(opts);
      const data = res?.data;
      if (data instanceof ArrayBuffer) {
        counter.downloadBytes += data.byteLength;
      } else if (data instanceof Uint8Array) {
        counter.downloadBytes += data.byteLength;
      }
      return res;
    };
    return client;
  };
}

function pathsFrom(args) {
  const clientFile = outsideRepo(args.clientFile);
  const stateDir = outsideRepo(args.stateDir);
  ensureStateDir(stateDir);
  return {
    clientFile,
    stateDir,
    checkpointFile: outsideRepo(args.checkpointFile ?? join(stateDir, 'checkpoint.json')),
    recoveryFile: outsideRepo(args.recoveryFile ?? join(stateDir, 'recovery.pack')),
    recoveryKeyFile: outsideRepo(args.recoveryKeyFile ?? join(stateDir, 'recovery.key')),
    lastPackageFile: join(stateDir, 'last-package.json'),
    journalDir: join(stateDir, 'journal'),
  };
}

async function restoreFlow(args, paths, session, counter) {
  const pack = readFileSync(paths.recoveryFile);
  const key = readFileSync(paths.recoveryKeyFile);
  const vault = UnlockedVault.fromRecoveryPack(pack, key, [codec()]);
  const checkpoint = parseBackupCheckpoint(JSON.parse(readFileSync(paths.checkpointFile, 'utf8')));
  const last = JSON.parse(readFileSync(paths.lastPackageFile, 'utf8'));
  const packageSha256 = args.packageSha256 ?? last.packageSha256;
  if (typeof packageSha256 !== 'string') {
    fail('WPP_BACKUP_SCHEMA');
  }
  const result = await GoogleBackupCoordinator.restoreSnapshot({
    vault,
    session,
    checkpoint,
    packageSha256,
    expected: last.expected,
  });
  vault.lock();
  if (result.status !== 'verified') {
    fail(result.reason);
  }
  process.stdout.write(
    `restored sha256=${packageSha256} providerRequests=${counter.requests} uploadBytes=${counter.uploadBytes} downloadBytes=${counter.downloadBytes}\n`,
  );
}

async function publishFlow(args, paths, session, counter) {
  const mode = args.mode;
  let vault;
  if (mode === 'new-vault') {
    vault = UnlockedVault.fromRootRecord(utf8(JSON.stringify(randomRoot())), [codec()]);
    const pack = vault.createRecoveryPack();
    writePrivate(paths.recoveryFile, pack.wire);
    writePrivate(paths.recoveryKeyFile, pack.recoveryKey);
  } else {
    vault = UnlockedVault.fromRecoveryPack(
      readFileSync(paths.recoveryFile),
      readFileSync(paths.recoveryKeyFile),
      [codec()],
    );
  }
  const journal = await CiphertextJournal.open(paths.journalDir);
  const coordinator = new GoogleBackupCoordinator({
    vault,
    session,
    journal,
    mode:
      mode === 'new-vault'
        ? { kind: 'new-vault' }
        : {
            kind: 'selected-checkpoint',
            checkpoint: parseBackupCheckpoint(JSON.parse(readFileSync(paths.checkpointFile, 'utf8'))),
          },
    checkpointPath: paths.checkpointFile,
  });
  let result;
  if (mode === 'publish-unchanged') {
    result = await coordinator.publishUnchanged();
  } else {
    const scopeId = b64(randomBytes(32));
    const recordId = b64(randomBytes(32));
    const expected = expectedOf(scopeId, recordId);
    result = await coordinator.publishSnapshot({
      scopeId,
      recordId,
      payloadUtf8: payloadBytes(args.payloadUtf8),
    });
    if (result.status === 'verified') {
      writePrivate(
        paths.lastPackageFile,
        utf8(
          JSON.stringify({
            packageSha256: result.packageSha256,
            expected,
            rootWireSha256: result.checkpoint.root.wireSha256,
          }),
        ),
      );
    }
  }
  vault.lock();
  if (result.status !== 'verified') {
    fail(result.reason);
  }
  writeBackupCheckpointFile(paths.checkpointFile, result.checkpoint);
  process.stdout.write(
    `verified root=${result.checkpoint.root.wireSha256} bytes=${result.checkpoint.root.wireByteLength} reservedAdapterCalls=${result.metrics.reservedAdapterCalls} reservedUploadDownloadBytes=${result.metrics.reservedUploadDownloadBytes} providerRequests=${counter.requests} uploadBytes=${counter.uploadBytes} downloadBytes=${counter.downloadBytes}\n`,
  );
}

async function runLive(args) {
  const paths = pathsFrom(args);
  const client = loadInstalledAppClientFile(paths.clientFile, ROOT);
  const counter = { requests: 0, uploadBytes: 0, downloadBytes: 0 };
  const session = await authorizeInstalledApp({
    client,
    launchBrowser: launchOrPrint,
    createAuthClient: capturingCreateAuthClient(counter),
  });
  process.stdout.write('connected\n');
  const mode = args.mode;
  if (
    mode !== 'new-vault' &&
    mode !== 'selected-checkpoint' &&
    mode !== 'publish-unchanged' &&
    mode !== 'restore'
  ) {
    fail('WPP_BACKUP_SCHEMA');
  }
  if (args.coldRestore && process.env.WPP_BACKUP_COLD_CHILD !== '1') {
    const child = fork(SELF, process.argv.slice(2), {
      env: { ...process.env, WPP_BACKUP_COLD_CHILD: '1' },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    const code = await new Promise((resolve) => {
      child.on('exit', (value) => resolve(value ?? 1));
    });
    process.exit(code);
  }
  if (mode === 'restore' || args.coldRestore) {
    await restoreFlow(args, paths, session, counter);
    return;
  }
  await publishFlow(args, paths, session, counter);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || process.argv.slice(2).length === 0) {
  process.stdout.write(HELP);
  process.exit(0);
}

try {
  await runLive(args);
} catch (err) {
  const code = err instanceof GoogleError ? err.code : typeof err?.code === 'string' ? err.code : 'GOOGLE_DRIVE_INCOMPLETE';
  fail(code);
}
