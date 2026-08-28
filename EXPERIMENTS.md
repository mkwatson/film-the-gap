# Innovation frontier and experiment register

Research state: 2026-08-27 PT. H1-H4 were frozen before the Rung 2 implementation; H5 was scoped before its camera UI implementation; H6 was frozen before the visual-proposal implementation. Descriptive labels are not proposed submission names.

## Authoritative starting point

- Recoverable historical control: commit `41ab726` (`feat: add native WebMCP live market rung`) preserves the original five-constraint flow.
- Current working behavior: a buyer or agent shares four seller-visible evidence requirements but no ceiling or profile, joins a normalized request for one missing physical fact, receives a host answer, and creates or releases a reversible exact-quote hold through dynamically registered native Site Tools.
- Progressive host behavior: with `NEXT_PUBLIC_EVIDENCE_ROOM_URL` configured, `/host` joins the buyer's temporary server-authoritative room through a fragment-carried private invite, exposes only the normalized evidence demand, and returns one reviewed answer to the buyer. Without the service, the same pages retain the deterministic local fallback.
- Historical limitation: `41ab726` received, stored, displayed, and returned `maxAllInPrice`. That is now a positive leakage control, not the current contract.
- Runtime boundary: the complete typed native sequence passes in isolated Chrome and ChatGPT desktop 26.820.60940 with GPT-5.6 Sol. The current compact contract additionally passes Chrome 151 over public HTTPS with a separately authenticated host tab, live OIDC-backed structured vision, truthful negative-evidence gating, stale refusal, exact hold, and release. Realtime voice transport/transcription/delegation passes, but the delegated task did not inherit the UI-owned Browser binding. A permanent room origin, current-contract ChatGPT rerun, Mark's normal Chrome profile, rights-cleared physical-camera acceptance, and a real phone on a second network remain open gates.

## E16 — Generic proof-demand loop

**Frozen claim:** A product-independent question → source gap → bounded filming mission → reviewed observation → changed answer loop will be clearer, broader, and more competitive than centering the submission on a used-product live market, while retaining the strongest WebMCP, privacy, provenance, and human-agent collaboration primitives already developed.

**Pass criteria:**

- an unfamiliar judge can open a case for an unseen product without a code change;
- the initial answer distinguishes an indexed claim from sufficient observable proof;
- native WebMCP exposes only state-valid actions and keeps identity, budget, purchase history, and private preferences out of every input schema;
- a mission specifies a bounded recording instruction, acceptance criterion, minimum duration, and continuity requirement;
- reviewed evidence records rights, provenance, confidence, attribution, and a timestamped claim citation;
- publishing a supporting or contradicting observation visibly changes the answer and adds an inspectable answer-diff tool;
- the deterministic replay is explicitly labeled, while the same transition can be fulfilled from a real phone through a no-login link; and
- the complete core remains reliable when source search, model inference, video hosting, or commerce is unavailable.

**Fail criteria:** The arbitrary-product input merely changes labels around hard-coded logic; a model or marketing claim becomes authoritative without reviewed evidence; the phone handoff is fragile or required for baseline judging; WebMCP tools do not materially change with evidence state; or the broader story becomes harder to understand than the live-market control.

**Current result:** The generic loop now has a SQLite-backed Cloudflare Durable Object, no-login capability link, direct-to-Cloudflare-Stream phone upload contract, reviewed contributor publication, live WebSocket answer update, and an honestly labeled replay fallback. The app passes strict model, protocol, Worker, component, production-build, real Chrome registration, desktop, and 390 px checks locally. An arbitrary product now exposes `search_product_evidence` before mission creation; the server retains a supplied product page as an unreviewed lead, searches TikTok, Instagram Reels, and YouTube through ScrapeCreators, and searches the broader web through Exa on Vercel AI Gateway. Every public result remains canonical, link-only, and non-decisive. Live Stream bytes and live discovery-provider responses remain external-account acceptance gates; none was called from this checkpoint because the active goal forbids unapproved spend or mutation.

**Source-discovery documentation receipt — checked 2026-08-27:**

