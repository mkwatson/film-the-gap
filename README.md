# WebMCP Challenge walking skeleton

This repository is the challenge-period research and implementation workspace for an evidence-directed live market. The label above is descriptive, not a proposed submission name.

The current rung proves one complete collaboration loop:

1. A buyer or agent shares five bounded constraints with the open page.
2. The page evaluates the live lot and exposes only tools meaningful in that state.
3. The agent asks the host for one missing physical fact.
4. A visible host answer changes the evidence state.
5. A reversible reservation tool appears only after every disclosed constraint is supported.
6. The page attributes the hold and keeps a human release control visible.

The app uses direct native `document.modelContext.registerTool` calls. Human controls invoke the same domain transitions, so the experience remains complete in an ordinary browser.

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
- The hold is reversible. No tool can bid, charge, purchase, or move money.
- Native isolated-browser execution is verified, but the connected ChatGPT in-app Browser/Voice matrix and Mark's normal Chrome 151 profile remain explicit acceptance gates.
- There is no public deployment or repository remote yet.
- No private Vidably or math research is included in the public worktree.

Read [concepts/live-agent-market.md](concepts/live-agent-market.md) for the product ladder, [RESOURCES.md](RESOURCES.md) for exact-runtime evidence, [SPONSOR-PRODUCTS.md](SPONSOR-PRODUCTS.md) for the sponsor atlas, and [STRATEGY.md](STRATEGY.md) for the winning-probability framework.
