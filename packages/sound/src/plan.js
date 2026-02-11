import { intro, multiselect, select, text, spinner, isCancel, cancel, note } from '@clack/prompts';
import { ansi as pc, configPathForScope, readJsonIfExists, t } from '@claude-code-hooks/core';
import {
  HOOK_EVENTS,
  applyMappingsToSettings,
  buildManagedCommand,
  getExistingManagedMappings
} from './hooks.js';
import { ensureSoundsLoaded, listSoundsGrouped, invalidateSoundCache } from './sounds.js';
import { selectWithSoundPreview } from './select-with-preview.js';
import { generateTts } from './tts.js';

function dieCancelled(msg) {
  cancel(msg ?? t('common.cancelled'));
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

function getCategoryOptions() {
  return [
    { value: 'common', label: t('sound.common') },
    { value: 'game', label: t('sound.game') },
    { value: 'ring', label: t('sound.ring') },
    { value: 'custom', label: t('sound.custom') },
    { value: '__create__', label: t('sound.createTts') }
  ];
}

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
    note(t('sound.introHint'), t('sound.title'));
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
    SessionStart: t('soundEvents.SessionStart'),
    UserPromptSubmit: t('soundEvents.UserPromptSubmit'),
    PreToolUse: t('soundEvents.PreToolUse'),
    PermissionRequest: t('soundEvents.PermissionRequest'),
    PostToolUse: t('soundEvents.PostToolUse'),
    PostToolUseFailure: t('soundEvents.PostToolUseFailure'),
    Notification: t('soundEvents.Notification'),
    SubagentStart: t('soundEvents.SubagentStart'),
    SubagentStop: t('soundEvents.SubagentStop'),
    Stop: t('soundEvents.Stop'),
    TeammateIdle: t('soundEvents.TeammateIdle'),
    TaskCompleted: t('soundEvents.TaskCompleted'),
    PreCompact: t('soundEvents.PreCompact'),
    SessionEnd: t('soundEvents.SessionEnd')
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
        hint: `${desc} • ${t('sound.inherited')}: ${disp}`
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
    : t('sound.legendHintUmbrella'), t('sound.legend'));

  const enabledEvents = await multiselect({
    message: t('sound.whichEvents'),
    options: eventOptions,
    required: false
  });
  if (isCancel(enabledEvents)) dieCancelled();

  /** @type {Record<string, string>} */
  const mappings = {};

  for (const eventName of enabledEvents) {
    const availableCats = getCategoryOptions().filter(
      (c) => c.value === '__create__' || (grouped[c.value]?.length ?? 0) > 0
    );

    const cat = await select({
      message: t('sound.categoryFor', { event: eventName }),
      options: availableCats
    });
    if (isCancel(cat)) dieCancelled();

    let soundId;

    if (cat === '__create__') {
      const langChoice = await select({
        message: t('sound.languageForTts', { event: eventName }),
        options: [
          { value: 'en', label: t('sound.langEn') },
          { value: 'ko', label: t('sound.langKo') }
        ]
      });
      if (isCancel(langChoice)) dieCancelled();

      const textInput = await text({
        message: `[sound] Enter text to speak${langChoice === 'ko' ? t('sound.enterTextKo') : t('sound.enterTextEn')}`,
        placeholder: langChoice === 'ko' ? t('sound.placeholderKo') : t('sound.placeholderEn'),
        validate: (v) => {
          if (!v?.trim()) return t('sound.textEmpty');
          if (v.length > 200) return t('sound.textTooLong');
          return undefined;
        }
      });
      if (isCancel(textInput)) dieCancelled();

      const s = spinner();
      s.start(t('sound.generatingSpeech'));
      try {
        const result = await generateTts(textInput, { lang: langChoice });
        invalidateSoundCache();
        await ensureSoundsLoaded();
        soundId = result.soundId;
        s.stop(t('common.done'));
      } catch (err) {
        s.stop('Failed');
        note(String(err?.message ?? err), t('common.error'));
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
        message: t('sound.soundFor', { event: eventName }),
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
