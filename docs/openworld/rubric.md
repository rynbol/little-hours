# The Wilds blind review rubric

This rubric defines the visual and play review required by section 6 of the open-world brief. It covers original art with BotW's atmosphere, Blender-authored animation, and readable play. The technical gates and the visual review are separate requirements. Neither replaces the other.

## Review scope

Each biome, landmark, character, and boss is a separate item. Each pet species is a character item. Animated benches also receive an item. A boss item includes its arena, attack set, phase change, and defeat. Every new clip receives evidence and its own animation rows within its item's review.

Every item receives all 15 criterion rows below. A reviewer assigns an integer from 1 to 10 when the evidence supports a judgment. The reviewer also records one single worst flaw for the item, with a frame reference. Criterion rows identify the observed defect or the reason that a score is unavailable.

| Entry | Meaning | Effect on the verdict |
| --- | --- | --- |
| `1` through `10` | The evidence supports this score. | Every applicable criterion must score at least 8. |
| `NO` | Not observable. The criterion applies, but the evidence cannot establish it. State the missing capture. | Blocks a pass. It is not zero, a passing score, or an exemption. |
| `N/A` | Not applicable to this item's nature. State the specific reason. | Excluded from scoring, with the exclusion visible in the result. |
| `Pending` | A required item has not reached its planned milestone. | No score and no completion claim. It becomes required when that milestone is reviewed. |

Static scenery has no character attack, feet, or input response. Its animation and control rows can be `N/A` for those reasons. A still of a character cannot establish its animation quality or control response. Those applicable rows are `NO` until sequences show them. An idle clip has no attack hit frame, so that row can be `N/A` for that clip while it remains required for the character's attacks.

Ambient motion has applicable motion criteria. Grass can have follow-through, but it has no foot contacts. Floating or flying characters have no planted feet during flight, but their grounded moves still need contact evidence. The reviewer states these distinctions rather than filling every row with the same score.

Absent required content cannot be marked `N/A`. The reviewer records `NO` for a missing required clip or mechanic on a due item. The review inventory lists missing due items separately. Any such absence blocks milestone completion. Future content remains `Pending` and cannot count toward completion of the game.

## M0 is an empty-scene checkpoint

M0 establishes the design, check page, empty scene, and `lh` flow skeleton. It does not claim finished world art, an animated avatar, controls, combat, pets, or bosses. The mandatory blind quality loop begins at M1.

An M0 capture can establish that the canvas renders and that the evidence path works. A preliminary review can describe any visible lighting or composition. It cannot establish the final forest, vista, silhouettes, materials, animation, HUD, or play quality. Record absent game content as `Pending`, with the planned milestone. Do not award it 8 or use `N/A` to hide missing future work.

An M0 record uses the verdict `Infrastructure checkpoint only`. An empty-scene performance measurement establishes only empty-scene performance. It does not prove 60 fps in populated biomes or boss fights. M1 and later use fresh evidence from their actual playable content.

## Score anchors

| Score | Observed quality |
| --- | --- |
| 1 | The criterion fails throughout the evidence or the action cannot be understood. |
| 2 | Severe defects obscure most of the item or action. |
| 3 | The item or action is recognizable, with repeated severe defects. |
| 4 | Several defects disrupt readability or believable motion. |
| 5 | The basic intent reads, but obvious unfinished work dominates. |
| 6 | The intent reads consistently, with substantial distracting defects. |
| 7 | Almost ready, with at least one visible defect that needs correction. |
| 8 | Meets the criterion below in every required capture. Remaining flaws are minor. |
| 9 | Consistently polished, including close views and difficult conditions. |
| 10 | No material flaw is visible across the required evidence. The reviewer states the limits of that evidence. |

The item score is its lowest numeric score across all applicable rows, clips, themes, and required sequences. Do not average away a failure. `NO` makes the item unscorable as a whole until the missing evidence arrives, even if other rows have numeric scores. A pass also requires complete coverage and no applicable `NO` entries.

## Criteria

Each 8-point description is a minimum passing standard. A reviewer can score higher only when the captures support it. Day, dusk, and rain are separate conditions. A flaw in one condition counts even if the other two look good.

