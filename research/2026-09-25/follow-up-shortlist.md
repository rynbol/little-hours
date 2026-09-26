# Follow-up: existing branch work and the next useful components

Checked September 25, 2026, Pacific time. This supplements the original report rather than rewriting its fixed baseline. Research only: no application implementation, branch integration, dependency installation or new performance benchmark.

## The baseline has two relevant states

After a fresh fetch, `origin/main` remained at `05e742603075595e180c4639ac4c1b7236d843de`. The local combined branch `codex/whole-house-redesign` is at `511728a5a23563129b01df4bb875493b1a296eec` and incorporates much of the parallel UI, house, interaction and wardrobe work. This is inspected branch code, **not a claim that it has merged or shipped**. Recheck refs before implementation.

The separate checkpoints inspected were UI `2e2a688`, house/garden `e305b42`, item interactions `1f6e0b0`, and wardrobe/door polish `64b62f0`. The combined branch has corresponding integrated changes, some with different commit IDs. These versions should inform implementation planning so the original research does not generate duplicate work.

| Original recommendation | New branch evidence | Updated decision |
| --- | --- | --- |
| Add a readable timer ring | `src/main.js`, `src/ui.css`: SVG ring follows the existing remaining-time calculation | **Already implemented on branch.** Review semantics and actual readability; do not add a timer-ring package. |
| Keep completion visible beyond a toast | `showSessionCelebration()` opens a labeled native dialog with actual earned coins | **Partially addressed.** Preserve the dialog; examine delayed completion during reload and interruptions before claiming the whole lifecycle is resolved. |
| Make completed sessions visible | `renderJournal()` shows today's total, count and up to twelve recent duration chips | **Partially addressed.** This is a daily view of the old records, not task-linked history, export or a weekly journal. |
| Improve focus access and panel behavior | Skip link, mobile focus navigation, initial close-button focus and Escape return | **Implemented in the UI pass.** Verify with assistive technology and physical touch; do not introduce a component suite to recreate it. |
| Add restrained UI motion | `src/ui-feedback.js`: finite Web Animations, cleanup, hidden-tab and reduced-motion handling | **Already has an appropriate native implementation.** No Motion/GSAP dependency justified by these effects. |
| Add player-directed cozy interactions | `item-interactions.js`, `moments-ui.js`: tea, watering, reading and resting, sharing existing room rules | **Already implemented on branch.** Add content using these seams; avoid a second interaction queue or navigation system. |
| Improve whole-house presentation | Open-floor/dollhouse views, bounds-based framing, room labels | **Implemented on branch.** Review visual and device behavior against this version before proposing another renderer. |
| Make house building more expressive | Furnished previews, naming drafts, before/after, surprise option, welcome effect and downloadable postcard | **Implemented on branch.** Revisit after actual use rather than adding new purchase mechanics. |
| Improve avatar and door flow | Separate wardrobe UI, curated looks, camera/lighting handling and shared doorway journeys | **Implemented on branch.** Keep wardrobe and travel interruption rules in the timer transition review. |
| Timed breaks, session IDs, richer persistence | `src/session.js` unchanged; `src/state.js` still has preset-only duration validation and date/minutes history | **Still open.** Pause/post-finish presence remains distinct from an actual timed break. |
| Layered audio and alert preferences | Existing synthesized rain remains; new UI disables its volume control while off | **Still open.** The presentation improvement does not create an audio mixer or completion chime. |

