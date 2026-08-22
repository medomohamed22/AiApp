import fs from 'node:fs';
import assert from 'node:assert/strict';
import agentHandler from '../api/agent.js';

const app = fs.readFileSync('assets/app.js','utf8');
const html = fs.readFileSync('index.html','utf8');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));

for (const marker of [
  'browser_navigate','browser_follow','browser_extract','virtual_terminal','code_execute',
  'todo_plan','delegate_task','agent_evaluate','session_search','CORE_AGENT_SKILLS',
  'orchestration:"smart"','subagentsEnabled:true','verifierEnabled:true','idbPut("evals"'
]) assert.ok(app.includes(marker), `missing agent feature marker: ${marker}`);

for (const id of ['orchestration','verifierEnabled','subagentsEnabled','evalsList'])
  assert.ok(html.includes(`id="${id}"`), `missing UI control ${id}`);

const apiFiles = fs.readdirSync('api').filter(x=>x.endsWith('.js'));
assert.ok(apiFiles.length <= 12, `Vercel api file budget exceeded: ${apiFiles.length}`);
assert.ok(apiFiles.includes('agent.js'), 'agent gateway missing');
const vercel = fs.readFileSync('vercel.json','utf8');
assert.ok(vercel.includes("worker-src 'self' blob:"), 'CSP must allow isolated blob workers for code_execute');

function mockRes(){
  return {statusCode:200,headers:{},writableEnded:false,destroyed:false,setHeader(k,v){this.headers[k]=v},end(body=''){this.body=body;this.writableEnded=true},once(){}};
}
const req={method:'POST',headers:{},body:{action:'browser',url:'http://127.0.0.1:3000/private'},once(){},socket:{remoteAddress:'203.0.113.9'}};
const res=mockRes();
await agentHandler(req,res);
assert.equal(res.statusCode,400);
assert.match(String(res.body),/Private IP addresses are blocked|Private hosts are blocked/);

assert.ok(pkg.scripts['test:platform'], 'test:platform script missing');
console.log(`agent platform guards ok • api files ${apiFiles.length}/12`);
