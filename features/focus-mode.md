# Focus mode

The focus card offers a second way to start or resume the selected session: **Focus mode**. It expands the existing room to the full viewport and waits for the companion to reach the active desk, while preserving the room framing and all room animations. The app chrome and room hints fade away, leaving the full room, working companion, and a small translucent timer near the bottom of the screen. Escape or the subtle close button returns to the regular interface without pausing the session.

The `focus` browser flow checks entry, the whole room and active desk avatar remaining visible, the quieted app interface, timer translucency, exit by Escape and the close button, and that leaving the view keeps the session running. The `focus` screenshot view opens the mode when available and falls back to the regular room on `main` for a before-and-after comparison.

Check the starting, paused, and already-running session paths; the avatar must not disappear if it is still walking back to the desk. Keep the timer faint over both light and dark areas and keep the close control reachable on a phone.
