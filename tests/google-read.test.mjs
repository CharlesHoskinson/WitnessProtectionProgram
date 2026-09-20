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
  GoogleDriveSession,
  GoogleError,
  createGoogleDriveAdapter,
  createGoogleDriveAdapterFromAuthClient,
  getOwnedCiphertext,
  listCiphertextCandidates,
  queryBoundPermissionId,
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

function ownedArrayBuffer(bytes) {
  const copy = Buffer.from(bytes);
  return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
}

function authClientAdapter(request) {
  const calls = [];
  const adapter = new GoogleDriveSession(PERMISSION_ID, {
    authClient: {
      async request(opts) {
        const method = String(opts.method ?? 'GET').toUpperCase();
        const url = String(opts.url);
        calls.push({ method, url, headers: opts.headers ?? {}, body: opts.body });
        return request({ method, url, opts, calls });
      },
    },
  });
  return { adapter, calls };
}

function assertNoWrites(calls) {
  equal(
    calls.some((call) => call.method !== 'GET'),
    false,
  );
  equal(
    calls.some((call) => String(call.url).startsWith(UPLOAD_URL)),
    false,
  );
}

function lyingFourByteBody() {
  class LyingBytes extends Uint8Array {
    get byteLength() {
      return 3;
    }
  }
  return new LyingBytes(Uint8Array.from([9, 8, 7, 6]));
}

function flippingLengthBody(bytes) {
  class FlipBytes extends Uint8Array {
    constructor(source) {
      super(source);
      this._reads = 0;
    }
    get byteLength() {
      this._reads += 1;
      if (this._reads >= 2) {
        throw new Error(TOKEN_SENTINEL);
      }
      return super.byteLength;
    }
  }
  return new FlipBytes(bytes);
}

function hostileListData(field, base) {
  const data = { ...base };
  let reads = 0;
  Object.defineProperty(data, field, {
    configurable: true,
    enumerable: true,
    get() {
      reads += 1;
      throw new Error(TOKEN_SENTINEL);
    },
  });
  return { data, getReads: () => reads };
}

function flippingOversizeFiles() {
  let reads = 0;
  const pad = 'a'.repeat(DRIVE_LIST_JSON_MAX_BYTES + 16);
  const data = {};
  Object.defineProperty(data, 'files', {
    configurable: true,
    enumerable: true,
    get() {
      reads += 1;
      if (reads === 1) {
        return [{ id: 'file_flip_oversize', name: wppName('flip-oversize'), size: '8', pad }];
      }
      return [];
    },
  });
  return { data, getReads: () => reads };
}

function nestedFlippingGetter(file) {
  let reads = 0;
  const item = { name: file.name, size: file.size };
  Object.defineProperty(item, 'id', {
    configurable: true,
    enumerable: true,
    get() {
      reads += 1;
      if (reads === 1) {
        return file.id;
      }
      return 'mutated-id';
    },
  });
  return { item, getReads: () => reads };
}

function customToJsonData(base, disguised) {
  const data = { ...base };
  let calls = 0;
  Object.defineProperty(data, 'toJSON', {
    enumerable: false,
    value() {
      calls += 1;
      return disguised;
    },
  });
  return { data, getCalls: () => calls };
}

function throwingListProxy(target) {
  return new Proxy(target, {
    get() {
      throw new Error(TOKEN_SENTINEL);
    },
    getOwnPropertyDescriptor() {
      throw new Error(TOKEN_SENTINEL);
    },
    ownKeys() {
      throw new Error(TOKEN_SENTINEL);
    },
  });
}

