# Catalog-v2 plaintext grammar and adaptive layout

Status: implemented plaintext grammar, planner, revision validator, and kernel
envelope seal/open for one selected root or shard. This page is not Drive
publication or complete M1/M3 work. Do not treat planner fingerprints as
authority. A successful `sealCatalogNode` is not remote durability.

The schema lives at [`catalog-v2.schema.json`](schemas/catalog-v2.schema.json).
Independent route vectors live at `fixtures/catalog-v2-vectors.json`. Catalog-v1
is unchanged. A v1 catalog cannot satisfy a v2 root or shard role.

See [storage layout](../explanation/storage-layout.md) for the experimental
measurements that motivated adaptive shards.

## What this profile is

A catalog-v2 node is one closed JSON object. The parser
`parseCatalogNode(bytes, expectedRole)` accepts only canonical UTF-8 bytes and
an expected role `root` or `shard`. It inspects caller bytes with the shared
native helper first. Inspection and copy traps become `WPP_SCHEMA` and do not
promote caller `KernelError` codes. Real oversize after that inspection stays
`WPP_INPUT_TOO_LARGE`.

It then parses the owned copy and rejects duplicate keys, invalid UTF-8, BOM,
and extra fields. It returns a frozen view. It is a grammar parser. It does not
authenticate headers, wire hashes, or provider locators.

Root payload:

```text
{
  payloadVersion: 2,
  nodeType: "root",
  partitionVersion: 1,
  parents,
  entryCount,
  observationCount,
  requiredEpochs,
  references
}
```

Shard payload:

```text
{
  payloadVersion: 2,
  nodeType: "shard",
  partitionVersion: 1,
  prefix,
  records
}
```

`entryCount` is the number of snapshot, tombstone, and root-update-receipt
records together. `observationCount` is separate. `parents` are at most 16
sorted unique lowercase SHA-256 hex digests of predecessor v2 catalog-root
wires. Unseen parent kinds cannot be asserted here. A later fetch of a v1 parent
must reject. `requiredEpochs` are sorted unique `id16` values, at most 256.
They must include every nonempty child `reference.rootEpoch` and every retained
snapshot `package.rootEpoch`. Receipt `newActiveEpoch` and `retainedOldEpochs`
do not by themselves prove that an encrypted object needs that epoch. Plaintext
may keep at most one extra epoch for the unknown authenticated root-header
epoch. A second extra epoch is a reference error. Kernel `sealCatalogNode` and
`openCatalogNode` require the authenticated root-header epoch to be present in
`requiredEpochs`. The whole-revision validator plus the later coordinator must
confirm exact equality of the required set with the union of shard epochs,
retained snapshot epochs, and that header epoch.

## Limits

Every ceiling applies at the same time. Count maxima do not promise that
worst-case metadata fits the byte budget.

| Bound | Maximum |
| --- | --- |
| Root canonical plaintext | 4 MiB |
| Root envelope wire | 8 MiB |
| Shard canonical plaintext | 1 MiB |
| Shard envelope wire | 2 MiB |
| Shard split target | 256 KiB |
| Cumulative canonical shard plaintext | 64 MiB |
| Prefix references, including empty markers | 1024 |
| Entries (snapshot + tombstone + receipt) | 10000 |
| Observations | 40000 |
| Prefix depth (hex nibbles) | 64 |
| Locators per snapshot or child reference | 4 |
| Parents | 16 |
| Required epochs | 256 |
| Live witness wire, unique digest | 512 MiB |

A complete 16-way cover has size `1 + 15k` and therefore at most 1021
references under the 1024 cap. The schema still permits 1024 references. The
1024-reference max-field root is a grammar size bound. It is not a valid
complete cover. A semantically valid maximal cover uses 1021 references.
Whole-revision validation accepts that cover when empty markers and nonempty
payloads match. The 1024-reference probe stays a parse-only size bound.

Prefix depth 64 is one full SHA-256 nibble string. A real SHA-256 route hash
does not give a synthesizable depth-64 collision chain. Tests use reachable
reference-count and cumulative-byte failures. They do not inject hashes.

## References

An empty marker is exactly `{prefix, empty: true}`. A nonempty reference binds
`prefix`, `empty: false`, `recordId`, `generationId`, `rootEpoch`, `wireSha256`,
`wireByteLength`, `plaintextByteLength`, `entryCount`, `observationCount`,
`canonicalRecordsSha256`, and `locators`. Prefixes are lowercase hex, length
0–64.

`canonicalRecordsSha256` is SHA-256 of the exact canonical tagged-record array.
It exists only inside encrypted root content. The planner may return the same
fingerprint for a later verified comparison. Fingerprints alone are not
authority. `sealCatalogNode` gives a changed leaf a fresh random `recordId`,
`generationId`, and nonce. An unchanged fully authenticated same-epoch leaf may
reuse exact wire bytes in the coordinator. This kernel does not invent reuse.

## Tagged records

Each shard record is exactly `{recordKind, body}`. Kinds are `snapshot`,
`tombstone`, `root-update-receipt`, and `observation`. Bodies keep catalog-v1
field semantics except locators. `entryKind` must match `recordKind` for the
three entry kinds.

The v2 Google locator is closed:

```text
{
  provider: "google-drive",
  accountBinding: {scheme: "google-drive-permission-id", value},
  objectId,
  revisionId
}
```

