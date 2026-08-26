/**
 * Regression guard for AiWay.
 * Keep this test focused on externally important behavior/invariants, not implementation trivia.
 * When intentionally changing a guarded behavior, update the implementation and this test together.
 */

import fs from 'node:fs';
const src=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const declared=new Set();
for(const m of src.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g))declared.add(m[1]);
for(const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g))declared.add(m[1]);
const required=['providerLabel','reasoningLevel','renderReasoning','renderSettings','renderToggles','renderProjects','renderChats','renderMessages','renderSkills','renderSkillLearning','renderTools','renderMemory','renderArtifacts','renderTimeline','syncComposerState','updateModelLimitHint'];
const missing=required.filter(x=>!declared.has(x));
if(missing.length)throw new Error(`Missing client runtime declarations: ${missing.join(', ')}`);
const renderAll=src.match(/async function renderAll\(\)\{([^}]*)\}/)?.[1]||'';
for(const name of ['renderProjects','renderChats','renderMessages','renderSkills','renderSkillLearning','renderTools','renderMemory','renderArtifacts','renderTimeline','renderSettings','renderToggles']){
  if(!renderAll.includes(`${name}(`))throw new Error(`renderAll no longer invokes ${name}`);
}
console.log('client runtime integrity ok');
