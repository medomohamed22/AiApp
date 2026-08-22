import dns from 'node:dns/promises';
import net from 'node:net';
import { allowMethod, bodyJson, json, rateLimit, requireAppAccess, requestAbortSignal } from './_utils.js';

const MAX_RESPONSE_BYTES = 1_250_000;

const SANDBOX_MAX_FILE_BYTES = 700_000;
const SANDBOX_MAX_SYNC_BYTES = 850_000;
const SANDBOX_COMMAND_LIMIT = 12_000;

function sandboxName(projectId = "") {
  const clean = String(projectId || "default").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "default";
  let h = 2166136261;
  for (const ch of String(projectId || "default")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `aiway-${clean}-${(h >>> 0).toString(36)}`.slice(0, 63);
}
function sandboxPath(path = "") {
  const parts = [];
  for (const bit of String(path || "").replace(/\\/g, "/").split("/")) {
    if (!bit || bit === ".") continue;
    if (bit === "..") { parts.pop(); continue; }
    parts.push(bit.replace(/[\0\r\n]/g, "").slice(0, 160));
  }
  const out = parts.join("/");
  if (!out || out.length > 500) throw new Error("Invalid sandbox path");
  return out;
}
async function streamTextValue(value) {
  if (typeof value === "string") return value;
  if (typeof value === "function") return String(await value());
  if (value && typeof value.text === "function") return String(await value.text());
  return String(value || "");
}
async function getSandbox(projectId) {
  let Sandbox;
  try { ({ Sandbox } = await import('@vercel/sandbox')); }
  catch { throw new Error('Vercel Sandbox SDK is unavailable. Run npm install and deploy again.'); }
  const name = sandboxName(projectId);
  return await Sandbox.getOrCreate({
    name, runtime: 'node24', persistent: true, timeout: 5 * 60 * 1000,
    onCreate: async (sbx) => { await sbx.runCommand('mkdir', ['-p', '/workspace']); }
  });
}
async function sandboxAction(payload) {
  const projectId = String(payload.projectId || '').trim();
  if (!projectId || projectId.length > 120) throw new Error('projectId is required');
  const op = String(payload.op || 'status');
  const sbx = await getSandbox(projectId);
  if (op === 'status') return { ok: true, name: sbx.name || sandboxName(projectId), sandboxId: sbx.sandboxId || sbx.id || '', status: sbx.status || 'ready', persistent: true };
  if (op === 'sync') {
    const files = Array.isArray(payload.files) ? payload.files.slice(0, 120) : [];
    let total = 0;
    const writes = [];
    for (const file of files) {
      const path = sandboxPath(file?.path);
      const content = String(file?.content ?? '');
      const size = Buffer.byteLength(content);
      if (size > SANDBOX_MAX_FILE_BYTES) throw new Error(`Sandbox file too large: ${path}`);
      total += size; if (total > SANDBOX_MAX_SYNC_BYTES) throw new Error('Sandbox sync batch exceeds safe request limit');
      writes.push({ path: `/workspace/${path}`, content: Buffer.from(content, 'utf8') });
    }
    if (writes.length) await sbx.writeFiles(writes);
    if (Array.isArray(payload.manifest)) {
      const current = [...new Set(payload.manifest.slice(0, 500).map(sandboxPath))];
      let previous = [];
      try { const old = await sbx.readFileToBuffer({ path: '/workspace/.aiway-sync-manifest.json' }); previous = JSON.parse(old?.toString('utf8') || '[]'); } catch {}
      const keep = new Set(current);
      for (const oldPath of Array.isArray(previous) ? previous : []) {
        let safe; try { safe = sandboxPath(oldPath); } catch { continue; }
        if (!keep.has(safe)) try { await sbx.runCommand('rm', ['-f', `/workspace/${safe}`]); } catch {}
      }
      await sbx.writeFiles([{ path: '/workspace/.aiway-sync-manifest.json', content: Buffer.from(JSON.stringify(current), 'utf8') }]);
    }
    return { ok: true, name: sbx.name || sandboxName(projectId), files: writes.length, bytes: total };
  }
  if (op === 'write') {
    const path = sandboxPath(payload.path), content = String(payload.content ?? '');
    if (Buffer.byteLength(content) > SANDBOX_MAX_FILE_BYTES) throw new Error('Sandbox file exceeds safe size limit');
    await sbx.writeFiles([{ path: `/workspace/${path}`, content: Buffer.from(content, 'utf8') }]);
    return { ok: true, path, bytes: Buffer.byteLength(content) };
  }
  if (op === 'read') {
    const path = sandboxPath(payload.path);
    const buf = await sbx.readFileToBuffer({ path: `/workspace/${path}` });
    if (!buf) throw new Error('Sandbox file not found');
    if (buf.length > SANDBOX_MAX_FILE_BYTES) throw new Error('Sandbox file exceeds readable size limit');
    return { ok: true, path, content: buf.toString('utf8'), bytes: buf.length };
  }
  if (op === 'exec') {
    const command = String(payload.command || '').trim();
    if (!command || command.length > SANDBOX_COMMAND_LIMIT) throw new Error('Sandbox command is empty or too long');
    const allowNetwork = payload.allowNetwork === true;
    try { await sbx.update({ networkPolicy: allowNetwork ? 'allow-all' : 'deny-all' }); } catch {}
    let result;
    try { result = await sbx.runCommand('bash', ['-lc', `cd /workspace && ${command}`]); }
    finally { if (allowNetwork) try { await sbx.update({ networkPolicy: 'deny-all' }); } catch {} }
    const stdout = (await streamTextValue(result?.stdout)).slice(0, 250_000);
    const stderr = (await streamTextValue(result?.stderr)).slice(0, 120_000);
    return { ok: Number(result?.exitCode || 0) === 0, exitCode: Number(result?.exitCode || 0), stdout, stderr, sandbox: sbx.name || sandboxName(projectId), persistent: true };
  }
  if (op === 'stop') { const meta = await sbx.stop(); return { ok: true, stopped: true, snapshotId: meta?.snapshotId || meta?.snapshot?.snapshotId || '' }; }
  if (op === 'delete') {
    await sbx.delete();
    return { ok: true, deleted: true };
  }
  throw new Error('Unsupported sandbox operation');
}
const SAFE_METHODS = new Set(['GET', 'HEAD', 'POST']);

function isPrivateIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      p[0] >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') ||
      x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb') ||
      x.startsWith('ff') || x.startsWith('2001:db8:');
  }
  return true;
}

