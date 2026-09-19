import { randomBytes } from "node:crypto";
import {
  ERR_CODEC,
  ERR_CODEC_UNKNOWN,
  ERR_EPOCH,
  ERR_INPUT_TOO_LARGE,
  ERR_LOCKED,
  ERR_RANDOM,
  ERR_RECOVERY,
  ERR_ROOT,
  ERR_UNSUPPORTED,
  KernelError,
  LIMIT_HEADER_CANONICAL_BYTES,
  LIMIT_PACKAGE_BYTES,
  LIMIT_PLAINTEXT_BYTES,
  LIMIT_RECOVERY_WIRE_BYTES,
  LIMIT_ROOT_BYTES,
  assertByteCeiling,
  assertCanonicalPayloadBytes,
  canonicalizeJsonBytes,
  parseJsonBytes,
  wipeBytes,
  type JsonValue,
} from "./json.js";
import { aeadDecrypt, aeadEncrypt, canonicalAad, deriveKeys, sha256Hex, wipeDerivedKeys } from "./crypto.js";
import {
  NATIVE_CODEC_ID,
  assertExpectedBinding,
  decodeBase64Url,
  decodeId16,
  decodeId32,
  decodeNonce12,
  decodeTag16,
  encodeBase64Url,
  validateCodecPolicies,
  validateExpectedSnapshot,
  validatePackageWire,
  validateRecoveryWire,
  validateRootRecord,
  validateSnapshotPayload,
  type CodecPolicy,
  type ExpectedSnapshot,
  type RootEpoch,
  type RootRecord,
  type SnapshotHeader,
  type SnapshotMetadata,
  type SnapshotPayload,
} from "./validation.js";

export type { CodecPolicy, ExpectedSnapshot, SnapshotHeader, SnapshotMetadata } from "./validation.js";

export interface SealInput {
  scopeId: string;
  recordId: string;
  payloadUtf8: Uint8Array;
}

export interface SealResult {
  wire: Uint8Array;
  sha256: string;
}

export interface OpenResult {
  header: SnapshotHeader;
  metadata: SnapshotMetadata;
  content: JsonValue;
  packageSha256: string;
}

export interface RecoveryPack {
  wire: Uint8Array;
  recoveryKey: Uint8Array;
}

interface OwnedEpoch {
  rootEpoch: string;
  secretRoot: Buffer;
  status: RootEpoch["status"];
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out;
}

function freshRandom(size: number): Buffer {
  try {
    const bytes = randomBytes(size);
    if (!Buffer.isBuffer(bytes) || bytes.byteLength !== size) {
      throw new KernelError(ERR_RANDOM);
    }
    return bytes;
  } catch (err) {
    if (err instanceof KernelError) {
      throw err;
    }
    throw new KernelError(ERR_RANDOM);
  }
}

function lookupCodec(registry: Map<string, CodecPolicy>, codecId: string): CodecPolicy {
  if (codecId === NATIVE_CODEC_ID) {
    throw new KernelError(ERR_UNSUPPORTED);
  }
  const policy = registry.get(codecId);
  if (policy === undefined) {
    throw new KernelError(ERR_CODEC_UNKNOWN);
  }
  return policy;
}

function runCodec(policy: CodecPolicy, content: JsonValue, metadata: SnapshotMetadata): void {
  try {
    policy.validate(content, metadata);
  } catch (err) {
    if (err instanceof KernelError) {
      throw new KernelError(ERR_CODEC);
    }
    throw new KernelError(ERR_CODEC);
  }
}

function parseRoot(rootUtf8: Uint8Array): RootRecord {
  const parsed = parseJsonBytes(rootUtf8, LIMIT_ROOT_BYTES);
  return validateRootRecord(parsed);
}

function parsePayload(payloadUtf8: Uint8Array): SnapshotPayload {
  const parsed = parseJsonBytes(payloadUtf8, LIMIT_PLAINTEXT_BYTES);
  return validateSnapshotPayload(parsed);
}

function activeEpoch(epochs: readonly OwnedEpoch[]): OwnedEpoch {
  for (const epoch of epochs) {
    if (epoch.status === "active") {
      return epoch;
    }
  }
  throw new KernelError(ERR_ROOT);
}

function epochById(epochs: readonly OwnedEpoch[], rootEpoch: string): OwnedEpoch {
  for (const epoch of epochs) {
    if (epoch.rootEpoch === rootEpoch) {
      return epoch;
    }
  }
  throw new KernelError(ERR_EPOCH);
}

