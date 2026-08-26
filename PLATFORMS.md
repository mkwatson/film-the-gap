# Platform and integration decision record

Research state: 2026-08-26. This is a conditional recommendation, not a final concept or stack lock. The hard acceptance test is still observed product magic in the exact ChatGPT and Chrome runtimes.

## Current recommendation

If the agent-native live-market frontier survives its first browser test, use one Cloudflare-centered React/Vite application, Shopify for authoritative commodity commerce, and direct native WebMCP for the novel collaboration layer.

That means:

- Cloudflare Workers plus the current Vite plugin for the app and API;
- one Durable Object per live room for authoritative ordered state and Hibernation WebSockets;
- RealtimeKit for real low-latency video/stage/transcription when the prerecorded first rung earns it;
- direct `document.modelContext.registerTool` calls for live show, evidence, mandate, reservation, and state-aware tool availability;
- Shopify/Hydrogen for catalog, product, cart, checkout, order, and policy actions;
- UCP only at a real discovery, capability-negotiation, mandate, merchant, or settlement boundary;
- Lean only for a stable consequential invariant whose certificate is visible and useful;
- MCP-B only for a current, concrete interoperability or conformance function.

This is concentrated judge-product leverage. Cloudflare and Shopify solve different load-bearing layers; ChatGPT and Chrome are the required hero clients. Vercel and Netlify remain valuable quality lenses, but adding either as a second host would duplicate the deployment layer without improving the live product.

## Why this architecture fits the current frontier

```text
ChatGPT Site Tools / Chrome agent
              |
       direct page WebMCP
              |
React/Vite shared live UI -- Shopify/Hydrogen commerce tools
              |
       Cloudflare Worker
        /             \
room Durable Object   RealtimeKit media
ordered state + WS    live A/V + transcript
              |
   optional UCP merchant/handoff boundary
              |
 optional Lean-checked action certificate
```

The page owns the live item, evidence, room state, current session, and visible consequences. ChatGPT owns the buyer's private conversational context and reasoning. The merchant owns authoritative commerce. A small proof layer may certify the action envelope, while empirical video claims remain explicitly uncertain.

## Platform comparison

| Platform      | Deep, distinctive fit                                                                                                                                                                                                                  | Main concern                                                                                                                                                                                                      | Current call                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Cloudflare    | Durable Objects provide a natural single authority per room; Hibernation WebSockets keep clients connected; RealtimeKit supplies global WebRTC; Browser Run can support evals; Agent Readiness/C2PA are optional orthogonal additions. | Several products are preview/beta and their WebMCP examples can lag the draft. RealtimeKit's full UI bundle is large.                                                                                             | **Provisional primary platform** for the live-market hypothesis.                                           |
| Vercel        | Excellent current Next.js developer experience and polished commerce reference. A judge is on Next.js core.                                                                                                                            | Queue ordering is not authoritative for auctions; realtime Function documentation conflicts; the reference storefront delegates WebMCP commerce to Shopify. Pairing with Cloudflare as another host is redundant. | Use only if the chosen concept becomes a primarily Next.js product without hard room-ordering/media needs. |
| Netlify       | Strong Agent Experience framing and starter path; deployability and recovery discipline.                                                                                                                                               | No uniquely stronger live-room primitive found. A second primary host would add complexity.                                                                                                                       | Apply its AX test philosophy; do not add as affiliation decoration.                                        |
| Render        | Durable asynchronous Workflows fit long-running video processing.                                                                                                                                                                      | Workflows are not an incoming-port realtime room.                                                                                                                                                                 | Consider only for an indispensable async pipeline that cannot run cohesively on the primary stack.         |
| ChatGPT Sites | Tight ChatGPT experience and WebSocket-capable hosting.                                                                                                                                                                                | Current policies prohibit enabling financial transactions or processing payment-card data.                                                                                                                        | Not the primary commerce host.                                                                             |
| Shopify       | Native current WebMCP tools for real catalog/cart/checkout/order state and direct relevance to Vidably's merchant domain.                                                                                                              | Shopify's built-in tools alone would look like an ordinary storefront, and Hydrogen WebMCP is still preview.                                                                                                      | **Provisional authoritative commerce layer**, paired with custom direct tools.                             |

