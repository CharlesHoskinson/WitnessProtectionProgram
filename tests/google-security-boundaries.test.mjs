import { deepEqual, equal, match, ok, rejects } from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';

import { UnlockedVault } from '../dist/kernel/index.js';
import {
  DRIVE_FILE_SCOPE,
  DRIVE_LIST_JSON_MAX_BYTES,
  GOOGLE_JSON_MAX_BYTES,
  GoogleDriveSession,
  GoogleError,
  authorizeInstalledApp,
  createGoogleDriveAdapter,
  createGoogleDriveAdapterFromAuthClient,
  createOwnedOAuth2Client,
  getOwnedCiphertext,
  launchSystemBrowser,
  listCiphertextCandidates,
  queryBoundPermissionId,
  runGoogleProjectSetup,
} from '../dist/google/index.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOKEN_SENTINEL = 'ya29.TOKEN_SENTINEL_DO_NOT_LEAK';
const REFRESH_SENTINEL = '1//REFRESH_TOKEN_SENTINEL';
const AUTH_CODE = 'AUTH_CODE_UNIQUE_BOUNDARIES';
const VERIFIER_SENTINEL = 'pkce-verifier-sentinel-value-32bxxxx';
const CLIENT_ID = '1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com';
const CLIENT_SECRET = 'GOCSPX-test-desktop-secret';
const PERMISSION_ID = 'permId-opaque-stable-001';
const OTHER_PERMISSION_ID = 'permId-opaque-stable-002';
const DRIVE_FILE_SCOPE_VALUE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const ABOUT_URL = 'https://www.googleapis.com/drive/v3/about';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const OAUTH_CALLBACK_PATH = '/oauth2/callback';

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
    equal(text.includes(REFRESH_SENTINEL), false);
    equal(text.includes(AUTH_CODE), false);
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

function expectedOf() {
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

function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        reject(new Error('listen failed'));
        return;
      }
      resolve({
        server,
        port: addr.port,
        origin: `http://127.0.0.1:${addr.port}`,
      });
    });
  });
}

