/**
 * AiWay shared Vercel API helpers.
 *
 * MAINTAINER / AI RULES:
 * - Keep Vercel-specific HTTP plumbing here instead of duplicating it in /api routes.
 * - Never move this helper into /api: every top-level JavaScript file there can consume
 *   one Vercel Serverless Function slot. AiWay's hard budget is <= 12 API files.
 * - Do not log or return VERCEL_TOKEN values or full secret-bearing upstream payloads.
 * - Any behavior change must preserve existing publish/environment flows and pass npm test.
 */

export const VERCEL_API = 'https://api.vercel.com';

export function vercelHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

export function vercelTeamQuery(teamId, extra = {}) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);

  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function vercelApiFetch(url, options = {}, label = 'Vercel API') {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `${label} HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
