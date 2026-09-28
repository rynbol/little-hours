Historical record of PR #1. The current pet design and verification plan are in [Pets at home](pet-care.md).

# A little life, shared

Pets now have a relationship with the person focusing. The full companion page combines an illustrated character, a personal name, a bond, little rituals, wearable keepsakes, and a memory of the time spent together. Together, Friends, and Keepsakes separate daily interactions, pair relationships, and saved mementos. The page suspends the covered room renderer and returns keyboard focus when closed. Adoption keeps the existing coin prices and gives each pet a personality and a savings wish visible on the focus card.

Visible rewards use hearts and completed daily moments use checkmarks, with full labels for screen readers. Decorative subtitles, footer slogans, and repeated encouragement have been removed.

The first two pets remain free, and existing saves keep every adopted pet. Previous sessions are not retroactively assigned to a pet. Relationships never lose progress while the player is away, and there is no hunger meter or streak.

## The loop

- Choose a pet, give them a name, and try Cuddle, Play, or Treat. Each ritual rewards once per local day. The pet's favorite awards two hearts; the others award one. Every ritual remains available after its reward is claimed.
- Focus with a companion. Sessions of at least five minutes earn one heart per five completed minutes. The pet chosen at the beginning owns the reward, including after a pause, reload, or a mid-session pet switch. The existing session transaction records the reward once.
- At 8, 24, and 60 hearts the bond becomes Little friends, Favorite company, and Home is you. Rose, Sage, and Starlight ribbons unlock and are automatically worn. Honey is available from the start. Ribbons are part of the existing skinned pet mesh.
- Ask the pet to come sit nearby. It uses the existing collision-aware walking routes to reach a clear spot beside the desk or companion. A favorite location also influences its normal wandering.
- Welcome an adopted friend with a chosen name and a first memory. Save toward any waiting pet with a focus wish. Coin prices remain 40 / 90 / 160 for bunny / fox / red panda.
- Keep a 1200 × 1500 PNG portrait with the pet's name, relationship, shared focus time, and an optional “Loved by” dedication. One person or a couple can personalize it on this device. This does not create shared accounts or multiplayer.

## Friendships

Friendships begin within the owned pet collection. Each unordered pair has its own progress, memories, and daily rewards. Play together, Share a treat, and Curl up together each award one friendship point per local day. Repeating a scene remains available without extra rewards; going backward in calendar time cannot replay an earlier reward day. No relationship decays.

Choose a friend in Together or use Focus together in Friends. This prepares the next focus session without starting its timer. Starting focus captures both companions, including the choice to focus with one pet. Pausing, reloading, importing a backup, or changing pets and buddy preferences cannot replace that session's company. Finishing at least five minutes gives the pair one friendship point per five minutes in the existing completion transaction.

At 6, 20, and 50 points a pair becomes Finding a rhythm, Two peas in a pod, and Inseparable. Their downloadable portrait gains a botanical frame and rose, sage, then lilac accents. Six points makes the first milestone possible after two days of shared rituals, or sooner through focus. These thresholds are product tuning, not a validated retention claim.

Friendships use canonical pairs of entity IDs, with owned `pet:` entities validated at the state boundary. The domain module accepts a set of allowed entities rather than importing the pet catalog. A future people feature can supply its own entities, validation, consent, persistence, and presentation; this release has no online presence or remote players.

The solo and duo portraits are real local 1200 × 1500 PNG exports. Duo portraits show both chosen pets, both custom names, their relationship, and their shared focus history. The optional dedication works for one person or a couple on this device.

## Motion

Cuddles lean into the existing affection rig. Play adds small hops and a pastel ball; Treat adds a biscuit and a nibbling gesture. The ball and biscuit are hidden rigged parts in the pet's single mesh, with no additional draw calls. Carrying or decorating cancels a ritual.

A completed focus session lifts the avatar's hands in a short cheer, gives the pet a happy reaction, and sends a warm star burst above them. The new completion card is nonmodal and leaves the room visible. Focus starts, pet greetings, bond milestones, tea, watering, reading, records, and settling down also have small anchored effects. These reuse the room's frame callback and are bounded to two short-lived overlays, with no independent animation loop.

A new adoption plays a welcome scene on the companion page. The page uses original SVG scenes with full-body pets, matching ribbon colors, a soft window backdrop, and shared cushions. Play, snacks, and quiet moments have short coordinated character and prop animations. They use bounded CSS animations without another animation loop.

Reduced motion uses still marks, disables hops and animated portraits, and keeps the original room's quiet rendering behavior. Hidden tabs clear overlay effects and suspend room rendering.

## Verification

`npm test`, `npm run verify:room`, `npm run build`, and `npm run guard` cover persistence, migration, reward boundaries, saved session ownership, malformed saves, ritual cancellation, finite pet geometry, and normal room behavior.

`npm run test:e2e` covers keyboard naming, escaped names, local PNG exports, accessibility, exactly-once completion, backups, and timer behavior. `lh run companions friendships pet timer controls avatar` covers the new journey and existing controls in real Chrome. The companions and friendships flows are included in CI. The friendship journey also verifies all three pairs after a third pet is adopted, captures actual PNG output, and checks the phone layout.

`LH_FILM=1 npm run lh -- run companions --headed` also records review frames under that run's evidence directory. These are browser captures of real input and rendering. Screenshots: `lh shot pet room --against main`. Performance: `lh perf --view room --against main --rounds 4`. Retention: `lh heap pet --against main`.

The work is a browser prototype. App Store packaging, multiplayer, and a public trailer campaign remain separate product work. The added visual moments and personal portrait provide footage and a shareable object; virality still needs player feedback.
