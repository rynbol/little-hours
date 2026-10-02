# The Wilds look

Claude builds the Wilds look on `claude/wilds-look`. That covers the grass, ground, light and atmosphere, then the player once `CHOSEN.md` names a character. Astra's research and combat work is tracked separately in `progress.md`.

## Done

- `f5259f1` gives the Wilds its own grass, ground paint and palette. There are about 400,000 instanced blades in three wrapping rings. The blades are two-toned and lean in gusts, part around the player and carry rare flower clusters. The terrain paint matches the grass roots and mottles the worn path. Evidence is in `shots/grass/step-1/`.
- `0574d3d` adds real-time sun shadows and a restrained bloom. Trees, the player, the Warden and the pet cast shadows on the grass and ground within 72 m. The light snaps to texels, and a rotated filter keeps low dusk shadows soft. The day sun moved higher and to the side, dusk rose to 21 degrees, and rain was lifted so it reads as overcast. Evidence is in `shots/grass/step-2/`, with four views in three lights.

- The wind sequence is in `shots/grass/wind/`. It has 12 frames, 250 ms apart, from the fixed meadow camera with motion on. Rerun it with `lh shot wilds-wind --sequence <file>`, using a file with `{"durationMs": 2750, "fixedStepMs": 50, "events": []}`. Then keep every fifth frame. With the camera still, the grass changes by a mean of 9 to 10 grey levels per 250 ms and the sky by 0.5. A gust front visibly crosses the left of the field between 2250 and 2750 ms. The dent in the middle is the grass parting around the hidden player. It shows only in shots that hide the player.

## Cost

These are fight benchmark figures at 1280 by 800 and 2x pixel ratio, measured on the Apple M5 Pro. Median GPU frame time was 5.15 ms before the new grass, 6.50 ms with it, 7.30 ms with shadows, and 8.25 ms with bloom and 4x MSAA. Rendering held 60 fps while fighting and while walking, with no frame gaps over 20 ms.

## Remaining

- A review against the reference stills.
- The player, after `CHOSEN.md`.
