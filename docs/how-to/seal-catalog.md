# Seal and open a catalog package

Use this procedure on a development checkout with Node 24 or later. Use
synthetic catalog fixtures only. Do not feed live catalog plaintext, recovery
keys, or root records from a production vault.

This procedure authenticates a local catalog package. It does not upload bytes.
It does not shard ciphertext. It does not activate Midnight private state.

## Build the kernel

From the repository root, install dependencies with install scripts disabled if
you follow the host install rule. Then compile:

```bash
npm run build
```

That command runs `tsc -p tsconfig.json` and writes `dist/kernel/` and
`dist/catalog/`.

## Run the catalog kernel tests

```bash
npm test
```

That command builds and then runs `node --test tests/*.test.mjs`. The catalog
kernel tests import `../dist/kernel/index.js`. This page does not record a test
result.

## Seal and open one synthetic catalog

Create a small script that imports the compiled kernel. Read fixture bytes.
Pass a `Uint8Array`. Do not pass a parsed object graph. Do not pass catalog
scope or record identifiers. The unlocked root record supplies those
identifiers.

```javascript
import { readFileSync } from 'node:fs';
import { UnlockedVault } from './dist/kernel/index.js';

const fixtures = JSON.parse(readFileSync('fixtures/catalog-v1-examples.json', 'utf8'));
const payloadUtf8 = Buffer.from(JSON.stringify(fixtures.catalogs.baseline));
const vault = UnlockedVault.fromRootRecord(rootUtf8, []);
const sealed = vault.sealCatalog(payloadUtf8);
const opened = vault.openCatalog(sealed.wire);
const pack = vault.createRecoveryPack();
const recovered = UnlockedVault.fromRecoveryPack(pack.wire, pack.recoveryKey, []);
const recoveredOpen = recovered.openCatalog(sealed.wire);
vault.lock();
```

`rootUtf8` is UTF-8 JSON of a synthetic root record. Compare
`opened.packageSha256` to `sealed.sha256` when the input bytes are the exact
sealed wire. Compare `opened.header.kind` to `catalog`. The recovered handle
must open the same wire.

`openCatalog` authenticates first. It then checks that the plaintext bytes
equal the JCS encoding of the raw parsed JSON. Semantic normalization can
reorder set-like arrays after that check. Do not treat a successful open as
proof that the returned object graph is byte-identical to the sealed
plaintext.

Keep the recovery key outside the package bytes. Create the recovery pack
before `lock()`, or open a new unlocked handle. Wrong key length or a tampered
tag must fail. The failed call must not return a catalog.

`openSnapshot` must reject a catalog envelope. `openCatalog` must reject a
snapshot envelope.

## Read failures

The kernel throws `KernelError` with a static `code` such as `WPP_AUTH`,
`WPP_BINDING`, `WPP_NONCANONICAL`, or `WPP_LOCKED`. The message is the code.
The message does not include input bytes. Catalog semantic failures map to a
static kernel code. Public errors do not include Ajv data.

After `lock()`, catalog seal and open fail. Caller root buffers must stay
unchanged.

## Schema files

The compiled kernel reads `docs/reference/schemas/*.schema.json` relative to
`dist/kernel` and `dist/catalog`. Keep that directory in the same repository
layout when you run the kernel locally.
