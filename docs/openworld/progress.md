# The Wilds current state

- Branch `codex/wilds`, based on `origin/codex/botw-look` at `d41dd6c`.
- Scope is the Forest route, path to first vista, avatar, one fighting pet, sword and Mossback Warden with reward and level-up.
- The current user goal replaces the brief’s old milestone, review and completion sections. Brief section 2 still applies.

## Current checkpoint

M1 round 3 was integrated and pushed as `38e79f6`, then rebased onto the requested Forest branch as `6060f94`. Rebase conflicts retained both Forest and Wilds hooks, tests and world APIs.

The rebased checkpoint passed 891 unit tests, guard, room verification and production build. Existing room skeleton and build-size warnings remain. Combat and final visual quality are not established by these checks.

Old staging copies and capture archives were deleted. `.lh` is approximately 22 MB. The obsolete bulk capture catalog and numerical rubric are being retired.

## In progress: playable slice

- Reuse the actual Forest route terrain, trees, grass, sky and palette. Keep the Wilds avatar, movement and camera.
- Pure encounter reducer owns one player stamina pool, sword combo, dodge, pet actions, Warden phases and once-only rewards.
- Scene connects actual input, lock camera, health/XP/pet/boss HUD and persistence.
- Temporary combat models establish readable actions before the Blender art step.
- Fixed-clock `lh wilds` must walk the forest path, defeat the Warden with pet damage, receive materials/trophy and level up.
- Root owns browser validation and commits. Agents own separate rules, scene and model files.

## Next: style frame only

Write `art-direction.md` with exact shading, rim, sky, haze, day/dusk/rain colors and proportions. Rebuild the avatar, pet and Warden in Blender with hands, faces, bent joints and authored fight animation. No visible placeholder primitives in the frame.

Blind scenery review uses six randomly ordered, unlabeled Wilds/Forest shot pairs at matching times with avatar and HUD hidden. Blind character review uses six pairs against existing room avatar/pet close-ups. A fresh reviewer sees only the pairs and names the weaker picture and reason. Each category passes if Wilds is weaker in at most two pairs.

Fix the named defects after each failed round. Save one short review file per round. Stop after six failed rounds and report the unresolved look; do not extend rejected art. Save passing shots under `docs/openworld/shots/style-frame/`.

## Constraints and remaining work

- Use pstack with Astra at extra-high effort; host allows four concurrent agents including the lead.
- Commit and push at least hourly. Push only `codex/wilds`; no PR or merge.
- Keep `.lh` below 2 GB and this file below 100 lines.
- No capture plans, score tables, evidence archives or provenance audits.
- Preserve house, room, timer, friendship and study-earned gold behavior.
- Use Node 24, pinned time/randomness, headless lh checks and the in-app browser for visible work.
- No Docker, port 5420 or termination of unowned processes.

Combat is in progress; the first playable flow and fight performance remain unverified. The style frame and blind A/B reviews are not started. Do not apply the style beyond the single frame or add other biomes/bosses.

Done requires pet-assisted Warden victory and level-up in the lh flow, all gates passing, measured 60 fps in the fight, both blind A/B tests passing, passing shots saved and everything pushed.
