import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
from kit import (ROOT, FPS, RENDERS, Model, Poser, bake, blob, catmull, export, facing, frames_along, loft, make_armature, make_mesh, mix, reset,
                 segment_distance, shade, smooth, srgb, studio, tables, track, tube, wobble)

OUT = os.path.join(ROOT, 'public', 'wilds', 'stag.glb')
TABLES = tables('src/core/wilds/stag.js', {'attacks': 'STAG_ATTACKS', 'stag': 'STAG', 'gaits': 'STAG_GAITS'})
ATTACKS, STAG, GAITS = TABLES['attacks'], TABLES['stag'], TABLES['gaits']


TONE = {name: srgb(code) for name, code in {
    'heartwood': '#3b281c', 'wood': '#6e4a31', 'woodLight': '#9a7350', 'bark': '#5a3c28', 'barkLight': '#8a6544',
    'rib': '#a88560', 'ribDark': '#6f5038', 'face': '#c2a27c', 'faceDark': '#80603f',
    'drift': '#ddd5c4', 'driftDark': '#9d9383', 'stone': '#9b958a', 'stoneDark': '#6f6a62',
    'lichen': '#c3c97f', 'lichenGold': '#d9b85a', 'moss': '#5f8a35', 'mossLight': '#8db24c', 'mossDark': '#3f6627',
    'sage': '#b3bf98', 'petal': '#fbf8ef', 'pollen': '#f2c443', 'amber': '#ffb54a', 'eye': '#ffe2a0', 'hoof': '#4a4440', 'mouth': '#2a1b14',
}.items()}

TORSO = [
    (1.40, 1.98, 0.07, 0.07), (1.34, 1.97, 0.24, 0.27), (1.22, 1.95, 0.35, 0.37), (1.00, 1.93, 0.41, 0.42),
    (0.72, 1.91, 0.42, 0.42), (0.40, 1.88, 0.40, 0.41), (0.05, 1.87, 0.39, 0.43), (-0.30, 1.88, 0.41, 0.46),
    (-0.60, 1.90, 0.42, 0.48), (-0.88, 1.95, 0.38, 0.46), (-1.06, 2.06, 0.31, 0.40), (-1.17, 2.26, 0.25, 0.31),
    (-1.26, 2.50, 0.21, 0.25), (-1.34, 2.75, 0.185, 0.21), (-1.41, 2.96, 0.17, 0.18), (-1.45, 3.10, 0.11, 0.11),
]


def torso_frame(s):
    y, z, rx, rz = catmull(TORSO, s)
    y2, z2, _, _ = catmull(TORSO, min(1.0, s + 0.004))
    y1, z1, _, _ = catmull(TORSO, max(0.0, s - 0.004))
    tangent = Vector((0.0, y2 - y1, z2 - z1)).normalized()
    side = Vector((1.0, 0.0, 0.0))
    up = tangent.cross(side).normalized()
    return Vector((0.0, y, z)), side, up, rx, rz


def torso_point(s, angle, lift=0.0):
    centre, side, up, rx, rz = torso_frame(s)
    width = rx * (1.0 - 0.14 * max(0.0, math.sin(angle)))
    height = rz * (1.04 if math.sin(angle) < 0 else 1.0)
    return centre + side * ((width + lift) * math.cos(angle)) + up * ((height + lift) * math.sin(angle))


def torso_s(y):
    best, closest = 0.0, 1e9
    for i in range(801):
        s = i / 800
        d = abs(catmull(TORSO, s)[0] - y)
        if d < closest and catmull(TORSO, s)[1] < 2.2:
            best, closest = s, d
    return best


BONES = [
    ('root', (0, 0, 0), (0, -0.5, 0), None, False),
    ('hips', (0, 0.85, 1.95), (0, 0.2, 1.97), 'root', False),
    ('spine', (0, 0.2, 1.97), (0, -0.45, 2.0), 'hips', True),
    ('chest', (0, -0.45, 2.0), (0, -1.0, 2.1), 'spine', True),
    ('neck1', (0, -1.05, 2.15), (0, -1.27, 2.55), 'chest', False),
    ('neck2', (0, -1.27, 2.55), (0, -1.42, 2.95), 'neck1', True),
    ('head', (0, -1.42, 2.98), (0, -2.05, 2.78), 'neck2', False),
    ('jaw', (0, -1.58, 2.86), (0, -2.0, 2.68), 'head', False),
    ('ear.L', (0.15, -1.47, 3.1), (0.4, -1.43, 3.03), 'head', False),
    ('ear.R', (-0.15, -1.47, 3.1), (-0.4, -1.43, 3.03), 'head', False),
    ('tail', (0, 1.36, 2.02), (0, 1.56, 1.78), 'hips', False),
    ('rib.L', (0.2, -0.62, 2.22), (0.42, -0.62, 1.74), 'chest', False),
    ('rib.R', (-0.2, -0.62, 2.22), (-0.42, -0.62, 1.74), 'chest', False),
]
for side, x in (('L', 1), ('R', -1)):
    BONES += [
        (f'scap.{side}', (0.27 * x, -0.66, 2.14), (0.33 * x, -0.88, 1.62), 'chest', False),
        (f'arm.{side}', (0.33 * x, -0.88, 1.62), (0.31 * x, -0.72, 1.22), f'scap.{side}', True),
        (f'fore.{side}', (0.31 * x, -0.72, 1.22), (0.30 * x, -0.80, 0.66), f'arm.{side}', True),
        (f'cannonF.{side}', (0.30 * x, -0.80, 0.66), (0.30 * x, -0.82, 0.20), f'fore.{side}', True),
        (f'hoofF.{side}', (0.30 * x, -0.82, 0.20), (0.30 * x, -0.97, 0.03), f'cannonF.{side}', True),
        (f'thigh.{side}', (0.30 * x, 0.88, 1.88), (0.34 * x, 0.62, 1.24), 'hips', False),
        (f'shin.{side}', (0.34 * x, 0.62, 1.24), (0.32 * x, 1.02, 0.66), f'thigh.{side}', True),
        (f'cannonH.{side}', (0.32 * x, 1.02, 0.66), (0.31 * x, 0.96, 0.20), f'shin.{side}', True),
        (f'hoofH.{side}', (0.31 * x, 0.96, 0.20), (0.31 * x, 0.82, 0.03), f'cannonH.{side}', True),
    ]
BONE = {name: (Vector(head), Vector(tail), parent) for name, head, tail, parent, _ in BONES}
CHAIN = ['hips', 'spine', 'chest', 'neck1', 'neck2', 'head']


def chain_weights(p, chain=CHAIN, sharp=4.0):
    scored = sorted(((segment_distance(p, BONE[n][0], BONE[n][1]), n) for n in chain))[:2]
    raw = [(1.0 / (d ** sharp + 1e-5), n) for d, n in scored]
    total = sum(w for w, _ in raw)
    return {n: w / total for w, n in raw}


def rigid(name):
    return lambda p, a: {name: 1.0}


def rigid_chain(centre):
    weights = chain_weights(Vector(centre))
    return lambda p, a: weights


def strip(controls, width, thick, mirror=1, lift=0.004, steps=22, sides=6, seed=0.0):
    path = []
    for i in range(steps + 1):
        s, deg = catmull(controls, i / steps)
        angle = math.radians(deg) if mirror > 0 else math.pi - math.radians(deg)
        p = torso_point(s, angle, lift)
        path.append((p, (torso_point(s, angle, lift + 0.05) - p).normalized(), i / steps))
    rings, attrs = [], []
    for i, (p, n, u) in enumerate(path):
        t = (path[min(steps, i + 1)][0] - path[max(0, i - 1)][0]).normalized()
        side = t.cross(n).normalized()
        up = side.cross(t).normalized()
        end = smooth(u / 0.12) * smooth((1 - u) / 0.12)
        w = width * (0.4 + 0.6 * end) * (1.0 + 0.2 * wobble(p, 3.0, seed))
        h = thick * (0.5 + 0.5 * end)
        centre = p + up * h * 0.6
        ring, ring_attrs = [], []
        for j in range(sides):
            a = j / sides * math.tau
            ring.append(centre + side * (w * math.cos(a)) + up * (h * math.sin(a)))
            ring_attrs.append(((side * math.cos(a) + up * math.sin(a)).normalized(), u, j))
        rings.append(ring)
        attrs.append(ring_attrs)
    return loft(rings, attrs)


def grain(seed, light, dark, bleach=None, lichen=0.0):
    bleach = bleach or TONE['drift']

    def colour(p, a):
        out, u, j = a
        streak = 0.5 + 0.5 * math.sin(j * 2.3 + seed + 2.2 * wobble(p, 2.5, seed))
        base = mix(dark, light, 0.2 + 0.55 * streak + 0.2 * wobble(p, 1.2, seed + 3))
        base = mix(base, bleach, 0.35 * max(0.0, out.z) ** 2)
        base = shade(base, 0.7 + 0.3 * smooth(min(u, 1 - u) / 0.06))
        if lichen and wobble(p, 5.5, seed + 9) > 0.42 - lichen and out.z > 0.1:
            base = mix(base, TONE['lichen'] if wobble(p, 11.0, seed) > 0 else TONE['lichenGold'], 0.75)
        return base
    return colour


def stone_colour(seed):
    def colour(p, a):
        out = a[0]
        base = mix(TONE['stoneDark'], TONE['stone'], 0.55 + 0.45 * wobble(p, 4.0, seed))
        patch = wobble(p, 7.0, seed + 2.0)
        if patch > 0.16 and out.z > -0.3:
            base = mix(base, TONE['lichen'] if patch < 0.4 else TONE['lichenGold'], 0.85)
        if out.z > 0.6 and wobble(p, 3.0, seed + 5) > 0.05:
            base = mix(base, TONE['moss'], 0.75)
        return base
    return colour


def moss_colour(seed):
    def colour(p, a):
        return mix(TONE['mossDark'], TONE['mossLight'], 0.4 + 0.5 * wobble(p, 6.0, seed) + 0.3 * a[0].z)
    return colour


