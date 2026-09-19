import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';

const JOURNAL_MODULE = new URL('../../dist/journal/index.js', import.meta.url).href;
const KERNEL_MODULE = new URL('../../dist/kernel/index.js', import.meta.url).href;

function send(stage, extra = {}) {
  if (typeof process.send === 'function') {
    process.send({ stage, ...extra });
  }
}

function writeReceipt(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function errorReceipt(err) {
  return {
    ok: false,
    name: err?.name ?? 'Error',
    code: err?.code ?? null,
    message: String(err?.message ?? ''),
  };
}

function eio(syscall) {
  const err = new Error('EIO');
  err.code = 'EIO';
  err.errno = 5;
  err.syscall = syscall;
  return err;
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => {
      chunks.push(chunk);
    });
    process.stdin.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw.length === 0 ? {} : JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    process.stdin.on('error', reject);
  });
}

function parkAtBoundary() {
  send('at-boundary');
  return new Promise(() => {});
}

function wrapHandle(fh, fault, state) {
  const origWrite = fh.write.bind(fh);
  const origWritev = fh.writev ? fh.writev.bind(fh) : null;
  const origSync = fh.sync.bind(fh);
  const origStat = fh.stat.bind(fh);

  fh.write = async function write(buffer, offset, length, position) {
    if (fault === 'eio-write') {
      throw eio('write');
    }
    if (fault === 'short-write-zero') {
      return { bytesWritten: 0, buffer };
    }
    if (fault === 'short-write-once' && !state.didShort) {
      const off = typeof offset === 'number' ? offset : 0;
      const bufLen = buffer == null ? 0 : buffer.byteLength;
      const len = typeof length === 'number' ? length : Math.max(0, bufLen - off);
      const pos = typeof position === 'number' ? position : null;
      if (len > 1 && bufLen > off) {
        state.didShort = true;
        return origWrite(buffer, off, 1, pos);
      }
    }
    return origWrite(buffer, offset, length, position);
  };

  if (origWritev) {
    fh.writev = async function writev(buffers, ...rest) {
      if (fault === 'eio-write') {
        throw eio('write');
      }
      if (fault === 'short-write-zero') {
        return { bytesWritten: 0, buffers };
      }
      return origWritev(buffers, ...rest);
    };
  }

  fh.sync = async function sync() {
    const st = await origStat();
    if (fault === 'eio-temp-fsync' && !st.isDirectory() && !state.linked) {
      throw eio('fsync');
    }
    if (st.isDirectory() && state.linked) {
      if (fault === 'eio-dir-fsync') {
        throw eio('fsync');
      }
      if (fault === 'kill-after-link-before-dir-fsync') {
        await parkAtBoundary();
      }
    }
    return origSync();
  };

  return fh;
}

