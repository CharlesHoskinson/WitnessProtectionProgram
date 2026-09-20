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
`parseBackupCheckpoint` copies and freezes the record.
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
Routine readback of reused objects adds no observation.

Root parents are the explicit selected head.
Unresolved `liveRecordForks` block publication.
The coordinator does not pick a timestamp winner.

A publish result advances the internal checkpoint only after root
authentication and any requested checkpoint persistence succeed.
`publishUnchanged` authenticates current live objects and does not grow
observations.

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
Native activation remains a separate staging gate.
A tombstoned historical target may be absent.
A missing live target fails.

## Budgets and lock

Before each adapter call the coordinator reserves upper bounds:

- `putOwnedCiphertext`: 2 adapter calls, upload length, and download length
- `getOwnedCiphertext`: 1 adapter call and the expected response length
- listing: 100 adapter calls and 100 MiB JSON

These reservations are not HTTP measurements.
The live CLI counts AuthClient `request` calls separately.
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

## Inherited limits

The Google adapter and local journal copy packages with the kernel 24 MiB wire
ceiling.
Catalog-v2 declares a 512 MiB live-witness sum.
This coordinator cannot upload a witness above the inherited 24 MiB package
ceiling.
Listing, create, and media timeouts stay in the Google adapter.
This package does not change that adapter.

Retail Google publishing, native capture, Bitwarden recovery, and
cryptographic approval remain open.
M0 through M6 remain open.
