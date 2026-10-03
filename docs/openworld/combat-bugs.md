# Warden combat audit

Goal 3 baseline: `6bc8a8f` plus the existing uncommitted player import. No owner bug list was present. Evidence was moved outside Git to `wilds-assets/progress-shots/combat-before-separation/baseline/`: a 22.3 second recording from Enter Wilds, walking to the arena with keyboard input, fighting and receiving victory. No placement or clock-control hook was used. Sampled HUD values agree with state, but this does not pass the visual checklist.

## Combat rules

- **C1 — Rule fixed and tested: melee passes through standing stones.** Enter, follow the path, lock with Tab, dodge the first charge to the right, then attack from the near side of the stone the Warden hits. At 10–13 seconds the Warden loses health while the stone separates the player from its body. The new contact rule rejects intervening obstacles; a failing regression now passes for stones and tree trunks.
- **C2 — Fixed and tested: pet skill damages at a distance before contact.** Lock and press Q while the pet approaches the first charge. At combat time 7857 ms, skill damage and skill start share a timestamp while the pet is several metres from the Warden. Ordinary pet attacks also resolve at their start, before any windup. Pet strikes now wait for a data-defined contact time and recheck range/obstruction. Distant skill commands queue an approach; recall cancels contact. The HUD acknowledges a queued skill immediately; its regression failed before the text/state fix and now passes.
- **C3 — Fixed and tested: landed hits have no hit-stop.** In the repeated attacks at 18–21 seconds, neither movement nor action time pauses on damage. Every damage event now requests a short pause. The scene pauses simulation/action time while keeping camera input responsive and buffering commands; both event and scene regressions failed before the fix and now pass.
- **C4 — Fixed: attack timing and reach are scattered.** Sword timings, sword reach, pet skill reach, pet attack reach and Warden charge collision live in separate rules. `src/core/wilds/attacks.js` now owns attack timing/reach in one row per attack. Current values still need alignment with the eventual authored clips.
- **C5 — Fixed, tested and replayed: death retains the pet's skill cooldown.** Enter, walk to the Warden, recall the pet and allow the Warden to lower player health to 26. Lock, command the pet and use its skill, then take the next fatal attacks without dodging. In the real-input run `2026-10-03T00-48-55-run`, the skill started at 23872 ms and death reset the encounter at 33721 ms, but the pet's skill deadline stayed 37872 ms. The player and pet were healed at camp while the HUD still showed a cooldown from the failed attempt. The strengthened retry check failed, and the unit regression failed with “Pet skill · 14s” after respawn. Respawn now clears skill, attack and recovery timers; the unit regression passes. The stronger real-input replay also passes: at 33317 ms the pet follows at camp with skillReadyAt 0 and “Q · Pet skill ready” in the actual HUD. The old retry scenario never used a skill before death and missed this case.

## For the look agent

- **L1 — Open: the player has no walking, sword or dodge animation.** The preserved player branch has an idle imported body. After separation, the combat branch again has the committed capsule and upright sword. Both slide without swing or roll motion. This prevents checklist lines 1–3 from passing; the exact `combatAction: combat.playerAction` handoff is present in `scene.js`, but clips in `src/models/wilds/player.js` are outside this scope.
- **L2 — Open: lock-on framing loses the fight behind a standing stone.** At 10–13 and 16–17 seconds the camera pitches toward the ground and the stone fills the screen. The marker can remain visible although the Warden is occluded. Camera corrections belong in `src/features/wilds/camera.js`.
- **L3 — Open: pet and Warden attacks have no body animation.** The pet slides and stands beneath the Warden; ordinary damage has no visible contact. The Warden remains rigid during attacks. Ground marks alone do not establish blade or paw contact. `src/models/wilds/encounter.js` is outside this goal's files.

## Acceptance

Consecutive fights with every checklist line true: **0 / 10**. After the C5 fix, ten fresh consecutive real-input scenarios reached victory and passed 92 checks, including use of a pet skill before death. L1–L3 remain visible. This is not ten bug-free fights and Goal 3 is not complete. No blind picture judge has been used because no visual piece has been built and static images cannot certify contact timing.

