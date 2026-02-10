import {
  CONFIG_FILENAME,
  configFilePath,
  readProjectConfig,
  writeProjectConfig,
  compileRegexList
} from '@claude-hooks/core';

export { CONFIG_FILENAME, configFilePath, readProjectConfig, writeProjectConfig, compileRegexList };

/**
 * @typedef {Object} SecretsConfig
 * @property {'warn'|'block'} mode
 * @property {string[]} enabledEvents
 * @property {{ regex: string[] }} ignore
 * @property {{ regex: string[] }} allow
 */

/** @returns {SecretsConfig} */
export function defaultSecretsConfig() {
  return {
    mode: 'warn',
    enabledEvents: ['PreToolUse', 'PermissionRequest'],
    ignore: { regex: [] },
    allow: { regex: [] }
  };
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {SecretsConfig}
 */
export function resolveSecretsConfig(raw) {
  const defaults = defaultSecretsConfig();
  const sec = /** @type {Record<string, unknown>} */ (raw?.secrets || {});

  const mode = sec.mode === 'block' ? 'block' : 'warn';

  const enabledEvents = Array.isArray(sec.enabledEvents)
    ? sec.enabledEvents.filter((e) => typeof e === 'string')
    : defaults.enabledEvents;

  const ignoreRegex = Array.isArray(sec.ignore?.regex)
    ? sec.ignore.regex.filter((r) => typeof r === 'string')
    : defaults.ignore.regex;

  const allowRegex = Array.isArray(sec.allow?.regex)
    ? sec.allow.regex.filter((r) => typeof r === 'string')
    : defaults.allow.regex;

  return {
    mode,
    enabledEvents,
    ignore: { regex: ignoreRegex },
    allow: { regex: allowRegex }
  };
}

/**
 * @param {string} [cwd]
 * @returns {Promise<SecretsConfig>}
 */
export async function loadEffectiveConfig(cwd) {
  const res = await readProjectConfig(cwd);
  if (!res.ok) return defaultSecretsConfig();
  return resolveSecretsConfig(res.value);
}
