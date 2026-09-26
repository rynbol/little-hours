# Decorate

Placing, moving, rotating and removing furniture.

- Path: `#decorate-button` toggles Decorate (`body.is-decorating`). Click an item to select it (`#selection-inspector`); drag it to move; `#rotate-item`, `#remove-item`, `#undo-layout`. `#collection-content` lists items to place.
- Hook target: `screenPoint({ item: '<item id>' })`; `room()` gives the layout.
- Flow: `lh run decorate`. Perf: `lh perf --view decorate --against main`. Leaks: `lh heap decorate --against main`.
- What breaks: a drag that snaps back or leaves the item floating; undo restoring the wrong layout; the layout not saved after reload; meshes or materials piling up after many enter/leave cycles.
