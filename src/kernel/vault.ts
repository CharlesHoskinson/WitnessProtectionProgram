import { randomBytes } from "node:crypto";
import { types } from "node:util";
import {
  ERR_AUTH,
  ERR_BASE64URL,
  ERR_BINDING,
  ERR_BOM,
  ERR_CODEC,
  ERR_CODEC_UNKNOWN,
  ERR_EPOCH,
  ERR_INPUT_TOO_LARGE,
  ERR_INTERNAL,
  ERR_JSON_CANONICAL,
  ERR_JSON_COMMENT,
  ERR_JSON_DEPTH,
  ERR_JSON_DUPLICATE_KEY,
  ERR_JSON_EMPTY,
  ERR_JSON_NONFINITE,
  ERR_JSON_PARSE,
  ERR_JSON_SURROGATE,
  ERR_JSON_TRAILING_COMMA,
  ERR_JSON_TRAILING_TOKEN,
  ERR_LOCKED,
  ERR_NONCANONICAL,
  ERR_RANDOM,
  ERR_RECOVERY,
  ERR_ROOT,
  ERR_SCHEMA,
  ERR_UNKNOWN_FIELD,
  ERR_UNSUPPORTED,
  ERR_UTF8,
  KernelError,
  LIMIT_HEADER_CANONICAL_BYTES,
  LIMIT_PACKAGE_BYTES,
  LIMIT_PLAINTEXT_BYTES,
  LIMIT_RECOVERY_WIRE_BYTES,
  LIMIT_ROOT_BYTES,
  assertCanonicalPayloadBytes,
  canonicalizeJson,
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
  CATALOG_V2_LIMITS,
  ERR_CATALOG_CAPACITY,
  ERR_CATALOG_COVER,
  ERR_CATALOG_DUPLICATE,
  ERR_CATALOG_REFERENCE,
  ERR_CATALOG_ROLE,
  parseCatalogNode,
  preflightCatalogRoot,
  type CatalogNonemptyReference,
  type CatalogTaggedRecord,
  type CatalogV2Locator,
  type ParsedCatalogNode,
} from "../storage/index.js";
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

export type ExpectedCatalogNode =
  | { nodeType: "root"; wireSha256: string; wireByteLength: number }
  | { nodeType: "shard"; reference: CatalogNonemptyReference };

export interface OpenCatalogNodeResult {
  header: SnapshotHeader;
  node: ParsedCatalogNode;
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

const CATALOG_NODE_STATIC_CODES = Object.freeze([
  ERR_SCHEMA,
  ERR_CATALOG_ROLE,
  ERR_CATALOG_CAPACITY,
  ERR_CATALOG_COVER,
  ERR_CATALOG_REFERENCE,
  ERR_CATALOG_DUPLICATE,
  ERR_BOM,
  ERR_UTF8,
  ERR_JSON_PARSE,
  ERR_JSON_COMMENT,
  ERR_JSON_TRAILING_COMMA,
  ERR_JSON_EMPTY,
  ERR_JSON_DEPTH,
  ERR_JSON_DUPLICATE_KEY,
  ERR_JSON_TRAILING_TOKEN,
  ERR_JSON_SURROGATE,
  ERR_JSON_NONFINITE,
  ERR_JSON_CANONICAL,
  ERR_UNKNOWN_FIELD,
  ERR_BASE64URL,
  ERR_NONCANONICAL,
  ERR_INPUT_TOO_LARGE,
  ERR_BINDING,
  ERR_AUTH,
  ERR_ROOT,
  ERR_EPOCH,
  ERR_LOCKED,
  ERR_UNSUPPORTED,
  ERR_RANDOM,
  ERR_INTERNAL,
]);

const ROOT_EXPECTED_KEYS = Object.freeze(["nodeType", "wireSha256", "wireByteLength"]);
const SHARD_EXPECTED_KEYS = Object.freeze(["nodeType", "reference"]);
const NONEMPTY_REFERENCE_KEYS = Object.freeze([
  "prefix",
  "empty",
  "recordId",
  "generationId",
  "rootEpoch",
  "wireSha256",
  "wireByteLength",
  "plaintextByteLength",
  "entryCount",
  "observationCount",
  "canonicalRecordsSha256",
  "locators",
]);
const LOCATOR_KEYS = Object.freeze(["provider", "accountBinding", "objectId", "revisionId"]);
const PERMISSION_BINDING_KEYS = Object.freeze(["scheme", "value"]);
const LOCATOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}(?![\s\S])/;
const PERMISSION_VALUE_PATTERN = /^[A-Za-z0-9_.-]{1,128}(?![\s\S])/;

