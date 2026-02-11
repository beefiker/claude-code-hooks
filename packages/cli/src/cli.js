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
  spinner,
  updateSettings
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
  removeLegacyClaudeSoundHooks,
  t,
  detectLanguage
} from '@claude-code-hooks/core';

// Apply localized messages for Clack prompts (cancel, error)
if (detectLanguage() !== 'en') {
  updateSettings({
    messages: {
      cancel: t('common.cancelled'),
      error: t('common.error')
    }
  });
}

import { buildSettingsSnippet } from './snippet.js';

// In-workspace imports (when running from monorepo) and normal Node resolution
// (when installed from npm) both resolve these packages.
import { planInteractiveSetup as planSecuritySetup } from '@claude-code-hooks/security/src/plan.js';
import { planInteractiveSetup as planSecretsSetup } from '@claude-code-hooks/secrets/src/plan.js';
import { planInteractiveSetup as planSoundSetup } from '@claude-code-hooks/sound/src/plan.js';
import { planInteractiveSetup as planNotificationSetup } from '@claude-code-hooks/notification/src/plan.js';

function dieCancelled(msg) {
  cancel(msg ?? t('cli.cancelled'));
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
  process.stdout.write(t('cli.usage') + '\n');
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
    message: t('cli.writeSnippet'),
    initialValue: false
  });
  if (isCancel(ok)) return;
  if (!ok) return;

  const filePath = path.join(projectDir, 'claude-code-hooks.snippet.json');
  await fs.writeFile(filePath, JSON.stringify(snippetObj, null, 2) + '\n');
  note(filePath, t('cli.wroteSnippet'));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);

  // i18n: --lang ko or env CLAUDE_CODE_HOOKS_LANG
  const langIdx = args.indexOf('--lang');
  if (langIdx !== -1 && args[langIdx + 1]) {
    process.env.CLAUDE_CODE_HOOKS_LANG = args[langIdx + 1].toLowerCase().slice(0, 2);
  }

  const projectDir = process.cwd();

  intro('claude-code-hooks');
  note(t('cli.navHint'), t('cli.navTitle'));

  // ── Step 1–3: action, target, packages (Backspace = go to previous step) ──
  let action;
  let target;
  let selected;
  let step = 1;
  /** @type {{ security: unknown; secrets: unknown; sound: unknown; notification: unknown }} */
  let perPackage = { security: null, secrets: null, sound: null, notification: null };

  const packageOptions = [
    { value: 'security', label: t('cli.pkgSecurity'), hint: t('cli.pkgSecurityHint') },
    { value: 'secrets', label: t('cli.pkgSecrets'), hint: t('cli.pkgSecretsHint') },
    { value: 'sound', label: t('cli.pkgSound'), hint: t('cli.pkgSoundHint') },
    { value: 'notification', label: t('cli.pkgNotification'), hint: t('cli.pkgNotificationHint') }
  ];

  while (true) {
    if (step === 1) {
      action = await select({
        message: `${pc.dim(t('cli.stepFormat', { n: 1 }))}  ${t('cli.step1ChooseAction')}`,
        options: [
          { value: 'setup', label: t('cli.actionSetup') },
          { value: 'uninstall', label: t('cli.actionUninstall') },
          { value: 'exit', label: t('cli.actionExit') }
        ]
      });
      if (isCancel(action) || action === 'exit') dieCancelled(t('cli.bye'));
      step = 2;
    }

    if (step === 2) {
      const targetCtrl = new AbortController();
      const { result: targetResult, wentBack: targetBack } = await withBackspaceBack(targetCtrl, () =>
        select({
          message: `${pc.dim(t('cli.stepFormat', { n: 2 }))}  ${t('cli.step2ChooseTarget')}`,
          options: [
            { value: 'global', label: t('cli.targetGlobal') },
            { value: 'projectOnly', label: t('cli.targetProjectOnly').replace(CONFIG_FILENAME, pc.bold(CONFIG_FILENAME)) }
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
          message: `${pc.dim(t('cli.stepFormat', { n: 3 }))}  ${t('cli.step3SelectPackages')}`,
          options: packageOptions,
          required: true,
          validate: (v) => (!v || v.length === 0) ? t('common.selectAtLeastOne') : true,
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
        confirm({ message: t('cli.configureNow'), initialValue: true, signal: proceedCtrl.signal })
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
      security: t('cli.pkgSecurityHint'),
      secrets: t('cli.pkgSecretsHint'),
      sound: t('cli.pkgSoundHint'),
      notification: t('cli.pkgNotificationHint')
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
      note(formatPackageList('security'), `${pc.dim(t('cli.stepFormat', { n: 4 }))}  ${t('cli.step4Configure')}`);
      perPackage.security = await planSecuritySetup({ action, projectDir, ui: 'umbrella' });
    }
    if (selected.includes('secrets')) {
      note(formatPackageList('secrets'), `${pc.dim(t('cli.stepFormat', { n: 4 }))}  ${t('cli.step4Configure')}`);
      perPackage.secrets = await planSecretsSetup({ action, projectDir, ui: 'umbrella' });
    }
    if (selected.includes('sound')) {
      note(formatPackageList('sound'), `${pc.dim(t('cli.stepFormat', { n: 4 }))}  ${t('cli.step4Configure')}`);
      perPackage.sound = await planSoundSetup({ action, projectDir, ui: 'umbrella' });
    }
    if (selected.includes('notification')) {
      note(formatPackageList('notification'), `${pc.dim(t('cli.stepFormat', { n: 4 }))}  ${t('cli.step4Configure')}`);
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
      if (!plan) return `${key}: ${t('cli.summarySkipped')}`;
      if (action === 'uninstall') return `${key}: ${t('cli.summaryRemoveHooks')}`;

      const events = plan.snippetHooks ? Object.keys(plan.snippetHooks) : [];
      const list = events.slice(0, 5);
      const tail = events.length > 5 ? ` +${events.length - 5} more` : '';
      return `${key}: ${t('cli.summaryEvents', { count: events.length })}${events.length ? ` (${list.join(', ')}${tail})` : ''}`;
    }

    note(
      [
        `${pc.dim(t('cli.stepFormat', { n: 5 }))}  ${t('cli.step5Review')}`,
        '',
        `${t('cli.reviewAction')}: ${pc.bold(action)}`,
        `${t('cli.reviewTarget')}: ${pc.bold(target === 'global' ? t('cli.reviewTargetGlobal') : t('cli.reviewTargetProjectOnly'))}`,
        '',
        `${pc.bold(t('cli.reviewPackages'))}`,
        ...selected.map((k) => `  - ${summarizePlan(k, perPackage[k])}`),
        '',
        `${pc.bold(t('cli.reviewFiles'))}`,
        ...files.map((f) => `  - ${f}`)
      ].join('\n'),
      t('cli.step5Review')
    );

    const applyCtrl = new AbortController();
    const { result: applyResult, wentBack: applyBack } = await withBackspaceBack(applyCtrl, () =>
      select({
        message: t('cli.applyChanges'),
        options: [
          { value: 'yes', label: t('cli.applyYes') },
          { value: 'cancel', label: t('cli.applyCancel') }
        ],
        signal: applyCtrl.signal
      })
    );
    if (applyBack) {
      step = 3;
      continue;
    }
    if (isCancel(applyResult) || applyResult === 'cancel') dieCancelled(t('cli.noChanges'));

    break;
  }

  if (target === 'projectOnly') {
    // Write project config
    const s = spinner();
    s.start(t('cli.writingProjectConfig'));

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

    s.stop(t('cli.done'));

    note(JSON.stringify(snippetObj, null, 2), t('cli.pasteSnippet'));
    await maybeWriteSnippet(projectDir, snippetObj);

    outro(`${t('cli.projectConfigWritten')}: ${pc.bold(configFilePath(projectDir))}`);
    return;
  }

  // Global apply: read settings.json, apply transforms, write once.
  const settingsPath = configPathForScope('global', projectDir);
  const res = await readJsonIfExists(settingsPath);
  if (!res.ok) {
    cancel(t('cli.couldNotReadJson', { path: settingsPath }));
    process.exit(1);
  }

  let settings = res.value;

  const s = spinner();
  s.start(t('cli.applyingChanges'));

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

  s.stop(t('cli.done'));
  outro(`${t('cli.saved')}: ${pc.bold(settingsPath)}`);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
