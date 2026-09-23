# Room game architecture and performance

## Decision

Use **Babylon.js** as the game engine for this browser-first room game, with JavaScript-designed furniture. Babylon supplies the engine, scene graph, camera input, mesh picking, animation facilities and rendering. The application supplies the catalog, placement rules, room presets, selected study station, and persistent room/session state. See the [official game engine overview](https://www.babylonjs.com/games/).

This suits the current scope—a cutaway room, a seated avatar, furniture placement and focus sessions—and gives future game systems a consistent engine. The room remains authored in code. Blender and a visual engine editor are optional future tools rather than prerequisites for creating or changing a furniture item.

Engine choice and art direction are separate decisions. Furniture uses crisp, deliberate low-poly silhouettes and modeled details. Performance still requires measuring bottlenecks, reducing drawing work, limiting expensive lighting, and reusing resources. See [Babylon.js optimization guidance](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/scene/optimize_your_scene.md) and [PlayCanvas performance guidelines](https://developer.playcanvas.com/user-manual/optimization/guidelines/).

## Furniture design

Furniture is modeled from JavaScript geometry with intentional dimensions, silhouettes, joinery, cushions, books, and small decorative details. A catalog item owns a footprint used by the placement system, so its visual shape and collision rules must agree. Study desks include their chair and avatar position as one movable station. The avatar belongs to the selected study station.

The expanded fantasy room has more than twice the original floor area, with an arched window, climbing greenery, a hearth, lamps and layered textiles. The initial collection is freely available in the prototype. There are no purchases or payment flows. Curated presets are editable starting points; changing a preset should remain reversible through Undo.

## Baseline

Measured from commit `8a70059` in the Codex in-app browser in a 1280-pixel-wide viewport, device pixel ratio capped at 1.5. Instrumentation wrapped the existing renderer without changing its frame scheduling. Values below are one observed three-second window after initial load, not a cross-device benchmark.

| Measurement | Original room |
| --- | ---: |
| Scene meshes | 362 |
| Scene triangles before shadow duplication | 81,084 |
| Rendered frames per second | 25.5 |
| Rendered frame interval, p95 | 42.1 ms |
| CPU render submission, p95 | 3.0 ms |
| Renderer draw calls, including shadows | 720 |
| Renderer triangles, including shadows | 162,160 |

The original loop attempted to cap rendering at 30 fps by skipping browser animation callbacks. Resetting the frame timestamp on each render caused irregular cadence. The scene also used many independent meshes and recomputed a 2048 × 2048 shadow map each frame.

CPU render submission measures JavaScript time spent calling the renderer; it is not GPU execution time. The frame interval includes browser scheduling. Neither metric establishes battery life or performance on other devices.

## Expanded Babylon room checkpoint (`4a6f80b`)

The fully furnished Ember library was inspected in the production build at a 1280 × 720 viewport. One warm sample from the visible Performance panel reported:

| Measurement | Expanded Ember library |
| --- | ---: |
| Furnishings | 20 |
| Rendered frames per second | 60 |
| Rendered frame interval, p95 | 17.5 ms |
| CPU render submission, p95 | 1.9 ms |
| Draw calls | 95 |
| Active indices divided by three | 196,026 |
| Render pixel ratio | 1.00 |

This is a scene checkpoint, not an isolated engine benchmark: the scene, effects, renderer counters and pixel ratio differ from the original baseline. During interactive development checks, some windows fell to 46–55 fps with frame-interval p95 around 25–42 ms. The earlier, smaller Babylon room reached 60 fps with 51 draw calls; the expanded architecture and selective glow deliberately spend some of that rendering budget on richer artwork.

The runtime batches static geometry, shares furniture assets, caches a 1024-square shadow map and uses a fixed 512-square selective glow buffer. Adaptive quality reduces pixel ratio after sustained slow samples; Save energy caps the loop at 30 fps and disables glow. Hidden tabs suspend rendering. Reduced motion uses on-demand rendering and does not mistake intentional idle time for poor frame rate. The build currently has an approximately 311 KB gzipped main JavaScript chunk plus lazy engine shader chunks.

Browser checks covered all three room designs; valid placement and overlap rejection; rotation, movement, removal and Undo; save restoration; changing the avatar's study desk during a running session; rain, pet and mini-view controls; and a 390-pixel viewport without horizontal overflow. The final automated checkpoint passed 25 logic tests, seven native NullEngine verification groups and the production build. Physical mobile GPU, touch and battery tests remain future validation.

## Verification approach

Use the visible Performance panel to measure the running game after shader warm-up. Compare at the same viewport, quality, atmosphere and preset, with only the relevant tab foregrounded. Check normal study mode, active furniture placement, a populated room, and a narrow viewport. Also verify that hidden tabs suspend rendering and reduced-motion settings are respected.

Automated room checks exercise engine geometry, camera math and room rules without a GPU. They can check bounds, placement, lifecycle and drawing complexity, but actual browser rendering must be inspected separately.

## Animation and FPS work

Ambient animation reuses existing avatar and cat transforms. Seven fire flames share one dynamic mesh; moving them adds no triangles. Each cup's tea steam uses a single 56-triangle ribbon mesh. Dynamic effects update retained typed buffers, and furniture settles using a short scale interpolation without changing saved positions. Reduced motion resets the scene to neutral poses.

Pointer hover is processed at most once per render callback and skipped while orbiting. Placement previews only intersect the mathematical floor; nearest-object picking happens when clicking. Glow receives an explicit list of emitting meshes, avoiding preparation of unrelated scene meshes. Rain reuses a position buffer and fixed bounds instead of rebuilding a line system and bounds each frame. Steam is excluded from picking, shadows and glow. Adaptive quality yields resolution after sustained samples below 55 fps, and the timer avoids rewriting unchanged UI.

The additional ambient pass gives each plant/tree one moving canopy mesh and each record cabinet one rotating disc. Each hanging lantern uses two batched meshes and pivots from its fixed attachment. Clock hands and the pendulum animate through transforms. These motions continue during breaks, with pots, trunks and mounting points remaining fixed.


## Living-room animation pass

Miso no longer receives the cached room shadow map. A comparison at the same home camera showed a cleaner animated silhouette without the dark mottling from sampling its own older shadow. The cat still casts onto its rug. A second controlled GPU comparison found the same self-shadow acne as repeated diagonal bands across untextured floorboards. Raising the existing shadow depth bias from 0.0005 to 0.002 removed the bands while preserving grounded furniture shadows, with no extra draw work. Its grounded pose and restrained breathing remain separate from this rendering fix.

Fireplaces emit sixteen rising, fading embers from one mesh. Each ember has two crossed diamond faces so it stays visible at every furniture rotation and camera angle; the batch uses 128 vertices and 64 triangles. A cached glow list retains temporarily hidden motion effects, fixing the case where editing during reduced motion previously left embers without glow after motion resumed.

The avatar's upper body leans from the hips while its legs remain planted. Typing/writing alternates with thinking pauses, with forearm endpoints tracking the hands. Existing sweater and arm vertices share one retained deformation buffer per desk; static body parts and materials stay shared.

Forty-eight warm motes and twenty stars use two instanced batches with retained matrix buffers. Motes are larger than the earlier ambient dots and twinkle slowly, while stars drift inside the window arch. Three moths share a 36-triangle mesh with articulated wings and slow flight paths. A two-triangle shooting star crosses the window for 1.6 seconds every fourteen seconds, starting three seconds after the room opens. Both new effects skip picking and cached shadows; reduced motion hides the moths and shooting star, returns other motion to rest, and restores steady hearth lighting.

### Final observed samples

Production preview, Ember library, dusk, 1280 × 720 viewport at browser device pixel ratio 1. These are warm samples after the screenshot capture stopped, with the scene visible.

| Measurement | Adaptive | Save energy |
| --- | ---: | ---: |
| Rendered frames per second | 60 | 30 |
| Frame interval, p95 | 17.1 ms | 34.3 ms |
| CPU render submission, p95 | 1.1 ms | 0.9 ms |
| Draw calls | 123 | 105 |
| Active indices divided by three | 203,546 | 172,710 |
| Render pixel ratio | 1.00 | 1.00 |

The brief shooting-star effect adds its small draw while visible. These measurements cover one browser/device and scene; they do not prove universal 60 fps. Frequent screenshot capture can itself interrupt frame scheduling, so its intervals were not used as the warm sample. The normal narrow-screen check at 390 × 844 kept the full room framed and reported document width equal to viewport width.

The final code passes 33 unit tests, thirteen native NullEngine verification groups, and the production build. Browser checks separately compared cat/floor shadows, observed the new particle and moth motion over multiple frames, exercised focus/reset and both performance modes, checked a narrow viewport, and found no production-page console errors. The main JavaScript chunk is approximately 318 KB gzipped plus lazy shader chunks; Vite still reports its size advisory.


## Seated avatar and camera refinement

The avatar now has a profiled knit torso, rounded shoulder/elbow joints, and tapered sleeves. Both sleeve segments share elbow anchors above the tabletop; wrists follow the hands while the legs remain planted. The previous elbows were below the desk surface, which hid the connecting geometry and made the forearms appear detached. The single upper-body mesh now updates retained position and normal buffers together so its lighting follows each pose, without adding draw calls.

Focus begins with a short settling motion into typing or writing, followed by trackpad use and thinking pauses. Typing taps lift the hands by at most 2.4 cm. Pausing rests the hands; reduced motion restores the exact neutral geometry and normals. An eleven-second sampled test checks both arm joints and desk/laptop clearance across the full cycle, alongside hidden-avatar and shared-asset checks.

Miso breathes on a 4.8-second cycle with a shorter inhale and longer exhale. The upper flank rises up to 7.5%, with the belly anchored and the head, paws and tail base remaining planted. Fur and stripes share one transform. The cat still avoids sampling the stale cached self-shadow that caused its earlier pixel artifacts.

Camera azimuth now spans 10°–80° instead of roughly 32°–70°. Elevation spans 15°–67.5° instead of roughly 25°–50°. Automatic orthographic framing is checked at nine angles across five aspect ratios. The original home view, inertial reset, and fixed camera distance remain.

This checkpoint passes 34 unit tests, thirteen runtime verification groups, and the production build. The main JavaScript chunk is approximately 319 KB gzipped plus lazy shader chunks. Browser checks inspected the working loop across captured frames and both new camera extremes, then verified Reset restores the original composition. In the current Writer’s loft at a 966 × 1044 viewport, one warm Adaptive sample reported 60 fps, 17.5 ms frame-interval p95, 2.3 ms CPU-render p95, 126 draw calls and a 1.50 render pixel ratio. The preview had no captured console errors. These are observations on this browser/device, not a cross-device FPS guarantee.


## Daylight and night

The header sun/moon button switches the saved room atmosphere between Daylight and Night; Atmosphere also retains Rainy afternoon. Existing saved `dusk` values map to Night, so this refinement needs no storage migration and does not change the furniture layout or timer.

Daylight changes the actual directional and ambient lights, sends sunlight from the window side, softens local lamplight/glow, and paints a blue sky with clouds and greener forest layers. Night uses a deep blue sky, a softly glowing moon, stars and warmer local lights. Stars and shooting stars are hidden in daylight and rain; their cached glow membership survives furniture/decor changes so they reappear correctly at night. Sky painting happens on theme changes, and the existing shadow map is refreshed once per change. No scene geometry or additional lights are allocated by switching.

The runtime harness verifies light contrast/direction, night-only stars, rain visibility, fairy-light preference preservation, glow restoration and unchanged layout/mesh/material counts. Screenshot comparisons separately check the rendered day and night appearances.


The production preview kept the saved Daylight selection after reload, synchronized the header and Atmosphere choices, and fit the new control at 320 pixels without horizontal overflow. A warm native-window Daylight sample reported 60 fps, 17.3 ms frame-interval p95, 2.1 ms CPU-render p95, 124 draw calls, and 1.50 render pixel ratio. The scene remains the user's Writer’s loft arrangement; these are single-device observations. The complete checkpoint passes 34 unit tests, fourteen runtime groups, and the production build.


## Furniture outlines and drag-to-return

Decorate mode keeps the collection in a fixed bottom tray. Hovering picks the nearest furniture surface and outlines one object at a time, including animated plant leaves and turntable discs. Smoke, flames and the seated avatar do not acquire outlines. Babylon’s outline renderer uses the existing opaque meshes; selection never changes shared furniture materials or allocates a second model.

Pointer capture keeps a drag active between the canvas and tray. Preview transforms follow the snapped floor intersection while the saved layout remains unchanged. Releasing over a valid floor spot creates one undoable edit. Invalid drops, Escape, pointer cancellation, lost capture, window blur, hidden tabs, external layout updates and leaving Decorate restore the original transform and visibility. The last study station cannot be returned. Over the tray, the furniture fades and a dashed SVG drawing follows the pointer; release returns it to the collection, with Undo available.

High-frequency pointer events coalesce once per rendered frame. Drag updates use floor math without further mesh raycasts, mesh creation or material creation. The moving piece is excluded from the cached shadow map until the gesture ends, avoiding stale self-shadows without rendering shadows every frame. Reduced motion still responds to user drags and returns to idle afterward. Touch input suppresses page scrolling only while decorating; physical-device touch testing remains outstanding.

Verification adds real scene-graph and pointer-event checks for outlines, shared materials, preview isolation, a single save per drop, invalid position/rotation restoration, return fading, shadow restoration, cancellation, the last desk, reduced motion and secondary-touch isolation. All 34 unit tests, fifteen runtime groups and the production build pass. The production browser separately verified moving a plant, invalid-drop restoration, returning it to the tray, the dashed preview during the native gesture, and Undo. The saved Writer’s loft arrangement was restored after testing. Responsive checks cover 320-, 390-, 966- and 1280-pixel viewport widths.

With the study desk outlined in Writer’s loft, the final warm native-window sample (966 × 1044, Daylight, Adaptive) reported 60 fps, 17.8 ms frame-interval p95, 2.5 ms CPU-render p95, 131 draw calls and a 1.50 render pixel ratio. No production-page console errors were captured. This is one browser/device measurement, not a universal FPS guarantee. The main JavaScript chunk is about 324 KB gzipped plus lazy shader chunks; the existing Vite chunk-size advisory remains.


## Companion routines

The focus session now drives a separate companion state machine in `src/companion.js`: idle, working, walking, resting, sleeping, returning, and a desk-rest fallback. Pausing or completing a session plans a trip to a sofa, then an armchair or pouf if needed. Thirty seconds of visible rest introduces a sleepy head tilt, slower breathing and a small floating-Z line batch. Resuming focus returns the companion to the active study desk; resuming mid-walk replans from its current clear floor position. The avatar’s status is displayed separately from the user's local focus presence. These are solo game states, not network presence.

Navigation searches a 0.2-unit floor grid only when a trip begins or changes destination. Furniture footprints and the shared cat bounds include a 0.24-unit walking margin. Exact segment/box intersection checks protect shortcuts and diagonal corners. Authored chair-exit and seat-entry paths handle interactions within each destination’s own footprint; the three presets all have round-trip sofa routes. A blocked exit or missing accessible seat keeps the companion at the desk. Editing anchors it safely at the desk and a changed layout invalidates the previous route. The timer remains persisted as before; intermediate walking poses are transient.

A retained body position/normal buffer and the existing shared head supply the walking/resting avatar. The same knit, headphones, hairstyle and palette carry over from the working pose. A small contact-shadow mesh follows the feet; the moving model skips the cached shadow map to avoid stale self-shadows and per-frame shadow updates. The sleep cue is one line mesh. Only one desk or mobile avatar is visible. Hidden tabs suspend the routine without advancing its position on return. Reduced motion goes directly to the destination seat and idles without walking, breathing or drifting letters.

Verification now includes 41 unit tests and sixteen runtime groups. Tests cover session-to-intent mapping, clearance in all three presets, reverse and interrupted trips, blocked exits, missing seating, dozing, editing, reduced motion, grounded feet, finite geometry/normals, one visible avatar, hidden-tab continuity and stable mesh/material counts across a full cycle. Production-browser captures separately inspected the chair exit, walking around the pouf and cat, sofa arrival, sleep cue and return to typing. The original room arrangement and idle timer were restored after testing.

The warm sleeping-companion sample in Writer’s loft (966 × 1044, Daylight, Adaptive) reported 60 fps, 18.0 ms frame-interval p95, 2.5 ms CPU-render p95, 123 draw calls and a 1.50 render pixel ratio. No production-page console errors were captured. This remains a measurement on this browser/device, not an FPS guarantee. The main JavaScript chunk is 328.60 KB gzipped plus lazy shader chunks; the existing Vite chunk-size advisory remains.

## Distinct room designs and saved visits

The room gallery now offers six presets across four architectural styles. The original timber retreat retains its three arrangements. Sakura studio adds woven tatami, shoji lattice, paper lanterns and a blossom view; Cloud loft adds a circular plaster opening, blush checkerboard, cloud shelves and pastel furniture; Midnight metro adds exposed brick, steel windows, a procedural cityscape and neon accents. All geometry, previews and views are authored in JavaScript/SVG. The new window paintings update only when the atmosphere changes.

The original shell is retained and disabled when visiting an alternative. Only one alternative shell exists at a time, with a single opaque vertex-color batch, a window plane and up to four luminous batches. Switching releases its meshes, materials and texture. Furniture palettes clone only the geometry that needs recoloring; shared templates, companions and animation assets retain their original colors. All shells share the editable floor bounds, so picking, collisions, camera framing and companion paths use the same rules. Weather effects follow the wider Metro window, and the original vines, pendants and clock remain in the timber retreat.

Local saves now include a bounded map of room arrangements, one per known design. Switching remembers the current arrangement before loading the next saved room or its furnished preset. Active study desks travel with their rooms; task text, timer, completed history and atmosphere stay with the user. Legacy saves preserve their existing room, and restoration validates all archived layouts. Reset and Undo use the same saved-room path.

Verification: 44 unit tests and seventeen runtime groups pass. The additions cover all six collision-free layouts and companion round trips, independent saved-room edits, reload/migration, stale-tab saves, reset/undo, furniture palette isolation and repeated architecture disposal with stable mesh/material/texture/geometry counts. Browser checks cover all three new designs, daylight/night, returning to an edited room, reloading it, reset/undo and narrow-screen gallery layout. Temporary furniture edits were restored; the original Writer’s loft remains saved with its twenty pieces.

At the native 966 × 1044 viewport with Adaptive quality and 1.50 pixel ratio, all three new rooms reported about 60 fps. Sakura used 60 draw calls, Cloud 64, and Metro 72; CPU-render p95 was 1.8–2.0 ms. Observed frame-interval p95 ranged from 17.9 to 25.5 ms. These are measurements on this browser/device, not a frame-rate guarantee. The main JavaScript chunk is approximately 335 KB gzipped plus lazy shader chunks; the existing Vite size advisory remains.

## Contact shade and filtered shadows

The cached sun shadow cannot darken floor that a wall already shades, so in daylight most furniture read as floating. Each placed piece (rugs excepted) now carries a baked contact shade. Once per furniture type, every triangle below 0.9 units is projected onto a 0.1-unit floor grid, weighted by how close it sits to the floor, then blurred with two separable box passes. A sofa base leaves a deep pool; open desk legs leave only a faint trace. The shade is one vertex-alpha mesh parented to its piece, 0.08 above the floor so it stays visible on stacked rugs. It moves, rotates, fades and disposes with the piece, and never casts, receives, picks or outlines. The cat and the walking companion use a smaller rounded pool from the same builder, and two static bands darken the floor where it meets both walls in every shell.

The sun shadow now uses hardware percentage-closer filtering (medium quality) instead of Poisson sampling, which removes the grain along shadow edges. The existing bias still suppresses floorboard acne. Babylon falls back to Poisson sampling on WebGL1.

Verification: 44 unit tests and all runtime groups pass; the drag-outline check now excludes the shade mesh, which is deliberately never outlined. Headless Chrome on the Metal GPU (1440 × 900, device pixel ratio 2, Adaptive, 1.50 render pixel ratio) compared the same presets before and after. Ember library at night stayed at 60 fps with 16.7 ms frame-interval p95, moving from 123 to 142 draw calls and 205,758 to 219,516 triangles. Writer’s loft in daylight moved from 124 to 143 draw calls, and Midnight metro at night from 72 to 87, both at 60 fps. Headless measurements are not a guarantee for a visible browser window or other devices.

## Native-density rendering

Adaptive quality used to cap the render at 1.5× device pixels, so a 2× Retina display showed an upscaled image. Adaptive and Crisp now start at the display's own density, capped at 2×, so one canvas pixel lands on one screen pixel; Save energy stays at 1×. Only Adaptive steps down, still by 0.25 after three slow seconds.

Previously a single slow moment lowered the resolution for the rest of the visit. Adaptive now steps back up by 0.25 after eight steady seconds (58 fps or better, no slow CPU samples, not reduced motion). If a step up turns slow again within fifteen seconds, that level becomes the ceiling until the viewer picks a quality setting again, so a borderline device settles instead of oscillating.

The cached sun shadow map is now 2048 texels (about 1.2 cm per texel instead of 2.3 cm). It redraws only when lighting or casters change, so the cost is GPU memory and an occasional redraw rather than per-frame work. The existing bias showed no acne on floorboards or tatami in daylight.

Verification: 44 unit tests and all runtime groups pass, including a new adaptive check (slow frames step down, steady frames restore full resolution, a failed step up becomes the ceiling, and choosing a quality resets it). Headless Chrome on the Metal GPU (1440 × 900, device pixel ratio 2) rendered at 1.50× before and 2.00× after in all eight captured scenes. Ember library at night, Writer’s loft in daylight and Midnight metro at night all held 60 fps with unchanged draw calls (142, 143, 87) and triangles. The Performance panel reports CPU time only; the extra 78% of pixels is GPU work it cannot show, so slower GPUs rely on Adaptive stepping down.

## Review fixes

A code review of state, scene and UI (three independent passes, each finding confirmed before fixing) produced the following changes. Each has a unit test, a NullEngine runtime check or a headless-browser check.

- **Adaptive quality.** A step up that stalls again lowers the ceiling one level only. A display that never delivers 60 Hz callbacks (30 Hz low-power modes, 50 Hz panels) is judged at its own rate; raw requestAnimationFrame cadence, including skipped callbacks, decides this. A change of screen density (another monitor, browser zoom) re-reads the native ratio. The room stops drawing while scrolled out of view.
- **Contact shade.** Pieces' shade sits 2 mm above the highest rug under them, or the shell's floor top (tatami stands 8.5 mm proud), recomputed on every layout change and while dragging. The walking companion's shade follows the same rule per frame. The previous fixed 8 cm height z-fought the moon rug and darkened the base of every piece.
- **Window effects.** Moths stay out of Midnight metro. Stars and the shooting star keep their shape when the effects stretch to the wide metro window. Rain reaches the top of each shell's own opening (arch, rectangle or circle).
- **Accent lights.** Switching them off removes the glow but keeps the globes, neon and lantern ribs in place.
- **Timer and presence.** Remaining time is capped at the duration, so a clock moved backwards cannot show more than the session length, and restore caps rather than discards it. A finished session records `completedAt`: it reads as a break for 15 minutes, then as a fresh timer.
- **State and UI.** Undo drops its snapshot when another tab changes the room; the selected duration no longer resets a paused session; a resting companion keeps its seat when an unrelated piece moves in another tab; Rooms and Decorate wait for a ready room; the Atmosphere lights label follows the room; Escape while typing keeps the panel; the keyboard can place furniture (arrows, then Enter) and focus survives Reset and Undo; rain audio suspends after it is switched off; toasts ignore the pointer; phone arrow buttons fit their card; a phone turned sideways shows the tray below the room; web fonts load without blocking the first paint.

Not changed: a one-frame blank after a canvas resize, and cached self-shadow on the animated desk companion and swinging lanterns. Neither was visible in headless renders; both need a check in a visible browser first.

Verification: 47 unit tests, all runtime groups (plus a separate 30 Hz room) and 16 headless-browser UI checks pass. The same UI checks fail 15 of 16 on the previous `main`; the one that passes guards unchanged Escape behavior. Undoing the ceiling, cadence or metro-moth fix makes its runtime check fail. A runtime pass in headless Chrome (three cycles through all six rooms, day/night, mini view and decorating) showed no console errors and stable mesh, material, texture and geometry counts.

## Decorate controls

Decorate mode keeps Babylon's camera input detached, so a drag that starts on a piece only ever moves that piece. A drag that starts on empty space turns the room instead: the room adds the same offsets as the camera input (`angularSensibility` 700, with the camera's inertia and angle limits), and it saves nothing. A drag while placing a new piece also turns the room and never places the preview. Empty space shows the grab cursor, as it does outside Decorate; the plus cursor is kept for placement.

A held piece shows no shadow. The cached sun map already dropped it for the drag; now its floor shade is hidden too, so the piece reads as lifted. Both return at the spot where it is placed, or where it started if the drop is cancelled. The lighting is unchanged: at rest and after a drop, frames match the previous build pixel for pixel (largest difference 1 of 255, by day and night); only frames during a drag differ.

The room owns the canvas cursor (`scene.doNotHandleCursors`). Babylon reset it to the arrow on every pointer move, and the room set its own cursor one frame later, so the cursor flickered while moving over or dragging furniture. In a 41-step hover sweep, that reset showed the arrow 24 times in Firefox and 29 times in Chrome; with the fix, the cursor did not change. The cursor also leaves "grabbing" on release, before the next pointer move.

The canvas no longer draws a focus ring. Babylon focuses the canvas on every press, and browsers can match `:focus-visible` for focus that a script moves, so a gold frame appeared after ordinary clicks (in Zen, and in headless Chrome captures). Keyboard shortcuts listen on the document and do not need canvas focus.

Verification: a runtime check covers the owned cursor, the grab cursor over empty space, empty-space turns, piece drags that leave the camera still, and placement drags; undoing any of the four fixes makes it fail. Real-input drags in headless Firefox 156 and Chrome (1440 × 900, and 2960 × 1400 like a large monitor) moved every piece in the three preset rooms that has a free spot nearby (60 of 61; the Ember library tree has no free spot within 1.5 units).

## Placement fixes

Rugs are modeled with several centimeters of layered weave but were stacked only 6 mm apart, so a covered rug's raised rings showed through the rug on top: the moon rug under the cat rug in Ember library, Moonlit greenhouse and Writer's loft, and the cat rug under the studio rug in Midnight metro. Now the rug put down last moves to the end of the layout and lies on top, and any rug that a later rug overlaps flattens to 5.5 mm, below the next layer. Overlap follows the woven outline: a circle for the round rug, a rectangle for the others. The cat rests on the top rug at its spot and sinks with that rug if it flattens. Contact shades and the walking companion use the flattened heights.

A blocked drop, placement preview or turn now resolves to the closest free grid spot within four steps, preferring the spot shown last on near-ties so that a piece does not flicker from side to side across an obstacle. The piece and its footprint show where it will land. When nothing is free that close, the piece turns red and a drop still returns it to its start.

A click on empty floor only deselects. Before, it moved the selected piece to the click point, which read as a random jump after a drag.

Catalog entries now record each model's `height`, and a unit test keeps it within 1 cm of the geometry. The wall pieces and fixtures of later steps use it.

Verification: unit tests cover the nearest-spot search, rug overlap and catalog heights. A runtime check covers drop-order stacking, flattening, the cat height, blocked drops and turns that slide clear, and clicks that only deselect. Against `main`, pixel comparisons differ at the four flattened rugs; the scattered edge differences elsewhere also appear between two captures of `main` itself.

## Tap to use

Outside Decorate, a tap uses the piece under the pointer. Catalog entries declare it in `use`: `toggle` switches the floor lamp, the desk lamps, the lantern candles, the fire or the record player, and `react` plays a short motion for plants, bookcases, seats and the tea table. A switch saves `off: true` on the layout item, so each room keeps it, and the page saves it without an Undo step. The companion's routine ignores it, so a walking companion never restarts when a lamp changes.

A switched-off lamp keeps its shade and swaps its glowing paint for an unlit twin material, which also leaves the bloom list. The desk lamp takes the desk's warm point light with it. A fire that is out hides its flames, embers and mantel candle flames, and the hearth light moves to the first fire that is still lit. Candles lose their flames. A stopped record stays where it stopped. Nothing else changes: with every switch on, frames at rest match `main` pixel for pixel, apart from the new hint text.

The fairy lights, the retreat lanterns and the sill candles, and the ceiling lamps of the other rooms, switch the room lights with a tap. The retreat now does what the other shells do: switched-off lights stay in place, unlit, instead of hiding, and the sill candles lose their flames. The fireflies keep glowing, because they no longer share the bulb material.

Reactions end exactly at the rest pose. Leaves rustle for 1.1 s, a book on the third shelf tips out on a hinge and slides back (1.5 s, one extra small mesh per bookcase), seat cushions squash and spring back (0.6 s), and the tea puffs a taller plume (1.6 s). Reduced motion skips reactions; switches still work.

Hover outlines outside Decorate are thinner and softer than in Decorate. The outline shader compiles in the background, so the room keeps drawing for up to two seconds after an outline change until the shader is ready; before, a reduced-motion room could stop on a frame without the outline.

Verification: a runtime check taps real pointer positions on each piece and covers hover outlines, saved switches, the desk and hearth lights, a stopped record, candle flames, the room lights, all four reactions returning to rest, reduced motion and Decorate taps. Real mouse taps in headless Chrome and Firefox 156 switched the lamp, desk, hearth, records and lanterns off and on again, with Undo untouched and no page errors.

## Pets

Every room has one pet bed (`pet-bed`), a normal layout item that moves and turns in Decorate but cannot be removed and does not count toward the 32-piece budget. It replaces the old fixed cat spot: rooms saved before the bed get it at that spot, which older saves always kept clear, or at the first free spot. The companion's routes treat the bed as solid, as they treated the old spot.

The pet (`src/pet.js`) is pure logic: nap in the bed, stretch, walk to a favorite spot, sit or loaf, walk home, turn once around, sleep. It uses the companion's floor grid with a 0.25 clearance and leaves its own bed out of the obstacles. Favorite spots stay 0.65 away from every desk-chair exit, and a walking pet waits (up to three seconds) for the companion to pass. A dropped pet lands on the nearest floor that can reach its bed by a flood fill of the same grid, so furniture cannot trap it. Decorating sends it home asleep; reduced motion keeps it asleep at home (a carried pet sits where it lands for a few seconds, then is back in its bed without walking: the idle room wakes for that one frame, and the pet counts real time between frames); hidden tabs pause it with the rest of the room. Escape, a hidden tab or a layout from another tab sets a carried pet down, and the room turns again. The companion's pose tells the pet when it is seated (and where its way out is), so the pet can curl up at its feet, and when it comes over to pet the pet, which then waits for it.

The cat and the dog (`src/pets.js`) are each one vertex-colored mesh on a small skeleton of 34–38 bones: a two-bone spine under one smooth torso whose vertices blend between the bones, a head, ears, two-part legs placed by two-bone IK, and a jointed tail. Stripes, the belly, the bib and the dog's saddle are vertex colors, not extra geometry. Poses (sleep, loaf, sit, stand, walk, stretch, settle, held) blend over about a fifth of a second; the walk cycle follows the distance actually walked, so paws do not slide. The GPU skins the mesh, so per frame the CPU sets about fifty bone matrices and no vertex buffer changes. A first CPU-skinned version cost about 2 ms per frame; the skeleton costs under 0.1 ms. The skinned mesh is not pickable: taps test three spheres at the head, chest and hips.

A still pet (asleep, sitting, settling) casts into the cached sun shadow, which then redraws once for each new resting place, and once more about 0.9 s later, when the pose and the height have settled; a walking or carried pet keeps only its soft contact shade, so the cached map never shows a stale pose. The pet never receives the cached shadow. It stands on its bed's cushion, on the top rug under it (a flattened rug lowers it) or on the floor.

The pet panel on the room toolbar chooses the cat or the dog. The choice saves with the user (like the atmosphere), not with a room, and the new pet takes the same bed; the old model, its skeleton and its effects are released.

A pet shows a flat, billboarded heart and a short line in a DOM bubble just above its head. `src/speech.js` owns the bubbles; the room reports each head's screen position after every rendered frame (`anchor`, `onFrame`), so the bubble follows a walking or carried pet.

Performance. A settled nap only breathes, so the rig then updates every second frame and keeps its bones (and the GPU's copy) in between; the pet's model costs 0.05 ms per frame on average (0.11 ms before). Path search uses a binary heap for the open set, and a stroll first flood-fills the grid once and keeps only the spots the pet can reach, so no search runs to failure: over a simulated day, the median search takes 0.42 ms, the 95th percentile 3.1 ms and the slowest 3.4 ms (before: 7.4 ms at the 95th percentile and 9.3 ms at most, plus failed searches). The bubble update costs 0.001 ms per frame. In headless Chrome (Ember library, dusk, 1440×900 at 2×, the same machine and load), Part 2 measured 78.8 ms of script per second against 74.8 on `main`, 137 draw calls against 142, and 60 fps on both; an in-page A/B with the pet hidden and its work skipped measured 77.7 against 70.7 ms per second. The walking companion's CPU-posed body (2,491 vertices) costs about 0.1 ms per frame, 0.2 ms at the 95th percentile.

Verification: unit tests cover the bed rules and migration, favorite spots in every design, a full nap-to-nap day in all six rooms, carrying and dropping (including a closed-off corner), petting, editing, reduced motion, and both models in every pose (finite, on the floor, inside the picking box, still in reduced motion). The runtime harness checks the nap in the bed, breathing, the heart, a real-pointer carry that never turns the room, the walk home, taps that save nothing, rug heights and reduced-motion stillness. Headless Chrome checked both pets in every pose, petting and carrying in Ember library, and moving the bed in Decorate. An end-to-end script (real pointer input, headless Chrome over CDP and headless Firefox over WebDriver BiDi) checks the nap in every design, petting and its bubble, a carry and the walk home, a full stroll on clear floor, Decorate, the pet panel and the room label, reduced motion (a dropped pet sits, then is home without a walk), the mini view, a phone viewport, taps, the frame rate during a walk, and the companion's lines.

## Companion speech

The companion talks in the same kind of bubble, at the edges of focus: a start, resume or pause line from the start button, a finish line when a session ends, a line when it sits down to rest or dozes off, and a welcome after half an hour or more away (the last visit is saved as `seenAt` when the page hides) or after ten minutes in a hidden tab, but never in the middle of focus. A tap on its head or body (two spheres, at the desk or away) brings a line for what it is doing, and saves nothing. It never speaks on its own more than once every twelve seconds, and never in Decorate or the mini view, where the bubbles are hidden.

Verification: `src/speech.test.js` checks that lines never repeat back to back, that every companion state and every pet has lines, that each line is short and how long a bubble stays; the runtime harness checks that a tap on the companion answers, saves nothing and leaves the desk lamp alone; the end-to-end avatar group checks the start, pause, rest-tap, welcome and finish lines, the bubble position above the head, silence during focus and in Decorate, in Chrome and Firefox.

## Break activities

A break now starts with one small thing in the room, then the usual seat, rest and doze. `activitySpots` (in `src/companion.js`) lists where the companion can stand: 0.75 before a lit fire, or beside its middle when the pet sits there (warm), beside a plant or the moon tree (water, trying the front, the sides and then the back), at the record player (record), at the window (window), beside the pet while it naps or sits (pet), and at night beside a floor lamp that is off (lamp). Each spot faces its piece, stays on clear floor, and some carry a `reach` point for the hand. At night an unlit lamp comes first; otherwise the choices (the armchair among them, for reading) are shuffled, with the last activity moved to the end, and the first one that a path search reaches wins. One flood fill from the desk's chair exits first keeps only the spots that can be reached (a plant or a lamp offers its first reachable side), so no path search runs to failure: a break start takes 1.4–3.0 ms in every design at night (5–12 ms before, where a lamp in a closed corner cost two failed searches). So each break does something different when the room allows it, and nothing when it does not. The companion always reads the current layout, so a lamp relit by a reset or in another tab is not visited again.

An activity lasts 4.5–11 seconds. At its moment (`useAt`) it uses its piece through the room: the lamp or the record player switches on only when it is off, and saves like a tap (no Undo step); a watered plant rustles; the pet gets a heart and a happy line. The companion switches a given lamp or record player on at most once per visit, so one that you switch off again stays off. A pet stays put while the companion comes over to pet it and during the fuss (the companion's pose carries a `goal`), and no other activity is done standing on a still pet. Then the companion walks to a seat, and in the armchair it reads. Resuming focus walks it straight back to the desk (a standing companion needs no rise). A pet that gets up or is carried, or a fire switched off, ends the activity early; a layout change elsewhere keeps it, and moving its piece sends the companion on from where it stands. Decorate returns it to the desk. Reduced motion skips standing activities, so a break goes straight to a seat, where the armchair still reads. Single seats (the armchair, the pouf) also take two approaches from the front corners: every preset's armchair has a tea table in front, which blocked the only approach before, so no preset armchair could be reached until now.

The walking companion's model gains the poses: warm hands held out to the fire, hands behind the back at the window, a watering can tipped over the plant, a bend at the waist over the record player, a reach up to the lamp, kneeling on both knees to stroke the pet, and a book held open in the armchair (lowered to the lap when it dozes). The hands that touch something use two-bone arm IK to the spot's `reach` point, and a pole vector keeps the elbow out. Poses blend in and out over about half a second, and the book and the can are two small batched meshes, shown only for their activity. The body keeps its CPU-posed vertex buffer: at 2,491 vertices it costs about 0.1 ms per frame (0.2 ms at the 95th percentile) whether walking, busy or resting. In headless Chrome during a break (Writers' loft, dusk, 1440×900 at 2×), two runs measured 69.0 and 80.3 ms of script per second against 65.8 and 69.9 on `main`, 139–140 draw calls against 145, and 60 fps throughout.

Verification: unit tests cover every design's reachable activities and their facing, the night lamp (switched once, at its moment, then a seat), resuming during an activity, the reading chair and reduced motion, a pet that walks off, a moved or cold fire, and every pose on the model (finite, above the floor, the right prop only, the hand within 6 cm of its target, no new meshes). The runtime harness runs a full break (walking, busy, resting, sleeping) and a night break that switches on the greenhouse lamp with one saved change. The end-to-end activities group runs each activity in a room that offers little else, with its status line, its prop, its effect (a saved lamp or record, a heart and a purr) and a seat afterwards; the reduced group checks that a break goes straight to a seat. A pose sheet (`.audit/companion.html`, not committed) shows each pose beside its piece.

## Wall layer

Wall pieces hang on the back wall or the side wall of every room. A wall piece stores `wall` (`back` or `side`), `u` (its center along the wall: x on the back wall, z on the side wall) and `v` (its center height); frames and framed records also store `art`. `src/walls.js` holds each shell's mount faces, usable spans and fixtures (posts, windows, curtains, vines, fairy lights, lanterns and ceiling lamps), each with the distance it hangs in front of the wall, so a flat piece no deeper than that gap may hang behind a fairy string or a lamp. Placement uses 3D boxes: wall pieces never overlap each other or a fixture, and solid floor furniture keeps 50 cm clear in front of a wall piece at its height. A bookcase no longer stands through a shelf or in front of a picture.

The fixed decor of every design became movable wall pieces: the retreat's two pictures, moon clock and potion shelf, the Sakura scroll, the Cloud loft shelves and rainbow, and the Midnight metro neon sign and records. They keep the old spots, on the 5 cm wall grid, except where the old decor met furniture: the big picture hangs over the hearth instead of behind the right-hand bookcase, the potion shelf is shorter (four bottles) and hangs between the vine and the post, the Sakura and Cloud loft bookcases stand at x 4.5, and the metro records hang higher. A room saved before wall pieces (layout `v` below 2) gains its design's wall pieces once. Floor furniture comes first, so a saved piece of furniture is never lost to a picture: a wall piece that no longer fits moves to the closest free spot within 75 cm, or stays in the collection.

A drag follows the pointer along the wall under it, keeps its grab offset on the same wall, and crosses the corner to the other wall. A blocked drop slides to the closest free spot within 75 cm, or returns with the reason. Arrow keys and buttons move a selected wall piece 10 cm, and a wall piece never turns. The inspector offers seven pictures for a frame, painted once per picture and frame shape by `src/art.js`, and four sleeves for a framed record. The clock keeps the local time. The neon sign switches like a lamp, and its glow follows the time of day like the rooms' accent lights. Its batch material keeps the neon color, as the rooms' own glowing parts do, so the sign matches `main` to within one color level.

A wall piece shows a band in the outline colors instead of an outline. Babylon's outline renderer writes the depth of the outline shell after a mesh draws, so a picture 1 cm in front of its frame failed the depth test: every picture, sleeve and clock hand vanished while hovered or selected. The band sits on the front of flat pieces and on the wall behind deep shelves.

Verification: unit tests cover wall rectangles, fixtures and their gaps, floor clearance in both directions, the nearest free wall spot, migration of old saves and all six presets. A runtime check covers both walls, drags along a wall and across the corner, a refused drop on a window, arrow moves, pictures, floor clearance, old saves, the neon glow and switch, and the band. In headless Chrome (78 checks) and Firefox 156 (76 checks), real pointer and keyboard input drove drags along both walls and across the corner, blocked drops, the picker (with pixel checks that the picture shows while the frame is hovered or selected), adding a frame from the collection, Delete, a drop over the collection, Escape, Undo, reload, tap to use on the neon, theme glow, migrations and the phone inspector.

Performance against `main`, at 2960 × 1400 CSS pixels and 2× density (night, two rounds, alternating order): in headless Chrome and Firefox 156 every room held 60 fps with the same median scene-render CPU time (Chrome 0.6 to 0.9 ms; Firefox reports whole milliseconds). Draw calls rose by 2 to 6 per room, because a frame is now a body and a picture, and the clock, shelves, neon and records are pieces of their own; triangles fell by 2 to 7 thousand. The 95th-percentile render time moved by −0.1 to +0.35 ms in Chrome, and total browser-process CPU stayed within the run-to-run spread (Chrome −1.7 to +2.9 points, Firefox −2.2 to +1.6). With reduced motion, an idle room drew no frames in either build. Wall pieces add no per-frame work: pictures are painted once, the band and the art change only on hover, selection or a choice, and the clock hands turn in the existing animation loop.
