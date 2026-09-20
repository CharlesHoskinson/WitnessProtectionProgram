import { equal, match, ok, rejects } from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { UnlockedVault } from '../dist/kernel/index.js';
import { LIMIT_PACKAGE_BYTES } from '../dist/kernel/json.js';
import {
  DRIVE_ABOUT_URL,
  DRIVE_FILES_URL,
  DRIVE_LIST_FIELDS,
  DRIVE_LIST_JSON_MAX_BYTES,
  DRIVE_LIST_MAX_ITEMS,
  DRIVE_LIST_MAX_PAGE_TOKEN_CHARS,
  DRIVE_LIST_MAX_PAGES,
  DRIVE_LIST_PAGE_SIZE,
  DRIVE_LIST_QUERY,
  GoogleError,
  createGoogleDriveAdapter,
  createGoogleDriveAdapterFromAuthClient,
  getOwnedCiphertext,
  listCiphertextCandidates,
} from '../dist/google/index.js';

const TOKEN_SENTINEL = 'ya29.TOKEN_SENTINEL_DO_NOT_LEAK';
const PERMISSION_ID = 'permId-opaque-stable-001';
const OTHER_PERMISSION_ID = 'permId-opaque-stable-002';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

const vector = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/wpp-v1-vectors.json', import.meta.url)), 'utf8'),
);

const utf8 = (text) => Buffer.from(text, 'utf8');
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

function assertGoogleCode(code) {
  return (err) => {
    ok(err instanceof GoogleError, `expected GoogleError, got ${err?.name}: ${err?.message}`);
    equal(err.code, code);
    equal(err.message, code);
    const text = inspect(err, { depth: 8, showHidden: true });
    equal(text.includes(TOKEN_SENTINEL), false);
    return true;
  };
}

function vectorCodec() {
  return { id: 'wpp.synthetic-vector', validate() {} };
}

function vectorRoot() {
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

function expectedSnapshot() {
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

function sealSyntheticBlob() {
  const vault = UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot())), [vectorCodec()]);
  try {
    return vault.sealSnapshot({
      scopeId: vector.inputs.header.scopeId,
      recordId: vector.inputs.header.recordId,
      payloadUtf8: utf8(JSON.stringify(vector.inputs.payload)),
    });
  } finally {
    vault.lock();
  }
}

function jsonBody(value) {
  return utf8(JSON.stringify(value));
}

function wppName(seed) {
  return `${sha256Hex(utf8(String(seed)))}.wpp`;
}

function fileRecord(seed, size = 16) {
  return {
    id: `file_${String(seed).replace(/[^A-Za-z0-9_-]/g, '_')}`,
    name: wppName(seed),
    size: String(size),
  };
}

function assertListUrl(url) {
  const parsed = new URL(String(url));
  equal(parsed.origin + parsed.pathname, FILES_URL);
  equal(parsed.searchParams.get('q'), DRIVE_LIST_QUERY);
  equal(parsed.searchParams.get('fields'), DRIVE_LIST_FIELDS);
  equal(parsed.searchParams.get('pageSize'), String(DRIVE_LIST_PAGE_SIZE));
  equal(parsed.searchParams.has('alt'), false);
}

function assertMediaUrl(url, fileId) {
  const parsed = new URL(String(url));
  equal(parsed.origin + parsed.pathname, `${FILES_URL}/${encodeURIComponent(fileId)}`);
  equal(parsed.searchParams.get('alt'), 'media');
}

function listingAdapter(handler) {
  const calls = [];
  const request = async (opts) => {
    const method = String(opts.method ?? 'GET').toUpperCase();
    const url = String(opts.url);
    calls.push({ method, url, headers: opts.headers ?? {}, body: opts.body });
    return handler({ method, url, opts, calls });
  };
  const adapter = createGoogleDriveAdapter({ permissionId: PERMISSION_ID, request });
  return { adapter, calls };
}

