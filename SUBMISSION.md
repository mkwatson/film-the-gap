# Submission control packet

Updated 2026-08-28 PT. This is the candidate Devpost copy, judge runbook, claims ledger, and freeze checklist for the standalone product-evidence network.

**Film the Gap** is the working submitted identity: an open product-evidence network that asks people to film only what existing sources cannot prove.

## The whole product in one sentence

> When a product page cannot prove a shopper's exact question, ChatGPT turns the gap into a tiny filming request; a person records and reviews the missing observation, and the page gains cited video evidence that future shoppers and agents can reuse.

## Asset manifest

| Submission asset         | Final value                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| Project name             | **Film the Gap**                                                     |
| One-line hook            | If the web cannot prove it, ask someone with the product to film it. |
| Live URL                 | **[PENDING USER-APPROVED GENERIC DEPLOYMENT]**                       |
| Public repository        | **[PENDING USER-APPROVED GENERIC BRANCH PUBLICATION]**               |
| Demo video               | **[PUBLIC YOUTUBE URL, WITH AUDIO, UNDER 3:00]**                     |
| Submitted revision       | **[FROZEN TAG, COMMIT SHA, AND DEPLOYMENT RECEIPTS]**                |
| Primary judged clients   | ChatGPT in-app Browser; Chrome 149+ with WebMCP enabled              |
| Entrant / representative | **[MARK CONFIRMS]**                                                  |
| Open-source license      | [MIT](LICENSE), copyright Mark Watson                                |

The project was created entirely during the submission period. Its first commit, `be76c558a8a53c4d7e2f318961fd1dc7460980e7`, is dated August 26, 2026 at 6:28 a.m. PT, after the challenge opened on August 25 at 11:00 a.m. PT.

## Devpost short description

Product pages answer the questions their authors anticipated. Shoppers often need something more specific: does this bottle actually leak upside down, can this microphone charge while recording, or how loud is this appliance in a quiet room?

Instead of stopping at product search or summarizing the claims already online, Film the Gap creates the exact piece of evidence the web is missing and makes it reusable. A participating product page can expose its own proof gap to ChatGPT, open the exact evidence case, then visibly gain a reviewed result and new Site Tool after someone records it.

This app lets ChatGPT inspect the evidence for any product question. Its default case uses a real, rights-clean product page shipped on the same public origin—not a fictional merchant or hidden fixture—whose “leak resistant” claim deliberately cannot answer the shopper's ten-second leak question. If existing pages and public videos do not prove the answer, WebMCP gives ChatGPT narrow tools to create one observable filming mission, inspect and revision-safely refine its acceptance boundary, and—with explicit confirmation—publish only its product/question/recording fields to a 24-hour open request board. The refinement capability disappears when the phone case exists, so the target cannot silently change underneath a contributor. The board receives no shopper identity, preferences, history, budget, or ChatGPT conversation. Anyone with access to the product can discover that request without a store partnership or customer list, open its no-login phone recorder, capture a continuous video, and say or show a random mission phrase that bounds the recording to after the request. They review or correct the AI's timestamped proposal, deliberately choose publishing rights, and explicitly confirm the complete review before the server accepts it. The original answer then visibly changes from “not enough proof” to supported, contradicted, mixed, or still inconclusive—with the decisive interval attached.

The contributor explicitly chooses whether the clip stays in one case or can answer matching product questions for up to 30 days. Only conclusive, medium-or-high-confidence continuous recordings enter that reusable index. The prototype therefore demonstrates a compounding open-web loop: agents identify exactly what knowledge is missing; people capture the physical evidence only they can provide; and the next agent reuses reviewed evidence instead of interrupting another person.

## Required Devpost answers

### Why is this use case a strong fit for WebMCP?

The useful tools depend on the exact product, question, sources, filming mission, public-listing status, contributor status, and reviewed evidence visible on the page right now. WebMCP lets each page expose its live capability frontier directly to ChatGPT: a product page distinguishes authored claims from reviewed proof and opens the exact missing-evidence case; the shopper page searches, creates, publishes, and consumes the result; the board exposes current requests and one bounded recorder.

