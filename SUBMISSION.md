# Submission control packet

Updated 2026-08-27 PT. This is the candidate Devpost copy, judge runbook, claims ledger, and freeze checklist for the standalone product-evidence network. It describes only the generic evidence branch. The older live-shopping, private-price, UCP, and Lean rungs are not the submission hero.

The official FAQ says the entrant—not AI—must name the project. Every label below is descriptive until Mark chooses the submitted name.

## The whole product in one sentence

> When a shopper asks something the web cannot prove, ChatGPT creates the exact filming request, a person with the product records and reviews the evidence, and ChatGPT updates its answer with a timestamped video citation.

## Asset manifest

| Submission asset         | Final value                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| Project name             | **[MARK CHOOSES — AI MUST NOT NAME]**                                |
| One-line hook            | If the web cannot prove it, ask someone with the product to film it. |
| Live URL                 | **[PENDING USER-APPROVED GENERIC DEPLOYMENT]**                       |
| Public repository        | **[PENDING USER-APPROVED GENERIC BRANCH PUBLICATION]**               |
| Demo video               | **[PUBLIC YOUTUBE URL, WITH AUDIO, UNDER 3:00]**                     |
| Submitted revision       | **[FROZEN TAG, COMMIT SHA, AND DEPLOYMENT RECEIPTS]**                |
| Primary judged clients   | ChatGPT in-app Browser; Chrome 149+ with WebMCP enabled              |
| Entrant / representative | **[MARK CONFIRMS]**                                                  |
| Open-source license      | [MIT](LICENSE), copyright Mark Watson                                |

## Devpost short description

Product pages answer the questions their authors anticipated. Shoppers often need something more specific: does this bottle actually leak upside down, can this microphone charge while recording, or how loud is this appliance in a quiet room?

This app lets ChatGPT inspect the evidence for any product question. If existing pages and public videos do not prove the answer, WebMCP gives ChatGPT a narrow tool to create one observable filming mission. An opted-in person with the product opens a no-login phone link, records a continuous video, reviews or corrects the AI's timestamped proposal, and publishes it. The original answer then visibly changes from “not enough proof” to supported, contradicted, mixed, or still inconclusive—with the decisive interval attached.

The prototype demonstrates a new open-web loop: agents identify exactly what knowledge is missing; people capture the physical evidence only they can provide; and both work from the same revisioned, inspectable page state.

## Required Devpost answers

### Why is this use case a strong fit for WebMCP?

The useful tools depend on the exact product, question, sources, filming mission, contributor status, and reviewed evidence visible on the page right now. WebMCP lets the site expose that live capability frontier directly to ChatGPT: inspect the current evidence, search available public leads, create one bounded filming mission, create its phone handoff, and—only after evidence arrives—inspect exactly how the answer changed.

That state dependence is the product. Mission creation disappears once a mission is open; the phone-link action appears only when it is valid; answer-difference inspection appears only after reviewed evidence is published. A detached backend tool or DOM-driving agent would lose the human-visible context, lifecycle, and shared authority that make this collaboration understandable and safe.

### How does it create a better user experience?

The shopper asks the question they actually care about instead of translating it into search keywords and watching unrelated reviews. The app distinguishes marketing claims, public discovery leads, and decision-grade evidence rather than collapsing all three into “sources.” When the answer is missing, ChatGPT requests only the smallest useful recording instead of guessing or asking a person to make a whole review.

The contributor needs no account or app. Their phone shows the product question, exact recording instruction, success criterion, minimum duration, and whether cuts are allowed. Video uploads directly to Cloudflare Stream. AI proposes a result and the smallest relevant interval, but the contributor must review or correct the result, wording, confidence, continuity, timestamp, rights, and attribution before anything can affect the answer. The shopper page updates live and shows the before/after answer with its citation.

### What can people and agents do together that was difficult or impossible before?

An agent can now turn its own uncertainty into a precise request for new physical-world evidence, while a person remains in control of what is recorded and what the recording actually establishes. Neither side can complete the loop alone: ChatGPT knows which fact blocks the shopper's decision and can formulate the minimum test; the contributor has the product, camera, and judgment; the page joins them through one shared, revisioned case.

The working prototype proves the complete causal loop on an ordinary product: an unproven claim becomes a WebMCP filming mission, a real phone video becomes human-reviewed evidence, and that new evidence materially changes the answer ChatGPT receives. The broader opportunity is a compounding evidence layer for products: future agents can search what has already been shown, and only ask people to film the gaps that remain.

### How was WebMCP implemented?

The Next.js page registers native tools through `document.modelContext.registerTool`. Up to six narrow tools are selected from current state:

