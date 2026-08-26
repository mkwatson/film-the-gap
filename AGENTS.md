# WebMCP Challenge project instructions

These instructions apply to the entire repository.

## Strategic priority

- Maximize the probability of winning the OpenAI WebMCP Challenge.
- UCP, Lean, Vidably, and video-AI work are optional advantages, not requirements. Use them only when they make the winning product thesis stronger.
- Err on the side of wild ambition, delivered as cumulative end-to-end rungs. Keep the latest completed rung working while adding the next one.
- Strategically maximize judge-product leverage when a judge's product, protocol, or platform can materially strengthen the product. Prefer one deep, novel, demonstrable use over several shallow integrations.
- Choose one coherent primary hosting/runtime path. Judge affiliation can raise the strategic value of an otherwise strong integration, but it cannot substitute for product fit, rubric value, compatibility, or reliability.
- Read [STRATEGY.md](STRATEGY.md), [JUDGES.md](JUDGES.md), [RULES.md](RULES.md), [RESOURCES.md](RESOURCES.md), and [PLATFORMS.md](PLATFORMS.md) before concept selection or a material architecture decision.
- Descriptive concept labels are not project names. The official FAQ explicitly says not to use AI to name the entry; Mark chooses the submitted name.
- Never copy private Vidably, video-foundational-research, or math research into the public challenge repository without Mark explicitly clearing the exact material and its licenses. Local-only notes use the ignored `*.private.md` suffix.

## Retrieval-led, current-documentation rule

Do not rely on training memory for WebMCP, ChatGPT Site Tools, Chrome, UCP, Next.js, React, TypeScript, deployment vendors, AI/media vendors, or third-party packages.

Before selecting, adding, upgrading, or materially using an integration:

1. Read the current first-party specification or vendor documentation in the same working turn.
2. Read current release notes and registry metadata when versions or compatibility matter.
3. Prefer documentation matched to the installed version when the package supplies it.
4. Check peer and runtime compatibility across the complete stack; "latest" means the newest cohesive, proven set, not every package's largest version number independently.
5. Pin challenge-critical dependencies exactly and prove the matrix with formatting/linting, strict type checking, tests, and a production build.
6. Record the check date, selected version or dated specification, source links, discrepancies, and relevant decision in the appropriate living research document.
7. Recheck at every integration boundary and again before the judged demo. This project is being built against fast-moving prerelease standards.

Authority order when sources conflict:

1. The exact judged runtime, tested directly: ChatGPT's current built-in browser and Site Tools behavior.
2. The current WebMCP Community Group draft and current OpenAI/Chrome first-party documentation.
3. Current vendor specifications, release notes, registries, source code, and tests.
4. Current library documentation.
5. Existing project prose.
6. Model memory.

Record and resolve conflicts explicitly. A recent secondary post is not authoritative merely because it is recent. For example, an August 25, 2026 partner post still shows the former `navigator.modelContext` surface, while the current draft, Chrome documentation, and OpenAI examples use `document.modelContext`.

The [official Devpost resources page](https://webmcp.devpost.com/resources) is the challenge-specific research checklist. Read every substantive link it adds, record it in [RESOURCES.md](RESOURCES.md), and recheck the page for changes. Its directions to test in ChatGPT's in-app browser and Chrome are separate acceptance gates; reading documentation, running a polyfill, or invoking a testing shim cannot satisfy either gate.

## Current WebMCP baseline — revalidate before use

As checked against the 2026-08-26 draft:

- The target surface is `document.modelContext`; use the native API as the source of truth.
- Tool availability can follow live page state. Keep each tool narrow, non-overlapping, and visibly reflected in the human UI.
- Use safety annotations accurately, including `readOnlyHint` and `untrustedContentHint` where applicable.
- Preserve the site's existing authentication, authorization, validation, and confirmation boundaries.
- Test direct and ambiguous tool-selection prompts, corrections, cancellations, stale state, failure recovery, and end-to-end action sequences.
- ChatGPT treats tool definitions and outputs as untrusted and safety-reviews calls. Messages, purchases, deletions, and permission changes may require confirmation.
- The current native execute callback receives `(input, { signal })`, and `registerTool` is asynchronous. Await registration and propagate cancellation in challenge-critical code.
- Chrome 151.0.7922.174 currently lags that draft in the tested native consumer path: it expects JSON-string input for in-page `executeTool` and supplies no second execute-callback argument. Preserve current provider semantics, but guard this exact runtime boundary and re-test rather than assuming convergence.
- Current helper-package types are not automatically authoritative. Audit their installed declarations and runtime source against the same-day draft before use.
- Do not report ChatGPT or Chrome compatibility until the exact current build has completed the recorded runtime matrix in [RESOURCES.md](RESOURCES.md).

Primary references:

- [OpenAI Site Tools](https://learn.chatgpt.com/docs/webmcp)
- [WebMCP draft](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome WebMCP best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Chrome WebMCP evals](https://developer.chrome.com/docs/ai/webmcp/evals)
- [Chrome agent security](https://developer.chrome.com/docs/agents/security)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
