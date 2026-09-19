import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { CodeChallengeMethod } from "google-auth-library";

import { launchSystemBrowser } from "./browser.js";
import { bindGoogleDriveSession, GoogleDriveSession, queryBoundPermissionId } from "./drive.js";
import {
  ERR_OAUTH_BROWSER,
  ERR_OAUTH_DENIED,
  ERR_OAUTH_EXCHANGE,
  ERR_OAUTH_SCOPE,
  ERR_OAUTH_TIMEOUT,
  GoogleError,
} from "./errors.js";
import { createOwnedOAuth2Client, assertExactDriveFileScope, grantedScopes } from "./transport.js";
import {
  DEFAULT_CALLBACK_WAIT_MS,
  DRIVE_FILE_SCOPE,
  GOOGLE_AUTH_ORIGIN,
  OAUTH_CALLBACK_PATH,
  type AuthClientLike,
  type CreateAuthClientArgs,
  type InstalledAppClient,
  type TokenSet,
} from "./types.js";

const MAX_URL_LENGTH = 2048;
const MAX_HEADER_LENGTH = 4096;
const WAITING_PAGE = "Witness Protection Program received the authorization response. Return to the terminal.";

export interface AuthorizeOptions {
  client: InstalledAppClient;
  waitMs?: number;
  launchBrowser?: (url: string) => Promise<void>;
  createAuthClient?: (args: CreateAuthClientArgs) => AuthClientLike;
}

function randomState(): string {
  return randomBytes(32).toString("base64url");
}

function writePlain(res: ServerResponse, status: number, text: string): Promise<void> {
  return new Promise((resolve) => {
    if (res.headersSent) {
      resolve();
      return;
    }
    res.statusCode = status;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(text, () => resolve());
  });
}

function headerSize(value: unknown): number {
  if (typeof value === "string") {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum: number, item) => sum + String(item).length, 0);
  }
  return 0;
}

function assertUsableTokens(tokens: TokenSet): void {
  if (typeof tokens.access_token !== "string" || tokens.access_token.length === 0) {
    throw new GoogleError(ERR_OAUTH_EXCHANGE);
  }
  if (typeof tokens.expiry_date !== "number" || !Number.isFinite(tokens.expiry_date) || tokens.expiry_date <= Date.now()) {
    throw new GoogleError(ERR_OAUTH_EXCHANGE);
  }
  const scopes = grantedScopes(tokens.scope);
  if (scopes.length === 0) {
    throw new GoogleError(ERR_OAUTH_SCOPE);
  }
  assertExactDriveFileScope(scopes);
}

