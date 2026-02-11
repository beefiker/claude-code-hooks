import { intro, outro, select, multiselect, isCancel, cancel, note, spinner } from '@clack/prompts';
import { ansi as pc, t, upsertConfigSection } from '@claude-code-hooks/core';
import {
  HOOK_EVENTS,
  configPathForScope,
  readJsonIfExists,
  writeJson,
  applySecurityToSettings,
  removeAllManagedSecurityHooks
} from './hooks.js';
import { readProjectConfig, resolveSecurityConfig, writeProjectConfig, configFilePath } from './config.js';

export async function interactiveSetup() {
  intro('claude-security');

  // ── Read existing project config for defaults ──────────────────────
  const projectDir = process.cwd();
  const cfgRes = await readProjectConfig(projectDir);
  const existingCfg = cfgRes.ok ? resolveSecurityConfig(cfgRes.value) : null;
  const cfgExists = cfgRes.ok && cfgRes.exists;

  if (cfgExists) {
    note(t('common.configFound'), t('common.configDetected'));
  }

  const SCOPE_OPTIONS_I18N = [
    { value: 'project', label: t('common.scopeProject') },
    { value: 'projectLocal', label: t('common.scopeProjectLocal') },
    { value: 'global', label: t('common.scopeGlobal') }
  ];

  const scope = await select({
    message: t('common.scopeWriteTo'),
    options: SCOPE_OPTIONS_I18N
  });

  if (isCancel(scope)) {
    cancel(t('common.cancelled'));
    process.exit(0);
  }

  const defaultMode = existingCfg?.mode || 'warn';
  const mode = await select({
    message: t('security.whenRiskyCommand'),
    initialValue: defaultMode,
    options: [
      { value: 'warn', label: t('security.warnRecommended') },
      { value: 'block', label: t('security.blockPreToolUse'), hint: t('security.blockHint') }
    ]
  });

  if (isCancel(mode)) {
    cancel(t('common.cancelled'));
    process.exit(0);
  }

  const defaultEvents = existingCfg?.enabledEvents || HOOK_EVENTS;
  const enabledEvents = await multiselect({
    message: t('security.eventsToGuard'),
    options: HOOK_EVENTS.map((e) => ({ value: e, label: e })),
    initialValues: defaultEvents.filter((e) => HOOK_EVENTS.includes(e)),
    required: false
  });

  if (isCancel(enabledEvents)) {
    cancel(t('common.cancelled'));
    process.exit(0);
  }

  const action = await select({
    message: t('security.applyOrUninstall'),
    options: [
      { value: 'apply', label: t('security.applyWrite') },
      { value: 'remove', label: t('security.removeHooks') },
      { value: 'exit', label: t('security.exitNoChanges') }
    ]
  });

  if (isCancel(action) || action === 'exit') {
    cancel(t('common.noChangesWritten'));
    process.exit(0);
  }

  const settingsPath = configPathForScope(scope, projectDir);

  const existingRes = await readJsonIfExists(settingsPath);
  if (!existingRes.ok) {
    cancel(t('cli.couldNotReadJson', { path: settingsPath }));
    note(String(existingRes.error?.message || existingRes.error), t('common.error'));
    process.exit(1);
  }

  let settings = existingRes.value;

  const s = spinner();
  s.start(t('common.writingSettings'));
  if (action === 'remove') {
    settings = removeAllManagedSecurityHooks(settings);
  } else {
    settings = applySecurityToSettings(settings, { enabledEvents, mode });
  }
  await writeJson(settingsPath, settings);

  // ── Write / update claude-code-hooks.config.json ────────────────────────
  if (action === 'apply') {
    const rawCfg = cfgRes.ok ? { ...cfgRes.value } : {};
    const nextCfg = upsertConfigSection(rawCfg, 'security', { mode, enabledEvents });
    await writeProjectConfig(nextCfg, projectDir);
  }
  s.stop(t('common.done'));

  const cfgPath = configFilePath(projectDir);
  outro(`${t('common.savedHooksTo')} ${pc.bold(settingsPath)}\n` + (action === 'apply' ? `  ${t('common.configSavedTo')} ${pc.bold(cfgPath)}` : ''));
}
