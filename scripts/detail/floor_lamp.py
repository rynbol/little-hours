import math
import bmesh
import kit
from kit import Frame, cylinder, lathe, rbox, rod, sphere, torus, tube

BRASS, SHADE, RIB, DIFFUSER, FINIAL = '#bf9762', '#e2d2ab', '#c9b78f', '#f8dfa5', '#bf9762'
OAK, CORD, LINING, TASSEL = '#aa7954', '#6b5a48', '#ffe2a8', '#c98f66'
EYE = (0.55, 0.35, 1.0)


def shell(profile, position, colour, segments=28, surface='plain', layer='paint', frame=None, wobble=None):
    bm = bmesh.new()
    rings = []
    for radius, y in profile:
        ring = []
        for k in range(segments):
            a = k / segments * math.tau
            r = radius * (1 + (wobble(a, y) if wobble else 0))
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, y)))
        rings.append(ring)
    for i in range(len(rings)):
        lower, upper = rings[i], rings[(i + 1) % len(rings)]
        for k in range(segments):
            bm.faces.new((lower[k], lower[(k + 1) % segments], upper[(k + 1) % segments], upper[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return kit._finish(kit._mesh_from_bmesh(bm), colour, surface, layer, frame, position, (0, 0, 0))


def base():
    profile = [(0.0, 0.0), (0.3, 0.0), (0.312, 0.008), (0.31, 0.024), (0.29, 0.034), (0.25, 0.042), (0.2, 0.05), (0.15, 0.056),
               (0.11, 0.066), (0.085, 0.08), (0.07, 0.1), (0.058, 0.118), (0.064, 0.13), (0.05, 0.14), (0.0, 0.14)]
    parts = [lathe(profile, (0, 0, 0), BRASS, segments=40, surface='metal', layer='metal'),
             torus(0.3, 0.008, (0, 0.028, 0), RIB, rotation=(math.pi / 2, 0, 0), major_segments=40, minor_segments=6, surface='metal', layer='metal'),
             cylinder(0.29, 0.29, 0.006, (0, 0.003, 0), '#50564c', segments=36, surface='cloth')]
    for k in range(12):
        a = k / 12 * math.tau
        parts.append(sphere((0.012, 0.008, 0.012), (math.cos(a) * 0.19, 0.053, math.sin(a) * 0.19), BRASS, subdivisions=1, surface='metal', layer='metal'))
    return parts


def pole():
    shaft = [(0.0, 0.13)] + [(0.026, 0.13 + i * 0.1) for i in range(16)] + [(0.0, 1.63)]
    parts = [lathe(shaft, (0, 0, 0), BRASS, segments=16, surface='metal', layer='metal')]
    knuckle = [(0.0, -0.04), (0.03, -0.04), (0.04, -0.03), (0.042, -0.012), (0.034, 0.0), (0.042, 0.012), (0.04, 0.03), (0.03, 0.04), (0.0, 0.04)]
    for y in (0.36, 1.02, 1.42):
        parts.append(lathe(knuckle, (0, y, 0), BRASS, segments=18, surface='metal', layer='metal'))
    return parts


def tray():
    f = Frame((0, 0.84, 0))
    board = [(0.03, -0.015), (0.08, -0.015), (0.15, -0.015), (0.196, -0.015), (0.205, 0.0), (0.198, 0.015), (0.15, 0.015), (0.08, 0.015), (0.03, 0.015)]
    parts = [shell(board, (0, 0, 0), OAK, segments=36, surface='wood', frame=f),
             torus(0.198, 0.012, (0, 0.022, 0), '#bc9169', rotation=(math.pi / 2, 0, 0), major_segments=36, minor_segments=6, surface='wood', frame=f),
             lathe([(0.0, -0.08), (0.03, -0.08), (0.06, -0.04), (0.07, -0.015), (0.0, -0.015)], (0, 0, 0), BRASS, segments=18, surface='metal', layer='metal', frame=f)]
    for k in range(3):
        a = k / 3 * math.tau + 0.4
        parts.append(rod((math.cos(a) * 0.04, -0.07, math.sin(a) * 0.04), (math.cos(a) * 0.16, -0.02, math.sin(a) * 0.16), 0.007, BRASS, sides=8, surface='metal', layer='metal', frame=f))
    for i, (colour, w, turn) in enumerate((('#788e84', 0.2, 0.3), ('#bb8066', 0.18, 0.1))):
        g = Frame((-0.05, 0.03 + i * 0.034, 0.06), (0, turn, 0), f)
        parts.append(rbox([w, 0.03, 0.14], (0, 0, 0), colour, bevel=0.006, surface='cloth', frame=g))
        parts.append(rbox([w - 0.016, 0.022, 0.13], (0.006, 0, 0), '#f2ead5', bevel=0.003, surface='paper', frame=g))
    cup = Frame((0.09, 0.015, -0.08), parent=f)
    parts.append(lathe([(0.0, 0.0), (0.035, 0.0), (0.045, 0.02), (0.052, 0.07), (0.047, 0.072), (0.043, 0.02), (0.0, 0.02)], (0, 0, 0), '#e7dec7', segments=24, surface='ceramic', frame=cup))
    parts.append(cylinder(0.044, 0.044, 0.004, (0, 0.058, 0), '#6b4a33', segments=20, frame=cup))
    parts.append(torus(0.022, 0.006, (0.052, 0.04, 0), '#e7dec7', arc=math.pi * 1.2, rotation=(0, 0, -math.pi * 0.6), major_segments=10, minor_segments=6, surface='ceramic', frame=cup))
    return parts


def shade():
    pleats = lambda a, y: 0.022 * (0.5 + 0.5 * math.cos(a * 24))
    bottom, top = 1.678, 2.122
    flare = lambda t: 0.335 - 0.113 * (t ** 0.8)
    heights = [0.013, 0.058] + [i / 8 for i in range(1, 9)]
    outer = [(flare(t), bottom + (top - bottom) * t) for t in heights]
    profile = outer + [(r - 0.012, y) for r, y in reversed(outer)]
    parts = [shell(profile, (0, 0, 0), SHADE, segments=96, surface='cloth', wobble=pleats),
             shell([(0.318, bottom + 0.004), (0.214, top - 0.004), (0.206, top - 0.004), (0.31, bottom + 0.004)], (0, 0, 0), LINING, segments=40, layer='glow'),
             torus(0.338, 0.012, (0, bottom, 0), RIB, rotation=(math.pi / 2, 0, 0), major_segments=48, minor_segments=8, surface='cloth'),
             torus(0.226, 0.01, (0, top, 0), RIB, rotation=(math.pi / 2, 0, 0), major_segments=40, minor_segments=8, surface='cloth')]
    for k in range(24):
        a = (k + 0.5) / 24 * math.tau
        parts.append(sphere((0.012, 0.018, 0.012), (math.cos(a) * 0.338, bottom - 0.026, math.sin(a) * 0.338), RIB, subdivisions=1, surface='cloth'))
    parts.append(cylinder(0.3, 0.3, 0.008, (0, bottom + 0.03, 0), DIFFUSER, segments=40, layer='glow'))
    parts.append(cylinder(0.215, 0.215, 0.012, (0, top - 0.004, 0), '#e7dec7', segments=40, surface='paper'))
    parts.append(torus(0.1, 0.006, (0, top + 0.004, 0), RIB, rotation=(math.pi / 2, 0, 0), major_segments=24, minor_segments=5, surface='cloth'))
    for k in range(4):
        a = k / 4 * math.tau + math.pi / 4
        parts.append(rod((0, 1.63, 0), (math.cos(a) * 0.3, bottom + 0.03, math.sin(a) * 0.3), 0.006, BRASS, sides=6, surface='metal', layer='metal'))
    parts.append(lathe([(0.0, 1.61), (0.035, 1.61), (0.045, 1.635), (0.03, 1.66), (0.0, 1.66)], (0, 0, 0), BRASS, segments=18, surface='metal', layer='metal'))
    finial = [(0.0, top), (0.03, top), (0.022, top + 0.02), (0.03, top + 0.035), (0.038, top + 0.055), (0.034, top + 0.075), (0.02, top + 0.09), (0.006, top + 0.1), (0.0, top + 0.1)]
    parts.append(lathe(finial, (0, 0, 0), FINIAL, segments=18, surface='metal', layer='metal'))
    return parts


def pull_chain():
    parts = []
    for i in range(11):
        parts.append(sphere((0.008, 0.008, 0.008), (0.13, 1.69 - i * 0.021, 0.02), BRASS, subdivisions=1, surface='metal', layer='metal'))
    parts.append(lathe([(0.0, 1.43), (0.014, 1.44), (0.022, 1.47), (0.014, 1.49), (0.0, 1.495)], (0.13, 0, 0.02), TASSEL, segments=12, surface='cloth'))
    parts.append(lathe([(0.0, 1.35), (0.026, 1.35), (0.02, 1.4), (0.012, 1.44), (0.0, 1.44)], (0.13, 0, 0.02), TASSEL, segments=12, surface='cloth'))
    return parts


def cord():
    points = [(0.02, 0.9, -0.025), (0.03, 0.5, -0.03), (0.07, 0.14, -0.05), (0.2, 0.06, -0.15), (0.3, 0.012, -0.22), (0.36, 0.012, -0.1), (0.38, 0.012, 0.12)]
    parts = [tube(points, 0.009, CORD, surface='cloth', resolution=5),
             rbox([0.05, 0.022, 0.07], (0.325, 0.02, -0.2), '#e7dec7', bevel=0.008, rotation=(0, 0.6, 0)),
             cylinder(0.008, 0.008, 0.012, (0.325, 0.034, -0.2), '#c98f66', segments=10)]
    return parts


def build():
    return base() + pole() + tray() + shade() + pull_chain() + cord()
