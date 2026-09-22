# Little Hours

Build a browser-first cozy study room. Keep the whole cutaway room visible, like a miniature dollhouse; the user explicitly does not want a first-person camera. Desktop/notch and social features are later stages.

The product is becoming a room-decorating study game: editable preset rooms, a furniture collection, and study stations for the avatar. Model furniture deliberately in JavaScript with reusable procedural geometry. Avoid generated raster artwork as a substitute for furniture models. Smooth interaction is a priority: measure actual browser performance, batch static geometry, and avoid unnecessary rendering work.

Use Babylon.js as the game engine. The visual direction is an expansive, fantastical and exceptionally cozy study retreat, with layered warm lighting and deliberately detailed furniture. The long-term vision is friends joining rooms to study and an expandable native notch companion showing friends' study presence. Keep that as product direction; current work prioritizes graphics and the solo decorating game.

The room and shared study presence are the core product. Make online availability, active focus and breaks visibly distinct. The notch is an optional extension of that same room/presence system, not a requirement for the website or friends feature. Current local timer status must not imply a live friends connection. See `docs/product-vision.md`.

## Development checkpoints

The user requests commits and pushes at meaningful checkpoints. After a coherent change, run the relevant checks, review the diff, commit it, and push the current branch. Use `codex/` for feature branches. Keep credentials, local user paths, generated bundles, and dependencies out of Git.

Use Node 24. Verification commands are `npm test`, `npm run verify:room`, and `npm run build`. For visual or interaction changes, also inspect the running app in the browser; the room harness uses Babylon NullEngine without a GPU and cannot prove visual correctness. Keep browser testing visible when appropriate, as the user requested.

Preserve the distinction between the in-page mini view and future native desktop/notch integration. Use original assets and implementation.
