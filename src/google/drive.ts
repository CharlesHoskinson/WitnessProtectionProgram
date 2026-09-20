import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isArrayBuffer, isProxy, isSharedArrayBuffer, isUint8Array } from "node:util/types";

import {
  copyOwnedBytes,
  LIMIT_JSON_DEPTH,
  LIMIT_PACKAGE_BYTES,
  LIMIT_PLAINTEXT_BYTES,
  parseJsonBytes,
  wipeBytes,
} from "../kernel/json.js";
import { decodeBase64Url, decodeNonce12, decodeTag16, validatePackageWire } from "../kernel/validation.js";
import {
  ERR_BIND_IDENTITY,
  ERR_DRIVE_AUTH,
  ERR_DRIVE_CREATE,
  ERR_DRIVE_INCOMPLETE,
  ERR_DRIVE_INPUT,
  ERR_DRIVE_QUOTA,
  ERR_DRIVE_READBACK,
  ERR_DRIVE_REDIRECT,
  ERR_OAUTH_SCOPE,
  GoogleError,
} from "./errors.js";
import {
  DRIVE_ABOUT_URL,
  DRIVE_FILES_URL,
  DRIVE_LIST_FIELDS,
  DRIVE_LIST_JSON_MAX_BYTES,
  DRIVE_LIST_MAX_ITEMS,
  DRIVE_LIST_MAX_PAGE_TOKEN_CHARS,
  DRIVE_LIST_MAX_PAGES,
  DRIVE_LIST_PAGE_SIZE,
  DRIVE_LIST_QUERY,
  DRIVE_UPLOAD_URL,
  GOOGLE_JSON_MAX_BYTES,
  GOOGLE_MEDIA_TIMEOUT_MS,
  GOOGLE_REQUEST_TIMEOUT_MS,
  LIST_REASON_DUPLICATE_CONFLICT,
  LIST_REASON_INCOMPLETE_SEARCH,
  LIST_REASON_ITEM_CEILING,
  LIST_REASON_JSON_BOUND,
  LIST_REASON_MALFORMED_CANDIDATE,
  LIST_REASON_PAGE_CEILING,
  LIST_REASON_PAGE_FAILURE,
  LIST_REASON_PAGE_TOKEN,
  LIST_REASON_PAGE_TOKEN_CYCLE,
  type AuthClientLike,
  type CiphertextCandidate,
  type CiphertextCandidateList,
  type InjectedRequest,
  type RemoteGetExpected,
  type RemoteGetReceipt,
  type RemotePutReceipt,
} from "./types.js";

interface SessionInternals {
  permissionId: string;
  request?: InjectedRequest;
  authClient?: Pick<AuthClientLike, "request">;
}

const SESSION_INTERNALS = new WeakMap<GoogleDriveSession, SessionInternals>();
const FILE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const WPP_NAME_RE = /^[0-9a-f]{64}\.wpp$/;
const MATCHING_WPP_NAME_RE = /\.wpp$/i;
const INTRINSIC_BIND = Function.prototype.bind;
const INTRINSIC_CALL = Function.prototype.call;
const INTRINSIC_SET = Uint8Array.prototype.set;
const OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const OBJECT_GET_OWN_PROPERTY_NAMES = Object.getOwnPropertyNames;
const HEADERS_FOREACH = Headers.prototype.forEach;
const URLSEARCHPARAMS_FOREACH = URLSearchParams.prototype.forEach;
const CONTENT_LENGTH_RE = /^(0|[1-9][0-9]{0,15})$/;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;
const ARRAY_BUFFER_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)?.get;
const STATIC_DRIVE_CODES = new Set<string>([
  ERR_BIND_IDENTITY,
  ERR_DRIVE_AUTH,
  ERR_DRIVE_CREATE,
  ERR_DRIVE_INCOMPLETE,
  ERR_DRIVE_INPUT,
  ERR_DRIVE_QUOTA,
  ERR_DRIVE_READBACK,
  ERR_DRIVE_REDIRECT,
  ERR_OAUTH_SCOPE,
]);

export function isOpaquePermissionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,128}$/.test(value);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function equalHex(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual, "utf8"), Buffer.from(expected, "utf8"));
}

function equalOpaqueId(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual, "utf8"), Buffer.from(expected, "utf8"));
}

function safeGet(value: unknown, key: string): unknown {
  try {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
      return undefined;
    }
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function asFiniteInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function staticCode(value: unknown, fallback: string): string {
  return typeof value === "string" && STATIC_DRIVE_CODES.has(value) ? value : fallback;
}

function freshError(code: string): GoogleError {
  return new GoogleError(staticCode(code, ERR_DRIVE_READBACK));
}

function remapError(err: unknown, fallback: string): GoogleError {
  return freshError(staticCode(safeGet(err, "code"), fallback));
}

function throwFresh(code: string): never {
  throw freshError(code);
}

type InjectedBodyCopy =
  | { kind: "ok"; bytes: Buffer }
  | { kind: "oversize" }
  | { kind: "invalid" };

function intrinsicTypedArrayByteLength(value: Uint8Array): number | undefined {
  if (typeof TYPED_ARRAY_BYTE_LENGTH !== "function") {
    return undefined;
  }
  try {
    const length = TYPED_ARRAY_BYTE_LENGTH.call(value);
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
      return undefined;
    }
    return length;
  } catch {
    return undefined;
  }
}

function intrinsicArrayBufferByteLength(value: ArrayBuffer): number | undefined {
  if (typeof ARRAY_BUFFER_BYTE_LENGTH !== "function") {
    return undefined;
  }
  try {
    const length = ARRAY_BUFFER_BYTE_LENGTH.call(value);
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
      return undefined;
    }
    return length;
  } catch {
    return undefined;
  }
}

function copyFromArrayBuffer(data: ArrayBuffer, ceiling: number): InjectedBodyCopy {
  const length = intrinsicArrayBufferByteLength(data);
  if (length === undefined) {
    return { kind: "invalid" };
  }
  if (length > ceiling) {
    return { kind: "oversize" };
  }
  const owned = Buffer.alloc(length);
  try {
    const view = new Uint8Array(data);
    if (length > 0) {
      INTRINSIC_CALL.call(INTRINSIC_SET, owned, view);
    }
  } catch {
    return { kind: "invalid" };
  }
  return { kind: "ok", bytes: owned };
}

function copyFromTypedArray(body: Uint8Array, ceiling: number): InjectedBodyCopy {
  const length = intrinsicTypedArrayByteLength(body);
  if (length === undefined) {
    return { kind: "invalid" };
  }
  if (length > ceiling) {
    return { kind: "oversize" };
  }
  const owned = Buffer.alloc(length);
  try {
    INTRINSIC_CALL.call(INTRINSIC_SET, owned, body);
  } catch {
    return { kind: "invalid" };
  }
  return { kind: "ok", bytes: owned };
}

