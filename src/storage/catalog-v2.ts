import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import {
  ERR_BASE64URL,
  ERR_BOM,
  ERR_INPUT_TOO_LARGE,
  ERR_JSON_CANONICAL,
  ERR_JSON_COMMENT,
  ERR_JSON_DEPTH,
  ERR_JSON_DUPLICATE_KEY,
  ERR_JSON_EMPTY,
  ERR_JSON_NONFINITE,
  ERR_JSON_PARSE,
  ERR_JSON_SURROGATE,
  ERR_JSON_TRAILING_COMMA,
  ERR_JSON_TRAILING_TOKEN,
  ERR_NONCANONICAL,
  ERR_SCHEMA,
  ERR_UNKNOWN_FIELD,
  ERR_UTF8,
  KernelError,
  LIMIT_METADATA_CANONICAL_BYTES,
  assertByteCeiling,
  assertCanonicalPayloadBytes,
  canonicalizeJson,
  canonicalizeJsonBytes,
  copyOwnedBytes,
  decodeUtf8Fatal,
  encodeUtf8,
  isolatedJsonView,
  parseJsonText,
  rejectBom,
  wipeBytes,
  type JsonValue,
} from "../kernel/json.js";
import { sha256Hex } from "../kernel/crypto.js";
import { assertCanonicalObjectSize, decodeId16, decodeId32 } from "../kernel/validation.js";

export const ERR_CATALOG_ROLE = "WPP_CATALOG_ROLE";
export const ERR_CATALOG_CAPACITY = "WPP_CATALOG_CAPACITY";
export const ERR_CATALOG_COVER = "WPP_CATALOG_COVER";
export const ERR_CATALOG_REFERENCE = "WPP_CATALOG_REFERENCE";
export const ERR_CATALOG_DUPLICATE = "WPP_CATALOG_DUPLICATE";

export const CATALOG_ROUTE_DOMAIN = "WPP/catalog-route/v2";

export const CATALOG_V2_LIMITS = Object.freeze({
  rootPlaintextBytes: 4 * 1024 * 1024,
  rootWireBytes: 8 * 1024 * 1024,
  shardPlaintextBytes: 1 * 1024 * 1024,
  shardWireBytes: 2 * 1024 * 1024,
  shardTargetBytes: 256 * 1024,
  cumulativeShardPlaintextBytes: 64 * 1024 * 1024,
  planInputBytes: 64 * 1024 * 1024,
  maxEntries: 10_000,
  maxObservations: 40_000,
  maxRecords: 50_000,
  maxReferences: 1024,
  maxParents: 16,
  maxLocators: 4,
  maxPrefixDepth: 64,
  maxRequiredEpochs: 256,
  maxRecordsPerLeaf: 1024,
  liveWitnessWireBytes: 512 * 1024 * 1024,
  maxPackageBytes: 24 * 1024 * 1024,
});

const HEX_DIGITS = "0123456789abcdef";
const RECORD_KINDS = ["snapshot", "tombstone", "root-update-receipt", "observation"] as const;

export type CatalogNodeRole = "root" | "shard";
export type CatalogRecordKind = (typeof RECORD_KINDS)[number];

export interface CatalogV2Locator {
  provider: "google-drive";
  accountBinding: {
    scheme: "google-drive-permission-id";
    value: string;
  };
  objectId: string;
  revisionId: string | null;
}

export interface CatalogEmptyReference {
  prefix: string;
  empty: true;
}

export interface CatalogNonemptyReference {
  prefix: string;
  empty: false;
  recordId: string;
  generationId: string;
  rootEpoch: string;
  wireSha256: string;
  wireByteLength: number;
  plaintextByteLength: number;
  entryCount: number;
  observationCount: number;
  canonicalRecordsSha256: string;
  locators: CatalogV2Locator[];
}

export type CatalogReference = CatalogEmptyReference | CatalogNonemptyReference;

export interface CatalogRootPayload {
  payloadVersion: 2;
  nodeType: "root";
  partitionVersion: 1;
  parents: string[];
  entryCount: number;
  observationCount: number;
  requiredEpochs: string[];
  references: CatalogReference[];
}

export interface CatalogTaggedRecord {
  recordKind: CatalogRecordKind;
  body: { [key: string]: JsonValue };
}

export interface CatalogShardPayload {
  payloadVersion: 2;
  nodeType: "shard";
  partitionVersion: 1;
  prefix: string;
  records: CatalogTaggedRecord[];
}

export interface ParsedCatalogRoot {
  role: "root";
  payload: CatalogRootPayload;
}

export interface ParsedCatalogShard {
  role: "shard";
  payload: CatalogShardPayload;
}

export type ParsedCatalogNode = ParsedCatalogRoot | ParsedCatalogShard;

export interface PlannedEmptyLeaf {
  prefix: string;
  empty: true;
}

export interface PlannedShardLeaf {
  prefix: string;
  empty: false;
  payloadUtf8: Uint8Array;
  plaintextByteLength: number;
  entryCount: number;
  observationCount: number;
  canonicalRecordsSha256: string;
}

export type PlannedLeaf = PlannedEmptyLeaf | PlannedShardLeaf;

export interface LiveWitness {
  digest: string;
  byteLength: number;
}

export interface CatalogPlan {
  leaves: readonly PlannedLeaf[];
  entryCount: number;
  observationCount: number;
  requiredEpochs: readonly string[];
  cumulativePlaintextBytes: number;
  liveWitnesses: readonly LiveWitness[];
  liveWitnessWireBytes: number;
  unresolvedTombstoneLive: readonly string[];
  liveRecordForks: readonly string[];
}

export interface CatalogRevision {
  root: CatalogRootPayload;
  shards: readonly CatalogShardPayload[];
  liveWitnesses: readonly LiveWitness[];
  liveWitnessWireBytes: number;
  unresolvedTombstoneLive: readonly string[];
  liveRecordForks: readonly string[];
}

