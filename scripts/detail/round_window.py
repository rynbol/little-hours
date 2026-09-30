import math
from kit import Frame, cylinder, rbox, sphere, torus
from arched_window import prism
from cottage_window import DARK, EDGE, WOOD, cloth_sheet, curtain_rod, hinge, latch, potted_plant, sill_books, valance

EYE = (0.3, 0.2, 1.0)
AO = 0.35
RADIUS, HALF = 0.46, 0.6


def corner(sx, sy):
    arc = [(sx * math.cos(k / 10 * math.pi / 2) * RADIUS, sy * math.sin(k / 10 * math.pi / 2) * RADIUS) for k in range(11)]
    outline = [(sx * HALF, 0), (sx * HALF, sy * HALF), (0, sy * HALF)] + list(reversed(arc))
    return prism(outline, -0.1, 0.045, EDGE)


def sleeve(radius, back, front, colour):
    def shape(u, v):
        a = u * math.tau
        return (math.cos(a) * radius, math.sin(a) * radius, front + (back - front) * v)
    return cloth_sheet(shape, 32, 1, colour, thickness=0.012, surface='wood')


def panel():
    parts = [corner(sx, sy) for sx in (-1, 1) for sy in (-1, 1)]
    for y in (HALF - 0.03, -HALF + 0.03):
        parts.append(rbox([HALF * 2, 0.06, 0.07], (0, y, 0.035), EDGE, bevel=0.016, surface='wood', segments=2))
    for x in (HALF - 0.03, -HALF + 0.03):
        parts.append(rbox([0.06, HALF * 2 - 0.1, 0.07], (x, 0, 0.035), EDGE, bevel=0.016, surface='wood', segments=2))
    parts.append(sleeve(RADIUS + 0.012, -0.12, 0.0, EDGE))
    return parts


def porthole():
    parts = [torus(RADIUS, 0.05, (0, 0, 0.07), WOOD, major_segments=40, minor_segments=10, surface='wood'),
             torus(RADIUS - 0.06, 0.018, (0, 0, 0.055), EDGE, major_segments=36, minor_segments=6, surface='wood')]
    parts.append(rbox([0.9, 0.04, 0.04], (0, 0, 0.045), WOOD, bevel=0.01, surface='wood', segments=2))
    parts.append(rbox([0.04, 0.9, 0.04], (0, 0, 0.045), WOOD, bevel=0.01, surface='wood', segments=2))
    parts.append(cylinder(0.04, 0.04, 0.03, (0, 0, 0.06), WOOD, segments=14, bevel=0.008, surface='wood', rotation=(math.pi / 2, 0, 0)))
    for k in range(8):
        a = k / 8 * math.tau + math.pi / 8
        parts.append(sphere((0.012, 0.012, 0.008), (math.cos(a) * RADIUS, math.sin(a) * RADIUS, 0.118), '#bf9762', subdivisions=1, surface='metal', layer='metal'))
    return parts


def ledge():
    parts = [rbox([0.86, 0.045, 0.2], (0, -0.645, 0.1), DARK, bevel=0.018, surface='wood', segments=2)]
    for x in (-0.3, 0.3):
        f = Frame((x, -0.69, 0.0))
        parts.append(rbox([0.035, 0.05, 0.14], (0, 0, 0.07), DARK, bevel=0.012, surface='wood', frame=f, segments=2))
        parts.append(sphere((0.02, 0.02, 0.02), (0, -0.03, 0.12), DARK, subdivisions=1, surface='wood', frame=f))
    return parts


def build():
    parts = panel() + porthole() + ledge()
    parts += hinge(-RADIUS - 0.05, 0.16, 0.11, -1) + hinge(-RADIUS - 0.05, -0.16, 0.11, -1)
    parts += latch(RADIUS + 0.035, -0.03, 0.1, turn=1.9)
    parts += potted_plant(0.24, -0.622, 0.1, scale=0.7)
    parts += sill_books(-0.2, -0.622, 0.1)
    parts += curtain_rod(-0.64, 0.64, 0.69, 0.13)
    parts += valance(-0.6, 0.6, 0.69, 0.5, 0.13, folds=7, scallops=2)
    return parts
