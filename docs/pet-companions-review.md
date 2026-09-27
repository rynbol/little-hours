# Companion redesign verification

The user requested pstack after the implementation and first verification passes. This record starts at that checkpoint. Earlier test results below are observed artifacts, not claims that pstack guided the original implementation.

## Workflow

- [x] Read the principles in pstack poteto-mode and its Codex host mappings.
- [x] Phase A. Frame the work and define completion.
- [x] Phase B. Design the remaining workflow.
- [x] Phase C. Resolve concrete failures, review the implementation, and repeat affected checks.
- [x] Phase D. Keep the decision trail in `pet-companions-decisions.tsv`.
- [x] Phase E. Verify the whole experience and prepare the branch for handoff.

Completion means that naming, rituals, adoption, wishes, invitations, focus rewards, ribbons, and portrait export work in the browser and persist correctly. New motion must honor reduced motion and leave room controls usable. Unit tests, room checks, build, accessibility, browser flows, screenshots, performance, and retention checks must have recorded outcomes.

This is a cross-cutting change across persistence, pets, room motion, and UI. Review therefore uses three independent reviewers, the same intent and rubric, and real Chrome checks against main. The configured pstack roles all inherit the parent model. These are independent same-model reviews. No cross-model consensus is claimed.

The remaining work has two independent parts. Reviewers inspect the source while the lead measures browser behavior. Browser performance runs alone to avoid competition from other checks. The lead judges findings, fixes accepted issues, and verifies affected behavior before commit.

## Evidence

The executable browser journeys are `scripts/lh/flows/companions.mjs` and `scripts/lh/flows/friendships.mjs`. Run them with `npm run lh -- run companions friendships --headed`.

The following evidence records the first implementation checkpoint. Final friendship-page results are recorded below.

- `npm test` passes all 188 tests. The room check, guard, and production build pass.
- `npm run test:e2e` passes all 10 tests, including zero axe violations in the expanded pet notebook.
- The companions, pet, timer, controls, and avatar journeys passed 125 checks before the final direct-tap addition. The final pet flow passes all 25 checks, including saved cuddle progress after adoption.
- Screenshot comparison uses `.lh/out/2026-09-27T21-03-15-shot/`. This was the earlier notebook layout; the later companion page replaces it and suspends the covered room. The portrait is a verified 1200 by 1500 PNG.
- The final four-round room measurement uses `.lh/out/2026-09-27T21-06-40-perf/perf.json`. Idle work is 185.7 ms/s against 188.4 on main, within measurement noise. Both use 146 draw calls and have a 16.7 ms 95th-percentile frame gap, with zero slow gaps and page errors. Extra geometry is 844 triangles. GPU frame time is 3.5 ms against 3.7 on main.
- The first 12-cycle retention run exceeded the 64 KB-per-cycle limit at 114.1 KB. The 30-cycle comparison passes on both versions. Second-half growth is 15.2 KB per cycle against 19.8 on main. Scene mesh, material, texture, geometry, engine, and canvas counts stay constant. Raw reports are in `.lh/out/2026-09-27T21-02-22-heap/`.
- The fox-tap check initially sampled hearts already active from adoption. It now waits for that animation to finish before asserting a fresh pair of hearts, then confirms the saved cuddle point.

## Review

The scoped Comment Sicko review found no new or changed comments or suppressions. No deletions or encodings were needed. The separate cursor-team-kit deslop plugin is unavailable, so the lead performs the code cleanup review with the installed pstack rubric and repository guard. Three independent same-model reviewers found five actionable issues. All were accepted: stale focused notebook data, cross-tab pet identity, mutable completion details, reduced-motion action timing, and completion contrast. The stale next-session pet preview was part of the identity correction. No reviewer findings were dismissed.

The chosen repair uses a completion result captured before the caller mutation, explicit pet IDs on commands, and input drafts keyed by pet. All internal completion consumers migrated together. A shared focus-owner function controls both preview and start. New interactions establish their own animation timestamp. The room check now proves that a reduced-motion interaction survives a 30-second idle gap and ends after its own duration.

The repair passes 191 unit tests, the room checks, guard, and production build. The completion and open-notebook browser regressions first failed, then passed after correction. The two-tab draft case passes with real tab selection and save; cold loading of its second software-rendered room needed a longer readiness wait. The open completion card passes axe after the text colors were darkened.

## Added friendship scope

The user then requested pet friendships and a larger UI redesign, and confirmed that friendships start within the owned collection. The chosen design combines one canonical pair record, saved per-pet buddy preferences, and a start-of-session pair snapshot. The page uses Together, Friends, and Keepsakes views around a stable selected pet and a visible collection. Future people can extend entity validation and presentation. There are no network accounts or invented players in this phase.

Independent design candidates and judgments are in `.lh/pstack-design/` and `.lh/pstack-friendships/`. The repair chose candidate C with focus/signature safeguards from A and B. The friendship design chose B's relationship model and C's page, with A's separate adoption row. The lead agreed with both independent judgments. All configured model roles inherit the same app model.

## Friendship-page verification

The expanded domain, state, and authored scene tests pass: 213 unit tests before the final zero-elapsed pause regressions. The room harness, guard, and production build pass. All 15 Playwright journeys pass, including Friends and Keepsakes accessibility, phone action sizes, daily/reverse-pair rewards, captured focus company, and real PNG image content. The original pet flow's accessible-label assertion was updated from hidden text to the actual `aria-label`.

