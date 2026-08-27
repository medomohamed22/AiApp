# Agent Architecture Audit — 2026-08-27

This project was audited against current agent/tool patterns from OpenAI, Anthropic, Google Gemini, and Model Context Protocol (MCP).

## Applied architecture changes

- Reconnected automatic Skill routing to the live tool catalog.
- Added progressive Skill disclosure: metadata/router -> `skill_read` -> optional resource list/read.
- Added project-backed Skill resources under `.aiway/skills/<skill-name>/...`.
- Added local tool argument validation before permission checks and execution.
- Preserved human approval boundaries for side-effecting tools.
- Added MCP `tools/list` cursor pagination and normalized MCP `isError` results as failures.
- Preserved the modern MCP 2026-07-28 stateless path while keeping legacy fallback support.
- Preserved lossless Artifact storage and paginated Artifact reading.
- Added chunked Sandbox synchronization so large Artifacts are no longer silently omitted from the executable workspace.
- Repaired the test/CI contract and added architecture regression coverage.

## Design principles

1. Keep tool descriptions small and explicit; expose only relevant capabilities each turn.
2. Validate structured tool input locally before execution.
3. Separate capability discovery from capability execution.
4. Keep Skills composable and progressively disclosed rather than injecting every instruction/resource into context.
5. Treat external/MCP tool errors as model-visible failures, not successful outputs.
6. Keep irreversible or external side effects behind explicit permissions.
7. Store source files losslessly; retrieve/read them in bounded ranges and synchronize large files in bounded chunks.
8. Preserve provider-native state metadata when required (for example Gemini thinking/function-call state) instead of flattening it unnecessarily.

## References

- OpenAI Agents SDK — Agents: https://openai.github.io/openai-agents-js/guides/agents/
- OpenAI Agents SDK — Tools: https://openai.github.io/openai-agents-js/guides/tools/
- OpenAI Agents SDK — Schema validation: https://openai.github.io/openai-agents-js/guides/schemas/
- Anthropic — Agent Skills: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Google Gemini — Function calling: https://ai.google.dev/gemini-api/docs/function-calling
- MCP 2026-07-28 specification release: https://blog.modelcontextprotocol.io/posts/2026-07-28/
