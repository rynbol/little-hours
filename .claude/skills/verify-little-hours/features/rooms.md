# Rooms and travel

Moving between built rooms, and building a new one with coins.

- Path: from the house page select a room, then `#enter-house-room`. `#room-title` shows where you are; `#room-travel` shows the trip. Building uses `#build-house-room` and `#build-room-form`.
- Seeds: `one-room-rich` has coins for building; `three-rooms` has everything built.
- Flow: `lh run rooms`.
- The heading pencil edits `#room-title-input`. Enter saves a trimmed name; Escape cancels. Names follow the room through reload, backup, and style changes.
- `#room-switcher-toggle` opens the illustrated `#room-picker` dialog. `[data-house-go]` cards and `#previous-room` / `#next-room` use a short directional transition, also from whole-house, mini, or decorating views. Only physical doors use the avatar walk. The separate next-room button opens its plan directly. Reduced motion arrives immediately.
- `lh run room-picker` covers keyboard arrows, Home/End, Escape, backdrop dismissal, focus restoration, travel locks, phone bottom sheet, planning, and cancelling a door walk. `lh shot room-picker --against main` compares the picker with the old always-visible cards.
- `lh heap rooms --still --against main` measures repeated room-card travel without animation delays; the shared step supports the old permanent cards on main.
- While focusing, travel is refused with a "Pause your focus session" toast; after a pause it works.
- What breaks: the title not updating after travel; a trip started twice by quick clicks; coins not taken or taken twice; the new room missing after reload (check `app.saved()`).
