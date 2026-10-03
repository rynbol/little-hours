# Stage 2: fight in shapes

The encounter uses one attack table for charge, sweep, stomp and roots. Each wind-up lasts at least 0.85 seconds. A late dodge opens a 1.2-second flurry and a half-second time slowdown. Charging into one of nine standing stones exposes the heart. Phase two starts at half health. The active room pet contributes attacks and a commanded dash, with strength read from its bond and no bond mutation. Defeat returns both actors to camp with the save intact.

## Real play

The `wilds` flow enters through the real Forest button on a seeded clock. It records real key and mouse input, reaches both phases and every attack, wins, leaves and verifies the save. A second fight measures performance without screencast overhead. A third visit deliberately takes undefended hits and records waking at camp with full health and possessions unchanged.

The run `2026-10-03T09-06-12-run` passes 89 checks across the clean companion, Focus and Wilds flows. Movement, jump, dodge, attack, lock, mute and partner skill respond in 5.1–17.2 ms. The unrecorded Retina fight measures 60.002 fps across 1,946 frames, a maximum of 16.8 ms and no frame above 20 ms. The recorded fight includes two stone stuns, two perfect dodges and eight pet hits. Deliberately waiting to observe every phase-two attack leaves the player at 16/120 health; the earlier direct fight wins at 56/120.

Recorded frames were inspected for wind-up, contact, stone stun, phase change, roots, victory and recovery. They exposed fixes the passing checks alone did not catch:

- The original lock view cropped the antlers. The camera now frames the live guardian height and player feet, and searches clear views around or above stones before shortening its boom.
- Unlocking at victory discarded the elevated view and collapsed the camera into the player. The safe orientation and player framing now survive unlock. A recorded-position regression checks the following 60 frames.
- Respawn carried the old camera tracking position into camp. A camera reset now restores the fresh camp view.
- The exposed heart originally scaled about the model origin and floated above the neck. It now scales about its chest anchor.
- The sweep originally stayed above the player's head. Crouching, leaning and folding the neck now bring actual antler vertices through the player-height band, reaching 3.916 m against the authored 3.8 m range and traversing its 2.9-radian arc.
- The encounter continued moving during hit-stop. Boss and pet movement now freeze while fresh damage and victory register immediately; real-time flurry expiration still runs.
- Pet hits could land across visible gaps and the pet could cross standing stones. Hits now require 1.3 m contact, approach stops at 1.2 m, and tangent steering plus swept collision keeps the pet outside the stones.

A fresh picture-only GPT-6.1 Sol judge preferred the wider camera in `judge-camera-1`. It found the guardian and escape space more legible, while noting foreground stone obstruction and actor overlap in projection. This judges temporary combat framing, not finished valley art. The final replay `2026-10-03T09-20-12-run` passes 17/17 checks, including clear victory unlock and a comfortable camera after camp recovery. Both outcome screenshots were inspected. Input responses are 3.8–15.3 ms; the unrecorded fight is 60.002 fps across 1,941 frames, with a 16.8 ms maximum and none over 20 ms. All 768 unit tests, guard (366 files, zero violations), room verification and production build pass.

## Lifecycle and surrounding app

The full run `2026-10-03T08-41-27-run` passes all 26 Forest checks. Its five measured exits after ten fixed warmups record 242,792,060 → 242,744,404 → 242,782,820 → 242,718,004 → 242,797,468 → 242,808,768 bytes, a net increase of 16,708 bytes. Every exit reports zero three.js geometries, textures and shader programs, a lost context, and zero retained Wilds canvases or contexts. Babylon object counts remain stable. The movement sample records 59.8 fps, a 16.8 ms maximum and no frames over 20 ms.

The broad run passes 686/688 checks. Its companion and Focus failures occurred while runtime source was still changing; both pass the subsequent clean run. Runtime source is now held fixed during browser measurements. Across these runs every existing app flow passes. The new flow is included in the CI matrix.

The initial main bundle remains below the requested fork: JavaScript is 4,042,078 bytes versus 4,075,732, and CSS is 179,240 versus 182,028. The Wilds and three.js remain absent from room/island network requests until entry. Room and island renderer code is unchanged from the Stage 1 performance comparison. Audio allocates only after actual input, ignores idle controllers, and releases active voices and its context on exit.

## Remaining scope

The actors and environment are intentionally block-outs at this checkpoint. Climbing, gliding and swimming still need completion before dressing the valley in Stage 3. The terrain, secrets, shopping, progression, Blender models, life, weather, full soundscape and rewards remain required work. No final-game completion is claimed.
