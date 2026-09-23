# WPP witness package — draft v0.1

Status: proposed application interchange profile. This tree includes a local TypeScript envelope kernel for snapshot seal and open. That kernel is not a production encoder, not a security-approved decoder, and not a substitute for the fixture generator. This is not an adopted Midnight protocol or a replacement for the native Midnight.js export format. One independent Python encoder and decoder for the public synthetic vector is recorded in the [format vectors reference](reference/format-vectors.md). That evidence does not freeze this profile.

## Encoding and bounds

One UTF-8 JSON object contains exactly `header`, `ciphertext`, and `tag`. Use RFC 8785 JSON Canonicalization Scheme (JCS) for authenticated header bytes. Reject duplicate object keys, unknown fields in v0.1, invalid UTF-8, non-finite numbers, malformed encodings, and unknown versions. Strings used for random identifiers are unpadded base64url with canonical round-trip encoding. Do not normalize or lowercase identifiers silently.

The v0.1 plaintext ceiling is 16 MiB per object; the wire-file ceiling is 24 MiB, header ceiling 4 KiB, nesting ceiling 32, and decoded metadata ceiling 64 KiB. The 4 KiB header ceiling and the 64 KiB metadata ceiling apply to the UTF-8 bytes of the JCS encoding of those objects. They do not apply to the outer package file size. The outer package remains bound by the 24 MiB raw-byte ceiling. Enforce input byte limits before JSON parsing and decoded length limits before allocations/native deserialization. Initial implementations reject oversized snapshots and report that protection is incomplete; chunking and compression require a later profile. A syntactically valid package is not evidence that its contents are authentic or compatible.

## Public authenticated header

| Field | Required value / encoding |
|---|---|
| `format` | Literal `wpp-witness-package` |
| `version` | Integer `1` (wire version for this draft) |
| `suite` | Literal `HKDF-SHA256+A256GCM` |
| `vaultId` | Random 16-byte identifier, base64url |
| `vaultSalt` | Random public 32-byte salt, base64url; immutable for a vault |
| `rootEpoch` | Random 16-byte identifier, base64url; identifies an independently generated secret root |
| `scopeId` | Random 32-byte identifier, base64url; a namespace, not an address |
| `recordId` | Random 32-byte identifier, base64url; stable for a logical record |
| `generationId` | Fresh random 32-byte identifier, base64url; changes for every new encryption |
| `kind` | `snapshot` or `catalog` |
| `nonce` | Fresh random 12-byte AES-GCM IV, base64url |

Header `version` is the integer value 1. A JSON number token is that value only when its exact decimal value is the integer 1 and the token has at most 64 characters. The tokens `1`, `1.0`, `1e0`, and `10e-1` are accepted examples. `1.0000000000000001` and `0.99999999999999999` are rejected. JavaScript `JSON.parse` rounds those two tokens to 1. This profile does not use that rounding. Boolean `true`, non-finite numbers, and numbers outside `-9007199254740991` through `9007199254740991` are rejected. A numeric token longer than 64 characters is malformed. Canonical header bytes use the token `1`. Those bytes are the AES-GCM additional authenticated data, including when the outer wire uses another accepted spelling. This rule applies to the package header `version` field. It does not reject fractional numbers in an application payload.

Vault open, local journal admission, and Google Drive upload each parse one owned copy of the package bytes. The raw header version check uses that same copy. A rounded token or a token longer than 64 characters fails before a durable journal record or a Drive POST. A matching caller SHA-256 does not bypass the check. A recovery pack uses this raw-number rule and keeps the separate recovery-pack schema. Decoded header names are the names that the check sees. A duplicate `version` key is rejected. The JSON spelling `vers\u0069on` is the header field `version`.

The public header leaks format, grouping and version relationships through random stable identifiers, plus the object kind. The provider also sees size, timing, account association and duplicate ciphertext across destinations. Random IDs conceal semantic names; they do not prevent traffic analysis. Padding can be added only in a future version with specified encoding.