- `inspect_product_evidence`
- `ask_product_question`
- `search_product_evidence`
- `create_filming_mission`
- `create_phone_capture_link`
- `inspect_answer_change`

Each tool has a strict JSON Schema, accurate read-only and untrusted-content annotations, runtime validation, and a human-visible equivalent. A name-keyed React reconciler awaits registrations, keeps unchanged tools stable, aborts work when the current runtime provides a cancellation signal, and unregisters capabilities that are no longer valid.

A Cloudflare Durable Object owns the case, revision, role-scoped credentials, reconnect behavior, uploads, and reviewed evidence. The phone uploads once, directly to Cloudflare Stream. After Stream produces the authorized MP4, Vercel AI SDK 7 sends it through Vercel AI Gateway to a video-capable model for a bounded structured proposal. The model cannot publish evidence; the contributor's explicit review is authoritative. Invalid timestamps, stale revisions, unknown continuity for continuous-take missions, missing rights, expired capabilities, and dependency failures fail closed or remain inconclusive.

## Ninety-second judge path

This path requires no account. ChatGPT or WebMCP-enabled Chrome is needed on the buyer page; the contributor phone can use any ordinary browser.

1. Open **[LIVE URL]** and confirm the header says **Site Tools live**. The default bottle question starts at **Not enough proof** because “leak resistant” marketing copy is not a continuous leak test.
2. In ChatGPT, send:

   > Use this page's Site Tools. Inspect the active product question. If the current sources do not prove the answer, create the smallest continuous filming mission and then create a phone capture link. Do not infer the result from marketing copy. Stop and wait for reviewed evidence.

3. Watch ChatGPT inspect the case and create a bounded ten-second leak-test mission. The available Site Tools change on the page. Scan the resulting QR code with a phone, or open the contributor link in a second tab.
4. On the contributor page, record the owned bottle over dry paper for at least ten continuous seconds. Upload it, wait for the timestamped proposal, correct anything the model got wrong, confirm continuity and rights, and publish.
5. Return to the buyer page. It updates without a reset and shows **Before: Not enough proof → After: [ACTUAL RESULT]**. In ChatGPT, send:

   > Re-inspect the product evidence and use the new answer-change tool. Tell me only what changed, what the reviewed video establishes, and the exact cited interval.

6. The result must match the contributor's reviewed finding and include the exact video timestamp. To try another product, use **Open a case for a product we have never seen**; no code or database edit is required.

If a judge cannot use a second device, the default bottle case contains an explicitly labeled completed-mission replay. It exercises the same reviewed-evidence transition but is a fallback, not the primary demo claim.

## What the three-minute video must prove

The primary cut in [DEMO.md](DEMO.md) is the edit contract. A cold viewer must see this causal chain, not merely hear it:

```text
unproven answer
    → native WebMCP identifies the exact gap
    → native WebMCP creates a bounded filming mission
    → a real phone records and uploads one continuous test
    → AI proposes; the person reviews or corrects
    → reviewed evidence publishes
    → a new WebMCP answer-change tool appears
    → ChatGPT cites the evidence and changes its answer
```

Commerce, UCP, Lean, the previous live market, sponsor logos, and long architecture explanations do not belong in the primary cut. They dilute the judge-visible product transformation.

## Rubric proof matrix

| Criterion             | Judge-visible proof                                                                                                      | Repository proof                                                                                                                     | Remaining final gate                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| WebMCP Leverage       | ChatGPT uses narrow tools whose availability changes as a question becomes a mission and then a reviewed answer.         | Six native page-owned tools, dynamic registration lifecycle, strict schemas, annotations, cancellation, stale-state tests.           | Repeat the exact flow in the final ChatGPT build and capture the Site Tools calls and page changes.      |
| Execution             | No-login buyer-to-phone-to-reviewed-video-to-updated-answer loop, plus ordinary-browser controls and reconnect recovery. | Next.js product UI, Durable Object state, direct Stream upload, Gateway proposal, human review, WebSocket update, native acceptance. | Deploy this branch; pass a real Stream/Gateway/phone run and an unfamiliar-user run.                     |
| Potential Impact      | A shopper gets an answer to a specific product question that pages and text reviews could not prove.                     | Generic product/question model, rights/provenance distinctions, timestamps, abstention, link-only public-source discovery.           | Keep the story to the demonstrated audience/problem and show an unknown-product case as secondary proof. |
| Creativity & Ambition | ChatGPT does not merely browse the web—it identifies missing knowledge and recruits a human sensor to create it.         | Agent-authored missions, bounded phone capabilities, multimodal proposal, human authority, evidence-caused answer diff.              | Make the before/after transformation unmistakable within the first two minutes.                          |

