import { intro, outro, select, multiselect, confirm, isCancel, cancel, note, spinner } from '@clack/prompts';
import { ansi as pc, SCOPE_OPTIONS, upsertConfigSection } from '@claude-code-hooks/core';
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
    note(`Found existing ${pc.bold('claude-code-hooks.config.json')} — using it to pre-fill defaults.`, 'Config detected');
  }

  const scope = await select({
    message: 'Write hook settings to:',
    options: SCOPE_OPTIONS
  });

  if (isCancel(scope)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const defaultMode = existingCfg?.mode || 'warn';
  const mode = await select({
    message: 'When a secret-like token is found…',
    initialValue: defaultMode,
    options: [
      { value: 'warn', label: 'Warn (recommended)' },
      { value: 'block', label: 'Block HIGH findings (exit 2)', hint: 'Private key material' }
    ]
  });

  if (isCancel(mode)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const defaultEvents = existingCfg?.enabledEvents || HOOK_EVENTS;
  const enabledEvents = await multiselect({
    message: 'Events to scan',
    options: HOOK_EVENTS.map((e) => ({ value: e, label: e })),
    initialValues: defaultEvents.filter((e) => HOOK_EVENTS.includes(e)),
    required: false
  });

  if (isCancel(enabledEvents)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const defaultScanGitCommit = existingCfg?.scanGitCommit ?? false;
  const scanGitCommit = await confirm({
    message: `Scan staged files on ${pc.bold('git commit')}?`,
    initialValue: defaultScanGitCommit
  });

  if (isCancel(scanGitCommit)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const action = await select({
    message: 'Apply changes or uninstall?',
    options: [
      { value: 'apply', label: 'Apply (write settings)' },
      { value: 'remove', label: 'Remove all claude-secrets hooks' },
      { value: 'exit', label: 'Exit (no changes)' }
    ]
  });

  if (isCancel(action) || action === 'exit') {
    cancel('No changes written');
    process.exit(0);
  }

  const settingsPath = configPathForScope(scope, projectDir);
  const existingRes = await readJsonIfExists(settingsPath);
  if (!existingRes.ok) {
    cancel(`Could not read/parse JSON at ${settingsPath}`);
    note(String(existingRes.error?.message || existingRes.error), 'Error');
    process.exit(1);
  }

  let settings = existingRes.value;

  const s = spinner();
  s.start('Writing settings...');

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

  s.stop('Done');

  const cfgPath = configFilePath(projectDir);
  outro(`Saved hooks to ${pc.bold(settingsPath)}\n` + (action === 'apply' ? `  Config saved to ${pc.bold(cfgPath)}` : ''));
}
