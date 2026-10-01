import math
import bmesh
import kit
from plant import leaf
from kit import Frame, cushion, cylinder, lathe, rbox, rod, sphere, torus, tube

WOOD, EDGE, DARK, BRASS, SAGE, PAPER = '#aa7954', '#bc9169', '#73533d', '#b99a6e', '#83968a', '#f2ead5'
BOOKS = ['#6b7a5c', '#9c5f46', '#5f6a68']
WALNUT, LEATHER, LAPTOP_BRASS, GILT, RIBBON, INK = '#6e5444', '#776050', '#c2a274', '#cdb07e', '#9a5a4a', '#4d4744'
EYE = (0.25, 0.9, 1.0)
SHADE_FOLD, SHADE_TRIM = '#eeb26a', '#8e6048'
KEY_TOP, KEY_SKIRT, KEY_SHADOW = '#f4ecd8', '#d8caa9', '#22170f'
KEY_ROWS = ([1] * 11 + [2], [1.5] + [1] * 10 + [1.5], [1.75] + [1] * 9 + [2.25], [2.25] + [1] * 8 + [2.75], [1, 1, 1.25, 6.5, 1.25, 1, 1])


def turned_leg(x, z, top, colour):
    profile = [(0.0, 0.0), (0.05, 0.0), (0.066, 0.03), (0.07, 0.07), (0.055, 0.1), (0.045, 0.16), (0.052, 0.2), (0.06, 0.24),
               (0.052, 0.28), (0.04, 0.36), (0.034, 0.55), (0.036, 0.7), (0.05, 0.76), (0.058, 0.8), (0.05, 0.84), (0.046, top - 0.2), (0.0, top - 0.2)]
    leg = lathe(profile, (x, 0.012, z), colour, segments=20, surface='wood')
    block = rbox([0.12, 0.2, 0.12], (x, 0.012 + top - 0.1, z), colour, bevel=0.012, surface='wood')
    return [leg, block]


def desk(width=3.0, timber=WOOD, legs=DARK, front=EDGE):
    parts = []
    depth, top_y, back, planks = 1.10, 1.18, -1.02, 4
    for i in range(planks):
        span = depth / planks
        parts.append(rbox([width, 0.1, span - 0.006], (0, top_y + 0.02, back + span * (i + 0.5)), timber, bevel=0.018, surface='wood', dice=0.25))
    parts.append(rbox([width - 0.06, 0.05, depth - 0.06], (0, top_y - 0.055, back + depth / 2), legs, bevel=0.02, surface='wood'))
    parts.append(rbox([width + 0.02, 0.022, 0.03], (0, top_y + 0.04, back + depth + 0.004), front, bevel=0.01, surface='wood'))
    for side in (-1, 1):
        for z in (-0.89, -0.05):
            parts += turned_leg(side * (width / 2 - 0.18), z, 1.12, legs)
        parts.append(rbox([0.05, 0.12, 0.72], (side * (width / 2 - 0.18), 0.98, -0.47), legs, bevel=0.012, surface='wood'))
        parts.append(rod((side * (width / 2 - 0.18), 0.22, -0.86), (side * (width / 2 - 0.18), 0.22, -0.08), 0.022, legs, surface='wood'))
    parts.append(rbox([width - 0.44, 0.12, 0.04], (0, 0.98, -0.93), legs, bevel=0.012, surface='wood'))
    parts.append(rod((-(width / 2 - 0.18), 0.22, -0.47), ((width / 2 - 0.18), 0.22, -0.47), 0.02, legs, surface='wood'))
    x = -width / 2 + 0.5
    parts.append(rbox([0.75, 0.24, 0.84], (x, 0.99, -0.45), timber, bevel=0.02, surface='wood'))
    parts.append(rbox([0.66, 0.18, 0.03], (x, 0.99, -0.02), front, bevel=0.012, surface='wood'))
    parts.append(rbox([0.56, 0.11, 0.02], (x, 0.99, 0.0), timber, bevel=0.018, surface='wood'))
    parts.append(rbox([0.16, 0.05, 0.008], (x, 1.0, 0.012), BRASS, bevel=0.004, surface='metal', layer='metal'))
    parts.append(torus(0.045, 0.009, (x, 0.985, 0.03), BRASS, rotation=(0, 0, 0), arc=math.pi, major_segments=16, surface='metal', layer='metal'))
    for dx in (-0.06, 0.06):
        parts.append(cylinder(0.008, 0.008, 0.012, (x + dx, 1.0, 0.018), BRASS, segments=10, surface='metal', layer='metal', rotation=(math.pi / 2, 0, 0)))
    return parts


