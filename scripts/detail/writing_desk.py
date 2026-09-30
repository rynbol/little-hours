import math
import bmesh
from mathutils import Matrix, Vector
from kit import Frame, _finish, _mesh_from_bmesh, at, cylinder, lathe, rbox, rod, sphere, torus, tube
from study_desk import book, chair, desk, lamp, mug

TIMBER, LEGS, DRAWER, CLOTH = '#d8ccb1', '#bc9169', '#c3b597', '#b98770'
COVER, SPINE, RULE, PAPER, PEN = '#789286', '#b2a88b', '#b7bea4', '#f2ead5', '#b98754'
TERRACOTTA, CREAM, BRASS, INK = '#bd8469', '#e7dec7', '#bf9762', '#44506a'
CUP_TOOLS = ['#aa7954', '#83968a', '#caa26c', '#50564c']
EYE = (0.25, 0.9, 1.0)


def scaled(parts, origin, factor):
    pivot = Matrix.Translation(at(*origin))
    shrink = pivot @ Matrix.Scale(factor, 4) @ pivot.inverted()
    for part in parts:
        part.matrix_world = shrink @ part.matrix_world
    return parts


def recolour(parts, old, new):
    for part in parts:
        if part['hex'] == old:
            part['hex'] = new
    return parts


def sheet(outline, colour, surface='paper', frame=None, facing=(0, 1, 0)):
    bm = bmesh.new()
    rows = [[bm.verts.new(at(*p)) for p in row] for row in outline]
    for r0, r1 in zip(rows, rows[1:]):
        for k in range(len(r0) - 1):
            face = bm.faces.new((r0[k], r1[k], r1[k + 1], r0[k + 1]))
            face.normal_update()
            if face.normal.dot(at(*facing)) < 0:
                face.normal_flip()
    return _finish(_mesh_from_bmesh(bm), colour, surface, 'paint', frame, (0, 0, 0), (0, 0, 0))


def page_height(t, thick, lift):
    return thick + lift * math.sin(math.pi * t * 0.86) - lift * 0.35 * t ** 8


