# Product direction

Little Hours is a cozy place of your own where you and your friends can spend time and study together. A whole-room cutaway view, editable furniture and a visible studying avatar give focus a physical home.

## Core experience

1. Make a room that feels like yours, starting from a beautiful furnished design.
2. Sit your avatar at a study station and start a focus session.
3. See which friends are around, which are focusing and which are taking a break.
4. Visit an invited friend's room and settle in together.

Presence should be obvious without needing to open a profile. **Online** means available in the app; **focusing** means an active focus session; **on a break** means the person has paused. Away/offline is separate. A friend being online must not automatically imply they are working. Pair a small visual signal with a text label so color is not the only cue.

The current prototype shows only the owner's local focus state. Friends, online availability and synchronized room visits require real shared state; the interface must not invent connected people or report local timer activity as network presence.

## Optional companion surfaces

The website/app remains complete on its own. The native Mac notch is an optional extension of the same room and presence experience: a small recognizable room/avatar while collapsed, expanding to show friends and their current study state. A desktop companion can use the same approach. These are additional views into the product, rather than separate social systems.

## Implementation sequence

- Refine room graphics, furniture placement, focus sessions and performance.
- Establish a shared presence model and invite-based friend rooms.
- Add the optional native notch/desktop surface against that same room, focus and presence state.

The exact social interactions and native implementation remain future design work. This records the intended direction; it does not claim those features are implemented.
