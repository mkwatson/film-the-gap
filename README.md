# Standalone product-evidence network

This repository is the challenge-period implementation workspace for a simple idea: **when a shopper asks a question that product pages and reviews cannot prove, an agent can find existing evidence or ask a real person to film the missing proof—then use that reviewed, timestamped video to improve its answer.** The heading is descriptive; the public project name is deliberately not frozen yet.

It is a standalone OpenAI WebMCP Challenge entry. It does not use Vidably branding, private code, private data, or a Vidably dependency.

## The complete loop

1. A shopper or agent adds any product URL and asks one concrete question.
2. The app searches product pages and public social-video sources for relevant leads, while keeping links, rights, and evidence strength distinct.
3. It shows what is already supported, contradicted, or still unproven—down to claim-level sources and timestamps.
4. If decisive proof is missing, a narrow WebMCP Site Tool creates a filming mission with one observable instruction and success criterion.
5. Any opted-in product owner can open a private phone link, record one continuous video, and upload it directly to Cloudflare Stream.
6. Once Stream produces an authorized MP4, Vercel AI Gateway sends it to a video-capable model for a bounded, timestamped proposal. The contributor must review or correct the result, confidence, continuity, observation, and cited interval before publishing.
7. The shopper or agent re-runs the question. The new evidence visibly changes what the system can responsibly say.

This is not a text-review demo and it does not claim that video is impossible to fake. Its useful boundary is narrower: answers cite the contributor-authorized recording, distinguish public leads from reusable media, require human review, expose limitations, and abstain when a recording does not prove the claim.

## Why WebMCP is load-bearing

WebMCP exposes the product's real, state-dependent actions to a browser agent without hiding a parallel API behind the demo. The agent can inspect evidence, search permitted sources, create or refine one missing-proof mission, and consume the newly published result. Human controls call the same revisioned domain transitions. Mutating tools are narrow, cancellable where applicable, and protected against stale state.

The judge-facing before/after is therefore causal and inspectable:

```text
Question → evidence gap → WebMCP mission → real phone video
         → AI proposal → human review → published evidence → better answer
```

## Load-bearing stack

| Product                    | What it does here                                                                           | Why it belongs                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| OpenAI WebMCP              | Gives ChatGPT or another compatible browser agent contextual Site Tools                     | It is the collaboration surface, not a decorative integration                       |
| Cloudflare Durable Objects | Owns revisioned cases, role-scoped credentials, missions, uploads, and reviewed evidence    | One authoritative room coordinates shopper and contributor devices safely           |
| Cloudflare Stream          | Accepts direct creator uploads and generates the exact MP4 used for analysis                | The app server never needs to proxy a phone recording                               |
| Vercel AI Gateway          | Routes the authorized MP4 to a current video model with fallback and no-training preference | Model selection, policy, and failure handling stay explicit                         |
| Vercel AI SDK 7            | Sends the video and enforces a typed structured evidence proposal                           | The model cannot publish free-form prose directly into the evidence graph           |
| Next.js 16 on Vercel       | Serves the shopper, agent, and contributor experience                                       | It keeps the public flow fast and familiar                                          |
| ScrapeCreators, optional   | Finds link-only TikTok, Instagram Reels, and YouTube leads                                  | Public discovery broadens coverage without pretending discovery grants reuse rights |

The continuous-video path currently targets `google/gemini-3.7-flash` through AI Gateway, with `google/gemini-3.6-flash` as fallback. Exact versions and source receipts are recorded in [EXPERIMENTS.md](EXPERIMENTS.md) and [SPONSOR-PRODUCTS.md](SPONSOR-PRODUCTS.md). No live model or Stream request runs in the default test suite.

UCP, the prior live-shopping market, and the Lean capability proof remain in the challenge-period history as independently working research rungs. Their public routes are intentionally absent from this candidate because adding checkout or a formal proof does not improve the core product-evidence story yet.

## Run locally

Requirements: Node.js 24 or newer and pnpm 11.24.0.

```bash
pnpm install --frozen-lockfile
pnpm room:dev
```

In a second shell:

```bash
NEXT_PUBLIC_EVIDENCE_ROOM_URL=http://localhost:8787 pnpm dev
```

Open `http://localhost:3000`. Create a product-evidence case, ask a question, open a missing-proof mission, and use its phone link from a second browser or device.

