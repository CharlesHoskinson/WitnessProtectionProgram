import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import canonicalize from 'canonicalize';

import { CiphertextJournal } from '../../dist/journal/index.js';
import { UnlockedVault } from '../../dist/kernel/index.js';
import { createGoogleDriveAdapter } from '../../dist/google/index.js';
import { planCatalogShards } from '../../dist/storage/index.js';

export const PERMISSION_ID = 'permId-opaque-stable-001';
export const OTHER_PERMISSION_ID = 'permId-opaque-stable-002';
export const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
export const FILES_URL = 'https://www.googleapis.com/drive/v3/files';

export const utf8 = (text) => Buffer.from(text, 'utf8');
export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
export const id32 = () => b64(randomBytes(32));
export const id16 = () => b64(randomBytes(16));

export const CODEC = { id: 'wpp.synthetic-vector', validate() {} };

export const BASE_METADATA = {
  network: { id: 'synthetic-local', genesisHash: null },
  accountBinding: { scheme: 'synthetic-fixture', value: 'fixture-account' },
  applicationId: 'wpp-vector-fixture',
  contract: { address: 'synthetic-contract', codeHash: null },
  privateStateIds: ['fixture-state'],
  codec: {
    id: 'wpp.synthetic-vector',
    version: 1,
    producerPackage: 'wpp-format-vectors',
    producerVersion: '0.1.0',
    sourceCommit: '0000000000000000000000000000000000000000',
  },
  capturedAt: '2026-09-19T00:00:00Z',
  lifecycle: { status: 'unassociated', transactionId: null, blockHash: null },
  parents: [],
  retentionClass: 'retained-application-witness',
};

export function randomRoot() {
  return {
    format: 'wpp-root-record',
    version: 1,
    revisionId: id32(),
    parents: [],
    vaultId: b64(randomBytes(16)),
    vaultSalt: b64(randomBytes(32)),
    catalogScopeId: id32(),
    catalogRecordId: id32(),
    epochs: [
      {
        rootEpoch: id16(),
        secretRoot: id32(),
        createdAt: '2026-09-19T00:00:00Z',
        status: 'active',
      },
    ],
  };
}

export function snapshotPayload(message, extras = {}) {
  return {
    payloadVersion: 1,
    metadata: { ...BASE_METADATA, ...extras.metadata },
    content: { message },
  };
}

export function payloadUtf8(message, extras = {}) {
  return utf8(JSON.stringify(snapshotPayload(message, extras)));
}

export function expectedOf(scopeId, recordId) {
  return {
    scopeId,
    recordId,
    network: structuredClone(BASE_METADATA.network),
    accountBinding: structuredClone(BASE_METADATA.accountBinding),
    applicationId: BASE_METADATA.applicationId,
    contract: structuredClone(BASE_METADATA.contract),
    codec: structuredClone(BASE_METADATA.codec),
  };
}

export function extractOctetPayload(multipart) {
  const text = multipart.toString('utf8');
  const marker = 'content-type: application/octet-stream';
  const lower = text.toLowerCase();
  const at = lower.lastIndexOf(marker);
  const headerEnd = text.indexOf('\r\n\r\n', at);
  const rest = multipart.subarray(headerEnd + 4);
  const end = rest.lastIndexOf(utf8('\r\n--'));
  return Buffer.from(rest.subarray(0, end));
}

export function memoryDrive(options = {}) {
  const calls = [];
  const files = new Map();
  const names = new Map();
  const hooks = {
    beforeRequest: options.beforeRequest,
    mutateMedia: options.mutateMedia,
    incompleteCreate: options.incompleteCreate === true,
    dropFileIds: new Set(options.dropFileIds ?? []),
  };
  const request = async (opts) => {
    const method = String(opts.method ?? 'GET').toUpperCase();
    const url = String(opts.url);
    calls.push({ method, url, headers: opts.headers ?? {}, body: opts.body });
    if (typeof hooks.beforeRequest === 'function') {
      await hooks.beforeRequest({ method, url, opts, calls, files, names });
    }
    const parsed = new URL(url);
    if (parsed.origin + parsed.pathname === UPLOAD_URL && method === 'POST') {
      const body = Buffer.from(opts.body ?? []);
      const text = body.toString('utf8');
      const nameMatch = text.match(/"name"\s*:\s*"([0-9a-f]{64}\.wpp)"/);
      const octets = extractOctetPayload(body);
      const fileId = `file-${files.size + 1}-${randomBytes(4).toString('hex')}`;
      files.set(fileId, octets);
      names.set(fileId, nameMatch ? nameMatch[1] : `${sha256Hex(octets)}.wpp`);
      if (hooks.incompleteCreate) {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: utf8(JSON.stringify({ name: names.get(fileId) })),
        };
      }
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: utf8(JSON.stringify({ id: fileId, size: String(octets.byteLength) })),
      };
    }
    if (parsed.pathname === '/drive/v3/files' && method === 'GET' && parsed.searchParams.get('alt') !== 'media') {
      const listed = [];
      for (const [fileId, octets] of files.entries()) {
        listed.push({
          id: fileId,
          name: names.get(fileId) ?? `${sha256Hex(octets)}.wpp`,
          size: String(octets.byteLength),
        });
      }
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: utf8(JSON.stringify({ files: listed, incompleteSearch: false })),
      };
    }
    if (parsed.pathname.startsWith('/drive/v3/files/') && parsed.searchParams.get('alt') === 'media') {
      const fileId = decodeURIComponent(parsed.pathname.slice('/drive/v3/files/'.length));
      if (hooks.dropFileIds.has(fileId)) {
        return { status: 404, headers: {}, body: utf8('{"error":{"message":"missing"}}') };
      }
      let octets = files.get(fileId);
      if (!octets) {
        return { status: 404, headers: {}, body: utf8('{"error":{"message":"missing"}}') };
      }
      if (typeof hooks.mutateMedia === 'function') {
        octets = hooks.mutateMedia(fileId, octets, calls);
      }
      return {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(octets.byteLength),
        },
        body: octets,
      };
    }
    return { status: 500, headers: {}, body: utf8('unexpected') };
  };
  const adapter = createGoogleDriveAdapter({
    permissionId: options.permissionId ?? PERMISSION_ID,
    request,
  });
  return { adapter, calls, files, names, hooks, request };
}

