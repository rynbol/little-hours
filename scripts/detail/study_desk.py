import math
from kit import Frame, cushion, cylinder, lathe, rbox, rod, sphere, torus, tube

WOOD, EDGE, DARK, BRASS, SAGE, PAPER = '#aa7954', '#bc9169', '#73533d', '#bf9762', '#83968a', '#f2ead5'
BOOKS = ['#788e84', '#bb8066', '#d5b77c']
EYE = (0.25, 0.9, 1.0)


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
    shell = '#b3a189'
    parts = [rbox([0.97, 0.04, 0.62], (0, 0, 0), shell, bevel=0.018, surface='metal', layer='metal', frame=f),
             rbox([0.72, 0.006, 0.26], (0, 0.021, -0.07), '#4a3f36', bevel=0.004, frame=f),
             rbox([0.28, 0.004, 0.14], (0, 0.021, 0.19), '#c7b89e', bevel=0.01, surface='metal', layer='metal', frame=f)]
    for row in range(5):
        keys = 13 if row < 4 else 9
        for k in range(keys):
            w = 0.044 if row < 4 else (0.2 if k == 4 else 0.044)
            x = -0.3 + k * 0.05 if row < 4 else [-0.3, -0.25, -0.2, -0.15, 0.0, 0.15, 0.2, 0.25, 0.3][k]
            parts.append(rbox([w, 0.01, 0.038], (x, 0.026, -0.17 + row * 0.048), '#e9e4d2' if (row, k) != (2, 6) else '#d9b07a', bevel=0.004, segments=2, frame=f))
    lid = Frame((0, 0.022, -0.29), (-0.28, 0, 0), f)
    parts.append(rbox([0.97, 0.62, 0.03], (0, 0.31, 0), shell, bevel=0.016, surface='metal', layer='metal', frame=lid))
    parts.append(rbox([0.9, 0.56, 0.006], (0, 0.31, 0.016), '#2b2420', bevel=0.004, frame=lid))
    parts.append(rbox([0.86, 0.51, 0.004], (0, 0.31, 0.02), '#efe2c4', bevel=0.002, layer='glow', frame=lid))
    parts.append(rbox([0.2, 0.44, 0.004], (-0.3, 0.31, 0.023), '#e3cfa8', bevel=0.002, layer='glow', frame=lid))
    parts.append(rbox([0.54, 0.42, 0.004], (0.12, 0.31, 0.023), '#fbf3df', bevel=0.002, layer='glow', frame=lid))
    parts.append(rbox([0.3, 0.02, 0.003], (0.04, 0.47, 0.026), '#a97b52', bevel=0.001, layer='glow', frame=lid))
    for i in range(7):
        parts.append(rbox([0.42 if i < 6 else 0.22, 0.008, 0.003], (0.12 if i < 6 else 0.02, 0.43 - i * 0.04, 0.026), '#cdb48c', bevel=0.001, layer='glow', frame=lid))
    for i in range(4):
        parts.append(rbox([0.13 - i * 0.015, 0.012, 0.003], (-0.3, 0.46 - i * 0.05, 0.026), '#a97b52', bevel=0.001, layer='glow', frame=lid))
    parts.append(sphere((0.05, 0.05, 0.004), (0.2, 0.36, -0.017), '#e8c079', subdivisions=2, frame=lid))
    parts.append(sphere((0.022, 0.034, 0.004), (0.2, 0.43, -0.018), '#8fa878', subdivisions=2, frame=lid))
    return parts


def lamp(x, y, z):
    f = Frame((x, y, z))
    base = [(0.0, 0.0), (0.19, 0.0), (0.195, 0.012), (0.185, 0.03), (0.15, 0.045), (0.11, 0.05), (0.06, 0.07), (0.04, 0.09), (0.03, 0.1), (0.0, 0.1)]
    parts = [lathe(base, (0, 0, 0), BRASS, segments=32, surface='metal', layer='metal', frame=f),
             rod((0, 0.09, 0), (0, 0.52, 0), 0.018, BRASS, surface='metal', layer='metal', frame=f),
             sphere((0.03, 0.03, 0.03), (0, 0.53, 0), BRASS, surface='metal', layer='metal', frame=f),
             rod((0, 0.53, 0), (-0.14, 0.66, 0), 0.016, BRASS, surface='metal', layer='metal', frame=f),
             cylinder(0.03, 0.03, 0.04, (-0.14, 0.71, 0), BRASS, segments=16, surface='metal', layer='metal', frame=f)]
    pleats = lambda a, h: 0.035 * abs(math.sin(a * 12))
    parts.append(lathe([(0.1, 0.73), (0.105, 0.735), (0.245, 0.525), (0.24, 0.52)], (-0.14, 0, 0), '#d6a766', segments=72, surface='cloth', frame=f, wobble=pleats))
    parts.append(lathe([(0.0, 0.54), (0.21, 0.54), (0.1, 0.72), (0.0, 0.72)], (-0.14, 0, 0), '#ffe0a6', segments=32, layer='glow', frame=f))
    parts.append(tube([(-0.05, 0.6, 0.12), (-0.05, 0.48, 0.13), (-0.05, 0.38, 0.13)], 0.003, BRASS, frame=f, resolution=3))
    parts.append(sphere((0.012, 0.018, 0.012), (-0.05, 0.37, 0.13), BRASS, subdivisions=2, surface='metal', layer='metal', frame=f))
    return parts


