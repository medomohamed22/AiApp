/**
 * Regression guard for AiWay.
 * Keep this test focused on externally important behavior/invariants, not implementation trivia.
 * When intentionally changing a guarded behavior, update the implementation and this test together.
 */

import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('assets/app.js','utf8');

if (/id="memoryToggle"/.test(html)) throw new Error('composer memory toggle still exists');
if (!js.includes('state.settings.memoryEnabled=true')) throw new Error('memory is not forced on during state load');
for (const rule of ['state.toolPermissions.memory_search="auto"','state.toolPermissions.session_search="auto"','state.toolPermissions.memory_save="auto"']) {
  if (!js.includes(rule)) throw new Error(`missing background memory rule: ${rule}`);
}
if (!js.includes("add(name==='memory_search'&&s.memorySearch,100)")) throw new Error('memory_search is not score-routed');
if (!js.includes("add(name==='session_search'&&s.sessionSearch,100)")) throw new Error('session_search is not score-routed');
if (!js.includes("add(name==='memory_save'&&s.memorySave,100)")) throw new Error('memory_save is not score-routed');
if (!js.includes('aiway_reasoning_level:reasoningLevel()')) throw new Error('reasoning level is not read per request');
if (!js.includes('state.settings.reasoningLevel=next')) throw new Error('reasoning selector does not update live settings');
if (!js.includes('يطبق من الرسالة التالية في نفس المحادثة')) throw new Error('same-chat reasoning feedback missing');
console.log('always-on memory context + intent-routed memory tools + live same-chat reasoning guards ok');
