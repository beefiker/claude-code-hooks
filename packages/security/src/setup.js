import {
  ansi as pc,
  SCOPE_OPTIONS,
  upsertConfigSection,
  intro,
  outro,
  select,
  multiselect,
  isCancel,
  cancel,
  note,
  spinner
} from '@claude-code-hooks/core';
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
    note(`Found existing ${pc.bold('claude-code-hooks.config.json')} — using it to pre-fill defaults.`, 'Config detected');
  }

  // ── Scope ──────────────────────────────────────────────────────────
  const scope = await select({
    message: 'Where do you want to write Claude Code hook settings?',
    options: SCOPE_OPTIONS
  });

  if (isCancel(scope)) {
    cancel('Cancelled');
    process.exit(0);
  }

  // ── Mode ───────────────────────────────────────────────────────────
  const defaultMode = existingCfg?.mode || 'warn';
  const mode = await select({
    message: 'How should claude-security behave when it detects a risk?',
    initialValue: defaultMode,
    options: [
      { value: 'warn', label: `Warn only ${pc.dim('(recommended to start)')}` },
      { value: 'block', label: `Block (exit 2) ${pc.dim('(may interrupt workflows)')}` }
    ]
  });

  if (isCancel(mode)) {
    cancel('Cancelled');
    process.exit(0);
  }

  // ── Events ─────────────────────────────────────────────────────────
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

  // ── Apply / Remove ─────────────────────────────────────────────────
  const action = await select({
    message: 'Apply or remove?',
    options: [
      { value: 'apply', label: 'Apply (write settings)' },
      { value: 'remove', label: 'Remove all claude-security hooks' },
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
  s.stop('Done');

  const cfgPath = configFilePath(projectDir);
  outro(`Saved hooks to ${pc.bold(settingsPath)}\n` + (action === 'apply' ? `  Config saved to ${pc.bold(cfgPath)}` : ''));
}
