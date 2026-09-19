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
  packedRangeRestore,
  shardedCommit,
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

async function commitAndPack({ session, store, records, parent }) {
  const revision = await shardedCommit({ session, store, records, parent });
  const packed = await packShards({ session, store, revision });
  return { revision, packed };
}

async function twoVersionPackedCatalog() {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const recordsA = createSyntheticRecords({ count: 40, seed: "cache-probe" });
  const shardId = bucketForRecordId(recordsA[0].id);
  const first = await commitAndPack({
    session,
    store,
    records: recordsA,
    parent: null,
  });
  const recordsB = structuredClone(recordsA);
  recordsB[0].payload.note = "new-version";
  const second = await commitAndPack({
    session,
    store,
    records: recordsB,
    parent: first.revision,
  });
  const manifestWireA = store.get(first.packed.extentManifestHash);
  const manifestWireB = store.get(second.packed.extentManifestHash);
  return {
    session,
    store,
    recordsA,
    recordsB,
    shardId,
    packA: first.packed,
    packB: second.packed,
    manifestWireA,
    manifestWireB,
  };
}

function typedArrayIntrinsics() {
  const proto = Object.getPrototypeOf(Uint8Array.prototype);
  return {
    byteLength: Object.getOwnPropertyDescriptor(proto, "byteLength").get,
    byteOffset: Object.getOwnPropertyDescriptor(proto, "byteOffset").get,
    buffer: Object.getOwnPropertyDescriptor(proto, "buffer").get,
  };
}

function viewsShareBackingBytes(left, right) {
  const get = typedArrayIntrinsics();
  const leftBuffer = get.buffer.call(left);
  const rightBuffer = get.buffer.call(right);
  if (leftBuffer !== rightBuffer) {
    return false;
  }
  const leftOffset = get.byteOffset.call(left);
  const leftLength = get.byteLength.call(left);
  const rightOffset = get.byteOffset.call(right);
  const rightLength = get.byteLength.call(right);
  return leftOffset < rightOffset + rightLength && rightOffset < leftOffset + leftLength;
}

async function twoVersionPackedCatalogEqualManifestSize() {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const recordsA = createSyntheticRecords({ count: 40, seed: "cache-owned" });
  recordsA[0].payload.note = "version-A";
  const shardId = bucketForRecordId(recordsA[0].id);
  const first = await commitAndPack({
    session,
    store,
    records: recordsA,
    parent: null,
  });
  const recordsB = structuredClone(recordsA);
  recordsB[0].payload.note = "version-B";
  const second = await commitAndPack({
    session,
    store,
    records: recordsB,
    parent: first.revision,
  });
  const manifestWireA = store.get(first.packed.extentManifestHash);
  const manifestWireB = store.get(second.packed.extentManifestHash);
  assert.equal(manifestWireA.byteLength, manifestWireB.byteLength);
  assert.notEqual(first.packed.extentManifestHash, second.packed.extentManifestHash);
  return {
    session,
    store,
    recordsA,
    recordsB,
    shardId,
    packA: first.packed,
    packB: second.packed,
    manifestWireA,
    manifestWireB,
  };
}

test("plaintext cached extents cannot replay pack A under checkpoint B", async () => {
  const fixture = await twoVersionPackedCatalog();
  assert.notEqual(fixture.packA.extentManifestHash, fixture.packB.extentManifestHash);
  assert.equal(noteOf(fixture.recordsA, fixture.recordsA[0].id), undefined);
  assert.equal(noteOf(fixture.recordsB, fixture.recordsB[0].id), "new-version");

  let restored;
  try {
    restored = await packedRangeRestore({
      session: fixture.session,
      store: fixture.store.freshReader(),
      extentManifestHash: fixture.packB.extentManifestHash,
      shardId: fixture.shardId,
      extents: fixture.packA.extents,
    });
  } catch (err) {
    assert.match(String(err && err.message), /hash|mismatch|authenticate|extent/i);
    return;
  }

  assert.equal(noteOf(restored.records, fixture.recordsA[0].id), "new-version");
});