function copyInjectedBody(body: unknown, ceiling: number): InjectedBodyCopy {
  try {
    if (typeof ceiling !== "number" || !Number.isSafeInteger(ceiling) || ceiling < 0) {
      return { kind: "invalid" };
    }
    if (isProxy(body)) {
      return { kind: "invalid" };
    }
    if (isSharedArrayBuffer(body)) {
      return { kind: "invalid" };
    }
    if (isArrayBuffer(body)) {
      return copyFromArrayBuffer(body, ceiling);
    }
    if (isUint8Array(body)) {
      return copyFromTypedArray(body, ceiling);
    }
    return { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function captureAuthClient(
  authClient: unknown,
): Pick<AuthClientLike, "request"> | undefined {
  try {
    if (authClient === null || (typeof authClient !== "object" && typeof authClient !== "function")) {
      return undefined;
    }
    const method = safeGet(authClient, "request");
    if (typeof method !== "function") {
      return undefined;
    }
    const bound = INTRINSIC_CALL.call(INTRINSIC_BIND, method, authClient);
    if (typeof bound !== "function") {
      return undefined;
    }
    return { request: bound as AuthClientLike["request"] };
  } catch {
    return undefined;
  }
}

type SuccessResponseFields = {
  status: unknown;
  headers: unknown;
  body: unknown;
  data: unknown;
};

function assertInspectableObject(value: unknown): asserts value is object {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    throw new TypeError("invalid object");
  }
}

function readSuccessResponseFields(res: unknown): SuccessResponseFields {
  assertInspectableObject(res);
  if (isProxy(res)) {
    throw new TypeError("proxy response");
  }
  const record = res as Record<string, unknown>;
  return {
    status: record.status,
    headers: record.headers,
    body: record.body,
    data: record.data,
  };
}

function assertValidContentLength(value: string): void {
  if (!CONTENT_LENGTH_RE.test(value)) {
    throw new TypeError("invalid content-length");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new TypeError("invalid content-length");
  }
}

type HeaderForEach = (this: object, callback: (value: string, name: string) => void) => void;

function collectBrandedHeaders(headers: object, forEach: HeaderForEach): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  const invalid = new TypeError("invalid header entry");
  try {
    forEach.call(headers, (value, name) => {
      if (typeof name !== "string" || typeof value !== "string") {
        throw invalid;
      }
      const lower = name.toLowerCase();
      if (seen.has(lower)) {
        throw invalid;
      }
      seen.add(lower);
      out[lower] = value;
    });
  } catch (err) {
    if (err === invalid) {
      throw invalid;
    }
    throw new TypeError("spoofed header brand");
  }
  if (out["content-length"] !== undefined) {
    assertValidContentLength(out["content-length"]);
  }
  return out;
}

function normalizePlainHeaderRecord(headers: object): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  for (const name of OBJECT_GET_OWN_PROPERTY_NAMES(headers)) {
    const desc = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(headers, name);
    if (desc === undefined) {
      throw new TypeError("inaccessible header");
    }
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      throw new TypeError("duplicate header");
    }
    seen.add(lower);
    if (lower === "content-length") {
      if (desc.get !== undefined || desc.set !== undefined) {
        throw new TypeError("accessor content-length");
      }
      if (!desc.enumerable) {
        throw new TypeError("nonenumerable content-length");
      }
      if (typeof desc.value !== "string") {
        throw new TypeError("unsupported content-length");
      }
      assertValidContentLength(desc.value);
      out[lower] = desc.value;
      continue;
    }
    if (!desc.enumerable || desc.get !== undefined || desc.set !== undefined) {
      continue;
    }
    if (typeof desc.value === "string") {
      out[lower] = desc.value;
    } else if (Array.isArray(desc.value) && typeof desc.value[0] === "string") {
      out[lower] = desc.value.join(", ");
    }
  }
  return out;
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (headers === undefined || headers === null) {
    return {};
  }
  assertInspectableObject(headers);
  if (isProxy(headers)) {
    throw new TypeError("proxy headers");
  }
  const proto = OBJECT_GET_PROTOTYPE_OF(headers);
  if (isProxy(proto)) {
    throw new TypeError("proxy header prototype");
  }
  if (proto === Headers.prototype) {
    return collectBrandedHeaders(headers, HEADERS_FOREACH as HeaderForEach);
  }
  if (proto === URLSearchParams.prototype) {
    return collectBrandedHeaders(headers, URLSEARCHPARAMS_FOREACH as HeaderForEach);
  }
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError("invalid header prototype");
  }
  return normalizePlainHeaderRecord(headers);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedField(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.length > max ? value.slice(0, max) : value;
}

function inspectErrorData(data: unknown): { reason: string; status: string } {
  if (typeof data === "string") {
    return { reason: "", status: "" };
  }
  if (!isRecord(data)) {
    return { reason: "", status: "" };
  }
  const error = safeGet(data, "error");
  if (typeof error === "string") {
    return { reason: boundedField(error, 64), status: "" };
  }
  if (!isRecord(error)) {
    return { reason: "", status: "" };
  }
  let reason = boundedField(safeGet(error, "reason"), 64);
  const status = boundedField(safeGet(error, "status"), 64);
  const errors = safeGet(error, "errors");
  if (reason.length === 0 && Array.isArray(errors) && isRecord(errors[0])) {
    reason = boundedField(safeGet(errors[0], "reason"), 64);
  }
  return { reason, status };
}

function classifyDriveError(status: number, data: unknown, phase: "create" | "read"): never {
  let code = phase === "create" ? ERR_DRIVE_CREATE : ERR_DRIVE_READBACK;
  try {
    const info = inspectErrorData(data);
    if (status === 401) {
      code = ERR_DRIVE_AUTH;
    } else if (status === 403 && info.reason === "storageQuotaExceeded") {
      code = ERR_DRIVE_QUOTA;
    } else if (status === 403) {
      code = ERR_DRIVE_AUTH;
    } else if (status >= 300 && status < 400) {
      code = ERR_DRIVE_REDIRECT;
    } else if (phase === "create" && status >= 500) {
      code = ERR_DRIVE_INCOMPLETE;
    } else if (phase === "create") {
      code = ERR_DRIVE_CREATE;
    } else {
      code = ERR_DRIVE_READBACK;
    }
  } catch {
    code = phase === "create" ? ERR_DRIVE_CREATE : ERR_DRIVE_READBACK;
  }
  throwFresh(code);
}

