import json, math
from mathutils import Matrix, Vector
import kit
from kit import Frame, cylinder, displace, lathe, rbox, rod, sphere, torus, tube

HEARTH, WALL, SOOT, STONE, PALE = '#796555', '#756153', '#342e2c', '#aa957d', '#bca98c'
WALNUT, SHELF, TRIM, CORBEL_BRASS = '#6b4b3b', '#8c6547', '#c5a36d', '#bd9864'
LOG_A, LOG_B, END_GRAIN, EMBER, IRON = '#684a37', '#77503a', '#b58f6c', '#e5924f', '#514937'
FRAME, SKY, MOON, HILLS = '#b89a63', '#4f5d57', '#dbc494', '#3f4a45'
HOLDER, WAX, WICK, FLAME = '#b69760', '#ead6aa', '#594c37', '#ffd186'
BOOKS, PAPER, MORTAR, BRICK = ['#7d8263', '#866574', '#c2a16c'], '#f2ead5', '#5e4f44', '#453833'
EYE = (0.3, 0.35, 1.0)


def mottle(obj, amount=0.07, scale=5.0):
    obj['shade'] = json.dumps({'mottle': amount, 'scale': scale})
    return obj


def axis_frame(origin, direction):
    d = direction.normalized()
    p = Vector((d.z, 0, -d.x)).normalized() if abs(d.y) < 0.999 else Vector((1, 0, 0))
    q = p.cross(d)
    babylon = Matrix(((p.x, d.x, q.x), (p.y, d.y, q.y), (p.z, d.z, q.z)))
    swap = Matrix(((1, 0, 0), (0, 0, 1), (0, 1, 0)))
    f = Frame()
    f.matrix = Matrix.Translation(kit.at(*origin)) @ (swap @ babylon @ swap).to_4x4()
    return f


def stone(size, position, colour, seed, rotation=(0, 0, 0), lump=0.012):
    obj = rbox(size, position, colour, bevel=min(0.045, min(size) * 0.3), surface='stone', rotation=rotation, segments=2, dice=0.14)
    return mottle(displace(obj, lump, scale=5.5, seed=seed))


def hearth():
    parts = [rbox([2.64, 0.1, 1.1], (0, 0.05, 0), MORTAR, bevel=0.03, surface='stone')]
    widths = [0.5, 0.62, 0.44, 0.58, 0.5]
    x = -1.32
    for i, w in enumerate(widths):
        for j, (d, z) in enumerate(((0.5, -0.27), (0.58, 0.26))):
            parts.append(stone([w - 0.025, 0.07, d - 0.025], (x + w / 2, 0.12 + 0.004 * ((i + j) % 3), z), HEARTH, seed=i * 3 + j, lump=0.006))
        x += w
    parts.append(stone([2.66, 0.05, 0.1], (0, 0.1, 0.505), HEARTH, seed=31, lump=0.006))
    return parts


def walls():
    parts = [mottle(displace(rbox([2.34, 1.85, 0.13], (0, 1.07, -0.405), WALL, bevel=0.03, surface='stone', dice=0.2), 0.01, scale=4, seed=5)),
             rbox([1.75, 1.41, 0.033], (0, 0.87, -0.321), SOOT, bevel=0.01, surface='stone')]
    for row in range(1, 10):
        y = 0.2 + row * 0.13
        offset = 0.11 if row % 2 else 0.0
        for k in range(-4, 5):
            x = k * 0.21 + offset
            if abs(x) > 0.76:
                continue
            parts.append(rbox([0.19, 0.11, 0.02], (x, y, -0.3), BRICK if (row + k) % 3 else SOOT, bevel=0, surface='stone'))
    return parts