export interface CatalogRootPreflight {
  root: CatalogRootPayload;
  declaredEntryCount: number;
  declaredObservationCount: number;
  declaredShardPlaintextBytes: number;
  nonemptyReferenceCount: number;
}

interface RoutedRecord {
  record: CatalogTaggedRecord;
  recordKind: CatalogRecordKind;
  identity: string;
  routeHash: string;
}

interface WorkLeaf {
  prefix: string;
  records: RoutedRecord[];
}

interface SnapshotIndex {
  digest: string;
  byteLength: number;
  locatorsCanonical: Set<string>;
  rootEpoch: string;
  scopeId: string;
  recordId: string;
  generationId: string;
}

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
ajv.addSchema(loadSchema("catalog-v2.schema.json"));

const validateRootSchema = compileRef("urn:wpp:catalog-v2#/$defs/catalogRoot");
const validateShardSchema = compileRef("urn:wpp:catalog-v2#/$defs/catalogShard");
const validateRecordArraySchema = compileRef("urn:wpp:catalog-v2#/$defs/taggedRecordArray");

function compileRef(ref: string): ValidateFunction {
  const existing = ajv.getSchema(ref);
  if (existing !== undefined) {
    return existing as ValidateFunction;
  }
  return ajv.compile({ $ref: ref });
}

const INTERNAL_STATIC_CODES = Object.freeze([
  ERR_SCHEMA,
  ERR_CATALOG_ROLE,
  ERR_CATALOG_CAPACITY,
  ERR_CATALOG_COVER,
  ERR_CATALOG_REFERENCE,
  ERR_CATALOG_DUPLICATE,
  ERR_BOM,
  ERR_UTF8,
  ERR_JSON_PARSE,
  ERR_JSON_COMMENT,
  ERR_JSON_TRAILING_COMMA,
  ERR_JSON_EMPTY,
  ERR_JSON_DEPTH,
  ERR_JSON_DUPLICATE_KEY,
  ERR_JSON_TRAILING_TOKEN,
  ERR_JSON_SURROGATE,
  ERR_JSON_NONFINITE,
  ERR_JSON_CANONICAL,
  ERR_UNKNOWN_FIELD,
  ERR_BASE64URL,
  ERR_NONCANONICAL,
  ERR_INPUT_TOO_LARGE,
]);

const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

function knownInternalCode(candidate: unknown): string | undefined {
  if (typeof candidate !== "string") {
    return undefined;
  }
  for (const code of INTERNAL_STATIC_CODES) {
    if (candidate === code) {
      return code;
    }
  }
  return undefined;
}

function staticRethrow(err: unknown, fallback: string): never {
  let code = fallback;
  try {
    const isKernel = err instanceof KernelError;
    if (isKernel) {
      const mapped = knownInternalCode((err as KernelError).code);
      if (mapped !== undefined) {
        code = mapped;
      }
    }
  } catch {
    code = fallback;
  }
  throw new KernelError(code);
}

function runGuarded<T>(fn: () => T, fallback: string): T {
  try {
    return fn();
  } catch (err) {
    staticRethrow(err, fallback);
  }
}

function failCallerInspection(): never {
  throw new KernelError(ERR_SCHEMA);
}

function guardedIsArray(input: unknown): input is unknown[] {
  try {
    return Array.isArray(input);
  } catch {
    failCallerInspection();
  }
}

function guardedArrayLength(input: unknown): number {
  if (!guardedIsArray(input)) {
    throw new KernelError(ERR_SCHEMA);
  }
  let length: unknown;
  try {
    length = input.length;
  } catch {
    failCallerInspection();
  }
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
    throw new KernelError(ERR_SCHEMA);
  }
  if (length > CATALOG_V2_LIMITS.maxReferences) {
    throw new KernelError(ERR_CATALOG_CAPACITY);
  }
  return length;
}

function guardedIndex(list: unknown[], index: number): unknown {
  try {
    return list[index];
  } catch {
    failCallerInspection();
  }
}

function guardedInputByteLength(value: unknown): number {
  try {
    if (!(value instanceof Uint8Array)) {
      throw new KernelError(ERR_SCHEMA);
    }
    if (typeof TYPED_ARRAY_BYTE_LENGTH !== "function") {
      throw new KernelError(ERR_SCHEMA);
    }
    const length = TYPED_ARRAY_BYTE_LENGTH.call(value);
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
      throw new KernelError(ERR_SCHEMA);
    }
    return length;
  } catch {
    failCallerInspection();
  }
}

function copyCallerBytes(value: unknown, maxBytes: number): Uint8Array {
  try {
    return copyOwnedBytes(value as Uint8Array, maxBytes);
  } catch {
    failCallerInspection();
  }
}

function rejectCallerByteTraps(bytes: Uint8Array): void {
  try {
    assertByteCeiling(bytes, Number.MAX_SAFE_INTEGER);
  } catch {
    failCallerInspection();
  }
}

function ownShardPayloads(
  input: unknown,
  expectedCount: number,
  declaredPlaintextBytes: number,
): Uint8Array[] {
  const length = guardedArrayLength(input);
  if (length !== expectedCount) {
    throw new KernelError(ERR_CATALOG_COVER);
  }
  const budget = Math.min(declaredPlaintextBytes, CATALOG_V2_LIMITS.cumulativeShardPlaintextBytes);
  const list = input as unknown[];
  const owned: Uint8Array[] = [];
  let total = 0;
  try {
    for (let i = 0; i < length; i += 1) {
      if (total >= budget) {
        throw new KernelError(ERR_CATALOG_CAPACITY);
      }
      const item = guardedIndex(list, i);
      const itemLen = guardedInputByteLength(item);
      if (itemLen > CATALOG_V2_LIMITS.shardPlaintextBytes) {
        throw new KernelError(ERR_CATALOG_CAPACITY);
      }
      if (total + itemLen > budget) {
        throw new KernelError(ERR_CATALOG_CAPACITY);
      }
      const copy = copyCallerBytes(item, CATALOG_V2_LIMITS.shardPlaintextBytes);
      let ownedLen = 0;
      try {
        ownedLen = copy.byteLength;
      } catch {
        wipeBytes(copy);
        failCallerInspection();
      }
      if (ownedLen !== itemLen || total + ownedLen > budget) {
        wipeBytes(copy);
        throw new KernelError(ERR_CATALOG_CAPACITY);
      }
      total += ownedLen;
      owned.push(copy);
    }
    if (total !== declaredPlaintextBytes) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
    return owned;
  } catch (err) {
    for (const buffer of owned) {
      wipeBytes(buffer);
    }
    staticRethrow(err, ERR_SCHEMA);
  }
}

