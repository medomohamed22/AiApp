import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { bodyJson, requestAbortSignal } from '../api/_utils.js';

// Parsed request bodies must still obey the configured size limit.
await assert.rejects(
  () => bodyJson({ body: { payload: 'x'.repeat(200) } }, 100),
  /too large/i
);
assert.deepEqual(await bodyJson({ body: { ok: true } }, 100), { ok: true });

// Client disconnects must abort upstream provider requests.
const req = new EventEmitter();
const res = new EventEmitter();
req.aborted = false;
res.writableEnded = false;
const signal = requestAbortSignal(req, res);
assert.equal(signal.aborted, false);
res.emit('close');
assert.equal(signal.aborted, true);

const publish = fs.readFileSync(new URL('../api/publish.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const ai = fs.readFileSync(new URL('../api/ai.js', import.meta.url), 'utf8');
const adapters = fs.readFileSync(new URL('../api/_provider_adapters.js', import.meta.url), 'utf8');

// Publishing must never copy server process.env values into user deployments.
assert.doesNotMatch(publish, /const\s+fallback\s*=\s*process\.env\s*\[/);
assert.match(publish, /syncGitHubSnapshot/);
assert.match(publish, /No base_tree on purpose/);
assert.match(publish, /Duplicate file paths are not allowed/);

// Closing any sheet (including Escape/backdrop) must deny a pending permission prompt.
assert.match(app, /function resolvePendingPermission\(allowed=false\)/);
assert.match(app, /function closeSheets\(\).*resolvePendingPermission\(false\)/s);
assert.match(app, /inflateZipBytes\(bytes,maxBytes=900000\)/);
assert.match(app, /total>maxBytes/);
assert.match(app, /const all=await idbAll\("artifacts"\),byName=new Map/);

// AbortSignal should flow through every AI proxy path.
assert.match(ai, /requestAbortSignal\(req, res\)/);
assert.match(ai, /proxyOpenCode\(payload, res, signal\)/);
assert.match(ai, /proxyHermesRun\(\{ payload: nextPayload, sessionId: .* signal \}, res\)/s);
assert.match(adapters, /proxyOpenCode\(payload,res,signal\)/);
assert.match(adapters, /proxyHermesRun\(\{payload,sessionId,signal\},res\)/);

console.log('security regression guards ok');
