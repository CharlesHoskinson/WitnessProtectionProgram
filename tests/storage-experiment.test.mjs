import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BUCKET_COUNT,
  EXPERIMENTAL_CODEC_ID,
  PACK_TARGET_BYTES,
  InMemoryObjectStore,
  bucketForRecordId,
  createExperimentalSession,
  createSyntheticRecords,
  flatCommit,
  flatRestore,
  packShards,
  packedFullRestore,
  packedRangeRestore,
  shardedCommit,
  shardedRestore,
  sha256Hex,
} from "../experiments/storage-layout/catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const VECTORS_PATH = join(ROOT, "fixtures", "wpp-v1-vectors.json");

function loadVectors() {
  return JSON.parse(readFileSync(VECTORS_PATH, "utf8"));
}

function recordMap(records) {
  return new Map(records.map((record) => [record.id, record.payload]));
}

function assertLogicalEqual(actual, expected) {
  assert.deepEqual(recordMap(actual), recordMap(expected));
}

function tamperBytes(bytes) {
  const copy = Buffer.from(bytes);
  copy[0] ^= 0xff;
  return copy;
}

test("experimental module exports bounded prototype constants", () => {
  assert.equal(BUCKET_COUNT, 64);
  assert.equal(PACK_TARGET_BYTES, 4 * 1024 * 1024);
  assert.equal(typeof EXPERIMENTAL_CODEC_ID, "string");
  assert.ok(EXPERIMENTAL_CODEC_ID.startsWith("wpp.experimental."));
});

test("bucket assignment uses first 6 bits of SHA-256(record id)", () => {
  const id = "rec-0001";
  const digest = createHash("sha256").update(id, "utf8").digest();
  const expected = digest[0] >> 2;
  assert.equal(bucketForRecordId(id), expected);
  assert.ok(bucketForRecordId(id) >= 0);
  assert.ok(bucketForRecordId(id) < BUCKET_COUNT);
});

test("createExperimentalSession uses production UnlockedVault and vectors", async () => {
  const vectors = loadVectors();
  const session = await createExperimentalSession({ vectors });
  assert.ok(session.vault);
  assert.equal(typeof session.vault.sealSnapshot, "function");
  assert.equal(typeof session.vault.openSnapshot, "function");
  assert.equal(session.codecId, EXPERIMENTAL_CODEC_ID);
  assert.ok(session.binding);
  assert.ok(session.rootKeyRecord);
  assert.notEqual(session.rootRecordId, undefined);
});

test("flat and sharded layouts restore identical logical catalogs", async () => {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const records = createSyntheticRecords({ count: 48, seed: "equiv-1" });

  const flatRev = await flatCommit({ session, store, records, parent: null });
  const shardedRev = await shardedCommit({ session, store, records, parent: null });

  const flatRestored = await flatRestore({
    session,
    store: store.freshReader(),
    rootHash: flatRev.rootHash,
  });
  const shardedRestored = await shardedRestore({
    session,
    store: store.freshReader(),
    rootHash: shardedRev.rootHash,
  });

  assertLogicalEqual(flatRestored.records, records);
  assertLogicalEqual(shardedRestored.records, records);
  assertLogicalEqual(flatRestored.records, shardedRestored.records);
});

test("one-record update reuses unchanged bucket ciphertext", async () => {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const records = createSyntheticRecords({ count: 32, seed: "reuse-1" });
  const first = await shardedCommit({ session, store, records, parent: null });

  const updated = records.map((record, index) =>
    index === 0
      ? { ...record, payload: { ...record.payload, note: "updated-once" } }
      : record,
  );
  const second = await shardedCommit({
    session,
    store,
    records: updated,
    parent: first,
  });

  const changedBucket = bucketForRecordId(records[0].id);
  assert.deepEqual(second.changedBucketIds.sort((a, b) => a - b), [changedBucket]);
  assert.ok(second.rewrittenRecordIds.includes(session.rootRecordId));
  assert.equal(second.rewrittenRecordIds.length, 2);

  for (const [bucketId, ciphertextHash] of first.bucketCiphertextHashes) {
    if (bucketId === changedBucket) {
      assert.notEqual(
        second.bucketCiphertextHashes.get(bucketId),
        ciphertextHash,
      );
      continue;
    }
    assert.equal(second.bucketCiphertextHashes.get(bucketId), ciphertextHash);
  }

  const restored = await shardedRestore({
    session,
    store: store.freshReader(),
    rootHash: second.rootHash,
  });
  assertLogicalEqual(restored.records, updated);
});

