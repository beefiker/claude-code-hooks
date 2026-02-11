import { intro, multiselect, isCancel, cancel, note } from '@clack/prompts';
import { ansi as pc, t } from '@claude-code-hooks/core';

import { HOOK_EVENTS, applyEventsToSettings, buildManagedCommand, getExistingManagedEvents } from './hooks.js';

function dieCancelled(msg) {
  cancel(msg ?? t('common.cancelled'));
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
    intro(t('notification.title'));
    note(t('notification.introHint'), t('notification.title'));
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
    SessionStart: t('notification.eventSessionStart'),
    UserPromptSubmit: t('notification.eventUserPromptSubmit'),
    PreToolUse: t('notification.eventPreToolUse'),
    PermissionRequest: t('notification.eventPermissionRequest'),
    PostToolUse: t('notification.eventPostToolUse'),
    PostToolUseFailure: t('notification.eventPostToolUseFailure'),
    Notification: t('notification.eventNotification'),
    SubagentStart: t('notification.eventSubagentStart'),
    SubagentStop: t('notification.eventSubagentStop'),
    Stop: t('notification.eventStop'),
    TeammateIdle: t('notification.eventTeammateIdle'),
    TaskCompleted: t('notification.eventTaskCompleted'),
    PreCompact: t('notification.eventPreCompact'),
    SessionEnd: t('notification.eventSessionEnd')
  };

  const eventOptions = HOOK_EVENTS.map((e) => {
    const desc = eventDescs[e] || '';
    const hint = inherited.has(e) ? `${desc} • ${t('sound.inherited')}` : desc;
    return { value: e, label: e, hint };
  });

  if (ui !== 'umbrella') {
    note(t('notification.noteHeadless'), t('notification.note'));
  }

  const enabledEvents = await multiselect({
    message: `${pc.bold('notification')}  ${t('notification.eventsForNotifications')}`,
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
