/**
 * Functional guard for the pre-publish code review tools.
 *
 * js_validator / security_audit / ux_review exist so the agent can catch defects
 * BEFORE it presents final code. That is only worth doing if the analysis is
 * trustworthy in two directions:
 *
 *   1. It must actually fire on real defects (no silently dead rules).
 *   2. It must NOT fire on safe code, especially on matches that live inside
 *      comments or string literals (no false positives).
 *
 * A false positive is worse than a missed finding here, because it makes the
 * agent "fix" correct code. Both directions are asserted below against the real
 * implementation extracted from assets/app.js.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const app = fs.readFileSync(path.join(process.cwd(), 'assets/app.js'), 'utf8');

/* ---------- Load the real engine ---------- */

const start = app.indexOf('/* ---------- Static code review');
assert(start > -1, 'code review engine block not found in assets/app.js');
const end = app.indexOf('async function executeTool(tool,args){', start);
assert(end > start, 'could not bound the code review engine block');
const engine = app.slice(start, end);

const state = { settings: { activeProjectId: 'p1' } };
const store = [];
const idbAll = async () => store;

const factory = new Function('state', 'idbAll', 'DOMParser', `${engine}
return {
  analyzeJavaScriptSource, analyzeSecurityRisks, analyzeStyleUx,
  buildReviewResult, contrastRatio, parseCssColor, maskJsSource, REVIEW_SEVERITIES,
  inlineScriptSource, looksRightToLeft, reviewJavaScript, reviewSecurity,
  JS_CORRECTNESS_RULES, SECURITY_RULES, SECRET_RULES
};`);

const E = factory(state, idbAll, undefined);