def piers():
    parts = []
    for side in (-1, 1):
        x = side * 0.99
        parts.append(stone([0.44, 0.115, 0.77], (x, 0.215, -0.025), PALE, seed=40 + side))
        for level in range(4):
            y = 0.3 + level * 0.28
            colour = PALE if level % 2 else STONE
            if level % 2:
                parts.append(stone([0.35, 0.25, 0.33], (x, y, -0.2), colour, seed=50 + level * 2 + side))
                parts.append(stone([0.35, 0.25, 0.34], (x, y, 0.15), STONE, seed=60 + level * 2 + side))
            else:
                parts.append(stone([0.35, 0.25, 0.69], (x, y, -0.025), colour, seed=70 + level * 2 + side))
    for i in range(11):
        angle = i / 10 * math.pi
        size = [0.33, 0.3 if i == 5 else 0.25, 0.74 if i == 5 else 0.7]
        colour = PALE if i % 2 else STONE
        parts.append(stone(size, (math.cos(angle) * 0.995, 1.09 + math.sin(angle) * 0.88 + (0.03 if i == 5 else 0), -0.025 + (0.02 if i == 5 else 0)), colour, seed=80 + i, rotation=(0, 0, angle + math.pi / 2)))
    key = Frame((0, 1.99, 0.37))
    parts.append(cylinder(0.05, 0.05, 0.012, (0, 0, 0), MOON, segments=20, bevel=0.004, frame=key, rotation=(math.pi / 2, 0, 0)))
    parts.append(cylinder(0.046, 0.046, 0.014, (0.024, 0.016, 0.004), PALE, segments=20, frame=key, rotation=(math.pi / 2, 0, 0)))
    return parts


def log(a, b, radius, colour, seed):
    a, b = Vector(a), Vector(b)
    f = axis_frame((a + b) / 2, b - a)
    length = (b - a).length
    bark = lambda ang, y: 0.07 * math.sin(ang * 7 + y * 9 + seed) + 0.03 * math.sin(ang * 13 - y * 5)
    profile = [(0.0, -length / 2)] + [(radius * (0.92 if i in (0, 5) else 1.0), -length / 2 + length * i / 5) for i in range(6)] + [(0.0, length / 2)]
    parts = [lathe(profile, (0, 0, 0), colour, segments=16, surface='wood', frame=f, wobble=bark)]
    for end in (-1, 1):
        parts.append(cylinder(radius * 0.84, radius * 0.84, 0.006, (0, end * length / 2, 0), END_GRAIN, segments=16, surface='wood', frame=f))
        parts.append(torus(radius * 0.45, 0.004, (0, end * (length / 2 + 0.003), 0), LOG_A, rotation=(math.pi / 2, 0, 0), major_segments=14, minor_segments=4, surface='wood', frame=f))
    return parts


def fire_bed():
    parts = log((-0.58, 0.285, -0.1), (0.53, 0.285, 0.17), 0.09, LOG_A, 1) + log((-0.52, 0.39, 0.18), (0.51, 0.39, -0.1), 0.084, LOG_B, 2)
    for i in range(7):
        x = -0.48 + i * 0.155
        parts.append(displace(sphere((0.055, 0.03, 0.05), (x, 0.2, 0.23 - (i % 2) * 0.05), EMBER, subdivisions=2, layer='glow'), 0.01, scale=9, seed=i))
    for i in range(9):
        x = -0.55 + i * 0.137
        parts.append(displace(sphere((0.045, 0.028, 0.04), (x, 0.19, 0.05 + (i % 3) * 0.07), '#3f3a34', subdivisions=1), 0.008, scale=9, seed=20 + i))
    parts.append(rbox([1.3, 0.04, 0.5], (0, 0.175, 0.02), '#5d5650', bevel=0.02, surface='stone'))
    for side in (-1, 1):
        x = side * 0.44
        parts.append(rbox([0.04, 0.05, 0.5], (x, 0.21, 0.1), IRON, bevel=0.012, surface='metal', layer='metal'))
        parts.append(rod((x, 0.17, 0.34), (x, 0.52, 0.36), 0.022, IRON, sides=10, surface='metal', layer='metal'))
        parts.append(sphere((0.034, 0.034, 0.034), (x, 0.55, 0.36), TRIM, subdivisions=2, surface='metal', layer='metal'))
        for dx in (-0.05, 0.05):
            parts.append(rod((x, 0.2, 0.34), (x + dx, 0.16, 0.37), 0.014, IRON, sides=8, surface='metal', layer='metal'))
    return parts


