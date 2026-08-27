# WebMCP evaluation corpus

These fixtures follow Chrome's current `webmcp-evals` format and deliberately separate two questions:

- `buyer-initial-tools.json` plus `buyer-initial-evals.json` test tool selection from the complete initial state, including direct, ambiguous, and over-disclosure prompts.
- `browser-journey-evals.json` tests the live page, where tools appear and disappear as the agent advances. Its golden path ends at the human host boundary and explicitly stops before a hold.

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

The Chrome Labs repository already contains a newer `smoke` command than the currently published `0.0.3` package. Do not assume an unpublished command exists: re-read the upstream README and package version before each run. The repository's credential-free `pnpm acceptance:native` runner remains the authoritative deterministic end-to-end test because it also coordinates the separate host and merchant origins.