/* ---------- CSP constraint ---------- */
// The app ships under Content-Security-Policy script-src 'self' with no
// unsafe-eval (vercel.json), so an eval-based parser would pass in Node and then
// throw in production. Assert the engine contains no real eval/new Function
// *call* — masking comments and strings first, because the engine documents the
// constraint in prose and that prose must not trip the check. (Doing this with a
// raw regex is precisely the false positive this whole tool suite guards against.)
{
  const engineCode = E.maskJsSource(engine).masked;
  assert.doesNotMatch(engineCode, /\bnew\s+Function\s*\(/, 'engine must not use new Function (blocked by CSP)');
  assert.doesNotMatch(engineCode, /(?:^|[^.\w$])eval\s*\(/, 'engine must not use eval (blocked by CSP)');
  const csp = fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8');
  assert.doesNotMatch(csp, /unsafe-eval/, 'CSP must keep blocking eval; the engine depends on staying eval-free');
}

/* ---------- Helpers ---------- */

const ids = report => report.findings.map(f => f.rule);
const has = (report, rule) => ids(report).includes(rule);
const js = code => E.analyzeJavaScriptSource('t.js', code);
const sec = code => E.analyzeSecurityRisks('t.js', code);
const css = (code, rtl = false) => E.analyzeStyleUx('t.css', code, { rtl });

let checks = 0;
const failures = [];
const detects = (report, rule, label) => {
  if (!has(report, rule)) failures.push(`${label}: expected rule ${rule}, got [${ids(report)}]`);
  checks++;
};
const clean = (report, label) => {
  if (report.findings.length) failures.push(`${label}: expected no findings, got [${ids(report)}]`);
  checks++;
};
const reportFailures = () => {
  if (failures.length) {
    assert.fail(`${failures.length} rule expectation(s) failed:\n  - ${failures.join('\n  - ')}`);
  }
};

/* ---------- 1. No dead rules ---------- */
// Every declared rule must have the fields the report contract depends on.
const allRules = [...E.JS_CORRECTNESS_RULES, ...E.SECURITY_RULES, ...E.SECRET_RULES];
const seenRules = new Set();
for (const r of allRules) {
  assert(r.rule, 'rule missing name');
  assert(!seenRules.has(r.rule), `duplicate rule name ${r.rule}`);
  seenRules.add(r.rule);
  assert(E.REVIEW_SEVERITIES.includes(r.severity), `${r.rule} has unknown severity ${r.severity}`);
  assert(r.message && r.message.length > 20, `${r.rule} message must explain the problem`);
  assert(r.re instanceof RegExp, `${r.rule} missing regex`);
  assert(r.re.flags.includes('g'), `${r.rule} regex must be global or only one match is ever found`);
}
// Every security rule must be attributable to an OWASP Top 10:2025 category, so
// a report can be justified rather than asserted.
const owaspIds = new Set(['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10']);
for (const r of E.SECURITY_RULES) {
  assert(r.owasp, `${r.rule} missing OWASP category`);
  assert(owaspIds.has(String(r.owasp).slice(0, 3)), `${r.rule} has an invalid OWASP category: ${r.owasp}`);
}
checks++;

/* ---------- 2. Correctness detection ---------- */
detects(js('if (a = 1) { b(); }'), 'assignment-in-condition', 'assignment in condition');
detects(js('try { risky(); } catch (e) {}'), 'empty-catch', 'empty catch');
detects(js('function f(){ try { return 1; } finally { return 2; } }'), 'return-in-finally', 'return in finally');
detects(js('if (x == NaN) y();'), 'nan-comparison', 'NaN comparison');
detects(js('if (a == b) c();'), 'loose-equality', 'loose equality');
detects(js('parseInt(input);'), 'parseint-no-radix', 'parseInt without radix');
detects(js('debugger;'), 'debugger-statement', 'debugger left in code');
detects(js('fetch(u).then(r => r.json());'), 'unhandled-promise-rejection', 'promise without catch');
detects(js('const d = JSON.parse(raw);'), 'unguarded-json-parse', 'unguarded JSON.parse');
detects(js('switch(x){case 1: a(); break; case 1: b(); break;}'), 'duplicate-case-label', 'duplicate case');
detects(js('async function f(){ for (const x of xs) { await g(x); } }'), 'await-in-loop', 'await in loop');

/* ---------- 3. Structural parse check (CSP-safe) ---------- */
let r = js('function f() { if (a) { b(); }');
detects(r, 'unclosed-bracket', 'unclosed brace');
assert.equal(r.parsed, false, 'unbalanced source must not report parsed:true');
checks++;

detects(js('const s = "never closed;\nmore();'), 'unterminated-string', 'unterminated string');
detects(js('f(a]);'), 'mismatched-bracket', 'mismatched bracket');

// Valid, non-trivial source must parse and stay quiet.
r = js([
  '"use strict";',
  'export async function load(url) {',
  '  try {',
  '    const res = await fetch(url);',
  '    if (!res.ok) throw new Error(`bad ${res.status}`);',
  '    return await res.json();',
  '  } catch (err) {',
  '    report(err);',
  '    return null;',
  '  }',
  '}'
].join('\n'));
assert.equal(r.parsed, true, 'valid source must report parsed:true');
clean(r, 'valid async/await source');

// Regex literals containing brackets must not break the balance analyzer.
r = js('const re = /[{(]/g;\nconst s = "}}}";\n// )))\nconst t = 1;\n');
assert.equal(r.parsed, true, 'regex/comment brackets must not unbalance the parse check');
clean(r, 'brackets inside regex, string and comment');

/* ---------- 4. Security detection, mapped to OWASP ---------- */
detects(sec('eval(userInput);'), 'eval-call', 'eval');
detects(sec('el.innerHTML = userInput;'), 'html-injection-sink', 'innerHTML sink');
detects(sec('exec("ls " + userDir);'), 'command-injection', 'command injection');
detects(sec('db.query("SELECT id FROM users WHERE name = " + name);'), 'sql-string-building', 'SQL concatenation');
detects(sec('const q = `UPDATE users SET name = ${name}`;'), 'sql-string-building', 'SQL template literal');
detects(sec('process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";'), 'tls-verification-disabled', 'TLS verification off');
detects(sec('const t = jwt.sign(p, k, { algorithm: "none" });'), 'jwt-alg-none', 'JWT alg none');
detects(sec('crypto.createHash("md5").update(pw);'), 'weak-hash', 'weak hash');
detects(sec('const sessionToken = Math.random().toString(36);'), 'insecure-randomness', 'insecure randomness for a token');
// Scoped deliberately: benign random use must NOT be reported as a crypto failure.
clean(sec('const jitter = Math.random() * 100;'), 'benign Math.random use');
detects(sec('window.postMessage(data, "*");'), 'postmessage-wildcard-origin', 'wildcard postMessage');
detects(sec('obj[key].__proto__ = value;'), 'prototype-pollution-sink', 'prototype pollution');
detects(sec('console.log("password:", password);'), 'sensitive-data-logged', 'secret logged');

// Secrets are matched against raw source, because they live inside strings.
detects(sec('const k = "sk-abcdefghijklmnopqrstuvwxyz123456";'), 'hardcoded-openai-key', 'OpenAI key');
detects(sec('const t = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";'), 'hardcoded-github-token', 'GitHub token');
detects(sec('const k = "AIzaSyA1234567890abcdefghijklmnopqrstuvw";'), 'hardcoded-google-key', 'Google key');
detects(sec('const k = "AKIAIOSFODNN7EXAMPLE";'), 'hardcoded-aws-key', 'AWS key');

for (const f of sec('eval(x);').findings) {
  if (f.rule === 'eval-call') assert.match(f.owasp, /^A0[1-9]|^A10/, 'security finding must carry an OWASP category');
}
checks++;

/* ---------- 5. Two-layer masking: the false-positive contract ---------- */
// Rules that match code shape must ignore comments and strings...
clean(sec('// eval(x) is dangerous\n/* el.innerHTML = y */\nconst doc = "call eval(x) here";\n'),
  'code-shape rules inside comment/string');

// ...but rules that must read string CONTENT still have to fire. If the string
// layer were dropped, these rules would be silently dead.
detects(sec('crypto.createHash("md5");'), 'weak-hash', 'string-content rule still fires');
detects(sec('fetch("http://api.example.com/v1");'), 'insecure-http-url', 'insecure URL read from string');

// A URL inside a comment is not code, so it must stay quiet.
clean(sec('// see http://example.com for details\nconst a = 1;\n'), 'URL inside a comment');

/* ---------- 6. Line numbers must be usable for a targeted edit ---------- */
r = sec('const a = 1;\nconst b = 2;\neval(bad);\n');
const evalFinding = r.findings.find(f => f.rule === 'eval-call');
assert.equal(evalFinding.line, 3, `expected line 3, got ${evalFinding.line}`);
assert.match(evalFinding.evidence, /eval\(bad\)/, 'finding must quote the offending code');
checks++;

// Masking must preserve length and newlines, or every line number drifts.
const src = 'const a = "hello";\n// note\nconst b = /x{2}/;\n';
const masked = E.maskJsSource(src).masked;
assert.equal(masked.length, src.length, 'masking must preserve source length');
assert.equal(masked.split('\n').length, src.split('\n').length, 'masking must preserve line count');
checks++;

/* ---------- 7. WCAG contrast maths ---------- */
// contrastRatio takes CSS colour strings and parses them internally.
assert.equal(Math.round(E.contrastRatio('#000', '#fff')), 21, 'black on white must be 21:1');
assert.equal(Math.round(E.contrastRatio('#fff', '#fff')), 1, 'white on white must be 1:1');
assert.equal(Math.round(E.contrastRatio('black', 'white')), 21, 'named colours must resolve');
assert.equal(Math.round(E.contrastRatio('rgb(0,0,0)', '#ffffff')), 21, 'rgb() must resolve');
assert.equal(E.contrastRatio('nonsense', '#fff'), null, 'unparseable colour must return null, not a fake ratio');
assert.deepEqual(E.parseCssColor('#fff'), [255, 255, 255], 'short hex must expand');
checks++;

detects(css('.a { color: #aaaaaa; background: #ffffff; }'), 'insufficient-color-contrast', 'low contrast');
clean(css('.a { color: #111111; background: #ffffff; }'), 'high contrast');

/* ---------- 8. UI/UX rules ---------- */
detects(css('button:focus { outline: none; }'), 'focus-outline-removed', 'focus outline removed');
detects(css('.btn:hover { color: red; }'), 'hover-without-focus', 'hover without focus');
detects(css('.x { transition: all .3s; } .y { animation: spin 1s; }'), 'no-reduced-motion-support', 'no reduced-motion');
detects(css('.tiny { font-size: 9px; }'), 'font-size-too-small', 'font too small');
detects(css('.wrap { width: 1200px; }'), 'fixed-large-width', 'fixed large width');

// RTL rules must only apply when the content is right-to-left.
detects(css('.card { margin-left: 12px; }', true), 'physical-property-in-rtl', 'physical margin under RTL');
clean(css('.card { margin-left: 12px; }', false), 'physical margin under LTR');

assert.equal(E.looksRightToLeft('مراجعة الكود'), true, 'Arabic text must be detected as RTL');
assert.equal(E.looksRightToLeft('code review'), false, 'English text must not be detected as RTL');
checks++;

/* ---------- 9. Inline <script> extraction ---------- */
const html = '<html>\n<body>\n<p>hi</p>\n<script>\neval(x);\n</script>\n</body>\n</html>';
const inline = E.inlineScriptSource(html);
assert.match(inline, /eval\(x\)/, 'inline script body must be extracted');
assert.doesNotMatch(inline, /<p>hi<\/p>/, 'markup must not leak into the JS analysis');
assert.equal(inline.split('\n').length, html.split('\n').length, 'extraction must preserve line numbers');
checks++;

/* ---------- 10. The blocking gate ---------- */
let res = E.buildReviewResult({ kind: 'js_validator', reports: [sec('eval(x);')] });
assert.equal(res.ok, false, 'a critical finding must block');
assert(res.summary.blocking > 0, 'blocking count must be reported');
assert.match(res.recommendation, /before writing the final code|before/i, 'must tell the agent to fix before final code');
checks++;

res = E.buildReviewResult({ kind: 'js_validator', reports: [js('var x = 1;')] });
assert.equal(res.ok, true, 'low-severity findings must not block');
assert(res.summary.findings > 0, 'non-blocking findings must still be reported');
checks++;

res = E.buildReviewResult({ kind: 'js_validator', reports: [js('const x = 1;\n')] });
assert.equal(res.ok, true);
assert.equal(res.summary.findings, 0);
assert.match(res.recommendation, /does not replace running the code|testing behavior/i,
  'a clean report must still state that static analysis is not proof');
checks++;

/* ---------- 11. Honest limitations ---------- */
r = E.analyzeJavaScriptSource('t.ts', 'const x: number = 1;\ninterface A { b: string }\n');
assert(r.parseNote, 'TypeScript must report an explicit limitation rather than silently passing');
assert.match(r.parseNote, /TypeScript|type/i);
checks++;

/* ---------- 12. Findings are capped so one pattern cannot flood a report ---------- */
r = js(Array.from({ length: 30 }, (_, i) => `var v${i} = ${i};`).join('\n'));
const varFindings = r.findings.filter(f => f.rule === 'var-declaration' && f.severity !== 'info');
assert(varFindings.length <= 5, `per-rule cap not applied: ${varFindings.length} findings`);
assert(r.findings.some(f => f.severity === 'info' && /suppress/i.test(f.message)),
  'suppressed matches must be disclosed, not hidden');
checks++;

/* ---------- 13. Findings are ordered by severity ---------- */
r = sec('var a = 1;\neval(bad);\n');
const rank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const seq = r.findings.map(f => rank[f.severity]);
assert.deepEqual(seq, [...seq].sort((a, b) => a - b), 'findings must be sorted worst-first');
checks++;

/* ---------- 14. No false positives on this repository's own code ---------- */
// The strongest anti-false-positive test available: real, reviewed source.
for (const file of ['lib/utils.js', 'lib/provider-adapters.js', 'api/agent.js']) {
  const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  const parsed = E.analyzeJavaScriptSource(file, code);
  assert.equal(parsed.parsed, true, `${file} must parse cleanly`);
  const bad = parsed.findings.filter(f => f.severity === 'critical');
  assert.equal(bad.length, 0, `${file} produced critical correctness findings: ${JSON.stringify(bad)}`);

  const audit = E.analyzeSecurityRisks(file, code);
  const fp = audit.findings.filter(f => f.rule === 'sql-string-building' || f.rule === 'hardcoded-openai-key');
  assert.equal(fp.length, 0, `${file} produced known-false-positive rules: ${JSON.stringify(fp)}`);
  checks++;
}

/* ---------- 15. Registration contract ---------- */
for (const name of ['js_validator', 'security_audit', 'ux_review']) {
  assert(app.includes(`case"${name}":`), `${name} missing executeTool branch`);
  assert(new RegExp(`^ ${name}:\\{description:`, 'm').test(app), `${name} missing nativeDefs entry`);
  assert(app.includes(`${name}:"auto"`), `${name} missing default permission`);
  checks++;
}
assert.match(app, /name: code-review/, 'code-review Skill must be registered');
assert.match(app, /chain\.push\("code-review"\)/, 'code-review Skill must be reachable from the Skill chain router');
checks++;

reportFailures();

console.log(`code review tool guards ok • ${checks} assertions • ${E.JS_CORRECTNESS_RULES.length} correctness + ${E.SECURITY_RULES.length} security + ${E.SECRET_RULES.length} secret rules`);
