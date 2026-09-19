# Reopen a local ciphertext journal

Use this procedure on a Linux development checkout with Node 24 or later and
an ext-family workspace filesystem. Use synthetic data only. Do not feed live
witnesses, recovery keys, or root records from a production vault.

This procedure persists sealed package bytes, reopens the journal in a new
process, and authenticates the same snapshot with the local kernel. It does
not upload bytes. It does not mark a backup verified. It does not activate
Midnight private state.

## Build

From the repository root, compile the kernel and journal:

```bash
npm run build
```

That command runs `tsc -p tsconfig.json` and writes `dist/kernel/` and
`dist/journal/`.

## Persist, reopen, and decrypt

Create a private parent directory on the admitted filesystem. Do not use
`/tmp` when it is tmpfs. The journal creates only the leaf directory.

The script below seals one synthetic snapshot, stores it, opens a new journal
handle, reads the same digest, and authenticates the payload. Replace the
root, codec, and binding with the synthetic objects from
`tests/journal.test.mjs` or `docs/how-to/validate-local-package.md`.

```javascript
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { CiphertextJournal } from './dist/journal/index.js';
import { UnlockedVault } from './dist/kernel/index.js';

const parent = await mkdtemp(join(process.cwd(), 'wpp-journal-example-'));
const directory = join(parent, 'journal');
const vault = UnlockedVault.fromRootRecord(rootUtf8, [codec]);
try {
  const sealed = vault.sealSnapshot({ scopeId, recordId, payloadUtf8 });
  const journal = await CiphertextJournal.open(directory);
  const stored = await journal.put({ wire: sealed.wire, sha256: sealed.sha256 });
  if (stored.status !== 'local-durable') {
    throw new Error('unexpected status');
  }

  const reopened = await CiphertextJournal.open(directory);
  const names = await reopened.list();
  const wire = await reopened.get(stored.sha256);
  const opened = vault.openSnapshot(wire, expected);
  if (opened.packageSha256 !== stored.sha256) {
    throw new Error('digest mismatch');
  }
  if (names.length !== 1 || names[0] !== stored.sha256) {
    throw new Error('list mismatch');
  }
} finally {
  vault.lock();
}
```

`put` copies the wire bytes before it awaits. Later mutation of `sealed.wire`
must not change the stored object. `get` returns a caller-owned copy.

To retry after an `IO` error, pass the same `wire` and `sha256` to `put`
again. Do not call `sealSnapshot` for that retry. If the original seal never
became durable and you start a new snapshot, the kernel uses new randomness.

## Read failures

The journal throws `JournalError` with a static `code` such as
`INVALID_INPUT`, `NOT_FOUND`, `INTEGRITY`, `IO`, or
`UNSUPPORTED_FILESYSTEM`. The message is the code. The message does not
include paths or payload bytes.

A structurally valid file is not kernel authentication. Call
`openSnapshot` on an unlocked vault before you trust the payload.

Wrong filesystem types fail closed. A successful local fsync is not cloud
durability.

## Remaining work

Encrypted catalogs, upload observations, Bitwarden, and Google Drive are not
part of this procedure. Do not treat `list()` as a completed upload queue.
