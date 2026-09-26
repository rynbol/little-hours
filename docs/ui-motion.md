# Motion for making a home

This follow-up adds a visible response to house editing and the shared interface. Avatar customization is excluded.

- Buttons compress on press and spring on release, including keyboard activation and controls replaced by rendering. A held press stays cancellable until release.
- Furniture and design cards rise on hover, tilt their original SVG artwork, and enter in a short stagger. Wall, floor, art and color swatches retain feedback when replaced.
- Utility panels, the decorating drawer, design descriptions and room-detail paper have distinct entrances. Changing a room design also reveals the new room canvas.
- Selecting an owned room lifts it; previewing a design springs that room around its own origin. Building has a longer room spring, existing 3D petals, a badge response and a bounded blossom burst. Opening the house introduces its rooms in sequence.
- The renderer restores temporary transforms before applying floor movement, camera framing or resize. Frozen geometry matrices and shadows follow the motion; picking uses the moved geometry. Effects allocate no additional scene geometry or animation loop.
- Reduced motion cancels immediately, hidden tabs settle, and particles clean themselves up. UI effects use the Web Animations API with at most 36 blossom/heart particles and 12 staggered cards. No input is delayed or locked for an animation.

## Verification

Node 24: 130 tests pass, `npm run verify:room` passes, and the production build passes (existing large-chunk warning).

The house tests cover exact resting transforms, rapid replacement, floor changes during motion, pivot location, frozen bounds, reduced motion, and picking during a bounce. Camera checks include portrait/wide ratios, open/closed floors, both turning limits and sampled spring poses.

Visible browser checks used the isolated `/checks/motion.html` fixture: room selection, style changes, both room purchases, simultaneous floor changes, before/after preview, mobile 390×844 framing, furniture categories, swatches, placement selection, design-gallery reveal, a held press and reduced motion. New effects settled to zero; reduced-motion editing produced zero UI/room effects. Held press returned from scale 0.93 to its normal size with no retained animation. No console errors were observed.

A two-room preview measured 60 frames in 2 seconds, 13 draw calls and 181,100 triangles, with zero hidden-room frames. This is an observation on the development machine, not a device-performance guarantee. The viewport override was reset after mobile checks.

The fixture uses an in-memory save with test coins and exposes measurements in its toolbar; it never alters player storage or ships in the production entry point.
