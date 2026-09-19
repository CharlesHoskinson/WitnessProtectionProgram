# Storage layout experiment

Status: isolated prototype. This directory measures two encrypted catalog layouts and one packing layout. It does not implement a production catalog format, a Drive adapter, a journal, or a cryptographic migration.

Application-codec snapshot envelopes are test carriers. They are not the production `kind=catalog` format.

## Runnable commands

Build the kernel, then run the scoped tests and the benchmark:

```sh
npm run build
node --test tests/storage*.test.mjs
node experiments/storage-layout/benchmark.mjs --quick
```

`--quick` currently records a label only; it does not reduce the workload. Both invocations run the same 1,000/10,000-record, 20-update, three-trial experiment.

The benchmark writes one JSON object to stdout. It sets `cloud_not_tested` to `true`. It does not print root bytes, recovery keys, or plaintext entries.

No extra packages are required beyond the existing Node 24 workspace.

## Design

The experiment seals and opens content with the actual `UnlockedVault` from `dist/kernel/index.js`. It derives a synthetic root and binding from `fixtures/wpp-v1-vectors.json` the same way the kernel tests do. It registers the explicit codec identifier `wpp.experimental.storage-layout` and keeps every required snapshot metadata field. It does not implement AES or HKDF in this directory.

Logical records are synthetic and keyed by stable opaque IDs. Both layouts receive identical inputs and the same edit sequence.

### Layout A: flat baseline

One complete encrypted catalog envelope per revision.

### Layout B: 64-bucket shards

Buckets come from the first 6 bits of `SHA-256(record ID)`. Each nonempty bucket stores sorted entries in one encrypted envelope. An encrypted root manifest authenticates each bucket ciphertext hash and the bucket `recordId` / binding. Unchanged buckets reuse the existing ciphertext and the existing manifest reference. Changed buckets and the root are resealed with fresh kernel randomness.

The trusted checkpoint is the caller-supplied root hash. This experiment does not implement a mutable latest pointer, merge semantics, or rollback prevention. Restore uses a fresh reader, the root hash, and the synthetic root key record. It does not use retained plaintext maps. Revision history is immutable.

Restore hash-checks, authenticates, and assembles every referenced bucket. It rejects missing, swapped, or corrupt data, duplicate logical keys, and wrong bucket membership. It never returns a partial catalog. Existing envelope byte ceilings still apply.

The fixed 64-bucket count is a bounded prototype. Production must split by byte size. It must not keep 64 buckets forever.

### Packing

Complete existing encrypted shard envelopes are concatenated into packs. The target size is 4 MiB. An individual envelope is never split. An envelope larger than the target is rejected.

Packing hashes every owned input envelope and compares that SHA-256 to the revision `bucketCiphertextHashes` entry. The check covers bytes from the store and bytes from `revision.envelopes`. A mismatch fails before the function publishes an authoritative extent manifest or returns success. Immutable pack bytes from earlier valid envelopes may already exist. They are not an authoritative catalog.

A separate extent manifest is sealed with the production kernel. Each extent binds shard identity, pack ciphertext hash, offset, length, and envelope ciphertext hash. Restore validates integer bounds, duplicate or overlapping extents, and the per-envelope hash. Range reads slice the in-memory pack and count modeled local requests and bytes. There are no Google Drive calls.

Whole-pack restore and isolated shard range restore are separate. One AEAD stream does not support independent random access. The inner envelopes remain the AEAD boundary for each shard. A range read cannot verify the whole-pack hash without reading the whole pack. Trust the authenticated extent manifest, then verify the per-envelope hash and AEAD. Corruption, missing data, or truncation fails when the affected bytes are read. Unread corruption detection is not a claim.

Cached packed-range lookup holds the encrypted extent-manifest wire. It does not hold a plaintext extent array. Whether the wire is loaded from storage or supplied from cache, restore checks the intrinsic typed-array byte length against the package ceiling before it copies. Wrong types and oversized inputs fail before hash. Restore then checks SHA-256 against the caller `extentManifestHash`. It authenticates the wire with the production kernel and the expected extent record binding, and it validates extents. Re-authentication of a matching cached wire is local CPU. It does not count as a storage GET. Cold packed shard lookup still reads the manifest plus the range. That manifest read is the one-time cache-fill cost. Warmed lookup excludes that cost and models one range GET. This size check is prototype input robustness. It is not a hostile same-process security boundary.

### Object store

The store is a synchronous in-memory map keyed by exact ciphertext SHA-256. It stores owned copies. It records logical read and write calls and bytes separately from elapsed time. It is not persistent. It does not claim Drive acceptance.

## What the results can establish

The measurements can show, on this host, for these synthetic records:

- whether a one-record update rewrites fewer ciphertext bytes under 64-bucket reuse than under a flat envelope
- whether packing complete envelopes reduces modeled object GET counts for a cold full restore
- whether a cached encrypted extent-manifest wire plus one range read fetches fewer bytes than a full packed restore. Cold results include the one-time cache-fill GET. Warmed lookup excludes that cost.
- local elapsed time medians and ranges for seal and restore

The JSON includes parameters, trial count, measurements, correctness results, and `cloud_not_tested=true`. There is no acceptance threshold that forces a favorable result.

## What the results cannot establish

- lower Google Drive latency from fewer modeled calls
- production catalog durability, crash safety, or journal behavior
- security approval of a catalog or pack schema
- that 64 buckets remain a valid split as catalogs grow
- unread detection of corruption in a pack
- plaintext-hash discovery, convergent encryption, or cross-user deduplication

No plaintext hashes or metadata are part of a cloud-visible design. All entries in this experiment are synthetic.

## Public sources that informed the design

- Restic encrypted packs and indexes
- IPLD hash-map sharding
- Dolt structural sharing
- Google Drive byte-range download support

This experiment does not adopt Prolly trees, plaintext deduplication, convergent encryption, ORAM, or a new cipher suite.

## Future production work

A production version needs:

- bounded dynamic sharding by encoded byte size, not a fixed 64-bucket map
- an explicit catalog schema and an explicit pack/extent schema, not application-codec snapshot carriers
- a real adapter with provider object identifiers, verified read-back, and incomplete-result reporting
- a journal and crash-safe ciphertext persistence
- independent security review

Until those exist, treat these numbers as a local prototype measurement.
