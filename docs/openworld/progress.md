# The Wilds rebuild

The active specification is the owner's `wilds-assets/GOAL.md`, revised on 2026-10-02 to include combat playtesting. It replaces all earlier completion claims. Work stays in `codex/wilds`.

## Current step

Step 0 is verified. The merge includes `origin/codex/botw-look` at `d447e42`. The rejected character generators, GLBs, style view, tests and reviews are removed. A plain 1.7 metre capsule keeps the playable view working. The old Warden's vertex data is frozen unchanged, and the existing pet stays unchanged. Neither is a visual acceptance claim.

The existing thirty fight checks are regression checks only. They do not prove the fight works for a player. No manual combat verdict has been reached. `OWNER-BUGS.md` was absent when checked on 2026-10-02.

## Delivery sequence

0. Merge Forest and remove rejected art. Verify tests, guard and the capsule fight flow. Commit and push.
1. Create four provisional target stills. Owner approval is pending.
2. Import, simplify and paint a Ranger in Blender. Export a weighted model and hand-parented sword. Warm the skinned painterly shader. Compare against step 0.
3. Apply supplied animation clips through one rules-driven state machine. Rewrite the shoulder camera. Check blending, ground contact, hit-stop and reduced motion.
4. Play and capture at least ten full fights from entry using real input and no placement hooks. Record and reproduce every bug, test it red, then fix it. Add an entry-to-victory browser flow.
5. Build Wilds-only curved grass, GPU wind, foot response and distance fade. Match ground colours and measure fight performance.
6. Save playable sequence, a whole fight, three-light stills and blind scores. Run every final gate, commit and push.

## pstack execution checkpoint

- Blocking first steps. Read the current goal and source README. Build fixed piece shots before changing each piece. Verify each numbered step before the next.
- Independent workstreams. None are delegated. The goal permits only one fresh blind picture judge at a time.
- Shared mutable state. One builder owns the worktree, renderer, asset export and evidence. Existing source packs stay outside Git.
- Smallest safe decomposition. One implementation owner follows the numbered steps. Each player or grass review compares shuffled pictures against the previous build with the target reference alongside.

The Feature playbook is adapted to the explicit goal. `how` is performed locally over the renderer and rules. Parallel `architect`, delegated implementation, and a review fan-out are skipped because the goal forbids them. PR creation is skipped because brief section 2 forbids PRs. Verification and ordered commits remain required.

## Evidence and remaining work

- `lh doctor` passed on the Apple M5 Pro Metal GPU with no page errors.
- `lh shot wilds-player` and `lh shot wilds-grass` provide fixed cameras, seed 7, frozen clock, reduced motion and 2x region crops. Use `--theme day`, `--theme dusk` and `--theme rain`.
- Base checks passed. 897 unit tests, guard against `d447e42`, and all 30 `lh run wilds` checks.
- Capsule fight performance against `642cdc3`, two 15-second rounds at 1280 by 800, measured 60.0 rendered frames per second in both builds. Median GPU cost fell from 2.30 to 1.65 ms and draw calls from 35 to 20. One new-build run had a frame gap over 20 ms; median maximum gap was 25.1 ms. This is not a zero-stutter claim. Evidence is `.lh/out/2026-10-02T22-08-43-perf/perf.json`.
- The local preview now uses a separate Vite cache from `lh`. Simultaneous servers sharing the test cache caused shader source requests to return HTML during the first run. The isolated rerun had no page errors.
- Visual scores are not yet available. No piece has passed the new review rule.
- The player, motion, camera, combat audit and grass remain unfinished. The cat and Warden retain the old rough look deliberately.
