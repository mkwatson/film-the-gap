# Film the Gap release runbook

Updated 2026-08-28 PT. Nothing described here is publicly deployed yet. This runbook uses a new Vercel project and the separate Cloudflare Worker name `webmcp-product-evidence`, so it cannot overwrite an existing deployment.

## Candidate topology

| Surface                     | Runtime                                            | Responsibility                                                                                                   |
| --------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Shopper, board, contributor | Next.js 16 on Vercel                               | Native WebMCP tools, open requests, human UI, QR handoff, discovery, video review, playback                      |
| Evidence service            | Cloudflare Worker + SQLite Durable Object          | Revisioned cases, random capture phrases, scoped capabilities, WebSocket updates, uploads, reviewed evidence     |
| Mission/reuse index         | Cloudflare D1                                      | 24-hour public filming requests plus exact opted-in product/question evidence lookup                             |
| Video                       | Cloudflare Stream binding                          | One-time direct phone uploads, encoding, authorized MP4 generation, playback                                     |
| Evidence expiry             | Cloudflare Cron Trigger                            | Daily physical deletion of expired 24-hour requests and 30-day reusable metadata                                 |
| Multimodal proposal         | Vercel AI Gateway + AI SDK 7, called by the Worker | Bounded timestamped proposal and exact mission-phrase check from the authorized MP4; never publication authority |
| Social-video discovery      | ScrapeCreators, called only by the Vercel app      | Link-only TikTok, Instagram, and YouTube leads; never implied reuse rights                                       |
| Broad-web discovery         | Exa tool through Vercel AI Gateway + AI SDK 7      | At most four claim-aware web/PDP leads from one exact-query-verified call                                        |
| Known product-page reader   | Cloudflare Browser Run `/markdown` Worker binding  | Bounded dynamic-page excerpt, final-origin receipt, Content Signals, and no promotion of page copy to proof      |
| Discovery reuse             | Vercel Runtime Cache                               | Reuses successful public-query receipts for 15 minutes per region                                                |

The deployable Worker is [evidence-index.ts](room-worker/src/evidence-index.ts), configured by [wrangler.evidence.jsonc](room-worker/wrangler.evidence.jsonc). It exposes only the evidence API required by this product.

## Cost and abuse envelope

These are defense-in-depth controls, not claims of perfect abuse prevention.

| Cost surface           | Enforced control                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence-case creation | 12 requests per client fingerprint per 60 seconds and 120 total per 60 seconds, per Cloudflare location                                  |
| Client fingerprint     | SHA-256 of Cloudflare IP plus user agent; raw IP is not retained by application code                                                     |
| Upload reservations    | At most two over a temporary case's lifetime                                                                                             |
| Upload bytes           | At most 95 MiB; basic direct POST only                                                                                                   |
| Reserved duration      | Actual browser-measured duration plus five seconds, bounded by the mission and 90-second maximum                                         |
| Upload capability      | One-time Stream URL with a 15-minute expiry and allowed app hostname                                                                     |
| Stored video           | Scheduled deletion after 31 days; enough for judging, not indefinite storage                                                             |
| Reusable evidence      | Explicit contributor opt-in; exact product/question matching; 30-day expiry and daily D1 purge                                           |
| Capture timing         | Random per-mission phrase; server-stored model receipt; honest contributor-attested/preexisting fallback; never labeled authenticity     |
| Device permissions     | Shopper and board deny camera/microphone; only the contributor route permits same-origin camera and microphone for a user-initiated take |
| Public mission board   | Explicit shopper confirmation; public fields only; 24-hour expiry; daily purge; fulfilled jobs hidden                                    |
| Public recorder path   | Separate case-scoped capability; removal revokes it without invalidating the private contributor link                                    |
| Model calls            | One cached successful proposal per upload and no more than two crash-recovery attempts                                                   |
| Video AI spend         | Dedicated AI Gateway key with a hard non-renewing budget and 30-day expiry                                                               |
| Broad web search       | Vercel OIDC under a non-renewing project budget, one Exa `instant` call, four results, exact-query receipt check, and 20-second timeout  |
| Product-page reading   | Server capability; public HTTPS/default port only; same-origin navigation; 24-hour Browser Run cache; atomic D1 maximum of 60 reads/day  |
| Discovery reuse        | SHA-256 cache key; successful configured searches reused for 15 minutes through Vercel Runtime Cache                                     |
| Public discovery       | Same-origin JSON only, Vercel WAF fixed-window limit, bounded Gateway credit exposure, and a fixed-credit social key                     |

