# Rooms and travel

Moving between built rooms, and building a new one with coins.

- Path: from the house page select a room, then `#enter-house-room`. `#room-title` shows where you are; `#room-travel` shows the trip. Building uses `#build-house-room` and `#build-room-form`.
- Seeds: `one-room-rich` has coins for building; `three-rooms` has everything built.
- Flow: `lh run rooms`.
- The heading pencil edits `#room-title-input`. Enter saves a trimmed name; Escape cancels. Names follow the room through reload, backup, and style changes.
- The house page (`#rooms-button`) is the only way to pick a room; there is no in-room picker, previous/next control or whole-house view. Entering a room uses the shared place transition. Only physical doors use the avatar walk. Reduced motion arrives immediately.
- While focusing, travel is refused with a "Pause your focus session" toast; after a pause it works.
- What breaks: the title not updating after travel; a trip started twice by quick clicks; coins not taken or taken twice; the new room missing after reload (check `app.saved()`).
