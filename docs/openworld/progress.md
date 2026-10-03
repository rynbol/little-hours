# Wilds on three.js: progress

## Current step

Stages 1 and 2 are done and pushed. Stage 2 is the fight in shapes: the stone ring, the Stag of the Old Ring, the pet fighting at your side, campfires, the rewards and the wolf. Stage 3, the valley and its secrets, is next.

## Verified, and how

- Gates on the stage 1 commit: `npm test` (691 pass), `npm run guard` (0 problems), `npm run verify:room`, `npm run build`, and `lh run all` (740 of 740 checks, every flow).
- Climb and glide (stage 1b): `npm test` (700 pass), guard 0, `verify:room`, `build`, and `lh run all` (746 of 746 checks, every flow, including `wilds-memory`). `lh run wilds` now also walks to the cliff with real W and mouse drags, grabs the face instead of walking up it, climbs, mantles onto the ledge, climbs the upper face, mantles onto the top, steps off, opens the glider with Space in the air, checks it sinks under 2.6 m/s while moving forward faster than 4 m/s, and lands more than 12 m from the cliff. Unit tests cover grabbing, the climb speed, letting go when stamina runs out and not grabbing again until you have your breath back, a winded player stopping at the foot of a cliff, the leap and the let-go, the glider opening only well above the ground, warm air lifting a glider, walking off a cliff falling instead of striding down it, and a long fall stumbling without damage.
- Stage 2 gates: `npm test` (737 pass), guard 0, `verify:room`, `build`, and `lh run all` (768 of 768 checks, every flow, including the new `wilds-fight`).
- `lh run wilds-fight` plays the fight with real keys and clicks. It walks to the stone-ring campfire and lights it (saved), walks into the ring to wake the stag, locks on, and a bot that only presses keys and clicks dodges on telegraphs, lures charges in front of standing stones, and lands heavies on the open heart. The last run won in 51 s: 85 hits, 14 perfect dodges, 2 bound-backs, a stone stun and 2 heart hits, 18 pet hits, 3 hurts and no defeat. The win saves 240 XP, 3 heartwood, the antler trophy and the wolf, and never touches study gold. The wolf watches from the cliff until you walk out of the ring toward it, bows, comes down and follows. Every 4 s sample of the fight has a median frame gap of 16.7 ms. The flow then leaves, finds the Glowing antler in the Decorate collection and places it in the room.
- Unit tests for stage 2 cover every telegraph lasting 0.6 s or more, no blow landing sooner, the sweep arc, jumping the stomp wave, the charge into a stone stunning the stag with its heart open, a charge that meets no stone skidding to a stop, the phase shift at half health and the root lines after it, poise and stagger, the stag bounding back after three close blows and then charging, poise draining between scattered blows, perfect dodges opening a flurry, no hit taking more than a third of your health, waking at the last campfire with nothing lost, the pet's pounce, swipe and spin, its dash and taunt on a cooldown, its knock-out and campfire recovery, bond scaling its strength, petting, the wolf, campfire rest, the rematch, a calmed stag no longer blocking the way, a kneeling stag taking no more blows, and the antler joining the collection only once earned.
- `lh run wilds` plays the feel box with real keys and clicks: run, jump, roll, a three-hit combo that lands every swing on the dummy, a charged heavy whose hit freezes the frame for 0.1 to 0.2 s, lock-on, orbit, zoom, sprint and stamina. Each input shows a response within 100 ms (move 16 ms, jump 17 ms, attack 9 ms, dodge 5 ms). Median frame gap 16.7 ms, no frame over 20 ms, frame CPU p95 0.6 ms, 14 draw calls, pixel ratio capped at 1.5.
- `lh run wilds-memory` enters and leaves five times with play inside each visit. After the first visit has loaded three.js, not one more three.js scene, renderer, object, geometry, attribute, material or texture stays alive. The GPU ledger is back at the island's 185.3 MB after every visit, and the WebGL contexts are back to the island's own. The JS heap plus array buffers come back within 5 MB of the warm baseline. A heap snapshot diff showed that the small creep across visits is V8 compiled code, not app objects.
- Bundle: the room and island load 4,461,451 bytes (1,754,632 gzipped), against 4,491,818 (1,762,403) on `origin/codex/botw-look`. The retired forest route more than pays for the 1.4 KB of Wilds menu CSS. three.js and the Wilds arrive as one lazy 592 KB chunk only when the Forest pin is pressed.
- `lh perf --against origin/codex/botw-look`. Room: same draw calls (158) and triangles, GPU 4.25 against 4.10 ms, idle within run-to-run noise. House: same draw calls (40) and triangles, GPU 3.35 against 3.20 ms, taps equal or faster.

