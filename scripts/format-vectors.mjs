/**
 * WPP draft-v1 synthetic encryption interoperability fixture encoder.
 *
 * This is a deliberately restricted M0 fixture generator, not a production
 * package parser, general JCS library, or security-approved kernel.
 *
 * Narrow canonicalization domain (canonicalFixture):
 * - printable ASCII strings and object keys (U+0020..U+007E)
 * - booleans, null, and safe integers except negative zero
 * - dense arrays (original order retained; no enumerable keys other than
 *   the canonical decimal spellings of indices 0 through length-1; no
 *   symbol keys)
 * - plain objects whose prototype is Object.prototype (own enumerable
 *   string keys, recursively sorted lexicographically as ASCII strings)
 *
 * Encoding assembles JSON text. It does not clone into an object and then
 * call JSON.stringify, so integer-looking keys keep lexicographic order
 * and __proto__ remains an ordinary key.
 *
 * Unsupported values are rejected rather than silently dropped:
 * non-ASCII or control strings/keys, unsafe/fractional/nonfinite numbers,
 * negative zero, undefined, symbol values, symbol keys, function, bigint,
 * Buffer, Date, sparse arrays, custom enumerable array keys, Object.create(null),
 * and other non-plain objects.
 *
 * All fixed fixture values in this generator are inside this domain, where
 * the encoding agrees with JCS. This module makes no general RFC 8785
 * compliance claim.
 *
 * Deterministic inputs below are PUBLIC SYNTHETIC TEST DATA. Never use
 * these keys, salts, or identities in a real application.
 */

import { createCipheriv, createHash, createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PRINTABLE_ASCII_MIN = 0x20;
const PRINTABLE_ASCII_MAX = 0x7e;

function isPrintableAscii(value) {
  if (typeof value !== 'string') {
    return false;
  }
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < PRINTABLE_ASCII_MIN || code > PRINTABLE_ASCII_MAX) {
      return false;
    }
  }
  return true;
}

function reject(message) {
  throw new TypeError(message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (Buffer.isBuffer(value)) {
    return false;
  }
  return Object.getPrototypeOf(value) === Object.prototype;
}

function encodeCanonical(value) {
  if (value === null) {
    return JSON.stringify(value);
  }

  const valueType = typeof value;
  if (valueType === 'boolean') {
    return JSON.stringify(value);
  }
  if (valueType === 'number') {
    if (Object.is(value, -0)) {
      reject('canonicalFixture rejects negative zero');
    }
    if (!Number.isSafeInteger(value)) {
      reject('canonicalFixture rejects unsafe, fractional, or nonfinite numbers');
    }
    return JSON.stringify(value);
  }
  if (valueType === 'string') {
    if (!isPrintableAscii(value)) {
      reject('canonicalFixture rejects non-ASCII or control strings');
    }
    return JSON.stringify(value);
  }
  if (
    valueType === 'undefined' ||
    valueType === 'symbol' ||
    valueType === 'function' ||
    valueType === 'bigint'
  ) {
    reject(`canonicalFixture rejects ${valueType}`);
  }
  if (valueType !== 'object') {
    reject(`canonicalFixture rejects ${valueType}`);
  }

  if (Buffer.isBuffer(value)) {
    reject('canonicalFixture rejects Buffer');
  }
  if (Array.isArray(value)) {
    if (Object.getOwnPropertySymbols(value).length > 0) {
      reject('canonicalFixture rejects symbol keys');
    }
    for (let i = 0; i < value.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, i)) {
        reject('canonicalFixture rejects sparse arrays');
      }
    }
    for (const key of Object.keys(value)) {
      const index = Number(key);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= value.length ||
        String(index) !== key
      ) {
        reject('canonicalFixture rejects custom enumerable array properties');
      }
    }
    const encodedEntries = [];
    for (let i = 0; i < value.length; i += 1) {
      encodedEntries.push(encodeCanonical(value[i]));
    }
    return `[${encodedEntries.join(',')}]`;
  }
  if (!isPlainObject(value)) {
    reject('canonicalFixture rejects Date and other non-plain objects');
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    reject('canonicalFixture rejects symbol keys');
  }

  const keys = Object.keys(value);
  for (const key of keys) {
    if (!isPrintableAscii(key)) {
      reject('canonicalFixture rejects non-ASCII or control object keys');
    }
  }
  keys.sort();

  const encodedMembers = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    const entry = descriptor === undefined ? undefined : descriptor.value;
    if (entry === undefined) {
      reject('canonicalFixture rejects undefined object values');
    }
    encodedMembers.push(`${JSON.stringify(key)}:${encodeCanonical(entry)}`);
  }
  return `{${encodedMembers.join(',')}}`;
}

