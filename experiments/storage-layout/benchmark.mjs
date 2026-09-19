#!/usr/bin/env node
/**
 * Storage-layout experiment benchmark.
 * Emits one JSON document on stdout. Does not print root bytes,
 * recovery keys, or plaintext entries.
 */

import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  BUCKET_COUNT,
  PACK_TARGET_BYTES,
  InMemoryObjectStore,
  bucketForRecordId,
  createExperimentalSession,
  createSyntheticRecords,
  flatCommit,
  flatLookup,
  flatRestore,
  packShards,
  packedFullRestore,
  packedRangeRestore,
  shardedCommit,
  shardedLookup,
  shardedRestore,
} from "./catalog.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VECTORS_PATH = join(ROOT, "fixtures", "wpp-v1-vectors.json");

function loadVectors() {
  return JSON.parse(readFileSync(VECTORS_PATH, "utf8"));
}

function median(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function rangeOf(values) {
  if (values.length === 0) {
    return [null, null];
  }
  return [Math.min(...values), Math.max(...values)];
}

function logicalEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  const a = new Map(left.map((record) => [record.id, JSON.stringify(record.payload)]));
  const b = new Map(right.map((record) => [record.id, JSON.stringify(record.payload)]));
  if (a.size !== b.size) {
    return false;
  }
  for (const [id, payload] of a) {
    if (b.get(id) !== payload) {
      return false;
    }
  }
  return true;
}

function applyUpdate(records, index, rev) {
  return records.map((record, i) =>
    i === index
      ? { id: record.id, payload: { ...record.payload, rev } }
      : record,
  );
}

function restoreStats(stats) {
  return {
    gets: stats.reads,
    fetched_bytes: stats.readBytes,
    manifest_reads: stats.manifestReads,
    manifest_bytes: stats.manifestReadBytes,
    data_reads: stats.dataReads,
    data_bytes: stats.dataReadBytes,
    range_reads: stats.rangeReads,
    range_read_bytes: stats.rangeReadBytes,
  };
}

async function runFlatTrial({ session, records, updates }) {
  const store = new InMemoryObjectStore();
  const initialStart = performance.now();
  let parent = await flatCommit({ session, store, records, parent: null });
  const initialMs = performance.now() - initialStart;
  const initial = {
    ciphertext_bytes: store.stats.writeBytes,
    objects: store.stats.writes,
    envelopes_written: parent.rewrittenRecordIds.length,
    manifest_bytes: store.stats.manifestWriteBytes,
    data_bytes: store.stats.dataWriteBytes,
  };

  let current = records;
  const perUpdateBytes = [];
  const perUpdateEnvelopes = [];
  const updateStart = performance.now();
  for (let u = 0; u < updates; u += 1) {
    const before = store.stats.writeBytes;
    current = applyUpdate(current, u % current.length, u + 1);
    parent = await flatCommit({ session, store, records: current, parent });
    perUpdateBytes.push(store.stats.writeBytes - before);
    perUpdateEnvelopes.push(parent.rewrittenRecordIds.length);
  }
  const updateMs = performance.now() - updateStart;

  const restoreReader = store.freshReader();
  const restored = await flatRestore({
    session,
    store: restoreReader,
    rootHash: parent.rootHash,
  });
  const equal = logicalEqual(restored.records, current);

  const lookupReader = store.freshReader();
  const targetId = records[0].id;
  await flatLookup({
    session,
    store: lookupReader,
    rootHash: parent.rootHash,
    recordId: targetId,
  });

  return {
    equal,
    initial,
    initialMs,
    updateMs,
    updates: {
      count: updates,
      total_rewritten_bytes: perUpdateBytes.reduce((sum, value) => sum + value, 0),
      median_rewritten_bytes: median(perUpdateBytes),
      envelopes_written: perUpdateEnvelopes.reduce((sum, value) => sum + value, 0),
      per_update_rewritten_bytes: perUpdateBytes,
    },
    cold_full_restore: restoreStats(restoreReader.stats),
    selected_shard_lookup: restoreStats(lookupReader.stats),
  };
}

