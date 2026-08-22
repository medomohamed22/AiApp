import { allowMethod, bodyJson, env, json, pipeFetch, requireAppAccess, rateLimit, requestAbortSignal } from './_utils.js';
import { proxyOpenCode, proxyHermesRun } from './_provider_adapters.js';

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
  const signal = requestAbortSignal(req, res);
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
        signal,
      });
    } else if (provider === 'opencode') {
      const result = await proxyOpenCode(payload, res, signal);
      res.setHeader('X-AiWay-OpenCode-Gateway', new URL(result.url).host);
      res.setHeader('X-AiWay-OpenCode-API', result.protocol);
      if (result.normalized) return;
      upstream = result.upstream;
    } else if (provider === 'hermes' && (!String(process.env.HERMES_BASE_URL || '').trim() || !String(process.env.HERMES_API_KEY || '').trim())) {
      const missing = ['HERMES_BASE_URL', 'HERMES_API_KEY'].filter(name => !String(process.env[name] || '').trim());
      return json(res, 503, {
        error: {
          code: 'HERMES_NOT_CONFIGURED',
          message: `Hermes غير مُعد على نسخة Vercel الحالية. أضف ${missing.join(' و ')} في Vercel Environment Variables. HERMES_BASE_URL لازم يكون عنوان Hermes Gateway يمكن لـVercel الوصول إليه عبر HTTP/HTTPS، وليس localhost أو 127.0.0.1.`
        }
      });
    } else if (provider === 'hermes' && payload?.aiway_native_run === true) {
      const nextPayload = structuredClone(payload);
      delete nextPayload.aiway_native_run;
      await proxyHermesRun({ payload: nextPayload, sessionId: req.headers?.['x-aiway-chat-id'], signal }, res);
      return;
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
          ...(req.headers?.['x-aiway-chat-id'] ? { 'X-Hermes-Session-Id': String(req.headers['x-aiway-chat-id']).slice(0, 256) } : {}),
        },
        body: JSON.stringify(nextPayload),
        signal,
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
        signal,
      });
    } else {
      return json(res, 400, { error: 'Unsupported provider' });
    }

    await pipeFetch(upstream, res, signal);
  } catch (error) {
    if (signal.aborted || error?.name === 'AbortError') {
      if (!res.headersSent && !res.writableEnded && !res.destroyed) json(res, 499, { error: 'Request cancelled by client' });
      return;
    }
    const message = error?.message || 'Server error';
    if (!res.writableEnded && !res.destroyed) json(res, 500, { error: message });
  }
}
