import math
from mathutils import Matrix, Vector
import kit
from kit import Frame, cylinder, lathe, rbox, rod, sphere, torus

WOOD, DARK, CANVAS, JAR, BRASS = '#aa7954', '#73533d', '#f1e6cf', '#b6c0b0', '#bf9762'
PAINTS = ['#c77868', '#d7b572', '#6f8aa6', '#83968a', '#e7dec7']
EYE = (0.55, 0.3, 1.0)


def axis_frame(origin, direction):
    d = direction.normalized()
    p = Vector((d.z, 0, -d.x)).normalized() if abs(d.y) < 0.999 else Vector((1, 0, 0))
    q = p.cross(d)
    babylon = Matrix(((p.x, d.x, q.x), (p.y, d.y, q.y), (p.z, d.z, q.z)))
    swap = Matrix(((1, 0, 0), (0, 0, 1), (0, 1, 0)))
    f = Frame()
    f.matrix = Matrix.Translation(kit.at(*origin)) @ (swap @ babylon @ swap).to_4x4()
    return f


def beam(a, b, width, depth, colour, bevel=0.008):
    a, b = Vector(a), Vector(b)
    f = axis_frame((a + b) / 2, b - a)
    return rbox([width, (b - a).length, depth], (0, 0, 0), colour, bevel=bevel, surface='wood', frame=f, dice=0.25), f, (b - a).length


def frame_legs():
    parts = []
    for side in (-1, 1):
        leg, f, length = beam((side * 0.34, 0.012, 0.22), (side * 0.09, 2.08, -0.02), 0.06, 0.04, WOOD)
        parts.append(leg)
        parts.append(rbox([0.066, 0.03, 0.046], (0, -length / 2 + 0.02, 0), DARK, bevel=0.008, surface='wood', frame=f))
        for k in range(7):
            parts.append(cylinder(0.008, 0.008, 0.012, (0, -length / 2 + 0.55 + k * 0.1, -0.02), DARK, segments=8, frame=f, rotation=(math.pi / 2, 0, 0)))
    parts.append(beam((0, 0.012, -0.44), (0, 1.98, -0.06), 0.05, 0.036, WOOD)[0])
    parts.append(rbox([0.24, 0.07, 0.05], (0, 2.035, -0.03), DARK, bevel=0.012, surface='wood'))
    parts.append(cylinder(0.012, 0.012, 0.3, (0, 2.03, -0.035), BRASS, segments=10, surface='metal', layer='metal', rotation=(0, 0, math.pi / 2)))
    for side in (-1, 1):
        parts.append(lathe([(0.0, 0.0), (0.022, 0.0), (0.026, 0.01), (0.016, 0.02), (0.0, 0.022)], (side * 0.15, 2.03, -0.035), BRASS, segments=12, surface='metal', layer='metal', rotation=(0, 0, -side * math.pi / 2)))
    parts.append(rbox([0.62, 0.04, 0.04], (0, 0.8, 0.16), DARK, bevel=0.01, surface='wood', dice=0.2))
    for x in (-0.3, 0.3):
        parts.append(sphere((0.022, 0.022, 0.022), (x, 0.8, 0.16), DARK, subdivisions=2, surface='wood'))
    parts.append(rod((0, 0.65, -0.3), (0, 0.78, 0.14), 0.014, DARK, sides=10, surface='wood'))
    parts.append(rod((-0.3, 0.3, 0.186), (0.0, 0.3, -0.384), 0.006, '#c9b78f', sides=6, surface='cloth'))
    parts.append(rod((0.3, 0.3, 0.186), (0.0, 0.3, -0.384), 0.006, '#c9b78f', sides=6, surface='cloth'))
    return parts


def canvas():
    f = Frame((0, 1.46, 0.14), (-0.17, 0, 0))
    parts = [rbox([0.9, 1.14, 0.034], (0, 0, 0.0), CANVAS, bevel=0.01, surface='cloth', frame=f, dice=0.3)]
    for x in (-0.43, 0.43):
        parts.append(rbox([0.04, 1.1, 0.04], (x, 0, -0.035), '#caa26c', bevel=0.006, surface='wood', frame=f))
    for y in (-0.55, 0.0, 0.55):
        parts.append(rbox([0.82, 0.04, 0.03], (0, y, -0.035), '#caa26c', bevel=0.006, surface='wood', frame=f))
    for x in (-0.451, 0.451):
        for k in range(6):
            parts.append(rbox([0.004, 0.02, 0.008], (x, -0.45 + k * 0.18, 0.0), '#9c958a', bevel=0, frame=f))
    ledge = [rbox([0.96, 0.05, 0.14], (0, -0.6, 0.05), DARK, bevel=0.012, surface='wood', frame=f, dice=0.25),
             rbox([0.96, 0.026, 0.018], (0, -0.568, 0.111), DARK, bevel=0.007, surface='wood', frame=f)]
    parts += ledge
    for x, colour, stretch in ((-0.3, PAINTS[0], 0.018), (-0.05, PAINTS[2], 0.012), (0.14, PAINTS[1], 0.02), (0.4, PAINTS[3], 0.01)):
        parts.append(sphere((0.008, stretch, 0.004), (x, -0.6 - stretch * 0.4, 0.12), colour, subdivisions=2, frame=f))
    parts.append(rbox([0.14, 0.07, 0.07], (0, 0.6, 0.01), DARK, bevel=0.014, surface='wood', frame=f))
    parts.append(lathe([(0.0, 0.0), (0.02, 0.0), (0.024, 0.012), (0.016, 0.022), (0.0, 0.024)], (0, 0.6, 0.045), BRASS, segments=12, surface='metal', layer='metal', frame=f, rotation=(math.pi / 2, 0, 0)))
    parts += tubes(f) + jar(f)
    return parts


