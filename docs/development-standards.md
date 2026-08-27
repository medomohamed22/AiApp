# Development Standards

1. Validate all external input at trust boundaries.
2. Keep side-effecting tools approval-gated by default.
3. Store source artifacts losslessly; retrieve large content in bounded slices.
4. Keep Skills modular and progressively disclosed.
5. Preserve MCP protocol metadata, pagination, errors, and version behavior.
6. Add regression coverage for repaired bugs and architecture invariants.
7. Run `npm test` before release.
