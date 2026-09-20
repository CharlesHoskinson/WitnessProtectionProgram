import { deepEqual, equal, match, ok, throws } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LAST_PACKAGE_MAX_BYTES,
  RECOVERY_KEY_BYTES,
  assertPackageEvidence,
  classifyGoogleRequest,
  contentDigestHex,
  contentDigestMatches,
  createDriveHttpCounter,
  inspectWppMultipart,
  mapFailCode,
  noteDriveAttempt,
  noteDriveSuccess,
  parseLastPackageBytes,
  readBoundedPrivate,
  writePrivateExclusive,
} from '../scripts/google-sharded-roundtrip.mjs';
import { LIMIT_RECOVERY_WIRE_BYTES } from '../dist/kernel/json.js';

const CLI = fileURLToPath(new URL('../scripts/google-sharded-roundtrip.mjs', import.meta.url));
const HOOK = fileURLToPath(new URL('./helpers/backup-cli-authorize.mjs', import.meta.url));

const HEX64_A = 'aa'.repeat(32);
const HEX64_B = 'bb'.repeat(32);
const HEX64_C = 'cc'.repeat(32);
const HEX64_D = 'dd'.repeat(32);

const CLIENT_JSON = `${JSON.stringify({
  installed: {
    client_id: '1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com',
    client_secret: 'GOCSPX-test-desktop-secret',
  },
})}\n`;

function utf8(text) {
  return Buffer.from(text, 'utf8');
}

