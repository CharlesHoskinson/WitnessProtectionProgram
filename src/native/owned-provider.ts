import { AsyncLocalStorage } from "node:async_hooks";
import { isAbsolute } from "node:path";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import { ERR_LOCKED, ERR_SCHEMA, KernelError } from "../kernel/json.js";
import { mapNativeError } from "../kernel/native-errors.js";
import { copyNativeExportContent, type NativeExportContent } from "../kernel/native-payload.js";

export type NativeStoragePasswordProvider = () => string | Promise<string>;

export interface OwnedNativeProviderConfig {
  accountId: string;
  contractAddress: string;
  privateStoragePasswordProvider: NativeStoragePasswordProvider;
  midnightDbName: string;
}

export interface NativeImportResult {
  imported: number;
  skipped: number;
  overwritten: number;
}

type InnerProvider = ReturnType<typeof levelPrivateStateProvider<string, unknown>>;

const heldLock = new AsyncLocalStorage<OwnedNativeProvider>();

function copyAccountId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new KernelError(ERR_SCHEMA);
  }
  return value;
}

function copyContractAddress(value: unknown): string {
  if (typeof value !== "string") {
    throw new KernelError(ERR_SCHEMA);
  }
  try {
    assertIsContractAddress(value);
  } catch (err) {
    if (err instanceof KernelError) {
      throw err;
    }
    throw new KernelError(ERR_SCHEMA);
  }
  return value;
}

function copyDbName(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || !isAbsolute(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
  return value;
}

export class OwnedNativeProvider {
  readonly accountId: string;
  readonly contractAddress: string;
  readonly #dbName: string;
  readonly #passwordProvider: NativeStoragePasswordProvider;
  readonly #inner: InnerProvider;
  #tail: Promise<void> = Promise.resolve();
  #disposed = false;

  constructor(config: OwnedNativeProviderConfig) {
    if (config === null || typeof config !== "object") {
      throw new KernelError(ERR_SCHEMA);
    }
    this.accountId = copyAccountId(config.accountId);
    this.contractAddress = copyContractAddress(config.contractAddress);
    if (typeof config.privateStoragePasswordProvider !== "function") {
      throw new KernelError(ERR_SCHEMA);
    }
    this.#passwordProvider = config.privateStoragePasswordProvider;
    this.#dbName = copyDbName(config.midnightDbName);
    this.#inner = levelPrivateStateProvider<string, unknown>({
      privateStoragePasswordProvider: this.#passwordProvider,
      accountId: this.accountId,
      midnightDbName: this.#dbName,
    });
    this.#inner.setContractAddress(this.contractAddress);
  }

  get midnightDbName(): string {
    return this.#dbName;
  }

  createIsolatedClone(midnightDbName: string): OwnedNativeProvider {
    this.#requireOpen();
    return new OwnedNativeProvider({
      accountId: this.accountId,
      contractAddress: this.contractAddress,
      privateStoragePasswordProvider: this.#passwordProvider,
      midnightDbName,
    });
  }

  runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    this.#requireOpen();
    if (heldLock.getStore() === this) {
      return operation();
    }
    const run = this.#tail.then(
      () => heldLock.run(this, operation),
      () => heldLock.run(this, operation),
    );
    this.#tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  drain(): Promise<void> {
    return this.#tail;
  }

  set(id: string, state: unknown): Promise<void> {
    return this.runSerialized(async () => {
      this.#requireOpen();
      if (typeof id !== "string" || id.length < 1) {
        throw new KernelError(ERR_SCHEMA);
      }
      try {
        await this.#inner.set(id, state);
      } catch (err) {
        return mapNativeError(err);
      }
    });
  }

  get(id: string): Promise<unknown | null> {
    return this.runSerialized(async () => {
      this.#requireOpen();
      if (typeof id !== "string" || id.length < 1) {
        throw new KernelError(ERR_SCHEMA);
      }
      try {
        const value = await this.#inner.get(id);
        return value;
      } catch (err) {
        return mapNativeError(err);
      }
    });
  }

  remove(id: string): Promise<void> {
    return this.runSerialized(async () => {
      this.#requireOpen();
      if (typeof id !== "string" || id.length < 1) {
        throw new KernelError(ERR_SCHEMA);
      }
      try {
        await this.#inner.remove(id);
      } catch (err) {
        return mapNativeError(err);
      }
    });
  }

  exportPrivateStates(input: { password: string; maxStates: number }): Promise<NativeExportContent> {
    return this.runSerialized(async () => {
      this.#requireOpen();
      if (typeof input.password !== "string" || input.password.length < 1) {
        throw new KernelError(ERR_SCHEMA);
      }
      if (typeof input.maxStates !== "number" || !Number.isSafeInteger(input.maxStates) || input.maxStates < 1) {
        throw new KernelError(ERR_SCHEMA);
      }
      try {
        const exported = await this.#inner.exportPrivateStates({
          password: input.password,
          maxStates: input.maxStates,
        });
        return copyNativeExportContent(exported);
      } catch (err) {
        return mapNativeError(err);
      }
    });
  }

  importPrivateStates(
    exportObject: NativeExportContent,
    options: { password: string; maxStates: number; conflictStrategy: "error" },
  ): Promise<NativeImportResult> {
    return this.runSerialized(async () => {
      this.#requireOpen();
      const content = copyNativeExportContent(exportObject);
      if (typeof options.password !== "string" || options.password.length < 1) {
        throw new KernelError(ERR_SCHEMA);
      }
      if (typeof options.maxStates !== "number" || !Number.isSafeInteger(options.maxStates) || options.maxStates < 1) {
        throw new KernelError(ERR_SCHEMA);
      }
      if (options.conflictStrategy !== "error") {
        throw new KernelError(ERR_SCHEMA);
      }
      try {
        const result = await this.#inner.importPrivateStates(content, {
          password: options.password,
          maxStates: options.maxStates,
          conflictStrategy: "error",
        });
        return {
          imported: result.imported,
          skipped: result.skipped,
          overwritten: result.overwritten,
        };
      } catch (err) {
        return mapNativeError(err);
      }
    });
  }

  invalidateEncryptionCache(): Promise<void> {
    return this.runSerialized(async () => {
      try {
        await this.#inner.invalidateEncryptionCache();
      } catch (err) {
        return mapNativeError(err);
      }
    });
  }

  markDisposed(): void {
    this.#disposed = true;
  }

  #requireOpen(): void {
    if (this.#disposed) {
      throw new KernelError(ERR_LOCKED);
    }
  }
}

export function requireOwnedNativeProvider(value: unknown): OwnedNativeProvider {
  if (value instanceof OwnedNativeProvider) {
    return value;
  }
  throw new KernelError(ERR_SCHEMA);
}
