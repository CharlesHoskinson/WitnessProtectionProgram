# Capture and stage native private state

Use this procedure on a development checkout with Node 24 or later.
Use synthetic data only.
Do not feed live witnesses, recovery keys, or root records from a production vault.

This procedure wraps a Midnight LevelDB export inside a WPP snapshot.
It does not activate a live provider.
It does not upload bytes.
It does not prove a deployed contract restore.

## Install the pinned provider

From the repository root, install dependencies with lifecycle scripts disabled:

```bash
npm install --ignore-scripts
```

The lockfile pins `@midnight-ntwrk/midnight-js-level-private-state-provider` and
`@midnight-ntwrk/midnight-js-utils` at `5.0.0-beta.8`.
Do not substitute a mock LevelDB factory.

## Build the kernel

```bash
npm run build
```

That command writes `dist/kernel/` and `dist/native/`.

## Create an owned source provider

Create a unique absolute database directory outside the repository.
Pass a fixed account identifier, a structurally valid contract address, and a storage password provider.
The wrapper constructs the real LevelDB provider.
Do not pass an existing provider instance.

```javascript
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OwnedNativeProvider } from './dist/native/index.js';
import { UnlockedVault } from './dist/kernel/index.js';

const rootDir = await mkdtemp(join(tmpdir(), 'wpp-native-src-'));
const provider = new OwnedNativeProvider({
  accountId: 'wpp-synthetic-account',
  contractAddress: '11'.repeat(32),
  privateStoragePasswordProvider: () => 'Wpp-Store-Key9!Vault',
  midnightDbName: join(rootDir, 'db'),
});
await provider.set('alpha', {
  counter: 12345678901234567890n,
  secretKey: Uint8Array.from({ length: 32 }, (_, i) => i),
  blob: Buffer.from('wpp-native-buffer'),
});
```

The storage password in this example is a synthetic fixture.
Do not reuse it as a production secret.

## Capture one native snapshot

Open an unlocked vault from a synthetic root record.
Supply metadata whose codec pin, account value, contract address, and private-state identifiers match the provider.
Call `captureNativeSnapshot`.
Do not call `sealSnapshot` with a native export.

```javascript
const vault = UnlockedVault.fromRootRecord(rootUtf8, []);
const sealed = await vault.captureNativeSnapshot({
  provider,
  scopeId,
  recordId,
  metadataUtf8,
  expectedStateIds: ['alpha'],
});
const pack = vault.createRecoveryPack();
```

The kernel selects a generation and derives the native export password.
It retries a typed password policy error at most 16 times.
It then exports through the real provider and imports into a temporary staging database.
The staging directory is destroyed before the method returns.
The returned package is not a crash-safe backup receipt.

## Stage from a recovery vault

Open a new unlocked handle from the recovery pack and the sealed wire.
Do not reuse the source database path.
Call `stageNativeSnapshot` with the same account, contract, and expected identifiers.

```javascript
const recovered = UnlockedVault.fromRecoveryPack(pack.wire, pack.recoveryKey, []);
const staged = await recovered.stageNativeSnapshot(sealed.wire, expected, {
  accountId: 'wpp-synthetic-account',
  contractAddress: '11'.repeat(32),
  privateStoragePasswordProvider: () => 'Wpp-Store-Key9!Vault',
  expectedStateIds: ['alpha'],
});
const restored = await staged.get('alpha');
await staged.dispose();
```

The staged handle holds plaintext-capable local state.
Dispose it after the read.
Do not treat a successful stage as activation.

## Lock and drain

Call `lock()` to revoke in-flight native work.
Call `drain()` to wait for cleanup.
Native I/O may finish after lock.
The kernel must not return a package or a staged handle after lock.

```javascript
await vault.drain();
vault.lock();
await provider.invalidateEncryptionCache();
await provider.drain();
```

Remove the temporary source directory after drain.

## Read failures

Wrong network, account, contract, or codec values fail before native import.
A missing or extra state identifier fails closed.
A failed stage destroys its temporary directory.
The source provider stays unchanged.

`sealSnapshot` still rejects codec `midnight-js-private-state-export`.
Use `captureNativeSnapshot` for native content.
