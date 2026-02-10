import { select, confirm, isCancel, CANCEL } from '@claude-code-hooks/core';
import { playSoundPreview, stopPreview as _stopPreview } from './play.js';

// NOTE:
// This file used to implement a rich arrow-key preview UI via @clack/core.
// For a dependency-free CLI, we keep the *behavior* (preview before choosing)
// but switch to a simple numeric select + confirm loop.

/**
 * @template TValue
 * @param {{
 *   message: string;
 *   options: Array<{ value: TValue; label?: string; hint?: string; disabled?: boolean }>
 *   initialValue?: TValue;
 * }} opts
 * @returns {Promise<TValue | symbol>}
 */
export async function selectWithSoundPreview(opts) {
  // Filter disabled options out (minimal UI: don't show things you can't pick)
  const options = (opts.options || []).filter((o) => !o.disabled);

  while (true) {
    const value = await select({
      message: opts.message,
      options: options.map((o) => ({
        value: o.value,
        label: o.label ?? String(o.value),
        hint: o.hint
      })),
      initialValue: opts.initialValue
    });

    if (isCancel(value)) return CANCEL;

    try {
      playSoundPreview(String(value));
      const ok = await confirm({ message: 'Use this sound?', initialValue: true });
      _stopPreview();
      if (isCancel(ok)) continue;
      if (ok) return value;
      // else loop and pick again
    } catch {
      _stopPreview();
      return value;
    }
  }
}
