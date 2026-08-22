import { allowMethod, json, requireAppAccess, rateLimit } from './_utils.js';
export default function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  if (!requireAppAccess(req, res)) return;
  if (!rateLimit(req, res, { key: 'health', limit: 20 })) return;
  json(res, 200, {
    ok: true,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    opencode: true,
    opencodeKey: Boolean(process.env.OPENCODE_API_KEY),
    hermes: Boolean(process.env.HERMES_BASE_URL && process.env.HERMES_API_KEY),
    hermesMissing: ['HERMES_BASE_URL', 'HERMES_API_KEY'].filter(name => !String(process.env[name] || '').trim()),
    exa: Boolean(process.env.EXA_API_KEY),
    publisher: Boolean(process.env.GITHUB_TOKEN && process.env.VERCEL_TOKEN && process.env.PUBLISH_SECRET),
    vercelTeam: Boolean(process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID)
  });
}