def stone_surface(centre, radii, rotation, seed, x, y, rough=0.18):
    z = math.sqrt(max(0.0, 1.0 - x * x - y * y))
    n = Vector((x, y, z)).normalized()
    bump = 1.0 + rough * wobble(n, 2.3, seed)
    return Vector(centre) + rotation @ (Vector((n.x * radii[0], n.y * radii[1], n.z * radii[2])) * bump), rotation @ n


def spiral(centre, radii, rotation, seed, turns=2.3, reach=0.72, rough=0.18):
    steps = int(turns * 22)
    points = []
    for i in range(steps + 1):
        u = i / steps
        angle = u * turns * math.tau + seed
        r = 0.06 + (reach - 0.06) * u
        p, n = stone_surface(centre, radii, rotation, seed, r * math.cos(angle), r * math.sin(angle), rough)
        points.append(p - n * 0.002)
    return tube(points, [0.012 + 0.006 * (i / steps) for i in range(steps + 1)], 5)


def strands(at, count, length, seed, spread=0.05, drift=(0.0, 0.0), radius=0.011):
    pieces = []
    for k in range(count):
        jitter = Vector((wobble(Vector((k, seed, 0)), 1.7, 1.0), wobble(Vector((seed, k, 1)), 1.7, 2.0), 0.0)) * spread
        size = length * (0.6 + 0.5 * (0.5 + 0.5 * wobble(Vector((k * 1.3, seed, 2)), 1.0, 3.0)))
        start = Vector(at) + jitter
        path = [start + Vector((drift[0] * i * size / 5 + 0.012 * math.sin(i * 1.4 + k), drift[1] * i * size / 5 + 0.012 * math.cos(i * 1.2 + k), -size * i / 5)) for i in range(6)]
        pieces.append(tube(path, [radius, radius * 0.9, radius * 0.75, radius * 0.6, radius * 0.4, radius * 0.15], 4))
    return pieces


def strand_colour(p, a):
    return mix(TONE['sage'], TONE['mossLight'], 0.15 + 0.35 * a[1] + 0.2 * wobble(p, 9.0, 4.0))


def flower(model, at, weight, size, seed):
    for petal in range(5):
        angle = petal / 5 * math.tau + seed
        direction = Vector((math.cos(angle), math.sin(angle), 0.25))
        model.add(blob(at + direction * size * 0.55, (size * 0.55, size * 0.3, size * 0.08), 0, facing(Vector((-direction.x * 0.3, -direction.y * 0.3, 1)).normalized(), direction), 0.0, 0.0), lambda p, a: TONE['petal'], weight)
    model.add(blob(at + Vector((0, 0, size * 0.12)), (size * 0.22, size * 0.22, size * 0.16), 0, None, 0.0, 0.0), lambda p, a: TONE['pollen'], weight)


LEGS = {
    'F': (['scap', 'arm', 'fore', 'cannonF'], [(0.17, 0.14), (0.11, 0.088), (0.074, 0.064)], 0.2),
    'H': (['thigh', 'shin', 'cannonH'], [(0.2, 0.14), (0.112, 0.086), (0.072, 0.064)], 0.24),
}


def leg(model, side, kind):
    bones, radii, extend = LEGS[kind]
    bones = [f'{name}.{side}' for name in bones]
    segments = bones[1:]
    first = (BONE[segments[0]][1] - BONE[segments[0]][0]).normalized()
    centre, profile = [BONE[segments[0]][0] - first * extend], [radii[0][0] * 0.95]
    for k, bone in enumerate(segments):
        head, tail, _ = BONE[bone]
        for i in range(1, 9):
            u = i / 8
            centre.append(head.lerp(tail, u))
            knot = 0.09 * math.exp(-((u - 1.0) / 0.12) ** 2) if k < len(segments) - 1 else 0.0
            profile.append((radii[k][0] + (radii[k][1] - radii[k][0]) * u) * (1.0 + knot))
    seed = 3.0 if side == 'L' else 7.0
    weight = lambda p, a: chain_weights(p, bones, 6.0)
    model.add(tube(centre, [r * 0.82 for r in profile], 10, 0.06, seed + (1 if kind == 'H' else 0)), grain(seed, TONE['wood'], TONE['heartwood']), weight)
    frames = frames_along(centre)
    total = len(frames) - 1
    for strand in range(3):
        path, widths = [], []
        for i, (p, t, normal, binormal) in enumerate(frames):
            u = i / total
            angle = strand / 3 * math.tau + u * math.tau * (1.1 if side == 'L' else -1.1) + (0.4 if kind == 'H' else 0.0)
            close = 1.0 - 0.55 * smooth((u - 0.86) / 0.14)
            path.append(p + (normal * math.cos(angle) + binormal * math.sin(angle)) * profile[i] * 0.62 * close)
            widths.append(profile[i] * (0.42 - 0.1 * smooth((u - 0.8) / 0.2)))
        model.add(tube(path, widths, 6, 0.08, seed + strand * 5), grain(seed + strand * 2.1, TONE['barkLight'], TONE['bark'], lichen=0.05 if strand == 0 else 0.0), weight)
    for hoof in ((f'hoofF.{side}',) if kind == 'F' else (f'hoofH.{side}',)):
        head, tail, _ = BONE[hoof]
        ahead = Vector((0, tail.y - head.y, 0)).normalized()
        for toe in (-1, 1):
            at = Vector((head.x + toe * 0.05, (head.y + tail.y) / 2 + ahead.y * 0.02, 0.08))
            model.add(blob(at, (0.055, 0.11, 0.09), 1, facing(Vector((0, 0, 1)), ahead), 0.12, toe + seed, flat_bottom=0.88), lambda p, a: mix(TONE['hoof'], TONE['stoneDark'], 0.3 + 0.3 * a[0].z), rigid(hoof), 0, False)
        for k in range(4):
            angle = k / 4 * math.tau + 0.4
            at = head + Vector((math.cos(angle) * 0.07, math.sin(angle) * 0.07 - ahead.y * 0.02, 0.05 + 0.02 * (k % 2)))
            model.add(blob(at, (0.065, 0.065, 0.05), 1, None, 0.3, k * 3 + seed), moss_colour(k + 40), lambda p, a, c=bones[-1]: {c: 1.0})


