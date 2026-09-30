import math
import bmesh
import kit
from kit import Frame, cylinder, lathe, rbox, rod, sphere, torus, tube

DARK, WOOD, BRASS = '#73533d', '#aa7954', '#bf9762'
PAPER, INK, RIBBON = '#f2ead5', '#697361', '#bb8066'
TILT, CENTRE = 0.41, 1.07
EYE = (0.4, 0.35, 1.0)


def shell(profile, position, colour, segments=28, surface='plain', layer='paint', frame=None, rotation=(0, 0, 0)):
    bm = bmesh.new()
    rings = [[bm.verts.new((math.cos(k / segments * math.tau) * r, math.sin(k / segments * math.tau) * r, y)) for k in range(segments)] for r, y in profile]
    for i in range(len(rings)):
        lower, upper = rings[i], rings[(i + 1) % len(rings)]
        for k in range(segments):
            bm.faces.new((lower[k], lower[(k + 1) % segments], upper[(k + 1) % segments], upper[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return kit._finish(kit._mesh_from_bmesh(bm), colour, surface, layer, frame, position, rotation)


def world(frame, point):
    p = frame.matrix @ kit.at(*point)
    return (p.x, p.z, p.y)


def stand():
    plinth = [(0.0, 0.022), (0.27, 0.022), (0.298, 0.03), (0.302, 0.045), (0.29, 0.055), (0.27, 0.06), (0.25, 0.072), (0.2, 0.08), (0.12, 0.085), (0.0, 0.085)]
    parts = [lathe(plinth, (0, 0, 0), DARK, segments=40, surface='wood')]
    for k in range(3):
        a = k / 3 * math.tau + math.pi / 2
        parts.append(lathe([(0.0, 0.0), (0.035, 0.0), (0.045, 0.012), (0.04, 0.026), (0.0, 0.03)], (math.cos(a) * 0.22, 0, math.sin(a) * 0.22), DARK, segments=14, surface='wood'))
    collar = [(0.0, 0.08), (0.085, 0.08), (0.088, 0.1), (0.07, 0.115), (0.058, 0.14), (0.05, 0.16), (0.0, 0.16)]
    parts.append(lathe(collar, (0, 0, 0), DARK, segments=24, surface='wood'))
    column = [(0.0, 0.155), (0.036, 0.155), (0.046, 0.175), (0.036, 0.195), (0.03, 0.22), (0.042, 0.28), (0.056, 0.34), (0.058, 0.38), (0.05, 0.42),
              (0.036, 0.47), (0.03, 0.52), (0.034, 0.56), (0.044, 0.58), (0.034, 0.6), (0.028, 0.63), (0.0, 0.63)]
    parts.append(lathe(column, (0, 0, 0), WOOD, segments=20, surface='wood'))
    cup = [(0.0, 0.62), (0.03, 0.62), (0.05, 0.64), (0.062, 0.67), (0.064, 0.7), (0.056, 0.73), (0.066, 0.745), (0.06, 0.755), (0.0, 0.75)]
    parts.append(lathe(cup, (0, 0, 0), DARK, segments=24, surface='wood'))
    return parts


def horizon():
    band = [(0.36, 1.056), (0.41, 1.056), (0.414, 1.07), (0.41, 1.084), (0.36, 1.084), (0.356, 1.07)]
    parts = [shell(band, (0, 0, 0), DARK, segments=56, surface='wood'),
             shell([(0.366, 1.085), (0.404, 1.085), (0.404, 1.088), (0.366, 1.088)], (0, 0, 0), PAPER, segments=56, surface='paper')]
    for k in range(48):
        a = k / 48 * math.tau
        long = k % 4 == 0
        parts.append(rbox([0.018 if long else 0.01, 0.002, 0.003], (math.cos(a) * (0.393 if long else 0.398), 1.089, math.sin(a) * (0.393 if long else 0.398)), INK, bevel=0, rotation=(0, -a, 0)))
    for k in range(4):
        a = k / 4 * math.tau + math.pi / 4
        c, s = math.cos(a), math.sin(a)
        points = [(c * 0.05, 0.735, s * 0.05), (c * 0.2, 0.75, s * 0.2), (c * 0.33, 0.83, s * 0.33), (c * 0.38, 0.95, s * 0.38), (c * 0.385, 1.054, s * 0.385)]
        parts.append(tube(points, 0.016, WOOD, tip=0.7, surface='wood', resolution=5))
        parts.append(sphere((0.024, 0.016, 0.024), (c * 0.385, 1.05, s * 0.385), DARK, subdivisions=2, surface='wood'))
    return parts


def meridian():
    f = Frame((0, CENTRE, 0), (0, 0, TILT))
    ring = [(0.325, -0.011), (0.347, -0.011), (0.349, 0.0), (0.347, 0.011), (0.325, 0.011), (0.323, 0.0)]
    parts = [shell(ring, (0, 0, 0), BRASS, segments=72, surface='metal', layer='metal', frame=f, rotation=(math.pi / 2, 0, 0))]
    for k in range(72):
        a = k / 72 * math.tau
        long = k % 6 == 0
        r = 0.34 if long else 0.343
        parts.append(rbox([0.003, 0.012 if long else 0.007, 0.002], (math.cos(a) * r, math.sin(a) * r, 0.0115), '#8c6547', bevel=0, frame=f, rotation=(0, 0, a - math.pi / 2)))
    for y in (-1, 1):
        pin = Frame((0, y * 0.3, 0), (0, 0, 0 if y > 0 else math.pi), f)
        parts.append(lathe([(0.0, 0.0), (0.012, 0.0), (0.012, 0.03), (0.02, 0.034), (0.024, 0.05), (0.02, 0.058), (0.0, 0.06)], (0, 0, 0), BRASS, segments=14, surface='metal', layer='metal', frame=pin))
    dial = Frame((0, 0.366, 0), parent=f)
    parts.append(cylinder(0.052, 0.052, 0.006, (0, 0, 0), BRASS, segments=28, bevel=0.002, surface='metal', layer='metal', frame=dial))
    parts.append(cylinder(0.044, 0.044, 0.002, (0, 0.004, 0), PAPER, segments=28, surface='paper', frame=dial))
    for k in range(12):
        a = k / 12 * math.tau
        parts.append(rbox([0.002, 0.001, 0.01], (math.cos(a) * 0.036, 0.0055, math.sin(a) * 0.036), INK, bevel=0, frame=dial, rotation=(0, -a + math.pi / 2, 0)))
    parts.append(rod((0, 0.005, 0), (0.03, 0.006, 0.0), 0.0025, '#3f3a34', sides=6, frame=dial))
    parts.append(sphere((0.008, 0.008, 0.008), (0, 0.008, 0), BRASS, subdivisions=1, surface='metal', layer='metal', frame=dial))
    foot = world(f, (0, -0.349, 0))
    parts.append(lathe([(0.0, 0.0), (0.022, 0.0), (0.026, 0.012), (0.018, 0.02), (0.0, 0.022)], (0, 0.74, 0), BRASS, segments=16, surface='metal', layer='metal'))
    parts.append(tube([(0, 0.755, 0), (foot[0] * 0.5, 0.748, 0), (foot[0], foot[1] - 0.004, 0)], 0.009, BRASS, surface='metal', layer='metal', resolution=4))
    saddle = Frame(foot, (0, 0, TILT))
    parts.append(rbox([0.03, 0.02, 0.044], (0, -0.004, 0), BRASS, bevel=0.006, surface='metal', layer='metal', frame=saddle))
    return parts


def scroll():
    f = Frame((0.19, 0.1, 0.1), (0, 0.9, math.pi / 2))
    parts = [cylinder(0.018, 0.018, 0.2, (0, 0, 0), PAPER, segments=16, bevel=0.004, surface='paper', frame=f),
             cylinder(0.019, 0.019, 0.012, (0, 0.09, 0), '#d5b77c', segments=16, bevel=0.003, surface='paper', frame=f),
             torus(0.02, 0.004, (0, -0.02, 0), RIBBON, rotation=(math.pi / 2, 0, 0), major_segments=14, minor_segments=5, surface='cloth', frame=f)]
    parts.append(tube([(0.19, 0.083, 0.1), (0.24, 0.086, 0.14), (0.27, 0.086, 0.12)], 0.003, RIBBON, surface='cloth', resolution=3))
    return parts


def build():
    return stand() + horizon() + meridian() + scroll()
