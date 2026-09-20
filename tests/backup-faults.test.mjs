import { equal, ok } from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, test } from 'node:test';

import { GoogleBackupCoordinator } from '../dist/backup/index.js';
import { createGoogleDriveAdapter } from '../dist/google/index.js';
import { aeadEncrypt, deriveKeys } from '../dist/kernel/crypto.js';
import { CATALOG_V2_LIMITS } from '../dist/storage/index.js';
import canonicalize from 'canonicalize';
import {
  OTHER_PERMISSION_ID,
  PERMISSION_ID,
  corruptPackageTag,
  expectedFromInput,
  findFileIdByName,
  id16,
  id32,
  mediaFileId,
  mediaGets,
  memoryDrive,
  openPublishedRecords,
  payloadUtf8,
  posts,
  replaceDriveFile,
  resealCatalog,
  sealInput,
  sha256Hex,
  unlock,
  utf8,
  withJournal,
} from './helpers/backup-harness.mjs';

function xorByte(bytes, index = 0) {
  const out = Buffer.from(bytes);
  out[index] ^= 0xff;
  return out;
}

function encryptRoot(root, payloadObject) {
  const epoch = root.epochs.find((item) => item.status === 'active');
  const plaintext = Buffer.from(canonicalize(payloadObject), 'utf8');
  const generation = randomBytes(32);
  const nonce = randomBytes(12);
  const header = {
    format: 'wpp-witness-package',
    version: 1,
    suite: 'HKDF-SHA256+A256GCM',
    vaultId: root.vaultId,
    vaultSalt: root.vaultSalt,
    rootEpoch: epoch.rootEpoch,
    scopeId: root.catalogScopeId,
    recordId: root.catalogRecordId,
    generationId: generation.toString('base64url'),
    kind: 'catalog',
    nonce: nonce.toString('base64url'),
  };
  const secretRoot = Buffer.from(epoch.secretRoot, 'base64url');
  const keys = deriveKeys(secretRoot, header);
  try {
    const aad = Buffer.from(canonicalize(header), 'utf8');
    const sealed = aeadEncrypt(keys.objectKey, nonce, aad, plaintext);
    const wireObject = {
      header,
      ciphertext: Buffer.from(sealed.ciphertext).toString('base64url'),
      tag: Buffer.from(sealed.tag).toString('base64url'),
    };
    const wire = Buffer.from(canonicalize(wireObject), 'utf8');
    return { wire, sha256: sha256Hex(wire) };
  } finally {
    keys.prk.fill(0);
    keys.scopeKey.fill(0);
    keys.objectKey.fill(0);
    keys.nativeKey.fill(0);
  }
}

function hexByte(value) {
  return value.toString(16).padStart(2, '0');
}

function overBudgetRootPayload(epoch) {
  const references = [];
  for (let i = 0; i < 256; i += 1) {
    const prefix = hexByte(i);
    references.push({
      prefix,
      empty: false,
      recordId: id32(),
      generationId: id32(),
      rootEpoch: epoch,
      wireSha256: sha256Hex(utf8(`shard:${prefix}`)),
      wireByteLength: 1024,
      plaintextByteLength: CATALOG_V2_LIMITS.shardPlaintextBytes,
      entryCount: 1,
      observationCount: 0,
      canonicalRecordsSha256: sha256Hex(utf8(`records:${prefix}`)),
      locators: [
        {
          provider: 'google-drive',
          accountBinding: { scheme: 'google-drive-permission-id', value: PERMISSION_ID },
          objectId: `shard-${prefix}`,
          revisionId: null,
        },
      ],
    });
  }
  return {
    payloadVersion: 2,
    nodeType: 'root',
    partitionVersion: 1,
    parents: [],
    entryCount: 256,
    observationCount: 0,
    requiredEpochs: [epoch],
    references,
  };
}

