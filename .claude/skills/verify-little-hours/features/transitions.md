# Cloud transitions

Every screen change (room, island, garden, pond and back) closes painted clouds over the view, swaps behind them and parts them. Reduced motion gets a short cross-fade instead.

- Path: `#rooms-button`, `#house-open-garden`, `#garden-back`, the pond tag, `#lake-back`, `#back-to-room`. All go through `travelTo` in `src/ui/place-transition.js`; the timing and cloud motion come from `src/ui/cloud-trip.js`, the WebGL clouds from `src/ui/cloud-veil.js`.
- Hooks: `html[data-place-transition]` is set while a trip runs; `.place-transition` carries `data-style` (`clouds` or `fade`) and `data-phase` (`closing`, `closed`, `parting`).
- Flow: `lh run transitions` (set `LH_TRANSITION_THEMES` and `LH_TRANSITION_FRAMES=<dir>` to save closing, closed and parting frames). Perf: `lh perf --view trips --against main`.
- What breaks: slow frames while the clouds move (the scene swap must stay inside the closed hold); keys pressed before the overlay is gone are swallowed by design, so tests must wait for `data-place-transition` to clear; clouds that do not match the day, dusk or rain sky.
