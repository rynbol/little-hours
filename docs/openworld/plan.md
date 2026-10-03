# Wilds on three.js

The full target is the first playable Mossheart valley described in the owner's Wilds three.js brief. This restart forks `origin/codex/botw-look`; it does not reuse any retired Wilds implementation or art. The four explicitly named reference stills set the eventual mood, not the Stage 1 asset requirements.

The October 3 revision explicitly requires finishing the entire slice in one run while the owner is away. Do not stop after a stage to request a verdict.

## Workflow

Use pstack's Experience First, Model the Domain and Prove It Works principles: establish responsive controls before detailed assets, keep action timing and collision in a tested simulation, and verify real input through the Forest entrance. The owner subsequently authorized GPT-6.1 Sol helpers for this task. Helpers have disjoint file ownership; the primary agent integrates and reviews. Existing pstack model settings remain unchanged.

1. Feel box: capsule, green terrain, posts and dummy; movement, camera, attacks, hit-stop and stamina; lazy Forest entry and complete disposal. Verify unit behavior, real inputs, five entry/exit cycles, room/island bundles and performance, and all existing gates. Commit and push, then continue.
2. Fight in shapes: every stag attack, telegraphs, dodge punish window, stones, phase change and pet assistance. Repeat gates, commit, push and continue.
3. Valley: camp and reveal, continuous terrain, lake and waterfall, landmarks, vegetation and painterly lighting around block-out actors. Compare the four references, use blind picture judges, measure performance, commit, push and continue.
4. Stag: regenerable Blender model, weighted rig and complete animations; inspect four model angles, tune combat alignment, run gates, commit, push and continue.
5. Hero and pet: own avatar options, Blender bodies and full animation set, active room pet with read-only bond scaling; inspect and test, commit, push and continue.
6. Life, weather, sound and polish: twelve-minute light cycle, wildlife, water effects and sound, full fight rewards and checkpoint behavior. Record all requested views at morning, shower, golden hour and night; compare, judge, gate, commit, push and continue.

## Stage 1 boundaries

Three.js is pinned and imported only by the new Wilds features/models. The app imports the feature only on entry. The house relinquishes its scene while Wilds owns the screen and rebuilds at the trailhead on return. The room remains suspended throughout. Pure simulation owns movement, actions, stamina, collision and hit events; the renderer consumes it. HUD information is shapes and icons; controls and explanations live in the pause menu.

Stage 1 does not claim the finished valley or characters. It awards no currency or rewards and does not modify pet bonds. Media and measurements are kept in the external progress-shots directory, outside Git. A browser flow exercises user input; read-only diagnostics expose counters and allocations without initiating behavior.

## Completion evidence

Each stage needs tests that fail without its behavior, `npm test`, `npm run guard`, `npm run verify:room`, `npm run build`, all `lh` flows, no console errors, and honest performance/memory measurements. Fixed-clock shots are inspected locally before a blind judge; no competing submission is consulted. A green stage is a checkpoint, not completion of the six-stage goal. The updated brief requires one continuous run. Play each stage through real input, inspect recorded frames, and proceed after its green commit and push.

## Valley layout prepared during Stage 2 checks

Use the existing terrain directly and keep the ring at `(0,-24)`. The exploration path curves west around it to a vista at `(-18,-65)`, so exploring does not require starting the boss. Continue through a trail camp at `(-72,-180)` and shrine at `(-68,-205)`, with the great oak at `(35,-220)`, ruins at `(-85,-305)`, a climbable stone shoulder at `(-95,-315)`, and the two-step falls near `(-113,-332)` and `(-116,-342)`. Reachable stone formations support all elevated surfaces; they share collision definitions with their render geometry.

The natural basin around `(-160,-400)` supports a lake at `y=-44`, with approximately 5,480 square metres of connected water and bounds `x=-212…-64`, `z=-426…-358`. A broad two-metre-grid flood search finds no connection to its outer bounds. Raising the water one metre would flood surrounding terrain, so retain this level and clip water geometry to the actual connected contour. The vista has terrain-clear sightlines to it. A shore camp at `(-220,-414)` sits 0.455 metres above the water on a 3.8-degree slope. The observatory stands on a climbable rock ridge beyond the western shore.

Stage 3 now implements climbing, gliding and swimming through the shared physical world adapter. The training defaults remain testable, while the valley has no training-radius barrier. Eight persistent secrets, study-gold purchases, camp checkpoints and herbs use the existing asynchronous state store. Study gold is only deducted by purchases; pet bonds are read-only. Rocks share immutable asymmetric footprints across visible surfaces, standing support, climbing and swept sliding collision. Forest trees stand in irregular groves with a clear sightline toward the lake.

## Remaining actor implementation contracts

The stag will use an original Blender-generated skinned GLB, with in-place clips named idle, walk, trot, charge, sweep, stomp, roots, hit, stunned, phase and defeat. Its attack clips follow the existing attack table, including anticipation and recovery. Runtime transforms only place and face the actor on terrain; an AnimationMixer blends baked poses. Four Blender views and active-hit poses must be inspected before export. A shared actor loader will retain painterly materials and release mixer references and skeleton textures on exit.

The hero must cover every normalized avatar option using named Blender mesh variants and palette materials. Hair, cape and satchel use their own bones; the sword belongs to the hand rig. All active room pet species need a corresponding original rig, with the earned Wolf staged separately after victory. Preserve the current pet bond data and room avatar choices.

Final polish must address the fourth environment judge’s failed criteria, plus near-camera leaves obscuring combat, the block-like cliffs and observatory support, and the narrow distant lake reveal. Add actual changing light, rain, water reflection and life before the four lighting evidence sets.
