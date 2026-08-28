# WebMCP evaluation corpus

These fixtures use Chrome Labs' current `webmcp-evals` format and exercise the product that is actually submitted:

- `evidence-initial-tools.json` is an exact checked-in projection of the three Site Tools available on first load.
- `evidence-initial-evals.json` tests read-only inspection, arbitrary-product intake, privacy minimization, and mission creation against that static frontier.
- `browser-journey-evals.json` tests the live dynamic shopper page. Its hero trajectory opens an arbitrary product case, searches existing evidence, creates a filming mission, creates a bounded phone handoff, and explicitly publishes only the public mission fields. Separate cases require search before a private-only handoff and read-only inspection.
- `product-page-initial-tools.json` and `product-page-reviewed-tools.json` are exact projections of the product page before and after reviewed evidence. They make the disappearing handoff and replacement evidence inspector independently auditable.
- `product-page-journey-evals.json` is a live cross-document trajectory: inspect the authored-claim boundary, execute the page-owned case navigation, then inspect the newly loaded evidence case through its own tools.
- `product-page-reviewed-evals.json` checks that the resolved page returns timestamped reviewed evidence without requesting another recording and still distinguishes the authored claim from proof.

`src/lib/evidence-network/webmcp-evals.test.ts` rejects schema drift in all three static frontiers, unknown tool names, private test material in expected arguments, public recruitment without a distinct confirmation call, private handoff without search first, and a reviewed page that still expects the stale handoff.

## Current source and published package

Checked August 28, 2026:

- Chrome Labs `main` is [`d39eae4`](https://github.com/GoogleChromeLabs/webmcp-tools/commit/d39eae4bd51e8c12736b8cae840bd98f190f3179). It provides `local`, `browser`, and credential-free `smoke` commands under `webmcp-evals/`.
- npm still publishes `webmcp-evals@0.0.3` from July 17. It provides `local` and `browser`, but not the newer `smoke` command.

Do not vendor Chrome Labs' dependency tree into this repository. Build the reviewed source revision in an isolated checkout when running the deterministic smoke:

```bash
git clone https://github.com/GoogleChromeLabs/webmcp-tools.git /tmp/webmcp-tools
git -C /tmp/webmcp-tools checkout d39eae4bd51e8c12736b8cae840bd98f190f3179
npm --prefix /tmp/webmcp-tools/webmcp-evals ci
npm --prefix /tmp/webmcp-tools/webmcp-evals run build
node /tmp/webmcp-tools/webmcp-evals/dist/bin/webmcp-evals.js smoke \
  --chrome-channel chrome \
  --url http://localhost:3000 \
  --evals evals/browser-journey-evals.json

node /tmp/webmcp-tools/webmcp-evals/dist/bin/webmcp-evals.js smoke \
  --chrome-channel chrome \
  --url http://localhost:3000/demo-product \
  --evals evals/product-page-journey-evals.json
```

The app and evidence Worker must already be running with `NEXT_PUBLIC_EVIDENCE_ROOM_URL` pointing at the Worker. Each case receives a fresh browser page. The current source polls the dynamic registry between authored calls and treats an unavailable tool or a tool-reported error as a failing step.

Keep the state-changing smoke on the isolated local fixture. Do not add `--verbose` against a public origin: the bounded phone-link tool intentionally returns a case-scoped bearer URL to the agent, and verbose evaluator output would print it. Final-origin automation uses the non-logging release verifier and the non-mutating product-page canary; interactive phone capabilities stay inside the browser session.

## Optional model-driven evaluation

Only run this when an already-authorized provider and budget are available:

```bash
npx --yes webmcp-evals@0.0.3 local \
  --tools evals/evidence-initial-tools.json \
  --evals evals/evidence-initial-evals.json

npx --yes webmcp-evals@0.0.3 local \
  --tools evals/product-page-initial-tools.json \
  --evals evals/product-page-journey-evals.json

npx --yes webmcp-evals@0.0.3 local \
  --tools evals/product-page-reviewed-tools.json \
  --evals evals/product-page-reviewed-evals.json

npx --yes webmcp-evals@0.0.3 browser \
  --url http://localhost:3000 \
  --evals evals/browser-journey-evals.json
```

The reviewed product-page browser corpus requires a real matching D1 record and must run only after the rights-clean phone/review flow has published one. The static local corpus can evaluate tool selection before that record exists; it does not pretend the after-state is live.

The published `local` and `browser` commands can write a JSON report while exiting successfully even when every result is an error. Process exit alone is not evidence of a pass. Require all counters to be clean:

```bash
jq -e '
  .results.errorCount == 0 and
  .results.failCount == 0 and
  .results.passCount == (.results.results | length)
' .evals/report-*.json
```

An unavailable model, rate limit, or provider-authentication failure is infrastructure evidence, not a model-selection score. The repository's credential-free `pnpm acceptance:evidence-network` remains the broader deterministic authority because it also covers the public mission board, a separate contributor context, video review/correction, answer change, and later-shopper evidence reuse. Chrome Labs smoke is independent WebMCP corroboration, not a replacement.