def build_model():
    model = Model()
    s_steps, sides = 72, 32
    rings, attrs = [], []
    for i in range(s_steps + 1):
        s = i / s_steps
        ring, ring_attrs = [], []
        for j in range(sides):
            angle = j / sides * math.tau
            p = torso_point(s, angle)
            out = (p - torso_frame(s)[0]).normalized()
            ring.append(p + out * 0.01 * wobble(p, 9.0, 3.0))
            ring_attrs.append((out, s, angle))
        rings.append(ring)
        attrs.append(ring_attrs)

    def in_heart(s, angle):
        return 0.47 < s < 0.705 and math.sin(angle) < 0.2

    def core_colour(p, a):
        out, s, angle = a
        if in_heart(s, angle):
            return mix(TONE['amber'], srgb('#ffe6a8'), 0.35 + 0.45 * wobble(p, 6.0))
        return mix(TONE['heartwood'], TONE['wood'], 0.15 + 0.3 * (0.5 + 0.5 * math.sin(angle * 7.0 + 5.0 * wobble(p, 2.5, 1.0))))

    def core_material(face, verts, attrs):
        return 1 if all(in_heart(attrs[i][1], attrs[i][2]) for i in face) else 0

    model.add(loft(rings, attrs), core_colour, lambda p, a: chain_weights(p), core_material)

    body = lambda p, a: chain_weights(p)
    for side, sign in (('L', 1), ('R', -1)):
        for k, s in enumerate((0.49, 0.517, 0.544, 0.571, 0.598)):
            model.add(strip([(s + 0.006, 22), (s, -30), (s - 0.004, -88)], 0.032, 0.038, sign, 0.02, 16, 6, 4 + k), grain(k + sign, TONE['rib'], TONE['ribDark']), rigid(f'rib.{side}'))
        flow = [
            ([(0.03, 74), (0.2, 78), (0.4, 76), (0.58, 72), (0.72, 68), (0.86, 72), (0.97, 76)], 0.07, 0.034),
            ([(0.07, 50), (0.25, 58), (0.44, 56), (0.6, 46), (0.74, 42), (0.9, 48)], 0.075, 0.036),
            ([(0.3, 62), (0.17, 64), (0.07, 40), (0.035, 2), (0.07, -32)], 0.08, 0.04),
            ([(0.27, 44), (0.17, 46), (0.105, 24), (0.085, -8), (0.115, -38)], 0.075, 0.04),
            ([(0.24, 26), (0.18, 26), (0.145, 8), (0.15, -22)], 0.06, 0.035),
            ([(0.445, 62), (0.405, 22), (0.36, -18), (0.31, -58)], 0.075, 0.038),
            ([(0.39, 64), (0.345, 24), (0.3, -16), (0.255, -52)], 0.075, 0.038),
            ([(0.335, 60), (0.29, 26), (0.245, -10), (0.215, -42)], 0.065, 0.034),
            ([(0.5, 80), (0.55, 52), (0.6, 30), (0.64, 24), (0.675, 30)], 0.075, 0.04),
            ([(0.465, 68), (0.515, 44), (0.555, 30), (0.585, 26)], 0.07, 0.036),
            ([(0.535, 82), (0.505, 50), (0.475, 30), (0.46, 20)], 0.065, 0.036),
            ([(0.1, -55), (0.24, -78), (0.38, -84), (0.45, -80)], 0.07, 0.034),
            ([(0.66, 26), (0.75, 8), (0.85, -10), (0.95, -18)], 0.06, 0.032),
            ([(0.475, 56), (0.435, 20), (0.395, -20), (0.36, -58), (0.345, -80)], 0.07, 0.036, 0.03),
            ([(0.28, 60), (0.24, 28), (0.205, -8), (0.185, -36)], 0.065, 0.034, 0.03),
            ([(0.365, 40), (0.315, 8), (0.265, -30), (0.235, -62)], 0.065, 0.034, 0.03),
            ([(0.12, -28), (0.24, -40), (0.34, -46), (0.46, -44)], 0.07, 0.034),
            ([(0.16, -4), (0.27, -12), (0.4, -10), (0.47, -4)], 0.06, 0.032),
            ([(0.06, -50), (0.18, -66), (0.3, -70), (0.44, -66)], 0.065, 0.032),
            ([(0.015, -24), (0.035, 18), (0.06, 52), (0.1, 74)], 0.065, 0.034, 0.025),
            ([(0.67, -62), (0.77, -76), (0.87, -84), (0.96, -86)], 0.06, 0.032),
            ([(0.675, -34), (0.78, -56), (0.89, -70), (0.975, -74)], 0.055, 0.03, 0.02),
            ([(0.7, 70), (0.82, 62), (0.93, 58)], 0.05, 0.028, 0.02),
            ([(0.68, -4), (0.77, -32), (0.87, -50), (0.95, -60)], 0.055, 0.03),
            ([(0.69, 52), (0.8, 40), (0.91, 30), (0.985, 36)], 0.06, 0.032),
        ]
        for k, (controls, width, thick, *lift) in enumerate(flow):
            tone = (TONE['woodLight'], TONE['bark']) if k % 3 else (TONE['drift'], TONE['barkLight'])
            model.add(strip(controls, width, thick, sign, lift[0] if lift else 0.004, seed=k * 3.7 + sign), grain(k * 1.9 + sign, *tone, lichen=0.12 if k in (0, 1, 2, 8) else 0.0), body)
            if k in (2, 5, 8, 11, 13):
                s, deg = controls[-1]
                angle = math.radians(deg) if sign > 0 else math.pi - math.radians(deg)
                at = torso_point(s, angle, 0.04)
                model.add(blob(at, (0.07, 0.08, 0.04), 1, facing((at - torso_frame(s)[0]).normalized()), 0.3, k + sign), moss_colour(k), rigid_chain(at))
    for k, s in enumerate((0.632, 0.66, 0.688)):
        model.add(strip([(s + 0.004, 24), (s, -40), (s - 0.006, -90), (s, -140), (s + 0.004, 156)], 0.034, 0.04, 1, 0.02, 28, 6, 12 + k), grain(k * 4.0, TONE['rib'], TONE['ribDark']), rigid('chest'))

    spirals = []
    for side, sign in (('L', 1), ('R', -1)):
        for (s, deg, radii, bone, seed, carved) in [
            (0.21, 34, (0.36, 0.3, 0.11), 'hips', 1.0, True),
            (0.125, 56, (0.17, 0.15, 0.07), 'hips', 2.0, False),
            (0.545, 44, (0.3, 0.25, 0.1), 'chest', 3.0, True),
            (0.43, 66, (0.16, 0.13, 0.06), 'chest', 4.0, False),
        ]:
            angle = math.radians(deg) if sign > 0 else math.pi - math.radians(deg)
            normal = (torso_point(s, angle, 0.1) - torso_point(s, angle, 0.0)).normalized()
            rotation = facing(normal)
            at = torso_point(s, angle, 0.045 + radii[2] * 0.35)
            model.add(blob(at, radii, 2, rotation, 0.18, seed + sign, flat_bottom=0.35), stone_colour(seed + sign), rigid(bone), 0, False)
            if carved:
                spirals.append((spiral(at, radii, rotation, seed + sign), bone))
            moss_at = stone_surface(at, radii, rotation, seed + sign, 0.45 * sign, -0.5)[0]
            model.add(blob(moss_at, (radii[0] * 0.38, radii[1] * 0.32, radii[2] * 0.5), 1, rotation, 0.3, seed + 7), moss_colour(seed), rigid(bone))
            flower(model, moss_at + normal * radii[2] * 0.4, rigid(bone), 0.085, seed * 3 + sign)
    for k, s in enumerate((0.13, 0.2, 0.28, 0.36, 0.44, 0.52)):
        at = torso_point(s, math.pi / 2, 0.06)
        model.add(blob(at, (0.12, 0.15, 0.07), 1, facing(Vector((0, 0, 1)), Vector((0, 1, 0))), 0.25, 20 + k, flat_bottom=0.3), stone_colour(20 + k), rigid_chain(at), 0, False)

    for k in range(70):
        s = 0.04 + k / 70 * 0.95
        neck = s > 0.62
        if not neck and k % 2:
            continue
        angle = math.pi / 2 + 0.2 * wobble(Vector((s * 10, 0, 0)), 3.0, 5.0)
        at = torso_point(s, angle, 0.06 if neck else 0.09)
        size = (0.14 if neck else 0.1) * (0.8 + 0.4 * (0.5 + 0.5 * wobble(Vector((k, 1, 0)), 1.3, 2.0)))
        out = (at - torso_frame(s)[0]).normalized()
        model.add(blob(at, (size, size * 1.25, size * 0.6), 1, facing(out, Vector((0, 1, 0))), 0.3, k), moss_colour(k), rigid_chain(at))
        if neck and k % 2 == 0:
            for side in (-1, 1):
                at2 = torso_point(s, math.pi / 2 + side * 0.7, 0.04)
                model.add(blob(at2, (0.1, 0.12, 0.05), 1, facing((at2 - torso_frame(s)[0]).normalized()), 0.3, k + side), moss_colour(k + 3), rigid_chain(at2))
                if k % 6 == 0:
                    for piece in strands(at2 + Vector((side * 0.05, 0, -0.02)), 3, 0.24, k + side, 0.03, (side * 0.15, 0.1)):
                        model.add(piece, strand_colour, rigid_chain(at2))
        if k % 7 == 3:
            flower(model, at + out * size * 0.5, rigid_chain(at), 0.08, k * 1.7)
    for k in range(4):
        s = 0.7 + k * 0.055
        at = torso_point(s, -math.pi / 2, 0.02)
        for piece in strands(at, 5, 0.36 - k * 0.04, 90 + k, 0.08, (0.0, 0.25)):
            model.add(piece, strand_colour, rigid_chain(at))

    for side in ('L', 'R'):
        leg(model, side, 'F')
        leg(model, side, 'H')

    head0, head1, _ = BONE['head']
    axis = (head1 - head0).normalized()
    head_side = Vector((1, 0, 0))
    head_up = axis.cross(head_side).normalized()
    if head_up.z < 0:
        head_up = -head_up
    stations = [(-0.16, 0.05, 0.05, 0.0), (-0.13, 0.16, 0.17, 0.0), (-0.06, 0.21, 0.21, 0.0), (0.04, 0.225, 0.215, 0.0), (0.14, 0.22, 0.2, -0.01),
                (0.23, 0.19, 0.175, -0.02), (0.31, 0.15, 0.15, -0.03), (0.4, 0.118, 0.128, -0.04), (0.49, 0.1, 0.115, -0.05), (0.57, 0.092, 0.105, -0.055),
                (0.63, 0.088, 0.096, -0.06), (0.67, 0.07, 0.07, -0.062), (0.69, 0.03, 0.03, -0.064)]
    rings, attrs = [], []
    for f, rx, rz, drop in stations:
        centre = head0 + axis * f + head_up * drop
        ring, ring_attrs = [], []
        for j in range(28):
            angle = j / 28 * math.tau
            top = math.sin(angle)
            flat = 0.9 if top > 0.3 else 1.0
            out = head_side * math.cos(angle) + head_up * top
            ring.append(centre + head_side * (rx * math.cos(angle)) + head_up * (rz * flat * top))
            ring_attrs.append((out, f, angle))
        rings.append(ring)
        attrs.append(ring_attrs)
    eye_f = 0.19

    def face_colour(p, a):
        out, f, angle = a
        top, side = math.sin(angle), abs(math.cos(angle))
        if f > 0.64 and top < 0.55:
            return mix(TONE['hoof'], TONE['stoneDark'], 0.3)
        mask = smooth((top + 0.05) * 2.2) * (1.0 - smooth((side - 0.82) * 5))
        base = mix(TONE['faceDark'], TONE['face'], mask)
        base = shade(base, 0.88 + 0.12 * (0.5 + 0.5 * math.sin(angle * 9 + f * 6 + 2.0 * wobble(p, 4.0, 8.0))))
        around = math.hypot((f - eye_f) / 0.09, (top - 0.18) / 0.3)
        if side > 0.7 and around < 1.0:
            base = mix(base, TONE['bark'], 0.75 * (1 - around))
        tear = abs(top - (0.1 - (f - eye_f) * 1.6))
        if side > 0.75 and eye_f < f < eye_f + 0.16 and tear < 0.06:
            base = mix(base, TONE['heartwood'], 0.7 * (1 - tear / 0.06))
        return base

    model.add(loft(rings, attrs), face_colour, rigid('head'))
    for k, (controls, width) in enumerate([
        ([(-0.1, 0.0, 0.2), (0.15, 0.0, 0.215), (0.4, 0.0, 0.15), (0.62, 0.0, 0.12)], 0.05),
        ([(-0.05, 0.12, 0.19), (0.2, 0.11, 0.17), (0.42, 0.075, 0.12)], 0.035),
        ([(-0.05, -0.12, 0.19), (0.2, -0.11, 0.17), (0.42, -0.075, 0.12)], 0.035),
    ]):
        path = [head0 + axis * f + head_side * x + head_up * z for f, x, z in controls]
        path = [Vector(catmull([tuple(p) for p in path], i / 12)) for i in range(13)]
        model.add(tube(path, [width * (0.5 + 0.5 * smooth(min(i, 12 - i) / 3)) for i in range(13)], 6, 0.1, 30 + k), grain(30 + k, TONE['drift'], TONE['face']), rigid('head'))
    jaw0, jaw1, _ = BONE['jaw']
    path = [jaw0.lerp(jaw1, i / 6) - head_up * 0.025 for i in range(7)]
    model.add(tube(path, [0.075, 0.095, 0.09, 0.08, 0.07, 0.055, 0.025], 12, 0.05, 2.0), lambda p, a: mix(TONE['faceDark'], TONE['mouth'], 0.2 + 0.3 * max(0.0, a[0].z)), rigid('jaw'))

    for sign in (1, -1):
        eye_at = head0 + axis * eye_f + head_side * (sign * 0.185) + head_up * 0.055
        outward = (head_side * sign + axis * 0.35 + head_up * 0.1).normalized()
        model.add(blob(eye_at, (0.08, 0.045, 0.05), 2, facing(outward, axis), 0.0, 0.0), lambda p, a: mix(TONE['amber'], TONE['eye'], 0.4 + 0.6 * max(0.0, a[0].dot(outward))), rigid('head'), 2)
        lid_turn = Matrix.Rotation(sign * 0.3, 3, outward)
        lid = eye_at + head_up * 0.038 + outward * 0.022 - axis * 0.004
        model.add(blob(lid, (0.088, 0.04, 0.022), 1, lid_turn @ facing((head_up + outward * 0.6).normalized(), axis), 0.1, 3.0 + sign), lambda p, a: TONE['faceDark'], rigid('head'))
        brow = eye_at + head_up * 0.08 - axis * 0.01
        model.add(blob(brow, (0.085, 0.04, 0.035), 1, Matrix.Rotation(sign * 0.4, 3, outward) @ facing(head_up, axis), 0.2, 5.0 + sign), stone_colour(5.0 + sign), rigid('head'), 0, False)
        ear0, ear1, _ = BONE['ear.L' if sign > 0 else 'ear.R']
        ear_dir = (ear1 - ear0).normalized()
        ear_rot = facing(Vector((sign * 0.35, -1.0, 0.25)).normalized(), ear_dir)
        bone = 'ear.L' if sign > 0 else 'ear.R'
        model.add(blob(ear0.lerp(ear1, 0.55), (0.2, 0.09, 0.025), 1, ear_rot, 0.1, 9.0 + sign), lambda p, a: mix(TONE['bark'], TONE['barkLight'], 0.5 + 0.5 * wobble(p, 8.0)), rigid(bone))
        model.add(blob(ear0.lerp(ear1, 0.56) + ear_rot @ Vector((0, 0, 0.012)), (0.16, 0.065, 0.014), 1, ear_rot, 0.1, 11.0 + sign), lambda p, a: TONE['mossLight'], rigid(bone))
    plate_rot = facing(head_up, axis)
    plate_at = head0 + axis * 0.0 + head_up * 0.205
    plate = (0.15, 0.13, 0.05)
    model.add(blob(plate_at, plate, 2, plate_rot, 0.15, 33.0, flat_bottom=0.3), stone_colour(33.0), rigid('head'), 0, False)
    spirals.append((spiral(plate_at, plate, plate_rot, 33.0, 2.0, 0.7, 0.15), 'head'))
    for piece, bone in spirals:
        model.add(piece, lambda p, a: mix(TONE['amber'], srgb('#fff0c0'), 0.3), rigid(bone), 1)

    def drift_colour(seed):
        def colour(p, a):
            out, u, v = a
            streak = 0.5 + 0.5 * math.sin(v * math.tau * 3 + u * 9.0 + 4.0 * wobble(p, 2.0, seed))
            return shade(mix(TONE['driftDark'], TONE['drift'], 0.45 + 0.55 * streak), 0.92 + 0.08 * out.z)
        return colour

    def jag(points, amount, seed):
        out = []
        for i, p in enumerate(points):
            p = Vector(p)
            if 0 < i < len(points) - 1:
                p = p + Vector((wobble(p, 3.0, seed), wobble(p, 3.0, seed + 1), wobble(p, 3.0, seed + 2))) * amount
            out.append(p)
        return out

    def bend(points, steps=3):
        dense = []
        for i in range(len(points) - 1):
            for k in range(steps):
                dense.append(Vector(catmull([tuple(p) for p in points], (i + k / steps) / (len(points) - 1))))
        dense.append(Vector(points[-1]))
        return dense

    moss_spots = []
    for sign in (1, -1):
        def m(x, y, z):
            return Vector((x * sign, y, z))
        beam = jag([m(0.1, -1.5, 3.12), m(0.3, -1.44, 3.42), m(0.55, -1.33, 3.78), m(0.75, -1.2, 4.12), m(0.88, -1.1, 4.42), m(0.92, -1.04, 4.6)], 0.035, sign * 3)
        tines = [
            ([m(0.22, -1.47, 3.3), m(0.33, -1.72, 3.42), m(0.4, -1.92, 3.62), m(0.42, -2.0, 3.8)], 0.042),
            ([m(0.47, -1.37, 3.66), m(0.56, -1.6, 3.9), m(0.6, -1.72, 4.14), m(0.6, -1.76, 4.3)], 0.036),
            ([m(0.66, -1.27, 3.96), m(0.92, -1.36, 4.12), m(1.1, -1.42, 4.34)], 0.032),
            ([m(0.6, -1.3, 3.84), m(0.9, -1.1, 3.92), m(1.16, -0.98, 4.08), m(1.26, -0.94, 4.22)], 0.034),
            ([m(0.84, -1.13, 4.34), m(1.04, -1.0, 4.5), m(1.12, -0.96, 4.66)], 0.026),
            ([m(0.86, -1.16, 4.38), m(0.78, -1.32, 4.58), m(0.74, -1.38, 4.7)], 0.024),
        ]
        dense = bend(beam)
        model.add(tube(dense, [0.08 - 0.052 * i / (len(dense) - 1) for i in range(len(dense))], 8, 0.12, sign * 5, ridges=3), drift_colour(sign * 7), rigid('head'))
        for k, (path, base) in enumerate(tines):
            path = bend(jag(path, 0.025, sign * 11 + k))
            model.add(tube(path, [base * (1.0 - 0.75 * i / (len(path) - 1)) for i in range(len(path))], 7, 0.12, sign * 13 + k, ridges=3), drift_colour(sign * 17 + k), rigid('head'))
            moss_spots.append((path[0], 0.085))
        moss_spots += [(dense[3], 0.08), (dense[8], 0.075), (dense[12], 0.06)]
        model.add(blob(m(0.1, -1.5, 3.1), (0.12, 0.12, 0.07), 1, None, 0.3, sign * 21), drift_colour(sign * 19), rigid('head'), 0, False)
        for k, start in enumerate([tines[1][0][1], tines[3][0][1], beam[3], tines[3][0][2], tines[0][0][2]]):
            for piece in strands(Vector(start) - Vector((0, 0, 0.02)), 4, 0.3 - 0.03 * k, sign * 7 + k, 0.035, (sign * 0.05, 0.08), 0.009):
                model.add(piece, strand_colour, rigid('head'))

    for k, (at, size) in enumerate(moss_spots):
        model.add(blob(at + Vector((0, 0, size * 0.2)), (size, size * 1.2, size * 0.62), 1, None, 0.35, 50 + k), moss_colour(50 + k), rigid('head'))
        for f in range(2):
            angle = k * 2.3 + f * 2.6
            flower(model, at + Vector((math.cos(angle) * size * 0.55, math.sin(angle) * size * 0.55, size * 0.75)), rigid('head'), 0.075, k + f)

    t0, t1, _ = BONE['tail']
    tail_dir = (t1 - t0).normalized()
    for k in range(7):
        direction = (Matrix.Rotation((k - 3) * 0.3, 3, Vector((0, 0, 1))) @ tail_dir).normalized()
        model.add(blob(t0 + direction * 0.2, (0.055, 0.2, 0.02), 1, facing(Vector((0, 0.3, 1)).normalized(), direction), 0.15, 70 + k), (lambda p, a, k=k: mix(TONE['moss'], TONE['mossLight'], 0.5) if k % 2 else mix(TONE['bark'], TONE['barkLight'], 0.5)), rigid('tail'))
    return model


