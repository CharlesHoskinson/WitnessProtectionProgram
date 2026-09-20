import { deepEqual, equal, ok, throws } from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  parseBackupCheckpoint,
  readBackupCheckpointFile,
  readBackupCheckpointFileAsync,
  writeBackupCheckpointFile,
  writeBackupCheckpointFileAsync,
  BackupError,
} from '../dist/backup/index.js';

const CHECKPOINT_MAX_BYTES = 16 * 1024;
const ROOT_WIRE_BYTES = 8 * 1024 * 1024;

const SAMPLE = {
  format: 'wpp-backup-checkpoint',
  version: 1,
  root: {
    wireSha256: 'ab'.repeat(32),
    wireByteLength: 128,
    locator: {
      provider: 'google-drive',
      accountBinding: { scheme: 'google-drive-permission-id', value: 'permId-opaque-stable-001' },
      objectId: 'file-root-1',
      revisionId: null,
    },
  },
};

const PROXY_TRAPS = [
  'apply',
  'construct',
  'defineProperty',
  'deleteProperty',
  'get',
  'getOwnPropertyDescriptor',
  'getPrototypeOf',
  'has',
  'isExtensible',
  'ownKeys',
  'preventExtensions',
  'set',
  'setPrototypeOf',
];

function schemaError(err) {
  equal(err instanceof BackupError, true);
  equal(err.code, 'WPP_BACKUP_SCHEMA');
  return true;
}

function integrityError(err) {
  equal(err instanceof BackupError, true);
  equal(err.code, 'WPP_BACKUP_INTEGRITY');
  return true;
}

function ioOrIntegrity(err) {
  equal(err instanceof BackupError, true);
  ok(err.code === 'WPP_BACKUP_INTEGRITY' || err.code === 'WPP_BACKUP_IO');
  return true;
}

function assignNullProto(source) {
  const out = Object.create(null);
  for (const key of Object.keys(source)) {
    out[key] = source[key];
  }
  return out;
}

function nullPrototypeCheckpoint() {
  const accountBinding = assignNullProto(SAMPLE.root.locator.accountBinding);
  const locator = assignNullProto({ ...SAMPLE.root.locator, accountBinding });
  const root = assignNullProto({ ...SAMPLE.root, locator });
  return assignNullProto({ ...SAMPLE, root });
}

function countingProxy(target) {
  const traps = { count: 0, names: [] };
  const handler = {};
  for (const name of PROXY_TRAPS) {
    handler[name] = () => {
      traps.count += 1;
      traps.names.push(name);
      throw new Error(`checkpoint-proxy-trap:${name}`);
    };
  }
  return { proxy: new Proxy(target, handler), traps };
}

function cloneSample() {
  return structuredClone(SAMPLE);
}

function refusePathInChild(path) {
  const moduleUrl = new URL('../dist/backup/index.js', import.meta.url).href;
  const source = `
    import { readBackupCheckpointFile } from ${JSON.stringify(moduleUrl)};
    try {
      readBackupCheckpointFile(${JSON.stringify(path)});
      process.exit(2);
    } catch (err) {
      const code = typeof err?.code === 'string' ? err.code : '';
      process.stdout.write(code);
      process.exit(code === 'WPP_BACKUP_INTEGRITY' || code === 'WPP_BACKUP_IO' ? 0 : 3);
    }
  `;
  return spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    timeout: 2000,
    killSignal: 'SIGKILL',
  });
}

