/**
 * Provider model discovery route.
 *
 * Normalizes model catalogs/capabilities. Provider limits are informational and must never overwrite user token/context settings.
 *
 * MAINTAINER / AI CONTRACT:
 * - Read AGENTS.md and docs/AI-DEVELOPER-CONTRACT.md before changing behavior.
 * - Preserve existing features unless the request explicitly removes or changes them.
 * - Keep the Vercel /api JavaScript-file budget at 12 or fewer; shared helpers belong in /lib.
 * - New features must integrate with existing security, streaming, permissions, responsive UI, and tests.
 * - Run npm test before considering a change complete.
 */

import { allowMethod, env, json, fetchOpenCode, requireAppAccess, rateLimit } from '../lib/utils.js';
import { openCodeProtocol, hermesCapabilities } from '../lib/provider-adapters.js';

function pricingNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.eE+-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function classifyPricing(id, pricing) {
  const name = String(id || '').toLowerCase();
  if (pricing?.free === true || /(^|[/:._-])free($|[/:._-])/.test(name)) return 'free';
  const values = [];
  if (pricing && typeof pricing === 'object') {
    for (const key of ['prompt', 'completion', 'input', 'output', 'request', 'image', 'web_search']) {
      const n = pricingNumber(pricing[key]);
      if (n !== null) values.push(n);
    }
  }
  if (values.length && values.every(v => v === 0)) return 'free';
  if (values.some(v => v > 0)) return 'paid';
  return 'unknown';
}

function normalizeBaseUrl(value, fallback = '') {
  const raw = String(value || fallback).trim().replace(/\/+$/, '');
  if (!raw) return '';
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Base URL must use http or https');
  return url.toString().replace(/\/+$/, '');
}

function positiveInt(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return null;
}

function modelLimits(item = {}) {
  const top = item?.top_provider || item?.topProvider || {};
  const limits = item?.limits || item?.limit || {};
  const contextWindow = positiveInt(
    item?.context_length, item?.contextLength, item?.context_window, item?.contextWindow,
    item?.inputTokenLimit, item?.input_token_limit, item?.max_input_tokens, item?.maxInputTokens,
    limits?.context, limits?.contextWindow, limits?.input, limits?.inputTokens
  );
  const maxOutputTokens = positiveInt(
    item?.max_completion_tokens, item?.maxCompletionTokens, item?.max_output_tokens, item?.maxOutputTokens,
    item?.outputTokenLimit, item?.output_token_limit, top?.max_completion_tokens, top?.maxCompletionTokens,
    limits?.output, limits?.outputTokens, limits?.completion
  );
  const providerLimitsDeclared = Boolean(positiveInt(
    top?.max_completion_tokens, top?.maxCompletionTokens,
    limits?.context, limits?.contextWindow, limits?.input, limits?.inputTokens,
    limits?.output, limits?.outputTokens, limits?.completion
  ));
  return { contextWindow, maxOutputTokens, providerLimitsDeclared };
}

function modelDetailsFromOpenAI(data = [], provider) {
  return (Array.isArray(data) ? data : []).map(item => {
    const id = String(item?.id || item?.name || '').trim();
    if (!id) return null;
    const pricing = item?.pricing || item?.price || null;
    return {
      id,
      label: id,
      provider,
      tier: classifyPricing(id, pricing),
      pricing,
      ...modelLimits(item),
    };
  }).filter(Boolean);
}

