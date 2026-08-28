# Known Issues / Tracked Debt

Findings from the 2026-08-28 repository audit. Items are listed so they are
visible and bounded rather than rediscovered later.

## Fixed in this pass

| Issue | Impact | Fix |
| --- | --- | --- |
| `.env.example` missing | `npm test` crashed — `test:exa` and `test:wiring` both read it | Reconstructed from every `env()` / `process.env` reference in `api/` + `lib/` |
| `.gitignore` missing | `node_modules/` showed as untracked; risk of committing `.env` | Added, with `!.env.example` kept tracked |
| `skill_resource_list` / `skill_resource_read` had no default permission | Both tools were **dead at runtime**: schema + executor existed, but routing filtered them out, so Skill resources could never be read | Added `auto` defaults; regression test added |
| `docs/CODE-MAP.md` missing | `opencode.json` pointed every agent at a nonexistent instruction file | Written |
| `tests/artifact-lossless-regression.mjs` orphaned | Test existed but no script ran it | Wired into `test:client` |
| Stray 1-byte files `assets/m`, `lib/m`, `tests/m` | Junk from a shell redirect typo | Deleted |
| Dead functions: `compactNum`, `webSearchAllowed`, `safeJson`, `openRouterTurn` | Unreachable code; `openRouterTurn` was a legacy wrapper superseded by `openAICompatibleTurn({provider})` | Removed |

## Open: inert settings

These render a control in `index.html` and persist a value, but **no runtime code
reads them**. Toggling them changes nothing:

| Setting | Intended purpose |
| --- | --- |
| `contextMode` | Smart vs. manual context selection |
| `skillRouter` | Toggle automatic Skill routing |
| `mcpRouter` | Toggle MCP capability routing |
| `workspaceAwareness` | Toggle workspace snapshot injection |
| `agentInspector` | Toggle the run inspector panel |

`tests/tool-registry-integrity.mjs` freezes this list as a debt ceiling: adding a
new inert switch fails the suite, and wiring one up requires removing it from the
list. Each needs either a real read site or removal of its control — deliberate
behavior changes, so they are left for an explicit follow-up request.

## Open: intentionally retained

- `mcpRouteScore` and `nativeToolRouteScore` are defined but never called. They
  are asserted by `tests/agent-intelligence-2026.mjs`, so they were **not**
  removed. Either wire them into routing or relax that test — do not delete them
  silently.
- `optimizedProjectContext` is uncalled and has no test guard, but it holds the
  project-context budgeting logic. Left in place pending a decision on whether
  context injection should use it.

## Notes

- `engines.node` is `24.x`; the sandbox runs Node 22. Tests pass on both, but
  Vercel builds on 24.
- `README.md` is a single heading. Consider real setup/deploy docs.
- Three dated audit files in `docs/` overlap heavily; they are historical records,
  not current specs.
