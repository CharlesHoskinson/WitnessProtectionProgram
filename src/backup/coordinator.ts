import { GoogleError } from "../google/errors.js";
import type { GoogleDriveSession } from "../google/drive.js";
import type { CiphertextCandidate, RemoteGetReceipt, RemotePutReceipt } from "../google/types.js";
import { JournalError, type CiphertextJournal } from "../journal/index.js";
import {
  KernelError,
  LIMIT_PACKAGE_BYTES,
  canonicalizeJsonBytes,
  isolatedJsonView,
  parseJsonBytes,
  wipeBytes,
  type JsonValue,
} from "../kernel/json.js";
import { validatePackageWire, type SnapshotHeader } from "../kernel/validation.js";
import type { OpenCatalogNodeResult, OpenResult, SealInput, UnlockedVault } from "../kernel/vault.js";
import {
  CATALOG_V2_LIMITS,
  planCatalogShards,
  preflightCatalogRoot,
  validateCatalogRevision,
  type CatalogNonemptyReference,
  type CatalogPlan,
  type CatalogRootPayload,
  type CatalogShardPayload,
  type CatalogTaggedRecord,
  type CatalogV2Locator,
  type PlannedShardLeaf,
} from "../storage/catalog-v2.js";
import { OperationBudget } from "./budget.js";
import {
  locatorFromReceipt,
  parseBackupCheckpoint,
  writeBackupCheckpointFile,
} from "./checkpoint.js";
import { BackupAbort, BackupError, ERR_BACKUP_SCHEMA } from "./errors.js";
import {
  canonicalRecords,
  copyDigest,
  copyExpected,
  copySealInput,
  creationObservation,
  expectedFromPayload,
  snapshotRecordFromOpened,
  wipeOptional,
} from "./records.js";
import type {
  BackupCheckpoint,
  BackupIncompleteReason,
  BackupMode,
  ColdRestoreInput,
  CoordinatorOptions,
  ExpectedSnapshot,
  GoogleDriveLocator,
  PublishResult,
  RestoreResult,
} from "./types.js";
import { BACKUP_LIMITS } from "./types.js";

const PERMISSION_RE = /^[A-Za-z0-9_.-]{1,128}$/;
const FILE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

interface StoredShard {
  reference: CatalogNonemptyReference;
  wire: Uint8Array;
  header: SnapshotHeader;
}

interface LiveWitnessEntry {
  digest: string;
  byteLength: number;
  locators: CatalogV2Locator[];
  record: CatalogTaggedRecord;
}

interface ParentState {
  rootSha256: string;
  rootPayload: CatalogRootPayload;
  records: CatalogTaggedRecord[];
  shardsByPrefix: Map<string, StoredShard>;
  liveByDigest: Map<string, LiveWitnessEntry>;
}

interface MemoryIndex {
  rootWireSha256: string;
  liveByDigest: Map<string, LiveWitnessEntry>;
  records: CatalogTaggedRecord[];
}

