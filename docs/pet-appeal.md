# A pet worth coming back to

The current care card is usable, but the pet is too small to read and the main study reward is a number. This pass makes its face, reactions, and shared study progress visible.

## Workflow

- [x] Read the Principles section of poteto-mode.
- [x] Phase A: Frame.
- [x] Phase B: Design the workflow.
- [x] Phase C: Run the loop.
- [x] Phase D: Keep the audit trail.
- [x] Phase E: Local verification and handoff evidence. Final CI results are reported by the pull request.

Completion means that the room and an expressive pet close-up are visible together, all five pets share the same art direction in both views, direct touch produces an immediate reaction, and completed study time unlocks a tangible pet gift that persists and can be displayed. Paid meals, free affection, existing progress, phone access, reduced motion, and hidden-tab suspension must continue to work. The final PR must pass the repository checks, real-input journeys, visual inspection, performance comparison, memory check, and CI.

This is one visual and behavioral pass in the existing PR, approximately three independently verifiable units. First compare three layouts using the real pet model. Then implement the chosen pet presentation and shared model improvements. Finally add focus gifts and prove the complete loop. No changes to the room camera, social networking, or monetization are needed.

Throughput checkpoint: the primary agent owns implementation and visual exploration. One reused agent grounds the rendering and reward boundaries and later reviews the final change. The primary agent performs any web research. This limits pstack's default agent fan-out at the user's request.

## Design experiment

The scratch prototype compares a pet nook card, a combined study companion card, and a room lens. These are layout alternatives using the same live model, not production features. The pet nook won: it gives the face room to read while preserving the cutaway. It borrows the study action from the combined card. The room lens obscured furniture, and the combined timer gave the number too much emphasis.

## Data and ownership

Existing `petBonds[id].minutes` proves completed study time. A gift catalog defines milestone minutes and its visual identity. A bond stores only the selected gift. Earned gifts are derived from completed minutes; the existing state-store transaction validates displaying a gift against the latest save. New milestones select the latest gift automatically, with no separate claim ledger. Renderers consume that result without awarding rewards.

The room remains the physical simulation. A close-up renderer, if selected, reuses the same pet mesh and animation implementation. Its lifetime belongs to the pet panel, including disposal when the panel closes, motion preferences, and document visibility. It must not recreate itself on each cooldown or reward update.

## Hypotheses

1. A large live face and recognizable silhouette make affection more legible than a small static portrait. Compare all species and touch reactions directly.
2. A visible next gift creates a concrete reason to finish a session. Verify a session unlocks it exactly once and the player can keep it in the room.
3. A pet close-up can coexist with the cutaway within a small render budget. Measure the open card, not only the closed room.


## Verification

The focused browser run first found a focusable aria-hidden canvas and two contrast failures. The canvas now has a negative tab index, and the affected labels use darker ink. All 27 complete Playwright checks passed on stable source; after the final heart framing and gaze correction, the seven pet-specific checks passed again. The 229 unit checks, room harness, production build and guard pass. Real-input companions, pet, timer and controls journeys pass 111 checks.

One reused reviewer found shader readiness under reduced motion, an immediate-pause study label mismatch, and reaction feedback crossing pet identities. These are fixed. Browser regressions cover readiness, immediate pause, species changes, gifts and disposal; a model test verifies horizontal gaze and reduced-motion stillness. A phone check verifies that an offscreen close-up stops rendering and resumes when visible.

Final visual inspection includes all five pets, all three physical gifts, desktop and phone care, and the completion reveal. The live in-app preview additionally exposed cropped reaction hearts; their close-up path now stays beside the face. Automated performance and heap comparisons are recorded below when complete. These checks establish rendering and functional correctness; improved study motivation remains a product hypothesis.


Four alternating Metal rounds of the open care card against the prior card (`b06b3c5`) held 59.9 RAF frames/s with a 16.7 ms p95 frame gap, versus 59.9 and 16.8. Main-thread idle cost measured 138.5 versus 142.1 ms/s, a difference within normal variation. Opening the card measured 88 versus 56 ms. Both had zero page errors and no frame gaps over 50 ms. GPU timings and draw counts in this harness cover the room scene; idle main-thread time includes the close-up.

The comparison against main (`bf3159d`) is a different workload: main's full pet page hides the room. Main-thread idle cost was 155.4 versus 8.29 ms/s; both maintained approximately 60 RAF frames/s and a 16.7 ms p95 gap. The side-by-side design deliberately keeps the animated room visible.

Thirty care open/switch/close cycles preserved one engine, one canvas, and stable scene object counts. After warmup, JS heap growth was 17.5 KB/cycle versus main's 62.0 KB/cycle, below the 64 KB limit on both. Evidence: `.lh/out/2026-09-28T09-30-44-heap`, `.lh/out/2026-09-28T09-35-21-perf`, and `.lh/out/2026-09-28T09-36-58-perf`. Final desktop and phone completion shots were inspected separately after their entrance animation settled.
