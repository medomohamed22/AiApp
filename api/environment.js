/**
 * Vercel environment-variable manager.
 *
 * MAINTAINER / AI RULES:
 * - This is a real Vercel Function route. Do not split helpers into additional /api files.
 * - Shared Vercel HTTP helpers belong in /lib/vercel-api.js.
 * - Keep PUBLISH_SECRET authorization, no-store responses, input bounds, and secret masking.
 * - New actions must remain compatible with Vercel serverless execution and existing clients.
 */

import { allowMethod, bodyJson, env, json, rateLimit, secureEqual } from '../lib/utils.js';
import { VERCEL_API, vercelApiFetch, vercelHeaders, vercelTeamQuery } from '../lib/vercel-api.js';

// Sensitive Vercel variables are supported for Production/Preview, not Development.
const ALLOWED_TARGETS = new Set(['production', 'preview']);
const MAX_ENV_VALUE_BYTES = 32_000;

function cleanKey(key = '') {
  return String(key || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 100);
}

function cleanTargets(target) {
  const requested = Array.isArray(target) ? target : ['production', 'preview'];
  const valid = requested.filter(item => ALLOWED_TARGETS.has(item));
  return valid.length ? [...new Set(valid)] : ['production', 'preview'];
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['POST'])) return;
  if (!rateLimit(req, res, { key: 'environment', limit: 20 })) return;
  res.setHeader('Cache-Control', 'no-store');

  try {
    const publishKey = env('PUBLISH_SECRET');
    if (!secureEqual(req.headers['x-aiway-publish-key'], publishKey)) {
      return json(res, 401, { error: 'Publishing access key is invalid.' });
    }

    const token = env('VERCEL_TOKEN');
    const teamId = process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || '';
    const input = await bodyJson(req);
    const action = String(input.action || 'list');
    const projectId = String(input.projectId || input.projectName || '').trim();

    if (!projectId) {
      return json(res, 400, { error: 'A Vercel project id or name is required.' });
    }

    if (action === 'list') {
      const data = await vercelApiFetch(
        `${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}/env${vercelTeamQuery(teamId)}`,
        { headers: vercelHeaders(token) },
        'Vercel environment list'
      );
      const variables = Array.isArray(data) ? data : (data.envs || data.environmentVariables || []);

      return json(res, 200, {
        ok: true,
        projectId,
        variables: variables
          .map(item => ({
            id: item.id,
            key: item.key,
            type: item.type || 'sensitive',
            target: Array.isArray(item.target) ? item.target : []
          }))
          .sort((a, b) => a.key.localeCompare(b.key))
      });
    }

    if (action === 'upsert') {
      const key = cleanKey(input.key);
      const value = typeof input.value === 'string' ? input.value : '';

      if (!key) return json(res, 400, { error: 'Invalid environment variable name.' });
      if (!value.trim()) return json(res, 400, { error: `A value is required for ${key}.` });
      if (Buffer.byteLength(value, 'utf8') > MAX_ENV_VALUE_BYTES) {
        return json(res, 413, { error: 'Secret value is too large.' });
      }

      const payload = {
        key,
        value,
        type: 'sensitive',
        target: cleanTargets(input.target)
      };

      await vercelApiFetch(
        `${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/env${vercelTeamQuery(teamId, { upsert: 'true' })}`,
        {
          method: 'POST',
          headers: vercelHeaders(token),
          body: JSON.stringify(payload)
        },
        'Vercel environment upsert'
      );

      return json(res, 200, {
        ok: true,
        projectId,
        key,
        target: payload.target,
        saved: true,
        valueExposed: false
      });
    }

    return json(res, 400, { error: 'Unknown environment action.' });
  } catch (error) {
    console.error('environment manager error', error?.status || '', error?.message || error);
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return json(res, status, { error: error.message || 'Environment manager failed.' });
  }
}