`ciphertext` is the encrypted plaintext bytes, base64url. Reject ciphertext text longer than 22369622 characters before base64url decoding. That is the unpadded base64url length of 16 MiB. Reject decoded ciphertext longer than 16 MiB before AES-GCM. `tag` is the separate 16-byte GCM authentication tag, base64url. APIs that concatenate ciphertext and tag must split/join at precisely 16 bytes. The provider locator is not part of the package: the same bytes must survive storage migration.

## Exact key derivation profile

Primitives: RFC 5869 HKDF-SHA-256, with its Extract and Expand operations, and AES-256-GCM with a 128-bit authentication tag. All derived keys below are 32 bytes.

Define `CTX(values)` to be UTF-8 bytes of the JCS encoding of the indicated JSON array. Values are literal ASCII strings or validated canonical base64url strings. No string concatenation, implicit numeric encoding, or path separator escaping is permitted.

```text
PRK = HKDF-Extract(decode(vaultSalt), secretRoot)

K_scope = HKDF-Expand(PRK,
  CTX(["WPP", "1", "scope", vaultId, rootEpoch, scopeId]), 32)

K_object = HKDF-Expand(K_scope,
  CTX(["WPP", "1", "object", kind, recordId, generationId]), 32)

K_native = HKDF-Expand(K_scope,
  CTX(["WPP", "1", "native-export-password", recordId, generationId]), 32)

nativeExportPassword = base64url(K_native)
AAD = UTF8(JCS(header))
plaintext = UTF8(JCS(payload))
(ciphertext, tag) = AES-256-GCM(K_object, decode(nonce), plaintext, AAD)
```

`HKDF-Expand` accepts the already pseudorandom parent key directly; implementations must not silently apply an additional Extract at child levels. If a platform exposes only full HKDF, it needs a vetted implementation of the Expand operation or an explicitly revised profile with its own vectors. This distinction is covered by interoperability tests before freezing v1.

`kind` and purpose labels separate catalog encryption, snapshot encryption, and the native export password. A public header is untrusted until authentication succeeds. Root lookup uses vault/epoch identifiers but rejects a salt inconsistent with the unlocked root record. An attacker-selected header never triggers an unbounded vault search or remote URL request.

Generation IDs are CSPRNG values rather than restored counters. On a retry, reuse the exact persisted package bytes. On any change, generate a new generation ID, nonce, and package. Never reuse the same object key and nonce for another message. A crash after encryption but before persistence retries with fresh randomness. A restored/cloned process must obtain fresh OS randomness before encrypting. Production requires RNG-failure handling and independently checked vectors.

## Encrypted snapshot payload

| Field | Meaning |
|---|---|
| `payloadVersion` | Integer `1` |
| `metadata` | Required bounded object defined below |
| `content` | Native private-state export or versioned application codec value |

Required `metadata` fields:

- `network`: explicit chain/network identifier plus genesis hash where available. A network label alone does not establish chain identity; a missing genesis hash is recorded as null with validation delegated to the adapter's verified chain configuration.
- `accountBinding`: `{scheme, value}` describing the intended account. Scheme-specific comparison is performed by the adapter. WPP does not turn a human label into cryptographic identity.
- `applicationId`: stable application identifier.
- `contract`: `{address, codeHash}`; codeHash may be null only where the adapter records that the source did not provide it and requires a compatible application registry check before activation.
- `privateStateIds`: exact identifiers included; for native exports this list must be taken from the same coherent snapshot and checked in staging after import.
- `codec`: `{id, version, producerPackage, producerVersion, sourceCommit}`; full commit hashes, no moving branch as the only pin.
- `capturedAt`: UTC RFC 3339 timestamp, informational; never a freshness proof.
- `lifecycle`: `{status, transactionId, blockHash}`; status is `prepared`, `submitted`, `confirmed`, `failed`, `orphaned`, or `unassociated`; absent IDs are null. A confirmed label requires application evidence, which WPP must verify through the configured integration before treating it as settled.
- `parents`: ordered, duplicate-free array of prior package SHA-256 digests, lowercase hex. Empty for the first revision; forks retain separate parents. Digest covers exact saved UTF-8 package bytes, not decrypted contents.
- `retentionClass`: `irreplaceable-private-state` or `retained-application-witness`.

