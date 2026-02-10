import { ansi as pc, compileRegexList, buildCombinedText } from '@claude-code-hooks/core';
import { detectSecrets } from './patterns.js';

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
 * @returns {{ eventName: string, findings: import('./patterns.js').Finding[], suppressed: 'allow'|'ignore'|null }}
 */
export function assessSecrets({ eventName, payload, patterns }) {
  const combined = buildCombinedText(payload);
  const findings = detectSecrets(combined);

  if (findings.length === 0) return { eventName, findings, suppressed: null };

  if (patterns?.allowRegex?.length) {
    const compiled = compileRegexList(patterns.allowRegex);
    if (compiled.some((rx) => rx.test(combined))) return { eventName, findings: [], suppressed: 'allow' };
  }

  if (patterns?.ignoreRegex?.length) {
    const compiled = compileRegexList(patterns.ignoreRegex);
    if (compiled.some((rx) => rx.test(combined))) return { eventName, findings: [], suppressed: 'ignore' };
  }

  return { eventName, findings, suppressed: null };
}

export function printFindings({ eventName, mode, findings, suppressed }) {
  const header = `${pc.bold(pc.yellow('claude-secrets'))} ${pc.dim('·')} ${pc.bold(eventName)} ${pc.dim('·')} mode=${mode}`;
  process.stderr.write(header + '\n');

  if (suppressed === 'allow') {
    process.stderr.write(pc.dim('Findings suppressed by allow pattern in claude-hooks.config.json') + '\n');
    return;
  }
  if (suppressed === 'ignore') {
    process.stderr.write(pc.dim('Findings suppressed by ignore pattern in claude-hooks.config.json') + '\n');
    return;
  }

  if (!findings.length) {
    process.stderr.write(pc.green('No obvious secrets detected by heuristics.') + '\n');
    return;
  }

  process.stderr.write(pc.yellow(pc.bold(`Detected ${findings.length} potential secret(s):`)) + '\n');
  for (const f of findings) {
    const sev = f.severity === 'HIGH' ? pc.red('HIGH') : pc.yellow('MED');
    process.stderr.write(`- ${pc.bold(f.title)} ${pc.dim(`(${f.id})`)} ${pc.dim('severity=')} ${sev}\n  ${pc.dim(f.detail)}\n`);
  }

  process.stderr.write(
    pc.dim(
      '\nTip: Move secrets to env vars / secret manager; never paste private keys or long-lived tokens into tool inputs.'
    ) + '\n'
  );
}
