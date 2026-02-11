#!/usr/bin/env node

import process from 'node:process';
import readline from 'node:readline';
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

// Enable keypress events so we can intercept Backspace
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
}

import {
  ansi as pc,
  configPathForScope,
  readJsonIfExists,
  writeJson,
  CONFIG_FILENAME,
  configFilePath,
  readProjectConfig,
  writeProjectConfig,
  removeLegacyClaudeSoundHooks
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

/**
 * Run a prompt with Backspace = go back. When Backspace is pressed, aborts and returns
 * { wentBack: true }. ESC still exits. Caller must handle wentBack by continuing the loop.
 * @param {AbortController} controller
 * @param {() => Promise<T>} runPrompt - async function that runs the prompt (receives no args)
 * @returns {Promise<{ result: T; wentBack: boolean }>}
 */
async function withBackspaceBack(controller, runPrompt) {
  let wentBack = false;
  const handler = (_str, key) => {
    if (key?.name === 'backspace') {
      wentBack = true;
      controller.abort();
    }
  };
  process.stdin.on('keypress', handler);
  try {
    const result = await runPrompt();
    return { result, wentBack };
  } finally {
    process.stdin.off('keypress', handler);
  }
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
  note(`${pc.dim('ESC')} to exit  •  ${pc.dim('Backspace')} to go back`, 'Navigation');

  // ── Step 1–3: action, target, packages (Backspace = go to previous step) ──
  let action;
  let target;
  let selected;
  let step = 1;
  /** @type {{ security: unknown; secrets: unknown; sound: unknown; notification: unknown }} */
  let perPackage = { security: null, secrets: null, sound: null, notification: null };

  const packageOptions = [
    { value: 'security', label: '@claude-code-hooks/security', hint: 'Warn/block risky commands' },
    { value: 'secrets', label: '@claude-code-hooks/secrets', hint: 'Detect secret-like tokens' },
    { value: 'sound', label: '@claude-code-hooks/sound', hint: 'Play sounds for key events' },
    { value: 'notification', label: '@claude-code-hooks/notification', hint: 'OS notifications for key events' }
  ];

  while (true) {
    if (step === 1) {
      action = await select({
        message: `${pc.dim('Step 1/5')}  Choose an action`,
        options: [
          { value: 'setup', label: 'Install / update packages' },
          { value: 'uninstall', label: 'Uninstall (remove managed hooks)' },
          { value: 'exit', label: 'Exit' }
        ]
      });
      if (isCancel(action) || action === 'exit') dieCancelled('Bye');
      step = 2;
    }

    if (step === 2) {
      const targetCtrl = new AbortController();
      const { result: targetResult, wentBack: targetBack } = await withBackspaceBack(targetCtrl, () =>
        select({
          message: `${pc.dim('Step 2/5')}  Choose a target`,
          options: [
            { value: 'global', label: `Global (default): ${pc.dim('~/.claude/settings.json')}` },
            { value: 'projectOnly', label: `Project-only: write ${pc.bold(CONFIG_FILENAME)} + print a snippet` }
          ],
          signal: targetCtrl.signal
        })
      );
      if (targetBack) {
        step = 1;
        continue;
      }
      if (isCancel(targetResult)) dieCancelled();
      target = targetResult;
      step = 3;
    }

    if (step === 3) {
      const pkgsCtrl = new AbortController();
      const { result: pkgsResult, wentBack: pkgsBack } = await withBackspaceBack(pkgsCtrl, () =>
        multiselect({
          message: `${pc.dim('Step 3/5')}  Select packages`,
          options: packageOptions,
          required: true,
          signal: pkgsCtrl.signal
        })
      );
      if (pkgsBack) {
        step = 2;
        continue;
      }
      if (isCancel(pkgsResult)) dieCancelled();
      selected = pkgsResult;
      step = 4;
    }

    if (step === 4) {
      const proceedCtrl = new AbortController();
      const { result: proceedResult, wentBack: proceedBack } = await withBackspaceBack(proceedCtrl, () =>
        confirm({ message: 'Configure these packages now?', initialValue: true, signal: proceedCtrl.signal })
      );
      if (proceedBack) {
        step = 3;
        continue;
      }
      if (isCancel(proceedResult)) dieCancelled();
      if (!proceedResult) {
        step = 2;
        continue;
      }
      step = 5;
    }

    if (step !== 5) continue;

    // Build per-package plan/config
    perPackage = { security: null, secrets: null, sound: null, notification: null };

    const packageDescs = {
      security: 'Warn/block risky commands',
      secrets: 'Detect secret-like tokens',
      sound: 'Play sounds for key events',
      notification: 'OS notifications for key events'
    };

    const formatPackageList = (/** @type {string | null} */ highlightKey) =>
      selected
        .map(
          (k) => {
            const desc = pc.dim(packageDescs[k] || '');
            const label = highlightKey === k ? pc.cyan(pc.bold(k)) : pc.bold(k);
            return `${label}: ${desc}`;
          }
        )
        .join('\n');

    // ── Step 4/5: configure (highlight current package) ──
    if (selected.includes('security')) {
      note(formatPackageList('security'), `${pc.dim('Step 4/5')}  Configure packages`);
      perPackage.security = await planSecuritySetup({ action, projectDir, ui: 'umbrella' });
    }
    if (selected.includes('secrets')) {
      note(formatPackageList('secrets'), `${pc.dim('Step 4/5')}  Configure packages`);
      perPackage.secrets = await planSecretsSetup({ action, projectDir, ui: 'umbrella' });
    }
    if (selected.includes('sound')) {
      note(formatPackageList('sound'), `${pc.dim('Step 4/5')}  Configure packages`);
      perPackage.sound = await planSoundSetup({ action, projectDir, ui: 'umbrella' });
    }
    if (selected.includes('notification')) {
      note(formatPackageList('notification'), `${pc.dim('Step 4/5')}  Configure packages`);
      perPackage.notification = await planNotificationSetup({ action, projectDir, ui: 'umbrella' });
    }

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

    const applyCtrl = new AbortController();
    const { result: applyResult, wentBack: applyBack } = await withBackspaceBack(applyCtrl, () =>
      select({
        message: 'Apply changes?',
        options: [
          { value: 'yes', label: 'Yes, apply' },
          { value: 'cancel', label: 'Cancel (exit)' }
        ],
        signal: applyCtrl.signal
      })
    );
    if (applyBack) {
      step = 3;
      continue;
    }
    if (isCancel(applyResult) || applyResult === 'cancel') dieCancelled('No changes made');

    break;
  }

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

  // Remove legacy claude-sound hooks (from old standalone package) to avoid duplicates
  settings = removeLegacyClaudeSoundHooks(settings);

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
