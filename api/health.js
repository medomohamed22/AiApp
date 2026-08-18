import { allowMethod, json } from './_utils.js';
export default function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  json(res, 200, {
    ok: true,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    jina: Boolean(process.env.JINA_API_KEY),
    publisher: Boolean(process.env.GITHUB_TOKEN && process.env.VERCEL_TOKEN && process.env.PUBLISH_SECRET),
    vercelTeam: Boolean(process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID)
  });
}
