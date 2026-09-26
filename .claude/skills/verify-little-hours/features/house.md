# House page (dollhouse)

The connected dollhouse: studio, garden wing and loft under one roof. It arrives closed and opens after about 0.65 s. With reduced motion it opens at once.

- Path: `#rooms-button` opens it; `#back-to-room` returns. `[data-house-open]` toggles open and closed. Hovering a room names it in `#house-detail h2`; clicking selects it; `#enter-house-room` travels there.
- Hook targets: `screenPoint({ houseRoom: 'garden' })`; `house()` gives open, closed, renderCount, activeRoomMotions and drawCalls.
- Flow: `lh run house`. Perf: `lh perf --view house --against main --rounds 4`.
- What breaks: the house rebuilding on every visit (open cost jumps from about 60 ms to over 250 ms); drawing while hidden (renderCount rises on the room page); a room hidden behind a wall so it cannot be clicked; the phone layout at 390×844.
