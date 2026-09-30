import math
from kit import Frame, cylinder, lathe, rbox, rod, sphere, torus, tube
from study_desk import book
from writing_desk import scaled
from bookcase import basket

BRASS, TYRE, WOOD, EDGE, CREAM, PAPER, BISCUIT = '#bf9762', '#50564c', '#aa7954', '#bc9169', '#e7dec7', '#f2ead5', '#d7b572'
SAGE, TERRACOTTA, GRIP = '#83968a', '#bd8469', '#73533d'
BOOKS = ['#bb8066', '#a4ac8e']
EYE = (0.4, 0.6, 1.0)


def metal(**kw):
    return dict(surface='metal', layer='metal', **kw)


def wheel(x, z):
    f = Frame((x, 0.07, z), (0, 0, math.pi / 2))
    parts = [torus(0.05, 0.016, (0, 0, 0), TYRE, rotation=(math.pi / 2, 0, 0), major_segments=20, minor_segments=6, frame=f),
             cylinder(0.018, 0.018, 0.036, (0, 0, 0), BRASS, segments=12, bevel=0.005, frame=f, **metal())]
    for k in range(5):
        a = k / 5 * math.tau
        parts.append(rod((0, 0, 0), (math.cos(a) * 0.045, 0, math.sin(a) * 0.045), 0.004, BRASS, sides=5, frame=f, **metal()))
    return parts


def frame_and_trays():
    parts = []
    for x in (-0.5, 0.5):
        for z in (-0.26, 0.26):
            parts.append(rod((x, 0.1, z), (x, 0.92, z), 0.018, BRASS, sides=12, **metal()))
            parts.append(sphere((0.026, 0.026, 0.026), (x, 0.935, z), BRASS, subdivisions=2, **metal()))
            parts.append(cylinder(0.024, 0.02, 0.03, (x, 0.1, z), BRASS, segments=12, **metal()))
            for y in (0.3, 0.78):
                parts.append(cylinder(0.026, 0.026, 0.022, (x, y - 0.03, z), BRASS, segments=12, bevel=0.006, **metal()))
            parts.append(rod((x, 0.09, z), (x, 0.07, z), 0.03, BRASS, sides=10, **metal()))
            parts += wheel(x, z)
    for y in (0.3, 0.78):
        for i in range(4):
            span = 0.6 / 4
            parts.append(rbox([1.04, 0.03, span - 0.004], (0, y, -0.3 + span * (i + 0.5)), WOOD, bevel=0.008, segments=2, surface='wood', dice=0.3))
        for z in (-0.29, 0.29):
            parts.append(rbox([1.08, 0.05, 0.02], (0, y + 0.035, z), EDGE, bevel=0.008, segments=1, surface='wood'))
        for x in (-0.53, 0.53):
            parts.append(rbox([0.02, 0.05, 0.6], (x, y + 0.035, 0), EDGE, bevel=0.008, segments=1, surface='wood'))
    for z in (-0.26, 0.26):
        parts.append(tube([(0.5, 0.92, z), (0.53, 0.96, z * 1.02), (0.5, 0.98, z * 0.96)], 0.014, BRASS, resolution=4, surface='metal', layer='metal'))
    parts.append(rod((0.5, 0.98, -0.25), (0.5, 0.98, 0.25), 0.02, BRASS, **metal()))
    parts.append(rod((0.5, 0.98, -0.12), (0.5, 0.98, 0.12), 0.027, GRIP, sides=14, surface='wood'))
    return parts


def teapot():
    f = Frame((-0.22, 0.795, 0))
    body = [(0.0, 0.0), (0.075, 0.0), (0.085, 0.01), (0.078, 0.02), (0.11, 0.05), (0.132, 0.1), (0.13, 0.14), (0.11, 0.18), (0.08, 0.2), (0.074, 0.205), (0.072, 0.2), (0.0, 0.2)]
    lid = [(0.0, 0.2), (0.07, 0.2), (0.068, 0.212), (0.05, 0.225), (0.02, 0.232), (0.0, 0.233)]
    parts = [lathe(body, (0, 0, 0), CREAM, segments=32, surface='ceramic', frame=f),
             lathe(lid, (0, 0, 0), CREAM, segments=24, surface='ceramic', frame=f),
             sphere((0.022, 0.018, 0.022), (0, 0.245, 0), SAGE, subdivisions=2, surface='ceramic', frame=f),
             torus(0.131, 0.006, (0, 0.12, 0), SAGE, rotation=(math.pi / 2, 0, 0), major_segments=32, minor_segments=5, surface='ceramic', frame=f),
             torus(0.12, 0.005, (0, 0.06, 0), TERRACOTTA, rotation=(math.pi / 2, 0, 0), major_segments=32, minor_segments=5, surface='ceramic', frame=f)]
    for k in range(7):
        a = k / 7 * math.tau + 0.4
        for j, (dy, colour) in enumerate(((0.095, TERRACOTTA), (0.145, SAGE))):
            r = 0.133 if j == 0 else 0.126
            parts.append(rbox([0.016, 0.016, 0.006], (math.cos(a + j * 0.45) * r, dy, math.sin(a + j * 0.45) * r), colour, bevel=0, surface='ceramic', frame=f, rotation=(0, -(a + j * 0.45) + math.pi / 2, math.pi / 4)))
    spout = [(0.11, 0.09, 0), (0.14, 0.1, 0), (0.16, 0.14, 0), (0.17, 0.2, 0)]
    parts.append(tube(spout, 0.03, CREAM, tip=0.42, frame=f, resolution=5))
    parts.append(torus(0.075, 0.013, (-0.13, 0.12, 0), CREAM, rotation=(0, 0, math.pi / 2), arc=math.pi, major_segments=18, minor_segments=7, surface='ceramic', frame=f))
    return parts


