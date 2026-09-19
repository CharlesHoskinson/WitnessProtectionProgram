# Why the encrypted catalog is a snapshot, not a public index

Status: design explanation for a draft grammar. No catalog parser, in-memory
index, Drive publisher, or conflict resolver is implemented.

The [encrypted catalog reference](../reference/encrypted-catalog.md) lists the
exact fields. This page explains the trust boundaries those fields serve.

## No public plaintext metadata index

WPP stores discovery data inside authenticated catalog packages. It does not
publish a plaintext metadata index beside ciphertext. Provider filenames, folder
names, and search properties must not carry witness semantics, account emails,
or roots.

The public bootstrap marker `wpp-vault.json` is a discovery hint. Validate it
against the recovered root record. Never follow a URL from a marker.

## Full snapshots, not deltas

Each catalog is a complete logical snapshot of retained entries and known
observations. A successor catalog copies forward every retained snapshot,
tombstone, root-update receipt, and known observation. It is not a patch against
a parent catalog.

This profile has no pagination. The catalog may hold at most 1000 entries and
4000 observations. The independent 16 MiB plaintext ceiling still applies. An
implementation must reject an oversize union rather than drop entries or invent
pages.

There is no automatic pruning. Known observations stay in the successor. If the
4000 bound would be exceeded, reject the union. Identical observation IDs with
identical bodies deduplicate. Identical IDs with different bodies are a
conflict.

Tombstones hide exact targets in a default listing only after a later product
implements listing. The tombstone remains history. Automatic ciphertext deletion
stays disabled.

A snapshot fork shares `scopeId` and `recordId`, uses a distinct `generationId`,
and names the ancestor snapshot digest in `metadata.parents`. Catalog `parents`
name predecessor catalog bytes. They do not prove a snapshot fork.

## Index lifetime is a future M1 concern

A usable index is memory-only after unlock. On lock it must become erased or
inaccessible. Rebuild it from authenticated accessible catalog heads, then
verify referenced packages. That index does not exist in this tree.

Exact filters, when implemented, are network, account, application, contract,
state ID, lifecycle, and codec. History walks vault, scope, record, and parent
digests. Forked records return all maximal known generations. An unknown parent
means the history is incomplete. It does not mean the visible head is latest.

## Results stay separate

A later query API must separate:

- accessibility
- conflict
- completeness
- freshness-unknown

Missing objects, missing parents, or missing epochs make a result incomplete.
Even a full provider enumeration cannot prove freshness against rollback or
withholding.

## Conflicts are retained

Identical snapshot digests may union locators when package, metadata, and label
match. Any other disagreement is a conflicting claim. The same event, receipt,
or observation ID with different bodies is a conflict. Concurrent live and
tombstone heads remain a conflict.

Never last-write-wins. Timestamps are not winners. The draft schema cannot
detect these conflicts. An application validator must.

## Observations are reports, not durability

An observation records what a client saw at `observedAt` for one locator. A
readback-authenticated outcome is historical evidence that those bytes
authenticated then. It does not prove the object still exists, is still
readable, or is the latest catalog.

Do not store raw provider error bodies. Classify outcomes into the six statuses
in the reference page.

## Drive is not a multi-object transaction

Google Drive offers no multi-object atomic transaction for WPP. The intended
publish sequence is:

1. Upload persisted immutable package bytes.
2. Read the object back and authenticate it in the kernel.
3. Publish a new catalog that references the verified objects.

Retry with identical bytes, or use new randomness for a changed package. A
successful upload response is not a verified backup.

`objectId` is the lookup key. Always hash downloaded bytes. A null `revisionId`
is not an immutability proof. Users or other authorized apps can change or
delete Drive files.

## Root-update receipts record rotations only

The initial receipt profile supports epoch rotation. It stores parent and
current root-record digests, a revision ID, retained old epochs, and the new
active epoch. It stores no secrets.

The same canonical receipt body is intended to be stored under both the
retained-old epoch and the new-active epoch. Fixture catalog names only
illustrate those outer encryption contexts.

Receipts are not compare-and-swap. They are not freshness proofs. Metadata-only
root edits, same-active-epoch administration, and reconciliation without
rotation wait for a later profile.

Because receipts name root records, catalog references are not limited to
immutable witness packages. Correct earlier wording that claimed every
reference was a package.

## What remains unimplemented

This slice supplies Draft 2020-12 schema, synthetic catalogs, grammar tests, and
these pages. It does not implement:

- strict UTF-8 and duplicate-key rejection before deserialization
- JCS authentication of catalog packages
- the application validator
- Drive upload, read-back, or catalog publish
- the memory-only index
- listing filters, tombstone hiding, or conflict presentation
- native Midnight interoperability
- a one-click application

M0 remains open.
