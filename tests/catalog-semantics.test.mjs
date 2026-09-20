import { deepEqual, equal, notEqual, ok, throws } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CatalogError,
  ERR_CATALOG_BINDING,
  ERR_CATALOG_CONFLICT,
  ERR_CATALOG_INPUT,
  ERR_CATALOG_LIMIT,
  ERR_CATALOG_REFERENCE,
  parseCatalog,
  reconcileCatalogs,
  verifySnapshotClaim,
} from '../dist/catalog/index.js';
import {
  LIMIT_METADATA_CANONICAL_BYTES,
  LIMIT_PLAINTEXT_BYTES,
  canonicalizeJson,
} from '../dist/kernel/json.js';

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
const BASELINE_DIGEST = 'b2447323ddb7161657fe9051dd9d4021a1187ca00d39e04124e52bb41651092c';
const FIXTURE_PARENT = '01'.repeat(32);
const REV_A = '11'.repeat(32);
const REV_B = '12'.repeat(32);
const REV_C = '13'.repeat(32);
const REV_D = '14'.repeat(32);
const MISSING_PARENT = '99'.repeat(32);
const VAULT_ID = vector.inputs.header.vaultId;
const utf8 = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function catalogNamed(name) {
  return clone(fixtures.catalogs[name]);
}

function snapshotOf(catalog) {
  return catalog.entries.find((entry) => entry.entryKind === 'snapshot');
}

function catalogError(code) {
  return (err) =>
    err instanceof CatalogError &&
    err.code === code &&
    err.message === code &&
    err.name === 'CatalogError';
}

function inputOf(revisionSha256, catalog) {
  return { revisionSha256, payloadUtf8: utf8(catalog) };
}

function id32(index) {
  const bytes = Buffer.alloc(32);
  bytes.writeUInt32BE(index >>> 0, 28);
  return bytes.toString('base64url');
}

function digest(index) {
  return index.toString(16).padStart(64, '0');
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
  const base = snapshotOf(catalogNamed('baseline'));
  const entry = clone(base);
  entry.package = { ...entry.package, sha256: digest(index), generationId: id32(index), ...extra.package };
  if (extra.metadata) {
    entry.metadata = { ...entry.metadata, ...extra.metadata };
  }
  if (Object.prototype.hasOwnProperty.call(extra, 'label')) {
    entry.label = extra.label;
  }
  entry.locators = extra.locators ? extra.locators.map((item) => clone(item)) : [locator(index)];
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

function fatPrivateStateIds(tag) {
  const ids = [];
  for (let i = 0; i < 192; i += 1) {
    const prefix = `${tag}:${i.toString(16).padStart(3, '0')}:`;
    ids.push(`${prefix}${'é'.repeat(128)}`);
  }
  return ids;
}

function fatSnapshot(index, extra = {}) {
  const entry = makeSnapshot(index, extra);
  entry.metadata.privateStateIds = fatPrivateStateIds(index);
  return entry;
}

function metadataCanonicalBytes(entry) {
  return Buffer.byteLength(canonicalizeJson(entry.metadata), 'utf8');
}

function matchingOpened(entry) {
  return {
    opened: {
      header: {
        format: 'wpp-witness-package',
        version: 1,
        suite: 'HKDF-SHA256+A256GCM',
        vaultId: VAULT_ID,
        vaultSalt: vector.inputs.header.vaultSalt,
        rootEpoch: entry.package.rootEpoch,
        scopeId: entry.package.scopeId,
        recordId: entry.package.recordId,
        generationId: entry.package.generationId,
        kind: 'snapshot',
        nonce: vector.inputs.header.nonce,
      },
      metadata: clone(entry.metadata),
      content: { marker: 'synthetic-open-result' },
      packageSha256: entry.package.sha256,
    },
    wireByteLength: entry.package.byteLength,
  };
}

function liveCatalog(digestValue = BASELINE_DIGEST, parents = []) {
  const catalog = catalogNamed('baseline');
  catalog.parents = parents;
  if (digestValue !== BASELINE_DIGEST) {
    snapshotOf(catalog).package.sha256 = digestValue;
    catalog.observations = [];
  }
  return catalog;
}

function tombstoneCatalog(digestValue = BASELINE_DIGEST, parents = []) {
  const catalog = catalogNamed('tombstoned');
  catalog.parents = parents;
  if (digestValue !== BASELINE_DIGEST) {
    snapshotOf(catalog).package.sha256 = digestValue;
    catalog.entries.find((entry) => entry.entryKind === 'tombstone').targetPackageSha256 = digestValue;
    catalog.observations = [];
  }
  return catalog;
}

describe('parseCatalog fixtures', () => {
  for (const name of CATALOG_NAMES) {
    test(`parses ${name}`, () => {
      const catalog = parseCatalog(utf8(catalogNamed(name)));
      equal(catalog.payloadVersion, 1);
      ok(Object.isFrozen(catalog));
      ok(Array.isArray(catalog.entries));
      ok(Array.isArray(catalog.observations));
    });
  }

  test('retains snapshot and tombstone in one catalog', () => {
    const catalog = parseCatalog(utf8(catalogNamed('tombstoned')));
    const kinds = catalog.entries.map((entry) => entry.entryKind).sort();
    deepEqual(kinds, ['snapshot', 'tombstone']);
    const snapshot = catalog.entries.find((entry) => entry.entryKind === 'snapshot');
    const tombstone = catalog.entries.find((entry) => entry.entryKind === 'tombstone');
    equal(snapshot.package.sha256, BASELINE_DIGEST);
    equal(tombstone.targetPackageSha256, BASELINE_DIGEST);
  });

  test('returns an isolated view', () => {
    const catalog = parseCatalog(utf8(catalogNamed('baseline')));
    throws(() => {
      catalog.payloadVersion = 2;
    });
    throws(() => {
      catalog.entries.pop();
    });
  });
});

describe('parseCatalog input errors', () => {
  test('rejects a caller object graph', () => {
    throws(() => parseCatalog(catalogNamed('baseline')), catalogError(ERR_CATALOG_INPUT));
  });

  test('rejects BOM', () => {
    const body = utf8(catalogNamed('baseline'));
    throws(() => parseCatalog(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body])), catalogError(ERR_CATALOG_INPUT));
  });

  test('rejects comments', () => {
    throws(() => parseCatalog(utf8('{"payloadVersion":1 /* x */}')), catalogError(ERR_CATALOG_INPUT));
  });

  test('rejects trailing commas', () => {
    throws(() => parseCatalog(utf8('{"payloadVersion":1,}')), catalogError(ERR_CATALOG_INPUT));
  });

  test('rejects duplicate keys', () => {
    throws(
      () => parseCatalog(utf8('{"payloadVersion":1,"payloadVersion":1,"parents":[],"entries":[],"observations":[]}')),
      catalogError(ERR_CATALOG_INPUT),
    );
  });

  test('rejects trailing tokens', () => {
    throws(() => parseCatalog(utf8('{"payloadVersion":1,"parents":[],"entries":[],"observations":[]} true')), catalogError(ERR_CATALOG_INPUT));
  });

  test('rejects invalid UTF-8', () => {
    throws(() => parseCatalog(Buffer.from([0xff, 0xfe])), catalogError(ERR_CATALOG_INPUT));
  });
});

