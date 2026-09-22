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
