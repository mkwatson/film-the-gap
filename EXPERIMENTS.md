# Innovation frontier and experiment register

Research state: 2026-08-26 PT. Hypotheses in this register were frozen before the Rung 2 implementation. Descriptive labels are not proposed submission names.

## Authoritative starting point

- Recoverable golden path: commit `41ab726` (`feat: add native WebMCP live market rung`).
- Working behavior: one buyer or agent discloses five constraints, requests missing physical evidence from the host, receives a visible answer, and creates or releases a reversible hold through dynamically registered native Site Tools.
- Known limitation: the page receives, stores, displays, and returns `maxAllInPrice`. It therefore gives the seller the buyer's exact ceiling while claiming to minimize disclosure.
- Runtime boundary: isolated Chrome 151 native discovery and execution are proven for the research fixture. Exact ChatGPT Site Tools and normal-profile Chrome acceptance remain open gates.

## What changed in the evidence

1. The [official challenge page](https://openai.com/webmcp-challenge/) asks for an app that becomes meaningfully better when people and agents use it together. The [Devpost gallery](https://webmcp.devpost.com/project-gallery) was still unpublished on August 26, while the last same-day refresh showed 1,717 participants. We cannot novelty-check private entries, so the interaction itself must be structurally memorable.
2. The current [OpenAI showcase](https://developers.openai.com/showcase?view=webmcp-apps) makes shared editing, carts, planning, creative tools, games, and ordinary storefronts crowded reference territory. Its WebMCP filter still says examples are coming soon; copying showcase categories is not a winning differentiation strategy.
3. The August 19 [WebMCP draft](https://webmachinelearning.github.io/webmcp/) makes document-local state, dynamic registration, cancellation, and origin-scoped exposure first-class. A strong entry should make those properties necessary rather than merely convenient.
4. Current [Chrome imperative API documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api) documents cancellation and lifecycle behavior and notes a Chrome 153 unregistration improvement. The judged baseline is Chrome 149+, while the installed Chrome 151 has a recorded draft skew. Version-specific behavior must remain measured rather than assumed.
5. The 2026 paper [When Agents Shop for You](https://arxiv.org/abs/2604.26220) reports that seller-side inference recovered a buyer agent's willingness to pay nearly one-for-one from dialogue in its verbal-profile condition. Its result survived removal of explicit persona cues; the behavioral pattern itself leaked value. Prompting an agent to keep a budget secret is therefore not a complete privacy architecture.
6. UCP `2026-08-25` adds useful merchant-side capabilities including [catalog transports](https://ucp.dev/specification/shopping/catalog/rest/), [buyer consent](https://ucp.dev/specification/shopping/extensions/buyer-consent/), [payment terms](https://ucp.dev/specification/payment/extensions/terms/), and a browser-addressable [permalink handoff](https://ucp.dev/specification/permalink/). AP2 binds authorization to checkout state. None of these capabilities supplies the missing live physical evidence or by itself prevents preference inference before checkout.

## New interaction frontier

The earlier strategy pass enumerated product domains. This pass deliberately changes the unit of exploration: each row is a new interaction primitive that could transfer across domains. Rephrasing an existing live-shopping feature does not count.

|   # | Structural leap                        | Smallest complete rung                                                                                                                             | What makes it structurally different                                                                     | Decisive failure evidence                                                                                               |
| --: | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
|   1 | **Private-counterparty membrane**      | The personal agent sends only evidence requirements and an exact action quote; the seller never receives a profile or ceiling.                     | The agent is a privacy boundary, not merely an automation layer.                                         | The complete decision cannot work without disclosing a valuation or the explanation becomes too confusing for the demo. |
|   2 | **Counterfactual capability frontier** | Every inspection reports not only current tools but the smallest evidence, consent, or state change that would unlock each meaningful next action. | The website makes latent affordances machine-legible instead of leaving an agent at a dead end.          | The frontier duplicates tool descriptions or causes worse tool selection than the dynamic surface alone.                |
|   3 | **Epistemic multicast**                | One normalized human camera demonstration resolves the same missing fact for multiple private agents at once.                                      | A physical observation becomes a shared public good while decisions remain private.                      | The aggregate feels like decorative analytics or requires storing individual profiles.                                  |
|   4 | **Evidence bounty threshold**          | Agents anonymously pledge bounded value toward an expensive inspection; only the aggregate threshold reaches the host.                             | The crowd can finance information without revealing individual valuations.                               | Payments/pledges dominate the story or cannot be made safely reversible.                                                |
|   5 | **Origin-scoped semantic twins**       | Buyer, host, and auditor frames receive different minimal tool surfaces through `exposedTo`, all operating on one visible state.                   | Capability disclosure follows origin and role without centralizing every permission in one API.          | Judged clients ignore origin-scoped exposure or the multi-frame story is less legible than one page.                    |
|   6 | **Consent topology**                   | Tools appear or disappear as separate data subjects grant, narrow, or revoke purpose-specific consent; revocation visibly cascades.                | Consent changes the executable graph, not just a settings record.                                        | The flow reduces to a consent form with no consequential capability change.                                             |
|   7 | **Human sensor mesh**                  | An agent routes one bounded observation request to the available person or device with the right physical vantage point and returns provenance.    | Humans become addressable real-world sensors while retaining refusal and scope control.                  | Provenance and identity costs overwhelm the single useful observation.                                                  |
|   8 | **Negotiated tool schema**             | An agent proposes a desired capability; the site narrows its arguments and effects; a human approves the temporary schema before registration.     | Tools themselves become a negotiated, least-authority artifact.                                          | Dynamic schema creation is unreliable for agents or looks like a developer console rather than a product.               |
|   9 | **Live tool teaching**                 | A human demonstrates one repeatable procedure, reviews the inferred preconditions, and publishes it as an ephemeral page tool.                     | Human behavior creates a capability during the session instead of merely supplying data to a fixed tool. | The inferred procedure cannot be bounded or verified well enough for safe execution.                                    |
|  10 | **Proof-carrying capability unlock**   | A small verifier emits a replayable certificate for one consequential invariant; the page registers the action only when the certificate checks.   | Formal evidence controls the tool surface rather than decorating an explanation.                         | The invariant is trivial, invisible, or depends on empirical claims the proof cannot establish.                         |
|  11 | **Contradiction-triggered rollback**   | New evidence invalidates downstream conclusions, unregisters unsafe actions, and reverses a hold with an attributed explanation.                   | The system treats knowledge as defeasible and retracts authority automatically.                          | The rollback is surprising, destructive, or cannot distinguish contradiction from ordinary updates.                     |
|  12 | **Multi-principal quorum tool**        | A capability exists only while independently scoped buyer, seller, and reviewer approvals overlap.                                                 | Authority is an intersection of principals rather than a single user's broad token.                      | One party is ornamental or the quorum adds clicks without reducing real risk.                                           |
|  13 | **Semantic time travel**               | A replay reconstructs which tools existed at each event and why, then runs counterfactual state branches without mutating the live room.           | The executable interface becomes auditable historical state.                                             | Replay cannot reproduce the actual registration surface or distracts from the live outcome.                             |
|  14 | **Attention router**                   | The page ranks agent questions by expected information gain, number of blocked decisions, and human interruption cost.                             | It optimizes scarce human attention rather than generic task completion.                                 | Rankings are arbitrary or suppress a minority safety-critical question.                                                 |
|  15 | **Uncertainty-priced tools**           | Read tools publish measured latency, cost, reversibility, and evidence quality so the agent can choose an information-gathering policy.            | Tool selection becomes an explicit sequential decision under uncertainty.                                | Metadata is speculative or current agents cannot use it more effectively than plain descriptions.                       |
|  16 | **Physical microtask compiler**        | An agent decomposes an inaccessible real-world task into short human actions with acceptance checks and a shared completion graph.                 | The collaboration unit is a verified human micro-action, not a chat turn.                                | The checks cannot distinguish task completion from plausible-looking media.                                             |
|  17 | **Dual-private overlap**               | Buyer and seller agents each retain private constraints and reveal only whether a concrete, signed offer lies in the feasible intersection.        | Neither counterparty learns the other's reservation value; only actionable overlap crosses the membrane. | The protocol becomes a generic negotiation backend with no need for the live page.                                      |
|  18 | **Rights-composed media surface**      | Export, remix, publish, and commerce tools are registered only when clip-level provenance and usage rights compose for that action.                | Media rights directly determine executable capabilities.                                                 | Rights data is synthetic or the tool gating cannot be explained in one glance.                                          |

## Frozen hypotheses

### H1 — A seller-blind decision is a stronger complete experience

**Claim:** Replacing the disclosed five-field buying mandate with four public evidence requirements, while keeping price evaluation inside ChatGPT and binding the hold to an exact current quote, will preserve the complete hero task and make privacy, WebMCP necessity, and human-agent complementarity materially clearer.

**Pass:**

- no Site Tool input, output, page state, or visible seller surface contains a maximum price or buyer profile;
- the agent can inspect the current all-in price, privately decide, and create the same reversible hold against that exact quote;
- a changed/stale quote is rejected with a useful recovery path;
- the ordinary human fallback still completes the flow; and
- the privacy boundary is understandable from the page without narration longer than two sentences.

**Fail:** Any private valuation must cross the page boundary, the hold can be created against a stale quote, or removing the ceiling makes the product story less coherent.

### H2 — The page should expose the route to future tools

**Claim:** A compact counterfactual frontier in the read result and shared UI will make dynamic registration legible and prevent agent dead ends without adding another overlapping tool.

**Pass:** Every nonterminal state identifies the smallest valid next transition, unavailable mutations remain actually unregistered, and invalid or stale calls return a specific recovery action.

**Fail:** The frontier disagrees with registered tools, recommends an impossible transition, or substantially duplicates the current tool list without improving recovery.

### H3 — One camera answer can serve a private crowd

**Claim:** Aggregating only normalized evidence demand lets one host answer unblock several attending agents without exposing their profiles, budgets, or decisions, creating a judge-visible human-agent collaboration moment beyond ordinary shopping chat.

**Pass:** One host transition resolves at least eight transparently labeled demo-room requests, the UI visibly shows the multicast effect, and the stored/requested shape contains no individual preference data.

**Fail:** The count is merely decorative, the host must inspect individual profiles, or the aggregate obscures an important minority request.

### H4 — A separate host view may make the market feel real

**Claim:** Synchronizing a buyer/agent view with a host view will improve perceived execution and collaboration more than its operational and demo complexity costs.

**Pass:** Two ordinary-browser contexts complete request-to-answer propagation with deterministic recovery, while the 45-second hero story becomes easier to understand.

**Fail:** Cross-context behavior is flaky in judged clients, duplicates the already-visible host control, or consumes more demo time than the added credibility earns.

## Frozen experiment protocols

### E1 — Preference-leakage boundary

1. Capture the Rung 1 contract as the positive leakage control: `maxAllInPrice` exists in the tool schema, state snapshot, evaluation, and UI.
2. Implement H1 with a four-field public evidence envelope and exact-quote hold input.
3. Add recursive contract tests that fail if forbidden private-value keys or phrases appear in any registered definition or returned snapshot.
4. Exercise supported, violated, unresolved, stale-quote, duplicate, cancellation, and release paths.

Decision rule: graduate only if the whole hero path remains green and no valuation crosses the seller boundary.

### E2 — Dynamic WebMCP contract and recovery

1. Verify in unit/component tests that dynamic registration matches the counterfactual frontier after every transition.
2. Run the production app in a fresh isolated native Chrome profile with WebMCP enabled.
3. Discover and execute the live tools through `document.modelContext`, including a stale exact quote, evidence request, host answer, hold, and release.
4. Run without the feature as a negative control and keep ordinary-browser visual verification separate.

Decision rule: record native evidence narrowly; do not infer ChatGPT compatibility from Chrome or headless execution.

### E3 — Private-crowd evidence multicast

1. Seed a clearly labeled deterministic demo room with seven anonymous agents blocked on the same normalized repair-history fact.
2. Let the attending ChatGPT/user add the eighth request through the real transition.
3. Answer once as the host and assert that all eight requests resolve while no profile or price field exists.
4. Render the before/after effect and test the minority-safety escape: only identical evidence kinds aggregate.

Decision rule: keep only if the aggregate is stateful, truthful about being a fixture, visually obvious, and does not weaken the single-buyer flow.

### E4 — Two-context host spike

Implement only after E1-E3. Compare an in-page host control against a `BroadcastChannel` two-view spike using the same request/answer sequence. Kill the branch if it does not materially improve the short demo or exact-client reliability.

## Current evidence-directed call

Run E1-E3 together as the next cumulative rung. They reinforce one sentence:

> The live market learns what proof to show, not what each buyer is willing to pay.

This is not a final concept lock. The original rung remains recoverable, H4 and the other primitives stay live, and a stronger observed branch can still displace the market thesis.

## Experiment results — 2026-08-26

### E1 — Pass: the complete loop no longer discloses a buyer ceiling

- Commit `41ab726` is the positive leakage control: `maxAllInPrice` crossed the tool schema, page state, evaluation, and visible seller surface.
- The new `set_evidence_requirements` schema accepts only length bounds, visible-edge evidence, and prior-repair policy. Strict runtime parsing rejects an added `maxAllInPrice` field.
- Recursive contract checks find no forbidden private-value key, buyer-profile phrase, or fixture ceiling in registered definitions or returned snapshots.
- `reserve_current_lot` receives only the exact public all-in quote the agent is accepting. A stale `$400` call against the current `$423` quote is refused without creating a hold; `$423` succeeds.
- Supported, incompatible, unresolved, duplicate-request, stale-request, cancellation, hold, and release behaviors pass.
- The visible privacy receipt explains the boundary in two sentences.

Limitation: withholding direct profile and ceiling fields minimizes disclosure; it does not prove that a seller can never infer preferences from behavior. The product and documentation now state that explicitly.

### E2 and H2 — Pass in the available native scope

- Isolated Headless Chrome 150 discovered exactly the three initial tools, executed `set_evidence_requirements`, observed `request_host_evidence` appear, executed it, and observed it disappear.
- One visible host answer unlocked `reserve_current_lot`. Native execution rejected stale `$400`, accepted exact `$423`, replaced reserve with release, and restored the prior surface after release.
- The page and every read result exposed the same smallest valid next transition; impossible mutations remained unregistered. The stale-evidence and stale-quote paths returned concrete recovery actions.
- Fresh isolated profiles in the installed Chrome 151.0.7922.174 rendered `Site Tools live` with `--enable-features=WebMCP` and `Browser fallback` with the feature disabled.
- The ordinary-browser human flow completed share → request → host answer → hold → release. Desktop and 390 px layouts had no framework overlay or horizontal overflow.

These are narrow runtime results, not a compatibility claim for ChatGPT's in-app browser, model-driven tool choice, Mark's normal Chrome profile, or Voice-to-Site-Tools composition. Those remain release gates.

### E3 — Pass as a transparent deterministic room fixture

- Seven anonymous `repair_history` demand signals are present initially.
- The current agent's real request changes the aggregate to eight queued requests.
- One host answer changes the same aggregate to eight resolved requests.
- Stored demand contains only evidence kind, count, and status; the current request retains action attribution but no buyer profile or price.
- The UI labels the other seven agents as a demo-room fixture and lands the multicast effect as “One answer → 8 private decisions.”
- Only identical evidence kinds aggregate; unsupported or no-longer-useful requests are refused.

This proves the interaction and state contract, not real multi-user networking. H4 is the experiment that can turn the visible crowd from a deterministic fixture into a separate live host surface.

## Graduation decision

Graduate this privacy membrane + counterfactual frontier + epistemic multicast combination as Rung 2. It improves every judging dimension without weakening the recoverable Rung 1 golden path:

- **WebMCP leverage:** page-local evidence and tool lifetimes determine what the agent can do.
- **Execution:** native and ordinary-browser paths both complete the whole reversible loop.
- **Potential impact:** buyers reveal less while one human observation serves many private decisions.
- **Creativity and ambition:** the agent is a privacy boundary and attention coordinator, not a shopping macro.

The highest-information next experiment is H4: a local-first two-context host spike using the same domain transitions. Keep it only if the separate surface makes the 45-second story more credible and stays deterministic. If it passes, compare one real cross-client room implementation rather than adopting infrastructure by affiliation: Vercel's current realtime path versus Cloudflare Durable Objects/RealtimeKit. UCP should then own authoritative catalog, offer, cart, checkout, consent, and permalink state after the live-evidence interaction has earned that complexity. A Lean certificate should enter only when it gates a consequential, judge-visible invariant rather than decorating the architecture.