This initial snapshot metadata profile has no `label` field and no namespaced extension fields. That is a deliberate narrowing of earlier draft text. A user label belongs only on the encrypted catalog snapshot entry, where it is presentation-only. Do not include a root, seed, session credential, or raw storage refresh token. Strings and arrays have adapter-specific bounds within the global limits; an adapter must declare and enforce them before it is accepted.

### Native Midnight.js profile

`codec.id` is `midnight-js-private-state-export`. `content` preserves the field values of the native object `{format: "midnight-private-state-export", encryptedPayload, salt}` returned by `exportPrivateStates({password: nativeExportPassword, maxStates})`. JCS encodes WPP's enclosing JSON; the native API does not supply canonical wire bytes. The inner ciphertext and salt strings remain unchanged. Require structural field/value equality in adapter round-trip tests and a supported producer/consumer version matrix. Do not convert its private values through plain JSON or change its serializer.

The adapter must own a contract-scoped provider and serialize all its writes and scope changes while creating the native export. Keep an encrypted capture receipt with the adapter instance's opaque ID, requested network/account/contract, expected state IDs/count from the application, and snapshot generation. Recheck the wrapper-owned scope before releasing the lock. The upstream interface has no contract-scope getter or cleartext export-count return, so do not claim to call either. Validate the native export through isolated staging import, require the imported count to equal the expected unique ID count, and read/validate those IDs before marking capture verified. An unowned provider that can change scope outside this lock is unsupported for automatic capture.

The inspected implementation serializes values with SuperJSON and exports the currently selected contract. The native payload includes version, export timestamp, count and serialized states; WPP's outer encrypted metadata supplies network/account/contract binding. This is an adapter observation at the pinned source, not a guarantee across all Midnight versions.

On restore, authenticate WPP, derive the separate native password, check the expected target binding, then invoke native import into a fresh staging provider with an explicit contract address and conflict strategy `error`. Inspect imported state IDs/count/types and application invariants before activation. Never call `exportSigningKeys` automatically. Private state itself may contain sensitive application credentials; excluding the separate signing-key store does not make the snapshot non-secret.

### Application witness profile

`codec.id` is a namespaced registered application ID. `content` follows its versioned schema. Big integers use declared decimal-string fields and bytes use declared base64url fields, not heuristics. Constructors, executable code, filesystem paths and arbitrary object prototypes are never reconstructed from a backup. Do not collect transient witness values unless the application explicitly marks them for retention and the user has enabled that data category.

## Catalog and bootstrap

Each vault has a small public `wpp-vault.json` bootstrap marker containing `{format: "wpp-vault", version: 1, vaultId, vaultSalt, catalogScopeId, catalogRecordId}`. Root records also retain the catalog identifiers so deletion or replacement of the marker is detectable after unlock. The marker is a discovery hint, not an authority; validate it against the recovered root record. Never follow URLs supplied by a marker.

Catalog packages use `kind: "catalog"` and the dedicated catalog scope/record IDs. Their encrypted payload has `{payloadVersion: 1, parents, entries, observations}`. Catalogs are full logical snapshots, not deltas. Carry retained snapshot entries, tombstones, root-update receipts, and all known observations forward. Bound the union at 1,000 entries and 4,000 observations and reject an oversize catalog. Do not prune automatically. Pagination is unsupported in this profile.