class StagPoser(Poser):
    def leg(self, upper, lower, cannon, hoof, target, fold, flex, bend):
        joint = self.head(upper)
        up = Vector((0, 0, 1))
        toward = (joint - target).normalized()
        lean = up.lerp(toward, 0.55).normalized()
        c, s = math.cos(fold), math.sin(fold)
        lean = Vector((lean.x, lean.y * c - lean.z * s, lean.y * s + lean.z * c)).normalized()
        knee_target = target + lean * self.length[cannon]
        l1, l2 = self.length[upper], self.length[lower]
        offset = knee_target - joint
        reach = offset.length
        if target.z < 0.22 and reach - (l1 + l2) > self.miss[0]:
            self.miss = (reach - (l1 + l2), upper, self.time)
        reach = max(abs(l1 - l2) + 1e-3, min(l1 + l2 - 1e-4, reach))
        along = offset.normalized()
        hint = Vector((0, bend, 0))
        across = (hint - along * hint.dot(along))
        across = across.normalized() if across.length > 1e-6 else Vector((0, 0, -1))
        angle = math.acos(max(-1.0, min(1.0, (l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach))))
        first = along * math.cos(angle) + across * math.sin(angle)
        self.aim(upper, first)
        middle = joint + first * l1
        self.aim(lower, knee_target - middle)
        self.aim(cannon, target - self.head(cannon))
        rest = (BONE[hoof][1] - BONE[hoof][0]).normalized()
        c, s = math.cos(flex), math.sin(flex)
        self.aim(hoof, Vector((rest.x, rest.y * c - rest.z * s, rest.y * s + rest.z * c)))

    def place(self, key, entry, anchor):
        target, fold, flex, carry, local = entry
        if carry:
            moved = self.pose[anchor] @ self.rest[anchor].inverted()
            target = target.lerp(moved @ (HOME[key] + local), carry)
        return target, fold, flex

    def evaluate(self, p):
        self.pose, self.basis = {}, {}
        self.turn('root')
        self.turn('hips', p['hips'], p['lift'])
        self.turn('tail', p['tail'])
        self.turn('spine', p['spine'])
        self.turn('chest', p['chest'])
        self.turn('rib.L', (0, -p['ribs'], p['ribs'] * 0.25))
        self.turn('rib.R', (0, p['ribs'], -p['ribs'] * 0.25))
        self.turn('neck1', p['neck1'])
        self.turn('neck2', p['neck2'])
        self.turn('head', p['head'])
        self.turn('jaw', (p['jaw'], 0, 0))
        ex, ey, ez = p['ears']
        self.turn('ear.L', (ex, ey, ez))
        self.turn('ear.R', (ex, -ey, -ez))
        for side in ('L', 'R'):
            front, hind = self.place('F' + side, p['F' + side], 'chest'), self.place('H' + side, p['H' + side], 'hips')
            home = Vector(BONE[f'cannonF.{side}'][1])
            self.turn(f'scap.{side}', (max(-0.45, min(0.45, 0.42 * (front[0].y - home.y))) + p['scap'], 0, 0))
            self.leg(f'arm.{side}', f'fore.{side}', f'cannonF.{side}', f'hoofF.{side}', front[0], front[1], front[2], 1.0)
            self.leg(f'thigh.{side}', f'shin.{side}', f'cannonH.{side}', f'hoofH.{side}', hind[0], hind[1], hind[2], -1.0)
        return self.basis