async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch { throw new Error('Invalid URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http/https URLs are allowed');
  if (u.username || u.password) throw new Error('Credentials in URLs are not allowed');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Private hosts are blocked');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Private IP addresses are blocked');
  } else {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!records.length || records.some(r => isPrivateIp(r.address))) throw new Error('Host resolves to a private or unsafe address');
  }
  return u;
}

function safeHeaders(input = {}) {
  const out = {};
  const allowed = new Set(['accept', 'content-type', 'authorization', 'x-api-key', 'mcp-protocol-version', 'mcp-session-id', 'mcp-method', 'mcp-name']);
  const blocked = new Set(['host', 'cookie', 'set-cookie', 'connection', 'content-length', 'transfer-encoding', 'proxy-authorization', 'proxy-authenticate', 'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']);
  for (const [k, v] of Object.entries(input || {})) {
    const key = String(k).toLowerCase();
    if (blocked.has(key) || typeof v !== 'string' || v.length > 8000) continue;
    if (allowed.has(key) || /^x-[a-z0-9-]{1,80}$/.test(key)) out[k] = v;
  }
  return out;
}

async function readLimited(response, maxBytes = MAX_RESPONSE_BYTES) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Remote response exceeded safe size limit');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally { try { reader.releaseLock(); } catch {} }
}

