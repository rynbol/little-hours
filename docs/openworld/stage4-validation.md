# Stage 4: Mossheart model and animation

The guardian uses an original Blender asset and AnimationMixer adapter. The old JavaScript body and poses are removed. Runtime places and turns the whole rig on the terrain normal, selects baked clips from the combat state and blends transitions over 120 ms. Anticipation and active strikes keep priority over a hit flinch. Hit-stop freezes clip time. The kneeling defeat dissolves into leaves and blossoms.

## Asset and build checks

The final frozen asset passes all 828 unit tests, including seven actual-asset and adapter tests with no skips. Guard reports 380 files and no violations. Room verification, production build and the browser doctor pass. The adapter tests cover clocks, serial changes, blending, hit-stop, gait speed, flinch priority, materials, defeat timing, terrain alignment and disposal ownership. The exported rig has normalized weights capped at two, eleven clips, physical antler contact at five fractions of the active sweep and a continuous forward attack arc. Blender's deformed-foot checks show stance drift below 0.09 m/s for walk, trot and charge, with soles 1–3 cm above the support plane.

## Picture review

The first four Blender views were inspected before export. Early hoof gaps, uniform legs, repeated stone plates, oversized antlers and an overexposed heart were corrected. A fresh picture-only judge preferred the corrected model in every view, accepted anatomy, natural branching and pose readability, and rejected material integration and premium quality. Its verdict is saved in the external judge-stag-1 folder.

Real-input game shots in 2026-10-03T12-04-34-shot show idle, active sweep and the stone stun. They confirm readable silhouettes and a lowered active sweep, but expose bulbous wood volumes, a blunt face and separate pale stone ornaments. The final sculpt pass narrows the face, reduces limb and neck bulk, and replaces the tall pale side pieces with lower, darker overlapping stone. The final asset has 30,140 triangles, four materials and 45 bones. All final four-angle renders, sweep, stun and kneeling poses were inspected. The second fresh picture-only judge prefers the latest sculpt in all six independently shuffled pairs, but marks every quality criterion No for both. It still sees a barrel-like body, inflated upper limbs into stick-like shins, collar-like joints, repetitive antlers and weak material integration. Neither judge establishes a quality pass. Full browser replay, fight performance and repeated-exit measurements are pending. Media stays outside Git under wilds-assets/progress-shots/wilds-three-codex/.

## Initial bundle

The main entry remains 4,043,018 raw bytes and 1,645,612 gzip bytes with the same Node compressor. CSS remains 179,240 / 36,476 bytes. Both remain below the fork baseline. The guardian GLB is loaded only after entering the Wilds.

## Complete browser pass and corrected regressions

The complete frozen run `2026-10-03T12-16-10-run` exercises all 28 flows, with 778 of 779 assertions green. Its sole failure is the movement harness expecting `run` at one instant after crossing sloped terrain, while the actual player had travelled 13.50 m and was in the last tenth of a landing. The check now accepts the legitimate run/jump/landing movement states while still requiring actual horizontal velocity and displacement. No game behavior was changed for that assertion.

The unrecorded Retina fight wins at 60.002 fps over 2,094 frames, maximum 16.8 ms, no frame over 20 ms. Every baked threat, the stone stun, phase change and full 32-frame defeat recording pass. All action inputs respond within 100 ms. The continuous valley journey passes all purchases, pet interactions, climb, secret, glide, swim, checkpoints, fight and reentry checks. Five warmed exits end 94,940 bytes below the baseline, with zero Three geometries, textures and programs, lost contexts and no detached Wilds canvases or contexts.

A read-only integration review exposed two real bugs beyond the scripted fight. A final hit-stop tick reduced its timer to zero while keeping the player stationary, then moved the guardian 0.183 m. A per-frame frozen flag now keeps player, guardian, partner and mixers paused together through that tick. Also, a camp reset restarts impact serials; the stag now resets its consumed-impact tracker when the action epoch restarts. Both bugs were reproduced on the previous code and have failing-without-the-fix regressions. All 70 scoped combat and model tests pass after the fixes. The affected Forest and guardian flows are being replayed on the final source.

The actual defeat recording was inspected at four points. Kneeling, dimming and dissolution work, but the lowered muzzle can overlap a player standing directly in front. Final actor polish should tuck or turn the defeat head aside and confirm it against the finished hero. The silhouette and material weaknesses recorded by both judges remain open.

## Final checkpoint

Final source passes 830 unit tests, guard, room verification and build. The affected Forest and guardian replay `2026-10-03T12-40-56-run` passes all 46 assertions, with no browser errors. Combined with the complete 28-flow run, every flow is green. The final unrecorded Retina fight measures 60.003 fps across 2,101 frames, maximum 16.8 ms, zero frames above 20 ms. Five warmed exits record 245,678,292 → 245,517,432 → 245,619,500 → 245,556,796 → 245,625,468 → 245,572,180 bytes, a net decrease of 106,112 bytes. Every exit releases GPU resources and contexts. Movement records 60 fps, maximum 16.8 ms. The continuous valley exploration and final defeat frames were inspected. Continue immediately to the hero and pets; the remaining visual limitations are explicit above.
