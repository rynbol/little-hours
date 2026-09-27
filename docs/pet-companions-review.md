# Companion redesign verification

The user requested pstack after the implementation and first verification passes. This record starts at that checkpoint. Earlier test results below are observed artifacts, not claims that pstack guided the original implementation.

## Workflow

- [x] Read the principles in pstack poteto-mode and its Codex host mappings.
- [x] Phase A. Frame the work and define completion.
- [x] Phase B. Design the remaining workflow.
- [ ] Phase C. Resolve concrete failures, review the implementation, and repeat affected checks.
- [ ] Phase D. Keep the decision trail in `pet-companions-decisions.tsv`.
- [ ] Phase E. Verify the whole experience and hand back the branch.

Completion means that naming, rituals, adoption, wishes, invitations, focus rewards, ribbons, and portrait export work in the browser and persist correctly. New motion must honor reduced motion and leave room controls usable. Unit tests, room checks, build, accessibility, browser flows, screenshots, performance, and retention checks must have recorded outcomes.

This is a cross-cutting change across persistence, pets, room motion, and UI. Review therefore uses three independent reviewers, the same intent and rubric, and real Chrome checks against main. The configured pstack roles all inherit the parent model. These are independent same-model reviews. No cross-model consensus is claimed.

The remaining work has two independent parts. Reviewers inspect the source while the lead measures browser behavior. Browser performance runs alone to avoid competition from other checks. The lead judges findings, fixes accepted issues, and verifies affected behavior before commit.

## Evidence

The executable browser journey is `scripts/lh/flows/companions.mjs`. Run it with `npm run lh -- run companions --headed`.

- `npm test` passes all 188 tests. The room check, guard, and production build pass.
- `npm run test:e2e` passes all 10 tests, including zero axe violations in the expanded pet notebook.
- The companions, pet, timer, controls, and avatar journeys passed 125 checks before the final direct-tap addition. The final pet flow passes all 25 checks, including saved cuddle progress after adoption.
- Screenshot comparison uses `.lh/out/2026-09-27T21-03-15-shot/`. The notebook leaves the room visible and fits the mobile viewport. The portrait is a verified 1200 by 1500 PNG.
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
