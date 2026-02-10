import { HOOK_EVENTS, isManagedCommand } from './hooks.js';

export function extractModeFromCommand(command) {
  const m = /--mode\s+(warn|block)\b/.exec(command || '');
  return m ? m[1] : null;
}

export function extractManagedHandlers(settings) {
  /** @type {Record<string, Array<{command:string, mode:string|null}>>} */
  const byEvent = {};
  for (const eventName of HOOK_EVENTS) {
    const groups = settings?.hooks?.[eventName];
    const out = [];
    if (Array.isArray(groups)) {
      for (const g of groups) {
        const handlers = Array.isArray(g?.hooks) ? g.hooks : [];
        for (const h of handlers) {
          const cmd = h?.command;
          if (isManagedCommand(cmd)) out.push({ command: cmd, mode: extractModeFromCommand(cmd) });
        }
      }
    }
    byEvent[eventName] = out;
  }
  return byEvent;
}
