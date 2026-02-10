import { intro, multiselect, select, isCancel, cancel, note } from '@clack/prompts';
import { ansi as pc, configPathForScope, readJsonIfExists } from '@claude-code-hooks/core';
import {
  HOOK_EVENTS,
  applyMappingsToSettings,
  buildManagedCommand,
  getExistingManagedMappings
} from './hooks.js';
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

function displaySoundId(soundId, labels) {
  if (!soundId) return '';
  // Prefer friendly label, otherwise fall back to filename-ish.
  const label = labels?.[soundId];
  if (label) return label;
  if (soundId.includes('/')) return soundId.split('/')[1];
  return soundId;
}

const CATEGORY_OPTIONS = [
  { value: 'common', label: 'Common' },
  { value: 'game', label: 'Game' },
  { value: 'ring', label: 'Ring' },
  { value: 'custom', label: 'Custom' }
];

export async function planInteractiveSetup({ action, projectDir }) {
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

  const baseDir = projectDir || process.cwd();

  // Inheritance: if global settings already have managed sound hooks, show them as inherited defaults.
  let inherited = {};
  try {
    const globalPath = configPathForScope('global', baseDir);
    const res = await readJsonIfExists(globalPath);
    if (res.ok) inherited = getExistingManagedMappings(res.value);
  } catch {
    // ignore
  }

  await ensureSoundsLoaded();
  const { grouped, labels } = await listSoundsGrouped();

  const eventDescs = {
    SessionStart: 'New session begins',
    UserPromptSubmit: 'User sends a prompt',
    PreToolUse: 'Before a tool runs',
    PermissionRequest: 'Tool asks for permission',
    PostToolUse: 'After a tool completes',
    PostToolUseFailure: 'Tool execution failed',
    Notification: 'Claude sends a notification',
    SubagentStart: 'Sub-agent spawned',
    SubagentStop: 'Sub-agent finished',
    Stop: 'Claude stops responding',
    TeammateIdle: 'Teammate becomes idle',
    TaskCompleted: 'Task finished',
    PreCompact: 'Before context compaction',
    SessionEnd: 'Session ends'
  };

  const EVENT_SECTIONS = [
    { header: 'Session', events: ['SessionStart', 'UserPromptSubmit', 'Stop', 'SessionEnd'] },
    { header: 'Tooling', events: ['PreToolUse', 'PermissionRequest', 'PostToolUse', 'PostToolUseFailure'] },
    { header: 'Notifications', events: ['Notification'] },
    { header: 'Agents', events: ['SubagentStart', 'SubagentStop', 'TeammateIdle'] },
    { header: 'Other', events: ['TaskCompleted', 'PreCompact'] }
  ];

  /** Build grouped options with disabled section headers. */
  const eventOptions = [];
  for (const section of EVENT_SECTIONS) {
    const hdr = String(section.header || '').toUpperCase();
    eventOptions.push({ value: `__hdr_${hdr}`, label: pc.dim(pc.bold(hdr)), disabled: true });

    for (const e of section.events) {
      const desc = eventDescs[e] || '';
      const inheritedId = inherited[e];

      if (inheritedId) {
        const disp = displaySoundId(inheritedId, labels);
        eventOptions.push({
          value: e,
          label: e,
          hint: `${desc} • inherited: ${disp}`
        });
      } else {
        eventOptions.push({
          value: e,
          label: e,
          hint: desc
        });
      }
    }
  }

  note(`Inherited = already set in ~/.claude/settings.json`, 'Legend');

  const enabledEvents = await multiselect({
    message: '[sound] Which events should play sounds?',
    options: eventOptions,
    required: false
  });
  if (isCancel(enabledEvents)) dieCancelled();

  /** @type {Record<string, string>} */
  const mappings = {};

  for (const eventName of enabledEvents) {
    // Pick category first (grouped UI)
    const availableCats = CATEGORY_OPTIONS.filter((c) => (grouped[c.value]?.length ?? 0) > 0);

    const cat = await select({
      message: `[sound] Category for ${pc.bold(eventName)}`,
      options: availableCats
    });
    if (isCancel(cat)) dieCancelled();

    const ids = grouped[cat] || [];

    // Show label mainly; fall back to filename.
    const options = ids.map((id) => ({ value: id, label: displaySoundId(id, labels), hint: labels?.[id] ? id : undefined }));

    const soundId = await selectWithSoundPreview({
      message: `[sound] Sound for ${pc.bold(eventName)}`,
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
