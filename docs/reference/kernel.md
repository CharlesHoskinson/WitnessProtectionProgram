# Local envelope kernel

Status: authored TypeScript kernel candidate. Build checks and review receipts apply to their exact candidate commits; they do not establish production acceptance. This kernel is not security-approved. A successful `sealSnapshot` is not remote durability. A successful `openSnapshot` is authenticated local data. It is not activation, restore, or backup.

The public API lives in `src/kernel/index.ts`. Tests import the compiled module from `dist/kernel/index.js`. Internal `deriveKeys` lives in `src/kernel/crypto.ts` and is not re-exported.

## Public API

`UnlockedVault.fromRootRecord(rootUtf8, codecs)` parses a root record and returns an unlocked handle. `UnlockedVault.fromRecoveryPack(wire, recoveryKey, codecs)` authenticates an independent recovery pack first. Both methods require an explicit `CodecPolicy` list. Unknown codec identifiers fail closed. Duplicate policy identifiers fail closed. The native identifier `midnight-js-private-state-export` is unsupported in this slice.

`sealSnapshot({scopeId, recordId, payloadUtf8})` encrypts one snapshot payload. The method copies `scopeId`, `recordId`, and the payload byte reference at entry. Later mutation of the input object does not change the sealed identifiers. The kernel generates a fresh generation identifier and nonce on every call. Retry the exact returned bytes. Do not call `sealSnapshot` again as a retry.

`openSnapshot(wire, expected)` authenticates the package and parses the payload. It copies caller package bytes into an owned buffer before hash and parse. It uses that same owned copy for both steps. It copies `expected` into an owned binding snapshot. It compares that snapshot to authenticated metadata before it calls the codec.

`sealCatalog(payloadUtf8)` encrypts one catalog-v1 payload. The method copies the payload bytes at entry. It validates the payload with the accepted catalog semantic parser. It then JCS-encodes the normalized catalog.

The header uses the root record `catalogScopeId` and `catalogRecordId`. The caller cannot supply other catalog identifiers. The header `kind` is `catalog`. The method uses the active epoch, a fresh generation identifier, and a fresh nonce. Key derivation, AEAD, and header JCS match snapshot sealing.

`openCatalog(wire)` authenticates a catalog-v1 package and returns `{header, catalog, packageSha256}`. The header `kind` must be `catalog`. The unlocked vault identifier, vault salt, and epoch must match. The header scope and record identifiers must match the owned root catalog identifiers. A v2 root or shard payload cannot satisfy this v1 API.

`sealCatalogNode(payloadUtf8)` encrypts one catalog-v2 root or shard. The method copies the payload bytes at entry. It infers the role only after it parses a closed v2 node. It accepts no caller-controlled header, key, or scope. A root uses the owned root-record `catalogScopeId` and `catalogRecordId`. A changed shard receives a fresh random `recordId`, `generationId`, and nonce. Envelope `kind` remains `catalog`. Key derivation matches the catalog object purpose already used by `sealCatalog`. Root plaintext must stay at or under 4 MiB. Root wire must stay at or under 8 MiB. Shard plaintext must stay at or under 1 MiB. Shard wire must stay at or under 2 MiB. The outer 24 MiB package ceiling is unchanged. A root `requiredEpochs` list must include the active header epoch. Multi-record shards above the 256 KiB split target fail.

`openCatalogNode(wire, expected)` authenticates one selected catalog-v2 node and returns `{header, node, packageSha256}`. It copies and validates the complete expected object before it copies wire bytes. A root expectation is `{nodeType:'root', wireSha256, wireByteLength}` for the caller-selected complete wire. A shard expectation is `{nodeType:'shard', reference}` where `reference` is a closed nonempty child reference from an authenticated selected root. Empty references are not valid shard expectations.

The expected copy is field-specific. It is not a generic recursive clone. The method rejects a proxy, including a revoked proxy, with native `util.types.isProxy` before it inspects the object. It requires `Object.getPrototypeOf(value)` to be exactly `Object.prototype` or `null` before it enumerates keys. Ordinary objects with those prototypes are accepted. It then checks own key count and membership against a fixed permitted shape before it captures descriptors. A root expectation accepts one of the fixed 2-key or 3-key shapes from the owned `nodeType` discriminant. A nonempty reference has 12 fields. A locator has 4 fields. A binding has 2 fields. The method does not call `Object.getOwnPropertyDescriptors` on unbounded input. It captures descriptors only for the small validated key set, once per property. It rejects accessors without invoking them. It rejects symbols, nonenumerable extra members, functions, and inherited required properties. It does not traverse unknown-field subtrees.

A nonempty reference has a fixed known field set. The `locators` array length must be 1 to 4 before any element is read. Each locator is copied by the closed Google locator grammar, including nested `accountBinding`. Duplicate locators fail. Digest strings are 64 lowercase hex characters. Prefix strings are 0 to 64 lowercase hex characters.

Both digest and prefix use a true end of input. String lengths are bounded before ID decoding. Caller-origin expected failures stay static `WPP_SCHEMA`. They do not echo raw diagnostics.

The method checks the exact full-wire digest and length before it parses. It then checks header vault, salt, catalog scope, record, generation, and epoch fields. After AEAD it requires raw JCS equality and the closed v2 role grammar. Wrong role, a v1 catalog presented as v2, and a swapped child fail before records return. A missing referenced epoch stays `WPP_EPOCH`. It is not relabeled as bad ciphertext. Retired referenced epochs remain readable. Returned node objects are owned copies. They cannot mutate vault state.