HOME = {key: Vector(BONE[bone][1]) for key, bone in (('FL', 'cannonF.L'), ('FR', 'cannonF.R'), ('HL', 'cannonH.L'), ('HR', 'cannonH.R'))}


def neutral():
    return {
        'hips': (0, 0, 0), 'lift': (0, 0, 0), 'tail': (0, 0, 0), 'spine': (0, 0, 0), 'chest': (0, 0, 0), 'ribs': 0.0,
        'neck1': (0, 0, 0), 'neck2': (0, 0, 0), 'head': (0, 0, 0), 'jaw': 0.0, 'ears': (0, 0.12, 0), 'scap': 0.0,
        **{key: (HOME[key].copy(), 0.0, 0.0, 0.0, Vector()) for key in HOME},
    }


def feet(p, offsets):
    for key, offset in offsets.items():
        dx, dy, dz, fold, flex = offset[:5]
        local = Vector((dx * (1 if key[1] == 'L' else -1), dy, dz))
        p[key] = (HOME[key] + local, fold, flex, offset[5] if len(offset) > 5 else 0.0, local)


def gait(name, t, offsets, lift, fold_front, fold_hind, flex):
    g = GAITS[name]
    cycle, stance = g['cycle'], g['stance']
    sweep = g['speed'] * cycle * stance
    phase = (t / cycle) % 1.0
    out = {}
    for key, offset in offsets.items():
        ph = (phase + offset) % 1.0
        front = key[0] == 'F'
        if ph < stance:
            u = ph / stance
            dy, dz, fold, fl = -sweep / 2 + sweep * u, 0.0, 0.0, -0.35 * smooth((u - 0.75) / 0.25)
        else:
            u = (ph - stance) / (1.0 - stance)
            arc = math.sin(math.pi * u)
            dy = sweep / 2 - sweep * smooth(u)
            dz = lift * arc
            fold = (fold_front if front else -fold_hind) * arc
            fl = flex * arc
        out[key] = (0.0, dy, dz, fold, fl)
    return phase, out


def clip_idle(t):
    p = neutral()
    w = math.tau * t / 4.0
    p['lift'] = (0, 0, 0.012 * math.sin(w * 2))
    p['ribs'] = 0.025 * (0.5 + 0.5 * math.sin(w * 2))
    p['chest'] = (0.012 * math.sin(w * 2), 0, 0)
    p['neck1'] = (0.03 * math.sin(w), 0, 0.06 * math.sin(w))
    p['head'] = (0.04 * math.sin(w + 1.0), 0.04 * math.sin(w), 0.14 * math.sin(w + 0.4))
    flick = math.exp(-((t - 1.3) / 0.07) ** 2) + math.exp(-((t - 3.1) / 0.06) ** 2) * 0.6
    p['ears'] = (0.0, 0.12 - 0.25 * flick, 0.15 * flick)
    p['tail'] = (0.1 * math.sin(w * 2), 0, 0.18 * math.sin(w))
    return p


def clip_gait(name, offsets, body):
    def clip(t):
        p = neutral()
        phase, f = gait(name, t, offsets, *body['legs'])
        feet(p, f)
        body['pose'](p, phase)
        return p
    return clip


def walk_body(p, phase):
    w = math.tau * phase
    p['lift'] = (0, 0, -0.035 + 0.03 * math.cos(2 * w))
    p['hips'] = (0.015 * math.sin(2 * w), 0.025 * math.sin(w), 0.03 * math.sin(w))
    p['neck1'] = (0.06 + 0.04 * math.sin(2 * w + 0.6), 0, 0.03 * math.sin(w))
    p['head'] = (0.04 * math.sin(2 * w + 1.2), 0, -0.02 * math.sin(w))
    p['tail'] = (0.05, 0, 0.14 * math.sin(w))
    p['ears'] = (0.0, 0.18, 0.05)


def trot_body(p, phase):
    w = math.tau * phase
    p['lift'] = (0, 0, -0.085 + 0.03 * math.cos(2 * w))
    p['hips'] = (0.02 * math.sin(2 * w), 0.03 * math.sin(w), 0.0)
    p['neck1'] = (-0.04 + 0.05 * math.sin(2 * w + 0.8), 0, 0)
    p['head'] = (0.08, 0, 0)
    p['tail'] = (-0.15, 0, 0.1 * math.sin(w))
    p['ears'] = (0.0, 0.05, 0.15)


def gallop_body(p, phase):
    w = math.tau * phase
    p['lift'] = (0, 0.05 * math.sin(w), -0.09 + 0.12 * math.sin(w + 0.9))
    p['hips'] = (0.13 * math.sin(w + 0.4), 0, 0)
    p['spine'] = (-0.06 * math.sin(w + 1.4), 0, 0)
    p['chest'] = (0.05 * math.sin(w + 1.6), 0, 0)
    p['neck1'] = (0.45 + 0.06 * math.sin(w + 2.0), 0, 0)
    p['neck2'] = (0.2, 0, 0)
    p['head'] = (0.42 + 0.05 * math.sin(w + 2.4), 0, 0)
    p['tail'] = (-0.35, 0, 0.06 * math.sin(w))
    p['ears'] = (0.0, -0.1, 0.55)


WALK_FEET = {'HL': 0.0, 'FL': 0.75, 'HR': 0.5, 'FR': 0.25}
TROT_FEET = {'FL': 0.0, 'HR': 0.0, 'FR': 0.5, 'HL': 0.5}
GALLOP_FEET = {'HL': 0.0, 'HR': 0.1, 'FL': 0.42, 'FR': 0.52}


def attack_clip(name, keys, foot_keys):
    def clip(t):
        p = neutral()
        for channel, ks in keys.items():
            p[channel] = track(t, ks)
        offsets = {key: track(t, [(time, tuple(v) + (0.0,) * (6 - len(v))) for time, v in ks]) for key, ks in foot_keys.items()}
        feet(p, {key: offsets.get(key, Z5) for key in HOME})
        return p
    return clip


Z3 = (0, 0, 0)
Z5 = (0, 0, 0, 0, 0)


def sweep_clip():
    a = ATTACKS['sweep']
    T, A, R = a['telegraph'], a['active'], a['recover']
    E = T + A + R
    keys = {
        'lift': [(0, Z3), (0.3, (0.0, 0.08, -0.06)), (T - 0.08, (0.04, 0.14, -0.13)), (T, (0.05, 0.15, -0.14)), (T + A * 0.5, (0.0, -0.02, -0.08)), (T + A, (-0.06, -0.08, -0.06)), (T + A + 0.45, (0, 0, -0.02)), (E, Z3)],
        'hips': [(0, Z3), (T, (0.05, 0.06, -0.18)), (T + A, (0.02, -0.06, 0.22)), (T + A + 0.5, (0, 0, 0.04)), (E, Z3)],
        'chest': [(0, Z3), (T, (0.04, 0.05, -0.22)), (T + A * 0.5, (0.04, 0, 0)), (T + A, (0.02, -0.06, 0.28)), (T + A + 0.5, (0, 0, 0.05)), (E, Z3)],
        'neck1': [(0, Z3), (0.35, (0.18, 0.05, -0.3)), (T, (0.3, 0.12, -0.55)), (T + A * 0.4, (0.32, 0.0, 0.0)), (T + A, (0.25, -0.15, 0.6)), (T + A + 0.5, (0.08, 0, 0.12)), (E, Z3)],
        'neck2': [(0, Z3), (T, (0.18, 0.08, -0.25)), (T + A, (0.15, -0.08, 0.3)), (E, Z3)],
        'head': [(0, Z3), (0.35, (0.2, 0.15, -0.2)), (T - 0.1, (0.42, 0.42, -0.42)), (T, (0.45, 0.45, -0.45)), (T + A * 0.5, (0.45, 0.0, 0.0)), (T + A, (0.35, -0.5, 0.45)), (T + A + 0.55, (0.08, 0, 0.05)), (E, Z3)],
        'ears': [(0, (0, 0.12, 0)), (T, (0, -0.05, 0.6)), (T + A + 0.6, (0, 0.12, 0.1)), (E, (0, 0.12, 0))],
        'tail': [(0, Z3), (T, (-0.3, 0, -0.3)), (T + A, (-0.2, 0, 0.35)), (E, Z3)],
        'jaw': [(0, 0.0), (T + A * 0.4, 0.12), (T + A + 0.4, 0.0), (E, 0.0)],
    }
    foot_keys = {
        'FR': [(0, Z5), (0.25, (0.05, -0.05, 0.14, 0.6, 0.6)), (0.45, (0.16, -0.12, 0.0, 0, 0)), (T + A, (0.16, -0.12, 0, 0, 0)), (T + A + 0.35, (0.08, -0.06, 0.12, 0.6, 0.5)), (T + A + 0.6, Z5), (E, Z5)],
        'FL': [(0, Z5), (T + A * 0.6, Z5), (T + A + 0.12, (0.1, -0.1, 0.16, 0.6, 0.6)), (T + A + 0.3, (0.12, -0.12, 0, 0, 0)), (T + A + 0.75, (0.04, -0.04, 0.1, 0.5, 0.4)), (E - 0.05, Z5), (E, Z5)],
    }
    return attack_clip('sweep', keys, foot_keys), E


