# Implementation roadmap

M0 remains open. This tree has a draft interchange profile, synthetic package vectors, a draft catalog JSON Schema, synthetic catalog examples, and grammar tests. Candidate local encoding, decoding, recovery-pack and ciphertext-journal code now exists. Native interop, the Drive adapter, the one-click application and cryptographic approval remain open. Later milestones remain planned. Production handling of private witnesses requires all applicable release criteria.

## Storage augmentation — experiment-backed direction

The [storage-layout experiment](experiments/storage-layout/README.md) compares a flat encrypted catalog with 64 immutable encrypted shards and an optional pack layout. In the synthetic 10,000-record workload, median ciphertext rewritten per single-record update was 2,995,039 bytes for the flat catalog and 63,067 bytes for shards, including root updates. Three trials of 20 updates restored equal logical catalogs. Sharding increases cold restore reads from 1 to 65 modeled object reads; packing reduced the sharded case to 2. These are local counters, not measured Google Drive performance.

Adopt bounded encrypted catalog shards and exact reuse of unchanged ciphertext as the next M1 storage design. Pilot packs in M3 only after actual Drive upload, range-read and recovery measurements. Fixed 64 buckets is experimental; production needs byte-based splitting. The [design explanation](docs/explanation/storage-layout.md) records the tradeoffs, authenticated cache rule and reproducibility commands. This augmentation does not complete any milestone or change the encryption suite.

## M0 — Freeze an interoperable format

Review the package grammar, secret hierarchy, native Midnight export adapter, root record, independent recovery pack and maximum sizes. Resolve SDK version compatibility against the pinned repositories. Publish synthetic examples and independently generated vectors before freezing a wire version. A draft catalog schema and synthetic catalog fixtures exist as grammar tools. They are not a freeze, a parser, or cryptographic approval. A review of this draft is not cryptographic approval.

Define closed, versioned catalog-root and shard manifests, and a separately reviewed pack-extent extension if adopted. Bind scope, record identity, version, byte lengths and ciphertext hashes. Preserve native export fields without reinterpretation.

Exit evidence: two independent encoders agree on header bytes, HKDF Expand inputs, native export passwords, ciphertext/tag layout, and successful/failed decode cases. Confirm the package format can move between storage locations unchanged.

## M1 — Local encryption and restore core

Use established cryptographic implementations. Do not implement AES manually. Establish a registry for private-state codecs and conservative input bounds.

This tree authors a candidate trusted local envelope kernel in `src/kernel/` and a local ciphertext journal in `src/journal/`. The kernel seals and opens snapshot packages, validates input, registers explicit codecs, creates independent recovery packs, and locks owned secret buffers. The journal persists exact sealed wire bytes on an admitted Linux ext-family directory, reopens them after process exit, and returns `local-durable` only after file and directory fsync. This candidate has an unresolved journal input-validation review finding and is not accepted for production.

Build and test results are candidate-specific evidence, not production security acceptance. This tree does not claim a complete M1. It does not claim catalog reconciliation, native capture, Drive, Bitwarden, or cryptographic approval. Do not treat a successful local seal or journal fsync as remote durability. Do not treat a successful open as activation or restore.

Remaining M1 work is still required:

- reject noncanonical ciphertext encoding before journal publication (open review finding; local durability alone is not package validity)
- catalog semantic reconciliation, immutable revision heads, preserved concurrent heads and a rebuildable local index
- bounded encrypted catalog shards with byte-based splitting and exact reuse of unchanged encrypted nodes
- authenticated root-to-shard references, missing/corrupt child rejection, cold reconstruction and malformed-manifest tests
- encrypted upload-observation queue and remote verification
- isolated native staging, capture, and provider locks
- BigInt/bytes preservation through a real native adapter

Exit evidence: round trips and adversarial tests; wrong account/network/contract rejection; BigInt/bytes preserved by native serialization; crash-safe ciphertext persistence; no plaintext in journal, logs or adapter inputs; partial import leaves the live provider unchanged.

## M2 — Bitwarden recovery and independent recovery pack

Implement the supported CLI bridge for the desktop companion, with one explicitly selected secure note and no master-password-derived WPP seed. Record and test the CLI version and all session handling. Implement fresh-device root recovery and lock/revoke behavior. Preserve independently retained checkpoint evidence where available; successful authentication of recovered state does not prove it is the latest state. Report unknown freshness when no independent comparison is possible. Add the optional organizational Secrets Manager provider separately, if needed.

Exit evidence: real test-vault creation/read-back/unlock/lock; account or item mismatch rejection; no secrets in process arguments or diagnostic output; no whole-vault export; successful recovery without old device state, both with Bitwarden and with the separate recovery pack. Internal SDK licensing/support remains an explicit dependency decision if embedding is later proposed.

## M3 — One-click login and first cloud backup

Beta scope confirmed 2026-09-19: **Google Drive first**. Use the [Google Drive beta guide](docs/google-drive-beta.md) and [official documentation collection](research/google-drive/README.md). Microsoft, Dropbox, and Apple login/registration move to the corresponding M4 integrations.