function installFaults(fault) {
  if (!fault || fault === 'none') {
    return () => {};
  }

  const state = { linked: false, didShort: false };
  const orig = {
    link: fsp.link,
    linkFs: fs.link,
    linkSync: fs.linkSync,
    rename: fsp.rename,
    renameFs: fs.rename,
    renameSync: fs.renameSync,
    open: fsp.open,
    fsync: fs.fsync,
    fsyncSync: fs.fsyncSync,
  };

  const afterLink = () => {
    state.linked = true;
  };

  const markPublished = (err) => {
    if (err && err.code === 'EEXIST') {
      afterLink();
    }
  };

  const forbidRename = () => {
    const err = new Error('EXDEV');
    err.code = 'EXDEV';
    err.syscall = 'rename';
    throw err;
  };

  if (fault === 'rename-forbidden') {
    fsp.rename = async function rename() {
      forbidRename();
    };
    fs.rename = function rename(_src, _dest, cb) {
      try {
        forbidRename();
      } catch (err) {
        if (typeof cb === 'function') {
          cb(err);
          return;
        }
        throw err;
      }
    };
    fs.renameSync = function renameSync() {
      forbidRename();
    };
  }

  const beforeLink = async () => {
    if (fault === 'kill-before-link') {
      await parkAtBoundary();
    }
  };

  fsp.link = async function link(existing, neu) {
    await beforeLink();
    try {
      const result = await orig.link(existing, neu);
      afterLink();
      return result;
    } catch (err) {
      markPublished(err);
      throw err;
    }
  };
  fs.link = function link(existing, neu, cb) {
    beforeLink()
      .then(() => {
        orig.linkFs(existing, neu, (err) => {
          if (!err) {
            afterLink();
          } else {
            markPublished(err);
          }
          cb(err);
        });
      })
      .catch(cb);
  };
  fs.linkSync = function linkSync(existing, neu) {
    if (fault === 'kill-before-link') {
      send('at-boundary');
      while (true) {}
    }
    try {
      const result = orig.linkSync(existing, neu);
      afterLink();
      return result;
    } catch (err) {
      markPublished(err);
      throw err;
    }
  };

  fsp.open = async function open(...args) {
    const fh = await orig.open(...args);
    return wrapHandle(fh, fault, state);
  };

  fs.fsync = function fsync(fd, cb) {
    fs.fstat(fd, (statErr, st) => {
      if (statErr) {
        cb(statErr);
        return;
      }
      if (fault === 'eio-temp-fsync' && !st.isDirectory() && !state.linked) {
        cb(eio('fsync'));
        return;
      }
      if (st.isDirectory() && state.linked && fault === 'eio-dir-fsync') {
        cb(eio('fsync'));
        return;
      }
      if (st.isDirectory() && state.linked && fault === 'kill-after-link-before-dir-fsync') {
        parkAtBoundary();
        return;
      }
      orig.fsync(fd, cb);
    });
  };

  fs.fsyncSync = function fsyncSync(fd) {
    const st = fs.fstatSync(fd);
    if (fault === 'eio-temp-fsync' && !st.isDirectory() && !state.linked) {
      throw eio('fsync');
    }
    if (st.isDirectory() && state.linked && fault === 'eio-dir-fsync') {
      throw eio('fsync');
    }
    if (st.isDirectory() && state.linked && fault === 'kill-after-link-before-dir-fsync') {
      send('at-boundary');
      while (true) {}
    }
    return orig.fsyncSync(fd);
  };

  syncBuiltinESMExports();

  return () => {
    fsp.link = orig.link;
    fs.link = orig.linkFs;
    fs.linkSync = orig.linkSync;
    fsp.rename = orig.rename;
    fs.rename = orig.renameFs;
    fs.renameSync = orig.renameSync;
    fsp.open = orig.open;
    fs.fsync = orig.fsync;
    fs.fsyncSync = orig.fsyncSync;
    syncBuiltinESMExports();
  };
}

async function main() {
  const cfg = await readStdin();
  send('ready');
  const restore = installFaults(cfg.fault);
  try {
    const { CiphertextJournal } = await import(JOURNAL_MODULE);
    const journal = await CiphertextJournal.open(cfg.journalDir);
    if (cfg.action === 'get') {
      const bytes = await journal.get(cfg.sha256);
      writeReceipt({
        ok: true,
        action: 'get',
        sha256: cfg.sha256,
        byteLength: bytes.byteLength,
        digest: sha256Hex(bytes),
      });
      return;
    }
    if (cfg.action === 'authenticate') {
      const { UnlockedVault } = await import(KERNEL_MODULE);
      const root = Uint8Array.from(Buffer.from(cfg.rootB64, 'base64'));
      const codec = { id: cfg.codecId, validate() {} };
      const vault = UnlockedVault.fromRootRecord(root, [codec]);
      try {
        const bytes = await journal.get(cfg.sha256);
        const opened = vault.openSnapshot(bytes, cfg.expected);
        const marker =
          opened.content !== null && typeof opened.content === 'object' && !Array.isArray(opened.content)
            ? opened.content.marker
            : undefined;
        const markerOk = marker === cfg.expectedMarker;
        writeReceipt({
          ok: markerOk,
          action: 'authenticate',
          authenticated: true,
          packageSha256: opened.packageSha256,
          markerOk,
        });
        if (!markerOk) {
          process.exitCode = 1;
        }
      } finally {
        vault.lock();
      }
      return;
    }
    if (cfg.action === 'list') {
      const names = await journal.list();
      writeReceipt({ ok: true, action: 'list', names: [...names] });
      return;
    }
    if (cfg.action === 'put' || cfg.action === 'put-fault') {
      const wire = Uint8Array.from(Buffer.from(cfg.wireB64, 'base64'));
      const result = await journal.put({ wire, sha256: cfg.sha256 });
      writeReceipt({
        ok: true,
        action: cfg.action,
        sha256: result.sha256,
        byteLength: result.byteLength,
        status: result.status,
      });
      return;
    }
    writeReceipt({ ok: false, code: 'INVALID_INPUT', message: 'unknown-action' });
    process.exitCode = 1;
  } catch (err) {
    writeReceipt(errorReceipt(err));
    process.exitCode = 1;
  } finally {
    restore();
  }
}

main().catch((err) => {
  writeReceipt(errorReceipt(err));
  process.exit(1);
});
