# Growing house

The first home is the player's existing furnished room. A completed focus session earns one coin per minute: 25, 50 or 90 coins. The garden wing costs 25, and the upstairs hideaway costs another 75. Each extension starts with a chosen furnished design. Furniture, colors and design changes remain free.

`house.js` defines the three slots, prices and save validation. `state.js` settles expired sessions before a purchase, awards each completion once, and saves each house room independently. Old saves keep their current room and archived designs; recorded completed sessions receive coins once during migration. A stale decorating callback saves to its original room even if another tab changed the active room. This is a local prototype wallet, not a server-authoritative economy.

`house-model.js` authors a small model from the actual saved furniture positions, rotations and surface colors. It batches the grounds, rooms and next building site into at most four meshes with one material. The overview uses simplified furniture and architecture; entering a room shows the existing detailed models, pet and companion animations.

`house-view.js` renders only on entry, changes, resize or visibility restoration. It waits for shaders to be ready before going idle. Opening the house explicitly suspends the detailed room, and closing it disposes the overview engine and resumes the room. It adds no continuous work to a focus session and does not change detailed-room lighting or shadows.

## Verification

- All 98 unit tests, the Babylon room runtime checks and the production build passed. House coverage includes legacy migration, exact-once completion rewards, affordability and build order, duplicate purchases, same-design rooms with independent layouts, reloads, stale-tab editing and bounded model geometry. Runtime checks verify that suspension cancels room frames, theme changes cannot wake it, and entry resumes animation.
- The actual browser UI completed sessions with the isolated fixture clock, earned and spent 25 then 75 coins, and built all three rooms. Naming, decorating, changing rooms and reloading retained each room's contents. A pointer click on the garden model selected its panel at 2× density.
- At 390 CSS pixels wide, building and entering rooms worked without horizontal overflow. Forty-character unbroken house and room names also fit. Physical-device touch gestures remain untested.
- The completed three-room overview measured **4 draw calls and 22,044 triangles**, with **0 idle overview frames and 0 background detailed-room frames over two seconds**. Cloud Loft after returning from the house measured **60 FPS at 2× density**, with a 16.8 ms p95 frame interval and 1.6 ms p95 CPU scene submission. No browser errors were observed. These are local measurements, not a guarantee for every device.

The development-only `/checks/house.html` fixture uses its own sessionStorage save and clock controls. It never advances the player's real save. Vite's production entry excludes this page and strips the development hook. The build retains the existing large-chunk advisory.