The criteria are equally weighted. WebMCP Leverage is the first tie-breaker, so the video must visibly show native tool calls, dynamic capability changes, and their corresponding human UI state.

## Claims ledger

### Safe to claim now

- Any product name, optional public URL, and observable question can open a case without a code or database change.
- The page directly registers native, dynamic WebMCP Site Tools; human controls call the same domain transitions.
- Public social discovery results remain link-only leads and do not become proof merely because they are public.
- A no-login contributor capability is limited to one case's upload and reviewed-evidence publication.
- The contributor token is moved immediately from the URL fragment into tab-scoped session storage, and the visible URL is scrubbed.
- The production path reserves a one-time Cloudflare Stream upload and sends the browser file there directly rather than proxying it through Next.js; the generic branch's live-service rehearsal is still pending.
- The AI SDK/Gateway path accepts only a bounded, timestamped structured proposal and requires a human to review or correct every material field before publication; the generic branch's live video call is still pending.
- A continuous-take mission cannot become decision-grade when the reviewed interval is invalid or continuity is edited or unknown.
- The buyer reconnects to the same Durable Object after reload, and receives live answer updates over WebSocket.
- The deterministic native-Chrome acceptance test completes question inspection → mission → phone handoff → upload → model-shaped proposal → human correction → publication → timestamped answer diff using the real app and Durable Object. Only the paid Stream and model edges are replaced by strict local fixtures.
- Strict TypeScript, formatting, linting, application tests, Workerd tests, Worker dry runs, and a Next.js production build pass on the current branch.

### Must pass before equivalent public claims

- User-approved generic Vercel and Cloudflare deployment with credential-free judge access.
- One physical-phone recording through real Cloudflare Stream and real Vercel AI Gateway on the final origins.
- The complete model-driven flow in the current ChatGPT in-app Browser.
- The complete flow in a clean WebMCP-enabled Chrome profile.
- Buyer and contributor reload/reconnect on the public origins.
- A cold tester unfamiliar with the project understands and completes the canonical path without coaching.
- The public repository clones, installs, tests, and builds; GitHub visibly detects the MIT license.
- The public YouTube cut is audible, rights-clean, under three minutes, and matches the frozen live revision.

### Do not claim

- Video is impossible to fake, the SHA-256 digest proves authenticity, or the model proves ground truth.
- Public availability grants rights to download, analyze, clip, or republish third-party media.
- The app automatically finds or contacts every product owner or customer.
- The current prototype already contains a global, permanent evidence index reused across all future questions.
- The model is authoritative, or a contributor's statement proves a hidden historical fact.
- A replay fixture is a live person, a live model call, or fresh physical evidence.
- The generic branch is publicly deployed before it actually is.
- Shopify, UCP, checkout, payment, Vidably production systems, private research, or customer data are part of the judged product.

## Repository, rights, and release checklist

- [ ] Mark chooses the project name.
- [ ] Mark confirms entrant/team/representative and eligibility facts.
- [x] MIT license exists at the repository root with Mark Watson as copyright holder.
- [ ] Public repository points to the generic evidence branch and visibly detects the license.
- [ ] Public repository contains all code, assets, exact setup instructions, and challenge-period history.
- [x] Direct `document.modelContext.registerTool` usage is easy to find from the README.
- [ ] Public generic live URL is free, unprotected, and stable through the judging period.
- [ ] Final app, Worker, and video identify the same frozen commit.
- [ ] Real Stream/Gateway path and truthful manual fallback both pass on the final origins.
- [ ] ChatGPT in-app Browser, clean WebMCP Chrome, physical phone, and ordinary-browser fallback all pass.
- [ ] Every visible object, image, clip, font, sound, mark, and notification is owned, licensed, masked, or omitted.
- [ ] Demo is public on YouTube, has clear audio and corrected captions, is under `3:00`, and works logged out.
- [ ] Devpost draft contains the four required answers, live URL, repository URL, video URL, and exact judge instructions.
- [ ] Re-read the live Official Rules and Resources page immediately before submission.
- [ ] Freeze the submitted repository, live site, and Devpost entry through judging; continue only in a separate fork.

## User-only final actions

These actions require Mark's identity, legal assent, account session, external publication approval, or permission to incur service usage.

1. Choose the submitted project name.
2. Confirm whether the entrant is Mark individually, a team, or an organization, and appoint the representative if needed.
3. Approve the generic Cloudflare/Vercel deployment and real Stream/Gateway rehearsal.
4. Approve pushing the generic branch to the public repository and updating its public description/live URL.
5. Supply or approve the owned, unbranded physical object and final recorded result.
6. Approve the final rights-clean YouTube upload.
7. Review and submit the Devpost entry before **September 3, 2026 at 1:00 p.m. PT**.
