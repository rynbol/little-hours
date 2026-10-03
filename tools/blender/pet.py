import json
import math
import os
import sys

import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
from kit import (ROOT, RENDERS, ARGS, Model, Poser, bake, export, loft, make_armature, make_mesh, mix, orb, reset, segment_distance,
                 smooth, srgb, studio, tables, to_linear, track, tube, wobble)

OUT = os.path.join(ROOT, 'public', 'wilds', 'pets')
RATE = 60
TABLES = tables('src/core/wilds/pet.js', {'pet': 'PET', 'attacks': 'PET_ATTACKS', 'gaits': 'PET_GAITS'})
WOLF = tables('src/core/wilds/wolf.js', {'wolf': 'WOLF'})['wolf']
PET, ATTACKS, GAITS = TABLES['pet'], TABLES['attacks'], TABLES['gaits']
KINDS = ARGS[ARGS.index('--kinds') + 1].split(',') if '--kinds' in ARGS else ['cat', 'dog', 'bunny', 'fox', 'panda', 'wolf']
HONEY = srgb('#d9af65')
TAU = math.tau


def tones(codes):
    return {name: srgb(code) for name, code in codes.items()}


SPECIES = {
    'cat': {
        'size': 1.0, 'spine': 0.31, 'half': 0.12, 'chest': (0.15, 0.15, 0.19), 'hips': (0.145, 0.14, 0.17),
        'neck': (0.07, -0.16), 'head': (0.09, -0.07), 'skull': (0.18, 0.158, 0.157),
        'front': (0.085, -0.07, -0.05, 0.12, 0.12, 0.045, 0.04), 'hind': (0.09, -0.05, 0.06, 0.13, 0.13, 0.05, 0.042),
        'tail': (0.05, 0.17, 7, 0.066, 0.043, 0.035), 'carriage': (1.2, -0.06, 0.5), 'tip': 1,
        'colours': tones({'fur': '#d4904f', 'light': '#e9b377', 'cream': '#f5e6cb', 'stripe': '#b5703b', 'ear': '#eba99c', 'nose': '#dc8a8a',
                          'eye': '#3a2a22', 'iris': '#7a5232', 'shine': '#fffaf0', 'blush': '#f2a092', 'mouth': '#7a4a36', 'bean': '#e89a97'}),
        'coat': 'tabby', 'ears': 'pointed', 'face': 'cat', 'tail_style': 'tabby', 'whiskers': True, 'ruff': 0.0, 'cheeks': 1.0, 'tufts': 0.0,
    },
    'dog': {
        'size': 1.0, 'spine': 0.31, 'half': 0.13, 'chest': (0.155, 0.15, 0.2), 'hips': (0.15, 0.142, 0.18),
        'neck': (0.07, -0.17), 'head': (0.09, -0.07), 'skull': (0.18, 0.16, 0.157),
        'front': (0.09, -0.07, -0.05, 0.12, 0.12, 0.047, 0.043), 'hind': (0.095, -0.05, 0.06, 0.13, 0.13, 0.052, 0.045),
        'tail': (0.08, 0.16, 4, 0.058, 0.047, 0.036), 'carriage': (1.3, 0.38, 0.3), 'tip': 0,
        'colours': tones({'fur': '#efddbd', 'light': '#f6e9d2', 'cream': '#fcf6ea', 'stripe': '#b8794c', 'ear': '#a9683f', 'nose': '#352a26',
                          'eye': '#33241d', 'iris': '#6b4630', 'shine': '#fffaf0', 'blush': '#f3a698', 'mouth': '#6d4632', 'tongue': '#ee8a8f',
                          'collar': '#c8674f', 'tag': '#e3bb5f', 'bean': '#3d302b'}),
        'coat': 'saddle', 'ears': 'floppy', 'face': 'dog', 'tail_style': 'plain', 'whiskers': False, 'ruff': 0.0, 'cheeks': 0.6, 'tufts': 0.0, 'collar': True,
    },
    'bunny': {
        'size': 1.0, 'spine': 0.3, 'half': 0.1, 'chest': (0.15, 0.14, 0.17), 'hips': (0.17, 0.165, 0.19),
        'neck': (0.07, -0.14), 'head': (0.085, -0.06), 'skull': (0.181, 0.159, 0.161),
        'front': (0.08, -0.07, -0.05, 0.1, 0.1, 0.04, 0.036), 'hind': (0.1, -0.06, 0.05, 0.12, 0.12, 0.058, 0.048),
        'tail': (0.1, 0.19, 1, 0.03, 0.07, 0.072), 'carriage': (0.6, 0.0, 0.0), 'tip': 0,
        'colours': tones({'fur': '#ead8c2', 'light': '#f2e5d4', 'cream': '#fbf6ee', 'stripe': '#cdb8a3', 'ear': '#f0b3b0', 'nose': '#e5949a',
                          'eye': '#3a2a22', 'iris': '#77543c', 'shine': '#fffaf0', 'blush': '#f4a9a6', 'mouth': '#8a5d4d', 'bean': '#eaa5a3'}),
        'coat': 'plain', 'ears': 'long', 'face': 'cat', 'tail_style': 'puff', 'whiskers': True, 'ruff': 0.0, 'cheeks': 0.9, 'tufts': 0.0,
    },
    'fox': {
        'size': 1.0, 'spine': 0.33, 'half': 0.125, 'chest': (0.14, 0.14, 0.19), 'hips': (0.135, 0.13, 0.17),
        'neck': (0.075, -0.16), 'head': (0.09, -0.07), 'skull': (0.174, 0.16, 0.15),
        'front': (0.08, -0.07, -0.05, 0.13, 0.13, 0.04, 0.034), 'hind': (0.085, -0.05, 0.06, 0.14, 0.14, 0.046, 0.037),
        'tail': (0.06, 0.17, 6, 0.074, 0.062, 0.078), 'carriage': (0.45, 0.02, 0.0), 'tip': 2,
        'colours': tones({'fur': '#df7a3c', 'light': '#ea9458', 'cream': '#fbf1e2', 'stripe': '#c7652e', 'ear': '#fbf1e2', 'nose': '#2f2320',
                          'eye': '#2d211c', 'iris': '#6e4428', 'shine': '#fffaf0', 'blush': '#f2a092', 'mouth': '#5e3a2c', 'leg': '#4a342b',
                          'paw': '#3a2a24', 'back': '#4a342b', 'bean': '#2a201c'}),
        'coat': 'fox', 'ears': 'pointed', 'face': 'fox', 'tail_style': 'bushy', 'whiskers': False, 'ruff': 1.0, 'cheeks': 1.2, 'tufts': 1.0,
    },
    'panda': {
        'size': 1.0, 'spine': 0.3, 'half': 0.12, 'chest': (0.155, 0.14, 0.19), 'hips': (0.15, 0.142, 0.18),
        'neck': (0.07, -0.16), 'head': (0.09, -0.07), 'skull': (0.188, 0.162, 0.162),
        'front': (0.085, -0.07, -0.05, 0.11, 0.11, 0.048, 0.044), 'hind': (0.09, -0.05, 0.06, 0.12, 0.12, 0.053, 0.046),
        'tail': (0.06, 0.17, 7, 0.068, 0.06, 0.056), 'carriage': (0.62, -0.03, 0.0), 'tip': 0,
        'colours': tones({'fur': '#b9552c', 'light': '#c8683a', 'cream': '#f6ead9', 'stripe': '#8e3f22', 'ear': '#f6ead9', 'nose': '#2c201c',
                          'eye': '#2a1e1a', 'iris': '#5e3a26', 'shine': '#fffaf0', 'blush': '#f2a092', 'mouth': '#5a3325', 'leg': '#3a2622',
                          'paw': '#2e201c', 'ring': '#e8b47f', 'bean': '#2a1d1a'}),
        'coat': 'panda', 'ears': 'round', 'face': 'panda', 'tail_style': 'ringed', 'whiskers': False, 'ruff': 0.0, 'cheeks': 1.0, 'tufts': 0.8,
    },
    'wolf': {
        'size': WOLF['size'], 'spine': 0.33, 'half': 0.13, 'chest': (0.15, 0.16, 0.2), 'hips': (0.135, 0.135, 0.17),
        'neck': (0.08, -0.16), 'head': (0.1, -0.07), 'skull': (0.165, 0.16, 0.15),
        'front': (0.085, -0.07, -0.05, 0.135, 0.135, 0.044, 0.036), 'hind': (0.09, -0.05, 0.06, 0.145, 0.145, 0.05, 0.038),
        'tail': (0.06, 0.16, 6, 0.07, 0.06, 0.07), 'carriage': (0.32, 0.0, 0.0), 'tip': 1,
        'colours': tones({'fur': '#66708a', 'light': '#8e98ac', 'cream': '#e6e8ec', 'stripe': '#454c5f', 'ear': '#d6c2c4', 'nose': '#25262c',
                          'eye': '#2b2622', 'iris': '#7a6038', 'shine': '#fffaf0', 'blush': '#d9a3a8', 'mouth': '#4a3a3e', 'leg': '#76809a',
                          'paw': '#5a6378', 'tip': '#3a4152', 'bean': '#2a2a30'}),
        'coat': 'wolf', 'ears': 'pointed', 'face': 'fox', 'tail_style': 'wolf', 'whiskers': False, 'ruff': 1.5, 'cheeks': 1.3, 'tufts': 1.3, 'ear_length': 0.12,
    },
}

S = {}
BONE = {}
HOME = {}
FOLD = {'FL': 0.0, 'FR': 0.0, 'HL': -0.35, 'HR': -0.35}
SIDES = (('L', 1), ('R', -1))
LEGS = {'F': ('arm', 'fore', 'wrist', 'pawF'), 'H': ('thigh', 'shin', 'hock', 'pawH')}
Z3 = (0.0, 0.0, 0.0)
Z6 = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)


def v(x, y, z):
    return Vector((x, y, z))


def centres():
    sp, half = S['spine'], S['half']
    chest = v(0, -half, sp)
    neck = chest + v(0, S['neck'][1], S['neck'][0])
    head = neck + v(0, S['head'][1], S['head'][0])
    return chest, neck, head


def solve(a, b, l1, l2, bend):
    offset = b - a
    reach = max(abs(l1 - l2) + 1e-3, min(l1 + l2 - 1e-4, offset.length))
    along = offset.normalized()
    hint = v(0, bend, 0)
    across = (hint - along * hint.dot(along)).normalized()
    angle = math.acos(max(-1.0, min(1.0, (l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach))))
    return a + (along * math.cos(angle) + across * math.sin(angle)) * l1


