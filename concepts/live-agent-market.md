# Live agent market: working concept

Status: frontier experiment, not final selection. Updated 2026-08-26.

## Wild north star

A live market designed for humans and their personal agents to attend together.

The host is not presenting to an undifferentiated chat feed. Every viewer can bring an agent that understands that person's intent, interrogates the live item's claims and evidence, requests the next useful demonstration, and makes only commitments authorized by an explicit mandate. The host sees structured unresolved demand rather than hundreds of repetitive comments. Products, tools, and allowed actions change with the live event.

The social video remains primary. The agent does the vigilance, constraint tracking, evidence bookkeeping, and safe action that humans are poor at during a fast show.

## Why WebMCP is central

- The live page owns the stream, show clock, current item, host answers, inventory, signed-in session, and visible activity.
- ChatGPT owns personal conversational context and reasoning that the market should not need to store wholesale.
- WebMCP exposes only the semantic operations valid in the current show state.
- Registration and removal make the tool surface ephemeral: no item means no item action; resolved evidence can unlock a reversible reservation; closing the lot removes it.
- Both the human and agent inspect the same result on the page.

If the experiment works just as well with a remote backend tool while the page is closed, the concept has failed its WebMCP test.

## Walking-skeleton question

Does this loop feel meaningfully different from ordinary shopping?

1. The human opens a simulated live snowboard show beside ChatGPT.
2. The agent records the buyer's mandate through a site tool.
3. The agent inspects the current lot and sees that one required fact is unresolved.
4. The agent requests a specific demonstration or answer from the host.
5. The request appears visibly in the show. A host answer changes the evidence state.
6. A reservation tool becomes available only when the mandate is satisfied.
7. The agent reserves the item, and the page shows a reversible, attributed commitment.

This is complete even with one item, one prerecorded clip, and a deterministic host response.

## Acceptance criteria for Rung 1

- The app remains useful in an ordinary browser without WebMCP.
- The app uses the current imperative `document.modelContext.registerTool` API.
- Tool inputs are narrow JSON Schemas and are validated again at runtime.
- The current show and lot can be inspected without mutation.
- A mandate mutation visibly updates the page.
- An evidence request visibly enters a host queue.
- The reservation tool is absent until deterministic mandate evaluation is eligible.
- Reservation is reversible; release replaces reserve in the available tool set.
- Registration cleanup uses `AbortSignal` so stale lot tools disappear.
- Every tool call records visible activity with actor, action, and outcome.
- Negative cases refuse action and return the exact unresolved or violated constraints.
- The core model and WebMCP adapter have behavioral Vitest coverage.
- Strict TypeScript, lint, tests, and production build pass.

## Rung 1 domain fixture

One pre-owned 156 cm snowboard is the active lot.

Known facts:

- Current bid and shipping determine an all-in price.
- Length is known.
- A close inspection clip supports visible edge condition.
- Prior base repair is initially unknown.

Suggested buyer mandate:

- Maximum all-in price: $450.
- Length: 154 to 158 cm.
- Visible edge-condition evidence required.
- Any prior base repair forbidden.

Initial result: unresolved because repair history is unknown. After the host answers that the base has not been repaired, the item becomes eligible and a reversible reservation becomes available.

The current walking skeleton uses an original CSS-rendered snowboard scene and no third-party media. Later footage may come from a rights-cleared Vidably demo fixture only after its exact license and challenge use are confirmed.

## State model

```text
show: preview -> live -> closed

mandate: absent -> active

current lot evidence:
  unresolved -> eligible
             -> ineligible

reservation:
  none -> held -> released
          |
          +-> expired (later rung)
```

The current implementation will not model money movement, payment, auction settlement, or autonomous background bidding.

## Tool surface

Always available:

| Tool                 | Effect                                                      |
| -------------------- | ----------------------------------------------------------- |
| `inspect_live_show`  | Read current show, lot, mandate status, and recent activity |
| `set_buying_mandate` | Replace the visible structured buyer mandate                |

Available only while a lot is live:

| Tool                  | Effect                                                         |
| --------------------- | -------------------------------------------------------------- |
| `inspect_current_lot` | Read authoritative lot facts, evidence, and mandate evaluation |

