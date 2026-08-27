# WebMCP evaluation corpus

These fixtures follow Chrome's current `webmcp-evals` format and deliberately separate two questions:

- `buyer-initial-tools.json` plus `buyer-initial-evals.json` test tool selection from the complete initial state, including direct, ambiguous, and over-disclosure prompts.
- `browser-journey-evals.json` tests the live page, where tools appear and disappear as the agent advances. Its golden path ends at the human host boundary and explicitly stops before a hold.

## Published package

With model-provider credentials configured, run the published Chrome Labs CLI locally:

```bash
npx --yes webmcp-evals@0.0.3 local \
  --tools evals/buyer-initial-tools.json \
  --evals evals/buyer-initial-evals.json
```

Run the model-driven live-browser corpus against a started app with:

```bash
npx --yes webmcp-evals@0.0.3 browser \
  --url http://127.0.0.1:3000 \
  --evals evals/browser-journey-evals.json
```

The latest published package was still `webmcp-evals@0.0.3` on August 27, 2026. Its `local` and `browser` commands can write a JSON report while exiting successfully even when every result has `outcome: "error"`. Never treat the process exit alone as an evaluation pass. Require all three counters to be clean, for example:

```bash
jq -e '
  .results.errorCount == 0 and
  .results.failCount == 0 and
  .results.passCount == (.results.results | length)
' .evals/report-*.json
```

An unavailable model, rate limit, or provider-authentication failure is evaluation infrastructure evidence—not a model-selection failure.

## Latest source smoke

Chrome Labs main at [`d39eae4`](https://github.com/GoogleChromeLabs/webmcp-tools/commit/d39eae4bd51e8c12736b8cae840bd98f190f3179) contains an unpublished `smoke` command, multi-step trajectories, browser console-error capture, and report analysis. The exact source revision built in an isolated temporary checkout and passed this live corpus in Chrome 151:

```text
5/5 expected Site Tool steps across 3 cases
```

That run independently discovered and executed `inspect_live_show`, `set_evidence_requirements`, and the dynamically appearing `request_host_evidence` through the page. It also passed the explicit-private-ceiling case because the invoked schema carried only the four product-evidence fields. Do not copy the temporary upstream dependency tree into this repository: its isolated `npm audit` reported one high and one moderate transitive vulnerability.

The repository's credential-free `pnpm acceptance:native` runner remains the authoritative deterministic end-to-end test because it also coordinates the separately authenticated host, authoritative room, hold, merchant origin, UCP Cart, cancellation, reload, stale-handle rejection, and private-material assertions. The Chrome Labs smoke is valuable independent corroboration, not a replacement.
