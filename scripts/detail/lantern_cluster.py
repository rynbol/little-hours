import math
from kit import Frame, cylinder, lathe, rbox, rod, sphere, torus

BASE, TOP, POST, CAP, BAR = '#ab8c52', '#c3a568', '#c0a16a', '#927448', '#b39157'
HOLDER, WAX, WICK, FLAME = '#b69760', '#ead6aa', '#594c37', '#ffd186'
GLASS, GLASS_WARM = '#f6d49a', '#f0bf7e'
LANTERNS = [(-0.28, 0.03, 0.78, 0.175, 0.95), (0.23, 0.26, 0.46, 0.15, 0.0), (0.23, -0.28, 0.61, 0.155, 0.0)]
EYE = (0.45, 0.8, 1.0)


def candle(f, height, radius):
    parts = [lathe([(0.0, 0.0), (radius * 1.6, 0.0), (radius * 1.7, 0.012), (radius * 1.45, 0.022), (radius * 1.1, 0.03), (0.0, 0.03)], (0, 0, 0), HOLDER, segments=12, surface='metal', layer='metal', frame=f)]
    body = [(0.0, 0.03)] + [(radius * (1 + 0.04 * math.sin(i * 1.7)), 0.03 + height * i / 5) for i in range(6)] + [(radius * 0.9, height + 0.035), (radius * 0.55, height + 0.028), (0.0, height + 0.024)]
    parts.append(lathe(body, (0, 0, 0), WAX, segments=18, surface='ceramic', frame=f))
    for k, (a, drop) in enumerate(((0.4, 0.45), (2.3, 0.3), (4.1, 0.55))):
        parts.append(sphere((radius * 0.22, height * drop * 0.5, radius * 0.22), (math.cos(a) * radius * 0.95, height + 0.03 - height * drop * 0.45, math.sin(a) * radius * 0.95), WAX, subdivisions=1, surface='ceramic', frame=f))
    parts.append(rod((0, height + 0.02, 0), (0.004, height + 0.05, 0), 0.004, WICK, sides=6, frame=f))
    flame = [(0.0, height + 0.045), (0.016, height + 0.06), (0.022, height + 0.08), (0.016, height + 0.11), (0.006, height + 0.135), (0.0, height + 0.145)]
    parts.append(lathe(flame, (0.003, 0, 0), FLAME, segments=12, layer='glow', frame=f))
    return parts


def pane(f, width, height, colour):
    parts = [rbox([width, height, 0.006], (0, 0, 0), colour, bevel=0.002, layer='glow', frame=f, segments=1)]
    half_w, half_h = width / 2 - 0.004, height / 2 - 0.004
    parts.append(rod((-half_w, -half_h, 0.008), (half_w, half_h, 0.008), 0.0045, BAR, sides=6, surface='metal', layer='metal', frame=f))
    parts.append(rod((half_w, -half_h, 0.008), (-half_w, half_h, 0.008), 0.0045, BAR, sides=6, surface='metal', layer='metal', frame=f))
    parts.append(rbox([width, 0.012, 0.01], (0, 0, 0.008), BAR, bevel=0.003, surface='metal', layer='metal', frame=f, segments=1))
    return parts


