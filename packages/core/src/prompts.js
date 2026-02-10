import process from 'node:process';
import readline from 'node:readline/promises';

// Minimal, dependency-free prompt helpers.
// Goals:
// - Provide the subset of @clack/prompts used across this monorepo
// - Be robust in basic terminals
// - Avoid fancy cursor control / animations
// - TTY: keyboard navigation for select/multiselect (arrows, space, enter, esc)

export const CANCEL = Symbol('CANCEL');

export function isCancel(value) {
  return value === CANCEL;
}

function formatOption(option, i) {
  const n = String(i + 1).padStart(2, ' ');
  const hint = option.hint ? `  ${String(option.hint)}` : '';
  return `${n}) ${option.label}${hint}`;
}

/** Next selectable index after `i`, or -1. */
function nextSelectableIndex(options, i) {
  for (let j = i + 1; j < options.length; j++) {
    if (!options[j].disabled) return j;
  }
  return -1;
}

/** Previous selectable index before `i`, or -1. */
function prevSelectableIndex(options, i) {
  for (let j = i - 1; j >= 0; j--) {
    if (!options[j].disabled) return j;
  }
  return -1;
}

/**
 * Read a line of input. TTY: interactive readline. Non-TTY: read from stdin (for piped input).
 */
async function askLine(promptText) {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    try {
      const ans = await rl.question(promptText);
      return ans;
    } catch {
      return CANCEL;
    } finally {
      rl.close();
    }
  }

  // Non-TTY: read one line from stdin (e.g. piped input)
  process.stdout.write(promptText);
  return new Promise((resolve) => {
    let buf = '';
    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.pause();
    };
    const done = (value) => {
      cleanup();
      resolve(value);
    };
    const onData = (chunk) => {
      buf += String(chunk);
      const idx = buf.indexOf('\n');
      if (idx >= 0) {
        done(buf.slice(0, idx).replace(/\r$/, ''));
      } else {
        const r = buf.indexOf('\r');
        if (r >= 0) done(buf.slice(0, r));
      }
    };
    const onEnd = () => {
      done(buf.trim() || CANCEL);
    };
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
  });
}

/**
 * Set up raw mode and return a key listener. Caller must call cleanup() when done.
 * @param {(key: 'up'|'down'|'enter'|'space'|'esc') => void} onKey
 * @returns {{ cleanup: () => void }}
 */
function setupRawMode(onKey) {
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  const wasEncoding = stdin.readableEncoding;

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  let escBuffer = '';
  let escTimer = null;

  const cleanup = () => {
    if (escTimer) clearTimeout(escTimer);
    stdin.removeListener('data', onData);
    stdin.setRawMode(wasRaw);
    if (wasEncoding) stdin.setEncoding(wasEncoding);
    stdin.pause();
  };

  const flushEsc = () => {
    if (escBuffer) {
      onKey('esc');
      escBuffer = '';
    }
  };

  const onData = (chunk) => {
    // Arrow keys may arrive as a full escape sequence in one chunk ("\x1b[A"),
    // or split across chunks ("\x1b" then "[A"). Also, multiple sequences can
    // arrive together. So parse as a small stream.
    let s = String(chunk);

    // If we were in the middle of an escape sequence, prepend it.
    if (escBuffer) {
      s = escBuffer + s;
      escBuffer = '';
    }

    // Fast path: handle common sequences anywhere in the chunk.
    // (We still fall back to per-char scanning below.)
    if (s.includes('\x1b[A') || s.includes('\x1bOA')) {
      // handle each occurrence via scanning; don't early return
    }

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];

      // Enter
      if (ch === '\r' || ch === '\n') {
        onKey('enter');
        continue;
      }

      // Space
      if (ch === ' ') {
        onKey('space');
        continue;
      }

      // Escape / arrows
      if (ch === '\x1b') {
        // If we have enough chars in this chunk, try to parse arrow.
        const rest = s.slice(i);
        if (rest.startsWith('\x1b[A') || rest.startsWith('\x1bOA')) {
          onKey('up');
          i += rest.startsWith('\x1bO') ? 2 : 2;
          continue;
        }
        if (rest.startsWith('\x1b[B') || rest.startsWith('\x1bOB')) {
          onKey('down');
          i += rest.startsWith('\x1bO') ? 2 : 2;
          continue;
        }

        // Incomplete escape sequence: buffer the remainder and flush as ESC if it
        // doesn't become an arrow quickly.
        escBuffer = rest;
        if (escTimer) clearTimeout(escTimer);
        escTimer = setTimeout(() => {
          escTimer = null;
          flushEsc();
        }, 50);
        return;
      }
    }
  };

  stdin.on('data', onData);
  return { cleanup };
}

const CURSOR_HIDE = '\x1b[?25l';
const CURSOR_SHOW = '\x1b[?25h';

/**
 * Clear `lines` lines above cursor and move cursor up.
 */