def chair(cloth=SAGE, frame_wood=DARK, arm=WOOD):
    f = Frame((0, 0, 0.52))
    parts = []
    parts += cushion([0.84, 0.14, 0.78], (0, 0.66, 0), cloth, puff=0.45, frame=f, tufts=(2, 2), button='#6f8276', piping='#d9c9a6')
    parts.append(rbox([0.9, 0.08, 0.84], (0, 0.56, 0), frame_wood, bevel=0.02, surface='wood', frame=f))
    parts += cushion([0.8, 0.12, 0.56], (0, 0.99, 0.37), cloth, puff=0.35, frame=f, rotation=(-(math.pi / 2 - 0.1), 0, 0), tufts=(3, 2), button='#6f8276', piping='#d9c9a6')
    parts.append(rbox([0.92, 0.07, 0.09], (0, 1.3, 0.43), frame_wood, bevel=0.03, surface='wood', frame=f))
    for x in (-0.43, 0.43):
        parts.append(rod((x, 0.58, 0.4), (x, 1.3, 0.44), 0.028, frame_wood, surface='wood', frame=f))
    for x in (-0.32, 0.32):
        for z in (-0.28, 0.28):
            profile = [(0.0, 0.0), (0.034, 0.0), (0.042, 0.03), (0.036, 0.08), (0.03, 0.3), (0.036, 0.42), (0.044, 0.46), (0.04, 0.52), (0.0, 0.52)]
            parts.append(lathe(profile, (x * 1.12, 0.012, z * 1.15), frame_wood, segments=16, surface='wood', frame=f))
    for x in (-0.42, 0.42):
        parts.append(rod((x, 0.6, 0.2), (x, 0.94, 0.2), 0.03, frame_wood, surface='wood', frame=f))
        parts.append(rod((x, 0.6, -0.22), (x, 0.94, -0.2), 0.026, frame_wood, surface='wood', frame=f))
        parts.append(rbox([0.1, 0.06, 0.56], (x, 0.97, 0.0), arm, bevel=0.028, surface='wood', frame=f))
        parts.append(sphere((0.05, 0.035, 0.05), (x, 0.975, -0.28), arm, surface='wood', frame=f))
    return parts