def tubes(f):
    parts = []
    for i, (x, colour, turn) in enumerate(((-0.33, PAINTS[0], 0.15), (-0.2, PAINTS[2], -0.1), (-0.08, PAINTS[1], 0.3))):
        t = Frame((x, -0.558, 0.04 + i * 0.012), (0, turn, math.pi / 2), f)
        body = [(0.0, -0.05), (0.004, -0.05), (0.016, -0.04), (0.018, -0.01), (0.017, 0.03), (0.012, 0.045), (0.0, 0.048)]
        parts.append(lathe(body, (0, 0, 0), '#d8d4c8', segments=12, surface='metal', layer='metal', frame=t))
        parts.append(cylinder(0.0185, 0.0185, 0.03, (0, -0.02, 0), colour, segments=12, frame=t))
        parts.append(cylinder(0.009, 0.009, 0.016, (0, 0.054, 0), colour, segments=10, frame=t))
    parts.append(sphere((0.03, 0.006, 0.022), (-0.05, -0.571, 0.07), PAINTS[0], subdivisions=2, frame=f))
    return parts


def jar(f):
    j = Frame((0.32, -0.575, 0.07), parent=f)
    profile = [(0.0, 0.0), (0.038, 0.0), (0.044, 0.008), (0.046, 0.08), (0.05, 0.1), (0.044, 0.104), (0.04, 0.084), (0.038, 0.012), (0.0, 0.012)]
    parts = [lathe(profile, (0, 0, 0), JAR, segments=20, surface='ceramic', frame=j),
             cylinder(0.04, 0.04, 0.004, (0, 0.07, 0), '#8fa8b4', segments=16, frame=j),
             torus(0.047, 0.005, (0, 0.06, 0), '#6b4b3b', rotation=(math.pi / 2, 0, 0), major_segments=20, minor_segments=5, surface='cloth', frame=j)]
    for dx, dz, colour, lean in ((-0.012, 0.0, PAINTS[0], -0.16), (0.014, 0.01, PAINTS[1], 0.18), (0.0, -0.012, PAINTS[2], 0.05), (0.006, 0.014, PAINTS[3], -0.05)):
        top = Vector((dx * 3 + lean * 0.3, 0.26, dz * 3))
        base = Vector((dx, 0.02, dz))
        parts.append(rod(tuple(base), tuple(base + (top - base) * 0.8), 0.006, DARK, sides=8, surface='wood', frame=j))
        ferrule = base + (top - base) * 0.8
        parts.append(rod(tuple(ferrule), tuple(base + (top - base) * 0.9), 0.0068, BRASS, sides=8, surface='metal', layer='metal', frame=j))
        tip = base + (top - base) * 0.97
        parts.append(sphere((0.008, 0.02, 0.008), tuple(tip), colour, subdivisions=2, frame=j))
    return parts


def palette():
    f = Frame((-0.02, 0.62, 0.19), (-0.08, 0, 0.2))
    kidney = lambda a, y: 0.18 * math.cos(a) + 0.06 * math.cos(2 * a)
    parts = [lathe([(0.0, -0.006), (0.15, -0.006), (0.152, 0.0), (0.15, 0.006), (0.0, 0.006)], (0, 0, 0), '#caa26c', segments=32, surface='wood', frame=f, rotation=(math.pi / 2, 0, 0), wobble=kidney)]
    for k, colour in enumerate(PAINTS[:4] + ['#c7a696', '#f2ead5']):
        a = 0.5 + k * 0.62
        parts.append(sphere((0.022, 0.022, 0.009), (math.cos(a) * 0.1, math.sin(a) * 0.09, 0.008), colour, subdivisions=2, frame=f))
    parts.append(cylinder(0.016, 0.016, 0.014, (0.0, 0.1, 0.0), '#50564c', segments=12, frame=f, rotation=(math.pi / 2, 0, 0)))
    parts.append(rod((-0.02, 0.82, 0.16), (-0.02, 0.73, 0.2), 0.006, '#c9b78f', sides=6, surface='cloth'))
    return parts


def build():
    return frame_legs() + canvas() + palette()
