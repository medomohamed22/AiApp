# AiWay Agent Maintenance Rules

- Preserve working features unless a requested change explicitly alters them.
- Never exceed 12 top-level JavaScript files in `/api`; place shared implementation in `/lib`.
- Treat tool execution, MCP, browser access, secrets, publishing, uploads, and sandbox operations as security boundaries.
- Skills must use progressive disclosure: metadata first, instructions only when relevant, resources only when specifically needed.
- Keep tool schemas machine-valid and validate arguments locally before side effects.
- Adding a native tool requires four steps: a `nativeDefs` entry, an `executeTool` branch, a **default entry in `toolPermissions`**, and a `tool_search` alias. Skipping the permission entry leaves the tool dead at runtime.
- Every server-side environment variable must be documented in `.env.example`.
- Any file added to `tests/` must be wired into a `package.json` script, or it never runs.
- A settings control in `index.html` must be read by the runtime; do not add switches that persist a value but change nothing.
- Run `npm test` before considering a repository change complete.
- See `docs/CODE-MAP.md` for orientation and `docs/known-issues.md` for tracked debt.
