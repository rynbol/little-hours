# Wilds UI study

Phase 1 only. No HUD, input, camera, model, combat rule, or production style has changed. Goal 3 rules remain accepted at `312330c`. The owner chooses a direction before Phase 2 begins.

All mock pages, screenshots, reference images, judge answers, and browser measurements live in the sibling `wilds-assets/ui-research/` directory. They are deliberately outside Git. Open `mocks/index.html` through `node scripts/lh/ui-preview.mjs` to compare the directions.

## Decision and scope

The decision is the interface layout, density, and visual treatment over the existing game. Improving the character, Warden, pet, lighting, and camera is outside this study. The mocks use actual game captures, including their current visual limitations.

The owner supplied no `ui-reference/` directory. The four existing look stills in `docs/openworld/reference/` inform the soft greens, warm light, and quiet mood. They are earlier unapproved targets, not approved UI designs. No game's icons, fonts, symbols, or exact layout are copied.

The UI brief defers to `RULES.md`. Work therefore stays on `codex/wilds`, despite the brief's different branch name. Judges run fresh, blind, and one at a time, for at most four rounds per direction. This cannot establish the brief's incompatible nine-of-ten threshold. The results below report the actual sample and the per-picture checklist required by `RULES.md`.

The pstack Prototype playbook governs the study. Experience First led to smaller persistent HUDs, explicit phone layouts, and health labels that do not depend on colour alone. Exhaust the Design Space led to three different arrangements and menu structures. The mock state is a named screen, light, viewport, and direction over a recorded game state. Building and research stay local because `RULES.md` permits only blind picture judges as subagents.

## Existing interface

The source HUD is `src/features/wilds/hud.js`. Its styles are `src/features/wilds/wilds.css`. The check page owns entry and exit controls in `checks/wilds.html`.

| Element | State source | Existing behaviour |
| --- | --- | --- |
| Location and The Wilds label | `world.location` | Always visible at top left. |
| Level and experience | `wildsStats(combat.progress.totalXp)` | Always visible in the player panel, including during combat. |
| Health | `player.health`, `player.maxHealth` | Number and horizontal meter. |
| Stamina | `player.stamina`, `player.maxStamina` | Number and meter; exhausted colour below one. |
| Companion name | Provided name, then `petEntry(combat.pet.id)` | Name and numeric health in bottom-right panel. |
| Companion health | `combat.pet.health`, `maxHealth` | Horizontal meter. |
| Skill availability | `skillReadyAt`, `skillQueued`, `mode`, `recoverAt`, `elapsedMs` | Ready, closing in, cooldown, or resting countdown. |
| Boss name and health | `combat.boss.name`, `health`, `maxHealth`, `engaged`, `mode` | Visible while engaged and not defeated. |
| Boss hint and phase | Boss mode, move, phase, and `combat.targetId` | Exposed, roots, charge advice, or lock state. |
| Lock marker | `combat.targetId`, projected `targetScreen` | Diamond at the visible target's screen position. |
| Notices | Current boss-defeated, level-up, player-defeated events | A central notice lasts 5.5 seconds. Reward copy includes XP, materials, trophy, and promotion. |
| Keyboard help | Static HUD text | Two persistent lines of movement and combat bindings. |
| Enter and Leave | Mount/dispose state in the check page | Two top-right buttons. Enter is disabled while the view is mounted. |
| Loading and failure | View ready/failure state in the check page | Bottom-left status text. |

The survey uses real keys and pointer input, including entry, walking to the arena, pet combat, taking damage, automatic recovery, another walk, victory, and leaving. It never places actors, damages them through a test hook, or freezes the running clock. `ui-survey.mjs` records twelve states at both 1280×800 and 390×844, in day, dusk, and rain. All six runs captured all twelve states and reported no browser exceptions. These are UI state captures, not new combat acceptance batches.

Artifacts are `before/<viewport>-<light>/<state>.png`, corresponding `states.json` and `result.json`, and `before-contact-sheet.jpg`. Clean background captures hide only DOM overlays. They do not replace or retouch game models.

