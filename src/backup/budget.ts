import { DRIVE_LIST_JSON_MAX_BYTES, DRIVE_LIST_MAX_PAGES } from "../google/types.js";
import { BackupAbort } from "./errors.js";
import { BACKUP_LIMITS, type BackupMetrics } from "./types.js";

export class OperationBudget {
  #reservedCalls = 0;
  #reservedBytes = 0;
  #startedMs: number;
  #deadlineMs: number;

  constructor(nowMs: number, deadlineMs?: number) {
    this.#startedMs = nowMs;
    this.#deadlineMs = deadlineMs ?? nowMs + BACKUP_LIMITS.maxOperationMs;
  }

  metrics(): BackupMetrics {
    return {
      reservedAdapterCalls: this.#reservedCalls,
      reservedUploadDownloadBytes: this.#reservedBytes,
    };
  }

  assertTime(nowMs: number): void {
    if (nowMs > this.#deadlineMs || nowMs - this.#startedMs > BACKUP_LIMITS.maxOperationMs) {
      throw new BackupAbort("time-exhausted");
    }
  }

  reservePut(ciphertextBytes: number): void {
    this.#addCalls(BACKUP_LIMITS.putReservedCalls);
    this.#addBytes(ciphertextBytes);
    this.#addBytes(ciphertextBytes);
  }

  reserveGet(maxResponseBytes: number): void {
    this.#addCalls(BACKUP_LIMITS.getReservedCalls);
    this.#addBytes(maxResponseBytes);
  }

  reserveList(): void {
    this.#addCalls(DRIVE_LIST_MAX_PAGES);
    this.#addBytes(DRIVE_LIST_MAX_PAGES * DRIVE_LIST_JSON_MAX_BYTES);
  }

  #addCalls(n: number): void {
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new BackupAbort("schema");
    }
    if (this.#reservedCalls > BACKUP_LIMITS.maxReservedAdapterCalls - n) {
      throw new BackupAbort("budget-exhausted");
    }
    this.#reservedCalls += n;
  }

  #addBytes(n: number): void {
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new BackupAbort("schema");
    }
    if (this.#reservedBytes > BACKUP_LIMITS.maxUploadedDownloadedBytes - n) {
      throw new BackupAbort("budget-exhausted");
    }
    this.#reservedBytes += n;
  }
}
