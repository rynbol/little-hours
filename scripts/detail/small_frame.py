from kit import rod, sphere
from picture_frame import build_frame, cottage, ellipse, hill, slab, star

OAK = '#ac8357'
EYE = (0.3, 0.35, 1.0)


def golden_dusk(x0, x1, base, spring, peak, z, frame):
    span = x1 - x0
    parts = [slab(ellipse(x0 + span * 0.62, spring - 0.004, 0.028, 0.028, 0, 6.2832, 20)[:-1], z - 0.001, 0.004, '#ffcf86', layer='glow', frame=frame),
             hill(x0, x1, base, spring - 0.004, 0.012, 1.2, z + 0.003, '#a69bb8', frame=frame),
             hill(x0, x1, base, base + 0.03, 0.014, 3.4, z + 0.01, '#8fa36f', frame=frame)]
    parts += cottage(x0 + span * 0.3, base + 0.03, z + 0.018, 0.55, '#f2ead5', '#b86f55', frame=frame)
    tree = x0 + span * 0.78
    parts.append(rod((tree, base + 0.03, z + 0.02), (tree, base + 0.05, z + 0.02), 0.003, '#6b4a33', sides=6))
    parts.append(sphere((0.014, 0.016, 0.006), (tree, base + 0.062, z + 0.022), '#6f8a55', subdivisions=1, surface='leaf', frame=frame))
    parts.append(star(x0 + span * 0.2, spring + (peak - spring) * 0.55, 0.005, z, '#fff1c8', frame=frame))
    return parts


def build():
    return build_frame((0.74, 1.02), (0.60, 0.86), OAK, '#e7b08f', golden_dusk, 0.24)
