import { UnlockedVault } from '../../dist/kernel/index.js';
import { StagedNativeSnapshot } from '../../dist/native/index.js';

function writeReceipt(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function errorReceipt(err) {
  return {
    ok: false,
    name: err?.name ?? 'Error',
    code: err?.code ?? null,
    message: String(err?.message ?? ''),
  };
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => {
      chunks.push(chunk);
    });
    process.stdin.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw.length === 0 ? {} : JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    process.stdin.on('error', reject);
  });
}

function describeState(state) {
  if (state === null || typeof state !== 'object') {
    return { present: false };
  }
  return {
    present: true,
    counterType: typeof state.counter,
    counter: typeof state.counter === 'bigint' ? String(state.counter) : null,
    secretIsUint8: state.secretKey instanceof Uint8Array,
    secret: state.secretKey instanceof Uint8Array ? Array.from(state.secretKey) : null,
    blobIsBuffer: Buffer.isBuffer(state.blob),
    blobHex: Buffer.isBuffer(state.blob) ? state.blob.toString('hex') : null,
  };
}

async function main() {
  const cfg = await readStdin();
  const recoveryWire = Uint8Array.from(Buffer.from(cfg.recoveryWireB64, 'base64'));
  const recoveryKey = Uint8Array.from(Buffer.from(cfg.recoveryKeyB64, 'base64'));
  const wire = Uint8Array.from(Buffer.from(cfg.packageWireB64, 'base64'));
  const vault = UnlockedVault.fromRecoveryPack(recoveryWire, recoveryKey, []);
  let staged;
  try {
    staged = await vault.stageNativeSnapshot(wire, cfg.expected, {
      accountId: cfg.accountId,
      contractAddress: cfg.contractAddress,
      privateStoragePasswordProvider: () => cfg.storagePassword,
      expectedStateIds: cfg.expectedStateIds,
    });
    const states = [];
    for (const id of cfg.expectedStateIds) {
      const value = await staged.get(id);
      states.push({ id, ...describeState(value) });
    }
    writeReceipt({
      ok: true,
      handle: staged instanceof StagedNativeSnapshot,
      states,
    });
  } finally {
    if (staged !== undefined) {
      await staged.dispose();
    }
    await vault.drain();
    vault.lock();
  }
}

main().catch((err) => {
  writeReceipt(errorReceipt(err));
  process.exit(1);
});
