import { allowMethod, json } from './_utils.js';
export default function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  json(res, 200, {
    ok: true,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    jina: Boolean(process.env.JINA_API_KEY),
  });
}
