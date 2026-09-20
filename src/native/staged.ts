import { rm } from "node:fs/promises";
import { ERR_LOCKED, KernelError } from "../kernel/json.js";
import { OwnedNativeProvider } from "./owned-provider.js";

export class StagedNativeSnapshot {
  readonly #provider: OwnedNativeProvider;
  readonly #rootDir: string;
  #disposed = false;

  constructor(provider: OwnedNativeProvider, rootDir: string) {
    this.#provider = provider;
    this.#rootDir = rootDir;
  }

  get(stateId: string): Promise<unknown | null> {
    try {
      this.#requireActive();
    } catch (err) {
      return Promise.reject(err);
    }
    return this.#provider.get(stateId);
  }

  drain(): Promise<void> {
    return this.#provider.drain();
  }

  async dispose(): Promise<void> {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    try {
      try {
        await this.#provider.invalidateEncryptionCache();
      } catch {
        undefined;
      }
      try {
        await this.#provider.drain();
      } catch {
        undefined;
      }
    } finally {
      this.#provider.markDisposed();
      try {
        await rm(this.#rootDir, { recursive: true, force: true });
      } catch {
        undefined;
      }
    }
  }

  #requireActive(): void {
    if (this.#disposed) {
      throw new KernelError(ERR_LOCKED);
    }
  }
}