Available only when the disclosed mandate has unresolved repair history and no matching request is already queued:

| Tool                    | Effect                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `request_host_evidence` | Add one enumerated evidence request to the visible host queue |

Available only when the current lot is eligible and unreserved:

| Tool                  | Effect                                                    |
| --------------------- | --------------------------------------------------------- |
| `reserve_current_lot` | Create a reversible hold, visibly attributed to the agent |

Available only while reserved:

| Tool                  | Effect                                          |
| --------------------- | ----------------------------------------------- |
| `release_current_lot` | Release the hold and restore the eligible state |

No tool will place a binding bid or purchase in Rung 1.

## Rung 1 verification record

Implemented and verified locally on 2026-08-26:

- One polished page with shared human/tool domain actions and an ordinary-browser fallback.
- Direct async `document.modelContext.registerTool` registration with `AbortSignal` cleanup.
- Runtime Zod validation plus narrow JSON Schemas.
- Native Headless Chrome 150 execution of the entire mandate -> request -> host evidence -> reserve loop, including observed tool removal and replacement.
- Visible actor attribution and reversible human control.
- Desktop and 390 px visual checks with no page errors or horizontal overflow.
- Prettier, ESLint, strict TypeScript, 12 Vitest behaviors, and a Next.js 16.3.3 production build.

Still unverified: the connected latest Chrome 151 profile, ChatGPT's in-app Browser and model-driven calls, Voice-to-Site-Tools composition, public deployment, and long-lived navigation/reconnect behavior.

## Human interface

- Main column: vertical live video, live badge, lot facts, current price, and host state.
- Evidence rail: supported, unresolved, and violated conditions with exact provenance.
- Host queue: agent evidence requests and deterministic host response controls.
- Mandate card: all personal constraints currently shared with the page.
- Activity rail: every human and agent action in chronological order.
- Site Tools status: feature detection and currently registered tool count/names for debugging and demo legibility.

Developer-only simulation controls may invoke the same model actions in browsers without a WebMCP consumer. They must be visually subordinate and removable without changing the core loop.

## Voice, camera, and device thesis

The strongest version is not merely live shopping with voice controls. It is an **evidence-directed live market**: the buyer says what matters, the agent discovers what is still unknown, and the agent asks a person with a camera to show exactly the observation needed to make a safe decision.

The memorable loop is:

```text
spoken intent
  -> minimum necessary mandate disclosed to the page
  -> WebMCP detects a missing fact
  -> agent requests a precise physical demonstration
  -> host or buyer supplies consented camera evidence
  -> evidence changes the page's live semantic state
  -> a safe, reversible action appears
```

There are four distinct modality layers. They must not be collapsed into one unsupported "works on any device" claim.

| Layer                       | Product role                                                                                                                                                                        | Current boundary                                                                                                                                                                                                                                                          | Reliable fallback                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ChatGPT Voice -> Site Tools | The buyer speaks naturally to the same ChatGPT agent that is co-attending the page. This is the cleanest hero input if the exact desktop runtime supports the composition.          | Current OpenAI documentation separately supports Voice in Chat, Work, and Codex and Site Tools in the built-in browser, but does not explicitly promise that one Voice session can invoke Site Tools. Treat this as an urgent runtime experiment, not a submission claim. | Type or dictate the identical prompt to ChatGPT.                             |
| Page-owned voice            | A push-to-talk control uses OpenAI Realtime or transcription to produce a visible transcript and structured draft. It makes the human UI hands-free on ordinary web/mobile clients. | This is an application feature, not proof of WebMCP leverage. It must feed the same domain state that page tools expose and must not replace the ChatGPT Site Tools path.                                                                                                 | Text input and deterministic parsing for the golden fixture.                 |
| Human live media            | Cloudflare RealtimeKit can connect host and buyer audio/video across web and mobile clients. The page, not ChatGPT, owns the room and permissions.                                  | Human media participation can span supported phones and browsers; the judged WebMCP agent path is still ChatGPT desktop or compatible Chrome.                                                                                                                             | Prerecorded rights-cleared video, transcript, and host-response controls.    |
| Agent visual evidence       | A host or buyer explicitly shares a snapshot or sampled keyframe that an image-capable model turns into a cited evidence proposal for human review.                                 | GPT-Realtime-2.1 accepts image and audio input but not continuous video. Do not claim that the model watches a raw video stream.                                                                                                                                          | Precomputed evidence artifact with its source frame and uncertainty visible. |

