import { ansi as pc, compileRegexList, buildCombinedText } from '@claude-code-hooks/core';

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function readStdinJson() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return { raw: '', json: null };
  return { raw, json: tryParseJson(raw) };
}

function detectRisksFromText(text) {
  const t = String(text || '');
  const lower = t.toLowerCase();

  /** @type {Array<{id:string, title:string, detail:string}>} */
  const hits = [];
  const push = (id, title, detail) => hits.push({ id, title, detail });

  if (/\brm\s+-rf\b/.test(lower) || /\brm\s+-fr\b/.test(lower)) {
    push('rm-rf', 'Destructive delete (rm -rf)', 'Command contains rm -rf / rm -fr.');
  }

  if (/curl\b[^\n]*\|\s*(bash|sh|zsh)/.test(lower) || /wget\b[^\n]*\|\s*(bash|sh|zsh)/.test(lower)) {
    push('pipe-to-shell', 'Piping network to shell', 'Detected curl|bash or wget|sh pattern.');
  }

  if (/chmod\s+777\b/.test(lower) || /chmod\s+-r\s+777\b/.test(lower)) {
    push('chmod-777', 'Over-permissive chmod 777', 'Detected chmod 777.');
  }

  if (lower.includes('~/.ssh') || lower.includes('/.ssh/')) {
    if (/(echo|cat|printf|tee)\b/.test(lower) && /(id_rsa|authorized_keys|known_hosts|config)/.test(lower)) {
      push('ssh-write', 'Potential SSH config/key write', 'Command references ~/.ssh and key/config files.');
    }
  }

  if (/\bgit\s+push\b/.test(lower) && /(\bmain\b|\bmaster\b)/.test(lower)) {
    push('git-push-main', 'Git push to main/master', 'Detected git push to main/master.');
  }

  if (/\bchown\b/.test(lower) && /(root|:root)/.test(lower)) {
    push('chown-root', 'chown involving root', 'Detected chown targeting root.');
  }

  if (/\bsudo\b/.test(lower)) {
    push('sudo', 'Uses sudo', 'Command contains sudo.');
  }

  return hits;
}

/**
 * @typedef {Object} ConfigPatterns
 * @property {string[]} allowRegex
 * @property {string[]} ignoreRegex
 */

/**
 * @param {Object} opts
 * @param {string} opts.eventName
 * @param {Record<string, unknown>} opts.payload
 * @param {ConfigPatterns} [opts.patterns]
 * @returns {{ eventName: string, risks: Array<{id:string, title:string, detail:string}>, suppressed: 'allow'|'ignore'|null }}
 */
export function assessRisk({ eventName, payload, patterns }) {
  const combined = buildCombinedText(payload);
  const risks = detectRisksFromText(combined);

  if (risks.length === 0) return { eventName, risks, suppressed: null };

  if (patterns?.allowRegex?.length) {
    const compiled = compileRegexList(patterns.allowRegex);
    if (compiled.some((rx) => rx.test(combined))) return { eventName, risks: [], suppressed: 'allow' };
  }

  if (patterns?.ignoreRegex?.length) {
    const compiled = compileRegexList(patterns.ignoreRegex);
    if (compiled.some((rx) => rx.test(combined))) return { eventName, risks: [], suppressed: 'ignore' };
  }

  return { eventName, risks, suppressed: null };
}

export function printWarning({ eventName, risks, mode, suppressed }) {
  const header = `${pc.bold(pc.yellow('claude-security'))} ${pc.dim('·')} ${pc.bold(eventName)} ${pc.dim('·')} mode=${mode}`;
  process.stderr.write(header + '\n');

  if (suppressed === 'allow') {
    process.stderr.write(pc.dim('Risks suppressed by allow pattern in claude-hooks.config.json') + '\n');
    return;
  }

  if (suppressed === 'ignore') {
    process.stderr.write(pc.dim('Risks suppressed by ignore pattern in claude-hooks.config.json') + '\n');
    return;
  }

  if (!risks.length) {
    process.stderr.write(pc.green('No obvious risks detected by heuristics.') + '\n');
    return;
  }

  process.stderr.write(pc.yellow(pc.bold(`Detected ${risks.length} potential risk(s):`)) + '\n');
  for (const r of risks) {
    process.stderr.write(`- ${pc.bold(r.title)} ${pc.dim(`(${r.id})`)}\n  ${pc.dim(r.detail)}\n`);
  }

  process.stderr.write(
    pc.dim(
      '\nNote: This is heuristic-only. It may miss risks or flag false positives. Configure warn vs block in setup.'
    ) + '\n'
  );
}
