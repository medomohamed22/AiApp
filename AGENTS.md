# AiWay Agent Maintenance Rules

- Preserve working features unless a requested change explicitly alters them.
- Never exceed 12 top-level JavaScript files in `/api`; place shared implementation in `/lib`.
- Treat tool execution, MCP, browser access, secrets, publishing, uploads, and sandbox operations as security boundaries.
- Skills must use progressive disclosure: metadata first, instructions only when relevant, resources only when specifically needed.
- Keep tool schemas machine-valid and validate arguments locally before side effects.
- Run `npm test` before considering a repository change complete.
