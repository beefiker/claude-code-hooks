import { select, multiselect, isCancel, cancel, note } from '@clack/prompts';
import { ansi as pc, upsertConfigSection, t } from '@claude-code-hooks/core';
import { readProjectConfig, resolveSecurityConfig } from './config.js';
import { HOOK_EVENTS, applySecurityToSettings, removeAllManagedSecurityHooks, buildManagedCommand } from './hooks.js';

function dieCancelled(msg) {
  cancel(msg ?? t('common.cancelled'));
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
export async function planInteractiveSetup({ action, projectDir, ui = 'standalone' }) {
  // Read existing project config for defaults and to preserve allow/ignore.
  const cfgRes = await readProjectConfig(projectDir);
  const existingCfg = cfgRes.ok ? resolveSecurityConfig(cfgRes.value) : null;
  const cfgExists = cfgRes.ok && cfgRes.exists;

  if (cfgExists && ui !== 'umbrella') {
    note(t('common.configFound'), t('security.title'));
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
    message: `${pc.bold('security')}  ${t('security.whenRiskyCommand')}`,
    initialValue: defaultMode,
    options: [
      { value: 'warn', label: t('security.warnRecommended') },
      { value: 'block', label: t('security.blockPreToolUse') }
    ]
  });
  if (isCancel(mode)) dieCancelled();

  const eventDescs = {
    PreToolUse: t('security.eventPreToolUse'),
    PermissionRequest: t('security.eventPermissionRequest')
  };

  // Note removed: block scope is explained in the mode option text.

  const defaultEvents = existingCfg?.enabledEvents || HOOK_EVENTS;
  const enabledEvents = await multiselect({
    message: `${pc.bold('security')}  ${t('security.eventsToGuard')}`,
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