def ear_frame(side):
    rx, ry, rz = S['skull']
    _, _, head = centres()
    kind = S['ears']
    n = {'pointed': v(0.56, -0.08, 0.82), 'floppy': v(0.86, -0.02, 0.5), 'long': v(0.36, 0.04, 0.93), 'round': v(0.62, -0.04, 0.78)}[kind]
    n = v(n.x * side, n.y, n.z).normalized()
    base = head + v(n.x * rx, n.y * ry, n.z * rz) * 0.94
    axis = {'pointed': v(0.32, 0.0, 1.0), 'floppy': v(0.55, -0.05, -1.0), 'long': v(0.14, 0.12, 1.0), 'round': v(0.42, 0.0, 1.0)}[kind]
    length = S.get('ear_length', {'pointed': 0.105, 'floppy': 0.15, 'long': 0.26, 'round': 0.085}[kind])
    return base, v(axis.x * side, axis.y, axis.z).normalized(), length


def front_of(x, z, extra=()):
    rx, ry, rz = S['skull']
    _, _, head = centres()
    best = head.y - ry * math.sqrt(max(0.0, 1 - (x / rx) ** 2 - (z / rz) ** 2))
    for centre, radii in extra:
        k = 1 - ((head.x + x - centre.x) / radii[0]) ** 2 - ((head.z + z - centre.z) / radii[2]) ** 2
        if k > 0:
            best = min(best, centre.y - radii[1] * math.sqrt(k))
    return best


def eye_centre(side):
    return skull_point(0.066 * side, 0.007)


def skull_point(x, z, out=0.0):
    rx, ry, rz = S['skull']
    _, _, head = centres()
    k = max(0.0, 1 - (x / rx) ** 2 - (z / rz) ** 2)
    y = -ry * math.sqrt(k)
    normal = v(x / rx ** 2, y / ry ** 2, z / rz ** 2).normalized()
    return head + v(x, y, z) + normal * out, normal


def skeleton():
    sp, half = S['spine'], S['half']
    chest, neck, head = centres()
    bones = [
        ('root', Z3, (0, -0.15, 0), None, False),
        ('hips', (0, 0.02, sp), (0, half + 0.06, sp), 'root', False),
        ('spine', (0, 0.02, sp), (0, -half * 0.9, sp + 0.005), 'hips', False),
        ('chest', (0, -half * 0.9, sp + 0.005), (0, -half - 0.12, sp + 0.03), 'spine', True),
        ('neck', tuple(chest + v(0, -0.12, 0.05)), tuple(neck + v(0, -0.02, 0.05)), 'chest', False),
        ('head', tuple(neck + v(0, -0.02, 0.05)), tuple(head + v(0, -0.15, 0.0)), 'neck', True),
        ('jaw', tuple(head + v(0, -0.04, -0.08)), tuple(head + v(0, -0.13, -0.095)), 'head', False),
    ]
    for side, sign in SIDES:
        eye, normal = eye_centre(sign)
        bones.append((f'eye.{side}', tuple(eye), tuple(eye + v(0, -0.04, 0)), 'head', False))
        base, axis, length = ear_frame(sign)
        bones.append((f'ear.{side}', tuple(base), tuple(base + axis * length), 'head', False))
    up, back, count, length, _, _ = S['tail']
    start = v(0, half + back, sp + up)
    for i in range(count):
        bones.append((f'tail{i + 1}', tuple(start + v(0, length * i, 0)), tuple(start + v(0, length * (i + 1), 0)), 'hips' if i == 0 else f'tail{i}', i > 0))
    for side, sign in SIDES:
        for kind, centre, anchor_name, bend in (('F', chest, 'chest', 1.0), ('H', v(0, half, sp), 'hips', -1.0)):
            ax, aup, afwd, l1, l2, _, _ = S['front' if kind == 'F' else 'hind']
            names = [f'{name}.{side}' for name in LEGS[kind]]
            top = centre + v(ax * sign, afwd, aup)
            paw = v((0.075 if kind == 'F' else 0.08) * sign, -0.13 if kind == 'F' else 0.15, 0.035)
            if kind == 'F':
                low, upper, lower = 0.03, l1, l2 - 0.03
                wrist = paw + v(0, 0.004, low)
            else:
                low, upper, lower = l2 * 0.42, l1, l2 * 0.66
                wrist = paw + v(0, low * 0.3, low * 0.95)
            elbow = solve(top, wrist, upper, lower, bend)
            toe = paw + v(0, -0.055, -0.02)
            chain = [top, elbow, wrist, paw, toe]
            for k, name in enumerate(names):
                bones.append((name, tuple(chain[k]), tuple(chain[k + 1]), anchor_name if k == 0 else names[k - 1], k > 0))
    return bones


def chain_weights(p, chain, sharp=4.0):
    scored = sorted((segment_distance(p, BONE[n][0], BONE[n][1]), n) for n in chain)[:2]
    raw = [(1.0 / (d ** sharp + 1e-6), n) for d, n in scored]
    total = sum(w for w, _ in raw)
    return {n: w / total for w, n in raw}


def rigid(name):
    return lambda p, a: {name: 1.0}


def ellipsoid(centre, radii, rot=None, rings=10, segments=14):
    rot = rot or Matrix.Identity(3)
    c = Vector(centre)
    return orb(lambda n: c + rot @ v(n.x * radii[0], n.y * radii[1], n.z * radii[2]), rings, segments)


def frame(axis, side=None):
    z = Vector(axis).normalized()
    x = Vector(side) if side is not None else z.orthogonal()
    x = (x - z * x.dot(z)).normalized()
    return x, z.cross(x), z


def cone(base, axis, length, radius, depth=1.0, side=None, tip=0.75, rings=10, segments=12):
    x, y, z = frame(axis, side)
    b = Vector(base)

    def shape(n):
        h = (n.z + 1) / 2
        r = radius * 1.55 * (1 - h) ** tip
        return b + x * (n.x * r) + y * (n.y * r * depth) + z * (h * length)
    return orb(shape, rings, segments)


def fur(colour, p, amount=0.05, scale=34.0):
    k = 1.0 + amount * wobble(p, scale, 3.0)
    return tuple(max(0.0, min(1.0, c * k)) for c in colour)


def solid(colour, slot=0):
    return lambda p, a: (*colour, slot / 16)


def band(value, centre, width, soft=0.012):
    return 1.0 - smooth((abs(value - centre) - width) / soft + 0.5)


def torso_colour(p, a):
    C, coat = S['colours'], S['coat']
    n = a[0]
    up, y = n.z, p.y
    half = S['half']
    front, back = half + S['chest'][2], half + S['hips'][2]
    chest_front = smooth((-(y + front - 0.12)) / 0.05) * smooth((0.3 - up) / 0.25)
    belly = smooth((-up - 0.4) / 0.2)
    base = mix(C['light'], C['fur'], smooth((up - 0.05) / 0.45))
    if coat == 'tabby':
        for centre in (-0.2, -0.1, 0.0, 0.1, 0.19):
            stripe = band(y, centre, 0.026 * (0.4 + max(0.0, up) * 0.8)) * smooth((up - 0.1) / 0.15)
            base = mix(base, C['stripe'], stripe)
    elif coat == 'saddle':
        base = C['fur']
        saddle = smooth((up - 0.3) / 0.12) * smooth((y + 0.14) / 0.03) * smooth((back - 0.06 - y) / 0.03)
        base = mix(base, C['stripe'], saddle)
    elif coat == 'panda':
        base = C['fur'] if up > 0.45 else mix(C['light'], C['fur'], smooth((up - 0.15) / 0.3))
        base = mix(base, C['leg'], smooth((-up - 0.25) / 0.15) + chest_front)
        return (*fur(base, p), 0.0)
    elif coat == 'wolf':
        base = mix(base, C['stripe'], smooth((up - 0.6) / 0.2) * smooth((y + 0.15) / 0.05))
    cream = belly + chest_front * (1.4 if coat in ('fox', 'wolf') else 1.0)
    return (*fur(mix(base, C['cream'], cream), p), 0.0)


def torso_piece():
    sp, half = S['spine'], S['half']
    cx, cy, cl = S['chest']
    hx, hy, hl = S['hips']
    stations = [(-half - cl * math.cos(a), cx * math.sin(a), cy * math.sin(a), 0.0) for a in [math.pi / 2 * k / 12 for k in range(1, 12)]]
    for k in range(13):
        u = k / 12
        waist = 1 + 0.02 * math.sin(math.pi * u)
        stations.append((-half + 2 * half * u, (cx + (hx - cx) * u) * waist, (cy + (hy - cy) * u) * waist, 0.015 * math.sin(math.pi * u)))
    stations += [(half + hl * math.cos(a), hx * math.sin(a), hy * math.sin(a), 0.0) for a in [math.pi / 2 * k / 12 for k in range(11, 0, -1)]]
    sides = 32
    rings, attrs = [], []
    for y, rx, rz, sag in stations:
        u = (y + half + cl) / (2 * half + cl + hl)
        ring, ring_attrs = [], []
        for j in range(sides):
            angle = TAU * j / sides
            c, s = math.cos(angle), math.sin(angle)
            belly = 0.93 if s < 0 else 1.0
            ring.append(v(rx * c, y, sp + rz * s * belly - sag * max(0.0, -s)))
            ring_attrs.append((v(c, 0, s), u, j / sides))
        rings.append(ring)
        attrs.append(ring_attrs)
    return loft(rings, attrs)


def haunch(model, side, sign):
    for top, anchor, radii, shift in ((f'thigh.{side}', 'hips', (0.062, 0.1, 0.095), v(-0.012 * sign, 0.0, -0.02)),
                                      (f'arm.{side}', 'chest', (0.046, 0.06, 0.065), v(-0.012 * sign, 0.0, 0.0))):
        joint = BONE[top][0]
        if S['kind'] == 'bunny' and anchor == 'hips':
            radii = (0.075, 0.12, 0.11)

        def weight(p, a, joint=joint, top=top, anchor=anchor):
            share = 0.2 + 0.7 * smooth((joint.z - 0.02 - p.z) / 0.07)
            return {top: share, anchor: 1 - share}
        model.add(ellipsoid(joint + shift, radii, None, 12, 16), lambda p, a: torso_colour(p, (v(0, 0, 0.35 + 0.65 * a[0].z),)), weight)


