# WebMCP Challenge evidence-directed live market

This repository is the challenge-period research and implementation workspace for a live market where people and their private agents can gather missing physical evidence together. The label above is descriptive, not a proposed submission name.

The current rung proves one complete, privacy-minimizing collaboration loop:

1. The buyer keeps their profile and maximum price inside their personal agent.
2. The agent shares only four product-evidence requirements with the open page.
3. The page evaluates the live lot and exposes only the tools meaningful in that state.
4. The agent joins seven anonymous demo agents waiting for the same missing fact.
5. One visible host answer resolves all eight requests without revealing profiles or budgets.
6. A reversible reservation tool appears and accepts only the exact current all-in quote.
7. The page attributes the hold and keeps a human release control visible.

The seller-facing page does not receive a buyer ceiling. That is a concrete data-minimization boundary, not a claim that all statistical inference is impossible. The app uses direct native `document.modelContext.registerTool` calls. Human controls invoke the same domain transitions, so the experience remains complete in an ordinary browser.

## Run locally

Requirements: Node.js 24 or newer and pnpm 11.6.0.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. A compatible WebMCP browser will show “Site Tools live”; an ordinary browser will show “Browser fallback.”

Run the complete local quality gate:

```bash
pnpm check
```

That checks formatting, ESLint, strict TypeScript, Vitest behavior, and the production build.

## Current boundaries

- The current lot, video scene, host response, and hold are deterministic challenge fixtures.
- The seven other audience agents are a clearly labeled deterministic demo-room aggregate, not simulated individual buyers or a live backend.
- The hold is reversible. No tool can bid, charge, purchase, or move money.
- Native isolated-browser execution is verified, but the connected ChatGPT in-app Browser/Voice matrix and Mark's normal Chrome 151 profile remain explicit acceptance gates.
- There is no public deployment or repository remote yet.
- No private Vidably or math research is included in the public worktree.

Read [EXPERIMENTS.md](EXPERIMENTS.md) for the 18-primitives frontier and falsification results, [concepts/live-agent-market.md](concepts/live-agent-market.md) for the product ladder, [RESOURCES.md](RESOURCES.md) for exact-runtime evidence, [SPONSOR-PRODUCTS.md](SPONSOR-PRODUCTS.md) for the sponsor atlas, and [STRATEGY.md](STRATEGY.md) for the winning-probability framework.