async function safeFetch(rawUrl, init, signal, redirects = 4) {
  let url = await assertPublicUrl(rawUrl);
  for (let i = 0; i <= redirects; i++) {
    const response = await fetch(url, { ...init, signal, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (i === redirects) throw new Error('Too many redirects');
      const location = response.headers.get('location');
      if (!location) return { response, url };
      url = await assertPublicUrl(new URL(location, url).toString());
      if (response.status === 303) init = { ...init, method: 'GET', body: undefined };
      continue;
    }
    return { response, url };
  }
  throw new Error('Redirect failure');
}

function decodeEntities(s = '') {
  return s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number(n) || 32)));
}
function stripHtml(html = '') {
  return decodeEntities(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
}
function extractLinks(html, base) {
  const links = []; const re = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && links.length < 80) {
    const href = m[1] ?? m[2] ?? m[3] ?? '';
    try {
      const u = new URL(href, base);
      if (!['http:', 'https:'].includes(u.protocol)) continue;
      links.push({ index: links.length + 1, text: stripHtml(m[4]).slice(0, 180) || u.hostname, url: u.toString() });
    } catch {}
  }
  return links;
}
function pageSnapshot(html, url) {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1]).replace(/\s+/g, ' ').trim().slice(0, 300);
  const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].slice(0, 40).map(m => ({ level: Number(m[1]), text: stripHtml(m[2]).slice(0, 240) }));
  const links = extractLinks(html, url);
  const text = stripHtml(html).slice(0, 50_000);
  return { url: String(url), title, headings, links, text };
}

async function browserAction(payload, signal) {
  const method = String(payload.method || 'GET').toUpperCase();
  if (!SAFE_METHODS.has(method)) throw new Error('Browser method is not allowed');
  const headers = safeHeaders(payload.headers || {});
  delete headers.Authorization; delete headers.authorization; delete headers['x-api-key'];
  const init = { method, headers: { 'User-Agent': 'AiWay-Agent/2.0', 'Accept': 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5', ...headers } };
  if (method === 'POST') {
    const body = String(payload.body || '');
    if (Buffer.byteLength(body) > 100_000) throw new Error('Form body is too large');
    init.body = body;
  }
  const { response, url } = await safeFetch(payload.url, init, signal);
  const contentType = response.headers.get('content-type') || '';
  const text = await readLimited(response);
  if (!response.ok) throw new Error(`Remote HTTP ${response.status}: ${stripHtml(text).slice(0, 300)}`);
  if (/html|xhtml/i.test(contentType) || /<html|<!doctype/i.test(text.slice(0, 300))) return { ok: true, status: response.status, contentType, ...pageSnapshot(text, url) };
  return { ok: true, status: response.status, contentType, url: url.toString(), title: '', headings: [], links: [], text: text.slice(0, 50_000) };
}

async function mcpProxy(payload, signal) {
  await assertPublicUrl(payload.url);
  const method = String(payload.method || 'POST').toUpperCase();
  if (method !== 'POST') throw new Error('MCP proxy only supports POST');
  const body = typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body || {});
  if (Buffer.byteLength(body) > 750_000) throw new Error('MCP request is too large');
  const { response, url } = await safeFetch(payload.url, { method: 'POST', headers: safeHeaders(payload.headers || {}), body }, signal, 2);
  const text = await readLimited(response);
  return { ok: response.ok, status: response.status, url: url.toString(), contentType: response.headers.get('content-type') || '', sessionId: response.headers.get('mcp-session-id') || '', text };
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['POST'])) return;
  if (!requireAppAccess(req, res)) return;
  if (!rateLimit(req, res, { key: 'agent', limit: 45 })) return;
  const signal = requestAbortSignal(req, res);
  try {
    const payload = await bodyJson(req, 2_000_000);
    const action = String(payload.action || '');
    if (action === 'browser') return json(res, 200, await browserAction(payload, signal));
    if (action === 'mcp') return json(res, 200, await mcpProxy(payload, signal));
    if (action === 'sandbox') return json(res, 200, await sandboxAction(payload));
    return json(res, 400, { error: 'Unsupported agent action' });
  } catch (error) {
    if (signal.aborted || error?.name === 'AbortError') return !res.writableEnded && json(res, 499, { error: 'Request cancelled' });
    return json(res, 400, { error: error?.message || 'Agent gateway error' });
  }
}
