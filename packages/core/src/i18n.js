/**
 * Lightweight i18n for CLI user-facing strings.
 * Machine-readable outputs (list-events, list-sounds, doctor, JSON) stay stable.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCALES_DIR = path.join(__dirname, '..', 'locales');
const ENV_LANG = 'CLAUDE_CODE_HOOKS_LANG';
const SUPPORTED = ['en', 'ko'];

/** @type {Record<string, Record<string, string>>} */
let cache = {};

/**
 * Detect language from argv (--lang ko) and env CLAUDE_CODE_HOOKS_LANG.
 * @param {string[]} [argv] - process.argv (default)
 * @returns {string}
 */
export function detectLanguage(argv = globalThis.process?.argv ?? []) {
  const idx = argv.indexOf('--lang');
  if (idx !== -1 && argv[idx + 1]) {
    const lang = String(argv[idx + 1]).toLowerCase().slice(0, 2);
    if (SUPPORTED.includes(lang)) return lang;
  }
  const env = (globalThis.process?.env?.[ENV_LANG] ?? '').toLowerCase().slice(0, 2);
  return SUPPORTED.includes(env) ? env : 'en';
}

/**
 * Load a locale from disk. Cached.
 * @param {string} lang - 'en' | 'ko'
 * @returns {Record<string, string>}
 */
export function loadLocale(lang) {
  const code = SUPPORTED.includes(lang) ? lang : 'en';
  if (cache[code]) return cache[code];
  try {
    const p = path.join(LOCALES_DIR, `${code}.json`);
    const data = require(p);
    cache[code] = flattenKeys(data);
    return cache[code];
  } catch {
    if (code !== 'en') return loadLocale('en');
    cache.en = {};
    return cache.en;
  }
}

/**
 * Flatten nested object to dot-notation keys.
 * @param {Record<string, unknown>} obj
 * @param {string} [prefix]
 * @returns {Record<string, string>}
 */
function flattenKeys(obj, prefix = '') {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenKeys(/** @type {Record<string, unknown>} */ (v), key));
    } else if (typeof v === 'string') {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Translate key with optional {{param}} interpolation.
 * @param {string} key - Dot-notation key (e.g. 'cli.step1.chooseAction')
 * @param {Record<string, string | number>} [params] - Interpolation params
 * @param {string} [lang] - Override (default: detect from env/argv)
 * @returns {string}
 */
export function t(key, params = {}, lang) {
  const code = lang ?? detectLanguage();
  const locale = loadLocale(code);
  let str = locale[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return str;
}
