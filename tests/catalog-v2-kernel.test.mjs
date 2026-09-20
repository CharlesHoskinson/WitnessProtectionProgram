import { deepEqual, equal, match, notEqual, ok, throws } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto, { createDecipheriv, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import canonicalize from 'canonicalize';

import { parseCatalog } from '../dist/catalog/index.js';
import { aeadEncrypt, deriveKeys } from '../dist/kernel/crypto.js';
import { UnlockedVault } from '../dist/kernel/index.js';
import { KernelError } from '../dist/kernel/json.js';
import {
  CATALOG_V2_LIMITS,
  ERR_CATALOG_CAPACITY,
  ERR_CATALOG_REFERENCE,
  ERR_CATALOG_ROLE,
  catalogRouteHash,
  planCatalogShards,
  validateCatalogRevision,
} from '../dist/storage/index.js';

const fixtures = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/catalog-v1-examples.json', import.meta.url)), 'utf8'),
);
const kernelVectors = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/catalog-v2-kernel-vectors.json', import.meta.url)), 'utf8'),
);

const MiB = 1024 * 1024;
const SECRET_MARKER = 'WPP_TEST_SECRET_MARKER_c0ffee91';
const CALLER_SENTINEL = 'CALLER_SECRET_SENTINEL';
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
const canonicalBytes = (value) => Buffer.from(canonicalize(value));
const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
const id16 = (fill) => b64(Buffer.alloc(16, fill));
const id32 = (fill) => b64(Buffer.alloc(32, fill));
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
const xorByte = (bytes, index = 0) => {
  const out = Buffer.from(bytes);
  out[index] ^= 0xff;
  return out;
};
const tamperB64url = (encoded, index = 0) => xorByte(Buffer.from(encoded, 'base64url'), index).toString('base64url');
const digestFromIndex = (i) => sha256Hex(utf8(`digest:${i}`));
const id16FromIndex = (i) => {
  const buf = Buffer.alloc(16);
  buf.writeUInt32BE(i >>> 0, 0);
  return buf.toString('base64url');
};
const id32FromIndex = (i) => {
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(i >>> 0, 0);
  return buf.toString('base64url');
};

const BASE_METADATA = {
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
};

function locator(suffix, extras = {}) {
  return {
    provider: 'google-drive',
    accountBinding: {
      scheme: 'google-drive-permission-id',
      value: extras.permissionId ?? `perm${suffix}`,
    },
    objectId: extras.objectId ?? `obj${suffix}`,
    revisionId: Object.prototype.hasOwnProperty.call(extras, 'revisionId')
      ? extras.revisionId
      : `rev${suffix}`,
  };
}

function snapshotRecord(index, opts = {}) {
  const locators = opts.locators ?? [locator(String(index))];
  return {
    recordKind: 'snapshot',
    body: {
      entryKind: 'snapshot',
      package: {
        sha256: opts.digest ?? digestFromIndex(index),
        byteLength: opts.byteLength ?? 1024,
        rootEpoch: opts.rootEpoch,
        scopeId: opts.scopeId ?? id32FromIndex(2),
        recordId: opts.recordId ?? id32FromIndex(0x10000 + index),
        generationId: opts.generationId ?? id32FromIndex(0x20000 + index),
      },
      metadata: opts.metadata ?? { ...BASE_METADATA },
      label: Object.prototype.hasOwnProperty.call(opts, 'label') ? opts.label : `synthetic-${index}`,
      locators,
    },
  };
}

function randomRoot(extraEpochs = []) {
  const active = {
    rootEpoch: b64(crypto.randomBytes(16)),
    secretRoot: b64(crypto.randomBytes(32)),
    createdAt: '2026-09-19T00:00:00Z',
    status: 'active',
  };
  return {
    format: 'wpp-root-record',
    version: 1,
    revisionId: b64(crypto.randomBytes(32)),
    parents: [],
    vaultId: b64(crypto.randomBytes(16)),
    vaultSalt: b64(crypto.randomBytes(32)),
    catalogScopeId: b64(crypto.randomBytes(32)),
    catalogRecordId: b64(crypto.randomBytes(32)),
    epochs: [active, ...extraEpochs],
  };
}

function unlock(root = randomRoot(), codecs = []) {
  const rootUtf8 = Uint8Array.from(utf8(JSON.stringify(root)));
  const vault = UnlockedVault.fromRootRecord(rootUtf8, codecs);
  return { root, rootUtf8, vault };
}

