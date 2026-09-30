import math
import bmesh
from mathutils import Matrix, Vector
from kit import Frame, _finish, _mesh_from_bmesh, at, babylon_rotation, cylinder, lathe, rbox, sphere, tube
from bookcase import spine_book

WOOD, DARK, CANDLE, FLAME, TERRACOTTA = '#aa7954', '#73533d', '#ead6aa', '#ffd186', '#bd8469'
LEAF, LIGHT_LEAF, DARK_LEAF, BRASS = '#809362', '#95a576', '#617853', '#bf9762'
BOOKS = ['#788e84', '#bb8066', '#d5b77c', '#a4ac8e', '#829da3', '#c7a696']
Y = 0.18
EYE = (0.25, 0.2, 1.0)


def profile_prism(outline, width, x, colour, surface='wood'):
    bm = bmesh.new()
    for side in (-1, 1):
        ring = [bm.verts.new(at(x + side * width / 2, y, z)) for z, y in outline]
        bm.faces.new(ring if side > 0 else list(reversed(ring)))
    n = len(outline)
    left, right = bm.verts[:n], bm.verts[n:]
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((left[k], left[j], right[j], right[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bmesh(bm), colour, surface, 'paint', None, (0, 0, 0), (0, 0, 0))


def bracket(x):
    top, bottom = Y - 0.34, Y - 0.48
    outline = [(0.01, top), (0.3, top), (0.3, top - 0.025)]
    for k in range(1, 13):
        t = k / 12
        outline.append((0.3 - 0.27 * math.sin(t * math.pi / 2) ** 1.4, top - 0.025 - (top - 0.025 - bottom - 0.03) * t))
    outline += [(0.045, bottom + 0.012), (0.03, bottom), (0.01, bottom)]
    parts = [profile_prism(outline, 0.05, x, DARK)]
    parts.append(sphere((0.035, 0.035, 0.012), (x, bottom + 0.05, 0.05), DARK, subdivisions=2, surface='wood'))
    parts.append(rbox([0.07, top - bottom, 0.012], (x, (top + bottom) / 2, 0.006), DARK, bevel=0.005, segments=1, surface='wood'))
    for y in (top - 0.03, bottom + 0.03):
        parts.append(cylinder(0.009, 0.009, 0.006, (x, y, 0.015), BRASS, segments=8, surface='metal', layer='metal', rotation=(math.pi / 2, 0, 0)))
    return parts


def board():
    return [rbox([1.6, 0.06, 0.4], (0, Y - 0.31, 0.21), WOOD, bevel=0.02, surface='wood', dice=0.3),
            rbox([1.58, 0.03, 0.04], (0, Y - 0.35, 0.39), WOOD, bevel=0.014, surface='wood'),
            rbox([1.6, 0.012, 0.012], (0, Y - 0.285, 0.405), '#c29c68', bevel=0.004, segments=1, surface='wood')]


def candle(x, bottom, z):
    f = Frame((x, bottom, z))
    parts = [lathe([(0.0, 0.0), (0.085, 0.0), (0.09, 0.008), (0.085, 0.016), (0.07, 0.018), (0.0, 0.018)], (0, 0, 0), BRASS, segments=20, surface='metal', layer='metal', frame=f),
             lathe([(0.0, 0.016), (0.065, 0.016), (0.063, 0.12), (0.06, 0.165), (0.052, 0.18), (0.02, 0.172), (0.0, 0.17)], (0, 0, 0), CANDLE, segments=20, frame=f),
             tube([(0, 0.17, 0), (0.002, 0.19, 0), (0.004, 0.2, 0.002)], 0.0025, '#50453d', frame=f, resolution=2),
             lathe([(0.0, 0.195), (0.012, 0.205), (0.017, 0.22), (0.014, 0.24), (0.006, 0.26), (0.0, 0.27)], (0, 0, 0), FLAME, segments=12, layer='glow', frame=f)]
    for k, (a, drop) in enumerate(((0.4, 0.05), (2.1, 0.08), (3.7, 0.04), (5.0, 0.065))):
        parts.append(sphere((0.012, drop / 2, 0.01), (math.cos(a) * 0.061, 0.17 - drop / 2, math.sin(a) * 0.061), CANDLE, subdivisions=1, frame=f, rotation=(0, -a, 0)))
    return parts


def leaf(position, size, rotation, colour, frame):
    blade = lathe([(0.0, 0.0), (0.3 * size, 0.12 * size), (0.42 * size, 0.4 * size), (0.28 * size, 0.75 * size), (0.0, size)], (0, 0, 0), colour, segments=6, surface='leaf')
    blade.matrix_world = frame.matrix @ Matrix.Translation(at(*position)) @ babylon_rotation(*rotation).to_4x4() @ Matrix.Diagonal((1, 0.2, 1, 1))
    return blade


def trailing_pot(x, bottom, z):
    f = Frame((x, bottom, z))
    parts = [lathe([(0.0, 0.0), (0.09, 0.0), (0.1, 0.01), (0.12, 0.13), (0.135, 0.135), (0.137, 0.17), (0.125, 0.172), (0.118, 0.15), (0.0, 0.15)], (0, 0, 0), TERRACOTTA, segments=24, surface='ceramic', frame=f),
             cylinder(0.117, 0.117, 0.01, (0, 0.152, 0), '#5b4636', segments=20, surface='stone', frame=f)]
    vines = [[(0.02, 0.16, 0.0), (0.1, 0.17, 0.08), (0.16, 0.05, 0.14), (0.18, -0.08, 0.17), (0.16, -0.18, 0.15), (0.13, -0.24, 0.13)],
             [(-0.02, 0.16, 0.02), (-0.08, 0.18, 0.1), (-0.12, 0.08, 0.18), (-0.14, -0.06, 0.19)],
             [(0.0, 0.16, -0.02), (0.06, 0.22, -0.04), (0.12, 0.24, 0.0)],
             [(0.03, 0.16, 0.03), (0.08, 0.2, 0.12), (0.06, 0.08, 0.2), (0.02, -0.04, 0.2)]]
    for v, points in enumerate(vines):
        parts.append(tube(points, 0.004, DARK_LEAF, frame=f, resolution=4))
        for k in range(1, len(points)):
            a, b = Vector(points[k - 1]), Vector(points[k])
            for s in (0.45, 1.0):
                p = a.lerp(b, s)
                side = 1 if (k + v) % 2 else -1
                colour = (LEAF, LIGHT_LEAF, DARK_LEAF)[(k + v) % 3]
                parts.append(leaf((p.x, p.y, p.z), 0.075, (1.1 + side * 0.3, k * 1.3 + v, side * 1.2), colour, f))
    return parts


def build():
    parts = board() + bracket(-0.62) + bracket(0.62)
    shelf = Y - 0.28
    heights = [0.30 + (i * 7 % 5) * 0.025 for i in range(5)]
    for i, h in enumerate(heights):
        parts += spine_book(-0.66 + i * 0.095, shelf, 0.19, 0.085, h, 0.26, BOOKS[i], (i - 2) * 0.008, (i * 3) % 4)
    parts += spine_book(-0.143, shelf, 0.19, 0.085, 0.34, 0.26, BOOKS[5], 0.32, 3)
    parts += candle(0.12, shelf, 0.2)
    parts += trailing_pot(0.52, shelf, 0.2)
    return parts
