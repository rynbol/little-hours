import math
from kit import cylinder, lathe, rbox, rod, sphere, torus, tube
from plant import leaf, soil

BRASS, ROPE, TERRACOTTA, LEAF, LEAF_LIGHT = '#bf9762', '#c9b78f', '#bd8469', '#809362', '#95a576'
SOIL, VINE, CLAY_DARK = '#73533d', '#617853', '#a86f55'
POT = (0, 0.25)
EYE = (0.6, 0.25, 1.0)


def bracket():
    parts = [rbox([0.16, 0.22, 0.03], (0, 0.52, 0.015), BRASS, bevel=0.012, surface='metal', layer='metal')]
    for y in (0.45, 0.59):
        parts.append(cylinder(0.012, 0.012, 0.01, (0, y, 0.034), '#8f6f45', segments=10, bevel=0.003, surface='metal', layer='metal', rotation=(math.pi / 2, 0, 0)))
    parts.append(rod((0, 0.55, 0.03), (0, 0.55, 0.245), 0.013, BRASS, sides=10, surface='metal', layer='metal'))
    parts.append(sphere((0.02, 0.02, 0.02), (0, 0.55, 0.255), BRASS, subdivisions=2, surface='metal', layer='metal'))
    scroll = [(0, 0.46, 0.03), (0, 0.46, 0.09), (0, 0.5, 0.15), (0, 0.545, 0.19)]
    parts.append(tube(scroll, 0.007, BRASS, surface='metal', layer='metal', resolution=4))
    parts.append(torus(0.022, 0.006, (0, 0.482, 0.09), BRASS, rotation=(0, math.pi / 2, 0), major_segments=14, minor_segments=5, surface='metal', layer='metal'))
    parts.append(torus(0.016, 0.004, (0, 0.53, 0.245), BRASS, rotation=(0, math.pi / 2, 0), major_segments=12, minor_segments=5, surface='metal', layer='metal'))
    return parts


def hanger():
    parts = [sphere((0.022, 0.03, 0.022), (0, 0.5, 0.25), ROPE, subdivisions=2, surface='cloth')]
    for angle in (0, 2.1, 4.2):
        end = (math.cos(angle) * 0.165, 0.275, 0.25 + math.sin(angle) * 0.165)
        parts.append(tube([(0, 0.5, 0.25), (end[0] * 0.5, 0.39, 0.25 + (end[2] - 0.25) * 0.5), end], 0.005, ROPE, surface='cloth', resolution=3))
    return parts


def pot():
    wall = [(0.0, 0.05), (0.12, 0.05), (0.132, 0.06), (0.16, 0.18), (0.176, 0.25), (0.192, 0.254), (0.196, 0.27), (0.192, 0.288), (0.178, 0.29), (0.17, 0.275), (0.0, 0.275)]
    parts = [lathe(wall, (0, 0, POT[1]), TERRACOTTA, segments=32, surface='ceramic')]
    parts.append(torus(0.155, 0.006, (0, 0.17, POT[1]), CLAY_DARK, rotation=(math.pi / 2, 0, 0), major_segments=32, minor_segments=5, surface='ceramic'))
    parts.append(soil(0.172, 0.282, SOIL, position=(0, 0, POT[1]), seed=4, segments=20))
    return parts


def vines():
    parts = []
    for strand in range(5):
        angle = strand * 1.26
        x0, z0 = math.cos(angle) * 0.15, POT[1] + math.sin(angle) * 0.13
        drop = 0.62 + strand % 2 * 0.2
        points = [(x0 * 0.7, 0.29, POT[1] + (z0 - POT[1]) * 0.7), (x0 * 1.18, 0.29, POT[1] + (z0 - POT[1]) * 1.2)]
        for i in range(1, 7):
            t = i / 6
            points.append((x0 * 1.1 + math.sin(t * 3 + strand) * 0.06, 0.26 - t * drop, z0 + math.sin(t * 2 + strand) * 0.03 + 0.02 * t))
        parts.append(tube(points, 0.006, VINE, surface='leaf', tip=0.6, resolution=3))
        for i in range(7):
            t = i / 6
            px = x0 * 1.1 + math.sin(t * 3 + strand) * 0.06
            py = 0.24 - t * drop
            pz = z0 + math.sin(t * 2 + strand) * 0.03 + 0.02 * t
            out = 1 if i % 2 else -1
            outward = (math.cos(angle) * 0.6 + out * 0.6, -0.35, math.sin(angle) * 0.6 + 0.35)
            size = 0.085 - t * 0.025
            colour = LEAF if (strand + i) % 2 else LEAF_LIGHT
            parts += leaf((px, py, pz), outward, (math.cos(angle) * 0.3, 0.6, 0.8), size, size * 0.8, colour, shape='heart', lobe=0.1, rows=4, cols=2, droop=0.18, cup=0.3, fold=0.2, rib=None, thickness=0.003)
    for k, a in enumerate((0.4, 2.0, 3.6, 5.0)):
        base = (math.cos(a) * 0.08, 0.29, POT[1] + math.sin(a) * 0.08)
        parts += leaf(base, (math.cos(a), 0.9, math.sin(a)), (0, 1, 0.3), 0.08, 0.065, LEAF_LIGHT if k % 2 else LEAF, shape='heart', lobe=0.1, rows=4, cols=2, rib=None, thickness=0.003)
    return parts


def build():
    return bracket() + hanger() + pot() + vines()
