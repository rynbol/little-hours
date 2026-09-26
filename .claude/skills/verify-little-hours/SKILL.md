---
name: verify-little-hours
description: Verify a Little Hours change in real Chrome with the lh CLI. Use after any change to the room, house, Decorate, avatar, pet, doors or timer, and before any commit that touches src/.
---

# Verify Little Hours

Drive the real app in Chrome with real mouse and keyboard input, collect evidence, and compare with main. Do not write one-off driver scripts; if `lh` cannot do something, add a step or flow under `scripts/lh/` instead.

## Steps

1. **Doctor.** `npm run lh -- doctor`. Every line must say ok. It checks Chrome, the GPU (Metal, not SwiftShader), scroll bars, the test hook and leftover browsers.
2. **Read the feature note** in `features/` for each feature the change touches. It names the user path, the flow, and what usually breaks.
3. **Drive.** `npm run lh -- run <flow...>` or `run all`. Exit code 1 means a check failed; read `.lh/out/<run>/report.json`.
4. **Evidence.**
   - Looks: `lh shot <view> --against main`, then open both PNGs and compare them yourself.
   - Speed: `lh perf --view <house|room|decorate> --against main --rounds 4`. Idle cost moves about ±10 ms/s between identical builds, so judge only differences larger than that and repeated across rounds.
   - Where time goes: `lh trace <cycle>`.
   - Leaks: `lh heap <cycle> --against main`. Early cycles grow while caches warm up; the verdict uses the second half.
5. **Clean up.** `npm run lh -- cleanup`. It stops only browsers and servers lh started.

## Rules

- Input is real: clicks, drags and keys go through Chrome's input pipeline. The `window.__littleHours` hook is for setup and reading state (`ready`, `settled`, `screenPoint`, `stats`), never for triggering the behaviour under test.
- Time and randomness are pinned (`src/test-pins.js`), so runs repeat. New game code gets time from `clockNow()` and randomness from `clockRandom()`; `npm run guard` enforces it.
- Never kill processes by port. Never touch browsers lh did not start.
- An art change needs a before/after shot shown to the user and their yes.
- Report the numbers you measured, including failures.

## Other tools

- `.mcp.json` adds chrome-devtools-mcp for poking at a page by hand (console, network, performance insights, memory). Use `lh` for anything that should be repeatable.
- The Playwright suite (`npm run test:e2e`) covers accessibility, backup and timer completion.
