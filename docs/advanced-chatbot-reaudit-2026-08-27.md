# Advanced Chatbot Re-audit — 2026-08-27

This second audit reviewed the post-audit project again against current official agent/tool documentation from OpenAI, Anthropic, Google Gemini, and MCP.

## Applied improvements

### 1. Safe parallel tool execution

Models can emit multiple independent tool calls in one turn. AiWay previously executed every call serially. The agent loop now runs only explicitly read-only, auto-approved native tools concurrently and keeps side-effecting, approval-gated, browser-stateful, custom HTTP, and MCP tools sequential. Result order is preserved before returning tool results to the model.

This follows the parallel/compositional tool-call model documented by Gemini and the concurrency controls exposed by OpenAI Agents SDK, while preserving human approval boundaries.

### 2. Stronger execution tracing

Activity trace records now retain start time and duration for completed stages. The response UI displays per-stage durations in the expandable execution trace. This makes slow tools and failures much easier to diagnose and moves the local inspector closer to production agent tracing systems.

### 3. Pinned-message context semantics

The UI already allowed users to pin messages, but the context selector ignored that signal. Pinned user/assistant messages now survive ordinary recent-history truncation subject to the same global token budget. Recent messages are then filled around them and the final context is restored to chronological order.

### 4. Retry and edit-and-resend UX

Assistant messages now expose Retry. User messages expose Edit and resend. Replaying truncates the conversation at the selected user turn and performs a clean new run, so contradictory future turns are not leaked into the new model context.

### 5. MCP 2026 stateless transport correction

For MCP `2026-07-28`, AiWay no longer sends or persists the legacy `Mcp-Session-Id`. Legacy MCP fallback keeps its session behavior. This matches the current stateless MCP core.

### 6. External tool name collision prevention

Deferred custom HTTP tools are now namespaced (`http__...`) before exposure to the model. Their human-readable original name is retained separately. This prevents silent collisions with native tools or other deferred tools.

### 7. Fuller JSON Schema validation

Local pre-execution validation now understands more of the JSON Schema features used by modern MCP tool schemas, including `allOf`, `anyOf`, `oneOf`, local `$defs` references, `const`, item/string bounds, numeric bounds, patterns, and `additionalProperties: false`.

## Architecture principles retained

- Small stable core tool catalog plus deferred discovery.
- Progressive Skill disclosure: metadata -> instructions -> optional resources.
- Lossless Artifact storage with bounded reads.
- Side effects behind explicit permissions.
- Provider-native tool/thinking state preserved where required (notably Gemini signatures/parts).
- Same-chat history is the default conversational context; project, memory, and other sessions are retrieved intentionally.
- Sandbox execution stays isolated and network-denied by default.

## Official references reviewed

- OpenAI Agents SDK overview: https://openai.github.io/openai-agents-js/
- OpenAI Agents SDK running agents: https://openai.github.io/openai-agents-js/guides/running-agents/
- OpenAI Agents SDK guardrails: https://openai.github.io/openai-agents-js/guides/guardrails/
- OpenAI Agents SDK sessions: https://openai.github.io/openai-agents-js/guides/sessions/
- OpenAI Agents SDK tracing: https://openai.github.io/openai-agents-js/guides/tracing/
- Anthropic Agent Skills: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Anthropic tool reference / deferred loading: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-reference
- Anthropic strict tool use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- Anthropic tool use with prompt caching: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching
- Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Gemini tool architecture: https://ai.google.dev/gemini-api/docs/tools
- Gemini tool-combination state/signatures: https://ai.google.dev/gemini-api/docs/tool-combination
- Gemini context caching: https://ai.google.dev/gemini-api/docs/caching
- MCP 2026-07-28 release: https://blog.modelcontextprotocol.io/posts/2026-07-28/