test("revision history remains immutable and independently restorable", async () => {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const revisions = [];
  let records = createSyntheticRecords({ count: 16, seed: "hist-1" });
  let parent = null;

  for (let i = 0; i < 5; i += 1) {
    if (i > 0) {
      const target = records[i % records.length];
      records = records.map((record) =>
        record.id === target.id
          ? { ...record, payload: { ...record.payload, rev: i } }
          : record,
      );
    }
    const committed = await shardedCommit({ session, store, records, parent });
    revisions.push({ committed, records: records.map((record) => ({ ...record })) });
    parent = committed;
  }

  for (const revision of revisions) {
    const restored = await shardedRestore({
      session,
      store: store.freshReader(),
      rootHash: revision.committed.rootHash,
    });
    assertLogicalEqual(restored.records, revision.records);
  }
});

test("restore rejects missing, corrupt, reordered, and swapped buckets", async () => {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const records = createSyntheticRecords({ count: 24, seed: "tamper-1" });
  const committed = await shardedCommit({ session, store, records, parent: null });

  const missingStore = store.clone();
  const firstBucketHash = [...committed.bucketCiphertextHashes.values()][0];
  missingStore.delete(firstBucketHash);
  await assert.rejects(
    () =>
      shardedRestore({
        session,
        store: missingStore.freshReader(),
        rootHash: committed.rootHash,
      }),
    /missing|not found/i,
  );

  const corruptStore = store.clone();
  const secondHash = [...committed.bucketCiphertextHashes.values()][1];
  const original = corruptStore.get(secondHash);
  corruptStore.replace(secondHash, tamperBytes(original));
  await assert.rejects(
    () =>
      shardedRestore({
        session,
        store: corruptStore.freshReader(),
        rootHash: committed.rootHash,
      }),
    /corrupt|hash|integrity|authenticate/i,
  );

  const swappedStore = store.clone();
  const hashes = [...committed.bucketCiphertextHashes.entries()];
  const [bucketA, hashA] = hashes[0];
  const [bucketB, hashB] = hashes[1];
  const bytesA = swappedStore.get(hashA);
  const bytesB = swappedStore.get(hashB);
  swappedStore.replace(hashA, bytesB);
  swappedStore.replace(hashB, bytesA);
  await assert.rejects(
    () =>
      shardedRestore({
        session,
        store: swappedStore.freshReader(),
        rootHash: committed.rootHash,
      }),
    /swap|hash|membership|authenticate|binding/i,
  );

  const hostile = await session.createAuthenticatedManifest({
    kind: "root",
    buckets: hashes.map(([bucketId, ciphertextHash], index) => ({
      bucketId,
      recordId: committed.bucketRecordIds.get(bucketId),
      ciphertextHash: index === 0 ? hashB : ciphertextHash,
    })),
  });
  const hostileStore = store.clone();
  hostileStore.put(hostile.ciphertext);
  await assert.rejects(
    () =>
      shardedRestore({
        session,
        store: hostileStore.freshReader(),
        rootHash: sha256Hex(hostile.ciphertext),
      }),
    /hash|mismatch|membership|authenticate/i,
  );
});

