#!/usr/bin/env node

import process from 'node:process';

// Avoid crashing when stdout is closed early (e.g. piping to `head`).
process.stdout.on('error', (err) => {
  if (err && err.code === 'EPIPE') process.exit(0);
});
import { ansi as pc } from '@claude-code-hooks/core';
import { HOOK_EVENTS } from './hooks.js';
import { interactiveSetup } from './setup.js';
import { loadEffectiveConfig } from './config.js';
import { doctor } from './doctor.js';
import { readStdinJson, assessSecrets, printFindings } from './runner.js';

function usage(exitCode = 0) {
  process.stdout.write(`\
claude-secrets\n\nUsage:\n  npx @claude-code-hooks/secrets@latest          Interactive setup\n  claude-secrets                           Interactive setup\n\n  claude-secrets run --event <Event>        Run as a hook handler (reads JSON from stdin)\n  claude-secrets list-events                List supported Claude hook events\n  claude-secrets doctor                     Inspect config + installed managed hooks\n\nOptions:\n  --mode <warn|block>                        Runner mode (default: from config, else warn)\n  -h, --help                                 Show help\n\nNotes:\n  - warn: prints warnings and exits 0\n  - block: exits 2 only for HIGH confidence findings (private key material)\n\nExamples:\n  npx @claude-code-hooks/secrets@latest\n  echo '{"text":"-----BEGIN OPENSSH PRIVATE KEY-----"}' | npx --yes @claude-code-hooks/secrets@latest run --event PreToolUse --mode block\n  claude-secrets doctor\n`);
  process.exit(exitCode);
}

function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function cmdListEvents() {
  for (const e of HOOK_EVENTS) process.stdout.write(e + '\n');
}

async function cmdRun() {
  const eventName = parseArg('--event');
  if (!eventName || !HOOK_EVENTS.includes(eventName)) {
    process.stderr.write(`Invalid or missing --event. Supported: ${HOOK_EVENTS.join(', ')}\n`);
    process.exit(1);
  }

  const effective = await loadEffectiveConfig(process.cwd());
  const cliMode = parseArg('--mode');
  const mode = ((cliMode || effective.mode) || 'warn').toLowerCase();

  const { json, raw } = await readStdinJson();
  const payload = json ?? (raw ? { raw } : {});

  const { findings, suppressed } = assessSecrets({
    eventName,
    payload,
    patterns: {
      allowRegex: effective.allow.regex,
      ignoreRegex: effective.ignore.regex
    },
    scanGitCommit: effective.scanGitCommit
  });

  if (findings.length > 0 || suppressed) {
    printFindings({ eventName, mode, findings, suppressed });
  }

  const hasHigh = findings.some((f) => f.severity === 'HIGH');
  if (mode === 'block' && hasHigh) {
    process.stderr.write(pc.red(pc.bold('Blocked by claude-secrets (HIGH confidence secret).')) + '\n');
    process.exit(2);
  }

  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);
  const langIdx = args.indexOf('--lang');
  if (langIdx !== -1 && args[langIdx + 1]) {
    process.env.CLAUDE_CODE_HOOKS_LANG = args[langIdx + 1].toLowerCase().slice(0, 2);
  }
  if (args.includes('-h') || args.includes('--help')) usage(0);

  const cmd = args[0];
  if (!cmd) {
    await interactiveSetup();
    return;
  }

  if (cmd === 'list-events') {
    await cmdListEvents();
    return;
  }

  if (cmd === 'run') {
    await cmdRun();
    return;
  }

  if (cmd === 'doctor') {
    await doctor();
    return;
  }

  process.stderr.write(`Unknown command: ${cmd}\n`);
  usage(1);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
