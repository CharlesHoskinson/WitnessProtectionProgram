# Validate a local snapshot package

Use this procedure on a development checkout with Node 24 or later. Use synthetic data only. Do not feed live witnesses, recovery keys, or root records from a production vault.

This procedure authenticates a local package. It does not upload bytes. It does not activate Midnight private state.

## Build the kernel

From the repository root, install dependencies with install scripts disabled if you follow the host install rule. Then compile:

```bash
npm run build
```

That command runs `tsc -p tsconfig.json` and writes `dist/kernel/`.

## Run the kernel tests

```bash
npm test
```

That command builds and then runs `node --test tests/*.test.mjs`. The kernel tests import `../dist/kernel/index.js`. This page does not record a test result.

## Seal and open one synthetic snapshot

Create a small script that imports the compiled kernel. Register an explicit codec. Do not register a wildcard.

```javascript
import { UnlockedVault } from './dist/kernel/index.js';

const codec = {
  id: 'wpp.test-app',
  validate(content) {
    if (content === null || typeof content !== 'object' || Array.isArray(content)) {
      throw new Error('CODEC');
    }
  },
};

const vault = UnlockedVault.fromRootRecord(rootUtf8, [codec]);
const sealed = vault.sealSnapshot({ scopeId, recordId, payloadUtf8 });
const opened = vault.openSnapshot(sealed.wire, expected);
vault.lock();
```

`rootUtf8` and `payloadUtf8` are UTF-8 JSON bytes. `expected` must repeat the authenticated network, account, application, contract, codec, scope, and record fields. Compare `opened.content` to the intended synthetic object. Compare `opened.packageSha256` to `sealed.sha256` when the input bytes are the exact sealed wire.

## Open a recovery pack

```javascript
const pack = vault.createRecoveryPack();
const recovered = UnlockedVault.fromRecoveryPack(pack.wire, pack.recoveryKey, [codec]);
```

Keep the recovery key outside the package bytes. A later milestone owns checked export. Wrong key length or a tampered tag must fail. The failed call must not return a handle.

## Read failures

The kernel throws `KernelError` with a static `code` such as `WPP_AUTH`, `WPP_BINDING`, or `WPP_LOCKED`. The message is the code. The message does not include input bytes.

After `lock()`, seal, open, and recovery creation fail. Caller root buffers must stay unchanged.

## Schema files

The compiled kernel reads `docs/reference/schemas/*.schema.json` relative to `dist/kernel`. Keep that directory in the same repository layout when you run the kernel locally.
