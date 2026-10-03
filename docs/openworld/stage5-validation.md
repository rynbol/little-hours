# Stage 5: hero and companions

Stage 5 is accepted functionally. The complete 29-flow browser suite and the corrected targeted replay are green in combination; the honest visual limitations below remain.

## Actors and contact

The original Blender hero replaces the capsule and the camp merchant. Named mesh variants and palette materials cover all eight wardrobe fields. Six original companion rigs cover cat, dog, bunny, fox, red panda and the later earned Wolf. Only the active room species fights; the Wolf is reserved for a separate passive follower. Source scripts regenerate the assets from empty scenes. Bodies and poses are never constructed in JavaScript.

Each runtime actor owns one mixer. The simulation controls root placement, facing and terrain tilt; the mixer samples baked body animation. Grounded actors remain upright on flat elevated supports. Finite actions track domain time, gait rate follows actual travel, knockout and recovery use local clocks, and all transitions blend. A stopped exploration pet sits once and holds its pose. Asset tests read the actual exported GLBs, including skin weights, required clips, wardrobe variants and physical blade or paw contact.

The sword is shorter than the stage-one placeholder. Every attack row now contains nine measured blade-base and blade-tip samples from Blender. Collision tests sweep that edge through the current frame, replacing the old nominal angular sector, which traveled in the opposite direction from the first authored slash. Lights have a 1.18 m broad-phase bound and heavy 1.23 m; actual samples decide contact. Attacks and charging keep planted feet instead of adding collision-dependent root lunges. The trail uses the current blade bones and cannot stretch the blade.

## Behavior corrections

The first contact frame must display the contact pose before freezing subsequent frames. The runtime now distinguishes a newly started hit-stop timer from a frame actually held by hit-stop. A regression drives the real simulation into contact and checks the sampled pose clock. Pet strikes start a brief shared stop and emit a visible burst. A charge impact selects the baked knockback response; other damage selects hit. Reduced motion suppresses camera nudges and flinches.

Camp menus allow petting. The proximity-checked interaction faces the hero toward a healthy nearby companion, which walks into hand reach before both baked care clips start. Movement ends the gesture. No bond value is written. Same-visit encounter resets clear impact serial tracking so later hits still flinch.

## Picture review

Four views of every original actor were inspected before export. Hero continuity work joins the trouser and shorts hips, closes the rear hood slit and reduces the shoulder caps. Two fresh blind rounds prefer the hero revisions in four of four and three of four shuffled views respectively. Neither passes premium quality: the torso, sleeves, cape and glove forms remain simple. The side-view folded hood was preferred before the final continuity pass.

Companion work joins body, legs and paws into a weighted organic surface, then restores separate crisp facial details and deliberate coat regions. Four blind rounds were used. Round two is explicitly invalid because its A/B copies were identical; SHA-256 checks now prevent that setup error. Round three preferred the earlier crisp details over the blurred organic pass. The final graft wins all six pairs in round four, but still fails premium quality, paw structure and species-specific anatomy for the bunny. No premium visual pass is claimed. All pictures, immutable pair mappings and verdicts remain outside Git in the stage-specific progress-shot folders.

The exported hero roll initially penetrated the ground by more than 5 cm at a sword vertex. The actual-asset regression samples the complete roll and visible weighted vertices, and checks that the blade keeps its length. All nine hero tests now pass with the final structural export, including physical attack paths, full-roll clearance, skinning and wardrobe coverage. All six companion exports pass weights, exact clip times and visible contact tests.

## Real-input acceptance

The first frozen replay `2026-10-03T13-43-23-run` changes wardrobe fields through the real room UI, chooses dog then cat, enters through Forest and records movement, jumping, dodging, whistling and petting. Both baked care clips and saved appearance pass. The guardian is defeated twice, with all four threats, stone stun, perfect-dodge flurry, partner skill and both phases. The unrecorded Retina fight measures 60.003 fps across 2,117 frames, maximum 16.8 ms and no frame over 20 ms. Measured action response ranges from 3.1 to 47.1 ms. Reviewed care and fight frames show the finished actors, with no geometry explosions or broken loads. The broader valley and camp remain visibly simpler than the references.

## Complete suite findings

The complete 29-flow run `2026-10-03T13-48-03-run` passes 788 of 790 assertions. Both failures share one cause: the pet cue advertises readiness during residual movement even though the care command rejects that speed. All other room, island, Focus, garden, pond, traversal and combat checks pass. Five warmed exits release every Three GPU allocation and context, retain no detached Wilds canvases or contexts, and measure 245,916,380 → 246,075,996 bytes (159,616 bytes growth, below the 1 MiB acceptance bound). The complete-run Retina fight again measures 60.002 fps, maximum 16.8 ms and no frame above 20 ms.

The continuous route records 2,614 frames, covers ground, climb, glide, air and swim, and wins with the purchased sword. Reviewing its images exposes a high hero swimming waterline. Actual exported swim measurements put the head 0.31–0.54 m above the lake and the chest 0.27 m above it; lowering only the actor root by 0.25 m puts the chest near the surface and leaves the head above it. Physics and camera height stay unchanged.

The independent code review also reproduces petting pulling a swimming companion to the lake bed, and victory/getup gestures masking a new sword action. All four findings are corrected. The final replay `2026-10-03T14-27-34-run` passes every assertion in the wardrobe/actors, continuous valley and combat flows. It reproduces opening the care menu while coasting, rejects care in deep water, and interrupts victory with a new sword gesture. The final unrecorded Retina fight measures 60.002 fps across 2,027 frames, worst 16.8 ms and zero frames over 20 ms. Corrected care, swim and combat frames were inspected. The other 26 browser flows passed in the complete run and their source was not changed by these corrections.

Final static gates pass 858/858 tests, guard (389 files, zero problems), room verification and production build. The initial main entry remains smaller than the fixed fork: 1,645,612 gzip bytes against 1,653,487; Three and its actor assets stay behind Forest entry. Every render, play capture and judge pair lives in `wilds-assets/progress-shots/wilds-three-codex/`, outside this repository.
