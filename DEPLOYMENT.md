# Public release and rollback runbook

Updated 2026-08-27 PT. This runbook prepares—but does not authorize—the external release. Mark must approve repository publication, the open-source license, account/terms acceptance, and the first production deployment.

## Release topology

| Surface        | Runtime                                            | Stable-origin responsibility                                                                             |
| -------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Buyer and host | Vercel / Next.js                                   | Human experience, native buyer Site Tools, platform UCP profile, optional AI Gateway vision proposal     |
| Evidence room  | Cloudflare Worker + SQLite Durable Object          | Separate buyer/host authority, revisions, idempotency, private merchant credential, recovery             |
| Merchant       | Cloudflare Worker + separate SQLite Durable Object | Released UCP discovery and Cart lifecycle, exact totals, buyer-only continuation and merchant Site Tools |

The two Workers intentionally use separate origins and separate Durable Object authorities. This is useful sponsor leverage, but more importantly it makes the product claim real: the evidence page cannot manufacture the merchant's authoritative Cart.

Every public surface exposes a non-secret build receipt. Vercel reports the Git-triggered `VERCEL_GIT_COMMIT_SHA`; an intentionally prebuilt artifact may instead receive the exact reviewed commit as `WEBMCP_RELEASE_COMMIT_SHA`. The platform value wins if both exist. Each Worker reports Cloudflare's version ID, version tag, and timestamp through the current [version metadata binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/). `pnpm release:verify` refuses to certify a release unless all three surfaces match one reviewed 40-character commit.

## Current platform facts that affect this release