function hermesDetails(payload) {
  const rows = payload?.providers || payload?.rows || payload?.data || payload?.options || payload;
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const slug = String(row.slug || row.provider || row.id || row.name || '').trim();
    const models = Array.isArray(row.models) ? row.models : [];
    const pricingMap = row.pricing && typeof row.pricing === 'object' ? row.pricing : {};
    const unavailable = new Set(Array.isArray(row.unavailable_models) ? row.unavailable_models.map(String) : []);
    for (const model of models) {
      const rawId = typeof model === 'string' ? model : model?.id || model?.model || model?.name;
      const modelId = String(rawId || '').trim();
      if (!modelId) continue;
      const pricing = pricingMap[modelId] || (typeof model === 'object' ? model.pricing : null) || null;
      let tier = classifyPricing(modelId, pricing);
      if (unavailable.has(modelId)) tier = 'paid';
      const id = slug ? `${slug}::${modelId}` : modelId;
      out.push({
        id,
        label: slug ? `${modelId} · ${slug}` : modelId,
        provider: 'hermes',
        upstreamProvider: slug || null,
        upstreamModel: modelId,
        tier,
        pricing,
        unavailable: unavailable.has(modelId),
        ...modelLimits(typeof model === 'object' ? model : {}),
      });
    }
  }
  return out;
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  if (!requireAppAccess(req, res)) return;
  if (!rateLimit(req, res, { key: 'models', limit: 60 })) return;
  try {
    const provider = String(req.query?.provider || 'gemini').toLowerCase();
    let details = [];
    let capabilities = null;

    if (provider === 'gemini') {
      const key = env('GEMINI_API_KEY');
      let pageToken = '';
      do {
        const qs = new URLSearchParams({ pageSize: '1000' });
        if (pageToken) qs.set('pageToken', pageToken);
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?${qs}`, { headers: { 'x-goog-api-key': key } });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error?.message || `Gemini HTTP ${r.status}`);
        details.push(...(d.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => ({
            id: String(m.name || '').replace(/^models\//, ''),
            label: m.displayName || String(m.name || '').replace(/^models\//, ''),
            provider: 'gemini',
            tier: 'unknown',
            pricing: null,
            contextWindow: positiveInt(m.inputTokenLimit, m.input_token_limit),
            maxOutputTokens: positiveInt(m.outputTokenLimit, m.output_token_limit),
            providerLimitsDeclared: Boolean(positiveInt(m.inputTokenLimit, m.input_token_limit, m.outputTokenLimit, m.output_token_limit)),
          }))
          .filter(m => m.id));
        pageToken = d.nextPageToken || '';
      } while (pageToken);
    } else if (provider === 'openrouter') {
      const r = await fetch('https://openrouter.ai/api/v1/models?limit=1000', {
        headers: { Authorization: `Bearer ${env('OPENROUTER_API_KEY')}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `OpenRouter HTTP ${r.status}`);
      details = modelDetailsFromOpenAI(d.data, 'openrouter');
    } else if (provider === 'bai') {
      const r = await fetch('https://api.b.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${env('BAI_API_KEY')}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message || d?.message || `B.ai HTTP ${r.status}`);
      details = modelDetailsFromOpenAI(d.data || d.models || d, 'bai');
      if (!details.length) throw new Error('B.ai returned an empty model catalog. You can still type a model ID manually.');
    } else if (provider === 'newapi') {
      const r = await fetch('https://api.justwoker.icu/v1/models', {
        headers: {
          Authorization: `Bearer ${env('NEW_API_KEY')}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });
      const raw = await r.text();
      let d = null;
      try { d = raw ? JSON.parse(raw) : null; } catch {}
      if (!r.ok) throw new Error(d?.error?.message || d?.error || d?.message || raw.slice(0, 220) || `New API HTTP ${r.status}`);
      if (!d) throw new Error('New API returned an empty models response');
      details = modelDetailsFromOpenAI(d.data || d.models || d, 'newapi');
      if (!details.length) throw new Error('New API returned an empty model catalog. You can still type a model ID manually.');
    } else if (provider === 'opencode') {
      const headers = {
        Accept: 'application/json',
        'User-Agent': 'AiWay-Vercel/1.1',
      };
      if (process.env.OPENCODE_API_KEY) headers.Authorization = `Bearer ${process.env.OPENCODE_API_KEY}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let r;
      let raw = '';
      let resolvedUrl = '';
      try {
        const result = await fetchOpenCode('/models', {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });
        r = result.response;
        resolvedUrl = result.url;
        raw = await r.text();
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('OpenCode models request timed out after 12 seconds');
        throw new Error(error?.message || `OpenCode network error: ${error}`);
      } finally {
        clearTimeout(timeout);
      }

      let d = null;
      if (raw.trim()) {
        try { d = JSON.parse(raw); }
        catch {
          const sample = raw.replace(/\s+/g, ' ').slice(0, 220);
          throw new Error(`OpenCode returned non-JSON response (HTTP ${r.status}) from ${resolvedUrl}: ${sample || 'empty body'}`);
        }
      }
      if (!r.ok) {
        const message = d?.error?.message || d?.error || d?.message || raw.slice(0, 220) || `HTTP ${r.status}`;
        throw new Error(`OpenCode models failed via ${resolvedUrl}: ${message}`);
      }
      if (!d) throw new Error(`OpenCode returned an empty models response from ${resolvedUrl}`);

      // Zen /models is the source of truth. AiWay now supports all documented
      // Zen protocol families and routes each model automatically.
      const documentedFreeIds = new Set([
        'big-pickle', 'x-preview-f-free', 'mimo-v2.5-free', 'hy3-free',
        'nemotron-3-ultra-free', 'nemotron-3.5-lightning-free',
        'deepseek-v4-flash-free', 'laguna-s-2.1-free', 'muse-spark-1.2-contributor-free'
      ]);
      details = modelDetailsFromOpenAI(d.data || d.models, 'opencode').map(item => ({
        ...item,
        tier: documentedFreeIds.has(item.id) ? 'free' : item.tier,
        label: item.id === 'x-preview-f-free' ? 'Ox Alpha Free' : item.id === 'muse-spark-1.2-contributor-free' ? 'Muse Spark 1.2 Contributor Free' : item.label,
        api: openCodeProtocol(item.id),
      }));
      if (!details.length) throw new Error(`OpenCode Zen returned an empty model catalog.`);
    } else if (provider === 'hermes') {
      const missing = ['HERMES_BASE_URL', 'HERMES_API_KEY'].filter(name => !String(process.env[name] || '').trim());
      if (missing.length) {
        return json(res, 200, {
          models: [], details: [], capabilities: null,
          configuration: {
            configured: false,
            missing,
            message: 'Hermes Agent is not configured on this Vercel deployment. Set HERMES_BASE_URL to a remotely reachable Hermes gateway and HERMES_API_KEY to its API_SERVER_KEY.',
            localOnlyWarning: '127.0.0.1/localhost on your phone or computer cannot be reached by Vercel Serverless Functions.'
          }
        });
      }
      try { capabilities = await hermesCapabilities(); } catch {}
      const configuredBase = normalizeBaseUrl(process.env.HERMES_BASE_URL);
      const base = configuredBase.replace(/\/v1$/i, '');
      const headers = { Authorization: `Bearer ${process.env.HERMES_API_KEY}` };
      let richError = null;
      try {
        const rich = await fetch(`${base}/api/model/options?refresh=1`, { headers });
        const d = await rich.json();
        if (!rich.ok) throw new Error(d?.error?.message || d?.error || `Hermes HTTP ${rich.status}`);
        details = hermesDetails(d);
      } catch (error) {
        richError = error;
      }
      if (!details.length) {
        const fallbackBase = base.endsWith('/v1') ? base : `${base}/v1`;
        const r = await fetch(`${fallbackBase}/models`, { headers });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error?.message || d?.error || richError?.message || `Hermes HTTP ${r.status}`);
        details = modelDetailsFromOpenAI(d.data || d.models, 'hermes');
      }
    } else {
      return json(res, 400, { error: 'Unsupported provider' });
    }

    const deduped = [...new Map(details.map(x => [x.id, x])).values()]
      .sort((a, b) => a.label.localeCompare(b.label));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(JSON.stringify({ models: deduped.map(x => x.id), details: deduped, capabilities }));
  } catch (error) {
    json(res, 500, { error: error?.message || 'Server error' });
  }
}
