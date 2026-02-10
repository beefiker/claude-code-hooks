/**
 * @typedef {'HIGH'|'MED'} Severity
 * @typedef {{ id: string, title: string, severity: Severity, detail: string }} Finding
 */

const RX = {
  privateKey: /-----BEGIN (RSA|OPENSSH|EC|PGP) PRIVATE KEY-----/,
  openai: /\bsk-[A-Za-z0-9]{20,}\b/,
  ghp: /\bghp_[A-Za-z0-9]{20,}\b/,
  githubPat: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  awsAccessKeyId: /\bAKIA[0-9A-Z]{16}\b/,
  slack: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/
};

/**
 * @param {string} text
 * @returns {Finding[]}
 */
export function detectSecrets(text) {
  const t = String(text || '');
  /** @type {Finding[]} */
  const hits = [];

  const push = (id, title, severity, detail) => hits.push({ id, title, severity, detail });

  if (RX.privateKey.test(t)) {
    push('private-key', 'Private key material', 'HIGH', 'Detected a private key header (BEGIN ... PRIVATE KEY).');
  }
  if (RX.openai.test(t)) {
    push('openai', 'OpenAI API key-like token', 'MED', 'Detected token matching sk-... pattern.');
  }
  if (RX.ghp.test(t) || RX.githubPat.test(t)) {
    push('github', 'GitHub token-like secret', 'MED', 'Detected GitHub token pattern (ghp_ / github_pat_).');
  }
  if (RX.awsAccessKeyId.test(t)) {
    push('aws-akid', 'AWS Access Key ID-like token', 'MED', 'Detected AWS access key id pattern (AKIA...).');
  }
  if (RX.slack.test(t)) {
    push('slack', 'Slack token-like secret', 'MED', 'Detected Slack token pattern (xox*).');
  }

  // Deduplicate by id
  const seen = new Set();
  return hits.filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)));
}
