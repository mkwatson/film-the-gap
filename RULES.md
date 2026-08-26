# Official rules — operational checklist

Sources checked directly on 2026-08-26: [Devpost official rules](https://webmcp.devpost.com/rules) and the [official resources and FAQ](https://webmcp.devpost.com/resources). This is a working compliance summary, not legal advice. The official rules control and may change; recheck the live pages before every submission milestone.

## Hard dates — Pacific Time

| Event                                | Official date                                           |
| ------------------------------------ | ------------------------------------------------------- |
| Eligible work and registration begin | August 25, 2026, 11:00 a.m.                             |
| Registration and submission deadline | **September 3, 2026, 1:00 p.m.**                        |
| Judging                              | September 4, 10:00 a.m. through September 21, 5:00 p.m. |
| Winners announced                    | On or around September 23, 2:00 p.m.                    |

The 1:00 p.m. submission deadline is authoritative. A Netlify partner post published August 25 says 5:00 p.m.; do not use that secondary deadline.

Internal operating deadlines should leave time before 1:00 p.m. for upload, public-repository checks, licensing detection, live-runtime verification, and Devpost failure recovery.

## Judging mechanics

Stage one is pass/fail: the project must reasonably fit the theme and reasonably apply the required API/tooling.

Stage two has four equally weighted criteria:

1. **WebMCP Leverage:** thorough, skillful, working, non-trivial WebMCP use and genuine implementation effort.
2. **Execution:** a complete, coherent, working/runnable product experience rather than a technical proof of concept.
3. **Potential Impact:** a credible and specific real audience/problem, actually addressed by what is demonstrated.
4. **Creativity & Ambition:** novelty and meaningful difference from existing concepts.

Tie-breaks compare those criteria in that order, so WebMCP Leverage is the first tie-breaker.

The Sponsor may use one or more rounds, changing or unlisted judges, expert panels, peer review, automated AI analysis, or combinations of these. Known-judge product leverage is strategically valuable, but the submission must remain compelling under the public rubric without relying on a specific judge seeing it.

## What must ship

- [ ] A working WebMCP-powered web app imagining an open web where people and agents interact, collaborate, and create together.
- [ ] A stable live URL accessible in the ChatGPT in-app browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.
- [ ] Free, unrestricted judge access through September 21, 2026, 5:00 p.m. PT.
- [ ] Credentials and exact testing instructions in the submission if authentication is required.
- [ ] Consistent behavior matching the video and description.
- [ ] A public GitHub, GitLab, or Bitbucket repository with all source, assets, setup instructions, and everything needed to run the project.
- [ ] An open-source license file that the repository host detects and displays at the top of the repository page.
- [ ] A clear, inspectable native WebMCP implementation.
- [ ] A public YouTube demonstration video under three minutes, with audio explaining the product and WebMCP implementation.
- [ ] English submission materials, or English translations for all relevant materials.
- [ ] A Devpost text description answering all four required prompts below.

## Required text-description questions

The final description must explain:

1. Why this use case is a strong fit for WebMCP.
2. How it creates a better user experience.
3. What people and agents can do together that was difficult or impossible before.
4. Briefly, how WebMCP was implemented.

Draft these answers alongside product development. If the experience cannot answer them specifically and visually, it is not ready regardless of technical sophistication.

## Native implementation visibility

Under its public-repository requirements, the official rules page includes a literal `document.modelContext.registerTool({ ... })` example. The surrounding wording is awkward, but the zero-risk interpretation is to make a direct native registration path easy to find in the public source and link to it from the README.

We may still use MCP-B types or other helpers where they add value. Do not hide all WebMCP behavior behind an opaque dependency. The code, tests, and demo should make each registered tool, schema, annotation, execution path, and visible UI effect inspectable.

## New-work boundary and evidence

- The FAQ says new projects are highly encouraged.
- A new project must be created during the submission period.
- A pre-existing project is eligible only if meaningfully extended with WebMCP after August 25, 2026, 11:00 a.m. PT.
- Only work added during the submission period is evaluated for a pre-existing project.
- Pre-existing projects require clear documentation distinguishing prior and new work, such as timestamped dated commits or equivalent evidence.

Strategic implication: keep this challenge app purpose-built and its history clean. Vidably code, research, data, or services can provide owned leverage through an explicit boundary, but embedding the submission inside the pre-existing Vidably product would create avoidable scope and evidence ambiguity.

Maintain a dated local commit history immediately, then publish the complete history when Mark authorizes the external repository action. Mark the challenge-period implementation in the README.

## Video is a primary product surface

Judges are not required to test the app and may evaluate only the description, images, and video. They are not required to watch beyond three minutes.

Therefore:

- the first 30 seconds must show the human-agent collaboration and why WebMCP is necessary;
- show the app actually functioning in a supported judged browser;
- show the page's visible state changing because of real tool calls;
- explain the non-trivial WebMCP mechanics without turning the demo into a protocol lecture;
- show the complete outcome, recovery/safety behavior, and the most ambitious differentiator;
- avoid third-party trademarks, copyrighted music, or other material unless we have permission.

The video storyboard is an architecture and prioritization test, not end-of-week marketing work.

The resources FAQ contains one stale sentence saying "there's no video," but the same FAQ later requires a demo video and the Official Rules require a public YouTube video under three minutes. The Official Rules control: a video is required.

## AI-assistance and naming

The resources FAQ explicitly welcomes AI assistance for scaffolding, debugging, iteration, README work, descriptions, and edge cases. It also explicitly says not to use AI to name the project and not to describe the work vaguely, fake behavior, or overstate what is running.

- Mark chooses the public project name. Internal concept labels are descriptive only.
- Every submission claim must trace to a working flow, source file, test, or clearly labeled future direction.
- AI-generated prose receives the same factual, licensing, and originality review as code.

## Ownership, integrations, and licensing

- The submission must be original, solely owned by the entrant/team/organization, and must not violate copyright, trademark, patent, contract, privacy, publicity, or other rights.
- Open-source software is allowed when its license is followed and the submission enhances/builds upon it.
- Every third-party SDK, API, model, asset, and dataset requires authorization under its current terms and license.
- Third-party technical assistance is allowed only when the resulting submission remains the entrant's work product, ideas, creativity, and property.
- Do not use unlicensed trademarks, music, video, images, product footage, or other copyrighted material in the public demo.
- A project developed with financial or preferential support from OpenAI (Sponsor) or Devpost (Administrator) may be disqualified under the rule's conflict provision. Escalate any non-public funding, contract, commercial license, or preferential-access relationship before relying on it.

## Submission controls

- Treat the rules' contradictory multiple-submission sentence conservatively: prepare **one** submission for this entrant.
- Save and verify a draft before the deadline.
- After the submission period, substantive changes to the submission are not allowed unless specifically permitted for narrow cleanup such as rights or personal-information issues.
- The FAQ gives a stricter operational instruction: after September 3 at 1:00 p.m. PT, do not change the Devpost submission, submitted repository, or live site until winners are announced. Freeze all three. If continued work is necessary, make a separate fork that judges cannot confuse with the submitted revision.
- Keep the live build and any judge credentials working, free, and unrestricted until judging ends.
- Recheck eligibility, supported-country requirements, entrant/team representation, and any conflict-of-interest facts before submission.
- Do not push, publish, upload the video, submit, or message external parties without Mark's approval.

## Final compliance gates

### Before concept commitment

- [ ] The first complete rung can pass stage one with unmistakable, non-trivial native WebMCP use.
- [ ] The ambition ceiling can score highly on all four equal criteria.
- [ ] All essential data, assets, and services can be used and open-sourced or documented legally.
- [ ] The concept can be demonstrated without unlicensed third-party marks or media.

### Before public deployment

- [ ] Exact ChatGPT and Chrome runtime tests pass.
- [ ] Failure and recovery paths work without operator intervention.
- [ ] Authentication, credentials, quotas, and billing cannot block judges.
- [ ] The production build matches the intended video flow.

### Before submission

- [ ] Re-read the live official rules and record the check time.
- [ ] Confirm the Devpost draft and final deadline in Pacific Time.
- [ ] Verify live URL from a clean judge-like session.
- [ ] Verify public repository clone/setup, source completeness, and detected license.
- [ ] Verify YouTube video is public, under three minutes, audible, and rights-clean.
- [ ] Verify the four required text answers, testing instructions, and credentials.
- [ ] Freeze and archive the exact submitted build and revision.
- [ ] Create a post-deadline fork plan so the submitted repository and live deployment remain untouched throughout judging.
