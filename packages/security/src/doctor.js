import { ansi as pc, CONFIG_FILENAME, configFilePath, readProjectConfig, configPathForScope, readJsonIfExists, extractManagedHandlers } from '@claude-hooks/core';
import { resolveSecurityConfig } from './config.js';
import { HOOK_EVENTS } from './hooks.js';

const MANAGED_TOKEN = '--managed-by @claude-hooks/security';

export async function doctor() {
  const cwd = process.cwd();

  const cfgPath = configFilePath(cwd);
  const cfgRes = await readProjectConfig(cwd);
  const cfgExists = cfgRes.ok ? cfgRes.exists : false;
  const effective = cfgRes.ok ? resolveSecurityConfig(cfgRes.value) : null;

  process.stdout.write(`${pc.bold('claude-security doctor')}\n`);
  process.stdout.write(`${pc.dim('cwd:')} ${cwd}\n\n`);

  process.stdout.write(`${pc.bold('Project config')}\n`);
  process.stdout.write(`- ${CONFIG_FILENAME}: ${cfgExists ? pc.green('found') : pc.yellow('not found')}\n`);
  process.stdout.write(`- path: ${cfgPath}\n`);
  if (!cfgRes.ok) {
    process.stdout.write(`- parse: ${pc.red('error')} ${String(cfgRes.error?.message || cfgRes.error)}\n\n`);
  } else {
    const sec = effective;
    process.stdout.write(`- mode: ${sec.mode}\n`);
    process.stdout.write(`- enabledEvents: ${sec.enabledEvents.join(', ') || '(none)'}\n`);
    process.stdout.write(`- allow.regex: ${sec.allow.regex.length}\n`);
    process.stdout.write(`- ignore.regex: ${sec.ignore.regex.length}\n\n`);
  }

  const paths = [
    { label: 'global', path: configPathForScope('global', cwd) },
    { label: 'project', path: configPathForScope('project', cwd) },
    { label: 'projectLocal', path: configPathForScope('projectLocal', cwd) }
  ];

  process.stdout.write(`${pc.bold('Claude settings')}\n`);

  for (const p of paths) {
    const res = await readJsonIfExists(p.path);
    if (!res.ok) {
      process.stdout.write(`- ${pc.bold(p.label)}: ${p.path} ${pc.red('ERROR')} ${String(res.error?.message || res.error)}\n`);
      continue;
    }

    const byEvent = extractManagedHandlers(res.value, {
      managedToken: MANAGED_TOKEN,
      events: HOOK_EVENTS,
      modeRegex: /--mode\s+(warn|block)\b/
    });

    const any = HOOK_EVENTS.some((e) => (byEvent[e] || []).length > 0);
    process.stdout.write(`- ${pc.bold(p.label)}: ${p.path} ${any ? pc.green('has managed hooks') : pc.dim('no managed hooks')}\n`);

    for (const e of HOOK_EVENTS) {
      const handlers = byEvent[e] || [];
      if (handlers.length === 0) continue;
      const modes = handlers.map((h) => h.mode || 'unknown');
      const dup = handlers.length > 1;
      process.stdout.write(`  - ${e}: ${handlers.length} handler(s) mode=[${modes.join(', ')}]${dup ? ' ' + pc.yellow('DUPLICATE?') : ''}\n`);
      if (dup) process.stdout.write(pc.dim('    Tip: re-run setup/remove to clean duplicates; claude-security only manages its own handlers.') + '\n');
    }
  }
}
