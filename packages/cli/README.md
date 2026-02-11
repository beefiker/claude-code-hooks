# @claude-code-hooks/cli

> Part of the [claude-code-hooks](../../README.md) monorepo.

Umbrella wizard CLI to set up and manage `@claude-code-hooks` packages for Claude Code (sound, notification, security, secrets).

![CLI install and usage demo](https://github.com/beefiker/claude-code-hooks/raw/main/images/claude-code-hooks-cli.gif)

## Install / run

From anywhere:

```bash
npx @claude-code-hooks/cli@latest
```

You'll be prompted to choose which packages to configure and where to write settings:

- Project (shared): `.claude/settings.json`
- Project (local): `.claude/settings.local.json`
- Global: `~/.claude/settings.json`

Then you can enable/disable each package (sound, notification, security, secrets) and customize their options.

---

## @claude-code-hooks/sound

Cross-platform CLI (macOS, Windows, Linux) that configures **Claude Code Hooks** to play **bundled sounds**.

![claude-sound CLI](https://github.com/beefiker/claude-code-hooks/raw/main/packages/sound/assets/images/how-to-use.gif)

- Setup UI: `npx @claude-code-hooks/sound@latest`
- Hook runner: `npx --yes @claude-code-hooks/sound@latest play --event <Event> --sound <SoundId> --managed-by @claude-code-hooks/sound`

### Install / run

```bash
npx @claude-code-hooks/sound@latest
```

You'll be prompted to choose where to write settings, then enable/disable events and choose a sound per event. Selecting a sound plays a quick preview. Choose **Create my own** to generate custom text-to-speech sounds, or **Import from file** to add your own MP3/WAV files.

### Commands

```bash
claude-sound list-events
claude-sound list-sounds
claude-sound play --sound ring1
claude-sound import <path>   # Import MP3/WAV into ~/.claude-sound/sounds/
```

### Uninstall / remove hooks

Run the setup again and choose **Remove all claude-sound hooks**, then **Apply**. Or manually delete any hook handlers whose command contains:

```
--managed-by @claude-code-hooks/sound
```

### Create my own (text-to-speech)

When picking a sound, choose **Create my own** to generate custom sounds from text. Supports English (default) and Korean. See [packages/sound/docs/TTS.md](../sound/docs/TTS.md) for details.

### Import from file

Choose **Import from file** and enter a path to an MP3 or WAV file. Or use the CLI:

```bash
claude-sound import ./my-notification.mp3
```

Supported formats: MP3, WAV. Max file size: 5MB.

### Platform support

| Platform | Audio player | Notes |
|----------|--------------|-------|
| **macOS** | `afplay` | Built-in, no setup needed |
| **Windows** | `ffplay`, `mpv`, `mpg123`, or PowerShell | Install [ffmpeg](https://ffmpeg.org/) or [mpv](https://mpv.io/) for best support. PowerShell plays WAV only. |
| **Linux** | `ffplay`, `mpv`, `mpg123`, `aplay`, etc. | Install ffmpeg or mpv for MP3 support. |

---

## @claude-code-hooks/notification

**Zero-dependency** CLI that sends OS-level notifications from Claude Code hooks.

- **macOS**: `osascript` (`display notification`)
- **Linux**: `notify-send` (libnotify)
- **Windows**: PowerShell toast via Windows Runtime types (no external modules)

Falls back to stdout when no GUI environment is detected (SSH, headless, CI).

### Install / run

```bash
npx --yes @claude-code-hooks/notification@latest --event Stop
```

### CLI options

```
--title <text>     Notification title (default: derived from --event or "Claude Code")
--message <text>   Notification body  (default: derived from --event or stdin JSON)
--event <name>     Hook event name (e.g. Stop, Notification, TaskCompleted)
--dry-run          Build the command but don't execute it (prints JSON to stdout)
```

### Usage as a Claude Code hook

Add to your Claude Code `settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx --yes @claude-code-hooks/notification@latest --event Stop",
            "timeout": 8
          }
        ]
      }
    ]
  }
}
```

### Hook event types

| Event | Description |
|-------|-------------|
| `SessionStart` | Session begins |
| `Stop` | Claude stops generating |
| `TaskCompleted` | Task is complete |
| `Notification` | Claude wants your attention |
| `PostToolUseFailure` | After a tool fails |
| ... and more |

### Platform support

| Platform | Method | Requirements |
|----------|--------|--------------|
| **macOS** | `osascript` | Built-in |
| **Linux** | `notify-send` | Install `libnotify-bin` (apt) or `libnotify` (pacman/dnf) |
| **Windows** | PowerShell toast | Built-in PowerShell 5+ |
| **Other/Headless** | stdout | Prints `[notification] Title: Message` to stdout |

---

## @claude-code-hooks/security

Warns (or optionally **blocks**) risky commands/tool invocations. Heuristic and lightweight: scans for suspicious patterns like `rm -rf`, `curl | bash`, writes to `~/.ssh`, etc.

### Install / run

```bash
npx @claude-code-hooks/security@latest
```

### Project config: claude-code-hooks.config.json

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

- `allow.regex`: if any pattern matches, **all risks are suppressed**
- `ignore.regex`: if any pattern matches, risks are suppressed and a dim note is printed

### Modes

- `warn` (default): prints warnings to stderr, exits 0
- `block`: exits 2 when a risk is detected (**PreToolUse only**; `PermissionRequest` stays advisory)

### Commands

```bash
claude-security list-events
claude-security run --event PreToolUse --mode warn
claude-security doctor
```

---

## @claude-code-hooks/secrets

Warns when **secret-like tokens** appear in tool inputs — and optionally scans **staged git files** before commits.

### Install / run

```bash
npx @claude-code-hooks/secrets@latest
```

### Project config: claude-code-hooks.config.json

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

- `scanGitCommit`: when `true`, intercepts `git commit` and scans staged files for secret patterns

### Modes

- `warn` (default): prints warnings to stderr, exits 0
- `block`: exits 2 **only for HIGH confidence** findings (private key material)

### What it detects

- **HIGH**: `-----BEGIN (RSA|OPENSSH|EC|PGP|DSA|ENCRYPTED) PRIVATE KEY-----`
- **MED**: OpenAI `sk-...`, GitHub `ghp_...` / `github_pat_...`, AWS `AKIA...`, Slack `xox*`, Google `AIza...`, Stripe `sk_live_...`, npm `npm_...`, PyPI `pypi-...`, DB URLs with credentials, etc.

### Commands

```bash
claude-secrets list-events
claude-secrets run --event PreToolUse --mode warn
claude-secrets doctor
```