function defaultCreateAuthClient(args: CreateAuthClientArgs): AuthClientLike {
  const client = createOwnedOAuth2Client({
    clientId: args.clientId,
    clientSecret: args.clientSecret,
    redirectUri: args.redirectUri,
  });
  return {
    generateCodeVerifierAsync: () => client.generateCodeVerifierAsync(),
    generateAuthUrl: (opts) =>
      client.generateAuthUrl({
        ...opts,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
    getToken: (opts) => client.getToken(opts),
    setCredentials: (tokens) => client.setCredentials(tokens),
    request: (opts) => client.request(opts),
  };
}

async function withAbort<T>(signal: AbortSignal, work: Promise<T>): Promise<T> {
  if (signal.aborted) {
    throw new GoogleError(ERR_OAUTH_TIMEOUT);
  }
  return await new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(new GoogleError(ERR_OAUTH_TIMEOUT));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

export async function authorizeInstalledApp(options: AuthorizeOptions): Promise<GoogleDriveSession> {
  const client = options.client;
  if (client === undefined || typeof client.clientId !== "string" || client.clientId.length < 8) {
    throw new GoogleError(ERR_OAUTH_EXCHANGE);
  }
  const waitMs = options.waitMs ?? DEFAULT_CALLBACK_WAIT_MS;
  const createAuthClient = options.createAuthClient ?? defaultCreateAuthClient;
  const launchBrowser = options.launchBrowser ?? launchSystemBrowser;

  return await new Promise<GoogleDriveSession>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingState: string | undefined;
    let codeVerifier: string | undefined;
    let redirectUri: string | undefined;
    let authClient: AuthClientLike | undefined;
    let exchanging = false;
    let port = 0;
    const flowAbort = new AbortController();

    const finish = (error?: GoogleError, session?: GoogleDriveSession): void => {
      if (settled) {
        return;
      }
      settled = true;
      pendingState = undefined;
      try {
        flowAbort.abort();
      } catch {
        // already aborted
      }
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      const done = (): void => {
        if (error !== undefined) {
          reject(error);
        } else if (session !== undefined) {
          resolve(session);
        } else {
          reject(new GoogleError(ERR_OAUTH_EXCHANGE));
        }
      };
      try {
        server.closeAllConnections();
      } catch {
        // already closed
      }
      server.close(() => done());
    };

    const server = createServer((req, res) => {
      void handleCallback(req, res);
    });

    const handleCallback = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      try {
        if (settled || exchanging) {
          await writePlain(res, 409, "This authorization attempt is no longer pending.");
          return;
        }
        const host = req.headers.host;
        const expectedHost = `127.0.0.1:${port}`;
        if (req.method !== "GET" || typeof host !== "string" || host !== expectedHost) {
          await writePlain(res, 400, "This request is not a valid authorization callback.");
          return;
        }
        const urlRaw = req.url ?? "";
        if (urlRaw.length > MAX_URL_LENGTH) {
          await writePlain(res, 400, "This request is not a valid authorization callback.");
          return;
        }
        for (const [name, value] of Object.entries(req.headers)) {
          if (name.length + headerSize(value) > MAX_HEADER_LENGTH) {
            await writePlain(res, 400, "This request is not a valid authorization callback.");
            return;
          }
        }
        let parsed: URL;
        try {
          parsed = new URL(urlRaw, `http://${expectedHost}`);
        } catch {
          await writePlain(res, 400, "This request is not a valid authorization callback.");
          return;
        }
        if (parsed.pathname !== OAUTH_CALLBACK_PATH) {
          await writePlain(res, 404, "This request is not a valid authorization callback.");
          return;
        }
        const states = parsed.searchParams.getAll("state");
        const codes = parsed.searchParams.getAll("code");
        const errors = parsed.searchParams.getAll("error");
        if (pendingState === undefined || states.length !== 1 || states[0] !== pendingState) {
          await writePlain(res, 400, "This request is not a valid authorization callback.");
          return;
        }
        if (codes.length + errors.length !== 1) {
          await writePlain(res, 400, "This request is not a valid authorization callback.");
          return;
        }
        if (errors.length === 1) {
          await writePlain(res, 403, "Authorization was denied.");
          finish(new GoogleError(ERR_OAUTH_DENIED));
          return;
        }
        exchanging = true;
        await writePlain(res, 200, WAITING_PAGE);
        try {
          if (authClient === undefined || codeVerifier === undefined || redirectUri === undefined) {
            throw new GoogleError(ERR_OAUTH_EXCHANGE);
          }
          const tokenRes = await withAbort(
            flowAbort.signal,
            authClient.getToken({
              code: codes[0],
              codeVerifier,
              redirect_uri: redirectUri,
            }),
          );
          assertUsableTokens(tokenRes.tokens);
          authClient.setCredentials(tokenRes.tokens);
          const permissionId = await withAbort(flowAbort.signal, queryBoundPermissionId(authClient));
          finish(undefined, bindGoogleDriveSession(permissionId, { authClient }));
        } catch (err) {
          if (err instanceof GoogleError) {
            finish(err);
          } else {
            finish(new GoogleError(ERR_OAUTH_EXCHANGE));
          }
        }
      } catch {
        try {
          await writePlain(res, 400, "This request is not a valid authorization callback.");
        } catch {
          // ignore
        }
      }
    };

    server.once("error", () => {
      finish(new GoogleError(ERR_OAUTH_BROWSER));
    });

    server.listen(0, "127.0.0.1", () => {
      void (async () => {
        try {
          const addr = server.address();
          if (addr === null || typeof addr === "string") {
            finish(new GoogleError(ERR_OAUTH_BROWSER));
            return;
          }
          port = addr.port;
          redirectUri = `http://127.0.0.1:${port}${OAUTH_CALLBACK_PATH}`;
          authClient = createAuthClient({
            clientId: client.clientId,
            clientSecret: client.clientSecret,
            redirectUri,
          });
          const pkce = await authClient.generateCodeVerifierAsync();
          if (typeof pkce.codeVerifier !== "string" || typeof pkce.codeChallenge !== "string") {
            finish(new GoogleError(ERR_OAUTH_EXCHANGE));
            return;
          }
          codeVerifier = pkce.codeVerifier;
          pendingState = randomState();
          const authUrl = authClient.generateAuthUrl({
            access_type: "offline",
            prompt: "select_account",
            scope: DRIVE_FILE_SCOPE,
            state: pendingState,
            redirect_uri: redirectUri,
            client_id: client.clientId,
            response_type: "code",
            code_challenge: pkce.codeChallenge,
            code_challenge_method: CodeChallengeMethod.S256,
          });
          const parsedAuth = new URL(authUrl);
          if (parsedAuth.origin !== GOOGLE_AUTH_ORIGIN || parsedAuth.protocol !== "https:") {
            finish(new GoogleError(ERR_OAUTH_EXCHANGE));
            return;
          }
          timer = setTimeout(() => {
            finish(new GoogleError(ERR_OAUTH_TIMEOUT));
          }, waitMs);
          try {
            await launchBrowser(authUrl);
          } catch {
            finish(new GoogleError(ERR_OAUTH_BROWSER));
          }
        } catch {
          finish(new GoogleError(ERR_OAUTH_BROWSER));
        }
      })();
    });
  });
}