The current phone view overlaps the location with Enter/Leave. Keyboard bindings occupy the bottom of the phone but supply no touch input. The player panel occupies considerable space beside the companion. Current death immediately restores the player and companion at camp; there is no pending death state or retry button. Phone-sized automated input is not evidence that the game is playable on a phone.

## Missing menus and integration boundaries

All of these are design mocks, not implemented systems.

| Screen | Proposed use | Data or behaviour still needed |
| --- | --- | --- |
| Pause | Resume, controls, companion, map, gear, leave | A pause contract must stop simulation, timers, and input consistently. Opening a DOM panel alone cannot promise pause. |
| Map | Camp, Warden clearing, and current trail position | World-to-map projection, discovery state, and navigation rules. The mock map is schematic. |
| Gear | Current sword, materials, progression | An equipment collection and selection contract. The existing materials and XP can be displayed read-only. |
| Pet party | Current Miso status and future empty slots | A party roster, slot limit, selection rules, and persistence. Empty slots illustrate layout, not a promised party size. |
| Boss title | Brief edge title on first approach | Encounter entry event already exists; show-once and repeat rules need an owner choice. |
| Rewards | XP, heartwood, trophy, promotion after the fight | Existing reward event supplies the core data. Opening a panel must not duplicate or grant rewards. |
| Defeat/recovery | Calm confirmation at camp | Automatic return already happens. The mock's Back to the trail dismisses a panel; it does not add a second respawn. |
| Enter/leave | One clear entry and an exit confirmation | The check page has lifecycle functions; production navigation and focus restoration need integration. |
| Phone controls | Move, look, strike, dodge, jump, lock, pet skill | Touch input, recall placement, simultaneous gestures, and safe-area handling need a separate input owner. `input.js` remains protected. |

These dependencies are not requests to change combat rules. Phase 2 must consume existing data where possible and document missing contracts before adding behaviour. Map, gear, and party management wait for their systems, as the brief requires.

## Reference study

Ten interface studies informed the directions. Each claim below describes an inspected image, not an inferred animation or untested gameplay behaviour. Source URLs and publisher screenshot URLs are saved beside the images in `reference-games/<slug>/source.json`. These images are research material only.

