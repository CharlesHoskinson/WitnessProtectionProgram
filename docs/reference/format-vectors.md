# Format vectors (synthetic M0)

Status: M0 primitive and byte-layout fixture evidence. This page does not record a complete M0 milestone. It does not freeze the wire format, approve general JCS, approve production cryptography, or claim Midnight native export compatibility.

See the draft interchange profile in [witness-package-format](../witness-package-format.md).

## Generator

`scripts/format-vectors.mjs` is a restricted Node 24 fixture encoder. It uses built-in `node:crypto` only. It is not a production package parser.

Exports:

- `canonicalFixture(value)` returns a compact canonical JSON string for the restricted domain below.
- `hkdfExpand32(parentKeyBuffer, infoBuffer)` returns one RFC 5869 HKDF-Expand block of 32 bytes. The parent key must be a 32-byte `Buffer`. The call is `HMAC-SHA256(parent, info || 0x01)`. Child levels must not call `hkdfSync`, because that Extract step would run again.
- `buildVector()` returns the deterministic synthetic vector object.

CLI:

```bash
node scripts/format-vectors.mjs
```

That command writes pretty JSON for `buildVector()` and one trailing newline to stdout. Import of the module must not write stdout or files. The module does not write the fixture to disk by itself.

## Canonicalization restriction

`canonicalFixture` accepts only:

- printable ASCII strings and object keys (`U+0020` through `U+007E`)
- booleans
- `null`
- safe integers except negative zero
- dense arrays, in original order, with no custom enumerable non-index properties and no symbol keys
- plain objects whose prototype is `Object.prototype`, with own enumerable string keys sorted recursively in ASCII lexicographic order

The encoder assembles JSON text. It does not clone values into an object and then call `JSON.stringify`. Integer-looking keys keep lexicographic order, so `"10"` sorts before `"2"`. The key `__proto__` stays an ordinary member.

The encoder rejects non-ASCII and control strings or keys, unsafe, fractional, and nonfinite numbers, negative zero, `undefined`, symbol values, symbol keys, function, `Buffer`, `Date`, sparse arrays, custom enumerable non-index array properties, `Object.create(null)`, and other non-plain objects. It does not drop unsupported values. Node `canonicalFixture` does not apply a nesting cap.

All fixed fixture values in this generator stay in that domain. Encoding there agrees with JCS. The encoder is not a general RFC 8785 implementation. The Python `canonical_fixture` function accepts the printable ASCII, boolean, null, safe-integer, plain-list, and plain-dict part of this domain. It rejects values outside that part. It also rejects nesting deeper than 32 levels. JavaScript-only values such as `Buffer`, sparse arrays, and symbols have no Python counterpart in this fixture. The Node generator domain is wider because it has no 32-level cap. The published synthetic vector nests fewer than 32 levels, so both encoders encode it. The Python cap matches the draft nesting ceiling. It does not mean the Node generator enforces that ceiling.

## Deterministic public synthetic inputs

Do not use these keys, salts, or identities in a real application.

`bytes(start, length)` is the byte sequence `start` through `start + length - 1`.

| Input | Construction |
| --- | --- |
| `secretRoot` | `bytes(0, 32)` |
| `vaultSalt` | `bytes(32, 32)` |
| `vaultId` | `bytes(64, 16)` |
| `rootEpoch` | `bytes(80, 16)` |
| `scopeId` | `bytes(96, 32)` |
| `recordId` | `bytes(128, 32)` |
| `generationId` | `bytes(160, 32)` |
| `nonce` | `bytes(192, 12)` |

Public binary header fields use canonical unpadded base64url. Payload metadata is a proposed WPP fixture illustration. It is not a frozen catalog schema and not a native Midnight export. The all-zero `sourceCommit` and the synthetic identities are fictional.

## Expected fixture fields

`buildVector()` returns this shape:

```text
{
  profile: 'wpp-draft-v1-synthetic-vector',
  inputs: { secretRootHex, header, payload },
  expected: {
    prkHex, scopeKeyHex, objectKeyHex, nativeKeyHex, nativeExportPassword,
    headerUtf8, headerHex, payloadUtf8, payloadHex,
    ciphertextHex, tagHex, wireUtf8, wireSha256
  }
}
```

Hex fields are lowercase. UTF-8 fields are the literal canonical strings. Runtime timestamps and randomness are not used.

Derivation matches the draft profile: Extract `PRK` from `vaultSalt` and `secretRoot`, Expand `K_scope` from `PRK`, then Expand `K_object` and `K_native` from `K_scope`. AES-256-GCM uses `K_object`, the 12-byte nonce, and AAD equal to UTF-8 `canonicalFixture(header)`.

## Node commands

Host checks and fixture regeneration, when the verification host runs them:

```bash
node --test tests/format-vectors.test.mjs
node scripts/format-vectors.mjs > fixtures/wpp-v1-vectors.json
```

This page does not record results of those commands. Same-implementation self-consistency is not independent interoperability evidence.

## Python encoder

`scripts/format-vectors-python.py` is a second encoder and decoder for this public synthetic vector. It is not a production package parser. Agreement with the Node fixture is one M0 interoperability slice for this vector only.

The module uses the Python standard library for JSON, HMAC-SHA-256, SHA-256, and base64url. AES-256-GCM uses the pinned `cryptography==46.0.5` `AESGCM` class. Child HKDF steps are Expand only: `HMAC-SHA256(parent, info || 0x01)`. `build_vector()` does not call Node, import the Node generator, or read `fixtures/wpp-v1-vectors.json`. `build_vector()` emits canonical wire bytes. `wireSha256` is SHA-256 over those exact emitted UTF-8 bytes. Accepting an equivalent outer encoding does not change the emitted wire or that hash.

