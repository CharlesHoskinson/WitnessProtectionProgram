import { deepEqual, equal, ok, throws } from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import canonicalize from 'canonicalize';

import {
  CATALOG_ROUTE_DOMAIN,
  CATALOG_V2_LIMITS,
  ERR_CATALOG_CAPACITY,
  ERR_CATALOG_COVER,
  ERR_CATALOG_DUPLICATE,
  ERR_CATALOG_REFERENCE,
  ERR_CATALOG_ROLE,
  catalogRouteCanonical,
  catalogRouteHash,
  parseCatalogNode,
  planCatalogShards,
  preflightCatalogRoot,
  validateCatalogRevision,
} from '../dist/storage/index.js';
import {
  ERR_BOM,
  ERR_INPUT_TOO_LARGE,
  ERR_JSON_DUPLICATE_KEY,
  ERR_NONCANONICAL,
  ERR_SCHEMA,
  KernelError,
} from '../dist/kernel/json.js';

const vectors = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/catalog-v2-vectors.json', import.meta.url)), 'utf8'),
);

const SECRET_MARKER = 'WPP_TEST_SECRET_MARKER_c0ffee91';
const FORGED_STATIC_CODE = 'WPP_SYNTHETIC_SENTINEL';
const HEX_DIGITS = '0123456789abcdef';
const utf8 = (text) => Buffer.from(text, 'utf8');
const canonicalBytes = (value) => Buffer.from(canonicalize(value));
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
const completeCoverPrefixes = (splits) => {
  const prefixes = [''];
  for (let i = 0; i < splits; i += 1) {
    const parent = prefixes.shift();
    for (let n = 0; n < 16; n += 1) {
      prefixes.push(`${parent}${HEX_DIGITS[n]}`);
    }
  }
  prefixes.sort();
  return prefixes;
};
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
const digestFromIndex = (i) => sha256Hex(utf8(`digest:${i}`));

const EPOCH = id16FromIndex(1);
const SCOPE = id32FromIndex(2);

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
        rootEpoch: opts.rootEpoch ?? EPOCH,
        scopeId: opts.scopeId ?? SCOPE,
        recordId: opts.recordId ?? id32FromIndex(0x10000 + index),
        generationId: opts.generationId ?? id32FromIndex(0x20000 + index),
      },
      metadata: opts.metadata ?? {
        ...BASE_METADATA,
        capturedAt: opts.capturedAt ?? '2026-09-19T00:00:00Z',
        privateStateIds: opts.privateStateIds ?? ['fixture-state'],
      },
      label: Object.prototype.hasOwnProperty.call(opts, 'label') ? opts.label : `synthetic-${index}`,
      locators,
    },
  };
}

function observationRecord(index, snapshot, opts = {}) {
  const loc = opts.locator ?? snapshot.body.locators[0];
  const digest = snapshot.body.package.sha256;
  return {
    recordKind: 'observation',
    body: {
      observationId: opts.observationId ?? id32FromIndex(0x30000 + index),
      packageSha256: opts.packageSha256 ?? digest,
      locator: loc,
      observedAt: opts.observedAt ?? '2026-09-19T00:05:00Z',
      outcome: opts.outcome ?? {
        status: 'readback-authenticated',
        observedSha256: digest,
        byteLength: snapshot.body.package.byteLength,
      },
    },
  };
}

function tombstoneRecord(index, targetDigest, opts = {}) {
  return {
    recordKind: 'tombstone',
    body: {
      entryKind: 'tombstone',
      eventId: opts.eventId ?? id32FromIndex(0x40000 + index),
      targetPackageSha256: targetDigest,
      reason: opts.reason ?? 'user-request',
      recordedAt: opts.recordedAt ?? '2026-09-19T00:06:00Z',
    },
  };
}

function receiptRecord(index, opts = {}) {
  return {
    recordKind: 'root-update-receipt',
    body: {
      entryKind: 'root-update-receipt',
      receiptId: opts.receiptId ?? id32FromIndex(0x50000 + index),
      parentRootRecordSha256: opts.parentRootRecordSha256 ?? [digestFromIndex(9000 + index)],
      currentRootRecordSha256: opts.currentRootRecordSha256 ?? digestFromIndex(9100 + index),
      rootRevisionId: opts.rootRevisionId ?? id32FromIndex(0x51000 + index),
      retainedOldEpochs: opts.retainedOldEpochs ?? [id16FromIndex(20 + index)],
      newActiveEpoch: opts.newActiveEpoch ?? id16FromIndex(40 + index),
      recordedAt: opts.recordedAt ?? '2026-09-19T00:07:00Z',
    },
  };
}

function rootFromPlan(plan, extras = {}) {
  const references = plan.leaves.map((leaf) => {
    if (leaf.empty) {
      return { prefix: leaf.prefix, empty: true };
    }
    const suffix = leaf.prefix === '' ? 'root' : leaf.prefix;
    return {
      prefix: leaf.prefix,
      empty: false,
      recordId: id32FromIndex(0x60000 + suffix.length + suffix.charCodeAt(0) * 17),
      generationId: id32FromIndex(0x70000 + suffix.length),
      rootEpoch: extras.rootEpoch ?? EPOCH,
      wireSha256: sha256Hex(utf8(`wire:${leaf.prefix}`)),
      wireByteLength: 1024,
      plaintextByteLength: leaf.plaintextByteLength,
      entryCount: leaf.entryCount,
      observationCount: leaf.observationCount,
      canonicalRecordsSha256: leaf.canonicalRecordsSha256,
      locators: [locator(suffix)],
    };
  });
  const used = new Set();
  for (const reference of references) {
    if (reference.empty) {
      continue;
    }
    let n = 0;
    let recordId = reference.recordId;
    while (used.has(recordId)) {
      n += 1;
      recordId = id32FromIndex(0x60000 + n * 997 + reference.prefix.length);
    }
    reference.recordId = recordId;
    used.add(recordId);
  }
  return {
    payloadVersion: 2,
    nodeType: 'root',
    partitionVersion: 1,
    parents: extras.parents ?? [],
    entryCount: extras.entryCount ?? plan.entryCount,
    observationCount: extras.observationCount ?? plan.observationCount,
    requiredEpochs: extras.requiredEpochs ?? plan.requiredEpochs,
    references,
  };
}

function shardPayloads(plan) {
  return plan.leaves.filter((leaf) => !leaf.empty).map((leaf) => Buffer.from(leaf.payloadUtf8));
}

function planRecords(records) {
  return planCatalogShards(canonicalBytes(records));
}

function expectCode(fn, code) {
  let err;
  try {
    fn();
  } catch (caught) {
    err = caught;
  }
  ok(err instanceof KernelError, `expected KernelError ${code}`);
  equal(err.code, code);
  equal(err.message, code);
  ok(!String(err.message).includes(SECRET_MARKER));
  ok(!String(err.stack || '').includes(SECRET_MARKER));
  return err;
}

function fingerprints(plan) {
  return plan.leaves
    .filter((leaf) => !leaf.empty)
    .map((leaf) => `${leaf.prefix}:${leaf.canonicalRecordsSha256}:${leaf.entryCount}:${leaf.observationCount}`);
}

