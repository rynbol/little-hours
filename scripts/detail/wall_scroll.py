import math
from kit import lathe, rbox, rod, sphere, tube
from picture_frame import ellipse, slab

PAPER, ROLLER, BRANCH = '#faf0da', '#795e46', '#64594e'
BLOSSOMS = ('#d3979c', '#e8b3b0')
SILK, SILK_DARK, SEAL, CORD = '#8f9d8c', '#6f7e70', '#b5574c', '#c9a46a'
EYE = (0.3, 0.2, 1.0)
AO = 0.55


def mounting():
    parts = [rbox([1.28, 2.25, 0.012], (0, -0.005, 0.034), SILK, bevel=0.004, surface='cloth'),
             rbox([1.02, 1.72, 0.008], (0, -0.04, 0.042), PAPER, bevel=0.003, surface='paper'),
             rbox([1.28, 0.2, 0.004], (0, 0.93, 0.042), SILK_DARK, bevel=0.0015, segments=1, surface='cloth'),
             rbox([1.28, 0.16, 0.004], (0, -0.98, 0.042), SILK_DARK, bevel=0.0015, segments=1, surface='cloth')]
    for x in (-0.16, 0.16):
        parts.append(rbox([0.035, 0.34, 0.003], (x, 0.94, 0.045), '#e2d6b6', bevel=0, surface='cloth'))
    for y in (0.825, -0.905):
        parts.append(rbox([1.06, 0.012, 0.003], (0, y, 0.047), '#c9b48a', bevel=0, surface='cloth'))
    for x in (-0.515, 0.515):
        parts.append(rbox([0.012, 1.74, 0.003], (x, -0.04, 0.047), '#c9b48a', bevel=0, surface='cloth'))
    return parts


def rollers():
    parts = []
    top, bottom = 1.165, -1.165
    parts.append(rbox([1.3, 0.05, 0.03], (0, top, 0.06), ROLLER, bevel=0.012, surface='wood'))
    parts.append(rod((-0.66, bottom, 0.07), (0.66, bottom, 0.07), 0.036, ROLLER, sides=16, surface='wood'))
    for side in (-1, 1):
        cap = [(0.0, 0.0), (0.044, 0.0), (0.05, 0.012), (0.046, 0.03), (0.03, 0.045), (0.036, 0.06), (0.03, 0.078), (0.0, 0.085)]
        parts.append(lathe(cap, (side * 0.655, bottom, 0.07), ROLLER, segments=16, surface='wood', rotation=(0, 0, -side * math.pi / 2)))
        parts.append(sphere((0.012, 0.012, 0.012), (side * 0.66, top, 0.078), '#bf9762', subdivisions=1, surface='metal', layer='metal'))
    cord = [(-0.5, top + 0.01, 0.075), (-0.3, top + 0.1, 0.1), (0.0, top + 0.14, 0.11), (0.3, top + 0.1, 0.1), (0.5, top + 0.01, 0.075)]
    parts.append(tube(cord, 0.007, CORD, surface='cloth', resolution=4))
    for side in (-1, 1):
        parts.append(rbox([0.03, 0.03, 0.02], (side * 0.5, top + 0.01, 0.074), '#bf9762', bevel=0.006, surface='metal', layer='metal'))
    for x in (-0.07, 0.07):
        parts.append(tube([(x, top - 0.02, 0.08), (x * 1.3, top - 0.25, 0.085), (x * 1.1, top - 0.42, 0.08)], 0.006, CORD, tip=0.7, surface='cloth', resolution=3))
        parts.append(sphere((0.012, 0.03, 0.01), (x * 1.1, top - 0.45, 0.08), CORD, subdivisions=1, surface='cloth'))
    return parts


def petal_flower(x, y, z, size, colour, turn):
    parts = []
    for k in range(5):
        a = turn + k / 5 * math.tau
        points = ellipse(0, 0, size * 0.55, size * 0.4, 0, math.tau, 7)[:-1]
        c, s = math.cos(a), math.sin(a)
        parts.append(slab([(x + (px + size * 0.55) * c - py * s, y + (px + size * 0.55) * s + py * c) for px, py in points], z + k * 0.001, 0.003, colour, surface='paper'))
    heart = [(x + math.cos(turn + k * math.pi / 5) * size * (0.36 if k % 2 == 0 else 0.18), y + math.sin(turn + k * math.pi / 5) * size * (0.36 if k % 2 == 0 else 0.18)) for k in range(10)]
    parts.append(slab(heart, z + 0.004, 0.003, '#9a5a4e', surface='paper'))
    parts.append(sphere((size * 0.14, size * 0.14, 0.004), (x, y, z + 0.007), '#e9c27a', subdivisions=1))
    return parts


def painting():
    z = 0.047
    trunk = [(-0.32, -0.975, z), (-0.1, -0.6, z), (0.12, -0.225, z), (-0.05, 0.225, z), (0.2, 0.55, z), (0.39, 0.855, z)]
    parts = [tube(trunk, 0.02, BRANCH, tip=0.3, resolution=5)]
    for start, end, mid in (((0.12, -0.225), (0.36, -0.12), (0.26, -0.2)), ((-0.05, 0.225), (-0.3, 0.38), (-0.2, 0.26)), ((-0.1, -0.6), (-0.34, -0.52), (-0.24, -0.6)), ((0.2, 0.55), (0.05, 0.72), (0.1, 0.6))):
        parts.append(tube([(start[0], start[1], z), (mid[0], mid[1], z), (end[0], end[1], z)], 0.009, BRANCH, tip=0.25, resolution=4))
    blooms = [(-0.2, -0.76, 0.05), (-0.34, -0.52, 0.04), (-0.23, -0.6, 0.034), (0.14, -0.3, 0.05), (0.36, -0.12, 0.042), (0.24, -0.2, 0.034),
              (0.07, 0.02, 0.046), (-0.3, 0.38, 0.044), (-0.17, 0.29, 0.036), (0.09, 0.42, 0.05), (0.27, 0.64, 0.044), (0.05, 0.72, 0.04),
              (0.39, 0.855, 0.036), (-0.03, -0.44, 0.03), (-0.06, 0.16, 0.034)]
    for i, (x, y, size) in enumerate(blooms):
        parts += petal_flower(x, y, z + 0.004, size, BLOSSOMS[i % 2], i * 0.7)
    for x, y in ((-0.25, 0.33), (0.3, -0.16), (-0.29, -0.56), (0.15, 0.6), (0.33, 0.77), (0.1, -0.27), (-0.1, -0.66)):
        parts.append(sphere((0.012, 0.016, 0.004), (x, y, z + 0.004), BLOSSOMS[0], subdivisions=1))
    for i in range(7):
        parts.append(rbox([0.024, 0.036 + (i % 3) * 0.01, 0.002], (0.42, 0.62 - i * 0.07, z + 0.001), '#4b4540', bevel=0, rotation=(0, 0, 0.12 * (i % 2 * 2 - 1))))
    parts.append(rbox([0.06, 0.06, 0.003], (0.42, 0.06, z + 0.002), SEAL, bevel=0.004, segments=1))
    parts.append(rbox([0.03, 0.006, 0.002], (0.42, 0.06, z + 0.004), '#f3dccb', bevel=0.001, segments=1))
    return parts


def build():
    return mounting() + rollers() + painting()
