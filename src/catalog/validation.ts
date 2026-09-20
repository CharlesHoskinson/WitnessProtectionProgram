import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import {
  ERR_INPUT_TOO_LARGE,
  KernelError,
  LIMIT_METADATA_CANONICAL_BYTES,
  LIMIT_PLAINTEXT_BYTES,
  canonicalizeJson,
  canonicalizeJsonBytes,
  cloneJsonValue,
  copyOwnedBytes,
  isolatedJsonView,
  parseJsonBytes,
  wipeBytes,
  type JsonValue,
} from "../kernel/json.js";
import { assertCanonicalObjectSize, decodeId16 } from "../kernel/validation.js";
import type { OpenResult, SnapshotMetadata } from "../kernel/vault.js";
import {
  CatalogError,
  ERR_CATALOG_BINDING,
  ERR_CATALOG_CONFLICT,
  ERR_CATALOG_INPUT,
  ERR_CATALOG_LIMIT,
  ERR_CATALOG_REFERENCE,
  type Catalog,
  type CatalogConflict,
  type CatalogEntry,
  type Locator,
  type Observation,
  type RootUpdateReceiptEntry,
  type SnapshotEntry,
  type TombstoneEntry,
} from "./types.js";

export const CATALOG_MAX_INPUTS = 16;
export const CATALOG_MAX_PARENTS = 16;
export const CATALOG_MAX_ENTRIES = 1000;
export const CATALOG_MAX_OBSERVATIONS = 4000;
export const CATALOG_MAX_LOCATORS = 16;
export const CATALOG_RESULT_BUDGET_BYTES = LIMIT_PLAINTEXT_BYTES;

const CATALOG_RESULT_RECORD_OVERHEAD = 64;

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const SCHEMA_DIR = new URL("../../docs/reference/schemas/", import.meta.url);

function loadSchema(name: string): object {
  const text = readFileSync(fileURLToPath(new URL(name, SCHEMA_DIR)), "utf8");
  return JSON.parse(text) as object;
}

const ajv = new Ajv2020({
  strict: true,
  strictTypes: false,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  validateFormats: true,
  allErrors: false,
});

const addFormats: FormatsPlugin = addFormatsModule.default;
addFormats(ajv);
ajv.addSchema(loadSchema("catalog-v1.schema.json"));

const validateCatalogSchema = compileRef("urn:wpp:catalog-v1");
const validateSnapshotEntrySchema = compileRef("urn:wpp:catalog-v1#/$defs/snapshotEntry");

function compileRef(ref: string): ValidateFunction {
  const existing = ajv.getSchema(ref);
  if (existing !== undefined) {
    return existing as ValidateFunction;
  }
  return ajv.compile({ $ref: ref });
}

const CATALOG_PUBLIC_CODES: ReadonlySet<string> = new Set([
  ERR_CATALOG_INPUT,
  ERR_CATALOG_LIMIT,
  ERR_CATALOG_REFERENCE,
  ERR_CATALOG_CONFLICT,
  ERR_CATALOG_BINDING,
]);

function ownDataString(value: unknown, key: string): string | undefined {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return undefined;
  }
  try {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc === undefined || typeof desc.get === "function") {
      return undefined;
    }
    if (typeof desc.value !== "string") {
      return undefined;
    }
    return desc.value;
  } catch {
    return undefined;
  }
}

function safeInstanceof(
  value: unknown,
  ctor: typeof CatalogError | typeof KernelError,
): boolean {
  try {
    return value instanceof ctor;
  } catch {
    return false;
  }
}

function classifyPublicInputError(err: unknown): string {
  try {
    if (safeInstanceof(err, KernelError)) {
      const code = ownDataString(err, "code");
      if (code === ERR_INPUT_TOO_LARGE) {
        return ERR_CATALOG_LIMIT;
      }
    }
  } catch {
    return ERR_CATALOG_INPUT;
  }
  return ERR_CATALOG_INPUT;
}

export function mapPublicInputError(err: unknown): never {
  throw new CatalogError(classifyPublicInputError(err));
}

