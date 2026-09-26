# Little Hours roadmap

Agreed on September 26, 2026. This replaces the old product-direction note and the per-feature logs. Git history keeps the old notes.

## The goal

Make a game good enough to spread on the App Store, on San Francisco tech Twitter (through a trailer), and among girls, couples and friends who study together. Every change must fit the cozy Little Hours look and feel.

## What is true now (main, `cc08d9e`)

- One furnished studio to start. A completed focus session earns 1 coin per minute (25, 50 or 90). The garden wing costs 25 coins and the upstairs hideaway costs 75.
- Each room keeps its own furniture, colors and name. A *design* is a decorating style, not a room you own.
- The house page shows the rooms as open boxes side by side on a flat plot. The only roof is a small strip at the back.
- Porch doors and stairs link the rooms. The avatar walks to a door before it goes through. A door to an unbuilt room opens a little and then shows the house page for that room.
- All saves are local. There are no accounts, no sync and no real-money purchases.

## Decisions

| Question | Decision |
| --- | --- |
| House look | **A dollhouse that opens.** A closed cottage with a real roof. Tap a room and the house opens to show it. |
| How many rooms | A few for now. More rooms come later. |
| Where rooms go | Fixed spots that we choose. Letting the player choose where to build comes later, as another use for coins. |
| Room variety | Each room gets a *type* that changes how it looks from outside, what furniture it has and what the avatar does there. |
| Studying together | A **priority**. Long-distance: each person on their own device. For partners **and** friends. |
| Graphics tools | Drawing in JS and adding libraries are both allowed when they help. |
| Server for sync | **Not decided.** We will discuss it before chunk 3. |

## The work, in chunks

Each chunk is one large piece of work. Each one ends with a preview for approval before it goes to main.

### Chunk 1: The dollhouse (the house page)

- The closed cottage: a pitched roof, a chimney with smoke, windows that glow at night, and a garden plot with a path and a fence.
- Tap a room: the roof lifts and the front swings open, then the camera moves in. Step back and the house closes.
- The next room to build shows as a dotted blueprint, with its price.
- **First step:** still frames from the real engine for approval. Build only after a yes.
- **Done when:** the roof is visible, the house opens and closes with real clicks in Chrome and Firefox, reduced motion has no motion, and speed is the same as main.

### Chunk 2: Room types

- A room has a `type` that is separate from its design.
- The three fixed spots: the studio, the **Greenhouse** (glass roof, plants that grow with focus time) and the **Star attic** (a skylight, a telescope, stargazing at night).
- Each type has its own look from outside, its own furniture set and one new break activity.
- Old saves keep working. The save format is ready for more spots and for player-chosen building.
- **Done when:** the new save format is final. Chunk 3 syncs this format.

### Chunk 3: Studying together, the foundation

- Accounts, and pairing with an invite link or a 6-letter code.
- A shared house that syncs between devices. Shared coins go toward shared rooms.
- It works offline and catches up later.
- Sync starts only after you pair or join. Solo play stays fully local.

### Chunk 4: Study together

- Live presence: each person is shown as **online**, **focusing** or **on a break**, with a text label and a small signal, not color alone. Offline or away is a separate state. Being online must never show as focusing. The app must never invent people or show local timer state as someone else's live state.
- Shared sessions: one person starts and the others join, with one timer for everyone. There is a bonus for finishing together.
- A partner's or friend's avatar appears in the house and can visit on breaks.
- A **Rooftop garden** for two, built with shared coins: fairy lights and a swing seat.

### Chunk 5: The house in every room

- A small live model of the house on a shelf in the corner of each room. The current room glows, and a partner's room glows while they are in it. The next room shows as an outline with progress, for example "Greenhouse · 18 / 40".
- Tap it to open the house page. It redraws only when the house changes.

### Chunk 6: Trailer polish

- A shot mode that plays set camera moves (night, the lights come on, the roof opens, two avatars inside) for recording the trailer.
- An updated house postcard.
- A final pass on speed and on phone-size screens.

### Order

1 → 2 → 3 → 4 → 5 → 6. Chunk 2 comes before chunk 3 so the synced save format is final first. Chunks 3–4 barely touch the 3D code, so they can run in a second session at the same time as chunks 1–2, on their own branch.

## Later

- More rooms, and the player chooses where to build them.
- The optional Mac notch or desktop companion, showing the same room and the same presence. The website stays complete without it.

## Open questions

- Which server for sync and accounts. Decide before chunk 3.
- Group size for study sessions with friends.

## Rules to keep while building

- **Checks:** run `npm test`, `npm run verify:room` and `npm run build`. Drive the real app in Chrome and Firefox with real input. Measure speed against main, and add no new work per frame.
- **Test pages:** `checks/house.html`, `checks/whole-house.html`, `checks/motion.html` and `checks/polish.html` use their own test saves and never touch a player's save. They are not in the production build.
- **CSS order:** load `house.css` after `ui.css`, and load `wardrobe.css` after the general UI styles.
- **Wardrobe:** keep the portrait branch of `fitRoom` when changing the room framing.
- **House rebuilds:** a house rebuild keeps each room that did not change (see `createHouseModel`'s `previous` argument). New house parts must be batched the same way.
