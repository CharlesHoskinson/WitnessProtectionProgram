import { OAuth2Client } from "google-auth-library";

import { ERR_OAUTH_SCOPE, GoogleError } from "./errors.js";
import {
  DRIVE_FILE_SCOPE,
  GOOGLE_JSON_MAX_BYTES,
  GOOGLE_REQUEST_TIMEOUT_MS,
  type FetchLike,
  type OwnedAuthClientOptions,
} from "./types.js";

interface ScopeState {
  validated: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function grantedScopes(scope: unknown): string[] {
  if (typeof scope === "string") {
    return scope.split(/\s+/).filter((item) => item.length > 0);
  }
  if (Array.isArray(scope)) {
    return scope.map((item) => String(item)).filter((item) => item.length > 0);
  }
  return [];
}

export function assertExactDriveFileScope(scopes: string[]): void {
  if (scopes.length !== 1 || scopes[0] !== DRIVE_FILE_SCOPE) {
    throw new GoogleError(ERR_OAUTH_SCOPE);
  }
}

function grantTypeOf(data: unknown): string {
  if (data instanceof URLSearchParams) {
    return data.get("grant_type") ?? "";
  }
  if (isRecord(data) && typeof data.grant_type === "string") {
    return data.grant_type;
  }
  return "";
}

function tokenUrlOf(url: unknown): boolean {
  const text = String(url ?? "");
  return text.includes("/token") && !text.includes("/drive/");
}

function sizeError(): Error {
  const err = new Error("maxContentLength exceeded");
  (err as { code?: string }).code = "ERR_RESPONSE_TOO_LARGE";
  return err;
}

function headerMap(headers: unknown): { get(name: string): string | null; has(name: string): boolean } {
  if (headers instanceof Headers) {
    return headers;
  }
  const lower: Record<string, string> = {};
  if (isRecord(headers)) {
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        lower[key.toLowerCase()] = value;
      }
    }
  }
  return {
    get(name: string): string | null {
      return lower[name.toLowerCase()] ?? null;
    },
    has(name: string): boolean {
      return lower[name.toLowerCase()] !== undefined;
    },
  };
}

