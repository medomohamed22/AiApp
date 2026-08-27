/**
 * Regression guard for AiWay.
 * Keep this test focused on externally important behavior/invariants, not implementation trivia.
 * When intentionally changing a guarded behavior, update the implementation and this test together.
 */

import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
function extract(name){
  const start=js.indexOf(`function ${name}(`); if(start<0) throw new Error(`missing ${name}`);
  const brace=js.indexOf('{',start); let depth=0, quote='', esc=false;
  for(let i=brace;i<js.length;i++){
    const c=js[i];
    if(quote){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===quote)quote='';continue}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue}
    if(c==='{')depth++; else if(c==='}'&&--depth===0)return js.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}
const ctx={};vm.createContext(ctx);vm.runInContext(`${extract('detectSearchIntent')};this.f=detectSearchIntent`,ctx);const f=ctx.f;
const yes=[
 'ابحث عن أحدث أخبار OpenAI',
 'دور على سعر الذهب دلوقتي',
 'مين رئيس فرنسا حاليا؟',
 'هاتلي مصادر عن WebGPU',
 'ما الجديد عن React؟',
 'what is the latest version of Next.js?',
 'look up current weather in Cairo'
];
for(const q of yes)if(!f(q).force)throw new Error(`should force web: ${q}`);
const no=['اعمل صفحة جديدة HTML و CSS','اكتب كود جديد لزر جميل','اشرح React hooks','لخص النص ده'];
for(const q of no)if(f(q).force)throw new Error(`false positive web force: ${q}`);

const mentions=[
 'هل عندك أداة البحث؟',
 'هل web_search متاحة؟',
 'can you use the search tool?'
];
for(const q of mentions){const r=f(q);if(!r.suggested)throw new Error(`search tool mention should expose web tool: ${q}`);if(r.force)throw new Error(`capability-only search mention should not auto-search: ${q}`)}
if(!f('استخدم أداة البحث عشان تجيب آخر أخبار OpenAI').force)throw new Error('explicit Arabic search-tool use should force web');

if(!js.includes('MODEL-OWNED TOOL ROUTING (OpenAI-style)'))throw new Error('model-owned tool routing contract missing');
if(!js.includes('Use web_search directly whenever the answer depends on live/current/external facts'))throw new Error('current-information web routing instruction missing');
if(!js.includes('for(const name of ["web_search","tool_search"])'))throw new Error('core web/tool discovery catalog missing');
if(js.includes('name==="web_search"&&!state.settings.webEnabled'))throw new Error('legacy hard webEnabled gate still present');
console.log('smart search router guards ok');
