# WitnessProtectionProgram design

Date: 2026-09-13. Status: proposed design, prepared for review. Implementation has not started.

## Purpose and scope

Protect the irreplaceable private data used or produced by a Midnight application so a person can recover it on another device or compatible wallet. Use their Bitwarden account to protect recovery material and their existing cloud storage for encrypted backups. Start as an independent library and companion application; later integrate the encryption component into Passport's trusted kernel and the storage providers into its storage/sync seam.

“Witness” has several meanings. WPP distinguishes persistent application private state, explicitly retained application inputs/outputs, and transient proving material. The first is protected by default for an integrated application. The second requires an application codec and an explicit retention policy. The third is excluded by default. The chain and indexer cannot reconstruct arbitrary private inputs. A universal browser hook that silently collects every witness is outside scope.

The first implementation target is TypeScript with a Node desktop/CLI companion and Web Crypto primitives. This matches the inspected Midnight.js surface and permits browser reuse. A hardened native secret-handling component is a later option; JavaScript does not provide reliable memory zeroization. iCloud automatic integration needs a native platform bridge. These are design decisions, not implemented capabilities.

## Alternatives

| Approach | Benefit | Cost / reason for selection |
|---|---|---|
| **Bitwarden-protected recovery roots, local encryption, cloud ciphertext** | Ordinary personal vault; independent storage; deterministic key recovery; limited Bitwarden storage footprint | Selected. Root compromise exposes that root's hierarchy; requires careful local secret handling |
| Store every witness as a Bitwarden item or attachment | Fewer external storage components | Couples volume and recovery to the vault; poor fit for revision streams and the requested cloud portability |
| Fork/embed Bitwarden cryptographic internals as the wallet engine | Potentially deeper native integration | Internal interfaces and component licenses create maintenance constraints; not selected without an upstream-supported integration agreement |

Bitwarden is the recovery-root custodian. WPP performs payload encryption locally with established primitives. Calling a vault API is not an arbitrary remote encryption service. The optional Secrets Manager adapter serves organizational deployments and is separate from the personal Password Manager adapter.

## Components and trust boundaries

| Component | Responsibility | Inputs / outputs |
|---|---|---|
| Key provider | Unlock/protect root records, lock, rotate, export recovery material | Opaque vault reference; transient root handle; no witness payload |
| Key hierarchy | Domain-separated derivation of scope, record, and purpose keys | Root handle plus explicit canonical context; child handles |
| Capture adapter | Classify state and capture an application-consistent snapshot | Native provider or registered codec; typed snapshot |
| Package codec | Bound and authenticate format, metadata, and contents | Snapshot / encrypted portable object |
| Local journal | Persist ciphertext before acknowledging local protection; maintain immutable revisions and upload queue | Encrypted objects and encrypted index records |
| Storage adapter | Link an account and put/get/list immutable ciphertext objects | Ciphertext, opaque locators, provider receipts |
| Restore coordinator | Authenticate, check compatibility and freshness, stage, validate, activate | Candidate backup; explicit target context; restore result |
| Passport integration | Enforce account/grant ceremony and lifecycle inside the kernel | Authorized commands; ephemeral witness handles; ciphertext across storage seam |

The standalone companion is an explicit trusted process. A future Passport storage adapter never gains plaintext or raw root access. OAuth credentials stay in the device credential store and are reacquired after migration; they are not portable witness metadata.

## Key hierarchy: an HD wallet for symmetric keys

Generate a 32-byte root with the operating system CSPRNG. Also generate a public 32-byte vault salt, opaque vault identifier, and random root-epoch identifier. Protect a versioned record containing these values and the secret root in an encrypted Bitwarden secure note. Verify the created item by read-back in the setup ceremony before reporting setup complete. A fresh machine can recover from the note without the old machine's keystore.

Use HKDF-SHA-256 with explicit domain separation, as specified in [the package format](../../witness-package-format.md). This is a symmetric key hierarchy, not BIP-32: no extended public keys, elliptic curve derivation, wallet signing seed reuse, or derivation from public addresses. A scope key grants its entire subtree; an object key grants one revision. Neither is treated as a wallet signing credential.

Use opaque random scope identifiers for account/application/contract namespaces and keep their identity mapping encrypted. A new revision receives a fresh random generation identifier and a distinct encryption key. Different machines therefore do not depend on a shared counter for nonce safety. Generate a fresh 96-bit GCM nonce as well. Retries retransmit identical saved bytes; changed content always creates a new generation. Export/recovery and native-export-password keys use different purpose labels.

Account IDs, network IDs, contract address and code identity live in authenticated encrypted metadata and are checked against the expected restore target. Scope IDs provide key separation; they do not prove account ownership.

Rotation after a root compromise generates an independent random root epoch. Merely incrementing a path under the old root cannot exclude an attacker who has that root. Retain old epochs only for historical recovery, clearly label their exposure, and re-encrypt retained objects under the new root. Deleting an epoch can make old objects unrecoverable; it is never automatic.

## Bitwarden workflow

The initial desktop design uses the supported Password Manager CLI through a narrow subprocess adapter, pinned and integration-tested at implementation time. It reads or writes only a specifically selected WPP secure note. Secure-note content is the WPP root record, not a whole-vault export. Do not parse local Bitwarden database files or borrow the user's master password to derive WPP keys.

