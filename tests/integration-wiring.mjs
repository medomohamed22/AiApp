/**
 * Cross-layer integration wiring guard.
 *
 * This test protects connections that are easy to break during refactors:
 * browser -> API routes, HTML -> assets, server module exports, environment
 * documentation, and Vercel-sensitive-environment constraints.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('assets/app.js');
const html = read('index.html');
const envExample = read('.env.example');
const environmentRoute = read('api/environment.js');

// 1) Every client-side /api reference must resolve to an actual route file.
const clientRoutes = new Set([...app.matchAll(/["'`]\/api\/([a-zA-Z0-9_-]+)/g)].map(match => match[1]));
const apiFiles = new Set(
  fs.readdirSync(path.join(root, 'api'))
    .filter(name => name.endsWith('.js'))
    .map(name => name.replace(/\.js$/, ''))
);
for (const route of clientRoutes) {
  assert(apiFiles.has(route), `Client references missing API route: /api/${route}`);
}

// 2) Every API file must import cleanly and expose a Vercel handler.
for (const route of [...apiFiles].sort()) {
  const moduleUrl = pathToFileURL(path.join(root, 'api', `${route}.js`)).href;
  const mod = await import(moduleUrl);
  assert.equal(typeof mod.default, 'function', `api/${route}.js must default-export a handler`);
}

// 3) The application shell must point only to assets that exist.
for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)) {
  const relative = match[1].split(/[?#]/, 1)[0].replace(/^\//, '');
  assert(fs.existsSync(path.join(root, relative)), `HTML references missing asset: ${match[1]}`);
}
assert(html.includes('/assets/app.css'), 'index.html must load /assets/app.css');
assert(html.includes('/assets/app.js'), 'index.html must load /assets/app.js');

// 4) Every server-side environment variable used in code must be documented.
const serverSource = [
  ...fs.readdirSync(path.join(root, 'api')).filter(x => x.endsWith('.js')).map(x => read(`api/${x}`)),
  ...fs.readdirSync(path.join(root, 'lib')).filter(x => x.endsWith('.js')).map(x => read(`lib/${x}`))
].join('\n');
const usedEnv = new Set([
  ...[...serverSource.matchAll(/\benv\(["']([A-Z0-9_]+)["']/g)].map(x => x[1]),
  ...[...serverSource.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(x => x[1])
]);
const documentedEnv = new Set([...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(x => x[1]));
for (const key of usedEnv) {
  assert(documentedEnv.has(key), `Missing ${key} from .env.example`);
}

// 5) Sensitive Vercel environment variables must never target Development.
assert.match(environmentRoute, /ALLOWED_TARGETS\s*=\s*new Set\(\['production', 'preview'\]\)/);
assert(!/ALLOWED_TARGETS[^;]*development/.test(environmentRoute), 'Sensitive env route must not target development');

console.log(`integration wiring ok • ${clientRoutes.size} client API routes • ${apiFiles.size}/12 Vercel functions`);
