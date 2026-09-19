import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs";
import type { Dir, Stats } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export type JournalErrorCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_PLATFORM"
  | "UNSUPPORTED_FILESYSTEM"
  | "UNSAFE_PATH"
  | "INTEGRITY"
  | "NOT_FOUND"
  | "INCOMPLETE"
  | "IO";

export class JournalError extends Error {
  readonly code: JournalErrorCode;

  constructor(code: JournalErrorCode) {
    super(code);
    this.name = "JournalError";
    this.code = code;
  }
}

export const EXT_FAMILY_FSTYPE = 0xef53n;
export const DIR_MODE = 0o700;
export const FILE_MODE = 0o600;
export const LIST_BOUND = 10000;
export const COMMITTED_RE = /^[0-9a-f]{64}\.wpp$/;
export const TEMP_RE = /^\.wpp-tmp-[0-9a-f]{32}$/;
export const DIGEST_RE = /^[0-9a-f]{64}$/;
const TEMP_CREATE_TRIES = 8;
const READ_CHUNK = 64 * 1024;

export type FsContext = "path" | "record-get" | "record-put" | "temp" | "io";

function promises(): typeof fs.promises {
  return fs.promises;
}

function constants(): typeof fs.constants {
  return fs.constants;
}

export function errnoOf(err: unknown): string | undefined {
  if (err !== null && typeof err === "object" && "code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "string") {
      return code;
    }
  }
  return undefined;
}

