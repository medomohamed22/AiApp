import crypto from 'node:crypto';

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

export function secureEqual(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length || !left.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function requireAppAccess(req, res) {
  const expected = String(process.env.APP_ACCESS_KEY || '').trim();
  if (!expected) return true;
  const supplied = String(req.headers?.['x-aiway-access-key'] || '');
  if (secureEqual(supplied, expected)) return true;
  json(res, 401, { error: 'App access key is required or invalid.' });
  return false;
}

const RATE_BUCKETS = new Map();
function clientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
}

export function rateLimit(req, res, { key = 'api', limit = 40, windowMs = 60_000 } = {}) {
  const configured = Number(process.env.AIWAY_RATE_LIMIT_PER_MINUTE);
  if (Number.isFinite(configured) && configured <= 0) return true;
  const effectiveLimit = Number.isFinite(configured) && configured > 0 ? Math.min(limit, Math.floor(configured)) : limit;
  const now = Date.now();
  const bucketKey = `${key}:${clientIp(req)}`;
  let bucket = RATE_BUCKETS.get(bucketKey);
  if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  RATE_BUCKETS.set(bucketKey, bucket);
  if (RATE_BUCKETS.size > 5000) {
    for (const [k, v] of RATE_BUCKETS) if (now >= v.resetAt) RATE_BUCKETS.delete(k);
  }
  res.setHeader('X-RateLimit-Limit', String(effectiveLimit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, effectiveLimit - bucket.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count <= effectiveLimit) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
  json(res, 429, { error: 'Too many requests. Try again shortly.' });
  return false;
}

export async function bodyJson(req, maxBytes = 2_000_000) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    let encoded;
    try { encoded = JSON.stringify(req.body); } catch { throw new Error('Request body must be valid JSON'); }
    if (Buffer.byteLength(encoded || '', 'utf8') > maxBytes) throw new Error('Request body is too large');
    return req.body;
  }
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

export function requestAbortSignal(req, res) {
  const controller = new AbortController();
  const abort = () => { if (!controller.signal.aborted) controller.abort(new DOMException('Client disconnected', 'AbortError')); };
  req?.once?.('aborted', abort);
  req?.once?.('close', () => { if (req.aborted) abort(); });
  res?.once?.('close', () => { if (!res.writableEnded) abort(); });
  return controller.signal;
}

export async function pipeFetch(upstream, res, signal) {
  res.statusCode = upstream.status;
  const contentType = upstream.headers.get('content-type');
  if (contentType) res.setHeader('Content-Type', contentType);
  const requestId = upstream.headers.get('x-request-id');
  if (requestId) res.setHeader('X-Upstream-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store, no-transform');
  if (contentType && /text\/event-stream/i.test(contentType)) {
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
  }

  if (!upstream.body) {
    res.end(await upstream.text());
    return;
  }
  const reader = upstream.body.getReader();
  try {
    while (true) {
      if (signal?.aborted || res.destroyed) break;
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    try { reader.releaseLock(); } catch {}
    if (!res.writableEnded && !res.destroyed) res.end();
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
      if (![404, 405, 408, 410, 429, 500, 502, 503, 504].includes(response.status)) return { response, url, attempts };
    } catch (error) {
      attempts.push({ url, error: error?.message || String(error) });
    }
  }
  const last = attempts[attempts.length - 1];
  const detail = last?.status ? `HTTP ${last.status}${last.body ? `: ${last.body}` : ''}` : (last?.error || 'network error');
  throw new Error(`OpenCode Zen unavailable (${detail})`);
}