function isAbortOrSize(err: unknown): boolean {
  try {
    if (!(err instanceof Error)) {
      return false;
    }
    const code = safeGet(err, "code");
    const name = safeGet(err, "name");
    const messageValue = safeGet(err, "message");
    const message = typeof messageValue === "string" ? messageValue.toLowerCase() : "";
    if (code === "ERR_RESPONSE_TOO_LARGE" || code === "TimeoutError" || code === "ABORT_ERR") {
      return true;
    }
    if (name === "TimeoutError" || name === "AbortError") {
      return true;
    }
    return (
      message.includes("aborted") ||
      message.includes("timeout") ||
      message.includes("maxcontentlength") ||
      message.includes("max content")
    );
  } catch {
    return false;
  }
}

function parseJsonResponse(body: Uint8Array): unknown {
  if (body.byteLength === 0) {
    return undefined;
  }
  try {
    return JSON.parse(Buffer.from(body).toString("utf8")) as unknown;
  } catch {
    return undefined;
  }
}

type JsonCapture =
  | { kind: "ok"; json: unknown }
  | { kind: "oversize" }
  | { kind: "invalid" };

function captureOwnedJsonValue(value: unknown, ceiling: number): JsonCapture {
  try {
    if (typeof ceiling !== "number" || !Number.isSafeInteger(ceiling) || ceiling < 0) {
      return { kind: "invalid" };
    }
    if (typeof value === "string") {
      const length = Buffer.byteLength(value);
      if (length > ceiling) {
        return { kind: "oversize" };
      }
      return { kind: "ok", json: JSON.parse(value) };
    }
    const copied = copyInjectedBody(value, ceiling);
    if (copied.kind === "ok") {
      if (copied.bytes.byteLength === 0) {
        return { kind: "invalid" };
      }
      try {
        return { kind: "ok", json: JSON.parse(copied.bytes.toString("utf8")) };
      } catch {
        return { kind: "invalid" };
      }
    }
    if (copied.kind === "oversize") {
      return { kind: "oversize" };
    }
    if (value === undefined || value === null) {
      return { kind: "invalid" };
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      return { kind: "invalid" };
    }
    if (typeof serialized !== "string") {
      return { kind: "invalid" };
    }
    const length = Buffer.byteLength(serialized);
    if (length > ceiling) {
      return { kind: "oversize" };
    }
    return { kind: "ok", json: JSON.parse(serialized) };
  } catch {
    return { kind: "invalid" };
  }
}

type ListPageResult = { ok: true; json: unknown } | { ok: false; reason: string };

type JsonCloneState = {
  ceiling: number;
  bytes: number;
  seen: WeakSet<object>;
};

type JsonCloneResult = { ok: true; value: unknown } | { ok: false; reason: string };

const LIST_COMPLETION_KEYS = ["files", "incompleteSearch", "nextPageToken"] as const;
const LIST_COMPLETION_KEY_SET = new Set<string>(LIST_COMPLETION_KEYS);

function listJsonFail(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

function isAccessorDescriptor(desc: PropertyDescriptor): boolean {
  return desc.get !== undefined || desc.set !== undefined;
}

function addExactJsonBytes(state: JsonCloneState, n: number): boolean {
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) {
    return false;
  }
  if (state.bytes > state.ceiling - n) {
    return false;
  }
  state.bytes += n;
  return true;
}

function addJsonStringBytes(state: JsonCloneState, text: string): boolean {
  if (!addExactJsonBytes(state, 1)) {
    return false;
  }
  const length = text.length;
  for (let i = 0; i < length; i += 1) {
    const code = text.charCodeAt(i);
    let add: number;
    if (code === 0x22 || code === 0x5c) {
      add = 2;
    } else if (code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d) {
      add = 2;
    } else if (code < 0x20) {
      add = 6;
    } else if (code < 0x80) {
      add = 1;
    } else if (code < 0x800) {
      add = 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        add = 4;
        i += 1;
      } else {
        add = 6;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      add = 6;
    } else {
      add = 3;
    }
    if (!addExactJsonBytes(state, add)) {
      return false;
    }
  }
  return addExactJsonBytes(state, 1);
}

function hasOwnCustomToJSON(value: object): boolean {
  const desc = Object.getOwnPropertyDescriptor(value, "toJSON");
  return desc !== undefined && (isAccessorDescriptor(desc) || typeof desc.value === "function");
}

function jsonPrototypeAllowed(proto: object | null, asArray: boolean): boolean {
  if (isProxy(proto)) {
    return false;
  }
  if (asArray) {
    return proto === Array.prototype;
  }
  return proto === Object.prototype || proto === null;
}

