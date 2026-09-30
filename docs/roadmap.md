# Little Hours roadmap

Agreed on September 26, 2026. This replaces the old product-direction note and the per-feature logs. Git history keeps the old notes.

## The goal

Make a game good enough to spread on the App Store, on San Francisco tech Twitter (through a trailer), and among girls, couples and friends who study together. Every change must fit the cozy Little Hours look and feel.

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

## The revamp

Agreed on September 29, 2026, after a review of every view on main at `fa785c2`. The revamp comes before chunks 3 to 6. It changes how the game looks and feels. It does not change the save format that chunk 2 made final.

### What is wrong now

- **Four art styles.** The room is warm, lamp-lit and detailed. The island is pastel with plain white walls. The garden is pale sage on a flat cream background. The pond is flat-shaded low poly in hard light, and the red-roofed house behind it is not the player's house.
- **A web app on top of a game.** The room page has a header, four ways to change rooms (My house, Whole house, the Rooms arrows and the picker), a bottom bar and a cream card with Session settings and Your progress. On a phone the room fills about a third of the screen.
- **Too many small collections.** One finished session pays into coins, the garden, Pip, pet hearts and pet gifts at the same time. Pets also have belongings and friendship. Pip has 20 finds and 6 colours, the pond has a journal and bait. Nothing is *the* reward, and most rewards arrive as a text card.
- **Two companions with the same job.** Miso gives gifts and Pip brings finds.
- **The room is the best part, but nothing happens in it.** Rewards appear in the garden, the pond or a card. Focus shows the same room with a timer pill.

### Decisions

| Question | Decision |
| --- | --- |
| Art style | **One style everywhere: the room's.** Warm local light, soft shapes, consistent ground shadows, detailed furniture. The island, garden and pond follow it. |
| The pond and garden | The house behind the pond is the player's own house. Long term, the pond and garden are closer views of the same island, not separate worlds. |
| Rooms or one big house | **Rooms stay, in one continuous house.** Zoomed out, the whole cutaway house is alive on the island. Tap or pinch a room and the camera glides in until it fills the screen, with no fade. The avatar walks through real doorways and stairs. Only the current room draws at full detail. |
| The room page | **The room is the whole screen.** The timer is a small on-screen pill with the time and Start. A desk candle or clock was rejected because at about 10 px on screen it cannot be read. The room shows time passing as mood (see Focus). Tap Miso or Pip in the room. One button for the house. |
| Focus | **Time passes in the room.** The window sky moves from dusk to night, the candle burns down, the tea stops steaming, Miso falls asleep. A long session looks different from a short one. |
| The reward | **Pip brings back real things.** Pip leaves when a session starts and returns with a find that is a piece of furniture for the room. The room becomes a record of study time. Coins stay in the background. |
| Caught fish | **Fish you catch live in an aquarium in your room.** The aquarium shows each fish you have actually caught, using the same fish models as the pond. A new catch swims into the tank. It is another way the room records your time, and it gives fishing a reason beyond the journal. |
| Completion | **A short scene in the room.** The candle goes out, Pip flies in through the window with the find, Miso comes to look. It can be skipped and it honours reduced motion. It is the first shot of the trailer. |
| Companions | **Miso stays, Pip explores.** Miso keeps you company while you study. Pip goes away and comes back. Pet gifts and belongings stop overlapping with Pip. |
| Breaks | **Breaks go outside.** A break is the time to fish, water the garden or walk the island, with a clear way back to studying. |
| First session | A new player gets a short 5-minute session, a guaranteed good find and the completion scene. |

### Cut

The Rooms arrows and Whole house, Session settings and Your progress, Pip's colours, the pet's belongings and friendship sections, and the bait economy. The fish journal is under review, because the aquarium may replace it. Cuts must keep old saves loading.

### Order

1. **One art style.** Rebuild the pond in the room's style with the player's own house, then bring the garden and island in line. Each step ends with before and after images for approval.
2. **The room as the whole screen**, with a small timer pill.
3. **Time passing during focus.**
4. **Pip's finds as furniture and the completion scene.** The aquarium of caught fish belongs to this step. The fish models come from PR #11 and the aquarium from the `claude/aquarium-fish` work.
5. **Companion roles, breaks outside and the first session.**
6. **One continuous house** with the zoomed-out and zoomed-in views.

Friends see each other's windows lit while studying and dark on a break. That is chunks 3 and 4 below and still waits for the sync server decision.

## The work, in chunks

Each chunk is one large piece of work. Each one ends with a preview for approval before it goes to main.

### Chunk 1: The dollhouse (the house page), done

- The closed cottage: a pitched roof, a chimney with smoke, windows that glow at night, and a garden plot with a path and a fence.
- Tap a room: the roof lifts and the front swings open, then the camera moves in. Step back and the house closes.
- The next room to build shows as a dotted blueprint, with its price.
- **First step:** still frames from the real engine for approval. Build only after a yes.
- **Done when:** the roof is visible, the house opens and closes with real clicks in Chrome and Firefox, reduced motion has no motion, and speed is the same as main.

### Chunk 2: Room types, solo first

Changed on September 26, 2026: solo first, friends later (chunks 3 and 4). The idea is still being developed and may be reworked.

- A room has a `type` that is separate from its design.
- The three fixed spots: the studio, the **Greenhouse** and the **Star attic**.
- **Timer dial:** drag the seed around the ring to set 1 to 120 minutes (1 to 10 by ones, then steps of 5). Arrow keys work too. The 25, 50 and 90 buttons stay as shortcuts. Coins are 1 per minute, from 5 minutes.
- **Greenhouse:** one plant regrows each session. It goes seed, sprout, youngling, budding, bloom as the timer runs, so a longer timer grows it more slowly. Under 5 minutes it stops at budding. Pausing keeps its stage; Start over plants a new seed.
- **Star attic:** a skylight and a telescope. Each finished session is a star, and sessions of 50 minutes or more are bright stars. The stars are mainly for a postcard (share card); in the room they are too small to read.
- Each type has its own look from outside, its own furniture and one new break activity (water the plant, stargaze).
- The save format keeps a log of finished sessions (when, how long, which room).
- Old saves keep working. The save format is ready for more spots and for player-chosen building.
- **Done when:** the new save format is final. Chunk 3 syncs this format.
- Gifts (send a friend a piece of furniture) move to chunk 4.

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
- Gifts: send a friend a piece of furniture bought with your coins.

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
- Whether the one continuous house (revamp step 6) should come before the room changes (steps 2 to 5).
- Whether the aquarium replaces the fish journal.
