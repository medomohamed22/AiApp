import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../assets/delegate.js';
const engine=globalThis.AiWayDelegate;
const config={rounds:2,moderator:1,members:[
 {provider:'opencode',model:'model-a',role:'planner',task:'plan'},
 {provider:'gemini',model:'model-b',role:'reviewer',task:'review'}
]};
const calls=[],events=[];
const result=await engine.run({config,context:'user task',signal:new AbortController().signal,onEvent:e=>events.push(e),call:async args=>{
 calls.push(args);await args.onDelta('stream '+calls.length);return 'reply '+calls.length;
}});
assert.equal(calls.length,5);
assert.deepEqual(calls.map(c=>c.member.model),['model-a','model-b','model-a','model-b','model-b']);
assert.equal(calls[0].discussion,'[]');
assert.match(calls[1].discussion,/reply 1/);
assert.match(calls[2].discussion,/reply 2/);
assert.equal(calls[4].synthesis,true);
assert.equal(result.answer,'reply 5');
assert.equal(result.entries.length,5);
assert(events.some(e=>e.text==='stream 1'));
assert.throws(()=>engine.validate({...config,rounds:4}));
assert.throws(()=>engine.validate({...config,moderator:9}));
assert.throws(()=>engine.validate({...config,members:[config.members[0]]}));
assert.throws(()=>engine.validate({...config,members:[config.members[0],{...config.members[1],provider:'evil'}]}));
assert.throws(()=>engine.validate({...config,members:[config.members[0],{...config.members[1],model:''}]}));
const controller=new AbortController();let count=0;
await assert.rejects(()=>engine.run({config,signal:controller.signal,call:async()=>{count++;controller.abort();return 'partial'}}),{name:'AbortError'});
assert.equal(count,1,'cancellation must prevent further provider requests');
let failed=[];count=0;
await assert.rejects(()=>engine.run({config,onEvent:e=>failed.push(e),call:async()=>{count++;if(count===2)throw new Error('provider down');return 'kept response'}}),/provider down/);
assert.equal(count,2,'provider failure must not fabricate a synthesis');
assert(failed.some(e=>e.status==='done'&&e.text==='kept response'));
assert(failed.some(e=>e.status==='failed'));
await assert.rejects(()=>engine.run({config,call:async()=>''}),/فارغ/);

// Exercise the app adapter, per-chat persistence and actual provider/model selection.
const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const adapter=app.slice(app.indexOf('async function runDelegateCouncil('),app.indexOf("$('#delegateConfigure')"));
let stored={id:'chat-1',messages:[]};const providerCalls=[];
const sandbox={AiWayDelegate:engine,controller:new AbortController(),runtimeModelOverride:'original',delegateRunningChatId:null,
 uid:()=> 'run-1',selectContextMessages:()=>[{role:'user',text:'original question'}],
 idbGet:async()=>structuredClone(stored),idbPut:async(_,c)=>{stored=structuredClone(c)},
 structuredClone,Date,console,syncDelegatePanel:()=>{},renderDelegateRun:()=>{},pushRunActivity:()=>{},updateStream:()=>{},
 geminiContentsFromChat:x=>x,openRouterMessagesFromChat:x=>x};
for(const [fn,provider] of [['geminiTurn','gemini'],['openAICompatibleTurn','compatible']])sandbox[fn]=async args=>{providerCalls.push({provider:args.provider||provider,model:sandbox.runtimeModelOverride,tools:args.tools,native:args.nativeRun});args.onDelta('partial');return {text:'adapter reply',toolCalls:[]}};
vm.createContext(sandbox);vm.runInContext(adapter+';globalThis.execute=runDelegateCouncil;',sandbox);
const answer=await sandbox.execute({id:'chat-1',delegateConfig:config},'question');
assert.equal(answer,'adapter reply');assert.equal(stored.delegateRun.status,'done');assert.equal(stored.delegateRun.entries.length,5);
assert.equal(providerCalls[0].model,'model-a');assert.equal(providerCalls[1].provider,'gemini');
assert(providerCalls.every(c=>c.tools.length===0));assert.equal(sandbox.runtimeModelOverride,'original');
assert.match(app,/if\(mode==="delegate"\)return await runDelegateCouncil/);
console.log('delegate council: sequencing, cross-provider routing, review context, synthesis, streaming, validation, cancellation, failures and persistence passed');
