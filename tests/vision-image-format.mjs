/**
 * Regression guard for provider image-format rejection.
 *
 * Reported failure:
 *   "The request is invalid: .messages[20]: You have uploaded an unsupported
 *    image. Please make sure your image is valid and has one of the following
 *    formats: webp, png, jpeg, and gif."
 *
 * Three separate defects produced it:
 *
 *  1. `remoteImageToDataUrl` trusted the remote server's Content-Type header.
 *     Web search results routinely serve AVIF/SVG/BMP bytes under image/jpeg,
 *     so unsupported bytes were base64-encoded and sent as a valid-looking
 *     data URL.
 *  2. Non-Gemini providers received the raw remote URL with no validation at
 *     all, so the provider fetched whatever the site returned.
 *  3. Worst of all, attachments are persisted in chat history. One bad image
 *     therefore broke EVERY subsequent request in the conversation, which is
 *     why the error pointed at a high message index (.messages[20]) rather
 *     than the message that introduced the image.
 *
 * The contract asserted here: an unsupported image is DROPPED (or reported as
 * text), never forwarded. Losing one image is always better than failing the
 * whole reply.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const app = fs.readFileSync(path.join(process.cwd(), 'assets/app.js'), 'utf8');

/* ---------- Load the real implementation ---------- */

const start = app.indexOf('/* ---------- Vision image format safety ---------- */');
assert(start > -1, 'vision image safety block not found in assets/app.js');
const end = app.indexOf('async function remoteImageToDataUrl(', start);
assert(end > start, 'could not bound the vision image safety block');

// These are minified one-liners, so bound them by brace matching rather than by
// looking for a newline-delimited closing brace.
const grab = name => {
  const at = app.indexOf(`function ${name}(`);
  assert(at > -1, `${name} not found`);
  const open = app.indexOf('{', app.indexOf('(', at));
  let depth = 0;
  for (let i = open; i < app.length; i++) {
    if (app[i] === '{') depth++;
    else if (app[i] === '}' && --depth === 0) return app.slice(at, i + 1);
  }
  throw new Error(`could not bound ${name}`);
};

const source = [
  app.slice(start, end),
  grab('dataUrlPayload'),
  grab('visualContextForOpenRouter'),
  grab('visualContextForGemini'),
  grab('geminiPartsForMessage'),
  grab('openRouterContentForMessage')
].join('\n');

const factory = new Function('artifactRefPrompt', `${source}
return { safeVisionDataUrl, safeVisionUrl, sniffImageMime, normalizeVisionMime,
  visionImageSource, visualContextForOpenRouter, visualContextForGemini,
  geminiPartsForMessage, openRouterContentForMessage, VISION_MIME_ALLOW };`);

const V = factory(a => `ref:${a.name}`);

/* ---------- Fixtures: real magic-number headers ---------- */

const b64 = bytes => Buffer.from(bytes).toString('base64');
const pad = (head, n = 40) => b64([...head, ...Array(n).fill(0)]);

const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const GIF = pad([...Buffer.from('GIF89a')]);
const WEBP = pad([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]);

