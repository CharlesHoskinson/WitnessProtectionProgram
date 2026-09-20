import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import {
  copyOwnedBytes,
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
  request?: InjectedRequest;
  authClient?: Pick<AuthClientLike, "request">;
}

const SESSION_INTERNALS = new WeakMap<GoogleDriveSession, SessionInternals>();
const FILE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const WPP_NAME_RE = /^[0-9a-f]{64}\.wpp$/;
const MATCHING_WPP_NAME_RE = /\.wpp$/i;

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

function normalizeHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (headers instanceof Headers) {
    for (const [key, value] of headers.entries()) {
      out[key.toLowerCase()] = value;
    }
    return out;
  }
  if (headers !== null && typeof headers === "object") {
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
      if (typeof value === "string") {
        out[key.toLowerCase()] = value;
      } else if (Array.isArray(value) && typeof value[0] === "string") {
        out[key.toLowerCase()] = value.join(", ");
      }
    }
  }
  return out;
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
  const error = data.error;
  if (typeof error === "string") {
    return { reason: boundedField(error, 64), status: "" };
  }
  if (!isRecord(error)) {
    return { reason: "", status: "" };
  }
  let reason = boundedField(error.reason, 64);
  const status = boundedField(error.status, 64);
  if (reason.length === 0 && Array.isArray(error.errors) && isRecord(error.errors[0])) {
    reason = boundedField(error.errors[0].reason, 64);
  }
  return { reason, status };
}

function classifyDriveError(status: number, data: unknown, phase: "create" | "read"): never {
  const info = inspectErrorData(data);
  if (status === 401) {
    throw new GoogleError(ERR_DRIVE_AUTH);
  }
  if (status === 403 && info.reason === "storageQuotaExceeded") {
    throw new GoogleError(ERR_DRIVE_QUOTA);
  }
  if (status === 403) {
    throw new GoogleError(ERR_DRIVE_AUTH);
  }
  if (status >= 300 && status < 400) {
    throw new GoogleError(ERR_DRIVE_REDIRECT);
  }
  if (phase === "create" && status >= 500) {
    throw new GoogleError(ERR_DRIVE_INCOMPLETE);
  }
  if (phase === "create") {
    throw new GoogleError(ERR_DRIVE_CREATE);
  }
  throw new GoogleError(ERR_DRIVE_READBACK);
}

function isAbortOrSize(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const code = (err as { code?: unknown }).code;
  const name = err.name;
  const message = err.message.toLowerCase();
  if (code === "ERR_RESPONSE_TOO_LARGE" || code === "TimeoutError" || code === "ABORT_ERR") {
    return true;
  }
  if (name === "TimeoutError" || name === "AbortError") {
    return true;
  }
  return message.includes("aborted") || message.includes("timeout") || message.includes("maxcontentlength") || message.includes("max content");
}

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (typeof data === "string") {
    return Buffer.from(data);
  }
  return Buffer.alloc(0);
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

function jsonByteLength(value: unknown): number {
  if (typeof value === "string") {
    return Buffer.byteLength(value);
  }
  if (value instanceof Uint8Array) {
    return value.byteLength;
  }
  try {
    return Buffer.byteLength(JSON.stringify(value));
  } catch {
    return GOOGLE_JSON_MAX_BYTES + 1;
  }
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
  if (internals.request !== undefined) {
    let res: { status: number; headers?: Record<string, string> | Headers; body: Uint8Array };
    try {
      res = await internals.request({
        method: opts.method,
        url: opts.url,
        headers: opts.headers,
        body: opts.body,
      });
    } catch {
      throw new GoogleError(opts.phase === "create" ? ERR_DRIVE_INCOMPLETE : ERR_DRIVE_READBACK);
    }
    const headers = normalizeHeaders(res.headers);
    const bytes = Buffer.from(res.body ?? []);
    if (bytes.byteLength > ceiling) {
      throw new GoogleError(opts.phase === "create" ? ERR_DRIVE_INCOMPLETE : ERR_DRIVE_READBACK);
    }
    if (res.status < 200 || res.status >= 300) {
      classifyDriveError(res.status, parseJsonResponse(bytes) ?? Buffer.from(bytes).toString("utf8").slice(0, 96), opts.phase);
    }
    if (opts.asJson) {
      return { status: res.status, headers, json: parseJsonResponse(bytes), bytes };
    }
    return { status: res.status, headers, bytes };
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
      const status = typeof res.status === "number" ? res.status : 0;
      const headers = normalizeHeaders(res.headers);
      if (status < 200 || status >= 300) {
        classifyDriveError(status, res.data, opts.phase);
      }
      if (opts.asJson) {
        if (jsonByteLength(res.data) > ceiling) {
          throw new GoogleError(ERR_DRIVE_INCOMPLETE);
        }
        return { status, headers, json: res.data };
      }
      const bytes = toBytes(res.data);
      if (bytes.byteLength > ceiling) {
        throw new GoogleError(ERR_DRIVE_READBACK);
      }
      return { status, headers, bytes };
    } catch (err) {
      if (err instanceof GoogleError) {
        throw err;
      }
      const response = (err as { response?: { status?: number; data?: unknown } }).response;
      if (typeof response?.status === "number") {
        classifyDriveError(response.status, response.data, opts.phase);
      }
      if (isAbortOrSize(err)) {
        throw new GoogleError(opts.phase === "create" ? ERR_DRIVE_INCOMPLETE : ERR_DRIVE_READBACK);
      }
      throw new GoogleError(opts.phase === "create" ? ERR_DRIVE_INCOMPLETE : ERR_DRIVE_READBACK);
    }
  }

  throw new GoogleError(ERR_DRIVE_CREATE);
}