Cloudflare's current Worker rate-limit binding is deliberately permissive, eventually consistent, and local to a Cloudflare location. It is useful overload protection, not exact global accounting. Browser Run therefore uses an atomic D1 daily ceiling instead: even if all 60 actions consume both eight-second timeout phases on every day of a 31-day month, this candidate stays below 8.3 browser hours. Cloudflare currently includes 10 Browser Run hours per month on Workers Paid, but unrelated account usage could consume that headroom and must be checked before release. The hard upload-count cap, model-attempt cap, expiring capabilities, AI Gateway budget, and vendor credit limit remain necessary. See [Browser Run pricing](https://developers.cloudflare.com/browser-run/pricing/), [Browser Run Markdown](https://developers.cloudflare.com/browser-run/quick-actions/markdown-endpoint/), [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Stream Direct Creator Uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/), [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), and [AI Gateway key budgets](https://vercel.com/changelog/budgets-for-api-keys-on-ai-gateway).

Turnstile is not on the canonical judge path yet. Its server validation would add useful bot resistance, but an unverified interaction inside ChatGPT's in-app Browser is a larger submission risk than the bounded residual cost. Reconsider only after an exact-runtime test proves invisible or interaction-only Turnstile does not interrupt native Site Tools or phone capture.

## Read-only account preflight

Run these before the approval session. They do not create resources or spend credits:

```bash
pnpm dlx vercel@59.9.1 whoami
pnpm dlx vercel@59.9.1 teams ls
pnpm dlx vercel@59.9.1 project ls --scope YOUR-STANDALONE-TEAM-SLUG
pnpm dlx vercel@59.9.1 ai-gateway budgets list --scope YOUR-STANDALONE-TEAM-SLUG
pnpm dlx vercel@59.9.1 ai-gateway api-keys list --scope YOUR-STANDALONE-TEAM-SLUG
pnpm --dir room-worker exec wrangler whoami
pnpm --dir room-worker exec wrangler d1 list --json
gh auth status
```

Use a Vercel team whose generated production URLs do not carry an unrelated company slug. The selected team needs permission to create a project, set its AI Gateway budget, create one scoped Gateway key, and stage a project-level firewall rule. Cloudflare needs Workers, Durable Objects, D1, Stream, Browser Run, Cron Triggers, and rate-limit bindings. A successful `wrangler whoami` does not prove Stream or Browser Run account readiness; confirm Stream's terms/billing and inspect current Browser Run monthly usage once in the dashboard before deployment.

## User-approved one-time setup

These steps mutate accounts or authorize spend. Mark must approve them and be present.

