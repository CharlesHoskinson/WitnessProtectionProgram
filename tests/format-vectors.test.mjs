import { createDecipheriv, createHash, createHmac } from 'node:crypto';
import { deepEqual, equal, match, notEqual, ok, throws } from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildVector, canonicalFixture, hkdfExpand32 } from '../scripts/format-vectors.mjs';

const SYNTHETIC_PROFILE = 'wpp-draft-v1-synthetic-vector';
const HEADER_KEYS = [
  'format',
  'generationId',
  'kind',
  'nonce',
  'recordId',
  'rootEpoch',
  'scopeId',
  'suite',
  'vaultId',
  'vaultSalt',
  'version',
];
const WIRE_KEYS = ['ciphertext', 'header', 'tag'];

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function assertLowerHex(name, value, byteLength) {
  equal(typeof value, 'string', `${name} must be a string`);
  match(value, /^[0-9a-f]+$/, `${name} must be lowercase hex`);
  equal(value.length, byteLength * 2, `${name} must encode ${byteLength} bytes`);
}

function decodeBase64Url(value, name) {
  equal(typeof value, 'string', `${name} must be a string`);
  match(value, /^[A-Za-z0-9_-]+$/, `${name} must be unpadded base64url`);
  const padLength = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
}

function encodeBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function hmacSha256(key, message) {
  return createHmac('sha256', key).update(message).digest();
}

function expand32Independent(parentKey, info) {
  return hmacSha256(parentKey, Buffer.concat([info, Buffer.from([0x01])]));
}

function flipByte(buffer, index = 0) {
  const copy = Buffer.from(buffer);
  copy[index] ^= 0xff;
  return copy;
}