| ID | Required line | Evidence and minimum for 8 |
| --- | --- | --- |
| L1 | BotW air, painterly light, haze, lifted shadows | Wide and close views show soft light ramps, legible shadow detail, and layered blue-grey distance. Warm highlights and calm atmosphere remain coherent in the local theme. Black shadows, flat depth, or harsh plastic highlights fail this standard. |
| L2 | Originality | Silhouettes, costumes, creatures, architecture, symbols, and interface shapes read as Little Hours. The reviewer identifies any specific resemblance that makes an item look copied. An unfamiliar angle or missing detail is not proof of originality. |
| L3 | Readable silhouettes | The item has a clear outline at its gameplay distance and a distinct distant shape where relevant. Player, pet, boss, attack pose, and important interactables separate from the background in each theme. |
| L4 | Palette | The item's colours belong to its biome and theme. Materials remain distinct. Warm and cool relationships support depth, and interactive cues remain visible without relying only on colour. |
| L5 | Detail up close | The nearest normal gameplay view has deliberate forms, clean joins, and coherent material scale. Faces, gear, leaves, rocks, arena props, and moving joints withstand inspection where present. Distant-only footage cannot establish this. |
| L6 | Nothing that looks cheap or unfinished | The full required set has no placeholder geometry, exposed seams, clipping, abrupt terrain or palette borders, broken shadows, or obvious repetition that dominates a view. Cropping out an unfinished area does not remove it from scope. |
| A1 | Anticipation | Every attack has a distinct readable preparation before its active moment. The preparation conveys direction or area at normal playback speed. The first, middle, and last anticipation frames are present. |
| A2 | Readable hit frame | The active pose and visible impact agree in time and space. The weapon, body, effect, and target make contact or an intentional miss readable. Damage without visible contact or a mismatched hazard footprint fails this standard. |
| A3 | Follow-through | Momentum continues after the action, then settles into recovery or the next pose. Clip transitions avoid snaps and premature resets. Wind-driven scenery, moving bench parts, and landings receive this row where applicable. |
| A4 | Weight | Acceleration, balance, recoil, takeoff, and landing fit the body's size and material. Planted bodies bear weight. Flying bodies have believable lift and momentum. Uniform limb swings or weightless reversals fail this standard. |
| A5 | No foot sliding | Ground contacts stay planted relative to visible terrain during movement, turns, starts, stops, and transitions. Locomotion speed agrees with root travel. A still pose or a camera that hides the ground is insufficient evidence. |
| P1 | Telegraphs can be read | An unlabelled normal-speed encounter shows the attack's warning, direction or footprint, active moment, and recovery. The warning gives a visible opportunity to react and stays readable in day, dusk, and rain, including overlapping effects. |
| P2 | The boss mechanic is clear without text | The reviewer can describe the arena cue, attempted response, and visible consequence from the encounter alone. A failed attempt and a successful attempt demonstrate the causal difference. The review states what the reviewer inferred before any solution text is disclosed. |
| P3 | Controls respond | Synchronized real input and output show the requested action beginning, continuing, and ending without unexplained drops, accidental repeats, or camera obstruction. Deliberate charge, stamina, recovery, and cooldown restrictions have visible feedback. Real-time capture is required to assess response delay. |
| P4 | The HUD is legible | Uncropped gameplay views show readable health, stamina, level and XP, pet status and cooldown, boss bar, and lock-on marker where due. Menus, warnings, and feedback remain readable over each theme and during action. Critical information is not hidden by effects, camera framing, or overlapping text. |

For every scored row, cite the capture and frame range that supports the score. If a visible defect is absent, write `No material flaw observed in the supplied evidence` rather than claiming perfection. The item's worst-flaw field still identifies its weakest observed aspect. If evidence is missing, that field can identify the most consequential missing observation without inventing a visual flaw.

## Evidence package

The blind reviewer receives only this rubric and the captures with neutral capture metadata. It receives no source code, implementation notes, `design.md`, progress file, earlier scores, fix history, or builder's opinion. The rubric defines the targets. The evidence must show whether the build meets them.

Each package includes a neutral manifest with item IDs, item type, milestone, themes, camera views, resolution, viewport scale, motion setting, clip IDs, capture times, and file references. Record the build identifier, deterministic seed, fixed-clock setup, and frame intervals without embedding local machine paths. Distinguish game time from real capture time. These fields identify the evidence rather than explain the intended answer.

The keeper captures live in `docs/openworld/shots/`. Each round keeps its own evidence so later changes cannot silently replace the material that received a score. Use `lh shot` for stills and frame sequences. Extend the `lh` flows under `scripts/lh/` when a required capture is unavailable. Do not substitute one-off browser drivers.

| Subject | Required captures |
| --- | --- |
| Every new biome | Day, dusk, and rain wide views, a normal walking view, and a close view. Include the route into its border and its ambient motion sequence. |
| Every new landmark | Day, dusk, and rain views from its distant approach, its normal interaction distance, and its nearest accessible view. Include enough context to judge wayfinding. |
| Every new avatar, pet species, and boss | Day, dusk, and rain stills at normal gameplay distance and close range. Show front, side, and rear shapes, including required appearance variants that materially change the silhouette or palette. |
| Every new animation clip | A complete time-indexed frame sequence, including entry and exit transitions. Show the whole body and relevant ground contacts. Looping clips include at least two cycles. Non-looping clips include their start, complete action, and settled end. |
| Every boss attack and phase | A complete sequence of preparation, active frames, impact or miss, recovery, and return to play. Include each attack in both phases when its timing or behaviour changes. Show the phase transition, stagger, and defeat separately. |
| Each due control and mechanic | Real input/action sequences with visible results, failures, and recovery. The control coverage table below defines the minimum set. |
| Final M6 review | The whole game together, including all biomes, at least eight landmarks, every character, every pet species, all six bosses, animated benches, and the complete playable flow. |