The headed friendship flow passes 21 of 21 checks. It confirms that adopting a third pet creates three independent pairs, choosing future company leaves the active pair intact, Escape restores focus, reduced motion keeps both pets still, and no page errors occur. The desktop and 390px phone evidence, plus the real two-pet PNG inspected by both lead and reviewer, are in `.lh/out/2026-09-27T21-39-32-run/`.

Axe found insufficient contrast on the pair focus button (4.05:1). Darkening its brown background fixes the check. Review also reproduced an identity-loss edge after a zero-elapsed pause or a backward clock adjustment; the final repair retains captured identity while positive time remains and clears it only on a true reset. An expired running backup resets to a fresh session, while unfinished backups retain their original company.

The final review accepted and repaired all additional findings: zero-elapsed paused company, a dedication blur update swallowing the next click, inaccurate tier progress ARIA, daily badges remaining stale across midnight, and the pair button contrast. A missing portrait-milestone browser assertion was added; unused adoption overlay configuration and its stale documentation claim were removed. There are no new code comments, suppressions, or duplicate relationship ledgers.

The repaired domain passes 216 unit tests. Room checks, guard, and build pass. The headed companions, pet, timer, controls, and avatar flows pass 127 of 127 checks, alongside the 21 friendship checks. Their recorded play, paired scene, welcome, completion, and bond footage is `.lh/out/2026-09-27T21-42-16-run/companion-reel.webp`; the screenshot comparison is `.lh/out/2026-09-27T21-44-02-shot/`.

The first post-page performance run overlaps the final browser repair test and is not the delivery comparison. Its raw report remains `.lh/out/2026-09-27T21-44-16-perf/perf.json`. The 30-cycle memory run measured 72.4 KB per cycle in its second half, exceeding the 64 KB limit, with constant Babylon object counts. A longer run checks whether growth stabilizes after warm-up. The final seven affected browser journeys pass, including direct dedication-to-tab clicks, tier progress semantics, midnight badges before interaction, and actual rose-frame pixels in the exported PNG. The unlocked export is also visually inspected at `.lh/out/2026-09-27T21-39-32-run/our-little-friends-unlocked.png`. The final 60-cycle memory comparison passes on both builds: 15.4 KB per cycle in the second half for the working tree versus 8.1 on main, below the unchanged 64 KB limit. Working-tree heap is 60.2 → 61.5 → 61.9 MB. Engine, canvas, mesh, material, texture, and geometry counts remain constant on both builds, with no page errors. Reports: `.lh/out/2026-09-27T21-57-07-heap/`. The shorter failing run is preserved in `.lh/out/2026-09-27T21-45-27-heap/`. Final isolated performance is recorded after the copy refinement below.

A source review of the exact pet-selection cycle finds bounded controller maps and one retained hidden page. It also notes a pre-existing detached-control press-animation edge in unchanged `ui-feedback.js`: a control replaced between pointerdown and pointerup can leave its forwards-filled animation retained. Normal selection clicks release before replacement, so this does not establish the cause of the observed slope and is outside this change. A longer measurement or snapshots, not source inspection alone, decides whether the new page retains memory.

## Final copy refinement

The user asked for hearts and fewer small comments after inspecting the page. Rewards and counters now use heart marks, completed daily moments use checkmarks, and screen readers retain full reward and progress labels. Introductory subtitles, repeated encouragement, the decorative footer, and default portrait slogans are removed. Completion copy and receipts are also shorter.

All seven affected Playwright journeys pass again after this refinement. The final headed companion, friendship, and pet flows pass 70 of 70 checks, including explicit tests for the concise marks, accessible names, and absence of decorative copy. The final desktop, phone, portrait, and real interaction recordings are in `.lh/out/2026-09-27T21-56-17-run/`. Unit tests remain 216 of 216; guard and production build pass.

## Delivery measurements

The isolated four-round comparison in `.lh/out/2026-09-27T22-01-21-perf/perf.json` measures 183.2 ms/s idle work against 189.1 on main, within the stated ±10 ms/s noise band. The earlier isolated run measured 138.9 versus 128.1; that CPU increase does not repeat in the final comparison. Both use 146 draw calls and 3,271,968 render pixels. Working-tree frame rate is 59.8 versus 60.0 FPS; 95th-percentile frame gaps are 16.8 versus 16.7 ms, with zero slow gaps and page errors. GPU frame time is 3.1 versus 3.5 ms. Geometry increases by 844 triangles. Development-server readiness is 680.2 versus 585.3 ms (+94.9 ms); this is not a production startup benchmark.

The final screenshot comparison is `.lh/out/2026-09-27T22-02-33-shot/`. The lead inspected the final desktop and phone Friends layouts, the actual milestone portrait, and the shortened copy in the live preview. The final interaction reel is `.lh/out/2026-09-27T21-56-17-run/companion-reel.webp`.

`lh doctor` passes on real Metal rendering (Apple M5 Pro). The final build retains Vite's existing large-chunk warning. No dependencies or generated bundles were added. The scoped implementation, review, repair, and verification phases are complete; online friendships, App Store packaging, and audience validation are separate product work.

## Personal room follow-up

The subsequent request adds inline room naming, illustrated destination cards, and doorway travel from temporary views. [Room navigation verification](room-navigation.md) records its design, independent reviews, all 18 passing browser journeys, 222 passing unit tests, 105 affected real-GPU checks, and the later four-round performance and 30-cycle room-switching memory comparisons. Those later measurements cover the combined pet and room changes.
