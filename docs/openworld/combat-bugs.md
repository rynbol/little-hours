# Warden combat audit

Goal 3 baseline: `6bc8a8f` plus the existing uncommitted player import. No owner bug list was present. Evidence was moved outside Git to `wilds-assets/progress-shots/combat-before-separation/baseline/`: a 22.3 second recording from Enter Wilds, walking to the arena with keyboard input, fighting and receiving victory. No placement or clock-control hook was used. Sampled HUD values agree with state, but this does not pass the visual checklist.

## Combat rules

- **C1 — Rule fixed and tested: melee passes through standing stones.** Enter, follow the path, lock with Tab, dodge the first charge to the right, then attack from the near side of the stone the Warden hits. At 10–13 seconds the Warden loses health while the stone separates the player from its body. The new contact rule rejects intervening obstacles; a failing regression now passes for stones and tree trunks.
- **C2 — Fixed and tested: pet skill damages at a distance before contact.** Lock and press Q while the pet approaches the first charge. At combat time 7857 ms, skill damage and skill start share a timestamp while the pet is several metres from the Warden. Ordinary pet attacks also resolve at their start, before any windup. Pet strikes now wait for a data-defined contact time and recheck range/obstruction. Distant skill commands queue an approach; recall cancels contact. The HUD acknowledges a queued skill immediately; its regression failed before the text/state fix and now passes.
- **C3 — Fixed and tested: landed hits have no hit-stop.** In the repeated attacks at 18–21 seconds, neither movement nor action time pauses on damage. Every damage event now requests a short pause. The scene pauses simulation/action time while keeping camera input responsive and buffering commands; both event and scene regressions failed before the fix and now pass.
- **C4 — Fixed: attack timing and reach are scattered.** Sword timings, sword reach, pet skill reach, pet attack reach and Warden charge collision live in separate rules. `src/core/wilds/attacks.js` now owns attack timing/reach in one row per attack. Current values still need alignment with the eventual authored clips.

## For the look agent

- **L1 — Open: the player has no walking, sword or dodge animation.** Throughout the baseline the imported body holds its idle pose, slides along the ground and remains upright when Ctrl dodges. `src/models/wilds/player.js` only updates yaw. This prevents checklist lines 1–3 from passing; the combat owner can pass `combatAction` through `scene.js`, but cannot implement clips in this scope.
- **L2 — Open: lock-on framing loses the fight behind a standing stone.** At 10–13 and 16–17 seconds the camera pitches toward the ground and the stone fills the screen. The marker can remain visible although the Warden is occluded. Camera corrections belong in `src/features/wilds/camera.js`.
- **L3 — Open: pet and Warden attacks have no body animation.** The pet slides and stands beneath the Warden; ordinary damage has no visible contact. The Warden remains rigid during attacks. Ground marks alone do not establish blade or paw contact. `src/models/wilds/encounter.js` is outside this goal's files.

## Acceptance

Consecutive fights with every visual checklist line true: **0 / 10**. The first entry-to-victory flow passed its six programmatic checks; the recording failed visual acceptance. No blind picture judge has been used because no visual piece has been built and static images cannot certify contact timing.

## Separation checkpoint

Player work is preserved locally on `codex/wilds-player-glb` at `79749db`: only the three model files, exported public assets, Blender player script and package script changed. No pycache is committed. The combat branch again uses the committed capsule and encounter; public/wilds and tools are absent. The combatAction handoff remains intact. Its old Ranger shader failure is confined to the preserved player branch.

All combat videos, frame captures and large records are outside Git in `wilds-assets/progress-shots/`. New lh combat runs write there directly. Original raw recordings and a full separation backup are retained. The play-style batch was intentionally interrupted before changing the working tree. Balanced, rushing, backing off, circling, late dodge, mashing and initial inactivity reached victory, but none passed visual acceptance. The mashing run also caught a test-driver spawn assertion after an unnecessary W tap; that tap is removed. Pet-only, death/retry and leave/re-entry still need completed recordings.

The required real-time fight now runs as part of `lh run wilds`, so the existing CI job cannot skip it. Unit-level contact and scene regressions pass after separation. After separation, all 904 unit tests, guard, build and all 36 Wilds flow checks pass. The room gate passed earlier in this change. Comparative fight performance and the remaining play styles are next.

## Follow-up play and verification

The queued-skill HUD follow-up now has a red/green regression and says “Closing in” as soon as the command is queued. All 907 unit tests and guard pass with this change.

The post-separation batch recorded a death and successful retry (61.4 s), leaving mid-fight and a clean re-entry victory (39.8 s), and a pointer-attack victory. Death/retry capture sheets were reviewed across the complete run: the camp reset and victory notification agree with the state, but rigid capsule/sword/pet motion and stone-obstructed framing still prevent visual acceptance. The pet-only driver died to six long-range root strikes; it had incorrectly stopped reacting outside melee range. The driver now sidesteps root telegraphs at range. This was an automation-controller failure, not evidence of unavoidable damage. The failed recording is retained externally.

Performance preparation supports `LH_REAL_FIGHT=1`, which records Enter Wilds, walks to the encounter using real keys and records the measured fight. It uses no position or clock-control setup. The preserved legacy measurement fixture is not used for Goal 3 evidence.

The first performance comparison included a 53 fps working-tree sample overlapping capture compression; the other working-tree sample held 60 fps. A fresh isolated comparison measured 60 fps on both sides, no frame gaps over 20 ms, 3.5 ms GPU time for the working tree versus 3.7 ms for the baseline. Both reports are retained under the external progress-shots/performance folder. The ten-fight batch now cycles day, dusk and rain.
