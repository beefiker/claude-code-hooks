import { intro, multiselect, isCancel, cancel, note } from '@clack/prompts';
import { ansi as pc } from '@claude-code-hooks/core';

import { HOOK_EVENTS, applyEventsToSettings, buildManagedCommand, getExistingManagedEvents } from './hooks.js';

function dieCancelled(msg = 'Cancelled') {
  cancel(msg);
  process.exit(0);
}

function hookGroupForEvent({ eventName }) {
  return [
    {
      matcher: '*',
      hooks: [
        {
          type: 'command',
          command: buildManagedCommand({ eventName }),
          async: true,
          timeout: 8
        }
      ]
    }
  ];
}

export async function planInteractiveSetup({ action, projectDir, ui = 'standalone' }) {
  if (action === 'uninstall') {
    return {
      key: 'notification',
      projectConfigSection: null,
      snippetHooks: {},
      applyToSettings: async (settings) => applyEventsToSettings(settings, [])
    };
  }

  if (ui !== 'umbrella') {
    intro('notification');
    note('Pick events to trigger OS notifications. (Keep it minimal.)', '@claude-code-hooks/notification');
  }

  // Inheritance: show which events are already enabled globally (managed by us).
  // In umbrella UI, we can't reliably read global settings here without a helper,
  // so we just provide a hint in the legend.
  const inherited = new Set();
  try {
    // In umbrella mode, caller already has access to settings; but this planner
    // is also usable standalone, so accept a best-effort empty set.
    // (The umbrella CLI will run applyToSettings against a loaded settings object.)
    // eslint-disable-next-line no-unused-vars
    void projectDir;
  } catch {
    // ignore
  }

  const eventDescs = {
    SessionStart: 'Session begins or resumes',
    UserPromptSubmit: 'You submit a prompt',
    PreToolUse: 'Before a tool runs',
    PermissionRequest: 'Permission dialog appears',
    PostToolUse: 'Tool call succeeds',
    PostToolUseFailure: 'Tool call fails',
    Notification: 'Claude Code sends a notification',
    SubagentStart: 'Sub-agent spawned',
    SubagentStop: 'Sub-agent finishes',
    Stop: 'Claude finishes responding',
    TeammateIdle: 'Teammate about to go idle',
    TaskCompleted: 'Task marked completed',
    PreCompact: 'Before context compaction',
    SessionEnd: 'Session terminates'
  };

  const eventOptions = HOOK_EVENTS.map((e) => {
    const desc = eventDescs[e] || '';
    const hint = inherited.has(e) ? `${desc} • inherited` : desc;
    return { value: e, label: e, hint };
  });

  if (ui !== 'umbrella') {
    note('Notification will no-op in remote/headless environments; it falls back to stdout.', 'Note');
  }

  const enabledEvents = await multiselect({
    message: `${pc.bold('notification')}  Events that should show OS notifications`,
    options: eventOptions,
    required: false
  });
  if (isCancel(enabledEvents)) dieCancelled();

  const snippetHooks = {};
  for (const eventName of enabledEvents) {
    snippetHooks[eventName] = hookGroupForEvent({ eventName });
  }

  return {
    key: 'notification',
    projectConfigSection: { events: enabledEvents },
    snippetHooks,
    applyToSettings: async (settings) => applyEventsToSettings(settings, enabledEvents),
    // for potential future use
    getExistingManagedEvents
  };
}