def laptop():
    f = Frame((0, 1.29, -0.43))
    parts = [rbox([0.97, 0.04, 0.62], (0, 0, 0), WALNUT, bevel=0.03, surface='wood', frame=f, dice=0.06),
             rbox([0.72, 0.006, 0.26], (0, 0.021, -0.07), '#3d2b22', bevel=0.004, frame=f),
             rbox([0.29, 0.003, 0.15], (0, 0.0205, 0.19), LAPTOP_BRASS, bevel=0.006, surface='metal', layer='metal', frame=f),
             rbox([0.27, 0.004, 0.13], (0, 0.021, 0.19), LEATHER, bevel=0.01, surface='cloth', frame=f),
             rbox([0.9, 0.009, 0.006], (0, -0.006, 0.311), LAPTOP_BRASS, bevel=0.002, surface='metal', layer='metal', frame=f)]
    for x in (-1, 1):
        parts.append(rbox([0.006, 0.009, 0.52], (x * 0.486, -0.006, 0.0), LAPTOP_BRASS, bevel=0.002, surface='metal', layer='metal', frame=f))
    for x in (-1, 1):
        parts.append(rbox([0.06, 0.044, 0.06], (x * 0.457, 0, 0.282), LAPTOP_BRASS, bevel=0.018, surface='metal', layer='metal', frame=f))
    parts.append(rod((-0.4, 0.024, -0.3), (0.4, 0.024, -0.3), 0.017, LAPTOP_BRASS, sides=16, surface='metal', layer='metal', frame=f))
    for x in (-0.41, 0.41):
        parts.append(rod((x - 0.012, 0.024, -0.3), (x + 0.012, 0.024, -0.3), 0.02, LAPTOP_BRASS, sides=16, surface='metal', layer='metal', frame=f))
    pitch, gap = 0.05, 0.006
    for row, widths in enumerate(KEY_ROWS):
        x, z = -pitch * 6.5, -0.17 + row * 0.048
        for k, units in enumerate(widths):
            w = units * pitch - gap
            centre = x + units * pitch / 2
            accent = (row, k) == (2, 6)
            parts.append(rbox([w + 0.006, 0.002, 0.044], (centre, 0.0245, z), KEY_SHADOW, bevel=0.002, frame=f))
            parts.append(rbox([w, 0.009, 0.038], (centre, 0.025, z), '#c3a477' if accent else KEY_SKIRT, bevel=0.005, segments=2, frame=f))
            parts.append(rbox([w - 0.009, 0.004, 0.028], (centre, 0.0305, z - 0.002), '#d8bc8e' if accent else KEY_TOP, bevel=0.003, segments=2, frame=f))
            x += units * pitch
    lid = Frame((0, 0.022, -0.29), (-0.28, 0, 0), f)
    parts.append(rbox([0.97, 0.62, 0.03], (0, 0.31, 0), WALNUT, bevel=0.03, surface='wood', frame=lid, dice=0.06))
    parts.append(rbox([0.93, 0.584, 0.006], (0, 0.314, 0.016), '#2b2420', bevel=0.004, frame=lid))
    parts.append(rbox([0.914, 0.568, 0.004], (0, 0.314, 0.02), '#efe2c4', bevel=0.002, layer='glow', frame=lid))
    for sx in (-1, 1):
        for sy in (0, 1):
            cx, cy = sx * 0.468, 0.01 + sy * 0.6
            parts.append(rbox([0.05, 0.01, 0.005], (cx - sx * 0.02, cy, 0.0165), LAPTOP_BRASS, bevel=0.002, surface='metal', layer='metal', frame=lid))
            parts.append(rbox([0.01, 0.05, 0.005], (cx, cy + (0.02 if sy == 0 else -0.02), 0.0165), LAPTOP_BRASS, bevel=0.002, surface='metal', layer='metal', frame=lid))
    parts.append(rbox([0.22, 0.48, 0.004], (-0.31, 0.314, 0.023), '#e3cfa8', bevel=0.002, layer='glow', frame=lid))
    parts.append(rbox([0.6, 0.46, 0.004], (0.12, 0.314, 0.023), '#fbf3df', bevel=0.002, layer='glow', frame=lid))
    parts.append(rbox([0.32, 0.02, 0.003], (0.03, 0.49, 0.026), '#a97b52', bevel=0.001, layer='glow', frame=lid))
    for i in range(8):
        parts.append(rbox([0.48 if i < 7 else 0.24, 0.008, 0.003], (0.12 if i < 7 else 0.0, 0.45 - i * 0.042, 0.026), '#cdb48c', bevel=0.001, layer='glow', frame=lid))
    for i in range(4):
        parts.append(rbox([0.14 - i * 0.015, 0.012, 0.003], (-0.31, 0.48 - i * 0.05, 0.026), '#a97b52', bevel=0.001, layer='glow', frame=lid))
    parts.append(sphere((0.05, 0.05, 0.004), (0.2, 0.36, -0.017), '#d9bc8a', subdivisions=2, frame=lid))
    parts.append(sphere((0.022, 0.034, 0.004), (0.2, 0.43, -0.018), '#8fa878', subdivisions=2, frame=lid))
    return parts