describe('getOwnedCiphertext', () => {
  test('kernel-sealed synthetic bytes round-trip through owned readback and openSnapshot', async () => {
    const sealed = sealSyntheticBlob();
    const fileId = 'file-owned-read';
    let posts = 0;
    const { adapter, calls } = listingAdapter(async ({ method, url }) => {
      if (method !== 'GET') {
        posts += 1;
        throw new Error(`unexpected ${method} ${url}`);
      }
      assertMediaUrl(url, fileId);
      return {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(sealed.wire.byteLength),
        },
        body: Buffer.from(sealed.wire),
      };
    });
    const receipt = await getOwnedCiphertext(adapter, {
      permissionId: PERMISSION_ID,
      fileId,
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    });
    equal(receipt.fileId, fileId);
    equal(receipt.sha256, sealed.sha256);
    equal(receipt.byteCount, sealed.wire.byteLength);
    ok(receipt.ownedReadback instanceof Uint8Array);
    equal(receipt.ownedReadback.byteLength, sealed.wire.byteLength);
    equal(receipt.ownedReadback.buffer === sealed.wire.buffer, false);
    equal(JSON.stringify(receipt).includes('ownedReadback'), false);
    equal('remoteReadbackVerified' in receipt, false);
    equal(posts, 0);
    equal(calls.length, 1);
    equal(calls[0].method, 'GET');
    const vault = UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot())), [vectorCodec()]);
    try {
      const opened = vault.openSnapshot(receipt.ownedReadback, expectedSnapshot());
      equal(opened.content?.message, vector.inputs.payload.content.message);
      equal(opened.packageSha256, sealed.sha256);
    } finally {
      vault.lock();
    }
  });

  test('copies and validates inputs before any network call', async () => {
    let called = 0;
    const adapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => {
        called += 1;
        throw new Error('network');
      },
    });
    const sealed = sealSyntheticBlob();
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: OTHER_PERMISSION_ID,
        fileId: 'file-ok',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    await rejects(
      getOwnedCiphertext({ permissionId: PERMISSION_ID }, {
        permissionId: PERMISSION_ID,
        fileId: 'file-ok',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file/id',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-ok',
        sha256: sealed.sha256.toUpperCase(),
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-ok',
        sha256: sealed.sha256,
        byteCount: 0,
      }),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-ok',
        sha256: sealed.sha256,
        byteCount: LIMIT_PACKAGE_BYTES + 1,
      }),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-ok',
        sha256: sealed.sha256,
        byteCount: 1.5,
      }),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    equal(called, 0);
  });

  test('caller mutation during await does not change the bound GET', async () => {
    const sealed = sealSyntheticBlob();
    const expected = {
      permissionId: PERMISSION_ID,
      fileId: 'file-orig',
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    };
    const { adapter, calls } = listingAdapter(async ({ url }) => {
      expected.fileId = 'file-mutated';
      expected.permissionId = OTHER_PERMISSION_ID;
      expected.sha256 = '0'.repeat(64);
      expected.byteCount = 1;
      equal(Reflect.set(adapter, 'permissionId', OTHER_PERMISSION_ID), false);
      assertMediaUrl(url, 'file-orig');
      return {
        status: 200,
        headers: { 'content-length': String(sealed.wire.byteLength) },
        body: Buffer.from(sealed.wire),
      };
    });
    const receipt = await getOwnedCiphertext(adapter, expected);
    equal(receipt.fileId, 'file-orig');
    equal(receipt.sha256, sealed.sha256);
    equal(adapter.permissionId, PERMISSION_ID);
    equal(calls.length, 1);
    match(calls[0].url, /file-orig/);
    equal(calls[0].url.includes('file-mutated'), false);
  });

  test('public permissionId assignment cannot rebind account identity', async () => {
    const sealed = sealSyntheticBlob();
    let sawOther = false;
    const { adapter } = listingAdapter(async ({ url }) => {
      if (String(url).includes('file-other')) {
        sawOther = true;
      }
      assertMediaUrl(url, 'file-orig');
      return {
        status: 200,
        headers: { 'content-length': String(sealed.wire.byteLength) },
        body: Buffer.from(sealed.wire),
      };
    });
    equal(Reflect.set(adapter, 'permissionId', OTHER_PERMISSION_ID), false);
    equal(
      Reflect.defineProperty(adapter, 'permissionId', {
        value: OTHER_PERMISSION_ID,
        writable: true,
        configurable: true,
      }),
      false,
    );
    equal(adapter.permissionId, PERMISSION_ID);
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: OTHER_PERMISSION_ID,
        fileId: 'file-other',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    const receipt = await getOwnedCiphertext(adapter, {
      permissionId: PERMISSION_ID,
      fileId: 'file-orig',
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    });
    equal(receipt.fileId, 'file-orig');
    equal(sawOther, false);
  });

  test('locator getters and hostile transport errors map to fresh static codes', async () => {
    const sealed = sealSyntheticBlob();
    const expected = {
      fileId: 'file-hostile',
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    };
    Object.defineProperty(expected, 'permissionId', {
      get() {
        throw new Error(TOKEN_SENTINEL);
      },
    });
    const { adapter } = listingAdapter(async () => {
      throw new Error('network must not run');
    });
    await rejects(getOwnedCiphertext(adapter, expected), (err) => {
      assertGoogleCode('GOOGLE_DRIVE_INPUT')(err);
      equal(inspect(err, { depth: 8, showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });

    const proxy = new Proxy(
      {},
      {
        get() {
          throw new Error(TOKEN_SENTINEL);
        },
      },
    );
    await rejects(getOwnedCiphertext(adapter, proxy), assertGoogleCode('GOOGLE_DRIVE_INPUT'));

    const hostile = new GoogleError('GOOGLE_DRIVE_READBACK');
    Object.defineProperty(hostile, 'message', {
      get() {
        return TOKEN_SENTINEL;
      },
    });
    Object.defineProperty(hostile, 'code', {
      get() {
        return TOKEN_SENTINEL;
      },
    });
    const hostileAdapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => {
        throw hostile;
      },
    });
    await rejects(
      getOwnedCiphertext(hostileAdapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-hostile',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      (err) => {
        assertGoogleCode('GOOGLE_DRIVE_READBACK')(err);
        equal(err === hostile, false);
        equal(inspect(err, { depth: 8, showHidden: true }).includes(TOKEN_SENTINEL), false);
        return true;
      },
    );

    const throwingResponse = new Error('transport');
    Object.defineProperty(throwingResponse, 'response', {
      get() {
        throw new Error(TOKEN_SENTINEL);
      },
    });
    const responseAdapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => {
        throw throwingResponse;
      },
    });
    await rejects(
      getOwnedCiphertext(responseAdapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-hostile',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      (err) => {
        assertGoogleCode('GOOGLE_DRIVE_READBACK')(err);
        equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
        return true;
      },
    );

    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-hostile',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_DRIVE_READBACK'),
    );

    const badStatus = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: Number.NaN,
        headers: {},
        body: Buffer.from(sealed.wire),
      }),
    });
    await rejects(
      getOwnedCiphertext(badStatus, {
        permissionId: PERMISSION_ID,
        fileId: 'file-hostile',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_DRIVE_READBACK'),
    );

    const badBody = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: { 'content-length': String(sealed.wire.byteLength) },
        body: sealed.wire.toString('base64'),
      }),
    });
    await rejects(
      getOwnedCiphertext(badBody, {
        permissionId: PERMISSION_ID,
        fileId: 'file-hostile',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_DRIVE_READBACK'),
    );
  });

  test('injected request identity is copied at construction', async () => {
    const sealed = sealSyntheticBlob();
    let used = 'none';
    const options = {
      permissionId: PERMISSION_ID,
      request: async ({ url }) => {
        used = 'A';
        assertMediaUrl(url, 'file-a');
        return {
          status: 200,
          headers: { 'content-length': String(sealed.wire.byteLength) },
          body: Buffer.from(sealed.wire),
        };
      },
    };
    const adapter = createGoogleDriveAdapter(options);
    options.request = async () => {
      used = 'B';
      throw new Error('unchecked B');
    };
    options.permissionId = OTHER_PERMISSION_ID;
    const receipt = await getOwnedCiphertext(adapter, {
      permissionId: PERMISSION_ID,
      fileId: 'file-a',
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    });
    equal(receipt.fileId, 'file-a');
    equal(used, 'A');
    equal(adapter.permissionId, PERMISSION_ID);
  });

  test('corrupt truncated swapped overlong and content-length mismatch are readback errors', async () => {
    const sealed = sealSyntheticBlob();
    const other = Buffer.from(sealed.wire);
    other[0] ^= 0xff;
    const expected = {
      permissionId: PERMISSION_ID,
      fileId: 'file-bytes',
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    };

    const corrupt = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: { 'content-length': String(sealed.wire.byteLength) },
        body: other,
      }),
    });
    await rejects(getOwnedCiphertext(corrupt, expected), assertGoogleCode('GOOGLE_DRIVE_READBACK'));

    const truncated = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: { 'content-length': String(sealed.wire.byteLength - 1) },
        body: Buffer.from(sealed.wire.subarray(0, sealed.wire.byteLength - 1)),
      }),
    });
    await rejects(getOwnedCiphertext(truncated, expected), assertGoogleCode('GOOGLE_DRIVE_READBACK'));

    const swapped = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: { 'content-length': String(other.byteLength) },
        body: other,
      }),
    });
    await rejects(getOwnedCiphertext(swapped, expected), assertGoogleCode('GOOGLE_DRIVE_READBACK'));

    const overlong = Buffer.concat([Buffer.from(sealed.wire), Buffer.from([0x00])]);
    const longAdapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: { 'content-length': String(overlong.byteLength) },
        body: overlong,
      }),
    });
    await rejects(getOwnedCiphertext(longAdapter, expected), assertGoogleCode('GOOGLE_DRIVE_READBACK'));

    const lengthMismatch = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: { 'content-length': String(sealed.wire.byteLength + 8) },
        body: Buffer.from(sealed.wire),
      }),
    });
    await rejects(getOwnedCiphertext(lengthMismatch, expected), assertGoogleCode('GOOGLE_DRIVE_READBACK'));
  });

  test('redirect untrusted URL missing object and late read error never create', async () => {
    const sealed = sealSyntheticBlob();
    const expected = {
      permissionId: PERMISSION_ID,
      fileId: 'file-err',
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    };
    let posts = 0;
    const guard = async (impl) => {
      const adapter = createGoogleDriveAdapter({
        permissionId: PERMISSION_ID,
        request: async (opts) => {
          if (String(opts.method ?? 'GET').toUpperCase() !== 'GET') {
            posts += 1;
          }
          if (String(opts.url).startsWith(UPLOAD_URL)) {
            posts += 1;
          }
          return impl(opts);
        },
      });
      return adapter;
    };

    const redirect = await guard(async () => ({
      status: 302,
      headers: { location: 'https://evil.example/steal' },
      body: utf8(''),
    }));
    await rejects(getOwnedCiphertext(redirect, expected), assertGoogleCode('GOOGLE_DRIVE_REDIRECT'));

    const missing = await guard(async () => ({
      status: 404,
      headers: {},
      body: utf8(JSON.stringify({ error: { message: TOKEN_SENTINEL } })),
    }));
    await rejects(getOwnedCiphertext(missing, expected), (err) => {
      assertGoogleCode('GOOGLE_DRIVE_READBACK')(err);
      equal(inspect(err, { depth: 8 }).includes(TOKEN_SENTINEL), false);
      return true;
    });

    const late = await guard(async () => {
      const err = new Error(`socket hang up ${TOKEN_SENTINEL}`);
      err.code = 'ECONNRESET';
      throw err;
    });
    await rejects(getOwnedCiphertext(late, expected), (err) => {
      assertGoogleCode('GOOGLE_DRIVE_READBACK')(err);
      equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });
    equal(posts, 0);
  });
});