describe('parseCatalog limits and references', () => {
  test('rejects plaintext above 16 MiB', () => {
    throws(() => parseCatalog(Buffer.alloc(LIMIT_PLAINTEXT_BYTES + 1, 0x20)), catalogError(ERR_CATALOG_LIMIT));
  });

  test('rejects metadata above 64 KiB', () => {
    const catalog = catalogNamed('baseline');
    const ids = [];
    for (let i = 0; i < 256; i += 1) {
      ids.push(String(i).padStart(256, 'x'));
    }
    snapshotOf(catalog).metadata.privateStateIds = ids;
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_LIMIT));
  });

  test('rejects a missing observation package', () => {
    const catalog = catalogNamed('baseline');
    catalog.observations[0].packageSha256 = digest(7);
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_REFERENCE));
  });

  test('rejects a missing observation locator', () => {
    const catalog = catalogNamed('baseline');
    catalog.observations[0].locator.objectId = 'missingLocatorObject';
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_REFERENCE));
  });

  test('rejects a wrong authenticated readback digest', () => {
    const catalog = catalogNamed('baseline');
    catalog.observations[0].outcome.observedSha256 = digest(8);
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_REFERENCE));
  });

  test('rejects a wrong authenticated readback length', () => {
    const catalog = catalogNamed('baseline');
    catalog.observations[0].outcome.byteLength = 2048;
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_REFERENCE));
  });

  test('rejects a digest-mismatch that repeats the package digest', () => {
    const catalog = catalogNamed('forkA');
    const mismatch = catalog.observations.find((item) => item.outcome.status === 'digest-mismatch');
    mismatch.outcome.observedSha256 = mismatch.packageSha256;
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_REFERENCE));
  });

  test('rejects a receipt whose new epoch is already retained', () => {
    const catalog = catalogNamed('rootUpdateOldEpoch');
    const receipt = catalog.entries.find((entry) => entry.entryKind === 'root-update-receipt');
    receipt.newActiveEpoch = receipt.retainedOldEpochs[0];
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_REFERENCE));
  });
});

