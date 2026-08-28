# AiWay

A browser-first AI agent with model-owned tool choice, progressively disclosed
Skills, MCP client support, local project artifacts, and a GitHub + Vercel
publishing pipeline.

The agent loop, tool registry, Skills, memory, and all project state run in the
browser and persist to IndexedDB. The `/api` routes are thin, secret-holding
proxies — **no provider key ever reaches browser code**.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in at least one model provider key
npm test                     # run the full guard suite
```

Deploy to Vercel (Node 24 runtime). Set the same variables in the Vercel project
rather than committing them.

## Environment variables

See `.env.example` for the full annotated list. Minimum to get running: one model
provider key (e.g. `OPENCODE_API_KEY` or `GEMINI_API_KEY`).

| Group | Variables |
| --- | --- |
| Providers | `OPENCODE_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `BAI_API_KEY`, `NEW_API_KEY`, `HERMES_API_KEY` |
| Search | `EXA_API_KEY` |
| Publishing | `PUBLISH_SECRET`, `GITHUB_TOKEN`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID` |
| Access | `APP_ACCESS_KEY`, `APP_URL`, `AIWAY_RATE_LIMIT_PER_MINUTE` |

Every server-side variable must be documented in `.env.example` —
`tests/integration-wiring.mjs` enforces this.

## Architecture

| Path | Role |
| --- | --- |
| `index.html` | App shell and all UI panels |
| `assets/app.js` | Agent loop, tool registry, Skills, MCP client, memory, artifacts |
| `lib/` | Shared server helpers (utils, provider adapters, Vercel API) |
| `api/` | Serverless routes — **max 12 files**, currently 8 |
| `tests/` | Regression guards, all wired into `npm test` |
| `docs/CODE-MAP.md` | Detailed orientation — read this before changing code |

## Agent capabilities

**Tools** are exposed with a deliberately tiny core catalog (`web_search`,
`tool_search`) so the model retains genuine `tool_choice: auto`. The long tail is
loaded on demand through `tool_search`. Tools cover project artifacts (including
surgical `artifact_edit`), search, browsing, a real Vercel Sandbox, memory,
planning, subagents, evaluation, and publishing.

Each tool has a permission of `auto`, `ask`, or `off`; side-effecting tools
default to `ask`.

**Skills** are Markdown + YAML frontmatter, disclosed progressively: metadata →
instructions → bounded resource slices. Seeded core Skills cover planning, secure
coding, deep research, root-cause debugging, data processing, coding, and UI/UX.

**MCP** servers are supported over both the modern and legacy protocols, with
pagination, capability classification, and per-tool permissions.

## Contributing

1. Read `AGENTS.md` and `docs/CODE-MAP.md`.
2. Preserve existing behavior unless the change explicitly targets it.
3. Adding a native tool requires **all four** steps in `docs/CODE-MAP.md`,
   including a default permission — otherwise the tool is dead at runtime.
4. Any new test file must be wired into a `package.json` script.
5. Run `npm test` before considering a change complete.

Tracked debt is listed in `docs/known-issues.md`.
