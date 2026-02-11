import { intro, multiselect, select, text, spinner, isCancel, cancel, note } from '@clack/prompts';
import { ansi as pc, configPathForScope, readJsonIfExists } from '@claude-code-hooks/core';
import {
  HOOK_EVENTS,
  applyMappingsToSettings,
  buildManagedCommand,
  getExistingManagedMappings
} from './hooks.js';
import { ensureSoundsLoaded, listSoundsGrouped, invalidateSoundCache } from './sounds.js';
import { selectWithSoundPreview } from './select-with-preview.js';
import { generateTts } from './tts.js';

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
  { value: 'custom', label: 'Custom (TTS & imported)' },
  { value: '__create__', label: 'Create my own (text-to-speech)' }
];

export async function planInteractiveSetup({ action, projectDir, ui = 'standalone' }) {
  if (action === 'uninstall') {
    return {
      key: 'sound',
      projectConfigSection: null,
      snippetHooks: {},
      applyToSettings: async (settings) => applyMappingsToSettings(settings, {})
    };
  }

  if (ui !== 'umbrella') {
    intro('sound');
    note('Pick events and choose a sound for each. (You can keep this minimal.)', '@claude-code-hooks/sound');
  }

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

  /** Build event options (flat list; keep labels short, details in hint). */
  const eventOptions = HOOK_EVENTS.map((e) => {
    const desc = eventDescs[e] || '';
    const inheritedId = inherited[e];
    if (inheritedId) {
      const disp = displaySoundId(inheritedId, labels);
      return {
        value: e,
        label: e,
        hint: `${desc} • inherited: ${disp}`
      };
    }
    return {
      value: e,
      label: e,
      hint: desc
    };
  });

  note(ui !== 'umbrella'
    ? `Hint shows meaning; “inherited” means already set in ~/.claude/settings.json`
    : `Hint shows meaning (and inherited)`,
  'Legend');

  const enabledEvents = await multiselect({
    message: '[sound] Which events should play sounds?',
    options: eventOptions,
    required: false
  });
  if (isCancel(enabledEvents)) dieCancelled();

  /** @type {Record<string, string>} */
  const mappings = {};

  for (const eventName of enabledEvents) {
    // Pick category first (grouped UI). __create__ is always available for TTS.
    const availableCats = CATEGORY_OPTIONS.filter(
      (c) => c.value === '__create__' || (grouped[c.value]?.length ?? 0) > 0
    );

    const cat = await select({
      message: `[sound] Category for ${pc.bold(eventName)}`,
      options: availableCats
    });
    if (isCancel(cat)) dieCancelled();

    let soundId;

    if (cat === '__create__') {
      // TTS flow: language → text → generate
      const langChoice = await select({
        message: `[sound] Language for TTS (${eventName})`,
        options: [
          { value: 'en', label: 'English (default)' },
          { value: 'ko', label: 'Korean (한국어)' }
        ]
      });
      if (isCancel(langChoice)) dieCancelled();

      const textInput = await text({
        message: `[sound] Enter text to speak${langChoice === 'ko' ? ' (e.g. "클로드가 준비됐어요!")' : ' (e.g. "Claude is ready!")'}`,
        placeholder: langChoice === 'ko' ? '클로드가 준비됐어요!' : 'Claude is ready!',
        validate: (v) => {
          if (!v?.trim()) return 'Text cannot be empty';
          if (v.length > 200) return 'Keep it under 200 characters';
          return undefined;
        }
      });
      if (isCancel(textInput)) dieCancelled();

      const s = spinner();
      s.start('Generating speech...');
      try {
        const result = await generateTts(textInput, { lang: langChoice });
        invalidateSoundCache();
        await ensureSoundsLoaded(); // Rebuild cache so selectWithSoundPreview works for next event
        soundId = result.soundId;
        s.stop('Done');
      } catch (err) {
        s.stop('Failed');
        note(String(err?.message ?? err), 'Error');
        continue;
      }
    } else {
      await ensureSoundsLoaded(); // Ensure cache is ready for playSoundPreview (may have been invalidated by TTS)
      const ids = grouped[cat] || [];
      const options = ids.map((id) => ({
        value: id,
        label: displaySoundId(id, labels),
        hint: labels?.[id] ? id : undefined
      }));

      soundId = await selectWithSoundPreview({
        message: `[sound] Sound for ${pc.bold(eventName)}`,
        options
      });
      if (isCancel(soundId)) dieCancelled();
    }

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
