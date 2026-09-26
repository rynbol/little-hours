# Little Hours interface

This pass treats the interface like a small personal journal: warm paper, dusty rose actions, sage progress, and a plum surround that leaves the room in focus. It changes app presentation, not the Babylon scene or avatar customization.

## What changed

- A consistent hierarchy across the app shell, focus card, room toolbar, utility panels and decorating collection. The desktop focus card is 290px wide (280px on smaller desktops), with a compact variant for short windows.
- A circular timer with explicit idle, focusing, paused and completed labels. Its ring follows the same wall clock as the existing timer, including pause/resume and restored sessions.
- Today's completed sessions, based on existing local history; a native completion dialog reports the actual earned coins. No rewards or timer accounting changed.
- A mobile header that stays available. Its timer button brings the focus card into view in one tap. A keyboard skip link also opens the focus controls from house, mini or decorating views.
- Anchored ambience, pet and quality panels with keyboard focus on their close control and Escape returning focus to the opener. The avatar editor retains its existing implementation.
- Decorating temporarily hides secondary navigation and utilities, keeping the room, selected-piece controls and collection together.
- Short spring feedback and small blossom/heart bursts on meaningful actions. Bursts are bounded, remove themselves, stop in hidden tabs, and honor reduced motion. There is no new animation loop or graphics dependency.

## Authored assets

`src/ui-art.js` draws the blossom, seed coin and sprout as inline SVG in JavaScript. `src/ui-feedback.js` animates interface elements using the Web Animations API.

The completion flower is original Blender geometry: a small ceramic planter, stem, leaves and five petals. Its editable source is `assets/blender/little-bloom.blend`; `assets/blender/little-bloom.py` reproduces it with Blender 5.2. The transparent 384px render in `public/ui/little-bloom.png` is about 90KB and displayed at 160px. It does not require another live 3D canvas.

```sh
blender --background --factory-startup --python assets/blender/little-bloom.py
```

House-specific design belongs to the parallel `codex/house-garden` work. This change leaves `house-ui.js`, `house-view.js` and the existing house style block unchanged. On integration, load that branch's `house.css` after `ui.css`. Room geometry/framing belongs to `codex/whole-house-redesign`; avatar customization is untouched.

## Validation

Node 24: `npm test` (113 passing), `npm run verify:room`, and `npm run build`.

Visible in-app browser checks used the separate save at `/checks/house.html` for timed sessions and rewards. Checked 50-minute focus after advancing 25 minutes (~50% ring), pause/resume, completion, 50 coins earned once, journal history after reload, reset, duration switching, room-design selection, day/night ambience, pet panel and Escape focus return, and rain on/off with conditional volume control. Reduced-motion fixture disables the new burst effects. Layouts inspected at 1440×900, 1280×720, 768×1024, 390×844 and 320×667; no document-width overflow at the phone sizes. No browser console errors during those checks. These are browser viewport checks, not physical iPhone touch testing.

The live Cloud loft quality panel reported 60 fps, 17.6 ms p95 frame interval, 3.3 ms p95 CPU rendering, 93 draw calls and 125,644 triangles at pixel ratio 1. These are observations on this machine, not a guarantee for other devices.
