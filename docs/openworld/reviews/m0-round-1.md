# M0 review round 1

Review mode is **M0 preliminary**, performed independently with blind evidence restrictions.

Build identifier is base commit `13fc9ee`, source fingerprint `ca64a6c3b35c1748089f81b34208d891da7e4ebe0aa0e8c525fe46083f8095ad`. Evidence package is `docs/openworld/shots/m0-round-1/`.

The review covers the `empty-scene` infrastructure item in day, dusk, and rain. Finished world art, avatar animation, gameplay controls, combat, pets, bosses, and gameplay HUD remain outside M0 completion claims.

Reviewer context consisted only of the rubric, neutral manifest, and its three images. The reviewer did not receive source code, design documents, progress, builder notes, gate logs, or previous scores.

Gate results were not supplied. This review does not verify the design document, check page, `lh` flows, tests, Node 24, Babylon.js 9.27.1, or Blender animation provenance.

## Coverage

All file references below are relative to `docs/openworld/shots/m0-round-1/`.

| Item ID | Type | Due milestone | Day | Dusk | Rain | Clip sequences | Input sequences | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| empty-scene | Infrastructure | M0 | `empty-scene-day.jpg` | `empty-scene-dusk.jpg` | `empty-scene-rain.jpg` | None supplied; no game animation due at M0 | None supplied | Static output cannot establish Enter/Leave behavior or complete infrastructure gates |

The manifest records a 1440 × 1000 viewport at scale 1, seed `three-rooms`, normal motion setting, and fixed clock at 2500 ms after start. Each image is one still. There are no frame ranges, real capture timestamps, camera-view descriptions, or input events. The fixed-clock value is not evidence of elapsed real time, response latency, or frame rate.

## empty-scene

### Visible observations

All three images show a uniform background filling the viewport and two rounded controls at the upper left. Day is pale blue, dusk is muted pink, and rain is blue-grey. “Enter Wilds” appears muted; “Leave Wilds” has dark text on a light background. Both labels are visible and unobstructed.

These captures support the limited observation that theme-specific empty-scene output and its visible control shell were captured successfully. They contain no geometry, spatial depth, material surfaces, character, gameplay HUD, or motion. A flat field is consistent with the explicitly empty M0 checkpoint and is not scored as a finished biome.

No material flaw observed in the supplied evidence for this limited static presentation.

### Criterion record

`D`, `U`, and `R` below refer respectively to the day, dusk, and rain filenames in the coverage table. Each reference means the complete supplied still at the manifest’s fixed-clock time of 2500 ms. `Pending` records future work rather than an exemption or passing score.