Frame sequences carry timestamps and have enough frames to resolve the shortest anticipation, contact, and transition. Do not use a sparse contact sheet to infer smoothness. Supply consecutive frames around each contact and a timed normal-speed playback or equivalent sequence that preserves every captured frame and its interval. A contact sheet can index that evidence. It cannot replace it.

Animation sequences cover every new clip. Attacks and motion whose visibility changes with lighting, rain, terrain, or effects also need sequences in those conditions. A day-only attack sequence cannot pass P1 for rain. A still in each theme does not fill that gap.

The capture inventory lists every due item even when its evidence is absent. At final review, the inventory includes forest and meadow, lake and marsh, frozen highland, ember canyon, sky cliffs, and the observatory plateau. The six boss entries are Mossback Warden, Tidecaller, Rimehorn, Kiln Drake, Stormcrown Roc, and The Hourless. Future milestone placeholders cannot count as final coverage.

## Evidence for controls and mechanics

Each input sequence includes a synchronized event track of actual key-down, key-up, pointer, and button events. Show the starting view before input, the first visible response, the action, and the result after release. Keep the player, target, relevant terrain, and HUD visible. Report capture gaps rather than interpolating them away.

Input comes through the browser's real input pipeline. The existing test hook can set up position, level, gear, seed, and clock through `src/dev/test-hook.js`. It cannot stand in for the tested action by directly moving the player, awarding an item, damaging a boss, or declaring victory. An input overlay or timestamp track may identify the pressed button. It must not label a boss solution or tell the reviewer what to conclude.

Fixed-clock sequences establish action order, contacts, and repeatable outcomes. They do not establish real input latency or sustained frame rate. P3 requires a real-time run in addition to fixed-clock evidence. Missing timing, uncertain synchronization, or large capture gaps produce `NO` for response delay, not an assumed 8.

| Due content | Required input/action evidence |
| --- | --- |
| M1 movement and camera | Start and release walk and sprint, turn while moving, cross a slope and biome edge, jump and land, and approach camera obstacles. Include repeated starts and stops, stamina exhaustion and recovery, and climbing when present. Show the route from clearing to first vista. |
| M2 combat | Lock and unlock, all light combo steps, charged heavy input and release, dodge timing, perfect dodge and flurry, block, and parry. Include legal actions and attempts during stamina or recovery restrictions, then successful recovery. Show camera framing while player and boss move. |
| M3 progression and interaction | Interact with a node, show depletion and later availability, buy and equip gear, and show a denied purchase or unlock. Start a recipe, show its timed completion, claim it once, and inspect the result. Show level-up, healing, defeat and campfire recovery, and fast travel. Keep menu input and HUD changes visible. |
| M4 pet play | Show follow, attack target, recall, active skill, cooldown rejection and later success, knockout, and recovery for each species. Capture the pet's contribution in combat. Use neutral bond fixture IDs for comparative captures. Exact bond scaling and unchanged friendship remain technical checks. |
| M2 and M5 boss mechanics | For every boss as it becomes due, show each attack, half-health phase change, an unsuccessful response to the central mechanic, a successful response, the vulnerability consequence, and defeat. Preserve ordinary HUD text, but exclude tutorials, captions, and annotations that explain the solution. |
| M6 whole game | Show the playable flow from clearing to vista, purchase and equip, gather and craft, claim, level-up, and all six boss victories with the pet fighting. Include reduced-motion examples of critical warnings and feedback. |

The reviewer describes the inferred boss mechanic in its own words. If it cannot infer the mechanic, score the visible clarity honestly. If the capture omits the attempt or consequence, record `NO`. Static arena scenery, a boss health bar, or a single defeated pose cannot prove that the mechanic works or reads clearly.

Screenshots cannot prove Blender provenance, rig completeness, numerical damage, save compatibility, coin ownership, or unchanged friendship. Those requirements remain in asset checks, rule tests, and the milestone gates. The art score describes observed results, not presumed implementation. `lh perf` separately measures the real populated view after warm-up. Never infer 60 fps from a smooth-looking contact sheet.

## Review round and disposition

The builder runs `npm test`, `npm run guard`, `npm run verify:room`, and `npm run build` before capturing a milestone for review. The project uses Node 24 and Babylon.js 9.27.1. Animated bodies come from Blender-authored GLB clips. Capture setup uses the project's time and randomness pins.

