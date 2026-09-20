import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import {
  ERR_BASE64URL,
  ERR_BINDING,
  ERR_CODEC,
  ERR_INPUT_TOO_LARGE,
  ERR_ROOT,
  ERR_SCHEMA,
  KernelError,
  LIMIT_HEADER_CANONICAL_BYTES,
  LIMIT_METADATA_CANONICAL_BYTES,
  canonicalizeJson,
  canonicalizeJsonBytes,
  isolatedJsonView,
  wipeBytes,
  type JsonValue,
} from "./json.js";

import { NATIVE_CODEC_ID as NATIVE_CODEC_PIN } from "../native/pins.js";

export const NATIVE_CODEC_ID = NATIVE_CODEC_PIN;

export interface NetworkBinding {
  id: string;
  genesisHash: string | null;
}

export interface AccountBinding {
  scheme: string;
  value: string;
}

export interface ContractBinding {
  address: string;
  codeHash: string | null;
}

export interface CodecBinding {
  id: string;
  version: number;
  producerPackage: string;
  producerVersion: string;
  sourceCommit: string;
}

export interface LifecycleBinding {
  status: string;
  transactionId: string | null;
  blockHash: string | null;
}

export interface SnapshotMetadata {
  network: NetworkBinding;
  accountBinding: AccountBinding;
  applicationId: string;
  contract: ContractBinding;
  privateStateIds: string[];
  codec: CodecBinding;
  capturedAt: string;
  lifecycle: LifecycleBinding;
  parents: string[];
  retentionClass: string;
}

export interface SnapshotHeader {
  format: "wpp-witness-package";
  version: 1;
  suite: "HKDF-SHA256+A256GCM";
  vaultId: string;
  vaultSalt: string;
  rootEpoch: string;
  scopeId: string;
  recordId: string;
  generationId: string;
  kind: "snapshot" | "catalog";
  nonce: string;
}

export interface SnapshotPayload {
  payloadVersion: 1;
  metadata: SnapshotMetadata;
  content: JsonValue;
}

export interface PackageWire {
  header: SnapshotHeader;
  ciphertext: string;
  tag: string;
}

export interface RecoveryHeader {
  format: "wpp-recovery-pack";
  version: 1;
  suite: "A256GCM";
  nonce: string;
}

export interface RecoveryWire {
  header: RecoveryHeader;
  ciphertext: string;
  tag: string;
}

export interface RootEpoch {
  rootEpoch: string;
  secretRoot: string;
  createdAt: string;
  status: "active" | "retired";
}

export interface RootRecord {
  format: "wpp-root-record";
  version: 1;
  revisionId: string;
  parents: string[];
  vaultId: string;
  vaultSalt: string;
  catalogScopeId: string;
  catalogRecordId: string;
  epochs: RootEpoch[];
}

export interface ExpectedSnapshot {
  scopeId: string;
  recordId: string;
  network: NetworkBinding;
  accountBinding: AccountBinding;
  applicationId: string;
  contract: ContractBinding;
  codec: CodecBinding;
}

export interface CodecPolicy {
  id: string;
  validate(content: JsonValue, metadata: SnapshotMetadata): undefined;
}

const SCHEMA_DIR = new URL("../../docs/reference/schemas/", import.meta.url);

function loadSchema(name: string): object {
  const text = readFileSync(fileURLToPath(new URL(name, SCHEMA_DIR)), "utf8");
  return JSON.parse(text) as object;
}

const ajv = new Ajv2020({
  strict: true,
  strictTypes: false,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  validateFormats: true,
  allErrors: false,
});

const addFormats: FormatsPlugin = addFormatsModule.default;
addFormats(ajv);

ajv.addSchema(loadSchema("catalog-v1.schema.json"));
ajv.addSchema(loadSchema("package-header-v1.schema.json"));
ajv.addSchema(loadSchema("root-record-v1.schema.json"));

const validateRootSchema = compileRef("urn:wpp:root-record-v1");
const validateHeaderSchema = compileRef("urn:wpp:package-header-v1");
const validateWireSchema = compileRef("urn:wpp:package-header-v1#/$defs/wire");
const validateRecoveryWireSchema = compileRef("urn:wpp:package-header-v1#/$defs/recoveryWire");
const validatePayloadSchema = compileRef("urn:wpp:package-header-v1#/$defs/snapshotPayload");

function compileRef(ref: string): ValidateFunction {
  const existing = ajv.getSchema(ref);
  if (existing !== undefined) {
    return existing as ValidateFunction;
  }
  return ajv.compile({ $ref: ref });
}