def torso_weight(p, a):
    weights = chain_weights(p, ['hips', 'spine', 'chest', 'neck'], 4.0)
    for side, sign in SIDES:
        for top, anchor in ((f'arm.{side}', 'chest'), (f'thigh.{side}', 'hips')):
            joint = BONE[top][0]
            reach = smooth(1.0 - (p - joint).length / 0.1) * smooth((joint.z + 0.05 - p.z) / 0.08)
            if reach > 0:
                weights = {k: w * (1 - 0.6 * reach) for k, w in weights.items()}
                weights[top] = weights.get(top, 0.0) + 0.6 * reach
    return weights


def skull_shape(n):
    rx, ry, rz = S['skull']
    _, _, head = centres()
    x, y, z = n.x * rx, n.y * ry, n.z * rz
    cheek = smooth((abs(n.x) - 0.45) / 0.45) * smooth((0.2 - n.z) / 0.6) * S['cheeks']
    x *= 1 + 0.08 * cheek
    z -= 0.012 * cheek
    if n.z > 0:
        z *= 1 - 0.05 * n.z ** 2
    if S['face'] in ('fox', 'dog') and n.y < 0:
        y *= 1 + 0.06 * smooth((-n.z + 0.2) / 0.6) * (-n.y)
    return head + v(x, y, z)


def head_colour(p, a):
    C, face = S['colours'], S['face']
    n = a[0]
    base = mix(C['light'], C['fur'], smooth((n.z + 0.25) / 0.5))
    under = smooth((-n.z - 0.45) / 0.25)
    lower_front = smooth((-n.z - 0.05) / 0.25) * smooth((-n.y - 0.35) / 0.3)
    if face == 'panda':
        base = mix(C['fur'], C['cream'], lower_front * 1.2)
        return (*fur(mix(base, C['cream'], under * 0.6), p), 0.0)
    if face == 'fox':
        cheek = smooth((-n.z + 0.05) / 0.3) * smooth((abs(n.x) - 0.2) / 0.3)
        base = mix(base, C['cream'], max(cheek, lower_front))
    elif face == 'dog':
        base = mix(C['fur'], C['cream'], lower_front * 0.6)
    else:
        base = mix(base, C['cream'], lower_front * 0.5)
    return (*fur(mix(base, C['cream'], under), p), 0.0)


def add_face(model):
    C, face = S['colours'], S['face']
    _, _, head = centres()
    rx, ry, rz = S['skull']
    head_w = rigid('head')
    for side, sign in SIDES:
        eye, normal = eye_centre(sign)
        rot = Matrix((*frame(normal, v(1, 0, 0)),)).transposed()
        weight = rigid(f'eye.{side}')
        model.add(ellipsoid(eye + normal * -0.004, (0.034, 0.038, 0.017), rot, 18, 24),
                  lambda p, a: (*mix(C['eye'], C['iris'], 0.55 * smooth((-a[0].y - 0.15) / 0.7)), 0.0), weight)
        right, upward, _ = frame(normal, v(1, 0, 0))
        model.add(ellipsoid(eye + normal * 0.011 + right * -0.009 * sign + upward * 0.016, (0.0095, 0.0115, 0.006), rot, 8, 12), solid(C['shine']), weight)
        model.add(ellipsoid(eye + normal * 0.011 + right * 0.012 * sign + upward * -0.012, (0.004, 0.0045, 0.003), rot, 6, 8), solid(C['shine']), weight)
        bx, bz = 0.092 * sign, -0.04
        blush, bn = skull_point(bx, bz, 0.0)
        model.add(ellipsoid(blush, (0.027, 0.014, 0.005), Matrix((*frame(bn, v(1, 0, 0)),)).transposed() @ Euler((0, 0, 0)).to_matrix(), 5, 8), solid(C['blush']), head_w)
    if face in ('cat', 'panda'):
        puffs = []
        for sign in (-1, 1):
            puff, n = skull_point(0.036 * sign, -0.054, -0.012)
            puffs.append((puff, (0.056, 0.046, 0.044)))
            model.add(ellipsoid(puff, (0.056, 0.046, 0.044), None, 8, 12), lambda p, a: (*fur(C['cream'], p, 0.03), 0.0), head_w)
        chin, _ = skull_point(0.0, -0.086, -0.02)
        model.add(ellipsoid(chin, (0.05, 0.04, 0.028), None, 6, 10), solid(C['cream']), rigid('jaw'))
        nose = v(0.0, front_of(0.0, -0.022, puffs) - 0.004, head.z - 0.022)
        model.add(ellipsoid(nose, (0.021, 0.013, 0.014), Euler((0.25, 0, 0)).to_matrix(), 6, 8), solid(C['nose']), head_w)
        bottom = puffs[0][0].z - 0.02
        curve = [(-0.052, bottom + 0.012), (-0.036, bottom - 0.004), (-0.018, bottom + 0.0), (0.0, bottom + 0.016), (0.018, bottom + 0.0), (0.036, bottom - 0.004), (0.052, bottom + 0.012)]
        mouth = [v(x, front_of(x, z - head.z, puffs) - 0.001, z) for x, z in curve]
        model.add(tube(mouth, [0.0034] * len(mouth), 5), solid(C['mouth']), head_w)
        model.add(tube([nose + v(0, 0.004, -0.012), mouth[3] + v(0, 0.0, 0.002)], [0.003, 0.003], 5), solid(C['mouth']), head_w)
    if face == 'panda':
        for sign in (-1, 1):
            spot, n = skull_point(0.064 * sign, 0.062, 0.002)
            model.add(ellipsoid(spot, (0.026, 0.014, 0.006), Matrix((*frame(n, v(1, 0, 0)),)).transposed() @ Euler((0, 0, -0.25 * sign)).to_matrix(), 5, 8), solid(C['cream']), head_w)
            tear, n = skull_point(0.074 * sign, -0.03, 0.001)
            model.add(ellipsoid(tear, (0.024, 0.045, 0.006), Matrix((*frame(n, v(1, 0, 0)),)).transposed() @ Euler((0, 0, 0.35 * sign)).to_matrix(), 5, 8), solid(C['stripe']), head_w)
    if face in ('fox', 'dog'):
        long = 0.09 if face == 'dog' else 0.075
        snout, _ = skull_point(0.0, -0.05, -0.03)
        snout += v(0, -0.02, 0)
        snout_size = (0.074, long, 0.056) if face == 'dog' else (0.058, long, 0.045)
        model.add(ellipsoid(snout, snout_size, None, 10, 14), lambda p, a: (*fur(C['cream'], p, 0.03), 0.0), head_w)
        tip = snout + v(0, -snout_size[1] * 0.92, snout_size[2] * 0.55)
        model.add(ellipsoid(tip, (0.024 if face == 'dog' else 0.018, 0.016, 0.015), None, 6, 8), solid(C['nose']), head_w)
        chin = snout + v(0, -0.03, -snout_size[2] * 0.75)
        model.add(ellipsoid(chin, (snout_size[0] * 0.65, snout_size[1] * 0.55, 0.022), None, 6, 10), solid(C['cream']), rigid('jaw'))
        mouth_y = snout.y - snout_size[1] * 0.55
        mouth = [v(x, mouth_y + abs(x) * 0.6, snout.z - snout_size[2] * 0.62 - (0.008 if abs(x) < 0.02 and abs(x) > 0.005 else 0.0)) for x in (-0.03, -0.015, 0.0, 0.015, 0.03)]
        model.add(tube(mouth, [0.0036] * 5, 5), solid(C['mouth']), head_w)
        if face == 'dog':
            tongue = chin + v(0, -0.035, 0.0)
            model.add(ellipsoid(tongue, (0.022, 0.03, 0.01), None, 5, 8), solid(C['tongue']), rigid('jaw'))
    inside, _ = skull_point(0.0, -0.075, -0.035)
    model.add(ellipsoid(inside, (0.04, 0.03, 0.03), None, 6, 8), solid(C['mouth']), head_w)
    if S['coat'] == 'tabby':
        for x, z, h in ((0.0, 0.098, 0.034), (-0.036, 0.09, 0.026), (0.036, 0.09, 0.026)):
            mark, n = skull_point(x, z, -0.001)
            model.add(ellipsoid(mark, (0.009, h, 0.0025), Matrix((*frame(n, v(1, 0, 0)),)).transposed() @ Euler((0, 0, x * 4)).to_matrix(), 4, 6), solid(C['stripe']), head_w)
    if S['whiskers']:
        for sign in (-1, 1):
            root, _ = skull_point(0.05 * sign, -0.055, -0.004)
            for k, droop in enumerate((0.03, 0.0, -0.03)):
                points = [root + v(sign * 0.12 * s, -0.01 * s + 0.02 * s * s, droop * s - 0.012 * s * s + 0.01 * (k - 1) * 0.3) for s in (0.0, 0.33, 0.66, 1.0)]
                model.add(tube(points, [0.0024, 0.002, 0.0016, 0.001], 4), solid(mix(C['cream'], (1, 1, 1), 0.5)), head_w)


def add_ears(model):
    C, kind = S['colours'], S['ears']
    for side, sign in SIDES:
        base, axis, length = ear_frame(sign)
        weight = rigid(f'ear.{side}')
        outside = C.get('back', C['fur'])
        if kind == 'pointed':
            model.add(cone(base - axis * 0.02, axis, length + 0.02, 0.06, 0.5, v(1, 0, 0)), lambda p, a, o=outside: (*fur(mix(C['fur'], o, smooth((a[0].z + 0.2) / 0.6) * (1.0 if o is not C['fur'] else 0.0)), p), 0.0), weight)
            _, y_axis, _ = frame(axis, v(1, 0, 0))
            model.add(cone(base - axis * 0.004 - y_axis * 0.026, axis, length * 0.84, 0.042, 0.3, v(1, 0, 0)), solid(C['ear']), weight)
        elif kind == 'floppy':
            model.add(ellipsoid(base + axis * 0.07, (0.05, 0.024, 0.09), Matrix((*frame(axis, v(1, 0, 0)),)).transposed() @ Euler((0, 0, 0)).to_matrix() @ Matrix(((1, 0, 0), (0, 1, 0), (0, 0, 1))), 8, 12),
                      lambda p, a: (*fur(C['ear'], p), 0.0), weight)
        elif kind == 'long':
            rot = Matrix((*frame(axis, v(1, 0, 0)),)).transposed()
            model.add(ellipsoid(base + axis * 0.12, (0.042, 0.022, 0.13), rot, 10, 14), lambda p, a: (*fur(C['fur'], p), 0.0), weight)
            _, y_axis, _ = frame(axis, v(1, 0, 0))
            model.add(ellipsoid(base + axis * 0.125 - y_axis * 0.016, (0.025, 0.01, 0.1), rot, 8, 10), solid(C['ear']), weight)
        else:
            model.add(cone(base - axis * 0.015, axis, length + 0.015, 0.062, 0.55, v(1, 0, 0), 0.5), lambda p, a: (*fur(C['fur'], p), 0.0), weight)
            _, y_axis, _ = frame(axis, v(1, 0, 0))
            model.add(cone(base - y_axis * 0.028, axis, length * 0.8, 0.044, 0.3, v(1, 0, 0), 0.5), solid(C['ear']), weight)