function runSchema(validate: ValidateFunction, value: unknown): void {
  if (!validate(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
}

function parseCanonicalJson(bytes: Uint8Array, maxBytes: number): JsonValue {
  rejectCallerByteTraps(bytes);
  assertByteCeiling(bytes, maxBytes);
  const owned = copyCallerBytes(bytes, maxBytes);
  try {
    rejectBom(owned);
    const text = decodeUtf8Fatal(owned);
    const parsed = parseJsonText(text);
    assertCanonicalPayloadBytes(owned, parsed);
    return parsed;
  } finally {
    wipeBytes(owned);
  }
}

function hashCanonical(value: JsonValue): string {
  const bytes = canonicalizeJsonBytes(value);
  try {
    return sha256Hex(bytes);
  } finally {
    wipeBytes(bytes);
  }
}

function canonicalUtf8(value: JsonValue): Uint8Array {
  return canonicalizeJsonBytes(value);
}

function assertPlainObject(value: unknown): asserts value is { [key: string]: unknown } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new KernelError(ERR_SCHEMA);
  }
}

function assertRecordKind(value: unknown): CatalogRecordKind {
  if (
    value === "snapshot" ||
    value === "tombstone" ||
    value === "root-update-receipt" ||
    value === "observation"
  ) {
    return value;
  }
  throw new KernelError(ERR_SCHEMA);
}

function assertSortedUnique(items: readonly string[], code: string): void {
  let previous: string | undefined;
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== "string") {
      throw new KernelError(ERR_SCHEMA);
    }
    if (seen.has(item)) {
      throw new KernelError(code);
    }
    seen.add(item);
    if (previous !== undefined && item <= previous) {
      throw new KernelError(code);
    }
    previous = item;
  }
}

function locatorCanonical(locator: unknown): string {
  return canonicalizeJson(locator as JsonValue);
}

export function catalogRouteCanonical(recordKind: string, identity: string): string {
  if (typeof recordKind !== "string" || typeof identity !== "string") {
    throw new KernelError(ERR_SCHEMA);
  }
  return canonicalizeJson([CATALOG_ROUTE_DOMAIN, recordKind, identity]);
}

export function catalogRouteHash(recordKind: string, identity: string): string {
  const canonical = catalogRouteCanonical(recordKind, identity);
  return sha256Hex(encodeUtf8(canonical));
}

function selectedIdentity(recordKind: CatalogRecordKind, body: { [key: string]: unknown }): string {
  switch (recordKind) {
    case "snapshot": {
      assertPlainObject(body.package);
      const digest = body.package.sha256;
      if (typeof digest !== "string") {
        throw new KernelError(ERR_SCHEMA);
      }
      return digest;
    }
    case "tombstone": {
      const eventId = body.eventId;
      if (typeof eventId !== "string") {
        throw new KernelError(ERR_SCHEMA);
      }
      return eventId;
    }
    case "root-update-receipt": {
      const receiptId = body.receiptId;
      if (typeof receiptId !== "string") {
        throw new KernelError(ERR_SCHEMA);
      }
      return receiptId;
    }
    case "observation": {
      const observationId = body.observationId;
      if (typeof observationId !== "string") {
        throw new KernelError(ERR_SCHEMA);
      }
      return observationId;
    }
    default: {
      throw new KernelError(ERR_SCHEMA);
    }
  }
}

function compareRouted(a: RoutedRecord, b: RoutedRecord): number {
  if (a.routeHash < b.routeHash) {
    return -1;
  }
  if (a.routeHash > b.routeHash) {
    return 1;
  }
  if (a.recordKind < b.recordKind) {
    return -1;
  }
  if (a.recordKind > b.recordKind) {
    return 1;
  }
  if (a.identity < b.identity) {
    return -1;
  }
  if (a.identity > b.identity) {
    return 1;
  }
  return 0;
}

function nibbleIndex(hash: string, depth: number): number {
  const code = hash.charCodeAt(depth);
  if (code >= 48 && code <= 57) {
    return code - 48;
  }
  if (code >= 97 && code <= 102) {
    return code - 97 + 10;
  }
  throw new KernelError(ERR_SCHEMA);
}

function padPrefixStart(prefix: string): string {
  return prefix + "0".repeat(CATALOG_V2_LIMITS.maxPrefixDepth - prefix.length);
}

function padPrefixEnd(prefix: string): string {
  return prefix + "f".repeat(CATALOG_V2_LIMITS.maxPrefixDepth - prefix.length);
}

function hexAddOne(hex: string): string | null {
  const out = hex.split("");
  for (let i = out.length - 1; i >= 0; i -= 1) {
    const idx = HEX_DIGITS.indexOf(out[i] as string);
    if (idx < 0) {
      throw new KernelError(ERR_SCHEMA);
    }
    if (idx < 15) {
      out[i] = HEX_DIGITS[idx + 1] as string;
      for (let j = i + 1; j < out.length; j += 1) {
        out[j] = "0";
      }
      return out.join("");
    }
  }
  return null;
}

