import { deepEqual, equal, match, notEqual, ok, throws } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto, { createDecipheriv, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import canonicalize from 'canonicalize';

import { CatalogError, parseCatalog } from '../dist/catalog/index.js';
import { aeadEncrypt, deriveKeys } from '../dist/kernel/crypto.js';
import { UnlockedVault } from '../dist/kernel/index.js';
import { KernelError } from '../dist/kernel/json.js';

const fixtures = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/catalog-v1-examples.json', import.meta.url)), 'utf8'),
);
const vector = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/wpp-v1-vectors.json', import.meta.url)), 'utf8'),
);

const CATALOG_NAMES = [
  'baseline',
  'forkA',
  'forkB',
  'tombstoned',
  'rootUpdateOldEpoch',
  'rootUpdateNewEpoch',
];
const MiB = 1024 * 1024;
const SECRET_MARKER = 'WPP_TEST_SECRET_MARKER_c0ffee91';
const PYTHON_DECRYPT = `
import base64, hashlib, hmac, json, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def b64url_decode(value):
    pad = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + pad)

def hmac_sha256(key, data):
    return hmac.new(key, data, hashlib.sha256).digest()

def expand32(parent, info):
    return hmac_sha256(parent, info + b"\\x01")

msg = json.load(sys.stdin)
header = msg["header"]
secret_root = bytes.fromhex(msg["secretRootHex"])
vault_salt = b64url_decode(header["vaultSalt"])
prk = hmac_sha256(vault_salt, secret_root)
scope_info = json.dumps(
    ["WPP", "1", "scope", header["vaultId"], header["rootEpoch"], header["scopeId"]],
    separators=(",", ":"),
).encode("utf-8")
object_info = json.dumps(
    ["WPP", "1", "object", header["kind"], header["recordId"], header["generationId"]],
    separators=(",", ":"),
).encode("utf-8")
scope_key = expand32(prk, scope_info)
object_key = expand32(scope_key, object_info)
aad = json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
nonce = b64url_decode(header["nonce"])
ciphertext = b64url_decode(msg["ciphertext"])
tag = b64url_decode(msg["tag"])
plaintext = AESGCM(object_key).decrypt(nonce, ciphertext + tag, aad)
sys.stdout.write(json.dumps({
    "prkHex": prk.hex(),
    "scopeKeyHex": scope_key.hex(),
    "objectKeyHex": object_key.hex(),
    "aadHex": aad.hex(),
    "plaintextUtf8": plaintext.decode("utf-8"),
}))
`;

const utf8 = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
const id16 = (fill) => b64(Buffer.alloc(16, fill));
const id32 = (fill) => b64(Buffer.alloc(32, fill));
const digest = (index) => index.toString(16).padStart(64, '0');
const xorByte = (bytes, index = 0) => {
  const out = Buffer.from(bytes);
  out[index] ^= 0xff;
  return out;
};
const tamperB64url = (encoded, index = 0) => xorByte(Buffer.from(encoded, 'base64url'), index).toString('base64url');
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function catalogNamed(name) {
  return clone(fixtures.catalogs[name]);
}

function snapshotOf(catalog) {
  return catalog.entries.find((entry) => entry.entryKind === 'snapshot');
}

function locator(index) {
  return {
    provider: 'google-drive',
    accountBinding: { scheme: 'synthetic-fixture', value: 'fixture-account' },
    objectId: `synObj${index}`,
    revisionId: `synRev${index}`,
  };
}

function makeSnapshot(index, extra = {}) {
  const entry = clone(snapshotOf(catalogNamed('baseline')));
  entry.package = {
    ...entry.package,
    sha256: digest(index),
    generationId: b64(Buffer.alloc(32, index)),
    ...extra.package,
  };
  if (extra.locators) {
    entry.locators = extra.locators.map((item) => clone(item));
  } else {
    entry.locators = [locator(index)];
  }
  return entry;
}

