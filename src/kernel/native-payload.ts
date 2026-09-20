import {
  ERR_BINDING,
  ERR_SCHEMA,
  ERR_UNSUPPORTED,
  KernelError,
  type JsonValue,
} from "./json.js";
import {
  NATIVE_CODEC_ID,
  NATIVE_CODEC_VERSION,
  NATIVE_EXPORT_FORMAT,
  NATIVE_MAX_STATE_ID_CHARS,
  NATIVE_MAX_STATE_IDS,
  NATIVE_PRODUCER_PACKAGE,
  NATIVE_PRODUCER_VERSION,
  NATIVE_SOURCE_COMMIT,
} from "../native/pins.js";
import type { CodecBinding, SnapshotMetadata } from "./validation.js";

export interface NativeExportContent {
  format: typeof NATIVE_EXPORT_FORMAT;
  encryptedPayload: string;
  salt: string;
}

const NATIVE_EXPORT_KEYS = Object.freeze(["encryptedPayload", "format", "salt"]);

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
}

export function copyNativeExportContent(value: unknown): NativeExportContent {
  assertPlainObject(value);
  const names = Object.keys(value).sort();
  if (names.length !== NATIVE_EXPORT_KEYS.length) {
    throw new KernelError(ERR_SCHEMA);
  }
  for (let i = 0; i < names.length; i += 1) {
    if (names[i] !== NATIVE_EXPORT_KEYS[i]) {
      throw new KernelError(ERR_SCHEMA);
    }
  }
  const format = value.format;
  const encryptedPayload = value.encryptedPayload;
  const salt = value.salt;
  if (format !== NATIVE_EXPORT_FORMAT) {
    throw new KernelError(ERR_SCHEMA);
  }
  if (typeof encryptedPayload !== "string" || encryptedPayload.length < 1) {
    throw new KernelError(ERR_SCHEMA);
  }
  if (typeof salt !== "string" || salt.length < 1) {
    throw new KernelError(ERR_SCHEMA);
  }
  return {
    format: NATIVE_EXPORT_FORMAT,
    encryptedPayload,
    salt,
  };
}

export function assertNativeCodec(codec: CodecBinding): void {
  if (codec.id !== NATIVE_CODEC_ID) {
    throw new KernelError(ERR_UNSUPPORTED);
  }
  if (codec.version !== NATIVE_CODEC_VERSION) {
    throw new KernelError(ERR_UNSUPPORTED);
  }
  if (codec.producerPackage !== NATIVE_PRODUCER_PACKAGE) {
    throw new KernelError(ERR_UNSUPPORTED);
  }
  if (codec.producerVersion !== NATIVE_PRODUCER_VERSION) {
    throw new KernelError(ERR_UNSUPPORTED);
  }
  if (codec.sourceCommit !== NATIVE_SOURCE_COMMIT) {
    throw new KernelError(ERR_UNSUPPORTED);
  }
}

export function copyExpectedStateIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
  if (value.length < 1 || value.length > NATIVE_MAX_STATE_IDS) {
    throw new KernelError(ERR_SCHEMA);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const id = value[i];
    if (typeof id !== "string" || id.length < 1 || id.length > NATIVE_MAX_STATE_ID_CHARS) {
      throw new KernelError(ERR_SCHEMA);
    }
    if (seen.has(id)) {
      throw new KernelError(ERR_SCHEMA);
    }
    seen.add(id);
    out.push(id);
  }
  return Object.freeze(out);
}

export function assertExactStateIds(expected: readonly string[], metadataIds: readonly string[]): void {
  if (expected.length !== metadataIds.length) {
    throw new KernelError(ERR_BINDING);
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i] !== metadataIds[i]) {
      throw new KernelError(ERR_BINDING);
    }
  }
}

export function assertProviderBinding(
  metadata: SnapshotMetadata,
  accountId: string,
  contractAddress: string,
): void {
  if (metadata.accountBinding.value !== accountId) {
    throw new KernelError(ERR_BINDING);
  }
  if (metadata.contract.address !== contractAddress) {
    throw new KernelError(ERR_BINDING);
  }
}

export function nativePayloadJson(metadata: SnapshotMetadata, content: NativeExportContent): JsonValue {
  return {
    payloadVersion: 1,
    metadata: metadata as unknown as JsonValue,
    content: content as unknown as JsonValue,
  };
}