function assertPrefixFreeCover(prefixes: readonly string[]): void {
  if (prefixes.length === 0) {
    throw new KernelError(ERR_CATALOG_COVER);
  }
  const seen = new Set<string>();
  for (const prefix of prefixes) {
    if (typeof prefix !== "string") {
      throw new KernelError(ERR_SCHEMA);
    }
    if (seen.has(prefix)) {
      throw new KernelError(ERR_CATALOG_COVER);
    }
    seen.add(prefix);
  }
  const sorted = prefixes.slice().sort();
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1] as string;
    const current = sorted[i] as string;
    if (current.startsWith(previous)) {
      throw new KernelError(ERR_CATALOG_COVER);
    }
  }
  const byStart = prefixes.slice().sort((a, b) => {
    const left = padPrefixStart(a);
    const right = padPrefixStart(b);
    if (left < right) {
      return -1;
    }
    if (left > right) {
      return 1;
    }
    return a.length - b.length;
  });
  if (padPrefixStart(byStart[0] as string) !== "0".repeat(CATALOG_V2_LIMITS.maxPrefixDepth)) {
    throw new KernelError(ERR_CATALOG_COVER);
  }
  for (let i = 0; i < byStart.length - 1; i += 1) {
    const end = padPrefixEnd(byStart[i] as string);
    const nextStart = padPrefixStart(byStart[i + 1] as string);
    const successor = hexAddOne(end);
    if (successor === null || successor !== nextStart) {
      throw new KernelError(ERR_CATALOG_COVER);
    }
  }
  const lastEnd = padPrefixEnd(byStart[byStart.length - 1] as string);
  if (lastEnd !== "f".repeat(CATALOG_V2_LIMITS.maxPrefixDepth)) {
    throw new KernelError(ERR_CATALOG_COVER);
  }
}

function assertEntryKindMatch(recordKind: CatalogRecordKind, body: { [key: string]: unknown }): void {
  if (recordKind === "observation") {
    return;
  }
  if (body.entryKind !== recordKind) {
    throw new KernelError(ERR_SCHEMA);
  }
}

function decodeKnownIds(recordKind: CatalogRecordKind, body: { [key: string]: unknown }): void {
  switch (recordKind) {
    case "snapshot": {
      assertPlainObject(body.package);
      decodeId16(String(body.package.rootEpoch));
      decodeId32(String(body.package.scopeId));
      decodeId32(String(body.package.recordId));
      decodeId32(String(body.package.generationId));
      return;
    }
    case "tombstone": {
      decodeId32(String(body.eventId));
      return;
    }
    case "root-update-receipt": {
      decodeId32(String(body.receiptId));
      decodeId32(String(body.rootRevisionId));
      decodeId16(String(body.newActiveEpoch));
      if (!Array.isArray(body.retainedOldEpochs)) {
        throw new KernelError(ERR_SCHEMA);
      }
      for (const epoch of body.retainedOldEpochs) {
        decodeId16(String(epoch));
      }
      assertReceiptTransition(body);
      return;
    }
    case "observation": {
      decodeId32(String(body.observationId));
      return;
    }
    default: {
      throw new KernelError(ERR_SCHEMA);
    }
  }
}

function assertReceiptTransition(body: { [key: string]: unknown }): void {
  if (!Array.isArray(body.parentRootRecordSha256) || !Array.isArray(body.retainedOldEpochs)) {
    throw new KernelError(ERR_SCHEMA);
  }
  const parents = new Set<string>();
  for (const parent of body.parentRootRecordSha256) {
    if (typeof parent !== "string") {
      throw new KernelError(ERR_SCHEMA);
    }
    if (parents.has(parent)) {
      throw new KernelError(ERR_SCHEMA);
    }
    parents.add(parent);
  }
  const current = body.currentRootRecordSha256;
  if (typeof current !== "string" || parents.has(current)) {
    throw new KernelError(ERR_SCHEMA);
  }
  const oldEpochs = new Set<string>();
  for (const epoch of body.retainedOldEpochs) {
    if (typeof epoch !== "string") {
      throw new KernelError(ERR_SCHEMA);
    }
    if (oldEpochs.has(epoch)) {
      throw new KernelError(ERR_SCHEMA);
    }
    oldEpochs.add(epoch);
  }
  const nextEpoch = body.newActiveEpoch;
  if (typeof nextEpoch !== "string" || oldEpochs.has(nextEpoch)) {
    throw new KernelError(ERR_SCHEMA);
  }
}

function routeRecord(value: unknown): RoutedRecord {
  assertPlainObject(value);
  const recordKind = assertRecordKind(value.recordKind);
  assertPlainObject(value.body);
  assertEntryKindMatch(recordKind, value.body);
  decodeKnownIds(recordKind, value.body);
  if (recordKind === "snapshot") {
    assertCanonicalObjectSize(value.body.metadata as JsonValue, LIMIT_METADATA_CANONICAL_BYTES);
  }
  const identity = selectedIdentity(recordKind, value.body);
  const record = value as unknown as CatalogTaggedRecord;
  return {
    record,
    recordKind,
    identity,
    routeHash: catalogRouteHash(recordKind, identity),
  };
}

function assertRoutedSortedUnique(records: readonly RoutedRecord[]): void {
  for (let i = 1; i < records.length; i += 1) {
    const order = compareRouted(records[i - 1] as RoutedRecord, records[i] as RoutedRecord);
    if (order === 0) {
      throw new KernelError(ERR_CATALOG_DUPLICATE);
    }
    if (order > 0) {
      throw new KernelError(ERR_SCHEMA);
    }
  }
}