def stomp_clip():
    a = ATTACKS['stomp']
    T, A, R = a['telegraph'], a['active'], a['recover']
    E = T + A + R
    rear = -0.5
    keys = {
        'hips': [(0, Z3), (0.16, (0.1, 0, 0)), (0.5, (rear * 0.8, 0, 0)), (T - 0.12, (rear, 0, 0)), (T - 0.04, (rear * 0.7, 0, 0)), (T, (0.12, 0, 0)), (T + 0.12, (0.08, 0, 0)), (T + A, (0.02, 0, 0)), (E, Z3)],
        'lift': [(0, Z3), (0.16, (0, 0.02, -0.12)), (0.5, (0, 0.2, -0.08)), (T - 0.12, (0, 0.24, -0.06)), (T, (0, 0.06, -0.16)), (T + 0.15, (0, 0.04, -0.12)), (T + A, (0, 0.02, -0.04)), (E, Z3)],
        'spine': [(0, Z3), (0.5, (-0.07, 0, 0)), (T - 0.1, (-0.08, 0, 0)), (T, (0.06, 0, 0)), (T + A, Z3), (E, Z3)],
        'neck1': [(0, Z3), (0.16, (0.15, 0, 0)), (0.5, (-0.35, 0, 0)), (T - 0.1, (-0.45, 0, 0)), (T, (0.45, 0, 0)), (T + 0.2, (0.35, 0, 0)), (T + A, (0.12, 0, 0)), (E, Z3)],
        'head': [(0, Z3), (0.16, (0.15, 0, 0)), (0.5, (-0.3, 0, 0.1)), (T - 0.1, (-0.4, 0, -0.08)), (T, (0.5, 0, 0)), (T + 0.25, (0.3, 0, 0)), (T + A + 0.3, (0.05, 0, 0)), (E, Z3)],
        'jaw': [(0, 0.0), (0.5, 0.25), (T - 0.1, 0.35), (T, 0.05), (E, 0.0)],
        'ears': [(0, (0, 0.12, 0)), (0.5, (0, -0.2, 0.4)), (T, (0, 0.3, 0.2)), (E, (0, 0.12, 0))],
        'tail': [(0, Z3), (0.5, (0.4, 0, 0)), (T, (-0.3, 0, 0)), (E, Z3)],
        'ribs': [(0, 0.0), (T - 0.1, 0.12), (T + 0.2, 0.0), (E, 0.0)],
    }
    foot_keys = {}
    for key, lag in (('FL', 0.0), ('FR', 0.06)):
        foot_keys[key] = [(0, Z5), (0.2 + lag, (0.0, -0.05, 0.2, 0.9, 0.5, 0.3)), (0.5 + lag, (0.02, 0.0, 0.62, 1.7, 1.0, 1.0)), (T - 0.16 + lag * 0.5, (0.02, -0.06, 0.66, 1.75, 1.0, 1.0)), (T - 0.05, (0.04, -0.26, 0.28, 0.4, 0.2, 0.3)), (T, (0.06, -0.24, 0.0, 0, 0)), (T + A, (0.06, -0.24, 0.0, 0, 0)), (T + A + 0.4, (0.03, -0.12, 0.12, 0.6, 0.4)), (T + A + 0.7, Z5), (E, Z5)]
    for key in ('HL', 'HR'):
        foot_keys[key] = [(0, Z5), (0.3, (0.03, 0.08, 0.0, 0, 0)), (T + A, (0.03, 0.08, 0, 0, 0)), (T + A + 0.6, (0.02, 0.04, 0.1, 0.4, 0.3)), (T + A + 0.9, Z5), (E, Z5)]
    return attack_clip('stomp', keys, foot_keys), E


def charge_wind_clip():
    T = ATTACKS['charge']['telegraph']
    keys = {
        'lift': [(0, Z3), (0.25, (0, 0.1, -0.1)), (T, (0, 0.16, -0.18))],
        'hips': [(0, Z3), (T * 0.5, (0.08, 0, 0)), (T, (0.12, 0, 0))],
        'neck1': [(0, Z3), (0.3, (0.4, 0, 0)), (T, (0.55, 0, 0))],
        'neck2': [(0, Z3), (T, (0.25, 0, 0))],
        'head': [(0, Z3), (0.3, (0.4, 0.05, 0)), (T * 0.7, (0.6, -0.05, 0.05)), (T, (0.62, 0, 0))],
        'ears': [(0, (0, 0.12, 0)), (0.3, (0, -0.15, 0.6))],
        'tail': [(0, Z3), (T, (-0.45, 0, 0))],
        'jaw': [(0, 0.0), (T * 0.5, 0.08), (T, 0.0)],
    }
    paw = [(0, Z5)]
    for k in range(2):
        start = 0.12 + k * 0.34
        paw += [(start, Z5), (start + 0.1, (0.0, -0.18, 0.2, 0.9, 0.6)), (start + 0.24, (0.0, 0.12, 0.0, 0.1, 0.0))]
    paw += [(T, (0, 0.04, 0, 0, 0))]
    foot_keys = {'FR': paw, 'HL': [(0, Z5), (T, (0, 0.12, 0, 0, 0))], 'HR': [(0, Z5), (T, (0, 0.12, 0, 0, 0))]}
    return attack_clip('charge-wind', keys, foot_keys), T


def skid_clip():
    R = ATTACKS['charge']['recover']
    keys = {
        'hips': [(0, (-0.08, 0, 0)), (0.35, (-0.05, 0, 0)), (R, Z3)],
        'lift': [(0, (0, 0.12, -0.12)), (0.4, (0, 0.05, -0.05)), (R, Z3)],
        'neck1': [(0, (-0.1, 0, 0)), (0.3, (0.1, 0, 0)), (R, Z3)],
        'head': [(0, (-0.2, 0, 0.0)), (0.25, (0.1, 0.2, 0.35)), (0.45, (0.1, -0.2, -0.35)), (0.65, (0.05, 0.1, 0.18)), (0.85, (0.03, -0.05, -0.06)), (R, Z3)],
        'ears': [(0, (0, -0.2, 0.5)), (R, (0, 0.12, 0))],
        'tail': [(0, (0.3, 0, 0)), (R, Z3)],
    }
    brace = [(0, (0.06, -0.22, 0, 0, -0.2)), (0.35, (0.06, -0.16, 0, 0, 0)), (0.6, (0.02, -0.12, 0.14, 0.7, 0.5)), (0.85, Z5), (R, Z5)]
    hind = [(0, (0.02, 0.18, 0, 0, 0)), (0.5, (0.02, 0.1, 0, 0, 0)), (0.75, (0.0, 0.04, 0.12, 0.5, 0.4)), (R, Z5)]
    return attack_clip('skid', keys, {'FL': brace, 'FR': [(k[0] + 0.05, k[1]) for k in brace], 'HL': hind, 'HR': [(k[0] + 0.08, k[1]) for k in hind]}), R


def roots_clip():
    a = ATTACKS['roots']
    T, A, R = a['telegraph'], a['active'], a['recover']
    E = T + A + R
    keys = {
        'hips': [(0, Z3), (0.45, (-0.26, 0, 0)), (T - 0.08, (-0.3, 0, 0)), (T, (0.16, 0, 0)), (T + 0.25, (0.1, 0, 0)), (E, Z3)],
        'lift': [(0, Z3), (0.45, (0, 0.12, 0.05)), (T, (0, 0.02, -0.14)), (T + 0.3, (0, 0, -0.08)), (E, Z3)],
        'neck1': [(0, Z3), (0.45, (-0.4, 0, 0)), (T - 0.08, (-0.5, 0, 0)), (T, (0.7, 0, 0)), (T + 0.35, (0.55, 0, 0)), (E, Z3)],
        'neck2': [(0, Z3), (T - 0.08, (-0.2, 0, 0)), (T, (0.3, 0, 0)), (E, Z3)],
        'head': [(0, Z3), (0.45, (-0.45, 0, 0)), (T - 0.08, (-0.6, 0, 0)), (T, (0.75, 0, 0)), (T + 0.4, (0.5, 0, 0)), (E, Z3)],
        'jaw': [(0, 0.0), (0.45, 0.3), (T - 0.05, 0.4), (T, 0.05), (E, 0.0)],
        'ears': [(0, (0, 0.12, 0)), (0.45, (0, -0.25, 0.3)), (T, (0, 0.3, 0.4)), (E, (0, 0.12, 0))],
        'ribs': [(0, 0.0), (T - 0.1, 0.18), (T + 0.3, 0.05), (E, 0.0)],
        'tail': [(0, Z3), (0.45, (0.3, 0, 0)), (T, (-0.2, 0, 0)), (E, Z3)],
    }
    lift = [(0, Z5), (0.4, (0.02, -0.02, 0.48, 1.6, 0.9, 1.0)), (T - 0.1, (0.02, -0.08, 0.5, 1.5, 0.8, 1.0)), (T, (0.04, -0.2, 0.0, 0, 0)), (T + 0.4, (0.04, -0.2, 0, 0, 0)), (T + 0.65, (0.02, -0.1, 0.1, 0.5, 0.4)), (E, Z5)]
    return attack_clip('roots', keys, {'FL': lift, 'FR': [(k[0] + (0.04 if k[0] < T else 0), k[1]) for k in lift]}), E


LIE_FRONT = (0.02, 0.1, -0.12, 1.6, 0.9)
LIE_HIND = (0.06, -0.12, -0.12, -1.5, -0.3)
LIE = {
    'lift': (0, 0.05, -1.22), 'hips': (0.02, 0, 0), 'neck1': (0.32, 0, 0.1), 'neck2': (0.1, 0, 0.08), 'head': (0.32, 0.04, 0.18),
    'ears': (0, 0.42, 0.1), 'tail': (0.2, 0, 0.3),
}


def rest_clip():
    def clip(t):
        p = neutral()
        w = math.tau * t / 4.0
        for key, value in LIE.items():
            p[key] = value
        p['lift'] = (0, 0.05, -1.22 + 0.012 * math.sin(w))
        p['ribs'] = 0.03 * (0.5 + 0.5 * math.sin(w))
        p['head'] = (0.32 + 0.02 * math.sin(w + 0.5), 0.04, 0.18)
        feet(p, {'FL': LIE_FRONT, 'FR': LIE_FRONT, 'HL': LIE_HIND, 'HR': LIE_HIND})
        return p
    return clip, 4.0


