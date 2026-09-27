# House page (dollhouse)

The connected dollhouse: studio, garden wing and loft under one roof, with a garden of study trees beside it. It arrives closed and opens after about 0.65 s. With reduced motion it opens at once.

- Path: `#rooms-button` opens it; `#back-to-room` returns. `[data-house-open]` toggles open and closed. Hovering a room names it in `#house-detail h2`; clicking selects it; `#enter-house-room` travels there.
- Camera: drag left/right to turn (about -0.3 to 2.45 radians, so you can see the back), drag up/down to tilt (0.72 to 1.3). The home button (`#house-reset-view`) goes back to the start view. On touch, a vertical drag still scrolls the page.
- Garden: one tree per day you studied, the last 30 days (`src/core/garden.js`). 60 minutes in a day is a full-grown tree; less grows a shorter one. It is not the greenhouse plant. It is one batch (`house-orchard`) that rebuilds only when a day's minutes change.
- Hook targets: `screenPoint({ houseRoom: 'garden' })`; `house()` gives open, closed, renderCount, activeRoomMotions, drawCalls, angle, tilt and trees (each tree's growth, 0 to 1).
- Seeds: `three-rooms`; `garden-days` has 14 study days from 5 to 120 minutes.
- Flow: `lh run house`. Perf: `lh perf --view house --against main --rounds 4`.
- What breaks: the house rebuilding on every visit (open cost jumps from about 60 ms to over 250 ms); a new study day rebuilding the rooms as well as the garden; drawing while hidden (renderCount rises on the room page); a room hidden behind a wall so it cannot be clicked; the phone layout at 390×844; decorative copy coming back (the flow lists the hidden selectors).
