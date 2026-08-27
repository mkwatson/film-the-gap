# Innovation frontier and experiment register

Research state: 2026-08-26 PT. H1-H4 were frozen before the Rung 2 implementation; H5 was scoped before its camera UI implementation; H6 was frozen before the visual-proposal implementation. Descriptive labels are not proposed submission names.

## Authoritative starting point

- Recoverable historical control: commit `41ab726` (`feat: add native WebMCP live market rung`) preserves the original five-constraint flow.
- Current working behavior: a buyer or agent shares four seller-visible evidence requirements but no ceiling or profile, joins a normalized request for one missing physical fact, receives a host answer, and creates or releases a reversible exact-quote hold through dynamically registered native Site Tools.
- Progressive host behavior: with `NEXT_PUBLIC_EVIDENCE_ROOM_URL` configured, `/host` joins the buyer's temporary server-authoritative room through a fragment-carried private invite, exposes only the normalized evidence demand, and returns one reviewed answer to the buyer. Without the service, the same pages retain the deterministic local fallback.
- Historical limitation: `41ab726` received, stored, displayed, and returned `maxAllInPrice`. That is now a positive leakage control, not the current contract.
- Runtime boundary: the complete typed native sequence passes in isolated Chrome and ChatGPT desktop 26.820.60940 with GPT-5.6 Sol. Realtime voice transport/transcription/delegation passes, but the delegated task did not inherit the UI-owned Browser binding. Opt-in host camera capture, server digest verification, explicit review/manual fallback, selected-frame publication, native audit inspection, exact hold, release, remote reconnect, and Durable Object recovery pass in Chromium with a synthetic camera. A live authenticated Gateway inference, Mark's normal Chrome profile, physical-camera clean-room acceptance, public deployment, and a real phone on a second network remain open gates.

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

### H5 — A consented keyframe can make the human-sensor claim concrete

Scoped in-session before the camera UI implementation.

**Claim:** An explicitly started, video-only host camera can capture one bounded keyframe, attach structured provenance and a human repair-history attestation, and unlock the same WebMCP decision without making raw media part of shared room state.

**Pass:** Camera access is off by default; denial preserves a deterministic fallback; tracks stop after capture/unmount; the synchronized and WebMCP-visible record contains only frame ID, timestamp, dimensions, SHA-256, source kind, and label; one host confirmation updates the buyer and dynamic tool surface; and desktop/mobile layouts remain coherent.

**Fail:** Permission is implicit, raw media enters the room snapshot, the digest is presented as authenticity proof, the judged path requires a camera, or the new state breaks native tool registration.

### H6 — A model proposal can improve evidence without becoming the authority

Frozen in-session before the visual-proposal route and review UI implementation.

**Claim:** Sending one explicitly selected, digest-bound keyframe through Vercel AI Gateway can produce a useful pixel-grounded proposal, while an explicit host accept/correct step and a separate historical attestation prevent the model from becoming the purchase authority.

**Pass:** The server recomputes the JPEG digest before inference; the proposal is strict structured output bound to the exact frame; current OpenAI vision models route through AI Gateway with model fallback and zero-data-retention preference; an unavailable or unconfigured Gateway becomes an honest manual-review path; the selected frame is published only after review; the hold remains unavailable until a clear base view and non-unclear visible-surface finding coexist with the host attestation; and native WebMCP exposes the audit chain without embedding image bytes in tool output.

**Fail:** A model output alone unlocks the hold, pixels are described as proof of repair history or authenticity, a provider error breaks the judged path, a proposal can be replayed against another frame, the camera feed is uploaded automatically, or the new review step makes the short product story incoherent.

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

### E5 — Consented camera keyframe and provenance

1. Keep the permission-free host buttons as the judge-safe control.
2. Request `getUserMedia` only from an explicit host click, with `audio: false` and an environment-facing video preference.
3. Capture one bounded JPEG frame locally, compute SHA-256, discard the continuous stream, and synchronize only a strict provenance descriptor.
4. Require the host to bind either `none` or `repaired` to that frame; never infer authenticity from the digest.
5. Verify the descriptor through the native `document.modelContext` consumer API, then perform and release an exact-quote hold.