function knownCatalogNodeCode(candidate: unknown): string | undefined {
  if (typeof candidate !== "string") {
    return undefined;
  }
  for (const code of CATALOG_NODE_STATIC_CODES) {
    if (candidate === code) {
      return code;
    }
  }
  return undefined;
}

function rethrowCatalogNode(err: unknown, fallback: string): never {
  let code = fallback;
  try {
    const isKernel = err instanceof KernelError;
    if (isKernel) {
      const mapped = knownCatalogNodeCode(err.code);
      if (mapped !== undefined) {
        code = mapped;
      }
    }
  } catch {
    code = fallback;
  }
  throw new KernelError(code);
}

function assertPlainJsonObject(value: unknown): asserts value is { [key: string]: unknown } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
}

function expectedSchemaError(err: unknown): never {
  if (err instanceof KernelError && err.code === ERR_SCHEMA) {
    throw err;
  }
  throw new KernelError(ERR_SCHEMA);
}

function rejectProxy(value: unknown): void {
  let proxy = false;
  try {
    proxy = types.isProxy(value);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  if (proxy) {
    throw new KernelError(ERR_SCHEMA);
  }
}

function sameStringKeySet(names: readonly string[], keys: readonly string[]): boolean {
  if (names.length !== keys.length) {
    return false;
  }
  for (const key of keys) {
    let found = false;
    for (const name of names) {
      if (name === key) {
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

function ownEnumerableData(
  value: unknown,
  permittedShapes: readonly (readonly string[])[],
): Map<string, unknown> {
  rejectProxy(value);
  if (value === null || typeof value !== "object") {
    throw new KernelError(ERR_SCHEMA);
  }
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  if (isArray) {
    throw new KernelError(ERR_SCHEMA);
  }
  let proto: object | null;
  try {
    proto = Object.getPrototypeOf(value);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  if (proto !== Object.prototype && proto !== null) {
    throw new KernelError(ERR_SCHEMA);
  }
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(value);
    symbols = Object.getOwnPropertySymbols(value);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  if (symbols.length !== 0) {
    throw new KernelError(ERR_SCHEMA);
  }
  let matched: readonly string[] | undefined;
  for (const keys of permittedShapes) {
    if (sameStringKeySet(names, keys)) {
      matched = keys;
      break;
    }
  }
  if (matched === undefined) {
    throw new KernelError(ERR_SCHEMA);
  }
  const owned = new Map<string, unknown>();
  for (const key of matched) {
    let desc: PropertyDescriptor | undefined;
    try {
      desc = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      throw new KernelError(ERR_SCHEMA);
    }
    if (desc === undefined) {
      throw new KernelError(ERR_SCHEMA);
    }
    if (typeof desc.get === "function" || typeof desc.set === "function") {
      throw new KernelError(ERR_SCHEMA);
    }
    if (desc.enumerable !== true) {
      throw new KernelError(ERR_SCHEMA);
    }
    if (typeof desc.value === "function") {
      throw new KernelError(ERR_SCHEMA);
    }
    owned.set(key, desc.value);
  }
  return owned;
}

function takeExactFields(map: Map<string, unknown>, keys: readonly string[]): { [key: string]: unknown } {
  if (map.size !== keys.length) {
    throw new KernelError(ERR_SCHEMA);
  }
  const out = Object.create(null) as { [key: string]: unknown };
  for (const key of keys) {
    if (!map.has(key)) {
      throw new KernelError(ERR_SCHEMA);
    }
    out[key] = map.get(key);
  }
  return out;
}

function copyLowerHex(value: unknown, minLength: number, maxLength: number): string {
  if (typeof value !== "string") {
    throw new KernelError(ERR_SCHEMA);
  }
  if (value.length < minLength || value.length > maxLength) {
    throw new KernelError(ERR_SCHEMA);
  }
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const digit = code >= 48 && code <= 57;
    const hex = code >= 97 && code <= 102;
    if (!digit && !hex) {
      throw new KernelError(ERR_SCHEMA);
    }
  }
  return value;
}

function copyBoundedInt(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new KernelError(ERR_SCHEMA);
  }
  return value;
}

function copyIdString(value: unknown, size: 16 | 32): string {
  const encodedLength = size === 16 ? 22 : 43;
  if (typeof value !== "string") {
    throw new KernelError(ERR_SCHEMA);
  }
  if (value.length !== encodedLength) {
    throw new KernelError(ERR_SCHEMA);
  }
  let decoded: Buffer | undefined;
  try {
    decoded = size === 16 ? decodeId16(value) : decodeId32(value);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  } finally {
    if (decoded !== undefined) {
      wipeBytes(decoded);
    }
  }
  return value;
}

function copyPatternString(value: unknown, maxLength: number, pattern: RegExp): string {
  if (typeof value !== "string") {
    throw new KernelError(ERR_SCHEMA);
  }
  if (value.length < 1 || value.length > maxLength) {
    throw new KernelError(ERR_SCHEMA);
  }
  if (!pattern.test(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
  return value;
}

function copyPermissionBinding(value: unknown): CatalogV2Locator["accountBinding"] {
  const fields = takeExactFields(ownEnumerableData(value, [PERMISSION_BINDING_KEYS]), PERMISSION_BINDING_KEYS);
  if (fields.scheme !== "google-drive-permission-id") {
    throw new KernelError(ERR_SCHEMA);
  }
  return {
    scheme: "google-drive-permission-id",
    value: copyPatternString(fields.value, 128, PERMISSION_VALUE_PATTERN),
  };
}

function copyLocator(value: unknown): CatalogV2Locator {
  const fields = takeExactFields(ownEnumerableData(value, [LOCATOR_KEYS]), LOCATOR_KEYS);
  if (fields.provider !== "google-drive") {
    throw new KernelError(ERR_SCHEMA);
  }
  const revisionId = fields.revisionId === null ? null : copyPatternString(fields.revisionId, 128, LOCATOR_ID_PATTERN);
  const locator: CatalogV2Locator = {
    provider: "google-drive",
    accountBinding: copyPermissionBinding(fields.accountBinding),
    objectId: copyPatternString(fields.objectId, 128, LOCATOR_ID_PATTERN),
    revisionId,
  };
  Object.freeze(locator.accountBinding);
  return Object.freeze(locator);
}

function copyLocators(value: unknown): CatalogV2Locator[] {
  rejectProxy(value);
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  if (!isArray || value === null || typeof value !== "object") {
    throw new KernelError(ERR_SCHEMA);
  }
  const arrayValue = value as unknown[];
  let lengthDesc: PropertyDescriptor | undefined;
  try {
    lengthDesc = Object.getOwnPropertyDescriptor(arrayValue, "length");
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  if (
    lengthDesc === undefined ||
    typeof lengthDesc.get === "function" ||
    typeof lengthDesc.set === "function" ||
    typeof lengthDesc.value !== "number" ||
    !Number.isSafeInteger(lengthDesc.value)
  ) {
    throw new KernelError(ERR_SCHEMA);
  }
  const length = lengthDesc.value;
  if (length < 1 || length > CATALOG_V2_LIMITS.maxLocators) {
    throw new KernelError(ERR_SCHEMA);
  }
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(arrayValue);
    symbols = Object.getOwnPropertySymbols(arrayValue);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  if (symbols.length !== 0 || names.length !== length + 1) {
    throw new KernelError(ERR_SCHEMA);
  }
  const locators: CatalogV2Locator[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < length; i += 1) {
    let desc: PropertyDescriptor | undefined;
    try {
      desc = Object.getOwnPropertyDescriptor(arrayValue, String(i));
    } catch {
      throw new KernelError(ERR_SCHEMA);
    }
    if (
      desc === undefined ||
      typeof desc.get === "function" ||
      typeof desc.set === "function" ||
      desc.enumerable !== true ||
      typeof desc.value === "function"
    ) {
      throw new KernelError(ERR_SCHEMA);
    }
    const locator = copyLocator(desc.value);
    let canonical: string;
    try {
      canonical = canonicalizeJson(locator as unknown as JsonValue);
    } catch {
      throw new KernelError(ERR_SCHEMA);
    }
    if (seen.has(canonical)) {
      throw new KernelError(ERR_SCHEMA);
    }
    seen.add(canonical);
    locators.push(locator);
  }
  return Object.freeze(locators) as CatalogV2Locator[];
}

function copyNonemptyReference(value: unknown): CatalogNonemptyReference {
  const fields = takeExactFields(ownEnumerableData(value, [NONEMPTY_REFERENCE_KEYS]), NONEMPTY_REFERENCE_KEYS);
  if (fields.empty !== false) {
    throw new KernelError(ERR_SCHEMA);
  }
  const entryCount = copyBoundedInt(fields.entryCount, 0, CATALOG_V2_LIMITS.maxRecordsPerLeaf);
  const observationCount = copyBoundedInt(fields.observationCount, 0, CATALOG_V2_LIMITS.maxRecordsPerLeaf);
  if (entryCount + observationCount < 1 || entryCount + observationCount > CATALOG_V2_LIMITS.maxRecordsPerLeaf) {
    throw new KernelError(ERR_SCHEMA);
  }
  const copied: CatalogNonemptyReference = {
    prefix: copyLowerHex(fields.prefix, 0, CATALOG_V2_LIMITS.maxPrefixDepth),
    empty: false,
    recordId: copyIdString(fields.recordId, 32),
    generationId: copyIdString(fields.generationId, 32),
    rootEpoch: copyIdString(fields.rootEpoch, 16),
    wireSha256: copyLowerHex(fields.wireSha256, 64, 64),
    wireByteLength: copyBoundedInt(fields.wireByteLength, 1, CATALOG_V2_LIMITS.shardWireBytes),
    plaintextByteLength: copyBoundedInt(fields.plaintextByteLength, 1, CATALOG_V2_LIMITS.shardPlaintextBytes),
    entryCount,
    observationCount,
    canonicalRecordsSha256: copyLowerHex(fields.canonicalRecordsSha256, 64, 64),
    locators: copyLocators(fields.locators),
  };
  return Object.freeze(copied) as CatalogNonemptyReference;
}

function copyExpectedCatalogNode(value: unknown): ExpectedCatalogNode {
  try {
    const map = ownEnumerableData(value, [ROOT_EXPECTED_KEYS, SHARD_EXPECTED_KEYS]);
    const nodeType = map.get("nodeType");
    if (nodeType === "root") {
      const fields = takeExactFields(map, ROOT_EXPECTED_KEYS);
      return Object.freeze({
        nodeType: "root" as const,
        wireSha256: copyLowerHex(fields.wireSha256, 64, 64),
        wireByteLength: copyBoundedInt(fields.wireByteLength, 1, CATALOG_V2_LIMITS.rootWireBytes),
      });
    }
    if (nodeType === "shard") {
      const fields = takeExactFields(map, SHARD_EXPECTED_KEYS);
      return Object.freeze({
        nodeType: "shard" as const,
        reference: copyNonemptyReference(fields.reference),
      });
    }
    throw new KernelError(ERR_SCHEMA);
  } catch (err) {
    expectedSchemaError(err);
  }
}

function catalogNodeRole(value: { [key: string]: unknown }): "root" | "shard" {
  if (value.payloadVersion !== 2) {
    throw new KernelError(ERR_CATALOG_ROLE);
  }
  if (value.nodeType === "root" || value.nodeType === "shard") {
    return value.nodeType;
  }
  throw new KernelError(ERR_CATALOG_ROLE);
}

function assertShardSealBudget(recordCount: number, plaintextBytes: number): void {
  if (recordCount < 1) {
    throw new KernelError(ERR_SCHEMA);
  }
  if (recordCount === 1) {
    if (plaintextBytes > CATALOG_V2_LIMITS.shardPlaintextBytes) {
      throw new KernelError(ERR_CATALOG_CAPACITY);
    }
    return;
  }
  if (plaintextBytes > CATALOG_V2_LIMITS.shardTargetBytes) {
    throw new KernelError(ERR_CATALOG_CAPACITY);
  }
}

function catalogRecordCounts(records: readonly CatalogTaggedRecord[]): {
  entryCount: number;
  observationCount: number;
} {
  let entryCount = 0;
  let observationCount = 0;
  for (const record of records) {
    if (record.recordKind === "observation") {
      observationCount += 1;
    } else {
      entryCount += 1;
    }
  }
  return { entryCount, observationCount };
}

function recordsFingerprint(records: readonly CatalogTaggedRecord[]): string {
  const bytes = canonicalizeJsonBytes(records as unknown as JsonValue);
  try {
    return sha256Hex(bytes);
  } finally {
    wipeBytes(bytes);
  }
}

function requiredEpochsInclude(epochs: readonly string[], rootEpoch: string): boolean {
  for (const epoch of epochs) {
    if (epoch === rootEpoch) {
      return true;
    }
  }
  return false;
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

  sealCatalogNode(payloadUtf8: Uint8Array): SealResult {
    this.#requireUnlocked();
    let payloadBytes: Uint8Array | undefined;
    let canonical: Uint8Array | undefined;
    try {
      payloadBytes = copyOwnedBytes(payloadUtf8, CATALOG_V2_LIMITS.rootPlaintextBytes);
      const parsed = parseJsonBytes(payloadBytes, CATALOG_V2_LIMITS.rootPlaintextBytes);
      assertPlainJsonObject(parsed);
      const role = catalogNodeRole(parsed);
      canonical = canonicalizeJsonBytes(parsed);
      const plaintextLimit =
        role === "root" ? CATALOG_V2_LIMITS.rootPlaintextBytes : CATALOG_V2_LIMITS.shardPlaintextBytes;
      const wireLimit = role === "root" ? CATALOG_V2_LIMITS.rootWireBytes : CATALOG_V2_LIMITS.shardWireBytes;
      if (canonical.byteLength > plaintextLimit) {
        throw new KernelError(ERR_INPUT_TOO_LARGE);
      }
      const scopeId = this.#requireCatalogScopeId();
      if (role === "root") {
        const preflight = preflightCatalogRoot(canonical);
        const epoch = activeEpoch(this.#requireEpochs());
        if (!requiredEpochsInclude(preflight.root.requiredEpochs, epoch.rootEpoch)) {
          throw new KernelError(ERR_CATALOG_REFERENCE);
        }
        this.#requireUnlocked();
        return this.#sealJson(
          preflight.root as unknown as JsonValue,
          scopeId,
          this.#requireCatalogRecordId(),
          "catalog",
          plaintextLimit,
          wireLimit,
        );
      }
      const node = parseCatalogNode(canonical, "shard");
      assertShardSealBudget(node.payload.records.length, canonical.byteLength);
      const recordId = this.#freshShardRecordId();
      this.#requireUnlocked();
      return this.#sealJson(
        node.payload as unknown as JsonValue,
        scopeId,
        recordId,
        "catalog",
        plaintextLimit,
        wireLimit,
      );
    } catch (err) {
      return rethrowCatalogNode(err, ERR_SCHEMA);
    } finally {
      if (payloadBytes !== undefined) {
        wipeBytes(payloadBytes);
      }
      if (canonical !== undefined) {
        wipeBytes(canonical);
      }
    }
  }

  openCatalogNode(wire: Uint8Array, expected: ExpectedCatalogNode): OpenCatalogNodeResult {
    this.#requireUnlocked();
    let packageBytes: Uint8Array | undefined;
    let plaintext: Buffer | undefined;
    try {
      const expectedNode = copyExpectedCatalogNode(expected);
      const wireLimit =
        expectedNode.nodeType === "root" ? CATALOG_V2_LIMITS.rootWireBytes : CATALOG_V2_LIMITS.shardWireBytes;
      const plaintextLimit =
        expectedNode.nodeType === "root"
          ? CATALOG_V2_LIMITS.rootPlaintextBytes
          : CATALOG_V2_LIMITS.shardPlaintextBytes;
      packageBytes = copyOwnedBytes(wire, wireLimit);
      const packageSha256 = sha256Hex(packageBytes);
      const expectedHash =
        expectedNode.nodeType === "root" ? expectedNode.wireSha256 : expectedNode.reference.wireSha256;
      const expectedLength =
        expectedNode.nodeType === "root" ? expectedNode.wireByteLength : expectedNode.reference.wireByteLength;
      if (packageBytes.byteLength !== expectedLength || packageSha256 !== expectedHash) {
        throw new KernelError(ERR_BINDING);
      }
      const parsed = parseJsonBytes(packageBytes, wireLimit);
      const pack = validatePackageWire(parsed);
      if (pack.header.kind !== "catalog") {
        throw new KernelError(ERR_UNSUPPORTED);
      }
      this.#assertRootMatch(pack.header);
      if (expectedNode.nodeType === "root") {
        this.#assertCatalogBinding(pack.header);
      } else {
        this.#assertShardBinding(pack.header, expectedNode.reference);
      }
      plaintext = this.#decryptPack(pack.header, pack.ciphertext, pack.tag, plaintextLimit);
      const rawParsed = parseJsonBytes(plaintext, plaintextLimit);
      assertCanonicalPayloadBytes(plaintext, rawParsed);
      if (expectedNode.nodeType === "root") {
        const node = parseCatalogNode(plaintext, "root");
        preflightCatalogRoot(plaintext);
        if (!requiredEpochsInclude(node.payload.requiredEpochs, pack.header.rootEpoch)) {
          throw new KernelError(ERR_CATALOG_REFERENCE);
        }
        this.#requireUnlocked();
        return {
          header: isolatedJsonView(pack.header as unknown as JsonValue) as unknown as SnapshotHeader,
          node,
          packageSha256,
        };
      }
      const node = parseCatalogNode(plaintext, "shard");
      this.#assertOpenedShard(node, expectedNode.reference, plaintext.byteLength);
      this.#requireUnlocked();
      return {
        header: isolatedJsonView(pack.header as unknown as JsonValue) as unknown as SnapshotHeader,
        node,
        packageSha256,
      };
    } catch (err) {
      return rethrowCatalogNode(err, ERR_SCHEMA);
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

  #freshShardRecordId(): string {
    const catalogRecordId = this.#requireCatalogRecordId();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const bytes = freshRandom(32);
      try {
        const recordId = encodeBase64Url(bytes);
        if (recordId !== catalogRecordId) {
          return recordId;
        }
      } finally {
        wipeBytes(bytes);
      }
    }
    throw new KernelError(ERR_RANDOM);
  }

  #assertShardBinding(header: SnapshotHeader, reference: CatalogNonemptyReference): void {
    const catalogScopeId = this.#requireCatalogScopeId();
    if (header.scopeId !== catalogScopeId) {
      throw new KernelError(ERR_BINDING);
    }
    if (header.recordId !== reference.recordId) {
      throw new KernelError(ERR_BINDING);
    }
    if (header.generationId !== reference.generationId) {
      throw new KernelError(ERR_BINDING);
    }
    if (header.rootEpoch !== reference.rootEpoch) {
      throw new KernelError(ERR_BINDING);
    }
  }

  #assertOpenedShard(
    node: ParsedCatalogNode,
    reference: CatalogNonemptyReference,
    plaintextByteLength: number,
  ): void {
    if (node.role !== "shard") {
      throw new KernelError(ERR_CATALOG_ROLE);
    }
    if (node.payload.prefix !== reference.prefix) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
    if (plaintextByteLength !== reference.plaintextByteLength) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
    const counts = catalogRecordCounts(node.payload.records);
    if (counts.entryCount !== reference.entryCount || counts.observationCount !== reference.observationCount) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
    if (recordsFingerprint(node.payload.records) !== reference.canonicalRecordsSha256) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
  }

  #sealJson(
    value: JsonValue,
    scopeId: string,
    recordId: string,
    kind: SnapshotHeader["kind"],
    plaintextLimit: number = LIMIT_PLAINTEXT_BYTES,
    wireLimit: number = LIMIT_PACKAGE_BYTES,
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
      if (plaintext.byteLength > plaintextLimit) {
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
      if (wire.byteLength > wireLimit) {
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

  #decryptPack(
    header: SnapshotHeader,
    ciphertext: string,
    tag: string,
    plaintextLimit: number = LIMIT_PLAINTEXT_BYTES,
  ): Buffer {
    this.#assertRootMatch(header);
    const epoch = epochById(this.#requireEpochs(), header.rootEpoch);
    const nonce = decodeNonce12(header.nonce);
    const tagBytes = decodeTag16(tag);
    const ciphertextBytes = decodeBase64Url(ciphertext, plaintextLimit);
    const aad = canonicalAad(header as unknown as JsonValue);
    const keys = deriveKeys(epoch.secretRoot, header);
    try {
      return aeadDecrypt(keys.objectKey, nonce, aad, ciphertextBytes, tagBytes);
    } finally {
      wipeDerivedKeys(keys);
    }
  }
}
