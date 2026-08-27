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
8. The page attributes the hold and keeps a human release control visible.

The seller-facing page does not receive a buyer ceiling. That is a concrete data-minimization boundary, not a claim that all statistical inference is impossible. The app uses direct native `document.modelContext.registerTool` calls. Human controls invoke the same domain transitions, so the experience remains complete in an ordinary browser.

## Run locally

Requirements: Node.js 24 or newer and pnpm 11.6.0.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` for the buyer/agent view. Open `http://localhost:3000/host` in a second same-origin tab for the progressive host view. The two pages synchronize the request and answer locally; the buyer page retains an in-page host control, so the complete fallback never requires a second tab.

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
- The separate host view currently uses same-origin browser synchronization. It proves the two-surface interaction and recovery contract, not a networked phone/desktop room.
- The hold is reversible. No tool can bid, charge, purchase, or move money.
- The full typed core flow is verified in isolated Chrome and ChatGPT desktop's native in-app Browser. Realtime voice transport, transcription, and Voice-to-Codex delegation work, but the delegated task did not inherit the UI-owned Browser binding, so autonomous Voice-to-Site-Tools remains unproven. Repeated navigation/reconnect, Mark's normal Chrome profile, and an MBP clean-room run remain explicit gates.
- Host camera capture, cleanup, bounded keyframe provenance, selected-frame publication, explicit host review, two-tab propagation, native WebMCP inspection, exact-quote hold, and release pass locally. The AI SDK 7 / AI Gateway route is implemented with current GPT-5.6 Sol → Terra → Luna fallback configuration and tested against a mocked model result; the authenticated live model call remains an acceptance gate because this local project is not linked and has no Gateway credential. Authenticity verification, continuous-video analysis, and real cross-device transport are not claimed.
- There is no public deployment or repository remote yet.
- No private Vidably or math research is included in the public worktree.

Read [EXPERIMENTS.md](EXPERIMENTS.md) for the 18-primitives frontier and falsification results, [concepts/live-agent-market.md](concepts/live-agent-market.md) for the product ladder, [RESOURCES.md](RESOURCES.md) for exact-runtime evidence, [SPONSOR-PRODUCTS.md](SPONSOR-PRODUCTS.md) for the sponsor atlas, and [STRATEGY.md](STRATEGY.md) for the winning-probability framework.