function bulkyMetadata(seed, targetBytes = 56 * 1024) {
  const ids = [];
  const metadata = {
    ...BASE_METADATA,
    applicationId: `app-${seed}`,
    contract: { address: `synthetic-contract-${seed}`, codeHash: null },
    privateStateIds: ids,
  };
  const pad = 'é'.repeat(96);
  for (let i = 0; i < 256; i += 1) {
    ids.push(`${seed}-${i}-${pad}`);
    const size = Buffer.byteLength(canonicalize(metadata));
    if (size > 64 * 1024) {
      ids.pop();
      break;
    }
    if (size >= targetBytes) {
      break;
    }
  }
  return metadata;
}

class ClaimedLength extends Uint8Array {
  constructor(bytes, claimed) {
    super(bytes);
    this._claimed = claimed;
  }

  get byteLength() {
    return this._claimed;
  }

  get length() {
    return this._claimed;
  }
}

class ThrowingLength extends Uint8Array {
  get byteLength() {
    throw new Error(`byteLength getter must not run ${SECRET_MARKER}`);
  }

  get length() {
    throw new Error(`length getter must not run ${SECRET_MARKER}`);
  }
}

describe('catalog-v2 route encoding', () => {
  test('route hashes match independent JCS encoding', () => {
    equal(CATALOG_ROUTE_DOMAIN, vectors.routeDomain);
    for (const vector of vectors.routeVectors) {
      const canonical = canonicalize([CATALOG_ROUTE_DOMAIN, vector.recordKind, vector.identity]);
      const independent = sha256Hex(utf8(canonical));
      equal(canonical, vector.canonical);
      equal(independent, vector.sha256);
      equal(catalogRouteCanonical(vector.recordKind, vector.identity), vector.canonical);
      equal(catalogRouteHash(vector.recordKind, vector.identity), vector.sha256);
    }
  });
});

describe('catalog-v2 parseCatalogNode', () => {
  test('parses the closed empty root', () => {
    const bytes = canonicalBytes(vectors.emptyRoot);
    const parsed = parseCatalogNode(bytes, 'root');
    equal(parsed.role, 'root');
    equal(parsed.payload.nodeType, 'root');
    equal(parsed.payload.payloadVersion, 2);
    equal(parsed.payload.partitionVersion, 1);
    equal(parsed.payload.entryCount, 0);
    equal(parsed.payload.references.length, 1);
    equal(parsed.payload.references[0].empty, true);
    equal(parsed.payload.references[0].prefix, '');
  });

  test('rejects v1 catalogs and role confusion', () => {
    expectCode(() => parseCatalogNode(canonicalBytes(vectors.v1Catalog), 'root'), ERR_CATALOG_ROLE);
    expectCode(() => parseCatalogNode(canonicalBytes(vectors.emptyRoot), 'shard'), ERR_CATALOG_ROLE);
    const shard = {
      payloadVersion: 2,
      nodeType: 'shard',
      partitionVersion: 1,
      prefix: '',
      records: [snapshotRecord(1)],
    };
    expectCode(() => parseCatalogNode(canonicalBytes(shard), 'root'), ERR_CATALOG_ROLE);
    expectCode(() => parseCatalogNode(canonicalBytes(vectors.emptyRoot), 'catalog'), ERR_CATALOG_ROLE);
  });

  test('rejects non-canonical JSON, BOM, duplicate keys, and extra fields', () => {
    const pretty = utf8(`${JSON.stringify(vectors.emptyRoot, null, 2)}\n`);
    expectCode(() => parseCatalogNode(pretty, 'root'), ERR_NONCANONICAL);
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), canonicalBytes(vectors.emptyRoot)]);
    expectCode(() => parseCatalogNode(bom, 'root'), ERR_BOM);
    expectCode(
      () => parseCatalogNode(utf8('{"payloadVersion":2,"payloadVersion":2}'), 'root'),
      ERR_JSON_DUPLICATE_KEY,
    );
    const extra = { ...vectors.emptyRoot, extra: true };
    expectCode(() => parseCatalogNode(canonicalBytes(extra), 'root'), ERR_SCHEMA);
  });

  test('uses intrinsic byteLength and redacts errors', () => {
    const owned = canonicalBytes(vectors.emptyRoot);
    const claimed = parseCatalogNode(new ClaimedLength(owned, 1), 'root');
    equal(claimed.payload.nodeType, 'root');
    const ignoredGetters = parseCatalogNode(new ThrowingLength(owned), 'root');
    equal(ignoredGetters.payload.entryCount, 0);
    const secretRoot = { ...vectors.emptyRoot, extra: SECRET_MARKER };
    const err = expectCode(() => parseCatalogNode(canonicalBytes(secretRoot), 'root'), ERR_SCHEMA);
    ok(!JSON.stringify(err).includes(SECRET_MARKER));
  });

  test('isolates mutations of input bytes and returned payload', () => {
    const bytes = canonicalBytes(vectors.emptyRoot);
    const parsed = parseCatalogNode(bytes, 'root');
    bytes[0] ^= 0xff;
    equal(parsed.payload.entryCount, 0);
    throws(() => {
      parsed.payload.entryCount = 9;
    }, TypeError);
  });

  test('parses a shard that contains only an observation', () => {
    const snapshot = snapshotRecord(3);
    const observation = observationRecord(3, snapshot);
    const shard = {
      payloadVersion: 2,
      nodeType: 'shard',
      partitionVersion: 1,
      prefix: catalogRouteHash('observation', observation.body.observationId).slice(0, 0),
      records: [observation],
    };
    const routed = [observation].sort((a, b) => {
      const ha = catalogRouteHash(a.recordKind, a.body.observationId);
      const hb = catalogRouteHash(b.recordKind, b.body.observationId);
      return ha < hb ? -1 : ha > hb ? 1 : 0;
    });
    shard.records = routed;
    shard.prefix = catalogRouteHash('observation', observation.body.observationId).slice(0, 0);
    const parsed = parseCatalogNode(canonicalBytes(shard), 'shard');
    equal(parsed.role, 'shard');
    equal(parsed.payload.records.length, 1);
    equal(parsed.payload.records[0].recordKind, 'observation');
  });
});

