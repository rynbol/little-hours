# The Wilds current state

- Branch: `codex/wilds`, isolated worktree `little-hours-wilds`.
- Scope: forest clearing, path, first vista, avatar, one fighting pet, sword combat and Mossback Warden.
- The revised user goal replaces the old milestone order, score-based review loop and completion checklist.
- Brief section 2 remains mandatory. Other biomes and bosses are out of scope.

## Current checkpoint

The M1 round-3 work is integrated into the live worktree. It includes the clearing, streamed terrain and scenery, Blender avatar, locomotion, climbing, camera and HUD. This checkpoint is being committed and pushed as requested, without waiting for the discontinued review loop.

Validation on the current source:

- 872 unit tests pass.
- Guard passes with 359 files and zero problems against `13fc9ee`.
- Room verification and production build pass.
- Existing room skeleton and build chunk warnings remain.
- The unchanged game source passed all 33 Wilds browser checks.
- Four measured noncombat cases run at approximately 60 fps with no frame gaps over 20 ms.
- These measurements do not establish combat or final visual quality.

The old large capture/review workflow is stopped. Staging copies and capture archives will be removed after this push. No old numerical review is an acceptance gate.

## Next: playable slice

1. Implement sword lock-on, combo, dodge and shared stamina rules.
2. Add one pet fighting beside the avatar, with actual combat effects.
3. Build the Mossback Warden encounter, arena, non-gold reward and a level-up.
4. Extend the fixed-clock `lh wilds` flow from clearing to pet-assisted victory and level-up.
5. Run command/browser gates, take at most 12 stills and four short clips, review, commit and push.

## Remaining steps

- Art direction: use actual Focus-window valley shots as the quality bar; define toon ramp, rim light, sky gradient, haze, day/dusk/rain palettes and proportions in `art-direction.md`; build one clearing style frame containing avatar, pet and Warden.
- Blender art: rebuild those three characters and their fight animation; replace placeholder geometry in the slice, including the cylinder outcrop and plain arch.
- Feel: hit stop, camera, readable telegraphs and sound hooks.

After each step, one fresh reviewer sees only the limited captures and reference shots. It answers whether this looks like one finished game and names the five most useful changes. Fix those five and repeat for at most three rounds, then record remaining issues and move on.

## Working rules

- Use pstack and Astra subagents at extra-high effort; host concurrency is four including the lead.
- Commit and push at least hourly. Push only `codex/wilds`; no PR or merge.
- Keep `.lh` below 2 GB and this file below 100 lines.
- No new capture plans, score tables, evidence archives or provenance audits.
- Preserve room, house, timer, friendship modules and study-earned gold behavior.
- Use Node 24, pinned game time/randomness, the lh CLI, and headless automated browsers.
- No Docker, port 5420, or unowned process termination.

## Known unfinished work

Combat, pet combat, the Warden reward and level-up are not implemented yet. The current art is a starting point, with primitive landmarks, simple character proportions and rough clothing joins. Final fight performance is unmeasured.

Done requires pet-assisted Warden victory and level-up in the lh flow, all gates passing, 60 fps measured in the fight, the final small review accepted or its three rounds exhausted, and all work pushed. Then stop.