function catalogWith(entries, observations = [], parents = []) {
  return {
    payloadVersion: 1,
    parents,
    entries,
    observations,
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

function vectorRoot(overrides = {}) {
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
    epochs: [
      {
        rootEpoch: header.rootEpoch,
        secretRoot: b64(Buffer.from(vector.inputs.secretRootHex, 'hex')),
        createdAt: '2026-09-19T00:00:00Z',
        status: 'active',
      },
    ],
    ...overrides,
  };
}

function payload(content) {
  return {
    payloadVersion: 1,
    metadata: {
      network: { id: 'synthetic-local', genesisHash: null },
      accountBinding: { scheme: 'synthetic-fixture', value: 'fixture-account' },
      applicationId: 'wpp-vector-fixture',
      contract: { address: 'synthetic-contract', codeHash: null },
      privateStateIds: ['fixture-state'],
      codec: {
        id: 'wpp.test-app',
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
    content,
  };
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

function unlock(root = randomRoot(), codecs = []) {
  const rootUtf8 = Uint8Array.from(utf8(JSON.stringify(root)));
  const vault = UnlockedVault.fromRootRecord(rootUtf8, codecs);
  return { root, rootUtf8, vault };
}

function nest(depth) {
  let value = { leaf: true };
  for (let i = 1; i < depth; i += 1) {
    value = { n: value };
  }
  return value;
}

function assertPublicError(err) {
  ok(err instanceof Error);
  const text = `${err.name}\n${err.message}\n${err.code ?? ''}\n${err.stack ?? ''}`;
  equal(text.includes(SECRET_MARKER), false);
  match(String(err.message), /^(WPP|CATALOG)_[A-Z0-9_]+$/);
  match(String(err.code ?? err.message), /^(WPP|CATALOG)_[A-Z0-9_]+$/);
  equal(String(err.message).includes('must '), false);
  equal(String(err.message).includes('required property'), false);
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

const CALLER_SENTINEL = 'CALLER_SECRET_SENTINEL';

function hostileByteProxy(target = new Uint8Array([1, 2, 3])) {
  let traps = 0;
  const proxy = new Proxy(target, {
    getPrototypeOf() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    setPrototypeOf() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    getOwnPropertyDescriptor() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    defineProperty() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    has() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    get() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    set() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    ownKeys() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
  });
  return { proxy, traps: () => traps };
}

function thrownHostileByteProxy(target = new Uint8Array([1, 2, 3])) {
  let traps = 0;
  const thrown = new Proxy(
    {},
    {
      getPrototypeOf() {
        traps += 1;
        throw new Error(CALLER_SENTINEL);
      },
    },
  );
  const proxy = new Proxy(target, {
    getPrototypeOf() {
      traps += 1;
      throw thrown;
    },
  });
  return { proxy, traps: () => traps };
}

function detachCopy(bytes) {
  const copy = new Uint8Array(bytes);
  copy.buffer.transfer();
  return copy;
}

function encryptCatalogEnvelope(root, catalogObject, options = {}) {
  const epoch = options.epoch ?? root.epochs[0];
  const plaintext =
    options.plaintext !== undefined
      ? Buffer.from(options.plaintext)
      : Buffer.from(canonicalize(catalogObject), 'utf8');
  const generation = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);
  const header = {
    format: 'wpp-witness-package',
    version: 1,
    suite: 'HKDF-SHA256+A256GCM',
    vaultId: root.vaultId,
    vaultSalt: root.vaultSalt,
    rootEpoch: epoch.rootEpoch,
    scopeId: root.catalogScopeId,
    recordId: root.catalogRecordId,
    generationId: b64(generation),
    kind: 'catalog',
    nonce: b64(nonce),
  };
  const secretRoot = Buffer.from(epoch.secretRoot, 'base64url');
  const keys = deriveKeys(secretRoot, header);
  try {
    const aad = Buffer.from(canonicalize(header), 'utf8');
    const sealed = aeadEncrypt(keys.objectKey, nonce, aad, plaintext);
    const wireObject = {
      header,
      ciphertext: Buffer.from(sealed.ciphertext).toString('base64url'),
      tag: Buffer.from(sealed.tag).toString('base64url'),
    };
    const wire = Buffer.from(canonicalize(wireObject), 'utf8');
    return { header, plaintext, wire, sha256: sha256Hex(wire) };
  } finally {
    keys.prk.fill(0);
    keys.scopeKey.fill(0);
    keys.objectKey.fill(0);
    keys.nativeKey.fill(0);
  }
}

function mutateWire(wire, mutate) {
  const parsed = JSON.parse(Buffer.from(wire).toString('utf8'));
  mutate(parsed);
  return utf8(JSON.stringify(parsed));
}

describe('UnlockedVault catalog kernel', () => {
  test('valid catalog fixtures seal and open with kind=catalog and root identifiers', () => {
    const { vault, root } = unlock();
    for (const name of CATALOG_NAMES) {
      const catalog = catalogNamed(name);
      const sealed = vault.sealCatalog(utf8(catalog));
      const opened = vault.openCatalog(sealed.wire);
      equal(opened.packageSha256, sealed.sha256);
      equal(opened.header.kind, 'catalog');
      equal(opened.header.scopeId, root.catalogScopeId);
      equal(opened.header.recordId, root.catalogRecordId);
      equal(opened.header.vaultId, root.vaultId);
      equal(opened.header.vaultSalt, root.vaultSalt);
      equal(opened.header.rootEpoch, root.epochs[0].rootEpoch);
      equal(opened.catalog.payloadVersion, 1);
      ok(Object.isFrozen(opened.catalog));
      equal(opened.catalog.entries.length, parseCatalog(utf8(catalog)).entries.length);
    }
  });

  test('fresh catalog seals use new generation identifiers and nonces', () => {
    const { vault } = unlock();
    const body = utf8(catalogNamed('baseline'));
    const first = vault.sealCatalog(body);
    const second = vault.sealCatalog(body);
    notEqual(Buffer.from(first.wire).toString(), Buffer.from(second.wire).toString());
    notEqual(first.sha256, second.sha256);
    const headerA = JSON.parse(Buffer.from(first.wire).toString()).header;
    const headerB = JSON.parse(Buffer.from(second.wire).toString()).header;
    notEqual(headerA.generationId, headerB.generationId);
    notEqual(headerA.nonce, headerB.nonce);
    equal(headerA.scopeId, headerB.scopeId);
    equal(headerA.recordId, headerB.recordId);
    equal(headerA.kind, 'catalog');
  });

  test('sealCatalog ignores extra caller identifiers and keeps root catalog IDs private', () => {
    const { vault, root } = unlock();
    const sealed = vault.sealCatalog(utf8(catalogNamed('baseline')), {
      scopeId: id32(0x11),
      recordId: id32(0x22),
    });
    const header = JSON.parse(Buffer.from(sealed.wire).toString()).header;
    equal(header.scopeId, root.catalogScopeId);
    equal(header.recordId, root.catalogRecordId);
    equal('catalogScopeId' in vault, false);
    equal('catalogRecordId' in vault, false);
    equal(typeof vault.catalogScopeId, 'undefined');
    equal(typeof vault.catalogRecordId, 'undefined');
  });

  test('snapshot APIs reject catalog envelopes and catalog APIs reject snapshot envelopes', () => {
    const appCodec = {
      id: 'wpp.test-app',
      validate(content) {
        if (content === null || typeof content !== 'object' || Array.isArray(content)) {
          throw new Error('CODEC');
        }
      },
    };
    const { vault, root } = unlock(randomRoot(), [appCodec]);
    const catalogSealed = vault.sealCatalog(utf8(catalogNamed('baseline')));
    const body = payload({ ok: true });
    const scopeId = b64(crypto.randomBytes(32));
    const recordId = b64(crypto.randomBytes(32));
    const snapshotSealed = vault.sealSnapshot({
      scopeId,
      recordId,
      payloadUtf8: utf8(JSON.stringify(body)),
    });
    throws(
      () => vault.openSnapshot(catalogSealed.wire, expectedOf(body.metadata, root.catalogScopeId, root.catalogRecordId)),
      assertCode('WPP_UNSUPPORTED'),
    );
    throws(() => vault.openCatalog(snapshotSealed.wire), assertCode('WPP_UNSUPPORTED'));
    const openedSnapshot = vault.openSnapshot(snapshotSealed.wire, expectedOf(body.metadata, scopeId, recordId));
    equal(openedSnapshot.header.kind, 'snapshot');
    deepEqual(openedSnapshot.content, body.content);
  });

  test('wrong key, epoch, vault, salt, scope, record, kind, tag, and ciphertext reject without a catalog', () => {
    const { vault, root } = unlock();
    const sealed = vault.sealCatalog(utf8(catalogNamed('baseline')));
    const good = vault.openCatalog(sealed.wire);
    equal(good.catalog.payloadVersion, 1);
    const parsed = JSON.parse(Buffer.from(sealed.wire).toString());

    let returned;
    throws(
      () => {
        returned = vault.openCatalog(mutateWire(sealed.wire, (pack) => {
          pack.tag = tamperB64url(pack.tag);
        }));
      },
      assertCode('WPP_AUTH'),
    );
    equal(returned, undefined);

    throws(
      () => vault.openCatalog(mutateWire(sealed.wire, (pack) => {
        pack.ciphertext = tamperB64url(pack.ciphertext);
      })),
      assertCode('WPP_AUTH'),
    );
    throws(
      () => vault.openCatalog(mutateWire(sealed.wire, (pack) => {
        pack.header.kind = 'snapshot';
      })),
      assertCode('WPP_UNSUPPORTED'),
    );
    throws(
      () => vault.openCatalog(mutateWire(sealed.wire, (pack) => {
        pack.header.rootEpoch = id16(0x11);
      })),
      assertCode('WPP_EPOCH'),
    );
    throws(
      () => vault.openCatalog(mutateWire(sealed.wire, (pack) => {
        pack.header.vaultId = id16(0x33);
      })),
      assertCode('WPP_ROOT'),
    );
    throws(
      () => vault.openCatalog(mutateWire(sealed.wire, (pack) => {
        pack.header.vaultSalt = id32(0x44);
      })),
      assertCode('WPP_ROOT'),
    );
    throws(
      () => vault.openCatalog(mutateWire(sealed.wire, (pack) => {
        pack.header.scopeId = id32(0x55);
      })),
      assertCode('WPP_BINDING'),
    );
    throws(
      () => vault.openCatalog(mutateWire(sealed.wire, (pack) => {
        pack.header.recordId = id32(0x66);
      })),
      assertCode('WPP_BINDING'),
    );

    const otherKey = unlock(
      {
        ...root,
        epochs: [{ ...root.epochs[0], secretRoot: id32(0x99) }],
      },
    );
    throws(() => otherKey.vault.openCatalog(sealed.wire), assertCode('WPP_AUTH'));

    const otherVault = unlock({
      ...root,
      vaultId: id16(0x21),
      vaultSalt: id32(0x22),
    });
    throws(() => otherVault.vault.openCatalog(sealed.wire), assertCode('WPP_ROOT'));
    equal(parsed.header.kind, 'catalog');
  });

  test('malformed, deep, duplicate, and oversize catalog payloads reject without return', () => {
    const { vault } = unlock();
    const good = utf8(catalogNamed('baseline'));
    let sealed;
    throws(
      () => {
        sealed = vault.sealCatalog(utf8('{not-json'));
      },
      assertPublicError,
    );
    equal(sealed, undefined);
    throws(() => vault.sealCatalog(utf8(nest(33))), assertPublicError);
    throws(
      () => vault.sealCatalog(utf8(JSON.stringify(catalogNamed('baseline')).replace('"payloadVersion":1', '"payloadVersion":1,"payloadVersion":2'))),
      assertCode('WPP_JSON_DUPLICATE_KEY'),
    );
    throws(() => vault.sealCatalog(Buffer.alloc(16 * MiB + 1, 0x20)), assertCode('WPP_INPUT_TOO_LARGE'));

    const oversize = catalogWith(Array.from({ length: 1001 }, (_, i) => makeSnapshot(i + 1)));
    throws(() => vault.sealCatalog(utf8(oversize)), assertPublicError);

    const conflict = catalogNamed('tombstoned');
    const extra = clone(conflict.entries.find((entry) => entry.entryKind === 'tombstone'));
    extra.reason = 'superseded';
    conflict.entries.push(extra);
    throws(() => vault.sealCatalog(utf8(conflict)), assertPublicError);

    const missingField = { payloadVersion: 1, parents: [], entries: [], observations: [] };
    delete missingField.parents;
    throws(() => vault.sealCatalog(utf8(missingField)), assertPublicError);
  });

  test('authenticated noncanonical catalog plaintext rejects', () => {
    const { vault, root } = unlock();
    const sealed = vault.sealCatalog(utf8(catalogNamed('baseline')));
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
      const noncanonical = `${plain.toString('utf8').slice(0, -1)} }`;
      notEqual(noncanonical, plain.toString('utf8'));
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
      let opened;
      throws(
        () => {
          opened = vault.openCatalog(utf8(JSON.stringify(mutant)));
        },
        assertCode('WPP_NONCANONICAL'),
      );
      equal(opened, undefined);
    } finally {
      keys.prk.fill(0);
      keys.scopeKey.fill(0);
      keys.objectKey.fill(0);
      keys.nativeKey.fill(0);
    }
  });

  test('valid authenticated catalog with pre-normalization array order opens without changing the wire hash', () => {
    const { vault, root } = unlock();
    const catalog = catalogNamed('baseline');
    const originalLocator = clone(catalog.entries[0].locators[0]);
    const earlyLocator = {
      provider: 'google-drive',
      accountBinding: { scheme: 'synthetic-fixture', value: 'fixture-account' },
      objectId: 'aaaFixtureObjectEarlier',
      revisionId: 'aaaFixtureRev0',
    };
    catalog.parents = [digest(255), digest(1)];
    catalog.entries[0].locators = [originalLocator, earlyLocator];
    const canonicalParents = [...catalog.parents].sort();
    notEqual(catalog.parents[0], canonicalParents[0]);
    const envelope = encryptCatalogEnvelope(root, catalog);
    const wireCopy = Buffer.from(envelope.wire);
    const opened = vault.openCatalog(envelope.wire);
    equal(opened.packageSha256, envelope.sha256);
    equal(sha256Hex(envelope.wire), envelope.sha256);
    deepEqual(Buffer.from(envelope.wire), wireCopy);
    deepEqual(opened.catalog.parents, canonicalParents);
    equal(opened.catalog.entries[0].locators[0].objectId, earlyLocator.objectId);
    equal(opened.catalog.entries[0].locators[1].objectId, originalLocator.objectId);
    equal(opened.header.kind, 'catalog');
  });

  test('lock prevents catalog seal and open', () => {
    const { vault, rootUtf8 } = unlock();
    const sealed = vault.sealCatalog(utf8(catalogNamed('baseline')));
    const rootCopy = Buffer.from(rootUtf8);
    vault.lock();
    equal(vault.locked, true);
    vault.lock();
    throws(() => vault.sealCatalog(utf8(catalogNamed('baseline'))), assertCode('WPP_LOCKED'));
    throws(() => vault.openCatalog(sealed.wire), assertCode('WPP_LOCKED'));
    deepEqual(Buffer.from(rootUtf8), rootCopy);
  });

  test('root recovery then catalog open in a fresh process', () => {
    const { vault } = unlock();
    const sealed = vault.sealCatalog(utf8(catalogNamed('baseline')));
    const pack = vault.createRecoveryPack();
    const childSource = `
import { UnlockedVault } from ${JSON.stringify(new URL('../dist/kernel/index.js', import.meta.url).href)};
const input = JSON.parse(Buffer.from(process.argv[1], 'base64url').toString('utf8'));
const vault = UnlockedVault.fromRecoveryPack(
  Buffer.from(input.recoveryWire, 'base64url'),
  Buffer.from(input.recoveryKey, 'base64url'),
  [],
);
const opened = vault.openCatalog(Buffer.from(input.catalogWire, 'base64url'));
process.stdout.write(JSON.stringify({
  ok: true,
  packageSha256: opened.packageSha256,
  payloadVersion: opened.catalog.payloadVersion,
  kind: opened.header.kind,
}));
`;
    const payloadB64 = Buffer.from(
      JSON.stringify({
        recoveryWire: Buffer.from(pack.wire).toString('base64url'),
        recoveryKey: Buffer.from(pack.recoveryKey).toString('base64url'),
        catalogWire: Buffer.from(sealed.wire).toString('base64url'),
      }),
      'utf8',
    ).toString('base64url');
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', childSource, payloadB64], {
      encoding: 'utf8',
      timeout: 20000,
    });
    equal(child.status, 0, child.stderr);
    const receipt = JSON.parse(child.stdout);
    equal(receipt.ok, true);
    equal(receipt.packageSha256, sealed.sha256);
    equal(receipt.payloadVersion, 1);
    equal(receipt.kind, 'catalog');
    equal(child.stdout.includes(SECRET_MARKER), false);
  });

  test('independent Python decrypt agrees with Node derivation and AAD', () => {
    const { vault, root } = unlock();
    const sealed = vault.sealCatalog(utf8(catalogNamed('baseline')));
    const parsed = JSON.parse(Buffer.from(sealed.wire).toString());
    const secretRoot = Buffer.from(root.epochs[0].secretRoot, 'base64url');
    const keys = deriveKeys(secretRoot, parsed.header);
    try {
      const nonce = Buffer.from(parsed.header.nonce, 'base64url');
      const aad = Buffer.from(canonicalize(parsed.header), 'utf8');
      const decipher = createDecipheriv('aes-256-gcm', keys.objectKey, nonce, { authTagLength: 16 });
      decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
      const nodePlain = Buffer.concat([
        decipher.update(Buffer.from(parsed.ciphertext, 'base64url')),
        decipher.final(),
      ]);
      const python = spawnSync(
        'python3',
        ['-c', PYTHON_DECRYPT],
        {
          input: JSON.stringify({
            secretRootHex: secretRoot.toString('hex'),
            header: parsed.header,
            ciphertext: parsed.ciphertext,
            tag: parsed.tag,
          }),
          encoding: 'utf8',
          timeout: 20000,
        },
      );
      equal(python.status, 0, python.stderr);
      const independent = JSON.parse(python.stdout);
      equal(independent.prkHex, keys.prk.toString('hex'));
      equal(independent.scopeKeyHex, keys.scopeKey.toString('hex'));
      equal(independent.objectKeyHex, keys.objectKey.toString('hex'));
      equal(independent.aadHex, aad.toString('hex'));
      equal(independent.plaintextUtf8, nodePlain.toString('utf8'));
      const opened = vault.openCatalog(sealed.wire);
      equal(JSON.parse(independent.plaintextUtf8).payloadVersion, opened.catalog.payloadVersion);
    } finally {
      keys.prk.fill(0);
      keys.scopeKey.fill(0);
      keys.objectKey.fill(0);
      keys.nativeKey.fill(0);
    }
  });

  test('catalog parse failures stay static and do not return data', () => {
    const { vault } = unlock();
    let opened;
    const sealed = vault.sealCatalog(utf8(catalogNamed('baseline')));
    const parsed = JSON.parse(Buffer.from(sealed.wire).toString());
    parsed.header.kind = 'catalog';
    throws(
      () => {
        opened = vault.sealCatalog(utf8({ payloadVersion: 2, parents: [], entries: [], observations: [] }));
      },
      (err) => {
        assertPublicError(err);
        ok(err instanceof KernelError || err instanceof CatalogError);
        return true;
      },
    );
    equal(opened, undefined);
    equal(parsed.header.kind, 'catalog');
  });

  test('sealCatalog and openCatalog reject hostile byte proxies without executing traps', () => {
    const { vault } = unlock();
    const payload = utf8(catalogNamed('baseline'));
    const sealed = vault.sealCatalog(payload);
    const cases = [
      ['seal trap', () => hostileByteProxy(payload), (proxy) => vault.sealCatalog(proxy)],
      ['open trap', () => hostileByteProxy(sealed.wire), (proxy) => vault.openCatalog(proxy)],
      ['seal thrown proxy', () => thrownHostileByteProxy(payload), (proxy) => vault.sealCatalog(proxy)],
      ['open thrown proxy', () => thrownHostileByteProxy(sealed.wire), (proxy) => vault.openCatalog(proxy)],
    ];
    for (const [title, makeHostile, invoke] of cases) {
      const { proxy, traps } = makeHostile();
      let returned;
      throws(
        () => {
          returned = invoke(proxy);
        },
        (err) => {
          assertCode('WPP_SCHEMA')(err);
          equal(String(err.message).includes(CALLER_SENTINEL), false, title);
          equal(String(err.stack ?? '').includes(CALLER_SENTINEL), false, title);
          return true;
        },
        title,
      );
      equal(returned, undefined, title);
      equal(traps(), 0, title);
    }
  });

  test('sealCatalog and openCatalog reject revoked proxies without leaking TypeError', () => {
    const { vault } = unlock();
    const payload = utf8(catalogNamed('baseline'));
    const sealed = vault.sealCatalog(payload);
    for (const [title, target, invoke] of [
      ['seal revoked', payload, (proxy) => vault.sealCatalog(proxy)],
      ['open revoked', sealed.wire, (proxy) => vault.openCatalog(proxy)],
    ]) {
      const { proxy, revoke } = Proxy.revocable(Uint8Array.from(target), {});
      revoke();
      let returned;
      throws(
        () => {
          returned = invoke(proxy);
        },
        (err) => {
          assertCode('WPP_SCHEMA')(err);
          equal(String(err.name).includes('TypeError'), false, title);
          equal(String(err.message).includes('revoked'), false, title);
          return true;
        },
        title,
      );
      equal(returned, undefined, title);
    }
  });

  test('sealCatalog and openCatalog reject detached buffers and keep oversized static codes', () => {
    const { vault } = unlock();
    const payload = utf8(catalogNamed('baseline'));
    const sealed = vault.sealCatalog(payload);
    let sealedDetached;
    throws(
      () => {
        sealedDetached = vault.sealCatalog(detachCopy(payload));
      },
      assertCode('WPP_SCHEMA'),
    );
    equal(sealedDetached, undefined);
    let openedDetached;
    throws(
      () => {
        openedDetached = vault.openCatalog(detachCopy(sealed.wire));
      },
      assertCode('WPP_SCHEMA'),
    );
    equal(openedDetached, undefined);
    throws(() => vault.sealCatalog(Buffer.alloc(16 * MiB + 1, 0x20)), assertCode('WPP_INPUT_TOO_LARGE'));
    throws(() => vault.openCatalog(Buffer.alloc(24 * MiB + 1, 0x20)), assertCode('WPP_INPUT_TOO_LARGE'));
  });

  test('retired epoch remains readable, new seals use the active epoch, and absent epochs reject', () => {
    const epochA = {
      rootEpoch: b64(crypto.randomBytes(16)),
      secretRoot: b64(crypto.randomBytes(32)),
      createdAt: '2026-09-19T00:00:00Z',
      status: 'active',
    };
    const epochB = {
      rootEpoch: b64(crypto.randomBytes(16)),
      secretRoot: b64(crypto.randomBytes(32)),
      createdAt: '2026-09-19T00:01:00Z',
      status: 'active',
    };
    const base = randomRoot();
    const { vault: vaultA } = unlock({ ...base, epochs: [epochA] });
    const sealedA = vaultA.sealCatalog(utf8(catalogNamed('baseline')));
    const headerA = JSON.parse(Buffer.from(sealedA.wire).toString()).header;
    equal(headerA.rootEpoch, epochA.rootEpoch);
    equal(headerA.kind, 'catalog');

    const { vault: vaultRotated } = unlock({
      ...base,
      revisionId: b64(crypto.randomBytes(32)),
      epochs: [{ ...epochA, status: 'retired' }, epochB],
    });
    const openedA = vaultRotated.openCatalog(sealedA.wire);
    equal(openedA.header.rootEpoch, epochA.rootEpoch);
    equal(openedA.catalog.payloadVersion, 1);
    equal(openedA.header.scopeId, base.catalogScopeId);
    equal(openedA.header.recordId, base.catalogRecordId);

    const sealedB = vaultRotated.sealCatalog(utf8(catalogNamed('forkA')));
    const headerB = JSON.parse(Buffer.from(sealedB.wire).toString()).header;
    equal(headerB.rootEpoch, epochB.rootEpoch);
    notEqual(headerB.rootEpoch, epochA.rootEpoch);
    const openedB = vaultRotated.openCatalog(sealedB.wire);
    equal(openedB.header.rootEpoch, epochB.rootEpoch);
    equal(openedB.catalog.payloadVersion, 1);

    const { vault: vaultAbsentA } = unlock({
      ...base,
      revisionId: b64(crypto.randomBytes(32)),
      epochs: [epochB],
    });
    let openedAbsent;
    throws(
      () => {
        openedAbsent = vaultAbsentA.openCatalog(sealedA.wire);
      },
      assertCode('WPP_EPOCH'),
    );
    equal(openedAbsent, undefined);
  });

  test('authenticated malformed catalog plaintext rejects on open before a catalog is returned', () => {
    const { vault, root } = unlock();
    const duplicate = utf8(
      JSON.stringify(catalogNamed('baseline')).replace('"payloadVersion":1', '"payloadVersion":1,"payloadVersion":2'),
    );
    const invalidJson = utf8('{not-json');
    const deep = utf8(JSON.stringify(nest(33)));
    const missingParents = catalogNamed('baseline');
    delete missingParents.parents;
    const badReceipt = catalogNamed('rootUpdateOldEpoch');
    const receipt = badReceipt.entries.find((entry) => entry.entryKind === 'root-update-receipt');
    receipt.newActiveEpoch = receipt.retainedOldEpochs[0];
    const badObservation = catalogNamed('baseline');
    badObservation.observations[0].packageSha256 = digest(7);
    const noncanonical = utf8(`${JSON.stringify(catalogNamed('baseline')).slice(0, -1)} }`);

    const cases = [
      ['duplicate keys', duplicate, 'WPP_JSON_DUPLICATE_KEY'],
      ['invalid json', invalidJson, 'WPP_JSON_PARSE'],
      ['deep json', deep, 'WPP_JSON_DEPTH'],
      ['invalid catalog shape', utf8(canonicalize(missingParents)), 'WPP_SCHEMA'],
      ['invalid receipt', utf8(canonicalize(badReceipt)), 'WPP_SCHEMA'],
      ['invalid observation', utf8(canonicalize(badObservation)), 'WPP_SCHEMA'],
      ['noncanonical encoding', noncanonical, 'WPP_NONCANONICAL'],
    ];
    for (const [title, plaintext, code] of cases) {
      const envelope = encryptCatalogEnvelope(root, catalogNamed('baseline'), { plaintext });
      let opened;
      throws(
        () => {
          opened = vault.openCatalog(envelope.wire);
        },
        assertCode(code),
        title,
      );
      equal(opened, undefined, title);
      equal(envelope.header.kind, 'catalog', title);
      equal(envelope.header.vaultId, root.vaultId, title);
      equal(envelope.header.scopeId, root.catalogScopeId, title);
      equal(envelope.header.recordId, root.catalogRecordId, title);
    }

    const validOrder = encryptCatalogEnvelope(root, catalogNamed('baseline'));
    const openedValid = vault.openCatalog(validOrder.wire);
    equal(openedValid.header.kind, 'catalog');
    equal(openedValid.packageSha256, validOrder.sha256);
  });
});
