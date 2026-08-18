import { allowMethod, env, json, pipeFetch } from './_utils.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['POST'])) return;
  try {
    const { provider, model, payload } = req.body || {};
    if (!provider || !payload) return json(res, 400, { error: 'provider and payload are required' });

    let url;
    let headers = { 'Content-Type': 'application/json' };

    if (provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers.Authorization = `Bearer ${env('OPENROUTER_API_KEY')}`;
      headers['HTTP-Referer'] = process.env.APP_URL || 'https://aiway.vercel.app';
      headers['X-Title'] = 'AiWay';
    } else if (provider === 'gemini') {
      if (!model) return json(res, 400, { error: 'model is required for Gemini' });
      const key = env('GEMINI_API_KEY');
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
    } else {
      return json(res, 400, { error: 'Unsupported provider' });
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    await pipeFetch(upstream, res);
  } catch (error) {
    json(res, 500, { error: error?.message || 'Server error' });
  }
}
