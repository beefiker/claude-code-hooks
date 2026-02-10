import {
  ansi as pc,
  configPathForScope,
  readJsonIfExists,
  t,
  intro,
  multiselect,
  select,
  isCancel,
  cancel,
  note
} from '@claude-code-hooks/core';
import {
  HOOK_EVENTS,
  applyMappingsToSettings,
  buildManagedCommand,
  getExistingManagedMappings
} from './hooks.js';
import { ensureSoundsLoaded, listSoundsGrouped } from './sounds.js';
import { selectWithSoundPreview } from './select-with-preview.js';

function dieCancelled(msg, locale = 'en') {
  cancel(msg ?? t('cancelled', locale));
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

function categoryOptions(locale) {
  return [
    { value: 'common', label: t('soundCommon', locale) },
    { value: 'game', label: t('soundGame', locale) },
    { value: 'ring', label: t('soundRing', locale) },
    { value: 'custom', label: t('soundCustom', locale) }
  ];
}

export async function planInteractiveSetup({ action, projectDir, ui = 'standalone', locale = 'en' }) {
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
    note(t('soundPickEvents', locale), '@claude-code-hooks/sound');
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
    SessionStart: t('sound.ev.SessionStart', locale),
    UserPromptSubmit: t('sound.ev.UserPromptSubmit', locale),
    PreToolUse: t('sound.ev.PreToolUse', locale),
    PermissionRequest: t('sound.ev.PermissionRequest', locale),
    PostToolUse: t('sound.ev.PostToolUse', locale),
    PostToolUseFailure: t('sound.ev.PostToolUseFailure', locale),
    Notification: t('sound.ev.Notification', locale),
    SubagentStart: t('sound.ev.SubagentStart', locale),
    SubagentStop: t('sound.ev.SubagentStop', locale),
    Stop: t('sound.ev.Stop', locale),
    TeammateIdle: t('sound.ev.TeammateIdle', locale),
    TaskCompleted: t('sound.ev.TaskCompleted', locale),
    PreCompact: t('sound.ev.PreCompact', locale),
    SessionEnd: t('sound.ev.SessionEnd', locale)
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
        hint: `${desc} • ${t('soundInherited', locale)}: ${disp}`
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
    : t('soundLegendUmbrella', locale),
  'Legend');

  const enabledEvents = await multiselect({
    message: `[sound] ${t('soundWhichEvents', locale)}`,
    options: eventOptions,
    required: false
  });
  if (isCancel(enabledEvents)) dieCancelled(undefined, locale);

  /** @type {Record<string, string>} */
  const mappings = {};
  const cats = categoryOptions(locale);

  for (const eventName of enabledEvents) {
    // Pick category first (grouped UI)
    const availableCats = cats.filter((c) => (grouped[c.value]?.length ?? 0) > 0);

    const cat = await select({
      message: `[sound] ${t('soundCategoryFor', locale)} ${pc.bold(eventName)}`,
      options: availableCats
    });
    if (isCancel(cat)) dieCancelled(undefined, locale);

    const ids = grouped[cat] || [];

    // Show label mainly; fall back to filename. Sound IDs stay as-is (no translation).
    const options = ids.map((id) => ({ value: id, label: displaySoundId(id, labels), hint: labels?.[id] ? id : undefined }));

    const soundId = await selectWithSoundPreview({
      message: `[sound] ${t('soundFor', locale)} ${pc.bold(eventName)}`,
      options
    });
    if (isCancel(soundId)) dieCancelled(undefined, locale);
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
