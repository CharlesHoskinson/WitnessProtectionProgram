---
orphan: true
---

# Google Drive bounded restore transport

Status: implemented candidate restore transport on 2026-09-19. This page
describes `getOwnedCiphertext` and `listCiphertextCandidates`. It does not
complete Google Drive beta restore. It does not prove remote durability.

These APIs reuse an owned `GoogleDriveSession` and the existing bounded HTTP
machinery. They add no OAuth flow and no new runtime dependency.

Public direct session construction is a trusted injection seam.
`new GoogleDriveSession`, `bindGoogleDriveSession`, and
`createGoogleDriveAdapter` take a caller-supplied identity and transport.
They do not query Drive About. An arbitrary supplied client does not have
provider-verified identity.

`createGoogleDriveAdapterFromAuthClient` and `authorizeInstalledApp` bind a
session only after About returns a matching `permissionId`.
`queryBoundPermissionId` is that About check. It requires a finite integer
2xx status.

Injected request tests are fixtures. They are not live Google evidence.

## getOwnedCiphertext

`getOwnedCiphertext(session, expected)` returns a receipt with `fileId`,
`sha256`, `byteCount`, and a nonenumerable `ownedReadback` buffer.

`expected` must contain `permissionId`, `fileId`, `sha256`, and `byteCount`.
The transport copies and validates every field before it waits on the network.

Validation rules:

- The session must be a real bound `GoogleDriveSession`.
- Account comparison uses the verified identity stored in private session
  internals. The public `permissionId` field is a nonwritable getter. Callers
  cannot rebind the account by assignment.
- `permissionId` must equal that private bound identity.
- `sha256` must be a canonical lowercase 64-hex digest.
- `fileId` must match the existing Drive file-id grammar.
- `byteCount` must be a safe positive integer at most `LIMIT_PACKAGE_BYTES`.
- Locator getters and other caller exceptions become `GOOGLE_DRIVE_INPUT`.
  Public errors are fresh static codes. Original exception identity is not
  preserved.

The only request is `GET` to the existing Google origin
`/drive/v3/files/{encodedId}?alt=media`. The transport does not create a file
when the object is missing or the read fails. It does not follow redirects.
It does not accept a caller-supplied URL. It does not silently bind another
account.

The streaming byte bound equals the expected length. If `Content-Length` is
present, it must match that length. The actual body length and the full-wire
SHA-256 must also match. Mismatches fail with static redacted codes such as
`GOOGLE_DRIVE_READBACK` and `GOOGLE_DRIVE_REDIRECT`.

The receipt is hash and read-back integrity only. It is not AEAD
authentication. It is not a durability or freshness proof. The caller must
open the owned bytes in the WPP kernel against a trusted catalog reference.

Mutation of `expected` or of the options object after construction does not
change the copied GET bindings or the captured request client.

`queryBoundPermissionId` captures the auth-client request with intrinsic
`Function` bind. It does not read a caller-controlled `bind` property. The
entire public boundary maps throwing getters, revoked proxies, and other
caller exceptions to a fresh static code. Original exception identity is not
preserved.

AuthClient media and injected response bodies share one bounded copy
contract. The transport reads intrinsic `ArrayBuffer` or typed-array length
before it allocates. It then copies into a new ordinary `Buffer`. It does
not use caller `byteLength` getters, `Symbol.species`, or caller
constructors. Default Gaxios bodies are `ArrayBuffer` or
`Uint8Array`/`Buffer`. Subclass lies, changing getters, detached buffers,
and revoked proxies are rejected. Hash checks, expected-byte checks, and the
returned receipt describe those owned bytes only.

## listCiphertextCandidates

`listCiphertextCandidates(session)` is a bounded `files.list` transport. It
discovers app-visible, non-trashed `.wpp` filenames. It yields untrusted file
candidates `{ fileId, name, byteCount }`. Those candidates are not catalog
heads. They are not authenticated locators.

The request is always GET to the existing Google files collection. The query,
fields, and page size are fixed:

- query: `trashed = false and name contains '.wpp'`
- fields: `nextPageToken,incompleteSearch,files(id,name,size)`
- `pageSize`: 100

Bounds:

- maximum 100 pages
- maximum 100 files per page. A longer `files` array is a page failure.
- maximum 10,000 unique items
- maximum 1 MiB JSON per page, stream-bounded
- page tokens longer than 4096 characters are rejected
- `incompleteSearch` must be absent or a boolean. Any other value is incomplete.

Name grammar for a retained candidate is `lowercase64hex.wpp`. Unrelated
string filenames are ignored. A missing name or a non-string name is malformed
page data. A matching `.wpp` name with a malformed id, name, or size makes the
listing incomplete. Repeated `fileId` values collapse only when name and size
agree. Conflicting metadata makes the listing incomplete.

Pagination is complete only when `nextPageToken` is absent. A null token, an
empty string, a function, a symbol, or any other type is incomplete.

The transport captures one owned null-prototype JSON object. That same object
is the byte-budget source and the consumed page. It does not serialize the
original caller value. It does not parse a second representation.

It rejects every Proxy, including a revoked Proxy, with the non-trapping
native `util.types.isProxy` check before it inspects the value. For ordinary
objects it captures each property descriptor once, validates that descriptor,
and uses the captured value. It does not execute accessors. It does not call
caller `toJSON` or other serializers. Accessors, functions, symbols, BigInt,
cycles, custom `toJSON`, proxies, and other non-JSON objects make the page
incomplete.

A non-enumerable or inherited `files`, `incompleteSearch`, or
`nextPageToken` field is a rejection. It is not a silent omission. An own
`__proto__` data property stays an ordinary member. It does not become the
clone prototype and it does not supply inherited completion fields.

Unknown JSON fields may remain for sizing. String and key sizes use
incremental escaped UTF-8 JSON accounting and stop at the remaining budget.
The transport does not allocate a full escaped string to learn that a value
exceeds 1 MiB. The exact UTF-8 size of the owned JSON must stay at or under
1 MiB.

The transport never follows an arbitrary URL from the response. It detects
repeated `nextPageToken` values as cycles. `incompleteSearch: true`, a page
or request failure, a later-page 3xx, a missing next page, and a count, byte,
or page ceiling all return `{ complete: false, reason, candidates }`. Already
collected candidates are preserved on every later-page failure.

The transport identifies the first page by page index, not by candidate count.
A first-page 3xx still fails as `GOOGLE_DRIVE_REDIRECT`. An empty first page
with a continuation token and a later 3xx returns `complete: false`. A partial
listing is never `complete: true`.

`complete: true` means only that provider pagination finished and every
accepted response was valid. It does not prove global freshness. It does not
prove a unique catalog head.

This API does not create, delete, adopt, or classify roots. It has no automatic
retry framework. Reason codes are static. Provider bodies and page tokens are
not copied into errors or results.

## Non-claims

A successful GET hash match is not kernel authentication.

A complete candidate list is not a restore.

These functions do not measure live Google Drive behavior.

The default Node transport bound is Gaxios 7.3.1 with node-fetch 3.3.2.
`maxContentLength` maps to node-fetch `size`. An oversized stream is aborted
during consumption. This restore work does not replace that default fetch path.