async function runShardedTrial({ session, records, updates }) {
  const store = new InMemoryObjectStore();
  const initialStart = performance.now();
  let parent = await shardedCommit({ session, store, records, parent: null });
  const initialMs = performance.now() - initialStart;
  const initial = {
    ciphertext_bytes: store.stats.writeBytes,
    objects: store.stats.writes,
    envelopes_written: parent.rewrittenRecordIds.length,
    manifest_bytes: store.stats.manifestWriteBytes,
    data_bytes: store.stats.dataWriteBytes,
    nonempty_buckets: parent.bucketCiphertextHashes.size,
  };

  let current = records;
  const perUpdateBytes = [];
  const perUpdateEnvelopes = [];
  const updateStart = performance.now();
  for (let u = 0; u < updates; u += 1) {
    const before = store.stats.writeBytes;
    current = applyUpdate(current, u % current.length, u + 1);
    parent = await shardedCommit({ session, store, records: current, parent });
    perUpdateBytes.push(store.stats.writeBytes - before);
    perUpdateEnvelopes.push(parent.rewrittenRecordIds.length);
  }
  const updateMs = performance.now() - updateStart;

  const restoreReader = store.freshReader();
  const restored = await shardedRestore({
    session,
    store: restoreReader,
    rootHash: parent.rootHash,
  });
  const equal = logicalEqual(restored.records, current);

  const lookupReader = store.freshReader();
  const targetId = records[0].id;
  await shardedLookup({
    session,
    store: lookupReader,
    rootHash: parent.rootHash,
    recordId: targetId,
  });

  const packStart = performance.now();
  const packed = await packShards({
    session,
    store,
    revision: parent,
    targetBytes: PACK_TARGET_BYTES,
  });
  const packMs = performance.now() - packStart;
  const packBytes = packed.packs.reduce((sum, pack) => sum + pack.ciphertext.byteLength, 0);
  const extentManifest = store.get(packed.extentManifestHash);
  const extentManifestBytes = extentManifest.byteLength;

  const packedFullReader = store.freshReader();
  const packedFull = await packedFullRestore({
    session,
    store: packedFullReader,
    extentManifestHash: packed.extentManifestHash,
  });
  const packedEqual = logicalEqual(packedFull.records, current);

  const packedColdShardReader = store.freshReader();
  const shardId = bucketForRecordId(targetId);
  await packedRangeRestore({
    session,
    store: packedColdShardReader,
    extentManifestHash: packed.extentManifestHash,
    shardId,
  });

  const packedCachedReader = store.freshReader();
  await packedRangeRestore({
    session,
    store: packedCachedReader,
    extentManifestHash: packed.extentManifestHash,
    shardId,
    cachedManifestWire: extentManifest,
  });

  return {
    equal: equal && packedEqual,
    initial,
    initialMs,
    updateMs,
    packMs,
    updates: {
      count: updates,
      total_rewritten_bytes: perUpdateBytes.reduce((sum, value) => sum + value, 0),
      median_rewritten_bytes: median(perUpdateBytes),
      envelopes_written: perUpdateEnvelopes.reduce((sum, value) => sum + value, 0),
      per_update_rewritten_bytes: perUpdateBytes,
    },
    cold_full_restore: restoreStats(restoreReader.stats),
    selected_shard_lookup: restoreStats(lookupReader.stats),
    packed: {
      pack_count: packed.packs.length,
      pack_bytes: packBytes,
      extent_manifest_bytes: extentManifestBytes,
      objects_written: packed.packs.length + 1,
      pack_ms: packMs,
      cold_full_restore: restoreStats(packedFullReader.stats),
      cold_shard_lookup: {
        ...restoreStats(packedColdShardReader.stats),
        note: "Includes the one-time cache-fill GET of the encrypted extent manifest. Warmed lookup excludes that cost.",
      },
      cached_index_shard_lookup: {
        ...restoreStats(packedCachedReader.stats),
        note: "Encrypted extent-manifest wire already held. Re-authentication is local CPU. Range-read one envelope. Cache-fill cost is in cold_shard_lookup. Does not verify the whole-pack hash.",
      },
    },
  };
}

function aggregateNumeric(trials, pick) {
  const values = trials.map(pick);
  return {
    median: median(values),
    range: rangeOf(values),
    values,
  };
}

