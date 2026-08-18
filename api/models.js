import { allowMethod, env, json } from './_utils.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  try {
    const provider = String(req.query?.provider || 'gemini');
    let models = [];

    if (provider === 'gemini') {
      const key = env('GEMINI_API_KEY');
      let pageToken = '';
      do {
        const qs = new URLSearchParams({ key, pageSize: '1000' });
        if (pageToken) qs.set('pageToken', pageToken);
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?${qs}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error?.message || `Gemini HTTP ${r.status}`);
        models.push(...(d.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => String(m.name || '').replace(/^models\//, ''))
          .filter(Boolean));
        pageToken = d.nextPageToken || '';
      } while (pageToken);
    } else if (provider === 'openrouter') {
      const r = await fetch('https://openrouter.ai/api/v1/models?limit=1000', {
        headers: { Authorization: `Bearer ${env('OPENROUTER_API_KEY')}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `OpenRouter HTTP ${r.status}`);
      models = (d.data || []).map(m => m.id).filter(Boolean);
    } else {
      return json(res, 400, { error: 'Unsupported provider' });
    }

    json(res, 200, { models: [...new Set(models)].sort() });
  } catch (error) {
    json(res, 500, { error: error?.message || 'Server error' });
  }
}
