# Verification — Delegate Council

- Date: 2026-09-27
- Runtime: Node 24.18.0 on Windows.
- `npm test`: passed, exit code 0. Includes all original suites and new delegate/harness tests.
- Engine/adapter tests: ordered turns, prior contributions, chosen moderator, distinct providers/models, streaming updates, cancellation, invalid config, empty reply, provider error, persisted transcript, model override restoration.
- Browser integration: selected Delegate mode, removed third participant, assigned reviewer to Gemini with a different model, selected one round and reviewer as moderator, saved, submitted a test prompt. Observed 3 completed turns and final answer; restored the saved team/transcript after reload.
- Local fixture captured requests in order: opencode/mimo-v2.5-free, gemini/demo-reviewer, gemini/demo-reviewer; all had zero tools. These are MOCK responses, not live model evidence. Fixture is outside the delivered project.
- Layout: checked 390px and 1280px widths; no horizontal document overflow. Editor adapts from one card column to two. Screenshot is provided separately.
- Existing test repairs: Windows file URL path conversion; stale inert-settings exception list; missing harness-runtime test implementation. No provider secrets changed.
- Live upstream models were not called. Configure the existing server environment variables and select models available to your provider account.
