# Little Hours

A browser-first prototype of a cozy, whole-room study diorama. Working title only.

## Run

Use **Node.js 24** (recommended) and its bundled npm. Run these commands from the repository root:

```sh
npm ci
npm run dev
```

The development server binds to `127.0.0.1`. Open the local URL Vite prints. Run `npm run build` to create the production bundle in `dist/`, then `npm run preview` to preview it locally.

## Current prototype

- Original procedural 3D cutaway room, constrained orbit and responsive framing.
- Three atmosphere presets, plants / rug / fairy-light visibility, pet interaction.
- 25 / 50 / 90-minute focus sessions, pause, resume and reset.
- Wall-clock timer deadlines so background-tab throttling does not change elapsed time.
- Browser-local task, room preferences, active timer and completed-session history.
- User-activated synthesized rain audio with volume control.
- Mini view demonstrates a smaller room **inside this page**.
- Reduced-motion support, capped rendering rate and hidden-tab rendering suspension.

This is an early interaction and art-direction prototype, not a complete launched product. It has no accounts, cross-device sync, freeform furniture editor, multiplayer, native always-on-top window, notch integration or coding-agent integration. No competitor code, models or music are included. Room geometry and canvas textures are generated locally. Google Fonts is the only external presentation request; local fallback fonts work without it.

## Product research

Start with [the competitor map](research/competitor-map.md), then [web and social](research/web-and-social.md) and [desktop and notch](research/desktop-and-notch.md). Research was checked September 21, 2026. Official feature claims are not equivalent to hands-on verification.

The user's chosen direction is browser first, with a whole cutaway room visible like Rooms.xyz, then desktop/notch and optional friends. Virtual Cottage 2 is the main product benchmark under that framing; Rooms is the visual reference. The competitive opportunity remains a hypothesis to validate through actual sessions.

## Verification

```sh
npm test
npm run verify:room
npm run build
```

`npm test` runs **11 Node regression tests** for elapsed wall time, pause/resume and formatting; pause/reset at expiry; stale-tab edits and single completion accounting; next-day restoration; malformed saved state and null history entries; and continued use when browser storage writes fail. The tests exercise the production session and state-store helpers.

`npm run verify:room` runs **six room harness checks**:

1. Touch-action configuration and horizontal touch rotation.
2. Exact camera reset after drag inertia.
3. Whole-room framing at five aspect ratios and four orbit extremes.
4. Animated rain staying inside its culling bounds.
5. Still scene transforms and rain under reduced motion.
6. Hidden-tab suspension, single-loop resumption and complete disposal.

The harness imports the actual `src/room.js` and uses the installed Three.js geometry, camera math, raycasting and OrbitControls. It substitutes `WebGLRenderer` and browser DOM surfaces, so **real GPU rendering and native touch scrolling require separate browser checks**. Check those along with themes, decoration, pet interaction, mini view, audio, timer controls, refresh restoration and keyboard use in the running app.

[GitHub Actions](.github/workflows/ci.yml) runs dependency installation, both test commands and the production build on pushes and pull requests using Node.js 24.

## Proposed next milestones

1. Refine room art with the user; make camera composition and interaction satisfying at desktop and mobile sizes.
2. Introduce deliberate customization: several curated room layouts, furniture slots and saveable palettes before a general scene editor.
3. Validate repeat use with a small pilot. Measure time to first focus session, repeat completed sessions, and observed memory/frame/battery performance.
4. Add a native Mac companion using the same room and session state. A small room window and pet/timer beside the notch need native implementation and device testing.
5. Add private invite-only study visits with visible presence, synchronized optional timers, and explicit leave/block controls. Broader public discovery can follow proven demand.
