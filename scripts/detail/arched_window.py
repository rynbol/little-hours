import math
import bmesh
import kit
from kit import at, cylinder, rbox, rod, sphere, torus
from cottage_window import DARK, EDGE, WOOD, curtain, curtain_rod, hinge, latch, potted_plant, sill_books, tie_back

EYE = (0.3, 0.2, 1.0)
AO = 0.55
SPRING, RADIUS, HALF_W, HALF_H = 0.6, 0.5, 0.55, 1.15


def prism(outline, back, front, colour, surface='wood'):
    bm = bmesh.new()
    rear = [bm.verts.new(at(x, y, back)) for x, y in outline]
    face = [bm.verts.new(at(x, y, front)) for x, y in outline]
    bm.faces.new(face)
    bm.faces.new(list(reversed(rear)))
    for k in range(len(outline)):
        bm.faces.new((rear[k], rear[(k + 1) % len(outline)], face[(k + 1) % len(outline)], face[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._mesh_from_bmesh(bm, 'spandrel')
    kit._finish(obj, colour, surface, 'paint', None, (0, 0, 0), (0, 0, 0))
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def spandrel(side):
    arc = [(side * math.sin(k / 12 * math.pi / 2) * RADIUS, SPRING + math.cos(k / 12 * math.pi / 2) * RADIUS) for k in range(13)]
    outline = [(side * HALF_W, SPRING), (side * HALF_W, HALF_H), (0, HALF_H)] + arc
    if side > 0:
        outline.reverse()
    return prism(outline, -0.1, 0.04, WOOD)


def frame():
    parts = []
    for x in (HALF_W - 0.05, -HALF_W + 0.05):
        parts.append(rbox([0.1, SPRING + HALF_H, 0.1], (x, (SPRING - HALF_H) / 2, 0.05), WOOD, bevel=0.018, surface='wood', segments=2))
    parts.append(rbox([HALF_W * 2, 0.1, 0.1], (0, -HALF_H + 0.05, 0.05), WOOD, bevel=0.018, surface='wood', segments=2))
    parts += [spandrel(-1), spandrel(1)]
    parts.append(rbox([HALF_W * 2, 0.05, 0.1], (0, HALF_H - 0.025, 0.05), WOOD, bevel=0.018, surface='wood', segments=2))
    parts.append(torus(RADIUS - 0.02, 0.04, (0, SPRING, 0.06), EDGE, arc=math.pi, major_segments=28, minor_segments=8, surface='wood'))
    parts.append(rbox([0.1, 0.13, 0.06], (0, SPRING + RADIUS - 0.01, 0.1), EDGE, bevel=0.015, surface='wood', segments=2))
    for side in (-1, 1):
        parts.append(rbox([0.12, 0.05, 0.05], (side * (RADIUS - 0.02), SPRING - 0.02, 0.07), EDGE, bevel=0.012, surface='wood', segments=2))
    return parts


def glazing():
    parts = [rbox([0.04, SPRING + RADIUS + HALF_H - 0.12, 0.05], (0, (SPRING + RADIUS - HALF_H) / 2 - 0.02, 0.03), EDGE, bevel=0.008, surface='wood', segments=2)]
    for y in (-0.45, 0.15):
        parts.append(rbox([RADIUS * 2 - 0.06, 0.035, 0.045], (0, y, 0.03), EDGE, bevel=0.008, surface='wood', segments=2))
    parts.append(rbox([RADIUS * 2 - 0.06, 0.045, 0.05], (0, SPRING, 0.03), EDGE, bevel=0.01, surface='wood', segments=2))
    for a in (math.pi / 4, 3 * math.pi / 4):
        inner, outer = 0.1, RADIUS - 0.04
        parts.append(rod((math.cos(a) * inner, SPRING + math.sin(a) * inner, 0.03), (math.cos(a) * outer, SPRING + math.sin(a) * outer, 0.03), 0.014, EDGE, sides=8, surface='wood'))
    parts.append(torus(0.1, 0.016, (0, SPRING, 0.03), EDGE, arc=math.pi, major_segments=12, minor_segments=6, surface='wood'))
    parts.append(cylinder(0.035, 0.035, 0.03, (0, SPRING + 0.01, 0.045), EDGE, segments=14, bevel=0.006, surface='wood', rotation=(math.pi / 2, 0, 0)))
    return parts


def reveal():
    parts = []
    for x in (0.47, -0.47):
        parts.append(rbox([0.04, 2.1, 0.13], (x, -0.03, -0.065), EDGE, bevel=0.006, surface='wood', segments=1))
    parts.append(rbox([0.98, 0.04, 0.13], (0, -1.07, -0.065), EDGE, bevel=0.006, surface='wood', segments=1))
    return parts


def sill():
    parts = [rbox([1.22, 0.07, 0.24], (0, -1.115, 0.12), DARK, bevel=0.025, surface='wood', segments=2),
             rbox([1.02, 0.07, 0.03], (0, -1.18, 0.03), DARK, bevel=0.012, surface='wood', segments=2)]
    for x in (-0.42, 0.42):
        parts.append(rbox([0.05, 0.1, 0.14], (x, -1.2, 0.07), DARK, bevel=0.02, surface='wood', segments=2))
        parts.append(sphere((0.022, 0.022, 0.022), (x, -1.26, 0.12), DARK, subdivisions=1, surface='wood'))
    return parts


def build():
    parts = frame() + glazing() + reveal() + sill()
    for y in (0.3, -0.8):
        parts += hinge(0.44, y, 0.06, 1) + hinge(-0.44, y, 0.06, -1)
    parts += latch(-0.035, -0.15, 0.06)
    parts += potted_plant(0.3, -1.08, 0.13, scale=0.85)
    parts += sill_books(-0.28, -1.08, 0.12)
    parts += curtain_rod(-0.64, 0.64, 1.24, 0.13)
    for side in (-1, 1):
        parts.append(curtain(side * 0.62, side * 0.36, 1.22, -1.05, 0.12, folds=3, tie=0.62))
        parts += tie_back(side * 0.58, -0.2, 0.12)
    return parts
