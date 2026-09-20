import { randomBytes } from "node:crypto";

import {
  CatalogError,
  ERR_CATALOG_BINDING,
  verifySnapshotClaim,
} from "../catalog/index.js";
import {
  LIMIT_PLAINTEXT_BYTES,
  bytesEqual,
  canonicalizeJsonBytes,
  copyOwnedBytes,
  isolatedJsonView,
  parseJsonBytes,
  wipeBytes,
  type JsonValue,
} from "../kernel/json.js";
import { validateExpectedSnapshot, validateSnapshotPayload } from "../kernel/validation.js";
import type { ExpectedSnapshot, OpenResult, SealInput, SnapshotMetadata } from "../kernel/vault.js";
import type { CatalogRootPayload, CatalogTaggedRecord, CatalogV2Locator } from "../storage/catalog-v2.js";
import { BackupAbort } from "./errors.js";

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

export function copySealInput(input: SealInput): SealInput {
  if (input === null || typeof input !== "object") {
    throw new BackupAbort("schema");
  }
  const scopeId = input.scopeId;
  const recordId = input.recordId;
  if (typeof scopeId !== "string" || typeof recordId !== "string") {
    throw new BackupAbort("schema");
  }
  const payloadUtf8 = copyOwnedBytes(input.payloadUtf8, LIMIT_PLAINTEXT_BYTES);
  return { scopeId, recordId, payloadUtf8 };
}

export function copyExpected(expected: ExpectedSnapshot): ExpectedSnapshot {
  try {
    return validateExpectedSnapshot(expected);
  } catch {
    throw new BackupAbort("schema");
  }
}

export function copyDigest(value: unknown): string {
  if (typeof value !== "string" || !SHA256_HEX_RE.test(value)) {
    throw new BackupAbort("schema");
  }
  return value;
}

export function expectedFromPayload(scopeId: string, recordId: string, payloadUtf8: Uint8Array): ExpectedSnapshot {
  const parsed = parseJsonBytes(payloadUtf8, LIMIT_PLAINTEXT_BYTES);
  const payload = validateSnapshotPayload(parsed);
  return validateExpectedSnapshot({
    scopeId,
    recordId,
    network: payload.metadata.network,
    accountBinding: payload.metadata.accountBinding,
    applicationId: payload.metadata.applicationId,
    contract: payload.metadata.contract,
    codec: payload.metadata.codec,
  });
}

export function randomId32(): string {
  return randomBytes(32).toString("base64url");
}

export function utcTimestamp(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

export function cloneMetadata(metadata: SnapshotMetadata): SnapshotMetadata {
  return isolatedJsonView(metadata as unknown as JsonValue) as unknown as SnapshotMetadata;
}

export function snapshotRecordFromOpened(
  opened: OpenResult,
  byteLength: number,
  locators: CatalogV2Locator[],
): CatalogTaggedRecord {
  const metadata = cloneMetadata(opened.metadata);
  const record: CatalogTaggedRecord = {
    recordKind: "snapshot",
    body: {
      entryKind: "snapshot",
      package: {
        sha256: opened.packageSha256,
        byteLength,
        rootEpoch: opened.header.rootEpoch,
        scopeId: opened.header.scopeId,
        recordId: opened.header.recordId,
        generationId: opened.header.generationId,
      },
      metadata: metadata as unknown as JsonValue,
      label: "",
      locators: isolatedJsonView(locators as unknown as JsonValue) as unknown as JsonValue,
    },
  };
  return isolatedJsonView(record as unknown as JsonValue) as unknown as CatalogTaggedRecord;
}

export function creationObservation(
  packageSha256: string,
  byteLength: number,
  locator: CatalogV2Locator,
  nowMs: number,
): CatalogTaggedRecord {
  const record: CatalogTaggedRecord = {
    recordKind: "observation",
    body: {
      observationId: randomId32(),
      packageSha256,
      locator: isolatedJsonView(locator as unknown as JsonValue) as unknown as JsonValue,
      observedAt: utcTimestamp(nowMs),
      outcome: {
        status: "readback-authenticated",
        observedSha256: packageSha256,
        byteLength,
      },
    },
  };
  return isolatedJsonView(record as unknown as JsonValue) as unknown as CatalogTaggedRecord;
}

export function canonicalRecords(records: readonly CatalogTaggedRecord[]): Uint8Array {
  return canonicalizeJsonBytes(records as unknown as JsonValue);
}

export function wipeOptional(bytes: Uint8Array | undefined): void {
  if (bytes !== undefined) {
    wipeBytes(bytes);
  }
}

function ownString(value: unknown, localUnsynced: boolean): string {
  if (typeof value !== "string") {
    throw new BackupAbort("schema", localUnsynced);
  }
  return value;
}

function ownInteger(value: unknown, localUnsynced: boolean): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new BackupAbort("schema", localUnsynced);
  }
  return value;
}

function ownObject(value: unknown, localUnsynced: boolean): { [key: string]: unknown } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BackupAbort("schema", localUnsynced);
  }
  return value as { [key: string]: unknown };
}

function ownKey(object: { [key: string]: unknown }, key: string, localUnsynced: boolean): unknown {
  if (!Object.prototype.hasOwnProperty.call(object, key)) {
    throw new BackupAbort("schema", localUnsynced);
  }
  return object[key];
}

