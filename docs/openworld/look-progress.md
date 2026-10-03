# The Wilds look

Claude builds the Wilds look on `claude/wilds-look`. That covers the grass, ground, light and atmosphere, then the player once `CHOSEN.md` names a character. Astra's research and combat work is tracked separately in `progress.md`.

## Done

- `f5259f1` gives the Wilds its own grass, ground paint and palette. There are about 400,000 instanced blades in three wrapping rings. The blades are two-toned and lean in gusts, part around the player and carry rare flower clusters. The terrain paint matches the grass roots and mottles the worn path. Evidence is in `shots/grass/step-1/`.
- `0574d3d` adds real-time sun shadows and a restrained bloom. Trees, the player, the Warden and the pet cast shadows on the grass and ground within 72 m. The light snaps to texels, and a rotated filter keeps low dusk shadows soft. The day sun moved higher and to the side, dusk rose to 21 degrees, and rain was lifted so it reads as overcast. Evidence is in `shots/grass/step-2/`, with four views in three lights.
- The wind sequence is in `shots/grass/wind/`. It has 12 frames, 250 ms apart, from the fixed meadow camera with motion on. Rerun it with `lh shot wilds-wind --sequence <file>`, using a file with `{"durationMs": 2750, "fixedStepMs": 50, "events": []}`. Then keep every fifth frame. With the camera still, the grass changes by a mean of 9 to 10 grey levels per 250 ms and the sky by 0.5. A gust front visibly crosses the left of the field between 2250 and 2750 ms. The dent in the middle is the grass parting around the hidden player. It shows only in shots that hide the player.
- The run sequence is in `shots/grass/run/`. It has 12 frames, 250 ms apart, of the player sprinting about 14 m through the meadow from the gameplay camera with real key input.

## Look pass 1: toward the reference stills

The owner asked for the in-game Wilds to look like the four target stills in `reference/`, with a cool and cute feel. Evidence is in `shots/look-pass-1/`. The before picture is `shots/grass/step-2/wilds-vista-day.jpg`.

- The grey capsule is replaced by a hooded ranger, built in code like the room furniture. She has a moss hood with a rim and a point, big eyes with highlights, blush, an ivory-sleeved tunic, belts with a brass buckle, bracers, charcoal trousers, cuffed boots and a broad steel sword with a bronze guard in her right hand. She is one skinned mesh on 16 bones, so one draw call.
- Her pose comes from `ranger-pose.js`, a pure function of movement and combat state. It covers breathing idle, walk and run strides by distance, jump and fall, landing crouch, climbing, three distinct sword swings timed to `SWORD_COMBO`, and a forward roll for the dodge. `shots/look-pass-1/moves-sheet.jpg` shows run, both cuts, the overhead chop and the roll.
- The old floating sword placeholder beside the player is gone.
- The day sky is a saturated blue with white clouds. Sunlight is warmer, shadows are cooler blue, and trunks are brown. Leaves are brighter and the grass is warmer olive with straw tips. Dusk trunks are brown instead of cream.
- About 217 mossy grey boulders are scattered around the trail. They avoid the path, trees, the spawn and the Warden arena, and the large ones block the player. All of them draw as one thin-instanced mesh.
- Meadow flowers are larger daisies with yellow hearts.
- `lh shot wilds-ranger` is a new close portrait view.

Cost: fight median GPU 8.05 ms against 8.15 ms before, walking 9.10 ms against 8.95 ms, the same draw calls, 60 fps and no frame gaps over 20 ms in either.

Still short of the stills:

- Canopies are still blobby and the far land has no cliffs, lake or layered ridges. Both live in `src/models/world/`, which is outside this work.
- The roll passes through a straight-legged handstand instead of staying a tight ball.
- The ranger's limbs are rigid segments, with no blended clips, so she reads as a cute toy figure rather than the painted adult ranger in the stills.
- The pictures show a stone stag boss and a cat, while the owner picked the Forest Monster and the Wolf. Neither is built yet.
- `src/features/wilds/scene.js` now passes `combatAction: combat.playerAction` to the avatar, and `scene.test.js` has the new day light colours. Both files are Astra's, and `GOAL-3-combat.md` asks for the same `scene.js` line.

## Cost

These are fight benchmark figures at 1280 by 800 and 2x pixel ratio, measured on the Apple M5 Pro. Median GPU frame time was 5.15 ms before the new grass, 6.50 ms with it, 7.30 ms with shadows, and 8.25 ms with bloom and 4x MSAA. Draw calls went from 20 to 30. Rendering held 60 fps while fighting and while walking, with no frame gaps over 20 ms.

## Not done as written

- Tone mapping is dropped. The Forest world shaders already output display colour, and a tone-mapping pass on top washed the frame out. Bloom stays, with image processing off.
- Only the player has a dedicated contact shadow. The pet and the Warden are grounded by the new sun shadows.

## Checklist result

This is Claude's own review of the step-2, wind and run pictures. It is not a blind judge round, and no blind judge has run.

1. Within 25 m no bare ground shows through the grass. Yes. Only the path shows, and that is intended.
2. The grass reads as a soft field, not separate spikes. Yes at gameplay distance and beyond. At 1 m in the ground-level view, blades read as individual blades.
3. No blade has a standout dark root or pale tip. Yes, in all three lights.
4. The far ground matches the near grass with no edge where blades stop. Yes in the vista views.
5. A wave of wind crosses the field in the sequence. Partly. A sheen front crosses in the last three frames, but in stills the motion is subtle.
6. The grass around the player's feet is parted. Yes.
7. The player casts a shadow on the ground and grass. Yes. It shows most clearly in `wilds-player-day` and `wilds-player-dusk`.
8. Trees cast shadows. Yes.
9. Far hills are paler and bluer than near ones. Yes.
10. Nothing in the dusk picture glows that should not. Partly. Tree trunks read pale cream at dusk. Trunk colour lives in `src/models/world/`, which is out of scope here.
11. The picture could be a frame from a game an adult would buy. No, not yet. The grey capsule player, the round toy-like pet, and the blobby canopies still give it away. The ground and light are no longer the weak part.

## Seen while capturing, outside this goal

- In the run sequence the pet follows between the camera and the player and blocks the bottom of the frame from 250 ms on.

## Remaining

- A blind judge round against the owner's reference stills. `wilds-assets/reference/` is still empty.
- The player, after `CHOSEN.md`.