def add_ribbon(model):
    if S['kind'] == 'wolf':
        return
    _, _, head = centres()
    weight = rigid('head')
    for sign in (-1, 1):
        loop = head + v(0.04 * sign, -0.112, -0.128)
        model.add(ellipsoid(loop, (0.05, 0.018, 0.029), Euler((0, 0.3 * sign, 0)).to_matrix(), 8, 12),
                  lambda p, a: (*(0.82 + 0.18 * smooth((a[0].z + 0.6) / 1.2),) * 3, 1 / 16), weight)
        end = head + v(0.022 * sign, -0.12, -0.152)
        model.add(ellipsoid(end, (0.012, 0.007, 0.022), Euler((0, 0.5 * sign, 0)).to_matrix(), 6, 8), solid((0.86, 0.86, 0.86), 1), weight)
    model.add(ellipsoid(head + v(0, -0.124, -0.13), (0.024, 0.022, 0.023), None, 6, 8), solid((0.78, 0.78, 0.78), 1), weight)


def add_ruff(model):
    C, amount = S['colours'], S['ruff']
    chest, neck, head = centres()
    if amount > 0:
        front = chest + v(0, -S['chest'][2] * 0.8, -0.01)
        weight = lambda p, a: chain_weights(p, ['chest', 'neck'], 4.0)
        for k in range(5):
            angle = (k - 2) / 2 * 0.9
            at = front + v(math.sin(angle) * 0.07, -0.03 * math.cos(angle), -0.05 + 0.025 * abs(math.sin(angle)))
            tilt = Euler((-0.5, 0, -angle * 0.5)).to_matrix()
            model.add(ellipsoid(at, (0.04 * amount ** 0.5, 0.03, 0.065 * amount ** 0.5), tilt, 8, 10), lambda p, a: (*fur(C['cream'], p, 0.03), 0.0), weight)
    tufts = S['tufts']
    if tufts > 0:
        rx, ry, rz = S['skull']
        tone = C['cream'] if S['coat'] in ('fox', 'panda') else mix(C['light'], C['cream'], 0.5)
        for sign in (-1, 1):
            for k, (z, y, size) in enumerate(((-0.035, 0.0, 1.0), (-0.075, 0.025, 0.8))):
                at = head + v(sign * rx * 0.86, y, z)
                tilt = Euler((0.0, sign * (0.9 + 0.35 * k), 0.0)).to_matrix()
                model.add(ellipsoid(at, (0.03 * tufts * size, 0.03, 0.05 * tufts * size), tilt, 8, 10), lambda p, a, tone=tone: (*fur(tone, p, 0.03), 0.0), rigid('head'))


def add_collar(model):
    C = S['colours']
    chest, neck, _ = centres()
    centre = neck + v(0, 0.01, -0.01)
    points = [centre + Euler((0.45, 0, 0)).to_matrix() @ v(math.cos(a) * 0.112, math.sin(a) * 0.1, 0) for a in [TAU * k / 18 for k in range(19)]]
    weight = lambda p, a: chain_weights(p, ['chest', 'neck'], 4.0)
    model.add(tube(points, [0.017] * len(points), 6), solid(C['collar']), weight)
    model.add(ellipsoid(centre + Euler((0.45, 0, 0)).to_matrix() @ v(0, -0.105, -0.03), (0.022, 0.008, 0.026), None, 5, 8), solid(C['tag']), weight)


def leg_tone():
    C = S['colours']
    return C.get('leg', C['light'])


def add_legs(model):
    C = S['colours']
    tone, paw_tone = leg_tone(), C.get('paw', C['cream'])
    for side, sign in SIDES:
        for kind, anchor in (('F', 'chest'), ('H', 'hips')):
            names = [f'{name}.{side}' for name in LEGS[kind]]
            _, _, _, _, _, r0, r1 = S['front' if kind == 'F' else 'hind']
            top, elbow, wrist, paw, toe = BONE[names[0]][0], BONE[names[1]][0], BONE[names[2]][0], BONE[names[3]][0], BONE[names[3]][1]
            path = [top + v(0, 0, 0.05), top, top.lerp(elbow, 0.5), elbow, elbow.lerp(wrist, 0.5), wrist, paw + v(0, 0, 0.004)]
            radii = [r0 * 1.15, r0 * 1.1, r0 * 1.02, (r0 + r1) / 2 * 1.06, r1 * 1.02, r1, r1 * 0.96]
            points, widths = [], []
            for i in range(len(path) - 1):
                for k in range(4):
                    s = k / 4
                    points.append(path[i].lerp(path[i + 1], s))
                    widths.append(radii[i] + (radii[i + 1] - radii[i]) * s)
            points.append(path[-1])
            widths.append(radii[-1])
            chain = names[:3]

            def weight(p, a, chain=chain, top=top, anchor=anchor):
                weights = chain_weights(p, chain, 6.0)
                lift = smooth((p.z - top.z + 0.01) / 0.05)
                if lift > 0:
                    weights = {k: w * (1 - lift) for k, w in weights.items()}
                    weights[anchor] = weights.get(anchor, 0.0) + lift
                return weights

            def colour(p, a, kind=kind):
                c = tone
                if S['coat'] in ('fox', 'panda'):
                    c = mix(C['fur'] if S['coat'] == 'fox' else C['leg'], tone, smooth((top.z - 0.04 - p.z) / 0.06))
                return (*fur(c, p), 0.0)
            model.add(tube(points, widths, 12), colour, weight)
            ahead = (toe - paw)
            ahead = v(ahead.x, ahead.y, 0).normalized()
            centre = paw + ahead * 0.016 + v(0, 0, -0.008)
            rot = Matrix((ahead.cross(v(0, 0, 1)), ahead, v(0, 0, 1))).transposed()
            paw_w = rigid(names[3])
            model.add(ellipsoid(centre, (r1 * 1.3, r1 * 1.55, 0.022), rot, 8, 12), lambda p, a: (*fur(paw_tone, p, 0.03), 0.0), paw_w)
            for k in (-1.5, -0.5, 0.5, 1.5):
                toe_at = centre + rot @ v(k * r1 * 0.52, r1 * (1.05 - 0.12 * abs(k)), 0.002)
                model.add(ellipsoid(toe_at, (r1 * 0.36, r1 * 0.4, 0.017), rot, 5, 8), lambda p, a: (*fur(paw_tone, p, 0.03), 0.0), paw_w)
                model.add(ellipsoid(toe_at + v(0, 0, -0.011), (r1 * 0.2, r1 * 0.22, 0.0055), rot, 4, 6), solid(C['bean']), paw_w)
            model.add(ellipsoid(centre + rot @ v(0, -r1 * 0.15, -0.0165), (r1 * 0.55, r1 * 0.45, 0.0065), rot, 5, 8), solid(C['bean']), paw_w)


def add_tail(model):
    C, style = S['colours'], S['tail_style']
    _, _, count, length, r0, r1 = S['tail']
    names = [f'tail{i + 1}' for i in range(count)]
    start, end = BONE[names[0]][0], BONE[names[-1]][1]
    if style == 'puff':
        centre = start + v(0, 0.035, 0.0)
        model.add(ellipsoid(centre, (0.072, 0.07, 0.07), None, 10, 14), lambda p, a: (*fur(C['cream'], p, 0.06, 40), 0.0), rigid(names[0]))
        return
    steps = count * 6
    points, widths = [], []
    for i in range(steps + 1):
        u = i / steps
        points.append(start.lerp(end, u))
        r = r0 + (r1 - r0) * u
        if style in ('bushy', 'wolf'):
            r *= 0.75 + 0.55 * math.sin(math.pi * min(1.0, u * 1.15)) ** 0.7
        r *= math.sqrt(max(0.0, 1 - smooth((u - 0.8) / 0.2) ** 2)) if style != 'plain' else math.sqrt(max(0.0, 1 - smooth((u - 0.75) / 0.25) ** 2))
        widths.append(max(0.004, r))
    tip = S['tip']

    def colour(p, a):
        u = a[1]
        segment = min(count - 1, int(u * count))
        c = C['fur']
        if style == 'tabby':
            c = mix(C['fur'], C['stripe'], (0.5 + 0.5 * math.cos(TAU * (u * count * 0.8))) ** 3 * 0.75)
        if style == 'ringed':
            c = mix(C['fur'], C['ring'], band((u * count) % 2.0, 1.5, 0.45, 0.2))
        if tip and u > 1 - tip / count:
            c = mix(c, C['cream'] if style != 'wolf' else C['tip'], smooth((u - (1 - tip / count)) / 0.06))
        return (*fur(c, p, 0.07, 26), 0.0)
    rough = 0.08 if style in ('bushy', 'wolf') else 0.02
    model.add(tube(points, widths, 14, rough, 4.0), colour, lambda p, a: chain_weights(p, names, 5.0))


def build_model():
    model = Model()
    model.add(torso_piece(), torso_colour, torso_weight)
    for side, sign in SIDES:
        haunch(model, side, sign)
    neck_top = BONE['neck'][1]

    def head_weight(p, a):
        share = 0.3 * smooth((neck_top.z - 0.06 - p.z) / 0.05) * smooth((p.y - neck_top.y + 0.03) / 0.05)
        return {'head': 1.0 - share, 'neck': share}
    model.add(orb(skull_shape, 28, 40), head_colour, head_weight)
    add_face(model)
    add_ears(model)
    add_ribbon(model)
    add_ruff(model)
    if S.get('collar'):
        add_collar(model)
    add_legs(model)
    add_tail(model)
    return model


