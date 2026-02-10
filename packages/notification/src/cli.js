#!/usr/bin/env node

/**
 * claude-code-hooks-notification
 *
 * CLI hook handler that sends OS-level notifications.
 * Reads hook JSON from stdin (when invoked as a Claude Code hook),
 * accepts --title, --message, --event, --dry-run flags.
 *
 * Usage:
 *   claude-code-hooks-notification --title "Build done" --message "All tests passed"
 *   echo '{"hook_event_name":"Stop"}' | claude-code-hooks-notification --event Stop
 */

import process from 'node:process';
import { sendNotification } from './notify.js';
import { readHookPayload } from './stdin.js';

/** Default titles per hook event. */
const EVENT_TITLES = {
  SessionStart: 'Session Started',
  UserPromptSubmit: 'Prompt Submitted',
  PreToolUse: 'Tool Use (Pre)',
  PermissionRequest: 'Permission Request',
  PostToolUse: 'Tool Completed',
  PostToolUseFailure: 'Tool Failed',
  Notification: 'Claude Code',
  SubagentStart: 'Sub-agent Started',
  SubagentStop: 'Sub-agent Stopped',
  Stop: 'Task Complete',
  TeammateIdle: 'Teammate Idle',
  TaskCompleted: 'Task Completed',
  PreCompact: 'Compacting Context',
  SessionEnd: 'Session Ended'
};

/** Default messages per hook event. */
const EVENT_MESSAGES = {
  SessionStart: 'A new Claude Code session has started.',
  UserPromptSubmit: 'Your prompt was submitted.',
  PreToolUse: 'A tool is about to be used.',
  PermissionRequest: 'Claude Code is requesting permission.',
  PostToolUse: 'A tool has finished executing.',
  PostToolUseFailure: 'A tool execution has failed.',
  Notification: 'You have a notification from Claude Code.',
  SubagentStart: 'A sub-agent has started.',
  SubagentStop: 'A sub-agent has stopped.',
  Stop: 'Claude Code has finished its task.',
  TeammateIdle: 'A teammate agent is idle.',
  TaskCompleted: 'The task has been completed.',
  PreCompact: 'Claude Code is compacting conversation context.',
  SessionEnd: 'The Claude Code session has ended.'
};

/**
 * Parse CLI arguments.
 * @param {string[]} argv
 * @returns {{ title: string | undefined, message: string | undefined, event: string | undefined, dryRun: boolean, help: boolean }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  let title;
  let message;
  let event;
  let dryRun = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--title' && i + 1 < args.length) {
      title = args[++i];
    } else if (arg === '--message' && i + 1 < args.length) {
      message = args[++i];
    } else if (arg === '--event' && i + 1 < args.length) {
      event = args[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '-h' || arg === '--help') {
      help = true;
    }
  }

  return { title, message, event, dryRun, help };
}

function usage(exitCode = 0) {
  process.stdout.write(`\
claude-code-hooks-notification

Send an OS-level notification. Designed as a Claude Code hook handler.

Usage:
  claude-code-hooks-notification [options]

Options:
  --title <text>     Notification title (default: derived from --event or "Claude Code")
  --message <text>   Notification body  (default: derived from --event or stdin JSON)
  --event <name>     Hook event name (e.g. Stop, Notification, TaskCompleted)
  --dry-run          Build the command but don't execute it (prints JSON to stdout)
  -h, --help         Show this help

Stdin:
  When used as a Claude Code hook, JSON is piped via stdin.
  Fields used: hook_event_name, tool_name, message

Examples:
  # Simple notification
  claude-code-hooks-notification --title "Done" --message "Build finished"

  # As a Claude Code hook (reads event from stdin JSON)
  echo '{"hook_event_name":"Stop"}' | claude-code-hooks-notification

  # Dry-run to inspect the OS command
  claude-code-hooks-notification --event Stop --dry-run

  # In Claude Code settings.json
  # "hooks": {
  #   "Stop": [{ "matcher": "*", "hooks": [{
  #     "type": "command",
  #     "command": "npx --yes @claude-code-hooks/notification@latest --event Stop",
  #     "timeout": 8
  #   }]}]
  # }
`);
  process.exit(exitCode);
}

/**
 * Derive a human-readable message from the hook payload.
 * @param {Record<string, unknown> | null} payload
 * @param {string | undefined} eventName
 * @returns {string}
 */
function deriveMessageFromPayload(payload, eventName) {
  if (!payload) {
    return eventName ? (EVENT_MESSAGES[eventName] || `Hook event: ${eventName}`) : '';
  }

  // Use "message" field if present (e.g. Notification event)
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  // For tool-related events, include the tool name
  const toolName = payload.tool_name;
  if (typeof toolName === 'string' && toolName.trim()) {
    const hookEvent = eventName || payload.hook_event_name;
    if (hookEvent === 'PostToolUse') return `Tool "${toolName}" completed.`;
    if (hookEvent === 'PostToolUseFailure') return `Tool "${toolName}" failed.`;
    if (hookEvent === 'PreToolUse') return `About to use tool "${toolName}".`;
  }

  // Default per-event message
  const resolvedEvent = eventName || (typeof payload.hook_event_name === 'string' ? payload.hook_event_name : undefined);
  if (resolvedEvent && EVENT_MESSAGES[resolvedEvent]) {
    return EVENT_MESSAGES[resolvedEvent];
  }

  return 'You have a notification from Claude Code.';
}

async function main() {
  const parsed = parseArgs(process.argv);

  if (parsed.help) {
    usage(0);
  }

  // Read hook payload from stdin (non-blocking, with timeout)
  const payload = await readHookPayload(2000);

  // Resolve event name: CLI flag > stdin payload
  const eventName = parsed.event
    || (payload && typeof payload.hook_event_name === 'string' ? payload.hook_event_name : undefined);

  // Resolve title: CLI flag > event default > generic
  const title = parsed.title
    || (eventName ? (EVENT_TITLES[eventName] || eventName) : undefined)
    || 'Claude Code';

  // Resolve message: CLI flag > payload-derived > event default
  const message = parsed.message || deriveMessageFromPayload(payload, eventName);

  const result = await sendNotification({
    title,
    message,
    dryRun: parsed.dryRun
  });

  if (parsed.dryRun) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  }

  // Exit cleanly regardless of whether notification was sent or fell back
  if (!result.sent && result.fallbackReason) {
    process.stderr.write(`[notification] fallback: ${result.fallbackReason}\n`);
  }

  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