function collectRevisionState(records: readonly RoutedRecord[]): {
  snapshots: Map<string, SnapshotIndex>;
  tombstoneTargets: Set<string>;
  requiredEpochs: string[];
  liveWitnesses: LiveWitness[];
  liveWitnessWireBytes: number;
  unresolvedTombstoneLive: string[];
  liveRecordForks: string[];
  entryCount: number;
  observationCount: number;
} {
  const snapshots = new Map<string, SnapshotIndex>();
  const tombstoneTargets = new Set<string>();
  const identities = new Set<string>();
  const epochSet = new Set<string>();
  let entryCount = 0;
  let observationCount = 0;

  for (const routed of records) {
    const identityKey = `${routed.recordKind}:${routed.identity}`;
    if (identities.has(identityKey)) {
      throw new KernelError(ERR_CATALOG_DUPLICATE);
    }
    identities.add(identityKey);
    const body = routed.record.body as { [key: string]: unknown };
    if (routed.recordKind === "observation") {
      observationCount += 1;
      continue;
    }
    entryCount += 1;
    if (routed.recordKind === "snapshot") {
      assertPlainObject(body.package);
      const digest = String(body.package.sha256);
      const byteLength = body.package.byteLength;
      if (typeof byteLength !== "number" || !Number.isInteger(byteLength)) {
        throw new KernelError(ERR_SCHEMA);
      }
      const existing = snapshots.get(digest);
      if (existing !== undefined) {
        throw new KernelError(ERR_CATALOG_DUPLICATE);
      }
      if (!Array.isArray(body.locators)) {
        throw new KernelError(ERR_SCHEMA);
      }
      const locatorsCanonical = new Set<string>();
      for (const locator of body.locators) {
        locatorsCanonical.add(locatorCanonical(locator));
      }
      const rootEpoch = String(body.package.rootEpoch);
      epochSet.add(rootEpoch);
      snapshots.set(digest, {
        digest,
        byteLength,
        locatorsCanonical,
        rootEpoch,
        scopeId: String(body.package.scopeId),
        recordId: String(body.package.recordId),
        generationId: String(body.package.generationId),
      });
    } else if (routed.recordKind === "tombstone") {
      tombstoneTargets.add(String(body.targetPackageSha256));
    }
  }

  if (entryCount > CATALOG_V2_LIMITS.maxEntries || observationCount > CATALOG_V2_LIMITS.maxObservations) {
    throw new KernelError(ERR_CATALOG_CAPACITY);
  }
  if (epochSet.size > CATALOG_V2_LIMITS.maxRequiredEpochs) {
    throw new KernelError(ERR_CATALOG_CAPACITY);
  }

  for (const routed of records) {
    if (routed.recordKind !== "observation") {
      continue;
    }
    const body = routed.record.body as { [key: string]: unknown };
    const digest = String(body.packageSha256);
    const snapshot = snapshots.get(digest);
    if (snapshot === undefined) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
    const locatorKey = locatorCanonical(body.locator);
    if (!snapshot.locatorsCanonical.has(locatorKey)) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
    assertPlainObject(body.outcome);
    const status = body.outcome.status;
    if (status === "readback-authenticated") {
      if (body.outcome.observedSha256 !== digest || body.outcome.byteLength !== snapshot.byteLength) {
        throw new KernelError(ERR_CATALOG_REFERENCE);
      }
    } else if (status === "digest-mismatch") {
      if (body.outcome.observedSha256 === digest) {
        throw new KernelError(ERR_CATALOG_REFERENCE);
      }
    }
  }

  const liveWitnesses: LiveWitness[] = [];
  const lengthByDigest = new Map<string, number>();
  let liveWitnessWireBytes = 0;
  for (const snapshot of snapshots.values()) {
    if (tombstoneTargets.has(snapshot.digest)) {
      continue;
    }
    const prior = lengthByDigest.get(snapshot.digest);
    if (prior !== undefined && prior !== snapshot.byteLength) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
    if (prior === undefined) {
      lengthByDigest.set(snapshot.digest, snapshot.byteLength);
      liveWitnessWireBytes += snapshot.byteLength;
      liveWitnesses.push({ digest: snapshot.digest, byteLength: snapshot.byteLength });
    }
  }
  if (liveWitnessWireBytes > CATALOG_V2_LIMITS.liveWitnessWireBytes) {
    throw new KernelError(ERR_CATALOG_CAPACITY);
  }

  liveWitnesses.sort((a, b) => (a.digest < b.digest ? -1 : a.digest > b.digest ? 1 : 0));
  const requiredEpochs = [...epochSet].sort();
  return {
    snapshots,
    tombstoneTargets,
    requiredEpochs,
    liveWitnesses,
    liveWitnessWireBytes,
    unresolvedTombstoneLive: [],
    liveRecordForks: [],
    entryCount,
    observationCount,
  };
}

function countKinds(records: readonly RoutedRecord[]): { entryCount: number; observationCount: number } {
  let entryCount = 0;
  let observationCount = 0;
  for (const routed of records) {
    if (routed.recordKind === "observation") {
      observationCount += 1;
    } else {
      entryCount += 1;
    }
  }
  return { entryCount, observationCount };
}

function shardObject(prefix: string, records: readonly RoutedRecord[]): CatalogShardPayload {
  return {
    payloadVersion: 2,
    nodeType: "shard",
    partitionVersion: 1,
    prefix,
    records: records.map((routed) => routed.record),
  };
}

function emitNonemptyLeaf(prefix: string, records: readonly RoutedRecord[]): PlannedShardLeaf {
  const payload = shardObject(prefix, records);
  const payloadUtf8 = canonicalUtf8(payload as unknown as JsonValue);
  const counts = countKinds(records);
  const recordsCanonical = records.map((routed) => routed.record) as unknown as JsonValue;
  return {
    prefix,
    empty: false,
    payloadUtf8,
    plaintextByteLength: payloadUtf8.byteLength,
    entryCount: counts.entryCount,
    observationCount: counts.observationCount,
    canonicalRecordsSha256: hashCanonical(recordsCanonical),
  };
}

function wipeOwnedLeafPayloads(leaves: readonly PlannedLeaf[]): void {
  for (const leaf of leaves) {
    if (!leaf.empty) {
      wipeBytes(leaf.payloadUtf8);
    }
  }
}

