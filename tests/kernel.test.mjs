import { deepEqual, equal, match, notEqual, ok, throws } from 'node:assert/strict';
import crypto, { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import canonicalize from 'canonicalize';

import { UnlockedVault } from '../dist/kernel/index.js';
import * as kernelApi from '../dist/kernel/index.js';
import { deriveKeys } from '../dist/kernel/crypto.js';
import { planCatalogShards } from '../dist/storage/index.js';
import {
  assertCanonicalObjectSize,
  decodeBase64Url,
  encodeBase64Url,
} from '../dist/kernel/validation.js';

const vector = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/wpp-v1-vectors.json', import.meta.url)), 'utf8'),
);

const KiB = 1024;
const MiB = 1024 * 1024;
const SECRET_MARKER = 'WPP_TEST_SECRET_MARKER_c0ffee91';
const utf8 = (text) => Buffer.from(text, 'utf8');
const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
const id16 = (fill) => b64(Buffer.alloc(16, fill));
const id32 = (fill) => b64(Buffer.alloc(32, fill));
const xorByte = (bytes, index = 0) => {
  const out = Buffer.from(bytes);
  out[index] ^= 0xff;
  return out;
};
const tamperB64url = (encoded, index = 0) => xorByte(Buffer.from(encoded, 'base64url'), index).toString('base64url');
const withTrailingSpaces = (bytes, totalLength) => {
  const src = Buffer.from(bytes);
  if (src.length > totalLength) {
    throw new Error('pad target smaller than source');
  }
  return Buffer.concat([src, Buffer.alloc(totalLength - src.length, 0x20)]);
};

const EXPECTED_UNICODE_PAYLOAD =
  '{"content":{"10":"ten","2":"two","café":"naïve","q":"a\\"b\\\\c"},"metadata":{"accountBinding":{"scheme":"synthetic-fixture","value":"fixture-account"},"applicationId":"wpp-vector-fixture","capturedAt":"2026-09-19T00:00:00Z","codec":{"id":"wpp.test-app","producerPackage":"wpp-format-vectors","producerVersion":"0.1.0","sourceCommit":"0000000000000000000000000000000000000000","version":1},"contract":{"address":"synthetic-contract","codeHash":null},"lifecycle":{"blockHash":null,"status":"unassociated","transactionId":null},"network":{"genesisHash":null,"id":"synthetic-local"},"parents":[],"privateStateIds":["fixture-state"],"retentionClass":"retained-application-witness"},"payloadVersion":1}';

const vectorCodec = { id: 'wpp.synthetic-vector', validate() {} };
const appCodec = {
  id: 'wpp.test-app',
  validate(content) {
    if (content === null || typeof content !== 'object' || Array.isArray(content)) {
      throw new Error('CODEC');
    }
  },
};
const strictCodec = {
  id: 'wpp.test-strict',
  validate(content) {
    if (content === null || typeof content !== 'object' || content.kind !== 'strict-ok') {
      throw new Error('CODEC');
    }
  },
};
const leakyCodec = {
  id: 'wpp.test-leaky',
  validate() {
    throw new Error(`codec leaked ${SECRET_MARKER} from content`);
  },
};

function activeEpoch() {
  return {
    rootEpoch: vector.inputs.header.rootEpoch,
    secretRoot: b64(Buffer.from(vector.inputs.secretRootHex, 'hex')),
    createdAt: '2026-09-19T00:00:00Z',
    status: 'active',
  };
}

function vectorRoot(epochs = [activeEpoch()]) {
  const header = vector.inputs.header;
  return {
    format: 'wpp-root-record',
    version: 1,
    revisionId: id32(0xaa),
    parents: [],
    vaultId: header.vaultId,
    vaultSalt: header.vaultSalt,
    catalogScopeId: id32(0xbb),
    catalogRecordId: id32(0xcc),
    epochs,
  };
}

