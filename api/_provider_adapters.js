import { fetchOpenCode, env } from './_utils.js';

const RESPONSE_IDS = [
  /^gpt-/, /^grok-/, /^muse-spark-/
];
const MESSAGE_IDS = [/^claude-/, /^qwen/];
const GEMINI_IDS = [/^gemini-/];

export function openCodeProtocol(model='') {
  const id=String(model||'').toLowerCase();
  if (GEMINI_IDS.some(r=>r.test(id))) return 'gemini';
  if (MESSAGE_IDS.some(r=>r.test(id))) return 'messages';
  if (RESPONSE_IDS.some(r=>r.test(id))) return 'responses';
  return 'chat/completions';
}

function textOf(content){
  if(typeof content==='string')return content;
  if(!Array.isArray(content))return content==null?'':JSON.stringify(content);
  return content.map(p=>p?.text||p?.content||'').filter(Boolean).join('\n');
}
function toolDefs(tools=[]){return (tools||[]).map(t=>t?.function||t).filter(t=>t?.name)}

function toResponsesPayload(p){
  const messages=Array.isArray(p.messages)?p.messages:[];
  const system=messages.filter(m=>m.role==='system').map(m=>textOf(m.content)).join('\n\n');
  const input=[];
  for(const m of messages){
    if(m.role==='system')continue;
    if(m.role==='tool') { input.push({type:'function_call_output',call_id:m.tool_call_id,output:textOf(m.content)}); continue; }
    if(m.role==='assistant'&&Array.isArray(m.tool_calls)){
      if(textOf(m.content))input.push({role:'assistant',content:[{type:'output_text',text:textOf(m.content)}]});
      for(const tc of m.tool_calls)input.push({type:'function_call',call_id:tc.id,name:tc.function?.name,arguments:tc.function?.arguments||'{}'});
      continue;
    }
    input.push({role:m.role==='assistant'?'assistant':'user',content:textOf(m.content)});
  }
  return {model:p.model,instructions:system||undefined,input,temperature:p.temperature,max_output_tokens:p.max_tokens,stream:true,tools:toolDefs(p.tools).map(t=>({type:'function',name:t.name,description:t.description,parameters:t.parameters||{type:'object',properties:{}}})),tool_choice:p.tools?.length?'auto':undefined};
}

function toAnthropicPayload(p){
  const messages=Array.isArray(p.messages)?p.messages:[],out=[];
  const system=messages.filter(m=>m.role==='system').map(m=>textOf(m.content)).join('\n\n');
  for(const m of messages){
    if(m.role==='system')continue;
    if(m.role==='tool'){
      const block={type:'tool_result',tool_use_id:m.tool_call_id,content:textOf(m.content)};
      if(out.at(-1)?.role==='user'&&Array.isArray(out.at(-1).content))out.at(-1).content.push(block);else out.push({role:'user',content:[block]});
      continue;
    }
    if(m.role==='assistant'&&Array.isArray(m.tool_calls)){
      const blocks=[];if(textOf(m.content))blocks.push({type:'text',text:textOf(m.content)});
      for(const tc of m.tool_calls)blocks.push({type:'tool_use',id:tc.id,name:tc.function?.name,input:safeParse(tc.function?.arguments)});
      out.push({role:'assistant',content:blocks});continue;
    }
    out.push({role:m.role==='assistant'?'assistant':'user',content:textOf(m.content)});
  }
  return {model:p.model,system:system||undefined,messages:out,max_tokens:p.max_tokens||8192,temperature:p.temperature,stream:true,tools:toolDefs(p.tools).map(t=>({name:t.name,description:t.description,input_schema:t.parameters||{type:'object',properties:{}}}))};
}
function safeParse(x){try{return typeof x==='string'?JSON.parse(x||'{}'):(x||{})}catch{return{}}}

function toGeminiPayload(p){
  const messages=Array.isArray(p.messages)?p.messages:[];
  const system=messages.filter(m=>m.role==='system').map(m=>textOf(m.content)).join('\n\n');
  const contents=[],callNames=new Map();
  for(const m of messages){
    if(m.role==='system')continue;
    if(m.role==='tool'){
      const callId=m.tool_call_id,name=callNames.get(callId)||'tool';
      contents.push({role:'user',parts:[{functionResponse:{name,response:{result:textOf(m.content)},id:callId}}]});continue;
    }
    const parts=[];
    if(textOf(m.content))parts.push({text:textOf(m.content)});
    for(const tc of m.tool_calls||[]){if(tc.id&&tc.function?.name)callNames.set(tc.id,tc.function.name);parts.push({functionCall:{name:tc.function?.name,args:safeParse(tc.function?.arguments),id:tc.id}})}
    contents.push({role:m.role==='assistant'?'model':'user',parts:parts.length?parts:[{text:''}]});
  }
  return {systemInstruction:system?{parts:[{text:system}]}:undefined,contents,generationConfig:{temperature:p.temperature,maxOutputTokens:p.max_tokens},tools:p.tools?.length?[{functionDeclarations:toolDefs(p.tools).map(t=>({name:t.name,description:t.description,parameters:t.parameters||{type:'object',properties:{}}}))}]:undefined};
}