function aggregateRestore(trials, key) {
  return {
    gets: median(trials.map((trial) => trial[key].gets)),
    fetched_bytes: median(trials.map((trial) => trial[key].fetched_bytes)),
    manifest_reads: median(trials.map((trial) => trial[key].manifest_reads)),
    manifest_bytes: median(trials.map((trial) => trial[key].manifest_bytes)),
    data_reads: median(trials.map((trial) => trial[key].data_reads)),
    data_bytes: median(trials.map((trial) => trial[key].data_bytes)),
    range_reads: median(trials.map((trial) => trial[key].range_reads)),
    range_read_bytes: median(trials.map((trial) => trial[key].range_read_bytes)),
  };
}

function summarizeFlat(recordCount, trials) {
  return {
    record_count: recordCount,
    layout: "flat",
    initial: {
      ciphertext_bytes: median(trials.map((trial) => trial.initial.ciphertext_bytes)),
      objects: median(trials.map((trial) => trial.initial.objects)),
      envelopes_written: median(trials.map((trial) => trial.initial.envelopes_written)),
      manifest_bytes: median(trials.map((trial) => trial.initial.manifest_bytes)),
      data_bytes: median(trials.map((trial) => trial.initial.data_bytes)),
    },
    updates: {
      count: trials[0].updates.count,
      total_rewritten_bytes: median(trials.map((trial) => trial.updates.total_rewritten_bytes)),
      median_rewritten_bytes: median(trials.map((trial) => trial.updates.median_rewritten_bytes)),
      envelopes_written: median(trials.map((trial) => trial.updates.envelopes_written)),
    },
    timing: {
      initial_ms: aggregateNumeric(trials, (trial) => trial.initialMs),
      update_sequence_ms: aggregateNumeric(trials, (trial) => trial.updateMs),
    },
    cold_full_restore: aggregateRestore(trials, "cold_full_restore"),
    selected_shard_lookup: aggregateRestore(trials, "selected_shard_lookup"),
    correctness_all_equal: trials.every((trial) => trial.equal === true),
  };
}

function summarizeSharded(recordCount, trials) {
  return {
    record_count: recordCount,
    layout: "sharded-64",
    initial: {
      ciphertext_bytes: median(trials.map((trial) => trial.initial.ciphertext_bytes)),
      objects: median(trials.map((trial) => trial.initial.objects)),
      envelopes_written: median(trials.map((trial) => trial.initial.envelopes_written)),
      manifest_bytes: median(trials.map((trial) => trial.initial.manifest_bytes)),
      data_bytes: median(trials.map((trial) => trial.initial.data_bytes)),
      nonempty_buckets: median(trials.map((trial) => trial.initial.nonempty_buckets)),
    },
    updates: {
      count: trials[0].updates.count,
      total_rewritten_bytes: median(trials.map((trial) => trial.updates.total_rewritten_bytes)),
      median_rewritten_bytes: median(trials.map((trial) => trial.updates.median_rewritten_bytes)),
      envelopes_written: median(trials.map((trial) => trial.updates.envelopes_written)),
    },
    timing: {
      initial_ms: aggregateNumeric(trials, (trial) => trial.initialMs),
      update_sequence_ms: aggregateNumeric(trials, (trial) => trial.updateMs),
      pack_ms: aggregateNumeric(trials, (trial) => trial.packMs),
    },
    cold_full_restore: aggregateRestore(trials, "cold_full_restore"),
    selected_shard_lookup: aggregateRestore(trials, "selected_shard_lookup"),
    packed: {
      pack_count: median(trials.map((trial) => trial.packed.pack_count)),
      pack_bytes: median(trials.map((trial) => trial.packed.pack_bytes)),
      extent_manifest_bytes: median(trials.map((trial) => trial.packed.extent_manifest_bytes)),
      objects_written: median(trials.map((trial) => trial.packed.objects_written)),
      cold_full_restore: {
        gets: median(trials.map((trial) => trial.packed.cold_full_restore.gets)),
        fetched_bytes: median(trials.map((trial) => trial.packed.cold_full_restore.fetched_bytes)),
        manifest_reads: median(trials.map((trial) => trial.packed.cold_full_restore.manifest_reads)),
        manifest_bytes: median(trials.map((trial) => trial.packed.cold_full_restore.manifest_bytes)),
        data_reads: median(trials.map((trial) => trial.packed.cold_full_restore.data_reads)),
        data_bytes: median(trials.map((trial) => trial.packed.cold_full_restore.data_bytes)),
      },
      cold_shard_lookup: {
        gets: median(trials.map((trial) => trial.packed.cold_shard_lookup.gets)),
        fetched_bytes: median(trials.map((trial) => trial.packed.cold_shard_lookup.fetched_bytes)),
        manifest_reads: median(trials.map((trial) => trial.packed.cold_shard_lookup.manifest_reads)),
        manifest_bytes: median(trials.map((trial) => trial.packed.cold_shard_lookup.manifest_bytes)),
        data_reads: median(trials.map((trial) => trial.packed.cold_shard_lookup.data_reads)),
        data_bytes: median(trials.map((trial) => trial.packed.cold_shard_lookup.data_bytes)),
        range_reads: median(trials.map((trial) => trial.packed.cold_shard_lookup.range_reads)),
        range_read_bytes: median(trials.map((trial) => trial.packed.cold_shard_lookup.range_read_bytes)),
        note: "Includes the one-time cache-fill GET of the encrypted extent manifest. Warmed lookup excludes that cost.",
      },
      cached_index_shard_lookup: {
        gets: median(trials.map((trial) => trial.packed.cached_index_shard_lookup.gets)),
        fetched_bytes: median(
          trials.map((trial) => trial.packed.cached_index_shard_lookup.fetched_bytes),
        ),
        range_reads: median(trials.map((trial) => trial.packed.cached_index_shard_lookup.range_reads)),
        range_read_bytes: median(
          trials.map((trial) => trial.packed.cached_index_shard_lookup.range_read_bytes),
        ),
        note: "Encrypted extent-manifest wire already held. Re-authentication is local CPU. Range-read one envelope. Cache-fill cost is in cold_shard_lookup. Does not verify the whole-pack hash.",
      },
    },
    correctness_all_equal: trials.every((trial) => trial.equal === true),
  };
}