/**
 * Compact JSON canonicalization for the restricted fixture domain.
 * Object keys are sorted recursively as ASCII strings; arrays keep original
 * order. Primitives use JSON.stringify. Arrays and objects are assembled as
 * JSON text. Not a general JCS library.
 */
export function canonicalFixture(value) {
  return encodeCanonical(value);
}

/**
 * One RFC 5869 HKDF-Expand block for L=32 (HMAC-SHA256).
 * HMAC-SHA256(parent, info || 0x01). Do not use hkdfSync here: it would
 * Extract again at child levels.
 */
export function hkdfExpand32(parentKeyBuffer, infoBuffer) {
  if (!Buffer.isBuffer(parentKeyBuffer) || parentKeyBuffer.length !== 32) {
    reject('hkdfExpand32 requires a 32-byte Buffer parent key');
  }
  if (!Buffer.isBuffer(infoBuffer)) {
    reject('hkdfExpand32 requires a Buffer info value');
  }
  return createHmac('sha256', parentKeyBuffer)
    .update(infoBuffer)
    .update(Buffer.from([0x01]))
    .digest();
}

function bytes(start, length) {
  const buffer = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) {
    buffer[i] = start + i;
  }
  return buffer;
}

function utf8(value) {
  return Buffer.from(value, 'utf8');
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function hex(buffer) {
  return buffer.toString('hex');
}

function b64url(buffer) {
  return buffer.toString('base64url');
}

/**
 * Deterministic public synthetic vector. Never use these keys in production.
 *
 * Payload metadata illustrates a proposed WPP fixture. It is not a frozen
 * catalog schema and not a native Midnight export. The all-zero source pin
 * and synthetic identities are fictional, not compatibility evidence.
 */
export function buildVector() {
  const secretRoot = bytes(0, 32);
  const vaultSalt = bytes(32, 32);
  const vaultId = bytes(64, 16);
  const rootEpoch = bytes(80, 16);
  const scopeId = bytes(96, 32);
  const recordId = bytes(128, 32);
  const generationId = bytes(160, 32);
  const nonce = bytes(192, 12);

  const header = {
    format: 'wpp-witness-package',
    version: 1,
    suite: 'HKDF-SHA256+A256GCM',
    vaultId: b64url(vaultId),
    vaultSalt: b64url(vaultSalt),
    rootEpoch: b64url(rootEpoch),
    scopeId: b64url(scopeId),
    recordId: b64url(recordId),
    generationId: b64url(generationId),
    kind: 'snapshot',
    nonce: b64url(nonce),
  };

  const payload = {
    payloadVersion: 1,
    metadata: {
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
    },
    content: {
      counter: '12345678901234567890',
      bytes: 'AAECAw',
      message: 'PUBLIC SYNTHETIC TEST DATA',
    },
  };

  const prk = createHmac('sha256', vaultSalt).update(secretRoot).digest();
  const scopeKey = hkdfExpand32(
    prk,
    utf8(canonicalFixture(['WPP', '1', 'scope', header.vaultId, header.rootEpoch, header.scopeId])),
  );
  const objectKey = hkdfExpand32(
    scopeKey,
    utf8(canonicalFixture(['WPP', '1', 'object', header.kind, header.recordId, header.generationId])),
  );
  const nativeKey = hkdfExpand32(
    scopeKey,
    utf8(
      canonicalFixture(['WPP', '1', 'native-export-password', header.recordId, header.generationId]),
    ),
  );
  const nativeExportPassword = b64url(nativeKey);

  const headerUtf8 = canonicalFixture(header);
  const payloadUtf8 = canonicalFixture(payload);
  const aad = utf8(headerUtf8);
  const plaintext = utf8(payloadUtf8);

  const cipher = createCipheriv('aes-256-gcm', objectKey, nonce, { authTagLength: 16 });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const wire = {
    header,
    ciphertext: b64url(ciphertext),
    tag: b64url(tag),
  };
  const wireUtf8 = canonicalFixture(wire);
  const wireSha256 = sha256Hex(wireUtf8);

  return {
    profile: 'wpp-draft-v1-synthetic-vector',
    inputs: {
      secretRootHex: hex(secretRoot),
      header,
      payload,
    },
    expected: {
      prkHex: hex(prk),
      scopeKeyHex: hex(scopeKey),
      objectKeyHex: hex(objectKey),
      nativeKeyHex: hex(nativeKey),
      nativeExportPassword,
      headerUtf8,
      headerHex: hex(utf8(headerUtf8)),
      payloadUtf8,
      payloadHex: hex(utf8(payloadUtf8)),
      ciphertextHex: hex(ciphertext),
      tagHex: hex(tag),
      wireUtf8,
      wireSha256,
    },
  };
}

function isExecutedAsCli() {
  if (process.argv[1] === undefined) {
    return false;
  }
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isExecutedAsCli()) {
  process.stdout.write(`${JSON.stringify(buildVector(), null, 2)}\n`);
}
