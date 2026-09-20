import type { OpenResult, SealInput, ExpectedSnapshot } from "../kernel/vault.js";
import type { UnlockedVault } from "../kernel/vault.js";
import type { GoogleDriveSession } from "../google/drive.js";
import type { CiphertextJournal } from "../journal/index.js";

export const BACKUP_CHECKPOINT_FORMAT = "wpp-backup-checkpoint" as const;
export const BACKUP_CHECKPOINT_VERSION = 1 as const;

export const BACKUP_LIMITS = Object.freeze({
  maxUploadedDownloadedBytes: 2 * 1024 * 1024 * 1024,
  maxReservedAdapterCalls: 50_000,
  maxOperationMs: 30 * 60 * 1000,
  listReservedCalls: 100,
  listReservedJsonBytes: 100 * 1024 * 1024,
  putReservedCalls: 2,
  getReservedCalls: 1,
  maxLocatorsPerObject: 4,
});

export const INCOMPLETE_REASONS = Object.freeze([
  "locked",
  "concurrent-operation",
  "stale-parent",
  "unresolved-fork",
  "capacity",
  "budget-exhausted",
  "time-exhausted",
  "provider-incomplete",
  "authentication-failed",
  "binding-mismatch",
  "missing-object",
  "corrupt-object",
  "wrong-account",
  "interrupted",
  "missing-journal",
  "unsupported",
  "local-unsynced",
  "child-preflight-failed",
  "schema",
  "checkpoint-required",
] as const);

export type BackupIncompleteReason = (typeof INCOMPLETE_REASONS)[number];

export interface GoogleDriveLocator {
  provider: "google-drive";
  accountBinding: {
    scheme: "google-drive-permission-id";
    value: string;
  };
  objectId: string;
  revisionId: string | null;
}

export interface BackupCheckpoint {
  format: "wpp-backup-checkpoint";
  version: 1;
  root: {
    wireSha256: string;
    wireByteLength: number;
    locator: GoogleDriveLocator;
  };
}

export interface BackupMetrics {
  reservedAdapterCalls: number;
  reservedUploadDownloadBytes: number;
}

export type BackupMode =
  | { kind: "new-vault" }
  | { kind: "selected-checkpoint"; checkpoint: BackupCheckpoint };

export interface CoordinatorOptions {
  vault: UnlockedVault;
  session: GoogleDriveSession;
  journal?: CiphertextJournal;
  mode: BackupMode;
  checkpointPath?: string;
  deadlineMs?: number;
}

export type PublishResult =
  | {
      status: "verified";
      checkpoint: BackupCheckpoint;
      packageSha256: string;
      metrics: BackupMetrics;
    }
  | {
      status: "incomplete";
      reason: BackupIncompleteReason;
      previousCheckpoint: BackupCheckpoint | null;
      localUnsynced: boolean;
    };

export type RestoreResult =
  | {
      status: "verified";
      snapshot: OpenResult;
      checkpoint: BackupCheckpoint;
    }
  | {
      status: "incomplete";
      reason: BackupIncompleteReason;
      previousCheckpoint: BackupCheckpoint | null;
    };

export interface ColdRestoreInput {
  vault: UnlockedVault;
  session: GoogleDriveSession;
  checkpoint: BackupCheckpoint;
  packageSha256: string;
  expected: ExpectedSnapshot;
}

export type { OpenResult, SealInput, ExpectedSnapshot };
