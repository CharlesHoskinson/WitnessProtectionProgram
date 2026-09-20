export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const OAUTH_CALLBACK_PATH = "/oauth2/callback";
export const DEFAULT_CALLBACK_WAIT_MS = 5 * 60 * 1000;
export const GOOGLE_AUTH_ORIGIN = "https://accounts.google.com";
export const GOOGLE_AUTH_PATH = "/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const DRIVE_ABOUT_URL = "https://www.googleapis.com/drive/v3/about";
export const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
export const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
export const GOOGLE_JSON_MAX_BYTES = 64 * 1024;
export const GOOGLE_REQUEST_TIMEOUT_MS = 30_000;
export const GOOGLE_MEDIA_TIMEOUT_MS = 120_000;
export const GOOGLE_BROWSER_LAUNCH_WAIT_MS = 400;
export const DRIVE_LIST_PAGE_SIZE = 100;
export const DRIVE_LIST_MAX_PAGES = 100;
export const DRIVE_LIST_MAX_ITEMS = 10_000;
export const DRIVE_LIST_JSON_MAX_BYTES = 1024 * 1024;
export const DRIVE_LIST_MAX_PAGE_TOKEN_CHARS = 4096;
export const DRIVE_LIST_QUERY = "trashed = false and name contains '.wpp'";
export const DRIVE_LIST_FIELDS = "nextPageToken,incompleteSearch,files(id,name,size)";
export const LIST_REASON_INCOMPLETE_SEARCH = "GOOGLE_DRIVE_INCOMPLETE_SEARCH";
export const LIST_REASON_PAGE_FAILURE = "GOOGLE_DRIVE_PAGE_FAILURE";
export const LIST_REASON_MALFORMED_CANDIDATE = "GOOGLE_DRIVE_MALFORMED_CANDIDATE";
export const LIST_REASON_DUPLICATE_CONFLICT = "GOOGLE_DRIVE_DUPLICATE_CONFLICT";
export const LIST_REASON_PAGE_TOKEN_CYCLE = "GOOGLE_DRIVE_PAGE_TOKEN_CYCLE";
export const LIST_REASON_PAGE_TOKEN = "GOOGLE_DRIVE_PAGE_TOKEN";
export const LIST_REASON_PAGE_CEILING = "GOOGLE_DRIVE_PAGE_CEILING";
export const LIST_REASON_ITEM_CEILING = "GOOGLE_DRIVE_ITEM_CEILING";
export const LIST_REASON_JSON_BOUND = "GOOGLE_DRIVE_JSON_BOUND";

export interface InstalledAppClient {
  clientId: string;
  clientSecret?: string;
}

export interface TokenSet {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string;
}

export interface GenerateAuthUrlInput {
  access_type?: string;
  prompt?: string;
  scope?: string | string[];
  state?: string;
  redirect_uri?: string;
  client_id?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

export interface AuthClientLike {
  generateCodeVerifierAsync(): Promise<{ codeVerifier: string; codeChallenge?: string }>;
  generateAuthUrl(opts: GenerateAuthUrlInput): string;
  getToken(opts: {
    code: string;
    codeVerifier?: string;
    redirect_uri?: string;
  }): Promise<{ tokens: TokenSet }>;
  setCredentials(tokens: TokenSet): void;
  request(opts: Record<string, unknown>): Promise<{
    status?: number;
    data?: unknown;
    headers?: unknown;
  }>;
}

export interface CreateAuthClientArgs {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

export type FetchLike = (url: string | URL, init?: Record<string, unknown>) => Promise<unknown>;

export interface OwnedAuthClientOptions {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  timeoutMs?: number;
  jsonMaxBytes?: number;
  fetchImplementation?: FetchLike;
  endpoints?: { oauth2TokenUrl?: string | URL };
}

export interface InjectedRequest {
  (opts: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: Uint8Array;
  }): Promise<{
    status: number;
    headers?: Record<string, string> | Headers;
    body: Uint8Array;
  }>;
}

export interface RemotePutReceipt {
  fileId: string;
  sha256: string;
  byteCount: number;
  remoteReadbackVerified: true;
  readonly ownedReadback: Uint8Array;
}

export interface RemoteGetExpected {
  permissionId: string;
  fileId: string;
  sha256: string;
  byteCount: number;
}

export interface RemoteGetReceipt {
  fileId: string;
  sha256: string;
  byteCount: number;
  readonly ownedReadback: Uint8Array;
}

export interface CiphertextCandidate {
  fileId: string;
  name: string;
  byteCount: number;
}

export interface CiphertextCandidateList {
  complete: boolean;
  reason?: string;
  candidates: CiphertextCandidate[];
}

export interface GcloudResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type GcloudRunner = (args: string[]) => Promise<GcloudResult>;

export interface ProjectSetupResult {
  mode: "dry-run" | "apply";
  projectId: string;
  commands: string[];
  consoleUrls: string[];
  notes: string[];
}
