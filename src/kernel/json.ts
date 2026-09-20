import { types } from "node:util";
import { visit, ParseErrorCode, type JSONVisitor } from "jsonc-parser";
import canonicalize from "canonicalize";

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const LIMIT_PACKAGE_BYTES = 24 * 1024 * 1024;
export const LIMIT_PLAINTEXT_BYTES = 16 * 1024 * 1024;
export const LIMIT_ROOT_BYTES = 64 * 1024;
export const LIMIT_RECOVERY_WIRE_BYTES = 96 * 1024;
export const LIMIT_HEADER_CANONICAL_BYTES = 4 * 1024;
export const LIMIT_METADATA_CANONICAL_BYTES = 64 * 1024;
export const LIMIT_JSON_DEPTH = 32;

export const ERR_INPUT_TOO_LARGE = "WPP_INPUT_TOO_LARGE";
export const ERR_BOM = "WPP_BOM";
export const ERR_UTF8 = "WPP_UTF8";
export const ERR_JSON_PARSE = "WPP_JSON_PARSE";
export const ERR_JSON_COMMENT = "WPP_JSON_COMMENT";
export const ERR_JSON_TRAILING_COMMA = "WPP_JSON_TRAILING_COMMA";
export const ERR_JSON_EMPTY = "WPP_JSON_EMPTY";
export const ERR_JSON_DEPTH = "WPP_JSON_DEPTH";
export const ERR_JSON_DUPLICATE_KEY = "WPP_JSON_DUPLICATE_KEY";
export const ERR_JSON_TRAILING_TOKEN = "WPP_JSON_TRAILING_TOKEN";
export const ERR_JSON_SURROGATE = "WPP_JSON_SURROGATE";
export const ERR_JSON_NONFINITE = "WPP_JSON_NONFINITE";
export const ERR_JSON_CANONICAL = "WPP_JSON_CANONICAL";
export const ERR_SCHEMA = "WPP_SCHEMA";
export const ERR_UNKNOWN_FIELD = "WPP_UNKNOWN_FIELD";
export const ERR_BASE64URL = "WPP_BASE64URL";
export const ERR_UNSUPPORTED = "WPP_UNSUPPORTED";
export const ERR_CODEC = "WPP_CODEC";
export const ERR_CODEC_UNKNOWN = "WPP_CODEC_UNKNOWN";
export const ERR_BINDING = "WPP_BINDING";
export const ERR_AUTH = "WPP_AUTH";
export const ERR_NONCANONICAL = "WPP_NONCANONICAL";
export const ERR_ROOT = "WPP_ROOT";
export const ERR_EPOCH = "WPP_EPOCH";
export const ERR_LOCKED = "WPP_LOCKED";
export const ERR_RANDOM = "WPP_RANDOM";
export const ERR_RECOVERY = "WPP_RECOVERY";
export const ERR_INTERNAL = "WPP_INTERNAL";

export class KernelError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "KernelError";
    this.code = code;
  }
}

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
const UTF8_ENCODER = new TextEncoder();

const VISIT_OPTIONS = {
  disallowComments: true,
  allowTrailingComma: false,
  allowEmptyContent: false,
} as const;

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const ARRAY_BUFFER_DETACHED = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "detached")?.get;

function assertNativeBytes(bytes: unknown): asserts bytes is Uint8Array {
  if (!types.isUint8Array(bytes)) {
    throw new KernelError(ERR_SCHEMA);
  }
}