function changingDescriptorContinuation(files, token) {
  let descriptorReads = 0;
  const target = { files, nextPageToken: token };
  return {
    data: new Proxy(target, {
      getOwnPropertyDescriptor(_ignored, prop) {
        if (prop === 'nextPageToken') {
          descriptorReads += 1;
          return {
            configurable: true,
            enumerable: descriptorReads === 1,
            writable: true,
            value: token,
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
      ownKeys() {
        return ['files', 'nextPageToken'];
      },
      getPrototypeOf() {
        return Object.prototype;
      },
      has(_ignored, prop) {
        return Object.prototype.hasOwnProperty.call(target, prop);
      },
    }),
    getDescriptorReads: () => descriptorReads,
  };
}

function ownProtoListing(fields, protoValue) {
  const data = Object.create(null);
  for (const key of Object.getOwnPropertyNames(fields)) {
    Object.defineProperty(data, key, {
      value: fields[key],
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  Object.defineProperty(data, '__proto__', {
    value: protoValue,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return data;
}

function jsonUtf8Size(value) {
  return Buffer.byteLength(JSON.stringify(value));
}

function padRepeatsForBudget(unit, targetBytes) {
  const make = (n) => ({ files: [], pad: unit.repeat(n) });
  const empty = jsonUtf8Size(make(0));
  const one = jsonUtf8Size(make(1));
  const per = one - empty;
  ok(per > 0, `unit ${inspect(unit)} must add JSON bytes`);
  let n = Math.floor((targetBytes - empty) / per);
  if (n < 0) {
    n = 0;
  }
  while (jsonUtf8Size(make(n + 1)) <= targetBytes) {
    n += 1;
  }
  while (n > 0 && jsonUtf8Size(make(n)) > targetBytes) {
    n -= 1;
  }
  return n;
}

async function withStringifyProbe(fn) {
  const original = JSON.stringify;
  let largest = 0;
  JSON.stringify = (...args) => {
    const result = original(...args);
    if (typeof result === 'string' && result.length > largest) {
      largest = result.length;
    }
    return result;
  };
  try {
    return { result: await fn(), largest };
  } finally {
    JSON.stringify = original;
  }
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

describe('owned media copies on AuthClient and injected transports', () => {
  function expectedLocator(fileId, bytes, digest) {
    return {
      permissionId: PERMISSION_ID,
      fileId,
      sha256: digest,
      byteCount: bytes.byteLength,
    };
  }

  function assertOwnedReceipt(receipt, fileId, bytes, digest) {
    equal(receipt.fileId, fileId);
    equal(receipt.sha256, digest);
    equal(receipt.byteCount, bytes.byteLength);
    equal(receipt.ownedReadback.byteLength, bytes.byteLength);
    equal(receipt.byteCount, receipt.ownedReadback.byteLength);
    equal(sha256Hex(receipt.ownedReadback), digest);
    equal(Buffer.compare(Buffer.from(receipt.ownedReadback), Buffer.from(bytes)), 0);
    equal(receipt.ownedReadback.constructor, Buffer);
  }

  test('ordinary ArrayBuffer Buffer and Uint8Array media match on both transports', async () => {
    const sealed = sealSyntheticBlob();
    const digest = sealed.sha256;
    const forms = [
      { label: 'uint8', value: new Uint8Array(sealed.wire) },
      { label: 'buffer', value: Buffer.from(sealed.wire) },
      { label: 'arraybuffer', value: ownedArrayBuffer(sealed.wire) },
    ];

    for (const form of forms) {
      const { adapter: injected } = listingAdapter(async () => ({
        status: 200,
        headers: {},
        body: form.label === 'arraybuffer' ? Buffer.from(form.value) : form.value,
      }));
      if (form.label !== 'arraybuffer') {
        const injectedReceipt = await getOwnedCiphertext(
          injected,
          expectedLocator(`file-injected-${form.label}`, sealed.wire, digest),
        );
        assertOwnedReceipt(injectedReceipt, `file-injected-${form.label}`, sealed.wire, digest);
        equal(injectedReceipt.ownedReadback === form.value, false);
      }

      const { adapter: auth } = authClientAdapter(async () => ({
        status: 200,
        headers: {},
        data: form.value,
      }));
      const authReceipt = await getOwnedCiphertext(
        auth,
        expectedLocator(`file-auth-${form.label}`, sealed.wire, digest),
      );
      assertOwnedReceipt(authReceipt, `file-auth-${form.label}`, sealed.wire, digest);
      equal(authReceipt.ownedReadback === form.value, false);
    }

    const { adapter: injectedAb } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: ownedArrayBuffer(sealed.wire),
    }));
    const injectedAbReceipt = await getOwnedCiphertext(
      injectedAb,
      expectedLocator('file-injected-arraybuffer', sealed.wire, digest),
    );
    assertOwnedReceipt(injectedAbReceipt, 'file-injected-arraybuffer', sealed.wire, digest);
  });

  test('subclass that lies about byteLength is rejected on both transports', async () => {
    const lying = lyingFourByteBody();
    equal(lying.byteLength, 3);
    equal(lying.length, 4);
    const digestFour = sha256Hex(Buffer.from([9, 8, 7, 6]));
    const digestThree = sha256Hex(lying);
    const locator = {
      permissionId: PERMISSION_ID,
      fileId: 'file-lie',
      sha256: digestThree,
      byteCount: 3,
    };

    const { adapter: injected } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: lying,
    }));
    await rejects(getOwnedCiphertext(injected, locator), assertGoogleCode('GOOGLE_DRIVE_READBACK'));

    const { adapter: auth } = authClientAdapter(async () => ({
      status: 200,
      headers: {},
      data: lying,
    }));
    await rejects(getOwnedCiphertext(auth, locator), (err) => {
      assertGoogleCode('GOOGLE_DRIVE_READBACK')(err);
      equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });

    const { adapter: authFour } = authClientAdapter(async () => ({
      status: 200,
      headers: {},
      data: lyingFourByteBody(),
    }));
    const honest = await getOwnedCiphertext(authFour, {
      permissionId: PERMISSION_ID,
      fileId: 'file-lie-real',
      sha256: digestFour,
      byteCount: 4,
    });
    assertOwnedReceipt(honest, 'file-lie-real', Buffer.from([9, 8, 7, 6]), digestFour);
  });

  test('second length access cannot leak a raw sentinel on either transport', async () => {
    const sealed = sealSyntheticBlob();
    const locator = expectedLocator('file-flip', sealed.wire, sealed.sha256);

    const { adapter: injected } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: flippingLengthBody(sealed.wire),
    }));
    const injectedReceipt = await getOwnedCiphertext(injected, locator);
    assertOwnedReceipt(injectedReceipt, 'file-flip', sealed.wire, sealed.sha256);

    const { adapter: auth } = authClientAdapter(async () => ({
      status: 200,
      headers: {},
      data: flippingLengthBody(sealed.wire),
    }));
    const authReceipt = await getOwnedCiphertext(auth, locator);
    assertOwnedReceipt(authReceipt, 'file-flip', sealed.wire, sealed.sha256);
    equal(inspect(authReceipt, { showHidden: true }).includes(TOKEN_SENTINEL), false);
  });

  test('detached and revoked proxy media fail closed on both transports', async () => {
    const sealed = sealSyntheticBlob();
    const locator = expectedLocator('file-hostile-media', sealed.wire, sealed.sha256);

    const detachedBytes = new Uint8Array(sealed.wire);
    structuredClone(detachedBytes.buffer, { transfer: [detachedBytes.buffer] });
    const { adapter: injectedDetached } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: detachedBytes,
    }));
    await rejects(getOwnedCiphertext(injectedDetached, locator), assertGoogleCode('GOOGLE_DRIVE_READBACK'));

    const detachedAuth = new Uint8Array(sealed.wire);
    structuredClone(detachedAuth.buffer, { transfer: [detachedAuth.buffer] });
    const { adapter: authDetached } = authClientAdapter(async () => ({
      status: 200,
      headers: {},
      data: detachedAuth,
    }));
    await rejects(getOwnedCiphertext(authDetached, locator), assertGoogleCode('GOOGLE_DRIVE_READBACK'));

    const detachedBuffer = ownedArrayBuffer(sealed.wire);
    structuredClone(detachedBuffer, { transfer: [detachedBuffer] });
    const { adapter: authDetachedAb } = authClientAdapter(async () => ({
      status: 200,
      headers: {},
      data: detachedBuffer,
    }));
    await rejects(getOwnedCiphertext(authDetachedAb, locator), assertGoogleCode('GOOGLE_DRIVE_READBACK'));

    const { proxy, revoke } = Proxy.revocable(new Uint8Array(sealed.wire), {});
    revoke();
    const { adapter: injectedProxy } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: proxy,
    }));
    await rejects(getOwnedCiphertext(injectedProxy, locator), (err) => {
      assertGoogleCode('GOOGLE_DRIVE_READBACK')(err);
      equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });

    const revokedAuth = Proxy.revocable(new Uint8Array(sealed.wire), {});
    revokedAuth.revoke();
    const { adapter: authProxy } = authClientAdapter(async () => ({
      status: 200,
      headers: {},
      data: revokedAuth.proxy,
    }));
    await rejects(getOwnedCiphertext(authProxy, locator), (err) => {
      assertGoogleCode('GOOGLE_DRIVE_READBACK')(err);
      equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });
  });
});

