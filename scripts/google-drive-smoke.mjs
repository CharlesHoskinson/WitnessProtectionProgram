import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { UnlockedVault } from '../dist/kernel/index.js';
import {
  GoogleError,
  authorizeInstalledApp,
  launchSystemBrowser,
  loadInstalledAppClientFile,
} from '../dist/google/index.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VECTOR_PATH = fileURLToPath(new URL('../fixtures/wpp-v1-vectors.json', import.meta.url));

function fail(code) {
  process.stderr.write(`${code}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  let clientFile;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--client-file') {
      clientFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (argv[i].startsWith('--client-file=')) {
      clientFile = argv[i].slice('--client-file='.length);
    }
  }
  if (typeof clientFile !== 'string' || clientFile.length === 0) {
    fail('GOOGLE_CLIENT_CONFIG');
  }
  return { clientFile };
}

function utf8(text) {
  return Buffer.from(text, 'utf8');
}

function vectorRoot(vector) {
  const header = vector.inputs.header;
  return {
    format: 'wpp-root-record',
    version: 1,
    revisionId: Buffer.alloc(32, 0xaa).toString('base64url'),
    parents: [],
    vaultId: header.vaultId,
    vaultSalt: header.vaultSalt,
    catalogScopeId: Buffer.alloc(32, 0xbb).toString('base64url'),
    catalogRecordId: Buffer.alloc(32, 0xcc).toString('base64url'),
    epochs: [
      {
        rootEpoch: header.rootEpoch,
        secretRoot: Buffer.from(vector.inputs.secretRootHex, 'hex').toString('base64url'),
        createdAt: '2026-09-19T00:00:00Z',
        status: 'active',
      },
    ],
  };
}

function expectedOf(vector) {
  const meta = vector.inputs.payload.metadata;
  return {
    scopeId: vector.inputs.header.scopeId,
    recordId: vector.inputs.header.recordId,
    network: structuredClone(meta.network),
    accountBinding: structuredClone(meta.accountBinding),
    applicationId: meta.applicationId,
    contract: structuredClone(meta.contract),
    codec: structuredClone(meta.codec),
  };
}

async function launchOrPrint(url) {
  try {
    await launchSystemBrowser(url);
  } catch {
    process.stdout.write(`Open this URL in a browser:\n${url}\n`);
  }
}

try {
  const { clientFile } = parseArgs(process.argv.slice(2));
  const client = loadInstalledAppClientFile(clientFile, ROOT);
  const vector = JSON.parse(readFileSync(VECTOR_PATH, 'utf8'));
  const codec = { id: 'wpp.synthetic-vector', validate() {} };
  const vault = UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot(vector))), [codec]);
  let sealed;
  try {
    sealed = vault.sealSnapshot({
      scopeId: vector.inputs.header.scopeId,
      recordId: vector.inputs.header.recordId,
      payloadUtf8: utf8(JSON.stringify(vector.inputs.payload)),
    });
  } catch {
    vault.lock();
    fail('GOOGLE_DRIVE_INPUT');
  }

  const session = await authorizeInstalledApp({
    client,
    launchBrowser: launchOrPrint,
  });
  process.stdout.write('connected\n');

  const receipt = await session.putOwnedCiphertext(sealed.wire, sealed.sha256);
  if (receipt.remoteReadbackVerified !== true || !(receipt.ownedReadback instanceof Uint8Array)) {
    vault.lock();
    fail('GOOGLE_DRIVE_READBACK');
  }
  process.stdout.write(`uploaded fileId=${receipt.fileId} bytes=${receipt.byteCount}\n`);

  const opened = vault.openSnapshot(receipt.ownedReadback, expectedOf(vector));
  vault.lock();
  if (opened.content?.message !== vector.inputs.payload.content.message) {
    fail('GOOGLE_DRIVE_READBACK');
  }
  process.stdout.write(`verified sha256=${receipt.sha256} bytes=${receipt.byteCount}\n`);
} catch (err) {
  const code = err instanceof GoogleError ? err.code : 'GOOGLE_DRIVE_INCOMPLETE';
  fail(code);
}