Decision rule: graduate only if the native tool surface remains dynamic, the raw frame never enters synchronized/WebMCP state, camera denial leaves the deterministic path intact, and the visual experience survives desktop and phone widths.

### E6 — Frame-cited visual proposal with human review

1. Preserve H5's explicit capture gate. Add a second explicit “Analyze” action that sends only the selected JPEG and its declared provenance.
2. Recompute SHA-256 server-side and reject mismatched bytes, malformed media, or oversized frames before any provider call.
3. Generate a strict observation with AI SDK 7 through Vercel AI Gateway, using `openai/gpt-5.6-sol` with Terra and Luna fallbacks and zero-data-retention routing preference.
4. Forbid claims about identity, intent, authenticity, price, ownership, safety, or historical repair. Require the host to accept or correct the proposed base visibility and visible surface signal.
5. If Gateway authentication or inference is unavailable, expose a typed manual-review path rather than a synthetic model answer.
6. Publish the one selected JPEG only after review, but keep its bytes out of Site Tool results. Require a separate host history attestation before the exact-quote hold appears.
7. Verify route validation, model configuration, manual fallback, cross-frame refusal, conflict refusal, two-tab propagation, selected-frame rendering, dynamic native tools, exact hold, and release.

Decision rule: graduate only if the model is useful but non-authoritative, the no-model path remains complete, and the resulting evidence chain is more legible—not merely more complicated—than the provenance-only rung.

## Current evidence-directed call

Keep the E1-E3 core plus the H4 host surface, H5 camera provenance, and H6 reviewed visual proposal as the current cumulative rung. They reinforce one sentence:

> The live market learns what proof to show, not what each buyer is willing to pay.

The original rung remains recoverable. The Voice experiment isolated a platform-ownership seam rather than a product defect: audio reaches a delegated Codex task, but that task does not inherit the UI-owned Browser. Camera transport/provenance and the reviewed visual-evidence path now pass locally. The next acceptance gate is one authenticated live AI Gateway call against a real product frame; the next product/infrastructure choice is between real cross-device room transport and the first authoritative UCP commerce object. Neither may replace the typed, one-screen golden path.

## Experiment results — 2026-08-26

### E1 — Pass: the complete loop no longer discloses a buyer ceiling

- Commit `41ab726` is the positive leakage control: `maxAllInPrice` crossed the tool schema, page state, evaluation, and visible seller surface.
- The new `set_evidence_requirements` schema accepts only length bounds, visible-edge evidence, and prior-repair policy. Strict runtime parsing rejects an added `maxAllInPrice` field.
- Recursive contract checks find no forbidden private-value key, buyer-profile phrase, or fixture ceiling in registered definitions or returned snapshots.
- `reserve_current_lot` receives only the exact public all-in quote the agent is accepting. A stale `$400` call against the current `$423` quote is refused without creating a hold; `$423` succeeds.
- Supported, incompatible, unresolved, duplicate-request, stale-request, cancellation, hold, and release behaviors pass.
- The visible privacy receipt explains the boundary in two sentences.

Limitation: withholding direct profile and ceiling fields minimizes disclosure; it does not prove that a seller can never infer preferences from behavior. The product and documentation now state that explicitly.

### E2 and H2 — Pass in isolated Chrome and the exact ChatGPT client

- Isolated Headless Chrome 150 discovered exactly the three initial tools, executed `set_evidence_requirements`, observed `request_host_evidence` appear, executed it, and observed it disappear.
- One visible host answer unlocked `reserve_current_lot`. Native execution rejected stale `$400`, accepted exact `$423`, replaced reserve with release, and restored the prior surface after release.
- The page and every read result exposed the same smallest valid next transition; impossible mutations remained unregistered. The stale-evidence and stale-quote paths returned concrete recovery actions.
- Fresh isolated profiles in the installed Chrome 151.0.7922.174 rendered `Site Tools live` with `--enable-features=WebMCP` and `Browser fallback` with the feature disabled.
- The ordinary-browser human flow completed share → request → host answer → hold → release. Desktop and 390 px layouts had no framework overlay or horizontal overflow.

