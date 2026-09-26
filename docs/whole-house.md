# A home you can see all at once

The connected home and house builder share a larger, responsive dollhouse view. **Open floors** unfolds the upstairs room beside the ground floor on wide screens, and above it on narrow screens. **Dollhouse** returns it to its real upstairs position. Room furniture, purchases, names, and saved coordinates do not change. The presentation starts open when an upstairs room exists.

The upper floor moves as a group, including its real furniture, illustrated window views, and occupied desk companion. Switching views interpolates existing transforms without rebuilding furniture. Reduced motion settles immediately. Camera turns and drag gestures stay on the two open sides of the home. A drag does not enter a room; tapping the model or its name chooses that room. The labels are keyboard-accessible buttons.

Camera framing projects cached bounds for individual authored pieces. This avoids the empty corners of the old house-sized bounding box. The detailed room uses 94% of its safe framing extent instead of 88% (about 7% larger), and the shared UI integration preserves a generous scene height. Avatar editing and furniture editing retain their own workspace sizes.

## Coordination

This branch integrates the house-building checkpoint (`e305b42`), UI checkpoint (`2e2a688`), item interactions (`1f6e0b0`), and wardrobe/door journeys (`64b62f0`). Saved avatar appearance follows the player into the whole-house view and builder. Wardrobe exits choose reachable floor positions so tea and other moments remain available. The house renderer preserves `turn`, `celebrate`, `createPostcard`, `setFocused`, `update`, and disposal. House-builder styles remain in `house.css`; renderer controls and spatial sizing are in `whole-house.css`. The final wardrobe stylesheet must remain after generic UI styles.

## Verification

- 125 unit tests passed, including real vertex projection across 36 combinations of aspect ratio, view angle, and floor opening. The test checks geometry containment, unchanged saves, stable mesh count, saved avatar appearance, and picking on the moved upstairs room. Wardrobe routing is covered across all six presets from desk, seat, and mid-walk starts.
- `npm test`, `npm run verify:room`, and `npm run build` passed. The production build retains the existing large-chunk advisory. Full room verification passed. Existing room-framing checks cover five aspect ratios and nine camera angles; maximum NDC extent is 0.929 (inside the 0.95 bound).
- Browser checks: unfolded/folded home, 320px and 390px portrait views, room-name entry, builder selection, wardrobe, room journeys, and postcard rendering. The full three-room home measured 17 draw calls and 232,734 triangles while animated (30 overview frames per second, with the detailed room suspended), or 16 draw calls and 230,334 triangles with reduced motion. Reduced motion settled to zero overview frames and zero background detailed-room frames over two seconds.
- The development-only `/checks/whole-house.html` uses an in-memory three-room demo save, with optional `?rooms=1` or `?rooms=2` for smaller houses. It never writes the player's localStorage. Its motion and measurement controls expose rendering behavior for browser checks. The fixture is excluded from production by Vite's normal single-page build.

Physical-device touch scrolling still needs hands-on testing. Browser frame rates depend on device and concurrent load.
