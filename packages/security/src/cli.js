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
import { readStdinJson, assessRisk, printWarning } from './runner.js';

function usage(exitCode = 0) {
  process.stdout.write(`\
claude-security\n\nUsage:\n  npx @claude-code-hooks/security@latest         Interactive setup\n  claude-security                          Interactive setup\n\n  claude-security run --event <Event>       Run as a hook handler (reads JSON from stdin)\n  claude-security list-events               List supported Claude hook events\n  claude-security doctor                    Inspect config + installed managed hooks\n\nOptions:\n  --mode <warn|block>                       Runner mode (default: warn)\n  -h, --help                                Show help\n\nNotes:\n  - warn: prints warnings and exits 0\n  - block: exits 2 when a risk is detected (PreToolUse only; PermissionRequest stays advisory)\n\nExamples:\n  npx @claude-code-hooks/security@latest\n  echo '{"command":"rm -rf /"}' | npx --yes @claude-code-hooks/security@latest run --event PreToolUse\n  claude-security doctor\n`);
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

  const effective = await loadEffectiveConfig(process.cwd());
  const cliMode = parseArg('--mode');
  const mode = ((cliMode || effective.mode) || 'warn').toLowerCase();

  if (!eventName || !HOOK_EVENTS.includes(eventName)) {
    process.stderr.write(`Invalid or missing --event. Supported: ${HOOK_EVENTS.join(', ')}\n`);
    process.exit(1);
  }

  const { json, raw } = await readStdinJson();
  const payload = json ?? (raw ? { raw } : {});

  const { risks, suppressed } = assessRisk({
    eventName,
    payload,
    patterns: {
      allowRegex: effective.allow.regex,
      ignoreRegex: effective.ignore.regex
    }
  });

  // Print if we have risks OR if config suppressed a would-be risk.
  if (risks.length > 0 || suppressed) {
    printWarning({ eventName, risks, mode, suppressed });
  }

  // Block-mode is only enforced for PreToolUse.
  // PermissionRequest is already a human-in-the-loop checkpoint; we keep it advisory to avoid UX fights.
  if (mode === 'block' && eventName === 'PreToolUse' && risks.length > 0) {
    process.stderr.write(pc.red(pc.bold('Blocked by claude-security (mode=block).')) + '\n');
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
