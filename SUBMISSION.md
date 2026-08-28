# Submission control packet

Updated 2026-08-27 PT. This is the candidate Devpost copy, judge runbook, claims ledger, and freeze checklist for the standalone product-evidence network. It describes only the generic evidence branch. The older live-shopping, private-price, UCP, and Lean rungs remain in challenge-period history, but their routes are absent from this candidate and they are not the submission hero.

The official FAQ says the entrant—not AI—must name the project. Every label below is descriptive until Mark chooses the submitted name.

## The whole product in one sentence

> When a shopper asks something the web cannot prove, ChatGPT publishes the exact missing-proof video request, anyone with the product can record and review it, and that timestamped evidence answers this shopper—and later matching shoppers—without another recording.

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

This app lets ChatGPT inspect the evidence for any product question. If existing pages and public videos do not prove the answer, WebMCP gives ChatGPT narrow tools to create one observable filming mission and, with explicit confirmation, publish only its product/question/recording fields to a 24-hour open request board. The board receives no shopper identity, preferences, history, budget, or ChatGPT conversation. Anyone who already owns the product can discover that request without a store partnership or customer list, open its no-login phone recorder, capture a continuous video, and say or show a random mission phrase that bounds the recording to after the request. They review or correct the AI's timestamped proposal before publishing. The original answer then visibly changes from “not enough proof” to supported, contradicted, mixed, or still inconclusive—with the decisive interval attached.

The contributor explicitly chooses whether the clip stays in one case or can answer matching product questions for up to 30 days. Only conclusive, medium-or-high-confidence continuous recordings enter that reusable index. The prototype therefore demonstrates a compounding open-web loop: agents identify exactly what knowledge is missing; people capture the physical evidence only they can provide; and the next agent reuses verified work instead of interrupting another person.

## Required Devpost answers

### Why is this use case a strong fit for WebMCP?

The useful tools depend on the exact product, question, sources, filming mission, public-listing status, contributor status, and reviewed evidence visible on the page right now. WebMCP lets the site expose that live capability frontier directly to ChatGPT: inspect the current evidence, search available public leads, create one bounded filming mission, create its phone handoff, explicitly publish or revoke its public request, inspect/open current board requests, and—only after evidence arrives—inspect exactly how the answer changed.

That state dependence is the product. Mission creation disappears once a mission is open; the phone-link action appears only when valid; public publication becomes public revocation; and answer-difference inspection appears only after reviewed evidence arrives. The separate board exposes only current open jobs and one exact recorder handoff. A detached backend tool or DOM-driving agent would lose the human-visible context, lifecycle, privacy receipt, and shared authority that make this collaboration understandable and safe.

### How does it create a better user experience?

The shopper asks the question they actually care about instead of translating it into search keywords and watching unrelated reviews. The app distinguishes marketing claims, public discovery leads, and decision-grade evidence rather than collapsing all three into “sources.” When the answer is missing, ChatGPT requests only the smallest useful recording instead of guessing or asking a person to make a whole review. The shopper can send it privately or post a privacy-minimized job that any existing owner can discover.

The contributor needs no account or app. Their phone shows the product question, exact recording instruction, success criterion, minimum duration, whether cuts are allowed, and a random phrase they can speak or show for a fresh-capture check. Video uploads directly to Cloudflare Stream. AI proposes a result and the smallest relevant interval, but the contributor must review or correct the result, wording, confidence, continuity, timestamp, provenance, rights, and attribution before anything can affect the answer. A clip selected from the library is never silently labeled as a fresh capture, and only the server-side video review can label the mission phrase detected. That detection proves only post-request timing—not identity, ownership, authenticity, or truth. The shopper page updates live and shows the before/after answer with its citation.

### What can people and agents do together that was difficult or impossible before?

An agent can now turn its own uncertainty into a precise, discoverable request for new physical-world evidence, while a person remains in control of what is recorded and what the recording actually establishes. Neither side can complete the loop alone: ChatGPT knows which fact blocks the shopper's decision and can formulate the minimum test; a distributed product owner has the product, camera, and judgment; the page joins them without requiring a merchant integration, customer list, or shared account.

The working prototype proves the complete causal loop on an ordinary product: an unproven claim becomes a WebMCP filming mission, a real phone video becomes human-reviewed evidence, that evidence materially changes the first answer, and a fresh matching shopper case reuses the same cited recording without another mission. The broader opportunity is a compounding evidence layer for products: future agents search what has already been shown and ask people to film only the gaps that remain.

### How was WebMCP implemented?

The Next.js shopper and public-board pages register native tools through `document.modelContext.registerTool`. Ten narrow tools exist across the two surfaces, with only the state-valid subset registered at a time:

- `inspect_product_evidence`
- `ask_product_question`
- `search_product_evidence`
- `create_filming_mission`
- `create_phone_capture_link`
- `publish_filming_mission`
- `remove_public_filming_mission`
- `inspect_answer_change`
- `inspect_open_filming_missions`
- `open_filming_mission`

