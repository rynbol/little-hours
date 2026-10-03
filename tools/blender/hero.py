import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(__file__))
from kit import (ROOT, FPS, RENDERS, Model, Poser, bake, catmull, export, keep_faces, loft, make_armature, make_mesh, mix, node, occlusion, orb, refine, reset, smooth, srgb, studio, to_linear, track, transform, tube)

OUT = os.path.join(ROOT, 'public', 'wilds', 'hero.glb')
TABLES = node("""
import { ATTACKS, BLADE, CHARGE_TIME, bladeAngles, bladeSegment } from './src/core/wilds/moves.js';
import { CLIMB, DODGE, GLIDE, HERO_GAITS, MOVE, SWIM, VITALS } from './src/core/wilds/player.js';
import { PET } from './src/core/wilds/pet.js';
import { AVATAR_DEFAULT, AVATAR_OPTIONS } from './src/core/avatar.js';
const body = { x: 0, y: 0, z: 0, facing: 0 }, ease = s => 1 - (1 - Math.min(1, Math.max(0, s))) ** 2;
const toBlender = ([x, y, z]) => [x, -z, y];
const samples = {};
for (const [id, attack] of Object.entries(ATTACKS)) {
  const frames = Math.max(2, Math.round(attack.end * 30));
  samples[id] = Array.from({ length: frames + 1 }, (_, i) => {
    const t = i / frames * attack.end, [yaw, pitch] = bladeAngles(attack, t, [0, 0]), s = bladeSegment(body, yaw, pitch);
    return { t, yaw, pitch, grip: toBlender(s.grip), tip: toBlender(s.tip), lunge: attack.lunge * ease(t / attack.strike[1]) };
  });
}
const pose = angles => { const s = bladeSegment(body, ...angles); return { grip: toBlender(s.grip), tip: toBlender(s.tip) }; };
console.log(JSON.stringify({ ATTACKS, BLADE, CHARGE_TIME, CLIMB, DODGE, GLIDE, GAITS: HERO_GAITS, MOVE, SWIM, VITALS, PET, AVATAR_DEFAULT, AVATAR_OPTIONS, samples, rest: pose(BLADE.rest), raised: pose(BLADE.raised) }));
""")
ATTACKS, BLADE, GAITS, MOVE, DODGE, VITALS, CLIMB, SWIM, GLIDE = (TABLES[k] for k in ('ATTACKS', 'BLADE', 'GAITS', 'MOVE', 'DODGE', 'VITALS', 'CLIMB', 'SWIM', 'GLIDE'))

SLOT = {'fixed': 0, 'skin': 1, 'hair': 2, 'top': 3, 'topShade': 4, 'topTrim': 5, 'bottom': 6, 'bottomTrim': 7, 'cape': 8, 'capeTrim': 9, 'glint': 10, 'eye': 11}
HAIR = {'locks': 22, 'width': 0.05, 'groove': 0.55, 'sheen': 0.45, 'ring': 0.7, 'cap': 0.72, 'under': 0.48, 'flare': 0.07, 'lift': 0.036, 'thick': 0.65}
CREASE = {'reach': 0.045, 'rays': 32, 'depth': 0.55, 'tint': (0.85, 1.0, 1.1), 'skip': (SLOT['glint'], SLOT['eye'])}
EYE = {'x': 0.047, 'z': 1.312, 'wide': 0.024, 'tall': 0.025, 'low': 0.78}
TONE = {name: srgb(code) for name, code in {
    'iris': '#2b1b16', 'irisLow': '#b07a45', 'irisRim': '#e3b277', 'pupil': '#160d0b', 'sclera': '#f3eee6', 'lid': '#c8c6d3', 'shine': '#fff6ea', 'lash': '#22171b', 'lashLow': '#6a4440', 'mouth': '#7a4842', 'mouthIn': '#5b2f2c',
    'leather': '#7a5236', 'leatherDark': '#563a27', 'strap': '#6a4630', 'brass': '#c9a35a', 'brassDark': '#8f7038',
    'wrap': '#cdbb94', 'wrapDark': '#a8946c', 'sole': '#3f322a', 'glove': '#6b4a35', 'gloveDark': '#4f3527',
    'steel': '#d9dee3', 'steelDark': '#9aa3ab', 'edge': '#f6f3ea', 'wood': '#8a5a3a', 'woodDark': '#5e3c26', 'vine': '#6f9a45', 'leafLight': '#a9c860',
    'moon': '#e4ecf7', 'moonDark': '#a8b8d4', 'grip': '#4a3a4c', 'gripBlue': '#3d4a5e', 'cream': '#efe5d2', 'creamDark': '#d6c8ad',
    'button': '#efe2c8', 'knot': '#c76a5c', 'frame': '#55453b', 'petal': '#e8a9a6', 'petalDeep': '#d48e8c', 'pollen': '#d6ad69',
    'moonClip': '#e2c58f', 'starClip': '#b4a6c4', 'feather': '#b9845a', 'featherTip': '#3b2c24', 'pearl': '#f3eee6', 'cord': '#5a4636',
}.items()}

HEAD = Vector((0.0, 0.0, 1.335))
HEAD_RADII = (0.128, 0.132, 0.148)
ARM = {'upper': 0.225, 'fore': 0.21, 'hand': 0.075, 'fingers': 0.04}
A_POSE = math.radians(48)


def side_x(side):
    return 1.0 if side == 'L' else -1.0


def arm_points(side):
    x = side_x(side)
    shoulder = Vector((0.155 * x, 0.0, 1.10))
    down = Vector((math.sin(A_POSE) * x, -0.02, -math.cos(A_POSE))).normalized()
    elbow = shoulder + down * ARM['upper']
    wrist = elbow + down * ARM['fore']
    knuckle = wrist + down * ARM['hand']
    tip = knuckle + down * ARM['fingers']
    return shoulder, elbow, wrist, knuckle, tip, down


BONES = [
    ('root', (0, 0, 0), (0, 0.15, 0), None, False),
    ('hips', (0, 0, 0.72), (0, 0, 0.82), 'root', False),
    ('spine', (0, 0, 0.82), (0, 0, 0.95), 'hips', True),
    ('chest', (0, 0, 0.95), (0, 0, 1.10), 'spine', True),
    ('neck', (0, 0.0, 1.12), (0, 0.0, 1.20), 'chest', False),
    ('head', (0, 0.0, 1.20), (0, 0.0, 1.45), 'neck', True),
    ('mouth', (0, -0.118, 1.247), (0, -0.15, 1.247), 'head', False),
    ('hair.back1', (0, 0.09, 1.36), (0, 0.125, 1.25), 'head', False),
    ('hair.back2', (0, 0.125, 1.25), (0, 0.135, 1.08), 'hair.back1', True),
    ('bun', (0, 0.085, 1.43), (0, 0.15, 1.45), 'head', False),
    ('hood', (0, 0.07, 1.15), (0, 0.15, 1.17), 'chest', False),
    ('glider', (0, 0.08, 1.16), (0, 0.08, 1.36), 'chest', False),
    ('satchel', (0.15, 0.03, 0.83), (0.165, 0.045, 0.70), 'hips', False),
    ('cape.M1', (0, 0.105, 1.10), (0, 0.15, 0.97), 'chest', False),
    ('cape.M2', (0, 0.15, 0.97), (0, 0.17, 0.80), 'cape.M1', True),
]
for side in ('L', 'R'):
    x = side_x(side)
    shoulder, elbow, wrist, knuckle, tip, _ = arm_points(side)
    BONES += [
        (f'eye.{side}', (0.05 * x, -0.118, 1.318), (0.05 * x, -0.15, 1.318), 'head', False),
        (f'brow.{side}', (0.05 * x, -0.12, 1.372), (0.05 * x, -0.15, 1.372), 'head', False),
        (f'hair.{side}1', (0.10 * x, -0.04, 1.37), (0.112 * x, -0.045, 1.25), 'head', False),
        (f'hair.{side}2', (0.112 * x, -0.045, 1.25), (0.115 * x, -0.03, 1.08), f'hair.{side}1', True),
        (f'clavicle.{side}', (0.025 * x, -0.005, 1.10), tuple(shoulder), 'chest', False),
        (f'upperarm.{side}', tuple(shoulder), tuple(elbow), f'clavicle.{side}', True),
        (f'forearm.{side}', tuple(elbow), tuple(wrist), f'upperarm.{side}', True),
        (f'hand.{side}', tuple(wrist), tuple(knuckle), f'forearm.{side}', True),
        (f'fingers.{side}', tuple(knuckle), tuple(tip), f'hand.{side}', True),
        (f'thigh.{side}', (0.09 * x, 0.0, 0.67), (0.09 * x, -0.012, 0.37), 'hips', False),
        (f'shin.{side}', (0.09 * x, -0.012, 0.37), (0.09 * x, 0.008, 0.078), f'thigh.{side}', True),
        (f'foot.{side}', (0.09 * x, 0.008, 0.078), (0.09 * x, -0.085, 0.026), f'shin.{side}', True),
        (f'toe.{side}', (0.09 * x, -0.085, 0.026), (0.09 * x, -0.15, 0.022), f'foot.{side}', True),
        (f'cape.{side}1', (0.115 * x, 0.075, 1.10), (0.17 * x, 0.11, 0.98), 'chest', False),
        (f'cape.{side}2', (0.17 * x, 0.11, 0.98), (0.19 * x, 0.13, 0.84), f'cape.{side}1', True),
    ]
SWORD_GRIP = arm_points('R')[2] + arm_points('R')[5] * 0.045 + Vector((0.0, 0.0, 0.0))
BONES.append(('sword', tuple(SWORD_GRIP), tuple(SWORD_GRIP + Vector((0, -0.3, 0))), 'hand.R', False))
BONE = {name: (Vector(head), Vector(tail), parent) for name, head, tail, parent, _ in BONES}
NAMES = [name for name, *_ in BONES]


