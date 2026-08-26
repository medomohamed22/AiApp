/**
 * GitHub + Vercel publisher route.
 *
 * MAINTAINER / AI RULES:
 * - This file is one Vercel Serverless Function; keep reusable helpers in /lib, never new /api helpers.
 * - Preserve PUBLISH_SECRET auth, path validation, payload limits, exact-snapshot publishing, and safe errors.
 * - Publishing changes must support both Git-linked and direct Vercel deployments.
 * - Never copy arbitrary process.env secrets into a user's published project.
 */

import { allowMethod, bodyJson, env, json, secureEqual, rateLimit } from '../lib/utils.js';
import { VERCEL_API, vercelApiFetch, vercelHeaders, vercelTeamQuery } from '../lib/vercel-api.js';

const GH_API = 'https://api.github.com';
const GH_VERSION = '2026-03-10';

function cleanName(value, fallback='aiway-site') {
  const out = String(value || fallback).trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 90);
  return out || fallback;
}
function safePath(value='') {
  const path = String(value).replace(/^\/+/, '').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const parts=path.split('/');
  if (!path || path.length>500 || path.includes('\0') || parts.some(p=>!p||p==='.'||p==='..') || ['.git','.vercel'].includes(parts[0]?.toLowerCase())) throw new Error(`Invalid file path: ${value}`);
  return path;
}
async function apiFetch(url, options={}, label='API') {
  const response = await fetch(url, options);
  const text = await response.text();
  let data={}; try { data = text ? JSON.parse(text) : {}; } catch { data={raw:text}; }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || data?.raw || `${label} HTTP ${response.status}`;
    const error = new Error(`${label}: ${message}`);
    error.status=response.status; error.data=data; throw error;
  }
  return data;
}
function githubHeaders(token){return{'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':GH_VERSION,'Content-Type':'application/json'}}

