# Little moments

In play mode, tap a plant to water it, a tea table or cart for a sip, a
bookcase or armchair to read, or a sofa/pouf to settle down. **Little moments**
offers the same four choices through keyboard and touch controls. Its choices
come from the pieces currently placed in the room. It tries another matching
piece when the first one cannot be reached; reading prefers an armchair.

These are quiet, temporary activities. They add no needs, chores, rewards, or
saved state. A running focus timer takes priority and is never paused by an
item tap. Starting focus during a moment sends the companion back to its desk.
Door travel and editing take priority as well. Moving or removing a piece
releases its activity. Repeated taps never stack a queue of actions.

Normal motion uses the existing floor routes, pet avoidance, and prop rig.
Tea adds one batched cream mug, held between the hands for one slow sip.
Tea steam, shelf movement, and leaf rustle happen after arrival. Under reduced
motion the companion takes a still pose at the chosen piece and remains still
until another action; no new animation loop is requested.

## Integration

- `item-interactions.js` maps existing furniture to four moment kinds.
- `companion.requestInteraction(itemId)` returns `{ ok, reason }` or
  `{ ok: true, itemId, kind }`; it never changes furniture or session data.
- `room.interactWithItem(itemId)` adds notices and render invalidation.
  `room.interactWithKind(kind)` tries the matching placed pieces, with one notice
  for the final result. Play-mode picking calls the same item API.
- `moments-ui.js` mounts its own small panel in the room stage. The main app
  supplies layout, focus, and visibility state; existing settings and wardrobe
  panels retain their own markup and styles.
- `furniture.js` adds the mug and tea arm pose next to the book/watering can.
  Avatar proportions, wardrobe geometry, camera framing, and door travel are
  owned by the parallel polish/whole-house work.

## Verification

`npm test`, `npm run verify:room`, and `npm run build` are the repository checks.
The interaction tests cover all six designs, route clearance, action completion,
focus interruption, blocked pieces, editing/travel guards, layout changes,
reduced motion, and a cup that stays attached without allocating meshes per sip.
The room harness uses actual Babylon picking and checks reactions after arrival.

Browser checks include the 390 × 844 phone layout, keyboard Escape, a direct
furniture tap, choosing tea/watering, and disabled actions during focus. A local
visible-tab sample in Ember library measured 60 fps, 17.6 ms p95 frame interval,
and 3.0 ms p95 CPU render during tea at pixel ratio 2. These are local measurements,
not a device-wide performance guarantee; CPU render excludes GPU time.