That state dependence is the product. On the original product page, `open_product_evidence_case` disappears when reviewed evidence arrives and `inspect_reviewed_product_evidence` replaces it. In the case, mission creation becomes stale-protected mission refinement once a mission is open; refinement disappears when the phone link is created; public publication becomes public revocation; and answer-difference inspection appears only after review. A detached backend tool or DOM-driving agent would lose the human-visible context, lifecycle, privacy receipt, and shared authority that make this collaboration understandable and safe.

### How does it create a better user experience?

The shopper asks the question they actually care about instead of translating it into search keywords and watching unrelated reviews. The app distinguishes marketing claims, public discovery leads, and decision-grade evidence rather than collapsing all three into “sources.” When the answer is missing, ChatGPT requests only the smallest useful recording instead of guessing or asking a person to make a whole review. The shopper can send it privately or post a privacy-minimized job that anyone with access to the product can discover.

The contributor needs no account or app. Their phone shows the product question, exact recording instruction, success criterion, minimum duration, whether cuts are allowed, and a random phrase they can speak or show for a fresh-capture check. Before upload or model analysis, the browser and server require a literal confirmation that the contributor owns the recording or has permission to analyze it. Video then uploads directly to Cloudflare Stream. AI proposes a result, the smallest relevant interval, and a scrub-to map of the entire recording that labels setup, claim evidence, context, and every visible or uncertain cut. The map is explicitly an untrusted navigation aid; it is not published evidence, and a cut inside an interval prevents a continuous-evidence result. The contributor must review or correct the result, wording, confidence, continuity, timestamp, provenance, publication rights, and attribution before anything can affect the answer. Publishing rights start unselected, the public relationship label defaults to “Anonymous contributor” and is explicitly self-described, and the server rejects publication without a separate literal final-review confirmation. A clip selected from the library is never silently labeled as a fresh capture, and only the server-side video review can label the mission phrase detected. That detection proves only post-request timing—not identity, ownership, authenticity, or truth. The shopper page updates live and shows the before/after answer with its citation.

### What can people and agents do together that was difficult or impossible before?

An agent can now turn its own uncertainty into a precise, discoverable request for new physical-world evidence, while a person remains in control of what is recorded and what the recording actually establishes. Neither side can complete the loop alone: ChatGPT knows which fact blocks the shopper's decision and can formulate the minimum test; a distributed person with access to the product has the camera and judgment; the page joins them without requiring a merchant integration, customer list, or shared account.

The working prototype proves the complete causal loop on an ordinary product: an unproven claim becomes a WebMCP filming mission, a real phone video becomes human-reviewed evidence, that evidence materially changes the first answer, and the original product page gains the same cited recording without another mission. The broader opportunity is a compounding evidence layer for products: future agents search what has already been shown and ask people to film only the gaps that remain.

### How was WebMCP implemented?

The Next.js product, shopper, and public-board pages register native tools through `document.modelContext.registerTool`. Fourteen narrow tool names exist across the three surfaces, with only the state-valid subset registered at a time:

- `inspect_product_claim`
- `open_product_evidence_case`
- `inspect_reviewed_product_evidence`
- `inspect_product_evidence`
- `ask_product_question`
- `search_product_evidence`
- `create_filming_mission`
- `refine_filming_mission`
- `create_phone_capture_link`
- `publish_filming_mission`
- `remove_public_filming_mission`
- `inspect_answer_change`
- `inspect_open_filming_missions`
- `open_filming_mission`

Each tool has a strict JSON Schema, accurate read-only and untrusted-content annotations, runtime validation, a compact verifiable result, and a human-visible equivalent. A name-keyed React reconciler awaits registrations, keeps unchanged tools stable, defers retirement until an in-flight call returns, aborts work when the current runtime provides a cancellation signal, and unregisters capabilities that are no longer valid.