export function mapFsError(err: unknown, context: FsContext): JournalError {
  if (err instanceof JournalError) {
    return err;
  }
  const code = errnoOf(err);
  if (context === "path") {
    if (
      code === "ENOENT" ||
      code === "ELOOP" ||
      code === "ENOTDIR" ||
      code === "EISDIR" ||
      code === "EACCES" ||
      code === "EPERM" ||
      code === "ENAMETOOLONG" ||
      code === "ENXIO"
    ) {
      return new JournalError("UNSAFE_PATH");
    }
    return new JournalError("IO");
  }
  if (context === "record-get") {
    if (code === "ENOENT") {
      return new JournalError("NOT_FOUND");
    }
    if (code === "ELOOP" || code === "EISDIR" || code === "ENOTDIR" || code === "ENXIO") {
      return new JournalError("INTEGRITY");
    }
    return new JournalError("IO");
  }
  if (context === "record-put") {
    if (code === "ELOOP" || code === "EISDIR" || code === "ENOTDIR" || code === "ENXIO") {
      return new JournalError("INTEGRITY");
    }
    return new JournalError("IO");
  }
  return new JournalError("IO");
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

export function effectiveUid(): number {
  if (typeof process.geteuid !== "function") {
    throw new JournalError("UNSUPPORTED_PLATFORM");
  }
  return process.geteuid();
}

export function assertLinux(): void {
  if (process.platform !== "linux" || typeof process.geteuid !== "function") {
    throw new JournalError("UNSUPPORTED_PLATFORM");
  }
}

function fileFlags(): number {
  const c = constants();
  return c.O_RDONLY | c.O_NOFOLLOW | c.O_NONBLOCK;
}

function tempFlags(): number {
  const c = constants();
  return c.O_WRONLY | c.O_CREAT | c.O_EXCL | c.O_NOFOLLOW | c.O_NONBLOCK;
}

function dirFlags(): number {
  const c = constants();
  return c.O_RDONLY | c.O_DIRECTORY | c.O_NOFOLLOW | c.O_NONBLOCK;
}

export async function closeQuiet(fh: FileHandle | undefined): Promise<void> {
  if (fh === undefined) {
    return;
  }
  try {
    await fh.close();
  } catch {
    return;
  }
}

async function closeDirQuiet(dir: Dir | undefined): Promise<void> {
  if (dir === undefined) {
    return;
  }
  try {
    await dir.close();
  } catch {
    return;
  }
}

export async function unlinkQuiet(path: string): Promise<void> {
  try {
    await promises().unlink(path);
  } catch {
    return;
  }
}

export async function lstatPath(path: string, context: FsContext): Promise<Stats> {
  try {
    return await promises().lstat(path);
  } catch (err) {
    throw mapFsError(err, context);
  }
}

export async function statfsType(path: string): Promise<bigint> {
  try {
    const st = await promises().statfs(path);
    return typeof st.type === "bigint" ? st.type : BigInt(st.type);
  } catch (err) {
    throw mapFsError(err, "path");
  }
}

export function assertExtFamily(type: bigint): void {
  if (type !== EXT_FAMILY_FSTYPE) {
    throw new JournalError("UNSUPPORTED_FILESYSTEM");
  }
}

function assertOwner(st: Stats): void {
  if (st.uid !== effectiveUid()) {
    throw new JournalError("UNSAFE_PATH");
  }
}

function assertJournalMode(st: Stats): void {
  if ((st.mode & 0o777) !== DIR_MODE) {
    throw new JournalError("UNSAFE_PATH");
  }
}

function assertParentWritableBits(st: Stats): void {
  if ((st.mode & 0o022) !== 0) {
    throw new JournalError("UNSAFE_PATH");
  }
}

function assertDirectory(st: Stats): void {
  if (st.isSymbolicLink() || !st.isDirectory()) {
    throw new JournalError("UNSAFE_PATH");
  }
}

export function assertRegularOwnedFile(st: Stats, context: FsContext): void {
  const code: JournalErrorCode =
    context === "record-get" || context === "record-put" ? "INTEGRITY" : context === "temp" ? "IO" : "UNSAFE_PATH";
  if (!st.isFile()) {
    throw new JournalError(code);
  }
  if (st.uid !== effectiveUid()) {
    throw new JournalError(code);
  }
  if ((st.mode & 0o777) !== FILE_MODE) {
    throw new JournalError(code);
  }
}

async function openRaw(path: string, flags: number, mode: number | undefined, context: FsContext): Promise<FileHandle> {
  try {
    if (mode === undefined) {
      return await promises().open(path, flags);
    }
    return await promises().open(path, flags, mode);
  } catch (err) {
    throw mapFsError(err, context);
  }
}

export async function fsyncHandle(fh: FileHandle, context: FsContext): Promise<void> {
  try {
    await fh.sync();
  } catch (err) {
    throw mapFsError(err, context);
  }
}

export async function fsyncDirectory(path: string, context: FsContext): Promise<void> {
  const fh = await openRaw(path, dirFlags(), undefined, context);
  try {
    const st = await fh.stat();
    if (!st.isDirectory()) {
      throw new JournalError(context === "path" ? "UNSAFE_PATH" : "IO");
    }
    await fsyncHandle(fh, context);
  } catch (err) {
    throw err instanceof JournalError ? err : mapFsError(err, context);
  } finally {
    await closeQuiet(fh);
  }
}

async function inspectDirFd(path: string, context: FsContext): Promise<Stats> {
  const fh = await openRaw(path, dirFlags(), undefined, context);
  try {
    return await fh.stat();
  } catch (err) {
    throw err instanceof JournalError ? err : mapFsError(err, context);
  } finally {
    await closeQuiet(fh);
  }
}

export function resolveJournalPath(directory: string): { dir: string; parent: string; leaf: string } {
  if (typeof directory !== "string" || directory.length === 0 || directory.includes("\0")) {
    throw new JournalError("INVALID_INPUT");
  }
  const dir = resolve(directory);
  const leaf = basename(dir);
  const parent = dirname(dir);
  if (leaf.length === 0 || leaf === "." || leaf === ".." || leaf.includes("\0")) {
    throw new JournalError("UNSAFE_PATH");
  }
  if (parent.length === 0) {
    throw new JournalError("UNSAFE_PATH");
  }
  return { dir, parent, leaf };
}

async function assertTrustedParent(parent: string): Promise<void> {
  let lst: Stats;
  try {
    lst = await promises().lstat(parent);
  } catch (err) {
    throw mapFsError(err, "path");
  }
  assertExtFamily(await statfsType(parent));
  assertDirectory(lst);
  assertOwner(lst);
  assertParentWritableBits(lst);
  const st = await inspectDirFd(parent, "path");
  if (!st.isDirectory()) {
    throw new JournalError("UNSAFE_PATH");
  }
  assertOwner(st);
  assertParentWritableBits(st);
}

async function assertJournalDirectory(dir: string): Promise<void> {
  let lst: Stats;
  try {
    lst = await promises().lstat(dir);
  } catch (err) {
    throw mapFsError(err, "path");
  }
  if (lst.isSymbolicLink() || !lst.isDirectory()) {
    throw new JournalError("UNSAFE_PATH");
  }
  assertExtFamily(await statfsType(dir));
  const st = await inspectDirFd(dir, "path");
  if (!st.isDirectory()) {
    throw new JournalError("UNSAFE_PATH");
  }
  assertOwner(st);
  assertJournalMode(st);
}

export async function openJournalDirectory(directory: string): Promise<string> {
  assertLinux();
  const { dir, parent } = resolveJournalPath(directory);
  await assertTrustedParent(parent);
  let existed = true;
  try {
    await promises().lstat(dir);
  } catch (err) {
    if (errnoOf(err) !== "ENOENT") {
      throw mapFsError(err, "path");
    }
    existed = false;
  }
  if (!existed) {
    try {
      await promises().mkdir(dir, { mode: DIR_MODE });
    } catch (err) {
      if (errnoOf(err) !== "EEXIST") {
        throw mapFsError(err, "path");
      }
    }
  }
  await fsyncDirectory(parent, "path");
  await assertJournalDirectory(dir);
  return dir;
}

export async function createExclusiveTemp(dir: string): Promise<{ path: string; handle: FileHandle }> {
  for (let i = 0; i < TEMP_CREATE_TRIES; i += 1) {
    const name = `.wpp-tmp-${randomBytes(16).toString("hex")}`;
    const path = join(dir, name);
    try {
      const handle = await promises().open(path, tempFlags(), FILE_MODE);
      try {
        const st = await handle.stat();
        assertRegularOwnedFile(st, "temp");
        return { path, handle };
      } catch (err) {
        await closeQuiet(handle);
        await unlinkQuiet(path);
        throw err instanceof JournalError ? err : mapFsError(err, "temp");
      }
    } catch (err) {
      if (errnoOf(err) === "EEXIST") {
        continue;
      }
      throw err instanceof JournalError ? err : mapFsError(err, "temp");
    }
  }
  throw new JournalError("IO");
}

export async function writeFully(handle: FileHandle, bytes: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) {
    let result: { bytesWritten: number };
    try {
      result = await handle.write(bytes, offset, bytes.byteLength - offset, offset);
    } catch (err) {
      throw mapFsError(err, "temp");
    }
    if (result.bytesWritten <= 0) {
      throw new JournalError("IO");
    }
    offset += result.bytesWritten;
  }
}

