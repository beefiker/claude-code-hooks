import { removeManagedHandlers, addManagedHandler } from './claude-settings.js';

export const SCOPE_OPTIONS = [
  { value: 'project', label: 'Project (shared): .claude/settings.json' },
  { value: 'projectLocal', label: 'Project (local): .claude/settings.local.json (gitignored)' },
  { value: 'global', label: 'Global: ~/.claude/settings.json' }
];

/**
 * Pure helper: apply managed handlers for a package across enabled events.
 *
 * @param {unknown} settings
 * @param {Object} opts
 * @param {string} opts.managedToken
 * @param {string[]} opts.enabledEvents
 * @param {(eventName:string)=>string} opts.buildCommand
 * @param {boolean} [opts.async]
 * @param {number} [opts.timeout]
 * @param {string} [opts.matcher]
 */
export function applyManagedHandlersForEvents(settings, { managedToken, enabledEvents, buildCommand, async = false, timeout = 8, matcher = '*' }) {
  let out = removeManagedHandlers(settings, managedToken);
  for (const eventName of enabledEvents || []) {
    out = addManagedHandler(out, { eventName, command: buildCommand(eventName), async, timeout, matcher });
  }
  return out;
}

/**
 * Upsert a section (security/secrets/etc) in a claude-code-hooks.config.json object.
 * Preserves existing allow/ignore if present.
 *
 * @param {Record<string, any>} rawCfg
 * @param {string} sectionKey
 * @param {{mode:string, enabledEvents:string[]}} patch
 */
export function upsertConfigSection(rawCfg, sectionKey, patch) {
  const out = { ...(rawCfg || {}) };
  const existing = (out[sectionKey] && typeof out[sectionKey] === 'object') ? out[sectionKey] : {};

  const existingIgnore = existing.ignore || { regex: [] };
  const existingAllow = existing.allow || { regex: [] };

  out[sectionKey] = {
    ...existing,
    mode: patch.mode,
    enabledEvents: [...(patch.enabledEvents || [])],
    ignore: existingIgnore,
    allow: existingAllow
  };

  return out;
}
