/**
 * Regression guard for AiWay.
 * Keep this test focused on externally important behavior/invariants, not implementation trivia.
 * When intentionally changing a guarded behavior, update the implementation and this test together.
 */

import fs from 'node:fs';
const js=fs.readFileSync('assets/app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/app.css','utf8');
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};
for(const token of ['routeSkills(','buildSkillChain(','classifyMcpCapability(','mcpRouteScore(','hybridRoutePlan(','nativeToolRouteScore(','consolidateMemories(','workspaceSnapshot(','delegateTask(','recordToolStat(','inspectorSnapshot(']) must(js.includes(token),`missing ${token}`);
must(js.includes('Promise.all(batch.map'), 'subagents are not parallel inside batches');
must(js.includes('slice(0,8).filter'), 'delegate_task max is not 8');
must(js.includes('start+=4'), 'delegate_task batch size guard missing');
must(js.includes('toolstats')&&js.includes('workspaces'),'new local stores missing');
must(html.includes('Agent Intelligence 2026')&&html.includes('agentInspector'),'intelligence UI missing');
must(html.includes('id="consolidateMemoryBtn"'),'memory consolidation control missing');
must(css.includes('.inspector-grid')&&css.includes('.intelligence-grid'),'intelligence styling missing');
const apiFiles=fs.readdirSync('api').filter(x=>x.endsWith('.js'));
must(js.includes('const budget=directAnswer?0:complexity>=5?6:complexity>=3?4:2'),'adaptive tool budget missing');
must(js.includes('MODEL-OWNED TOOL ROUTING (OpenAI-style)')&&js.includes('tool_search'),'lazy model-owned router guards missing');
must(apiFiles.length<=12,`api files ${apiFiles.length}/12`);
console.log(`agent intelligence 10/10 guards ok • api files ${apiFiles.length}/12`);