describe('parseCatalog identities', () => {
  test('deduplicates identical selected identities', () => {
    const catalog = catalogNamed('tombstoned');
    catalog.entries.push(clone(catalog.entries.find((entry) => entry.entryKind === 'tombstone')));
    const parsed = parseCatalog(utf8(catalog));
    equal(parsed.entries.filter((entry) => entry.entryKind === 'tombstone').length, 1);
  });

  test('rejects duplicate event identities with different bodies', () => {
    const catalog = catalogNamed('tombstoned');
    const extra = clone(catalog.entries.find((entry) => entry.entryKind === 'tombstone'));
    extra.reason = 'superseded';
    catalog.entries.push(extra);
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_CONFLICT));
  });

  test('unions locators for identical snapshot claims', () => {
    const catalog = catalogNamed('baseline');
    const extra = clone(snapshotOf(catalog));
    extra.locators = [locator(2)];
    catalog.entries.push(extra);
    const parsed = parseCatalog(utf8(catalog));
    const snapshot = parsed.entries.find((entry) => entry.entryKind === 'snapshot');
    equal(snapshot.locators.length, 2);
  });

  test('rejects same-digest snapshot claims that disagree', () => {
    const catalog = catalogNamed('baseline');
    const extra = clone(snapshotOf(catalog));
    extra.label = 'other-label';
    catalog.entries.push(extra);
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_CONFLICT));
  });

  test('ignores later mutation of caller bytes', () => {
    const bytes = utf8(catalogNamed('baseline'));
    const parsed = parseCatalog(bytes);
    bytes.fill(0x20);
    equal(snapshotOf(parsed).package.sha256, BASELINE_DIGEST);
  });

  test('rejects repeated identical observations in one raw payload', () => {
    const catalog = catalogNamed('baseline');
    catalog.observations.push(clone(catalog.observations[0]));
    throws(() => parseCatalog(utf8(catalog)), catalogError(ERR_CATALOG_INPUT));
  });
});

describe('reconcileCatalogs', () => {
  test('unions fork snapshots without picking a winner', () => {
    const result = reconcileCatalogs([
      inputOf(REV_A, catalogNamed('forkA')),
      inputOf(REV_B, catalogNamed('forkB')),
    ]);
    equal(result.freshness, 'unknown');
    equal(result.conflicts.length, 0);
    ok(result.catalog);
    const digests = result.catalog.entries
      .filter((entry) => entry.entryKind === 'snapshot')
      .map((entry) => entry.package.sha256)
      .sort();
    deepEqual(digests, [
      'a'.repeat(64),
      BASELINE_DIGEST,
      'b'.repeat(64),
    ].sort());
    deepEqual(result.revisionHeads, [REV_A, REV_B].sort());
    deepEqual(result.missingParents, [FIXTURE_PARENT]);
    equal(result.sourceRevisions.length, 2);
  });

  test('is deterministic under input order and idempotent', () => {
    const first = reconcileCatalogs([
      inputOf(REV_A, catalogNamed('forkA')),
      inputOf(REV_B, catalogNamed('forkB')),
    ]);
    const reversed = reconcileCatalogs([
      inputOf(REV_B, catalogNamed('forkB')),
      inputOf(REV_A, catalogNamed('forkA')),
    ]);
    const repeated = reconcileCatalogs([
      inputOf(REV_A, catalogNamed('forkA')),
      inputOf(REV_B, catalogNamed('forkB')),
      inputOf(REV_A, catalogNamed('forkA')),
      inputOf(REV_B, catalogNamed('forkB')),
    ]);
    deepEqual(first, reversed);
    deepEqual(first, repeated);
  });

  test('unions identical rotation receipts and retains distinct observations', () => {
    const result = reconcileCatalogs([
      inputOf(REV_A, catalogNamed('rootUpdateOldEpoch')),
      inputOf(REV_B, catalogNamed('rootUpdateNewEpoch')),
    ]);
    equal(result.conflicts.length, 0);
    equal(result.catalog.entries.filter((entry) => entry.entryKind === 'root-update-receipt').length, 1);
    equal(result.catalog.observations.length, 3);
  });

  test('preserves snapshot-claim conflicts without a winner', () => {
    const left = catalogNamed('baseline');
    const right = catalogNamed('baseline');
    snapshotOf(right).label = 'fork-label';
    const result = reconcileCatalogs([inputOf(REV_A, left), inputOf(REV_B, right)]);
    equal(result.catalog, null);
    equal(result.conflicts.length, 1);
    equal(result.conflicts[0].kind, 'snapshot-claim');
    equal(result.conflicts[0].identity, BASELINE_DIGEST);
    equal(result.conflicts[0].claims.length, 2);
    equal(result.sourceRevisions.length, 2);
  });

  test('preserves event-claim conflicts', () => {
    const left = catalogNamed('tombstoned');
    const right = catalogNamed('tombstoned');
    right.entries.find((entry) => entry.entryKind === 'tombstone').reason = 'superseded';
    const result = reconcileCatalogs([inputOf(REV_A, left), inputOf(REV_B, right)]);
    equal(result.catalog, null);
    equal(result.conflicts[0].kind, 'event-claim');
  });

  test('preserves receipt-claim conflicts', () => {
    const left = catalogNamed('rootUpdateOldEpoch');
    const right = catalogNamed('rootUpdateOldEpoch');
    right.entries.find((entry) => entry.entryKind === 'root-update-receipt').recordedAt = '2026-09-19T12:40:00Z';
    const result = reconcileCatalogs([inputOf(REV_A, left), inputOf(REV_B, right)]);
    equal(result.catalog, null);
    equal(result.conflicts[0].kind, 'receipt-claim');
  });

  test('preserves observation-claim conflicts', () => {
    const left = catalogNamed('baseline');
    const right = catalogNamed('baseline');
    right.observations[0].observedAt = '2026-09-19T00:06:00Z';
    const result = reconcileCatalogs([inputOf(REV_A, left), inputOf(REV_B, right)]);
    equal(result.catalog, null);
    equal(result.conflicts[0].kind, 'observation-claim');
  });

  test('rejects the same revision digest with different payloads', () => {
    throws(
      () =>
        reconcileCatalogs([
          inputOf(REV_A, catalogNamed('baseline')),
          inputOf(REV_A, catalogNamed('forkA')),
        ]),
      catalogError(ERR_CATALOG_CONFLICT),
    );
  });

  test('rejects a known cycle', () => {
    const left = catalogNamed('baseline');
    const right = catalogNamed('baseline');
    left.parents = [REV_B];
    right.parents = [REV_A];
    throws(() => reconcileCatalogs([inputOf(REV_A, left), inputOf(REV_B, right)]), catalogError(ERR_CATALOG_INPUT));
  });

  test('rejects a self-parent', () => {
    const catalog = catalogNamed('baseline');
    catalog.parents = [REV_A];
    throws(() => reconcileCatalogs([inputOf(REV_A, catalog)]), catalogError(ERR_CATALOG_INPUT));
  });

  test('rejects more than 16 inputs before parse', () => {
    const inputs = [];
    for (let i = 0; i < 17; i += 1) {
      inputs.push(inputOf(digest(100 + i), catalogNamed('baseline')));
    }
    throws(() => reconcileCatalogs(inputs), catalogError(ERR_CATALOG_LIMIT));
  });

  test('rejects an empty input list', () => {
    throws(() => reconcileCatalogs([]), catalogError(ERR_CATALOG_LIMIT));
  });

  test('ignores later mutation of caller inputs', () => {
    const payloadUtf8 = utf8(catalogNamed('baseline'));
    const inputs = [inputOf(REV_A, catalogNamed('baseline'))];
    inputs[0].payloadUtf8 = payloadUtf8;
    const result = reconcileCatalogs(inputs);
    payloadUtf8.fill(0x20);
    inputs.pop();
    equal(result.catalog.entries[0].package.sha256, BASELINE_DIGEST);
  });
});

