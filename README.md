# WebMCP Challenge evidence-directed live market

This repository is the challenge-period research and implementation workspace for a live market where people and their private agents can gather missing physical evidence together. The label above is descriptive, not a proposed submission name.

The current rung proves one complete, privacy-minimizing collaboration loop:

1. The buyer keeps their profile and maximum price inside their personal agent.
2. The agent shares only four product-evidence requirements with the open page.
3. The page evaluates the live lot and exposes only the tools meaningful in that state.
4. The agent joins seven anonymous demo agents waiting for the same missing fact.
5. The host can explicitly start a video-only camera and capture one bounded keyframe. Vercel AI Gateway can propose a pixel-grounded observation, but the host must accept or correct it; a manual review path remains available.
6. The host deliberately publishes that one selected JPEG, its provenance, the reviewed visual observation, and a separate repair-history attestation. One answer resolves all eight requests without revealing profiles, budgets, or the continuous camera feed.
7. A reversible reservation tool appears and accepts only the exact current all-in quote.
8. In an authoritatively configured room, the hold unlocks a reversible anonymous UCP merchant cart. Shared state receives bounded merchant-authored terms; only the invoking buyer receives the private continuation.
9. The page can cancel the merchant cart, discard its credential, release the hold, and keeps equivalent human controls visible throughout.

The seller-facing page does not receive a buyer ceiling. That is a concrete data-minimization boundary, not a claim that all statistical inference is impossible. The app uses direct native `document.modelContext.registerTool` calls. Human controls invoke the same domain transitions, so the experience remains complete in an ordinary browser.

The first screen includes a budget-free agent starter and a live preflight for native WebMCP, the evidence room, seller-phone presence, and the UCP merchant. Give ChatGPT the actual maximum in conversation, then copy the product-only starter; the page has no budget or identity input.

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

Open `http://localhost:3000` for the buyer/agent view. Use its private host invite to open `/host` in a second browser context. The buyer and host authenticate as different roles in one revisioned Cloudflare Durable Object room. The invite token travels in the URL fragment, is stored only for the browser session, and is immediately removed from address history. To exercise the deterministic no-service fallback instead, run `pnpm dev` without the environment variable; that path uses same-origin browser synchronization and retains an in-page host answer.

The host camera is opt-in and requests video only. Camera access requires a secure context (`localhost` or HTTPS) and browser permission. A selected JPEG keyframe is fingerprinted locally with SHA-256. “Analyze” sends only that frame to the server, which recomputes the digest before an optional AI Gateway call. “Publish” intentionally adds the selected JPEG, its provenance, the reviewed visual observation, and the host's separate history attestation to synchronized page state. Site Tool results expose the provenance/review chain and whether the image is visibly published, but omit the JPEG bytes. The digest identifies bytes—it does not prove that the scene is authentic or establish repair history.

A compatible WebMCP browser will show “Site Tools live”; an ordinary browser will show “Browser fallback.”

Run the complete local quality gate:

```bash
pnpm check
```

That checks formatting, ESLint, strict TypeScript, Vitest behavior, and the production build.

## Current boundaries

- The current lot, decorative video scene, fallback host response, and hold are deterministic challenge fixtures. The camera path is real browser media capture; its automated acceptance run used Chromium's synthetic camera source rather than a physical board.
- The seven other audience agents are a clearly labeled deterministic demo-room aggregate, not simulated individual buyers or a live backend.
- The remote buyer and host pages use separately authenticated, revisioned, idempotent Cloudflare Durable Object sessions; local browser synchronization remains a fallback. The remote protocol and reconnect behavior pass between two browser clients, but a physical phone on a second network has not yet passed acceptance.
- The hold is reversible. No tool can bid, charge, purchase, or move money.
- The UCP Cart client, Durable Object credential boundary, dynamic Site Tools, human receipt UI, cancellation, and private-result purge now pass against an owned original-product merchant over local/tailnet HTTPS. Its separate SQLite Durable Object owns cart IDs, replay protection, expiry, totals, and a second-origin continuation whose native Site Tools can inspect or cancel but cannot order or pay. An isolated Shopify preview separately proves current Shopify UCP discovery and native WebMCP registration; its unsaved catalog/cart execution and password-gated stable origin keep it additive rather than critical-path. Public deployment of the owned merchant still needs one-time Cloudflare account/terms authorization and a fresh acceptance run.
- The typed core flow is verified in isolated Chrome and ChatGPT desktop's native in-app Browser. The current compact tool surface additionally passes native Chrome 151 over public HTTPS; it still needs a fresh model-driven ChatGPT rerun. Realtime voice transport, transcription, and Voice-to-Codex delegation work, but the delegated task did not inherit the UI-owned Browser binding, so autonomous Voice-to-Site-Tools remains unproven.
- Host camera capture, cleanup, bounded keyframe provenance, selected-frame publication, explicit host review, remote propagation, native WebMCP inspection, stale-quote refusal, exact-quote hold, release, and Worker restart recovery pass. Vercel OIDC and AI Gateway also returned a real structured vision proposal from `alibaba/qwen3.7-flash` with zero-data-retention routing; it correctly classified Chromium's synthetic green test pattern as not showing a snowboard, and the saved review could not be published as qualifying evidence. Authenticity verification, continuous-video analysis, a rights-cleared physical product, and physical-phone acceptance are not claimed.
- A protected Vercel acceptance preview and disposable Cloudflare Worker have passed the public HTTPS journey. They are not yet the final judge URL: the Worker is temporary, and Vercel Authentication must not redirect a fragment-bearing host invite. There is no public repository remote yet.
- No private Vidably or math research is included in the public worktree.

Read [EXPERIMENTS.md](EXPERIMENTS.md) for the 18-primitives frontier and falsification results, [concepts/live-agent-market.md](concepts/live-agent-market.md) for the product ladder, [RESOURCES.md](RESOURCES.md) for exact-runtime evidence, [SPONSOR-PRODUCTS.md](SPONSOR-PRODUCTS.md) for the sponsor atlas, and [STRATEGY.md](STRATEGY.md) for the winning-probability framework.
