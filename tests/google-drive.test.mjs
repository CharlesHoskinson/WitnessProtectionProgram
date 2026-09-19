import { equal, match, ok, rejects } from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { request as nodeHttpRequest } from 'node:http';
import { inspect } from 'node:util';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';

import { UnlockedVault } from '../dist/kernel/index.js';
import { LIMIT_PACKAGE_BYTES } from '../dist/kernel/json.js';
import {
  DRIVE_FILE_SCOPE,
  GoogleError,
  OAUTH_CALLBACK_PATH,
  authorizeInstalledApp,
  createGoogleDriveAdapter,
  createGoogleDriveAdapterFromAuthClient,
  loadInstalledAppClient,
  runGoogleProjectSetup,
  runGoogleProjectSetupCli,
} from '../dist/google/index.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOKEN_SENTINEL = 'ya29.TOKEN_SENTINEL_DO_NOT_LEAK';
const REFRESH_SENTINEL = '1//REFRESH_TOKEN_SENTINEL';
const AUTH_CODE = 'AUTH_CODE_UNIQUE_1';
const PERMISSION_ID = 'permId-opaque-stable-001';
const CLIENT_ID = '1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com';
const CLIENT_SECRET = 'GOCSPX-test-desktop-secret';
const DRIVE_FILE_SCOPE_VALUE = 'https://www.googleapis.com/auth/drive.file';
const AUTH_ORIGIN = 'https://accounts.google.com';
const AUTH_PATH = '/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ABOUT_URL = 'https://www.googleapis.com/drive/v3/about';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';

const vector = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/wpp-v1-vectors.json', import.meta.url)), 'utf8'),
);

const utf8 = (text) => Buffer.from(text, 'utf8');
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function captureLogs() {
  const chunks = [];
  const originals = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
  const push = (...args) => {
    chunks.push(args.map((value) => inspect(value, { depth: 12, compact: false })).join(' '));
  };
  console.log = push;
  console.info = push;
  console.warn = push;
  console.error = push;
  console.debug = push;
  return {
    text() {
      return chunks.join('\n');
    },
    restore() {
      console.log = originals.log;
      console.info = originals.info;
      console.warn = originals.warn;
      console.error = originals.error;
      console.debug = originals.debug;
    },
  };
}

function assertNoSecret(value) {
  const text = typeof value === 'string' ? value : inspect(value, { depth: 12, showHidden: true, getters: true });
  equal(text.includes(TOKEN_SENTINEL), false);
  equal(text.includes(REFRESH_SENTINEL), false);
  equal(text.includes(AUTH_CODE), false);
  equal(text.includes('Authorization'), false);
  equal(text.includes('Bearer '), false);
}

