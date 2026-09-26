# Little Hours

A browser-first cozy room-decorating study game, built with Babylon.js and procedural JavaScript furniture.

![Little Hours: the room changes design, a focus session runs at night, a pouf is dragged to a new spot, the cat is petted, and daylight returns](docs/media/little-hours-film.webp)

## Run

Use Node.js 24.

```sh
npm ci
npm run dev
```

`npm run build` makes the production bundle in `dist/`; `npm run preview` serves it.

## Code

- `src/core/`: game data and rules (save state, focus sessions, layouts, the furniture catalog, the house).
- `src/models/`: Babylon.js furniture and room architecture.
- `src/features/<name>/`: one folder per feature. Other code uses a feature only through its `index.js`.
- `src/ui/`: shared page styles and helpers.
- `src/main.js`: starts the app.

`npm run guard` checks these boundaries in CI.

## Checks

```sh
npm test
npm run verify:room
npm run build
npm run guard
npm run lh -- run all      # drives the real app in Chrome
npm run test:e2e           # Playwright; first time: npx playwright install chromium
```

See `AGENTS.md` for the working rules and `docs/roadmap.md` for what comes next.