`value` matches `[A-Za-z0-9_.-]{1,128}`. `objectId` and a non-null `revisionId`
match `[A-Za-z0-9_-]{1,128}`. `revisionId` may be `null`. Null gives no provider
rollback detection. Wire SHA-256 remains the content bind. Snapshot locators are
1–4 unique values. Observation `locator` uses the same union.

Receipt transitions reject `newActiveEpoch` when it is in `retainedOldEpochs`.
They reject `currentRootRecordSha256` when it is among `parentRootRecordSha256`.
Other v1 semantic contradictions in a receipt body also reject.

Do not call the v1 parser on v2 records. Do not validate observations inside one
leaf as if every referenced snapshot were co-located.

## Routing and adaptive split

Route hash is SHA-256 of canonical UTF-8 JSON
`["WPP/catalog-route/v2", recordKind, identity]`. Identity is snapshot
`package.sha256`, tombstone `eventId`, receipt `receiptId`, or observation
`observationId`. Records sort by route hash, then kind, then identity. A
duplicate selected identity is rejected. Conflicts are not hidden.

`planCatalogShards(recordsUtf8)` parses an owned canonical tagged-record array,
checks whole-revision references, metadata size, observation digest and locator
agreement, and receipt identity, then partitions. It returns frozen leaf
metadata, copied payload bytes, explicit empty markers, counts, cumulative
bytes, live-witness digests, and fingerprints. It accepts no caller limits or
callbacks. Callers cannot mutate returned `payloadUtf8` so that it disagrees
with the declared hash or length.

A later split, reference, count, or cumulative failure wipes every owned leaf
payload that was already emitted. Ownership transfers only when the planner
returns. Successful leaves still expose a defensive copy of `payloadUtf8`.

The empty prefix covers the full space. A split replaces one leaf with all 16
next-nibble children, including empty markers. Split uses actual UTF-8 canonical
full shard payload size, not JSON character count. Stop when a leaf has at most
1024 records and at most 256 KiB. One valid large record may occupy a leaf up to
1 MiB. Depth 64, 1024 references, and 64 MiB cumulative bytes are checked
incrementally. The planner never drops records and never merges or prunes
history.

## Root preflight

`parseCatalogNode` is a grammar parser. It does not check complete cover,
declared count sums, or declared cumulative shard plaintext.

Call `preflightCatalogRoot(rootPayloadUtf8)` before any coordinator starts child
downloads. Preflight rejects an invalid, incomplete, or overlapping cover. It
rejects declared child count sums that do not match the root. It rejects
aggregate declared shard plaintext above 64 MiB. It rejects a nonempty child
`rootEpoch` that is missing from `requiredEpochs`. It rejects a declared
multi-record shard above the 256 KiB split target. A declared single-record
shard may use the 1 MiB leaf ceiling. Keep whole-revision actual byte, record,
and exact-epoch checks in `validateCatalogRevision`. Extra required epochs
beyond child `rootEpoch` values are not fully judged at preflight because
snapshot epochs arrive with shard payloads.

## Revision validator

`validateCatalogRevision(rootPayloadUtf8, shardPayloadsUtf8)` owns the root
first. It then bounds the shard array. It returns only static `KernelError`
codes from a finite internal list. It does not copy a caller string into a
public diagnostic. Hostile length getters, index getters, byte prototypes,
revoked arrays, thrown proxies, and `getPrototypeOf` traps do not escape raw
exceptions or forged `WPP_` codes. An allowlisted caller `KernelError` from
those traps stays `WPP_SCHEMA`.

Aggregate actual shard bytes are checked before each copy. The expected
nonempty shard count is checked before copies. Temporary owned shard bytes are
wiped on every exit.

The validator runs the same root preflight, then checks exact child prefixes,
record routing, global identity uniqueness, actual plaintext byte lengths,
`canonicalRecordsSha256`, cross-record references, and all bounds. A
multi-record shard above the 256 KiB split target rejects. Only a single valid
large record may use the 1 MiB leaf ceiling. Required epochs must equal the
union of child `rootEpoch` values and retained snapshot epochs, plus at most
one extra reserved header epoch. It does not check kernel headers, wire hashes,
or provider bytes. Kernel `openCatalogNode` checks exact wire digest, length, header identity, AEAD,
raw JCS, and closed role fields before a coordinator calls this validator. Do
not label an unauthenticated parse result as selected.

Live witnesses are retained snapshot digests with no effective tombstone in the
selected revision. History records stay in the catalog. Unique live wire lengths
sum to at most 512 MiB. Conflicting length claims reject.

A snapshot and a tombstone in one selected revision are retained deletion
history. They are not automatically unresolved concurrency. Multiple live
generations of one record identity also do not prove concurrent heads. Multihead
causal conflict detection belongs to reconciliation with ancestry evidence. This
local revision reports empty `unresolvedTombstoneLive` and `liveRecordForks`
because it cannot establish those conflicts. It does not delete records.

v1 heads remain a separate lineage. There is no implicit v1 migration. Partial
shard queries are unsupported. A later in-memory index must bind the exact
selected root wire hash and must be discarded when that hash changes.

Routine reuse readback does not append observations. Persist an observation at
first verified creation or an explicit repair. The planner does not invent
observation records.

## Source API

TypeScript lives in `src/storage/catalog-v2.ts`. Kernel seal and open live in
`src/kernel/vault.ts`. Tests live in `tests/catalog-v2.test.mjs` and
`tests/catalog-v2-kernel.test.mjs`. The storage module has no disk or network
side effects beyond loading this schema at import time.
