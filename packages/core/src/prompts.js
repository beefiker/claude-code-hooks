import process from 'node:process';
import readline from 'node:readline/promises';

// Minimal, dependency-free prompt helpers.
// Goals:
// - Provide the subset of @clack/prompts used across this monorepo
// - Be robust in basic terminals
// - Avoid fancy cursor control / animations

export const CANCEL = Symbol('CANCEL');

export function isCancel(value) {
  return value === CANCEL;
}

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function formatOption(option, i) {
  const n = String(i + 1).padStart(2, ' ');
  const hint = option.hint ? `  ${String(option.hint)}` : '';
  return `${n}) ${option.label}${hint}`;
}

async function askLine(promptText) {
  if (!isInteractive()) return CANCEL;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const onSigint = () => {
    // readline in promise mode throws on SIGINT depending on Node version;
    // we still treat Ctrl+C as cancel.
  };

  try {
    rl.on('SIGINT', onSigint);
    const ans = await rl.question(promptText);
    return ans;
  } catch {
    return CANCEL;
  } finally {
    rl.close();
  }
}

export function intro(title) {
  process.stdout.write(`\n${title}\n`);
  process.stdout.write(`${'-'.repeat(Math.min(60, String(title).length || 10))}\n`);
}

export function outro(message) {
  process.stdout.write(`\n${message}\n`);
}

export function note(message, title) {
  if (title) process.stdout.write(`\n${title}\n`);
  process.stdout.write(`${message}\n`);
}

export function cancel(message) {
  if (message) process.stdout.write(`\n${message}\n`);
}

export function spinner() {
  let active = false;
  let current = '';

  return {
    start(msg) {
      active = true;
      current = msg || '';
      if (current) process.stdout.write(`${current}\n`);
    },
    stop(msg) {
      if (!active) return;
      active = false;
      if (msg) process.stdout.write(`${msg}\n`);
    }
  };
}

export async function text({ message, placeholder, validate } = {}) {
  const ph = placeholder ? ` (${placeholder})` : '';
  while (true) {
    const ans = await askLine(`${message}${ph}\n> `);
    if (isCancel(ans)) return CANCEL;

    const v = String(ans);
    const err = typeof validate === 'function' ? validate(v) : undefined;
    if (!err) return v;
    process.stdout.write(String(err) + '\n');
  }
}

export async function confirm({ message, initialValue = true } = {}) {
  const suffix = initialValue ? ' (Y/n) ' : ' (y/N) ';
  while (true) {
    const ans = await askLine(`${message}${suffix}`);
    if (isCancel(ans)) return CANCEL;

    const s = String(ans).trim().toLowerCase();
    if (s === '') return Boolean(initialValue);
    if (['y', 'yes'].includes(s)) return true;
    if (['n', 'no'].includes(s)) return false;

    process.stdout.write('Please enter y or n.\n');
  }
}

export async function select({ message, options = [], initialValue } = {}) {
  process.stdout.write(`\n${message}\n`);
  options.forEach((opt, i) => process.stdout.write(`${formatOption(opt, i)}\n`));

  const defaultOpt =
    initialValue !== undefined ? options.find((o) => o.value === initialValue) : undefined;
  if (defaultOpt) process.stdout.write(`Default: ${String(defaultOpt.label)}\n`);

  while (true) {
    const ans = await askLine('> ');
    if (isCancel(ans)) return CANCEL;

    const raw = String(ans);
    const s = raw.trim();

    if (s === '' && defaultOpt) return defaultOpt.value;

    const n = Number.parseInt(s, 10);
    if (Number.isFinite(n) && n >= 1 && n <= options.length) return options[n - 1].value;

    // Also accept direct value match (useful for scripting)
    const match = options.find((o) => String(o.value) === s);
    if (match) return match.value;

    process.stdout.write(`Enter a number (1-${options.length})${defaultOpt ? ' or press Enter for default' : ''}.\n`);
  }
}

export async function multiselect({ message, options = [], required = false, initialValues } = {}) {
  process.stdout.write(`\n${message}\n`);
  options.forEach((opt, i) => process.stdout.write(`${formatOption(opt, i)}\n`));
  process.stdout.write(`(comma-separated, e.g. 1,3)\n`);

  const defaults = Array.isArray(initialValues) ? initialValues : undefined;

  while (true) {
    const ans = await askLine('> ');
    if (isCancel(ans)) return CANCEL;

    const s = String(ans).trim();
    if (!s) {
      if (defaults) return defaults;
      if (!required) return [];
      process.stdout.write('Select at least one option.\n');
      continue;
    }

    const parts = s
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const picked = [];

    for (const p of parts) {
      const n = Number.parseInt(p, 10);
      if (Number.isFinite(n) && n >= 1 && n <= options.length) {
        const v = options[n - 1].value;
        if (!picked.includes(v)) picked.push(v);
        continue;
      }

      // allow direct value
      const match = options.find((o) => String(o.value) === p);
      if (match && !picked.includes(match.value)) picked.push(match.value);
    }

    if (required && picked.length === 0) {
      process.stdout.write('Select at least one option.\n');
      continue;
    }

    return picked;
  }
}
