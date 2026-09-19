import { deepEqual, equal, notEqual, ok, rejects } from 'node:assert/strict';
import { execFileSync, fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, statfs, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import canonicalize from 'canonicalize';

import { CiphertextJournal, JournalError } from '../dist/journal/index.js';
import { UnlockedVault } from '../dist/kernel/index.js';

const CHILD = fileURLToPath(new URL('./helpers/journal-child.mjs', import.meta.url));
const VECTOR = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/wpp-v1-vectors.json', import.meta.url)), 'utf8'),
);

const SECRET_MARKER = 'WPP_TEST_SECRET_MARKER_c0ffee91';
const ACCOUNT_MARKER = 'fixture-account';
const ROOT_HEX = VECTOR.inputs.secretRootHex;
const EXT_FAMILY = 0xef53n;
const TMPFS = 0x01021994n;
const LIST_BOUND = 10000;
const JOURNAL_CODES = new Set([
  'INVALID_INPUT',
  'UNSUPPORTED_PLATFORM',
  'UNSUPPORTED_FILESYSTEM',
  'UNSAFE_PATH',
  'INTEGRITY',
  'NOT_FOUND',
  'INCOMPLETE',
  'IO',
]);
const COMMITTED = /^[0-9a-f]{64}\.wpp$/;
const TEMP = /^\.wpp-tmp-[0-9a-f]{32}$/;
const vectorCodec = { id: 'wpp.synthetic-vector', validate() {} };

function utf8(text) {
  return Buffer.from(text, 'utf8');
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function id32(fill) {
  return Buffer.alloc(32, fill).toString('base64url');
}

function vectorRoot() {
  const header = VECTOR.inputs.header;
  return {
    format: 'wpp-root-record',
    version: 1,
    revisionId: id32(0xaa),
    parents: [],
    vaultId: header.vaultId,
    vaultSalt: header.vaultSalt,
    catalogScopeId: id32(0xbb),
    catalogRecordId: id32(0xcc),
    epochs: [
      {
        rootEpoch: header.rootEpoch,
        secretRoot: Buffer.from(ROOT_HEX, 'hex').toString('base64url'),
        createdAt: '2026-09-19T00:00:00Z',
        status: 'active',
      },
    ],
  };
}

function payloadUtf8() {
  const canonical = canonicalize({
    payloadVersion: 1,
    metadata: VECTOR.inputs.payload.metadata,
    content: { ...VECTOR.inputs.payload.content, marker: SECRET_MARKER },
  });
  if (typeof canonical !== 'string') {
    throw new Error('payload canonicalize failed');
  }
  return utf8(canonical);
}

function rootUtf8() {
  return utf8(JSON.stringify(vectorRoot()));
}

function authPayload(dir, sha256) {
  return {
    action: 'authenticate',
    journalDir: dir,
    sha256,
    rootB64: Buffer.from(rootUtf8()).toString('base64'),
    codecId: vectorCodec.id,
    expected: expectedBinding(),
    expectedMarker: SECRET_MARKER,
  };
}

function expectedBinding() {
  const meta = VECTOR.inputs.payload.metadata;
  return {
    scopeId: VECTOR.inputs.header.scopeId,
    recordId: VECTOR.inputs.header.recordId,
    network: structuredClone(meta.network),
    accountBinding: structuredClone(meta.accountBinding),
    applicationId: meta.applicationId,
    contract: structuredClone(meta.contract),
    codec: structuredClone(meta.codec),
  };
}

function unlock() {
  return UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot())), [vectorCodec]);
}

function sealWith(vault) {
  return vault.sealSnapshot({
    scopeId: VECTOR.inputs.header.scopeId,
    recordId: VECTOR.inputs.header.recordId,
    payloadUtf8: payloadUtf8(),
  });
}