## Represented-product leverage

- **Chrome / Sarah Drasner:** use the current native surface, DevTools inspection, dynamic tools, visible effects, accessibility, security, and a serious eval suite.
- **OpenAI / Justin Rushing:** make the exact ChatGPT built-in browser the hero path; design around real safety review, confirmation, and page lifetime.
- **Cloudflare / Andrew Galloni:** make ordered room state, realtime media, open standards, and evaluation operationally central—not a logo in the README.
- **Shopify / Ilya Grigorik:** let Shopify/UCP own real merchant discovery, negotiation, commerce state, and handoff rather than an application-owned fake checkout.
- **MCP-B / Alex Nahas:** earn any package through an actual interop/conformance story and correct its current type gap if necessary.
- **Vercel / Jude Gao:** even off Vercel, use current-document retrieval and version-matched, evidence-driven engineering. If the architecture moves to Next.js, use Vercel deeply and drop Cloudflare as primary host.
- **Netlify / Sean Roberts:** make agent discoverability, ambiguity handling, retry, correction, and recovery measurable.

No affiliation guarantees a score, and the rules permit changing panels. Each use must still raise WebMCP leverage, execution, impact, or ambition for an unaffiliated evaluator.

## Browser-runtime evidence

An isolated Chrome 151.0.7922.174 native smoke test passed feature gating, promise-returning registration, discovery, and tool execution, but exposed a material draft/runtime mismatch. The installed browser accepts a JSON string—not the August 26 draft's object—for its in-page `executeTool` input, and it invokes the provider callback without the draft's second `{ signal }` argument. See [RESOURCES.md](RESOURCES.md) for the exact observation and negative control.

Consequences for the eventual stack:

- keep the direct provider implementation aligned with the current specification;
- tolerate absent execute options at the runtime boundary until ChatGPT and Chrome converge;
- keep in-page testing/consumer compatibility behind a tiny adapter instead of polluting tool handlers;
- record the exact browser build with every acceptance run;
- do not let a passing headless fixture stand in for DevTools, extension, natural-language, or ChatGPT testing.

## Current compatibility ledger

Registry metadata rechecked 2026-08-26:

| Package                            |                 Current version/tag assessed | Result                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React                              |                                       19.2.8 | Passed strict compatibility spike.                                                                                                                                                                                                                                                                |
| Vite                               |                                        8.2.2 | Passed with the current Cloudflare plugin. Requires Node 20.19 or newer in the 20.x line, or Node 22.12 or newer.                                                                                                                                                                                 |
| TypeScript                         |                                        7.0.2 | Passed the isolated strict spike; do not migrate the provisional root scaffold merely for version maximalism.                                                                                                                                                                                     |
| Vitest                             |                                       4.1.11 | Passed isolated spike/build matrix.                                                                                                                                                                                                                                                               |
| Zod                                |                                        4.4.3 | Appropriate for runtime validation in addition to JSON Schema.                                                                                                                                                                                                                                    |
| Biome                              |                                       2.5.10 | Current formatting/lint option for a Vite stack.                                                                                                                                                                                                                                                  |
| `@cloudflare/vite-plugin`          |                                       1.54.0 | Peers support Vite 6–8 and require Wrangler `^4.126.0`; spike passed.                                                                                                                                                                                                                             |
| Wrangler                           |                                      4.126.0 | Current plugin peer; Node 22+ compatible.                                                                                                                                                                                                                                                         |
| `@cloudflare/realtimekit-react`    |                                        2.0.2 | Strict application typecheck and Vite client build passed with `skipLibCheck: true`. Its dependency declarations currently fail with `skipLibCheck: false` because they reference undeclared type packages. Resolve or isolate that defect before adoption.                                       |
| `@cloudflare/realtimekit-react-ui` |                                        2.0.2 | Same declaration gap; Vite build passed, but direct Node ESM import failed and an eager import created roughly 2.34 MB initial JS (about 600 KB gzip). Do not SSR-import or eagerly ship the full kit without a measured reason.                                                                  |
| `@shopify/hydrogen`                | stable 2026.4.5; preview 2026.10.0-preview.1 | Preview package is the WebMCP path. It passed the isolated client build, but official preview guidance expects a server-rendered storefront; require a real store/runtime test before adoption.                                                                                                   |
| `@shopify/ucp-cli`                 |                                        0.7.0 | Current early CLI; no implementation dependency yet.                                                                                                                                                                                                                                              |
| `webmcp-types`                     |                                        0.1.5 | Specification-project types. An isolated TypeScript 7 strict check with `skipLibCheck: false` passed for async registration, `title`, and `(input, { signal })`. The package does not yet declare the draft's `executeTool` consumer method. Recommended provider base, augmented only if needed. |
| `@mcp-b/webmcp-types`              |                                        5.0.1 | Declaration-only and close to current, but its execute callback omits the August 26 `{ signal }` option. Do not let it define the canonical API without an update/augmentation.                                                                                                                   |
| `use-webmcp-tool`                  |                                        0.2.0 | Omits `title` and execute cancellation; does not await async registration. Avoid for challenge-critical registration unless repaired upstream or locally.                                                                                                                                         |