async function readBounded(body: unknown, maxBytes: number): Promise<Buffer> {
  if (body === undefined || body === null) {
    return Buffer.alloc(0);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  const iterable = body as AsyncIterable<Uint8Array>;
  if (typeof iterable[Symbol.asyncIterator] !== "function") {
    throw sizeError();
  }
  for await (const chunk of iterable) {
    const buf = Buffer.from(chunk);
    total += buf.byteLength;
    if (total > maxBytes) {
      if (typeof (body as { destroy?: (err?: Error) => void }).destroy === "function") {
        (body as { destroy: (err?: Error) => void }).destroy();
      }
      throw sizeError();
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function bufferResponse(status: number, headers: unknown, body: Buffer): Record<string, unknown> {
  const webHeaders = headers instanceof Headers ? headers : new Headers();
  if (!(headers instanceof Headers) && isRecord(headers)) {
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        webHeaders.set(key, value);
      }
    }
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    headers: webHeaders,
    body: undefined,
    async text() {
      return body.toString("utf8");
    },
    async arrayBuffer() {
      return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    },
    async json() {
      return JSON.parse(body.toString("utf8")) as unknown;
    },
  };
}

export function wrapFetchImplementation(inner: FetchLike, defaultMaxBytes: number): FetchLike {
  return async (url, init = {}) => {
    const maxBytes = typeof init.size === "number" ? init.size : defaultMaxBytes;
    const next: Record<string, unknown> = {
      ...init,
      redirect: "manual",
      follow: 0,
      size: maxBytes,
    };
    const res = await inner(url, next);
    if (!isRecord(res)) {
      throw sizeError();
    }
    const headers = headerMap(res.headers);
    const contentLength = headers.get("content-length");
    if (contentLength !== null && Number.parseInt(contentLength, 10) > maxBytes) {
      throw sizeError();
    }
    const status = typeof res.status === "number" ? res.status : 0;
    if (status >= 300 && status < 400) {
      return res;
    }
    if (res.body !== undefined && res.body !== null && typeof (res.body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
      const bounded = await readBounded(res.body, maxBytes);
      return bufferResponse(status, res.headers, bounded);
    }
    if (typeof res.arrayBuffer === "function") {
      const ab = (await res.arrayBuffer()) as ArrayBuffer;
      if (ab.byteLength > maxBytes) {
        throw sizeError();
      }
      return bufferResponse(status, res.headers, Buffer.from(ab));
    }
    if (typeof res.text === "function") {
      const text = String(await res.text());
      const bounded = Buffer.from(text);
      if (bounded.byteLength > maxBytes) {
        throw sizeError();
      }
      return bufferResponse(status, res.headers, bounded);
    }
    return res;
  };
}

function applyTokenScope(opts: Record<string, unknown>, data: unknown, state: ScopeState): void {
  if (!tokenUrlOf(opts.url)) {
    return;
  }
  if (!isRecord(data)) {
    return;
  }
  const scopes = grantedScopes(data.scope);
  const refresh = grantTypeOf(opts.data) === "refresh_token";
  if (scopes.length === 0) {
    if (refresh && state.validated) {
      return;
    }
    throw new GoogleError(ERR_OAUTH_SCOPE);
  }
  assertExactDriveFileScope(scopes);
  state.validated = true;
}

function hardenTransporter(
  client: OAuth2Client,
  bounds: { timeoutMs: number; jsonMaxBytes: number },
  state: ScopeState,
): void {
  const transporter = client.transporter as unknown as {
    request: (opts: Record<string, unknown>) => Promise<{ data?: unknown; status?: number; headers?: unknown }>;
    defaults: Record<string, unknown>;
  };
  transporter.defaults.timeout = bounds.timeoutMs;
  transporter.defaults.maxContentLength = bounds.jsonMaxBytes;
  transporter.defaults.redirect = "manual";
  transporter.defaults.follow = 0;
  transporter.defaults.maxRedirects = 0;
  transporter.defaults.retry = false;
  const original = transporter.request.bind(transporter);
  transporter.request = async (opts: Record<string, unknown>) => {
    const next: Record<string, unknown> = {
      ...opts,
      timeout: typeof opts.timeout === "number" ? opts.timeout : bounds.timeoutMs,
      maxContentLength: typeof opts.maxContentLength === "number" ? opts.maxContentLength : bounds.jsonMaxBytes,
      redirect: "manual",
      follow: 0,
      maxRedirects: 0,
      retry: false,
      retryConfig: {
        retry: 0,
        noResponseRetries: 0,
        currentRetryAttempt: 0,
        httpMethodsToRetry: [],
        statusCodesToRetry: [],
      },
    };
    const res = await original(next);
    applyTokenScope(next, res.data, state);
    return res;
  };
}

export function createOwnedOAuth2Client(options: OwnedAuthClientOptions): OAuth2Client {
  const timeoutMs = options.timeoutMs ?? GOOGLE_REQUEST_TIMEOUT_MS;
  const jsonMaxBytes = options.jsonMaxBytes ?? GOOGLE_JSON_MAX_BYTES;
  const state: ScopeState = { validated: false };
  const transporterOptions: Record<string, unknown> = {
    timeout: timeoutMs,
    maxContentLength: jsonMaxBytes,
    redirect: "manual",
    follow: 0,
    maxRedirects: 0,
    retry: false,
  };
  if (options.fetchImplementation !== undefined) {
    transporterOptions.fetchImplementation = wrapFetchImplementation(options.fetchImplementation, jsonMaxBytes);
  }
  const client = new OAuth2Client({
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    redirectUri: options.redirectUri,
    useAuthRequestParameters: false,
    endpoints: options.endpoints,
    transporterOptions,
  });
  hardenTransporter(client, { timeoutMs, jsonMaxBytes }, state);
  const innerSet = client.setCredentials.bind(client);
  client.setCredentials = (tokens) => {
    const scopes = grantedScopes(tokens.scope);
    if (scopes.length > 0) {
      assertExactDriveFileScope(scopes);
      state.validated = true;
    }
    innerSet(tokens);
  };
  return client;
}
