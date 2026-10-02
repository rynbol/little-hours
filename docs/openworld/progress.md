# The Wilds current state

- Branch `codex/wilds`, based on `origin/codex/botw-look` at `d41dd6c`.
- Scope is the Forest route, path to first vista, avatar, one fighting pet, sword and Mossback Warden with reward and level-up.
- The current user goal replaces the brief’s old milestone, review and completion sections. Brief section 2 still applies.

## Current checkpoint

M1 round 3 was pushed, rebased onto the requested Forest branch and pushed again. The old staging/capture archives and bulk catalog were removed. The playable slice is complete and is being committed and pushed.

- Uses the actual Forest route builders and atmosphere, preserving the Wilds avatar, movement and camera.
- Sword combo, lock, dodge and shared stamina work with a fighting companion and the Warden’s charge/stone exposure, phase-two roots and reward.
- The fixed-clock browser flow passes all 30 checks from the forest start through pet-assisted victory, level three, first vista, persistence and remount.
- 919 unit tests pass. Guard passes with 377 files and no problems. Room verification and production build pass.
- `lh perf --view wilds --fight --seconds 15 --size 1280x800 --scale 1 --theme day --rounds 2` measured 60 fps, maximum frame gap 16.8 ms and zero gaps over 20 ms in both rounds. Each fight recorded 270 sword damage and 150 pet damage, defeating the Warden.
- The home save/backup retains Wilds progress. Legacy saves, study-earned gold and friendship are unchanged. Protected source paths have no diff against the new base.
- Existing room skeleton and build-size warnings remain.
- Combat models are temporary static art. Character body attacks are not animated yet. This is the playable checkpoint, not visual acceptance.

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

The playable flow and fight performance pass. The style frame and blind A/B reviews are not started. Do not apply the style beyond the single frame or add other biomes/bosses.

Done requires pet-assisted Warden victory and level-up in the lh flow, all gates passing, measured 60 fps in the fight, both blind A/B tests passing, passing shots saved and everything pushed.