The kernel authenticates the AEAD payload before it parses catalog plaintext. It checks that the authenticated bytes equal the JCS encoding of the raw parsed JSON. That check runs before semantic normalization. Catalog-v1 open may still normalize set-like arrays after that check. Catalog-v2 open requires the closed sorted grammar.

The returned v1 catalog is the semantically normalized object. Snapshot open rejects catalog envelopes. Catalog open rejects snapshot envelopes. Catalog-v2 open rejects snapshot envelopes.

Null `genesisHash` or `codeHash` is recorded. It is not compatible activation evidence. A `SharedArrayBuffer` copy is not an atomic snapshot. Any accepted hash and content still come from the same owned buffer.

`createRecoveryPack()` encrypts the canonical root record under a fresh 32-byte key. The caller owns the returned key and must export it through a later checked workflow.

`lock()` zeros owned secret buffers and drops policy references. Further seal, open, recovery, and catalog operations fail with `WPP_LOCKED`. Catalog-v2 `sealCatalogNode` and `openCatalogNode` also fail after lock. The method is idempotent. If a codec validator calls `lock()` during `sealSnapshot` or `openSnapshot`, that current call fails with `WPP_LOCKED`. The call does not return ciphertext or plaintext. Finalizers still zero derived keys.

Returned buffers are caller-owned copies. The kernel does not export root bytes, object keys, or an RNG override.

## Codecs

A `CodecPolicy` is trusted application code with `{id, validate}`. `validate` is synchronous and read-only. It must return `undefined`. It receives isolated frozen JSON copies. It must not mutate authenticated bytes or returned results. A Promise or thenable return fails with `WPP_CODEC`. Validator exceptions become the static code `WPP_CODEC`. Public errors do not echo payload bytes or validator messages.

The registry stores a snapshot of `{id, validate}` at registration. Later changes to the caller policy object do not replace the registered callback. The kernel never decodes functions from backup bytes. Full codec version, package, and source pins live on `ExpectedSnapshot` and snapshot metadata. They do not live only on the registry identifier.

Trusted callbacks cannot be sandboxed. Accidental async return still fails closed.

## Limits

Raw input ceilings apply before JSON decode. A public byte input that is not a native `Uint8Array` fails with `WPP_SCHEMA` before length or hash checks. The kernel uses a non-trapping native brand check. It does not run `instanceof` or caller prototype traps. Node `Buffer` and `Uint8Array` subclasses are accepted. Proxies and detached buffers fail with `WPP_SCHEMA`.

Open reads the intrinsic typed-array length. It checks the ceiling before it allocates. It then copies into a plain owned buffer. It does not trust subclass size or copy methods for that bound.

Canonical snapshot plaintext must stay at or under 16 MiB after JCS. The sealed wire must stay at or under 24 MiB before return. Open hashes a package only after that owned copy.

| Input | Ceiling |
| --- | --- |
| Witness package | 24 MiB |
| Snapshot plaintext | 16 MiB |
| Catalog-v1 plaintext | 16 MiB |
| Catalog-v2 root plaintext | 4 MiB |
| Catalog-v2 root wire | 8 MiB |
| Catalog-v2 shard plaintext | 1 MiB |
| Catalog-v2 shard wire | 2 MiB |
| Root record | 64 KiB |
| Recovery wire | 96 KiB |

The 4 KiB header ceiling and the 64 KiB metadata ceiling apply to the UTF-8 bytes of the JCS encoding of those objects. Container depth is at most 32. Duplicate decoded object keys fail. BOM, invalid UTF-8, comments, trailing commas, trailing tokens, lone surrogates, and nonfinite numbers fail. High, low, unpaired middle, and terminal surrogates fail with `WPP_JSON_SURROGATE` before codec invocation. Valid surrogate pairs are accepted.

## Schemas

The kernel loads JSON Schema files from `docs/reference/schemas/` using a path relative to `import.meta.url`. Deployments must ship those files next to the compiled `dist/kernel` layout. Snapshot metadata uses `urn:wpp:catalog-v1#/$defs/metadata`. The kernel does not resolve remote schemas.

Ajv runs with `strict: true` and `strictTypes: false`. `strictTypes: false` only disables a compiler diagnostic on referenced `maxLength`. Data type checks stay active. Registered `date-time` formats reject impossible UTC timestamps such as `2026-13-45T00:00:00Z` with `WPP_SCHEMA`.

## Cryptography

Derivation follows the draft profile. `PRK = HMAC-SHA256(vaultSalt, secretRoot)`. Child keys use one HMAC-SHA256 expand block with info `|| 0x01`. AES-256-GCM uses a 12-byte nonce, a 16-byte tag, and AAD equal to the canonical header. Authenticated snapshot plaintext must equal the JCS encoding of the parsed payload. Authenticated catalog-v1 plaintext must equal the JCS encoding of the raw parsed JSON before catalog normalization. Authenticated catalog-v2 plaintext must equal the JCS encoding of the parsed root or shard object.

This kernel uses Node `crypto`. It does not implement AES in application code.

## Lock honesty

JavaScript strings are immutable. Parser copies, previously returned plaintext, and other code in the same process cannot be erased with certainty. Lock zeros owned secret buffers in this handle. It does not make the process secret-free.

## Remaining work

Catalog-v2 node seal and open authenticate one selected root or shard. They do not complete journal publication, Drive reconstruction, or a full backup. Unchanged-ciphertext reuse is a coordinator choice that keeps exact sealed bytes. This kernel does not reseal all leaves after epoch rotation. Native staging, Bitwarden export UX, and cloud adapters also remain later. This kernel does not claim those behaviors. A local journal candidate exists in this tree. It is not a completed M1.
