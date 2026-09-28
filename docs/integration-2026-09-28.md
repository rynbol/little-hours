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

## Shipping sequence

Land PR 3, then PR 2, then PR 4. Fetch main after each merge, reconcile the next branch against that exact tip, compare the patch and require fresh green checks before landing. GitHub CLI is available; Origin is not.

Independent reviews passed the pet implementation at `782a155`, room navigation at `c368ab6`, and the combined production boundaries at `2494dc8`. The user subsequently requested no subagents. The root agent owns all later review and verification, including the performance-panel fix, and does not represent those later changes as independently reviewed. GPU tests run one lane at a time. Existing worktrees and user preview data remain intact.

## Merge decisions

The CI matrix keeps room-picker and removes the retired friendships journey. The shared verification steps support both the room dialog and the new pet collection disclosure. Browser instructions retain the user's in-app preference. Main remains checked out in the primary repository while an isolated worktree validates the combined result.

## Findings and fixes

Independent production checks found that PR 2's added navigation row could move Done behind the phone header. Decorating now reserves room for the row and keeps the heading in view. Card, arrow and house-page transitions also cancel when another tab starts focus, with a fresh store guard at arrival. Both findings pass the new production regressions and the 77-check navigation/door suite.

PR 3 repeatedly searched for an impossible dining spot in a valid crowded room. Failed searches now stay cached until layout or relevant companion inputs change. The review benchmark fell from 746–780 ms to 0.16–0.19 ms per 1,000 calls. Positive meal placement behavior is preserved.

The older bait feature settled overdue sessions before the UI could show their completion. Stocking now follows the normal initial timer tick and delivers any update through the app. Stocking also respects the inventory limit, preserving earned bait in full and nearly full saves. Production and pinned sessions receive no development top-up.

Focus Mode is ported into the current timer module. It preserves the whole cutaway, deadline, captured pet and existing rewards. Entry settles overdue sessions before attempting a start; exit leaves the timer running. Opening care, remote state changes, completion and disposal release the view. The obsolete branch's monolithic application files are not restored.

Cross-feature store tests cover room building and personal names, wardrobe, fish records, paid care, selected gifts, archived legacy pair data, backup/restore/undo and once-only completion across stale tabs. Production browser checks explicitly verify bait boundaries and Focus Mode using persisted saves rather than development-only state access.

The original controls CI job intermittently reported Adaptive after clicking Save energy, while its duplicate at the same commit passed. A controlled readout fixture demonstrated a real layout weakness: changing 16.7 ms to 1000.0 ms during a pointer press wrapped the reading and moved the button by 28 pixels. Timing values now stay on one line at a smaller size. The durable real-pointer test fails without the CSS fix and passes with it. This demonstrates the input failure mechanism without claiming that a captured CI trace proved the same cause.

The combined baseline passed 235 unit tests, the room harness, build and guard, all 332 real-input flow checks, and eight production browser cases. Two accessibility scans initially caught panels mid-fade; the tests now wait for finite animations before scanning, without disabling accessibility rules. CI splits the complete browser suite into two single-worker shards. Final exact-head CI and merge evidence is recorded on each PR.