def wake_clip():
    E = STAG['wake']
    keys = {
        'lift': [(0, LIE['lift']), (0.5, (0, 0.05, -1.15)), (0.9, (0, 0.1, -0.7)), (1.25, (0, 0.06, -0.1)), (1.45, (0, 0.0, -0.05)), (E, Z3)],
        'hips': [(0, LIE['hips']), (0.9, (0.3, 0, 0)), (1.25, (-0.04, 0, 0)), (1.5, (-0.03, 0, 0)), (E, Z3)],
        'neck1': [(0, LIE['neck1']), (0.5, (-0.2, 0, 0)), (1.2, (-0.1, 0, 0)), (1.5, (-0.3, 0, 0)), (E, Z3)],
        'neck2': [(0, LIE['neck2']), (0.5, (-0.1, 0, 0)), (E, Z3)],
        'head': [(0, LIE['head']), (0.5, (-0.2, 0, 0)), (1.3, (0.0, 0.2, 0.3)), (1.45, (0.0, -0.2, -0.3)), (1.6, (-0.2, 0.1, 0.1)), (E, Z3)],
        'ears': [(0, LIE['ears']), (0.4, (0, -0.1, 0.1)), (E, (0, 0.12, 0))],
        'tail': [(0, LIE['tail']), (E, Z3)],
        'jaw': [(0, 0.0), (1.45, 0.3), (1.7, 0.0)],
    }
    front = [(0, LIE_FRONT), (0.5, LIE_FRONT), (0.85, (0.02, -0.2, 0.1, 0.9, 0.5)), (1.1, (0.02, -0.1, 0.0, 0, 0)), (1.45, (0.02, -0.15, 0.25, 0.9, 0.5)), (1.62, Z5), (E, Z5)]
    hind = [(0, LIE_HIND), (0.85, LIE_HIND), (1.15, (0.04, 0.02, 0.05, -0.2, 0)), (1.3, Z5), (E, Z5)]
    return attack_clip('wake', keys, {'FL': front, 'FR': [(k[0] + (0.1 if 0.4 < k[0] < 1.2 else 0), k[1]) for k in front], 'HL': hind, 'HR': hind}), E


def defeat_clip():
    E = STAG['defeat']
    keys = {
        'lift': [(0, Z3), (0.4, (0, 0.18, 0.0)), (0.9, (0, 0.12, -0.35)), (1.3, (0, 0.1, -0.55)), (2.1, (0, 0.06, -1.15)), (2.4, LIE['lift']), (E, LIE['lift'])],
        'hips': [(0, Z3), (0.4, (-0.12, 0, 0.05)), (0.9, (0.25, 0, 0.0)), (1.3, (0.42, 0, 0.0)), (2.1, (0.08, 0, 0)), (2.4, LIE['hips']), (E, LIE['hips'])],
        'neck1': [(0, Z3), (0.4, (-0.3, 0, 0)), (1.1, (0.2, 0, 0.05)), (2.2, (0.3, 0, 0.1)), (3.0, (0.5, 0, 0.15)), (E, (0.52, 0, 0.15))],
        'neck2': [(0, Z3), (1.2, (0.15, 0, 0.05)), (3.0, (0.28, 0, 0.1)), (E, (0.3, 0, 0.1))],
        'head': [(0, Z3), (0.4, (-0.35, 0.1, 0)), (1.1, (0.25, 0, 0.1)), (2.4, (0.3, 0.05, 0.2)), (3.2, (0.42, 0.15, 0.25)), (E, (0.44, 0.16, 0.25))],
        'ears': [(0, (0, 0.12, 0)), (0.4, (0, -0.2, 0.3)), (2.0, (0, 0.5, 0.1)), (E, (0, 0.6, 0.05))],
        'jaw': [(0, 0.0), (0.35, 0.3), (0.8, 0.05), (E, 0.0)],
        'ribs': [(0, 0.0), (0.4, 0.15), (1.0, 0.25), (2.6, 0.2), (3.4, 0.04), (E, 0.0)],
        'tail': [(0, Z3), (0.4, (0.3, 0, 0)), (2.4, (0.3, 0, 0.3)), (E, (0.35, 0, 0.35))],
    }
    front = [(0, Z5), (0.4, (0.04, 0.12, 0.12, 0.4, 0.3)), (0.55, (0.04, 0.14, 0.0, 0, 0)), (0.9, (0.03, 0.1, -0.02, 0.9, 0.6)), (1.3, (0.02, 0.1, -0.1, 1.55, 0.9)), (E, LIE_FRONT)]
    hind = [(0, Z5), (0.4, (0.04, 0.16, 0.0, 0, 0)), (1.3, (0.05, 0.14, 0.0, 0.0, 0.0)), (1.8, (0.05, 0.0, -0.05, -0.9, -0.2)), (2.3, LIE_HIND), (E, LIE_HIND)]
    return attack_clip('defeat', keys, {'FL': front, 'FR': [(k[0] + (0.12 if 0 < k[0] < 2 else 0), k[1]) for k in front], 'HL': hind, 'HR': [(k[0] + (0.1 if 0 < k[0] < 2.2 else 0), k[1]) for k in hind]}), E


def stagger_clip():
    E = STAG['stagger']

    def clip(t):
        p = neutral()
        fade = 1.0 - smooth(t / E)
        wob = math.sin(t * 9.0) * fade
        p['lift'] = (0.06 * wob, track(t, [(0, 0.0), (0.3, 0.18), (E, 0.0)]), track(t, [(0, 0.0), (0.25, -0.12), (0.8, -0.05), (E, 0.0)]))
        p['hips'] = (0.0, 0.16 * wob, 0.08 * math.sin(t * 6.0) * fade)
        p['chest'] = (0.0, -0.1 * wob, 0.0)
        p['neck1'] = (track(t, [(0, 0.0), (0.2, -0.3), (0.7, 0.25), (E, 0.0)]), 0.12 * wob, 0.2 * math.sin(t * 5.0) * fade)
        p['head'] = (track(t, [(0, 0.0), (0.2, -0.25), (0.7, 0.3), (E, 0.0)]), 0.25 * math.sin(t * 7.0 + 1.0) * fade, 0.3 * math.sin(t * 4.0) * fade)
        p['jaw'] = 0.25 * math.exp(-((t - 0.25) / 0.15) ** 2)
        p['ears'] = (0.0, 0.3 * fade + 0.12, 0.3 * fade)
        p['ribs'] = 0.1 * fade
        feet(p, {
            'FL': track(t, [(0, Z5), (0.15, (0.12, 0.05, 0.14, 0.6, 0.4)), (0.3, (0.16, 0.15, 0, 0, 0)), (0.85, (0.12, 0.12, 0, 0, 0)), (1.05, (0.04, 0.05, 0.1, 0.5, 0.4)), (E, Z5)]),
            'FR': track(t, [(0, Z5), (0.35, (0.14, 0.1, 0.14, 0.6, 0.4)), (0.55, (0.12, 0.18, 0, 0, 0)), (1.0, (0.1, 0.12, 0, 0, 0)), (1.2, (0.03, 0.04, 0.1, 0.5, 0.4)), (E, Z5)]),
            'HL': track(t, [(0, Z5), (0.25, (0.08, 0.16, 0.1, -0.3, 0.2)), (0.4, (0.1, 0.22, 0, 0, 0)), (E, Z5)]),
            'HR': track(t, [(0, Z5), (0.5, (0.06, 0.2, 0.1, -0.3, 0.2)), (0.65, (0.08, 0.2, 0, 0, 0)), (E, Z5)]),
        })
        return p
    return clip, E


def stun_clip():
    E = STAG['stun']

    def clip(t):
        p = neutral()
        daze = smooth((t - 0.3) / 0.4) * (1.0 - smooth((t - (E - 0.5)) / 0.45))
        sway = math.sin(t * 2.4)
        back = track(t, [(0, 0.0), (0.18, 0.5), (0.35, 0.55), (E - 0.5, 0.5), (E - 0.15, 0.1), (E, 0.0)])
        p['lift'] = (0.04 * sway * daze, back, track(t, [(0, 0.0), (0.12, 0.12), (0.3, -0.16), (E - 0.5, -0.12), (E, 0.0)]))
        p['hips'] = (track(t, [(0, 0.0), (0.15, -0.12), (0.4, 0.12), (E - 0.5, 0.1), (E, 0.0)]), 0.06 * sway * daze, 0.05 * sway * daze)
        p['neck1'] = (track(t, [(0, 0.0), (0.15, -0.5), (0.5, 0.5), (E - 0.5, 0.45), (E, 0.0)]), 0.05 * sway * daze, 0.12 * sway * daze)
        p['head'] = (track(t, [(0, 0.0), (0.15, -0.6), (0.5, 0.45), (E - 0.5, 0.4), (E, 0.0)]), 0.18 * math.sin(t * 1.7) * daze, 0.2 * math.sin(t * 2.1 + 0.6) * daze)
        p['ribs'] = track(t, [(0, 0.0), (0.3, 0.55), (E - 0.6, 0.55), (E - 0.2, 0.05), (E, 0.0)])
        p['jaw'] = track(t, [(0, 0.0), (0.15, 0.35), (0.6, 0.12), (E - 0.5, 0.1), (E, 0.0)])
        p['ears'] = (0.0, 0.12 + 0.45 * daze, 0.1)
        p['tail'] = (0.3 * daze, 0, 0.1 * sway * daze)
        hop = [(0, Z5), (0.08, (0.05, 0.1, 0.25, 0.8, 0.5)), (0.25, (0.14, 0.45, 0.0, 0, 0)), (E - 0.5, (0.14, 0.45, 0, 0, 0)), (E - 0.3, (0.06, 0.25, 0.14, 0.6, 0.4)), (E - 0.1, Z5), (E, Z5)]
        hind = [(0, Z5), (0.04, (0.04, 0.12, 0.2, -0.4, 0.3)), (0.22, (0.12, 0.5, 0.0, 0, 0)), (E - 0.4, (0.12, 0.5, 0, 0, 0)), (E - 0.2, (0.05, 0.25, 0.12, -0.3, 0.3)), (E, Z5)]
        feet(p, {'FL': track(t, hop), 'FR': track(t, [(k[0] + (0.03 if 0 < k[0] < E - 0.2 else 0), k[1]) for k in hop]), 'HL': track(t, hind), 'HR': track(t, hind)})
        return p
    return clip, E


