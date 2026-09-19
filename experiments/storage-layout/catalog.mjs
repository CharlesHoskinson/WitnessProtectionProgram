/**
 * Isolated storage-layout experiment.
 *
 * App-codec snapshot envelopes are test carriers, not the production
 * kind=catalog format. The in-memory store is not persistent and is not a
 * Drive simulator. This module does not implement AES/HKDF; it seals and
 * opens through the production UnlockedVault.
 *
 * Do not print root bytes, recovery keys, or plaintext entries.
 */

import { createHash } from "node:crypto";
import { UnlockedVault } from "../../dist/kernel/index.js";

export const BUCKET_COUNT = 64;
export const PACK_TARGET_BYTES = 4 * 1024 * 1024;
export const EXPERIMENTAL_CODEC_ID = "wpp.experimental.storage-layout";

const LIMIT_PACKAGE_BYTES = 24 * 1024 * 1024;
const KIND_FLAT = "experimental-flat-catalog";
const KIND_BUCKET = "experimental-bucket";
const KIND_ROOT = "experimental-root-manifest";
const KIND_EXTENT = "experimental-extent-manifest";
const HEX64 = /^[0-9a-f]{64}$/;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const getTypedArrayByteLength = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
).get;
const getTypedArrayByteOffset = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
).get;
const getTypedArrayBuffer = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
).get;

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function bucketForRecordId(recordId) {
  const digest = createHash("sha256").update(String(recordId), "utf8").digest();
  return digest[0] >> 2;
}

function id32FromLabel(label) {
  return createHash("sha256").update(label, "utf8").digest().toString("base64url");
}

function emptyStats() {
  return {
    reads: 0,
    writes: 0,
    readBytes: 0,
    writeBytes: 0,
    rangeReads: 0,
    rangeReadBytes: 0,
    manifestReads: 0,
    manifestReadBytes: 0,
    dataReads: 0,
    dataReadBytes: 0,
    manifestWrites: 0,
    manifestWriteBytes: 0,
    dataWrites: 0,
    dataWriteBytes: 0,
  };
}

function asBuffer(bytes) {
  return Buffer.from(bytes);
}

function ownedBoundedBytes(bytes, limit) {
  if (bytes === null || bytes === undefined || !ArrayBuffer.isView(bytes)) {
    throw new Error("wrong type: expected bytes");
  }
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("wrong type: expected bytes");
  }
  let length;
  try {
    length = getTypedArrayByteLength.call(bytes);
  } catch {
    throw new Error("wrong type: expected bytes");
  }
  if (!Number.isInteger(length) || length < 0) {
    throw new Error("wrong type: expected bytes");
  }
  if (length > limit) {
    throw new Error("envelope exceeds package byte ceiling");
  }
  const offset = getTypedArrayByteOffset.call(bytes);
  const buffer = getTypedArrayBuffer.call(bytes);
  const view = new Uint8Array(buffer, offset, length);
  return Buffer.from(view);
}

function recordRole(role) {
  return role === "manifest" ? "manifest" : "data";
}

export class InMemoryObjectStore {
  #objects;

  constructor(objects) {
    this.#objects = objects ?? new Map();
    this.stats = emptyStats();
  }

  put(bytes, options = {}) {
    const copy = asBuffer(bytes);
    const hash = sha256Hex(copy);
    const role = recordRole(options.role);
    this.#objects.set(hash, { bytes: copy, role });
    this.stats.writes += 1;
    this.stats.writeBytes += copy.byteLength;
    if (role === "manifest") {
      this.stats.manifestWrites += 1;
      this.stats.manifestWriteBytes += copy.byteLength;
    } else {
      this.stats.dataWrites += 1;
      this.stats.dataWriteBytes += copy.byteLength;
    }
    return hash;
  }

  get(hash) {
    const obj = this.#objects.get(hash);
    if (!obj) {
      throw new Error("missing object not found");
    }
    this.#countRead(obj, obj.bytes.byteLength, false);
    return asBuffer(obj.bytes);
  }

