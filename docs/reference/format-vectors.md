# Format vectors (synthetic M0)

Status: M0 primitive and byte-layout fixture generator. This page does not record a complete M0 milestone. It does not approve general JCS, native Midnight export, or production security.

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

The encoder rejects non-ASCII and control strings or keys, unsafe, fractional, and nonfinite numbers, negative zero, `undefined`, symbol values, symbol keys, function, `Buffer`, `Date`, sparse arrays, custom enumerable non-index array properties, `Object.create(null)`, and other non-plain objects. It does not drop unsupported values.

All fixed fixture values in this generator stay in that domain. Encoding there agrees with JCS. The encoder is not a general RFC 8785 implementation.

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
