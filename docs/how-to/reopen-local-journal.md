# Reopen a local ciphertext journal

Use this procedure on a Linux development checkout with Node 24 or later and
an ext-family workspace filesystem. Use synthetic data only. Do not feed live
witnesses, recovery keys, or root records from a production vault.

This procedure persists sealed package bytes, reopens the journal in a new
process, and authenticates the same snapshot with the local kernel. It does
not upload bytes. It does not mark a backup verified. It does not activate
Midnight private state. It does not restore an application.

## Build

From the repository root, compile the kernel and journal:

```bash
npm run build
```

That command runs `tsc -p tsconfig.json` and writes `dist/kernel/` and
`dist/journal/`.

## Run the existing fresh-child authentication test

The runnable example is the existing Node test named
`fresh child reopen get, parent authenticates identical bytes`.
That test already supplies the synthetic root, codec, binding, and
assertions. Do not invent those values.

From the repository root, after the build, run:

```bash
node --test --test-name-pattern='fresh child reopen get, parent authenticates identical bytes' tests/journal.test.mjs
```

The test does this:

1. It builds a synthetic vector root and a `wpp.synthetic-vector` codec.
2. It seals one snapshot whose payload includes the synthetic marker
   `WPP_TEST_SECRET_MARKER_c0ffee91`.
3. It stores the sealed wire with `CiphertextJournal.put`.
4. It forks `tests/helpers/journal-child.mjs` as a new process.
5. The child opens a new journal handle on the same directory, reads the
   digest, and calls `openSnapshot` with the same synthetic binding.
6. The parent then reads the digest again and authenticates it.

The test asserts all of these:

- The child exit code is `0`.
- The child receipt has `ok: true`, `authenticated: true`, and
  `markerOk: true`.
- `packageSha256` matches the stored digest.
- The parent `openSnapshot` result has the same digest and the same marker.
- The receipt and stderr do not contain the synthetic secret, account,
  or root bytes.

`put` copies the wire bytes before it awaits. Later mutation of
`sealed.wire` must not change the stored object. `get` returns a
caller-owned copy.

To retry after an `IO` error, pass the same `wire` and `sha256` to `put`
again. Do not call `sealSnapshot` for that retry. If the original seal never
became durable and you start a new snapshot, the kernel uses new randomness.

## API fragment

The following fragment is not a runnable script. It does not define `rootUtf8`,
`codec`, `scopeId`, `recordId`, `payloadUtf8`, or `expected`. Use the test
command above when you need a complete process.

```javascript
// Fragment only. The fresh-child test supplies every variable and spawns
// a new process.
const journal = await CiphertextJournal.open(directory);
const stored = await journal.put({ wire: sealed.wire, sha256: sealed.sha256 });
const reopened = await CiphertextJournal.open(directory);
const wire = await reopened.get(stored.sha256);
const opened = vault.openSnapshot(wire, expected);
```

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
