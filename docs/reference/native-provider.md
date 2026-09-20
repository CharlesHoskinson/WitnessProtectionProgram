# Native capture provider

Status: authored TypeScript native integration candidate.
This slice is not a deployed application.
This slice is not M5 acceptance.
A successful capture is not remote durability.
A successful stage is not activation.

The public wrapper lives in `src/native/index.ts`.
Tests import the compiled module from `dist/native/index.js`.
Kernel methods live on `UnlockedVault` in `src/kernel/vault.ts`.

## Owned provider

`OwnedNativeProvider` constructs the pinned LevelDB provider.
The constructor requires `accountId`, `contractAddress`, `privateStoragePasswordProvider`, and an absolute `midnightDbName`.
The wrapper never accepts an externally mutable provider instance.
The wrapper never exposes the inner provider.
Account and contract values are immutable after construction.

All `set`, `get`, `remove`, export, import, and cache operations share one owned lock.
The lock is reentrant for the current operation chain.
Concurrent callers queue.
The wrapper does not call upstream `clear()`.
The wrapper does not call a nonexistent `close()`.

Typed `set` and `get` keep native SuperJSON semantics.
BigInt, `Uint8Array`, and `Buffer` values must survive a real export and import.

## Producer pin

The supported codec identifier is `midnight-js-private-state-export`.
The codec version is `1`.
The producer package is `@midnight-ntwrk/midnight-js-level-private-state-provider`.
The producer version is `5.0.0-beta.8`.
The source commit is `98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f`.

That commit is the supported upstream release-source pin.
It is not proven npm build provenance.
`npm` `gitHead` and build-source attestation are absent.
A later criterion that needs attested build source is not satisfied by this mapping.

The lockfile records registry integrity for the provider tarball
`sha512-vQFMuLuwtQBAbK0JsKtT+RFUK1HPZ21TTwyS7Z07G0QjKoJusCRzdrDWJQAcev+deRN89YT9yLBzernLQs2vBA==`.
Install with `npm install --ignore-scripts` only.
The actual shipped LevelDB bindings load through `level` 10 and `classic-level` 3.
SuperJSON resolves to `2.2.6`.

## Capture

`UnlockedVault.captureNativeSnapshot(input)` returns `Promise<SealResult>`.
Input is `{provider, scopeId, recordId, metadataUtf8, expectedStateIds, signal?}`.
Root keys, generation selection, and the export password stay inside the kernel.
There is no password export method.
The caller cannot supply a generation.

The kernel holds the source lock for the whole capture.
It checks codec pins, account binding against `provider.accountId`, and contract address against the fixed contract.
`expectedStateIds` must be unique and exactly `metadata.privateStateIds`.
Upstream has no ID-list API.

The kernel chooses a fresh generation and nonce.
It derives `nativeExportPassword = base64url(K_native)` without prefix, suffix, or truncation.
Pinned `validatePassword` returns `undefined` on success.
A typed `PasswordValidationError` retries with a fresh unpublished generation and nonce.
The retry bound is 16.
Unexpected validator errors fail closed.

The kernel then calls actual `exportPrivateStates` with `maxStates` equal to the expected count.
It preserves the three native fields `format`, `encryptedPayload`, and `salt` byte for character.
It does not JSON-encode native typed state manually.

It then constructs a new isolated LevelDB staging provider on a fresh temporary directory.
Import uses `conflictStrategy: 'error'`.
Imported count must be exact.
Skipped and overwritten counts must be zero.
Each expected identifier must read back.
Capture then encrypts the outer package with the same selected generation.
It never calls `sealSnapshot`, which would generate a new generation.

The internal staging directory is always destroyed before return.
Capture evidence is transient.
Durable encrypted receipt storage needs an explicit journal schema.

## Stage

`UnlockedVault.stageNativeSnapshot(wire, expected, options)` authenticates an existing package.
It derives the native password from the authenticated header.
It imports into a new private temporary staging provider.
It never imports into a live provider.
It never renames over live storage.
It never claims activation.

Options supply matching native account, contract, storage-password provider, and `expectedStateIds`.
An optional trusted `validateState` callback may inspect restored values.
Application codec callbacks are not native envelope validation.

Account, network, contract, and codec expectations are checked before native import.
Wrong bindings fail closed.
A failed stage destroys the temporary directory after in-flight work drains.
A successful handle supports `get`, `drain`, and `dispose`.
The handle remains owned until explicit disposal.
The handle is plaintext-capable local state.

A fresh process can stage from a recovery pack plus wire and expected binding.
The child must not receive the old provider, files, or index.

## Lock and drain

`lock()` revokes immediately and increments the operation token.
Every await boundary and the encrypt or return path rechecks token, lock, binding, and abort.
Uncancellable upstream calls may finish.
Their results cannot be published.

`drain()` waits for pending cleanup.
There is no unhandled background work from the kernel.
JavaScript strings are immutable.
Provider-held passwords and upstream caches cannot be guaranteed erased.

## Synchronous kernel boundary

`sealSnapshot` still rejects caller-supplied native exports with `WPP_UNSUPPORTED`.
`openSnapshot` still rejects the native codec identifier.
Native packages use `stageNativeSnapshot`.
Existing application snapshot, catalog-v1, and catalog-v2 behavior stays unchanged.

## Limits of this slice

This slice does not prove Midnight transaction correctness.
It does not prove a deployed-contract restore.
It does not prove cloud durability.
It does not prove production security.
Temporary directories must live outside the repository and must be removed after drain.
