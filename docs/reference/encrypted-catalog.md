# Encrypted catalog grammar (draft v1)

Status: draft structural grammar. This page describes a JSON Schema profile and
synthetic examples. It is not a production parser, Drive adapter, cryptographic
approval, or complete M0 freeze.

The schema lives at [`catalog-v1.schema.json`](schemas/catalog-v1.schema.json).
Synthetic catalogs live at `fixtures/catalog-v1-examples.json`. Snapshot
metadata in those fixtures reuses the public synthetic vector in
`fixtures/wpp-v1-vectors.json` without changing that vector.

See [catalog database](../explanation/catalog-database.md) for rationale.

## What this profile is

The encrypted catalog payload is one JSON object:

```text
{payloadVersion: 1, parents, entries, observations}
```

All four keys are required. No other root keys are permitted. Catalogs are full
logical snapshots, not deltas.

Carry retained snapshot entries, tombstones, receipts, and all known
observations forward. Bound the union at 1000 entries and 4000 observations.
Reject an oversize catalog. Do not prune automatically. Pagination is
unsupported in this profile.

Counts:

| Bound | Maximum |
| --- | --- |
| Predecessor catalog digests (`parents`) | 16 |
| Entries | 1000 |
| Observations | 4000 |
| Snapshot locators | 16 |
| Package `byteLength` | 25165824 (24 MiB wire ceiling) |

An independent 16 MiB plaintext ceiling still applies inside those counts. The
schema does not measure encoded UTF-8 size.

`parents` lists SHA-256 digests of exact predecessor catalog package bytes.
Digests are 64 lowercase hex characters.

## Identifier and text rules

Every object forbids `additionalProperties`. Every listed field is required,
including fields that may be JSON `null`. Every string has an explicit bound.
Every array has `maxItems`. Preserve case. Do not normalize identifiers.

Reusable `$defs`:

| Name | Encoding |
| --- | --- |
| `id16` | Unpadded canonical base64url, 22 characters, final character in `AQgw` |
| `id32` | Unpadded canonical base64url, 43 characters, final character in `AEIMQUYcgkosw048` |
| `digest` | 64 lowercase hex characters |
| `timestamp` | UTC RFC 3339 with a `Z` suffix only, seconds plus optional 1–3 fractional digits, `format: date-time` |
| `text` | Unicode, minimum length 1, no C0 controls or DEL |
| `labelText` | Unicode, length 0–256, empty string allowed, no C0 controls or DEL |
| `binding` | `{scheme, value}` |

The base64url alphabet is `A-Z`, `a-z`, `0-9`, `_`, `-`. Schema `maxLength` is a
Unicode character count, not a UTF-8 byte ceiling.

Every `pattern` ends with `(?![\s\S])` rather than `$`. Python `$` can match
before a final newline. ECMAScript `$` without multiline does not.

`scheme` matches `^[a-z][a-z0-9.-]{0,63}(?![\s\S])`. `value` is text of length 1–1024.
Fixtures use scheme `synthetic-fixture` only. Production Google account mapping
is unresolved until adapter validation. Do not auto-merge accounts by email.

Opaque names are never filesystem paths, URLs to follow, constructors, or
credentials.

## Snapshot metadata

Catalog snapshot entries reuse the same metadata object as the proposed snapshot
payload. The initial snapshot metadata profile has no `label` field and no
namespaced extension fields. Put a user label only on the catalog snapshot
entry.

Required metadata fields:

| Field | Constraint |
| --- | --- |
| `network` | `{id` text 1–128, `genesisHash` text 1–256 or `null}` |
| `accountBinding` | `binding` |
| `applicationId` | text 1–256 |
| `contract` | `{address` text 1–1024, `codeHash` text 1–256 or `null}` |
| `privateStateIds` | unique text 1–256, array length 1–256 |
| `codec` | `{id`, `version` integer 1–2147483647, `producerPackage`, `producerVersion`, `sourceCommit` 40 or 64 lowercase hex} |
| `capturedAt` | timestamp |
| `lifecycle` | `{status`, `transactionId` text 1–256 or `null`, `blockHash` text 1–256 or `null}` |
| `parents` | unique digest array 0–16 |
| `retentionClass` | `irreplaceable-private-state` or `retained-application-witness` |

`lifecycle.status` is `prepared`, `submitted`, `confirmed`, `failed`,
`orphaned`, or `unassociated`. A confirmed label requires application evidence.
Structural validity alone never establishes settlement.

A missing genesis hash or code hash requires a verified adapter configuration or
registry before activation. Encoded metadata UTF-8 size remains a semantic
64 KiB bound. The schema does not enforce that byte ceiling.

## Locator

```text
{provider: "google-drive", accountBinding, objectId, revisionId}
```

`objectId` is canonical opaque Google ASCII `^[A-Za-z0-9_-]{1,1024}(?![\s\S])`.
`revisionId` uses the same pattern or `null`. There is no filename, URL, token,
or folder field.

`objectId` is the lookup authority. Always hash downloaded bytes.
`revisionId: null` is not an immutability proof. Other providers wait for
explicit variants.

## Entry variants

`entries` is a `oneOf` union discriminated by `entryKind`.

### snapshot

```text
{
  entryKind: "snapshot",
  package: {sha256, byteLength, rootEpoch, scopeId, recordId, generationId},
  metadata,
  label: labelText (0–256 or null),
  locators: unique locator array 1–16
}
```

The enclosing catalog header supplies `vaultId`. A fetched package must match
vault, identifiers, digest, byte length, and metadata before it is accessible or
verified. Those checks are semantic. The catalog `label` is presentation only.

### tombstone

