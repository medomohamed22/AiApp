import { allowMethod, json } from './_utils.js';
import { getEvolutionRegistry } from './ai.js';

const GH_API = 'https://api.github.com';
const GH_VERSION = '2026-03-10';
const MAX_CONTEXT_FILES = 16;
const MAX_FILE_BYTES = 180_000;
const MAX_TOTAL_CONTEXT = 240_000;
const AI_FILE = 'api/ai.js';
const CATALOG_FILE = 'evolution/catalog.json';
const SKILL_START = '  // AIWAY_EVOLUTION_SKILLS_START';
const SKILL_END = '  // AIWAY_EVOLUTION_SKILLS_END';
const TOOL_START = '  // AIWAY_EVOLUTION_TOOLS_START';
const TOOL_END = '  // AIWAY_EVOLUTION_TOOLS_END';

const SCORE_WEIGHTS = {
  userValue: 0.20,
  codingQuality: 0.17,
  futureReuse: 0.12,
  intelligenceGain: 0.12,
  gapFit: 0.09,
  historicalReplay: 0.10,
  reliability: 0.07,
  evidenceStrength: 0.05,
  security: 0.04,
  costEfficiency: 0.02,
  maintenanceEase: 0.02,
};
const MAX_ADVISORS = 3;

function clampScore(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}
function strategicScore(p = {}) {
  return Math.round(Object.entries(SCORE_WEIGHTS).reduce((sum, [k, w]) => sum + clampScore(p[k]) * w, 0));
}
function normalizeProposal(p = {}) {
  const next = { ...p };
  for (const k of Object.keys(SCORE_WEIGHTS)) next[k] = clampScore(next[k]);
  next.score = strategicScore(next);
  next.riskLevel = String(next.riskLevel || 'medium').toLowerCase();
  next.capabilityType = String(next.capabilityType || 'skill').toLowerCase();
  return next;
}
function parseCatalog(text = '{}') {
  let c;
  try { c = JSON.parse(text || '{}'); } catch { c = {}; }
  c.version = Math.max(3, Number(c.version) || 1);
  c.skills = Array.isArray(c.skills) ? c.skills : [];
  c.httpTools = Array.isArray(c.httpTools) ? c.httpTools : [];
  c.intelligence = c.intelligence && typeof c.intelligence === 'object' ? c.intelligence : {};
  c.intelligence.gapProfile = c.intelligence.gapProfile && typeof c.intelligence.gapProfile === 'object' ? c.intelligence.gapProfile : {};
  c.intelligence.capabilityMetrics = c.intelligence.capabilityMetrics && typeof c.intelligence.capabilityMetrics === 'object' ? c.intelligence.capabilityMetrics : {};
  c.intelligence.evolutionHistory = Array.isArray(c.intelligence.evolutionHistory) ? c.intelligence.evolutionHistory.slice(-30) : [];
  return c;
}
function capabilityInventory(catalogText) {
  const catalog = parseCatalog(catalogText);
  const runtime = getEvolutionRegistry();
  const rows = [];
  for (const [id, item] of Object.entries(runtime.skills || {})) rows.push({ id, type: 'skill', name: item.name || id, description: item.description || '', tags: item.tags || [], domains: item.domains || [], userValue: item.userValue ?? null, selfImprovementValue: item.selfImprovementValue ?? null });
  for (const [id, item] of Object.entries(runtime.tools || {})) rows.push({ id, type: 'tool', name: item.name || id, description: item.description || '', tags: item.tags || [], domains: item.domains || [], userValue: item.userValue ?? null, selfImprovementValue: item.selfImprovementValue ?? null, evolutionSafe: item.evolutionSafe === true, evolutionHint: item.evolutionHint || '' });
  for (const row of rows) row.metrics = catalog.intelligence.capabilityMetrics[row.id] || {};
  return { catalog, runtime, rows };
}


function ghHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': GH_VERSION,
    'Content-Type': 'application/json',
  };
}
async function apiFetch(url, options = {}, label = 'API') {
  const r = await fetch(url, options);
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) {
    const e = new Error(`${label}: ${data?.message || data?.error?.message || data?.raw || `HTTP ${r.status}`}`);
    e.status = r.status;
    e.data = data;
    throw e;
  }
  return data;
}
function safePath(path = '') {
  const p = String(path).replace(/^\/+/, '').replace(/\\/g, '/');
  if (!p || p.includes('..')) throw new Error(`Unsafe path: ${path}`);
  return p;
}
function decodeContent(data) { return Buffer.from(String(data || ''), 'base64').toString('utf8'); }
function parseRepo(raw = '') {
  const m = String(raw).trim().match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!m) throw new Error('SELF_EVOLVE_REPO must be owner/repo');
  return { owner: m[1], repo: m[2] };
}
function parseJsonText(text = '') {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch {}
  const a = cleaned.indexOf('{');
  const b = cleaned.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
  throw new Error('AI returned invalid JSON');
}
function cleanId(value = '') {
  const id = String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (!id) throw new Error('Capability id is empty');
  return id;
}
function cleanBranchPart(x = '') {
  return cleanId(x).replace(/_/g, '-').slice(0, 55) || 'improvement';
}
function jsString(value) { return JSON.stringify(String(value ?? '')); }
function jsObject(value) { return JSON.stringify(value ?? {}, null, 2); }