describe('listCiphertextCandidates', () => {
  test('success across multiple pages with fixed query fields and pageSize', async () => {
    const first = fileRecord('alpha', 32);
    const second = fileRecord('beta', 48);
    const unrelated = { id: 'readme1', name: 'notes.txt', size: '4' };
    const third = fileRecord('gamma', 64);
    const { adapter, calls } = listingAdapter(async ({ method, url }) => {
      equal(method, 'GET');
      assertListUrl(url);
      const parsed = new URL(url);
      if (!parsed.searchParams.has('pageToken')) {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: jsonBody({
            files: [first, unrelated, second],
            nextPageToken: 'page-two',
          }),
        };
      }
      equal(parsed.searchParams.get('pageToken'), 'page-two');
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: jsonBody({ files: [third] }),
      };
    });
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, true);
    equal(listed.reason, undefined);
    equal(listed.candidates.length, 3);
    equal(listed.candidates[0].fileId, first.id);
    equal(listed.candidates[0].name, first.name);
    equal(listed.candidates[0].byteCount, 32);
    equal(listed.candidates[1].fileId, second.id);
    equal(listed.candidates[2].fileId, third.id);
    equal(calls.length, 2);
    equal(calls.some((call) => call.method !== 'GET'), false);
    equal(calls.some((call) => call.url.startsWith(UPLOAD_URL)), false);
    equal(JSON.stringify(listed).includes('page-two'), false);
  });

  test('duplicate fileIds with agreeing metadata collapse, conflicting metadata is incomplete', async () => {
    const one = fileRecord('dup', 20);
    const agree = { ...one };
    const { adapter: agreeAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: [one, agree] }),
    }));
    const agreed = await listCiphertextCandidates(agreeAdapter);
    equal(agreed.complete, true);
    equal(agreed.candidates.length, 1);
    equal(agreed.candidates[0].fileId, one.id);

    const conflict = { ...one, size: '21' };
    const { adapter: conflictAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: [one, conflict] }),
    }));
    const conflicting = await listCiphertextCandidates(conflictAdapter);
    equal(conflicting.complete, false);
    equal(conflicting.reason, 'GOOGLE_DRIVE_DUPLICATE_CONFLICT');
    equal(conflicting.candidates.length, 1);
    equal(conflicting.candidates[0].byteCount, 20);
  });

  test('repeated nextPageToken is a cycle and does not follow an arbitrary URL', async () => {
    const first = fileRecord('cycle', 12);
    const { adapter: cycleAdapter } = listingAdapter(async ({ url }) => {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('pageToken')) {
        return {
          status: 200,
          headers: {},
          body: jsonBody({ files: [first], nextPageToken: 'loop' }),
        };
      }
      return {
        status: 200,
        headers: {},
        body: jsonBody({ files: [fileRecord('cycle-2', 12)], nextPageToken: 'loop' }),
      };
    });
    const cycled = await listCiphertextCandidates(cycleAdapter);
    equal(cycled.complete, false);
    equal(cycled.reason, 'GOOGLE_DRIVE_PAGE_TOKEN_CYCLE');
    equal(cycled.candidates.length, 2);

    let second = 0;
    const { adapter: urlAdapter } = listingAdapter(async ({ url }) => {
      const parsed = new URL(url);
      if (parsed.searchParams.has('pageToken')) {
        second += 1;
      }
      return {
        status: 200,
        headers: {},
        body: jsonBody({
          files: [fileRecord('urlish', 8)],
          nextPageToken: 'https://evil.example/next',
        }),
      };
    });
    const untrusted = await listCiphertextCandidates(urlAdapter);
    equal(untrusted.complete, false);
    equal(untrusted.reason, 'GOOGLE_DRIVE_PAGE_TOKEN');
    equal(untrusted.candidates.length, 1);
    equal(second, 0);
  });

  test('incompleteSearch is never reported complete', async () => {
    const file = fileRecord('partial', 24);
    const { adapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: [file], incompleteSearch: true }),
    }));
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.reason, 'GOOGLE_DRIVE_INCOMPLETE_SEARCH');
    equal(listed.candidates.length, 1);
    equal(listed.candidates[0].fileId, file.id);

    const { adapter: invalidAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: [file], incompleteSearch: 'true' }),
    }));
    const invalid = await listCiphertextCandidates(invalidAdapter);
    equal(invalid.complete, false);
    equal(invalid.reason, 'GOOGLE_DRIVE_PAGE_FAILURE');
    equal(invalid.candidates.length, 1);
  });

  test('page ceiling preserves collected candidates', async () => {
    const { adapter, calls } = listingAdapter(async ({ url }) => {
      const parsed = new URL(url);
      const token = parsed.searchParams.get('pageToken');
      const index = token === null ? 1 : Number(token);
      return {
        status: 200,
        headers: {},
        body: jsonBody({
          files: [fileRecord(`page-${index}`, 10)],
          nextPageToken: String(index + 1),
        }),
      };
    });
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.reason, 'GOOGLE_DRIVE_PAGE_CEILING');
    equal(listed.candidates.length, DRIVE_LIST_MAX_PAGES);
    equal(calls.length, DRIVE_LIST_MAX_PAGES);
  });

  test('item ceiling preserves already collected candidates', async () => {
    const pageFiles = (start, count) => {
      const files = [];
      for (let i = 0; i < count; i += 1) {
        files.push(fileRecord(`item-${start + i}`, 16));
      }
      return files;
    };
    let pages = 0;
    const { adapter } = listingAdapter(async () => {
      pages += 1;
      return {
        status: 200,
        headers: {},
        body: jsonBody({
          files: pageFiles((pages - 1) * DRIVE_LIST_PAGE_SIZE, DRIVE_LIST_PAGE_SIZE),
          nextPageToken: `page-${pages + 1}`,
        }),
      };
    });
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.reason, 'GOOGLE_DRIVE_ITEM_CEILING');
    equal(listed.candidates.length, DRIVE_LIST_MAX_ITEMS);
    equal(pages, DRIVE_LIST_MAX_PAGES);
  });

  test('malformed JSON size and matching filename are incomplete', async () => {
    const { adapter: badJson } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: utf8('{not-json'),
    }));
    const jsonListed = await listCiphertextCandidates(badJson);
    equal(jsonListed.complete, false);
    equal(jsonListed.reason, 'GOOGLE_DRIVE_PAGE_FAILURE');
    equal(jsonListed.candidates.length, 0);

    const { adapter: badSize } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({
        files: [{ id: 'file_ok', name: wppName('size'), size: '12.5' }],
      }),
    }));
    const sizeListed = await listCiphertextCandidates(badSize);
    equal(sizeListed.complete, false);
    equal(sizeListed.reason, 'GOOGLE_DRIVE_MALFORMED_CANDIDATE');

    const { adapter: badId } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({
        files: [{ id: 'not a/id', name: wppName('id'), size: '12' }],
      }),
    }));
    const idListed = await listCiphertextCandidates(badId);
    equal(idListed.complete, false);
    equal(idListed.reason, 'GOOGLE_DRIVE_MALFORMED_CANDIDATE');

    const { adapter: upper } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({
        files: [{ id: 'file_upper', name: `${'A'.repeat(64)}.wpp`, size: '12' }],
      }),
    }));
    const upperListed = await listCiphertextCandidates(upper);
    equal(upperListed.complete, false);
    equal(upperListed.reason, 'GOOGLE_DRIVE_MALFORMED_CANDIDATE');
    equal(upperListed.candidates.length, 0);
  });

  test('missing and non-string candidate names are malformed page data', async () => {
    const { adapter: missingAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: [{ id: 'x', size: '1' }] }),
    }));
    const missing = await listCiphertextCandidates(missingAdapter);
    equal(missing.complete, false);
    equal(missing.reason, 'GOOGLE_DRIVE_MALFORMED_CANDIDATE');
    equal(missing.candidates.length, 0);

    const { adapter: numberAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: [{ id: 'x', name: 42, size: '1' }] }),
    }));
    const numbered = await listCiphertextCandidates(numberAdapter);
    equal(numbered.complete, false);
    equal(numbered.reason, 'GOOGLE_DRIVE_MALFORMED_CANDIDATE');
    equal(numbered.candidates.length, 0);

    const { adapter: nullAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: [{ id: 'x', name: null, size: '1' }] }),
    }));
    const nulled = await listCiphertextCandidates(nullAdapter);
    equal(nulled.complete, false);
    equal(nulled.reason, 'GOOGLE_DRIVE_MALFORMED_CANDIDATE');
    equal(nulled.candidates.length, 0);

    const kept = fileRecord('keep-unrelated', 16);
    const { adapter: unrelatedAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({
        files: [kept, { id: 'readme1', name: 'notes.txt', size: '4' }],
      }),
    }));
    const unrelated = await listCiphertextCandidates(unrelatedAdapter);
    equal(unrelated.complete, true);
    equal(unrelated.candidates.length, 1);
    equal(unrelated.candidates[0].fileId, kept.id);
  });

  test('overlong JSON stream is incomplete and keeps prior candidates', async () => {
    const first = fileRecord('kept', 18);
    let page = 0;
    const { adapter } = listingAdapter(async () => {
      page += 1;
      if (page === 1) {
        return {
          status: 200,
          headers: {},
          body: jsonBody({ files: [first], nextPageToken: 'big' }),
        };
      }
      return {
        status: 200,
        headers: { 'content-length': String(DRIVE_LIST_JSON_MAX_BYTES + 1) },
        body: Buffer.alloc(DRIVE_LIST_JSON_MAX_BYTES + 1, 0x7b),
      };
    });
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.reason, 'GOOGLE_DRIVE_JSON_BOUND');
    equal(listed.candidates.length, 1);
    equal(listed.candidates[0].fileId, first.id);
  });

  test('page failure and missing next-page completion preserve collected candidates', async () => {
    const first = fileRecord('saved', 22);
    const { adapter: failAdapter } = listingAdapter(async ({ url }) => {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('pageToken')) {
        return {
          status: 200,
          headers: {},
          body: jsonBody({ files: [first], nextPageToken: 'next' }),
        };
      }
      return {
        status: 500,
        headers: {},
        body: utf8(JSON.stringify({ error: { message: TOKEN_SENTINEL } })),
      };
    });
    const failed = await listCiphertextCandidates(failAdapter);
    equal(failed.complete, false);
    equal(failed.reason, 'GOOGLE_DRIVE_PAGE_FAILURE');
    equal(failed.candidates.length, 1);
    equal(inspect(failed).includes(TOKEN_SENTINEL), false);

    const { adapter: throwAdapter } = listingAdapter(async ({ url }) => {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('pageToken')) {
        return {
          status: 200,
          headers: {},
          body: jsonBody({ files: [first], nextPageToken: 'next' }),
        };
      }
      throw new Error(`late list ${TOKEN_SENTINEL}`);
    });
    const thrown = await listCiphertextCandidates(throwAdapter);
    equal(thrown.complete, false);
    equal(thrown.reason, 'GOOGLE_DRIVE_PAGE_FAILURE');
    equal(thrown.candidates.length, 1);
    equal(inspect(thrown).includes(TOKEN_SENTINEL), false);
  });

  test('overlong page token is incomplete and does not follow it', async () => {
    let followed = 0;
    const { adapter } = listingAdapter(async ({ url }) => {
      const parsed = new URL(url);
      if (parsed.searchParams.has('pageToken')) {
        followed += 1;
      }
      return {
        status: 200,
        headers: {},
        body: jsonBody({
          files: [fileRecord('tok', 9)],
          nextPageToken: 't'.repeat(DRIVE_LIST_MAX_PAGE_TOKEN_CHARS + 1),
        }),
      };
    });
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.reason, 'GOOGLE_DRIVE_PAGE_TOKEN');
    equal(listed.candidates.length, 1);
    equal(followed, 0);
  });

  test('wrong session rejects before listing and redirect never creates', async () => {
    let called = 0;
    await rejects(
      listCiphertextCandidates({ permissionId: PERMISSION_ID }),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    const redirect = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => {
        called += 1;
        return {
          status: 302,
          headers: { location: 'https://evil.example/list' },
          body: utf8(''),
        };
      },
    });
    await rejects(listCiphertextCandidates(redirect), assertGoogleCode('GOOGLE_DRIVE_REDIRECT'));
    equal(called, 1);
  });

  test('later-page redirect keeps collected candidates and does not follow', async () => {
    const first = fileRecord('kept-redirect', 20);
    let followed = 0;
    const { adapter } = listingAdapter(async ({ url }) => {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('pageToken')) {
        return {
          status: 200,
          headers: {},
          body: jsonBody({ files: [first], nextPageToken: 'next' }),
        };
      }
      followed += 1;
      return {
        status: 302,
        headers: { location: 'https://evil.example/list-next' },
        body: utf8(''),
      };
    });
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.reason, 'GOOGLE_DRIVE_REDIRECT');
    equal(listed.candidates.length, 1);
    equal(listed.candidates[0].fileId, first.id);
    equal(followed, 1);
    equal(inspect(listed).includes('evil.example'), false);
  });

  test('empty first page plus continuation then 302 is incomplete, not a static redirect throw', async () => {
    let pages = 0;
    const { adapter } = listingAdapter(async ({ url }) => {
      pages += 1;
      const parsed = new URL(url);
      if (!parsed.searchParams.has('pageToken')) {
        return {
          status: 200,
          headers: {},
          body: jsonBody({ files: [], nextPageToken: 'next' }),
        };
      }
      equal(parsed.searchParams.get('pageToken'), 'next');
      return {
        status: 302,
        headers: { location: 'https://evil.example/list-next' },
        body: utf8(''),
      };
    });
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.reason, 'GOOGLE_DRIVE_REDIRECT');
    equal(listed.candidates.length, 0);
    equal(pages, 2);
    equal(inspect(listed).includes('evil.example'), false);
  });

  test('only an absent nextPageToken completes pagination', async () => {
    const first = fileRecord('token-absent', 11);
    const { adapter: absentAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: [first] }),
    }));
    const absent = await listCiphertextCandidates(absentAdapter);
    equal(absent.complete, true);
    equal(absent.reason, undefined);
    equal(absent.candidates.length, 1);

    const malformedTokens = [null, '', 123, false, 0, true, [], {}, { token: 'x' }];
    for (const token of malformedTokens) {
      const { adapter } = listingAdapter(async () => ({
        status: 200,
        headers: {},
        body: jsonBody({ files: [first], nextPageToken: token }),
      }));
      const listed = await listCiphertextCandidates(adapter);
      equal(listed.complete, false, `token=${inspect(token)}`);
      equal(listed.reason, 'GOOGLE_DRIVE_PAGE_TOKEN', `token=${inspect(token)}`);
      equal(listed.candidates.length, 1);
    }
  });

  test('invalid completion fields and oversized pages cannot claim complete', async () => {
    const first = fileRecord('shape', 11);
    const { adapter: tokenAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: [first], nextPageToken: 123 }),
    }));
    const badToken = await listCiphertextCandidates(tokenAdapter);
    equal(badToken.complete, false);
    equal(badToken.reason, 'GOOGLE_DRIVE_PAGE_TOKEN');
    equal(badToken.candidates.length, 1);

    const oversized = [];
    for (let i = 0; i < DRIVE_LIST_PAGE_SIZE + 1; i += 1) {
      oversized.push(fileRecord(`over-${i}`, 8));
    }
    const { adapter: overAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: oversized }),
    }));
    const over = await listCiphertextCandidates(overAdapter);
    equal(over.complete, false);
    equal(over.reason, 'GOOGLE_DRIVE_PAGE_FAILURE');
    equal(over.candidates.length, 0);

    const { adapter: filesAdapter } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: jsonBody({ files: { id: first.id, name: first.name, size: '11' } }),
    }));
    const badFiles = await listCiphertextCandidates(filesAdapter);
    equal(badFiles.complete, false);
    equal(badFiles.reason, 'GOOGLE_DRIVE_PAGE_FAILURE');
    equal(badFiles.complete, false);
  });

  test('auth-client About capture ignores concurrent client replacement', async () => {
    const sealed = sealSyntheticBlob();
    let used = 'none';
    const clientB = {
      async request() {
        used = 'B';
        throw new Error(`unchecked B ${TOKEN_SENTINEL}`);
      },
    };
    const options = {
      permissionId: PERMISSION_ID,
      authClient: {
        async request(opts) {
          const url = String(opts.url ?? '');
          if (url.startsWith(DRIVE_ABOUT_URL)) {
            options.authClient = clientB;
            options.permissionId = OTHER_PERMISSION_ID;
            return { status: 200, data: { user: { permissionId: PERMISSION_ID } } };
          }
          used = 'A';
          equal(url.includes('alt=media'), true);
          return {
            status: 200,
            data: Buffer.from(sealed.wire),
            headers: { 'content-length': String(sealed.wire.byteLength) },
          };
        },
      },
    };
    const adapter = await createGoogleDriveAdapterFromAuthClient(options);
    equal(adapter.permissionId, PERMISSION_ID);
    const receipt = await getOwnedCiphertext(adapter, {
      permissionId: PERMISSION_ID,
      fileId: 'file-captured',
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    });
    equal(receipt.fileId, 'file-captured');
    equal(used, 'A');
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: OTHER_PERMISSION_ID,
        fileId: 'file-captured',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );

    const throwingOptions = {};
    Object.defineProperty(throwingOptions, 'permissionId', {
      get() {
        throw new Error(TOKEN_SENTINEL);
      },
    });
    Object.defineProperty(throwingOptions, 'authClient', {
      get() {
        return options.authClient;
      },
    });
    await rejects(createGoogleDriveAdapterFromAuthClient(throwingOptions), (err) => {
      assertGoogleCode('GOOGLE_BIND_IDENTITY')(err);
      equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });
  });

  test('injected list and get fixtures are not live Google evidence', () => {
    equal(DRIVE_FILES_URL, FILES_URL);
    equal(DRIVE_LIST_PAGE_SIZE, 100);
    equal(DRIVE_LIST_MAX_PAGES, 100);
    equal(DRIVE_LIST_MAX_ITEMS, 10_000);
    equal(DRIVE_LIST_JSON_MAX_BYTES, 1024 * 1024);
    match(DRIVE_LIST_QUERY, /trashed = false/);
    match(DRIVE_LIST_QUERY, /\.wpp/);
    match(DRIVE_LIST_FIELDS, /nextPageToken/);
    match(DRIVE_LIST_FIELDS, /incompleteSearch/);
    match(DRIVE_LIST_FIELDS, /files\(id,name,size\)/);
  });
});
