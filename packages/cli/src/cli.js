#!/usr/bin/env node

import process from 'node:process';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import {
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

// Restore terminal if process exits while stdin is in raw mode (e.g. crash mid-prompt)
process.on('exit', () => {
  if (process.stdin.isTTY && process.stdin.isRaw) {
    process.stdin.setRawMode(false);
  }
});

import {
  ansi as pc,
  configPathForScope,
  readJsonIfExists,
  writeJson,
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

function showWelcome() {
  let version = '';
  try {
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    version = pkg.version ? ` v${pkg.version}` : '';
  } catch {
    // ignore
  }

  const width = 48;
  const pad = '\n';
  const particles = ['·', '•', '✦', '✧', '◦', '▪', 'º', '∗'];
  const colors = [pc.blue, pc.cyan, pc.yellow, pc.magenta, pc.green];

  const particleLine = (seed) => {
    const len = width - 2;
    let s = '  ';
    for (let i = 0; i < len; i++) {
      const show =
        ((i * 17 + seed) % 5 === 0) ||
        ((i * 13 + seed + 3) % 6 === 0) ||
        ((i * 11 + seed + 1) % 4 === 0) ||
        ((i * 19 + seed + 5) % 7 === 0);
      s += show ? colors[(i + seed) % colors.length](particles[(i + seed) % particles.length]) : ' ';
    }
    return s + '\n';
  };

  const icon = pc.blue('◆');
  const line = `  ${pc.blue('═')}${pc.cyan('═'.repeat(width - 4))}${pc.blue('═')}`;
  const lineBottom = `  ${pc.yellow('═')}${pc.magenta('═'.repeat(width - 4))}${pc.yellow('═')}`;

  process.stdout.write(pad);
  process.stdout.write(particleLine(0));
  process.stdout.write(line + pad);
  process.stdout.write(pad);
  process.stdout.write(`  ${icon}  ${pc.blue(pc.bold(t('cli.welcomeTitle')))}${version ? pc.gray(version) : ''}\n`);
  process.stdout.write(pad);
  process.stdout.write(`  ${pc.brightCyan('Customize Claude Code with zero dependencies')}\n`);
  process.stdout.write(pad);
  process.stdout.write(lineBottom + pad);
  process.stdout.write(particleLine(5));
  process.stdout.write(pad);
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

const GITIGNORE_LOCAL_ENTRY = '.claude/settings.local.json';

/**
 * Returns true if the trimmed gitignore line would cause settings.local.json to be ignored.
 */
function wouldIgnoreLocalSettings(line) {
  const t = line.replace(/#.*$/, '').trim();
  if (!t) return false;
  if (t === GITIGNORE_LOCAL_ENTRY || t === '**/' + GITIGNORE_LOCAL_ENTRY) return true;
  if (t === '.claude/' || t === '.claude' || t === '**/.claude/' || t === '**/.claude') return true;
  if (t === '.claude/*' || t === '.claude/**' || t.includes('**/.claude')) return true;
  if (t.includes('settings.local.json')) return true;
  return false;
}

/**
 * Ensures .gitignore in projectDir contains an entry to ignore settings.local.json.
 * Called when user selects project (local) so their per-developer settings stay untracked.
 * Never throws: catches all errors to avoid crashing the CLI.
 */
async function ensureGitignoreLocalEntry(projectDir) {
  try {
    const gitignorePath = path.join(projectDir, '.gitignore');
    let content = '';
    try {
      content = await fs.readFile(gitignorePath, 'utf-8');
    } catch (err) {
      if (err?.code !== 'ENOENT') return;
    }

    const lines = content.split(/\r?\n/);
    if (lines.some(wouldIgnoreLocalSettings)) return;

    const needsNewline = content.length > 0 && !content.endsWith('\n');
    const block = '\n# claude-code-hooks: per-developer local settings\n' + GITIGNORE_LOCAL_ENTRY + '\n';
    await fs.appendFile(gitignorePath, (needsNewline ? '\n' : '') + block);
  } catch {
    // EACCES, EPERM, ENOSPC, etc. — don't crash CLI; settings were already written
  }
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

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);

  // i18n: --lang ko or env CLAUDE_CODE_HOOKS_LANG
  const langIdx = args.indexOf('--lang');
  if (langIdx !== -1 && args[langIdx + 1]) {
    process.env.CLAUDE_CODE_HOOKS_LANG = args[langIdx + 1].toLowerCase().slice(0, 2);
  }

  const projectDir = process.cwd();

  showWelcome();

  /** Build step header: "Step N/5 — <title> (ESC exit · Backspace back)" */
  const stepHeader = (n, title) =>
    pc.dim(t('cli.stepHeader', { n, title, suffix: t('cli.stepHeaderSuffix') }));

  // ── Step 1–5: action, target, packages, configure, review (Backspace = go to previous step) ──
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
        message: stepHeader(1, t('cli.step1ChooseAction')),
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
          message: stepHeader(2, t('cli.step2ChooseTarget')),
          options: [
            { value: 'global', label: t('cli.targetGlobal') },
            { value: 'project', label: t('common.scopeProject') },
            { value: 'projectLocal', label: t('common.scopeProjectLocal') }
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
          message: stepHeader(3, t('cli.step3SelectPackages')),
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
        confirm({ message: stepHeader(4, t('cli.configureNow')), initialValue: true, active: t('common.yes'), inactive: t('common.no'), signal: proceedCtrl.signal })
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
            const label = highlightKey === k ? pc.blue(pc.bold(k)) : pc.bold(k);
            return `${label}: ${desc}`;
          }
        )
        .join('\n');

    // ── Step 4/5: configure (highlight current package) ──
    if (selected.includes('security')) {
      note(formatPackageList('security'), stepHeader(4, t('cli.step4Configure')));
      perPackage.security = await planSecuritySetup({ action, projectDir, ui: 'umbrella' });
    }
    if (selected.includes('secrets')) {
      note(formatPackageList('secrets'), stepHeader(4, t('cli.step4Configure')));
      perPackage.secrets = await planSecretsSetup({ action, projectDir, ui: 'umbrella' });
    }
    if (selected.includes('sound')) {
      note(formatPackageList('sound'), stepHeader(4, t('cli.step4Configure')));
      perPackage.sound = await planSoundSetup({ action, projectDir, ui: 'umbrella' });
    }
    if (selected.includes('notification')) {
      note(formatPackageList('notification'), stepHeader(4, t('cli.step4Configure')));
      perPackage.notification = await planNotificationSetup({ action, projectDir, ui: 'umbrella' });
    }

    // ── Step 5/5: review ──
    const files = [];
    if (target === 'global') files.push(configPathForScope('global', projectDir));
    if (target === 'project') files.push(configPathForScope('project', projectDir));
    if (target === 'projectLocal') files.push(configPathForScope('projectLocal', projectDir));

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
        stepHeader(5, t('cli.step5Review')),
        '',
        `${pc.bold(t('cli.reviewSectionActionTarget'))}`,
        `  ${t('cli.reviewAction')}: ${pc.bold(action)}`,
        `  ${t('cli.reviewTarget')}: ${pc.bold(
          target === 'global' ? t('cli.reviewTargetGlobal') :
          target === 'project' ? t('cli.reviewTargetProject') :
          t('cli.reviewTargetProjectLocal')
        )}`,
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
        message: stepHeader(5, t('cli.applyChanges')),
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

  // Global / project / projectLocal apply: read settings.json, apply transforms, write once.
  const settingsPath = configPathForScope(target, projectDir);
  const pkgLabels = {
    security: t('cli.pkgSecurity'),
    secrets: t('cli.pkgSecrets'),
    sound: t('cli.pkgSound'),
    notification: t('cli.pkgNotification')
  };
  const s = spinner();
  s.start(t('cli.applyingChanges'));

  const res = await readJsonIfExists(settingsPath);
  if (!res.ok) {
    s.stop(t('cli.done'));
    cancel(t('cli.couldNotReadJson', { path: settingsPath }));
    process.exit(1);
  }
  let settings = res.value;

  for (const key of selected) {
    const plan = perPackage[key];
    if (!plan) continue;
    const pkgName = pkgLabels[key] ?? key;
    s.message(t('cli.applyStepApplyPackage', { packageName: pkgName }));
    settings = await plan.applyToSettings(settings);
  }

  s.message(t('cli.applyStepWriteSettings'));
  settings = removeLegacyClaudeSoundHooks(settings);
  await writeJson(settingsPath, settings);
  if (target === 'projectLocal') {
    await ensureGitignoreLocalEntry(projectDir);
  }

  if (action === 'setup') {
    s.message(t('cli.applyStepWriteProjectConfig'));
    await ensureProjectOnlyConfig(projectDir, selected, {
      security: perPackage.security?.projectConfigSection,
      secrets: perPackage.secrets?.projectConfigSection,
      sound: perPackage.sound?.projectConfigSection,
      notification: perPackage.notification?.projectConfigSection
    });
  }
  s.stop('');

  // Build contextual completion note
  const traits = [];
  if (selected.includes('security') || selected.includes('secrets')) traits.push(t('cli.doneTraitSafer'));
  if (selected.includes('sound')) traits.push(t('cli.doneTraitLouder'));
  if (selected.includes('notification')) traits.push(t('cli.doneTraitAttentive'));

  const lines = [];
  lines.push(`${t('cli.saved')}: ${pc.cyan(settingsPath)}`);
  lines.push(`${t('cli.reviewPackages')}: ${selected.map((k) => pc.green(pkgLabels[k] ?? k)).join(', ')}`);

  if (traits.length > 0) {
    const joined = traits.length === 1
      ? traits[0]
      : traits.slice(0, -1).join(', ') + ' & ' + traits[traits.length - 1];
    lines.push('');
    lines.push(pc.bold(t('cli.doneWithTraits', { traits: joined })));
  }

  note(lines.join('\n'), t('cli.doneNoteTitle'));
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
