# Focus timer

Focus sessions earn coins for the house: 1 coin per minute, from 5 minutes up.

- Path: `#start-button` starts and pauses; `#timer` shows time left; `#reset-session` resets. `#task` names the session. Completion shows `#session-celebration` and adds to `#today-total` and `#coin-balance`.
- Dial: before a session starts, `#timer-ring` is a slider for 1 to 120 minutes (1 to 10 by one, then steps of 5). Drag round the ring, or use the arrow keys, Page Up/Down, Home and End. The 25/50/90 buttons (`[data-minutes]`) stay. Once a session starts the ring shows time left and cannot be dragged. The arc has no transition while settable, so it follows the drag at once.
- Greenhouse plant: one plant in the seed bed grows in 5 stages (seed, sprout, youngling, budding, bloom) as the session runs, and blooms when the timer ends. Timers under 5 minutes stop at budding. `room()` gives `plantPhase`. Seeds `greenhouse-<seed|sprout|youngling|budding|bloom>` hold a paused session at that stage.
- `app.reload()` restarts the pinned clock at the start time, so reload only while the timer is paused.
- Time is pinned, so the timer only moves as the pinned clock moves. Completion is covered by `e2e/timer.spec.js` (`npx playwright test`).
- Flow: `lh run timer`.
- What breaks: the timer running in a hidden tab at full cost; coins not added on completion; the celebration showing twice; the dial lagging behind the drag; the dial still draggable during a session; the plant stage not following the time left.