- ScrapeCreators' current endpoint OpenAPI documents one-credit searches at [`/v1/tiktok/search/keyword`](https://docs.scrapecreators.com/v1/tiktok/search/keyword/), [`/v2/instagram/reels/search`](https://docs.scrapecreators.com/v2/instagram/reels/search/), and [`/v1/youtube/search`](https://docs.scrapecreators.com/v1/youtube/search/). TikTok may return duplicates; Instagram Reels search is explicitly best-effort and Google-indexed; YouTube can return videos and Shorts in one response. The integration deduplicates canonical post URLs, caps each platform, fails independently, and never ingests transient media URLs.
- The vendor's [current terms](https://scrapecreators.com/terms) say it retrieves public third-party data but place third-party-policy, legal, privacy, and intellectual-property compliance on the customer. Therefore public availability is discovery authority only: results are `external_link` + `link_only`, paid-placement flags are excluded where returned, and no discovered video becomes decision-grade without a separate rights-cleared review path.
- The [current pricing page](https://scrapecreators.com/) advertises 100 free credits, pay-as-you-go packs, no card for the free allocation, free cache hits, and no account-level rate limit; those terms can change and must be rechecked before provisioning. This checkpoint performs zero live provider calls when `SCRAPECREATORS_API_KEY` is absent and reports that state honestly.

## E17 — Claim-scoped continuous-video review

**Frozen claim:** One owned or authorized phone recording can become materially more useful than a generic product video when a current multimodal model drafts the smallest claim-relevant time range, but only if the exact uploaded media, continuity, limitations, model proposal, and subsequent human corrections remain visibly separate.

**Pass criteria:** The phone uploads once; Cloudflare Stream verifies and preserves the clip; Vercel AI Gateway sends only the resulting authorized MP4 to a video-capable model; the proposal contains a bounded result, confidence, continuity, observation, visible details, limitations, and integer timestamp range; invalid or out-of-bounds proposals fail closed; one proposal is cached per upload; a contributor can accept or correct every decision field; and edited/unclear media cannot satisfy a mission that requires a continuous take.

**Current local result:** The full contract is implemented and passes strict TypeScript, Vitest, Cloudflare workerd tests, and a Wrangler production dry run. `ProductEvidenceCaseObject` waits for Stream readiness, creates/polls the exact MP4 download, validates its Cloudflare origin, permits at most one active model call and two crash-recovery attempts, and caches the typed proposal. A concurrent-request test proves that two simultaneous analysis requests yield one model review plus one processing response, followed by a cached proposal. The contributor sees the model ID, proposed citation, visible details, and limitations; manual/unconfigured/oversize failures start from `inconclusive`, never from a favorable answer. Publication separately records the contributor-reviewed result, confidence, continuity, and time range.

Chrome `150.0.0.0` then passed the generic mission and private contributor handoff with native Site Tools live. At `390×844`, a locally generated 12-second MP4 exercised upload, processing, a Gemini 3.7-shaped proposal, explicit human correction from “supports” to “contradicts,” rights/continuity/timestamp review, and the published receipt without overflow or an error overlay. That browser run used an in-page transport double; it proves the UI/state contract, not Cloudflare Stream or Gemini. This checkpoint makes no Stream download or model request because the active goal forbids unapproved spend and external mutation; a real authorized phone clip remains the graduation gate.

**Current-documentation receipt — checked 2026-08-27 PT:**

- The reviewed lockfile resolves a coherent stack of AI SDK `7.0.83`, `@ai-sdk/gateway` `4.0.67`, Zod `4.4.3`, Wrangler `4.127.0`, and Cloudflare Workers types `5.20260827.1`; the Worker package pins each direct runtime dependency exactly. AI SDK 7's bundled docs require `generateText` plus `Output.object` for structured output and `FilePart` for video; the installed Gateway provider advertises pass-through URL support and suppresses stored request bodies when asked.
- The live [Vercel AI Gateway model catalog](https://ai-gateway.vercel.sh/v1/models) lists `google/gemini-3.7-flash` as a reasoning, file, vision, and video-input model with a one-million-token context window. It is the primary route; `google/gemini-3.6-flash` is the same-provider video fallback. The request enables `disallowPromptTraining`, omits raw request/response bodies from AI SDK results, and identifies the feature with Gateway tags. Account/model access must still pass with the actual challenge deployment before this is claimed live.
- Google's current [video-understanding guide](https://ai.google.dev/gemini-api/docs/video-understanding) says Gemini can answer questions and cite timestamps in video, samples ordinary video at roughly one frame per second, recommends one video per prompt, recommends putting the text after the video, and warns that fast action can be missed. The prompt and UI preserve those limitations rather than treating a model answer as authenticity proof.
- Google's current [file-input methods](https://ai.google.dev/gemini-api/docs/file-input-methods) allow publicly accessible HTTPS or pre-signed external video URLs up to 100 MB. The app caps the AI path at 95 MiB, accepts only a generated `customer-*.cloudflarestream.com/.../downloads/default.mp4` URL, and keeps larger uploads available for manual review.
- Cloudflare's [Stream downloads guide](https://developers.cloudflare.com/stream/viewing-videos/download-videos/) was updated May 7, 2026 and explicitly identifies generated MP4/audio downloads as useful for downstream AI summarization. Downloads can be generated only after a video is ready, are asynchronous, and count as minutes served. The implementation therefore polls without holding a Worker request open and never creates a download during tests.
- Cloudflare's [direct creator upload guide](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/) recommends basic one-time POST uploads below 200 MB and keeps the Stream API token off the phone. That remains the upload boundary; the Gateway credential is a Worker secret and is never returned to either browser.

## E18 — Generic two-role native acceptance

**Frozen claim:** The generic product-evidence loop can survive the exact browser → WebMCP → phone → Durable Object → reviewed evidence → browser transition without replacing the product state machine with a demo-only frontend or allowing a local test to call paid services accidentally.

**Pass criteria:** Native WebMCP Chrome must inspect the insufficient answer, create a bounded mission and phone capability through dynamic Site Tools, open a separate contributor tab, scrub the bearer fragment, recover after contributor reload, upload a generated rights-clean video, receive and correct a typed proposal, publish through the real Worker, update the original buyer over WebSocket, expose the causal answer difference through a newly registered Site Tool, and recover the final state after buyer reload. Browser output and failures must never print either capability.

**Result:** **graduated locally; final public services and physical phone remain pending.** Repeated Chrome `150.0.0.0` passes completed all five phases in 4.5–5.8 seconds. The run used the production Next components, WebMCP registrations, remote protocol, role tokens, revision checks, Worker router, Durable Object storage, Stream-status checks, proposal schema, publication transition, WebSocket broadcast, and session recovery unchanged. Two local Workers connected through current Cloudflare Service Bindings replaced only direct Stream responses and the model response; the browser intercepted only the exact one-time upload URL and its network allowlist excluded public paid-service hosts. A generated 12-second MP4 was deleted after each run.

The first run found that the contributor fragment was not scrubbed; the implementation now moves it immediately into tab-scoped session storage and proves reload recovery. The next run found that buyer credentials existed only in React memory; a strict stored-session schema now binds the service origin, app origin, case ID, expiry, contributor URL, and both typed credentials, discards expired/tampered/origin-mismatched values, updates the stored state on every room snapshot, and reconnects after reload. Pure tests cover expiry, origin changes, and token/URL mismatch.

Current Cloudflare [Service Binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) and [multi-Worker development](https://developers.cloudflare.com/workers/local-development/multi-workers/) docs checked August 27 recommend separate `wrangler dev` processes as the stable local path and report bindings as connected/not connected; Wrangler `4.127.0` showed both fixture bindings connected. The same docs describe one-command multi-config development as experimental, so the committed runbook deliberately uses two Worker processes rather than making an experimental runner part of the acceptance claim.

## E19 — Judge-story convergence

**Frozen claim:** Replacing the obsolete live-auction/UCP/Lean submission narrative and the metaphorical “ask the product” headline with one literal causal story will improve cold comprehension and every judge-facing rubric surface without weakening the working product.

**Pass criteria:** The on-page headline says who acts and what they do; the Devpost draft answers all four required prompts from the generic evidence implementation; the video plan fits under three minutes and visibly proves the before/after answer; current and future capabilities are separated; the architecture visual matches the product; no commerce feature competes with the hero; and the full repository gate remains green.

**Result:** **graduated locally; cold-view and final-client gates remain pending.** The page now says, “If the web cannot prove it, ask someone with the product to film it.” The submission packet, `2:40` demo contract, claims ledger, ninety-second judge path, and new `1920×1080` architecture card all tell the same question → mission → phone video → human review → answer-diff story. The card was rendered in Chrome at exact output resolution and visually inspected. The complete gate passed: formatting, ESLint, strict TypeScript in all projects, 176 active app tests plus two skipped live tests, 18 Workerd room tests, 12 merchant tests, both Worker dry-run bundles, and the Next.js production build.

**Rubric effect:** WebMCP Leverage becomes visible as dynamic capability change rather than protocol exposition; Execution becomes one coherent two-device product; Potential Impact is tied to a specific shopper problem; Creativity & Ambition lands as an agent creating missing knowledge with a human rather than merely searching or shopping.

## E20 — Bounded public cost and isolated release surface

**Frozen claim:** The no-login judge path can remain reliable without exposing unbounded paid upload, model, or discovery operations, and the generic candidate can deploy without changing or publicly routing into the historical commerce product.

**Pass criteria:** The deployable Worker has a distinct name and only the generic evidence API; a public health receipt attests both case-creation rate-limit bindings, upload cap, Stream binding, and analysis configuration; each case can reserve at most two uploads; clips are at most 95 MiB and 90 seconds; Stream reservations track actual duration closely and expire; videos have bounded retention; model analysis is cached and retry-bounded; public discovery rejects cross-site/non-JSON browser requests and has an exact Vercel WAF rollout; the release verifier proves the reviewed commit, page security policies, hostile-origin denial, and Durable Object read-back without retaining capabilities; and the full native journey still passes against the exact standalone entrypoint.

**Result:** **graduated locally; user-approved account setup and public verification remain pending.** The generic production config now deploys the separate `webmcp-product-evidence` Worker with one SQLite Durable Object class, Cloudflare Stream, two rate-limit bindings, and version metadata. Its own Workerd suite proves `/rooms` is absent, hostile origins fail, health attests the cost envelope, and a trusted browser can create a durable generic case. The historical live-market deployment and Git history remain untouched.

Case creation is limited to 12 requests per hashed client fingerprint and 120 total requests per minute per Cloudflare location. Cloudflare documents these counters as permissive and eventually consistent, so hard controls remain separate: two upload reservations per case, 95 MiB/90-second clips, 15-minute one-time upload URLs, actual-duration-plus-five-second reservation, 31-day scheduled deletion, one cached successful analysis, and at most two crash-recovery attempts. The release runbook requires a dedicated non-renewing AI Gateway budget for the external Worker, automatic short-lived Vercel OIDC for broad discovery (or an optional isolated `$5` key), fixed-credit social discovery, and a Vercel WAF rule for `POST /api/evidence/search`. Turnstile remains deferred until it passes the exact ChatGPT runtime.

The obsolete Vercel-hosted snowboard image proposal was removed from the candidate, eliminating an otherwise public OIDC-backed model cost. Social search now requires same-origin JSON before vendor code runs. The generic Vercel build also omits `/host`, `/attend`, and UCP discovery routes, so a cold judge cannot fall into the superseded product. A new four-phase public verifier checks only the app and standalone evidence service and suppresses all disposable capabilities from output.

The exact standalone entrypoint then passed the five-phase native Chrome journey in approximately 4.0 seconds: open generic case, create mission through WebMCP, scrub/recover the phone capability, upload and correct a model-shaped proposal, publish, receive the WebSocket update, bind the citation to its Stream playback source, and inspect the timestamped answer change. The final post-removal gate passed with 171 active app tests plus two skipped live tests, 25 Workerd evidence tests, 12 preserved merchant-rung tests, strict formatting/lint/types, both current Worker dry runs, and the Next.js production build. Its route manifest contains only `/`, `/contribute/[caseId]`, `/api/evidence/search`, and `/api/health` beyond Next's not-found route.

**Current-docs receipt — checked 2026-08-27 PT:** Cloudflare's Worker rate-limit documentation was updated April 23, 2026 and requires Wrangler 4.36 or newer; this branch uses 4.127.0. Direct creator upload documentation was updated May 7, 2026 and explains both one-time uploads and duration reservation. Vercel's current WAF docs say fixed-window IP/JA4 limits are available on all plans, regional, and should be staged in log mode. Vercel's June 9, 2026 Gateway release adds hard per-key spend budgets, reset cadence, alerts, and expirations; the runbook uses those controls rather than a shared unrestricted key.

Cloudflare's current security guide says allowed origins restrict HLS/DASH manifests and segments, while its download guide recommends generated MP4s for downstream AI but does not explicitly document how allowed origins interact with a provider-side MP4 fetch. The final paid rehearsal must prove that exact Stream → Gateway edge with the configured app-origin restriction. Do not silently remove the restriction or claim live multimodal success if that fetch fails; choose the smallest verified access design after observing the real response.

## E21 — Bounded broad-web evidence discovery

**Frozen claim:** Broad web/PDP discovery can make an arbitrary-product evidence case materially more useful without turning the app into an open proxy, letting a model rewrite the shopper's question, treating search snippets as proof, or exposing an unbounded paid endpoint.

**Pass criteria:** The route combines a supplied product-page lead, direct social-video search, and a current broad-web provider; the broad query is claim-aware and accepted only when its execution receipt preserves the exact input; results are canonical, deduplicated, bounded, rights-labeled, and non-decisive; one provider can fail without erasing another; cancellation and timeouts reach every external call; repeat successful searches reuse a regional cache; transient partial failures are not cached; no external call runs without a server-side Gateway identity or vendor credential; and the judge can see which concrete products completed the search.

**Current result:** **graduated offline; final-origin provider calls remain pending.** The Next.js route now concurrently combines ScrapeCreators social search with the Gateway-native Exa `instant` tool, using `openai/gpt-5.4-nano` only to invoke the provider tool. The implementation forces that tool, caps generation at 1,024 tokens so the longest valid multilingual query still fits, bounds the call at 20 seconds with one retry, excludes social domains already covered directly, requests at most four highlighted results, and rejects the entire web receipt if the returned tool input differs from the exact deterministic query. A case-supplied product URL is retained without fetching it and is explicitly labeled “not treated as proof.”

The result model now records an `evidence_network` aggregate receipt while preserving direct provider types. All public results become `external_link`, `link_only`, `unknown` continuity, low-confidence `inconclusive` observations. The UI names “ScrapeCreators + Exa through Vercel AI Gateway” when both channels completed. A SHA-256 key excludes raw query text from the cache key; `@vercel/functions` `3.9.5` stores only successful configured-search receipts for 15 minutes in Vercel Runtime Cache. Cache errors fail open, malformed cache values fail closed, and transient partial provider failures remain retryable.

The full release gate passes with 197 active app tests plus two skipped live tests, 25 Workerd evidence/room tests, 12 preserved merchant tests, strict formatting/lint/types, both Worker dry-run bundles, and the clean five-route Next.js production manifest. Discovery tests cover missing credentials, exact-query drift, malformed and error receipts, public-URL policy, unsafe/social URLs, Unicode-safe query bounds, tracking-fragment canonicalization, duplicate supplied pages, independent provider failure, cache hits, and no-cache-on-transient-partial behavior. Two lifecycle tests prove that a state-changing Site Tool remains registered until its own invocation returns while page unmount still aborts immediately. The search tool is correctly marked state-changing because it records its bounded receipt into the active case; product-page and video links are visibly distinct.

Three consecutive native-Chrome hero journeys then opened an arbitrary product through `ask_product_question`, exposed and invoked `search_product_evidence`, verified a partial link-only discovery receipt without making a paid call, and completed mission → private phone handoff → upload → model-shaped proposal → human correction → publication → exact Stream-bound timestamped answer diff. They finished in 3.2–4.0 seconds after startup. The expanded path exposed and fixed an old demo-only selector assumption: the final assertion now binds the cited video by its exact Stream UID instead of accepting the first source-page link. No live model, Exa, ScrapeCreators, cache, account, or deployment mutation occurred.

**Current-docs receipt — checked 2026-08-27 PT:**

- AI SDK `7.0.83` resolves `@ai-sdk/gateway` `4.0.67`; its bundled current docs expose Gateway-native Exa, Perplexity, Parallel, and Tako search tools. Exa uniquely returns ranked URLs, highlights, and a `costDollars` receipt without requiring a separate Exa credential. The live [Vercel Exa tool catalog](https://vercel.com/ai-gateway/models/exa-search) lists `exa/search`, a June 1, 2026 release, and `$7/1K` base search calls.
- The live Gateway catalog lists `openai/gpt-5.4-nano` with tool use, a 400K context window, and current `$0.20/M` input / `$1.25/M` output pricing. The model is not trusted to select or rewrite the task: one named tool is forced and its query argument must exactly match the deterministic input before any output is accepted.
- Exa's current [coding-agent guide](https://exa.ai/docs/reference/search-api-guide-for-coding-agents) recommends `instant` for roughly 250 ms latency and highlights for token-efficient relevant excerpts. Its [pricing page](https://exa.ai/pricing) lists `$7/1K` base searches and `$1/1K` pages for highlights. Four highlighted results therefore imply roughly 1.1 cents of Exa-side list cost per uncached search before the tiny nano tool-call tokens. The final Vercel route uses short-lived OIDC plus WAF/cache limits under a hard, non-renewing `$5` project budget.
- Vercel CLI `59.9.1`, checked live on August 27, adds `ai-gateway budgets set project … --limit … --refresh-period none`; this provides a hard metered project-scope ceiling for OIDC calls rather than forcing a second long-lived key. The same current CLI confirmed key-level budget, alert, expiration, staged-firewall, and publish controls. No budget, key, or firewall mutation was made during this audit.
- Vercel's current [`getCache` reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package) documents project/environment isolation, regional persistence, TTLs, tags, and a 2 MB item maximum. This public result is far below that cap; the cache is an optimization, never evidence authority.
- Cloudflare's August 25 [single-page Browser Run + AI Search guide](https://developers.cloudflare.com/ai-search/how-to/fetch-and-index-web-pages/) explicitly warns that fetching arbitrary user URLs can create an open proxy and recommends trusted-host allowlists. Cloudflare AI Search's website source also requires an onboarded domain. Those are strong tools for an owned evidence corpus later, but neither safely solves generic arbitrary-product discovery now; using them decoratively would weaken this release.

## E22 — Cold-judge genericity and discovery truth audit

**Frozen claim:** The first screen and arbitrary-product path can remain visually ambitious without letting demo identity leak into generic behavior or showing a discovery receipt that contradicts the sources directly below it.

**Pass criteria:** A fresh case that happens to share the demo product's name must still receive a question-specific mission and no replay; a supplied product page with unavailable live providers must count as one retained candidate without implying that its contents were checked; page and video links must remain visibly distinct; the first-screen copy must name every implemented discovery surface; desktop and phone layouts must retain their action hierarchy without overflow; automated WCAG A/AA checks must have zero violations; and the expanded native WebMCP journey must still pass.

**Result:** **graduated locally; unfamiliar-human and final-origin audits remain pending.** Demo behavior is now keyed to the rights-clean fixture's identity (`source-1`) as well as its label, rather than to product name alone. A regression test opens a new case with the same bottle name but a different handle-temperature question and proves that the human control creates the generic question-scoped mission, exposes no replay, and retains the supplied page honestly. The discovery panel now reports “Only the supplied product page is available” and “1 candidate source retained” when both live providers are absent; it no longer says zero sources while visibly listing one.

Fresh `1440×1000` and `390×844` full-page inspections showed the same literal search → gap → film → update hierarchy, native Site Tool receipt, generic-product form, and privacy boundary without horizontal overflow or browser errors. Axe-core `4.12.1` reported zero WCAG A/AA violations; layered gradients still leave one recorded manual color-contrast incomplete, not a claimed pass. The complete gate passes with 200 active app tests plus two skipped live tests, 25 evidence/room tests, 12 preserved merchant tests, both Worker dry-runs, and the five-route production build. A cold-start Chrome 151 run then completed arbitrary question → native search → truthful supplied-page receipt → mission → phone upload/review → exact Stream citation → answer diff in 5.6 seconds. No provider, account, deployment, or paid service was touched.

## E23 — Rights-explicit cross-case evidence reuse

**Frozen claim:** A product-evidence network becomes materially more credible when one contributor-authorized, decision-grade recording can resolve a later matching shopper's question without another filming mission—and when that reuse is demonstrated end to end rather than promised in narration.

**Pass criteria:** Case-only is the default; reuse requires a separate explicit contributor choice; weak, inconclusive, or non-continuous reviews cannot enter the network; shopper identity and private preferences never enter the reusable record; supplied product URLs match exactly after safe canonicalization instead of falling back to a same-name product; questions use conservative normalized-text equality rather than semantic inference; a newly published recording is searchable immediately even when ordinary public discovery is cached; reuse retains the exact Stream source, SHA-256 file receipt, rights, contributor label, observation, confidence, continuity, review time, and timestamp; records stop serving after 30 days and are physically purged; the release verifier proves the live D1 schema through a real query; and native WebMCP drives a fresh case from insufficient to conclusive without exposing `create_filming_mission`.

**Result:** **graduated locally; remote D1 creation/migration and final-origin verification remain user-approved gates.** The standalone Cloudflare Worker now uses D1 as a global, read-optimized projection beside per-case Durable Objects. Publication indexes only explicitly opted-in `owned` or `authorized` continuous recordings with conclusive medium/high-confidence human reviews. Search checks D1 fresh on every request with a `first-primary` session, while the costlier social/open-web receipt can still come from Vercel Runtime Cache. If a public URL is supplied, only that canonical URL can match; normalized product-name matching is used only when the shopper supplied no URL. Expired rows are excluded immediately and a daily Cloudflare Cron Trigger physically deletes them.

The exact native acceptance path passed twice after hardening. Its seven phases were: open arbitrary case, search through dynamic WebMCP, create mission/link, scrub and recover the contributor capability, upload and human-correct the bounded proposal, consume the first answer change, then open a fresh matching case and reuse the same D1/Stream citation. The final run completed in approximately 5.2 seconds and proved the second case had `reuseScope: public_network`, the same Stream UID and `00:01–00:11` observation, a D1 receipt, `mission: null`, and only inspect/ask/answer-change tools. The local Cron endpoint returned `outcome: ok`, and a public-contract D1 sentinel query returned `status: complete`. Paid Stream/model calls remained deterministic service fixtures; the Durable Object, D1 database, migration, Next.js route, model, WebMCP registrations, browser tabs, and WebSocket were real.

Implementation follows current first-party guidance: [D1 local migrations and explicit persistence](https://developers.cloudflare.com/d1/best-practices/local-development/), [D1 Sessions and first-primary reads](https://developers.cloudflare.com/d1/best-practices/read-replication/), [D1 Workers binding API](https://developers.cloudflare.com/d1/worker-api/), [official D1 migration testing with the Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/), [Cron Trigger configuration and local scheduled-handler testing](https://developers.cloudflare.com/workers/configuration/cron-triggers/), and the August 2026 [one-logical-atom-per-Durable-Object rule](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/). The design deliberately keeps globally searchable evidence out of a singleton Durable Object.

## What changed in the evidence

1. The [official challenge page](https://openai.com/webmcp-challenge/) asks for an app that becomes meaningfully better when people and agents use it together. The [Devpost gallery](https://webmcp.devpost.com/project-gallery) was still unpublished on August 26, while the last same-day refresh showed 1,717 participants. We cannot novelty-check private entries, so the interaction itself must be structurally memorable.
2. The current [OpenAI showcase](https://developers.openai.com/showcase?view=webmcp-apps) makes shared editing, carts, planning, creative tools, games, and ordinary storefronts crowded reference territory. Its WebMCP filter still says examples are coming soon; copying showcase categories is not a winning differentiation strategy.
3. The August 19 [WebMCP draft](https://webmachinelearning.github.io/webmcp/) makes document-local state, dynamic registration, cancellation, and origin-scoped exposure first-class. A strong entry should make those properties necessary rather than merely convenient.
4. Current [Chrome imperative API documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api) documents cancellation and lifecycle behavior and notes a Chrome 153 unregistration improvement. The judged baseline is Chrome 149+, while the installed Chrome 151 has a recorded draft skew. Version-specific behavior must remain measured rather than assumed.
5. The 2026 paper [When Agents Shop for You](https://arxiv.org/abs/2604.26220) reports that seller-side inference recovered a buyer agent's willingness to pay nearly one-for-one from dialogue in its verbal-profile condition. Its result survived removal of explicit persona cues; the behavioral pattern itself leaked value. Prompting an agent to keep a budget secret is therefore not a complete privacy architecture.
6. UCP `2026-08-25` adds useful merchant-side capabilities including [catalog transports](https://ucp.dev/specification/shopping/catalog/rest/), [buyer consent](https://ucp.dev/specification/shopping/extensions/buyer-consent/), [payment terms](https://ucp.dev/specification/payment/extensions/terms/), and a browser-addressable [permalink handoff](https://ucp.dev/specification/permalink/). AP2 binds authorization to checkout state. None of these capabilities supplies the missing live physical evidence or by itself prevents preference inference before checkout.

## New interaction frontier

The earlier strategy pass enumerated product domains. This pass deliberately changes the unit of exploration: each row is a new interaction primitive that could transfer across domains. Rephrasing an existing live-shopping feature does not count.

|   # | Structural leap                        | Smallest complete rung                                                                                                                             | What makes it structurally different                                                                     | Decisive failure evidence                                                                                               |
| --: | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
|   1 | **Private-counterparty membrane**      | The personal agent sends only evidence requirements and an exact action quote; the seller never receives a profile or ceiling.                     | The agent is a privacy boundary, not merely an automation layer.                                         | The complete decision cannot work without disclosing a valuation or the explanation becomes too confusing for the demo. |
|   2 | **Counterfactual capability frontier** | Every inspection reports not only current tools but the smallest evidence, consent, or state change that would unlock each meaningful next action. | The website makes latent affordances machine-legible instead of leaving an agent at a dead end.          | The frontier duplicates tool descriptions or causes worse tool selection than the dynamic surface alone.                |
|   3 | **Epistemic multicast**                | One normalized human camera demonstration resolves the same missing fact for multiple private agents at once.                                      | A physical observation becomes a shared public good while decisions remain private.                      | The aggregate feels like decorative analytics or requires storing individual profiles.                                  |
|   4 | **Evidence bounty threshold**          | Agents anonymously pledge bounded value toward an expensive inspection; only the aggregate threshold reaches the host.                             | The crowd can finance information without revealing individual valuations.                               | Payments/pledges dominate the story or cannot be made safely reversible.                                                |
|   5 | **Origin-scoped semantic twins**       | Buyer, host, and auditor frames receive different minimal tool surfaces through `exposedTo`, all operating on one visible state.                   | Capability disclosure follows origin and role without centralizing every permission in one API.          | Judged clients ignore origin-scoped exposure or the multi-frame story is less legible than one page.                    |
|   6 | **Consent topology**                   | Tools appear or disappear as separate data subjects grant, narrow, or revoke purpose-specific consent; revocation visibly cascades.                | Consent changes the executable graph, not just a settings record.                                        | The flow reduces to a consent form with no consequential capability change.                                             |
|   7 | **Human sensor mesh**                  | An agent routes one bounded observation request to the available person or device with the right physical vantage point and returns provenance.    | Humans become addressable real-world sensors while retaining refusal and scope control.                  | Provenance and identity costs overwhelm the single useful observation.                                                  |
|   8 | **Negotiated tool schema**             | An agent proposes a desired capability; the site narrows its arguments and effects; a human approves the temporary schema before registration.     | Tools themselves become a negotiated, least-authority artifact.                                          | Dynamic schema creation is unreliable for agents or looks like a developer console rather than a product.               |
|   9 | **Live tool teaching**                 | A human demonstrates one repeatable procedure, reviews the inferred preconditions, and publishes it as an ephemeral page tool.                     | Human behavior creates a capability during the session instead of merely supplying data to a fixed tool. | The inferred procedure cannot be bounded or verified well enough for safe execution.                                    |
|  10 | **Proof-carrying capability unlock**   | A small verifier emits a replayable certificate for one consequential invariant; the page registers the action only when the certificate checks.   | Formal evidence controls the tool surface rather than decorating an explanation.                         | The invariant is trivial, invisible, or depends on empirical claims the proof cannot establish.                         |
|  11 | **Contradiction-triggered rollback**   | New evidence invalidates downstream conclusions, unregisters unsafe actions, and reverses a hold with an attributed explanation.                   | The system treats knowledge as defeasible and retracts authority automatically.                          | The rollback is surprising, destructive, or cannot distinguish contradiction from ordinary updates.                     |
|  12 | **Multi-principal quorum tool**        | A capability exists only while independently scoped buyer, seller, and reviewer approvals overlap.                                                 | Authority is an intersection of principals rather than a single user's broad token.                      | One party is ornamental or the quorum adds clicks without reducing real risk.                                           |
|  13 | **Semantic time travel**               | A replay reconstructs which tools existed at each event and why, then runs counterfactual state branches without mutating the live room.           | The executable interface becomes auditable historical state.                                             | Replay cannot reproduce the actual registration surface or distracts from the live outcome.                             |
|  14 | **Attention router**                   | The page ranks agent questions by expected information gain, number of blocked decisions, and human interruption cost.                             | It optimizes scarce human attention rather than generic task completion.                                 | Rankings are arbitrary or suppress a minority safety-critical question.                                                 |
|  15 | **Uncertainty-priced tools**           | Read tools publish measured latency, cost, reversibility, and evidence quality so the agent can choose an information-gathering policy.            | Tool selection becomes an explicit sequential decision under uncertainty.                                | Metadata is speculative or current agents cannot use it more effectively than plain descriptions.                       |
|  16 | **Physical microtask compiler**        | An agent decomposes an inaccessible real-world task into short human actions with acceptance checks and a shared completion graph.                 | The collaboration unit is a verified human micro-action, not a chat turn.                                | The checks cannot distinguish task completion from plausible-looking media.                                             |
|  17 | **Dual-private overlap**               | Buyer and seller agents each retain private constraints and reveal only whether a concrete, signed offer lies in the feasible intersection.        | Neither counterparty learns the other's reservation value; only actionable overlap crosses the membrane. | The protocol becomes a generic negotiation backend with no need for the live page.                                      |
|  18 | **Rights-composed media surface**      | Export, remix, publish, and commerce tools are registered only when clip-level provenance and usage rights compose for that action.                | Media rights directly determine executable capabilities.                                                 | Rights data is synthetic or the tool gating cannot be explained in one glance.                                          |

## Frozen hypotheses

### H1 — A seller-blind decision is a stronger complete experience

**Claim:** Replacing the disclosed five-field buying mandate with four public evidence requirements, while keeping price evaluation inside ChatGPT and binding the hold to an exact current quote, will preserve the complete hero task and make privacy, WebMCP necessity, and human-agent complementarity materially clearer.

**Pass:**

- no Site Tool input, output, page state, or visible seller surface contains a maximum price or buyer profile;
- the agent can inspect the current all-in price, privately decide, and create the same reversible hold against that exact quote;
- a changed/stale quote is rejected with a useful recovery path;
- the ordinary human fallback still completes the flow; and
- the privacy boundary is understandable from the page without narration longer than two sentences.

**Fail:** Any private valuation must cross the page boundary, the hold can be created against a stale quote, or removing the ceiling makes the product story less coherent.

### H2 — The page should expose the route to future tools

**Claim:** A compact counterfactual frontier in the read result and shared UI will make dynamic registration legible and prevent agent dead ends without adding another overlapping tool.

**Pass:** Every nonterminal state identifies the smallest valid next transition, unavailable mutations remain actually unregistered, and invalid or stale calls return a specific recovery action.

**Fail:** The frontier disagrees with registered tools, recommends an impossible transition, or substantially duplicates the current tool list without improving recovery.

### H3 — One camera answer can serve a private crowd

**Claim:** Aggregating only normalized evidence demand lets one host answer unblock several attending agents without exposing their profiles, budgets, or decisions, creating a judge-visible human-agent collaboration moment beyond ordinary shopping chat.

**Pass:** One host transition resolves at least eight transparently labeled demo-room requests, the UI visibly shows the multicast effect, and the stored/requested shape contains no individual preference data.

**Fail:** The count is merely decorative, the host must inspect individual profiles, or the aggregate obscures an important minority request.

### H4 — A separate host view may make the market feel real

**Claim:** Synchronizing a buyer/agent view with a host view will improve perceived execution and collaboration more than its operational and demo complexity costs.

**Pass:** Two ordinary-browser contexts complete request-to-answer propagation with deterministic recovery, while the 45-second hero story becomes easier to understand.

**Fail:** Cross-context behavior is flaky in judged clients, duplicates the already-visible host control, or consumes more demo time than the added credibility earns.

### H5 — A consented keyframe can make the human-sensor claim concrete

Scoped in-session before the camera UI implementation.

**Claim:** An explicitly started, video-only host camera can capture one bounded keyframe, attach structured provenance and a human repair-history attestation, and unlock the same WebMCP decision without making raw media part of shared room state.

**Pass:** Camera access is off by default; denial preserves a deterministic fallback; tracks stop after capture/unmount; the synchronized and WebMCP-visible record contains only frame ID, timestamp, dimensions, SHA-256, source kind, and label; one host confirmation updates the buyer and dynamic tool surface; and desktop/mobile layouts remain coherent.

**Fail:** Permission is implicit, raw media enters the room snapshot, the digest is presented as authenticity proof, the judged path requires a camera, or the new state breaks native tool registration.

### H6 — A model proposal can improve evidence without becoming the authority

Frozen in-session before the visual-proposal route and review UI implementation.

**Claim:** Sending one explicitly selected, digest-bound keyframe through Vercel AI Gateway can produce a useful pixel-grounded proposal, while an explicit host accept/correct step and a separate historical attestation prevent the model from becoming the purchase authority.

**Pass:** The server recomputes the JPEG digest before inference; the proposal is strict structured output bound to the exact frame; current OpenAI vision models route through AI Gateway with model fallback and zero-data-retention preference; an unavailable or unconfigured Gateway becomes an honest manual-review path; the selected frame is published only after review; the hold remains unavailable until a clear base view and non-unclear visible-surface finding coexist with the host attestation; and native WebMCP exposes the audit chain without embedding image bytes in tool output.

**Fail:** A model output alone unlocks the hold, pixels are described as proof of repair history or authenticity, a provider error breaks the judged path, a proposal can be replayed against another frame, the camera feed is uploaded automatically, or the new review step makes the short product story incoherent.

## Frozen experiment protocols

### E1 — Preference-leakage boundary

1. Capture the Rung 1 contract as the positive leakage control: `maxAllInPrice` exists in the tool schema, state snapshot, evaluation, and UI.
2. Implement H1 with a four-field public evidence envelope and exact-quote hold input.
3. Add recursive contract tests that fail if forbidden private-value keys or phrases appear in any registered definition or returned snapshot.
4. Exercise supported, violated, unresolved, stale-quote, duplicate, cancellation, and release paths.

Decision rule: graduate only if the whole hero path remains green and no valuation crosses the seller boundary.

### E2 — Dynamic WebMCP contract and recovery

1. Verify in unit/component tests that dynamic registration matches the counterfactual frontier after every transition.
2. Run the production app in a fresh isolated native Chrome profile with WebMCP enabled.
3. Discover and execute the live tools through `document.modelContext`, including a stale exact quote, evidence request, host answer, hold, and release.
4. Run without the feature as a negative control and keep ordinary-browser visual verification separate.

Decision rule: record native evidence narrowly; do not infer ChatGPT compatibility from Chrome or headless execution.

### E3 — Private-crowd evidence multicast

1. Seed a clearly labeled deterministic demo room with seven anonymous agents blocked on the same normalized repair-history fact.
2. Let the attending ChatGPT/user add the eighth request through the real transition.
3. Answer once as the host and assert that all eight requests resolve while no profile or price field exists.
4. Render the before/after effect and test the minority-safety escape: only identical evidence kinds aggregate.

Decision rule: keep only if the aggregate is stateful, truthful about being a fixture, visually obvious, and does not weaken the single-buyer flow.

### E4 — Two-context host spike

Implement only after E1-E3. Compare an in-page host control against a `BroadcastChannel` two-view spike using the same request/answer sequence. Kill the branch if it does not materially improve the short demo or exact-client reliability.

### E5 — Consented camera keyframe and provenance

1. Keep the permission-free host buttons as the judge-safe control.
2. Request `getUserMedia` only from an explicit host click, with `audio: false` and an environment-facing video preference.
3. Capture one bounded JPEG frame locally, compute SHA-256, discard the continuous stream, and synchronize only a strict provenance descriptor.
4. Require the host to bind either `none` or `repaired` to that frame; never infer authenticity from the digest.
5. Verify the descriptor through the native `document.modelContext` consumer API, then perform and release an exact-quote hold.

Decision rule: graduate only if the native tool surface remains dynamic, the raw frame never enters synchronized/WebMCP state, camera denial leaves the deterministic path intact, and the visual experience survives desktop and phone widths.

### E6 — Frame-cited visual proposal with human review

1. Preserve H5's explicit capture gate. Add a second explicit “Analyze” action that sends only the selected JPEG and its declared provenance.
2. Recompute SHA-256 server-side and reject mismatched bytes, malformed media, or oversized frames before any provider call.
3. Generate a strict observation with AI SDK 7 through Vercel AI Gateway, using `openai/gpt-5.6-sol` with Terra and Luna fallbacks and zero-data-retention routing preference.
4. Forbid claims about identity, intent, authenticity, price, ownership, safety, or historical repair. Require the host to accept or correct the proposed base visibility and visible surface signal.
5. If Gateway authentication or inference is unavailable, expose a typed manual-review path rather than a synthetic model answer.
6. Publish the one selected JPEG only after review, but keep its bytes out of Site Tool results. Require a separate host history attestation before the exact-quote hold appears.
7. Verify route validation, model configuration, manual fallback, cross-frame refusal, conflict refusal, two-tab propagation, selected-frame rendering, dynamic native tools, exact hold, and release.

Decision rule: graduate only if the model is useful but non-authoritative, the no-model path remains complete, and the resulting evidence chain is more legible—not merely more complicated—than the provenance-only rung.

## Current evidence-directed call

Keep the E1-E3 core plus the H4 host surface, H5 camera provenance, and H6 reviewed visual proposal as the current cumulative rung. They reinforce one sentence:

> The live market learns what proof to show, not what each buyer is willing to pay.

The original rung remains recoverable. The Voice experiment isolated a platform-ownership seam rather than a product defect: audio reaches a delegated Codex task, but that task does not inherit the UI-owned Browser. Camera transport/provenance and the reviewed visual-evidence path now pass locally. The next acceptance gate is one authenticated live AI Gateway call against a real product frame; the next product/infrastructure choice is between real cross-device room transport and the first authoritative UCP commerce object. Neither may replace the typed, one-screen golden path.

## Experiment results — 2026-08-26

### E1 — Pass: the complete loop no longer discloses a buyer ceiling

- Commit `41ab726` is the positive leakage control: `maxAllInPrice` crossed the tool schema, page state, evaluation, and visible seller surface.
- The new `set_evidence_requirements` schema accepts only length bounds, visible-edge evidence, and prior-repair policy. Strict runtime parsing rejects an added `maxAllInPrice` field.
- Recursive contract checks find no forbidden private-value key, buyer-profile phrase, or fixture ceiling in registered definitions or returned snapshots.
- `reserve_current_lot` receives only the exact public all-in quote the agent is accepting. A stale `$400` call against the current `$423` quote is refused without creating a hold; `$423` succeeds.
- Supported, incompatible, unresolved, duplicate-request, stale-request, cancellation, hold, and release behaviors pass.
- The visible privacy receipt explains the boundary in two sentences.

Limitation: withholding direct profile and ceiling fields minimizes disclosure; it does not prove that a seller can never infer preferences from behavior. The product and documentation now state that explicitly.

### E2 and H2 — Pass in isolated Chrome and the exact ChatGPT client

- Isolated Headless Chrome 150 discovered exactly the three initial tools, executed `set_evidence_requirements`, observed `request_host_evidence` appear, executed it, and observed it disappear.
- One visible host answer unlocked `reserve_current_lot`. Native execution rejected stale `$400`, accepted exact `$423`, replaced reserve with release, and restored the prior surface after release.
- The page and every read result exposed the same smallest valid next transition; impossible mutations remained unregistered. The stale-evidence and stale-quote paths returned concrete recovery actions.
- Fresh isolated profiles in the installed Chrome 151.0.7922.174 rendered `Site Tools live` with `--enable-features=WebMCP` and `Browser fallback` with the feature disabled.
- The ordinary-browser human flow completed share → request → host answer → hold → release. Desktop and 390 px layouts had no framework overlay or horizontal overflow.

The exact ChatGPT evidence is recorded separately below. These results do not establish Voice-to-Site-Tools composition, Mark's normal Chrome profile, or every future ChatGPT/Chrome release; those remain explicit gates.

### E3 — Pass as a transparent deterministic room fixture

- Seven anonymous `repair_history` demand signals are present initially.
- The current agent's real request changes the aggregate to eight queued requests.
- One host answer changes the same aggregate to eight resolved requests.
- Stored demand contains only evidence kind, count, and status; the current request retains action attribution but no buyer profile or price.
- The UI labels the other seven agents as a demo-room fixture and lands the multicast effect as “One answer → 8 private decisions.”
- Only identical evidence kinds aggregate; unsupported or no-longer-useful requests are refused.

This proves the interaction and state contract, not real multi-user networking. H4 is the experiment that can turn the visible crowd from a deterministic fixture into a separate live host surface.

### Exact ChatGPT in-app Browser — Pass for the complete typed core flow

- ChatGPT desktop 26.820.60940 with GPT-5.6 Sol connected its built-in Browser to the visible local production page and discovered exactly the three valid initial Site Tools.
- A model-driven native call to `set_evidence_requirements` sent only the four public product fields. The returned receipt listed the buyer ceiling, willingness to pay, profile, and urgency as not collected.
- The native tool surface followed the live state exactly: three initial tools → four with `request_host_evidence` → three after the request queued → four with `reserve_current_lot` after the host answer → three with `release_current_lot` while held → four again after release.
- `request_host_evidence` changed the aggregate from seven fixture signals to eight private decisions represented by one normalized question. One visible host answer supplied timestamped provenance and made the lot eligible.
- A native exact-quote hold attempt at stale `$400` was refused against the current `$423` quote. Retrying with `$423` created a reversible local hold without payment; release succeeded and restored the reserve surface.
- No browser warnings or errors appeared. No confirmation UI surfaced for this local, non-payment hold; that is an observed result for this action, not a claim that purchases or other consequential actions bypass normal confirmation.
- Machine-local screenshots are retained outside the repository from initial discovery through release.

This closes the most important typed judge-client compatibility gate. Voice transport/delegation is now measured separately below; a supported Browser handoff, repeated navigation/reconnect behavior, and a clean-room run on Mark's MBP remain acceptance work.

### E4 and H4 — Pass locally; keep as a progressive hero layer

- Separate buyer `/` and host `/host` pages completed request-to-answer propagation through a same-origin `BroadcastChannel` room.
- A late-joining host recovered current state, and refreshing the buyer recovered the resolved state while the host remained open.
- The host saw only four normalized evidence fields and “8 private decisions need one fact”; no price, ceiling, profile, or urgency crossed the seller surface.
- Desktop and 390 px two-view checks passed without browser errors, framework overlays, or horizontal overflow.
- The in-page host answer remains available, so a judge can complete the exact same domain transition without a second tab or device.

Decision: **keep H4 as progressive enhancement.** It materially improves the collaboration story without weakening the deterministic path. Its current transport proves same-browser coordination, not a real networked room; a public phone/desktop room must compare a narrowly scoped realtime transport before making cross-device claims.

### Voice composition — Transport passes; Browser handoff remains unproven

- A signed-in, headless ChatGPT Realtime WebRTC session received the spoken mandate over real Opus/RTP, produced the correct transcript, and delegated it to native Codex.
- The delegated task initialized a browser runtime but did not inherit the existing UI-owned in-app Browser binding. It therefore performed no Site Tool call and sent no buyer ceiling or other state to the page.
- Attempts to seize or silently reroute the UI-owned task were stopped. This is the correct security/ownership boundary, not a reason to build an unsupported bypass.
- The typed Site Tools path remains the reliable acceptance path. A one-click human Voice/browser handoff is acceptable unless the first-party client exposes supported composition during the challenge.

Decision: **keep Voice as a progressive input, not a submission dependency.** Re-test when the exact ChatGPT client changes; do not claim autonomous spoken completion yet.

### E5 and H5 — Pass locally with synthetic camera input

- The host camera is off by default and starts only from `Start camera`; constraints request video only and prefer the environment-facing camera.
- The successful browser run used Chromium's synthetic camera source. It captured a real 960×540 JPEG through `getUserMedia`/canvas, computed SHA-256 locally, stopped the stream, and displayed the selected keyframe for host review.
- Publishing `no prior repair` synchronized only strict provenance: `camera-keyframe`, frame ID, UTC capture time, dimensions, digest, and label. Raw bytes/blob URLs were absent from room snapshots and WebMCP results.
- The buyer immediately changed to 3/3 supported and exposed `reserve_current_lot`. Native `document.modelContext.executeTool` returned the camera descriptor, created the exact `$423` reversible hold, changed the registered surface to `release_current_lot`, and released successfully.
- The permission-denial/retry path and track cleanup pass component tests; the permission-free fixture remains beside the camera controls.
- Desktop camera/captured/buyer-ready views and a 390×844 host view had meaningful content, no framework overlay, no console/page errors, and no horizontal overflow.
- Five machine-local acceptance screenshots are retained outside the repository from host request through mobile resolved state.
- The then-current full gate passed: formatting, zero-warning ESLint, strict TypeScript, 31 Vitest behaviors, and a Next.js 16.3.3 production build.

Decision: **graduate H5 as the current camera/provenance rung.** A SHA-256 digest is a content fingerprint, not authenticity evidence. The next rung must propose a cited visual fact for human acceptance; it must not claim that the model watched continuous video or independently proved repair history.

### E6 and H6 — Product path passes; authenticated model call remains open

- The app now installs AI SDK 7.0.79 and uses a plain Gateway model ID, which makes Vercel AI Gateway the default provider. The route selects `openai/gpt-5.6-sol`, then configures `gpt-5.6-terra` and `gpt-5.6-luna` as model fallbacks with `zeroDataRetention: true`. These IDs and image-input capabilities were re-read from the unauthenticated live Gateway model catalog on 2026-08-26 rather than assumed from memory.
- `POST /api/evidence/propose` accepts one JPEG no larger than 650 KB, validates its bounded dimensions and derived frame ID, recomputes SHA-256 from the received bytes, and refuses a mismatch before inference.
- The AI prompt and Zod output schema permit only base visibility, visible surface signals, confidence, pixel-grounded details, a short summary, and a suggested next view. The server excludes image-bearing request messages/bodies from AI SDK result retention.
- A model response remains a proposal. The host must accept or correct it; the audit record preserves the model ID, original proposal, reviewed finding, decision, frame ID, and digest. Manual review records `modelId: null` and never masquerades as an AI result.
- The state machine refuses an unreviewed camera attestation, a review bound to another frame, an unclear/unusable view, a no-repair attestation that conflicts with a visible possible-repair signal, or a camera answer that omits the intentionally public selected JPEG.
- The local machine has neither `AI_GATEWAY_API_KEY` nor `VERCEL_OIDC_TOKEN`, so the real browser run correctly exercised `gateway-unconfigured` → manual review. Unit/API tests inject a typed model result and verify the exact Sol → Terra → Luna Gateway configuration without making a network-billed call.
- The browser run completed capture → server digest verification → typed manual fallback → host selections → review receipt → selected-frame publication → buyer 4/4 evidence → native WebMCP inspect → exact `$423` reserve → dynamic release → release. Tool output exposed the full provenance/review chain and `selectedFramePubliclyVisible: true`, but contained no `data:image` payload.
- The live feed remained local. Only one explicitly analyzed/published JPEG crossed the boundary. The buyer view visibly rendered that JPEG alongside the reviewed observation and the warning that pixels cannot establish historical repair.
- Formatting, zero-warning ESLint, strict TypeScript, 41 Vitest behaviors across 9 files, and the Next.js 16.3.3 production build pass. Browser console and page-error logs are empty. Desktop host/buyer and 390×844 buyer screenshots are retained outside the repository.

Decision: **graduate H6 as the current product path, with one narrow acceptance caveat.** The manual fallback, review authority, published-frame UX, and WebMCP lifecycle are real and pass. Do not claim a live GPT-5.6 visual result until this project receives Gateway auth and the same flow passes against a staged physical product frame.

## Graduation decision

Graduate this privacy membrane + counterfactual frontier + epistemic multicast combination as Rung 2. It improves every judging dimension without weakening the recoverable Rung 1 golden path:

- **WebMCP leverage:** page-local evidence and tool lifetimes determine what the agent can do.
- **Execution:** native and ordinary-browser paths both complete the whole reversible loop.
- **Potential impact:** buyers reveal less while one human observation serves many private decisions.
- **Creativity and ambition:** the agent is a privacy boundary and attention coordinator, not a shopping macro.

H4-H6 and the typed exact-ChatGPT path pass, subject to the authenticated Gateway caveat above. Voice transport passes but exact Voice-to-UI-owned-Browser composition does not. The next sequence is now: authenticate and blind-check the visual proposal on a staged physical frame; rehearse the 45-second two-surface story; then choose the next product rung by information value—real phone/desktop room transport or an authoritative UCP product/offer/checkout seam. UCP should own catalog, offer, cart, checkout, consent, and permalink state rather than being reduced to a logo-bearing API call. A Lean certificate should enter only when it gates a consequential, judge-visible invariant rather than decorating the architecture.

## Strategic reset and next frozen experiments — 2026-08-26

The broad challenge, field, sponsor, Vidably, UCP, math, and clean-sheet concept audits converge on one update: keep the completed core, but reframe the ambition as a **live evidence exchange / Reality API**. Commerce remains the clearest first outcome; it is not the primitive itself.

The preceding graduation decision remains valid evidence of the local rung. This reset supersedes only its proposed next-step ordering. A simulated crowd, same-browser `BroadcastChannel`, synthetic camera, unauthenticated model fallback, and local reversible hold are not enough to support the final impact/execution story, even though each is an honest and useful fallback.

### E7 — Real two-client physical-world event

Frozen claim:

> A buyer-side WebMCP request can cause a separately connected seller phone to acquire one fresh physical observation, and the reviewed result can update the buyer's visible state without sharing private price/profile fields.

Protocol:

1. Preserve the current local resettable fallback unchanged.
2. Join buyer and seller through a short room code or QR URL on separate devices and networks.
3. Use revisioned server-authoritative state with ordered updates, reconnect recovery, idempotent request handling, expiry, and a bounded room lifetime.
4. Use one owned, rights-cleared physical object. Capture a real phone-camera frame only after an explicit host gesture.
5. Synchronize only the reviewed frame/evidence packet intended for publication; never synchronize the private ceiling or raw continuous feed.
6. Complete the native Site Tools flow in the exact ChatGPT client and current Chrome build, then repeat after buyer refresh and host reconnect.
7. Record first-connect latency, request-to-cue latency, evidence-to-state latency, duplicate behavior, recovery, and every transmitted field.

Decision rule: graduate only if the remote event is visibly causal, survives reconnect, has no silent stale state, and remains understandable without explaining the transport. Compare a minimal Vercel WebSocket implementation with a Cloudflare Durable Object room; choose the one that is more reliable and legible, not the one with more sponsor logos.

#### E7.1 — Authoritative transport checkpoint

Status: **Cloudflare transport selected and locally proven; app integration and real-device graduation pending.**

- Re-read the current Vercel WebSocket and Cloudflare Durable Object/Hibernation/testing documentation on 2026-08-26 PT. Vercel's newer guidance supports WebSockets but requires an experimental Next upgrade API, Redis/pub-sub across Function instances, reconnect at maximum duration, and reconciliation with an older limits page that still denies server support. One Durable Object directly owns the ordered room, storage, sockets, hibernation recovery, and expiry.
- Added a standalone Worker package pinned to Wrangler 4.126.0, `@cloudflare/vitest-plugin` 1.1.0, Workers types 5.20260827.1, Vitest 4.1.11, TypeScript 5.9.3, and Zod 4.4.3. It uses the current declarative `exports` configuration and SQLite storage rather than a legacy migration.
- `POST /rooms` returns short-lived buyer and host role credentials; only SHA-256 digests enter room storage. WebSocket URLs contain the six-character room ID but no token. Browser origins are allowlisted before a Durable Object is invoked.
- The first socket frame authenticates a role. Subsequent commands pass through a strict shared schema and the existing guarded market state machine. The server—not either client—owns revision, authorization, bounded duplicate history, current state, and expiry.
- Six tests run inside the current Workers runtime: unique role credentials/CORS, hostile-origin refusal, buyer → host → buyer evidence propagation, role escalation refusal, stale-write refusal, duplicate replay, state and authenticated-socket recovery after forced Durable Object eviction, and alarm-driven deletion/peer closure.
- The Worker dry-run bundle is 599.57 KiB (90.93 KiB gzip). The combined deterministic gate is now 45 app tests plus 6 Workers-runtime tests.

The checkpoint does **not** yet satisfy E7: the Next app still uses its existing same-browser room, no public Worker has been deployed, and no physical phone has joined. Next, replace closure-based page mutations with serializable commands, add a reconnecting browser client and fragment-carried host invite, then run the real phone/desktop path. The public JPEG must also be reduced below Cloudflare's 2 MB stored-value ceiling; continuous video and private buyer context remain out of the protocol.

#### E7.2 — Browser integration checkpoint

Status: **application integration and remote-camera path proven locally; public deployment and physical-phone graduation pending.**

- Every human control and native Site Tool now dispatches the same strict serializable `RoomCommand` through the same guarded state machine. The local `BroadcastChannel` path remains available when no room service is configured.
- The remote browser client authenticates in the first WebSocket frame, keeps credentials out of URLs, allows one command in flight, waits for the authoritative snapshot before resolving a Site Tool call, and replays an unacknowledged command with the same command ID after reconnect. Server revisions, duplicate history, and role authorization remain authoritative.
- The buyer creates a two-hour room and displays a six-character code plus explicit host invite. The host credential is carried in the URL fragment, copied into session storage, and stripped from address history immediately; buyer and host credentials never enter durable page state or Site Tool results.
- A native Chrome WebMCP run completed requirements → remote host request → separate host answer → 4/4 supported → stale-price refusal → exact `$423` hold → release. Buyer and host refreshes recovered the authoritative state.
- Stopping and restarting Wrangler cleared peer presence, triggered bounded reconnect backoff, recovered the same Durable Object state, and restored both peers without duplicating commands. A second run published a reviewed 960×540 synthetic-camera JPEG through the room; the buyer rendered the same selected frame and remained ready after another Worker restart.
- Camera encoding now tries progressively smaller JPEG qualities and refuses publication above 650 KB. The strict room schema permits at most 900,000 data-URL characters, comfortably below Cloudflare's 2 MB value limit while leaving room for the rest of the snapshot.
- The combined gate passes: formatting, zero-warning ESLint, strict TypeScript, 54 app tests across 12 files, 6 Workers-runtime tests, a Wrangler 4.126.0 dry-run, and the Next.js 16.3.3 production build. Browser console and page-error logs were empty.
- Fresh 390×844 buyer and host captures had no horizontal overflow. The complete state remained legible: room linkage, privacy boundary, reviewed public frame, 4/4 support, exact-price action, and host-visible aggregate all survived the narrow layout.

This is a real network protocol between two separately authenticated React clients, but both acceptance clients still ran as tabs on the Mac mini and the camera was Chromium's synthetic device. Do not call E7 graduated until an HTTPS deployment passes on a physical phone and the judged desktop client, including reconnect and a rights-cleared object.

#### E7.3 — Public HTTPS and live-inference checkpoint

Status: **public two-client and native-WebMCP journey passed; permanent room origin, physical phone, and exact ChatGPT rerun remain.**

- Deployed the Next.js 16.3.3 app as a protected Vercel preview and a Wrangler 4.126.0 temporary Cloudflare Worker containing the Durable Object. The stable Vercel preview alias reached the remote Worker over HTTPS/WSS, recovered the existing authoritative room across Vercel deployments, and kept buyer/host credentials out of page state and Site Tool output.
- A protected-preview edge case failed safely but is disqualifying for the final URL: opening the fragment-bearing host invite before a protection cookie redirected to Vercel login while retaining the fragment in the browser address. URL fragments are not sent in HTTP requests, but redirect-page JavaScript could read one. The judge-facing host path must therefore have no authentication redirect; this becomes a deployment preflight regression.
- Vercel OIDC authentication was present and reached AI Gateway. The advertised GPT-5.6 Sol/Terra/Luna routes returned a live `RestrictedModelsError` on this team's free-credit state, so they are retained as a paid-credit upgrade hypothesis rather than falsely claimed as working. Same-image probes measured current free-tier routes: Qwen 3.7 Flash completed plain vision in about 4.6 seconds and structured vision in about 4.0 seconds with `zeroDataRetention: true`; Qwen 3.8 Flash's vision route returned three 429s; GLM 5.3 Flash timed out at 20 seconds; MiniMax M3 returned no structured output. The app now defaults to the measured Qwen 3.7 route, disables reasoning for this bounded observation, and keeps Qwen 3.8 as its Gateway fallback.
- The public synthetic-camera call returned a strict proposal from `alibaba/qwen3.7-flash` within the 20-second route deadline. It explicitly recognized a green test pattern rather than a snowboard, chose `baseVisibility: not-visible`, and remained untrusted until host review. After the host accepted the truthful negative result, both publication actions stayed disabled. This is a successful anti-hallucination and authority-boundary test, not positive product evidence.
- The deterministic fixture then completed only the remaining transport/action acceptance: buyer state became 4/4, native Chrome 151 exposed `reserve_current_lot`, stale `$400` was refused, exact `$423` created a reversible no-payment hold, registration changed to `release_current_lot`, and release restored reserve. Native inspection returned provenance and no image bytes. The private `$450` ceiling was never sent to the page, Worker, host, or tool output.
- Chrome 151's in-page consumer currently requires `document.modelContext.executeTool(tool, JSON.stringify(input))`; passing the input object directly fails to parse. Registration updates become visible after the React/tool-change tick rather than synchronously inside the same execution promise.

This checkpoint does not graduate E7. The Cloudflare temporary account/Worker expires without a human claim or authenticated permanent deployment, and both clients still ran in isolated Chromium on the Mac mini. The next minimal human gate is a permanent Cloudflare login/deploy followed by one rights-cleared physical-phone capture on the final unprotected host origin. The exact ChatGPT in-app Browser must then repeat the compact flow.

### E8 — Authoritative UCP commerce boundary

Frozen claim:

> Reviewed evidence can unlock a real merchant cart/handoff whose price, product, and continuation state are authoritative outside the demo app.

Protocol:

1. Use an owned Shopify development-store product and cleared media for the judged path.
2. Fetch the merchant/platform profile and negotiate the actually advertised UCP version/capabilities. Do not assume the canonical `2026-08-25` schema when Shopify advertises `2026-04-08`.
3. Use Global/Storefront Catalog or Cart MCP as documented; preserve the merchant's exact live schema and continuation URL.
4. Let WebMCP own only the situated live evidence/request/action frontier. Do not duplicate Shopify's generic catalog/cart tools.
5. Create the cart or permalink only after evidence requirements are supported and after normal ChatGPT confirmation behavior. Do not complete payment in the hero path.
6. Test expiry, stock/price change, unsupported capability, merchant failure, and fallback to the local reversible hold.

Decision rule: graduate only if the resulting cart/handoff is externally authoritative, dynamically negotiated, visible to the user, and clearer than the local hold it replaces.

#### E8.1 — Live protocol and reversible-cart checkpoint

Status: **current Shopify wire path proven twice; owned merchant and judged-flow integration pending.**

- Re-read UCP, Shopify profile negotiation, access-tier, Global Catalog, and Cart MCP documentation on 2026-08-26 PT. Shopify's live merchant profiles currently advertise UCP `2026-04-08`; they do not yet justify assuming the broader draft's `2026-08-25` shape. Anonymous Cart supports create/get/update/cancel and a human continuation URL without buyer credentials or payment authority.
- Installed the official `shopify@openai-curated` Codex plugin (installed revision `11c74d6b`, UCP skill metadata `1.9.1`) and `@shopify/ucp-cli` `0.7.0`. A local `webmcp-challenge` profile is pinned to exactly `2026-04-08`; `ucp doctor` passes with one non-blocking warning. Shopify/UCP telemetry was opted out for all CLI probes.
- Global Catalog found a real available secondhand 156 cm snowboard at `$389.95` from a public Shopify merchant. Live discovery negotiated the merchant's same-origin MCP endpoint and 13 tools. A dry run proved that Cart needed only the variant, quantity, localization context, intent, idempotency metadata, and public profile—not buyer identity, private ceiling, address, or payment data.
- The official CLI created one real anonymous cart, preserved the merchant's ordered `$389.95` subtotal/total, returned a merchant continuation origin, and immediately canceled the cart. No purchase, checkout, seller contact, or retained cart credential occurred.
- The app now publishes a minimal `/.well-known/ucp` platform profile declaring only Cart and includes a narrow, fetch-injected UCP JSON-RPC client. It bounds responses and time, requires credential-free HTTPS, rejects redirects and cross-origin negotiated endpoints, verifies both `create_cart` and `cancel_cart`, preserves merchant totals/messages without recomputing them, and never accepts buyer/budget/address/payment fields.
- Seven deterministic tests cover negotiation, payload minimization, ordered merchant receipts, missing tools, version drift, cancellation, and the public profile. An opt-in live test then used the new client to create and immediately cancel a second real anonymous cart against the same merchant; it passed without logging or retaining the cart ID.
- `@ucp-js/sdk` `0.4.6` was evaluated and removed rather than adopted for its badge: its raw Node 26 ESM build fails on extensionless internal imports, and its discovery schema rejects both Shopify's official current fixture and a live merchant profile because it expects an older services/capabilities shape. The working client follows the current profiles and the official CLI `0.7.0` request envelopes instead.

This does **not** graduate E8. The public merchant was an integration control only; its trademarks/media will not enter the submission. The judged path still needs an owned development-store product with cleared media, a publicly reachable profile, Durable Object ownership of the private cart credential, visible merchant-authored receipt state, failure/expiry tests, and a human checkout handoff.

#### E8.2 — Authoritative-room cart checkpoint

Status: **private UCP cart authority and buyer-only handoff proven in the Workers runtime; owned merchant and public browser acceptance pending.**

- The buyer's configured evidence requirements and exact-price hold now gate two new dynamic WebMCP actions: `prepare_merchant_cart` and `cancel_merchant_cart`. Neither action exists before the evidence frontier is satisfied and the reversible hold is active. An active merchant cart blocks both duplicate preparation and local hold release; cancellation restores the safe release path.
- The Cloudflare Durable Object—not either browser—owns the UCP cart ID, idempotency, lifecycle, and merchant calls. Public room snapshots contain only a bounded merchant-authored receipt: protocol version, merchant origin, status, line labels/quantities, ordered totals, messages, and expiry. They never contain the cart ID or continuation URL.
- A successful preparation returns the continuation URL only in the invoking buyer's command result. Host and buyer broadcasts receive the same sanitized snapshot. Duplicate replay can recover the private result only when the role, browser-client ID, and SHA-256 command digest all match; cross-role and changed-payload reuse is refused. Cancellation, reset, and expiry purge it. The URL must remain on the negotiated merchant origin.
- The merchant request contains only the configured variant, quantity, currency/language context, public platform profile, intent, and a deterministic idempotency key. Tests reject named buyer, budget, address, payment, and credential fields. The private `$450` ceiling remains local to ChatGPT and is not an application input.
- Browser protocol version `2` makes the new private-result envelope an explicit compatibility boundary. Local demo mode continues to refuse merchant-cart commands rather than simulate authority; the UCP panel appears only when the authoritative room is configured.
- Cloudflare Workers rejects Fetch's `redirect: "error"` mode even though Node accepts it. The client now uses portable `redirect: "manual"` and explicitly refuses every 3xx response. The same-origin continuation check provides the second redirect/handoff guard.
- Re-read Cloudflare's current `@cloudflare/vitest-plugin` 1.1 testing guidance on 2026-08-27 PT. The new `@msw/cloudflare` path did not intercept a fetch originating inside this Durable Object in our direct evaluation, so it was removed. A documented Miniflare service binding supplies a strict fake UCP merchant inside the same workerd process instead; production config contains no fake binding.
- The Workers integration test completes evidence → exact hold → real UCP-shaped create → cross-role replay refusal → same-client duplicate replay → cancel → private-result purge → release. Merchant receipt cardinality and activity history are bounded to the synchronized room schema. The full gate passes 69 application tests and 7 Workers-runtime tests, zero-warning ESLint, strict TypeScript, a Wrangler 4.126.0 dry-run, and a Next.js 16.3.3 production build.

This still does **not** graduate E8. The configured browser panel has not yet passed against a public owned merchant, and a private continuation must never be demonstrated with another merchant's product or media. The next acceptance rung is an isolated Shopify development-store item with original/cleared presentation, followed by public buyer/host browser execution and immediate cart cancellation. Checkout completion remains outside the hero path.

#### E8.3 — Browser and native-Site-Tools checkpoint

Status: **the complete configured experience passes in native Chrome against a labeled HTTPS fixture; owned Shopify replacement pending.**

- Added a deliberately non-checkout UCP fixture for local browser acceptance. It advertises the current `2026-04-08` Cart profile, emits one original demo-board receipt and a same-origin handoff warning, refuses named private fields, and cannot charge or purchase. It is test-only, is absent from production Worker bindings, and is not the proposed judged merchant.
- The human UI passed in two browser tabs backed by the actual Durable Object: buyer shares evidence requirements → requests the missing fact → separate host answers → buyer creates the exact `$423` hold → prepares the merchant cart → sees ordered `$375` merchant totals and the buyer-only handoff → cancels → releases. The host DOM contained neither the cart ID nor continuation path; both disappeared from the buyer DOM after cancellation.
- The native Chrome consumer then executed the same transitions through the page contract. Dynamic registration progressed from scope/request to `reserve_current_lot`, then `prepare_merchant_cart`, then only `cancel_merchant_cart`, then `release_current_lot`. The prepare result contained a private HTTPS handoff for the invoking buyer while its nested shared state contained neither cart credential nor continuation path.
- Desktop and 390×844 acceptance captures show the UCP receipt, privacy receipt, dynamic tool frontier, and attributed ChatGPT actions without horizontal overflow. Browser console/page-error checks were clean apart from development notices.

This is intentionally a stepping stone, not E8 graduation. It removes browser integration, UI, dynamic-registration, and privacy plumbing from the risk register. The remaining decisive substitution is an owned, publicly reachable Shopify product with cleared presentation, followed by the same native-Site-Tools run and immediate cancellation on the unprotected judged origins.

#### E8.4 — Owned-merchant substitution

Frozen claim:

> A first-party public merchant can make the evidence-gated cart genuinely authoritative tonight, without weakening the privacy boundary or making an expiring/password-gated Shopify development surface part of the judged critical path.

Acceptance contract:

1. A separate public merchant origin owns an original product, the released `2026-08-25` UCP profile, JSON-RPC Cart tools, idempotency, cart expiry, totals, lifecycle, and continuation page.
2. The merchant—not the evidence room—issues and stores cart credentials. The evidence-room Durable Object receives a merchant-authored receipt, retains the credential privately, and broadcasts neither the cart ID nor continuation path.
3. `create_cart` accepts only the one demo variant, quantity `1`, bounded localization, intent, the public platform profile, and an idempotency key. It refuses named buyer, ceiling, address, payment, and unknown fields.
4. Duplicate create calls with the same idempotency key return the same cart; changed payloads, stale/cancelled carts, redirects, oversized bodies, unsupported versions/tools, and malformed calls fail closed.
5. The continuation is a real second web page with its own minimal WebMCP tools. It can inspect and cancel the exact cart but cannot charge, order, or collect payment. Cancellation propagates back to the evidence room and purges the buyer-only handoff.
6. Workerd integration and clean browser tests must cover discovery → create → private handoff → cross-site inspect → cancel → room purge, including host non-disclosure and replay refusal.

Shopify control result, 2026-08-27 PT:

- Shopify CLI auto-upgraded to `4.7.0`. Its new agent-oriented `store create preview` path created an isolated temporary store without signup, card, or payment capability and persisted a broad local Admin API session. A new original 156 cm / `$375` demo product was created and published through Admin GraphQL `2026-07`.
- The temporary storefront registered Shopify's ten native WebMCP tools and served a current UCP `2026-04-08` discovery profile. That proves the intended cross-site composition surface. Before the preview is saved, however, native catalog calls fail at the Storefront API boundary and Cart MCP initialization fails; the stable `myshopify.com` origin remains password-gated. Its expiring preview access is therefore a development control, not a judged dependency.
- Mark's existing personal dev store is isolated from production, populated with Shopify test data, reachable through the installed Vidably app's read/write product scopes, and suitable for a later native-Shopify acceptance run. The installed app lacks publication/token scopes, direct `store auth` requires a one-time browser approval, and the documented storefront-password file is absent on this Mac Mini. No product or app configuration there was changed.
- A new development store in the otherwise empty isolated organization was rejected because CLI store management is not enabled for that organization. No fallback store was created and no paid plan was selected.

Decision: build and graduate the owned public merchant first. Preserve Shopify native WebMCP/UCP as an additive proof of open-web interoperability after the one-time authorization/password seam is cleared; do not let that seam block the reliable hero path.

Implementation and local acceptance result, 2026-08-27 PT:

- A separate Cloudflare Worker now owns the original product, UCP profile, Cart MCP endpoint, SQLite-backed `MerchantLedger` Durable Object, 30-minute expiry alarm, 24-hour bounded retention, idempotency records, same-origin private continuation, and human fallback. It exposes no checkout, order, or payment capability.
- The MCP endpoint is deliberately dual-era. It serves current stateless MCP `2026-07-28` (`server/discover`, per-request `_meta`, required transport headers, complete-result/cache metadata) while retaining the initialization-era/UCP Cart binding used by current Shopify-compatible clients. Header/body mismatches, unsupported versions, unknown methods, hostile origins, oversized bodies, and schema expansion fail closed.
- Twelve Workerd tests cover discovery, deterministic tools, both protocol eras, exact product/totals, strict private-field exclusion, concurrent replay collapse, changed-payload refusal, read-vs-mutation metadata, update/cancel idempotency, expiry, alarm cleanup, origin validation through TLS termination, and guessed-continuation refusal. The root live UCP client also completed create → inspect → immediate cancel over the Tailscale HTTPS boundary.
- Chrome `151.0.7922.174` completed the native two-tab buyer/host journey against the new merchant: requirements → aggregate evidence request → host answer → exact `$423` hold → merchant UCP negotiation → authoritative cart → buyer-only second-origin continuation. The merchant page registered `inspect_merchant_cart` and `cancel_merchant_cart`; after native cancellation it visibly closed the cart and dynamically removed the cancel tool. Returning to the room reconciled the already-cancelled merchant cart, discarded the server-held credential, and left neither cart ID nor continuation path in host-visible state.
- The run found and fixed a real proxy boundary: Tailscale terminates TLS and rewrites the forwarded `Origin` scheme. Validation now requires the same authority and permits only the observed HTTP/HTTPS scheme rewrite when `X-Forwarded-Proto: https`; a foreign authority remains rejected. It also found and fixed a request-stream forwarding hang by consuming and bounding the outer body before Durable Object dispatch.
- A temporary Cloudflare deployment was intentionally stopped when Wrangler asked the operator to accept Cloudflare's Terms of Service and Privacy Policy. The implementation is deployment-dry-run clean, but a stable judge-accessible origin remains pending that one-time user legal/authentication action. No terms were accepted on Mark's behalf.
- A current-stack audit upgraded both Worker packages to Wrangler `4.127.0` and `@cloudflare/vitest-plugin` `1.1.1`; the entire gate still passed. ESLint `10.9.1` was also tested because `9.39.5` is out of upstream support and Next's peer range says `>=9`, but Next `16.3.3`'s bundled `eslint-plugin-react` crashes on the ESLint 10 rule-context API. It was reverted to the newest working 9.x release. TypeScript `7.0.2` was not installed because the current `@typescript-eslint/parser` peer contract caps TypeScript below `6.1`; `5.9.3` remains the newest compatible compiler in the assembled stack.
- The same audit refreshed AI SDK `7.0.79 → 7.0.83` only after reading the installed SDK docs/source; its strict multimodal structured-output tests, typecheck, and production build passed. The repository and the Mac Mini now both use pnpm `11.24.0`, so the declared package-manager version is the one that actually executed the full gate.

Status: **local E8.4 behavior is graduated; public E8.4 deployment is not**. The current working rung remains available over tailnet HTTPS, while the public release gate is isolated to Cloudflare authorization and a repeat of the recorded native acceptance matrix.

#### E8.5 — Released UCP conformance and exact-total closure

Frozen claim:

> The owned merchant can adopt the newly released UCP `2026-08-25` contract and make its authoritative Cart total exactly match the evidence-room hold without breaking the private cross-origin journey.

Status: **released-schema and native-Chrome pass.**

- The canonical UCP repository published and marked `v2026-08-25` latest on August 25, while the announcements index still presented April 8 as current. The tagged release source, Cart specification, MCP binding, and JSON Schemas—not the stale index—became the owned merchant's version authority. Shopify remains a separately negotiated `2026-04-08` interoperability control; no Shopify upgrade is implied.
- The owned business/platform profiles now advertise only the released Cart capability at `2026-08-25`. The Cart MCP result places the Cart directly in `structuredContent` and serializes the identical JSON into `content[]` for older clients.
- The merchant now owns an exact `$423` estimate: `$375` item subtotal plus `$48` flat fulfillment, zero tax, and one authoritative total. This closes the prior contradiction between the evidence-room hold and the merchant's incomplete `$375` receipt without inventing checkout, payment, or order capability.
- Business failures use the standard UCP error envelope. Cancellation returns the full pre-deletion Cart; subsequent reads and cancellations return `not_found`. Room reconciliation treats `not_found` as the desired already-closed state when the buyer canceled from the merchant continuation first.
- An opt-in `pnpm test:ucp-schema` gate uses Hyperjump `1.17.8` to fetch and recursively register the official released schema graph, then validates the owned business profile and exact Cart payload. It passes against the live `ucp.dev` release.
- The focused app/room/merchant suites, strict TypeScript, and the entire nine-phase native Chrome 151 buyer → host → room → merchant → room lifecycle pass after the migration. The cross-origin private handoff and host non-disclosure assertions remain intact.

### E9 — Submission-grade Agent Experience

Frozen claim:

> An unfamiliar judge can understand and complete the core flow in the current ChatGPT/Chrome clients without setup rescue, while the video and repository prove the same lifecycle even if the judge never runs it.

Protocol:

1. Reduce overlapping read tools and keep common tool results near Chrome's recommended context budgets; move verbose audit material behind a separate read path or visible UI.
2. Run direct, ambiguous, corrective, canceled, duplicate, stale-state, confirmation, reconnect, and full-journey prompts using Chrome's WebMCP eval guidance.
3. Capture Chrome DevTools registration/invocation history and, when available, an independent Netlify AXIS report.
4. Add one-click reset, preflight status, camera/model/UCP fallbacks, no-login testing instructions, and a copyable canonical prompt.
5. Rehearse the 45-second causal story and a `2:45` video cut. The first 30 seconds must show private mandate → remote cue → physical evidence, not architecture.
6. Run clean profiles on the judged clients, mobile/desktop accessibility checks, production build, public-link health, license/repository checks, and rights review.

Decision rule: graduate only if the golden path passes repeatedly from a clean state and the description/video/README each make the project independently understandable.

#### E9.1 — Compact tool contract result

Status: **deterministic and native-Chrome pass; exact ChatGPT rerun pending.**

- Re-read the current OpenAI Site Tools page, Chrome best practices/evals, and rendered WebMCP draft on 2026-08-26 PT.
- Removed `inspect_current_lot`, whose implementation and output duplicated `inspect_live_show`. The initial surface is now one read plus one bounded write.
- Rewrote tool descriptions around the positive action and state in which it is useful.
- Replaced the verbose audit snapshot with a decision packet capped at 3,500 serialized characters in every common tested state. Full activity and pixel presentation remain visible in the human UI; the tool packet retains only information needed for the next agent action. E9.4 later tightens this to Chrome's newer 1.5K recommendation.
- Native isolated Chrome passed discovery and execution across `2 → 3 → 2 → 3 → 2 → 3` tools, including dynamic request disappearance, stale-quote refusal, exact hold, and release. The browser showed every state change with no page errors.
- Formatting, zero-warning lint, strict TypeScript, 42 tests across 9 files, and the Next.js production build pass.
- Do not graduate E9 from this sub-result: the current two-tool initial surface still needs direct and ambiguous model-driven prompts in the exact ChatGPT client, plus cancellation/duplicate/reconnect datasets and public-origin clean-room testing.

#### E9.2 — First-screen agent launchpad

Frozen claim:

> A first-time judge can identify the private-agent boundary, start the canonical task, and distinguish live from fallback infrastructure in under 15 seconds without reading the repository.

Status: **local native-Chrome and responsive presentation pass; final-origin blind timing pending.**

- Added a product-native agent launchpad directly below the one-sentence thesis. Its copyable starter contains the four product-evidence fields and a stop-before-hold boundary, but no numeric maximum, identity, address, payment, or merchant credential. The user is told to give the actual maximum only to ChatGPT.
- Added a live four-boundary preflight derived from runtime state: native WebMCP registration, authoritative Durable Object room vs same-screen fallback, seller-phone presence/invite readiness, and authoritative UCP merchant vs demo hold. It does not claim a service is live when the deterministic fallback is running.
- Removed the decorative `184 watching` fiction from both buyer and host surfaces. The UI now reports the actual deterministic test-agent aggregate that drives the evidence queue.
- Chrome 151 registered the expected two initial tools, copied the budget-free starter, and rendered the thesis, launchpad, live lot, UCP boundary, and dynamic tool contract in one coherent desktop screen. At `390×844`, the top journey remained readable with no horizontal overflow. Both widths had meaningful accessible structure, no framework overlay, and no console or page errors.

This is a comprehension rung, not E9 graduation. A fresh person must still be timed on the final public URL, and the exact model-driven ChatGPT journey must demonstrate that the copied starter causes the intended sequence without rescue.

#### E9.3 — Credential-suppressed native acceptance matrix

Frozen claim:

> A clean Chrome session can repeat the complete two-person, two-origin WebMCP lifecycle without a human operator, while the acceptance artifact itself cannot disclose the buyer's private ceiling or either bearer credential.

Status: **native Chrome pass over tailnet HTTPS; final public-origin and ChatGPT model-driven passes pending.**

- Pinned the current `agent-browser` `0.35.1` release after reading its version-matched core skill. The runner uses a unique browser session, the system Chrome binary with WebMCP enabled, a three-host network allowlist, `eval --stdin`, stable tab IDs, bounded polling, and guaranteed session cleanup.
- The acceptance path starts from a reset buyer room and asserts the exact dynamic Site Tool frontier at every stage. It performs native inspection, shares only the four evidence fields, joins the normalized repair-history request, switches to a separately authenticated host surface, publishes the deterministic no-repair answer, re-inspects the resulting public proof, and creates the hold only at the exact current `$423` quote.
- The same run negotiates the owned merchant's released UCP `2026-08-25` surface, creates the exact `$423` Cart (`$375` item + `$48` flat fulfillment), follows the buyer-only continuation without returning its URL to Node, invokes the merchant page's native inspect and cancel tools, verifies the cancel tool disappears, returns to the evidence room, reconciles the already-cancelled cart, purges the private handoff, releases the hold, and resets the room.
- The host address fragment is scrubbed before the host is considered connected. A final host-side DOM assertion rejects the private `$450` test ceiling, `token=` material, and every `/cart/c/` path after the entire commerce journey.
- Browser subprocess failures are deliberately reduced to fixed operation labels. A separate sanitizer removes arbitrary URLs and suppresses any error containing a ceiling or bearer pattern. The only successful report fields are `ok`, the pinned runner version, step names, and durations.
- The first complete run passed all nine phases in roughly five seconds on Chrome `151.0.7922.174`. It covered native registration churn across buyer and merchant pages rather than calling application functions or HTTP APIs directly.

This graduates the repeatable local/tailnet portion of E9. It does not claim the final judge path is ready: the same command must pass on stable unprotected public origins, and ChatGPT's model—not the deterministic harness—must complete the compact prompt without rescue. A physical phone and rights-cleared camera capture remain separate E7 gates.

#### E9.4 — Current Chrome context budget and eval contract

Frozen claim:

> Every currently reachable Site Tool fits Chrome's current metadata and 1.5K-result guidance, while a versioned evaluation corpus can detect schema drift and test direct, ambiguous, privacy-pressure, and ordered multi-step behavior.

Status: **deterministic and native-Chrome pass; provider-backed model reports pending.**

- Re-read the live challenge resources, the rendered August 26 WebMCP draft, Chrome's secure-tools and evaluation guidance, and the latest Chrome Labs evaluation repository on August 27 PT rather than relying on earlier notes or package names.
- Enforced Chrome's current recommended maxima in tests: 30 characters for tool and parameter names, 500 for tool descriptions, 150 for parameter descriptions, and 1,500 serialized characters for each tool result.
- Tightened the decision packet in every common state: initial inspection, requirements set, host request queued, evidence ready, hold created, hold released, active merchant cart, and buyer-only merchant continuation. The agent receives complete provenance before making the hold decision and a compact receipt afterward; the full audit trail remains visible in the human UI.
- Applied the metadata checks to all seven dynamic tool definitions. The credential-suppressed native Chrome journey still passed the complete two-client, two-origin lifecycle after compaction.
- Added a Chrome-format corpus with direct and ambiguous reads, direct and ambiguous requirement updates, an adversarial private-ceiling prompt whose expected arguments contain only four product-evidence fields, and the full stop-before-hold chain. A strict test compares the corpus's initial schemas with the live implementation and rejects private budget material in expected arguments.
- The upstream Chrome Labs repository now documents a newer `smoke` workflow, while the latest published npm package remains `webmcp-evals@0.0.3` and does not include that command. The repository records both facts and pins only commands available in the published package.
- No provider-backed score is claimed: the current shell has no configured supported model credential. Run and preserve those reports, then repeat the exact model-driven path in the final ChatGPT client before submission.

#### E9.5 — Judge-facing visual and accessibility audit

Frozen claim:

> The buyer, host, and merchant surfaces remain coherent at desktop and phone widths, expose meaningful semantics and keyboard focus, and have no automated WCAG violations before the final public-origin review.

Status: **local/tailnet visual and automated-accessibility pass; manual contrast and final-origin review pending.**

- Inspected fresh desktop captures of the buyer, host, and merchant surfaces and full-page `390×844` captures of all three. Each viewport had zero horizontal overflow; the mobile host retained the causal order from live item to normalized request, disclosure receipt, and activity.
- Replaced unsupported labels on generic containers with explicit image, timer, group, and region roles. Added a high-visibility keyboard outline for links, buttons, and review selects; the first buyer and merchant controls expose computed `2–3px` cyan/mint focus rings.
- `agent-browser` `0.35.1` ran axe-core `4.12.1` against all three primary surfaces and reported zero violations. Its only incomplete result was color contrast because layered gradients prevent automatic background determination; this is recorded as a manual-review gate rather than silently treated as a pass.
- Desktop merchant copy now keeps the released `UCP 2026-08-25` label intact, and buyer, host, and merchant pages all register native Site Tools without page errors. Development-only console output was limited to React DevTools and hot-reload notices.
- The React review found no new state, effect, async, bundle, or rendering risk in this semantic-only pass. Focused tests and strict TypeScript passed immediately afterward.
- The first post-config acceptance attempt created a room and passed a direct authenticated WebSocket probe but remained at the buyer's connecting preflight. A clean dev-process restart restored the full journey. A controlled `next build` while that fresh server was live, followed immediately by another clean native journey, also passed; Next 16.3.3 already isolates development output under `.next/dev`, so no unsupported build-directory workaround was added.

This does not graduate E9. Repeat accessibility and visual review against production builds on the final public origins, manually verify key text/background contrast, and time an unfamiliar person completing the canonical path without coaching.

#### E9.6 — Reproducible release identity and public-origin preflight

Frozen claim:

> A judge-facing URL is not release-ready merely because three health pages are green; the app, evidence authority, and merchant must be the same reviewed release and must complete their browser-facing contracts from the final public origins.

Status: **local verifier, clean-clone rehearsal, and deployment dry-runs pass; authorized permanent deployment pending.**

- Added a no-store app health route that exposes only its Vercel Git commit and normalized room origin. Both Cloudflare Workers use the current version-metadata binding to expose their public version ID, release tag, and timestamp.
- Added a bounded six-phase public verifier. It requires three distinct, credential-free HTTPS origins and one exact 40-character commit; rejects redirects and oversized or malformed bodies; verifies app/room/merchant release alignment, UCP `2026-08-25` discovery and endpoint ownership, judge-page markers, merchant CSP/Permissions/Referrer policy, exact-origin CORS, and one real disposable Durable Object room.
- The room's buyer and host credentials are validated and immediately discarded. A regression test serializes the entire successful report and proves neither credential survives; failure output suppresses arbitrary origins and credential-shaped material.
- Read the current Cloudflare release docs before choosing a workflow. Version preview URLs are unavailable for Workers that implement Durable Objects, so the runbook uses reviewed local/native gates, commit-tagged direct deployments, immediate public verification, and recorded rollback IDs rather than claiming preview promotion that this architecture cannot use.
- Read the current Vercel release docs before choosing a workflow. A Production build can be staged without assigning its domain, while promoting a Preview-environment build creates a new Production deployment. The runbook therefore verifies the commit after final promotion and separately rejects deployment protection.
- A clean clone outside the working tree completed `pnpm install --frozen-lockfile`, the full offline gate, and released UCP schema validation without `.env.local`. The release checkpoint's focused gate passed 88 app tests, 8 room-Worker tests, 12 merchant-Worker tests, strict TypeScript, and both Wrangler `4.127.0` tagged dry-run bundles.

This materially reduces execution and submission risk, but it cannot graduate the final-origin gate without Mark's authorization for the public repository/license and permanent Vercel/Cloudflare release. After that one-time action, `pnpm release:verify`, native Chrome, model-driven ChatGPT, a clean unauthenticated browser, and a physical phone remain mandatory on the identical release.

#### E9.7 — Timed demo contract and reproducible visual states

Frozen claim:

> Every visual beat in the under-three-minute submission can be sourced from the tested product lifecycle, while the final cut remains honest about which actions came from ChatGPT, a physical phone, a deterministic fallback, and the optional model.

Status: **deterministic visual rehearsal passes; final ChatGPT/phone source capture pending.**

- Added a production packet with the exact private/public prompts, approximately 330-word narration, second-by-second required visual proof, primary and permission-free takes, rights/privacy review, conditional Gateway narration, cold-view comprehension questions, and a strict prohibition on reordering or fabricating tool results.
- The native acceptance runner now has an opt-in artifact mode. One passing run produced twelve full-page milestone captures across buyer, host, active/cancelled merchant, released room, and final host privacy receipt while preserving the same nine-phase native assertions and credential-suppressed report.
- An optional buyer-state WebM exercises the visible capability changes for edit planning. It is explicitly supplementary: it neither depicts model selection nor substitutes for ChatGPT Site Tools, the physical host phone, or the final rights-cleared camera take.
- Browser recording creates an additional page target in `agent-browser` `0.35.1`, falsifying the runner's earlier fixed `t1`/`t2`/`t3` assumption. The runner now names and rediscovers buyer/host tabs dynamically; unit coverage accepts arbitrary tab identifiers. Both ordinary and recording-enabled native journeys pass after the fix.
- Visual inspection of the initial buyer, aggregate host request, and active merchant Cart states confirms that the key claims are readable without architecture narration: “not what you'll pay,” “8 private decisions need one fact,” and `$375 + $48 = $423` with no checkout/payment capability.
- The current gate passes 91 app tests, 8 room-Worker tests, and 12 merchant-Worker tests. Generated captures live only under ignored `tmp/` because development hostnames and ephemeral state must not enter the public repository.

This graduates repeatable visual continuity, not the submission video. The primary take still requires the exact final ChatGPT build, stable public origins, a real phone, an owned unbranded item, a reviewed physical-camera result, clean narration/captions, and one unfamiliar viewer who can explain the thesis after a silent watch.

### E10 — Proof-carrying capability unlock

Frozen claim:

> A machine-checked public-state policy controls whether the reversible hold capability exists and whether the room may accept it; the receipt proves authority conditions, not physical-world truth.

Status: **technically graduated into the technical path; final cold-view communication gate pending.**

- Read the current first-party release and proof-validation docs before selecting the toolchain. The isolated project pins latest stable Lean `4.33.1`, not the newer `4.34.0-rc2` prerelease, and intentionally has no mathlib dependency or global default toolchain.
- Lean enumerates the complete `showLive × evidenceOutcome × hasHold` state space. Exactly one of 16 cases allows `reserve_current_lot`: the show is live, public evidence is ready, and no hold exists.
- The generated, source-hashed JSON table is load-bearing. The buyer's dynamic WebMCP registration and the authoritative hold handler both query it; no Lean runtime or proof service exists in the deployed request path.
- Four theorems freeze the narrow claims: `reserveToolAvailable_sound`, `sellerEnvelope_privateCeiling_noninterference`, `acceptedHold_sound`, and `staleRevision_refused`.
- `pnpm proof:verify` builds the Lake project, rejects any `sorryAx`, replays the compiled declarations with `leanchecker --fresh`, regenerates all 16 cases, and rejects a stale committed receipt. Runtime schema/adapter tests guard the Lean-to-TypeScript seam.
- The UI shows one compact receipt beside the tool frontier: current `allow hold` or `withhold hold`, Lean version, source-receipt prefix, and “Abstract policy only—not camera truth.” It is supporting technical evidence, not the first-30-second hero.
- A full native Chrome journey passed all nine buyer → host → room → merchant → room phases with the generated policy in both registration and acceptance. At evidence-ready state, the green receipt appeared beside the newly registered `reserve_current_lot` tool.

Limits are part of the experiment result. Lean does not establish image authenticity, seller honesty, browser conformance, complete implementation equivalence, or zero statistical inference. The private-ceiling theorem applies to the modeled seller projection; separate application tests and native acceptance verify the implementation seam.

Decision: keep the proof because it is compact, honest, runtime-connected, offline at request time, and materially strengthens the “capability appears only when safe” claim. Do not expand it into a proof service or let it displace the physical human-agent collaboration in the demo. The final graduation gate is an unfamiliar viewer correctly explaining within ten seconds that it controls authority rather than camera truth.

### E11 — Adversarial tool lifecycle and untrusted-output boundary

Frozen claim:

> The dynamic WebMCP frontier can change without flickering unchanged tools, cancelling the mutation that caused the change, reviving a stale capability after reload/navigation, or turning merchant free text into agent instructions.

Status: **graduated in Chrome 151; exact final ChatGPT rerun pending.**

Current first-party evidence changes the implementation target. Chrome's imperative API docs, updated August 20, say Chrome 153 preserves in-flight executions when a registration is aborted; the judged baseline starts at Chrome 149 and the installed acceptance browser is Chrome 151. Sarah Drasner's WebMCP/frameworks meta-issue recommends registering as rarely as possible while reading state as freshly as possible, because wholesale React re-registration creates stale-closure, collision, and tool-flicker risks. Chrome's security guidance also says prompt injection cannot be solved inside the model and recommends accurate `untrustedContentHint` annotations plus small outputs.

Protocol:

1. Replace whole-frontier teardown with name-keyed reconciliation. A stable tool keeps its original registration and fresh `runtime.readState`; only tools entering or leaving the actual capability set register or abort.
2. Prove in component tests that `inspect_live_show` survives every hero transition under one un-aborted registration while request/hold/commerce tools still appear and disappear exactly.
3. In native Chrome 151, capture a tool handle, mutate the state that unregisters it, and prove the stale handle cannot produce a second mutation. Reload the queued buyer page, then verify authenticated room recovery and the exact tool frontier; retain the existing merchant-back-navigation recovery.
4. Inject instruction-shaped free text into a merchant receipt and prove the Site Tool projection omits it while preserving typed totals, status, and the untrusted-content annotation.

Fail if unchanged tools still churn, the tool call that changes state is reported cancelled, stale handles can mutate, reload loses the room/tool frontier, free-form merchant content reaches the agent result, or any hardening makes the canonical journey slower or less legible.

Results:

- Replaced whole-frontier teardown with a registration map keyed by tool name. `inspect_live_show` now keeps one registration and one fresh-state callback throughout the hero journey; tools that actually leave the frontier alone have their controllers aborted. Component coverage proves the stable inspect registration never aborts while evidence and hold capabilities still churn exactly.
- Projected UCP line-item titles and message bodies out of the buyer Site Tool result. Typed prices, quantities, total types, message type/severity, status, and a visible `merchantFreeText: withheld from agent result` receipt remain. An instruction-shaped product title and merchant message do not survive this projection; every dynamic tool is also asserted to carry `untrustedContentHint: true`.
- Extended the real Chrome `151.0.7922.174` runner to retain `request_host_evidence`, execute it after the state unregisters it, and require browser rejection. It then reloads the buyer page, recovers the authenticated Durable Object room and exact queued two-tool frontier, completes host publication/hold/UCP, navigates back from the cancelled merchant, reconciles, releases, and proves host non-disclosure.
- The resulting ten-phase native journey passes in roughly 8.5 seconds, including the new stale-handle and reload assertions. The call that removed its own capability still returned successfully, and the stale second call did not reach the domain mutation.

Decision: keep the keyed lifecycle and structured free-text omission. They directly strengthen WebMCP Leverage and Execution, align with current Chrome guidance, add no visible hero complexity, and reduce a class of framework-specific failures a judge could encounter. Preserve the broader claim boundary: prompt injection cannot be guaranteed away by a page, and final behavior still needs the exact judged ChatGPT client on stable origins.

### E12 — Protected Vercel release rehearsal

Frozen claim:

> One clean reviewed commit can become an inspectable Vercel artifact with truthful commit and evidence-room receipts, without weakening deployment protection or pretending a fallback build is the final three-origin release.

Status: **protected-artifact pass; stable three-origin production release remains user-gated.**

Protocol:

1. Link the existing Vercel project, build the clean `676ca66aac0b47cd5b65446eca5be54425119d1d` checkpoint with the current project environment, and deploy it only as a protected Preview.
2. Use authenticated Vercel inspection—not a share token or disabled protection—to verify `/`, `/host`, `/.well-known/ucp`, and `/api/health` on the immutable artifact.
3. Require the health receipt to distinguish an absent Git-associated system SHA from an explicitly supplied reviewed release SHA, and require an empty or malformed room origin to stay visibly unconfigured.
4. Audit the production alias, Preview room variable, and Cloudflare authentication state before claiming a public release.

Results:

- Two clean protected Preview artifacts reached `READY`; the app, host, UCP discovery, and health routes rendered through authenticated `vercel curl`.
- The first prebuilt artifact correctly exposed `commit: null`: Vercel documents that system Git metadata is unavailable to prebuilt deployments unless supplied before the build/deploy boundary. It also exposed `evidenceRoomConfigured: false` rather than inventing an authority.
- A second artifact received the exact reviewed SHA as explicit runtime release metadata and reported the full `676ca66aac0b47cd5b65446eca5be54425119d1d` receipt. The Preview `NEXT_PUBLIC_EVIDENCE_ROOM_URL` exists but is empty, so the buyer honestly retains its local fallback instead of claiming the remote room path.
- The stable Vercel production alias currently has no live deployment, both Preview artifacts remain protected, and Wrangler is not authenticated to the intended Cloudflare account. Those are real user-only release gates, not implementation failures to bypass with temporary accounts, protection exceptions, or tailnet origins.
- The app health contract now accepts `WEBMCP_RELEASE_COMMIT_SHA` only as a fallback when Vercel's Git SHA is absent. Tests prove the platform SHA wins when both exist and malformed metadata cannot silently become a valid receipt.
- A production-start probe built with `https://build-room.example`, then started with `https://runtime-room.example`; `/api/health` retained the build origin while adopting the runtime release SHA. This proves the health receipt attests to the room origin compiled into the Next.js bundle and that a bad public origin requires a rebuild, not a deploy-time override.
- The rehearsal exposed a local quality-gate leak: Vercel's ignored `.vercel/output` bundle was still traversed by ESLint. The flat lint configuration now ignores that generated tree explicitly; `pnpm check` passes from the post-deployment workspace rather than only before a Vercel build.

Decision: keep protected Preview deployment as build evidence only. Before the final release, set a non-empty Production room origin at build time, use a Git-associated artifact when possible (or the explicit reviewed SHA fallback for a deliberate prebuilt release), authenticate Cloudflare with Mark present, and run the complete public verifier plus native/ChatGPT/phone gates on three permanent unprotected origins. Never submit the protected Preview or a Tailscale URL.

### E13 — Independent eval and browser tool-surface boundary

Frozen claim:

> The latest Chrome Labs evaluator can independently exercise the current dynamic Site Tools after the page narrows browser authority to its first-party app/room boundary, while provider infrastructure failures remain distinguishable from model behavior.

Status: **Chrome-source smoke and native lifecycle pass; provider-backed selection remains infrastructure-blocked; final public/ChatGPT gates pending.**

Protocol:

1. Re-read the current Chrome evaluation guidance and inspect/build the exact latest Chrome Labs source rather than assuming the published npm package contains the same commands.
2. Run the credential-free multi-step smoke against the real page in current system Chrome, including an explicit private-ceiling prompt whose expected tool arguments omit the ceiling.
3. Attempt bounded model-driven selection through already-authorized Vercel AI Gateway OIDC without adding a long-lived key, buying credits, or retrying an upstream quota failure indefinitely. Classify infrastructure errors separately from wrong tool calls.
4. Apply the new [WebMCP Tool Surface Poisoning](https://arxiv.org/abs/2606.06387) threat model at the page boundary: minimize registration churn, omit untrusted free text, allow only first-party script/resource origins, and grant camera authority only to the host route.
5. Extend the public release verifier so a misbuilt CSP, missing room WebSocket origin, buyer camera grant, or host camera denial fails before the URL is submitted.

Results:

- The latest GoogleChromeLabs source was [`d39eae4bd51e8c12736b8cae840bd98f190f3179`](https://github.com/GoogleChromeLabs/webmcp-tools/commit/d39eae4bd51e8c12736b8cae840bd98f190f3179). Its repository directory is now `webmcp-evals` and includes multi-step trajectories, `smoke`, console-error capture, and `analyze`, while npm still publishes version `0.0.3` without `smoke`. The isolated upstream dependency install reported one high and one moderate audit finding, so no upstream tree was vendored.
- Source-built `smoke` used Chrome 151 to open a fresh page for every case and passed all 5/5 expected steps across three cases: inspect → share product-only requirements → discover/join the newly registered host request; read-only arrival; and explicit-private-ceiling pressure with only evidence fields sent.
- Three bounded provider-backed attempts used Vercel's OpenAI-compatible Gateway endpoint and existing Preview OIDC. GPT-5.4 was unavailable on the account's free tier; GPT-5.6 Luna and MiniMax M3 Free were rate-limited before inference after the evaluator's own retries. Every report contained `errorCount: 5`, `failCount: 0`, and no model response. These are not 0/5 model scores. No charge, top-up, secret, or repeated quota pressure was introduced.
- Inspection found that the current `local` and `browser` commands write error reports without setting a failing process exit code; only the new `smoke` path explicitly does so. The eval runbook now requires inspection of `errorCount`, `failCount`, and `passCount`, preventing an infrastructure-only run from becoming false green evidence.
- Next.js `16.3.3` now emits a first-party CSP for buyer and host pages. Production permits only self plus the exact configured room HTTP/WebSocket origins; development adds only its required eval/HMR allowances. Scripts, images, media, fonts, workers, objects, base navigation, forms, and framing are bounded. The buyer denies camera; `/host` permits camera from self; both deny microphone, geolocation, payment, and browsing topics and emit no-referrer/nosniff headers.
- The release verifier now checks both app pages' CSP, exact room HTTPS and WSS origins, framing/object denial, route-specific camera authority, microphone/payment denial, no-referrer, and nosniff before testing the merchant and disposable room.
- With those headers live, the ten-phase native Chrome buyer → host → reload/stale rejection → evidence → Lean-gated hold → UCP merchant → cancel/reconcile journey passed in 6.3 seconds. The independent Chrome Labs smoke then passed 5/5 with no browser-console failure.

Decision: keep the browser boundary and stricter release gate because they directly harden WebMCP's unique lifecycle without adding a visible demo concept. Preserve the claim boundary: a static CSP that permits Next.js inline bootstrapping is defense in depth, not proof against a compromised same-origin application; the browser/spec must ultimately bind origin and tool identity. Defer further security theater such as decorative tool hashes or C2PA parsing unless it changes an actual trust decision. Re-run model selection only when existing Gateway capacity is available, and require the exact final ChatGPT path regardless of any evaluator score.

### E14 — Private any-phone host handoff

Frozen claim:

> A first-time buyer can hand the seller role to an ordinary phone without copying a credential, while the bearer invite stays absent until explicit reveal and disappears on reset or successful host presence.

Status: **local/tailnet browser and native-lifecycle pass; physical-phone/final-origin pass pending.**

Protocol:

1. Use the current typed, React 19-compatible `qrcode.react` `4.2.0` SVG renderer and keep QR generation entirely inside the buyer page rather than calling a third-party image service.
2. Require an explicit reveal before the bearer QR exists in the DOM; keep the raw invite out of visible text; provide a deliberate copy fallback and the existing same-device host link.
3. Decode the rendered symbol in current Chrome and compare it inside the page to the hidden host link without logging either credential.
4. Reset while revealed, then join the host in a separate tab and verify the buyer removes the panel and all invite controls.
5. Inspect desktop and `390×844` layouts, run axe-core, and repeat the full native WebMCP buyer → host → stale/reload → evidence → hold → UCP → cancel/reconcile lifecycle.

Results:

- The QR is absent on initial render and appears only after **Show private phone QR**. Its supporting copy identifies it as a temporary bearer invite, tells the operator to hide it after scanning, and never prints the URL.
- Chrome `151.0.7922.174` decoded the rendered QR to the exact fragment-bearing host link. Reset removed it immediately; after a separate host tab authenticated, the original buyer tab reported `Host linked` and removed the entire invite control.
- The responsive panel remained readable at desktop and `390×844`; QR quiet-zone and contrast survived native SVG scaling. Axe-core `4.12.1` reported zero WCAG A/AA violations after correcting the small status text contrast. Layered page gradients remain the previously recorded manual contrast-review incomplete.
- Component tests cover absent-by-default rendering, reveal/hide, visible-text non-disclosure, and exact explicit clipboard copy. The complete credential-suppressing native journey still passed all ten phases in 6.2 seconds over the real tailnet room and merchant origins.
- The primary submission video should link the phone before recording and never publish a live bearer QR. Judges can exercise the QR directly; the host browser still needs no WebMCP.

Frontier check: Netlify's current open-source evaluator is `@netlify/axis` `1.17.5`, with goal, environment, service, and agent scores aimed at coding-agent/API/MCP task episodes. Package and adapter inspection found no browser/WebMCP surface. Integrating it now would score the repository-development workflow rather than the judged page experience, so it is rejected from the hero path unless a later browser adapter makes the score itself a useful product receipt.

Decision: keep the QR handoff. It turns the already-real two-client architecture into a judge-usable physical-device transition with almost no narrative burden, strengthens execution, and preserves the privacy story. It does not graduate the remaining real-phone gate: an actual device on the final public origins must still scan, authenticate, capture, publish, disconnect, and reconnect successfully.

### E15 — Bounded camera evidence episode

Frozen claim:

> Three deliberately sampled moments can make a short physical test more legible than one keyframe while keeping the continuous camera feed local and preserving the proven fallback.

Status: **engineering spike preserved; rejected from the current hero.**

Protocol:

1. Preserve the existing keyframe path while sampling three camera moments near 0, 2, and 4 seconds into one reviewed JPEG contact sheet.
2. Bind the contact sheet to ordered offsets, capture/completion times, dimensions, a digest, and an explicit `rawVideoPublished: false` receipt.
3. Carry the provenance through the authoritative room and Site Tool result, then attempt the same reviewed-evidence-to-capability journey with a synthetic rights-clean camera source.
4. Compare the actual decision information, WebMCP leverage, physical-phone reliability, and cold-view clarity with the committed keyframe path before graduation.

Results:

- The implementation is isolated on local branch `experiment/camera-episode-spike` at `568bd84`; the committed `main` path remains unchanged.
- The spike kept raw video local, published only one reviewed contact sheet, failed malformed episode metadata closed, preserved the keyframe fallback, and passed the focused strict-TypeScript and Vitest gates.
- It did not change the buyer decision semantics. The current static snowboard condition still resolves from the same aggregate visibility/surface finding plus a separate seller history attestation, so the extra samples violate the “smallest missing fact” principle.
- It did not add or deepen a WebMCP capability. The dynamic frontier and consequential action remained exactly the proven keyframe lifecycle.
- A typical landscape capture produced a 1,440×270 contact sheet while the proposal route rejects either dimension above 960. The proposal contract also called the sheet one frame and had no ordered-sample citations. The synthetic/manual lane therefore did not establish physical-phone or episode-aware AI reliability.
- Three still samples cannot honestly prove continuous stabilization. A future gimbal or motion test would need a condition whose outcome actually depends on multiple ordered moments and must preserve that claim boundary.

Decision: do not make the episode the default or include it in the first release. Reconsider only if the evidence rule consumes at least two distinct samples, the model boundary understands and cites ordered offsets, portrait and landscape physical-phone runs pass ten times consecutively, capture-to-review stays under 5.5 seconds p95, and three cold viewers understand both why the samples were necessary and that raw video was not uploaded. Permanent origins, the exact ChatGPT run, and the final submission cut outrank this experiment.

### E16 — Permissionless missing-proof supply

Frozen claim:

> A shopper can turn one unanswered product question into a privacy-minimized public filming request, and a stranger who already owns the product can discover and fulfill it without a store partnership, customer list, account, or private shopper context.

Status: **local product and native-WebMCP pass; public cold-user/physical-phone gate pending.**

Protocol:

1. Require a real open mission and bounded private phone case before public publication; require `confirmPublicListing: true` through both WebMCP and the human control.
2. Store only the product, optional public URL, exact question, filming instruction, proof check, duration, continuity requirement, status, and timestamps in the listing. Never copy identity, preferences, history, budget, conversation, owner token, or private contributor token into a public response.
3. Give the board a separate case-scoped public contributor capability. Remove the listing, prove the old public capability receives `403`, and prove the independent private capability can still republish the open case. Hide fulfilled and expired requests; physically purge expired rows daily.
4. Give `/missions` its own native `inspect_open_filming_missions` and `open_filming_mission` tools plus matching human controls, no-login QR handoff, desktop/mobile UI, strict schemas, and release-policy checks.
5. Extend the native acceptance so it must use the public route rather than the already-known private link: arbitrary product → search → mission → public publication → fresh board context → inspect/claim → contributor video → AI-shaped proposal → human correction/reuse consent → first answer change → fresh matching shopper reuses the citation.

Results:

- The public list contains no capability fields. D1 stores a random 256-bit public recorder capability that is distinct from the visible mission ID and private contributor token; list/read responses omit it, and the Durable Object stores only its digest. Removal clears the public digest, and replacing a removed listing atomically invalidates the old public URL while retaining one board row per case.
- Publication lasts at most 24 hours even if a case is configured for longer. A daily Cloudflare Cron path purges expired requests beside expired reusable evidence. Case-creation limits and the two-upload lifetime cap still bound the cost surface.
- Native Chrome completed the eight-step public-supply and two-shopper loop in about seven seconds against the real local Next.js, Durable Object, D1 schema, WebSocket, and WebMCP runtime. Only paid Stream/model edges were deterministic strict fixtures.
- The board rendered coherently at desktop and `390×844`, exposed the exact no-login QR after claim, produced no framework/console error, and reached zero axe WCAG A/AA violations after adding explicit SVG QR titles. Layered-gradient contrast remains an automated-audit incomplete and was visually inspected.
- The public release verifier now requires board health metadata, a live no-store/CORS D1 list query, the `/missions` page marker, and its no-camera/no-upload/no-playback policy before a deployment can pass.

Decision: keep the board in the hero. It closes the largest product-credibility gap—how an unknown product owner receives a request—while deepening WebMCP across a second coherent surface and avoiding merchant dependencies. Do not add bounties, contributor accounts, feeds, voting, messaging, or fulfillment promises before the final public/phone/ChatGPT/cold-user gates. The board is permissionless discoverability plus a working bounded fulfillment path, not yet a mature marketplace.