Two-way video earns its complexity only when both cameras contribute physical context. A buyer might show a damaged part, room, outfit, or board already owned; the seller might then show compatibility, scale, condition, or provenance. The agent directs the next discriminating view and ties the resulting observation to the decision. For the snowboard fixture, buyer video is an optional later rung; host video is sufficient for the first complete loop.

Microphone and camera access must be off by default, requested in context, visibly active, and independently revocable. The page receives only the transcript, constraints, snapshots, or frames the user explicitly shares. Raw continuous media must not be described as private merely because the agent initiated it.

## Ambition ladder

Each rung must remain a complete demo when every later rung is disabled.

1. **Deterministic page loop:** prerecorded host clip, typed ChatGPT prompt, real dynamic WebMCP tools, visible evidence transition, and reversible hold.
2. **Hands-free buyer:** one spoken prompt through ChatGPT Voice if the combined runtime passes; otherwise page push-to-talk with the same visible mandate and typed fallback.
3. **Live host:** a second browser or phone joins a real media room and receives the agent's structured evidence request; the deterministic host control remains available.
4. **Camera-to-evidence:** the host submits one consented snapshot/keyframe; a model proposes a fact with source, timestamp, and uncertainty; a human accepts it before eligibility changes.
5. **Two-way physical context:** the buyer's camera supplies a second observation and the agent directs a short cross-camera inspection.
6. **Transactional and formal trust:** Shopify/UCP owns authoritative commerce state, while a proof-scoped mandate or Lean-checked invariant constrains the action.
7. **Market-scale coordination:** many buyer agents aggregate unresolved demand and direct the highest-value demonstrations without overwhelming the host.

## Forty-five-second demo

1. Show a live snowboard lot and an empty buyer mandate.
2. Say—or type if voice is unavailable—that the buyer needs a 154 to 158 cm board, under $450 all-in, with visible edge evidence and no prior base repair.
3. ChatGPT sets the mandate and inspects the lot. The page turns three conditions green and leaves repair history unresolved.
4. ChatGPT requests repair-history evidence through WebMCP. The exact request appears in the host queue.
5. The host shows the requested area or uses the deterministic host control. The cited evidence changes the final condition to green and the tool list visibly gains `reserve_current_lot`.
6. ChatGPT reserves the board. The page shows the agent-attributed hold and offers release.

The line to land: "The page did not give the agent a buy button. It gave the agent exactly the actions that became safe as the live evidence changed."

## Submission and three-minute demo strategy

The product may be wildly ambitious; the judged story must be singular. The public video should demonstrate one thesis: **"Your agent does not merely watch a live market. It can ask the physical world for the exact evidence your decision requires."**

Recommended capture: ChatGPT desktop's built-in browser and conversation are the primary screen. A host phone or second browser appears only when it answers the evidence request. The page keeps the mandate, evidence graph, host queue, current dynamic tool set, and attributed activity visible enough that the audience can distinguish real WebMCP collaboration from a generic voice assistant.