The exact ChatGPT evidence is recorded separately below. These results do not establish Voice-to-Site-Tools composition, Mark's normal Chrome profile, or every future ChatGPT/Chrome release; those remain explicit gates.

### E3 — Pass as a transparent deterministic room fixture

- Seven anonymous `repair_history` demand signals are present initially.
- The current agent's real request changes the aggregate to eight queued requests.
- One host answer changes the same aggregate to eight resolved requests.
- Stored demand contains only evidence kind, count, and status; the current request retains action attribution but no buyer profile or price.
- The UI labels the other seven agents as a demo-room fixture and lands the multicast effect as “One answer → 8 private decisions.”
- Only identical evidence kinds aggregate; unsupported or no-longer-useful requests are refused.

This proves the interaction and state contract, not real multi-user networking. H4 is the experiment that can turn the visible crowd from a deterministic fixture into a separate live host surface.

### Exact ChatGPT in-app Browser — Pass for the complete typed core flow

- ChatGPT desktop 26.820.60940 with GPT-5.6 Sol connected its built-in Browser to the visible local production page and discovered exactly the three valid initial Site Tools.
- A model-driven native call to `set_evidence_requirements` sent only the four public product fields. The returned receipt listed the buyer ceiling, willingness to pay, profile, and urgency as not collected.
- The native tool surface followed the live state exactly: three initial tools → four with `request_host_evidence` → three after the request queued → four with `reserve_current_lot` after the host answer → three with `release_current_lot` while held → four again after release.
- `request_host_evidence` changed the aggregate from seven fixture signals to eight private decisions represented by one normalized question. One visible host answer supplied timestamped provenance and made the lot eligible.
- A native exact-quote hold attempt at stale `$400` was refused against the current `$423` quote. Retrying with `$423` created a reversible local hold without payment; release succeeded and restored the reserve surface.
- No browser warnings or errors appeared. No confirmation UI surfaced for this local, non-payment hold; that is an observed result for this action, not a claim that purchases or other consequential actions bypass normal confirmation.
- Machine-local screenshots are retained outside the repository from initial discovery through release.

This closes the most important typed judge-client compatibility gate. Voice transport/delegation is now measured separately below; a supported Browser handoff, repeated navigation/reconnect behavior, and a clean-room run on Mark's MBP remain acceptance work.

### E4 and H4 — Pass locally; keep as a progressive hero layer

- Separate buyer `/` and host `/host` pages completed request-to-answer propagation through a same-origin `BroadcastChannel` room.
- A late-joining host recovered current state, and refreshing the buyer recovered the resolved state while the host remained open.
- The host saw only four normalized evidence fields and “8 private decisions need one fact”; no price, ceiling, profile, or urgency crossed the seller surface.
- Desktop and 390 px two-view checks passed without browser errors, framework overlays, or horizontal overflow.
- The in-page host answer remains available, so a judge can complete the exact same domain transition without a second tab or device.

Decision: **keep H4 as progressive enhancement.** It materially improves the collaboration story without weakening the deterministic path. Its current transport proves same-browser coordination, not a real networked room; a public phone/desktop room must compare a narrowly scoped realtime transport before making cross-device claims.

### Voice composition — Transport passes; Browser handoff remains unproven

- A signed-in, headless ChatGPT Realtime WebRTC session received the spoken mandate over real Opus/RTP, produced the correct transcript, and delegated it to native Codex.
- The delegated task initialized a browser runtime but did not inherit the existing UI-owned in-app Browser binding. It therefore performed no Site Tool call and sent no buyer ceiling or other state to the page.
- Attempts to seize or silently reroute the UI-owned task were stopped. This is the correct security/ownership boundary, not a reason to build an unsupported bypass.
- The typed Site Tools path remains the reliable acceptance path. A one-click human Voice/browser handoff is acceptable unless the first-party client exposes supported composition during the challenge.

