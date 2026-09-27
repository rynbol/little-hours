# Room types (Greenhouse and Star attic)

A room can be a Greenhouse (glass roof, a seed bed) or a Star attic (wood roof, a skylight, a telescope). The type is chosen when a room is built.

- The seed bed must be in every greenhouse. `fitRoomType` in `src/core/room-types.js` puts it on a free wall spot, or swaps it with a small floor piece that can move, and only as a last resort puts it anywhere free. In Cloud loft it sits at the back wall, clear of the aquarium. In Ember library no wall spot exists, so it stays in front of the bookcase.
- Star attic: each finished session is a star in the skylight at night, and 50+ minute sessions are bright stars. They are mainly for the share postcard.
- Seeds: `greenhouse`, `greenhouse-cloud-loft`, `greenhouse-ember-library`, `attic`, `attic-stars`, plus the plant stages in `timer.md`.
- Tests: `src/core/room-types.test.js` (every preset gets one valid seed bed and keeps its pieces). Flows: `lh run doors decorate timer`.
- What breaks: the seed bed overlapping another piece or blocking it; a preset losing a piece to make room; the roof missing after travel.
