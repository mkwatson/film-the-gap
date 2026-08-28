# Generic evidence-network release runbook

Updated 2026-08-27 PT. Nothing described here is publicly deployed yet. The existing live-market release remains an independent known-good fallback; this candidate uses a new Vercel project and the separate Cloudflare Worker name `webmcp-product-evidence`, so releasing it cannot overwrite that fallback.

## Candidate topology

| Surface                     | Runtime                                            | Responsibility                                                                                   |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Shopper and contributor app | Next.js 16 on Vercel                               | Native WebMCP tools, human UI, QR handoff, public discovery, video review, playback              |
| Evidence service            | Cloudflare Worker + SQLite Durable Object          | Revisioned cases, scoped capabilities, WebSocket updates, upload reservations, reviewed evidence |
| Video                       | Cloudflare Stream binding                          | One-time direct phone uploads, encoding, authorized MP4 generation, playback                     |
| Multimodal proposal         | Vercel AI Gateway + AI SDK 7, called by the Worker | Bounded timestamped proposal from the authorized MP4; never publication authority                |
| Social-video discovery      | ScrapeCreators, called only by the Vercel app      | Link-only TikTok, Instagram, and YouTube leads; never implied reuse rights                       |
| Broad-web discovery         | Exa tool through Vercel AI Gateway + AI SDK 7      | At most four claim-aware web/PDP leads from one exact-query-verified call                        |
| Discovery reuse             | Vercel Runtime Cache                               | Reuses successful public-query receipts for 15 minutes per region                                |

The deployable Worker is [evidence-index.ts](room-worker/src/evidence-index.ts), configured by [wrangler.evidence.jsonc](room-worker/wrangler.evidence.jsonc). It intentionally exposes no live-market rooms, UCP cart, merchant, checkout, or legacy image-model endpoint.

## Cost and abuse envelope

These are defense-in-depth controls, not claims of perfect abuse prevention.

| Cost surface           | Enforced control                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Evidence-case creation | 12 requests per client fingerprint per 60 seconds and 120 total per 60 seconds, per Cloudflare location |
| Client fingerprint     | SHA-256 of Cloudflare IP plus user agent; raw IP is not retained by application code                    |
| Upload reservations    | At most two over a temporary case's lifetime                                                            |
| Upload bytes           | At most 95 MiB; basic direct POST only                                                                  |
| Reserved duration      | Actual browser-measured duration plus five seconds, bounded by the mission and 90-second maximum        |
| Upload capability      | One-time Stream URL with a 15-minute expiry and allowed app hostname                                    |
| Stored video           | Scheduled deletion after 31 days; enough for judging, not indefinite storage                            |
| Model calls            | One cached successful proposal per upload and no more than two crash-recovery attempts                  |
| Video AI spend         | Dedicated AI Gateway key with a hard non-renewing budget and 30-day expiry                              |
| Broad web search       | One Exa `instant` call, four results, exact-query receipt check, 20-second timeout, and separate budget |
| Discovery reuse        | SHA-256 cache key; successful configured searches reused for 15 minutes through Vercel Runtime Cache    |
| Public discovery       | Same-origin JSON only, Vercel WAF fixed-window limit, and dedicated budgeted/fixed-credit vendor keys   |

Cloudflare's current Worker rate-limit binding is deliberately permissive, eventually consistent, and local to a Cloudflare location. It is useful overload protection, not exact global accounting. The hard upload-count cap, model-attempt cap, expiring capabilities, AI Gateway budget, and vendor credit limit remain necessary. See [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Stream Direct Creator Uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/), [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), and [AI Gateway key budgets](https://vercel.com/changelog/budgets-for-api-keys-on-ai-gateway).

Turnstile is not on the canonical judge path yet. Its server validation would add useful bot resistance, but an unverified interaction inside ChatGPT's in-app Browser is a larger submission risk than the bounded residual cost. Reconsider only after an exact-runtime test proves invisible or interaction-only Turnstile does not interrupt native Site Tools or phone capture.

## User-approved one-time setup

These steps mutate accounts or authorize spend. Mark must approve them and be present.

1. Choose the public project name and a new Vercel project. Do not reuse the live-market Vercel project.
2. Enable Cloudflare Stream on the intended account and approve its minimum storage/delivery commitment.
3. Create two dedicated Vercel AI Gateway keys with a combined hard ceiling of `$25`, non-renewing, with alerts and a 30-day expiry. Separating video analysis from public web discovery limits blast radius and makes each cost visible:

   ```bash
   pnpm dlx vercel@59.7.0 ai-gateway api-keys create \
     --name webmcp-product-evidence-video \
     --budget 20 \
     --refresh-period none \
     --alert-thresholds 50,75,100 \
     --expiration 30d

   pnpm dlx vercel@59.7.0 ai-gateway api-keys create \
     --name webmcp-product-evidence-discovery \
     --budget 5 \
     --refresh-period none \
     --alert-thresholds 50,75,100 \
     --expiration 30d
   ```

   Do not use `--bypass-all-settings` or `--zdr-exempt`. Copy the video secret only into Cloudflare's encrypted secret prompt. Keep the discovery secret for the new Vercel project's encrypted Production environment.