def grate():
    parts = []
    for x in (-0.6, -0.3, 0.0, 0.3, 0.6):
        parts.append(rod((x, 0.16, 0.395), (x, 0.44, 0.395), 0.019, IRON, sides=10, surface='metal', layer='metal'))
        parts.append(torus(0.035, 0.012, (x + 0.035, 0.44, 0.395), IRON, arc=math.pi * 1.3, major_segments=12, minor_segments=6, surface='metal', layer='metal'))
    parts.append(rod((-0.66, 0.37, 0.395), (0.66, 0.37, 0.395), 0.022, IRON, sides=10, surface='metal', layer='metal'))
    parts.append(rod((-0.66, 0.2, 0.395), (0.66, 0.2, 0.395), 0.018, IRON, sides=10, surface='metal', layer='metal'))
    for x in (-0.68, 0.68):
        parts.append(sphere((0.03, 0.03, 0.03), (x, 0.37, 0.395), TRIM, subdivisions=2, surface='metal', layer='metal'))
    return parts


def mantel():
    beam = mottle(displace(rbox([2.62, 0.14, 0.91], (0, 2.11, -0.025), WALNUT, bevel=0.03, surface='wood', dice=0.15), 0.004, scale=7, seed=9), 0.05, 9)
    parts = [beam, rbox([2.7, 0.11, 1.0], (0, 2.23, -0.025), SHELF, bevel=0.04, surface='wood', dice=0.3),
             rbox([2.52, 0.028, 0.025], (0, 2.17, 0.445), TRIM, bevel=0.007, surface='metal', layer='metal')]
    for k in range(13):
        parts.append(sphere((0.009, 0.009, 0.006), (-1.2 + k * 0.2, 2.17, 0.46), CORBEL_BRASS, subdivisions=1, surface='metal', layer='metal'))
    for x in (-1.18, 1.18):
        parts.append(cylinder(0.028, 0.028, 0.012, (x, 2.1, 0.435), SHELF, segments=12, bevel=0.004, surface='wood', rotation=(math.pi / 2, 0, 0)))
    for x in (-0.99, 0.99):
        parts.append(rbox([0.17, 0.08, 0.2], (x, 2.0, 0.36), WALNUT, bevel=0.02, surface='wood'))
        parts.append(rbox([0.15, 0.08, 0.13], (x, 1.93, 0.33), WALNUT, bevel=0.02, surface='wood'))
        parts.append(lathe([(0.0, 0.0), (0.075, 0.0), (0.07, 0.02), (0.05, 0.04), (0.0, 0.045)], (x, 1.892, 0.33), WALNUT, segments=16, surface='wood', rotation=(math.pi, 0, 0)))
        parts.append(rbox([0.063, 0.063, 0.012], (x, 2.0, 0.462), CORBEL_BRASS, bevel=0.005, surface='metal', layer='metal', rotation=(0, 0, math.pi / 4)))
    return parts


def book(width, height, depth, x, y, z, colour, angle):
    f = Frame((x, y, z), (0, angle, 0))
    return [rbox([width, height * 0.22, depth], (0, height * 0.39, 0), colour, bevel=0.008, surface='cloth', frame=f),
            rbox([width, height * 0.22, depth], (0, -height * 0.39, 0), colour, bevel=0.008, surface='cloth', frame=f),
            rbox([width - 0.03, height * 0.6, depth - 0.02], (0.012, 0, 0.0), PAPER, bevel=0.004, surface='paper', frame=f),
            lathe([(0.0, -depth / 2), (height / 2, -depth / 2), (height / 2, depth / 2), (0.0, depth / 2)], (-width / 2 + 0.012, 0, 0), colour, segments=12, surface='cloth', frame=f, rotation=(math.pi / 2, 0, 0)),
            rbox([0.012, height * 1.02, 0.03], (-width / 2 + 0.004, 0, depth * 0.3), TRIM, bevel=0.003, surface='metal', layer='metal', frame=f),
            rbox([0.012, height * 1.02, 0.03], (-width / 2 + 0.004, 0, -depth * 0.3), TRIM, bevel=0.003, surface='metal', layer='metal', frame=f)]


