export { ansi } from './ansi.js';
export {
  CONFIG_FILENAME,
  configFilePath,
  readProjectConfig,
  writeProjectConfig,
  compileRegexList
} from './project-config.js';
export { buildCombinedText } from './payload-scan.js';
export {
  configPathForScope,
  readJsonIfExists,
  writeJson,
  isManagedCommand,
  removeManagedHandlers,
  addManagedHandler,
  extractManagedHandlers
} from './claude-settings.js';

export { SCOPE_OPTIONS, applyManagedHandlersForEvents, upsertConfigSection } from './setup-flow.js';
export { createPlan, addChange, mergePlans, applyPlan } from './plan.js';
export { t, resolveLocale, parseLocaleFromArgv } from './i18n.js';

// Minimal prompt layer (dependency-free replacement for @clack/prompts)
export {
  CANCEL,
  isCancel,
  intro,
  outro,
  note,
  cancel,
  spinner,
  text,
  confirm,
  select,
  multiselect
} from './prompts.js';
