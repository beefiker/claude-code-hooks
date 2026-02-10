import os from 'node:os';

export const HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'TeammateIdle',
  'TaskCompleted',
  'PreCompact',
  'SessionEnd'
];

const MANAGED_TOKEN = '--managed-by @claude-code-hooks/notification';

function validateEventName(eventName) {
  if (typeof eventName !== 'string' || !HOOK_EVENTS.includes(eventName)) {
    throw new Error(`Invalid event name: ${JSON.stringify(eventName)}`);
  }
}

export function isManagedCommand(command) {
  return typeof command === 'string' && command.includes(MANAGED_TOKEN);
}

export function buildManagedCommand({ eventName }) {
  validateEventName(eventName);
  // Keep args stable so we can reliably remove managed handlers.
  return `npx --yes @claude-code-hooks/notification@latest --event ${eventName} ${MANAGED_TOKEN}`;
}

export function getExistingManagedEvents(settings) {
  const events = new Set();
  const hooks = settings?.hooks;
  if (!hooks || typeof hooks !== 'object') return events;

  for (const [eventName, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups) || !HOOK_EVENTS.includes(eventName)) continue;
    for (const g of groups) {
      const handlers = g?.hooks;
      if (!Array.isArray(handlers)) continue;
      for (const h of handlers) {
        const cmd = h?.command;
        if (isManagedCommand(cmd)) events.add(eventName);
      }
    }
  }

  return events;
}

export function applyEventsToSettings(settings, enabledEvents) {
  const out = { ...(settings || {}) };
  out.hooks = { ...(out.hooks || {}) };

  // Remove all existing managed handlers.
  for (const [eventName, groups] of Object.entries(out.hooks)) {
    if (!Array.isArray(groups)) continue;

    const newGroups = [];
    for (const g of groups) {
      const handlers = Array.isArray(g?.hooks) ? g.hooks : [];
      const kept = handlers.filter((h) => !isManagedCommand(h?.command));
      if (kept.length > 0) newGroups.push({ ...g, hooks: kept });
    }

    if (newGroups.length > 0) out.hooks[eventName] = newGroups;
    else delete out.hooks[eventName];
  }

  // Add current enabled events.
  for (const eventName of enabledEvents || []) {
    if (!eventName) continue;
    validateEventName(eventName);

    const handler = {
      type: 'command',
      command: buildManagedCommand({ eventName }),
      async: true,
      timeout: 8
    };

    const group = {
      matcher: '*',
      hooks: [handler]
    };

    const existingGroups = Array.isArray(out.hooks[eventName]) ? out.hooks[eventName] : [];
    out.hooks[eventName] = [...existingGroups, group];
  }

  if (out.hooks && Object.keys(out.hooks).length === 0) delete out.hooks;

  // Small nicety: include platform metadata at top-level (non-standard, safe).
  // Avoids forcing users to guess where it ran when sharing configs.
  out.__claude_code_hooks_notification_platform = os.platform();

  return out;
}