function leakHaystack(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function assertNoLeak(value, dir) {
  const text = leakHaystack(value);
  equal(text.includes(SECRET_MARKER), false);
  equal(text.includes(ACCOUNT_MARKER), false);
  equal(text.includes(ROOT_HEX), false);
  equal(text.includes('wpp-vector-fixture'), false);
  if (dir) {
    equal(text.includes(dir), false);
  }
}

function assertJournalError(err, code) {
  ok(err instanceof JournalError);
  equal(err.code, code);
  ok(JOURNAL_CODES.has(err.code));
  equal(typeof err.message, 'string');
  equal(err.path, undefined);
  equal(err.dest, undefined);
  assertNoLeak(`${err.name}\n${err.message}\n${err.code}\n${err.stack ?? ''}`);
  return true;
}

function codeIs(code) {
  return (err) => assertJournalError(err, code);
}

function committedName(digest) {
  return `${digest}.wpp`;
}

function fsType(st) {
  return BigInt(st.type);
}

async function withTempDir(fn) {
  ok(join(process.cwd(), 'x').startsWith(process.cwd()));
  const root = await mkdtemp(join(process.cwd(), 'wpp-journal-it-'));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function withJournal(fn) {
  return withTempDir(async (root) => {
    const dir = join(root, 'journal');
    const journal = await CiphertextJournal.open(dir);
    return fn({ root, dir, journal });
  });
}

function parseReceipt(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  equal(lines.length, 1);
  return JSON.parse(lines[0]);
}

function runChild(payload, { killAtBoundary = false, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = fork(CHILD, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    const out = [];
    const err = [];
    let ready = false;
    let boundary = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      const reason = killAtBoundary && !boundary ? 'did not reach publication boundary' : 'child timeout';
      reject(new Error(reason));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('message', (msg) => {
      if (msg?.stage === 'ready') {
        ready = true;
      }
      if (msg?.stage === 'at-boundary') {
        boundary = true;
        if (killAtBoundary) {
          child.kill('SIGKILL');
        }
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        ready,
        boundary,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      });
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

function journalEntries(dir) {
  return readdir(dir, { withFileTypes: true });
}

async function assertOpaqueStore(dir, digest) {
  const entries = await journalEntries(dir);
  for (const entry of entries) {
    ok(COMMITTED.test(entry.name) || TEMP.test(entry.name), entry.name);
    equal(entry.name.includes('fixture'), false);
    equal(entry.name.includes('account'), false);
    if (entry.isFile()) {
      const bytes = readFileSync(join(dir, entry.name));
      const text = bytes.toString('utf8');
      equal(text.includes(SECRET_MARKER), false);
      equal(text.includes(ACCOUNT_MARKER), false);
      equal(text.includes(ROOT_HEX), false);
    }
  }
  if (digest) {
    ok(entries.some((entry) => entry.name === committedName(digest)));
  }
}

describe('CiphertextJournal', () => {
  test('kernel seal, local-durable put/get, identical bytes, kernel open, idempotence, owned copies', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir, journal }) => {
        const sealed = sealWith(vault);
        const wireCopy = Buffer.from(sealed.wire);
        equal(sealed.sha256, sha256Hex(sealed.wire));
        const putOnce = journal.put({ wire: sealed.wire, sha256: sealed.sha256 });
        sealed.wire.fill(0);
        const stored = await putOnce;
        equal(stored.status, 'local-durable');
        notEqual(stored.status, 'Backup verified');
        equal(stored.sha256, sha256Hex(wireCopy));
        equal(stored.byteLength, wireCopy.byteLength);
        equal('remove' in journal, false);
        equal('prune' in journal, false);
        equal('markUploaded' in journal, false);

        const got = await journal.get(stored.sha256);
        ok(got instanceof Uint8Array);
        deepEqual(Buffer.from(got), wireCopy);
        equal(sha256Hex(got), stored.sha256);
        got[0] ^= 0xff;
        const gotAgain = await journal.get(stored.sha256);
        deepEqual(Buffer.from(gotAgain), wireCopy);

        const opened = vault.openSnapshot(gotAgain, expectedBinding());
        equal(opened.packageSha256, stored.sha256);
        equal(opened.content.marker, SECRET_MARKER);
        equal(opened.metadata.accountBinding.value, ACCOUNT_MARKER);

        const again = await journal.put({ wire: Uint8Array.from(wireCopy), sha256: stored.sha256 });
        equal(again.status, 'local-durable');
        equal(again.sha256, stored.sha256);
        equal(again.byteLength, stored.byteLength);
        deepEqual([...(await journal.list())], [stored.sha256]);
        await assertOpaqueStore(dir, stored.sha256);
      });
    } finally {
      vault.lock();
    }
  });

  test('fresh child reopen get, parent authenticates identical bytes', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir, journal }) => {
        const sealed = sealWith(vault);
        const stored = await journal.put({ wire: sealed.wire, sha256: sealed.sha256 });
        const child = await runChild(authPayload(dir, stored.sha256));
        equal(child.code, 0);
        assertNoLeak(child.stderr, dir);
        const receipt = parseReceipt(child.stdout);
        equal(receipt.ok, true);
        equal(receipt.authenticated, true);
        equal(receipt.markerOk, true);
        equal(receipt.packageSha256, stored.sha256);
        assertNoLeak(receipt, dir);
        const got = await journal.get(stored.sha256);
        equal(sha256Hex(got), stored.sha256);
        const opened = vault.openSnapshot(got, expectedBinding());
        equal(opened.packageSha256, stored.sha256);
        equal(opened.content.marker, SECRET_MARKER);
      });
    } finally {
      vault.lock();
    }
  });

  test('two independent in-process handles and two child writers persist the same object', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ root, dir }) => {
        const sealed = sealWith(vault);
        const a = await CiphertextJournal.open(dir);
        const b = await CiphertextJournal.open(dir);
        const [left, right] = await Promise.all([
          a.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 }),
          b.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 }),
        ]);
        equal(left.status, 'local-durable');
        equal(right.status, 'local-durable');
        equal(left.sha256, right.sha256);

        const other = join(root, 'journal-b');
        const first = sealWith(vault);
        await CiphertextJournal.open(other);
        const [childA, childB] = await Promise.all([
          runChild({
            action: 'put',
            journalDir: other,
            wireB64: Buffer.from(first.wire).toString('base64'),
            sha256: first.sha256,
          }),
          runChild({
            action: 'put',
            journalDir: other,
            wireB64: Buffer.from(first.wire).toString('base64'),
            sha256: first.sha256,
          }),
        ]);
        equal(childA.code, 0);
        equal(childB.code, 0);
        const receiptA = parseReceipt(childA.stdout);
        const receiptB = parseReceipt(childB.stdout);
        equal(receiptA.status, 'local-durable');
        equal(receiptB.status, 'local-durable');
        equal(receiptA.sha256, first.sha256);
        const peer = await CiphertextJournal.open(other);
        const got = await peer.get(first.sha256);
        deepEqual(Buffer.from(got), Buffer.from(first.wire));
        vault.openSnapshot(got, expectedBinding());
      });
    } finally {
      vault.lock();
    }
  });

  test('rejects mismatched digest, malformed or unbounded wire, and root records', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ journal }) => {
        const sealed = sealWith(vault);
        const other = 'ab'.repeat(32);
        await rejects(
          () => journal.put({ wire: Uint8Array.from(sealed.wire), sha256: other }),
          codeIs('INVALID_INPUT'),
        );

        const rootBytes = utf8(JSON.stringify(vectorRoot()));
        await rejects(
          () => journal.put({ wire: rootBytes, sha256: sha256Hex(rootBytes) }),
          codeIs('INVALID_INPUT'),
        );

        const cases = [
          ['empty', new Uint8Array(0), sha256Hex(new Uint8Array(0))],
          ['array', utf8('[1,2,3]'), sha256Hex(utf8('[1,2,3]'))],
          ['object', utf8('{"not":"a-package"}'), sha256Hex(utf8('{"not":"a-package"}'))],
          [
            'recovery',
            utf8(
              '{"header":{"format":"wpp-recovery-pack","version":1,"suite":"A256GCM","nonce":"AAAAAAAAAAAA"},"ciphertext":"AA","tag":"AAAAAAAAAAAAAAAAAAAAAA"}',
            ),
            'ab'.repeat(32),
          ],
          ['oversize', new Uint8Array(24 * 1024 * 1024 + 1), 'cd'.repeat(32)],
        ];
        for (const [title, wire, digest] of cases) {
          await rejects(
            () => journal.put({ wire, sha256: digest }),
            (err) => {
              assertJournalError(err, 'INVALID_INPUT');
              assertNoLeak(title);
              return true;
            },
          );
        }
        await rejects(() => journal.get('a'.repeat(64)), codeIs('NOT_FOUND'));
      });
    } finally {
      vault.lock();
    }
  });

  test('rejects traversal and non-lowercase digest identifiers', async () => {
    await withJournal(async ({ journal, dir }) => {
      const digest = 'ab'.repeat(32);
      const rows = [
        ['empty', '', 'INVALID_INPUT'],
        ['short', 'abcd', 'INVALID_INPUT'],
        ['upper', digest.toUpperCase(), 'INVALID_INPUT'],
        ['slash', `${digest.slice(0, 32)}/${digest.slice(32)}`, 'UNSAFE_PATH'],
        ['dotdot', `../${digest}`, 'UNSAFE_PATH'],
        ['suffix', `${digest}.wpp`, 'INVALID_INPUT'],
        ['nul', `${digest}\0x`, 'INVALID_INPUT'],
      ];
      for (const [, value, code] of rows) {
        await rejects(() => journal.get(value), (err) => {
          if (code === 'UNSAFE_PATH' && err.code === 'INVALID_INPUT') {
            return assertJournalError(err, 'INVALID_INPUT');
          }
          assertJournalError(err, code);
          assertNoLeak(err.message, dir);
          return true;
        });
      }
    });
  });

  test('corrupt, truncated, symlink, fifo, and mode-wrong targets are integrity errors', { timeout: 8000 }, async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir, journal }) => {
        const sealed = sealWith(vault);
        const stored = await journal.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 });
        const target = join(dir, committedName(stored.sha256));

        writeFileSync(target, readFileSync(target).subarray(0, 8));
        await rejects(() => journal.get(stored.sha256), codeIs('INTEGRITY'));
        await rejects(
          () => journal.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 }),
          codeIs('INTEGRITY'),
        );

        const fresh = sealWith(vault);
        const freshStored = await journal.put({ wire: Uint8Array.from(fresh.wire), sha256: fresh.sha256 });
        const freshTarget = join(dir, committedName(freshStored.sha256));
        const mutated = Buffer.from(readFileSync(freshTarget));
        mutated[mutated.byteLength - 1] ^= 0xff;
        writeFileSync(freshTarget, mutated);
        chmodSync(freshTarget, 0o600);
        await rejects(() => journal.get(freshStored.sha256), codeIs('INTEGRITY'));

        const third = sealWith(vault);
        const thirdStored = await journal.put({ wire: Uint8Array.from(third.wire), sha256: third.sha256 });
        const thirdTarget = join(dir, committedName(thirdStored.sha256));
        chmodSync(thirdTarget, 0o644);
        await rejects(() => journal.get(thirdStored.sha256), codeIs('INTEGRITY'));
        chmodSync(thirdTarget, 0o600);

        const fourth = sealWith(vault);
        await rm(join(dir, committedName(fourth.sha256)), { force: true });
        writeFileSync(join(dir, 'elsewhere'), 'x');
        symlinkSync('elsewhere', join(dir, committedName(fourth.sha256)));
        await rejects(
          () => journal.put({ wire: Uint8Array.from(fourth.wire), sha256: fourth.sha256 }),
          codeIs('INTEGRITY'),
        );

        const fifth = sealWith(vault);
        const fifoPath = join(dir, committedName(fifth.sha256));
        execFileSync('mkfifo', [fifoPath], { stdio: 'ignore' });
        await rejects(
          () => journal.put({ wire: Uint8Array.from(fifth.wire), sha256: fifth.sha256 }),
          codeIs('INTEGRITY'),
        );
        await rejects(() => journal.get(fifth.sha256), codeIs('INTEGRITY'));
        equal(lstatSync(fifoPath).isFIFO(), true);
      });
    } finally {
      vault.lock();
    }
  });

  test('open rejects wrong permissions, non-directories, parent writability, and leaf symlinks', async () => {
    await withTempDir(async (root) => {
      const filePath = join(root, 'as-file');
      writeFileSync(filePath, 'nope');
      await rejects(() => CiphertextJournal.open(filePath), codeIs('UNSAFE_PATH'));

      const missing = join(root, 'missing', 'journal');
      await rejects(() => CiphertextJournal.open(missing), (err) => {
        ok(err.code === 'UNSAFE_PATH' || err.code === 'IO');
        return assertJournalError(err, err.code);
      });

      const linked = join(root, 'linked');
      const real = join(root, 'real');
      await mkdir(real, { mode: 0o700 });
      chmodSync(real, 0o700);
      await symlink(real, linked);
      await rejects(() => CiphertextJournal.open(linked), codeIs('UNSAFE_PATH'));

      const fifo = join(root, 'fifo');
      execFileSync('mkfifo', [fifo], { stdio: 'ignore' });
      await rejects(() => CiphertextJournal.open(fifo), codeIs('UNSAFE_PATH'));

      const loose = join(root, 'loose');
      await mkdir(loose, { mode: 0o755 });
      chmodSync(loose, 0o755);
      await rejects(() => CiphertextJournal.open(loose), codeIs('UNSAFE_PATH'));

      const parent = join(root, 'parent');
      await mkdir(parent, { mode: 0o707 });
      chmodSync(parent, 0o707);
      await rejects(() => CiphertextJournal.open(join(parent, 'journal')), codeIs('UNSAFE_PATH'));
    });
  });

  test('list ignores exact orphan temps, keeps them, and reports unknown names', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir, journal }) => {
        const sealed = sealWith(vault);
        const stored = await journal.put({ wire: sealed.wire, sha256: sealed.sha256 });
        const orphan = join(dir, `.wpp-tmp-${'ab'.repeat(16)}`);
        writeFileSync(orphan, 'orphan-temp');
        chmodSync(orphan, 0o600);
        deepEqual([...(await journal.list())], [stored.sha256]);
        ok(existsSync(orphan));

        writeFileSync(join(dir, 'lost-record.bak'), 'unknown');
        await rejects(() => journal.list(), (err) => {
          ok(err.code === 'INTEGRITY' || err.code === 'INCOMPLETE');
          return assertJournalError(err, err.code);
        });
        ok(existsSync(orphan));
      });
    } finally {
      vault.lock();
    }
  });

  test('list does not silently truncate above 10000 directory entries', { timeout: 60000 }, async () => {
    await withJournal(async ({ dir, journal }) => {
      const seed = join(dir, `${'0'.repeat(64)}.wpp`);
      writeFileSync(seed, 'x', { mode: 0o600 });
      chmodSync(seed, 0o600);
      for (let i = 1; i <= LIST_BOUND; i += 1) {
        linkSync(seed, join(dir, `${i.toString(16).padStart(64, '0')}.wpp`));
      }
      await rejects(() => journal.list(), codeIs('INCOMPLETE'));
    });
  });

  test('rejects tmpfs /tmp when statfs confirms tmpfs', async (t) => {
    const st = await statfs('/tmp');
    if (fsType(st) !== TMPFS) {
      t.skip('host /tmp is not tmpfs');
      return;
    }
    const probe = join('/tmp', `wpp-journal-fs-probe-${process.pid}`);
    try {
      await rejects(() => CiphertextJournal.open(probe), codeIs('UNSUPPORTED_FILESYSTEM'));
    } finally {
      await rm(probe, { recursive: true, force: true });
    }
  });

  test('open on admitted ext-family workspace parent succeeds', async () => {
    const st = await statfs(process.cwd());
    equal(fsType(st), EXT_FAMILY);
    await withJournal(async ({ dir, journal }) => {
      deepEqual([...(await journal.list())], []);
      const mode = lstatSync(dir).mode & 0o777;
      equal(mode, 0o700);
    });
  });

  test('rename is not required for publication and fsync faults do not acknowledge', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir }) => {
        const sealed = sealWith(vault);
        const payload = {
          journalDir: dir,
          wireB64: Buffer.from(sealed.wire).toString('base64'),
          sha256: sealed.sha256,
        };
        const renamed = await runChild({ ...payload, action: 'put-fault', fault: 'rename-forbidden' });
        equal(renamed.code, 0);
        equal(parseReceipt(renamed.stdout).status, 'local-durable');

        const other = sealWith(vault);
        const eioTemp = await runChild({
          action: 'put-fault',
          fault: 'eio-temp-fsync',
          journalDir: dir,
          wireB64: Buffer.from(other.wire).toString('base64'),
          sha256: other.sha256,
        });
        equal(eioTemp.code, 1);
        const eioReceipt = parseReceipt(eioTemp.stdout);
        equal(eioReceipt.ok, false);
        equal(eioReceipt.code, 'IO');
        assertNoLeak(eioReceipt, dir);
        const after = await CiphertextJournal.open(dir);
        await rejects(() => after.get(other.sha256), codeIs('NOT_FOUND'));
      });
    } finally {
      vault.lock();
    }
  });

  test('child kill before link leaves no acknowledged record', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir }) => {
        const sealed = sealWith(vault);
        const child = await runChild(
          {
            action: 'put-fault',
            fault: 'kill-before-link',
            journalDir: dir,
            wireB64: Buffer.from(sealed.wire).toString('base64'),
            sha256: sealed.sha256,
          },
          { killAtBoundary: true },
        );
        ok(child.boundary);
        equal(child.signal, 'SIGKILL');
        const journal = await CiphertextJournal.open(dir);
        await rejects(() => journal.get(sealed.sha256), codeIs('NOT_FOUND'));
        const names = await journal.list();
        equal(names.includes(sealed.sha256), false);
        const retry = await journal.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 });
        equal(retry.status, 'local-durable');
      });
    } finally {
      vault.lock();
    }
  });

  test('child kill after link before directory fsync leaves exact bytes for retry', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir }) => {
        const sealed = sealWith(vault);
        const child = await runChild(
          {
            action: 'put-fault',
            fault: 'kill-after-link-before-dir-fsync',
            journalDir: dir,
            wireB64: Buffer.from(sealed.wire).toString('base64'),
            sha256: sealed.sha256,
          },
          { killAtBoundary: true },
        );
        ok(child.boundary);
        equal(child.signal, 'SIGKILL');
        const journal = await CiphertextJournal.open(dir);
        const retry = await journal.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 });
        equal(retry.status, 'local-durable');
        const got = await journal.get(sealed.sha256);
        deepEqual(Buffer.from(got), Buffer.from(sealed.wire));
        vault.openSnapshot(got, expectedBinding());
      });
    } finally {
      vault.lock();
    }
  });

  test('zero-progress write is an IO error without acknowledgement', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir }) => {
        const sealed = sealWith(vault);
        const child = await runChild({
          action: 'put-fault',
          fault: 'short-write-zero',
          journalDir: dir,
          wireB64: Buffer.from(sealed.wire).toString('base64'),
          sha256: sealed.sha256,
        });
        equal(child.code, 1);
        const receipt = parseReceipt(child.stdout);
        equal(receipt.ok, false);
        equal(receipt.code, 'IO');
        const journal = await CiphertextJournal.open(dir);
        await rejects(() => journal.get(sealed.sha256), codeIs('NOT_FOUND'));
      });
    } finally {
      vault.lock();
    }
  });

  test('short-write-once still completes exact bytes', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir }) => {
        const sealed = sealWith(vault);
        const child = await runChild({
          action: 'put-fault',
          fault: 'short-write-once',
          journalDir: dir,
          wireB64: Buffer.from(sealed.wire).toString('base64'),
          sha256: sealed.sha256,
        });
        equal(child.code, 0);
        const receipt = parseReceipt(child.stdout);
        equal(receipt.ok, true);
        equal(receipt.status, 'local-durable');
        equal(receipt.sha256, sealed.sha256);
        equal(receipt.byteLength, sealed.wire.byteLength);
        const journal = await CiphertextJournal.open(dir);
        const got = await journal.get(sealed.sha256);
        deepEqual(Buffer.from(got), Buffer.from(sealed.wire));
      });
    } finally {
      vault.lock();
    }
  });

  test('EIO write is an IO error without acknowledgement', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir }) => {
        const sealed = sealWith(vault);
        const child = await runChild({
          action: 'put-fault',
          fault: 'eio-write',
          journalDir: dir,
          wireB64: Buffer.from(sealed.wire).toString('base64'),
          sha256: sealed.sha256,
        });
        equal(child.code, 1);
        const receipt = parseReceipt(child.stdout);
        equal(receipt.ok, false);
        equal(receipt.code, 'IO');
        assertNoLeak(receipt, dir);
        const journal = await CiphertextJournal.open(dir);
        await rejects(() => journal.get(sealed.sha256), codeIs('NOT_FOUND'));
      });
    } finally {
      vault.lock();
    }
  });

  test('EIO directory fsync after link does not acknowledge and identical retry succeeds', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir }) => {
        const sealed = sealWith(vault);
        const child = await runChild({
          action: 'put-fault',
          fault: 'eio-dir-fsync',
          journalDir: dir,
          wireB64: Buffer.from(sealed.wire).toString('base64'),
          sha256: sealed.sha256,
        });
        equal(child.code, 1);
        const receipt = parseReceipt(child.stdout);
        equal(receipt.ok, false);
        equal(receipt.code, 'IO');
        assertNoLeak(receipt, dir);
        const journal = await CiphertextJournal.open(dir);
        const retry = await journal.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 });
        equal(retry.status, 'local-durable');
        const got = await journal.get(sealed.sha256);
        deepEqual(Buffer.from(got), Buffer.from(sealed.wire));
        vault.openSnapshot(got, expectedBinding());
      });
    } finally {
      vault.lock();
    }
  });

  test('EEXIST loser still performs durability barriers', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir, journal }) => {
        const sealed = sealWith(vault);
        const stored = await journal.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 });
        equal(stored.status, 'local-durable');
        const loser = await runChild({
          action: 'put-fault',
          fault: 'eio-dir-fsync',
          journalDir: dir,
          wireB64: Buffer.from(sealed.wire).toString('base64'),
          sha256: sealed.sha256,
        });
        equal(loser.code, 1);
        const receipt = parseReceipt(loser.stdout);
        equal(receipt.ok, false);
        equal(receipt.code, 'IO');
        const got = await journal.get(sealed.sha256);
        deepEqual(Buffer.from(got), Buffer.from(sealed.wire));
        const retry = await journal.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 });
        equal(retry.status, 'local-durable');
      });
    } finally {
      vault.lock();
    }
  });

  test('cross-process loser recovers a target linked before directory fsync', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir }) => {
        const sealed = sealWith(vault);
        const killed = await runChild(
          {
            action: 'put-fault',
            fault: 'kill-after-link-before-dir-fsync',
            journalDir: dir,
            wireB64: Buffer.from(sealed.wire).toString('base64'),
            sha256: sealed.sha256,
          },
          { killAtBoundary: true },
        );
        ok(killed.boundary);
        equal(killed.signal, 'SIGKILL');
        const loser = await runChild({
          action: 'put-fault',
          fault: 'eio-dir-fsync',
          journalDir: dir,
          wireB64: Buffer.from(sealed.wire).toString('base64'),
          sha256: sealed.sha256,
        });
        equal(loser.code, 1);
        equal(parseReceipt(loser.stdout).code, 'IO');
        const journal = await CiphertextJournal.open(dir);
        const retry = await journal.put({ wire: Uint8Array.from(sealed.wire), sha256: sealed.sha256 });
        equal(retry.status, 'local-durable');
        const got = await journal.get(sealed.sha256);
        deepEqual(Buffer.from(got), Buffer.from(sealed.wire));
        const opened = vault.openSnapshot(got, expectedBinding());
        equal(opened.content.marker, SECRET_MARKER);
      });
    } finally {
      vault.lock();
    }
  });

  test('on-disk journal names and bytes stay opaque ciphertext', async () => {
    const vault = unlock();
    try {
      await withJournal(async ({ dir, journal, root }) => {
        const sealed = sealWith(vault);
        const stored = await journal.put({ wire: sealed.wire, sha256: sealed.sha256 });
        await assertOpaqueStore(dir, stored.sha256);
        const names = await journalEntries(dir);
        equal(names.length, 1);
        equal(names[0].name, committedName(stored.sha256));
        const onDisk = readFileSync(join(dir, names[0].name));
        equal(sha256Hex(onDisk), stored.sha256);
        equal(onDisk.includes(utf8(SECRET_MARKER)), false);
        equal(onDisk.includes(utf8(ACCOUNT_MARKER)), false);
        equal(onDisk.includes(utf8(ROOT_HEX)), false);
        equal(onDisk.includes(utf8('wpp-vector-fixture')), false);
        equal(existsSync(join(root, committedName(stored.sha256))), false);
      });
    } finally {
      vault.lock();
    }
  });
});
