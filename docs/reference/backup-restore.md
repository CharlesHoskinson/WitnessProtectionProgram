# Sharded backup and restore coordinator

Status: authored TypeScript coordinator candidate.
This page describes the implemented `src/backup/` API.
It does not close M0 through M6.
It does not establish production security approval.
It does not activate Midnight private state.

The public API lives in `src/backup/index.ts`.
Tests import the compiled module from `dist/backup/index.js`.
The coordinator uses the accepted `UnlockedVault`, `CiphertextJournal`, and
`GoogleDriveSession` objects.
It does not implement a second encryption path.

## Public types

`BackupCheckpoint` is a closed version 1 record:

```text
{
  format: "wpp-backup-checkpoint",
  version: 1,
  root: {
    wireSha256,
    wireByteLength,
    locator
  }
}
```

The locator is the catalog-v2 Google locator.
The checkpoint stores no root key, no recovery key, no token, and no plaintext
catalog.
`parseBackupCheckpoint` rejects a Proxy before any inspection.
It accepts only an ordinary object or a null-prototype object.
It reads own data descriptors for the closed key set once.
It does not execute accessors, caller methods, or unknown-property clones.
It builds a fresh frozen record from checked primitive fields.
A digest is exactly 64 lowercase hex characters.
Permission, object, and revision strings are at most 128 characters.
Those strings must match their alphabets through the true end of the value.
`wireByteLength` is an integer from 1 through `rootWireBytes`.
`readBackupCheckpointFile` opens a nonblocking descriptor.
It rejects a non-regular file before it reads.
It reads at most 16 KiB plus one byte, then closes the descriptor.
Empty and oversized files fail as integrity errors.
Filesystem errors stay redacted.
`writeBackupCheckpointFile` writes canonical JSON with mode `0600` and an
atomic rename.
Do not store checkpoint JSON in `CiphertextJournal`.
The journal grammar admits only sealed packages.

## Constructor

`new GoogleBackupCoordinator({vault, session, journal, mode, checkpointPath, deadlineMs})`
takes owned dependencies.
`mode` is explicit:

- `{kind: "new-vault"}` starts with no parent root.
- `{kind: "selected-checkpoint", checkpoint}` authenticates that root.

The constructor does not infer new-vault from an empty provider listing.
Publication requires a journal.
Cold restore does not.
`GoogleBackupCoordinator.restoreSnapshot({vault, session, checkpoint, packageSha256, expected})`
opens no journal.
The synthetic CLI reads checkpoints through `readBackupCheckpointFile`.
It bounds recovery-pack and last-package reads to the existing format ceilings.
`--cold-restore` forks before `authorizeInstalledApp`.
The parent does not load the vault, the journal, or a memory index.
`new-vault` refuses existing recovery, key, checkpoint, last-package, or journal
artifacts and uses exclusive create for recovery files.
Publication stores a private expected-content digest next to the package binding.
Restore compares that digest with the authenticated returned content and reports
boolean equality only.

The instance serializes publication and restore.
Concurrent reentry returns `incomplete` with reason `concurrent-operation`.
Seal input, expected bindings, and checkpoints are copied before the first
await.

## Publication

`publishSnapshot(input)` seals one snapshot with the kernel.
It reconstructs parent records from the selected checkpoint when one exists.
It plans catalog-v2 shards with `planCatalogShards`.
It reuses a parent leaf only when the epoch and canonical records match.
Changed leaves receive a fresh `recordId`.
It journals each new sealed object, then calls `putOwnedCiphertext`.
That adapter call includes POST and media readback.
The coordinator then opens the readback with the kernel.
It records a first-creation observation only.
Routine verification of reused objects adds no observation.

Every retained live witness is fetched by locator and opened with
`UnlockedVault.openSnapshot`.
The expected binding is reconstructed from that witness's authenticated
catalog snapshot entry.
Caller claims cannot replace that kernel result.
The coordinator then compares every trusted package, header, and metadata
claim against that entry.
Hash-only GET readback is not authentication.
A missing epoch, unsupported codec, corrupted AEAD, or claim mismatch
returns `incomplete`.
The previous checkpoint stays unchanged.
The coordinator does not publish the next root.

