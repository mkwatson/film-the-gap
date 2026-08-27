# Submission control packet

Updated 2026-08-27 PT. This is the single source of truth for the Devpost description, judge instructions, video cut, claims, and final freeze. Replace every bracketed field and re-run the final gates before submission.

The official FAQ says the entrant—not AI—must name the project. The descriptive repository labels below are not candidate names.

## Asset manifest

| Submission asset         | Final value                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Project name             | **[MARK CHOOSES — AI MUST NOT NAME]**                                                                           |
| One-line hook            | Private agents ask the physical world for the smallest missing fact—without revealing what each buyer will pay. |
| Live buyer URL           | **[FINAL PUBLIC HTTPS URL]**                                                                                    |
| Public repository        | **[FINAL PUBLIC REPOSITORY URL]**                                                                               |
| Demo video               | **[PUBLIC YOUTUBE URL, UNDER 3:00]**                                                                            |
| Submitted commit         | **[FULL COMMIT SHA]**                                                                                           |
| Primary judged clients   | ChatGPT in-app Browser; Chrome 149+ with WebMCP enabled                                                         |
| Entrant / representative | **[MARK CONFIRMS]**                                                                                             |
| Open-source license      | **[MARK APPROVES A DETECTABLE LICENSE]**                                                                        |

Recommended submission tagline:

> The market learns what proof to show—not what each buyer will pay.

## Thirty-second explanation

Shopping agents work well when a product page already contains the answer. They fail when a decision depends on a missing physical fact: the edge of a used snowboard, an appliance noise, a collectible's seal, or a repair history.

Here, ChatGPT keeps the buyer's private ceiling, shares only the product-evidence requirements, and asks the live host for one normalized observation. The host sees what evidence a private crowd needs—not their identities, budgets, or individual decisions. Once reviewed evidence satisfies the requirements, the page dynamically exposes a reversible hold. That hold can unlock an authoritative UCP merchant Cart on a second origin; cancellation removes the capability and purges the private handoff.

WebMCP is the collaboration membrane between private reasoning, live page truth, human senses, and merchant authority.

## Devpost description

### Why is this use case a strong fit for WebMCP?

A live marketplace owns fast-changing, page-bound truth: the current item, public quote, inventory, host answers, camera evidence, user-visible activity, and the actions that are safe right now. ChatGPT owns the buyer's private conversational context and should not have to disclose it wholesale to that marketplace.

WebMCP lets the page expose a small semantic capability frontier over the exact state the human is viewing. At first ChatGPT can inspect the show and share four product-evidence fields. If a required fact is missing, a host-evidence tool appears. Only after reviewed evidence supports the requirements does an exact-quote hold appear; only after that hold does an authoritative merchant-cart action appear. Canceling or changing state removes tools again. That situated, state-dependent collaboration would be weaker and less safe as a detached backend MCP server or brittle DOM automation.

### How does it create a better user experience?

The buyer can express the real decision once in natural language. ChatGPT tracks the requirements, keeps the maximum price private, asks for the one missing fact, and compares the public quote locally. The page shows a privacy receipt, evidence status, provenance, current tools, and attributed activity, so the human can see exactly what was shared and what changed.

The host no longer triages repetitive comments or receives unnecessary buyer profiles. Several private decisions can join one normalized evidence request, and one bounded camera answer can update them all. The solo demo starts with labeled deterministic demand fixtures, then can replace all seven one-for-one with uniquely credentialed attendee browser sessions whose only mutation is joining that question. Every consequential step remains visible, reversible, and available through equivalent human controls. A deterministic, permission-free fallback keeps the complete experience testable when a camera, model, or second device is unavailable.

### What can people and agents do together that was difficult or impossible before?

Private agents can coordinate a human observation without pooling the private reasons behind it. In the demo, the attending buyer's agent opens one repair-history request. Seven labeled fixture signals make the path immediately runnable, while seven short-lived attendee credentials can replace those fixtures one-for-one. Each attendee page exposes only inspection plus a single join mutation; it cannot see buyer context or invoke host, hold, Cart, checkout, payment, or reset authority. The host still receives one request: show the base and disclose whether it has ever been repaired.

