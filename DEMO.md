# Demo production packet

Updated 2026-08-27 PT. This packet turns the tested product lifecycle into one honest `2:45` story. It does not authorize recording a rights-cleared object, publishing a video, or using a final project name; Mark owns those choices.

## The one thing viewers must remember

> A private agent can ask the physical world for the smallest missing fact, let one human answer many private decisions, and expose a new action only when the resulting evidence makes it safe.

The opening must land that idea before the audience hears “Durable Object,” “AI Gateway,” or “UCP.” The technical stack is the receipt, not the premise.

## Primary capture layout

- Record a clean `1920×1080`, 30 fps source with browser zoom and text large enough to survive Devpost/YouTube compression.
- Keep ChatGPT and the buyer page together for the first minute. Site Tools calls, their compact outputs, and the corresponding visible page change must appear in the same causal sequence.
- Introduce the host phone only when the request arrives. Crop away notifications, status-bar personal data, room credentials, device logos, and unrelated apps. The phone browser does not need WebMCP.
- Show the merchant as a visibly separate origin only after evidence and the hold unlock it.
- Record narration cleanly without music. Preserve a full uninterrupted source take; edits may remove waiting time but must not reorder or fabricate tool results.
- Use an owned, unbranded physical object and a rights-cleared background. Check every visible mark, image, sound, notification, and browser profile before capture.

## Exact prompts

Private setup, entered only in ChatGPT:

> My maximum all-in price is $450. Keep that private and never send it to the website.

Product-only starter, copied from the page:

> Inspect this live show using its Site Tools. Keep the private maximum I gave you in our conversation and never send it to the website. I need a 154–158 cm board, visible edge evidence, and no prior base repair. Share only those four product-evidence fields, ask the host for any missing evidence, and stop before creating a hold.

After the host publishes:

> Re-inspect. If all requirements are supported and the exact quote is within my private maximum, create only the reversible hold at the exact current quote. Then prepare the authoritative merchant cart. Stop before any checkout or payment.

On the merchant continuation:

> Inspect this exact cart, then cancel it. Do not order or pay.

Back in the evidence room:

> Reconcile the merchant cancellation, release the hold, and confirm that the private handoff is gone.

Do not rescue the model with tool names during the recorded primary take. If the prompt needs rescue, preserve the failed take, improve the product contract or prompt, and rerun from reset.

## Timed cut and narration

The narration below is roughly 330 words. Read it conversationally, leaving the visual transitions room to breathe.

| Time        | Required visual proof                                                                                                               | Narration                                                                                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0:00–0:12` | ChatGPT beside the buyer page; host phone visible but idle.                                                                         | “Shopping agents are powerful when a page already knows the answer. But many decisions depend on a physical fact nobody captured: an edge, a noise, or whether this board was ever repaired.”                                                                                                                |
| `0:12–0:28` | Enter `$450` only in ChatGPT; paste the product-only starter. The page still has no private input.                                  | “Here I tell ChatGPT my real all-in limit—four hundred fifty dollars. That stays in our conversation. The live market has no budget or identity field; I send only four things the product must prove.”                                                                                                      |
| `0:28–0:48` | Native inspect and requirements calls; visible `154–158`, edge required, repair forbidden; hold absent.                             | “Through native Site Tools, ChatGPT reads the exact live lot and shares a 154-to-158-centimeter range, visible edges, and no prior base repair. Length and edges resolve. Repair history is still unknown, so no hold tool exists.”                                                                          |
| `0:48–1:06` | Host request call; phone changes to `8 private decisions need one fact`; host receipt excludes private fields.                      | “Instead of guessing, the agent asks the host one product question. Seven other test-agent decisions need the same fact. On the seller’s phone, eight private needs become one useful public request—without eight profiles or budgets.”                                                                     |
| `1:06–1:30` | Explicit video-only camera start, owned item, selected frame, bounded proposal, host review, separate history attestation, publish. | “The host chooses what to show. Camera access is video-only and explicit. One selected frame gets a timestamp, dimensions, and a SHA-256 fingerprint. AI proposes only what pixels support; the host reviews it and separately attests repair history. Continuous video never enters the room.”              |
| `1:30–1:48` | Buyer turns supported; hold tool appears; exact `$423` hold after ChatGPT's private comparison.                                     | “That one answer updates every waiting decision. The page now registers a hold tool that literally did not exist before. ChatGPT compares the public four-hundred-twenty-three-dollar quote to my private ceiling and creates only a reversible hold.”                                                       |
| `1:48–2:10` | Prepare Cart; second-origin receipt shows UCP `2026-08-25` and `$375 + $48 = $423`.                                                 | “Now the evidence room can ask a separate merchant to prepare a UCP Cart. The merchant—not this demo page—owns its lifecycle and exact math: three hundred seventy-five dollars plus forty-eight shipping equals four hundred twenty-three. No identity, address, payment, or ceiling crossed the boundary.” |
| `2:10–2:27` | Merchant inspect/cancel; return to room; handoff purged, cancel gone, release present.                                              | “On that second origin, WebMCP can inspect or cancel, but cannot order or pay. I cancel. Back in the room, the private continuation is purged, the cancel capability disappears, and the hold becomes releasable.”                                                                                           |
| `2:27–2:40` | Minimal architecture card, then one frame of tool churn/provenance receipts.                                                        | “Underneath, ChatGPT, native page tools, two Cloudflare Durable Object authorities, a human camera, Vercel AI Gateway, and open UCP compose one auditable action—not one centralized assistant pretending to know everything.”                                                                               |
| `2:40–2:45` | Buyer and host privacy receipts side by side.                                                                                       | “The market learned what proof to show—not what I would pay.”                                                                                                                                                                                                                                                |

If the live Gateway returns the manual-review fallback during the final take, replace “AI proposes” with “The host reviews exactly one selected frame” and omit AI Gateway from the architecture line. Never narrate a model call that the recorded take did not complete.

## Architecture card

Use only five labeled nodes and one highlighted causal chain:

```text
private ChatGPT mandate
        │ four evidence fields
        ▼
