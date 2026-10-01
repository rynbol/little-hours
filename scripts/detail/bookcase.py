import math, random
from kit import Frame, cushion, cylinder, lathe, rbox, rod, sphere, torus, tube
from study_desk import book as lying_book, succulent
import bmesh
from kit import _finish, _mesh_from_bmesh, at

BACK, CASE, TRIM, CROWN, BRASS = '#64483b', '#936c4e', '#c29c68', '#73533f', '#c6a16b'
PAPER, VASE, BASKET, WEAVE, LINEN = '#f2ead5', '#d4b897', '#b8a17d', '#d4bd94', '#dfd1b2'
BOOKS = ['#788e84', '#bb8066', '#d5b77c', '#a4ac8e', '#829da3', '#c7a696']
ACCENTS = ['#8c6d85', '#5f7a6c', '#b8664f']
GILT = '#d9b36e'
SHELVES = (0.08, 0.82, 1.58, 2.36, 3.29)
TIPPING_GAP = (-0.475, -0.305)
EYE = (0.3, 0.35, 1.0)


STYLES = (('plain', 6), ('ribs', 3), ('band', 3), ('gilt', 3), ('label', 2), ('gilt-label', 2), ('diamond', 1))


def shade(colour, k):
    r, g, b = (int(colour[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(c * k))) for c in (r, g, b))


def pick_style(rng):
    roll = rng.uniform(0, sum(weight for _, weight in STYLES))
    for style, weight in STYLES:
        roll -= weight
        if roll <= 0:
            return style
    return 'plain'


def spine_book(x, bottom, z, w, h, d, colour, lean=0.0, style='plain', place=0.5):
    f = Frame((x, bottom + (w * math.sin(abs(lean)) + h * math.cos(lean)) / 2, z), (0, 0, lean))
    board = 0.008
    face = d / 2 + 0.001
    parts = [rbox([board, h, d - 0.01], (side * (w / 2 - board / 2), 0, -0.005), colour, bevel=0, surface='cloth', frame=f) for side in (-1, 1)]
    parts.append(rbox([w, h, 0.03], (0, 0, d / 2 - 0.015), colour, bevel=min(0.02, w * 0.4), segments=2, surface='cloth', frame=f))
    parts.append(rbox([w - board * 2, h - 0.016, d - 0.03], (0, 0, -0.01), PAPER, bevel=0, surface='paper', frame=f))
    if style in ('gilt', 'gilt-label'):
        for y in (h / 2 - 0.035, -h / 2 + 0.035):
            parts.append(rbox([w * 0.92, 0.01, 0.004], (0, y, face), GILT, bevel=0, surface='metal', layer='metal', frame=f))
    if style in ('label', 'gilt-label'):
        tall, y = h * (0.1 + 0.08 * place), h * (0.05 + 0.22 * place)
        parts.append(rbox([w * 0.62, tall, 0.003], (0, y, face), PAPER, bevel=0, surface='paper', frame=f))
        for k in range(1 + int(place * 2.5)):
            parts.append(rbox([w * (0.36 - 0.1 * k), 0.006, 0.002], (0, y + tall * 0.2 - k * 0.016, face + 0.002), '#6b5a4a', bevel=0, frame=f))
    if style == 'ribs':
        for k in range(4):
            parts.append(rbox([w * 1.02, 0.013, 0.008], (0, h * (0.34 - k * 0.16), face + 0.002), shade(colour, 0.78), bevel=0.003, surface='cloth', frame=f))
        parts.append(rbox([w * 0.5, h * 0.07, 0.003], (0, h * 0.26, face + 0.002), GILT, bevel=0, surface='metal', layer='metal', frame=f))
    if style == 'band':
        top = h * (0.28 + 0.1 * place)
        parts.append(rbox([w * 1.01, h * 0.18, 0.004], (0, top, face), shade(colour, 0.72), bevel=0, surface='cloth', frame=f))
        parts.append(rbox([w * 0.9, 0.006, 0.003], (0, top - h * 0.1, face + 0.001), GILT, bevel=0, surface='metal', layer='metal', frame=f))
    if style == 'diamond':
        parts.append(rbox([w * 0.5, w * 0.5, 0.003], (0, h * 0.2, face), GILT, bevel=0, surface='metal', layer='metal', frame=f, rotation=(0, 0, math.pi / 4)))
    return parts


