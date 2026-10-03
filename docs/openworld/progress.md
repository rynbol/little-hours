# Wilds on three.js: progress

## Current step

Stage 1, the feel box, is done and pushed, now with the cliff, the ledge, climbing and gliding that the updated prompt asks for. Stage 2, the fight in shapes, is next.

## Verified, and how

- Gates on the stage 1 commit: `npm test` (691 pass), `npm run guard` (0 problems), `npm run verify:room`, `npm run build`, and `lh run all` (740 of 740 checks, every flow).
- Climb and glide (stage 1b): `npm test` (700 pass), guard 0, `verify:room`, `build`, and `lh run all` (746 of 746 checks, every flow, including `wilds-memory`). `lh run wilds` now also walks to the cliff with real W and mouse drags, grabs the face instead of walking up it, climbs, mantles onto the ledge, climbs the upper face, mantles onto the top, steps off, opens the glider with Space in the air, checks it sinks under 2.6 m/s while moving forward faster than 4 m/s, and lands more than 12 m from the cliff. Unit tests cover grabbing, the climb speed, letting go when stamina runs out and not grabbing again until you have your breath back, a winded player stopping at the foot of a cliff, the leap and the let-go, the glider opening only well above the ground, warm air lifting a glider, walking off a cliff falling instead of striding down it, and a long fall stumbling without damage.
- `lh run wilds` plays the feel box with real keys and clicks: run, jump, roll, a three-hit combo that lands every swing on the dummy, a charged heavy whose hit freezes the frame for 0.1 to 0.2 s, lock-on, orbit, zoom, sprint and stamina. Each input shows a response within 100 ms (move 16 ms, jump 17 ms, attack 9 ms, dodge 5 ms). Median frame gap 16.7 ms, no frame over 20 ms, frame CPU p95 0.6 ms, 14 draw calls, pixel ratio capped at 1.5.
- `lh run wilds-memory` enters and leaves five times with play inside each visit. After the first visit has loaded three.js, not one more three.js scene, renderer, object, geometry, attribute, material or texture stays alive. The GPU ledger is back at the island's 185.3 MB after every visit, and the WebGL contexts are back to the island's own. The JS heap plus array buffers come back within 5 MB of the warm baseline. A heap snapshot diff showed that the small creep across visits is V8 compiled code, not app objects.
- Bundle: the room and island load 4,461,451 bytes (1,754,632 gzipped), against 4,491,818 (1,762,403) on `origin/codex/botw-look`. The retired forest route more than pays for the 1.4 KB of Wilds menu CSS. three.js and the Wilds arrive as one lazy 592 KB chunk only when the Forest pin is pressed.
- `lh perf --against origin/codex/botw-look`. Room: same draw calls (158) and triangles, GPU 4.25 against 4.10 ms, idle within run-to-run noise. House: same draw calls (40) and triangles, GPU 3.35 against 3.20 ms, taps equal or faster.

## Decisions made while the owner is away

- The island is freed while the Wilds draws. `house-ui.js` gained `release()` and `restore()` (eight lines of wiring) because the rules forbid editing `src/features/house/**` beyond what is needed, and the prompt requires the island's scene to be freed.
- `lh perf --view house` no longer taps the Forest pin, the same way it already skipped the pond. The pin now leaves the island for the Wilds, so tapping it in a house perf run measured a different place.
- Chrome's Energy Saver caps frames at 30 fps on battery at 20% or lower. Frame checks were run on mains power.
- A long fall never hurts. Landing faster than 22 m/s (about a 6 m drop) makes you stumble for half a second instead. The prompt asks for a cozy game and never asks for fall damage.
- Climbing and gliding work on the ground heightfield. Anything that rises more steeply than 1.25 m per metre is a wall. A wall can be climbed while stamina lasts. Without stamina it simply stops you. Stage 3 ruin walls and rock faces will be shaped into the same heightfield, so they climb the same way.
- The glider opens only when you are more than 1.2 m above the ground, so a second Space press during an ordinary jump never opens it.

## What remains

Stages 2 to 6: the fight in shapes with the pet, the valley, the stag in Blender, the hero and pet in Blender, then life, weather, sound and polish. Then the full island-to-victory flow, every lighting's screenshots and the judge rounds.

## What looks or plays wrong

- The feel box is a grey capsule on an open green slope by design. Nothing in it is meant to look finished.
- The far ground is a flat, hazy green with no landmarks yet, so the slope reads as endless.
