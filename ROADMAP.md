# Implementation roadmap

Every milestone below is **planned, not implemented**. The launch delivers a reviewable design and source evidence. Production handling of private witnesses requires all applicable release criteria.

## M0 — Freeze an interoperable format

Review the package grammar, secret hierarchy, native Midnight export adapter, root record, independent recovery pack and maximum sizes. Resolve SDK version compatibility against the pinned repositories. Publish synthetic examples and independently generated vectors before freezing a wire version. A review of this draft is not cryptographic approval.

Exit evidence: two independent encoders agree on header bytes, HKDF Expand inputs, native export passwords, ciphertext/tag layout, and successful/failed decode cases. Confirm the package format can move between storage locations unchanged.

## M1 — Local encryption and restore core

Implement a small TypeScript kernel, synthetic key provider, package parser, encrypted local journal, isolated staging restore and explicit lock semantics. Use established cryptographic implementations; do not implement AES manually. Establish a registry for private-state codecs and conservative input bounds.

Exit evidence: round trips and adversarial tests; wrong account/network/contract rejection; BigInt/bytes preserved by native serialization; crash-safe ciphertext persistence; no plaintext in journal, logs or adapter inputs; partial import leaves the live provider unchanged.

## M2 — Bitwarden recovery and independent recovery pack

Implement the supported CLI bridge for the desktop companion, with one explicitly selected secure note and no master-password-derived WPP seed. Record and test the CLI version and all session handling. Implement fresh-device root recovery and lock/revoke behavior. Add the optional organizational Secrets Manager provider separately, if needed.

Exit evidence: real test-vault creation/read-back/unlock/lock; account or item mismatch rejection; no secrets in process arguments or diagnostic output; no whole-vault export; successful recovery without old device state, both with Bitwarden and with the separate recovery pack. Internal SDK licensing/support remains an explicit dependency decision if embedding is later proposed.

## M3 — One-click login and first cloud backup

Register publisher-owned Google, Microsoft, Dropbox, and Apple applications and implement the official branded sign-in buttons. Use supported native/browser flows, platform callback handling and minimum storage permissions. End users must never need developer credentials, manual tokens, or app registration.

Complete Google Drive backup first, with visible-folder discovery and immutable catalogs. Define user-facing connected, locked, uploading, verified, reconnect and incomplete states. Provider login never unlocks the WPP root by itself.

Exit evidence: new/existing-session sign-in, account selection, MFA, denied consent, callback forgery/replay, wrong audience/issuer, token expiry/revocation, account switch, reconnect and explicit unlink tests. Complete encrypted upload/read-back/restore with app-created and user-selected files, duplicate filenames, pagination and quota failures. No account auto-merge by email.

## M4 — OneDrive, Dropbox, iCloud and portable export

Implement each adapter against the same ciphertext contract and declare actual capabilities. For Apple, pair Sign in with Apple with native iCloud Drive folder authorization; supply encrypted export/import on unsupported platforms. Do not use private iCloud APIs or imply that Apple sign-in grants Drive permission.

Exit evidence: real provider-account tests for write/read/list/reconnect and fresh-device restore; destination move; cloud token reacquisition; revoked permission, partial upload and quota; iCloud placeholder/offline/upload-pending scenarios. Show local-only/degraded status where remote verification is unavailable. Test import by a second wallet/client ID using explicitly granted file access.

## M5 — Automatic Midnight private-state capture

Integrate a real example application and the pinned native provider. Protect irreplaceable pre-operation inputs and successor private state with separately identified lifecycle records. Gate applicable operations on the required durable backups. Register explicit codecs for retained witness data; exclude transient proving material by default.

Exit evidence: application-consistent snapshots; prepared/submitted/confirmed/failed/orphaned handling; restored state can run the application's next valid operation in a disposable test environment; old or wrong-account state cannot silently activate; independent-device conflicts are preserved; loss of index or provider copies reports incomplete protection.

## M6 — Passport integration and production review

Entry blocker: a released, version-pinned Passport API must supply authorized capture, kernel-owned secret handling and ciphertext storage/sync operations. The inspected planning/beta repositories do not establish that availability. Until this predicate is met, the adapter stays unimplemented and WPP makes no Passport restore or grant/ceremony compatibility claim; the standalone product can progress independently.

Implement against released/reviewed kernel and storage interfaces. Keep root access and encryption within the trusted kernel, integrate Passport ceremonies/grants, and send only ciphertext to storage adapters. Preserve account recovery boundaries and mandatory redundancy for irreplaceable state.

Exit evidence: integration tests on the actual Passport path, authorized dApp capture and denied unauthorized export, fresh-device restore with account recovery separately satisfied, independent security review, supply-chain/license inventory, measured UX and resource limits, and a rehearsed disaster-recovery procedure. Native adapter installation and provider developer review are publisher release tasks, not consumer setup steps.

## Deferred features

Large-file streaming/chunking; password-derived recovery packs; selective subtree sharing; automated retention deletion; multi-writer semantic merging; background iCloud backup on unsupported platforms; direct embedded Bitwarden SDK; on-chain freshness anchors. Each needs its own format/security review. Initial implementations reject unsupported cases instead of degrading silently.
