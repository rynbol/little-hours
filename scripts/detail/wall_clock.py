import math
from kit import cylinder, lathe, rbox, torus
from picture_frame import crescent, slab

PLUM, PAPER, INK, BRASS = '#785965', '#f2ead5', '#50453d', '#bf9762'
FACING = (math.pi / 2, 0, 0)
EYE = (0.25, 0.3, 1.0)
AO = 0.5


def rim():
    profile = [(0.285, 0.0), (0.33, 0.0), (0.346, 0.008), (0.352, 0.026), (0.35, 0.046), (0.342, 0.06), (0.33, 0.069), (0.318, 0.073), (0.308, 0.072),
               (0.302, 0.068), (0.298, 0.07), (0.294, 0.066), (0.288, 0.06)]
    parts = [lathe(profile, (0, 0, 0), PLUM, segments=48, rotation=FACING)]
    parts.append(torus(0.3375, 0.0045, (0, 0, 0.036), PLUM, major_segments=48, minor_segments=5))
    parts.append(torus(0.301, 0.0055, (0, 0, 0.0755), BRASS, major_segments=48, minor_segments=5, surface='metal', layer='metal'))
    return parts


def face():
    dial = [(0.0, 0.068), (0.297, 0.068), (0.3, 0.071), (0.3, 0.077), (0.297, 0.08)] + [(r, 0.08) for r in (0.285, 0.205, 0.15, 0.1, 0.05, 0.0)]
    parts = [lathe(dial, (0, 0, 0), PAPER, segments=48, surface='paper', rotation=FACING),
             torus(0.272, 0.0018, (0, 0, 0.0798), INK, major_segments=48, minor_segments=4),
             torus(0.222, 0.0014, (0, 0, 0.0798), INK, major_segments=48, minor_segments=4)]
    for i in range(60):
        if i % 5 == 0:
            continue
        angle = i / 60 * math.tau
        parts.append(rbox([0.004, 0.018, 0.003], (math.sin(angle) * 0.258, math.cos(angle) * 0.258, 0.0808), INK, bevel=0, rotation=(0, 0, -angle)))
    for i in range(12):
        angle = i / 12 * math.tau
        major = i % 3 == 0
        radius = 0.245
        parts.append(rbox([0.024 if major else 0.013, 0.06 if major else 0.036, 0.006], (math.sin(angle) * radius, math.cos(angle) * radius, 0.082), INK, bevel=0.003, segments=2, rotation=(0, 0, -angle)))
    parts.append(crescent(-0.03, -0.12, 0.05, 0.08, '#c9a46a', tilt=-0.4, layer='paint'))
    for x, y, r in ((0.05, -0.1, 0.013), (0.075, -0.15, 0.009), (0.02, -0.165, 0.007)):
        points = [(x + math.cos(math.pi / 2 + k * math.pi / 4) * (r if k % 2 == 0 else r * 0.4), y + math.sin(math.pi / 2 + k * math.pi / 4) * (r if k % 2 == 0 else r * 0.4)) for k in range(8)]
        parts.append(slab(points, 0.08, 0.001, '#c9a46a'))
    return parts


def cap():
    return [cylinder(0.022, 0.022, 0.03, (0, 0, 0.102), INK, segments=20, bevel=0.006, rotation=FACING),
            cylinder(0.03, 0.03, 0.006, (0, 0, 0.087), BRASS, segments=20, bevel=0.002, surface='metal', layer='metal', rotation=FACING),
            cylinder(0.008, 0.008, 0.006, (0, 0, 0.118), BRASS, segments=12, bevel=0.002, surface='metal', layer='metal', rotation=FACING)]


def hanger():
    return [torus(0.026, 0.006, (0, 0.372, 0.03), BRASS, major_segments=20, minor_segments=6, surface='metal', layer='metal'),
            rbox([0.05, 0.03, 0.02], (0, 0.345, 0.03), BRASS, bevel=0.008, surface='metal', layer='metal')]


def build():
    return rim() + face() + cap() + hanger()
