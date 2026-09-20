# Run a sharded backup and cold restore

Use this procedure on a development checkout with Node 24 or later.
Use synthetic records only.
Do not feed live witnesses, recovery keys, or root records from a production vault.

This procedure uses `GoogleBackupCoordinator` with `UnlockedVault`,
`CiphertextJournal`, and `GoogleDriveSession`.
A verified local journal write is not remote durability.
A successful `openSnapshot` is not native activation.

## Build

From the repository root, compile:

```bash
npm run build
```

That command writes `dist/backup/`, `dist/kernel/`, `dist/journal/`, and `dist/google/`.

## Run the local integration tests

Automated tests inject Drive HTTP at the existing adapter seam.
They do not open a Google session.
They do not read live credentials.

```bash
npm test
```

That command compiles TypeScript and runs `node --test tests/*.test.mjs`.
`tests/backup-restore.test.mjs` and `tests/backup-faults.test.mjs` cover the coordinator.

The tests check all of these:

- multiple synthetic publishes with unchanged witness ciphertext reuse
- unchanged and second publish authenticate each retained live witness
- five unchanged updates that do not grow observations
- missing, swapped, truncated, and corrupted objects
- correctly hashed ciphertext with an invalid AEAD tag
- mismatched snapshot metadata or header claims before a root POST
- an extra unused `requiredEpochs` value when the root epoch is already known
- wrong account binding
- lock during witness upload, child readback, and root readback
- an over-budget root that performs no child GET
- tombstoned missing targets allowed, live missing targets rejected
- a cold child process restore with no parent journal

## Run the synthetic CLI help

The live command is `scripts/google-sharded-roundtrip.mjs`.
Do not run it from `npm test`.
Print the flags first:

```bash
node scripts/google-sharded-roundtrip.mjs --help
```

The command requires `--client-file` and `--state-dir`.
Both paths must stay outside this repository.
The command validates the mode and the path set before Google authorization.
`--cold-restore` is valid only with `--mode restore`.
The state directory holds recovery material, a local journal, and a checkpoint
with mode `0600`.
`new-vault` refuses existing recovery, key, checkpoint, last-package, or journal
artifacts.
It creates recovery and key files with exclusive create.
It does not overwrite those files.

## Live Google round trip

Complete publisher setup first. See [Create a Google Cloud project](create-google-project.md).
Place the Desktop OAuth client JSON outside this repository.

```bash
node scripts/google-sharded-roundtrip.mjs \
  --client-file /absolute/path/outside-repo/client.json \
  --state-dir /absolute/path/outside-repo/wpp-state \
  --mode new-vault
```

The command starts `authorizeInstalledApp` PKCE.
It opens the system browser.
Grant `drive.file` only.
Do not paste an access token.

On success the command prints `connected`, then `verified`.
The verified line includes the root digest and reserved adapter-call budget.
It also prints measured Drive HTTP figures.
Reserved adapter calls are coordinator ceilings.
They are not HTTP measurements.
`driveHttpRequests` counts completed Drive HTTP calls.
`multipartBodyBytes` counts multipart request-body bytes.
`ciphertextPartBytes` counts the ciphertext part of that multipart body.
`ciphertextMediaBytes` counts media bytes returned for ciphertext GET calls.
OAuth token exchange bytes are not Drive ciphertext measurements.
JSON About and listing response bytes are not ciphertext measurements.
Attempted figures stay distinct when a call does not return.
`putOwnedCiphertext` includes POST and readback.
Local fixture tests do not prove ordinary retail UI or live provider acceptance.

Reopen the same state directory:

```bash
node scripts/google-sharded-roundtrip.mjs \
  --client-file /absolute/path/outside-repo/client.json \
  --state-dir /absolute/path/outside-repo/wpp-state \
  --mode selected-checkpoint
```

Restore in a new process:

```bash
node scripts/google-sharded-roundtrip.mjs \
  --client-file /absolute/path/outside-repo/client.json \
  --state-dir /absolute/path/outside-repo/wpp-state \
  --mode restore \
  --cold-restore
```

`--cold-restore` forks a child before Google authorization.
The parent does not authorize.
The parent does not open the vault, the journal, or a memory index.
The child performs one installed-app browser consent and the restore.
`--package-sha256` must match the stored last-package binding and content digest.
The command does not reuse a different last-package expectation.
Restore reports `contentDigestMatch` as `true` or `false`.
It does not print witness plaintext.

## Failures

Public results are `verified` or `incomplete`.
Incomplete reasons are static.
They do not include tokens, roots, or raw provider errors.
A lock during an in-flight upload cannot retract a completed object.
It does prevent root publication and checkpoint advancement.
Orphan ciphertext is not deleted.