## Separation checkpoint

Player work is preserved locally on `codex/wilds-player-glb` at `79749db`: only the three model files, exported public assets, Blender player script and package script changed. No pycache is committed. The combat branch again uses the committed capsule and encounter; public/wilds and tools are absent. The combatAction handoff remains intact. Its old Ranger shader failure is confined to the preserved player branch.

All combat videos, frame captures and large records are outside Git in `wilds-assets/progress-shots/`. New lh combat runs write there directly. Original raw recordings and a full separation backup are retained. The pre-separation play-style batch was intentionally interrupted before changing the working tree and is not counted toward acceptance. A test-driver spawn assertion caused by an unnecessary W tap was corrected by removing that tap.

The required real-time fight now runs as part of `lh run wilds`, so the existing CI job cannot skip it. The default run passed 36 checks; the completed ten-style run passed 91. No placement, damage shortcut or clock-control hook sets up these recorded fights.

## Follow-up play and verification

The queued-skill HUD follow-up now has a red/green regression and says “Closing in” as soon as the command is queued. All 907 unit tests and guard pass with this change.

The post-separation batch recorded a death and successful retry (61.4 s), leaving mid-fight and a clean re-entry victory (39.8 s), and a pointer-attack victory. Death/retry capture sheets were reviewed across the complete run: the camp reset and victory notification agree with the state, but rigid capsule/sword/pet motion and stone-obstructed framing still prevent visual acceptance. The pet-only driver died to six long-range root strikes; it had incorrectly stopped reacting outside melee range. The driver now sidesteps root telegraphs at range. This was an automation-controller failure, not evidence of unavoidable damage. The failed recording is retained externally.

Performance preparation supports `LH_REAL_FIGHT=1`, which records Enter Wilds, walks to the encounter using real keys and records the measured fight. It uses no position or clock-control setup. The preserved legacy measurement fixture is not used for Goal 3 evidence.

The first performance comparison included a 53 fps working-tree sample overlapping capture compression; the other working-tree sample held 60 fps. A fresh isolated comparison measured 60 fps on both sides, no frame gaps over 20 ms, 3.5 ms GPU time for the working tree versus 3.7 ms for the baseline. Both reports are retained under the external progress-shots/performance folder.

## Ten-scenario checkpoint before C5

The completed batch is `wilds-assets/progress-shots/2026-10-03T00-25-47-run/`; each `wilds-combat-<style>` directory contains the original video, frames, input timestamps and combat state record. Review sheets and players are in the sibling `2026-10-03T00-25-47-review/` directory. Every sheet across every run was inspected at one-second intervals including the actual final frame. This sampled visual review does not establish 100 ms feedback or frame-accurate contact. Full recordings remain available.

| Order | Style | Light | Capture length | Mechanical result |
| --- | --- | --- | --- | --- |
| 1 | Balanced | Day | 28.17 s | Victory |
| 2 | Rush | Dusk | 31.07 s | Victory |
| 3 | Back off | Rain | 60.77 s | Victory after disengaging and returning |
| 4 | Circle | Day | 63.53 s | Victory; pet recovered from knockout |
| 5 | Late dodge | Dusk | 34.78 s | Victory |
| 6 | Mash attack | Rain | 29.01 s | Victory |
| 7 | Initially idle | Day | 41.98 s | Victory after 14 seconds of inactivity |
| 8 | Pet alone | Dusk | 109.60 s | Victory without a player strike; pet recovered twice |
| 9 | Death and retry | Rain | 61.40 s | One intentional death, camp reset, then victory |
| 10 | Leave and return | Day | 40.00 s | Clean re-entry, then victory |

All sampled HUD meters matched state. Every recorded damage timestamp has a corresponding hit-stop event. Simultaneous player/pet hits can share the same pause and are deduplicated in the recording. No traversal stall or page error appeared. The separate pointer-attack run also reached victory.