The host chooses what to capture and publish. A selected frame receives timestamp, dimensions, frame identity, and a SHA-256 fingerprint; an optional vision model proposes only a pixel-grounded observation; the host accepts or corrects it and separately attests historical repair information. That one reviewed public fact changes what the buyer's agent is allowed to do. The result then composes across the open web with a separate UCP merchant that owns the Cart, exact `$423` total, expiry, idempotency, and continuation—not the evidence app.

This pattern extends beyond commerce to remote inspections, support, field work, accessibility, and any decision where an agent needs a person to point a camera at reality before acting.

The problem is measured, not merely imagined. A 2026 [buyer-agent experiment](https://arxiv.org/abs/2604.26220) found that seller-side dialogue recovered willingness to pay nearly one-for-one even when explicit budget leakage was controlled. A separate [study of 292 experienced livestream shoppers](https://doi.org/10.1186/s40691-022-00327-3) found that seller product demonstrations significantly reduced product uncertainty and that uncertainty significantly reduced purchase intent. This project answers both findings structurally: minimize what the market can receive, then route one specific missing physical fact to the human who can show it. Those studies motivate the problem; the submission claims only the privacy, attention-compression, capability-gating, and reversible-commerce behavior demonstrated here.

### How was WebMCP implemented?

The app calls native `document.modelContext.registerTool` directly. Seven narrow buyer tools appear and disappear with revisioned page state: inspect the live show, set evidence requirements, request host evidence, reserve or release the current lot, and prepare or cancel the merchant Cart. The buyer never sees all seven simultaneously. A name-keyed React reconciler keeps unchanged tools registered with fresh state and aborts only capabilities that truly disappear, avoiding whole-frontier flicker and pre-Chrome-153 in-flight cancellation. A separate merchant origin registers two more state-aware tools to inspect and cancel the private continuation. Inputs use strict JSON Schemas, handlers validate again at runtime, safety annotations describe read/write and untrusted-output behavior, registrations are awaited, and cancellation signals are propagated where the current provider supplies them. Merchant free text is omitted from buyer-agent results while typed totals/status remain.

Human controls call the same domain transitions as Site Tools. A Cloudflare Durable Object owns the separately authenticated buyer/host evidence room, revisions, reconnect behavior, idempotency, and private UCP credential. A second SQLite-backed Durable Object owns the original merchant's Cart lifecycle. Its released UCP `2026-08-25` profile and direct Cart/error outputs pass the official JSON Schemas; `$375` item subtotal plus `$48` flat fulfillment equals the room's exact `$423` quote. The merchant can inspect and cancel but cannot check out, order, pay, or collect buyer data.

A generated Lean `4.33.1` decision table controls both registration and authoritative acceptance of the hold. The four theorems cover capability eligibility, modeled private-ceiling noninterference, revision freshness, and exact-quote binding; the repository rejects `sorryAx`, replays the environment with `leanchecker --fresh`, and binds the 16-case table to its source hash. The visible receipt says what this does **not** prove: camera truth, seller honesty, or full implementation equivalence.

The interface uses Next.js `16.3.3` and React `19.2.8`. Vercel AI SDK `7.0.83` and AI Gateway provide the optional reviewed vision proposal, with a manual path remaining authoritative. Chrome-format model evals, 128 deterministic application/Workers tests, strict TypeScript, production builds, proof verification, and a clean native Chrome runner verify tool churn, stale-handle rejection, reload recovery, and the complete buyer → host → room → merchant → room lifecycle while suppressing credentials from logs. A public-release preflight additionally rejects redirects, split commits, miswired UCP, broken CORS, or a room service that cannot create a real Durable Object.

## Judge testing instructions

The app requires no account, payment method, microphone, or camera. Allow about two minutes. The second host surface can be any ordinary browser or phone; it does not need WebMCP.

1. Open **[FINAL PUBLIC HTTPS URL]** inside ChatGPT's in-app Browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled. Click **Reset demo**. The page should say **Site Tools live**, **Durable Object live**, and **Authoritative** in the preflight.
2. Tell ChatGPT privately: `My maximum all-in price is $450.` Do not enter that number anywhere on the site.
3. Use **Copy agent starter** and send the copied prompt to ChatGPT. It should inspect the show, share only minimum length `154`, maximum length `158`, visible-edge requirement `true`, and prior-base-repair-forbidden `true`, then ask the host for the missing repair-history evidence. It should stop before a hold.
4. Click **Show private phone QR**, scan it with any phone camera, and hide the QR after the phone joins. **Open phone host** is the same-device fallback. The temporary URL fragment is scrubbed after authentication, and the invite controls disappear from the buyer page while the host is online. The host should see one normalized request serving eight test-agent decisions and no `$450`, buyer identity, cart credential, or continuation URL.
5. Use the camera/review path if convenient. For the permission-free path, click **Show base · no repair**. Return to the buyer page; the evidence envelope should now be supported and `reserve_current_lot` should appear.
6. Ask ChatGPT: `Re-inspect. If all requirements are supported and the exact quote is within my private maximum, create only the reversible hold at the exact current quote. Then prepare the authoritative merchant cart. Stop before any checkout or payment.` The page should show an attributed `$423` hold and a UCP receipt with `$375` item subtotal + `$48` flat shipping = `$423` exact total.
7. Follow the buyer-only merchant continuation. Its native Site Tools can inspect and cancel that exact Cart but cannot order or pay. Cancel it, return to the room, and ask ChatGPT to reconcile or cancel there. The private continuation disappears, the cancel tool is removed, and the reversible hold can be released.
8. If anything is stale, click **Reset demo** and repeat. Equivalent visible controls remain available at every step.

Expected privacy result: the host surface never receives the private `$450` ceiling, buyer identity/profile, individual decision, Cart ID, or merchant continuation. The merchant receives only the fixed variant, quantity, public localization/action context, public platform profile, and an idempotency key.

## Rubric proof matrix

| Criterion             | Judge-visible proof                                                                                                                                                              | Repository proof                                                                                                                                                                    | Remaining final gate                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| WebMCP Leverage       | Tools appear only when live evidence makes them meaningful; real calls alter the shared page; the journey crosses to a second WebMCP merchant origin.                            | Nine native registrations across two origins; seven dynamic buyer definitions; Lean-generated capability frontier; schema/runtime validation; credential-suppressed native journey. | Repeat the full prompt in the final ChatGPT build and capture DevTools/Site Tools evidence.             |
| Execution             | Coherent buyer page, private any-phone QR handoff, camera and no-permission paths, privacy receipts, exact hold, exact UCP Cart, cancellation, reset, and preflight.             | Keyed tool lifecycle; stale-handle/reload recovery; Durable Objects; idempotency; strict TypeScript; deterministic tests; proof replay; two Worker dry-runs; production build.      | Stable unprotected URLs, clean public clone, external comprehension test, and physical phone/item pass. |
| Potential Impact      | One host answer updates eight private decisions while reducing repetitive questions and unnecessary disclosure. The pattern generalizes to remote inspection and field evidence. | Explicit privacy boundary tests, bounded provenance, host review, human-equivalent controls, and merchant data minimization.                                                        | Record the real physical-camera moment and keep claims specific to the demonstrated audience/problem.   |
| Creativity & Ambition | Private agents direct the physical world, evidence changes capability, and a separate open-web merchant owns the outcome.                                                        | Camera provenance + reviewed AI proposal + epistemic multicast + proof-carrying dynamic WebMCP + released UCP composition.                                                          | Make this causal chain—not vendor logos—the first 135 seconds of the video.                             |

WebMCP Leverage is also the first tie-breaker. The video must visibly show registration churn and two-origin composition, not merely mention them.

## 2:45 video cut

Capture the real app in a supported judged client. Use an owned physical item and rights-cleared surroundings. No third-party product marks, footage, music, or notifications may appear.

The exact prompts, word-for-word narration, capture layout, take matrix, and cold-view gates live in [DEMO.md](DEMO.md). This table remains the submission-level edit contract.

| Time        | Visual/action                                                                                                                                        | Narration purpose                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `0:00–0:12` | ChatGPT beside the live buyer page; host phone visible in frame.                                                                                     | “Shopping agents know what pages know. They fail when the answer is a physical fact nobody captured.” |
| `0:12–0:28` | Tell ChatGPT the `$450` maximum privately; paste the product-only starter. The page's privacy receipt remains empty.                                 | Establish the split: private reasoning in ChatGPT, public live truth on the page.                     |
| `0:28–0:48` | ChatGPT inspects and sends exactly four evidence fields. Existing length/edge proof resolves; repair history remains missing; no hold tool exists.   | Make native WebMCP and data minimization visible without explaining architecture yet.                 |
| `0:48–1:06` | ChatGPT requests host evidence. The host phone changes from waiting to “8 private decisions need one fact.”                                          | Land epistemic multicast: private demand becomes one useful public question.                          |
| `1:06–1:30` | Host points the camera at the owned item, captures one frame, reviews/corrects the proposal, separately attests history, and publishes.              | Show human control, physical-world evidence, provenance, and the model's bounded role.                |
| `1:30–1:48` | Buyer evidence turns supported and `reserve_current_lot` appears. ChatGPT privately compares `$423 ≤ $450`; user confirms the exact reversible hold. | “The page did not give the agent a buy button. It exposed exactly what became safe.”                  |
| `1:48–2:10` | ChatGPT prepares the Cart; show `$375 + $48 = $423`, UCP `2026-08-25`, and follow the private second-origin continuation.                            | Prove the outcome is merchant-authoritative open-web composition, not an app-owned mock checkout.     |
| `2:10–2:27` | On the merchant page, inspect and cancel. Return to the room: private handoff purged, cancel tool gone, release available.                           | Demonstrate reversibility, lifecycle integrity, and dynamic tool removal.                             |
| `2:27–2:40` | Architecture card, then crop to the green machine-checked capability receipt beside `reserve_current_lot`.                                           | Name the composed implementation and show that the consequential tool frontier is proof-carrying.     |
| `2:40–2:45` | Return to buyer/host privacy receipts.                                                                                                               | “The market learned what proof to show—not what the buyer would pay.”                                 |

Capture two backup cuts:

- permission-free: replace camera/model steps with **Show base · no repair** while preserving every real WebMCP and distributed-state transition;
- silent failure recovery: deliberately reset once, prove the app recovers, and keep this as edit insurance rather than part of the primary cut.

## Claims ledger

### Safe to claim after the current local/tailnet checkpoint

- Direct native WebMCP registration and dynamic `2 → 3 → 2 → 3 → 2 → 3` buyer tool churn pass in Chrome 151.
- A separately authenticated buyer/host room passes revision, idempotency, reconnect, stale-state, and cross-role replay tests in Cloudflare's Workerd runtime.
- Host camera opt-in, video-only capture, bounded selected-frame publication, SHA-256 byte fingerprinting, explicit review/correction, separate history attestation, and a complete manual fallback work.
- An authenticated Vercel AI Gateway call returned a structured, abstaining visual proposal for the synthetic acceptance frame; the model is not authoritative.
- The exact `$423` hold, owned merchant UCP `2026-08-25` Cart, buyer-only second-origin continuation, merchant cancellation, room reconciliation, credential purge, and release pass in one native Chrome journey.
- Business profile, direct Cart, and error outcome validate against the official released UCP schema graph.
- A Lean `4.33.1` source-bound 16-case table gates hold registration and authoritative acceptance; the theorem environment passes `leanchecker --fresh` with no `sorryAx`. The proof is explicitly limited to the abstract capability model.
- The earlier compact buyer flow passed in ChatGPT's in-app Browser.
- Seven unique attendee credentials replaced seven deterministic fixtures in seven distinct browser tabs, producing a visible `8 live · 0 fixture` receipt. Duplicate credentials did not double-count after Durable Object hibernation; attendee role escalation and credential/ID leakage are covered by Workerd and contract tests.

### Must pass before the same claims enter the final submission without qualification

- Stable public, credential-free buyer/room/merchant origins remain healthy from a clean external network.
- The current full two-origin journey passes model-driven in the final ChatGPT build.
- A real phone and rights-cleared physical item complete camera capture on the final origins.
- A person unfamiliar with the project understands and completes the canonical path without coaching.
- The public repository clones, installs, tests, builds, exposes the full dated history, and displays the approved license.
- The public YouTube cut is audible, rights-clean, under three minutes, and matches the frozen live revision.

### Do not claim

- The seven authenticated test-agent sessions are real external buyers, independent model instances, or production demand. They prove unique least-authority browser credentials and aggregate convergence only.
- A JPEG hash proves authenticity, or a vision model proves historical repair status.
- Voice can currently drive the UI-owned Site Tools end to end.
- The merchant can check out, charge, create an order, or accept payment.
- Shopify is the judged merchant. Its isolated preview is an interoperability control; the owned merchant is the reliable path.
- Vidably production systems, private research, customer data, or pre-existing code are part of this repository.
- The project prevents every possible statistical inference. It enforces a concrete data-minimization boundary.

## Repository and rights preflight

- [ ] Mark chooses the project name.
- [ ] Mark confirms entrant/team/representative and eligibility facts.
- [ ] Mark approves the open-source license and exact copyright holder.
- [ ] `LICENSE` exists and the public repository host detects it.
- [ ] Public repository description and About panel link to the live URL.
- [ ] Full challenge-period history begins August 26 and remains visible.
- [ ] `document.modelContext.registerTool` is easy to find from the README.
- [ ] No secrets, private cart/room URLs, customer data, Vidably material, or local machine paths appear in tracked files/history.
- [ ] Every image, physical object, font, sound, clip, and logo in the video is owned, licensed, or omitted.
- [ ] Public clean clone passes `pnpm install --frozen-lockfile`, `pnpm check`, and both Worker dry-runs.
- [ ] `pnpm test:ucp-schema` passes against the same released UCP version.
- [ ] `pnpm release:verify` proves one commit across the public app and both Workers, UCP alignment, security headers, CORS, and a real disposable room.
- [ ] Live health, reset, fallback, and canonical journey pass in clean ChatGPT and Chrome sessions.
- [ ] Video is public on YouTube, audible, `< 3:00`, and its links work logged out.
- [ ] Devpost draft contains the four answers, exact test instructions, URLs, and no unsupported claim.
- [ ] Re-read official rules/resources immediately before submission.
- [ ] Record the exact commit/deployment/video hashes and freeze repo, site, and Devpost through judging.
- [ ] Create a separate post-deadline fork before any continued work.

Local repository audit, 2026-08-27 PT:

- The dated history begins August 26, the challenge start date, and the current branch has no remote.
- The current tracked tree contains zero high-confidence API-key/private-key signatures, no absolute user path, and no private tailnet hostname. Native WebMCP registration is linked directly from the README.
- Two historical patch lines contain the development tailnet hostname. Before publishing, either preserve them as non-secret dated acceptance evidence or redact them with a recoverable history rewrite; do not accidentally squash away the challenge-period history.
- `LICENSE` is intentionally absent until Mark approves the license and copyright holder. This is a hard submission blocker because the rules require the repository host to detect the license.

## User-only final actions

These actions require Mark's identity, legal assent, account session, or explicit publication approval. Everything surrounding them should be prepared first.

1. Choose the public project name.
2. Confirm whether the entrant is Mark individually, a team, or an organization, and appoint the representative if needed.
3. Approve the open-source license/copyright holder.
4. Complete any one-time Cloudflare account authentication or terms acceptance needed for permanent no-cost deployment.
5. Approve creation/push of the public repository and verify its license detection.
6. Approve the final rights-clean YouTube upload.
7. Review and submit the Devpost entry before **September 3, 2026 at 1:00 p.m. PT**.
