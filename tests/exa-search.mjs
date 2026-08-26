/**
 * Regression guard for AiWay.
 * Keep this test focused on externally important behavior/invariants, not implementation trivia.
 * When intentionally changing a guarded behavior, update the implementation and this test together.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import handler from '../api/search.js';

process.env.EXA_API_KEY = 'env-exa-key';
let captured = null;
const originalFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  captured = { url: String(url), options };
  return new Response(JSON.stringify({
    results: [{
      title: 'Exa test result',
      url: 'https://example.com/result',
      publishedDate: '2026-08-22T00:00:00.000Z',
      highlights: ['Relevant Exa highlight']
    }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

function mockReq() {
  const listeners = {};
  return {
    method: 'GET',
    query: { q: 'latest agent search' },
    headers: { 'x-aiway-exa-key': 'session-exa-key' },
    socket: { remoteAddress: '127.0.0.1' },
    on(name, cb) { listeners[name] = cb; }
  };
}
function mockRes() {
  const headers = {};
  const listeners = {};
  return {
    statusCode: 200,
    body: '',
    headers,
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    on(name, cb) { listeners[name] = cb; },
    end(v = '') { this.body += String(v); },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = JSON.stringify(obj); return this; }
  };
}

try {
  const req = mockReq();
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(captured.url, 'https://api.exa.ai/search');
  assert.equal(captured.options.headers['x-api-key'], 'session-exa-key');
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.query, 'latest agent search');
  assert.equal(payload.type, 'auto');
  assert.equal(payload.numResults, 8);
  assert.equal(payload.contents.highlights, true);
  assert.match(res.body, /Exa test result/);
  assert.match(res.body, /Relevant Exa highlight/);
  assert.match(res.body, /https:\/\/example\.com\/result/);

  const root = path.resolve(new URL('..', import.meta.url).pathname);
  const files = ['api/search.js','api/health.js','assets/app.js','index.html','README.md','.env.example','AGENTS.md'];
  const joined = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  assert.doesNotMatch(joined, /jina/i, 'Jina references should be fully removed');
  assert.match(joined, /EXA_API_KEY/);
  assert.match(joined, /exaApiKey/);
  console.log('Exa search migration guards ok');
} finally {
  global.fetch = originalFetch;
}
