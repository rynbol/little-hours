# Pets at home

The pet should provide company in the room. Care should feel pleasant before a heart counter moves. Feeding spends earned coins, friendship belongs to the player and pet, and returning after a break never harms the relationship.

## Scope and completion gates

- Replace the full pet page with a compact card alongside the live room, with a useful phone layout. Direct pet taps open care without losing petting or carrying.
- Add coin-paid meals, distinct food choices, persistent fullness, free play with a reward cooldown, and always-available petting. Currency and hearts change together against the latest save.
- Add visible room behavior for meals and toys, an invitation to sit together, and affectionate behavior unlocked by the existing friendship hearts.
- Give pets useful personal belongings and customization visible in the room. Preserve names, coins, adoption wishes, existing hearts and ribbon unlocks.
- Remove pet-pair friendship controls and rewards, the Memory activity log, and the full-page layout. Preserve imported progress without adding duplicate pair hearts to the player bond.
- Make adoption feel like welcoming a pet home. Keep clear prices, custom names, and a saving target.
- Verify real room interactions, phone layouts, keyboard access, reduced motion, persistence, backup, concurrent tabs, and interrupted focus sessions. Compare render performance and memory with main.
- Commit and push coherent checkpoints, obtain an independent review, open and attach a PR, and verify its checks.

## Workflow

1. Ground the current state and capture the old pet page with the existing browser tools.
2. Define and test the care economy and migration. Keep it in the existing per-pet bond so ownership, names, hearts and care have one owner.
3. Replace the page with a room card and implement the physical interactions and personal belongings together. Inspect the live desktop and phone results before calling the design accepted.
4. Replace obsolete friendship journeys with care journeys, and test cross-tab, backup, cooldown and focus boundaries.
5. Run the repository checks, real GPU journeys, before/after screenshots, performance and memory comparison. Review the final diff independently, then open the PR and inspect CI.

Throughput checkpoint: one implementation owner, one bounded independent review near delivery. Research remains with the primary agent. No parallel design agents, following the user's preference.

## Design comparison

A dedicated pet page can show a large illustration but separates the animal from its room. A small floating menu keeps the world visible but has too little space for food, adoption and meaningful customization. The chosen card occupies the timer's side column while care is open. The timer remains available in the header. On phones it follows the room without covering the animal.

A separate care store would duplicate pet identity, backup and concurrent-tab handling. The chosen shape extends each existing `petBonds[id]` with `care`, containing meal/play deadlines, discovered foods and selected belongings. The existing store owns all purchases. The room routine owns temporary walking and animation state, never currency.

Starting balance to verify in play: meals cost 5 coins for 1 heart, with a 20-minute fullness period. Play is free and can animate repeatedly, with a heart reward every 25 minutes. Petting remains free and retains its daily heart reward. Existing focus rewards stay at one coin per minute and one heart per five minutes. No relationship decay.

## Evidence

The new card, care economy, props and friendship behaviors are implemented. The old full-page views and pair reward APIs have been removed. Legacy pair progress remains a bounded archive in saves; it cannot grant new player-pet hearts.

The primary agent compared the live desktop and phone layouts and inspected the room meal and play screenshots. The phone room stays visible above the scrolling card. The project browser flows now exercise the actual bowl, food, toy, saved purchases and adoption instead of the removed illustration page.

Completed checks at this checkpoint: 214 unit tests, all 19 Playwright journeys, the room harness, build, guard (142 files, zero problems), the 26-check care flow, the 25-check existing pet interaction flow, and 104 checks across controls/avatar/timer/doors. Before/after screenshots use the same seed and viewport against main at bf3159d. Performance, heap comparison and PR CI remain pending.

One independent pstack review found two concrete issues. Both were accepted and fixed: changing reduced motion during a care approach now completes arrival and schedules its end; focus completion now gives a brief affectionate reaction that cannot occupy the requested paid meal's care routine. Unit and browser regressions cover both paths. No additional review agents or delegated web research were used.
