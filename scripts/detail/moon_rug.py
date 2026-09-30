import math, bmesh
from kit import _finish, _mesh_from_bmesh, cylinder, rod
from rug import flat_mesh

RIM, SAND, DUSK, NIGHT, MOON, STAR, DIAMOND, FRINGE = '#9c835f', '#c5aa7c', '#676777', '#555a6d', '#d7c397', '#d9c495', '#d2b987', '#d0bb91'
MIST = '#7d7c8c'
EYE = (0.3, 1.0, 0.9)
AO = 0.5
CELL = 0.022
TOP = 0.0395
RADIUS = 1.6
STARS = [(-0.71, 0.31, 0.12), (0.72, -0.21, 0.1), (0.37, 0.68, 0.13), (-0.35, -0.78, 0.075), (0.67, -0.76, 0.06)]
SPECKS = [(-0.2, 0.62), (0.95, 0.35), (-0.95, -0.25), (0.15, -1.05), (-0.62, 0.86), (1.05, -0.45), (0.5, 0.2), (-1.1, 0.35), (0.3, 1.1), (-0.8, -0.72)]


def star(dx, dz, size):
    if abs(dx) + abs(dz) < size * 0.42:
        return True
    ray = lambda along, across: abs(along) < size * 0.95 and abs(across) < size * 0.16 * (1 - abs(along) / (size * 0.95))
    return ray(dz, dx) or ray(dx, dz)


def pattern(x, z):
    r = math.hypot(x, z)
    a = math.atan2(z, x)
    if r > 1.48:
        stitch = (a / math.tau * 48) % 1
        return RIM if abs(r - 1.535) < 0.012 and stitch < 0.55 else SAND
    if r > 1.36:
        k = round(a / math.tau * 16) % 16
        ca = k / 16 * math.tau
        dx, dz = x - math.cos(ca) * 1.42, z - math.sin(ca) * 1.42
        if abs(dx) + abs(dz) < 0.05:
            return DIAMOND
        mid = ca + math.tau / 32
        if math.hypot(x - math.cos(mid) * 1.42, z - math.sin(mid) * 1.42) < 0.018:
            return STAR
        return DUSK
    if 1.305 < r < 1.33:
        return MIST
    if math.hypot(x + 0.09, z + 0.10) < 0.47 and math.hypot(x - 0.09, z + 0.16) > 0.42:
        return MOON
    for sx, sz, size in STARS:
        if star(x - sx, z - sz, size):
            return STAR
    for sx, sz in SPECKS:
        if abs(x - sx) + abs(z - sz) < 0.028:
            return STAR
    return NIGHT


def weave_disc(radius, colour_at, y=TOP, cell=CELL):
    count = round(radius * 2 / cell)
    step = radius * 2 / count
    edge = lambda z: math.sqrt(max(0.0, radius * radius - z * z))
    runs = {}
    for j in range(count):
        z0, z1 = -radius + j * step, -radius + (j + 1) * step
        reach = max(edge(z0), edge(z1))
        first, last = math.floor(-reach / step), math.ceil(reach / step)
        cells = [(i, colour_at((i + 0.5) * step, (z0 + z1) / 2)) for i in range(first, last)]
        row, start = [], 0
        for k in range(1, len(cells) + 1):
            if k == len(cells) or cells[k][1] != cells[start][1]:
                row.append([cells[start][0] * step, cells[k - 1][0] * step + step, cells[start][1]])
                start = k
        low, high = row[0], row[-1]
        for index, (x0, x1, colour) in enumerate(row):
            left = (-edge(z0), -edge(z1)) if index == 0 else (x0, x0)
            right = (edge(z0), edge(z1)) if index == len(row) - 1 else (x1, x1)
            corners = [(left[0], z0), (right[0], z0), (right[1], z1), (left[1], z1)]
            unique = [c for n, c in enumerate(corners) if all(math.dist(c, o) > 1e-5 for o in corners[:n])]
            if len(unique) >= 3:
                runs.setdefault(colour, []).append(unique)
    return [flat_mesh(quads, colour, y) for colour, quads in runs.items()]


def rope(major, minor, y, colour, segments=144, sides=6, twists=36):
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = i / segments * math.tau
        ring = []
        for j in range(sides):
            b = j / sides * math.tau
            m = minor * (1 + 0.28 * math.cos(2 * b - twists * a))
            radial = major + math.cos(b) * m
            ring.append(bm.verts.new((math.cos(a) * radial, math.sin(a) * radial, y + math.sin(b) * m * 0.8)))
        rings.append(ring)
    for i in range(segments):
        r0, r1 = rings[i], rings[(i + 1) % segments]
        for j in range(sides):
            bm.faces.new((r0[j], r1[j], r1[(j + 1) % sides], r0[(j + 1) % sides]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bmesh(bm), colour, 'cloth', 'paint', None, (0, 0, 0), (0, 0, 0))


def tassels(count, inner, colour):
    parts = []
    for k in range(count):
        a = (k + 0.5) / count * math.tau
        c, s = math.cos(a), math.sin(a)
        knot = ((inner + 0.03) * c, 0.018, (inner + 0.03) * s)
        parts.append(rod(((inner + 0.018) * c, 0.02, (inner + 0.018) * s), ((inner + 0.04) * c, 0.017, (inner + 0.04) * s), 0.012, colour, sides=6, surface='cloth'))
        for spread in (-0.018, 0.018):
            b = a + spread / (inner + 0.1)
            parts.append(rod(knot, ((inner + 0.135) * math.cos(b), 0.009, (inner + 0.135) * math.sin(b)), 0.0058, colour, sides=4, surface='cloth'))
    return parts


def build():
    parts = [cylinder(1.672, 1.672, 0.036, (0, 0.02, 0), RIM, segments=64, surface='cloth')]
    parts += weave_disc(RADIUS, pattern)
    parts.append(rope(1.638, 0.022, 0.034, RIM))
    parts += tassels(48, 1.655, FRINGE)
    return parts