function assertGoogleCode(code) {
  return (err) => {
    ok(err instanceof GoogleError, `expected GoogleError, got ${err?.name}: ${err?.message}`);
    equal(err.code, code);
    equal(err.message, code);
    assertNoSecret(err);
    assertNoSecret(err.stack ?? '');
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

function futureExpiry() {
  return Date.now() + 60 * 60 * 1000;
}

function tokenResponse(overrides = {}) {
  return {
    tokens: {
      access_token: TOKEN_SENTINEL,
      refresh_token: REFRESH_SENTINEL,
      expiry_date: futureExpiry(),
      token_type: 'Bearer',
      scope: DRIVE_FILE_SCOPE_VALUE,
      ...overrides,
    },
  };
}

function mockAuthClient({ getToken, request, tokens } = {}) {
  const exchange = [];
  const requests = [];
  return {
    exchange,
    requests,
    factory({ clientId, clientSecret, redirectUri }) {
      equal(clientId, CLIENT_ID);
      equal(clientSecret, CLIENT_SECRET);
      ok(typeof redirectUri === 'string');
      const real = new OAuth2Client({ clientId, clientSecret, redirectUri });
      return {
        generateCodeVerifierAsync: () => real.generateCodeVerifierAsync(),
        generateAuthUrl: (opts) => real.generateAuthUrl(opts),
        async getToken(opts) {
          exchange.push({ ...opts, redirectUri });
          if (typeof getToken === 'function') {
            return getToken(opts);
          }
          return tokenResponse(tokens);
        },
        setCredentials() {},
        async request(opts) {
          requests.push(opts);
          if (typeof request === 'function') {
            return request(opts);
          }
          const url = String(opts.url ?? '');
          if (url.startsWith(ABOUT_URL)) {
            return { status: 200, data: { user: { permissionId: PERMISSION_ID } } };
          }
          throw new Error(`unexpected request ${url}`);
        },
      };
    },
  };
}

async function assertClosed(redirectUri) {
  const url = new URL(redirectUri);
  await rejects(
    fetch(`${url.origin}${OAUTH_CALLBACK_PATH}?state=stale&code=replay`, { redirect: 'manual' }),
    (err) => {
      ok(err instanceof Error);
      match(
        String(err.cause?.code ?? err.code ?? err.message),
        /ECONNREFUSED|ERR_CONNECTION_REFUSED|fetch failed|UND_ERR_SOCKET|UND_ERR_CONNECT|ECONNRESET/i,
      );
      return true;
    },
  );
}

async function completeAuthorize({ launch, createAuthClient, waitMs = 4000, afterListen } = {}) {
  const launched = deferred();
  const sessionPromise = authorizeInstalledApp({
    client: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
    waitMs,
    launchBrowser: async (url) => {
      launched.resolve(url);
      if (typeof launch === 'function') {
        await launch(url);
      }
    },
    createAuthClient,
  });
  const authUrl = await launched.promise;
  if (typeof afterListen === 'function') {
    await afterListen(authUrl, sessionPromise);
  }
  return { authUrl, sessionPromise };
}

function parseAuthUrl(authUrl) {
  const parsed = new URL(authUrl);
  return {
    parsed,
    redirectUri: parsed.searchParams.get('redirect_uri'),
    state: parsed.searchParams.get('state'),
    challenge: parsed.searchParams.get('code_challenge'),
    method: parsed.searchParams.get('code_challenge_method'),
    scope: parsed.searchParams.get('scope'),
    accessType: parsed.searchParams.get('access_type'),
    responseType: parsed.searchParams.get('response_type'),
    clientId: parsed.searchParams.get('client_id'),
    prompt: parsed.searchParams.get('prompt'),
  };
}

function callbackUrl(redirectUri, query) {
  const url = new URL(redirectUri);
  url.search = '';
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item);
      }
    } else {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

function rawGet(redirectUri, { path, host, urlPath } = {}) {
  const target = new URL(redirectUri);
  const requestPath = urlPath ?? path ?? `${target.pathname}?state=x`;
  return new Promise((resolveRequest, rejectRequest) => {
    const req = nodeHttpRequest(
      {
        hostname: '127.0.0.1',
        port: Number(target.port),
        path: requestPath,
        method: 'GET',
        headers: {
          Host: host ?? `${target.hostname}:${target.port}`,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolveRequest({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', rejectRequest);
    req.end();
  });
}

describe('Google installed-app OAuth loopback', () => {
  test('successful callback exchanges PKCE code, binds permissionId, and leaks no token', async () => {
    const logs = captureLogs();
    const auth = mockAuthClient();
    try {
      const { authUrl, sessionPromise } = await completeAuthorize({
        createAuthClient: auth.factory,
        launch: async (url) => {
          const info = parseAuthUrl(url);
          equal(info.parsed.origin, AUTH_ORIGIN);
          equal(info.parsed.pathname, AUTH_PATH);
          equal(info.method, 'S256');
          ok(info.challenge && info.challenge.length >= 32);
          equal(info.scope, DRIVE_FILE_SCOPE_VALUE);
          equal(info.accessType, 'offline');
          equal(info.responseType, 'code');
          equal(info.clientId, CLIENT_ID);
          equal(info.prompt, 'select_account');
          ok(info.redirectUri.startsWith('http://127.0.0.1:'));
          ok(info.redirectUri.endsWith(OAUTH_CALLBACK_PATH));
          equal(new URL(info.redirectUri).hostname, '127.0.0.1');
          equal(DRIVE_FILE_SCOPE, DRIVE_FILE_SCOPE_VALUE);

          const res = await fetch(`${info.redirectUri}?state=${info.state}&code=${AUTH_CODE}`);
          equal(res.status, 200);
          equal(res.headers.get('cache-control'), 'no-store');
          const body = await res.text();
          match(body, /Witness Protection Program/i);
          equal(body.includes('http'), false);
          assertNoSecret(body);
          assertNoSecret([...res.headers.entries()]);
        },
      });

      const session = await sessionPromise;
      equal(session.permissionId, PERMISSION_ID);
      assertNoSecret(session);
      assertNoSecret(inspect(session, { depth: 12, showHidden: true, getters: true }));
      equal(JSON.stringify(session).includes(TOKEN_SENTINEL), false);
      equal(auth.exchange.length, 1);
      equal(auth.exchange[0].code, AUTH_CODE);
      ok(auth.exchange[0].codeVerifier);
      equal(auth.exchange[0].redirect_uri, parseAuthUrl(authUrl).redirectUri);
      const about = auth.requests.find((item) => String(item.url).startsWith(ABOUT_URL));
      ok(about);
      match(String(about.url), /fields=user\(permissionId\)/);
      await assertClosed(parseAuthUrl(authUrl).redirectUri);
      assertNoSecret(logs.text());
    } finally {
      logs.restore();
    }
  });

  test('wrong-state, duplicate query, replayed code, and unrelated malformed requests do not consume the pending flow', async () => {
    const auth = mockAuthClient();
    const { authUrl, sessionPromise } = await completeAuthorize({
      createAuthClient: auth.factory,
      launch: async (url) => {
        const info = parseAuthUrl(url);
        const wrong = await fetch(`${info.redirectUri}?state=not-the-state&code=${AUTH_CODE}`);
        ok(wrong.status >= 400);
        const duplicateState = callbackUrl(info.redirectUri, { state: [info.state, 'other'], code: AUTH_CODE });
        const dupStateRes = await fetch(duplicateState);
        ok(dupStateRes.status >= 400);
        const duplicateCode = callbackUrl(info.redirectUri, { state: info.state, code: [AUTH_CODE, 'second'] });
        const dupCodeRes = await fetch(duplicateCode);
        ok(dupCodeRes.status >= 400);
        const mixed = callbackUrl(info.redirectUri, { state: info.state, code: AUTH_CODE, error: 'access_denied' });
        const mixedRes = await fetch(mixed);
        ok(mixedRes.status >= 400);
        const favicon = await rawGet(info.redirectUri, { urlPath: '/favicon.ico' });
        ok(favicon.status >= 400);
        const post = await new Promise((resolvePost, rejectPost) => {
          const target = new URL(info.redirectUri);
          const req = nodeHttpRequest(
            {
              hostname: '127.0.0.1',
              port: Number(target.port),
              path: `${target.pathname}?state=${info.state}&code=${AUTH_CODE}`,
              method: 'POST',
              headers: { Host: `${target.hostname}:${target.port}` },
            },
            (res) => {
              res.resume();
              res.on('end', () => resolvePost(res.statusCode));
            },
          );
          req.on('error', rejectPost);
          req.end();
        });
        ok(post >= 400);
        const badHost = await rawGet(info.redirectUri, {
          urlPath: `${new URL(info.redirectUri).pathname}?state=${info.state}&code=${AUTH_CODE}`,
          host: 'evil.example:1',
        });
        ok(badHost.status >= 400);
        const huge = await rawGet(info.redirectUri, {
          urlPath: `${new URL(info.redirectUri).pathname}?state=${'x'.repeat(8000)}&code=${AUTH_CODE}`,
        });
        ok(huge.status >= 400);

        equal(auth.exchange.length, 0);
        const okRes = await fetch(`${info.redirectUri}?state=${info.state}&code=${AUTH_CODE}`);
        equal(okRes.status, 200);
      },
    });
    const session = await sessionPromise;
    equal(session.permissionId, PERMISSION_ID);
    equal(auth.exchange.length, 1);
    await assertClosed(parseAuthUrl(authUrl).redirectUri);
  });

  test('denied callback with matching state closes the listener without exchanging a token', async () => {
    const auth = mockAuthClient();
    const { authUrl, sessionPromise } = await completeAuthorize({
      createAuthClient: auth.factory,
      launch: async (url) => {
        const info = parseAuthUrl(url);
        const res = await fetch(`${info.redirectUri}?state=${info.state}&error=access_denied`);
        ok(res.status >= 400);
        const body = await res.text();
        assertNoSecret(body);
      },
    });
    await rejects(sessionPromise, assertGoogleCode('GOOGLE_OAUTH_DENIED'));
    equal(auth.exchange.length, 0);
    await assertClosed(parseAuthUrl(authUrl).redirectUri);
  });

  test('timeout closes the listener without exchanging a token', async () => {
    const auth = mockAuthClient();
    const { authUrl, sessionPromise } = await completeAuthorize({
      createAuthClient: auth.factory,
      waitMs: 50,
    });
    await rejects(sessionPromise, assertGoogleCode('GOOGLE_OAUTH_TIMEOUT'));
    equal(auth.exchange.length, 0);
    await assertClosed(parseAuthUrl(authUrl).redirectUri);
  });

  test('token exchange failure closes the listener and redacts the error', async () => {
    const logs = captureLogs();
    const auth = mockAuthClient({
      getToken() {
        const err = new Error('invalid_grant Authorization: Bearer leaked-body');
        err.response = { data: { error: TOKEN_SENTINEL, error_description: AUTH_CODE } };
        throw err;
      },
    });
    try {
      const { authUrl, sessionPromise } = await completeAuthorize({
        createAuthClient: auth.factory,
        launch: async (url) => {
          const info = parseAuthUrl(url);
          await fetch(`${info.redirectUri}?state=${info.state}&code=${AUTH_CODE}`);
        },
      });
      await rejects(sessionPromise, assertGoogleCode('GOOGLE_OAUTH_EXCHANGE'));
      await assertClosed(parseAuthUrl(authUrl).redirectUri);
      assertNoSecret(logs.text());
    } finally {
      logs.restore();
    }
  });

  test('missing drive.file scope is rejected after exchange', async () => {
    const auth = mockAuthClient({
      tokens: { scope: 'https://www.googleapis.com/auth/drive' },
    });
    const { sessionPromise } = await completeAuthorize({
      createAuthClient: auth.factory,
      launch: async (url) => {
        const info = parseAuthUrl(url);
        await fetch(`${info.redirectUri}?state=${info.state}&code=${AUTH_CODE}`);
      },
    });
    await rejects(sessionPromise, assertGoogleCode('GOOGLE_OAUTH_SCOPE'));
  });

  test('empty About permissionId fails identity binding and does not use email', async () => {
    const auth = mockAuthClient({
      request(opts) {
        const url = String(opts.url ?? '');
        if (url.startsWith(ABOUT_URL)) {
          return {
            status: 200,
            data: { user: { permissionId: '', emailAddress: 'user@example.com', displayName: 'Example' } },
          };
        }
        throw new Error(url);
      },
    });
    const { sessionPromise } = await completeAuthorize({
      createAuthClient: auth.factory,
      launch: async (url) => {
        const info = parseAuthUrl(url);
        await fetch(`${info.redirectUri}?state=${info.state}&code=${AUTH_CODE}`);
      },
    });
    await rejects(sessionPromise, assertGoogleCode('GOOGLE_BIND_IDENTITY'));
  });

  test('browser launch failure closes the listener', async () => {
    await rejects(
      authorizeInstalledApp({
        client: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
        waitMs: 1000,
        launchBrowser: async () => {
          throw new Error('opener missing');
        },
        createAuthClient: mockAuthClient().factory,
      }),
      assertGoogleCode('GOOGLE_OAUTH_BROWSER'),
    );
  });
});

describe('in-memory OAuth2Client refresh', () => {
  test('official client refreshes an expired session token before Drive upload', async () => {
    const sealed = sealSyntheticBlob();
    let refreshed = false;
    let sawNewAccess = false;
    const client = new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
    client.setCredentials({
      access_token: 'ya29.EXPIRED_ACCESS',
      refresh_token: REFRESH_SENTINEL,
      expiry_date: Date.now() - 60_000,
      token_type: 'Bearer',
      scope: DRIVE_FILE_SCOPE_VALUE,
    });
    client.transporter.request = async (opts) => {
      const url = String(opts.url ?? '');
      if (url === TOKEN_URL || url.startsWith(TOKEN_URL)) {
        refreshed = true;
        return {
          data: {
            access_token: TOKEN_SENTINEL,
            expires_in: 3600,
            token_type: 'Bearer',
            scope: DRIVE_FILE_SCOPE_VALUE,
          },
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          config: opts,
        };
      }
      const headers = opts.headers instanceof Headers ? opts.headers : new Headers(opts.headers ?? {});
      const authorization = headers.get('authorization') ?? headers.get('Authorization') ?? '';
      if (authorization.includes(TOKEN_SENTINEL)) {
        sawNewAccess = true;
      }
      if (url.startsWith(ABOUT_URL)) {
        return {
          data: { user: { permissionId: PERMISSION_ID } },
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          config: opts,
        };
      }
      if (url.startsWith(UPLOAD_URL)) {
        return {
          data: { id: 'file-refresh-1', size: String(sealed.wire.byteLength) },
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          config: opts,
        };
      }
      if (url.startsWith(`${FILES_URL}/file-refresh-1`) && url.includes('alt=media')) {
        return {
          data: Buffer.from(sealed.wire),
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'content-type': 'application/octet-stream',
            'content-length': String(sealed.wire.byteLength),
          }),
          config: opts,
        };
      }
      throw new Error(`unexpected ${url}`);
    };

    const adapter = await createGoogleDriveAdapterFromAuthClient({
      permissionId: PERMISSION_ID,
      authClient: client,
    });
    const receipt = await adapter.putOwnedCiphertext(sealed.wire, sealed.sha256);
    equal(refreshed, true);
    equal(sawNewAccess, true);
    equal(receipt.remoteReadbackVerified, true);
    equal(receipt.fileId, 'file-refresh-1');
    equal(inspect(adapter, { depth: 8, showHidden: true }).includes(TOKEN_SENTINEL), false);
  });
});

describe('Drive ciphertext adapter', () => {
  function memoryDrive() {
    const calls = [];
    const files = new Map();
    const request = async (opts) => {
      calls.push({
        method: String(opts.method ?? 'GET').toUpperCase(),
        url: String(opts.url),
        headers: opts.headers ?? {},
        body: opts.body,
      });
      const url = new URL(String(opts.url));
      if (url.origin + url.pathname === UPLOAD_URL && String(opts.method).toUpperCase() === 'POST') {
        const body = Buffer.from(opts.body ?? []);
        const text = body.toString('utf8');
        const nameMatch = text.match(/"name"\s*:\s*"([0-9a-f]{64}\.wpp)"/);
        ok(nameMatch, 'multipart metadata must use opaque hash-named .wpp file');
        equal(text.includes('fixture-account'), false);
        equal(text.includes('synthetic-contract'), false);
        equal(text.includes('fixture-state'), false);
        match(text, /application\/octet-stream/);
        const fileId = `file-${files.size + 1}`;
        const octets = extractOctetPayload(body);
        files.set(fileId, octets);
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: utf8(JSON.stringify({ id: fileId, size: String(octets.byteLength) })),
        };
      }
      if (url.pathname.startsWith('/drive/v3/files/') && url.searchParams.get('alt') === 'media') {
        const fileId = decodeURIComponent(url.pathname.slice('/drive/v3/files/'.length));
        const octets = files.get(fileId);
        if (!octets) {
          return { status: 404, headers: {}, body: utf8('{"error":{"message":"missing"}}') };
        }
        return {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': String(octets.byteLength),
          },
          body: octets,
        };
      }
      return { status: 500, headers: {}, body: utf8('unexpected') };
    };
    return { calls, files, request };
  }

  function extractOctetPayload(multipart) {
    const text = multipart.toString('utf8');
    const marker = 'content-type: application/octet-stream';
    const lower = text.toLowerCase();
    const at = lower.lastIndexOf(marker);
    ok(at >= 0);
    const headerEnd = text.indexOf('\r\n\r\n', at);
    ok(headerEnd >= 0);
    const rest = multipart.subarray(headerEnd + 4);
    const end = rest.lastIndexOf(utf8('\r\n--'));
    ok(end >= 0);
    return Buffer.from(rest.subarray(0, end));
  }

  test('create then media readback verifies exact owned ciphertext hash and length', async () => {
    const sealed = sealSyntheticBlob();
    const drive = memoryDrive();
    const adapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: drive.request,
    });
    const receipt = await adapter.putOwnedCiphertext(sealed.wire, sealed.sha256);
    equal(receipt.remoteReadbackVerified, true);
    equal(receipt.sha256, sealed.sha256);
    equal(receipt.byteCount, sealed.wire.byteLength);
    ok(receipt.fileId);
    equal(drive.calls.length, 2);
    equal(drive.calls[0].method, 'POST');
    ok(drive.calls[0].url.startsWith(UPLOAD_URL));
    match(drive.calls[0].url, /uploadType=multipart/);
    match(drive.calls[0].url, /fields=id%2Csize|fields=id,size/);
    equal(drive.calls[1].method, 'GET');
    ok(drive.calls[1].url.startsWith(`${FILES_URL}/`));
    match(drive.calls[1].url, /alt=media/);
    equal(adapter.permissionId, PERMISSION_ID);
  });

  test('rejects hash or size mismatch before any network call', async () => {
    const sealed = sealSyntheticBlob();
    let called = 0;
    const adapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => {
        called += 1;
        throw new Error('network');
      },
    });
    await rejects(
      adapter.putOwnedCiphertext(sealed.wire, '0'.repeat(64)),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    equal(called, 0);
    const tooBig = Buffer.alloc(LIMIT_PACKAGE_BYTES + 1, 7);
    await rejects(
      adapter.putOwnedCiphertext(tooBig, sha256Hex(tooBig)),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    equal(called, 0);
  });

  test('tampered or truncated readback is not a verified receipt', async () => {
    const sealed = sealSyntheticBlob();
    const adapterTamper = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async (opts) => {
        const url = String(opts.url);
        if (url.startsWith(UPLOAD_URL)) {
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: utf8(JSON.stringify({ id: 'file-tamper', size: String(sealed.wire.byteLength) })),
          };
        }
        const mutated = Buffer.from(sealed.wire);
        mutated[0] ^= 0xff;
        return {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': String(mutated.byteLength),
          },
          body: mutated,
        };
      },
    });
    await rejects(
      adapterTamper.putOwnedCiphertext(sealed.wire, sealed.sha256),
      assertGoogleCode('GOOGLE_DRIVE_READBACK'),
    );

    const adapterTrunc = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async (opts) => {
        const url = String(opts.url);
        if (url.startsWith(UPLOAD_URL)) {
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: utf8(JSON.stringify({ id: 'file-trunc', size: String(sealed.wire.byteLength) })),
          };
        }
        return {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': String(sealed.wire.byteLength - 1),
          },
          body: Buffer.from(sealed.wire.subarray(0, sealed.wire.byteLength - 1)),
        };
      },
    });
    await rejects(
      adapterTrunc.putOwnedCiphertext(sealed.wire, sealed.sha256),
      assertGoogleCode('GOOGLE_DRIVE_READBACK'),
    );

    const oversized = Buffer.concat([Buffer.from(sealed.wire), Buffer.from([0x00])]);
    const adapterOversize = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async (opts) => {
        const url = String(opts.url);
        if (url.startsWith(UPLOAD_URL)) {
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: utf8(JSON.stringify({ id: 'file-over', size: String(sealed.wire.byteLength) })),
          };
        }
        return {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': String(oversized.byteLength),
          },
          body: oversized,
        };
      },
    });
    await rejects(
      adapterOversize.putOwnedCiphertext(sealed.wire, sealed.sha256),
      assertGoogleCode('GOOGLE_DRIVE_READBACK'),
    );
  });

  test('create 200 without readback is not verified, and incomplete create is not retried', async () => {
    let creates = 0;
    const sealed = sealSyntheticBlob();
    const adapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async (opts) => {
        const url = String(opts.url);
        if (url.startsWith(UPLOAD_URL)) {
          creates += 1;
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: utf8(JSON.stringify({ name: 'ignored.wpp' })),
          };
        }
        throw new Error('no follow-up');
      },
    });
    await rejects(adapter.putOwnedCiphertext(sealed.wire, sealed.sha256), assertGoogleCode('GOOGLE_DRIVE_INCOMPLETE'));
    equal(creates, 1);

    let unknownCreates = 0;
    const unknown = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => {
        unknownCreates += 1;
        const err = new Error('socket hang up');
        err.code = 'ECONNRESET';
        throw err;
      },
    });
    await rejects(unknown.putOwnedCiphertext(sealed.wire, sealed.sha256), assertGoogleCode('GOOGLE_DRIVE_INCOMPLETE'));
    equal(unknownCreates, 1);
  });

  test('auth and quota failures use static codes and redact bodies', async () => {
    const logs = captureLogs();
    const sealed = sealSyntheticBlob();
    try {
      const authAdapter = createGoogleDriveAdapter({
        permissionId: PERMISSION_ID,
        request: async () => ({
          status: 401,
          headers: { 'www-authenticate': `Bearer ${TOKEN_SENTINEL}` },
          body: utf8(JSON.stringify({ error: { message: TOKEN_SENTINEL, code: 401 } })),
        }),
      });
      await rejects(authAdapter.putOwnedCiphertext(sealed.wire, sealed.sha256), assertGoogleCode('GOOGLE_DRIVE_AUTH'));

      const quotaAdapter = createGoogleDriveAdapter({
        permissionId: PERMISSION_ID,
        request: async () => ({
          status: 403,
          headers: {},
          body: utf8(
            JSON.stringify({
              error: {
                errors: [{ reason: 'storageQuotaExceeded', message: TOKEN_SENTINEL }],
              },
            }),
          ),
        }),
      });
      await rejects(quotaAdapter.putOwnedCiphertext(sealed.wire, sealed.sha256), assertGoogleCode('GOOGLE_DRIVE_QUOTA'));

      const redirectAdapter = createGoogleDriveAdapter({
        permissionId: PERMISSION_ID,
        request: async () => ({
          status: 302,
          headers: { location: 'https://evil.example/steal' },
          body: utf8(''),
        }),
      });
      await rejects(
        redirectAdapter.putOwnedCiphertext(sealed.wire, sealed.sha256),
        assertGoogleCode('GOOGLE_DRIVE_REDIRECT'),
      );
      assertNoSecret(logs.text());
    } finally {
      logs.restore();
    }
  });
});