def mug(x, y, z):
    f = Frame((x, y, z))
    outer = [(0.0, 0.0), (0.075, 0.0), (0.082, 0.006), (0.09, 0.05), (0.1, 0.17), (0.104, 0.19), (0.094, 0.192), (0.088, 0.17), (0.08, 0.05), (0.0, 0.05)]
    parts = [lathe(outer, (0, 0, 0), '#e7dec7', segments=36, surface='ceramic', frame=f),
             cylinder(0.089, 0.089, 0.004, (0, 0.165, 0), '#6b4a33', segments=36, frame=f),
             cylinder(0.097, 0.092, 0.022, (0, 0.11, 0), '#c98f66', segments=36, surface='ceramic', frame=f),
             torus(0.055, 0.016, (0.105, 0.1, 0), '#e7dec7', rotation=(0, 0, -math.pi / 2), arc=math.pi, major_segments=14, surface='ceramic', frame=f)]
    parts.append(cylinder(0.12, 0.12, 0.01, (0, -0.003, 0), '#9c7a5b', segments=36, bevel=0.004, surface='wood', frame=f))
    return parts


def book(width, height, depth, x, y, z, colour, angle):
    f = Frame((x, y, z), (0, angle, 0))
    return [rbox([width, height * 0.22, depth], (0, height * 0.39, 0), colour, bevel=0.008, surface='cloth', frame=f),
            rbox([width, height * 0.22, depth], (0, -height * 0.39, 0), colour, bevel=0.008, surface='cloth', frame=f),
            rbox([width - 0.03, height * 0.6, depth - 0.02], (0.012, 0, 0.0), PAPER, bevel=0.004, surface='paper', frame=f),
            lathe([(0.0, -depth / 2), (height / 2, -depth / 2), (height / 2, depth / 2), (0.0, depth / 2)], (-width / 2 + 0.012, 0, 0), colour, segments=12, surface='cloth', frame=f, rotation=(math.pi / 2, 0, 0)),
            rbox([0.012, height * 1.02, 0.03], (-width / 2 + 0.004, 0, depth * 0.3), '#d9b36e', bevel=0.003, surface='metal', layer='metal', frame=f),
            rbox([0.012, height * 1.02, 0.03], (-width / 2 + 0.004, 0, -depth * 0.3), '#d9b36e', bevel=0.003, surface='metal', layer='metal', frame=f)]


def pencil(a, b):
    parts = [rod(a, b, 0.01, '#e0a24e', sides=6, surface='wood')]
    tip = tuple(b[i] + (b[i] - a[i]) * 0.1 for i in range(3))
    parts.append(rod(b, tip, 0.006, '#e9cf9f', sides=6, surface='wood'))
    back = tuple(a[i] - (b[i] - a[i]) * 0.06 for i in range(3))
    parts.append(rod(back, a, 0.0105, '#c9c2b0', sides=12, surface='metal', layer='metal'))
    end = tuple(back[i] - (b[i] - a[i]) * 0.05 for i in range(3))
    parts.append(rod(end, back, 0.0105, '#d98b86', sides=12))
    return parts


def succulent(x, y, z):
    f = Frame((x, y, z))
    parts = [lathe([(0.0, 0.0), (0.05, 0.0), (0.07, 0.09), (0.078, 0.1), (0.07, 0.1), (0.0, 0.095)], (0, 0, 0), '#bd8469', segments=24, surface='ceramic', frame=f)]
    for ring, (count, lean, size) in enumerate(((7, 1.1, 0.05), (5, 0.7, 0.04), (3, 0.3, 0.03))):
        for k in range(count):
            a = k / count * math.tau + ring * 0.5
            leaf = sphere((size * 0.45, size * 0.2, size), (math.cos(a) * size * 0.8, 0.12 + ring * 0.015, math.sin(a) * size * 0.8), '#8fae7c', subdivisions=2, surface='leaf', frame=f, rotation=(lean, -a + math.pi / 2, 0))
            parts.append(leaf)
    return parts


def build():
    parts = desk() + chair() + laptop() + lamp(1.10, 1.26, -0.69) + mug(0.83, 1.26, -0.13)
    for i, colour in enumerate(BOOKS):
        parts += book(0.48 - i * 0.02, 0.065, 0.35, -1.02, 1.29 + i * 0.068, -0.70, colour, 0.13 if i == 1 else -0.045)
    parts.append(rbox([0.42, 0.012, 0.3], (-0.77, 1.262, -0.08), PAPER, bevel=0.003, surface='paper', rotation=(0, 0.05, 0)))
    parts.append(rbox([0.4, 0.004, 0.28], (-0.765, 1.271, -0.075), '#fbf5e4', bevel=0.001, surface='paper', rotation=(0, 0.02, 0)))
    for i in range(6):
        parts.append(rbox([0.3, 0.002, 0.004], (-0.77, 1.274, -0.17 + i * 0.035), '#b7c2c9', bevel=0, rotation=(0, 0.02, 0)))
    parts += pencil((-0.9, 1.283, -0.14), (-0.66, 1.283, -0.02))
    parts += succulent(1.32, 1.25, -0.28)
    return parts
