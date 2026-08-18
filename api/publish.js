import { allowMethod, env, json } from './_utils.js';

const GH_API = 'https://api.github.com';
const VERCEL_API = 'https://api.vercel.com';
const GH_VERSION = '2026-03-10';

function cleanName(value, fallback='aiway-site') {
  const out = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return out || fallback;
}

function safePath(value='') {
  const path = String(value).replace(/^\/+/, '').replace(/\\/g, '/');
  if (!path || path.includes('..') || path.startsWith('.vercel/')) throw new Error(`Invalid file path: ${value}`);
  return path;
}

async function bodyJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  return JSON.parse(raw);
}

async function apiFetch(url, options = {}, label = 'API') {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || data?.raw || `${label} HTTP ${response.status}`;
    const error = new Error(`${label}: ${message}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function githubHeaders(token) {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': GH_VERSION,
    'Content-Type': 'application/json'
  };
}

function vercelHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function getGitHubUser(token) {
  return apiFetch(`${GH_API}/user`, { headers: githubHeaders(token) }, 'GitHub');
}

async function createGitHubRepo(token, { name, description, privateRepo }) {
  return apiFetch(`${GH_API}/user/repos`, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({
      name,
      description: String(description || '').slice(0, 350),
      private: !!privateRepo,
      auto_init: true,
      has_issues: true,
      has_projects: false,
      has_wiki: false
    })
  }, 'GitHub create repository');
}

async function putGitHubFile(token, owner, repo, file, branch='main') {
  const path = safePath(file.path);
  const content = Buffer.from(String(file.content ?? ''), 'utf8').toString('base64');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return apiFetch(`${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`, {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify({
      message: `Add ${path} via AiWay`,
      content,
      branch
    })
  }, `GitHub upload ${path}`);
}

async function createVercelProject(token, teamId, { name, fullRepo }) {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  return apiFetch(`${VERCEL_API}/v10/projects${query}`, {
    method: 'POST',
    headers: vercelHeaders(token),
    body: JSON.stringify({
      name,
      gitRepository: {
        type: 'github',
        repo: fullRepo
      }
    })
  }, 'Vercel create project');
}

async function createProjectEnv(token, teamId, projectId, names=[]) {
  const unique = [...new Set((names || []).map(x => String(x || '').trim()).filter(Boolean))];
  const envs = unique.map(key => ({ key, value: process.env[key], type: 'encrypted', target: ['production', 'preview'] }))
    .filter(x => typeof x.value === 'string' && x.value.length);
  if (!envs.length) return { created: [], missing: unique };
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  await apiFetch(`${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/env${query}`, {
    method: 'POST',
    headers: vercelHeaders(token),
    body: JSON.stringify(envs)
  }, 'Vercel environment variables');
  return { created: envs.map(x => x.key), missing: unique.filter(k => !envs.some(x => x.key === k)) };
}

async function createDeployment(token, teamId, { project, repoId, ref='main' }) {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  return apiFetch(`${VERCEL_API}/v13/deployments${query}`, {
    method: 'POST',
    headers: vercelHeaders(token),
    body: JSON.stringify({
      name: project.name,
      project: project.id,
      target: 'production',
      gitSource: {
        type: 'github',
        ref,
        repoId
      },
      withLatestCommit: true
    })
  }, 'Vercel deployment');
}

async function waitForDeployment(token, teamId, deploymentId, timeoutMs=90000) {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const started = Date.now();
  let latest = null;
  while (Date.now() - started < timeoutMs) {
    latest = await apiFetch(`${VERCEL_API}/v13/deployments/${encodeURIComponent(deploymentId)}${query}`, {
      headers: vercelHeaders(token)
    }, 'Vercel deployment status');
    const state = latest.readyState || latest.state;
    if (['READY', 'ERROR', 'CANCELED'].includes(state)) return latest;
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  return latest || { id: deploymentId, readyState: 'QUEUED' };
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['POST'])) return;
  res.setHeader('Cache-Control', 'no-store');

  try {
    const publishKey = env('PUBLISH_SECRET');
    const supplied = req.headers['x-aiway-publish-key'];
    if (!supplied || supplied !== publishKey) return json(res, 401, { error: 'Publishing access key is invalid.' });

    const githubToken = env('GITHUB_TOKEN');
    const vercelToken = env('VERCEL_TOKEN');
    const teamId = process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || '';
    const input = await bodyJson(req);

    const files = Array.isArray(input.files) ? input.files : [];
    if (!files.length) return json(res, 400, { error: 'No files were supplied for publishing.' });
    if (!files.some(f => safePath(f.path).toLowerCase() === 'index.html')) {
      return json(res, 400, { error: 'The project must contain index.html before publishing.' });
    }
    if (files.length > 80) return json(res, 400, { error: 'Too many files. Maximum is 80 files per publish.' });
    const totalBytes = files.reduce((n, f) => n + Buffer.byteLength(String(f.content ?? ''), 'utf8'), 0);
    if (totalBytes > 4_500_000) return json(res, 413, { error: 'Project is too large for this publisher (4.5 MB maximum source payload).' });

    const repoName = cleanName(input.repoName || input.projectName);
    const projectName = cleanName(input.projectName || repoName);
    const description = String(input.description || 'Published by AiWay').slice(0, 350);

    const githubUser = await getGitHubUser(githubToken);
    const repo = await createGitHubRepo(githubToken, {
      name: repoName,
      description,
      privateRepo: !!input.private
    });

    for (const file of files) {
      await putGitHubFile(githubToken, repo.owner?.login || githubUser.login, repo.name, file, repo.default_branch || 'main');
    }

    const fullRepo = repo.full_name || `${repo.owner?.login || githubUser.login}/${repo.name}`;
    const project = await createVercelProject(vercelToken, teamId, { name: projectName, fullRepo });

    const environment = await createProjectEnv(vercelToken, teamId, project.id || project.name, input.environmentVariables || []);
    const deployment = await createDeployment(vercelToken, teamId, {
      project,
      repoId: repo.id,
      ref: repo.default_branch || 'main'
    });
    const finalDeployment = deployment?.id
      ? await waitForDeployment(vercelToken, teamId, deployment.id)
      : deployment;

    const readyState = finalDeployment?.readyState || finalDeployment?.state || deployment?.readyState || 'QUEUED';
    const deploymentUrl = finalDeployment?.url || deployment?.url || '';
    const productionUrl = deploymentUrl ? `https://${deploymentUrl}` : (project?.targets?.production?.alias?.[0] ? `https://${project.targets.production.alias[0]}` : '');

    return json(res, 200, {
      ok: readyState !== 'ERROR' && readyState !== 'CANCELED',
      state: readyState,
      repository: {
        id: repo.id,
        name: repo.name,
        fullName: fullRepo,
        url: repo.html_url
      },
      vercel: {
        projectId: project.id,
        projectName: project.name,
        deploymentId: finalDeployment?.id || deployment?.id || null,
        url: productionUrl
      },
      environment,
      message: readyState === 'READY' ? 'Website published successfully.' : 'Deployment created; it may still be building.'
    });
  } catch (error) {
    console.error('publish error', error);
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return json(res, status, {
      error: error.message || 'Publishing failed',
      details: error.data?.error?.code || error.data?.code || undefined
    });
  }
}
