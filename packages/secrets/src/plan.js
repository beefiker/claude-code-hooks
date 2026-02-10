import {
  ansi as pc,
  upsertConfigSection,
  t,
  select,
  multiselect,
  confirm,
  isCancel,
  cancel,
  note
} from '@claude-code-hooks/core';
import { readProjectConfig, resolveSecretsConfig } from './config.js';
import { HOOK_EVENTS, applySecretsToSettings, removeAllManagedSecretsHooks, buildManagedCommand } from './hooks.js';

function dieCancelled(msg, locale = 'en') {
  cancel(msg ?? t('cancelled', locale));
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

export async function planInteractiveSetup({ action, projectDir, ui = 'standalone', locale = 'en' }) {
  const cfgRes = await readProjectConfig(projectDir);
  const existingCfg = cfgRes.ok ? resolveSecretsConfig(cfgRes.value) : null;
  const cfgExists = cfgRes.ok && cfgRes.exists;

  if (cfgExists && ui !== 'umbrella') {
    note(t('secretsFoundConfig', locale).replace('claude-code-hooks.config.json', pc.bold('claude-code-hooks.config.json')), 'Secrets');
  }

  if (action === 'uninstall') {
    return {
      key: 'secrets',
      projectConfigSection: null,
      snippetHooks: {},
      applyToSettings: async (settings) => removeAllManagedSecretsHooks(settings)
    };
  }

  const defaultMode = existingCfg?.mode || 'warn';
  const mode = await select({
    message: `[secrets] ${t('secretsHowBehave', locale)}`,
    initialValue: defaultMode,
    options: [
      { value: 'warn', label: `${t('secretsWarn', locale)} ${pc.dim(`(${t('recommended', locale)})`)}` },
      { value: 'block', label: t('secretsBlock', locale) }
    ]
  });
  if (isCancel(mode)) dieCancelled(undefined, locale);

  const eventDescs = {
    PreToolUse: t('securityBeforeTool', locale),
    PermissionRequest: t('securityToolPermission', locale)
  };

  const defaultEvents = existingCfg?.enabledEvents || HOOK_EVENTS;
  const enabledEvents = await multiselect({
    message: `[secrets] ${t('secretsWhichEvents', locale)}`,
    options: HOOK_EVENTS.map((e) => ({ value: e, label: `${e} ${pc.dim('—')} ${pc.dim(eventDescs[e] || '')}` })),
    initialValues: defaultEvents.filter((e) => HOOK_EVENTS.includes(e)),
    required: false
  });
  if (isCancel(enabledEvents)) dieCancelled(undefined, locale);

  const defaultScanGitCommit = existingCfg?.scanGitCommit ?? false;
  const scanGitCommit = await confirm({
    message: `[secrets] ${t('secretsScanGitCommit', locale)}`,
    initialValue: defaultScanGitCommit
  });
  if (isCancel(scanGitCommit)) dieCancelled(undefined, locale);

  const rawCfg = cfgRes.ok ? { ...cfgRes.value } : {};
  const nextCfg = upsertConfigSection(rawCfg, 'secrets', { mode, enabledEvents, scanGitCommit });

  return {
    key: 'secrets',
    projectConfigSection: nextCfg.secrets,
    snippetHooks: Object.fromEntries((enabledEvents || []).map((eventName) => [eventName, hookGroupForEvent({ eventName, mode })])),
    applyToSettings: async (settings) => applySecretsToSettings(settings, { enabledEvents, mode })
  };
}
