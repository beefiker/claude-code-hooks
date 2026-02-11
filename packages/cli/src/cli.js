#!/usr/bin/env node

import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  intro,
  outro,
  select,
  multiselect,
  confirm,
  isCancel,
  cancel,
  note,
  spinner
} from '@clack/prompts';

import {
  ansi as pc,
  configPathForScope,
  readJsonIfExists,
  writeJson,
  CONFIG_FILENAME,
  configFilePath,
  readProjectConfig,
  writeProjectConfig
} from '@claude-code-hooks/core';

import { buildSettingsSnippet } from './snippet.js';

// In-workspace imports (when running from monorepo) and normal Node resolution
// (when installed from npm) both resolve these packages.
import { planInteractiveSetup as planSecuritySetup } from '@claude-code-hooks/security/src/plan.js';
import { planInteractiveSetup as planSecretsSetup } from '@claude-code-hooks/secrets/src/plan.js';
import { planInteractiveSetup as planSoundSetup } from '@claude-code-hooks/sound/src/plan.js';
import { planInteractiveSetup as planNotificationSetup } from '@claude-code-hooks/notification/src/plan.js';

function dieCancelled(msg = 'Cancelled') {
  cancel(msg);
  process.exit(0);
}

function usage(exitCode = 0) {
  process.stdout.write(`\
claude-code-hooks\n\nUsage:\n  claude-code-hooks\n  npx @claude-code-hooks/cli@latest\n\nWhat it does:\n  - Update Claude Code settings (global), or generate a project-only config + pasteable snippet.\n`);
  process.exit(exitCode);
}

async function ensureProjectOnlyConfig(projectDir, selected, perPackageConfig) {
  const cfgRes = await readProjectConfig(projectDir);
  const rawCfg = cfgRes.ok ? { ...(cfgRes.value || {}) } : {};

  // Our existing project config format is sectioned by package key.
  // Keep only what we touch, preserve others.
  const out = { ...rawCfg };

  if (selected.includes('security') && perPackageConfig.security) out.security = perPackageConfig.security;
  if (selected.includes('secrets') && perPackageConfig.secrets) out.secrets = perPackageConfig.secrets;
  if (selected.includes('sound') && perPackageConfig.sound) out.sound = perPackageConfig.sound;
  if (selected.includes('notification') && perPackageConfig.notification) out.notification = perPackageConfig.notification;

  await writeProjectConfig(out, projectDir);
  return out;
}