def page_block(side, width, depth, thick, lift, frame, steps=10):
    bm = bmesh.new()
    top, bottom = [], []
    for k in range(steps + 1):
        t = k / steps
        x = side * (width - t * width)
        y = page_height(t, thick, lift)
        top.append([bm.verts.new(at(x, y, z)) for z in (-depth / 2, depth / 2)])
        bottom.append([bm.verts.new(at(x, 0, z)) for z in (-depth / 2, depth / 2)])
    for k in range(steps):
        a, b = top[k], top[k + 1]
        bm.faces.new((a[0], a[1], b[1], b[0]))
        c, d = bottom[k], bottom[k + 1]
        bm.faces.new((c[0], d[0], d[1], c[1]))
        for j in (0, 1):
            bm.faces.new((c[j], d[j], b[j], a[j]))
    bm.faces.new((top[0][0], bottom[0][0], bottom[0][1], top[0][1]))
    bm.faces.new((top[-1][0], top[-1][1], bottom[-1][1], bottom[-1][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bmesh(bm), PAPER, 'paper', 'paint', frame, (0, 0.012, 0), (0, 0, 0))


def page_line(side, x0, x1, z, width, thick, lift, colour, frame, span=0.43):
    row = lambda dz: [(side * x, 0.0135 + page_height(1 - x / span, thick, lift), z + dz) for x in (x0 + (x1 - x0) * k / 6 for k in range(7))]
    return sheet([row(-width / 2), row(width / 2)], colour, frame=frame)


def notebook():
    f = Frame((0, 1.25, -0.34), (0, -0.10, 0))
    thick, lift, span, depth = 0.026, 0.022, 0.43, 0.57
    parts = []
    for side in (-1, 1):
        parts.append(rbox([0.45, 0.012, 0.63], (side * 0.222, 0.006, 0), COVER, bevel=0.005, surface='cloth', frame=f))
        parts.append(page_block(side, span, depth, thick, lift, f))
        for i in range(9):
            parts.append(page_line(side, 0.03, 0.4, -0.22 + i * 0.055, 0.004, thick, lift, RULE, f))
    parts.append(rbox([0.05, 0.016, 0.63], (0, 0.004, 0), SPINE, bevel=0.006, surface='cloth', frame=f))
    lengths = [0.34, 0.31, 0.36, 0.2, 0.33, 0.29, 0.35, 0.12]
    for i, length in enumerate(lengths):
        parts.append(page_line(-1, 0.4 - length, 0.4, -0.232 + i * 0.055, 0.007, thick, lift, INK, f))
    for i, (a, b) in enumerate(((0.05, 0.13), (0.16, 0.29), (0.05, 0.22))):
        parts.append(page_line(1, a, b, -0.232 + i * 0.055, 0.007, thick, lift, INK, f))
    parts.append(tube([(0.004, 0.05, 0.05), (0.01, 0.05, 0.2), (0.02, 0.03, 0.3), (0.03, 0.0, 0.33), (0.05, -0.01, 0.39)], 0.006, '#b0574a', frame=f, resolution=4))
    parts += fountain_pen(f)
    return parts


def fountain_pen(f):
    a, b = Vector((0.37, 0.062, 0.24)), Vector((0.31, 0.062, -0.05))
    along = (b - a).normalized()
    point = lambda s: tuple(a + along * s)
    length = (b - a).length
    parts = [lathe([(0.0, 0.0), (0.009, 0.004), (0.0125, 0.03), (0.0125, length * 0.55), (0.0135, length * 0.56), (0.0135, length * 0.6), (0.012, length * 0.62), (0.0115, length * 0.9), (0.008, length * 0.93), (0.0, length * 0.93)],
                   (0, 0, 0), PEN, segments=12, surface='wood', frame=f)]
    parts[0].matrix_world = f.matrix @ Matrix.Translation(at(*a)) @ orient(along)
    parts.append(rod(point(length * 0.555), point(length * 0.6), 0.0142, BRASS, sides=12, surface='metal', layer='metal', frame=f))
    parts.append(rod(point(0.004), point(0.012), 0.0105, BRASS, sides=12, surface='metal', layer='metal', frame=f))
    parts.append(rbox([0.006, 0.004, 0.09], point(0.07), BRASS, bevel=0.002, surface='metal', layer='metal', frame=f, rotation=(0, math.atan2(along.x, along.z), 0)))
    nib = Vector(point(length * 0.93))
    parts.append(rod(tuple(nib), tuple(nib + along * 0.035), 0.004, '#d9c9a6', sides=6, surface='metal', layer='metal', frame=f))
    return parts


def orient(direction):
    up = Vector((0, 1, 0))
    axis = up.cross(direction)
    angle = math.acos(max(-1, min(1, up.dot(direction))))
    rot = Matrix.Rotation(angle, 4, axis) if axis.length > 1e-6 else Matrix.Identity(4)
    swap = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    return swap @ rot @ swap


def pencil(a, b, colour):
    parts = [rod(a, b, 0.009, colour, sides=6, surface='wood')]
    tip = tuple(b[i] + (b[i] - a[i]) * 0.09 for i in range(3))
    cone = rod(b, tip, 0.006, '#e9cf9f', sides=6, surface='wood')
    parts.append(cone)
    parts.append(sphere((0.004, 0.006, 0.004), tip, '#50453d', subdivisions=1))
    return parts


def brush(a, b, colour):
    parts = [rod(a, b, 0.008, colour, sides=8, surface='wood')]
    d = tuple((b[i] - a[i]) for i in range(3))
    ferrule = tuple(b[i] + d[i] * 0.12 for i in range(3))
    parts.append(rod(b, ferrule, 0.0095, BRASS, sides=10, surface='metal', layer='metal'))
    parts.append(sphere((0.012, 0.03, 0.012), tuple(ferrule[i] + d[i] * 0.1 for i in range(3)), '#4b3a2e', subdivisions=2))
    return parts


def quill(a, b, colour):
    parts = [rod(a, b, 0.004, '#e8dcc0', sides=6)]
    d = [b[i] - a[i] for i in range(3)]
    tip = tuple(b[i] + d[i] * 0.55 for i in range(3))
    mid = tuple((b[i] + tip[i]) / 2 for i in range(3))
    length = math.dist(b, tip)
    lean = math.atan2(d[0], d[1])
    parts.append(sphere((0.028, length * 0.62, 0.004), mid, colour, subdivisions=2, surface='cloth', rotation=(0, 0.5, -lean)))
    parts.append(sphere((0.016, length * 0.3, 0.003), tuple(mid[i] + d[i] * 0.3 for i in range(3)), '#8a8f86', subdivisions=2, surface='cloth', rotation=(0, 0.5, -lean)))
    return parts


def pencil_cup(x, y, z):
    f = Frame((x, y, z))
    profile = [(0.0, 0.0), (0.078, 0.0), (0.086, 0.006), (0.088, 0.02), (0.1, 0.175), (0.106, 0.18), (0.108, 0.19), (0.1, 0.195), (0.09, 0.19), (0.082, 0.04), (0.0, 0.04)]
    parts = [lathe(profile, (0, 0, 0), TERRACOTTA, segments=28, surface='ceramic', frame=f),
             cylinder(0.098, 0.093, 0.03, (0, 0.12, 0), CREAM, segments=28, surface='ceramic', frame=f)]
    for k in range(8):
        a = k / 8 * math.tau
        parts.append(sphere((0.009, 0.009, 0.004), (math.cos(a) * 0.098, 0.12, math.sin(a) * 0.098), '#8fa878', subdivisions=1, surface='ceramic', frame=f, rotation=(0, -a + math.pi / 2, 0)))
    tools = [(pencil, (-0.955, 1.3, -0.755), (-0.965, 1.58, -0.745)),
             (brush, (-0.925, 1.3, -0.75), (-0.905, 1.5, -0.73)),
             (pencil, (-0.9, 1.3, -0.76), (-0.875, 1.55, -0.79)),
             (quill, (-0.93, 1.3, -0.73), (-0.975, 1.46, -0.7))]
    for (make, a, b), colour in zip(tools, CUP_TOOLS):
        parts += make(a, b, colour)
    return parts


def ink_bottle(x, y, z):
    f = Frame((x, y, z), (0, 0.4, 0))
    parts = [lathe([(0.0, 0.0), (0.05, 0.0), (0.056, 0.008), (0.058, 0.05), (0.05, 0.07), (0.024, 0.08), (0.02, 0.1), (0.0, 0.1)], (0, 0, 0), '#3d4658', segments=4, surface='metal', layer='metal', frame=f, rotation=(0, math.pi / 4, 0)),
             cylinder(0.024, 0.024, 0.03, (0, 0.108, 0), '#ac8357', segments=12, bevel=0.005, surface='wood', frame=f),
             rbox([0.06, 0.03, 0.003], (0, 0.035, 0.041), PAPER, bevel=0.001, surface='paper', frame=f),
             rbox([0.04, 0.004, 0.002], (0, 0.038, 0.043), INK, bevel=0, frame=f)]
    return parts


def letter(x, y, z, angle):
    f = Frame((x, y, z), (0, angle, 0))
    parts = [rbox([0.3, 0.006, 0.2], (0, 0.003, 0), '#efe2c4', bevel=0.002, surface='paper', frame=f)]
    parts.append(sheet([[(-0.148, 0.0065, -0.098), (0.148, 0.0065, -0.098)], [(-0.004, 0.0075, 0.02), (0.004, 0.0075, 0.02)]], '#e4d4b1', frame=f))
    parts.append(cylinder(0.024, 0.026, 0.006, (0, 0.009, 0.02), '#a8453d', segments=14, bevel=0.002, frame=f))
    parts.append(cylinder(0.014, 0.014, 0.002, (0, 0.0125, 0.02), '#c2645a', segments=10, frame=f))
    return parts


def spectacles(x, y, z, angle):
    f = Frame((x, y, z), (0, angle, 0))
    parts = []
    for side in (-1, 1):
        parts.append(torus(0.034, 0.0035, (side * 0.042, 0.004, 0), BRASS, rotation=(math.pi / 2, 0, 0), major_segments=18, minor_segments=5, surface='metal', layer='metal', frame=f))
        parts.append(rod((side * 0.076, 0.004, -0.004), (side * 0.03, 0.004, -0.07), 0.0028, BRASS, sides=5, surface='metal', layer='metal', frame=f))
    parts.append(torus(0.01, 0.003, (0, 0.004, 0), BRASS, arc=math.pi, major_segments=8, minor_segments=5, surface='metal', layer='metal', frame=f))
    return parts


def build():
    parts = desk(2.5, TIMBER, LEGS, DRAWER) + recolour(chair(CLOTH), '#6f8276', '#8f5f4d') + notebook()
    parts += pencil_cup(-0.91, 1.25, -0.75)
    parts += lamp(0.91, 1.26, -0.76)
    parts += scaled(mug(0.72, 1.258, -0.06), (0.72, 1.25, -0.06), 0.9)
    parts += book(0.38, 0.055, 0.30, -0.83, 1.285, -0.12, '#bb8066', 0.15)
    parts += spectacles(-0.84, 1.314, -0.1, 0.4)
    parts += letter(-0.62, 1.252, -0.42, 0.35)
    parts += scaled(ink_bottle(-0.6, 1.25, -0.8), (-0.6, 1.25, -0.8), 1.5)
    return parts
