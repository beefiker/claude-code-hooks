import { select, multiselect, isCancel, cancel, note } from '@clack/prompts';
import { ansi as pc, upsertConfigSection } from '@claude-code-hooks/core';
import { readProjectConfig, resolveSecurityConfig } from './config.js';
import { HOOK_EVENTS, applySecurityToSettings, removeAllManagedSecurityHooks, buildManagedCommand } from './hooks.js';

function dieCancelled(msg = 'Cancelled') {
  cancel(msg);
  process.exit(0);
}

function hookGroupForEvent({ eventName, mode }) {
  return [
    {
      matcher: '*',
      hooks: [
        {
          type: 'command',
          command: buildManagedCommand({ eventName, mode }),
          async: false,
          timeout: 8
        }
      ]
    }
  ];
}

/**
 * Plan-only interactive setup for claude-security.
 * Returns an object with:
 * - applyToSettings(settings) -> nextSettings
 * - projectConfigSection (for claude-code-hooks.config.json)
 * - snippetHooks (for project-only snippet)
 */
export async function planInteractiveSetup({ action, projectDir }) {
  // Read existing project config for defaults and to preserve allow/ignore.
  const cfgRes = await readProjectConfig(projectDir);
  const existingCfg = cfgRes.ok ? resolveSecurityConfig(cfgRes.value) : null;
  const cfgExists = cfgRes.ok && cfgRes.exists;

  if (cfgExists) {
    note(`Found existing ${pc.bold('claude-code-hooks.config.json')} — using it to pre-fill defaults.`, 'Security');
  }

  if (action === 'uninstall') {
    return {
      key: 'security',
      projectConfigSection: null,
      snippetHooks: {},
      applyToSettings: async (settings) => removeAllManagedSecurityHooks(settings)
    };
  }

  const defaultMode = existingCfg?.mode || 'warn';
  const mode = await select({
    message: '[security] How should it behave when it detects a risk?',
    initialValue: defaultMode,
    options: [
      { value: 'warn', label: `Warn only ${pc.dim('(recommended to start)')}` },
      { value: 'block', label: `Block (exit 2) ${pc.dim('(may interrupt workflows)')}` }
    ]
  });
  if (isCancel(mode)) dieCancelled();

  const eventDescs = {
    PreToolUse: 'Before a tool runs',
    PermissionRequest: 'Tool asks for permission'
  };

  note(`Block mode is only enforced for ${pc.bold('PreToolUse')}; other events always warn.`, 'Security');

  const defaultEvents = existingCfg?.enabledEvents || HOOK_EVENTS;
  const enabledEvents = await multiselect({
    message: '[security] Which events should be guarded?',
    options: HOOK_EVENTS.map((e) => ({ value: e, label: `${e} ${pc.dim('—')} ${pc.dim(eventDescs[e] || '')}` })),
    initialValues: defaultEvents.filter((e) => HOOK_EVENTS.includes(e)),
    required: false
  });
  if (isCancel(enabledEvents)) dieCancelled();

  // Build project config section, preserving allow/ignore lists.
  const rawCfg = cfgRes.ok ? { ...cfgRes.value } : {};
  const nextCfg = upsertConfigSection(rawCfg, 'security', { mode, enabledEvents });

  return {
    key: 'security',
    projectConfigSection: nextCfg.security,
    snippetHooks: Object.fromEntries((enabledEvents || []).map((eventName) => [eventName, hookGroupForEvent({ eventName, mode })])),
    applyToSettings: async (settings) => applySecurityToSettings(settings, { enabledEvents, mode })
  };
}
