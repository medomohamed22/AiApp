import { allowMethod, env, json } from './_utils.js';

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
  try {
    const provider = String(req.query?.provider || 'gemini').toLowerCase();
    let details = [];

    if (provider === 'gemini') {
      const key = env('GEMINI_API_KEY');
      let pageToken = '';
      do {
        const qs = new URLSearchParams({ key, pageSize: '1000' });
        if (pageToken) qs.set('pageToken', pageToken);
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?${qs}`);
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
      const headers = {};
      if (process.env.OPENCODE_API_KEY) headers.Authorization = `Bearer ${process.env.OPENCODE_API_KEY}`;
      const r = await fetch('https://opencode.ai/inference/openai/v1/models', { headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || d?.error || `OpenCode HTTP ${r.status}`);
      details = modelDetailsFromOpenAI(d.data || d.models, 'opencode');
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
    json(res, 200, { models: deduped.map(x => x.id), details: deduped });
  } catch (error) {
    json(res, 500, { error: error?.message || 'Server error' });
  }
}