function buildKnownWppMultipart(ciphertext, nameHex) {
  const boundary = `wpp_${'ab'.repeat(16)}`;
  const metadata = utf8(JSON.stringify({ name: `${nameHex}.wpp`, mimeType: 'application/octet-stream' }));
  const head = utf8(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`);
  const mid = utf8(
    `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: binary\r\n\r\n`,
  );
  const end = utf8(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, metadata, mid, ciphertext, end]);
}

function lastPackageRecord() {
  return {
    packageSha256: HEX64_A,
    expected: {
      scopeId: 'scope',
      recordId: 'record',
      network: { id: 'synthetic-local', genesisHash: null },
      accountBinding: { scheme: 'synthetic-fixture', value: 'fixture-account' },
      applicationId: 'wpp-vector-fixture',
      contract: { address: 'synthetic-contract', codeHash: null },
      codec: {
        id: 'wpp.synthetic-vector',
        version: 1,
        producerPackage: 'wpp-format-vectors',
        producerVersion: '0.1.0',
        sourceCommit: '0000000000000000000000000000000000000000',
      },
    },
    expectedContentSha256: HEX64_B,
    rootWireSha256: HEX64_C,
  };
}

async function withOutsideState(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'wpp-cli-'));
  try {
    chmodSync(dir, 0o700);
    const clientFile = join(dir, 'client.json');
    writeFileSync(clientFile, CLIENT_JSON, { mode: 0o600 });
    const logFile = join(dir, 'authorize.log');
    await fn({
      dir,
      clientFile,
      logFile,
      recoveryFile: join(dir, 'recovery.pack'),
      recoveryKeyFile: join(dir, 'recovery.key'),
      checkpointFile: join(dir, 'checkpoint.json'),
      lastPackageFile: join(dir, 'last-package.json'),
      journalDir: join(dir, 'journal'),
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args, env, timeout = 8000) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    timeout,
    env: { ...process.env, ...env },
  });
}

function authorizeLines(logFile) {
  if (!existsSync(logFile)) {
    return [];
  }
  return readFileSync(logFile, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

function seedRestoreFiles(paths) {
  writeFileSync(paths.recoveryFile, Buffer.alloc(32, 7), { mode: 0o600 });
  writeFileSync(paths.recoveryKeyFile, Buffer.alloc(32, 9), { mode: 0o600 });
  writeFileSync(paths.checkpointFile, utf8('{"format":"wpp-backup-checkpoint"}'), { mode: 0o600 });
  writeFileSync(paths.lastPackageFile, utf8(JSON.stringify(lastPackageRecord())), { mode: 0o600 });
}

describe('synthetic sharded Google roundtrip CLI helpers', () => {
  test('inspectWppMultipart counts the two-part fixture independently of the body length', () => {
    const ciphertext = utf8('ciphertext-fixture-bytes');
    const body = buildKnownWppMultipart(ciphertext, HEX64_A);
    ok(body.byteLength > ciphertext.byteLength);
    const inspected = inspectWppMultipart(body);
    equal(inspected.partCount, 2);
    equal(inspected.multipartByteLength, body.byteLength);
    equal(inspected.ciphertextPartByteLength, ciphertext.byteLength);
    equal(inspected.name, `${HEX64_A}.wpp`);
  });

  test('Drive HTTP counters count multipart and media and ignore OAuth and About JSON', () => {
    const ciphertext = utf8('owned-ciphertext');
    const body = buildKnownWppMultipart(ciphertext, HEX64_A);
    const media = utf8('returned-media-ciphertext');
    const counter = createDriveHttpCounter();

    const multipartOpts = {
      method: 'POST',
      url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size',
      data: body,
    };
    noteDriveAttempt(counter, multipartOpts);
    noteDriveSuccess(counter, multipartOpts, { status: 200, data: { id: 'file-1', size: String(ciphertext.byteLength) } });

    const mediaOpts = {
      method: 'GET',
      url: 'https://www.googleapis.com/drive/v3/files/file-1?alt=media',
    };
    noteDriveAttempt(counter, mediaOpts);
    noteDriveSuccess(counter, mediaOpts, { status: 200, data: media });

    const aboutOpts = {
      method: 'GET',
      url: 'https://www.googleapis.com/drive/v3/about?fields=user(permissionId)',
    };
    noteDriveAttempt(counter, aboutOpts);
    noteDriveSuccess(counter, aboutOpts, { status: 200, data: { user: { permissionId: 'perm' } } });

    const listOpts = {
      method: 'GET',
      url: 'https://www.googleapis.com/drive/v3/files?q=trashed+%3D+false',
    };
    noteDriveAttempt(counter, listOpts);
    noteDriveSuccess(counter, listOpts, { status: 200, data: { files: [] } });

    const tokenOpts = {
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      data: utf8('grant_type=authorization_code&code=secret'),
    };
    noteDriveAttempt(counter, tokenOpts);
    noteDriveSuccess(counter, tokenOpts, { status: 200, data: { access_token: 'ya29.secret' } });

    equal(classifyGoogleRequest(tokenOpts), 'oauth');
    equal(classifyGoogleRequest(aboutOpts), 'about');
    equal(classifyGoogleRequest(listOpts), 'list');
    equal(classifyGoogleRequest(multipartOpts), 'multipart');
    equal(classifyGoogleRequest(mediaOpts), 'media');

    equal(counter.driveHttpRequests, 4);
    equal(counter.driveHttpRequestsAttempted, 4);
    equal(counter.multipartBodyBytes, body.byteLength);
    equal(counter.ciphertextPartBytes, ciphertext.byteLength);
    equal(counter.ciphertextMediaBytes, media.byteLength);
    equal(counter.multipartBodyBytes === counter.ciphertextPartBytes, false);
  });

  test('failed Drive calls keep attempted multipart bytes distinct from successful bytes', () => {
    const ciphertext = utf8('attempted-only');
    const body = buildKnownWppMultipart(ciphertext, HEX64_A);
    const counter = createDriveHttpCounter();
    const opts = {
      method: 'POST',
      url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      data: body,
    };
    noteDriveAttempt(counter, opts);
    equal(counter.multipartBodyBytesAttempted, body.byteLength);
    equal(counter.ciphertextPartBytesAttempted, ciphertext.byteLength);
    equal(counter.multipartBodyBytes, 0);
    equal(counter.ciphertextPartBytes, 0);
    equal(counter.driveHttpRequests, 0);
    equal(counter.driveHttpRequestsAttempted, 1);
  });

  test('content digest comparison reports boolean equality and rejects a changed witness', () => {
    const content = { message: 'synthetic-roundtrip' };
    const digest = contentDigestHex(content);
    equal(contentDigestMatches(content, digest), true);
    equal(contentDigestMatches({ message: 'altered' }, digest), false);
    equal(digest.includes('synthetic-roundtrip'), false);
  });

  test('--package-sha256 refuses a last-package binding for a different digest', () => {
    const last = parseLastPackageBytes(utf8(JSON.stringify(lastPackageRecord())));
    throws(() => assertPackageEvidence(last, HEX64_D), (err) => err.code === 'WPP_BACKUP_SCHEMA');
    deepEqual(assertPackageEvidence(last, HEX64_A), last);
    deepEqual(assertPackageEvidence(last, undefined), last);
    const missingDigest = { ...last, expectedContentSha256: undefined };
    throws(() => assertPackageEvidence(missingDigest, HEX64_A), (err) => err.code === 'WPP_BACKUP_SCHEMA');
  });

  test('bounded private reads reject over-limit files', () => {
    return withOutsideState(async ({ dir }) => {
      const over = join(dir, 'over.bin');
      writeFileSync(over, Buffer.alloc(LAST_PACKAGE_MAX_BYTES + 1, 1));
      throws(() => readBoundedPrivate(over, LAST_PACKAGE_MAX_BYTES), (err) => err.code === 'WPP_BACKUP_INTEGRITY');
      const recoveryOver = join(dir, 'recovery-over.bin');
      writeFileSync(recoveryOver, Buffer.alloc(LIMIT_RECOVERY_WIRE_BYTES + 1, 2));
      throws(
        () => readBoundedPrivate(recoveryOver, LIMIT_RECOVERY_WIRE_BYTES),
        (err) => err.code === 'WPP_BACKUP_INTEGRITY',
      );
    });
  });

  test('exclusive private create does not overwrite existing bytes', () => {
    return withOutsideState(async ({ dir }) => {
      const path = join(dir, 'recovery.pack');
      const original = Buffer.from('existing-recovery-bytes');
      writePrivateExclusive(path, original);
      throws(() => writePrivateExclusive(path, utf8('replacement')), (err) => err.code === 'WPP_BACKUP_SCHEMA');
      equal(Buffer.from(readFileSync(path)).equals(original), true);
    });
  });

  test('unknown error codes do not propagate', () => {
    equal(mapFailCode({ code: 'INVALID_INPUT' }), 'GOOGLE_DRIVE_INCOMPLETE');
    equal(mapFailCode({ code: 'WPP_RECOVERY' }), 'GOOGLE_DRIVE_INCOMPLETE');
    equal(mapFailCode({ code: 'EACCES' }), 'GOOGLE_DRIVE_INCOMPLETE');
    equal(mapFailCode({ code: 'WPP_BACKUP_SCHEMA' }), 'WPP_BACKUP_SCHEMA');
    equal(mapFailCode({ reason: 'authentication-failed' }), 'authentication-failed');
  });

  test('recovery key reads reject a length other than 32 bytes', () => {
    return withOutsideState(async ({ dir }) => {
      const keyPath = join(dir, 'recovery.key');
      writeFileSync(keyPath, Buffer.alloc(RECOVERY_KEY_BYTES + 1, 4));
      throws(
        () => readBoundedPrivate(keyPath, RECOVERY_KEY_BYTES, { exact: true }),
        (err) => err.code === 'WPP_BACKUP_INTEGRITY',
      );
    });
  });
});

describe('synthetic sharded Google roundtrip CLI process', () => {
  test('invalid mode fails before authorization', async () => {
    await withOutsideState(async ({ dir, clientFile, logFile }) => {
      const result = runCli(
        ['--client-file', clientFile, '--state-dir', dir, '--mode', 'no-such-mode'],
        { WPP_BACKUP_TEST_HOOK: HOOK, WPP_BACKUP_TEST_AUTHORIZE_LOG: logFile },
      );
      equal(result.status, 1, result.stderr);
      match(result.stderr, /WPP_BACKUP_SCHEMA/);
      equal(authorizeLines(logFile).length, 0);
    });
  });

  test('conflicting recovery and key paths fail before authorization', async () => {
    await withOutsideState(async ({ dir, clientFile, logFile, recoveryFile }) => {
      const result = runCli(
        [
          '--client-file',
          clientFile,
          '--state-dir',
          dir,
          '--mode',
          'new-vault',
          '--recovery-file',
          recoveryFile,
          '--recovery-key-file',
          recoveryFile,
        ],
        { WPP_BACKUP_TEST_HOOK: HOOK, WPP_BACKUP_TEST_AUTHORIZE_LOG: logFile },
      );
      equal(result.status, 1, result.stderr);
      match(result.stderr, /WPP_BACKUP_SCHEMA/);
      equal(authorizeLines(logFile).length, 0);
    });
  });

  test('symlink alias of recovery onto the key path fails before authorization', async () => {
    await withOutsideState(async ({ dir, clientFile, logFile, recoveryFile, recoveryKeyFile }) => {
      writeFileSync(recoveryFile, Buffer.alloc(8, 3), { mode: 0o600 });
      symlinkSync(recoveryFile, recoveryKeyFile);
      const result = runCli(
        ['--client-file', clientFile, '--state-dir', dir, '--mode', 'selected-checkpoint'],
        { WPP_BACKUP_TEST_HOOK: HOOK, WPP_BACKUP_TEST_AUTHORIZE_LOG: logFile },
      );
      equal(result.status, 1, result.stderr);
      match(result.stderr, /WPP_BACKUP_SCHEMA/);
      equal(authorizeLines(logFile).length, 0);
    });
  });

  test('new-vault leaves existing recovery bytes intact', async () => {
    await withOutsideState(async ({ dir, clientFile, logFile, recoveryFile }) => {
      const original = Buffer.from('keep-this-recovery-material-exactly');
      writeFileSync(recoveryFile, original, { mode: 0o600 });
      const result = runCli(
        ['--client-file', clientFile, '--state-dir', dir, '--mode', 'new-vault'],
        { WPP_BACKUP_TEST_HOOK: HOOK, WPP_BACKUP_TEST_AUTHORIZE_LOG: logFile },
      );
      equal(result.status, 1, result.stderr);
      match(result.stderr, /WPP_BACKUP_SCHEMA/);
      equal(Buffer.from(readFileSync(recoveryFile)).equals(original), true);
      equal(authorizeLines(logFile).length, 0);
    });
  });

  test('new-vault refuses an existing journal directory before authorization', async () => {
    await withOutsideState(async ({ dir, clientFile, logFile, journalDir }) => {
      mkdirSync(journalDir, { mode: 0o700 });
      writeFileSync(join(journalDir, `${HEX64_A}`), Buffer.alloc(4, 1));
      const result = runCli(
        ['--client-file', clientFile, '--state-dir', dir, '--mode', 'new-vault'],
        { WPP_BACKUP_TEST_HOOK: HOOK, WPP_BACKUP_TEST_AUTHORIZE_LOG: logFile },
      );
      equal(result.status, 1, result.stderr);
      match(result.stderr, /WPP_BACKUP_SCHEMA/);
      equal(authorizeLines(logFile).length, 0);
    });
  });

  test('restore --package-sha256 mismatch fails before authorization', async () => {
    await withOutsideState(async (paths) => {
      seedRestoreFiles(paths);
      const result = runCli(
        [
          '--client-file',
          paths.clientFile,
          '--state-dir',
          paths.dir,
          '--mode',
          'restore',
          '--package-sha256',
          HEX64_D,
        ],
        { WPP_BACKUP_TEST_HOOK: HOOK, WPP_BACKUP_TEST_AUTHORIZE_LOG: paths.logFile },
      );
      equal(result.status, 1, result.stderr);
      match(result.stderr, /WPP_BACKUP_SCHEMA/);
      equal(authorizeLines(paths.logFile).length, 0);
    });
  });

  test('cold-restore parent does not authorize and the child authorizes once', async () => {
    await withOutsideState(async (paths) => {
      seedRestoreFiles(paths);
      const result = runCli(
        ['--client-file', paths.clientFile, '--state-dir', paths.dir, '--mode', 'restore', '--cold-restore'],
        { WPP_BACKUP_TEST_HOOK: HOOK, WPP_BACKUP_TEST_AUTHORIZE_LOG: paths.logFile },
      );
      equal(result.status, 1, result.stderr);
      const lines = authorizeLines(paths.logFile);
      equal(lines.length, 1);
      equal(lines[0].coldChild, true);
      equal(
        lines.some((line) => line.coldChild === false),
        false,
      );
    });
  });

  test('CLI help still lists modes and does not print secrets', () => {
    const result = runCli(['--help']);
    equal(result.status, 0, result.stderr);
    match(result.stdout, /--client-file/);
    match(result.stdout, /--state-dir/);
    match(result.stdout, /--cold-restore/);
    match(result.stdout, /new-vault/);
    match(result.stdout, /publish-unchanged/);
    match(result.stdout, /selected-checkpoint/);
    equal(result.stdout.includes('ya29.'), false);
    equal(result.stdout.includes('GOCSPX-'), false);
  });
});
