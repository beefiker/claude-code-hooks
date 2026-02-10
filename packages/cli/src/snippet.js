import path from 'node:path';

// This file generates a snippet the user can paste into ~/.claude/settings.json.
// We keep it simple: a "hooks" object with managed hook handlers.

export function buildSettingsSnippet({ projectDir, selected, packagePlans }) {
  const hooks = {};

  for (const key of selected) {
    const plan = packagePlans[key];
    if (!plan) continue;

    // plan.snippetHooks is: { [eventName]: [ { matcher, hooks:[{type,command,async,timeout}]} ] }
    for (const [eventName, groups] of Object.entries(plan.snippetHooks || {})) {
      if (!Array.isArray(groups) || groups.length === 0) continue;
      const existing = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
      hooks[eventName] = [...existing, ...groups];
    }
  }

  // Include a comment-like pointer to project config path (JSON doesn't support comments, so we use a metadata key).
  const cfgPath = path.join(projectDir, 'claude-hooks.config.json');

  return {
    "__generated_by": "@claude-code-hooks/cli",
    "__project_config": cfgPath,
    hooks
  };
}