  rangeGet(hash, offset, length) {
    if (!Number.isInteger(offset) || !Number.isInteger(length)) {
      throw new Error("integer bounds");
    }
    if (offset < 0 || length < 0) {
      throw new Error("offset length bounds");
    }
    const obj = this.#objects.get(hash);
    if (!obj) {
      throw new Error("missing pack object not found");
    }
    if (offset + length > obj.bytes.byteLength) {
      throw new Error("truncated range exceeds pack length");
    }
    this.stats.rangeReads += 1;
    this.stats.rangeReadBytes += length;
    this.#countRead(obj, length, true);
    return asBuffer(obj.bytes.subarray(offset, offset + length));
  }

  delete(hash) {
    this.#objects.delete(hash);
  }

  replace(hash, bytes) {
    const existing = this.#objects.get(hash);
    if (!existing) {
      throw new Error("missing object not found");
    }
    this.#objects.set(hash, { bytes: asBuffer(bytes), role: existing.role });
  }

  clone() {
    const objects = new Map();
    for (const [hash, obj] of this.#objects) {
      objects.set(hash, { bytes: asBuffer(obj.bytes), role: obj.role });
    }
    return new InMemoryObjectStore(objects);
  }

  freshReader() {
    return new InMemoryObjectStore(this.#objects);
  }

  #countRead(obj, byteLength, range) {
    this.stats.reads += 1;
    this.stats.readBytes += byteLength;
    if (obj.role === "manifest") {
      this.stats.manifestReads += 1;
      this.stats.manifestReadBytes += byteLength;
    } else {
      this.stats.dataReads += 1;
      this.stats.dataReadBytes += byteLength;
    }
    void range;
  }
}

function ownedRecords(records) {
  return records.map((record) => ({
    id: String(record.id),
    payload: structuredClone(record.payload),
  }));
}

