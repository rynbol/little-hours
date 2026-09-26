# Room controls

The buttons around the room: Ambience (theme and lights), Quality (live frame numbers and Save energy), soft rain, Mini view, the header Focus toggle, Start over, and the skip link.

- Path: the room tools under the stage (`[data-panel="atmosphere"]`, `[data-panel="performance"]`, `#mini-button`), `#sound-button` and `#reset-session` on the focus card, `#focus-toggle` in the header, and the `.skip-link` from the keyboard. Arrow keys move the selected piece in Decorate.
- Flow: `lh run controls`.
- What breaks: a panel that stops closing on Escape or loses focus on close; Mini view left on when the avatar editor opens; the focus card hidden with no way back; Start over leaving focus on a hidden button. Headless Chrome may have no audio, so the rain check accepts the "Audio isn’t available" toast.