function defineOwnedJsonProperty(owned: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(owned, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function clonePlainJson(value: unknown, depth: number, state: JsonCloneState): JsonCloneResult {
  if (depth > LIMIT_JSON_DEPTH) {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  if (value === null) {
    if (!addExactJsonBytes(state, 4)) {
      return listJsonFail(LIST_REASON_JSON_BOUND);
    }
    return { ok: true, value: null };
  }
  switch (typeof value) {
    case "boolean": {
      if (!addExactJsonBytes(state, value ? 4 : 5)) {
        return listJsonFail(LIST_REASON_JSON_BOUND);
      }
      return { ok: true, value };
    }
    case "number": {
      if (!Number.isFinite(value)) {
        return listJsonFail(LIST_REASON_PAGE_FAILURE);
      }
      const encoded = JSON.stringify(value);
      if (typeof encoded !== "string") {
        return listJsonFail(LIST_REASON_PAGE_FAILURE);
      }
      if (!addExactJsonBytes(state, Buffer.byteLength(encoded))) {
        return listJsonFail(LIST_REASON_JSON_BOUND);
      }
      return { ok: true, value };
    }
    case "string": {
      if (!addJsonStringBytes(state, value)) {
        return listJsonFail(LIST_REASON_JSON_BOUND);
      }
      return { ok: true, value };
    }
    case "bigint":
    case "function":
    case "symbol":
    case "undefined":
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    case "object":
      break;
    default:
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  if (isProxy(value)) {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  let proto: object | null;
  try {
    proto = Object.getPrototypeOf(value);
  } catch {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  if (isProxy(proto)) {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  if (state.seen.has(value)) {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  const asArray = Array.isArray(value);
  if (!jsonPrototypeAllowed(proto, asArray)) {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  if (hasOwnCustomToJSON(value)) {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  if (asArray) {
    return clonePlainArray(value, depth, state);
  }
  return clonePlainObject(value, depth, state, depth === 0);
}

function clonePlainArray(value: unknown[], depth: number, state: JsonCloneState): JsonCloneResult {
  state.seen.add(value);
  const lengthDesc = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDesc === undefined ||
    isAccessorDescriptor(lengthDesc) ||
    typeof lengthDesc.value !== "number" ||
    !Number.isSafeInteger(lengthDesc.value) ||
    lengthDesc.value < 0
  ) {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  const length = lengthDesc.value;
  if (length > state.ceiling || length > state.ceiling - state.bytes) {
    return listJsonFail(LIST_REASON_JSON_BOUND);
  }
  if (!addExactJsonBytes(state, 2)) {
    return listJsonFail(LIST_REASON_JSON_BOUND);
  }
  const items: unknown[] = [];
  for (let i = 0; i < length; i += 1) {
    if (i > 0 && !addExactJsonBytes(state, 1)) {
      return listJsonFail(LIST_REASON_JSON_BOUND);
    }
    const desc = Object.getOwnPropertyDescriptor(value, String(i));
    if (desc === undefined || isAccessorDescriptor(desc) || desc.enumerable !== true) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    const cloned = clonePlainJson(desc.value, depth + 1, state);
    if (!cloned.ok) {
      return cloned;
    }
    items.push(cloned.value);
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length > state.ceiling) {
    return listJsonFail(LIST_REASON_JSON_BOUND);
  }
  for (const name of names) {
    if (name === "length") {
      continue;
    }
    if (/^(0|[1-9][0-9]*)$/.test(name) && Number(name) < length) {
      continue;
    }
    const extra = Object.getOwnPropertyDescriptor(value, name);
    if (extra === undefined || isAccessorDescriptor(extra)) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  return { ok: true, value: items };
}

function clonePlainObject(
  value: object,
  depth: number,
  state: JsonCloneState,
  isListRoot: boolean,
): JsonCloneResult {
  state.seen.add(value);
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length > state.ceiling) {
    return listJsonFail(LIST_REASON_JSON_BOUND);
  }
  if (!addExactJsonBytes(state, 2)) {
    return listJsonFail(LIST_REASON_JSON_BOUND);
  }
  const owned = Object.create(null) as Record<string, unknown>;
  const ownCompletion = new Set<string>();
  let first = true;
  for (const key of names) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc === undefined) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    if (isAccessorDescriptor(desc)) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    if (isListRoot && LIST_COMPLETION_KEY_SET.has(key)) {
      ownCompletion.add(key);
      if (desc.enumerable !== true) {
        return listJsonFail(LIST_REASON_PAGE_FAILURE);
      }
      const completion = desc.value;
      if (
        typeof completion === "function" ||
        typeof completion === "symbol" ||
        typeof completion === "bigint" ||
        typeof completion === "undefined"
      ) {
        return listJsonFail(LIST_REASON_PAGE_FAILURE);
      }
    }
    if (desc.enumerable !== true) {
      continue;
    }
    if (!first && !addExactJsonBytes(state, 1)) {
      return listJsonFail(LIST_REASON_JSON_BOUND);
    }
    if (!addJsonStringBytes(state, key)) {
      return listJsonFail(LIST_REASON_JSON_BOUND);
    }
    if (!addExactJsonBytes(state, 1)) {
      return listJsonFail(LIST_REASON_JSON_BOUND);
    }
    const cloned = clonePlainJson(desc.value, depth + 1, state);
    if (!cloned.ok) {
      return cloned;
    }
    defineOwnedJsonProperty(owned, key, cloned.value);
    first = false;
  }
  if (isListRoot) {
    for (const key of LIST_COMPLETION_KEYS) {
      if (ownCompletion.has(key)) {
        continue;
      }
      if (key in value) {
        return listJsonFail(LIST_REASON_PAGE_FAILURE);
      }
    }
  }
  return { ok: true, value: owned };
}

function captureListJson(data: unknown, ceiling: number): ListPageResult {
  try {
    if (typeof ceiling !== "number" || !Number.isSafeInteger(ceiling) || ceiling < 0) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    if (data === undefined || data === null || typeof data !== "object") {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    if (isProxy(data)) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    if (Array.isArray(data)) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    const state: JsonCloneState = {
      ceiling,
      bytes: 0,
      seen: new WeakSet<object>(),
    };
    const cloned = clonePlainJson(data, 0, state);
    if (!cloned.ok) {
      return cloned;
    }
    if (cloned.value === null || typeof cloned.value !== "object" || Array.isArray(cloned.value)) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    const owned = cloned.value as Record<string, unknown>;
    const files = owned.files;
    if (files !== undefined && !Array.isArray(files)) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    if (Array.isArray(files) && files.length > DRIVE_LIST_PAGE_SIZE) {
      return listJsonFail(LIST_REASON_PAGE_FAILURE);
    }
    return { ok: true, json: owned };
  } catch {
    return listJsonFail(LIST_REASON_PAGE_FAILURE);
  }
}

function mapRequestFailure(err: unknown, phase: "create" | "read"): never {
  const fallback = phase === "create" ? ERR_DRIVE_INCOMPLETE : ERR_DRIVE_READBACK;
  const allowlisted = staticCode(safeGet(err, "code"), "");
  if (allowlisted.length > 0) {
    throwFresh(allowlisted);
  }
  try {
    const response = safeGet(err, "response");
    const status = asFiniteInteger(safeGet(response, "status"));
    if (status !== undefined) {
      classifyDriveError(status, safeGet(response, "data"), phase);
    }
  } catch (inner) {
    const innerCode = staticCode(safeGet(inner, "code"), "");
    if (innerCode.length > 0) {
      throwFresh(innerCode);
    }
  }
  if (isAbortOrSize(err)) {
    throwFresh(fallback);
  }
  throwFresh(fallback);
}

async function sessionRequest(
  internals: SessionInternals,
  opts: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: Uint8Array;
    phase: "create" | "read";
    asJson: boolean;
    maxBytes?: number;
  },
): Promise<{ status: number; headers: Record<string, string>; json?: unknown; bytes?: Uint8Array }> {
  const ceiling = opts.maxBytes ?? GOOGLE_JSON_MAX_BYTES;
  const fallback = opts.phase === "create" ? ERR_DRIVE_INCOMPLETE : ERR_DRIVE_READBACK;
  if (internals.request !== undefined) {
    let res: unknown;
    try {
      res = await internals.request({
        method: opts.method,
        url: opts.url,
        headers: opts.headers,
        body: opts.body,
      });
    } catch (err) {
      mapRequestFailure(err, opts.phase);
    }
    let status: number | undefined;
    let headers: Record<string, string> = {};
    let copied: InjectedBodyCopy = { kind: "invalid" };
    try {
      const fields = readSuccessResponseFields(res);
      status = asFiniteInteger(fields.status);
      headers = normalizeHeaders(fields.headers);
      copied = copyInjectedBody(fields.body, ceiling);
    } catch {
      throwFresh(fallback);
    }
    if (status === undefined || copied.kind !== "ok") {
      throwFresh(fallback);
    }
    const bytes = copied.bytes;
    if (status < 200 || status >= 300) {
      classifyDriveError(
        status,
        parseJsonResponse(bytes) ?? Buffer.from(bytes).toString("utf8").slice(0, 96),
        opts.phase,
      );
    }
    if (opts.asJson) {
      return { status, headers, json: parseJsonResponse(bytes), bytes };
    }
    return { status, headers, bytes };
  }

  if (internals.authClient !== undefined) {
    const gaxiosOpts: Record<string, unknown> = {
      method: opts.method,
      url: opts.url,
      headers: opts.headers,
      retry: false,
      redirect: "manual",
      follow: 0,
      maxRedirects: 0,
      timeout: opts.phase === "read" || opts.body !== undefined ? GOOGLE_MEDIA_TIMEOUT_MS : GOOGLE_REQUEST_TIMEOUT_MS,
      maxContentLength: ceiling,
    };
    if (opts.body !== undefined) {
      gaxiosOpts.data = opts.body;
    }
    if (opts.asJson) {
      gaxiosOpts.responseType = "json";
    } else {
      gaxiosOpts.responseType = "arraybuffer";
    }
    try {
      const res = await internals.authClient.request(gaxiosOpts);
      let fields: SuccessResponseFields;
      let status: number | undefined;
      let headers: Record<string, string>;
      try {
        fields = readSuccessResponseFields(res);
        status = asFiniteInteger(fields.status);
        headers = normalizeHeaders(fields.headers);
      } catch {
        throwFresh(fallback);
      }
      if (status === undefined) {
        throwFresh(fallback);
      }
      if (status < 200 || status >= 300) {
        classifyDriveError(status, fields.data, opts.phase);
      }
      if (opts.asJson) {
        const captured = captureOwnedJsonValue(fields.data, ceiling);
        if (captured.kind === "oversize") {
          throwFresh(ERR_DRIVE_INCOMPLETE);
        }
        if (captured.kind !== "ok") {
          throwFresh(fallback);
        }
        return { status, headers, json: captured.json };
      }
      const copiedBytes = copyInjectedBody(fields.data, ceiling);
      if (copiedBytes.kind === "oversize") {
        throwFresh(ERR_DRIVE_READBACK);
      }
      if (copiedBytes.kind !== "ok") {
        throwFresh(fallback);
      }
      return { status, headers, bytes: copiedBytes.bytes };
    } catch (err) {
      mapRequestFailure(err, opts.phase);
    }
  }

  throwFresh(ERR_DRIVE_CREATE);
}

function parseFileId(value: unknown): string {
  if (typeof value !== "string" || !FILE_ID_RE.test(value)) {
    throwFresh(ERR_DRIVE_INCOMPLETE);
  }
  return value;
}

function parseSize(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^(0|[1-9][0-9]{0,15})$/.test(value)) {
    return Number(value);
  }
  throwFresh(ERR_DRIVE_INCOMPLETE);
}

function buildMultipart(name: string, bytes: Uint8Array): { body: Buffer; contentType: string } {
  const boundary = `wpp_${randomBytes(16).toString("hex")}`;
  const metadata = Buffer.from(JSON.stringify({ name, mimeType: "application/octet-stream" }), "utf8");
  const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, "utf8");
  const mid = Buffer.from(
    `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: binary\r\n\r\n`,
    "utf8",
  );
  const end = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return {
    contentType: `multipart/related; boundary=${boundary}`,
    body: Buffer.concat([head, metadata, mid, Buffer.from(bytes), end]),
  };
}

function assertSealedPackageGrammar(bytes: Uint8Array): void {
  // Grammar only. This adapter has no AEAD key and does not prove authenticity.
  let nonce: Buffer | undefined;
  let tag: Buffer | undefined;
  let ciphertext: Buffer | undefined;
  try {
    const parsed = parseJsonBytes(bytes, LIMIT_PACKAGE_BYTES);
    const wire = validatePackageWire(parsed);
    nonce = decodeNonce12(wire.header.nonce);
    tag = decodeTag16(wire.tag);
    ciphertext = decodeBase64Url(wire.ciphertext, LIMIT_PLAINTEXT_BYTES);
  } catch {
    throwFresh(ERR_DRIVE_INPUT);
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

function storeSession(
  session: GoogleDriveSession,
  permissionId: string,
  internals: { request?: InjectedRequest; authClient?: Pick<AuthClientLike, "request"> },
): void {
  let boundPermissionId: string;
  let request: InjectedRequest | undefined;
  let authClient: Pick<AuthClientLike, "request"> | undefined;
  try {
    boundPermissionId = permissionId;
    request = internals.request;
    authClient = captureAuthClient(internals.authClient);
  } catch {
    throwFresh(ERR_BIND_IDENTITY);
  }
  if (!isOpaquePermissionId(boundPermissionId)) {
    throwFresh(ERR_BIND_IDENTITY);
  }
  if (request !== undefined && typeof request !== "function") {
    throwFresh(ERR_DRIVE_INPUT);
  }
  const stored: SessionInternals = Object.freeze({
    permissionId: boundPermissionId,
    request,
    authClient,
  });
  SESSION_INTERNALS.set(session, stored);
  Object.defineProperty(session, "permissionId", {
    configurable: false,
    enumerable: true,
    get: () => stored.permissionId,
  });
}

export class GoogleDriveSession {
  declare readonly permissionId: string;

  constructor(
    permissionId: string,
    internals: { request?: InjectedRequest; authClient?: Pick<AuthClientLike, "request"> },
  ) {
    storeSession(this, permissionId, internals);
  }

  toJSON(): { permissionId: string } {
    return { permissionId: this.permissionId };
  }

  async putOwnedCiphertext(ciphertext: Uint8Array, sha256: string): Promise<RemotePutReceipt> {
    return putOwnedCiphertext(this, ciphertext, sha256);
  }

  async getOwnedCiphertext(expected: RemoteGetExpected): Promise<RemoteGetReceipt> {
    return getOwnedCiphertext(this, expected);
  }

  async listCiphertextCandidates(): Promise<CiphertextCandidateList> {
    return listCiphertextCandidates(this);
  }
}

export function bindGoogleDriveSession(
  permissionId: string,
  internals: { request?: InjectedRequest; authClient?: Pick<AuthClientLike, "request"> },
): GoogleDriveSession {
  return new GoogleDriveSession(permissionId, internals);
}

export function createGoogleDriveAdapter(options: {
  permissionId: string;
  request: InjectedRequest;
}): GoogleDriveSession {
  let permissionId: string;
  let request: InjectedRequest;
  try {
    permissionId = options.permissionId;
    request = options.request;
  } catch {
    throwFresh(ERR_DRIVE_INPUT);
  }
  if (typeof request !== "function") {
    throwFresh(ERR_DRIVE_INPUT);
  }
  return bindGoogleDriveSession(permissionId, { request });
}

export async function queryBoundPermissionId(authClient: Pick<AuthClientLike, "request">): Promise<string> {
  try {
    const captured = captureAuthClient(authClient);
    if (captured === undefined) {
      throwFresh(ERR_BIND_IDENTITY);
    }
    const res = await captured.request({
      method: "GET",
      url: `${DRIVE_ABOUT_URL}?fields=user(permissionId)`,
      retry: false,
      redirect: "manual",
      follow: 0,
      maxRedirects: 0,
      timeout: GOOGLE_REQUEST_TIMEOUT_MS,
      maxContentLength: GOOGLE_JSON_MAX_BYTES,
      responseType: "json",
    });
    let fields: SuccessResponseFields;
    try {
      fields = readSuccessResponseFields(res);
      normalizeHeaders(fields.headers);
    } catch {
      throwFresh(ERR_BIND_IDENTITY);
    }
    const status = asFiniteInteger(fields.status);
    if (status === undefined || status < 200 || status >= 300) {
      throwFresh(ERR_BIND_IDENTITY);
    }
    const ownedJson = captureOwnedJsonValue(fields.data, GOOGLE_JSON_MAX_BYTES);
    if (ownedJson.kind !== "ok") {
      throwFresh(ERR_BIND_IDENTITY);
    }
    const data = ownedJson.json;
    if (!isRecord(data)) {
      throwFresh(ERR_BIND_IDENTITY);
    }
    const user = safeGet(data, "user");
    if (!isRecord(user)) {
      throwFresh(ERR_BIND_IDENTITY);
    }
    const permissionId = safeGet(user, "permissionId");
    if (!isOpaquePermissionId(permissionId)) {
      throwFresh(ERR_BIND_IDENTITY);
    }
    return permissionId;
  } catch (err) {
    const code = staticCode(safeGet(err, "code"), "");
    if (code === ERR_OAUTH_SCOPE || code === ERR_DRIVE_REDIRECT || code === ERR_DRIVE_AUTH) {
      throwFresh(code);
    }
    throwFresh(ERR_BIND_IDENTITY);
  }
}

export async function createGoogleDriveAdapterFromAuthClient(options: {
  permissionId: string;
  authClient: Pick<AuthClientLike, "request">;
}): Promise<GoogleDriveSession> {
  let claimed: string;
  let client: Pick<AuthClientLike, "request">;
  try {
    claimed = options.permissionId;
    const captured = captureAuthClient(options.authClient);
    if (!isOpaquePermissionId(claimed) || captured === undefined) {
      throwFresh(ERR_BIND_IDENTITY);
    }
    client = captured;
  } catch (err) {
    throw remapError(err, ERR_BIND_IDENTITY);
  }
  const actual = await queryBoundPermissionId(client);
  if (!equalOpaqueId(actual, claimed)) {
    throwFresh(ERR_BIND_IDENTITY);
  }
  return new GoogleDriveSession(claimed, { authClient: client });
}

export async function putOwnedCiphertext(
  session: GoogleDriveSession,
  ciphertext: Uint8Array,
  sha256: string,
): Promise<RemotePutReceipt> {
  const internals = snapshotInternals(session);
  if (typeof sha256 !== "string" || !SHA256_HEX_RE.test(sha256.toLowerCase())) {
    throwFresh(ERR_DRIVE_INPUT);
  }
  const expected = sha256.toLowerCase();
  let owned: Uint8Array;
  try {
    owned = copyOwnedBytes(ciphertext, LIMIT_PACKAGE_BYTES);
  } catch {
    throwFresh(ERR_DRIVE_INPUT);
  }
  const digest = sha256Hex(owned);
  if (!equalHex(digest, expected)) {
    throwFresh(ERR_DRIVE_INPUT);
  }
  assertSealedPackageGrammar(owned);

  const filename = `${expected}.wpp`;
  const multipart = buildMultipart(filename, owned);
  const createUrl = `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,size`;
  const created = await sessionRequest(internals, {
    method: "POST",
    url: createUrl,
    headers: { "content-type": multipart.contentType },
    body: multipart.body,
    phase: "create",
    asJson: true,
    maxBytes: GOOGLE_JSON_MAX_BYTES,
  });
  const json = created.json;
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throwFresh(ERR_DRIVE_INCOMPLETE);
  }
  const record = json as { id?: unknown; size?: unknown };
  const fileId = parseFileId(safeGet(record, "id"));
  const size = parseSize(safeGet(record, "size"));
  if (size !== owned.byteLength) {
    throwFresh(ERR_DRIVE_INCOMPLETE);
  }

  const getUrl = `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`;
  const read = await sessionRequest(internals, {
    method: "GET",
    url: getUrl,
    phase: "read",
    asJson: false,
    maxBytes: owned.byteLength,
  });
  const body = read.bytes;
  if (body === undefined) {
    throwFresh(ERR_DRIVE_READBACK);
  }
  const contentLength = read.headers["content-length"];
  if (contentLength !== undefined && contentLength !== String(owned.byteLength)) {
    throwFresh(ERR_DRIVE_READBACK);
  }
  if (body.byteLength !== owned.byteLength) {
    throwFresh(ERR_DRIVE_READBACK);
  }
  const remoteHash = sha256Hex(body);
  if (!equalHex(remoteHash, expected)) {
    throwFresh(ERR_DRIVE_READBACK);
  }
  const ownedReadback = Buffer.from(body);
  const receipt: RemotePutReceipt = {
    fileId,
    sha256: expected,
    byteCount: owned.byteLength,
    remoteReadbackVerified: true,
    ownedReadback,
  };
  Object.defineProperty(receipt, "ownedReadback", {
    value: ownedReadback,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return receipt;
}

function snapshotInternals(session: GoogleDriveSession): SessionInternals {
  let internals: SessionInternals | undefined;
  try {
    internals = SESSION_INTERNALS.get(session);
  } catch {
    throwFresh(ERR_DRIVE_INPUT);
  }
  if (internals === undefined) {
    throwFresh(ERR_DRIVE_INPUT);
  }
  const permissionId = internals.permissionId;
  const request = internals.request;
  const authClient = internals.authClient;
  if (!isOpaquePermissionId(permissionId)) {
    throwFresh(ERR_BIND_IDENTITY);
  }
  if (request === undefined && authClient === undefined) {
    throwFresh(ERR_DRIVE_INPUT);
  }
  return { permissionId, request, authClient };
}

function copyExpectedLocator(expected: unknown): {
  permissionId: string;
  fileId: string;
  sha256: string;
  byteCount: number;
} {
  try {
    if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
      throwFresh(ERR_DRIVE_INPUT);
    }
    const permissionId = safeGet(expected, "permissionId");
    const fileId = safeGet(expected, "fileId");
    const sha256 = safeGet(expected, "sha256");
    const byteCount = safeGet(expected, "byteCount");
    if (typeof permissionId !== "string" || !isOpaquePermissionId(permissionId)) {
      throwFresh(ERR_DRIVE_INPUT);
    }
    if (typeof fileId !== "string" || !FILE_ID_RE.test(fileId)) {
      throwFresh(ERR_DRIVE_INPUT);
    }
    if (typeof sha256 !== "string" || !SHA256_HEX_RE.test(sha256)) {
      throwFresh(ERR_DRIVE_INPUT);
    }
    if (
      typeof byteCount !== "number" ||
      !Number.isSafeInteger(byteCount) ||
      byteCount <= 0 ||
      byteCount > LIMIT_PACKAGE_BYTES
    ) {
      throwFresh(ERR_DRIVE_INPUT);
    }
    return {
      permissionId,
      fileId,
      sha256,
      byteCount,
    };
  } catch (err) {
    throw remapError(err, ERR_DRIVE_INPUT);
  }
}

function bindOwnedReadback(
  receipt: RemoteGetReceipt,
  ownedReadback: Uint8Array,
): RemoteGetReceipt {
  Object.defineProperty(receipt, "ownedReadback", {
    value: ownedReadback,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return receipt;
}

export async function getOwnedCiphertext(
  session: GoogleDriveSession,
  expected: RemoteGetExpected,
): Promise<RemoteGetReceipt> {
  let internals: SessionInternals;
  let locator: {
    permissionId: string;
    fileId: string;
    sha256: string;
    byteCount: number;
  };
  try {
    internals = snapshotInternals(session);
    locator = copyExpectedLocator(expected);
  } catch (err) {
    throw remapError(err, ERR_DRIVE_INPUT);
  }
  if (!equalOpaqueId(locator.permissionId, internals.permissionId)) {
    throwFresh(ERR_BIND_IDENTITY);
  }
  const getUrl = `${DRIVE_FILES_URL}/${encodeURIComponent(locator.fileId)}?alt=media`;
  const read = await sessionRequest(internals, {
    method: "GET",
    url: getUrl,
    phase: "read",
    asJson: false,
    maxBytes: locator.byteCount,
  });
  const body = read.bytes;
  if (body === undefined) {
    throwFresh(ERR_DRIVE_READBACK);
  }
  const contentLength = read.headers["content-length"];
  if (contentLength !== undefined && contentLength !== String(locator.byteCount)) {
    throwFresh(ERR_DRIVE_READBACK);
  }
  if (body.byteLength !== locator.byteCount) {
    throwFresh(ERR_DRIVE_READBACK);
  }
  const remoteHash = sha256Hex(body);
  if (!equalHex(remoteHash, locator.sha256)) {
    throwFresh(ERR_DRIVE_READBACK);
  }
  const ownedReadback = Buffer.from(body);
  const receipt: RemoteGetReceipt = {
    fileId: locator.fileId,
    sha256: locator.sha256,
    byteCount: locator.byteCount,
    ownedReadback,
  };
  return bindOwnedReadback(receipt, ownedReadback);
}

function parsePositiveBoundedSize(value: unknown): number | undefined {
  let parsed: number;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    parsed = value;
  } else if (typeof value === "string" && /^(0|[1-9][0-9]{0,15})$/.test(value)) {
    parsed = Number(value);
  } else {
    return undefined;
  }
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > LIMIT_PACKAGE_BYTES) {
    return undefined;
  }
  return parsed;
}

function buildListUrl(pageToken: string | undefined): string {
  const url = new URL(DRIVE_FILES_URL);
  url.searchParams.set("q", DRIVE_LIST_QUERY);
  url.searchParams.set("fields", DRIVE_LIST_FIELDS);
  url.searchParams.set("pageSize", String(DRIVE_LIST_PAGE_SIZE));
  if (pageToken !== undefined) {
    url.searchParams.set("pageToken", pageToken);
  }
  return url.toString();
}

function tokenLooksLikeUrl(token: string): boolean {
  return /:\/\//.test(token) || /^[a-z][a-z0-9+.-]*:/i.test(token);
}

function inspectNextPageToken(value: unknown): { done: true } | { token: string } | { reason: string } {
  if (value === undefined) {
    return { done: true };
  }
  if (typeof value !== "string") {
    return { reason: LIST_REASON_PAGE_TOKEN };
  }
  if (value.length === 0) {
    return { reason: LIST_REASON_PAGE_TOKEN };
  }
  if (value.length > DRIVE_LIST_MAX_PAGE_TOKEN_CHARS || tokenLooksLikeUrl(value)) {
    return { reason: LIST_REASON_PAGE_TOKEN };
  }
  return { token: value };
}

function inspectIncompleteSearch(value: unknown): { ok: true } | { reason: string } {
  if (value === undefined || value === false) {
    return { ok: true };
  }
  if (value === true) {
    return { reason: LIST_REASON_INCOMPLETE_SEARCH };
  }
  return { reason: LIST_REASON_PAGE_FAILURE };
}

function incompleteList(reason: string, candidates: CiphertextCandidate[]): CiphertextCandidateList {
  return { complete: false, reason, candidates: candidates.slice() };
}

function injectedListFailure(res: unknown): ListPageResult {
  let status: number | undefined;
  let headers: Record<string, string> = {};
  let copied: InjectedBodyCopy = { kind: "invalid" };
  let fields: SuccessResponseFields;
  try {
    fields = readSuccessResponseFields(res);
    status = asFiniteInteger(fields.status);
    headers = normalizeHeaders(fields.headers);
  } catch {
    return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
  }
  if (status === undefined) {
    return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
  }
  const contentLength = headers["content-length"];
  if (contentLength !== undefined) {
    const declared = Number.parseInt(contentLength, 10);
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > DRIVE_LIST_JSON_MAX_BYTES) {
      return { ok: false, reason: LIST_REASON_JSON_BOUND };
    }
  }
  try {
    copied = copyInjectedBody(fields.body, DRIVE_LIST_JSON_MAX_BYTES);
  } catch {
    return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
  }
  if (copied.kind === "oversize") {
    return { ok: false, reason: LIST_REASON_JSON_BOUND };
  }
  if (copied.kind !== "ok") {
    return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
  }
  const bytes = copied.bytes;
  if (status >= 300 && status < 400) {
    return { ok: false, reason: ERR_DRIVE_REDIRECT };
  }
  if (status < 200 || status >= 300) {
    return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
  }
  const json = parseJsonResponse(bytes);
  if (json === undefined) {
    return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
  }
  return captureListJson(json, DRIVE_LIST_JSON_MAX_BYTES);
}

function mapListTransportError(err: unknown): ListPageResult {
  const allowlisted = staticCode(safeGet(err, "code"), "");
  if (allowlisted === ERR_DRIVE_REDIRECT) {
    return { ok: false, reason: ERR_DRIVE_REDIRECT };
  }
  if (isAbortOrSize(err)) {
    return { ok: false, reason: LIST_REASON_JSON_BOUND };
  }
  try {
    const response = safeGet(err, "response");
    const status = asFiniteInteger(safeGet(response, "status"));
    if (status !== undefined && status >= 300 && status < 400) {
      return { ok: false, reason: ERR_DRIVE_REDIRECT };
    }
  } catch {
    return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
  }
  return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
}

async function fetchListPage(internals: SessionInternals, url: string): Promise<ListPageResult> {
  if (internals.request !== undefined) {
    let res: unknown;
    try {
      res = await internals.request({
        method: "GET",
        url,
      });
    } catch (err) {
      return mapListTransportError(err);
    }
    return injectedListFailure(res);
  }

  if (internals.authClient !== undefined) {
    let res: unknown;
    try {
      res = await internals.authClient.request({
        method: "GET",
        url,
        retry: false,
        redirect: "manual",
        follow: 0,
        maxRedirects: 0,
        timeout: GOOGLE_REQUEST_TIMEOUT_MS,
        maxContentLength: DRIVE_LIST_JSON_MAX_BYTES,
        responseType: "json",
      });
    } catch (err) {
      return mapListTransportError(err);
    }
    let fields: SuccessResponseFields;
    let status: number | undefined;
    try {
      fields = readSuccessResponseFields(res);
      status = asFiniteInteger(fields.status);
      normalizeHeaders(fields.headers);
    } catch {
      return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
    }
    if (status === undefined) {
      return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
    }
    if (status >= 300 && status < 400) {
      return { ok: false, reason: ERR_DRIVE_REDIRECT };
    }
    if (status < 200 || status >= 300) {
      return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
    }
    return captureListJson(fields.data, DRIVE_LIST_JSON_MAX_BYTES);
  }

  throwFresh(ERR_DRIVE_INPUT);
}

function copyPageFiles(files: unknown): unknown[] | { reason: string } {
  try {
    if (files === undefined) {
      return [];
    }
    if (!Array.isArray(files)) {
      return { reason: LIST_REASON_PAGE_FAILURE };
    }
    if (files.length > DRIVE_LIST_PAGE_SIZE) {
      return { reason: LIST_REASON_PAGE_FAILURE };
    }
    const items = files.slice(0, DRIVE_LIST_PAGE_SIZE + 1);
    if (items.length > DRIVE_LIST_PAGE_SIZE) {
      return { reason: LIST_REASON_PAGE_FAILURE };
    }
    return items;
  } catch {
    return { reason: LIST_REASON_PAGE_FAILURE };
  }
}

function absorbCandidate(
  item: unknown,
  byId: Map<string, CiphertextCandidate>,
  candidates: CiphertextCandidate[],
): string | undefined {
  try {
    if (!isRecord(item)) {
      return LIST_REASON_PAGE_FAILURE;
    }
    const name = safeGet(item, "name");
    if (typeof name !== "string") {
      return LIST_REASON_MALFORMED_CANDIDATE;
    }
    if (!MATCHING_WPP_NAME_RE.test(name)) {
      return undefined;
    }
    if (!WPP_NAME_RE.test(name)) {
      return LIST_REASON_MALFORMED_CANDIDATE;
    }
    const id = safeGet(item, "id");
    if (typeof id !== "string" || !FILE_ID_RE.test(id)) {
      return LIST_REASON_MALFORMED_CANDIDATE;
    }
    const byteCount = parsePositiveBoundedSize(safeGet(item, "size"));
    if (byteCount === undefined) {
      return LIST_REASON_MALFORMED_CANDIDATE;
    }
    const existing = byId.get(id);
    if (existing !== undefined) {
      if (existing.name === name && existing.byteCount === byteCount) {
        return undefined;
      }
      return LIST_REASON_DUPLICATE_CONFLICT;
    }
    if (byId.size >= DRIVE_LIST_MAX_ITEMS) {
      return LIST_REASON_ITEM_CEILING;
    }
    const candidate: CiphertextCandidate = {
      fileId: id,
      name,
      byteCount,
    };
    byId.set(id, candidate);
    candidates.push(candidate);
    return undefined;
  } catch {
    return LIST_REASON_PAGE_FAILURE;
  }
}

export async function listCiphertextCandidates(
  session: GoogleDriveSession,
): Promise<CiphertextCandidateList> {
  let internals: SessionInternals;
  try {
    internals = snapshotInternals(session);
  } catch (err) {
    throw remapError(err, ERR_DRIVE_INPUT);
  }
  const candidates: CiphertextCandidate[] = [];
  const byId = new Map<string, CiphertextCandidate>();
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;

  for (let pageIndex = 0; pageIndex < DRIVE_LIST_MAX_PAGES; pageIndex += 1) {
    if (pageToken !== undefined) {
      if (seenTokens.has(pageToken)) {
        return incompleteList(LIST_REASON_PAGE_TOKEN_CYCLE, candidates);
      }
      seenTokens.add(pageToken);
    }
    const page = await fetchListPage(internals, buildListUrl(pageToken));
    if (!page.ok) {
      if (page.reason === ERR_DRIVE_REDIRECT && pageIndex === 0) {
        throwFresh(ERR_DRIVE_REDIRECT);
      }
      return incompleteList(page.reason, candidates);
    }
    let filesValue: unknown;
    let incompleteSearch: unknown;
    let nextPageToken: unknown;
    try {
      if (!isRecord(page.json)) {
        return incompleteList(LIST_REASON_PAGE_FAILURE, candidates);
      }
      filesValue = page.json.files;
      incompleteSearch = page.json.incompleteSearch;
      nextPageToken = page.json.nextPageToken;
    } catch {
      return incompleteList(LIST_REASON_PAGE_FAILURE, candidates);
    }
    const files = copyPageFiles(filesValue);
    if (!Array.isArray(files)) {
      return incompleteList(files.reason, candidates);
    }
    for (const item of files) {
      const reason = absorbCandidate(item, byId, candidates);
      if (reason !== undefined) {
        return incompleteList(reason, candidates);
      }
    }
    const search = inspectIncompleteSearch(incompleteSearch);
    if ("reason" in search) {
      return incompleteList(search.reason, candidates);
    }
    const next = inspectNextPageToken(nextPageToken);
    if ("reason" in next) {
      return incompleteList(next.reason, candidates);
    }
    if ("done" in next) {
      return { complete: true, candidates: candidates.slice() };
    }
    if (seenTokens.has(next.token) || (pageToken !== undefined && next.token === pageToken)) {
      return incompleteList(LIST_REASON_PAGE_TOKEN_CYCLE, candidates);
    }
    if (byId.size >= DRIVE_LIST_MAX_ITEMS) {
      return incompleteList(LIST_REASON_ITEM_CEILING, candidates);
    }
    if (pageIndex + 1 >= DRIVE_LIST_MAX_PAGES) {
      return incompleteList(LIST_REASON_PAGE_CEILING, candidates);
    }
    pageToken = next.token;
  }
  return incompleteList(LIST_REASON_PAGE_CEILING, candidates);
}
