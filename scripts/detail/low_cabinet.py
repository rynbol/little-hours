import math
from mathutils import Matrix, Vector
from kit import Frame, at, cylinder, lathe, rbox, rod, sphere
from study_desk import book, succulent
from writing_desk import orient

WOOD, EDGE, DARK, DOOR, BRASS = '#aa7954', '#bc9169', '#73533d', '#c29b71', '#bf9762'
PLINTH, CANE, CANE_BACK = '#a07858', '#e6d2a8', '#7a5a40'
BOOKS = ['#788e84', '#d5b77c']
RECORD = (-0.33, -0.01)
EYE = (0.3, 0.7, 1.0)


def tapered_leg(a, b, colour):
    a, b = Vector(a), Vector(b)
    length = (b - a).length
    profile = [(0.0, 0.0), (0.026, 0.0), (0.03, 0.006), (0.03, 0.04), (0.028, 0.045), (0.032, length * 0.5), (0.042, length - 0.02), (0.046, length), (0.0, length)]
    leg = lathe(profile, (0, 0, 0), colour, segments=14, surface='wood')
    leg.matrix_world = Matrix.Translation(at(*a)) @ orient((b - a).normalized())
    cap = lathe([(0.0, 0.0), (0.031, 0.0), (0.033, 0.005), (0.033, 0.04), (0.0, 0.04)], (0, 0, 0), BRASS, segments=14, surface='metal', layer='metal')
    cap.matrix_world = Matrix.Translation(at(*a)) @ orient((b - a).normalized())
    return [leg, cap]


def carcass():
    parts = []
    for x in (-0.68, 0.68):
        for z in (-0.22, 0.22):
            parts += tapered_leg((x * 1.05, 0.012, z), (x, 0.19, z), DARK)
    parts.append(rbox([1.72, 0.64, 0.65], (0, 0.49, 0), WOOD, bevel=0.03, surface='wood', dice=0.3))
    parts.append(rbox([1.74, 0.05, 0.67], (0, 0.19, 0), WOOD, bevel=0.02, surface='wood'))
    for i in range(3):
        span = 0.68 / 3
        parts.append(rbox([1.77, 0.08, span - 0.004], (0, 0.85, -0.34 + span * (i + 0.5)), EDGE, bevel=0.012, surface='wood', dice=0.3))
    parts.append(rbox([1.72, 0.02, 0.02], (0, 0.805, 0.335), DARK, bevel=0.006, surface='wood'))
    for x in (-0.845, 0.845):
        parts.append(rbox([0.04, 0.6, 0.04], (x, 0.49, 0.32), EDGE, bevel=0.015, surface='wood'))
    return parts


def door(x):
    f = Frame((x, 0.49, 0.345))
    parts = []
    w, h, rail = 0.78, 0.5, 0.07
    for y in (-h / 2 + rail / 2, h / 2 - rail / 2):
        parts.append(rbox([w, rail, 0.04], (0, y, 0), DOOR, bevel=0.012, surface='wood', frame=f))
    for dx in (-w / 2 + rail / 2, w / 2 - rail / 2):
        parts.append(rbox([rail, h - rail * 2 + 0.01, 0.04], (dx, 0, 0), DOOR, bevel=0.012, surface='wood', frame=f))
    inner_w, inner_h = w - rail * 2, h - rail * 2
    parts.append(rbox([inner_w + 0.01, inner_h + 0.01, 0.01], (0, 0, -0.008), CANE_BACK, bevel=0, frame=f))
    columns, rows = 14, 8
    for k in range(columns):
        dx = -inner_w / 2 + (k + 0.5) * inner_w / columns
        parts.append(rbox([0.018, inner_h + 0.01, 0.004], (dx, 0, 0.0), CANE, bevel=0, surface='cloth', frame=f, dice=0.12))
    for k in range(rows):
        dy = -inner_h / 2 + (k + 0.5) * inner_h / rows
        parts.append(rbox([inner_w + 0.01, 0.018, 0.004], (0, dy, 0.004), CANE, bevel=0, surface='cloth', frame=f, dice=0.12))
    parts.append(rbox([inner_w + 0.01, 0.014, 0.014], (0, inner_h / 2 + 0.002, 0.012), DOOR, bevel=0.005, surface='wood', frame=f))
    parts.append(rbox([inner_w + 0.01, 0.014, 0.014], (0, -inner_h / 2 - 0.002, 0.012), DOOR, bevel=0.005, surface='wood', frame=f))
    handle_x = 0.25 if x < 0 else -0.25
    parts.append(rbox([0.025, 0.16, 0.025], (handle_x, 0.01, 0.045), DARK, bevel=0.01, surface='wood', frame=f))
    for dy in (-0.06, 0.08):
        parts.append(cylinder(0.009, 0.009, 0.03, (handle_x, dy, 0.025), DARK, segments=8, surface='wood', frame=f, rotation=(math.pi / 2, 0, 0)))
    hinge_x = -w / 2 - 0.004 if x < 0 else w / 2 + 0.004
    for dy in (-0.17, 0.17):
        parts.append(cylinder(0.009, 0.009, 0.07, (hinge_x, dy, 0.012), BRASS, segments=10, bevel=0.003, surface='metal', layer='metal', frame=f))
    if x > 0:
        parts.append(cylinder(0.022, 0.022, 0.004, (handle_x - 0.05, 0.01, 0.023), BRASS, segments=14, surface='metal', layer='metal', frame=f, rotation=(math.pi / 2, 0, 0)))
        parts.append(rbox([0.006, 0.02, 0.003], (handle_x - 0.05, 0.006, 0.026), '#3a2e26', bevel=0, frame=f))
    return parts


