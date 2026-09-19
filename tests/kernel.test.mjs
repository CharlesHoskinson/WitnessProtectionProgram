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
    network: meta.network,
    accountBinding: meta.accountBinding,
    applicationId: meta.applicationId,
    contract: meta.contract,
    codec: meta.codec,
  };
}

function vectorExpected() {
  return expectedOf(vector.inputs.payload.metadata, vector.inputs.header.scopeId, vector.inputs.header.recordId);
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
      ['tag', { ...parsed, tag: tamperB64url(parsed.tag) }],
      ['ciphertext', { ...parsed, ciphertext: tamperB64url(parsed.ciphertext) }],
      ['header suite', { ...parsed, header: { ...parsed.header, suite: 'A256GCM' } }],
      ['header kind catalog', { ...parsed, header: { ...parsed.header, kind: 'catalog' } }],
      ['header epoch', { ...parsed, header: { ...parsed.header, rootEpoch: id16(0x11) } }],
      ['header version', { ...parsed, header: { ...parsed.header, version: 2 } }],
      ['unknown header field', { ...parsed, header: { ...parsed.header, extra: 1 } }],
      ['unknown wire field', { ...parsed, extra: 1 }],
      ['vaultId pad bits', { ...parsed, header: { ...parsed.header, vaultId: `${parsed.header.vaultId.slice(0, -1)}B` } }],
      ['padded id', { ...parsed, header: { ...parsed.header, nonce: `${parsed.header.nonce}==` } }],
    ];
    for (const [title, mutant] of cases) {
      throws(() => vault.openSnapshot(utf8(JSON.stringify(mutant)), vectorExpected()), title);
    }
    const other = UnlockedVault.fromRootRecord(
      utf8(JSON.stringify(vectorRoot([{ ...activeEpoch(), secretRoot: id32(0x99) }]))),
      [vectorCodec],
    );
    throws(() => other.openSnapshot(utf8(vector.expected.wireUtf8), vectorExpected()));
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
      ['escaped duplicate', utf8(JSON.stringify(payload({ unused: 0 })).replace('{"unused":0}', '{"x":1,"\\u0078":2}'))],
      ['nested duplicate', utf8(good.replace('{"x":1,"y":2}', '{"x":1,"x":2}'))],
      ['depth 33', utf8(JSON.stringify(payload(nest(32))))],
      ['empty', Buffer.alloc(0)],
      ['BOM', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), utf8(good)])],
      ['malformed UTF-8', Buffer.concat([utf8(good.slice(0, 2)), Buffer.from([0x80]), utf8(good.slice(2))])],
      ['plaintext ceiling', withTrailingSpaces(goodBytes, 16 * MiB + 1)],
    ];
    for (const [title, bytes] of parseFails) {
      throws(() => vault.sealSnapshot({ scopeId, recordId, payloadUtf8: bytes }), title);
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
});
