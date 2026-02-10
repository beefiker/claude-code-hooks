import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {{ kind:'writeFile', path:string, content:string }} WriteFileChange
 * @typedef {{ kind:'patchJson', path:string, patch:any }} PatchJsonChange
 * @typedef {WriteFileChange | PatchJsonChange} PlanChange
 * @typedef {{ title:string, changes: PlanChange[] }} Plan
 */

export function createPlan(title) {
  return { title, changes: [] };
}

export function addChange(plan, change) {
  plan.changes.push(change);
  return plan;
}

export function mergePlans(title, plans) {
  const out = createPlan(title);
  for (const p of plans || []) {
    for (const c of p?.changes || []) out.changes.push(c);
  }
  return out;
}

function deepMerge(base, patch) {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(patch)) return patch.slice();
  if (typeof patch !== 'object') return patch;

  const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = deepMerge(out[k], v);
  }
  return out;
}

async function atomicWriteFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp.' + String(Date.now());
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, filePath);
}

async function readJsonOrEmpty(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return {};
    throw err;
  }
}

export async function applyPlan(plan) {
  for (const c of plan?.changes || []) {
    if (c.kind === 'writeFile') {
      await atomicWriteFile(c.path, c.content);
      continue;
    }
    if (c.kind === 'patchJson') {
      const obj = await readJsonOrEmpty(c.path);
      const next = deepMerge(obj, c.patch);
      await atomicWriteFile(c.path, JSON.stringify(next, null, 2) + '\n');
      continue;
    }
    throw new Error(`Unknown plan change kind: ${c.kind}`);
  }
}
