import { LIMIT_PACKAGE_BYTES, LIMIT_PLAINTEXT_BYTES, parseJsonBytes, wipeBytes } from "../kernel/json.js";
import { decodeBase64Url, decodeNonce12, decodeTag16, validatePackageWire } from "../kernel/validation.js";
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
  mapFsError,
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

const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

function intrinsicByteLength(bytes: Uint8Array): number {
  if (typeof TYPED_ARRAY_BYTE_LENGTH !== "function") {
    throw new JournalError("INVALID_INPUT");
  }
  try {
    const length = TYPED_ARRAY_BYTE_LENGTH.call(bytes);
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
      throw new JournalError("INVALID_INPUT");
    }
    return length;
  } catch (err) {
    if (err instanceof JournalError) {
      throw err;
    }
    throw new JournalError("INVALID_INPUT");
  }
}

function cloneBoundedWire(wire: Uint8Array): Uint8Array {
  if (!(wire instanceof Uint8Array)) {
    throw new JournalError("INVALID_INPUT");
  }
  const length = intrinsicByteLength(wire);
  if (length === 0 || length > LIMIT_PACKAGE_BYTES) {
    throw new JournalError("INVALID_INPUT");
  }
  const owned = new Uint8Array(length);
  try {
    Uint8Array.prototype.set.call(owned, wire);
  } catch {
    throw new JournalError("INVALID_INPUT");
  }
  return owned;
}

function assertSealedGrammar(wire: Uint8Array, digest: string): void {
  if (sha256Hex(wire) !== digest) {
    throw new JournalError("INVALID_INPUT");
  }
  // Grammar only. The journal has no AEAD key and does not prove authenticity.
  let nonce: Buffer | undefined;
  let tag: Buffer | undefined;
  let ciphertext: Buffer | undefined;
  try {
    const parsed = parseJsonBytes(wire, LIMIT_PACKAGE_BYTES);
    const pack = validatePackageWire(parsed);
    nonce = decodeNonce12(pack.header.nonce);
    tag = decodeTag16(pack.tag);
    ciphertext = decodeBase64Url(pack.ciphertext, LIMIT_PLAINTEXT_BYTES);
  } catch (err) {
    if (err instanceof JournalError) {
      throw err;
    }
    throw new JournalError("INVALID_INPUT");
  } finally {
    if (nonce !== undefined) {
      wipeBytes(nonce);
    }
    if (tag !== undefined) {
      wipeBytes(tag);
    }
    if (ciphertext !== undefined) {
      wipeBytes(ciphertext);
    }
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
    } catch (err) {
      throw err instanceof JournalError ? err : mapFsError(err, "record-get");
    } finally {
      await closeQuiet(handle);
    }
  }

  async list(): Promise<readonly string[]> {
    return listCommittedDigests(this.#dir);
  }
}
