import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve as resolvePath } from "node:path";

import { ERR_CLIENT_CONFIG, GoogleError } from "./errors.js";
import type { InstalledAppClient } from "./types.js";

export function loadInstalledAppClient(json: unknown): InstalledAppClient {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  const record = json as Record<string, unknown>;
  if (record.web !== undefined && record.installed === undefined) {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  const installed = record.installed;
  if (installed === null || typeof installed !== "object" || Array.isArray(installed)) {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  const clientId = (installed as { client_id?: unknown }).client_id;
  const clientSecret = (installed as { client_secret?: unknown }).client_secret;
  if (typeof clientId !== "string" || clientId.length < 8) {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  if (clientSecret !== undefined && typeof clientSecret !== "string") {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  return { clientId, clientSecret };
}

export function isPathInsideRoot(filePath: string, root: string): boolean {
  let resolvedRoot: string;
  let resolvedFile: string;
  try {
    resolvedRoot = realpathSync(root);
  } catch {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  try {
    resolvedFile = realpathSync(filePath);
  } catch {
    resolvedFile = resolvePath(filePath);
  }
  const rel = relative(resolvedRoot, resolvedFile);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function loadInstalledAppClientFile(filePath: string, repoRoot: string): InstalledAppClient {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  if (isPathInsideRoot(filePath, repoRoot)) {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new GoogleError(ERR_CLIENT_CONFIG);
  }
  return loadInstalledAppClient(parsed);
}