export async function linkNoReplace(existing: string, target: string): Promise<"created" | "exists"> {
  try {
    await promises().link(existing, target);
    return "created";
  } catch (err) {
    if (errnoOf(err) === "EEXIST") {
      return "exists";
    }
    throw mapFsError(err, "record-put");
  }
}

export async function openCommittedFile(path: string, context: "record-get" | "record-put"): Promise<FileHandle> {
  return openRaw(path, fileFlags(), undefined, context);
}

export async function readBounded(handle: FileHandle, limit: number, context: FsContext): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    if (total > limit) {
      throw new JournalError(context === "temp" ? "IO" : "INTEGRITY");
    }
    const remain = limit - total + 1;
    const buf = new Uint8Array(Math.min(READ_CHUNK, remain));
    let result: { bytesRead: number };
    try {
      result = await handle.read(buf, 0, buf.byteLength, total);
    } catch (err) {
      throw mapFsError(err, context);
    }
    if (result.bytesRead === 0) {
      break;
    }
    total += result.bytesRead;
    if (total > limit) {
      throw new JournalError(context === "temp" ? "IO" : "INTEGRITY");
    }
    chunks.push(buf.subarray(0, result.bytesRead));
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function committedPath(dir: string, digest: string): string {
  return join(dir, `${digest}.wpp`);
}

export function parseDigest(value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new JournalError("INVALID_INPUT");
  }
  if (value.includes("\0")) {
    throw new JournalError("INVALID_INPUT");
  }
  if (value.includes("/") || value.includes("\\") || value.includes("..")) {
    throw new JournalError("UNSAFE_PATH");
  }
  if (!DIGEST_RE.test(value)) {
    throw new JournalError("INVALID_INPUT");
  }
  return value;
}

export async function listCommittedDigests(dir: string): Promise<readonly string[]> {
  let handle: Dir | undefined;
  try {
    handle = await promises().opendir(dir);
  } catch (err) {
    throw mapFsError(err, "path");
  }
  const digests: string[] = [];
  let count = 0;
  try {
    for await (const entry of handle) {
      count += 1;
      if (count > LIST_BOUND) {
        throw new JournalError("INCOMPLETE");
      }
      const name = entry.name;
      if (TEMP_RE.test(name)) {
        continue;
      }
      if (COMMITTED_RE.test(name)) {
        digests.push(name.slice(0, 64));
        continue;
      }
      throw new JournalError("INTEGRITY");
    }
  } catch (err) {
    throw err instanceof JournalError ? err : mapFsError(err, "path");
  } finally {
    await closeDirQuiet(handle);
  }
  digests.sort();
  return Object.freeze(digests);
}