async function main() {
  const quick = process.argv.includes("--quick");
  const recordCounts = [1000, 10000];
  const updates = 20;
  const trials = 3;
  const vectors = loadVectors();
  const session = await createExperimentalSession({ vectors });
  const measurements = [];
  const failures = [];

  for (const recordCount of recordCounts) {
    const records = createSyntheticRecords({
      count: recordCount,
      seed: `bench-${recordCount}`,
      minBytes: 128,
      maxBytes: 256,
    });
    const flatTrials = [];
    const shardedTrials = [];
    for (let trial = 0; trial < trials; trial += 1) {
      const flat = await runFlatTrial({ session, records, updates });
      const sharded = await runShardedTrial({ session, records, updates });
      if (!flat.equal) {
        failures.push({ layout: "flat", record_count: recordCount, trial });
      }
      if (!sharded.equal) {
        failures.push({ layout: "sharded-64", record_count: recordCount, trial });
      }
      flatTrials.push(flat);
      shardedTrials.push(sharded);
    }
    measurements.push(summarizeFlat(recordCount, flatTrials));
    measurements.push(summarizeSharded(recordCount, shardedTrials));
  }

  const report = {
    experiment: "wpp-storage-layout",
    cloud_not_tested: true,
    parameters: {
      quick,
      record_counts: recordCounts,
      payload_bytes: { min: 128, max: 256 },
      bucket_count: BUCKET_COUNT,
      updates,
      trials,
      pack_target_bytes: PACK_TARGET_BYTES,
      seed_pattern: "bench-{recordCount}",
      identical_inputs_across_layouts: true,
    },
    trial_count: trials,
    correctness: {
      all_trials_logical_equal: failures.length === 0,
      failures,
    },
    measurements,
    notes: [
      "Modeled GET counts are local in-memory operations. They are not Google Drive requests.",
      "Fewer modeled calls do not establish lower Drive latency.",
      "App-codec snapshot envelopes are test carriers, not the production kind=catalog format.",
      "The in-memory store is not persistent and is not a Drive simulator.",
      "Fixed 64-bucket assignment is a bounded prototype. Production must split by byte size.",
      "A range read does not verify the whole-pack hash. Trust the authenticated extent manifest, the per-envelope hash, and AEAD.",
      "Cached packed-range lookup supplies the encrypted extent-manifest wire. Restore hash-checks that wire against extentManifestHash and authenticates it before the range GET.",
      "cold_shard_lookup includes the one-time cache-fill GET of the encrypted extent manifest. cached_index_shard_lookup excludes that cost. Re-authentication is local CPU.",
      "Timing values are local elapsed milliseconds on this host. They are not Drive RTT.",
    ],
  };

  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : "benchmark failed";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
