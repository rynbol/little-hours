import math
from mathutils import Matrix, Vector
import kit
from kit import Frame, cylinder, lathe, rbox, rod, sphere, torus

WOOD, DARK, BRASS, NAVY = '#aa7954', '#73533d', '#bf9762', '#3f4d6b'
LENS, PAPER, RIBBON, STAR = '#8fb0c4', '#f2ead5', '#bb8066', '#d9c495'
HUB = Vector((0, 1.3, 0))
AIM = Vector((-0.3, 0.72, -0.62))
EYE = (0.6, 0.4, 1.0)


def axis_frame(origin, direction):
    d = direction.normalized()
    p = Vector((d.z, 0, -d.x)).normalized()
    q = p.cross(d)
    babylon = Matrix(((p.x, d.x, q.x), (p.y, d.y, q.y), (p.z, d.z, q.z)))
    swap = Matrix(((1, 0, 0), (0, 0, 1), (0, 1, 0)))
    f = Frame()
    f.matrix = Matrix.Translation(kit.at(*origin)) @ (swap @ babylon @ swap).to_4x4()
    return f


def along(t):
    return HUB + AIM * t


def leg_points():
    legs = []
    for i in range(3):
        a = i * math.tau / 3 + 0.5
        legs.append((a, Vector((math.cos(a) * 0.46, 0.012, math.sin(a) * 0.46)), Vector((math.cos(a) * 0.1, 1.15, math.sin(a) * 0.1))))
    return legs


def tripod():
    parts = []
    for a, foot, top in leg_points():
        f = axis_frame(foot, top - foot)
        length = (top - foot).length
        profile = [(0.0, 0.0)] + [(0.021 + 0.011 * (i / 8), length * i / 8) for i in range(9)] + [(0.0, length)]
        parts.append(lathe(profile, (0, 0, 0), WOOD, segments=12, surface='wood', frame=f))
        parts.append(lathe([(0.0, -0.012), (0.018, -0.012), (0.026, 0.0), (0.026, 0.06), (0.022, 0.07), (0.0, 0.07)], (0, 0, 0), BRASS, segments=12, surface='metal', layer='metal', frame=f))
        parts.append(rbox([0.05, 0.1, 0.07], (0, length - 0.02, 0), DARK, bevel=0.012, surface='wood', frame=f))
        parts.append(cylinder(0.018, 0.018, 0.1, (0, length - 0.03, 0), BRASS, segments=12, surface='metal', layer='metal', frame=f, rotation=(0, 0, math.pi / 2)))
        knob = Frame((0.03, length * 0.52, 0), parent=f)
        parts.append(lathe([(0.0, 0.0), (0.02, 0.0), (0.02, 0.012), (0.0, 0.014)], (0, 0, 0), BRASS, segments=10, surface='metal', layer='metal', frame=knob, rotation=(0, 0, -math.pi / 2)))
        parts.append(rbox([0.012, 0.05, 0.028], (0.052, 0, 0), BRASS, bevel=0.004, surface='metal', layer='metal', frame=knob))
        parts.append(rbox([0.05, 0.06, 0.07], (0, length * 0.52, 0), BRASS, bevel=0.008, surface='metal', layer='metal', frame=f, segments=2))
    head = [(0.0, 1.1), (0.1, 1.1), (0.115, 1.12), (0.118, 1.15), (0.11, 1.18), (0.09, 1.195), (0.0, 1.195)]
    parts.append(lathe(head, (0, 0, 0), DARK, segments=28, surface='wood'))
    parts.append(lathe([(0.0, 1.06), (0.03, 1.06), (0.05, 1.1), (0.0, 1.1)], (0, 0, 0), DARK, segments=16, surface='wood'))
    parts.append(cylinder(0.085, 0.085, 0.016, (0, 1.2, 0), BRASS, segments=28, bevel=0.005, surface='metal', layer='metal'))
    return parts


