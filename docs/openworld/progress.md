# The Wilds current state

- Branch `codex/wilds`, based on `origin/codex/botw-look` at `d41dd6c`.
- Scope is the Forest route, path to first vista, avatar, one fighting pet, sword and Mossback Warden with reward and level-up.
- The current user goal replaces the brief’s old milestone, review and completion sections. Brief section 2 still applies.

## Current checkpoint

M1 round 3 was pushed, rebased onto the requested Forest branch and pushed again. The old staging/capture archives and bulk catalog were removed. The playable slice is pushed as `2399e58`. The separate style frame is complete and has passed both blind comparisons.

- Uses the actual Forest route builders and atmosphere, preserving the Wilds avatar, movement and camera.
- Sword combo, lock, dodge and shared stamina work with a fighting companion and the Warden’s charge/stone exposure, phase-two roots and reward.
- The fixed-clock browser flow passes all 30 checks from the forest start through pet-assisted victory, level three, first vista, persistence and remount.
- 945 unit tests pass. Guard passes with 386 files and no problems. Room verification and production build pass. Browser flows pass all 38 checks, including eight style-frame checks.
- `lh perf --view wilds --fight --seconds 15 --size 1280x800 --scale 1 --theme day --rounds 2` measured 59.994 and 59.992 fps, maximum frame gap 16.8 ms and zero gaps over 20 ms. Each fight recorded 270 sword damage and 150 pet damage, defeating the Warden.
- The home save/backup retains Wilds progress. Legacy saves, study-earned gold and friendship are unchanged. Protected source paths have no diff against the new base.
- Existing room skeleton and build-size warnings remain.
- Combat models are temporary static art. Character body attacks are not animated yet. This is the playable checkpoint, not visual acceptance.

## Style frame

`art-direction.md` records shading, rim, sky, haze, day/dusk/rain colors and proportions. The separate `/checks/wilds-style.html` view uses the actual Forest scenery and three new Blender models. `npm run wilds:assets` regenerated every GLB successfully. `lh style-pairs` captures anonymous pairs from actual app views.

Blind round one passed scenery with Wilds weaker in 2 of 6. Characters passed round two with Wilds weaker in 0 of 6 and one tie. The fixes corrected inward avatar normals, softened body transitions, refined the cat's eyes and anatomy, and added linear-light shading with broad indirect fill. Both rounds are recorded under `reviews/`.

Blind scenery review uses six randomly ordered, unlabeled Wilds/Forest shot pairs at matching times with avatar and HUD hidden. Blind character review uses six pairs against existing room avatar/pet close-ups. A fresh reviewer sees only the pairs and names the weaker picture and reason. Each category passes if Wilds is weaker in at most two pairs.

Passing scenery and character comparison pictures plus day, dusk, and rain group frames are saved under `docs/openworld/shots/style-frame/`. The reproducible captures run through `lh style-pairs` and `lh shot wilds-style`.

## Scope and limits

- Use pstack with Astra at extra-high effort; host allows four concurrent agents including the lead.
- Commit and push at least hourly. Push only `codex/wilds`; no PR or merge.
- Keep `.lh` below 2 GB and this file below 100 lines.
- No capture plans, score tables, evidence archives or provenance audits.
- Preserve house, room, timer, friendship and study-earned gold behavior.
- Use Node 24, pinned time/randomness, headless lh checks and the in-app browser for visible work.
- No Docker, port 5420 or termination of unowned processes.

The playable flow, fight performance, and both blind reviews pass. The front avatar comparison tied because the existing avatar has smoother shading while Wilds has richer detail. Combat art remains rough in the playable view. The new Blender art is isolated in the style frame as requested. Its exported movement clips have structural checks, but full combat animation polish is outside this frame.

The requested slice and style-frame work are complete. Do not apply this look beyond the frame or start another biome or boss without a new instruction.
