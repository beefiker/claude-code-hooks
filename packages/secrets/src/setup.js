import { intro, outro, select, multiselect, isCancel, cancel, note, spinner } from '@clack/prompts';
import { ansi as pc, SCOPE_OPTIONS, upsertConfigSection } from '@claude-hooks/core';
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
    note(`Found existing ${pc.bold('claude-hooks.config.json')} — using it to pre-fill defaults.`, 'Config detected');
  }

  const scope = await select({
    message: 'Where do you want to write Claude Code hook settings?',
    options: SCOPE_OPTIONS
  });

  if (isCancel(scope)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const defaultMode = existingCfg?.mode || 'warn';
  const mode = await select({
    message: 'How should claude-secrets behave when it detects secret-like tokens?',
    initialValue: defaultMode,
    options: [
      { value: 'warn', label: `Warn only ${pc.dim('(recommended to start)')}` },
      { value: 'block', label: `Block private-key findings (exit 2) ${pc.dim('(HIGH only)')}` }
    ]
  });

  if (isCancel(mode)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const defaultEvents = existingCfg?.enabledEvents || HOOK_EVENTS;
  const enabledEvents = await multiselect({
    message: 'Which events should be guarded?',
    options: HOOK_EVENTS.map((e) => ({ value: e, label: e })),
    initialValues: defaultEvents.filter((e) => HOOK_EVENTS.includes(e)),
    required: false
  });

  if (isCancel(enabledEvents)) {
    cancel('Cancelled');
    process.exit(0);
  }

  const action = await select({
    message: 'Apply or remove?',
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
    const nextCfg = upsertConfigSection(rawCfg, 'secrets', { mode, enabledEvents });
    await writeProjectConfig(nextCfg, projectDir);
  }

  s.stop('Done');

  const cfgPath = configFilePath(projectDir);
  outro(`Saved hooks to ${pc.bold(settingsPath)}\n` + (action === 'apply' ? `  Config saved to ${pc.bold(cfgPath)}` : ''));
}
