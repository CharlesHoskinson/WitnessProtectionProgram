import { deepEqual, equal, ok, throws } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { UnlockedVault } from '../dist/kernel/index.js';
import {
  ERR_BOM,
  ERR_INPUT_TOO_LARGE,
  ERR_RECOVERY,
  ERR_SCHEMA,
  KernelError,
  LIMIT_PLAINTEXT_BYTES,
  LIMIT_RECOVERY_WIRE_BYTES,
  LIMIT_ROOT_BYTES,
  assertByteCeiling,
  copyExactOwnedBytes,
  copyOwnedBytes,
  parseJsonBytes,
} from '../dist/kernel/json.js';

const vector = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/wpp-v1-vectors.json', import.meta.url)), 'utf8'),
);

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const INTRINSIC_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  'byteLength',
).get;

const codec = {
  id: vector.inputs.payload.metadata.codec.id,
  validate() {},
};

function utf8(text) {
  return Buffer.from(text, 'utf8');
}

function intrinsicLength(bytes) {
  return INTRINSIC_BYTE_LENGTH.call(bytes);
}

function snapshotBytes(bytes) {
  const out = new Uint8Array(intrinsicLength(bytes));
  Uint8Array.prototype.set.call(out, bytes);
  return out;
}

function withTrailingSpaces(bytes, totalLength) {
  const src = Buffer.from(bytes);
  if (src.length > totalLength) {
    throw new Error('pad target smaller than source');
  }
  return Buffer.concat([src, Buffer.alloc(totalLength - src.length, 0x20)]);
}

class ClaimedLength extends Uint8Array {
  constructor(bytes, claimed) {
    super(bytes);
    this._claimed = claimed;
  }

  get byteLength() {
    return this._claimed;
  }

  get length() {
    return this._claimed;
  }
}

class ThrowingLength extends Uint8Array {
  get byteLength() {
    throw new Error('byteLength getter must not run');
  }

  get length() {
    throw new Error('length getter must not run');
  }
}

function vectorRoot() {
  const header = vector.inputs.header;
  return {
    format: 'wpp-root-record',
    version: 1,
    revisionId: Buffer.alloc(32, 0xaa).toString('base64url'),
    parents: [],
    vaultId: header.vaultId,
    vaultSalt: header.vaultSalt,
    catalogScopeId: Buffer.alloc(32, 0xbb).toString('base64url'),
    catalogRecordId: Buffer.alloc(32, 0xcc).toString('base64url'),
    epochs: [
      {
        rootEpoch: header.rootEpoch,
        secretRoot: Buffer.from(vector.inputs.secretRootHex, 'hex').toString('base64url'),
        createdAt: '2026-09-19T00:00:00Z',
        status: 'active',
      },
    ],
  };
}

function rootUtf8() {
  return utf8(JSON.stringify(vectorRoot()));
}

function payloadUtf8() {
  return utf8(JSON.stringify(vector.inputs.payload));
}

function openVault() {
  return UnlockedVault.fromRootRecord(rootUtf8(), [codec]);
}

function assertUnchanged(bytes, before) {
  deepEqual(snapshotBytes(bytes), before);
}

function assertCode(code) {
  return (err) => {
    ok(err instanceof KernelError, `expected KernelError, got ${err && err.name}`);
    equal(err.code, code);
    equal(err.message, code);
    return true;
  };
}

