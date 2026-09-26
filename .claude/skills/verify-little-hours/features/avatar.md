# Avatar editor

Choosing the avatar's look and turning it to check it.

- Path: `#avatar-button` opens it (`body.is-avatar-editing`); `#avatar-turn-left`, `#avatar-turn-right`, `#avatar-face-front`, `#avatar-reset`; `#avatar-done` closes it. The timer pauses while it is open (`#avatar-pause-note`).
- Flow: `lh run avatar`. Leaks: `lh heap avatar --against main`.
- What breaks: the camera not returning to the room view after Done; a choice lost after reload; the timer not resuming.