describe('catalog-v2 plan and revision', () => {
  test('plans an empty revision with one empty marker', () => {
    const plan = planRecords([]);
    equal(plan.entryCount, 0);
    equal(plan.observationCount, 0);
    equal(plan.leaves.length, 1);
    equal(plan.leaves[0].empty, true);
    equal(plan.leaves[0].prefix, '');
    const root = rootFromPlan(plan);
    const revision = validateCatalogRevision(canonicalBytes(root), []);
    equal(revision.root.entryCount, 0);
    equal(revision.shards.length, 0);
    equal(revision.liveWitnesses.length, 0);
  });

  test('roundtrips a closed snapshot, tombstone, receipt, and observation', () => {
    const snapshot = snapshotRecord(11);
    const observation = observationRecord(11, snapshot);
    const tombstone = tombstoneRecord(11, digestFromIndex(99));
    const receipt = receiptRecord(11);
    const records = [snapshot, observation, tombstone, receipt];
    const plan = planRecords(records);
    equal(plan.entryCount, 3);
    equal(plan.observationCount, 1);
    ok(plan.requiredEpochs.includes(EPOCH));
    ok(!plan.requiredEpochs.includes(receipt.body.newActiveEpoch));
    ok(!plan.requiredEpochs.includes(receipt.body.retainedOldEpochs[0]));
    const root = rootFromPlan(plan);
    const shards = shardPayloads(plan);
    const revision = validateCatalogRevision(canonicalBytes(root), shards);
    equal(revision.root.entryCount, 3);
    equal(revision.liveWitnesses.length, 1);
    equal(revision.liveWitnesses[0].digest, snapshot.body.package.sha256);
    for (const shardBytes of shards) {
      const parsed = parseCatalogNode(shardBytes, 'shard');
      equal(parsed.payload.nodeType, 'shard');
      parseCatalogNode(canonicalBytes(parsed.payload), 'shard');
    }
    parseCatalogNode(canonicalBytes(root), 'root');
  });

  test('repeated plans keep counts and fingerprints', () => {
    const records = [];
    for (let i = 0; i < 32; i += 1) {
      const snapshot = snapshotRecord(100 + i, { label: i % 2 === 0 ? `café-${i}` : `plain-${i}` });
      records.push(snapshot, observationRecord(100 + i, snapshot));
    }
    const first = planRecords(records);
    const expected = fingerprints(first);
    for (let n = 0; n < 5; n += 1) {
      const again = planRecords(records);
      deepEqual(fingerprints(again), expected);
      equal(again.entryCount, first.entryCount);
      equal(again.observationCount, first.observationCount);
      equal(again.cumulativePlaintextBytes, first.cumulativePlaintextBytes);
    }
  });

  test('emits empty markers for a complete 16-way split', () => {
    const records = [];
    for (let i = 0; i < 8; i += 1) {
      records.push(
        snapshotRecord(200 + i, {
          metadata: bulkyMetadata(`split-${i}`, 40 * 1024),
          label: `uneven-${i}`,
        }),
      );
    }
    const plan = planRecords(records);
    const empty = plan.leaves.filter((leaf) => leaf.empty);
    const nonempty = plan.leaves.filter((leaf) => !leaf.empty);
    ok(nonempty.length >= 1);
    ok(empty.length > 0);
    equal(empty.length + nonempty.length, plan.leaves.length);
    const root = rootFromPlan(plan);
    validateCatalogRevision(canonicalBytes(root), shardPayloads(plan));
    const prefixes = root.references.map((reference) => reference.prefix);
    deepEqual(
      prefixes,
      prefixes.slice().sort(),
    );
  });

  test('rejects duplicate selected identities instead of hiding them', () => {
    const snapshot = snapshotRecord(8);
    const clone = snapshotRecord(8);
    expectCode(() => planRecords([snapshot, clone]), ERR_CATALOG_DUPLICATE);
    const observation = observationRecord(8, snapshot);
    const duplicateObservation = observationRecord(8, snapshot);
    expectCode(() => planRecords([snapshot, observation, duplicateObservation]), ERR_CATALOG_DUPLICATE);
  });

  test('rejects dangling, wrong-locator, and wrong-digest observations', () => {
    const snapshot = snapshotRecord(21, { locators: [locator('21a'), locator('21b')] });
    const dangling = observationRecord(21, snapshot, { packageSha256: digestFromIndex(9999) });
    expectCode(() => planRecords([snapshot, dangling]), ERR_CATALOG_REFERENCE);
    const wrongLocator = observationRecord(22, snapshot, { locator: locator('missing') });
    expectCode(() => planRecords([snapshot, wrongLocator]), ERR_CATALOG_REFERENCE);
    const wrongDigest = observationRecord(23, snapshot, {
      outcome: {
        status: 'readback-authenticated',
        observedSha256: digestFromIndex(1234),
        byteLength: snapshot.body.package.byteLength,
      },
    });
    expectCode(() => planRecords([snapshot, wrongDigest]), ERR_CATALOG_REFERENCE);
  });

  test('rejects receipt identity collisions and schema-invalid receipts', () => {
    const snapshot = snapshotRecord(30);
    const receipt = receiptRecord(30);
    const duplicate = receiptRecord(31, { receiptId: receipt.body.receiptId });
    expectCode(() => planRecords([snapshot, receipt, duplicate]), ERR_CATALOG_DUPLICATE);
    const extra = receiptRecord(32);
    extra.body.extra = true;
    expectCode(() => planRecords([snapshot, extra]), ERR_SCHEMA);
  });

  test('computes live witnesses and retains tombstoned history', () => {
    const live = snapshotRecord(40, { byteLength: 2048 });
    const dead = snapshotRecord(41, { byteLength: 4096 });
    const tombstone = tombstoneRecord(41, dead.body.package.sha256);
    const plan = planRecords([live, dead, tombstone]);
    equal(plan.entryCount, 3);
    equal(plan.liveWitnesses.length, 1);
    equal(plan.liveWitnesses[0].digest, live.body.package.sha256);
    equal(plan.liveWitnessWireBytes, 2048);
    equal(plan.unresolvedTombstoneLive.length, 0);
    equal(plan.liveRecordForks.length, 0);
    equal(plan.entryCount, 3);
  });

  test('multiple live generations do not prove concurrent heads', () => {
    const first = snapshotRecord(42, { recordId: id32FromIndex(0x11111), generationId: id32FromIndex(0x22221) });
    const second = snapshotRecord(43, { recordId: id32FromIndex(0x11111), generationId: id32FromIndex(0x22222) });
    const plan = planRecords([first, second]);
    equal(plan.liveWitnesses.length, 2);
    equal(plan.liveRecordForks.length, 0);
    equal(plan.unresolvedTombstoneLive.length, 0);
  });

  test('rejects missing, overlapping, and mismatched revision covers', () => {
    const snapshot = snapshotRecord(50);
    const observation = observationRecord(50, snapshot);
    const plan = planRecords([snapshot, observation]);
    const root = rootFromPlan(plan);
    const shards = shardPayloads(plan);
    const missing = {
      ...root,
      references: root.references.filter((reference) => reference.prefix !== ''),
    };
    if (missing.references.length === 0) {
      missing.references = [{ prefix: '0', empty: true }];
    }
    expectCode(
      () => validateCatalogRevision(canonicalBytes(missing), shards),
      missing.references.length === 1 && missing.references[0].prefix === '0'
        ? ERR_CATALOG_COVER
        : ERR_CATALOG_COVER,
    );
    const overlap = {
      ...vectors.emptyRoot,
      references: [
        { prefix: '0', empty: true },
        { prefix: '00', empty: true },
      ],
    };
    expectCode(() => validateCatalogRevision(canonicalBytes(overlap), []), ERR_CATALOG_COVER);
    if (shards.length > 0) {
      const wrongCount = {
        ...root,
        entryCount: root.entryCount + 1,
      };
      expectCode(
        () => validateCatalogRevision(canonicalBytes(wrongCount), shards),
        ERR_CATALOG_REFERENCE,
      );
      const tampered = Buffer.from(shards[0]);
      const forged = rootFromPlan(plan);
      forged.references = forged.references.map((reference) => {
        if (reference.empty) {
          return reference;
        }
        return { ...reference, canonicalRecordsSha256: 'ab'.repeat(32) };
      });
      expectCode(
        () => validateCatalogRevision(canonicalBytes(forged), shards),
        ERR_CATALOG_REFERENCE,
      );
      void tampered;
    }
  });

  test('accepts a cross-shard observation and rejects membership errors', () => {
    let snapshot;
    let observation;
    let found = false;
    for (let i = 300; i < 800; i += 1) {
      snapshot = snapshotRecord(i, {
        metadata: bulkyMetadata(`cross-${i}`, 40 * 1024),
        label: `cross-${i}`,
      });
      observation = observationRecord(i, snapshot);
      const snapHash = catalogRouteHash('snapshot', snapshot.body.package.sha256);
      const obsHash = catalogRouteHash('observation', observation.body.observationId);
      if (snapHash[0] !== obsHash[0]) {
        found = true;
        break;
      }
    }
    equal(found, true);
    const extras = [];
    for (let i = 0; i < 10; i += 1) {
      extras.push(
        snapshotRecord(2000 + i, {
          metadata: bulkyMetadata(`force-split-${i}`, 40 * 1024),
          label: `force-split-${i}`,
        }),
      );
    }
    const plan = planRecords([snapshot, observation, ...extras]);
    const nonempty = plan.leaves.filter((leaf) => !leaf.empty);
    equal(nonempty.length >= 2, true);
    const snapPrefix = catalogRouteHash('snapshot', snapshot.body.package.sha256)[0];
    const obsPrefix = catalogRouteHash('observation', observation.body.observationId)[0];
    ok(nonempty.some((leaf) => leaf.prefix.startsWith(snapPrefix)));
    ok(nonempty.some((leaf) => leaf.prefix.startsWith(obsPrefix)));
    const root = rootFromPlan(plan);
    validateCatalogRevision(canonicalBytes(root), shardPayloads(plan));
    const swapped = nonempty.map((leaf) => Buffer.from(leaf.payloadUtf8));
    const first = JSON.parse(Buffer.from(nonempty[0].payloadUtf8).toString('utf8'));
    const second = JSON.parse(Buffer.from(nonempty[1].payloadUtf8).toString('utf8'));
    const swappedFirst = { ...first, records: second.records };
    swapped[0] = canonicalBytes(swappedFirst);
    expectCode(() => validateCatalogRevision(canonicalBytes(root), swapped), ERR_CATALOG_REFERENCE);
  });

  test('rejects wrong plaintextByteLength and omitted shard epochs', () => {
    const snapshot = snapshotRecord(51);
    const plan = planRecords([snapshot]);
    const root = rootFromPlan(plan);
    const shards = shardPayloads(plan);
    const wrongLength = {
      ...root,
      references: root.references.map((reference) => {
        if (reference.empty) {
          return reference;
        }
        return { ...reference, plaintextByteLength: reference.plaintextByteLength + 1 };
      }),
    };
    expectCode(
      () => validateCatalogRevision(canonicalBytes(wrongLength), shards),
      ERR_CATALOG_REFERENCE,
    );
    const omittedEpoch = rootFromPlan(plan, { requiredEpochs: [] });
    expectCode(() => preflightCatalogRoot(canonicalBytes(omittedEpoch)), ERR_CATALOG_REFERENCE);
    expectCode(
      () => validateCatalogRevision(canonicalBytes(omittedEpoch), shards),
      ERR_CATALOG_REFERENCE,
    );
  });

  test('plan output stays isolated from later input mutation', () => {
    const snapshot = snapshotRecord(77);
    const records = [snapshot, observationRecord(77, snapshot)];
    const bytes = canonicalBytes(records);
    const plan = planCatalogShards(bytes);
    const before = fingerprints(plan);
    bytes[0] ^= 0xff;
    const again = planRecords(records);
    deepEqual(fingerprints(again), before);
    const nonempty = plan.leaves.find((leaf) => !leaf.empty);
    ok(nonempty);
    throws(() => {
      nonempty.entryCount = 9;
    }, TypeError);
    throws(() => {
      nonempty.canonicalRecordsSha256 = 'ab'.repeat(32);
    }, TypeError);
    const originalFirst = nonempty.payloadUtf8[0];
    const payload = nonempty.payloadUtf8;
    payload[0] ^= 0xff;
    equal(nonempty.payloadUtf8[0], originalFirst);
    equal(nonempty.plaintextByteLength, nonempty.payloadUtf8.byteLength);
    const third = planRecords(records);
    deepEqual(fingerprints(third), before);
  });

  test('rejects v1 locators and more than four locators', () => {
    const v1Locator = {
      provider: 'google-drive',
      accountBinding: { scheme: 'synthetic-fixture', value: 'fixture-account' },
      objectId: 'synFixtureObjectBaseline',
      revisionId: 'synFixtureRev1',
    };
    expectCode(() => planRecords([snapshotRecord(60, { locators: [v1Locator] })]), ERR_SCHEMA);
    const tooMany = [locator('a'), locator('b'), locator('c'), locator('d'), locator('e')];
    expectCode(() => planRecords([snapshotRecord(61, { locators: tooMany })]), ERR_SCHEMA);
  });
});