test("restore rejects wrong trusted root and wrong binding", async () => {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const other = await createExperimentalSession({
    vectors: loadVectors(),
    rootVariant: 1,
  });
  const store = new InMemoryObjectStore();
  const records = createSyntheticRecords({ count: 8, seed: "bind-1" });
  const committed = await shardedCommit({ session, store, records, parent: null });

  await assert.rejects(
    () =>
      shardedRestore({
        session,
        store: store.freshReader(),
        rootHash: "00".repeat(32),
      }),
    /root|not found|missing/i,
  );

  await assert.rejects(
    () =>
      shardedRestore({
        session: other,
        store: store.freshReader(),
        rootHash: committed.rootHash,
      }),
    /binding|authenticate|open|mismatch/i,
  );
});

test("duplicate logical keys and wrong bucket membership are rejected", async () => {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const records = createSyntheticRecords({ count: 12, seed: "dup-1" });
  const committed = await shardedCommit({ session, store, records, parent: null });

  const duplicateManifest = await session.createAuthenticatedManifest({
    kind: "bucket",
    bucketId: bucketForRecordId(records[0].id),
    recordId: committed.bucketRecordIds.get(bucketForRecordId(records[0].id)),
    entries: [records[0], records[0]],
  });
  const dupStore = store.clone();
  dupStore.put(duplicateManifest.ciphertext);
  const dupRoot = await session.createAuthenticatedManifest({
    kind: "root",
    buckets: [...committed.bucketCiphertextHashes.entries()].map(
      ([bucketId, ciphertextHash]) => ({
        bucketId,
        recordId: committed.bucketRecordIds.get(bucketId),
        ciphertextHash:
          bucketId === bucketForRecordId(records[0].id)
            ? sha256Hex(duplicateManifest.ciphertext)
            : ciphertextHash,
      }),
    ),
  });
  dupStore.put(dupRoot.ciphertext);
  await assert.rejects(
    () =>
      shardedRestore({
        session,
        store: dupStore.freshReader(),
        rootHash: sha256Hex(dupRoot.ciphertext),
      }),
    /duplicate/i,
  );

  const wrongBucketId = (bucketForRecordId(records[0].id) + 1) % BUCKET_COUNT;
  const wrongRecordId = session.bucketRecordIds.get(wrongBucketId);
  const wrongMembership = await session.createAuthenticatedManifest({
    kind: "bucket",
    bucketId: wrongBucketId,
    recordId: wrongRecordId,
    entries: [records[0]],
  });
  const wrongStore = store.clone();
  wrongStore.put(wrongMembership.ciphertext);
  const wrongRoot = await session.createAuthenticatedManifest({
    kind: "root",
    buckets: [
      {
        bucketId: wrongBucketId,
        recordId: wrongRecordId,
        ciphertextHash: sha256Hex(wrongMembership.ciphertext),
      },
    ],
  });
  wrongStore.put(wrongRoot.ciphertext);
  await assert.rejects(
    () =>
      shardedRestore({
        session,
        store: wrongStore.freshReader(),
        rootHash: sha256Hex(wrongRoot.ciphertext),
      }),
    /membership|bucket/i,
  );
});

test("packing concatenates complete envelopes and authenticates extents", async () => {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const records = createSyntheticRecords({ count: 40, seed: "pack-1" });
  const committed = await shardedCommit({ session, store, records, parent: null });
  const packed = await packShards({
    session,
    store,
    revision: committed,
    targetBytes: PACK_TARGET_BYTES,
  });

  assert.ok(packed.packs.length >= 1);
  assert.ok(packed.extentManifestHash);
  for (const pack of packed.packs) {
    assert.ok(pack.ciphertext.byteLength <= PACK_TARGET_BYTES);
  }

  const full = await packedFullRestore({
    session,
    store: store.freshReader(),
    extentManifestHash: packed.extentManifestHash,
  });
  assertLogicalEqual(full.records, records);

  const shardId = [...committed.bucketCiphertextHashes.keys()][0];
  const ranged = await packedRangeRestore({
    session,
    store: store.freshReader(),
    extentManifestHash: packed.extentManifestHash,
    shardId,
  });
  assert.ok(ranged.records.length > 0);
  for (const record of ranged.records) {
    assert.equal(bucketForRecordId(record.id), shardId);
  }
});

