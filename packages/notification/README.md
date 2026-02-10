# @claude-code-hooks/notification

> Part of the [claude-code-hooks](../../README.md) monorepo.

**Zero-dependency** CLI that sends OS-level notifications from Claude Code hooks.

- **macOS**: `osascript` (`display notification`)
- **Linux**: `notify-send` (libnotify)
- **Windows**: PowerShell toast via Windows Runtime types (no external modules)

Falls back to stdout when no GUI environment is detected (SSH, headless, CI).

## Install / run

```bash
# One-shot via npx (no install needed)
npx --yes @claude-code-hooks/notification@latest --event Stop

# Or install globally
npm install -g @claude-code-hooks/notification
claude-code-hooks-notification --event Stop
```

## CLI options

```
claude-code-hooks-notification [options]

Options:
  --title <text>     Notification title (default: derived from --event or "Claude Code")
  --message <text>   Notification body  (default: derived from --event or stdin JSON)
  --event <name>     Hook event name (e.g. Stop, Notification, TaskCompleted)
  --dry-run          Build the command but don't execute it (prints JSON to stdout)
  -h, --help         Show this help
```

## Usage as a Claude Code hook

Add to your Claude Code `settings.json` (global `~/.claude/settings.json` or project `.claude/settings.json`):

### Notify on task completion

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

### Notify on the Notification event

The `Notification` event fires when Claude wants to get your attention (e.g., waiting for input, task complete). The hook payload includes a `message` field that gets used automatically:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx --yes @claude-code-hooks/notification@latest --event Notification",
            "timeout": 8
          }
        ]
      }
    ]
  }
}
```

### Multiple events

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
    ],
    "TaskCompleted": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx --yes @claude-code-hooks/notification@latest --event TaskCompleted",
            "timeout": 8
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx --yes @claude-code-hooks/notification@latest --event PostToolUseFailure",
            "timeout": 8
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx --yes @claude-code-hooks/notification@latest --event Notification",
            "timeout": 8
          }
        ]
      }
    ]
  }
}
```

### Custom title and message

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx --yes @claude-code-hooks/notification@latest --title 'Claude Ready' --message 'New session started!'",
            "timeout": 8
          }
        ]
      }
    ]
  }
}
```

## Hook event types and matchers

Claude Code supports these hook events. Each event fires with a JSON payload on stdin:

| Event | Matcher applies to | Description |
|---|---|---|
| `SessionStart` | — | Session begins |
| `UserPromptSubmit` | — | User submits a prompt |
| `PreToolUse` | tool name | Before a tool is invoked |
| `PermissionRequest` | tool name | Permission dialog shown |
| `PostToolUse` | tool name | After a tool completes |
| `PostToolUseFailure` | tool name | After a tool fails |
| `Notification` | — | Claude wants your attention |
| `SubagentStart` | — | Sub-agent launched |
| `SubagentStop` | — | Sub-agent finished |
| `Stop` | stop reason | Claude stops generating |
| `TeammateIdle` | — | Teammate agent is idle |
| `TaskCompleted` | — | Task is complete |
| `PreCompact` | — | About to compact context |
| `SessionEnd` | — | Session ends |

### Matcher patterns

The `matcher` field in hook config filters when the hook runs:

- `"*"` — match all (most common for notifications)
- `"Write"` — match only the Write tool (for `PreToolUse`, `PostToolUse`, etc.)
- `"Bash"` — match only the Bash/shell tool
- `"end_turn"` — match the end_turn stop reason (for `Stop`)

## Stdin JSON payload

When invoked as a hook, Claude Code pipes a JSON payload via stdin. Example for a `Stop` event:

```json
{
  "hook_event_name": "Stop",
  "stop_hook_reason": "end_turn",
  "transcript_messages": []
}
```

Example for a `Notification` event:

```json
{
  "hook_event_name": "Notification",
  "message": "I've finished the refactoring. Please review the changes."
}
```

The CLI automatically extracts `hook_event_name`, `message`, and `tool_name` to build a meaningful notification.

## Safety

- **No `shell=true`**: All OS commands use `child_process.spawn` with explicit argument arrays — no shell interpretation.
- **Input sanitization**: Title and message are stripped of control characters and truncated (256 / 1024 chars).
- **Injection prevention**: macOS uses AppleScript string escaping. Windows encodes strings as base64 and decodes inside PowerShell, bypassing any escaping issues. Linux passes arguments directly to `notify-send`.
- **Non-GUI fallback**: In SSH/headless/CI environments (no `$DISPLAY` or `$WAYLAND_DISPLAY`), the notification is printed to stdout instead.

## Platform support

| Platform | Method | Requirements |
|----------|--------|-------------|
| **macOS** | `osascript` | Built-in, no setup needed |
| **Linux** | `notify-send` | Install `libnotify-bin` (apt) or `libnotify` (pacman/dnf). Needs X11 or Wayland. |
| **Windows** | PowerShell toast | Built-in PowerShell 5+. Uses `Windows.UI.Notifications` WinRT types. |
| **Other/Headless** | stdout | Prints `[notification] Title: Message` to stdout |

## Dry-run

Use `--dry-run` to inspect what OS command would be executed without actually sending a notification:

```bash
claude-code-hooks-notification --event Stop --dry-run
```

Output (macOS example):

```json
{
  "sent": false,
  "method": "dry-run",
  "command": "osascript",
  "args": ["-e", "display notification \"Claude Code has finished its task.\" with title \"Task Complete\""]
}
```

## Programmatic API

```js
import { sendNotification } from '@claude-code-hooks/notification';

const result = await sendNotification({
  title: 'Build Done',
  message: 'All 42 tests passed.',
  dryRun: false
});

console.log(result);
// { sent: true, method: 'osascript', command: 'osascript', args: [...] }
```
