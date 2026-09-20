import { deepEqual, equal, ok, rejects, throws } from 'node:assert/strict';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { UnlockedVault } from '../dist/kernel/index.js';
import {
  ACCOUNT_ID,
  BLOB,
  CONTRACT_ADDRESS,
  COUNTER,
  SECRET,
  STATE_ALPHA,
  STATE_BETA,
  STORAGE_PASSWORD,
  assertCode,
  assertTypedState,
  decryptNativePackage,
  expectedOf,
  nativeMetadata,
  nativeSession,
  seedTwoStates,
  typedState,
  utf8,
  withSourceProvider,
} from './helpers/native-fixtures.mjs';

const CHILD = fileURLToPath(new URL('./helpers/native-child.mjs', import.meta.url));

function captureInput(session, provider, metadata, extra = {}) {
  return {
    provider,
    scopeId: session.scopeId,
    recordId: session.recordId,
    metadataUtf8: utf8(JSON.stringify(metadata)),
    expectedStateIds: [...metadata.privateStateIds],
    ...extra,
  };
}

function runChild(payload) {
  return new Promise((resolve, reject) => {
    const child = fork(CHILD, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      const text = Buffer.concat(out).toString('utf8').trim();
      try {
        resolve({
          code,
          receipt: text.length === 0 ? null : JSON.parse(text),
          stderr: Buffer.concat(err).toString('utf8'),
        });
      } catch (parseErr) {
        reject(parseErr);
      }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

describe('native capture', () => {
  test('sealSnapshot still rejects a caller-supplied native export', () => {
    const session = nativeSession();
    const body = {
      payloadVersion: 1,
      metadata: nativeMetadata(),
      content: { format: 'midnight-private-state-export', encryptedPayload: 'QQ', salt: '00'.repeat(32) },
    };
    throws(
      () =>
        session.vault.sealSnapshot({
          scopeId: session.scopeId,
          recordId: session.recordId,
          payloadUtf8: utf8(JSON.stringify(body)),
        }),
      assertCode('WPP_UNSUPPORTED'),
    );
    session.vault.lock();
  });

  test('captures real native state, preserves export fields, and restores types in a fresh process', async () => {
    const session = nativeSession();
    await withSourceProvider(async (provider) => {
      await seedTwoStates(provider);
      const metadata = nativeMetadata();
      const sealed = await session.vault.captureNativeSnapshot(captureInput(session, provider, metadata));
      ok(sealed.wire.byteLength > 0);
      equal(typeof sealed.sha256, 'string');
      equal(sealed.sha256.length, 64);
      const openedNative = decryptNativePackage(session.secretRoot, sealed.wire);
      equal(openedNative.payload.content.format, 'midnight-private-state-export');
      equal(typeof openedNative.payload.content.encryptedPayload, 'string');
      equal(typeof openedNative.payload.content.salt, 'string');
      throws(
        () => session.vault.openSnapshot(sealed.wire, expectedOf(metadata, session.scopeId, session.recordId)),
        assertCode('WPP_UNSUPPORTED'),
      );
      const pack = session.vault.createRecoveryPack();
      const child = await runChild({
        recoveryWireB64: Buffer.from(pack.wire).toString('base64'),
        recoveryKeyB64: Buffer.from(pack.recoveryKey).toString('base64'),
        packageWireB64: Buffer.from(sealed.wire).toString('base64'),
        expected: expectedOf(metadata, session.scopeId, session.recordId),
        accountId: ACCOUNT_ID,
        contractAddress: CONTRACT_ADDRESS,
        storagePassword: STORAGE_PASSWORD,
        expectedStateIds: [STATE_ALPHA, STATE_BETA],
      });
      equal(child.code, 0);
      equal(child.receipt.ok, true);
      const alpha = child.receipt.states.find((row) => row.id === STATE_ALPHA);
      equal(alpha.counterType, 'bigint');
      equal(alpha.counter, String(COUNTER));
      equal(alpha.secretIsUint8, true);
      deepEqual(alpha.secret, [...SECRET]);
      equal(alpha.blobIsBuffer, true);
      equal(alpha.blobHex, BLOB.toString('hex'));
      const inProcess = await session.vault.stageNativeSnapshot(
        sealed.wire,
        expectedOf(metadata, session.scopeId, session.recordId),
        {
          accountId: ACCOUNT_ID,
          contractAddress: CONTRACT_ADDRESS,
          privateStoragePasswordProvider: () => STORAGE_PASSWORD,
          expectedStateIds: [STATE_ALPHA, STATE_BETA],
        },
      );
      try {
        assertTypedState(await inProcess.get(STATE_ALPHA));
      } finally {
        await inProcess.dispose();
      }
    });
    await session.vault.drain();
    session.vault.lock();
  });

  test('rejects extra or missing state IDs before a successful capture', async () => {
    const session = nativeSession();
    await withSourceProvider(async (provider) => {
      await seedTwoStates(provider);
      const extra = nativeMetadata([STATE_ALPHA]);
      await rejects(
        session.vault.captureNativeSnapshot(captureInput(session, provider, extra)),
        assertCode('WPP_UNSUPPORTED'),
      );
      const missing = nativeMetadata([STATE_ALPHA, STATE_BETA, 'gamma']);
      await rejects(
        session.vault.captureNativeSnapshot(captureInput(session, provider, missing)),
        assertCode('WPP_BINDING'),
      );
      assertTypedState(await provider.get(STATE_ALPHA));
    });
    await session.vault.drain();
    session.vault.lock();
  });

  test('rejects duplicate expected IDs and a mismatched account binding', async () => {
    const session = nativeSession();
    await withSourceProvider(async (provider) => {
      await seedTwoStates(provider);
      const metadata = nativeMetadata();
      await rejects(
        session.vault.captureNativeSnapshot({
          ...captureInput(session, provider, metadata),
          expectedStateIds: [STATE_ALPHA, STATE_ALPHA],
        }),
        assertCode('WPP_SCHEMA'),
      );
      const wrongAccount = nativeMetadata([STATE_ALPHA, STATE_BETA], {
        accountBinding: { scheme: 'synthetic-account', value: 'other-account' },
      });
      await rejects(
        session.vault.captureNativeSnapshot(captureInput(session, provider, wrongAccount)),
        assertCode('WPP_BINDING'),
      );
    });
    await session.vault.drain();
    session.vault.lock();
  });

  test('serializes a concurrent write behind capture', async () => {
    const session = nativeSession();
    await withSourceProvider(async (provider) => {
      await provider.set(STATE_ALPHA, typedState());
      let releaseHold;
      let notifyStarted;
      const started = new Promise((resolve) => {
        notifyStarted = resolve;
      });
      const hold = provider.runSerialized(() => {
        notifyStarted();
        return new Promise((resolve) => {
          releaseHold = resolve;
        });
      });
      await started;
      const metadata = nativeMetadata([STATE_ALPHA]);
      const captureP = session.vault.captureNativeSnapshot(captureInput(session, provider, metadata));
      const writeP = provider.set(STATE_BETA, typedState({ counter: 99n }));
      releaseHold();
      await hold;
      const sealed = await captureP;
      await writeP;
      const staged = await session.vault.stageNativeSnapshot(
        sealed.wire,
        expectedOf(metadata, session.scopeId, session.recordId),
        {
          accountId: ACCOUNT_ID,
          contractAddress: CONTRACT_ADDRESS,
          privateStoragePasswordProvider: () => STORAGE_PASSWORD,
          expectedStateIds: [STATE_ALPHA],
        },
      );
      try {
        assertTypedState(await staged.get(STATE_ALPHA));
        equal(await staged.get(STATE_BETA), null);
      } finally {
        await staged.dispose();
      }
      equal((await provider.get(STATE_BETA)).counter, 99n);
    });
    await session.vault.drain();
    session.vault.lock();
  });

  test('lock during export prevents publication and drain waits for cleanup', async () => {
    const session = nativeSession();
    let lockOnPassword = false;
    await withSourceProvider(
      async (provider) => {
        await seedTwoStates(provider);
        lockOnPassword = true;
        const metadata = nativeMetadata();
        await rejects(
          session.vault.captureNativeSnapshot(captureInput(session, provider, metadata)),
          assertCode('WPP_LOCKED'),
        );
        await session.vault.drain();
        equal(session.vault.locked, true);
        assertTypedState(await provider.get(STATE_ALPHA));
      },
      {
        passwordProvider: async () => {
          if (lockOnPassword) {
            session.vault.lock();
          }
          return STORAGE_PASSWORD;
        },
      },
    );
  });

  test('abort during capture fails closed without publishing', async () => {
    const session = nativeSession();
    const ac = new AbortController();
    let abortOnPassword = false;
    await withSourceProvider(
      async (provider) => {
        await seedTwoStates(provider);
        abortOnPassword = true;
        const metadata = nativeMetadata();
        await rejects(
          session.vault.captureNativeSnapshot(
            captureInput(session, provider, metadata, { signal: ac.signal }),
          ),
          assertCode('WPP_ABORTED'),
        );
        assertTypedState(await provider.get(STATE_ALPHA));
      },
      {
        passwordProvider: async () => {
          if (abortOnPassword) {
            ac.abort();
          }
          return STORAGE_PASSWORD;
        },
      },
    );
    await session.vault.drain();
    session.vault.lock();
  });

  test('rejects a producer pin mismatch before native export', async () => {
    const session = nativeSession();
    await withSourceProvider(async (provider) => {
      await seedTwoStates(provider);
      const metadata = nativeMetadata([STATE_ALPHA, STATE_BETA], {
        codec: {
          id: 'midnight-js-private-state-export',
          version: 1,
          producerPackage: '@midnight-ntwrk/midnight-js-level-private-state-provider',
          producerVersion: '0.0.0-not-the-pin',
          sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      });
      await rejects(
        session.vault.captureNativeSnapshot(captureInput(session, provider, metadata)),
        assertCode('WPP_UNSUPPORTED'),
      );
    });
    await session.vault.drain();
    session.vault.lock();
  });
});
