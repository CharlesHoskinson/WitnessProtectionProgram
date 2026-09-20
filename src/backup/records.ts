import { randomBytes } from "node:crypto";

import {
  LIMIT_PLAINTEXT_BYTES,
  canonicalizeJsonBytes,
  copyOwnedBytes,
  isolatedJsonView,
  parseJsonBytes,
  wipeBytes,
  type JsonValue,
} from "../kernel/json.js";
import { validateExpectedSnapshot, validateSnapshotPayload } from "../kernel/validation.js";
import type { ExpectedSnapshot, OpenResult, SealInput, SnapshotMetadata } from "../kernel/vault.js";
import type { CatalogTaggedRecord, CatalogV2Locator } from "../storage/catalog-v2.js";
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
