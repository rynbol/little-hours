# Focus timer

Focus sessions earn coins for the house.

- Path: `#start-button` starts and pauses; `#timer` shows time left; `#reset-session` resets. `#task` names the session. Completion shows `#session-celebration` and adds to `#today-total` and `#coin-balance`.
- `app.reload()` restarts the pinned clock at the start time, so reload only while the timer is paused.
- Time is pinned, so the timer only moves as the pinned clock moves. Completion is covered by `e2e/timer.spec.js` (`npx playwright test`).
- Flow: `lh run timer`.
- What breaks: the timer running in a hidden tab at full cost; coins not added on completion; the celebration showing twice.
