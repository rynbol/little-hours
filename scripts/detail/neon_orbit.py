import math
from kit import cylinder, rbox, rod, sphere, torus, tube
from picture_frame import ring

BOARD, LILAC, ROSE, SOFT = '#282d43', '#a997ff', '#ef8bab', '#c6b5d8'
CLIP, CAP = '#9aa0b5', '#1d2033'
FACING = (math.pi / 2, 0, 0)
CENTRE = (0, 0.14)
TUBE_Z = 0.17
EYE = (0.25, 0.25, 1.0)
AO = 0.5


def board():
    parts = [rbox([1.66, 2.4, 0.05], (0, 0, 0.0425), BOARD, bevel=0.02, surface='wood')]
    parts.append(ring(1.66, 2.4, [(0.0, 0.06), (0.0, 0.074), (0.006, 0.082), (0.016, 0.086), (0.03, 0.086), (0.036, 0.08), (0.04, 0.074), (0.04, 0.06)], '#343a56', surface='wood'))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cylinder(0.018, 0.02, 0.008, (sx * 0.76, sy * 1.14, 0.09), '#bf9762', segments=12, bevel=0.003, surface='metal', layer='metal', rotation=FACING))
    parts.append(cylinder(0.6, 0.6, 0.004, (CENTRE[0], CENTRE[1], 0.069), '#3f3b66', segments=48, bevel=0.0015, rotation=FACING))
    a, b = (-0.63, -0.24), (0.65, 0.52)
    length, angle = math.hypot(b[0] - a[0], b[1] - a[1]), math.atan2(b[1] - a[1], b[0] - a[0])
    parts.append(rbox([length + 0.06, 0.1, 0.002], ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.0685), '#4a3a58', bevel=0.001, rotation=(0, 0, angle)))
    return parts


def standoff(x, y, z):
    return [cylinder(0.008, 0.01, z - 0.068, (x, y, (z + 0.068) / 2), CLIP, segments=8, surface='metal', layer='metal', rotation=FACING),
            rbox([0.03, 0.012, 0.012], (x, y, z - 0.02), CLIP, bevel=0.004, segments=1, surface='metal', layer='metal')]


def electrode(x, y, z, direction):
    dx, dy = direction
    return [rod((x, y, z), (x + dx * 0.05, y + dy * 0.05, z), 0.026, CAP, sides=12),
            rod((x + dx * 0.04, y + dy * 0.04, z), (x + dx * 0.05, y + dy * 0.05, 0.068), 0.006, CAP, sides=6)]


def orbit():
    parts = [torus(0.57, 0.023, (CENTRE[0], CENTRE[1], TUBE_Z), LILAC, major_segments=64, minor_segments=8, arc=math.tau - 0.18, rotation=(0, 0, math.pi * 1.5 + 0.09), layer='glow')]
    for end in (-0.09, 0.09):
        a = math.pi * 1.5 + end
        parts += electrode(math.cos(a) * 0.57 + CENTRE[0], math.sin(a) * 0.57 + CENTRE[1], TUBE_Z, (-math.sin(a) * (1 if end > 0 else -1), math.cos(a) * (1 if end > 0 else -1)))
    for k in range(6):
        a = k / 6 * math.tau + 0.4
        parts += standoff(math.cos(a) * 0.57, CENTRE[1] + math.sin(a) * 0.57, TUBE_Z)
    a, b = (-0.63, -0.24, 0.2), (0.65, 0.52, 0.2)
    parts.append(rod(a, b, 0.024, ROSE, sides=10, layer='glow'))
    unit = ((b[0] - a[0]) / 1.488, (b[1] - a[1]) / 1.488)
    parts += electrode(a[0], a[1], 0.2, (-unit[0], -unit[1]))
    parts += electrode(b[0], b[1], 0.2, unit)
    for t in (0.12, 0.5, 0.88):
        parts += standoff(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.2)
    return parts


def words():
    parts = []
    for i in range(3):
        x = -0.44 + i * 0.44
        parts.append(rod((x - 0.13, -0.85, 0.16), (x + 0.13, -0.85, 0.16), 0.019, SOFT, sides=8, layer='glow'))
        for side in (-1, 1):
            parts.append(sphere((0.019, 0.019, 0.019), (x + side * 0.13, -0.85, 0.16), SOFT, subdivisions=1, layer='glow'))
        parts += standoff(x, -0.85, 0.16)
    for x, y, r in ((0.58, 0.98, 0.07), (-0.6, 0.86, 0.05), (0.62, -0.5, 0.045)):
        for angle in (0, math.pi / 2):
            parts.append(rod((x - math.cos(angle) * r, y - math.sin(angle) * r, 0.12), (x + math.cos(angle) * r, y + math.sin(angle) * r, 0.12), 0.008, SOFT, sides=6, layer='glow'))
        parts.append(cylinder(0.006, 0.008, 0.05, (x, y, 0.095), CLIP, segments=6, surface='metal', layer='metal', rotation=FACING))
    parts.append(rbox([0.16, 0.09, 0.05], (0.62, -1.08, 0.095), '#3a3f55', bevel=0.012, surface='metal', layer='metal'))
    parts.append(tube([(0.57, -0.87, 0.14), (0.6, -0.95, 0.1), (0.62, -1.04, 0.1)], 0.007, CAP, resolution=3))
    return parts


def build():
    return board() + orbit() + words()