## Decisions made while the owner is away

- The island is freed while the Wilds draws. `house-ui.js` gained `release()` and `restore()` (eight lines of wiring) because the rules forbid editing `src/features/house/**` beyond what is needed, and the prompt requires the island's scene to be freed.
- `lh perf --view house` no longer taps the Forest pin, the same way it already skipped the pond. The pin now leaves the island for the Wilds, so tapping it in a house perf run measured a different place.
- Chrome's Energy Saver caps frames at 30 fps on battery at 20% or lower. Frame checks were run on mains power.
- Minimal wiring outside the Wilds folders for stage 2, each a few lines: `src/core/state.js` adds `wilds` to a fresh save and restores it through `normalizeWilds`. `src/core/catalog.js` adds the Glowing antler, marked `earned: 'stag-antler'`, and `collectionFor(state)`, which hides earned pieces until the save holds the trophy. `src/features/decorate/decorate-ui.js` lists `collectionFor(app.state)` instead of every non-unique piece. `src/models/furniture.js` adds the antler builder, and `src/features/decorate/furniture-art.js` its card picture. `wilds-ui.js` reads the pet bond through `bondLevel` and the pet name through `petName`, and never writes them. `.github/workflows/ci.yml` runs the new `wilds-fight` flow.
- The stag fights in a rhythm the player can learn. It bounds back after three blows up close, or after its poise breaks, and then charges. A charge that meets a standing stone stuns it and opens its heart, so the stones are the answer to the charge. The first build let the stag stand still and trade blows; the bot won in 28 s and never saw a charge.
- Poise drains at 30 a second, so scattered blows never stagger the stag, but a fast combo does.
- Lock-on picks a target within 22 m and inside the view cone, so you must look at the stag to lock it. Locked, the camera faces it, and W walks toward it.
- The wolf waits on the cliff until you come within 26 m. A timed bow happened while most players would still be looking at the reward banner.
- A calmed stag leaves the world's solids and targets, and comes back when you call it to a rematch with E at the ring's centre.
- A long fall never hurts. Landing faster than 22 m/s (about a 6 m drop) makes you stumble for half a second instead. The prompt asks for a cozy game and never asks for fall damage.
- Climbing and gliding work on the ground heightfield. Anything that rises more steeply than 1.25 m per metre is a wall. A wall can be climbed while stamina lasts. Without stamina it simply stops you. Stage 3 ruin walls and rock faces will be shaped into the same heightfield, so they climb the same way.
- The glider opens only when you are more than 1.2 m above the ground, so a second Space press during an ordinary jump never opens it.

## What remains

Stages 3 to 6: the valley and its secrets with the merchant, herbs, levels, swimming and the whistle, then the stag in Blender, the hero and pet in Blender, then life, weather, sound and polish. Then the full island-to-victory flow, every lighting's screenshots and the judge rounds.

## What looks or plays wrong

- The feel box is a grey capsule on an open green slope by design. Nothing in it is meant to look finished.
- The far ground is a flat, hazy green with no landmarks yet, so the slope reads as endless.
- The stag, pet and wolf are block-outs made of spheres and cylinders until stage 4.
- The camera pulls in hard when a standing stone is behind you, so a stone or the capsule can fill the frame.
- From the ring the wolf is a small dark shape on the cliff top. It needs a rim of light or a howl to be noticed.
- The antler trophy is thin for the room's scale, and its glow is faint at the room's zoom.
