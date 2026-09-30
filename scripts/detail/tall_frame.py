from kit import sphere
from picture_frame import build_frame, cottage, crescent, hill, star

WALNUT = '#503d30'
EYE = (0.3, 0.35, 1.0)


def night_cottage(x0, x1, base, spring, peak, z, frame):
    parts = [hill(x0, x1, base, spring - 0.012, 0.014, 0.4, z, '#5d6f5c', frame=frame),
             hill(x0, x1, base, base + 0.03, 0.012, 2.1, z + 0.009, '#768d6a', frame=frame)]
    parts += cottage(x0 + (x1 - x0) * 0.66, base + 0.028, z + 0.018, 0.62, '#e7dec7', '#9a5b4a', frame=frame)
    parts.append(crescent(x0 + (x1 - x0) * 0.3, (spring + peak) / 2 + 0.004, 0.022, z, '#ffe3a3', tilt=0.5, frame=frame))
    for fx, fy, r in ((0.55, 0.78, 0.007), (0.78, 0.6, 0.006), (0.14, 0.45, 0.005), (0.9, 0.36, 0.005)):
        parts.append(star(x0 + (x1 - x0) * fx, spring + (peak - spring) * fy - 0.01, r, z, '#fff1c8', frame=frame))
    parts.append(sphere((0.012, 0.016, 0.006), (x0 + (x1 - x0) * 0.2, base + 0.03, z + 0.016), '#4e6250', subdivisions=1, surface='leaf', frame=frame))
    return parts


def build():
    return build_frame((1.04, 1.4), (0.88, 1.23), WALNUT, '#3f4a6b', night_cottage, 0.3)
