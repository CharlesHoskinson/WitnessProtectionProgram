# Validate a catalog payload

Use this procedure on a development checkout with Node 24 or later. Use
synthetic catalog fixtures only. Do not feed live catalog plaintext from a
production vault.

This procedure checks logical catalog rules. It does not decrypt a catalog
package. It does not upload bytes. It does not shard ciphertext. It does not
activate Midnight private state.

## Build the catalog module

From the repository root, install pinned dependencies with install scripts
disabled if you follow the host install rule. Then compile:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build
```

That compile writes `dist/catalog/` and `dist/kernel/`.

## Run the catalog tests

```bash
npm test
```

That command builds and then runs `node --test tests/*.test.mjs`. The catalog
tests import `../dist/catalog/index.js`. This page does not record a test
result.

The schema grammar suite remains separate:

```bash
python3 -m unittest discover -s tests -p 'test_catalog_schema.py'
```

## Parse one synthetic catalog

Create a small script that imports the compiled catalog module. Read fixture
bytes. Pass a `Uint8Array`. Do not pass a parsed object graph.

```javascript
import { readFileSync } from 'node:fs';
import { parseCatalog, reconcileCatalogs, verifySnapshotClaim } from './dist/catalog/index.js';

const fixtures = JSON.parse(readFileSync('fixtures/catalog-v1-examples.json', 'utf8'));
const bytes = Buffer.from(JSON.stringify(fixtures.catalogs.baseline));
const catalog = parseCatalog(bytes);
```

`parseCatalog` copies the bytes before parse. Later mutation of `bytes` does
not change `catalog`.

## Reconcile two synthetic revisions

Supply the exact catalog package digest as `revisionSha256`. This module does
not hash the plaintext to produce that digest.

```javascript
const result = reconcileCatalogs([
  { revisionSha256: '11'.repeat(32), payloadUtf8: Buffer.from(JSON.stringify(fixtures.catalogs.forkA)) },
  { revisionSha256: '12'.repeat(32), payloadUtf8: Buffer.from(JSON.stringify(fixtures.catalogs.forkB)) },
]);
```

Read `result.conflicts` before you use `result.catalog`. A non-empty conflict
list means `catalog` is null. `result.freshness` is always `unknown`. Compact
and pretty encodings of the same JSON with one `revisionSha256` deduplicate.
A different array order does not. Repeated identical observations inside one
raw payload fail as `CATALOG_INPUT` because the schema sets
`uniqueItems`. Identical observations across distinct valid revisions
deduplicate. Reconciliation also rejects an aggregate canonical result above
16 MiB, including conflict claims and source revision copies.

## Compare one snapshot claim

Pass snapshot entry bytes, an expected vault identifier, and an `OpenResult`
from a trusted kernel `openSnapshot`. Pass the exact wire length separately.
Do not build a synthetic `OpenResult` for a production decision.

## Read failures

The module throws `CatalogError` with a static `code` such as `CATALOG_INPUT`,
`CATALOG_LIMIT`, `CATALOG_REFERENCE`, `CATALOG_CONFLICT`, or `CATALOG_BINDING`.
The message is the code. The message does not include payload bytes. The
module does not reuse a caller-thrown `CatalogError`. A getter failure on a
caller input becomes `CATALOG_INPUT`.

## Schema files

The compiled module reads `docs/reference/schemas/catalog-v1.schema.json`
relative to `dist/catalog`. Keep that directory in the same repository layout
when you run the module locally.
