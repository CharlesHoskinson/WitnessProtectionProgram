import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  InMemoryObjectStore,
  bucketForRecordId,
  createExperimentalSession,
  createSyntheticRecords,
  packShards,
  packedFullRestore,
  shardedCommit,
  shardedRestore,
} from "../experiments/storage-layout/catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const VECTORS_PATH = join(ROOT, "fixtures", "wpp-v1-vectors.json");

function loadVectors() {
  return JSON.parse(readFileSync(VECTORS_PATH, "utf8"));
}

function noteOf(records, id) {
  const record = records.find((entry) => entry.id === id);
  return record === undefined ? undefined : record.payload.note;
}

async function twoVersionCatalog() {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const recordsA = createSyntheticRecords({ count: 40, seed: "pack-bind" });
  const revisionA = await shardedCommit({
    session,
    store,
    records: recordsA,
    parent: null,
  });
  const recordsB = structuredClone(recordsA);
  recordsB[0].payload.note = "new-version";
  const revisionB = await shardedCommit({
    session,
    store,
    records: recordsB,
    parent: revisionA,
  });
  const changedBucket = bucketForRecordId(recordsA[0].id);
  const hashA = revisionA.bucketCiphertextHashes.get(changedBucket);
  const hashB = revisionB.bucketCiphertextHashes.get(changedBucket);
  assert.notEqual(hashA, hashB);
  const envelopeA = store.get(hashA);
  const envelopeB = store.get(hashB);
  assert.notEqual(
    Buffer.compare(Buffer.from(envelopeA), Buffer.from(envelopeB)),
    0,
  );
  return {
    session,
    store,
    recordsA,
    recordsB,
    revisionA,
    revisionB,
    changedBucket,
    hashA,
    hashB,
    envelopeA,
    envelopeB,
  };
}

test("ordinary restore rejects store substitution of A envelope under B hashes", async () => {
  const fixture = await twoVersionCatalog();
  const substituted = fixture.store.clone();
  substituted.replace(fixture.hashB, fixture.envelopeA);

  await assert.rejects(
    () =>
      shardedRestore({
        session: fixture.session,
        store: substituted.freshReader(),
        rootHash: fixture.revisionB.rootHash,
      }),
    /hash|mismatch|corrupt|integrity|authenticate/i,
  );
});

test("packShards rejects store substitution of A envelope under B hashes", async () => {
  const fixture = await twoVersionCatalog();
  const substituted = fixture.store.clone();
  substituted.replace(fixture.hashB, fixture.envelopeA);
  const manifestWritesBefore = substituted.stats.manifestWrites;

  await assert.rejects(
    () =>
      packShards({
        session: fixture.session,
        store: substituted,
        revision: fixture.revisionB,
      }),
    /hash|mismatch/i,
  );

  assert.equal(substituted.stats.manifestWrites, manifestWritesBefore);
});

test("packShards rejects revision.envelopes substitution of A under B hashes", async () => {
  const fixture = await twoVersionCatalog();
  const packStore = fixture.store.clone();
  const hostileRevision = {
    ...fixture.revisionB,
    envelopes: new Map([[fixture.changedBucket, Buffer.from(fixture.envelopeA)]]),
  };
  const manifestWritesBefore = packStore.stats.manifestWrites;

  await assert.rejects(
    () =>
      packShards({
        session: fixture.session,
        store: packStore,
        revision: hostileRevision,
      }),
    /hash|mismatch/i,
  );

  assert.equal(packStore.stats.manifestWrites, manifestWritesBefore);
});

test("honest pack of B restores B and does not return stale A", async () => {
  const fixture = await twoVersionCatalog();
  const packed = await packShards({
    session: fixture.session,
    store: fixture.store,
    revision: fixture.revisionB,
  });
  const restored = await packedFullRestore({
    session: fixture.session,
    store: fixture.store.freshReader(),
    extentManifestHash: packed.extentManifestHash,
  });

  assert.equal(noteOf(fixture.recordsA, fixture.recordsA[0].id), undefined);
  assert.equal(noteOf(restored.records, fixture.recordsB[0].id), "new-version");
});
