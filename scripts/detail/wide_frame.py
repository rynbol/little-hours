from kit import rbox
from picture_frame import build_frame, cottage, ellipse, hill, slab, star

UMBER = '#6b4b3b'
EYE = (0.3, 0.35, 1.0)


def moonlit_lake(x0, x1, base, spring, peak, z, frame):
    span = x1 - x0
    moon = x0 + span * 0.6
    parts = [slab(ellipse(moon, spring + 0.024, 0.02, 0.02, 0, 6.2832, 20)[:-1], z, 0.005, '#fff0c2', layer='glow', frame=frame),
             slab([(x0, base), (x1, base), (x1, base + 0.03), (x0, base + 0.03)], z + 0.001, 0.003, '#56688a', frame=frame),
             hill(x0, x0 + span * 0.5, base + 0.02, spring - 0.006, 0.016, 0.3, z + 0.004, '#5f7a63', frame=frame, shore=(False, True)),
             hill(x0 + span * 0.56, x1, base + 0.02, spring - 0.016, 0.012, 1.8, z + 0.004, '#6f8a6a', frame=frame, shore=(True, False))]
    for k, width in enumerate((0.03, 0.022, 0.014)):
        parts.append(rbox([width, 0.003, 0.003], (moon, base + 0.024 - k * 0.008, z + 0.006), '#ffe7a8', bevel=0.001, layer='glow', frame=frame))
    parts += cottage(x0 + span * 0.2, base + 0.028, z + 0.012, 0.6, '#e7dec7', '#8c5a4c', frame=frame)
    for fx, fy, r in ((0.35, 0.75, 0.006), (0.82, 0.62, 0.005), (0.48, 0.35, 0.004), (0.14, 0.5, 0.004), (0.92, 0.3, 0.004)):
        parts.append(star(x0 + span * fx, spring + (peak - spring) * fy, r, z, '#fff1c8', frame=frame))
    return parts


def build():
    return build_frame((1.5, 1.04), (1.32, 0.86), UMBER, '#4d5580', moonlit_lake, 0.42)
