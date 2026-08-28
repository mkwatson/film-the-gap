# Standalone product-evidence network

This repository is the challenge-period implementation workspace for a simple idea: **when a shopper asks a question that product pages and reviews cannot prove, an agent can find existing evidence or ask a real person to film the missing proof—then use that reviewed, timestamped video to improve its answer.** The heading is descriptive; the public project name is deliberately not frozen yet.

It is a standalone OpenAI WebMCP Challenge entry. It does not use Vidably branding, private code, private data, or a Vidably dependency.

## The complete loop

1. A shopper or agent adds any product URL and asks one concrete question.
2. The app first searches its rights-cleared evidence network for the same product and question. It also keeps a supplied product page as an unreviewed lead, searches public social video through ScrapeCreators, and searches the broader web through Exa on Vercel AI Gateway—while keeping links, rights, and evidence strength distinct.
3. It shows what is already supported, contradicted, or still unproven—down to claim-level sources and timestamps.
4. If decisive proof is missing, a narrow WebMCP Site Tool creates a filming mission with one observable instruction and success criterion.
5. The shopper can keep that mission private or explicitly publish only the product, question, and filming recipe to a 24-hour open request board. The board receives no shopper identity, preferences, history, budget, or ChatGPT conversation.
6. Anyone who already owns the product can open the board request on a phone—no store partnership, customer list, account, or app—record one continuous video, and upload it directly to Cloudflare Stream. Each mission also issues a random phrase that can be spoken or shown in frame to bound a fresh recording to after the request was created. Existing authorized clips remain useful but are labeled preexisting. Removing a listing revokes its public recorder capability without breaking the separate private link.
7. Once Stream produces an authorized MP4, Vercel AI Gateway sends it to a video-capable model for a bounded, timestamped proposal and separately checks for the exact mission phrase. The contributor must review or correct the result, confidence, continuity, observation, and cited interval before publishing; only the server-side model receipt can upgrade timing from contributor-attested to mission-challenge verified.
8. The contributor chooses whether the reviewed clip is case-only or reusable for matching product questions for up to 30 days. Only a conclusive, medium-or-high-confidence continuous recording can enter the reusable index.
9. The first shopper's answer changes live. When a later shopper asks the same question about the same product, the reviewed recording and timestamp resolve it immediately instead of creating another filming mission.

This is not a text-review demo and it does not claim that video is impossible to fake. Its useful boundary is narrower: answers cite the contributor-authorized recording, distinguish public leads from reusable media, preserve whether a clip is imported, contributor-attested, or mission-challenge verified, require human review, expose limitations, and abstain when a recording does not prove the claim. A detected mission phrase bounds capture timing; it does not prove identity, ownership, product authenticity, or ground truth.

## Why WebMCP is load-bearing

WebMCP exposes the product's real, state-dependent actions to a browser agent without hiding a parallel API behind the demo. On the shopper page, the agent can inspect evidence, search permitted sources, create one missing-proof mission, create its private phone case, explicitly publish or remove its public request, and consume the newly published result. On the open board, WebMCP can inspect current requests and open one exact bounded recorder. Human controls mirror the same contracts. Mutating tools are narrow, confirmation-gated where public disclosure is involved, cancellable where applicable, and protected against stale state.

The judge-facing before/after is therefore causal and inspectable:

```text
Question → evidence gap → WebMCP mission → open request board → product owner
         → real phone video → AI proposal → human review → better answer → reuse
```

## Load-bearing stack

| Product                    | What it does here                                                                            | Why it belongs                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| OpenAI WebMCP              | Gives ChatGPT or another compatible browser agent contextual Site Tools                      | It is the collaboration surface, not a decorative integration                           |
| Cloudflare Durable Objects | Owns revisioned cases, role-scoped credentials, missions, uploads, and reviewed evidence     | One authoritative room coordinates shopper and contributor devices safely               |
| Cloudflare Stream          | Accepts direct creator uploads and generates the exact MP4 used for analysis                 | The app server never needs to proxy a phone recording                                   |
| Cloudflare D1              | Stores open filming requests and indexes opted-in, decision-grade recordings for exact reuse | Strangers can find missing-proof work; one recording can answer later matching shoppers |
| Cloudflare Cron Triggers   | Deletes expired public requests and reusable evidence metadata every day                     | The 24-hour request and 30-day reuse boundaries are enforced in storage                 |
| Vercel AI Gateway          | Routes the authorized MP4 to a current video model and runs one bounded Exa web-search tool  | Model/search selection, budgets, receipts, and failure handling stay explicit           |
| Vercel AI SDK 7            | Sends the video and enforces a typed structured evidence proposal                            | The model cannot publish free-form prose directly into the evidence graph               |
| Next.js 16 on Vercel       | Serves the shopper, open-request board, agent, and contributor experience                    | It keeps all three no-login surfaces fast and familiar                                  |
| Vercel Runtime Cache       | Reuses successful public search receipts for 15 minutes per region                           | Repeat judge/agent queries avoid duplicate provider calls                               |
| ScrapeCreators, optional   | Finds link-only TikTok, Instagram Reels, and YouTube leads                                   | Public discovery broadens coverage without pretending discovery grants reuse rights     |

