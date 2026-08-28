/**
 * Tool / Skill / settings registry integrity guard.
 *
 * This test protects wiring that silently degrades the agent instead of throwing:
 * a tool can exist in `nativeDefs` with a full JSON schema and a working executor,
 * yet never be offered to the model because it has no default permission entry.
 * Such tools look implemented in review but are dead at runtime.
 *
 * Guarded invariants:
 *  1. Every native tool has a default permission (otherwise it is never routed).
 *  2. Every default permission maps to a real native tool (no phantom entries).
 *  3. Every native tool has an executor branch and a machine-valid schema.
 *  4. Every settings key exposed as a UI control is actually read by the runtime
 *     (no placebo switches that persist but change nothing).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
// Parse nativeDefs tool names
// ---------------------------------------------------------------------------
const defsStart = app.indexOf('const nativeDefs={');
assert(defsStart > -1, 'nativeDefs registry not found in assets/app.js');
const defsBlock = app.slice(defsStart, app.indexOf('\n};', defsStart));
const nativeTools = [...defsBlock.matchAll(/^\s([a-z_][a-z0-9_]*):\{description/gm)].map(m => m[1]);
assert(nativeTools.length >= 30, `expected the full native tool surface, saw ${nativeTools.length}`);

// ---------------------------------------------------------------------------
// Parse default toolPermissions
// ---------------------------------------------------------------------------
const permBlock = app.match(/toolPermissions:\{([^}]*)\}/);
assert(permBlock, 'default toolPermissions map not found');
const permissions = [...permBlock[1].matchAll(/([a-z_][a-z0-9_]*):"(auto|ask|off)"/g)]
  .map(m => ({ name: m[1], value: m[2] }));
const permNames = new Set(permissions.map(p => p.name));

// 1) Every native tool must have a default permission, or the model never sees it.
for (const tool of nativeTools) {
  assert(
    permNames.has(tool),
    `native tool "${tool}" has no default permission entry, so it can never be routed to the model`
  );
}

// 2) No phantom permission entries for tools that do not exist.
for (const { name } of permissions) {
  assert(
    nativeTools.includes(name),
    `toolPermissions declares "${name}" but no such native tool exists in nativeDefs`
  );
}

// `tool_search` is a meta-tool resolved inline in the agent loop (it expands the
// deferred catalog) rather than through the native executor switch.
const META_TOOLS = new Set(['tool_search']);

// 3) Each native tool needs an executor branch and a valid object schema.
for (const tool of nativeTools) {
  if (META_TOOLS.has(tool)) {
    assert(
      app.includes(`tool.name==="${tool}"`),
      `meta tool "${tool}" must be handled inline in the agent loop`
    );
  } else {
    assert(
      app.includes(`case"${tool}"`) || app.includes(`case "${tool}"`),
      `native tool "${tool}" has no executor branch`
    );
  }
  const entry = defsBlock.match(new RegExp(`\\s${tool}:\\{description:"([^"]|\\\\")*"`));
  assert(entry, `native tool "${tool}" must document a description for model-owned tool choice`);
  const schemaAt = defsBlock.indexOf(`${tool}:{description`);
  const schemaSlice = defsBlock.slice(schemaAt, schemaAt + 2600);
  assert(
    /parameters:\{type:"object"/.test(schemaSlice),
    `native tool "${tool}" must declare an object JSON schema`
  );
}

// ---------------------------------------------------------------------------
// 4) No placebo settings: a persisted UI control must be read somewhere.
// ---------------------------------------------------------------------------
const settingsBlock = app.match(/settings:\{([\s\S]*?)\}, toolPermissions/);
assert(settingsBlock, 'default settings map not found');
const settingKeys = [...settingsBlock[1].matchAll(/([a-zA-Z_][a-zA-Z0-9_]*):/g)].map(m => m[1]);

// Keys that are intentionally state-only (not user-facing switches).
const INTERNAL_ONLY = new Set(['activeProjectId']);

// Known inert switches: they render a control and persist a value, but no runtime
// code reads them yet. Documented in docs/known-issues.md. This list is a debt
// ceiling, not an approval: it must only ever shrink. Wiring one of these, or
// removing its control, should also remove it from this list.
const KNOWN_INERT_SETTINGS = [
  'agentInspector',
  'contextMode',
  'mcpRouter',
  'skillRouter',
  'workspaceAwareness'
];

const placebo = [];
for (const key of settingKeys) {
  if (INTERNAL_ONLY.has(key)) continue;
  if (!html.includes(`id="${key}"`)) continue; // not exposed as a control
  // A real switch is read via state.settings.<key> outside of the defaults literal.
  const reads = (app.match(new RegExp(`state\\.settings\\.${key}\\b`, 'g')) || []).length;
  if (reads === 0) placebo.push(key);
}

const newPlacebo = placebo.filter(k => !KNOWN_INERT_SETTINGS.includes(k));
assert.deepEqual(
  newPlacebo,
  [],
  `new inert setting(s) added: ${newPlacebo.join(', ')} — a persisted UI control must be read by the runtime`
);

const fixed = KNOWN_INERT_SETTINGS.filter(k => !placebo.includes(k));
assert.deepEqual(
  fixed,
  [],
  `these settings are no longer inert: ${fixed.join(', ')} — remove them from KNOWN_INERT_SETTINGS`
);

console.log(
  `tool registry integrity ok • ${nativeTools.length} native tools • ${permissions.length} permissions • ${settingKeys.length} settings`
);
