# Encrypted catalog shards and optional packs

This is an experimental design explanation, not a production wire specification. The runnable prototype is in `experiments/storage-layout/`; its carriers use the existing application-codec snapshot envelope, not a production `kind=catalog` implementation.

## Why separate catalog structure from storage layout?

A flat encrypted catalog must be encrypted and written again when one entry changes. An immutable sharded catalog writes the changed shard and a small root manifest. It keeps exact ciphertext references for unchanged shards. Random encryption remains unchanged; structural sharing does not require deterministic encryption or public plaintext hashes.

The logical trust path is:

```text
selected authenticated checkpoint
  -> encrypted catalog root
     -> encrypted catalog shards
        -> complete encrypted witness envelopes
```

Physical packs can place several complete envelopes in one object. A separately encrypted extent manifest binds each selected envelope to its pack hash, offset, length, ciphertext hash and record identity. Packs change storage layout; they do not change the witness serialization or AEAD boundary. This prototype packs synthetic catalog-shard envelopes, not captured Midnight witnesses.

This design draws on immutable encrypted packs in [Restic](https://github.com/restic/restic/blob/master/doc/design.rst), structural sharing in [Dolt's storage engine](https://www.dolthub.com/blog/2024-02-29-storage-engine/), and block-distributed maps in [IPLD HAMTs](https://ipld.io/specs/advanced-data-layouts/hamt/). The prototype is a fixed 64-bucket hash-prefix map, not a complete HAMT, B+ tree or Prolly tree. The experiment does not compare those tree implementations.

## What the experiment measures

Synthetic records contain 128–256-byte payloads. Each layout receives the same records and sequence of 20 single-record updates, repeated over three trials. The store counts actual operations against an in-memory immutable-object implementation. The benchmark includes encrypted root updates and manifest overhead. Every trial restores the same logical catalog through a fresh reader.

| Records | Layout | Median bytes rewritten per update | Total bytes rewritten over 20 updates |
| --- | --- | ---: | ---: |
| 1,000 | Flat | 299,993 | 5,999,905 |
| 1,000 | 64 shards | 21,102.5 | 423,989 |
| 10,000 | Flat | 2,995,039 | 59,900,831 |
| 10,000 | 64 shards | 63,067 | 1,249,962 |

At 10,000 records, the flat catalog initially occupies 2,994,837 bytes in one object. The sharded catalog occupies 3,100,624 bytes in 65 objects. Smaller updates cost additional initial bytes, metadata and read operations.

| Restore operation at 10,000 records | Modeled reads | Bytes fetched |
| --- | ---: | ---: |
| Flat, full cold restore | 1 | 2,995,153 |
| Sharded, full cold restore | 65 | 3,100,940 |
| Packed shards, full cold restore | 2 | 3,111,656 |
| Unpacked selected shard, cold | 2 | 64,323 |
| Packed selected shard, cold | 2 | 75,039 |
| Packed selected shard, cached authenticated manifest | 1 range read | 49,416 |

The cold packed lookup includes the manifest fetch. The warm lookup excludes that previous fetch but reauthenticates the cached encrypted manifest locally. Packing uses a 4 MiB target and measures packing a selected revision. It does not establish incremental repacking cost or a production-optimal pack size. These are deterministic byte counts and local logical reads, not statistical claims about cloud latency or throughput.

## Integrity, cached metadata and freshness

Before using an extent, check that the encrypted manifest bytes hash to the requested checkpoint and authenticate with the expected record binding. Cached plaintext extents are insufficient: a valid old extent list could otherwise satisfy a request for a newer manifest. Regression tests cover stale, tampered and wrong-session cache entries.

For a range read, check extent bounds, the returned envelope hash and the envelope's normal AEAD authentication. This verifies the selected envelope. It does not verify unread pack bytes or prove that the full pack is intact. A full restore checks the whole pack hash.

Google Drive supports [partial downloads of binary files](https://developers.google.com/workspace/drive/api/guides/manage-downloads). Actual account permissions, request behavior, upload limits, retries and latency still need integration tests. Publish referenced data before its catalog, and retain local ciphertext until remote verification succeeds.

An authenticated old catalog remains valid cryptographically. Hash-linked history does not prove latest state, as the distinction between inclusion, consistency and split views in [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html) illustrates. Preserve concurrent heads and independently retained checkpoints. After device loss, report unknown freshness if there is no independent evidence.

## Reproduce the experiment

From the repository root with the documented Node toolchain:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
node experiments/storage-layout/benchmark.mjs --quick
```

`--quick` currently records a label only; omitting it runs the same workload. The last command prints JSON with workload parameters, trial results, correctness checks and `cloud_not_tested=true`. The adjacent experimental README documents the API and limitations. The {download}`host measurement report <../reference/storage-layout-measurement.json>` records the tested source commit and command. It is a historical result; rerun the command when the source changes.

## Roadmap decision

M1 adds encrypted byte-bounded catalog shards, exact reuse of unchanged ciphertext, immutable revision heads and a rebuildable local index. Production must split by encoded byte size rather than assume 64 buckets always fit. Missing children, concurrent heads and malformed authenticated manifests need explicit tests.

M3 keeps one-click Google Drive backup first. Packs remain a conditional pilot after real provider measurements. Native exports remain opaque whole records. This experiment does not justify convergent deduplication, plaintext content-defined chunking, searchable server indexes, ORAM, erasure coding or automated garbage collection. Those need separate threat models and recovery evidence.