Decision: **keep Voice as a progressive input, not a submission dependency.** Re-test when the exact ChatGPT client changes; do not claim autonomous spoken completion yet.

### E5 and H5 — Pass locally with synthetic camera input

- The host camera is off by default and starts only from `Start camera`; constraints request video only and prefer the environment-facing camera.
- The successful browser run used Chromium's synthetic camera source. It captured a real 960×540 JPEG through `getUserMedia`/canvas, computed SHA-256 locally, stopped the stream, and displayed the selected keyframe for host review.
- Publishing `no prior repair` synchronized only strict provenance: `camera-keyframe`, frame ID, UTC capture time, dimensions, digest, and label. Raw bytes/blob URLs were absent from room snapshots and WebMCP results.
- The buyer immediately changed to 3/3 supported and exposed `reserve_current_lot`. Native `document.modelContext.executeTool` returned the camera descriptor, created the exact `$423` reversible hold, changed the registered surface to `release_current_lot`, and released successfully.
- The permission-denial/retry path and track cleanup pass component tests; the permission-free fixture remains beside the camera controls.
- Desktop camera/captured/buyer-ready views and a 390×844 host view had meaningful content, no framework overlay, no console/page errors, and no horizontal overflow.
- Five machine-local acceptance screenshots are retained outside the repository from host request through mobile resolved state.
- The then-current full gate passed: formatting, zero-warning ESLint, strict TypeScript, 31 Vitest behaviors, and a Next.js 16.3.3 production build.

Decision: **graduate H5 as the current camera/provenance rung.** A SHA-256 digest is a content fingerprint, not authenticity evidence. The next rung must propose a cited visual fact for human acceptance; it must not claim that the model watched continuous video or independently proved repair history.

### E6 and H6 — Product path passes; authenticated model call remains open

- The app now installs AI SDK 7.0.79 and uses a plain Gateway model ID, which makes Vercel AI Gateway the default provider. The route selects `openai/gpt-5.6-sol`, then configures `gpt-5.6-terra` and `gpt-5.6-luna` as model fallbacks with `zeroDataRetention: true`. These IDs and image-input capabilities were re-read from the unauthenticated live Gateway model catalog on 2026-08-26 rather than assumed from memory.
- `POST /api/evidence/propose` accepts one JPEG no larger than 650 KB, validates its bounded dimensions and derived frame ID, recomputes SHA-256 from the received bytes, and refuses a mismatch before inference.
- The AI prompt and Zod output schema permit only base visibility, visible surface signals, confidence, pixel-grounded details, a short summary, and a suggested next view. The server excludes image-bearing request messages/bodies from AI SDK result retention.
- A model response remains a proposal. The host must accept or correct it; the audit record preserves the model ID, original proposal, reviewed finding, decision, frame ID, and digest. Manual review records `modelId: null` and never masquerades as an AI result.
- The state machine refuses an unreviewed camera attestation, a review bound to another frame, an unclear/unusable view, a no-repair attestation that conflicts with a visible possible-repair signal, or a camera answer that omits the intentionally public selected JPEG.
- The local machine has neither `AI_GATEWAY_API_KEY` nor `VERCEL_OIDC_TOKEN`, so the real browser run correctly exercised `gateway-unconfigured` → manual review. Unit/API tests inject a typed model result and verify the exact Sol → Terra → Luna Gateway configuration without making a network-billed call.
- The browser run completed capture → server digest verification → typed manual fallback → host selections → review receipt → selected-frame publication → buyer 4/4 evidence → native WebMCP inspect → exact `$423` reserve → dynamic release → release. Tool output exposed the full provenance/review chain and `selectedFramePubliclyVisible: true`, but contained no `data:image` payload.
- The live feed remained local. Only one explicitly analyzed/published JPEG crossed the boundary. The buyer view visibly rendered that JPEG alongside the reviewed observation and the warning that pixels cannot establish historical repair.
- Formatting, zero-warning ESLint, strict TypeScript, 41 Vitest behaviors across 9 files, and the Next.js 16.3.3 production build pass. Browser console and page-error logs are empty. Desktop host/buyer and 390×844 buyer screenshots are retained outside the repository.

