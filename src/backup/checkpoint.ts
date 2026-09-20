import { randomBytes } from "node:crypto";
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  CATALOG_V2_LIMITS,
  type CatalogV2Locator,
} from "../storage/catalog-v2.js";
import {
  ERR_SCHEMA,
  KernelError,
  canonicalizeJsonBytes,
  isolatedJsonView,
  parseJsonBytes,
  wipeBytes,
  type JsonValue,
} from "../kernel/json.js";
import { BackupError, ERR_BACKUP_INTEGRITY, ERR_BACKUP_IO, ERR_BACKUP_SCHEMA } from "./errors.js";
import {
  BACKUP_CHECKPOINT_FORMAT,
  BACKUP_CHECKPOINT_VERSION,
  type BackupCheckpoint,
  type GoogleDriveLocator,
} from "./types.js";

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const PERMISSION_RE = /^[A-Za-z0-9_.-]{1,128}$/;
const OBJECT_RE = /^[A-Za-z0-9_-]{1,128}$/;
const FILE_MODE = 0o600;
const CHECKPOINT_MAX_BYTES = 16 * 1024;

const ROOT_KEYS = Object.freeze(["wireSha256", "wireByteLength", "locator"]);
const CHECKPOINT_KEYS = Object.freeze(["format", "version", "root"]);
const LOCATOR_KEYS = Object.freeze(["provider", "accountBinding", "objectId", "revisionId"]);
const BINDING_KEYS = Object.freeze(["scheme", "value"]);

function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value: object, keys: readonly string[]): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new BackupError(ERR_BACKUP_SCHEMA);
    }
  }
}

function assertHexDigest(value: unknown): string {
  if (typeof value !== "string" || !SHA256_HEX_RE.test(value)) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  return value;
}

function assertWireLength(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > CATALOG_V2_LIMITS.rootWireBytes
  ) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  return value;
}

function parseLocator(value: unknown): GoogleDriveLocator {
  if (!isPlainObject(value)) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  assertExactKeys(value, LOCATOR_KEYS);
  if (value.provider !== "google-drive") {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  if (!isPlainObject(value.accountBinding)) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  assertExactKeys(value.accountBinding, BINDING_KEYS);
  if (value.accountBinding.scheme !== "google-drive-permission-id") {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  if (typeof value.accountBinding.value !== "string" || !PERMISSION_RE.test(value.accountBinding.value)) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  if (typeof value.objectId !== "string" || !OBJECT_RE.test(value.objectId)) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  if (value.revisionId !== null && (typeof value.revisionId !== "string" || !OBJECT_RE.test(value.revisionId))) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  return {
    provider: "google-drive",
    accountBinding: {
      scheme: "google-drive-permission-id",
      value: value.accountBinding.value,
    },
    objectId: value.objectId,
    revisionId: value.revisionId,
  };
}

export function parseBackupCheckpoint(value: unknown): BackupCheckpoint {
  let owned: JsonValue;
  try {
    owned = isolatedJsonView(value as JsonValue);
  } catch {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  if (!isPlainObject(owned)) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  assertExactKeys(owned, CHECKPOINT_KEYS);
  if (owned.format !== BACKUP_CHECKPOINT_FORMAT) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  if (owned.version !== BACKUP_CHECKPOINT_VERSION) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  if (!isPlainObject(owned.root)) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  assertExactKeys(owned.root, ROOT_KEYS);
  const checkpoint: BackupCheckpoint = {
    format: BACKUP_CHECKPOINT_FORMAT,
    version: BACKUP_CHECKPOINT_VERSION,
    root: {
      wireSha256: assertHexDigest(owned.root.wireSha256),
      wireByteLength: assertWireLength(owned.root.wireByteLength),
      locator: parseLocator(owned.root.locator),
    },
  };
  return isolatedJsonView(checkpoint as unknown as JsonValue) as unknown as BackupCheckpoint;
}

export function catalogLocatorFromCheckpoint(locator: GoogleDriveLocator): CatalogV2Locator {
  return {
    provider: "google-drive",
    accountBinding: {
      scheme: "google-drive-permission-id",
      value: locator.accountBinding.value,
    },
    objectId: locator.objectId,
    revisionId: locator.revisionId,
  };
}

export function locatorFromReceipt(
  permissionId: string,
  fileId: string,
  revisionId: string | null = null,
): GoogleDriveLocator {
  return parseLocator({
    provider: "google-drive",
    accountBinding: {
      scheme: "google-drive-permission-id",
      value: permissionId,
    },
    objectId: fileId,
    revisionId,
  });
}

function mapFs(err: unknown, integrity: boolean): never {
  if (err instanceof BackupError) {
    throw err;
  }
  if (err instanceof KernelError && err.code === ERR_SCHEMA) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  throw new BackupError(integrity ? ERR_BACKUP_INTEGRITY : ERR_BACKUP_IO);
}

export function readBackupCheckpointFile(path: string): BackupCheckpoint {
  if (typeof path !== "string" || path.length === 0) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (err) {
    mapFs(err, false);
  }
  if (bytes.byteLength === 0 || bytes.byteLength > CHECKPOINT_MAX_BYTES) {
    throw new BackupError(ERR_BACKUP_INTEGRITY);
  }
  try {
    const parsed = parseJsonBytes(bytes, CHECKPOINT_MAX_BYTES);
    return parseBackupCheckpoint(parsed);
  } catch (err) {
    if (err instanceof BackupError) {
      throw err;
    }
    throw new BackupError(ERR_BACKUP_INTEGRITY);
  }
}

export async function readBackupCheckpointFileAsync(path: string): Promise<BackupCheckpoint> {
  return readBackupCheckpointFile(path);
}

export function writeBackupCheckpointFile(path: string, checkpoint: BackupCheckpoint): void {
  if (typeof path !== "string" || path.length === 0) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  const owned = parseBackupCheckpoint(checkpoint);
  const dir = dirname(path);
  const tmp = join(dir, `.wpp-checkpoint-${randomBytes(16).toString("hex")}`);
  const payload = canonicalizeJsonBytes(owned as unknown as JsonValue);
  let fd: number | undefined;
  let dirFd: number | undefined;
  try {
    fd = openSync(tmp, "wx", FILE_MODE);
    let offset = 0;
    while (offset < payload.byteLength) {
      const written = writeSync(fd, payload, offset, payload.byteLength - offset, offset);
      if (written <= 0) {
        throw new BackupError(ERR_BACKUP_IO);
      }
      offset += written;
    }
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, path);
    dirFd = openSync(dir, "r");
    fsyncSync(dirFd);
    closeSync(dirFd);
    dirFd = undefined;
  } catch (err) {
    try {
      if (fd !== undefined) {
        closeSync(fd);
      }
    } catch {
      /* ignore */
    }
    try {
      if (dirFd !== undefined) {
        closeSync(dirFd);
      }
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    mapFs(err, false);
  } finally {
    wipeBytes(payload);
  }
}

export async function writeBackupCheckpointFileAsync(
  path: string,
  checkpoint: BackupCheckpoint,
): Promise<void> {
  writeBackupCheckpointFile(path, checkpoint);
}
