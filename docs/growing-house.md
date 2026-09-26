# Growing house

The first home is the player's existing furnished room. A completed focus session earns one coin per minute: 25, 50 or 90 coins. The garden wing costs 25, and the upstairs hideaway costs another 75. Each extension starts with a chosen furnished design. Furniture, colors and design changes remain free.

`house.js` defines the three slots, prices and save validation. `state.js` settles expired sessions before a purchase, awards each completion once, and saves each house room independently. Old saves keep their current room and archived designs; recorded completed sessions receive coins once during migration. A stale decorating callback saves to its original room even if another tab changed the active room. This is a local prototype wallet, not a server-authoritative economy.

`house-model.js` and `house-furniture.js` reuse the procedural furniture, selected colors, rug stacking and saved positions. Sakura, Cloud and Metro use their actual architecture and window views; the original retreat styles still use a lighter cottage shell in the overview. Static geometry is batched per room. Only the occupied study station retains its animation rig; the full companion routine and pet remain in the detailed room.

`house-view.js` adds cached soft shadows and a small instanced mote effect. Animation is capped at 30 FPS, suspends when hidden, and goes idle with reduced motion. The detailed room is suspended whenever either house view is open. Disposing geometry snapshots the caster list so Babylon’s automatic shadow-caster removal cannot leave stale meshes behind when changing a preview.

`room-passages.js` adds a porch with two destination doors and stairs outside the editable floor. Built doors open on hover and navigate on a tap; unbuilt doors open the extension plan. The porch hides during decorating and the camera refits. Room buttons above the canvas keep decorating active across room changes, with each room’s furniture and surfaces saved independently. “See connected house” opens the whole home in the main stage. Choosing an extension design previews that furnished room without modifying the save or spending coins.

## Verification

- All 99 unit tests, the Babylon room runtime checks and the production build passed. Coverage includes migration, exact-once rewards, build order, independent room saves, geometry bounds and shadow-caster disposal. Runtime checks exercise physical door picking, hover animation, camera-drag rejection, hiding the porch during editing, and rendering suspension.
- The browser fixture earned 25 then 75 coins through completed sessions and built Cloud Loft and Midnight Metro. Entering the garden directly in decorating mode worked; a Mint wall change survived switching to the studio and back while staying in decorating mode, and persisted across reload. Design previews were inspected before purchasing.
- The two-room connected view measured **14 draw calls, 164,280 triangles and 60 frames over two seconds**, with **0 background detailed-room frames**. With reduced motion it drew **0 frames over two seconds** after settling. The completed three-room house measured **17 draw calls, 234,970 triangles and 60 frames over two seconds**, again with **0 background room frames**. These are local measurements, not a guarantee for every device.
- The connected house and navigation fit at 390 CSS pixels with no horizontal overflow; the browser check logged no errors. The preceding checkpoint also verified long names and 2×-density model picking. Physical-device touch gestures remain untested.

The development-only `/checks/house.html` fixture uses its own sessionStorage save and clock controls. It never advances the player's real save. Vite's production entry excludes this page and strips the development hook. The build retains the existing large-chunk advisory.

## House builder refresh — September 25, 2026

The house page now has its own `house.css`, a landscape with daylight/rain/night palettes, and a paper room builder. Six interior buttons preview the real room in place; before/after and surprise controls make comparing them reversible. Optional names and designs stay in per-slot drafts while the page is open or the player visits focus (drafts are not persisted on reload). A room purchase saves its cleaned name, furnished layout and coin deduction together. Existing save schema and prices are unchanged.

A successful build adds a short welcome note and 36 instanced petals in one draw call. Reduced motion suppresses the burst and camera easing. The turn buttons stay within the cutaway angles and refit the complete model. The planted border, blossom pots and bench share the existing static grounds batch. `house-postcard.js` creates a local 1600 × 1200 PNG, shown in a keyboard-dismissible dialog with a download link; preview rooms have a daydream caption. Blob URLs are released when replaced or disposed.

The house's “Make it yours” action also fixes an existing arrival ordering issue: the travel lock is released before entering the editor, so a different room can actually open in Decorate.

Validation on this branch:

- All 115 unit tests passed, including optional name persistence, repeated purchases, blank/long names and a focus session expiring at purchase. Runtime verification and production build are recorded with the commit; the build keeps the existing large-chunk advisory.
- Browser fixture earned 25 coins for a named Sakura garden, then 75 for a named Cloud upstairs. Both names, layouts and the spent balance survived reload. All six previews, before/after, surprise, locked upstairs guidance, draft names across design/site switches, room entry and the editor handoff were checked.
- Desktop at 1280 × 900 and phone at 390 × 844 were inspected; the phone document measured 390px wide with no horizontal overflow. Day/night house views and the completed-house postcard were inspected. The generated postcard image measured 1600 × 1200; its download link and Escape dismissal worked.
- The three-room welcome animation measured 18 draw calls, 236,334 triangles and 61 overview frames over two seconds, with zero background room frames. After reduced-motion camera changes settled, it drew zero overview and zero background room frames over two seconds. No browser warning/error logs were recorded. These are local measurements; physical-device touch remains untested.