function runSchema(validate: ValidateFunction, value: unknown): void {
  if (!validate(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
}

const B64URL_ALPHABET = /^[A-Za-z0-9_-]*$/;

function b64urlIndex(charCode: number): number {
  if (charCode >= 65 && charCode <= 90) {
    return charCode - 65;
  }
  if (charCode >= 97 && charCode <= 122) {
    return charCode - 97 + 26;
  }
  if (charCode >= 48 && charCode <= 57) {
    return charCode - 48 + 52;
  }
  if (charCode === 45) {
    return 62;
  }
  if (charCode === 95) {
    return 63;
  }
  return -1;
}

function assertCanonicalPadBits(encoded: string): void {
  const leftover = (encoded.length * 6) % 8;
  if (leftover === 0) {
    return;
  }
  if (leftover !== 2 && leftover !== 4) {
    throw new KernelError(ERR_BASE64URL);
  }
  const last = encoded.charCodeAt(encoded.length - 1);
  const index = b64urlIndex(last);
  if (index < 0) {
    throw new KernelError(ERR_BASE64URL);
  }
  const mask = (1 << leftover) - 1;
  if ((index & mask) !== 0) {
    throw new KernelError(ERR_BASE64URL);
  }
}

export function encodeBase64Url(bytes: Uint8Array): string {
  if (Buffer.isBuffer(bytes)) {
    return bytes.toString("base64url");
  }
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64url");
}

export function decodeBase64Url(encoded: string, maxDecodedBytes: number, exactDecodedBytes?: number): Buffer {
  if (typeof encoded !== "string" || encoded.includes("=") || !B64URL_ALPHABET.test(encoded)) {
    throw new KernelError(ERR_BASE64URL);
  }
  const maxEncoded = Math.ceil((maxDecodedBytes * 8) / 6);
  if (encoded.length > maxEncoded) {
    throw new KernelError(ERR_BASE64URL);
  }
  if (exactDecodedBytes !== undefined) {
    const expectedEncoded = Math.ceil((exactDecodedBytes * 8) / 6);
    if (encoded.length !== expectedEncoded) {
      throw new KernelError(ERR_BASE64URL);
    }
  }
  assertCanonicalPadBits(encoded);
  let decoded: Buffer | undefined;
  try {
    try {
      decoded = Buffer.from(encoded, "base64url");
    } catch {
      throw new KernelError(ERR_BASE64URL);
    }
    if (decoded.byteLength > maxDecodedBytes) {
      throw new KernelError(ERR_BASE64URL);
    }
    if (exactDecodedBytes !== undefined && decoded.byteLength !== exactDecodedBytes) {
      throw new KernelError(ERR_BASE64URL);
    }
    if (encodeBase64Url(decoded) !== encoded) {
      throw new KernelError(ERR_BASE64URL);
    }
    const owned = decoded;
    decoded = undefined;
    return owned;
  } finally {
    if (decoded !== undefined) {
      wipeBytes(decoded);
    }
  }
}

export function decodeId16(encoded: string): Buffer {
  return decodeBase64Url(encoded, 16, 16);
}

export function decodeId32(encoded: string): Buffer {
  return decodeBase64Url(encoded, 32, 32);
}

export function decodeNonce12(encoded: string): Buffer {
  return decodeBase64Url(encoded, 12, 12);
}

export function decodeTag16(encoded: string): Buffer {
  return decodeBase64Url(encoded, 16, 16);
}

export function assertCanonicalObjectSize(value: JsonValue, maxBytes: number): void {
  let bytes: Uint8Array | undefined;
  try {
    bytes = canonicalizeJsonBytes(value);
    if (bytes.byteLength > maxBytes) {
      throw new KernelError(ERR_INPUT_TOO_LARGE);
    }
  } finally {
    if (bytes !== undefined) {
      wipeBytes(bytes);
    }
  }
}

export function validateRootRecord(value: unknown): RootRecord {
  runSchema(validateRootSchema, value);
  const root = value as RootRecord;
  const epochIds = new Set<string>();
  let active = 0;
  for (const epoch of root.epochs) {
    if (epochIds.has(epoch.rootEpoch)) {
      throw new KernelError(ERR_ROOT);
    }
    epochIds.add(epoch.rootEpoch);
    if (epoch.status === "active") {
      active += 1;
    }
  }
  if (active !== 1) {
    throw new KernelError(ERR_ROOT);
  }
  return root;
}

export function validatePackageWire(value: unknown): PackageWire {
  runSchema(validateWireSchema, value);
  const wire = value as PackageWire;
  runSchema(validateHeaderSchema, wire.header);
  assertCanonicalObjectSize(wire.header as unknown as JsonValue, LIMIT_HEADER_CANONICAL_BYTES);
  return wire;
}

export function validateRecoveryWire(value: unknown): RecoveryWire {
  runSchema(validateRecoveryWireSchema, value);
  const wire = value as RecoveryWire;
  assertCanonicalObjectSize(wire.header as unknown as JsonValue, LIMIT_HEADER_CANONICAL_BYTES);
  return wire;
}

export function validateSnapshotPayload(value: unknown): SnapshotPayload {
  runSchema(validatePayloadSchema, value);
  const payload = value as SnapshotPayload;
  assertCanonicalObjectSize(payload.metadata as unknown as JsonValue, LIMIT_METADATA_CANONICAL_BYTES);
  return payload;
}

const validateMetadataSchema = compileRef("urn:wpp:catalog-v1#/$defs/metadata");

export function validateSnapshotMetadata(value: unknown): SnapshotMetadata {
  runSchema(validateMetadataSchema, value);
  const metadata = value as SnapshotMetadata;
  assertCanonicalObjectSize(metadata as unknown as JsonValue, LIMIT_METADATA_CANONICAL_BYTES);
  return isolatedJsonView(metadata as unknown as JsonValue) as unknown as SnapshotMetadata;
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) {
    throw new KernelError(ERR_SCHEMA);
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new KernelError(ERR_SCHEMA);
    }
  }
}