describe('tombstone causality', () => {
  test('a single tombstoned revision with its snapshot is not a conflict', () => {
    const result = reconcileCatalogs([inputOf(REV_A, catalogNamed('tombstoned'))]);
    equal(result.conflicts.length, 0);
    ok(result.catalog);
    const kinds = result.catalog.entries.map((entry) => entry.entryKind).sort();
    deepEqual(kinds, ['snapshot', 'tombstone']);
    deepEqual(result.missingParents, [FIXTURE_PARENT]);
  });

  test('a live ancestor plus a tombstoned descendant is not a conflict', () => {
    const result = reconcileCatalogs([
      inputOf(FIXTURE_PARENT, catalogNamed('baseline')),
      inputOf(REV_A, catalogNamed('tombstoned')),
    ]);
    equal(result.conflicts.length, 0);
    ok(result.catalog);
    equal(result.catalog.entries.filter((entry) => entry.entryKind === 'tombstone').length, 1);
    deepEqual(result.revisionHeads, [REV_A]);
    deepEqual(result.missingParents, []);
  });

  test('incomparable live and tombstone heads conflict when ancestry is complete', () => {
    const result = reconcileCatalogs([
      inputOf(REV_A, liveCatalog(BASELINE_DIGEST, [])),
      inputOf(REV_B, tombstoneCatalog(BASELINE_DIGEST, [])),
    ]);
    equal(result.catalog, null);
    equal(result.conflicts.length, 1);
    equal(result.conflicts[0].kind, 'tombstone-live');
    equal(result.conflicts[0].identity, BASELINE_DIGEST);
    equal(result.conflicts[0].claims.length, 2);
    equal(result.sourceRevisions.length, 2);
  });

  test('missing parents do not prove concurrent live and tombstone heads', () => {
    const result = reconcileCatalogs([
      inputOf(REV_A, liveCatalog(BASELINE_DIGEST, [MISSING_PARENT])),
      inputOf(REV_B, tombstoneCatalog(BASELINE_DIGEST, [MISSING_PARENT])),
    ]);
    equal(result.conflicts.length, 0);
    ok(result.catalog);
    deepEqual(result.missingParents, [MISSING_PARENT]);
    deepEqual(result.revisionHeads, [REV_A, REV_B].sort());
    equal(result.catalog.entries.filter((entry) => entry.entryKind === 'tombstone').length, 1);
  });
});

describe('reconcileCatalogs bounds', () => {
  test('rejects a locator union above 16', () => {
    const left = catalogWith([makeSnapshot(1, { locators: Array.from({ length: 16 }, (_, i) => locator(i + 1)) })]);
    const right = catalogWith([makeSnapshot(1, { locators: [locator(17)] })]);
    throws(
      () => reconcileCatalogs([inputOf(REV_A, left), inputOf(REV_B, right)]),
      catalogError(ERR_CATALOG_LIMIT),
    );
  });

  test('rejects an entry union above 1000 including conflict material', () => {
    const leftEntries = [];
    const rightEntries = [];
    for (let i = 1; i <= 501; i += 1) {
      leftEntries.push(makeSnapshot(i));
      const other = makeSnapshot(i);
      other.label = 'other';
      rightEntries.push(other);
    }
    throws(
      () =>
        reconcileCatalogs([
          inputOf(REV_A, catalogWith(leftEntries)),
          inputOf(REV_B, catalogWith(rightEntries)),
        ]),
      catalogError(ERR_CATALOG_LIMIT),
    );
  });
});