export class UnlockedVault {
  #locked = false;
  #codecs: Map<string, CodecPolicy> | undefined;
  #vaultId: string | undefined;
  #vaultSalt: string | undefined;
  #epochs: OwnedEpoch[] | undefined;
  #canonicalRoot: Buffer | undefined;

  private constructor() {}

  get locked(): boolean {
    return this.#locked;
  }

  static fromRootRecord(rootUtf8: Uint8Array, codecs: readonly CodecPolicy[]): UnlockedVault {
    const registry = validateCodecPolicies(codecs);
    const root = parseRoot(rootUtf8);
    return UnlockedVault.#open(root, registry);
  }

  static fromRecoveryPack(
    wire: Uint8Array,
    recoveryKey: Uint8Array,
    codecs: readonly CodecPolicy[],
  ): UnlockedVault {
    const registry = validateCodecPolicies(codecs);
    if (recoveryKey.byteLength !== 32) {
      throw new KernelError(ERR_RECOVERY);
    }
    const keyCopy = Buffer.from(recoveryKey);
    let plaintext: Buffer | undefined;
    try {
      const parsed = parseJsonBytes(wire, LIMIT_RECOVERY_WIRE_BYTES);
      const pack = validateRecoveryWire(parsed);
      const nonce = decodeNonce12(pack.header.nonce);
      const tag = decodeTag16(pack.tag);
      const ciphertext = decodeBase64Url(pack.ciphertext, LIMIT_ROOT_BYTES);
      const aad = canonicalAad(pack.header as unknown as JsonValue);
      plaintext = aeadDecrypt(keyCopy, nonce, aad, ciphertext, tag);
      const root = parseRoot(plaintext);
      assertCanonicalPayloadBytes(plaintext, root as unknown as JsonValue);
      return UnlockedVault.#open(root, registry);
    } finally {
      wipeBytes(keyCopy);
      if (plaintext !== undefined) {
        wipeBytes(plaintext);
      }
    }
  }