Each tool has a strict JSON Schema, accurate read-only and untrusted-content annotations, runtime validation, and a human-visible equivalent. A name-keyed React reconciler awaits registrations, keeps unchanged tools stable, aborts work when the current runtime provides a cancellation signal, and unregisters capabilities that are no longer valid.

`search_product_evidence` calls the same-origin public-discovery route. That route checks a Cloudflare D1 index fresh on every request for an exact normalized question and exact canonical product URL (or exact normalized name when no URL exists). It also keeps the supplied product page as an explicitly unreviewed lead, searches public TikTok/Instagram/YouTube metadata through ScrapeCreators, and invokes Exa's bounded `instant` search tool through Vercel AI Gateway for broader web/PDP leads. It accepts the Gateway output only when the tool receipt preserves the exact claim-aware query, caps results, deduplicates canonical URLs, and stores every ordinary public result as `external_link` + `link_only` + `inconclusive`. Successful configured web searches are reused for 15 minutes through Vercel Runtime Cache, while D1 is checked fresh so a newly reviewed recording is never hidden by that cache.

A Cloudflare Durable Object owns each case, revision, random capture phrase, role-scoped credentials, reconnect behavior, uploads, and reviewed evidence. D1 stores only public mission fields plus a separate case-scoped public capability; it never receives the private contributor token. Listings expire within 24 hours, disappear after fulfillment, and can be removed so their public capability stops authenticating while the independent private link remains valid. The phone uploads once, directly to Cloudflare Stream. After Stream produces the authorized MP4, Vercel AI SDK 7 sends it through Vercel AI Gateway to a video-capable model for a bounded structured proposal and exact-phrase check. The model cannot publish evidence; the contributor's explicit claim review is authoritative, while the server derives capture timing from its stored model receipt rather than trusting a browser field. With separate reuse consent, only a conclusive, medium-or-high-confidence continuous result is indexed in D1 for 30 days, after which a Cloudflare Cron Trigger physically purges its metadata. Invalid timestamps, stale revisions, weak evidence, ambiguous product identity, missing rights, expired/revoked capabilities, and dependency failures fail closed or remain inconclusive.

## Two-minute judge path

This path requires no account. ChatGPT or WebMCP-enabled Chrome is needed on the buyer page; the contributor phone can use any ordinary browser.

1. Open **[LIVE URL]** and confirm the header says **Site Tools live**. The default bottle question starts at **Not enough proof** because “leak resistant” marketing copy is not a continuous leak test.
2. In ChatGPT, send:

   > Use this page's Site Tools. Inspect the active product question. If the current sources do not prove the answer, create the smallest continuous filming mission, create its bounded phone case, and publish only that mission to the open request board. Do not infer the result from marketing copy. Stop before anyone records.

3. Watch ChatGPT inspect the case, create a bounded ten-second leak-test mission, and explicitly publish only its public fields. Open **Open filming requests** in a second browser context and ask ChatGPT: “Inspect the open filming requests and open the exact request for this bottle.” The board returns the bounded recorder; no merchant or customer data exists.
4. On the contributor page, record the owned bottle over dry paper for at least ten continuous seconds. Say or show the displayed mission phrase near the start while the bottle remains visible. Upload it, wait for the timestamped proposal and separate phrase check, correct anything the model got wrong, confirm provenance, continuity, rights, and reuse scope, then publish.
5. Return to the buyer page. It updates without a reset and shows **Before: Not enough proof → After: [ACTUAL RESULT]**. In ChatGPT, send:

   > Re-inspect the product evidence and use the new answer-change tool. Tell me only what changed, what the reviewed video establishes, and the exact cited interval.

6. The result must match the contributor's reviewed finding and include the exact video timestamp. If the contributor opted into reuse, open the exact same product URL and question as a fresh case and run search: the D1 receipt, cited Stream recording, changed answer, and absence of a new filming mission prove the network effect. To try another product, use **Open a case for a product we have never seen**; no code edit is required.

If a judge cannot use a second device, the default bottle case contains an explicitly labeled completed-mission replay. It exercises the same reviewed-evidence transition but is a fallback, not the primary demo claim.

## What the three-minute video must prove

The primary cut in [DEMO.md](DEMO.md) is the edit contract. A cold viewer must see this causal chain, not merely hear it:

```text
unproven answer
    → native WebMCP identifies the exact gap
    → native WebMCP creates a bounded filming mission
    → explicit public request recruits any existing product owner
    → a real phone records and uploads one continuous test
    → AI proposes; the person reviews or corrects
    → reviewed evidence publishes
    → a new WebMCP answer-change tool appears
    → ChatGPT cites the evidence and changes its answer
```

Commerce, UCP, Lean, the previous live market, sponsor logos, and long architecture explanations do not belong in the primary cut. They dilute the judge-visible product transformation.

## Rubric proof matrix

