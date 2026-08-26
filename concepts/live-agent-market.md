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

The footage comes from Vidably's existing public demo fixture. Asset rights must be reconfirmed before any public challenge deployment.

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

| Tool                    | Effect                                                         |
| ----------------------- | -------------------------------------------------------------- |
| `inspect_current_lot`   | Read authoritative lot facts, evidence, and mandate evaluation |
| `request_host_evidence` | Add one enumerated evidence request to the visible host queue  |

Available only when the current lot is eligible and unreserved:

| Tool                  | Effect                                                    |
| --------------------- | --------------------------------------------------------- |
| `reserve_current_lot` | Create a reversible hold, visibly attributed to the agent |

Available only while reserved:

| Tool                  | Effect                                          |
| --------------------- | ----------------------------------------------- |
| `release_current_lot` | Release the hold and restore the eligible state |

No tool will place a binding bid or purchase in Rung 1.

## Human interface

- Main column: vertical live video, live badge, lot facts, current price, and host state.
- Evidence rail: supported, unresolved, and violated conditions with exact provenance.
- Host queue: agent evidence requests and deterministic host response controls.
- Mandate card: all personal constraints currently shared with the page.
- Activity rail: every human and agent action in chronological order.
- Site Tools status: feature detection and currently registered tool count/names for debugging and demo legibility.

Developer-only simulation controls may invoke the same model actions in browsers without a WebMCP consumer. They must be visually subordinate and removable without changing the core loop.

## Forty-five-second demo

1. Show a live snowboard lot and an empty buyer mandate.
2. Tell ChatGPT the buyer needs a 154 to 158 cm board, under $450 all-in, with visible edge evidence and no prior base repair.
3. ChatGPT sets the mandate and inspects the lot. The page turns three conditions green and leaves repair history unresolved.
4. ChatGPT requests repair-history evidence. The request appears in the host queue.
5. The host answers on camera or through the host control. The final condition turns green and the tool list visibly gains `reserve_current_lot`.
6. ChatGPT reserves the board. The page shows the agent-attributed hold and offers release.

The line to land: "The page did not give the agent a buy button. It gave the agent exactly the actions that became safe as the live evidence changed."

## Three-minute demo spine

1. Problem: live shopping moves too quickly for a buyer to remember every personal constraint, verify every claim, ask the right question, and act safely.
2. Human-agent division: the human watches and judges the host; the agent tracks the mandate and evidence; the page owns current live truth and actions.
3. Run the full walking-skeleton loop.
4. Reveal dynamic WebMCP registration and the visible activity trace.
5. Show a negative control: change the budget or host answer so the reservation tool disappears and a direct attempt is refused.
6. North star: mixed human-agent audiences, live evidence direction, UCP settlement, and proof-scoped delegation.

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