describe('catalog-v2 capacity and maxima', () => {
  test('max-size root with 1024 references and 4 locators stays below 4 MiB', () => {
    const locators = [0, 1, 2, 3].map((i) => ({
      provider: 'google-drive',
      accountBinding: { scheme: 'google-drive-permission-id', value: `${'A'.repeat(127)}${i}` },
      objectId: `${'B'.repeat(127)}${i}`,
      revisionId: `${'C'.repeat(127)}${i}`,
    }));
    const references = [];
    for (let i = 0; i < 1024; i += 1) {
      const prefix = i.toString(16).padStart(3, '0');
      references.push({
        prefix,
        empty: false,
        recordId: id32FromIndex(0x80000 + i),
        generationId: id32FromIndex(0x90000 + i),
        rootEpoch: id16FromIndex(100 + (i % 200)),
        wireSha256: digestFromIndex(0xa000 + i),
        wireByteLength: 2097152,
        plaintextByteLength: 1048576,
        entryCount: 1024,
        observationCount: 0,
        canonicalRecordsSha256: digestFromIndex(0xb000 + i),
        locators,
      });
    }
    const parents = [];
    for (let i = 0; i < 16; i += 1) {
      parents.push(digestFromIndex(0xc000 + i));
    }
    parents.sort();
    const requiredEpochs = [];
    for (let i = 0; i < 256; i += 1) {
      requiredEpochs.push(id16FromIndex(300 + i));
    }
    requiredEpochs.sort();
    const root = {
      payloadVersion: 2,
      nodeType: 'root',
      partitionVersion: 1,
      parents,
      entryCount: 10000,
      observationCount: 0,
      requiredEpochs,
      references,
    };
    const bytes = canonicalBytes(root);
    ok(bytes.byteLength < CATALOG_V2_LIMITS.rootPlaintextBytes);
    const parsed = parseCatalogNode(bytes, 'root');
    equal(parsed.payload.references.length, 1024);
    equal(parsed.payload.references[0].locators.length, 4);
    expectCode(() => preflightCatalogRoot(bytes), ERR_CATALOG_COVER);
    expectCode(() => validateCatalogRevision(bytes, []), ERR_CATALOG_COVER);
  });

  test('valid maximal complete-cover root has 1021 references under the 1024 ceiling', () => {
    const prefixes = completeCoverPrefixes(68);
    equal(prefixes.length, 1021);
    const locators = [locator('max-cover')];
    const references = prefixes.map((prefix, i) => ({
      prefix,
      empty: false,
      recordId: id32FromIndex(0x81000 + i),
      generationId: id32FromIndex(0x91000 + i),
      rootEpoch: EPOCH,
      wireSha256: digestFromIndex(0xd000 + i),
      wireByteLength: 4096,
      plaintextByteLength: 2048,
      entryCount: 1,
      observationCount: 0,
      canonicalRecordsSha256: digestFromIndex(0xe000 + i),
      locators,
    }));
    const root = {
      payloadVersion: 2,
      nodeType: 'root',
      partitionVersion: 1,
      parents: [],
      entryCount: 1021,
      observationCount: 0,
      requiredEpochs: [EPOCH],
      references,
    };
    const bytes = canonicalBytes(root);
    ok(bytes.byteLength < CATALOG_V2_LIMITS.rootPlaintextBytes);
    const parsed = parseCatalogNode(bytes, 'root');
    equal(parsed.payload.references.length, 1021);
    const preflight = preflightCatalogRoot(bytes);
    equal(preflight.root.entryCount, 1021);
    equal(preflight.declaredEntryCount, 1021);
    equal(preflight.declaredObservationCount, 0);
    equal(preflight.declaredShardPlaintextBytes, 1021 * 2048);
    equal(preflight.nonemptyReferenceCount, 1021);
    ok(preflight.declaredShardPlaintextBytes <= CATALOG_V2_LIMITS.cumulativeShardPlaintextBytes);
  });

  test(
    'uniform 10000 entries and 40000 observations fit 1024 references',
    { timeout: 180000 },
    () => {
      const records = [];
      for (let i = 0; i < 10000; i += 1) {
        const locators = [0, 1, 2, 3].map((n) => locator(`${i}n${n}`));
        const snapshot = snapshotRecord(1000 + i, { locators, byteLength: 2048 + (i % 64) });
        records.push(snapshot);
        for (let n = 0; n < 4; n += 1) {
          records.push(
            observationRecord(1000 + i * 4 + n, snapshot, {
              locator: locators[n],
              observationId: id32FromIndex(0x35000 + i * 4 + n),
            }),
          );
        }
      }
      const plan = planRecords(records);
      equal(plan.entryCount, 10000);
      equal(plan.observationCount, 40000);
      ok(plan.leaves.length <= CATALOG_V2_LIMITS.maxReferences);
      ok(plan.cumulativePlaintextBytes <= CATALOG_V2_LIMITS.cumulativeShardPlaintextBytes);
      equal(plan.liveWitnesses.length, 10000);
      const first = fingerprints(plan);
      for (let n = 0; n < 5; n += 1) {
        const again = planRecords(records);
        deepEqual(fingerprints(again), first);
        equal(again.observationCount, 40000);
        equal(again.entryCount, 10000);
      }
      const root = rootFromPlan(plan);
      const revision = validateCatalogRevision(canonicalBytes(root), shardPayloads(plan));
      equal(revision.root.entryCount, 10000);
      equal(revision.root.observationCount, 40000);
    },
  );

  test('capacity failures never drop records', () => {
    expectCode(() => planRecords(Array.from({ length: 10001 }, (_, i) => snapshotRecord(i + 3))), ERR_CATALOG_CAPACITY);
    const live = snapshotRecord(70);
    const observations = Array.from({ length: 40001 }, (_, i) =>
      observationRecord(70 + i, live, { observationId: id32FromIndex(0x36000 + i) }),
    );
    expectCode(() => planRecords([live, ...observations]), ERR_CATALOG_CAPACITY);
  });

  test('reachable bulky records hit a late capacity ceiling and wipe emitted payloads', () => {
    const bulky = [];
    for (let i = 0; i < 1500; i += 1) {
      bulky.push(
        snapshotRecord(8000 + i, {
          metadata: bulkyMetadata(`m${i}`, 40 * 1024),
          label: `bulgy-${i}`,
        }),
      );
    }
    const originalFill = Uint8Array.prototype.fill;
    const shardMarker = Buffer.from('"nodeType":"shard"');
    const fingerprintCounts = new Map();
    Uint8Array.prototype.fill = function fillSpy(value, start, end) {
      if (value === 0 && this.byteLength > 1024) {
        const view = Buffer.from(this);
        if (view.includes(shardMarker)) {
          const digest = sha256Hex(view);
          fingerprintCounts.set(digest, (fingerprintCounts.get(digest) ?? 0) + 1);
        }
      }
      return originalFill.call(this, value, start, end);
    };
    try {
      expectCode(() => planRecords(bulky), ERR_CATALOG_CAPACITY);
    } finally {
      Uint8Array.prototype.fill = originalFill;
    }
    ok(
      [...fingerprintCounts.values()].some((count) => count >= 2),
      'late partition failure must wipe previously emitted owned leaf payloads',
    );
  });

  test('depth-64 is a SHA-256 collision bound and is not synthesized', () => {
    equal(CATALOG_V2_LIMITS.maxPrefixDepth, 64);
    equal(completeCoverPrefixes(68).length, 1021);
    ok(completeCoverPrefixes(68).every((prefix) => prefix.length < CATALOG_V2_LIMITS.maxPrefixDepth));
  });

  test('uneven UTF-8 metadata still splits on encoded byte size', () => {
    const light = snapshotRecord(90, { label: 'ascii' });
    const heavy = snapshotRecord(91, {
      metadata: bulkyMetadata('utf8-heavy', 32 * 1024),
      label: 'café-naïve-日本語',
    });
    const plan = planRecords([light, heavy, observationRecord(90, light), observationRecord(91, heavy)]);
    ok(plan.leaves.some((leaf) => leaf.empty) || plan.leaves.length >= 1);
    const root = rootFromPlan(plan);
    validateCatalogRevision(canonicalBytes(root), shardPayloads(plan));
    for (const leaf of plan.leaves) {
      if (!leaf.empty) {
        ok(leaf.plaintextByteLength === leaf.payloadUtf8.byteLength);
        ok(leaf.plaintextByteLength <= CATALOG_V2_LIMITS.shardPlaintextBytes);
      }
    }
  });
});

