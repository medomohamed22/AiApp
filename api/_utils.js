export function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
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

export async function pipeFetch(upstream, res) {
  res.statusCode = upstream.status;
  const contentType = upstream.headers.get('content-type');
  if (contentType) res.setHeader('Content-Type', contentType);
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
  // OpenCode Zen is the current public gateway. Legacy /inference/openai/v1
  // endpoints have returned 404/410 in production, so they are intentionally
  // not used as fallbacks anymore.
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

      // A custom OPENCODE_BASE_URL may be stale. Only fall through to the
      // built-in Zen endpoint for routing/retirement/upstream failures.
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