| Goal checklist | Result and limit |
| --- | --- |
| 1. Every input responds visibly within 100 ms | No: L1; timing cannot be certified from the current poses. |
| 2. Damage matches blade contact | No: L1; obstacle/range rules are fixed, but the blade does not swing. |
| 3. Invulnerability matches the roll | No: L1; there is no visible roll to align. |
| 4. Every Warden attack is readable and avoidable | Not fully verified: ground telegraphs can be reacted to, but L2 hides parts of the fight and L3 lacks body tells. |
| 5. Lock keeps the target visible and releases | No: L2; release on death, reset and victory works. |
| 6. Pet attacks visibly connect without blocking | No: L3; contact rules are tested, but visible paw contact is absent. |
| 7. Nothing gets stuck, including camera | No: movement completed every route, but L2 still obstructs the camera. |
| 8. HUD matches events | Yes in the observed runs and sampled state checks. |
| 9. Death, retry and victory reset cleanly | The original check missed C5. After the fix, the strengthened skill-use-before-death replay passes, including the camp HUD. |
| 10. Leaving and returning starts clean | Yes in both recorded re-entry runs. |

Pre-C5 gates: **907/907 unit tests, guard, verify:room, build and 91/91 Wilds checks passed**. The isolated comparative fight held 60 fps. Review tooling now includes the last frame and can reference the original external video without redundant encoding. No additional gameplay change was made during this batch.

What still feels wrong: combat remains a sliding capsule beside rigid bodies, with much of close combat hidden by stones. The scoped rule fixes cannot make blade contact, roll protection or lock framing meet the requested bar. L1–L3 require the look agent's files; they remain open instead of being treated as test passes. Further checkpoints stay in this owned file under the owner's latest scope restriction.

## Retry cooldown follow-up

The C5 reproduction recording and its complete set of sampled review sheets are retained outside Git under `2026-10-03T00-48-55-run/` and `2026-10-03T00-48-55-review/`. The camp HUD visibly counts down after death at 35–38 seconds. The replay controller now issues a pet skill late in the fatal attempt and saves the first observed respawn state, including the actual HUD skill text.

With the timer reset, **908/908 unit tests, guard, build, verify:room and 92/92 Wilds checks pass**. The fresh ten-scenario batch is retained under `2026-10-03T00-54-17-run/`, beginning with the strengthened death/retry case. Every one-second review sheet and final frame was inspected across all ten runs; the 41 sheets, original-video players, copied test report and acceptance record are in `2026-10-03T00-54-17-review/`. This remains sampled review, not a claim that every video frame was watched.

| Order | Style | Light | Capture length | Mechanical result |
| --- | --- | --- | --- | --- |
| 1 | Death and retry | Rain | 61.33 s | Skill used before one intentional death; ready at camp; victory after retry |
| 2 | Balanced | Day | 28.50 s | Victory |
| 3 | Rush | Dusk | 31.07 s | Victory |
| 4 | Back off | Rain | 54.90 s | Victory after disengaging and returning |
| 5 | Circle | Day | 29.62 s | Victory |
| 6 | Late dodge | Dusk | 28.40 s | Victory |
| 7 | Mash attack | Rain | 29.07 s | Victory |
| 8 | Initially idle | Day | 43.70 s | Victory after 14 seconds of inactivity |
| 9 | Pet alone | Dusk | 76.36 s | Victory without a player strike; pet recovered from knockout |
| 10 | Leave and return | Rain | 39.24 s | Clean re-entry, then victory |

Every sampled health meter agreed with combat state and every recorded damage timestamp had a hit-stop event. The first retry sample showed full player/pet health, no lock, no active player action and no pet skill cooldown. No new combat-rule failure appeared in this batch. Full visual acceptance remains **0/10** because L1–L3 persist; the next complete acceptance run needs the look agent's animation and camera changes. No files outside Goal 3 ownership were changed for this follow-up.