function partitionLeaves(sorted: RoutedRecord[]): PlannedLeaf[] {
  const queue: WorkLeaf[] = [{ prefix: "", records: sorted }];
  let coverCount = 1;
  const emitted: PlannedLeaf[] = [];
  let cumulative = 0;

  try {
    while (queue.length > 0) {
      const leaf = queue.shift();
      if (leaf === undefined) {
        throw new KernelError(ERR_SCHEMA);
      }
      if (leaf.records.length === 0) {
        emitted.push({ prefix: leaf.prefix, empty: true });
        continue;
      }

      const overCount = leaf.records.length > CATALOG_V2_LIMITS.maxRecordsPerLeaf;
      let payloadBytes: Uint8Array | undefined;
      try {
        if (!overCount) {
          payloadBytes = canonicalUtf8(shardObject(leaf.prefix, leaf.records) as unknown as JsonValue);
        }
        const payloadSize = payloadBytes === undefined ? 0 : payloadBytes.byteLength;
        const single = leaf.records.length === 1;
        if (single) {
          if (payloadSize > CATALOG_V2_LIMITS.shardPlaintextBytes) {
            throw new KernelError(ERR_CATALOG_CAPACITY);
          }
          if (cumulative + payloadSize > CATALOG_V2_LIMITS.cumulativeShardPlaintextBytes) {
            throw new KernelError(ERR_CATALOG_CAPACITY);
          }
          cumulative += payloadSize;
          const planned = emitNonemptyLeaf(leaf.prefix, leaf.records);
          if (payloadBytes !== undefined) {
            wipeBytes(payloadBytes);
            payloadBytes = undefined;
          }
          emitted.push(planned);
          continue;
        }

        const needsSplit = overCount || payloadSize > CATALOG_V2_LIMITS.shardTargetBytes;
        if (!needsSplit) {
          if (payloadSize > CATALOG_V2_LIMITS.shardPlaintextBytes) {
            throw new KernelError(ERR_CATALOG_CAPACITY);
          }
          if (cumulative + payloadSize > CATALOG_V2_LIMITS.cumulativeShardPlaintextBytes) {
            throw new KernelError(ERR_CATALOG_CAPACITY);
          }
          cumulative += payloadSize;
          const planned = emitNonemptyLeaf(leaf.prefix, leaf.records);
          if (payloadBytes !== undefined) {
            wipeBytes(payloadBytes);
            payloadBytes = undefined;
          }
          emitted.push(planned);
          continue;
        }
      } finally {
        if (payloadBytes !== undefined) {
          wipeBytes(payloadBytes);
        }
      }

      if (leaf.prefix.length >= CATALOG_V2_LIMITS.maxPrefixDepth) {
        throw new KernelError(ERR_CATALOG_CAPACITY);
      }
      if (coverCount + 15 > CATALOG_V2_LIMITS.maxReferences) {
        throw new KernelError(ERR_CATALOG_CAPACITY);
      }
      coverCount += 15;

      const buckets: RoutedRecord[][] = [
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
      ];
      for (const routed of leaf.records) {
        if (!routed.routeHash.startsWith(leaf.prefix)) {
          throw new KernelError(ERR_CATALOG_REFERENCE);
        }
        const idx = nibbleIndex(routed.routeHash, leaf.prefix.length);
        const bucket = buckets[idx];
        if (bucket === undefined) {
          throw new KernelError(ERR_SCHEMA);
        }
        bucket.push(routed);
      }
      for (let nibble = 0; nibble < 16; nibble += 1) {
        const childPrefix = leaf.prefix + HEX_DIGITS[nibble];
        const bucket = buckets[nibble] as RoutedRecord[];
        if (bucket.length === 0) {
          emitted.push({ prefix: childPrefix, empty: true });
        } else {
          queue.push({ prefix: childPrefix, records: bucket });
        }
      }
    }

    emitted.sort((a, b) => (a.prefix < b.prefix ? -1 : a.prefix > b.prefix ? 1 : 0));
    return emitted;
  } catch (err) {
    wipeOwnedLeafPayloads(emitted);
    throw err;
  }
}

function assertRootSemantics(payload: CatalogRootPayload): void {
  assertSortedUnique(payload.parents, ERR_SCHEMA);
  assertSortedUnique(payload.requiredEpochs, ERR_SCHEMA);
  const prefixes: string[] = [];
  let previous: string | undefined;
  for (const reference of payload.references) {
    if (previous !== undefined && reference.prefix <= previous) {
      throw new KernelError(ERR_SCHEMA);
    }
    previous = reference.prefix;
    prefixes.push(reference.prefix);
    if (reference.empty) {
      continue;
    }
    decodeId32(reference.recordId);
    decodeId32(reference.generationId);
    decodeId16(reference.rootEpoch);
    if (reference.entryCount + reference.observationCount > CATALOG_V2_LIMITS.maxRecordsPerLeaf) {
      throw new KernelError(ERR_SCHEMA);
    }
    if (reference.entryCount + reference.observationCount < 1) {
      throw new KernelError(ERR_SCHEMA);
    }
  }
  if (new Set(prefixes).size !== prefixes.length) {
    throw new KernelError(ERR_CATALOG_COVER);
  }
}

function assertShardSemantics(payload: CatalogShardPayload): RoutedRecord[] {
  const routed = payload.records.map((record) => routeRecord(record));
  assertRoutedSortedUnique(routed);
  for (const item of routed) {
    if (!item.routeHash.startsWith(payload.prefix)) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
  }
  return routed;
}

function copyLiveWitnesses(items: readonly LiveWitness[]): LiveWitness[] {
  return items.map((item) => Object.freeze({ digest: item.digest, byteLength: item.byteLength }));
}

function freezePlannedLeaf(leaf: PlannedLeaf): PlannedLeaf {
  if (leaf.empty) {
    return Object.freeze({ prefix: leaf.prefix, empty: true as const });
  }
  const ownedPayload = leaf.payloadUtf8;
  return Object.freeze({
    prefix: leaf.prefix,
    empty: false as const,
    plaintextByteLength: leaf.plaintextByteLength,
    entryCount: leaf.entryCount,
    observationCount: leaf.observationCount,
    canonicalRecordsSha256: leaf.canonicalRecordsSha256,
    get payloadUtf8() {
      return ownedPayload.slice();
    },
  });
}

