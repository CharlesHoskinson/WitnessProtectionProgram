import { deepEqual, equal, match, ok } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { GoogleBackupCoordinator } from '../dist/backup/index.js';
import { createGoogleDriveAdapter } from '../dist/google/index.js';
import { UnlockedVault } from '../dist/kernel/index.js';
import {
  CODEC,
  expectedFromInput,
  mediaGets,
  memoryDrive,
  posts,
  sealInput,
  sha256Hex,
  snapshotOpenCount,
  unlock,
  withJournal,
  wrapOpenSnapshot,
} from './helpers/backup-harness.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = fileURLToPath(new URL('../scripts/google-sharded-roundtrip.mjs', import.meta.url));
const CHILD = fileURLToPath(new URL('./helpers/backup-restore-child.mjs', import.meta.url));

function observationCount(vault, drive, checkpoint) {
  const fileId = checkpoint.root.locator.objectId;
  const wire = drive.files.get(fileId);
  const opened = vault.openCatalogNode(wire, {
    nodeType: 'root',
    wireSha256: checkpoint.root.wireSha256,
    wireByteLength: checkpoint.root.wireByteLength,
  });
  return opened.node.payload.observationCount;
}

describe('GoogleBackupCoordinator production path', () => {
  test('new-vault publish then restore returns the sealed payload', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const input = sealInput('alpha');
      const published = await coordinator.publishSnapshot(input);
      equal(published.status, 'verified', published.reason);
      equal(published.checkpoint.format, 'wpp-backup-checkpoint');
      equal(published.checkpoint.version, 1);
      ok(published.metrics.reservedAdapterCalls >= 2);
      const restored = await coordinator.restoreSnapshot(
        published.checkpoint,
        published.packageSha256,
        expectedFromInput(input),
      );
      equal(restored.status, 'verified', restored.reason);
      equal(restored.snapshot.content.message, 'alpha');
      equal(restored.snapshot.packageSha256, published.packageSha256);
    });
    vault.lock();
  });

  test('second publish reuses the first witness ciphertext and grows no extra first-witness posts', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const firstInput = sealInput('one');
      const first = await coordinator.publishSnapshot(firstInput);
      equal(first.status, 'verified', first.reason);
      const firstWitnessPosts = posts(drive.calls).filter((item) => {
        const body = Buffer.from(item.body ?? []).toString('utf8');
        return body.includes(`${first.packageSha256}.wpp`);
      });
      equal(firstWitnessPosts.length, 1);
      const postCountAfterFirst = posts(drive.calls).length;
      const secondInput = sealInput('two');
      const second = await coordinator.publishSnapshot(secondInput);
      equal(second.status, 'verified', second.reason);
      const firstWitnessPostsAfter = posts(drive.calls).filter((item) => {
        const body = Buffer.from(item.body ?? []).toString('utf8');
        return body.includes(`${first.packageSha256}.wpp`);
      });
      equal(firstWitnessPostsAfter.length, 1);
      ok(posts(drive.calls).length > postCountAfterFirst);
      const restored = await coordinator.restoreSnapshot(
        second.checkpoint,
        first.packageSha256,
        expectedFromInput(firstInput),
      );
      equal(restored.status, 'verified', restored.reason);
      equal(restored.snapshot.content.message, 'one');
    });
    vault.lock();
  });

  test('publishUnchanged authenticates the retained live witness with openSnapshot', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const published = await coordinator.publishSnapshot(sealInput('steady-auth'));
      equal(published.status, 'verified', published.reason);
      const tracker = wrapOpenSnapshot(vault);
      const postsBefore = posts(drive.calls).length;
      const unchanged = await coordinator.publishUnchanged();
      equal(unchanged.status, 'verified', unchanged.reason);
      equal(unchanged.checkpoint.root.wireSha256, published.checkpoint.root.wireSha256);
      equal(posts(drive.calls).length, postsBefore);
      ok(snapshotOpenCount(tracker, published.packageSha256) >= 1);
    });
    vault.lock();
  });

  test('second publish authenticates the retained first witness with openSnapshot', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const firstInput = sealInput('retain-me');
      const first = await coordinator.publishSnapshot(firstInput);
      equal(first.status, 'verified', first.reason);
      const tracker = wrapOpenSnapshot(vault);
      const second = await coordinator.publishSnapshot(sealInput('next-live'));
      equal(second.status, 'verified', second.reason);
      ok(snapshotOpenCount(tracker, first.packageSha256) >= 1);
      ok(snapshotOpenCount(tracker, second.packageSha256) >= 1);
      const firstWitnessPosts = posts(drive.calls).filter((item) => {
        const body = Buffer.from(item.body ?? []).toString('utf8');
        return body.includes(`${first.packageSha256}.wpp`);
      });
      equal(firstWitnessPosts.length, 1);
      const restored = await coordinator.restoreSnapshot(
        second.checkpoint,
        first.packageSha256,
        expectedFromInput(firstInput),
      );
      equal(restored.status, 'verified', restored.reason);
      equal(restored.snapshot.content.message, 'retain-me');
    });
    vault.lock();
  });

  test('five unchanged updates do not grow observations', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const published = await coordinator.publishSnapshot(sealInput('steady'));
      equal(published.status, 'verified', published.reason);
      const before = observationCount(vault, drive, published.checkpoint);
      equal(before, 1);
      for (let i = 0; i < 5; i += 1) {
        const unchanged = await coordinator.publishUnchanged();
        equal(unchanged.status, 'verified', unchanged.reason);
        equal(unchanged.checkpoint.root.wireSha256, published.checkpoint.root.wireSha256);
      }
      equal(observationCount(vault, drive, published.checkpoint), 1);
    });
    vault.lock();
  });

  test('copies seal input before await so later caller mutation cannot change the binding', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      drive.hooks.beforeRequest = async () => {
        if (drive.calls.length === 1) {
          await gate;
        }
      };
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const input = sealInput('owned');
      const expected = expectedFromInput(input);
      const pending = coordinator.publishSnapshot(input);
      input.scopeId = 'A'.repeat(43);
      input.recordId = 'B'.repeat(43);
      input.payloadUtf8[0] ^= 0xff;
      release();
      const published = await pending;
      equal(published.status, 'verified', published.reason);
      const restored = await coordinator.restoreSnapshot(published.checkpoint, published.packageSha256, expected);
      equal(restored.status, 'verified', restored.reason);
      equal(restored.snapshot.content.message, 'owned');
    });
    vault.lock();
  });

  test('rejects concurrent reentry without advancing the checkpoint', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    await withJournal(async ({ journal }) => {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      drive.hooks.beforeRequest = async () => {
        if (drive.calls.length === 1) {
          await gate;
        }
      };
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const first = coordinator.publishSnapshot(sealInput('first'));
      const second = await coordinator.publishSnapshot(sealInput('second'));
      equal(second.status, 'incomplete');
      equal(second.reason, 'concurrent-operation');
      equal(second.previousCheckpoint, null);
      release();
      const published = await first;
      equal(published.status, 'verified', published.reason);
    });
    vault.lock();
  });

  test('new-vault mode does not infer a head from an empty provider listing', async () => {
    const { vault } = unlock();
    let listed = 0;
    const drive = memoryDrive();
    const inner = drive.request;
    drive.adapter = createGoogleDriveAdapter({
      permissionId: drive.adapter.permissionId,
      request: async (opts) => {
        const url = String(opts.url);
        if (url.includes('/drive/v3/files') && !url.includes('alt=media') && String(opts.method).toUpperCase() === 'GET') {
          listed += 1;
        }
        return inner(opts);
      },
    });
    const adapter = createGoogleDriveAdapter({
      permissionId: 'permId-opaque-stable-001',
      request: async (opts) => {
        const url = String(opts.url);
        if (
          new URL(url).pathname === '/drive/v3/files' &&
          String(opts.method).toUpperCase() === 'GET' &&
          !url.includes('alt=media')
        ) {
          listed += 1;
        }
        return drive.request(opts);
      },
    });
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const published = await coordinator.publishSnapshot(sealInput('fresh'));
      equal(published.status, 'verified', published.reason);
      equal(listed, 0);
    });
    vault.lock();
  });

  test('cold child restore equals the original witness without a journal', async () => {
    const { vault } = unlock();
    const drive = memoryDrive();
    const pack = vault.createRecoveryPack();
    await withJournal(async ({ journal }) => {
      const coordinator = new GoogleBackupCoordinator({
        vault,
        session: drive.adapter,
        journal,
        mode: { kind: 'new-vault' },
      });
      const input = sealInput('cold');
      const published = await coordinator.publishSnapshot(input);
      equal(published.status, 'verified', published.reason);
      vault.lock();
      const files = [];
      for (const [fileId, octets] of drive.files.entries()) {
        files.push({ fileId, b64: Buffer.from(octets).toString('base64') });
      }
      const child = spawnSync(process.execPath, [CHILD], {
        encoding: 'utf8',
        env: {
          ...process.env,
          WPP_BACKUP_CHILD_MESSAGE: JSON.stringify({
            permissionId: 'permId-opaque-stable-001',
            recoveryWireB64: Buffer.from(pack.wire).toString('base64'),
            recoveryKeyB64: Buffer.from(pack.recoveryKey).toString('base64'),
            checkpoint: published.checkpoint,
            packageSha256: published.packageSha256,
            expected: expectedFromInput(input),
            files,
          }),
        },
        timeout: 20000,
      });
      equal(child.status, 0, child.stderr);
      const receipt = JSON.parse(child.stdout.trim().split('\n').at(-1));
      equal(receipt.ok, true);
      equal(receipt.message, 'cold');
      equal(receipt.packageSha256, published.packageSha256);
    });
  });

  test('CLI --help prints flags and does not open a Google session', () => {
    const result = spawnSync(process.execPath, [CLI, '--help'], { encoding: 'utf8', timeout: 10000 });
    equal(result.status, 0, result.stderr);
    match(result.stdout, /--client-file/);
    match(result.stdout, /--state-dir/);
    match(result.stdout, /--cold-restore/);
    match(result.stdout, /new-vault/);
    equal(result.stdout.includes('ya29.'), false);
  });

  test('CLI refuses a client file inside the repository', async () => {
    const dir = await mkdtemp(join(process.cwd(), 'wpp-cli-'));
    try {
      const clientPath = join(ROOT, 'package.json');
      const result = spawnSync(
        process.execPath,
        [CLI, '--client-file', clientPath, '--state-dir', dir, '--mode', 'new-vault'],
        { encoding: 'utf8', timeout: 10000 },
      );
      equal(result.status, 1);
      match(result.stderr, /GOOGLE_CLIENT_CONFIG/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
