import { allowMethod, json } from './_utils.js';

const GH_API='https://api.github.com';
const GH_VERSION='2026-03-10';
const MAX_CONTEXT_FILES=14;
const MAX_FILE_BYTES=45_000;
const MAX_TOTAL_CONTEXT=180_000;
const MAX_CHANGES=8;
const PROTECTED_PREFIXES=['.github/workflows/','.vercel/','.env'];
const PROTECTED_FILES=new Set(['api/evolve-daily.js','SECURITY.md']);

function ghHeaders(token){return{'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':GH_VERSION,'Content-Type':'application/json'}}
async function apiFetch(url,options={},label='API'){
  const r=await fetch(url,options);const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}};
  if(!r.ok){const e=new Error(`${label}: ${data?.message||data?.error?.message||data?.raw||`HTTP ${r.status}`}`);e.status=r.status;e.data=data;throw e}return data;
}
function cleanBranchPart(x=''){return String(x).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,55)||'improvement'}
function safePath(path=''){const p=String(path).replace(/^\/+/, '').replace(/\\/g,'/');if(!p||p.includes('..'))throw new Error(`Unsafe path: ${path}`);return p}
function isProtected(path=''){const p=safePath(path);return PROTECTED_FILES.has(p)||PROTECTED_PREFIXES.some(x=>p===x.slice(0,-1)||p.startsWith(x))||/(^|\/)\.env(\.|$)/i.test(p)}
function isContextCandidate(path=''){
  if(isProtected(path))return false;
  if(/(^|\/)(node_modules|dist|build|coverage|\.next|vendor)(\/|$)/i.test(path))return false;
  if(/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|lock|woff2?|ttf|mp4|mov|mp3)$/i.test(path))return false;
  return /(^|\/)(README\.md|package\.json|vercel\.json|index\.html|src|app|pages|api|lib|components|skills|tools)(\/|$|\.)/i.test(path)||/\.(js|mjs|cjs|ts|tsx|jsx|json|md|html|css)$/i.test(path);
}
function decodeContent(data){return Buffer.from(String(data||''),'base64').toString('utf8')}
function parseRepo(raw=''){const m=String(raw).trim().match(/^([^/\s]+)\/([^/\s]+)$/);if(!m)throw new Error('SELF_EVOLVE_REPO must be owner/repo');return{owner:m[1],repo:m[2]}}
function parseJsonText(text=''){
  const cleaned=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(cleaned)}catch{}
  const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(cleaned.slice(a,b+1));
  throw new Error('AI returned invalid JSON');
}
async function geminiJson(prompt){
  const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('Missing GEMINI_API_KEY');
  const model=process.env.SELF_EVOLVE_MODEL||'gemini-2.5-flash';
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body={contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:.2,responseMimeType:'application/json',maxOutputTokens:12000}};
  const data=await apiFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},'Gemini');
  const text=(data.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('');return parseJsonText(text);
}
async function jinaSearch(query){
  const key=process.env.JINA_API_KEY;if(!key)return `Search skipped: JINA_API_KEY is not configured. Query: ${query}`;
  const r=await fetch(`https://s.jina.ai/?q=${encodeURIComponent(query)}`,{headers:{Authorization:`Bearer ${key}`,Accept:'text/plain'}});
  const t=await r.text();if(!r.ok)return `Search failed (${r.status}) for ${query}: ${t.slice(0,500)}`;return t.slice(0,9000);
}
async function getRepo(token,owner,repo){return apiFetch(`${GH_API}/repos/${owner}/${repo}`,{headers:ghHeaders(token)},'GitHub repo')}
async function getRef(token,owner,repo,branch){return apiFetch(`${GH_API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,{headers:ghHeaders(token)},'GitHub ref')}
async function getTree(token,owner,repo,sha){return apiFetch(`${GH_API}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,{headers:ghHeaders(token)},'GitHub tree')}
async function getFile(token,owner,repo,path,ref){
  const enc=safePath(path).split('/').map(encodeURIComponent).join('/');return apiFetch(`${GH_API}/repos/${owner}/${repo}/contents/${enc}?ref=${encodeURIComponent(ref)}`,{headers:ghHeaders(token)},`GitHub read ${path}`)
}
async function createBranch(token,owner,repo,branch,sha){return apiFetch(`${GH_API}/repos/${owner}/${repo}/git/refs`,{method:'POST',headers:ghHeaders(token),body:JSON.stringify({ref:`refs/heads/${branch}`,sha})},'GitHub create branch')}
async function putFile(token,owner,repo,path,content,branch,message){
  let existing=null;try{existing=await getFile(token,owner,repo,path,branch)}catch(e){if(e.status!==404)throw e}
  const enc=safePath(path).split('/').map(encodeURIComponent).join('/');const body={message,content:Buffer.from(String(content),'utf8').toString('base64'),branch};if(existing?.sha)body.sha=existing.sha;
  return apiFetch(`${GH_API}/repos/${owner}/${repo}/contents/${enc}`,{method:'PUT',headers:ghHeaders(token),body:JSON.stringify(body)},`GitHub write ${path}`)
}
async function createPR(token,owner,repo,{title,head,base,body}){return apiFetch(`${GH_API}/repos/${owner}/${repo}/pulls`,{method:'POST',headers:ghHeaders(token),body:JSON.stringify({title,head,base,body,draft:true,maintainer_can_modify:true})},'GitHub create pull request')}
async function loadContext(token,owner,repo,baseSha){
  const tree=await getTree(token,owner,repo,baseSha);const candidates=(tree.tree||[]).filter(x=>x.type==='blob'&&x.size<=MAX_FILE_BYTES&&isContextCandidate(x.path));
  const priority=p=>{let s=0;if(p==='README.md')s+=100;if(p==='package.json')s+=95;if(p==='vercel.json')s+=90;if(p==='index.html')s+=85;if(/^api\//.test(p))s+=65;if(/^src\//.test(p)||/^app\//.test(p))s+=60;if(/SECURITY|governance|evolution/i.test(p))s+=50;return s};
  candidates.sort((a,b)=>priority(b.path)-priority(a.path)||a.path.localeCompare(b.path));let total=0;const files=[];
  for(const item of candidates){if(files.length>=MAX_CONTEXT_FILES||total>=MAX_TOTAL_CONTEXT)break;try{const f=await getFile(token,owner,repo,item.path,baseSha);const content=decodeContent(f.content||'');if(total+content.length>MAX_TOTAL_CONTEXT)continue;files.push({path:item.path,content});total+=content.length}catch{}}
  return files;
}
function researchQueries(repoName){const year=new Date().getUTCFullYear();return[
  `${year} latest AI coding agent tools MCP skills autonomous software engineering GitHub`,
  `${year} latest Vercel Next.js developer tooling browser testing agent workflows`,
  `${year} open source AI agent memory skills tool registry self improving coding agents`,
  `${repoName} alternatives Hermes agent MCP skills coding agent features`
]}
async function createProposal(repoInfo,context,research){
  const prompt=`You are AiWay's Product Evolution Reviewer. Today is ${new Date().toISOString().slice(0,10)}.\n\nGoal: propose exactly 5 concrete improvements for this AI website-building agent. Use the repository context and current web research below. Prefer capabilities that make the product more reliable, agentic, secure, testable, or extensible. Avoid novelty for novelty's sake.\n\nRepository: ${repoInfo.full_name}\nDescription: ${repoInfo.description||''}\n\nREPOSITORY CONTEXT:\n${context.map(f=>`--- ${f.path} ---\n${f.content}`).join('\n\n')}\n\nWEB RESEARCH:\n${research.join('\n\n===== SEARCH =====\n\n')}\n\nReturn JSON only with this schema:\n{"proposals":[{"id":"short-kebab-id","title":"...","problem":"...","evidence":"...","implementation":"...","userValue":0,"reliability":0,"mvpFit":0,"risk":0,"effort":0,"score":0,"riskLevel":"low|medium|high","sources":["URLs if present in research"]}],"selectedId":"...","selectionReason":"..."}\nScoring: higher userValue/reliability/mvpFit are better; risk and effort are costs. score 0-100. Select ONE low/medium-risk proposal only. Never select a change to auth, payments, secrets, production deletion, governance rules, or the self-evolution endpoint itself.`;
  return geminiJson(prompt);
}
async function generateChanges(repoInfo,context,proposal){
  const prompt=`You are a senior coding agent preparing ONE reviewable improvement for ${repoInfo.full_name}. Implement only the selected proposal below.\n\nPROPOSAL:\n${JSON.stringify(proposal,null,2)}\n\nCURRENT FILES:\n${context.map(f=>`--- ${f.path} ---\n${f.content}`).join('\n\n')}\n\nHard rules:\n- Return complete file contents, not diffs.\n- Max ${MAX_CHANGES} changed/created files.\n- Do NOT modify .github/workflows/*, .env*, .vercel/*, SECURITY.md, or api/evolve-daily.js.\n- Do NOT delete files.\n- Do NOT weaken authentication, permissions, secret handling, security checks, or tests.\n- Prefer small cohesive changes.\n- If implementation is unsafe or repository context is insufficient, set safeToImplement=false and changes=[].\n- Preserve existing behavior unless required by the proposal.\n\nReturn JSON only:\n{"safeToImplement":true,"summary":"...","tests":["..."],"changes":[{"path":"relative/path","content":"complete new file content","reason":"..."}]}`;
  return geminiJson(prompt);
}
function validateChanges(changes=[]){
  if(!Array.isArray(changes)||!changes.length)throw new Error('AI produced no changes');if(changes.length>MAX_CHANGES)throw new Error(`AI proposed too many files (${changes.length})`);
  const seen=new Set();for(const c of changes){const p=safePath(c.path);if(isProtected(p))throw new Error(`Protected file change blocked: ${p}`);if(seen.has(p))throw new Error(`Duplicate change: ${p}`);seen.add(p);if(typeof c.content!=='string'||c.content.length>180_000)throw new Error(`Invalid/oversized content: ${p}`)}return changes;
}
function reportMarkdown(proposalSet,selected,implementation,research){
  return `# AiWay Evolution Candidate — ${new Date().toISOString().slice(0,10)}\n\n## Selected improvement\n\n**${selected.title}** (${selected.score}/100, ${selected.riskLevel} risk)\n\n${selected.problem}\n\n### Why this was selected\n${proposalSet.selectionReason||''}\n\n### Planned implementation\n${selected.implementation}\n\n### Generated implementation summary\n${implementation.summary||''}\n\n### Suggested verification\n${(implementation.tests||[]).map(x=>`- ${x}`).join('\n')||'- Run the repository test/build commands before merging.'}\n\n## Daily shortlist\n${(proposalSet.proposals||[]).map((x,i)=>`${i+1}. **${x.title}** — ${x.score}/100 — ${x.riskLevel} risk`).join('\n')}\n\n## Safety\nThis PR is intentionally created as a **draft**. AiWay does not merge it automatically. Protected governance/workflow/secret files are blocked from self-modification by the server endpoint.\n\n## Research snapshot\n${research.map((x,i)=>`### Search ${i+1}\n\n${x.slice(0,2500)}`).join('\n\n')}\n`;
}
function authorized(req){
  const cron=process.env.CRON_SECRET;const publish=process.env.PUBLISH_SECRET;const auth=String(req.headers.authorization||'');const key=String(req.headers['x-aiway-publish-key']||'');
  return (!!cron&&auth===`Bearer ${cron}`)||(!!publish&&key===publish);
}

export default async function handler(req,res){
  if(!allowMethod(req,res,['GET','POST']))return;res.setHeader('Cache-Control','no-store');
  try{
    if(!authorized(req))return json(res,401,{ok:false,error:'Unauthorized evolution request'});
    if(String(process.env.SELF_EVOLVE_ENABLED||'false').toLowerCase()!=='true')return json(res,200,{ok:false,disabled:true,error:'SELF_EVOLVE_ENABLED is not true'});
    const token=process.env.GITHUB_TOKEN;if(!token)throw new Error('Missing GITHUB_TOKEN');
    const {owner,repo}=parseRepo(process.env.SELF_EVOLVE_REPO||'');const repoInfo=await getRepo(token,owner,repo);const base=process.env.SELF_EVOLVE_BASE_BRANCH||repoInfo.default_branch||'main';const ref=await getRef(token,owner,repo,base);const baseSha=ref.object?.sha;if(!baseSha)throw new Error('Could not resolve base branch SHA');
    const context=await loadContext(token,owner,repo,baseSha);if(!context.length)throw new Error('No repository context could be loaded');
    const research=[];for(const q of researchQueries(repo))research.push(await jinaSearch(q));
    const proposalSet=await createProposal(repoInfo,context,research);const proposals=Array.isArray(proposalSet.proposals)?proposalSet.proposals:[];const selected=proposals.find(x=>x.id===proposalSet.selectedId)||proposals.sort((a,b)=>(b.score||0)-(a.score||0))[0];if(!selected)throw new Error('AI did not produce a selectable proposal');
    if(!['low','medium'].includes(String(selected.riskLevel||'').toLowerCase()))return json(res,200,{ok:true,implemented:false,reason:'Top candidate is high risk and requires manual planning',proposals,selected});
    const implementation=await generateChanges(repoInfo,context,selected);if(!implementation.safeToImplement)return json(res,200,{ok:true,implemented:false,reason:'Coding agent marked the proposal unsafe or under-specified',proposals,selected,implementation});
    const changes=validateChanges(implementation.changes);const stamp=new Date().toISOString().replace(/[:.]/g,'-');const branch=`aiway-evolution/${stamp}-${cleanBranchPart(selected.id||selected.title)}`.slice(0,120);
    await createBranch(token,owner,repo,branch,baseSha);
    for(const change of changes)await putFile(token,owner,repo,change.path,change.content,branch,`AiWay Evolution: ${selected.title}`);
    const reportPath=`evolution/reports/${new Date().toISOString().slice(0,10)}-${cleanBranchPart(selected.id||selected.title)}.md`;
    await putFile(token,owner,repo,reportPath,reportMarkdown(proposalSet,selected,implementation,research),branch,`Document AiWay evolution candidate: ${selected.title}`);
    const pr=await createPR(token,owner,repo,{title:`[AiWay Evolution] ${selected.title}`,head:branch,base,body:`Automated daily evolution candidate.\n\nScore: **${selected.score}/100**  \nRisk: **${selected.riskLevel}**\n\n${implementation.summary||selected.implementation}\n\nThis PR is a draft and must be reviewed before merge.`});
    return json(res,200,{ok:true,implemented:true,repository:repoInfo.html_url,base,branch,pullRequest:{number:pr.number,url:pr.html_url,draft:pr.draft},selected,proposals,files:changes.map(x=>x.path),reportPath});
  }catch(error){console.error('evolve-daily',error);return json(res,error.status>=400&&error.status<600?error.status:500,{ok:false,error:error.message||'Evolution run failed',details:error.data?.message||undefined})}
}