function randomRoot() {
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

function metadata(codecId) {
  return {
    network: { id: 'synthetic-local', genesisHash: null },
    accountBinding: { scheme: 'synthetic-fixture', value: 'fixture-account' },
    applicationId: 'wpp-vector-fixture',
    contract: { address: 'synthetic-contract', codeHash: null },
    privateStateIds: ['fixture-state'],
    codec: {
      id: codecId,
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

function payload(content, codecId = appCodec.id) {
  return { payloadVersion: 1, metadata: metadata(codecId), content };
}

function expectedOf(meta, scopeId, recordId) {
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

function vectorExpected() {
  return expectedOf(vector.inputs.payload.metadata, vector.inputs.header.scopeId, vector.inputs.header.recordId);
}

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function headerVersionAt(text) {
  const needle = '"version":1';
  const at = text.indexOf(needle);
  if (at < 0) {
    throw new Error('missing header version');
  }
  const next = text[at + needle.length];
  if (next !== '}' && next !== ',') {
    throw new Error(`version boundary ${next}`);
  }
  return { at, nextIndex: at + needle.length };
}

function withHeaderVersionMember(wire, member) {
  const text = Buffer.from(wire).toString('utf8');
  const spot = headerVersionAt(text);
  return Buffer.from(`${text.slice(0, spot.at)}${member}${text.slice(spot.nextIndex)}`, 'utf8');
}

function sealCatalogFixture(vault) {
  const catalogs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../fixtures/catalog-v1-examples.json', import.meta.url)), 'utf8'),
  );
  return vault.sealCatalog(utf8(JSON.stringify(catalogs.catalogs.baseline)));
}

function nodeLocator(suffix) {
  return {
    provider: 'google-drive',
    accountBinding: { scheme: 'google-drive-permission-id', value: `perm${suffix}` },
    objectId: `obj${suffix}`,
    revisionId: `rev${suffix}`,
  };
}

function sealCatalogShard(vault, root) {
  const record = {
    recordKind: 'snapshot',
    body: {
      entryKind: 'snapshot',
      package: {
        sha256: sha256Hex(utf8(`digest:${root.vaultId}`)),
        byteLength: 1024,
        rootEpoch: root.epochs[0].rootEpoch,
        scopeId: id32(2),
        recordId: id32(3),
        generationId: id32(4),
      },
      metadata: metadata(vectorCodec.id),
      label: 'synthetic-node',
      locators: [nodeLocator('1')],
    },
  };
  const plan = planCatalogShards(utf8(canonicalize([record])));
  const leaf = plan.leaves.find((item) => item.empty !== true);
  if (!leaf) {
    throw new Error('missing shard leaf');
  }
  const sealed = vault.sealCatalogNode(Buffer.from(leaf.payloadUtf8));
  const header = JSON.parse(Buffer.from(sealed.wire).toString('utf8')).header;
  return {
    sealed,
    header,
    reference: {
      prefix: leaf.prefix,
      empty: false,
      recordId: header.recordId,
      generationId: header.generationId,
      rootEpoch: header.rootEpoch,
      wireSha256: sealed.sha256,
      wireByteLength: sealed.wire.byteLength,
      plaintextByteLength: leaf.plaintextByteLength,
      entryCount: leaf.entryCount,
      observationCount: leaf.observationCount,
      canonicalRecordsSha256: leaf.canonicalRecordsSha256,
      locators: [nodeLocator('1')],
    },
  };
}

function withPackageDecodePoison(nonce, fn) {
  const original = TextDecoder.prototype.decode;
  let matches = 0;
  TextDecoder.prototype.decode = function decode(input, options) {
    if (input instanceof Uint8Array && Buffer.from(input).toString('latin1').includes(nonce)) {
      matches += 1;
      if (matches === 2) {
        const text = Buffer.from(input).toString('latin1');
        const spot = headerVersionAt(text);
        input[spot.at + '"version":'.length] = 0x32;
      }
    }
    return original.call(this, input, options);
  };
  try {
    return fn();
  } finally {
    TextDecoder.prototype.decode = original;
  }
}

function unlockVector(codecs = [vectorCodec, appCodec]) {
  return UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot())), codecs);
}

function session(codecs = [appCodec, vectorCodec, strictCodec]) {
  const root = randomRoot();
  const rootUtf8 = Uint8Array.from(utf8(JSON.stringify(root)));
  const vault = UnlockedVault.fromRootRecord(rootUtf8, codecs);
  return {
    root,
    rootUtf8,
    vault,
    scopeId: b64(crypto.randomBytes(32)),
    recordId: b64(crypto.randomBytes(32)),
  };
}

function nest(depth) {
  let value = { leaf: true };
  for (let i = 1; i < depth; i += 1) {
    value = { n: value };
  }
  return value;
}

function withDeadRng(fn) {
  const originalBytes = crypto.randomBytes;
  crypto.randomBytes = () => {
    throw new Error('RNG');
  };
  syncBuiltinESMExports();
  try {
    fn();
  } finally {
    crypto.randomBytes = originalBytes;
    syncBuiltinESMExports();
  }
}

function assertPublicError(err) {
  ok(err instanceof Error);
  const text = `${err.name}\n${err.message}\n${err.code ?? ''}\n${err.stack ?? ''}`;
  equal(text.includes(SECRET_MARKER), false);
  match(String(err.message), /^WPP_[A-Z0-9_]+$/);
  match(String(err.code ?? err.message), /^WPP_[A-Z0-9_]+$/);
  return true;
}

function assertCode(code) {
  return (err) => {
    assertPublicError(err);
    equal(err.code, code);
    equal(err.message, code);
    return true;
  };
}

describe('UnlockedVault kernel', () => {
  test('does not re-export deriveKeys from the public index', () => {
    equal('deriveKeys' in kernelApi, false);
  });

  test('matches committed derivation goldens and opens the committed snapshot', () => {
    const secretRoot = Uint8Array.from(Buffer.from(vector.inputs.secretRootHex, 'hex'));
    const keys = deriveKeys(secretRoot, vector.inputs.header);
    try {
      equal(keys.prk.toString('hex'), vector.expected.prkHex);
      equal(keys.scopeKey.toString('hex'), vector.expected.scopeKeyHex);
      equal(keys.objectKey.toString('hex'), vector.expected.objectKeyHex);
      equal(keys.nativeKey.toString('hex'), vector.expected.nativeKeyHex);
      equal(keys.nativeExportPassword, vector.expected.nativeExportPassword);
    } finally {
      keys.prk.fill(0);
      keys.scopeKey.fill(0);
      keys.objectKey.fill(0);
      keys.nativeKey.fill(0);
    }

    const vault = unlockVector();
    equal(vault.locked, false);
    const opened = vault.openSnapshot(utf8(vector.expected.wireUtf8), vectorExpected());
    equal(opened.packageSha256, vector.expected.wireSha256);
    equal(opened.header.kind, 'snapshot');
    deepEqual(opened.content, vector.inputs.payload.content);
    deepEqual(opened.metadata.codec, vector.inputs.payload.metadata.codec);
    const padded = utf8(`  ${vector.expected.wireUtf8}\n`);
    const spaced = vault.openSnapshot(padded, vectorExpected());
    deepEqual(spaced.content, vector.inputs.payload.content);
    notEqual(spaced.packageSha256, vector.expected.wireSha256);
  });

  test('random-root seal/open and independent recovery round-trip, with fresh generation and nonce', () => {
    const { vault, scopeId, recordId } = session();
    const body = payload({ ok: true, n: 1, message: 'round-trip' });
    const first = vault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(body)) });
    const second = vault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(body)) });
    notEqual(Buffer.from(first.wire).toString(), Buffer.from(second.wire).toString());
    const headerA = JSON.parse(Buffer.from(first.wire).toString()).header;
    const headerB = JSON.parse(Buffer.from(second.wire).toString()).header;
    notEqual(headerA.generationId, headerB.generationId);
    notEqual(headerA.nonce, headerB.nonce);
    const opened = vault.openSnapshot(first.wire, expectedOf(body.metadata, scopeId, recordId));
    equal(opened.packageSha256, first.sha256);
    deepEqual(opened.content, body.content);

    const unicode = payload({
      10: 'ten',
      2: 'two',
      café: 'naïve',
      q: 'a"b\\c',
    });
    const sealedUnicode = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: utf8(JSON.stringify(unicode)),
    });
    const openedUnicode = vault.openSnapshot(
      sealedUnicode.wire,
      expectedOf(unicode.metadata, scopeId, recordId),
    );
    equal(openedUnicode.content['10'], 'ten');
    equal(openedUnicode.content['2'], 'two');
    equal(openedUnicode.content.café, 'naïve');
    equal(openedUnicode.content.q, 'a"b\\c');

    const packA = vault.createRecoveryPack();
    const packB = vault.createRecoveryPack();
    equal(packA.recoveryKey.length, 32);
    notEqual(Buffer.from(packA.recoveryKey).toString('hex'), Buffer.from(packB.recoveryKey).toString('hex'));
    notEqual(Buffer.from(packA.wire).toString(), Buffer.from(packB.wire).toString());
    const recovered = UnlockedVault.fromRecoveryPack(packA.wire, packA.recoveryKey, [appCodec, vectorCodec]);
    const recoveredOpen = recovered.openSnapshot(first.wire, expectedOf(body.metadata, scopeId, recordId));
    deepEqual(recoveredOpen.content, body.content);
  });

  test('independent Node crypto decrypt matches hand-specified JCS and rejects noncanonical AEAD plaintext', () => {
    const { vault, root, scopeId, recordId } = session();
    const unicode = payload({
      10: 'ten',
      2: 'two',
      café: 'naïve',
      q: 'a"b\\c',
    });
    const sealed = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: utf8(JSON.stringify(unicode)),
    });
    const parsed = JSON.parse(Buffer.from(sealed.wire).toString());
    const secretRoot = Buffer.from(root.epochs[0].secretRoot, 'base64url');
    const keys = deriveKeys(secretRoot, parsed.header);
    try {
      const nonce = Buffer.from(parsed.header.nonce, 'base64url');
      const aad = utf8(canonicalize(parsed.header));
      const decipher = createDecipheriv('aes-256-gcm', keys.objectKey, nonce, { authTagLength: 16 });
      decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(parsed.ciphertext, 'base64url')),
        decipher.final(),
      ]);
      equal(plain.toString('utf8'), EXPECTED_UNICODE_PAYLOAD);
      deepEqual(plain, utf8(EXPECTED_UNICODE_PAYLOAD));

      const noncanonical = EXPECTED_UNICODE_PAYLOAD.replace('"payloadVersion":1', '"payloadVersion": 1');
      notEqual(noncanonical, EXPECTED_UNICODE_PAYLOAD);
      JSON.parse(noncanonical);
      const cipher = crypto.createCipheriv('aes-256-gcm', keys.objectKey, nonce, { authTagLength: 16 });
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(noncanonical, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const mutant = {
        header: parsed.header,
        ciphertext: ciphertext.toString('base64url'),
        tag: tag.toString('base64url'),
      };
      throws(() => vault.openSnapshot(utf8(JSON.stringify(mutant)), expectedOf(unicode.metadata, scopeId, recordId)));
    } finally {
      keys.prk.fill(0);
      keys.scopeKey.fill(0);
      keys.objectKey.fill(0);
      keys.nativeKey.fill(0);
    }
  });

  test('wrong key, tag, ciphertext, and header yield no plaintext', () => {
    const vault = unlockVector();
    const good = vault.openSnapshot(utf8(vector.expected.wireUtf8), vectorExpected());
    deepEqual(good.content, vector.inputs.payload.content);
    const parsed = JSON.parse(vector.expected.wireUtf8);
    const cases = [
      ['tag', { ...parsed, tag: tamperB64url(parsed.tag) }, 'WPP_AUTH'],
      ['ciphertext', { ...parsed, ciphertext: tamperB64url(parsed.ciphertext) }, 'WPP_AUTH'],
      ['header suite', { ...parsed, header: { ...parsed.header, suite: 'A256GCM' } }],
      ['header kind catalog', { ...parsed, header: { ...parsed.header, kind: 'catalog' } }],
      ['header epoch', { ...parsed, header: { ...parsed.header, rootEpoch: id16(0x11) } }, 'WPP_EPOCH'],
      ['header version', { ...parsed, header: { ...parsed.header, version: 2 } }],
      ['unknown header field', { ...parsed, header: { ...parsed.header, extra: 1 } }],
      ['unknown wire field', { ...parsed, extra: 1 }],
      ['vaultId pad bits', { ...parsed, header: { ...parsed.header, vaultId: `${parsed.header.vaultId.slice(0, -1)}B` } }],
      ['padded id', { ...parsed, header: { ...parsed.header, nonce: `${parsed.header.nonce}==` } }],
    ];
    for (const [title, mutant, code] of cases) {
      if (code === undefined) {
        throws(() => vault.openSnapshot(utf8(JSON.stringify(mutant)), vectorExpected()), title);
      } else {
        throws(
          () => vault.openSnapshot(utf8(JSON.stringify(mutant)), vectorExpected()),
          assertCode(code),
          title,
        );
      }
    }
    const other = UnlockedVault.fromRootRecord(
      utf8(JSON.stringify(vectorRoot([{ ...activeEpoch(), secretRoot: id32(0x99) }]))),
      [vectorCodec],
    );
    throws(
      () => other.openSnapshot(utf8(vector.expected.wireUtf8), vectorExpected()),
      assertCode('WPP_AUTH'),
    );
    const otherRoot = UnlockedVault.fromRootRecord(
      utf8(
        JSON.stringify({
          ...vectorRoot(),
          vaultId: id16(0x33),
          vaultSalt: id32(0x44),
        }),
      ),
      [vectorCodec],
    );
    throws(
      () => otherRoot.openSnapshot(utf8(vector.expected.wireUtf8), vectorExpected()),
      assertCode('WPP_ROOT'),
    );
  });

  test('parser mutations fail and valid counterparts seal', () => {
    const { vault, scopeId, recordId } = session();
    const goodObj = payload({ ok: true, inner: { x: 1, y: 2 } });
    const good = JSON.stringify(goodObj);
    const goodBytes = utf8(good);
    const sealed = vault.sealSnapshot({ scopeId, recordId, payloadUtf8: goodBytes });
    deepEqual(vault.openSnapshot(sealed.wire, expectedOf(goodObj.metadata, scopeId, recordId)).content, goodObj.content);

    const paddedPayload = withTrailingSpaces(goodBytes, goodBytes.length + 32);
    const paddedSealed = vault.sealSnapshot({ scopeId, recordId, payloadUtf8: paddedPayload });
    deepEqual(
      vault.openSnapshot(paddedSealed.wire, expectedOf(goodObj.metadata, scopeId, recordId)).content,
      goodObj.content,
    );

    const deepOk = payload(nest(31));
    const deepSealed = vault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(deepOk)) });
    const openedDeep = vault.openSnapshot(deepSealed.wire, expectedOf(deepOk.metadata, scopeId, recordId));
    deepEqual(openedDeep.content, deepOk.content);

    const parseFails = [
      ['comment', utf8(`{/*c*/${good.slice(1)}`)],
      ['line comment', utf8(`{//c\n${good.slice(1)}`)],
      ['trailing comma', utf8(`${good.slice(0, -1)},}`)],
      ['trailing token', utf8(`${good} 0`)],
      ['surrogate', utf8(good.replace('"ok":true', '"ok":"\\uD800"'))],
      ['nonfinite', utf8(good.replace('"ok":true', '"ok":1e999'))],
      [
        'escaped duplicate',
        utf8(JSON.stringify(payload({ unused: 0 })).replace('{"unused":0}', '{"x":1,"\\u0078":2}')),
        'WPP_JSON_DUPLICATE_KEY',
      ],
      ['nested duplicate', utf8(good.replace('{"x":1,"y":2}', '{"x":1,"x":2}')), 'WPP_JSON_DUPLICATE_KEY'],
      ['depth 33', utf8(JSON.stringify(payload(nest(32))))],
      ['empty', Buffer.alloc(0)],
      ['BOM', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), utf8(good)]), 'WPP_BOM'],
      [
        'malformed UTF-8',
        Buffer.concat([utf8(good.slice(0, 2)), Buffer.from([0x80]), utf8(good.slice(2))]),
        'WPP_UTF8',
      ],
      ['plaintext ceiling', withTrailingSpaces(goodBytes, 16 * MiB + 1)],
    ];
    for (const [title, bytes, code] of parseFails) {
      if (code === undefined) {
        throws(() => vault.sealSnapshot({ scopeId, recordId, payloadUtf8: bytes }), title);
      } else {
        throws(
          () => vault.sealSnapshot({ scopeId, recordId, payloadUtf8: bytes }),
          assertCode(code),
          title,
        );
      }
    }

    const goodRoot = utf8(JSON.stringify(vectorRoot()));
    ok(UnlockedVault.fromRootRecord(goodRoot, [vectorCodec]));
    ok(UnlockedVault.fromRootRecord(withTrailingSpaces(goodRoot, goodRoot.length + 32), [vectorCodec]));
    throws(() => UnlockedVault.fromRootRecord(withTrailingSpaces(goodRoot, 64 * KiB + 1), [vectorCodec]));

    const paddedPackage = withTrailingSpaces(sealed.wire, sealed.wire.length + 32);
    deepEqual(
      vault.openSnapshot(paddedPackage, expectedOf(goodObj.metadata, scopeId, recordId)).content,
      goodObj.content,
    );
    throws(() =>
      vault.openSnapshot(withTrailingSpaces(sealed.wire, 24 * MiB + 1), expectedOf(goodObj.metadata, scopeId, recordId)),
    );

    const pack = vault.createRecoveryPack();
    const recovered = UnlockedVault.fromRecoveryPack(
      withTrailingSpaces(pack.wire, pack.wire.length + 32),
      pack.recoveryKey,
      [appCodec],
    );
    deepEqual(recovered.openSnapshot(sealed.wire, expectedOf(goodObj.metadata, scopeId, recordId)).content, goodObj.content);
    throws(() =>
      UnlockedVault.fromRecoveryPack(withTrailingSpaces(pack.wire, 96 * KiB + 1), pack.recoveryKey, [appCodec]),
    );
  });

  test('root semantics, unknown codec, binding fields, leaky codec, and metadata types reject before data return', () => {
    const codecs = [vectorCodec, appCodec];
    ok(UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot())), codecs));
    const retired = { ...activeEpoch(), status: 'retired' };
    const rootFails = [
      ['unknown field', { ...vectorRoot(), extra: 1 }],
      ['version', { ...vectorRoot(), version: 2 }],
      ['duplicate epoch', vectorRoot([activeEpoch(), { ...retired, status: 'retired' }])],
      ['zero active', vectorRoot([retired])],
      [
        'two active',
        vectorRoot([
          activeEpoch(),
          { rootEpoch: id16(0x21), secretRoot: id32(0x22), createdAt: '2026-09-19T00:00:00Z', status: 'active' },
        ]),
      ],
    ];
    for (const [title, root] of rootFails) {
      throws(() => UnlockedVault.fromRootRecord(utf8(JSON.stringify(root)), codecs), title);
    }
    throws(() => UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot())), [appCodec, { ...appCodec }]));

    const vault = unlockVector(codecs);
    const opened = vault.openSnapshot(utf8(vector.expected.wireUtf8), vectorExpected());
    deepEqual(opened.content, vector.inputs.payload.content);
    const codec = vector.inputs.payload.metadata.codec;
    const mismatches = [
      ['scopeId', { scopeId: id32(1) }],
      ['recordId', { recordId: id32(2) }],
      ['network.id', { network: { id: 'other-net', genesisHash: null } }],
      ['network.genesisHash', { network: { id: 'synthetic-local', genesisHash: 'not-null' } }],
      ['accountBinding.scheme', { accountBinding: { scheme: 'other-scheme', value: 'fixture-account' } }],
      ['accountBinding.value', { accountBinding: { scheme: 'synthetic-fixture', value: 'other-account' } }],
      ['applicationId', { applicationId: 'other-app' }],
      ['contract.address', { contract: { address: 'other-contract', codeHash: null } }],
      ['contract.codeHash', { contract: { address: 'synthetic-contract', codeHash: 'present' } }],
      ['codec.id', { codec: { ...codec, id: appCodec.id } }],
      ['codec.version', { codec: { ...codec, version: 2 } }],
      ['codec.producerPackage', { codec: { ...codec, producerPackage: 'other-package' } }],
      ['codec.producerVersion', { codec: { ...codec, producerVersion: '9.9.9' } }],
      ['codec.sourceCommit', { codec: { ...codec, sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } }],
    ];
    for (const [title, override] of mismatches) {
      throws(() => vault.openSnapshot(utf8(vector.expected.wireUtf8), { ...vectorExpected(), ...override }), title);
    }

    const { vault: appVault, scopeId, recordId } = session([appCodec]);
    const nativeBody = payload({ format: 'midnight-private-state-export' }, 'midnight-js-private-state-export');
    throws(() => appVault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(nativeBody)) }));
    const unknownBody = payload({ ok: true }, 'wpp.unknown');
    throws(() => appVault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(unknownBody)) }));
    const numbered = payload({ ok: true });
    numbered.metadata.applicationId = 1;
    throws(() => appVault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(numbered)) }));

    const { vault: leakyVault, scopeId: leakyScope, recordId: leakyRecord } = session([leakyCodec, appCodec]);
    const leakyBody = payload({ ok: true }, leakyCodec.id);
    throws(
      () =>
        leakyVault.sealSnapshot({
          scopeId: leakyScope,
          recordId: leakyRecord,
          payloadUtf8: utf8(JSON.stringify(leakyBody)),
        }),
      assertPublicError,
    );

    const { vault: strictVault, scopeId: strictScope, recordId: strictRecord } = session([strictCodec]);
    throws(() =>
      strictVault.sealSnapshot({
        scopeId: strictScope,
        recordId: strictRecord,
        payloadUtf8: utf8(JSON.stringify(payload({ kind: 'nope' }, strictCodec.id))),
      }),
    );
    const strictOk = payload({ kind: 'strict-ok' }, strictCodec.id);
    const strictSealed = strictVault.sealSnapshot({
      scopeId: strictScope,
      recordId: strictRecord,
      payloadUtf8: utf8(JSON.stringify(strictOk)),
    });
    equal(
      strictVault.openSnapshot(strictSealed.wire, expectedOf(strictOk.metadata, strictScope, strictRecord)).content.kind,
      'strict-ok',
    );
  });

  test('OS random failure, failed recovery, caller buffers, and lock', () => {
    const { vault, rootUtf8, scopeId, recordId } = session();
    const body = payload({ ok: true });
    const expected = expectedOf(body.metadata, scopeId, recordId);
    const sealed = vault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(body)) });
    deepEqual(vault.openSnapshot(sealed.wire, expected).content, body.content);
    const rootCopy = Buffer.from(rootUtf8);
    withDeadRng(() => {
      throws(() => vault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(body)) }));
      throws(() => vault.createRecoveryPack());
    });
    const afterRng = vault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(body)) });
    ok(afterRng.wire.byteLength > 0);

    const pack = vault.createRecoveryPack();
    throws(() => UnlockedVault.fromRecoveryPack(pack.wire, pack.recoveryKey.subarray(0, 31), [appCodec]));
    const keyCopy = Buffer.from(pack.recoveryKey);
    const wireCopy = Buffer.from(pack.wire);
    let handle;
    throws(() => {
      handle = UnlockedVault.fromRecoveryPack(pack.wire, xorByte(pack.recoveryKey), [appCodec]);
    });
    equal(handle, undefined);
    deepEqual(Buffer.from(pack.recoveryKey), keyCopy);
    deepEqual(Buffer.from(pack.wire), wireCopy);
    const parsed = JSON.parse(Buffer.from(pack.wire).toString());
    parsed.tag = tamperB64url(parsed.tag);
    throws(() => UnlockedVault.fromRecoveryPack(utf8(JSON.stringify(parsed)), pack.recoveryKey, [appCodec]));
    deepEqual(Buffer.from(rootUtf8), rootCopy);

    vault.lock();
    equal(vault.locked, true);
    vault.lock();
    equal(vault.locked, true);
    throws(() => vault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(JSON.stringify(body)) }));
    throws(() => vault.openSnapshot(sealed.wire, expected));
    throws(() => vault.createRecoveryPack());
    deepEqual(Buffer.from(rootUtf8), rootCopy);
  });

  test('lone surrogates fail with WPP_JSON_SURROGATE before codec invocation', () => {
    let called = false;
    const watching = {
      id: appCodec.id,
      validate() {
        called = true;
      },
    };
    const { vault, scopeId, recordId } = session([watching]);
    const goodObj = payload({ ok: true, inner: { x: 1 } });
    const good = JSON.stringify(goodObj);
    const pairObj = payload({ ok: '\uD83D\uDE00', '\uD83D\uDE00': true });
    const pairSealed = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: utf8(JSON.stringify(pairObj)),
    });
    equal(called, true);
    equal(vault.openSnapshot(pairSealed.wire, expectedOf(pairObj.metadata, scopeId, recordId)).content.ok, '\uD83D\uDE00');
    called = false;

    const cases = [
      ['value high', good.replace('"ok":true', '"ok":"\\uD800"')],
      ['value terminal high', good.replace('"ok":true', '"ok":"end\\uD800"')],
      ['value low', good.replace('"ok":true', '"ok":"\\uDC00"')],
      ['value unpaired middle', good.replace('"ok":true', '"ok":"a\\uD800b"')],
      ['key high', good.replace('"ok":true', '"\\uD800":true')],
      ['key terminal high', good.replace('"ok":true', '"lead\\uD800":true')],
      ['key low', good.replace('"ok":true', '"\\uDC00":true')],
      ['key unpaired middle', good.replace('"ok":true', '"a\\uD800b":true')],
    ];
    for (const [title, text] of cases) {
      called = false;
      throws(
        () => vault.sealSnapshot({ scopeId, recordId, payloadUtf8: utf8(text) }),
        (err) => {
          assertCode('WPP_JSON_SURROGATE')(err);
          equal(called, false, title);
          return true;
        },
      );
    }
  });

  test('binding mismatch and codec isolation do not change authenticated results', () => {
    let called = false;
    const watching = {
      id: vectorCodec.id,
      validate() {
        called = true;
      },
    };
    const vault = unlockVector([watching]);
    throws(
      () => vault.openSnapshot(utf8(vector.expected.wireUtf8), { ...vectorExpected(), applicationId: 'nope' }),
      (err) => {
        assertCode('WPP_BINDING')(err);
        equal(called, false);
        return true;
      },
    );

    const policy = {
      id: 'wpp.test-snap',
      validate() {},
    };
    const snap = session([policy]);
    policy.validate = () => {
      throw new Error('replaced');
    };
    policy.id = 'wpp.other';
    const snapBody = payload({ ok: true, n: 7 }, 'wpp.test-snap');
    const snapSealed = snap.vault.sealSnapshot({
      scopeId: snap.scopeId,
      recordId: snap.recordId,
      payloadUtf8: utf8(JSON.stringify(snapBody)),
    });
    deepEqual(
      snap.vault.openSnapshot(snapSealed.wire, expectedOf(snapBody.metadata, snap.scopeId, snap.recordId)).content,
      snapBody.content,
    );

    const holder = { expected: null, mutateExpected: false };
    const mutating = {
      id: 'wpp.test-mut',
      validate(content, meta) {
        if (holder.mutateExpected && holder.expected !== null) {
          holder.expected.applicationId = 'mutated-expected';
          holder.expected.network.id = 'mutated-network';
        }
        const mutations = [
          () => {
            content.injected = true;
          },
          () => {
            content.ok = false;
          },
          () => {
            meta.applicationId = 'mutated-meta';
          },
          () => {
            meta.network.id = 'mutated-meta-net';
          },
        ];
        for (const mutate of mutations) {
          try {
            mutate();
          } catch {
            // Frozen views reject assignment. Continue the remaining mutations.
          }
        }
        return undefined;
      },
    };
    const mut = session([mutating]);
    const mutPayload = payload({ ok: true, n: 1 }, mutating.id);
    holder.expected = expectedOf(mutPayload.metadata, mut.scopeId, mut.recordId);
    const mutSealed = mut.vault.sealSnapshot({
      scopeId: mut.scopeId,
      recordId: mut.recordId,
      payloadUtf8: utf8(JSON.stringify(mutPayload)),
    });
    const mutOpened = mut.vault.openSnapshot(mutSealed.wire, holder.expected);
    deepEqual(mutOpened.content, { ok: true, n: 1 });
    equal(mutOpened.metadata.applicationId, mutPayload.metadata.applicationId);
    equal(mutOpened.metadata.network.id, mutPayload.metadata.network.id);
    equal(mutPayload.metadata.network.id, 'synthetic-local');
    equal('injected' in mutOpened.content, false);

    holder.mutateExpected = true;
    const openedAfterMutation = mut.vault.openSnapshot(mutSealed.wire, holder.expected);
    deepEqual(openedAfterMutation.content, { ok: true, n: 1 });
    equal(openedAfterMutation.metadata.applicationId, mutPayload.metadata.applicationId);
    equal(holder.expected.applicationId, 'mutated-expected');

    holder.mutateExpected = false;
    const protoBody = payload({ ok: true }, mutating.id);
    const protoBytes = utf8(
      JSON.stringify(protoBody).replace(
        '{"ok":true}',
        '{"ok":true,"__proto__":{"polluted":true}}',
      ),
    );
    const protoSealed = mut.vault.sealSnapshot({
      scopeId: mut.scopeId,
      recordId: mut.recordId,
      payloadUtf8: protoBytes,
    });
    const protoOpened = mut.vault.openSnapshot(
      protoSealed.wire,
      expectedOf(protoBody.metadata, mut.scopeId, mut.recordId),
    );
    equal(Object.prototype.hasOwnProperty.call(protoOpened.content, '__proto__'), true);
  });

  test('reentrant lock during seal and open cancels the current call', () => {
    let sealVault;
    const locking = {
      id: 'wpp.test-lock',
      validate() {
        sealVault.lock();
      },
    };
    const sealedSession = session([locking]);
    sealVault = sealedSession.vault;
    const sealBody = payload({ ok: true }, locking.id);
    let sealed;
    throws(
      () => {
        sealed = sealVault.sealSnapshot({
          scopeId: sealedSession.scopeId,
          recordId: sealedSession.recordId,
          payloadUtf8: utf8(JSON.stringify(sealBody)),
        });
      },
      assertCode('WPP_LOCKED'),
    );
    equal(sealed, undefined);
    equal(sealVault.locked, true);
    throws(() => sealVault.createRecoveryPack(), assertCode('WPP_LOCKED'));

    let opening = false;
    let openVault;
    const delayed = {
      id: 'wpp.test-lock-open',
      validate() {
        if (opening) {
          openVault.lock();
        }
      },
    };
    const openSession = session([delayed]);
    openVault = openSession.vault;
    const openBody = payload({ ok: true }, delayed.id);
    const packed = openVault.sealSnapshot({
      scopeId: openSession.scopeId,
      recordId: openSession.recordId,
      payloadUtf8: utf8(JSON.stringify(openBody)),
    });
    opening = true;
    let opened;
    throws(
      () => {
        opened = openVault.openSnapshot(
          packed.wire,
          expectedOf(openBody.metadata, openSession.scopeId, openSession.recordId),
        );
      },
      assertCode('WPP_LOCKED'),
    );
    equal(opened, undefined);
    equal(openVault.locked, true);
  });

  test('async validators fail closed without leaking rejection reasons', async () => {
    const unhandled = [];
    const onUnhandled = (reason) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const resolving = {
        id: 'wpp.test-async-resolve',
        validate() {
          return Promise.resolve(undefined);
        },
      };
      const rejecting = {
        id: 'wpp.test-async-reject',
        validate() {
          return Promise.reject(new Error(`reject ${SECRET_MARKER}`));
        },
      };
      const asyncThrow = {
        id: 'wpp.test-async-throw',
        validate: async () => {
          throw new Error(`throw ${SECRET_MARKER}`);
        },
      };
      const thenable = {
        id: 'wpp.test-async-thenable',
        validate() {
          return {
            then(_resolve, reject) {
              reject(new Error(`thenable ${SECRET_MARKER}`));
            },
          };
        },
      };
      for (const codec of [resolving, rejecting, asyncThrow, thenable]) {
        const { vault, scopeId, recordId } = session([codec]);
        const body = payload({ ok: true }, codec.id);
        throws(
          () =>
            vault.sealSnapshot({
              scopeId,
              recordId,
              payloadUtf8: utf8(JSON.stringify(body)),
            }),
          assertCode('WPP_CODEC'),
        );
      }
      await new Promise((resolve) => {
        setImmediate(resolve);
      });
      equal(unhandled.length, 0);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  test('recovery nonce RNG failure wipes the already allocated key', () => {
    const { vault } = session();
    const originalBytes = crypto.randomBytes;
    let allocated;
    let calls = 0;
    crypto.randomBytes = (size) => {
      calls += 1;
      if (calls === 1) {
        allocated = originalBytes.call(crypto, size);
        return allocated;
      }
      throw new Error('RNG');
    };
    syncBuiltinESMExports();
    try {
      throws(() => vault.createRecoveryPack(), assertCode('WPP_RANDOM'));
      ok(Buffer.isBuffer(allocated));
      equal(allocated.every((byte) => byte === 0), true);
    } finally {
      crypto.randomBytes = originalBytes;
      syncBuiltinESMExports();
    }
  });

  test('compact numeric JSON that expands past 16 MiB canonical plaintext is rejected', () => {
    const permissive = { id: appCodec.id, validate() {} };
    const { vault, scopeId, recordId } = session([permissive]);
    const n = 763000;
    const meta = JSON.stringify(metadata(appCodec.id));
    const text = `{"payloadVersion":1,"metadata":${meta},"content":[${'1e20,'.repeat(n).slice(0, -1)}]}`;
    const bytes = utf8(text);
    ok(bytes.byteLength < 16 * MiB);
    throws(
      () => vault.sealSnapshot({ scopeId, recordId, payloadUtf8: bytes }),
      assertCode('WPP_INPUT_TOO_LARGE'),
    );
  });

  test('sealSnapshot uses captured identifiers after codec mutation of the input', () => {
    const cases = [
      ['scopeId', 'valid', () => b64(crypto.randomBytes(32))],
      ['scopeId', 'malformed', () => '!'],
      ['recordId', 'valid', () => b64(crypto.randomBytes(32))],
      ['recordId', 'malformed', () => 'invalid'],
    ];
    for (const [field, kind, nextValue] of cases) {
      const input = {
        scopeId: b64(crypto.randomBytes(32)),
        recordId: b64(crypto.randomBytes(32)),
        payloadUtf8: null,
      };
      const originalScope = input.scopeId;
      const originalRecord = input.recordId;
      const codec = {
        id: `wpp.test-id-capture-${field}-${kind}`,
        validate() {
          input[field] = nextValue();
        },
      };
      const { vault } = session([codec]);
      const body = payload({ ok: true }, codec.id);
      input.payloadUtf8 = utf8(JSON.stringify(body));
      const sealed = vault.sealSnapshot(input);
      const parsed = JSON.parse(Buffer.from(sealed.wire).toString());
      equal(parsed.header.scopeId, originalScope, `${field} ${kind} sealed scope`);
      equal(parsed.header.recordId, originalRecord, `${field} ${kind} sealed record`);
      const opened = vault.openSnapshot(
        sealed.wire,
        expectedOf(body.metadata, originalScope, originalRecord),
      );
      deepEqual(opened.content, body.content);
      equal(opened.header.scopeId, originalScope, `${field} ${kind} opened scope`);
      equal(opened.header.recordId, originalRecord, `${field} ${kind} opened record`);
    }
  });

  test('impossible date-time values fail with WPP_SCHEMA', () => {
    const invalid = '2026-13-45T00:00:00Z';
    const codecs = [vectorCodec, appCodec];
    ok(UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot())), codecs));
    const badEpoch = { ...activeEpoch(), createdAt: invalid };
    throws(
      () => UnlockedVault.fromRootRecord(utf8(JSON.stringify(vectorRoot([badEpoch]))), codecs),
      assertCode('WPP_SCHEMA'),
    );

    const { vault, scopeId, recordId } = session();
    const goodBody = payload({ ok: true });
    const sealed = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: utf8(JSON.stringify(goodBody)),
    });
    deepEqual(
      vault.openSnapshot(sealed.wire, expectedOf(goodBody.metadata, scopeId, recordId)).content,
      goodBody.content,
    );

    const badBody = payload({ ok: true });
    badBody.metadata.capturedAt = invalid;
    throws(
      () =>
        vault.sealSnapshot({
          scopeId,
          recordId,
          payloadUtf8: utf8(JSON.stringify(badBody)),
        }),
      assertCode('WPP_SCHEMA'),
    );
  });

  test('public byte inputs that are not Uint8Array fail with WPP_SCHEMA', () => {
    const { vault, scopeId, recordId } = session();
    const body = payload({ ok: true });
    const payloadUtf8 = utf8(JSON.stringify(body));
    const expected = expectedOf(body.metadata, scopeId, recordId);
    const sealed = vault.sealSnapshot({ scopeId, recordId, payloadUtf8 });
    const pack = vault.createRecoveryPack();
    const rootUtf8 = utf8(JSON.stringify(vectorRoot()));
    const wrong = [null, 'bytes', {}];
    for (const value of wrong) {
      throws(() => UnlockedVault.fromRootRecord(value, [appCodec, vectorCodec]), assertCode('WPP_SCHEMA'));
      throws(
        () => vault.sealSnapshot({ scopeId, recordId, payloadUtf8: value }),
        assertCode('WPP_SCHEMA'),
      );
      throws(() => vault.openSnapshot(value, expected), assertCode('WPP_SCHEMA'));
      throws(
        () => UnlockedVault.fromRecoveryPack(value, pack.recoveryKey, [appCodec]),
        assertCode('WPP_SCHEMA'),
      );
      throws(
        () => UnlockedVault.fromRecoveryPack(pack.wire, value, [appCodec]),
        assertCode('WPP_SCHEMA'),
      );
    }
    ok(UnlockedVault.fromRootRecord(Buffer.from(rootUtf8), [vectorCodec, appCodec]));
    const bufSealed = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: Buffer.from(payloadUtf8),
    });
    deepEqual(vault.openSnapshot(Buffer.from(bufSealed.wire), expected).content, body.content);
    const recovered = UnlockedVault.fromRecoveryPack(
      Buffer.from(pack.wire),
      Buffer.from(pack.recoveryKey),
      [appCodec],
    );
    deepEqual(recovered.openSnapshot(sealed.wire, expected).content, body.content);
  });

  test('repeated invalid codec callbacks never succeed after receiver mutation', () => {
    let sealCalls = 0;
    function sealValidate() {
      sealCalls += 1;
      try {
        this.validate = () => undefined;
      } catch {
        // Strict module this may be undefined. Count the call before the attempt.
      }
      throw new Error('reject');
    }
    const rejectingSeal = { id: 'wpp.test-receiver-seal', validate: sealValidate };
    const { vault, scopeId, recordId } = session([rejectingSeal]);
    const sealBody = payload({ ok: true }, rejectingSeal.id);
    const sealBytes = utf8(JSON.stringify(sealBody));
    for (let i = 0; i < 3; i += 1) {
      let sealed;
      throws(
        () => {
          sealed = vault.sealSnapshot({
            scopeId,
            recordId,
            payloadUtf8: sealBytes,
          });
        },
        assertCode('WPP_CODEC'),
      );
      equal(sealed, undefined);
    }
    equal(sealCalls, 3);

    let openCalls = 0;
    function openValidate() {
      openCalls += 1;
      try {
        this.validate = () => undefined;
      } catch {
        // Strict module this may be undefined. Count the call before the attempt.
      }
      throw new Error('reject');
    }
    const codecId = 'wpp.test-receiver-open';
    const permissive = { id: codecId, validate() {} };
    const rejectingOpen = { id: codecId, validate: openValidate };
    const root = randomRoot();
    const rootUtf8 = utf8(JSON.stringify(root));
    const openScope = b64(crypto.randomBytes(32));
    const openRecord = b64(crypto.randomBytes(32));
    const creator = UnlockedVault.fromRootRecord(rootUtf8, [permissive]);
    const openBody = payload({ ok: true }, codecId);
    const packed = creator.sealSnapshot({
      scopeId: openScope,
      recordId: openRecord,
      payloadUtf8: utf8(JSON.stringify(openBody)),
    });
    ok(packed.wire.byteLength > 0);
    const opener = UnlockedVault.fromRootRecord(rootUtf8, [rejectingOpen]);
    const expected = expectedOf(openBody.metadata, openScope, openRecord);
    for (let i = 0; i < 3; i += 1) {
      let opened;
      throws(
        () => {
          opened = opener.openSnapshot(packed.wire, expected);
        },
        assertCode('WPP_CODEC'),
      );
      equal(opened, undefined);
    }
    equal(openCalls, 3);
  });

  test('assertCanonicalObjectSize wipes temporary canonical buffers on success and oversize', () => {
    const originalEncode = TextEncoder.prototype.encode;
    const captured = [];
    TextEncoder.prototype.encode = function encodeSpy(input) {
      const bytes = originalEncode.call(this, input);
      captured.push(bytes);
      return bytes;
    };
    try {
      captured.length = 0;
      assertCanonicalObjectSize({ ok: true }, 1024);
      ok(captured.length > 0);
      for (const bytes of captured) {
        equal(bytes.every((byte) => byte === 0), true);
      }

      captured.length = 0;
      throws(
        () => assertCanonicalObjectSize({ pad: 'a'.repeat(64) }, 8),
        assertCode('WPP_INPUT_TOO_LARGE'),
      );
      ok(captured.length > 0);
      for (const bytes of captured) {
        equal(bytes.every((byte) => byte === 0), true);
      }
    } finally {
      TextEncoder.prototype.encode = originalEncode;
    }
  });

  test('encodeBase64Url and decodeBase64Url keep caller bytes and slice offsets', () => {
    const originalFrom = Buffer.from;
    let copiedTypedArray = false;
    Buffer.from = function fromSpy(...args) {
      if (args.length === 1 && args[0] instanceof Uint8Array) {
        copiedTypedArray = true;
      }
      return originalFrom.apply(this, args);
    };
    try {
      const buffer = originalFrom.call(Buffer, [0x10, 0x20, 0x30, 0x40]);
      const bufferBefore = originalFrom.call(Buffer, buffer);
      copiedTypedArray = false;
      const bufferEncoded = encodeBase64Url(buffer);
      equal(copiedTypedArray, false);
      deepEqual(buffer, bufferBefore);
      equal(bufferEncoded, bufferBefore.toString('base64url'));
      const bufferDecoded = decodeBase64Url(bufferEncoded, 4, 4);
      deepEqual(Array.from(bufferDecoded), [0x10, 0x20, 0x30, 0x40]);

      const parent = new Uint8Array([0x99, 0x99, 0x01, 0x02, 0x03, 0x99, 0x99]);
      const slice = parent.subarray(2, 5);
      const parentBefore = Uint8Array.from(parent);
      copiedTypedArray = false;
      const sliceEncoded = encodeBase64Url(slice);
      equal(copiedTypedArray, false);
      deepEqual(Array.from(parent), Array.from(parentBefore));
      equal(sliceEncoded, originalFrom.call(Buffer, [0x01, 0x02, 0x03]).toString('base64url'));
      const sliceDecoded = decodeBase64Url(sliceEncoded, 3, 3);
      deepEqual(Array.from(sliceDecoded), [0x01, 0x02, 0x03]);
      equal(sliceDecoded.byteLength, 3);
    } finally {
      Buffer.from = originalFrom;
    }
  });

  test('openSnapshot hashes and parses the same owned caller-byte snapshot', () => {
    const { vault, scopeId, recordId } = session();
    const bodyA = payload({ slot: 'package-A' });
    const bodyB = payload({ slot: 'package-B' });
    equal(JSON.stringify(bodyA.content).length, JSON.stringify(bodyB.content).length);
    const sealedA = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: utf8(JSON.stringify(bodyA)),
    });
    const sealedB = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: utf8(JSON.stringify(bodyB)),
    });
    equal(sealedA.wire.byteLength, sealedB.wire.byteLength);
    notEqual(sealedA.sha256, sealedB.sha256);
    notEqual(Buffer.from(sealedA.wire).equals(Buffer.from(sealedB.wire)), true);
    const expected = expectedOf(bodyA.metadata, scopeId, recordId);
    deepEqual(expected, expectedOf(bodyB.metadata, scopeId, recordId));
    deepEqual(vault.openSnapshot(Uint8Array.from(sealedA.wire), expected).content, bodyA.content);
    deepEqual(vault.openSnapshot(Uint8Array.from(sealedB.wire), expected).content, bodyB.content);

    class SwapAtParse extends Uint8Array {
      constructor(first, second) {
        super(first);
        this._second = Uint8Array.from(second);
        this._byteLengthReads = 0;
        this._swapped = false;
      }

      get byteLength() {
        this._byteLengthReads += 1;
        if (this._byteLengthReads >= 2 && !this._swapped) {
          super.set(this._second);
          this._swapped = true;
        }
        return super.byteLength;
      }
    }

    const mutating = new SwapAtParse(sealedA.wire, sealedB.wire);
    let opened;
    try {
      opened = vault.openSnapshot(mutating, expected);
    } catch (err) {
      assertPublicError(err);
      return;
    }
    const hashIsA = opened.packageSha256 === sealedA.sha256;
    const hashIsB = opened.packageSha256 === sealedB.sha256;
    ok(hashIsA || hashIsB, 'accepted hash must be one of the two equal-length packages');
    if (hashIsA) {
      deepEqual(opened.content, bodyA.content);
      equal(opened.packageSha256, sealedA.sha256);
    } else {
      deepEqual(opened.content, bodyB.content);
      equal(opened.packageSha256, sealedB.sha256);
    }
    equal(opened.packageSha256, sealedA.sha256);
    deepEqual(opened.content, bodyA.content);
  });

  test('fractional application payload values still open', () => {
    const { vault, scopeId, recordId } = session();
    const body = payload({ label: 'kept', ratio: 1.5 });
    const sealed = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: utf8(JSON.stringify(body)),
    });
    const opened = vault.openSnapshot(sealed.wire, expectedOf(body.metadata, scopeId, recordId));
    equal(opened.content.ratio, 1.5);
    equal(opened.content.label, 'kept');
  });

  test('shared wire corpus agrees on accept and reject', () => {
    const corpusBytes = readFileSync(
      fileURLToPath(new URL('../fixtures/wpp-v1-wire-corpus.json', import.meta.url)),
    );
    const corpus = JSON.parse(Buffer.from(corpusBytes).toString('utf8'));
    equal(corpus.comparison, 'accept-or-reject-only');
    ok(String(corpus.errorClassNote).includes('Error code classes can differ'));
    equal(Buffer.from(corpusBytes).toString('utf8').includes(vector.inputs.secretRootHex), false);
    const vault = unlockVector();
    const expected = vectorExpected();
    const seen = new Set();
    for (const entry of corpus.cases) {
      ok(!seen.has(entry.id), entry.id);
      seen.add(entry.id);
      const wire = Buffer.from(entry.wireUtf8, 'utf8');
      let opened = null;
      try {
        opened = vault.openSnapshot(wire, expected);
      } catch (err) {
        assertPublicError(err);
        opened = null;
      }
      if (entry.outcome === 'accept') {
        ok(opened, entry.id);
        equal(opened.header.version, 1, entry.id);
        deepEqual(opened.content, vector.inputs.payload.content, entry.id);
      } else {
        equal(entry.outcome, 'reject', entry.id);
        equal(opened, null, entry.id);
      }
    }
    equal(seen.size, 25);
  });

  test('recovery, catalog, and catalog-node checks share one owned package decode', () => {
    const { vault, root, scopeId, recordId } = session();
    const snapshot = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: utf8(JSON.stringify(payload({ slot: 'owned-decode' }))),
    });
    const snapshotHeader = JSON.parse(Buffer.from(snapshot.wire).toString('utf8')).header;
    const openedSnapshot = withPackageDecodePoison(snapshotHeader.nonce, () =>
      vault.openSnapshot(snapshot.wire, expectedOf(metadata(appCodec.id), scopeId, recordId)),
    );
    equal(openedSnapshot.header.version, 1);
    equal(openedSnapshot.content.slot, 'owned-decode');

    const pack = vault.createRecoveryPack();
    const recoveryHeader = JSON.parse(Buffer.from(pack.wire).toString('utf8')).header;
    const recovered = withPackageDecodePoison(recoveryHeader.nonce, () =>
      UnlockedVault.fromRecoveryPack(pack.wire, pack.recoveryKey, [appCodec]),
    );
    ok(recovered);
    recovered.lock();

    const catalog = sealCatalogFixture(vault);
    const catalogHeader = JSON.parse(Buffer.from(catalog.wire).toString('utf8')).header;
    const openedCatalog = withPackageDecodePoison(catalogHeader.nonce, () => vault.openCatalog(catalog.wire));
    equal(openedCatalog.header.kind, 'catalog');
    equal(openedCatalog.header.version, 1);

    const shard = sealCatalogShard(vault, root);
    const openedShard = withPackageDecodePoison(shard.header.nonce, () =>
      vault.openCatalogNode(shard.sealed.wire, { nodeType: 'shard', reference: shard.reference }),
    );
    equal(openedShard.header.kind, 'catalog');
    equal(openedShard.header.version, 1);
    equal(openedShard.node.role, 'shard');
  });

  test('recovery, catalog, and catalog-node reject inexact raw version tokens', () => {
    const { vault, root, scopeId, recordId } = session();
    const longToken = `1.${'0'.repeat(63)}`;
    equal(longToken.length, 65);
    const pack = vault.createRecoveryPack();
    for (const token of ['1.0000000000000001', longToken]) {
      const wire = withHeaderVersionMember(pack.wire, `"version":${token}`);
      throws(
        () => UnlockedVault.fromRecoveryPack(wire, pack.recoveryKey, [appCodec]),
        assertCode('WPP_SCHEMA'),
      );
    }
    const recovered = UnlockedVault.fromRecoveryPack(
      withHeaderVersionMember(pack.wire, '"version":1.0'),
      pack.recoveryKey,
      [appCodec],
    );
    ok(recovered);
    recovered.lock();

    const catalog = sealCatalogFixture(vault);
    throws(
      () => vault.openCatalog(withHeaderVersionMember(catalog.wire, '"version":1.0000000000000001')),
      assertCode('WPP_SCHEMA'),
    );
    throws(
      () => vault.openCatalog(withHeaderVersionMember(catalog.wire, `"version":${longToken}`)),
      assertCode('WPP_SCHEMA'),
    );
    const openedCatalog = vault.openCatalog(withHeaderVersionMember(catalog.wire, '"version":10e-1'));
    equal(openedCatalog.header.kind, 'catalog');
    equal(openedCatalog.header.version, 1);
    throws(
      () =>
        vault.openSnapshot(catalog.wire, expectedOf(metadata(appCodec.id), scopeId, recordId)),
      assertCode('WPP_UNSUPPORTED'),
    );
    throws(
      () => vault.openCatalog(withHeaderVersionMember(catalog.wire, '"version":1,"version":1')),
      assertCode('WPP_JSON_DUPLICATE_KEY'),
    );
    throws(
      () => vault.openCatalog(withHeaderVersionMember(catalog.wire, '"version":1,"vers\\u0069on":1')),
      assertCode('WPP_JSON_DUPLICATE_KEY'),
    );

    const shard = sealCatalogShard(vault, root);
    const badShard = withHeaderVersionMember(shard.sealed.wire, `"version":${longToken}`);
    throws(
      () =>
        vault.openCatalogNode(badShard, {
          nodeType: 'shard',
          reference: {
            ...shard.reference,
            wireSha256: sha256Hex(badShard),
            wireByteLength: badShard.byteLength,
          },
        }),
      assertCode('WPP_SCHEMA'),
    );
    const spelledShard = withHeaderVersionMember(shard.sealed.wire, '"vers\\u0069on":1e0');
    const openedShard = vault.openCatalogNode(spelledShard, {
      nodeType: 'shard',
      reference: {
        ...shard.reference,
        wireSha256: sha256Hex(spelledShard),
        wireByteLength: spelledShard.byteLength,
      },
    });
    equal(openedShard.header.kind, 'catalog');
    equal(openedShard.header.version, 1);
    equal(openedShard.node.role, 'shard');
    const roundedShard = withHeaderVersionMember(shard.sealed.wire, '"vers\\u0069on":1.0000000000000001');
    throws(
      () =>
        vault.openCatalogNode(roundedShard, {
          nodeType: 'shard',
          reference: {
            ...shard.reference,
            wireSha256: sha256Hex(roundedShard),
            wireByteLength: roundedShard.byteLength,
          },
        }),
      assertCode('WPP_SCHEMA'),
    );
  });
});
