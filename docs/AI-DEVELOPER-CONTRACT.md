# AI Developer Contract

## Preserve working features
Changes must preserve established behavior unless the user explicitly asks to change or remove it. Prefer narrow, reviewable changes and regression tests.

## API budget
The Vercel deployment must keep **12 top-level JavaScript files in `/api`** or fewer. Shared helpers belong in `/lib`.

## Vercel compatibility requirements
Server code must remain compatible with the configured Node runtime, serverless request-size constraints, secure environment-variable handling, and Vercel Sandbox boundaries. Browser code must not receive provider secrets.

## Agent architecture
Use model-owned tool choice with a small initial capability surface, deferred discovery for long-tail tools, progressive Skill disclosure, schema validation before execution, human approval for side effects, and explicit tool-result evidence before claiming success.