- Cloudflare separates Worker versions from deployments and supports commit-sized tags on both `wrangler deploy` and `wrangler versions upload`. Storage state is not versioned with Worker code. See [Versions & Deployments](https://developers.cloudflare.com/workers/versions-and-deployments/) and the [current Wrangler command reference](https://developers.cloudflare.com/workers/wrangler/commands/workers/).
- Cloudflare's current [Preview URLs documentation](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/) explicitly says preview URLs are not generated for Workers that implement Durable Objects. These Workers therefore do not claim a preview-promotion path.
- A Vercel production build can be staged without assigning the production domain by using `vercel --prod --skip-domain`, then promoted. Vercel also documents that promoting a Preview-environment deployment creates a new Production deployment, so a Preview build is not treated as the identical production artifact. See [Deploying from CLI](https://vercel.com/docs/cli/deploying-from-cli) and [`vercel promote`](https://vercel.com/docs/cli/promote).
- Vercel generated URLs are public by default but may be protected by project settings. The final judge origin must not require Vercel Authentication, a share parameter, password, trusted IP, or automation-bypass header. See [Generated URLs](https://vercel.com/docs/deployments/generated-urls) and [Deployment Protection](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments).
- Vercel only supplies `VERCEL_GIT_COMMIT_SHA` for a Git-associated deployment when system environment variables are exposed. It is not automatically available to `--prebuilt` deployments. Confirm the project setting before release and use the explicit fallback only for an artifact built from a separately verified clean commit. See [System environment variables](https://vercel.com/docs/environment-variables/system-environment-variables) and [prebuilt deployments](https://vercel.com/docs/deployments/configure-a-build#prebuilt-deployments).

Verified local release clients on 2026-08-27: Wrangler `4.127.0` in both Worker packages and Vercel CLI `54.14.2`. Recheck the current first-party docs and installed versions on release day.

The August 27 protected-Preview rehearsal reached `READY` from clean commit `676ca66aac0b47cd5b65446eca5be54425119d1d`, and authenticated inspection rendered the buyer, host, UCP discovery, and health routes. It deliberately did **not** graduate the release: Preview protection remains enabled, the stable production alias has no live deployment, the Preview room variable is present but empty, and Wrangler is not authenticated to the intended account. See E12 in `EXPERIMENTS.md`.

## One-time account setup — Mark present

These steps mutate external systems and must not be performed unattended.

1. Choose and approve a detectable open-source license; add `LICENSE` before the public repository is created.
2. Create the public GitHub, GitLab, or Bitbucket repository and push the complete challenge-period history. Record its URL in `SUBMISSION.md`.
3. Import that repository into one Vercel project. Record its stable production origin as `APP_ORIGIN`. Enable automatic system environment variables and confirm `VERCEL_GIT_COMMIT_SHA` is available. Leave the final production domain completely unprotected.
4. Authenticate Wrangler to the intended Cloudflare account and accept any required terms. Confirm the stable `workers.dev` or custom origins for `webmcp-evidence-rooms` and `webmcp-evidence-merchant-preview`; record them as `ROOM_ORIGIN` and `MERCHANT_ORIGIN`.
5. In the Vercel Production environment, set `NEXT_PUBLIC_EVIDENCE_ROOM_URL` to `ROOM_ORIGIN`. Enable Vercel OIDC for AI Gateway if available; do not add a long-lived model key merely to remove the judge-safe manual review path.

The final origins must be distinct, credential-free HTTPS origins. Do not use a protected Vercel Preview URL or a temporary Tailscale URL in the submission.

## Release candidate gate

Start from the exact clean commit intended for judging:

```bash
git status --short
git rev-parse HEAD
pnpm install --frozen-lockfile
pnpm check
pnpm test:ucp-schema
```

`git status --short` must print nothing. Save the full `git rev-parse HEAD` value as `RELEASE_SHA`. Confirm the Vercel project is building that Git commit, not an uncommitted CLI working tree.

Before changing public traffic, complete the native acceptance journey against the locally built app and HTTPS service origins. The output must contain no invite or cart credential.

## Initial production release

There is no existing judge traffic during the initial release, so deploy dependencies first and the public app last.

1. Deploy the merchant from `merchant-worker/` with Wrangler `4.127.0`, `--tag RELEASE_SHA`, and a descriptive `--message`. Record the returned Worker version ID.
2. Deploy the room from `room-worker/` with the same tag. Supply all five production variables in the deployment command or a reviewed production config:

   - `ALLOWED_ORIGINS=APP_ORIGIN`
   - `ROOM_TTL_SECONDS=7200`
   - `UCP_BUSINESS_URL=MERCHANT_ORIGIN`
   - `UCP_VARIANT_ID=urn:webmcp-evidence-market:product-variant:live-inspected-board-156`
   - `UCP_PLATFORM_PROFILE_URL=APP_ORIGIN/.well-known/ucp`

   Record the room Worker version ID. Never deploy the checked-in localhost-only room variables as production configuration.

3. Create a Production-environment Vercel deployment from `RELEASE_SHA` with `--skip-domain`, or from that exact Git reference in the dashboard. Prefer the Git-associated path. If a reviewed prebuilt artifact is deliberately used, make the public room origin available during `vercel build` because `NEXT_PUBLIC_` values are compiled into the client, and pass the exact SHA to the deployed runtime. Inspect the unique deployment and `/api/health`; its `commit` must equal `RELEASE_SHA` and `evidenceRoomOrigin` must equal `ROOM_ORIGIN`.
4. Promote the staged Production build to `APP_ORIGIN`. Do not promote a Preview-environment build under the assumption that it is the identical artifact; current Vercel behavior creates a new Production deployment in that case.

An equivalent initial Worker command shape is shown below. Fill the variables in the shell first and inspect them; do not paste placeholders into a deployment:

```bash
pnpm --dir merchant-worker exec wrangler deploy --tag "$RELEASE_SHA" --message "challenge release $RELEASE_SHA"

pnpm --dir room-worker exec wrangler deploy \
  --tag "$RELEASE_SHA" \
  --message "challenge release $RELEASE_SHA" \
  --var "ALLOWED_ORIGINS:$APP_ORIGIN" \
  --var "ROOM_TTL_SECONDS:7200" \
  --var "UCP_BUSINESS_URL:$MERCHANT_ORIGIN" \
  --var "UCP_VARIANT_ID:urn:webmcp-evidence-market:product-variant:live-inspected-board-156" \
  --var "UCP_PLATFORM_PROFILE_URL:$APP_ORIGIN/.well-known/ucp"
```

If and only if the reviewed release uses a prebuilt Vercel artifact, the corresponding command shape is:

```bash
vercel env run -e production -- vercel build --prod
vercel deploy --prebuilt --prod --skip-domain \
  -e "WEBMCP_RELEASE_COMMIT_SHA=$RELEASE_SHA"
```

Before building, confirm that the Production value of `NEXT_PUBLIC_EVIDENCE_ROOM_URL` is non-empty and exactly equals `ROOM_ORIGIN`. A local production-start experiment proved that changing this variable after `next build` changes neither the client bundle nor `/api/health`; both retain the build-time origin. The explicit release SHA remains runtime-readable. Rebuild—never add a deploy-time room override—if the health origin is wrong.

## Mandatory public verification

Run the release verifier immediately after promotion:

```bash
EVIDENCE_ACCEPTANCE_APP_URL="$APP_ORIGIN" \
EVIDENCE_ACCEPTANCE_ROOM_ORIGIN="$ROOM_ORIGIN" \
EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN="$MERCHANT_ORIGIN" \
EVIDENCE_RELEASE_COMMIT_SHA="$RELEASE_SHA" \
pnpm release:verify
```

It verifies, with manual redirects and bounded bodies:

1. the Vercel app's commit and configured room origin;
2. both Worker health contracts and exact commit tags;
3. both UCP profiles and the merchant's exact MCP endpoint;
4. the buyer, host, and merchant pages plus merchant CSP, permission, and referrer boundaries;
5. the browser CORS preflight; and
6. one real disposable Durable Object room creation.

The report contains only step timings and public Worker version metadata. It parses and immediately discards the disposable room's buyer and host credentials.

Then run the deeper browser gate against the same public origins:

```bash
EVIDENCE_ACCEPTANCE_APP_URL="$APP_ORIGIN" \
EVIDENCE_ACCEPTANCE_ROOM_ORIGIN="$ROOM_ORIGIN" \
EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN="$MERCHANT_ORIGIN" \
pnpm acceptance:native
```

Finally, test from a clean unauthenticated browser, ChatGPT's current in-app Browser, and a physical phone. The final manual matrix is in `SUBMISSION.md`; automated success cannot replace those three judged-runtime gates.

## Release manifest and freeze

Record this before the Devpost freeze:

| Field             | Required value                                                                     |
| ----------------- | ---------------------------------------------------------------------------------- |
| Git commit        | Full `RELEASE_SHA`                                                                 |
| Vercel deployment | Immutable deployment URL and production alias                                      |
| Room Worker       | Origin, version ID, tag, timestamp                                                 |
| Merchant Worker   | Origin, version ID, tag, timestamp                                                 |
| Verification      | `release:verify`, native Chrome, ChatGPT, physical phone, clean browser timestamps |
| Submission assets | Repository URL, YouTube URL, exact Devpost draft/export                            |

After September 3, 2026 at 1:00 p.m. PT, keep the submitted repository, deployment, and Devpost entry frozen through judging. Continue experiments only in a clearly separate branch or fork that judges cannot confuse with the submitted revision.

## Rollback

Keep the previous known-good Vercel deployment URL and both Worker version IDs in the release manifest.

- Vercel: `vercel rollback PREVIOUS_DEPLOYMENT_URL`, then `vercel rollback status`.
- Cloudflare: from each Worker package, run `wrangler rollback PREVIOUS_VERSION_ID --message "rollback to known-good release"`.

Cloudflare [rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) do not roll back Durable Object storage. That is acceptable for this challenge only because rooms and carts are bounded, reversible, and short-lived; still, do not roll back across an incompatible Durable Object class or storage change. Vercel documents Hobby-plan rollback as limited to the immediately previous production deployment; preserve that deployment until judging ends.

After any rollback, run `pnpm release:verify` with the previous commit and repeat the clean-browser smoke path. If verification does not pass, remove the URL from judge-facing materials rather than leaving a partially aligned release live.
