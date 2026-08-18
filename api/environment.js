import {allowMethod,bodyJson,env,json} from './_utils.js';

const VERCEL_API='https://api.vercel.com';
function vercelHeaders(token){return{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}}
function teamQuery(teamId,extra={}){const p=new URLSearchParams();if(teamId)p.set('teamId',teamId);for(const [k,v] of Object.entries(extra))if(v!==undefined&&v!==null)p.set(k,String(v));const q=p.toString();return q?`?${q}`:''}
async function apiFetch(url,opt,label){const r=await fetch(url,opt);const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text.slice(0,500)}}if(!r.ok){const e=new Error(data?.error?.message||data?.message||`${label} HTTP ${r.status}`);e.status=r.status;e.data=data;throw e}return data}
function cleanKey(key=''){return String(key||'').trim().toUpperCase().replace(/[^A-Z0-9_]/g,'_').slice(0,100)}
function cleanTargets(target){const allowed=new Set(['production','preview','development']);const list=(Array.isArray(target)?target:['production','preview']).filter(x=>allowed.has(x));return list.length?[...new Set(list)]:['production','preview']}

export default async function handler(req,res){
  if(!allowMethod(req,res,['POST']))return;
  res.setHeader('Cache-Control','no-store');
  try{
    const publishKey=env('PUBLISH_SECRET');
    if(!req.headers['x-aiway-publish-key']||req.headers['x-aiway-publish-key']!==publishKey)return json(res,401,{error:'Publishing access key is invalid.'});
    const token=env('VERCEL_TOKEN'),teamId=process.env.VERCEL_TEAM_ID||process.env.VERCEL_ORG_ID||'';
    const input=await bodyJson(req),action=String(input.action||'list'),projectId=String(input.projectId||input.projectName||'').trim();
    if(!projectId)return json(res,400,{error:'A Vercel project id or name is required.'});
    if(action==='list'){
      const data=await apiFetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}/env${teamQuery(teamId)}`,{headers:vercelHeaders(token)},'Vercel environment list');
      const envs=Array.isArray(data)?data:(data.envs||data.environmentVariables||[]);
      return json(res,200,{ok:true,projectId,variables:envs.map(x=>({id:x.id,key:x.key,type:x.type||'encrypted',target:Array.isArray(x.target)?x.target:[]})).sort((a,b)=>a.key.localeCompare(b.key))});
    }
    if(action==='upsert'){
      const key=cleanKey(input.key),value=typeof input.value==='string'?input.value:'';
      if(!key)return json(res,400,{error:'Invalid environment variable name.'});
      if(!value.trim())return json(res,400,{error:`A value is required for ${key}.`});
      if(Buffer.byteLength(value,'utf8')>32000)return json(res,413,{error:'Secret value is too large.'});
      const payload={key,value,type:'encrypted',target:cleanTargets(input.target)};
      await apiFetch(`${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/env${teamQuery(teamId,{upsert:'true'})}`,{method:'POST',headers:vercelHeaders(token),body:JSON.stringify(payload)},'Vercel environment upsert');
      return json(res,200,{ok:true,projectId,key,target:payload.target,saved:true,valueExposed:false});
    }
    return json(res,400,{error:'Unknown environment action.'});
  }catch(error){
    console.error('environment manager error',error?.status||'',error?.message||error);
    const status=error.status&&error.status>=400&&error.status<600?error.status:500;
    return json(res,status,{error:error.message||'Environment manager failed.'});
  }
}