| Criterion | Clip or condition | Score, NO, N/A, or Pending | Evidence frames and times | Observed defect or unscored reason |
| --- | --- | --- | --- | --- |
| L1 BotW air, painterly light, haze, lifted shadows | Day, dusk, rain | Pending — M1 onward | D/U/R, single still each, fixed clock 2500 ms | Background colours differ, but no surfaces, shadows, distance layers, or local lighting are visible. Initial playable-world evidence is due from M1. |
| L2 Originality | Day, dusk, rain | Pending — M1 onward | D/U/R, single still each, fixed clock 2500 ms | Empty backgrounds and simple controls cannot establish original world, character, architecture, or interface design. No specific copied form is observable. |
| L3 Readable silhouettes | Day, dusk, rain | Pending — M1 onward | D/U/R, single still each, fixed clock 2500 ms | No player, environment item, important interactable, pet, or boss silhouette is present. |
| L4 Palette | Day, dusk, rain | Pending — M1 onward | D/U/R, single still each, fixed clock 2500 ms | Preliminary theme colours are visible. Biome relationships, material separation, depth, and interactive cues require populated scenes. |
| L5 Detail up close | Day, dusk, rain | Pending — M1 onward | D/U/R, single still each, fixed clock 2500 ms | No gameplay asset or nearest normal gameplay view exists in these captures. |
| L6 Nothing that looks cheap or unfinished | Day, dusk, rain | Pending — M1 onward | D/U/R, single still each, fixed clock 2500 ms | The empty scene is the stated M0 scope. It cannot establish the finish of future geometry, materials, shadows, or joins. |
| A1 Anticipation | Future attack clips | Pending — M2; later due combat items | D/U/R contain no attack frames | Combat preparations require complete attack sequences when combat becomes due. |
| A2 Readable hit frame | Future attack clips | Pending — M2; later due combat items | D/U/R contain no contact frames | No weapon, attacker, target, hazard, or impact is present. |
| A3 Follow-through | Future movement and ambient clips | Pending — M1 onward | D/U/R are stills without motion sequences | Locomotion, landings, ambient motion, and later attacks require complete entry, action, and recovery evidence. |
| A4 Weight | Future character movement clips | Pending — M1 onward | D/U/R contain no character | No acceleration, balance, takeoff, landing, or momentum can be assessed. |
| A5 No foot sliding | Future grounded movement clips | Pending — M1 onward | D/U/R contain no body or ground contact | Grounded locomotion requires timed whole-body sequences with visible terrain contacts. |
| P1 Telegraphs can be read | Future encounters | Pending — M2 and M5 | D/U/R contain no encounter | Normal-speed warnings, active moments, and recovery must be shown in relevant conditions when each boss becomes due. |
| P2 The boss mechanic is clear without text | Future boss encounters | Pending — M2 and M5 | D/U/R contain no boss or arena | Failed and successful responses with visible consequences are absent because boss play is future content. |
| P3 Controls respond | Future movement and camera inputs | Pending — M1 onward | D/U/R contain no synchronized inputs | Visible Enter/Leave buttons do not establish gameplay response. M1 requires real-time input/action evidence. |
| P4 The HUD is legible | Future gameplay and encounters | Pending — M1 onward, expanded at later milestones | D/U/R show only the infrastructure controls | Button labels are visible, but no health, stamina, progression, pet, boss, or lock-on HUD can be assessed. Later elements remain pending until their due milestones. |

The single worst flaw is the **missing observation of the Enter/Leave lifecycle**: D/U/R each show only one static state, with “Enter Wilds” muted and “Leave Wilds” visible. No before/action/after evidence establishes that entering and leaving actually work. This is an evidence limitation, not an invented visual defect.

The inferred boss mechanic is **Pending — M2/M5**; no boss is due or shown at M0.

The item has **no numeric quality score**. Future game content has not reached its review milestone.

The item verdict is **Infrastructure checkpoint only**.

## Evidence limitations and future coverage

- The stills establish a visible empty-scene presentation. They cannot independently prove the rendering implementation, capture command, check-page behavior, or complete `lh` flow skeleton.
- No evidence supports performance claims, including empty-scene frame rate or 60 fps in populated scenes.
- Technical gates require separate evidence. Screenshots cannot establish engine/runtime versions, animation provenance, numerical rules, save compatibility, coin ownership, or friendship behavior.
- The next mandatory blind quality loop begins at M1 and requires actual playable content: day/dusk/rain environment views, normal and close views, walking and border routes, ambient and character motion sequences, and synchronized real-time movement/camera inputs.
- Combat is pending M2; progression and interaction M3; pet play M4; further boss mechanics M5; whole-game coverage M6. The supplied evidence does not identify a finer item-by-item world-art schedule, so none is invented here.

## Round disposition

| Item | Lowest score | Unresolved NO entries | Verdict | Single worst flaw | Next required evidence or correction |
| --- | --- | --- | --- | --- | --- |
| empty-scene | No numeric score; future criteria Pending | None assigned to future game content | Infrastructure checkpoint only | No Enter/Leave lifecycle observation in D/U/R | Separate infrastructure validation; fresh M1 evidence from actual playable content |

The milestone verdict is **Infrastructure checkpoint only**. This is not a pass for final art, animation, gameplay, performance, or the complete set of technical M0 gates.

| Item | Three consecutive round scores | Different approach | Follow-up round and score | Known weak point record |
| --- | --- | --- | --- | --- |
| None | No scored history reviewed | Not invoked | Not applicable to this preliminary record | Rule 7 not invoked |
