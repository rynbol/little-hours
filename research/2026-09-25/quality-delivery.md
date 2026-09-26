# Quality, architecture, measurement and delivery

Research checked September 25, 2026, Pacific time. Source baseline: `05e742603075595e180c4639ac4c1b7236d843de`. This is a recommendation document, not a record of implementing the tools below. External capabilities were checked against primary documentation; proposed thresholds are our starting targets, not measured results.

## What is already here

- `package.json` has one production dependency, Babylon.js `9.27.1`, and Vite `8.3.0` for development. The project uses JavaScript modules and native DOM controls. Preserve that small surface unless a measured problem justifies another dependency.
- `.github/workflows/ci.yml` runs installation, Node tests, the production-room NullEngine harness and a build on Node 24. The current checks are valuable. A new test runner is not needed to replace the existing unit suite.
- `src/session.test.js` already covers deadline arithmetic, sleep/throttling, pause/resume, backward-clock capping, completion accounting, malformed saves, storage failure and sequential stale-tab updates. More tests should target missing behaviors rather than repeat these.
- `scripts/verify-room.mjs` exercises production scene behavior without a GPU. It can catch geometry/state errors; it cannot judge a beautiful room, GPU speed, touch feel or screen-reader usability.
- `src/main.js:258` catches room-construction failure and leaves an explanatory message with the focus timer available. Keep and verify that graceful failure behavior.
- `src/room.js:1545` reports frame timing, CPU submission, draw calls, triangle count and pixel ratio. The code explicitly distinguishes CPU submission from GPU execution. Preserve that honesty in any dashboard.
- `src/main.js` is 1,051 lines and combines markup, timer rendering, avatar editing, house travel, audio, storage responses and panel state. `src/room.js` is 1,614 lines, while `src/furniture.js` is 1,877 lines. Size alone is not a defect, but these boundaries make independent feature work harder.

## Tool shortlist

Effort: **S** = bounded change within an existing module; **M** = a subsystem plus integration and verification; **L** = a multi-stage project. These are relative estimates, not delivery promises. “Adopt” means recommended next work, not installed by this research.

