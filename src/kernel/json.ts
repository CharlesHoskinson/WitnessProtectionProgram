import { visit, ParseErrorCode, type ParseError, type JSONVisitor } from "jsonc-parser";
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

export function assertByteCeiling(bytes: Uint8Array, maxBytes: number): void {
  if (bytes.byteLength > maxBytes) {
    throw new KernelError(ERR_INPUT_TOO_LARGE);
  }
}

export function rejectBom(bytes: Uint8Array): void {
  if (bytes.byteLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
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
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      i += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function classifyParseError(error: ParseError): string {
  switch (error.error) {
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

  const errors: ParseError[] = [];
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
    onError: (error: ParseErrorCode, offset: number, length: number) => {
      errors.push({ error, offset, length });
    },
  };

  visit(text, visitor, VISIT_OPTIONS);

  if (!sawValue && errors.length === 0) {
    throw new KernelError(ERR_JSON_EMPTY);
  }

  for (const error of errors) {
    if (
      (error.error === ParseErrorCode.PropertyNameExpected ||
        error.error === ParseErrorCode.CloseBraceExpected ||
        error.error === ParseErrorCode.CloseBracketExpected ||
        error.error === ParseErrorCode.ValueExpected ||
        error.error === ParseErrorCode.InvalidSymbol) &&
      isLikelyTrailingComma(text, error.offset)
    ) {
      throw new KernelError(ERR_JSON_TRAILING_COMMA);
    }
    throw new KernelError(classifyParseError(error));
  }
}

function assertJsonTree(value: JsonValue): void {
  const stack: JsonValue[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
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
  assertByteCeiling(bytes, maxBytes);
  rejectBom(bytes);
  const text = decodeUtf8Fatal(bytes);
  return parseJsonText(text);
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
  if (!bytesEqual(plaintext, canonical)) {
    throw new KernelError(ERR_NONCANONICAL);
  }
}

export function wipeBytes(buffer: Uint8Array): void {
  buffer.fill(0);
}