test("stale cachedManifestWire A is rejected under checkpoint B", async () => {
  const fixture = await twoVersionPackedCatalog();
  assert.equal(
    fixture.manifestWireA.byteLength,
    fixture.store.get(fixture.packA.extentManifestHash).byteLength,
  );

  await assert.rejects(
    () =>
      packedRangeRestore({
        session: fixture.session,
        store: fixture.store.freshReader(),
        extentManifestHash: fixture.packB.extentManifestHash,
        shardId: fixture.shardId,
        cachedManifestWire: fixture.manifestWireA,
      }),
    /hash|mismatch|authenticate/i,
  );
});

test("matching cachedManifestWire restores B and skips manifest storage reads", async () => {
  const fixture = await twoVersionPackedCatalog();
  const warmReader = fixture.store.freshReader();
  const restored = await packedRangeRestore({
    session: fixture.session,
    store: warmReader,
    extentManifestHash: fixture.packB.extentManifestHash,
    shardId: fixture.shardId,
    cachedManifestWire: fixture.manifestWireB,
  });

  assert.equal(noteOf(restored.records, fixture.recordsB[0].id), "new-version");
  assert.equal(warmReader.stats.rangeReads, 1);
  assert.equal(warmReader.stats.manifestReads, 0);
  assert.equal(warmReader.stats.manifestReadBytes, 0);
  assert.equal(warmReader.stats.reads, 1);

  const coldReader = fixture.store.freshReader();
  const cold = await packedRangeRestore({
    session: fixture.session,
    store: coldReader,
    extentManifestHash: fixture.packB.extentManifestHash,
    shardId: fixture.shardId,
  });
  assert.equal(noteOf(cold.records, fixture.recordsB[0].id), "new-version");
  assert.equal(coldReader.stats.manifestReads, 1);
  assert.equal(coldReader.stats.rangeReads, 1);
  assert.ok(coldReader.stats.reads >= 2);
});

test("tampered cachedManifestWire is rejected before range restore", async () => {
  const fixture = await twoVersionPackedCatalog();
  const tampered = Buffer.from(fixture.manifestWireB);
  tampered[0] ^= 0xff;

  await assert.rejects(
    () =>
      packedRangeRestore({
        session: fixture.session,
        store: fixture.store.freshReader(),
        extentManifestHash: fixture.packB.extentManifestHash,
        shardId: fixture.shardId,
        cachedManifestWire: tampered,
      }),
    /hash|mismatch|authenticate|integrity/i,
  );
});

test("cachedManifestWire from another session or root is rejected", async () => {
  const fixture = await twoVersionPackedCatalog();
  const other = await createExperimentalSession({
    vectors: loadVectors(),
    rootVariant: 1,
  });

  await assert.rejects(
    () =>
      packedRangeRestore({
        session: other,
        store: fixture.store.freshReader(),
        extentManifestHash: fixture.packB.extentManifestHash,
        shardId: fixture.shardId,
        cachedManifestWire: fixture.manifestWireB,
      }),
    /binding|authenticate|open|mismatch|hash/i,
  );
});

const PACKAGE_CEILING_BYTES = 24 * 1024 * 1024;

test("oversized Uint8Array subclass with misleading byteLength is rejected before copy", async () => {
  const fixture = await twoVersionPackedCatalog();
  class MisleadingLength extends Uint8Array {
    get byteLength() {
      return 16;
    }
  }
  const oversized = new MisleadingLength(PACKAGE_CEILING_BYTES + 1);
  assert.equal(oversized.byteLength, 16);
  assert.equal(
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(Uint8Array.prototype),
      "byteLength",
    ).get.call(oversized),
    PACKAGE_CEILING_BYTES + 1,
  );

  await assert.rejects(
    () =>
      packedRangeRestore({
        session: fixture.session,
        store: fixture.store.freshReader(),
        extentManifestHash: fixture.packB.extentManifestHash,
        shardId: fixture.shardId,
        cachedManifestWire: oversized,
      }),
    /package byte ceiling|exceeds|too large/i,
  );
});

