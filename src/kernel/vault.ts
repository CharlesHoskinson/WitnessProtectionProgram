import { randomBytes } from "node:crypto";
import {
  ERR_BINDING,
  ERR_CODEC,
  ERR_CODEC_UNKNOWN,
  ERR_EPOCH,
  ERR_INPUT_TOO_LARGE,
  ERR_INTERNAL,
  ERR_LOCKED,
  ERR_RANDOM,
  ERR_RECOVERY,
  ERR_ROOT,
  ERR_SCHEMA,
  ERR_UNSUPPORTED,
  KernelError,
  LIMIT_HEADER_CANONICAL_BYTES,
  LIMIT_PACKAGE_BYTES,
  LIMIT_PLAINTEXT_BYTES,
  LIMIT_RECOVERY_WIRE_BYTES,
  LIMIT_ROOT_BYTES,
  assertCanonicalPayloadBytes,
  canonicalizeJsonBytes,
  copyExactOwnedBytes,
  copyOwnedBytes,
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
  CatalogError,
  ERR_CATALOG_LIMIT,
  parseCatalog,
  type Catalog,
} from "../catalog/index.js";
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

export interface OpenCatalogResult {
  header: SnapshotHeader;
  catalog: Catalog;
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
  const metadataView = isolatedJsonView(metadata as unknown as JsonValue) as unknown as SnapshotMetadata;
  const validate = policy.validate;
  let result: unknown;
  try {
    result = validate(contentView, metadataView);
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

function mapCatalogParseError(err: unknown): never {
  if (err instanceof CatalogError) {
    if (err.code === ERR_CATALOG_LIMIT) {
      throw new KernelError(ERR_INPUT_TOO_LARGE);
    }
    throw new KernelError(ERR_SCHEMA);
  }
  if (err instanceof KernelError) {
    throw err;
  }
  throw new KernelError(ERR_SCHEMA);
}

export class UnlockedVault {
  #locked = false;
  #codecs: Map<string, CodecPolicy> | undefined;
  #vaultId: string | undefined;
  #vaultSalt: string | undefined;
  #catalogScopeId: string | undefined;
  #catalogRecordId: string | undefined;
  #epochs: OwnedEpoch[] | undefined;
  #canonicalRoot: Buffer | undefined;

  private constructor() {}

  get locked(): boolean {
    return this.#locked;
  }

  static fromRootRecord(rootUtf8: Uint8Array, codecs: readonly CodecPolicy[]): UnlockedVault {
    const rootBytes = rootUtf8;
    const registry = validateCodecPolicies(codecs);
    const root = parseRoot(rootBytes);
    return UnlockedVault.#open(root, registry);
  }

  static fromRecoveryPack(
    wire: Uint8Array,
    recoveryKey: Uint8Array,
    codecs: readonly CodecPolicy[],
  ): UnlockedVault {
    const registry = validateCodecPolicies(codecs);
    const keyCopy = copyExactOwnedBytes(recoveryKey, 32, ERR_RECOVERY);
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
      vault.#catalogScopeId = root.catalogScopeId;
      vault.#catalogRecordId = root.catalogRecordId;
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
      vault.#catalogScopeId = undefined;
      vault.#catalogRecordId = undefined;
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
    const scopeId = input.scopeId;
    const recordId = input.recordId;
    const payloadUtf8 = input.payloadUtf8;
    decodeId32(scopeId);
    decodeId32(recordId);
    const payload = parsePayload(payloadUtf8);
    this.#runCodec(payload.metadata.codec.id, payload.content, payload.metadata);
    return this.#sealJson(payload as unknown as JsonValue, scopeId, recordId, "snapshot");
  }

  sealCatalog(payloadUtf8: Uint8Array): SealResult {
    this.#requireUnlocked();
    const payloadBytes = copyOwnedBytes(payloadUtf8, LIMIT_PLAINTEXT_BYTES);
    try {
      parseJsonBytes(payloadBytes, LIMIT_PLAINTEXT_BYTES);
      let catalog: Catalog;
      try {
        catalog = parseCatalog(payloadBytes);
      } catch (err) {
        return mapCatalogParseError(err);
      }
      return this.#sealJson(
        catalog as unknown as JsonValue,
        this.#requireCatalogScopeId(),
        this.#requireCatalogRecordId(),
        "catalog",
      );
    } finally {
      wipeBytes(payloadBytes);
    }
  }

  openSnapshot(wire: Uint8Array, expected: ExpectedSnapshot): OpenResult {
    this.#requireUnlocked();
    const packageBytes = copyOwnedBytes(wire, LIMIT_PACKAGE_BYTES);
    const expectedBinding = validateExpectedSnapshot(expected);
    const packageSha256 = sha256Hex(packageBytes);
    const parsed = parseJsonBytes(packageBytes, LIMIT_PACKAGE_BYTES);
    const pack = validatePackageWire(parsed);
    if (pack.header.kind !== "snapshot") {
      throw new KernelError(ERR_UNSUPPORTED);
    }
    let plaintext: Buffer | undefined;
    try {
      plaintext = this.#decryptPack(pack.header, pack.ciphertext, pack.tag);
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
      if (plaintext !== undefined) {
        wipeBytes(plaintext);
      }
    }
  }

  openCatalog(wire: Uint8Array): OpenCatalogResult {
    this.#requireUnlocked();
    const packageBytes = copyOwnedBytes(wire, LIMIT_PACKAGE_BYTES);
    const packageSha256 = sha256Hex(packageBytes);
    const parsed = parseJsonBytes(packageBytes, LIMIT_PACKAGE_BYTES);
    const pack = validatePackageWire(parsed);
    if (pack.header.kind !== "catalog") {
      throw new KernelError(ERR_UNSUPPORTED);
    }
    this.#assertCatalogBinding(pack.header);
    let plaintext: Buffer | undefined;
    try {
      plaintext = this.#decryptPack(pack.header, pack.ciphertext, pack.tag);
      const rawParsed = parseJsonBytes(plaintext, LIMIT_PLAINTEXT_BYTES);
      assertCanonicalPayloadBytes(plaintext, rawParsed);
      let catalog: Catalog;
      try {
        catalog = parseCatalog(plaintext);
      } catch (err) {
        return mapCatalogParseError(err);
      }
      this.#requireUnlocked();
      return {
        header: pack.header,
        catalog,
        packageSha256,
      };
    } finally {
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
    this.#catalogScopeId = undefined;
    this.#catalogRecordId = undefined;
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

  #assertCatalogBinding(header: SnapshotHeader): void {
    const catalogScopeId = this.#requireCatalogScopeId();
    const catalogRecordId = this.#requireCatalogRecordId();
    if (header.scopeId !== catalogScopeId || header.recordId !== catalogRecordId) {
      throw new KernelError(ERR_BINDING);
    }
  }

  #requireCatalogScopeId(): string {
    if (this.#locked || this.#catalogScopeId === undefined) {
      throw new KernelError(ERR_LOCKED);
    }
    return this.#catalogScopeId;
  }

  #requireCatalogRecordId(): string {
    if (this.#locked || this.#catalogRecordId === undefined) {
      throw new KernelError(ERR_LOCKED);
    }
    return this.#catalogRecordId;
  }

  #sealJson(
    value: JsonValue,
    scopeId: string,
    recordId: string,
    kind: SnapshotHeader["kind"],
  ): SealResult {
    this.#requireUnlocked();
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
        scopeId,
        recordId,
        generationId: encodeBase64Url(generation),
        kind,
        nonce: encodeBase64Url(nonce),
      };
      plaintext = canonicalizeJsonBytes(value);
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

  #decryptPack(header: SnapshotHeader, ciphertext: string, tag: string): Buffer {
    this.#assertRootMatch(header);
    const epoch = epochById(this.#requireEpochs(), header.rootEpoch);
    const nonce = decodeNonce12(header.nonce);
    const tagBytes = decodeTag16(tag);
    const ciphertextBytes = decodeBase64Url(ciphertext, LIMIT_PLAINTEXT_BYTES);
    const aad = canonicalAad(header as unknown as JsonValue);
    const keys = deriveKeys(epoch.secretRoot, header);
    try {
      return aeadDecrypt(keys.objectKey, nonce, aad, ciphertextBytes, tagBytes);
    } finally {
      wipeDerivedKeys(keys);
    }
  }
}
