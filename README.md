# Film the Gap

Film the Gap is an open product-evidence network with native WebMCP Site Tools for one simple idea: **when a shopper asks a question that product pages and reviews cannot prove, ChatGPT can find existing evidence or ask someone with the product to film the missing proof—then use that reviewed, timestamped video to improve its answer.**

Instead of stopping at product search or summarizing the claims already online, Film the Gap creates the exact piece of evidence the web is missing and makes it reusable.

The public demo needs no merchant or borrowed catalog. It includes an owned, same-origin `/demo-product` page for an unbranded bottle. Before evidence exists, that page's own Site Tools distinguish its “leak resistant” claim from the unproven ten-second test and open an exact, privacy-bounded evidence case. After a contributor publishes reviewed video, the same page reads the durable evidence index, replaces its missing-proof action with the cited result, and replaces its handoff tool with reviewed-evidence inspection. The page visibly learns a verifiable fact without its author rewriting the claim.

The shopper, public-request board, and phone recorder are ordinary web pages. WebMCP lets ChatGPT understand and operate the same state-dependent actions a person sees, while the contributor records and reviews evidence in any normal mobile browser.

## The complete loop

1. A product page, shopper, or agent opens one concrete product question. A participating page can expose the exact claim boundary and hand it to the network through WebMCP; the generic form accepts products the app has never seen.
2. The app first searches its rights-cleared evidence network for the same product and question. An exact reviewed answer returns immediately without recrawling public sources. Otherwise, for a supplied product URL, a bounded Cloudflare Browser Run action extracts readable page text and origin Content Signals; the copy remains an untrusted, link-only lead and is discarded when the origin forbids search or AI input. The app also searches public social video through ScrapeCreators and the broader web through Exa on Vercel AI Gateway—while keeping links, rights, and evidence strength distinct.
3. It shows what is already supported, contradicted, or still unproven—down to claim-level sources and timestamps.
4. If decisive proof is missing, a narrow WebMCP Site Tool creates a filming mission with one observable instruction and success criterion.
5. The shopper can keep that mission private or explicitly publish only the product, question, and filming recipe to a 24-hour open request board. The board receives no shopper identity, preferences, history, budget, or ChatGPT conversation.
6. Anyone with access to the product can open the board request on a phone—no store partnership, customer list, account, or app—record one continuous video, and upload it directly to Cloudflare Stream. Each mission also issues a random phrase that can be spoken or shown in frame to bound a fresh recording to after the request was created. Existing authorized clips remain useful but are labeled preexisting. Removing a listing revokes its public recorder capability without breaking the separate private link.
7. Once Stream produces an authorized MP4, Vercel AI Gateway sends it to a video-capable model for a bounded, timestamped proposal and separately checks for the exact mission phrase. The contributor must review or correct the result, confidence, continuity, observation, and cited interval; choose their publishing rights; and explicitly confirm the complete review before the server accepts it. Their public relationship label is self-described and defaults to “Anonymous contributor.” Only the server-side model receipt can upgrade timing from contributor-attested to mission-challenge verified.
8. The contributor chooses whether the reviewed clip is case-only or reusable for matching product questions for up to 30 days. Only a conclusive, medium-or-high-confidence continuous recording can enter the reusable index.
9. The first shopper's answer changes live. The original product page and later matching shoppers now receive the reviewed recording and timestamp immediately instead of creating another filming mission.

This is not a text-review demo and it does not claim that video is impossible to fake. Its useful boundary is narrower: answers cite the contributor-authorized recording, distinguish public leads from reusable media, preserve whether a clip is imported, contributor-attested, or mission-challenge verified, require human review, expose limitations, and abstain when a recording does not prove the claim. A detected mission phrase bounds capture timing; it does not prove identity, ownership, product authenticity, or ground truth.

## Why WebMCP is load-bearing