The product-page bridge queries the same exact D1 evidence contract used by shopper search. Its strict `/case` handoff carries only the public product URL, product name, observable question, source kind, and protocol version; unknown fields, duplicate query values, private URLs, and version mismatches fail closed. Before reviewed evidence exists, the page exposes claim inspection plus case navigation. After evidence appears, it changes both visible UI and native tools to return the reviewed result, confidence, rights, provenance, capture timing, continuity, source URL, and exact interval.

`search_product_evidence` calls the same-origin public-discovery route. On public HTTPS, the default case automatically supplies the app's owned `/demo-product` URL; that page explicitly permits search and AI input while denying AI training, and reset preserves the same binding. The route checks a Cloudflare D1 index fresh on every request for an exact normalized question and exact canonical product URL (or exact normalized name when no URL exists). An exact reviewed answer returns immediately without repeating public-provider calls. Otherwise, for a supplied URL, the route invokes a server-authenticated Cloudflare Browser Run `/markdown` action with same-origin navigation, blocked media, two bounded eight-second phases, a 24-hour action cache, and an atomic 60-read daily D1 ceiling. The resulting page excerpt remains untrusted, link-only, low-confidence, and inconclusive; explicit `search=no` or `ai-input=no` Content Signals discard it. The route also searches public TikTok/Instagram/YouTube metadata through ScrapeCreators and invokes Exa's bounded `instant` search tool through Vercel AI Gateway for broader web/PDP leads. It accepts the Gateway output only when the tool receipt preserves the exact claim-aware query, caps results, deduplicates canonical URLs, and stores every ordinary public result as `external_link` + `link_only` + `inconclusive`. Successful configured searches are reused for 15 minutes through Vercel Runtime Cache, while D1 is checked fresh so a newly reviewed recording is never hidden by that cache.

A Cloudflare Durable Object owns each case, revision, random capture phrase, role-scoped credentials, reconnect behavior, uploads, and reviewed evidence. D1 stores only public mission fields plus a separate case-scoped public capability; it never receives the private contributor token. Listings expire within 24 hours, disappear after fulfillment, and can be removed so their public capability stops authenticating while the independent private link remains valid. The phone uploads once, directly to Cloudflare Stream. After Stream produces the authorized MP4, Vercel AI SDK 7 sends it through Vercel AI Gateway to a video-capable model for a bounded structured proposal and exact-phrase check. The model cannot publish evidence; the contributor's explicit claim review is authoritative, while the server derives capture timing from its stored model receipt rather than trusting a browser field. With separate reuse consent, only a conclusive, medium-or-high-confidence continuous result is indexed in D1 for 30 days, after which a Cloudflare Cron Trigger physically purges its metadata. Invalid timestamps, stale revisions, weak evidence, ambiguous product identity, missing rights, expired/revoked capabilities, and dependency failures fail closed or remain inconclusive.

## Two-minute judge path

This path requires no Film the Gap account. For ChatGPT, use the latest desktop app's built-in browser with **Enable site tools** on in **Settings → Browser → Permissions** and select **GPT-5.6 Sol** or **GPT-5.6 Terra**; Luna currently has WebMCP disabled, and Site Tools are not available in Enterprise or Edu workspaces. WebMCP-enabled Chrome is the alternate buyer client. The contributor phone can use any ordinary browser.

1. Open **[LIVE URL]/demo-product** in ChatGPT's built-in browser. The rights-clean page says **“Leak resistant”**, labels that text **Claim only · not verified evidence**, asks the exact ten-second question, and shows zero reviewed videos. In **Site tools → Available site tools**, confirm the page exposes claim inspection and an exact evidence-case handoff.
2. In ChatGPT, send:

   > Use this page's Site Tools. Inspect the product claim and its proof boundary. If reviewed evidence is missing, open the exact evidence case. Do not treat the marketing claim as proof.

   ChatGPT should navigate to a prefilled case containing only the public product URL, product name, and observable question. The answer starts at **Not enough proof**.