| Game and source | Inspected local image | Specific idea to learn |
| --- | --- | --- |
| [A Short Hike](https://store.steampowered.com/app/1055540/) | `short-hike/3.jpg` | A compact cream speech bubble carries one brief message above the scene. Keep incidental notices short. |
| [Lil Gator Game](https://store.steampowered.com/app/1586800/) | `lil-gator/1.jpg` | The open notebook gives the selected item a separate description page. Keep list navigation apart from detail reading. |
| [Ooblets](https://store.steampowered.com/app/593150/) | `ooblets/5.jpg` | A prominent action card is visually distinct from the creature lineup. Give a momentary action one clear focal point without turning the whole HUD into decoration. |
| [Fae Farm](https://store.steampowered.com/app/2230110/) | `fae-farm/4.jpg` | Status bars sit at the corner while the nearby interaction gets its own compact prompt. Separate enduring status from immediate action. |
| [Spiritfarer](https://store.steampowered.com/app/972660/) | `spiritfarer/1.jpg` | A narrow build panel groups tabs, choices, and requirements while the boat stays visible beside it. Use a side menu where the world remains useful context. |
| [Jusant](https://store.steampowered.com/app/1977170/) | `jusant/7.jpg` | A small curved resource indicator sits near the climber. Use very little ornament for moment-to-moment status; do not obscure the character with it in our crowded fight. |
| [Palia](https://store.steampowered.com/app/2707930/) | `palia/4.jpg` | Selection instructions collect along the bottom edge of the overhead view. Keep instructions in a predictable place and limit them to the active context. |
| [Alba: A Wildlife Adventure](https://store.steampowered.com/app/1337010/) | `alba/3.jpg` | The identification state has a short yellow label inside the camera view. A single action state can be readable without a large information panel. |
| [Stardew Valley](https://store.steampowered.com/app/413150/) | `stardew/7.jpg` | The portrait and name have a reserved space beside dialogue. Companion identity deserves a stable place rather than another line of status text. |
| [Sable, early UI exploration by Cedre Pradier](https://cedrepradier.com/work/sable) | `sable/early-interface.png` | The selected item's details occupy a separate column, and generous empty space keeps categories legible. This is the designer's early exploration, explicitly not the shipped interface. |

Sky, Dinkum, and Slime Rancher 2 publisher galleries were inspected too. Their downloaded shots mostly hide interface elements, so they do not count toward the ten UI studies. The Sable store shots also hide the interface; its designer's documented early concepts provide the actual UI evidence.

## Direction 1: Mosslight

Compact dark-green panels sit at opposite edges, with a small companion badge and a warm boss meter. Menus open from the right, leaving the trail visible beside them on laptop.

The player and pet remain separate, which makes ownership clear at a glance. The cost is a longer eye movement between them. On phone health and stamina share one slim header, while the pet sits above the left thumb zone. The boss plate omits the redundant lock caption; phase-two warnings remain visible. The persistent experience meter moves into gear/progress so combat status has less competition.

| Token | Value |
| --- | --- |
| Panel / text / subdued text | `#163a35f2` / `#fffbed` / `#d3ddd4` |
| Health / stamina / accent | `#f5bca6` / `#c3da9c` / `#e4d7a6` |
| Type | System rounded sans; 14 px status, 13 px readiness, 18 px boss, 28 px menus, 42 px entry |
| Phone type | 12 px health and stamina labels, 14 px pet, 16 px boss |
| Spacing | 4 px base; 12–16 px panel insets; 28 px laptop edge, 16 px phone edge |
| Corners | 18 px panels, 14 px phone panels, 24–28 px menus |
| Proposed motion | 160 ms opacity on appearance; 280 ms fade after four seconds without a relevant change; no fade for low health, enemy engagement, queued skill, or resting pet. Reduced motion changes opacity immediately. |

Mock: `mocks/mosslight.html`. The static exploring screen illustrates the quieter settled state; it does not run or validate these transitions.

## Direction 2: Fieldnotes

A pale status panel puts player and companion together, with restrained serif titles and straight edges. Its menus use a left-side notebook layout with a clear selection row and separate detail area.

Grouping the two health meters reduces the distance needed to compare them. The light panel is more visually present over grass and rain, and its larger menu is the least unobtrusive direction. On phone the status becomes one horizontal group. This direction is for an owner who prefers a tangible notebook feel over a floating HUD.

| Token | Value |
| --- | --- |
| Panel / text / subdued text | `#f6f0df` / `#283a35` / `#59675c` |
| Health / stamina / selection / boss | `#ad5947` / `#5a784e` / `#405c4a` / `#7b8d4d` |
| Type | System sans for controls; Georgia for titles. 14 px status, 13 px readiness, 19 px boss, 34 px menu headings |
| Phone type | 12 px health labels, 14 px pet, 18 px boss, 31 px menu headings |
| Spacing | 4 px base; 15–16 px status insets; 30 px laptop edge, 16 px phone edge |
| Corners | 8 px status and boss panels; 3–5 px notebook menus; fine separators and a 4 px edge rule |
| Proposed motion | 120 ms opacity for notices; 180 ms menu appearance with no page-flip effect; hide secondary labels after five idle seconds. Restore immediately on damage or a state change. Reduced motion uses no transition. |

Mock: `mocks/fieldnotes.html`.

## Direction 3: Tideglass

A single slim dock joins player and companion beneath the laptop scene, with cool blue panels and restrained rounded controls. Menus open as a centred island, while phone status becomes a compact header.

The dock makes related status easy to scan in one place and frees both lower corners. The boss meter moves to the upper right on laptop, which separates it from the player dock but can require a larger glance. The cool palette is clearest against green foliage; it also feels less earthy than the other directions. On phone the redundant lock caption is omitted and phase-two warnings remain visible.

| Token | Value |
| --- | --- |
| Panel / text / subdued text | `#182d43f5` / `#f1f6fc` / `#bdcad8` |
| Health / stamina / accent | `#f0b7aa` / `#a8c8e8` / `#c6dbe9` |
| Type | System rounded sans. 14 px status, 13 px readiness, 18 px boss, 28 px menu headings |
| Phone type | 12 px health labels, 14 px pet, 16 px boss |
| Spacing | 4 px base; 12–20 px dock insets; 28 px laptop edge, 16 px phone edge |
| Corners | Capsule dock, 16–18 px boss panel, 30–32 px menus |
| Proposed motion | 140 ms opacity on appearance; 240 ms fade to the compact explore state after four idle seconds; state changes restore the full dock immediately. Critical status never fades. Reduced motion uses no transition. |

Mock: `mocks/tideglass.html`.

## Verification and limits

`node scripts/lh/ui-review.mjs` renders all three directions, fifteen screens, both viewports, and all three lights. It records layout bounds, intersecting UI regions, text clipping, horizontal overflow, phone buttons smaller than 44 px, browser exceptions, and running animations with reduced motion enabled. Screenshots still need visual inspection; a geometry check alone cannot prove readability or an unobstructed fight.

The final render passes all 270 layouts. `layout-review.json` holds the complete measurements; `shots/<direction>/` contains the renders and 2× crops of the player, companion, and boss panels. In-app browser checks verified menu navigation, Resume, and the comparison studio's screen selector following navigation inside its preview.

Existing-game gates pass: 908 unit tests, guard with no problems, the room harness, the production build, and 36/36 checks in the default Wilds flow. Doctor reports the Metal GPU and no browser errors. Logs live in `gates/`. The room harness's NullEngine skeleton warning and the build's chunk-size warning remain; neither is a new failure.

The required fight performance comparison ran two alternating rounds per side against `codex/wilds` at `312330c`. Median rendering stayed at 60.0 frames/s on both sides; animation callbacks were 59.9 versus 60.0/s. The p95 frame gap was 16.7 versus 16.8 ms, the maximum was 16.8 ms on both sides, and there were no gaps over 20 ms or page errors. Idle work differed by 2.74 ms/s, within the harness's 10 ms/s noise allowance. Game code is identical on both sides: these measurements establish no observed regression in the existing game, not a speed improvement or the cost of a future integrated HUD. Raw data is `gates/perf.json`.

The fight mock uses data from the selected survey state. Locked screenshots show full health because that is the captured moment. Low health, pet resting, and phase two are separate previews. Their background remains the locked capture for visual comparison, so those extra states demonstrate UI treatment rather than a synchronized replay.

The blind baseline uses the existing HUD function and CSS over the exact same clean background as the candidate. It preserves the recorded status, target position, original controls, and entry/exit buttons. This avoids judging a difference in wind, actor pose, or camera timing between consecutive captures. Original unmodified before captures remain available separately.

Pause and party have no current equivalents, so judges assess those candidate screens against the brief, not an invented old menu. Static pictures cannot prove animation, live hit readability, phone input, pause semantics, performance after integration, or accessible screen-reader updates. Those remain Phase 2 work and owner play checks.

## Judge results

Every judge was a fresh Astra agent at extra-high effort with only the mood picture and an opaque folder of shuffled A/B pictures. Each inspected fifteen pairs (five screens × three lights, with both viewports) and six full-size laptop fight images. Candidate labels, round numbers, and direction identities were withheld. Original answers are preserved in `judge-log/<direction>/round-<n>.md`; `judge-mapping.json` records the unblinding. Unused prepared folders are not counted as reviews.

The five checklist lines are hierarchy, fight-status legibility, phone-status legibility, soft/cute/cool fit, and UI leaving active actors clear. A pass requires all five Yes in all three lights and preference for the candidate in every pair. Menus may cover the world. The baseline contains no equivalent pause or party menus: those six preferences per round judge the proposed presentation against the brief, not matched implemented features. Fifteen pictures are not fifteen independent judges.

Mosslight's third and Fieldnotes' second judges interpreted actor clearance as the entire scene, including a tree trunk shared by both sides. Their No answers remain in the raw results and pass counts. Later prompts explicitly separated UI coverage from shared scenery, consistent with this UI-only scope. The trunk obstruction, rough player silhouette, and weak rainy-scene separation remain unresolved; none is hidden by a HUD pass.

Score order below is cleanliness / fight readability / phone readability / cute-cool feel / low coverage. Earlier rounds used earlier mock versions, so their averages describe the iteration history rather than repeated evaluations of the final design.

| Direction | Final round | Final preference | Final scores | Fully Yes rounds across iterations | Average scores across iterations |
| --- | --- | --- | --- | --- | --- |
| Mosslight | 4 | 15/15 | 4 / 4 / 4 / 4 / 4 | 2/4 (rounds 2 and 4) | 4.00 / 3.75 / 4.00 / 4.00 / 3.75 |
| Fieldnotes | 4 | 15/15 | 4 / 4 / 4 / 4 / 4 | 1/4 (round 4) | 4.00 / 3.75 / 4.00 / 3.75 / 3.75 |
| Tideglass | 1 | 15/15 | 4 / 5 / 5 / 4 / 4 | 1/1 | 4.00 / 5.00 / 5.00 / 4.00 / 4.00 |

Mosslight's changes addressed small laptop text, a bulky phone header, and ambiguous lock/phase wording. The fourth judge's remaining criticism was the thin laptop stamina track; this remains a refinement for the chosen direction rather than a reason to exceed the four-round cap. Static clearance says nothing about a moving boss or a telegraph that is absent from these frames.

Fieldnotes gained a shorter phone boss card, stronger boss-bar contrast, softer HUD corners, and complete removal of hidden status plates under menus. Its third judge reported a missing phone Stamina label. The exact native phone image visibly contains that label; the report is preserved as a failed round, and the fourth fresh judge inspected every native phone fight image and confirmed readable health/stamina labels in all three lights. No copy was changed to fix a label that was already present. The final judge's main concern was the visual weight of the cream phone panels, especially in rain. It also noted inconsistent companion-health colour between the active HUD and companion page; token consistency remains a refinement for implementation.

Tideglass passed its first review. Its judge gave the strongest status-readability scores in this small sample, while describing the two broad phone header blocks as heavy and more like application cards than a painterly game interface. There are too few independent judges, and too many version differences, to treat score differences between directions as a reliable ranking.

All three final versions pass the UI checklist in every light and are preferred in all fifteen supplied pairs. Nine fresh judges were used in total: four for Mosslight, four for Fieldnotes, and one for Tideglass. None is an owner acceptance or a certification of live gameplay. No direction remains blocked on the final static UI checklist; the limitations and remaining criticisms above still apply.

Recommendation: Mosslight. Its slimmer phone header and quiet warm-green panels leave more room for the forest while keeping companion identity separate. Choose Fieldnotes for a more tangible notebook treatment and grouped status, or Tideglass for a cool palette and unified dock. This is a design recommendation, not owner approval, a nine-of-ten result, or acceptance of the game's current 3D presentation.

## Owner checkpoint

Local comparison studio: `http://127.0.0.1:53972/mocks/index.html`. Switch direction, screen, light, and laptop/phone size. Menu buttons navigate static mock screens; combat and movement controls do not drive a game. `contact-sheet.jpg` compares the before and all three directions in every light. Each `<direction>-states.jpg` shows exploring, defeat, pause, and companion screens. `before-contact-sheet.jpg` covers the original survey.

Playable existing game: `http://127.0.0.1:58702/checks/wilds.html`. It enters automatically. Click the world to focus, use WASD to follow the path to the visible Warden, and press Tab nearby to lock on. Click/F strikes, Ctrl dodges, Q uses the pet skill, and R recalls the pet. The game still uses its current HUD; the three directions have not been integrated. The page loaded successfully in the in-app browser. Headless browser cleanup completed before starting this handoff server; the earlier owner preview was left alone.

Three things for the owner to compare:

1. Find health, stamina, and Miso's status quickly in the fight preview, especially on phone.
2. Compare the visible space around the player and boss in all three lights. The shared trunk obstruction and rough actor models remain outside this UI scope.
3. Open Pause and Companion, then decide which layout and visual treatment belong in the game.

Owner response at this checkpoint: not received. No direction is approved. Stop here for the owner's pick and manual game check; Phase 2 must not start automatically. Touch input, real pause, live transitions, screen-reader announcements, and moving-actor/telegraph clearance remain unimplemented or unverified.
