# The Wilds design

## Purpose and research

A short break becomes a walk toward a distant shape, a useful discovery, or one readable boss attempt. The world stays continuous and inviting. Combat rewards observation without risking study earnings or friendship. This document specifies the target build. `progress.md` distinguishes implemented behavior from planned behavior.

Nintendo's [Explorer's Guide](https://media.nintendo.com/zelda/breath-of-the-wild/assets/ExplorersGuide.pdf) describes lock-on evasions, last-moment perfect dodges opening a flurry rush, charged attacks consuming stamina, and vulnerability while charging. Its broader exploration loop ties visible destinations to supplies, routes, and discoveries. Sprint and climb draw from the same stamina resource, making route choice matter. Different weapon reach and speed change safe attack windows. Research checked the downloaded PDF text, printed pages 15–18 and 35–36. The web reader timed out, but direct retrieval succeeded.

[Nintendo's GDC presentation](https://www.gdcvault.com/play/1024562/Change-and-Constant-Breaking-Conventions-with-The-Legend-of-Zelda-Breath-of-the-Wild) identifies the developers and the open-air design and art process discussed in their session. The session page was indexed, but the full recording was not reviewed. Our visual interpretation uses a soft cel ramp, warm rim light, blue-grey distance layers, lifted shadows, wind in grass, and large legible silhouettes. These are our rendering choices, not claims about Nintendo's proprietary shader implementation. Boss lessons become arena interactions taught safely before the dangerous version.

[Pocketpair's game description](https://store.steampowered.com/app/1623730/Palworld/) establishes companion combat, traversal, resource production, and construction. The [partner skill catalog](https://www.palworld-db.com/partner-skills) records species-specific partner functions, many unlocked through crafted equipment. The [technology reference](https://palworld.wiki.gg/wiki/Technology) describes level-based crafting unlocks. The [command guide](https://www.gameskinny.com/tips/palworld-how-to-control-pals-in-your-party/) distinguishes aggressive attack, following the player's target, and withholding attacks. These sources motivate a much smaller system here: one existing companion, attack/recall/skill commands, level unlocks, gathering, and short timed bench recipes.

Take landmark-led exploration, timing-based defense, recognizable companion roles, and satisfying preparation. Leave out weapon breakage, creature capture, hunger, labour automation, permanent pet loss, randomized loot rolls, and long craft timers. Keep existing pet names, ownership, appearance, and friendship. No borrowed creatures, outfits, glyphs, architecture, or interface shapes.

## Runtime and ownership

The entry is `enterWilds(container, state)`. It returns lifecycle and diagnostics methods. An HTML check page supplies an isolated save under `little-hours-wilds-check-v1`. It never overwrites `little-hours-v1`. The production entry accepts the caller's current snapshot. Its controller exposes `bindPersistence({ transact })` and `syncState(nextState)`. Durable commands stay unavailable until a persistence adapter is bound. Every purchase validates and deducts coins inside a transaction on the latest state, then synchronizes the returned snapshot; it never spends from the entry snapshot after a store update.

The durable data shape is one normalized `state.wilds` record: version, total XP, inventory counts, owned gear, equipment IDs, discovered landmarks, lit campfires, current checkpoint, gathered-node ready times, crafting jobs with captured output/target gear IDs, per-item upgrade counts, boss victories, trophies, and position. Transient encounter data holds player action, action start time, health, stamina, velocity, target, pet command/cooldown/health, and a boss state machine. Combat states are idle, telegraph, active, recovery, stagger, phase-change, and defeated. Rules accept an explicit clock value or delta and return results/events. Babylon never enters `src/core/wilds/`.

Two candidate architectures were considered. A Babylon scene owning combat via mesh callbacks would be short initially but make fixed-clock tests and save restoration depend on mesh state. A pure rules layer plus a rendering adapter keeps literal rule tests independent of GPU timing. Use the second. Do not build a generic ECS or an event framework.

`src/features/wilds/` owns input, camera, HUD, menus, and scene lifecycle. `src/models/wilds/` loads Blender assets and extends the shared outdoor layers. Existing `heightAt`, terrain rings, paint, tree/grass geometry, water, clouds, sky, landmarks, and atmosphere remain shared. No copies. Any required extension preserves default behavior and adds regression coverage.

In M3, `freshState()` and `restoreState()` receive minimal tested `normalizeWilds` integration. The existing backup format stays unchanged. The standalone page binds a store using its own storage key. Later island wiring binds transactions to the existing shared store lock and `store.update((draft, { now }) => applyWildsCommand(draft, command, now))`, then calls the app update handler and `syncState`. A raw snapshot is never treated as the live store. Coin tests cover a study credit arriving between entry and a purchase.

All test globals stay in `src/dev/test-hook.js`. The standalone HTML may import the existing installer directly; no new game module imports it. This narrow check-page exception reconciles the brief's standalone entry with the existing main-only game import rule. The test API sets fixture position, level, gear, and clock. Flows perform gameplay through actual keys and clicks, never through a win/award/damage shortcut.

## World and art

The walkable map spans at least 1,800 metres across. At 4.8 m/s, a straight crossing takes 6.25 minutes before stops or slopes. Routes connect without scene transitions. Use the actual rendered terrain triangles for collision and slope limits. Raw `heightAt()` generates vertices; it is not the collision height. Climbable rock faces permit slow stamina-based ascent, while paths reach every required arena without climbing. Invisible edge walls are avoided; steep ridges and deep water bound the playable region.

| Region | Palette, flora, props, weather, motion | Landmarks |
| --- | --- | --- |
| Forest and meadow | Sage, honey, warm bark; broadleaf groves, fern fans, meadow tufts; sun shafts, drifting seeds | Hearth clearing, Bellroot Gate, Mossback's standing-stone crown |
| Lake and marsh | Teal, indigo, pale reeds; reed beds, willow fringes, water lilies; low mist, ripples | Mirror Fen, Tidecaller's hollow reed spire |
| Frozen highland | Powder blue, cream, violet shade; low conifers, frost tufts, ice fans; drifting snow | Rimehorn's split glacier, Lantern Steps |
| Ember canyon | Terracotta, charcoal, apricot; hardy thorn bushes, glassy basalt; ember drift, heat shimmer | Kiln Drake's open furnace arch |
| Sky cliffs | Chalk, lavender, cloud blue; wind grass, feather stones; gust ribbons | Stormcrown's ring of floating islets, Threadwind Bridge |
| Observatory plateau | Faded copper, moonstone, old turquoise; sparse silver grass; clock-dust motes | Hourless's broken astrolabe |

Shared terrain generation and workers accept a serializable world definition with region weights, paths, water bodies, placement rules, and landmarks. Existing defaults preserve room coordinates and behavior. Extend `buildTerrainRings({ definition, rings, center, workers })` so Wilds can move its fine rings on a common snapped grid, replacing complete ring sets asynchronously. A pure `sampleTerrainSurface(ringData, x, z)` interpolates the actual final vertex positions and triangle winding, including stitched edges and translated origins. Player grounding and grass/water sampling use that same surface. Shared tree vista restrictions, shader river/path functions, and landmark placement accept Wilds data instead of forking geometry or shaders. Regression tests preserve current default output.

Each border interpolates terrain paint and prop density over at least 80 metres. Keep a landmark visible above the canopy at the forest exit. Reveal the lake, snow ridge, ember arch, sky islets, and observatory in the first vista. Boss arenas remain identifiable from their approach, not just their map icons.

Day has pale blue air, cream sunlight, and broad warm highlights. Dusk has peach horizons and mauve shade. Rain lowers saturation and contrast, adds fine rain streaks and water rings, and keeps telegraphs readable. Each region has a distinctive ambient motion with a reduced-motion static equivalent. World scenery uses merged static meshes and thin instances. Do not animate character bones or body parts in JavaScript.

## Controls and movement

WASD moves relative to the camera. Mouse drag or pointer lock turns it. Shift sprints. Space jumps or climbs a climbable face. Ctrl dodges. Left click attacks, holding it for at least 600 ms charges a heavy attack. Right click blocks; its first 180 ms parries. Tab locks the nearest visible boss within 70 m. E interacts. R recalls the pet, T sends it to the target, Q uses its skill. H drinks a tonic. I opens inventory/equipment, M opens the map, Escape closes menus and releases pointer lock. Native buttons expose all menu actions.

Walk 4.8 m/s, sprint 8.5 m/s, climb 2 m/s. Jump starts at 7 m/s with gravity 20 m/s². Dodge lasts 500 ms, moves 4.5 m, costs 24 stamina, and grants invulnerability at 80–340 ms. An attack overlapping 80–180 ms of a dodge opens a 1,200 ms flurry window. Flurry attacks recover 40% faster. Sprint costs 14 stamina/s and climbing costs 20/s. Stamina recovers 22/s after 600 ms without spending. Block reduces incoming damage 70% at a cost of 15 stamina per hit. A parry staggers eligible strikes for 1,500 ms. Repeated input cannot restart an active attack or dodge. Falling returns to safe ground with bounded health loss.

Camera distance 6.5 m, shoulder height 2.2 m, pitch clamped to a usable range; terrain pulls it forward before it clips. Lock-on frames both combatants. Defeat fades to the last campfire, restores both health pools, resets the encounter, and loses no coins, XP, materials, equipment, or friendship.

## Progression numbers

Level starts at 1 and caps at 20. XP needed from level L to L+1 is `100 + 40 * (L - 1)`. Total XP thresholds are cumulative, never recalculated from a rounded level. Maximum health is `100 + 12 * (L - 1)`, stamina is `100 + 4 * (L - 1)`, and attack is `10 + 2 * (L - 1)`. A level-up restores the gained maximum health/stamina and shows a short gold pulse plus the new level. Landmark discovery gives 35 XP once; gathering gives 4 XP per collected node. Repeated boss victories give 25% XP with the same material, but only one trophy.

Damage is `max(1, round((attack + weaponPower) * moveMultiplier * vulnerability - armour))`. Armour cannot reduce a hit below 1. Friendly fire is disabled. Sword light combo multipliers are 1, 1.1, 1.4 with 420/460/620 ms duration. Spear uses 1, 1.2, 1.5 with 520/560/680 ms. Hammer uses 1.3, 1.5, 1.9 with 720/780/940 ms. Heavy multipliers are 2.4, 2.6, and 3.3. Sword light hit times are 180/200/300 ms, spear 240/260/340 ms, and hammer 360/400/500 ms. Charged-release durations are 900/1050/1400 ms and hit times are 360/440/620 ms for sword/spear/hammer. Charge hold precedes that release clip. Blender export writes these timings and clip lengths to an asset manifest; combat reads the same contract and tests the GLB duration against it. Each hit has one damage frame, independent of rendering rate. Heavy costs 28 stamina, light costs 6. Boss vulnerability is normally 1 and 1.8 while exposed. Bow is an optional extension after all required gates, not a substitute for spear timing.

| Weapon | Class | Unlock level | Gold | Power | Reach m |
| --- | --- | ---: | ---: | ---: | ---: |
| Practice blade | Sword | 1 | 0, initially owned | 0 | 2.6 |
| Copperleaf blade | Sword | 1 | 40 | 5 | 2.6 |
| Reedpoint | Spear | 1 | 45 | 4 | 4.5 |
| Quarry mallet | Hammer | 2 | 55 | 9 | 2.9 |
| Wayfarer blade | Sword | 5 | 120 | 14 | 2.8 |
| Iceglass lance | Spear | 6 | 135 | 13 | 4.8 |
| Ember maul | Hammer | 7 | 150 | 21 | 3.1 |
| Sundial edge | Sword | 11 | 240 | 26 | 3.0 |
| Cloudpiercer | Spear | 12 | 260 | 25 | 5.0 |
| Bellfounder's hammer | Hammer | 13 | 280 | 35 | 3.3 |
| Heartwood blade | Sword, crafted | 3 | unavailable | 12 | 2.8 |
| Pendulum maul | Hammer, crafted | 15 | unavailable | 44 | 3.4 |

| Armour | Unlock level | Gold | Defence | Extra |
| --- | ---: | ---: | ---: | --- |
| Travelling clothes | 1 | initially owned | 0 | Existing avatar appearance |
| Quilted trailwear | 2 | 45 | 3 | None |
| Reedguard coat | 5 | 110 | 7 | None |
| Summit mantle | 8 | 170 | 11 | Cold gain reduced 50% |
| Skywoven jacket | 12 | 250 | 16 | None |
| Rimeheart coat, crafted | 6 | unavailable | 10 | Cold gain reduced 75% |

Purchases require level, sufficient coins, and not already owned. Equip requires ownership and level. All coin changes are deductions. No boss or gathering rule credits coins.

## Gathering, benches, and campfires

Wood, stone, ore, fibre, ice crystal, ember shard, and feathers yield 2 units per node. Each node has a stable ID and becomes available 90,000 ms after collection. Gathering requires E within 2.5 m. Depleted nodes visibly change. Each camp has a shop, workbench, forge, and alchemy pot. Extra benches near arenas reduce return walks. Crafting requires the matching bench within 3 m, level, and ingredients. Ingredients are consumed when a job starts; ready outputs are claimed once. Upgrade jobs capture the equipped gear ID at start and apply only to that ID on claim, even after equipment changes. Per-item upgrade counts enforce caps across reloads. Jobs use `clockNow()` and survive reloads.

| Recipe | Bench | Level | Ingredients | Seconds | Output |
| --- | --- | ---: | --- | ---: | --- |
| Field tonic | Alchemy | 1 | fibre 3, wood 1 | 3 | tonic 1, heals 50 HP |
| Stamina tea | Alchemy | 2 | fibre 4, ice crystal 1 | 4 | tea 1, restores 60 stamina |
| Warming brew | Alchemy | 4 | fibre 2, ember shard 2 | 4 | brew 1, cold protection 60 s |
| Heartwood blade | Workbench | 3 | wood 8, stone 4, heartwood 1 | 6 | weapon 1 |
| Rimeheart coat | Workbench | 6 | fibre 10, ice crystal 6, rime plate 1 | 8 | armour 1 |
| Honing stone | Forge | 3 | stone 6, ore 4 | 5 | equipped weapon upgrade +2 power, maximum 3 |
| Shoal charm | Workbench | 4 | fibre 6, tide pearl 1 | 6 | pet max HP +10 while equipped |
| Furnace temper | Forge | 9 | ore 8, ember shard 6, kiln core 1 | 8 | equipped weapon upgrade +4 power, maximum 2 |
| Cloud stitch | Workbench | 12 | fibre 8, feather 6, storm quill 1 | 8 | armour defence +3, maximum 2 |
| Pendulum maul | Forge | 15 | ore 12, hourglass gear 1, heartwood 1 | 10 | weapon 1 |

There is one campfire per region. Lighting one heals player/pet, clears cold, records the checkpoint, and unlocks it on the map. Fast travel works between lit campfires outside combat. It restores health and does not advance friendship or earn coins.

## Pet combat

Use the existing `state.pet` species and read `bondLevel(state.petBonds[id]).index`, B in 0..3. Never mutate bonds. Pet health is `round(baseHP * (1 + .15 * B))`, damage is `round(baseDamage * (1 + .2 * B))`, cooldown is `baseCooldown * (1 - .08 * B)`. A pet follows 2–4 m behind, approaches the locked or commanded boss, attacks within species reach, and returns on R. Q requires a living pet, a valid target for offensive skills, and a ready cooldown. Knockout lasts 30 s or ends at a campfire, restoring full pet health. Boss victory does not change affection. Every species generates threat through ordinary attacks. Tidecaller follows the attacking pet for at least 4 seconds before reconsidering targets, so an attack command followed by recall can lure it across a shoal. Dog's forced taunt is a more reliable version of the same accessible mechanic.

| Species | Role | Base HP | Hit damage / interval ms | Active / base cooldown | Passive |
| --- | --- | ---: | --- | --- | --- |
| cat | Striker | 70 | 7 / 1100 | Pounce, 24 damage and 800 ms stagger / 14000 ms | +10% damage against exposed targets |
| dog | Guardian | 110 | 5 / 1400 | Rally bark, taunt 5000 ms and absorb 25 damage / 18000 ms | Player takes 8% less damage within 6 m |
| bunny | Support | 65 | 4 / 1200 | Clover pulse, heal player 30 and pet 20 / 20000 ms | Stamina recovery +3/s nearby |
| fox | Striker | 75 | 8 / 1250 | Spark dash, 30 damage along its route / 16000 ms | First hit after recall deals +8 damage |
| panda | Guardian/support | 100 | 6 / 1600 | Hearth ward, 35 shield for 8000 ms / 22000 ms | Cold gain reduced 25% nearby |

## Boss encounters

Every arena has four distinct attack clips, visible anticipation, a hit moment, recovery, idle, move, hit, stagger, phase, and defeat. At half health, a one-time phase transition grants a short safe interval and changes the pattern. Bosses reset when the player leaves their arena or is defeated. Recommended levels warn without blocking entry. The following damage values are before player armour and guard.

| Boss / level | HP | Four attacks, damage, telegraph ms | Half-health change | Vulnerability mechanic | First reward |
| --- | ---: | --- | --- | --- | --- |
| Mossback Warden / 1 | 420 | charge 22/1100; antler sweep 16/800; hoof slam 20/1000; root line 18/1200 | Root lines after charges | Dodge a charge into a standing stone; exposed heartwood for 4500 ms | 260 XP, heartwood, Warden trophy |
| Tidecaller / 3 | 720 | wave 24/1000; dive 28/1400; wing sweep 20/800; rain spears 18/1100 | Two waves per sweep, offset rhythm | Jump wave crests; pet attack threat plus recall lures boss onto shoal and slows it for 6000 ms | 650 XP, tide pearl, Tidecaller trophy |
| Rimehorn / 6 | 1100 | horn rush 34/1100; ice stomp 30/1000; crystal fan 26/1200; frost breath 22/1300 | Ice slicks widen and cold gain increases | Three armour plates; heavy hit or brazier bait breaks one; normal damage ×0.15 until broken | 1050 XP, rime plate, Rimehorn trophy |
| Kiln Drake / 9 | 1550 | fire sweep 36/1400; tail sweep 30/900; furnace slam 40/1200; inhale bite 42/1600 | Burning ground lasts 7000 ms instead of 4000 ms | Spear hits throat during inhale; choke and expose for 4500 ms | 1400 XP, kiln core, Drake trophy |
| Stormcrown Roc / 12 | 2050 | marked lightning 42/1300; wing gust 32/1100; dive 46/1500; feather fan 30/900 | Lightning marks in pairs and faster air passes | Updrafts lift attacks; lure flight past charged rod to ground a wing for 6000 ms | 2000 XP, storm quill, Roc trophy |
| The Hourless / 15 | 2700 | borrowed charge 44/1100; wave 38/1000; slow sweep 46/1600; lightning combo 40/1200 | Double-speed combos; rewind every third pattern | Only perfect dodge avoids slow-field sweep; hit pendulum for 120 damage before rewind or boss heals 220 HP | 2600 XP, hourglass gear, Hourless trophy |

Rimehorn cold rises 5/s outside 6 m of a lit brazier and falls 15/s nearby. At 100 it deals 6 HP/s until warmed. Slick ground retains 40% of horizontal velocity after release. The Hourless also borrows Rimehorn's ice fan, Kiln's inhale, and Roc's marked lightning as pattern variants; the observatory's pendulum remains the central lesson. Telegraph footprints show actual damage areas and remain readable under all weather themes.

## Asset and verification contracts

Blender Python builds every animated object from an empty scene, rigs it, bakes actions, and exports GLB. Avatar clips are idle, walk, run, jump, fall, land, climb, dodge, light-1, light-2, light-3, heavy, block, parry, hit, defeat, and interact. Pets have idle, move, attack, skill, hit, knockout, and recover. Bosses have idle, move, attack-1 through attack-4, hit, stagger, phase, and defeat. Hourless also exports borrowed-ice, borrowed-inhale, borrowed-lightning, and rewind clips. Weapon-class action clips use class-qualified names in the manifest, so the loader never plays a sword swing for a hammer hit. Benches have idle and craft. Avatar mesh variants cover every option in `src/core/avatar.js`; material slots preserve palette choices. Only GLB clips animate bodies. Runtime root placement, clip blending, speed matching, and camera motion are allowed.

`npm run wilds:assets` regenerates the complete asset set. Binary tests inspect actual animation names, nonempty keyframes, rigs, materials, and expected avatar variants. Locomotion uses authored cycles matched to world velocity. Attack clips reserve explicit anticipation/hit/recovery timing.

Unit tests use literal expected damage, XP, costs, unlock verdicts, recipes, pet scaling, boss transitions, and normalization results. Browser flows use deterministic clocks, real input, and the existing test hook for setup and observation. The full Wilds flow must walk from clearing to vista, buy/equip, gather/craft/claim, level up, and win six fights with pet damage observed. Separate probes test failures, defeat recovery, persistence, old saves, reduced motion, hidden tabs, and repeated mount/dispose.

Performance is measured after shader warm-up in each biome and each active fight at the CLI's documented viewport. Record actual scene renders/s, RAF gaps, GPU frame time, draw calls, and frames over 20/50 ms. Target 60 fps, no frames over 50 ms, and no sustained missed refreshes. Keep raw evidence and report uncertainty instead of rounding a slower run to 60. Screenshots cover every region, landmark, and boss in day, dusk, and rain. No regular mobs ship: reserved spawn tables contain biome, species, interval, limit, and reward fields, and a disabled encounter hook returns no spawns.


## Reserved regular encounter tables

No regular mobs are instantiated in this release. The future `ambientSpawnCandidates(region, now, population)` hook sits beside the boss encounter update and returns an empty list while the shipped regular-encounter flag is disabled. The reserved data below is for later implementation, not existing content. Each candidate requires at least 50 m separation from camps, landmarks, and boss arenas. Every reward omits gold.

| Region | Reserved original species ID | Attempt interval ms | Population cap | Proposed reward |
| --- | --- | ---: | ---: | --- |
| Forest/meadow | forest-forager | 60000 | 3 | 10 XP, fibre 1 |
| Lake/marsh | marsh-skimmer | 75000 | 2 | 12 XP, fibre 1 |
| Frozen highland | frost-shell | 90000 | 2 | 18 XP, ice crystal 1 |
| Ember canyon | ember-spark | 90000 | 2 | 20 XP, ember shard 1 |
| Sky cliffs | cliff-sail | 100000 | 2 | 24 XP, feather 1 |
| Observatory | clock-scrap | 120000 | 1 | 30 XP, ore 1 |
