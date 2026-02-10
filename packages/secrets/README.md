# @claude-code-hooks/secrets

A Claude Code hook package that helps users feel safer by warning when **secret-like tokens** appear in tool inputs — and optionally scanning **staged git files** before commits.

**Language / 언어:** English (main) · 한국어 (sub) — 한국어 안내는 [루트 문서](../../CONTRIBUTING.md) 하단에 포함되어 있습니다.

This is intentionally **high-signal and lightweight**: it detects only a few patterns that are commonly accidental leaks.

> Part of the [claude-code-hooks](../../README.md) monorepo.
>
> [Contributing](../../CONTRIBUTING.md) · [Security Policy](../../SECURITY.md) · [Releasing](../../RELEASING.md) · [License](../../LICENSE)

## Install / run

```bash
npx @claude-code-hooks/secrets@latest
```

## Project config: claude-code-hooks.config.json

Uses the same project config file as other packages.

Minimal schema:

```json
{
  "secrets": {
    "mode": "warn",
    "enabledEvents": ["PreToolUse", "PermissionRequest"],
    "scanGitCommit": false,
    "ignore": { "regex": [] },
    "allow": { "regex": [] }
  }
}
```

- `scanGitCommit`: when `true`, intercepts `git commit` commands on `PreToolUse` and scans staged files (via `git diff --cached`) for secret patterns. Default: `false`.
- `allow.regex`: if any pattern matches, findings are suppressed
- `ignore.regex`: if any pattern matches, findings are suppressed and a dim note is printed

## Modes

- `warn` (default): prints warnings to stderr, exits 0
- `block`: exits 2 **only for HIGH confidence** findings (private key material)

## Git commit scanning

When `scanGitCommit` is enabled and Claude tries to run a `git commit` command (detected via `PreToolUse`), the hook will:

1. Run `git diff --cached --name-only --diff-filter=ACM` to list staged files
2. Skip binary files and excluded directories (`node_modules`, `.git`, `dist`, etc.)
3. Scan each file against an expanded set of secret patterns
4. Merge file-level findings with the standard payload scan

File-level patterns include everything from the payload scanner plus:

- Google API keys (`AIza...`)
- Stripe secret keys (`sk_live_...`, `rk_live_...`)
- Twilio API keys
- SendGrid API keys (`SG.xxx.xxx`)
- npm tokens (`npm_...`)
- PyPI tokens (`pypi-...`)
- Database connection strings with embedded credentials
- Generic `secret=`, `token=`, `password=` assignments with high-entropy values

Blocking behaviour is the same: only **HIGH** severity findings (private key material) trigger `exit 2` in block mode.

## Commands

```bash
claude-secrets list-events
claude-secrets run --event PreToolUse --mode warn
claude-secrets doctor
```

## What it detects (v0.1)

- HIGH: `-----BEGIN (RSA|OPENSSH|EC|PGP|DSA|ENCRYPTED) PRIVATE KEY-----`
- MED: OpenAI `sk-...`, GitHub `ghp_...` / `github_pat_...` / `gho_...` / `ghu_...` / `ghs_...` / `ghr_...`, AWS `AKIA...`, Slack `xox*`, Google `AIza...`, Stripe `sk_live_...`, Twilio `SK...`, SendGrid `SG....`, npm `npm_...`, PyPI `pypi-...`, DB URLs with credentials, generic secret assignments

## Sanity checks

```bash
# warn
echo '{"text":"sk-1234567890123456789012345"}' | npx --yes @claude-code-hooks/secrets@latest run --event PreToolUse

# block (HIGH only)
echo '{"text":"-----BEGIN OPENSSH PRIVATE KEY-----"}' | npx --yes @claude-code-hooks/secrets@latest run --event PreToolUse --mode block

# git commit scan (requires scanGitCommit: true in config)
echo '{"tool_input":{"command":"git commit -m test"}}' | npx --yes @claude-code-hooks/secrets@latest run --event PreToolUse
```
