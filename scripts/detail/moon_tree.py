import math
import bmesh
import kit
from kit import cylinder, displace, lathe, rod, sphere, torus, tube
from plant import leaf, pebble, soil

PLANTER, RIM, SOIL, RIB, TRUNK, BRANCH, STRING, CHARM = '#967a50', '#c2a16a', '#4d4938', '#b89a63', '#775d43', '#816746', '#bca36f', '#d5bb78'
MOSS, CAP, SPOT, STALK, BARK = '#7d8f5a', '#c9776a', '#f1e3c8', '#e6d8bc', '#664e38'
TRUNK_PATH = [(0, 0.63, 0), (-0.08, 1.2, 0.02), (0.11, 1.85, -0.04), (-0.02, 2.46, 0.02), (0.11, 2.93, -0.06)]
EYE = (0.35, 0.2, 1.0)


def trunk_at(y):
    for p0, p1 in zip(TRUNK_PATH, TRUNK_PATH[1:]):
        if p0[1] <= y <= p1[1]:
            f = (y - p0[1]) / (p1[1] - p0[1])
            return tuple(p0[j] + (p1[j] - p0[j]) * f for j in range(3))
    return TRUNK_PATH[-1]


def planter():
    wall = [(0.0, 0.03), (0.25, 0.03), (0.268, 0.05), (0.272, 0.08), (0.345, 0.58), (0.35, 0.6), (0.0, 0.6)]
    parts = [lathe(wall, (0, 0, 0), PLANTER, segments=48, surface='metal', layer='metal')]
    rim = [(0.33, 0.585), (0.364, 0.59), (0.372, 0.605), (0.372, 0.635), (0.362, 0.65), (0.34, 0.652), (0.33, 0.64), (0.0, 0.64)]
    parts.append(lathe(rim, (0, 0, 0), RIM, segments=48, surface='metal', layer='metal'))
    parts.append(cylinder(0.262, 0.25, 0.04, (0, 0.02, 0), RIM, segments=40, bevel=0.012, surface='metal', layer='metal'))
    for i in range(12):
        a = i * math.pi / 6
        c, s = math.cos(a), math.sin(a)
        parts.append(rod((c * 0.279, 0.085, s * 0.279), (c * 0.354, 0.575, s * 0.354), 0.01, RIB, sides=8, surface='metal', layer='metal'))
        parts.append(sphere((0.016, 0.016, 0.016), (c * 0.28, 0.085, s * 0.28), RIB, subdivisions=1, surface='metal', layer='metal'))
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        parts.append(sphere((0.045, 0.03, 0.045), (math.cos(a) * 0.22, 0.03, math.sin(a) * 0.22), RIB, subdivisions=2, surface='metal', layer='metal'))
    for i in range(6):
        a = i * math.pi / 3 + math.pi / 12
        parts += crescent((math.cos(a) * 0.335, 0.4, math.sin(a) * 0.335), a, 0.045, RIM)
    return parts


def crescent(position, facing, size, colour):
    f = kit.Frame(position, (0, -facing + math.pi / 2, 0))
    ring = torus(size, size * 0.28, (0, 0, 0), colour, arc=math.pi * 1.25, major_segments=14, minor_segments=6, surface='metal', layer='metal', frame=f, rotation=(0, 0, math.pi * 0.6))
    return [ring]


