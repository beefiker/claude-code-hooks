# @claude-code-hooks/security

A Claude Code hook package that helps users feel safer by **warning** (or optionally **blocking**) risky commands/tool invocations.

**Language / 언어:** English (main) · 한국어 (sub) — 한국어 안내는 [루트 문서](../../CONTRIBUTING.md) 하단에 포함되어 있습니다.

This is intentionally **heuristic** and **lightweight**: it scans hook payload JSON (from stdin) for suspicious patterns like `rm -rf`, `curl | bash`, writes to `~/.ssh`, etc.

> Part of the [claude-hooks](../../README.md) monorepo.
>
> [Contributing](../../CONTRIBUTING.md) · [Security Policy](../../SECURITY.md) · [Releasing](../../RELEASING.md) · [License](../../LICENSE)

## Install / run

Interactive setup:

```bash
npx @claude-code-hooks/security@latest
```

## Project config: claude-hooks.config.json

If `claude-hooks.config.json` exists in your project root, `claude-security` will use it as the source of truth for defaults.
Setup will also write/update it when you **Apply**.

Minimal schema:

```json
{
  "security": {
    "mode": "warn",
    "enabledEvents": ["PreToolUse", "PermissionRequest"],
    "ignore": { "regex": [] },
    "allow": { "regex": [] }
  }
}
```

- `allow.regex`: if any pattern matches the scanned text, **all risks are suppressed**
- `ignore.regex`: if any pattern matches, risks are suppressed and a dim note is printed

## What it writes

For each enabled event, it adds a managed hook handler like:

```json
{
  "type": "command",
  "command": "npx --yes @claude-code-hooks/security@latest run --event PreToolUse --mode warn --managed-by @claude-code-hooks/security",
  "async": false,
  "timeout": 8
}
```

It only manages hook handlers whose command contains:

```
--managed-by @claude-code-hooks/security
```

## Modes

- `warn` (default): prints warnings to stderr, exits 0
- `block`: exits 2 when a risk is detected (**PreToolUse only**; `PermissionRequest` stays advisory)

Start with **warn**. Blocking can be disruptive until the heuristics mature.

Note: even in `block` mode, `PermissionRequest` remains advisory (exits 0). We only hard-block `PreToolUse`.

## Commands

```bash
claude-security list-events
claude-security run --event PreToolUse --mode warn
claude-security doctor
```