async function geminiJson(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing GEMINI_API_KEY');
  const model = process.env.SELF_EVOLVE_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.15, responseMimeType: 'application/json', maxOutputTokens: 12000 },
  };
  const data = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 'Gemini');
  const text = (data.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
  return parseJsonText(text);
}
async function jinaSearch(query) {
  const key = process.env.JINA_API_KEY;
  if (!key) return `Search skipped: JINA_API_KEY is not configured. Query: ${query}`;
  const r = await fetch(`https://s.jina.ai/?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${key}`, Accept: 'text/plain' } });
  const t = await r.text();
  if (!r.ok) return `Search failed (${r.status}) for ${query}: ${t.slice(0, 500)}`;
  return t.slice(0, 9000);
}
async function getRepo(token, owner, repo) { return apiFetch(`${GH_API}/repos/${owner}/${repo}`, { headers: ghHeaders(token) }, 'GitHub repo'); }
async function getRef(token, owner, repo, branch) { return apiFetch(`${GH_API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, { headers: ghHeaders(token) }, 'GitHub ref'); }
async function getTree(token, owner, repo, sha) { return apiFetch(`${GH_API}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, { headers: ghHeaders(token) }, 'GitHub tree'); }
async function getFile(token, owner, repo, path, ref) {
  const enc = safePath(path).split('/').map(encodeURIComponent).join('/');
  return apiFetch(`${GH_API}/repos/${owner}/${repo}/contents/${enc}?ref=${encodeURIComponent(ref)}`, { headers: ghHeaders(token) }, `GitHub read ${path}`);
}
async function createBranch(token, owner, repo, branch, sha) {
  return apiFetch(`${GH_API}/repos/${owner}/${repo}/git/refs`, { method: 'POST', headers: ghHeaders(token), body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }) }, 'GitHub create branch');
}
async function putExistingFile(token, owner, repo, path, content, branch, message) {
  const existing = await getFile(token, owner, repo, path, branch);
  const enc = safePath(path).split('/').map(encodeURIComponent).join('/');
  return apiFetch(`${GH_API}/repos/${owner}/${repo}/contents/${enc}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify({ message, content: Buffer.from(String(content), 'utf8').toString('base64'), branch, sha: existing.sha }),
  }, `GitHub update ${path}`);
}
async function createPR(token, owner, repo, { title, head, base, body }) {
  return apiFetch(`${GH_API}/repos/${owner}/${repo}/pulls`, {
    method: 'POST', headers: ghHeaders(token), body: JSON.stringify({ title, head, base, body, draft: true, maintainer_can_modify: true }),
  }, 'GitHub create pull request');
}

function isContextCandidate(path = '') {
  if (/(^|\/)(node_modules|dist|build|coverage|\.next|vendor)(\/|$)/i.test(path)) return false;
  if (/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|lock|woff2?|ttf|mp4|mov|mp3)$/i.test(path)) return false;
  return path === AI_FILE || path === CATALOG_FILE || /(^|\/)(README\.md|index\.html|api|evolution)(\/|$|\.)/i.test(path) || /\.(js|json|md|html)$/i.test(path);
}
async function loadContext(token, owner, repo, baseSha) {
  const tree = await getTree(token, owner, repo, baseSha);
  const candidates = (tree.tree || []).filter(x => x.type === 'blob' && x.size <= MAX_FILE_BYTES && isContextCandidate(x.path));
  const priority = p => p === AI_FILE ? 200 : p === CATALOG_FILE ? 190 : p === 'README.md' ? 100 : p === 'index.html' ? 90 : /^api\//.test(p) ? 80 : 20;
  candidates.sort((a, b) => priority(b.path) - priority(a.path) || a.path.localeCompare(b.path));
  let total = 0;
  const files = [];
  for (const item of candidates) {
    if (files.length >= MAX_CONTEXT_FILES || total >= MAX_TOTAL_CONTEXT) break;
    try {
      const f = await getFile(token, owner, repo, item.path, baseSha);
      const content = decodeContent(f.content || '');
      if (total + content.length > MAX_TOTAL_CONTEXT) continue;
      files.push({ path: item.path, content });
      total += content.length;
    } catch {}
  }
  return files;
}
function researchQueries(repoName, gapProfile = {}) {
  const year = new Date().getUTCFullYear();
  const weakest = Object.entries(gapProfile || {}).sort((a, b) => Number(a[1]) - Number(b[1])).slice(0, 3).map(([k]) => k).join(' ');
  return [
    `${year} latest AI coding agent tools MCP skills autonomous software engineering GitHub ${weakest}`.trim(),
    `${year} coding agent reliability evaluation developer tools ${weakest}`.trim(),
    `${year} open source AI agent memory skills tool registry self improving coding agents ${weakest}`.trim(),
    `${repoName} Hermes agent reusable skills tools ${weakest}`.trim(),
  ];
}

async function analyzeCapabilityGaps(repoInfo, context, inventory) {
  const prompt = `You are AiWay's Capability Gap Analyst. Analyze what would most improve BOTH end-user website-building results and AiWay's ability to build better capabilities in future runs.

Repository: ${repoInfo.full_name}

CURRENT CAPABILITIES:
${JSON.stringify(inventory.rows, null, 2)}

RECENT EVOLUTION HISTORY:
${JSON.stringify(inventory.catalog.intelligence.evolutionHistory.slice(-12), null, 2)}

REPOSITORY CONTEXT:
${context.map(f => `--- ${f.path} ---\n${f.content.slice(0, 14000)}`).join('\n\n')}

Return JSON only with 0-100 strength scores where LOW means a bigger gap. Use exactly these keys plus rationale and priorities:
{"gapProfile":{"backendReasoning":0,"frontendReasoning":0,"architecturePlanning":0,"testingVerification":0,"securityReview":0,"debugging":0,"contextManagement":0,"toolSelection":0,"codeQuality":0,"deploymentReliability":0},"priorities":["..."],"rationale":"..."}`;
  return geminiJson(prompt);
}

async function chooseAdvisors(inventory, gapAnalysis) {
  if (!inventory.rows.length) return { advisorIds: [], reason: 'No existing evolved capabilities yet.' };
  const prompt = `You are selecting existing AiWay capabilities to help with TODAY'S self-evolution research and coding. Select at most ${MAX_ADVISORS}. Prefer capabilities that improve analysis, backend/frontend engineering, testing, security, architecture, context, or tool selection. A tool may be selected for execution only if evolutionSafe=true. Skills can always be used as procedural guidance.

CAPABILITIES:
${JSON.stringify(inventory.rows, null, 2)}

CURRENT GAPS:
${JSON.stringify(gapAnalysis, null, 2)}

Return JSON only: {"advisorIds":["id"],"reason":"..."}`;
  return geminiJson(prompt);
}

async function runAdvisors(inventory, advisorIds, context, gapAnalysis) {
  const outputs = [];
  const ids = Array.isArray(advisorIds) ? advisorIds.slice(0, MAX_ADVISORS) : [];
  for (const id of ids) {
    const row = inventory.rows.find(x => x.id === id);
    if (!row) continue;
    if (row.type === 'skill') {
      const skill = inventory.runtime.skills?.[id];
      outputs.push({ id, type: 'skill', ok: true, output: String(skill?.content || row.description || '').slice(0, 8000) });
      continue;
    }
    const tool = inventory.runtime.tools?.[id];
    if (!tool || tool.evolutionSafe !== true) {
      outputs.push({ id, type: 'tool', ok: false, error: 'Tool is not marked evolutionSafe' });
      continue;
    }
    try {
      const argsPlan = await geminiJson(`Prepare SAFE read-only arguments for the existing AiWay tool ${id}. The purpose is to help analyze the current repository and capability gaps during self-evolution. Never request destructive actions, secrets, writes, or auth changes.\nSchema: ${JSON.stringify(tool.schema || {}, null, 2)}\nEvolution hint: ${tool.evolutionHint || ''}\nGap analysis: ${JSON.stringify(gapAnalysis)}\nRepository excerpts: ${context.slice(0, 6).map(f => `---${f.path}---\n${f.content.slice(0, 3500)}`).join('\n')}\nReturn JSON only: {"args":{}}`);
      const result = await tool.run(argsPlan.args || {}, { evolution: true, repositoryContext: context, gapAnalysis });
      outputs.push({ id, type: 'tool', ok: true, output: JSON.stringify(result).slice(0, 8000) });
    } catch (e) {
      outputs.push({ id, type: 'tool', ok: false, error: String(e?.message || e).slice(0, 1000) });
    }
  }
  return outputs;
}
async function historicalReplay(proposals, context, inventory, gapAnalysis) {
  if (!proposals.length) return {};
  const prompt = `You are AiWay's Historical Replay Evaluator. Estimate how often each candidate would have materially improved real engineering outcomes if it had existed earlier. Use repository architecture, capability history, gaps, and existing tools. Penalize novelty, duplicates, one-off UI ideas, and capabilities that are hard to reuse. Reward capabilities that would repeatedly improve planning, code quality, debugging, testing, security, or future self-evolution.\n\nCANDIDATES:\n${JSON.stringify(proposals, null, 2)}\n\nRECENT EVOLUTION HISTORY:\n${JSON.stringify(inventory.catalog.intelligence.evolutionHistory.slice(-20), null, 2)}\n\nCURRENT GAPS:\n${JSON.stringify(gapAnalysis, null, 2)}\n\nREPOSITORY SIGNALS:\n${context.slice(0, 10).map(f => `---${f.path}---\\n${f.content.slice(0, 5000)}`).join('\\n\\n')}\n\nReturn JSON only: {"scores":{"candidate-id":0},"reasons":{"candidate-id":"..."}} where each score is 0-100.`;
  return geminiJson(prompt);
}

async function createProposal(repoInfo, context, research, gapAnalysis, advisorOutputs, inventory) {
  const prompt = `You are AiWay's Capability Strategist. Today is ${new Date().toISOString().slice(0, 10)}.

Goal: propose exactly 5 concrete reusable capabilities for this AI website-building agent. Every proposal must create meaningful end-user value AND/OR materially improve AiWay's future coding ability. Prefer compounding capabilities that make future planning, backend/frontend coding, testing, security, debugging, context management, tool selection, or verification better. Avoid UI-only widgets/pages and novelty features.

IMPORTANT ARCHITECTURE CONSTRAINT: Self-evolution MUST NOT create any new file under api/. New executable tools and skills are embedded into the EXISTING api/ai.js capability registries.

Repository: ${repoInfo.full_name}

CAPABILITY GAPS:
${JSON.stringify(gapAnalysis, null, 2)}

EXISTING CAPABILITIES AND METRICS:
${JSON.stringify(inventory.rows, null, 2)}

ADVISOR OUTPUTS FROM EXISTING CAPABILITIES:
${JSON.stringify(advisorOutputs, null, 2)}

REPOSITORY CONTEXT:
${context.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n')}

WEB RESEARCH:
${research.join('\n\n===== SEARCH =====\n\n')}

For EACH proposal score 0-100 on these exact dimensions: userValue, codingQuality, futureReuse, intelligenceGain, gapFit, reliability, evidenceStrength, security, costEfficiency, maintenanceEase. historicalReplay is NOT scored by you; the server runs a separate replay evaluator. Also include riskLevel and capabilityType. Do NOT calculate the final score; the server calculates it with fixed weights.

Before proposing something, check whether an existing capability already covers it. Prefer strengthening missing parts of a capability chain over duplicates.

Return JSON only:
{"proposals":[{"id":"short-kebab-id","title":"...","problem":"...","evidence":"...","implementation":"...","userValue":0,"codingQuality":0,"futureReuse":0,"intelligenceGain":0,"gapFit":0,"reliability":0,"evidenceStrength":0,"security":0,"costEfficiency":0,"maintenanceEase":0,"riskLevel":"low|medium|high","capabilityType":"skill|tool","compoundingReason":"...","dependsOn":["existing-capability-id"],"futureUnlocks":["..."]}],"selectionReason":"..."}
Never select auth/payment/secrets/governance/self-evolution-engine changes.`;
  return geminiJson(prompt);
}
async function generateCapability(repoInfo, context, proposal, advisorOutputs, gapAnalysis) {
  const aiFile = context.find(x => x.path === AI_FILE)?.content || '';
  const catalog = context.find(x => x.path === CATALOG_FILE)?.content || '{}';
  const prompt = `You are extending AiWay with exactly ONE reusable capability. You are NOT allowed to write complete files or diffs. The server will safely append your small capability definition into existing marker regions of api/ai.js.

SELECTED PROPOSAL:
${JSON.stringify(proposal, null, 2)}

CURRENT CAPABILITY GAPS:
${JSON.stringify(gapAnalysis, null, 2)}

ADVICE / OUTPUT FROM EXISTING AiWay CAPABILITIES:
${JSON.stringify(advisorOutputs, null, 2)}

Use existing capability output as engineering guidance. Compose with existing capabilities where possible; do not duplicate them.

EXISTING api/ai.js (read it carefully so your capability fits existing code):
${aiFile}

EXISTING catalog:
${catalog}

Hard rules:
- capabilityType must be exactly "skill" or "tool".
- Do NOT create any file path. Do NOT return full file contents.
- Never modify imports, exports, handler core, markers, provider logic, auth, secrets, or existing capability entries.
- Add exactly one new capability only.
- id must be unique, lowercase kebab-case.
- Return tags (max 8), domains (max 6), userValue 0-100, selfImprovementValue 0-100.
- For a skill: return markdownContent only; handlerBody must be empty. Markdown should be a reusable operational Skill with YAML frontmatter containing name, description, version.
- For a tool: return JSON Schema in schema and a SMALL JavaScript handlerBody inserted inside an existing async function. It receives args and context.
- For a tool, evolutionSafe=true ONLY if it is strictly read-only/non-destructive and safe for future self-evolution runs. Add evolutionHint explaining when future evolution should use it.
- Tool code may use global fetch/process.env where necessary, but MUST never return, log, expose, enumerate, or echo secrets/environment values.
- Tool code: no import, require, eval, Function constructor, dynamic import, child_process, fs, process.exit, shell commands, filesystem writes, destructive actions, or arbitrary code execution.
- Tool handlerBody MUST return a JSON-serializable result.
- Keep handlerBody under 6000 characters and markdownContent under 12000 characters.
- If the proposal cannot fit these constraints, safeToImplement=false.

Return JSON only:
{"safeToImplement":true,"capability":{"id":"...","capabilityType":"skill|tool","name":"...","description":"...","version":"1.0.0","tags":["..."],"domains":["..."],"userValue":0,"selfImprovementValue":0,"evolutionSafe":false,"evolutionHint":"...","method":"POST","schema":{"type":"object","properties":{}},"markdownContent":"...","handlerBody":"..."},"summary":"...","tests":["..."]}`;
  return geminiJson(prompt);
}

function validateCapability(raw, currentAi) {
  if (!raw || typeof raw !== 'object') throw new Error('Missing capability definition');
  const id = cleanId(raw.id);
  const type = String(raw.capabilityType || '').toLowerCase();
  if (!['skill', 'tool'].includes(type)) throw new Error('Capability type must be skill or tool');
  if (currentAi.includes(`${JSON.stringify(id)}:`)) throw new Error(`Capability already exists: ${id}`);
  const name = String(raw.name || id).slice(0, 120);
  const description = String(raw.description || '').slice(0, 600);
  const version = String(raw.version || '1.0.0').slice(0, 30);
  const tags = Array.isArray(raw.tags) ? raw.tags.map(x => String(x).slice(0, 40)).filter(Boolean).slice(0, 8) : [];
  const domains = Array.isArray(raw.domains) ? raw.domains.map(x => String(x).slice(0, 40)).filter(Boolean).slice(0, 6) : [];
  const userValue = clampScore(raw.userValue);
  const selfImprovementValue = clampScore(raw.selfImprovementValue);
  const evolutionSafe = raw.evolutionSafe === true;
  const evolutionHint = String(raw.evolutionHint || '').slice(0, 500);
  if (type === 'skill') {
    const content = String(raw.markdownContent || '');
    if (!content || content.length > 12_000) throw new Error('Invalid skill content');
    if (/\b(api[_-]?key|secret|token)\s*[:=]\s*["'][^"']+/i.test(content)) throw new Error('Skill appears to contain a secret');
    return { id, type, name, description, version, content, tags, domains, userValue, selfImprovementValue, evolutionSafe: false, evolutionHint: "" };
  }
  const body = String(raw.handlerBody || '').trim();
  if (!body || body.length > 6000) throw new Error('Invalid tool handler body');
  const blocked = [
    /\bimport\s*\(/, /\bimport\s+/, /\brequire\s*\(/, /\beval\s*\(/, /new\s+Function\b/,
    /child_process/i, /\bfs\s*\./, /process\.exit\s*\(/, /exec\s*\(/, /spawn\s*\(/,
    /process\.env\s*\)/, /Object\.(keys|entries|values)\s*\(\s*process\.env/i,
  ];
  if (blocked.some(rx => rx.test(body))) throw new Error('Tool handler contains a blocked code pattern');
  if (!/\breturn\b/.test(body)) throw new Error('Tool handler must return a result');
  const schema = raw.schema && typeof raw.schema === 'object' && !Array.isArray(raw.schema) ? raw.schema : { type: 'object', properties: {} };
  return { id, type, name, description, version, method: 'POST', schema, body, tags, domains, userValue, selfImprovementValue, evolutionSafe, evolutionHint };
}
function insertBeforeMarker(source, marker, snippet) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`Required marker not found: ${marker}`);
  return source.slice(0, at) + snippet + '\n' + source.slice(at);
}
function patchAiFile(current, cap) {
  if (!current.includes(SKILL_START) || !current.includes(SKILL_END) || !current.includes(TOOL_START) || !current.includes(TOOL_END)) {
    throw new Error('api/ai.js capability markers are missing');
  }
  let snippet;
  let next;
  if (cap.type === 'skill') {
    snippet = `  ${JSON.stringify(cap.id)}: {\n    name: ${jsString(cap.name)},\n    description: ${jsString(cap.description)},\n    version: ${jsString(cap.version)},\n    tags: ${jsObject(cap.tags).replace(/\n/g, '\n    ')},\n    domains: ${jsObject(cap.domains).replace(/\n/g, '\n    ')},\n    userValue: ${cap.userValue},\n    selfImprovementValue: ${cap.selfImprovementValue},\n    content: ${jsString(cap.content)},\n  },`;
    next = insertBeforeMarker(current, SKILL_END, snippet);
  } else {
    const indentedBody = cap.body.split('\n').map(line => `      ${line}`).join('\n');
    snippet = `  ${JSON.stringify(cap.id)}: {\n    name: ${jsString(cap.name)},\n    description: ${jsString(cap.description)},\n    method: "POST",\n    tags: ${jsObject(cap.tags).replace(/\n/g, '\n    ')},\n    domains: ${jsObject(cap.domains).replace(/\n/g, '\n    ')},\n    userValue: ${cap.userValue},\n    selfImprovementValue: ${cap.selfImprovementValue},\n    evolutionSafe: ${cap.evolutionSafe ? 'true' : 'false'},\n    evolutionHint: ${jsString(cap.evolutionHint)},\n    schema: ${jsObject(cap.schema).replace(/\n/g, '\n    ')},\n    run: async (args, context) => {\n${indentedBody}\n    },\n  },`;
    next = insertBeforeMarker(current, TOOL_END, snippet);
  }
  // Strong append-only guarantee: the entire old file must survive byte-for-byte.
  // Removing the inserted snippet must produce the exact original file.
  const reconstructed = next.replace(snippet + '\n', '');
  if (reconstructed !== current) throw new Error('Append-only integrity check failed');
  const added = next.length - current.length;
  if (added <= 0 || added > 20_000) throw new Error('Capability patch size is outside safe bounds');
  return next;
}
function patchCatalog(currentText, cap, intelligence = {}) {
  const catalog = parseCatalog(currentText);
  const now = new Date().toISOString();
  if (cap.type === 'skill') {
    if (catalog.skills.some(x => x.id === cap.id)) throw new Error(`Catalog skill already exists: ${cap.id}`);
    catalog.skills.push({
      id: cap.id,
      name: cap.name,
      description: cap.description,
      url: `/api/ai?action=skill&id=${encodeURIComponent(cap.id)}`,
      tags: cap.tags,
      domains: cap.domains,
      userValue: cap.userValue,
      selfImprovementValue: cap.selfImprovementValue,
      addedAt: now,
    });
  } else {
    if (catalog.httpTools.some(x => x.id === cap.id)) throw new Error(`Catalog tool already exists: ${cap.id}`);
    catalog.httpTools.push({
      id: cap.id,
      name: cap.name,
      description: cap.description,
      method: 'POST',
      url: '/api/ai',
      headers: { 'Content-Type': 'application/json' },
      body: '',
      schema: cap.schema,
      permission: 'ask',
      capabilityId: cap.id,
      tags: cap.tags,
      domains: cap.domains,
      userValue: cap.userValue,
      selfImprovementValue: cap.selfImprovementValue,
      evolutionSafe: cap.evolutionSafe === true,
      evolutionHint: cap.evolutionHint || '',
      addedAt: now,
    });
  }

  const metrics = catalog.intelligence.capabilityMetrics;
  for (const advisor of intelligence.advisorOutputs || []) {
    const m = metrics[advisor.id] && typeof metrics[advisor.id] === 'object' ? metrics[advisor.id] : {};
    m.evolutionUses = Number(m.evolutionUses || 0) + 1;
    if (advisor.ok) m.successfulEvolutionUses = Number(m.successfulEvolutionUses || 0) + 1;
    else m.failedEvolutionUses = Number(m.failedEvolutionUses || 0) + 1;
    m.lastUsedAt = now;
    metrics[advisor.id] = m;
  }
  metrics[cap.id] = {
    ...(metrics[cap.id] || {}),
    createdAt: now,
    strategicScore: intelligence.selected?.score ?? null,
    userValue: cap.userValue,
    selfImprovementValue: cap.selfImprovementValue,
    evolutionUses: Number(metrics[cap.id]?.evolutionUses || 0),
    successfulEvolutionUses: Number(metrics[cap.id]?.successfulEvolutionUses || 0),
  };

  catalog.intelligence.gapProfile = intelligence.gapAnalysis?.gapProfile || catalog.intelligence.gapProfile || {};
  catalog.intelligence.lastGapRationale = intelligence.gapAnalysis?.rationale || '';
  catalog.intelligence.lastPriorities = intelligence.gapAnalysis?.priorities || [];
  catalog.intelligence.evolutionHistory.push({
    at: now,
    selectedId: intelligence.selected?.id || cap.id,
    capabilityId: cap.id,
    capabilityType: cap.type,
    score: intelligence.selected?.score ?? null,
    userValue: cap.userValue,
    selfImprovementValue: cap.selfImprovementValue,
    advisors: (intelligence.advisorOutputs || []).map(x => ({ id: x.id, type: x.type, ok: x.ok })),
    weakestGaps: Object.entries(intelligence.gapAnalysis?.gapProfile || {}).sort((a,b) => Number(a[1]) - Number(b[1])).slice(0, 3).map(([k,v]) => ({ key:k, score:v })),
  });
  catalog.intelligence.evolutionHistory = catalog.intelligence.evolutionHistory.slice(-30);
  return JSON.stringify(catalog, null, 2) + '\n';
}

function reportMarkdown(proposalSet, selected, implementation, cap, research) {
  return `# AiWay Evolution Candidate — ${new Date().toISOString().slice(0, 10)}\n\n## Selected improvement\n\n**${selected.title}** (${selected.score}/100, ${selected.riskLevel} risk)\n\n${selected.problem}\n\n### Capability\n- Type: ${cap.type}\n- ID: ${cap.id}\n- Host: existing \`${AI_FILE}\`\n- New API files: **0**\n\n### Why selected\n${proposalSet.selectionReason || ''}\n\n### Implementation summary\n${implementation.summary || ''}\n\n### Suggested verification\n${(implementation.tests || []).map(x => `- ${x}`).join('\n') || '- Verify Vercel Preview before merge.'}\n\n## Safety guarantees\n- No new files are allowed under \`api/\`.\n- The core \`api/ai.js\` file is modified by deterministic marker insertion only.\n- Existing bytes must remain intact; the server verifies append-only integrity before writing.\n- The PR is always created as a draft.\n\n## Daily shortlist\n${(proposalSet.proposals || []).map((x, i) => `${i + 1}. **${x.title}** — ${x.score}/100 — ${x.riskLevel} risk`).join('\n')}\n\n## Research snapshot\n${research.map((x, i) => `### Search ${i + 1}\n\n${x.slice(0, 1800)}`).join('\n\n')}\n`;
}
function authorized(req) {
  const cron = process.env.CRON_SECRET;
  const publish = process.env.PUBLISH_SECRET;
  const auth = String(req.headers.authorization || '');
  const key = String(req.headers['x-aiway-publish-key'] || '');
  return (!!cron && auth === `Bearer ${cron}`) || (!!publish && key === publish);
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET', 'POST'])) return;
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!authorized(req)) return json(res, 401, { ok: false, error: 'Unauthorized evolution request' });
    if (String(process.env.SELF_EVOLVE_ENABLED || 'false').toLowerCase() !== 'true') {
      return json(res, 200, { ok: false, disabled: true, error: 'SELF_EVOLVE_ENABLED is not true' });
    }
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Missing GITHUB_TOKEN');
    const { owner, repo } = parseRepo(process.env.SELF_EVOLVE_REPO || '');
    const repoInfo = await getRepo(token, owner, repo);
    const base = process.env.SELF_EVOLVE_BASE_BRANCH || repoInfo.default_branch || 'main';
    const ref = await getRef(token, owner, repo, base);
    const baseSha = ref.object?.sha;
    if (!baseSha) throw new Error('Could not resolve base branch SHA');

    const context = await loadContext(token, owner, repo, baseSha);
    const aiCurrent = context.find(x => x.path === AI_FILE)?.content;
    const catalogCurrent = context.find(x => x.path === CATALOG_FILE)?.content;
    if (!aiCurrent) throw new Error(`Required existing file missing from context: ${AI_FILE}`);
    if (!catalogCurrent) throw new Error(`Required existing file missing from context: ${CATALOG_FILE}`);

    const inventory = capabilityInventory(catalogCurrent);
    const gapAnalysis = await analyzeCapabilityGaps(repoInfo, context, inventory);
    inventory.catalog.intelligence.gapProfile = gapAnalysis.gapProfile || inventory.catalog.intelligence.gapProfile;

    const advisorPlan = await chooseAdvisors(inventory, gapAnalysis);
    const advisorOutputs = await runAdvisors(inventory, advisorPlan.advisorIds, context, gapAnalysis);

    const research = [];
    for (const q of researchQueries(repo, gapAnalysis.gapProfile || {})) research.push(await jinaSearch(q));
    const proposalSet = await createProposal(repoInfo, context, research, gapAnalysis, advisorOutputs, inventory);
    const rawProposals = Array.isArray(proposalSet.proposals) ? proposalSet.proposals : [];
    const replay = await historicalReplay(rawProposals, context, inventory, gapAnalysis);
    const proposals = rawProposals.map(p => normalizeProposal({
      ...p,
      historicalReplay: clampScore(replay?.scores?.[p.id]),
      historicalReplayReason: replay?.reasons?.[p.id] || '',
    })).sort((a, b) => b.score - a.score);
    const selected = proposals.find(x => ['low', 'medium'].includes(x.riskLevel)) || proposals[0];
    if (!selected) throw new Error('AI did not produce a selectable proposal');
    const minScore = Math.max(60, Math.min(95, Number(process.env.SELF_EVOLVE_MIN_SCORE || 74)));
    if (!['low', 'medium'].includes(selected.riskLevel)) {
      return json(res, 200, { ok: true, implemented: false, reason: 'Top candidate is high risk and requires manual planning', proposals, selected, gapAnalysis, advisors: advisorOutputs });
    }
    if (selected.score < minScore) {
      return json(res, 200, { ok: true, implemented: false, reason: `No candidate reached strategic score threshold ${minScore}`, proposals, selected, gapAnalysis, advisors: advisorOutputs });
    }
    if (selected.userValue < 45 && selected.intelligenceGain < 65 && selected.codingQuality < 65) {
      return json(res, 200, { ok: true, implemented: false, reason: 'Candidate lacks enough direct user value or compounding engineering value', proposals, selected, gapAnalysis, advisors: advisorOutputs });
    }

    const implementation = await generateCapability(repoInfo, context, selected, advisorOutputs, gapAnalysis);
    if (!implementation.safeToImplement) {
      return json(res, 200, { ok: true, implemented: false, reason: 'Coding agent marked the proposal unsafe or incompatible with fixed-API mode', proposals, selected, implementation, gapAnalysis, advisors: advisorOutputs });
    }
    const cap = validateCapability(implementation.capability, aiCurrent);
    const nextAi = patchAiFile(aiCurrent, cap);
    const nextCatalog = patchCatalog(catalogCurrent, cap, { selected, gapAnalysis, advisorOutputs });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const branch = `aiway-evolution/${stamp}-${cleanBranchPart(selected.id || selected.title)}`.slice(0, 120);
    await createBranch(token, owner, repo, branch, baseSha);

    // Only EXISTING files are updated. This code path cannot create an api file.
    await putExistingFile(token, owner, repo, AI_FILE, nextAi, branch, `AiWay Evolution: add ${cap.id} capability`);
    await putExistingFile(token, owner, repo, CATALOG_FILE, nextCatalog, branch, `AiWay Evolution: register ${cap.id} capability`);

    const pr = await createPR(token, owner, repo, {
      title: `[AiWay Evolution] ${selected.title}`,
      head: branch,
      base,
      body: `Automated v10 capability candidate.\n\nStrategic score: **${selected.score}/100**  \nRisk: **${selected.riskLevel}**  \nUser value: **${selected.userValue}/100**  \nCoding quality impact: **${selected.codingQuality}/100**  \nIntelligence gain: **${selected.intelligenceGain}/100**  \nFuture reuse: **${selected.futureReuse}/100**  \nCapability: **${cap.type} / ${cap.id}**  \nNew API files: **0**\n\n${implementation.summary || selected.implementation}\n\nExisting capabilities used as advisors: ${(advisorOutputs || []).map(x => `${x.id}:${x.ok ? 'ok' : 'failed'}`).join(', ') || 'none'}.\n\nThe core API file was changed using append-only marker insertion. This PR is a draft and must be reviewed before merge.`,
    });

    return json(res, 200, {
      ok: true,
      implemented: true,
      repository: repoInfo.html_url,
      base,
      branch,
      pullRequest: { number: pr.number, url: pr.html_url, draft: pr.draft },
      selected,
      proposals,
      capability: { id: cap.id, type: cap.type, name: cap.name, userValue: cap.userValue, selfImprovementValue: cap.selfImprovementValue, evolutionSafe: cap.evolutionSafe },
      intelligence: { gapAnalysis, advisorPlan, advisorOutputs, historicalReplay: { score: selected.historicalReplay, reason: selected.historicalReplayReason }, strategicScore: selected.score, minScore },
      filesChanged: [AI_FILE, CATALOG_FILE],
      apiFilesCreated: 0,
      safety: { appendOnlyCorePatch: true, existingApiFilesOnly: true, strategicScoringServerSide: true, capabilityReuseDuringEvolution: true },
    });
  } catch (error) {
    console.error('evolve-daily', error);
    return json(res, error.status >= 400 && error.status < 600 ? error.status : 500, {
      ok: false,
      error: error.message || 'Evolution run failed',
      details: error.data?.message || undefined,
    });
  }
}