function parseFileId(value: unknown): string {
  if (typeof value !== "string" || !FILE_ID_RE.test(value)) {
    throw new GoogleError(ERR_DRIVE_INCOMPLETE);
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
  throw new GoogleError(ERR_DRIVE_INCOMPLETE);
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
    throw new GoogleError(ERR_DRIVE_INPUT);
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

export class GoogleDriveSession {
  readonly permissionId: string;

  constructor(permissionId: string, internals: SessionInternals) {
    if (!isOpaquePermissionId(permissionId)) {
      throw new GoogleError(ERR_BIND_IDENTITY);
    }
    this.permissionId = permissionId;
    SESSION_INTERNALS.set(this, internals);
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
  return bindGoogleDriveSession(options.permissionId, { request: options.request });
}

export async function queryBoundPermissionId(authClient: Pick<AuthClientLike, "request">): Promise<string> {
  let res: { status?: number; data?: unknown };
  try {
    res = await authClient.request({
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
  } catch (err) {
    if (err instanceof GoogleError) {
      throw err;
    }
    throw new GoogleError(ERR_BIND_IDENTITY);
  }
  const status = typeof res.status === "number" ? res.status : 200;
  if (status < 200 || status >= 300) {
    throw new GoogleError(ERR_BIND_IDENTITY);
  }
  if (jsonByteLength(res.data) > GOOGLE_JSON_MAX_BYTES) {
    throw new GoogleError(ERR_BIND_IDENTITY);
  }
  const data = res.data;
  if (data === null || typeof data !== "object") {
    throw new GoogleError(ERR_BIND_IDENTITY);
  }
  const user = (data as { user?: unknown }).user;
  if (user === null || typeof user !== "object") {
    throw new GoogleError(ERR_BIND_IDENTITY);
  }
  const permissionId = (user as { permissionId?: unknown }).permissionId;
  if (!isOpaquePermissionId(permissionId)) {
    throw new GoogleError(ERR_BIND_IDENTITY);
  }
  return permissionId;
}

export async function createGoogleDriveAdapterFromAuthClient(options: {
  permissionId: string;
  authClient: Pick<AuthClientLike, "request">;
}): Promise<GoogleDriveSession> {
  if (!isOpaquePermissionId(options.permissionId)) {
    throw new GoogleError(ERR_BIND_IDENTITY);
  }
  const actual = await queryBoundPermissionId(options.authClient);
  if (actual !== options.permissionId) {
    throw new GoogleError(ERR_BIND_IDENTITY);
  }
  return new GoogleDriveSession(actual, { authClient: options.authClient });
}

export async function putOwnedCiphertext(
  session: GoogleDriveSession,
  ciphertext: Uint8Array,
  sha256: string,
): Promise<RemotePutReceipt> {
  const internals = SESSION_INTERNALS.get(session);
  if (internals === undefined) {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  if (typeof sha256 !== "string" || !SHA256_HEX_RE.test(sha256.toLowerCase())) {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  const expected = sha256.toLowerCase();
  let owned: Uint8Array;
  try {
    owned = copyOwnedBytes(ciphertext, LIMIT_PACKAGE_BYTES);
  } catch {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  const digest = sha256Hex(owned);
  if (!equalHex(digest, expected)) {
    throw new GoogleError(ERR_DRIVE_INPUT);
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
    throw new GoogleError(ERR_DRIVE_INCOMPLETE);
  }
  const record = json as { id?: unknown; size?: unknown };
  const fileId = parseFileId(record.id);
  const size = parseSize(record.size);
  if (size !== owned.byteLength) {
    throw new GoogleError(ERR_DRIVE_INCOMPLETE);
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
    throw new GoogleError(ERR_DRIVE_READBACK);
  }
  const contentLength = read.headers["content-length"];
  if (contentLength !== undefined && contentLength !== String(owned.byteLength)) {
    throw new GoogleError(ERR_DRIVE_READBACK);
  }
  if (body.byteLength !== owned.byteLength) {
    throw new GoogleError(ERR_DRIVE_READBACK);
  }
  const remoteHash = sha256Hex(body);
  if (!equalHex(remoteHash, expected)) {
    throw new GoogleError(ERR_DRIVE_READBACK);
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

function equalOpaqueId(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual, "utf8"), Buffer.from(expected, "utf8"));
}

function snapshotInternals(session: GoogleDriveSession): SessionInternals {
  const internals = SESSION_INTERNALS.get(session);
  if (internals === undefined) {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  const request = internals.request;
  const authClient = internals.authClient;
  if (request === undefined && authClient === undefined) {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  return { request, authClient };
}

function copyExpectedLocator(expected: unknown): {
  permissionId: string;
  fileId: string;
  sha256: string;
  byteCount: number;
} {
  if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  const record = expected as Record<string, unknown>;
  const permissionId = record.permissionId;
  const fileId = record.fileId;
  const sha256 = record.sha256;
  const byteCount = record.byteCount;
  if (typeof permissionId !== "string" || !isOpaquePermissionId(permissionId)) {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  if (typeof fileId !== "string" || !FILE_ID_RE.test(fileId)) {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  if (typeof sha256 !== "string" || !SHA256_HEX_RE.test(sha256)) {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  if (
    typeof byteCount !== "number" ||
    !Number.isSafeInteger(byteCount) ||
    byteCount <= 0 ||
    byteCount > LIMIT_PACKAGE_BYTES
  ) {
    throw new GoogleError(ERR_DRIVE_INPUT);
  }
  return {
    permissionId,
    fileId,
    sha256,
    byteCount,
  };
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
  const internals = snapshotInternals(session);
  const boundPermissionId = session.permissionId;
  if (!isOpaquePermissionId(boundPermissionId)) {
    throw new GoogleError(ERR_BIND_IDENTITY);
  }
  const locator = copyExpectedLocator(expected);
  if (!equalOpaqueId(locator.permissionId, boundPermissionId)) {
    throw new GoogleError(ERR_BIND_IDENTITY);
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
    throw new GoogleError(ERR_DRIVE_READBACK);
  }
  const contentLength = read.headers["content-length"];
  if (contentLength !== undefined && contentLength !== String(locator.byteCount)) {
    throw new GoogleError(ERR_DRIVE_READBACK);
  }
  if (body.byteLength !== locator.byteCount) {
    throw new GoogleError(ERR_DRIVE_READBACK);
  }
  const remoteHash = sha256Hex(body);
  if (!equalHex(remoteHash, locator.sha256)) {
    throw new GoogleError(ERR_DRIVE_READBACK);
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
  if (value === undefined || value === null) {
    return { done: true };
  }
  if (typeof value !== "string") {
    return { reason: LIST_REASON_PAGE_TOKEN };
  }
  if (value.length === 0) {
    return { done: true };
  }
  if (value.length > DRIVE_LIST_MAX_PAGE_TOKEN_CHARS || tokenLooksLikeUrl(value)) {
    return { reason: LIST_REASON_PAGE_TOKEN };
  }
  return { token: value };
}

function incompleteList(reason: string, candidates: CiphertextCandidate[]): CiphertextCandidateList {
  return { complete: false, reason, candidates: candidates.slice() };
}

type ListPageResult = { ok: true; json: unknown } | { ok: false; reason: string };

async function fetchListPage(internals: SessionInternals, url: string): Promise<ListPageResult> {
  if (internals.request !== undefined) {
    let res: { status: number; headers?: Record<string, string> | Headers; body: Uint8Array };
    try {
      res = await internals.request({
        method: "GET",
        url,
      });
    } catch {
      return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
    }
    const headers = normalizeHeaders(res.headers);
    const contentLength = headers["content-length"];
    if (contentLength !== undefined) {
      const declared = Number.parseInt(contentLength, 10);
      if (!Number.isSafeInteger(declared) || declared < 0 || declared > DRIVE_LIST_JSON_MAX_BYTES) {
        return { ok: false, reason: LIST_REASON_JSON_BOUND };
      }
    }
    const bytes = Buffer.from(res.body ?? []);
    if (bytes.byteLength > DRIVE_LIST_JSON_MAX_BYTES) {
      return { ok: false, reason: LIST_REASON_JSON_BOUND };
    }
    if (res.status >= 300 && res.status < 400) {
      throw new GoogleError(ERR_DRIVE_REDIRECT);
    }
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
    }
    const json = parseJsonResponse(bytes);
    if (json === undefined) {
      return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
    }
    return { ok: true, json };
  }

  if (internals.authClient !== undefined) {
    try {
      const res = await internals.authClient.request({
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
      const status = typeof res.status === "number" ? res.status : 0;
      if (status >= 300 && status < 400) {
        throw new GoogleError(ERR_DRIVE_REDIRECT);
      }
      if (status < 200 || status >= 300) {
        return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
      }
      if (jsonByteLength(res.data) > DRIVE_LIST_JSON_MAX_BYTES) {
        return { ok: false, reason: LIST_REASON_JSON_BOUND };
      }
      if (res.data === undefined) {
        return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
      }
      return { ok: true, json: res.data };
    } catch (err) {
      if (err instanceof GoogleError) {
        if (err.code === ERR_DRIVE_REDIRECT) {
          throw err;
        }
        return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
      }
      if (isAbortOrSize(err)) {
        return { ok: false, reason: LIST_REASON_JSON_BOUND };
      }
      const response = (err as { response?: { status?: number } }).response;
      if (typeof response?.status === "number" && response.status >= 300 && response.status < 400) {
        throw new GoogleError(ERR_DRIVE_REDIRECT);
      }
      return { ok: false, reason: LIST_REASON_PAGE_FAILURE };
    }
  }

  throw new GoogleError(ERR_DRIVE_INPUT);
}

export async function listCiphertextCandidates(
  session: GoogleDriveSession,
): Promise<CiphertextCandidateList> {
  const internals = snapshotInternals(session);
  const boundPermissionId = session.permissionId;
  if (!isOpaquePermissionId(boundPermissionId)) {
    throw new GoogleError(ERR_BIND_IDENTITY);
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
      return incompleteList(page.reason, candidates);
    }
    if (!isRecord(page.json)) {
      return incompleteList(LIST_REASON_PAGE_FAILURE, candidates);
    }
    const files = page.json.files;
    if (files !== undefined && !Array.isArray(files)) {
      return incompleteList(LIST_REASON_PAGE_FAILURE, candidates);
    }
    if (Array.isArray(files)) {
      for (const item of files) {
        if (!isRecord(item)) {
          return incompleteList(LIST_REASON_PAGE_FAILURE, candidates);
        }
        const name = item.name;
        if (typeof name !== "string" || !MATCHING_WPP_NAME_RE.test(name)) {
          continue;
        }
        if (!WPP_NAME_RE.test(name)) {
          return incompleteList(LIST_REASON_MALFORMED_CANDIDATE, candidates);
        }
        if (typeof item.id !== "string" || !FILE_ID_RE.test(item.id)) {
          return incompleteList(LIST_REASON_MALFORMED_CANDIDATE, candidates);
        }
        const byteCount = parsePositiveBoundedSize(item.size);
        if (byteCount === undefined) {
          return incompleteList(LIST_REASON_MALFORMED_CANDIDATE, candidates);
        }
        const existing = byId.get(item.id);
        if (existing !== undefined) {
          if (existing.name === name && existing.byteCount === byteCount) {
            continue;
          }
          return incompleteList(LIST_REASON_DUPLICATE_CONFLICT, candidates);
        }
        if (byId.size >= DRIVE_LIST_MAX_ITEMS) {
          return incompleteList(LIST_REASON_ITEM_CEILING, candidates);
        }
        const candidate: CiphertextCandidate = {
          fileId: item.id,
          name,
          byteCount,
        };
        byId.set(item.id, candidate);
        candidates.push(candidate);
      }
    }
    if (page.json.incompleteSearch === true) {
      return incompleteList(LIST_REASON_INCOMPLETE_SEARCH, candidates);
    }
    const next = inspectNextPageToken(page.json.nextPageToken);
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
