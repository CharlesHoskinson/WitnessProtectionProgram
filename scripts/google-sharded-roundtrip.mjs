import { fork } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  BackupError,
  GoogleBackupCoordinator,
  INCOMPLETE_REASONS,
  readBackupCheckpointFile,
  writeBackupCheckpointFile,
} from '../dist/backup/index.js';
import { isPathInsideRoot } from '../dist/google/client.js';
import {
  DRIVE_ABOUT_URL,
  DRIVE_FILES_URL,
  DRIVE_UPLOAD_URL,
  GoogleError,
  authorizeInstalledApp,
  launchSystemBrowser,
  loadInstalledAppClientFile,
} from '../dist/google/index.js';
import { GOOGLE_TOKEN_URL } from '../dist/google/types.js';
import { createOwnedOAuth2Client } from '../dist/google/transport.js';
import { CiphertextJournal, JournalError } from '../dist/journal/index.js';
import {
  LIMIT_PACKAGE_BYTES,
  LIMIT_RECOVERY_WIRE_BYTES,
  canonicalizeJsonBytes,
  parseJsonBytes,
  wipeBytes,
} from '../dist/kernel/json.js';
import { UnlockedVault } from '../dist/kernel/index.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SELF = fileURLToPath(import.meta.url);

export const LAST_PACKAGE_MAX_BYTES = 16 * 1024;
export const RECOVERY_KEY_BYTES = 32;
const MULTIPART_JSON_MAX_BYTES = 4096;
const MULTIPART_MAX_BYTES = LIMIT_PACKAGE_BYTES + 16 * 1024;
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;
const HEX64 = /^[0-9a-f]{64}$/;
const WPP_BOUNDARY = /^wpp_[0-9a-f]{32}$/;
const MODES = new Set(['new-vault', 'selected-checkpoint', 'publish-unchanged', 'restore']);

const GOOGLE_CODES = Object.freeze([
  'GOOGLE_OAUTH_DENIED',
  'GOOGLE_OAUTH_TIMEOUT',
  'GOOGLE_OAUTH_EXCHANGE',
  'GOOGLE_OAUTH_SCOPE',
  'GOOGLE_OAUTH_BROWSER',
  'GOOGLE_BIND_IDENTITY',
  'GOOGLE_DRIVE_INPUT',
  'GOOGLE_DRIVE_CREATE',
  'GOOGLE_DRIVE_READBACK',
  'GOOGLE_DRIVE_AUTH',
  'GOOGLE_DRIVE_QUOTA',
  'GOOGLE_DRIVE_INCOMPLETE',
  'GOOGLE_DRIVE_REDIRECT',
  'GOOGLE_PROJECT_ID',
  'GOOGLE_GCLOUD_AUTH',
  'GOOGLE_GCLOUD_APPLY',
  'GOOGLE_CLIENT_CONFIG',
]);

const ALLOWED = new Set([
  ...GOOGLE_CODES,
  'WPP_BACKUP_SCHEMA',
  'WPP_BACKUP_IO',
  'WPP_BACKUP_INTEGRITY',
  ...INCOMPLETE_REASONS,
]);

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
  --package-sha256 HEX     Snapshot digest for restore. Must match STATE_DIR/last-package.json evidence.
  --cold-restore           Fork restore into a new process before Google authorization.
  --payload-utf8 TEXT      Synthetic snapshot message. Default: synthetic-roundtrip