class PetPoser(Poser):
    def frame_of(self, name):
        parent = self.bones[name].parent
        return (self.pose[parent.name] @ self.rest[parent.name].inverted()).to_3x3() if parent else Matrix.Identity(3)

    def settle(self, name, spin, offset=Z3):
        start = self.ident(name)
        head = start.translation.copy()
        final = Matrix.Translation(head + Vector(offset)) @ spin.to_4x4() @ Matrix.Translation(-head) @ start
        self.pose[name], self.basis[name] = final, start.inverted() @ final

    def turn(self, name, rotation=Z3, offset=Z3):
        frame = self.frame_of(name)
        self.settle(name, frame @ Euler(rotation, 'XYZ').to_matrix() @ frame.inverted(), frame @ Vector(offset))

    def swing(self, name, pitch, sway):
        across = self.frame_of(name) @ v(1, 0, 0)
        lift = Matrix.Rotation(pitch, 3, across)
        side = across.cross(lift @ self.ident(name).to_3x3().col[1]).normalized()
        self.settle(name, Matrix.Rotation(sway, 3, side) @ lift)

    def leg(self, upper, lower, low, paw, target, fold, flex, bend):
        frame = (self.pose['root'] @ self.rest['root'].inverted()).to_3x3()
        joint = self.head(upper)
        toward = frame.inverted() @ (joint - target).normalized()
        lean = v(0, 0, 1).lerp(toward, 0.55).normalized()
        c, s = math.cos(fold), math.sin(fold)
        lean = frame @ v(lean.x, lean.y * c - lean.z * s, lean.y * s + lean.z * c).normalized()
        knee_target = target + lean * self.length[low]
        l1, l2 = self.length[upper], self.length[lower]
        offset = knee_target - joint
        reach = offset.length
        if target.z < 0.06 and reach - (l1 + l2) > self.miss[0]:
            self.miss = (reach - (l1 + l2), upper, self.time)
        reach = max(abs(l1 - l2) + 1e-3, min(l1 + l2 - 1e-4, reach))
        along = offset.normalized()
        hint = frame @ v(0, bend, 0)
        across = hint - along * hint.dot(along)
        across = across.normalized() if across.length > 1e-6 else frame @ v(0, 0, -1)
        angle = math.acos(max(-1.0, min(1.0, (l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach))))
        first = along * math.cos(angle) + across * math.sin(angle)
        self.aim(upper, first)
        self.aim(lower, knee_target - (joint + first * l1))
        self.aim(low, target - self.head(low))
        rest = (BONE[paw][1] - BONE[paw][0]).normalized()
        c, s = math.cos(flex), math.sin(flex)
        self.aim(paw, frame @ v(rest.x, rest.y * c - rest.z * s, rest.y * s + rest.z * c))

    def scale(self, name, axis, amount):
        start = self.ident(name)
        local = start.to_3x3().inverted() @ Vector(axis)
        index = max(range(3), key=lambda i: abs(local[i]))
        size = [1.0, 1.0, 1.0]
        size[index] = amount
        final = start @ Matrix.Diagonal((*size, 1.0))
        self.pose[name], self.basis[name] = final, start.inverted() @ final

    def place(self, key, entry, anchor):
        target, fold, flex, carry, local = entry
        if carry:
            moved = self.pose[anchor] @ self.rest[anchor].inverted()
            target = target.lerp(moved @ (HOME[key] + local), carry)
        return target, fold, flex

    def evaluate(self, p):
        self.pose, self.basis = {}, {}
        self.turn('root', p['spin'], p['raise'])
        self.turn('hips', p['hips'], p['lift'])
        names = sorted((name for name in self.bones.keys() if name.startswith('tail')), key=lambda n: int(n[4:]))
        amp, phase = p['swish']
        for i, name in enumerate(names):
            sway = amp * math.sin(phase - i * 0.7) * (0.35 + 0.65 * (i + 1) / len(names))
            if i == 0:
                self.swing(name, p['tail'][0], p['tail'][1] + sway)
            else:
                self.swing(name, p['bend'] + (p['curl'] if i >= len(names) - 2 else 0.0), p['wrap'] + sway)
        self.turn('spine', p['spine'])
        self.turn('chest', p['chest'])
        self.turn('neck', p['neck'])
        self.turn('head', p['head'])
        self.turn('jaw', (p['jaw'], 0, 0))
        ex, ey, ez = p['ears']
        blink = self.frame_of('eye.L') @ v(0, 0, 1)
        for (side, sign), flick in zip(SIDES, p['flick']):
            self.turn(f'ear.{side}', (ex - 0.6 * flick, sign * (ey + 0.35 * flick), sign * ez))
            self.scale(f'eye.{side}', blink, max(0.08, p['eyes']))
        for side, sign in SIDES:
            front = self.place('F' + side, p['F' + side], 'chest')
            hind = self.place('H' + side, p['H' + side], 'hips')
            self.leg(f'arm.{side}', f'fore.{side}', f'wrist.{side}', f'pawF.{side}', front[0], front[1], front[2], 1.0)
            self.leg(f'thigh.{side}', f'shin.{side}', f'hock.{side}', f'pawH.{side}', hind[0], hind[1], hind[2], -1.0)
        return self.basis


def neutral():
    pitch, bend, curl = S['carriage']
    return {
        'spin': Z3, 'raise': Z3, 'hips': Z3, 'lift': Z3, 'spine': Z3, 'chest': Z3, 'neck': Z3, 'head': Z3, 'jaw': 0.0,
        'ears': Z3, 'flick': (0.0, 0.0), 'eyes': 1.0, 'tail': (pitch, 0.0), 'bend': bend, 'curl': curl, 'wrap': 0.0, 'swish': (0.0, 0.0),
        **{key: (HOME[key].copy(), FOLD[key], 0.0, 0.0, Vector()) for key in HOME},
    }


def tail(p, up=0.0, curl=0.0, bend=None, amp=0.0, phase=0.0, wrap=0.0, yaw=0.0):
    pitch, base_bend, base_curl = S['carriage']
    p['tail'] = (pitch + up, yaw)
    p['bend'] = base_bend if bend is None else bend
    p['curl'] = base_curl + curl
    p['swish'] = (amp, phase)
    p['wrap'] = wrap


def feet(p, offsets):
    for key, entry in offsets.items():
        dx, dy, dz, fold, flex, carry = (tuple(entry) + (0.0,) * 6)[:6]
        local = v(dx, dy, dz)
        p[key] = (HOME[key] + local, FOLD[key] + fold, flex, carry, local)


def gait_table(name):
    g = GAITS[name]
    root = math.sqrt(S['size'])
    return {'speed': g['speed'] / root, 'cycle': g['cycle'] * root, 'stance': g['stance']}


def gait(name, t, offsets, lift, fold_front, fold_hind, flex, axis=(0, 1, 0)):
    g = gait_table(name)
    cycle, stance = g['cycle'], g['stance']
    sweep = g['speed'] * cycle * stance
    phase = (t / cycle) % 1.0
    ax = Vector(axis)
    out = {}
    for key, offset in offsets.items():
        ph = (phase + offset) % 1.0
        front = key[0] == 'F'
        if ph < stance:
            u = ph / stance
            d, dz, fold, fl = -sweep / 2 + sweep * u, 0.0, 0.0, -0.25 * smooth((u - 0.7) / 0.3)
        else:
            u = (ph - stance) / (1.0 - stance)
            arc = math.sin(math.pi * u)
            d = sweep / 2 - sweep * smooth(u)
            dz = lift * arc
            fold = (fold_front if front else -fold_hind) * arc
            fl = flex * arc
        at = ax * d + v(0, 0, dz)
        out[key] = (at.x, at.y, at.z, fold, fl, 0.0)
    return phase, out


def length_of(name):
    return gait_table(name)['cycle']


WALK_FEET = {'HL': 0.0, 'FL': 0.75, 'HR': 0.5, 'FR': 0.25}
TROT_FEET = {'FL': 0.0, 'HR': 0.0, 'FR': 0.5, 'HL': 0.5}
GALLOP_FEET = {'HL': 0.0, 'HR': 0.08, 'FL': 0.45, 'FR': 0.53}
HOP_FEET = {'FL': 0.0, 'FR': 0.04, 'HL': 0.1, 'HR': 0.14}
LIMP_FEET = {'HR': 0.0, 'FR': 0.33, 'HL': 0.66}


def gait_clip(name, offsets, legs, body, axis=(0, 1, 0)):
    def clip(t):
        p = neutral()
        phase, f = gait(name, t, offsets, *legs, axis=axis)
        feet(p, f)
        body(p, phase)
        return p
    return clip, length_of(name)


def walk_body(p, phase):
    w = TAU * phase
    p['lift'] = (0, 0, -0.025 + 0.006 * math.cos(2 * w))
    p['hips'] = (0.01 * math.sin(2 * w), 0.03 * math.sin(w), 0.035 * math.sin(w))
    p['chest'] = (0.0, -0.02 * math.sin(w), -0.04 * math.sin(w))
    p['neck'] = (0.03 + 0.02 * math.sin(2 * w + 0.6), 0, 0.02 * math.sin(w))
    p['head'] = (-0.03 * math.sin(2 * w + 1.2), 0, -0.02 * math.sin(w))
    p['ears'] = (0.1, 0, 0)
    tail(p, amp=0.18, phase=w)


def trot_body(p, phase):
    w = TAU * phase
    p['lift'] = (0, 0, -0.045 + 0.01 * math.cos(2 * w))
    p['hips'] = (0.025 * math.sin(2 * w), 0.04 * math.sin(w), 0.0)
    p['chest'] = (-0.02 * math.sin(2 * w + 0.6), 0, 0)
    p['neck'] = (-0.02 + 0.03 * math.sin(2 * w + 0.8), 0, 0)
    p['head'] = (0.04, 0, 0)
    p['ears'] = (0.15, 0, 0)
    tail(p, up=-0.25, amp=0.12, phase=w)


def track_body(p, phase):
    trot_body(p, phase)
    w = TAU * phase
    p['neck'] = (0.3 + 0.03 * math.sin(2 * w), 0, 0)
    p['head'] = (0.2 + 0.05 * math.sin(4 * w), 0, 0)
    p['ears'] = (0.35, 0, 0)
    tail(p, up=0.1, amp=0.3, phase=2 * w)


