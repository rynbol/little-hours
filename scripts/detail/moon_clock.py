import math
from kit import cylinder, lathe, rbox, sphere, torus
from picture_frame import crescent, ellipse, ring, slab, star

BRASS, DIAL, WALNUT = '#bf9762', '#e5d4ac', '#503d30'
NIGHT, GOLD = '#3f4a6b', '#e8c079'
FACING = (math.pi / 2, 0, 0)
CENTRE = 0.39
EYE = (0.3, 0.3, 1.0)
AO = 0.55


def bezel():
    profile = [(0.36, 0.0), (0.41, 0.0), (0.428, 0.01), (0.432, 0.03), (0.428, 0.05), (0.418, 0.066), (0.404, 0.078), (0.392, 0.082),
               (0.384, 0.078), (0.378, 0.084), (0.372, 0.088), (0.366, 0.085), (0.36, 0.08)]
    parts = [lathe(profile, (0, CENTRE, 0), BRASS, segments=48, surface='metal', layer='metal', rotation=FACING)]
    for i in range(24):
        a = i / 24 * math.tau
        parts.append(sphere((0.008, 0.008, 0.005), (math.cos(a) * 0.4, CENTRE + math.sin(a) * 0.4, 0.078), BRASS, subdivisions=1, surface='metal', layer='metal'))
    return parts


def dial():
    profile = [(0.0, 0.08), (0.37, 0.08), (0.37, 0.093), (0.366, 0.0975)] + [(r, 0.0975) for r in (0.33, 0.28, 0.2, 0.12, 0.06, 0.0)]
    parts = [lathe(profile, (0, CENTRE, 0), DIAL, segments=48, surface='paper', rotation=FACING)]
    arch = ellipse(0, CENTRE, 0.27, 0.27, 0.35, math.pi - 0.35, 18) + ellipse(0, CENTRE, 0.14, 0.14, math.pi - 0.35, 0.35, 12)
    parts.append(slab(arch, 0.0975, 0.0012, NIGHT, surface='paper'))
    parts.append(crescent(-0.1, CENTRE + 0.19, 0.04, 0.0987, GOLD, tilt=0.35, layer='paint'))
    for x, y, r in ((0.02, 0.23, 0.012), (0.1, 0.19, 0.009), (0.17, 0.12, 0.008), (-0.18, 0.1, 0.007), (0.05, 0.16, 0.006)):
        points = [(x + math.cos(math.pi / 2 + k * math.pi / 4) * (r if k % 2 == 0 else r * 0.4), CENTRE + y + math.sin(math.pi / 2 + k * math.pi / 4) * (r if k % 2 == 0 else r * 0.4)) for k in range(8)]
        parts.append(slab(points, 0.0987, 0.0008, GOLD))
    parts.append(torus(0.335, 0.0016, (0, CENTRE, 0.0977), WALNUT, major_segments=48, minor_segments=4))
    for i in range(12):
        a = i / 12 * math.tau
        size = 0.024 if i % 3 == 0 else 0.017
        parts.append(sphere((size, size, 0.007), (math.cos(a) * 0.31, CENTRE + math.sin(a) * 0.31, 0.1), WALNUT, subdivisions=2))
    for i in range(60):
        if i % 5:
            a = i / 60 * math.tau
            parts.append(rbox([0.003, 0.014, 0.002], (math.sin(a) * 0.345, CENTRE + math.cos(a) * 0.345, 0.0985), WALNUT, bevel=0, rotation=(0, 0, -a)))
    parts.append(cylinder(0.028, 0.028, 0.008, (0, CENTRE, 0.1), BRASS, segments=20, bevel=0.003, surface='metal', layer='metal', rotation=FACING))
    return parts


def case():
    top, bottom = 0.055, -0.815
    height = top - bottom
    parts = [rbox([0.31, height, 0.03], (0, (top + bottom) / 2, 0.022), WALNUT, bevel=0.01, surface='wood')]
    parts.append(ring(0.31, height, [(0.0, 0.035), (0.0, 0.058), (0.008, 0.066), (0.02, 0.07), (0.028, 0.066), (0.034, 0.06), (0.04, 0.058), (0.04, 0.035)], WALNUT, centre=(0, (top + bottom) / 2)))
    window = [(0.105, -0.72)] + ellipse(0, -0.08, 0.105, 0.09, 0, math.pi, 14) + [(-0.105, -0.72)]
    parts.append(slab(window, 0.037, 0.004, NIGHT))
    for x, y in ((-0.06, -0.2), (0.07, -0.33), (-0.05, -0.5), (0.06, -0.62), (0.0, -0.12)):
        parts.append(star(x, y, 0.012, 0.041, '#f3dfa6'))
    for side in (-1, 1):
        x = side * 0.132
        parts.append(lathe([(0.0, 0.0), (0.016, 0.0), (0.018, 0.02), (0.012, 0.04), (0.012, 0.66), (0.018, 0.68), (0.016, 0.7), (0.0, 0.7)], (x, -0.77, 0.058), WALNUT, segments=12, surface='wood'))
    parts.append(rbox([0.37, 0.05, 0.075], (0, -0.79, 0.04), WALNUT, bevel=0.016, surface='wood'))
    parts.append(rbox([0.33, 0.02, 0.07], (0, -0.755, 0.04), WALNUT, bevel=0.008, surface='wood'))
    parts.append(lathe([(0.0, 0.0), (0.03, 0.0), (0.04, -0.02), (0.03, -0.04), (0.012, -0.055), (0.0, -0.065)][::-1], (0, -0.815, 0.04), WALNUT, segments=16, surface='wood'))
    parts.append(sphere((0.012, 0.012, 0.012), (0, -0.885, 0.04), BRASS, subdivisions=1, surface='metal', layer='metal'))
    parts.append(rbox([0.05, 0.03, 0.012], (0, 0.13, 0.086), BRASS, bevel=0.004, surface='metal', layer='metal'))
    return parts


def finial():
    parts = [lathe([(0.0, 0.0), (0.03, 0.0), (0.034, 0.012), (0.02, 0.03), (0.012, 0.05), (0.0, 0.052)], (0, CENTRE + 0.425, 0.04), BRASS, segments=16, surface='metal', layer='metal')]
    parts.append(crescent(0, CENTRE + 0.52, 0.04, 0.034, BRASS, tilt=math.pi / 2 + 0.3, layer='metal'))
    return parts


def build():
    return bezel() + dial() + case() + finial()
