import { randomBytes } from "node:crypto";
import { validatePassword } from "@midnight-ntwrk/midnight-js-utils";
import { NATIVE_PASSWORD_MAX_ATTEMPTS } from "../native/pins.js";
import { deriveKeys, wipeDerivedKeys, type DerivedKeys } from "./crypto.js";
import { ERR_INTERNAL, ERR_RANDOM, ERR_UNSUPPORTED, KernelError } from "./json.js";
import { isPasswordValidationError } from "./native-errors.js";
import { encodeBase64Url, type SnapshotHeader } from "./validation.js";

export { NATIVE_PASSWORD_MAX_ATTEMPTS };

export interface NativePasswordSelection {
  generation: Buffer;
  nonce: Buffer;
  header: SnapshotHeader;
  keys: DerivedKeys;
}

export type NativePasswordRandomBytes = (size: number) => Buffer;
export type NativePasswordValidator = (password: string) => unknown;

function defaultRandom(size: number): Buffer {
  try {
    const bytes = randomBytes(size);
    if (!Buffer.isBuffer(bytes) || bytes.byteLength !== size) {
      throw new KernelError(ERR_RANDOM);
    }
    return bytes;
  } catch (err) {
    if (err instanceof KernelError) {
      throw err;
    }
    throw new KernelError(ERR_RANDOM);
  }
}

function defaultValidate(password: string): undefined {
  const result = validatePassword(password);
  if (result !== undefined) {
    throw new KernelError(ERR_UNSUPPORTED);
  }
  return undefined;
}

function wipeSelection(generation: Buffer | undefined, nonce: Buffer | undefined, keys: DerivedKeys | undefined): void {
  if (generation !== undefined) {
    generation.fill(0);
  }
  if (nonce !== undefined) {
    nonce.fill(0);
  }
  if (keys !== undefined) {
    wipeDerivedKeys(keys);
  }
}

export function selectNativePassword(
  secretRoot: Uint8Array,
  headerBase: Omit<SnapshotHeader, "generationId" | "nonce">,
  options?: {
    randomBytes?: NativePasswordRandomBytes;
    validatePassword?: NativePasswordValidator;
  },
): NativePasswordSelection {
  const random = options?.randomBytes ?? defaultRandom;
  const validate = options?.validatePassword ?? defaultValidate;
  for (let attempt = 0; attempt < NATIVE_PASSWORD_MAX_ATTEMPTS; attempt += 1) {
    let generation: Buffer | undefined;
    let nonce: Buffer | undefined;
    let keys: DerivedKeys | undefined;
    try {
      generation = random(32);
      nonce = random(12);
      if (!Buffer.isBuffer(generation) || generation.byteLength !== 32) {
        throw new KernelError(ERR_RANDOM);
      }
      if (!Buffer.isBuffer(nonce) || nonce.byteLength !== 12) {
        throw new KernelError(ERR_RANDOM);
      }
      const header: SnapshotHeader = {
        format: headerBase.format,
        version: headerBase.version,
        suite: headerBase.suite,
        vaultId: headerBase.vaultId,
        vaultSalt: headerBase.vaultSalt,
        rootEpoch: headerBase.rootEpoch,
        scopeId: headerBase.scopeId,
        recordId: headerBase.recordId,
        generationId: encodeBase64Url(generation),
        kind: headerBase.kind,
        nonce: encodeBase64Url(nonce),
      };
      keys = deriveKeys(secretRoot, header);
      const validated = validate(keys.nativeExportPassword);
      if (validated !== undefined) {
        throw new KernelError(ERR_UNSUPPORTED);
      }
      const selected = { generation, nonce, header, keys };
      generation = undefined;
      nonce = undefined;
      keys = undefined;
      return selected;
    } catch (err) {
      wipeSelection(generation, nonce, keys);
      if (isPasswordValidationError(err)) {
        continue;
      }
      if (err instanceof KernelError) {
        throw err;
      }
      throw new KernelError(ERR_INTERNAL);
    }
  }
  throw new KernelError(ERR_UNSUPPORTED);
}
