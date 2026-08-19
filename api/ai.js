import { allowMethod, env, json, pipeFetch } from './_utils.js';

// Self-Evolution capabilities are appended ONLY inside these registries.
// The evolution endpoint performs deterministic insertions and never rewrites
// the surrounding core code.
export const EVOLUTION_SKILLS = {
  // AIWAY_EVOLUTION_SKILLS_START
  // AIWAY_EVOLUTION_SKILLS_END
};

export const EVOLUTION_TOOLS = {
  // AIWAY_EVOLUTION_TOOLS_START
  // AIWAY_EVOLUTION_TOOLS_END
};

export function getEvolutionRegistry() {
  return { skills: EVOLUTION_SKILLS, tools: EVOLUTION_TOOLS };
}

function capabilityList() {
  return {
    skills: Object.entries(EVOLUTION_SKILLS).map(([id, item]) => ({
      id,
      name: item.name || id,
      description: item.description || '',
      version: item.version || '1.0.0',
      tags: item.tags || [],
      domains: item.domains || [],
      userValue: item.userValue ?? null,
      selfImprovementValue: item.selfImprovementValue ?? null,
    })),
    tools: Object.entries(EVOLUTION_TOOLS).map(([id, item]) => ({
      id,
      name: item.name || id,
      description: item.description || '',
      method: item.method || 'POST',
      schema: item.schema || { type: 'object', properties: {} },
      tags: item.tags || [],
      domains: item.domains || [],
      userValue: item.userValue ?? null,
      selfImprovementValue: item.selfImprovementValue ?? null,
      evolutionSafe: item.evolutionSafe === true,
      evolutionHint: item.evolutionHint || '',
    })),
  };
}

function validateToolArgs(schema, args) {
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  const required = Array.isArray(schema?.required) ? schema.required : [];
  for (const key of required) {
    if (!(key in input)) throw new Error(`Missing required argument: ${key}`);
  }
  return input;
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET', 'POST'])) return;
  try {
    if (req.method === 'GET') {
      const action = String(req.query?.action || 'list');
      if (action === 'list') return json(res, 200, capabilityList());
      if (action === 'skill') {
        const id = String(req.query?.id || '');
        const item = EVOLUTION_SKILLS[id];
        if (!item) return json(res, 404, { error: 'Skill not found' });
        return json(res, 200, {
          id,
          name: item.name || id,
          description: item.description || '',
          version: item.version || '1.0.0',
          content: item.content || '',
        });
      }
      return json(res, 400, { error: 'Unsupported capability action' });
    }

    const { provider, model, payload, capability, args } = req.body || {};

    // Evolution tools share this EXISTING /api/ai endpoint so self-evolution
    // never creates additional Vercel API function files.
    if (provider === 'capability') {
      const id = String(capability || '');
      const tool = EVOLUTION_TOOLS[id];
      if (!tool) return json(res, 404, { error: 'Capability tool not found' });
      const safeArgs = validateToolArgs(tool.schema, args);
      const result = await tool.run(safeArgs, { req });
      return json(res, 200, { ok: true, capability: id, result });
    }

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