export function expectedFromSnapshotRecord(
  record: CatalogTaggedRecord,
  localUnsynced = false,
): ExpectedSnapshot {
  if (record.recordKind !== "snapshot") {
    throw new BackupAbort("schema", localUnsynced);
  }
  const body = ownObject(record.body, localUnsynced);
  const pack = ownObject(ownKey(body, "package", localUnsynced), localUnsynced);
  const metadata = ownObject(ownKey(body, "metadata", localUnsynced), localUnsynced);
  try {
    return validateExpectedSnapshot({
      scopeId: ownString(ownKey(pack, "scopeId", localUnsynced), localUnsynced),
      recordId: ownString(ownKey(pack, "recordId", localUnsynced), localUnsynced),
      network: ownKey(metadata, "network", localUnsynced),
      accountBinding: ownKey(metadata, "accountBinding", localUnsynced),
      applicationId: ownKey(metadata, "applicationId", localUnsynced),
      contract: ownKey(metadata, "contract", localUnsynced),
      codec: ownKey(metadata, "codec", localUnsynced),
    });
  } catch (err) {
    if (err instanceof BackupAbort) {
      throw err;
    }
    throw new BackupAbort("schema", localUnsynced);
  }
}

export function assertOpenedMatchesSnapshotRecord(
  opened: OpenResult,
  wireByteLength: number,
  record: CatalogTaggedRecord,
  vaultId: string,
  localUnsynced = false,
): void {
  if (record.recordKind !== "snapshot") {
    throw new BackupAbort("schema", localUnsynced);
  }
  const body = ownObject(record.body, localUnsynced);
  const pack = ownObject(ownKey(body, "package", localUnsynced), localUnsynced);
  const metadata = ownObject(ownKey(body, "metadata", localUnsynced), localUnsynced);
  const header = opened.header;
  const mismatches = [
    opened.packageSha256 !== ownString(ownKey(pack, "sha256", localUnsynced), localUnsynced),
    wireByteLength !== ownInteger(ownKey(pack, "byteLength", localUnsynced), localUnsynced),
    header.vaultId !== vaultId,
    header.rootEpoch !== ownString(ownKey(pack, "rootEpoch", localUnsynced), localUnsynced),
    header.scopeId !== ownString(ownKey(pack, "scopeId", localUnsynced), localUnsynced),
    header.recordId !== ownString(ownKey(pack, "recordId", localUnsynced), localUnsynced),
    header.generationId !== ownString(ownKey(pack, "generationId", localUnsynced), localUnsynced),
    header.kind !== "snapshot",
  ];
  for (const mismatch of mismatches) {
    if (mismatch) {
      throw new BackupAbort("binding-mismatch", localUnsynced);
    }
  }
  const openedMeta = canonicalizeJsonBytes(opened.metadata as unknown as JsonValue);
  const entryMeta = canonicalizeJsonBytes(metadata as unknown as JsonValue);
  try {
    if (!bytesEqual(openedMeta, entryMeta)) {
      throw new BackupAbort("binding-mismatch", localUnsynced);
    }
  } finally {
    wipeBytes(openedMeta);
    wipeBytes(entryMeta);
  }
  const entryBytes = canonicalizeJsonBytes(body as unknown as JsonValue);
  try {
    verifySnapshotClaim(entryBytes, vaultId, { opened, wireByteLength });
  } catch (err) {
    if (err instanceof BackupAbort) {
      throw err;
    }
    if (err instanceof CatalogError && err.code === ERR_CATALOG_BINDING) {
      throw new BackupAbort("binding-mismatch", localUnsynced);
    }
    throw new BackupAbort("schema", localUnsynced);
  } finally {
    wipeBytes(entryBytes);
  }
}

export function snapshotPackageEpochs(
  records: readonly CatalogTaggedRecord[],
  localUnsynced = false,
): string[] {
  const epochs = new Set<string>();
  for (const record of records) {
    if (record.recordKind !== "snapshot") {
      continue;
    }
    const body = ownObject(record.body, localUnsynced);
    const pack = ownObject(ownKey(body, "package", localUnsynced), localUnsynced);
    epochs.add(ownString(ownKey(pack, "rootEpoch", localUnsynced), localUnsynced));
  }
  return [...epochs];
}

export function assertExactRequiredEpochs(
  payload: CatalogRootPayload,
  rootHeaderEpoch: string,
  shardHeaderEpochs: readonly string[],
  records: readonly CatalogTaggedRecord[],
  localUnsynced = false,
): void {
  const rootObject = ownObject(payload as unknown as { [key: string]: unknown }, localUnsynced);
  const actualUnknown = ownKey(rootObject, "requiredEpochs", localUnsynced);
  if (!Array.isArray(actualUnknown)) {
    throw new BackupAbort("schema", localUnsynced);
  }
  const actual: string[] = [];
  for (const item of actualUnknown) {
    actual.push(ownString(item, localUnsynced));
  }
  const expected = new Set<string>();
  expected.add(ownString(rootHeaderEpoch, localUnsynced));
  for (const epoch of shardHeaderEpochs) {
    expected.add(ownString(epoch, localUnsynced));
  }
  for (const epoch of snapshotPackageEpochs(records, localUnsynced)) {
    expected.add(epoch);
  }
  const expectedSorted = [...expected].sort();
  if (actual.length !== expectedSorted.length) {
    throw new BackupAbort("child-preflight-failed", localUnsynced);
  }
  for (let i = 0; i < expectedSorted.length; i += 1) {
    if (actual[i] !== expectedSorted[i]) {
      throw new BackupAbort("child-preflight-failed", localUnsynced);
    }
  }
}
