#!/usr/bin/env node
/**
 * Manual TTY test script for prompts.
 * Run in a real terminal: node scripts/test-prompts-tty.mjs
 *
 * Steps:
 * 1. Select: arrows, Enter, Esc
 * 2. Multiselect: arrows, Space, Enter, Esc
 * 3. initialValue / initialValues
 * 4. disabled options
 * 5. required (multiselect)
 */
import {
  intro,
  outro,
  select,
  multiselect,
  isCancel,
  cancel,
  note
} from '@claude-code-hooks/core';

async function main() {
  intro(' prompts TTY test ');

  // 1. Select basic
  note('Test 1: Select — use ↑/↓, Enter to pick, Esc to cancel', 'Select');
  const s1 = await select({
    message: 'Pick one',
    options: [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
      { value: 'c', label: 'Option C' }
    ]
  });
  if (isCancel(s1)) {
    cancel('Cancelled');
    process.exit(0);
  }
  note(`Selected: ${s1}`, 'Result');

  // 2. Select with initialValue and disabled
  note('Test 2: Select with initialValue (b) and disabled option', 'Select');
  const s2 = await select({
    message: 'Pick (default: B)',
    options: [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B (default)' },
      { value: 'c', label: 'Option C (disabled)', disabled: true }
    ],
    initialValue: 'b'
  });
  if (isCancel(s2)) {
    cancel('Cancelled');
    process.exit(0);
  }
  note(`Selected: ${s2}`, 'Result');

  // 3. Multiselect
  note('Test 3: Multiselect — ↑/↓, Space to toggle, Enter to confirm', 'Multiselect');
  const m1 = await multiselect({
    message: 'Pick multiple',
    options: [
      { value: 'x', label: 'Item X' },
      { value: 'y', label: 'Item Y' },
      { value: 'z', label: 'Item Z' }
    ]
  });
  if (isCancel(m1)) {
    cancel('Cancelled');
    process.exit(0);
  }
  note(`Selected: ${m1.join(', ')}`, 'Result');

  // 4. Multiselect with initialValues and required
  note('Test 4: Multiselect with initialValues, required', 'Multiselect');
  const m2 = await multiselect({
    message: 'Pick at least one (pre-selected: X, Z)',
    options: [
      { value: 'x', label: 'Item X' },
      { value: 'y', label: 'Item Y' },
      { value: 'z', label: 'Item Z' }
    ],
    initialValues: ['x', 'z'],
    required: true
  });
  if (isCancel(m2)) {
    cancel('Cancelled');
    process.exit(0);
  }
  note(`Selected: ${m2.join(', ')}`, 'Result');

  outro('All tests passed');
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