3. Then send:

   > Use this page's Site Tools. Inspect the active product question and search existing evidence. Treat ordinary public results as leads, never proof. If the reviewed sources still do not prove the answer, create the smallest continuous filming mission, inspect it, and refine it if its acceptance boundary is ambiguous. Then create its bounded phone case and publish only that mission to the open request board. Do not infer the result from marketing copy. Stop before anyone records.

4. Watch ChatGPT search D1/social/product-page/open-web sources, preserve ordinary results as non-decisive leads, create a bounded leak-test mission, optionally tighten it through the inspected revision before handoff, and explicitly publish only its public fields. Open **Open filming requests** in a second browser context and ask ChatGPT: “Inspect the open filming requests and open the exact request for this bottle.” The board returns the bounded recorder; no merchant or customer data exists.
5. On the contributor page, record the owned bottle over dry paper for at least ten continuous seconds. Say or show the displayed mission phrase near the start while the bottle remains visible. Upload it, wait for the timestamped proposal and separate phrase check, correct anything the model got wrong, choose provenance, continuity, rights, and reuse scope, explicitly confirm the complete review, then publish.
6. Return to the buyer page. It updates without a reset and shows **Before: Not enough proof → After: [ACTUAL RESULT]**. In ChatGPT, send:

   > Re-inspect the product evidence and use the new answer-change tool. Tell me only what changed, what the reviewed video establishes, and the exact cited interval.

7. Return to **[LIVE URL]/demo-product**. The missing-proof action is now a reviewed-video result with the same citation, and its Site Tool frontier has changed from case handoff to reviewed-evidence inspection. Ask ChatGPT to inspect it. This bookend proves the page gained reusable evidence; it is not a scripted second answer.

After the first real bottle mission is published with network-reuse consent, a judge without a second device can begin directly at `/demo-product`: D1 returns the earlier reviewed Stream recording and timestamp, and no filming request appears. That is the only completed-mission replay; the app does not manufacture a pass/fail transition.

## What the three-minute video must prove

The primary cut in [DEMO.md](DEMO.md) is the edit contract. A cold viewer must see this causal chain, not merely hear it:

```text
product page with an unproven claim
    → native WebMCP opens the exact evidence gap
    → native WebMCP creates a bounded filming mission
    → explicit public request recruits someone with the product
    → a real phone records and uploads one continuous test
    → AI proposes; the person reviews or corrects
    → reviewed evidence publishes
    → a new WebMCP answer-change tool appears
    → ChatGPT cites the evidence and changes its answer
    → the original product page gains reviewed video and a new Site Tool
```

Sponsor logos and long architecture explanations do not belong in the primary cut. They dilute the judge-visible product transformation.

## Rubric proof matrix

| Criterion             | Judge-visible proof                                                                                                                                        | Repository proof                                                                                                                                                                    | Remaining final gate                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| WebMCP Leverage       | The product page changes from claim inspection → exact case handoff → reviewed-evidence inspection; the case and board expose their own state-valid tools. | Fourteen native page-owned tool names across three surfaces, dynamic lifecycle, strict schemas, explicit disclosure confirmation, compact outputs, cancellation, stale-state tests. | Repeat the exact three-surface flow in the final ChatGPT build and capture the Site Tool calls and page changes. |
| Execution             | No-login shopper → open board → stranger phone → reviewed video → updated answer loop, plus fallback controls and reconnect recovery.                      | Next.js shopper/board/contributor UI, revocable capabilities, Durable Object state, Stream upload, Gateway proposal, human review, WebSocket update, native acceptance.             | Deploy this branch; pass a real Stream/Gateway/phone run and an unfamiliar-user run.                             |
| Potential Impact      | Anyone with the product can fill a knowledge gap once; the original product page and later matching shoppers reuse the result.                             | Generic model, public missing-proof distribution, rights/provenance, timestamps, abstention, exact D1 reuse/expiry.                                                                 | Keep the audience/problem concrete and bookend the demo on the upgraded product page.                            |
| Creativity & Ambition | ChatGPT turns uncertainty into an open physical-world data request, recruits distributed human sensors, then compounds reviewed evidence across agents.    | Agent-authored missions, permissionless request board, phone capabilities, multimodal proposal, human authority, answer diff, cross-case reuse.                                     | Make public recruitment, first before/after, and second no-mission resolution unmistakable under three minutes.  |