def lamp(x, y, z):
    f = Frame((x, y, z))
    base = [(0.0, 0.0), (0.19, 0.0), (0.199, 0.006), (0.2, 0.013), (0.193, 0.019), (0.186, 0.024), (0.188, 0.031), (0.15, 0.045), (0.11, 0.05), (0.06, 0.07), (0.045, 0.082), (0.052, 0.088), (0.04, 0.094), (0.03, 0.1), (0.0, 0.1)]
    parts = [lathe(base, (0, 0, 0), BRASS, segments=32, surface='metal', layer='metal', frame=f),
             rod((0, 0.09, 0), (0, 0.52, 0), 0.018, BRASS, surface='metal', layer='metal', frame=f),
             sphere((0.03, 0.03, 0.03), (0, 0.53, 0), BRASS, surface='metal', layer='metal', frame=f),
             rod((0, 0.53, 0), (-0.14, 0.66, 0), 0.016, BRASS, surface='metal', layer='metal', frame=f),
             cylinder(0.03, 0.03, 0.04, (-0.14, 0.71, 0), BRASS, segments=16, surface='metal', layer='metal', frame=f)]
    pleats = lambda a, h: 0.035 * abs(math.sin(a * 12))
    parts.append(lathe([(0.1, 0.73), (0.105, 0.735), (0.245, 0.525), (0.24, 0.52)], (-0.14, 0, 0), '#ffd08a', segments=72, layer='glow', frame=f, wobble=pleats))
    parts.append(lathe([(0.0, 0.54), (0.21, 0.54), (0.1, 0.72), (0.0, 0.72)], (-0.14, 0, 0), '#ffe0a6', segments=32, layer='glow', frame=f))
    for k in range(24):
        a = k * math.pi / 12
        fold = lambda r, y: (-0.14 + math.cos(a) * r, y, -math.sin(a) * r)
        parts.append(tube([fold(0.107, 0.731), fold(0.177, 0.629), fold(0.247, 0.526)], 0.0026, SHADE_FOLD, layer='glow', frame=f, resolution=2))
        b = a + math.pi / 24
        drop = (-0.14 + math.cos(b) * 0.256, 0.5, -math.sin(b) * 0.256)
        parts.append(tube([(drop[0], 0.517, drop[2]), (drop[0], 0.505, drop[2])], 0.0016, SHADE_TRIM, frame=f, resolution=2))
        parts.append(sphere((0.0075, 0.0075, 0.009), drop, GILT, subdivisions=1, surface='metal', layer='metal', frame=f))
    parts.append(lathe([(0.246, 0.513), (0.251, 0.515), (0.251, 0.536), (0.246, 0.538), (0.243, 0.526), (0.246, 0.513)], (-0.14, 0, 0), SHADE_TRIM, segments=72, surface='cloth', frame=f, wobble=pleats, caps=False))
    parts.append(lathe([(0.104, 0.722), (0.109, 0.724), (0.109, 0.739), (0.104, 0.741), (0.101, 0.731), (0.104, 0.722)], (-0.14, 0, 0), SHADE_TRIM, segments=72, surface='cloth', frame=f, wobble=pleats, caps=False))
    parts.append(cylinder(0.008, 0.012, 0.03, (-0.14, 0.745, 0), BRASS, segments=12, surface='metal', layer='metal', frame=f))
    parts.append(sphere((0.02, 0.024, 0.02), (-0.14, 0.775, 0), BRASS, subdivisions=2, surface='metal', layer='metal', frame=f))
    parts.append(cylinder(0.0, 0.009, 0.022, (-0.14, 0.806, 0), BRASS, segments=12, surface='metal', layer='metal', frame=f))
    parts.append(tube([(-0.05, 0.6, 0.12), (-0.05, 0.48, 0.13), (-0.05, 0.38, 0.13)], 0.003, BRASS, frame=f, resolution=3))
    parts.append(sphere((0.012, 0.018, 0.012), (-0.05, 0.37, 0.13), BRASS, subdivisions=2, surface='metal', layer='metal', frame=f))
    return parts


def mug(x, y, z):
    f = Frame((x, y, z), (0, -1.1, 0))
    outer = [(0.0, 0.0), (0.075, 0.0), (0.082, 0.006), (0.09, 0.05), (0.1, 0.17), (0.104, 0.19), (0.094, 0.192), (0.088, 0.17), (0.08, 0.05), (0.0, 0.05)]
    parts = [lathe(outer, (0, 0, 0), '#e7dec7', segments=36, surface='ceramic', frame=f),
             cylinder(0.089, 0.089, 0.004, (0, 0.165, 0), '#6b4a33', segments=36, frame=f),
             cylinder(0.097, 0.092, 0.022, (0, 0.11, 0), '#c0957a', segments=36, surface='ceramic', frame=f),
             tube([(0.088, 0.155, 0), (0.13, 0.158, 0), (0.158, 0.135, 0), (0.162, 0.1, 0), (0.145, 0.07, 0), (0.084, 0.06, 0)], 0.015, '#e7dec7', surface='ceramic', frame=f)]
    parts.append(cylinder(0.12, 0.12, 0.01, (0, -0.003, 0), '#9c7a5b', segments=36, bevel=0.004, surface='wood', frame=f))
    return parts


