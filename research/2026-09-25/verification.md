# Research verification record

Checked September 25, 2026, Pacific time, against baseline `05e742603075595e180c4639ac4c1b7236d843de`. The change contains research documents and a link from the project README; application source and dependency manifests remain unchanged.

## Completed checks

| Check | Result and scope |
| --- | --- |
| Baseline and isolation | Fetched `origin/main`; used an isolated `codex/little-hours-research-2026-09-25` branch. Concurrent development worktrees were not modified. |
| Source inspection | Reviewed package/CI configuration, product direction, existing research and relevant timer/state/UI/room/house/character modules. Detailed reports use baseline-relative source anchors. |
| External research | Primary documentation, official project repositories, asset pages and licenses checked by the research team. The five substantive documents contain 95 distinct external URLs at the initial link audit. Sources and individual limitations appear beside recommendations. This is not a guarantee of future link availability. |
| Dependency installation | `npm ci` completed using Node 24.16.0 and npm 11.13.0. No new candidate dependency was added. |
| Unit/logic tests | `npm test`: **113 passed, 0 failed, 0 skipped**. |
| Room harness | `npm run verify:room`: completed with **“Babylon room checks passed.”** Includes scene, placement, animation, doors, reduced-motion and lifecycle checks in NullEngine. |
| Build | `npm run build`: passed. Main generated JS reported **1,520.82 kB / 406.02 kB gzip**, plus other shader/engine chunks. Vite emitted its existing large-chunk advisory. This is a build artifact size, not total page-transfer size or measured loading speed. |
| Visible app check | Separate local preview: inspected the whole-room/timer composition and exposed accessibility tree; exercised start → pause → reset and observed countdown/action/presence changes. Returned the research preview to idle. |
| Documentation integrity | Checked relative Markdown links and whitespace; reviewed recommendations for baseline/version boundaries and conflicting ownership of timer/audio/persistence. |

The NullEngine run emitted Babylon warnings about pet skeleton matrices exceeding its reported vertex-uniform capacity. The harness passed; this headless warning does not prove a real-device rendering defect or prove its absence. Actual GPU/device compatibility remains a browser/device test. Concurrent development checks were running, so no elapsed test time or preview frame cadence from this task is offered as a performance benchmark.

## Explicitly not established

- No third-party audio was auditioned, and no texture was visually approved for shipping.
- No candidate library or new backend was integrated or benchmarked.
- No accounts, paid services, asset purchases, production deployment or native package was created.
- No full screen-reader, contrast, physical-touch, battery, retention, penetration or server-load assessment was performed.
- No claim is made that the moving development branches still have every gap recorded in this fixed snapshot.

The individual deep dives describe their researchers' source-review scope. The tests and narrow browser check listed here were performed during final integration of those reports.

## Follow-up check

The later `follow-up-shortlist.md` compares the original baseline with local combined development commit `511728a5a23563129b01df4bb875493b1a296eec`, while a fresh fetch still showed `origin/main` at `05e7426`. Inspected relevant source diffs and branch documentation; checked six exact package versions using npm registry metadata and revisited the primary integration guides. Relative Markdown links and whitespace passed. No application or dependency files changed, so the unchanged app suites were not repeated. Earlier test counts apply only to the original baseline, not as validation of the combined development branch.
