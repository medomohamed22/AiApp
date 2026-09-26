# AiWay

AiWay is a browser-first AI agent and coding workspace for projects, sessions, files, tools, Skills, MCP integrations, persistent sandbox execution, web research, memory and deployment.

## Agent Workspace

The Agent Workspace tracks each coding task as a durable Run with planning, execution, testing and review phases. File modifications are collected into ChangeSets so the user can inspect diffs and explicitly Accept or Revert the result. Sessions support event logs, checkpoints, restore, branching, export and side-by-side viewing. Project Goals, local schedules and a persistent Vercel Sandbox terminal are also available from the same workspace.

## Run locally

```bash
npm install
npm test
npx vercel dev  # or serve the project with your normal Vercel-compatible local workflow
```

The application stores browser-side project state in IndexedDB. Provider secrets stay server-side behind `/api` routes. See `.env.example`, `docs/CODE-MAP.md`, `docs/AI-DEVELOPER-CONTRACT.md`, and `docs/harness-upgrade-2026-09-26.md` before changing architecture.

## Security

Do not move provider or publishing secrets into client code. The agent gateway blocks private-network browser targets, limits response sizes, validates sandbox paths and keeps sandbox networking denied by default. Side-effecting model tools default to user approval.

## Verification

Run the full regression suite before publishing:

```bash
npm test
```
