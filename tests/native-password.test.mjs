import { equal, throws } from 'node:assert/strict';
import { describe, test } from 'node:test';
import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';

import { NATIVE_PASSWORD_MAX_ATTEMPTS, selectNativePassword } from '../dist/kernel/native-password.js';
import { deriveKeys } from '../dist/kernel/crypto.js';
import { assertCode, nativeSession } from './helpers/native-fixtures.mjs';

function headerBase(session) {
  return {
    format: 'wpp-witness-package',
    version: 1,
    suite: 'HKDF-SHA256+A256GCM',
    vaultId: session.root.vaultId,
    vaultSalt: session.root.vaultSalt,
    rootEpoch: session.root.epochs[0].rootEpoch,
    scopeId: session.scopeId,
    recordId: session.recordId,
    kind: 'snapshot',
  };
}

describe('native export password selection', () => {
  test('selects a password that the pinned validator accepts', () => {
    const session = nativeSession();
    const selected = selectNativePassword(session.secretRoot, headerBase(session));
    try {
      equal(validatePassword(selected.keys.nativeExportPassword), undefined);
      const keys = deriveKeys(session.secretRoot, selected.header);
      try {
        equal(keys.nativeExportPassword, selected.keys.nativeExportPassword);
      } finally {
        keys.prk.fill(0);
        keys.scopeKey.fill(0);
        keys.objectKey.fill(0);
        keys.nativeKey.fill(0);
      }
    } finally {
      selected.generation.fill(0);
      selected.nonce.fill(0);
      selected.keys.prk.fill(0);
      selected.keys.scopeKey.fill(0);
      selected.keys.objectKey.fill(0);
      selected.keys.nativeKey.fill(0);
      session.vault.lock();
    }
  });

  test('retries only a typed policy error and exhausts after 16 unpublished attempts', () => {
    equal(NATIVE_PASSWORD_MAX_ATTEMPTS, 16);
    const session = nativeSession();
    let calls = 0;
    throws(
      () =>
        selectNativePassword(session.secretRoot, headerBase(session), {
          validatePassword() {
            calls += 1;
            return validatePassword('AAAAAAAAAAAAAAAA');
          },
        }),
      assertCode('WPP_UNSUPPORTED'),
    );
    equal(calls, NATIVE_PASSWORD_MAX_ATTEMPTS);
    session.vault.lock();
  });

  test('fails closed on an unexpected validator error without retrying', () => {
    const session = nativeSession();
    let calls = 0;
    throws(
      () =>
        selectNativePassword(session.secretRoot, headerBase(session), {
          validatePassword() {
            calls += 1;
            throw new TypeError('boom');
          },
        }),
      assertCode('WPP_INTERNAL'),
    );
    equal(calls, 1);
    session.vault.lock();
  });

  test('accepts a later unpublished candidate after a typed policy rejection', () => {
    const session = nativeSession();
    let calls = 0;
    const selected = selectNativePassword(session.secretRoot, headerBase(session), {
      validatePassword(password) {
        calls += 1;
        if (calls === 1) {
          return validatePassword('AAAAAAAAAAAAAAAA');
        }
        return validatePassword(password);
      },
    });
    try {
      equal(calls, 2);
      equal(validatePassword(selected.keys.nativeExportPassword), undefined);
    } finally {
      selected.generation.fill(0);
      selected.nonce.fill(0);
      selected.keys.prk.fill(0);
      selected.keys.scopeKey.fill(0);
      selected.keys.objectKey.fill(0);
      selected.keys.nativeKey.fill(0);
      session.vault.lock();
    }
  });

  test('does not treat a non-undefined validator return as success', () => {
    const session = nativeSession();
    throws(
      () =>
        selectNativePassword(session.secretRoot, headerBase(session), {
          validatePassword() {
            return true;
          },
        }),
      assertCode('WPP_UNSUPPORTED'),
    );
    session.vault.lock();
  });
});