def turntable():
    f = Frame((-0.22, 0.945, -0.01))
    parts = [rbox([0.9, 0.08, 0.49], (0, -0.015, 0), PLINTH, bevel=0.025, surface='wood', dice=0.25, frame=f),
             rbox([0.88, 0.02, 0.47], (0, 0.03, 0), PLINTH, bevel=0.008, surface='wood', frame=f)]
    for x in (-0.4, 0.4):
        for z in (-0.2, 0.2):
            parts.append(cylinder(0.03, 0.034, 0.02, (x, -0.06, z), DARK, segments=12, bevel=0.006, frame=f))
    cx, cz = RECORD[0] + 0.22, RECORD[1] + 0.01
    parts.append(cylinder(0.19, 0.19, 0.016, (cx, 0.048, cz), '#8c8f86', segments=40, bevel=0.004, surface='metal', layer='metal', frame=f))
    parts.append(cylinder(0.006, 0.006, 0.03, (cx, 0.07, cz), '#d9c9a6', segments=8, surface='metal', layer='metal', frame=f))
    pivot = (0.28, 0.04, -0.16)
    parts.append(cylinder(0.05, 0.056, 0.03, pivot, '#8c8f86', segments=20, bevel=0.006, surface='metal', layer='metal', frame=f))
    parts.append(cylinder(0.024, 0.028, 0.05, (pivot[0], 0.07, pivot[2]), BRASS, segments=14, surface='metal', layer='metal', frame=f))
    parts.append(rod((0.28, 0.09, -0.16), (0.2, 0.09, 0.12), 0.011, BRASS, surface='metal', layer='metal', frame=f))
    parts.append(rod((0.2, 0.09, 0.12), (0.12, 0.088, 0.14), 0.011, BRASS, surface='metal', layer='metal', frame=f))
    parts.append(rbox([0.05, 0.016, 0.035], (0.1, 0.085, 0.145), '#50453d', bevel=0.005, frame=f, rotation=(0, 0.25, 0)))
    parts.append(rod((0.28, 0.09, -0.16), (0.3, 0.09, -0.23), 0.009, BRASS, surface='metal', layer='metal', frame=f))
    parts.append(cylinder(0.026, 0.026, 0.04, (0.305, 0.09, -0.24), '#50453d', segments=14, bevel=0.006, frame=f, rotation=(math.pi / 2, 0.28, 0)))
    parts.append(rod((0.2, 0.04, 0.16), (0.2, 0.078, 0.16), 0.008, '#8c8f86', surface='metal', layer='metal', frame=f))
    parts.append(rbox([0.03, 0.01, 0.02], (0.2, 0.08, 0.155), '#8c8f86', bevel=0.003, surface='metal', layer='metal', frame=f))
    for k, dx in enumerate((0.3, 0.38)):
        parts.append(cylinder(0.024, 0.026, 0.024, (dx, 0.052, 0.17), '#e9e4d2', segments=16, bevel=0.006, frame=f))
        parts.append(rbox([0.004, 0.006, 0.02], (dx, 0.066, 0.162), '#50453d', bevel=0, frame=f, rotation=(0, k * 0.9, 0)))
    parts.append(sphere((0.008, 0.006, 0.008), (0.3, 0.043, 0.23), '#ffcf7a', subdivisions=1, layer='glow', frame=f))
    return parts


def build():
    parts = carcass() + door(-0.415) + door(0.415) + turntable()
    parts += book(0.32, 0.06, 0.4, 0.57, 0.92, 0, BOOKS[0], 0.0)
    parts += book(0.32, 0.045, 0.4, 0.57, 0.975, 0, BOOKS[1], 0.08)
    parts += succulent(0.6, 0.997, 0.02)
    return parts
