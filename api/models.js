import { allowMethod, env, json, fetchOpenCode, requireAppAccess } from './_utils.js';

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
      });
    }
  }
  return out;
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  if (!requireAppAccess(req, res)) return;
  try {
    const provider = String(req.query?.provider || 'gemini').toLowerCase();
    let details = [];

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
          .map(m => String(m.name || '').replace(/^models\//, ''))
          .filter(Boolean)
          .map(id => ({ id, label: id, provider: 'gemini', tier: 'unknown', pricing: null })));
        pageToken = d.nextPageToken || '';
      } while (pageToken);
    } else if (provider === 'openrouter') {
      const r = await fetch('https://openrouter.ai/api/v1/models?limit=1000', {
        headers: { Authorization: `Bearer ${env('OPENROUTER_API_KEY')}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `OpenRouter HTTP ${r.status}`);
      details = modelDetailsFromOpenAI(d.data, 'openrouter');
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

      // Zen /models is the source of truth. This app currently speaks the
      // OpenAI-compatible Chat Completions protocol, so keep only models whose
      // current Zen endpoint is /chat/completions. Other Zen models use
      // /responses, /messages, or the Gemini protocol and need different payloads.
      // /models does not expose each model's protocol. Keep this list aligned
      // with OpenCode Zen's documented OpenAI-compatible /chat/completions table.
      const chatCompatibleIds = new Set([
        'deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v4-flash-free',
        'minimax-m3', 'minimax-m2.7', 'minimax-m2.5',
        'glm-5.2', 'glm-5.1', 'glm-5',
        'kimi-k2.5', 'kimi-k2.6', 'kimi-k2.7-code', 'kimi-k3',
        'big-pickle', 'mimo-v2.5-free', 'hy3-free', 'laguna-s-2.1-free',
        'nemotron-3-ultra-free', 'nemotron-3.5-lightning-free'
      ]);

      details = modelDetailsFromOpenAI(d.data || d.models, 'opencode')
        .filter(item => chatCompatibleIds.has(item.id))
        .map(item => ({ ...item, api: 'chat/completions' }));

      if (!details.length) {
        throw new Error(`OpenCode Zen returned models, but none matched the app's Chat Completions compatibility list. Update api/models.js to the latest Zen catalog.`);
      }
    } else if (provider === 'hermes') {
      const configuredBase = normalizeBaseUrl(env('HERMES_BASE_URL'));
      const base = configuredBase.replace(/\/v1$/i, '');
      const headers = { Authorization: `Bearer ${env('HERMES_API_KEY')}` };
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
    res.end(JSON.stringify({ models: deduped.map(x => x.id), details: deduped }));
  } catch (error) {
    json(res, 500, { error: error?.message || 'Server error' });
  }
}