WebMCP exposes the product's real, state-dependent actions to a browser agent without hiding a parallel API behind the demo. On the product page, the agent can inspect the authored claim boundary and either open the exact missing-proof case or, after publication, inspect reviewed evidence. On the shopper page, it can search permitted sources, create one missing-proof mission, create its private phone case, explicitly publish or remove its public request, and consume the newly published result. On the open board, it can inspect current requests and open one exact bounded recorder. Human controls mirror the same contracts. Mutating tools are narrow, confirmation-gated where public disclosure is involved, cancellable where applicable, and protected against stale state.

The demo's before/after is therefore causal and inspectable:

```text
Product-page claim → WebMCP evidence case → exact gap → public filming mission
                   → person with product → reviewed video → better answer
                   → the product page gains a reusable cited fact
```

## Load-bearing stack

| Product                    | What it does here                                                                            | Why it belongs                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| OpenAI WebMCP              | Gives ChatGPT or another compatible browser agent contextual Site Tools                      | It is the collaboration surface, not a decorative integration                           |
| Cloudflare Durable Objects | Owns revisioned cases, role-scoped credentials, missions, uploads, and reviewed evidence     | One authoritative room coordinates shopper and contributor devices safely               |
| Cloudflare Stream          | Accepts direct creator uploads and generates the exact MP4 used for analysis                 | The app server never needs to proxy a phone recording                                   |
| Cloudflare D1              | Stores open filming requests and indexes opted-in, decision-grade recordings for exact reuse | Strangers can find missing-proof work; one recording can answer later matching shoppers |
| Cloudflare Cron Triggers   | Deletes expired public requests and reusable evidence metadata every day                     | The 24-hour request and 30-day reuse boundaries are enforced in storage                 |
| Cloudflare Browser Run     | Reads one supplied product page as bounded Markdown with origin and usage receipts           | Dynamic PDP copy becomes inspectable context without being promoted to proof            |
| Vercel AI Gateway          | Routes the authorized MP4 to a current video model and runs one bounded Exa web-search tool  | Model/search selection, budgets, receipts, and failure handling stay explicit           |
| Vercel AI SDK 7            | Sends the video and enforces a typed structured evidence proposal                            | The model cannot publish free-form prose directly into the evidence graph               |
| Next.js 16 on Vercel       | Serves the shopper, open-request board, and contributor experience                           | It keeps all three no-login surfaces fast and familiar                                  |
| Vercel Runtime Cache       | Reuses successful public search receipts for 15 minutes per region                           | Repeat judge/agent queries avoid duplicate provider calls                               |
| ScrapeCreators, optional   | Finds link-only TikTok, Instagram Reels, and YouTube leads                                   | Public discovery broadens coverage without pretending discovery grants reuse rights     |

The continuous-video path currently targets `google/gemini-3.7-flash` through AI Gateway, with `google/gemini-3.6-flash` as fallback. No live model or Stream request runs in the default test suite.

The shopper WebMCP implementation is in [site-tools.ts](src/lib/evidence-network/site-tools.ts); the product-page bridge is in [demo-product-evidence-bridge.tsx](src/components/demo-product-evidence-bridge.tsx); both use dynamic registration from [use-dynamic-site-tools.ts](src/lib/webmcp/use-dynamic-site-tools.ts). Independent browser-evaluation cases are documented in [evals/README.md](evals/README.md).

## Challenge-period provenance

This repository was created entirely during the OpenAI WebMCP Challenge submission period. Its first commit is `be76c558a8a53c4d7e2f318961fd1dc7460980e7`, dated August 26, 2026 at 6:28 a.m. PT—after the submission period opened on August 25, 2026 at 11:00 a.m. PT.

## Run locally

Requirements: Node.js 24 or newer and pnpm 11.24.0.

```bash
pnpm install --frozen-lockfile
pnpm --dir room-worker d1:migrate:evidence-local
pnpm room:dev
```

In a second shell:

```bash
NEXT_PUBLIC_EVIDENCE_ROOM_URL=http://localhost:8787 pnpm dev
```