def run_body(p, phase, low=0.0):
    w = TAU * phase
    p['lift'] = (0, 0.015 * math.sin(w), -0.04 - low + 0.025 * math.sin(w + 0.9))
    p['hips'] = (0.22 * math.sin(w + 0.4), 0, 0)
    p['spine'] = (-0.12 * math.sin(w + 1.4), 0, 0)
    p['chest'] = (0.1 * math.sin(w + 1.6), 0, 0)
    p['neck'] = (0.1 + 0.06 * math.sin(w + 2.0), 0, 0)
    p['head'] = (0.05 * math.sin(w + 2.4), 0, 0)
    p['ears'] = (-0.35 - low * 6, 0.1, 0)
    tail(p, up=max(-0.8 - low * 3, -0.12 - S['carriage'][0]), bend=0.0, curl=-S['carriage'][2], amp=0.1, phase=w)


def dash_body(p, phase):
    run_body(p, phase, 0.0)
    p['eyes'] = 0.8


def limp_body(p, phase):
    w = TAU * phase
    dip = math.exp(-((phase - 0.45) / 0.12) ** 2)
    p['lift'] = (0, 0, -0.02 - 0.025 * dip)
    p['hips'] = (0.02 * math.sin(w), 0.05, 0.0)
    p['chest'] = (0.06 * dip, -0.04, 0)
    p['neck'] = (0.25, 0, 0)
    p['head'] = (0.1 + 0.05 * dip, 0.1, 0)
    p['ears'] = (0.0, 0.5, 0.0)
    p['eyes'] = 0.8
    tail(p, up=-0.9, bend=0.0, curl=-S['carriage'][2])
    feet(p, {'FL': (0.0, 0.01, 0.065, 0.7, 1.1, 0.0)})


def swim_body(p, phase):
    w = TAU * phase
    p['hips'] = (-0.14, 0, 0.03 * math.sin(w))
    p['lift'] = (0, 0, 0.01 * math.sin(2 * w))
    p['neck'] = (-0.25, 0, 0)
    p['head'] = (-0.08, 0, 0.04 * math.sin(w))
    p['ears'] = (0.1, 0.1, 0)
    tail(p, up=-1.1, bend=0.0, curl=-S['carriage'][2], amp=0.25, phase=w)
    paddles = {}
    for key in HOME:
        ph = TAU * (phase + (0.0 if key in ('FL', 'HR') else 0.5))
        front = key[0] == 'F'
        paddles[key] = (0.0, (-0.03 if front else 0.03) + 0.05 * math.sin(ph), (0.07 if front else 0.05) + 0.035 * math.cos(ph), 0.5 if front else -0.2, 0.6 * (0.5 + 0.5 * math.cos(ph)), 1.0)
    feet(p, paddles)


def side_body(p, phase):
    g = gait_table('side')
    stance = g['stance']
    flight = max(0.0, (phase - stance) / (1 - stance))
    hop = math.sin(math.pi * flight) if phase > stance else 0.0
    p['lift'] = (0, 0, -0.02 + 0.05 * hop)
    p['hips'] = (-0.12, -0.08, 0.0)
    p['spine'] = (0.24, 0, 0)
    p['chest'] = (0.0, -0.04, 0)
    p['neck'] = (-0.1, 0, 0)
    p['head'] = (-0.05, 0.1, 0)
    p['ears'] = (0.2, 0, 0)
    tail(p, up=0.35, bend=0.04, amp=0.15, phase=TAU * phase)


def idle(t):
    p = neutral()
    w = TAU * t / 4.0
    p['lift'] = (0, 0, 0.004 * math.sin(2 * w))
    p['chest'] = (0.015 * math.sin(2 * w), 0, 0)
    p['neck'] = (0.02 * math.sin(w), 0, 0.12 * math.sin(w))
    p['head'] = (0.05 * math.sin(w + 1.0), 0.12 * math.sin(w + 0.3), 0.16 * math.sin(w + 0.4))
    gauss = lambda c, wd: math.exp(-((t - c) / wd) ** 2)
    p['flick'] = (gauss(1.3, 0.07) + 0.6 * gauss(3.1, 0.06), 0.7 * gauss(2.2, 0.07))
    tail(p, amp=0.25, phase=w)
    return p


def ready(t):
    p = neutral()
    w = TAU * t / 1.6
    p['lift'] = (0, 0, -0.045 + 0.003 * math.sin(2 * w))
    p['hips'] = (0.07, 0.05 * math.sin(2 * w) * max(0.0, math.sin(w)), 0)
    p['spine'] = (0.04, 0, 0)
    p['neck'] = (-0.05, 0, 0)
    p['head'] = (0.1, 0, 0.05 * math.sin(w))
    p['ears'] = (0.25, 0, 0)
    tail(p, up=-0.8, bend=0.02, curl=-S['carriage'][2] + 0.3, amp=0.35, phase=w * 2)
    feet(p, {'FL': (0.01, -0.03, 0), 'FR': (-0.01, -0.03, 0), 'HL': (0.012, 0.01, 0), 'HR': (-0.012, 0.01, 0)})
    return p


def sit(t):
    p = neutral()
    w = TAU * t / 3.0
    p['hips'] = (-0.7, 0, 0)
    p['lift'] = (0, 0.03, -0.055 + 0.003 * math.sin(w * 2))
    p['spine'] = (0.12, 0, 0)
    p['chest'] = (0.08, 0, 0)
    p['neck'] = (0.32, 0, 0.05 * math.sin(w))
    p['head'] = (0.18, 0.08 * math.sin(w + 1), 0.08 * math.sin(w))
    tail(p, up=0.3 - S['carriage'][0], bend=0.08, curl=-S['carriage'][2], wrap=0.42, amp=0.1, phase=w)
    feet(p, {'FL': (-0.012, -0.035, 0), 'FR': (0.012, -0.035, 0), 'HL': (0.03, -0.17, 0, -0.9, 0), 'HR': (-0.03, -0.17, 0, -0.9, 0)})
    return p


def sniff(t):
    p = neutral()
    w = TAU * t / 2.4
    p['lift'] = (0, 0, -0.01)
    p['chest'] = (0.06, 0, 0)
    p['neck'] = (0.32, 0, 0.1 * math.sin(w))
    p['head'] = (0.22 + 0.05 * math.sin(TAU * t * 5) * (0.5 + 0.5 * math.sin(w * 2)), 0, 0.1 * math.sin(w))
    p['ears'] = (0.3, 0, 0)
    tail(p, up=0.1, amp=0.2, phase=w)
    step = lambda a, b: smooth((t - a) / 0.3) - smooth((t - b) / 0.3)
    arc = lambda a: math.sin(math.pi * max(0.0, min(1.0, (t - a) / 0.3)))
    feet(p, {'FL': (0, -0.035 * step(0.6, 1.8), 0.025 * (arc(0.6) + arc(1.8)), 0.4 * (arc(0.6) + arc(1.8)), 0.4 * (arc(0.6) + arc(1.8)))})
    return p


def keyed(keys, foot_keys):
    def clip(t):
        p = neutral()
        for channel, ks in keys.items():
            if channel in ('tailup', 'curl', 'swish', 'wrap'):
                continue
            p[channel] = track(t, ks)
        if 'tailup' in keys or 'swish' in keys or 'wrap' in keys:
            amp, freq = track(t, keys['swish']) if 'swish' in keys else (0.0, 0.0)
            tail(p, up=track(t, keys['tailup']) if 'tailup' in keys else 0.0, curl=track(t, keys['curl']) if 'curl' in keys else 0.0,
                 amp=amp, phase=t * freq, wrap=track(t, keys['wrap']) if 'wrap' in keys else 0.0)
        feet(p, {key: track(t, [(time, tuple(value) + (0.0,) * (6 - len(value))) for time, value in ks]) for key, ks in foot_keys.items()})
        return p
    return clip


def point_clip():
    L = PET['point']
    held = [(0, Z6), (0.25, (0.0, 0.0, 0.07, 0.7, 1.1, 0.0)), (L - 0.3, (0.0, 0.0, 0.07, 0.7, 1.1, 0.0)), (L, Z6)]
    keys = {
        'lift': [(0, Z3), (0.25, (0, -0.02, -0.012)), (L - 0.3, (0, -0.02, -0.012)), (L, Z3)],
        'chest': [(0, Z3), (0.25, (0.05, 0, 0)), (L - 0.3, (0.05, 0, 0)), (L, Z3)],
        'neck': [(0, Z3), (0.25, (-0.06, 0, 0)), (L - 0.3, (-0.06, 0, 0)), (L, Z3)],
        'ears': [(0, Z3), (0.25, (0.38, 0, 0)), (L - 0.3, (0.38, 0, 0)), (L, Z3)],
        'tailup': [(0, 0.0), (0.25, -S['carriage'][0] + 0.12), (L - 0.3, -S['carriage'][0] + 0.12), (L, 0.0)],
        'curl': [(0, 0.0), (0.25, -S['carriage'][2]), (L - 0.3, -S['carriage'][2]), (L, 0.0)],
        'swish': [(0, (0.0, 0.0)), (0.25, (0.06, 18.0)), (L, (0.06, 18.0))],
    }
    return keyed(keys, {'FL': held}), L


def dig_clip():
    L = 0.5

    def clip(t):
        p = neutral()
        w = TAU * t / L
        p['lift'] = (0, 0, -0.02)
        p['hips'] = (0.2, 0.03 * math.sin(w), 0)
        p['chest'] = (0.1, 0, 0)
        p['neck'] = (0.22, 0, 0)
        p['head'] = (0.12 + 0.05 * math.sin(2 * w), 0, 0)
        p['ears'] = (0.1, 0.1, 0)
        tail(p, up=0.1, amp=0.35, phase=2 * w)
        scrape = {}
        for key, offset in (('FL', 0.0), ('FR', 0.5)):
            ph = (t / L + offset) % 1.0
            if ph < 0.5:
                u = ph / 0.5
                scrape[key] = (0.0, -0.06 + 0.12 * u, 0.0, 0.0, -0.2, 0.0)
            else:
                u = (ph - 0.5) / 0.5
                scrape[key] = (0.0, 0.06 - 0.12 * smooth(u), 0.04 * math.sin(math.pi * u), 0.6 * math.sin(math.pi * u), 0.8 * math.sin(math.pi * u), 0.0)
        scrape['HL'] = (0.012, 0.03, 0)
        scrape['HR'] = (-0.012, 0.03, 0)
        feet(p, scrape)
        return p
    return clip, L