function isDetachedBytes(bytes: Uint8Array): boolean {
  if (typeof TYPED_ARRAY_BUFFER !== "function" || typeof ARRAY_BUFFER_DETACHED !== "function") {
    throw new KernelError(ERR_INTERNAL);
  }
  let buffer: ArrayBufferLike;
  try {
    buffer = TYPED_ARRAY_BUFFER.call(bytes);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  try {
    return ARRAY_BUFFER_DETACHED.call(buffer) === true;
  } catch {
    return false;
  }
}

function intrinsicByteLength(bytes: Uint8Array): number {
  if (typeof TYPED_ARRAY_BYTE_LENGTH !== "function") {
    throw new KernelError(ERR_INTERNAL);
  }
  let length: unknown;
  try {
    length = TYPED_ARRAY_BYTE_LENGTH.call(bytes);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
    throw new KernelError(ERR_SCHEMA);
  }
  return length;
}

function copyFromIntrinsic(bytes: Uint8Array, length: number): Uint8Array {
  const owned = new Uint8Array(length);
  try {
    Uint8Array.prototype.set.call(owned, bytes);
  } catch {
    throw new KernelError(ERR_SCHEMA);
  }
  return owned;
}

export function copyOwnedBytes(bytes: Uint8Array, maxBytes: number): Uint8Array {
  assertNativeBytes(bytes);
  if (isDetachedBytes(bytes)) {
    throw new KernelError(ERR_SCHEMA);
  }
  const length = intrinsicByteLength(bytes);
  if (length > maxBytes) {
    throw new KernelError(ERR_INPUT_TOO_LARGE);
  }
  return copyFromIntrinsic(bytes, length);
}

export function copyExactOwnedBytes(
  bytes: Uint8Array,
  exactBytes: number,
  mismatchCode: string,
): Uint8Array {
  assertNativeBytes(bytes);
  if (isDetachedBytes(bytes)) {
    throw new KernelError(ERR_SCHEMA);
  }
  const length = intrinsicByteLength(bytes);
  if (length !== exactBytes) {
    throw new KernelError(mismatchCode);
  }
  return copyFromIntrinsic(bytes, length);
}

export function assertByteCeiling(bytes: Uint8Array, maxBytes: number): void {
  assertNativeBytes(bytes);
  if (isDetachedBytes(bytes)) {
    throw new KernelError(ERR_SCHEMA);
  }
  if (intrinsicByteLength(bytes) > maxBytes) {
    throw new KernelError(ERR_INPUT_TOO_LARGE);
  }
}

export function rejectBom(bytes: Uint8Array): void {
  if (intrinsicByteLength(bytes) >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new KernelError(ERR_BOM);
  }
}

export function decodeUtf8Fatal(bytes: Uint8Array): string {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    throw new KernelError(ERR_UTF8);
  }
}

export function encodeUtf8(text: string): Uint8Array {
  return UTF8_ENCODER.encode(text);
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

function hasLoneSurrogate(text: string): boolean {
  return !text.isWellFormed();
}

function classifyParseError(error: ParseErrorCode): string {
  switch (error) {
    case ParseErrorCode.InvalidCommentToken:
    case ParseErrorCode.UnexpectedEndOfComment:
      return ERR_JSON_COMMENT;
    case ParseErrorCode.EndOfFileExpected:
      return ERR_JSON_TRAILING_TOKEN;
    case ParseErrorCode.InvalidSymbol:
    case ParseErrorCode.InvalidNumberFormat:
    case ParseErrorCode.PropertyNameExpected:
    case ParseErrorCode.ValueExpected:
    case ParseErrorCode.ColonExpected:
    case ParseErrorCode.CommaExpected:
    case ParseErrorCode.CloseBraceExpected:
    case ParseErrorCode.CloseBracketExpected:
    case ParseErrorCode.UnexpectedEndOfString:
    case ParseErrorCode.UnexpectedEndOfNumber:
    case ParseErrorCode.InvalidUnicode:
    case ParseErrorCode.InvalidEscapeCharacter:
    case ParseErrorCode.InvalidCharacter:
      return ERR_JSON_PARSE;
    default:
      return ERR_JSON_PARSE;
  }
}

function isLikelyTrailingComma(text: string, offset: number): boolean {
  let i = offset - 1;
  while (i >= 0) {
    const ch = text.charCodeAt(i);
    if (ch === 0x20 || ch === 0x09 || ch === 0x0a || ch === 0x0d) {
      i -= 1;
      continue;
    }
    return ch === 0x2c;
  }
  return false;
}

function inspectJsonText(text: string): void {
  if (text.length === 0) {
    throw new KernelError(ERR_JSON_EMPTY);
  }

  const keyStacks: Array<Set<string>> = [];
  let depth = 0;
  let sawValue = false;

  const visitor: JSONVisitor = {
    onObjectBegin: () => {
      depth += 1;
      if (depth > LIMIT_JSON_DEPTH) {
        throw new KernelError(ERR_JSON_DEPTH);
      }
      keyStacks.push(new Set());
      sawValue = true;
      return true;
    },
    onObjectProperty: (property: string) => {
      if (hasLoneSurrogate(property)) {
        throw new KernelError(ERR_JSON_SURROGATE);
      }
      const current = keyStacks[keyStacks.length - 1];
      if (current === undefined) {
        throw new KernelError(ERR_JSON_PARSE);
      }
      if (current.has(property)) {
        throw new KernelError(ERR_JSON_DUPLICATE_KEY);
      }
      current.add(property);
    },
    onObjectEnd: () => {
      keyStacks.pop();
      depth -= 1;
    },
    onArrayBegin: () => {
      depth += 1;
      if (depth > LIMIT_JSON_DEPTH) {
        throw new KernelError(ERR_JSON_DEPTH);
      }
      sawValue = true;
      return true;
    },
    onArrayEnd: () => {
      depth -= 1;
    },
    onLiteralValue: (value: unknown) => {
      sawValue = true;
      if (typeof value === "string" && hasLoneSurrogate(value)) {
        throw new KernelError(ERR_JSON_SURROGATE);
      }
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new KernelError(ERR_JSON_NONFINITE);
      }
    },
    onError: (error: ParseErrorCode, offset: number) => {
      if (
        (error === ParseErrorCode.PropertyNameExpected ||
          error === ParseErrorCode.CloseBraceExpected ||
          error === ParseErrorCode.CloseBracketExpected ||
          error === ParseErrorCode.ValueExpected ||
          error === ParseErrorCode.InvalidSymbol) &&
        isLikelyTrailingComma(text, offset)
      ) {
        throw new KernelError(ERR_JSON_TRAILING_COMMA);
      }
      throw new KernelError(classifyParseError(error));
    },
  };

  visit(text, visitor, VISIT_OPTIONS);

  if (!sawValue) {
    throw new KernelError(ERR_JSON_EMPTY);
  }
}

