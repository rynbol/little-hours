import math
from kit import Frame, cylinder, lathe, rbox, rod, sphere, torus
from lounge_chair import drape, plump, tassels

VELVET, LIGHT_VELVET, WALNUT, BRASS, SEAM = '#785965', '#91707c', '#654939', '#b18f59', '#ad8690'
PILLOWS = [(-0.88, '#708374', 0.17), (-0.16, '#baa170', -0.10), (0.80, '#78886b', -0.16)]
CROSS, KNOB, THROW, FRINGE, STRIPE = '#d0bc90', '#dfc99f', '#bfa471', '#dfcba3', '#ddc89b'
DEEP = '#684c57'
EYE = (0.45, 0.55, 1.0)


def leg(x, z):
    cup = [(0.0, 0.0), (0.06, 0.0), (0.072, 0.008), (0.075, 0.03), (0.07, 0.07), (0.06, 0.078), (0.0, 0.078)]
    wood = [(0.0, 0.07), (0.052, 0.07), (0.05, 0.1), (0.056, 0.13), (0.06, 0.16), (0.066, 0.2), (0.074, 0.226), (0.0, 0.226)]
    return [lathe(cup, (x, 0.0, z), BRASS, segments=18, surface='metal', layer='metal'),
            torus(0.062, 0.006, (x, 0.074, z), BRASS, rotation=(math.pi / 2, 0, 0), major_segments=18, minor_segments=5, surface='metal', layer='metal'),
            lathe(wood, (x, 0.0, z), WALNUT, segments=18, surface='wood')]


def edge_welt(half_w, y, z, colour, radius=0.012):
    return rod((-half_w, y, z), (half_w, y, z), radius, colour, sides=8, surface='cloth')


def back():
    parts = [rbox([2.99, 0.76, 0.2], (0, 0.92, -0.655), VELVET, bevel=0.07, surface='cloth', segments=3),
             cylinder(0.11, 0.11, 2.98, (0, 1.23, -0.63), VELVET, segments=22, bevel=0.04, surface='cloth', rotation=(0, 0, math.pi / 2))]
    channels = 8
    width = 2.52 / channels
    for k in range(channels):
        x = -1.26 + width * (k + 0.5)
        parts.append(rbox([width + 0.012, 0.66, 0.15], (x, 0.88, -0.49), VELVET, bevel=0.07, surface='cloth', segments=3, rotation=(-0.1, 0, 0)))
        for y in (0.7, 1.06) if k < channels - 1 else ():
            parts.append(sphere((0.02, 0.02, 0.012), (x + width / 2, y, -0.415 - (y - 0.88) * 0.1), DEEP, subdivisions=1, surface='cloth'))
    return parts


def arm(side):
    x = side * 1.4
    parts = [rbox([0.28, 0.5, 1.42], (x, 0.64, -0.005), VELVET, bevel=0.09, surface='cloth', segments=3),
             cylinder(0.14, 0.14, 1.42, (x + side * 0.006, 0.89, -0.005), VELVET, segments=22, bevel=0.05, surface='cloth', rotation=(math.pi / 2, 0, 0))]
    face = Frame((x + side * 0.006, 0.89, 0.715))
    parts.append(cylinder(0.118, 0.118, 0.024, (0, 0, 0), LIGHT_VELVET, segments=22, bevel=0.01, surface='cloth', frame=face, rotation=(math.pi / 2, 0, 0)))
    parts.append(torus(0.118, 0.009, (0, 0, 0.012), SEAM, major_segments=22, minor_segments=5, surface='cloth', frame=face))
    parts.append(sphere((0.026, 0.026, 0.014), (0, 0, 0.018), KNOB, subdivisions=2, surface='cloth', frame=face))
    parts.append(rod((x - side * 0.1, 1.0, -0.69), (x - side * 0.1, 1.0, 0.69), 0.01, SEAM, sides=6, surface='cloth'))
    return parts


def pillow(x, colour, angle):
    tilt = Frame((x, 1.0, -0.27), (0, 0, angle))
    parts = plump([0.59, 0.2, 0.53], (0, 0, 0), colour, puff=0.6, frame=tilt, rotation=(math.pi / 2 - 0.2, 0, 0), tufts=(1, 1), button=KNOB, piping=CROSS)
    return parts


def throw():
    path = [(0.756, -0.42), (0.76, 0.1), (0.758, 0.45), (0.742, 0.565), (0.71, 0.635), (0.64, 0.69), (0.54, 0.708), (0.42, 0.716), (0.32, 0.728)]
    columns = 29
    colour_of = lambda t, s: STRIPE if round(s * columns - 0.5) % 4 == 2 else THROW
    parts, hem = drape(path, 0.385, 0.895, colour_of, fold=0.012, columns=columns)
    return parts + tassels(hem, 9, FRINGE)


def build():
    parts = []
    for x in (-1.26, 1.26):
        for z in (-0.5, 0.5):
            parts += leg(x, z)
    parts.append(rbox([2.99, 0.29, 1.4], (0, 0.37, -0.035), VELVET, bevel=0.06, surface='cloth', segments=3))
    corner = 0.06 * (1 - math.cos(math.pi / 4))
    parts.append(edge_welt(1.44, 0.515 - corner, 0.665 - corner, SEAM))
    parts.append(edge_welt(1.44, 0.225 + corner, 0.665 - corner, SEAM))
    parts += back()
    for side in (-1, 1):
        parts += arm(side)
    for x in (-0.85, 0, 0.85):
        parts += plump([0.83, 0.22, 1.06], (x, 0.61, 0.05), LIGHT_VELVET, puff=0.35, tufts=(2, 2), button=DEEP, piping=SEAM, dice=0.07, depth=0.3)
    for x, colour, angle in PILLOWS:
        parts += pillow(x, colour, angle)
    parts += throw()
    return parts
