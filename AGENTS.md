# Little Hours

Build a browser-first cozy study room. Keep the whole cutaway room visible, like a miniature dollhouse; the user explicitly does not want a first-person camera. Desktop/notch and social features are later stages.

The product is becoming a room-decorating study game: editable preset rooms, a furniture collection, and study stations for the avatar. Model furniture deliberately in JavaScript with reusable procedural geometry. Avoid generated raster artwork as a substitute for furniture models. Smooth interaction is a priority: measure actual browser performance, batch static geometry, and avoid unnecessary rendering work.

The user wants a visibly animated room while preserving FPS. Reuse transforms and typed buffers; keep particles, moving foliage and effects within small draw budgets. Motion should read at the whole-room scale, with visible sky motes and occasional ambient events, while staying physically grounded: seated avatars keep their legs planted, and the sleeping cat uses restrained breathing and tail-tip movement. Honor reduced motion and suspend rendering in hidden tabs.

Use Babylon.js as the game engine. The visual direction is an expansive, fantastical and exceptionally cozy study retreat, with layered warm lighting and deliberately detailed furniture. The long-term vision is friends joining rooms to study and an expandable native notch companion showing friends' study presence. Keep that as product direction; current work prioritizes graphics and the solo decorating game.

The room and shared study presence are the core product. Make online availability, active focus and breaks visibly distinct. The notch is an optional extension of that same room/presence system, not a requirement for the website or friends feature. Current local timer status must not imply a live friends connection. See `docs/roadmap.md` for the plan and decisions.

## Development checkpoints

The user requests commits and pushes at meaningful checkpoints. After a coherent change, run the relevant checks, review the diff, commit it, and push the current branch. Use `codex/` for feature branches. Keep credentials, local user paths, generated bundles, and dependencies out of Git.

Use Node 24. Verification commands are `npm test`, `npm run verify:room`, and `npm run build`. For visual or interaction changes, also inspect the running app in the browser; the room harness uses Babylon NullEngine without a GPU and cannot prove visual correctness. Use the Codex in-app browser for visible testing and keep automated browsers headless. Open a visible external Chrome window only when a specific test cannot be adequately performed in-app or headlessly, and explain the need briefly.

Verify browser behaviour with the `lh` CLI (`npm run lh -- help`) and follow `.claude/skills/verify-little-hours/SKILL.md`: `lh doctor`, then `lh run <flow>`, then `lh perf` / `lh shot` / `lh heap` with `--against main`, then `lh cleanup`. Add missing steps or flows under `scripts/lh/` instead of writing one-off driver scripts. Use the in-app browser when the user wants to watch; keep `lh` headless unless a specific check requires a visible external browser.

A feature is done when it has a test. Every change to game code (`src/**/*.js`) ships in the same push with a unit test, Playwright test, lh flow or check that would fail without it; `npm run guard` enforces this, and a change that truly needs none says why in a `No-test: <reason>` commit trailer. CI runs guard, unit tests, the room harness, the build, Playwright and every lh flow on each push. In Claude Code, a Stop hook (`.claude/hooks/check-before-stop.sh`) runs the unit tests and guard on uncommitted changes and will not let the agent finish while they fail.

`npm run guard` runs in CI and enforces these rules:
- Game code gets time from `clockNow()` and randomness from `clockRandom()` in `src/core/test-pins.js`, never `Date.now()`, `Math.random()` or `new Date()` directly, so test runs repeat.
- Only `src/dev/test-hook.js` and `src/core/test-pins.js` touch the test globals; only `src/main.js` imports the hook, and it is left out of production builds.
- No new code comments. Name things so the code explains itself; put reasons in the commit message.

Preserve the distinction between the in-page mini view and future native desktop/notch integration. Use original assets and implementation.

## Gotchas

- Load `house.css` after `ui.css`, and `wardrobe.css` after the general UI styles.
- Keep the portrait branch of `fitRoom` when changing the room framing; the wardrobe uses it.
- A house rebuild keeps each room that did not change (`createHouseModel`'s `previous` argument). Batch new house parts the same way.
- The pages in `checks/` use their own test saves and are not in the production build.

Read the code and tests for how things work; there are no per-feature docs.
