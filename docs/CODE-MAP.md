# Code Map

Orientation for humans and AI agents. Read this before changing anything.

## Shape

AiWay is a **browser-first agent**. The agent loop, tool registry, Skills, MCP
client, memory, and all project state live in the browser (`assets/app.js`,
IndexedDB). The `/api` routes are thin, secret-holding proxies. No provider
secret ever reaches browser code.

```
index.html ──> assets/app.js ──> /api/* ──> external providers
                    │
                    └──> IndexedDB (chats, skills, memory, mcp, artifacts, ...)
```

## Files

| Path | Role |
| --- | --- |
| `index.html` | App shell, all sheets/panels, settings controls (control `id` must match a settings key). |
| `assets/app.js` | Everything client-side: agent loop, `nativeDefs` tool registry, Skills, MCP client, memory, artifacts, routing, UI. |
| `assets/app.css` | Styles. |
| `lib/utils.js` | Shared server helpers: `allowMethod`, `bodyJson`, `json`, `env`, `rateLimit`, `requireAppAccess`, `secureEqual`, `requestAbortSignal`. |
| `lib/provider-adapters.js` | Provider protocol selection and request/response shaping (`openCodeProtocol`). |
| `lib/vercel-api.js` | Vercel REST helpers used by publishing routes. |
| `api/ai.js` | Streaming chat completion proxy. |
| `api/models.js` | Model catalog + capability metadata. |
| `api/search.js` | Exa live web search. |
| `api/agent.js` | **Security-critical.** Browser gateway (SSRF-guarded), MCP proxy, Vercel Sandbox ops. |
| `api/publish.js` / `api/publish-check.js` | GitHub + Vercel publishing and credential preflight. |
| `api/environment.js` | Vercel env-var names/values (production + preview only). |
| `api/health.js` | Health/diagnostics. |

**Hard budget: at most 12 top-level `.js` files in `/api`** (currently 8). Shared
implementation belongs in `/lib`.

## Agent loop (assets/app.js)

1. `hybridRoutePlan(userText, mode)` — derives intent/signals.
2. `toolCatalog()` — exposes a **tiny core catalog** (`web_search`, `tool_search`,
   plus `skill_read` when a Skill routes). The long tail stays deferred so the
   model keeps genuine `tool_choice: auto`.
3. `tool_search` → `deferredToolCandidates(query)` ranks and loads a small subset
   of native + HTTP + MCP tools on demand.
4. `askPermission(tool, args)` — `auto` runs, `ask` prompts the user, `off` blocks.
5. `executeTool(tool, args)` — MCP / HTTP / native `switch` branches.
6. `recordToolStat()` feeds reliability scores back into ranking.

### Adding a native tool — all four steps are required

1. Add the entry to `nativeDefs` with a description and an object JSON schema.
2. Add a `case "<name>":` branch in the `executeTool` switch.
3. **Add a default permission in `defaults.toolPermissions`.** Without this the
   tool is filtered out of routing and is dead at runtime even though it looks
   complete.
4. Add a discovery alias in `deferredToolCandidates` so `tool_search` can find it.

`tests/tool-registry-integrity.mjs` enforces steps 1–3.

## Skills

Skills are Markdown with YAML frontmatter (`name`, `description`, `version`,
`tags`), parsed by `skillInfo` / `parseFrontmatter`, stored in the `skills` store.
`CORE_AGENT_SKILLS` are seeded on first load. Disclosure is progressive:
`skill_list` (metadata) → `skill_read` (instructions) → `skill_resource_list` /
`skill_resource_read` (bounded resource slices, only when needed).

## Security boundaries — do not weaken

- `api/agent.js`: SSRF blocking (`assertPublicUrl`, `isPrivateIp`), header
  allow/deny lists, bounded response reads, sandbox path traversal guards,
  sandbox network denied by default.
- Secrets stay server-side; `environment_set` collects values via a separate
  prompt the model never sees.
- Side-effecting tools default to `ask`.
- CSP and security headers live in `vercel.json`.

## Tests

`npm test` runs every suite. Any test file added to `tests/` must be wired into a
`package.json` script or it never runs. See `docs/known-issues.md` for tracked debt.

## Pre-publish code review tools

Three tools review generated code before the agent delivers a final version.
They live in the "Static code review" block in `assets/app.js`, just above
`executeTool`, and are driven by the `code-review` Skill.

| Tool | Scope | Rules |
| --- | --- | --- |
| `js_validator` | JS/TS correctness and reliability, incl. inline `<script>` | structural parse check + 15 rules |
| `security_audit` | Security risk mapped to OWASP Top 10:2025 | 32 rules + 7 secret detectors |
| `ux_review` | Accessibility, WCAG contrast, interaction states, RTL | CSS + DOM rules |

Design constraints worth preserving:

- **No `eval` / `new Function`.** The site ships under CSP `script-src 'self'`
  with no `unsafe-eval` (`vercel.json`), so the parse check is a structural
  bracket/literal analyzer, not an evaluator. `tests/code-review-tools.mjs`
  enforces this.
- **Two-layer masking.** `maskJsSource` produces one layer with strings blanked
  (for rules matching code *shape*, e.g. `eval(`) and one with strings kept (for
  rules reading string *contents*, e.g. `"md5"`, SQL fragments). A rule opts into
  the second layer with `strings:true`. Forgetting that flag makes a rule
  silently dead — this actually happened and is now covered by a test.
- **Findings are actionable.** Every finding carries file, line, evidence,
  severity and a fix, so the agent can use `artifact_edit` instead of rewriting
  files. `critical`/`high` block delivery; `medium`/`low` are judgement calls.
- **Limitations are reported, not hidden.** TypeScript/JSX input returns an
  explicit `parseNote`, and per-rule caps disclose suppressed matches, so a clean
  report is trustworthy.

`ux_review` is static (DOMParser, nothing executes). Rendered geometry and
overflow remain the job of `browser_preview` and `responsive_test`.
