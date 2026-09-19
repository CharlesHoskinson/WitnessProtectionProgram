import { LIMIT_PACKAGE_BYTES, parseJsonBytes } from "../kernel/json.js";
import { validatePackageWire } from "../kernel/validation.js";
import {
  JournalError,
  assertRegularOwnedFile,
  bytesEqual,
  closeQuiet,
  committedPath,
  createExclusiveTemp,
  fsyncDirectory,
  fsyncHandle,
  linkNoReplace,
  listCommittedDigests,
  openCommittedFile,
  openJournalDirectory,
  parseDigest,
  readBounded,
  sha256Hex,
  unlinkQuiet,
  writeFully,
  type JournalErrorCode,
} from "./fs.js";

export { JournalError, type JournalErrorCode };

export interface SealedPackage {
  wire: Uint8Array;
  sha256: string;
}

export interface PutResult {
  sha256: string;
  byteLength: number;
  status: "local-durable";
}

function cloneBoundedWire(wire: Uint8Array): Uint8Array {
  if (!(wire instanceof Uint8Array)) {
    throw new JournalError("INVALID_INPUT");
  }
  if (wire.byteLength === 0 || wire.byteLength > LIMIT_PACKAGE_BYTES) {
    throw new JournalError("INVALID_INPUT");
  }
  const owned = new Uint8Array(wire.byteLength);
  owned.set(wire);
  return owned;
}

function assertSealedGrammar(wire: Uint8Array, digest: string): void {
  if (sha256Hex(wire) !== digest) {
    throw new JournalError("INVALID_INPUT");
  }
  try {
    const parsed = parseJsonBytes(wire, LIMIT_PACKAGE_BYTES);
    validatePackageWire(parsed);
  } catch (err) {
    if (err instanceof JournalError) {
      throw err;
    }
    throw new JournalError("INVALID_INPUT");
  }
}

function cloneAndValidate(sealed: SealedPackage): { wire: Uint8Array; sha256: string } {
  if (sealed === null || typeof sealed !== "object") {
    throw new JournalError("INVALID_INPUT");
  }
  const digest = sealed.sha256;
  if (typeof digest !== "string") {
    throw new JournalError("INVALID_INPUT");
  }
  parseDigest(digest);
  const wire = cloneBoundedWire(sealed.wire);
  assertSealedGrammar(wire, digest);
  return { wire, sha256: digest };
}

async function verifyPublished(
  path: string,
  expected: Uint8Array,
  digest: string,
): Promise<void> {
  const handle = await openCommittedFile(path, "record-put");
  try {
    const st = await handle.stat();
    assertRegularOwnedFile(st, "record-put");
    const bytes = await readBounded(handle, LIMIT_PACKAGE_BYTES, "record-put");
    if (!bytesEqual(bytes, expected) || sha256Hex(bytes) !== digest) {
      throw new JournalError("INTEGRITY");
    }
    await fsyncHandle(handle, "record-put");
  } finally {
    await closeQuiet(handle);
  }
}

export class CiphertextJournal {
  readonly #dir: string;

  private constructor(dir: string) {
    this.#dir = dir;
  }

  static async open(directory: string): Promise<CiphertextJournal> {
    const dir = await openJournalDirectory(directory);
    return new CiphertextJournal(dir);
  }

  async put(sealed: SealedPackage): Promise<PutResult> {
    const owned = cloneAndValidate(sealed);
    const target = committedPath(this.#dir, owned.sha256);
    let tempPath: string | undefined;
    let tempHandle: Awaited<ReturnType<typeof createExclusiveTemp>>["handle"] | undefined;
    try {
      const created = await createExclusiveTemp(this.#dir);
      tempPath = created.path;
      tempHandle = created.handle;
      await writeFully(tempHandle, owned.wire);
      await fsyncHandle(tempHandle, "temp");
      await closeQuiet(tempHandle);
      tempHandle = undefined;
      await linkNoReplace(tempPath, target);
      await verifyPublished(target, owned.wire, owned.sha256);
      await fsyncDirectory(this.#dir, "io");
      return {
        sha256: owned.sha256,
        byteLength: owned.wire.byteLength,
        status: "local-durable",
      };
    } catch (err) {
      throw err instanceof JournalError ? err : new JournalError("IO");
    } finally {
      await closeQuiet(tempHandle);
      if (tempPath !== undefined) {
        await unlinkQuiet(tempPath);
      }
    }
  }

  async get(sha256: string): Promise<Uint8Array> {
    const digest = parseDigest(sha256);
    const path = committedPath(this.#dir, digest);
    const handle = await openCommittedFile(path, "record-get");
    try {
      const st = await handle.stat();
      assertRegularOwnedFile(st, "record-get");
      const bytes = await readBounded(handle, LIMIT_PACKAGE_BYTES, "record-get");
      if (sha256Hex(bytes) !== digest) {
        throw new JournalError("INTEGRITY");
      }
      return bytes;
    } finally {
      await closeQuiet(handle);
    }
  }

  async list(): Promise<readonly string[]> {
    return listCommittedDigests(this.#dir);
  }
}