test("wrong-type cachedManifestWire is rejected before hashing", async () => {
  const fixture = await twoVersionPackedCatalog();

  await assert.rejects(
    () =>
      packedRangeRestore({
        session: fixture.session,
        store: fixture.store.freshReader(),
        extentManifestHash: fixture.packB.extentManifestHash,
        shardId: fixture.shardId,
        cachedManifestWire: { byteLength: 4 },
      }),
    /type|bytes|typed|buffer/i,
  );

  await assert.rejects(
    () =>
      packedRangeRestore({
        session: fixture.session,
        store: fixture.store.freshReader(),
        extentManifestHash: fixture.packB.extentManifestHash,
        shardId: fixture.shardId,
        cachedManifestWire: "not-bytes",
      }),
    /type|bytes|typed|buffer/i,
  );

  await assert.rejects(
    () =>
      packedRangeRestore({
        session: fixture.session,
        store: fixture.store.freshReader(),
        extentManifestHash: fixture.packB.extentManifestHash,
        shardId: fixture.shardId,
        cachedManifestWire: new Uint16Array(8),
      }),
    /type|bytes|typed|buffer/i,
  );

  const dataView = new DataView(new ArrayBuffer(16));
  await assert.rejects(
    () =>
      packedRangeRestore({
        session: fixture.session,
        store: fixture.store.freshReader(),
        extentManifestHash: fixture.packB.extentManifestHash,
        shardId: fixture.shardId,
        cachedManifestWire: dataView,
      }),
    /type|bytes|typed|buffer/i,
  );
});

test("owned cached A wire still authenticates A after cache bytes become B at open", async () => {
  const fixture = await twoVersionPackedCatalogEqualManifestSize();
  const cachedA = fixture.manifestWireA;
  const replacementB = Buffer.from(fixture.manifestWireB);
  const callerWitness = Buffer.from(cachedA);
  const originalOpen = fixture.session.vault.openSnapshot.bind(fixture.session.vault);
  let manifestOpens = 0;

  fixture.session.vault.openSnapshot = (wire, expected) => {
    if (manifestOpens === 0) {
      assert.equal(viewsShareBackingBytes(wire, cachedA), false);
      replacementB.copy(cachedA);
      manifestOpens += 1;
    }
    return originalOpen(wire, expected);
  };

  const restored = await packedRangeRestore({
    session: fixture.session,
    store: fixture.store.freshReader(),
    extentManifestHash: fixture.packA.extentManifestHash,
    shardId: fixture.shardId,
    cachedManifestWire: cachedA,
  });

  assert.equal(manifestOpens, 1);
  assert.equal(noteOf(restored.records, fixture.recordsA[0].id), "version-A");
  assert.notEqual(noteOf(restored.records, fixture.recordsA[0].id), "version-B");
  assert.equal(Buffer.compare(cachedA, replacementB), 0);
  assert.notEqual(Buffer.compare(callerWitness, replacementB), 0);
  assert.ok(callerWitness.some((byte) => byte !== 0));
});

test("ordinary Buffer and slices still authenticate a matching cached wire", async () => {
  const fixture = await twoVersionPackedCatalog();
  const padded = Buffer.concat([
    Buffer.from([0x00, 0x01]),
    fixture.manifestWireB,
    Buffer.from([0x02]),
  ]);
  const slice = padded.subarray(2, 2 + fixture.manifestWireB.byteLength);

  const fromBuffer = await packedRangeRestore({
    session: fixture.session,
    store: fixture.store.freshReader(),
    extentManifestHash: fixture.packB.extentManifestHash,
    shardId: fixture.shardId,
    cachedManifestWire: Buffer.from(fixture.manifestWireB),
  });
  assert.equal(noteOf(fromBuffer.records, fixture.recordsB[0].id), "new-version");

  const fromSlice = await packedRangeRestore({
    session: fixture.session,
    store: fixture.store.freshReader(),
    extentManifestHash: fixture.packB.extentManifestHash,
    shardId: fixture.shardId,
    cachedManifestWire: slice,
  });
  assert.equal(noteOf(fromSlice.records, fixture.recordsB[0].id), "new-version");
});
