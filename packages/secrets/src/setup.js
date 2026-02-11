import { intro, outro, select, multiselect, confirm, isCancel, cancel, note, spinner } from '@clack/prompts';
import { ansi as pc, t, upsertConfigSection } from '@claude-code-hooks/core';
import {
  HOOK_EVENTS,
  configPathForScope,
  readJsonIfExists,
  writeJson,
  applySecretsToSettings,
  removeAllManagedSecretsHooks
} from './hooks.js';
import { readProjectConfig, resolveSecretsConfig, writeProjectConfig, configFilePath } from './config.js';

export async function interactiveSetup() {
  intro('claude-secrets');

  const projectDir = process.cwd();
  const cfgRes = await readProjectConfig(projectDir);
  const existingCfg = cfgRes.ok ? resolveSecretsConfig(cfgRes.value) : null;
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
    message: t('secrets.whenSecretFound'),
    initialValue: defaultMode,
    options: [
      { value: 'warn', label: t('secrets.warnRecommended') },
      { value: 'block', label: t('secrets.blockHigh'), hint: t('secrets.blockHint') }
    ]
  });

  if (isCancel(mode)) {
    cancel(t('common.cancelled'));
    process.exit(0);
  }

  const defaultEvents = existingCfg?.enabledEvents || HOOK_EVENTS;
  const enabledEvents = await multiselect({
    message: t('secrets.eventsToScan'),
    options: HOOK_EVENTS.map((e) => ({ value: e, label: e })),
    initialValues: defaultEvents.filter((e) => HOOK_EVENTS.includes(e)),
    required: false
  });

  if (isCancel(enabledEvents)) {
    cancel(t('common.cancelled'));
    process.exit(0);
  }

  const defaultScanGitCommit = existingCfg?.scanGitCommit ?? false;
  const scanGitCommit = await confirm({
    message: t('secrets.scanGitCommit'),
    initialValue: defaultScanGitCommit,
    active: t('common.yes'),
    inactive: t('common.no')
  });

  if (isCancel(scanGitCommit)) {
    cancel(t('common.cancelled'));
    process.exit(0);
  }

  const action = await select({
    message: t('secrets.applyOrUninstall'),
    options: [
      { value: 'apply', label: t('secrets.applyWrite') },
      { value: 'remove', label: t('secrets.removeHooks') },
      { value: 'exit', label: t('secrets.exitNoChanges') }
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
    settings = removeAllManagedSecretsHooks(settings);
  } else {
    settings = applySecretsToSettings(settings, { enabledEvents, mode });
  }

  await writeJson(settingsPath, settings);

  if (action === 'apply') {
    const rawCfg = cfgRes.ok ? { ...cfgRes.value } : {};
    const nextCfg = upsertConfigSection(rawCfg, 'secrets', { mode, enabledEvents, scanGitCommit });
    await writeProjectConfig(nextCfg, projectDir);
  }

  s.stop(t('common.done'));

  const cfgPath = configFilePath(projectDir);
  outro(`${t('common.savedHooksTo')} ${pc.bold(settingsPath)}\n` + (action === 'apply' ? `  ${t('common.configSavedTo')} ${pc.bold(cfgPath)}` : ''));
}