Entries include snapshot locators and metadata, exact-digest tombstones, and rotation receipts. Snapshot and tombstone targets refer to immutable witness packages. A root-update receipt refers to root records, so not every catalog reference is a witness package. The first implementation caps a catalog at 1,000 entries and 4,000 observations. The independent 16 MiB plaintext ceiling still applies. Exact field bounds are in the [encrypted catalog grammar](reference/encrypted-catalog.md). That schema is a draft grammar tool, not a production parser.

Use opaque filenames `objects/<generationId>.wpp.json`. Provider object IDs are authoritative for cloud lookup; filenames alone may not be unique on all services. Enumerate all matching candidates and authenticate them, handling pagination. No mutable `latest` file or timestamp is trusted as the sole index. Providers without compare-and-swap retain immutable catalog forks, which the client unions by verified references and presents as conflicts where needed.

Tombstones do not immediately delete historical ciphertext. Retention deletion requires a reviewed set of live roots/catalogs, grace period, and verified remaining copies. Initial releases leave automatic garbage collection disabled.

## Root and independent recovery record

The secret root record contains exactly `{format: "wpp-root-record", version: 1, revisionId, parents, vaultId, vaultSalt, catalogScopeId, catalogRecordId, epochs}`. `revisionId` is a fresh random 32-byte base64url identifier; `parents` is a duplicate-free array of at most two lowercase SHA-256 digests of previous canonical root records, empty at creation. Each epoch has exactly `{rootEpoch, secretRoot, createdAt, status}`; `secretRoot` is 32-byte base64url, and status is `active` or `retired`. IDs/salt follow the corresponding header lengths; catalog scope and record IDs are 32 bytes. Parse strict UTF-8/JCS-compatible JSON, reject duplicate/unknown fields, reject invalid encodings/UTC timestamps, enforce a 64 KiB record limit and 256-epoch limit, require unique epoch IDs and exactly one active epoch. A missing or ambiguous active epoch is an error, not a default choice. Preserve records inside a Bitwarden encrypted secure note; they are never public bootstrap contents.

The initial catalog receipt profile records epoch rotations only. Metadata-only root edits, same-active-epoch administration, and reconciliation without rotation are unsupported until a later reviewed profile. `retainedOldEpochs` has at most 255 identifiers so the new active epoch can still fit the root-record maximum of 256 epochs. Actual old and new membership in the root record is a semantic check.

Before a rotation, re-read the selected immutable vault item UUID and compare its canonical digest with the known parent. Write and read back the new revision, and persist an encrypted immutable root-update receipt in the catalog under both retained-old and new active epochs before using the new root for ordinary writes. The receipt records parent/current root-record digests and epoch IDs, never root secrets. It records the update. It is not a transactional compare-and-swap and not a freshness proof. Device state and independent recovery copies retain the last observed revision. Conflicting revisions require explicit reconciliation that retains all needed decryption epochs. The CLI does not establish a transactional compare-and-swap across devices. A read-back alone cannot prove that another device will not overwrite the note. Serialize root administration operationally and detect visible forks/rollback by comparing receipts. A total-loss restore from a single rolled-back source cannot establish the latest root revision and must report unknown freshness. Never discard an unknown epoch's ciphertext as corrupt merely because an older note lacks its key. This receipt workflow is specified, not implemented.

An independent recovery pack encrypts the entire root record under a fresh random 32-byte recovery key using AES-256-GCM. Its authenticated JCS header is exactly `{format: "wpp-recovery-pack", version: 1, suite: "A256GCM", nonce}`; nonce is a fresh 12-byte random value, and wire fields are `header`, `ciphertext`, `tag` with the same encoding rules. Plaintext is JCS(root record), maximum 64 KiB. A pack uses a new key and nonce on every creation and is immutable. The recovery key is delivered separately using a checked export/print workflow. Password-based recovery encryption is not part of v0.1.

Possessing a root record or its decrypted recovery pack grants its hierarchy. Possessing only the encrypted pack is insufficient. Losing both Bitwarden access and the separate recovery key loses root access. Losing every copy of a witness loses that witness even when the root survives.
