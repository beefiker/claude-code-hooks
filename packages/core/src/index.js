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
