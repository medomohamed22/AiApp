/**
 * Exa web-search proxy route.
 *
 * Protects the Exa key and returns bounded normalized search results. Preserve auth, rate limits, cancellation, and safe result shaping.
 *
 * MAINTAINER / AI CONTRACT:
 * - Read AGENTS.md and docs/AI-DEVELOPER-CONTRACT.md before changing behavior.
 * - Preserve existing features unless the request explicitly removes or changes them.
 * - Keep the Vercel /api JavaScript-file budget at 12 or fewer; shared helpers belong in /lib.
 * - New features must integrate with existing security, streaming, permissions, responsive UI, and tests.
 * - Run npm test before considering a change complete.
 */

import { allowMethod, env, json, requireAppAccess, rateLimit } from '../lib/utils.js';

function exaKey(req) {
  const fromHeader = String(req.headers?.['x-aiway-exa-key'] || '').trim();
  return fromHeader || env('EXA_API_KEY');
}

function cleanText(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function formatResults(data) {
  const results = Array.isArray(data?.results) ? data.results : [];
  if (!results.length) return 'No Exa search results found.';
  return results.slice(0, 10).map((item, index) => {
    const title = cleanText(item?.title || item?.url || `Result ${index + 1}`, 500);
    const url = cleanText(item?.url, 2000);
    const published = cleanText(item?.publishedDate || item?.published_date, 100);
    const highlights = Array.isArray(item?.highlights)
      ? item.highlights.map(x => cleanText(x, 2200)).filter(Boolean).join('\n')
      : '';
    const text = highlights || cleanText(item?.text || item?.summary, 3500);
    return [
      `## ${index + 1}. ${title}`,
      url ? `URL: ${url}` : '',
      published ? `Published: ${published}` : '',
      text ? `Relevant excerpt:\n${text}` : ''
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  if (!requireAppAccess(req, res)) return;
  if (!rateLimit(req, res, { key: 'search', limit: 20 })) return;
  try {
    const q = String(req.query?.q || '').trim();
    if (!q) return json(res, 400, { error: 'q is required' });
    if (q.length > 500) return json(res, 400, { error: 'query too long' });

    const key = exaKey(req);
    if (!key) return json(res, 503, { error: 'EXA_API_KEY is not configured. Add it in Settings for this session or in Vercel Environment Variables.' });

    const upstreamController = new AbortController();
    const stop = () => { if (!upstreamController.signal.aborted) upstreamController.abort(); };
    req.on?.('close', stop);
    res.on?.('close', stop);

    const r = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      signal: upstreamController.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify({
        query: q,
        type: 'auto',
        numResults: 8,
        contents: { highlights: true }
      }),
    });

    const raw = await r.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    if (!r.ok) {
      const message = cleanText(data?.error || data?.message || raw || `Exa HTTP ${r.status}`, 800);
      return json(res, r.status, { error: message || `Exa HTTP ${r.status}` });
    }

    const text = formatResults(data);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(text);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    json(res, 500, { error: error?.message || 'Server error' });
  }
}
