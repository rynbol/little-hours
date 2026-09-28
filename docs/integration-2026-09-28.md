# Integrating Little Hours

The integration starts from main at `bf3159d`. It preserves the current room, island, fishing, avatar, audio, backup, timer and decorating features while bringing in the outstanding pet and navigation work.

## Feature inventory

| Source | Behavior to preserve | Verification |
| --- | --- | --- |
| Main and merged avatar branches | Wardrobe choices, portrait rotation, timer pause and resume, grounded walking and door arrival | avatar, doors, room harness |
| Main and research-adoptions | Audio preference, completion chime, save export, restore and undo, tab synchronization | audio unit tests, backup and timer browser journeys |
| Main and room-types | Six designs, greenhouse growth, attic stars, study trees, floating island, garden stroll and Willow Pond | room-type units, house, rooms, decorate, pond, timer |
| PR 2 at `b319fb2` | Illustrated picker, quick previous/next travel, personal room names, physical door walks and cancellation, keyboard and phone support | room-picker, rooms, doors, accessibility |
| PR 3 at `d55e412` | Live clay pets, paid meals, free affection, hearts, adoption and belongings, study gifts, renderer disposal | pet units, companions, pet, pet-appeal browser journeys |
| Claude room-types at `539c57a` | Stock each bait tier in local development, preserve existing bait, exclude pinned tests and production | fishing units and development/production checks |
| Older focus-mode at `995101a` | Whole-room focus view, small timer, start/resume, Escape and close without pausing, exit on completion | port to current modules and focus journeys |

The pet-pair friendship UI and Memory display are intentionally retired by PR 3. Player-pet hearts, names and progress remain, and legacy pair data is archived. They must not return through conflict resolution.

## Shipping checklist

- [x] Resolve the forge and independently verify PRs 2 and 3. GitHub CLI is available; Origin is not. Two independent same-model reviewers cover the two open PRs.
- [ ] Land only the contiguous verified run rooted at the bottom.
- [ ] Re-check that each verdict still describes the patch.
- [ ] Prepare only the bottom PR.
- [ ] Land one PR at a time.
- [ ] Do not read GitHub autoMergeRequest as stack readiness.
- [ ] Recompute after every merge.
- [ ] Watch the current frontier until it merges or fails. Do not mutate the queue around it.
- [ ] Stop at the ceiling.

The root agent owns the combined code review, merge resolutions, feature inventory and full regression run. Reviewers own bounded independent PR verdicts. GPU tests run one lane at a time. CPU checks can run alongside code review. Existing worktrees and user preview data remain intact.

## Merge decisions

The CI matrix keeps room-picker and removes the retired friendships journey. The shared verification steps support both the room dialog and the new pet collection disclosure. Browser instructions retain the user's in-app preference. Main remains checked out in the primary repository while an isolated worktree validates the combined result.

## Findings and fixes

Independent production checks found that PR 2's added navigation row could move Done behind the phone header. Decorating now reserves room for the row and keeps the heading in view. Card, arrow and house-page transitions also cancel when another tab starts focus, with a fresh store guard at arrival. Both findings pass the new production regressions and the 77-check navigation/door suite.

PR 3 repeatedly searched for an impossible dining spot in a valid crowded room. Failed searches now stay cached until layout or relevant companion inputs change. The review benchmark fell from 746–780 ms to 0.16–0.19 ms per 1,000 calls. Positive meal placement behavior is preserved.

The older bait feature settled overdue sessions before the UI could show their completion. Stocking now follows the normal initial timer tick and delivers any update through the app. Stocking also respects the inventory limit, preserving earned bait in full and nearly full saves. Production and pinned sessions receive no development top-up.

Focus Mode is ported into the current timer module. It preserves the whole cutaway, deadline, captured pet and existing rewards. Entry settles overdue sessions before attempting a start; exit leaves the timer running. Opening care, remote state changes, completion and disposal release the view. The obsolete branch's monolithic application files are not restored.

Cross-feature store tests cover room building and personal names, wardrobe, fish records, paid care, selected gifts, archived legacy pair data, backup/restore/undo and once-only completion across stale tabs. Production browser checks explicitly verify bait boundaries and Focus Mode using persisted saves rather than development-only state access.

The original PR 2 controls CI job intermittently reported Adaptive after clicking Save energy, while its duplicate at the same commit passed. This remains a disclosed harness/input concern; it is not attributed to the room-navigation changes without evidence.
