import { select, multiselect, confirm, isCancel, cancel, note } from '@clack/prompts';
import { ansi as pc, upsertConfigSection } from '@claude-code-hooks/core';
import { readProjectConfig, resolveSecretsConfig } from './config.js';
import { HOOK_EVENTS, applySecretsToSettings, removeAllManagedSecretsHooks, buildManagedCommand } from './hooks.js';

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

export async function planInteractiveSetup({ action, projectDir, ui = 'standalone' }) {
  const cfgRes = await readProjectConfig(projectDir);
  const existingCfg = cfgRes.ok ? resolveSecretsConfig(cfgRes.value) : null;
  const cfgExists = cfgRes.ok && cfgRes.exists;

  if (cfgExists && ui !== 'umbrella') {
    note(`Found existing ${pc.bold('claude-code-hooks.config.json')} — using it to pre-fill defaults.`, 'Secrets');
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
    message: '[secrets] How should it behave when it detects a secret-like token?',
    initialValue: defaultMode,
    options: [
      { value: 'warn', label: `Warn only ${pc.dim('(recommended)')}` },
      { value: 'block', label: `Block on HIGH only ${pc.dim('(private key material)')}` }
    ]
  });
  if (isCancel(mode)) dieCancelled();

  const eventDescs = {
    PreToolUse: 'Before a tool runs',
    PermissionRequest: 'Tool asks for permission'
  };

  // Note removed: HIGH-only scope is explained in the mode option text.

  const defaultEvents = existingCfg?.enabledEvents || HOOK_EVENTS;
  const enabledEvents = await multiselect({
    message: '[secrets] Which events should be scanned?',
    options: HOOK_EVENTS.map((e) => ({ value: e, label: `${e} ${pc.dim('—')} ${pc.dim(eventDescs[e] || '')}` })),
    initialValues: defaultEvents.filter((e) => HOOK_EVENTS.includes(e)),
    required: false
  });
  if (isCancel(enabledEvents)) dieCancelled();

  const defaultScanGitCommit = existingCfg?.scanGitCommit ?? false;
  const scanGitCommit = await confirm({
    message: '[secrets] Scan staged files for secrets on git commit?',
    initialValue: defaultScanGitCommit
  });
  if (isCancel(scanGitCommit)) dieCancelled();

  const rawCfg = cfgRes.ok ? { ...cfgRes.value } : {};
  const nextCfg = upsertConfigSection(rawCfg, 'secrets', { mode, enabledEvents, scanGitCommit });

  return {
    key: 'secrets',
    projectConfigSection: nextCfg.secrets,
    snippetHooks: Object.fromEntries((enabledEvents || []).map((eventName) => [eventName, hookGroupForEvent({ eventName, mode })])),
    applyToSettings: async (settings) => applySecretsToSettings(settings, { enabledEvents, mode })
  };
}