describe('verifySnapshotClaim', () => {
  const entry = snapshotOf(catalogNamed('baseline'));
  const entryUtf8 = utf8(entry);

  test('accepts an exact authenticated match', () => {
    equal(verifySnapshotClaim(entryUtf8, VAULT_ID, matchingOpened(entry)), undefined);
  });

  test('rejects an invalid expected vault encoding', () => {
    throws(() => verifySnapshotClaim(entryUtf8, 'not-a-vault-id', matchingOpened(entry)), catalogError(ERR_CATALOG_BINDING));
  });

  const bindings = [
    ['package digest', (auth) => {
      auth.opened.packageSha256 = digest(9);
    }],
    ['wire byte length', (auth) => {
      auth.wireByteLength = 2048;
    }],
    ['vault id', (auth) => {
      auth.opened.header.vaultId = 'QEFCQ0RFRkdISUpLTE1OTA';
    }],
    ['root epoch', (auth) => {
      auth.opened.header.rootEpoch = 'AAAAAAAAAAAAAAAAAAAAAA';
    }],
    ['scope id', (auth) => {
      auth.opened.header.scopeId = id32(21);
    }],
    ['record id', (auth) => {
      auth.opened.header.recordId = id32(22);
    }],
    ['generation id', (auth) => {
      auth.opened.header.generationId = id32(23);
    }],
    ['kind', (auth) => {
      auth.opened.header.kind = 'catalog';
    }],
    ['metadata', (auth) => {
      auth.opened.metadata.applicationId = 'other-app';
    }],
  ];

  for (const [name, mutate] of bindings) {
    test(`rejects a ${name} mismatch`, () => {
      const authenticated = matchingOpened(entry);
      mutate(authenticated);
      throws(() => verifySnapshotClaim(entryUtf8, VAULT_ID, authenticated), catalogError(ERR_CATALOG_BINDING));
    });
  }

  test('copies caller authentication before comparison', () => {
    const authenticated = matchingOpened(entry);
    verifySnapshotClaim(entryUtf8, VAULT_ID, authenticated);
    authenticated.opened.packageSha256 = digest(9);
    authenticated.wireByteLength = 1;
    equal(verifySnapshotClaim(entryUtf8, VAULT_ID, matchingOpened(entry)), undefined);
  });
});

describe('reconcileCatalogs revision equality', () => {
  test('deduplicates compact and pretty encodings of the same revision', () => {
    const catalog = catalogNamed('baseline');
    const compact = Buffer.from(JSON.stringify(catalog));
    const pretty = Buffer.from(JSON.stringify(catalog, null, 2));
    notEqual(compact.equals(pretty), true);
    const result = reconcileCatalogs([
      { revisionSha256: REV_A, payloadUtf8: compact },
      { revisionSha256: REV_A, payloadUtf8: pretty },
    ]);
    equal(result.conflicts.length, 0);
    equal(result.sourceRevisions.length, 1);
    ok(result.catalog);
    equal(result.catalog.entries.length, parseCatalog(compact).entries.length);
  });

  test('rejects the same revision digest with truly different content', () => {
    throws(
      () =>
        reconcileCatalogs([
          inputOf(REV_A, catalogNamed('baseline')),
          inputOf(REV_A, catalogNamed('forkA')),
        ]),
      catalogError(ERR_CATALOG_CONFLICT),
    );
  });

  test('does not treat different entry order as the same revision payload', () => {
    const left = catalogWith([makeSnapshot(1), makeSnapshot(2)]);
    const right = catalogWith([makeSnapshot(2), makeSnapshot(1)]);
    throws(
      () =>
        reconcileCatalogs([
          { revisionSha256: REV_A, payloadUtf8: utf8(left) },
          { revisionSha256: REV_A, payloadUtf8: utf8(right) },
        ]),
      catalogError(ERR_CATALOG_CONFLICT),
    );
  });
});

describe('reconcileCatalogs observation identity', () => {
  test('deduplicates identical observations across distinct valid revisions', () => {
    const left = catalogNamed('baseline');
    const right = catalogNamed('baseline');
    const result = reconcileCatalogs([inputOf(REV_A, left), inputOf(REV_B, right)]);
    equal(result.conflicts.length, 0);
    ok(result.catalog);
    equal(result.catalog.observations.length, left.observations.length);
    equal(result.sourceRevisions.length, 2);
  });
});

