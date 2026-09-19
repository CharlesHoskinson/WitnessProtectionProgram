import { randomBytes } from "node:crypto";
import {
  ERR_CODEC,
  ERR_CODEC_UNKNOWN,
  ERR_EPOCH,
  ERR_INPUT_TOO_LARGE,
  ERR_INTERNAL,
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
  isolatedJsonView,
  parseJsonBytes,
  wipeBytes,
  type JsonValue,
} from "./json.js";
import {
  aeadDecrypt,
  aeadEncrypt,
  canonicalAad,
  deriveKeys,
  sha256Hex,
  wipeDerivedKeys,
  type DerivedKeys,
} from "./crypto.js";
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

function absorbThenable(value: unknown): void {
  try {
    void Promise.resolve(value).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return;
  }
}

function runCodec(policy: CodecPolicy, content: JsonValue, metadata: SnapshotMetadata): void {
  const contentView = isolatedJsonView(content);
  const metadataView = isolatedJsonView(metadata as unknown as JsonValue) as SnapshotMetadata;
  let result: unknown;
  try {
    result = policy.validate(contentView, metadataView);
  } catch {
    throw new KernelError(ERR_CODEC);
  }
  if (result !== undefined) {
    absorbThenable(result);
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
    const epochs: OwnedEpoch[] = [];
    let canonicalRoot: Buffer | undefined;
    try {
      vault.#codecs = codecs;
      vault.#vaultId = root.vaultId;
      vault.#vaultSalt = root.vaultSalt;
      const canonicalTmp = canonicalizeJsonBytes(root as unknown as JsonValue);
      try {
        canonicalRoot = Buffer.from(canonicalTmp);
      } finally {
        wipeBytes(canonicalTmp);
      }
      for (const epoch of root.epochs) {
        epochs.push({
          rootEpoch: epoch.rootEpoch,
          secretRoot: decodeId32(epoch.secretRoot),
          status: epoch.status,
        });
      }
      vault.#canonicalRoot = canonicalRoot;
      vault.#epochs = epochs;
      return vault;
    } catch (err) {
      if (canonicalRoot !== undefined) {
        wipeBytes(canonicalRoot);
      }
      for (const epoch of epochs) {
        wipeBytes(epoch.secretRoot);
      }
      vault.#codecs = undefined;
      vault.#vaultId = undefined;
      vault.#vaultSalt = undefined;
      vault.#canonicalRoot = undefined;
      vault.#epochs = undefined;
      if (err instanceof KernelError) {
        throw err;
      }
      throw new KernelError(ERR_INTERNAL);
    }
  }

  sealSnapshot(input: SealInput): SealResult {
    this.#requireUnlocked();
    decodeId32(input.scopeId);
    decodeId32(input.recordId);
    const payload = parsePayload(input.payloadUtf8);
    this.#runCodec(payload.metadata.codec.id, payload.content, payload.metadata);
    const epoch = activeEpoch(this.#requireEpochs());
    const vaultId = this.#vaultId;
    const vaultSalt = this.#vaultSalt;
    if (vaultId === undefined || vaultSalt === undefined) {
      throw new KernelError(ERR_LOCKED);
    }
    const generation = freshRandom(32);
    let nonce: Buffer | undefined;
    let plaintext: Uint8Array | undefined;
    let keys: DerivedKeys | undefined;
    try {
      nonce = freshRandom(12);
      const header: SnapshotHeader = {
        format: "wpp-witness-package",
        version: 1,
        suite: "HKDF-SHA256+A256GCM",
        vaultId,
        vaultSalt,
        rootEpoch: epoch.rootEpoch,
        scopeId: input.scopeId,
        recordId: input.recordId,
        generationId: encodeBase64Url(generation),
        kind: "snapshot",
        nonce: encodeBase64Url(nonce),
      };
      plaintext = canonicalizeJsonBytes(payload as unknown as JsonValue);
      if (plaintext.byteLength > LIMIT_PLAINTEXT_BYTES) {
        throw new KernelError(ERR_INPUT_TOO_LARGE);
      }
      const aad = canonicalAad(header as unknown as JsonValue);
      if (aad.byteLength > LIMIT_HEADER_CANONICAL_BYTES) {
        throw new KernelError(ERR_INPUT_TOO_LARGE);
      }
      keys = deriveKeys(epoch.secretRoot, header);
      const sealed = aeadEncrypt(keys.objectKey, nonce, aad, plaintext);
      const wireObject = {
        header,
        ciphertext: encodeBase64Url(sealed.ciphertext),
        tag: encodeBase64Url(sealed.tag),
      };
      const wire = canonicalizeJsonBytes(wireObject as unknown as JsonValue);
      if (wire.byteLength > LIMIT_PACKAGE_BYTES) {
        throw new KernelError(ERR_INPUT_TOO_LARGE);
      }
      this.#requireUnlocked();
      return { wire: copyBytes(wire), sha256: sha256Hex(wire) };
    } finally {
      wipeBytes(generation);
      if (nonce !== undefined) {
        wipeBytes(nonce);
      }
      if (plaintext !== undefined) {
        wipeBytes(plaintext);
      }
      if (keys !== undefined) {
        wipeDerivedKeys(keys);
      }
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
      assertExpectedBinding(expectedBinding, pack.header, payload.metadata);
      this.#runCodec(payload.metadata.codec.id, payload.content, payload.metadata);
      this.#requireUnlocked();
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
    try {
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
        this.#requireUnlocked();
        return { wire: copyBytes(wire), recoveryKey: copyBytes(recoveryKey) };
      } finally {
        wipeBytes(nonce);
      }
    } finally {
      wipeBytes(recoveryKey);
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

  #runCodec(codecId: string, content: JsonValue, metadata: SnapshotMetadata): void {
    const policy = lookupCodec(this.#requireCodecs(), codecId);
    runCodec(policy, content, metadata);
    this.#requireUnlocked();
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
