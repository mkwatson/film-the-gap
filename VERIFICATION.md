# Verification and current boundaries

Updated August 28, 2026 PT. This document records what the current product-evidence candidate has actually passed. It deliberately separates deterministic integration proof from public-service and physical-world acceptance.

## Current release matrix

| Gate                          | Result                                             | What it proves                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm peers check`            | Pass, zero peer issues                             | The exact pinned dependency graph is internally compatible.                                                                                                                      |
| Production dependency audit   | Pass, no known vulnerabilities                     | Every installed production dependency declares a recognized open-source license.                                                                                                 |
| `pnpm check`                  | Pass                                               | Prettier, zero-warning ESLint, strict TypeScript, all tests, Worker bundle, and production Next.js build.                                                                        |
| App tests                     | 29 files, 191 tests pass                           | Product state, revision-safe mission refinement, strict handoff, dynamic tools, privacy, review, search, reconnect, failures, and release checks.                                |
| Worker tests                  | 6 files, 35 tests pass in Workerd                  | Durable Object, D1, Browser Run contract, role capabilities, uploads, model proposal, reuse, expiry, quota, and denial paths.                                                    |
| Worker dry run                | Wrangler 4.127.0; 1,141.54 KiB / 192.67 KiB gzip   | The standalone evidence Worker bundles with every declared production binding, including Browser Run.                                                                            |
| Next.js build                 | Next.js 16.3.3; eight route entries                | The product page, strict handoff, shopper, board, recorder, search, and health surfaces build for production.                                                                    |
| Cold clone                    | Frozen install and full gate pass; clean afterward | The repository does not depend on ignored files, generated files, or local package state.                                                                                        |
| Native Chrome journey         | Eight steps pass                                   | The real app, native WebMCP registration, inspected mission refinement, Durable Object, D1, WebSocket, and browser state complete the causal journey against paid-edge fixtures. |
| Ordinary-browser journey      | Eight steps pass with WebMCP disabled              | The same search, human refinement, board, recorder, review, update, and reuse loop works through visible controls; the product is not an agent-only façade.                      |
| Product-page native bridge    | Before → navigation → after passes                 | Native page tools open the exact strict case; reviewed evidence changes the visible page and replaces the stale handoff tool with evidence inspection.                           |
| Chrome Labs independent smoke | 15/15 calls across five cases                      | The exact source-built evaluator executes create → inspect → exact-revision refine → handoff → publish plus product-page claim → navigation → case inspection.                   |
| Release target guard          | Current target rejected as intended                | The clean candidate cannot mutate external services while its ignored Vercel link names the retired project; placeholder D1 IDs are independently rejected.                      |
| Desktop/mobile visual check   | Pass at desktop and 390×844                        | Claim-only, reviewed-evidence, and pre-handoff refined-mission states are legible with no framework overlay; prior shopper/board/phone checks remain valid.                      |
| Repository content scan       | Pass                                               | The tracked tree contains text and one authored SVG, no binary media; a reachable-history secret-pattern scan found only environment-variable lookups.                           |

The exact browser-release candidate `3d1fa4491b9ef640a7e4f943a0c602e5640bf2a5` passed a fresh clone, frozen install, peer check, full quality gate, production builds, and clean post-build worktree on August 28.

The later standalone-cleanup candidate `7611ec6f853cf93ae1967209239be1f08213ef62` removed the retired merchant, protected-preview, and synthetic-crowd harness paths. Both complete browser journeys and the same fresh-clone gate passed afterward; the product runtime did not change.

The search-first candidate `d332a7858bbecd20fc56e5fa4befb0794f4dd6b2` removed the manufactured pass/fail replay and made existing-evidence search the first native capability. On August 28, an exact fresh clone passed `pnpm install --frozen-lockfile`, the peer check, all 174 tests, the Worker dry-run, the six-route production build, and a clean post-build worktree. It remains the previous clean fallback.

The Browser Run candidate `f4d5671f088581ef99aa73ce7617291dc7cea903` added authenticated, same-origin, rights-aware supplied-page reading while preserving page copy as inconclusive; exact reviewed D1 evidence now short-circuits redundant public-provider calls. On August 28, an exact fresh clone passed the frozen install, peer check, all 189 tests, the Browser Run-bound Worker dry run, the six-route production build, and a clean post-build worktree.

The rights-clean source-page candidate `a008341d96b61dbd38e77bb80d584d08ad278fec` added an owned, same-origin `/demo-product` page, automatically binds it to the default case on public HTTPS and after reset, preserves the live Browser Run receipt beside the authored claim, and makes the exact page security policy and Content Signal part of release verification. On August 28, an exact fresh clone passed the frozen install, peer check, all 193 app/Worker tests, the Browser Run-bound Worker dry run, the seven-route production build, and a clean post-build worktree. It remains the previous clean code fallback; `f4d5671f088581ef99aa73ce7617291dc7cea903` is the fallback before it.

The explicit-review candidate `f9a00d690b6604361c180f0b847981326b1491c2` removes the contributor UI's implied “Product owner” identity and preselected rights claim. Publication now requires a deliberate rights selection plus confirmation that the contributor reviewed the exact clip and every field; the Worker independently requires the literal confirmation. On August 28, an exact fresh clone passed `pnpm install --frozen-lockfile`, a zero-issue peer check, all 193 tests, the Browser Run-bound Worker dry run at 1,135.56 KiB / 191.16 KiB gzip, the seven-route production build, and a clean post-build worktree. It remains the fallback before the product-page bridge.

The product-page bridge candidate `215f02e24a2a39811026c52e66cd041ce3393d1b` makes the owned product page a native participant in the evidence network. Before proof, its Site Tools inspect the authored claim boundary and navigate through a strict, privacy-bounded `/case` handoff. After a reviewed D1 record appears, the visible page gains the timestamped result and its stale handoff tool is replaced by reviewed-evidence inspection. On August 28, an exact fresh clone passed the frozen install, zero-issue peer check, all 201 tests, Worker dry run at 1,136.00 KiB / 191.32 KiB gzip, the eight-route build, and a clean post-build worktree. The complete native and ordinary-browser journeys passed afterward.

The handoff release-gate candidate `431a26d9a326c50e091a2734e97afc42b7dc41ff` locks the dynamic `/case` route to the buyer security boundary, makes the public verifier request the exact versioned product-page handoff, and fails release when the question or required Stream-playback policy is absent. It also replaces an imprecise extra-evidence claim with an exact omitted-record count. An exact fresh clone passed the frozen install, zero-issue peer check, all 202 tests, the unchanged Worker dry run, the eight-route build, and a clean post-build worktree.

The product-page evaluation candidate `81a405ca991ae27704c06b78f0a0927c6b0e23f5` adds mechanically checked before/reviewed tool snapshots and an independent cross-document product-page trajectory. Chrome Labs' unmodified evaluator exposed two overbroad receipts; both now report the exact fields actually carried. On August 28, an exact fresh clone passed the frozen install, zero-issue peer check, all 207 tests, Worker dry run at 1,136.00 KiB / 191.32 KiB gzip, the eight-route build, and a clean post-build worktree.

The guarded release candidate `998ae323f1abf3cf788758c5e2e7dc2e315e8dd8` adds a fail-closed pre-mutation check for the exact clean commit, standalone Vercel project, public credential-free origins, dedicated Worker, and real matching D1 IDs. The real local invocation rejected the still-linked retired `webmcp-evidence-market` project before any external mutation. On August 28, an exact fresh clone passed the frozen install, zero-issue peer check, all 212 tests, Worker dry run at 1,136.00 KiB / 191.32 KiB gzip, the eight-route build, and a clean post-build worktree.

The hardened social-discovery candidate `fcede7cb81e69491612cf78867671b78e71728cb` treats ScrapeCreators' current explicit `success: false` envelope as a provider failure even when HTTP succeeds, and rejects returned social URLs carrying credentials or nonstandard ports. Both complete browser journeys passed unchanged. On August 28, an exact fresh clone passed the frozen install, zero-issue peer check, all 214 tests, Worker dry run at 1,136.00 KiB / 191.32 KiB gzip, the eight-route build, and a clean post-build worktree. This remains the immediate pre-segmentation fallback.

The cut-aware video candidate `bad83c1f34ac277907909d1e97fd2a655c3def11` adds a server-enforced rights confirmation before any upload can reach model analysis, while preserving a separate later publication-rights choice and final human attestation. Every new Gemini proposal must map the entire bounded recording into chronological setup, claim-evidence, context, or unrelated segments and expose continuous, visible-cut, or uncertain transitions. Invalid, gapped, out-of-bounds, or cut-obscuring maps fail closed; previous-release cached proposals remain readable. The contributor can jump to each timestamp, and the UI explicitly labels the map an untrusted navigation aid rather than evidence. On August 28, the live Vercel AI Gateway catalog confirmed `google/gemini-3.7-flash` and its `google/gemini-3.6-flash` fallback still accept video; Google's current guide confirmed timestamp support and approximately one-frame-per-second default sampling, which is why uncertain boundaries remain uncertain. Both native WebMCP and WebMCP-disabled eight-step journeys passed, the changed review screen was rendered and visually inspected, and the full local gate passed all 220 tests, Worker dry run at 1,139.26 KiB / 192.33 KiB gzip, and the eight-route production build. This remains the immediate pre-upload-hardening fallback.

The upload-rights hardening candidate `1533454da3843ae5392c083718f6b4d07bdb3e84` closes the remaining bypass: the Worker now refuses to mint even a one-time Cloudflare Stream upload URL unless the contributor sends the literal media-rights confirmation. It independently requires the confirmation again before model analysis, and still requires a separate rights basis plus final human confirmation before publication. Direct protocol, revoked-capability, owner-token, public-claim, oversized-upload, and missing-confirmation paths remain covered. Both complete browser journeys and the full 220-test gate passed again, with Worker dry run at 1,139.32 KiB / 192.33 KiB gzip and the unchanged eight-route production build. This remains the immediate pre-refinement fallback.

The revision-safe mission candidate `8e0493e4c4b481aae63c90b591138d21516b04fa` lets ChatGPT and ordinary-browser shoppers inspect and tighten an open filming mission before contributor handoff. Refinement replaces the complete recording recipe only against the exact inspected case revision, preserves the fresh-capture challenge, and becomes unavailable once a phone case exists. A reference captured before handoff also fails closed afterward, so the target cannot silently change beneath a contributor. The current Chrome Labs source-built evaluator passed the seven-call live hero, including inspect → refine, and the product-page trajectory passed unchanged: 15/15 calls across five cases. Both complete eight-step browser journeys passed, the refined state was visually inspected, and an exact cold clone of this commit passed the frozen install, all 226 tests, Worker dry run at 1,141.54 KiB / 192.67 KiB gzip, the eight-route build, and a clean post-build worktree. This is the current locally frozen code candidate.

## Native end-to-end receipt

Chrome 151 completed the following sequence against the real local Next.js app, Cloudflare Worker runtime, Durable Object, D1 database, migrations, WebSocket updates, and WebMCP registrations:

1. Open the default unresolved case with Search—not mission creation—as the initial native capability: 1,768 ms.
2. Open an arbitrary product, read bounded page context, and search existing evidence through WebMCP: 537 ms.
3. Create a bounded missing-proof mission, inspect and refine its exact revision, create the locked phone handoff, and explicitly publish the minimized request: 757 ms.
4. Inspect and claim the request from a fresh board context with no customer list: 378 ms.
5. Scrub the contributor capability from the URL and recover it after reload: 248 ms.
6. Upload a generated rights-clean clip, receive a model-shaped proposal, correct it, deliberately choose rights, explicitly confirm the reviewed submission, and publish: 1,418 ms.
7. Observe the first shopper's live answer change and exact timestamp citation: 557 ms.
8. Open a fresh matching case, reuse the same reviewed source without another mission, and skip redundant public-provider calls: 482 ms.

The fixtures replace only Cloudflare Stream, Cloudflare Browser Run, and the video-model response. The page fixture rejects requests unless the Worker supplies the exact same-origin pattern, blocked resource types, headers, timeouts, and cache boundary expected in production. Browser egress to the public paid-service hosts is blocked during this test. The generated clip deliberately omits the random mission phrase, so the system preserves the honest `contributor_attested` label instead of inventing mission-challenge verification.

## Ordinary-browser end-to-end receipt

The same Chrome executable then started with WebMCP explicitly disabled. Using only visible controls, it completed the same eight boundaries in 1,267, 149, 739, 269, 269, 1,445, 430, and 590 ms respectively. The run proved that a person can open and search an arbitrary case, refine the mission through the human editor, explicitly publish a privacy-minimized request, discover and claim it from a fresh board context, recover a scrubbed recorder capability, deliberately assert rights and confirm review, receive the live answer change, and reuse the reviewed citation in a fresh case without a redundant mission or public-provider call.

A separate run captured all major screens in both modes. The 1,280-pixel-wide pre-handoff receipt was visually inspected after refinement: the exact 11-second recipe, acceptance boundary, preserved phrase, four-tool frontier, and phone-link boundary are coherent without an error overlay. The earlier contributor receipt still shows the neutral contributor identity, deliberate rights choice, correction controls, final attestation, and disabled publication boundary.

This is an independent product-surface receipt, not a substitute for the native WebMCP receipt: together they establish that Site Tools are load-bearing for agent collaboration while every human role still has a complete ordinary web path.

## Product-page bridge receipt

A native source-browser run opened `/demo-product` in the real Next.js app and observed exactly two initial tools: `inspect_product_claim` and `open_product_evidence_case`. Executing the native handoff tool navigated to the versioned `/case` URL with the exact product name and observable question; no identity, history, preference, conversation, or budget field exists in that contract. The resulting case rendered the same question and ordinary search controls with no framework overlay.

In a separate same-page transition, a local HTTP fixture returned a schema-valid record through the real reusable-evidence client boundary. The page changed from **This claim still needs observable proof** and zero reviewed videos to **The missing test has now been filmed**, the reviewed observation, `00:02–00:13`, high confidence, continuous take, owned rights, and the cited video link. Native `getTools()` simultaneously changed to `inspect_product_claim` + `inspect_reviewed_product_evidence`; the retired handoff tool was absent. Executing the new inspection tool returned an 872-character payload with result, confidence, rights, provenance, continuity, capture timing, contributor label, source URL, and exact interval. A four-record maximum-shape test remains under the 1,500-character recommendation by returning the newest reviewed record and disclosing the additional-record count.

Desktop and 390×844 screenshots of both product-page states showed no horizontal overflow or framework overlay. This proves page/tool behavior and presentation against a schema-valid local edge response. It does not substitute for the pending final-origin D1 record produced by the real phone → Stream → Gateway → review flow.

The compiled Next.js production server also returned the exact question from the versioned handoff with HTTP 200, `camera=()` and `microphone=()`, `no-referrer`, `nosniff`, and a restrictive CSP that permits Stream playback but no creator upload. The public release verifier now repeats that route-level check against the final origin.

## Independent WebMCP contract check

The Chrome Labs [`webmcp-tools`](https://github.com/GoogleChromeLabs/webmcp-tools) repository was freshly cloned and built at commit [`d39eae4bd51e8c12736b8cae840bd98f190f3179`](https://github.com/GoogleChromeLabs/webmcp-tools/commit/d39eae4bd51e8c12736b8cae840bd98f190f3179), still the latest `main` revision checked on August 28. Its unmodified source-built smoke runner passed 15/15 calls across five cases. The generic seven-call hero is now:

```text
ask_product_question
→ search_product_evidence
→ create_filming_mission
→ inspect_product_evidence
→ refine_filming_mission with expectedRevision
→ create_phone_capture_link
→ publish_filming_mission
```

The new three-call cross-document product trajectory also passed:

```text
inspect_product_claim
→ open_product_evidence_case
→ inspect_product_evidence on the newly loaded /case page
```

The current hero re-polls the live dynamic registry after each call, reads revision `4` from inspection, replaces the mission against that exact revision, then continues through handoff and publication. Separate runtime tests prove refinement unregisters at handoff and even a previously captured reference is rejected. A static frontier mechanically matches the live open-mission schemas and rejects evals that refine without prior inspection. An earlier re-run correctly rejected a stale private-handoff eval that attempted mission creation before the required evidence search; the corpus was fixed rather than weakening the product.

Tool availability changes with page state. Ordinary inspection, board search, and mission-open outputs are regression-bounded to Chrome's current 1,500-character recommendation. Names, descriptions, schemas, read-only hints, untrusted-content hints, cancellation, and stale-state behavior are also tested.

## Exact dependency decision

Challenge-critical direct dependencies are pinned rather than ranged. As of August 27, all product-critical packages are current: pnpm 11.24.0, Next.js 16.3.3, React 19.2.8, AI SDK 7.0.83, Wrangler 4.127.0, Vitest 4.1.11, Zod 4.4.3, and `webmcp-types` 0.1.5.

TypeScript 7.0.2 and ESLint 10.9.1 were tested as an upgrade candidate. Next.js itself accepts them, but the current `@typescript-eslint` stack requires TypeScript below 6.1 and the current React/import/accessibility lint plugins require ESLint 9 or earlier. The release therefore pins TypeScript 5.9.3 and ESLint 9.39.5: the newest peer-valid cohesive matrix, with `pnpm peers check` clean.

The live Vercel AI Gateway catalog was re-read through CLI 59.9.1 on August 28. It still lists `google/gemini-3.7-flash` and the `google/gemini-3.6-flash` fallback with video input and no-training routing, and lists `openai/gpt-5.4-nano` for the bounded Exa tool call. Catalog availability does not substitute for the final authenticated video/search requests.

## Current first-party references

- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Official rules](https://webmcp.devpost.com/rules)
- [Official resources](https://webmcp.devpost.com/resources)
- [OpenAI Site Tools (WebMCP)](https://learn.chatgpt.com/docs/webmcp)
- [WebMCP draft and explainer](https://github.com/webmachinelearning/webmcp)
- [Chrome WebMCP guide](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
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

The OpenAI Site Tools guide was re-read on August 28. It confirms that ChatGPT's judged path is the latest desktop app's built-in browser with Site Tools enabled and GPT-5.6 Sol or Terra; Luna, Enterprise/Edu workspaces, ordinary ChatGPT web, declarative form tools, and tools registered inside iframes are not substitutes. The candidate imperatively registers JavaScript tools from each top-level page, keeps their inputs narrow, returns verifiable state, and preserves the complete ordinary-browser interface. OpenAI and Chrome both document navigation as a valid page-owned tool action; the product-page handoff uses that pattern while explicitly stating everything it does not publish or create. The separately linked OpenAI API MCP guide concerns remote MCP servers and is not the WebMCP implementation source.

Chrome's imperative API guide was re-read on August 28 at its August 20 update. It still documents runtime tool registration and unregistration, `getTools()`, and `AbortSignal`-based cancellation. The open mission therefore exposes refinement only while it is valid, all mutation callbacks check cancellation before acting, and both stale case revision and post-handoff execution are tested as fail-closed boundaries.

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
- The installed Browser client and cache match at SHA-256 `2158647076eed887c7591cca0957da78747ab9155819d64409d6b895e84ed99b`, and that exact hash is now appended to the local trusted-client list while preserving both prior hashes. The already-running Codex session retains its startup trust environment and therefore still returns `Browser use requires a trusted Node REPL browser service`; one ChatGPT/Codex restart is required before the exact in-app run. This is an environment gate, not an app pass or failure, and no ordinary-browser substitute is counted as the required receipt.
- The public D1 index has not yet been seeded by a real rights-clean bottle mission. Until that real capture exists, the app deliberately offers no completed-mission replay or synthetic pass/fail button; deterministic paid-edge fixtures remain test-only.
- An unfamiliar person still needs to complete the no-login flow without coaching.
- The final rights-clean video, public YouTube URL, stable live URL, and frozen repository revision do not yet exist.

Those are mandatory release gates. Passing fixtures, a polyfill, ordinary DOM automation, or a prior prototype does not substitute for them.