def tray():
    y = 0.52
    parts = [lathe([(0.0, 0.0), (0.16, 0.0), (0.17, 0.01), (0.172, 0.03), (0.162, 0.03), (0.158, 0.014), (0.0, 0.014)], (0, y, 0), DARK, segments=36, surface='wood')]
    for a, foot, top in leg_points():
        u = (y + 0.02 - foot.y) / (top.y - foot.y)
        at_leg = foot + (top - foot) * u
        parts.append(rod((math.cos(a) * 0.16, y + 0.02, math.sin(a) * 0.16), tuple(at_leg), 0.01, BRASS, sides=8, surface='metal', layer='metal'))
    for x, z, h in ((0.06, 0.05, 0.07), (0.1, -0.03, 0.055)):
        eyepiece = [(0.0, 0.0), (0.018, 0.0), (0.018, h * 0.5), (0.024, h * 0.55), (0.024, h), (0.012, h + 0.004), (0.0, h + 0.004)]
        parts.append(lathe(eyepiece, (x, y + 0.014, z), BRASS, segments=14, surface='metal', layer='metal'))
        parts.append(cylinder(0.013, 0.013, 0.003, (x, y + 0.016 + h, z), '#2c3342', segments=12))
    chart = Frame((-0.05, y + 0.032, -0.02), (0, 0.4, math.pi / 2))
    parts.append(cylinder(0.018, 0.018, 0.22, (0, 0, 0), PAPER, segments=14, bevel=0.004, surface='paper', frame=chart))
    parts.append(cylinder(0.0185, 0.0185, 0.012, (0, 0.03, 0), RIBBON, segments=14, surface='cloth', frame=chart))
    parts.append(rbox([0.13, 0.014, 0.1], (-0.03, y + 0.022, 0.09), '#788e84', bevel=0.004, surface='cloth', rotation=(0, -0.3, 0)))
    parts.append(rbox([0.12, 0.01, 0.092], (-0.026, y + 0.022, 0.09), PAPER, bevel=0.002, surface='paper', rotation=(0, -0.3, 0)))
    return parts


