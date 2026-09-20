import { deepEqual, equal, match, ok } from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import canonicalize from 'canonicalize';

import { UnlockedVault } from '../../dist/kernel/index.js';
import { aeadDecrypt, aeadEncrypt, deriveKeys } from '../../dist/kernel/crypto.js';
import {
  NATIVE_CODEC_ID,
  NATIVE_PRODUCER_PACKAGE,
  NATIVE_PRODUCER_VERSION,
  NATIVE_SOURCE_COMMIT,
  OwnedNativeProvider,
} from '../../dist/native/index.js';

export const STORAGE_PASSWORD = 'Wpp-Store-Key9!Vault';
export const ACCOUNT_ID = 'wpp-synthetic-account';
export const CONTRACT_ADDRESS = '11'.repeat(32);
export const STATE_ALPHA = 'alpha';
export const STATE_BETA = 'beta';
export const COUNTER = 12345678901234567890n;
export const SECRET = Uint8Array.from({ length: 32 }, (_, i) => i);
export const BLOB = Buffer.from('wpp-native-buffer');
export const SECRET_MARKER = 'WPP_TEST_SECRET_MARKER_c0ffee91';

const utf8 = (text) => Buffer.from(text, 'utf8');
const b64 = (bytes) => Buffer.from(bytes).toString('base64url');

export { utf8, b64 };

export function typedState(overrides = {}) {
  return {
    counter: COUNTER,
    secretKey: Uint8Array.from(SECRET),
    blob: Buffer.from(BLOB),
    ...overrides,
  };
}

export function assertTypedState(got, expected = typedState()) {
  equal(typeof got.counter, 'bigint');
  equal(got.counter, expected.counter);
  ok(got.secretKey instanceof Uint8Array);
  equal(got.secretKey.length, expected.secretKey.length);
  deepEqual([...got.secretKey], [...expected.secretKey]);
  ok(Buffer.isBuffer(got.blob));
  equal(got.blob.toString('hex'), expected.blob.toString('hex'));
}

export function nativeCodec() {
  return {
    id: NATIVE_CODEC_ID,
    version: 1,
    producerPackage: NATIVE_PRODUCER_PACKAGE,
    producerVersion: NATIVE_PRODUCER_VERSION,
    sourceCommit: NATIVE_SOURCE_COMMIT,
  };
}

export function nativeMetadata(stateIds = [STATE_ALPHA, STATE_BETA], overrides = {}) {
  return {
    network: { id: 'synthetic-local', genesisHash: null },
    accountBinding: { scheme: 'synthetic-account', value: ACCOUNT_ID },
    applicationId: 'wpp-native-test',
    contract: { address: CONTRACT_ADDRESS, codeHash: null },
    privateStateIds: [...stateIds],
    codec: nativeCodec(),
    capturedAt: '2026-09-19T00:00:00Z',
    lifecycle: { status: 'unassociated', transactionId: null, blockHash: null },
    parents: [],
    retentionClass: 'irreplaceable-private-state',
    ...overrides,
  };
}

export function expectedOf(meta, scopeId, recordId) {
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

export function randomRoot() {
  return {
    format: 'wpp-root-record',
    version: 1,
    revisionId: b64(crypto.randomBytes(32)),
    parents: [],
    vaultId: b64(crypto.randomBytes(16)),
    vaultSalt: b64(crypto.randomBytes(32)),
    catalogScopeId: b64(crypto.randomBytes(32)),
    catalogRecordId: b64(crypto.randomBytes(32)),
    epochs: [
      {
        rootEpoch: b64(crypto.randomBytes(16)),
        secretRoot: b64(crypto.randomBytes(32)),
        createdAt: '2026-09-19T00:00:00Z',
        status: 'active',
      },
    ],
  };
}

export function nativeSession() {
  const root = randomRoot();
  const rootUtf8 = Uint8Array.from(utf8(JSON.stringify(root)));
  const vault = UnlockedVault.fromRootRecord(rootUtf8, []);
  return {
    root,
    rootUtf8,
    vault,
    scopeId: b64(crypto.randomBytes(32)),
    recordId: b64(crypto.randomBytes(32)),
    secretRoot: Buffer.from(root.epochs[0].secretRoot, 'base64url'),
  };
}

export async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'wpp-native-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function withSourceProvider(fn, options = {}) {
  return withTempDir(async (dir) => {
    const passwordProvider =
      options.passwordProvider ??
      (() => STORAGE_PASSWORD);
    const provider = new OwnedNativeProvider({
      accountId: options.accountId ?? ACCOUNT_ID,
      contractAddress: options.contractAddress ?? CONTRACT_ADDRESS,
      privateStoragePasswordProvider: passwordProvider,
      midnightDbName: join(dir, 'db'),
    });
    try {
      return await fn(provider, dir);
    } finally {
      try {
        await provider.invalidateEncryptionCache();
      } catch {
        undefined;
      }
      try {
        await provider.drain();
      } catch {
        undefined;
      }
    }
  });
}

