# Context Window Management Re-audit — 2026-08-27

AiWay now treats model context as a finite runtime resource rather than a fixed character slice.

## Production principles applied

- The provider/model context window is a hard limit. Output tokens, system instructions, tool schemas, and a safety reserve are deducted before chat history is selected.
- The manual character setting controls the initial chat-history ceiling only; it can never override the model hard limit.
- Every model turn is guarded, including later turns after tool execution. This closes the previous bug where the first turn was bounded but `tool` results accumulated without a budget.
- Old, re-fetchable tool outputs are cleared from active context while preserving the tool call/result protocol identity. The original Artifact, MCP result source, web source, or project file is not deleted.
- Recent tool results remain available so the model can act on fresh evidence.
- Earlier plain conversation turns are compacted only after tool-result clearing is insufficient. Tool-call/result pairs are never reordered or broken.
- A single oversized current tool result receives an active-context excerpt as a final fallback, with an explicit instruction to re-run the tool with a narrower range when exact omitted details are required.
- If the upstream provider still reports an input/context token-limit error, AiWay retries that model turn once using an emergency compaction profile.
- Compaction activity is recorded in the Agent Inspector with before/after estimated tokens and counts of cleared/compacted items.

## Why this matches modern agent runtimes

OpenAI Agents sessions support history compaction so long-running sessions can replace large histories with smaller equivalent state. Anthropic recommends compaction as the primary long-context strategy and separately supports clearing older tool results while retaining recent tool interactions. Google Gemini exposes `countTokens` and usage metadata so applications can preflight context size rather than waiting for provider rejection.

AiWay is multi-provider, so the default implementation is provider-neutral and runs before every upstream request. Provider-native context-management features can be layered on later when a specific gateway guarantees support, without making correctness depend on one vendor-specific beta.

## Important invariant

Storage is lossless; active model context is bounded. A large `index.html` remains complete in Artifacts/Sandbox, while only the currently relevant parts are allowed into the model window.