function assertJsonTree(value: JsonValue): void {
  const stack: JsonValue[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      throw new KernelError(ERR_JSON_PARSE);
    }
    if (typeof current === "string") {
      if (hasLoneSurrogate(current)) {
        throw new KernelError(ERR_JSON_SURROGATE);
      }
      continue;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        throw new KernelError(ERR_JSON_NONFINITE);
      }
      continue;
    }
    if (current === null || typeof current === "boolean") {
      continue;
    }
    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item);
      }
      continue;
    }
    if (typeof current !== "object") {
      throw new KernelError(ERR_JSON_PARSE);
    }
    for (const [key, child] of Object.entries(current)) {
      if (hasLoneSurrogate(key)) {
        throw new KernelError(ERR_JSON_SURROGATE);
      }
      stack.push(child);
    }
  }
}

export function parseJsonText(text: string): JsonValue {
  inspectJsonText(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new KernelError(ERR_JSON_PARSE);
  }
  assertJsonTree(parsed as JsonValue);
  return parsed as JsonValue;
}

export function parseJsonBytes(bytes: Uint8Array, maxBytes: number): JsonValue {
  const owned = copyOwnedBytes(bytes, maxBytes);
  try {
    rejectBom(owned);
    const text = decodeUtf8Fatal(owned);
    return parseJsonText(text);
  } finally {
    wipeBytes(owned);
  }
}

export function canonicalizeJson(value: JsonValue): string {
  assertJsonTree(value);
  let canonical: string | undefined;
  try {
    canonical = canonicalize(value);
  } catch {
    throw new KernelError(ERR_JSON_CANONICAL);
  }
  if (typeof canonical !== "string") {
    throw new KernelError(ERR_JSON_CANONICAL);
  }
  if (hasLoneSurrogate(canonical)) {
    throw new KernelError(ERR_JSON_SURROGATE);
  }
  return canonical;
}

export function canonicalizeJsonBytes(value: JsonValue): Uint8Array {
  return encodeUtf8(canonicalizeJson(value));
}

export function assertCanonicalPayloadBytes(plaintext: Uint8Array, parsed: JsonValue): void {
  const canonical = canonicalizeJsonBytes(parsed);
  try {
    if (!bytesEqual(plaintext, canonical)) {
      throw new KernelError(ERR_NONCANONICAL);
    }
  } finally {
    wipeBytes(canonical);
  }
}

export function cloneJsonValue(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    const out: JsonValue[] = new Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      out[i] = cloneJsonValue(value[i]);
    }
    return out;
  }
  const out = Object.create(null) as { [key: string]: JsonValue };
  for (const key of Object.keys(value)) {
    Object.defineProperty(out, key, {
      value: cloneJsonValue(value[key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

export function freezeJsonValue(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      freezeJsonValue(item);
    }
  } else {
    for (const key of Object.keys(value)) {
      freezeJsonValue(value[key]);
    }
  }
  Object.freeze(value);
  return value;
}

export function isolatedJsonView(value: JsonValue): JsonValue {
  return freezeJsonValue(cloneJsonValue(value));
}

export function wipeBytes(buffer: Uint8Array): void {
  buffer.fill(0);
}