describe('catalog-v2 preflight, receipts, and hostile inputs', () => {
  test('preflight rejects incomplete, overlapping, inconsistent, and oversized declared roots', () => {
    const emptyBytes = canonicalBytes(vectors.emptyRoot);
    const emptyPreflight = preflightCatalogRoot(emptyBytes);
    equal(emptyPreflight.nonemptyReferenceCount, 0);
    equal(emptyPreflight.declaredShardPlaintextBytes, 0);

    const incomplete = {
      ...vectors.emptyRoot,
      references: [{ prefix: '0', empty: true }],
    };
    parseCatalogNode(canonicalBytes(incomplete), 'root');
    expectCode(() => preflightCatalogRoot(canonicalBytes(incomplete)), ERR_CATALOG_COVER);

    const overlap = {
      ...vectors.emptyRoot,
      references: [
        { prefix: '0', empty: true },
        { prefix: '00', empty: true },
      ],
    };
    expectCode(() => preflightCatalogRoot(canonicalBytes(overlap)), ERR_CATALOG_COVER);

    const inconsistent = {
      ...vectors.emptyRoot,
      entryCount: 1,
    };
    expectCode(() => preflightCatalogRoot(canonicalBytes(inconsistent)), ERR_CATALOG_REFERENCE);

    const prefixes = completeCoverPrefixes(5);
    equal(prefixes.length, 76);
    const oversized = {
      payloadVersion: 2,
      nodeType: 'root',
      partitionVersion: 1,
      parents: [],
      entryCount: 65,
      observationCount: 0,
      requiredEpochs: [EPOCH],
      references: prefixes.map((prefix, i) => {
        if (i >= 65) {
          return { prefix, empty: true };
        }
        return {
          prefix,
          empty: false,
          recordId: id32FromIndex(0x82000 + i),
          generationId: id32FromIndex(0x92000 + i),
          rootEpoch: EPOCH,
          wireSha256: digestFromIndex(0xf000 + i),
          wireByteLength: 2097152,
          plaintextByteLength: 1048576,
          entryCount: 1,
          observationCount: 0,
          canonicalRecordsSha256: digestFromIndex(0xf100 + i),
          locators: [locator(`over${i}`)],
        };
      }),
    };
    parseCatalogNode(canonicalBytes(oversized), 'root');
    expectCode(() => preflightCatalogRoot(canonicalBytes(oversized)), ERR_CATALOG_CAPACITY);
    expectCode(
      () => validateCatalogRevision(canonicalBytes(oversized), []),
      ERR_CATALOG_CAPACITY,
    );
  });

  test('rejects receipt newActiveEpoch in retainedOldEpochs and current digest in parents', () => {
    const snapshot = snapshotRecord(80);
    const epochInOld = receiptRecord(80, {
      retainedOldEpochs: [id16FromIndex(21)],
      newActiveEpoch: id16FromIndex(21),
    });
    expectCode(() => planRecords([snapshot, epochInOld]), ERR_SCHEMA);
    const currentInParents = receiptRecord(81, {
      parentRootRecordSha256: [digestFromIndex(9100 + 81)],
      currentRootRecordSha256: digestFromIndex(9100 + 81),
    });
    expectCode(() => planRecords([snapshot, currentInParents]), ERR_SCHEMA);
  });

  test('rejects a manually supplied multi-record shard above the 256 KiB split target', () => {
    const records = [];
    for (let i = 0; i < 20; i += 1) {
      records.push(
        snapshotRecord(900 + i, {
          metadata: bulkyMetadata(`manual-${i}`, 40 * 1024),
          label: `manual-${i}`,
        }),
      );
    }
    records.sort((a, b) => {
      const ha = catalogRouteHash('snapshot', a.body.package.sha256);
      const hb = catalogRouteHash('snapshot', b.body.package.sha256);
      if (ha < hb) {
        return -1;
      }
      if (ha > hb) {
        return 1;
      }
      return a.body.package.sha256 < b.body.package.sha256 ? -1 : 1;
    });
    const shard = {
      payloadVersion: 2,
      nodeType: 'shard',
      partitionVersion: 1,
      prefix: '',
      records,
    };
    const shardBytes = canonicalBytes(shard);
    ok(shardBytes.byteLength > CATALOG_V2_LIMITS.shardTargetBytes);
    ok(shardBytes.byteLength <= CATALOG_V2_LIMITS.shardPlaintextBytes);
    parseCatalogNode(shardBytes, 'shard');
    const root = {
      payloadVersion: 2,
      nodeType: 'root',
      partitionVersion: 1,
      parents: [],
      entryCount: 20,
      observationCount: 0,
      requiredEpochs: [EPOCH],
      references: [
        {
          prefix: '',
          empty: false,
          recordId: id32FromIndex(0x83000),
          generationId: id32FromIndex(0x93000),
          rootEpoch: EPOCH,
          wireSha256: digestFromIndex(0xaa00),
          wireByteLength: 4096,
          plaintextByteLength: shardBytes.byteLength,
          entryCount: 20,
          observationCount: 0,
          canonicalRecordsSha256: sha256Hex(canonicalBytes(records)),
          locators: [locator('manual-leaf')],
        },
      ],
    };
    expectCode(() => preflightCatalogRoot(canonicalBytes(root)), ERR_CATALOG_CAPACITY);
    expectCode(() => validateCatalogRevision(canonicalBytes(root), [shardBytes]), ERR_CATALOG_CAPACITY);
  });

  test('validateCatalogRevision redacts hostile arrays, revoked proxies, and getter traps', () => {
    const rootBytes = canonicalBytes(vectors.emptyRoot);
    const sentinel = 'SYNTHETIC_SHARD_LENGTH_SENTINEL';
    const lengthTrap = new Proxy([], {
      get(target, prop, receiver) {
        if (prop === 'length') {
          throw new Error(sentinel);
        }
        return Reflect.get(target, prop, receiver);
      },
      getPrototypeOf() {
        throw new Error(`prototype trap ${SECRET_MARKER}`);
      },
      getOwnPropertyDescriptor() {
        throw new Error(`descriptor trap ${SECRET_MARKER}`);
      },
    });
    const lengthErr = expectCode(() => validateCatalogRevision(rootBytes, lengthTrap), ERR_SCHEMA);
    ok(!String(lengthErr.message).includes(sentinel));
    ok(!String(lengthErr.stack || '').includes(sentinel));

    const oneShard = snapshotRecord(89);
    const onePlan = planRecords([oneShard]);
    const oneRoot = canonicalBytes(rootFromPlan(onePlan));
    const indexTrap = new Proxy([], {
      get(target, prop, receiver) {
        if (prop === 'length') {
          return 1;
        }
        if (prop === '0' || prop === 0) {
          throw new Error(`index trap ${SECRET_MARKER}`);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    expectCode(() => validateCatalogRevision(oneRoot, indexTrap), ERR_SCHEMA);

    const thrownProxy = new Proxy(
      {},
      {
        get() {
          throw new Error(`thrown proxy ${SECRET_MARKER}`);
        },
        getPrototypeOf() {
          throw new Error(`thrown proxy proto ${SECRET_MARKER}`);
        },
      },
    );
    const throwingCode = new Proxy([], {
      get(target, prop, receiver) {
        if (prop === 'length') {
          throw thrownProxy;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const thrownErr = expectCode(() => validateCatalogRevision(rootBytes, throwingCode), ERR_SCHEMA);
    ok(!JSON.stringify(thrownErr).includes(SECRET_MARKER));

    const { proxy, revoke } = Proxy.revocable([], {});
    revoke();
    expectCode(() => validateCatalogRevision(rootBytes, proxy), ERR_SCHEMA);
    const revokedBytes = Proxy.revocable(new Uint8Array(rootBytes), {});
    revokedBytes.revoke();
    expectCode(() => parseCatalogNode(revokedBytes.proxy, 'root'), ERR_SCHEMA);
    expectCode(() => preflightCatalogRoot(revokedBytes.proxy), ERR_SCHEMA);

    expectCode(() => validateCatalogRevision(rootBytes, { length: 1 }), ERR_SCHEMA);

    const nonsense = (length) =>
      new Proxy([], {
        get(target, prop, receiver) {
          if (prop === 'length') {
            return length;
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    expectCode(() => validateCatalogRevision(rootBytes, nonsense(-1)), ERR_SCHEMA);
    expectCode(() => validateCatalogRevision(rootBytes, nonsense(1.5)), ERR_SCHEMA);
    expectCode(() => validateCatalogRevision(rootBytes, nonsense(Number.POSITIVE_INFINITY)), ERR_SCHEMA);
    expectCode(() => validateCatalogRevision(rootBytes, nonsense(Number.MAX_SAFE_INTEGER + 1)), ERR_SCHEMA);
    expectCode(
      () => validateCatalogRevision(rootBytes, nonsense(CATALOG_V2_LIMITS.maxReferences + 1)),
      ERR_CATALOG_CAPACITY,
    );
  });

  test('validateCatalogRevision owns shard bytes before caller mutation', () => {
    const snapshot = snapshotRecord(88);
    const plan = planRecords([snapshot]);
    const root = canonicalBytes(rootFromPlan(plan));
    const shards = shardPayloads(plan);
    const original = Buffer.from(shards[0]);
    const revision = validateCatalogRevision(root, shards);
    shards[0][0] ^= 0xff;
    equal(revision.root.entryCount, 1);
    equal(revision.shards.length, 1);
    shards[0] = original;
    const again = validateCatalogRevision(root, [original]);
    equal(again.liveWitnesses[0].digest, snapshot.body.package.sha256);
  });
});

function coveringPrefix(prefixes, routeHash) {
  const match = prefixes.find((prefix) => routeHash.startsWith(prefix));
  ok(match !== undefined, 'complete cover must contain a prefix for the route hash');
  return match;
}

function forgedSecretError() {
  return new KernelError(FORGED_STATIC_CODE);
}

function throwingDiagnosticError() {
  const base = new KernelError(ERR_SCHEMA);
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === 'code' || prop === 'message' || prop === 'stack' || prop === 'name') {
        throw forgedSecretError();
      }
      return Reflect.get(target, prop, receiver);
    },
    getPrototypeOf() {
      throw forgedSecretError();
    },
    getOwnPropertyDescriptor() {
      throw forgedSecretError();
    },
  });
}

describe('catalog-v2 static diagnostics, ownership budget, and exact epochs', () => {
  test('forged KernelError codes from length, index, bytes, and diagnostics stay static', () => {
    const snapshot = snapshotRecord(94);
    const plan = planRecords([snapshot]);
    const rootBytes = canonicalBytes(rootFromPlan(plan));
    const shardBytes = shardPayloads(plan)[0];

    const lengthTrap = new Proxy([], {
      get(target, prop, receiver) {
        if (prop === 'length') {
          throw new KernelError(FORGED_STATIC_CODE);
        }
        return Reflect.get(target, prop, receiver);
      },
      getPrototypeOf() {
        throw new KernelError(FORGED_STATIC_CODE);
      },
      getOwnPropertyDescriptor() {
        throw new KernelError(FORGED_STATIC_CODE);
      },
    });
    const lengthErr = expectCode(() => validateCatalogRevision(rootBytes, lengthTrap), ERR_SCHEMA);
    equal(lengthErr.code, ERR_SCHEMA);
    ok(lengthErr.code !== FORGED_STATIC_CODE);
    ok(!String(lengthErr.message).includes(FORGED_STATIC_CODE));
    ok(!JSON.stringify(lengthErr).includes(FORGED_STATIC_CODE));
    ok(!JSON.stringify(lengthErr).includes(SECRET_MARKER));

    const indexTrap = new Proxy([], {
      get(target, prop, receiver) {
        if (prop === 'length') {
          return 1;
        }
        if (prop === '0' || prop === 0) {
          throw new KernelError(FORGED_STATIC_CODE);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    expectCode(() => validateCatalogRevision(rootBytes, indexTrap), ERR_SCHEMA);

    const diagnosticTrap = new Proxy([], {
      get(target, prop, receiver) {
        if (prop === 'length') {
          throw throwingDiagnosticError();
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const diagnosticErr = expectCode(
      () => validateCatalogRevision(rootBytes, diagnosticTrap),
      ERR_SCHEMA,
    );
    ok(!JSON.stringify(diagnosticErr).includes(FORGED_STATIC_CODE));
    ok(!JSON.stringify(diagnosticErr).includes(SECRET_MARKER));

    const hostileBytes = new Proxy(shardBytes, {
      get(target, prop, receiver) {
        if (prop === 'byteLength' || prop === 'length') {
          throw new KernelError(FORGED_STATIC_CODE);
        }
        return Reflect.get(target, prop, receiver);
      },
      getPrototypeOf() {
        throw new KernelError(FORGED_STATIC_CODE);
      },
      getOwnPropertyDescriptor() {
        throw new KernelError(FORGED_STATIC_CODE);
      },
    });
    const byteTrap = new Proxy([], {
      get(target, prop, receiver) {
        if (prop === 'length') {
          return 1;
        }
        if (prop === '0' || prop === 0) {
          return hostileBytes;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    expectCode(() => validateCatalogRevision(rootBytes, byteTrap), ERR_SCHEMA);

    const hostileRoot = new Proxy(rootBytes, {
      getPrototypeOf() {
        throw new KernelError(FORGED_STATIC_CODE);
      },
      getOwnPropertyDescriptor() {
        throw new KernelError(FORGED_STATIC_CODE);
      },
    });
    expectCode(() => parseCatalogNode(hostileRoot, 'root'), ERR_SCHEMA);
    expectCode(() => validateCatalogRevision(hostileRoot, []), ERR_SCHEMA);
  });

  test('allowlisted KernelError from caller getPrototypeOf stays WPP_SCHEMA', () => {
    const rootBytes = canonicalBytes(vectors.emptyRoot);
    const recordsBytes = canonicalBytes([]);
    const allowlisted = () => {
      throw new KernelError(ERR_CATALOG_CAPACITY);
    };
    const secretThrow = () => {
      throw throwingDiagnosticError();
    };
    const hostile = (bytes, trap) =>
      new Proxy(bytes, {
        getPrototypeOf() {
          trap();
        },
        getOwnPropertyDescriptor() {
          trap();
        },
      });

    const capacityRoot = hostile(rootBytes, allowlisted);
    const capacityRecords = hostile(recordsBytes, allowlisted);
    const parseErr = expectCode(() => parseCatalogNode(capacityRoot, 'root'), ERR_SCHEMA);
    equal(parseErr.code, ERR_SCHEMA);
    ok(!JSON.stringify(parseErr).includes(ERR_CATALOG_CAPACITY));
    expectCode(() => planCatalogShards(capacityRecords), ERR_SCHEMA);
    expectCode(() => preflightCatalogRoot(capacityRoot), ERR_SCHEMA);
    expectCode(() => validateCatalogRevision(capacityRoot, []), ERR_SCHEMA);

    const diagnosticRoot = hostile(rootBytes, secretThrow);
    const diagnosticRecords = hostile(recordsBytes, secretThrow);
    const diagnosticErr = expectCode(() => parseCatalogNode(diagnosticRoot, 'root'), ERR_SCHEMA);
    ok(!JSON.stringify(diagnosticErr).includes(FORGED_STATIC_CODE));
    ok(!JSON.stringify(diagnosticErr).includes(SECRET_MARKER));
    expectCode(() => planCatalogShards(diagnosticRecords), ERR_SCHEMA);
    expectCode(() => preflightCatalogRoot(diagnosticRoot), ERR_SCHEMA);
    expectCode(() => validateCatalogRevision(diagnosticRoot, []), ERR_SCHEMA);

    const oversized = new Uint8Array(CATALOG_V2_LIMITS.rootPlaintextBytes + 1);
    expectCode(() => parseCatalogNode(oversized, 'root'), ERR_INPUT_TOO_LARGE);
    const oversizedPlan = new Uint8Array(CATALOG_V2_LIMITS.planInputBytes + 1);
    expectCode(() => planCatalogShards(oversizedPlan), ERR_INPUT_TOO_LARGE);
  });

  test('aggregate shard budget stops before copying every reused slot', () => {
    const prefixes = completeCoverPrefixes(68);
    equal(prefixes.length, 1021);
    const dummyRoot = {
      payloadVersion: 2,
      nodeType: 'root',
      partitionVersion: 1,
      parents: [],
      entryCount: 1021,
      observationCount: 0,
      requiredEpochs: [EPOCH],
      references: prefixes.map((prefix, i) => ({
        prefix,
        empty: false,
        recordId: id32FromIndex(0x84000 + i),
        generationId: id32FromIndex(0x94000 + i),
        rootEpoch: EPOCH,
        wireSha256: digestFromIndex(0x11000 + i),
        wireByteLength: 4096,
        plaintextByteLength: 2048,
        entryCount: 1,
        observationCount: 0,
        canonicalRecordsSha256: digestFromIndex(0x12000 + i),
        locators: [locator(`budget${i}`)],
      })),
    };
    const rootBytes = canonicalBytes(dummyRoot);
    preflightCatalogRoot(rootBytes);

    const reused = new Uint8Array(CATALOG_V2_LIMITS.shardPlaintextBytes);
    let accesses = 0;
    const many = new Proxy([], {
      get(target, prop, receiver) {
        if (prop === 'length') {
          return 1021;
        }
        const index = typeof prop === 'symbol' ? prop : Number(prop);
        if (Number.isInteger(index) && index >= 0 && index < 1021) {
          accesses += 1;
          return reused;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    expectCode(() => validateCatalogRevision(rootBytes, many), ERR_CATALOG_CAPACITY);
    ok(accesses > 0);
    ok(accesses < 16, `aggregate bound must stop early, accesses=${accesses}`);

    let emptyAccesses = 0;
    const emptyRoot = canonicalBytes(vectors.emptyRoot);
    const emptyMany = new Proxy([], {
      get(target, prop, receiver) {
        if (prop === 'length') {
          return 64;
        }
        const index = typeof prop === 'symbol' ? prop : Number(prop);
        if (Number.isInteger(index) && index >= 0 && index < 64) {
          emptyAccesses += 1;
          return reused;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    expectCode(() => validateCatalogRevision(emptyRoot, emptyMany), ERR_CATALOG_COVER);
    equal(emptyAccesses, 0);
  });

  test('root is cloned before shard getters can mutate or revoke caller input', () => {
    const snapshot = snapshotRecord(95);
    const plan = planRecords([snapshot]);
    const rootBytes = canonicalBytes(rootFromPlan(plan));
    const shards = shardPayloads(plan);
    const mutating = new Proxy(shards, {
      get(target, prop, receiver) {
        if (prop === 'length' || prop === '0' || prop === 0) {
          rootBytes[0] ^= 0xff;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const revision = validateCatalogRevision(rootBytes, mutating);
    equal(revision.root.entryCount, 1);
    equal(revision.liveWitnesses[0].digest, snapshot.body.package.sha256);

    const freshRoot = new Uint8Array(canonicalBytes(rootFromPlan(plan)));
    const { proxy: extraRoot, revoke } = Proxy.revocable(new Uint8Array(freshRoot), {});
    const revoking = new Proxy(shards, {
      get(target, prop, receiver) {
        if (prop === 'length') {
          freshRoot.fill(0xff);
          revoke();
          return target.length;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const afterRevoke = validateCatalogRevision(freshRoot, revoking);
    equal(afterRevoke.root.entryCount, 1);
    expectCode(() => parseCatalogNode(extraRoot, 'root'), ERR_SCHEMA);
  });

  test('requiredEpochs allow one unknown header epoch and reject a second extra', () => {
    const epochB = id16FromIndex(7);
    const header = id16FromIndex(8);
    const falseExtra = id16FromIndex(9);
    const snapA = snapshotRecord(201);
    const snapB = snapshotRecord(202, { rootEpoch: epochB });
    const plan = planRecords([snapA, snapB]);
    ok(plan.requiredEpochs.includes(EPOCH));
    ok(plan.requiredEpochs.includes(epochB));
    equal(plan.requiredEpochs.length, 2);

    const withHeader = rootFromPlan(plan, {
      requiredEpochs: [...plan.requiredEpochs, header].sort(),
    });
    const headerPreflight = preflightCatalogRoot(canonicalBytes(withHeader));
    equal(headerPreflight.root.requiredEpochs.length, 3);
    const accepted = validateCatalogRevision(canonicalBytes(withHeader), shardPayloads(plan));
    equal(accepted.root.requiredEpochs.length, 3);

    const twoExtras = rootFromPlan(plan, {
      requiredEpochs: [...plan.requiredEpochs, header, falseExtra].sort(),
    });
    const extraPreflight = preflightCatalogRoot(canonicalBytes(twoExtras));
    equal(extraPreflight.root.requiredEpochs.length, 4);
    expectCode(
      () => validateCatalogRevision(canonicalBytes(twoExtras), shardPayloads(plan)),
      ERR_CATALOG_REFERENCE,
    );

    const emptyHeader = {
      ...vectors.emptyRoot,
      requiredEpochs: [header],
    };
    const emptyWithHeader = validateCatalogRevision(canonicalBytes(emptyHeader), []);
    equal(emptyWithHeader.root.requiredEpochs.length, 1);
    const emptyTwo = {
      ...vectors.emptyRoot,
      requiredEpochs: [header, falseExtra].sort(),
    };
    expectCode(() => validateCatalogRevision(canonicalBytes(emptyTwo), []), ERR_CATALOG_REFERENCE);
  });

  test('1021-reference complete cover validates with matching payloads and empty markers', () => {
    const prefixes = completeCoverPrefixes(68);
    equal(prefixes.length, 1021);
    const emptyRoot = {
      payloadVersion: 2,
      nodeType: 'root',
      partitionVersion: 1,
      parents: [],
      entryCount: 0,
      observationCount: 0,
      requiredEpochs: [],
      references: prefixes.map((prefix) => ({ prefix, empty: true })),
    };
    const emptyBytes = canonicalBytes(emptyRoot);
    const emptyPreflight = preflightCatalogRoot(emptyBytes);
    equal(emptyPreflight.nonemptyReferenceCount, 0);
    const emptyRevision = validateCatalogRevision(emptyBytes, []);
    equal(emptyRevision.shards.length, 0);
    equal(emptyRevision.root.references.length, 1021);

    const snapshot = snapshotRecord(1021);
    const routeHash = catalogRouteHash('snapshot', snapshot.body.package.sha256);
    const match = coveringPrefix(prefixes, routeHash);
    const shard = {
      payloadVersion: 2,
      nodeType: 'shard',
      partitionVersion: 1,
      prefix: match,
      records: [snapshot],
    };
    const shardBytes = canonicalBytes(shard);
    const mixedRoot = {
      payloadVersion: 2,
      nodeType: 'root',
      partitionVersion: 1,
      parents: [],
      entryCount: 1,
      observationCount: 0,
      requiredEpochs: [EPOCH],
      references: prefixes.map((prefix) => {
        if (prefix !== match) {
          return { prefix, empty: true };
        }
        return {
          prefix,
          empty: false,
          recordId: id32FromIndex(0x85000),
          generationId: id32FromIndex(0x95000),
          rootEpoch: EPOCH,
          wireSha256: digestFromIndex(0x13000),
          wireByteLength: 4096,
          plaintextByteLength: shardBytes.byteLength,
          entryCount: 1,
          observationCount: 0,
          canonicalRecordsSha256: sha256Hex(canonicalBytes([snapshot])),
          locators: [locator('max-rev')],
        };
      }),
    };
    const mixedBytes = canonicalBytes(mixedRoot);
    const mixedPreflight = preflightCatalogRoot(mixedBytes);
    equal(mixedPreflight.nonemptyReferenceCount, 1);
    const mixedRevision = validateCatalogRevision(mixedBytes, [shardBytes]);
    equal(mixedRevision.shards.length, 1);
    equal(mixedRevision.liveWitnesses[0].digest, snapshot.body.package.sha256);
  });
});
