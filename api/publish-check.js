/**
 * Publishing credential preflight route.
 *
 * MAINTAINER / AI RULES:
 * - Keep this route lightweight: it validates GitHub/Vercel credentials without exposing tokens.
 * - Do not add helper files under /api; shared Vercel helpers belong in /lib/vercel-api.js.
 * - Preserve PUBLISH_SECRET authorization and no-store behavior.
 */

import { allowMethod, env, json, secureEqual, rateLimit } from '../lib/utils.js';
import { VERCEL_API, vercelHeaders, vercelTeamQuery } from '../lib/vercel-api.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['POST'])) return;
  if (!rateLimit(req, res, { key: 'publish-check', limit: 12 })) return;
  res.setHeader('Cache-Control', 'no-store');
  try {
    const secret = env('PUBLISH_SECRET');
    if (!secureEqual(req.headers['x-aiway-publish-key'], secret)) return json(res, 401, { error: 'Publishing access key is invalid.' });

    const githubToken = env('GITHUB_TOKEN');
    const vercelToken = env('VERCEL_TOKEN');
    const teamId = process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || '';

    const [gh, vc] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2026-03-10'
        }
      }),
      fetch(`${VERCEL_API}/v2/user${vercelTeamQuery(teamId)}`, {
        headers: vercelHeaders(vercelToken)
      })
    ]);

    const ghData = await gh.json().catch(() => ({}));
    const vcData = await vc.json().catch(() => ({}));
    if (!gh.ok) return json(res, 502, { error: ghData.message || 'GitHub token check failed.' });
    if (!vc.ok) return json(res, 502, { error: vcData?.error?.message || 'Vercel token check failed.' });

    return json(res, 200, {
      ok: true,
      github: { login: ghData.login },
      vercel: { user: vcData?.user?.username || vcData?.user?.name || vcData?.user?.email || 'connected', teamId: teamId || null },
      publishConfigured: true
    });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Publisher check failed.' });
  }
}
