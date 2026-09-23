# Local ciphertext journal

Status: authored TypeScript journal candidate. This slice persists sealed
package bytes on an admitted Linux ext-family filesystem. It is not remote
durability. It is not catalog reconciliation. It is not a completed upload
queue. Independent review is still required.

The public API lives in `src/journal/index.ts`. Tests import the compiled
module from `dist/journal/index.js`. Internal filesystem helpers live in
`src/journal/fs.ts` and are not a consumer API. Do not use filesystem fault
hooks as application controls.

## Public API

`CiphertextJournal.open(directory)` validates a private Linux directory and
returns a handle. The trusted parent must already exist. `open` may create
the one journal leaf directory with mode `0700`. It does not create parent
directories. After it creates that leaf, it fsyncs the parent directory.

`put({wire, sha256})` copies bounded wire bytes before its first await. It
checks the supplied SHA-256 digest and the kernel package grammar on that
owned copy. The grammar includes the exact raw header `version` token. A
token such as `1.0000000000000001`, or a token longer than 64 characters, is
`INVALID_INPUT`. The call creates no durable record. Kinds `snapshot` and
`catalog` stay accepted. A catalog-node envelope uses kind `catalog`. The
journal then persists exact accepted bytes. A successful call returns
`{sha256, byteLength, status: "local-durable"}`. The status is not
`Backup verified`. Structural grammar and digest checks are not kernel
authentication.

`get(sha256)` returns an owned copy of the committed bytes after regular-file,
owner, mode, size, and digest checks. A missing record fails with `NOT_FOUND`.

`list()` returns sorted candidate ciphertext digests. It scans with `opendir`.
It fails with `INCOMPLETE` if the directory has more than 10 000 entries. It
does not silently truncate. Listing is discovery. It is not authentication.
It is not an atomic snapshot under concurrent insertion.

This slice has no `remove`, `prune`, or `markUploaded` method.

## Storage boundary

The journal accepts bounded encrypted WPP package wire bytes. It rejects root
records, recovery packs, plaintext payloads, and other non-package inputs as
`INVALID_INPUT`. Filenames are ciphertext SHA-256 digests. They are not
account identifiers and not plaintext hashes.

A structurally valid stored package is not an authenticated snapshot. An
unlocked kernel must open the bytes before use.

Every durable local record is recoverable pending work until a later catalog
observation proves a verified remote copy. This journal does not store
provider IDs, account bindings, lifecycle labels, or timestamps in plaintext
sidecars. A successful upload HTTP response is not a verified remote copy.

## Filesystem admission

The initial backend admits the Linux ext2/ext3/ext4 family. `statfs` type
`0xef53` identifies that family. It does not uniquely identify ext4. It does
not prove that storage hardware honors flushes.

Unsupported platforms fail with `UNSUPPORTED_PLATFORM`. tmpfs, network
filesystems, DrvFs, and other unreviewed types fail with
`UNSUPPORTED_FILESYSTEM`. The journal does not fall back to those filesystems.

The current host probe used for tests is `/home/charl` with type `0xef53` and
`/tmp` with type `0x1021994` (tmpfs). Describe the tested host as ext-family
unless mount metadata confirms ext4.

## Durable write protocol

`put` uses this order:

1. Create an exclusive owner-only temp file named `.wpp-tmp-<32-hex>`.
2. Write until every byte is accepted. Zero progress is an `IO` error.
3. fsync the temp file.
4. Publish with `link(temp, <64-hex>.wpp)`. Do not use overwriting rename.
5. Open the published name with `O_NOFOLLOW | O_NONBLOCK`. Verify regular
   file, owner, mode `0600`, exact bytes, and digest.
6. fsync the published file.
7. fsync the journal directory.
8. Return `local-durable`.

If `link` returns `EEXIST`, the caller is the loser. It still verifies the
existing target and still performs the file and directory durability
barriers. A matching immutable record is idempotent success only after that
verification. Different bytes, a symlink, or a non-regular target is
`INTEGRITY`. The journal never overwrites a committed name.

Cleanup unlinks only this invocation's temp name. It never unlinks a
published target to roll back a failure. A crash may leave an orphan temp.
`list` ignores the exact temp pattern and does not delete it.

## Retry after ambiguous failure

A failure before durable publication is not an acknowledgement. The published
target may still exist after an unacknowledged error. Retry the original
bytes and digest. Do not call `sealSnapshot` again for that retry. Fresh
encryption after an unpersisted failure uses new randomness because it is a
new seal, not a retry.

## Limits and identifiers

| Item | Bound |
| --- | --- |
| Package wire | 24 MiB |
| Directory entries in `list` | 10 000 |
| Committed name | `<64-lowercase-hex-sha256>.wpp` |
| Temp name | `.wpp-tmp-<32-lowercase-hex>` |
| Journal directory mode | `0700`, owner is the effective UID |
| Committed file mode | `0600`, owner is the effective UID |

The trusted parent may be owner-readable or owner-executable by others. It
must not be group-writable or other-writable. Existing wrong ownership,
permissions, a non-directory, or a leaf symlink fails closed. The journal
does not chmod preexisting data and does not recursively change ancestors.

Reads are bounded in the read loop. An earlier `stat` size is not the only
limit. Candidate opens use `O_NOFOLLOW` and `O_NONBLOCK` before `fstat` so a
FIFO cannot hang the process.

## Error codes

`JournalError` exposes a static `code` and message. The message does not
include filesystem paths, payload bytes, or raw syscall text.

| Code | Meaning |
| --- | --- |
| `INVALID_INPUT` | Bad digest, oversize or empty wire, hash mismatch, or non-package grammar |
| `UNSUPPORTED_PLATFORM` | Not Linux with POSIX owner checks |
| `UNSUPPORTED_FILESYSTEM` | Not the admitted ext-family `statfs` type |
| `UNSAFE_PATH` | Traversal, unsafe parent or leaf, wrong directory mode or owner |
| `INTEGRITY` | Existing committed data is corrupt, truncated, a symlink, or non-regular |
| `NOT_FOUND` | No committed object for that digest |
| `INCOMPLETE` | Directory scan exceeded the entry bound |
| `IO` | Write, fsync, or other filesystem failure before acknowledgement |

Schema or supplied-hash mismatch is `INVALID_INPUT`. Corrupt committed data
is `INTEGRITY`.

## Trust boundary

This API assumes the application-owned ancestor tree is not replaced by
hostile same-user code during the operation. Node does not give this slice
dirfd-level confinement of every ancestor.

The journal does not reject a link count greater than one. Concurrent
publication and crash-orphan temps can leave two names for one inode. A
hostile same-user process can also add hardlinks. That is a documented
limitation. It is not protection against a hostile process with the same
UID.

File fsync and directory fsync are tested on the admitted host. They do not
prove cloud durability. They do not prove behavior under physical power
loss. They do not prove that a disk firmware lie about flush completed.

## Remaining work

Catalog sealing, catalog reconciliation, native capture and staging, encrypted
upload observations, Bitwarden, and Google Drive remain later slices. Local
`list` discovery is not a completed coordinator. Do not mark a record uploaded
because an upload call returned success.
