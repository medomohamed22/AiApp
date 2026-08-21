export function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function allowMethod(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    json(res, 405, { error: 'Method not allowed' });
    return false;
  }
  return true;
}

export function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing Vercel Environment Variable: ${name}`);
  return value;
}

export function requireAppAccess(req, res) {
  const expected = String(process.env.APP_ACCESS_KEY || '').trim();
  if (!expected) return true;
  const supplied = String(req.headers?.['x-aiway-access-key'] || '');
  if (supplied === expected) return true;
  json(res, 401, { error: 'App access key is required or invalid.' });
  return false;
}

export async function bodyJson(req, maxBytes = 2_000_000) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > maxBytes) throw new Error('Request body is too large');
    return req.body.trim() ? JSON.parse(req.body) : {};
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new Error('Request body is too large');
  }
  return raw.trim() ? JSON.parse(raw) : {};
}

export async function pipeFetch(upstream, res) {
  res.statusCode = upstream.status;
  const contentType = upstream.headers.get('content-type');
  if (contentType) res.setHeader('Content-Type', contentType);
  const requestId = upstream.headers.get('x-request-id');
  if (requestId) res.setHeader('X-Upstream-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store');

  if (!upstream.body) {
    res.end(await upstream.text());
    return;
  }
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}

export function openCodeBaseUrls() {
  const configured = String(process.env.OPENCODE_BASE_URL || '').trim().replace(/\/+$/, '');
  const current = 'https://opencode.ai/zen/v1';
  const urls = configured ? [configured, current] : [current];
  return [...new Set(urls.map(v => v.replace(/\/+$/, '')).filter(Boolean))];
}

export async function fetchOpenCode(path, init = {}) {
  const attempts = [];
  const suffix = String(path || '').startsWith('/') ? String(path) : `/${path}`;
  for (const base of openCodeBaseUrls()) {
    const url = `${base}${suffix}`;
    try {
      const response = await fetch(url, init);
      if (response.ok) return { response, url, attempts };
      const body = await response.clone().text().catch(() => '');
      attempts.push({ url, status: response.status, body: body.replace(/\s+/g, ' ').slice(0, 300) });
      if (![404, 405, 408, 410, 429, 500, 502, 503, 504].includes(response.status)) {
        return { response, url, attempts };
      }
    } catch (error) {
      attempts.push({ url, error: error?.message || String(error) });
    }
  }
  const last = attempts[attempts.length - 1];
  const detail = last?.status
    ? `HTTP ${last.status}${last.body ? `: ${last.body}` : ''}`
    : (last?.error || 'network error');
  throw new Error(`OpenCode Zen unavailable (${detail})`);
}