Decision: **graduate H6 as the current product path, with one narrow acceptance caveat.** The manual fallback, review authority, published-frame UX, and WebMCP lifecycle are real and pass. Do not claim a live GPT-5.6 visual result until this project receives Gateway auth and the same flow passes against a staged physical product frame.

## Graduation decision

Graduate this privacy membrane + counterfactual frontier + epistemic multicast combination as Rung 2. It improves every judging dimension without weakening the recoverable Rung 1 golden path:

- **WebMCP leverage:** page-local evidence and tool lifetimes determine what the agent can do.
- **Execution:** native and ordinary-browser paths both complete the whole reversible loop.
- **Potential impact:** buyers reveal less while one human observation serves many private decisions.
- **Creativity and ambition:** the agent is a privacy boundary and attention coordinator, not a shopping macro.

H4-H6 and the typed exact-ChatGPT path pass, subject to the authenticated Gateway caveat above. Voice transport passes but exact Voice-to-UI-owned-Browser composition does not. The next sequence is now: authenticate and blind-check the visual proposal on a staged physical frame; rehearse the 45-second two-surface story; then choose the next product rung by information value—real phone/desktop room transport or an authoritative UCP product/offer/checkout seam. UCP should own catalog, offer, cart, checkout, consent, and permalink state rather than being reduced to a logo-bearing API call. A Lean certificate should enter only when it gates a consequential, judge-visible invariant rather than decorating the architecture.

## Strategic reset and next frozen experiments — 2026-08-26

The broad challenge, field, sponsor, Vidably, UCP, math, and clean-sheet concept audits converge on one update: keep the completed core, but reframe the ambition as a **live evidence exchange / Reality API**. Commerce remains the clearest first outcome; it is not the primitive itself.

The preceding graduation decision remains valid evidence of the local rung. This reset supersedes only its proposed next-step ordering. A simulated crowd, same-browser `BroadcastChannel`, synthetic camera, unauthenticated model fallback, and local reversible hold are not enough to support the final impact/execution story, even though each is an honest and useful fallback.

### E7 — Real two-client physical-world event

Frozen claim:

> A buyer-side WebMCP request can cause a separately connected seller phone to acquire one fresh physical observation, and the reviewed result can update the buyer's visible state without sharing private price/profile fields.

Protocol:

1. Preserve the current local resettable fallback unchanged.
2. Join buyer and seller through a short room code or QR URL on separate devices and networks.
3. Use revisioned server-authoritative state with ordered updates, reconnect recovery, idempotent request handling, expiry, and a bounded room lifetime.
4. Use one owned, rights-cleared physical object. Capture a real phone-camera frame only after an explicit host gesture.
5. Synchronize only the reviewed frame/evidence packet intended for publication; never synchronize the private ceiling or raw continuous feed.
6. Complete the native Site Tools flow in the exact ChatGPT client and current Chrome build, then repeat after buyer refresh and host reconnect.
7. Record first-connect latency, request-to-cue latency, evidence-to-state latency, duplicate behavior, recovery, and every transmitted field.

Decision rule: graduate only if the remote event is visibly causal, survives reconnect, has no silent stale state, and remains understandable without explaining the transport. Compare a minimal Vercel WebSocket implementation with a Cloudflare Durable Object room; choose the one that is more reliable and legible, not the one with more sponsor logos.

#### E7.1 — Authoritative transport checkpoint

Status: **Cloudflare transport selected and locally proven; app integration and real-device graduation pending.**