export async function seedTwoStates(provider) {
  await provider.set(STATE_ALPHA, typedState());
  await provider.set(STATE_BETA, typedState({ counter: 7n, blob: Buffer.from('beta-buffer') }));
}

export function assertPublicError(err) {
  ok(err instanceof Error);
  const text = `${err.name}\n${err.message}\n${err.code ?? ''}\n${err.stack ?? ''}`;
  equal(text.includes(SECRET_MARKER), false);
  match(String(err.message), /^WPP_[A-Z0-9_]+$/);
  match(String(err.code ?? err.message), /^WPP_[A-Z0-9_]+$/);
  return true;
}

export function assertCode(code) {
  return (err) => {
    assertPublicError(err);
    equal(err.code, code);
    equal(err.message, code);
    return true;
  };
}

export function decryptNativePackage(secretRoot, wire) {
  const parsed = JSON.parse(Buffer.from(wire).toString('utf8'));
  const keys = deriveKeys(secretRoot, parsed.header);
  try {
    const nonce = Buffer.from(parsed.header.nonce, 'base64url');
    const tag = Buffer.from(parsed.tag, 'base64url');
    const ciphertext = Buffer.from(parsed.ciphertext, 'base64url');
    const aad = Buffer.from(canonicalize(parsed.header), 'utf8');
    const plaintext = aeadDecrypt(keys.objectKey, nonce, aad, ciphertext, tag);
    const payload = JSON.parse(Buffer.from(plaintext).toString('utf8'));
    return { header: parsed.header, payload, keys, nativeExportPassword: keys.nativeExportPassword };
  } finally {
    keys.prk.fill(0);
    keys.scopeKey.fill(0);
    keys.objectKey.fill(0);
    keys.nativeKey.fill(0);
  }
}

export function forgeNativeWire(root, scopeId, recordId, metadata, content, options = {}) {
  const epoch = root.epochs[0];
  const generation = options.generation ?? crypto.randomBytes(32);
  const nonce = options.nonce ?? crypto.randomBytes(12);
  const header = {
    format: 'wpp-witness-package',
    version: 1,
    suite: 'HKDF-SHA256+A256GCM',
    vaultId: root.vaultId,
    vaultSalt: root.vaultSalt,
    rootEpoch: epoch.rootEpoch,
    scopeId,
    recordId,
    generationId: b64(generation),
    kind: options.kind ?? 'snapshot',
    nonce: b64(nonce),
  };
  const payload = {
    payloadVersion: 1,
    metadata,
    content,
  };
  const secretRoot = Buffer.from(epoch.secretRoot, 'base64url');
  const keys = deriveKeys(secretRoot, header);
  try {
    const plaintext = Buffer.from(canonicalize(payload), 'utf8');
    const aad = Buffer.from(canonicalize(header), 'utf8');
    const sealed = aeadEncrypt(keys.objectKey, nonce, aad, plaintext);
    const wireObject = {
      header,
      ciphertext: Buffer.from(sealed.ciphertext).toString('base64url'),
      tag: Buffer.from(sealed.tag).toString('base64url'),
    };
    return {
      header,
      wire: Buffer.from(canonicalize(wireObject), 'utf8'),
      nativeExportPassword: keys.nativeExportPassword,
    };
  } finally {
    keys.prk.fill(0);
    keys.scopeKey.fill(0);
    keys.objectKey.fill(0);
    keys.nativeKey.fill(0);
  }
}
