# Little Hours

Build a browser-first cozy study room. Keep the whole cutaway room visible, like a miniature dollhouse; the user explicitly does not want a first-person camera. Desktop/notch and social features are later stages.

## Development checkpoints

The user requests commits and pushes at meaningful checkpoints. After a coherent change, run the relevant checks, review the diff, commit it, and push the current branch. Use `codex/` for feature branches. Keep credentials, local user paths, generated bundles, and dependencies out of Git.

Use Node 24. Verification commands are `npm test`, `npm run verify:room`, and `npm run build`. For visual or interaction changes, also inspect the running app in the browser; the room harness stubs WebGL and cannot prove visual correctness. Keep browser testing visible when appropriate, as the user requested.

Preserve the distinction between the in-page mini view and future native desktop/notch integration. Use original assets and implementation.