def book(width, height, depth, x, y, z, colour, angle, tooled=False, ribbon=False):
    f = Frame((x, y, z), (0, angle, 0))
    block_w, block_d = width - 0.03, depth - 0.026
    parts = [rbox([width, height * 0.22, depth], (0, height * 0.39, 0), colour, bevel=0.008, surface='cloth', frame=f),
             rbox([width, height * 0.22, depth], (0, -height * 0.39, 0), colour, bevel=0.008, surface='cloth', frame=f),
             rbox([block_w, height * 0.6, block_d], (0.012, 0, 0.0), PAPER, bevel=0.004, surface='paper', frame=f),
             lathe([(0.0, -depth / 2), (height / 2, -depth / 2), (height / 2, depth / 2), (0.0, depth / 2)], (-width / 2 + 0.012, 0, 0), colour, segments=12, surface='cloth', frame=f, rotation=(math.pi / 2, 0, 0)),
             rbox([0.012, height * 1.02, 0.03], (-width / 2 + 0.004, 0, depth * 0.3), GILT, bevel=0.003, surface='metal', layer='metal', frame=f),
             rbox([0.012, height * 1.02, 0.03], (-width / 2 + 0.004, 0, -depth * 0.3), GILT, bevel=0.003, surface='metal', layer='metal', frame=f)]
    for level in (-0.12, 0.0, 0.12):
        parts.append(rbox([block_w - 0.02, 0.0022, 0.002], (0.012, height * level, block_d / 2 + 0.0004), '#ddd0b2', bevel=0, frame=f))
        parts.append(rbox([0.002, 0.0022, block_d - 0.02], (0.012 + block_w / 2 + 0.0004, height * level, 0), '#ddd0b2', bevel=0, frame=f))
    if tooled:
        top = height / 2 + 0.0004
        inset_w, inset_d = width - 0.09, depth - 0.07
        for dz in (-1, 1):
            parts.append(rbox([inset_w, 0.0016, 0.005], (0.02, top, dz * inset_d / 2), GILT, bevel=0, surface='metal', layer='metal', frame=f))
        for dx in (-1, 1):
            parts.append(rbox([0.005, 0.0016, inset_d], (0.02 + dx * inset_w / 2, top, 0), GILT, bevel=0, surface='metal', layer='metal', frame=f))
        parts.append(rbox([0.06, 0.0018, 0.06], (0.02, top, 0), GILT, bevel=0.004, surface='metal', layer='metal', frame=f, rotation=(0, math.pi / 4, 0)))
        parts.append(rbox([0.034, 0.0022, 0.034], (0.02, top + 0.0003, 0), colour, bevel=0.003, surface='cloth', frame=f, rotation=(0, math.pi / 4, 0)))
    if ribbon:
        parts.append(rbox([0.018, 0.0025, 0.05], (0.1, height * 0.05, block_d / 2 + 0.012), RIBBON, bevel=0.001, surface='cloth', frame=f))
        parts.append(rbox([0.018, 0.05, 0.0025], (0.1, -height * 0.3, depth / 2 + 0.034), RIBBON, bevel=0.001, surface='cloth', frame=f, rotation=(0.12, 0, 0)))
    return parts


def pencil(a, b):
    axis = tuple(b[i] - a[i] for i in range(3))
    along = lambda p, t: tuple(p[i] + axis[i] * t for i in range(3))
    parts = [rod(a, b, 0.01, '#cca874', sides=6, surface='wood'),
             rod(along(a, 0.03), along(a, 0.07), 0.0102, '#3f5f45', sides=6, surface='wood'),
             tube([b, along(b, 0.12)], 0.0098, '#e9cf9f', tip=0.3, surface='wood', resolution=2),
             tube([along(b, 0.1), along(b, 0.15)], 0.0032, '#3b3a3a', tip=0.2, resolution=2)]
    back = along(a, -0.07)
    parts.append(rod(back, a, 0.0108, '#cdbf9a', sides=14, surface='metal', layer='metal'))
    for t in (-0.055, -0.035, -0.015):
        parts.append(torus(0.0108, 0.0016, along(a, t), '#b9a77e', major_segments=14, minor_segments=5, surface='metal', layer='metal', rotation=(0, -math.atan2(axis[2], axis[0]), math.pi / 2)))
    end = along(back, -0.04)
    parts.append(rod(end, back, 0.0104, '#c79a90', sides=14))
    parts.append(sphere((0.0104, 0.0104, 0.0104), end, '#c79a90', subdivisions=2))
    return parts


def sheet(width, depth, frame, colour, lift):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=14, y_segments=10, size=0.5)
    for v in bm.verts:
        x, z = v.co.x * width, v.co.y * depth
        reach = max(0.0, 1 - ((x + width / 2) + (depth / 2 - z)) / 0.13)
        v.co = kit.at(x, lift * reach * reach, z)
    obj = kit._mesh_from_bmesh(bm, 'sheet')
    mod = obj.modifiers.new('solid', 'SOLIDIFY')
    mod.thickness, mod.offset = 0.0016, -1
    kit.assets.apply_all(obj)
    return kit._finish(obj, colour, 'paper', 'paint', frame, (0, 0, 0), (0, 0, 0))