function sortRecords(records) {
  return [...records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function recordsFingerprint(records) {
  return sha256Hex(Buffer.from(JSON.stringify(sortRecords(records)), "utf8"));
}

function assertUniqueRecords(records) {
  const seen = new Set();
  for (const record of records) {
    if (typeof record.id !== "string" || record.id.length === 0) {
      throw new Error("malformed logical record");
    }
    if (seen.has(record.id)) {
      throw new Error("duplicate logical key");
    }
    seen.add(record.id);
  }
}

function groupByBucket(records) {
  const buckets = new Map();
  for (const record of records) {
    const bucketId = bucketForRecordId(record.id);
    let list = buckets.get(bucketId);
    if (list === undefined) {
      list = [];
      buckets.set(bucketId, list);
    }
    list.push(record);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  return buckets;
}

function expectedOf(session, recordId) {
  return {
    scopeId: session.scopeId,
    recordId,
    network: structuredClone(session.metadata.network),
    accountBinding: structuredClone(session.metadata.accountBinding),
    applicationId: session.metadata.applicationId,
    contract: structuredClone(session.metadata.contract),
    codec: structuredClone(session.metadata.codec),
  };
}

function sealPayload(session, recordId, content, parentDigests = []) {
  const metadata = structuredClone(session.metadata);
  metadata.parents = [...parentDigests];
  const payload = {
    payloadVersion: 1,
    metadata,
    content,
  };
  const payloadUtf8 = Buffer.from(JSON.stringify(payload), "utf8");
  const sealed = session.vault.sealSnapshot({
    scopeId: session.scopeId,
    recordId,
    payloadUtf8,
  });
  if (sealed.wire.byteLength > LIMIT_PACKAGE_BYTES) {
    throw new Error("envelope exceeds package byte ceiling");
  }
  return sealed;
}

function openEnvelope(session, wire, recordId) {
  try {
    return session.vault.openSnapshot(wire, expectedOf(session, recordId));
  } catch (err) {
    const code = err && (err.code || err.message) ? err.code || err.message : "unknown";
    throw new Error(`authenticate failed: ${code}`);
  }
}

function getChecked(store, hash, label) {
  let bytes;
  try {
    bytes = store.get(hash);
  } catch {
    throw new Error(`missing ${label} not found`);
  }
  if (sha256Hex(bytes) !== hash) {
    throw new Error(`corrupt ${label} hash mismatch`);
  }
  return bytes;
}

function createAuthenticatedManifest(session, spec) {
  if (spec.kind === "root") {
    const sealed = sealPayload(session, session.rootRecordId, {
      kind: KIND_ROOT,
      buckets: spec.buckets,
    });
    return { ciphertext: asBuffer(sealed.wire) };
  }
  if (spec.kind === "bucket") {
    const sealed = sealPayload(session, spec.recordId, {
      kind: KIND_BUCKET,
      bucketId: spec.bucketId,
      records: spec.entries,
    });
    return { ciphertext: asBuffer(sealed.wire) };
  }
  if (spec.kind === "extent") {
    const sealed = sealPayload(session, session.extentRecordId, {
      kind: KIND_EXTENT,
      extents: spec.extents,
    });
    return { ciphertext: asBuffer(sealed.wire) };
  }
  throw new Error("unknown experimental manifest kind");
}

export function createSyntheticRecords({
  count,
  seed,
  minBytes = 128,
  maxBytes = 256,
}) {
  const records = [];
  const span = Math.max(0, maxBytes - minBytes);
  for (let i = 0; i < count; i += 1) {
    const id = `rec-${String(i).padStart(8, "0")}`;
    const digest = createHash("sha256").update(`${seed}:${id}`, "utf8").digest();
    const width = minBytes + (span === 0 ? 0 : digest[0] % (span + 1));
    const payload = { k: String(seed), n: i, pad: "" };
    const basis = JSON.stringify(payload);
    payload.pad = "A".repeat(Math.max(0, width - basis.length));
    records.push({ id, payload });
  }
  return records;
}

export async function createExperimentalSession({ vectors, rootVariant = 0 } = {}) {
  if (vectors === undefined || vectors === null) {
    throw new Error("vectors required");
  }
  const header = vectors.inputs.header;
  const meta = vectors.inputs.payload.metadata;
  const utf8 = (text) => Buffer.from(text, "utf8");
  const b64 = (bytes) => Buffer.from(bytes).toString("base64url");
  const id16 = (fill) => b64(Buffer.alloc(16, fill));
  const id32 = (fill) => b64(Buffer.alloc(32, fill));

  const secretRoot = Buffer.from(vectors.inputs.secretRootHex, "hex");
  if (rootVariant !== 0) {
    secretRoot[0] ^= 0xff;
  }

  const root = {
    format: "wpp-root-record",
    version: 1,
    revisionId: rootVariant === 0 ? id32(0xaa) : id32(0x11),
    parents: [],
    vaultId: rootVariant === 0 ? header.vaultId : id16(0x11),
    vaultSalt: rootVariant === 0 ? header.vaultSalt : id32(0x22),
    catalogScopeId: id32(0xbb),
    catalogRecordId: id32(0xcc),
    epochs: [
      {
        rootEpoch: header.rootEpoch,
        secretRoot: b64(secretRoot),
        createdAt: "2026-09-19T00:00:00Z",
        status: "active",
      },
    ],
  };
  secretRoot.fill(0);

  const codec = {
    id: EXPERIMENTAL_CODEC_ID,
    validate(content, metadata) {
      if (content === null || typeof content !== "object" || Array.isArray(content)) {
        throw new Error("CODEC");
      }
      if (typeof content.kind !== "string") {
        throw new Error("CODEC");
      }
      if (
        content.kind !== KIND_FLAT &&
        content.kind !== KIND_BUCKET &&
        content.kind !== KIND_ROOT &&
        content.kind !== KIND_EXTENT
      ) {
        throw new Error("CODEC");
      }
      if (!metadata || metadata.codec.id !== EXPERIMENTAL_CODEC_ID) {
        throw new Error("CODEC");
      }
    },
  };

  const vault = UnlockedVault.fromRootRecord(utf8(JSON.stringify(root)), [codec]);
  const metadata = {
    network: structuredClone(meta.network),
    accountBinding: structuredClone(meta.accountBinding),
    applicationId: meta.applicationId,
    contract: structuredClone(meta.contract),
    privateStateIds: structuredClone(meta.privateStateIds),
    codec: {
      id: EXPERIMENTAL_CODEC_ID,
      version: 1,
      producerPackage: "wpp-storage-experiment",
      producerVersion: "0.1.0",
      sourceCommit: meta.codec.sourceCommit,
    },
    capturedAt: meta.capturedAt,
    lifecycle: structuredClone(meta.lifecycle),
    parents: [],
    retentionClass: meta.retentionClass,
  };

  const bucketRecordIds = new Map();
  for (let i = 0; i < BUCKET_COUNT; i += 1) {
    bucketRecordIds.set(i, id32FromLabel(`wpp.experimental.storage-layout.bucket:${i}`));
  }

  const session = {
    vault,
    codecId: EXPERIMENTAL_CODEC_ID,
    binding: {
      network: structuredClone(metadata.network),
      accountBinding: structuredClone(metadata.accountBinding),
      applicationId: metadata.applicationId,
      contract: structuredClone(metadata.contract),
      codec: structuredClone(metadata.codec),
    },
    rootKeyRecord: utf8(JSON.stringify(root)),
    rootRecordId: id32FromLabel("wpp.experimental.storage-layout.root"),
    flatRecordId: id32FromLabel("wpp.experimental.storage-layout.flat"),
    extentRecordId: id32FromLabel("wpp.experimental.storage-layout.extent"),
    bucketRecordIds,
    scopeId: header.scopeId,
    metadata,
    async createAuthenticatedManifest(spec) {
      return createAuthenticatedManifest(session, spec);
    },
  };
  return session;
}

export async function flatCommit({ session, store, records, parent }) {
  assertUniqueRecords(records);
  const owned = sortRecords(ownedRecords(records));
  const fingerprint = recordsFingerprint(owned);
  if (parent && parent.fingerprint === fingerprint) {
    return {
      layout: "flat",
      rootHash: parent.rootHash,
      fingerprint,
      changedBucketIds: [],
      rewrittenRecordIds: [],
      bucketCiphertextHashes: new Map(),
      bucketRecordIds: new Map(),
    };
  }
  const parentDigests = parent?.rootHash ? [parent.rootHash] : [];
  const sealed = sealPayload(
    session,
    session.flatRecordId,
    { kind: KIND_FLAT, records: owned },
    parentDigests,
  );
  const rootHash = store.put(sealed.wire, { role: "data" });
  return {
    layout: "flat",
    rootHash,
    fingerprint,
    changedBucketIds: [],
    rewrittenRecordIds: [session.flatRecordId],
    bucketCiphertextHashes: new Map(),
    bucketRecordIds: new Map(),
  };
}

export async function flatRestore({ session, store, rootHash }) {
  const wire = getChecked(store, rootHash, "flat catalog");
  const opened = openEnvelope(session, wire, session.flatRecordId);
  const content = opened.content;
  if (!content || content.kind !== KIND_FLAT || !Array.isArray(content.records)) {
    throw new Error("authenticate failed: malformed flat catalog");
  }
  const records = ownedRecords(content.records);
  assertUniqueRecords(records);
  return { records, packageSha256: opened.packageSha256 };
}

export async function flatLookup({ session, store, rootHash, recordId }) {
  const restored = await flatRestore({ session, store, rootHash });
  const record = restored.records.find((entry) => entry.id === recordId);
  if (!record) {
    throw new Error("missing logical record not found");
  }
  return { record };
}

export async function shardedCommit({ session, store, records, parent }) {
  assertUniqueRecords(records);
  const owned = ownedRecords(records);
  const grouped = groupByBucket(owned);
  const bucketCiphertextHashes = new Map();
  const bucketRecordIds = new Map();
  const bucketFingerprints = new Map();
  const changedBucketIds = [];
  const rewrittenRecordIds = [];

  for (const [bucketId, entries] of grouped) {
    const recordId = session.bucketRecordIds.get(bucketId);
    const fingerprint = recordsFingerprint(entries);
    bucketFingerprints.set(bucketId, fingerprint);
    bucketRecordIds.set(bucketId, recordId);
    const prevFingerprint = parent?.bucketFingerprints?.get(bucketId);
    const prevCipher = parent?.bucketCiphertextHashes?.get(bucketId);
    if (prevFingerprint === fingerprint && typeof prevCipher === "string") {
      bucketCiphertextHashes.set(bucketId, prevCipher);
      continue;
    }
    const sealed = sealPayload(session, recordId, {
      kind: KIND_BUCKET,
      bucketId,
      records: entries,
    });
    const hash = store.put(sealed.wire, { role: "data" });
    bucketCiphertextHashes.set(bucketId, hash);
    changedBucketIds.push(bucketId);
    rewrittenRecordIds.push(recordId);
  }

  const buckets = [...bucketCiphertextHashes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucketId, ciphertextHash]) => ({
      bucketId,
      recordId: bucketRecordIds.get(bucketId),
      ciphertextHash,
    }));
  const parentDigests = parent?.rootHash ? [parent.rootHash] : [];
  const sealedRoot = sealPayload(
    session,
    session.rootRecordId,
    { kind: KIND_ROOT, buckets },
    parentDigests,
  );
  const rootHash = store.put(sealedRoot.wire, { role: "manifest" });
  rewrittenRecordIds.push(session.rootRecordId);

  return {
    layout: "sharded",
    rootHash,
    bucketCiphertextHashes,
    bucketRecordIds,
    bucketFingerprints,
    changedBucketIds,
    rewrittenRecordIds,
  };
}

function assembleBucketRecords(bucketId, bucketContent, seen) {
  if (!bucketContent || bucketContent.kind !== KIND_BUCKET) {
    throw new Error("authenticate failed: malformed bucket");
  }
  if (bucketContent.bucketId !== bucketId) {
    throw new Error("wrong bucket membership");
  }
  if (!Array.isArray(bucketContent.records)) {
    throw new Error("authenticate failed: malformed bucket records");
  }
  const records = [];
  for (const record of bucketContent.records) {
    if (!record || typeof record.id !== "string") {
      throw new Error("authenticate failed: malformed record");
    }
    if (bucketForRecordId(record.id) !== bucketId) {
      throw new Error("wrong bucket membership");
    }
    if (seen.has(record.id)) {
      throw new Error("duplicate logical key");
    }
    seen.add(record.id);
    records.push({ id: record.id, payload: structuredClone(record.payload) });
  }
  return records;
}

export async function shardedRestore({ session, store, rootHash }) {
  const wire = getChecked(store, rootHash, "root manifest");
  const opened = openEnvelope(session, wire, session.rootRecordId);
  const content = opened.content;
  if (!content || content.kind !== KIND_ROOT || !Array.isArray(content.buckets)) {
    throw new Error("authenticate failed: malformed root manifest");
  }
  const records = [];
  const seen = new Set();
  const seenBuckets = new Set();
  for (const entry of content.buckets) {
    if (!entry || typeof entry !== "object") {
      throw new Error("authenticate failed: malformed bucket ref");
    }
    const bucketId = entry.bucketId;
    const recordId = entry.recordId;
    const ciphertextHash = entry.ciphertextHash;
    if (!Number.isInteger(bucketId) || bucketId < 0 || bucketId >= BUCKET_COUNT) {
      throw new Error("wrong bucket membership");
    }
    if (seenBuckets.has(bucketId)) {
      throw new Error("duplicate bucket");
    }
    seenBuckets.add(bucketId);
    const bucketWire = getChecked(store, ciphertextHash, "bucket");
    const bucketOpened = openEnvelope(session, bucketWire, recordId);
    records.push(...assembleBucketRecords(bucketId, bucketOpened.content, seen));
  }
  return { records };
}

export async function shardedLookup({ session, store, rootHash, recordId }) {
  const wire = getChecked(store, rootHash, "root manifest");
  const opened = openEnvelope(session, wire, session.rootRecordId);
  const content = opened.content;
  if (!content || content.kind !== KIND_ROOT || !Array.isArray(content.buckets)) {
    throw new Error("authenticate failed: malformed root manifest");
  }
  const bucketId = bucketForRecordId(recordId);
  const entry = content.buckets.find((item) => item.bucketId === bucketId);
  if (!entry) {
    throw new Error("missing bucket not found");
  }
  const bucketWire = getChecked(store, entry.ciphertextHash, "bucket");
  const bucketOpened = openEnvelope(session, bucketWire, entry.recordId);
  const seen = new Set();
  const records = assembleBucketRecords(bucketId, bucketOpened.content, seen);
  const record = records.find((item) => item.id === recordId);
  if (!record) {
    throw new Error("missing logical record not found");
  }
  return { record, records, bucketId };
}

function envelopeBytesFor(revision, store, bucketId, hash) {
  if (revision.envelopes && revision.envelopes.has(bucketId)) {
    return asBuffer(revision.envelopes.get(bucketId));
  }
  return asBuffer(store.get(hash));
}

function validateExtents(extents) {
  if (!Array.isArray(extents)) {
    throw new Error("extent bounds");
  }
  const seenShard = new Set();
  for (let i = 0; i < extents.length; i += 1) {
    const extent = extents[i];
    if (extent === null || typeof extent !== "object") {
      throw new Error("extent bounds");
    }
    if (!Number.isInteger(extent.offset) || !Number.isInteger(extent.length)) {
      throw new Error("integer bounds");
    }
    if (extent.offset < 0 || extent.length < 0) {
      throw new Error("offset length bounds");
    }
    if (extent.offset + extent.length > Number.MAX_SAFE_INTEGER) {
      throw new Error("integer bounds");
    }
    if (typeof extent.packCiphertextHash !== "string" || !HEX64.test(extent.packCiphertextHash)) {
      throw new Error("hash mismatch");
    }
    if (
      typeof extent.envelopeCiphertextHash !== "string" ||
      !HEX64.test(extent.envelopeCiphertextHash)
    ) {
      throw new Error("hash mismatch");
    }
    if (seenShard.has(extent.shardId)) {
      throw new Error("duplicate extent");
    }
    seenShard.add(extent.shardId);
    for (let j = 0; j < i; j += 1) {
      const other = extents[j];
      if (other.packCiphertextHash !== extent.packCiphertextHash) {
        continue;
      }
      const end = extent.offset + extent.length;
      const otherEnd = other.offset + other.length;
      if (extent.offset < otherEnd && other.offset < end) {
        throw new Error("overlap extents");
      }
    }
  }
}

function authenticateExtentManifest(session, wire, extentManifestHash) {
  const owned = ownedBoundedBytes(wire, LIMIT_PACKAGE_BYTES);
  if (typeof extentManifestHash !== "string" || !HEX64.test(extentManifestHash)) {
    throw new Error("hash mismatch");
  }
  if (sha256Hex(owned) !== extentManifestHash) {
    throw new Error("extent manifest hash mismatch");
  }
  const opened = openEnvelope(session, owned, session.extentRecordId);
  const content = opened.content;
  if (!content || content.kind !== KIND_EXTENT || !Array.isArray(content.extents)) {
    throw new Error("authenticate failed: malformed extent manifest");
  }
  validateExtents(content.extents);
  return content.extents;
}

function openExtentManifest(session, store, extentManifestHash) {
  const wire = getChecked(store, extentManifestHash, "extent manifest");
  return authenticateExtentManifest(session, wire, extentManifestHash);
}

function openShardEnvelope(session, envelope, extent) {
  if (sha256Hex(envelope) !== extent.envelopeCiphertextHash) {
    throw new Error("envelope hash mismatch");
  }
  const opened = openEnvelope(session, envelope, extent.recordId);
  const bucketId = extent.shardId;
  if (!Number.isInteger(bucketId) || bucketId < 0 || bucketId >= BUCKET_COUNT) {
    throw new Error("wrong bucket membership");
  }
  return assembleBucketRecords(bucketId, opened.content, new Set());
}

export async function packShards({ session, store, revision, targetBytes = PACK_TARGET_BYTES }) {
  if (!Number.isInteger(targetBytes) || targetBytes <= 0) {
    throw new Error("integer bounds");
  }
  const hashes = revision.bucketCiphertextHashes;
  const items = [...hashes.entries()].sort((a, b) => a[0] - b[0]);
  const packs = [];
  const extents = [];
  let pieces = [];
  let pending = [];
  let used = 0;

  const flush = () => {
    if (pieces.length === 0) {
      return;
    }
    const ciphertext = Buffer.concat(pieces);
    const ciphertextHash = store.put(ciphertext, { role: "data" });
    packs.push({ ciphertext, ciphertextHash });
    for (const extent of pending) {
      extents.push({ ...extent, packCiphertextHash: ciphertextHash });
    }
    pieces = [];
    pending = [];
    used = 0;
  };

  for (const [bucketId, hash] of items) {
    const envelope = envelopeBytesFor(revision, store, bucketId, hash);
    if (envelope.byteLength > targetBytes) {
      throw new Error("envelope larger than target; exceeds pack without splitting");
    }
    if (envelope.byteLength > LIMIT_PACKAGE_BYTES) {
      throw new Error("envelope exceeds package byte ceiling");
    }
    const envelopeHash = sha256Hex(envelope);
    if (envelopeHash !== hash) {
      throw new Error("envelope hash mismatch");
    }
    if (used > 0 && used + envelope.byteLength > targetBytes) {
      flush();
    }
    pending.push({
      shardId: bucketId,
      recordId: revision.bucketRecordIds.get(bucketId),
      offset: used,
      length: envelope.byteLength,
      envelopeCiphertextHash: envelopeHash,
    });
    pieces.push(envelope);
    used += envelope.byteLength;
  }
  flush();

  const sealed = sealPayload(session, session.extentRecordId, {
    kind: KIND_EXTENT,
    extents,
  });
  const extentManifestHash = store.put(sealed.wire, { role: "manifest" });
  return { packs, extents, extentManifestHash };
}

export async function packedFullRestore({ session, store, extentManifestHash }) {
  const extents = openExtentManifest(session, store, extentManifestHash);
  const packCache = new Map();
  const records = [];
  const seen = new Set();
  for (const extent of extents) {
    let packBytes = packCache.get(extent.packCiphertextHash);
    if (packBytes === undefined) {
      packBytes = getChecked(store, extent.packCiphertextHash, "pack");
      packCache.set(extent.packCiphertextHash, packBytes);
    }
    if (extent.offset + extent.length > packBytes.byteLength) {
      throw new Error("truncated pack length bounds");
    }
    const envelope = packBytes.subarray(extent.offset, extent.offset + extent.length);
    if (sha256Hex(envelope) !== extent.envelopeCiphertextHash) {
      throw new Error("envelope hash mismatch");
    }
    const opened = openEnvelope(session, envelope, extent.recordId);
    const bucketId = extent.shardId;
    if (!Number.isInteger(bucketId) || bucketId < 0 || bucketId >= BUCKET_COUNT) {
      throw new Error("wrong bucket membership");
    }
    records.push(...assembleBucketRecords(bucketId, opened.content, seen));
  }
  return { records };
}

export async function packedRangeRestore({
  session,
  store,
  extentManifestHash,
  shardId,
  cachedManifestWire,
}) {
  const extents =
    cachedManifestWire === undefined
      ? openExtentManifest(session, store, extentManifestHash)
      : authenticateExtentManifest(session, cachedManifestWire, extentManifestHash);
  const extent = extents.find((item) => item.shardId === shardId);
  if (!extent) {
    throw new Error("missing shard extent not found");
  }
  const envelope = store.rangeGet(extent.packCiphertextHash, extent.offset, extent.length);
  const records = openShardEnvelope(session, envelope, extent);
  return { records, extent };
}
