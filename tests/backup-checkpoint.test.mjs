import { deepEqual, equal, throws } from 'node:assert/strict';
import { lstatSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import {
  parseBackupCheckpoint,
  readBackupCheckpointFile,
  writeBackupCheckpointFile,
  BackupError,
} from '../dist/backup/index.js';

const SAMPLE = {
  format: 'wpp-backup-checkpoint',
  version: 1,
  root: {
    wireSha256: 'ab'.repeat(32),
    wireByteLength: 128,
    locator: {
      provider: 'google-drive',
      accountBinding: { scheme: 'google-drive-permission-id', value: 'permId-opaque-stable-001' },
      objectId: 'file-root-1',
      revisionId: null,
    },
  },
};

describe('backup checkpoint', () => {
  test('parses a closed version 1 record and rejects extra fields', () => {
    const parsed = parseBackupCheckpoint(SAMPLE);
    equal(parsed.format, 'wpp-backup-checkpoint');
    equal(parsed.version, 1);
    equal(parsed.root.wireSha256, SAMPLE.root.wireSha256);
    equal(parsed.root.locator.revisionId, null);
    throws(() => parseBackupCheckpoint({ ...SAMPLE, token: 'nope' }), (err) => {
      equal(err instanceof BackupError, true);
      equal(err.code, 'WPP_BACKUP_SCHEMA');
      return true;
    });
    throws(() => parseBackupCheckpoint({ ...SAMPLE, root: { ...SAMPLE.root, secretRoot: 'x' } }), (err) => {
      equal(err.code, 'WPP_BACKUP_SCHEMA');
      return true;
    });
  });

  test('caller mutation after parse does not change the owned checkpoint', () => {
    const input = structuredClone(SAMPLE);
    const parsed = parseBackupCheckpoint(input);
    input.root.wireSha256 = '00'.repeat(32);
    input.root.locator.objectId = 'mutated';
    equal(parsed.root.wireSha256, SAMPLE.root.wireSha256);
    equal(parsed.root.locator.objectId, 'file-root-1');
  });

  test('atomic 0600 persistence round-trips and contains no key fields', async () => {
    const dir = await mkdtemp(join(process.cwd(), 'wpp-checkpoint-'));
    try {
      const path = join(dir, 'checkpoint.json');
      writeBackupCheckpointFile(path, SAMPLE);
      const st = lstatSync(path);
      equal(st.isFile(), true);
      equal(st.mode & 0o777, 0o600);
      const raw = readFileSync(path, 'utf8');
      equal(raw.includes('secretRoot'), false);
      equal(raw.includes('token'), false);
      equal(raw.includes('recoveryKey'), false);
      const loaded = readBackupCheckpointFile(path);
      deepEqual(loaded, parseBackupCheckpoint(SAMPLE));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