native WebMCP buyer page ── one normalized question ──▶ human host camera
        │ reviewed public evidence                           │
        ▼                                                    │
Cloudflare evidence authority ◀──────────────────────────────┘
        │ exact quote + fixed variant; no private mandate
        ▼
separate UCP merchant ──▶ reversible Cart; no order or payment
```

Animate or highlight only the active arrow; do not add sponsor logos or a product-name title. Three seconds is enough because the audience has already seen every boundary operate.

## Reproducible continuity capture

The native acceptance runner can emit twelve full-page milestone stills from the same journey it asserts. This is useful for edit planning, backup inserts, submission screenshots, and visual regression—not as a substitute for model-driven ChatGPT evidence.

```bash
EVIDENCE_ACCEPTANCE_APP_URL=https://app.example \
EVIDENCE_ACCEPTANCE_ROOM_ORIGIN=https://room.example \
EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN=https://merchant.example \
EVIDENCE_ACCEPTANCE_ARTIFACT_DIR=tmp/final-demo-rehearsal \
EVIDENCE_ACCEPTANCE_CAPTURE_PAUSE_MS=750 \
EVIDENCE_ACCEPTANCE_RECORD_VIDEO=1 \
pnpm acceptance:native
```

The optional WebM records only the buyer-tab state progression; the twelve stills cover buyer, host, and merchant surfaces. `tmp/` is ignored. The host fragment is scrubbed before its first capture, and successful runner output still contains only phase timings. Before using any still, visually inspect it for a development hostname, personal data, third-party marks, and private credentials.

## Take matrix

Capture these independently so one permission or network failure cannot destroy the edit:

1. **Primary real take:** final ChatGPT build, final public origins, physical phone, owned object, real camera, live reviewed model proposal if it passes.
2. **Permission-free take:** exact same native Site Tools/UCP sequence with **Show base · no repair**. Keep as judge-safe proof and edit insurance; label the fixture if shown.
3. **Phone close-up:** request arrival → camera/review → published receipt, with no buyer screen visible.
4. **Merchant close-up:** active Cart → native inspect → cancel → cancelled state.
5. **Recovery take:** reset once from a stale or interrupted state; retain as backup, not the primary cut.
6. **Silent screen master:** uninterrupted full journey with no narration, notifications, mouse wandering, or editor overlays.
7. **Narration master:** clean audio recorded separately after the visual timing is locked.

## Pass/fail review before upload

- A first-time viewer can answer by `0:30`: what stayed private, what crossed to the page, and why ChatGPT needed WebMCP.
- By `1:10`, the viewer has seen the host receive one useful request from eight private decisions.
- By `1:50`, the viewer has seen physical evidence cause a real tool to appear—not merely a green badge.
- By `2:15`, the separate merchant owns an exact Cart and the numbers reconcile visibly.
- Cancellation and capability removal are visible, not narrated off-screen.
- “Native Site Tools,” human page change, and second-origin WebMCP are visible enough to score the first tie-breaker.
- No claim exceeds the exact take: fixture crowd is labeled; hash is a fingerprint, not authenticity; host attestation owns history; no checkout/payment exists.
- No secrets, host fragments, continuation paths, personal notifications, unlicensed media, or unrelated trademarks appear.
- Audio is intelligible at phone volume; captions are corrected manually; final duration is below `3:00`.
- The public YouTube link works logged out and matches the frozen commit/live deployment recorded in `SUBMISSION.md`.

Run one silent cold-view test before upload: show the cut once to someone unfamiliar with the project, ask them to explain it without prompts, and record their exact confusion. Fix the edit or interface—not their answer—then repeat.
