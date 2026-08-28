# Verification and current boundaries

Updated August 28, 2026 PT. This document records what the current product-evidence candidate has actually passed. It deliberately separates deterministic integration proof from public-service and physical-world acceptance.

## Current release matrix

| Gate                          | Result                                             | What it proves                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm peers check`            | Pass, zero peer issues                             | The exact pinned dependency graph is internally compatible.                                                                                                      |
| `pnpm check`                  | Pass                                               | Prettier, zero-warning ESLint, strict TypeScript, all tests, Worker bundle, and production Next.js build.                                                        |
| App tests                     | 24 files, 148 tests pass                           | Product state, dynamic tools, privacy, review, search, reconnect, failures, and release checks.                                                                  |
| Worker tests                  | 5 files, 26 tests pass in Workerd                  | Durable Object, D1, role capabilities, uploads, model proposal, reuse, expiry, and denial paths.                                                                 |
| Worker dry run                | Wrangler 4.127.0; 1,120.96 KiB / 187.69 KiB gzip   | The standalone evidence Worker bundles with every declared production binding.                                                                                   |
| Next.js build                 | Next.js 16.3.3; six route entries                  | The shopper, board, recorder, search, and health surfaces build for production.                                                                                  |
| Cold clone                    | Frozen install and full gate pass; clean afterward | The repository does not depend on ignored files, generated files, or local package state.                                                                        |
| Native Chrome journey         | Eight steps pass                                   | The real app, native WebMCP registration, Durable Object, D1, WebSocket, and browser state complete the causal journey against deterministic paid-edge fixtures. |
| Ordinary-browser journey      | Eight steps pass with WebMCP disabled              | The same shopper, board, recorder, review, update, and reuse loop works through visible controls; the product is not an agent-only façade.                       |
| Chrome Labs independent smoke | 9/9 calls across four cases                        | The exact current source-built WebMCP evaluator independently discovers and executes the generic tool frontier.                                                  |
| Desktop/mobile visual check   | Pass at desktop and 390×844                        | Shopper, board, and contributor pages remain legible with no horizontal overflow or framework error overlay.                                                     |

The exact browser-release candidate `3d1fa4491b9ef640a7e4f943a0c602e5640bf2a5` passed a fresh clone, frozen install, peer check, full quality gate, production builds, and clean post-build worktree on August 28.

## Native end-to-end receipt

Chrome 151 completed the following sequence against the real local Next.js app, Cloudflare Worker runtime, Durable Object, D1 database, migrations, WebSocket updates, and WebMCP registrations:

1. Open an arbitrary product/question: 975 ms.
2. Search existing evidence through the current Site Tool: 381 ms.
3. Create a bounded missing-proof mission and private phone handoff: 540 ms.
4. Explicitly publish the minimized request, then inspect and claim it from a fresh board context: 377 ms.
5. Scrub the contributor capability from the URL and recover it after reload: 253 ms.
6. Upload a generated rights-clean clip, receive a model-shaped proposal, correct it, choose reuse rights, and publish: 1,035 ms.
7. Observe the first shopper's live answer change and exact timestamp citation: 519 ms.
8. Open a fresh matching case and reuse the same reviewed source without another mission: 442 ms.

The fixtures replace only Cloudflare Stream and the video-model response. Browser egress to their public hosts is blocked during this test. The generated clip deliberately omits the random mission phrase, so the system preserves the honest `contributor_attested` label instead of inventing mission-challenge verification.

## Ordinary-browser end-to-end receipt

The same Chrome executable then started with WebMCP explicitly disabled. Using only visible controls, it completed the same eight boundaries in 1,421, 133, 501, 245, 270, 1,064, 410, and 588 ms respectively. The run proved that a person can open and search an arbitrary case, explicitly publish a privacy-minimized request, discover and claim it from a fresh board context, recover a scrubbed recorder capability, review and correct the video proposal, receive the live answer change, and reuse the reviewed citation in a fresh case without a redundant mission.

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

## Current first-party references

- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Official rules](https://webmcp.devpost.com/rules)
- [Official resources](https://webmcp.devpost.com/resources)
- [WebMCP draft and explainer](https://github.com/webmachinelearning/webmcp)
- [Chrome WebMCP guide](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome secure-tool guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Chrome WebMCP evaluation guidance](https://developer.chrome.com/docs/ai/webmcp/evals)
- [Cloudflare Stream direct creator uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/)
- [Cloudflare Durable Object WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
- [Google Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)

## Gates not yet passed

Do not convert these into public claims until each is recorded against the frozen release:

- The current candidate has not been deployed to its final public Vercel and Cloudflare origins.
- A physical phone has not yet completed this candidate's real Stream upload and real Gateway video-analysis path.
- The current candidate has not yet completed the full flow in ChatGPT's current in-app Browser.
- An unfamiliar person still needs to complete the no-login flow without coaching.
- The final rights-clean video, public YouTube URL, stable live URL, and frozen repository revision do not yet exist.

Those are mandatory release gates. Passing fixtures, a polyfill, ordinary DOM automation, or a prior prototype does not substitute for them.