def star(position, size, colour, depth=0.012, spin=0.0):
    bm = bmesh.new()
    rings = []
    for side in (-1, 1):
        ring = []
        for k in range(10):
            a = k / 10 * math.tau + math.pi / 2 + spin
            r = size if k % 2 == 0 else size * 0.45
            ring.append(bm.verts.new(kit.at(math.cos(a) * r, math.sin(a) * r, side * depth / 2)))
        rings.append(ring)
    back, front = rings
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for k in range(10):
        bm.faces.new((back[k], back[(k + 1) % 10], front[(k + 1) % 10], front[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._mesh_from_bmesh(bm, 'star')
    mod = obj.modifiers.new('bevel', 'BEVEL')
    mod.width, mod.segments = depth * 0.35, 2
    kit.assets.apply_all(obj)
    return kit._finish(obj, colour, 'metal', 'metal', None, position, (0, 0, 0))


def trunk():
    parts = [displace(tube(TRUNK_PATH, 0.066, TRUNK, surface='wood', tip=0.24, resolution=10), 0.008, scale=18, seed=2)]
    for k in range(7):
        a = k / 7 * math.tau + 0.3
        c, s = math.cos(a), math.sin(a)
        reach = 0.2 + (k % 3) * 0.04
        path = [(c * 0.02, 0.8, s * 0.02), (c * 0.07, 0.69, s * 0.07), (c * reach * 0.7, 0.645, s * reach * 0.7), (c * reach, 0.64, s * reach)]
        parts.append(tube(path, 0.03, TRUNK, surface='wood', tip=0.25, resolution=4))
    for k, (t, a) in enumerate(((0.2, 0.5), (0.34, 2.8), (0.52, 4.4), (0.7, 1.4))):
        i = min(3, int(t * 4))
        f = t * 4 - i
        p0, p1 = TRUNK_PATH[i], TRUNK_PATH[i + 1]
        p = tuple(p0[j] + (p1[j] - p0[j]) * f for j in range(3))
        r = 0.066 * (1 - 0.76 * t)
        parts.append(sphere((r * 0.5, r * 0.8, r * 0.5), (p[0] + math.cos(a) * r * 0.85, p[1], p[2] + math.sin(a) * r * 0.85), BARK, subdivisions=2, surface='wood'))
    return parts


def branches():
    parts = []
    for tier in range(4):
        for branch in range(3):
            angle = tier * 1.2 + branch * math.pi * 2 / 3
            height, reach = 1.34 + tier * 0.43, 0.39 if tier == 3 else 0.55
            c, s = math.cos(angle), math.sin(angle)
            end = (c * reach, height + 0.24, s * reach)
            tx, ty, tz = trunk_at(height - 0.06)
            path = [(tx - c * 0.01, ty, tz - s * 0.01), (tx + (c * reach - tx) * 0.4, height + 0.04, tz + (s * reach - tz) * 0.4), (tx + (c * reach - tx) * 0.75, height + 0.15, tz + (s * reach - tz) * 0.75), end]
            parts.append(tube(path, 0.026, BRANCH, surface='wood', tip=0.35, resolution=5))
            fork = (tx + (c * reach - tx) * 0.5, height + 0.08, tz + (s * reach - tz) * 0.5)
            side = angle + (0.5 if branch % 2 else -0.5)
            twig = (fork[0] + math.cos(side) * 0.14, fork[1] + 0.14, fork[2] + math.sin(side) * 0.14)
            parts.append(tube([fork, ((fork[0] + twig[0]) / 2, fork[1] + 0.09, (fork[2] + twig[2]) / 2), twig], 0.011, BRANCH, surface='wood', tip=0.3, resolution=3))
            parts.append(sphere((0.012, 0.018, 0.012), end, '#9aae78', subdivisions=1, surface='leaf'))
    return parts


def charms():
    parts = []
    for k, (x, y, z) in enumerate([(-0.48, 1.82, 0.2), (0.42, 2.23, 0.27), (-0.15, 2.87, -0.23)]):
        parts.append(rod((x, y, z), (x, y - 0.19, z), 0.004, STRING, sides=6, surface='cloth'))
        parts.append(torus(0.012, 0.003, (x, y - 0.198, z), CHARM, major_segments=10, minor_segments=4, surface='metal', layer='metal'))
        if k == 1:
            parts += crescent((x, y - 0.25, z), 0.0, 0.05, CHARM)
        else:
            parts.append(star((x, y - 0.25, z), 0.055, CHARM, spin=0.2 * k))
        parts.append(sphere((0.012, 0.012, 0.012), (x, y - 0.31, z), '#f3e2ad', subdivisions=1, layer='glow'))
    return parts


def floor():
    parts = [soil(0.335, 0.645, SOIL, seed=7)]
    for k, (r, a, sz) in enumerate(((0.26, 0.4, 0.05), (0.24, 2.2, 0.04), (0.28, 3.7, 0.045), (0.22, 5.0, 0.035))):
        parts.append(pebble((sz * 1.3, sz * 0.45, sz), (math.cos(a) * r, 0.65, math.sin(a) * r), MOSS, seed=k + 10))
    for k, (r, a, h) in enumerate(((0.2, 1.3, 0.06), (0.24, 1.55, 0.04), (0.17, 4.3, 0.05))):
        x, z = math.cos(a) * r, math.sin(a) * r
        parts.append(rod((x, 0.64, z), (x, 0.64 + h, z), 0.008, STALK, sides=8))
        parts.append(lathe([(0.0, 0.0), (0.03 * h / 0.06, 0.0), (0.028 * h / 0.06, 0.012), (0.016 * h / 0.06, 0.024), (0.0, 0.028)], (x, 0.64 + h - 0.004, z), CAP, segments=14))
        parts.append(sphere((0.005, 0.003, 0.005), (x + 0.008, 0.64 + h + 0.018 * h / 0.06, z), SPOT, subdivisions=1))
    for k, a in enumerate((3.0, 5.6)):
        base = (math.cos(a) * 0.14, 0.65, math.sin(a) * 0.14)
        for side in (-1, 1):
            parts += leaf(base, (math.cos(a + side * 0.7), 1.0, math.sin(a + side * 0.7)), (0, 1, 0), 0.09, 0.045, '#8fa075', rows=4, cols=1)
    return parts


def build():
    return planter() + floor() + trunk() + branches() + charms()