def shelf_row(start, stop, bottom, seed, palette, lean_last=False, tall=0.52):
    rng = random.Random(seed)
    parts, x, i, previous = [], start, 0, None
    while True:
        if i > 1 and rng.random() < 0.1 and x + 0.32 < stop:
            width = rng.uniform(0.25, 0.3)
            y = bottom
            for k in range(rng.randint(2, 4)):
                height = rng.uniform(0.04, 0.06)
                colour = rng.choice([c for c in palette if c != previous])
                parts += lying_book(width - k * 0.01, height, rng.uniform(0.22, 0.27), x + width / 2 + rng.uniform(-0.01, 0.01), y + height / 2, 0.235 - 0.14, colour, rng.uniform(-0.12, 0.12))
                y += height
                previous = colour
            x += width + 0.012
            i += 1
            continue
        if i > 0 and rng.random() < 0.08:
            x += rng.uniform(0.03, 0.07)
        short = rng.random() < 0.12
        w, h, d = rng.uniform(0.05, 0.12), rng.uniform(0.25, 0.31) if short else rng.uniform(tall * 0.66, tall), rng.uniform(0.24, 0.32)
        tilt = rng.uniform(-0.015, 0.015)
        width = w * math.cos(tilt) + h * math.sin(abs(tilt))
        if x + width > stop:
            break
        colour = rng.choice([c for c in palette if c != previous])
        parts += spine_book(x + width / 2, bottom, 0.235 - d / 2 + rng.uniform(-0.03, 0.006), w, h, d, colour, tilt, pick_style(rng), rng.random())
        previous = colour
        x += width + 0.003
        i += 1
    if lean_last:
        w, h, d = 0.08, tall * 0.85, 0.29
        lean = next((a for a in (0.42, 0.34, 0.26, 0.18) if x + w * math.cos(a) + h * math.sin(a) <= stop), 0.12)
        parts += spine_book(x + (w * math.cos(lean) + h * math.sin(lean)) / 2, bottom, 0.235 - d / 2, w, h, d, rng.choice([c for c in palette if c != previous]), lean, 'gilt-label', 0.7)
    return parts


def bookend(x, bottom, z):
    f = Frame((x, bottom, z))
    return [rbox([0.12, 0.012, 0.16], (0, 0.006, 0), BRASS, bevel=0.004, segments=1, surface='metal', layer='metal', frame=f),
            rbox([0.012, 0.2, 0.16], (-0.054, 0.1, 0), BRASS, bevel=0.004, segments=1, surface='metal', layer='metal', frame=f),
            sphere((0.03, 0.03, 0.03), (-0.054, 0.23, 0), BRASS, subdivisions=2, surface='metal', layer='metal', frame=f),
            torus(0.045, 0.006, (-0.047, 0.12, 0), '#8a6b3f', rotation=(0, math.pi / 2, math.pi / 2), major_segments=18, minor_segments=4, surface='metal', layer='metal', frame=f)]


