# The Wilds progress

## Resume here

Branch `codex/wilds`, created from `origin/codex/botw-look` at `13fc9ee`. M0 implementation, gates, independent code audit, and preliminary blind infrastructure review are complete. The M0 checkpoint is ready to commit and push. Confirm that its commit is present on origin/codex/wilds before starting M1. Read `docs/openworld-brief.md` and `design.md` before continuing. Never work on the island branches, use port 5420, or start Docker.

## Execution checklist

- [x] Read the Principles section of poteto-mode.
- [x] Phase A: Frame. Done means all nine items in brief section 7 proven on the pushed branch. Six boss encounters, six regions, at least eight landmarks, five pet species, one avatar, and three bench types need art and rules.
- [x] Phase B: Design the workflow. M0–M6 below are the release units. Verification comes before expansion.
- [ ] Phase C: Run the loop. Implement one milestone, run gates, capture evidence, pass the blind review loop, commit, push, then advance.
- [ ] Phase D: Keep the audit trail. Maintain this file and append decisions to `decisions.tsv` at each checkpoint.
- [ ] Phase E: Verify and hand back. Audit each section 7 item against current files, commands, images, and remote commits.

| Milestone | Status | Evidence |
| --- | --- | --- |
| M0 research, design, standalone scene, lh support | Verified checkpoint, ready to push | 642 tests; guard, room checks, build; 15/15 lh flow; 60 Hz empty scene; preliminary blind review |
| M1 world slice and Blender avatar/controller | Not started | |
| M2 combat and Mossback Warden | Not started | |
| M3 progression, economy, crafting, persistence | Not started | |
| M4 all five pets | Not started | |
| M5 Tidecaller, Rimehorn, Kiln Drake, Stormcrown, Hourless | Not started | Each finishes before the next starts |
| M6 feel, balance, performance, full flow | Not started | |

## Throughput checkpoint for M0

- Blocking first steps. Read the full brief and repository rules, inspect CLI integration, write research/design, install dependencies, run doctor.
- Independent workstreams. Lead researches and owns docs. An initial Sol worker inspected CLI seams before the goal update. Astra workers now own M0 code, an independent design review, and the review rubric in disjoint files. The lead owns design/progress and CI registration.
- Shared mutable state. Only the lead commits and pushes. Workers never edit a shared file at the same time. Worktrees isolate this run from the island. Worker edit ownership is explicit.
- Smallest safe decomposition. Keep the initial scene, test hook, and CLI integration under one owner because readiness and diagnostics form one contract. Lead reviews and runs gates independently.

## Decisions

- Use a pure rules layer plus Babylon adapters instead of mesh-owned combat. This makes fixed-clock fights and saved data independently testable.
- The standalone HTML check can import the existing test-hook installer. Game modules retain the main-only import restriction, and only the existing hook defines globals.
- Use an isolated check save key. The existing study save must not be overwritten by test seeds.
- No comparison to `main` can prove Wilds performance because `main` has no Wilds entry. Record the base room doctor's health separately and measure the new view directly.
- Owner authorized autonomous art iteration and milestone pushes. The verification skill's art approval suggestion is superseded by that explicit grant.
- The updated goal and brief supersede the earlier research model preference. All further workers and reviewers use Astra at xhigh. The user permits seven simultaneous workers; the active host supports three alongside the lead. Queue additional work within that host limit.
- Native worktree tool targets the chat's legacy repository. Created the worktree with git against the explicitly requested Little Hours repository instead.

## Evidence and gates

Environment confirmed Node 24.16.0 and Blender 5.2.1. `npm ci` succeeds with zero reported vulnerabilities. `npm run lh -- doctor` passes every line on the base, including ANGLE Metal on Apple M5 Pro, page readiness, hook, and no browser leftovers. All M0 gates now pass; authoritative outcomes are recorded below and in evidence/m0-gates.json. An earlier CI-registration mismatch was resolved before the final 642-test run.

## Known defects and remaining scope

Only the M0 empty scene exists. M1–M6 gameplay, world art, and Blender assets remain unbuilt. Design numbers are initial balance targets, not playtest results. Nintendo's Explorer's Guide was retrieved directly and its relevant PDF text read after the web reader timed out. The technology wiki fetch returned 403; indexed text and a retrieved partner-skill catalog support the unlock summary. The full GDC recording was not reviewed. Source limitations are recorded in design. Empty-scene screenshots and performance have been inspected; these do not prove populated-world quality. The goal is not complete.

## Blind review checkpoint

The updated section 6 applies from M1. The goal also requests milestone blind review, so M0 receives a narrowly scoped empty-scene review without claiming it satisfies finished-game art criteria. Each later review sees only the rubric and image evidence, never code, progress, notes, or earlier scores. All applicable lines need at least 8, or the exact three-nonimproving-rounds plus different-approach exception must be documented. A fresh reviewer handles every round.

## Completion evidence ledger

