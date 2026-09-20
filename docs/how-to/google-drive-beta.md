---
orphan: true
---

# Exercise the bounded Google restore transport

This procedure checks the candidate restore transport on a local checkout.
It does not open a Google session. It does not use live credentials.

Automated tests inject Drive HTTP. They are fixtures, not live Google evidence.

## Build and run the local suite

Use Node 24 or later. From the repository root:

```bash
npm test
```

That command compiles TypeScript and runs `node --test tests/*.test.mjs`.
`tests/google-read.test.mjs` covers:

- multi-page listing with the fixed query, fields, and page size
- duplicate and cyclic pages
- `incompleteSearch`
- page and item exhaustion
- malformed JSON, size, and file id
- overlong JSON and media streams
- wrong account or unbound session
- caller mutation during a read
- corrupt, truncated, and swapped bytes
- redirect, untrusted page token, and late read error
- kernel-sealed synthetic read-back opened by the real kernel in the same test

Existing Google tests under `tests/google-drive.test.mjs` and
`tests/google-security-boundaries.test.mjs` remain injected fixtures as well.

## Confirm documentation and catalog grammar

After the Node suite, run the catalog schema tests and the strict Sphinx build:

```bash
python3 -m unittest discover -s tests -p 'test_catalog_schema.py'
python3 -m sphinx -W --keep-going -b html docs docs/_build/html
```

Use a documentation virtual environment if this checkout has one. See
[Build and explore the documentation](../tutorials/build-the-docs.md).

## What a passing read-back means

A passing `getOwnedCiphertext` test shows hash and length agreement on owned
bytes. The same test then opens those bytes with `UnlockedVault.openSnapshot`.
That kernel open is authentication of the synthetic fixture. The Drive adapter
still has no AEAD key.

A passing `listCiphertextCandidates` test shows bounded pagination behavior.
`complete: true` is not a freshness proof and is not a unique catalog head.

Do not run live Google commands from this procedure. Do not paste tokens.
The smoke upload command is a separate write-path probe. It is not restore
evidence for this transport.
