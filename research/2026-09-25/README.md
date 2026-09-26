# Little Hours: what we have, what we need, and what is worth using

**Research date:** September 25, 2026, Pacific time. **Baseline:** [`05e7426`](https://github.com/rynbol/little-hours/commit/05e742603075595e180c4639ac4c1b7236d843de), the fetched `origin/main` at the start of this work. This report is deliberately selective: it recommends things that fit the actual application, explains why attractive alternatives are unnecessary, and names the conditions that would change those decisions.

**Main recommendation:** keep Babylon, the original procedural room, and the existing deadline timer. Finish the timer's surrounding experience, make saves recoverable, and measure the real browser experience before buying complexity. The room already contains considerably more interaction and performance work than a generic cozy-game starter kit would provide.

## Read by area

**Follow-up:** [New branch work and exact package shortlist](follow-up-shortlist.md) records which recommendations are already implemented on the combined development branch and verifies specific package versions. Read this before treating the original gap list as current implementation work.

| Research | What it answers |
| --- | --- |
| [Timer, UI and accessibility](timer-ui-accessibility.md) | Timer internals and visible components, actual breaks, progress ring, duration settings, alerts, tasks, history, fonts, icons, motion, dialogs, popovers, keyboard and mobile use. |
| [Room, audio and assets](room-audio-assets.md) | Babylon features and profiling, geometry/lighting budgets, placement/navigation, avatars/pets, sound layers, concrete sound/material candidates, licensing and tools that fit original procedural art. |
| [Persistence, social and native](platform-social-native.md) | Backups, transactions, offline/PWA, accounts/sync, invitations/presence/visits, progression, privacy, service alternatives, and a later Mac companion. |
| [Quality and delivery](quality-delivery.md) | Browser tests, accessibility checks, performance/battery evidence, typed contracts, failure recovery, observability, deployment, and a small product pilot. |

The older [competitor map](../competitor-map.md), [web/social](../web-and-social.md), and [desktop/notch](../desktop-and-notch.md) reports remain useful context. They have their own check dates; this work does not silently refresh every earlier price or feature claim.

## Scope and evidence

Three Astra agents at medium reasoning researched separate areas, followed by a combined review against the code. Primary vendor/developer documentation, specifications and official license files support the external claims. Each detailed report links sources beside the relevant recommendation. “Adopt” is a recommendation, not a statement that a dependency was installed. Effort estimates are planning judgments, not quotes. Tools, assets and paid products were not comprehensively installed, auditioned or benchmarked.

Several development tasks were active concurrently: UI/timer design, whole-house design, house/garden behavior, avatar polish and item interactions. Their evolving worktrees were excluded from the baseline. **A gap below means missing or incomplete at the recorded commit; recheck current main before implementation.** This avoids declaring somebody's in-progress work absent or duplicating it.

The running baseline was visually inspected in a separate local preview, and its start → pause → reset controls were exercised. The countdown, changed button labels and local focus/break badge were observed. That is a narrow UI check, not a usability study, screen-reader assessment, mobile test or performance benchmark.

## What we already have—and should preserve

| Area | Implemented foundation | Main remaining need |
| --- | --- | --- |
| Engine and app | Babylon.js 9.27.1, Vite 8.3.0, plain JavaScript/DOM; no UI framework | Better module ownership as features grow; no engine/framework rewrite justified. |
| Timer arithmetic | Wall-clock deadline, pause/resume, reload recovery, nonnegative display, backward-clock cap | Stable session identities, explicit lifecycle and concurrency policy. |
| Timer surface | 25/50/90-minute presets, task text, changing labels, title/dock countdown, reset | Optional real break countdown, persistent completion surface, deliberate duration changes and alert preferences. |
| History and rewards | Completion records, today's minutes, one coin per completed focus minute | Event identities, richer history, recovery/export; history currently retains 365 records, not days. |
| Room art | Original procedural furniture, six design presets, palettes, wall decor, windows and surface variations | Consistent art review and reusable authored interaction metadata; expand deliberately. |
| Decorating | Collection, placement rules, wall placement, rotation/nudging, one-step Undo, invalid-drop handling | Accessible placed-item list, clearer gestures and selection; multi-step undo if user testing warrants it. |
| Character/pet | Avatar customization, working/resting routines, movement, pet interactions and reachability | Broader coherent interactions using the existing routine/navigation systems. |
| Atmosphere | Day/night/rain, lights, particles, animation, one synthetic rain loop | Small coherent ambient mix, restrained cues and persisted audio preferences. |
| Performance | Batching, shared resources, cached shadows, selective glow, adaptive pixel ratio, 30 FPS mode, hidden-tab suspension, reduced motion | Repeatable device measurements, load/context-loss recovery and regression limits. |
| House progression | Three authored rooms, extensions at 25 and 75 coins, free furniture/style changes | Test motivation after the second extension; do not assume more currencies help. |
| Persistence | Local JSON, normalization/migration, stale-tab rereads and failed-save warning | Recoverable/versioned export, transactional updates before richer sync. |
| Company | Honest local “in room / focusing / break” badge | Real authenticated availability, invitation permissions and occupancy later. |
| Compact view | An in-page mini view | Native desktop/notch is a separate later implementation. |
| Verification | Node tests, Babylon NullEngine harness, build and CI | Browser journey coverage, manual accessibility and physical-device evidence. |

## The timer deserves a real component plan

Treat these as a small coordinated system, not a decorative countdown dropped into the room:

| Component | Recommended implementation | Important behavior |
| --- | --- | --- |
| Time display | Existing deadline calculation, native timer semantics, tabular numerals | One source of truth; human-readable accessible value; no spoken update every second. |
| Progress | Original SVG ring or native progress element | Read-only, frozen when paused; visible words distinguish focus and break. |
| Duration selection | Native controls and existing presets; optional numeric custom field | Custom values also require restore/history/reward validation changes. |
| Primary action | One clear state-derived Start/Pause/Resume/New session button | Focus remains predictable when controls appear/disappear. |
| Reset/change session | Deliberate action with clear progress-loss meaning | Current paused duration change can discard partial progress; selected preset remains a no-op. |
| Breaks | Explicit session kind and deadline/remainder | Current “break” badge is pause/post-finish status, not a countdown. Breaks do not earn focus rewards. |
| Completion | Durable calm summary plus optional original chime | Credit once, announce once, offer break/next session; no alarm storm on reopening old work. |
| Alerts | In-app first; opt-in browser notifications as a trial | Permission denial works; browser closure/sleep cannot be promised as reliable local alarm delivery. |
| Tasks | Current task plus optional native “up next” list | Starting without a task stays possible; snapshot task at session start. |
| Journal | Plain history and an accessible seven-day summary | Explain completion date, retention and export; keep breaks and incomplete effort separate. |
| Settings | Secondary native panel/dialog; Floating UI only if placement is difficult | Settings do not crowd the first-session path. |
| Small-screen dock | Reuse current DOM/controller | Controls remain reachable with software keyboard and zoom; compact mode does not pretend to be native. |

The [timer deep dive](timer-ui-accessibility.md) supplies code anchors, sources and acceptance checks. A generic timer package would not resolve reward policy, saved-state compatibility, room interruption, or accessible feedback.

## Picky shortlist

These are recommendations under the present scope. Their primary sources, licensing details and alternative comparisons are in the linked reports.

| Need | Preferred choice | Verdict / reason |
| --- | --- | --- |
| Basic UI controls | Native HTML + existing CSS/SVG | **Adopt:** low integration cost, matches vanilla app, avoids a design-system migration. |
| Consistent extra icons | Selected Lucide icons | **Selective:** existing original icons already work; import only a needed subset. |
| Popover positioning | `@floating-ui/dom` | **Trial:** useful at viewport edges; positioning does not supply all accessibility behavior. |
| Larger reusable settings components | Web Awesome Core | **Conditional trial:** one isolated panel first; no blanket replacement. |
| Timer/state orchestration | Existing pure functions and explicit transitions | **Keep:** defer XState until transitions demonstrably outgrow this. |
| UI motion | CSS/Web Animations | **Keep:** defer Motion/GSAP until a specific complex sequence warrants them. |
| Fonts | Existing families, self-hosted WOFF2 if justified | **Trial:** predictable offline loading; preserve font notices; consider using fewer families. |
| Weekly focus chart | HTML table + CSS/SVG bars | **Build small:** defer a chart runtime for seven values. |
| 3D engine/art | Babylon + existing procedural models | **Keep:** improve the actual room instead of replacing it with unrelated packs. |
| Renderer diagnosis | Existing counters + Babylon tooling/Spector.js | **Use during development:** decide changes from measured draw/CPU/GPU evidence. |
| Sound engine | Small service around current Web Audio | **Adopt:** owns ambient layers, volume, cues and suspension; evaluate samples before adding a library. |
| Sound/material sourcing | Exact candidates in the [asset report](room-audio-assets.md) | **Audition/trial:** verify the individual asset's rights and fit; no bulk download recommendation. |
| Backup/export | Versioned JSON and recovery UI | **Adopt early:** portable user-owned homes are valuable before accounts. |
| Transactional storage | IndexedDB via `idb` | **Staged adoption:** valuable for multi-tab settlement and richer records; Dexie is the query-heavy alternative. |
| Offline installation | `vite-plugin-pwa` / Workbox | **Later trial:** verify selected release against Vite 8; plan safe updates during focus/editing. |
| Private friends/accounts | Supabase | **First proof-of-concept choice:** identity, durable data and occasional presence fit together; authorization still needs careful design. |
| More authoritative moving multiplayer | Colyseus or custom PartyKit room server | **Defer:** consider when simulation actually needs it; do not combine several room backends. |
| Collaborative decorating | Liveblocks | **Defer:** a different problem from owner-edited rooms with seated visitors. |
| Native Mac companion | SwiftUI + AppKit panel | **Later feasibility test:** public native window APIs, proper display geometry and energy checks. |
| Cross-platform desktop | Electron; Tauri conditionally | **Defer:** measure resource use; Tauri transparent macOS webviews have a specific private-API/store constraint. |
| Browser regression coverage | Playwright + axe integration | **Adopt:** complements existing logic/NullEngine tests. |
| Safer shared contracts | JSDoc + `checkJs` | **Bounded trial:** session/save/catalog types first; no whole-app language rewrite. |
| Production diagnostics | Local structured errors, later Sentry browser SDK | **Conditional:** exclude private task/room data; leave replay off initially. |

## Order of work

### Priority 0: protect the core session

1. Clarify paused focus versus timed break; retain the current deadline engine and already-tested recovery behavior.
2. Make completion persistent and comprehensible; add one optional chime and one announcement, with stable event identity.
3. Provide a persistent save status and versioned backup/export path. Make import and migration reversible before expanding saved data.
4. Verify keyboard/touch/zoom, timer availability when the renderer fails, and a few real browser journeys.

These should integrate with the active UI work, not create another competing timer design.

For concurrency, choose one coherent transition: a Web Lock can coordinate an interim localStorage implementation, while IndexedDB transactions are the recommended later persistence boundary. Do not install both approaches as independent owners of completion or rewards. Stable event IDs are useful in either design. Pausing currently earns no immediate reward, but resuming and completing earns the configured focus minutes; preserve that behavior unless the product policy deliberately changes.

### Priority 1: make staying and returning pleasant

5. Add a small audio service and audition a deliberately limited atmosphere palette.
6. Add optional tasks/history with honest accounting and quiet summaries.
7. Improve editor accessibility and discoverability; retain existing placement and navigation rules.
8. Capture consistent device/performance fixtures, then spend rendering budget on the details that matter at whole-room scale.
9. Stage transactional persistence once session IDs and the repository boundary are defined; avoid running parallel save systems indefinitely.

### Priority 2: validate expansion

10. Observe a small pilot through at least a return visit and the second house extension. Decide whether the room actually helps people start work.
11. Add offline launch and safe app updates after save recovery is solid.
12. Prototype optional accounts/cloud recovery, then invite-only read-only visits with authenticated identity, revocable access and truthful freshness.
13. Only then prototype the native companion against the same state model.

## Things I would decline right now

- An engine rewrite, React migration or large component suite solely to obtain common timer controls.
- A Web Worker as a supposed fix for countdown drift; the current persisted deadline already solves ordinary callback throttling.
- Public chat, voice/video, collaborative furniture editing, large social discovery or contact importing before private seated visits work.
- Per-frame networking for occasional study presence, or a presence payload treated as proof of identity or earned coins.
- A new crafting/shop economy before observing what happens after the existing two unlocks.
- Large photorealistic texture packs, mixed marketplace furniture styles, or raster images substituted for modeled furniture.
- More postprocessing or rendering systems without a measured bottleneck and comparable before/after frames.
- Calling a mini view a notch app, browser notifications a guaranteed closed-app alarm, or a clock completion verified productive work.
- Enabling replay, collecting task text, or tracking other applications to answer basic product questions.

These are scope decisions, not blanket judgments against the tools. Each detailed report names a condition under which a deferred option would become relevant.

## Next decisions and evidence gaps

The useful implementation questions are bounded: Are timed breaks part of the first release? Do custom durations need to ship now? Should pause/resume continue earning full completion credit, as it currently does? Which device is the minimum supported performance target? Should invited rooms close when the host leaves? Is App Store distribution a requirement for the eventual Mac app? None blocks the current research or the recommended save/UI groundwork.

No retention, willingness-to-pay, battery, accessibility-conformance, real-device touch, server-load or vendor-cost-per-user claim has been established. Third-party package sizes, release compatibility and individual asset rights should be verified at the exact selected version/file. Older saves must remain recoverable when applying any of this work.

See [verification notes](verification.md) for the checks actually performed on the baseline and this documentation change.