export function mediaGets(calls) {
  return calls.filter((item) => item.method === 'GET' && String(item.url).includes('alt=media'));
}

export function posts(calls) {
  return calls.filter((item) => item.method === 'POST');
}

export function mediaFileId(url) {
  const parsed = new URL(url);
  return decodeURIComponent(parsed.pathname.slice('/drive/v3/files/'.length));
}

export async function withJournal(fn) {
  const root = await mkdtemp(join(process.cwd(), 'wpp-backup-it-'));
  try {
    const dir = join(root, 'journal');
    const journal = await CiphertextJournal.open(dir);
    return await fn({ root, dir, journal });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export function unlock(root = randomRoot()) {
  const vault = UnlockedVault.fromRootRecord(utf8(JSON.stringify(root)), [CODEC]);
  return { root, vault };
}

export function sealInput(message) {
  return {
    scopeId: id32(),
    recordId: id32(),
    payloadUtf8: payloadUtf8(message),
  };
}

export function expectedFromInput(input) {
  return expectedOf(input.scopeId, input.recordId);
}

export function wrapOpenSnapshot(vault) {
  const original = vault.openSnapshot.bind(vault);
  const byDigest = new Map();
  vault.openSnapshot = (wire, expected) => {
    const digest = sha256Hex(wire);
    byDigest.set(digest, (byDigest.get(digest) ?? 0) + 1);
    return original(wire, expected);
  };
  return { byDigest, original };
}

export function snapshotOpenCount(tracker, digest) {
  return tracker.byDigest.get(digest) ?? 0;
}

export function openPublishedRecords(vault, drive, checkpoint) {
  const root = vault.openCatalogNode(drive.files.get(checkpoint.root.locator.objectId), {
    nodeType: 'root',
    wireSha256: checkpoint.root.wireSha256,
    wireByteLength: checkpoint.root.wireByteLength,
  });
  const records = [];
  for (const reference of root.node.payload.references) {
    if (reference.empty) {
      continue;
    }
    const shard = vault.openCatalogNode(drive.files.get(reference.locators[0].objectId), {
      nodeType: 'shard',
      reference,
    });
    records.push(...shard.node.payload.records);
  }
  return { root, records };
}

export function corruptPackageTag(wire) {
  const parsed = JSON.parse(Buffer.from(wire).toString('utf8'));
  const tag = Buffer.from(parsed.tag, 'base64url');
  tag[0] ^= 0xff;
  parsed.tag = tag.toString('base64url');
  return Buffer.from(canonicalize(parsed), 'utf8');
}

export function replaceDriveFile(drive, fileId, octets) {
  drive.files.set(fileId, octets);
  drive.names.set(fileId, `${sha256Hex(octets)}.wpp`);
}

export function findFileIdByName(drive, name) {
  for (const [fileId, fileName] of drive.names.entries()) {
    if (fileName === name) {
      return fileId;
    }
  }
  return undefined;
}

export async function resealCatalog({ vault, drive, records, parents = [], requiredEpochs }) {
  const plan = planCatalogShards(Buffer.from(canonicalize(records), 'utf8'));
  const references = [];
  for (const leaf of plan.leaves) {
    if (leaf.empty) {
      references.push({ prefix: leaf.prefix, empty: true });
      continue;
    }
    const sealedShard = vault.sealCatalogNode(leaf.payloadUtf8);
    const receipt = await drive.adapter.putOwnedCiphertext(sealedShard.wire, sealedShard.sha256);
    const header = JSON.parse(Buffer.from(sealedShard.wire).toString('utf8')).header;
    references.push({
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
      locators: [
        {
          provider: 'google-drive',
          accountBinding: { scheme: 'google-drive-permission-id', value: PERMISSION_ID },
          objectId: receipt.fileId,
          revisionId: null,
        },
      ],
    });
  }
  const shardEpochs = references.filter((item) => item.empty === false).map((item) => item.rootEpoch);
  const epochs =
    requiredEpochs ??
    [...new Set([...plan.requiredEpochs, ...shardEpochs])].sort();
  const rootPayload = {
    payloadVersion: 2,
    nodeType: 'root',
    partitionVersion: 1,
    parents,
    entryCount: plan.entryCount,
    observationCount: plan.observationCount,
    requiredEpochs: epochs,
    references,
  };
  const sealedRoot = vault.sealCatalogNode(Buffer.from(canonicalize(rootPayload), 'utf8'));
  const rootReceipt = await drive.adapter.putOwnedCiphertext(sealedRoot.wire, sealedRoot.sha256);
  return {
    checkpoint: {
      format: 'wpp-backup-checkpoint',
      version: 1,
      root: {
        wireSha256: sealedRoot.sha256,
        wireByteLength: sealedRoot.wire.byteLength,
        locator: {
          provider: 'google-drive',
          accountBinding: { scheme: 'google-drive-permission-id', value: PERMISSION_ID },
          objectId: rootReceipt.fileId,
          revisionId: null,
        },
      },
    },
    plan,
    rootPayload,
  };
}

export const HARNESS_DIR = fileURLToPath(new URL('.', import.meta.url));
