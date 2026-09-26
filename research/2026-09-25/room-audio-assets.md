# Little Hours: room, interaction, audio and asset research

Checked **2026-09-25, America/Los_Angeles**, against `origin/main` snapshot `05e742603075595e180c4639ac4c1b7236d843de`. This is source inspection and primary-documentation research, not a fresh browser benchmark, listening test, asset download, or implementation. All effort estimates and proposed budgets below are engineering judgments; historical measurements are identified as such. No application files were changed.

## Decision

Keep Babylon and the original, procedural JavaScript furniture. The room already has sophisticated authored animation, editor behavior, navigation and rendering controls. The largest uncovered sensory opportunity is audio: the existing sound button plays generated noise, while the fireplace, record player and furniture interactions have much richer visual behavior. First invest in a small audio service, carefully auditioned rain/fire, and one restrained completion sound. On graphics, buy information with targeted captures before adding effects. Broad PBR conversion, a new navigation engine, a skeleton replacement and marketplace furniture would spend substantial effort recreating working features.

The useful outside assets are **raw material detail and audio**, not replacement furniture. A viable first experiment has **$0 asset/software license cost**, with hosting bandwidth and engineering work still real costs. Paid music or commissioned recordings can follow a clear listening brief; no paid price is assumed here.

## What already exists

Source references below use repository-relative paths and one-based line anchors at this snapshot.

| Area | Current implementation and implication |
| --- | --- |
| Stack | `package.json:13`: sole runtime dependency `@babylonjs/core` **9.27.1**, ES modules, Vite. Existing engine features can be used directly from vanilla JavaScript; React wrappers or an engine migration add no value to this scope. |
| Camera | `src/room.js:40`, `:57`: transparent canvas, right-handed scene, orthographic `ArcRotateCamera`, bounded open-side orbit, no wheel zoom or panning. The whole cutaway room is a product requirement, not a temporary camera to replace. |
| Geometry and materials | `src/furniture.js:21`, `:89`, `:162`, `:1682`: per-scene caches, authored primitive helpers, `StandardMaterial`, colors baked into grouped geometry, cloned shared templates and dynamic parts kept separate. `src/room.js:322` merges static architecture and freezes its world matrices. |
| Light and effects | `src/room.js:148`: hemisphere plus directional sun and local warm lights. `:158` now uses a **2048** cached shadow map with PCF, not the older 1024 described in an early engine checkpoint. `:165` uses selective 512-square glow. `:433` supplies contact shade. Motes/stars use retained thin-instance buffers (`:337`, `:1482`); other effects use tiny authored meshes. |
| Picking/editor | `src/room.js:50` disables Babylon's automatic move picking; `:1086`, `:1108`, `:1266` implement bounded custom picking. Floor placement, selection, ghost geometry, drag cancellation, keyboard placement and Undo already exist. Furniture identity survives visual batching through ancestors/metadata. |
| Navigation | `src/companion.js:36`, `:79`: footprint-derived obstacles, 0.2 m grid, cached connectivity and routes; `:280`, `:316` select and execute activities. `src/walks.test.js` covers interactions between walkers. This is not a missing pathfinding problem. |
| Avatar/pet | `src/furniture.js:1132`, `:1447` implement authored articulation and mobile companion geometry. `src/room.js:1413` integrates companion and pet routines; `:1424` manages cached pet shadows. Catalog dimensions, reach points, seats and floor/rug heights constrain believable motion. |
| Lifecycle | `src/room.js:520`, `:526`, `:1572`, `:1587`, `:1603` combine reduced motion, demand rendering, hidden-tab suspension and scene suspension. `:1397` switches adaptive/crisp/battery quality and disables glow in battery mode. The minute clock can wake an otherwise still reduced-motion scene. |
| Audio | `src/main.js:988` creates one three-second mono noise buffer, filters at 1400 Hz, loops it and ramps gain. Off suspends the context after 800 ms. `:1050` closes it during hot disposal. There is no music library, individual ambience mixer or room-attached sound system in that block. |
| Completion seam | `src/main.js:224` handles an actual completion result, triggers the pet reaction and emits avatar finish speech. This is the right semantic source for a completion cue, rather than checking the displayed timer text or firing every render. |

The current engine notes contain successive experiments, not one timeless baseline. For example, `docs/engine-and-performance.md:347` records earlier navigation stress failures and their fixes; `:357` records planted-foot gait improvements; `:369` records a reduced-motion readiness race; `:391` records rug support and reach-height fixes. Its latest rug checkpoint reports unchanged draws and 60 FPS in its tested desktop conditions (`:411`). Those are the project's historical observations, not measurements performed for this report or mobile guarantees.

