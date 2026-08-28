/**
 * AI provider proxy route.
 *
 * Streams requests to supported model providers. Preserve provider isolation, cancellation, secret handling, and protocol-specific payload behavior.
 *
 * MAINTAINER / AI CONTRACT:
 * - Read AGENTS.md and docs/AI-DEVELOPER-CONTRACT.md before changing behavior.
 * - Preserve existing features unless the request explicitly removes or changes them.
 * - Keep the Vercel /api JavaScript-file budget at 12 or fewer; shared helpers belong in /lib.
 * - New features must integrate with existing security, streaming, permissions, responsive UI, and tests.
 * - Run npm test before considering a change complete.
 */

import { allowMethod, bodyJson, env, json, pipeFetch, requireAppAccess, rateLimit, requestAbortSignal } from '../lib/utils.js';
import { applyBaiReasoningPayload, proxyOpenCode, proxyHermesRun, reasoningPolicy } from '../lib/provider-adapters.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const BAI_URL = 'https://api.b.ai/v1/chat/completions';
const NEW_API_URL = 'https://api.justwoker.icu/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';



function sanitizeContextEnvelope(payload = {}) {
  const next = structuredClone(payload);
  // Context ownership lives in the active browser chat. Never accept side-channel
  // workspace/project/memory bundles that could silently inflate provider prompts.
  for (const key of ['project_context', 'workspace_context', 'memory_context', 'artifact_context', 'artifacts', 'other_chats', 'conversations']) {
    delete next[key];
  }
  delete next.aiway_context_scope;
  return next;
}

function sanitizeChatMessages(payload = {}) {
  const next = structuredClone(payload);
  if (!Array.isArray(next.messages)) return next;
  // Provider requests may contain only the explicit chat transcript plus tool-result
  // messages created during this run. Never forward browser/workspace metadata hidden
  // inside arbitrary message fields.
  next.messages = next.messages.slice(-120).map((message = {}) => {
    const role = ['system', 'user', 'assistant', 'tool'].includes(message.role) ? message.role : 'user';
    const clean = { role, content: message.content ?? '' };
    if (role === 'assistant' && Array.isArray(message.tool_calls)) clean.tool_calls = message.tool_calls;
    if (role === 'tool' && message.tool_call_id) clean.tool_call_id = String(message.tool_call_id);
    if (message.name) clean.name = String(message.name);
    return clean;
  });
  return next;
}

async function rejectUnexpectedHtml(upstream, res, providerLabel = 'AI provider') {
  const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) return false;

  // API gateways/CDNs occasionally answer with an HTML error document (or a
  // challenge page). Never stream that document into the chat UI. Keep the
  // upstream body private and return a stable JSON error instead.
  const status = upstream.status || 502;
  const redirected = Boolean(upstream.redirected);
  const upstreamUrl = (() => {
    try { return new URL(upstream.url).host; } catch { return ''; }
  })();
  return json(res, 502, {
    error: {
      code: 'UPSTREAM_HTML_RESPONSE',
      message: `${providerLabel} رجّع صفحة HTML بدل استجابة API. تحقق من عنوان الـAPI والمفتاح أو حالة المزود ثم جرّب مرة أخرى.`,
      upstream_status: status,
      ...(redirected ? { redirected: true } : {}),
      ...(upstreamUrl ? { upstream_host: upstreamUrl } : {}),
    },
  });
}

function normalizeReasoningLevel(value) {
  const level = String(value || 'off').toLowerCase();
  return ['off', 'low', 'medium', 'high', 'xhigh'].includes(level) ? level : 'off';
}

function applyOpenRouterReasoning(payload = {}) {
  const next = structuredClone(payload);
  const level = normalizeReasoningLevel(next.aiway_reasoning_level);
  delete next.aiway_reasoning_level;
  next.reasoning = level === 'off'
    ? { enabled: false, exclude: true }
    : { enabled: true, effort: level, exclude: true };
  return next;
}

