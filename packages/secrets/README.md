# @claude-code-hooks/secrets

A Claude Code hook package that helps users feel safer by warning when **secret-like tokens** appear in tool inputs.

**Language / 언어:** English (main) · 한국어 (sub) — 한국어 안내는 [루트 문서](../../CONTRIBUTING.md) 하단에 포함되어 있습니다.

This is intentionally **high-signal and lightweight**: it detects only a few patterns that are commonly accidental leaks.

> Part of the [claude-hooks](../../README.md) monorepo.
>
> [Contributing](../../CONTRIBUTING.md) · [Security Policy](../../SECURITY.md) · [Releasing](../../RELEASING.md) · [License](../../LICENSE)

## Install / run

```bash
npx @claude-code-hooks/secrets@latest
```

## Project config: claude-hooks.config.json

Uses the same project config file as other packages.

Minimal schema:

```json
{
  "secrets": {
    "mode": "warn",
    "enabledEvents": ["PreToolUse", "PermissionRequest"],
    "ignore": { "regex": [] },
    "allow": { "regex": [] }
  }
}
```

- `allow.regex`: if any pattern matches, findings are suppressed
- `ignore.regex`: if any pattern matches, findings are suppressed and a dim note is printed

## Modes

- `warn` (default): prints warnings to stderr, exits 0
- `block`: exits 2 **only for HIGH confidence** findings (private key material)

## Commands

```bash
claude-secrets list-events
claude-secrets run --event PreToolUse --mode warn
claude-secrets doctor
```

## What it detects (v0.1)

- HIGH: `-----BEGIN (RSA|OPENSSH|EC|PGP) PRIVATE KEY-----`
- MED: OpenAI `sk-...`, GitHub `ghp_...` / `github_pat_...`, AWS `AKIA...`, Slack `xox...`

## Sanity checks

```bash
# warn
echo '{"text":"sk-1234567890123456789012345"}' | npx --yes @claude-code-hooks/secrets@latest run --event PreToolUse

# block (HIGH only)
echo '{"text":"-----BEGIN OPENSSH PRIVATE KEY-----"}' | npx --yes @claude-code-hooks/secrets@latest run --event PreToolUse --mode block
```