describe('owned listing JSON on AuthClient and injected transports', () => {
  const LIST_FIELDS = ['files', 'incompleteSearch', 'nextPageToken'];

  test('throwing list field getters are incomplete on the first AuthClient page', async () => {
    for (const field of LIST_FIELDS) {
      const hostile = hostileListData(field, { files: [fileRecord(`throw-${field}`, 16)] });
      const { adapter, calls } = authClientAdapter(async () => ({
        status: 200,
        data: hostile.data,
      }));
      const listed = await listCiphertextCandidates(adapter);
      equal(listed.complete, false, field);
      equal(listed.reason, 'GOOGLE_DRIVE_PAGE_FAILURE', field);
      equal(listed.candidates.length, 0, field);
      equal(hostile.getReads(), 0, field);
      assertNoWrites(calls);
      equal(inspect(listed, { showHidden: true }).includes(TOKEN_SENTINEL), false);
    }
  });

  test('throwing list field getters keep prior candidates on a later AuthClient page', async () => {
    const first = fileRecord('kept-auth', 20);
    for (const field of LIST_FIELDS) {
      const hostile = hostileListData(field, { files: [fileRecord(`late-${field}`, 12)] });
      let page = 0;
      const { adapter, calls } = authClientAdapter(async () => {
        page += 1;
        if (page === 1) {
          return { status: 200, data: { files: [first], nextPageToken: `next-${field}` } };
        }
        return {
          status: 200,
          data: hostile.data,
        };
      });
      const listed = await listCiphertextCandidates(adapter);
      equal(listed.complete, false, field);
      equal(listed.reason, 'GOOGLE_DRIVE_PAGE_FAILURE', field);
      equal(listed.candidates.length, 1, field);
      equal(listed.candidates[0].fileId, first.id, field);
      equal(page, 2, field);
      equal(hostile.getReads(), 0, field);
      assertNoWrites(calls);
    }
  });

  test('injected later-page field failures keep prior candidates and do not write', async () => {
    const first = fileRecord('kept-injected', 22);
    const laterBodies = [
      {
        field: 'files',
        body: { files: { id: 'x', name: wppName('x'), size: '1' } },
        reason: 'GOOGLE_DRIVE_PAGE_FAILURE',
        candidates: 1,
      },
      {
        field: 'incompleteSearch',
        body: { files: [fileRecord('late-search', 8)], incompleteSearch: 'true' },
        reason: 'GOOGLE_DRIVE_PAGE_FAILURE',
        candidates: 2,
      },
      {
        field: 'nextPageToken',
        body: { files: [fileRecord('late-token', 8)], nextPageToken: null },
        reason: 'GOOGLE_DRIVE_PAGE_TOKEN',
        candidates: 2,
      },
    ];
    for (const later of laterBodies) {
      let page = 0;
      const { adapter, calls } = listingAdapter(async () => {
        page += 1;
        if (page === 1) {
          return {
            status: 200,
            headers: {},
            body: jsonBody({ files: [first], nextPageToken: `next-${later.field}` }),
          };
        }
        return { status: 200, headers: {}, body: jsonBody(later.body) };
      });
      const listed = await listCiphertextCandidates(adapter);
      equal(listed.complete, false, later.field);
      equal(listed.reason, later.reason, later.field);
      equal(listed.candidates.length, later.candidates, later.field);
      equal(listed.candidates[0].fileId, first.id, later.field);
      assertNoWrites(calls);
    }
  });

  test('circular and undefined AuthClient JSON cannot complete a listing', async () => {
    const first = fileRecord('circ', 10);
    const circular = { files: [first] };
    circular.extra = circular;
    const { adapter: circAdapter, calls: circCalls } = authClientAdapter(async () => ({
      status: 200,
      data: circular,
    }));
    const circularListed = await listCiphertextCandidates(circAdapter);
    equal(circularListed.complete, false);
    equal(circularListed.reason, 'GOOGLE_DRIVE_PAGE_FAILURE');
    equal(circularListed.candidates.length, 0);
    assertNoWrites(circCalls);

    let page = 0;
    const { adapter: laterCirc, calls: laterCalls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: { files: [first], nextPageToken: 'circ-next' } };
      }
      const late = { files: [fileRecord('circ-2', 10)] };
      late.extra = late;
      return { status: 200, data: late };
    });
    const laterListed = await listCiphertextCandidates(laterCirc);
    equal(laterListed.complete, false);
    equal(laterListed.reason, 'GOOGLE_DRIVE_PAGE_FAILURE');
    equal(laterListed.candidates.length, 1);
    equal(laterListed.candidates[0].fileId, first.id);
    assertNoWrites(laterCalls);

    const { adapter: undefAdapter } = authClientAdapter(async () => ({
      status: 200,
      data: undefined,
    }));
    const undefListed = await listCiphertextCandidates(undefAdapter);
    equal(undefListed.complete, false);
    equal(undefListed.complete, false);
    equal(undefListed.candidates.length, 0);
  });

  test('function-valued list fields cannot complete on the first or later AuthClient page', async () => {
    const first = fileRecord('fn-kept', 14);
    for (const field of LIST_FIELDS) {
      const { adapter, calls } = authClientAdapter(async () => ({
        status: 200,
        data: {
          files: [fileRecord(`fn-${field}`, 8)],
          [field]: () => TOKEN_SENTINEL,
        },
      }));
      const listed = await listCiphertextCandidates(adapter);
      equal(listed.complete, false, field);
      equal(listed.candidates.length, 0, field);
      assertNoWrites(calls);
      equal(inspect(listed, { showHidden: true }).includes(TOKEN_SENTINEL), false);
    }
    for (const field of LIST_FIELDS) {
      let page = 0;
      const { adapter, calls } = authClientAdapter(async () => {
        page += 1;
        if (page === 1) {
          return { status: 200, data: { files: [first], nextPageToken: `fn-next-${field}` } };
        }
        return {
          status: 200,
          data: {
            files: [fileRecord(`fn-late-${field}`, 8)],
            [field]: () => TOKEN_SENTINEL,
          },
        };
      });
      const listed = await listCiphertextCandidates(adapter);
      equal(listed.complete, false, field);
      equal(listed.candidates.length, 1, field);
      equal(listed.candidates[0].fileId, first.id, field);
      equal(page, 2, field);
      assertNoWrites(calls);
    }
  });

  test('symbol-valued list fields cannot complete on the first or later AuthClient page', async () => {
    const first = fileRecord('sym-kept', 15);
    for (const field of LIST_FIELDS) {
      const { adapter, calls } = authClientAdapter(async () => ({
        status: 200,
        data: {
          files: [fileRecord(`sym-${field}`, 8)],
          [field]: Symbol(TOKEN_SENTINEL),
        },
      }));
      const listed = await listCiphertextCandidates(adapter);
      equal(listed.complete, false, field);
      equal(listed.candidates.length, 0, field);
      assertNoWrites(calls);
      equal(inspect(listed, { showHidden: true }).includes(TOKEN_SENTINEL), false);
    }
    for (const field of LIST_FIELDS) {
      let page = 0;
      const { adapter, calls } = authClientAdapter(async () => {
        page += 1;
        if (page === 1) {
          return { status: 200, data: { files: [first], nextPageToken: `sym-next-${field}` } };
        }
        return {
          status: 200,
          data: {
            files: [fileRecord(`sym-late-${field}`, 8)],
            [field]: Symbol(TOKEN_SENTINEL),
          },
        };
      });
      const listed = await listCiphertextCandidates(adapter);
      equal(listed.complete, false, field);
      equal(listed.candidates.length, 1, field);
      equal(listed.candidates[0].fileId, first.id, field);
      equal(page, 2, field);
      assertNoWrites(calls);
    }
  });

  test('custom toJSON cannot change listing shape or complete pagination', async () => {
    const visible = fileRecord('tojson-visible', 9);
    const hidden = fileRecord('tojson-hidden', 9);
    const firstPage = customToJsonData(
      { files: [visible], nextPageToken: 'tojson-next' },
      { files: [hidden] },
    );
    const { adapter: firstAdapter, calls: firstCalls } = authClientAdapter(async () => ({
      status: 200,
      data: firstPage.data,
    }));
    const firstListed = await listCiphertextCandidates(firstAdapter);
    equal(firstListed.complete, false);
    equal(firstListed.candidates.length, 0);
    equal(firstPage.getCalls(), 0);
    assertNoWrites(firstCalls);

    let page = 0;
    const laterPage = customToJsonData(
      { files: [hidden], nextPageToken: null },
      { files: [hidden] },
    );
    const { adapter: laterAdapter, calls: laterCalls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: { files: [visible], nextPageToken: 'tojson-later' } };
      }
      return { status: 200, data: laterPage.data };
    });
    const laterListed = await listCiphertextCandidates(laterAdapter);
    equal(laterListed.complete, false);
    equal(laterListed.candidates.length, 1);
    equal(laterListed.candidates[0].fileId, visible.id);
    equal(laterPage.getCalls(), 0);
    assertNoWrites(laterCalls);
  });

  test('changing oversize list getters are rejected without execution', async () => {
    const hostile = flippingOversizeFiles();
    const { adapter, calls } = authClientAdapter(async () => ({
      status: 200,
      data: hostile.data,
    }));
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.candidates.length, 0);
    equal(hostile.getReads(), 0);
    assertNoWrites(calls);

    const first = fileRecord('flip-kept', 18);
    const later = flippingOversizeFiles();
    let page = 0;
    const { adapter: laterAdapter, calls: laterCalls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: { files: [first], nextPageToken: 'flip-next' } };
      }
      return { status: 200, data: later.data };
    });
    const laterListed = await listCiphertextCandidates(laterAdapter);
    equal(laterListed.complete, false);
    equal(laterListed.candidates.length, 1);
    equal(laterListed.candidates[0].fileId, first.id);
    equal(later.getReads(), 0);
    assertNoWrites(laterCalls);
  });

  test('nested changing getters are rejected without execution', async () => {
    const file = fileRecord('nested-flip', 10);
    const hostile = nestedFlippingGetter(file);
    const { adapter, calls } = authClientAdapter(async () => ({
      status: 200,
      data: { files: [hostile.item] },
    }));
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.candidates.length, 0);
    equal(hostile.getReads(), 0);
    assertNoWrites(calls);

    const first = fileRecord('nested-kept', 11);
    const laterHostile = nestedFlippingGetter(fileRecord('nested-late', 12));
    let page = 0;
    const { adapter: laterAdapter, calls: laterCalls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: { files: [first], nextPageToken: 'nested-next' } };
      }
      return { status: 200, data: { files: [laterHostile.item] } };
    });
    const laterListed = await listCiphertextCandidates(laterAdapter);
    equal(laterListed.complete, false);
    equal(laterListed.candidates.length, 1);
    equal(laterListed.candidates[0].fileId, first.id);
    equal(laterHostile.getReads(), 0);
    assertNoWrites(laterCalls);
  });

  test('top-level and nested throwing proxies cannot complete a listing', async () => {
    const first = fileRecord('proxy-kept', 13);
    const { adapter: topAdapter, calls: topCalls } = authClientAdapter(async () => ({
      status: 200,
      data: throwingListProxy({ files: [fileRecord('proxy-top', 8)] }),
    }));
    const topListed = await listCiphertextCandidates(topAdapter);
    equal(topListed.complete, false);
    equal(topListed.candidates.length, 0);
    assertNoWrites(topCalls);
    equal(inspect(topListed, { showHidden: true }).includes(TOKEN_SENTINEL), false);

    const { adapter: nestedAdapter, calls: nestedCalls } = authClientAdapter(async () => ({
      status: 200,
      data: { files: [throwingListProxy(fileRecord('proxy-nested', 8))] },
    }));
    const nestedListed = await listCiphertextCandidates(nestedAdapter);
    equal(nestedListed.complete, false);
    equal(nestedListed.candidates.length, 0);
    assertNoWrites(nestedCalls);

    let page = 0;
    const { adapter: laterAdapter, calls: laterCalls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: { files: [first], nextPageToken: 'proxy-next' } };
      }
      return {
        status: 200,
        data: { files: [throwingListProxy(fileRecord('proxy-late', 8))] },
      };
    });
    const laterListed = await listCiphertextCandidates(laterAdapter);
    equal(laterListed.complete, false);
    equal(laterListed.candidates.length, 1);
    equal(laterListed.candidates[0].fileId, first.id);
    assertNoWrites(laterCalls);
  });

  test('top-level and nested revoked proxies cannot complete a listing', async () => {
    const first = fileRecord('revoked-kept', 16);
    const top = Proxy.revocable({ files: [fileRecord('revoked-top', 8)] }, {});
    top.revoke();
    const { adapter: topAdapter, calls: topCalls } = authClientAdapter(async () => ({
      status: 200,
      data: top.proxy,
    }));
    const topListed = await listCiphertextCandidates(topAdapter);
    equal(topListed.complete, false);
    equal(topListed.candidates.length, 0);
    assertNoWrites(topCalls);

    const nested = Proxy.revocable(fileRecord('revoked-nested', 8), {});
    nested.revoke();
    const { adapter: nestedAdapter, calls: nestedCalls } = authClientAdapter(async () => ({
      status: 200,
      data: { files: [nested.proxy] },
    }));
    const nestedListed = await listCiphertextCandidates(nestedAdapter);
    equal(nestedListed.complete, false);
    equal(nestedListed.candidates.length, 0);
    assertNoWrites(nestedCalls);

    let page = 0;
    const later = Proxy.revocable(fileRecord('revoked-late', 8), {});
    later.revoke();
    const { adapter: laterAdapter, calls: laterCalls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: { files: [first], nextPageToken: 'revoked-next' } };
      }
      return { status: 200, data: { files: [later.proxy] } };
    });
    const laterListed = await listCiphertextCandidates(laterAdapter);
    equal(laterListed.complete, false);
    equal(laterListed.candidates.length, 1);
    equal(laterListed.candidates[0].fileId, first.id);
    assertNoWrites(laterCalls);
  });

  test('non-enumerable and inherited completion fields cannot complete a listing', async () => {
    const visible = fileRecord('hidden-token', 8);
    const hidden = { files: [visible] };
    Object.defineProperty(hidden, 'nextPageToken', {
      enumerable: false,
      value: 'hidden-token',
    });
    const { adapter: hiddenAdapter, calls: hiddenCalls } = authClientAdapter(async () => ({
      status: 200,
      data: hidden,
    }));
    const hiddenListed = await listCiphertextCandidates(hiddenAdapter);
    equal(hiddenListed.complete, false);
    equal(hiddenListed.candidates.length, 0);
    assertNoWrites(hiddenCalls);

    const proto = { nextPageToken: 'from-proto' };
    const inherited = Object.create(proto);
    inherited.files = [visible];
    const { adapter: protoAdapter, calls: protoCalls } = authClientAdapter(async () => ({
      status: 200,
      data: inherited,
    }));
    const protoListed = await listCiphertextCandidates(protoAdapter);
    equal(protoListed.complete, false);
    equal(protoListed.candidates.length, 0);
    assertNoWrites(protoCalls);
  });

  test('unknown JSON fields count toward the owned listing byte bound', async () => {
    const first = fileRecord('owned-pad', 8);
    const { adapter, calls } = authClientAdapter(async () => ({
      status: 200,
      data: { files: [first], pad: 'x'.repeat(DRIVE_LIST_JSON_MAX_BYTES) },
    }));
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.reason, 'GOOGLE_DRIVE_JSON_BOUND');
    equal(listed.candidates.length, 0);
    assertNoWrites(calls);

    let page = 0;
    const { adapter: laterAdapter, calls: laterCalls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: { files: [first], nextPageToken: 'pad-next' } };
      }
      return {
        status: 200,
        data: { files: [fileRecord('owned-pad-late', 8)], pad: 'x'.repeat(DRIVE_LIST_JSON_MAX_BYTES) },
      };
    });
    const laterListed = await listCiphertextCandidates(laterAdapter);
    equal(laterListed.complete, false);
    equal(laterListed.reason, 'GOOGLE_DRIVE_JSON_BOUND');
    equal(laterListed.candidates.length, 1);
    equal(laterListed.candidates[0].fileId, first.id);
    assertNoWrites(laterCalls);
  });

  test('changing descriptor Proxy continuation cannot complete on the first or later AuthClient page', async () => {
    const first = fileRecord('desc-proxy-first', 8);
    const hostile = changingDescriptorContinuation([fileRecord('desc-proxy-hide', 8)], 'still-next');
    const { adapter, calls } = authClientAdapter(async () => ({
      status: 200,
      data: hostile.data,
    }));
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.candidates.length, 0);
    assertNoWrites(calls);

    const later = changingDescriptorContinuation([fileRecord('desc-proxy-late', 8)], 'later-hidden');
    let page = 0;
    const { adapter: laterAdapter, calls: laterCalls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: { files: [first], nextPageToken: 'desc-proxy-next' } };
      }
      return { status: 200, data: later.data };
    });
    const laterListed = await listCiphertextCandidates(laterAdapter);
    equal(laterListed.complete, false);
    equal(laterListed.candidates.length, 1);
    equal(laterListed.candidates[0].fileId, first.id);
    equal(page, 2);
    assertNoWrites(laterCalls);
  });

  test('literal own __proto__ keys stay data and do not complete from nested completion fields', async () => {
    const visible = fileRecord('proto-own', 8);
    const nested = {
      files: [fileRecord('proto-nested', 8)],
      nextPageToken: 'from-proto-value',
      incompleteSearch: true,
    };
    const firstPage = ownProtoListing({ files: [visible] }, nested);
    const { adapter, calls } = authClientAdapter(async () => ({
      status: 200,
      data: firstPage,
    }));
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, true);
    equal(listed.candidates.length, 1);
    equal(listed.candidates[0].fileId, visible.id);
    equal(calls.length, 1);
    assertNoWrites(calls);

    const continued = fileRecord('proto-continue', 9);
    const withToken = ownProtoListing(
      { files: [continued], nextPageToken: 'real-next' },
      nested,
    );
    let page = 0;
    const { adapter: laterAdapter, calls: laterCalls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: withToken };
      }
      return { status: 200, data: { files: [fileRecord('proto-page-two', 8)] } };
    });
    const laterListed = await listCiphertextCandidates(laterAdapter);
    equal(laterListed.complete, true);
    equal(laterListed.candidates.length, 2);
    equal(laterListed.candidates[0].fileId, continued.id);
    equal(laterListed.candidates[1].fileId, 'file_proto-page-two');
    equal(page, 2);
    equal(laterCalls.length, 2);
    assertNoWrites(laterCalls);

    const injectedFile = fileRecord('proto-injected', 8);
    const { adapter: injectedAdapter, calls: injectedCalls } = listingAdapter(async () => ({
      status: 200,
      headers: {},
      body: utf8(
        `{"files":[${JSON.stringify(injectedFile)}],"__proto__":{"files":[],"nextPageToken":"injected-hidden","incompleteSearch":true}}`,
      ),
    }));
    const injectedListed = await listCiphertextCandidates(injectedAdapter);
    equal(injectedListed.complete, true);
    equal(injectedListed.candidates.length, 1);
    equal(injectedListed.candidates[0].fileId, injectedFile.id);
    assertNoWrites(injectedCalls);
  });

  test('inherited and nonenumerable completion fields stay incomplete on later pages', async () => {
    const first = fileRecord('hidden-later', 8);
    const hidden = { files: [fileRecord('hidden-own', 8)] };
    Object.defineProperty(hidden, 'nextPageToken', {
      enumerable: false,
      value: 'hidden-later-token',
    });
    let page = 0;
    const { adapter, calls } = authClientAdapter(async () => {
      page += 1;
      if (page === 1) {
        return { status: 200, data: { files: [first], nextPageToken: 'hidden-next' } };
      }
      return { status: 200, data: hidden };
    });
    const listed = await listCiphertextCandidates(adapter);
    equal(listed.complete, false);
    equal(listed.candidates.length, 1);
    equal(listed.candidates[0].fileId, first.id);
    equal(page, 2);
    assertNoWrites(calls);

    const proto = { nextPageToken: 'from-proto-later', incompleteSearch: true };
    const inherited = Object.create(proto);
    inherited.files = [fileRecord('inherited-late', 8)];
    let inheritedPage = 0;
    const { adapter: protoAdapter, calls: protoCalls } = authClientAdapter(async () => {
      inheritedPage += 1;
      if (inheritedPage === 1) {
        return { status: 200, data: { files: [first], nextPageToken: 'inherited-next' } };
      }
      return { status: 200, data: inherited };
    });
    const protoListed = await listCiphertextCandidates(protoAdapter);
    equal(protoListed.complete, false);
    equal(protoListed.candidates.length, 1);
    equal(protoListed.candidates[0].fileId, first.id);
    assertNoWrites(protoCalls);
  });

  test('oversized string values and keys are rejected without a huge serialized allocation', async () => {
    const hugeValue = 'x'.repeat(DRIVE_LIST_JSON_MAX_BYTES + 1);
    const valueProbe = await withStringifyProbe(async () => {
      const { adapter, calls } = authClientAdapter(async () => ({
        status: 200,
        data: { files: [], pad: hugeValue },
      }));
      const listed = await listCiphertextCandidates(adapter);
      assertNoWrites(calls);
      return listed;
    });
    equal(valueProbe.result.complete, false);
    equal(valueProbe.result.reason, 'GOOGLE_DRIVE_JSON_BOUND');
    equal(valueProbe.result.candidates.length, 0);
    ok(
      valueProbe.largest < hugeValue.length,
      `value serialized allocation ${valueProbe.largest}`,
    );

    const hugeKey = 'k'.repeat(DRIVE_LIST_JSON_MAX_BYTES + 1);
    const keyProbe = await withStringifyProbe(async () => {
      const { adapter, calls } = authClientAdapter(async () => ({
        status: 200,
        data: { files: [], [hugeKey]: 1 },
      }));
      const listed = await listCiphertextCandidates(adapter);
      assertNoWrites(calls);
      return listed;
    });
    equal(keyProbe.result.complete, false);
    equal(keyProbe.result.reason, 'GOOGLE_DRIVE_JSON_BOUND');
    equal(keyProbe.result.candidates.length, 0);
    ok(keyProbe.largest < hugeKey.length, `key serialized allocation ${keyProbe.largest}`);

    const first = fileRecord('oversize-kept', 8);
    const laterProbe = await withStringifyProbe(async () => {
      let page = 0;
      const { adapter, calls } = authClientAdapter(async () => {
        page += 1;
        if (page === 1) {
          return { status: 200, data: { files: [first], nextPageToken: 'oversize-next' } };
        }
        return { status: 200, data: { files: [fileRecord('oversize-late', 8)], pad: hugeValue } };
      });
      const listed = await listCiphertextCandidates(adapter);
      assertNoWrites(calls);
      return listed;
    });
    equal(laterProbe.result.complete, false);
    equal(laterProbe.result.reason, 'GOOGLE_DRIVE_JSON_BOUND');
    equal(laterProbe.result.candidates.length, 1);
    equal(laterProbe.result.candidates[0].fileId, first.id);
    ok(
      laterProbe.largest < hugeValue.length,
      `later serialized allocation ${laterProbe.largest}`,
    );
  });

  test('listing byte accounting matches JSON.stringify at the 1 MiB boundary for escaped Unicode', async () => {
    const units = [
      ['ascii', 'x'],
      ['quote', '"'],
      ['backslash', '\\'],
      ['newline', '\n'],
      ['control', '\u0001'],
      ['bmp-2', 'é'],
      ['bmp-3', '中'],
      ['surrogate-pair', '😀'],
      ['lone-high', '\uD800'],
      ['lone-low', '\uDFFF'],
    ];
    for (const [name, unit] of units) {
      const n = padRepeatsForBudget(unit, DRIVE_LIST_JSON_MAX_BYTES);
      const exactPage = { files: [], pad: unit.repeat(n) };
      const overPage = { files: [], pad: unit.repeat(n + 1) };
      const exactSize = jsonUtf8Size(exactPage);
      const overSize = jsonUtf8Size(overPage);
      ok(exactSize <= DRIVE_LIST_JSON_MAX_BYTES, `${name} exact ${exactSize}`);
      ok(overSize > DRIVE_LIST_JSON_MAX_BYTES, `${name} over ${overSize}`);

      const { adapter: exactAdapter, calls: exactCalls } = authClientAdapter(async () => ({
        status: 200,
        data: exactPage,
      }));
      const exactListed = await listCiphertextCandidates(exactAdapter);
      equal(exactListed.complete, true, name);
      equal(exactListed.candidates.length, 0, name);
      assertNoWrites(exactCalls);

      const { adapter: overAdapter, calls: overCalls } = authClientAdapter(async () => ({
        status: 200,
        data: overPage,
      }));
      const overListed = await listCiphertextCandidates(overAdapter);
      equal(overListed.complete, false, name);
      equal(overListed.reason, 'GOOGLE_DRIVE_JSON_BOUND', name);
      equal(overListed.candidates.length, 0, name);
      assertNoWrites(overCalls);
    }
  });

  test('queryBoundPermissionId requires a finite integer 2xx status', async () => {
    const validUser = { user: { permissionId: PERMISSION_ID } };
    await rejects(
      queryBoundPermissionId({
        request: async () => ({ data: validUser }),
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    await rejects(
      queryBoundPermissionId({
        request: async () => ({ status: Number.NaN, data: validUser }),
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    await rejects(
      queryBoundPermissionId({
        request: async () => ({ status: 199, data: validUser }),
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    const permissionId = await queryBoundPermissionId({
      request: async () => ({ status: 200, data: validUser }),
    });
    equal(permissionId, PERMISSION_ID);
  });
});
