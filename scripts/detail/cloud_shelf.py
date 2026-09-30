import math
from kit import Frame, cylinder, lathe, rbox, rod, torus, tube

CLOUD, PAPER, VASE = '#f5e6d9', '#f2ead5', '#ce9cba'
BOOKS = ['#c8a8bd', '#abc8ba', '#e5bb87', '#a4b3ce']
SHADOW, GILT, STEM, BLOOM, THREAD = '#e6d3c8', '#d9b36e', '#8f9a74', '#f3d9b8', '#cdbba8'
EYE = (0.22, 0.32, 1.0)
AO = 0.55


def puff(radii, position, colour, segments=16, rings=8, surface='cloth', frame=None):
    profile = [(math.sin(k / rings * math.pi), -math.cos(k / rings * math.pi)) for k in range(rings + 1)]
    obj = lathe(profile, position, colour, segments=segments, surface=surface, frame=frame)
    for v in obj.data.vertices:
        v.co.x, v.co.y, v.co.z = v.co.x * radii[0], v.co.y * radii[2], v.co.z * radii[1]
    obj.data.update()
    return obj


def cloud_puff(radii, position, seed, colour=CLOUD, segments=16, rings=8):
    return puff(radii, position, colour, segments=segments, rings=rings)


def backboard(width):
    parts = []
    for i in range(5):
        x = -width * 0.37 + i * width * 0.185
        parts.append(cloud_puff((width / 6, 0.2 + (i % 2) * 0.11, 0.075), (x, -0.065, 0.1), i))
    for side in (-1, 1):
        parts.append(cloud_puff((0.16, 0.13, 0.07), (side * width * 0.5, -0.16, 0.1), 7 + side))
    return parts


def plank(width):
    parts = [rbox([width * 0.9, 0.1, 0.46], (0, -0.115, 0.32), CLOUD, bevel=0.045, surface='cloth')]
    count = 7
    for i in range(count):
        x = (i - (count - 1) / 2) * width * 0.9 / count
        r = 0.075 if i % 2 else 0.09
        parts.append(cloud_puff((width * 0.9 / count * 0.6, r, 0.07), (x, -0.16, 0.5), 20 + i, segments=12, rings=5))
    for x in (-width * 0.3, width * 0.3):
        parts.append(rbox([0.06, 0.2, 0.22], (x, -0.26, 0.19), SHADOW, bevel=0.025, surface='cloth'))
    return parts


def book(thickness, height, depth, x, colour, lean=0.0, base=-0.065, z=0.42):
    pivot = x + (thickness / 2 if lean > 0 else -thickness / 2) if lean else x
    f = Frame((pivot, base, z), (0, 0, lean))
    ox = x - pivot
    board = 0.012
    parts = []
    for side in (-1, 1):
        parts.append(rbox([board, height, depth], (ox + side * (thickness / 2 - board / 2), height / 2, 0), colour, bevel=0.005, surface='cloth', frame=f, segments=2))
    parts.append(rbox([thickness - board * 2, height - 0.02, depth - 0.02], (ox, height / 2, -0.006), PAPER, bevel=0.004, surface='paper', frame=f, segments=1))
    parts.append(rod((ox, 0.004, depth / 2 - 0.01), (ox, height - 0.004, depth / 2 - 0.01), thickness / 2, colour, sides=12, surface='cloth', frame=f))
    for y in (0.05, height - 0.05):
        parts.append(rod((ox, y, depth / 2 - 0.01), (ox, y + 0.012, depth / 2 - 0.01), thickness / 2 + 0.003, GILT, sides=12, surface='metal', layer='metal', frame=f))
    parts.append(rbox([thickness * 0.5, height * 0.28, 0.006], (ox, height * 0.55, depth / 2 + thickness / 2 - 0.008), PAPER, bevel=0.002, surface='paper', frame=f, segments=1))
    return parts


def vase(x, z):
    f = Frame((x, -0.065, z))
    profile = [(0.0, 0.0), (0.07, 0.0), (0.085, 0.012), (0.115, 0.06), (0.13, 0.13), (0.124, 0.19), (0.1, 0.24), (0.06, 0.28), (0.045, 0.31),
               (0.05, 0.34), (0.066, 0.36), (0.07, 0.37), (0.058, 0.372), (0.04, 0.36), (0.0, 0.33)]
    parts = [lathe(profile, (0, 0, 0), VASE, segments=20, surface='ceramic', frame=f),
             torus(0.119, 0.008, (0, 0.2, 0), GILT, rotation=(math.pi / 2, 0, 0), major_segments=24, minor_segments=6, surface='metal', layer='metal', frame=f)]
    sprigs = [((0.0, 0.33, 0.0), (-0.04, 0.4, 0.02), (-0.1, 0.45, 0.03)), ((0.0, 0.33, 0.0), (0.015, 0.42, -0.01), (0.025, 0.48, 0.0)),
              ((0.0, 0.33, 0.0), (0.05, 0.39, 0.02), (0.11, 0.43, 0.04))]
    for k, points in enumerate(sprigs):
        parts.append(tube(points, 0.006, STEM, frame=f, resolution=4))
        tip = points[-1]
        for j in range(4):
            a = j * 1.6 + k
            parts.append(puff((0.022, 0.018, 0.022), (tip[0] + math.cos(a) * 0.02, tip[1] + (j % 2) * 0.014 - 0.01, tip[2] + math.sin(a) * 0.02), BLOOM if k != 1 else '#e9c7d4', segments=6, rings=3, frame=f))
    return parts


def star(x, top, drop, colour=GILT):
    f = Frame((x, top - drop, 0.4))
    parts = [rod((x, top, 0.4), (x, top - drop + 0.06, 0.4), 0.003, THREAD, sides=5)]
    points = []
    for k in range(11):
        a = math.pi / 2 + k / 10 * math.tau
        r = 0.06 if k % 2 == 0 else 0.026
        points.append((math.cos(a) * r, math.sin(a) * r, 0))
    parts.append(tube(points, 0.009, colour, frame=f, resolution=2))
    parts.append(cylinder(0.024, 0.024, 0.01, (0, 0, 0), colour, segments=10, surface='metal', layer='metal', frame=f, rotation=(math.pi / 2, 0, 0)))
    return parts


def moon(x, top, drop):
    f = Frame((x, top - drop, 0.4))
    return [rod((x, top, 0.4), (x, top - drop + 0.075, 0.4), 0.003, THREAD, sides=5),
            torus(0.055, 0.02, (0, 0, 0), '#e8d59a', rotation=(0, 0, 0.9), arc=math.pi * 1.25, major_segments=14, minor_segments=6, surface='cloth', frame=f)]


def shelf(width):
    parts = backboard(width) + plank(width)
    heights = [0.34, 0.42, 0.34, 0.42]
    for i, colour in enumerate(BOOKS):
        lean = -0.16 if i == 3 else 0.0
        parts += book(0.11, heights[i] - 0.02, 0.25, -0.55 + i * 0.14 + (0.02 if i == 3 else 0), colour, lean)
    parts += vase(0.48, 0.41)
    parts += star(-width * 0.36, -0.2, 0.2)
    parts += moon(width * 0.33, -0.2, 0.17)
    return parts


def build():
    return shelf(2.5)
