import {
  LIMIT_PLAINTEXT_BYTES,
  bytesEqual,
  canonicalizeJsonBytes,
  cloneJsonValue,
  copyOwnedBytes,
  isolatedJsonView,
  parseJsonBytes,
  wipeBytes,
  type JsonValue,
} from "../kernel/json.js";
import {
  CatalogError,
  ERR_CATALOG_CONFLICT,
  ERR_CATALOG_INPUT,
  ERR_CATALOG_LIMIT,
  type Catalog,
  type CatalogConflict,
  type CatalogRevisionInput,
  type ReconciliationResult,
  type SnapshotEntry,
  type TombstoneEntry,
} from "./types.js";
import {
  CATALOG_MAX_INPUTS,
  CatalogResultBudget,
  accountCatalogResultBytes,
  assertDigest,
  catalogBytes,
  catalogFromParsed,
  canonicalKey,
  compareLex,
  isolatedCatalog,
  mapKernelError,
  mapPublicInputError,
  mergeCatalogRecords,
  parseCatalog,
} from "./validation.js";

interface OwnedRevision {
  revisionSha256: string;
  payloadUtf8: Uint8Array;
}

interface ParsedRevision {
  revisionSha256: string;
  catalog: Catalog;
  parents: string[];
  originalCanonical: Uint8Array;
}

const COLOR_WHITE = 0;
const COLOR_GRAY = 1;
const COLOR_BLACK = 2;

