import {
  configPathForScope,
  readJsonIfExists,
  writeJson,
  removeManagedHandlers,
  addManagedHandler,
  isManagedCommand as _isManagedCommand
} from '@claude-hooks/core';

export const HOOK_EVENTS = ['PreToolUse', 'PermissionRequest'];

export { configPathForScope, readJsonIfExists, writeJson };

const MANAGED_TOKEN = '--managed-by @claude-hooks/secrets';

export function isManagedCommand(command) {
  return _isManagedCommand(command, MANAGED_TOKEN);
}

function validateEventName(eventName) {
  if (typeof eventName !== 'string' || !HOOK_EVENTS.includes(eventName)) {
    throw new Error(`Invalid event name: ${JSON.stringify(eventName)}`);
  }
}

export function buildManagedCommand({ eventName, mode }) {
  validateEventName(eventName);
  const safeMode = mode === 'block' ? 'block' : 'warn';
  return `npx --yes @claude-hooks/secrets@latest run --event ${eventName} --mode ${safeMode} ${MANAGED_TOKEN}`;
}

export function applySecretsToSettings(settings, { enabledEvents, mode }) {
  let out = removeManagedHandlers(settings, MANAGED_TOKEN);

  for (const eventName of enabledEvents) {
    if (!HOOK_EVENTS.includes(eventName)) continue;
    out = addManagedHandler(out, {
      eventName,
      command: buildManagedCommand({ eventName, mode }),
      async: false,
      timeout: 8,
      matcher: '*'
    });
  }

  return out;
}

export function removeAllManagedSecretsHooks(settings) {
  return applySecretsToSettings(settings, { enabledEvents: [], mode: 'warn' });
}