| Criterion             | Judge-visible proof                                                                                                                                                       | Repository proof                                                                                                                                                        | Remaining final gate                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| WebMCP Leverage       | ChatGPT's tools change from evidence search → mission → public recruitment, while the board exposes request inspection/opening and the resolved case exposes answer diff. | Ten native page-owned tools across two surfaces, dynamic lifecycle, strict schemas, explicit disclosure confirmation, annotations, cancellation, stale-state tests.     | Repeat the exact two-surface flow in the final ChatGPT build and capture the Site Tool calls and page changes.  |
| Execution             | No-login shopper → open board → stranger phone → reviewed video → updated answer loop, plus fallback controls and reconnect recovery.                                     | Next.js shopper/board/contributor UI, revocable capabilities, Durable Object state, Stream upload, Gateway proposal, human review, WebSocket update, native acceptance. | Deploy this branch; pass a real Stream/Gateway/phone run and an unfamiliar-user run.                            |
| Potential Impact      | Anyone with the product can fill a knowledge gap once; the current and later matching shoppers reuse the result.                                                          | Generic model, public missing-proof distribution, rights/provenance, timestamps, abstention, exact D1 reuse/expiry.                                                     | Keep the audience/problem concrete and show the board plus second-case reuse.                                   |
| Creativity & Ambition | ChatGPT turns uncertainty into an open physical-world data request, recruits distributed human sensors, then compounds reviewed evidence across agents.                   | Agent-authored missions, permissionless request board, phone capabilities, multimodal proposal, human authority, answer diff, cross-case reuse.                         | Make public recruitment, first before/after, and second no-mission resolution unmistakable under three minutes. |

The criteria are equally weighted. WebMCP Leverage is the first tie-breaker, so the video must visibly show native tool calls, dynamic capability changes, and their corresponding human UI state.

## Claims ledger

### Safe to claim now

- Any product name, optional public URL, and observable question can open a case without a code or database change.
- The page directly registers native, dynamic WebMCP Site Tools; human controls call the same domain transitions.
- Public social discovery results remain link-only leads and do not become proof merely because they are public.
- A no-login contributor capability is limited to one case's upload and reviewed-evidence publication.
- Public board publication requires explicit confirmation and includes only public product/question/filming fields. Its separate public capability is revocable without exposing or invalidating the private contributor token; listings expire within 24 hours and fulfilled/removed listings leave the open board.
- The contributor token is moved immediately from the URL fragment into tab-scoped session storage, and the visible URL is scrubbed.
- The production path reserves a one-time Cloudflare Stream upload and sends the browser file there directly rather than proxying it through Next.js; the generic branch's live-service rehearsal is still pending.
- The AI SDK/Gateway path accepts only a bounded, timestamped structured proposal plus a separate exact-phrase check and requires a human to review or correct every material claim field before publication; the generic branch's live video call is still pending.
- Every mission has a random spoken-or-shown phrase. The server preserves `mission_challenge_verified`, `contributor_attested`, or `preexisting` timing without accepting a client-authored verification flag. This is deliberately described as bounded capture timing, never authenticity proof.
- A continuous-take mission cannot become decision-grade when the reviewed interval is invalid or continuity is edited or unknown.
- A contributor must explicitly opt into reusable publication. The D1 index accepts only conclusive, medium-or-high-confidence continuous recordings, matches supplied product URLs exactly after safe canonicalization, expires records after 30 days, and has a daily physical purge.
- The buyer reconnects to the same Durable Object after reload, and receives live answer updates over WebSocket.
- The deployable generic Worker has a separate name and exposes only the evidence API. Public case creation has per-client and aggregate Cloudflare rate-limit bindings; each temporary case has a hard two-upload ceiling, and clips are bounded by bytes, duration, expiry, and retention.
- The obsolete public image-model route and legacy live-market/UCP pages are absent from this candidate. Social search requires same-origin JSON before it can reach the optional vendor, and the release runbook requires a staged Vercel WAF ceiling plus dedicated vendor credits.
- Broad-web discovery is implemented with the current AI SDK/Gateway-native Exa tool, exact-query receipt verification, four-result/20-second bounds, automatically refreshed Vercel OIDC under a non-renewing project budget, and Vercel Runtime Cache. Its malformed, rewritten-query, provider-error, duplicate, OIDC-without-stored-key, and outage paths pass offline tests; a real Gateway search on the final Vercel origin remains an external-account acceptance gate.
- The deterministic native-Chrome acceptance test opens an arbitrary product, searches through its dynamically registered Site Tool, preserves the supplied page as an inconclusive link-only lead, then completes mission → explicit public-board publication → fresh board context inspection/claim → phone handoff → upload → model-shaped proposal → human correction → explicit reuse consent → publication → timestamped answer diff. It finally opens a fresh matching case and proves the same reviewed Stream citation changes the answer without another mission. The real app, Durable Object, D1 database, migrations, and revocable capability boundary run unchanged; only the paid Stream and model edges are strict local fixtures.
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
- The app automatically contacts every product owner/customer, guarantees that an open request is fulfilled, or already has a mature incentive marketplace. The current pilot provides permissionless discoverability and a real fulfillment path.
- Reuse is permanent, semantic, cross-product, or available beyond the exact 30-day product/question contract.
- The model is authoritative, or a contributor's statement proves a hidden historical fact.
- A replay fixture is a live person, a live model call, or fresh physical evidence.
- The generic branch is publicly deployed before it actually is.
- Shopify, UCP, checkout, payment, Vidably production systems, private research, and customer data are not part of the judged product.

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
