import fs from 'node:fs/promises';
import path from 'node:path';

export const CONFIG_FILENAME = 'claude-code-hooks.config.json';

export function configFilePath(cwd) {
  return path.join(cwd || process.cwd(), CONFIG_FILENAME);
}

export async function readProjectConfig(cwd) {
  const filePath = configFilePath(cwd);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return { ok: true, value: JSON.parse(raw), exists: true };
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      return { ok: true, value: {}, exists: false };
    }
    return { ok: false, error: err };
  }
}

export async function writeProjectConfig(config, cwd) {
  const filePath = configFilePath(cwd);
  await fs.writeFile(filePath, JSON.stringify(config, null, 2) + '\n');
}

export function compileRegexList(patterns) {
  const out = [];
  for (const p of patterns || []) {
    try {
      out.push(new RegExp(p));
    } catch {
      // ignore invalid
    }
  }
  return out;
}