describe('kernel byte ceilings and BOM checks', () => {
  test('root JSON padded past 64 KiB in a subclass claiming byteLength 1 fails with WPP_INPUT_TOO_LARGE', () => {
    equal(ERR_INPUT_TOO_LARGE, 'WPP_INPUT_TOO_LARGE');
    equal(LIMIT_ROOT_BYTES, 64 * 1024);
    const padded = withTrailingSpaces(rootUtf8(), LIMIT_ROOT_BYTES + 1);
    const hostile = new ClaimedLength(padded, 1);
    const before = snapshotBytes(hostile);
    throws(() => UnlockedVault.fromRootRecord(hostile, [codec]), assertCode(ERR_INPUT_TOO_LARGE));
    assertUnchanged(hostile, before);
  });

  test('payload JSON padded past 16 MiB in a subclass claiming byteLength 1 fails with WPP_INPUT_TOO_LARGE', () => {
    equal(LIMIT_PLAINTEXT_BYTES, 16 * 1024 * 1024);
    const vault = openVault();
    const padded = withTrailingSpaces(payloadUtf8(), LIMIT_PLAINTEXT_BYTES + 1);
    const hostile = new ClaimedLength(padded, 1);
    const before = snapshotBytes(hostile);
    throws(
      () =>
        vault.sealSnapshot({
          scopeId: vector.inputs.header.scopeId,
          recordId: vector.inputs.header.recordId,
          payloadUtf8: hostile,
        }),
      assertCode(ERR_INPUT_TOO_LARGE),
    );
    assertUnchanged(hostile, before);
  });

  test('recovery wire padded past 96 KiB in a subclass claiming byteLength 1 fails with WPP_INPUT_TOO_LARGE', () => {
    equal(LIMIT_RECOVERY_WIRE_BYTES, 96 * 1024);
    const vault = openVault();
    const pack = vault.createRecoveryPack();
    const padded = withTrailingSpaces(pack.wire, LIMIT_RECOVERY_WIRE_BYTES + 1);
    const hostile = new ClaimedLength(padded, 1);
    const before = snapshotBytes(hostile);
    throws(
      () => UnlockedVault.fromRecoveryPack(hostile, pack.recoveryKey, [codec]),
      assertCode(ERR_INPUT_TOO_LARGE),
    );
    assertUnchanged(hostile, before);
  });

  test('BOM-prefixed valid root subclass reporting 0 fails with WPP_BOM', () => {
    equal(ERR_BOM, 'WPP_BOM');
    const bomRoot = Buffer.concat([BOM, rootUtf8()]);
    ok(bomRoot.byteLength <= LIMIT_ROOT_BYTES);
    const hostile = new ClaimedLength(bomRoot, 0);
    const before = snapshotBytes(hostile);
    throws(() => UnlockedVault.fromRootRecord(hostile, [codec]), assertCode(ERR_BOM));
    assertUnchanged(hostile, before);
  });

  test('BOM-prefixed valid payload subclass reporting 0 fails with WPP_BOM', () => {
    const vault = openVault();
    const bomPayload = Buffer.concat([BOM, payloadUtf8()]);
    ok(bomPayload.byteLength <= LIMIT_PLAINTEXT_BYTES);
    const hostile = new ClaimedLength(bomPayload, 0);
    const before = snapshotBytes(hostile);
    throws(
      () =>
        vault.sealSnapshot({
          scopeId: vector.inputs.header.scopeId,
          recordId: vector.inputs.header.recordId,
          payloadUtf8: hostile,
        }),
      assertCode(ERR_BOM),
    );
    assertUnchanged(hostile, before);
  });

  test('BOM-prefixed valid recovery wire subclass reporting 0 fails with WPP_BOM', () => {
    const vault = openVault();
    const pack = vault.createRecoveryPack();
    const bomWire = Buffer.concat([BOM, Buffer.from(pack.wire)]);
    ok(bomWire.byteLength <= LIMIT_RECOVERY_WIRE_BYTES);
    const hostile = new ClaimedLength(bomWire, 0);
    const before = snapshotBytes(hostile);
    throws(
      () => UnlockedVault.fromRecoveryPack(hostile, pack.recoveryKey, [codec]),
      assertCode(ERR_BOM),
    );
    assertUnchanged(hostile, before);
  });

  test('BOM-prefixed root that also exceeds 64 KiB fails with WPP_INPUT_TOO_LARGE', () => {
    const bomRoot = Buffer.concat([BOM, rootUtf8()]);
    const padded = withTrailingSpaces(bomRoot, LIMIT_ROOT_BYTES + 1);
    const hostile = new ClaimedLength(padded, 0);
    throws(() => UnlockedVault.fromRootRecord(hostile, [codec]), assertCode(ERR_INPUT_TOO_LARGE));
  });

  test('oversized recovery key subclass reporting 32 fails with WPP_RECOVERY before a large copy', () => {
    equal(ERR_RECOVERY, 'WPP_RECOVERY');
    equal(ERR_SCHEMA, 'WPP_SCHEMA');
    const vault = openVault();
    const pack = vault.createRecoveryPack();
    const oversized = new Uint8Array(64 * 1024);
    oversized.fill(0x5a);
    const hostile = new ClaimedLength(oversized, 32);
    equal(hostile.byteLength, 32);
    ok(intrinsicLength(hostile) > 32);
    const before = snapshotBytes(hostile);
    throws(
      () => UnlockedVault.fromRecoveryPack(pack.wire, hostile, [codec]),
      assertCode(ERR_RECOVERY),
    );
    assertUnchanged(hostile, before);
    throws(
      () => UnlockedVault.fromRecoveryPack(pack.wire, null, [codec]),
      assertCode(ERR_SCHEMA),
    );
  });

  test('throwing length getters do not run and Buffer plus sliced inputs stay accepted', () => {
    const root = rootUtf8();
    const payload = payloadUtf8();
    const vault = UnlockedVault.fromRootRecord(new ThrowingLength(root), [codec]);
    const fromBuffer = UnlockedVault.fromRootRecord(Buffer.from(root), [codec]);
    const parent = new Uint8Array(root.byteLength + 6);
    parent.fill(0x20);
    parent.set(root, 3);
    const slicedRoot = parent.subarray(3, 3 + root.byteLength);
    const fromSlice = UnlockedVault.fromRootRecord(slicedRoot, [codec]);
    ok(vault);
    ok(fromBuffer);
    ok(fromSlice);
    deepEqual(snapshotBytes(slicedRoot), snapshotBytes(root));

    const sealed = vault.sealSnapshot({
      scopeId: vector.inputs.header.scopeId,
      recordId: vector.inputs.header.recordId,
      payloadUtf8: new ThrowingLength(payload),
    });
    const sealedBuffer = fromBuffer.sealSnapshot({
      scopeId: vector.inputs.header.scopeId,
      recordId: vector.inputs.header.recordId,
      payloadUtf8: Buffer.from(payload),
    });
    const payloadParent = new Uint8Array(payload.byteLength + 4);
    payloadParent.set(payload, 2);
    const slicedPayload = payloadParent.subarray(2, 2 + payload.byteLength);
    const payloadBefore = snapshotBytes(slicedPayload);
    const sealedSlice = fromSlice.sealSnapshot({
      scopeId: vector.inputs.header.scopeId,
      recordId: vector.inputs.header.recordId,
      payloadUtf8: slicedPayload,
    });
    ok(sealed.wire.byteLength > 0);
    ok(sealedBuffer.wire.byteLength > 0);
    ok(sealedSlice.wire.byteLength > 0);
    assertUnchanged(slicedPayload, payloadBefore);

    const pack = vault.createRecoveryPack();
    const recoveredThrow = UnlockedVault.fromRecoveryPack(
      new ThrowingLength(pack.wire),
      new ThrowingLength(pack.recoveryKey),
      [codec],
    );
    const recoveredBuffer = UnlockedVault.fromRecoveryPack(
      Buffer.from(pack.wire),
      Buffer.from(pack.recoveryKey),
      [codec],
    );
    const wireParent = new Uint8Array(pack.wire.byteLength + 4);
    wireParent.set(pack.wire, 1);
    const slicedWire = wireParent.subarray(1, 1 + pack.wire.byteLength);
    const keyParent = new Uint8Array(pack.recoveryKey.byteLength + 4);
    keyParent.set(pack.recoveryKey, 2);
    const slicedKey = keyParent.subarray(2, 2 + pack.recoveryKey.byteLength);
    const wireBefore = snapshotBytes(slicedWire);
    const keyBefore = snapshotBytes(slicedKey);
    const recoveredSlice = UnlockedVault.fromRecoveryPack(slicedWire, slicedKey, [codec]);
    ok(recoveredThrow);
    ok(recoveredBuffer);
    ok(recoveredSlice);
    assertUnchanged(slicedWire, wireBefore);
    assertUnchanged(slicedKey, keyBefore);

    const json = utf8('{"ok":true}');
    deepEqual(parseJsonBytes(new ThrowingLength(json), LIMIT_ROOT_BYTES), { ok: true });
    deepEqual(parseJsonBytes(Buffer.from(json), LIMIT_ROOT_BYTES), { ok: true });
    const jsonParent = new Uint8Array(json.byteLength + 2);
    jsonParent.set(json, 1);
    deepEqual(parseJsonBytes(jsonParent.subarray(1, 1 + json.byteLength), LIMIT_ROOT_BYTES), {
      ok: true,
    });
  });

  test('parseJsonBytes enforces intrinsic ceilings and BOM on the public helper', () => {
    const json = utf8('{"ok":true}');
    const overRoot = withTrailingSpaces(json, LIMIT_ROOT_BYTES + 1);
    const overRootHostile = new ClaimedLength(overRoot, 1);
    const overRootBefore = snapshotBytes(overRootHostile);
    throws(
      () => parseJsonBytes(overRootHostile, LIMIT_ROOT_BYTES),
      assertCode(ERR_INPUT_TOO_LARGE),
    );
    assertUnchanged(overRootHostile, overRootBefore);

    const overPlain = withTrailingSpaces(json, LIMIT_PLAINTEXT_BYTES + 1);
    throws(
      () => parseJsonBytes(new ClaimedLength(overPlain, 1), LIMIT_PLAINTEXT_BYTES),
      assertCode(ERR_INPUT_TOO_LARGE),
    );

    const overWire = withTrailingSpaces(json, LIMIT_RECOVERY_WIRE_BYTES + 1);
    throws(
      () => parseJsonBytes(new ClaimedLength(overWire, 1), LIMIT_RECOVERY_WIRE_BYTES),
      assertCode(ERR_INPUT_TOO_LARGE),
    );

    const bom = Buffer.concat([BOM, json]);
    const bomHostile = new ClaimedLength(bom, 0);
    const bomBefore = snapshotBytes(bomHostile);
    throws(() => parseJsonBytes(bomHostile, LIMIT_ROOT_BYTES), assertCode(ERR_BOM));
    assertUnchanged(bomHostile, bomBefore);

    throws(() => parseJsonBytes(null, LIMIT_ROOT_BYTES), assertCode(ERR_SCHEMA));

    const CALLER_SENTINEL = 'CALLER_SECRET_SENTINEL';
    let traps = 0;
    const hostile = new Proxy(json, {
      getPrototypeOf() {
        traps += 1;
        throw new Error(CALLER_SENTINEL);
      },
    });
    throws(() => parseJsonBytes(hostile, LIMIT_ROOT_BYTES), assertCode(ERR_SCHEMA));
    equal(traps, 0);
    const { proxy, revoke } = Proxy.revocable(json, {});
    revoke();
    throws(() => parseJsonBytes(proxy, LIMIT_ROOT_BYTES), assertCode(ERR_SCHEMA));
    const detached = new Uint8Array(json);
    detached.buffer.transfer();
    throws(() => parseJsonBytes(detached, LIMIT_ROOT_BYTES), assertCode(ERR_SCHEMA));
    throws(() => copyOwnedBytes(hostile, LIMIT_ROOT_BYTES), assertCode(ERR_SCHEMA));
    throws(() => copyExactOwnedBytes(hostile, json.byteLength, ERR_RECOVERY), assertCode(ERR_SCHEMA));
    throws(() => assertByteCeiling(hostile, LIMIT_ROOT_BYTES), assertCode(ERR_SCHEMA));
    equal(traps, 0);

    const originalFill = Uint8Array.prototype.fill;
    let wipedOwnedCopy = false;
    Uint8Array.prototype.fill = function fillSpy(value, start, end) {
      const wasOwnedCopy =
        value === 0 && this !== json && this.byteLength === json.byteLength && this.every((byte, i) => byte === json[i]);
      const result = originalFill.call(this, value, start, end);
      if (wasOwnedCopy) {
        wipedOwnedCopy = this.every((byte) => byte === 0);
      }
      return result;
    };
    const jsonBefore = snapshotBytes(json);
    try {
      deepEqual(parseJsonBytes(json, LIMIT_ROOT_BYTES), { ok: true });
      deepEqual(parseJsonBytes(json, LIMIT_ROOT_BYTES), { ok: true });
      throws(() => parseJsonBytes(bom, LIMIT_ROOT_BYTES), assertCode(ERR_BOM));
    } finally {
      Uint8Array.prototype.fill = originalFill;
    }
    assertUnchanged(json, jsonBefore);
    ok(wipedOwnedCopy, 'parseJsonBytes must wipe its owned copy on success and failure');
  });
});