  static #open(root: RootRecord, codecs: Map<string, CodecPolicy>): UnlockedVault {
    const vault = new UnlockedVault();
    vault.#codecs = codecs;
    vault.#vaultId = root.vaultId;
    vault.#vaultSalt = root.vaultSalt;
    vault.#canonicalRoot = Buffer.from(canonicalizeJsonBytes(root as unknown as JsonValue));
    vault.#epochs = root.epochs.map((epoch) => ({
      rootEpoch: epoch.rootEpoch,
      secretRoot: Buffer.from(decodeId32(epoch.secretRoot)),
      status: epoch.status,
    }));
    return vault;
  }

  sealSnapshot(input: SealInput): SealResult {
    this.#requireUnlocked();
    decodeId32(input.scopeId);
    decodeId32(input.recordId);
    const payload = parsePayload(input.payloadUtf8);
    const codecs = this.#requireCodecs();
    const policy = lookupCodec(codecs, payload.metadata.codec.id);
    runCodec(policy, payload.content, payload.metadata);
    const epoch = activeEpoch(this.#requireEpochs());
    const generation = freshRandom(32);
    const nonce = freshRandom(12);
    const header: SnapshotHeader = {
      format: "wpp-witness-package",
      version: 1,
      suite: "HKDF-SHA256+A256GCM",
      vaultId: this.#vaultId as string,
      vaultSalt: this.#vaultSalt as string,
      rootEpoch: epoch.rootEpoch,
      scopeId: input.scopeId,
      recordId: input.recordId,
      generationId: encodeBase64Url(generation),
      kind: "snapshot",
      nonce: encodeBase64Url(nonce),
    };
    const plaintext = canonicalizeJsonBytes(payload as unknown as JsonValue);
    const aad = canonicalAad(header as unknown as JsonValue);
    if (aad.byteLength > LIMIT_HEADER_CANONICAL_BYTES) {
      throw new KernelError(ERR_INPUT_TOO_LARGE);
    }
    const keys = deriveKeys(epoch.secretRoot, header);
    try {
      const sealed = aeadEncrypt(keys.objectKey, nonce, aad, plaintext);
      const wireObject = {
        header,
        ciphertext: encodeBase64Url(sealed.ciphertext),
        tag: encodeBase64Url(sealed.tag),
      };
      const wire = canonicalizeJsonBytes(wireObject as unknown as JsonValue);
      return { wire: copyBytes(wire), sha256: sha256Hex(wire) };
    } finally {
      wipeBytes(generation);
      wipeBytes(nonce);
      wipeBytes(plaintext);
      wipeDerivedKeys(keys);
    }
  }

  openSnapshot(wire: Uint8Array, expected: ExpectedSnapshot): OpenResult {
    this.#requireUnlocked();
    const expectedBinding = validateExpectedSnapshot(expected);
    assertByteCeiling(wire, LIMIT_PACKAGE_BYTES);
    const packageSha256 = sha256Hex(wire);
    const parsed = parseJsonBytes(wire, LIMIT_PACKAGE_BYTES);
    const pack = validatePackageWire(parsed);
    if (pack.header.kind !== "snapshot") {
      throw new KernelError(ERR_UNSUPPORTED);
    }
    this.#assertRootMatch(pack.header);
    const epoch = epochById(this.#requireEpochs(), pack.header.rootEpoch);
    const nonce = decodeNonce12(pack.header.nonce);
    const tag = decodeTag16(pack.tag);
    const ciphertext = decodeBase64Url(pack.ciphertext, LIMIT_PLAINTEXT_BYTES);
    const aad = canonicalAad(pack.header as unknown as JsonValue);
    const keys = deriveKeys(epoch.secretRoot, pack.header);
    let plaintext: Buffer | undefined;
    try {
      plaintext = aeadDecrypt(keys.objectKey, nonce, aad, ciphertext, tag);
      const payload = parsePayload(plaintext);
      assertCanonicalPayloadBytes(plaintext, payload as unknown as JsonValue);
      const codecs = this.#requireCodecs();
      const policy = lookupCodec(codecs, payload.metadata.codec.id);
      runCodec(policy, payload.content, payload.metadata);
      assertExpectedBinding(expectedBinding, pack.header, payload.metadata);
      return {
        header: pack.header,
        metadata: payload.metadata,
        content: payload.content,
        packageSha256,
      };
    } finally {
      wipeDerivedKeys(keys);
      if (plaintext !== undefined) {
        wipeBytes(plaintext);
      }
    }
  }

  createRecoveryPack(): RecoveryPack {
    this.#requireUnlocked();
    const canonicalRoot = this.#canonicalRoot;
    if (canonicalRoot === undefined) {
      throw new KernelError(ERR_LOCKED);
    }
    const recoveryKey = freshRandom(32);
    const nonce = freshRandom(12);
    try {
      const header = {
        format: "wpp-recovery-pack",
        version: 1,
        suite: "A256GCM",
        nonce: encodeBase64Url(nonce),
      };
      const aad = canonicalAad(header as unknown as JsonValue);
      const sealed = aeadEncrypt(recoveryKey, nonce, aad, canonicalRoot);
      const wireObject = {
        header,
        ciphertext: encodeBase64Url(sealed.ciphertext),
        tag: encodeBase64Url(sealed.tag),
      };
      const wire = canonicalizeJsonBytes(wireObject as unknown as JsonValue);
      return { wire: copyBytes(wire), recoveryKey: copyBytes(recoveryKey) };
    } finally {
      wipeBytes(recoveryKey);
      wipeBytes(nonce);
    }
  }

  lock(): void {
    if (this.#locked) {
      return;
    }
    this.#locked = true;
    if (this.#epochs !== undefined) {
      for (const epoch of this.#epochs) {
        wipeBytes(epoch.secretRoot);
      }
    }
    if (this.#canonicalRoot !== undefined) {
      wipeBytes(this.#canonicalRoot);
    }
    this.#epochs = undefined;
    this.#canonicalRoot = undefined;
    this.#codecs = undefined;
    this.#vaultId = undefined;
    this.#vaultSalt = undefined;
  }

  #requireUnlocked(): void {
    if (this.#locked || this.#codecs === undefined || this.#epochs === undefined) {
      throw new KernelError(ERR_LOCKED);
    }
  }

  #requireCodecs(): Map<string, CodecPolicy> {
    if (this.#codecs === undefined) {
      throw new KernelError(ERR_LOCKED);
    }
    return this.#codecs;
  }

  #requireEpochs(): OwnedEpoch[] {
    if (this.#epochs === undefined) {
      throw new KernelError(ERR_LOCKED);
    }
    return this.#epochs;
  }

  #assertRootMatch(header: SnapshotHeader): void {
    if (this.#vaultId === undefined || this.#vaultSalt === undefined) {
      throw new KernelError(ERR_LOCKED);
    }
    if (header.vaultId !== this.#vaultId || header.vaultSalt !== this.#vaultSalt) {
      throw new KernelError(ERR_ROOT);
    }
    decodeId16(header.vaultId);
    decodeId32(header.vaultSalt);
  }
}
