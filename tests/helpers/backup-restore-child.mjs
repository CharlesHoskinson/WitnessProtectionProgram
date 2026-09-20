import { GoogleBackupCoordinator } from '../../dist/backup/index.js';
import { createGoogleDriveAdapter } from '../../dist/google/index.js';
import { UnlockedVault } from '../../dist/kernel/index.js';

const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

function utf8(text) {
  return Buffer.from(text, 'utf8');
}

const message = JSON.parse(process.env.WPP_BACKUP_CHILD_MESSAGE ?? '{}');

const files = new Map(message.files.map((item) => [item.fileId, Buffer.from(item.b64, 'base64')]));

const request = async (opts) => {
  const method = String(opts.method ?? 'GET').toUpperCase();
  const url = String(opts.url);
  const parsed = new URL(url);
  if (parsed.origin + parsed.pathname === UPLOAD_URL && method === 'POST') {
    return { status: 500, headers: {}, body: utf8('no-publish-in-child') };
  }
  if (parsed.pathname.startsWith('/drive/v3/files/') && parsed.searchParams.get('alt') === 'media') {
    const fileId = decodeURIComponent(parsed.pathname.slice('/drive/v3/files/'.length));
    const octets = files.get(fileId);
    if (!octets) {
      return { status: 404, headers: {}, body: utf8('{"error":{"message":"missing"}}') };
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

const session = createGoogleDriveAdapter({
  permissionId: message.permissionId,
  request,
});
const vault = UnlockedVault.fromRecoveryPack(
  Buffer.from(message.recoveryWireB64, 'base64'),
  Buffer.from(message.recoveryKeyB64, 'base64'),
  [{ id: 'wpp.synthetic-vector', validate() {} }],
);
try {
  const result = await GoogleBackupCoordinator.restoreSnapshot({
    vault,
    session,
    checkpoint: message.checkpoint,
    packageSha256: message.packageSha256,
    expected: message.expected,
  });
  if (result.status !== 'verified') {
    process.stdout.write(JSON.stringify({ ok: false, reason: result.reason }) + '\n');
    process.exit(2);
  }
  process.stdout.write(
    JSON.stringify({
      ok: true,
      packageSha256: result.snapshot.packageSha256,
      message: result.snapshot.content?.message,
    }) + '\n',
  );
} finally {
  vault.lock();
}
