# Product direction

Little Hours is a cozy place of your own where you and your friends can spend time and study together. A whole-room cutaway view, editable furniture and a visible studying avatar give focus a physical home.

## Core experience

1. Make a room that feels like yours, starting from a beautiful furnished design.
2. Sit your avatar at a study station and start a focus session.
3. See which friends are around, which are focusing and which are taking a break.
4. Visit an invited friend's room and settle in together.

Presence should be obvious without needing to open a profile. **Online** means available in the app; **focusing** means an active focus session; **on a break** means the person has paused. Away/offline is separate. A friend being online must not automatically imply they are working. Pair a small visual signal with a text label so color is not the only cue.

The current prototype shows only the owner's local focus state. Friends, online availability and synchronized room visits require real shared state; the interface must not invent connected people or report local timer activity as network presence.

## A house grown through focus

Start with one furnished studio, with the whole room visible and immediately usable. Completed focus sessions earn one coin per minute (25, 50 or 90); paused, abandoned or reset sessions earn none. The first 25 coins build a garden wing alongside the studio. Another 75 build a hideaway upstairs. These are prototype prices to test, not a commitment to a larger economy.

The house overview shows those three authored spaces together, with a doorway and an exterior stair connecting them. Each extension arrives furnished in a chosen design, and every room keeps its own furniture, colors and name. Designs are decorating styles, not additional owned rooms. Furniture and style changes remain free. Older saved designs remain available, and the current room becomes the starter studio; previously recorded completed sessions receive their coins once.

The overview is a small static model of the saved layouts. Opening it suspends the detailed room; entering a room restores the full scene and its animations. This keeps the growing house from multiplying the cost of rendering three animated rooms. All progression is saved locally for now, with no accounts, real-money purchases or shared wallet.

## Optional companion surfaces

The website/app remains complete on its own. The native Mac notch is an optional extension of the same room and presence experience: a small recognizable room/avatar while collapsed, expanding to show friends and their current study state. A desktop companion can use the same approach. These are additional views into the product, rather than separate social systems.

## Implementation sequence

- Refine room graphics, furniture placement, focus sessions and performance.
- Test whether earning and personalizing three rooms makes returning to focus more appealing; tune the progression before expanding it.
- Establish a shared presence model and invite-based friend rooms.
- Add the optional native notch/desktop surface against that same room, focus and presence state.

The exact social interactions and native implementation remain future design work. This records the intended direction; it does not claim those features are implemented.