describe('backup fault injection', () => {
  test('live missing target fails restore and does not return plaintext', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const input = sealInput('live');
      const published = await coordinator.publishSnapshot(input);
      equal(published.status, 'verified', published.reason);
      const witnessName = `${published.packageSha256}.wpp`;
      for (const [fileId, name] of drive.names.entries()) {
        if (name === witnessName) {
          drive.hooks.dropFileIds.add(fileId);
        }
      }
      const restored = await coordinator.restoreSnapshot(
        published.checkpoint,
        published.packageSha256,
        expectedFromInput(input),
      );
      equal(restored.status, 'incomplete');
      ok(restored.reason === 'missing-object' || restored.reason === 'corrupt-object');
      equal(restored.snapshot, undefined);
    });
    vault.lock();
  });

  test('swapped truncated and corrupted objects fail without advancing a new checkpoint', async () => {
    const { vault } = unlock();
    await withJournal(async ({ journal }) => {
      const drive = memoryDrive();
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const first = await coordinator.publishSnapshot(sealInput('ok'));
      equal(first.status, 'verified', first.reason);
      const rootId = first.checkpoint.root.locator.objectId;
      drive.hooks.mutateMedia = (fileId, octets) => {
        if (fileId === rootId) {
          return xorByte(octets);
        }
        return octets;
      };
      const second = await coordinator.publishSnapshot(sealInput('next'));
      equal(second.status, 'incomplete');
      equal(second.previousCheckpoint.root.wireSha256, first.checkpoint.root.wireSha256);

      drive.hooks.mutateMedia = (fileId, octets) => {
        if (fileId === rootId) {
          return Buffer.from(octets.subarray(0, Math.max(1, octets.byteLength - 8)));
        }
        return octets;
      };
      const truncated = await coordinator.publishSnapshot(sealInput('trunc'));
      equal(truncated.status, 'incomplete');
      equal(truncated.previousCheckpoint.root.wireSha256, first.checkpoint.root.wireSha256);
    });
    vault.lock();
  });

  test('wrong account binding is incomplete and does not restore', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const input = sealInput('acct');
      const published = await coordinator.publishSnapshot(input);
      equal(published.status, 'verified', published.reason);
      const foreign = createGoogleDriveAdapter({
        permissionId: OTHER_PERMISSION_ID,
        request: drive.request,
      });
      const other = new GoogleBackupCoordinator({
        vault,
        session: foreign,
        mode: { kind: 'selected-checkpoint', checkpoint: published.checkpoint },
      });
      const restored = await other.restoreSnapshot(
        published.checkpoint,
        published.packageSha256,
        expectedFromInput(input),
      );
      equal(restored.status, 'incomplete');
      equal(restored.reason, 'wrong-account');
    });
    vault.lock();
  });

  test('lock during witness upload prevents checkpoint advancement', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      drive.hooks.beforeRequest = async ({ method }) => {
        if (method === 'POST') {
          vault.lock();
        }
      };
      const published = await coordinator.publishSnapshot(sealInput('lock-upload'));
      equal(published.status, 'incomplete');
      equal(published.reason, 'locked');
      equal(published.localUnsynced, true);
      equal(published.previousCheckpoint, null);
    });
  });

  test('lock during child readback prevents plaintext restore', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const input = sealInput('lock-child');
      const published = await coordinator.publishSnapshot(input);
      equal(published.status, 'verified', published.reason);
      let media = 0;
      drive.hooks.beforeRequest = async ({ url, method }) => {
        if (method === 'GET' && String(url).includes('alt=media')) {
          media += 1;
          if (media >= 2) {
            vault.lock();
          }
        }
      };
      const restored = await coordinator.restoreSnapshot(
        published.checkpoint,
        published.packageSha256,
        expectedFromInput(input),
      );
      equal(restored.status, 'incomplete');
      equal(restored.reason, 'locked');
      equal(restored.snapshot, undefined);
    });
  });

  test('lock during root readback does not persist a new checkpoint', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const first = await coordinator.publishSnapshot(sealInput('root-1'));
      equal(first.status, 'verified', first.reason);
      drive.hooks.beforeRequest = async ({ method, url }) => {
        if (method === 'GET' && String(url).includes('alt=media') && drive.calls.some((item) => item.method === 'POST')) {
          const recentPost = [...drive.calls].reverse().find((item) => item.method === 'POST');
          if (recentPost && posts(drive.calls).length >= 4) {
            vault.lock();
          }
        }
      };
      const second = await coordinator.publishSnapshot(sealInput('root-2'));
      equal(second.status, 'incomplete');
      ok(second.reason === 'locked' || second.reason === 'interrupted');
      equal(second.previousCheckpoint.root.wireSha256, first.checkpoint.root.wireSha256);
    });
  });

  test('over-budget authenticated root performs zero child GETs', async () => {
    const { vault, root } = unlock();
    const payload = overBudgetRootPayload(root.epochs[0].rootEpoch);
    const sealed = encryptRoot(root, payload);
    const drive = memoryDrive();
    const fileId = 'file-over-root';
    drive.files.set(fileId, sealed.wire);
    drive.names.set(fileId, `${sealed.sha256}.wpp`);
    const checkpoint = {
      format: 'wpp-backup-checkpoint',
      version: 1,
      root: {
        wireSha256: sealed.sha256,
        wireByteLength: sealed.wire.byteLength,
        locator: {
          provider: 'google-drive',
          accountBinding: { scheme: 'google-drive-permission-id', value: PERMISSION_ID },
          objectId: fileId,
          revisionId: null,
        },
      },
    };
    const coordinator = new GoogleBackupCoordinator({
      vault,
      session: drive.adapter,
      mode: { kind: 'selected-checkpoint', checkpoint },
    });
    const restored = await coordinator.restoreSnapshot(checkpoint, 'ab'.repeat(32), expectedFromInput({
      scopeId: id32(),
      recordId: id32(),
      payloadUtf8: payloadUtf8('unused'),
    }));
    equal(restored.status, 'incomplete');
    ok(restored.reason === 'capacity' || restored.reason === 'child-preflight-failed');
    const childGets = mediaGets(drive.calls).filter((item) => mediaFileId(item.url) !== fileId);
    equal(childGets.length, 0);
    vault.lock();
  });

  test('tombstoned missing target is allowed while a missing live target fails', async () => {
    const { vault, root } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const liveInput = sealInput('keep');
      const live = await coordinator.publishSnapshot(liveInput);
      equal(live.status, 'verified', live.reason);
      const liveRoot = vault.openCatalogNode(drive.files.get(live.checkpoint.root.locator.objectId), {
        nodeType: 'root',
        wireSha256: live.checkpoint.root.wireSha256,
        wireByteLength: live.checkpoint.root.wireByteLength,
      });
      const shardRef = liveRoot.node.payload.references.find((item) => item.empty === false);
      const shardOpened = vault.openCatalogNode(drive.files.get(shardRef.locators[0].objectId), {
        nodeType: 'shard',
        reference: shardRef,
      });
      const tombstonedDigest = sha256Hex(utf8('missing-historical-witness'));
      const records = [
        ...shardOpened.node.payload.records,
        {
          recordKind: 'tombstone',
          body: {
            entryKind: 'tombstone',
            eventId: id32(),
            targetPackageSha256: tombstonedDigest,
            reason: 'user-request',
            recordedAt: '2026-09-19T00:06:00Z',
          },
        },
      ];
      const { planCatalogShards } = await import('../dist/storage/index.js');
      const plan = planCatalogShards(Buffer.from(canonicalize(records), 'utf8'));
      const references = [];
      for (const leaf of plan.leaves) {
        if (leaf.empty) {
          references.push({ prefix: leaf.prefix, empty: true });
          continue;
        }
        const sealedShard = vault.sealCatalogNode(leaf.payloadUtf8);
        const receipt = await drive.adapter.putOwnedCiphertext(sealedShard.wire, sealedShard.sha256);
        const header = JSON.parse(Buffer.from(sealedShard.wire).toString('utf8')).header;
        references.push({
          prefix: leaf.prefix,
          empty: false,
          recordId: header.recordId,
          generationId: header.generationId,
          rootEpoch: header.rootEpoch,
          wireSha256: sealedShard.sha256,
          wireByteLength: sealedShard.wire.byteLength,
          plaintextByteLength: leaf.plaintextByteLength,
          entryCount: leaf.entryCount,
          observationCount: leaf.observationCount,
          canonicalRecordsSha256: leaf.canonicalRecordsSha256,
          locators: [
            {
              provider: 'google-drive',
              accountBinding: { scheme: 'google-drive-permission-id', value: PERMISSION_ID },
              objectId: receipt.fileId,
              revisionId: null,
            },
          ],
        });
      }
      const rootPayload = {
        payloadVersion: 2,
        nodeType: 'root',
        partitionVersion: 1,
        parents: [live.checkpoint.root.wireSha256],
        entryCount: plan.entryCount,
        observationCount: plan.observationCount,
        requiredEpochs: [...new Set([...plan.requiredEpochs, root.epochs[0].rootEpoch])].sort(),
        references,
      };
      const sealedRoot = vault.sealCatalogNode(Buffer.from(canonicalize(rootPayload), 'utf8'));
      const rootReceipt = await drive.adapter.putOwnedCiphertext(sealedRoot.wire, sealedRoot.sha256);
      const checkpoint = {
        format: 'wpp-backup-checkpoint',
        version: 1,
        root: {
          wireSha256: sealedRoot.sha256,
          wireByteLength: sealedRoot.wire.byteLength,
          locator: {
            provider: 'google-drive',
            accountBinding: { scheme: 'google-drive-permission-id', value: PERMISSION_ID },
            objectId: rootReceipt.fileId,
            revisionId: null,
          },
        },
      };
      const seeded = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'selected-checkpoint', checkpoint },
      });
      const unchanged = await seeded.publishUnchanged();
      equal(unchanged.status, 'verified', unchanged.reason);
      const missingLive = await seeded.restoreSnapshot(checkpoint, tombstonedDigest, expectedFromInput(liveInput));
      equal(missingLive.status, 'incomplete');
      const restoredLive = await seeded.restoreSnapshot(checkpoint, live.packageSha256, expectedFromInput(liveInput));
      equal(restoredLive.status, 'verified', restoredLive.reason);
      equal(restoredLive.snapshot.content.message, 'keep');
    });
    vault.lock();
  });

  test('lost create adopts listing copies and does not retry POST', async () => {
    const { vault } = unlock();
    const drive = memoryDrive({ incompleteCreate: true });
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const published = await coordinator.publishSnapshot(sealInput('adopt'));
      equal(published.status, 'verified', published.reason);
      const createPosts = posts(drive.calls);
      equal(createPosts.length >= 1, true);
      const names = createPosts.map((item) => {
        const text = Buffer.from(item.body ?? []).toString('utf8');
        const match = text.match(/"name"\s*:\s*"([0-9a-f]{64}\.wpp)"/);
        return match ? match[1] : '';
      });
      equal(new Set(names.filter(Boolean)).size, names.filter(Boolean).length);
    });
    vault.lock();
  });

  test('hashed ciphertext with an invalid tag fails and leaves the checkpoint unchanged', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const published = await coordinator.publishSnapshot(sealInput('tag-target'));
      equal(published.status, 'verified', published.reason);
      const witnessId = findFileIdByName(drive, `${published.packageSha256}.wpp`);
      ok(witnessId);
      const corrupted = corruptPackageTag(drive.files.get(witnessId));
      replaceDriveFile(drive, witnessId, corrupted);
      const { records } = openPublishedRecords(vault, drive, published.checkpoint);
      const corruptedDigest = sha256Hex(corrupted);
      const mutated = records.map((record) => {
        if (record.recordKind === 'snapshot' && record.body.package.sha256 === published.packageSha256) {
          return {
            ...record,
            body: {
              ...record.body,
              package: {
                ...record.body.package,
                sha256: corruptedDigest,
                byteLength: corrupted.byteLength,
              },
            },
          };
        }
        if (record.recordKind === 'observation' && record.body.packageSha256 === published.packageSha256) {
          const outcome = record.body.outcome;
          return {
            ...record,
            body: {
              ...record.body,
              packageSha256: corruptedDigest,
              outcome:
                outcome.status === 'readback-authenticated'
                  ? {
                      ...outcome,
                      observedSha256: corruptedDigest,
                      byteLength: corrupted.byteLength,
                    }
                  : outcome,
            },
          };
        }
        return record;
      });
      const resealed = await resealCatalog({
        vault,
        drive,
        records: mutated,
        parents: [published.checkpoint.root.wireSha256],
      });
      const seeded = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'selected-checkpoint', checkpoint: resealed.checkpoint },
      });
      const postsBefore = posts(drive.calls).length;
      const unchanged = await seeded.publishUnchanged();
      equal(unchanged.status, 'incomplete');
      equal(unchanged.reason, 'authentication-failed');
      equal(unchanged.previousCheckpoint.root.wireSha256, resealed.checkpoint.root.wireSha256);
      equal(posts(drive.calls).length, postsBefore);
      const next = await seeded.publishSnapshot(sealInput('after-bad-tag'));
      equal(next.status, 'incomplete');
      equal(next.previousCheckpoint.root.wireSha256, resealed.checkpoint.root.wireSha256);
    });
    vault.lock();
  });

  test('mismatched snapshot metadata and header claims fail before a root POST', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const published = await coordinator.publishSnapshot(sealInput('claim-target'));
      equal(published.status, 'verified', published.reason);
      const { records } = openPublishedRecords(vault, drive, published.checkpoint);
      const mutated = records.map((record) => {
        if (record.recordKind !== 'snapshot' || record.body.package.sha256 !== published.packageSha256) {
          return record;
        }
        return {
          ...record,
          body: {
            ...record.body,
            package: {
              ...record.body.package,
              generationId: id32(),
            },
            metadata: {
              ...record.body.metadata,
              capturedAt: '2026-09-19T00:00:01Z',
            },
          },
        };
      });
      const resealed = await resealCatalog({
        vault,
        drive,
        records: mutated,
        parents: [published.checkpoint.root.wireSha256],
      });
      const seeded = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'selected-checkpoint', checkpoint: resealed.checkpoint },
      });
      const postsBefore = posts(drive.calls).length;
      const next = await seeded.publishSnapshot(sealInput('must-not-publish'));
      equal(next.status, 'incomplete');
      equal(next.reason, 'binding-mismatch');
      equal(next.previousCheckpoint.root.wireSha256, resealed.checkpoint.root.wireSha256);
      equal(posts(drive.calls).length, postsBefore);
      const unchanged = await seeded.publishUnchanged();
      equal(unchanged.status, 'incomplete');
      equal(unchanged.previousCheckpoint.root.wireSha256, resealed.checkpoint.root.wireSha256);
      equal(posts(drive.calls).length, postsBefore);
    });
    vault.lock();
  });

  test('extra unused requiredEpoch fails when the root epoch already occurs among children', async () => {
    const { vault, root } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const published = await coordinator.publishSnapshot(sealInput('epoch-cover'));
      equal(published.status, 'verified', published.reason);
      const openedRoot = vault.openCatalogNode(drive.files.get(published.checkpoint.root.locator.objectId), {
        nodeType: 'root',
        wireSha256: published.checkpoint.root.wireSha256,
        wireByteLength: published.checkpoint.root.wireByteLength,
      });
      const actualEpoch = root.epochs[0].rootEpoch;
      ok(openedRoot.node.payload.requiredEpochs.includes(actualEpoch));
      ok(openedRoot.header.rootEpoch === actualEpoch);
      const { records } = openPublishedRecords(vault, drive, published.checkpoint);
      const extra = id16();
      ok(extra !== actualEpoch);
      const resealed = await resealCatalog({
        vault,
        drive,
        records,
        parents: [published.checkpoint.root.wireSha256],
        requiredEpochs: [...openedRoot.node.payload.requiredEpochs, extra].sort(),
      });
      equal(resealed.rootPayload.requiredEpochs.includes(extra), true);
      equal(resealed.rootPayload.requiredEpochs.includes(actualEpoch), true);
      const seeded = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'selected-checkpoint', checkpoint: resealed.checkpoint },
      });
      const postsBefore = posts(drive.calls).length;
      const unchanged = await seeded.publishUnchanged();
      equal(unchanged.status, 'incomplete');
      equal(unchanged.reason, 'child-preflight-failed');
      equal(unchanged.previousCheckpoint.root.wireSha256, resealed.checkpoint.root.wireSha256);
      equal(posts(drive.calls).length, postsBefore);
      const next = await seeded.publishSnapshot(sealInput('after-extra-epoch'));
      equal(next.status, 'incomplete');
      equal(next.previousCheckpoint.root.wireSha256, resealed.checkpoint.root.wireSha256);
      equal(posts(drive.calls).length, postsBefore);
    });
    vault.lock();
  });

  test('injected failure never reports verified publication', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    drive.hooks.beforeRequest = async ({ method }) => {
      if (method === 'POST') {
        throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
      }
    };
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const published = await coordinator.publishSnapshot(sealInput('fail'));
      equal(published.status, 'incomplete');
      equal(published.previousCheckpoint, null);
    });
    vault.lock();
  });
});
