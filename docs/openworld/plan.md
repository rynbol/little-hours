# Wilds on three.js

The full target is the first playable Mossheart valley described in the owner's Wilds three.js brief. This restart forks `origin/codex/botw-look`; it does not reuse any retired Wilds implementation or art. The four explicitly named reference stills set the eventual mood, not the Stage 1 asset requirements.

## Workflow

Use pstack's Experience First, Model the Domain and Prove It Works principles: establish responsive controls before detailed assets, keep action timing and collision in a tested simulation, and verify real input through the Forest entrance. The owner subsequently authorized GPT-6.1 Sol helpers for this task. Helpers have disjoint file ownership; the primary agent integrates and reviews. Existing pstack model settings remain unchanged.

1. Feel box: capsule, green terrain, posts and dummy; movement, camera, attacks, hit-stop and stamina; lazy Forest entry and complete disposal. Verify unit behavior, real inputs, five entry/exit cycles, room/island bundles and performance, and all existing gates. Commit and push, then stop for the owner's playtest.
2. Fight in shapes: every stag attack, telegraphs, dodge punish window, stones, phase change and pet assistance. Repeat gates, commit, push and stop for playtest.
3. Valley: camp and reveal, continuous terrain, lake and waterfall, landmarks, vegetation and painterly lighting around block-out actors. Compare the four references, use blind picture judges, measure performance, commit, push and stop.
4. Stag: regenerable Blender model, weighted rig and complete animations; inspect four model angles, tune combat alignment, run gates, commit, push and stop.
5. Hero and pet: own avatar options, Blender bodies and full animation set, active room pet with read-only bond scaling; inspect and test, commit, push and stop.
6. Life, weather, sound and polish: twelve-minute light cycle, wildlife, water effects and sound, full fight rewards and checkpoint behavior. Record all requested views at morning, shower, golden hour and night; compare, judge, gate, commit, push and stop.

## Stage 1 boundaries

Three.js is pinned and imported only by the new Wilds features/models. The app imports the feature only on entry. The house relinquishes its scene while Wilds owns the screen and rebuilds at the trailhead on return. The room remains suspended throughout. Pure simulation owns movement, actions, stamina, collision and hit events; the renderer consumes it. HUD information is shapes and icons; controls and explanations live in the pause menu.

Stage 1 does not claim the finished valley or characters. It awards no currency or rewards and does not modify pet bonds. Media and measurements are kept in the external progress-shots directory, outside Git. A browser flow exercises user input; read-only diagnostics expose counters and allocations without initiating behavior.

## Completion evidence

Each stage needs tests that fail without its behavior, `npm test`, `npm run guard`, `npm run verify:room`, `npm run build`, all `lh` flows, no console errors, and honest performance/memory measurements. Fixed-clock shots are inspected locally before a blind judge; no competing submission is consulted. A green stage is a checkpoint, not completion of the six-stage goal. The owner's verdict gates the next stage.