async function readSSE(upstream,onEvent){
  if(!upstream.body)return;
  const reader=upstream.body.getReader(),dec=new TextDecoder();let buf='',event='';
  const emit=line=>{if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))onEvent(event,line.slice(5).trim());else if(!line.trim())event=''};
  while(true){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){let line=buf.slice(0,i);buf=buf.slice(i+1);if(line.endsWith('\r'))line=line.slice(0,-1);emit(line)}}
  buf+=dec.decode();if(buf)emit(buf);
}
function startSSE(res,protocol){res.statusCode=200;res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-AiWay-Protocol',protocol)}
function chatChunk(delta={},finish_reason=null,usage){return JSON.stringify({object:'chat.completion.chunk',choices:[{index:0,delta,finish_reason}],...(usage?{usage}: {})})}
function writeData(res,obj,event=''){if(event)res.write(`event: ${event}\n`);res.write(`data: ${typeof obj==='string'?obj:JSON.stringify(obj)}\n\n`)}
function responseFinalText(response){
  const out=[];for(const item of response?.output||[]){for(const part of item?.content||[]){const t=part?.text||part?.content;if(typeof t==='string'&&t)out.push(t)}}return out.join('');
}

export async function proxyOpenCode(payload,res){
  const protocol=openCodeProtocol(payload?.model);
  const headers={'Content-Type':'application/json','Accept':'text/event-stream'};
  if(process.env.OPENCODE_API_KEY){
    headers.Authorization=`Bearer ${process.env.OPENCODE_API_KEY}`;
    if(protocol==='messages'){headers['x-api-key']=process.env.OPENCODE_API_KEY;headers['anthropic-version']='2023-06-01'}
    if(protocol==='gemini')headers['x-goog-api-key']=process.env.OPENCODE_API_KEY;
  }
  if(protocol==='chat/completions'){
    const {response,url}=await fetchOpenCode('/chat/completions',{method:'POST',headers,body:JSON.stringify(payload),cache:'no-store'});
    return {upstream:response,url,protocol,normalized:false};
  }
  let path,body;
  if(protocol==='responses'){path='/responses';body=toResponsesPayload(payload)}
  else if(protocol==='messages'){path='/messages';body=toAnthropicPayload(payload)}
  else {path=`/models/${encodeURIComponent(payload.model)}:streamGenerateContent?alt=sse`;body=toGeminiPayload(payload)}
  const {response:upstream,url}=await fetchOpenCode(path,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'});
  if(!upstream.ok)return {upstream,url,protocol,normalized:false};
  startSSE(res,protocol);
  const toolState=new Map();let finish=null,usage=null,emittedText='';
  await readSSE(upstream,(event,raw)=>{
    if(!raw||raw==='[DONE]')return;let d;try{d=JSON.parse(raw)}catch{return}
    if(protocol==='responses'){
      if(event==='response.output_text.delta'||d.type==='response.output_text.delta'){const text=d.delta||'';if(text){emittedText+=text;writeData(res,chatChunk({content:text}))}}
      else if(event==='response.output_item.added'||d.type==='response.output_item.added'){
        const item=d.item;if(item?.type==='function_call'){const idx=toolState.size;const st={idx,id:item.call_id||item.id,name:item.name,args:''};toolState.set(item.call_id||item.id,st);if(item.id)toolState.set(item.id,st);writeData(res,chatChunk({tool_calls:[{index:idx,id:item.call_id||item.id,type:'function',function:{name:item.name||'',arguments:item.arguments||''}}]}))}
      } else if(event==='response.function_call_arguments.delta'||d.type==='response.function_call_arguments.delta'){
        const k=d.call_id||d.item_id,st=toolState.get(k);if(st&&d.delta)writeData(res,chatChunk({tool_calls:[{index:st.idx,id:st.id,type:'function',function:{arguments:d.delta}}]}))
      } else if(event==='response.output_text.done'||d.type==='response.output_text.done'){const full=d.text||'';if(full&&!emittedText){emittedText=full;writeData(res,chatChunk({content:full}))}} else if(event==='response.completed'||d.type==='response.completed'){usage=d.response?.usage||d.usage;finish='stop';const full=responseFinalText(d.response);if(full&&!emittedText){emittedText=full;writeData(res,chatChunk({content:full}))}}
    } else if(protocol==='messages'){
      if(d.type==='content_block_start'&&d.content_block?.type==='tool_use'){const b=d.content_block,idx=d.index??toolState.size;toolState.set(idx,{idx,id:b.id,name:b.name,args:''});writeData(res,chatChunk({tool_calls:[{index:idx,id:b.id,type:'function',function:{name:b.name||'',arguments:''}}]}))}
      else if(d.type==='content_block_delta'&&d.delta?.type==='text_delta'&&d.delta.text){emittedText+=d.delta.text;writeData(res,chatChunk({content:d.delta.text}))}
      else if(d.type==='content_block_delta'&&d.delta?.type==='input_json_delta'){const st=toolState.get(d.index);if(st&&d.delta.partial_json)writeData(res,chatChunk({tool_calls:[{index:st.idx,id:st.id,type:'function',function:{arguments:d.delta.partial_json}}]}))}
      else if(d.type==='message_delta'){finish=d.delta?.stop_reason||finish;usage=d.usage||usage}
    } else {
      const c=d.candidates?.[0];if(!c)return;finish=c.finishReason||finish;
      for(const part of c.content?.parts||[]){if(part.text){emittedText+=part.text;writeData(res,chatChunk({content:part.text}))}if(part.functionCall){const idx=toolState.size,id=part.functionCall.id||`g_${idx}`;writeData(res,chatChunk({tool_calls:[{index:idx,id,type:'function',function:{name:part.functionCall.name,arguments:JSON.stringify(part.functionCall.args||{})}}]}))}}
      usage=d.usageMetadata||usage;
    }
  });
  writeData(res,chatChunk({},finish||'stop',usage));writeData(res,'[DONE]');res.end();
  return {upstream:null,url,protocol,normalized:true};
}

function hermesBase(){const u=new URL(env('HERMES_BASE_URL'));if(!['http:','https:'].includes(u.protocol))throw new Error('HERMES_BASE_URL must use http or https');return u.toString().replace(/\/+$/,'').replace(/\/v1$/,'')}
function hermesHeaders(){return {'Content-Type':'application/json','Accept':'application/json','Authorization':`Bearer ${env('HERMES_API_KEY')}`}}
export async function hermesCapabilities(){const base=hermesBase();const r=await fetch(`${base}/v1/capabilities`,{headers:hermesHeaders(),cache:'no-store'});if(!r.ok)return null;return await r.json()}
export async function proxyHermesRun({payload,sessionId},res){
  const base=hermesBase(),headers=hermesHeaders(),encoded=String(payload.model||'');let model=encoded,provider;
  if(encoded.includes('::')){[provider,...model]=encoded.split('::');model=model.join('::')}
  const msgs=payload.messages||[],instructions=msgs.filter(m=>m.role==='system').map(m=>textOf(m.content)).join('\n\n');
  const history=msgs.filter(m=>m.role!=='system').slice(0,-1).map(m=>({role:m.role,content:textOf(m.content)}));const input=textOf(msgs.at(-1)?.content)||'Continue';
  const create=await fetch(`${base}/v1/runs`,{method:'POST',headers,body:JSON.stringify({input,instructions,conversation_history:history,session_id:sessionId||undefined,model,provider,model_options:{}})});
  const cd=await create.json().catch(()=>({}));if(!create.ok)throw new Error(cd?.error?.message||cd?.error||`Hermes run HTTP ${create.status}`);const runId=cd.run_id;if(!runId)throw new Error('Hermes did not return run_id');
  res.setHeader('X-AiWay-Hermes-Run-Id',runId);startSSE(res,'hermes-runs');
  let finished=false, emittedText=false;
  res.on?.('close',()=>{ if(!finished) fetch(`${base}/v1/runs/${encodeURIComponent(runId)}/stop`,{method:'POST',headers}).catch(()=>{}); });
  const events=await fetch(`${base}/v1/runs/${encodeURIComponent(runId)}/events`,{headers:{Authorization:`Bearer ${env('HERMES_API_KEY')}`,Accept:'text/event-stream'}});
  if(!events.ok)throw new Error(`Hermes run events HTTP ${events.status}`);
  await readSSE(events,(event,raw)=>{if(!raw)return;let d;try{d=JSON.parse(raw)}catch{d={message:raw}};const type=event||d.type||d.event||'';
    const delta=d.delta||d.text_delta||d.text;if(/assistant.*delta|token.*delta|response.*delta/i.test(type)&&typeof delta==='string'){emittedText=true;writeData(res,chatChunk({content:delta}))}
    else if(/tool|subagent|approval|run\./i.test(type))writeData(res,{object:'hermes.activity',type,detail:d},'hermes.activity');
  });
  const status=await fetch(`${base}/v1/runs/${encodeURIComponent(runId)}`,{headers:{Authorization:`Bearer ${env('HERMES_API_KEY')}`}});const sd=await status.json().catch(()=>({}));
  if(sd.output&&!emittedText)writeData(res,chatChunk({content:String(sd.output)}));writeData(res,chatChunk({},sd.status==='cancelled'?'cancelled':'stop',sd.usage));writeData(res,'[DONE]');finished=true;res.end();
}