async function getGitHubUser(token){return apiFetch(`${GH_API}/user`,{headers:githubHeaders(token)},'GitHub')}
async function getGitHubRepo(token, owner, name){
  try{return await apiFetch(`${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,{headers:githubHeaders(token)},'GitHub repository')}
  catch(e){if(e.status===404)return null;throw e}
}
async function createGitHubRepo(token,{name,description,privateRepo}){
  return apiFetch(`${GH_API}/user/repos`,{method:'POST',headers:githubHeaders(token),body:JSON.stringify({name,description:String(description||'').slice(0,350),private:!!privateRepo,auto_init:true,has_issues:true,has_projects:false,has_wiki:false})},'GitHub create repository')
}
async function ensureGitHubRepo(token,user,{name,description,privateRepo}){
  const existing=await getGitHubRepo(token,user.login,name);
  if(existing)return{repo:existing,reused:true};
  return{repo:await createGitHubRepo(token,{name,description,privateRepo}),reused:false};
}
async function syncGitHubSnapshot(token,owner,repo,files,branch='main'){
  const refName=String(branch||'main');
  const ref=await apiFetch(`${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(refName)}`,{headers:githubHeaders(token)},'GitHub branch');
  const parentSha=ref?.object?.sha;
  if(!parentSha)throw new Error('GitHub branch has no HEAD commit');
  const treeEntries=files.map(file=>({path:safePath(file.path),mode:'100644',type:'blob',content:String(file.content??'')}));
  // No base_tree on purpose: this commit is an exact project snapshot. Files removed
  // from AiWay disappear from the repository instead of surviving from older publishes.
  const tree=await apiFetch(`${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,{method:'POST',headers:githubHeaders(token),body:JSON.stringify({tree:treeEntries})},'GitHub create tree');
  const commit=await apiFetch(`${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,{method:'POST',headers:githubHeaders(token),body:JSON.stringify({message:'Publish AiWay project snapshot',tree:tree.sha,parents:[parentSha]})},'GitHub create commit');
  await apiFetch(`${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(refName)}`,{method:'PATCH',headers:githubHeaders(token),body:JSON.stringify({sha:commit.sha,force:false})},'GitHub update branch');
  return{commitSha:commit.sha,treeSha:tree.sha};
}

async function getVercelProject(token,teamId,name){
  try{return await vercelApiFetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(name)}${vercelTeamQuery(teamId)}`,{headers:vercelHeaders(token)},'Vercel project')}
  catch(e){if(e.status===404)return null;throw e}
}
async function createVercelProject(token,teamId,{name,fullRepo}){
  // Try to connect GitHub during project creation. If the Vercel GitHub App cannot
  // see the repo, create a normal project and direct-deploy instead.
  try{
    return{project:await vercelApiFetch(`${VERCEL_API}/v10/projects${vercelTeamQuery(teamId)}`,{method:'POST',headers:vercelHeaders(token),body:JSON.stringify({name,gitRepository:{type:'github',repo:fullRepo}})},'Vercel create project'),gitLinked:true};
  }catch(e){
    const project=await vercelApiFetch(`${VERCEL_API}/v10/projects${vercelTeamQuery(teamId)}`,{method:'POST',headers:vercelHeaders(token),body:JSON.stringify({name})},'Vercel create project');
    return{project,gitLinked:false,gitLinkError:e.message};
  }
}
async function ensureVercelProject(token,teamId,{name,fullRepo}){
  const existing=await getVercelProject(token,teamId,name);
  if(existing)return{project:existing,reused:true,gitLinked:!!existing.link};
  return{...(await createVercelProject(token,teamId,{name,fullRepo})),reused:false};
}
async function createProjectEnv(token,teamId,projectId,names=[],supplied={}){
  const unique=[...new Set((names||[]).map(x=>String(x||'').trim().toUpperCase().replace(/[^A-Z0-9_]/g,'_')).filter(Boolean))];
  const secretMap=supplied&&typeof supplied==='object'&&!Array.isArray(supplied)?supplied:{};
  const envs=unique.map(key=>{const value=typeof secretMap[key]==='string'?secretMap[key]:undefined;return{key,value,type:'sensitive',target:['production','preview']}}).filter(x=>typeof x.value==='string'&&x.value.length);
  if(!envs.length)return{created:[],missing:unique};
  const suffix=vercelTeamQuery(teamId),url=`${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/env${suffix}${suffix?'&':'?'}upsert=true`;
  await vercelApiFetch(url,{method:'POST',headers:vercelHeaders(token),body:JSON.stringify(envs)},'Vercel environment variables');
  return{created:envs.map(x=>x.key),missing:unique.filter(k=>!envs.some(x=>x.key===k))};
}

function staticProjectSettings(){
  // Required on the first deployment of a newly created Vercel project.
  // "framework: null" means Other / static site with no build step.
  return{
    framework:null,
    buildCommand:null,
    devCommand:null,
    installCommand:null,
    outputDirectory:null,
    commandForIgnoringBuildStep:null
  };
}
async function createGitDeployment(token,teamId,{project,repoId,ref='main'}){
  return vercelApiFetch(`${VERCEL_API}/v13/deployments${vercelTeamQuery(teamId)}`,{method:'POST',headers:vercelHeaders(token),body:JSON.stringify({
    name:project.name,project:project.id,target:'production',
    gitSource:{type:'github',ref,repoId},withLatestCommit:true,
    projectSettings:staticProjectSettings()
  })},'Vercel Git deployment');
}
async function createDirectDeployment(token,teamId,{project,files}){
  const inlineFiles=files.map(file=>({file:safePath(file.path),data:Buffer.from(String(file.content??''),'utf8').toString('base64'),encoding:'base64'}));
  return vercelApiFetch(`${VERCEL_API}/v13/deployments${vercelTeamQuery(teamId)}`,{method:'POST',headers:vercelHeaders(token),body:JSON.stringify({
    name:project.name,project:project.id,target:'production',files:inlineFiles,
    projectSettings:staticProjectSettings()
  })},'Vercel direct deployment');
}
function partialPayload({repo,fullRepo,project,stage,error}){
  return{ok:false,stage,error,repository:repo?{id:repo.id,name:repo.name,fullName:fullRepo,url:repo.html_url}:null,vercel:project?{projectId:project.id,projectName:project.name,projectUrl:`https://vercel.com/${project.accountId||''}/${project.name}`}:null};
}

export default async function handler(req,res){
  if(!allowMethod(req,res,['POST']))return;
  if(!rateLimit(req,res,{key:'publish',limit:8}))return;
  res.setHeader('Cache-Control','no-store');
  let stage='authorize',repo=null,fullRepo='',project=null;
  try{
    const publishKey=env('PUBLISH_SECRET');
    const supplied=req.headers['x-aiway-publish-key'];
    if(!secureEqual(supplied,publishKey))return json(res,401,{error:'Publishing access key is invalid.',stage});
    const githubToken=env('GITHUB_TOKEN'),vercelToken=env('VERCEL_TOKEN');
    const teamId=process.env.VERCEL_TEAM_ID||process.env.VERCEL_ORG_ID||'';
    const input=await bodyJson(req),files=Array.isArray(input.files)?input.files:[];
    if(!files.length)return json(res,400,{error:'No files were supplied for publishing.',stage:'validate'});
    if(!files.some(f=>safePath(f.path).toLowerCase()==='index.html'))return json(res,400,{error:'The project must contain index.html before publishing.',stage:'validate'});
    if(files.length>80)return json(res,400,{error:'Too many files. Maximum is 80 files per publish.',stage:'validate'});
    const normalizedPaths=files.map(f=>safePath(f.path));
    if(new Set(normalizedPaths.map(x=>x.toLowerCase())).size!==normalizedPaths.length)return json(res,400,{error:'Duplicate file paths are not allowed.',stage:'validate'});
    for(let i=0;i<files.length;i++){
      files[i]={...files[i],path:normalizedPaths[i]};
      if(Buffer.byteLength(String(files[i].content??''),'utf8')>1_000_000)return json(res,413,{error:`File is too large: ${normalizedPaths[i]}`,stage:'validate'});
    }
    const totalBytes=files.reduce((n,f)=>n+Buffer.byteLength(String(f.content??''),'utf8'),0);
    if(totalBytes>4_500_000)return json(res,413,{error:'Project is too large for this publisher (4.5 MB maximum source payload).',stage:'validate'});

    const repoName=cleanName(input.repoName||input.projectName),projectName=cleanName(input.projectName||repoName);
    const description=String(input.description||'Published by AiWay').slice(0,350);

    stage='github_repository';
    const githubUser=await getGitHubUser(githubToken);
    const gh=await ensureGitHubRepo(githubToken,githubUser,{name:repoName,description,privateRepo:!!input.private});
    repo=gh.repo; fullRepo=repo.full_name||`${githubUser.login}/${repo.name}`;

    stage='github_files';
    const snapshot=await syncGitHubSnapshot(githubToken,repo.owner?.login||githubUser.login,repo.name,files,repo.default_branch||'main');

    stage='vercel_project';
    const vp=await ensureVercelProject(vercelToken,teamId,{name:projectName,fullRepo});
    project=vp.project;

    stage='vercel_environment';
    const environment=await createProjectEnv(vercelToken,teamId,project.id||project.name,input.environmentVariables||[],input.environmentSecrets||{});

    stage='vercel_deployment';
    let deployment,deploymentMode='git',gitDeploymentError=null;
    try{
      deployment=await createGitDeployment(vercelToken,teamId,{project,repoId:repo.id,ref:repo.default_branch||'main'});
    }catch(e){
      gitDeploymentError=e.message||String(e); deploymentMode='direct';
      deployment=await createDirectDeployment(vercelToken,teamId,{project,files});
    }

    // Do not poll for up to two minutes inside a Serverless Function. Vercel
    // returns a deployment immediately; returning it keeps publishing fast and
    // avoids function timeouts on Hobby/Pro plans.
    const readyState=deployment?.readyState||deployment?.state||'QUEUED';
    const deploymentUrl=deployment?.url||'';
    const productionUrl=deploymentUrl?`https://${deploymentUrl}`:'';

    const result={
      ok:readyState!=='ERROR'&&readyState!=='CANCELED',state:readyState,stage:'done',
      repository:{id:repo.id,name:repo.name,fullName:fullRepo,url:repo.html_url,reused:gh.reused,commitSha:snapshot.commitSha},
      vercel:{projectId:project.id,projectName:project.name,deploymentId:deployment?.id||null,url:productionUrl,deploymentMode,projectReused:vp.reused,gitLinked:vp.gitLinked,gitLinkError:vp.gitLinkError||undefined,gitDeploymentFallbackReason:gitDeploymentError||undefined},
      environment,
      message:readyState==='READY'?'Website published successfully.':'Deployment created successfully and is continuing on Vercel.'
    };
    // Always return the exact API URLs. The assistant should never synthesize them.
    return json(res,200,result);
  }catch(error){
    console.error('publish error',stage,error);
    const status=error.status&&error.status>=400&&error.status<600?error.status:500;
    return json(res,status,{...partialPayload({repo,fullRepo,project,stage,error:error.message||'Publishing failed'}),details:error.data?.error?.code||error.data?.code||undefined});
  }
}