describe('reconcileCatalogs aggregate byte budget', () => {
  test(
    'rejects two 200-entry fat catalogs whose conflict claims exceed 16 MiB',
    { timeout: 120000 },
    () => {
      const leftEntries = [];
      const rightEntries = [];
      for (let i = 1; i <= 200; i += 1) {
        leftEntries.push(fatSnapshot(i, { label: 'left' }));
        rightEntries.push(fatSnapshot(i, { label: 'right' }));
      }
      const left = catalogWith(leftEntries);
      const right = catalogWith(rightEntries);
      const sampleBytes = metadataCanonicalBytes(leftEntries[0]);
      ok(sampleBytes >= 40 * 1024);
      ok(sampleBytes < LIMIT_METADATA_CANONICAL_BYTES);
      ok(parseCatalog(utf8(left)));
      ok(parseCatalog(utf8(right)));
      throws(
        () => reconcileCatalogs([inputOf(REV_A, left), inputOf(REV_B, right)]),
        catalogError(ERR_CATALOG_LIMIT),
      );
    },
  );

  test(
    'accepts a near-bound no-conflict union',
    { timeout: 120000 },
    () => {
      const leftEntries = [];
      const rightEntries = [];
      for (let i = 1; i <= 40; i += 1) {
        leftEntries.push(fatSnapshot(i));
        rightEntries.push(fatSnapshot(40 + i));
      }
      const result = reconcileCatalogs([
        inputOf(REV_A, catalogWith(leftEntries)),
        inputOf(REV_B, catalogWith(rightEntries)),
      ]);
      equal(result.conflicts.length, 0);
      ok(result.catalog);
      equal(result.catalog.entries.length, 80);
    },
  );

  test(
    'accepts a near-bound conflict result',
    { timeout: 120000 },
    () => {
      const leftEntries = [];
      const rightEntries = [];
      for (let i = 1; i <= 20; i += 1) {
        leftEntries.push(fatSnapshot(i, { label: 'left' }));
        rightEntries.push(fatSnapshot(i, { label: 'right' }));
      }
      const result = reconcileCatalogs([
        inputOf(REV_A, catalogWith(leftEntries)),
        inputOf(REV_B, catalogWith(rightEntries)),
      ]);
      equal(result.catalog, null);
      equal(result.conflicts.length, 20);
      equal(result.conflicts[0].kind, 'snapshot-claim');
      equal(result.sourceRevisions.length, 2);
    },
  );

  test(
    'counts each retained source revision copy toward the budget',
    { timeout: 120000 },
    () => {
      const entries = [];
      for (let i = 1; i <= 160; i += 1) {
        entries.push(fatSnapshot(i));
      }
      const catalog = catalogWith(entries);
      ok(parseCatalog(utf8(catalog)));
      throws(
        () =>
          reconcileCatalogs([
            inputOf(REV_A, catalog),
            inputOf(REV_B, catalog),
          ]),
        catalogError(ERR_CATALOG_LIMIT),
      );
    },
  );

  test('rejects a later oversized copy after owning an earlier payload', () => {
    const huge = Buffer.alloc(LIMIT_PLAINTEXT_BYTES + 1, 0x20);
    throws(
      () =>
        reconcileCatalogs([
          inputOf(REV_A, catalogNamed('baseline')),
          { revisionSha256: REV_B, payloadUtf8: huge },
        ]),
      catalogError(ERR_CATALOG_LIMIT),
    );
  });
});

function secretFreeCatalogError(code) {
  return (err) =>
    catalogError(code)(err) &&
    !`${err.code}\n${err.message}\n${err.stack ?? ''}`.includes('secret');
}

function inspectedCatalogText(err) {
  return `${err.code}\n${err.message}\n${err.name}\n${err.stack ?? ''}`;
}

function sentinelFreeCatalogError(code, sentinel = 'SYNTHETIC') {
  return (err) => catalogError(code)(err) && !inspectedCatalogText(err).includes(sentinel);
}

