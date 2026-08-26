/**
 * Regression guard for AiWay.
 * Keep this test focused on externally important behavior/invariants, not implementation trivia.
 * When intentionally changing a guarded behavior, update the implementation and this test together.
 */

import fs from 'node:fs';
import assert from 'node:assert/strict';
const app=fs.readFileSync('assets/app.js','utf8');
const api=fs.readFileSync('api/agent.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
for(const x of ['trajectories','skillproposals','recordLearningTrajectory','proposeSkillFromTrajectory','distillSkillProposal','source: aiway-self-learning','data-acceptproposal','skill_learn']) assert.ok(app.includes(x),`missing self-learning marker ${x}`);
for(const x of ['selfLearningSkills','skillProposals','analyzeLearningBtn','Persistent Vercel Sandbox','sandboxSyncBtn','sandboxDeleteBtn']) assert.ok(html.includes(x),`missing UI marker ${x}`);
for(const x of ['Sandbox.getOrCreate','persistent: true','networkPolicy','deny-all','readFileToBuffer','writeFiles','/workspace','op === \'exec\'','op === \'sync\'']) assert.ok(api.includes(x),`missing real sandbox marker ${x}`);
assert.equal(pkg.dependencies?.['@vercel/sandbox'],'^3.1.0');
assert.ok(app.includes('sandbox_exec:"ask"'),'real command execution must require permission by default');
assert.ok(app.includes('sandbox_sync:"ask"'),'project sync must require permission by default');
assert.ok(app.includes('related.length<1'),'automatic learning must require repeated evidence');
assert.ok(app.includes('status:"pending"'),'learned skill must enter review queue');
const apiFiles=fs.readdirSync('api').filter(x=>x.endsWith('.js'));
assert.ok(apiFiles.length<=12,`api file budget exceeded: ${apiFiles.length}`);
console.log(`self-learning + persistent sandbox guards ok • api files ${apiFiles.length}/12`);
