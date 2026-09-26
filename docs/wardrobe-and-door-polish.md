# Wardrobe and doorway polish

The wardrobe now pairs a clear, full-body portrait with a warm paper drawer.
Four curated looks provide starting points without changing skin or hair; each
individual choice remains editable. Clothing thumbnails use the selected garment
colors. The footer stays reachable while the choices scroll on small screens.

The companion uses softer proportions, knit cuffs and pockets, connected hair
shapes, a finished overalls bib, and crescent moon clips. Correctly transformed
normals and a dedicated portrait fill keep skin and clothing consistent across
poses. The portrait uses the same companion and a separate camera layer, so room
objects remain intact. Appearance and theme changes preserve portrait lighting;
closing, quickly reopening, resizing, and switching reduced motion restore the
right camera and room lights. Focus pauses in the wardrobe and resumes on exit
only if it was running on entry.

Connected doors have painted panels, flower glass, arched frames, and threshold
details. Both door taps and room chips use the same walking journey. A small
travel card follows actual journey progress, and conflicting controls are
disabled until arrival. Active focus still requires an explicit pause before a
room walk. Entering a room to decorate releases the travel lock before opening
the editor.

## Verification

- `npm test`: 115 passing tests, including look persistence and avatar normals.
- `npm run verify:room`: passed, including all outfits in the portrait layer,
  stable mesh counts and lighting, turn/reset, quick reopen, reduced motion,
  door picking and walks, stairs, suspension, disposal, and ready-race behavior.
- `npm run build`: passed. The existing large-bundle advisory remains.
- Visible browser QA clicked all 36 avatar options and all four curated looks,
  checked selection state and save/reload, verified focus pause/resume and one
  completion reward, and confirmed Mini view and Decorate exit into the wardrobe.
- Real UI completion rewards purchased the garden and upstairs rooms. Physical
  door tapping, room-chip walking, upstairs arrival, focus blocking, and reduced
  motion travel all passed with appearance preserved.
- At 320×667, 390×844, 748×1024, and 1280×720: no horizontal overflow, no drawer
  overlap with the portrait canvas, and the Done button remains reachable.
- Live Sakura garden measurement: 60 fps, 17.6 ms p95 frame interval, 3.0 ms p95
  CPU render time, 81 draw calls, 151,912 triangles, pixel ratio 1.0. These are
  measurements from the local desktop browser, not native phone guarantees.

`checks/polish.html` is a development-only browser fixture with isolated session
storage, clock advancement, reduced-motion control, and a DOM runtime report.
It does not use the player's local save and is excluded from the production
entry point. Phone sizes were tested as browser viewports; physical iOS and
Android testing remains a separate release check.

## Integration

Load `wardrobe.css` after general UI styling. Keep the portrait branch of
`fitRoom` when adjusting ordinary room composition. Item-interaction integration
adds a sixth mobile-companion child mesh for the mug; retain that updated
expectation alongside the avatar geometry checks.

## Smooth wardrobe return

The exit now preserves the complete orthographic framing, including its center.
When closing the drawer changes the canvas bounds, it preserves the avatar's
screen position and retargets the pullback to the newly fitted room. Main applies
that resize synchronously to avoid one incorrect frame before ResizeObserver.
On phones, the drawing surface also moves down with the pullback so the newly
exposed room heading cannot clip the portrait. Room controls fade in afterward.

Scenery fades into the pullback, the portrait plinth fades away, and the companion
resumes its routine once the camera has settled. Quick reopen, reduced motion,
and disposal release the transient visibility and canvas animation state.
Regression checks cover screen-position continuity after resizing and the final
projection step. Browser QA covered desktop and 390×844 exits, turned avatars,
Done/Close/Escape, keyboard reopen during return, focus resume, and reduced motion.