The criteria are equally weighted. WebMCP Leverage is the first tie-breaker, so the video must visibly show native tool calls, dynamic capability changes, and their corresponding human UI state.

## Claims ledger

### Safe to claim now

- Any product name, optional public URL, and observable question can open a case without a code or database change.
- On public HTTPS, the owned `/demo-product` page directly inspects the exact D1 evidence contract. Before proof it exposes claim inspection and a strict `/case` handoff; after proof it displays the reviewed citation and swaps in reviewed-evidence inspection. Its authored marketing copy remains non-decisive, it is readable by Browser Run, and the production release verifier covers its Content Signal.
- The page directly registers native, dynamic WebMCP Site Tools; human controls call the same domain transitions.
- Public social discovery results remain link-only leads and do not become proof merely because they are public.
- An open mission can be refined only against the exact inspected revision and only before a contributor link exists; its fresh-capture phrase is preserved.
- A no-login contributor capability is limited to one case's upload and reviewed-evidence publication.
- Public board publication requires explicit confirmation and includes only public product/question/filming fields. Its separate public capability is revocable without exposing or invalidating the private contributor token; listings expire within 24 hours and fulfilled/removed listings leave the open board.
- Resetting or opening another product case first revokes any owned open-board listing. If that cleanup fails, the app preserves the current case and capability instead of leaving an orphaned public request.
- The contributor token is moved immediately from the URL fragment into tab-scoped session storage, and the visible URL is scrubbed.
- The production path reserves a one-time Cloudflare Stream upload and sends the browser file there directly rather than proxying it through Next.js. Network publication fails closed unless Stream disables unsigned playback; the stored evidence URL is a no-login Worker viewer that issues one-hour signed tokens only for fresh D1 records, starts at the cited interval without autoplay, and has an atomic 60-token daily ceiling. The generic branch's live-service rehearsal is still pending.
- The AI SDK/Gateway path requires explicit media-analysis rights, then accepts only a bounded, timestamped structured proposal with a complete cut-aware segment map plus a separate exact-phrase check. During review, the contributor can jump to each mapped interval and scrub the exact local recording beside that untrusted proposal, must deliberately select separate publishing rights, and must send a literal final-review confirmation after inspecting or correcting every material claim field. Previous-release cached proposals remain readable, but all new model responses must include a valid full-video map. The public relationship label defaults to “Anonymous contributor” and is explicitly self-described; the generic branch's live video call is still pending.
- Every mission has a random spoken-or-shown phrase. The server preserves `mission_challenge_verified`, `contributor_attested`, or `preexisting` timing without accepting a client-authored verification flag. This is deliberately described as bounded capture timing, never authenticity proof.
- A continuous-take mission cannot become decision-grade when the reviewed interval is invalid or continuity is edited or unknown.
- A contributor must explicitly opt into reusable publication. The D1 index accepts only conclusive, medium-or-high-confidence continuous recordings, matches supplied product URLs exactly after safe canonicalization, expires records after 30 days, and has a daily physical purge.
- The buyer reconnects to the same Durable Object after reload, and receives live answer updates over WebSocket.
- The deployable generic Worker has a separate name and exposes only the evidence API. Public case creation has per-client and aggregate Cloudflare rate-limit bindings; each temporary case has a hard two-upload ceiling, and clips are bounded by bytes, duration, expiry, and retention.
- Social search requires same-origin JSON before it can reach the optional vendor, and the release runbook requires a staged Vercel WAF ceiling plus dedicated vendor credits.
- Broad-web discovery is implemented with the current AI SDK/Gateway-native Exa tool, exact-query receipt verification, four-result/20-second bounds, automatically refreshed Vercel OIDC under a non-renewing project budget, and Vercel Runtime Cache. Its malformed, rewritten-query, provider-error, duplicate, OIDC-without-stored-key, and outage paths pass offline tests; a real Gateway search on the final Vercel origin remains an external-account acceptance gate.
- Supplied-page reading is implemented with the current Cloudflare Browser Run Worker binding. Authentication, private/non-HTTPS/default-port denial, same-origin navigation, cross-origin redirect rejection, Content Signal refusal, bounded excerpt sanitation, D1 quota exhaustion, and dependency failure pass Workerd tests; a real Browser Run read on the final origin remains an external-service acceptance gate.
- The deterministic native-Chrome acceptance test opens an arbitrary product, searches through its dynamically registered Site Tool, preserves the supplied page as an inconclusive link-only lead, then completes mission → inspect current revision → stale-protected refinement → explicit public-board publication → fresh board context inspection/claim → phone handoff → upload → model-shaped proposal → human correction → explicit reuse consent → publication → timestamped answer diff. It finally opens a fresh matching case and proves the same reviewed Stream citation changes the answer without another mission. The real app, Durable Object, D1 database, migrations, and revocable capability boundary run unchanged; only the paid Stream and model edges are strict local fixtures.
- A separate native browser receipt begins on `/demo-product` with `inspect_product_claim` + `open_product_evidence_case`, executes the navigation tool into the strict prefilled route, then injects a schema-valid reviewed-index response and proves the live page and tool frontier change to `inspect_reviewed_product_evidence`. Its returned citation/provenance payload is 872 characters; a four-record worst-case test remains below 1,500 characters by returning the newest reviewed record and disclosing the additional-record count.
- Chrome Labs' current source-built evaluator independently executes the live seven-call shopper trajectory—including inspect → exact-revision refine—and the cross-page product handoff: 15/15 calls pass across five cases.
- A separate Chrome acceptance run starts with WebMCP explicitly disabled and completes the same arbitrary-product → search → human mission refinement → public mission → stranger claim → recorder → review → live answer change → fresh-case reuse loop through visible controls only. This proves the app remains a coherent ordinary website rather than an agent-only façade.
- An exact cold clone of `208c0bfd2620bc63ff94cd12f76f80e51a6dd524` passes its frozen install, strict TypeScript, formatting, linting, all 232 application/Workerd tests, Worker dry run, eight-route Next.js production build, and clean post-build worktree.