Local Wrangler cannot complete a real Cloudflare Stream upload unless the binding is connected to deployed infrastructure. The no-secret analysis path remains functional and truthfully starts the contributor at manual, inconclusive review. A production candidate needs the Stream binding plus this encrypted Worker secret:

```bash
pnpm --dir room-worker exec wrangler secret put AI_GATEWAY_API_KEY \
  --config wrangler.evidence.jsonc
```

That command changes Cloudflare state and must only be run deliberately by the account owner. Never expose the key through a `NEXT_PUBLIC_` variable or commit it.

Optional public-social discovery uses a server-only key:

```bash
SCRAPECREATORS_API_KEY=... pnpm dev
```

Discovery results remain external leads until reviewed; the app does not download or republish public media merely because it can find it.

## Quality gates

Run the full offline gate:

```bash
pnpm check
```

It covers formatting, ESLint, strict TypeScript, app/Worker tests, both Worker dry-run bundles, and a production Next.js build.

Useful focused commands:

```bash
pnpm test:app
pnpm test:room
pnpm typecheck
pnpm room:build
pnpm acceptance:evidence-network
```

The generic acceptance journey uses four local processes so its paid edges cannot run accidentally:

```bash
# Shell 1: deterministic Stream + model service
pnpm --dir room-worker dev:evidence-services

# Shell 2: real room Worker + Durable Object, bound to that service
pnpm --dir room-worker dev:evidence-acceptance

# Shell 3: app
NEXT_PUBLIC_EVIDENCE_ROOM_URL=http://localhost:8792 pnpm dev

# Shell 4: native Chrome 150+ with WebMCP
pnpm acceptance:evidence-network
```

The runner generates a rights-clean 12-second MP4, drives the complete buyer/contributor journey, corrects the model-shaped proposal, verifies the answer difference through WebMCP, and reloads both credential boundaries. The real Durable Object and public schemas run unchanged; local services replace only Cloudflare Stream and Gemini, and the browser network allowlist excludes their public hosts.

## Current status and honest boundaries

- Generic products and questions are persistent and can be created without code or database changes.
- Claim-level evidence, provenance, rights, confidence, revisions, dynamic Site Tools, social lead discovery, private contributor URLs, direct Stream uploads, timestamped video proposals, and explicit human review are implemented.
- Conclusive evidence for a continuous-take mission is rejected when the cited interval is invalid or continuity is edited/unknown.
- The app has deterministic automated coverage for success, denial, stale revisions, manual fallback, dependency failures, simultaneous analysis coalescing, fragment scrubbing, contributor reload, and buyer reconnect. It does not call paid services during tests.
- The standalone deployable Worker exposes only the evidence API. It rate-limits case creation, permits two upload reservations per temporary case, caps clips at 95 MiB/90 seconds, expires upload URLs, schedules Stream deletion, and bounds model retries. The release runbook adds a budgeted Gateway key and Vercel WAF ceiling.
- Native Chrome completes the five-phase generic acceptance journey in roughly five seconds against a real local Durable Object and deterministic paid-service fixtures.
- The prior public release remains the known-good fallback. This generic branch is not yet deployed and has not yet passed a real Stream → Gateway → physical-phone journey.
- It does not claim universal access to product owners, guaranteed fulfillment, product authenticity, or perfect deepfake detection.
- It does not place an order, charge a user, contact strangers, scrape private data, or reuse third-party media without rights.

Before submission, a fresh judge must be able to complete the whole public no-login loop in current ChatGPT's in-app browser, WebMCP-enabled Chrome, an ordinary-browser fallback, and a physical phone. The three-minute video must show the answer before the mission, the phone recording and human review, and the materially improved answer after publication.

See [SUBMISSION.md](SUBMISSION.md) for the judge packet, [DEMO.md](DEMO.md) for the capture plan, [DEPLOYMENT.md](DEPLOYMENT.md) for release and rollback, [EXPERIMENTS.md](EXPERIMENTS.md) for falsification receipts, [RESOURCES.md](RESOURCES.md) for current documentation, [SPONSOR-PRODUCTS.md](SPONSOR-PRODUCTS.md) for the sponsor atlas, and [STRATEGY.md](STRATEGY.md) for the winning-probability framework.
