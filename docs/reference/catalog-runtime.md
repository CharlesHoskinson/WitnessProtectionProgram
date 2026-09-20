# Catalog semantic runtime

Status: candidate logical catalog module. This page describes parse, reconcile,
and snapshot-claim comparison for draft catalog v1 plaintext. It is not an
authenticator. It is not a shard store. It does not encrypt catalog bytes.

The public API lives in `src/catalog/index.ts`. Tests import the compiled module
from `dist/catalog/index.js`. The grammar remains in
[`encrypted-catalog.md`](encrypted-catalog.md) and
[`catalog-v1.schema.json`](schemas/catalog-v1.schema.json).

## Trust boundary

`parseCatalog` and `reconcileCatalogs` read owned UTF-8 catalog plaintext. They
do not open AEAD packages. They do not read credentials. They do not write
files. They do not activate Midnight state.

A caller must obtain catalog plaintext from a trusted kernel `openSnapshot` for
a catalog package. This module does not perform that open. A successful parse
is schema and semantic validation only.

`verifySnapshotClaim` compares one snapshot catalog entry to a caller-supplied
`OpenResult` and exact wire length. The caller must pass `OpenResult` from a
successful trusted `openSnapshot`. A fabricated `OpenResult` is outside this
trust boundary. This helper is not a replacement for AEAD.

Logical validation is not authentication.

## Public API

`parseCatalog(payloadUtf8)` copies the bytes first. It parses them with the
kernel strict JSON parser. It then applies the committed catalog schema. It
enforces the 16 MiB plaintext ceiling and the 64 KiB canonical metadata
ceiling. It checks receipt epoch difference and observation references. It
returns an isolated frozen catalog object.

`reconcileCatalogs(inputs)` copies every input before parse. It accepts 1 to 16
inputs. Each input is `{revisionSha256, payloadUtf8}`. `revisionSha256` is the
exact authenticated catalog package digest supplied by the caller. This module
does not recompute that digest. A later copy failure wipes already-owned
earlier plaintext copies before the throw.

`verifySnapshotClaim(entryUtf8, expectedVaultId, authenticated)` copies its
inputs first. `authenticated` is `{opened, wireByteLength}`. The expected vault
identifier is a required caller argument. The catalog entry does not carry
`vaultId`.

Returned objects are owned JSON views. Later mutation of caller buffers does
not change a returned result. Public errors are `CatalogError` with a static
`code`. The message is that code. The message has no user text and no payload
bytes. A caller-thrown `CatalogError` is not reused. Getter or copy failures
on caller revision inputs become a fresh `CATALOG_INPUT`. Getter or copy
failures on a caller `OpenResult` become a fresh `CATALOG_INPUT`. An invalid
expected vault identifier remains `CATALOG_BINDING`. Real limit and conflict
failures keep their codes.

## Error codes

| Code | Meaning |
| --- | --- |
| `CATALOG_INPUT` | Bytes, JSON, schema, or graph shape is invalid |
| `CATALOG_LIMIT` | A declared count or byte ceiling would be exceeded |
| `CATALOG_REFERENCE` | An observation or receipt fails a semantic cross-check |
| `CATALOG_CONFLICT` | Selected identities disagree, or the same revision digest has two payloads |
| `CATALOG_BINDING` | Snapshot claim fields do not match the supplied authenticated open |

## Parse rules

Duplicate selected identities with different bodies in one input fail with
`CATALOG_CONFLICT` where the schema permits repeats. Snapshot entries with the
same digest may union locators when `package`, `metadata`, and `label` agree.
Any other same-digest claim is a conflict. Identical tombstone or receipt
bodies in one payload deduplicate because `entries` has no `uniqueItems`.

The catalog v1 schema sets `observations.uniqueItems` to true. Repeated
identical observations inside one raw payload are `CATALOG_INPUT`. The schema
does not permit that wire grammar. Across distinct valid catalog revisions,
identical observations deduplicate. An earlier spec sentence that promised
every selected identity would deduplicate inside one raw payload is superseded.

A snapshot and a tombstone for the same digest may coexist in one catalog.
That pair is retained history. Parse does not classify it as a conflict.

Observations must name a retained snapshot package and an exact locator on
that snapshot. A `readback-authenticated` digest and length must equal the
package claim. A `digest-mismatch` digest must differ. A receipt
`newActiveEpoch` must differ from every retained old epoch. Receipts do not
prove root-record membership or freshness.

## Reconciliation

Reconciliation retains exact claims. It never selects by timestamp or email.
Each supplied payload is strictly parsed and validated first. Repeated
`revisionSha256` values then compare canonical original parsed JSON bytes.
Compact and pretty encodings of the same JSON are equal. JCS preserves array
order, so a different entry order is not equal. The same revision digest with
a different canonical payload fails with `CATALOG_CONFLICT`. Equivalent
repeats deduplicate before graph processing. Duplicate JSON keys stay invalid.

The result `revisionHeads` is the sorted set of supplied revisions that no
supplied descendant names as a parent. `missingParents` is the sorted set of
catalog parents that are absent from the inputs. These sets are not a complete
remote head list. `freshness` is always `unknown`.

If claim conflicts exist, `catalog` is null. The result still lists every
source revision and every differing body. There is no winner. Distinct
generations of one logical record stay in the union when claims agree.

Parents of a successful union catalog are the `revisionHeads`. Missing ancestry
does not drop entries. The module never prunes. A bounded union that would
exceed 1000 entries or 4000 observations fails. Conflict material counts toward
those bounds.

Those count ceilings do not establish a byte bound. Reconciliation counts
canonical UTF-8 bytes per record before it clones a union catalog or a
conflict claim. The count includes every retained source revision copy, every
union record, every identity-conflict claim, and every tombstone-live claim.
The budget is 16 MiB. The implementation adds 64 bytes of conservative
overhead per counted record so wrappers stay inside the budget. A
short-circuit check throws `CATALOG_LIMIT` as soon as the budget would be
exceeded. Failure produces no result object and no persistence. The module
does not serialize one giant result object to measure size.

The output is not a new wire package. This module does not invent a digest for
the unsealed union.

## Tombstone causality

A single supplied tombstoned revision that still retains its snapshot is not a
conflict. A supplied live ancestor plus a tombstoned descendant is not a
conflict. The descendant keeps the snapshot as ordinary history.

Two supplied incomparable revision heads conflict as `tombstone-live` when one
head keeps the snapshot live and the other head carries its tombstone. Report
that conflict only when the relevant ancestry is complete. If missing parents
block that determination, retain the data and list `missingParents`. Do not
call that pair concurrent. Wall-clock timestamps never establish causality.

## Snapshot claim comparison

The helper compares `opened.packageSha256`, exact `wireByteLength`, header
`vaultId`, `rootEpoch`, `scopeId`, `recordId`, `generationId`, and `kind`, and
the authenticated metadata. `kind` must be `snapshot`. Any mismatch fails with
`CATALOG_BINDING`. Invalid expected vault type or encoding also fails with
`CATALOG_BINDING`. Getter or copy failures at this public boundary become
static catalog errors. They do not return input-bearing diagnostics.

`OpenResult` does not include wire length. The caller supplies that length
separately. The helper has no activation side effects.

## Ordering

Entries sort by `entryKind`, then selected identity, then canonical body.
Observations sort by `observationId`, then canonical body. Locator sets sort
by canonical body. Parent and revision arrays sort lexically.

## What this module is not

This module does not encrypt catalogs. It does not implement production
sharding. It does not replace kernel open, the local journal, or Drive publish.
It does not complete M1.
