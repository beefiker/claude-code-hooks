#!/usr/bin/env node

import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ansi as pc,
  configPathForScope,
  readJsonIfExists,
  writeJson,
  CONFIG_FILENAME,
  configFilePath,
  readProjectConfig,
  writeProjectConfig,
  t,
  parseLocaleFromArgv,
  intro,
  outro,
  select,
  multiselect,
  confirm,
  isCancel,
  cancel,
  note,
  spinner
} from '@claude-code-hooks/core';

import { buildSettingsSnippet } from './snippet.js';

// In-workspace imports (when running from monorepo) and normal Node resolution
// (when installed from npm) both resolve these packages.
import { planInteractiveSetup as planSecuritySetup } from '@claude-code-hooks/security/src/plan.js';
import { planInteractiveSetup as planSecretsSetup } from '@claude-code-hooks/secrets/src/plan.js';
import { planInteractiveSetup as planSoundSetup } from '@claude-code-hooks/sound/src/plan.js';
import { planInteractiveSetup as planNotificationSetup } from '@claude-code-hooks/notification/src/plan.js';

function dieCancelled(msg, locale = 'en') {
  cancel(msg ?? t('cancelled', locale));
  process.exit(0);
}

function usage(exitCode = 0, locale = 'en') {
  process.stdout.write(t('cliUsage', locale) + '\n');
  process.exit(exitCode);
}

async function ensureProjectOnlyConfig(projectDir, selected, perPackageConfig, locale) {
  const cfgRes = await readProjectConfig(projectDir);
  const rawCfg = cfgRes.ok ? { ...(cfgRes.value || {}) } : {};

  // Our existing project config format is sectioned by package key.
  // Keep only what we touch, preserve others.
  const out = { ...rawCfg };

  if (selected.includes('security') && perPackageConfig.security) out.security = perPackageConfig.security;
  if (selected.includes('secrets') && perPackageConfig.secrets) out.secrets = perPackageConfig.secrets;
  if (selected.includes('sound') && perPackageConfig.sound) out.sound = perPackageConfig.sound;
  if (selected.includes('notification') && perPackageConfig.notification) out.notification = perPackageConfig.notification;
  if (locale === 'ko') out.locale = 'ko';

  await writeProjectConfig(out, projectDir);
  return out;
}

async function maybeWriteSnippet(projectDir, snippetObj, locale) {
  const snippetPath = path.join(projectDir, 'claude-code-hooks.snippet.json');
  const ok = await confirm({
    message: t('cliSnippetPrompt', locale, { path: pc.bold(snippetPath) }),
    initialValue: false
  });
  if (isCancel(ok)) return;
  if (!ok) return;

  const filePath = path.join(projectDir, 'claude-code-hooks.snippet.json');
  await fs.writeFile(filePath, JSON.stringify(snippetObj, null, 2) + '\n');
  note(filePath, t('cliWroteSnippet', locale));
}

