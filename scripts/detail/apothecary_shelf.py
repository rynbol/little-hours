import math
from kit import Frame, cylinder, lathe, rbox, rod, sphere, torus
from wall_shelf import profile_prism

BOARD, CORK, PAPER, INK, TWINE, BRASS = '#926747', '#ac8357', '#f2ead5', '#6b5a4a', '#d9c9a6', '#bf9762'
GLASS = ['#768d77', '#b09572', '#95839d', '#b9795e']
TOP = -0.2425
EYE = (0.2, 0.25, 1.0)


def shelf():
    parts = [rbox([1.4, 0.07, 0.6], (0, TOP - 0.035, 0.31), BOARD, bevel=0.02, surface='wood', dice=0.3),
             rbox([1.36, 0.04, 0.05], (0, TOP - 0.09, 0.575), BOARD, bevel=0.016, surface='wood'),
             rbox([1.4, 0.012, 0.014], (0, TOP - 0.004, 0.607), '#b8865f', bevel=0.004, segments=1, surface='wood')]
    for x in (-0.55, 0.55):
        outline = [(0.01, TOP - 0.07), (0.34, TOP - 0.07), (0.34, TOP - 0.095)]
        for k in range(1, 11):
            t = k / 10
            outline.append((0.34 - 0.31 * math.sin(t * math.pi / 2) ** 1.3, TOP - 0.095 - 0.13 * t))
        outline += [(0.01, TOP - 0.235)]
        parts.append(profile_prism(outline, 0.045, x, BOARD))
        parts.append(sphere((0.03, 0.03, 0.01), (x, TOP - 0.2, 0.05), BOARD, subdivisions=2, surface='wood'))
    for x in (-0.66, -0.22, 0.22, 0.66):
        parts.append(rod((x, TOP, 0.575), (x, TOP + 0.075, 0.575), 0.007, BRASS, sides=8, surface='metal', layer='metal'))
        parts.append(sphere((0.012, 0.012, 0.012), (x, TOP + 0.08, 0.575), BRASS, subdivisions=1, surface='metal', layer='metal'))
    parts.append(rod((-0.66, TOP + 0.065, 0.575), (0.66, TOP + 0.065, 0.575), 0.006, BRASS, sides=8, surface='metal', layer='metal'))
    return parts


def densify(profile, step=0.03):
    out = [profile[0]]
    for (r0, y0), (r1, y1) in zip(profile, profile[1:]):
        count = max(1, int(math.hypot(r1 - r0, y1 - y0) / step))
        out += [(r0 + (r1 - r0) * k / count, y0 + (y1 - y0) * k / count) for k in range(1, count + 1)]
    return out


def stopper(f, y, radius, height, wax=None):
    parts = [cylinder(radius * 0.85, radius * 0.75, height, (0, y + height / 2, 0), CORK, segments=12, bevel=0.006, surface='wood', frame=f),
             cylinder(radius * 1.05, radius * 1.05, height * 0.3, (0, y + height * 0.85, 0), CORK, segments=12, bevel=0.005, surface='wood', frame=f)]
    if wax:
        parts.append(sphere((radius * 1.1, height * 0.25, radius * 1.1), (0, y + height, 0), wax, subdivisions=2, frame=f))
    return parts


def label(f, y, z, width, height, angle=0.0):
    return [rbox([width, height, 0.003], (0, y, z), PAPER, bevel=0.001, surface='paper', frame=f, rotation=(0, 0, angle)),
            rbox([width * 0.6, 0.006, 0.002], (0, y + height * 0.12, z + 0.002), INK, bevel=0, frame=f, rotation=(0, 0, angle)),
            rbox([width * 0.4, 0.004, 0.002], (0, y - height * 0.18, z + 0.002), INK, bevel=0, frame=f, rotation=(0, 0, angle))]


def flask(x, h, colour):
    f = Frame((x, TOP, 0.41))
    r = 0.11
    profile = [(0.0, 0.0), (r * 0.6, 0.0)] + [(r * math.sin(a), r - r * math.cos(a) * 0.95) for a in (math.pi * k / 10 for k in range(2, 10))] + [(0.04, h * 0.72), (0.035, h * 0.95), (0.042, h), (0.0, h)]
    parts = [lathe(densify(profile), (0, 0, 0), colour, segments=20, surface='metal', layer='metal', frame=f)]
    parts += stopper(f, h - 0.005, 0.04, 0.07)
    parts.append(torus(0.04, 0.004, (0, h * 0.8, 0), TWINE, rotation=(math.pi / 2, 0, 0), major_segments=12, minor_segments=4, surface='cloth', frame=f))
    parts += label(f, r * 0.9, r * 0.98, 0.09, 0.06)
    return parts


def tall_bottle(x, h, colour):
    f = Frame((x, TOP, 0.41), (0, 0.3, 0))
    parts = [rbox([0.15, h * 0.72, 0.15], (0, h * 0.36, 0), colour, bevel=0.03, surface='metal', layer='metal', frame=f, dice=0.05),
             lathe(densify([(0.0, h * 0.7), (0.07, h * 0.7), (0.068, h * 0.74), (0.045, h * 0.8), (0.035, h * 0.86), (0.035, h * 0.95), (0.042, h), (0.0, h)]), (0, 0, 0), colour, segments=14, surface='metal', layer='metal', frame=f)]
    parts += stopper(f, h - 0.005, 0.04, 0.08, wax='#a8453d')
    parts += label(f, h * 0.38, 0.077, 0.1, 0.12, 0.04)
    return parts


def cone_bottle(x, h, colour):
    f = Frame((x, TOP, 0.41))
    parts = [lathe(densify([(0.0, 0.0), (0.105, 0.0), (0.11, 0.012), (0.075, h * 0.8), (0.05, h * 0.85), (0.038, h * 0.88), (0.036, h * 0.96), (0.044, h), (0.0, h)]), (0, 0, 0), colour, segments=18, surface='metal', layer='metal', frame=f)]
    parts += stopper(f, h - 0.005, 0.04, 0.06)
    parts += label(f, h * 0.3, 0.098, 0.08, 0.07, -0.05)
    return parts


def gourd(x, h, colour):
    f = Frame((x, TOP, 0.41))
    profile = [(0.0, 0.0), (0.07, 0.0), (0.105, 0.04), (0.11, 0.1), (0.08, h * 0.55), (0.06, h * 0.6), (0.075, h * 0.68), (0.07, h * 0.78), (0.035, h * 0.88), (0.035, h * 0.96), (0.042, h), (0.0, h)]
    parts = [lathe(densify(profile), (0, 0, 0), colour, segments=20, surface='metal', layer='metal', frame=f)]
    parts += stopper(f, h - 0.005, 0.04, 0.06, wax='#5f7a6c')
    parts.append(torus(0.062, 0.004, (0, h * 0.6, 0), TWINE, rotation=(math.pi / 2, 0, 0), major_segments=14, minor_segments=4, surface='cloth', frame=f))
    parts.append(rod((0.05, h * 0.6, 0.035), (0.08, h * 0.4, 0.07), 0.003, TWINE, sides=4, frame=f))
    parts.append(rbox([0.04, 0.05, 0.003], (0.085, h * 0.36, 0.075), PAPER, bevel=0.001, surface='paper', frame=f, rotation=(0, -0.7, 0.2)))
    return parts


def build():
    parts = shelf()
    makers = [flask, tall_bottle, cone_bottle, gourd]
    for i, (make, colour) in enumerate(zip(makers, GLASS)):
        h = 0.24 + (i % 3) * 0.09
        parts += make(0.465 - i * 0.31, h + 0.09, colour)
    return parts