function assertShardPlaintextBudget(recordCount: number, plaintextBytes: number): void {
  if (recordCount < 1) {
    throw new KernelError(ERR_SCHEMA);
  }
  if (recordCount === 1) {
    if (plaintextBytes > CATALOG_V2_LIMITS.shardPlaintextBytes) {
      throw new KernelError(ERR_CATALOG_CAPACITY);
    }
    return;
  }
  if (plaintextBytes > CATALOG_V2_LIMITS.shardTargetBytes) {
    throw new KernelError(ERR_CATALOG_CAPACITY);
  }
}

function assertRequiredEpochsExact(requiredEpochs: readonly string[], knownEpochs: ReadonlySet<string>): void {
  const requiredSet = new Set(requiredEpochs);
  for (const epoch of knownEpochs) {
    if (!requiredSet.has(epoch)) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
  }
  let extra = 0;
  for (const epoch of requiredSet) {
    if (!knownEpochs.has(epoch)) {
      extra += 1;
      if (extra > 1) {
        throw new KernelError(ERR_CATALOG_REFERENCE);
      }
    }
  }
}

function preflightRootPayload(root: CatalogRootPayload): {
  declaredEntryCount: number;
  declaredObservationCount: number;
  declaredShardPlaintextBytes: number;
  nonemptyReferenceCount: number;
} {
  const prefixes = root.references.map((reference) => reference.prefix);
  assertPrefixFreeCover(prefixes);
  const requiredSet = new Set(root.requiredEpochs);
  let declaredEntryCount = 0;
  let declaredObservationCount = 0;
  let declaredShardPlaintextBytes = 0;
  let nonemptyReferenceCount = 0;
  for (const reference of root.references) {
    if (reference.empty) {
      continue;
    }
    nonemptyReferenceCount += 1;
    declaredEntryCount += reference.entryCount;
    declaredObservationCount += reference.observationCount;
    declaredShardPlaintextBytes += reference.plaintextByteLength;
    assertShardPlaintextBudget(
      reference.entryCount + reference.observationCount,
      reference.plaintextByteLength,
    );
    if (!requiredSet.has(reference.rootEpoch)) {
      throw new KernelError(ERR_CATALOG_REFERENCE);
    }
  }
  if (declaredEntryCount !== root.entryCount || declaredObservationCount !== root.observationCount) {
    throw new KernelError(ERR_CATALOG_REFERENCE);
  }
  if (declaredShardPlaintextBytes > CATALOG_V2_LIMITS.cumulativeShardPlaintextBytes) {
    throw new KernelError(ERR_CATALOG_CAPACITY);
  }
  return {
    declaredEntryCount,
    declaredObservationCount,
    declaredShardPlaintextBytes,
    nonemptyReferenceCount,
  };
}

function parseCatalogNodeBody(bytes: Uint8Array, expectedRole: "root"): ParsedCatalogRoot;
function parseCatalogNodeBody(bytes: Uint8Array, expectedRole: "shard"): ParsedCatalogShard;
function parseCatalogNodeBody(bytes: Uint8Array, expectedRole: CatalogNodeRole): ParsedCatalogNode;
function parseCatalogNodeBody(bytes: Uint8Array, expectedRole: CatalogNodeRole): ParsedCatalogNode {
  if (expectedRole !== "root" && expectedRole !== "shard") {
    throw new KernelError(ERR_CATALOG_ROLE);
  }
  const maxBytes =
    expectedRole === "root" ? CATALOG_V2_LIMITS.rootPlaintextBytes : CATALOG_V2_LIMITS.shardPlaintextBytes;
  const parsed = parseCanonicalJson(bytes, maxBytes);
  assertPlainObject(parsed);
  if (parsed.payloadVersion !== 2 || parsed.nodeType !== expectedRole) {
    throw new KernelError(ERR_CATALOG_ROLE);
  }
  if (expectedRole === "root") {
    runSchema(validateRootSchema, parsed);
    const payload = parsed as unknown as CatalogRootPayload;
    assertRootSemantics(payload);
    return {
      role: "root",
      payload: isolatedJsonView(payload as unknown as JsonValue) as unknown as CatalogRootPayload,
    };
  }
  runSchema(validateShardSchema, parsed);
  const payload = parsed as unknown as CatalogShardPayload;
  assertShardSemantics(payload);
  return {
    role: "shard",
    payload: isolatedJsonView(payload as unknown as JsonValue) as unknown as CatalogShardPayload,
  };
}

export function parseCatalogNode(bytes: Uint8Array, expectedRole: "root"): ParsedCatalogRoot;
export function parseCatalogNode(bytes: Uint8Array, expectedRole: "shard"): ParsedCatalogShard;
export function parseCatalogNode(bytes: Uint8Array, expectedRole: CatalogNodeRole): ParsedCatalogNode;
export function parseCatalogNode(bytes: Uint8Array, expectedRole: CatalogNodeRole): ParsedCatalogNode {
  return runGuarded(() => parseCatalogNodeBody(bytes, expectedRole), ERR_SCHEMA);
}

export function planCatalogShards(recordsUtf8: Uint8Array): CatalogPlan {
  return runGuarded(() => {
    const parsed = parseCanonicalJson(recordsUtf8, CATALOG_V2_LIMITS.planInputBytes);
    if (!Array.isArray(parsed)) {
      throw new KernelError(ERR_SCHEMA);
    }
    runSchema(validateRecordArraySchema, parsed);
    const routed = parsed.map((item) => routeRecord(item));
    const state = collectRevisionState(routed);
    const sorted = routed.slice().sort(compareRouted);
    assertRoutedSortedUnique(sorted);
    const leaves = partitionLeaves(sorted);
    try {
      let cumulativePlaintextBytes = 0;
      for (const leaf of leaves) {
        if (!leaf.empty) {
          cumulativePlaintextBytes += leaf.plaintextByteLength;
        }
      }
      if (cumulativePlaintextBytes > CATALOG_V2_LIMITS.cumulativeShardPlaintextBytes) {
        throw new KernelError(ERR_CATALOG_CAPACITY);
      }
      if (leaves.length > CATALOG_V2_LIMITS.maxReferences) {
        throw new KernelError(ERR_CATALOG_CAPACITY);
      }
      return Object.freeze({
        leaves: Object.freeze(leaves.map((leaf) => freezePlannedLeaf(leaf))),
        entryCount: state.entryCount,
        observationCount: state.observationCount,
        requiredEpochs: Object.freeze(state.requiredEpochs.slice()),
        cumulativePlaintextBytes,
        liveWitnesses: Object.freeze(copyLiveWitnesses(state.liveWitnesses)),
        liveWitnessWireBytes: state.liveWitnessWireBytes,
        unresolvedTombstoneLive: Object.freeze(state.unresolvedTombstoneLive.slice()),
        liveRecordForks: Object.freeze(state.liveRecordForks.slice()),
      });
    } catch (err) {
      wipeOwnedLeafPayloads(leaves);
      throw err;
    }
  }, ERR_SCHEMA);
}

