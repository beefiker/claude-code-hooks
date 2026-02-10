import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {import('./patterns.js').Finding} Finding
 */

/**
 * Curated patterns for scanning committed files.
 * Includes all patterns from patterns.js plus additional file-oriented ones.
 */
const FILE_PATTERNS = [
  // ── HIGH severity ────────────────────────────────────────────────
  { id: 'private-key', rx: /-----BEGIN (RSA|OPENSSH|EC|PGP|DSA|ENCRYPTED) PRIVATE KEY-----/, severity: 'HIGH', title: 'Private key material', detail: 'Detected a private key header (BEGIN ... PRIVATE KEY).' },

  // ── MED severity ─────────────────────────────────────────────────
  { id: 'openai', rx: /\bsk-[A-Za-z0-9]{20,}\b/, severity: 'MED', title: 'OpenAI API key-like token', detail: 'Detected token matching sk-... pattern.' },
  { id: 'github', rx: /\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9]{20,}|ghu_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}|ghr_[A-Za-z0-9]{20,})\b/, severity: 'MED', title: 'GitHub token-like secret', detail: 'Detected GitHub token pattern.' },
  { id: 'aws-akid', rx: /\bAKIA[0-9A-Z]{16}\b/, severity: 'MED', title: 'AWS Access Key ID', detail: 'Detected AWS access key id pattern (AKIA...).' },
  { id: 'slack', rx: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, severity: 'MED', title: 'Slack token', detail: 'Detected Slack token pattern (xox*).' },
  { id: 'google-api', rx: /\bAIza[A-Za-z0-9_-]{35}\b/, severity: 'MED', title: 'Google API key', detail: 'Detected Google API key pattern (AIza...).' },
  { id: 'stripe-secret', rx: /\b[sr]k_live_[A-Za-z0-9]{20,}\b/, severity: 'MED', title: 'Stripe secret/restricted key', detail: 'Detected Stripe live secret key (sk_live_ / rk_live_).' },
  { id: 'twilio', rx: /\bSK[a-f0-9]{32}\b/, severity: 'MED', title: 'Twilio API key', detail: 'Detected Twilio API key pattern (SK + 32 hex).' },
  { id: 'sendgrid', rx: /\bSG\.[A-Za-z0-9_-]{22,}\.[A-Za-z0-9_-]{22,}\b/, severity: 'MED', title: 'SendGrid API key', detail: 'Detected SendGrid API key pattern (SG.xxx.xxx).' },
  { id: 'npm-token', rx: /\bnpm_[A-Za-z0-9]{36}\b/, severity: 'MED', title: 'npm access token', detail: 'Detected npm token pattern (npm_...).' },
  { id: 'pypi-token', rx: /\bpypi-[A-Za-z0-9_-]{50,}\b/, severity: 'MED', title: 'PyPI API token', detail: 'Detected PyPI token pattern (pypi-...).' },
  { id: 'heroku', rx: /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i, skip: true },
  { id: 'database-url', rx: /\b(postgres|mysql|mongodb(\+srv)?|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/, severity: 'MED', title: 'Database connection string with credentials', detail: 'Detected database URL containing embedded password.' },
  { id: 'generic-secret', rx: /(?:secret|token|password|passwd|api_key|apikey|api-key|auth_token|access_token)\s*[:=]\s*['"][A-Za-z0-9/+=_-]{16,}['"]/i, severity: 'MED', title: 'Generic secret assignment', detail: 'Detected secret-like key=value assignment with high-entropy value.' }
];

// Remove the heroku UUID pattern — too many false positives from regular UUIDs.
const ACTIVE_PATTERNS = FILE_PATTERNS.filter((p) => !p.skip);

/** Directories to skip when scanning staged files. */
const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'vendor',
  '__pycache__', '.next', '.nuxt', 'coverage', '.tox', '.venv',
  'venv', '.mypy_cache', '.pytest_cache', 'bower_components'
]);

/** Binary file extensions to skip. */
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.avi', '.mov', '.mkv',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.obj',
  '.pyc', '.pyo', '.class', '.jar', '.war',
  '.wasm', '.sqlite', '.db', '.lock'
]);

/**
 * Check if a file path should be excluded.
 * @param {string} filePath
 * @returns {boolean}
 */
function isExcluded(filePath) {
  const parts = filePath.split(path.sep);
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return true;
  }
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTS.has(ext)) return true;
  return false;
}

/**
 * Checks if a buffer looks like binary content (contains null bytes in first 8KB).
 * @param {Buffer} buf
 * @returns {boolean}
 */
function isBinaryBuffer(buf) {
  const len = Math.min(buf.length, 8192);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

/**
 * Get list of staged files (Added, Copied, Modified) via git.
 * @returns {string[]} Array of relative file paths.
 */
function getStagedFiles() {
  try {
    const stdout = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Scan a single file's content against patterns.
 * @param {string} content
 * @returns {Array<{id: string, title: string, severity: import('./patterns.js').Severity, detail: string}>}
 */
function scanContent(content) {
  /** @type {Array<{id: string, title: string, severity: import('./patterns.js').Severity, detail: string}>} */
  const hits = [];
  const seen = new Set();

  for (const p of ACTIVE_PATTERNS) {
    if (p.rx.test(content) && !seen.has(p.id)) {
      seen.add(p.id);
      hits.push({ id: p.id, title: p.title, severity: /** @type {import('./patterns.js').Severity} */ (p.severity), detail: p.detail });
    }
  }

  return hits;
}

/**
 * Scan all staged git files for secrets.
 * Returns findings annotated with the originating file path.
 *
 * @returns {Finding[]}
 */
export function scanStagedFiles() {
  const files = getStagedFiles();
  if (files.length === 0) return [];

  /** @type {Finding[]} */
  const allFindings = [];
  /** @type {Set<string>} */
  const seenIds = new Set();

  for (const relPath of files) {
    if (isExcluded(relPath)) continue;

    let buf;
    try {
      buf = fs.readFileSync(relPath);
    } catch {
      // File might have been deleted between staging and scanning.
      continue;
    }

    if (isBinaryBuffer(buf)) continue;

    const content = buf.toString('utf8');
    // Skip very large files (> 1 MB) to avoid slowing down commits.
    if (content.length > 1_048_576) continue;

    const hits = scanContent(content);
    for (const h of hits) {
      // Deduplicate across files by id — report the first occurrence.
      const key = `${h.id}:${relPath}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      allFindings.push({
        id: h.id,
        title: h.title,
        severity: h.severity,
        detail: `${h.detail} (in staged file: ${relPath})`
      });
    }
  }

  return allFindings;
}

/**
 * Detect whether a hook payload represents a `git commit` command.
 * @param {Record<string, unknown>} payload
 * @returns {boolean}
 */
export function isGitCommitPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;

  // Claude Code PreToolUse Bash payloads have tool_input.command
  const cmd = /** @type {string | undefined} */ (
    payload.command ??
    (/** @type {Record<string, unknown>} */ (payload.tool_input))?.command
  );

  if (typeof cmd !== 'string') return false;
  return /git\s+commit\b/.test(cmd);
}
