import { equal, rejects } from 'node:assert/strict';
import { describe, test } from 'node:test';

import { UnlockedVault } from '../dist/kernel/index.js';

import {
  ACCOUNT_ID,
  CONTRACT_ADDRESS,
  SECRET_MARKER,
  STATE_ALPHA,
  STATE_BETA,
  STORAGE_PASSWORD,
  assertCode,
  assertTypedState,
  expectedOf,
  forgeNativeWire,
  nativeMetadata,
  nativeSession,
  seedTwoStates,
  utf8,
  withSourceProvider,
} from './helpers/native-fixtures.mjs';

describe('native isolated stage', () => {
  test('rejects wrong network, account, contract, or codec before import', async () => {
    const session = nativeSession();
    await withSourceProvider(async (provider) => {
      await seedTwoStates(provider);
      const metadata = nativeMetadata();
      const sealed = await session.vault.captureNativeSnapshot({
        provider,
        scopeId: session.scopeId,
        recordId: session.recordId,
        metadataUtf8: utf8(JSON.stringify(metadata)),
        expectedStateIds: [STATE_ALPHA, STATE_BETA],
      });
      const expected = expectedOf(metadata, session.scopeId, session.recordId);
      const options = {
        accountId: ACCOUNT_ID,
        contractAddress: CONTRACT_ADDRESS,
        privateStoragePasswordProvider: () => STORAGE_PASSWORD,
        expectedStateIds: [STATE_ALPHA, STATE_BETA],
      };
      await rejects(
        session.vault.stageNativeSnapshot(sealed.wire, { ...expected, network: { id: 'other-net', genesisHash: null } }, options),
        assertCode('WPP_BINDING'),
      );
      await rejects(
        session.vault.stageNativeSnapshot(
          sealed.wire,
          { ...expected, accountBinding: { scheme: 'synthetic-account', value: 'other-account' } },
          { ...options, accountId: 'other-account' },
        ),
        assertCode('WPP_BINDING'),
      );
      await rejects(
        session.vault.stageNativeSnapshot(
          sealed.wire,
          expected,
          { ...options, accountId: 'other-account' },
        ),
        assertCode('WPP_BINDING'),
      );
      await rejects(
        session.vault.stageNativeSnapshot(
          sealed.wire,
          { ...expected, contract: { address: '22'.repeat(32), codeHash: null } },
          { ...options, contractAddress: '22'.repeat(32) },
        ),
        assertCode('WPP_BINDING'),
      );
      await rejects(
        session.vault.stageNativeSnapshot(
          sealed.wire,
          {
            ...expected,
            codec: { ...expected.codec, producerVersion: '0.0.0-wrong' },
          },
          options,
        ),
        assertCode('WPP_UNSUPPORTED'),
      );
      assertTypedState(await provider.get(STATE_ALPHA));
    });
    await session.vault.drain();
    session.vault.lock();
  });

  test('rejects a corrupted native payload and a validator failure without activating staging', async () => {
    const session = nativeSession();
    await withSourceProvider(async (provider) => {
      await seedTwoStates(provider);
      const metadata = nativeMetadata();
      const sealed = await session.vault.captureNativeSnapshot({
        provider,
        scopeId: session.scopeId,
        recordId: session.recordId,
        metadataUtf8: utf8(JSON.stringify(metadata)),
        expectedStateIds: [STATE_ALPHA, STATE_BETA],
      });
      const expected = expectedOf(metadata, session.scopeId, session.recordId);
      const forged = forgeNativeWire(session.root, session.scopeId, session.recordId, metadata, {
        format: 'midnight-private-state-export',
        encryptedPayload: 'AAAA',
        salt: 'ff'.repeat(32),
      });
      await rejects(
        session.vault.stageNativeSnapshot(forged.wire, expected, {
          accountId: ACCOUNT_ID,
          contractAddress: CONTRACT_ADDRESS,
          privateStoragePasswordProvider: () => STORAGE_PASSWORD,
          expectedStateIds: [STATE_ALPHA, STATE_BETA],
        }),
        assertCode('WPP_AUTH'),
      );
      await rejects(
        session.vault.stageNativeSnapshot(sealed.wire, expected, {
          accountId: ACCOUNT_ID,
          contractAddress: CONTRACT_ADDRESS,
          privateStoragePasswordProvider: () => STORAGE_PASSWORD,
          expectedStateIds: [STATE_ALPHA, STATE_BETA],
          validateState() {
            throw new Error(`${SECRET_MARKER} validator`);
          },
        }),
        assertCode('WPP_CODEC'),
      );
      assertTypedState(await provider.get(STATE_ALPHA));
    });
    await session.vault.drain();
    session.vault.lock();
  });

  test('returns an owned staged handle that reads until dispose', async () => {
    const session = nativeSession();
    await withSourceProvider(async (provider) => {
      await seedTwoStates(provider);
      const metadata = nativeMetadata();
      const sealed = await session.vault.captureNativeSnapshot({
        provider,
        scopeId: session.scopeId,
        recordId: session.recordId,
        metadataUtf8: utf8(JSON.stringify(metadata)),
        expectedStateIds: [STATE_ALPHA, STATE_BETA],
      });
      const staged = await session.vault.stageNativeSnapshot(
        sealed.wire,
        expectedOf(metadata, session.scopeId, session.recordId),
        {
          accountId: ACCOUNT_ID,
          contractAddress: CONTRACT_ADDRESS,
          privateStoragePasswordProvider: () => STORAGE_PASSWORD,
          expectedStateIds: [STATE_ALPHA, STATE_BETA],
        },
      );
      assertTypedState(await staged.get(STATE_ALPHA));
      await staged.dispose();
      await rejects(staged.get(STATE_ALPHA), assertCode('WPP_LOCKED'));
      await staged.dispose();
    });
    await session.vault.drain();
    session.vault.lock();
  });

  test('lock during import prevents returning a staged handle', async () => {
    const session = nativeSession();
    let lockOnPassword = false;
    await withSourceProvider(async (provider) => {
      await seedTwoStates(provider);
      const metadata = nativeMetadata();
      const sealed = await session.vault.captureNativeSnapshot({
        provider,
        scopeId: session.scopeId,
        recordId: session.recordId,
        metadataUtf8: utf8(JSON.stringify(metadata)),
        expectedStateIds: [STATE_ALPHA, STATE_BETA],
      });
      lockOnPassword = true;
      await rejects(
        session.vault.stageNativeSnapshot(sealed.wire, expectedOf(metadata, session.scopeId, session.recordId), {
          accountId: ACCOUNT_ID,
          contractAddress: CONTRACT_ADDRESS,
          privateStoragePasswordProvider: async () => {
            if (lockOnPassword) {
              session.vault.lock();
            }
            return STORAGE_PASSWORD;
          },
          expectedStateIds: [STATE_ALPHA, STATE_BETA],
        }),
        assertCode('WPP_LOCKED'),
      );
    });
    await session.vault.drain();
    equal(session.vault.locked, true);
  });

  test('missing extra IDs and application snapshot codecs stay rejected', async () => {
    const session = nativeSession();
    await withSourceProvider(async (provider) => {
      await seedTwoStates(provider);
      const metadata = nativeMetadata();
      const sealed = await session.vault.captureNativeSnapshot({
        provider,
        scopeId: session.scopeId,
        recordId: session.recordId,
        metadataUtf8: utf8(JSON.stringify(metadata)),
        expectedStateIds: [STATE_ALPHA, STATE_BETA],
      });
      const expected = expectedOf(metadata, session.scopeId, session.recordId);
      await rejects(
        session.vault.stageNativeSnapshot(sealed.wire, expected, {
          accountId: ACCOUNT_ID,
          contractAddress: CONTRACT_ADDRESS,
          privateStoragePasswordProvider: () => STORAGE_PASSWORD,
          expectedStateIds: [STATE_ALPHA],
        }),
        assertCode('WPP_BINDING'),
      );
      const appCodec = {
        id: 'wpp.test-app',
        validate() {},
      };
      const appVault = UnlockedVault.fromRootRecord(session.rootUtf8, [appCodec]);
      const appBody = {
        payloadVersion: 1,
        metadata: {
          ...nativeMetadata(['fixture-state']),
          codec: {
            id: 'wpp.test-app',
            version: 1,
            producerPackage: 'wpp-format-vectors',
            producerVersion: '0.1.0',
            sourceCommit: '0000000000000000000000000000000000000000',
          },
          retentionClass: 'retained-application-witness',
        },
        content: { ok: true },
      };
      const appSealed = appVault.sealSnapshot({
        scopeId: session.scopeId,
        recordId: session.recordId,
        payloadUtf8: utf8(JSON.stringify(appBody)),
      });
      await rejects(
        session.vault.stageNativeSnapshot(appSealed.wire, expectedOf(appBody.metadata, session.scopeId, session.recordId), {
          accountId: ACCOUNT_ID,
          contractAddress: CONTRACT_ADDRESS,
          privateStoragePasswordProvider: () => STORAGE_PASSWORD,
          expectedStateIds: ['fixture-state'],
        }),
        assertCode('WPP_UNSUPPORTED'),
      );
      appVault.lock();
    });
    await session.vault.drain();
    session.vault.lock();
  });
});
