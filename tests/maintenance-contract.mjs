/**
 * Repository maintenance-contract guards.
 * These checks intentionally protect architecture that is easy for future humans/AIs to break.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const apiDir = 'api';
const apiFiles = fs.readdirSync(apiDir).filter(name => name.endsWith('.js')).sort();

assert.ok(apiFiles.length <= 12, `Vercel Serverless Function budget exceeded: ${apiFiles.length}/12`);

for (const file of apiFiles) {
  const source = fs.readFileSync(path.join(apiDir, file), 'utf8');
  assert.match(source, /export\s+default\s+/, `${apiDir}/${file} must be a real route handler`);
}

for (const required of [
  'AGENTS.md',
  'docs/AI-DEVELOPER-CONTRACT.md',
  'docs/development-standards.md',
  'lib/utils.js',
  'lib/provider-adapters.js',
  'lib/vercel-api.js'
]) {
  assert.ok(fs.existsSync(required), `required maintenance/architecture file missing: ${required}`);
}

const contract = fs.readFileSync('docs/AI-DEVELOPER-CONTRACT.md', 'utf8');
assert.match(contract, /12 top-level JavaScript files in `\/api`/i, 'API budget rule missing from developer contract');
assert.match(contract, /Preserve working features/i, 'feature-preservation rule missing from developer contract');
assert.match(contract, /Vercel compatibility requirements/i, 'Vercel compatibility rule missing from developer contract');

const agents = fs.readFileSync('AGENTS.md', 'utf8');
assert.match(agents, /Never exceed 12 top-level JavaScript files in `\/api`/i, 'AGENTS.md must state API budget');
assert.match(agents, /npm test/i, 'AGENTS.md must require verification');

console.log(`maintenance contract ok • api files ${apiFiles.length}/12`);
