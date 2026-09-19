import { createCipheriv, createDecipheriv, createHash, createHmac } from "node:crypto";
import {
  ERR_AUTH,
  ERR_INTERNAL,
  KernelError,
  canonicalizeJsonBytes,
  wipeBytes,
  type JsonValue,
} from "./json.js";
import { decodeId32, type SnapshotHeader } from "./validation.js";

export interface DerivedKeys {
  prk: Buffer;
  scopeKey: Buffer;
  objectKey: Buffer;
  nativeKey: Buffer;
  nativeExportPassword: string;
}

function hmacSha256(key: Uint8Array, data: Uint8Array): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Buffer {
  return hmacSha256(salt, ikm);
}

export function hkdfExpand32(parent: Uint8Array, info: Uint8Array): Buffer {
  return createHmac("sha256", parent)
    .update(info)
    .update(Buffer.from([0x01]))
    .digest();
}

function ctx(values: string[]): Buffer {
  return Buffer.from(canonicalizeJsonBytes(values));
}

export function deriveKeys(secretRoot: Uint8Array, header: SnapshotHeader): DerivedKeys {
  const vaultSalt = decodeId32(header.vaultSalt);
  const prk = hkdfExtract(vaultSalt, secretRoot);
  const scopeKey = hkdfExpand32(
    prk,
    ctx(["WPP", "1", "scope", header.vaultId, header.rootEpoch, header.scopeId]),
  );
  const objectKey = hkdfExpand32(
    scopeKey,
    ctx(["WPP", "1", "object", header.kind, header.recordId, header.generationId]),
  );
  const nativeKey = hkdfExpand32(
    scopeKey,
    ctx(["WPP", "1", "native-export-password", header.recordId, header.generationId]),
  );
  const nativeExportPassword = nativeKey.toString("base64url");
  return { prk, scopeKey, objectKey, nativeKey, nativeExportPassword };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function aeadEncrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array,
): { ciphertext: Buffer; tag: Buffer } {
  if (key.byteLength !== 32 || nonce.byteLength !== 12) {
    throw new KernelError(ERR_INTERNAL);
  }
  let ciphertext: Buffer | undefined;
  let tag: Buffer | undefined;
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    cipher.setAAD(aad);
    ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    tag = cipher.getAuthTag();
    if (tag.byteLength !== 16) {
      throw new KernelError(ERR_INTERNAL);
    }
    const sealed = { ciphertext, tag };
    ciphertext = undefined;
    tag = undefined;
    return sealed;
  } catch (err) {
    if (ciphertext !== undefined) {
      wipeBytes(ciphertext);
    }
    if (tag !== undefined) {
      wipeBytes(tag);
    }
    if (err instanceof KernelError) {
      throw err;
    }
    throw new KernelError(ERR_INTERNAL);
  }
}

export function aeadDecrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
): Buffer {
  if (key.byteLength !== 32 || nonce.byteLength !== 12 || tag.byteLength !== 16) {
    throw new KernelError(ERR_AUTH);
  }
  let chunk: Buffer | undefined;
  let tail: Buffer | undefined;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    chunk = decipher.update(ciphertext);
    tail = decipher.final();
    return Buffer.concat([chunk, tail]);
  } catch (err) {
    if (err instanceof KernelError) {
      throw err;
    }
    throw new KernelError(ERR_AUTH);
  } finally {
    if (chunk !== undefined) {
      wipeBytes(chunk);
    }
    if (tail !== undefined) {
      wipeBytes(tail);
    }
  }
}

export function wipeDerivedKeys(keys: DerivedKeys): void {
  wipeBytes(keys.prk);
  wipeBytes(keys.scopeKey);
  wipeBytes(keys.objectKey);
  wipeBytes(keys.nativeKey);
}

export function canonicalAad(value: JsonValue): Buffer {
  return Buffer.from(canonicalizeJsonBytes(value));
}