Root parents are the explicit selected head.
Unresolved `liveRecordForks` block publication.
The coordinator does not pick a timestamp winner.

After the kernel authenticates the revision, `requiredEpochs` must be exact.
The required set is the union of these values:

- the authenticated root-header epoch
- every authenticated nonempty shard-header epoch
- every retained snapshot package epoch

The storage validator may allow one extra reserved root-header epoch.
The coordinator closes that allowance once the kernel root header is known.
Inclusion is not enough.
The coordinator checks this equality on load and before it commits
publication.

A publish result advances the internal checkpoint only after root
authentication and any requested checkpoint persistence succeed.
`publishUnchanged` runs the same full live-witness authentication and does
not grow observations.

Preflight of the next catalog state runs before any remote upload of that
state.
Unsupported capacity preserves the previous checkpoint.
The new witness is `local-unsynced` and is not backed up.

## Restore

`restoreSnapshot(checkpoint, packageSha256, expected)` downloads the selected
root.
After the kernel authenticates that root, the coordinator runs
`preflightCatalogRoot` and unique-child checks.
It does not GET children when those checks fail.
It then downloads nonempty shards, validates the whole revision, and rebuilds
a memory index bound to the exact root digest.
The index is discarded on lock or root change.

The chosen live witness is fetched by its encrypted locator.
The kernel `openSnapshot` return is the only plaintext result.
The coordinator compares that opened witness with the catalog snapshot
entry and with the caller expected binding.
Native activation remains a separate staging gate.
A tombstoned historical target may be absent.
Tombstoned records stay in the catalog.
They do not require the target bytes to exist.
A missing live target fails.

## Budgets and lock

Before each adapter call the coordinator reserves upper bounds:

- `putOwnedCiphertext`: 2 adapter calls, upload length, and download length
- `getOwnedCiphertext`: 1 adapter call and the expected response length
- listing: 100 adapter calls and 100 MiB JSON

These reservations are not HTTP measurements.
The live CLI counts actual Drive HTTP calls separately from those reservations.
It counts multipart HTTP request-body bytes with that label.
It counts ciphertext part bytes sent to Drive as a separate figure.
It counts ciphertext media bytes received as a separate figure.
OAuth token-exchange bytes are excluded from ciphertext figures.
JSON About and listing response bytes are excluded from ciphertext figures.
Adapter call reservations are not treated as HTTP evidence.
Operation ceilings are 2 GiB uploaded plus downloaded, 50 000 reserved adapter
calls, and 30 minutes.
Exhaustion returns `incomplete`.
There is no automatic retry create after an unresolved create.

The coordinator rechecks `UnlockedVault.locked` after every await and before
root publication.
A lock cannot retract a completed upload.
It prevents later root publication, checkpoint advancement, and plaintext
results.
Orphan ciphertext is not deleted.

## Incomplete results

Public methods return a closed result.
`verified` carries a checkpoint and reserved-budget metrics.
`incomplete` carries a fixed reason and the previous checkpoint.
Reasons include `locked`, `capacity`, `wrong-account`, `missing-object`,
`corrupt-object`, `child-preflight-failed`, `provider-incomplete`, and
`concurrent-operation`.
Public results do not include raw Error messages.

## Package and live-witness bounds

The 24 MiB ceiling is the maximum size of one witness package.
Kernel, journal, and Google `putOwnedCiphertext` copy that package.
The 512 MiB catalog-v2 ceiling is the sum of current live witness wire
bytes.
Those bounds are distinct.
They are not an inherited incompatibility.
This coordinator still cannot upload one witness above 24 MiB.
Listing, create, and media timeouts stay in the Google adapter.
This package does not change that adapter.

Retail Google publishing, native capture, Bitwarden recovery, and
cryptographic approval remain open.
M0 through M6 remain open.
