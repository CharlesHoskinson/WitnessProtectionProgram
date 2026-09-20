import type { JsonValue } from "../kernel/json.js";
import type { OpenResult, SnapshotMetadata } from "../kernel/vault.js";

export const ERR_CATALOG_INPUT = "CATALOG_INPUT";
export const ERR_CATALOG_LIMIT = "CATALOG_LIMIT";
export const ERR_CATALOG_REFERENCE = "CATALOG_REFERENCE";
export const ERR_CATALOG_CONFLICT = "CATALOG_CONFLICT";
export const ERR_CATALOG_BINDING = "CATALOG_BINDING";

export class CatalogError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "CatalogError";
    this.code = code;
  }
}

export interface AccountBinding {
  scheme: string;
  value: string;
}

export interface Locator {
  provider: "google-drive";
  accountBinding: AccountBinding;
  objectId: string;
  revisionId: string | null;
}

export interface SnapshotPackage {
  sha256: string;
  byteLength: number;
  rootEpoch: string;
  scopeId: string;
  recordId: string;
  generationId: string;
}

export interface SnapshotEntry {
  entryKind: "snapshot";
  package: SnapshotPackage;
  metadata: SnapshotMetadata;
  label: string | null;
  locators: Locator[];
}

export interface TombstoneEntry {
  entryKind: "tombstone";
  eventId: string;
  targetPackageSha256: string;
  reason: "user-request" | "superseded" | "invalid-capture";
  recordedAt: string;
}

export interface RootUpdateReceiptEntry {
  entryKind: "root-update-receipt";
  receiptId: string;
  parentRootRecordSha256: string[];
  currentRootRecordSha256: string;
  rootRevisionId: string;
  retainedOldEpochs: string[];
  newActiveEpoch: string;
  recordedAt: string;
}

export type CatalogEntry = SnapshotEntry | TombstoneEntry | RootUpdateReceiptEntry;

export type ObservationOutcome =
  | {
      status: "readback-authenticated";
      observedSha256: string;
      byteLength: number;
    }
  | {
      status: "digest-mismatch";
      observedSha256: string;
    }
  | {
      status: "authentication-failed";
      reason: "aead-rejected";
    }
  | {
      status: "not-found";
      reason: "object-not-found";
    }
  | {
      status: "access-denied";
      reason: "permission-denied";
    }
  | {
      status: "unavailable";
      reason: "network" | "provider" | "rate-limit";
    };

export interface Observation {
  observationId: string;
  packageSha256: string;
  locator: Locator;
  observedAt: string;
  outcome: ObservationOutcome;
}

export interface Catalog {
  payloadVersion: 1;
  parents: string[];
  entries: CatalogEntry[];
  observations: Observation[];
}

export type CatalogConflictKind =
  | "snapshot-claim"
  | "event-claim"
  | "receipt-claim"
  | "observation-claim"
  | "tombstone-live";

export interface CatalogConflict {
  kind: CatalogConflictKind;
  identity: string;
  claims: JsonValue[];
}

export interface CatalogRevisionInput {
  revisionSha256: string;
  payloadUtf8: Uint8Array;
}

export interface SourceRevision {
  revisionSha256: string;
  catalog: Catalog;
}

export interface ReconciliationResult {
  catalog: Catalog | null;
  conflicts: CatalogConflict[];
  revisionHeads: string[];
  missingParents: string[];
  sourceRevisions: SourceRevision[];
  freshness: "unknown";
}

export interface AuthenticatedSnapshot {
  opened: OpenResult;
  wireByteLength: number;
}