def candle(position, height, radius):
    f = Frame(position)
    parts = [lathe([(0.0, 0.0), (radius * 1.55, 0.0), (radius * 1.7, 0.012), (radius * 1.6, 0.022), (radius * 1.2, 0.03), (radius * 1.0, 0.045), (0.0, 0.045)], (0, 0, 0), HOLDER, segments=24, surface='metal', layer='metal', frame=f),
             torus(0.028, 0.006, (radius * 1.7 + 0.02, 0.02, 0), HOLDER, major_segments=12, minor_segments=5, surface='metal', layer='metal', frame=f)]
    body = [(0.0, 0.04)] + [(radius * (1 + 0.03 * math.sin(i * 2.1)), 0.04 + height * i / 6) for i in range(7)] + [(radius * 0.92, height + 0.046), (radius * 0.6, height + 0.036), (0.0, height + 0.03)]
    parts.append(lathe(body, (0, 0, 0), WAX, segments=16, surface='ceramic', frame=f))
    for a, drop in ((0.3, 0.3), (1.9, 0.18), (3.6, 0.4), (5.0, 0.22)):
        parts.append(sphere((radius * 0.2, height * drop * 0.5, radius * 0.2), (math.cos(a) * radius * 0.96, height + 0.04 - height * drop * 0.45, math.sin(a) * radius * 0.96), WAX, subdivisions=1, surface='ceramic', frame=f))
    parts.append(rod((0, height + 0.02, 0), (0.004, height + 0.07, 0), 0.005, WICK, sides=6, frame=f))
    flame = [(0.0, height + 0.06), (0.022, height + 0.08), (0.03, height + 0.11), (0.02, height + 0.16), (0.008, height + 0.19), (0.0, height + 0.205)]
    parts.append(lathe(flame, (0.004, 0, 0), FLAME, segments=14, layer='glow', frame=f))
    return parts


def painting():
    f = Frame((0.03, 2.615, -0.24))
    parts = []
    for y in (-0.3, 0.3):
        parts.append(rbox([0.61, 0.06, 0.075], (0, y, 0), FRAME, bevel=0.018, surface='wood', frame=f))
    for x in (-0.275, 0.275):
        parts.append(rbox([0.06, 0.6, 0.075], (x, 0, 0), FRAME, bevel=0.018, surface='wood', frame=f))
    parts.append(rbox([0.52, 0.56, 0.02], (0, 0, 0.012), SKY, bevel=0.004, surface='cloth', frame=f))
    parts.append(cylinder(0.1, 0.1, 0.006, (0.0, 0.04, 0.025), MOON, segments=28, frame=f, rotation=(math.pi / 2, 0, 0)))
    parts.append(cylinder(0.094, 0.094, 0.006, (0.045, 0.07, 0.028), SKY, segments=28, frame=f, rotation=(math.pi / 2, 0, 0)))
    for x, y, rx, ry in ((-0.1, -0.22, 0.15, 0.1), (0.12, -0.23, 0.13, 0.09)):
        parts.append(sphere((rx, ry, 0.004), (x, y, 0.024), HILLS, subdivisions=2, frame=f))
    for x, y, s in ((-0.17, 0.18, 0.02), (0.18, 0.2, 0.016), (-0.08, 0.1, 0.012), (0.15, -0.02, 0.012), (-0.2, 0.02, 0.014)):
        parts.append(rbox([s * 0.3, s * 1.6, 0.004], (x, y, 0.024), MOON, bevel=0, frame=f))
        parts.append(rbox([s * 1.6, s * 0.3, 0.004], (x, y, 0.024), MOON, bevel=0, frame=f))
    return parts


