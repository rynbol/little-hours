# The Wilds vertical slice

The current goal is one playable forest walk and pet-assisted Mossback Warden fight, followed by one finished style frame. No additional biomes, bosses, shops or crafting are included. `progress.md` records the current implementation and checks.

## References and original design

Nintendo's [Explorer's Guide](https://media.nintendo.com/zelda/breath-of-the-wild/assets/ExplorersGuide.pdf) describes lock-on evasions, last-moment perfect dodges opening a flurry rush, charged attacks consuming stamina, and vulnerability while charging. Its broader exploration loop ties visible destinations to supplies, routes, and discoveries. Sprint and climb draw from the same stamina resource, making route choice matter. Different weapon reach and speed change safe attack windows. Research checked the downloaded PDF text, printed pages 15–18 and 35–36. The web reader timed out, but direct retrieval succeeded.

[Nintendo's GDC presentation](https://www.gdcvault.com/play/1024562/Change-and-Constant-Breaking-Conventions-with-The-Legend-of-Zelda-Breath-of-the-Wild) identifies the developers and the open-air design and art process discussed in their session. The session page was indexed, but the full recording was not reviewed. Our visual interpretation uses a soft cel ramp, warm rim light, blue-grey distance layers, lifted shadows, wind in grass, and large legible silhouettes. These are our rendering choices, not claims about Nintendo's proprietary shader implementation. Boss lessons become arena interactions taught safely before the dangerous version.

[Pocketpair's game description](https://store.steampowered.com/app/1623730/Palworld/) establishes companion combat, traversal, resource production, and construction. The [partner skill catalog](https://www.palworld-db.com/partner-skills) records species-specific partner functions, many unlocked through crafted equipment. The [technology reference](https://palworld.wiki.gg/wiki/Technology) describes level-based crafting unlocks. The [command guide](https://www.gameskinny.com/tips/palworld-how-to-control-pals-in-your-party/) distinguishes aggressive attack, following the player's target, and withholding attacks. These sources motivate a much smaller system here: one existing companion, attack/recall/skill commands, level unlocks, gathering, and short timed bench recipes.

Take landmark-led exploration, timing-based defense, recognizable companion roles, and satisfying preparation. Leave out weapon breakage, creature capture, hunger, labour automation, permanent pet loss, randomized loot rolls, and long craft timers. Keep existing pet names, ownership, appearance, and friendship. No borrowed creatures, outfits, glyphs, architecture, or interface shapes.

## Runtime and ownership

`enterWilds(container, state, { onProgress })` mounts the scene. The standalone check uses `little-hours-wilds-check-v1`. Save data is one normalized `state.wilds` record with version, total XP, discoveries, materials, boss victories and trophies. It neither reads nor writes another gold balance.

One pure encounter reducer wraps movement and owns the player, sword action, target, pet and Warden state. It accepts input edges, a delta and clock value and emits rendering and progress events. The player has one stamina pool for sprint, climb, attacks and dodge. A scene-owned mesh callback design was rejected because it would couple damage and save rules to GPU timing. Babylon stays out of `src/core/wilds/`.

The scene adapts input, camera, models and HUD, preserving hidden-tab suspension and reduced motion. Models display the reducer’s positions and actions. The fixed-clock lh flow uses actual input and asserts damage and rewards rather than calling a win shortcut.

## Forest and controls

Reuse the same default outdoor world builder, terrain rings, trees, grass, sky and atmosphere as the existing Forest route. Start at its walk-in path. The Wilds keeps its avatar, third-person movement and collision-aware camera. Collision samples the rendered terrain triangles. Temporary standing stones define one encounter arena along the path to the first vista.

WASD moves relative to the camera, Shift sprints, Space jumps or climbs, Ctrl dodges, left click attacks and Tab locks. R recalls the pet, T commands it to attack and Q uses its skill. Dragging or pointer lock turns the camera. The HUD shows player health/stamina, level/XP, pet health/skill and the Warden bar.

Walk speed is 4.8 m/s and sprint is 8.5 m/s. Sprint costs 14 stamina per second and climb 20. Stamina returns at 22 per second after 600 ms without spending. The existing jump, climb and mantle clips remain Blender-authored.

## Encounter and progression

The practice sword has a three-hit combo lasting 420/460/620 ms, with hit frames at 180/200/300 ms. Each attack costs six stamina. One input can buffer the next strike. Dodge lasts 500 ms, moves at 9 m/s, costs 24 stamina and protects between 80 and 340 ms.

The companion uses the player’s existing pet identity and reads bond level without changing friendship. It follows, attacks the locked Warden, responds to recall and has a cooldown skill. Knockout is temporary.

The Mossback Warden has 420 health. A charge into a standing stone exposes its heartwood for 4.5 seconds. Sweep and slam punish staying close through their windup. The second phase begins at half health and adds root lines. All attacks have a visible telegraph and recovery. Defeat returns the player to the forest start without permanent loss.

The first victory awards 260 XP, heartwood material and a trophy once. It grants no gold. The XP cost from level L is `100 + 40 * (L - 1)`. Health grows by 12, stamina by four and attack by two per level from 100/100/10. The first victory reaches level three with 124 health, 108 stamina and 14 attack.

## Art gate

After the playable commit, `art-direction.md` fixes shading, rim, sky, haze, palettes and proportions. One style frame contains Blender-built avatar, pet and Warden with real proportions, bent limbs, hands and faces and no visible placeholder primitives. Character animation comes from Blender clips.

Scenery must pass six blind Wilds/Forest pairs and characters six blind pairs against existing room avatar/pet close-ups. The reviewer sees only randomly ordered unlabeled pairs. Wilds may be weaker in at most two pairs in each category. Fix named defects between fresh review rounds, stopping after six failed rounds. Save a short file per round and the passing shots. Do not expand the look beyond this frame.