async function main() {
  const args = process.argv.slice(2);
  const locale = parseLocaleFromArgv(args);
  if (args.includes('-h') || args.includes('--help')) usage(0, locale);

  const projectDir = process.cwd();

  intro('claude-code-hooks');

  // ── Step 1–3: action, target, packages (with simple back navigation) ──
  let action;
  let target;
  let selected;

  while (true) {
    action = await select({
      message: `${pc.dim('Step 1/5')}  ${t('cliStep1Action', locale)}`,
      options: [
        { value: 'setup', label: t('cliActionSetup', locale) },
        { value: 'uninstall', label: t('cliActionUninstall', locale) },
        { value: 'exit', label: t('cliActionExit', locale) }
      ]
    });
    if (isCancel(action) || action === 'exit') dieCancelled(t('bye', locale), locale);

    target = await select({
      message: `${pc.dim('Step 2/5')}  ${t('cliStep2Target', locale)}`,
      options: [
        { value: 'global', label: t('cliTargetGlobal', locale) },
        { value: 'projectOnly', label: t('cliTargetProjectOnly', locale, { config: pc.bold(CONFIG_FILENAME) }) },
        { value: '__back__', label: t('cliTargetBack', locale) }
      ]
    });
    if (isCancel(target)) dieCancelled(undefined, locale);
    if (target === '__back__') continue;

    selected = await multiselect({
      message: `${pc.dim('Step 3/5')}  ${t('cliStep3Packages', locale)}`,
      options: [
        { value: 'security', label: t('cliPkgSecurity', locale), hint: t('cliPkgSecurityHint', locale) },
        { value: 'secrets', label: t('cliPkgSecrets', locale), hint: t('cliPkgSecretsHint', locale) },
        { value: 'sound', label: t('cliPkgSound', locale), hint: t('cliPkgSoundHint', locale) },
        { value: 'notification', label: t('cliPkgNotification', locale), hint: t('cliPkgNotificationHint', locale) }
      ],
      required: true
    });
    if (isCancel(selected)) dieCancelled(undefined, locale);

    const proceed = await confirm({ message: t('cliContinue', locale), initialValue: true });
    if (isCancel(proceed)) dieCancelled(undefined, locale);
    if (!proceed) continue;

    break;
  }

  // Build per-package plan/config
  const perPackage = { security: null, secrets: null, sound: null, notification: null };
  const pkgHints = {
    security: t('cliPkgSecurityHint', locale),
    secrets: t('cliPkgSecretsHint', locale),
    sound: t('cliPkgSoundHint', locale),
    notification: t('cliPkgNotificationHint', locale)
  };

  // ── Step 4/5: configure ──
  note(
    selected.map((k) => `${pc.bold(k)}: ${pc.dim(pkgHints[k] || '')}`).join('\n'),
    `${pc.dim('Step 4/5')}  ${t('cliStep4Configure', locale)}`
  );

  if (selected.includes('security')) perPackage.security = await planSecuritySetup({ action, projectDir, ui: 'umbrella', locale });
  if (selected.includes('secrets')) perPackage.secrets = await planSecretsSetup({ action, projectDir, ui: 'umbrella', locale });
  if (selected.includes('sound')) perPackage.sound = await planSoundSetup({ action, projectDir, ui: 'umbrella', locale });
  if (selected.includes('notification')) perPackage.notification = await planNotificationSetup({ action, projectDir, ui: 'umbrella', locale });

  // ── Step 5/5: review ──
  const files = [];
  if (target === 'global') files.push(configPathForScope('global', projectDir));
  if (target === 'projectOnly') {
    files.push(path.join(projectDir, CONFIG_FILENAME));
    files.push(path.join(projectDir, 'claude-code-hooks.snippet.json (optional)'));
  }

  function summarizePlan(key, plan) {
    if (!plan) return `${key}: (skipped)`;
    if (action === 'uninstall') return `${key}: ${t('cliRemoveManagedHooks', locale)}`;

    const events = plan.snippetHooks ? Object.keys(plan.snippetHooks) : [];
    const list = events.slice(0, 5);
    const tail = events.length > 5 ? ` +${events.length - 5} more` : '';
    return `${key}: ${events.length} ${t('cliEventCount', locale)}${events.length ? ` (${list.join(', ')}${tail})` : ''}`;
  }

  note(
    [
      `${pc.dim('Step 5/5')}  ${t('cliStep5Review', locale)}`,
      '',
      `${t('cliReviewAction', locale)}: ${pc.bold(action)}`,
      `${t('cliReviewTarget', locale)}: ${pc.bold(target === 'global' ? t('cliReviewGlobal', locale) : t('cliReviewProjectOnly', locale))}`,
      '',
      `${pc.bold(t('cliReviewPackages', locale))}`,
      ...selected.map((k) => `  - ${summarizePlan(k, perPackage[k])}`),
      '',
      `${pc.bold(t('cliReviewFiles', locale))}`,
      ...files.map((f) => `  - ${f}`)
    ].join('\n'),
    t('cliStep5Review', locale)
  );

  const ok = await confirm({ message: t('cliApply', locale), initialValue: true });
  if (isCancel(ok) || !ok) dieCancelled(t('noChangesWritten', locale), locale);

  if (target === 'projectOnly') {
    // Write project config
    const s = spinner();
    s.start(t('cliWritingProject', locale));

    // perPackage.*.projectConfigSection is shaped for claude-code-hooks.config.json sections.
    const projectCfg = await ensureProjectOnlyConfig(projectDir, selected, {
      security: perPackage.security?.projectConfigSection,
      secrets: perPackage.secrets?.projectConfigSection,
      sound: perPackage.sound?.projectConfigSection,
      notification: perPackage.notification?.projectConfigSection
    }, locale);

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

    s.stop(t('done', locale));

    note(JSON.stringify(snippetObj, null, 2), t('cliPasteSnippet', locale));
    await maybeWriteSnippet(projectDir, snippetObj, locale);

    outro(`${t('cliProjectConfigWritten', locale)}: ${pc.bold(configFilePath(projectDir))}`);
    return;
  }

  // Global apply: read settings.json, apply transforms, write once.
  const settingsPath = configPathForScope('global', projectDir);
  const res = await readJsonIfExists(settingsPath);
  if (!res.ok) {
    cancel(t('cliCouldNotRead', locale, { path: settingsPath }));
    process.exit(1);
  }

  let settings = res.value;

  const s = spinner();
  s.start(t('cliApplyingGlobal', locale));

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
    }, locale);
  }

  s.stop(t('done', locale));
  outro(`${t('cliSaved', locale)}: ${pc.bold(settingsPath)}`);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
