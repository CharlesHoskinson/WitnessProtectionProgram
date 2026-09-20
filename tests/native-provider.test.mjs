import { deepEqual, equal, ok, rejects, throws } from 'node:assert/strict';
import { describe, test } from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  NATIVE_PRODUCER_PACKAGE,
  NATIVE_PRODUCER_VERSION,
  OwnedNativeProvider,
} from '../dist/native/index.js';
import {
  ACCOUNT_ID,
  CONTRACT_ADDRESS,
  STATE_ALPHA,
  STATE_BETA,
  STORAGE_PASSWORD,
  assertCode,
  assertTypedState,
  seedTwoStates,
  typedState,
  withSourceProvider,
  withTempDir,
} from './helpers/native-fixtures.mjs';

describe('OwnedNativeProvider', () => {
  test('creates and owns a real LevelDB provider and preserves typed state', async () => {
    await withSourceProvider(async (provider) => {
      equal(provider.accountId, ACCOUNT_ID);
      equal(provider.contractAddress, CONTRACT_ADDRESS);
      equal(typeof provider.setContractAddress, 'undefined');
      equal('clear' in provider, false);
      await provider.set(STATE_ALPHA, typedState());
      const got = await provider.get(STATE_ALPHA);
      assertTypedState(got);
      await provider.invalidateEncryptionCache();
      const again = await provider.get(STATE_ALPHA);
      assertTypedState(again);
    });
  });

  test('rejects an empty account, a relative database path, and a bad contract address', async () => {
    await withTempDir(async (dir) => {
      throws(
        () =>
          new OwnedNativeProvider({
            accountId: '   ',
            contractAddress: CONTRACT_ADDRESS,
            privateStoragePasswordProvider: () => STORAGE_PASSWORD,
            midnightDbName: join(dir, 'db'),
          }),
        assertCode('WPP_SCHEMA'),
      );
      throws(
        () =>
          new OwnedNativeProvider({
            accountId: ACCOUNT_ID,
            contractAddress: 'not-a-contract',
            privateStoragePasswordProvider: () => STORAGE_PASSWORD,
            midnightDbName: join(dir, 'db'),
          }),
        assertCode('WPP_SCHEMA'),
      );
      throws(
        () =>
          new OwnedNativeProvider({
            accountId: ACCOUNT_ID,
            contractAddress: CONTRACT_ADDRESS,
            privateStoragePasswordProvider: () => STORAGE_PASSWORD,
            midnightDbName: 'relative-db',
          }),
        assertCode('WPP_SCHEMA'),
      );
    });
  });

  test('serializes concurrent writes and does not expose an inner provider', async () => {
    await withSourceProvider(async (provider) => {
      const names = Object.getOwnPropertyNames(provider);
      equal(names.includes('provider'), false);
      equal(names.includes('#inner'), false);
      const writes = [];
      await Promise.all([
        provider.set(STATE_ALPHA, typedState({ counter: 1n })).then(() => writes.push('a')),
        provider.set(STATE_BETA, typedState({ counter: 2n })).then(() => writes.push('b')),
      ]);
      equal(writes.length, 2);
      const alpha = await provider.get(STATE_ALPHA);
      const beta = await provider.get(STATE_BETA);
      equal(alpha.counter, 1n);
      equal(beta.counter, 2n);
    });
  });

  test('exports and imports exact native fields through a fresh directory', async () => {
    await withSourceProvider(async (source) => {
      await seedTwoStates(source);
      const exported = await source.exportPrivateStates({
        password: STORAGE_PASSWORD,
        maxStates: 2,
      });
      equal(exported.format, 'midnight-private-state-export');
      equal(typeof exported.encryptedPayload, 'string');
      equal(typeof exported.salt, 'string');
      deepEqual(Object.keys(exported).sort(), ['encryptedPayload', 'format', 'salt']);
      await withTempDir(async (dir) => {
        const staging = source.createIsolatedClone(join(dir, 'db'));
        try {
          const result = await staging.importPrivateStates(exported, {
            password: STORAGE_PASSWORD,
            maxStates: 2,
            conflictStrategy: 'error',
          });
          deepEqual(result, { imported: 2, skipped: 0, overwritten: 0 });
          assertTypedState(await staging.get(STATE_ALPHA));
        } finally {
          await staging.invalidateEncryptionCache();
          await staging.drain();
        }
      });
    });
  });

  test('rejects a valid-policy wrong import password and leaves the source unchanged', async () => {
    await withSourceProvider(async (source) => {
      await seedTwoStates(source);
      const exported = await source.exportPrivateStates({
        password: STORAGE_PASSWORD,
        maxStates: 2,
      });
      await withTempDir(async (dir) => {
        const staging = source.createIsolatedClone(join(dir, 'db'));
        try {
          await rejects(
            staging.importPrivateStates(exported, {
              password: 'Wpp-Store-Key8!Other',
              maxStates: 2,
              conflictStrategy: 'error',
            }),
            assertCode('WPP_AUTH'),
          );
          equal(await staging.get(STATE_ALPHA), null);
        } finally {
          await staging.invalidateEncryptionCache();
          await staging.drain();
        }
      });
      assertTypedState(await source.get(STATE_ALPHA));
    });
  });

  test('rejects maxStates below inventory and a corrupted native salt', async () => {
    await withSourceProvider(async (source) => {
      await seedTwoStates(source);
      await rejects(
        source.exportPrivateStates({ password: STORAGE_PASSWORD, maxStates: 1 }),
        assertCode('WPP_UNSUPPORTED'),
      );
      const exported = await source.exportPrivateStates({
        password: STORAGE_PASSWORD,
        maxStates: 2,
      });
      const corrupt = { ...exported, salt: '00'.repeat(32) };
      await withTempDir(async (dir) => {
        const staging = source.createIsolatedClone(join(dir, 'db'));
        try {
          await rejects(
            staging.importPrivateStates(corrupt, {
              password: STORAGE_PASSWORD,
              maxStates: 2,
              conflictStrategy: 'error',
            }),
            assertCode('WPP_AUTH'),
          );
        } finally {
          await staging.invalidateEncryptionCache();
          await staging.drain();
        }
      });
    });
  });

  test('pins the supported producer package version', () => {
    equal(NATIVE_PRODUCER_PACKAGE, '@midnight-ntwrk/midnight-js-level-private-state-provider');
    equal(NATIVE_PRODUCER_VERSION, '5.0.0-beta.8');
    equal(tmpdir().includes('WitnessProtectionProgram'), false);
  });
});