function lengthThrowingInputs(thrown) {
  return new Proxy([], {
    get(target, key, receiver) {
      if (key === 'length') {
        throw thrown;
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

function maliciousCatalogError(code) {
  const err = new CatalogError(code);
  Object.defineProperty(err, 'message', {
    configurable: true,
    enumerable: false,
    get() {
      throw new Error('secret-package-bytes');
    },
  });
  Object.defineProperty(err, 'code', {
    configurable: true,
    enumerable: false,
    get() {
      throw new Error('secret-package-bytes');
    },
  });
  return err;
}

describe('reconcileCatalogs 100-entry conflict budget', () => {
  test(
    'rejects 100 parsed fat conflicts before union or conflict clones',
    { timeout: 120000 },
    () => {
      const leftEntries = [];
      const rightEntries = [];
      for (let i = 1; i <= 100; i += 1) {
        leftEntries.push(fatSnapshot(i, { label: `left "é\\"${i}` }));
        rightEntries.push(fatSnapshot(i, { label: `right "é\\"${i}` }));
      }
      const left = catalogWith(leftEntries);
      const right = catalogWith(rightEntries);
      const sampleBytes = metadataCanonicalBytes(leftEntries[0]);
      ok(sampleBytes >= 40 * 1024);
      ok(sampleBytes < LIMIT_METADATA_CANONICAL_BYTES);
      ok(parseCatalog(utf8(left)));
      ok(parseCatalog(utf8(right)));
      // Both inputs parse. Source copies stay near 10 MiB. Conflict claims
      // would make a ~20 MiB result. Accounting must reject that result
      // before clone or materialization. Source call order is the evidence.
      throws(
        () => reconcileCatalogs([inputOf(REV_A, left), inputOf(REV_B, right)]),
        catalogError(ERR_CATALOG_LIMIT),
      );
    },
  );

  test(
    'accepts a near-bound no-conflict union of fat snapshots',
    { timeout: 120000 },
    () => {
      const leftEntries = [];
      const rightEntries = [];
      for (let i = 1; i <= 40; i += 1) {
        leftEntries.push(fatSnapshot(i, { label: `union "é\\"${i}` }));
        rightEntries.push(fatSnapshot(40 + i, { label: `union "é\\"${40 + i}` }));
      }
      const result = reconcileCatalogs([
        inputOf(REV_A, catalogWith(leftEntries)),
        inputOf(REV_B, catalogWith(rightEntries)),
      ]);
      equal(result.conflicts.length, 0);
      ok(result.catalog);
      equal(result.catalog.entries.length, 80);
    },
  );

  test(
    'accepts a near-bound conflict result of fat snapshots',
    { timeout: 120000 },
    () => {
      const leftEntries = [];
      const rightEntries = [];
      for (let i = 1; i <= 20; i += 1) {
        leftEntries.push(fatSnapshot(i, { label: `left "é\\"${i}` }));
        rightEntries.push(fatSnapshot(i, { label: `right "é\\"${i}` }));
      }
      const result = reconcileCatalogs([
        inputOf(REV_A, catalogWith(leftEntries)),
        inputOf(REV_B, catalogWith(rightEntries)),
      ]);
      equal(result.catalog, null);
      equal(result.conflicts.length, 20);
      equal(result.conflicts[0].kind, 'snapshot-claim');
      equal(result.sourceRevisions.length, 2);
      equal(result.conflicts[0].claims[0].label.includes('é'), true);
    },
  );
});

describe('verifySnapshotClaim public boundary', () => {
  const entry = snapshotOf(catalogNamed('baseline'));
  const entryUtf8 = utf8(entry);

  test('rejects a non-string expected vault id as CATALOG_BINDING', () => {
    throws(
      () => verifySnapshotClaim(entryUtf8, 1, matchingOpened(entry)),
      catalogError(ERR_CATALOG_BINDING),
    );
  });

  test('rejects throwing getters without leaking input diagnostics', () => {
    const authenticated = matchingOpened(entry);
    Object.defineProperty(authenticated.opened, 'packageSha256', {
      get() {
        throw new Error('secret-package-bytes');
      },
    });
    throws(
      () => verifySnapshotClaim(entryUtf8, VAULT_ID, authenticated),
      secretFreeCatalogError(ERR_CATALOG_INPUT),
    );
  });

  test('maps a CatalogError getter on authenticated OpenResult to CATALOG_INPUT', () => {
    const authenticated = matchingOpened(entry);
    Object.defineProperty(authenticated, 'opened', {
      configurable: true,
      get() {
        throw new CatalogError('secret-package-bytes');
      },
    });
    throws(
      () => verifySnapshotClaim(entryUtf8, VAULT_ID, authenticated),
      secretFreeCatalogError(ERR_CATALOG_INPUT),
    );
  });

  test('does not reuse a malicious CatalogError from OpenResult getters', () => {
    const authenticated = matchingOpened(entry);
    const poisoned = maliciousCatalogError(ERR_CATALOG_LIMIT);
    Object.defineProperty(authenticated.opened, 'packageSha256', {
      configurable: true,
      get() {
        throw poisoned;
      },
    });
    throws(
      () => verifySnapshotClaim(entryUtf8, VAULT_ID, authenticated),
      (err) => secretFreeCatalogError(ERR_CATALOG_INPUT)(err) && err !== poisoned,
    );
  });
});

describe('public input error redaction', () => {
  test('maps a CatalogError payloadUtf8 getter to a fresh CATALOG_INPUT', () => {
    const poisoned = new CatalogError('secret-package-bytes');
    throws(
      () =>
        reconcileCatalogs([
          {
            revisionSha256: REV_A,
            get payloadUtf8() {
              throw poisoned;
            },
          },
        ]),
      (err) => secretFreeCatalogError(ERR_CATALOG_INPUT)(err) && err !== poisoned,
    );
  });

  test('maps a CatalogError revisionSha256 getter to a fresh CATALOG_INPUT', () => {
    throws(
      () =>
        reconcileCatalogs([
          {
            get revisionSha256() {
              throw new CatalogError('secret-package-bytes');
            },
            payloadUtf8: utf8(catalogNamed('baseline')),
          },
        ]),
      secretFreeCatalogError(ERR_CATALOG_INPUT),
    );
  });

  test('does not read malicious CatalogError message or code accessors', () => {
    const poisoned = maliciousCatalogError(ERR_CATALOG_CONFLICT);
    throws(
      () =>
        reconcileCatalogs([
          {
            revisionSha256: REV_A,
            get payloadUtf8() {
              throw poisoned;
            },
          },
        ]),
      (err) => secretFreeCatalogError(ERR_CATALOG_INPUT)(err) && err !== poisoned,
    );
  });

  test('maps a caller CatalogError with an allowed code to CATALOG_INPUT', () => {
    throws(
      () =>
        reconcileCatalogs([
          {
            revisionSha256: REV_A,
            get payloadUtf8() {
              throw new CatalogError(ERR_CATALOG_LIMIT);
            },
          },
        ]),
      catalogError(ERR_CATALOG_INPUT),
    );
  });

  test('maps a plain Error from a payload getter to CATALOG_INPUT', () => {
    throws(
      () =>
        reconcileCatalogs([
          {
            revisionSha256: REV_A,
            get payloadUtf8() {
              throw new Error('secret-package-bytes');
            },
          },
        ]),
      secretFreeCatalogError(ERR_CATALOG_INPUT),
    );
  });

  test('accepts a frozen revision input', () => {
    const payloadUtf8 = utf8(catalogNamed('baseline'));
    const input = Object.freeze({
      revisionSha256: REV_A,
      payloadUtf8,
    });
    const result = reconcileCatalogs(Object.freeze([input]));
    ok(result.catalog);
    equal(result.catalog.entries[0].package.sha256, BASELINE_DIGEST);
  });

  test('preserves a real oversized copy as CATALOG_LIMIT', () => {
    const huge = Buffer.alloc(LIMIT_PLAINTEXT_BYTES + 1, 0x20);
    throws(
      () =>
        reconcileCatalogs([
          inputOf(REV_A, catalogNamed('baseline')),
          { revisionSha256: REV_B, payloadUtf8: huge },
        ]),
      catalogError(ERR_CATALOG_LIMIT),
    );
  });

  test('preserves a real revision digest conflict', () => {
    throws(
      () =>
        reconcileCatalogs([
          inputOf(REV_A, catalogNamed('baseline')),
          inputOf(REV_A, catalogNamed('forkA')),
        ]),
      catalogError(ERR_CATALOG_CONFLICT),
    );
  });

  test('maps a hostile array length throwing Proxy to CATALOG_INPUT without leaking the sentinel', () => {
    const inputs = lengthThrowingInputs(
      new Proxy(
        {},
        {
          getPrototypeOf() {
            throw new Error('SYNTHETIC_LENGTH_SENTINEL');
          },
        },
      ),
    );
    throws(() => reconcileCatalogs(inputs), sentinelFreeCatalogError(ERR_CATALOG_INPUT));
  });

  test('maps a revoked input Proxy to CATALOG_INPUT without leaking trap diagnostics', () => {
    const { proxy, revoke } = Proxy.revocable([], {});
    revoke();
    throws(() => reconcileCatalogs(proxy), sentinelFreeCatalogError(ERR_CATALOG_INPUT, 'revoked'));
  });

  test('maps a revoked thrown Proxy to CATALOG_INPUT without leaking trap diagnostics', () => {
    const { proxy, revoke } = Proxy.revocable(new Error('SYNTHETIC_REVOKED_SENTINEL'), {});
    revoke();
    throws(
      () => reconcileCatalogs(lengthThrowingInputs(proxy)),
      sentinelFreeCatalogError(ERR_CATALOG_INPUT),
    );
  });

  test('maps a getPrototypeOf-throwing payload exception to CATALOG_INPUT without leaking the sentinel', () => {
    const payloadUtf8 = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Proxy(
            {},
            {
              getPrototypeOf() {
                throw new Error('SYNTHETIC_PROTO_SENTINEL');
              },
            },
          );
        },
      },
    );
    throws(() => parseCatalog(payloadUtf8), sentinelFreeCatalogError(ERR_CATALOG_INPUT));
  });

  test('does not execute throwing code or getOwnPropertyDescriptor traps on a thrown exception', () => {
    const hostile = new Proxy(new CatalogError(ERR_CATALOG_CONFLICT), {
      getOwnPropertyDescriptor() {
        throw new Error('SYNTHETIC_CODE_SENTINEL');
      },
      get(target, key, receiver) {
        if (key === 'code' || key === 'message' || key === 'stack') {
          throw new Error('SYNTHETIC_CODE_SENTINEL');
        }
        return Reflect.get(target, key, receiver);
      },
    });
    throws(
      () => reconcileCatalogs(lengthThrowingInputs(hostile)),
      sentinelFreeCatalogError(ERR_CATALOG_INPUT),
    );
  });

  test('maps a nonnumeric proxy array length to CATALOG_INPUT', () => {
    const inputs = new Proxy([], {
      get(target, key, receiver) {
        if (key === 'length') {
          return 'SYNTHETIC_LENGTH_VALUE';
        }
        return Reflect.get(target, key, receiver);
      },
    });
    throws(() => reconcileCatalogs(inputs), sentinelFreeCatalogError(ERR_CATALOG_INPUT));
  });
});

describe('error surface', () => {
  test('public errors expose only static codes', () => {
    const err = new CatalogError(ERR_CATALOG_INPUT);
    equal(err.message, ERR_CATALOG_INPUT);
    equal(err.code, ERR_CATALOG_INPUT);
    notEqual(err.message.includes('snapshot'), true);
  });
});