```text
{
  entryKind: "tombstone",
  eventId,
  targetPackageSha256,
  reason: user-request | superseded | invalid-capture,
  recordedAt
}
```

A tombstone names one exact digest. It does not name future generations or a
wildcard record. History stays in the catalog. Automatic ciphertext deletion is
disabled. A catalog may retain a snapshot and a tombstone for that digest.
That pair is ordinary history. It is not a parse conflict.
A live ancestor plus a tombstoned descendant is not a conflict.
Two incomparable revision heads remain a tombstone-live conflict.
One head keeps the snapshot live. The other head carries its tombstone.
Report that conflict only when ancestry evidence is complete.
If missing parents block ancestry, retain the data and report missing parents.
Do not call that pair concurrent. Timestamps do not pick a winner.

### root-update-receipt

```text
{
  entryKind: "root-update-receipt",
  receiptId,
  parentRootRecordSha256: unique digest array 1–2,
  currentRootRecordSha256,
  rootRevisionId,
  retainedOldEpochs: unique id16 array 1–255,
  newActiveEpoch,
  recordedAt
}
```

This initial profile records epoch rotations only. Metadata-only root edits,
same-active-epoch administration, and reconciliation without rotation are
unsupported until a later reviewed profile.

`retainedOldEpochs` stops at 255 so `newActiveEpoch` can still fit the
root-record maximum of 256 epochs. Actual membership of old and new epochs in
the root record is a semantic check. The schema does not require
`newActiveEpoch` to differ from retained old epochs.

Receipts store no roots or secrets. The intended product stores the identical
canonical receipt body and ID in catalogs encrypted under retained-old and
new-active epochs. Fixture names `rootUpdateOldEpoch` and `rootUpdateNewEpoch`
only illustrate those outer encryption contexts. The fixtures are plaintext
grammar examples, not encrypted packages.

A receipt records an update. It is not a transactional compare-and-swap and not
a freshness proof. Receipts reference root records. They do not claim that every
catalog reference is an immutable witness package.

## Observations

Each observation is:

```text
{observationId, packageSha256, locator, observedAt, outcome}
```

The `observations` array has `uniqueItems: true`. A successor catalog copies
every known observation forward, bounded at 4000, with no implicit pruning.
Identical observation IDs with identical bodies deduplicate. Identical IDs with
different bodies are a conflict. Do not store raw provider error bodies.

`outcome` is a `oneOf` union:

| `status` | Additional fields |
| --- | --- |
| `readback-authenticated` | `observedSha256`, `byteLength` 1–25165824 |
| `digest-mismatch` | `observedSha256` |
| `authentication-failed` | `reason: "aead-rejected"` |
| `not-found` | `reason: "object-not-found"` |
| `access-denied` | `reason: "permission-denied"` |
| `unavailable` | `reason`: `network`, `provider`, or `rate-limit` |

Semantic checks, not JSON Schema:

- Readback digest and length equal the referenced snapshot.
- Mismatch digest differs from the referenced snapshot.
- Referenced packages and locators exist in retained entries.

Observations are authenticated historical reports. They are not present
durability guarantees.

## Schema limits

The schema accepts already-parsed JSON. It cannot:

- detect duplicate raw object keys
- enforce RFC 8785 JCS
- authenticate ciphertext
- prove publisher identity
- enforce encoded byte ceilings
- require uniqueness by a selected property such as `eventId`
- prove cross-references
- resolve conflicts

A later application validator must enforce those rules, plus duplicate entry
identities, observation IDs, epoch difference, matching header and metadata, and
semantic conflict rules. Identical snapshot digest entries may union locators
only when `package`, `metadata`, and `label` are identical. Otherwise report a
conflicting claim. The same event, receipt, or observation ID with different
bodies is a conflict. Never last-write-wins.

Strict UTF-8 parsing and duplicate-key, depth, input, and aggregate byte
rejection precede native deserialization. Those checks are not implemented here.

## Synthetic catalogs

The fixture envelope is `{notice, catalogs}`. `notice` is
`PUBLIC SYNTHETIC TEST DATA`. `catalogs` contains `baseline`, `forkA`, `forkB`,
`tombstoned`, `rootUpdateOldEpoch`, and `rootUpdateNewEpoch`.

All identifiers, locators, and non-vector digests are fictional grammar
examples. They are not remote verification evidence.

| Catalog | Role |
| --- | --- |
| `baseline` | Clean live snapshot from the existing synthetic vector IDs and metadata, plus one readback observation |
| `forkA` / `forkB` | Baseline snapshot plus a successor snapshot. Same `scopeId` and `recordId`. Distinct `generationId` and digest. `metadata.parents` include the baseline snapshot digest. Catalog `parents` alone do not prove a snapshot fork |
| `tombstoned` | Baseline snapshot plus the exact-target tombstone |
| `rootUpdateOldEpoch` / `rootUpdateNewEpoch` | Baseline snapshot plus identical rotation receipt bodies. Names only illustrate intended outer epoch encryption. Observations need not be identical |

Together the six catalogs include all three entry kinds and all six observation
statuses. Successor catalogs retain every baseline observation unchanged.
Binding schemes are `synthetic-fixture` only.

## Grammar check command

Install the test pins in `tests/requirements.txt` (`jsonschema==4.19.2` and
`rfc3339-validator==0.1.4`). Use that installed environment. The validator
package registers the `date-time` checker that FormatChecker uses for calendar
days. The tests fail if that checker is absent. Then:

```sh
python3 -m unittest discover -s tests -p 'test_catalog_schema.py'
```

The tests load Draft 2020-12 with `FormatChecker`. They do not fetch remote
schema references. Passing this suite, if the verification host reports it,
would show structural grammar only. It would not show semantic validation, M0
completion, or native interoperability.