async function closeServer(server) {
  if (server === undefined) {
    return;
  }
  try {
    server.closeAllConnections();
  } catch {
    // already closed
  }
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function tokenJson(overrides = {}) {
  return JSON.stringify({
    access_token: TOKEN_SENTINEL,
    refresh_token: REFRESH_SENTINEL,
    expires_in: 3600,
    token_type: 'Bearer',
    scope: DRIVE_FILE_SCOPE_VALUE,
    ...overrides,
  });
}

function ownedClient(origin, extras = {}) {
  return createOwnedOAuth2Client({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: 'http://127.0.0.1/oauth2/callback',
    timeoutMs: extras.timeoutMs ?? 400,
    jsonMaxBytes: extras.jsonMaxBytes ?? GOOGLE_JSON_MAX_BYTES,
    fetchImplementation: extras.fetchImplementation,
    endpoints: { oauth2TokenUrl: `${origin}/token` },
  });
}

function futureExpiry() {
  return Date.now() + 60 * 60 * 1000;
}

describe('SDK logging must not print credentials', () => {
  test('owned client with GOOGLE_SDK_NODE_LOGGING=all does not print tokens or client config', async () => {
    const hits = [];
    const local = await listen((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(tokenJson());
    });
    const script = `
      import { createOwnedOAuth2Client } from ${JSON.stringify(new URL('../dist/google/index.js', import.meta.url).href)};
      const client = createOwnedOAuth2Client({
        clientId: ${JSON.stringify(CLIENT_ID)},
        clientSecret: ${JSON.stringify(CLIENT_SECRET)},
        redirectUri: 'http://127.0.0.1/oauth2/callback',
        timeoutMs: 2000,
        endpoints: { oauth2TokenUrl: ${JSON.stringify(`${local.origin}/token`)} },
      });
      const exchanged = await client.getToken({
        code: ${JSON.stringify(AUTH_CODE)},
        codeVerifier: ${JSON.stringify(VERIFIER_SENTINEL)},
        redirect_uri: 'http://127.0.0.1/oauth2/callback',
      });
      client.setCredentials({
        ...exchanged.tokens,
        refresh_token: ${JSON.stringify(REFRESH_SENTINEL)},
        expiry_date: Date.now() - 60_000,
        scope: ${JSON.stringify(DRIVE_FILE_SCOPE_VALUE)},
      });
      await client.refreshAccessToken();
      process.stdout.write('child-ok\\n');
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
          cwd: ROOT,
          env: { ...process.env, GOOGLE_SDK_NODE_LOGGING: 'all' },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on('data', (chunk) => stdout.push(chunk));
        child.stderr.on('data', (chunk) => stderr.push(chunk));
        child.on('error', reject);
        child.on('close', (status) => {
          resolve({
            status,
            stdout: Buffer.concat(stdout).toString('utf8'),
            stderr: Buffer.concat(stderr).toString('utf8'),
          });
        });
      });
      equal(result.status, 0, result.stderr);
      match(result.stdout, /child-ok/);
      const combined = `${result.stdout}\n${result.stderr}`;
      equal(combined.includes(TOKEN_SENTINEL), false);
      equal(combined.includes(REFRESH_SENTINEL), false);
      equal(combined.includes(AUTH_CODE), false);
      equal(combined.includes(VERIFIER_SENTINEL), false);
      equal(combined.includes(CLIENT_SECRET), false);
      equal(combined.includes(CLIENT_ID), false);
      ok(hits.length >= 2);
    } finally {
      await closeServer(local.server);
    }
  });
});

describe('finite network deadlines and response ceilings', () => {
  test('stalled token exchange aborts without a second request', async () => {
    let hits = 0;
    const local = await listen((req, res) => {
      hits += 1;
      req.resume();
      void res;
    });
    try {
      const client = ownedClient(local.origin, { timeoutMs: 150 });
      const started = Date.now();
      await rejects(
        client.getToken({
          code: AUTH_CODE,
          codeVerifier: VERIFIER_SENTINEL,
          redirect_uri: 'http://127.0.0.1/oauth2/callback',
        }),
        (err) => {
          ok(err instanceof Error);
          return true;
        },
      );
      ok(Date.now() - started < 2000);
      equal(hits, 1);
    } finally {
      await closeServer(local.server);
    }
  });

  test('stalled refresh aborts before a Drive request', async () => {
    const hits = [];
    const local = await listen((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      if (req.url === '/token') {
        req.resume();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    try {
      const client = ownedClient(local.origin, { timeoutMs: 150 });
      client.setCredentials({
        access_token: 'ya29.EXPIRED_ACCESS',
        refresh_token: REFRESH_SENTINEL,
        expiry_date: Date.now() - 60_000,
        token_type: 'Bearer',
        scope: DRIVE_FILE_SCOPE_VALUE,
      });
      await rejects(client.request({ url: `${local.origin}/drive`, method: 'GET', retry: false }));
      equal(hits.some((item) => item.includes('/drive')), false);
      equal(hits.filter((item) => item.includes('/token')).length, 1);
    } finally {
      await closeServer(local.server);
    }
  });

  test('chunked JSON above the small-JSON ceiling is rejected', async () => {
    const local = await listen((req, res) => {
      res.writeHead(200, {
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
      });
      const body = `{"user":{"permissionId":"${PERMISSION_ID}"},"waste":"${'x'.repeat(GOOGLE_JSON_MAX_BYTES)}"}`;
      ok(Buffer.byteLength(body) > GOOGLE_JSON_MAX_BYTES);
      res.end(body);
      void req;
    });
    try {
      const client = ownedClient(local.origin, { timeoutMs: 2000 });
      client.setCredentials({
        access_token: TOKEN_SENTINEL,
        expiry_date: futureExpiry(),
        token_type: 'Bearer',
        scope: DRIVE_FILE_SCOPE_VALUE,
      });
      const originalRequest = client.transporter.request.bind(client.transporter);
      client.transporter.request = (opts) => {
        const next = { ...opts };
        const url = String(opts.url ?? '');
        if (url.startsWith(ABOUT_URL)) {
          next.url = `${local.origin}/drive/v3/about?fields=user(permissionId)`;
        }
        return originalRequest(next);
      };
      await rejects(
        createGoogleDriveAdapterFromAuthClient({
          permissionId: PERMISSION_ID,
          authClient: client,
        }),
        assertGoogleCode('GOOGLE_BIND_IDENTITY'),
      );
    } finally {
      await closeServer(local.server);
    }
  });

  test('oversized media readback is rejected at the expected-byte ceiling', async () => {
    const sealed = sealSyntheticBlob();
    const local = await listen((req, res) => {
      const url = req.url ?? '';
      if (url.startsWith('/drive/v3/about')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ user: { permissionId: PERMISSION_ID } }));
        return;
      }
      if (url.startsWith('/upload/drive/v3/files')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'file-oversize', size: String(sealed.wire.byteLength) }));
        return;
      }
      res.writeHead(200, {
        'content-type': 'application/octet-stream',
        'transfer-encoding': 'chunked',
      });
      res.write(Buffer.from(sealed.wire));
      res.write(Buffer.alloc(64 * 1024, 7));
      res.end();
    });
    try {
      const client = createOwnedOAuth2Client({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: 'http://127.0.0.1/oauth2/callback',
        timeoutMs: 2000,
        endpoints: { oauth2TokenUrl: `${local.origin}/token` },
      });
      client.setCredentials({
        access_token: TOKEN_SENTINEL,
        expiry_date: futureExpiry(),
        token_type: 'Bearer',
        scope: DRIVE_FILE_SCOPE_VALUE,
      });
      client.transporter.defaults.baseURL = local.origin;
      const originalRequest = client.transporter.request.bind(client.transporter);
      client.transporter.request = (opts) => {
        const next = { ...opts };
        const url = String(opts.url ?? '');
        if (url.startsWith(ABOUT_URL)) {
          next.url = `${local.origin}/drive/v3/about?fields=user(permissionId)`;
        } else if (url.startsWith(UPLOAD_URL)) {
          next.url = `${local.origin}/upload/drive/v3/files?uploadType=multipart&fields=id,size`;
        } else if (url.startsWith(FILES_URL)) {
          next.url = `${local.origin}/drive/v3/files/file-oversize?alt=media`;
        }
        return originalRequest(next);
      };
      const adapter = await createGoogleDriveAdapterFromAuthClient({
        permissionId: PERMISSION_ID,
        authClient: client,
      });
      await rejects(
        adapter.putOwnedCiphertext(sealed.wire, sealed.sha256),
        assertGoogleCode('GOOGLE_DRIVE_READBACK'),
      );
    } finally {
      await closeServer(local.server);
    }
  });

  test('default gaxios node-fetch aborts an oversized About stream before the server finishes', async () => {
    const planned = 1024 * 1024;
    const ceiling = 65536;
    let sent = 0;
    let aborted = false;
    const local = await listen((req, res) => {
      const stop = () => {
        aborted = true;
        try {
          res.destroy();
        } catch {
          // already closed
        }
      };
      req.on('aborted', stop);
      req.on('close', () => {
        if (!res.writableEnded) {
          stop();
        }
      });
      res.writeHead(200, {
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
      });
      const chunk = Buffer.alloc(8192, 0x61);
      const writeMore = () => {
        if (aborted || req.destroyed || !res.writable) {
          stop();
          return;
        }
        if (sent >= planned) {
          res.end();
          return;
        }
        const ok = res.write(chunk);
        sent += chunk.byteLength;
        if (ok) {
          setImmediate(writeMore);
        } else {
          res.once('drain', writeMore);
        }
      };
      setImmediate(writeMore);
    });
    try {
      const client = createOwnedOAuth2Client({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: 'http://127.0.0.1/oauth2/callback',
        timeoutMs: 2000,
        jsonMaxBytes: ceiling,
        endpoints: { oauth2TokenUrl: `${local.origin}/token` },
      });
      client.setCredentials({
        access_token: TOKEN_SENTINEL,
        expiry_date: futureExpiry(),
        token_type: 'Bearer',
        scope: DRIVE_FILE_SCOPE_VALUE,
      });
      const originalRequest = client.transporter.request.bind(client.transporter);
      client.transporter.request = (opts) => {
        const next = { ...opts };
        next.url = `${local.origin}/drive/v3/about?fields=user(permissionId)`;
        next.maxContentLength = ceiling;
        return originalRequest(next);
      };
      await rejects(
        createGoogleDriveAdapterFromAuthClient({
          permissionId: PERMISSION_ID,
          authClient: client,
        }),
        assertGoogleCode('GOOGLE_BIND_IDENTITY'),
      );
      ok(sent < planned, `server wrote ${sent} of ${planned}`);
      ok(aborted || sent < planned / 2, `expected early abort, sent=${sent} aborted=${aborted}`);
    } finally {
      await closeServer(local.server);
    }
  });

  test('token 307 is not followed and does not send a second request', async () => {
    const hits = [];
    const local = await listen((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      if (req.url === '/token') {
        res.writeHead(307, { location: `${req.headers.host ? `http://${req.headers.host}` : ''}/stolen` });
        res.end('redirect');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(tokenJson());
    });
    try {
      const client = ownedClient(local.origin, { timeoutMs: 2000 });
      await rejects(
        client.getToken({
          code: AUTH_CODE,
          codeVerifier: VERIFIER_SENTINEL,
          redirect_uri: 'http://127.0.0.1/oauth2/callback',
        }),
      );
      equal(hits.filter((item) => item.includes('/token')).length, 1);
      equal(hits.some((item) => item.includes('/stolen')), false);
    } finally {
      await closeServer(local.server);
    }
  });

  test('caller-injected fetch cannot silently bypass the JSON ceiling', async () => {
    const huge = `{"user":{"permissionId":"${PERMISSION_ID}"},"pad":"${'x'.repeat(GOOGLE_JSON_MAX_BYTES + 8)}"}`;
    ok(Buffer.byteLength(huge) > GOOGLE_JSON_MAX_BYTES);
    let calls = 0;
    const fetchImplementation = async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: undefined,
        async text() {
          return huge;
        },
        async arrayBuffer() {
          return utf8(huge).buffer;
        },
        async json() {
          return JSON.parse(huge);
        },
      };
    };
    const client = createOwnedOAuth2Client({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: 'http://127.0.0.1/oauth2/callback',
      timeoutMs: 2000,
      fetchImplementation,
      endpoints: { oauth2TokenUrl: 'http://127.0.0.1:1/token' },
    });
    client.setCredentials({
      access_token: TOKEN_SENTINEL,
      expiry_date: futureExpiry(),
      token_type: 'Bearer',
      scope: DRIVE_FILE_SCOPE_VALUE,
    });
    await rejects(
      createGoogleDriveAdapterFromAuthClient({
        permissionId: PERMISSION_ID,
        authClient: client,
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    ok(calls >= 1);
  });

  test('authorization keeps a wall-clock bound after a valid callback', async () => {
    const started = Date.now();
    const launched = [];
    const sessionPromise = authorizeInstalledApp({
      client: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
      waitMs: 250,
      launchBrowser: async (url) => {
        launched.push(url);
        const parsed = new URL(url);
        const redirect = parsed.searchParams.get('redirect_uri');
        const state = parsed.searchParams.get('state');
        const res = await fetch(`${redirect}?state=${state}&code=${AUTH_CODE}`);
        const body = await res.text();
        equal(body.toLowerCase().includes('connected'), false);
        match(body, /Witness Protection Program|terminal|received/i);
      },
      createAuthClient() {
        return {
          async generateCodeVerifierAsync() {
            return { codeVerifier: VERIFIER_SENTINEL, codeChallenge: 'challenge-value' };
          },
          generateAuthUrl(opts) {
            const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            url.searchParams.set('redirect_uri', String(opts.redirect_uri));
            url.searchParams.set('state', String(opts.state));
            url.searchParams.set('code_challenge', String(opts.code_challenge));
            url.searchParams.set('code_challenge_method', 'S256');
            url.searchParams.set('scope', DRIVE_FILE_SCOPE_VALUE);
            url.searchParams.set('client_id', CLIENT_ID);
            url.searchParams.set('response_type', 'code');
            return url.toString();
          },
          async getToken() {
            await new Promise(() => {});
            return { tokens: {} };
          },
          setCredentials() {},
          async request() {
            return { status: 200, data: { user: { permissionId: PERMISSION_ID } } };
          },
        };
      },
    });
    await rejects(sessionPromise, assertGoogleCode('GOOGLE_OAUTH_TIMEOUT'));
    ok(Date.now() - started < 2000);
    equal(launched.length, 1);
    const redirect = new URL(launched[0]).searchParams.get('redirect_uri');
    await rejects(fetch(`${redirect}?state=stale&code=replay`));
  });
});

describe('sealed package grammar at the transport input boundary', () => {
  test('otherwise-valid sealed fixture is accepted and plaintext is rejected with zero requests', async () => {
    const sealed = sealSyntheticBlob();
    let calls = 0;
    const request = async (opts) => {
      calls += 1;
      const url = String(opts.url);
      if (url.startsWith(UPLOAD_URL)) {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: utf8(JSON.stringify({ id: 'file-ok', size: String(sealed.wire.byteLength) })),
        };
      }
      return {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(sealed.wire.byteLength),
        },
        body: Buffer.from(sealed.wire),
      };
    };
    const adapter = createGoogleDriveAdapter({ permissionId: PERMISSION_ID, request });
    const receipt = await adapter.putOwnedCiphertext(sealed.wire, sealed.sha256);
    equal(receipt.remoteReadbackVerified, true);
    ok(calls >= 2);

    calls = 0;
    const plaintext = utf8('this is not a sealed witness package');
    await rejects(
      adapter.putOwnedCiphertext(plaintext, sha256Hex(plaintext)),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    equal(calls, 0);

    const malformed = utf8(JSON.stringify({ header: 'nope', ciphertext: 'x', tag: 'y' }));
    await rejects(
      adapter.putOwnedCiphertext(malformed, sha256Hex(malformed)),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    equal(calls, 0);

    const parsed = JSON.parse(Buffer.from(sealed.wire).toString('utf8'));
    const raw = Buffer.from(parsed.ciphertext, 'base64url');
    parsed.ciphertext = raw.toString('base64');
    const noncanonical = utf8(JSON.stringify(parsed));
    await rejects(
      adapter.putOwnedCiphertext(noncanonical, sha256Hex(noncanonical)),
      assertGoogleCode('GOOGLE_DRIVE_INPUT'),
    );
    equal(calls, 0);
  });
});

describe('public auth-client adapter binds the live permissionId', () => {
  test('claimed permissionId A with actual B rejects with zero upload', async () => {
    let uploads = 0;
    const sealed = sealSyntheticBlob();
    const authClient = {
      async request(opts) {
        const url = String(opts.url ?? '');
        if (url.startsWith(ABOUT_URL)) {
          return { status: 200, data: { user: { permissionId: OTHER_PERMISSION_ID } } };
        }
        uploads += 1;
        throw new Error(`upload ${url}`);
      },
    };
    await rejects(
      createGoogleDriveAdapterFromAuthClient({
        permissionId: PERMISSION_ID,
        authClient,
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    equal(uploads, 0);
    await rejects(
      (async () => {
        const adapter = await createGoogleDriveAdapterFromAuthClient({
          permissionId: PERMISSION_ID,
          authClient,
        });
        return adapter.putOwnedCiphertext(sealed.wire, sealed.sha256);
      })(),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    equal(uploads, 0);
  });

  test('matching About permissionId is preserved and allows the later write', async () => {
    const sealed = sealSyntheticBlob();
    const authClient = {
      async request(opts) {
        const url = String(opts.url ?? '');
        if (url.startsWith(ABOUT_URL)) {
          return {
            status: 200,
            data: { user: { permissionId: PERMISSION_ID, emailAddress: 'not-the-key@example.com' } },
          };
        }
        if (url.startsWith(UPLOAD_URL)) {
          return { status: 200, data: { id: 'file-bound', size: String(sealed.wire.byteLength) } };
        }
        if (url.includes('alt=media')) {
          return {
            status: 200,
            data: Buffer.from(sealed.wire),
            headers: { 'content-length': String(sealed.wire.byteLength) },
          };
        }
        throw new Error(url);
      },
    };
    const adapter = await createGoogleDriveAdapterFromAuthClient({
      permissionId: PERMISSION_ID,
      authClient,
    });
    equal(adapter.permissionId, PERMISSION_ID);
    const receipt = await adapter.putOwnedCiphertext(sealed.wire, sealed.sha256);
    equal(receipt.fileId, 'file-bound');
    equal(receipt.remoteReadbackVerified, true);
  });
});

describe('exact drive.file scope on grant and refresh', () => {
  test('drive.readonly beside drive.file is rejected after exchange', async () => {
    const sessionPromise = authorizeInstalledApp({
      client: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
      waitMs: 4000,
      launchBrowser: async (url) => {
        const parsed = new URL(url);
        const redirect = parsed.searchParams.get('redirect_uri');
        const state = parsed.searchParams.get('state');
        await fetch(`${redirect}?state=${state}&code=${AUTH_CODE}`);
      },
      createAuthClient() {
        return {
          async generateCodeVerifierAsync() {
            return { codeVerifier: VERIFIER_SENTINEL, codeChallenge: 'challenge-value' };
          },
          generateAuthUrl(opts) {
            const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            url.searchParams.set('redirect_uri', String(opts.redirect_uri));
            url.searchParams.set('state', String(opts.state));
            url.searchParams.set('code_challenge', 'challenge-value');
            url.searchParams.set('code_challenge_method', 'S256');
            url.searchParams.set('client_id', CLIENT_ID);
            url.searchParams.set('response_type', 'code');
            url.searchParams.set('scope', DRIVE_FILE_SCOPE);
            return url.toString();
          },
          async getToken() {
            return {
              tokens: {
                access_token: TOKEN_SENTINEL,
                refresh_token: REFRESH_SENTINEL,
                expiry_date: futureExpiry(),
                token_type: 'Bearer',
                scope: `${DRIVE_FILE_SCOPE_VALUE} ${DRIVE_READONLY_SCOPE}`,
              },
            };
          },
          setCredentials() {},
          async request() {
            throw new Error('about must not run');
          },
        };
      },
    });
    await rejects(sessionPromise, assertGoogleCode('GOOGLE_OAUTH_SCOPE'));
  });

  test('official refresh that omits scope inherits a validated drive.file grant', async () => {
    const sealed = sealSyntheticBlob();
    const hits = [];
    const local = await listen((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      if (req.url === '/token') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: TOKEN_SENTINEL,
            expires_in: 3600,
            token_type: 'Bearer',
          }),
        );
        return;
      }
      if ((req.url ?? '').startsWith('/drive/v3/about')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ user: { permissionId: PERMISSION_ID } }));
        return;
      }
      if ((req.url ?? '').startsWith('/upload/')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'file-inherit', size: String(sealed.wire.byteLength) }));
        return;
      }
      res.writeHead(200, {
        'content-type': 'application/octet-stream',
        'content-length': String(sealed.wire.byteLength),
      });
      res.end(Buffer.from(sealed.wire));
    });
    try {
      const client = createOwnedOAuth2Client({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: 'http://127.0.0.1/oauth2/callback',
        timeoutMs: 2000,
        endpoints: { oauth2TokenUrl: `${local.origin}/token` },
      });
      client.setCredentials({
        access_token: 'ya29.EXPIRED_ACCESS',
        refresh_token: REFRESH_SENTINEL,
        expiry_date: Date.now() - 60_000,
        token_type: 'Bearer',
        scope: DRIVE_FILE_SCOPE_VALUE,
      });
      const originalRequest = client.transporter.request.bind(client.transporter);
      client.transporter.request = (opts) => {
        const next = { ...opts };
        const url = String(opts.url ?? '');
        if (url.startsWith(ABOUT_URL)) {
          next.url = `${local.origin}/drive/v3/about?fields=user(permissionId)`;
        } else if (url.startsWith(UPLOAD_URL)) {
          next.url = `${local.origin}/upload/drive/v3/files`;
        } else if (url.startsWith(FILES_URL)) {
          next.url = `${local.origin}/drive/v3/files/file-inherit?alt=media`;
        }
        return originalRequest(next);
      };
      const adapter = await createGoogleDriveAdapterFromAuthClient({
        permissionId: PERMISSION_ID,
        authClient: client,
      });
      const receipt = await adapter.putOwnedCiphertext(sealed.wire, sealed.sha256);
      equal(receipt.fileId, 'file-inherit');
      ok(hits.some((item) => item.includes('/token')));
    } finally {
      await closeServer(local.server);
    }
  });

  test('official refresh with an explicit unexpected scope fails before Drive', async () => {
    const sealed = sealSyntheticBlob();
    const hits = [];
    const local = await listen((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      if (req.url === '/token') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: TOKEN_SENTINEL,
            expires_in: 3600,
            token_type: 'Bearer',
            scope: DRIVE_READONLY_SCOPE,
          }),
        );
        return;
      }
      if ((req.url ?? '').startsWith('/drive/v3/about')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ user: { permissionId: PERMISSION_ID } }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"id":"should-not-create"}');
    });
    try {
      const client = createOwnedOAuth2Client({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: 'http://127.0.0.1/oauth2/callback',
        timeoutMs: 2000,
        endpoints: { oauth2TokenUrl: `${local.origin}/token` },
      });
      client.setCredentials({
        access_token: 'ya29.EXPIRED_ACCESS',
        refresh_token: REFRESH_SENTINEL,
        expiry_date: Date.now() - 60_000,
        token_type: 'Bearer',
        scope: DRIVE_FILE_SCOPE_VALUE,
      });
      const originalRequest = client.transporter.request.bind(client.transporter);
      client.transporter.request = (opts) => {
        const next = { ...opts };
        const url = String(opts.url ?? '');
        if (url.startsWith(ABOUT_URL)) {
          next.url = `${local.origin}/drive/v3/about?fields=user(permissionId)`;
        } else if (url.startsWith(UPLOAD_URL) || url.startsWith(FILES_URL)) {
          next.url = `${local.origin}/upload/drive/v3/files`;
        }
        return originalRequest(next);
      };
      await rejects(
        (async () => {
          const adapter = await createGoogleDriveAdapterFromAuthClient({
            permissionId: PERMISSION_ID,
            authClient: client,
          });
          return adapter.putOwnedCiphertext(sealed.wire, sealed.sha256);
        })(),
        (err) => err instanceof GoogleError && (err.code === 'GOOGLE_OAUTH_SCOPE' || err.code === 'GOOGLE_DRIVE_AUTH'),
      );
      equal(hits.some((item) => item.includes('/upload/')), false);
    } finally {
      await closeServer(local.server);
    }
  });
});

describe('downloaded bytes are the bytes the kernel opens', () => {
  test('owned readback is the downloaded copy, not the local input buffer', async () => {
    const sealed = sealSyntheticBlob();
    const downloaded = Buffer.from(sealed.wire);
    const adapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async (opts) => {
        const url = String(opts.url);
        if (url.startsWith(UPLOAD_URL)) {
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: utf8(JSON.stringify({ id: 'file-open', size: String(sealed.wire.byteLength) })),
          };
        }
        return {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': String(downloaded.byteLength),
          },
          body: downloaded,
        };
      },
    });
    const receipt = await adapter.putOwnedCiphertext(sealed.wire, sealed.sha256);
    equal(receipt.remoteReadbackVerified, true);
    ok(receipt.ownedReadback instanceof Uint8Array);
    equal(receipt.ownedReadback.buffer === sealed.wire.buffer, false);
    sealed.wire[0] ^= 0xff;
    const vault = UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot())), [vectorCodec()]);
    try {
      const opened = vault.openSnapshot(receipt.ownedReadback, expectedOf());
      equal(opened.content?.message, vector.inputs.payload.content.message);
    } finally {
      vault.lock();
    }
    equal(JSON.stringify(receipt).includes('ownedReadback'), false);
    const printed = `uploaded fileId=${receipt.fileId} bytes=${receipt.byteCount}`;
    equal(printed.includes(TOKEN_SENTINEL), false);
  });
});

describe('real Gaxios error objects map quota and auth without leaking bodies', () => {
  test('storageQuotaExceeded object becomes GOOGLE_DRIVE_QUOTA with one create', async () => {
    const sealed = sealSyntheticBlob();
    let creates = 0;
    const local = await listen((req, res) => {
      const url = req.url ?? '';
      if (url.startsWith('/drive/v3/about')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ user: { permissionId: PERMISSION_ID } }));
        return;
      }
      if (url.startsWith('/upload/')) {
        creates += 1;
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            error: {
              errors: [{ reason: 'storageQuotaExceeded', message: TOKEN_SENTINEL }],
              code: 403,
              message: TOKEN_SENTINEL,
            },
          }),
        );
        return;
      }
      res.writeHead(500);
      res.end('no');
    });
    try {
      const client = createOwnedOAuth2Client({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: 'http://127.0.0.1/oauth2/callback',
        timeoutMs: 2000,
        endpoints: { oauth2TokenUrl: `${local.origin}/token` },
      });
      client.setCredentials({
        access_token: TOKEN_SENTINEL,
        expiry_date: futureExpiry(),
        token_type: 'Bearer',
        scope: DRIVE_FILE_SCOPE_VALUE,
      });
      const originalRequest = client.transporter.request.bind(client.transporter);
      client.transporter.request = (opts) => {
        const next = { ...opts };
        const url = String(opts.url ?? '');
        if (url.startsWith(ABOUT_URL)) {
          next.url = `${local.origin}/drive/v3/about?fields=user(permissionId)`;
        } else if (url.startsWith(UPLOAD_URL)) {
          next.url = `${local.origin}/upload/drive/v3/files`;
        }
        return originalRequest(next);
      };
      const adapter = await createGoogleDriveAdapterFromAuthClient({
        permissionId: PERMISSION_ID,
        authClient: client,
      });
      await rejects(
        adapter.putOwnedCiphertext(sealed.wire, sealed.sha256),
        assertGoogleCode('GOOGLE_DRIVE_QUOTA'),
      );
      equal(creates, 1);
    } finally {
      await closeServer(local.server);
    }
  });

  test('401 object becomes GOOGLE_DRIVE_AUTH and 500 create is not retried', async () => {
    const sealed = sealSyntheticBlob();
    let creates = 0;
    const local = await listen((req, res) => {
      const url = req.url ?? '';
      if (url.startsWith('/drive/v3/about')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ user: { permissionId: PERMISSION_ID } }));
        return;
      }
      creates += 1;
      if (creates === 1) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 401, status: 'UNAUTHENTICATED', message: TOKEN_SENTINEL } }));
        return;
      }
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: TOKEN_SENTINEL } }));
    });
    try {
      const client = createOwnedOAuth2Client({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: 'http://127.0.0.1/oauth2/callback',
        timeoutMs: 2000,
        endpoints: { oauth2TokenUrl: `${local.origin}/token` },
      });
      client.setCredentials({
        access_token: TOKEN_SENTINEL,
        expiry_date: futureExpiry(),
        token_type: 'Bearer',
        scope: DRIVE_FILE_SCOPE_VALUE,
      });
      const originalRequest = client.transporter.request.bind(client.transporter);
      client.transporter.request = (opts) => {
        const next = { ...opts };
        const url = String(opts.url ?? '');
        if (url.startsWith(ABOUT_URL)) {
          next.url = `${local.origin}/drive/v3/about?fields=user(permissionId)`;
        } else {
          next.url = `${local.origin}/upload/drive/v3/files`;
        }
        return originalRequest(next);
      };
      const adapter = await createGoogleDriveAdapterFromAuthClient({
        permissionId: PERMISSION_ID,
        authClient: client,
      });
      await rejects(
        adapter.putOwnedCiphertext(sealed.wire, sealed.sha256),
        assertGoogleCode('GOOGLE_DRIVE_AUTH'),
      );
      equal(creates, 1);
      await rejects(
        adapter.putOwnedCiphertext(sealed.wire, sealed.sha256),
        assertGoogleCode('GOOGLE_DRIVE_INCOMPLETE'),
      );
      equal(creates, 2);
    } finally {
      await closeServer(local.server);
    }
  });
});

describe('public identity query and injected body copy bounds', () => {
  test('queryBoundPermissionId uses intrinsic bind and never leaks caller exceptions', async () => {
    let aboutCalls = 0;
    function request(opts) {
      aboutCalls += 1;
      equal(String(opts.url ?? '').startsWith(ABOUT_URL), true);
      return { status: 200, data: { user: { permissionId: PERMISSION_ID } } };
    }
    Object.defineProperty(request, 'bind', {
      get() {
        throw new Error(TOKEN_SENTINEL);
      },
    });
    const permissionId = await queryBoundPermissionId({ request });
    equal(permissionId, PERMISSION_ID);
    equal(aboutCalls, 1);

    const { proxy, revoke } = Proxy.revocable(
      {
        request() {
          throw new Error(TOKEN_SENTINEL);
        },
      },
      {},
    );
    revoke();
    await rejects(queryBoundPermissionId(proxy), (err) => {
      assertGoogleCode('GOOGLE_BIND_IDENTITY')(err);
      equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });

    const revokedFn = Proxy.revocable(request, {});
    revokedFn.revoke();
    await rejects(queryBoundPermissionId({ request: revokedFn.proxy }), (err) => {
      assertGoogleCode('GOOGLE_BIND_IDENTITY')(err);
      equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });

    const throwingCode = {
      async request() {
        const err = new Error('about failed');
        Object.defineProperty(err, 'code', {
          get() {
            throw new Error(TOKEN_SENTINEL);
          },
        });
        throw err;
      },
    };
    await rejects(queryBoundPermissionId(throwingCode), (err) => {
      assertGoogleCode('GOOGLE_BIND_IDENTITY')(err);
      equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });

    const throwingProto = {
      async request() {
        const err = new Error('about failed');
        Object.setPrototypeOf(
          err,
          new Proxy(Object.create(Error.prototype), {
            get(target, prop, receiver) {
              if (prop === 'code' || prop === 'message' || prop === 'name') {
                throw new Error(TOKEN_SENTINEL);
              }
              return Reflect.get(target, prop, receiver);
            },
          }),
        );
        throw err;
      },
    };
    await rejects(queryBoundPermissionId(throwingProto), (err) => {
      assertGoogleCode('GOOGLE_BIND_IDENTITY')(err);
      equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
      return true;
    });
  });

  test('injected body copy rejects oversize before species construction', async () => {
    const sealed = sealSyntheticBlob();
    let speciesReads = 0;
    let sliceCalls = 0;
    class HostileBytes extends Uint8Array {
      static get [Symbol.species]() {
        speciesReads += 1;
        return Uint8Array;
      }
      slice(...args) {
        sliceCalls += 1;
        return super.slice(...args);
      }
      subarray(...args) {
        sliceCalls += 1;
        return super.subarray(...args);
      }
    }

    const oversizeGet = new HostileBytes(sealed.wire.byteLength + 8);
    const getAdapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: { 'content-length': String(sealed.wire.byteLength) },
        body: oversizeGet,
      }),
    });
    await rejects(
      getOwnedCiphertext(getAdapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-oversize-copy',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      assertGoogleCode('GOOGLE_DRIVE_READBACK'),
    );
    equal(speciesReads, 0);
    equal(sliceCalls, 0);

    speciesReads = 0;
    sliceCalls = 0;
    const oversizeList = new HostileBytes(DRIVE_LIST_JSON_MAX_BYTES + 1);
    const listAdapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: {},
        body: oversizeList,
      }),
    });
    const listed = await listCiphertextCandidates(listAdapter);
    equal(listed.complete, false);
    equal(listed.reason, 'GOOGLE_DRIVE_JSON_BOUND');
    equal(speciesReads, 0);
    equal(sliceCalls, 0);

    speciesReads = 0;
    sliceCalls = 0;
    const okBody = new HostileBytes(sealed.wire);
    const okAdapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: { 'content-length': String(sealed.wire.byteLength) },
        body: okBody,
      }),
    });
    const receipt = await getOwnedCiphertext(okAdapter, {
      permissionId: PERMISSION_ID,
      fileId: 'file-species-ok',
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    });
    equal(receipt.byteCount, sealed.wire.byteLength);
    equal(speciesReads, 0);
    equal(sliceCalls, 0);
  });

  test('AuthClient media copies use the same intrinsic bound as injected bodies', async () => {
    const sealed = sealSyntheticBlob();
    let speciesReads = 0;
    class HostileBytes extends Uint8Array {
      static get [Symbol.species]() {
        speciesReads += 1;
        return Uint8Array;
      }
      get byteLength() {
        return 3;
      }
    }
    const raw = Uint8Array.from([9, 8, 7, 6]);
    const lying = new HostileBytes(raw);
    const adapter = new GoogleDriveSession(PERMISSION_ID, {
      authClient: {
        async request() {
          return { status: 200, headers: {}, data: lying };
        },
      },
    });
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-auth-lie',
        sha256: sha256Hex(Buffer.from(raw)),
        byteCount: 3,
      }),
      assertGoogleCode('GOOGLE_DRIVE_READBACK'),
    );
    equal(speciesReads, 0);

    let reads = 0;
    class FlipBytes extends Uint8Array {
      get byteLength() {
        reads += 1;
        if (reads >= 2) {
          throw new Error(TOKEN_SENTINEL);
        }
        return super.byteLength;
      }
    }
    const flipAdapter = new GoogleDriveSession(PERMISSION_ID, {
      authClient: {
        async request() {
          return { status: 200, headers: {}, data: new FlipBytes(sealed.wire) };
        },
      },
    });
    const receipt = await getOwnedCiphertext(flipAdapter, {
      permissionId: PERMISSION_ID,
      fileId: 'file-auth-flip',
      sha256: sealed.sha256,
      byteCount: sealed.wire.byteLength,
    });
    equal(receipt.byteCount, sealed.wire.byteLength);
    equal(receipt.ownedReadback.byteLength, sealed.wire.byteLength);
    equal(sha256Hex(receipt.ownedReadback), sealed.sha256);
    equal(speciesReads, 0);
    equal(inspect(receipt, { showHidden: true }).includes(TOKEN_SENTINEL), false);
  });

  test('queryBoundPermissionId rejects absent and NaN status on a custom AuthClient', async () => {
    const data = { user: { permissionId: PERMISSION_ID } };
    await rejects(
      queryBoundPermissionId({
        request: async () => ({ data }),
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    await rejects(
      queryBoundPermissionId({
        request: async () => ({ status: Number.NaN, data }),
      }),
      assertGoogleCode('GOOGLE_BIND_IDENTITY'),
    );
    const permissionId = await queryBoundPermissionId({
      request: async () => ({ status: 200, data }),
    });
    equal(permissionId, PERMISSION_ID);
  });

  test('AuthClient listing rejects accessors, proxies, and custom toJSON without executing them', async () => {
    const wppName = (seed) => `${sha256Hex(utf8(String(seed)))}.wpp`;
    const file = {
      id: 'file_security_list',
      name: wppName('security-list'),
      size: '8',
    };
    const first = {
      id: 'file_security_kept',
      name: wppName('security-kept'),
      size: '10',
    };

    let getterReads = 0;
    const getterData = { files: [file] };
    Object.defineProperty(getterData, 'nextPageToken', {
      configurable: true,
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error(TOKEN_SENTINEL);
      },
    });
    const getterAdapter = new GoogleDriveSession(PERMISSION_ID, {
      authClient: {
        async request() {
          return { status: 200, data: getterData };
        },
      },
    });
    const getterListed = await listCiphertextCandidates(getterAdapter);
    equal(getterListed.complete, false);
    equal(getterListed.candidates.length, 0);
    equal(getterReads, 0);

    let toJsonCalls = 0;
    const toJsonData = { files: [file], nextPageToken: 'secret' };
    Object.defineProperty(toJsonData, 'toJSON', {
      value() {
        toJsonCalls += 1;
        return { files: [file] };
      },
    });
    const toJsonAdapter = new GoogleDriveSession(PERMISSION_ID, {
      authClient: {
        async request() {
          return { status: 200, data: toJsonData };
        },
      },
    });
    const toJsonListed = await listCiphertextCandidates(toJsonAdapter);
    equal(toJsonListed.complete, false);
    equal(toJsonListed.candidates.length, 0);
    equal(toJsonCalls, 0);

    const throwing = new Proxy(
      { files: [file] },
      {
        get() {
          throw new Error(TOKEN_SENTINEL);
        },
        getOwnPropertyDescriptor() {
          throw new Error(TOKEN_SENTINEL);
        },
        ownKeys() {
          throw new Error(TOKEN_SENTINEL);
        },
      },
    );
    const proxyAdapter = new GoogleDriveSession(PERMISSION_ID, {
      authClient: {
        async request() {
          return { status: 200, data: throwing };
        },
      },
    });
    const proxyListed = await listCiphertextCandidates(proxyAdapter);
    equal(proxyListed.complete, false);
    equal(proxyListed.candidates.length, 0);
    equal(inspect(proxyListed, { showHidden: true }).includes(TOKEN_SENTINEL), false);

    const nested = Proxy.revocable(file, {});
    nested.revoke();
    let page = 0;
    const laterAdapter = new GoogleDriveSession(PERMISSION_ID, {
      authClient: {
        async request() {
          page += 1;
          if (page === 1) {
            return { status: 200, data: { files: [first], nextPageToken: 'sec-next' } };
          }
          return { status: 200, data: { files: [nested.proxy] } };
        },
      },
    });
    const laterListed = await listCiphertextCandidates(laterAdapter);
    equal(laterListed.complete, false);
    equal(laterListed.candidates.length, 1);
    equal(laterListed.candidates[0].fileId, first.id);
    equal(page, 2);
  });

  test('detached injected bodies are rejected without leaking caller data', async () => {
    const sealed = sealSyntheticBlob();
    const body = new Uint8Array(sealed.wire);
    structuredClone(body.buffer, { transfer: [body.buffer] });
    const adapter = createGoogleDriveAdapter({
      permissionId: PERMISSION_ID,
      request: async () => ({
        status: 200,
        headers: { 'content-length': String(sealed.wire.byteLength) },
        body,
      }),
    });
    await rejects(
      getOwnedCiphertext(adapter, {
        permissionId: PERMISSION_ID,
        fileId: 'file-detached',
        sha256: sealed.sha256,
        byteCount: sealed.wire.byteLength,
      }),
      (err) => {
        assertGoogleCode('GOOGLE_DRIVE_READBACK')(err);
        equal(inspect(err, { showHidden: true }).includes(TOKEN_SENTINEL), false);
        return true;
      },
    );
  });
});

describe('publisher apply uses exact argv and never mutates a real gcloud', () => {
  test('authenticated apply creates a missing project then enables Drive', async () => {
    const calls = [];
    const result = await runGoogleProjectSetup({
      projectId: 'wpp-google-beta-1',
      apply: true,
      runGcloud: async (args) => {
        calls.push([...args]);
        if (args[0] === 'auth' && args[1] === 'list') {
          return { code: 0, stdout: 'publisher@example.com\n', stderr: '' };
        }
        if (args[0] === 'projects' && args[1] === 'describe') {
          return { code: 1, stdout: '', stderr: 'NOT_FOUND' };
        }
        if (args[0] === 'projects' && args[1] === 'create') {
          return { code: 0, stdout: '', stderr: '' };
        }
        if (args[0] === 'services' && args[1] === 'enable') {
          return { code: 0, stdout: '', stderr: '' };
        }
        throw new Error(args.join(' '));
      },
    });
    equal(result.mode, 'apply');
    equal(result.projectId, 'wpp-google-beta-1');
    deepEqual(calls[0], ['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)']);
    deepEqual(calls[1], ['projects', 'describe', 'wpp-google-beta-1', '--format=value(projectId)']);
    deepEqual(calls[2], ['projects', 'create', 'wpp-google-beta-1', '--name=Witness Protection Program']);
    deepEqual(calls[3], ['services', 'enable', 'drive.googleapis.com', '--project=wpp-google-beta-1']);
    equal(calls.length, 4);
  });

  test('authenticated apply reuses the existing requested project id', async () => {
    const calls = [];
    const result = await runGoogleProjectSetup({
      projectId: 'wpp-google-beta-1',
      apply: true,
      runGcloud: async (args) => {
        calls.push([...args]);
        if (args[0] === 'auth') {
          return { code: 0, stdout: 'publisher@example.com\n', stderr: '' };
        }
        if (args[0] === 'projects' && args[1] === 'describe') {
          return { code: 0, stdout: 'wpp-google-beta-1\n', stderr: '' };
        }
        if (args[0] === 'services') {
          return { code: 0, stdout: '', stderr: '' };
        }
        throw new Error(args.join(' '));
      },
    });
    equal(result.mode, 'apply');
    equal(
      calls.some((args) => args.includes('create')),
      false,
    );
    deepEqual(calls[2], ['services', 'enable', 'drive.googleapis.com', '--project=wpp-google-beta-1']);
  });

  test('dry-run remains read-only', async () => {
    const calls = [];
    const result = await runGoogleProjectSetup({
      projectId: 'wpp-google-beta-1',
      apply: false,
      runGcloud: async (args) => {
        calls.push(args);
        return { code: 0, stdout: '', stderr: '' };
      },
    });
    equal(result.mode, 'dry-run');
    equal(calls.length, 0);
  });
});

async function withFakeBrowserOpener(script, fn) {
  const dir = join(tmpdir(), `wpp-browser-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'xdg-open'), script, { mode: 0o755 });
  writeFileSync(join(dir, 'wslview'), script, { mode: 0o755 });
  chmodSync(join(dir, 'xdg-open'), 0o755);
  chmodSync(join(dir, 'wslview'), 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${dir}:${previousPath ?? ''}`;
  try {
    return await fn(dir);
  } finally {
    process.env.PATH = previousPath;
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('browser opener does not kill a long-lived foreground process', () => {
  test('spawned opener is detached and the helper keeps running', async () => {
    const dir = join(tmpdir(), `wpp-browser-${process.pid}-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const marker = join(dir, 'pid');
    const script = `#!/bin/sh
echo $$ > "${marker}"
sleep 8
`;
    writeFileSync(join(dir, 'xdg-open'), script, { mode: 0o755 });
    writeFileSync(join(dir, 'wslview'), script, { mode: 0o755 });
    chmodSync(join(dir, 'xdg-open'), 0o755);
    chmodSync(join(dir, 'wslview'), 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${dir}:${previousPath ?? ''}`;
    const started = Date.now();
    try {
      await launchSystemBrowser('http://127.0.0.1/oauth2/callback');
      ok(Date.now() - started < 2000);
      const pidText = readFileSync(marker, 'utf8').trim();
      const pid = Number(pidText);
      ok(Number.isInteger(pid) && pid > 0);
      process.kill(pid, 0);
      process.kill(pid, 'SIGTERM');
    } finally {
      process.env.PATH = previousPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('browser opener fails closed before the launch window', () => {
  test('rejects GOOGLE_OAUTH_BROWSER when the opener exits nonzero', async () => {
    const script = `#!/bin/sh
exit 3
`;
    await withFakeBrowserOpener(script, async () => {
      const started = Date.now();
      await rejects(
        () => launchSystemBrowser('http://127.0.0.1/oauth2/callback'),
        assertGoogleCode('GOOGLE_OAUTH_BROWSER'),
      );
      ok(Date.now() - started < 2000);
    });
  });

  test('rejects GOOGLE_OAUTH_BROWSER when the opener exits by signal', async () => {
    const script = `#!/bin/sh
kill -s TERM $$
`;
    await withFakeBrowserOpener(script, async () => {
      const started = Date.now();
      await rejects(
        () => launchSystemBrowser('http://127.0.0.1/oauth2/callback'),
        assertGoogleCode('GOOGLE_OAUTH_BROWSER'),
      );
      ok(Date.now() - started < 2000);
    });
  });

  test('resolves when the opener exits successfully before the launch window', async () => {
    const script = `#!/bin/sh
exit 0
`;
    await withFakeBrowserOpener(script, async () => {
      const started = Date.now();
      await launchSystemBrowser('http://127.0.0.1/oauth2/callback');
      ok(Date.now() - started < 2000);
    });
  });
});