async function maybeWriteSnippet(projectDir, snippetObj) {
  const ok = await confirm({
    message: `Write snippet file (${pc.bold('claude-code-hooks.snippet.json')}) to this project?`,
    initialValue: false
  });
  if (isCancel(ok)) return;
  if (!ok) return;

  const filePath = path.join(projectDir, 'claude-code-hooks.snippet.json');
  await fs.writeFile(filePath, JSON.stringify(snippetObj, null, 2) + '\n');
  note(filePath, 'Wrote snippet');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);

  const projectDir = process.cwd();

  intro('claude-code-hooks');

  // ── Step 1–3: action, target, packages (with simple back navigation) ──
  let action;
  let target;
  let selected;

  while (true) {
    action = await select({
      message: `${pc.dim('Step 1/5')}  Choose an action`,
      options: [
        { value: 'setup', label: 'Install / update packages' },
        { value: 'uninstall', label: 'Uninstall (remove managed hooks)' },
        { value: 'exit', label: 'Exit' }
      ]
    });
    if (isCancel(action) || action === 'exit') dieCancelled('Bye');

    target = await select({
      message: `${pc.dim('Step 2/5')}  Choose a target`,
      options: [
        { value: 'global', label: `Global (default): ${pc.dim('~/.claude/settings.json')}` },
        { value: 'projectOnly', label: `Project-only: write ${pc.bold(CONFIG_FILENAME)} + print a snippet` },
        { value: '__back__', label: 'Back' }
      ]
    });
    if (isCancel(target)) dieCancelled();
    if (target === '__back__') continue;

    selected = await multiselect({
      message: `${pc.dim('Step 3/5')}  Select packages`,
      options: [
        { value: 'security', label: '@claude-code-hooks/security', hint: 'Warn/block risky commands' },
        { value: 'secrets', label: '@claude-code-hooks/secrets', hint: 'Detect secret-like tokens' },
        { value: 'sound', label: '@claude-code-hooks/sound', hint: 'Play sounds for key events' },
        { value: 'notification', label: '@claude-code-hooks/notification', hint: 'OS notifications for key events' }
      ],
      required: true
    });
    if (isCancel(selected)) dieCancelled();

    const proceed = await confirm({ message: 'Configure these packages now?', initialValue: true });
    if (isCancel(proceed)) dieCancelled();
    if (!proceed) continue;

    break;
  }

  // Build per-package plan/config
  const perPackage = { security: null, secrets: null, sound: null, notification: null };

  // ── Step 4/5: configure ──
  note(
    selected
      .map(
        (k) =>
          `${pc.bold(k)}: ${pc.dim(
            {
              security: 'Warn/block risky commands',
              secrets: 'Detect secret-like tokens',
              sound: 'Play sounds for key events',
              notification: 'OS notifications for key events'
            }[k] || ''
          )}`
      )
      .join('\n'),
    `${pc.dim('Step 4/5')}  Configure packages`
  );

  if (selected.includes('security')) perPackage.security = await planSecuritySetup({ action, projectDir, ui: 'umbrella' });
  if (selected.includes('secrets')) perPackage.secrets = await planSecretsSetup({ action, projectDir, ui: 'umbrella' });
  if (selected.includes('sound')) perPackage.sound = await planSoundSetup({ action, projectDir, ui: 'umbrella' });
  if (selected.includes('notification')) perPackage.notification = await planNotificationSetup({ action, projectDir, ui: 'umbrella' });

  // ── Step 5/5: review ──
  const files = [];
  if (target === 'global') files.push(configPathForScope('global', projectDir));
  if (target === 'projectOnly') {
    files.push(path.join(projectDir, CONFIG_FILENAME));
    files.push(path.join(projectDir, 'claude-code-hooks.snippet.json (optional)'));
  }

  function summarizePlan(key, plan) {
    if (!plan) return `${key}: (skipped)`;
    if (action === 'uninstall') return `${key}: remove managed hooks`;

    const events = plan.snippetHooks ? Object.keys(plan.snippetHooks) : [];
    const list = events.slice(0, 5);
    const tail = events.length > 5 ? ` +${events.length - 5} more` : '';
    return `${key}: ${events.length} event(s)${events.length ? ` (${list.join(', ')}${tail})` : ''}`;
  }

  note(
    [
      `${pc.dim('Step 5/5')}  Review`,
      '',
      `Action: ${pc.bold(action)}`,
      `Target: ${pc.bold(target === 'global' ? 'global settings' : 'project-only')}`,
      '',
      `${pc.bold('Packages')}`,
      ...selected.map((k) => `  - ${summarizePlan(k, perPackage[k])}`),
      '',
      `${pc.bold('Files')}`,
      ...files.map((f) => `  - ${f}`)
    ].join('\n'),
    'Review'
  );

  const ok = await confirm({ message: 'Apply changes?', initialValue: true });
  if (isCancel(ok) || !ok) dieCancelled('No changes made');

  if (target === 'projectOnly') {
    // Write project config
    const s = spinner();
    s.start('Writing project config...');

    // perPackage.*.projectConfigSection is shaped for claude-code-hooks.config.json sections.
    const projectCfg = await ensureProjectOnlyConfig(projectDir, selected, {
      security: perPackage.security?.projectConfigSection,
      secrets: perPackage.secrets?.projectConfigSection,
      sound: perPackage.sound?.projectConfigSection,
      notification: perPackage.notification?.projectConfigSection
    });

    // Print snippet for user to paste into global settings.
    const snippetObj = buildSettingsSnippet({
      projectDir,
      selected,
      packagePlans: {
        security: perPackage.security,
        secrets: perPackage.secrets,
        sound: perPackage.sound,
        notification: perPackage.notification
      }
    });

    s.stop('Done');

    note(JSON.stringify(snippetObj, null, 2), 'Paste into ~/.claude/settings.json (global)');
    await maybeWriteSnippet(projectDir, snippetObj);

    outro(`Project config written: ${pc.bold(configFilePath(projectDir))}`);
    return;
  }

  // Global apply: read settings.json, apply transforms, write once.
  const settingsPath = configPathForScope('global', projectDir);
  const res = await readJsonIfExists(settingsPath);
  if (!res.ok) {
    cancel(`Could not read/parse JSON at ${settingsPath}`);
    process.exit(1);
  }

  let settings = res.value;

  const s = spinner();
  s.start('Applying changes to global settings...');

  for (const key of selected) {
    const plan = perPackage[key];
    if (!plan) continue;
    settings = await plan.applyToSettings(settings);
  }

  await writeJson(settingsPath, settings);

  // Update project config only on setup.
  if (action === 'setup') {
    await ensureProjectOnlyConfig(projectDir, selected, {
      security: perPackage.security?.projectConfigSection,
      secrets: perPackage.secrets?.projectConfigSection,
      sound: perPackage.sound?.projectConfigSection,
      notification: perPackage.notification?.projectConfigSection
    });
  }

  s.stop('Done');
  outro(`Saved: ${pc.bold(settingsPath)}`);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
