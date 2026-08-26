# WebMCP native runtime smoke probe

This deliberately tiny page distinguishes the current draft API from the exact installed browser behavior. It is research evidence, not product code and not a substitute for the full human-in-the-loop acceptance matrix in [RESOURCES.md](../../RESOURCES.md).

## Run locally

Start the page from the repository root:

```sh
pnpm exec vite research/webmcp-runtime-smoke --host 127.0.0.1 --port 4173
```

In a separate terminal, run Chrome with a fresh profile. The feature name below is the native feature behind `chrome://flags/#enable-webmcp-testing` in Chrome 151:

```sh
webmcp_profile_dir=$(mktemp -d /tmp/webmcp-chrome.XXXXXX)
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --headless=new \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir="$webmcp_profile_dir" \
  --enable-features=WebMCP \
  --virtual-time-budget=3000 \
  --dump-dom \
  http://127.0.0.1:4173/
```

Run the same command without `--enable-features=WebMCP` as a negative control. Move the generated profile to Trash afterward.

## Observed on 2026-08-26 PT

Chrome 151.0.7922.174 with the feature enabled produced this result:

```json
{
  "modelContext": true,
  "apiShape": {
    "registerToolLength": 1,
    "getToolsLength": 0,
    "executeToolLength": 2,
    "registrationReturnedPromise": true,
    "callbackSecondArgument": "undefined"
  },
  "toolNames": ["add_numbers"],
  "objectExecution": {
    "ok": false,
    "error": "Failed to parse input arguments"
  },
  "stringExecution": {
    "ok": true,
    "output": "{\"content\":[{\"type\":\"text\",\"text\":\"42\"}],\"structuredContent\":{\"sum\":42}}"
  }
}
```

Without the feature enabled, the result was `{"modelContext":false}`.

This confirms a Chrome 151/current-draft skew in the in-page consumer API and callback options. Re-run rather than preserving the observation as a permanent compatibility assumption.