Register the publisher-owned Google application and implement appropriate official branding for sign-in or Drive authorization. Use supported native/browser flows, platform callback handling and minimum storage permissions. End users must never need developer credentials, manual tokens, or app registration. One click opens the system browser for Google authorization; Google may still require account selection, consent, or MFA. The app handles the callback, PKCE authorization-code exchange and token lifecycle automatically. The test-blob workflow must use this same browser flow; do not require users to copy access tokens. Publisher OAuth registration is a release/setup prerequisite, not an end-user step. Configure an External audience for ordinary consumer Google accounts; a publisher-managed test-user list is only a temporary development restriction. Retail release requires the production publishing/verification steps and a successful fresh-account test without Cloud Console signup, developer credentials, CLI commands or token copying.

Current Google beta progress (2026-09-19):

- [x] Publisher project created and Drive API enabled; Desktop OAuth client registered.
- [x] Candidate browser OAuth and synthetic encrypted upload/read-back probe implemented in the Google beta worktree.
- [x] Candidate `ccdcd0e` passes independent local checks: 113 Node tests, 140 catalog schema tests and the Sphinx build.
- [x] Astra medium and Fable 5.1 low accepted the corrected developer probe at `ccdcd0e`.
- [x] Integrate the approved Google candidate into this campaign.
- [x] Browser consent and a live Google Drive upload, download and authenticated decrypt succeeded: 1,469 synthetic encrypted bytes, SHA-256 `326488920835d8ec8160296121a67e821b5f3de2ffed929a4c1b7c5d0c917c7c`, candidate `ccdcd0e` (2026-09-19).
- [ ] Visible-folder discovery, immutable catalog publication, reconnect and fresh-device restore are implemented and tested.
- [ ] Retail publishing requirements and a fresh consumer-account test are complete.

These checks describe the developer probe. They do not complete M3 or establish production security approval.

Complete Google Drive backup first, with visible-folder discovery and immutable catalogs. Start with immutable encrypted objects. Verify referenced remote objects before publishing a catalog revision; keep exact-byte journal retries and encrypt remote observations. Treat Drive changes cursors and custom properties as discovery hints, not authenticated authority. Pilot packs only after real upload, range-read, read-back, missing-object and fresh-device recovery tests establish their value and costs. Define user-facing connected, locked, uploading, verified, reconnect and incomplete states. Provider login never unlocks the WPP root by itself.

Exit evidence: new/existing-session sign-in, account selection, MFA, denied consent, callback forgery/replay, wrong audience/issuer, token expiry/revocation, account switch, reconnect and explicit unlink tests. Complete encrypted upload/read-back/restore with app-created and user-selected files, duplicate filenames, pagination and quota failures. No account auto-merge by email.

## M4 — OneDrive, Dropbox, iCloud and portable export

Register publisher-owned Microsoft, Dropbox, and Apple applications and implement their login flows as these providers are added after the Google Drive beta. Implement each adapter against the same ciphertext contract and declare actual capabilities. For Apple, pair Sign in with Apple with native iCloud Drive folder authorization; supply encrypted export/import on unsupported platforms. Do not use private iCloud APIs or imply that Apple sign-in grants Drive permission.

Exit evidence: real provider-account tests for write/read/list/reconnect and fresh-device restore; destination move; cloud token reacquisition; revoked permission, partial upload and quota; iCloud placeholder/offline/upload-pending scenarios. Show local-only/degraded status where remote verification is unavailable. Test import by a second wallet/client ID using explicitly granted file access.

## M5 — Automatic Midnight private-state capture

Integrate a real example application and the pinned native provider. Preserve native encrypted exports as opaque whole records. Catalog sharding does not split witness semantics or introduce plaintext deduplication. Protect irreplaceable pre-operation inputs and successor private state with separately identified lifecycle records. Gate applicable operations on the required durable backups. Register explicit codecs for retained witness data; exclude transient proving material by default.

Exit evidence: application-consistent snapshots; prepared/submitted/confirmed/failed/orphaned handling; restored state can run the application's next valid operation in a disposable test environment; old or wrong-account state cannot silently activate; independent-device conflicts are preserved; loss of index or provider copies reports incomplete protection.

## M6 — Passport integration and production review

Entry blocker: a released, version-pinned Passport API must supply authorized capture, kernel-owned secret handling and ciphertext storage/sync operations. The inspected planning/beta repositories do not establish that availability. Until this predicate is met, the adapter stays unimplemented and WPP makes no Passport restore or grant/ceremony compatibility claim; the standalone product can progress independently.

Implement against released/reviewed kernel and storage interfaces. Keep root access and encryption within the trusted kernel, integrate Passport ceremonies/grants, and send only ciphertext to storage adapters. Preserve account recovery boundaries and mandatory redundancy for irreplaceable state.

Exit evidence: integration tests on the actual Passport path, authorized dApp capture and denied unauthorized export, fresh-device restore with account recovery separately satisfied, independent security review, supply-chain/license inventory, measured UX and resource limits, and a rehearsed disaster-recovery procedure. Native adapter installation and provider developer review are publisher release tasks, not consumer setup steps.

## Deferred features

Large-file streaming/chunking; password-derived recovery packs; selective subtree sharing; automated retention deletion; multi-writer semantic merging; background iCloud backup on unsupported platforms; direct embedded Bitwarden SDK; on-chain freshness anchors. Convergent deduplication, plaintext content-defined chunking, server-side searchable encryption, ORAM and erasure coding also remain outside the beta critical path. Automated deletion requires reachability across every retained and unresolved head and explicit handling of missing-provider evidence. Each needs its own format/security review. Initial implementations reject unsupported cases instead of degrading silently.
