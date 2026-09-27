# Personal rooms

The room heading can be renamed in place. Each room keeps its own name through decorating, travel, reload, and backup. Room cards show the destination design, the current location, and the next extension's cost. Choosing a destination uses the existing avatar walk and door animation.

## Workflow

- [x] `how` over the affected subsystem.
- [x] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items.
- [x] Delegate code-writing to a subagent using the configured feature model.
- [x] Verify on the matching surface.
- [x] Rebase into small, ordered commits. Stack follow-ups. The room changes form one follow-up commit on the existing feature branch; main has not changed.
- [x] If the design is contested, `interrogate` before shipping. Skip because no contested design remains after independent review.
- [x] Run Opening a PR. Update the existing feature PR, #1.

## Throughput checkpoint

- Blocking first steps. Trace name persistence and door navigation before changing either surface.
- Independent workstreams. The domain owner handles normalization and shared name consumers. The UI owner handles the heading, destination cards, and navigation. The lead owns browser journeys and verification. A separate reviewer diagnoses the previous CI failures.
- Shared mutable state. File ownership separates writes. Rename commands capture a room ID and update the latest stored house. No copied UI name is authoritative.
- Smallest safe decomposition. One owner handles the coupled UI and travel lifecycle. Existing walk, focus refusal, and reduced-motion behavior remain the route to a destination.

## Design decision

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Illustrated cards | All three destinations and the current location stay visible. One action starts travel. | Uses one compact row above the room. | Chosen. The house has three fixed room slots. |
| Current-room disclosure | Smaller closed footprint on phones. | Hides destinations and growth, adds dismissal/focus state, and obscures or shifts the room when open. | Rejected for this bounded collection. |

Model the Domain led to a nullable room name. Null follows the room design; a string is the user's literal name. House version 3 migrates the old default studio label once. One display helper serves headings, cards, doors, and the house page. This also permits a user to explicitly choose “Your studio” without having it replaced by the design name.

The implementation uses existing SVG room art and the existing avatar walk. There is no extra WebGL scene for the selector.

## Verification

- 222 unit tests, the room harness, build, and guard pass. The harness verifies that changing an unnamed destination's design updates its door name without entering it.
- All 18 Playwright journeys pass. The three room journeys cover drafts, literal names, reload, another tab changing rooms, Enter/Escape, blank input, focus refusal, phone controls, and zero axe violations in the new controls.
- The final room flow passes 23/23 in real Metal Chrome. It observes avatar displacement before arrival from the normal room, whole-house, mini, and decorating views. It also checks arrival focus and the walk to an unbuilt room before its plan opens. Evidence is `.lh/out/2026-09-27T22-20-16-run/`.
- House passes 40/40 in `.lh/out/2026-09-27T22-17-37-run/`. Doors and controls pass 23/23 and 19/19 in `.lh/out/2026-09-27T22-15-18-run/`. The initial room run in that last artifact had two failures because its synthetic Enter did not submit the draft. The repeatable flow now clicks Save; Playwright and native Cua Return separately verify keyboard submission.
- Independent same-model reviews found the need to restore keyboard focus after arrival. The implementation now focuses the destination heading and the flow checks it. Final naming/navigation and no-comments reviews found no remaining issues.
- Four alternating Metal performance rounds measured 59.8 FPS and 16.8 ms p95 frame intervals on both versions, with 146 draw calls and zero slow gaps/page errors. Idle work was 194.5 versus 190.9 ms/s on main, a 3.6 ms/s difference inside the documented noise band. GPU frame time was 3.65 versus 3.50 ms. Evidence is `.lh/out/2026-09-27T22-21-32-perf/perf.json`.
- Thirty room-switching cycles pass on working tree and main. Second-half retained heap growth is 26.9 versus 28.2 KB per cycle, below the 64 KB threshold; engines, canvases, meshes, materials, textures, and geometry counts remain constant. Evidence is `.lh/out/2026-09-27T22-22-42-heap/`.
- Before/after desktop screenshots were inspected in `.lh/out/2026-09-27T22-23-24-shot/`. The 390px phone screenshot confirms all three room cards fit, long names wrap/clamp, and the room remains visible.

The previous CI run also exposed test timing problems. Companion tests now allow 30 seconds for software-rendered startup. Rapid pet taps keep their intended 120 ms interval under `LH_SLOW`. The pond flow waits for its frame-bound cast to land and captures its screenshot after hooking, so the screenshot cannot consume the bite deadline. An instrumented software-rendered replay passed 43/43 pet/pond checks. The intermittent slow-render pet click was not explained, and no shared input-driver fix is claimed. That run is retained at `.lh/out/2026-09-27T22-16-47-run/`.

A final clean SwiftShader replay, without temporary instrumentation and using the combined working tree, also passes all 43 pet/pond checks with `LH_SLOW=4`. Its report is `.lh/out/2026-09-27T22-23-53-run/report.json`.