def mantel_props():
    parts = []
    for i in range(3):
        parts += book(0.54 - i * 0.035, 0.065, 0.35, -0.72, 2.32 + i * 0.068, -0.015, BOOKS[i], 0.11 if i == 1 else 0)
    parts += candle((0.73, 2.285, 0.035), 0.33, 0.074) + candle((1.0, 2.285, 0.09), 0.2, 0.056)
    jar = Frame((-0.34, 2.285, 0.02))
    parts.append(lathe([(0.0, 0.0), (0.05, 0.0), (0.058, 0.03), (0.06, 0.1), (0.045, 0.13), (0.04, 0.15), (0.046, 0.16), (0.0, 0.16)], (0, 0, 0), '#9fb3a8', segments=16, surface='ceramic', frame=jar))
    for k in range(5):
        a = k / 5 * math.tau
        tip = (math.cos(a) * 0.07, 0.34 + 0.03 * (k % 2), math.sin(a) * 0.05)
        parts.append(tube([(0, 0.12, 0), (tip[0] * 0.5, 0.25, tip[2] * 0.5), tip], 0.004, '#617853', surface='leaf', frame=jar, resolution=3))
        parts.append(sphere((0.012, 0.035, 0.012), (tip[0], tip[1] - 0.02, tip[2]), '#8e7fa8', subdivisions=1, surface='cloth', frame=jar))
    cup = Frame((0.38, 2.285, 0.14))
    parts.append(lathe([(0.0, 0.0), (0.04, 0.0), (0.05, 0.02), (0.058, 0.085), (0.052, 0.088), (0.047, 0.02), (0.0, 0.02)], (0, 0, 0), '#e7dec7', segments=20, surface='ceramic', frame=cup))
    parts.append(cylinder(0.049, 0.049, 0.004, (0, 0.07, 0), '#6b4a33', segments=16, frame=cup))
    parts.append(torus(0.026, 0.007, (0.058, 0.048, 0), '#e7dec7', arc=math.pi * 1.2, rotation=(0, 0, -math.pi * 0.6), major_segments=10, minor_segments=5, surface='ceramic', frame=cup))
    return parts


def hearth_props():
    parts = []
    stand = Frame((-1.12, 0.155, 0.4))
    parts.append(lathe([(0.0, 0.0), (0.09, 0.0), (0.095, 0.012), (0.06, 0.025), (0.02, 0.04), (0.0, 0.04)], (0, 0, 0), IRON, segments=20, surface='metal', layer='metal', frame=stand))
    parts.append(rod((0, 0.03, 0), (0, 0.72, 0), 0.012, IRON, sides=10, surface='metal', layer='metal', frame=stand))
    parts.append(sphere((0.026, 0.026, 0.026), (0, 0.74, 0), TRIM, subdivisions=2, surface='metal', layer='metal', frame=stand))
    parts.append(torus(0.06, 0.008, (0, 0.62, 0), IRON, rotation=(math.pi / 2, 0, 0), major_segments=18, minor_segments=5, surface='metal', layer='metal', frame=stand))
    for k, (a, tool) in enumerate(((0.4, 'poker'), (2.5, 'brush'), (4.4, 'shovel'))):
        x, z = math.cos(a) * 0.06, math.sin(a) * 0.06
        parts.append(rod((x, 0.66, z), (x * 1.3, 0.1, z * 1.3), 0.007, IRON, sides=8, surface='metal', layer='metal', frame=stand))
        parts.append(torus(0.018, 0.005, (x, 0.68, z), TRIM, major_segments=10, minor_segments=4, surface='metal', layer='metal', frame=stand))
        if tool == 'brush':
            parts.append(lathe([(0.0, 0.05), (0.02, 0.06), (0.035, 0.12), (0.024, 0.14), (0.0, 0.14)], (x * 1.3, 0, z * 1.3), '#caa26c', segments=12, surface='cloth', frame=stand))
        elif tool == 'shovel':
            parts.append(rbox([0.08, 0.1, 0.012], (x * 1.3, 0.1, z * 1.3), IRON, bevel=0.01, surface='metal', layer='metal', frame=stand, rotation=(0.1, a, 0)))
        else:
            parts.append(rod((x * 1.3, 0.1, z * 1.3), (x * 1.3 + 0.03, 0.14, z * 1.3), 0.007, IRON, sides=8, surface='metal', layer='metal', frame=stand))
    pile = Frame((1.08, 0.155, 0.42))
    for k, (x, y, turn) in enumerate(((-0.07, 0.045, 0.1), (0.07, 0.045, -0.05), (0.0, 0.12, 0.05))):
        g = Frame((x, y, 0), (0, turn, 0), pile)
        start, end = g.matrix @ kit.at(0, 0, -0.14), g.matrix @ kit.at(0, 0, 0.14)
        parts += log((start.x, start.z, start.y), (end.x, end.z, end.y), 0.045, LOG_B if k % 2 else LOG_A, 5 + k)
    return parts


def build():
    return hearth() + walls() + piers() + fire_bed() + grate() + mantel() + painting() + mantel_props() + hearth_props()
