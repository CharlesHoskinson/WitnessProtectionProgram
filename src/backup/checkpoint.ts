import { randomBytes } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  openSync,
  readSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { isProxy } from "node:util/types";

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

const SHA256_HEX_BODY = /^[0-9a-f]{64}/;
const PERMISSION_BODY = /^[A-Za-z0-9_.-]{1,128}/;
const OBJECT_BODY = /^[A-Za-z0-9_-]{1,128}/;
const FILE_MODE = 0o600;
const CHECKPOINT_MAX_BYTES = 16 * 1024;
const CHECKPOINT_READ_CEILING = CHECKPOINT_MAX_BYTES + 1;

const ROOT_KEYS = Object.freeze(["wireSha256", "wireByteLength", "locator"]);
const CHECKPOINT_KEYS = Object.freeze(["format", "version", "root"]);
const LOCATOR_KEYS = Object.freeze(["provider", "accountBinding", "objectId", "revisionId"]);
const BINDING_KEYS = Object.freeze(["scheme", "value"]);

function schemaFail(): never {
  throw new BackupError(ERR_BACKUP_SCHEMA);
}

function isAccessorDescriptor(desc: PropertyDescriptor): boolean {
  return desc.get !== undefined || desc.set !== undefined;
}

function ownExactObject(value: unknown, keys: readonly string[]): { [key: string]: unknown } {
  if (isProxy(value)) {
    schemaFail();
  }
  if (value === null || typeof value !== "object") {
    schemaFail();
  }
  if (Array.isArray(value)) {
    schemaFail();
  }
  let proto: object | null;
  try {
    proto = Object.getPrototypeOf(value);
  } catch {
    schemaFail();
  }
  if (proto !== Object.prototype && proto !== null) {
    schemaFail();
  }
  let symbols: symbol[];
  let names: string[];
  try {
    symbols = Object.getOwnPropertySymbols(value);
    names = Object.getOwnPropertyNames(value);
  } catch {
    schemaFail();
  }
  if (symbols.length !== 0 || names.length !== keys.length) {
    schemaFail();
  }
  const expected = new Set(keys);
  for (const name of names) {
    if (!expected.has(name)) {
      schemaFail();
    }
  }
  const owned = Object.create(null) as { [key: string]: unknown };
  for (const key of keys) {
    let desc: PropertyDescriptor | undefined;
    try {
      desc = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      schemaFail();
    }
    if (
      desc === undefined ||
      desc.enumerable !== true ||
      isAccessorDescriptor(desc) ||
      !Object.prototype.hasOwnProperty.call(desc, "value")
    ) {
      schemaFail();
    }
    owned[key] = desc.value;
  }
  return owned;
}

function assertBoundedToken(
  value: unknown,
  body: RegExp,
  minLength: number,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    schemaFail();
  }
  if (value.length < minLength || value.length > maxLength) {
    schemaFail();
  }
  const matched = body.exec(value);
  if (matched === null || matched.index !== 0 || matched[0].length !== value.length) {
    schemaFail();
  }
  return value;
}

function assertHexDigest(value: unknown): string {
  return assertBoundedToken(value, SHA256_HEX_BODY, 64, 64);
}

function assertPermissionId(value: unknown): string {
  return assertBoundedToken(value, PERMISSION_BODY, 1, 128);
}

function assertObjectId(value: unknown): string {
  return assertBoundedToken(value, OBJECT_BODY, 1, 128);
}

function assertWireLength(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > CATALOG_V2_LIMITS.rootWireBytes
  ) {
    schemaFail();
  }
  return value;
}

function parseLocator(value: unknown): GoogleDriveLocator {
  const locator = ownExactObject(value, LOCATOR_KEYS);
  if (locator.provider !== "google-drive") {
    schemaFail();
  }
  const binding = ownExactObject(locator.accountBinding, BINDING_KEYS);
  if (binding.scheme !== "google-drive-permission-id") {
    schemaFail();
  }
  const revisionId = locator.revisionId === null ? null : assertObjectId(locator.revisionId);
  return {
    provider: "google-drive",
    accountBinding: {
      scheme: "google-drive-permission-id",
      value: assertPermissionId(binding.value),
    },
    objectId: assertObjectId(locator.objectId),
    revisionId,
  };
}

export function parseBackupCheckpoint(value: unknown): BackupCheckpoint {
  const owned = ownExactObject(value, CHECKPOINT_KEYS);
  if (owned.format !== BACKUP_CHECKPOINT_FORMAT) {
    schemaFail();
  }
  if (owned.version !== BACKUP_CHECKPOINT_VERSION) {
    schemaFail();
  }
  const root = ownExactObject(owned.root, ROOT_KEYS);
  const checkpoint: BackupCheckpoint = {
    format: BACKUP_CHECKPOINT_FORMAT,
    version: BACKUP_CHECKPOINT_VERSION,
    root: {
      wireSha256: assertHexDigest(root.wireSha256),
      wireByteLength: assertWireLength(root.wireByteLength),
      locator: parseLocator(root.locator),
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

function closeQuiet(fd: number | undefined): void {
  if (fd === undefined) {
    return;
  }
  try {
    closeSync(fd);
  } catch {
    /* ignore */
  }
}

function readCheckpointBytes(path: string): Buffer {
  let fd: number | undefined;
  let buf: Buffer | undefined;
  try {
    const readFlag = fsConstants.O_RDONLY;
    const nonblockFlag = fsConstants.O_NONBLOCK;
    if (typeof readFlag !== "number" || typeof nonblockFlag !== "number") {
      throw new BackupError(ERR_BACKUP_IO);
    }
    fd = openSync(path, readFlag | nonblockFlag);
    const st = fstatSync(fd);
    if (typeof st.isFile !== "function" || st.isFile() !== true) {
      throw new BackupError(ERR_BACKUP_INTEGRITY);
    }
    buf = Buffer.alloc(CHECKPOINT_READ_CEILING);
    let offset = 0;
    while (offset < CHECKPOINT_READ_CEILING) {
      const n = readSync(fd, buf, offset, CHECKPOINT_READ_CEILING - offset, offset);
      if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) {
        throw new BackupError(ERR_BACKUP_IO);
      }
      if (n === 0) {
        break;
      }
      offset += n;
    }
    if (offset === 0 || offset > CHECKPOINT_MAX_BYTES) {
      throw new BackupError(ERR_BACKUP_INTEGRITY);
    }
    const owned = Buffer.from(buf.subarray(0, offset));
    wipeBytes(buf);
    buf = undefined;
    return owned;
  } catch (err) {
    return mapFs(err, false);
  } finally {
    closeQuiet(fd);
    if (buf !== undefined) {
      wipeBytes(buf);
    }
  }
}

export function readBackupCheckpointFile(path: string): BackupCheckpoint {
  if (typeof path !== "string" || path.length === 0) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  const bytes = readCheckpointBytes(path);
  try {
    const parsed = parseJsonBytes(bytes, CHECKPOINT_MAX_BYTES);
    return parseBackupCheckpoint(parsed);
  } catch (err) {
    if (err instanceof BackupError) {
      throw err;
    }
    throw new BackupError(ERR_BACKUP_INTEGRITY);
  } finally {
    wipeBytes(bytes);
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
    closeQuiet(fd);
    closeQuiet(dirFd);
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
