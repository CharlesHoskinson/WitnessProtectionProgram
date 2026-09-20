import { ERR_AUTH, ERR_INTERNAL, ERR_SCHEMA, ERR_UNSUPPORTED, KernelError } from "./json.js";

export const ERR_ABORTED = "WPP_ABORTED";

export function isPasswordValidationError(err: unknown): boolean {
  if (err === null || typeof err !== "object") {
    return false;
  }
  const name = (err as { name?: unknown }).name;
  if (name === "PasswordValidationError") {
    return true;
  }
  return Object.prototype.toString.call(err) === "[object PasswordValidationError]";
}

export function mapNativeError(err: unknown): never {
  if (err instanceof KernelError) {
    throw err;
  }
  let name = "";
  try {
    if (err !== null && typeof err === "object" && "name" in err && typeof err.name === "string") {
      name = err.name;
    }
  } catch {
    throw new KernelError(ERR_INTERNAL);
  }
  if (name === "ExportDecryptionError") {
    throw new KernelError(ERR_AUTH);
  }
  if (name === "ImportConflictError" || name === "PrivateStateExportError" || name === "PasswordValidationError") {
    throw new KernelError(ERR_UNSUPPORTED);
  }
  if (name === "InvalidExportFormatError") {
    throw new KernelError(ERR_SCHEMA);
  }
  throw new KernelError(ERR_INTERNAL);
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal === undefined) {
    return;
  }
  if (signal.aborted) {
    throw new KernelError(ERR_ABORTED);
  }
}