- Re-read the current Vercel WebSocket and Cloudflare Durable Object/Hibernation/testing documentation on 2026-08-26 PT. Vercel's newer guidance supports WebSockets but requires an experimental Next upgrade API, Redis/pub-sub across Function instances, reconnect at maximum duration, and reconciliation with an older limits page that still denies server support. One Durable Object directly owns the ordered room, storage, sockets, hibernation recovery, and expiry.
- Added a standalone Worker package pinned to Wrangler 4.126.0, `@cloudflare/vitest-plugin` 1.1.0, Workers types 5.20260827.1, Vitest 4.1.11, TypeScript 5.9.3, and Zod 4.4.3. It uses the current declarative `exports` configuration and SQLite storage rather than a legacy migration.
- `POST /rooms` returns short-lived buyer and host role credentials; only SHA-256 digests enter room storage. WebSocket URLs contain the six-character room ID but no token. Browser origins are allowlisted before a Durable Object is invoked.
- The first socket frame authenticates a role. Subsequent commands pass through a strict shared schema and the existing guarded market state machine. The server—not either client—owns revision, authorization, bounded duplicate history, current state, and expiry.
- Six tests run inside the current Workers runtime: unique role credentials/CORS, hostile-origin refusal, buyer → host → buyer evidence propagation, role escalation refusal, stale-write refusal, duplicate replay, state and authenticated-socket recovery after forced Durable Object eviction, and alarm-driven deletion/peer closure.
- The Worker dry-run bundle is 599.57 KiB (90.93 KiB gzip). The combined deterministic gate is now 45 app tests plus 6 Workers-runtime tests.

The checkpoint does **not** yet satisfy E7: the Next app still uses its existing same-browser room, no public Worker has been deployed, and no physical phone has joined. Next, replace closure-based page mutations with serializable commands, add a reconnecting browser client and fragment-carried host invite, then run the real phone/desktop path. The public JPEG must also be reduced below Cloudflare's 2 MB stored-value ceiling; continuous video and private buyer context remain out of the protocol.

#### E7.2 — Browser integration checkpoint

Status: **application integration and remote-camera path proven locally; public deployment and physical-phone graduation pending.**

- Every human control and native Site Tool now dispatches the same strict serializable `RoomCommand` through the same guarded state machine. The local `BroadcastChannel` path remains available when no room service is configured.
- The remote browser client authenticates in the first WebSocket frame, keeps credentials out of URLs, allows one command in flight, waits for the authoritative snapshot before resolving a Site Tool call, and replays an unacknowledged command with the same command ID after reconnect. Server revisions, duplicate history, and role authorization remain authoritative.
- The buyer creates a two-hour room and displays a six-character code plus explicit host invite. The host credential is carried in the URL fragment, copied into session storage, and stripped from address history immediately; buyer and host credentials never enter durable page state or Site Tool results.
- A native Chrome WebMCP run completed requirements → remote host request → separate host answer → 4/4 supported → stale-price refusal → exact `$423` hold → release. Buyer and host refreshes recovered the authoritative state.
- Stopping and restarting Wrangler cleared peer presence, triggered bounded reconnect backoff, recovered the same Durable Object state, and restored both peers without duplicating commands. A second run published a reviewed 960×540 synthetic-camera JPEG through the room; the buyer rendered the same selected frame and remained ready after another Worker restart.
- Camera encoding now tries progressively smaller JPEG qualities and refuses publication above 650 KB. The strict room schema permits at most 900,000 data-URL characters, comfortably below Cloudflare's 2 MB value limit while leaving room for the rest of the snapshot.
- The combined gate passes: formatting, zero-warning ESLint, strict TypeScript, 54 app tests across 12 files, 6 Workers-runtime tests, a Wrangler 4.126.0 dry-run, and the Next.js 16.3.3 production build. Browser console and page-error logs were empty.
- Fresh 390×844 buyer and host captures had no horizontal overflow. The complete state remained legible: room linkage, privacy boundary, reviewed public frame, 4/4 support, exact-price action, and host-visible aggregate all survived the narrow layout.

This is a real network protocol between two separately authenticated React clients, but both acceptance clients still ran as tabs on the Mac mini and the camera was Chromium's synthetic device. Do not call E7 graduated until an HTTPS deployment passes on a physical phone and the judged desktop client, including reconnect and a rights-cleared object.

