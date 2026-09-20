import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OwnedNativeProvider,
  type NativeStoragePasswordProvider,
} from "../native/owned-provider.js";
import { StagedNativeSnapshot } from "../native/staged.js";
import { ERR_BINDING, KernelError } from "./json.js";
import type { NativeExportContent } from "./native-payload.js";

export async function makeStagingRoot(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export function stagingProvider(
  accountId: string,
  contractAddress: string,
  privateStoragePasswordProvider: NativeStoragePasswordProvider,
  rootDir: string,
): OwnedNativeProvider {
  return new OwnedNativeProvider({
    accountId,
    contractAddress,
    privateStoragePasswordProvider,
    midnightDbName: join(rootDir, "db"),
  });
}

export async function destroyStaging(provider: OwnedNativeProvider | undefined, rootDir: string | undefined): Promise<void> {
  if (provider !== undefined) {
    try {
      await provider.invalidateEncryptionCache();
    } catch {
      undefined;
    }
    try {
      await provider.drain();
    } catch {
      undefined;
    }
    provider.markDisposed();
  }
  if (rootDir !== undefined) {
    try {
      await rm(rootDir, { recursive: true, force: true });
    } catch {
      undefined;
    }
  }
}

export async function importExactStates(
  staging: OwnedNativeProvider,
  content: NativeExportContent,
  password: string,
  expectedStateIds: readonly string[],
): Promise<void> {
  const result = await staging.importPrivateStates(content, {
    password,
    maxStates: expectedStateIds.length,
    conflictStrategy: "error",
  });
  if (result.imported !== expectedStateIds.length || result.skipped !== 0 || result.overwritten !== 0) {
    throw new KernelError(ERR_BINDING);
  }
  for (const id of expectedStateIds) {
    const state = await staging.get(id);
    if (state === null) {
      throw new KernelError(ERR_BINDING);
    }
  }
}

export function wrapStagedHandle(provider: OwnedNativeProvider, rootDir: string): StagedNativeSnapshot {
  return new StagedNativeSnapshot(provider, rootDir);
}