| Time      | Beat                    | What must be visible                                                                                                                                                                                                                                        |
| --------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00-0:15 | Hook and pain           | A live item is moving faster than a buyer can track constraints and verify claims. State the one-sentence thesis before naming protocols.                                                                                                                   |
| 0:15-0:35 | Speak the mandate       | The buyer gives one concise voice prompt. The page receives only the minimum structured constraints and shows exactly what was disclosed. Use typed ChatGPT input in the recorded take unless Voice plus Site Tools has passed repeatedly.                  |
| 0:35-1:05 | Reveal the gap          | ChatGPT inspects the live lot through WebMCP. Three conditions resolve; repair history remains unknown; the reservation tool is absent.                                                                                                                     |
| 1:05-1:35 | Ask the physical world  | ChatGPT calls `request_host_evidence`. The request appears on the host device; the host supplies the exact angle or answer; a source frame/transcript visibly becomes evidence.                                                                             |
| 1:35-1:55 | Unlock and act          | The final condition resolves, `reserve_current_lot` appears dynamically, the buyer approves, and the attributed reversible hold appears on the same page.                                                                                                   |
| 1:55-2:15 | Prove control           | Revoke or contradict one condition, or release the hold. The consequential tool disappears or the unsafe attempt is refused. Turn the camera off visibly.                                                                                                   |
| 2:15-2:40 | Show technical depth    | Briefly expose Site Tools/recent calls, the dynamic tool rail, and a compact architecture caption. Do not tour source files or sponsor logos.                                                                                                               |
| 2:40-2:58 | Land impact and ceiling | State what humans and agents did together that was previously impractical, then show the credible next step: many agents directing evidence, with UCP settlement and proof-scoped authority. Leave two seconds of margin under the hard three-minute limit. |

The live URL should have three progressively enhanced paths behind one coherent experience:

1. **Judge-safe path:** no sign-in, microphone, camera, second device, payment, or model latency required; a deterministic host fixture still exercises real WebMCP end to end.
2. **Hero path:** ChatGPT Site Tools plus the tested voice and live-media layers.
3. **Technical verification path:** visible feature detection, registered tools, recent calls, current state, version/revision, and a reset control so a judge can recover without our help.

A QR code may let a phone join as the host or buyer, but scanning it can never be required. Permission prompts should happen before the timed hero sequence, realtime sessions should be prewarmed, and a deterministic host response must remain one click away. The public recording can show the real two-device path; the live app must survive a judge using only keyboard and one desktop.

The submission text should mirror the four criteria and the required prompts:

- **Why WebMCP:** the open page owns ephemeral live truth, signed-in commerce state, evidence, and currently safe actions; ChatGPT owns personal reasoning and uses only page-bound tools valid at that moment.
- **Better experience:** the buyer can stay immersed and speak naturally while the agent tracks constraints, requests one discriminating demonstration, and keeps every disclosed fact and action inspectable.
- **New human-agent collaboration:** an agent directs a human camera to acquire missing physical evidence, then the page changes what the agent is allowed to do because of that evidence.
- **Implementation:** native dynamic `document.modelContext.registerTool`, shared application actions for human and agent controls, explicit lifecycle cleanup, realtime media as a progressive layer, and deterministic fallbacks and evals.

Repository and media hygiene are part of execution: keep timestamped challenge-period commits, clearly separate any pre-existing Vidably work, include a detectable open-source license and complete setup instructions, use only rights-cleared footage/music/marks, and keep the public YouTube video under three minutes with audible narration. The live URL and deterministic fixture must remain available through judging.

## Falsification criteria

Drop or substantially reframe this concept if any of these survive a real browser test:

- ChatGPT does not reliably refresh tools after registration changes.
- Confirmation and agent latency make even a deliberately paced live item unusable.
- The visible collaboration feels like a normal filter form with narration.
- Evidence requests do not create a satisfying host-buyer loop.
- The demo's most impressive moment is the video or auction UI rather than human-agent collaboration.
- A simpler non-commerce concept produces the same WebMCP leverage with much lower risk.

## Later rungs, only if Rung 1 earns them

1. Separate host and buyer pages sharing realtime show state.
2. Near-live transcription and timestamped Vidably evidence extraction.
3. Aggregated evidence requests from several audience agents.
4. UCP-backed product, cart, checkout, and post-win order state.
5. A formally verified semantic mandate and auction-state model.
6. Live broadcast through Mux or another appropriate transport.
7. Multiple real participants and agents in one show.

## Explicit non-goals for the walking skeleton

- No clone of Whatnot.
- No real payments or binding bids.
- No autonomous unattended shopping.
- No UCP implementation before the live collaboration proves itself.
- No Lean implementation before a visible invariant is stable.
- No production Vidably changes.
- No public deployment or repository action without Mark's approval.