def pat_clip():
    L = PET['pat']

    def clip(t):
        p = neutral()
        on = smooth(t / 0.25) * (1 - smooth((t - L + 0.25) / 0.25))
        w = TAU * t / L
        p['lift'] = (0, 0, 0.012 * on)
        p['hips'] = (0, 0.06 * math.sin(w * 2) * on, 0)
        p['chest'] = (-0.08 * on, 0, 0.05 * math.sin(w * 2) * on)
        p['neck'] = (-0.32 * on, 0, 0.08 * math.sin(w * 2) * on)
        p['head'] = (-0.22 * on, 0.18 * math.sin(w * 2) * on, 0.06 * math.sin(w * 2) * on)
        p['ears'] = (-0.1 * on, 0.35 * on, 0)
        p['eyes'] = 1 - 0.9 * on
        tail(p, up=0.25 * on, curl=0.6 * on, amp=0.18 * on, phase=w * 2)
        return p
    return clip, L


def pounce_clip():
    a = ATTACKS['pounce']
    T, A, R = a['windup'], a['active'], a['recover']
    E = T + A + R

    def wiggle(t):
        return 0.09 * math.sin(TAU * t * 7) * smooth(t / 0.08) * (1 - smooth((t - T + 0.04) / 0.04))
    keys = {
        'lift': [(0, Z3), (T * 0.6, (0, 0.02, -0.055)), (T, (0, 0.03, -0.065)), (T + A * 0.5, (0, 0, 0.02)), (T + A, (0, -0.02, -0.055)), (T + A + 0.15, (0, 0, -0.03)), (E, Z3)],
        'raise': [(0, Z3), (T, Z3), (T + A * 0.5, (0, 0, 0.3)), (T + A, Z3), (E, Z3)],
        'hips': [(0, Z3), (T, (0.14, 0, 0)), (T + A * 0.3, (-0.28, 0, 0)), (T + A * 0.8, (0.22, 0, 0)), (T + A + 0.1, (0.1, 0, 0)), (E, Z3)],
        'spine': [(0, Z3), (T, (0.06, 0, 0)), (T + A * 0.4, (-0.12, 0, 0)), (T + A, (0.1, 0, 0)), (E, Z3)],
        'neck': [(0, Z3), (T, (0.08, 0, 0)), (T + A * 0.4, (-0.22, 0, 0)), (T + A, (0.18, 0, 0)), (E, Z3)],
        'head': [(0, Z3), (T, (0.05, 0, 0)), (T + A, (0.1, 0, 0)), (E, Z3)],
        'jaw': [(0, 0.0), (T, 0.0), (T + A * 0.5, 0.38), (T + A + 0.1, 0.1), (E, 0.0)],
        'ears': [(0, Z3), (T, (0.38, 0, 0)), (T + A, (0.2, 0.1, 0)), (E, Z3)],
        'eyes': [(0, 1.0), (T, 1.0), (T + A * 0.4, 1.1), (T + A, 0.6), (T + A + 0.2, 1.0), (E, 1.0)],
        'tailup': [(0, 0.0), (T, -0.7), (T + A * 0.5, -0.3), (T + A, -0.5), (E, 0.0)],
        'swish': [(0, (0.0, 0.0)), (T * 0.5, (0.12, 30.0)), (T, (0.0, 30.0)), (E, (0.0, 30.0))],
    }
    front = [(0, Z6), (T * 0.9, (0, 0.01, 0, 0, 0, 0)), (T + 0.05, (0, -0.02, 0.05, 0.4, 0.5, 1)), (T + A * 0.5, (0, -0.13, 0.1, -0.4, -0.5, 1)),
             (T + A - 0.03, (0, -0.08, 0.02, 0, 0, 0.5)), (T + A, (0, -0.06, 0, 0, 0, 0)), (E, Z6)]
    hind = [(0, Z6), (T, (0, 0.0, 0, 0, 0, 0)), (T + 0.06, (0, 0.03, 0.0, 0, -0.4, 0.4)), (T + A * 0.5, (0, 0.09, 0.05, 0.3, -0.6, 1)),
            (T + A - 0.02, (0, -0.02, 0.02, 0, 0, 0.6)), (T + A + 0.04, (0, -0.03, 0, 0, 0, 0)), (E, Z6)]
    base = keyed(keys, {'FL': front, 'FR': front, 'HL': hind, 'HR': hind})

    def clip(t):
        p = base(t)
        h = p['hips']
        p['hips'] = (h[0], h[1] + wiggle(t), h[2])
        return p
    return clip, E


def swipe_clip():
    a = ATTACKS['swipe']
    T, A, R = a['windup'], a['active'], a['recover']
    E = T + A + R
    keys = {
        'hips': [(0, Z3), (T, (-0.3, 0, 0)), (T + A, (-0.2, 0.06, 0.12)), (T + A + 0.12, (-0.1, 0, 0.05)), (E, Z3)],
        'lift': [(0, Z3), (T, (0, 0.02, 0.02)), (T + A, (0, -0.01, 0.0)), (E, Z3)],
        'chest': [(0, Z3), (T, (-0.08, 0, -0.08)), (T + A, (0.04, 0, 0.18)), (E, Z3)],
        'neck': [(0, Z3), (T, (0.12, 0, -0.1)), (T + A, (0.05, 0, 0.12)), (E, Z3)],
        'head': [(0, Z3), (T, (0.0, 0.05, 0)), (T + A, (0.05, -0.08, 0.15)), (E, Z3)],
        'jaw': [(0, 0.0), (T, 0.3), (T + A, 0.32), (T + A + 0.15, 0.05), (E, 0.0)],
        'ears': [(0, Z3), (T, (-0.5, 0.35, 0)), (T + A + 0.1, (-0.4, 0.3, 0)), (E, Z3)],
        'eyes': [(0, 1.0), (T, 0.72), (T + A + 0.1, 0.75), (E, 1.0)],
        'tailup': [(0, 0.0), (T, 0.2), (E, 0.0)],
        'swish': [(0, (0.0, 20.0)), (T, (0.35, 20.0)), (E, (0.0, 20.0))],
    }
    paw = [(0, Z6), (T * 0.6, (-0.03, -0.01, 0.1, 0.9, 1.0, 1)), (T, (-0.07, -0.03, 0.15, 0.9, 1.2, 1)), (T + A * 0.5, (0.0, -0.13, 0.12, 0.2, 0.2, 1)),
           (T + A, (0.09, -0.11, 0.05, 0.0, -0.2, 1)), (T + A + 0.14, (0.04, -0.04, 0.03, 0.4, 0.5, 0.6)), (E, Z6)]
    return keyed(keys, {'FR': paw, 'FL': [(0, Z6), (T, (0.01, -0.02, 0.035, 0.4, 0.4, 0.7)), (T + A + 0.1, (0.01, -0.02, 0.02, 0.2, 0.2, 0.4)), (E, Z6)]}), E


def spin_clip():
    a = ATTACKS['spin']
    T, A, R = a['windup'], a['active'], a['recover']
    E = T + A + R
    turns = a['ticks']

    def ramp(u):
        if u <= 0:
            return 0.0
        if u >= 1:
            return 1.0
        edge = 0.12
        speed = 1 / (1 - edge)
        if u < edge:
            return speed * u * u / (2 * edge)
        if u > 1 - edge:
            return 1 - speed * (1 - u) ** 2 / (2 * edge)
        return speed * (u - edge / 2)

    def clip(t):
        p = neutral()
        curl = smooth(t / T) * (1 - smooth((t - T - A) / 0.18))
        u = (t - T) / A
        p['spin'] = (0, 0, TAU * turns * ramp(u))
        p['raise'] = (0, 0, 0.045 * math.sin(math.pi * max(0.0, min(1.0, u))))
        p['lift'] = (0, 0, -0.03 * curl)
        p['hips'] = (0.3 * curl, 0, 0)
        p['spine'] = (0.12 * curl, 0, 0)
        p['chest'] = (0.1 * curl, 0, 0)
        p['neck'] = (0.05 * curl, 0, 0)
        p['head'] = (0.12 * curl, 0, 0)
        p['ears'] = (-0.5 * curl, 0.2 * curl, 0)
        dizzy = smooth((t - T - A) / 0.1) * (1 - smooth((t - E + 0.12) / 0.12))
        ring = TAU * 2.2 * (t - T - A)
        if dizzy > 0:
            p['head'] = (p['head'][0] + 0.12 * math.sin(ring) * dizzy, 0.22 * math.cos(ring) * dizzy, 0.15 * math.sin(ring) * dizzy)
            p['hips'] = (p['hips'][0], 0.06 * math.sin(ring + 1.0) * dizzy, 0)
            p['ears'] = (0.0, 0.45 * dizzy, 0)
        p['eyes'] = 1 - 0.85 * max(curl * smooth((t - T) / 0.06), dizzy * 0.8)
        tail(p, up=-0.9 * curl, bend=0.1 * curl + S['carriage'][1] * (1 - curl), curl=-S['carriage'][2] * curl, wrap=0.5 * curl)
        tuck = curl
        feet(p, {'FL': (-0.02 * tuck, 0.04 * tuck, 0.06 * tuck, 0.8 * tuck, 0.8 * tuck, tuck), 'FR': (0.02 * tuck, 0.04 * tuck, 0.06 * tuck, 0.8 * tuck, 0.8 * tuck, tuck),
                 'HL': (-0.02 * tuck, -0.05 * tuck, 0.06 * tuck, -0.6 * tuck, 0.6 * tuck, tuck), 'HR': (0.02 * tuck, -0.05 * tuck, 0.06 * tuck, -0.6 * tuck, 0.6 * tuck, tuck)})
        return p
    return clip, E


def evade_clip():
    H = PET['hop']
    E = H + 0.15

    def clip(t):
        p = neutral()
        crouch = smooth(t / 0.06) * (1 - smooth((t - 0.06) / 0.06))
        u = max(0.0, min(1.0, (t - 0.06) / (H - 0.06)))
        air = math.sin(math.pi * u) if 0.0 < u < 1.0 else 0.0
        arch = smooth(t / 0.1) * (1 - smooth((t - H) / 0.15))
        land = math.exp(-((t - H - 0.02) / 0.05) ** 2)
        p['raise'] = (0, 0, 0.2 * air)
        p['lift'] = (0, 0, -0.04 * crouch - 0.035 * land)
        p['hips'] = (-0.22 * arch, 0, 0)
        p['spine'] = (0.42 * arch, 0, 0)
        p['chest'] = (0.08 * arch, 0, 0)
        p['neck'] = (-0.3 * arch, 0, 0)
        p['head'] = (-0.05 * arch, 0, 0)
        p['ears'] = (-0.45 * arch, 0.2 * arch, 0)
        p['eyes'] = 1 + 0.12 * arch
        p['jaw'] = 0.12 * arch
        tail(p, up=0.45 * arch, bend=S['carriage'][1] * (1 - arch), curl=-S['carriage'][2] * arch)
        carry = smooth((t - 0.05) / 0.03) * (1 - smooth((t - H + 0.02) / 0.04))
        feet(p, {key: (0.0, 0.0, 0.015 * air, 0.0, 0.3 * air, carry) for key in HOME})
        return p
    return clip, E