def writing(frame):
    parts = []
    for line, words in enumerate(((0.05, 0.034, 0.07, 0.045), (0.06, 0.03, 0.05), (0.04, 0.066, 0.028, 0.05), (0.07, 0.04))):
        x, base = -0.15, -0.104 + line * 0.035 - 0.011
        for w, length in enumerate(words):
            steps = max(6, int(length / 0.0045))
            points = []
            for k in range(steps + 1):
                t = k / steps
                hump = abs(math.sin(t * steps * 1.3 + line + w)) * 0.0065 * (1.25 if k % 5 == 2 else 1.0)
                points.append((x + t * length, 0.0018, base - hump))
            parts.append(tube(points, 0.0011, INK, frame=frame, resolution=1))
            x += length + 0.016
    return parts


def succulent(x, y, z):
    f = Frame((x, y, z))
    wall = [(0.0, 0.0), (0.042, 0.0), (0.046, 0.006), (0.044, 0.014), (0.06, 0.04), (0.07, 0.075), (0.072, 0.088), (0.08, 0.091), (0.083, 0.098), (0.08, 0.104), (0.066, 0.104), (0.064, 0.096), (0.0, 0.096)]
    parts = [lathe(wall, (0, 0, 0), '#667c78', segments=32, surface='ceramic', frame=f),
             torus(0.0652, 0.003, (0, 0.06, 0), '#efe2c4', rotation=(math.pi / 2, 0, 0), major_segments=32, minor_segments=5, surface='ceramic', frame=f),
             cylinder(0.064, 0.064, 0.006, (0, 0.093, 0), '#5c4a3a', segments=24, surface='stone', frame=f)]
    for k, (px, pz, r) in enumerate(((0.035, 0.03, 0.009), (-0.03, 0.038, 0.007), (0.042, -0.028, 0.006))):
        parts.append(sphere((r, r * 0.6, r), (px, 0.098, pz), '#d8cfbd', subdivisions=1, surface='stone', frame=f))
    for ring, (count, lean, length, colour) in enumerate(((9, 0.95, 0.06, '#8fb07c'), (7, 0.62, 0.05, '#a3c189'), (5, 0.32, 0.038, '#b9d39b'), (3, 0.12, 0.026, '#c9dea8'))):
        for k in range(count):
            a = k / count * math.tau + ring * 0.45
            out = (math.cos(a) * math.sin(lean), math.cos(lean), math.sin(a) * math.sin(lean))
            base = (x + math.cos(a) * 0.006 * (3 - ring), y + 0.1 + ring * 0.007, z + math.sin(a) * 0.006 * (3 - ring))
            parts += leaf(base, out, (0, 1, 0), length, length * 0.62, colour, cup=0.55, droop=-0.18, fold=0.12, rib=None, rows=5, cols=2, thickness=0.006)
            tip = (base[0] + out[0] * length * 0.86, base[1] + out[1] * length * 0.86 + 0.16 * length * math.sin(lean), base[2] + out[2] * length * 0.86)
            parts.append(sphere((0.0035, 0.0028, 0.0035), tip, '#d8958a', subdivisions=1))
    return parts


def build():
    parts = desk() + chair() + laptop() + lamp(1.10, 1.26, -0.69) + mug(0.83, 1.26, -0.13)
    for i, colour in enumerate(BOOKS):
        parts += book(0.48 - i * 0.02, 0.065, 0.35, -1.02, 1.29 + i * 0.068, -0.70, colour, 0.13 if i == 1 else -0.045, tooled=i == 2, ribbon=i == 2)
    parts.append(rbox([0.42, 0.012, 0.3], (-0.77, 1.262, -0.08), PAPER, bevel=0.003, surface='paper', rotation=(0, 0.05, 0)))
    page = Frame((-0.765, 1.2695, -0.075), (0, 0.02, 0))
    parts.append(sheet(0.4, 0.28, page, '#fbf5e4', 0.03))
    for i in range(6):
        parts.append(rbox([0.3, 0.0016, 0.004], (0.0, 0.0018, -0.095 + i * 0.035), '#b7c2c9', bevel=0, frame=page))
    parts.append(rbox([0.003, 0.0016, 0.24], (-0.165, 0.0018, 0.0), '#d9a3a0', bevel=0, frame=page))
    parts += writing(page)
    parts += pencil((-0.9, 1.283, -0.14), (-0.66, 1.283, -0.02))
    parts += succulent(1.32, 1.25, -0.28)
    return parts