function activeEpochOf(root) {
  return root.epochs.find((epoch) => epoch.status === 'active');
}

function requiredEpochsFor(root, plan) {
  const set = new Set(plan.requiredEpochs);
  set.add(activeEpochOf(root).rootEpoch);
  return [...set].sort();
}

function planRecords(records) {
  return planCatalogShards(canonicalBytes(records));
}

function headerOf(wire) {
  return JSON.parse(Buffer.from(wire).toString('utf8')).header;
}

function mutateWire(wire, mutate) {
  const parsed = JSON.parse(Buffer.from(wire).toString('utf8'));
  mutate(parsed);
  return utf8(JSON.stringify(parsed));
}

function shardReference(leaf, sealed, loc = locator('leaf')) {
  const header = headerOf(sealed.wire);
  return {
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
    locators: [loc],
  };
}

function sealPlan(vault, root, plan) {
  const references = [];
  const shards = [];
  const plains = [];
  for (const leaf of plan.leaves) {
    if (leaf.empty) {
      references.push({ prefix: leaf.prefix, empty: true });
      continue;
    }
    const payload = Buffer.from(leaf.payloadUtf8);
    const sealed = vault.sealCatalogNode(payload);
    const reference = shardReference(leaf, sealed);
    references.push(reference);
    shards.push({ leaf, sealed, reference, payload });
    plains.push(payload);
  }
  const rootPayload = {
    payloadVersion: 2,
    nodeType: 'root',
    partitionVersion: 1,
    parents: [],
    entryCount: plan.entryCount,
    observationCount: plan.observationCount,
    requiredEpochs: requiredEpochsFor(root, plan),
    references,
  };
  return { rootPayload, shards, plains };
}

