import math, bpy, bmesh
from mathutils import Vector
from kit import Frame, _finish, _mesh_from_bmesh, at, rbox
from lounge_chair import plump

SACK, SEAT, BACK = '#c9a27e', '#b58f6c', '#d3ae8a'
TAG, THREAD, PILLOW, PILLOW_WELT = '#e7dec7', '#9b7a5c', '#a0afa0', '#83968a'
EYE = (0.5, 0.6, 1.0)
ROWS, COLUMNS = 26, 56
CAP_ROW, EQUATOR_ROW = 19, 13


def shape(lat, lon):
    cy, sy = math.cos(lat), math.sin(lat)
    ux, uy, uz = cy * math.cos(lon), sy, cy * math.sin(lon)
    ripple = 1 + 0.018 * math.sin(lon * 7 + uy * 2.5) * cy + 0.01 * math.sin(lon * 13 - uy * 4) * cy
    x, y, z = ux * 0.6 * ripple, 0.34 + uy * 0.34, uz * 0.56 * ripple
    top = max(0.0, uy)
    rear = max(0.0, -uz)
    y += 0.5 * rear ** 1.3 * top ** 0.7
    z += 0.1 * rear * top
    d = math.hypot(ux - 0.02, uz - 0.18)
    y -= 0.2 * math.exp(-(d / 0.5) ** 2) * top
    ring = math.atan2(uz - 0.18, ux - 0.02)
    y += 0.014 * math.sin(ring * 9) * math.exp(-((d - 0.5) / 0.18) ** 2) * top
    if y < 0.12:
        y = 0.12 - (0.12 - y) * 0.9
    return (x, y, z)


def label(lat, lon):
    if lat > (CAP_ROW / ROWS - 0.5) * math.pi:
        return BACK if math.cos(lon + math.pi / 2) > 0.35 else SEAT
    return SACK


def sack():
    bm = bmesh.new()
    kind = bm.faces.layers.int.new('kind')
    lats = [(i / ROWS - 0.5) * math.pi for i in range(ROWS + 1)]
    lons = [j / COLUMNS * math.tau for j in range(COLUMNS)]
    rows = []
    for i, lat in enumerate(lats):
        if i in (0, ROWS):
            rows.append([bm.verts.new(at(*shape(lat, 0)))] * COLUMNS)
        else:
            rows.append([bm.verts.new(at(*shape(lat, lon))) for lon in lons])
    colours = [SACK, SEAT, BACK]
    for i in range(ROWS):
        for j in range(COLUMNS):
            a, b, c, d = rows[i][j], rows[i][(j + 1) % COLUMNS], rows[i + 1][(j + 1) % COLUMNS], rows[i + 1][j]
            corners = [v for n, v in enumerate((a, b, c, d)) if v not in (a, b, c, d)[:n]]
            face = bm.faces.new(corners)
            face[kind] = colours.index(label((lats[i] + lats[i + 1]) / 2, (lons[j] + lons[(j + 1) % COLUMNS] + (math.tau if j == COLUMNS - 1 else 0)) / 2))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    rings = {row: [Vector(v.co) for v in rows[row]] for row in (CAP_ROW, EQUATOR_ROW)}
    obj = _mesh_from_bmesh(bm)
    parts = []
    for index, colour in enumerate(colours):
        piece = bmesh.new()
        piece.from_mesh(obj.data)
        layer = piece.faces.layers.int['kind']
        bmesh.ops.delete(piece, geom=[f for f in piece.faces if f[layer] != index], context='FACES')
        parts.append(_finish(_mesh_from_bmesh(piece), colour, 'cloth', 'paint', None, (0, 0, 0), (0, 0, 0)))
    bpy.data.objects.remove(obj)
    return parts, rings


def welt(points, radius, colour, sides=6, lift=0.004):
    centre = sum(points, Vector()) / len(points)
    bm = bmesh.new()
    count = len(points)
    rings = []
    for k, p in enumerate(points):
        tangent = (points[(k + 1) % count] - points[k - 1]).normalized()
        out = p - centre
        out = (out - tangent * out.dot(tangent)).normalized()
        side = tangent.cross(out).normalized()
        base = p + out * lift
        rings.append([bm.verts.new(base + (out * math.cos(b) + side * math.sin(b)) * radius) for b in (s / sides * math.tau for s in range(sides))])
    for k in range(count):
        r0, r1 = rings[k], rings[(k + 1) % count]
        for s in range(sides):
            bm.faces.new((r0[s], r1[s], r1[(s + 1) % sides], r0[(s + 1) % sides]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bmesh(bm), colour, 'cloth', 'paint', None, (0, 0, 0), (0, 0, 0))


def build():
    parts, rings = sack()
    parts.append(welt(rings[CAP_ROW], 0.011, SEAT))
    parts.append(welt(rings[EQUATOR_ROW], 0.012, SEAT))
    front = shape(-0.25, math.pi / 2)
    parts.append(rbox([0.12, 0.07, 0.012], (0.12, front[1], front[2] + 0.006), TAG, bevel=0.004, surface='cloth', rotation=(0.25, 0, 0)))
    parts.append(rbox([0.1, 0.004, 0.004], (0.12, front[1] + 0.022, front[2] + 0.014), THREAD, bevel=0.0015, rotation=(0.25, 0, 0)))
    parts.append(rbox([0.1, 0.004, 0.004], (0.12, front[1] - 0.02, front[2] + 0.004), THREAD, bevel=0.0015, rotation=(0.25, 0, 0)))
    lean = Frame((-0.16, 0.74, -0.1), (0, 0.35, 0.18))
    parts += plump([0.36, 0.14, 0.32], (0, 0, 0), PILLOW, puff=0.6, frame=lean, rotation=(math.pi / 2 - 0.55, 0, 0), tufts=(1, 1), button=PILLOW_WELT, piping=PILLOW_WELT, dice=0.05, depth=0.16)
    return parts