Exports:

- `canonical_fixture(value)` returns compact canonical JSON for the restricted domain above, including the 32-level nesting cap.
- `hkdf_expand32(parent_key, info)` returns one 32-byte HKDF-Expand block. `parent_key` must be 32 bytes.
- `build_vector()` returns the deterministic synthetic vector object.
- `decode_wire(secret_root, wire_bytes)` parses one closed draft wire. `secret_root` is 32 bytes. `wire_bytes` is UTF-8 JSON. The 24 MiB raw wire ceiling is checked before JSON parsing. A wire of exactly 25,165,824 bytes is accepted. One additional byte is rejected before JSON parsing. Insignificant whitespace, reordered outer members, and a trailing newline are accepted when the JSON stays strict and closed. Duplicate keys, invalid UTF-8, malformed encodings, and unknown fields are rejected. The decoder checks field names, literal values, identifier lengths, and canonical base64url. It derives keys from the header fields. A header `version` token parses to the integer 1 only when its exact decimal value is 1 and the token has at most 64 characters. `1`, `1.0`, `1e0`, and `10e-1` are accepted examples. `1.0000000000000001` and `0.99999999999999999` are rejected. The AES-GCM additional authenticated data is the canonical header byte string, which contains the token `1`. It is not the exact outer wire text. Nonfinite numbers are rejected. Integers outside `-9007199254740991` through `9007199254740991` are rejected. Boolean `true` is rejected as a version. A numeric token longer than 64 characters is rejected before `Decimal` or a large `int` is constructed. The public `decode_wire` path applies that limit. A patched decimal constructor is not called. `build_vector()` still emits the token `1`. Ciphertext text longer than 22,369,622 characters is rejected before base64url decoding. That character count is the closed schema maximum for unpadded base64url of 16 MiB. Decoded ciphertext longer than 16 MiB is rejected before AES-GCM. A bad authentication tag on that oversized ciphertext is a static `malformed wire` error, and AES-GCM is not called. Authentication runs before plaintext is returned. After authentication, plaintext longer than 16 MiB is rejected and is not returned. This byte decoder does not parse payload metadata. It does not enforce the 64 KiB metadata ceiling. Rejected cases include a wrong root, a mutated header, mutated ciphertext, a mutated tag, and malformed or extra fields. Error text is static and does not include secret material.

CLI:

```bash
python3 scripts/format-vectors-python.py --emit
python3 scripts/format-vectors-python.py --verify fixtures/wpp-v1-vectors.json
```

`--emit` writes pretty JSON for `build_vector()` and one trailing newline to stdout. `--verify PATH` compares each input and expected value by canonical fixture JSON text. Boolean `true` does not match integer `1`. It then decodes the Node wire and the Python wire. It prints `verified` on success. On any mismatch it prints one `verification failed:` line per field name and exits nonzero. Import of the module must not write stdout or files.

Dependency pin, in `scripts/requirements-format-vectors.txt`:

```text
cryptography==46.0.5
```

Python commands:

```bash
python3 -m pip install -r scripts/requirements-format-vectors.txt
python3 -m unittest discover -s tests -p 'test_format_vectors_python.py'
python3 scripts/format-vectors-python.py --verify fixtures/wpp-v1-vectors.json
```

This page does not record results of those commands. The Node fixture remains the comparison artifact. Do not change the Node generator or that fixture to match a Python-only result.

## Shared wire corpus

`fixtures/wpp-v1-wire-corpus.json` is one public synthetic corpus. Each case has a stable `id`, an `outcome` of `accept` or `reject`, and the literal wire string `wireUtf8`. Node `UnlockedVault.openSnapshot` and Python `decode_wire` read that file. The tests pass those UTF-8 strings through without building a second wire. An accept result must return the published fixture plaintext or content. A reject result must not return plaintext. Error code classes can differ between the parsers. A different error code is not disagreement when both sides reject.

The measured cases are:

- `canonical` and `outer-whitespace`
- integral version spellings `version-1.0`, `version-1e0`, `version-10e-1`, `version-100e-2`, `version-0.1e1`, and the 64-character token `version-cap-integral`
- exact fractional versions `version-exact-fraction-high` and `version-exact-fraction-low`
- `version-1.5`, `version-2.0`, `version-true`, `version-infinity`, `version-1e20`, and the 65-character token `version-over-cap`
- `duplicate-ciphertext`, `unknown-header-field`, `malformed-base64url`, `changed-ciphertext`, `changed-tag`, and `header-aad-nonce`
- `escaped-version-key` accepts the decoded header spelling `vers\u0069on` with token `1`
- `duplicate-version-key` rejects two header `version` keys
- `escaped-version-fraction` rejects that decoded spelling with token `1.0000000000000001`

The corpus is 25 small cases. Nine cases accept and sixteen cases reject. It uses the published synthetic vector and contains no secret root. It does not measure payload metadata validation, the 64 KiB metadata ceiling, the 24 MiB raw-wire ceiling, native export compatibility, or storage-location invariance.

## Evidence boundary

The shared corpus is accept/reject agreement for the cases above. Same-vector field agreement remains bounded to one public synthetic snapshot. This page does not record an M0 format freeze. The Python byte decoder does not validate payload metadata and does not enforce the 64 KiB metadata ceiling. Production cryptographic approval remains open. Native Midnight export compatibility remains open. Storage-location invariance for unchanged package bytes remains open.
