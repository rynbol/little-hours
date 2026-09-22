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

## Expanded Babylon room checkpoint

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
