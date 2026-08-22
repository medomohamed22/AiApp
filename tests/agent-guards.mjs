import fs from 'node:fs';
const app=fs.readFileSync(new URL('../assets/app.js', import.meta.url),'utf8');
const adapter=fs.readFileSync(new URL('../api/_provider_adapters.js', import.meta.url),'utf8');
const required=[
  ['skill alias normalization', /function normalizeSkillName/],
  ['hallucinated skill resolver', /async function resolveAgentTool/],
  ['final answer recovery', /async function finalizeOpenAIAnswer/],
  ['Gemini final answer recovery', /async function finalizeGeminiAnswer/],
  ['max-round finalization', /reason:"max_rounds"/],
  ['tool result errors surfaced', /if\(result\?\.error\).*addEvent/s],
];
for(const [name,re] of required) if(!re.test(app)) throw new Error(`missing guard: ${name}`);
if(app.includes('تمت المعالجة دون رد نصي.')) throw new Error('legacy silent-success fallback still exists');
if(!/callNames=new Map\(\)/.test(adapter)) throw new Error('Gemini tool result name mapping missing');
if(!/responseFinalText/.test(adapter)) throw new Error('Responses final text fallback missing');
console.log('agent recovery guards ok');
