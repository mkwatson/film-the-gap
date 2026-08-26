# Official resource ledger and runtime gates

Last full pass: 2026-08-26 PT. The [official Devpost resources page](https://webmcp.devpost.com/resources) is the challenge-specific checklist; the [Official Rules](https://webmcp.devpost.com/rules) control when sources conflict. Recheck both pages because the draft standard, supporter material, FAQ, and browser implementations are moving during the challenge.

At the last same-day refresh, Devpost showed 1,717 participants and no published project gallery. The live count is context, not a selection metric; it reinforces the need for a structurally memorable interaction and a judge-legible deterministic path.

## Current status

| Requirement                                                            | Status                                                      | Evidence or blocker                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read the official resources page                                       | Complete for the 2026-08-26 page                            | Every substantive documentation and supporter link below was opened and assessed; optional credits, account creation, Discord, forms, and publishing actions were not performed.                                                                                             |
| Read the current WebMCP specification and first-party browser guidance | Complete for the 2026-08-26 draft/docs                      | The current surface is `document.modelContext`; see findings below.                                                                                                                                                                                                          |
| Test in ChatGPT's in-app browser                                       | **Blocked on connected target; not yet tested**             | On 2026-08-26 the installed Browser capability reported no available in-app Browser target. Documentation review is not a substitute. Connect the latest desktop app, use GPT-5.6 Sol or Terra, and run the matrix below.                                                    |
| Test in Chrome with WebMCP enabled                                     | **Native app flow complete; latest-profile retest pending** | The full walking skeleton passed native discovery, execution, and dynamic registration in isolated Headless Chrome 150; an isolated Chrome 151 fixture separately proved the latest runtime boundary. Live control of Mark's normal Chrome 151 profile is still unavailable. |

Never collapse those last two rows into a generic "browser tested" claim. ChatGPT Site Tools add their own discovery, trust review, confirmations, tool lifetime, and model behavior on top of the browser implementation.

## Autonomous verification enablement

Read-only checks on 2026-08-26 found:

- Google Chrome 151.0.7922.174 is installed and running.
- The ChatGPT Chrome Extension is installed and enabled in the selected Chrome profile.
- Its native messaging bridge manifest is present and correctly authorizes the extension.
- Live communication from this session still failed after the prescribed retry. The next supported recovery is opening a fresh window in that selected profile with Mark's permission, retrying once, and reinstalling the Chrome plugin from ChatGPT's plugin UI only if communication still fails.
- No controllable ChatGPT in-app Browser target is currently exposed. Chrome can cover the separate native Chrome acceptance gate; it cannot substitute for ChatGPT Site Tools or prove Voice-to-Site-Tools composition.
- Even after the in-app Browser is connected, starting a Voice session and supplying microphone audio may require one short human action unless a supported desktop-control/audio path is exposed. The rest of the task, state inspection, screenshots, and result recording should be automated.

The minimum enablement objective is therefore not broad machine access. It is two narrow, reviewable capabilities: a connected ChatGPT in-app Browser target for the live URL and a connected Chrome profile for the independent native-runtime matrix. Keep microphone/camera actions explicit and scoped to the demo.

### Current capability inventory

| Capability                         | Ready now                                                                                                                                                        | Gap or next action                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local implementation and tests     | Node 26.3.1, pnpm 11.6.0, strict TypeScript, Vitest, Next.js production builds, and isolated browser automation.                                                 | None for the deterministic rung.                                                                                                                                                |
| Native WebMCP lab                  | Isolated Headless Chrome 150 completes Rung 2's native provider/consumer loop; isolated installed Chrome 151 proves positive and negative feature gates.         | Connect Mark's normal Chrome 151 profile for interactive DevTools and extension evidence.                                                                                       |
| ChatGPT Site Tools                 | Current first-party docs and exact acceptance plan are available.                                                                                                | Expose a controllable in-app Browser target, then open the app with GPT-5.6 Sol or Terra.                                                                                       |
| Voice, audio, and media processing | FFmpeg/ffprobe 9.0.1 are installed; page-owned audio can be tested in normal browser code later.                                                                 | One human microphone action may remain necessary for ChatGPT Voice; no supported desktop audio-injection path is exposed in this session.                                       |
| Git and GitHub                     | GitHub CLI and the GitHub connector are authenticated; local challenge-period history is intact.                                                                 | This repository has no remote. Creating a public repository or pushing remains an explicit external action for Mark to approve.                                                 |
| Vercel                             | Vercel connector has deployment, logs, runtime-error, project, documentation, and Agent Run access; CLI is authenticated.                                        | Installed CLI 54.14.2 advertises 59.5.0. Prefer the current connector now and update/pin the CLI only when a selected workflow needs it. No deployment without Mark's approval. |
| Cloudflare                         | Current product/docs research is available and ordinary web access works.                                                                                        | No Wrangler CLI or Cloudflare credential is exposed locally. Add a current project-pinned Wrangler/OAuth path only if the Cloudflare architecture branch wins a concrete spike. |
| Formal verification                | Elan is installed; the local `math/deliverable` sibling project pins and successfully runs Lean 4.27.0, Lake 5.0.0, and a specific mathlib revision.             | There is intentionally no global default toolchain. Reuse an isolated challenge proof project when a visible invariant earns this rung.                                         |
| Cloud and data tooling             | Google Cloud SDK, AWS CLI, PostgreSQL 18.4, SQLite 3.51, Python 3.14, uv 0.11.21, Deno 2.9.3, ImageMagick 7.1.2, and current web research are locally available. | Authenticate or add services only for a selected load-bearing capability; broad credential installation now would increase risk without improving the golden path.              |

The operating rule is capability-on-demand: keep current docs and deterministic local verification universal, then connect the narrow deployment, media, commerce, or proof capability required by the next experiment. Installing every sponsor CLI up front would not make the agent meaningfully more autonomous; connected judged-client control does.

## Historical Rung 1 native run

On 2026-08-26 PT, revision worktree before the first feature commit passed a complete native WebMCP loop at `http://localhost:3000` in agent-browser's isolated Headless Chrome 150.0.0.0 runtime:

1. The page registered and the browser discovered only `inspect_live_show`, `set_buying_mandate`, and `inspect_current_lot` initially.
2. Native `executeTool` invoked `set_buying_mandate`; the visible page became unresolved and `request_host_evidence` appeared.
3. Native `executeTool` invoked the evidence request; the request appeared in the visible host queue and that now-redundant tool disappeared.
4. The visible host control disclosed no repair; the final condition became supported and `reserve_current_lot` appeared.
5. Native `executeTool` created an agent-attributed reversible hold; `reserve_current_lot` disappeared and `release_current_lot` replaced it.

The same run verified desktop and 390 px layouts, meaningful accessibility snapshots, no framework error overlay, no recorded page errors, no horizontal mobile overflow, and no console errors beyond development notices. Formatting, ESLint, strict TypeScript, 12 Vitest behaviors, and the Next.js 16.3.3 production build also passed.

This is stronger than a polyfill or handler-only test, but it is still supplementary: it does not prove Mark's current Chrome 151 profile, model-driven tool selection, ChatGPT's trust/confirmation layer, or Voice-to-Site-Tools composition. Those remain explicit gates below.

## Rung 2 native product run

On 2026-08-26 PT, the privacy-membrane worktree passed the full product flow in agent-browser's native isolated Headless Chrome 150.0.0.0 runtime:

1. The browser discovered exactly `inspect_live_show`, `set_evidence_requirements`, and `inspect_current_lot` initially.
2. Native `executeTool` set four product-evidence requirements. The page showed a privacy receipt, no buyer ceiling appeared in the page or result, and `request_host_evidence` registered.
3. Native execution queued repair-history evidence. Seven anonymous demo signals became eight queued requests and the redundant request tool disappeared.
4. One visible host answer changed the aggregate to eight resolved requests and registered `reserve_current_lot`.
5. A stale `$400` call against the public `$423` all-in quote was refused without a hold and returned the exact recovery action.
6. An exact `$423` call created the attributed hold; reserve disappeared and `release_current_lot` replaced it.
7. Native release restored the valid pre-hold tool surface.

The ordinary-browser UI completed the corresponding share → request → answer → hold → release flow. Desktop and 390 px checks showed no framework error overlay or horizontal overflow. Fresh profiles in the installed Chrome 151.0.7922.174 rendered `Site Tools live` with `--enable-features=WebMCP` and `Browser fallback` with the feature disabled.

Strict schema tests reject a supplied `maxAllInPrice`; recursive contract tests reject forbidden private-value fields in registered definitions and snapshots. Data minimization does not prove zero statistical inference. The seven other agents are a transparent deterministic fixture, not a live room. Exact ChatGPT, model-driven selection, normal-profile Chrome, navigation lifecycle, and Voice-to-Site-Tools acceptance remain pending.

## Official documentation

| Resource                                                                                 | Read | Decision-useful result                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [WebMCP specification repository](https://github.com/webmachinelearning/webmcp)          |  Yes | Canonical source, explainers, Web Platform Tests, and open issues. The API is changing quickly enough that same-day source checks matter.                                                                                                                                                                                                      |
| [Current rendered WebMCP draft](https://webmachinelearning.github.io/webmcp/)            |  Yes | Draft dated August 26, 2026. Native surface is `document.modelContext`; registration is async; execute receives an `AbortSignal`; tool names are 1–128 restricted ASCII characters; `title`, annotations, cross-document exposure, cancellation, and `toolchange` are specified. Declarative execution still contains open specification work. |
| [Chrome WebMCP developer documentation](https://developer.chrome.com/docs/ai/webmcp)     |  Yes | Chrome 149 origin trial and local flag, origin isolation, permissions policy, imperative and declarative APIs, and visible human-in-the-loop behavior.                                                                                                                                                                                         |
| [Chrome WebMCP origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial)   |  Yes | Establishes current Chrome enrollment/flag path; runtime behavior still must be tested.                                                                                                                                                                                                                                                        |
| [Chrome secure tools guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools) |  Yes | Tool poisoning, output injection, intent misrepresentation, over-parameterization, and origin boundaries are first-class design concerns.                                                                                                                                                                                                      |
| [`webmcp-types`](https://github.com/webmachinelearning/webmcp-types)                     |  Yes | The specification repository's current TypeScript package is 0.1.5. Its provider-facing declarations match current async registration, `title`, and execute cancellation and pass an isolated TypeScript 7 strict check with `skipLibCheck: false`. It does not yet declare the draft's in-page `executeTool` consumer method.                 |

## OpenAI resources

| Resource                                                                                                                                                      | Read | Decision-useful result                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [WebMCP app showcase](https://developers.openai.com/showcase?view=webmcp-apps)                                                                                |  Yes | Generic shopping, CRUD, editing, exploration, and game examples make a normal tool-enabled site insufficiently novel.                                                                                                                                                                                    |
| [ChatGPT Sites](https://learn.chatgpt.com/docs/sites?surface=app)                                                                                             |  Yes | A possible host, but not required. Current Sites policies make it a poor primary host for a commerce entry that enables payments.                                                                                                                                                                        |
| [OpenAI Site Tools / WebMCP](https://learn.chatgpt.com/docs/webmcp)                                                                                           |  Yes | ChatGPT and the page share the live page and signed-in session. Tools are page-bound and untrusted; calls receive safety review; normal confirmations apply to purchases, messages, deletion, and permissions. Use the latest desktop app with GPT-5.6 Sol or Terra; Luna currently has WebMCP disabled. |
| [OpenAI MCP API documentation](https://developers.openai.com/api/docs/mcp)                                                                                    |  Yes | This describes local/remote MCP servers, not the page-bound Site Tools test path. It is relevant to interoperability, but it cannot prove WebMCP behavior in ChatGPT's browser.                                                                                                                          |
| [ChatGPT Voice](https://learn.chatgpt.com/docs/features/voice)                                                                                                |  Yes | Voice works in Chat, Work, and Codex in the desktop app and through paired iOS Remote, but the documentation does not explicitly establish that a Voice session can invoke Site Tools in the built-in browser. Treat the composition as an exact-runtime experiment and retain typed input.              |
| [Realtime API](https://developers.openai.com/api/docs/guides/realtime) and [GPT-Realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1) |  Yes | Browser voice agents can use WebRTC for low-latency audio, reasoning, speech, and tool calls. The current model accepts text, audio, and image input but not video; camera understanding therefore requires explicit sampled frames or a separate processing path.                                       |

## Cloudflare resources

| Resource                                                                                                                                                                     | Read | Decision-useful result                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Cloudflare WebMCP overview](https://blog.cloudflare.com/webmcp/)                                                                                                            |  Yes | Agent Readiness can inject a same-origin bridge and optional Content Credentials or Site MCP Server packs. The C2PA pack currently parses credentials but reports `signatureVerified: false`; do not represent parsing as cryptographic verification. |
| [WebMCP on Browser Run](https://developers.cloudflare.com/browser-run/features/webmcp/)                                                                                      |  Yes | Useful for automated evaluation, but its examples still use an older testing surface. Treat it as a lab until validated against the current native draft.                                                                                             |
| [Coffee-store demo](https://webmcp-coffee.jilles.fyi/)                                                                                                                       |  Yes | Helpful implementation reference; ordinary product search/cart is already well represented.                                                                                                                                                           |
| [Challenge example](https://webmcp-challenge.examples.workers.dev/)                                                                                                          |  Yes | Supporter overview and demonstration, not an architecture mandate.                                                                                                                                                                                    |
| [Workers React starter](https://github.com/cloudflare/agents/tree/main/examples/webmcp-react)                                                                                |  Yes | Strong patterns: direct tool registration, runtime validation, shared human/tool actions, abort cleanup, unsupported-state UI, and Vitest.                                                                                                            |
| [Cloudflare Pages and Workers](https://developers.cloudflare.com/pages/)                                                                                                     |  Yes | Viable primary hosting path. Current Vite integration, Durable Objects, Browser Run, and RealtimeKit are a coherent stack for the live-market hypothesis.                                                                                             |
| [Cloudflare RealtimeKit](https://developers.cloudflare.com/realtime/realtimekit/) and [SDK selection](https://developers.cloudflare.com/realtime/realtimekit/sdk-selection/) |  Yes | Current beta SDKs cover web, Android, iOS, and React Native voice/video rooms. This can make host/buyer media multi-device, but it does not extend the prescribed ChatGPT/Chrome WebMCP client support to those devices.                              |

## Vercel resources

| Resource                                                            | Read | Decision-useful result                                                                                                                                             |
| ------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Vercel commerce source](https://github.com/vercel/shop)            |  Yes | Current, polished Next.js storefront reference. Its WebMCP commerce path delegates to Shopify's Hydrogen scripts rather than defining a novel collaboration layer. |
| [WebMCP implementation PR](https://github.com/vercel/shop/pull/498) |  Yes | Confirms the move from hand-written storefront tools to Shopify-provided tools. Useful precedent, not sufficient WebMCP depth for our entry.                       |
| [Live storefront](https://template.vercel.shop/)                    |  Yes | Establishes the quality floor for a commerce UI.                                                                                                                   |
| [Vercel pricing](https://vercel.com/pricing)                        |  Yes | Hosting option only; no reason to pair it with another primary host.                                                                                               |

## Shopify resources

| Resource                                                     | Read | Decision-useful result                                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Shopify WebMCP tools](https://shopify.dev/docs/api/web-mcp) |  Yes | Every Liquid storefront and Hydrogen preview storefront can expose authoritative catalog, product, cart, checkout, order, and policy tools. Shopify should own commodity commerce while our direct native tools own the novel live collaboration. |
| [Shopify agent tools](https://shopify.dev/docs/agents)       |  Yes | Catalog and commerce-agent capabilities are broader than WebMCP alone; use only where they create a real merchant/agent boundary.                                                                                                                 |

## Chrome resources

| Resource                                                                                |                                           Read | Decision-useful result                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ---------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`use-webmcp-tool`](https://www.npmjs.com/package/use-webmcp-tool)                      | Yes, including installed source/types at 0.2.0 | React-friendly, but currently omits `title` and the execute cancellation options and does not await async registration. Do not use it for the canonical challenge path without an update or local repair. |
| [WebMCP explainer](https://github.com/webmachinelearning/webmcp/blob/main/README.md)    |                                            Yes | Human-agent shared-page rationale and API intent. Current rendered spec remains authoritative for exact signatures.                                                                                       |
| [Angular WebMCP](https://angular.dev/ai/webmcp)                                         |                                            Yes | Useful framework-native precedent; not a reason to switch frameworks.                                                                                                                                     |
| [Chrome WebMCP evals](https://developer.chrome.com/docs/ai/webmcp/evals)                |                                            Yes | Test direct and ambiguous prompts, state-dependent tool sets, full tasks, correction, and recovery—not only handler functions.                                                                            |
| [Chrome DevTools WebMCP](https://developer.chrome.com/docs/devtools/application/webmcp) |                                            Yes | Application-panel inspection exposes registered tools, invocation state, input, output, and manual calls. Primary Chrome debugging surface.                                                               |
| [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance)              |                                            Yes | Useful implementation patterns, but its current package still contains stale Chrome/version and fallback claims. Do not treat it as version authority.                                                    |
| [GoogleChromeLabs demos](https://github.com/GoogleChromeLabs/webmcp-tools)              |                                            Yes | Shows the crowded baseline of conventional tasks. Mine patterns, not concepts.                                                                                                                            |

## Render and Netlify resources

| Resource                                                                                                                                                 | Read | Decision-useful result                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Render Workflows](https://render.com/workflows) and [docs](https://render.com/docs/workflows)                                                           |  Yes | Strong for durable asynchronous video/AI jobs; not a natural authoritative realtime-room server.                                                                                               |
| [Render templates](https://render.com/templates) and [credits documentation](https://render.com/docs/credits)                                            |  Yes | Optional implementation/hosting resources; no external credit claim made.                                                                                                                      |
| [Netlify](https://www.netlify.com/), [getting started](https://docs.netlify.com/get-started/), and [WebMCP starter](https://webmcp-starter.netlify.app/) |  Yes | Strong Agent Experience lens—discover, invoke, recover—and a useful starter. No unique capability found that beats Cloudflare for the live realtime hypothesis. No external credit claim made. |

## Important source conflicts

1. **Video requirement:** resources FAQ line 194 says "there's no video"; line 208 and the Official Rules require a public video under three minutes. Treat video as required.
2. **API surface:** some August 2026 partner materials still show `navigator.modelContext` or `navigator.modelContextTesting`; the current specification, Chrome documentation, and OpenAI example use `document.modelContext`.
3. **Browser versions:** older supporter examples cite Chrome 146. The challenge requires Chrome 149+, and the installed Chrome is 151. Its tested consumer surface currently differs from the August 26 draft; exact runtime wins over prose.
4. **MCP versus WebMCP:** OpenAI's remote MCP docs describe a server connection that can work without an open page. ChatGPT Site Tools discover page-owned WebMCP only while the page is present. Test and describe them separately.
5. **Helper packages versus draft:** the current latest Google hook (0.2.0) and MCP-B types (5.0.1) lag the August 26 execute signature. The specification project's `webmcp-types` 0.1.5 matches the provider callback but lacks the current in-page `executeTool` consumer method. Package affiliation or recency cannot override the draft and judged runtime.

## Chrome inspection path

The user-linked [WebMCP Extension](https://chromewebstore.google.com/detail/webmcp-extension/jigokfbbpcdckjmhbgapmikncfihboec) is an independent extension by Amrin Grewal (version 1.0, updated April 22, 2026). It can list, execute, and log tools, but its documentation refers to Chrome 146 and the older `navigator.modelContextTesting` surface. Use it as a secondary view only.

The primary path is Chrome 151 with the WebMCP testing flag, Chrome DevTools' native WebMCP pane, and Google's [Model Context Tool Inspector](https://chromewebstore.google.com/detail/webmcp-model-context-tool/gbpdfapgefenggkahomfgkhfehlcenpd) if an extension is useful. The Google inspector is version 1.9.13, updated August 19, 2026, offered by Google, and requires Chrome 150+. Its own listing warns that it is a development aid rather than a production security boundary. Neither extension was installed during this pass.

## Chrome 151 isolated native smoke test

On 2026-08-26 PT, a temporary page registered an imperative `add_numbers` tool and was served from localhost. Chrome 151.0.7922.174 ran headlessly in fresh isolated profiles so the test did not alter the normal Chrome profile.

- Negative control without the feature flag: `document.modelContext` was absent.
- With `--enable-features=WebMCP`: `document.modelContext` was present, `registerTool()` returned a promise, awaited registration succeeded, and `getTools()` returned `add_numbers`.
- Current-draft-style `executeTool(registeredTool, object)` failed with `Failed to parse input arguments`.
- Chrome-151-style `executeTool(registeredTool, JSON.stringify(object))` succeeded and returned the serialized tool result with sum `42`.
- The registered execute callback received only its input object; its second cancellation-options argument was `undefined`, despite the August 26 draft specifying `(input, { signal })`.
- Observed function arities were `registerTool.length === 1`, `getTools.length === 0`, and `executeTool.length === 2`.

This is evidence of a real draft/runtime skew, not a reason to target stale APIs exclusively. Challenge code should keep provider registration current, tolerate a missing callback-options argument where the judged runtime requires it, and isolate any in-page consumer adapter. The exact ChatGPT Site Tools behavior remains higher-priority evidence. Headless execution is supplementary because Chrome's own guidance describes WebMCP as primarily human-in-the-loop.

The reproducible fixture is [research/webmcp-runtime-smoke](research/webmcp-runtime-smoke/README.md). It is research evidence, not entry code. The four temporary Chrome profiles and superseded ignored fixture copy were moved to Trash after testing.

## Exact runtime acceptance matrix

Run this matrix at the walking skeleton, every material tool-surface change, release candidate, and final deployed build.

| Behavior                                                              | Chrome native                                               | ChatGPT Site Tools |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | -----------------: |
| Feature detection and async registration succeed                      | Pass: Chrome 150 flow + Chrome 151 positive/negative gates  |            Pending |
| Read tool is discovered and returns current visible state             | Pass: isolated Chrome 150                                   |            Pending |
| Write tool changes the same visible UI                                | Pass: isolated Chrome 150                                   |            Pending |
| Dynamic registration/removal is observed after state changes          | Pass: isolated Chrome 150                                   |            Pending |
| Ambiguous prompt selects or clarifies correctly                       | Pending: no model-driven consumer                           |            Pending |
| Invalid/stale input is rejected with actionable recovery              | Pass: isolated Chrome 150 stale quote                       |            Pending |
| Abort/cancellation stops work and leaves coherent state               | Unit pass; native cancellation still pending                |            Pending |
| Consequential action produces the real confirmation behavior          | N/A for the reversible, non-payment hold fixture            |            Pending |
| Navigation, refresh, BFCache, and reconnect do not expose stale tools | Pending                                                     |            Pending |
| Tool output and page content cannot silently escalate authority       | Contract pass; adversarial native prompt test still pending |            Pending |
| Ordinary-browser fallback remains fully usable                        | Pass: desktop and 390 px                                    |                N/A |

Record browser/app versions, model, URL/revision, prompt, expected result, observed result, screenshots/trace, and any failure. A passing development shim is supplementary evidence only.