describe('installed client config and publisher project setup', () => {
  test('loadInstalledAppClient accepts desktop JSON and rejects web clients', () => {
    const loaded = loadInstalledAppClient({
      installed: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uris: ['http://127.0.0.1', 'http://localhost'],
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      },
    });
    equal(loaded.clientId, CLIENT_ID);
    equal(loaded.clientSecret, CLIENT_SECRET);
    throwsWeb();
    function throwsWeb() {
      try {
        loadInstalledAppClient({
          web: { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uris: ['https://example.com'] },
        });
        throw new Error('accepted web client');
      } catch (err) {
        assertGoogleCode('GOOGLE_CLIENT_CONFIG')(err);
      }
    }
  });

  test('dry-run prints intended gcloud commands and Console URLs without spawning gcloud', async () => {
    const calls = [];
    const result = await runGoogleProjectSetup({
      projectId: 'wpp-google-beta-1',
      apply: false,
      runGcloud: async (args) => {
        calls.push(args);
        return { code: 0, stdout: 'should-not-run', stderr: '' };
      },
    });
    equal(calls.length, 0);
    equal(result.mode, 'dry-run');
    equal(result.projectId, 'wpp-google-beta-1');
    ok(result.commands.some((item) => item.includes('gcloud projects create wpp-google-beta-1')));
    ok(result.commands.some((item) => item.includes('gcloud services enable drive.googleapis.com')));
    ok(result.consoleUrls.some((item) => item.includes('project=wpp-google-beta-1')));
    ok(result.consoleUrls.some((item) => item.includes('auth/branding')));
    ok(result.consoleUrls.some((item) => item.includes('auth/audience')));
    ok(result.consoleUrls.some((item) => item.includes('auth/clients')));
    ok(result.consoleUrls.some((item) => item.includes('drive.googleapis.com')));
    ok(result.notes.some((item) => /Witness Protection Program/.test(item)));
    ok(result.notes.some((item) => /outside/.test(item)));
    equal(
      result.commands.some((item) => item.includes('auth login') || item.includes('config set project')),
      false,
    );
  });

  test('invalid project ID and unauthenticated apply fail before writes', async () => {
    const calls = [];
    const runGcloud = async (args) => {
      calls.push(args);
      return { code: 0, stdout: 'leaked-account@example.com', stderr: '' };
    };
    await rejects(runGoogleProjectSetup({ projectId: 'BAD', apply: true, runGcloud }), assertGoogleCode('GOOGLE_PROJECT_ID'));
    await rejects(
      runGoogleProjectSetup({ projectId: 'ab', apply: false, runGcloud }),
      assertGoogleCode('GOOGLE_PROJECT_ID'),
    );
    await rejects(
      runGoogleProjectSetup({ projectId: 'wpp-google-beta-1-', apply: true, runGcloud }),
      assertGoogleCode('GOOGLE_PROJECT_ID'),
    );
    equal(calls.length, 0);

    await rejects(
      runGoogleProjectSetup({
        projectId: 'wpp-google-beta-1',
        apply: true,
        runGcloud: async (args) => {
          calls.push(args);
          if (args[0] === 'auth' && args[1] === 'list') {
            return { code: 0, stdout: '', stderr: '' };
          }
          return { code: 0, stdout: '', stderr: '' };
        },
      }),
      assertGoogleCode('GOOGLE_GCLOUD_AUTH'),
    );
    ok(calls.length >= 1);
    equal(
      calls.some((args) => args.includes('projects') && args.includes('create')),
      false,
    );
    equal(
      calls.some((args) => args.includes('services') && args.includes('enable')),
      false,
    );
    equal(
      calls.some((args) => args.includes('login')),
      false,
    );
  });

  test('CLI dry-run writes commands and apply with mocked unauthenticated gcloud fails', async () => {
    const stdout = [];
    const stderr = [];
    const code = await runGoogleProjectSetupCli(['--project-id', 'wpp-google-beta-1'], {
      runGcloud: async () => {
        throw new Error('gcloud must not run in dry-run');
      },
      stdout: { write(chunk) { stdout.push(String(chunk)); return true; } },
      stderr: { write(chunk) { stderr.push(String(chunk)); return true; } },
    });
    equal(code, 0);
    match(stdout.join(''), /gcloud projects create wpp-google-beta-1/);
    match(stdout.join(''), /console\.cloud\.google\.com/);

    const applyCalls = [];
    const applyCode = await runGoogleProjectSetupCli(['--project-id', 'wpp-google-beta-1', '--apply'], {
      runGcloud: async (args) => {
        applyCalls.push(args);
        if (args[0] === 'auth') {
          return { code: 0, stdout: '', stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      },
      stdout: { write(chunk) { stdout.push(String(chunk)); return true; } },
      stderr: { write(chunk) { stderr.push(String(chunk)); return true; } },
    });
    equal(applyCode !== 0, true);
    match(stderr.join(''), /GOOGLE_GCLOUD_AUTH/);
    equal(
      applyCalls.some((args) => args.includes('create') || args.includes('enable')),
      false,
    );
  });
});

describe('smoke and setup scripts exist as CLI entrypoints', () => {
  test('google-drive-smoke requires an outside-repo --client-file', async () => {
    const inside = join(ROOT, 'package.json');
    const result = await runNode(['scripts/google-drive-smoke.mjs', '--client-file', inside]);
    equal(result.status !== 0, true);
    match(`${result.stdout}\n${result.stderr}`, /GOOGLE_CLIENT_CONFIG/);
  });

  test('google-project-setup rejects missing project id without calling gcloud', async () => {
    const result = await runNode(['scripts/google-project-setup.mjs']);
    equal(result.status !== 0, true);
    match(`${result.stdout}\n${result.stderr}`, /GOOGLE_PROJECT_ID/);
  });
});

function runNode(args) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('close', (status) => {
      resolveRun({
        status,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}
