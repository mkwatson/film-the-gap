# Verification and current boundaries

Updated August 28, 2026 PT. This document records what the current product-evidence candidate has actually passed. It deliberately separates deterministic integration proof from public-service and physical-world acceptance.

## Current release matrix

| Gate                          | Result                                             | What it proves                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm peers check`            | Pass, zero peer issues                             | The exact pinned dependency graph is internally compatible.                                                                                                      |
| Production dependency audit   | Pass, no known vulnerabilities                     | Every installed production dependency declares a recognized open-source license.                                                                                 |
| `pnpm check`                  | Pass                                               | Prettier, zero-warning ESLint, strict TypeScript, all tests, Worker bundle, and production Next.js build.                                                        |
| App tests                     | 26 files, 159 tests pass                           | Product state, owned demo page, dynamic tools, privacy, review, search, page-reading boundaries, reconnect, failures, and release checks.                        |
| Worker tests                  | 6 files, 34 tests pass in Workerd                  | Durable Object, D1, Browser Run contract, role capabilities, uploads, model proposal, reuse, expiry, quota, and denial paths.                                    |
| Worker dry run                | Wrangler 4.127.0; 1,135.50 KiB / 191.15 KiB gzip   | The standalone evidence Worker bundles with every declared production binding, including Browser Run.                                                            |
| Next.js build                 | Next.js 16.3.3; seven route entries                | The shopper, owned demo product, board, recorder, search, and health surfaces build for production.                                                              |
| Cold clone                    | Frozen install and full gate pass; clean afterward | The repository does not depend on ignored files, generated files, or local package state.                                                                        |
| Native Chrome journey         | Eight steps pass                                   | The real app, native WebMCP registration, Durable Object, D1, WebSocket, and browser state complete the causal journey against deterministic paid-edge fixtures. |
| Ordinary-browser journey      | Eight steps pass with WebMCP disabled              | The same shopper, board, recorder, review, update, and reuse loop works through visible controls; the product is not an agent-only façade.                       |
| Chrome Labs independent smoke | 9/9 calls across four cases                        | The exact current source-built WebMCP evaluator independently discovers and executes the generic tool frontier.                                                  |
| Desktop/mobile visual check   | Pass at desktop and 390×844                        | Shopper, owned demo-product, board, and contributor pages remain legible with no horizontal overflow or framework error overlay.                                 |
| Repository content scan       | Pass                                               | The tracked tree contains text and one authored SVG, no binary media; a reachable-history secret-pattern scan found only environment-variable lookups.           |

The exact browser-release candidate `3d1fa4491b9ef640a7e4f943a0c602e5640bf2a5` passed a fresh clone, frozen install, peer check, full quality gate, production builds, and clean post-build worktree on August 28.

The later standalone-cleanup candidate `7611ec6f853cf93ae1967209239be1f08213ef62` removed the retired merchant, protected-preview, and synthetic-crowd harness paths. Both complete browser journeys and the same fresh-clone gate passed afterward; the product runtime did not change.

The search-first candidate `d332a7858bbecd20fc56e5fa4befb0794f4dd6b2` removed the manufactured pass/fail replay and made existing-evidence search the first native capability. On August 28, an exact fresh clone passed `pnpm install --frozen-lockfile`, the peer check, all 174 tests, the Worker dry-run, the six-route production build, and a clean post-build worktree. It remains the previous clean fallback.

The Browser Run candidate `f4d5671f088581ef99aa73ce7617291dc7cea903` added authenticated, same-origin, rights-aware supplied-page reading while preserving page copy as inconclusive; exact reviewed D1 evidence now short-circuits redundant public-provider calls. On August 28, an exact fresh clone passed the frozen install, peer check, all 189 tests, the Browser Run-bound Worker dry run, the six-route production build, and a clean post-build worktree.

The rights-clean source-page candidate `a008341d96b61dbd38e77bb80d584d08ad278fec` added an owned, same-origin `/demo-product` page, automatically binds it to the default case on public HTTPS and after reset, preserves the live Browser Run receipt beside the authored claim, and makes the exact page security policy and Content Signal part of release verification. On August 28, an exact fresh clone passed the frozen install, peer check, all 193 app/Worker tests, the Browser Run-bound Worker dry run, the seven-route production build, and a clean post-build worktree. This is the current locally frozen code candidate; `f4d5671f088581ef99aa73ce7617291dc7cea903` remains the previous clean fallback.

## Native end-to-end receipt

Chrome 151 completed the following sequence against the real local Next.js app, Cloudflare Worker runtime, Durable Object, D1 database, migrations, WebSocket updates, and WebMCP registrations:

1. Open the default unresolved case with Search—not mission creation—as the initial native capability: 2,533 ms.
2. Open an arbitrary product, read bounded page context, and search existing evidence through WebMCP: 922 ms.
3. Create a bounded missing-proof mission and private phone handoff: 912 ms.
4. Explicitly publish the minimized request, then inspect and claim it from a fresh board context: 623 ms.
5. Scrub the contributor capability from the URL and recover it after reload: 413 ms.
6. Upload a generated rights-clean clip, receive a model-shaped proposal, correct it, choose reuse rights, and publish: 1,643 ms.
7. Observe the first shopper's live answer change and exact timestamp citation: 863 ms.
8. Open a fresh matching case, reuse the same reviewed source without another mission, and skip redundant public-provider calls: 767 ms.

The fixtures replace only Cloudflare Stream, Cloudflare Browser Run, and the video-model response. The page fixture rejects requests unless the Worker supplies the exact same-origin pattern, blocked resource types, headers, timeouts, and cache boundary expected in production. Browser egress to the public paid-service hosts is blocked during this test. The generated clip deliberately omits the random mission phrase, so the system preserves the honest `contributor_attested` label instead of inventing mission-challenge verification.

## Ordinary-browser end-to-end receipt

The same Chrome executable then started with WebMCP explicitly disabled. Using only visible controls, it completed the same eight boundaries in 1,609, 209, 783, 425, 388, 1,608, 636, and 901 ms respectively. The run proved that a person can open and search an arbitrary case, explicitly publish a privacy-minimized request, discover and claim it from a fresh board context, recover a scrubbed recorder capability, review and correct the video proposal, receive the live answer change, and reuse the reviewed citation in a fresh case without a redundant mission or public-provider call.

This is an independent product-surface receipt, not a substitute for the native WebMCP receipt: together they establish that Site Tools are load-bearing for agent collaboration while every human role still has a complete ordinary web path.

## Independent WebMCP contract check

The Chrome Labs [`webmcp-tools`](https://github.com/GoogleChromeLabs/webmcp-tools) repository was freshly cloned and built at commit [`d39eae4bd51e8c12736b8cae840bd98f190f3179`](https://github.com/GoogleChromeLabs/webmcp-tools/commit/d39eae4bd51e8c12736b8cae840bd98f190f3179), the latest `main` revision checked on August 27. Its source-built smoke runner passed 9/9 calls across four generic cases, including the five-call stateful hero:

```text
ask_product_question
→ search_product_evidence
→ create_filming_mission
→ create_phone_capture_link
→ publish_filming_mission
```

Tool availability changes with page state. Ordinary inspection, board search, and mission-open outputs are regression-bounded to Chrome's current 1,500-character recommendation. Names, descriptions, schemas, read-only hints, untrusted-content hints, cancellation, and stale-state behavior are also tested.

## Exact dependency decision

Challenge-critical direct dependencies are pinned rather than ranged. As of August 27, all product-critical packages are current: pnpm 11.24.0, Next.js 16.3.3, React 19.2.8, AI SDK 7.0.83, Wrangler 4.127.0, Vitest 4.1.11, Zod 4.4.3, and `webmcp-types` 0.1.5.

TypeScript 7.0.2 and ESLint 10.9.1 were tested as an upgrade candidate. Next.js itself accepts them, but the current `@typescript-eslint` stack requires TypeScript below 6.1 and the current React/import/accessibility lint plugins require ESLint 9 or earlier. The release therefore pins TypeScript 5.9.3 and ESLint 9.39.5: the newest peer-valid cohesive matrix, with `pnpm peers check` clean.

The live Vercel AI Gateway catalog was re-read through CLI 59.9.1 on August 28. It still lists `google/gemini-3.7-flash` and the `google/gemini-3.6-flash` fallback with video input and no-training routing, and lists `openai/gpt-5.4-nano` for the bounded Exa tool call. Catalog availability does not substitute for the final authenticated video/search requests.

## Current first-party references

- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Official rules](https://webmcp.devpost.com/rules)
- [Official resources](https://webmcp.devpost.com/resources)
- [OpenAI Site Tools (WebMCP)](https://developers.openai.com/codex/webmcp)
- [WebMCP draft and explainer](https://github.com/webmachinelearning/webmcp)
- [Chrome WebMCP guide](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome secure-tool guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Chrome WebMCP evaluation guidance](https://developer.chrome.com/docs/ai/webmcp/evals)
- [Cloudflare Stream direct creator uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/)
- [Cloudflare Browser Run Markdown Quick Action](https://developers.cloudflare.com/browser-run/quick-actions/markdown-endpoint/)
- [Cloudflare Browser Run pricing](https://developers.cloudflare.com/browser-run/pricing/)
- [Cloudflare Markdown for Agents and Content Signals](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
- [Cloudflare Durable Object WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
- [Google Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)

The OpenAI Site Tools guide was re-read on August 28. It confirms that ChatGPT's judged path is the latest desktop app's built-in browser with Site Tools enabled and GPT-5.6 Sol or Terra; Luna, Enterprise/Edu workspaces, ordinary ChatGPT web, declarative form tools, and tools registered inside iframes are not substitutes. The candidate imperatively registers JavaScript tools from each top-level page, keeps their inputs narrow, returns verifiable state, and preserves the complete ordinary-browser interface. The separately linked OpenAI API MCP guide concerns remote MCP servers and is not the WebMCP implementation source.

Cloudflare's current Browser Run binding, Markdown Quick Action, timeout, pricing, and Content Signal documentation was re-read on August 28. The candidate uses the current `quickAction('markdown', …)` Worker contract, requires the current compatibility date, sends no Browser API token, records `X-Browser-Ms-Used`, restricts navigation and subresources to the supplied origin, and refuses page text when the origin declares `search=no` or `ai-input=no`. This is an implemented fixture-tested boundary; one authenticated request through the real production binding remains a release gate.

## Read-only release-account audit

The current Vercel, Cloudflare, and GitHub CLIs authenticated successfully on August 28 without creating or changing a resource. A standalone Vercel scope is available and its existing projects receive clean unsuffixed `*.vercel.app` hostnames. No candidate-specific Gateway budget or key exists yet. The exact candidate Cloudflare Worker name does not exist, the account has no D1 databases, and the current Wrangler OAuth token can manage Workers/D1 but cannot establish whether Stream has been enabled. The intended public GitHub repository is already public with a detected MIT license, but its `main` branch remains on the older prototype revision; the generic candidate has deliberately not been pushed.

The worktree's ignored Vercel link still names the older project. The approved release session must create and explicitly link a new standalone project before any environment, budget, firewall, or deployment mutation. Cloudflare Stream enablement remains the sole dashboard-only account preflight.

## Gates not yet passed

Do not convert these into public claims until each is recorded against the frozen release:

- The current candidate has not been deployed to its final public Vercel and Cloudflare origins.
- The current candidate has not yet completed a real Cloudflare Browser Run read on the final Worker origin.
- A physical phone has not yet completed this candidate's real Stream upload and real Gateway video-analysis path.
- The current candidate has not yet completed the full flow in ChatGPT's current in-app Browser.
- A read-only attempt to control that browser from this Codex session stopped before browser selection with `Browser use requires a trusted Node REPL browser service`; the session exposes no trusted browser bridge. This is an environment gate, not an app pass or failure, and no ordinary-browser substitute is counted as the required receipt.
- The public D1 index has not yet been seeded by a real rights-clean bottle mission. Until that real capture exists, the app deliberately offers no completed-mission replay or synthetic pass/fail button; deterministic paid-edge fixtures remain test-only.
- An unfamiliar person still needs to complete the no-login flow without coaching.
- The final rights-clean video, public YouTube URL, stable live URL, and frozen repository revision do not yet exist.

Those are mandatory release gates. Passing fixtures, a polyfill, ordinary DOM automation, or a prior prototype does not substitute for them.