A fresh reviewer scores each round without builder context or prior scores. If a reviewer cannot be spawned, the builder scores the evidence and marks the file `Self-scored`. Self-scoring is disclosed in the verdict. It is never described as independent or blind.

Save each round to `docs/openworld/reviews/<milestone>-round-<n>.md`. Fix failures from the lowest score upward. Recapture changed items and their affected context, then use a fresh reviewer for the next round. Keep unchanged item evidence identifiable. Do not let an improvement in one view erase a regression in another.

An item passes only when every applicable row across its required evidence scores at least 8, with all structural `N/A` reasons recorded. An item with `NO` is incomplete. A milestone passes when all due items pass, except for an explicitly recorded rule 7 weak point. A weak point keeps its failing scores and is not renamed a pass. After M6, one final round covers the complete inventory together.

Rule 7 of the brief applies exactly:

> If one item scores the same or lower for three rounds in a row, try a different approach to it once. If it still fails, record it in `progress.md` as a known weak point with its scores, and move on.

Compare the same item's lowest applicable score across rounds with equivalent coverage. Missing evidence is not a plateau score. The different approach needs a new capture and review round. Keep the three plateau scores, the changed approach, and the resulting score in the review history. The coordinator records the known weak point in `progress.md` if it still fails. Do not invoke rule 7 after fewer than three scored rounds or silently accept a failing item.

## Review file template

Replace placeholders with observed facts. Preserve every criterion row for every item. Add clip and condition rows where their results differ.

```markdown
# <milestone> review round <n>

Review mode is <Independent blind review | Self-scored | M0 preliminary>.
Build identifier is <identifier>. Evidence package is <relative path>.
The review covers <due items and explicit exclusions>.
Gate results are <coordinator-recorded result and evidence reference>.
Reviewer context is <only rubric and captures for independent review; disclose builder context for self-scoring>.
For independent review, the reviewer did not receive code, notes, progress, or previous scores.

## Coverage

| Item ID | Type | Due milestone | Day | Dusk | Rain | Clip sequences | Input sequences | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <ID> | <biome, landmark, character, boss, or bench> | <M#> | <files> | <files> | <files> | <files or justified N/A> | <files or justified N/A> | <none or concrete gap> |

## <Item ID>

| Criterion | Clip or condition | Score, NO, or N/A | Evidence frames and times | Observed defect or unscored reason |
| --- | --- | --- | --- | --- |
| L1 BotW air | <condition> | <entry> | <reference> | <finding> |
| L2 Originality | <condition> | <entry> | <reference> | <finding> |
| L3 Readable silhouettes | <condition> | <entry> | <reference> | <finding> |
| L4 Palette | <condition> | <entry> | <reference> | <finding> |
| L5 Detail up close | <condition> | <entry> | <reference> | <finding> |
| L6 Nothing that looks cheap or unfinished | <condition> | <entry> | <reference> | <finding> |
| A1 Anticipation | <clip and condition> | <entry> | <reference> | <finding> |
| A2 Readable hit frame | <clip and condition> | <entry> | <reference> | <finding> |
| A3 Follow-through | <clip and condition> | <entry> | <reference> | <finding> |
| A4 Weight | <clip and condition> | <entry> | <reference> | <finding> |
| A5 No foot sliding | <clip and condition> | <entry> | <reference> | <finding> |
| P1 Telegraphs can be read | <sequence and condition> | <entry> | <reference> | <finding> |
| P2 The boss mechanic is clear without text | <sequence> | <entry> | <reference> | <finding> |
| P3 Controls respond | <input sequence> | <entry> | <reference> | <finding> |
| P4 The HUD is legible | <sequence and condition> | <entry> | <reference> | <finding> |

The single worst flaw is <one concrete flaw or missing observation, with reference>.
The inferred boss mechanic is <reviewer's account, or justified N/A>.
The item score is <lowest numeric score, or incomplete because of NO>.
The item verdict is <Pass | Fail | Incomplete | Pending | Infrastructure checkpoint only>.

## Round disposition

| Item | Lowest score | Unresolved NO entries | Verdict | Single worst flaw | Next required evidence or correction |
| --- | --- | --- | --- | --- | --- |
| <ID> | <score or incomplete> | <IDs or none> | <verdict> | <flaw> | <action> |

The milestone verdict is <pass, fail, incomplete, or M0 infrastructure checkpoint only>.
The coordinator adds comparison history only after the blind scores are final.

| Item | Three consecutive round scores | Different approach | Follow-up round and score | Known weak point record |
| --- | --- | --- | --- | --- |
| <ID or none> | <round IDs and scores> | <concrete change> | <round and score> | <progress.md reference or not invoked> |
```