| Brief item | Required authoritative evidence | State |
| --- | --- | --- |
| 7.1 design and progress match | Read final rules, assets, scene and both docs | Incomplete |
| 7.2 command gates | npm test; npm run guard; npm run verify:room; npm run build on final tree | Pending |
| 7.3 full playthrough | lh run wilds real-input report including pet damage and all six victories | Pending |
| 7.4 performance | lh perf in six regions and all active boss fights; rendered frames, slow frames, GPU time | Pending |
| 7.5 Blender pipeline | wilds:assets clean regeneration and binary clip/rig tests | Pending |
| 7.6 world and art | At least five blended biomes, eight landmarks, six distinct bosses; day/dusk/rain shots | Pending |
| 7.7 invariants | Old-save/backup and coin tests; diff forbidden directories and friendship modules against 13fc9ee | Pending |
| 7.8 honest final notes | Weaknesses, cuts, first tweaks at end of this file | Pending |
| 7.9 blind review | Rubric plus fresh final reviewer of every region, landmark, character and boss | Pending |

Each milestone commit and remote branch SHA must match before the next milestone begins. The final audit checks the current tree, not an older green result.

## M0 independent design review

Astra review found two integration gaps, now resolved in design before gameplay implementation. Raw terrain height disagreed with the rendered coarse triangles by 1.009 m at (-899,-721) and 4.441 m at (1255,-1237). The design now names a shared final-triangle sampler and configurable camera-following rings. The state store replaces snapshots and discards unknown slices; M3 must add normalization and bind fresh-draft transactions instead of mutating an entry snapshot. Review also aligned perfect-dodge and invulnerability windows, made Tidecaller luring available to all species, specified attack hit times, and captured crafting-upgrade targets at start. Sequential boss XP matches the recommended levels without grinding.

## M0 validation

The lead reran the Wilds browser flow and all 15 checks passed, including actual background-tab suspension and both native mouse and keyboard remounting. The initial full suite passed 641 tests; room verification and production build passed. Plain guard initially failed with Git ENOBUFS because the inherited diff exceeded the default 1 MiB output buffer. A minimal 16 MiB buffer fixes the tool without changing its base or policies. A temporary-repository regression proves that a forbidden comment after a 1.2 MiB diff is still rejected. The lead rerun with that regression passes all 642 tests, and plain guard reports 333 files and zero problems. Room verification and build remain green on the same game source. The build retains its existing large-chunk warning; the NullEngine room checks emit existing skeleton-uniform warnings.

Negative checks also prove the new lifecycle tests catch a removed hidden-tab stop, and hook tests catch the original hook lacking Wilds support. Both experiments failed as expected, and temporary mutant copies were removed.


## M0 measured performance

Command `npm run lh -- perf --view wilds --rounds 2 --seconds 10` used headless Chrome on Apple M5 Pro through ANGLE Metal, 1440×1000 CSS pixels, scale 2. Shader warm-up precedes measurement. Raw results are in `evidence/m0-perf.json`.

| Round | Rendered frames/s | RAF frames/s | p95 frame gap ms | Frames over 50 ms | GPU frame ms | Draw calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 59.9622 | 59.8623 | 16.8 | 0 | 1.30 | 0 |
| 2 | 59.9676 | 59.8677 | 16.7 | 0 | 1.00 | 0 |

The measured display cadence is 60 Hz within finite-window counting precision. These are empty-scene results with zero triangles, not a claim about M1 or later. The existing CLI calls frame gaps over 50 ms slow. M6 still needs populated-region and active-fight evidence with the additional 20 ms count specified in design.

## M0 evidence

- `evidence/m0-gates.json` records commands and outcomes tied to a source fingerprint.
- `evidence/m0-flow.json` preserves the lead's 15 passing browser checks.
- `shots/m0-round-1/` contains the three `lh shot` captures and neutral manifest.
- `rubric.md` defines the blind loop, including missing-evidence failures and the brief's exact rule 7 exception.
- The game-source fingerprint excludes documentation, so review/progress updates do not change the tested source identity.

## M0 review disposition

The fresh blind review in `reviews/m0-round-1.md` found no material flaw in the limited static presentation and returned **Infrastructure checkpoint only**. All 15 finished-game criteria remain Pending for their planned milestones; no empty scene received fabricated art scores. The missing visible Enter/Leave sequence is an observation limit of the still package. Its behavior is independently established by the 15-check browser flow, including actual mouse and keyboard actions, disposal, and remounting. The mandatory numerical visual loop starts at M1, as section 6 specifies. Rule 7 has not been invoked.

An independent code audit found no M0 blocker, confirmed 333 files and zero guard problems against 13fc9ee, and verified protected sources and gold earning are unchanged. It inspected lifecycle, isolation, and measured-FPS tests. The lead separately ran the command gates, flow, performance, screenshots, negative checks, and final diff checks.

## Weaknesses, cuts, and next work

The current scene is intentionally empty. Nothing from M1–M6 is claimed complete. No required feature has been cut. Bow and gamepad remain optional work after mandatory features. Next, commit and push the verified M0 checkpoint, then split M1 among Blender avatar/loader, shared-world terrain/dressing, and pure movement/input/camera owners. The lead integrates the scene and expands the lh flow. Keep each worker's files disjoint and gate M1 with the full rubric.
