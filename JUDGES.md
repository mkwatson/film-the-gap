# Judge intelligence — living document

Verified 2026-08-26 from the [official challenge page](https://openai.com/webmcp-challenge/). This is a capability map, not a claim about private preferences or undisclosed judging criteria. The official rubric and the demonstrated product remain the source of truth.

## Why the panel matters

The judges' affiliations reveal both which dimensions of execution will receive unusually expert scrutiny and where a genuinely exceptional product integration could create an informed advocate. A judge is especially well equipped to recognize a novel, maximal use of a product or standard they helped build. That is real strategic leverage, not mere flattery.

The corresponding risk is shallow sponsor bingo: extra vendors and libraries can reduce coherence without meaningfully impressing anyone. The aim is concentrated judge-product leverage—one coherent infrastructure path plus deep, orthogonal integrations that strengthen the same thesis.

The panel covers the whole agentic-web chain:

- browser standards and human-facing web experience;
- browser-agent behavior and safety in the exact judged client;
- WebMCP/MCP semantics and interoperability;
- framework correctness and retrieval/evaluation discipline;
- open, deployable agent infrastructure and Agent Experience;
- real commerce negotiation, handoff, and transaction integrity.

That breadth favors a genuinely agent-native product with excellent human control over a conventional AI webpage or a collection of sponsor integrations.

## Panel and evidence-based lenses

| Judge          | Verified role                                         | Public, relevant signal                                                                                                                                                                                                                                        | Evaluation lens we should expect expert scrutiny on                                                                                                        | Project implication                                                                                                                                                                    |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sarah Drasner  | Distinguished Engineer, Chrome, Google                | Sarah describes herself as Chrome's Area Tech Lead for AI and the Web Ecosystem and built a hands-on WebMCP teaching demo. Chrome's current guidance emphasizes explicit browser-native contracts, visible UI effects, state-aware tools, security, and evals. | Browser-standard fidelity; polished, comprehensible human-agent interaction; progressive web quality; security and accessibility.                          | Build an excellent web product first. Use the native surface correctly, progressively enhance it, and make every agent action legible in the shared UI.                                |
| Andrew Galloni | VP Research & Innovation, Cloudflare                  | Co-authored Cloudflare's 2026 thesis for an open agentic Internet that is readable, discoverable, callable, and payable, using neutral standards rather than a single platform's private rails.                                                                | Open standards, portability, operational efficiency, identity/trust, and a credible path from invocation to economic outcome.                              | Prefer portable protocols and explicit contracts. If payments or agent infrastructure appear, make them useful, safe, and operational—not sponsor decoration.                          |
| Jude Gao       | Member of Technical Staff, Vercel · Next.js Core Team | Published Vercel's evaluation showing a version-matched `AGENTS.md` docs index outperforming memory-led and optional-skill approaches on Next.js 16 tasks.                                                                                                     | Current Next.js correctness, clean framework-native architecture, measurable behavior, and retrieval/evaluation discipline.                                | Read the installed Next.js docs before coding, use a proven current stack, and demonstrate behavior with tests/evals rather than relying on plausibility.                              |
| Ilya Grigorik  | Distinguished Engineer, Shopify                       | Authored Shopify's UCP architecture explanation: discovery and capability negotiation, independently versioned layers, composable extensions, graceful handoff, and payment-handler negotiation.                                                               | Commerce realism, protocol composition, interoperability, performance, state and transaction integrity.                                                    | Use UCP only for authentic merchant/agent negotiation or checkout/order value. A thin UCP label on an application-owned mock purchase would be worse than omitting it.                 |
| Alex Nahas     | Creator of MCP-B                                      | MCP-B's current packages target the standard `document.modelContext` surface, publish separate strict core types and optional bridges/polyfills, and maintain spec-alignment and interoperability tests.                                                       | WebMCP/MCP semantic fidelity, browser-native behavior, interop, and whether an integration is real rather than theatrical.                                 | Treat the current draft and target browser as canonical. Add MCP-B packages only for a concrete types/polyfill/interop need, keep the native path thin, and test parity.               |
| Sean Roberts   | VP of Applied AI, Netlify                             | Defines Agent Experience as how easily an agent discovers capabilities, calls them reliably, and recovers from failure; advocates portable, open and operationally simple MCP experiences.                                                                     | Tool discoverability and selection, reliable invocation, graceful correction/recovery, portability, and production readiness.                              | Design an AX test suite: obvious and ambiguous prompts, invalid inputs, conflicts, stale state, retries, recovery, and multi-step completion.                                          |
| Justin Rushing | Browser Agent Lead, OpenAI                            | The official role plus current OpenAI Site Tools guidance establishes the closest lens on the exact judged ChatGPT runtime: page/session sharing, untrusted tools and outputs, safety review, confirmations, and page-bound lifetime.                          | Real ChatGPT browser-agent success, permission and confirmation behavior, shared-page collaboration, task completion, and resistance to untrusted content. | Test early and repeatedly inside the latest ChatGPT desktop app with a supported model. Do not design a high-speed mutation loop that assumes confirmation-free purchases or messages. |

The lenses above are inferences from public work and roles, not biographical scoring models.

## What the panel composition means

1. **WebMCP cannot be decorative.** Three judges sit directly on browser-agent or WebMCP layers: Chrome, OpenAI's browser agent, and MCP-B. The tool surface must create a capability or collaboration pattern that DOM automation alone would not deliver as safely, efficiently, or clearly.
2. **Judge-product leverage is valuable when it is concentrated.** An unusually strong use of a judge's own product can be immediately legible and can create an expert advocate. Cloudflare, Vercel, and Netlify are overlapping platform choices, however, so selecting more than one primary host for affiliation alone would weaken the architecture. Choose the platform that best enables the winning experience and use it maximally.
3. **Commerce can be a strength only if it is deep.** Ilya's public UCP work is grounded in the ugly reality of negotiation, dynamic capabilities, handoff, payment choice, and transaction state. Live shopping plus UCP is strategically coherent only when UCP owns a real boundary it was designed for.
4. **The shared human interface matters as much as the tool call.** Chrome and OpenAI both frame WebMCP as agents using the page's live state and existing session while people remain in control. The winning moment should be visible to the human, attributable, and safe.
5. **Reliability needs evidence.** The Next.js and Netlify signals both point toward eval-driven engineering. We should measure tool selection, schema repair, failure recovery, state transitions, and complete tasks—not merely unit-test handler functions.
6. **Open plus production-real is the unifying taste.** Across Chrome, Cloudflare, Vercel, Shopify, MCP-B, Netlify, and OpenAI, the common denominator is a usable open-web primitive that survives contact with real agents and real users.

## Judge-product leverage strategy

The ideal portfolio is coherent rather than neutral:

1. **Required hero surfaces:** make the experience outstanding in ChatGPT Site Tools and Chrome's native WebMCP implementation. These are the judged runtimes and directly showcase work represented by Justin and Sarah.
2. **One primary infrastructure ecosystem:** select Cloudflare, Vercel, Netlify, Render, or another host based on the concept's hardest operational requirement. If a represented platform wins, use its differentiating capability deeply enough to become part of the demo story.
3. **Orthogonal protocol products:** if the concept earns them, use Shopify/UCP for a real commerce boundary and MCP-B for standards-aligned types, polyfill behavior, or interoperability. These can coexist with one host because they solve different layers.
4. **No redundant integrations:** do not deploy to both Vercel and Netlify, or add parallel services, merely to collect affiliations. Portability is better shown through standard boundaries, tests, and a credible fallback than duplicate production stacks.
5. **Optimize for expert delight:** the integration should reveal a surprising or exemplary capability that the associated judge would be proud to cite—not just prove that an SDK installed successfully.

Known-judge leverage improves expected value; it cannot guarantee a score. The [official rules](RULES.md) allow judges to change and permit multiple panels, peer review, or automated analysis. Every integration therefore still has to raise one or more official criteria for an evaluator with no affiliation context.

## Vendor and library decision rule

For each material dependency or vendor, document:

- the product capability it uniquely or materially improves;
- the current version/API and first-party source checked that day;
- compatibility with the complete stack and exact judged runtime;
- the smallest fallback or portability story;
- a direct test proving the claimed behavior.

Judge affiliation is a legitimate strategic multiplier but not sufficient rationale by itself. For a represented product, ask two additional questions: would its expert recognize this as a serious, novel use, and is that value obvious enough to help them explain the project to the rest of the panel?

Possible strategic uses, subject to live validation, include:

- **Next.js/Vercel:** current framework craft and a deeply integrated deployment/runtime capability if this remains the most cohesive app stack.
- **Cloudflare:** a primary platform choice when realtime coordination, durable state, browser/agent evaluation, edge security, or open-agent infrastructure is central.
- **Netlify:** a primary platform choice when its Agent Experience and deployment tooling materially produces the most reliable judged experience.
- **Shopify/UCP:** genuine discovery, negotiation, checkout, handoff, or order-state semantics that make commerce agents and humans collaborate in a new way.
- **MCP-B:** standards-aligned types, a deliberate polyfill, or cross-client interoperability that visibly extends the native WebMCP experience.

## Operational review gate

Before promoting a concept or architectural rung, ask:

1. Would a Chrome standards expert call this native, accessible, and visibly human-centered?
2. Does it work reliably in the exact ChatGPT Site Tools runtime, with its real confirmation and trust behavior?
3. Would an MCP-B author recognize faithful WebMCP semantics and meaningful interoperability?
4. Does the current Next.js implementation look idiomatic and does the evidence prove it?
5. Can an agent discover the right tool, repair mistakes, recover, and finish?
6. Is the experience portable across the open web rather than dependent on a hidden private rail?
7. If commerce is present, are negotiation, handoff, payment, and transaction state authentic enough for a Shopify protocol expert?

This gate supplements rather than replaces the official judging rubric.

## Primary sources

- [OpenAI WebMCP Challenge and official judge list](https://openai.com/webmcp-challenge/)
- [Sarah Drasner's current role](https://sarah.dev/)
- [Sarah Drasner's WebMCP teaching demo](https://github.com/sdras/webmcp-demo)
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome WebMCP best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Chrome WebMCP evaluations](https://developer.chrome.com/docs/ai/webmcp/evals)
- [Cloudflare: Building an open Agentic Internet](https://blog.cloudflare.com/the-agentic-internet/)
- [Jude Gao: `AGENTS.md` outperforms skills in Next.js agent evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- [Ilya Grigorik: Building the Universal Commerce Protocol](https://shopify.engineering/UCP)
- [MCP-B packages and WebMCP architecture](https://github.com/WebMCP-org/npm-packages)
- [Sean Roberts: MCP goes stateless and extensible](https://www.netlify.com/blog/mcp-goes-stateless-and-extensible/)
- [OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp)

## Maintenance rule

Recheck the official challenge page for panel or rubric changes before major concept selection and before submission. Recheck each relevant first-party source when its corresponding integration is proposed. Date any new inference and preserve disagreements rather than smoothing them away.