The continuous-video path currently targets `google/gemini-3.7-flash` through AI Gateway, with `google/gemini-3.6-flash` as fallback. Exact versions and source receipts are recorded in [EXPERIMENTS.md](EXPERIMENTS.md) and [SPONSOR-PRODUCTS.md](SPONSOR-PRODUCTS.md). No live model or Stream request runs in the default test suite.

UCP, the prior live-shopping market, and the Lean capability proof remain in Git history as independently working research rungs. Their implementation and public routes are intentionally absent from this candidate because adding checkout or a formal proof does not improve the core product-evidence story yet.

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
```

Prepare the local acceptance D1 database once, then run the four local processes. Its paid edges cannot run accidentally:

```bash
# One-time schema preparation
pnpm --dir room-worker d1:migrate:evidence-acceptance

# Shell 1: deterministic Stream + model service
pnpm --dir room-worker dev:evidence-services

# Shell 2: real room Worker + Durable Object, bound to that service
pnpm --dir room-worker dev:evidence-acceptance

# Shell 3: app
NEXT_PUBLIC_EVIDENCE_ROOM_URL=http://localhost:8792 pnpm dev

# Shell 4: native Chrome 150+ with WebMCP
pnpm acceptance:evidence-network
```

The runner generates a rights-clean 12-second MP4 and drives the complete stranger-supply loop: arbitrary product search → WebMCP mission with a random capture phrase → explicit public-board publication → a fresh board context inspects and claims it → bounded phone recorder → model-shaped proposal → human correction and reuse consent → first answer difference → fresh matching shopper reuses the same Stream citation without another mission. The synthetic clip deliberately omits the phrase, and the system preserves the honest `contributor_attested` fallback instead of inventing verification. The real Durable Object, D1 database, migrations, revocable capability boundary, and public schemas run unchanged; local services replace only Cloudflare Stream and Gemini, and the browser network allowlist excludes their public hosts.

## Current status and honest boundaries

- Generic products and questions are persistent and can be created without code or database changes.
- Claim-level evidence, provenance, capture timing, random mission phrases, rights, confidence, revisions, dynamic Site Tools, social lead discovery, private contributor URLs, a public missing-proof board, revocable public recorder paths, direct Stream uploads, timestamped video proposals, explicit human review, and rights-explicit cross-case reuse are implemented.
- Conclusive evidence for a continuous-take mission is rejected when the cited interval is invalid or continuity is edited/unknown.
- The app has deterministic automated coverage for success, denial, stale revisions, manual fallback, dependency failures, simultaneous analysis coalescing, fragment scrubbing, contributor reload, and buyer reconnect. It does not call paid services during tests.
- The standalone deployable Worker exposes only the evidence API. It rate-limits case creation, permits two upload reservations per temporary case, caps clips at 95 MiB/90 seconds, expires upload URLs, schedules Stream deletion, bounds model retries, and physically purges expired board/reuse D1 records daily. Public board listings last at most 24 hours, carry only public product/filming fields, and use a capability that can be revoked independently of the private link. The release runbook adds one budgeted cross-cloud Gateway key, automatic Vercel OIDC for search, and a Vercel WAF ceiling.
- Native Chrome completes arbitrary-product search → mission → public board → stranger claim → phone evidence → first answer change → fresh-case evidence reuse in roughly five seconds against real local Durable Object/D1 state and deterministic paid-service fixtures.
- The prior public release remains the known-good fallback. This generic branch is not yet deployed and has not yet passed a real Stream → Gateway → physical-phone journey.
- It does not claim universal access to product owners, guaranteed fulfillment, independent contributor verification, product authenticity, or perfect deepfake detection. The board demonstrates permissionless discoverability, not a mature incentive marketplace.
- It does not place an order, charge a user, contact strangers, scrape private data, or reuse third-party media without rights.

Before submission, a fresh judge must be able to complete the whole public no-login loop in current ChatGPT's in-app browser, WebMCP-enabled Chrome, an ordinary-browser fallback, and a physical phone. The three-minute video must show the answer before the mission, the phone recording and human review, and the materially improved answer after publication.

See [SUBMISSION.md](SUBMISSION.md) for the judge packet, [DEMO.md](DEMO.md) for the capture plan, [DEPLOYMENT.md](DEPLOYMENT.md) for release and rollback, [EXPERIMENTS.md](EXPERIMENTS.md) for falsification receipts, [RESOURCES.md](RESOURCES.md) for current documentation, [SPONSOR-PRODUCTS.md](SPONSOR-PRODUCTS.md) for the sponsor atlas, and [STRATEGY.md](STRATEGY.md) for the winning-probability framework.