### Isolated spike evidence

The temporary React/Vite spike used the versions above plus the Hydrogen preview and both WebMCP helper packages.

- package peer check: passed;
- application `strict: true` TypeScript 7 check: passed with `skipLibCheck: true`;
- Cloudflare Vite production build: passed, 255 transformed modules;
- direct Node import of the full RealtimeKit UI: failed on an unsupported directory import;
- Vite client bundling of the same UI: passed but produced an unacceptably large eager bundle.
- dependency-declaration check with `skipLibCheck: false`: failed on RealtimeKit 2.0.2's undeclared type imports and on installing two competing ambient WebMCP type packages together;
- isolated `webmcp-types` 0.1.5 provider check with TypeScript 7, `strict: true`, and `skipLibCheck: false`: passed; a guarded negative check confirms its current `executeTool` omission.

This proves a browser-bundled path can cohere, but it also identifies declaration-quality work that must be resolved. It does not prove product/runtime correctness. The spikes are under ignored `tmp/` and are not entry code. Never install both ambient WebMCP type packages in the final app.

## Commerce boundary

Shopify currently exposes `search_catalog`, `browse_store`, product/variant display, cart updates, checkout, order management, and policy search through WebMCP. Reimplementing those as custom tools would waste effort and look less authentic.

Our custom page tools should instead expose what Shopify does not own:

- inspect the live show and current evidence;
- set a narrow buyer mandate without uploading a whole private profile;
- request a specific host demonstration;
- expose or remove a reversible reservation based on current state;
- explain why a constraint is supported, unresolved, or violated;
- record visible, attributed human/agent activity.

UCP release `2026-08-25` supports REST, MCP, A2A, and embedded transports, discovery at `/.well-known/ucp`, exact version/capability intersection, and checkout/cart/catalog/order extensions. It becomes meaningful when the live room reaches a merchant or checkout boundary. An application-owned object merely shaped like UCP is not an integration.

## Formal-verification boundary

Lean can prove that a formally specified state transition respects a mandate, budget, ordering rule, or authorization invariant, subject to its definitions and assumptions. It cannot prove that a host's empirical product claim or a video observation is true.

The best later rung is a small, isolated certificate service and independently replayable artifact for one visible consequential rule. Do not transplant private math-research theorems or code into the public entry. The local proof lab's audit discipline—no `sorry`, no new axioms, no `native_decide`, exact axiom checks, and negative controls—is the useful asset.

## Hard gates before stack lock

1. The direct native walking skeleton passes both runtime columns in [RESOURCES.md](RESOURCES.md).
2. ChatGPT observes dynamic registration/removal quickly enough for a paced live item.
3. Real confirmation behavior does not destroy the intended interaction; irreversible purchase is not the first-rung success condition.
4. RealtimeKit can be integrated client-side with a deliberately small/lazy surface, acceptable load time, and a clean strict-type boundary.
5. A real Shopify developer store proves the Hydrogen/WebMCP path and coexistence with custom tools.
6. Every public media/data asset has explicit rights clearance.
7. The concept still beats non-commerce frontier ideas after the observed demo, not merely on paper.

If the first two gates fail, reframe or drop the live-market concept rather than disguising a remote backend agent as WebMCP.