The command validates mode and paths before Google authorization.
new-vault refuses existing recovery, checkpoint, last-package, or journal artifacts.
Recovery and key files use exclusive create with mode 0600.
--cold-restore forks first. The parent does not authorize and does not open the journal.
Reserved adapter-call figures are coordinator ceilings. Drive HTTP counts are measured separately.
Restore reports contentDigestMatch as true or false. It does not print witness plaintext.
The command uses authorizeInstalledApp PKCE and GoogleBackupCoordinator.
npm test does not run this command against a live Google account.
The command does not print tokens, recovery keys, root secrets, or witness plaintext.
`;

export class CliError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CliError';
    this.code = code;
  }
}

function abort(code) {
  throw new CliError(code);
}

function fail(code) {
  const mapped = ALLOWED.has(code) ? code : 'GOOGLE_DRIVE_INCOMPLETE';
  process.stderr.write(`${mapped}\n`);
  process.exit(1);
}

export function mapFailCode(err) {
  if (err instanceof CliError && ALLOWED.has(err.code)) {
    return err.code;
  }
  if (err instanceof GoogleError && ALLOWED.has(err.code)) {
    return err.code;
  }
  if (err instanceof BackupError && ALLOWED.has(err.code)) {
    return err.code;
  }
  if (err && err.name === 'BackupAbort' && ALLOWED.has(err.reason)) {
    return err.reason;
  }
  if (err instanceof JournalError) {
    if (err.code === 'INTEGRITY') {
      return 'WPP_BACKUP_INTEGRITY';
    }
    if (err.code === 'INVALID_INPUT') {
      return 'WPP_BACKUP_SCHEMA';
    }
    return 'WPP_BACKUP_IO';
  }
  if (err && typeof err.code === 'string' && ALLOWED.has(err.code)) {
    return err.code;
  }
  if (err && typeof err.reason === 'string' && ALLOWED.has(err.reason)) {
    return err.reason;
  }
  return 'GOOGLE_DRIVE_INCOMPLETE';
}

export function parseArgs(argv) {
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
          abort('WPP_BACKUP_SCHEMA');
        }
        out[key] = next;
        i += 1;
        matched = true;
        break;
      }
      if (arg.startsWith(`${flag}=`)) {
        const value = arg.slice(flag.length + 1);
        if (value.length === 0) {
          abort('WPP_BACKUP_SCHEMA');
        }
        out[key] = value;
        matched = true;
        break;
      }
    }
    if (!matched) {
      abort('WPP_BACKUP_SCHEMA');
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

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function outsideRepo(path) {
  if (typeof path !== 'string' || path.length === 0) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (isPathInsideRoot(path, ROOT)) {
    abort('GOOGLE_CLIENT_CONFIG');
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

function artifactExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return false;
    }
    abort('WPP_BACKUP_IO');
  }
}

function requireExistingFile(path) {
  try {
    const st = lstatSync(path);
    if (st.isDirectory()) {
      abort('WPP_BACKUP_SCHEMA');
    }
  } catch (err) {
    if (err instanceof CliError) {
      throw err;
    }
    abort('WPP_BACKUP_SCHEMA');
  }
}

function pathIdentity(path) {
  const abs = resolve(path);
  try {
    const lst = lstatSync(abs);
    if (lst.isSymbolicLink()) {
      const real = realpathSync(abs);
      try {
        const st = statSync(real);
        return `ino:${st.dev}:${st.ino}`;
      } catch {
        return `path:${real}`;
      }
    }
    return `ino:${lst.dev}:${lst.ino}`;
  } catch {
    return `path:${abs}`;
  }
}

function rejectCollisions(paths) {
  const labeled = [
    ['client', paths.clientFile],
    ['recovery', paths.recoveryFile],
    ['recovery-key', paths.recoveryKeyFile],
    ['checkpoint', paths.checkpointFile],
    ['last-package', paths.lastPackageFile],
    ['journal', paths.journalDir],
  ];
  const seen = new Map();
  for (const [label, path] of labeled) {
    const identity = pathIdentity(path);
    const previous = seen.get(identity);
    if (previous !== undefined) {
      abort('WPP_BACKUP_SCHEMA');
    }
    seen.set(identity, label);
  }
}

function ensureStateDir(dir) {
  mkdirSync(dir, { recursive: true, mode: DIR_MODE });
  chmodSync(dir, DIR_MODE);
}

function writeFully(fd, bytes) {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const n = writeSync(fd, bytes, offset, bytes.byteLength - offset, offset);
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n <= 0) {
      abort('WPP_BACKUP_IO');
    }
    offset += n;
  }
}

function closeQuiet(fd) {
  if (fd === undefined) {
    return;
  }
  try {
    closeSync(fd);
  } catch {
    /* ignore */
  }
}

export function writePrivateExclusive(path, bytes) {
  if (typeof path !== 'string' || path.length === 0 || !(bytes instanceof Uint8Array)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  let fd;
  try {
    fd = openSync(path, 'wx', FILE_MODE);
    writeFully(fd, bytes);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    chmodSync(path, FILE_MODE);
  } catch (err) {
    closeQuiet(fd);
    if (err instanceof CliError) {
      throw err;
    }
    if (err && err.code === 'EEXIST') {
      abort('WPP_BACKUP_SCHEMA');
    }
    abort('WPP_BACKUP_IO');
  }
}

function writePrivateAtomic(path, bytes) {
  const dir = dirname(path);
  const tmp = join(dir, `.wpp-last-${randomBytes(16).toString('hex')}`);
  let fd;
  try {
    fd = openSync(tmp, 'wx', FILE_MODE);
    writeFully(fd, bytes);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, path);
    chmodSync(path, FILE_MODE);
  } catch (err) {
    closeQuiet(fd);
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    if (err instanceof CliError) {
      throw err;
    }
    abort('WPP_BACKUP_IO');
  }
}

export function readBoundedPrivate(path, maxBytes, options = {}) {
  if (typeof path !== 'string' || path.length === 0) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (typeof maxBytes !== 'number' || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const exact = options.exact === true;
  let fd;
  let buf;
  try {
    const readFlag = fsConstants.O_RDONLY;
    const nonblockFlag = fsConstants.O_NONBLOCK;
    if (typeof readFlag !== 'number' || typeof nonblockFlag !== 'number') {
      abort('WPP_BACKUP_IO');
    }
    fd = openSync(path, readFlag | nonblockFlag);
    const st = fstatSync(fd);
    if (typeof st.isFile !== 'function' || st.isFile() !== true) {
      abort('WPP_BACKUP_INTEGRITY');
    }
    const ceiling = maxBytes + 1;
    buf = Buffer.alloc(ceiling);
    let offset = 0;
    while (offset < ceiling) {
      const n = readSync(fd, buf, offset, ceiling - offset, offset);
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
        abort('WPP_BACKUP_IO');
      }
      if (n === 0) {
        break;
      }
      offset += n;
    }
    if (offset === 0 || offset > maxBytes) {
      abort('WPP_BACKUP_INTEGRITY');
    }
    if (exact && offset !== maxBytes) {
      abort('WPP_BACKUP_INTEGRITY');
    }
    const owned = Buffer.from(buf.subarray(0, offset));
    wipeBytes(buf);
    buf = undefined;
    return owned;
  } catch (err) {
    if (err instanceof CliError) {
      throw err;
    }
    abort('WPP_BACKUP_IO');
  } finally {
    closeQuiet(fd);
    if (buf !== undefined) {
      wipeBytes(buf);
    }
  }
}

function indexOfBytes(haystack, needle, start, end) {
  const limit = Math.min(end, haystack.byteLength) - needle.byteLength;
  for (let i = start; i <= limit; i += 1) {
    let found = true;
    for (let j = 0; j < needle.byteLength; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      return i;
    }
  }
  return -1;
}

function bytesEqual(a, b) {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  return Buffer.from(a).equals(Buffer.from(b));
}

export function inspectWppMultipart(body) {
  if (!(body instanceof Uint8Array)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (body.byteLength === 0 || body.byteLength > MULTIPART_MAX_BYTES) {
    abort('WPP_BACKUP_INTEGRITY');
  }
  const firstCrlf = indexOfBytes(body, utf8('\r\n'), 0, 4 + 4 + 32 + 2);
  if (firstCrlf < 4) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const preamble = Buffer.from(body.subarray(0, firstCrlf)).toString('ascii');
  if (!preamble.startsWith('--')) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const boundary = preamble.slice(2);
  if (!WPP_BOUNDARY.test(boundary)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const head = utf8(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`);
  const mid = utf8(
    `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: binary\r\n\r\n`,
  );
  const end = utf8(`\r\n--${boundary}--\r\n`);
  if (body.byteLength < head.byteLength + mid.byteLength + end.byteLength + 1) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (!bytesEqual(body.subarray(0, head.byteLength), head)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const jsonSearchEnd = Math.min(body.byteLength, head.byteLength + MULTIPART_JSON_MAX_BYTES + mid.byteLength);
  const midAt = indexOfBytes(body, mid, head.byteLength, jsonSearchEnd);
  if (midAt < 0) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const jsonBytes = body.subarray(head.byteLength, midAt);
  if (jsonBytes.byteLength === 0 || jsonBytes.byteLength > MULTIPART_JSON_MAX_BYTES) {
    abort('WPP_BACKUP_SCHEMA');
  }
  let meta;
  try {
    meta = JSON.parse(Buffer.from(jsonBytes).toString('utf8'));
  } catch {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (typeof meta.name !== 'string' || meta.mimeType !== 'application/octet-stream') {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (!/^[0-9a-f]{64}\.wpp$/.test(meta.name)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const cipherStart = midAt + mid.byteLength;
  if (body.byteLength < cipherStart + end.byteLength) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const endAt = body.byteLength - end.byteLength;
  if (!bytesEqual(body.subarray(endAt), end)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const ciphertextLength = endAt - cipherStart;
  if (ciphertextLength < 1) {
    abort('WPP_BACKUP_SCHEMA');
  }
  return {
    partCount: 2,
    multipartByteLength: body.byteLength,
    ciphertextPartByteLength: ciphertextLength,
    name: meta.name,
  };
}

function originPath(url) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

export function classifyGoogleRequest(opts) {
  const url = String(opts?.url ?? '');
  if (url.length === 0) {
    return 'other';
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'other';
  }
  const target = `${parsed.origin}${parsed.pathname}`;
  if (target === originPath(GOOGLE_TOKEN_URL)) {
    return 'oauth';
  }
  if (target === originPath(DRIVE_ABOUT_URL)) {
    return 'about';
  }
  if (target === originPath(DRIVE_UPLOAD_URL)) {
    if (parsed.searchParams.get('uploadType') === 'multipart') {
      return 'multipart';
    }
    return 'drive-other';
  }
  const filesRoot = originPath(DRIVE_FILES_URL);
  if (target === filesRoot) {
    return parsed.searchParams.get('alt') === 'media' ? 'media' : 'list';
  }
  if (target.startsWith(`${filesRoot}/`)) {
    return parsed.searchParams.get('alt') === 'media' ? 'media' : 'drive-other';
  }
  return 'other';
}

function requestBody(opts) {
  const body = opts?.data ?? opts?.body;
  if (body instanceof Uint8Array) {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }
  return undefined;
}

function responseBytes(res) {
  const data = res?.data;
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return undefined;
}

function responseStatus(res) {
  const status = res?.status;
  if (typeof status === 'number' && Number.isSafeInteger(status)) {
    return status;
  }
  return undefined;
}

export function createDriveHttpCounter() {
  return {
    driveHttpRequests: 0,
    driveHttpRequestsAttempted: 0,
    multipartBodyBytes: 0,
    multipartBodyBytesAttempted: 0,
    ciphertextPartBytes: 0,
    ciphertextPartBytesAttempted: 0,
    ciphertextMediaBytes: 0,
    ciphertextMediaBytesAttempted: 0,
  };
}

function addMultipartAttempt(counter, opts) {
  const body = requestBody(opts);
  if (body === undefined) {
    return;
  }
  counter.multipartBodyBytesAttempted += body.byteLength;
  try {
    const inspected = inspectWppMultipart(body);
    counter.ciphertextPartBytesAttempted += inspected.ciphertextPartByteLength;
  } catch {
    /* ciphertext part unknown */
  }
}

function addMultipartSuccess(counter, opts) {
  const body = requestBody(opts);
  if (body === undefined) {
    return;
  }
  counter.multipartBodyBytes += body.byteLength;
  try {
    const inspected = inspectWppMultipart(body);
    counter.ciphertextPartBytes += inspected.ciphertextPartByteLength;
  } catch {
    /* ciphertext part unknown */
  }
}

export function noteDriveAttempt(counter, opts) {
  const kind = classifyGoogleRequest(opts);
  if (kind === 'oauth' || kind === 'other') {
    return kind;
  }
  counter.driveHttpRequestsAttempted += 1;
  if (kind === 'multipart') {
    addMultipartAttempt(counter, opts);
  }
  return kind;
}

export function noteDriveSuccess(counter, opts, res) {
  const kind = classifyGoogleRequest(opts);
  if (kind === 'oauth' || kind === 'other') {
    return kind;
  }
  counter.driveHttpRequests += 1;
  if (kind === 'multipart') {
    addMultipartSuccess(counter, opts);
  }
  if (kind === 'media') {
    const status = responseStatus(res);
    const bytes = responseBytes(res);
    if (bytes !== undefined && status !== undefined && status >= 200 && status < 300) {
      counter.ciphertextMediaBytesAttempted += bytes.byteLength;
      counter.ciphertextMediaBytes += bytes.byteLength;
    }
  }
  return kind;
}

function formatDriveMetrics(counter) {
  return [
    `driveHttpRequests=${counter.driveHttpRequests}`,
    `driveHttpRequestsAttempted=${counter.driveHttpRequestsAttempted}`,
    `multipartBodyBytes=${counter.multipartBodyBytes}`,
    `multipartBodyBytesAttempted=${counter.multipartBodyBytesAttempted}`,
    `ciphertextPartBytes=${counter.ciphertextPartBytes}`,
    `ciphertextPartBytesAttempted=${counter.ciphertextPartBytesAttempted}`,
    `ciphertextMediaBytes=${counter.ciphertextMediaBytes}`,
    `ciphertextMediaBytesAttempted=${counter.ciphertextMediaBytesAttempted}`,
  ].join(' ');
}

export function contentDigestHex(content) {
  const bytes = canonicalizeJsonBytes(content);
  try {
    return sha256Hex(bytes);
  } finally {
    wipeBytes(bytes);
  }
}

export function contentDigestMatches(content, expectedHex) {
  if (typeof expectedHex !== 'string' || !HEX64.test(expectedHex)) {
    return false;
  }
  return contentDigestHex(content) === expectedHex;
}

export function parseLastPackageBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  let parsed;
  try {
    parsed = parseJsonBytes(bytes, LAST_PACKAGE_MAX_BYTES);
  } catch {
    abort('WPP_BACKUP_INTEGRITY');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const keys = Object.keys(parsed);
  const expectedKeys = ['packageSha256', 'expected', 'expectedContentSha256', 'rootWireSha256'];
  if (keys.length !== expectedKeys.length) {
    abort('WPP_BACKUP_SCHEMA');
  }
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
      abort('WPP_BACKUP_SCHEMA');
    }
  }
  if (
    typeof parsed.packageSha256 !== 'string' ||
    typeof parsed.expectedContentSha256 !== 'string' ||
    typeof parsed.rootWireSha256 !== 'string' ||
    !HEX64.test(parsed.packageSha256) ||
    !HEX64.test(parsed.expectedContentSha256) ||
    !HEX64.test(parsed.rootWireSha256)
  ) {
    abort('WPP_BACKUP_SCHEMA');
  }
  const expected = parsed.expected;
  if (expected === null || typeof expected !== 'object' || Array.isArray(expected)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (
    typeof expected.scopeId !== 'string' ||
    expected.scopeId.length === 0 ||
    typeof expected.recordId !== 'string' ||
    expected.recordId.length === 0 ||
    typeof expected.applicationId !== 'string' ||
    expected.applicationId.length === 0
  ) {
    abort('WPP_BACKUP_SCHEMA');
  }
  return {
    packageSha256: parsed.packageSha256,
    expected,
    expectedContentSha256: parsed.expectedContentSha256,
    rootWireSha256: parsed.rootWireSha256,
  };
}

export function assertPackageEvidence(last, requestedSha256) {
  if (last === null || typeof last !== 'object') {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (typeof last.packageSha256 !== 'string' || !HEX64.test(last.packageSha256)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (typeof last.expectedContentSha256 !== 'string' || !HEX64.test(last.expectedContentSha256)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (last.expected === null || typeof last.expected !== 'object' || Array.isArray(last.expected)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (typeof requestedSha256 === 'string' && requestedSha256.length > 0) {
    if (!HEX64.test(requestedSha256) || requestedSha256 !== last.packageSha256) {
      abort('WPP_BACKUP_SCHEMA');
    }
  }
  return last;
}

function diagnoseIncompleteInitialization() {
  process.stderr.write('incomplete-initialization\n');
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
      noteDriveAttempt(counter, opts);
      const res = await inner(opts);
      noteDriveSuccess(counter, opts, res);
      return res;
    };
    return client;
  };
}

async function loadTestHook() {
  const hook = process.env.WPP_BACKUP_TEST_HOOK;
  if (typeof hook !== 'string' || hook.length === 0) {
    return null;
  }
  let resolved;
  try {
    resolved = realpathSync(hook);
  } catch {
    abort('WPP_BACKUP_SCHEMA');
  }
  let testsRoot;
  try {
    testsRoot = realpathSync(join(ROOT, 'tests'));
  } catch {
    abort('WPP_BACKUP_SCHEMA');
  }
  const rel = relative(testsRoot, resolved);
  if (rel.length === 0 || rel.startsWith('..') || isAbsolute(rel)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  return import(pathToFileURL(resolved).href);
}

function resolvePaths(args) {
  const clientFile = outsideRepo(args.clientFile);
  const stateDir = outsideRepo(args.stateDir);
  const checkpointFile = outsideRepo(args.checkpointFile ?? join(stateDir, 'checkpoint.json'));
  const recoveryFile = outsideRepo(args.recoveryFile ?? join(stateDir, 'recovery.pack'));
  const recoveryKeyFile = outsideRepo(args.recoveryKeyFile ?? join(stateDir, 'recovery.key'));
  const lastPackageFile = outsideRepo(join(stateDir, 'last-package.json'));
  const journalDir = outsideRepo(join(stateDir, 'journal'));
  const paths = {
    clientFile,
    stateDir,
    checkpointFile,
    recoveryFile,
    recoveryKeyFile,
    lastPackageFile,
    journalDir,
  };
  rejectCollisions(paths);
  return paths;
}

function validateModeAndFlags(args) {
  if (args.help) {
    return;
  }
  if (typeof args.clientFile !== 'string' || args.clientFile.length === 0) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (typeof args.stateDir !== 'string' || args.stateDir.length === 0) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (typeof args.mode !== 'string' || !MODES.has(args.mode)) {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (args.coldRestore && args.mode !== 'restore') {
    abort('WPP_BACKUP_SCHEMA');
  }
  if (typeof args.packageSha256 === 'string' && args.packageSha256.length > 0 && !HEX64.test(args.packageSha256)) {
    abort('WPP_BACKUP_SCHEMA');
  }
}

function validateArtifacts(args, paths) {
  if (args.mode === 'new-vault') {
    if (
      artifactExists(paths.recoveryFile) ||
      artifactExists(paths.recoveryKeyFile) ||
      artifactExists(paths.checkpointFile) ||
      artifactExists(paths.lastPackageFile) ||
      artifactExists(paths.journalDir)
    ) {
      abort('WPP_BACKUP_SCHEMA');
    }
    return undefined;
  }
  requireExistingFile(paths.recoveryFile);
  requireExistingFile(paths.recoveryKeyFile);
  requireExistingFile(paths.checkpointFile);
  if (args.mode === 'restore') {
    requireExistingFile(paths.lastPackageFile);
    const last = parseLastPackageBytes(readBoundedPrivate(paths.lastPackageFile, LAST_PACKAGE_MAX_BYTES));
    return assertPackageEvidence(last, args.packageSha256);
  }
  return undefined;
}

async function forkColdChild(argv) {
  const childEnv = { ...process.env, WPP_BACKUP_COLD_CHILD: '1' };
  let child;
  try {
    child = fork(SELF, argv, {
      env: childEnv,
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
  } catch {
    abort('WPP_BACKUP_IO');
  }
  const code = await new Promise((resolveExit) => {
    child.once('error', () => resolveExit(1));
    child.once('exit', (value, signal) => {
      if (signal) {
        resolveExit(1);
        return;
      }
      resolveExit(value ?? 1);
    });
  });
  process.exit(code);
}

async function authorizeSession(paths, counter) {
  const client = loadInstalledAppClientFile(paths.clientFile, ROOT);
  const hook = await loadTestHook();
  const options = {
    client,
    launchBrowser: launchOrPrint,
    createAuthClient: capturingCreateAuthClient(counter),
  };
  if (hook !== null && typeof hook.authorizeInstalledApp === 'function') {
    return hook.authorizeInstalledApp(options);
  }
  return authorizeInstalledApp(options);
}

async function restoreFlow(args, paths, session, counter, lastPackage) {
  const pack = readBoundedPrivate(paths.recoveryFile, LIMIT_RECOVERY_WIRE_BYTES);
  const key = readBoundedPrivate(paths.recoveryKeyFile, RECOVERY_KEY_BYTES, { exact: true });
  const vault = UnlockedVault.fromRecoveryPack(pack, key, [codec()]);
  try {
    const checkpoint = readBackupCheckpointFile(paths.checkpointFile);
    const packageSha256 = args.packageSha256 ?? lastPackage.packageSha256;
    const result = await GoogleBackupCoordinator.restoreSnapshot({
      vault,
      session,
      checkpoint,
      packageSha256,
      expected: lastPackage.expected,
    });
    if (result.status !== 'verified') {
      abort(ALLOWED.has(result.reason) ? result.reason : 'GOOGLE_DRIVE_INCOMPLETE');
    }
    const match = contentDigestMatches(result.snapshot.content, lastPackage.expectedContentSha256);
    process.stdout.write(
      `restored sha256=${packageSha256} contentDigestMatch=${match} ${formatDriveMetrics(counter)}\n`,
    );
    if (match !== true) {
      abort('authentication-failed');
    }
  } finally {
    vault.lock();
  }
}

async function publishFlow(args, paths, session, counter) {
  const mode = args.mode;
  let vault;
  let createdRecovery = false;
  try {
    if (mode === 'new-vault') {
      vault = UnlockedVault.fromRootRecord(utf8(JSON.stringify(randomRoot())), [codec()]);
      const pack = vault.createRecoveryPack();
      writePrivateExclusive(paths.recoveryFile, pack.wire);
      createdRecovery = true;
      writePrivateExclusive(paths.recoveryKeyFile, pack.recoveryKey);
    } else {
      vault = UnlockedVault.fromRecoveryPack(
        readBoundedPrivate(paths.recoveryFile, LIMIT_RECOVERY_WIRE_BYTES),
        readBoundedPrivate(paths.recoveryKeyFile, RECOVERY_KEY_BYTES, { exact: true }),
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
              checkpoint: readBackupCheckpointFile(paths.checkpointFile),
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
      const content = { message: args.payloadUtf8 };
      result = await coordinator.publishSnapshot({
        scopeId,
        recordId,
        payloadUtf8: payloadBytes(args.payloadUtf8),
      });
      if (result.status === 'verified') {
        writePrivateAtomic(
          paths.lastPackageFile,
          utf8(
            JSON.stringify({
              packageSha256: result.packageSha256,
              expected,
              expectedContentSha256: contentDigestHex(content),
              rootWireSha256: result.checkpoint.root.wireSha256,
            }),
          ),
        );
      }
    }
    if (result.status !== 'verified') {
      abort(ALLOWED.has(result.reason) ? result.reason : 'GOOGLE_DRIVE_INCOMPLETE');
    }
    writeBackupCheckpointFile(paths.checkpointFile, result.checkpoint);
    process.stdout.write(
      `verified root=${result.checkpoint.root.wireSha256} bytes=${result.checkpoint.root.wireByteLength} reservedAdapterCalls=${result.metrics.reservedAdapterCalls} reservedUploadDownloadBytes=${result.metrics.reservedUploadDownloadBytes} ${formatDriveMetrics(counter)}\n`,
    );
  } catch (err) {
    if (createdRecovery) {
      diagnoseIncompleteInitialization();
    }
    throw err;
  } finally {
    if (vault !== undefined) {
      vault.lock();
    }
  }
}

async function runLive(args, argv) {
  validateModeAndFlags(args);
  const paths = resolvePaths(args);
  ensureStateDir(paths.stateDir);
  const lastPackage = validateArtifacts(args, paths);
  if (args.coldRestore && process.env.WPP_BACKUP_COLD_CHILD !== '1') {
    await forkColdChild(argv);
    return;
  }
  const counter = createDriveHttpCounter();
  const session = await authorizeSession(paths, counter);
  process.stdout.write('connected\n');
  if (args.mode === 'restore') {
    await restoreFlow(args, paths, session, counter, lastPackage);
    return;
  }
  await publishFlow(args, paths, session, counter);
}

function isMainModule() {
  const entry = process.argv[1];
  if (typeof entry !== 'string' || entry.length === 0) {
    return false;
  }
  try {
    return realpathSync(entry) === realpathSync(SELF);
  } catch {
    return resolve(entry) === resolve(SELF);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    process.stdout.write(HELP);
    process.exit(0);
  }
  try {
    const args = parseArgs(argv);
    if (args.help) {
      process.stdout.write(HELP);
      process.exit(0);
    }
    await runLive(args, argv);
  } catch (err) {
    fail(mapFailCode(err));
  }
}

if (isMainModule()) {
  await main();
}