function gcmDecrypt(key, nonce, aad, ciphertext, tag) {
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

describe('canonicalFixture', () => {
  test('recursively sorts plain-object keys, keeps array order, and emits compact JSON', () => {
    const nested = {
      z: 1,
      a: {
        d: true,
        b: [{ y: 2, x: 1 }, 'ok'],
        c: null,
      },
      m: false,
    };

    equal(
      canonicalFixture(nested),
      '{"a":{"b":[{"x":1,"y":2},"ok"],"c":null,"d":true},"m":false,"z":1}',
    );
    equal(canonicalFixture([2, { b: 1, a: 0 }, 1]), '[2,{"a":0,"b":1},1]');
    equal(canonicalFixture({ b: [2, 1], a: 0 }), '{"a":0,"b":[2,1]}');
    equal(canonicalFixture({}), '{}');
    equal(canonicalFixture([]), '[]');
    equal(canonicalFixture({ '2': 'two', '10': 'ten' }), '{"10":"ten","2":"two"}');
    equal(
      canonicalFixture({ z: { '2': 'two', '10': 'ten' }, a: 1 }),
      '{"a":1,"z":{"10":"ten","2":"two"}}',
    );
    equal(
      canonicalFixture(JSON.parse('{"__proto__":{"a":1},"z":2}')),
      '{"__proto__":{"a":1},"z":2}',
    );
  });

  test('supports printable ASCII strings, null, booleans, and safe integers except -0', () => {
    equal(canonicalFixture('ASCII 0-9 A-Z a-z space and punctuation: ~!@#'), '"ASCII 0-9 A-Z a-z space and punctuation: ~!@#"');
    equal(canonicalFixture(''), '""');
    equal(canonicalFixture(null), 'null');
    equal(canonicalFixture(true), 'true');
    equal(canonicalFixture(false), 'false');
    equal(canonicalFixture(0), '0');
    equal(canonicalFixture(1), '1');
    equal(canonicalFixture(-1), '-1');
    equal(canonicalFixture(Number.MAX_SAFE_INTEGER), String(Number.MAX_SAFE_INTEGER));
    equal(canonicalFixture(Number.MIN_SAFE_INTEGER), String(Number.MIN_SAFE_INTEGER));
    equal(
      canonicalFixture({ k: 'plain', n: 0, t: true, f: false, z: null }),
      '{"f":false,"k":"plain","n":0,"t":true,"z":null}',
    );
  });

  test('rejects non-ASCII strings and keys, bad numbers, undefined, and non-plain objects', () => {
    throws(() => canonicalFixture('café'));
    throws(() => canonicalFixture('naïve'));
    throws(() => canonicalFixture('hello\u00a0'));
    throws(() => canonicalFixture('line\nbreak'));
    throws(() => canonicalFixture('tab\tchar'));
    throws(() => canonicalFixture({ naïve: 1 }));
    throws(() => canonicalFixture({ café: 'x' }));
    throws(() => canonicalFixture({ '\u00e9': 1 }));
    throws(() => canonicalFixture(1.5));
    throws(() => canonicalFixture({ a: 1.5 }));
    throws(() => canonicalFixture(NaN));
    throws(() => canonicalFixture(Infinity));
    throws(() => canonicalFixture(-Infinity));
    throws(() => canonicalFixture(Number.MAX_SAFE_INTEGER + 1));
    throws(() => canonicalFixture(-0));
    throws(() => canonicalFixture({ a: -0 }));
    throws(() => canonicalFixture(undefined));
    throws(() => canonicalFixture({ a: undefined }));
    throws(() => canonicalFixture([undefined]));
    throws(() => canonicalFixture(Buffer.alloc(1)));
    throws(() => canonicalFixture({ buf: Buffer.from('x') }));
    throws(() => canonicalFixture(new Date('2020-01-01T00:00:00.000Z')));
    throws(() => canonicalFixture({ when: new Date(0) }));
    throws(() => canonicalFixture(Object.create(null)));
    throws(() => canonicalFixture(new Map()));
    throws(() => canonicalFixture(() => 1));
    const sparse = [1, 2];
    delete sparse[1];
    throws(() => canonicalFixture(sparse));
    const arrayWithSymbol = [1];
    arrayWithSymbol[Symbol('k')] = 1;
    throws(() => canonicalFixture(arrayWithSymbol));
    const objectWithSymbol = { a: 1 };
    objectWithSymbol[Symbol('k')] = 1;
    throws(() => canonicalFixture(objectWithSymbol));
    const arrayWithCustom = [1];
    arrayWithCustom.extra = 1;
    throws(() => canonicalFixture(arrayWithCustom));
  });

  test('rejects custom enumerable array keys independently of index enumerability', () => {
    equal(canonicalFixture([1]), '[1]');
    equal(canonicalFixture([1, 2, 3]), '[1,2,3]');

    const hiddenIndexWithCustom = [1];
    Object.defineProperty(hiddenIndexWithCustom, '0', { enumerable: false });
    hiddenIndexWithCustom.extra = undefined;
    throws(() => canonicalFixture(hiddenIndexWithCustom), TypeError);

    const leadingZeroIndex = [1];
    leadingZeroIndex['01'] = 1;
    throws(() => canonicalFixture(leadingZeroIndex), TypeError);
  });
});

describe('hkdfExpand32', () => {
  test('matches RFC 5869 test case 1 Expand first 32 bytes and rejects other parent lengths', () => {
    // RFC 5869 Appendix A.1 Expand only. This is not Extract+Expand.
    const prk = Buffer.from(
      '077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5',
      'hex',
    );
    const info = Buffer.from('f0f1f2f3f4f5f6f7f8f9', 'hex');
    const okm = hkdfExpand32(prk, info);

    ok(Buffer.isBuffer(okm));
    equal(okm.length, 32);
    equal(okm.toString('hex'), '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf');

    throws(() => hkdfExpand32(Buffer.alloc(0), info));
    throws(() => hkdfExpand32(Buffer.alloc(31), info));
    throws(() => hkdfExpand32(Buffer.alloc(33), info));
  });
});

describe('buildVector', () => {
  test('is deterministic, synthetic-labelled, and uses 32/12/16 key, nonce, and tag sizes', () => {
    const first = buildVector();
    const second = buildVector();
    deepEqual(first, second);

    equal(first.profile, SYNTHETIC_PROFILE);
    match(first.profile, /synthetic/);

    const { inputs, expected } = first;
    ok(inputs);
    ok(expected);
    equal(typeof inputs.secretRootHex, 'string');
    ok(inputs.header);
    assertLowerHex('secretRootHex', inputs.secretRootHex, 32);
    assertLowerHex('prkHex', expected.prkHex, 32);
    assertLowerHex('scopeKeyHex', expected.scopeKeyHex, 32);
    assertLowerHex('objectKeyHex', expected.objectKeyHex, 32);
    assertLowerHex('nativeKeyHex', expected.nativeKeyHex, 32);
    assertLowerHex('headerHex', expected.headerHex, Buffer.from(expected.headerUtf8, 'utf8').length);
    assertLowerHex('payloadHex', expected.payloadHex, Buffer.from(expected.payloadUtf8, 'utf8').length);
    assertLowerHex('ciphertextHex', expected.ciphertextHex, Buffer.from(expected.ciphertextHex, 'hex').length);
    assertLowerHex('tagHex', expected.tagHex, 16);
    assertLowerHex('wireSha256', expected.wireSha256, 32);

    equal(decodeBase64Url(inputs.header.nonce, 'header.nonce').length, 12);
    equal(Buffer.from(expected.tagHex, 'hex').length, 16);

    const nativeKey = Buffer.from(expected.nativeKeyHex, 'hex');
    equal(expected.nativeExportPassword, encodeBase64Url(nativeKey));
    deepEqual(decodeBase64Url(expected.nativeExportPassword, 'nativeExportPassword'), nativeKey);
  });

  test('recomputes PRK, scope, object, and native keys from header fields with independent HMAC-SHA256', () => {
    const vector = buildVector();
    const { header } = vector.inputs;
    const secretRoot = Buffer.from(vector.inputs.secretRootHex, 'hex');
    const vaultSalt = decodeBase64Url(header.vaultSalt, 'header.vaultSalt');

    const prk = hmacSha256(vaultSalt, secretRoot);
    const scopeInfo = Buffer.from(
      JSON.stringify(['WPP', '1', 'scope', header.vaultId, header.rootEpoch, header.scopeId]),
      'utf8',
    );
    const objectInfo = Buffer.from(
      JSON.stringify(['WPP', '1', 'object', header.kind, header.recordId, header.generationId]),
      'utf8',
    );
    const nativeInfo = Buffer.from(
      JSON.stringify(['WPP', '1', 'native-export-password', header.recordId, header.generationId]),
      'utf8',
    );

    const scopeKey = expand32Independent(prk, scopeInfo);
    const objectKey = expand32Independent(scopeKey, objectInfo);
    const nativeKey = expand32Independent(scopeKey, nativeInfo);

    equal(prk.toString('hex'), vector.expected.prkHex);
    equal(scopeKey.toString('hex'), vector.expected.scopeKeyHex);
    equal(objectKey.toString('hex'), vector.expected.objectKeyHex);
    equal(nativeKey.toString('hex'), vector.expected.nativeKeyHex);

    notEqual(vector.expected.prkHex, vector.expected.scopeKeyHex);
    notEqual(vector.expected.prkHex, vector.expected.objectKeyHex);
    notEqual(vector.expected.prkHex, vector.expected.nativeKeyHex);
    notEqual(vector.expected.scopeKeyHex, vector.expected.objectKeyHex);
    notEqual(vector.expected.scopeKeyHex, vector.expected.nativeKeyHex);
    notEqual(vector.expected.objectKeyHex, vector.expected.nativeKeyHex);
  });

  test('AES-256-GCM decrypts the payload under the object key and authenticated header, and the wire hash matches', () => {
    const vector = buildVector();
    const { inputs, expected } = vector;
    const key = Buffer.from(expected.objectKeyHex, 'hex');
    const nonce = decodeBase64Url(inputs.header.nonce, 'header.nonce');
    const aad = Buffer.from(expected.headerUtf8, 'utf8');
    const ciphertext = Buffer.from(expected.ciphertextHex, 'hex');
    const tag = Buffer.from(expected.tagHex, 'hex');

    const plaintext = gcmDecrypt(key, nonce, aad, ciphertext, tag);
    equal(plaintext.toString('utf8'), expected.payloadUtf8);
    if (typeof inputs.payload === 'string') {
      equal(expected.payloadUtf8, inputs.payload);
    }
    equal(expected.payloadHex, Buffer.from(expected.payloadUtf8, 'utf8').toString('hex'));
    equal(expected.headerHex, Buffer.from(expected.headerUtf8, 'utf8').toString('hex'));
    equal(expected.headerUtf8, canonicalFixture(inputs.header));
    deepEqual(JSON.parse(expected.headerUtf8), inputs.header);

    const wireDigest = createHash('sha256').update(expected.wireUtf8, 'utf8').digest('hex');
    equal(wireDigest, expected.wireSha256);

    const wire = JSON.parse(expected.wireUtf8);
    deepEqual(sortedKeys(wire), WIRE_KEYS);
    deepEqual(wire.header, inputs.header);
    equal(decodeBase64Url(wire.ciphertext, 'wire.ciphertext').toString('hex'), expected.ciphertextHex);
    equal(decodeBase64Url(wire.tag, 'wire.tag').toString('hex'), expected.tagHex);
  });

  test('wrong key, changed AAD byte, changed ciphertext byte, and changed tag byte each fail GCM authentication', () => {
    const vector = buildVector();
    const { inputs, expected } = vector;
    const key = Buffer.from(expected.objectKeyHex, 'hex');
    const nonce = decodeBase64Url(inputs.header.nonce, 'header.nonce');
    const aad = Buffer.from(expected.headerUtf8, 'utf8');
    const ciphertext = Buffer.from(expected.ciphertextHex, 'hex');
    const tag = Buffer.from(expected.tagHex, 'hex');

    throws(() => gcmDecrypt(flipByte(key), nonce, aad, ciphertext, tag));
    throws(() => gcmDecrypt(key, nonce, flipByte(aad), ciphertext, tag));
    throws(() => gcmDecrypt(key, nonce, aad, flipByte(ciphertext), tag));
    throws(() => gcmDecrypt(key, nonce, aad, ciphertext, flipByte(tag)));
  });

  test('header and wire package contain only the declared synthetic format fields', () => {
    const vector = buildVector();
    const { header } = vector.inputs;
    const wire = JSON.parse(vector.expected.wireUtf8);

    deepEqual(sortedKeys(header), HEADER_KEYS);
    deepEqual(sortedKeys(JSON.parse(vector.expected.headerUtf8)), HEADER_KEYS);
    deepEqual(sortedKeys(wire), WIRE_KEYS);
    deepEqual(sortedKeys(wire.header), HEADER_KEYS);

    equal(vector.profile, SYNTHETIC_PROFILE);
    match(vector.profile, /synthetic/);
    equal(typeof vector.expected.nativeExportPassword, 'string');
  });
});