## Rendering and geometry candidates

### Adopt: targeted instrumentation and Spector.js captures

Babylon exposes scene counters and optional GPU timing; GPU timing depends on browser extension support and must be reported as unavailable when unsupported. Freezing everything or enabling an aggressive scene mode also changes picking, material and visibility behavior. Those are not safe blanket switches for this editor. [Official optimization guidance](https://raw.githubusercontent.com/BabylonJS/Documentation/master/content/features/featuresDeepDive/scene/optimize_your_scene.md).

Add a development-only measurement path beside `SceneInstrumentation` in `src/room.js:72`: tag shadow refreshes, effect draws, layout synchronization, shader warm-up and first-ready latency. Capture matched normal/editing/break frames with [Spector.js](https://spector.babylonjs.com/), which inspects WebGL commands, shaders and render state. It is a diagnostic tool, not a runtime dependency or a substitute for frame-time sampling. [Official repository](https://github.com/BabylonJS/Spector.js) is public; its exact redistribution license should be checked from the installed package before bundling it. The recommended browser/dev-tool use incurs no known purchase requirement.

**Effort:** half to one day for repeatable capture notes; low product risk. **Acceptance:** identical viewport, DPR, design, atmosphere and activity before/after; warm samples without screenshot capture; record CPU and GPU separately; count cached-shadow refreshes during an idle interval. Keep captures out of user builds. First inspect repeated static furniture draws and transparent effects, not just triangle totals.

### Adopt selectively: existing batches; trial regular instances for repeated static items

[Regular instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances) share materials and support picking/shadows. They are a plausible experiment for repeated copies of one static furniture batch. Keep a mapping from instance to catalog item, and preserve tint groups, outlines, interaction geometry and selected-item transforms. Clones already share geometry; that alone does not consolidate draws.

**Trial seam:** the static clone creation in `src/furniture.js:1707`, for one repeatable nonanimated item only. Do not merge the entire room into an indivisible mesh: each piece must remain independently movable, selectable and replaceable. **Effort:** one to three days for prototype plus editor regressions; moderate risk. **Acceptance:** show draw reduction in a crowded room with repeated items and no lost picking, tint or Undo behavior. Reject if one-off furniture dominates and complexity outweighs the measured benefit.

**Keep thin instances for ambient batches.** They avoid one JS object per copy but share aggregate visibility; frequent insertion/removal has tradeoffs. Mutable matrix buffers need explicit update notification. [Official thin-instance documentation](https://raw.githubusercontent.com/BabylonJS/Documentation/master/content/features/featuresDeepDive/mesh/copies/thinInstances.md). Current motes and aquarium life already fit this pattern. A proposed new ambient event should start with one retained batch, no new per-frame arrays, no picking and no sun-shadow membership. Budget **one additional draw per new decorative effect** as a trial gate, not an engine guarantee.

### Adopt: preserve authored animation; defer generic skeleton/animation-system replacement

The present planted feet, seated hand reaches, sleeve deformations and pet poses are valuable constraints. A generic clip does not know that an edited desk moved, a rug raised the floor or a pet occupies the destination. Keep state/intention separate from pose and graphics, and add reusable local-space anchors for new interactions rather than duplicating literal offsets.

Babylon animation groups would be reasonable for a future imported articulated object with authored clips; they are not a reason to rewrite the current procedural avatar. For the next furniture interaction, extend the catalog's semantic use state, `activitySpots`, reach targets and the existing per-frame pose. **Effort:** one to three days per simple interaction, potentially more for coordinated limbs. **Acceptance:** avatar returns from every activity; all four furniture rotations; rug and bare-floor cases; edit during activity; reset/Undo; frame-rate-independent timing; reduced motion reaches a stable pose without a continuing render loop. Existing random-room stress checks are more relevant than a showroom animation demo.

### Trial narrowly: materials with small, quiet surface detail

`StandardMaterial` and vertex-color batches are an intentional art direction and performance decision. Add weave or grain only where the whole-room camera can reveal it. Start with **one rug or upholstered seat**, compare at the normal camera, then test the nearest allowed orbit. If it disappears at room scale or shimmers on movement, do not ship it.

A canvas-generated, once-updated pattern is compatible with the existing procedural architecture and avoids remote assets. Babylon also supports procedural textures with a refresh rate of zero for a single render. [Official procedural-texture documentation](https://doc.babylonjs.com/features/featuresDeepDive/materials/advanced/custom_procedural_textures/). The latter is optional: do not add a shader render target for detail a small canvas texture can provide.

A selective PBR experiment might suit one brass/glazed object, but requires lighting/material calibration and batch-key changes; it is not a global replacement. **Budget hypothesis:** at most one 512-square texture or atlas for the first surface experiment, shared across copies; no displacement geometry, 4K downloads or new continuously updating texture. **Effort:** one to two days for one art comparison; moderate stylistic risk. Acceptance includes daylight/night/rain, recoloring, mobile pixel density, no texture request before needed, and correct disposal on room changes.

### Defer: SSAO and broad postprocessing; preserve selective glow

The official SSAO pipeline is a multi-pass chain including ambient occlusion, two blur stages and composition. [SSAO documentation](https://raw.githubusercontent.com/BabylonJS/Documentation/master/content/features/featuresDeepDive/postProcesses/SSAORenderPipeline.md). That cost needs a visible deficiency to justify it. Existing contact shade already grounds furniture, and the product is a bright readable miniature. SSAO can darken small cavities into muddy detail; depth of field blurs furniture the user needs to inspect; motion blur undermines crisp subtle animation. These are poor defaults.

Keep the explicit glow inclusion list and fixed small buffer. Babylon documents inclusion/exclusion lists and fixed-size glow targets. [GlowLayer documentation](https://raw.githubusercontent.com/BabylonJS/Documentation/master/content/features/featuresDeepDive/mesh/glowLayer.md). If testing SSAO later, gate it behind a dev flag, compare one design on integrated/mobile GPUs, and include zero-effect controls. **Effort:** one day for a visual prototype, several more for device validation; GPU/battery risk high relative to current benefit. No visual effect may restore continuous rendering in reduced motion or a hidden tab.

### Defer: WebGPU-first rendering and new physics/navigation engines

Keep the current WebGL engine until a measured bottleneck has a candidate WebGPU-specific solution. Backend migration entails visual and device regression work; it does not automatically improve a small room or remove draw/asset costs. No WebGPU performance promise is made here.

Babylon's newer navigation plugin uses Recast/Detour through WASM and sits in ADDONS while maturing. [Official navigation V2 introduction](https://raw.githubusercontent.com/BabylonJS/Documentation/master/content/features/featuresDeepDive/crowdNavigation/v2/intro.md). It could become useful for continuous multilevel surfaces or many visiting agents. Today, the grid's reachability, edited footprints, destination reservations and special seat transitions fit the flat room directly. Recast would not automatically preserve those application rules. **Effort:** several days merely to compare, potentially weeks to migrate robustly; add-on and WASM/license/version verification needed. Trigger reconsideration only when real room geometry or visitor count defeats the existing planner. Likewise, rigid-body physics is unnecessary for grid furniture and calm authored pet carrying.

## Optional authoring tools and actual material sources

| Candidate | Verdict and specific fit | Cost/license and burden |
| --- | --- | --- |
| [Blender](https://www.blender.org/about/) | **Defer as a production dependency; optional trial as a proportion/pose reference tool.** Use to inspect silhouettes or bake an original surface if the JS workflow hits a concrete limit. Keep JS furniture authoritative; avoid a dual-source model edited independently in two tools. | Free, GPL software. Blender states artist output belongs to its creator; that does not clear third-party inputs. [Official FAQ](https://www.blender.org/support/faq/). No browser cost if only used offline; learning and round-trip cost can be substantial. |
| [glTF Transform](https://gltf-transform.dev/) | **Defer.** Its inspect, dedup, prune, compression and texture processing fit actual glTF assets, not the current JS-generated meshes. Adopt an offline CLI step only if original glTF exports/imports become necessary. | MIT, no license purchase. A compressed glTF path can add loader/decoder integration; compare end-to-end bytes, decode latency and memory rather than file size alone. Half to one day for a future pipeline spike. |
| [ambientCG Fabric 062](https://ambientcg.com/view?id=Fabric062) | **Trial as raw material input** for restrained upholstery weave. Source describes roughly 40 cm square material; respect scale rather than stretching it across a whole rug. Audition 256/512 derivatives and low-contrast normal detail. | CC0 through [ambientCG license](https://docs.ambientcg.com/license/). Listed 1K JPG ZIP is 8 MB: source package size, not acceptable runtime budget. Download/visual inspection still required. |
| [ambientCG Wood Floor 051](https://ambientcg.com/view?id=WoodFloor051) | **Defer pending one visual comparison.** Actual clean light parquet source, useful as grain/reference. Its baked plank pattern may conflict with the room's modeled boards; do not double-render seams. Prefer derive subtle grain over replacing authored floor geometry. | Same CC0. Listed 1K JPG ZIP is 5 MB. Trial only needed channels, resize, remove unused files. No guarantee the scanned/material look suits the stylized room. |
| Stock furniture/characters | **Reject for the current collection.** Mix-and-match low-poly marketplaces would dilute the authored silhouettes and require footprint, tint, batching, seat and rig adaptation anyway. | Even free geometry has integration cost. Do not treat a permissive asset license as a product-fit argument. |

For every external asset, retain source URL, author, asset ID, license/version, checked date, original hash, derivative recipe and shipped filename in a manifest. CC0 permits copying/modification/commercial use without attribution requirements, but does not waive every possible third-party right or imply endorsement. [Creative Commons CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/). The practical task is provenance for a handful of chosen files, not downloading a large library.

## Audio: the highest-value new capability

### Adopt: one small audio service with explicit user controls

Extract the sound block from `src/main.js:988` behind an app-owned API: unlock from the sound gesture, set ambience mix, play one event, mute, suspend and dispose. Keep generated rain as an offline/failure fallback. Define separate ambience, music and notification volumes, but begin with ambience and optional completion sound. A user muting rain should not accidentally enable music; sound stays opt-in.

Use the existing Web Audio context initially: two ambience gain nodes, one SFX gain, lazy decoded buffers, bounded concurrent events and short fades are manageable without a new dependency. Make loading and decode failure visible without blocking the room. Tie fireplace mix to semantic on/off state; a record player's visual switch should only imply audible playback once that behavior exists.

Do not tie audio scheduling to render frames. A user may want rain while studying in another tab even though room rendering must stop. Define that preference explicitly and test it independently of reduced motion. If all audio is muted, suspend the context rather than merely setting gain to zero. On returning, avoid replaying every missed UI/completion sound. Completion needs an idempotent session-event key, especially with local-state refresh and multiple tabs.

**Effort:** two to four days including browser/mobile behavior and mixer UI; medium lifecycle risk. Proposed first-shipment budget: lazy load one rain and one fire derivative, **under 2 MB combined encoded** if acceptable by listening, no decoded multi-minute stereo music buffers, at most two ambience loops and two one-shot voices. These are target limits for a prototype, not measured sizes.

### Trial alternative: Babylon Audio V2 when room sources multiply

Babylon Audio V2 provides buses, static sounds, streaming music, bounded sound instances, gain ramps and mesh-attached spatial sources. It can use an existing Web Audio context. Streaming saves long-file memory but has fewer loop controls and potentially delayed initial playback. [Official Audio V2 guide](https://raw.githubusercontent.com/BabylonJS/Documentation/master/content/features/featuresDeepDive/audio/v2/playingSoundsMusic.md).

This is vanilla-JS compatible and within the existing engine ecosystem, under Babylon's [Apache 2.0 license](https://github.com/BabylonJS/Babylon.js/blob/master/license.md). Trial it if three or more object-associated sources or buses make the local service awkward. Verify exports/options against pinned **9.27.1** before implementation: online master documentation can describe newer work. Dynamic imports can keep unused audio code off the initial path.

For this orthographic room, full camera-based distance attenuation could sound strange: orbiting to inspect a bookshelf should not radically change rain loudness. Prefer stable ambience and restrained stereo positioning before HRTF/spatial processing. **Effort:** one to two days for a side-by-side backend spike, then lifecycle validation. Do not keep two live contexts/backends indefinitely.

### Howler and native media: credible alternatives, not automatic additions

[Howler](https://github.com/goldfire/howler.js) is MIT, plain JavaScript, with Web Audio/HTML5 fallback, fades, codec alternatives, unload, unlock hooks and an HTML5 mode for large files. **Trial only if a playlist-focused product needs its browser handling more than Babylon source attachment.** It offers a compact independent playback layer; it does not decide our background policy, event deduplication or what music we may distribute. Avoid running it alongside a separate procedural-rain context: route the fallback through the chosen service or replace that source. Estimate one to two days for a backend comparison; use the same acceptance gates below. Its advertised small size is not a measured addition to this Vite build.

A plain `HTMLAudioElement` is sufficient for a single optional long music track; the existing Web Audio path is better suited to generated rain and short precisely controlled cues. **Adopt native APIs for the first small mix; trial Babylon Audio V2 for multiple room-attached sources; keep Howler as the playlist alternative.** Choose one owner for mute/unlock/disposal. Do not add a music-synthesis framework merely to make a notification chime.

### Curated audition shortlist

These are real exact source items with license labels checked. **No files were listened to, downloaded or acoustically validated in this research.** “Trial” means audition before adoption.

| Source | Verdict and intended role | Verified terms and caveats |
| --- | --- | --- |
| [Snoopy20111 — Rain_Loop.wav](https://freesound.org/people/Snoopy20111/sounds/399072/) | **Trial first.** Porch rain, author describes a loop and mono-compatible mid-side recording. A credible natural complement to generated noise. | CC0; 5:16, 96 kHz stereo WAV, 115.7 MB source. Login needed to download. Select a quiet segment, resample, test loop boundaries and mono playback; never ship the source WAV. |
| [hargissssound — Rain Loop with Low-Cut Filter](https://freesound.org/people/hargissssound/sounds/321648/) | **Trial backup.** Author removed rumble, but metal drops may be distracting during focus. Compare against the first candidate at matched loudness. | CC0; 3:50 stereo, 84.2 MB source. Not an automatic quality upgrade because filtering can thin the sound. |
| [tripjazz — Fireplace](https://freesound.org/people/tripjazz/sounds/394754/) | **Trial first for hearth.** Short mono source suits a restrained object layer and a low memory budget. | CC0; 25.228 seconds, 44.1 kHz, 2.1 MB WAV. Source does not establish seamless looping; edit and audition the seam and sharp crackles. |
| [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds) | **Trial two or three sounds only.** Soft placement confirmation and a subdued completion cue, selected after audition. Avoid sounding every hover or tiny timer event. | Official page specifies 100 files, CC0. Free-download pack; no exact filename or timbre is claimed without inspecting it. Trim/attenuate derivatives and retain manifest. |
| [Kevin MacLeod — Dream Culture](https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1300046) | **Defer shipping; audition as music direction.** 3:34 piano/percussion, 70 BPM; reverse effects may distract. One repeated song is insufficient for long sessions. | Track page explicitly offers CC BY 4.0 attribution. Free attributed route; paid/unattributed terms not researched. Keep author/title/source/license and disclose edits if used. |
| Original synthesized chime | **Adopt as a first prototype option.** One quiet two-note completion cue can be authored in code with no media request and a controlled envelope. | No external recording license, provided it is original. It still needs headphone/speaker audition and explicit notification-volume control. |

CC BY allows commercial adaptations but requires appropriate credit, a license link and change disclosure; “royalty-free” is not equivalent to no obligations. [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/). For a future commissioned soundtrack, obtain explicit rights covering in-app looping, editing/crossfades, web/native distribution and recorded promotional use; price is **unknown until quoted**. Do not promise streaming-service tracks or embed random “lofi” playlists as distributable game assets.

### Acceptance gates before any audio ships

1. **Listen, don't infer:** at least a full focus-length listening session, headphones and small speakers, with rain alone/fire alone/both; inspect periodicity, rumble, aggressive transients and any voices/music in field recordings. Verify ten loop joins audibly after encoding.
2. **Browser behavior:** fresh Chrome/Firefox/Safari and real iOS/Android gesture unlocking; blocked autoplay and failed network/decode; rapid mute/unmute; volume zero; system interruptions; background/foreground; room switching and hot disposal.
3. **Event correctness:** exactly one completion cue for a completed session, none for pause/reset/abandonment, no replay on visibility refresh, and no multiplication across tabs. Audio is supplementary to visible/text feedback.
4. **Performance:** record encoded transfer, decoded memory estimate and active node count. Float32 decoded PCM scales as seconds × sample rate × channels × four bytes: a 30-second 48 kHz stereo buffer is about 11.5 MB before overhead. Long music should stream. Rendering must remain suspended while hidden and demand-driven in reduced motion.
5. **Persistence:** remember user volumes/choices, not a transient playing node; restore silence until gesture requirements are met. Show a useful loaded/loading/error state without trapping the user in a spinner.

## Recommended order and stop conditions

First establish one matched rendering capture and the small audio abstraction. Next audition the rain/fire pair and completion cue, then test the lifecycle and actual focus experience. Only after that trial one textile treatment and one instancing candidate if captures point to repeated static draws. Keep every experiment removable and publish measured outcomes, including failures.

Stop a visual trial if it cannot be distinguished at the normal whole-room camera, weakens furniture readability, adds idle frames or fails the existing navigation/editor checks. Stop an audio trial if the loop becomes perceptible during focus, creates sharp transients or requires a large eager download. The objective is a more inviting study room with preserved responsiveness, not the maximum number of engine features.