Unlock requires the user's normal Bitwarden ceremony. A bridge must keep secret input off command arguments and logs, keep session material in tightly scoped process state, redact failures, and lock on timeout. The CLI session has broader vault authority than one note; a narrow WPP adapter does not reduce the CLI token's privileges. This is an acknowledged first-release limitation and must be tested before a smooth browser/mobile integration is promised. An external CLI cannot simply be called by a web page.

Setup creates a separately exportable recovery record protected by a freshly generated 32-byte recovery key. Store the encrypted record and the recovery key separately, then rehearse restore. This route provides independence from Bitwarden availability. It does not recover absent ciphertext. Bitwarden emergency access can complement, but does not replace, a tested WPP recovery procedure.

## Capture and backup lifecycle

1. A compatible application supplies an immutable snapshot at a defined lifecycle point. Snapshot creation is serialized with private-state writes; a mutable global `setContractAddress` provider is never shared concurrently across scopes.
2. Capture pre-operation irreplaceable inputs before permitting the operation that would make their loss harmful. Capture successor private state separately after the application reports the corresponding state transition. Provider `set()` alone does not establish chain finality.
3. Serialize with the pinned native export adapter or a registered versioned codec. Include lifecycle status such as prepared, submitted, confirmed, failed, or orphaned as an application observation, with its evidence reference. Finality is established by the application's verified ledger observation, not WPP encryption.
4. Encrypt metadata and contents, persist the immutable ciphertext locally, then enqueue upload. Do not label transient memory or an unflushed write as saved.
5. Upload, retrieve the stored bytes, check the digest, and authenticate the envelope locally. Record the provider object/version identifier in the encrypted catalog. A successful provider read-back is an observed remote copy, not a promise of indefinite retention.
6. Publish an encrypted immutable index revision referencing object hashes and prior index heads. Keep known heads in device state. A backup is complete only when both its objects and its discovery index are remotely retrievable.

For irreplaceable state, full protection requires two independent recovery paths: a verified remote copy plus a separately kept export or second provider, together with recoverable keys. The UX explicitly shows a single-copy degraded state. An offline operation can retain local encrypted state, but cannot receive “Backup verified.” Passport's required durable-backup precondition stays in force for operations covered by that rule.

## Restore and portability

Unlock a WPP root from Bitwarden or the independent recovery pack. Reconnect the storage account, or select an exported package/folder. Discovery starts from the public bootstrap marker and encrypted catalog, not an old device's database or an expiring sharing URL. Catalog loss is recoverable by enumerating opaque objects and inspecting them after authentication; incomplete provider listing is an error.

Authenticate before interpreting private metadata. Check the schema, size limits, network, contract and code identity, account binding, codec version, and object ancestry. An old valid backup is not necessarily the latest backup: compare known authenticated index heads and independent copies. After total device loss, a malicious single provider can replay a complete old history; without an independent freshness anchor, report that freshness is unverified.

Stage import into a new isolated provider/database, validate state and application invariants, and activate atomically under a local lock. Preserve the existing active store for recovery. The native importer must not be assumed transactional; an exception after partial import is handled by discarding staging, not by leaving a partly modified live wallet. Default conflicts to error.

Moving between machines while retaining the same account is the primary portability target. Moving to another wallet is supported only if it implements the same package version and application codec. Moving to a different cryptographic account can invalidate commitments or credentials: require an explicit application migration/reissuance procedure. Backup restoration never changes an on-chain identity or grants authority to spend.

## Format and storage decisions

The new format is `wpp-witness-package`, a WPP draft. Embed native `midnight-private-state-export` containers without modifying their internal ciphertext or serialization. Pin the native producer version and full repository commit. The native exporter currently authenticates its own payload metadata, while WPP adds network/account/contract binding outside that native container but inside the WPP authenticated plaintext. Other retained witness data needs an application codec; arbitrary JavaScript values are not portable JSON.

Keep names, account identifiers, wallet addresses, contract details, transaction references, state IDs, tags, provider credentials, and plaintext hashes out of the public header and filenames. Public fields are bounded version/algorithm identifiers and random key-routing values. See [format](../../witness-package-format.md) and [integrations](../../integrations.md) for details.

Use a visible Google Drive folder selected/created with narrow file access rather than an app-private hidden store as the only copy. Hidden app data is tied to the application and cannot serve as the sole cross-wallet discovery mechanism. OneDrive and Dropbox app folders are convenient defaults but similarly need explicit file export/import for migration to another client ID. Use provider object IDs and revisions internally, with expiring tokens reacquired on restore.

## Errors, validation, and release conditions

Typed errors distinguish locked vault, revoked storage access, quota, network interruption, incomplete backup, incompatible codec, authentication failure, wrong restore target, conflict, and unknown freshness. Authentication failures do not reveal which secret-dependent check failed. Unknown format versions fail closed. Bounded parsing occurs before expensive crypto or native deserialization.

The [roadmap](../../../ROADMAP.md) requires real round trips through Bitwarden and each storage adapter; cross-runtime crypto vectors; authenticated-metadata tampering and wrong-key rejection; crash and partial-import tests; provider pagination and revocation tests; concurrent revisions; recovery after device loss; and versioned native Midnight interoperability. No result has been observed yet. Independent cryptographic and restore-system review precedes production witness handling.

## Design review disposition

Self-review checked purpose separation, root-versus-data recovery, native format preservation, provider discovery, account migration, concurrent revision safety, restore staging, and Passport's ciphertext boundary. The roadmap carries explicit remaining experiments. This document is a proposal for the user's review, not approval or a security audit.
