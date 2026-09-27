# A little life, shared

Pets now have a relationship with the person focusing. The pet notebook combines an animated portrait, a personal name, a bond, little rituals, wearable keepsakes, and a memory of the time spent together. Adoption keeps the existing coin prices and gives each pet a personality and a savings wish visible on the focus card.

The first two pets remain free, and existing saves keep every adopted pet. Previous sessions are not retroactively assigned to a pet. Relationships never lose progress while the player is away, and there is no hunger meter or streak.

## The loop

- Choose a pet, give them a name, and try Cuddle, Play, or Treat. Each ritual rewards once per local day. The pet's favorite awards two hearts; the others award one. Every ritual remains available after its reward is claimed.
- Focus with a companion. Sessions of at least five minutes earn one heart per five completed minutes. The pet chosen at the beginning owns the reward, including after a pause, reload, or a mid-session pet switch. The existing session transaction records the reward once.
- At 8, 24, and 60 hearts the bond becomes Little friends, Favorite company, and Home is you. Rose, Sage, and Starlight ribbons unlock and are automatically worn. Honey is available from the start. Ribbons are part of the existing skinned pet mesh.
- Ask the pet to come sit nearby. It uses the existing collision-aware walking routes to reach a clear spot beside the desk or companion. A favorite location also influences its normal wandering.
- Welcome an adopted friend with a chosen name and a first memory. Save toward any waiting pet with a focus wish. Coin prices remain 40 / 90 / 160 for bunny / fox / red panda.
- Keep a 1200 × 1500 PNG portrait with the pet's name, relationship, shared focus time, and an optional “Loved by” dedication. One person or a couple can personalize it on this device. This does not create shared accounts or multiplayer.

## Motion

Cuddles lean into the existing affection rig. Play adds small hops and a pastel ball; Treat adds a biscuit and a nibbling gesture. The ball and biscuit are hidden rigged parts in the pet's single mesh, with no additional draw calls. Carrying or decorating cancels a ritual.

A completed focus session lifts the avatar's hands in a short cheer, gives the pet a happy reaction, and sends a warm star burst above them. The new completion card is nonmodal and leaves the room visible. Focus starts, pet greetings, new adoptions, bond milestones, tea, watering, reading, records, and settling down also have small anchored effects. These reuse the room's frame callback and are bounded to two short-lived overlays, with no independent animation loop.

Reduced motion uses still marks, disables hops and animated portraits, and keeps the original room's quiet rendering behavior. Hidden tabs clear overlay effects and suspend room rendering.

## Verification

`npm test`, `npm run verify:room`, `npm run build`, and `npm run guard` cover persistence, migration, reward boundaries, saved session ownership, malformed saves, ritual cancellation, finite pet geometry, and normal room behavior.

`npm run test:e2e` covers keyboard naming, escaped names, local PNG exports, accessibility, exactly-once completion, backups, and timer behavior. `lh run companions pet timer controls avatar` covers the new journey and existing controls in real Chrome. The companions flow is included in CI.

`LH_FILM=1 npm run lh -- run companions --headed` also records review frames under that run's evidence directory. These are browser captures of real input and rendering. Screenshots: `lh shot pet room --against main`. Performance: `lh perf --view room --against main --rounds 4`. Retention: `lh heap pet --against main`.

The work is a browser prototype. App Store packaging, multiplayer, and a public trailer campaign remain separate product work. The added visual moments and personal portrait provide footage and a shareable object; virality still needs player feedback.
