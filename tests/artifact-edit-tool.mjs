/**
 * Functional guard for the surgical artifact edit tool.
 *
 * `artifact_edit` exists so the model can change a few lines of a large file
 * without resending the whole thing. That only helps if the matching rules are
 * strict: a silent wrong-match or a silent no-op would corrupt user code.
 *
 * These cases are executed against the real implementation, extracted from
 * assets/app.js with minimal stubs for IndexedDB and rendering.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const app = fs.readFileSync(path.join(process.cwd(), 'assets/app.js'), 'utf8');

// Extract the three implementation functions under test.
const grab = name => {
  const start = app.indexOf(`async function ${name}(`);
  assert(start > -1, `${name} not found in assets/app.js`);
  const end = app.indexOf('\n}\n', start);
  assert(end > -1, `could not bound ${name}`);
  return app.slice(start, end + 2);
};

const source = [grab('findProjectArtifact'), grab('artifactEdit'), grab('artifactDelete')].join('\n');

// Minimal environment: one in-memory artifact store, no DOM.
const store = new Map();
const state = { settings: { activeProjectId: 'p1' } };
const idbAll = async () => [...store.values()];
const idbDelete = async (_s, id) => { store.delete(id); };
const renderArtifacts = async () => {};
const saveArtifactRecord = async input => {
  const old = store.get(input.id) || {};
  const obj = { ...old, ...input, projectId: 'p1', content: String(input.content || '') };
  store.set(obj.id, obj);
  return obj;
};

const factory = new Function(
  'state', 'idbAll', 'idbDelete', 'renderArtifacts', 'saveArtifactRecord',
  `${source}\nreturn { artifactEdit, artifactDelete };`
);
const { artifactEdit, artifactDelete } = factory(state, idbAll, idbDelete, renderArtifacts, saveArtifactRecord);

const seed = content => {
  store.clear();
  store.set('a1', { id: 'a1', projectId: 'p1', name: 'app.js', language: 'javascript', content });
};

// 1) A unique match is applied and only the matched text changes.
seed('const a = 1;\nconst b = 2;\nconst c = 3;\n');
let out = await artifactEdit({ name: 'app.js', oldText: 'const b = 2;', newText: 'const b = 99;' });
assert.equal(out.ok, true);
assert.equal(out.changed, true);
assert.equal(store.get('a1').content, 'const a = 1;\nconst b = 99;\nconst c = 3;\n');

// 2) An ambiguous match is REFUSED rather than silently editing the first hit.
seed('x();\nx();\n');
out = await artifactEdit({ name: 'app.js', oldText: 'x();', newText: 'y();' });
assert.equal(out.ok, false, 'ambiguous edit must be refused');
assert.match(out.error, /matched 2 times/);
assert.equal(store.get('a1').content, 'x();\nx();\n', 'file must be untouched after a refused edit');

// 3) replaceAll opts in explicitly.
out = await artifactEdit({ name: 'app.js', oldText: 'x();', newText: 'y();', replaceAll: true });
assert.equal(out.ok, true);
assert.equal(out.replacements, 2);
assert.equal(store.get('a1').content, 'y();\ny();\n');

// 4) A missing match is an actionable error, not a crash or an empty write.
seed('hello\n');
out = await artifactEdit({ name: 'app.js', oldText: 'nope', newText: 'x' });
assert.equal(out.ok, false);
assert.match(out.error, /not found/i);
assert.equal(store.get('a1').content, 'hello\n');

// 5) Empty oldText is rejected (would otherwise be an ambiguous whole-file write).
out = await artifactEdit({ name: 'app.js', oldText: '', newText: 'x' });
assert.equal(out.ok, false);
assert.match(out.error, /must not be empty/i);

// 6) Unknown artifact name reports exactly that.
out = await artifactEdit({ name: 'missing.js', oldText: 'a', newText: 'b' });
assert.equal(out.ok, false);
assert.match(out.error, /not found/i);

// 7) Deleting text via an empty newText works.
seed('keep\nremove me\nkeep\n');
out = await artifactEdit({ name: 'app.js', oldText: 'remove me\n', newText: '' });
assert.equal(out.ok, true);
assert.equal(store.get('a1').content, 'keep\nkeep\n');

// 8) Delete removes the record and reports the name.
seed('data');
out = await artifactDelete({ name: 'app.js' });
assert.equal(out.ok, true);
assert.equal(out.deleted, true);
assert.equal(store.size, 0);

// 9) Deleting a nonexistent artifact fails cleanly.
out = await artifactDelete({ name: 'ghost.js' });
assert.equal(out.ok, false);

// 10) Both tools must be permission-gated (never silently auto-run).
const perms = app.match(/toolPermissions:\{([^}]*)\}/)[1];
assert.match(perms, /artifact_edit:"ask"/, 'artifact_edit must default to ask');
assert.match(perms, /artifact_delete:"ask"/, 'artifact_delete must default to ask');


// 11) CRLF/LF drift is recovered safely without another model round.
seed('function x() {\r\n  return 1;\r\n}\r\n');
out = await artifactEdit({ name: 'app.js', oldText: 'function x() {\n  return 1;\n}', newText: 'function x() {\n  return 2;\n}' });
assert.equal(out.ok, true);
assert.equal(out.changed, true);
assert.equal(out.verified, true);
assert.equal(out.recoveredEdits, 1);
assert.match(store.get('a1').content, /return 2/);

// 12) Unique whitespace/indentation drift is recovered safely.
seed('if (ready) {\n    doThing();\n}\n');
out = await artifactEdit({ name: 'app.js', oldText: 'if (ready) {\n  doThing();\n}', newText: 'if (ready) {\n  doOther();\n}' });
assert.equal(out.ok, true);
assert.equal(out.changed, true);
assert.equal(out.details[0].mode, 'whitespace-normalized');

// 13) If the requested replacement is already present, it is a verified idempotent success.
seed('const mode = "fixed";\n');
out = await artifactEdit({ name: 'app.js', oldText: 'const mode = "broken";', newText: 'const mode = "fixed";' });
assert.equal(out.ok, true);
assert.equal(out.changed, false);
assert.equal(out.alreadyApplied, true);
assert.equal(out.reason, 'already_applied');

// 14) Multiple edits are persisted atomically in one tool call.
seed('const a = 1;\nconst b = 2;\nconst c = 3;\n');
out = await artifactEdit({ name: 'app.js', edits: [
  { oldText: 'const a = 1;', newText: 'const a = 10;' },
  { oldText: 'const c = 3;', newText: 'const c = 30;' }
] });
assert.equal(out.ok, true);
assert.equal(out.changed, true);
assert.equal(out.editCount, 2);
assert.equal(out.replacements, 2);
assert.equal(store.get('a1').content, 'const a = 10;\nconst b = 2;\nconst c = 30;\n');

// 15) A failed later edit rolls the whole batch back (no partial save).
seed('one\ntwo\nthree\n');
out = await artifactEdit({ name: 'app.js', edits: [
  { oldText: 'one', newText: 'ONE' },
  { oldText: 'missing', newText: 'MISSING' }
] });
assert.equal(out.ok, false);
assert.equal(out.reason, 'target_not_found');
assert.equal(store.get('a1').content, 'one\ntwo\nthree\n');

console.log('artifact edit/delete tool guards ok • 15 cases');