// Unsupported formats that providers reject.
const AVIF = pad([0, 0, 0, 0x20, ...Buffer.from('ftypavif')]);
const SVG = pad([...Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')]);
const BMP = pad([0x42, 0x4d, 0x36, 0x00]);
const ICO = pad([0x00, 0x00, 0x01, 0x00]);
const TIFF = pad([0x49, 0x49, 0x2a, 0x00]);
const HTML = pad([...Buffer.from('<!DOCTYPE html><html><body>404')]);

const url = (mime, data) => `data:${mime};base64,${data}`;

let checks = 0;
const ok = (cond, msg) => { assert(cond, msg); checks++; };

/* ---------- 1. Supported formats survive ---------- */
for (const [name, data, mime] of [
  ['png', PNG, 'image/png'],
  ['jpeg', JPEG, 'image/jpeg'],
  ['gif', GIF, 'image/gif'],
  ['webp', WEBP, 'image/webp']
]) {
  const out = V.safeVisionDataUrl(url(mime, data));
  ok(out, `${name} must be accepted`);
  ok(out.startsWith(`data:${mime};base64,`), `${name} must keep its mime`);
}

/* ---------- 2. Unsupported formats are rejected ---------- */
for (const [name, data] of [
  ['avif', AVIF], ['svg', SVG], ['bmp', BMP], ['ico', ICO], ['tiff', TIFF],
  ['html error page', HTML]
]) {
  ok(V.safeVisionDataUrl(url('image/png', data)) === null,
    `${name} must be rejected even when declared as image/png`);
}

/* ---------- 3. THE ROOT CAUSE: a lying Content-Type must not win ---------- */
// This is the exact shape produced by the old code path: AVIF bytes labelled
// image/jpeg because that is what the remote server claimed.
ok(V.safeVisionDataUrl(url('image/jpeg', AVIF)) === null,
  'AVIF bytes mislabelled as image/jpeg must be rejected, not trusted');
ok(V.safeVisionDataUrl(url('image/jpeg', SVG)) === null,
  'SVG bytes mislabelled as image/jpeg must be rejected');

// Conversely, correct bytes with a wrong/blank label are repaired rather than lost.
let fixed = V.safeVisionDataUrl(url('image/jpg', JPEG));
ok(fixed && fixed.startsWith('data:image/jpeg;'), 'image/jpg alias must normalize to image/jpeg');
fixed = V.safeVisionDataUrl(url('application/octet-stream', PNG));
ok(fixed && fixed.startsWith('data:image/png;'), 'real PNG bytes must be recovered from a wrong label');
fixed = V.safeVisionDataUrl(url('', WEBP));
ok(fixed && fixed.startsWith('data:image/webp;'), 'real WebP bytes must be recovered from a blank label');

/* ---------- 4. Malformed input must not throw ---------- */
for (const bad of [null, undefined, '', 'not-a-data-url', 'data:image/png;base64,', 'data:image/png;base64,!!!!', 'https://x.com/a.png']) {
  let threw = false;
  try { V.safeVisionDataUrl(bad); } catch { threw = true; }
  ok(!threw, `safeVisionDataUrl must not throw on ${JSON.stringify(bad)}`);
}
ok(V.safeVisionDataUrl('data:image/png;base64,' + b64([0x89, 0x50])) === null,
  'truncated data must be rejected, not padded into a fake image');

/* ---------- 5. Remote URLs are only forwarded when plausibly supported ---------- */
ok(V.safeVisionUrl('https://x.com/a.png') === 'https://x.com/a.png', 'png URL allowed');
ok(V.safeVisionUrl('https://x.com/a.jpg?w=800') === 'https://x.com/a.jpg?w=800', 'query string allowed');
ok(V.safeVisionUrl('https://x.com/a.JPEG') !== null, 'extension check is case-insensitive');
ok(V.safeVisionUrl('https://x.com/a.avif') === null, 'avif URL rejected');
ok(V.safeVisionUrl('https://x.com/a.svg') === null, 'svg URL rejected');
ok(V.safeVisionUrl('https://x.com/image') === null, 'extensionless URL rejected');
ok(V.safeVisionUrl('javascript:alert(1)') === null, 'non-http scheme rejected');
ok(V.safeVisionUrl('file:///etc/passwd') === null, 'file scheme rejected');

/* ---------- 6. Search visuals drop bad images instead of failing the request ---------- */
let out = V.visualContextForOpenRouter([
  { url: 'https://x.com/good.png' },
  { url: 'https://x.com/bad.avif' },
  { dataUrl: url('image/jpeg', AVIF) },
  { dataUrl: url('image/png', PNG) }
]);
const images = out.content.filter(c => c.type === 'image_url');
ok(images.length === 2, `only the 2 safe images may be forwarded, got ${images.length}`);
ok(!JSON.stringify(images).includes('avif'), 'no avif may reach the provider');

// If every image is unsupported, send nothing rather than a dangling text block.
ok(V.visualContextForOpenRouter([{ dataUrl: url('image/png', AVIF) }]) === null,
  'an all-unsupported batch must produce no message at all');
ok(V.visualContextForOpenRouter([]) === null, 'empty batch stays null');

out = V.visualContextForGemini([
  { dataUrl: url('image/png', PNG) },
  { dataUrl: url('image/jpeg', SVG) }
]);
const parts = out.parts.filter(p => p.inlineData);
ok(parts.length === 1, `gemini must receive only the valid image, got ${parts.length}`);
ok(V.VISION_MIME_ALLOW.has(parts[0].inlineData.mimeType), 'forwarded mime must be in the allowlist');
ok(V.visualContextForGemini([{ dataUrl: url('image/png', BMP) }]) === null,
  'gemini gets no message when nothing is usable');

/* ---------- 7. THE REPORTED BUG: poisoned history must not break later turns ---------- */
// A bad image already saved in the conversation must be neutralised on the way
// out, otherwise it fails every request forever — the .messages[20] symptom.
const poisoned = {
  role: 'user',
  text: 'شوف الصورة دي',
  attachments: [
    { kind: 'image', name: 'bad.avif', data: url('image/jpeg', AVIF) },
    { kind: 'image', name: 'good.png', data: url('image/png', PNG) }
  ]
};

const orContent = V.openRouterContentForMessage(poisoned);
const orImages = orContent.filter(c => c.type === 'image_url');
ok(orImages.length === 1, `history must forward only the valid image, got ${orImages.length}`);
ok(!JSON.stringify(orImages).includes(AVIF.slice(0, 16)), 'avif bytes must not reach the provider from history');
ok(orContent.some(c => c.type === 'text' && /bad\.avif/.test(c.text)),
  'the dropped image must be disclosed to the model as text, not silently vanish');

const gParts = V.geminiPartsForMessage(poisoned);
const gImages = gParts.filter(p => p.inlineData);
ok(gImages.length === 1, `gemini history must forward only the valid image, got ${gImages.length}`);
ok(gParts.some(p => p.text && /bad\.avif/.test(p.text)), 'gemini must be told an image was dropped');

// Every forwarded mime, from any path, must be in the provider allowlist.
for (const p of gImages) {
  ok(V.VISION_MIME_ALLOW.has(p.inlineData.mimeType), `unsupported mime leaked: ${p.inlineData.mimeType}`);
}

/* ---------- 8. PDFs must keep working (they share dataUrlPayload) ---------- */
const pdfMsg = {
  role: 'user',
  text: 'راجع الملف',
  attachments: [{ kind: 'pdf', name: 'doc.pdf', data: 'data:application/pdf;base64,' + b64([0x25, 0x50, 0x44, 0x46]) }]
};
ok(V.geminiPartsForMessage(pdfMsg).some(p => p.inlineData?.mimeType === 'application/pdf'),
  'the image allowlist must not break PDF attachments');
ok(V.openRouterContentForMessage(pdfMsg).some(c => c.type === 'file'),
  'openrouter PDF attachments must still be sent as files');

/* ---------- 9. Text-only and mixed messages are unaffected ---------- */
ok(V.openRouterContentForMessage({ role: 'user', text: 'مرحبا' }) === 'مرحبا',
  'plain text messages must stay plain strings');
ok(V.geminiPartsForMessage({ role: 'user', text: 'مرحبا' })[0].text === 'مرحبا',
  'plain text gemini parts unchanged');

/* ---------- 10. Source-level contract ---------- */
// The header must never again be the source of truth for format.
const fetcher = app.slice(app.indexOf('async function remoteImageToDataUrl('));
const fetchBody = fetcher.slice(0, fetcher.indexOf('\n}\n'));
ok(/safeVisionDataUrl/.test(fetchBody),
  'remoteImageToDataUrl must validate bytes through safeVisionDataUrl');
ok(!/content-type[^\n]*startsWith\("image\//.test(fetchBody),
  'remoteImageToDataUrl must not gate on the Content-Type header alone');

// The unvalidated pass-through that caused defect 2 must not come back.
ok(!app.includes('image_url:{url:x.dataUrl||x.url}'),
  'raw unvalidated image URLs must never be forwarded to a provider');

// The upload path must reject unsupported files with an actionable message.
ok(/safeVisionDataUrl\(raw\)/.test(app), 'the upload path must validate image bytes');

console.log(`vision image format guards ok • ${checks} assertions`);