def teacup(x, y, z, angle):
    f = Frame((x, y, z), (0, angle, 0))
    cup = [(0.0, 0.012), (0.03, 0.012), (0.036, 0.018), (0.05, 0.05), (0.062, 0.09), (0.064, 0.095), (0.058, 0.096), (0.054, 0.09), (0.044, 0.05), (0.0, 0.03)]
    return [lathe([(0.0, 0.0), (0.09, 0.0), (0.094, 0.006), (0.09, 0.012), (0.04, 0.01), (0.0, 0.012)], (0, 0, 0), CREAM, segments=20, surface='ceramic', frame=f),
            lathe(cup, (0, 0, 0), CREAM, segments=20, surface='ceramic', frame=f),
            cylinder(0.055, 0.055, 0.004, (0, 0.074, 0), '#8f5a36', segments=24, frame=f),
            torus(0.059, 0.004, (0, 0.078, 0), SAGE, rotation=(math.pi / 2, 0, 0), major_segments=24, minor_segments=4, surface='ceramic', frame=f),
            torus(0.024, 0.007, (0.066, 0.062, 0), CREAM, rotation=(0, 0, -math.pi / 2), arc=math.pi, major_segments=12, minor_segments=5, surface='ceramic', frame=f)]


def biscuits():
    f = Frame((0.3, 0.795, 0.14))
    parts = [lathe([(0.0, 0.0), (0.07, 0.0), (0.08, 0.006), (0.1, 0.012), (0.112, 0.02), (0.104, 0.021), (0.07, 0.01), (0.0, 0.01)], (0, 0, 0), PAPER, segments=32, surface='ceramic', frame=f)]
    for i, (dx, dz, tilt) in enumerate(((-0.03, -0.02, 0.0), (0.0, 0.02, 0.0), (0.03, -0.01, 0.0), (0.0, -0.005, 0.25))):
        y = 0.02 if i < 3 else 0.04
        parts.append(cylinder(0.028, 0.028, 0.014, (dx, y, dz), BISCUIT, segments=12, bevel=0.005, surface='paper', frame=f, rotation=(tilt, i, 0)))
        for k in range(2):
            a = k * 2.6 + i
            parts.append(rbox([0.008, 0.004, 0.008], (dx + math.cos(a) * 0.011, y + 0.0075, dz + math.sin(a) * 0.011), '#8f5a36', bevel=0, frame=f, rotation=(tilt, a, 0)))
    return parts


def honey_jar(x, y, z):
    f = Frame((x, y, z))
    return [lathe([(0.0, 0.0), (0.04, 0.0), (0.05, 0.02), (0.052, 0.07), (0.04, 0.09), (0.035, 0.1), (0.0, 0.1)], (0, 0, 0), '#d8a44e', segments=18, **metal(frame=f)),
            cylinder(0.042, 0.042, 0.018, (0, 0.105, 0), '#e7dec7', segments=18, bevel=0.004, surface='cloth', frame=f),
            torus(0.036, 0.003, (0, 0.1, 0), TERRACOTTA, rotation=(math.pi / 2, 0, 0), major_segments=18, minor_segments=4, frame=f),
            rod((0.0, 0.1, 0.0), (0.05, 0.19, 0.03), 0.004, WOOD, sides=6, surface='wood', frame=f)]


def build():
    parts = frame_and_trays() + teapot()
    parts += teacup(0.12, 0.795, 0.12, 0.3) + teacup(0.26, 0.795, -0.1, 2.2)
    parts += biscuits()
    parts += honey_jar(0.4, 0.795, -0.16)
    parts += book(0.3, 0.05, 0.22, -0.2, 0.34, 0, BOOKS[0], 0.1)
    parts += book(0.28, 0.045, 0.2, -0.2, 0.39, 0, BOOKS[1], -0.05)
    parts += scaled(basket(0.24, 0.315, 0), (0.24, 0.315, 0), 0.75)
    return parts
