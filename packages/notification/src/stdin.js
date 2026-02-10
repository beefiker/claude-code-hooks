/**
 * Read and parse hook JSON payload from stdin (non-blocking).
 * Claude Code pipes a JSON payload to hook handlers via stdin.
 * If stdin is a TTY or empty, returns null.
 */

import process from 'node:process';

/**
 * Read all data from stdin with a timeout.
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<string | null>}
 */
function readStdinRaw(timeoutMs = 2000) {
  return new Promise((resolve) => {
    // If stdin is a TTY (interactive terminal), nothing to read.
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }

    const chunks = [];
    let settled = false;

    const finish = (/** @type {string | null} */ value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.removeAllListeners('data');
      process.stdin.removeAllListeners('end');
      process.stdin.removeAllListeners('error');
      try { process.stdin.destroy(); } catch { /* ignore */ }
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish(chunks.length > 0 ? chunks.join('') : null);
    }, timeoutMs);

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { chunks.push(chunk); });
    process.stdin.on('end', () => { finish(chunks.length > 0 ? chunks.join('') : null); });
    process.stdin.on('error', () => { finish(null); });
    process.stdin.resume();
  });
}

/**
 * Read hook JSON from stdin. Returns parsed object or null.
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function readHookPayload(timeoutMs = 2000) {
  const raw = await readStdinRaw(timeoutMs);
  if (!raw || raw.trim().length === 0) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