function clearLines(lines) {
  if (lines <= 0) return;
  for (let i = 0; i < lines; i++) {
    process.stdout.write('\x1b[1A\x1b[2K');
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

/** Line-input fallback for select (non-TTY or legacy). */
async function selectLine({ message, options = [], initialValue }) {
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

/** TTY select with arrow keys, enter, esc. */
async function selectTTY({ message, options = [], initialValue }) {
  const selectable = options.map((o, i) => ({ ...o, index: i })).filter((o) => !o.disabled);
  if (selectable.length === 0) return CANCEL;

  const defaultIdx =
    initialValue !== undefined
      ? selectable.findIndex((o) => o.value === initialValue)
      : -1;
  let cursor = defaultIdx >= 0 ? defaultIdx : 0;

  const render = () => {
    const out = [];
    const cursorIdx = selectable[cursor]?.index ?? -1;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const isCursorOpt = cursorIdx === i;
      const prefix = opt.disabled ? '  ' : isCursorOpt ? '> ' : '  ';
      const label = opt.disabled ? `${opt.label} (disabled)` : opt.label;
      const hint = opt.hint ? `  ${String(opt.hint)}` : '';
      out.push(`${prefix}${label}${hint}`);
    }
    return out;
  };

  process.stdout.write(`\n${message}\n`);
  process.stdout.write(`(↑/↓ to move, Enter to select, Esc to cancel)\n`);

  const lineCount = options.length + 2;

  const update = () => {
    clearLines(lineCount);
    const rendered = render();
    for (const line of rendered) {
      process.stdout.write(line + '\n');
    }
  };

  process.stdout.write(CURSOR_HIDE);

  const result = await new Promise((resolve) => {
    const { cleanup } = setupRawMode((key) => {
      if (key === 'esc') {
        cleanup();
        process.stdout.write(CURSOR_SHOW);
        resolve(CANCEL);
        return;
      }
      if (key === 'enter') {
        cleanup();
        process.stdout.write(CURSOR_SHOW);
        clearLines(lineCount);
        resolve(selectable[cursor].value);
        return;
      }
      if (key === 'up') {
        const prev = prevSelectableIndex(options, selectable[cursor].index);
        if (prev >= 0) {
          cursor = selectable.findIndex((s) => s.index === prev);
          update();
        }
      }
      if (key === 'down') {
        const next = nextSelectableIndex(options, selectable[cursor].index);
        if (next >= 0) {
          cursor = selectable.findIndex((s) => s.index === next);
          update();
        }
      }
    });

    // Initial render
    const rendered = render();
    for (const line of rendered) {
      process.stdout.write(line + '\n');
    }
  });

  return result;
}

export async function select({ message, options = [], initialValue } = {}) {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    return selectTTY({ message, options, initialValue });
  }
  return selectLine({ message, options, initialValue });
}

/** Line-input fallback for multiselect (non-TTY or legacy). */
async function multiselectLine({ message, options = [], required = false, initialValues }) {
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

/** TTY multiselect with arrow keys, space toggle, enter, esc. */
async function multiselectTTY({ message, options = [], required = false, initialValues }) {
  const selectable = options.map((o, i) => ({ ...o, index: i })).filter((o) => !o.disabled);
  if (selectable.length === 0) return CANCEL;

  const initialSet = new Set(Array.isArray(initialValues) ? initialValues : []);
  const selected = new Set(
    selectable.filter((o) => initialSet.has(o.value)).map((o) => o.value)
  );
  let cursor = 0;

  const render = () => {
    const out = [];
    const cursorIdx = selectable[cursor]?.index ?? -1;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const isCursorOpt = cursorIdx === i;
      const isChecked = selected.has(opt.value);
      const prefix = opt.disabled
        ? '    '
        : isCursorOpt
          ? (isChecked ? '> [x] ' : '> [ ] ')
          : (isChecked ? '  [x] ' : '  [ ] ');
      const label = opt.disabled ? `${opt.label} (disabled)` : opt.label;
      const hint = opt.hint ? `  ${String(opt.hint)}` : '';
      out.push(`${prefix}${label}${hint}`);
    }
    return out;
  };

  process.stdout.write(`\n${message}\n`);
  process.stdout.write(`(↑/↓ move, Space toggle, Enter to confirm, Esc to cancel)\n`);

  const lineCount = options.length + 2;

  const update = () => {
    clearLines(lineCount);
    const rendered = render();
    for (const line of rendered) {
      process.stdout.write(line + '\n');
    }
  };

  process.stdout.write(CURSOR_HIDE);

  const result = await new Promise((resolve) => {
    const { cleanup } = setupRawMode((key) => {
      if (key === 'esc') {
        cleanup();
        process.stdout.write(CURSOR_SHOW);
        resolve(CANCEL);
        return;
      }
      if (key === 'enter') {
        const picked = Array.from(selected);
        if (required && picked.length === 0) return;
        cleanup();
        process.stdout.write(CURSOR_SHOW);
        clearLines(lineCount);
        resolve(picked);
        return;
      }
      if (key === 'space') {
        const opt = selectable[cursor];
        if (opt) {
          if (selected.has(opt.value)) selected.delete(opt.value);
          else selected.add(opt.value);
          update();
        }
      }
      if (key === 'up') {
        const prev = prevSelectableIndex(options, selectable[cursor].index);
        if (prev >= 0) {
          cursor = selectable.findIndex((s) => s.index === prev);
          update();
        }
      }
      if (key === 'down') {
        const next = nextSelectableIndex(options, selectable[cursor].index);
        if (next >= 0) {
          cursor = selectable.findIndex((s) => s.index === next);
          update();
        }
      }
    });

    const rendered = render();
    for (const line of rendered) {
      process.stdout.write(line + '\n');
    }
  });

  return result;
}

export async function multiselect({ message, options = [], required = false, initialValues } = {}) {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    return multiselectTTY({ message, options, required, initialValues });
  }
  return multiselectLine({ message, options, required, initialValues });
}
