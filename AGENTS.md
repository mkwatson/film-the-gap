# Repository instructions

These instructions apply to the entire repository.

## Product contract

- Keep one coherent end-to-end product: a shopper asks an observable product question; existing reviewed evidence answers it or WebMCP creates a bounded filming mission; a product owner records and reviews the missing proof; the first answer changes; a later matching shopper reuses the citation.
- WebMCP is load-bearing. Tools must be page-owned, narrow, state-dependent, human-visible, cancellable where the runtime permits, and protected against stale state.
- Keep public discovery leads, media reuse rights, model proposals, contributor review, capture timing, and claim truth explicitly distinct.
- Never claim that a phrase, digest, model, public URL, or contributor assertion proves identity, ownership, authenticity, deepfake absence, or ground truth.
- Keep the no-login ordinary-browser path working alongside native WebMCP.

## Current-documentation rule

- Read current first-party documentation before changing WebMCP, Next.js, React, Cloudflare, Vercel AI SDK/Gateway, Gemini, or any other evolving integration.
- Pin challenge-critical direct dependencies exactly. Check peer compatibility across the complete graph; newest means the newest cohesive proven matrix.
- After a material change, run the relevant focused test and the complete hero journey. Before a release, run `pnpm peers check`, `pnpm check`, the native acceptance runner, the independent WebMCP evals, and a cold clone.
- Do not claim ChatGPT, Chrome, phone, public-service, or deployment compatibility until that exact runtime and frozen revision pass.

## TypeScript and tests

- Use strict TypeScript with `unknown` instead of `any`, type guards for narrowing, ES modules, named exports, explicit return types on exports, no unused code, and `readonly` where mutation is unnecessary.
- Prefer interfaces for object shapes and types for unions/intersections.
- Use 2 spaces, single quotes, and semicolons.
- Write Vitest behavior tests for non-trivial code. Prefer real domain objects; mock only external services.
- Keep formatting, zero-warning lint, strict typechecking, tests, the Worker dry-run, and the production Next.js build green.

## Safety and release truth

- Do not expose bearer capabilities, vendor keys, raw private URLs, personal data, or paid-service credentials in logs, screenshots, tools, or repository files.
- Do not call paid services, mutate external accounts, deploy, publish, push, upload, or submit without the repository owner's explicit approval.
- Preserve rights-clean demo assets and an honest fallback when an external service is unavailable.
- Treat [SUBMISSION.md](SUBMISSION.md), [DEMO.md](DEMO.md), [DEPLOYMENT.md](DEPLOYMENT.md), and [VERIFICATION.md](VERIFICATION.md) as release contracts; update them when behavior or claims change.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
