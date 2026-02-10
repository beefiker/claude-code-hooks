import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export function configPathForScope(scope, projectDir) {
  if (scope === 'global') return path.join(os.homedir(), '.claude', 'settings.json');
  if (scope === 'project') return path.join(projectDir, '.claude', 'settings.json');
  if (scope === 'projectLocal') return path.join(projectDir, '.claude', 'settings.local.json');
  throw new Error(`Unknown scope: ${scope}`);
}

export async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return { ok: true, value: {} };
    return { ok: false, error: err };
  }
}

export async function writeJson(filePath, obj) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2) + '\n');
}

export function isManagedCommand(command, managedToken) {
  return typeof command === 'string' && typeof managedToken === 'string' && command.includes(managedToken);
}

export function removeManagedHandlers(settings, managedToken) {
  const out = { ...(settings || {}) };
  out.hooks = { ...(out.hooks || {}) };

  for (const [eventName, groups] of Object.entries(out.hooks)) {
    if (!Array.isArray(groups)) continue;

    const newGroups = [];
    for (const g of groups) {
      const handlers = Array.isArray(g?.hooks) ? g.hooks : [];
      const kept = handlers.filter((h) => !isManagedCommand(h?.command, managedToken));
      if (kept.length > 0) newGroups.push({ ...g, hooks: kept });
    }

    if (newGroups.length > 0) out.hooks[eventName] = newGroups;
    else delete out.hooks[eventName];
  }

  if (out.hooks && Object.keys(out.hooks).length === 0) delete out.hooks;
  return out;
}

export function addManagedHandler(settings, { eventName, command, async = false, timeout = 8, matcher = '*' }) {
  const out = { ...(settings || {}) };
  out.hooks = { ...(out.hooks || {}) };

  const handler = { type: 'command', command, async: Boolean(async), timeout };
  const group = { matcher, hooks: [handler] };

  const existingGroups = Array.isArray(out.hooks[eventName]) ? out.hooks[eventName] : [];
  out.hooks[eventName] = [...existingGroups, group];

  return out;
}

export function extractManagedHandlers(settings, { managedToken, events, modeRegex }) {
  const byEvent = {};
  for (const eventName of events || []) {
    const groups = settings?.hooks?.[eventName];
    const out = [];
    if (Array.isArray(groups)) {
      for (const g of groups) {
        const handlers = Array.isArray(g?.hooks) ? g.hooks : [];
        for (const h of handlers) {
          const cmd = h?.command;
          if (isManagedCommand(cmd, managedToken)) {
            const m = modeRegex ? modeRegex.exec(cmd || '') : null;
            const mode = m && m[1] ? m[1] : null;
            out.push({ command: cmd, mode });
          }
        }
      }
    }
    byEvent[eventName] = out;
  }
  return byEvent;
}