def hurt_clip():
    L = PET['hurt']
    keys = {
        'lift': [(0, Z3), (0.08, (0, 0.05, -0.04)), (0.3, (0, 0.02, -0.03)), (L, (0, 0, -0.02))],
        'hips': [(0, Z3), (0.08, (0.1, 0.12, 0)), (L, Z3)],
        'chest': [(0, Z3), (0.08, (-0.25, 0, 0)), (L, Z3)],
        'neck': [(0, Z3), (0.08, (-0.3, 0, 0.2)), (L, Z3)],
        'head': [(0, Z3), (0.08, (-0.2, 0.25, 0.3)), (L, Z3)],
        'ears': [(0, Z3), (0.08, (-0.7, 0.4, 0)), (0.35, (-0.4, 0.3, 0)), (L, Z3)],
        'eyes': [(0, 1.0), (0.06, 0.1), (0.3, 0.2), (L, 1.0)],
        'jaw': [(0, 0.0), (0.08, 0.28), (0.3, 0.1), (L, 0.0)],
        'tailup': [(0, 0.0), (0.08, -0.6), (L, -0.3)],
    }
    return keyed(keys, {}), L


def out_clip():
    L = PET['out']

    def clip(t):
        p = neutral()
        fall = smooth(t / 0.35) * (1 - smooth((t - 1.3) / 0.5))
        theta = 1.45 * fall
        spine = S['spine']
        p['spin'] = (0, theta, 0)
        p['raise'] = (-spine * math.sin(theta), 0, 0.15 * math.sin(theta))
        breath = 0.006 * math.sin(TAU * t / 1.2) * fall
        p['lift'] = (0, 0, breath)
        p['neck'] = (0.15 * fall, 0, -0.25 * fall)
        p['head'] = (0.1 * fall, 0.3 * fall, -0.2 * fall)
        p['ears'] = (-0.2 * fall, 0.5 * fall, 0)
        p['eyes'] = 1 - 0.92 * fall
        p['jaw'] = 0.12 * fall
        tail(p, up=-1.0 * fall, bend=S['carriage'][1] * (1 - fall), curl=-S['carriage'][2] * fall)
        up = smooth((t - 1.3) / 0.5)
        flop = fall
        feet(p, {'FL': (0.02 * flop, -0.03 * flop, 0.065 * up, 0.7 * up, 1.1 * up + 0.4 * flop, flop),
                 'FR': (-0.02 * flop, -0.04 * flop, 0.0, 0.3 * flop, 0.4 * flop, flop),
                 'HL': (0.02 * flop, 0.04 * flop, 0.0, -0.2 * flop, 0.4 * flop, flop),
                 'HR': (-0.02 * flop, 0.05 * flop, 0.0, -0.2 * flop, 0.4 * flop, flop)})
        return p
    return clip, L


def bow_clip():
    L = WOLF['bow']

    def clip(t):
        p = neutral()
        down = smooth(t / 0.45) * (1 - smooth((t - L + 0.45) / 0.45))
        bounce = 0.5 + 0.5 * math.sin(TAU * t * 2.2)
        p['hips'] = (0.32 * down, 0, 0)
        p['lift'] = (0, 0, -0.015 * down - 0.01 * bounce * down)
        p['spine'] = (0.1 * down, 0, 0)
        p['neck'] = (-0.5 * down, 0, 0)
        p['head'] = (-0.25 * down, 0.15 * down * math.sin(TAU * t * 0.7), 0)
        p['ears'] = (0.3 * down, 0, 0)
        p['jaw'] = 0.22 * down
        tail(p, up=0.6 * down, amp=0.5 * down, phase=TAU * t * 5)
        feet(p, {'FL': (0.01, -0.13 * down, 0, -0.3 * down, -0.2 * down), 'FR': (-0.01, -0.13 * down, 0, -0.3 * down, -0.2 * down)})
        return p
    return clip, L


def blink_clip():
    L = 0.2

    def clip(t):
        p = neutral()
        p['eyes'] = 1 - 0.92 * math.sin(math.pi * min(1.0, t / L))
        return p
    return clip, L


def mirrored(fn):
    def clip(t):
        p = fn(t)
        out = dict(p)
        for key in ('hips', 'spine', 'chest', 'neck', 'head', 'spin'):
            x, y, z = p[key]
            out[key] = (x, -y, -z)
        for key in ('lift', 'raise'):
            x, y, z = p[key]
            out[key] = (-x, y, z)
        out['tail'] = (p['tail'][0], -p['tail'][1])
        out['swish'] = (-p['swish'][0], p['swish'][1])
        out['wrap'] = -p['wrap']
        out['flick'] = (p['flick'][1], p['flick'][0])
        for a, b in (('FL', 'FR'), ('FR', 'FL'), ('HL', 'HR'), ('HR', 'HL')):
            target, fold, flex, carry, local = p[a]
            out[b] = (v(-target.x, target.y, target.z), fold, flex, carry, v(-local.x, local.y, local.z))
        return out
    return clip


def clips():
    side_left, side_length = gait_clip('side', HOP_FEET, (0.05, 0.6, 0.6, 0.6), side_body, axis=(-1, 0, 0))
    out = [
        ('idle', idle, 4.0),
        ('ready', ready, 1.6),
        ('walk', *gait_clip('walk', WALK_FEET, (0.035, 0.9, 0.8, 0.9), walk_body)),
        ('trot', *gait_clip('trot', TROT_FEET, (0.05, 1.1, 1.0, 1.0), trot_body)),
        ('run', *gait_clip('run', GALLOP_FEET, (0.07, 1.3, 1.2, 1.2), run_body)),
        ('dash', *gait_clip('dash', GALLOP_FEET, (0.06, 1.3, 1.2, 1.2), dash_body)),
        ('track', *gait_clip('track', TROT_FEET, (0.045, 1.0, 0.9, 0.9), track_body)),
        ('limp', *gait_clip('limp', LIMP_FEET, (0.04, 0.8, 0.7, 0.8), limp_body)),
        ('swim', *gait_clip('swim', {}, (0.0, 0.0, 0.0, 0.0), swim_body)),
        ('side-left', side_left, side_length),
        ('side-right', mirrored(side_left), side_length),
        ('sit', sit, 3.0),
        ('sniff', sniff, 2.4),
    ]
    for name, maker in (('point', point_clip), ('dig', dig_clip), ('pat', pat_clip), ('pounce', pounce_clip), ('swipe', swipe_clip), ('spin', spin_clip),
                        ('evade', evade_clip), ('hurt', hurt_clip), ('out', out_clip), ('bow', bow_clip), ('blink', blink_clip)):
        fn, length = maker()
        out.append((name, fn, length))
    return out


def preview(mesh, model):
    attribute = mesh.color_attributes.new('Preview', 'FLOAT_COLOR', 'POINT')
    flat = []
    for c in model.colours:
        rgb = tuple(HONEY[k] * c[k] for k in range(3)) if round(c[3] * 16) == 1 else c[:3]
        flat += [*to_linear(rgb), 1.0]
    attribute.data.foreach_set('color', flat)
    mesh.color_attributes.active_color = attribute


POSES = [('idle', 1.3), ('sit', 1.0), ('trot', 0.05), ('run', 0.1), ('pounce', 0.2), ('pounce', 0.5), ('swipe', 0.2), ('swipe', 0.28), ('spin', 0.5), ('evade', 0.2),
         ('hurt', 0.08), ('out', 1.0), ('pat', 0.8), ('point', 1.5), ('dig', 0.2), ('sniff', 1.0), ('side-left', 0.2), ('limp', 0.1), ('swim', 0.1), ('bow', 1.0), ('ready', 0.4)]


def render(scene, rig, kind, folder):
    size = S['size']
    shoot = studio(scene, 640, 85, 3 * size)
    target = v(0, -0.05, 0.3) * size
    views = {'front': (0, -2.7, 0.5), 'side': (2.7, -0.05, 0.42), 'back': (0, 2.7, 0.55), 'three-quarter': (1.9, -1.95, 0.7)}
    rig.animation_data.action = bpy.data.actions['idle']
    scene.frame_set(0)
    for name, location in views.items():
        shoot(folder, f'{kind}-{name}', v(*location) * size, target)
    shoot(folder, f'{kind}-face', v(0.3, -1.25, 0.55) * size, v(0, -0.33, 0.45) * size)
    if '--poses' in ARGS or kind == 'cat':
        for name, seconds in POSES:
            rig.animation_data.action = bpy.data.actions[name]
            scene.frame_set(round(seconds * scene.render.fps))
            shoot(folder, f'{kind}-pose-{name}-{seconds}', v(2.0, -1.8, 0.8) * size, target)
        rig.animation_data.action = None


def main():
    summary = {}
    for kind in KINDS:
        S.clear()
        S.update(SPECIES[kind], kind=kind)
        scene = reset(RATE)
        bones = skeleton()
        BONE.clear()
        BONE.update({name: (Vector(head), Vector(tail_), parent) for name, head, tail_, parent, _ in bones})
        HOME.clear()
        HOME.update({key[0] + side: BONE[f"{'pawF' if key == 'F' else 'pawH'}.{side}"][0].copy() for key in ('F', 'H') for side, _ in SIDES})
        rig = make_armature(scene, f'{kind}-rig', bones)
        model = build_model()
        mesh = make_mesh(scene, kind, model, rig, ('Body',), [name for name, *_ in bones])
        report = bake(rig, PetPoser(rig), clips(), located=('root', 'hips'), scaled=('eye.L', 'eye.R'))
        rig.scale = (S['size'],) * 3
        path = os.path.join(OUT, f'{kind}.glb')
        export(path, rig, [mesh])
        summary[kind] = {'vertices': len(model.verts), 'triangles': sum(len(f) - 2 for f in model.faces), 'bytes': os.path.getsize(path),
                         'short': {name: entry['short'] for name, entry in report.items() if entry['short'][0] > 0.004}}
        if RENDERS:
            preview(mesh.data, model)
            render(scene, rig, kind, RENDERS)
    print('PETS', json.dumps(summary))


main()