Evidence: [combined source snapshot](https://github.com/rynbol/little-hours/tree/511728a5a23563129b01df4bb875493b1a296eec), [UI notes](https://github.com/rynbol/little-hours/blob/511728a5a23563129b01df4bb875493b1a296eec/docs/ui-experience.md), [interaction notes](https://github.com/rynbol/little-hours/blob/511728a5a23563129b01df4bb875493b1a296eec/docs/item-interactions.md), [whole-house notes](https://github.com/rynbol/little-hours/blob/511728a5a23563129b01df4bb875493b1a296eec/docs/whole-house.md). Code was inspected locally at these commits; linked repository access depends on the reader's permissions. Browser/performance results in those notes are their authors' checkpoint observations, not reruns during this follow-up.

## Exact package candidates checked

These are the versions returned by the npm registry's `latest` endpoint during this check. Links below target the corresponding version metadata. License values are package declarations, not a complete transitive-license audit. Engine/peer compatibility is a preliminary filter, not proof that the package integrates correctly. No install recommendation means “upgrade everything to latest.”

| Package/version | Verified metadata | Selection for Little Hours |
| --- | --- | --- |
| [`@floating-ui/dom` 1.8.0](https://registry.npmjs.org/@floating-ui/dom/1.8.0) | MIT; dependencies on its core and utilities; no framework peer declared | **Keep as a reserve.** Existing panels are already positioned. Trial only if a reproducible clipping/anchoring problem survives a simpler CSS solution. |
| [`lucide` 1.48.0](https://registry.npmjs.org/lucide/1.48.0) | ISC; no dependencies or framework peers declared | **Optional icon source.** Keep the original blossom/coin/sprout identity. Use selected icons only when a needed symbol is missing or inconsistent. |
| [`idb` 8.0.3](https://registry.npmjs.org/idb/8.0.3) | ISC; no dependencies or framework peers declared | **Preferred transactional-storage candidate.** Introduce only with a migration/recovery plan and asynchronous command boundary. |
| [`vite-plugin-pwa` 1.3.0](https://registry.npmjs.org/vite-plugin-pwa/1.3.0) | MIT; Node `>=16`; Vite peer range explicitly includes `^8.0.0`; Workbox 7.4.1 ranges | **Compatible at the declared direct-version level** with Vite 8.3.0 and Node 24. This resolves the earlier unknown about declared Vite 8 support. Validate all installed dependencies and actual service-worker behavior before adoption. |
| [`@playwright/test` 1.63.0](https://registry.npmjs.org/@playwright/test/1.63.0) | Apache-2.0; Node `>=20`; matching `playwright` dependency | **Highest-value new development tool.** Node 24 satisfies its declared engine requirement. Browser installation and a small relevant suite remain required. |
| [`@axe-core/playwright` 4.13.0](https://registry.npmjs.org/@axe-core/playwright/4.13.0) | MPL-2.0; `playwright-core >=1.0.0` peer; `axe-core ~4.13.0` | **Pair with browser checks.** The package's declaration now explicitly resolves the original report's integration-license uncertainty. A clean scan does not certify the canvas editor or screen-reader experience. |

Floating UI's vanilla package provides positioning; the accessible interaction primitives discussed elsewhere on its site belong to its React package. Do not plan around React-only helpers in this app. [Official integration guide](https://floating-ui.com/docs/getting-started).

Lucide's vanilla guide confirms selective SVG use without a framework. Its current documentation includes a v0-to-v1 migration, so older copied snippets should be checked against the selected API rather than assumed compatible. [Vanilla documentation](https://lucide.dev/guide/lucide).

For `idb`, await transaction completion and keep unrelated network requests outside the transaction. There is no benefit in querying it on each animation frame. For PWA, integration includes manifest, registration, caching and update behavior; one package cannot define the product's recovery rules. [idb documentation](https://github.com/jakearchibald/idb), [PWA guide](https://vite-pwa-org.netlify.app/guide/).

## What I would actually pick next

### 1. Save recovery before a database replacement

Build a small **Your saved room** panel using native controls. Show whether the most recent write succeeded, offer a versioned JSON download, and let a user inspect an import before replacing their home. Preserve a recovery copy. Keep unknown future schema versions from silently becoming a fresh room.

This can begin without a new runtime package. Its acceptance cases are an interrupted write, invalid import, newer-version import, valid round-trip, and an expired session during export/import. Export should not itself alter rewards. Imported history cannot be used to reconstruct an existing wallet blindly because the current history is truncated.

### 2. Timer transition specification, then optional timed breaks

Use the new ring and completion dialog. Add a transition table covering start, pause, resume, reset, completion, duration change, wardrobe entry/exit, room travel and break start/end. Assign exactly one owner to reward settlement. An interrupted focus session that resumes should keep the currently established completion policy.

The first new functional component should be a labeled break duration selector and explicit break action, not another timer visual. Preserve legacy completed saves without inventing a running break. A separate phase field and session identity make this tractable; choosing a state-machine library first does not.

### 3. A small audio mixer using existing Web Audio

Extract the current rain owner, then add independent ambience and completion-cue volume, sound preview, persisted preferences and clear failure state. Keep natural recordings as candidates to audition, not preapproved shipping assets. Begin with the exact rain/fire shortlist in the [asset report](room-audio-assets.md). A short original synthesized chime can establish the completion contract without adding downloaded media.

Important product choice: rain may remain useful while the room is hidden, although rendering should stop. Audio background policy must therefore be explicit rather than blindly sharing the animation-suspension condition. Completion must not sound twice because two tabs notice the same deadline.

### 4. Browser journeys before more visual systems

Introduce Playwright with a handful of end-to-end journeys: start/pause/reload/resume; one completion reward and dialog; wardrobe pause/resume; travel blocked during focus; save-failure recovery; and keyboard access to timer/settings. Add axe scans after opening each relevant panel. Keep the existing Node tests and NullEngine harness.

The new UI means the first browser suite can protect actual polished features instead of validating a soon-to-be-replaced layout. Rendering comparisons need stable scene/time conditions; screenshots are not a performance measurement.

## Ready-to-use versus still needing evidence

**Ready to plan:** native UI components already in the branch, current deadline helpers, existing room action APIs, the package metadata above, a bounded browser-test suite and export schema design.

**Needs a small trial:** idb migration, audio lifecycle and actual sound audition, PWA activation/offline recovery, any popover that demonstrably needs Floating UI.

**Needs product/device evidence first:** extended progression after two rooms, advanced rendering effects, broader multiplayer, cloud service operating costs and native notch packaging.

There is now even less reason to add a large UI kit or animation library. The best next work completes and safeguards the original components that the newer branches already contain.