function classifyKernelError(err: unknown, binding: boolean): string {
  const fallback = binding ? ERR_CATALOG_BINDING : ERR_CATALOG_INPUT;
  try {
    if (safeInstanceof(err, CatalogError)) {
      const code = ownDataString(err, "code");
      if (code !== undefined && CATALOG_PUBLIC_CODES.has(code)) {
        return code;
      }
      return fallback;
    }
    if (safeInstanceof(err, KernelError)) {
      const code = ownDataString(err, "code");
      if (code === ERR_INPUT_TOO_LARGE) {
        return ERR_CATALOG_LIMIT;
      }
      return fallback;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function mapKernelError(err: unknown, binding = false): never {
  throw new CatalogError(classifyKernelError(err, binding));
}

export function compareLex(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

export function canonicalKey(value: JsonValue): string {
  return canonicalizeJson(value);
}

export function assertDigest(value: string): string {
  if (!DIGEST_PATTERN.test(value)) {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  return value;
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
}

function assertArrayBound(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value)) {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  if (value.length > max) {
    throw new CatalogError(ERR_CATALOG_LIMIT);
  }
  return value;
}

function runSchema(validate: ValidateFunction, value: unknown): void {
  if (!validate(value)) {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
}

function asJson(value: unknown): JsonValue {
  return value as JsonValue;
}

function cloneEntry<T extends CatalogEntry | Observation | Locator>(value: T): T {
  return cloneJsonValue(asJson(value)) as unknown as T;
}

function snapshotCore(entry: SnapshotEntry): JsonValue {
  return {
    entryKind: entry.entryKind,
    package: entry.package as unknown as JsonValue,
    metadata: entry.metadata as unknown as JsonValue,
    label: entry.label,
  };
}

function uniqueLocatorRefs(locators: readonly Locator[]): Locator[] {
  const byKey = new Map<string, Locator>();
  for (const locator of locators) {
    const key = canonicalKey(asJson(locator));
    if (!byKey.has(key)) {
      byKey.set(key, locator);
    }
  }
  if (byKey.size > CATALOG_MAX_LOCATORS) {
    throw new CatalogError(ERR_CATALOG_LIMIT);
  }
  return [...byKey.values()].sort((left, right) =>
    compareLex(canonicalKey(asJson(left)), canonicalKey(asJson(right))),
  );
}

function snapshotClaimView(entry: SnapshotEntry, locators: readonly Locator[]): JsonValue {
  return {
    entryKind: entry.entryKind,
    package: entry.package as unknown as JsonValue,
    metadata: entry.metadata as unknown as JsonValue,
    label: entry.label,
    locators: locators as unknown as JsonValue[],
  };
}

function sortParents(parents: readonly string[]): string[] {
  return [...parents].sort(compareLex);
}

function sortEntries(entries: CatalogEntry[]): CatalogEntry[] {
  return entries.sort((left, right) => {
    const kind = compareLex(left.entryKind, right.entryKind);
    if (kind !== 0) {
      return kind;
    }
    const id = compareLex(selectedIdentity(left), selectedIdentity(right));
    if (id !== 0) {
      return id;
    }
    return compareLex(canonicalKey(asJson(left)), canonicalKey(asJson(right)));
  });
}

function sortObservations(observations: Observation[]): Observation[] {
  return observations.sort((left, right) => {
    const id = compareLex(left.observationId, right.observationId);
    if (id !== 0) {
      return id;
    }
    return compareLex(canonicalKey(asJson(left)), canonicalKey(asJson(right)));
  });
}

export function selectedIdentity(entry: CatalogEntry): string {
  if (entry.entryKind === "snapshot") {
    return entry.package.sha256;
  }
  if (entry.entryKind === "tombstone") {
    return entry.eventId;
  }
  return entry.receiptId;
}

function sortConflicts(conflicts: CatalogConflict[]): CatalogConflict[] {
  for (const conflict of conflicts) {
    conflict.claims.sort((left, right) => compareLex(canonicalKey(left), canonicalKey(right)));
  }
  conflicts.sort((left, right) => {
    const kind = compareLex(left.kind, right.kind);
    if (kind !== 0) {
      return kind;
    }
    return compareLex(left.identity, right.identity);
  });
  return conflicts;
}

interface PlannedConflict {
  kind: CatalogConflict["kind"];
  identity: string;
  claims: JsonValue[];
}

function accountPlannedConflict(budget: CatalogResultBudget | undefined, planned: PlannedConflict): void {
  if (budget === undefined) {
    return;
  }
  budget.addCanonical(planned.kind);
  budget.addCanonical(planned.identity);
  for (const claim of planned.claims) {
    budget.addCanonical(claim);
  }
}

function clonePlannedConflict(planned: PlannedConflict): CatalogConflict {
  return {
    kind: planned.kind,
    identity: planned.identity,
    claims: planned.claims.map((claim) => cloneJsonValue(claim)),
  };
}

function emptyMergedCatalog(parents: readonly string[]): Catalog {
  return {
    payloadVersion: 1,
    parents: sortParents(parents),
    entries: [],
    observations: [],
  };
}

export interface MergedCatalogParts {
  catalog: Catalog;
  conflicts: CatalogConflict[];
}

export function mergeCatalogRecords(
  catalogs: readonly Catalog[],
  parents: readonly string[],
  budget?: CatalogResultBudget,
  materializeUnion = true,
): MergedCatalogParts {
  const snapshotGroups = new Map<string, Map<string, { entry: SnapshotEntry; locators: Locator[] }>>();
  const tombstoneGroups = new Map<string, Map<string, TombstoneEntry>>();
  const receiptGroups = new Map<string, Map<string, RootUpdateReceiptEntry>>();
  const observationGroups = new Map<string, Map<string, Observation>>();

  for (const catalog of catalogs) {
    for (const entry of catalog.entries) {
      if (entry.entryKind === "snapshot") {
        const digest = entry.package.sha256;
        let cores = snapshotGroups.get(digest);
        if (cores === undefined) {
          cores = new Map();
          snapshotGroups.set(digest, cores);
        }
        const coreKey = canonicalKey(snapshotCore(entry));
        const existing = cores.get(coreKey);
        if (existing === undefined) {
          cores.set(coreKey, {
            entry,
            locators: [...entry.locators],
          });
        } else {
          existing.locators.push(...entry.locators);
        }
        continue;
      }
      if (entry.entryKind === "tombstone") {
        let bodies = tombstoneGroups.get(entry.eventId);
        if (bodies === undefined) {
          bodies = new Map();
          tombstoneGroups.set(entry.eventId, bodies);
        }
        bodies.set(canonicalKey(asJson(entry)), entry);
        continue;
      }
      let bodies = receiptGroups.get(entry.receiptId);
      if (bodies === undefined) {
        bodies = new Map();
        receiptGroups.set(entry.receiptId, bodies);
      }
      bodies.set(canonicalKey(asJson(entry)), entry);
    }
    for (const observation of catalog.observations) {
      let bodies = observationGroups.get(observation.observationId);
      if (bodies === undefined) {
        bodies = new Map();
        observationGroups.set(observation.observationId, bodies);
      }
      bodies.set(canonicalKey(asJson(observation)), observation);
    }
  }

  const plannedConflicts: PlannedConflict[] = [];
  const unionEntries: JsonValue[] = [];
  const unionObservations: JsonValue[] = [];
  let entryBodies = 0;
  let observationBodies = 0;

  for (const [digest, cores] of snapshotGroups) {
    entryBodies += cores.size;
    const views: JsonValue[] = [];
    for (const item of cores.values()) {
      views.push(snapshotClaimView(item.entry, uniqueLocatorRefs(item.locators)));
    }
    if (views.length > 1) {
      plannedConflicts.push({
        kind: "snapshot-claim",
        identity: digest,
        claims: views,
      });
      continue;
    }
    const only = views[0];
    if (only === undefined) {
      throw new CatalogError(ERR_CATALOG_INPUT);
    }
    unionEntries.push(only);
  }

  for (const [eventId, bodies] of tombstoneGroups) {
    entryBodies += bodies.size;
    const values = [...bodies.values()].map((entry) => asJson(entry));
    if (values.length > 1) {
      plannedConflicts.push({
        kind: "event-claim",
        identity: eventId,
        claims: values,
      });
      continue;
    }
    const only = values[0];
    if (only === undefined) {
      throw new CatalogError(ERR_CATALOG_INPUT);
    }
    unionEntries.push(only);
  }

  for (const [receiptId, bodies] of receiptGroups) {
    entryBodies += bodies.size;
    const values = [...bodies.values()].map((entry) => asJson(entry));
    if (values.length > 1) {
      plannedConflicts.push({
        kind: "receipt-claim",
        identity: receiptId,
        claims: values,
      });
      continue;
    }
    const only = values[0];
    if (only === undefined) {
      throw new CatalogError(ERR_CATALOG_INPUT);
    }
    unionEntries.push(only);
  }

  for (const [observationId, bodies] of observationGroups) {
    observationBodies += bodies.size;
    const values = [...bodies.values()].map((observation) => asJson(observation));
    if (values.length > 1) {
      plannedConflicts.push({
        kind: "observation-claim",
        identity: observationId,
        claims: values,
      });
      continue;
    }
    const only = values[0];
    if (only === undefined) {
      throw new CatalogError(ERR_CATALOG_INPUT);
    }
    unionObservations.push(only);
  }

  if (entryBodies > CATALOG_MAX_ENTRIES || observationBodies > CATALOG_MAX_OBSERVATIONS) {
    throw new CatalogError(ERR_CATALOG_LIMIT);
  }
  if (parents.length > CATALOG_MAX_PARENTS) {
    throw new CatalogError(ERR_CATALOG_LIMIT);
  }

  const sortedParents = sortParents(parents);
  const retainUnion = materializeUnion && plannedConflicts.length === 0;
  if (retainUnion) {
    if (budget !== undefined) {
      budget.addCanonical(1);
      for (const parent of sortedParents) {
        budget.addCanonical(parent);
      }
      for (const entry of unionEntries) {
        budget.addCanonical(entry);
      }
      for (const observation of unionObservations) {
        budget.addCanonical(observation);
      }
    }
    const catalog: Catalog = {
      payloadVersion: 1,
      parents: sortedParents,
      entries: sortEntries(unionEntries.map((entry) => cloneJsonValue(entry) as unknown as CatalogEntry)),
      observations: sortObservations(
        unionObservations.map((observation) => cloneJsonValue(observation) as unknown as Observation),
      ),
    };
    return {
      catalog,
      conflicts: [],
    };
  }

  for (const planned of plannedConflicts) {
    accountPlannedConflict(budget, planned);
  }
  const conflicts = sortConflicts(plannedConflicts.map(clonePlannedConflict));
  return {
    catalog: emptyMergedCatalog(sortedParents),
    conflicts,
  };
}

function locatorIndex(entry: SnapshotEntry): Set<string> {
  const keys = new Set<string>();
  for (const locator of entry.locators) {
    keys.add(canonicalKey(asJson(locator)));
  }
  return keys;
}

export function assertReceiptEpoch(entry: RootUpdateReceiptEntry): void {
  if (entry.retainedOldEpochs.includes(entry.newActiveEpoch)) {
    throw new CatalogError(ERR_CATALOG_REFERENCE);
  }
}

export function assertObservationSemantics(catalog: Catalog): void {
  const snapshots = new Map<string, SnapshotEntry>();
  for (const entry of catalog.entries) {
    if (entry.entryKind === "snapshot") {
      snapshots.set(entry.package.sha256, entry);
    }
  }
  for (const observation of catalog.observations) {
    const snapshot = snapshots.get(observation.packageSha256);
    if (snapshot === undefined) {
      throw new CatalogError(ERR_CATALOG_REFERENCE);
    }
    if (!locatorIndex(snapshot).has(canonicalKey(asJson(observation.locator)))) {
      throw new CatalogError(ERR_CATALOG_REFERENCE);
    }
    const outcome = observation.outcome;
    if (outcome.status === "readback-authenticated") {
      if (outcome.observedSha256 !== snapshot.package.sha256 || outcome.byteLength !== snapshot.package.byteLength) {
        throw new CatalogError(ERR_CATALOG_REFERENCE);
      }
    }
    if (outcome.status === "digest-mismatch") {
      if (outcome.observedSha256 === snapshot.package.sha256) {
        throw new CatalogError(ERR_CATALOG_REFERENCE);
      }
    }
  }
}

function assertMetadataLimits(catalog: Catalog): void {
  for (const entry of catalog.entries) {
    if (entry.entryKind !== "snapshot") {
      continue;
    }
    try {
      assertCanonicalObjectSize(entry.metadata as unknown as JsonValue, LIMIT_METADATA_CANONICAL_BYTES);
    } catch (err) {
      mapKernelError(err);
    }
  }
}

function assertReceipts(catalog: Catalog): void {
  for (const entry of catalog.entries) {
    if (entry.entryKind === "root-update-receipt") {
      assertReceiptEpoch(entry);
    }
  }
}

function cheapBoundCheck(parsed: unknown): void {
  assertPlainObject(parsed);
  assertArrayBound(parsed.parents, CATALOG_MAX_PARENTS);
  const entries = assertArrayBound(parsed.entries, CATALOG_MAX_ENTRIES);
  assertArrayBound(parsed.observations, CATALOG_MAX_OBSERVATIONS);
  for (const entry of entries) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new CatalogError(ERR_CATALOG_INPUT);
    }
    const locators = (entry as { locators?: unknown }).locators;
    if (locators !== undefined) {
      assertArrayBound(locators, CATALOG_MAX_LOCATORS);
    }
  }
}

export function catalogFromParsed(parsed: unknown): Catalog {
  cheapBoundCheck(parsed);
  runSchema(validateCatalogSchema, parsed);
  const raw = parsed as Catalog;
  assertMetadataLimits(raw);
  const merged = mergeCatalogRecords([raw], raw.parents);
  if (merged.conflicts.length > 0) {
    throw new CatalogError(ERR_CATALOG_CONFLICT);
  }
  assertReceipts(merged.catalog);
  assertObservationSemantics(merged.catalog);
  return isolatedJsonView(asJson(merged.catalog)) as unknown as Catalog;
}

export function parseCatalog(payloadUtf8: Uint8Array): Catalog {
  let owned: Uint8Array | undefined;
  try {
    owned = copyOwnedBytes(payloadUtf8, LIMIT_PLAINTEXT_BYTES);
  } catch (err) {
    return mapPublicInputError(err);
  }
  try {
    const parsed = parseJsonBytes(owned, LIMIT_PLAINTEXT_BYTES);
    return catalogFromParsed(parsed);
  } catch (err) {
    return mapKernelError(err);
  } finally {
    if (owned !== undefined) {
      wipeBytes(owned);
    }
  }
}

function copyString(value: unknown): string {
  if (typeof value !== "string") {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  return value;
}

function copyInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  return value;
}

function copyJsonObject(value: unknown): JsonValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  return cloneJsonValue(value as JsonValue);
}

function ownedOpenResult(value: unknown): OpenResult {
  assertPlainObject(value);
  const headerValue = copyJsonObject(value.header);
  const metadataValue = copyJsonObject(value.metadata);
  const content = cloneJsonValue(value.content as JsonValue);
  const packageSha256 = copyString(value.packageSha256);
  assertPlainObject(headerValue);
  return {
    header: headerValue as unknown as OpenResult["header"],
    metadata: isolatedJsonView(metadataValue) as unknown as SnapshotMetadata,
    content: isolatedJsonView(content),
    packageSha256,
  };
}

function parseSnapshotEntry(entryUtf8: Uint8Array): SnapshotEntry {
  let owned: Uint8Array | undefined;
  try {
    owned = copyOwnedBytes(entryUtf8, LIMIT_PLAINTEXT_BYTES);
  } catch (err) {
    return mapPublicInputError(err);
  }
  try {
    const parsed = parseJsonBytes(owned, LIMIT_PLAINTEXT_BYTES);
    runSchema(validateSnapshotEntrySchema, parsed);
    const entry = parsed as unknown as SnapshotEntry;
    try {
      assertCanonicalObjectSize(entry.metadata as unknown as JsonValue, LIMIT_METADATA_CANONICAL_BYTES);
    } catch (err) {
      return mapKernelError(err);
    }
    return cloneEntry(entry);
  } catch (err) {
    return mapKernelError(err);
  } finally {
    if (owned !== undefined) {
      wipeBytes(owned);
    }
  }
}

function headerString(header: OpenResult["header"], key: keyof OpenResult["header"]): string {
  return copyString(header[key]);
}

export function verifySnapshotClaim(
  entryUtf8: Uint8Array,
  expectedVaultId: string,
  authenticated: { opened: OpenResult; wireByteLength: number },
): void {
  if (typeof expectedVaultId !== "string") {
    throw new CatalogError(ERR_CATALOG_BINDING);
  }
  try {
    decodeId16(expectedVaultId);
  } catch {
    throw new CatalogError(ERR_CATALOG_BINDING);
  }

  let wireByteLength: number;
  let opened: OpenResult;
  try {
    if (authenticated === null || typeof authenticated !== "object" || Array.isArray(authenticated)) {
      throw new CatalogError(ERR_CATALOG_INPUT);
    }
    wireByteLength = copyInteger(authenticated.wireByteLength);
    opened = ownedOpenResult(authenticated.opened);
  } catch {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }

  try {
    const entry = parseSnapshotEntry(entryUtf8);
    const header = opened.header;
    const mismatches = [
      opened.packageSha256 !== entry.package.sha256,
      wireByteLength !== entry.package.byteLength,
      headerString(header, "vaultId") !== expectedVaultId,
      headerString(header, "rootEpoch") !== entry.package.rootEpoch,
      headerString(header, "scopeId") !== entry.package.scopeId,
      headerString(header, "recordId") !== entry.package.recordId,
      headerString(header, "generationId") !== entry.package.generationId,
      headerString(header, "kind") !== "snapshot",
      canonicalKey(asJson(opened.metadata)) !== canonicalKey(asJson(entry.metadata)),
    ];
    for (const mismatch of mismatches) {
      if (mismatch) {
        throw new CatalogError(ERR_CATALOG_BINDING);
      }
    }
  } catch (err) {
    mapKernelError(err);
  }
}

export function isolatedCatalog(catalog: Catalog): Catalog {
  return isolatedJsonView(asJson(catalog)) as unknown as Catalog;
}

export function catalogBytes(catalog: Catalog): Uint8Array {
  return Buffer.from(canonicalizeJson(asJson(catalog)), "utf8");
}

export class CatalogResultBudget {
  #used = 0;

  addCanonical(value: JsonValue): void {
    let bytes: Uint8Array | undefined;
    try {
      bytes = canonicalizeJsonBytes(value);
      this.#add(bytes.byteLength);
      this.#add(CATALOG_RESULT_RECORD_OVERHEAD);
    } catch (err) {
      mapKernelError(err);
    } finally {
      if (bytes !== undefined) {
        wipeBytes(bytes);
      }
    }
  }

  #add(n: number): void {
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new CatalogError(ERR_CATALOG_INPUT);
    }
    if (n > CATALOG_RESULT_BUDGET_BYTES - this.#used) {
      throw new CatalogError(ERR_CATALOG_LIMIT);
    }
    this.#used += n;
  }
}

export function accountCatalogResultBytes(budget: CatalogResultBudget, catalog: Catalog): void {
  budget.addCanonical(catalog.payloadVersion);
  for (const parent of catalog.parents) {
    budget.addCanonical(parent);
  }
  for (const entry of catalog.entries) {
    budget.addCanonical(asJson(entry));
  }
  for (const observation of catalog.observations) {
    budget.addCanonical(asJson(observation));
  }
}