function encryptNode(root, payloadObject, options = {}) {
  const epoch = options.epoch ?? activeEpochOf(root);
  const plaintext =
    options.plaintext !== undefined ? Buffer.from(options.plaintext) : canonicalBytes(payloadObject);
  const generation = options.generation ?? crypto.randomBytes(32);
  const nonce = options.nonce ?? crypto.randomBytes(12);
  const recordId = options.recordId ?? (options.role === 'root' ? root.catalogRecordId : b64(crypto.randomBytes(32)));
  const header = {
    format: 'wpp-witness-package',
    version: 1,
    suite: 'HKDF-SHA256+A256GCM',
    vaultId: options.vaultId ?? root.vaultId,
    vaultSalt: options.vaultSalt ?? root.vaultSalt,
    rootEpoch: epoch.rootEpoch,
    scopeId: options.scopeId ?? root.catalogScopeId,
    recordId,
    generationId: b64(generation),
    kind: options.kind ?? 'catalog',
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

function hostileObject(target = { nodeType: 'root' }) {
  let traps = 0;
  const proxy = new Proxy(target, {
    getPrototypeOf() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    getOwnPropertyDescriptor() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    ownKeys() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    get() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
  });
  return { proxy, traps: () => traps };
}

function hostileByteProxy(target = new Uint8Array([1, 2, 3])) {
  let traps = 0;
  const proxy = new Proxy(target, {
    getPrototypeOf() {
      traps += 1;
      throw new Error(CALLER_SENTINEL);
    },
    get() {
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

function pythonDecrypt(root, header, ciphertext, tag) {
  const epoch = root.epochs.find((item) => item.rootEpoch === header.rootEpoch) ?? activeEpochOf(root);
  const secretRoot = Buffer.from(epoch.secretRoot, 'base64url');
  const python = spawnSync(
    'python3',
    ['-c', PYTHON_DECRYPT],
    {
      input: JSON.stringify({
        secretRootHex: secretRoot.toString('hex'),
        header,
        ciphertext,
        tag,
      }),
      encoding: 'utf8',
      timeout: 20000,
    },
  );
  equal(python.status, 0, python.stderr);
  return JSON.parse(python.stdout);
}

describe('UnlockedVault catalog-v2 kernel', () => {
  test('fixture notice stays synthetic', () => {
    equal(kernelVectors.notice.includes('SYNTHETIC'), true);
    equal(kernelVectors.envelopeKind, 'catalog');
    equal(kernelVectors.payloadVersion, 2);
  });

  test('plan, seal shards, seal root, open, and validate a whole revision', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(1, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { rootPayload, shards, plains } = sealPlan(vault, root, plan);
    equal(shards.length, 1);
    const shardHeader = headerOf(shards[0].sealed.wire);
    equal(shardHeader.kind, 'catalog');
    equal(shardHeader.scopeId, root.catalogScopeId);
    notEqual(shardHeader.recordId, root.catalogRecordId);
    equal(shardHeader.rootEpoch, activeEpochOf(root).rootEpoch);

    const sealedRoot = vault.sealCatalogNode(canonicalBytes(rootPayload));
    const rootHeader = headerOf(sealedRoot.wire);
    equal(rootHeader.kind, 'catalog');
    equal(rootHeader.scopeId, root.catalogScopeId);
    equal(rootHeader.recordId, root.catalogRecordId);

    const openedRoot = vault.openCatalogNode(sealedRoot.wire, {
      nodeType: 'root',
      wireSha256: sealedRoot.sha256,
      wireByteLength: sealedRoot.wire.byteLength,
    });
    equal(openedRoot.packageSha256, sealedRoot.sha256);
    equal(openedRoot.node.role, 'root');
    equal(openedRoot.node.payload.payloadVersion, 2);
    equal(openedRoot.header.kind, 'catalog');
    ok(openedRoot.node.payload.requiredEpochs.includes(rootHeader.rootEpoch));

    const openedShard = vault.openCatalogNode(shards[0].sealed.wire, {
      nodeType: 'shard',
      reference: shards[0].reference,
    });
    equal(openedShard.packageSha256, shards[0].sealed.sha256);
    equal(openedShard.node.role, 'shard');
    equal(openedShard.node.payload.prefix, shards[0].leaf.prefix);
    equal(openedShard.node.payload.records.length, 1);

    const revision = validateCatalogRevision(canonicalBytes(openedRoot.node.payload), plains);
    equal(revision.root.entryCount, 1);
    equal(revision.shards.length, 1);
  });

  test('JSON.stringify root input seals as canonical JCS plaintext', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(4, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { rootPayload, shards } = sealPlan(vault, root, plan);
    const sealed = vault.sealCatalogNode(utf8(rootPayload));
    const parsed = JSON.parse(Buffer.from(sealed.wire).toString('utf8'));
    const secretRoot = Buffer.from(activeEpochOf(root).secretRoot, 'base64url');
    const keys = deriveKeys(secretRoot, parsed.header);
    try {
      const nonce = Buffer.from(parsed.header.nonce, 'base64url');
      const aad = Buffer.from(canonicalize(parsed.header), 'utf8');
      const decipher = createDecipheriv('aes-256-gcm', keys.objectKey, nonce, { authTagLength: 16 });
      decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(parsed.ciphertext, 'base64url')),
        decipher.final(),
      ]);
      equal(plain.toString('utf8'), canonicalize(rootPayload));
    } finally {
      keys.prk.fill(0);
      keys.scopeKey.fill(0);
      keys.objectKey.fill(0);
      keys.nativeKey.fill(0);
    }
    const opened = vault.openCatalogNode(sealed.wire, {
      nodeType: 'root',
      wireSha256: sealed.sha256,
      wireByteLength: sealed.wire.byteLength,
    });
    equal(opened.node.role, 'root');
    equal(shards.length, 1);
  });

  test('reused exact shard wire remains valid and a changed leaf gets fresh identifiers', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(2, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const nonempty = plan.leaves.find((leaf) => !leaf.empty);
    const first = vault.sealCatalogNode(Buffer.from(nonempty.payloadUtf8));
    const secondSame = vault.sealCatalogNode(Buffer.from(nonempty.payloadUtf8));
    const firstHeader = headerOf(first.wire);
    const secondHeader = headerOf(secondSame.wire);
    notEqual(firstHeader.recordId, secondHeader.recordId);
    notEqual(firstHeader.generationId, secondHeader.generationId);
    notEqual(firstHeader.nonce, secondHeader.nonce);
    notEqual(first.sha256, secondSame.sha256);
    equal(firstHeader.scopeId, root.catalogScopeId);
    notEqual(firstHeader.recordId, root.catalogRecordId);

    const reference = shardReference(nonempty, first);
    const openedA = vault.openCatalogNode(first.wire, { nodeType: 'shard', reference });
    const openedB = vault.openCatalogNode(Buffer.from(first.wire), { nodeType: 'shard', reference: { ...reference } });
    equal(openedA.packageSha256, first.sha256);
    equal(openedB.packageSha256, first.sha256);
    equal(openedA.node.payload.records[0].body.package.sha256, snapshot.body.package.sha256);

    const changed = snapshotRecord(3, { rootEpoch: activeEpochOf(root).rootEpoch });
    const changedPlan = planRecords([changed]);
    const changedLeaf = changedPlan.leaves.find((leaf) => !leaf.empty);
    const changedSeal = vault.sealCatalogNode(Buffer.from(changedLeaf.payloadUtf8));
    const changedHeader = headerOf(changedSeal.wire);
    notEqual(changedHeader.recordId, firstHeader.recordId);
    notEqual(changedHeader.generationId, firstHeader.generationId);
    notEqual(changedHeader.nonce, firstHeader.nonce);
  });

  test('v1 catalog APIs stay strict v1 and reject v2 nodes', () => {
    const { vault, root } = unlock();
    const v1 = fixtures.catalogs.baseline;
    const v1Sealed = vault.sealCatalog(utf8(v1));
    const v1Opened = vault.openCatalog(v1Sealed.wire);
    equal(v1Opened.catalog.payloadVersion, 1);
    equal(parseCatalog(utf8(v1)).payloadVersion, 1);

    const snapshot = snapshotRecord(8, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { rootPayload, shards } = sealPlan(vault, root, plan);
    const sealedRoot = vault.sealCatalogNode(canonicalBytes(rootPayload));
    throws(() => vault.openCatalog(sealedRoot.wire), assertCode('WPP_SCHEMA'));
    throws(() => vault.openCatalog(shards[0].sealed.wire), assertCode('WPP_BINDING'));
    throws(
      () => vault.sealCatalogNode(utf8(v1)),
      assertCode(ERR_CATALOG_ROLE),
    );
    throws(
      () => vault.openCatalogNode(v1Sealed.wire, {
        nodeType: 'root',
        wireSha256: v1Sealed.sha256,
        wireByteLength: v1Sealed.wire.byteLength,
      }),
      assertCode(ERR_CATALOG_ROLE),
    );
  });

  test('wrong hash, length, record, prefix, epoch, vault, salt, version, role, tag, and ciphertext reject', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(5, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { rootPayload, shards } = sealPlan(vault, root, plan);
    const sealedRoot = vault.sealCatalogNode(canonicalBytes(rootPayload));
    const shard = shards[0];
    const rootExpected = {
      nodeType: 'root',
      wireSha256: sealedRoot.sha256,
      wireByteLength: sealedRoot.wire.byteLength,
    };
    const shardExpected = { nodeType: 'shard', reference: { ...shard.reference } };

    let returned;
    throws(
      () => {
        returned = vault.openCatalogNode(sealedRoot.wire, {
          ...rootExpected,
          wireSha256: '0'.repeat(64),
        });
      },
      assertCode('WPP_BINDING'),
    );
    equal(returned, undefined);
    throws(
      () => vault.openCatalogNode(sealedRoot.wire, { ...rootExpected, wireByteLength: rootExpected.wireByteLength + 1 }),
      assertCode('WPP_BINDING'),
    );
    throws(
      () => vault.openCatalogNode(shard.sealed.wire, {
        nodeType: 'shard',
        reference: { ...shard.reference, recordId: id32(0x11) },
      }),
      assertCode('WPP_BINDING'),
    );
    throws(
      () => vault.openCatalogNode(shard.sealed.wire, {
        nodeType: 'shard',
        reference: { ...shard.reference, prefix: shard.reference.prefix === 'a' ? 'b' : 'a' },
      }),
      assertCode(ERR_CATALOG_REFERENCE),
    );
    const openMutatedRoot = (mutate) => {
      const mutant = mutateWire(sealedRoot.wire, mutate);
      return vault.openCatalogNode(mutant, {
        nodeType: 'root',
        wireSha256: sha256Hex(mutant),
        wireByteLength: mutant.byteLength,
      });
    };
    const openMutatedShard = (mutate, referenceExtras = {}) => {
      const mutant = mutateWire(shard.sealed.wire, mutate);
      return vault.openCatalogNode(mutant, {
        nodeType: 'shard',
        reference: {
          ...shard.reference,
          wireSha256: sha256Hex(mutant),
          wireByteLength: mutant.byteLength,
          ...referenceExtras,
        },
      });
    };
    throws(
      () => openMutatedShard((pack) => {
        pack.header.rootEpoch = id16(0x21);
      }),
      assertCode('WPP_BINDING'),
    );
    throws(
      () => openMutatedRoot((pack) => {
        pack.header.vaultId = id16(0x33);
      }),
      assertCode('WPP_ROOT'),
    );
    throws(
      () => openMutatedRoot((pack) => {
        pack.header.vaultSalt = id32(0x44);
      }),
      assertCode('WPP_ROOT'),
    );
    throws(
      () => openMutatedRoot((pack) => {
        pack.header.version = 2;
      }),
      assertPublicError,
    );
    throws(
      () => vault.openCatalogNode(shard.sealed.wire, rootExpected),
      assertCode('WPP_BINDING'),
    );
    throws(
      () => vault.openCatalogNode(sealedRoot.wire, shardExpected),
      assertCode('WPP_BINDING'),
    );
    throws(
      () => openMutatedShard((pack) => {
        pack.tag = tamperB64url(pack.tag);
      }),
      assertCode('WPP_AUTH'),
    );
    throws(
      () => openMutatedShard((pack) => {
        pack.ciphertext = tamperB64url(pack.ciphertext);
      }),
      assertCode('WPP_AUTH'),
    );

    const other = unlock({
      ...root,
      vaultId: id16(0x55),
      vaultSalt: id32(0x66),
    });
    throws(
      () => other.vault.openCatalogNode(sealedRoot.wire, rootExpected),
      assertCode('WPP_ROOT'),
    );
  });

  test('swapped child and v1-as-v2 reject before records return', () => {
    const { vault, root } = unlock();
    const first = snapshotRecord(11, { rootEpoch: activeEpochOf(root).rootEpoch });
    const second = snapshotRecord(12, { rootEpoch: activeEpochOf(root).rootEpoch });
    const planA = planRecords([first]);
    const planB = planRecords([second]);
    const sealedA = sealPlan(vault, root, planA);
    const sealedB = sealPlan(vault, root, planB);
    let opened;
    throws(
      () => {
        opened = vault.openCatalogNode(sealedA.shards[0].sealed.wire, {
          nodeType: 'shard',
          reference: sealedB.shards[0].reference,
        });
      },
      assertCode('WPP_BINDING'),
    );
    equal(opened, undefined);

    const v1Sealed = vault.sealCatalog(utf8(fixtures.catalogs.baseline));
    throws(
      () => {
        opened = vault.openCatalogNode(v1Sealed.wire, {
          nodeType: 'root',
          wireSha256: v1Sealed.sha256,
          wireByteLength: v1Sealed.wire.byteLength,
        });
      },
      assertCode(ERR_CATALOG_ROLE),
    );
    equal(opened, undefined);
  });

  test('prefix mismatch after a matching wire digest rejects the shard', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(6, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { shards } = sealPlan(vault, root, plan);
    const reference = { ...shards[0].reference, prefix: shards[0].reference.prefix === '' ? '0' : '' };
    throws(
      () => vault.openCatalogNode(shards[0].sealed.wire, { nodeType: 'shard', reference }),
      assertCode(ERR_CATALOG_REFERENCE),
    );
  });

  test('retired referenced epoch remains readable and a missing epoch stays unavailable', () => {
    const retired = {
      rootEpoch: b64(crypto.randomBytes(16)),
      secretRoot: b64(crypto.randomBytes(32)),
      createdAt: '2026-09-18T00:00:00Z',
      status: 'retired',
    };
    const { vault, root } = unlock(randomRoot([retired]));
    const snapshot = snapshotRecord(7, { rootEpoch: retired.rootEpoch });
    const plan = planRecords([snapshot]);
    const leaf = plan.leaves.find((item) => !item.empty);
    const envelope = encryptNode(root, JSON.parse(Buffer.from(leaf.payloadUtf8).toString('utf8')), {
      epoch: retired,
      role: 'shard',
    });
    const reference = {
      prefix: leaf.prefix,
      empty: false,
      recordId: envelope.header.recordId,
      generationId: envelope.header.generationId,
      rootEpoch: retired.rootEpoch,
      wireSha256: envelope.sha256,
      wireByteLength: envelope.wire.byteLength,
      plaintextByteLength: leaf.plaintextByteLength,
      entryCount: leaf.entryCount,
      observationCount: leaf.observationCount,
      canonicalRecordsSha256: leaf.canonicalRecordsSha256,
      locators: [locator('retired')],
    };
    const opened = vault.openCatalogNode(envelope.wire, { nodeType: 'shard', reference });
    equal(opened.node.role, 'shard');
    equal(opened.header.rootEpoch, retired.rootEpoch);

    const missingEpoch = id16(0x77);
    const missing = encryptNode(root, JSON.parse(Buffer.from(leaf.payloadUtf8).toString('utf8')), {
      epoch: { ...retired, rootEpoch: missingEpoch, secretRoot: retired.secretRoot },
      role: 'shard',
    });
    throws(
      () => vault.openCatalogNode(missing.wire, {
        nodeType: 'shard',
        reference: { ...reference, rootEpoch: missingEpoch, wireSha256: missing.sha256, wireByteLength: missing.wire.byteLength, recordId: missing.header.recordId, generationId: missing.header.generationId },
      }),
      assertCode('WPP_EPOCH'),
    );
  });

  test('seal uses the active epoch and rejects a root that omits the header epoch', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(9, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { rootPayload, shards } = sealPlan(vault, root, plan);
    const sealed = vault.sealCatalogNode(canonicalBytes(rootPayload));
    equal(headerOf(sealed.wire).rootEpoch, activeEpochOf(root).rootEpoch);
    equal(headerOf(shards[0].sealed.wire).rootEpoch, activeEpochOf(root).rootEpoch);

    const emptyRoot = {
      payloadVersion: 2,
      nodeType: 'root',
      partitionVersion: 1,
      parents: [],
      entryCount: 0,
      observationCount: 0,
      requiredEpochs: [],
      references: [{ prefix: '', empty: true }],
    };
    throws(() => vault.sealCatalogNode(canonicalBytes(emptyRoot)), assertCode(ERR_CATALOG_REFERENCE));
  });

  test('oversize plaintext and wire reject, and empty shard expectations are invalid', () => {
    const { vault, root } = unlock();
    throws(
      () => vault.sealCatalogNode(Buffer.alloc(CATALOG_V2_LIMITS.rootPlaintextBytes + 1, 0x20)),
      assertCode('WPP_INPUT_TOO_LARGE'),
    );
    const pad = 'a'.repeat(CATALOG_V2_LIMITS.shardPlaintextBytes + 32);
    throws(
      () => vault.sealCatalogNode(utf8({
        payloadVersion: 2,
        nodeType: 'shard',
        partitionVersion: 1,
        prefix: '',
        records: [{ recordKind: 'observation', body: { pad } }],
      })),
      assertCode('WPP_INPUT_TOO_LARGE'),
    );
    const snapshot = snapshotRecord(10, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { shards } = sealPlan(vault, root, plan);
    throws(
      () => vault.openCatalogNode(shards[0].sealed.wire, {
        nodeType: 'shard',
        reference: { prefix: shards[0].reference.prefix, empty: true },
      }),
      assertCode('WPP_SCHEMA'),
    );
    throws(
      () => vault.openCatalogNode(Buffer.alloc(CATALOG_V2_LIMITS.shardWireBytes + 1, 0x20), {
        nodeType: 'shard',
        reference: shards[0].reference,
      }),
      assertCode('WPP_INPUT_TOO_LARGE'),
    );
    throws(
      () => vault.openCatalogNode(Buffer.alloc(CATALOG_V2_LIMITS.rootWireBytes + 1, 0x20), {
        nodeType: 'root',
        wireSha256: 'ab'.repeat(32),
        wireByteLength: CATALOG_V2_LIMITS.rootWireBytes,
      }),
      assertCode('WPP_INPUT_TOO_LARGE'),
    );
  });

  test('multi-record shard above the split target rejects on seal', () => {
    const { vault, root } = unlock();
    const epoch = activeEpochOf(root).rootEpoch;
    const records = [];
    let shard;
    let index = 0;
    do {
      index += 1;
      records.push(snapshotRecord(index + 40, { rootEpoch: epoch }));
      const routed = records
        .map((record) => ({
          record,
          hash: catalogRouteHash(record.recordKind, record.body.package.sha256),
        }))
        .sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
      shard = {
        payloadVersion: 2,
        nodeType: 'shard',
        partitionVersion: 1,
        prefix: '',
        records: routed.map((item) => item.record),
      };
    } while (canonicalBytes(shard).byteLength <= CATALOG_V2_LIMITS.shardTargetBytes && index < 1024);
    ok(records.length >= 2);
    ok(canonicalBytes(shard).byteLength > CATALOG_V2_LIMITS.shardTargetBytes);
    throws(() => vault.sealCatalogNode(canonicalBytes(shard)), assertCode(ERR_CATALOG_CAPACITY));
  });

  test('valid canonical array order opens and noncanonical authenticated plaintext rejects', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(13, {
      rootEpoch: activeEpochOf(root).rootEpoch,
      locators: [locator('b'), locator('a')],
    });
    const plan = planRecords([snapshot]);
    const { shards } = sealPlan(vault, root, plan);
    const opened = vault.openCatalogNode(shards[0].sealed.wire, {
      nodeType: 'shard',
      reference: shards[0].reference,
    });
    equal(opened.node.payload.records[0].body.locators.length, 2);

    const pretty = Buffer.from(`${JSON.stringify(JSON.parse(Buffer.from(shards[0].payload).toString('utf8')), null, 2)}\n`);
    const prettyEnvelope = encryptNode(root, null, {
      plaintext: pretty,
      recordId: shards[0].reference.recordId,
      generation: Buffer.from(shards[0].reference.generationId, 'base64url'),
      role: 'shard',
    });
    throws(
      () => vault.openCatalogNode(prettyEnvelope.wire, {
        nodeType: 'shard',
        reference: {
          ...shards[0].reference,
          wireSha256: prettyEnvelope.sha256,
          wireByteLength: prettyEnvelope.wire.byteLength,
          recordId: prettyEnvelope.header.recordId,
          generationId: prettyEnvelope.header.generationId,
        },
      }),
      assertCode('WPP_NONCANONICAL'),
    );
  });

  test('lock rejects later catalog-v2 seal and open and leaves caller root bytes unchanged', () => {
    const { vault, rootUtf8, root } = unlock();
    const snapshot = snapshotRecord(14, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { rootPayload, shards } = sealPlan(vault, root, plan);
    const sealedRoot = vault.sealCatalogNode(canonicalBytes(rootPayload));
    const rootCopy = Buffer.from(rootUtf8);
    vault.lock();
    equal(vault.locked, true);
    vault.lock();
    throws(() => vault.sealCatalogNode(canonicalBytes(rootPayload)), assertCode('WPP_LOCKED'));
    throws(
      () => vault.openCatalogNode(sealedRoot.wire, {
        nodeType: 'root',
        wireSha256: sealedRoot.sha256,
        wireByteLength: sealedRoot.wire.byteLength,
      }),
      assertCode('WPP_LOCKED'),
    );
    throws(
      () => vault.openCatalogNode(shards[0].sealed.wire, { nodeType: 'shard', reference: shards[0].reference }),
      assertCode('WPP_LOCKED'),
    );
    deepEqual(Buffer.from(rootUtf8), rootCopy);
  });

  test('independent Python decrypt agrees for a sealed root and shard', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(15, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { rootPayload, shards } = sealPlan(vault, root, plan);
    const sealedRoot = vault.sealCatalogNode(canonicalBytes(rootPayload));
    for (const sealed of [sealedRoot, shards[0].sealed]) {
      const parsed = JSON.parse(Buffer.from(sealed.wire).toString('utf8'));
      const secretRoot = Buffer.from(activeEpochOf(root).secretRoot, 'base64url');
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
        const independent = pythonDecrypt(root, parsed.header, parsed.ciphertext, parsed.tag);
        equal(independent.prkHex, keys.prk.toString('hex'));
        equal(independent.scopeKeyHex, keys.scopeKey.toString('hex'));
        equal(independent.objectKeyHex, keys.objectKey.toString('hex'));
        equal(independent.aadHex, aad.toString('hex'));
        equal(independent.plaintextUtf8, nodePlain.toString('utf8'));
        equal(JSON.parse(independent.plaintextUtf8).payloadVersion, 2);
        equal(parsed.header.kind, 'catalog');
      } finally {
        keys.prk.fill(0);
        keys.scopeKey.fill(0);
        keys.objectKey.fill(0);
        keys.nativeKey.fill(0);
      }
    }
  });

  test('root recovery then catalog-v2 open in a fresh process', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(16, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { rootPayload, shards } = sealPlan(vault, root, plan);
    const sealedRoot = vault.sealCatalogNode(canonicalBytes(rootPayload));
    const pack = vault.createRecoveryPack();
    vault.lock();
    const childSource = `
import { UnlockedVault } from ${JSON.stringify(new URL('../dist/kernel/index.js', import.meta.url).href)};
const input = JSON.parse(Buffer.from(process.argv[1], 'base64url').toString('utf8'));
const vault = UnlockedVault.fromRecoveryPack(
  Buffer.from(input.recoveryWire, 'base64url'),
  Buffer.from(input.recoveryKey, 'base64url'),
  [],
);
const openedRoot = vault.openCatalogNode(Buffer.from(input.rootWire, 'base64url'), input.rootExpected);
const openedShard = vault.openCatalogNode(Buffer.from(input.shardWire, 'base64url'), input.shardExpected);
process.stdout.write(JSON.stringify({
  ok: true,
  rootSha256: openedRoot.packageSha256,
  shardSha256: openedShard.packageSha256,
  rootRole: openedRoot.node.role,
  shardRole: openedShard.node.role,
  payloadVersion: openedRoot.node.payload.payloadVersion,
}));
`;
    const payloadB64 = Buffer.from(
      JSON.stringify({
        recoveryWire: Buffer.from(pack.wire).toString('base64url'),
        recoveryKey: Buffer.from(pack.recoveryKey).toString('base64url'),
        rootWire: Buffer.from(sealedRoot.wire).toString('base64url'),
        shardWire: Buffer.from(shards[0].sealed.wire).toString('base64url'),
        rootExpected: {
          nodeType: 'root',
          wireSha256: sealedRoot.sha256,
          wireByteLength: sealedRoot.wire.byteLength,
        },
        shardExpected: { nodeType: 'shard', reference: shards[0].reference },
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
    equal(receipt.rootSha256, sealedRoot.sha256);
    equal(receipt.shardSha256, shards[0].sealed.sha256);
    equal(receipt.rootRole, 'root');
    equal(receipt.shardRole, 'shard');
    equal(receipt.payloadVersion, 2);
    equal(child.stdout.includes(SECRET_MARKER), false);
  });

  test('hostile getters, revoked proxies, and detached buffers stay static', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(17, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { rootPayload, shards } = sealPlan(vault, root, plan);
    const sealedRoot = vault.sealCatalogNode(canonicalBytes(rootPayload));
    const payload = canonicalBytes(rootPayload);
    const cases = [
      ['seal trap', () => hostileByteProxy(payload), (proxy) => vault.sealCatalogNode(proxy)],
      ['open trap', () => hostileByteProxy(sealedRoot.wire), (proxy) => vault.openCatalogNode(proxy, {
        nodeType: 'root',
        wireSha256: sealedRoot.sha256,
        wireByteLength: sealedRoot.wire.byteLength,
      })],
      ['seal thrown proxy', () => thrownHostileByteProxy(payload), (proxy) => vault.sealCatalogNode(proxy)],
      ['expected trap', () => hostileObject(), (proxy) => vault.openCatalogNode(sealedRoot.wire, proxy)],
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
      if (title === 'expected trap') {
        ok(traps() > 0, title);
      } else {
        equal(traps(), 0, title);
      }
    }

    const { proxy, revoke } = Proxy.revocable(Uint8Array.from(payload), {});
    revoke();
    throws(() => vault.sealCatalogNode(proxy), (err) => {
      assertCode('WPP_SCHEMA')(err);
      equal(String(err.name).includes('TypeError'), false);
      return true;
    });
    throws(() => vault.sealCatalogNode(detachCopy(payload)), assertCode('WPP_SCHEMA'));
    throws(
      () => vault.openCatalogNode(detachCopy(sealedRoot.wire), {
        nodeType: 'root',
        wireSha256: sealedRoot.sha256,
        wireByteLength: sealedRoot.wire.byteLength,
      }),
      assertCode('WPP_SCHEMA'),
    );

    const opened = vault.openCatalogNode(sealedRoot.wire, {
      nodeType: 'root',
      wireSha256: sealedRoot.sha256,
      wireByteLength: sealedRoot.wire.byteLength,
    });
    throws(() => {
      opened.node.payload.entryCount = 9;
    }, TypeError);
    const shardOpened = vault.openCatalogNode(shards[0].sealed.wire, {
      nodeType: 'shard',
      reference: shards[0].reference,
    });
    throws(() => {
      shardOpened.node.payload.prefix = 'ff';
    }, TypeError);
  });

  test('expected object is copied before wire use', () => {
    const { vault, root } = unlock();
    const snapshot = snapshotRecord(18, { rootEpoch: activeEpochOf(root).rootEpoch });
    const plan = planRecords([snapshot]);
    const { shards } = sealPlan(vault, root, plan);
    const expected = {
      nodeType: 'shard',
      reference: { ...shards[0].reference },
    };
    const opened = vault.openCatalogNode(shards[0].sealed.wire, expected);
    expected.reference.recordId = id32(0x99);
    expected.reference.wireSha256 = '0'.repeat(64);
    equal(opened.node.role, 'shard');
    equal(opened.header.recordId, shards[0].reference.recordId);
  });
});