function googleCode(err: unknown): string | undefined {
  if (err instanceof GoogleError) {
    return err.code;
  }
  if (err !== null && typeof err === "object" && "code" in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function mapKernelReason(code: string): BackupIncompleteReason {
  switch (code) {
    case "WPP_LOCKED":
      return "locked";
    case "WPP_AUTH":
    case "WPP_EPOCH":
      return "authentication-failed";
    case "WPP_BINDING":
      return "binding-mismatch";
    case "WPP_CATALOG_CAPACITY":
    case "WPP_INPUT_TOO_LARGE":
      return "capacity";
    case "WPP_CATALOG_COVER":
    case "WPP_CATALOG_REFERENCE":
    case "WPP_CATALOG_DUPLICATE":
    case "WPP_CATALOG_ROLE":
      return "child-preflight-failed";
    case "WPP_ROOT":
      return "wrong-account";
    case "WPP_SCHEMA":
    case "WPP_UNKNOWN_FIELD":
    case "WPP_BASE64URL":
    case "WPP_NONCANONICAL":
      return "schema";
    case "WPP_UNSUPPORTED":
      return "unsupported";
    default:
      return "interrupted";
  }
}

function mapFailure(err: unknown, localUnsynced: boolean): BackupAbort {
  if (err instanceof BackupAbort) {
    return err;
  }
  if (err instanceof KernelError) {
    const reason = mapKernelReason(err.code);
    return new BackupAbort(reason, localUnsynced || reason === "locked");
  }
  const gcode = googleCode(err);
  if (gcode === "GOOGLE_BIND_IDENTITY" || gcode === "GOOGLE_DRIVE_AUTH") {
    return new BackupAbort("wrong-account", localUnsynced);
  }
  if (gcode === "GOOGLE_DRIVE_QUOTA") {
    return new BackupAbort("capacity", localUnsynced);
  }
  if (gcode === "GOOGLE_DRIVE_READBACK") {
    return new BackupAbort("corrupt-object", localUnsynced);
  }
  if (gcode === "GOOGLE_DRIVE_INCOMPLETE" || gcode === "GOOGLE_DRIVE_CREATE") {
    return new BackupAbort("provider-incomplete", localUnsynced);
  }
  if (gcode === "GOOGLE_DRIVE_INPUT" || gcode === "GOOGLE_DRIVE_REDIRECT") {
    return new BackupAbort("schema", localUnsynced);
  }
  if (err instanceof JournalError) {
    if (err.code === "INVALID_INPUT") {
      return new BackupAbort("schema", localUnsynced);
    }
    return new BackupAbort("interrupted", true);
  }
  if (err instanceof BackupError) {
    if (err.code === ERR_BACKUP_SCHEMA) {
      return new BackupAbort("schema", localUnsynced);
    }
    return new BackupAbort("interrupted", localUnsynced);
  }
  return new BackupAbort("interrupted", localUnsynced);
}

function isLostCreate(err: unknown): boolean {
  const code = googleCode(err);
  return code === "GOOGLE_DRIVE_INCOMPLETE" || code === "GOOGLE_DRIVE_CREATE";
}

function headerFromWire(wire: Uint8Array): SnapshotHeader {
  const parsed = parseJsonBytes(wire, LIMIT_PACKAGE_BYTES);
  const pack = validatePackageWire(parsed);
  return pack.header;
}

function copyPermissionId(value: unknown): string {
  if (typeof value !== "string" || !PERMISSION_RE.test(value)) {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  return value;
}

function copyMode(mode: BackupMode): BackupMode {
  if (mode === null || typeof mode !== "object") {
    throw new BackupError(ERR_BACKUP_SCHEMA);
  }
  if (mode.kind === "new-vault") {
    return { kind: "new-vault" };
  }
  if (mode.kind === "selected-checkpoint") {
    return { kind: "selected-checkpoint", checkpoint: parseBackupCheckpoint(mode.checkpoint) };
  }
  throw new BackupError(ERR_BACKUP_SCHEMA);
}

function worstLocator(permissionId: string): CatalogV2Locator {
  return {
    provider: "google-drive",
    accountBinding: {
      scheme: "google-drive-permission-id",
      value: permissionId,
    },
    objectId: "X".repeat(128),
    revisionId: "Y".repeat(128),
  };
}

function locatorToCatalog(locator: GoogleDriveLocator): CatalogV2Locator {
  return {
    provider: "google-drive",
    accountBinding: {
      scheme: "google-drive-permission-id",
      value: locator.accountBinding.value,
    },
    objectId: locator.objectId,
    revisionId: locator.revisionId,
  };
}

function canReuseLeaf(
  parent: StoredShard | undefined,
  leaf: PlannedShardLeaf,
  activeEpoch: string,
): parent is StoredShard {
  if (parent === undefined) {
    return false;
  }
  const ref = parent.reference;
  return (
    ref.rootEpoch === activeEpoch &&
    ref.canonicalRecordsSha256 === leaf.canonicalRecordsSha256 &&
    ref.entryCount === leaf.entryCount &&
    ref.observationCount === leaf.observationCount &&
    ref.plaintextByteLength === leaf.plaintextByteLength &&
    parent.header.rootEpoch === activeEpoch
  );
}

function bindPutReceipt(receipt: RemoteGetReceipt, sha256: string, byteCount: number): RemotePutReceipt {
  const out: RemotePutReceipt = {
    fileId: receipt.fileId,
    sha256,
    byteCount,
    remoteReadbackVerified: true,
    ownedReadback: receipt.ownedReadback,
  };
  return out;
}

function asRootPayload(opened: OpenCatalogNodeResult): CatalogRootPayload {
  if (opened.node.role !== "root") {
    throw new BackupAbort("child-preflight-failed");
  }
  return opened.node.payload;
}

function asShardPayload(opened: OpenCatalogNodeResult): CatalogShardPayload {
  if (opened.node.role !== "shard") {
    throw new BackupAbort("child-preflight-failed");
  }
  return opened.node.payload;
}

function uniqueChildIdentities(references: CatalogRootPayload["references"]): void {
  const recordIds = new Set<string>();
  const wires = new Set<string>();
  for (const reference of references) {
    if (reference.empty) {
      continue;
    }
    if (recordIds.has(reference.recordId) || wires.has(reference.wireSha256)) {
      throw new BackupAbort("child-preflight-failed");
    }
    recordIds.add(reference.recordId);
    wires.add(reference.wireSha256);
  }
}

export class GoogleBackupCoordinator {
  readonly #vault: UnlockedVault;
  readonly #session: GoogleDriveSession;
  readonly #journal: CiphertextJournal | undefined;
  readonly #modeKind: "new-vault" | "selected-checkpoint";
  readonly #permissionId: string;
  readonly #checkpointPath: string | undefined;
  readonly #deadlineMs: number | undefined;
  #checkpoint: BackupCheckpoint | null;
  #index: MemoryIndex | undefined;
  #busy = false;
  #budget: OperationBudget | undefined;

  constructor(options: CoordinatorOptions) {
    if (options === null || typeof options !== "object") {
      throw new BackupError(ERR_BACKUP_SCHEMA);
    }
    this.#vault = options.vault;
    this.#session = options.session;
    this.#journal = options.journal;
    this.#permissionId = copyPermissionId(options.session.permissionId);
    const mode = copyMode(options.mode);
    this.#modeKind = mode.kind;
    this.#checkpoint = mode.kind === "selected-checkpoint" ? mode.checkpoint : null;
    this.#checkpointPath = typeof options.checkpointPath === "string" ? options.checkpointPath : undefined;
    this.#deadlineMs = typeof options.deadlineMs === "number" ? options.deadlineMs : undefined;
    if (this.#vault.locked) {
      throw new BackupError(ERR_BACKUP_SCHEMA);
    }
  }

  static async restoreSnapshot(input: ColdRestoreInput): Promise<RestoreResult> {
    const checkpoint = parseBackupCheckpoint(input.checkpoint);
    const coordinator = new GoogleBackupCoordinator({
      vault: input.vault,
      session: input.session,
      mode: { kind: "selected-checkpoint", checkpoint },
    });
    return coordinator.restoreSnapshot(checkpoint, input.packageSha256, input.expected);
  }

  async publishSnapshot(input: SealInput): Promise<PublishResult> {
    return this.#publish(async () => {
      const owned = copySealInput(input);
      try {
        return await this.#publishOwnedSnapshot(owned);
      } finally {
        wipeBytes(owned.payloadUtf8);
      }
    });
  }

  async publishUnchanged(): Promise<PublishResult> {
    return this.#publish(async () => {
      const checkpoint = this.#requireCheckpoint();
      const parent = await this.#loadParent(checkpoint, false);
      for (const live of parent.liveByDigest.values()) {
        await this.#getByLocators(live.locators, live.digest, live.byteLength, false);
        this.#requireUnlocked(false);
      }
      this.#installIndex(checkpoint.root.wireSha256, parent);
      this.#assertTime();
      this.#requireUnlocked(false);
      const liveDigests = [...parent.liveByDigest.keys()].sort();
      return {
        status: "verified" as const,
        checkpoint,
        packageSha256: liveDigests[liveDigests.length - 1] ?? checkpoint.root.wireSha256,
        metrics: this.#metrics(),
      };
    });
  }

  async restoreSnapshot(
    checkpointInput: BackupCheckpoint,
    packageSha256: string,
    expectedInput: ExpectedSnapshot,
  ): Promise<RestoreResult> {
    return this.#restore(async () => {
      const checkpoint = parseBackupCheckpoint(checkpointInput);
      const digest = copyDigest(packageSha256);
      const expected = copyExpected(expectedInput);
      const parent = await this.#loadParent(checkpoint, false);
      this.#installIndex(checkpoint.root.wireSha256, parent);
      const live = parent.liveByDigest.get(digest);
      if (live === undefined) {
        throw new BackupAbort("missing-object");
      }
      const receipt = await this.#getByLocators(live.locators, live.digest, live.byteLength, false);
      this.#requireUnlocked(false);
      const opened = this.#vault.openSnapshot(receipt.ownedReadback, expected);
      this.#requireUnlocked(false);
      if (opened.packageSha256 !== digest) {
        throw new BackupAbort("binding-mismatch");
      }
      return {
        status: "verified" as const,
        snapshot: opened,
        checkpoint,
      };
    });
  }

  async #publish(fn: () => Promise<Extract<PublishResult, { status: "verified" }>>): Promise<PublishResult> {
    if (this.#busy) {
      return this.#incompletePublish("concurrent-operation", false);
    }
    this.#busy = true;
    this.#budget = new OperationBudget(Date.now(), this.#deadlineMs);
    try {
      this.#requireUnlocked(false);
      this.#assertTime();
      return await fn();
    } catch (err) {
      const abort = mapFailure(err, false);
      if (this.#vault.locked) {
        this.#index = undefined;
      }
      return this.#incompletePublish(abort.reason as BackupIncompleteReason, abort.localUnsynced);
    } finally {
      this.#busy = false;
    }
  }

  async #restore(fn: () => Promise<Extract<RestoreResult, { status: "verified" }>>): Promise<RestoreResult> {
    if (this.#busy) {
      return this.#incompleteRestore("concurrent-operation");
    }
    this.#busy = true;
    this.#budget = new OperationBudget(Date.now(), this.#deadlineMs);
    try {
      this.#requireUnlocked(false);
      this.#assertTime();
      return await fn();
    } catch (err) {
      const abort = mapFailure(err, false);
      if (this.#vault.locked) {
        this.#index = undefined;
      }
      return this.#incompleteRestore(abort.reason as BackupIncompleteReason);
    } finally {
      this.#busy = false;
    }
  }

  async #publishOwnedSnapshot(owned: SealInput): Promise<Extract<PublishResult, { status: "verified" }>> {
    const parent = await this.#loadOptionalParent();
    this.#requireUnlocked(false);
    const sealed = this.#vault.sealSnapshot(owned);
    const expected = expectedFromPayload(owned.scopeId, owned.recordId, owned.payloadUtf8);
    const openedLocal = this.#vault.openSnapshot(sealed.wire, expected);
    this.#requireUnlocked(false);
    const activeEpoch = openedLocal.header.rootEpoch;
    this.#preflightNextState(parent, openedLocal, sealed.wire.byteLength, activeEpoch);
    await this.#journalPut(sealed.wire, sealed.sha256, true);
    const witnessReceipt = await this.#putOrAdopt(sealed.wire, sealed.sha256, true);
    this.#requireUnlocked(true);
    const openedRemote = this.#vault.openSnapshot(witnessReceipt.ownedReadback, expected);
    this.#requireUnlocked(true);
    if (openedRemote.packageSha256 !== sealed.sha256) {
      throw new BackupAbort("binding-mismatch", true);
    }
    const locator = locatorFromReceipt(this.#permissionId, witnessReceipt.fileId, null);
    const catalogLocator = locatorToCatalog(locator);
    const snapshotRec = snapshotRecordFromOpened(openedRemote, sealed.wire.byteLength, [catalogLocator]);
    const observation = creationObservation(
      sealed.sha256,
      sealed.wire.byteLength,
      catalogLocator,
      Date.now(),
    );
    const records = [...parent.records, snapshotRec, observation];
    const planBytes = canonicalRecords(records);
    let plan: CatalogPlan;
    try {
      plan = planCatalogShards(planBytes);
    } finally {
      wipeBytes(planBytes);
    }
    if (plan.liveRecordForks.length > 0) {
      throw new BackupAbort("unresolved-fork", true);
    }
    return this.#publishPlan(parent, plan, activeEpoch, sealed.sha256);
  }

  async #publishPlan(
    parent: ParentState,
    plan: CatalogPlan,
    activeEpoch: string,
    newWitnessSha: string,
  ): Promise<Extract<PublishResult, { status: "verified" }>> {
    const references: CatalogRootPayload["references"] = [];
    const requiredEpochs = new Set<string>(plan.requiredEpochs);
    requiredEpochs.add(activeEpoch);
    const shardPlain: Uint8Array[] = [];
    try {
      for (const leaf of plan.leaves) {
        this.#assertTime();
        this.#requireUnlocked(true);
        if (leaf.empty) {
          references.push({ prefix: leaf.prefix, empty: true });
          continue;
        }
        const parentShard = parent.shardsByPrefix.get(leaf.prefix);
        if (canReuseLeaf(parentShard, leaf, activeEpoch)) {
          await this.#getAndOpenShard(parentShard.reference, true);
          references.push(parentShard.reference);
          requiredEpochs.add(parentShard.reference.rootEpoch);
          shardPlain.push(leaf.payloadUtf8);
          continue;
        }
        const sealedShard = this.#vault.sealCatalogNode(leaf.payloadUtf8);
        const header = headerFromWire(sealedShard.wire);
        await this.#journalPut(sealedShard.wire, sealedShard.sha256, true);
        const receipt = await this.#putOrAdopt(sealedShard.wire, sealedShard.sha256, true);
        const locators: CatalogV2Locator[] = [
          locatorToCatalog(locatorFromReceipt(this.#permissionId, receipt.fileId, null)),
        ];
        const reference: CatalogNonemptyReference = {
          prefix: leaf.prefix,
          empty: false,
          recordId: header.recordId,
          generationId: header.generationId,
          rootEpoch: header.rootEpoch,
          wireSha256: sealedShard.sha256,
          wireByteLength: sealedShard.wire.byteLength,
          plaintextByteLength: leaf.plaintextByteLength,
          entryCount: leaf.entryCount,
          observationCount: leaf.observationCount,
          canonicalRecordsSha256: leaf.canonicalRecordsSha256,
          locators,
        };
        this.#requireUnlocked(true);
        this.#vault.openCatalogNode(receipt.ownedReadback, { nodeType: "shard", reference });
        references.push(reference);
        requiredEpochs.add(header.rootEpoch);
        shardPlain.push(leaf.payloadUtf8);
      }

      await this.#readbackLiveWitnesses(parent, plan, newWitnessSha);

      const parents = parent.rootSha256.length === 0 ? [] : [parent.rootSha256];
      const rootPayload: CatalogRootPayload = {
        payloadVersion: 2,
        nodeType: "root",
        partitionVersion: 1,
        parents,
        entryCount: plan.entryCount,
        observationCount: plan.observationCount,
        requiredEpochs: [...requiredEpochs].sort(),
        references,
      };
      const rootBytes = canonicalizeJsonBytes(rootPayload as unknown as JsonValue);
      let sealedRoot: { wire: Uint8Array; sha256: string };
      try {
        if (rootBytes.byteLength > CATALOG_V2_LIMITS.rootPlaintextBytes) {
          throw new BackupAbort("capacity", true);
        }
        this.#requireUnlocked(true);
        sealedRoot = this.#vault.sealCatalogNode(rootBytes);
      } finally {
        wipeBytes(rootBytes);
      }
      await this.#journalPut(sealedRoot.wire, sealedRoot.sha256, true);
      const rootReceipt = await this.#putOrAdopt(sealedRoot.wire, sealedRoot.sha256, true);
      this.#requireUnlocked(true);
      this.#assertTime();
      const openedRoot = this.#vault.openCatalogNode(rootReceipt.ownedReadback, {
        nodeType: "root",
        wireSha256: sealedRoot.sha256,
        wireByteLength: sealedRoot.wire.byteLength,
      });
      this.#requireUnlocked(true);
      if (openedRoot.packageSha256 !== sealedRoot.sha256) {
        throw new BackupAbort("binding-mismatch", true);
      }
      const openedRootPlain = canonicalizeJsonBytes(openedRoot.node.payload as unknown as JsonValue);
      let revision;
      try {
        revision = validateCatalogRevision(openedRootPlain, shardPlain);
      } finally {
        wipeBytes(openedRootPlain);
      }
      if (revision.liveRecordForks.length > 0) {
        throw new BackupAbort("unresolved-fork", true);
      }
      const checkpoint: BackupCheckpoint = parseBackupCheckpoint({
        format: "wpp-backup-checkpoint",
        version: 1,
        root: {
          wireSha256: sealedRoot.sha256,
          wireByteLength: sealedRoot.wire.byteLength,
          locator: locatorFromReceipt(this.#permissionId, rootReceipt.fileId, null),
        },
      });
      this.#assertTime();
      this.#requireUnlocked(true);
      if (this.#checkpointPath !== undefined) {
        writeBackupCheckpointFile(this.#checkpointPath, checkpoint);
      }
      this.#checkpoint = checkpoint;
      this.#installIndex(checkpoint.root.wireSha256, {
        rootSha256: checkpoint.root.wireSha256,
        rootPayload: asRootPayload(openedRoot),
        records: this.#collectRecords(revision.shards.map((shard) => shard.records).flat()),
        shardsByPrefix: new Map(),
        liveByDigest: this.#liveMapFromRecords(
          this.#collectRecords(revision.shards.map((shard) => shard.records).flat()),
        ),
      });
      return {
        status: "verified",
        checkpoint,
        packageSha256: newWitnessSha,
        metrics: this.#metrics(),
      };
    } finally {
      for (const bytes of shardPlain) {
        wipeBytes(bytes);
      }
    }
  }

  #preflightNextState(
    parent: ParentState,
    opened: OpenResult,
    witnessBytes: number,
    activeEpoch: string,
  ): void {
    if (witnessBytes > LIMIT_PACKAGE_BYTES || witnessBytes > CATALOG_V2_LIMITS.liveWitnessWireBytes) {
      throw new BackupAbort("capacity", true);
    }
    const tentativeLocator = worstLocator(this.#permissionId);
    const snapshotRec = snapshotRecordFromOpened(opened, witnessBytes, [tentativeLocator]);
    const observation = creationObservation(opened.packageSha256, witnessBytes, tentativeLocator, Date.now());
    const records = [...parent.records, snapshotRec, observation];
    const planBytes = canonicalRecords(records);
    let plan: CatalogPlan;
    try {
      plan = planCatalogShards(planBytes);
    } catch (err) {
      throw mapFailure(err, false);
    } finally {
      wipeBytes(planBytes);
    }
    if (plan.liveWitnessWireBytes > CATALOG_V2_LIMITS.liveWitnessWireBytes) {
      throw new BackupAbort("capacity", true);
    }
    if (plan.cumulativePlaintextBytes > CATALOG_V2_LIMITS.cumulativeShardPlaintextBytes) {
      throw new BackupAbort("capacity", true);
    }
    if (plan.leaves.length > CATALOG_V2_LIMITS.maxReferences) {
      throw new BackupAbort("capacity", true);
    }
    if (plan.entryCount > CATALOG_V2_LIMITS.maxEntries || plan.observationCount > CATALOG_V2_LIMITS.maxObservations) {
      throw new BackupAbort("capacity", true);
    }
    if (plan.liveRecordForks.length > 0) {
      throw new BackupAbort("unresolved-fork", true);
    }
    void activeEpoch;
  }

  async #loadOptionalParent(): Promise<ParentState> {
    if (this.#checkpoint === null) {
      if (this.#modeKind === "selected-checkpoint") {
        throw new BackupAbort("checkpoint-required");
      }
      return {
        rootSha256: "",
        rootPayload: {
          payloadVersion: 2,
          nodeType: "root",
          partitionVersion: 1,
          parents: [],
          entryCount: 0,
          observationCount: 0,
          requiredEpochs: [],
          references: [],
        },
        records: [],
        shardsByPrefix: new Map(),
        liveByDigest: new Map(),
      };
    }
    return this.#loadParent(this.#checkpoint, false);
  }

  async #loadParent(checkpoint: BackupCheckpoint, localUnsynced: boolean): Promise<ParentState> {
    this.#assertAccount(checkpoint);
    const rootReceipt = await this.#getExpected(
      checkpoint.root.locator,
      checkpoint.root.wireSha256,
      checkpoint.root.wireByteLength,
      localUnsynced,
    );
    this.#requireUnlocked(localUnsynced);
    const openedRoot = this.#vault.openCatalogNode(rootReceipt.ownedReadback, {
      nodeType: "root",
      wireSha256: checkpoint.root.wireSha256,
      wireByteLength: checkpoint.root.wireByteLength,
    });
    this.#requireUnlocked(localUnsynced);
    const rootPayload = asRootPayload(openedRoot);
    this.#preflightOpenedRoot(rootPayload);
    const shardsByPrefix = new Map<string, StoredShard>();
    const shardPlain: Uint8Array[] = [];
    try {
      for (const reference of rootPayload.references) {
        if (reference.empty) {
          continue;
        }
        const receipt = await this.#getByLocators(
          reference.locators,
          reference.wireSha256,
          reference.wireByteLength,
          localUnsynced,
        );
        this.#requireUnlocked(localUnsynced);
        const openedShard = this.#vault.openCatalogNode(receipt.ownedReadback, {
          nodeType: "shard",
          reference,
        });
        this.#requireUnlocked(localUnsynced);
        const header = openedShard.header;
        shardsByPrefix.set(reference.prefix, {
          reference,
          wire: receipt.ownedReadback,
          header,
        });
        shardPlain.push(canonicalizeJsonBytes(asShardPayload(openedShard) as unknown as JsonValue));
      }
      const rootPlain = canonicalizeJsonBytes(rootPayload as unknown as JsonValue);
      let revision;
      try {
        revision = validateCatalogRevision(rootPlain, shardPlain);
      } finally {
        wipeBytes(rootPlain);
      }
      if (revision.liveRecordForks.length > 0) {
        throw new BackupAbort("unresolved-fork", localUnsynced);
      }
      const records = this.#collectRecords(revision.shards.map((shard) => shard.records).flat());
      const liveByDigest = this.#liveMapFromRecords(records);
      return {
        rootSha256: checkpoint.root.wireSha256,
        rootPayload,
        records,
        shardsByPrefix,
        liveByDigest,
      };
    } finally {
      for (const bytes of shardPlain) {
        wipeBytes(bytes);
      }
    }
  }

  #preflightOpenedRoot(root: CatalogRootPayload): void {
    const rootBytes = canonicalizeJsonBytes(root as unknown as JsonValue);
    try {
      preflightCatalogRoot(rootBytes);
    } catch (err) {
      throw mapFailure(err, false);
    } finally {
      wipeBytes(rootBytes);
    }
    uniqueChildIdentities(root.references);
  }

  async #readbackLiveWitnesses(parent: ParentState, plan: CatalogPlan, newWitnessSha: string): Promise<void> {
    for (const live of plan.liveWitnesses) {
      if (live.digest === newWitnessSha) {
        continue;
      }
      const known = parent.liveByDigest.get(live.digest);
      if (known === undefined) {
        throw new BackupAbort("missing-object", true);
      }
      await this.#getByLocators(known.locators, known.digest, known.byteLength, true);
      this.#requireUnlocked(true);
    }
  }

  async #getAndOpenShard(reference: CatalogNonemptyReference, localUnsynced: boolean): Promise<void> {
    const receipt = await this.#getByLocators(
      reference.locators,
      reference.wireSha256,
      reference.wireByteLength,
      localUnsynced,
    );
    this.#requireUnlocked(localUnsynced);
    this.#vault.openCatalogNode(receipt.ownedReadback, { nodeType: "shard", reference });
    this.#requireUnlocked(localUnsynced);
  }

  async #journalPut(wire: Uint8Array, sha256: string, localUnsynced: boolean): Promise<void> {
    if (this.#journal === undefined) {
      throw new BackupAbort("missing-journal", localUnsynced);
    }
    this.#requireUnlocked(localUnsynced);
    this.#assertTime();
    await this.#journal.put({ wire, sha256 });
    this.#assertTime();
    this.#requireUnlocked(true);
  }

  async #putOrAdopt(wire: Uint8Array, sha256: string, localUnsynced: boolean): Promise<RemotePutReceipt> {
    this.#budgetOrThrow().reservePut(wire.byteLength);
    this.#assertTime();
    this.#requireUnlocked(localUnsynced);
    try {
      const receipt = await this.#session.putOwnedCiphertext(wire, sha256);
      this.#assertTime();
      this.#requireUnlocked(true);
      if (receipt.remoteReadbackVerified !== true) {
        throw new BackupAbort("corrupt-object", true);
      }
      return receipt;
    } catch (err) {
      this.#assertTime();
      this.#requireUnlocked(true);
      if (isLostCreate(err)) {
        return this.#adoptAfterLostCreate(wire, sha256);
      }
      throw mapFailure(err, true);
    }
  }

  async #adoptAfterLostCreate(wire: Uint8Array, sha256: string): Promise<RemotePutReceipt> {
    this.#budgetOrThrow().reserveList();
    this.#assertTime();
    const listed = await this.#session.listCiphertextCandidates();
    this.#assertTime();
    this.#requireUnlocked(true);
    if (listed.complete !== true) {
      throw new BackupAbort("provider-incomplete", true);
    }
    const name = `${sha256}.wpp`;
    const matches = listed.candidates.filter((item: CiphertextCandidate) => item.name === name);
    if (matches.length === 0) {
      throw new BackupAbort("provider-incomplete", true);
    }
    let adopted: RemotePutReceipt | undefined;
    const extra: GoogleDriveLocator[] = [];
    for (const match of matches.slice(0, BACKUP_LIMITS.maxLocatorsPerObject)) {
      try {
        const got = await this.#getExpected(
          locatorFromReceipt(this.#permissionId, match.fileId, null),
          sha256,
          wire.byteLength,
          true,
        );
        extra.push(locatorFromReceipt(this.#permissionId, match.fileId, null));
        if (adopted === undefined) {
          adopted = bindPutReceipt(got, sha256, wire.byteLength);
        }
      } catch {
        continue;
      }
    }
    void extra;
    if (adopted === undefined) {
      throw new BackupAbort("provider-incomplete", true);
    }
    return adopted;
  }

  async #getByLocators(
    locators: readonly CatalogV2Locator[],
    sha256: string,
    byteCount: number,
    localUnsynced: boolean,
  ): Promise<RemoteGetReceipt> {
    if (!Array.isArray(locators) || locators.length < 1 || locators.length > BACKUP_LIMITS.maxLocatorsPerObject) {
      throw new BackupAbort("schema", localUnsynced);
    }
    let last: BackupAbort | undefined;
    for (const locator of locators) {
      if (locator.provider !== "google-drive") {
        last = new BackupAbort("unsupported", localUnsynced);
        continue;
      }
      try {
        return await this.#getExpected(
          {
            provider: "google-drive",
            accountBinding: locator.accountBinding,
            objectId: locator.objectId,
            revisionId: locator.revisionId,
          },
          sha256,
          byteCount,
          localUnsynced,
        );
      } catch (err) {
        last = mapFailure(err, localUnsynced);
      }
    }
    throw last ?? new BackupAbort("missing-object", localUnsynced);
  }

  async #getExpected(
    locator: GoogleDriveLocator,
    sha256: string,
    byteCount: number,
    localUnsynced: boolean,
  ): Promise<RemoteGetReceipt> {
    if (locator.accountBinding.value !== this.#permissionId) {
      throw new BackupAbort("wrong-account", localUnsynced);
    }
    if (!FILE_ID_RE.test(locator.objectId)) {
      throw new BackupAbort("schema", localUnsynced);
    }
    this.#budgetOrThrow().reserveGet(byteCount);
    this.#assertTime();
    this.#requireUnlocked(localUnsynced);
    try {
      const receipt = await this.#session.getOwnedCiphertext({
        permissionId: locator.accountBinding.value,
        fileId: locator.objectId,
        sha256,
        byteCount,
      });
      this.#assertTime();
      this.#requireUnlocked(localUnsynced);
      return receipt;
    } catch (err) {
      this.#assertTime();
      this.#requireUnlocked(localUnsynced);
      const mapped = mapFailure(err, localUnsynced);
      if (mapped.reason === "corrupt-object") {
        throw new BackupAbort("missing-object", localUnsynced);
      }
      throw mapped;
    }
  }

  #collectRecords(records: readonly CatalogTaggedRecord[]): CatalogTaggedRecord[] {
    return isolatedJsonView(records as unknown as JsonValue) as unknown as CatalogTaggedRecord[];
  }

  #liveMapFromRecords(records: readonly CatalogTaggedRecord[]): Map<string, LiveWitnessEntry> {
    const snapshots = new Map<string, LiveWitnessEntry>();
    const tombstones = new Set<string>();
    for (const record of records) {
      if (record.recordKind === "tombstone") {
        const target = record.body.targetPackageSha256;
        if (typeof target === "string") {
          tombstones.add(target);
        }
      }
    }
    for (const record of records) {
      if (record.recordKind !== "snapshot") {
        continue;
      }
      const pack = record.body.package;
      if (pack === null || typeof pack !== "object" || Array.isArray(pack)) {
        continue;
      }
      const digest = (pack as { sha256?: unknown }).sha256;
      const byteLength = (pack as { byteLength?: unknown }).byteLength;
      const locators = record.body.locators;
      if (typeof digest !== "string" || typeof byteLength !== "number" || !Array.isArray(locators)) {
        continue;
      }
      if (tombstones.has(digest)) {
        continue;
      }
      snapshots.set(digest, {
        digest,
        byteLength,
        locators: isolatedJsonView(locators as unknown as JsonValue) as unknown as CatalogV2Locator[],
        record,
      });
    }
    return snapshots;
  }

  #installIndex(rootWireSha256: string, parent: ParentState): void {
    if (this.#index !== undefined && this.#index.rootWireSha256 !== rootWireSha256) {
      this.#index = undefined;
    }
    this.#index = {
      rootWireSha256,
      liveByDigest: parent.liveByDigest,
      records: parent.records,
    };
  }

  #requireCheckpoint(): BackupCheckpoint {
    if (this.#checkpoint === null) {
      throw new BackupAbort("checkpoint-required");
    }
    return this.#checkpoint;
  }

  #assertAccount(checkpoint: BackupCheckpoint): void {
    if (checkpoint.root.locator.accountBinding.value !== this.#permissionId) {
      throw new BackupAbort("wrong-account");
    }
  }

  #requireUnlocked(localUnsynced: boolean): void {
    if (this.#vault.locked) {
      this.#index = undefined;
      throw new BackupAbort("locked", localUnsynced);
    }
  }

  #assertTime(): void {
    this.#budgetOrThrow().assertTime(Date.now());
  }

  #budgetOrThrow(): OperationBudget {
    if (this.#budget === undefined) {
      throw new BackupAbort("interrupted");
    }
    return this.#budget;
  }

  #metrics() {
    return this.#budgetOrThrow().metrics();
  }

  #incompletePublish(reason: BackupIncompleteReason, localUnsynced: boolean): PublishResult {
    return {
      status: "incomplete",
      reason,
      previousCheckpoint: this.#checkpoint,
      localUnsynced,
    };
  }

  #incompleteRestore(reason: BackupIncompleteReason): RestoreResult {
    return {
      status: "incomplete",
      reason,
      previousCheckpoint: this.#checkpoint,
    };
  }
}

void wipeOptional;
