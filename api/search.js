import { allowMethod, env, json, requireAppAccess } from './_utils.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  if (!requireAppAccess(req, res)) return;
  try {
    const q = String(req.query?.q || '').trim();
    if (!q) return json(res, 400, { error: 'q is required' });
    if (q.length > 500) return json(res, 400, { error: 'query too long' });

    const r = await fetch(`https://s.jina.ai/?q=${encodeURIComponent(q)}`, {
      headers: {
        Authorization: `Bearer ${env('JINA_API_KEY')}`,
        Accept: 'text/plain',
      },
    });
    const text = await r.text();
    res.statusCode = r.status;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(text);
  } catch (error) {
    json(res, 500, { error: error?.message || 'Server error' });
  }
}