function assertString(value: unknown): string {
  if (typeof value !== "string") {
    throw new KernelError(ERR_SCHEMA);
  }
  return value;
}

function assertStringOrNull(value: unknown): string | null {
  if (value !== null && typeof value !== "string") {
    throw new KernelError(ERR_SCHEMA);
  }
  return value;
}

function assertInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
  return value;
}

export function validateExpectedSnapshot(value: unknown): ExpectedSnapshot {
  assertPlainObject(value);
  assertExactKeys(value, [
    "scopeId",
    "recordId",
    "network",
    "accountBinding",
    "applicationId",
    "contract",
    "codec",
  ]);
  decodeId32(assertString(value.scopeId));
  decodeId32(assertString(value.recordId));
  assertPlainObject(value.network);
  assertExactKeys(value.network, ["id", "genesisHash"]);
  assertString(value.network.id);
  assertStringOrNull(value.network.genesisHash);
  assertPlainObject(value.accountBinding);
  assertExactKeys(value.accountBinding, ["scheme", "value"]);
  assertString(value.accountBinding.scheme);
  assertString(value.accountBinding.value);
  assertString(value.applicationId);
  assertPlainObject(value.contract);
  assertExactKeys(value.contract, ["address", "codeHash"]);
  assertString(value.contract.address);
  assertStringOrNull(value.contract.codeHash);
  assertPlainObject(value.codec);
  assertExactKeys(value.codec, ["id", "version", "producerPackage", "producerVersion", "sourceCommit"]);
  assertString(value.codec.id);
  assertInteger(value.codec.version);
  assertString(value.codec.producerPackage);
  assertString(value.codec.producerVersion);
  assertString(value.codec.sourceCommit);
  return isolatedJsonView(value as unknown as JsonValue) as unknown as ExpectedSnapshot;
}

export function validateCodecPolicies(codecs: readonly CodecPolicy[]): Map<string, CodecPolicy> {
  if (!Array.isArray(codecs)) {
    throw new KernelError(ERR_SCHEMA);
  }
  const registry = new Map<string, CodecPolicy>();
  for (const policy of codecs) {
    if (policy === null || typeof policy !== "object") {
      throw new KernelError(ERR_SCHEMA);
    }
    if (typeof policy.id !== "string" || policy.id.length === 0) {
      throw new KernelError(ERR_SCHEMA);
    }
    if (typeof policy.validate !== "function") {
      throw new KernelError(ERR_SCHEMA);
    }
    if (registry.has(policy.id)) {
      throw new KernelError(ERR_CODEC);
    }
    registry.set(
      policy.id,
      Object.freeze({
        id: policy.id,
        validate: policy.validate,
      }) as CodecPolicy,
    );
  }
  return registry;
}

export function assertExpectedBinding(
  expected: ExpectedSnapshot,
  header: SnapshotHeader,
  metadata: SnapshotMetadata,
): void {
  if (expected.scopeId !== header.scopeId || expected.recordId !== header.recordId) {
    throw new KernelError(ERR_BINDING);
  }
  const pairs: Array<[JsonValue, JsonValue]> = [
    [expected.network as unknown as JsonValue, metadata.network as unknown as JsonValue],
    [expected.accountBinding as unknown as JsonValue, metadata.accountBinding as unknown as JsonValue],
    [expected.applicationId, metadata.applicationId],
    [expected.contract as unknown as JsonValue, metadata.contract as unknown as JsonValue],
    [expected.codec as unknown as JsonValue, metadata.codec as unknown as JsonValue],
  ];
  for (const [left, right] of pairs) {
    if (canonicalizeJson(left) !== canonicalizeJson(right)) {
      throw new KernelError(ERR_BINDING);
    }
  }
}
