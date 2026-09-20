export class BackupError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "BackupError";
    this.code = code;
  }
}

export const ERR_BACKUP_SCHEMA = "WPP_BACKUP_SCHEMA";
export const ERR_BACKUP_IO = "WPP_BACKUP_IO";
export const ERR_BACKUP_INTEGRITY = "WPP_BACKUP_INTEGRITY";

export class BackupAbort extends Error {
  readonly reason: string;
  readonly localUnsynced: boolean;

  constructor(reason: string, localUnsynced = false) {
    super(reason);
    this.name = "BackupAbort";
    this.reason = reason;
    this.localUnsynced = localUnsynced;
  }
}
