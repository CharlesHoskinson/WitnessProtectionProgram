# Local envelope kernel

Status: authored TypeScript kernel candidate. Candidate `61be5ab` passed host checks. Final independent acceptance is pending. This kernel is not security-approved. A successful `sealSnapshot` is not remote durability. A successful `openSnapshot` is authenticated local data. It is not activation, restore, or backup.

The public API lives in `src/kernel/index.ts`. Tests import the compiled module from `dist/kernel/index.js`. Internal `deriveKeys` lives in `src/kernel/crypto.ts` and is not re-exported.

## Public API

`UnlockedVault.fromRootRecord(rootUtf8, codecs)` parses a root record and returns an unlocked handle. `UnlockedVault.fromRecoveryPack(wire, recoveryKey, codecs)` authenticates an independent recovery pack first. Both methods require an explicit `CodecPolicy` list. Unknown codec identifiers fail closed. Duplicate policy identifiers fail closed. The native identifier `midnight-js-private-state-export` is unsupported in this slice.

`sealSnapshot({scopeId, recordId, payloadUtf8})` encrypts one snapshot payload. The method copies `scopeId`, `recordId`, and the payload byte reference at entry. Later mutation of the input object does not change the sealed identifiers. The kernel generates a fresh generation identifier and nonce on every call. Retry the exact returned bytes. Do not call `sealSnapshot` again as a retry.

`openSnapshot(wire, expected)` authenticates the package and parses the payload. It copies `expected` into an owned binding snapshot. It compares that snapshot to authenticated metadata before it calls the codec. Null `genesisHash` or `codeHash` is recorded. It is not compatible activation evidence.

`createRecoveryPack()` encrypts the canonical root record under a fresh 32-byte key. The caller owns the returned key and must export it through a later checked workflow.

`lock()` zeros owned secret buffers and drops policy references. Further seal, open, and recovery operations fail with `WPP_LOCKED`. The method is idempotent. If a codec validator calls `lock()` during `sealSnapshot` or `openSnapshot`, that current call fails with `WPP_LOCKED`. The call does not return ciphertext or plaintext. Finalizers still zero derived keys.

Returned buffers are caller-owned copies. The kernel does not export root bytes, object keys, or an RNG override.

## Codecs

A `CodecPolicy` is trusted application code with `{id, validate}`. `validate` is synchronous and read-only. It must return `undefined`. It receives isolated frozen JSON copies. It must not mutate authenticated bytes or returned results. A Promise or thenable return fails with `WPP_CODEC`. Validator exceptions become the static code `WPP_CODEC`. Public errors do not echo payload bytes or validator messages.

The registry stores a snapshot of `{id, validate}` at registration. Later changes to the caller policy object do not replace the registered callback. The kernel never decodes functions from backup bytes. Full codec version, package, and source pins live on `ExpectedSnapshot` and snapshot metadata. They do not live only on the registry identifier.

Trusted callbacks cannot be sandboxed. Accidental async return still fails closed.

## Limits

Raw input ceilings apply before JSON decode. A public byte input that is not a `Uint8Array` fails with `WPP_SCHEMA` before length or hash checks. Node `Buffer` is accepted. Canonical snapshot plaintext must stay at or under 16 MiB after JCS. The sealed wire must stay at or under 24 MiB before return. Open hashes a package only after the raw 24 MiB ceiling.

| Input | Ceiling |
| --- | --- |
| Witness package | 24 MiB |
| Snapshot plaintext | 16 MiB |
| Root record | 64 KiB |
| Recovery wire | 96 KiB |

The 4 KiB header ceiling and the 64 KiB metadata ceiling apply to the UTF-8 bytes of the JCS encoding of those objects. Container depth is at most 32. Duplicate decoded object keys fail. BOM, invalid UTF-8, comments, trailing commas, trailing tokens, lone surrogates, and nonfinite numbers fail. High, low, unpaired middle, and terminal surrogates fail with `WPP_JSON_SURROGATE` before codec invocation. Valid surrogate pairs are accepted.

## Schemas

The kernel loads JSON Schema files from `docs/reference/schemas/` using a path relative to `import.meta.url`. Deployments must ship those files next to the compiled `dist/kernel` layout. Snapshot metadata uses `urn:wpp:catalog-v1#/$defs/metadata`. The kernel does not resolve remote schemas.

Ajv runs with `strict: true` and `strictTypes: false`. `strictTypes: false` only disables a compiler diagnostic on referenced `maxLength`. Data type checks stay active. Registered `date-time` formats reject impossible UTC timestamps such as `2026-13-45T00:00:00Z` with `WPP_SCHEMA`.

## Cryptography

Derivation follows the draft profile. `PRK = HMAC-SHA256(vaultSalt, secretRoot)`. Child keys use one HMAC-SHA256 expand block with info `|| 0x01`. AES-256-GCM uses a 12-byte nonce, a 16-byte tag, and AAD equal to the canonical header. Authenticated snapshot plaintext must equal the JCS encoding of the parsed payload.

This kernel uses Node `crypto`. It does not implement AES in application code.

## Lock honesty

JavaScript strings are immutable. Parser copies, previously returned plaintext, and other code in the same process cannot be erased with certainty. Lock zeros owned secret buffers in this handle. It does not make the process secret-free.

## Remaining work

Journal persistence, catalog reconciliation, native staging, Bitwarden export UX, and cloud adapters are later slices. This kernel does not claim those behaviors.
