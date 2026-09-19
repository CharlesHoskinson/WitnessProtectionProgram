export class GoogleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "GoogleError";
    this.code = code;
  }
}

export const ERR_OAUTH_DENIED = "GOOGLE_OAUTH_DENIED";
export const ERR_OAUTH_TIMEOUT = "GOOGLE_OAUTH_TIMEOUT";
export const ERR_OAUTH_EXCHANGE = "GOOGLE_OAUTH_EXCHANGE";
export const ERR_OAUTH_SCOPE = "GOOGLE_OAUTH_SCOPE";
export const ERR_OAUTH_BROWSER = "GOOGLE_OAUTH_BROWSER";
export const ERR_BIND_IDENTITY = "GOOGLE_BIND_IDENTITY";
export const ERR_DRIVE_INPUT = "GOOGLE_DRIVE_INPUT";
export const ERR_DRIVE_CREATE = "GOOGLE_DRIVE_CREATE";
export const ERR_DRIVE_READBACK = "GOOGLE_DRIVE_READBACK";
export const ERR_DRIVE_AUTH = "GOOGLE_DRIVE_AUTH";
export const ERR_DRIVE_QUOTA = "GOOGLE_DRIVE_QUOTA";
export const ERR_DRIVE_INCOMPLETE = "GOOGLE_DRIVE_INCOMPLETE";
export const ERR_DRIVE_REDIRECT = "GOOGLE_DRIVE_REDIRECT";
export const ERR_PROJECT_ID = "GOOGLE_PROJECT_ID";
export const ERR_GCLOUD_AUTH = "GOOGLE_GCLOUD_AUTH";
export const ERR_GCLOUD_APPLY = "GOOGLE_GCLOUD_APPLY";
export const ERR_CLIENT_CONFIG = "GOOGLE_CLIENT_CONFIG";
