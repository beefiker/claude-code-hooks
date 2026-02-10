import { intro, multiselect, isCancel, cancel, note } from '@clack/prompts';
import { ansi as pc } from '@claude-code-hooks/core';
import { HOOK_EVENTS, applyMappingsToSettings, buildManagedCommand } from './hooks.js';
import { ensureSoundsLoaded, listSoundsGrouped } from './sounds.js';
import { selectWithSoundPreview } from './select-with-preview.js';

function dieCancelled(msg = 'Cancelled') {
  cancel(msg);
  process.exit(0);
}

function hookGroupForEvent({ eventName, soundId }) {
  return [
    {
      matcher: '*',
      hooks: [
        {
          type: 'command',
          command: buildManagedCommand({ eventName, soundId }),
          async: true,
          timeout: 5
        }
      ]
    }
  ];
}

export async function planInteractiveSetup({ action }) {
  if (action === 'uninstall') {
    return {
      key: 'sound',
      projectConfigSection: null,
      snippetHooks: {},
      applyToSettings: async (settings) => applyMappingsToSettings(settings, {})
    };
  }

  intro('sound');
  note('Pick events and choose a sound for each. (You can keep this minimal.)', '@claude-code-hooks/sound');

  const enabledEvents = await multiselect({
    message: '[sound] Which events should play sounds?',
    options: HOOK_EVENTS.map((e) => ({ value: e, label: e })),
    required: false
  });
  if (isCancel(enabledEvents)) dieCancelled();

  await ensureSoundsLoaded();
  const { grouped, labels } = await listSoundsGrouped();

  const allIds = [...grouped.common, ...grouped.game, ...grouped.ring, ...grouped.custom];
  const options = allIds.map((id) => ({ value: id, label: labels[id] ? `${id} (${labels[id]})` : id }));

  /** @type {Record<string, string>} */
  const mappings = {};

  for (const eventName of enabledEvents) {
    const soundId = await selectWithSoundPreview({
      message: `[sound] Select sound for ${pc.bold(eventName)}`,
      options
    });
    if (isCancel(soundId)) dieCancelled();
    if (soundId) mappings[eventName] = String(soundId);
  }

  const snippetHooks = {};
  for (const [eventName, soundId] of Object.entries(mappings)) {
    snippetHooks[eventName] = hookGroupForEvent({ eventName, soundId });
  }

  return {
    key: 'sound',
    projectConfigSection: { mappings },
    snippetHooks,
    applyToSettings: async (settings) => applyMappingsToSettings(settings, mappings)
  };
}