def lantern(x, z, height, radius, door):
    f = Frame((x, 0, z))
    half = radius * 0.62
    parts = [lathe([(0.0, 0.0), (radius * 1.0, 0.0), (radius * 1.04, 0.012), (radius * 1.02, 0.03), (radius * 0.94, 0.04), (radius * 0.9, 0.052), (0.0, 0.052)], (0, 0, 0), BASE, segments=20, surface='metal', layer='metal', frame=f)]
    for k in range(4):
        a = k / 4 * math.tau + math.pi / 4
        parts.append(lathe([(0.0, 0.0), (0.018, 0.0), (0.02, 0.012), (0.014, 0.024), (0.0, 0.026)], (math.cos(a) * radius * 0.86, 0, math.sin(a) * radius * 0.86), BASE, segments=8, surface='metal', layer='metal', frame=f))
    span = half * 2
    for y in (0.066, height - 0.012):
        parts.append(rbox([span + 0.03, 0.026, span + 0.03], (0, y, 0), TOP if y > 0.1 else BASE, bevel=0.008, surface='metal', layer='metal', frame=f, segments=2))
    for px in (-1, 1):
        for pz in (-1, 1):
            parts.append(rbox([0.024, height - 0.07, 0.024], (px * half, 0.052 + (height - 0.07) / 2, pz * half), POST, bevel=0.006, surface='metal', layer='metal', frame=f, segments=1))
            parts.append(sphere((0.02, 0.016, 0.02), (px * half, height + 0.01, pz * half), POST, subdivisions=1, surface='metal', layer='metal', frame=f))
    glass_h = height - 0.12
    mid = 0.066 + (height - 0.012 - 0.066) / 2
    for face in range(4):
        yaw = face * math.pi / 2
        if door and face == 0:
            continue
        g = Frame((math.sin(yaw) * half, mid, math.cos(yaw) * half), (0, yaw, 0), f)
        parts += pane(g, span - 0.026, glass_h, GLASS if face % 2 else GLASS_WARM)
    if door:
        hinge = Frame((half, mid, half), (0, door, 0), f)
        leaf = Frame((-half, 0, 0.006), parent=hinge)
        parts += pane(leaf, span - 0.026, glass_h, GLASS_WARM)
        for side in (-1, 1):
            parts.append(rbox([0.016, glass_h + 0.02, 0.012], (side * (half - 0.01), 0, 0.004), POST, bevel=0.004, surface='metal', layer='metal', frame=leaf, segments=1))
        for side in (-1, 1):
            parts.append(rbox([span - 0.01, 0.016, 0.012], (0, side * (glass_h / 2 + 0.004), 0.004), POST, bevel=0.004, surface='metal', layer='metal', frame=leaf, segments=1))
        parts.append(torus(0.014, 0.004, (-half + 0.03, 0, 0.018), TOP, major_segments=10, minor_segments=5, surface='metal', layer='metal', frame=leaf))
        for y in (-glass_h * 0.35, glass_h * 0.35):
            parts.append(cylinder(0.008, 0.008, 0.04, (half, mid + y, half), TOP, segments=8, surface='metal', layer='metal', frame=f))
    cap = [(0.0, height), (radius * 1.08, height), (radius * 1.1, height + 0.012), (radius * 1.02, height + 0.03), (radius * 0.84, height + 0.055),
           (radius * 0.6, height + 0.08), (radius * 0.42, height + 0.1), (radius * 0.3, height + 0.118), (radius * 0.26, height + 0.13), (0.0, height + 0.13)]
    parts.append(lathe(cap, (0, 0, 0), CAP, segments=28, surface='metal', layer='metal', frame=f))
    for k in range(6):
        a = k / 6 * math.tau + math.pi / 6
        parts.append(sphere((0.008, 0.008, 0.008), (math.cos(a) * radius * 0.7, height + 0.07, math.sin(a) * radius * 0.7), TOP, subdivisions=1, surface='metal', layer='metal', frame=f))
    parts.append(lathe([(0.0, height + 0.125), (0.022, height + 0.125), (0.03, height + 0.14), (0.018, height + 0.155), (0.0, height + 0.16)], (0, 0, 0), TOP, segments=14, surface='metal', layer='metal', frame=f))
    ring = radius * 0.37
    parts.append(torus(ring, 0.01, (0, height + 0.15 + ring, 0), TOP, major_segments=20, minor_segments=6, surface='metal', layer='metal', frame=f))
    parts += candle(Frame((0, 0.078, 0), parent=f), height * 0.44, radius * 0.31)
    return parts


def matchbox():
    f = Frame((0.02, 0.0, 0.36), (0, 0.5, 0))
    parts = [rbox([0.1, 0.03, 0.065], (0, 0.015, 0), '#c7a696', bevel=0.004, surface='paper', frame=f, segments=2),
             rbox([0.094, 0.026, 0.06], (0.035, 0.017, 0), '#e7dec7', bevel=0.003, surface='paper', frame=f, segments=2),
             rbox([0.1, 0.004, 0.012], (0, 0.031, -0.02), '#6b4b3b', bevel=0.001, surface='paper', frame=f, segments=2),
             rbox([0.03, 0.004, 0.03], (-0.02, 0.031, 0.01), '#809362', bevel=0.001, surface='paper', frame=f, segments=2)]
    parts.append(rod((0.1, 0.004, -0.05), (0.18, 0.004, 0.0), 0.003, '#caa26c', sides=6, surface='wood', frame=f))
    parts.append(sphere((0.006, 0.005, 0.006), (0.18, 0.004, 0.0), '#3f3a34', subdivisions=1, frame=f))
    return parts


def build():
    parts = []
    for spec in LANTERNS:
        parts += lantern(*spec)
    return parts + matchbox()
