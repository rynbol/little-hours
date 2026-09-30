import math, bmesh
from mathutils import Vector
from kit import _finish, _mesh_from_bmesh, at, lathe, rbox, sphere
from bean_bag import welt

DARK, LINEN, SAGE, EDGE, CREAM = '#73533d', '#dfd1b2', '#83968a', '#bc9169', '#e7dec7'
STITCH = '#a88f73'
EYE = (0.4, 0.9, 1.0)
AO = 0.6
OVAL = (1.1, 0.72)
PATH = (0.495, 0.324)
TUBE = (0.08, 0.075)
SEGMENTS, SIDES, LOBES = 96, 10, 8


def squash(obj, sx, sz):
    for v in obj.data.vertices:
        v.co.x *= sx
        v.co.y *= sz
    obj.data.update()
    return obj


def plumpness(a):
    return 0.82 + 0.18 * abs(math.sin(a * LOBES / 2)) ** 0.5


def centre(a):
    return Vector((PATH[0] * math.cos(a), 0.108 - 0.018 * max(0.0, math.sin(a)) ** 4, PATH[1] * math.sin(a)))


def outward(a):
    n = Vector((math.cos(a) / PATH[0], 0, math.sin(a) / PATH[1]))
    return n.normalized()


def bolster():
    bm = bmesh.new()
    rings = []
    for i in range(SEGMENTS):
        a = i / SEGMENTS * math.tau
        c, n, m = centre(a), outward(a), plumpness(a)
        ring = []
        for j in range(SIDES):
            b = j / SIDES * math.tau
            p = c + n * math.cos(b) * TUBE[0] * m + Vector((0, 1, 0)) * math.sin(b) * TUBE[1] * m
            ring.append(bm.verts.new(at(*p)))
        rings.append(ring)
    for i in range(SEGMENTS):
        r0, r1 = rings[i], rings[(i + 1) % SEGMENTS]
        for j in range(SIDES):
            bm.faces.new((r0[j], r1[j], r1[(j + 1) % SIDES], r0[(j + 1) % SIDES]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    body = _finish(_mesh_from_bmesh(bm), SAGE, 'cloth', 'paint', None, (0, 0, 0), (0, 0, 0))
    crest = [Vector(at(*(centre(a) + Vector((0, TUBE[1] * plumpness(a), 0))))) for a in (k / 72 * math.tau for k in range(72))]
    return [body, welt(crest, 0.011, EDGE, sides=5, lift=0.0)]


def cushion():
    profile = [(0.0, 0.095), (0.1, 0.0945), (0.17, 0.0935), (0.19, 0.086), (0.21, 0.0935), (0.3, 0.091), (0.32, 0.083), (0.34, 0.0895), (0.39, 0.083), (0.42, 0.07), (0.432, 0.05), (0.42, 0.03), (0.0, 0.03)]
    pad = squash(lathe(profile, (0, 0, 0), LINEN, segments=56, surface='cloth'), 1.08, 0.7)
    return [pad]


def base():
    profile = [(0.0, 0.018), (0.47, 0.018), (0.49, 0.022), (0.5, 0.034), (0.496, 0.046), (0.485, 0.052), (0.0, 0.052)]
    parts = [squash(lathe(profile, (0, 0, 0), DARK, segments=48, surface='wood'), *OVAL)]
    for x, z in ((0.4, 0.2), (-0.4, 0.2), (0.4, -0.2), (-0.4, -0.2)):
        parts.append(lathe([(0.0, 0.0), (0.035, 0.0), (0.042, 0.01), (0.036, 0.02), (0.0, 0.02)], (x, 0, z), DARK, segments=12, surface='wood'))
    return parts


def tag():
    a = math.pi / 2
    c = centre(a) + outward(a) * TUBE[0] * plumpness(a)
    y, z = c.y, c.z + 0.006
    parts = [rbox([0.12, 0.034, 0.02], (0, y, z), CREAM, bevel=0.008, surface='cloth')]
    for x in (-0.06, 0.06):
        for dy in (-0.016, 0.016):
            parts.append(sphere((0.021, 0.021, 0.012), (x, y + dy, z), CREAM, subdivisions=2, surface='cloth'))
    parts.append(rbox([0.08, 0.004, 0.004], (0, y, z + 0.011), STITCH, bevel=0.0015))
    return parts


def build():
    return base() + cushion() + bolster() + tag()