describe('backup checkpoint', () => {
  test('parses a closed version 1 record and rejects extra fields', () => {
    const parsed = parseBackupCheckpoint(SAMPLE);
    equal(parsed.format, 'wpp-backup-checkpoint');
    equal(parsed.version, 1);
    equal(parsed.root.wireSha256, SAMPLE.root.wireSha256);
    equal(parsed.root.locator.revisionId, null);
    throws(() => parseBackupCheckpoint({ ...SAMPLE, token: 'nope' }), (err) => {
      equal(err instanceof BackupError, true);
      equal(err.code, 'WPP_BACKUP_SCHEMA');
      return true;
    });
    throws(() => parseBackupCheckpoint({ ...SAMPLE, root: { ...SAMPLE.root, secretRoot: 'x' } }), (err) => {
      equal(err.code, 'WPP_BACKUP_SCHEMA');
      return true;
    });
  });

  test('parses a valid null-prototype checkpoint', () => {
    const parsed = parseBackupCheckpoint(nullPrototypeCheckpoint());
    equal(parsed.format, SAMPLE.format);
    equal(parsed.root.locator.objectId, SAMPLE.root.locator.objectId);
    equal(parsed.root.wireByteLength, SAMPLE.root.wireByteLength);
  });

  test('caller mutation after parse does not change the owned checkpoint', () => {
    const input = structuredClone(SAMPLE);
    const parsed = parseBackupCheckpoint(input);
    input.root.wireSha256 = '00'.repeat(32);
    input.root.locator.objectId = 'mutated';
    equal(parsed.root.wireSha256, SAMPLE.root.wireSha256);
    equal(parsed.root.locator.objectId, 'file-root-1');
    throws(() => {
      parsed.root.wireSha256 = '00'.repeat(32);
    });
    throws(() => {
      parsed.root.locator.objectId = 'mutated';
    });
  });

  test('rejects a hostile Proxy before any trap runs', () => {
    const { proxy, traps } = countingProxy(cloneSample());
    throws(() => parseBackupCheckpoint(proxy), schemaError);
    equal(traps.count, 0);
  });

  test('rejects a nested Proxy and an unknown-property Proxy with zero trap calls', () => {
    const nested = countingProxy(cloneSample().root);
    throws(() => parseBackupCheckpoint({ ...SAMPLE, root: nested.proxy }), schemaError);
    equal(nested.traps.count, 0);

    const extra = countingProxy({ secret: 'nope' });
    throws(() => parseBackupCheckpoint({ ...SAMPLE, extra: extra.proxy }), schemaError);
    equal(extra.traps.count, 0);
  });

  test('rejects accessors without executing them', () => {
    let formatGets = 0;
    const formatAccessor = cloneSample();
    Object.defineProperty(formatAccessor, 'format', {
      configurable: true,
      enumerable: true,
      get() {
        formatGets += 1;
        return SAMPLE.format;
      },
    });
    throws(() => parseBackupCheckpoint(formatAccessor), schemaError);
    equal(formatGets, 0);

    let extraGets = 0;
    const extraAccessor = cloneSample();
    Object.defineProperty(extraAccessor, 'token', {
      configurable: true,
      enumerable: true,
      get() {
        extraGets += 1;
        return 'secret';
      },
    });
    throws(() => parseBackupCheckpoint(extraAccessor), schemaError);
    equal(extraGets, 0);
  });

  test('rejects symbols, missing keys, and nonenumerable extras', () => {
    const missing = cloneSample();
    delete missing.version;
    throws(() => parseBackupCheckpoint(missing), schemaError);

    const hidden = cloneSample();
    Object.defineProperty(hidden, 'hidden', { value: 'x', enumerable: false });
    throws(() => parseBackupCheckpoint(hidden), schemaError);

    const withSymbol = cloneSample();
    Object.defineProperty(withSymbol, Symbol('x'), { value: 1, enumerable: true });
    throws(() => parseBackupCheckpoint(withSymbol), schemaError);

    throws(() => parseBackupCheckpoint(null), schemaError);
    throws(() => parseBackupCheckpoint(['wpp-backup-checkpoint']), schemaError);
  });

  test('rejects malformed strings and a trailing newline at the true end', () => {
    const hexNewline = cloneSample();
    hexNewline.root.wireSha256 = `${'ab'.repeat(32)}\n`;
    throws(() => parseBackupCheckpoint(hexNewline), schemaError);

    const hexUpper = cloneSample();
    hexUpper.root.wireSha256 = 'AB'.repeat(32);
    throws(() => parseBackupCheckpoint(hexUpper), schemaError);

    const permissionNewline = cloneSample();
    permissionNewline.root.locator.accountBinding = {
      ...SAMPLE.root.locator.accountBinding,
      value: 'permId-opaque-stable-001\n',
    };
    throws(() => parseBackupCheckpoint(permissionNewline), schemaError);

    const objectNewline = cloneSample();
    objectNewline.root.locator.objectId = 'file-root-1\n';
    throws(() => parseBackupCheckpoint(objectNewline), schemaError);

    const revisionNewline = cloneSample();
    revisionNewline.root.locator.revisionId = 'rev-1\n';
    throws(() => parseBackupCheckpoint(revisionNewline), schemaError);

    const tooLong = cloneSample();
    tooLong.root.locator.objectId = `f${'a'.repeat(128)}`;
    throws(() => parseBackupCheckpoint(tooLong), schemaError);

    const dottedObject = cloneSample();
    dottedObject.root.locator.objectId = 'file.root';
    throws(() => parseBackupCheckpoint(dottedObject), schemaError);

    const zeroLength = cloneSample();
    zeroLength.root.wireByteLength = 0;
    throws(() => parseBackupCheckpoint(zeroLength), schemaError);

    const overWire = cloneSample();
    overWire.root.wireByteLength = ROOT_WIRE_BYTES + 1;
    throws(() => parseBackupCheckpoint(overWire), schemaError);
  });

  test('atomic 0600 persistence round-trips and contains no key fields', async () => {
    const dir = await mkdtemp(join(process.cwd(), 'wpp-checkpoint-'));
    try {
      const path = join(dir, 'checkpoint.json');
      writeBackupCheckpointFile(path, SAMPLE);
      const st = lstatSync(path);
      equal(st.isFile(), true);
      equal(st.mode & 0o777, 0o600);
      const raw = readFileSync(path, 'utf8');
      equal(raw.includes('secretRoot'), false);
      equal(raw.includes('token'), false);
      equal(raw.includes('recoveryKey'), false);
      const loaded = readBackupCheckpointFile(path);
      deepEqual(loaded, parseBackupCheckpoint(SAMPLE));
      await writeBackupCheckpointFileAsync(path, SAMPLE);
      const loadedAsync = await readBackupCheckpointFileAsync(path);
      deepEqual(loadedAsync, loaded);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('rejects empty and oversized checkpoint files', async () => {
    const dir = await mkdtemp(join(process.cwd(), 'wpp-checkpoint-'));
    try {
      const emptyPath = join(dir, 'empty.json');
      writeFileSync(emptyPath, '');
      throws(() => readBackupCheckpointFile(emptyPath), integrityError);

      const oversizedPath = join(dir, 'oversize.json');
      writeFileSync(oversizedPath, Buffer.alloc(CHECKPOINT_MAX_BYTES + 1, 0x7b));
      throws(() => readBackupCheckpointFile(oversizedPath), integrityError);

      const sparsePath = join(dir, 'sparse.json');
      const fd = openSync(sparsePath, 'w');
      try {
        ftruncateSync(fd, CHECKPOINT_MAX_BYTES + 1);
      } finally {
        closeSync(fd);
      }
      throws(() => readBackupCheckpointFile(sparsePath), integrityError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('refuses FIFO and other nonregular files without blocking', async () => {
    const dir = await mkdtemp(join(process.cwd(), 'wpp-checkpoint-'));
    try {
      const fifoPath = join(dir, 'checkpoint.fifo');
      execFileSync('mkfifo', [fifoPath], { stdio: 'ignore' });
      equal(lstatSync(fifoPath).isFIFO(), true);
      const child = refusePathInChild(fifoPath);
      equal(child.error, undefined);
      equal(child.signal, null);
      equal(child.status, 0);
      ok(child.stdout === 'WPP_BACKUP_INTEGRITY' || child.stdout === 'WPP_BACKUP_IO');

      const dirPath = join(dir, 'as-dir');
      mkdirSync(dirPath);
      throws(() => readBackupCheckpointFile(dirPath), ioOrIntegrity);
      throws(() => readBackupCheckpointFile('/dev/null'), ioOrIntegrity);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('bounded reader is capped at CHECKPOINT_MAX_BYTES plus one and does not use readFileSync', () => {
    const compiledPath = fileURLToPath(new URL('../dist/backup/checkpoint.js', import.meta.url));
    const compiled = readFileSync(compiledPath, 'utf8');
    equal(compiled.includes('readFileSync'), false);
    ok(compiled.includes('O_NONBLOCK'));
    ok(compiled.includes('CHECKPOINT_READ_CEILING'));
    ok(compiled.includes('isProxy'));
  });

  test('write rejects a hostile checkpoint before it creates the destination', async () => {
    const dir = await mkdtemp(join(process.cwd(), 'wpp-checkpoint-'));
    try {
      const path = join(dir, 'checkpoint.json');
      const { proxy, traps } = countingProxy(cloneSample());
      throws(() => writeBackupCheckpointFile(path, proxy), schemaError);
      equal(traps.count, 0);
      equal(existsSync(path), false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