def shift_clip():
    E = STAG['shift']
    slam = 1.45
    keys = {
        'hips': [(0, Z3), (0.25, (0.1, 0, 0)), (0.75, (-0.58, 0, 0)), (slam - 0.15, (-0.62, 0, 0)), (slam - 0.04, (-0.45, 0, 0)), (slam, (0.14, 0, 0)), (slam + 0.3, (0.08, 0, 0)), (E, Z3)],
        'lift': [(0, Z3), (0.25, (0, 0.02, -0.14)), (0.75, (0, 0.24, -0.08)), (slam - 0.15, (0, 0.27, -0.06)), (slam, (0, 0.06, -0.18)), (slam + 0.4, (0, 0.03, -0.1)), (E, Z3)],
        'spine': [(0, Z3), (0.75, (-0.09, 0, 0)), (slam, (0.08, 0, 0)), (E, Z3)],
        'neck1': [(0, Z3), (0.75, (-0.6, 0, 0)), (slam - 0.15, (-0.65, 0, 0)), (slam, (0.55, 0, 0)), (slam + 0.5, (0.35, 0, 0.2)), (E - 0.3, (0.1, 0, -0.1)), (E, Z3)],
        'neck2': [(0, Z3), (0.75, (-0.3, 0, 0)), (slam, (0.25, 0, 0)), (E, Z3)],
        'head': [(0, Z3), (0.75, (-0.55, 0, 0)), (slam - 0.15, (-0.6, 0, 0)), (slam, (0.55, 0, 0)), (slam + 0.35, (0.4, 0.25, 0.3)), (slam + 0.6, (0.35, -0.25, -0.3)), (E - 0.2, (0.08, 0, 0)), (E, Z3)],
        'jaw': [(0, 0.0), (0.6, 0.45), (slam - 0.1, 0.5), (slam, 0.1), (slam + 0.4, 0.2), (E, 0.0)],
        'ribs': [(0, 0.0), (0.75, 0.45), (slam, 0.6), (slam + 0.6, 0.3), (E, 0.0)],
        'ears': [(0, (0, 0.12, 0)), (0.6, (0, -0.3, 0.6)), (slam + 0.5, (0, 0.0, 0.5)), (E, (0, 0.12, 0))],
        'tail': [(0, Z3), (0.75, (0.5, 0, 0)), (slam, (-0.3, 0, 0)), (E, Z3)],
    }
    paw = [(0, Z5), (0.3, (0.0, -0.06, 0.25, 1.0, 0.6, 0.4)), (0.75, (0.02, -0.02, 0.64, 1.75, 1.0, 1.0)), (0.95, (0.03, -0.3, 0.5, 0.9, 0.5, 1.0)), (1.15, (0.02, 0.0, 0.66, 1.8, 1.0, 1.0)), (slam - 0.15, (0.03, -0.2, 0.56, 1.2, 0.7, 1.0)), (slam - 0.04, (0.05, -0.3, 0.28, 0.3, 0.1, 0.3)), (slam, (0.07, -0.28, 0.0, 0, 0)), (slam + 0.5, (0.07, -0.28, 0, 0, 0)), (slam + 0.75, (0.03, -0.12, 0.12, 0.6, 0.4)), (E - 0.05, Z5), (E, Z5)]
    hind = [(0, Z5), (0.35, (0.04, 0.1, 0, 0, 0)), (slam + 0.5, (0.04, 0.1, 0, 0, 0)), (slam + 0.75, (0.02, 0.05, 0.12, -0.3, 0.3)), (E, Z5)]
    return attack_clip('shift', keys, {'FL': paw, 'FR': [(k[0] + (0.08 if 0 < k[0] < slam - 0.2 else 0), k[1]) for k in paw], 'HL': hind, 'HR': hind}), E


def bound_clip():
    E = 0.75
    keys = {
        'lift': [(0, Z3), (0.1, (0, -0.05, -0.16)), (0.32, (0, 0.2, 0.38)), (0.5, (0, 0.3, 0.12)), (0.6, (0, 0.2, -0.14)), (E, Z3)],
        'hips': [(0, Z3), (0.1, (0.12, 0, 0)), (0.3, (-0.2, 0, 0)), (0.5, (0.06, 0, 0)), (0.6, (0.1, 0, 0)), (E, Z3)],
        'spine': [(0, Z3), (0.1, (0.08, 0, 0)), (0.3, (-0.08, 0, 0)), (E, Z3)],
        'neck1': [(0, Z3), (0.1, (0.2, 0, 0)), (0.32, (-0.3, 0, 0)), (0.6, (0.15, 0, 0)), (E, Z3)],
        'head': [(0, Z3), (0.32, (-0.2, 0, 0)), (0.6, (0.2, 0, 0)), (E, Z3)],
        'ears': [(0, (0, 0.12, 0)), (0.3, (0, -0.2, 0.5)), (E, (0, 0.12, 0))],
        'tail': [(0, Z3), (0.3, (0.5, 0, 0)), (E, Z3)],
    }
    front = [(0, Z5), (0.12, (0.0, 0.05, 0.0, 0, 0)), (0.3, (0.02, 0.1, 0.35, 1.3, 0.8)), (0.5, (0.02, 0.05, 0.25, 0.8, 0.5)), (0.6, (0.03, 0.0, 0.0, 0, 0)), (E, Z5)]
    hind = [(0, Z5), (0.14, (0.0, 0.08, 0.0, 0, 0)), (0.32, (0.02, -0.05, 0.4, -0.9, 0.6)), (0.5, (0.03, 0.1, 0.22, -0.4, 0.3)), (0.58, (0.04, 0.12, 0.0, 0, 0)), (E, Z5)]
    return attack_clip('bound', keys, {'FL': front, 'FR': front, 'HL': hind, 'HR': hind}), E


def flinch_clip():
    E = 0.3
    keys = {
        'lift': [(0, Z3), (0.06, (0.0, 0.07, -0.03)), (E, Z3)],
        'hips': [(0, Z3), (0.06, (0.0, 0.06, 0.03)), (E, Z3)],
        'neck1': [(0, Z3), (0.06, (-0.2, 0, 0.08)), (E, Z3)],
        'head': [(0, Z3), (0.06, (-0.25, 0.1, 0.12)), (E, Z3)],
        'jaw': [(0, 0.0), (0.06, 0.2), (E, 0.0)],
        'ribs': [(0, 0.0), (0.06, 0.12), (E, 0.0)],
        'ears': [(0, (0, 0.12, 0)), (0.06, (0, -0.1, 0.4)), (E, (0, 0.12, 0))],
    }
    return attack_clip('flinch', keys, {}), E


def mirrored(fn):
    def clip(t):
        p = fn(t)
        out = dict(p)
        for key in ('hips', 'spine', 'chest', 'neck1', 'neck2', 'head', 'tail'):
            x, y, z = p[key]
            out[key] = (x, -y, -z)
        x, y, z = p['lift']
        out['lift'] = (-x, y, z)
        for a, b in (('FL', 'FR'), ('FR', 'FL'), ('HL', 'HR'), ('HR', 'HL')):
            target, fold, flex, carry, local = p[a]
            out[b] = (Vector((-target.x, target.y, target.z)), fold, flex, carry, Vector((-local.x, local.y, local.z)))
        return out
    return clip


def clips():
    out = [
        ('idle', clip_idle, 4.0),
        ('walk', clip_gait('walk', WALK_FEET, {'legs': (0.2, 1.3, 0.9, 0.9), 'pose': walk_body}), GAITS['walk']['cycle']),
        ('trot', clip_gait('trot', TROT_FEET, {'legs': (0.32, 1.5, 1.1, 1.0), 'pose': trot_body}), GAITS['trot']['cycle']),
        ('gallop', clip_gait('gallop', GALLOP_FEET, {'legs': (0.45, 1.6, 1.2, 1.1), 'pose': gallop_body}), GAITS['gallop']['cycle']),
    ]
    for name, maker in (('sweep', sweep_clip), ('stomp', stomp_clip), ('roots', roots_clip), ('charge-wind', charge_wind_clip), ('skid', skid_clip), ('rest', rest_clip), ('wake', wake_clip), ('stagger', stagger_clip), ('stun', stun_clip), ('shift', shift_clip), ('defeat', defeat_clip), ('bound', bound_clip), ('flinch', flinch_clip)):
        fn, length = maker()
        out.append((name, fn, length))
        if name == 'sweep':
            out.append(('sweep-mirror', mirrored(fn), length))
    return out


def render(scene, rig, folder):
    shoot = studio(scene)
    target = Vector((0, -0.4, 2.2))
    views = {'front': (0, -10.5, 2.6), 'side': (10.5, -0.4, 2.4), 'back': (0, 10, 2.8), 'three-quarter': (7.2, -7.6, 3.4)}
    for name, location in views.items():
        shoot(folder, name, location, target)
    shoot(folder, 'face', (1.5, -4.3, 3.3), (0, -1.7, 3.1))
    shoot(folder, 'eye', (1.6, -3.0, 3.1), (0.1, -1.72, 2.92))
    shoot(folder, 'chest', (2.2, -4.2, 1.6), (0, -0.8, 1.8))
    poses = [('sweep', 0.7), ('sweep', 1.0), ('stomp', 0.8), ('stomp', 1.0), ('charge-wind', 0.85), ('gallop', 0.1), ('gallop', 0.3), ('walk', 0.2), ('roots', 0.95), ('stun', 1.5), ('shift', 1.0), ('defeat', 4.0), ('rest', 0.0), ('stagger', 0.3)]
    for name, seconds in poses:
        rig.animation_data.action = bpy.data.actions[name]
        scene.frame_set(round(seconds * FPS))
        shoot(folder, f'pose-{name}-{seconds}', (9.0, -5.0, 3.0), target)
    rig.animation_data.action = None


def main():
    scene = reset()
    rig = make_armature(scene, 'MossheartRig', BONES)
    model = build_model()
    mesh = make_mesh(scene, 'Mossheart', model, rig, ('Body', 'Heart', 'Eyes'), [name for name, *_ in BONES])
    report = bake(rig, StagPoser(rig), clips())
    export(OUT, rig, [mesh])
    print('STAG', json.dumps({'triangles': sum(len(f) - 2 for f in model.faces), 'vertices': len(model.verts), 'clips': report, 'bytes': os.path.getsize(OUT)}))
    if RENDERS:
        render(scene, rig, RENDERS)


main()