### Must pass before equivalent public claims

- User-approved generic Vercel and Cloudflare deployment with credential-free judge access.
- One physical-phone recording through real Cloudflare Stream and real Vercel AI Gateway on the final origins.
- One real Browser Run read of a public product page on the final origins, with the page receipt visible and its copy still non-decisive.
- The complete model-driven flow in the current ChatGPT in-app Browser.
- The complete flow in a clean WebMCP-enabled Chrome profile.
- Buyer and contributor reload/reconnect on the public origins.
- A cold tester unfamiliar with the project understands and completes the canonical path without coaching.
- The public repository clones, installs, tests, and builds; GitHub visibly detects the MIT license.
- The public YouTube cut is audible, rights-clean, under three minutes, and matches the frozen live revision.

### Do not claim

- Video is impossible to fake, the SHA-256 digest proves authenticity, or the model proves ground truth.
- Public availability grants rights to download, analyze, clip, or republish third-party media.
- The app automatically contacts everyone with a product, guarantees that an open request is fulfilled, independently verifies a contributor's self-description, or already has a mature incentive marketplace. The current pilot provides permissionless discoverability and a real fulfillment path.
- Reuse is permanent, semantic, cross-product, or available beyond the exact 30-day product/question contract.
- The model is authoritative, or a contributor's statement proves a hidden historical fact.
- A previously recorded mission is a new live person, a new model call, or fresh physical evidence.
- The generic branch is publicly deployed before it actually is.
- Checkout, payment, private systems, private research, and customer data are not part of the judged product.

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
- [x] Deterministic native WebMCP Chrome and WebMCP-disabled ordinary-browser journeys both pass locally.
- [ ] ChatGPT in-app Browser, clean public-origin WebMCP Chrome, and physical phone all pass.
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
