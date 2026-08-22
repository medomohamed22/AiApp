import { allowMethod, bodyJson, env, json, pipeFetch, fetchOpenCode, requireAppAccess, rateLimit } from './_utils.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function cleanHermesBase(raw) {
  const parsed = new URL(String(raw || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('HERMES_BASE_URL must use http or https');
  return parsed.toString().replace(/\/+$/, '');
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['POST'])) return;
  if (!requireAppAccess(req, res)) return;
  if (!rateLimit(req, res, { key: 'ai', limit: 30 })) return;
  try {
    const { provider, model, payload } = await bodyJson(req);
    if (!provider || !payload || typeof payload !== 'object') {
      return json(res, 400, { error: 'provider and payload are required' });
    }

    let upstream;
    if (provider === 'openrouter') {
      upstream = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env('OPENROUTER_API_KEY')}`,
          'HTTP-Referer': process.env.APP_URL || 'https://aiway.vercel.app',
          'X-Title': 'AiWay',
        },
        body: JSON.stringify(payload),
      });
    } else if (provider === 'opencode') {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (process.env.OPENCODE_API_KEY) headers.Authorization = `Bearer ${process.env.OPENCODE_API_KEY}`;
      const result = await fetchOpenCode('/chat/completions', {
        method: 'POST', headers, body: JSON.stringify(payload), cache: 'no-store',
      });
      upstream = result.response;
      res.setHeader('X-AiWay-OpenCode-Gateway', new URL(result.url).host);
      res.setHeader('X-AiWay-OpenCode-API', 'zen-v1');
    } else if (provider === 'hermes') {
      const base = cleanHermesBase(env('HERMES_BASE_URL'));
      const chatBase = base.endsWith('/v1') ? base : `${base}/v1`;
      const nextPayload = structuredClone(payload);
      const encoded = String(nextPayload.model || '');
      if (encoded.includes('::')) {
        const [hermesProvider, ...rest] = encoded.split('::');
        nextPayload.model = rest.join('::');
        nextPayload.provider = hermesProvider;
      }
      upstream = await fetch(`${chatBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env('HERMES_API_KEY')}`,
        },
        body: JSON.stringify(nextPayload),
      });
    } else if (provider === 'gemini') {
      if (!model) return json(res, 400, { error: 'model is required for Gemini' });
      upstream = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env('GEMINI_API_KEY'),
        },
        body: JSON.stringify(payload),
      });
    } else {
      return json(res, 400, { error: 'Unsupported provider' });
    }

    await pipeFetch(upstream, res);
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Upstream request timed out' : (error?.message || 'Server error');
    json(res, 500, { error: message });
  }
}