4. If live social discovery is enabled, create a dedicated ScrapeCreators key with only the credits Mark approves. The app remains truthful and functional without it, but reports discovery as unavailable.
5. Link this worktree to the new Vercel project only after the public project name is chosen. `.vercel/project.json` must remain uncommitted.

## Candidate gate before any deployment

Start from the exact clean commit intended for judging:

```bash
git status --short
git rev-parse HEAD
pnpm install --frozen-lockfile
pnpm check
```

`git status --short` must print nothing. Save the 40-character commit as `RELEASE_SHA`. Run the deterministic native evidence journey locally before changing any public system:

```bash
pnpm --dir room-worker dev:evidence-services
pnpm --dir room-worker dev:evidence-acceptance
NEXT_PUBLIC_EVIDENCE_ROOM_URL=http://localhost:8792 pnpm dev
pnpm acceptance:evidence-network
```

Those four commands use separate shells. The acceptance test exercises real Chrome, native dynamic Site Tools, two tabs, the actual app and Durable Object, upload/model-shaped service boundaries, human correction, publication, WebSocket update, and the before/after answer. It replaces only the paid Stream and model calls with strict local services.

## First generic deployment

The app origin and Worker origin depend on one another. Establish the new Vercel project and its stable production hostname first, but do not send judges there until all gates pass.

Set and inspect explicit shell variables; never paste placeholders into a deployment:

```bash
APP_ORIGIN=https://YOUR-NEW-VERCEL-PROJECT.vercel.app
ROOM_ORIGIN=https://webmcp-product-evidence.YOUR-CLOUDFLARE-SUBDOMAIN.workers.dev
RELEASE_SHA=$(git rev-parse HEAD)
```

Then:

1. Bootstrap the new Worker under its separate name. This initial version is not judge-facing:

   ```bash
   pnpm --dir room-worker exec wrangler deploy \
     --config wrangler.evidence.jsonc \
     --strict \
     --tag "$RELEASE_SHA" \
     --message "bootstrap generic evidence candidate $RELEASE_SHA" \
     --var "ALLOWED_ORIGINS:$APP_ORIGIN" \
     --var "EVIDENCE_CASE_TTL_SECONDS:86400"
   ```

2. Add the dedicated budgeted video-analysis Gateway key through the encrypted prompt:

   ```bash
   pnpm --dir room-worker exec wrangler secret put AI_GATEWAY_API_KEY \
     --config wrangler.evidence.jsonc
   ```

3. Redeploy the exact commit and record the final Worker version ID, tag, and timestamp:

   ```bash
   pnpm --dir room-worker exec wrangler deploy \
     --config wrangler.evidence.jsonc \
     --strict \
     --tag "$RELEASE_SHA" \
     --message "generic evidence release $RELEASE_SHA" \
     --var "ALLOWED_ORIGINS:$APP_ORIGIN" \
     --var "EVIDENCE_CASE_TTL_SECONDS:86400"
   ```

4. Configure the new Vercel project's Production environment:

   - `NEXT_PUBLIC_EVIDENCE_ROOM_URL=$ROOM_ORIGIN` — required and compiled at build time.
   - `AI_GATEWAY_DISCOVERY_API_KEY` — optional but expected for the final candidate; the separate `$5` key for bounded Exa search through Vercel AI Gateway.
   - `SCRAPECREATORS_API_KEY` — optional, server-only, dedicated to this demo.
   - Do not add `AI_GATEWAY_API_KEY`; the video-analysis key belongs only on the Worker.

5. Deploy the exact Git commit to Vercel. Prefer a Git-associated Production build so `VERCEL_GIT_COMMIT_SHA` is authoritative. A reviewed prebuilt artifact may use `WEBMCP_RELEASE_COMMIT_SHA=$RELEASE_SHA`, but the room origin must be present during `vercel build`; changing it after the build cannot update the client bundle.
6. Confirm Vercel Deployment Protection is disabled on the final judge hostname. The page must work logged out with no share parameter, password, trusted IP, or bypass header.

## Vercel public-discovery firewall

Vercel WAF rate limiting is available on all plans, but the first rule may show a pricing acknowledgement. Stage and inspect it; Mark publishes each stage.