### E8 — Authoritative UCP commerce boundary

Frozen claim:

> Reviewed evidence can unlock a real merchant cart/handoff whose price, product, and continuation state are authoritative outside the demo app.

Protocol:

1. Use an owned Shopify development-store product and cleared media for the judged path.
2. Fetch the merchant/platform profile and negotiate the actually advertised UCP version/capabilities. Do not assume the canonical `2026-08-25` schema when Shopify advertises `2026-04-08`.
3. Use Global/Storefront Catalog or Cart MCP as documented; preserve the merchant's exact live schema and continuation URL.
4. Let WebMCP own only the situated live evidence/request/action frontier. Do not duplicate Shopify's generic catalog/cart tools.
5. Create the cart or permalink only after evidence requirements are supported and after normal ChatGPT confirmation behavior. Do not complete payment in the hero path.
6. Test expiry, stock/price change, unsupported capability, merchant failure, and fallback to the local reversible hold.

Decision rule: graduate only if the resulting cart/handoff is externally authoritative, dynamically negotiated, visible to the user, and clearer than the local hold it replaces.

### E9 — Submission-grade Agent Experience

Frozen claim:

> An unfamiliar judge can understand and complete the core flow in the current ChatGPT/Chrome clients without setup rescue, while the video and repository prove the same lifecycle even if the judge never runs it.

Protocol:

1. Reduce overlapping read tools and keep common tool results near Chrome's recommended context budgets; move verbose audit material behind a separate read path or visible UI.
2. Run direct, ambiguous, corrective, canceled, duplicate, stale-state, confirmation, reconnect, and full-journey prompts using Chrome's WebMCP eval guidance.
3. Capture Chrome DevTools registration/invocation history and, when available, an independent Netlify AXIS report.
4. Add one-click reset, preflight status, camera/model/UCP fallbacks, no-login testing instructions, and a copyable canonical prompt.
5. Rehearse the 45-second causal story and a `2:45` video cut. The first 30 seconds must show private mandate → remote cue → physical evidence, not architecture.
6. Run clean profiles on the judged clients, mobile/desktop accessibility checks, production build, public-link health, license/repository checks, and rights review.

Decision rule: graduate only if the golden path passes repeatedly from a clean state and the description/video/README each make the project independently understandable.

#### E9.1 — Compact tool contract result

Status: **deterministic and native-Chrome pass; exact ChatGPT rerun pending.**

- Re-read the current OpenAI Site Tools page, Chrome best practices/evals, and rendered WebMCP draft on 2026-08-26 PT.
- Removed `inspect_current_lot`, whose implementation and output duplicated `inspect_live_show`. The initial surface is now one read plus one bounded write.
- Rewrote tool descriptions around the positive action and state in which it is useful.
- Replaced the verbose audit snapshot with a decision packet capped at 3,500 serialized characters in every common tested state. Full activity and pixel presentation remain visible in the human UI; the tool packet retains only information needed for the next agent action.
- Native isolated Chrome passed discovery and execution across `2 → 3 → 2 → 3 → 2 → 3` tools, including dynamic request disappearance, stale-quote refusal, exact hold, and release. The browser showed every state change with no page errors.
- Formatting, zero-warning lint, strict TypeScript, 42 tests across 9 files, and the Next.js production build pass.
- Do not graduate E9 from this sub-result: the current two-tool initial surface still needs direct and ambiguous model-driven prompts in the exact ChatGPT client, plus cancellation/duplicate/reconnect datasets and public-origin clean-room testing.

### E10 — Frontier receipt (optional)

Only after E7-E9 pass, test whether a runtime-connected Lean receipt can communicate in under ten seconds that a stale quote/evidence revision or unauthorized transition is refused. The theorem may cover the formal state model and payload projection only. It must not claim to prove image truth, seller honesty, browser conformance, or implementation equivalence.

Decision rule: integrate only if a non-technical viewer understands the consequence immediately and the proof service cannot destabilize the hero flow. Otherwise preserve the proof-carrying Site Tool constitution as a post-challenge branch.
