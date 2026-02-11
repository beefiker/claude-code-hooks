// Tiny ANSI styling helper (dependency-free).
// Safe default: if NO_COLOR is set or not a TTY, returns plain strings.

const enabled = (() => {
  try {
    if (process.env.NO_COLOR) return false;
    return Boolean(process.stderr.isTTY || process.stdout.isTTY);
  } catch {
    return false;
  }
})();

function wrap(open, close, s) {
  if (!enabled) return String(s);
  return open + String(s) + close;
}

export const ansi = {
  bold: (s) => wrap('\u001b[1m', '\u001b[22m', s),
  dim: (s) => wrap('\u001b[2m', '\u001b[22m', s),
  strikethrough: (s) => wrap('\u001b[9m', '\u001b[29m', s),
  red: (s) => wrap('\u001b[31m', '\u001b[39m', s),
  green: (s) => wrap('\u001b[32m', '\u001b[39m', s),
  yellow: (s) => wrap('\u001b[33m', '\u001b[39m', s),
  cyan: (s) => wrap('\u001b[36m', '\u001b[39m', s),
  magenta: (s) => wrap('\u001b[35m', '\u001b[39m', s),
  /** Deep blue, bright (DodgerBlue #0087ff) - for highlights */
  blue: (s) => wrap('\u001b[38;5;33m', '\u001b[39m', s),
  /** Bright cyan for accents */
  brightCyan: (s) => wrap('\u001b[38;5;51m', '\u001b[39m', s),
  gray: (s) => wrap('\u001b[90m', '\u001b[39m', s)
};