1. Add a fixed-window rule for only `POST /api/evidence/search`, initially logging overflow after 20 requests per IP per minute:

   ```bash
   pnpm dlx vercel@59.7.0 firewall rules add "Product evidence search ceiling" \
     --condition '{"type":"path","op":"eq","value":"/api/evidence/search"}' \
     --condition '{"type":"method","op":"eq","value":"POST"}' \
     --action rate_limit \
     --rate-limit-window 60 \
     --rate-limit-requests 20 \
     --rate-limit-keys ip \
     --rate-limit-action log \
     --yes
   pnpm dlx vercel@59.7.0 firewall diff
   ```

2. Mark runs `pnpm dlx vercel@59.7.0 firewall publish --yes`, exercises buyer and ChatGPT searches, and reviews matched traffic in the Vercel Firewall dashboard.
3. After legitimate traffic is confirmed, retain the rule and change overflow to HTTP 429:

   ```bash
   pnpm dlx vercel@59.7.0 firewall rules edit "Product evidence search ceiling" \
     --action rate_limit \
     --rate-limit-window 60 \
     --rate-limit-requests 20 \
     --rate-limit-keys ip \
     --rate-limit-action rate_limit \
     --yes
   pnpm dlx vercel@59.7.0 firewall diff
   ```

4. Mark publishes again. Keep the filtered Firewall traffic view open during the rehearsal. Counters are regional and IPs can be shared, so this remains a generous overload ceiling rather than a user quota.

## Mandatory public verification

Immediately after both final deployments:

```bash
EVIDENCE_ACCEPTANCE_APP_URL="$APP_ORIGIN" \
EVIDENCE_ACCEPTANCE_ROOM_ORIGIN="$ROOM_ORIGIN" \
EVIDENCE_RELEASE_COMMIT_SHA="$RELEASE_SHA" \
pnpm release:verify
```

The verifier uses manual redirects and bounded bodies. It proves:

1. the app exposes the exact reviewed commit and compiled Worker origin;
2. the standalone Worker exposes the same commit, both rate-limit bindings, the two-upload cap, Stream, and live video analysis;
3. buyer and contributor pages have the intended camera, upload, playback, CORS, CSP, referrer, and content-type boundaries;
4. an untrusted browser origin is rejected; and
5. one disposable evidence case is created and survives a Durable Object read-back.

The report contains only public Worker metadata and step timings. It parses but never returns or logs the disposable owner/contributor capabilities.

Then perform one user-approved paid rehearsal on the final origins:

1. Clean unauthenticated desktop browser: arbitrary product/question, mission, QR/link.
2. Physical phone: owned unbranded object, continuous recording, real direct Stream upload, real Gateway proposal, explicit correction/review, publish.
   Confirm specifically that the Gateway provider can fetch the generated public MP4 while Stream playback-origin restrictions are active; current Cloudflare documentation describes those restrictions for HLS/DASH playback but does not explicitly guarantee this downstream-download combination.
3. Desktop reload: same durable case and timestamped evidence still visible.
4. Current WebMCP-enabled Chrome: complete native Site Tool journey.
5. Current ChatGPT in-app Browser: complete the same journey and capture the tool transcript.
6. Ordinary-browser fallback: complete the journey without Site Tools.
7. Cold tester: understands and completes the canonical flow without coaching.

Record actual result, duration, browser/build versions, Worker version, model ID, Stream UID, and failures. Do not put contributor capabilities, Gateway keys, vendor keys, or raw private URLs in the receipt.

## Freeze manifest

| Field         | Required value                                                                      |
| ------------- | ----------------------------------------------------------------------------------- |
| Git           | Full `RELEASE_SHA`, signed/frozen tag, clean public repository                      |
| Vercel        | Immutable deployment URL, stable alias, commit receipt, WAF rule ID/state           |
| Cloudflare    | Worker origin, version ID, version tag, timestamp, rate-limit bindings              |
| Paid edges    | Budgeted Gateway key expiry/cap, Stream retention, discovery credit ceiling         |
| Runtime tests | Release verifier, Chrome, ChatGPT, physical phone, fallback, cold tester timestamps |
| Submission    | Final live URL, repository URL, YouTube URL, Devpost export                         |

After the September 3, 2026 1:00 p.m. PT deadline, keep the submitted repository, deployment, and entry frozen through judging. Continue experiments only in a clearly separate branch or project.

## Rollback

Preserve the previous candidate Vercel deployment URL and Worker version ID before every change.

- Vercel: `pnpm dlx vercel@59.7.0 rollback PREVIOUS_DEPLOYMENT_URL`, then inspect `rollback status`.
- Cloudflare: `pnpm --dir room-worker exec wrangler rollback PREVIOUS_VERSION_ID --config wrangler.evidence.jsonc --message "rollback to known-good generic evidence release"`.
- WAF: stage the rule back to logging or disable it, inspect `firewall diff`, then Mark publishes the draft.

Cloudflare code rollback does not roll back Durable Object storage. Never roll back across an incompatible stored-case schema. If any required public gate fails, keep the old independent live-market release untouched and remove the generic URL from judge-facing material until the candidate is repaired.
