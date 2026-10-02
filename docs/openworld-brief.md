# Little Hours: The Wilds (open-world game) brief for Astra

You are building the first playable version of "The Wilds", the open-world action game that extends Little Hours. Run autonomously overnight. Do not ask questions. When something is unclear, pick the option that best fits this brief, write the decision and the reason in `docs/openworld/progress.md`, and keep going.

## 1. What the owner wants (their words, condensed)

- A Breath of the Wild style open world in gameplay and graphics, with Palworld mechanics: a pet fights alongside you.
- The avatar has a Level. Levels make you stronger.
- Gold buys weapons and armour. Each unlocks at a level.
- Crafting benches where you craft things, like Palworld.
- Pets get better with friendship. Friendship already exists. Do not change it. Build pet attacks, abilities and combat animation on top of it.
- All character, pet and boss animation is made in Blender. Always Blender. Never hand-keyed in JavaScript.
- The world is big. It starts in an opening in a forest. The forest ends and the world opens up. Add biomes such as an ice biome, and striking landmarks, in the spirit of the valley seen through the Focus window.
- No regular mobs yet. Bosses first. Progressive bosses in different areas, each with different mechanics and fight animations.
- Gameplay will be tweaked afterwards. Deliver a broad, solid, fun first version.

Original design only. Carry BotW's air (painterly light, layered blue-grey haze, lifted shadows, lush calm, quiet music-box mood) with our own shapes. No Hyrule, Sheikah, Zelda, Palworld or Pokemon lookalikes, names, creatures or UI.

## 2. Ground rules

Read `AGENTS.md` first and obey it. The points that bite:

- Node 24. Gates are `npm test`, `npm run guard`, `npm run verify:room`, `npm run build`. Browser checks go through the `lh` CLI (`npm run lh -- help`, and `.claude/skills/verify-little-hours/SKILL.md`). Add flows under `scripts/lh/`. No one-off driver scripts.
- Every change to `src/**/*.js` ships with a test that fails without it.
- Time comes from `clockNow()` and randomness from `clockRandom()` in `src/core/test-pins.js`. Never `Date.now()`, `Math.random()` or `new Date()`.
- No new code comments. Names explain the code. Reasons go in commit messages.
- Babylon.js 9.27.1 is the engine. Hold 60 fps. Measure in a real browser with `lh perf`. Batch static geometry, use thin instances, keep draw calls low. Honour reduced motion. Suspend rendering in hidden tabs.
- Never start or use Docker. Never touch port 5420 (the owner's dev server). Never kill a process you did not start.
- Keep credentials, local paths and build output out of Git.

Isolation, so you do not collide with the agent working on the island:

- Branch `codex/wilds`, created from `origin/codex/botw-look`, in your own git worktree. Push only to `codex/wilds`. Do not merge into `main` or `codex/botw-look`. Do not open or merge PRs.
- Do not edit `src/features/house/**`, `src/features/room/**`, `src/features/timer/**` or the friendship modules (`src/core/pet-bonds.js`, `pet-care.js`, `pet-gifts.js`, `pet-legacy.js`). Read them freely.
- Do not change how gold is earned. Gold is the existing `state.house.coins`, earned by studying. The Wilds spends it. Bosses pay out XP, materials and trophies, not gold.
- New code lives in `src/features/wilds/` (scene, input, camera, UI), `src/core/wilds/` (pure rules, no Babylon imports), `src/models/wilds/` (model loading and world dressing), `public/wilds/` (exported `.glb`), `tools/blender/` (the Python that generates every asset), `checks/wilds.html` (a standalone page with its own test save), `scripts/lh/` (flows) and `docs/openworld/`.
- Entry for now is `checks/wilds.html` plus one exported `enterWilds(container, state)` in `src/features/wilds/index.js`. The island's forest trailhead (`FOREST_TRAILHEAD` in `src/features/house/island-forest.js`) will be wired to it later by someone else. Do not wait for it.
- Save data goes in one new `state.wilds` slice with its own `normalizeWilds()` and tests. Old saves and backups must load unchanged.

## 3. Step zero: research, then a design document

Before writing game code, research and write `docs/openworld/design.md`. Keep it concrete and short enough to act on. Cover:

1. Breath of the Wild. The exploration loop (see a landmark, go there, get rewarded). Stamina for sprint and climb. Combat: lock-on, light and charged attacks, perfect dodge that opens a flurry window, parry, weapon classes with different reach and speed. How its bosses teach one mechanic each. Art: cel shading with soft ramps, rim light, atmospheric scattering, grass and wind.
2. Palworld. The partner fighting beside you, partner skills, simple commands (attack target, come back, use skill), level-gated technology unlocks, crafting benches with timed recipes, gathering materials.
3. What to take, what to leave, and why, for a cozy study game where play sessions are short breaks.
4. The final numbers: XP curve, stat growth, weapon and armour tables, recipe list, boss stat blocks, pet ability table.

Then build what the document says. If the build teaches you something, update the document.

## 4. What to build

### World

- One continuous world, large enough that crossing it on foot takes several minutes. Reuse the outdoor layers in `src/models/world/` (terrain rings, terrain paint, trees, grass, rocks, water, sky, clouds, landmarks, atmosphere) and `src/core/world-terrain.js`. Extend them. Do not fork copies.
- Start: a sunlit clearing in a forest. A path leads out. The trees thin, and the first vista shows the whole world with landmarks on the horizon.
- At least five biomes that blend at their borders, each with its own palette, flora, props, weather and ambient motion: forest and meadow lowlands, a lake and marsh country, a frozen highland (ice biome), a warm ember canyon, and wind-carved sky cliffs with floating islets. A sixth, the ruined observatory plateau, holds the last boss.
- At least eight original landmarks visible from far away, so the player always has somewhere to walk to. Each boss arena is itself a landmark.
- Day, dusk and rain themes, matching the rest of the app.
- Gathering nodes (wood, stone, ore, fibre, ice crystal, ember shard, feathers) that respawn on a clock-driven timer.
- Design the mob spawn tables and the hook they attach to, but ship no regular mobs.

### Player

- Third-person camera. Keyboard and mouse first, gamepad if cheap. Walk, sprint (stamina), jump, dodge roll with invulnerability frames, light attack combo, charged heavy attack, block or parry, lock-on, interact, call pet, pet skill.
- The avatar looks like the player's existing avatar (`src/core/avatar.js` holds the appearance). Recreate it as a rigged Blender character that takes the same appearance options.
- Level and XP. Each level raises health, stamina and attack. Show a clear level-up moment.
- Weapons in at least three classes (sword, spear, heavy hammer or axe) plus a bow if time allows. Several tiers each, bought with gold, unlocked at set levels. Armour sets the same way.
- Crafting benches placed in the world and at camp: workbench, forge, alchemy pot. Recipes turn gathered and boss materials into upgrades, potions and gear that gold cannot buy.
- Health, healing items, defeat (wake at the last campfire, lose nothing permanent), campfire checkpoints, fast travel between lit campfires.
- HUD: health, stamina, level and XP, pet health and skill cooldown, boss bar, lock-on marker. Menus: inventory, equipment, shop, crafting, map with landmarks.

### Pets in combat

- The companion is the player's existing pet (`src/core/pets.js`). It follows, fights the locked target on its own, and has one active skill on a cooldown that the player triggers, plus one passive.
- Each pet species gets its own attack set and role (striker, guardian, support).
- Read the existing bond level (`bondLevel` in `src/core/pet-bonds.js`) and scale the pet's damage, health and skill cooldown from it. Never write to it.
- Pets are knocked out, not killed. They recover at a campfire or after a timer.

### Bosses (build these six, in this order of progression)

Each boss has its own arena, a phase change at half health, clear telegraphs for every attack, a mechanic the player must learn, a Blender-made animation set (idle, move, at least four attacks, hit, stagger, phase change, defeat), and a reward: XP, a unique crafting material and a trophy.

1. **The Mossback Warden**, at the forest's edge. A great stag of stone and moss. It charges. Dodge so it rams a standing stone, which stuns it and bares the glowing heartwood on its back. Teaches dodge and punish. Phase two adds root eruptions in lines.
2. **The Tidecaller**, in the marsh lake. A towering heron spirit standing in shallow water. It sweeps waves across the arena that must be jumped, and dives under to strike from below (ripples telegraph it). The pet can lure it onto the shoals where it is slow. Teaches jump timing and using the pet.
3. **Rimehorn**, in the frozen highland. A horned snow beast in ice armour. Normal hits bounce off. Heavy attacks or lit braziers crack the armour plate by plate. The arena floor is slick and a cold gauge fills away from the braziers. Teaches charged attacks and using the arena.
4. **The Kiln Drake**, in the ember canyon. A wingless drake with a furnace belly. It breathes fire in sweeps and leaves burning ground. When it inhales, its throat glows and a spear or arrow to the throat makes it choke and collapse. Teaches reach, ranged timing and positioning.
5. **The Stormcrown Roc**, on the sky cliffs. A huge bird that fights from the air. Lightning strikes are marked on the ground before they land. Updrafts lift the player to its level for air attacks. It lands only when a wing is grounded by a lightning rod the player lures it past. Teaches vertical movement and reading the arena.
6. **The Hourless**, at the ruined observatory. A clockwork guardian with no face on its dial. It bends time: slow fields where only a perfect dodge works, fast phases where its combos double, and a rewind that heals it unless its pendulum is broken first. It borrows one move from each earlier boss. This is the study-timer theme made into a fight.

Gate them by recommended level so the order holds, but let a skilled player go early.

### Animation and art pipeline: always Blender

- Blender is installed (`/opt/homebrew/bin/blender`). Run it headless: `blender -b -P tools/blender/<script>.py`. A Blender MCP server may also be available. Either way, the committed Python script is the source of truth and must regenerate the asset from nothing.
- Every animated thing (avatar, each pet, each boss, benches with moving parts) is modelled, rigged and animated in Blender and exported as glTF binary to `public/wilds/`. Load with `@babylonjs/loaders` (add it at the same version as core).
- Animation quality bar: anticipation before every attack, a readable hit frame, follow-through, weight in the feet, no sliding. Blend between clips. Root motion or matched speeds so feet do not skate.
- Static scenery may stay procedural in JavaScript, as the rest of the project does.
- No AI-generated raster art. Textures are flat colour, vertex colour or small procedural ramps.
- One `npm run wilds:assets` script rebuilds every `.glb`. A test checks that each expected clip name exists in each exported file.

## 5. Order of work (each milestone ends green, committed and pushed)

- **M0** Research and `docs/openworld/design.md`. Worktree, branch, `checks/wilds.html`, an empty scene at 60 fps, the `wilds` lh flow skeleton.
- **M1** World slice: the forest clearing, the path out, the first vista, terrain collision, the player controller and camera with the Blender avatar and its locomotion clips.
- **M2** Combat core: lock-on, combos, dodge, stamina, damage rules in `src/core/wilds/`, HUD, and the Mossback Warden complete.
- **M3** Progression: XP and levels, shop for weapons and armour, inventory and equipment, gathering, benches and recipes, campfires and fast travel, saving.
- **M4** Pet combat for every pet species, bond scaling, commands.
- **M5** The remaining biomes, landmarks and bosses two to six, one at a time, each finished before the next starts.
- **M6** Polish pass: game feel (hit stop, camera shake that respects reduced motion, sound hooks), balance pass against the design numbers, perf pass, a full playthrough flow.

If time runs out, stop at the last finished milestone. A finished M3 beats a broken M5.

## 6. How to work

- Small commits. Run the gates before each. Push at every milestone at least.
- Keep `docs/openworld/progress.md` current: what is done, what is next, each decision with its reason, each known defect. Someone will resume from this file.
- Look at your own work. Take screenshots with `lh shot` of every biome, landmark and boss, in day, dusk and rain. Judge them hard against "BotW air, original, pleasing". Fix what looks cheap before moving on. Save the keepers in `docs/openworld/shots/`.
- Test hook only through `src/dev/test-hook.js`. Give flows a way to place the player, set level and gear, and step a fight on a fixed clock so boss flows repeat exactly.
- Unit-test every rule in `src/core/wilds/` (damage, XP, unlocks, recipes, bond scaling, boss phase logic) with literal expected values.
- If Blender or a tool is missing, write it down, build the nearest thing that keeps the pipeline honest, and carry on.

## 7. Done means

The goal is met when all of this is true on `codex/wilds`, pushed:

1. `docs/openworld/design.md` and `docs/openworld/progress.md` exist and match the build.
2. `npm test`, `npm run guard`, `npm run verify:room` and `npm run build` pass.
3. `npm run lh -- run wilds` passes. It starts in the forest clearing, walks out to the vista, buys and equips a weapon, crafts an item at a bench, levels up, and defeats each of the six bosses on a fixed clock with the pet fighting.
4. `lh perf` on the wilds view shows 60 fps with no slow frames in each biome and in each boss fight, and the numbers are recorded in `progress.md`.
5. Every animated character's clips come from a `.glb` that `npm run wilds:assets` regenerates from scripts in `tools/blender/`.
6. Five or more biomes, eight or more landmarks and six bosses are in the world, with screenshots of each in `docs/openworld/shots/`.
7. Old saves load, friendship code is untouched, gold earning is untouched, and nothing under `src/features/house/` changed.
8. `progress.md` ends with an honest list of what is weak, what was cut and what to tweak first.