| Candidate | Verdict / effort | Concrete fit | Constraints and license evidence |
| --- | --- | --- | --- |
| **Playwright Test** | **Adopt, M** | Browser flows across Chromium, Firefox and WebKit; reloads, multiple tabs, permissions, keyboard paths and viewport changes. | No application framework requirement. Development-only. Apache-2.0 [license](https://github.com/microsoft/playwright/blob/main/LICENSE). Browser binaries and CI execution cost remain. |
| **Playwright Clock** | **Adopt with timer tests, S** | Exercise 25-minute completion, pause, resume and a next-day reopen without real waiting. | Can override Date, timers, animation callbacks and performance clocks; install before app initialization. Never use fake-clock runs as FPS evidence. [Clock documentation](https://playwright.dev/docs/clock). |
| **Playwright visual comparisons** | **Trial, M** | A small stable set of room compositions and timer/panel states, including narrow screens. | Fixed browser/OS/viewport/fonts/seed/state required; GPU images vary across environments. Compare stable frames, not uncontrolled pets and motes. [Visual comparisons](https://playwright.dev/docs/test-snapshots). |
| **axe-core with `@axe-core/playwright`** | **Adopt, S–M** | Scan each opened panel, timer states, errors and dialogs for detectable DOM accessibility problems. | Framework independent; automation does not replace manual assessment. Core is MPL-2.0; examine package notices when adding the integration. [Integration](https://playwright.dev/docs/accessibility-testing), [core license](https://github.com/dequelabs/axe-core/blob/develop/LICENSE). |
| **JSDoc + TypeScript `checkJs`** | **Trial, M** | Type the shared save/session/layout/catalog contracts while retaining `.js` and Vite. | Start with a bounded group of modules; avoid a repository-wide suppression exercise. Build-time only. [JS adoption guide](https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html), [license](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt). |
| **fast-check** | **Trial after save-schema work, M** | Generate malformed saves and sequences of pause/resume/reset/complete/import operations, then shrink failures. | Use domain invariants, not copies of implementation formulas. MIT; current documented Node requirements fit Node 24. [Project and compatibility](https://github.com/dubzzz/fast-check). |
| **Size Limit (`@size-limit/file`)** | **Trial, S** | Enforce a reviewed increase limit on built initial JS/CSS and total lazy assets. | Vite already prints sizes; a small script is enough initially. This tool is MIT and supports an existing bundler's output. Bytes do not establish runtime speed. [Official repository](https://github.com/ai/size-limit). |
| **`PerformanceObserver` / Long Animation Frames** | **Trial, S** | Explain main-thread stalls when opening a collection, placing furniture or changing the house view. | Feature-detect entry types; support is not universal. Long-frame entries complement existing counters; they are not GPU timings. [Observer](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver), [Long Animation Frame timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming). |
| **`web-vitals`** | **Defer until a real pilot, S** | Measure entry-page responsiveness/loading and layout stability for real sessions. | Useful alongside game measurements. It cannot tell whether a cat animation is smooth or an entire session drains the battery. Apache-2.0 [project](https://github.com/GoogleChrome/web-vitals). |
| **Sentry `@sentry/browser`** | **Conditional pilot, M** | Production errors with build identifier and coarse device/browser context. | Plain JS supported, SDK MIT. Hosted service pricing/retention are separate and not selected here. Start error-only with deliberately restricted payloads. [Official SDK](https://github.com/getsentry/sentry-javascript). |
| **Session replay and canvas recording** | **Defer** | Potentially explains hard-to-reproduce issues. | Poor default fit for a private study room containing task text and personal room names. Diagnostic value and data exposure must be evaluated before enabling. Sentry's [privacy FAQ](https://www.sentry.help/en/articles/13964404-session-replay-faq-web) describes default masking; do not assume masking makes any payload safe. |

Do not add Jest/Vitest merely to obtain a familiar test API. The existing Node runner covers the logic seam. Likewise, a React/Next.js migration is not necessary to get browser tests, typed contracts, popovers or a timer dial.

## Verification that answers the actual risks

### A. Timer and persistence

Add a small browser journey suite around outcomes users can observe:

1. Start, reload, pause, reload, resume and complete exactly once. Check remaining time, history and coin result together.
2. Cross midnight, reopen the next day and change time zone. Define the intended attribution rule explicitly rather than silently letting the device's new zone reinterpret an old event.
3. Open two real tabs and interleave actions. The existing unit test uses sequential calls into two stores; that does not establish transactional concurrency safety.
4. Deny/quota-fail storage. Current-visit controls must work; the warning must clearly distinguish “working now” from “saved for later.”
5. With WebGL unavailable, complete a timer journey. Then simulate context loss after a working room is created: no destroyed save, no duplicate reward, recoverable presentation state.

The browser exposes [`WEBGL_lose_context`](https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context) for simulated loss/restoration where available. This is a useful failure-test mechanism, not something to run against a user's unsaved session. Babylon may handle underlying resource recovery; the app still needs a coherent loading/recovery message. [Context-loss event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event).

### B. Controls, focus and touch

Verify a whole useful session with keyboard only. Open and close every panel; focus must return to a sensible trigger. Escape should cancel the current action predictably, and shortcuts must not consume typing in the task field. At 200% zoom and a narrow width, start/pause, duration and task controls remain reachable. Do not call the 3D editor accessible merely because surrounding buttons have labels: offer a DOM list of placed items with select, move, rotate, recolor and remove actions, subject to the same placement rules.

Use WCAG 2.2 as the design reference, including visible focus, dragging alternatives, target size and contrast. Automated results are only one source of evidence. Test VoiceOver/Safari and at least one Windows screen-reader/browser combination with actual people when feasible. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Touch needs physical-device testing. Pointer simulation does not establish whether vertical page scrolling fights room orbiting, a carried pet blocks a gesture, the software keyboard covers the timer, or the device becomes hot. Test portrait and landscape, one-handed taps, a canceled gesture, an interrupted app and a long focus session.

### C. Rendering, loading and battery

Use a recorded fixture: commit, browser, OS, device, viewport, DPR, preset, piece count, lighting, quality mode and warm-up duration. Include a furnished room, the maximum supported crowded room, decorating and a house transition. Run a longer steady-state sample rather than using a single one-second overlay reading.

Proposed acceptance policy:

- On an agreed reference desktop, preserve the current intended 60 FPS mode and report p95 frame interval; measure against its baseline rather than advertising universal 60 FPS.
- Save energy should maintain regular 30 FPS cadence when animating. Reduced motion should settle and draw on demand. Hidden scenes should stop rendering.
- Track visible scene counts and memory trends after repeated enter/exit/decorate cycles; retained caches may legitimately remain, but growth should plateau.
- Compare a representative focus session on battery using a repeatable OS-level procedure. A frame cap alone is not proof of lower energy consumption.
- Record initial transfer, usable timer time and room-ready time separately. A room-loading regression must not make the focus controls wait unnecessarily.

Do not gate every pull request on a flaky shared-runner FPS threshold. Use deterministic logic/DOM checks in CI and scheduled or release-candidate measurements on known hardware. The existing historical performance notes are evidence of previous checkpoints, not a benchmark of this research snapshot.

## Incremental architecture worth doing

Extract by ownership when changing the relevant feature:

- **Session controller/view:** pure transitions remain separate from DOM rendering. Subscribe once and update only changing text or controls.
- **Audio service:** owns context lifecycle, layers, volumes and cues; no second competing rain engine.
- **Persistence boundary:** exposes structured save outcomes, migration/version handling and export/import, later transactions and sync.
- **Panel manager:** owns open/close, focus return, Escape and cleanup; room controls stop each inventing their own behavior.
- **Interaction definitions:** catalog describes available actions; room dispatches them; avatar routines consume the same reachability/interaction information.
- **Diagnostic adapter:** local structured errors first, optional remote delivery later; no task contents in generic logs.

Avoid a new global event bus or state-machine dependency until the simple module contracts are explicit. For shared events, document who can emit them, who persists them and whether retries are safe. No component should increment coins merely because it rendered a “complete” state.

## Delivery, operations and dependency selection

Keep deployment static while it is a browser-only local-save application. Vite builds to `dist`; its preview server is for local inspection, not a production service. Choose a managed static host based on existing ownership, preview URLs, headers and rollback support, rather than adding a backend for deployment alone. [Vite deployment documentation](https://vite.dev/guide/static-deploy.html).

When deployment is selected, verify HTTPS, appropriate caching of fingerprinted assets, revalidation of entry HTML, a working asset base path and rollback of a release whose save schema is newer. An older executable must not overwrite a save format it cannot understand. Content Security Policy should be tested with the actual renderer, shaders, workers, fonts and audio; copying a generic policy can break the room. Self-hosting fonts reduces one external dependency, but does not itself make an offline app.

For each dependency added, record: exact locked version, direct purpose, runtime versus development use, framework assumptions, shipped size change, license/notice path, teardown behavior and the no-library fallback. Inspect release notes and selected-version requirements at adoption. Reading an active documentation site is not a maintenance guarantee. This report deliberately avoids unverified package-size and “latest version” claims.

## What to learn from a small pilot

The first question is whether the room makes it easier to begin and return to meaningful work. Proposed pilot measures: time to first started session, completed sessions on a later day, percentage that find pause/resume, voluntary use of decoration, storage failures and sessions disrupted by performance. Observe a few sessions before introducing a broad analytics platform.

Do not collect task text, room names, screenshots, friend identities or precise personal schedules to answer those questions. Aggregate minimal events only after the collection purpose and user-facing disclosure are clear. Keep “started a timer” separate from “did productive work”: the application cannot measure the latter from a countdown. A local prototype's coins are encouragement, not evidence of effort or an anti-cheat system.

Suggested next deliverable: a browser smoke suite, a short manual accessibility/device checklist, a versioned-save export design and three recorded performance fixtures. These make the timer and room trustworthy while the art and UI continue to evolve.
