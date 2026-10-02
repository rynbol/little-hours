# Wilds style frame

This specification covers one Forest frame with the avatar, Miso, and the Mossback Warden. The playable slice keeps its current art until the frame passes both blind comparisons.

## Forest and atmosphere

The frame uses the existing Forest terrain rings, terrain paint, trees, grass, rocks, clouds, and sky through `createWildsWorld`. Their geometry, materials, and palettes remain shared with the Forest route. The path near the Warden arena provides the composition. The avatar and Miso occupy the foreground. The Warden stands farther along the path with space around its antlers.

The atmosphere values come from `src/models/world/atmosphere.js`.

| Property | Day | Dusk | Rain |
| --- | --- | --- | --- |
| Sun heading / elevation, radians | -0.02 / 0.23 | -0.2 / 0.19 | 0.5 / 0.6 |
| Sun color / strength | `#fff4dc` / 1 | `#ffd49c` / 1 | `#c8ccc0` / 0.4 |
| Sky zenith | `#8fb3c4` | `#7e8a8c` | `#3e443c` |
| Sky high | `#a5c2c8` | `#84918a` | `#4f5649` |
| Sky horizon toward sun | `#cfdcd2` | `#fcbe74` | `#555c4c` |
| Sky horizon away from sun | `#cfdcd2` | `#9aa4a8` | `#555c4c` |
| Sky bands | 0.05, 0.2, 0.28, 0.4 | 0, 0.3, 0.3, 1 | 0, 0.3, 0.3, 1 |
| Sky ambient | `#a9c4d6` | `#8c8a9c` | `#7a8272` |
| Ground ambient | `#8a9a5c` | `#5f6248` | `#4e5642` |
| Dirt bounce | `#a89e74` | `#9a8c6a` | `#8a8064` |
| Shadow tint / lift | `#6f86a8` / 0.42 | `#5f6e80` / 0.38 | `#5e665c` / 0.7 |
| Near fog | `#bcd0cc` | `#91928c` | `#4e5547` |
| Far fog | `#7a9eae` | `#5f7284` | `#4c5446` |
| Sunlit fog | `#dfe8d0` | `#fcbe74` | `#6a6e5e` |
| Fog density / height, meters | 0.0005 / 300 | 0.00042 / 220 | 0.00105 / 200 |

Haze uses the Forest's `WORLD_GLSL.worldAir` function, including its height-dependent mist and directional sun color. It does not use an additional flat fog layer. Distant forms lose contrast gradually. Foreground faces retain their warm color.

## Character shading

Blender supplies the albedo colors and geometry. The renderer evaluates glTF albedo and emission in linear light and converts the resulting radiance to sRGB before the shared Forest haze. Body animation comes only from the Blender clips.

Direct light has three bands. The two `N·L` transitions are centered at 0.15 and 0.58, each with a full width of 0.08. They add 0.24 and 0.26 times the linear sun color and strength. Broad indirect light preserves rounded forms on the shadowed side.

The sky axis is `normalize(-sun.x * 0.4, 1, -sun.z * 0.4)`. Sky fill has weight `0.32 + 0.48 * (0.5 + 0.5 * N·skyAxis)`. Ground fill has weight `0.18 * (0.5 - 0.5 * N.y)`. The sky tint mixes linear sky ambient and shadow tint with a 0.2 shadow fraction. Ground tint mixes linear ground ambient and dirt with a 0.65 dirt fraction. Each tint is divided by its Rec. 709 luminance, then mixed with white at 0.35 sky saturation and 0.45 ground saturation. These fills replace the first revision's constant shadow multiplier, which flattened faces.

The rim uses `pow(1 - max(0, N·V), 3) * smoothstep(-0.2, 0.7, N·L)`, with strengths 0.16 in day, 0.20 at dusk, and 0.10 in rain. Its energy uses the linear sun color. There are no black outlines or glossy highlights. Small eye catchlights and the Warden's heartwood remain readable.

Soft contact shadows ground feet and hooves. They stay beneath the actors and do not become visible solid discs. Geometry carries the face, clothing, fur, stone, and moss detail. No generated raster textures or visible placeholder primitives appear in the frame.

## Proportions and shape

The avatar is 1.75 meters tall with a 0.39-meter head, about four and a half heads high. Its face has cheeks, a chin, a small nose, brows, a mouth, and eyes with catchlights. Chestnut hair has a continuous cap, locks, and a bun. The neck connects to shaped shoulders. Elbows and knees bend in the resting pose. Hands have palms, thumbs, and grouped fingers. The clay cardigan has a collar, cuffs, buttons, and pockets. Sage trousers end at fitted boots. The body has a slight weight shift with planted feet.

Miso is a ginger cat with a cream muzzle and chest, warm eyes, pink inner ears, a small nose, and a curved tail. The model is approximately 0.7 meters tall and 0.85 meters long before its tail. Four bent legs connect to a shaped chest and haunches. Paws have toes. Cheek fur and forehead stripes carry its existing identity.

The Mossback Warden is an original stone-and-moss stag. Its shoulder is approximately 1.8 meters high and its antlers reach 3 meters. Its chest, haunches, long neck, head, bent legs, and cloven hooves form a continuous animal silhouette. Asymmetric branch antlers carry small leaves. Layered moss follows the back and shoulders. Carved stone facets and glowing heartwood give the larger forms detail. Its face has a muzzle, nostrils, ears, and almond-shaped amber eyes.

The authored palette uses these sRGB colors.

| Part | Colors |
| --- | --- |
| Avatar skin, hair, cardigan, trousers, boots | `#d5a27e`, `#59402f`, `#b67e63`, `#71816c`, `#725341` |
| Cat ginger, light ginger, cream, stripes | `#c98546`, `#dfa25d`, `#f4e3bd`, `#915634` |
| Warden stone, light stone, shaded stone | `#92998b`, `#b5b9a4`, `#788473` |
| Warden moss, dark moss, light moss | `#77945d`, `#516b47`, `#9bb772` |
| Warden heartwood, bright core | `#f4bd66`, `#ffe2a0` |

All actors face glTF +Z and stand at local ground zero. Their authored idle poses establish the style frame. Attack clips include anticipation, a readable strike, and recovery, with no JavaScript body keyframes.

## Acceptance

Six scenery pairs compare the frame's environment with actual Forest route captures at matching cameras and times of day. Avatar, pet, Warden, and HUD are hidden. Six character pairs compare the Blender characters with close-ups of the existing room avatar and pets.

A fresh reviewer sees only randomly ordered pictures labeled A and B. The reviewer names the weaker picture and its visible defect, or reports a tie. Each category passes when Wilds is weaker in at most two of its six pairs. Named defects guide the next revision. Each round has one short note under `reviews/`. After six failed rounds, work stops with the unresolved defects recorded. Passing pictures go under `shots/style-frame/`.