export function preflightCatalogRoot(rootPayloadUtf8: Uint8Array): CatalogRootPreflight {
  return runGuarded(() => {
    const parsed = parseCatalogNodeBody(rootPayloadUtf8, "root");
    const stats = preflightRootPayload(parsed.payload);
    return Object.freeze({
      root: parsed.payload,
      declaredEntryCount: stats.declaredEntryCount,
      declaredObservationCount: stats.declaredObservationCount,
      declaredShardPlaintextBytes: stats.declaredShardPlaintextBytes,
      nonemptyReferenceCount: stats.nonemptyReferenceCount,
    });
  }, ERR_SCHEMA);
}

export function validateCatalogRevision(
  rootPayloadUtf8: Uint8Array,
  shardPayloadsUtf8: readonly Uint8Array[],
): CatalogRevision {
  return runGuarded(() => {
    let ownedShards: Uint8Array[] = [];
    try {
      const parsedRoot = parseCatalogNodeBody(rootPayloadUtf8, "root");
      const root = parsedRoot.payload;
      const stats = preflightRootPayload(root);
      ownedShards = ownShardPayloads(
        shardPayloadsUtf8,
        stats.nonemptyReferenceCount,
        stats.declaredShardPlaintextBytes,
      );

      const shardsByPrefix = new Map<
        string,
        { payload: CatalogShardPayload; routed: RoutedRecord[]; byteLength: number }
      >();
      let cumulative = 0;
      const allRouted: RoutedRecord[] = [];
      for (const shardBytes of ownedShards) {
        const parsedShard = parseCatalogNodeBody(shardBytes, "shard");
        if (shardsByPrefix.has(parsedShard.payload.prefix)) {
          throw new KernelError(ERR_CATALOG_COVER);
        }
        const routed = assertShardSemantics(parsedShard.payload);
        assertShardPlaintextBudget(parsedShard.payload.records.length, shardBytes.byteLength);
        cumulative += shardBytes.byteLength;
        if (cumulative > CATALOG_V2_LIMITS.cumulativeShardPlaintextBytes) {
          throw new KernelError(ERR_CATALOG_CAPACITY);
        }
        shardsByPrefix.set(parsedShard.payload.prefix, {
          payload: parsedShard.payload,
          routed,
          byteLength: shardBytes.byteLength,
        });
        for (const item of routed) {
          allRouted.push(item);
        }
      }

      const nonempty = root.references.filter((reference) => !reference.empty);
      if (nonempty.length !== shardsByPrefix.size) {
        throw new KernelError(ERR_CATALOG_COVER);
      }

      let summedEntries = 0;
      let summedObservations = 0;
      for (const reference of root.references) {
        if (reference.empty) {
          if (shardsByPrefix.has(reference.prefix)) {
            throw new KernelError(ERR_CATALOG_COVER);
          }
          continue;
        }
        const shard = shardsByPrefix.get(reference.prefix);
        if (shard === undefined) {
          throw new KernelError(ERR_CATALOG_COVER);
        }
        if (shard.payload.prefix !== reference.prefix) {
          throw new KernelError(ERR_CATALOG_COVER);
        }
        const counts = countKinds(shard.routed);
        if (counts.entryCount !== reference.entryCount || counts.observationCount !== reference.observationCount) {
          throw new KernelError(ERR_CATALOG_REFERENCE);
        }
        if (shard.byteLength !== reference.plaintextByteLength) {
          throw new KernelError(ERR_CATALOG_REFERENCE);
        }
        const recordsCanonical = shard.routed.map((item) => item.record) as unknown as JsonValue;
        if (hashCanonical(recordsCanonical) !== reference.canonicalRecordsSha256) {
          throw new KernelError(ERR_CATALOG_REFERENCE);
        }
        summedEntries += counts.entryCount;
        summedObservations += counts.observationCount;
      }

      if (summedEntries !== root.entryCount || summedObservations !== root.observationCount) {
        throw new KernelError(ERR_CATALOG_REFERENCE);
      }

      const state = collectRevisionState(allRouted);
      if (state.entryCount !== root.entryCount || state.observationCount !== root.observationCount) {
        throw new KernelError(ERR_CATALOG_REFERENCE);
      }
      const knownEpochs = new Set<string>(state.requiredEpochs);
      for (const reference of root.references) {
        if (!reference.empty) {
          knownEpochs.add(reference.rootEpoch);
        }
      }
      assertRequiredEpochsExact(root.requiredEpochs, knownEpochs);

      const shards = nonempty.map((reference) => {
        const shard = shardsByPrefix.get(reference.prefix);
        if (shard === undefined) {
          throw new KernelError(ERR_CATALOG_COVER);
        }
        return shard.payload;
      });

      return Object.freeze({
        root,
        shards: Object.freeze(shards.slice()),
        liveWitnesses: Object.freeze(copyLiveWitnesses(state.liveWitnesses)),
        liveWitnessWireBytes: state.liveWitnessWireBytes,
        unresolvedTombstoneLive: Object.freeze(state.unresolvedTombstoneLive.slice()),
        liveRecordForks: Object.freeze(state.liveRecordForks.slice()),
      });
    } finally {
      for (const buffer of ownedShards) {
        wipeBytes(buffer);
      }
    }
  }, ERR_SCHEMA);
}