def panel(top, bottom, thickness, colour, surface='wood'):
    bm = bmesh.new()
    front = [[bm.verts.new(at(*p)) for p in row] for row in (top, bottom)]
    back = [[bm.verts.new(at(p[0], p[1], p[2] - thickness)) for p in row] for row in (top, bottom)]
    n = len(top)
    for k in range(n - 1):
        bm.faces.new((front[0][k], front[1][k], front[1][k + 1], front[0][k + 1]))
        bm.faces.new((back[0][k + 1], back[1][k + 1], back[1][k], back[0][k]))
        for row in (0, 1):
            bm.faces.new((front[row][k], front[row][k + 1], back[row][k + 1], back[row][k]))
    for k in (0, n - 1):
        bm.faces.new((front[0][k], back[0][k], back[1][k], front[1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bmesh(bm), colour, surface, 'paint', None, (0, 0, 0), (0, 0, 0))


def carcass():
    parts = []
    boards = 9
    for i in range(boards):
        span = 1.77 / boards
        parts.append(rbox([span, 3.16, 0.065], (-1.77 / 2 + span * (i + 0.5), 1.65, -0.23), BACK, bevel=0.012, segments=1, surface='wood'))
    for x in (-0.88, 0.88):
        parts.append(rbox([0.11, 3.35, 0.54], (x, 1.675, 0), CASE, bevel=0.018, surface='wood', dice=0.6))
        parts.append(rbox([0.03, 3.17, 0.022], (x, 1.68, 0.283), TRIM, bevel=0.009, surface='wood'))
        parts.append(rbox([0.02, 2.9, 0.4], (x + (0.056 if x > 0 else -0.056), 1.66, 0), CASE, bevel=0.008, surface='wood'))
        parts.append(rbox([0.13, 0.12, 0.56], (x, 0.06, 0.005), CROWN, bevel=0.02, surface='wood'))
    for y in SHELVES:
        parts.append(rbox([1.66, 0.09, 0.53], (0, y, -0.01), CASE, bevel=0.012, surface='wood', dice=0.4))
        parts.append(rbox([1.72, 0.1, 0.05], (0, y, 0.272), CASE, bevel=0.022, surface='wood'))
    parts.append(rbox([1.66, 0.1, 0.03], (0, 0.06, 0.29), CROWN, bevel=0.012, surface='wood'))
    parts.append(rbox([1.88, 0.07, 0.61], (0, 3.385, 0), CROWN, bevel=0.024, surface='wood'))
    parts.append(rbox([1.84, 0.05, 0.585], (0, 3.335, -0.005), CROWN, bevel=0.02, surface='wood'))
    parts.append(rbox([1.68, 0.025, 0.02], (0, 3.385, 0.307), BRASS, bevel=0.008, surface='metal', layer='metal'))
    for k in range(17):
        parts.append(rbox([0.045, 0.035, 0.022], (-0.8 + k * 0.1, 3.3, 0.3), CROWN, bevel=0.006, segments=1, surface='wood'))
    scallops, top, drop = 5, 3.24, 0.07
    edge = lambda x: top - 0.03 - drop * abs(math.sin((x + 0.825) / 1.65 * scallops * math.pi))
    xs = [-0.825 + 1.65 * k / 40 for k in range(41)]
    parts.append(panel([(x, top, 0.272) for x in xs], [(x, edge(x), 0.272) for x in xs], 0.02, TRIM))
    for k in range(scallops + 1):
        x = -0.825 + 1.65 * k / scallops
        parts.append(sphere((0.018, 0.018, 0.012), (x, top - 0.035, 0.272), BRASS, subdivisions=1, surface='metal', layer='metal'))
    return parts


def vase(x, y, z):
    f = Frame((x, y, z))
    profile = [(0.0, 0.0), (0.13, 0.0), (0.15, 0.012), (0.175, 0.07), (0.178, 0.12), (0.16, 0.2), (0.12, 0.26), (0.085, 0.31), (0.078, 0.36), (0.09, 0.395), (0.095, 0.405), (0.08, 0.41), (0.066, 0.38), (0.0, 0.37)]
    parts = [lathe(profile, (0, 0, 0), VASE, segments=28, surface='ceramic', frame=f),
             torus(0.17, 0.009, (0, 0.13, 0), '#b8865f', rotation=(math.pi / 2, 0, 0), major_segments=28, minor_segments=5, surface='ceramic', frame=f),
             torus(0.138, 0.006, (0, 0.225, 0), '#b8865f', rotation=(math.pi / 2, 0, 0), major_segments=28, minor_segments=5, surface='ceramic', frame=f)]
    stems = [(-0.1, 0.56, 0.02), (0.02, 0.62, -0.03), (0.12, 0.55, 0.03), (-0.04, 0.6, 0.06), (0.07, 0.6, -0.06)]
    for k, (dx, top, dz) in enumerate(stems):
        tip = (dx, top, dz)
        parts.append(tube([(0, 0.3, 0), (dx * 0.4, 0.45, dz * 0.4), tip], 0.004, '#9a8a62', frame=f, resolution=3))
        for j in range(5):
            s = 0.84 + j * 0.04
            parts.append(sphere((0.012, 0.022, 0.012), (dx * s, top - 0.1 + j * 0.028, dz * s), ['#c9b48a', '#b79ab0'][k % 2], subdivisions=1, surface='cloth', frame=f))
    return parts


def basket(x, y, z):
    f = Frame((x, y, z))
    w, h, d = 0.43, 0.22, 0.39
    parts = [rbox([w, h, d], (0, h / 2, 0), BASKET, bevel=0.03, surface='cloth', frame=f)]
    for i in range(4):
        parts.append(rbox([w + 0.008, 0.03, d + 0.008], (0, 0.035 + i * 0.05, 0), WEAVE if i % 2 else BASKET, bevel=0.012, segments=2, surface='cloth', frame=f))
    for k in range(9):
        parts.append(rod((-w / 2 + 0.025 + k * (w - 0.05) / 8, 0.012, d / 2 + 0.006), (-w / 2 + 0.025 + k * (w - 0.05) / 8, h - 0.01, d / 2 + 0.006), 0.006, WEAVE, sides=5, surface='cloth', frame=f))
    parts.append(torus(0.06, 0.012, (0, h - 0.01, d / 2 - 0.02), WEAVE, arc=math.pi, major_segments=12, minor_segments=6, frame=f, surface='cloth'))
    parts += cushion([w - 0.06, 0.08, d - 0.06], (0, h + 0.005, -0.01), LINEN, puff=0.5, frame=f, rotation=(0.08, 0, 0.05))
    return parts


def hourglass(x, y, z):
    f = Frame((x, y, z))
    parts = []
    for yy in (0.012, 0.3):
        parts.append(cylinder(0.075, 0.075, 0.024, (0, yy, 0), '#73533f', segments=16, bevel=0.006, surface='wood', frame=f))
    for k in range(3):
        a = k / 3 * math.tau
        parts.append(rod((math.cos(a) * 0.058, 0.02, math.sin(a) * 0.058), (math.cos(a) * 0.058, 0.29, math.sin(a) * 0.058), 0.007, BRASS, sides=6, surface='metal', layer='metal', frame=f))
    parts.append(lathe([(0.0, 0.024), (0.045, 0.03), (0.05, 0.07), (0.012, 0.156), (0.05, 0.24), (0.045, 0.282), (0.0, 0.288)], (0, 0, 0), '#e8e2d0', segments=16, surface='metal', layer='metal', frame=f))
    parts.append(lathe([(0.0, 0.03), (0.04, 0.034), (0.03, 0.075), (0.0, 0.095)], (0, 0, 0), '#d8b06e', segments=14, frame=f))
    parts.append(lathe([(0.0, 0.2), (0.03, 0.23), (0.04, 0.265), (0.0, 0.272)], (0, 0, 0), '#d8b06e', segments=14, frame=f))
    return parts


def build():
    parts = carcass()
    bottoms = [y + 0.05 for y in SHELVES]
    parts += shelf_row(-0.815, 0.36, bottoms[0], 3, BOOKS, lean_last=True, tall=0.5)
    parts += basket(0.6, bottoms[0], 0.04)
    parts += shelf_row(-0.815, -0.05, bottoms[1], 11, BOOKS + ACCENTS[:1], tall=0.52)
    parts += bookend(0.0, bottoms[1], 0.1)
    parts += vase(0.43, bottoms[1], 0.05)
    parts += shelf_row(-0.815, TIPPING_GAP[0], bottoms[2], 5, BOOKS, tall=0.5)
    parts += shelf_row(TIPPING_GAP[1], 0.3, bottoms[2], 8, BOOKS + ACCENTS[1:2], tall=0.5)
    parts += lying_book(0.4, 0.05, 0.28, 0.53, bottoms[2] + 0.025, 0.06, BOOKS[2], 0.0)
    parts += lying_book(0.34, 0.045, 0.25, 0.54, bottoms[2] + 0.073, 0.05, ACCENTS[0], 0.12)
    parts += succulent(0.55, bottoms[2] + 0.096, 0.04)
    parts += shelf_row(-0.815, 0.4, bottoms[3], 21, BOOKS + ACCENTS[2:], lean_last=True, tall=0.55)
    parts += hourglass(0.62, bottoms[3], 0.04)
    return parts