Open `http://localhost:3000`. Create a product-evidence case, ask a question, open a missing-proof mission, then use either its private phone link or the optional public board at `/missions` from a second browser or device.

Local Wrangler cannot complete a real Cloudflare Stream upload unless the binding is connected to deployed infrastructure. The no-secret analysis path remains functional and truthfully starts the contributor at manual, inconclusive review. A production candidate needs the Stream binding plus this encrypted Worker secret:

```bash
pnpm --dir room-worker exec wrangler secret put AI_GATEWAY_API_KEY \
  --config wrangler.evidence.jsonc
```

That command changes Cloudflare state and must only be run deliberately by the account owner. Never expose the key through a `NEXT_PUBLIC_` variable or commit it.

Production product-page reading uses the Worker’s Browser Run binding plus one random server-to-server capability of at least 24 characters. Store the same value as the encrypted Worker secret `PAGE_READER_SHARED_SECRET` and the server-only Vercel variable `EVIDENCE_PAGE_READER_TOKEN`; it must never use a `NEXT_PUBLIC_` name. The Worker allows only public default-port HTTPS targets, blocks cross-origin redirects and unnecessary media requests, honors explicit `search=no` or `ai-input=no` Content Signals, caches Browser Run results for 24 hours, and atomically permits at most 60 reads per UTC day.

Optional social discovery uses one server-only ScrapeCreators key. On Vercel, broad-web discovery authenticates to AI Gateway through the platform's automatically refreshed OIDC token, so it needs no stored Gateway key:

```bash
SCRAPECREATORS_API_KEY=... pnpm dev
```

For local or non-Vercel development, either run through `vercel dev`/a current `vercel env pull`, or set a separate hard-budgeted `AI_GATEWAY_DISCOVERY_API_KEY`. An explicit key overrides OIDC and must never be reused from the Cloudflare video-analysis Worker. The release runbook puts a non-renewing project budget around OIDC-backed discovery.

The broad-web path uses `openai/gpt-5.4-nano` only to invoke the Gateway-native Exa `instant` search tool, verifies that the tool preserved the exact bounded query, keeps at most four results, and fails closed on a malformed receipt. Discovery results remain external leads until reviewed; the app does not download or republish public media merely because it can find it.

## Quality gates

Run the full offline gate:

```bash
pnpm check
```

It covers formatting, ESLint, strict TypeScript, app/Worker tests, the standalone Cloudflare Worker dry-run bundle, and a production Next.js build.

Useful focused commands:

```bash
pnpm test:app
pnpm test:room
pnpm typecheck
pnpm room:build
pnpm acceptance:evidence-network
pnpm acceptance:evidence-network:fallback
```

Prepare the local acceptance D1 database once, then run the four local processes. Its paid edges cannot run accidentally:

```bash
# One-time schema preparation
pnpm --dir room-worker d1:migrate:evidence-acceptance

# Shell 1: deterministic Stream + model + page-reader service
pnpm --dir room-worker dev:evidence-services

# Shell 2: real room Worker + Durable Object, bound to that service
pnpm --dir room-worker dev:evidence-acceptance

# Shell 3: app; the acceptance runner intentionally exercises both loopback aliases
ALLOWED_DEV_ORIGINS=127.0.0.1 NEXT_PUBLIC_EVIDENCE_ROOM_URL=http://localhost:8792 EVIDENCE_PAGE_READER_TOKEN=acceptance-only-page-reader-secret pnpm dev

# Shell 4: native Chrome 150+ with WebMCP
pnpm acceptance:evidence-network

# Then prove the same product works with WebMCP explicitly disabled
pnpm acceptance:evidence-network:fallback
```