def segment_distance(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length


def blend(names, sharp=4.0, keep=3):
    def weights(p, a=None):
        scored = sorted((segment_distance(p, BONE[n][0], BONE[n][1]), n) for n in names)[:keep]
        raw = [(1.0 / (d ** sharp + 1e-6), n) for d, n in scored]
        total = sum(w for w, _ in raw)
        return {n: w / total for w, n in raw}
    return weights


def rigid(name):
    return lambda p, a=None: {name: 1.0}


def fixed(tone, amount=1.0):
    c = TONE[tone] if isinstance(tone, str) else tone
    return lambda p, a=None: (*[min(1.0, v * amount) for v in c], 0.0)


def slot(name, tint=(1.0, 1.0, 1.0)):
    return lambda p, a=None: (*tint, SLOT[name] / 16)


def grey(name, amount):
    return slot(name, (amount, amount, amount))


def head_shape(n, grow=0.0):
    x, y, z = n
    jaw = smooth((-z - 0.42) / 0.58)
    cheek = math.exp(-((z + 0.42) / 0.24) ** 2) * smooth(-y * 2.0)
    sx = 1.0 - 0.40 * jaw ** 1.2 + 0.07 * cheek
    sy = 1.0 - (0.1 * jaw + 0.05 * smooth(z * 2)) * smooth(-y * 3) + 0.06 * smooth(y * 2) * smooth(z * 2 + 0.6)
    sz = 1.0 - 0.05 * smooth(-z * 2) * smooth(y * 2)
    rx, ry, rz = HEAD_RADII
    p = Vector((x * rx * sx, y * ry * sy, z * rz * sz))
    return HEAD + p + n * grow


def head_piece():
    return orb(lambda n: head_shape(n), 22, 32)


FACE_TREE = None


def face_hit(x, z):
    location, normal, _, _ = FACE_TREE.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
    return location, normal


def face_disc(cx, cz, w, h, lift, rings=5, sides=16, tilt=0.0, bend=0.0, low=1.0):
    verts, attrs, faces = [], [], []
    c, s = math.cos(tilt), math.sin(tilt)
    for i in range(rings + 1):
        r = i / rings
        for j in range(sides if i else 1):
            angle = math.tau * j / sides
            u, v = math.cos(angle) * r, math.sin(angle) * r
            v = v * (low if v < 0 else 1.0) + bend * (u * u - 0.35)
            x, z = cx + (u * c - v * s) * w, cz + (u * s + v * c) * h
            location, normal = face_hit(x, z)
            verts.append(location + normal * lift)
            attrs.append((normal, u, v))
    for j in range(sides):
        faces.append((0, 1 + j, 1 + (j + 1) % sides))
    for i in range(1, rings):
        a0, b0 = 1 + (i - 1) * sides, 1 + i * sides
        for j in range(sides):
            faces.append((a0 + j, b0 + j, b0 + (j + 1) % sides, a0 + (j + 1) % sides))
    for f in range(len(faces)):
        faces[f] = tuple(reversed(faces[f]))
    return verts, faces, attrs


def face_band(points, width, lift, sides=6, flat=0.45):
    path = []
    for x, z, r in points:
        location, normal = face_hit(x, z)
        path.append((location + normal * (lift + r * flat), r))
    return tube([p for p, _ in path], [r for _, r in path], sides)


def eye_colour(tone):
    return lambda p, a=None: (*TONE[tone], SLOT['eye'] / 16)


def glint(p, a=None):
    return (*TONE['shine'], SLOT['glint'] / 16)


def build_face(model):
    for side in ('L', 'R'):
        x = side_x(side)
        eye = rigid(f'eye.{side}')
        cx, cz, w, h = EYE['x'] * x, EYE['z'], EYE['wide'], EYE['tall']
        tilt = -0.06 * x

        def sclera(p, a):
            return (*mix(TONE['sclera'], TONE['lid'], smooth((a[2] - 0.2) / 0.6)), SLOT['eye'] / 16)

        def iris(p, a):
            r = math.hypot(a[1], a[2])
            colour = mix(TONE['iris'], TONE['irisLow'], smooth((0.35 - a[2]) / 1.1))
            colour = mix(colour, TONE['irisRim'], smooth((-0.35 - a[2]) / 0.3) * smooth((r - 0.4) / 0.2) * (1 - smooth((r - 0.8) / 0.1)))
            return (*[c * (1 - 0.4 * smooth((r - 0.8) / 0.2)) for c in colour], SLOT['eye'] / 16)
        model.add(face_disc(cx, cz, w, h, 0.0012, 6, 24, tilt, 0.0, EYE['low']), sclera, eye)
        model.add(face_disc(cx + 0.001 * x, cz + 0.001, 0.0166, 0.0212, 0.0022, 6, 24, tilt), iris, eye)
        model.add(face_disc(cx + 0.001 * x, cz + 0.003, 0.0071, 0.0097, 0.0028, 3, 16, tilt), eye_colour('pupil'), eye)
        model.add(face_disc(cx - 0.0063, cz + 0.0097, 0.006, 0.0078, 0.0034, 2, 12), glint, eye)
        model.add(face_disc(cx + 0.0068, cz - 0.0103, 0.003, 0.003, 0.0034, 1, 10), glint, eye)
        upper = [(math.pi * k, r) for k, r in ((0.97, 0.0022), (0.8, 0.0036), (0.6, 0.0044), (0.4, 0.0048), (0.2, 0.0049), (0.03, 0.0045))]
        lash = [(cx + x * w * math.cos(t), cz + h * math.sin(t), r) for t, r in upper]
        lash += [(cx + x * w * 1.22, cz + h * 0.4, 0.003), (cx + x * w * 1.42, cz + h * 0.6, 0.001)]
        model.add(face_band(lash, 0.004, 0.0026), eye_colour('lash'), eye)
        lower = [(cx + x * w * math.cos(t), cz + h * EYE['low'] * math.sin(t), r) for t, r in ((-0.05 * math.pi, 0.0012), (-0.18 * math.pi, 0.0011), (-0.32 * math.pi, 0.0006))]
        model.add(face_band(lower, 0.003, 0.0016), eye_colour('lashLow'), eye)
        brow = [(0.022 * x, 1.364, 0.0032), (0.038 * x, 1.371, 0.0045), (0.056 * x, 1.373, 0.0042), (0.072 * x, 1.368, 0.0022)]
        model.add(face_band(brow, 0.004, 0.003), grey('hair', 0.78), rigid(f'brow.{side}'))
    tip, normal = face_hit(0.0, 1.279)
    nose = transform(orb(lambda n: Vector((n.x * 0.0052, n.y * 0.0055, n.z * 0.0085)), 8, 12), Matrix.Translation(tip + normal * 0.0012) @ Matrix.Rotation(0.35, 4, 'X'))
    model.add(refine(nose, 1), slot('skin'), rigid('head'))
    smile = [(-0.0115, 1.2492, 0.0007), (-0.0068, 1.2468, 0.0016), (0.0, 1.2458, 0.0021), (0.0068, 1.2468, 0.0016), (0.0115, 1.2492, 0.0007)]
    model.add(face_band(smile, 0.004, 0.0012), lambda p, a=None: (*mix(TONE['mouth'], TONE['mouthIn'], 0.6), 0.0), rigid('mouth'))


def head_colour(p, a):
    blush = 0.0
    for x in (-0.072, 0.072):
        blush = max(blush, math.exp(-(((p.x - x) / 0.026) ** 2 + ((p.z - 1.282) / 0.017) ** 2)) * smooth(-p.y / 0.05))
    tint = mix((1.0, 1.0, 1.0), (1.0, 0.8, 0.76), blush * 0.75)
    under = 1.0 - 0.06 * smooth((1.23 - p.z) / 0.04)
    return (tint[0] * under, tint[1] * under, tint[2] * under, SLOT['skin'] / 16)


def build_body(model):
    head = head_piece()
    global FACE_TREE
    FACE_TREE = BVHTree.FromPolygons([tuple(v) for v in head[0]], head[1])
    head_weights = blend(['head', 'neck'], 6.0, 2)
    model.add(head, head_colour, lambda p, a: {'head': 1.0} if p.z > 1.235 else head_weights(p))
    for side in ('L', 'R'):
        x = side_x(side)
        ear = refine(transform(orb(lambda n: Vector((n.x * 0.013, n.y * 0.022, n.z * 0.03)), 8, 12), Matrix.Translation((0.119 * x, 0.012, 1.31)) @ Matrix.Rotation(-0.25 * x, 4, 'Z')), 0)
        model.add(ear, slot('skin', (0.95, 0.88, 0.85)), rigid('head'))
    neck = tube([(0, 0.008, 1.08), (0, 0.006, 1.16), (0, 0.004, 1.24)], [0.056, 0.053, 0.052], 14)
    model.add(neck, slot('skin', (0.9, 0.86, 0.84)), blend(['neck', 'chest', 'head'], 5.0, 2))
    build_face(model)


def torso_profile(z, table):
    rows = sorted(table)
    if z <= rows[0][0]:
        return rows[0][1:]
    if z >= rows[-1][0]:
        return rows[-1][1:]
    s = 0.0
    for i in range(len(rows) - 1):
        if rows[i][0] <= z <= rows[i + 1][0]:
            s = (i + (z - rows[i][0]) / (rows[i + 1][0] - rows[i][0])) / (len(rows) - 1)
            break
    return catmull([r[1:] for r in rows], s)


TORSO = [(0.76, 0.128, 0.094, 0.004), (0.82, 0.12, 0.09, 0.002), (0.88, 0.121, 0.09, 0.0), (0.95, 0.131, 0.096, -0.004), (1.01, 0.139, 0.098, -0.006),
         (1.06, 0.143, 0.092, -0.002), (1.10, 0.135, 0.084, 0.004), (1.135, 0.104, 0.07, 0.006), (1.168, 0.062, 0.054, 0.006)]
HIPS = [(0.6, 0.135, 0.08, 0.01), (0.65, 0.162, 0.094, 0.008), (0.71, 0.153, 0.097, 0.006), (0.78, 0.133, 0.093, 0.004), (0.85, 0.121, 0.09, 0.002)]


def ring_point(table, angle, z, grow=0.0, power=2.5):
    w, d, dy = torso_profile(z, table)
    s, c = math.sin(angle), math.cos(angle)
    x = (w + grow) * math.copysign(abs(s) ** (2 / power), s)
    y = -(d + grow) * math.copysign(abs(c) ** (2 / power), c) + dy
    return Vector((x, y, z))


def shell(table, z0, z1, rings, sides=28, grow=0.0, a0=0.0, a1=math.tau, close=True, cap=(True, True), power=2.5):
    rows, row_attrs = [], []
    for i in range(rings + 1):
        z = z0 + (z1 - z0) * i / rings
        ring, ring_attrs = [], []
        count = sides if close else sides + 1
        for j in range(count):
            angle = a0 + (a1 - a0) * j / sides
            p = ring_point(table, angle, z, grow, power)
            ring.append(p)
            ring_attrs.append((Vector((math.sin(angle), -math.cos(angle), 0.0)), i / rings, angle))
        rows.append(ring)
        row_attrs.append(ring_attrs)
    verts = [v for r in rows for v in r]
    attrs = [a for r in row_attrs for a in r]
    count = len(rows[0])
    faces = []
    for i in range(rings):
        for j in range(count if close else count - 1):
            a, b = i * count + j, i * count + (j + 1) % count
            faces.append((a, b, b + count, a + count))
    if close:
        for index, end in ((0, cap[0]), (rings, cap[1])):
            if not end:
                continue
            centre = sum(rows[index], Vector()) / count
            verts.append(centre)
            attrs.append(row_attrs[index][0])
            c = len(verts) - 1
            base = index * count
            for j in range(count):
                a, b = base + j, base + (j + 1) % count
                faces.append((c, b, a) if index == 0 else (c, a, b))
    return verts, faces, attrs


def surface_strip(table, path, width, lift, thick=0.006, steps=16, power=2.5):
    rows = []
    for i in range(steps + 1):
        angle, z = catmull(path, i / steps)
        angle2, z2 = catmull(path, min(1.0, i / steps + 0.01))
        centre = ring_point(table, angle, z, lift, power)
        ahead = ring_point(table, angle2, z2, lift, power)
        normal = Vector((math.sin(angle), -math.cos(angle), 0.0))
        along = (ahead - centre).normalized() if (ahead - centre).length > 1e-7 else Vector((0, 0, 1))
        across = along.cross(normal).normalized()
        half = width / 2
        rows.append([centre - across * half, centre + across * half, centre + across * half + normal * thick, centre - across * half + normal * thick])
    verts = [v for r in rows for v in r]
    attrs = [(Vector(), i / steps, k / 4) for i in range(steps + 1) for k in range(4)]
    faces = []
    for i in range(steps):
        for k in range(4):
            a, b = i * 4 + k, i * 4 + (k + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    faces += [(0, 3, 2, 1), (steps * 4, steps * 4 + 1, steps * 4 + 2, steps * 4 + 3)]
    return verts, faces, attrs


def surface_patch(table, a0, a1, z0, z1, lift, thick=0.008, sides=8, rings=6, power=2.5, round_corners=0.0, span=None):
    rows, angles = [], []
    for i in range(rings + 1):
        z = z0 + (z1 - z0) * i / rings
        lo, hi = (-span(z), span(z)) if span else (a0, a1)
        angles.append([lo + (hi - lo) * j / sides for j in range(sides + 1)])
        rows.append([ring_point(table, angle, z, lift, power) for angle in angles[-1]])
    verts, faces, attrs = [], [], []
    for layer, extra in ((0, 0.0), (1, thick)):
        for i, row in enumerate(rows):
            for j, p in enumerate(row):
                angle = angles[i][j]
                n = Vector((math.sin(angle), -math.cos(angle), 0.0))
                verts.append(p + n * extra)
                attrs.append((n, i / rings, j / sides))
    w = sides + 1
    size = (rings + 1) * w
    for i in range(rings):
        for j in range(sides):
            a = i * w + j
            faces.append((a, a + w, a + w + 1, a + 1))
            faces.append((size + a, size + a + 1, size + a + w + 1, size + a + w))
    border = [(0, j) for j in range(sides)] + [(i, sides) for i in range(rings)] + [(rings, j) for j in range(sides, 0, -1)] + [(i, 0) for i in range(rings, 0, -1)]
    for k in range(len(border)):
        (i0, j0), (i1, j1) = border[k], border[(k + 1) % len(border)]
        a, b = i0 * w + j0, i1 * w + j1
        faces.append((a, b, size + b, size + a))
    return verts, faces, attrs


SLEEVE = {'at': (0.05, 0.13, 0.215, 0.27, 0.33, 0.38), 'end': (-0.03, 0.0), 'radii': (0.063, 0.061, 0.055, 0.049, 0.053, 0.058, 0.06, 0.055, 0.047), 'ridges': 5, 'cuff': (0.049, 0.046, 0.045), 'rib': 12}
TROUSER = {'radii': (0.09, 0.085, 0.07, 0.069, 0.054, 0.044), 'ridges': 4}
SHIRT = [(1.0, 0.012), (1.06, 0.135), (1.11, 0.335), (1.165, 0.46)]
TORSO_WEIGHTS = blend(['hips', 'spine', 'chest', 'neck'], 4.0, 2)


def torso_weight(p, a=None):
    weights = TORSO_WEIGHTS(p)
    if p.z > 1.03 and abs(p.x) > 0.09:
        side = 'L' if p.x > 0 else 'R'
        share = smooth((abs(p.x) - 0.09) / 0.06) * smooth((p.z - 1.03) / 0.05) * 0.45
        weights = {k: v * (1 - share) for k, v in weights.items()}
        weights[f'clavicle.{side}'] = weights.get(f'clavicle.{side}', 0.0) + share
    return weights


def arm_weights(side):
    return blend(['chest', f'clavicle.{side}', f'upperarm.{side}', f'forearm.{side}', f'hand.{side}'], 5.0, 2)


def sleeve(model, side, colour, cuff, cuff_colour):
    shoulder, elbow, wrist, knuckle, tip, down = arm_points(side)
    x = side_x(side)
    start = shoulder - down * 0.035 + Vector((-0.014 * x, 0, -0.006))
    points = [start] + [shoulder + down * t for t in SLEEVE['at']] + [wrist + down * t for t in SLEEVE['end']]
    radii = SLEEVE['radii']
    model.add(refine(tube(points, radii, 16, ridges=SLEEVE['ridges']), 1), colour, arm_weights(side))
    if cuff:
        end = points[-1]
        band = tube([end - down * 0.03, end - down * 0.012, end + down * 0.012], SLEEVE['cuff'], 16, ridges=SLEEVE['rib'])
        model.add(refine(band, 1), cuff_colour, arm_weights(side))


def glove(model, side):
    shoulder, elbow, wrist, knuckle, tip, down = arm_points(side)
    x = side_x(side)
    forward = Vector((0, -1, 0))
    palm = down.cross(forward).normalized() * x
    frame = Matrix((down.cross(palm).normalized(), down, palm)).transposed()
    hand_w = blend([f'forearm.{side}', f'hand.{side}', f'fingers.{side}'], 6.0, 2)
    cuff = tube([wrist - down * 0.05, wrist - down * 0.008, wrist + down * 0.012], [0.039, 0.04, 0.037], 14)
    model.add(refine(cuff, 1), fixed('glove'), blend([f'forearm.{side}', f'hand.{side}'], 6.0, 2))

    def box_at(centre, size):
        piece = orb(lambda n: Vector((math.copysign(abs(n.x) ** 0.6, n.x) * size[0], math.copysign(abs(n.y) ** 0.7, n.y) * size[1], math.copysign(abs(n.z) ** 0.6, n.z) * size[2])), 8, 12)
        return transform(piece, Matrix.Translation(centre) @ frame.to_4x4())
    model.add(box_at(wrist + down * 0.04, (0.037, 0.041, 0.021)), fixed('glove'), hand_w)
    model.add(box_at(knuckle + down * 0.018, (0.034, 0.025, 0.017)), slot('skin', (0.97, 0.92, 0.9)), rigid(f'fingers.{side}'))
    side_axis = frame.col[0].to_3d()
    thumb_base = wrist + down * 0.022 - side_axis * 0.026 + palm * 0.012
    thumb = tube([thumb_base, thumb_base + down * 0.032 - side_axis * 0.012 + palm * 0.014, thumb_base + down * 0.054 + palm * 0.022], [0.014, 0.013, 0.01], 8)
    model.add(refine(thumb, 1), slot('skin', (0.97, 0.92, 0.9)), rigid(f'hand.{side}'))
    model.add(refine(tube([knuckle - down * 0.008, knuckle + down * 0.004], [0.036, 0.036], 14), 1), fixed('gloveDark'), hand_w)


def leg_weights(side):
    return blend(['hips', f'thigh.{side}', f'shin.{side}', f'foot.{side}'], 5.0, 2)




def legs(model, style):
    for side in ('L', 'R'):
        hip, knee, ankle = BONE[f'thigh.{side}'][0], BONE[f'shin.{side}'][0], BONE[f'foot.{side}'][0]
        pts = [hip + Vector((-0.012 * side_x(side), 0.0, 0.02)), hip + (knee - hip) * 0.4, knee + Vector((0, 0.002, 0.02)), knee + Vector((0, 0.01, -0.06)), knee + (ankle - knee) * 0.55 + Vector((0, 0.006, 0)), ankle + Vector((0, 0, 0.1))]
        radii = [0.082, 0.076, 0.061, 0.058, 0.051, 0.046]
        weights = leg_weights(side)
        if style == 'trousers':
            baggy = pts[:4] + [ankle + Vector((0, 0.006, 0.177)), ankle + Vector((0, 0.004, 0.11))]
            model.add(refine(tube(baggy, TROUSER['radii'], 18, ridges=TROUSER['ridges']), 1), slot('bottom'), weights)
            continue
        model.add(refine(tube(pts, [r * 0.86 for r in radii], 16), 1), slot('skin'), weights)
        if style == 'shorts':
            along = (knee - hip).normalized()
            hem = hip + (knee - hip) * 0.45
            model.add(refine(tube([hip + Vector((0, 0, 0.03)), hip + (knee - hip) * 0.25, hem], [0.086, 0.082, 0.078], 16), 1), slot('bottom'), weights)
            model.add(refine(tube([hem - along * 0.014, hem + along * 0.02], [0.083, 0.083], 16), 1), slot('bottomTrim'), weights)


def hips_piece(model, style):
    weights = blend(['hips', 'spine', 'thigh.L', 'thigh.R'], 4.0, 2)
    if style == 'skirt':
        model.add(refine(shell(HIPS, 0.64, 0.85, 4, 28, -0.004), 1), slot('bottom'), weights)
        rows, attrs = [], []
        pleats, steps = 14, 6
        for i in range(steps + 1):
            s = i / steps
            z = 0.84 - s * 0.32
            ring, ring_attrs = [], []
            for j in range(pleats * 2):
                angle = math.tau * j / (pleats * 2)
                w, d, dy = torso_profile(min(0.85, max(0.62, z)), HIPS)
                flare = 0.004 + s * 0.085 + (0.012 * s if j % 2 else 0.0)
                p = Vector((math.sin(angle) * (w + flare), -math.cos(angle) * (d + flare) + dy, z))
                ring.append(p)
                ring_attrs.append((Vector((math.sin(angle), -math.cos(angle), 0)), s, angle))
            rows.append(ring)
            attrs.append(ring_attrs)
        count = pleats * 2
        verts = [v for r in rows for v in r]
        flat_attrs = [a for r in attrs for a in r]
        faces = [(i * count + j, i * count + (j + 1) % count, (i + 1) * count + (j + 1) % count, (i + 1) * count + j) for i in range(steps) for j in range(count)]
        skirt = refine((verts, faces, flat_attrs), 1, 0.008, 1.0, True)

        def skirt_weight(p, a):
            low = smooth((0.8 - p.z) / 0.25)
            side = 'L' if p.x > 0 else 'R'
            front = smooth((-p.y + 0.02) / 0.1)
            share = low * 0.55 * (0.4 + 0.6 * front) * smooth(abs(p.x) / 0.05 + 0.3)
            return {'hips': 1 - share, f'thigh.{side}': share}

        def skirt_colour(p, a):
            hem = smooth((0.545 - p.z) / 0.015)
            pleat = 0.92 + 0.08 * math.cos(a[2] * pleats)
            return (pleat, pleat, pleat, (SLOT['bottomTrim'] if hem > 0.5 else SLOT['bottom']) / 16)
        model.add(skirt, skirt_colour, skirt_weight)
        return
    model.add(refine(shell(HIPS, 0.6, 0.85, 6, 28), 1), slot('bottom'), weights)


def outfit_torso(model, outfit):
    def colour(p, a):
        angle = a[2] % math.tau
        front = math.cos(angle)
        hem = p.z < 0.80
        if outfit == 'cardigan':
            if hem:
                rib = 0.9 + 0.06 * math.cos(angle * 60)
                return (rib, rib, rib, SLOT['topShade'] / 16)
        if outfit == 'hoodie' and hem:
            rib = 0.9 + 0.06 * math.cos(angle * 60)
            return (rib, rib, rib, SLOT['topShade'] / 16)
        if outfit == 'sailor' and p.z > 1.0 and front > 0.75 and p.z > 1.0 + 0.7 * abs(math.sin(angle)):
            return (*TONE['cream'], 0.0)
        knit = 0.97 + 0.03 * math.cos(p.z * 260 + angle * 8)
        return (knit, knit, knit, SLOT['top'] / 16)
    body = refine(shell(TORSO, 0.76, 1.168, 12, 32), 1)
    model.add(body, colour, torso_weight)
    for side in ('L', 'R'):
        sleeve(model, side, slot('top'), outfit in ('cardigan', 'hoodie', 'sailor'), grey('topShade', 0.95) if outfit != 'sailor' else slot('topTrim'))
    if outfit == 'cardigan':
        model.add(refine(surface_patch(TORSO, 0, 0, 1.0, 1.165, 0.0015, 0.002, 8, 10, span=lambda z: track(z, SHIRT)), 1), fixed('cream'), torso_weight)
        model.add(refine(surface_strip(TORSO, [(0.0, 0.775), (0.0, 0.9), (0.0, 1.0), (0.12, 1.06), (0.32, 1.11)], 0.018, 0.002, 0.005), 1), slot('topTrim'), torso_weight)
        model.add(refine(surface_strip(TORSO, [(0.0, 0.9), (0.0, 1.0), (-0.12, 1.06), (-0.32, 1.11)], 0.018, 0.002, 0.005), 1), slot('topTrim'), torso_weight)
        for z in (0.83, 0.9, 0.97):
            centre = ring_point(TORSO, 0.0, z, 0.009)
            model.add(refine(transform(orb(lambda n: Vector((n.x * 0.008, n.y * 0.004, n.z * 0.008)), 6, 10), Matrix.Translation(centre)), 0), fixed('button'), torso_weight)
        for sign in (-1, 1):
            model.add(refine(surface_patch(TORSO, sign * 0.38, sign * 0.95, 0.79, 0.86, 0.004, 0.006, 6, 3), 1, crease=True), grey('topShade', 1.0), torso_weight)
    elif outfit == 'hoodie':
        model.add(refine(surface_patch(TORSO, -0.75, 0.75, 0.80, 0.885, 0.004, 0.007, 10, 4), 1, crease=True), grey('topShade', 1.0), torso_weight)
        ring = tube([ring_point(TORSO, math.tau * k / 24, 1.135, 0.012) for k in range(25)], [0.016] * 25, 8)
        model.add(refine(ring, 1), grey('topShade', 0.96), torso_weight)
        for sign in (-1, 1):
            cord = tube([ring_point(TORSO, sign * 0.22, 1.11, 0.016), ring_point(TORSO, sign * 0.2, 1.04, 0.012), ring_point(TORSO, sign * 0.19, 0.99, 0.012)], [0.0045, 0.0045, 0.006], 6)
            model.add(cord, slot('topTrim'), torso_weight)
    elif outfit == 'overalls':
        model.add(refine(surface_patch(TORSO, -0.62, 0.62, 0.79, 1.02, 0.005, 0.008, 10, 6), 1, crease=True), slot('bottom'), torso_weight)
        model.add(refine(surface_patch(TORSO, -0.3, 0.3, 0.9, 0.96, 0.014, 0.005, 6, 3), 1, crease=True), slot('bottomTrim'), torso_weight)
        for sign in (-1, 1):
            strap = surface_strip(TORSO, [(sign * 0.5, 1.0), (sign * 0.62, 1.07), (sign * 1.1, 1.11), (sign * 2.2, 1.09), (sign * 2.7, 0.95), (sign * 2.8, 0.80)], 0.026, 0.008, 0.006, 18)
            model.add(refine(strap, 1), slot('bottom'), torso_weight)
            centre = ring_point(TORSO, sign * 0.5, 1.0, 0.016)
            model.add(transform(orb(lambda n: Vector((n.x * 0.009, n.y * 0.005, n.z * 0.009)), 6, 10), Matrix.Translation(centre)), fixed('brass'), torso_weight)
    elif outfit == 'sailor':
        for sign in (-1, 1):
            flap = surface_patch(TORSO, sign * 0.18, sign * 1.25, 1.03, 1.13, 0.012, 0.006, 10, 4)
            model.add(refine(flap, 1, crease=True), lambda p, a: (1.0, 1.0, 1.0, SLOT['topTrim'] / 16) if 1.04 < p.z < 1.12 and abs(abs(a[2]) - 0.7) > 0.4 else (0.95, 0.95, 0.95, SLOT['topShade'] / 16), torso_weight)
        knot = ring_point(TORSO, 0.0, 1.035, 0.02)
        model.add(refine(transform(orb(lambda n: Vector((n.x * 0.018, n.y * 0.011, n.z * 0.014)), 8, 12), Matrix.Translation(knot)), 0), fixed('knot'), torso_weight)
        for sign in (-1, 1):
            tail = tube([knot + Vector((0.004 * sign, -0.004, -0.008)), knot + Vector((0.016 * sign, -0.008, -0.04)), knot + Vector((0.022 * sign, -0.004, -0.07))], [0.008, 0.009, 0.006], 6)
            model.add(tail, fixed('knot', 0.92), torso_weight)


def belt(model):
    band = refine(shell(TORSO, 0.785, 0.815, 1, 32, 0.012, close=True, cap=(False, False)), 1, 0.004, 1.0)
    model.add(band, fixed('leather'), TORSO_WEIGHTS)
    buckle = ring_point(TORSO, 0.0, 0.80, 0.02)
    frame = tube([buckle + Vector((x, 0, z)) for x, z in ((-0.016, -0.014), (0.016, -0.014), (0.016, 0.014), (-0.016, 0.014), (-0.016, -0.014))], [0.0035] * 5, 6)
    model.add(frame, fixed('brass'), TORSO_WEIGHTS)


def boots(model):
    for side in ('L', 'R'):
        x = side_x(side)
        ankle = BONE[f'foot.{side}'][0]
        shaft_w = blend([f'shin.{side}', f'foot.{side}'], 6.0, 2)
        shaft = tube([ankle + Vector((0, 0.002, -0.03)), ankle + Vector((0, 0.004, 0.06)), ankle + Vector((0, 0.006, 0.13)), ankle + Vector((0, 0.006, 0.175))], [0.05, 0.05, 0.054, 0.057], 16)

        def wrap(p, a):
            band = math.sin((p.z * 95 + a[2] * math.tau) * 1.0)
            return (*(TONE['wrap'] if band > -0.2 else TONE['wrapDark']), 0.0)
        model.add(refine(shaft, 1), wrap, shaft_w)
        model.add(refine(tube([ankle + Vector((0, 0.006, 0.165)), ankle + Vector((0, 0.006, 0.195))], [0.062, 0.061], 16), 1), fixed('leather'), shaft_w)

        def foot_shape(n):
            fx = n.x * 0.05
            fy = n.y * (0.115 if n.y < 0 else 0.055)
            fz = n.z * 0.042
            if fz < -0.028:
                fz = -0.028
            return Vector((fx, fy - 0.045, fz + 0.035))
        foot = transform(orb(foot_shape, 12, 18), Matrix.Translation((ankle.x, ankle.y, 0.0)))

        def foot_colour(p, a):
            if p.z < 0.016:
                return (*TONE['sole'], 0.0)
            return (*mix(TONE['leather'], TONE['leatherDark'], smooth((0.03 - p.z) / 0.02)), 0.0)

        def foot_weight(p, a):
            toe = smooth((-(p.y - ankle.y) - 0.07) / 0.04)
            return {f'foot.{side}': 1 - toe, f'toe.{side}': toe} if p.z < 0.09 else shaft_w(p)
        model.add(refine(foot, 1), foot_colour, foot_weight)


def cape_point(angle, s, grow=0.0):
    z, w, d = catmull([row[1:] for row in CAPE], s)
    z += (0.1 * smooth((abs(angle) - 1.25) / 0.95) + 0.035 * smooth(abs(angle) / 1.2) - 0.01 * math.cos(angle * 7 + 0.4)) * smooth((s - 0.45) / 0.55)
    c, n = math.cos(angle), math.sin(angle)
    x = w * math.copysign(abs(n) ** (2 / 2.1), n)
    y = d * math.copysign(abs(c) ** (2 / 2.1), c) + 0.014
    return Vector((x, y, z)) + Vector((n, c, 0)) * grow


def cape_weight(p, a):
    angle, s = a[2], a[1]
    columns = [('R', -1.25), ('M', 0.0), ('L', 1.25)]
    weights = {}
    for name, centre in columns:
        w = max(0.0, 1.0 - abs(angle - centre) / 1.25)
        if w <= 0:
            continue
        lower = smooth((s - 0.45) / 0.4)
        top = 1.0 - smooth(s / 0.3)
        weights[f'cape.{name}1'] = weights.get(f'cape.{name}1', 0.0) + w * (1 - lower) * (1 - top)
        weights[f'cape.{name}2'] = weights.get(f'cape.{name}2', 0.0) + w * lower
        weights['chest'] = weights.get('chest', 0.0) + w * top
    return weights


def cape(model):
    rows, attrs = [], []
    steps, sides = 9, 26
    a0, a1 = -2.25, 2.25
    for i in range(steps + 1):
        s = i / steps
        row, row_attrs = [], []
        for j in range(sides + 1):
            angle = a0 + (a1 - a0) * j / sides
            ripple = 0.012 * math.sin(angle * 7 + 0.4) * smooth((s - 0.3) / 0.7)
            row.append(cape_point(angle, s, ripple))
            row_attrs.append((Vector((math.sin(angle), math.cos(angle), 0)), s, angle))
        rows.append(row)
        attrs.append(row_attrs)
    w = sides + 1
    verts = [v for r in rows for v in r]
    flat = [a for r in attrs for a in r]
    faces = [(i * w + j, i * w + j + 1, (i + 1) * w + j + 1, (i + 1) * w + j) for i in range(steps) for j in range(sides)]
    piece = refine((verts, faces, flat), 1, 0.009, -1.0, True)

    def colour(p, a):
        edge = max(smooth((a[1] - 0.93) / 0.05), smooth((abs(a[2]) - 2.17) / 0.06))
        if edge > 0.5:
            return (1.0, 1.0, 1.0, SLOT['capeTrim'] / 16)
        fold = 0.93 + 0.07 * math.cos(a[2] * 9)
        return (fold, fold, fold, SLOT['cape'] / 16)
    model.add(piece, colour, cape_weight)
    hood_rows, hood_attrs = [], []
    for i in range(7):
        s = i / 6
        row, row_attrs = [], []
        for j in range(17):
            angle = -1.45 + 2.9 * j / 16
            lift = math.sin(s * math.pi)
            base = cape_point(angle, 0.12 + 0.36 * s, 0.012)
            bulge = Vector((math.sin(angle) * 0.03, math.cos(angle), 0.0)) * (0.045 * lift * (1 - 0.5 * abs(angle) / 1.45))
            row.append(base + bulge + Vector((0, 0.0, 0.03 * (1 - s))))
            row_attrs.append((Vector(), s, angle))
        hood_rows.append(row)
        hood_attrs.append(row_attrs)
    verts = [v for r in hood_rows for v in r]
    flat = [a for r in hood_attrs for a in r]
    faces = [(i * 17 + j, i * 17 + j + 1, (i + 1) * 17 + j + 1, (i + 1) * 17 + j) for i in range(6) for j in range(16)]
    hood = refine((verts, faces, flat), 1, 0.008, -1.0)

    def hood_colour(p, a):
        if a[1] < 0.12:
            return (1.0, 1.0, 1.0, SLOT['capeTrim'] / 16)
        fold = 0.88 + 0.08 * math.cos(a[2] * 6 + a[1] * 4)
        return (fold, fold, fold, SLOT['cape'] / 16)
    model.add(hood, hood_colour, lambda p, a: {'hood': 0.6, 'chest': 0.4})
    roll = [Vector((0.068 * math.sin(a), 0.006 - 0.064 * math.cos(a), 1.19 - 0.022 * smooth(math.cos(a)))) for a in [math.tau * k / 24 for k in range(25)]]
    model.add(refine(tube(roll, [0.021 + 0.003 * math.sin(k * 1.3) for k in range(25)], 10), 1), slot('cape', (0.93, 0.93, 0.93)), lambda p, a: {'neck': 0.55, 'chest': 0.45})
    clasp = Vector((0.0, -0.072, 1.128))
    model.add(refine(transform(orb(lambda n: Vector((n.x * 0.017, n.y * 0.006, n.z * 0.017)), 8, 14), Matrix.Translation(clasp)), 0), fixed('brass'), rigid('chest'))
    leaf = [clasp + Vector((0.0, -0.007, z)) for z in (-0.011, -0.002, 0.009)]
    model.add(tube(leaf, [0.002, 0.008, 0.002], 6), fixed('vine'), rigid('chest'))
    for sign in (-1, 1):
        cord = tube([clasp + Vector((0.012 * sign, 0.0, 0.0)), cape_point(sign * 2.2, 0.08, 0.004)], [0.003, 0.003], 6)
        model.add(cord, fixed('cord'), rigid('chest'))


def satchel(model):
    w = rigid('satchel')
    centre = Vector((0.165, 0.035, 0.735))
    turn = Matrix.Rotation(0.25, 4, 'Z')

    def box(n):
        return Vector((math.copysign(abs(n.x) ** 0.45, n.x) * 0.026, math.copysign(abs(n.y) ** 0.45, n.y) * 0.06, math.copysign(abs(n.z) ** 0.45, n.z) * 0.05))
    body = transform(orb(box, 10, 16), Matrix.Translation(centre) @ turn)
    model.add(refine(body, 1), fixed('leather'), w)

    def flap_shape(n):
        return Vector((math.copysign(abs(n.x) ** 0.45, n.x) * 0.006, math.copysign(abs(n.y) ** 0.45, n.y) * 0.063, math.copysign(abs(n.z) ** 0.45, n.z) * 0.03))
    flap = transform(orb(flap_shape, 8, 12), Matrix.Translation(centre + turn.to_3x3() @ Vector((0.027, 0, 0.022))) @ turn)
    model.add(refine(flap, 1), fixed('leatherDark'), w)
    buckle = centre + turn.to_3x3() @ Vector((0.035, 0, 0.0))
    model.add(transform(orb(lambda n: Vector((n.x * 0.004, n.y * 0.011, n.z * 0.009)), 6, 10), Matrix.Translation(buckle) @ turn), fixed('brass'), w)
    strap = surface_strip(TORSO, [(1.55, 0.82), (1.05, 0.86), (0.55, 0.93), (0.0, 1.0), (-0.45, 1.07), (-0.9, 1.12), (-1.6, 1.13), (-2.4, 1.08), (-2.9, 0.98), (2.75, 0.9), (2.15, 0.84), (1.75, 0.81)], 0.024, 0.014, 0.005, 40)
    model.add(refine(strap, 1), fixed('strap'), torso_weight)


def sword_frame():
    _, _, wrist, knuckle, _, down = arm_points('R')
    along = Vector((0, -1, 0))
    edge = (down - along * down.dot(along)).normalized()
    flat = along.cross(edge)
    rotation = Matrix((edge, along, flat)).transposed().to_4x4()
    return Matrix.Translation(SWORD_GRIP) @ rotation


def blade(length, base, tip_width, thick, fuller=True, curve=0.0, steps=10):
    verts, faces, attrs = [], [], []
    section = [(1.0, 0.0), (0.0, 1.0), (-1.0, 0.0), (0.0, -1.0)]
    for i in range(steps + 1):
        s = i / steps
        y = base + (length - base) * s
        width = tip_width * (1 - smooth((s - 0.72) / 0.28) ** 1.2) + 0.002
        w = width * (1.0 if s < 0.72 else 1.0)
        for (ex, fz) in section:
            verts.append(Vector((ex * w + curve * s * s, y, fz * thick * (1 - 0.5 * s))))
            attrs.append((Vector((ex, 0, fz)), s, ex))
    tip = Vector((curve, length + 0.05, 0.0))
    verts.append(tip)
    attrs.append((Vector((0, 1, 0)), 1.0, 0.0))
    for i in range(steps):
        for k in range(4):
            a, b = i * 4 + k, i * 4 + (k + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    last = steps * 4
    for k in range(4):
        faces.append((last + k, last + (k + 1) % 4, len(verts) - 1))
    faces.append((3, 2, 1, 0))
    return verts, faces, attrs


def sword(model, kind):
    frame = sword_frame()
    w = rigid('sword')
    length = BLADE['reach'] - BLADE['grip']
    guard_at = BLADE['guard']
    style = {
        'starter': dict(width=0.03, metal='steel', dark='steelDark', guard='leatherDark', grip='leather', pommel='steelDark', guard_w=0.055),
        'rootwood': dict(width=0.032, metal='wood', dark='woodDark', guard='vine', grip='woodDark', pommel='vine', guard_w=0.06),
        'steel': dict(width=0.03, metal='steel', dark='steelDark', guard='brass', grip='gripBlue', pommel='brass', guard_w=0.075),
        'moonsteel': dict(width=0.031, metal='moon', dark='moonDark', guard='moon', grip='grip', pommel='moonDark', guard_w=0.07),
    }[kind]

    def blade_colour(p, a):
        edge = abs(a[2])
        tone = mix(TONE[style['dark']], TONE[style['metal']], 0.55 + 0.45 * edge)
        if kind != 'rootwood' and edge > 0.95:
            tone = mix(tone, TONE['edge'], 0.6)
        if kind == 'rootwood':
            grain = 0.9 + 0.1 * math.sin(a[1] * 40 + a[2] * 3)
            tone = tuple(c * grain for c in tone)
        return (*tone, 0.0)
    shape = blade(length, guard_at, style['width'], 0.0065, curve=0.0)
    piece = transform(shape, frame)
    model.add(piece, blade_colour, w, material=1, smooth=False)
    guard = tube([Vector((-style['guard_w'], guard_at, 0)), Vector((0, guard_at - 0.004, 0)), Vector((style['guard_w'], guard_at, 0))], [0.009, 0.013, 0.009], 8)
    if kind == 'moonsteel':
        guard = tube([Vector((-0.07, guard_at + 0.03, 0)), Vector((-0.045, guard_at, 0)), Vector((0, guard_at - 0.006, 0)), Vector((0.045, guard_at, 0)), Vector((0.07, guard_at + 0.03, 0))], [0.004, 0.009, 0.013, 0.009, 0.004], 8)
    model.add(refine(transform(guard, frame), 1), fixed(style['guard']), w)
    handle = tube([Vector((0, guard_at - 0.01, 0)), Vector((0, 0.0, 0)), Vector((0, -0.065, 0))], [0.014, 0.015, 0.014], 8)

    def wrap(p, a):
        band = math.sin(a[1] * 30)
        return (*(TONE[style['grip']] if band > 0 else tuple(c * 0.8 for c in TONE[style['grip']])), 0.0)
    model.add(transform(handle, frame), wrap, w)
    pommel = orb(lambda n: Vector((n.x * 0.019, n.y * 0.016, n.z * 0.019)), 8, 12)
    model.add(refine(transform(transform(pommel, Matrix.Translation((0, -0.078, 0))), frame), 0), fixed(style['pommel']), w)
    if kind == 'rootwood':
        for k in range(3):
            leaf = tube([Vector((0.01, guard_at + 0.03 + k * 0.08, 0.004)), Vector((0.028, guard_at + 0.05 + k * 0.08, 0.006)), Vector((0.04, guard_at + 0.065 + k * 0.08, 0.004))], [0.002, 0.009, 0.002], 6)
            model.add(transform(leaf, frame), fixed('leafLight'), w)


def hair_cap(style, grow=0.012):
    nape = {'bun': -0.55, 'bob': -0.3, 'waves': -0.3, 'crop': -0.7}[style]
    side = {'bun': -0.12, 'bob': -0.2, 'waves': -0.2, 'crop': -0.3}[style]

    def covered(centre, attrs):
        n = (centre - HEAD).normalized()
        front = smooth((-n.y - 0.25) / 0.45)
        back = smooth((n.y - 0.05) / 0.55)
        limit = side * (1 - front) + 0.5 * front
        limit = limit * (1 - back) + nape * back
        return n.z > limit

    def shape(n):
        return head_shape(n, grow * (1.0 + 0.5 * smooth(n.z))) + Vector((0, 0.006 * smooth(n.y), 0.008 * smooth(n.z)))
    piece = keep_faces(orb(shape, 26, 40), covered)
    return refine(piece, 1, 0.01, 1.0)


def sheen(p):
    n = (p - HEAD).normalized()
    strands = 0.55 + 0.45 * math.sin(math.atan2(n.x, -n.y) * 23 + n.z * 9)
    return HAIR['sheen'] * math.exp(-((n.z - HAIR['ring']) / 0.075) ** 2) * strands * smooth((-n.y + 0.35) / 0.5)


def hair_colour(p, a):
    streak = HAIR['cap'] + 0.06 * math.sin(p.x * 140 + p.z * 40) * math.sin(p.z * 90)
    v = streak + sheen(p)
    return (v, v, v, SLOT['hair'] / 16)


def under_colour(p, a):
    v = HAIR['under'] + 0.04 * math.sin(p.x * 140 + p.z * 40) * math.sin(p.z * 90)
    return (v, v, v, SLOT['hair'] / 16)


def lock_colour(p, a):
    v = 0.9 * (1.0 - HAIR['groove'] * abs(a[2]) ** 2.5) + sheen(p) * (1.0 - a[2] ** 2)
    return (v, v, v, SLOT['hair'] / 16)


def crown_locks(model, style):
    end = {'bun': 98, 'bob': 106, 'waves': 106, 'crop': 94}[style]
    back = {'bun': 110, 'bob': 118, 'waves': 122, 'crop': 110}[style]
    for k in range(HAIR['locks']):
        phi = 78 + 204 * k / (HAIR['locks'] - 1)
        rear = smooth((abs(phi - 180) - 90) / -60)
        reach = end * (1 - rear) + back * rear
        sway = 7 * math.sin(k * 2.3)
        path = surface_path([(0, 10), (0.5, reach * 0.62), (1, reach)], [(0, phi * 0.6 + 72), (0.5, phi + sway * 0.5), (1, phi + sway)], [(0, 0.018), (0.55, HAIR['lift'] * (0.62 + 0.38 * (k % 2))), (0.8, HAIR['lift'] * 1.1), (1, HAIR['flare'])], 10)
        widths = [HAIR['width'] * (0.55 + 0.45 * smooth(i / 3)) * (1 - 0.95 * smooth((i - 5) / 5)) + 0.001 for i in range(len(path))]
        model.add(ribbon(path, widths, HAIR['thick']), lock_colour, rigid('head'))




def direction(theta, phi):
    t, f = math.radians(theta), math.radians(phi)
    return Vector((math.sin(t) * math.sin(f), -math.sin(t) * math.cos(f), math.cos(t)))


def hair(model, style):
    head_w = rigid('head')
    model.add(hair_cap(style), under_colour, head_w)
    crown_locks(model, style)
    fringe = [(-66, 0.032, -6), (-48, 0.04, -8), (-30, 0.046, -9), (-12, 0.048, -5), (6, 0.048, 3), (24, 0.046, 7), (42, 0.044, 9), (58, 0.038, 8), (72, 0.03, 5)]
    for phi, width, sway in fringe:
        end = 77 + 4 * math.cos(math.radians(phi * 2.2)) - 8 * smooth((abs(phi) - 40) / 30)
        path = surface_path([(0, 4), (0.45, 44), (1, end)], [(0, phi * 0.35), (0.5, phi * 0.85), (1, phi + sway)], [(0, 0.008), (0.5, 0.028), (1, 0.024)])
        widths = [width * (0.65 + 0.35 * smooth(i / 3)) * (1 - smooth((i - 4) / 5)) + 0.002 for i in range(len(path))]
        model.add(refine(ribbon(path, widths, 0.32), 0), lock_colour, head_w)
    for side in ('L', 'R'):
        x = side_x(side)
        length = {'bun': 1.235, 'bob': 1.2, 'waves': 1.0, 'crop': 1.3}[style]
        top = surface_path([(0, 40), (1, 78)], [(0, 74 * x), (1, 88 * x)], [(0, 0.012), (1, 0.02)], 4)
        hang = [top[-1] + Vector((0.004 * x, -0.004, -0.04)), Vector((top[-1].x + 0.004 * x, top[-1].y - 0.006, (top[-1].z + length) / 2)), Vector((top[-1].x - 0.002 * x, top[-1].y - 0.004, length))]
        if style == 'waves':
            hang = [top[-1] + Vector((0.004 * x, -0.004, -0.05)), Vector((0.13 * x, -0.03, 1.2)), Vector((0.14 * x, -0.02, 1.12)), Vector((0.13 * x, -0.03, 1.05)), Vector((0.135 * x, -0.02, length))]
        if style == 'crop':
            hang = [top[-1] + Vector((0.002 * x, -0.006, -0.03))]
        path = top + hang
        widths = [0.03 + 0.008 * smooth(i / 3) for i in range(len(path) - 1)] + [0.004]
        chain = blend(['head', f'hair.{side}1', f'hair.{side}2'], 5.0, 2)
        model.add(refine(ribbon(path, widths, 0.4), 1), hair_colour, chain if style in ('waves', 'bob') else head_w)
    back_chain = blend(['head', 'hair.back1', 'hair.back2', 'hair.L1', 'hair.R1', 'hair.L2', 'hair.R2'], 4.0, 2)
    if style == 'bob':
        rows, attrs = [], []
        for i in range(6):
            s = i / 5
            row, row_attrs = [], []
            for j in range(25):
                phi = -118 + 236 * j / 24
                base = head_shape(direction(100, phi + 180), 0.022)
                z = 1.335 - 0.135 * s
                out = Vector((base.x - HEAD.x, base.y - HEAD.y, 0))
                out = out.normalized() * (out.length + 0.014 * smooth((s - 0.4) / 0.6) + 0.005 * math.sin(j * 1.9) * s)
                row.append(Vector((HEAD.x + out.x, HEAD.y + out.y, z - 0.012 * math.cos(math.radians(phi)) * s)))
                row_attrs.append((Vector(), s, phi))
            rows.append(row)
            attrs.append(row_attrs)
        verts = [v for r in rows for v in r]
        flat = [a for r in attrs for a in r]
        faces = [(i * 25 + j, i * 25 + j + 1, (i + 1) * 25 + j + 1, (i + 1) * 25 + j) for i in range(5) for j in range(24)]
        model.add(refine((verts, faces, flat), 1, 0.018, 1.0), hair_colour, back_chain)
    elif style == 'waves':
        for k in range(8):
            phi = -84 + 168 * k / 7
            root = head_shape(direction(98, phi + 180), 0.02)
            out = Vector((root.x - HEAD.x, root.y - HEAD.y, 0)).normalized()
            path = [head_shape(direction(80, phi + 180), 0.016), root]
            for i, z in enumerate((1.22, 1.15, 1.08, 1.02, 0.97)):
                wave = 0.014 * math.sin(i * 1.7 + k * 0.9)
                path.append(Vector((root.x + out.x * (0.006 + wave + 0.004 * i), root.y + out.y * (0.008 + wave + 0.004 * i) + 0.01, z)))
            widths = [0.034, 0.036, 0.036, 0.034, 0.03, 0.022, 0.004]
            model.add(refine(ribbon(path, widths, 0.5, Vector((0, 0.0, 1.2))), 1), hair_colour, back_chain)
    elif style == 'bun':
        centre = Matrix.Translation((0, 0.128, 1.448)) @ Matrix.Rotation(-0.55, 4, 'X')
        bun = transform(orb(lambda n: Vector((n.x * 0.058, n.y * 0.052, n.z * 0.056)) * (1 + 0.05 * math.sin(math.atan2(n.z, n.x) * 5 + n.y * 5)), 12, 18), centre)
        model.add(refine(bun, 1), hair_colour, rigid('bun'))
        tie = tube([Vector((0.046 * math.cos(a), -0.042, 0.046 * math.sin(a))) for a in [math.tau * k / 16 for k in range(17)]], [0.008] * 17, 6)
        model.add(transform(tie, centre), slot('topTrim'), rigid('bun'))
    elif style == 'crop':
        for k in range(5):
            phi = -56 + 28 * k
            path = surface_path([(0, 98), (1, 118)], [(0, phi + 180), (1, phi * 1.1 + 180)], [(0, 0.014), (1, 0.012)], 4)
            model.add(refine(ribbon(path, [0.024, 0.024, 0.02, 0.012, 0.003], 0.4), 0), hair_colour, head_w)


def accessory(model, kind):
    head_w = rigid('head')
    if kind == 'glasses':
        for side in ('L', 'R'):
            x = side_x(side)
            centre = Vector((0.05 * x, -0.165, 1.316))
            ring = [centre + Vector((math.cos(a) * 0.03, 0.006 * math.sin(a) ** 2, math.sin(a) * 0.03)) for a in [math.tau * k / 20 for k in range(21)]]
            model.add(tube(ring, [0.0028] * 21, 6), fixed('frame'), head_w)
            model.add(tube([centre + Vector((0.03 * x, 0.0, 0.006)), Vector((0.122 * x, -0.04, 1.33)), Vector((0.125 * x, 0.03, 1.32))], [0.0025] * 3, 6), fixed('frame'), head_w)
        model.add(tube([Vector((-0.02, -0.168, 1.322)), Vector((0, -0.172, 1.326)), Vector((0.02, -0.168, 1.322))], [0.0025] * 3, 6), fixed('frame'), head_w)
    elif kind == 'blossom':
        centre = head_shape(direction(48, 70), 0.03)
        normal = (centre - HEAD).normalized()
        frame = Matrix.Translation(centre) @ normal.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        for k in range(5):
            angle = math.tau * k / 5
            petal = orb(lambda n: Vector((n.x * 0.013, n.y * 0.009, n.z * 0.004)), 6, 10)
            petal = transform(petal, frame @ Matrix.Rotation(angle, 4, 'Z') @ Matrix.Translation((0.013, 0, 0)))
            model.add(petal, lambda p, a: (*mix(TONE['petal'], TONE['petalDeep'], 0.3), 0.0), head_w)
        model.add(transform(orb(lambda n: n * 0.006, 6, 8), frame @ Matrix.Translation((0, 0, 0.003))), fixed('pollen'), head_w)
    elif kind == 'moon-clips':
        for k, (theta, phi, tone) in enumerate(((38, -58, 'moonClip'), (52, -72, 'starClip'))):
            centre = head_shape(direction(theta, phi), 0.03)
            arc = [centre + Vector((0.012 * math.cos(a), 0.0, 0.012 * math.sin(a))) for a in [math.radians(60 + 240 * s / 8) for s in range(9)]]
            model.add(tube(arc, [0.003, 0.005, 0.006, 0.0065, 0.007, 0.0065, 0.006, 0.005, 0.003], 6), fixed(tone), head_w)


def jerkin(model):
    def colour(p, a):
        stitch = abs(math.cos(a[2] * 12)) > 0.985
        return (*(TONE['brass'] if stitch and p.z > 0.84 else TONE['leather']), 0.0)
    vest = keep_faces(shell(TORSO, 0.82, 1.12, 8, 32, 0.016, cap=(False, False)), lambda c, attrs: abs(attrs[0][2] % math.tau - math.pi) < 2.75)
    model.add(refine(vest, 1, 0.008, 1.0), colour, torso_weight)


def feather(model):
    base = cape_point(-0.6, 0.18, 0.04)
    path = [base, base + Vector((-0.02, 0.03, 0.08)), base + Vector((-0.03, 0.04, 0.15))]
    model.add(refine(tube(path, [0.004, 0.016, 0.003], 6), 0), lambda p, a: (*mix(TONE['feather'], TONE['featherTip'], smooth((a[1] - 0.7) / 0.3)), 0.0), lambda p, a: {'hood': 1.0})


def pearl(model):
    path = [Vector((0.05 * math.sin(a), -0.03 - 0.025 * math.cos(a), 1.16 - 0.07 * math.cos(a) ** 6)) for a in [-1.4 + 2.8 * k / 12 for k in range(13)]]
    model.add(tube(path, [0.0018] * 13, 5), fixed('cord'), rigid('chest'))
    model.add(transform(orb(lambda n: n * 0.011, 8, 12), Matrix.Translation((0, -0.062, 1.085))), fixed('pearl'), rigid('chest'))


def glider(model):
    rows, attrs = [], []
    span, chord, steps, sides = 1.1, 0.5, 14, 10
    for i in range(steps + 1):
        u = -1 + 2 * i / steps
        row, row_attrs = [], []
        half = chord * (1 - abs(u) ** 1.8) ** 0.7 + 0.01
        for j in range(sides + 1):
            v = -1 + 2 * j / sides
            x = u * span
            y = v * half + 0.12 * u * u
            z = 1.98 - 0.22 * u * u - 0.06 * v * v + 0.015 * math.sin(v * 3 + u * 5)
            row.append(Vector((x, y, z)))
            row_attrs.append((Vector(), u, v))
        rows.append(row)
        attrs.append(row_attrs)
    w = sides + 1
    verts = [v for r in rows for v in r]
    flat = [a for r in attrs for a in r]
    faces = [(i * w + j, i * w + j + 1, (i + 1) * w + j + 1, (i + 1) * w + j) for i in range(steps) for j in range(sides)]
    leaf = refine((verts, faces, flat), 1, 0.012, 0.0)

    def colour(p, a):
        vein = abs(a[2]) < 0.06 or (abs((abs(a[1]) * 5 - abs(a[2]) * 2) % 1.0 - 0.5) < 0.04 and abs(a[2]) < 0.85)
        return (1.0, 1.0, 1.0, SLOT['capeTrim'] / 16) if vein else (0.95 - 0.1 * abs(a[2]), 0.95 - 0.1 * abs(a[2]), 0.95 - 0.1 * abs(a[2]), SLOT['cape'] / 16)
    model.add(leaf, colour, rigid('glider'))
    for side in ('L', 'R'):
        x = side_x(side)
        model.add(tube([Vector((0.55 * x, 0.02, 1.88)), Vector((0.32 * x, -0.01, 1.62)), Vector((0.2 * x, -0.03, 1.42))], [0.006, 0.006, 0.006], 5), fixed('vine'), rigid('glider'))




def build_parts():
    parts = {}

    def part(name, fn):
        model = Model()
        fn(model)
        parts[name] = model
    part('body', lambda m: (build_body(m), boots(m), [glove(m, s) for s in ('L', 'R')], belt(m), cape(m), satchel(m)))
    for style in ('bun', 'bob', 'waves', 'crop'):
        part(f'hair-{style}', lambda m, style=style: hair(m, style))
    for outfit in ('cardigan', 'hoodie', 'overalls', 'sailor'):
        part(f'outfit-{outfit}', lambda m, outfit=outfit: outfit_torso(m, outfit))
    for style in ('trousers', 'shorts', 'skirt'):
        part(f'bottom-{style}', lambda m, style=style: (hips_piece(m, style), legs(m, style)))
    for kind in ('glasses', 'blossom', 'moon-clips'):
        part(f'accessory-{kind}', lambda m, kind=kind: accessory(m, kind))
    for kind in ('starter', 'rootwood', 'steel', 'moonsteel'):
        part(f'sword-{kind}', lambda m, kind=kind: sword(m, kind))
    part('jerkin', jerkin)
    part('feather', feather)
    part('pearl', pearl)
    part('glider', glider)
    return parts


def decal(colour):
    return len(colour) > 3 and round(colour[3] * 16) in CREASE['skip']


def shade_creases(parts):
    look = TABLES['AVATAR_DEFAULT']
    worn = ['body', f"hair-{look['style']}", f"outfit-{look['outfit']}", f"bottom-{look['bottomStyle']}"]
    for name, model in parts.items():
        if name.startswith('sword-') or name == 'glider':
            continue
        shade = occlusion(model, [parts[n] for n in dict.fromkeys(worn + [name])], CREASE['reach'], CREASE['rays'], decal)
        model.colours = [c if decal(c) else (*(c[k] * (1.0 - CREASE['depth'] * s * CREASE['tint'][k]) for k in range(3)), *c[3:]) for c, s in zip(model.colours, shade)]


def palette(appearance, cape_tone=('#3e5d6e', '#d9b46a')):
    options = TABLES['AVATAR_OPTIONS']
    pick = lambda part: next(o for o in options[part] if o['id'] == appearance[part])
    top, bottom = pick('top'), pick('bottom')
    return {1: srgb(pick('skin')['color']), 2: srgb(pick('hair')['color']), 3: srgb(top['color']), 4: srgb(top['shade']), 5: srgb(top['trim']),
            6: srgb(bottom['color']), 7: srgb(bottom['trim']), 8: srgb(cape_tone[0]), 9: srgb(cape_tone[1])}


def preview_colours(mesh, model, colours):
    attribute = mesh.color_attributes.new('Preview', 'FLOAT_COLOR', 'POINT')
    flat = []
    for c in model.colours:
        index = round(c[3] * 16)
        rgb = tuple(colours[index][k] * c[k] for k in range(3)) if index in colours else c[:3]
        flat += [*to_linear(rgb), 1.0]
    attribute.data.foreach_set('color', flat)
    return attribute


def render(scene, rig, meshes, parts, folder, appearance):
    colours = palette(appearance)
    shown = {'body', f"hair-{appearance['style']}", f"outfit-{appearance['outfit']}", f"bottom-{appearance['bottomStyle']}", 'sword-steel'}
    if appearance['accessory'] != 'none':
        shown.add(f"accessory-{appearance['accessory']}")
    for name, obj in meshes.items():
        obj.hide_render = name not in shown
        if name in shown:
            preview_colours(obj.data, parts[name], colours)
            obj.data.color_attributes.active_color = obj.data.color_attributes['Preview']
    shoot = studio(scene, 900, 85, 4)
    target = Vector((0, 0, 0.78))
    for name, location in {'front': (0, -4.2, 1.0), 'side': (-4.2, 0, 1.0), 'back': (0, 4.2, 1.1), 'three-quarter': (-2.9, -3.0, 1.2)}.items():
        shoot(folder, name, location, target)
    shoot(folder, 'face', (-0.35, -1.25, 1.36), (0, 0, 1.32))
    shoot(folder, 'face-front', (0, -1.25, 1.33), (0, 0, 1.32))


def ribbon(points, widths, thick=0.35, centre=HEAD, sides=10):
    points = [Vector(p) for p in points]
    rings, attrs = [], []
    for i, p in enumerate(points):
        a, b = points[max(0, i - 1)], points[min(len(points) - 1, i + 1)]
        t = (b - a).normalized()
        out = p - centre
        out = (out - t * out.dot(t)).normalized()
        across = t.cross(out)
        ring, ring_attrs = [], []
        for j in range(sides):
            angle = math.tau * j / sides
            ring.append(p + across * math.cos(angle) * widths[i] + out * math.sin(angle) * widths[i] * thick)
            ring_attrs.append((out, i / (len(points) - 1), math.cos(angle)))
        rings.append(ring)
        attrs.append(ring_attrs)
    return loft(rings, attrs)


def surface_path(theta, phi, grow, steps=9):
    points = []
    for i in range(steps + 1):
        s = i / steps
        points.append(head_shape(direction(track(s, theta), track(s, phi)), track(s, grow)))
    return points


CAPE = [(0.0, 1.182, 0.072, 0.064), (0.16, 1.14, 0.16, 0.108), (0.32, 1.09, 0.214, 0.134), (0.6, 0.995, 0.226, 0.142), (1.0, 0.86, 0.24, 0.155)]


ANKLE = {side: Vector(BONE[f'foot.{side}'][0]) for side in ('L', 'R')}
BALL = {side: Vector(BONE[f'toe.{side}'][0]) for side in ('L', 'R')}
SPAN = BALL['L'] - ANKLE['L']
HEEL = Vector((0.0, 0.032, -0.075))
FOOT_DIR = SPAN.normalized()
TOE_DIR = (Vector(BONE['toe.L'][1]) - BALL['L']).normalized()
GRIP_OFFSET = {side: arm_points(side)[5] * 0.045 for side in ('L', 'R')}
POMMEL = 0.075
RAISED_GRIP, RAISED_TIP = Vector(TABLES['raised']['grip']), Vector(TABLES['raised']['tip'])
HOLD_GRIP = Vector((-0.2, -0.07, 0.71))
HOLD_BLADE = Vector((-0.3, -0.75, -0.6)).normalized()
GRAVITY = Vector((0.0, 0.0, -9.8))
WALL = -0.3
FLOOR = 0.05
CHAINS = [
    ('hood', 220, 16, 0.2, 0.3, 0.5, None),
    ('cape.M1', 60, 7, 0.5, 2.2, 1.3, 'chest'), ('cape.L1', 60, 7, 0.5, 2.2, 1.3, 'chest'), ('cape.R1', 60, 7, 0.5, 2.2, 1.3, 'chest'),
    ('cape.M2', 50, 6, 0.6, 2.6, 1.3, 'hips'), ('cape.L2', 50, 6, 0.6, 2.6, 1.3, 'hips'), ('cape.R2', 50, 6, 0.6, 2.6, 1.3, 'hips'),
    ('hair.back1', 120, 10, 0.3, 0.8, 0.9, 'head'), ('hair.back2', 100, 9, 0.35, 1.0, 1.0, 'chest'),
    ('hair.L1', 150, 11, 0.25, 0.8, 0.8, 'head'), ('hair.L2', 120, 10, 0.3, 1.0, 0.9, 'chest'),
    ('hair.R1', 150, 11, 0.25, 0.8, 0.8, 'head'), ('hair.R2', 120, 10, 0.3, 1.0, 0.9, 'chest'),
    ('bun', 600, 30, 0.05, 0.2, 0.25, None),
    ('satchel', 80, 6, 0.8, 0.5, 1.2, 'hips'),
]
SCALED = ('eye.L', 'eye.R', 'mouth', 'glider', 'cape.M1', 'cape.L1', 'cape.R1')
LOCATED = ('root', 'hips', 'brow.L', 'brow.R')
STIFF = ('hood', 'bun', 'hair.back1', 'hair.L1', 'hair.R1')
CLEAR = {'hair.back2': 0.12, 'hair.L2': 0.1, 'hair.R2': 0.1, 'bun': 0.1}


def v(*a):
    return Vector(a)


def rx(angle):
    return Matrix.Rotation(angle, 3, 'X')


def rz(angle):
    return Matrix.Rotation(angle, 3, 'Z')


def body_ratio(local, collider):
    if collider == 'head':
        return math.sqrt((local.x / HEAD_RADII[0]) ** 2 + ((local.y - HEAD.y) / HEAD_RADII[1]) ** 2 + ((local.z - HEAD.z) / HEAD_RADII[2]) ** 2)
    table = TORSO if local.z >= 0.79 else HIPS
    w, d, dy = torso_profile(local.z, table)
    return math.hypot(local.x / w, (local.y - dy) / d)


def push_out(local, collider, least):
    ratio = body_ratio(local, collider)
    if ratio >= least or ratio < 1e-6:
        return local
    k = least / ratio
    if collider == 'head':
        return HEAD + (local - HEAD) * k
    dy = torso_profile(local.z, TORSO if local.z >= 0.79 else HIPS)[2]
    return Vector((local.x * k, dy + (local.y - dy) * k, local.z))


def foot_at(ball, pitch, yaw=0.0):
    turn = rz(yaw)
    if pitch >= 0:
        return ball - turn @ rx(pitch) @ SPAN
    heel = ball - turn @ SPAN + turn @ HEEL
    return heel - turn @ rx(pitch) @ HEEL


def directions(count):
    out = []
    for i in range(count):
        z = 1.0 - 2.0 * (i + 0.5) / count
        r, a = math.sqrt(1.0 - z * z), i * math.pi * (3.0 - math.sqrt(5.0))
        out.append(Vector((r * math.cos(a), r * math.sin(a), z)))
    return out


def outline(meshes, rest, skip, carried):
    points = {}
    for obj in meshes:
        names = {group.index: group.name for group in obj.vertex_groups}
        for vert in obj.data.vertices:
            best = max(vert.groups, key=lambda group: group.weight, default=None)
            if best is None or best.weight < 0.5:
                continue
            name = carried.get(names[best.group], names[best.group])
            if name not in skip:
                points.setdefault(name, []).append(obj.matrix_world @ vert.co)
    hull = {}
    for name, cloud in points.items():
        extremes = {max(range(len(cloud)), key=lambda i: cloud[i].dot(d)) for d in directions(64)}
        hull[name] = [rest[name].inverted() @ cloud[i] for i in extremes]
    return hull


class HeroPoser(Poser):
    def __init__(self, rig, meshes=()):
        super().__init__(rig)
        self.F = Matrix.Identity(3)
        self.dynamics, self.last_travel = {}, None
        bones = rig.data.bones
        self.hull = outline(meshes, self.rest, {name for name, *_ in CHAINS} | {'glider', 'sword'}, {name: bones[name].parent.name for name in STIFF})
        self.least = {}
        for name, *_, collider in CHAINS:
            if collider:
                tail = Vector(BONE[name][1])
                self.least[name] = 0.97 * body_ratio(tail, collider)
        self.report = {}

    def prepare(self, fn, length):
        self.dynamics, self.last_travel = {}, None
        self.report = {'grip': 0.0, 'wrist': 0.0, 'feet': 0.0}
        if getattr(fn, 'loop', False):
            steps = max(2, round(length * FPS))
            for _ in range(3):
                for frame in range(steps):
                    self.evaluate(fn(frame / steps * length))
        else:
            first = fn(0.0)
            for _ in range(FPS):
                self.evaluate(first)
        self.report = {'grip': 0.0, 'wrist': 0.0, 'feet': 0.0}

    def note(self, key, value):
        self.report[key] = max(self.report.get(key, 0.0), value)

    def turn(self, name, rotation=(0, 0, 0), offset=(0, 0, 0)):
        start = self.ident(name)
        head = start.translation.copy()
        spin = (self.F @ Euler(rotation, 'XYZ').to_matrix() @ self.F.transposed()).to_4x4()
        final = Matrix.Translation(head + self.F @ Vector(offset)) @ spin @ Matrix.Translation(-head) @ start
        self.pose[name], self.basis[name] = final, start.inverted() @ final

    def put(self, name, rotation, head):
        start = self.ident(name)
        final = Matrix.Translation(head) @ rotation.to_4x4()
        self.pose[name], self.basis[name] = final, start.inverted() @ final

    def bend(self, name, axis, angle):
        start = self.ident(name)
        head = start.translation.copy()
        final = Matrix.Translation(head) @ Matrix.Rotation(angle, 4, axis.normalized()) @ Matrix.Translation(-head) @ start
        self.pose[name], self.basis[name] = final, start.inverted() @ final

    def scale(self, name, size):
        start = self.ident(name)
        final = self.pose[name] @ Matrix.Diagonal((*size, 1.0))
        self.pose[name], self.basis[name] = final, start.inverted() @ final

    def delta(self, name):
        return self.pose[name] @ self.rest[name].inverted()

    def place(self, point, space):
        return self.delta(space) @ point

    def direct(self, direction, space):
        if space == 'root':
            return self.F @ direction
        return self.delta(space).to_3x3() @ direction

    def solve(self, upper, lower, target, pole):
        joint = self.head(upper)
        l1, l2 = self.length[upper], self.length[lower]
        offset = target - joint
        reach = max(abs(l1 - l2) + 1e-3, min(l1 + l2 - 1e-4, offset.length))
        along = offset.normalized()
        across = pole - along * pole.dot(along)
        across = across.normalized() if across.length > 1e-6 else along.orthogonal().normalized()
        angle = math.acos(max(-1.0, min(1.0, (l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach))))
        first = along * math.cos(angle) + across * math.sin(angle)
        self.aim(upper, first)
        middle = joint + first * l1
        end = joint + along * reach
        self.aim(lower, end - middle)
        return middle, end, (target - end).length

    def grip_frame(self, blade, hand, side):
        a0 = Vector((0.0, -1.0, 0.0))
        b0 = self.rest[f'hand.{side}'].to_3x3().col[1]
        b0 = (b0 - a0 * b0.dot(a0)).normalized()
        b = hand - blade * hand.dot(blade)
        b = b.normalized() if b.length > 1e-4 else blade.orthogonal().normalized()
        return Matrix((blade, b, blade.cross(b))).transposed() @ Matrix((a0, b0, a0.cross(b0)))

    def hold(self, side, grip, blade, pole):
        shoulder = self.head(f'upperarm.{side}')
        hand = (grip - shoulder).normalized()
        for _ in range(3):
            frame = self.grip_frame(blade, hand, side)
            elbow, wrist, _ = self.solve(f'upperarm.{side}', f'forearm.{side}', grip - frame @ GRIP_OFFSET[side], pole)
            hand = (wrist - elbow).normalized()
        frame = self.grip_frame(blade, hand, side)
        return frame, wrist, hand

    def torso(self, p, extra):
        sx, sy, sz = p['spine']
        cx, cy, cz = p['chest']
        self.turn('spine', (sx, sy, sz + extra * 0.4))
        self.turn('chest', (cx, cy, cz + extra * 0.6))
        yaw = p['hips'][2] + sz + cz + extra
        lean = p['hips'][0] + sx + cx
        nx, ny, nz = p['neck']
        hx, hy, hz = p['head']
        self.turn('neck', (nx - lean * p['look'] * 0.4, ny, nz - yaw * p['look'] * 0.4))
        self.turn('head', (hx - lean * p['look'] * 0.6, hy, hz - yaw * p['look'] * 0.6))
        for side, lift, forward in zip(('L', 'R'), p['shrug'], p['protract']):
            x = side_x(side)
            self.turn(f'clavicle.{side}', (0, -lift * x, -forward * x))

    def gap(self, p):
        grip = self.place(p['grip'], p['arms'])
        span = self.length['upperarm.R'] + self.length['forearm.R']
        return max(0.0, (grip - self.head('upperarm.R')).length - span * 0.97 - 0.035)

    def arms(self, p):
        space = p['arms']
        grip = self.place(p['grip'], space)
        blade = self.direct(p['blade'], space).normalized()
        frame, wrist, hand = self.hold('R', grip, blade, self.direct(p['elbow.R'], space))
        self.put('hand.R', frame @ self.rest['hand.R'].to_3x3(), wrist)
        self.note('grip', (wrist + frame @ GRIP_OFFSET['R'] - grip).length)
        self.note('wrist', math.degrees(math.asin(min(1.0, abs(hand.dot(blade))))))
        pole = self.direct(p['elbow.L'], space)
        free = self.place(p['hand.L'], space)
        two = max(0.0, min(1.0, p['two']))
        if two > 0:
            pommel = grip - blade * POMMEL
            shoulder = self.head('upperarm.L')
            guess = (pommel - shoulder).normalized()
            held = self.grip_frame(blade, guess, 'L')
            target = free.lerp(pommel - held @ GRIP_OFFSET['L'], two)
            elbow, reached, _ = self.solve('upperarm.L', 'forearm.L', target, pole)
            forearm = (reached - elbow).normalized()
            held = self.grip_frame(blade, forearm, 'L')
            start = self.ident('hand.L').to_3x3()
            loose = start.col[1].normalized().rotation_difference(forearm).to_matrix() @ start
            rotation = loose.to_quaternion().slerp((held @ self.rest['hand.L'].to_3x3()).to_quaternion(), two).to_matrix()
            self.put('hand.L', rotation, reached)
        else:
            elbow, reached, _ = self.solve('upperarm.L', 'forearm.L', free, pole)
            point = self.direct(p['point.L'], space) if p['point.L'] is not None else reached - elbow
            self.aim('hand.L', point)
        for side, curl in zip(('L', 'R'), p['curl']):
            shoulder, elbow, wrist, knuckle, tip, down = arm_points(side)
            palm = down.cross(Vector((0, -1, 0))).normalized() * side_x(side)
            axis = self.delta(f'hand.{side}').to_3x3() @ down.cross(palm)
            self.bend(f'fingers.{side}', axis, curl)

    def legs(self, p):
        tuck = p['tuck']
        for side in ('L', 'R'):
            target, pitch, flat = p[f'foot.{side}']
            ankle = self.delta('root') @ target
            if tuck > 0:
                ankle = ankle.lerp(self.delta('hips') @ p[f'tuck.{side}'], tuck)
            yaw = p['toes'] + p['hips'][2] * 0.5
            knee = self.F @ (rz(yaw) @ (p[f'knee.{side}']))
            if tuck > 0:
                knee = knee.lerp(self.delta('hips').to_3x3() @ Vector((0.1 * side_x(side), -1.0, 0.4)), tuck)
            _, _, miss = self.solve(f'thigh.{side}', f'shin.{side}', ankle, knee)
            if p['planted'].get(side):
                self.note('feet', miss)
            direction = self.F @ (rz(yaw) @ rx(pitch) @ FOOT_DIR)
            if tuck > 0:
                direction = direction.lerp(self.delta('hips').to_3x3() @ (rx(0.9) @ FOOT_DIR), tuck)
            self.aim(f'foot.{side}', direction)
            toe = rz(yaw) @ (Vector((0.0, -0.998, -0.06)) if flat else rx(pitch * 0.6) @ TOE_DIR)
            self.aim(f'toe.{side}', (self.F @ toe).lerp(self.delta(f'foot.{side}').to_3x3() @ TOE_DIR, tuck))

    def face(self, p):
        raise_, angry = p['brows']
        tilt = self.delta('head').to_3x3()
        for side in ('L', 'R'):
            x = side_x(side)
            self.turn(f'eye.{side}')
            self.scale(f'eye.{side}', (1.0, 1.0, max(0.06, 1.0 - p['blink'])))
            self.turn(f'brow.{side}', (0, -angry * x * 0.35, 0), self.F.transposed() @ (tilt @ Vector((0, 0, raise_ * 0.012))))
        opened, wide = p['mouth']
        self.turn('mouth')
        self.scale('mouth', (wide, 1.0, opened))

    def swing(self, p):
        dt = 1.0 / FPS
        travel = self.F @ p['travel']
        push = (travel - self.last_travel) / dt if self.last_travel is not None else Vector()
        self.last_travel = travel.copy()
        for name, k, c, g, drag, limit, collider in CHAINS:
            start = self.ident(name)
            head = start.translation.copy()
            axis = start.to_3x3().col[1]
            length = axis.length * self.length[name]
            rest = axis.normalized()
            target = head + rest * length
            state = self.dynamics.get(name)
            if state is None:
                state = self.dynamics[name] = {'tip': target.copy(), 'vel': Vector(), 'target': target.copy()}
            follow = (target - state['target']) / dt
            tip, vel = state['tip'].copy(), state['vel'].copy()
            steps = 8
            h = dt / steps
            for _ in range(steps):
                force = (target - tip) * k - (vel - follow) * c + GRAVITY * g - (vel + travel) * drag - push
                vel += force * h
                tip += vel * h
                tip = self.settle(name, head, tip, rest, length, limit, collider)
                along = (tip - head).normalized()
                vel -= along * vel.dot(along)
            state.update(tip=tip, vel=vel, target=target)
            self.aim(name, tip - head)

    def settle(self, name, head, tip, rest, length, limit, collider):
        d = tip - head
        d = d.normalized() if d.length > 1e-6 else rest.copy()
        angle = d.angle(rest, 0.0)
        if angle > limit:
            axis = rest.cross(d)
            d = Matrix.Rotation(limit, 3, axis.normalized()) @ rest if axis.length > 1e-6 else rest.copy()
        tip = head + d * length
        if collider:
            frame = self.delta(collider)
            local = push_out(frame.inverted() @ tip, collider, self.least[name])
            tip = head + ((frame @ local) - head).normalized() * length
        floor = CLEAR.get(name, FLOOR)
        if tip.z < floor:
            rise = max(-1.0, min(1.0, (floor - head.z) / length))
            flat = Vector((tip.x - head.x, tip.y - head.y, 0.0))
            flat = flat.normalized() if flat.length > 1e-6 else Vector((rest.x, rest.y, 0.0)).normalized()
            tip = head + (flat * math.sqrt(1.0 - rise * rise) + Vector((0.0, 0.0, rise))) * length
        return tip

    def lowest(self):
        return min((self.pose[name] @ point).z for name, points in self.hull.items() if name in self.pose for point in points)

    def evaluate(self, p):
        self.pose, self.basis = {}, {}
        self.F = Matrix.Identity(3)
        self.turn('root', (0, 0, p['spin']), (0, 0, p['raise']))
        self.F = rz(p['spin'])
        self.turn('hips', p['hips'], p['lift'])
        self.torso(p, 0.0)
        if p['reach'] > 0 and self.gap(p) > 0:
            best, extra = self.gap(p), 0.0
            for step in range(1, 13):
                for sign in (1.0, -1.0):
                    trial = sign * step * p['reach'] / 12
                    self.torso(p, trial)
                    gap = self.gap(p)
                    if gap < best - 1e-4:
                        best, extra = gap, trial
                if best <= 0:
                    break
            self.torso(p, extra)
        self.face(p)
        self.arms(p)
        self.legs(p)
        if p['floor'] is not None:
            gap = p['floor'] - self.lowest()
            if gap > 0:
                return self.evaluate({**p, 'raise': p['raise'] + gap, 'floor': None})
        glide = max(0.01, p['glider'])
        self.turn('glider')
        self.scale('glider', (glide, glide, glide))
        self.swing(p)
        shrink = 1.0 - 0.8 * p['glider']
        for name in ('cape.M1', 'cape.L1', 'cape.R1'):
            self.scale(name, (shrink, shrink, shrink))
        for name in NAMES:
            if name not in self.pose:
                self.turn(name)
        return self.basis


def base():
    return {
        'spin': 0.0, 'hips': (0.0, 0.0, 0.0), 'lift': v(0, 0, -0.015), 'spine': (0.0, 0.0, 0.0), 'chest': (0.0, 0.0, 0.0),
        'neck': (0.0, 0.0, 0.0), 'head': (0.0, 0.0, 0.0), 'look': 0.8, 'shrug': (0.0, 0.0), 'protract': (0.0, 0.0),
        'grip': HOLD_GRIP.copy(), 'blade': HOLD_BLADE.copy(), 'elbow.R': v(-0.3, 1.0, 0.0), 'reach': 0.0, 'arms': 'root',
        'hand.L': v(0.21, -0.03, 0.71), 'elbow.L': v(0.3, 1.0, 0.0), 'point.L': None, 'two': 0.0, 'curl': (0.45, 1.5),
        'foot.L': (ANKLE['L'] + v(0.012, 0.03, 0), 0.0, False), 'foot.R': (ANKLE['R'] + v(-0.012, -0.035, 0), 0.0, False),
        'knee.L': v(0.15, -1, 0), 'knee.R': v(-0.15, -1, 0), 'toes': 0.0, 'tuck': 0.0, 'tuck.L': ANKLE['L'] + v(0, -0.15, 0.3), 'tuck.R': ANKLE['R'] + v(0, -0.15, 0.3),
        'planted': {'L': True, 'R': True},
        'blink': 0.0, 'brows': (0.0, 0.0), 'mouth': (1.0, 1.0), 'glider': 0.0, 'travel': Vector(), 'floor': None, 'raise': 0.0,
    }


def blinks(t, times, width=0.07):
    return max([1.0 - smooth(abs(t - at) / width) for at in times] + [0.0])


def stance(p, wide=0.0, front=0.0):
    p['foot.L'] = (ANKLE['L'] + v(0.012 + wide, 0.03 + front, 0), 0.0, False)
    p['foot.R'] = (ANKLE['R'] + v(-0.012 - wide, -0.035 - front, 0), 0.0, False)


def keyed(p, t, keys):
    for channel, ks in keys.items():
        value = track(t, ks)
        p[channel] = Vector(value) if channel in ('lift', 'grip', 'blade', 'hand.L', 'elbow.R', 'elbow.L', 'travel', 'point.L') else value


def looping(fn):
    fn.loop = True
    return fn


def gait_feet(p, t, cycle, speed, duty, lift, heading, width=0.085, heel=0.4, flex=0.25, yaw=0.0):
    phase = (t / cycle) % 1.0
    sweep = speed * cycle * duty
    head = Vector((heading[0], heading[1], 0.0)).normalized()
    for side, offset in (('L', 0.0), ('R', 0.5)):
        x = side_x(side)
        ph = (phase - offset) % 1.0
        home = rz(yaw) @ Vector((width * x, BALL[side].y, BALL[side].z))
        if ph < duty:
            u = ph / duty
            ball = home + head * (sweep * (0.5 - u))
            pitch = heel * smooth((u - 0.6) / 0.4) - flex * (1.0 - smooth(u / 0.22))
            raised = 0.0
        else:
            u = (ph - duty) / (1.0 - duty)
            ball = home + head * (sweep * (-0.5 + smooth(u)))
            pitch = heel * (1.0 - smooth(u / 0.4)) - flex * smooth((u - 0.55) / 0.45)
            raised = lift * math.sin(math.pi * u) ** 0.8
        p[f'foot.{side}'] = (foot_at(ball, pitch, yaw) + v(0, 0, raised), pitch, ph < duty and pitch > 0.02)
        p['planted'][side] = ph < duty
    p['toes'] = yaw
    return phase


def gait(speed, cycle, duty, lift, drop, bob, lean, swing, heading=(0, -1), turn=0.0, sway=0.012, heel=0.4, flex=0.25, upper=None, carry=1.0):
    @looping
    def clip(t):
        p = base()
        phase = gait_feet(p, t, cycle, speed, duty, lift, heading, heel=heel, flex=flex, yaw=turn * 0.8)
        w = math.tau * phase
        mid = math.cos(2 * (w - math.pi * duty))
        side = math.cos(w - math.pi * duty)
        p['lift'] = v(sway * side, 0.0, -drop + bob * mid)
        p['hips'] = (lean * 0.35, -0.05 * side, -0.16 * math.cos(w) + turn)
        p['spine'] = (lean * 0.35, 0.02 * side, 0.08 * math.cos(w) - turn * 0.4)
        p['chest'] = (lean * 0.3 - 0.02 * mid, 0.0, 0.14 * math.cos(w) - turn * 0.6)
        p['head'] = (0.0, 0.0, 0.0)
        a = math.cos(w)
        p['arms'] = 'chest'
        p['hand.L'] = v(0.19, 0.17 * swing * a, 0.73 + 0.13 * carry + 0.06 * swing * max(0.0, -a))
        p['elbow.L'] = v(0.25, 1.0, -0.3)
        p['grip'] = v(-0.24, 0.1 - 0.1 * swing * a, 0.7 + 0.04 * swing * max(0.0, a))
        p['blade'] = (rx(0.3 * swing * a) @ v(-0.4, 0.72, -0.56)).normalized()
        p['elbow.R'] = v(-0.25, 1.0, -0.3)
        p['travel'] = Vector((heading[0], heading[1], 0.0)).normalized() * speed
        p['blink'] = blinks(t, (cycle * 0.3,)) if cycle > 0.8 else 0.0
        p['mouth'] = (1.0 + 0.4 * min(1.0, speed / 6.9), 0.95)
        if upper:
            upper(p, t, phase)
        return p
    return clip


def idle_clip(t):
    p = base()
    w = math.tau * t / 4.0
    breath = math.sin(w * 3)
    p['lift'] = v(0.008 * math.sin(w), 0.0, -0.018 + 0.003 * breath)
    p['hips'] = (0.0, 0.02 * math.sin(w), 0.04 * math.sin(w + 0.5))
    p['spine'] = (0.015 + 0.008 * breath, 0.0, 0.0)
    p['chest'] = (-0.01 - 0.012 * breath, -0.015 * math.sin(w), 0.03 * math.sin(w))
    p['head'] = (0.03 * math.sin(w * 2 + 1), 0.04 * math.sin(w + 2), 0.14 * math.sin(w + 1.2))
    p['look'] = 0.6
    p['shrug'] = (0.025 * breath, 0.025 * breath)
    p['hand.L'] = v(0.21, -0.03 - 0.008 * breath, 0.72 + 0.006 * breath)
    p['blink'] = blinks(t, (1.2, 3.1))
    p['brows'] = (0.15 * smooth((t - 2.0) / 0.3) * (1 - smooth((t - 2.9) / 0.3)), 0.0)
    p['mouth'] = (1.0, 1.05)
    stance(p, 0.012)
    return p


def blink_clip(t):
    p = idle_clip(0.0)
    p['blink'] = blinks(t, (0.08,), 0.08)
    return p


ATTACK_SAMPLES = {name: rows for name, rows in TABLES['samples'].items()}


def sample(name, t):
    rows = ATTACK_SAMPLES[name]
    end = ATTACKS[name]['end']
    f = max(0.0, min(len(rows) - 1.0, t / end * (len(rows) - 1)))
    i = min(len(rows) - 2, int(f))
    u = f - i
    a, b = rows[i], rows[i + 1]
    mix_ = lambda key: Vector(a[key]).lerp(Vector(b[key]), u)
    return {'grip': mix_('grip'), 'tip': mix_('tip'), 'yaw': a['yaw'] + (b['yaw'] - a['yaw']) * u, 'pitch': a['pitch'] + (b['pitch'] - a['pitch']) * u, 'lunge': a['lunge'] + (b['lunge'] - a['lunge']) * u}


def steps(p, t, lunge, plan, width=0.1):
    for side, keys in plan.items():
        x = side_x(side)
        times = [k[0] for k in keys]
        world, lifted, pitch = 0.0, 0.0, 0.0
        if t <= times[0]:
            world = keys[0][1]
        elif t >= times[-1]:
            world = keys[-1][1]
        for i in range(len(keys) - 1):
            ta, ya = keys[i][0], keys[i][1]
            tb, yb = keys[i + 1][0], keys[i + 1][1]
            if ta <= t <= tb:
                u = (t - ta) / max(1e-6, tb - ta)
                if abs(yb - ya) > 1e-6 or keys[i + 1][2] > 0:
                    world = ya + (yb - ya) * smooth(u)
                    lifted = keys[i + 1][2] * math.sin(math.pi * u)
                    pitch = 0.35 * math.sin(math.pi * u) * (1 - u) - 0.2 * smooth((u - 0.6) / 0.4) * (1 - smooth((u - 0.92) / 0.08))
                else:
                    world = ya
        spot = Vector((width * x + keys[0][3] * x if len(keys[0]) > 3 else width * x, BALL[side].y - (world - lunge), BALL[side].z))
        p[f'foot.{side}'] = (foot_at(spot, max(0.0, pitch) if lifted <= 0 else pitch) + v(0, 0, lifted), pitch, False)
        p['planted'][side] = lifted <= 1e-4


def twist(rel_yaw):
    return -math.radians(rel_yaw - 25.0) * 0.55


def attack(name, plan, body, spin=None, two=None):
    a = ATTACKS[name]

    def clip(t):
        p = base()
        s = sample(name, t)
        held = smooth(t / (a['strike'][0] * 0.6)) * (1.0 - smooth((t - a['end'] + 0.16) / 0.16))
        p['grip'] = HOLD_GRIP.lerp(s['grip'], held)
        p['blade'] = HOLD_BLADE.lerp((s['tip'] - s['grip']).normalized(), held).normalized()
        turned = spin(t, s['yaw']) if spin else 0.0
        p['spin'] = math.radians(turned)
        rel = s['yaw'] + turned
        p['grip'] = rz(-p['spin']) @ p['grip']
        p['blade'] = rz(-p['spin']) @ p['blade']
        total = twist(rel)
        p['hips'] = (0.0, 0.0, total * 0.3)
        p['spine'] = (0.0, 0.0, total * 0.3)
        p['chest'] = (0.0, 0.0, total * 0.4)
        p['reach'] = math.radians(70)
        p['look'] = 0.9
        p['elbow.R'] = v(-0.8, 0.3, -0.6)
        p['protract'] = (0.0, 0.08 * smooth((-rel + 10) / 60))
        p['brows'] = (-0.1, 0.8)
        p['mouth'] = (1.3, 0.85)
        p['curl'] = (1.2, 1.5)
        keyed(p, t, body)
        hx, hy, hz = p['hips']
        p['hips'] = (hx, hy, hz + total * 0.3 if 'hips' in body else hz)
        if two:
            p['two'] = track(t, two)
        steps(p, t, s['lunge'], plan)
        rate = (sample(name, min(a['end'], t + 0.02))['lunge'] - sample(name, max(0.0, t - 0.02))['lunge']) / 0.04
        p['travel'] = Vector((0.0, -rate, 0.0))
        return p
    return clip, a['end']


def light1():
    return attack('light1', {
        'R': [(0.0, 0.0, 0.0), (0.085, 0.64, 0.07), (0.4, 0.64, 0.0)],
        'L': [(0.0, 0.0, 0.0), (0.05, 0.0, 0.0), (0.17, 0.44, 0.05), (0.4, 0.44, 0.0)],
    }, {
        'lift': [(0.0, (0, 0, -0.015)), (0.07, (0, 0, -0.05)), (0.15, (0, 0, -0.085)), (0.26, (0, 0, -0.07)), (0.4, (0, 0, -0.03))],
        'spine': [(0.0, (0.0, 0, 0)), (0.06, (-0.04, 0, 0)), (0.15, (0.12, 0, 0)), (0.4, (0.04, 0, 0))],
        'hand.L': [(0.0, (0.21, -0.04, 0.73)), (0.08, (0.12, -0.2, 0.92)), (0.17, (0.3, 0.05, 0.86)), (0.4, (0.24, -0.02, 0.78))],
    })


def light2():
    return attack('light2', {
        'L': [(0.0, 0.0, 0.0), (0.08, 0.62, 0.07), (0.42, 0.62, 0.0)],
        'R': [(0.0, 0.0, 0.0), (0.05, 0.0, 0.0), (0.16, 0.4, 0.05), (0.42, 0.4, 0.0)],
    }, {
        'lift': [(0.0, (0, 0, -0.03)), (0.07, (0, 0, -0.07)), (0.14, (0, 0, -0.05)), (0.22, (0, 0, -0.035)), (0.42, (0, 0, -0.02))],
        'spine': [(0.0, (0.06, 0, 0)), (0.07, (0.1, 0, 0)), (0.16, (-0.04, 0, 0)), (0.42, (0.02, 0, 0))],
        'hand.L': [(0.0, (0.24, -0.02, 0.78)), (0.08, (0.3, 0.06, 0.84)), (0.16, (0.18, -0.22, 0.95)), (0.42, (0.22, -0.04, 0.76))],
    })


def light3():
    def spin(t, yaw):
        if t <= 0.3:
            return (95.0 - yaw) * smooth(t / 0.1)
        return 345.0 + 15.0 * smooth((t - 0.3) / 0.08)
    return attack('light3', {
        'L': [(0.0, 0.0, 0.0), (0.03, 0.0, 0.0), (0.3, 0.86, 0.16), (0.68, 0.86, 0.0)],
        'R': [(0.0, 0.0, 0.0), (0.06, 0.0, 0.0), (0.32, 1.02, 0.16), (0.68, 1.02, 0.0)],
    }, {
        'lift': [(0.0, (0, 0, -0.02)), (0.09, (0, 0, -0.1)), (0.2, (0, 0, 0.06)), (0.33, (0, 0, -0.12)), (0.45, (0, 0, -0.08)), (0.68, (0, 0, -0.025))],
        'spine': [(0.0, (0.0, 0, 0)), (0.09, (0.14, 0, 0)), (0.22, (0.04, 0.0, 0)), (0.35, (0.16, 0, 0)), (0.68, (0.03, 0, 0))],
        'hand.L': [(0.0, (0.21, -0.04, 0.73)), (0.1, (0.15, -0.2, 0.86)), (0.22, (0.42, 0.0, 1.0)), (0.36, (0.35, 0.05, 0.9)), (0.68, (0.22, -0.03, 0.75))],
        'elbow.L': [(0.0, (0.7, 0.4, -0.4)), (0.22, (0.6, 0.2, 0.3)), (0.68, (0.7, 0.4, -0.4))],
    }, spin)


def heavy():
    return attack('heavy', {
        'L': [(0.0, 0.0, 0.0), (0.015, 0.0, 0.0), (0.22, 1.18, 0.22), (0.78, 1.18, 0.0)],
        'R': [(0.0, 0.0, 0.0), (0.03, 0.0, 0.0), (0.24, 1.32, 0.22), (0.78, 1.32, 0.0)],
    }, {
        'lift': [(0.0, (0, 0, -0.04)), (0.08, (0, 0, -0.13)), (0.16, (0, 0, 0.08)), (0.25, (0, 0, -0.19)), (0.4, (0, 0, -0.16)), (0.78, (0, 0, -0.03))],
        'spine': [(0.0, (-0.05, 0, 0)), (0.1, (-0.18, 0, 0)), (0.21, (0.32, 0, 0)), (0.32, (0.38, 0, 0)), (0.78, (0.04, 0, 0))],
        'chest': [(0.0, (-0.04, 0, 0)), (0.1, (-0.16, 0, 0)), (0.21, (0.2, 0, 0)), (0.32, (0.22, 0, 0)), (0.78, (0.02, 0, 0))],
        'brows': [(0.0, (-0.1, 0.8)), (0.2, (-0.2, 1.0)), (0.78, (0.0, 0.4))],
        'mouth': [(0.0, (1.2, 0.85)), (0.18, (2.2, 0.8)), (0.4, (1.4, 0.85)), (0.78, (1.0, 1.0))],
    }, two=[(0.0, 1.0), (0.5, 1.0), (0.7, 0.0)])


def charge_upper(p, t, phase=0.0):
    shake = 0.006 * math.sin(t * 61) + 0.004 * math.sin(t * 43)
    p['grip'] = RAISED_GRIP + v(shake, 0.0, shake * 0.5)
    p['blade'] = (RAISED_TIP - RAISED_GRIP).normalized()
    p['arms'] = 'root'
    p['two'] = 1.0
    p['elbow.R'] = v(-0.8, 0.2, -0.4)
    p['elbow.L'] = v(0.8, 0.2, -0.4)
    p['reach'] = math.radians(40)
    p['brows'] = (-0.15, 1.0)
    p['mouth'] = (0.9, 0.8)
    p['curl'] = (1.5, 1.5)


@looping
def charge_clip(t):
    p = base()
    w = math.tau * t / 1.0
    p['lift'] = v(0.0, 0.0, -0.08 + 0.006 * math.sin(w * 2))
    p['spine'] = (-0.06, 0.0, 0.1)
    p['chest'] = (-0.08, 0.0, 0.08)
    p['hips'] = (0.05, 0.0, 0.15)
    stance(p, 0.05, 0.08)
    charge_upper(p, t)
    return p


def stalk_upper(p, t, phase):
    charge_upper(p, t)
    p['spine'] = (-0.04, 0.0, 0.0)
    p['chest'] = (-0.06, 0.0, p['chest'][2] * 0.3)


def jump_clip(t):
    p = base()
    s = smooth(t / 0.18)
    p['lift'] = v(0, 0, 0.02 - 0.06 * s)
    p['spine'] = (0.08 * s, 0, 0)
    p['tuck'] = 0.85 * s
    p['tuck.L'] = ANKLE['L'] + v(0.01, -0.02, 0.36)
    p['tuck.R'] = ANKLE['R'] + v(-0.01, 0.1, 0.26)
    p['foot.L'] = (ANKLE['L'] + v(0.0, 0.08, -0.02), 0.5, False)
    p['foot.R'] = (ANKLE['R'] + v(0.0, 0.15, 0.0), 0.6, False)
    p['planted'] = {}
    p['hand.L'] = v(0.32, -0.06, 0.98).lerp(v(0.3, -0.12, 0.9), s)
    p['grip'] = v(-0.26, 0.05, 0.9)
    p['blade'] = v(-0.3, 0.7, -0.5).normalized()
    p['travel'] = v(0, -2.0, 7.1 - 25 * t)
    p['brows'] = (0.4, 0.0)
    p['mouth'] = (1.6, 0.9)
    return p


@looping
def fall_clip(t):
    p = base()
    w = math.tau * t / 0.8
    p['tuck'] = 0.35
    p['tuck.L'] = ANKLE['L'] + v(0.03, -0.08 + 0.05 * math.sin(w), 0.2)
    p['tuck.R'] = ANKLE['R'] + v(-0.03, 0.08 - 0.05 * math.sin(w), 0.12)
    p['foot.L'] = (ANKLE['L'] + v(0.03, -0.04 + 0.06 * math.sin(w), 0.04), 0.4, False)
    p['foot.R'] = (ANKLE['R'] + v(-0.03, 0.06 - 0.06 * math.sin(w), 0.02), 0.5, False)
    p['planted'] = {}
    p['spine'] = (-0.05, 0, 0)
    p['hand.L'] = v(0.38, -0.02, 1.0 + 0.03 * math.sin(w + 1))
    p['elbow.L'] = v(0.3, 0.2, -1.0)
    p['grip'] = v(-0.36, -0.02, 0.98 + 0.03 * math.sin(w))
    p['blade'] = v(-0.6, 0.5, -0.4).normalized()
    p['elbow.R'] = v(-0.3, 0.2, -1.0)
    p['travel'] = v(0, -2.0, -9.0)
    p['brows'] = (0.5, -0.2)
    p['mouth'] = (1.8, 0.85)
    return p


def land_clip(t):
    p = base()
    d = track(t, [(0.0, 0.0), (0.06, 0.15), (0.16, 0.07), (0.3, 0.02)])
    p['lift'] = v(0, 0, -d)
    p['spine'] = (d * 1.4, 0, 0)
    p['hand.L'] = v(0.25, -0.1 + d * 0.3, 0.78 - d * 0.6)
    p['grip'] = v(-0.24, -0.16, 0.8 - d * 0.5)
    stance(p, 0.03)
    p['brows'] = (0.1, 0.0)
    return p, 0.3


def stumble_clip(t):
    p = base()
    d = track(t, [(0.0, 0.05), (0.08, 0.32), (0.3, 0.26), (0.5, 0.03)])
    p['lift'] = v(0, 0, -d)
    p['spine'] = (d * 1.6, 0, 0)
    p['chest'] = (d * 0.6, 0, 0)
    p['hand.L'] = v(0.22, -0.3, 0.12).lerp(v(0.21, -0.04, 0.73), smooth((t - 0.28) / 0.22))
    p['elbow.L'] = v(0.8, 0.4, 0.0)
    p['grip'] = v(-0.26, -0.2, 0.6 - d * 0.4)
    p['blade'] = v(-0.5, -0.7, -0.3).normalized()
    stance(p, 0.06, 0.06)
    p['brows'] = (0.2, -0.6)
    p['mouth'] = (1.5, 0.8)
    p['blink'] = track(t, [(0.0, 0.0), (0.08, 0.7), (0.3, 0.6), (0.5, 0.0)])
    return p, 0.5


def roll_clip(t):
    p = base()
    end = DODGE['time']
    s = t / end
    turn = math.tau * smooth((s - 0.08) / 0.8)
    tuck = math.sin(math.pi * min(1.0, s / 0.92)) ** 0.6
    centre = v(0.0, -0.1, 0.86)
    height = 0.86 + (0.34 - 0.86) * tuck
    hip = Vector(BONE['hips'][0])
    turned = rx(turn) @ (centre - hip) + hip
    p['hips'] = (turn, 0.0, 0.0)
    p['lift'] = v(0.0, -turned.y + centre.y * (1 - tuck), height - turned.z)
    p['spine'] = (0.55 * tuck, 0, 0)
    p['chest'] = (0.45 * tuck, 0, 0)
    p['neck'] = (0.4 * tuck, 0, 0)
    p['head'] = (0.3 * tuck, 0, 0)
    p['look'] = 0.8 * (1 - tuck)
    p['tuck'] = tuck
    p['tuck.L'] = ANKLE['L'] + v(0.02, -0.26, 0.5)
    p['tuck.R'] = ANKLE['R'] + v(-0.02, -0.24, 0.44)
    p['planted'] = {'L': s > 0.97, 'R': s > 0.97}
    p['floor'] = 0.01
    p['arms'] = 'chest'
    p['hand.L'] = p['hand.L'].lerp(v(0.14, -0.2, 0.95), tuck)
    p['grip'] = HOLD_GRIP.lerp(v(-0.15, -0.18, 0.92), tuck)
    p['blade'] = HOLD_BLADE.lerp(v(-0.97, 0.18, -0.1).normalized(), tuck).normalized()
    p['travel'] = v(0, -DODGE['distance'] * 2.4 / end * (1 - min(1.0, s)) ** 1.4, 0)
    p['blink'] = 0.6 * tuck
    p['brows'] = (0.0, 0.5)
    return p, end


def backstep_clip(t):
    p = base()
    end = DODGE['time']
    air = smooth(t / 0.05) * (1 - smooth((t - 0.32) / 0.04))
    p['lift'] = v(0, 0.04 * air, -0.05 + 0.05 * math.sin(math.pi * min(1.0, t / 0.36)) - track(t, [(0.0, 0.0), (0.05, 0.06), (0.1, 0.0), (0.36, 0.0), (0.39, 0.08), (0.42, 0.04)]))
    p['hips'] = (0.12 * air, 0, 0)
    p['spine'] = (0.08 * air, 0, 0)
    p['tuck'] = 0.5 * air
    p['tuck.L'] = ANKLE['L'] + v(0.0, -0.18, 0.2)
    p['tuck.R'] = ANKLE['R'] + v(0.0, -0.1, 0.15)
    stance(p, 0.02, 0.0)
    p['planted'] = {'L': air < 0.05, 'R': air < 0.05}
    p['hand.L'] = v(0.3, -0.05, 0.9)
    p['grip'] = HOLD_GRIP + v(0.0, -0.05, 0.08)
    p['travel'] = v(0, DODGE['distance'] * 2.4 / end * (1 - min(1.0, t / end)) ** 1.4, 0)
    p['brows'] = (0.1, 0.6)
    return p, end


def parry_clip(t):
    p = base()
    end = 0.4
    air = smooth(t / 0.06) * (1 - smooth((t - 0.32) / 0.05))
    p['lift'] = v(0, 0, -0.06 + 0.07 * math.sin(math.pi * min(1.0, t / 0.36)) - 0.06 * smooth((t - 0.33) / 0.04) * (1 - smooth((t - 0.37) / 0.03)))
    flick = track(t, [(0.0, 0.0), (0.08, 0.6), (0.15, 1.0), (0.22, 1.0), (0.3, 0.3), (0.4, 0.0)])
    sweep = track(t, [(0.0, 0.0), (0.12, 0.0), (0.2, 1.0), (0.4, 1.0)])
    up = v(-0.08, -0.32, 1.22)
    out = v(-0.42, -0.2, 1.05)
    p['grip'] = HOLD_GRIP.lerp(up.lerp(out, sweep), flick)
    rising = v(0.15, -0.2, 0.97).normalized()
    flung = v(-0.8, -0.2, 0.5).normalized()
    p['blade'] = HOLD_BLADE.lerp(rising.lerp(flung, sweep), flick).normalized()
    p['reach'] = math.radians(50)
    p['chest'] = (-0.1 * flick, 0, -0.25 * flick + 0.45 * sweep * flick)
    p['tuck'] = 0.45 * air
    p['tuck.L'] = ANKLE['L'] + v(0.02, -0.05, 0.22)
    p['tuck.R'] = ANKLE['R'] + v(-0.02, 0.1, 0.18)
    stance(p, 0.03, 0.03)
    p['planted'] = {'L': air < 0.05, 'R': air < 0.05}
    p['hand.L'] = v(0.35, 0.02, 0.92)
    p['travel'] = v(0, -DODGE['distance'] * 2.4 / DODGE['time'] * (1 - min(1.0, t / DODGE['time'])) ** 1.4, 0)
    p['brows'] = (0.2, 0.9)
    p['mouth'] = (1.2, 0.8)
    return p, end


def hurt_clip(t):
    p = base()
    end = VITALS['hurt']
    hit = track(t, [(0.0, 0.0), (0.05, 1.0), (0.2, 0.7), (0.4, 0.0)])
    air = smooth((t - 0.03) / 0.04) * (1 - smooth((t - 0.27) / 0.04))
    p['lift'] = v(0, 0, -0.04 - 0.06 * hit + 0.05 * air)
    p['hips'] = (-0.1 * hit, 0, 0)
    p['spine'] = (0.25 * hit, 0, 0.06 * hit)
    p['chest'] = (0.15 * hit, 0, 0.05 * hit)
    p['head'] = (-0.25 * hit, 0.1 * hit, 0)
    p['look'] = 0.3
    p['tuck'] = 0.4 * air
    p['tuck.L'] = ANKLE['L'] + v(0.02, -0.1, 0.18)
    p['tuck.R'] = ANKLE['R'] + v(-0.02, -0.02, 0.12)
    stance(p, 0.03, 0.05)
    p['planted'] = {'L': air < 0.05, 'R': air < 0.05}
    p['hand.L'] = v(0.3, -0.12, 0.9 + 0.08 * hit)
    p['grip'] = HOLD_GRIP + v(-0.06, 0.08, 0.1) * hit
    p['blink'] = 0.75 * hit
    p['brows'] = (0.3, -0.9 * hit)
    p['mouth'] = (1.0 + 1.0 * hit, 0.8)
    p['travel'] = v(0, 5.0 * (1 - t / end), 0)
    return p, end


def knocked_clip(t):
    p = base()
    end = VITALS['knocked']
    fall = smooth(t / 0.4)
    impact = track(t, [(0.0, 0.0), (0.38, 0.0), (0.42, 1.0), (0.5, 0.3), (0.56, 0.7), (0.8, 0.6)])
    lay = -1.45 * fall
    hip = Vector(BONE['hips'][0])
    centre = v(0.0, 0.0, 0.85)
    turned = rx(lay) @ (centre - hip) + hip
    height = 0.85 + 0.25 * math.sin(math.pi * min(1.0, t / 0.4)) * (1 - fall) + (0.12 - 0.85) * fall
    p['hips'] = (lay, 0.0, 0.0)
    p['lift'] = v(0.0, -turned.y + 0.1 * fall, height - turned.z + 0.04 * (impact - 0.6) * smooth((t - 0.4) / 0.05))
    p['spine'] = (-0.2 * (1 - fall) + 0.15 * fall, 0, 0.05)
    p['chest'] = (-0.15 * (1 - fall) + 0.1 * fall, 0, 0)
    p['head'] = (-0.3 * (1 - fall) + 0.35 * fall, 0, 0.2 * fall)
    p['look'] = 0.0
    p['tuck'] = 1.0
    p['tuck.L'] = ANKLE['L'] + v(0.04, -0.32 * fall - 0.05, 0.08 + 0.12 * (1 - fall))
    p['tuck.R'] = ANKLE['R'] + v(-0.06, -0.12 * fall - 0.05, 0.22 * (1 - fall) + 0.18 * fall)
    p['planted'] = {}
    p['arms'] = 'chest'
    p['hand.L'] = v(0.38, -0.02, 1.1 - 0.15 * fall)
    p['elbow.L'] = v(0.5, 0.0, -1.0)
    p['grip'] = v(-0.4, 0.0, 1.0 - 0.1 * fall)
    p['blade'] = v(-0.6, -0.2, 0.75 - 1.0 * fall).normalized()
    p['elbow.R'] = v(-0.5, 0.0, -1.0)
    p['blink'] = 0.9 * smooth((t - 0.4) / 0.05)
    p['brows'] = (0.4, -0.8)
    p['mouth'] = (2.0 - 0.8 * fall, 0.75)
    p['travel'] = v(0, 7.0 * (1 - fall), 5.5 - 25 * t if t < 0.4 else 0.0)
    p['floor'] = 0.01
    return p, end


LYING = dict(hips=(-1.45, 0.0, 0.0))


def lying(p, breath=0.0):
    hip = Vector(BONE['hips'][0])
    turned = rx(-1.45) @ (v(0.0, 0.0, 0.85) - hip) + hip
    p['hips'] = (-1.45, 0.0, 0.0)
    p['lift'] = v(0.0, -turned.y + 0.1, 0.12 - turned.z + 0.004 * breath)
    p['spine'] = (0.15 + 0.01 * breath, 0, 0.05)
    p['chest'] = (0.1, 0, 0)
    p['head'] = (0.35, 0, 0.25)
    p['look'] = 0.0
    p['tuck'] = 1.0
    p['tuck.L'] = ANKLE['L'] + v(0.04, -0.37, 0.08)
    p['tuck.R'] = ANKLE['R'] + v(-0.06, -0.17, 0.4)
    p['planted'] = {}
    p['arms'] = 'chest'
    p['hand.L'] = v(0.4, -0.02, 0.95)
    p['elbow.L'] = v(0.5, 0.0, -1.0)
    p['grip'] = v(-0.4, 0.0, 0.9)
    p['blade'] = v(-0.6, -0.2, -0.25).normalized()
    p['elbow.R'] = v(-0.5, 0.0, -1.0)
    p['floor'] = 0.01


@looping
def down_clip(t):
    p = base()
    lying(p, math.sin(math.tau * t / 2.0))
    p['blink'] = 1.0
    p['brows'] = (0.3, -0.6)
    p['mouth'] = (1.2, 0.8)
    return p


def rise_clip(t):
    end = VITALS['rise']
    lie = base()
    lying(lie)
    stand = base()
    stance(stand, 0.02)
    s = smooth(t / end)
    p = base()
    hx = lie['hips'][0] * (1 - smooth(t / (end * 0.8)))
    p['hips'] = (hx, 0, 0)
    hip = Vector(BONE['hips'][0])
    turned = rx(hx) @ (v(0.0, 0.0, 0.85) - hip) + hip
    height = 0.12 + (0.85 - 0.12) * smooth((t - end * 0.15) / (end * 0.85)) - 0.18 * math.sin(math.pi * s)
    p['lift'] = v(0.0, -turned.y + 0.1 * (1 - s), height - turned.z)
    p['spine'] = (0.15 + 0.45 * math.sin(math.pi * s), 0, 0.05 * (1 - s))
    p['chest'] = (0.1 * (1 - s), 0, 0)
    p['look'] = 0.8 * s
    p['tuck'] = 1.0 - smooth((t - end * 0.25) / (end * 0.5))
    p['tuck.L'] = ANKLE['L'] + v(0.04, -0.37 + 0.3 * s, 0.08 + 0.3 * s)
    p['tuck.R'] = ANKLE['R'] + v(-0.06, -0.17 + 0.15 * s, 0.4)
    p['planted'] = {'L': t > end * 0.8, 'R': t > end * 0.8}
    p['floor'] = 0.01
    p['hand.L'] = v(0.25, -0.05, 0.3).lerp(v(0.21, -0.04, 0.73), smooth((t - end * 0.5) / (end * 0.5)))
    p['elbow.L'] = v(0.8, 0.3, 0.0)
    p['grip'] = v(-0.3, -0.1, 0.35).lerp(HOLD_GRIP, smooth((t - end * 0.5) / (end * 0.5)))
    p['blade'] = v(-0.6, -0.5, -0.2).normalized().lerp(HOLD_BLADE, s).normalized()
    p['brows'] = (0.2, -0.4 * (1 - s))
    p['blink'] = 0.5 * (1 - s)
    return p, end


def climb_limbs(p, t, cycle, duty=0.55):
    phase = (t / cycle) % 1.0
    sweep = GAITS['climb']['speed'] * cycle * duty
    for limb, offset, home, depth in (('L', 0.0, 1.22, -0.31), ('R', 0.5, 1.22, -0.31)):
        x = side_x(limb)
        ph = (phase - offset) % 1.0
        if ph < duty:
            z = home + sweep * (0.5 - ph / duty)
            off = 0.0
        else:
            u = (ph - duty) / (1 - duty)
            z = home - sweep * 0.5 + sweep * smooth(u)
            off = 0.06 * math.sin(math.pi * u)
        if limb == 'L':
            p['hand.L'] = v(0.2, depth + off, z)
        else:
            p['grip'] = v(-0.2, depth + 0.05 + off, z - 0.03)
    for limb, offset in (('R', 0.0), ('L', 0.5)):
        x = side_x(limb)
        ph = (phase - offset) % 1.0
        if ph < duty:
            z = 0.32 + sweep * (0.5 - ph / duty)
            off = 0.0
        else:
            u = (ph - duty) / (1 - duty)
            z = 0.32 - sweep * 0.5 + sweep * smooth(u)
            off = 0.07 * math.sin(math.pi * u)
        p[f'foot.{limb}'] = (v(0.11 * x, WALL + 0.12 + off, z), -0.5, False)
        p['planted'][limb] = False
    return phase


def climb_pose(p):
    p['lift'] = v(0.0, -0.05, -0.04)
    p['hips'] = (-0.12, 0, 0)
    p['spine'] = (0.05, 0, 0)
    p['chest'] = (0.04, 0, 0)
    p['head'] = (-0.25, 0, 0)
    p['look'] = 0.0
    p['blade'] = v(-0.5, 0.25, -0.83).normalized()
    p['elbow.R'] = v(-1.0, 0.3, -0.6)
    p['elbow.L'] = v(1.0, 0.3, -0.6)
    p['knee.L'] = v(0.6, -1.0, 0.2)
    p['knee.R'] = v(-0.6, -1.0, 0.2)
    p['point.L'] = v(0, -0.2, 1)
    p['curl'] = (0.9, 1.5)
    p['brows'] = (0.1, 0.5)


@looping
def climb_clip(t):
    p = base()
    climb_pose(p)
    cycle = GAITS['climb']['cycle']
    phase = climb_limbs(p, t, cycle)
    w = math.tau * phase
    p['lift'] = v(0.02 * math.cos(w), -0.05, -0.04 + 0.015 * math.cos(2 * w))
    p['hips'] = (-0.12, 0.05 * math.cos(w), 0.04 * math.cos(w))
    p['chest'] = (0.04, -0.06 * math.cos(w), 0)
    p['travel'] = v(0, 0, GAITS['climb']['speed'])
    p['mouth'] = (1.2, 0.85)
    return p


@looping
def hang_clip(t):
    p = base()
    climb_pose(p)
    breath = math.sin(math.tau * t / 2.0 * 1.5)
    p['lift'] = v(0.0, -0.05, -0.05 + 0.004 * breath)
    p['hand.L'] = v(0.2, -0.31, 1.32)
    p['grip'] = v(-0.2, -0.26, 1.25)
    p['foot.L'] = (v(0.12, WALL + 0.12, 0.36), -0.5, False)
    p['foot.R'] = (v(-0.11, WALL + 0.12, 0.26), -0.5, False)
    p['planted'] = {}
    p['head'] = (-0.25, 0, 0.2 * math.sin(math.tau * t / 2.0))
    p['blink'] = blinks(t, (1.4,))
    return p


def leap_clip(t):
    p = base()
    climb_pose(p)
    end = CLIMB['leapTime']
    s = smooth(t / end)
    crouch = math.sin(math.pi * min(1.0, t / 0.12))
    p['lift'] = v(0.0, -0.05, -0.04 - 0.08 * crouch + 0.06 * s)
    p['hand.L'] = v(0.2, -0.31, 1.25).lerp(v(0.18, -0.33, 1.62), s)
    p['grip'] = v(-0.2, -0.26, 1.2).lerp(v(-0.18, -0.28, 1.58), s)
    p['blade'] = v(-0.5, 0.25, -0.83).normalized().lerp(v(-0.4, 0.3, 0.85).normalized(), s).normalized()
    p['foot.L'] = (v(0.12, WALL + 0.12, 0.36 - 0.15 * s), -0.5 + 0.7 * s, False)
    p['foot.R'] = (v(-0.11, WALL + 0.14, 0.26 - 0.18 * s), -0.5 + 0.8 * s, False)
    p['planted'] = {}
    p['head'] = (-0.45 * s - 0.25, 0, 0)
    p['travel'] = v(0, 0, CLIMB['leap'] / end)
    p['mouth'] = (1.7, 0.85)
    p['brows'] = (0.3, 0.6)
    return p, end


def mantle_clip(t):
    p = base()
    end = 0.45
    s = smooth(t / end)
    p['lift'] = v(0.0, 0.14 * (1 - s), -0.95 * (1 - smooth(t / (end * 0.85))) - 0.015)
    p['hips'] = (0.5 * math.sin(math.pi * s), 0, 0)
    p['spine'] = (0.35 * math.sin(math.pi * s), 0, 0)
    p['hand.L'] = v(0.22, -0.25, 0.04).lerp(v(0.21, -0.04, 0.73), smooth((t - 0.3) / 0.15))
    p['grip'] = v(-0.22, -0.22, 0.06).lerp(HOLD_GRIP, smooth((t - 0.3) / 0.15))
    p['blade'] = v(-0.6, -0.1, -0.2).normalized().lerp(HOLD_BLADE, smooth((t - 0.3) / 0.15)).normalized()
    p['elbow.L'] = v(0.6, 0.6, 0.3)
    p['elbow.R'] = v(-0.6, 0.6, 0.3)
    p['tuck'] = 1.0 - smooth((t - 0.3) / 0.13)
    p['tuck.L'] = ANKLE['L'] + v(0.02, -0.1 - 0.25 * s, 0.05 + 0.3 * s)
    p['tuck.R'] = ANKLE['R'] + v(-0.02, 0.05 - 0.1 * s, 0.0 + 0.2 * s)
    stance(p, 0.02)
    p['planted'] = {'L': t > 0.43, 'R': t > 0.43}
    p['travel'] = v(0, -0.5, 2.0 * (1 - s))
    p['mouth'] = (1.6, 0.85)
    p['brows'] = (0.2, 0.7)
    return p, end


@looping
def glide_clip(t):
    p = base()
    w = math.tau * t / 1.6
    p['glider'] = 1.0
    p['arms'] = 'chest'
    p['hand.L'] = v(0.2, -0.04, 1.4 + 0.01 * math.sin(w))
    p['grip'] = v(-0.2, -0.04, 1.4 + 0.01 * math.sin(w + 0.5))
    p['blade'] = v(-0.15, 0.55, -0.82).normalized()
    p['elbow.L'] = v(0.8, 0.3, 0.2)
    p['elbow.R'] = v(-0.8, 0.3, 0.2)
    p['point.L'] = v(0.1, 0.0, 1.0)
    p['curl'] = (1.3, 1.5)
    p['hips'] = (0.18, 0.04 * math.sin(w), 0.0)
    p['spine'] = (0.05, 0, 0)
    p['lift'] = v(0, 0, 0.05)
    p['tuck'] = 1.0
    p['tuck.L'] = ANKLE['L'] + v(0.0, 0.14 + 0.04 * math.sin(w), 0.1)
    p['tuck.R'] = ANKLE['R'] + v(0.0, 0.1 - 0.04 * math.sin(w), 0.16)
    p['planted'] = {}
    p['travel'] = v(0, -GLIDE['speed'], -GLIDE['sink'])
    p['brows'] = (0.3, 0.0)
    p['mouth'] = (1.3, 1.1)
    p['blink'] = blinks(t, (0.9,))
    return p


def swim_pose(p, tilt):
    hip = Vector(BONE['hips'][0])
    p['hips'] = (tilt, 0.0, 0.0)
    turned = rx(tilt) @ (v(0.0, 0.0, 1.0) - hip) + hip
    p['lift'] = v(0.0, -turned.y, 0.98 - turned.z)
    p['neck'] = (-tilt * 0.4, 0, 0)
    p['head'] = (-tilt * 0.45, 0, 0)
    p['look'] = 0.0
    p['tuck'] = 1.0
    p['planted'] = {}
    p['arms'] = 'chest'


@looping
def swim_clip(t):
    p = base()
    cycle = GAITS['swim']['cycle']
    s = (t / cycle) % 1.0
    swim_pose(p, 1.0)
    pull = track(s, [(0.0, 0.0), (0.35, 1.0), (0.55, 0.6), (0.75, 0.15), (1.0, 0.0)])
    reach = 1.0 - pull
    for side in ('L', 'R'):
        x = side_x(side)
        hand = v(0.08 * x, -0.42, 0.98).lerp(v(0.32 * x, -0.12, 1.0), pull)
        if side == 'L':
            p['hand.L'] = hand
        else:
            p['grip'] = hand
    p['blade'] = v(-0.4, 0.5, -0.75).normalized()
    p['elbow.L'] = v(0.7, 0.5, -0.4)
    p['elbow.R'] = v(-0.7, 0.5, -0.4)
    kick = track(s, [(0.0, 0.0), (0.3, 0.0), (0.55, 1.0), (0.75, 0.2), (1.0, 0.0)])
    for side in ('L', 'R'):
        x = side_x(side)
        p[f'tuck.{side}'] = ANKLE[side] + v(0.03 * x + 0.12 * x * kick, 0.06 + 0.1 * kick, 0.05 + 0.18 * kick)
    p['travel'] = v(0, -GAITS['swim']['speed'], 0)
    p['brows'] = (0.2, 0.2)
    p['mouth'] = (1.3, 0.9)
    return p


@looping
def tread_clip(t):
    p = base()
    w = math.tau * t / 1.5
    hip = Vector(BONE['hips'][0])
    p['lift'] = v(0.0, 0.0, -0.08 + 0.015 * math.sin(w * 2))
    p['tuck'] = 1.0
    p['planted'] = {}
    p['tuck.L'] = ANKLE['L'] + v(0.02, -0.08 * math.sin(w), 0.16 + 0.06 * math.cos(w))
    p['tuck.R'] = ANKLE['R'] + v(-0.02, 0.08 * math.sin(w), 0.16 - 0.06 * math.cos(w))
    p['hand.L'] = v(0.3 + 0.06 * math.sin(w * 2), -0.12, 0.96)
    p['point.L'] = v(0.3, -0.2 * math.cos(w * 2), -1.0)
    p['grip'] = v(-0.32 - 0.06 * math.sin(w * 2), -0.12, 0.96)
    p['blade'] = v(-0.5, 0.3, -0.8).normalized()
    p['elbow.L'] = v(0.6, 0.6, -0.3)
    p['elbow.R'] = v(-0.6, 0.6, -0.3)
    p['head'] = (-0.1, 0.0, 0.1 * math.sin(w))
    p['blink'] = blinks(t, (0.7,))
    p['mouth'] = (1.1, 1.0)
    return p


def pet_clip(t):
    p = base()
    end = 1.6
    down = smooth(t / 0.35) * (1 - smooth((t - 1.25) / 0.35))
    pat = math.sin(math.tau * (t - 0.5) / 0.32) if 0.5 < t < 1.14 else 0.0
    p['lift'] = v(0.0, 0.05 * down, -0.015 - 0.4 * down)
    p['hips'] = (0.2 * down, 0.0, -0.1 * down)
    p['spine'] = (0.3 * down, 0.0, 0.0)
    p['chest'] = (0.15 * down, 0.0, 0.08 * down)
    p['head'] = (0.25 * down, 0.2 * down, 0.0)
    p['look'] = 0.3
    p['foot.L'] = (ANKLE['L'] + v(0.04, -0.12, 0), 0.0, False)
    p['foot.R'] = (foot_at(BALL['R'] + v(-0.03, 0.18, 0.0), 0.6 * down), 0.6 * down, True)
    p['knee.L'] = v(0.3, -1.0, 0.0)
    p['knee.R'] = v(-0.1, -1.0, -0.4)
    rest_hand = v(0.21, -0.04, 0.73)
    p['hand.L'] = rest_hand.lerp(v(0.08, -0.46, 0.33 + 0.03 * pat), down)
    p['point.L'] = v(0.0, -0.6, -0.8) if down > 0.5 else None
    p['elbow.L'] = v(0.8, 0.2, -0.4)
    p['curl'] = (0.25, 1.5)
    p['grip'] = HOLD_GRIP.lerp(v(-0.3, 0.06, 0.5), down)
    p['blade'] = HOLD_BLADE.lerp(v(-0.3, 0.92, -0.25).normalized(), smooth(down / 0.5)).normalized()
    p['blink'] = 0.65 * smooth((t - 0.5) / 0.1) * (1 - smooth((t - 1.15) / 0.1))
    p['brows'] = (0.5 * down, -0.4 * down)
    p['mouth'] = (1.0 + 0.6 * down, 1.0 + 0.35 * down)
    return p, end


def victory_clip(t):
    p = base()
    end = 2.4
    hop = math.sin(math.pi * min(1.0, max(0.0, (t - 0.25) / 0.35)))
    crouch = track(t, [(0.0, 0.0), (0.2, 0.12), (0.25, 0.1), (0.6, 0.0), (0.68, 0.1), (0.85, 0.02), (2.4, 0.02)])
    p['lift'] = v(0.0, 0.0, -crouch + 0.22 * hop)
    p['tuck'] = 0.6 * hop
    p['tuck.L'] = ANKLE['L'] + v(0.02, -0.05, 0.25)
    p['tuck.R'] = ANKLE['R'] + v(-0.02, 0.05, 0.2)
    stance(p, 0.05)
    p['planted'] = {'L': hop < 0.02, 'R': hop < 0.02}
    up = smooth((t - 0.2) / 0.3) * (1 - smooth((t - 1.7) / 0.5))
    p['grip'] = HOLD_GRIP.lerp(v(-0.22, -0.06, 1.47), up)
    p['blade'] = HOLD_BLADE.lerp(v(-0.08, -0.1, 1.0).normalized(), up).normalized()
    p['elbow.R'] = v(-1.0, 0.2, -0.3)
    p['reach'] = math.radians(30)
    pump = math.sin(math.pi * min(1.0, max(0.0, (t - 0.3) / 0.25)))
    p['hand.L'] = v(0.21, -0.04, 0.73).lerp(v(0.3, -0.1, 1.0), up * 0.8 + 0.2 * pump)
    p['elbow.L'] = v(0.8, 0.3, -0.5)
    p['curl'] = (1.5, 1.5)
    p['spine'] = (-0.12 * up, 0.0, 0.0)
    p['chest'] = (-0.08 * up, 0.04 * up, 0.15 * up)
    p['head'] = (-0.15 * up, 0.1 * up, 0.0)
    p['look'] = 0.2
    p['blink'] = 0.6 * smooth((t - 0.6) / 0.1) * (1 - smooth((t - 1.4) / 0.15)) + blinks(t, (2.05,))
    p['brows'] = (0.6 * up, -0.2 * up)
    p['mouth'] = (1.0 + 1.3 * up, 1.0 + 0.4 * up)
    p['travel'] = v(0, 0, 3.0 * math.cos(math.pi * min(1.0, max(0.0, (t - 0.25) / 0.35))) if 0.25 < t < 0.6 else 0.0)
    return p, end


def hero_clips():
    out = [('idle', looping(idle_clip), 4.0), ('blink', blink_clip, 0.2)]
    walk, jog, sprint, stalk = GAITS['walk'], GAITS['jog'], GAITS['sprint'], GAITS['stalk']
    out += [
        ('walk', gait(walk['speed'], walk['cycle'], 0.6, 0.06, 0.03, 0.012, 0.04, 0.6, heel=0.3, flex=0.2, carry=0.0), walk['cycle']),
        ('jog', gait(jog['speed'], jog['cycle'], 0.3, 0.14, 0.1, -0.03, 0.2, 1.0), jog['cycle']),
        ('sprint', gait(sprint['speed'], sprint['cycle'], 0.26, 0.2, 0.12, -0.035, 0.38, 1.2, heel=0.5), sprint['cycle']),
        ('strafe-left', gait(jog['speed'], jog['cycle'], 0.3, 0.12, 0.1, -0.025, 0.1, 0.5, heading=(1, 0), turn=0.9), jog['cycle']),
        ('strafe-right', gait(jog['speed'], jog['cycle'], 0.3, 0.12, 0.1, -0.025, 0.1, 0.5, heading=(-1, 0), turn=-0.9), jog['cycle']),
        ('jog-back', gait(jog['speed'], jog['cycle'], 0.3, 0.1, 0.1, -0.025, -0.06, 0.5, heading=(0, 1), heel=0.1, flex=0.05), jog['cycle']),
        ('stalk', gait(stalk['speed'], stalk['cycle'], 0.6, 0.07, 0.09, 0.008, 0.05, 0.0, heel=0.3, flex=0.15, upper=stalk_upper), stalk['cycle']),
        ('charge', charge_clip, 1.0),
        ('jump', jump_clip, 0.45),
        ('fall', fall_clip, 0.8),
    ]
    for name, make in (('light1', light1), ('light2', light2), ('light3', light3), ('heavy', heavy)):
        fn, length = make()
        out.append((name, fn, length))
    for name, make in (('land', land_clip), ('stumble', stumble_clip), ('roll', roll_clip), ('backstep', backstep_clip), ('parry', parry_clip), ('hurt', hurt_clip), ('knocked', knocked_clip), ('rise', rise_clip), ('leap', leap_clip), ('mantle', mantle_clip), ('pet', pet_clip), ('victory', victory_clip)):
        length = make(0.0)[1]
        out.append((name, (lambda m: lambda t: m(t)[0])(make), length))
    out += [
        ('down', down_clip, 2.0),
        ('climb', climb_clip, GAITS['climb']['cycle']),
        ('hang', hang_clip, 2.0),
        ('glide', glide_clip, 1.6),
        ('swim', swim_clip, GAITS['swim']['cycle']),
        ('tread', tread_clip, 1.5),
    ]
    return out


POSES = [('idle', 1.0), ('walk', 0.14), ('jog', 0.12), ('sprint', 0.1), ('strafe-left', 0.1), ('jog-back', 0.1),
         ('light1', 0.05), ('light1', 0.13), ('light1', 0.25), ('light2', 0.06), ('light2', 0.12), ('light2', 0.25),
         ('light3', 0.12), ('light3', 0.22), ('light3', 0.4), ('heavy', 0.1), ('heavy', 0.18), ('heavy', 0.4),
         ('charge', 0.5), ('stalk', 0.1), ('roll', 0.2), ('parry', 0.18), ('jump', 0.3), ('fall', 0.3),
         ('glide', 0.4), ('climb', 0.2), ('swim', 0.3), ('hurt', 0.06), ('knocked', 0.6), ('rise', 0.3),
         ('pet', 0.8), ('victory', 1.0), ('land', 0.06), ('mantle', 0.2), ('tread', 0.3), ('down', 1.0)]
VIEWS = {'side': ((-2.7, -0.3, 1.0), (0, -0.3, 0.72)), 'game': ((-0.7, 2.6, 1.75), (0, -0.4, 0.85)), 'front': ((-1.3, -2.4, 1.05), (0, -0.2, 0.75))}


def render_poses(scene, rig, meshes, parts, folder, appearance, poses=POSES, views=VIEWS):
    preview_colours(meshes['glider'].data, parts['glider'], palette(appearance))
    meshes['glider'].data.color_attributes.active_color = meshes['glider'].data.color_attributes['Preview']
    shoot = studio(scene, 520, 50, 4)
    for name, seconds in poses:
        meshes['glider'].hide_render = name != 'glide'
        rig.animation_data.action = bpy.data.actions[name]
        scene.frame_set(round(seconds * FPS))
        for view, (location, look) in views.items():
            shoot(folder, f'pose-{name}-{seconds}-{view}', location, look)
    rig.animation_data.action = None


def main():
    scene = reset()
    rig = make_armature(scene, 'HeroRig', BONES)
    parts = build_parts()
    shade_creases(parts)
    meshes = {}
    for name, model in parts.items():
        meshes[name] = make_mesh(scene, name, model, rig, ('Body', 'Blade'), NAMES)
    solid = [mesh for name, mesh in meshes.items() if not name.startswith('sword-') and name != 'glider']
    report = bake(rig, HeroPoser(rig, solid), hero_clips(), located=LOCATED, scaled=SCALED)
    export(OUT, rig, list(meshes.values()))
    print('HERO', json.dumps({name: {'vertices': len(m.verts), 'triangles': sum(len(f) - 2 for f in m.faces)} for name, m in parts.items()}))
    print('CLIPS', json.dumps(report))
    print('BYTES', os.path.getsize(OUT))
    if RENDERS:
        render(scene, rig, meshes, parts, RENDERS, TABLES['AVATAR_DEFAULT'])
        render_poses(scene, rig, meshes, parts, RENDERS, TABLES['AVATAR_DEFAULT'])


main()