def optical_tube():
    f = axis_frame(HUB, AIM)
    span = AIM.length
    back, front = -0.5 * span, 0.62 * span
    body = [(0.0, back)] + [(0.085 + 0.015 * i / 10, back + (front - back) * i / 10) for i in range(11)] + [(0.0, front)]
    parts = [lathe(body, (0, 0, 0), NAVY, segments=28, surface='metal', layer='metal', frame=f)]
    band = lambda y, r: [(0.0, y - 0.022), (r, y - 0.022), (r + 0.006, y - 0.012), (r + 0.006, y + 0.012), (r, y + 0.022), (0.0, y + 0.022)]
    for t in (-0.08, 0.27):
        y = t * span
        parts.append(lathe(band(y, 0.093 + 0.015 * (y - back) / (front - back)), (0, 0, 0), BRASS, segments=28, surface='metal', layer='metal', frame=f))
    shield = [(0.0, front - 0.01), (0.104, front - 0.01), (0.112, front), (0.118, front + 0.03), (0.118, 0.72 * span), (0.124, 0.735 * span), (0.124, 0.745 * span),
              (0.11, 0.745 * span), (0.106, 0.735 * span), (0.0, 0.735 * span)]
    parts.append(lathe(shield, (0, 0, 0), BRASS, segments=32, surface='metal', layer='metal', frame=f))
    parts.append(lathe([(0.0, 0.7 * span), (0.1, 0.7 * span), (0.07, 0.715 * span), (0.0, 0.72 * span)], (0, 0, 0), LENS, segments=28, surface='metal', layer='metal', frame=f))
    cell = [(0.0, back - 0.05), (0.04, back - 0.05), (0.046, back - 0.04), (0.046, back + 0.02), (0.07, back + 0.03), (0.07, back + 0.05), (0.0, back + 0.05)]
    parts.append(lathe(cell, (0, 0, 0), BRASS, segments=20, surface='metal', layer='metal', frame=f))
    for side in (-1, 1):
        parts.append(cylinder(0.016, 0.016, 0.03, (side * 0.058, back - 0.01, 0), BRASS, segments=12, bevel=0.004, surface='metal', layer='metal', frame=f, rotation=(0, 0, math.pi / 2)))
    eyepiece = [(0.0, -0.62 * span), (0.03, -0.62 * span), (0.034, -0.6 * span), (0.03, -0.58 * span), (0.04, -0.56 * span), (0.05, -0.53 * span), (0.0, -0.53 * span)]
    parts.append(lathe(eyepiece, (0, 0, 0), BRASS, segments=18, surface='metal', layer='metal', frame=f))
    parts.append(lathe([(0.0, -0.63 * span), (0.032, -0.63 * span), (0.034, -0.618 * span), (0.0, -0.618 * span)], (0, 0, 0), '#2c3342', segments=16, frame=f))
    parts.append(lathe([(0.0, -0.05), (0.1, -0.05), (0.106, -0.04), (0.106, 0.04), (0.1, 0.05), (0.0, 0.05)], (0, 0, 0), BRASS, segments=28, surface='metal', layer='metal', frame=f))
    for side in (-1, 1):
        parts.append(lathe([(0.0, 0.1), (0.028, 0.1), (0.032, 0.115), (0.028, 0.13), (0.0, 0.13)], (0, 0, 0), BRASS, segments=14, surface='metal', layer='metal', frame=f, rotation=(0, 0, -side * math.pi / 2)))
        pivot = f.matrix @ kit.at(side * 0.115, 0, 0)
        parts.append(rod((pivot.x, 1.2, pivot.y), (pivot.x, pivot.z, pivot.y), 0.014, BRASS, sides=10, surface='metal', layer='metal'))
        parts.append(sphere((0.022, 0.022, 0.022), (pivot.x, 1.215, pivot.y), BRASS, subdivisions=1, surface='metal', layer='metal'))
    ends = [f.matrix @ kit.at(side * 0.115, 0, 0) for side in (-1, 1)]
    parts.append(rod((ends[0].x, 1.207, ends[0].y), (ends[1].x, 1.207, ends[1].y), 0.012, BRASS, sides=10, surface='metal', layer='metal'))
    for y in (-0.12, 0.1):
        parts.append(rod((0, y, -0.09), (0, y, -0.145), 0.008, BRASS, sides=8, surface='metal', layer='metal', frame=f))
        parts.append(torus(0.024, 0.005, (0, y, -0.16), BRASS, rotation=(math.pi / 2, 0, 0), major_segments=14, minor_segments=5, surface='metal', layer='metal', frame=f))
    finder = [(0.0, -0.2), (0.018, -0.2), (0.018, 0.14), (0.024, 0.15), (0.024, 0.2), (0.0, 0.2)]
    parts.append(lathe(finder, (0, 0, -0.16), NAVY, segments=14, surface='metal', layer='metal', frame=f))
    parts.append(lathe([(0.0, -0.23), (0.01, -0.23), (0.012, -0.2), (0.0, -0.2)], (0, 0, -0.16), BRASS, segments=10, surface='metal', layer='metal', frame=f))
    for y, theta, size in ((-0.3, -1.1, 0.05), (-0.18, -2.2, 0.036), (0.02, -0.7, 0.03), (0.2, -1.9, 0.045), (0.34, -1.3, 0.034), (-0.42, -2.0, 0.03)):
        r = 0.086 + 0.015 * (y - back) / (front - back)
        yaw = math.atan2(math.cos(theta), math.sin(theta))
        spot = Frame((math.cos(theta) * r, y, math.sin(theta) * r), (0, yaw, 0), f)
        parts.append(rbox([size * 0.5, size * 0.5, 0.004], (0, 0, 0), STAR, bevel=0.001, segments=1, frame=spot, rotation=(0, 0, math.pi / 4)))
        parts.append(rbox([size * 0.14, size * 1.5, 0.004], (0, 0, 0.001), STAR, bevel=0.0, frame=spot))
        parts.append(rbox([size * 1.5, size * 0.14, 0.004], (0, 0, 0.001), STAR, bevel=0.0, frame=spot))
    return parts


def build():
    return tripod() + tray() + optical_tube()