The two runners generate a rights-clean 12-second MP4 and drive the same complete stranger-supply loop: arbitrary product search → bounded product-page context that remains non-decisive → claim-specific mission with a random capture phrase → explicit public-board publication → a fresh board context finds and claims it → bounded phone recorder → model-shaped proposal → human correction and reuse consent → first answer difference → fresh matching shopper reuses the same Stream citation without another mission. One run uses only native WebMCP Site Tools; the other launches Chrome with WebMCP explicitly disabled and uses only visible human controls. The synthetic clip deliberately omits the phrase, and the system preserves the honest `contributor_attested` fallback instead of inventing verification. The real Durable Object, D1 database, migrations, revocable capability boundary, and public schemas run unchanged; local services replace only Cloudflare Stream, Browser Run, and Gemini, and the browser network allowlist excludes their public hosts.

## Current status and honest boundaries

- Generic products and questions are persistent and can be created without code or database changes.
- The rights-clean `/demo-product` page is an active WebMCP participant: it opens a strict `/case` handoff before proof exists, queries the same D1 evidence index used by generic searches, and changes its visible result and Site Tool frontier after reviewed evidence arrives. Its authored claim remains explicitly non-decisive. The release verifier checks its `search=yes, ai-input=yes, ai-train=no` Content Signal, then follows the exact handoff and enforces the resulting route's restrictive browser policy.
- Claim-level evidence, provenance, capture timing, random mission phrases, rights, confidence, revisions, dynamic Site Tools, bounded product-page reading, social lead discovery, private contributor URLs, a public missing-proof board, revocable public recorder paths, direct Stream uploads, timestamped video proposals, server-enforced final human confirmation, deliberate rights selection, and rights-explicit cross-case reuse are implemented.
- Conclusive evidence for a continuous-take mission is rejected when the cited interval is invalid or continuity is edited/unknown.
- The app has deterministic automated coverage for success, denial, stale revisions, manual fallback, dependency failures, simultaneous analysis coalescing, fragment scrubbing, contributor reload, and buyer reconnect. It does not call paid services during tests.
- The standalone deployable Worker exposes only the evidence API. It rate-limits case creation, permits two upload reservations per temporary case, caps clips at 95 MiB/90 seconds, expires upload URLs, schedules Stream deletion, bounds model retries, caps Browser Run to 60 authenticated reads per UTC day, and physically purges expired board/reuse/usage D1 records daily. Public board listings last at most 24 hours, carry only public product/filming fields, and use a capability that can be revoked independently of the private link. The release runbook adds one budgeted cross-cloud Gateway key, automatic Vercel OIDC for search, and a Vercel WAF ceiling.
- Native Chrome completes arbitrary-product search → mission → public board → stranger claim → phone evidence → first answer change → fresh-case evidence reuse in roughly six seconds against real local Durable Object/D1 state and deterministic paid-service fixtures. A separate native browser check proves the product page's missing-proof tool navigates to its exact case and is replaced by reviewed-evidence inspection when evidence appears.
- Chrome with WebMCP explicitly disabled completes the same visible-control journey in roughly five seconds, proving the ordinary website is not an agent-only façade. The product-page handoff also remains a normal link.
- This candidate is not yet deployed and has not yet passed a real Browser Run product-page read or Stream → Gateway → physical-phone journey on the final origins. Those remain mandatory release gates, not inferred claims.
- It does not claim universal access to people with products, guaranteed fulfillment, independently verified contributor labels, product authenticity, or perfect deepfake detection. The board demonstrates permissionless discoverability, not a mature incentive marketplace.
- It does not place an order, charge a user, contact strangers, scrape private data, or reuse third-party media without rights.

Before submission, a fresh judge must be able to complete the whole public no-login loop in current ChatGPT's in-app browser, WebMCP-enabled Chrome, an ordinary-browser fallback, and a physical phone. The three-minute video must show the answer before the mission, the phone recording and human review, and the materially improved answer after publication.

See [SUBMISSION.md](SUBMISSION.md) for the submission packet, [DEMO.md](DEMO.md) for the capture plan, [DEPLOYMENT.md](DEPLOYMENT.md) for release and rollback, [VERIFICATION.md](VERIFICATION.md) for exact receipts and open gates, and [evals/README.md](evals/README.md) for browser-agent evaluation.
