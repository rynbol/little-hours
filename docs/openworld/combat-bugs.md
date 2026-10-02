# Warden combat audit

Goal 3 baseline: `6bc8a8f` plus the existing uncommitted player import. No owner bug list was present. Evidence starts at `shots/combat/baseline/`: a 22.3 second recording from Enter Wilds, walking to the arena with keyboard input, fighting and receiving victory. No placement or clock-control hook was used. Sampled HUD values agree with state, but this does not pass the visual checklist.

## Combat rules

- **C1 — Open: melee passes through standing stones.** Enter, follow the path, lock with Tab, dodge the first charge to the right, then attack from the near side of the stone the Warden hits. At 10–13 seconds the Warden loses health while the stone separates the player from its body. Sword range and facing are checked, but intervening obstacles are not.
- **C2 — Open: pet skill damages at a distance before contact.** Lock and press Q while the pet approaches the first charge. At combat time 7857 ms, skill damage and skill start share a timestamp while the pet is several metres from the Warden. Ordinary pet attacks also resolve at their start, before any windup. The attack rule needs a pending contact time and a fresh range/obstruction check.
- **C3 — Open: landed hits have no hit-stop.** In the repeated attacks at 18–21 seconds, neither movement nor action time pauses on damage. Add short contact pauses without freezing camera response or losing input.
- **C4 — Open: attack timing and reach are scattered.** Sword timings, sword reach, pet skill reach, pet attack reach and Warden charge collision live in separate rules. Consolidate attack specifications so the look agent can retune contact to clips.

## For the look agent

- **L1 — Open: the player has no walking, sword or dodge animation.** Throughout the baseline the imported body holds its idle pose, slides along the ground and remains upright when Ctrl dodges. `src/models/wilds/player.js` only updates yaw. This prevents checklist lines 1–3 from passing; the combat owner can pass `combatAction` through `scene.js`, but cannot implement clips in this scope.
- **L2 — Open: lock-on framing loses the fight behind a standing stone.** At 10–13 and 16–17 seconds the camera pitches toward the ground and the stone fills the screen. The marker can remain visible although the Warden is occluded. Camera corrections belong in `src/features/wilds/camera.js`.
- **L3 — Open: pet and Warden attacks have no body animation.** The pet slides and stands beneath the Warden; ordinary damage has no visible contact. The Warden remains rigid during attacks. Ground marks alone do not establish blade or paw contact. `src/models/wilds/encounter.js` is outside this goal's files.

## Acceptance

Consecutive fights with every visual checklist line true: **0 / 10**. The first entry-to-victory flow passed its six programmatic checks; the recording failed visual acceptance. No blind picture judge has been used because no visual piece has been built and static images cannot certify contact timing.