function applyGeminiReasoning(payload = {}, model = '') {
  const next = structuredClone(payload);
  const level = normalizeReasoningLevel(next.aiway_reasoning_level);
  delete next.aiway_reasoning_level;
  const id = String(model || '').toLowerCase();
  next.generationConfig = { ...(next.generationConfig || {}) };
  if (id.startsWith('gemini-2.5')) {
    if (level === 'off') {
      if (!id.includes('pro')) next.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    } else {
      const budgets = { low: 1024, medium: 8192, high: 24576, xhigh: 32768 };
      next.generationConfig.thinkingConfig = { thinkingBudget: budgets[level] };
    }
  } else if (/^gemini-(?:[3-9]|1\d)/.test(id)) {
    const thinkingLevel = level === 'off' ? (id.includes('pro') ? 'LOW' : 'MINIMAL') : (level === 'xhigh' ? 'HIGH' : level.toUpperCase());
    next.generationConfig.thinkingConfig = { thinkingLevel };
  }
  return next;
}

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
    const scopedPayload = sanitizeChatMessages(sanitizeContextEnvelope(payload));

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
        body: JSON.stringify(applyOpenRouterReasoning(scopedPayload)),
        signal,
      });
    } else if (provider === 'bai') {
      upstream = await fetch(BAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env('BAI_API_KEY')}`,
        },
        body: JSON.stringify(applyBaiReasoningPayload(scopedPayload)),
        signal,
      });
    } else if (provider === 'newapi') {
      const nextPayload = structuredClone(scopedPayload);
      // AiWay-only UI metadata must never leak to OpenAI-compatible upstreams.
      delete nextPayload.aiway_reasoning_level;
      upstream = await fetch(NEW_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json',
          'Authorization': `Bearer ${env('NEW_API_KEY')}`,
          'User-Agent': 'AiWay-Vercel/1.0',
        },
        body: JSON.stringify(nextPayload),
        signal,
      });
      if (await rejectUnexpectedHtml(upstream, res, 'New API')) return;
    } else if (provider === 'opencode') {
      const result = await proxyOpenCode(scopedPayload, res, signal);
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
      const nextPayload = structuredClone(scopedPayload);
      delete nextPayload.aiway_native_run;
      await proxyHermesRun({ payload: nextPayload, sessionId: req.headers?.['x-aiway-chat-id'], signal }, res);
      return;
    } else if (provider === 'hermes') {
      const base = cleanHermesBase(env('HERMES_BASE_URL'));
      const chatBase = base.endsWith('/v1') ? base : `${base}/v1`;
      const nextPayload = structuredClone(scopedPayload);
      const uiReasoningLevel = normalizeReasoningLevel(nextPayload.aiway_reasoning_level);
      delete nextPayload.aiway_reasoning_level;
      const encoded = String(nextPayload.model || '');
      let hermesProvider = 'hermes';
      if (encoded.includes('::')) {
        const [selectedProvider, ...rest] = encoded.split('::');
        hermesProvider = selectedProvider;
        nextPayload.model = rest.join('::');
        nextPayload.provider = hermesProvider;
      }
      const rp = reasoningPolicy(hermesProvider, nextPayload.model, uiReasoningLevel);
      nextPayload.reasoning_effort = rp.effort || (rp.enabled ? 'high' : 'none');
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
        body: JSON.stringify(applyGeminiReasoning(scopedPayload, model)),
        signal,
      });
    } else {
      return json(res, 400, { error: 'Unsupported provider' });
    }

    if (!upstream.ok) {
      const status = upstream.status || 502;
      const raw = await upstream.clone().text().catch(() => '');
      if (!String(raw || '').trim()) {
        const message = status === 429
          ? 'مزود النموذج رفض الطلب بسبب Rate Limit (HTTP 429). قلّل عدد جولات الـAgent أو انتظر قليلًا ثم أعد المحاولة.'
          : status === 413
            ? 'حجم طلب النموذج كبير جدًا على بوابة المزود (HTTP 413). تم تفعيل ضغط السياق في العميل؛ قلّل المرفقات أو أعد المحاولة.'
            : `مزود النموذج رجّع HTTP ${status} بدون تفاصيل. هذا خطأ upstream وليس خطأ عرض في AiWay.`;
        return json(res, status, { error: { code: 'UPSTREAM_EMPTY_ERROR', message, upstream_status: status } });
      }
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