test("hostile extent bounds, overlap, hash, and truncated ranges fail", async () => {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const records = createSyntheticRecords({ count: 20, seed: "extent-1" });
  const committed = await shardedCommit({ session, store, records, parent: null });
  const packed = await packShards({
    session,
    store,
    revision: committed,
    targetBytes: PACK_TARGET_BYTES,
  });

  const [firstExtent] = packed.extents;
  const overlapManifest = await session.createAuthenticatedManifest({
    kind: "extent",
    extents: [
      firstExtent,
      {
        ...firstExtent,
        shardId: "overlap-hostile",
        offset: firstExtent.offset,
        length: firstExtent.length,
      },
    ],
  });
  store.put(overlapManifest.ciphertext);
  await assert.rejects(
    () =>
      packedFullRestore({
        session,
        store: store.freshReader(),
        extentManifestHash: sha256Hex(overlapManifest.ciphertext),
      }),
    /overlap|duplicate|bounds/i,
  );

  const badHashManifest = await session.createAuthenticatedManifest({
    kind: "extent",
    extents: [
      {
        ...firstExtent,
        envelopeCiphertextHash: "11".repeat(32),
      },
    ],
  });
  store.put(badHashManifest.ciphertext);
  await assert.rejects(
    () =>
      packedFullRestore({
        session,
        store: store.freshReader(),
        extentManifestHash: sha256Hex(badHashManifest.ciphertext),
      }),
    /hash|mismatch|integrity/i,
  );

  const negativeManifest = await session.createAuthenticatedManifest({
    kind: "extent",
    extents: [
      {
        ...firstExtent,
        offset: -1,
        length: firstExtent.length,
      },
    ],
  });
  store.put(negativeManifest.ciphertext);
  await assert.rejects(
    () =>
      packedFullRestore({
        session,
        store: store.freshReader(),
        extentManifestHash: sha256Hex(negativeManifest.ciphertext),
      }),
    /bounds|integer|offset|length/i,
  );

  const truncatedStore = store.clone();
  const packHash = packed.packs[0].ciphertextHash;
  const packBytes = truncatedStore.get(packHash);
  truncatedStore.replace(packHash, packBytes.subarray(0, Math.max(1, packBytes.byteLength - 8)));
  await assert.rejects(
    () =>
      packedFullRestore({
        session,
        store: truncatedStore.freshReader(),
        extentManifestHash: packed.extentManifestHash,
      }),
    /truncat|length|bounds|hash|missing/i,
  );
});

test("object store records logical reads/writes separately from time", () => {
  const store = new InMemoryObjectStore();
  const payload = randomBytes(32);
  const hash = store.put(payload);
  assert.equal(store.stats.writes, 1);
  assert.ok(store.stats.writeBytes >= payload.byteLength);
  const read = store.get(hash);
  assert.equal(Buffer.compare(Buffer.from(read), payload), 0);
  assert.equal(store.stats.reads, 1);
  const reader = store.freshReader();
  reader.get(hash);
  assert.equal(reader.stats.reads, 1);
  assert.equal(store.stats.reads, 1);
});

test("envelope larger than pack target is rejected without splitting", async () => {
  const session = await createExperimentalSession({ vectors: loadVectors() });
  const store = new InMemoryObjectStore();
  const huge = Buffer.alloc(64);
  huge.fill(7);
  store.put(huge);
  await assert.rejects(
    () =>
      packShards({
        session,
        store,
        revision: {
          bucketCiphertextHashes: new Map([[0, sha256Hex(huge)]]),
          bucketRecordIds: new Map([[0, "bucket:00"]]),
          envelopes: new Map([[0, huge]]),
        },
        targetBytes: 16,
      }),
    /larger than target|exceeds pack/i,
  );
});
