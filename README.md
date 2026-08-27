# WebMCP Challenge evidence-directed live market

This repository is the challenge-period research and implementation workspace for a live market where people and their private agents can gather missing physical evidence together. The label above is descriptive, not a proposed submission name.

**Live judge URL:** [webmcp-evidence-market-vidably.vercel.app](https://webmcp-evidence-market-vidably.vercel.app) · **Public source:** [github.com/mkwatson/webmcp-evidence-market](https://github.com/mkwatson/webmcp-evidence-market)

The current rung proves one complete, privacy-minimizing collaboration loop:

1. The buyer keeps their profile and maximum price inside their personal agent.
2. The agent shares only four product-evidence requirements with the open page.
3. The page evaluates the live lot and exposes only the tools meaningful in that state.
4. The agent opens one normalized missing-fact request. Seven deterministic fixture signals make the solo path immediately complete; an optional proof layer replaces them one-for-one with seven uniquely credentialed, evidence-only attendee browser sessions.
5. The host can explicitly start a video-only camera and capture one bounded keyframe. Vercel AI Gateway can propose a pixel-grounded observation, but the host must accept or correct it; a manual review path remains available.
6. The host deliberately publishes that one selected JPEG, its provenance, the reviewed visual observation, and a separate repair-history attestation. One answer resolves all eight requests without revealing profiles, budgets, or the continuous camera feed.
7. A Lean-generated complete policy table gates both registration and authoritative acceptance of the reversible reservation tool; it appears only for a live, evidence-ready lot with no existing hold, then accepts only a fresh revision and the exact current all-in quote.
8. In an authoritatively configured room, the hold unlocks a reversible anonymous UCP `2026-08-25` merchant cart whose `$375` item plus `$48` flat fulfillment exactly matches the room's `$423` quote. Shared state receives bounded merchant-authored terms; only the invoking buyer receives the private continuation.
9. The page can cancel the merchant cart, discard its credential, release the hold, and keeps equivalent human controls visible throughout.

The seller-facing page does not receive a buyer ceiling. That is a concrete data-minimization boundary, not a claim that all statistical inference is impossible. The buyer surface uses direct native `document.modelContext.registerTool` calls in [use-site-tools.ts](src/lib/live-market/use-site-tools.ts), and the separate merchant registers its continuation tools in [pages.ts](merchant-worker/src/pages.ts). Human controls invoke the same domain transitions, so the experience remains complete in an ordinary browser.

The first screen includes a budget-free agent starter and a live preflight for native WebMCP, the evidence room, seller-phone presence, and the UCP merchant. Give ChatGPT the actual maximum in conversation, then copy the product-only starter; the page has no budget or identity input. A click-to-reveal local QR hands the temporary seller role to any phone without making the bearer invite part of the normal page or copied instructions. A separate collapsed control can reveal seven short-lived attendee invites. Each invite opens `/attend` with at most two Site Tools: inspect the normalized demand and join it once. The credential cannot answer for the host, reset the room, hold, create a UCP cart, check out, or pay.

## Run locally

Requirements: Node.js 24 or newer and pnpm 11.24.0.

```bash
pnpm install
pnpm room:dev
```

In a second shell, start the app against the room service:

```bash
NEXT_PUBLIC_EVIDENCE_ROOM_URL=http://localhost:8787 pnpm dev
```

Open `http://localhost:3000` for the buyer/agent view. Click **Show private phone QR** and scan it with any phone camera, or use **Open phone host** for another local browser context. The QR is rendered locally, remains absent until explicitly revealed, and disappears after the host joins or the demo resets. The buyer and host authenticate as different roles in one revisioned Cloudflare Durable Object room. The temporary invite travels in the URL fragment, is stored only for the browser session, and is immediately removed from address history. Treat the unscanned QR as a bearer credential: hide it after scanning and never publish a live capture of it. To exercise the deterministic no-service fallback instead, run `pnpm dev` without the environment variable; that path uses same-origin browser synchronization and retains an in-page host answer.

For the optional real-crowd proof, share the evidence requirements and open the host request first, then click **Reveal 7 private attendee invites**. Open each link in a separate browser tab/session and use its single join mutation. The buyer and host will move from `1 live · 7 fixture` to `8 live · 0 fixture`. Invite fragments are scrubbed before connection, unique credentials cannot double-count even after Durable Object hibernation, and shared snapshots contain only the aggregate count—not attendee IDs or tokens. These are authenticated test-agent sessions, not a claim that seven external people or model-driven agents participated.

The host camera is opt-in and requests video only. Camera access requires a secure context (`localhost` or HTTPS) and browser permission. A selected JPEG keyframe is fingerprinted locally with SHA-256. “Analyze” sends only that frame to the server, which recomputes the digest before an optional AI Gateway call. “Publish” intentionally adds the selected JPEG, its provenance, the reviewed visual observation, and the host's separate history attestation to synchronized page state. Site Tool results expose the provenance/review chain and whether the image is visibly published, but omit the JPEG bytes. The digest identifies bytes—it does not prove that the scene is authentic or establish repair history.

A compatible WebMCP browser will show “Site Tools live”; an ordinary browser will show “Browser fallback.”

Run the complete local quality gate:

```bash
pnpm check
```

That checks formatting, ESLint, strict TypeScript, Vitest behavior, and the production build.

The generated hold policy has a separate stable-Lean verification gate:

```bash
pnpm proof:verify
```

That builds the pinned Lean `4.33.1` project, rejects `sorryAx`, replays its theorem environment with `leanchecker --fresh`, regenerates the complete 16-case policy table, and checks the committed source receipt. The generated table is consumed at runtime for both dynamic Site Tool registration and authoritative hold acceptance; the deployed app needs no Lean runtime. See [proof/README.md](proof/README.md) for the exact theorems and trust boundary.

The owned merchant also has an opt-in network conformance check against the official released UCP `2026-08-25` JSON Schemas:

```bash
pnpm test:ucp-schema
```

That check fetches the released schemas from `ucp.dev`, recursively registers their references, and validates both the merchant business profile and direct Cart result. It is intentionally separate from the offline default gate.

### Verify a public release

The public app and both Workers expose non-secret version receipts. After deploying one reviewed commit to three distinct HTTPS origins, run:

```bash
EVIDENCE_ACCEPTANCE_APP_URL=https://app.example \
EVIDENCE_ACCEPTANCE_ROOM_ORIGIN=https://room.example \
EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN=https://merchant.example \
EVIDENCE_RELEASE_COMMIT_SHA=0123456789012345678901234567890123456789 \
pnpm release:verify
```

The verifier rejects redirects, split commits, miswired UCP discovery, protected or malformed pages, incorrect buyer/host/merchant browser policy, a host page without camera authority, a buyer page with camera authority, broken room CORS, and a room service that cannot create a real disposable Durable Object. It never logs the room credentials. See [DEPLOYMENT.md](DEPLOYMENT.md) for the current Vercel/Cloudflare release, rollback, and final-origin procedure.

### Run the native WebMCP acceptance journey

The repository pins `agent-browser` 0.35.1 and includes a credential-suppressing acceptance runner for the real system Chrome. Start the app, room Worker, and merchant Worker, expose the two Worker origins over credential-free HTTPS, then run:

```bash
EVIDENCE_ACCEPTANCE_ROOM_ORIGIN=https://room.example \
EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN=https://merchant.example \
pnpm acceptance:native
```

`EVIDENCE_ACCEPTANCE_APP_URL` defaults to `http://127.0.0.1:3000`. The runner launches a fresh named browser session with native WebMCP enabled and network access constrained to the three configured hosts. It verifies buyer reset and name-keyed dynamic tools, a separate fragment-authenticated host surface, evidence-only disclosure, native rejection of an unregistered stale tool handle, authenticated room/tool recovery after reload, host publication, an exact-quote hold, UCP negotiation, a private second-origin continuation, merchant-side inspect/cancel tools, back-navigation reconciliation, host non-disclosure, release, and final cleanup. Its output contains only step names and durations; invite and cart credentials never enter logs or failure messages.

Set `EVIDENCE_ACCEPTANCE_AUTHENTICATED_CROWD=1` to add seven separate fragment-authenticated attendee tabs. The opt-in lane uses each attendee page's native `join_shared_evidence_demand`, verifies its mutation disappears after use, asserts buyer/host/attendee session-storage isolation, proves `8 live · 0 fixture` through the buyer's native inspection, and then completes the same commerce lifecycle. The default fast path remains unchanged.

Set `EVIDENCE_ACCEPTANCE_ARTIFACT_DIR` to opt into twelve full-page milestone captures, or thirteen with the authenticated-crowd lane; optionally set `EVIDENCE_ACCEPTANCE_RECORD_VIDEO=1` for a buyer-tab continuity WebM and `EVIDENCE_ACCEPTANCE_CAPTURE_PAUSE_MS` from `0` to `5000`. Capture remains off by default. See [DEMO.md](DEMO.md) for the exact prompts, timed narration, take matrix, visual pass/fail gates, and the distinction between these deterministic artifacts and the required model-driven ChatGPT/physical-phone recording.

Chrome-format direct, ambiguous, privacy-pressure, and full multi-step model evaluations live in [evals/](evals/). A schema-drift test keeps their declared tool surfaces identical to the implementation. The corpus can be inspected without credentials today; provider-backed reports remain an explicit pre-submission gate rather than a claimed result.

## Current boundaries

- The current lot, decorative video scene, fallback host response, and hold are deterministic challenge fixtures. The camera path is real browser media capture; its automated acceptance run used Chromium's synthetic camera source rather than a physical board.
- The solo path begins with seven clearly labeled deterministic demo-room signals. Each can now be replaced one-for-one by a uniquely credentialed, least-authority attendee session. A nine-tab native-browser run reached `8 live · 0 fixture`; this proves distinct authenticated browser sessions, not seven external buyers, seven independent models, or production demand.
- The remote buyer, host, and attendee pages use separately authenticated, revisioned, idempotent Cloudflare Durable Object sessions; local browser synchronization remains a buyer/host fallback. The remote protocol, role denial, reconnect, and hibernation behavior pass, but a physical phone on a second network has not yet passed acceptance.
- The hold is reversible. No tool can bid, charge, purchase, or move money.
- Lean proves only the small public capability model: live show + ready evidence + no existing hold, plus fresh revision and exact quote for acceptance. It does not prove camera truth, seller honesty, full implementation equivalence, or that private information is impossible to infer. The judge-visible receipt states those limits, and TypeScript/native-browser tests verify the runtime adapter.
- The UCP Cart client, Durable Object credential boundary, dynamic Site Tools, human receipt UI, cancellation, and private-result purge pass against the permanent owned merchant Worker. The merchant negotiates the released UCP `2026-08-25` Cart contract and returns a schema-validated `$423` total (`$375` item + `$48` flat fulfillment); its separate SQLite Durable Object owns cart IDs, replay protection, expiry, totals, and a second-origin continuation whose native Site Tools can inspect or cancel but cannot order or pay. An isolated Shopify preview separately proves Shopify's currently observed UCP `2026-04-08` discovery and native WebMCP registration; its unsaved catalog/cart execution and password-gated stable origin keep it additive rather than critical-path.
- The typed core flow is verified in isolated Chrome and ChatGPT desktop's native in-app Browser. A clean-room runner repeats the complete two-client, cross-origin commerce lifecycle in native Chrome 151 with credential-suppressed logs, and the same journey passes against the permanent public Vercel and Cloudflare origins. A fresh model-driven ChatGPT rerun remains a submission freeze gate. Realtime voice transport, transcription, and Voice-to-Codex delegation work, but the delegated task did not inherit the UI-owned Browser binding, so autonomous Voice-to-Site-Tools remains unproven.
- Host camera capture, cleanup, bounded keyframe provenance, selected-frame publication, explicit host review, remote propagation, native WebMCP inspection, stale-quote refusal, exact-quote hold, release, and Worker restart recovery pass. Vercel OIDC and AI Gateway also returned a real structured vision proposal from `alibaba/qwen3.7-flash` with zero-data-retention routing; it correctly classified Chromium's synthetic green test pattern as not showing a snowboard, and the saved review could not be published as qualifying evidence. Authenticity verification, continuous-video analysis, a rights-cleared physical product, and physical-phone acceptance are not claimed.
- The stable Vercel judge origin is public without authentication, both permanent Cloudflare Workers are live, and the atomic release verifier rejects any redirect, split commit, broken room boundary, or miswired UCP profile. The source is public at [github.com/mkwatson/webmcp-evidence-market](https://github.com/mkwatson/webmcp-evidence-market) with GitHub-detected MIT licensing.
- No private Vidably or math research is included in the public worktree.

Read [SUBMISSION.md](SUBMISSION.md) for the judge instructions, four required Devpost answers, proof matrix, claims ledger, and final freeze; [DEMO.md](DEMO.md) for the timed capture/voiceover packet; [DEPLOYMENT.md](DEPLOYMENT.md) for the public release and rollback gates; [EXPERIMENTS.md](EXPERIMENTS.md) for the 18-primitives frontier and falsification results; [concepts/live-agent-market.md](concepts/live-agent-market.md) for the product ladder; [evals/](evals/) for the current Chrome-format evaluation corpus; [RESOURCES.md](RESOURCES.md) for exact-runtime evidence; [SPONSOR-PRODUCTS.md](SPONSOR-PRODUCTS.md) for the sponsor atlas; and [STRATEGY.md](STRATEGY.md) for the winning-probability framework.
