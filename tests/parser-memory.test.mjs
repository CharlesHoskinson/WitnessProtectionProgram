import { equal } from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { describe, test } from 'node:test';

const HEAP_MIB = 64;
const CHILD_TIMEOUT_MS = 20000;
const MAX_OUTPUT_BYTES = 32 * 1024;
const JSON_MODULE = new URL('../dist/kernel/json.js', import.meta.url).href;

const CHILD_SOURCE = `import { parseJsonBytes, LIMIT_PACKAGE_BYTES, KernelError, ERR_JSON_PARSE } from ${JSON.stringify(JSON_MODULE)};
try {
  parseJsonBytes(Buffer.from('[' + ','.repeat(2000000) + ']'), LIMIT_PACKAGE_BYTES);
  process.stderr.write('missing KernelError\\n');
  process.exit(2);
} catch (err) {
  if (
    err instanceof KernelError &&
    err.code === ERR_JSON_PARSE &&
    err.message === ERR_JSON_PARSE &&
    ERR_JSON_PARSE === 'WPP_JSON_PARSE'
  ) {
    process.exit(0);
  }
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  process.stderr.write(code + '\\n');
  process.exit(3);
}
`;

function collectBounded(stream) {
  const chunks = [];
  let size = 0;
  stream.on('data', (chunk) => {
    if (size >= MAX_OUTPUT_BYTES) {
      return;
    }
    const room = MAX_OUTPUT_BYTES - size;
    const part = chunk.length > room ? chunk.subarray(0, room) : chunk;
    chunks.push(part);
    size += part.length;
  });
  return () => Buffer.concat(chunks).toString('utf8');
}

function runBoundedChild() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'bash',
      ['-c', `ulimit -c 0 && exec node --max-old-space-size=${HEAP_MIB} --input-type=module`],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, CHILD_TIMEOUT_MS);

    const readStdout = collectBounded(child.stdout);
    const readStderr = collectBounded(child.stderr);

    child.stdin.on('error', () => {});
    child.stdin.end(CHILD_SOURCE);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        timedOut,
        stdout: readStdout(),
        stderr: readStderr(),
      });
    });
  });
}

describe('json parser memory bound', () => {
  test('rejects 2000000 commas under a 64MiB heap with WPP_JSON_PARSE', { timeout: 30000 }, async () => {
    const result = await runBoundedChild();
    equal(result.timedOut, false, `child timed out after ${CHILD_TIMEOUT_MS}ms\n${result.stderr}`);
    equal(result.signal, null, `child received ${result.signal}\n${result.stderr}`);
    equal(result.code, 0, `child exit ${result.code}\n${result.stderr}`);
  });
});