function copyRevisionSha(value: unknown): string {
  if (typeof value !== "string") {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  return assertDigest(value);
}

function ownInputs(inputs: readonly CatalogRevisionInput[]): OwnedRevision[] {
  let isArray: boolean;
  try {
    isArray = Array.isArray(inputs);
  } catch {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  if (!isArray) {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  let count: unknown;
  try {
    count = inputs.length;
  } catch {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  if (typeof count !== "number" || !Number.isSafeInteger(count)) {
    throw new CatalogError(ERR_CATALOG_INPUT);
  }
  if (count < 1 || count > CATALOG_MAX_INPUTS) {
    throw new CatalogError(ERR_CATALOG_LIMIT);
  }
  const owned: OwnedRevision[] = [];
  try {
    for (let i = 0; i < count; i += 1) {
      let item: CatalogRevisionInput;
      try {
        item = inputs[i];
      } catch {
        throw new CatalogError(ERR_CATALOG_INPUT);
      }
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new CatalogError(ERR_CATALOG_INPUT);
      }
      let revisionValue: unknown;
      let payloadValue: unknown;
      try {
        revisionValue = item.revisionSha256;
        payloadValue = item.payloadUtf8;
      } catch {
        throw new CatalogError(ERR_CATALOG_INPUT);
      }
      const revisionSha256 = copyRevisionSha(revisionValue);
      let payloadUtf8: Uint8Array;
      try {
        payloadUtf8 = copyOwnedBytes(payloadValue as Uint8Array, LIMIT_PLAINTEXT_BYTES);
      } catch (err) {
        mapPublicInputError(err);
      }
      owned.push({ revisionSha256, payloadUtf8 });
    }
    return owned;
  } catch (err) {
    wipeOwned(owned);
    return mapKernelError(err);
  }
}

function wipeCanonicals(parsed: ParsedRevision[]): void {
  for (const item of parsed) {
    wipeBytes(item.originalCanonical);
  }
}

function parseOwned(owned: OwnedRevision[]): ParsedRevision[] {
  const parsed: ParsedRevision[] = [];
  try {
    for (const item of owned) {
      const original = parseJsonBytes(item.payloadUtf8, LIMIT_PLAINTEXT_BYTES);
      const originalCanonical = canonicalizeJsonBytes(original);
      try {
        const catalog = catalogFromParsed(original);
        parsed.push({
          revisionSha256: item.revisionSha256,
          catalog,
          parents: [...catalog.parents],
          originalCanonical,
        });
      } catch (err) {
        wipeBytes(originalCanonical);
        throw err;
      }
    }
    return parsed;
  } catch (err) {
    wipeCanonicals(parsed);
    mapKernelError(err);
  }
}

function dedupeRevisions(parsed: ParsedRevision[]): ParsedRevision[] {
  const byDigest = new Map<string, ParsedRevision>();
  const unique: ParsedRevision[] = [];
  for (const item of parsed) {
    const previous = byDigest.get(item.revisionSha256);
    if (previous === undefined) {
      byDigest.set(item.revisionSha256, item);
      unique.push(item);
      continue;
    }
    if (!bytesEqual(previous.originalCanonical, item.originalCanonical)) {
      throw new CatalogError(ERR_CATALOG_CONFLICT);
    }
  }
  unique.sort((left, right) => compareLex(left.revisionSha256, right.revisionSha256));
  return unique;
}

function accountSourceRevisions(budget: CatalogResultBudget, unique: readonly ParsedRevision[]): void {
  for (const item of unique) {
    budget.addCanonical(item.revisionSha256);
    accountCatalogResultBytes(budget, item.catalog);
  }
}

function accountResultEnvelope(
  budget: CatalogResultBudget,
  heads: readonly string[],
  missing: readonly string[],
): void {
  for (const head of heads) {
    budget.addCanonical(head);
  }
  for (const parent of missing) {
    budget.addCanonical(parent);
  }
  budget.addCanonical("unknown");
}

function accountTombstoneLiveConflicts(budget: CatalogResultBudget, conflicts: readonly CatalogConflict[]): void {
  for (const conflict of conflicts) {
    budget.addCanonical(conflict.kind);
    budget.addCanonical(conflict.identity);
    for (const claim of conflict.claims) {
      budget.addCanonical(claim);
    }
  }
}

function parentMap(parsed: readonly ParsedRevision[]): Map<string, string[]> {
  const nodes = new Map<string, string[]>();
  for (const item of parsed) {
    nodes.set(item.revisionSha256, [...item.parents]);
  }
  return nodes;
}

function assertAcyclic(nodes: Map<string, string[]>): void {
  const color = new Map<string, number>();
  for (const id of nodes.keys()) {
    color.set(id, COLOR_WHITE);
  }

  const visit = (id: string): void => {
    color.set(id, COLOR_GRAY);
    const parents = nodes.get(id);
    if (parents === undefined) {
      throw new CatalogError(ERR_CATALOG_INPUT);
    }
    for (const parent of parents) {
      if (parent === id) {
        throw new CatalogError(ERR_CATALOG_INPUT);
      }
      if (!nodes.has(parent)) {
        continue;
      }
      const parentColor = color.get(parent);
      if (parentColor === COLOR_GRAY) {
        throw new CatalogError(ERR_CATALOG_INPUT);
      }
      if (parentColor === COLOR_WHITE) {
        visit(parent);
      }
    }
    color.set(id, COLOR_BLACK);
  };

  for (const id of nodes.keys()) {
    if (color.get(id) === COLOR_WHITE) {
      visit(id);
    }
  }
}

function revisionHeads(nodes: Map<string, string[]>): string[] {
  const referenced = new Set<string>();
  for (const parents of nodes.values()) {
    for (const parent of parents) {
      if (nodes.has(parent)) {
        referenced.add(parent);
      }
    }
  }
  const heads: string[] = [];
  for (const id of nodes.keys()) {
    if (!referenced.has(id)) {
      heads.push(id);
    }
  }
  heads.sort(compareLex);
  return heads;
}

function missingParents(nodes: Map<string, string[]>): string[] {
  const missing = new Set<string>();
  for (const parents of nodes.values()) {
    for (const parent of parents) {
      if (!nodes.has(parent)) {
        missing.add(parent);
      }
    }
  }
  return [...missing].sort(compareLex);
}

interface AncestorState {
  ancestors: Set<string>;
  incomplete: boolean;
}

function ancestorState(id: string, nodes: Map<string, string[]>): AncestorState {
  const ancestors = new Set<string>();
  const seen = new Set<string>();
  const stack = [...(nodes.get(id) ?? [])];
  let incomplete = false;
  while (stack.length > 0) {
    const parent = stack.pop();
    if (parent === undefined || seen.has(parent)) {
      continue;
    }
    seen.add(parent);
    const parentParents = nodes.get(parent);
    if (parentParents === undefined) {
      incomplete = true;
      continue;
    }
    ancestors.add(parent);
    for (const grand of parentParents) {
      stack.push(grand);
    }
  }
  return { ancestors, incomplete };
}

function knownIncomparable(left: string, right: string, nodes: Map<string, string[]>): boolean {
  if (left === right) {
    return false;
  }
  const leftState = ancestorState(left, nodes);
  const rightState = ancestorState(right, nodes);
  if (leftState.ancestors.has(right) || rightState.ancestors.has(left)) {
    return false;
  }
  if (leftState.incomplete || rightState.incomplete) {
    return false;
  }
  return true;
}

function snapshotsOf(catalog: Catalog): Map<string, SnapshotEntry> {
  const snapshots = new Map<string, SnapshotEntry>();
  for (const entry of catalog.entries) {
    if (entry.entryKind === "snapshot") {
      snapshots.set(entry.package.sha256, entry);
    }
  }
  return snapshots;
}

function tombstonesOf(catalog: Catalog): Map<string, TombstoneEntry[]> {
  const tombstones = new Map<string, TombstoneEntry[]>();
  for (const entry of catalog.entries) {
    if (entry.entryKind !== "tombstone") {
      continue;
    }
    const list = tombstones.get(entry.targetPackageSha256);
    if (list === undefined) {
      tombstones.set(entry.targetPackageSha256, [entry]);
    } else {
      list.push(entry);
    }
  }
  return tombstones;
}

function collectTombstoneLiveConflicts(
  parsed: readonly ParsedRevision[],
  heads: readonly string[],
  nodes: Map<string, string[]>,
): CatalogConflict[] {
  const byRevision = new Map<string, ParsedRevision>();
  for (const item of parsed) {
    byRevision.set(item.revisionSha256, item);
  }
  const liveHeads = new Map<string, Set<string>>();
  const tombstoneHeads = new Map<string, Set<string>>();
  const liveClaims = new Map<string, Map<string, JsonValue>>();
  const tombstoneClaims = new Map<string, Map<string, JsonValue>>();

  const addHead = (table: Map<string, Set<string>>, digest: string, head: string): void => {
    let set = table.get(digest);
    if (set === undefined) {
      set = new Set();
      table.set(digest, set);
    }
    set.add(head);
  };

  const addClaim = (table: Map<string, Map<string, JsonValue>>, digest: string, value: JsonValue): void => {
    let bodies = table.get(digest);
    if (bodies === undefined) {
      bodies = new Map();
      table.set(digest, bodies);
    }
    bodies.set(canonicalKey(value), value);
  };

  for (const head of heads) {
    const revision = byRevision.get(head);
    if (revision === undefined) {
      throw new CatalogError(ERR_CATALOG_INPUT);
    }
    const snapshots = snapshotsOf(revision.catalog);
    const tombstones = tombstonesOf(revision.catalog);
    for (const digest of snapshots.keys()) {
      if (tombstones.has(digest)) {
        continue;
      }
      addHead(liveHeads, digest, head);
      const snapshot = snapshots.get(digest);
      if (snapshot !== undefined) {
        addClaim(liveClaims, digest, snapshot as unknown as JsonValue);
      }
    }
    for (const [digest, entries] of tombstones) {
      addHead(tombstoneHeads, digest, head);
      for (const entry of entries) {
        addClaim(tombstoneClaims, digest, entry as unknown as JsonValue);
      }
    }
  }

  const conflicts: CatalogConflict[] = [];
  const identities = new Set<string>([...liveHeads.keys(), ...tombstoneHeads.keys()]);
  for (const digest of identities) {
    const live = liveHeads.get(digest);
    const tombstoned = tombstoneHeads.get(digest);
    if (live === undefined || tombstoned === undefined || live.size === 0 || tombstoned.size === 0) {
      continue;
    }
    let concurrent = false;
    for (const liveHead of live) {
      for (const tombstoneHead of tombstoned) {
        if (knownIncomparable(liveHead, tombstoneHead, nodes)) {
          concurrent = true;
        }
      }
    }
    if (!concurrent) {
      continue;
    }
    const claims: JsonValue[] = [];
    const liveBodies = liveClaims.get(digest);
    const tombstoneBodies = tombstoneClaims.get(digest);
    if (liveBodies !== undefined) {
      claims.push(...liveBodies.values());
    }
    if (tombstoneBodies !== undefined) {
      claims.push(...tombstoneBodies.values());
    }
    conflicts.push({
      kind: "tombstone-live",
      identity: digest,
      claims,
    });
  }
  return conflicts;
}

function cloneTombstoneLiveConflicts(conflicts: readonly CatalogConflict[]): CatalogConflict[] {
  return conflicts.map((conflict) => ({
    kind: conflict.kind,
    identity: conflict.identity,
    claims: conflict.claims.map((claim) => cloneJsonValue(claim)),
  }));
}

function wipeOwned(owned: OwnedRevision[]): void {
  for (const item of owned) {
    wipeBytes(item.payloadUtf8);
  }
}

export function reconcileCatalogs(inputs: readonly CatalogRevisionInput[]): ReconciliationResult {
  let owned: OwnedRevision[] | undefined;
  let parsed: ParsedRevision[] | undefined;
  try {
    owned = ownInputs(inputs);
    parsed = parseOwned(owned);
    const unique = dedupeRevisions(parsed);
    const budget = new CatalogResultBudget();
    accountSourceRevisions(budget, unique);
    const nodes = parentMap(unique);
    assertAcyclic(nodes);
    const heads = revisionHeads(nodes);
    const missing = missingParents(nodes);
    const tombstoneLive = collectTombstoneLiveConflicts(unique, heads, nodes);
    accountTombstoneLiveConflicts(budget, tombstoneLive);
    accountResultEnvelope(budget, heads, missing);
    const merged = mergeCatalogRecords(
      unique.map((item) => item.catalog),
      heads,
      budget,
      tombstoneLive.length === 0,
    );
    merged.conflicts.push(...cloneTombstoneLiveConflicts(tombstoneLive));
    merged.conflicts.sort((left, right) => {
      const kind = compareLex(left.kind, right.kind);
      if (kind !== 0) {
        return kind;
      }
      return compareLex(left.identity, right.identity);
    });
    for (const conflict of merged.conflicts) {
      conflict.claims.sort((left, right) => compareLex(canonicalKey(left), canonicalKey(right)));
    }

    let catalog: Catalog | null = null;
    if (merged.conflicts.length === 0) {
      const bytes = catalogBytes(merged.catalog);
      try {
        catalog = parseCatalog(bytes);
      } catch (err) {
        mapKernelError(err);
      } finally {
        wipeBytes(bytes);
      }
    }

    const sourceRevisions = unique.map((item) => ({
      revisionSha256: item.revisionSha256,
      catalog: isolatedCatalog(item.catalog),
    }));
    sourceRevisions.sort((left, right) => compareLex(left.revisionSha256, right.revisionSha256));

    const result: ReconciliationResult = {
      catalog,
      conflicts: merged.conflicts,
      revisionHeads: heads,
      missingParents: missing,
      sourceRevisions,
      freshness: "unknown",
    };
    return isolatedJsonView(result as unknown as JsonValue) as unknown as ReconciliationResult;
  } catch (err) {
    return mapKernelError(err);
  } finally {
    if (parsed !== undefined) {
      wipeCanonicals(parsed);
    }
    if (owned !== undefined) {
      wipeOwned(owned);
    }
  }
}