The current minimum new purchase is one `$5` [Cloudflare Stream storage block](https://developers.cloudflare.com/stream/pricing/). [Vercel currently includes](https://vercel.com/docs/ai-gateway/pricing) `$5` of monthly AI Gateway credit; if that account credit is already exhausted, stop before buying more and report the exact balance and projected rehearsal cost.

1. Choose a globally distinct public project name and a standalone Vercel team. Create and explicitly link a new project. Its generated `*.vercel.app` hostname is based on that name and scope, so stop if it acquires an unrelated company suffix. Do not reuse or rename an existing project. A custom neutral domain is optional polish after the generated hostname passes every gate.

   ```bash
   WEBMCP_VERCEL_SCOPE=YOUR-STANDALONE-TEAM-SLUG
   WEBMCP_VERCEL_PROJECT=film-the-gap
   test -n "$WEBMCP_VERCEL_SCOPE"
   test -n "$WEBMCP_VERCEL_PROJECT"

   pnpm dlx vercel@59.9.1 project add "$WEBMCP_VERCEL_PROJECT" \
     --scope "$WEBMCP_VERCEL_SCOPE"
   pnpm dlx vercel@59.9.1 link --yes \
     --team "$WEBMCP_VERCEL_SCOPE" \
     --project "$WEBMCP_VERCEL_PROJECT"
   pnpm dlx vercel@59.9.1 project inspect "$WEBMCP_VERCEL_PROJECT" \
     --scope "$WEBMCP_VERCEL_SCOPE"
   ```

2. Enable Cloudflare Stream on the intended account and purchase its minimum prepaid storage block: currently `$5` for 1,000 stored minutes. Keep the demo's existing duration, upload-count, and deletion bounds; do not purchase additional storage.
3. Confirm the account's remaining included Browser Run time leaves the candidate's worst-case 8.3-hour monthly envelope below the account allowance. Do not enable usage-based overage for this project. Then create a dedicated D1 database in Western North America and replace both all-zero placeholder IDs in `room-worker/wrangler.evidence.jsonc` with the returned UUID. This mutates the Cloudflare account and must not be run until Mark approves:

   ```bash
   pnpm --dir room-worker exec wrangler d1 create webmcp-product-evidence-library \
     --location wnam \
     --config wrangler.evidence.jsonc
   ```

   Keep the binding name exactly `EVIDENCE_LIBRARY`. Do not deploy while either placeholder UUID remains.

4. Set the exact new project name once, inspect it, put a `$5` non-renewing AI Gateway budget on that project, then create one dedicated Gateway key for the external Cloudflare video worker with a separate `$5` hard ceiling, no refresh, alerts, and a 30-day expiry. Vercel-hosted web discovery uses automatically refreshed OIDC under the project budget and stores no second key. Vercel currently includes `$5` of monthly Gateway credit; do not purchase or enable auto top-up unless the account's existing usage has exhausted it and Mark separately approves the charge.

   ```bash
   WEBMCP_VERCEL_SCOPE=YOUR-STANDALONE-TEAM-SLUG
   WEBMCP_VERCEL_PROJECT=film-the-gap
   test -n "$WEBMCP_VERCEL_SCOPE"
   test -n "$WEBMCP_VERCEL_PROJECT"

   pnpm dlx vercel@59.9.1 ai-gateway budgets set \
     project "$WEBMCP_VERCEL_PROJECT" \
     --limit 5 \
     --refresh-period none \
     --scope "$WEBMCP_VERCEL_SCOPE"

   pnpm dlx vercel@59.9.1 ai-gateway api-keys create \
     --name webmcp-product-evidence-video \
     --budget 5 \
     --refresh-period none \
     --alert-thresholds 50,75,100 \
     --expiration 30d \
     --scope "$WEBMCP_VERCEL_SCOPE"

   ```

   Do not use `--bypass-all-settings` or `--zdr-exempt`. Copy the secret only into Cloudflare's encrypted secret prompt. Keep Vercel auto top-up disabled and retain the route/WAF limits below. The project budget is the hard discovery ceiling; an explicit `AI_GATEWAY_DISCOVERY_API_KEY` is unnecessary and would override OIDC.

5. If live social discovery is enabled, create a dedicated ScrapeCreators key with only the credits Mark approves. The app remains truthful and functional without it, but reports discovery as unavailable.
6. Before every budget, environment, firewall, or deploy command, inspect `.vercel/project.json` and run `vercel project inspect` with the explicit scope; both must identify the new standalone project, never a pre-existing project. `.vercel/project.json` must remain uncommitted.

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
pnpm --dir room-worker d1:migrate:evidence-acceptance
pnpm --dir room-worker dev:evidence-services
pnpm --dir room-worker dev:evidence-acceptance
ALLOWED_DEV_ORIGINS=127.0.0.1 NEXT_PUBLIC_EVIDENCE_ROOM_URL=http://localhost:8792 EVIDENCE_PAGE_READER_TOKEN=acceptance-only-page-reader-secret pnpm dev
pnpm acceptance:evidence-network
pnpm acceptance:evidence-network:fallback
```

The migration command is one-time local preparation; the next four commands use separate shells. Run both acceptance commands in the fourth shell. The native run exercises dynamic Site Tools on both shopper and board pages. The fallback run starts Chrome with WebMCP explicitly disabled and completes the same journey through visible controls. Both cover three browser contexts, explicit public disclosure, privacy-minimized listing, revocable public capability, the actual app, Durable Object, D1 index, upload/model-shaped service boundaries, human correction, explicit reuse consent, publication, WebSocket update, a fresh matching case, and cross-case reuse. They replace only the paid Stream and model calls with strict local services.

## First generic deployment

The app origin and Worker origin depend on one another. Establish the new Vercel project and its stable production hostname first, but do not send judges there until all gates pass.

Set and inspect explicit shell variables; never paste placeholders into a deployment:

```bash
WEBMCP_VERCEL_SCOPE=YOUR-STANDALONE-TEAM-SLUG
WEBMCP_VERCEL_PROJECT=film-the-gap
APP_ORIGIN="https://$WEBMCP_VERCEL_PROJECT.vercel.app"
ROOM_ORIGIN=https://webmcp-product-evidence.YOUR-CLOUDFLARE-SUBDOMAIN.workers.dev
RELEASE_SHA=$(git rev-parse HEAD)
```

Confirm `APP_ORIGIN` is the actual production hostname reported by Vercel; do not infer or accept a suffixed fallback hostname. If a clean generated hostname is unavailable, choose another standalone project name or explicitly configure a clean custom domain before continuing.

Then:

1. Apply the reviewed D1 migration remotely and inspect its success before any Worker can advertise reusable evidence:

   ```bash
   pnpm --dir room-worker exec wrangler d1 migrations apply \
     webmcp-product-evidence-library \
     --remote \
     --config wrangler.evidence.jsonc
   ```

2. Bootstrap the new Worker under its separate name. This initial version is not judge-facing:

   ```bash
   pnpm --dir room-worker exec wrangler deploy \
     --config wrangler.evidence.jsonc \
     --strict \
     --tag "$RELEASE_SHA" \
     --message "bootstrap generic evidence candidate $RELEASE_SHA" \
     --var "ALLOWED_ORIGINS:$APP_ORIGIN" \
     --var "EVIDENCE_CASE_TTL_SECONDS:86400"
   ```

3. Add the dedicated budgeted video-analysis Gateway key through the encrypted prompt. Generate a separate random reader capability of at least 24 characters in a password manager, enter it for `PAGE_READER_SHARED_SECRET`, and retain it only long enough to enter the identical value in Vercel Production as `EVIDENCE_PAGE_READER_TOKEN`:

   ```bash
   pnpm --dir room-worker exec wrangler secret put AI_GATEWAY_API_KEY \
     --config wrangler.evidence.jsonc

   pnpm --dir room-worker exec wrangler secret put PAGE_READER_SHARED_SECRET \
     --config wrangler.evidence.jsonc
   ```

4. Redeploy the exact commit and record the final Worker version ID, tag, and timestamp:

   ```bash
   pnpm --dir room-worker exec wrangler deploy \
     --config wrangler.evidence.jsonc \
     --strict \
     --tag "$RELEASE_SHA" \
     --message "generic evidence release $RELEASE_SHA" \
     --var "ALLOWED_ORIGINS:$APP_ORIGIN" \
     --var "EVIDENCE_CASE_TTL_SECONDS:86400"
   ```

5. Configure the new Vercel project's Production environment:

   - `NEXT_PUBLIC_EVIDENCE_ROOM_URL=$ROOM_ORIGIN` — required and compiled at build time.
   - `EVIDENCE_PAGE_READER_TOKEN` — required, server-only, identical to the Worker's `PAGE_READER_SHARED_SECRET`, and never prefixed `NEXT_PUBLIC_`.
   - `AI_GATEWAY_DISCOVERY_API_KEY` — omit on the final Vercel release; automatically refreshed OIDC stays inside the project-scoped `$5` budget.
   - `SCRAPECREATORS_API_KEY` — optional, server-only, dedicated to this demo.
   - Do not add `AI_GATEWAY_API_KEY`; the video-analysis key belongs only on the Worker.

   The build fails closed on Vercel when `NEXT_PUBLIC_EVIDENCE_ROOM_URL` is absent, non-HTTPS, credentialed, or not an exact origin. This prevents a healthy-looking deployment whose phone action silently falls back to “service not configured.”

6. Deploy the exact Git commit to Vercel. Prefer a Git-associated Production build so `VERCEL_GIT_COMMIT_SHA` is authoritative. A reviewed prebuilt artifact may use `WEBMCP_RELEASE_COMMIT_SHA=$RELEASE_SHA`, but the room origin must be present during `vercel build`; changing it after the build cannot update the client bundle.
7. Confirm Vercel Deployment Protection is disabled on the final judge hostname. The page must work logged out with no share parameter, password, trusted IP, or bypass header.

## Vercel public-discovery firewall

Vercel WAF rate limiting is available on all plans, but the first rule may show a pricing acknowledgement. Stage and inspect it; Mark publishes each stage.

1. Add a fixed-window rule for only `POST /api/evidence/search`, initially logging overflow after 20 requests per IP per minute:

   ```bash
   pnpm dlx vercel@59.9.1 firewall rules add "Product evidence search ceiling" \
     --project "$WEBMCP_VERCEL_PROJECT" \
     --condition '{"type":"path","op":"eq","value":"/api/evidence/search"}' \
     --condition '{"type":"method","op":"eq","value":"POST"}' \
     --action rate_limit \
     --rate-limit-window 60 \
     --rate-limit-requests 20 \
     --rate-limit-keys ip \
     --rate-limit-action log \
     --yes \
     --scope "$WEBMCP_VERCEL_SCOPE"
   pnpm dlx vercel@59.9.1 firewall diff \
     --project "$WEBMCP_VERCEL_PROJECT" \
     --scope "$WEBMCP_VERCEL_SCOPE"
   ```

2. Mark publishes the explicit project's draft, exercises shopper and ChatGPT searches, and reviews matched traffic in the Vercel Firewall dashboard:

   ```bash
   pnpm dlx vercel@59.9.1 firewall publish \
     --project "$WEBMCP_VERCEL_PROJECT" \
     --yes \
     --scope "$WEBMCP_VERCEL_SCOPE"
   ```

3. After legitimate traffic is confirmed, retain the rule and change overflow to HTTP 429:

   ```bash
   pnpm dlx vercel@59.9.1 firewall rules edit "Product evidence search ceiling" \
     --project "$WEBMCP_VERCEL_PROJECT" \
     --action rate_limit \
     --rate-limit-window 60 \
     --rate-limit-requests 20 \
     --rate-limit-keys ip \
     --rate-limit-action rate_limit \
     --yes \
     --scope "$WEBMCP_VERCEL_SCOPE"
   pnpm dlx vercel@59.9.1 firewall diff \
     --project "$WEBMCP_VERCEL_PROJECT" \
     --scope "$WEBMCP_VERCEL_SCOPE"
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
2. the standalone Worker exposes the same commit, both rate-limit bindings, the two-upload cap, Stream, Browser Run, live video analysis, D1, the 30-day reuse boundary, and daily expiry purge;
3. real read-only D1 queries succeed through both the reusable-evidence and open-mission contracts, proving the binding and migrations rather than trusting health metadata;
4. shopper, owned demo-product, mission-board, and contributor pages have the intended route-scoped camera, microphone, upload, playback, CORS, CSP, referrer, and content-type boundaries; the demo-product page also exposes exactly `search=yes, ai-input=yes, ai-train=no`;
5. an untrusted browser origin is rejected; and
6. one disposable evidence case is created and survives a Durable Object read-back.

The report contains only public Worker metadata and step timings. It parses but never returns or logs the disposable owner/contributor capabilities.

Then perform one user-approved paid rehearsal on the final origins:

1. Clean unauthenticated desktop browser: open the same-origin `/demo-product` source, then search the default question and confirm a real Browser Run receipt whose page text remains non-decisive. Also repeat once with an arbitrary public product URL/question before creating the mission and QR/link.
2. Physical phone: owned unbranded object, say or show the issued phrase with the product visible, continuous recording, real direct Stream upload, real Gateway proposal and phrase check, explicit correction/review, publish.
   Confirm specifically that the Gateway provider can fetch the generated public MP4 while Stream playback-origin restrictions are active; current Cloudflare documentation describes those restrictions for HLS/DASH playback but does not explicitly guarantee this downstream-download combination.
3. Contributor deliberately selects publishing rights, explicitly confirms the complete review, and opts into 30-day network reuse; confirm a missing confirmation or missing rights selection cannot publish, and weak/inconclusive evidence cannot be selected for reuse.
4. Desktop reload: same durable case and timestamped evidence still visible.
5. Open a fresh case for the exact same product URL and question; confirm D1 returns the reviewed Stream citation and no new filming mission appears.
6. Current WebMCP-enabled Chrome: complete native Site Tool journey.
7. Latest ChatGPT desktop app: use a non-Enterprise, non-Edu workspace; select GPT-5.6 Sol or Terra; turn on **Settings → Browser → Permissions → Enable site tools**; open the app in the built-in browser; confirm **Site tools → Available site tools** lists the native tools; complete the same journey and capture **Recently used → Sources**. Do not substitute ChatGPT in an ordinary web browser or GPT-5.6 Luna, where Site Tools are unavailable.
8. Ordinary-browser fallback: complete the journey without Site Tools.
9. Cold tester: understands and completes the canonical flow without coaching.

Record actual result, duration, browser/build versions, Worker version, model ID, Stream UID, and failures. Do not put contributor capabilities, Gateway keys, vendor keys, or raw private URLs in the receipt.

## Freeze manifest

| Field         | Required value                                                                       |
| ------------- | ------------------------------------------------------------------------------------ |
| Git           | Full `RELEASE_SHA`, signed/frozen tag, clean public repository                       |
| Vercel        | Immutable deployment URL, stable alias, commit receipt, WAF rule ID/state            |
| Cloudflare    | Worker origin/version, D1 migrations, Cron Trigger, Stream, Browser Run, rate limits |
| Paid edges    | Budgeted Gateway key expiry/cap, Stream retention, discovery credit ceiling          |
| Runtime tests | Release verifier, Chrome, ChatGPT, physical phone, fallback, cold tester timestamps  |
| Submission    | Final live URL, repository URL, YouTube URL, Devpost export                          |

After the September 3, 2026 1:00 p.m. PT deadline, keep the submitted repository, deployment, and entry frozen through judging. Continue experiments only in a clearly separate branch or project.

## Rollback

Preserve the previous candidate Vercel deployment URL and Worker version ID before every change.

- Vercel: `pnpm dlx vercel@59.9.1 rollback PREVIOUS_DEPLOYMENT_URL --scope "$WEBMCP_VERCEL_SCOPE"`, then inspect `rollback status` for the explicit project and scope.
- Cloudflare: `pnpm --dir room-worker exec wrangler rollback PREVIOUS_VERSION_ID --config wrangler.evidence.jsonc --message "rollback to known-good generic evidence release"`.
- WAF: stage the rule back to logging or disable it, inspect `firewall diff`, then Mark publishes the draft.

Cloudflare code rollback does not roll back Durable Object or D1 storage. Never roll back across an incompatible stored schema; migrations need their own forward repair. If any required public gate fails, remove the URL from submission material until the candidate is repaired.
