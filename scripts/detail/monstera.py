import math
from kit import cylinder, lathe, rod, sphere, torus, tube
from plant import leaf, pebble, soil

CREAM, SOIL, STEM = '#ded4c1', '#73533d', '#617853'
GLAZE, FOOT, COIR, TWINE, ROOT, SPIKE, MOSS = '#c9bca3', '#b9ab92', '#8a6a4a', '#cbb58a', '#8b6b4e', '#9aae78', '#7d8f5a'
LEAVES = [(0.1, 1.72), (2.2, 1.48), (4.1, 1.62), (1.2, 1.2), (3.2, 1.3), (5.2, 1.05)]
EYE = (0.3, 0.5, 1.0)


def pot():
    flutes = lambda a, y: 0.028 * (0.5 + 0.5 * math.cos(a * 18)) * min(1, (y - 0.08) * 12, (0.43 - y) * 12) if 0.08 < y < 0.43 else 0
    wall = [(0.0, 0.03), (0.2, 0.03), (0.225, 0.05), (0.24, 0.1), (0.27, 0.3), (0.292, 0.44), (0.296, 0.46), (0.312, 0.47), (0.318, 0.5), (0.314, 0.522),
            (0.3, 0.53), (0.286, 0.525), (0.278, 0.505), (0.274, 0.49), (0.0, 0.49)]
    parts = [lathe(wall, (0, 0, 0), CREAM, segments=54, surface='ceramic', wobble=flutes)]
    parts.append(cylinder(0.215, 0.2, 0.035, (0, 0.018, 0), FOOT, segments=36, bevel=0.01, surface='ceramic'))
    parts.append(torus(0.296, 0.009, (0, 0.455, 0), GLAZE, rotation=(math.pi / 2, 0, 0), major_segments=48, minor_segments=6, surface='ceramic'))
    parts.append(torus(0.238, 0.008, (0, 0.09, 0), GLAZE, rotation=(math.pi / 2, 0, 0), major_segments=48, minor_segments=6, surface='ceramic'))
    parts.append(soil(0.276, 0.51, SOIL, seed=5))
    for k, (r, a, s) in enumerate(((0.2, 0.9, 0.028), (0.22, 3.0, 0.022), (0.16, 4.6, 0.03), (0.23, 5.8, 0.02))):
        parts.append(pebble((s * 1.4, s * 0.5, s), (math.cos(a) * r, 0.515, math.sin(a) * r), MOSS, seed=k + 4))
    return parts


def pole():
    ridges = lambda a, y: 0.22 * math.sin(a * 3 + y * 55) + 0.1 * math.sin(a * 7 - y * 31)
    profile = [(0.0, 0.5), (0.046, 0.5)] + [(0.044 - 0.004 * k / 10, 0.5 + 0.075 * k) for k in range(1, 11)] + [(0.03, 1.27), (0.0, 1.28)]
    parts = [lathe(profile, (-0.04, 0, -0.06), COIR, segments=14, surface='cloth', wobble=ridges)]
    for y in (0.92, 1.18):
        parts.append(torus(0.047, 0.006, (-0.04, y, -0.06), TWINE, rotation=(math.pi / 2, 0, 0), major_segments=18, minor_segments=5, surface='cloth'))
    return parts


def petioles():
    parts = []
    for i, (angle, h) in enumerate(LEAVES):
        c, s = math.cos(angle), math.sin(angle)
        end = (c * 0.28, h - 0.1, s * 0.28)
        path = [(c * 0.03, 0.5, s * 0.03), (c * 0.08, 0.5 + (h - 0.6) * 0.45, s * 0.08), (c * 0.2, h - 0.25, s * 0.2), end]
        parts.append(tube(path, 0.017, STEM, surface='leaf', tip=0.7, resolution=6))
        parts.append(sphere((0.019, 0.026, 0.019), end, '#6d8458', subdivisions=2, surface='leaf'))
        sheath = [(c * 0.02, 0.51, s * 0.02), (c * 0.05, 0.62, s * 0.05), (c * 0.07, 0.72, s * 0.07)]
        parts.append(tube(sheath, 0.026, '#7b9063', surface='leaf', tip=0.3, resolution=3))
    return parts


def roots():
    parts = []
    for k, (a, top) in enumerate(((0.7, 0.9), (2.9, 0.82), (4.8, 0.95))):
        c, s = math.cos(a), math.sin(a)
        path = [(c * 0.07, top, s * 0.07), (c * 0.14, top - 0.15, s * 0.14), (c * 0.2, 0.62, s * 0.2), (c * 0.22, 0.51, s * 0.22)]
        parts.append(tube(path, 0.009, ROOT, surface='wood', tip=0.5, resolution=4))
    return parts


def unfurling():
    spiral = lambda a, y: 0.22 * (((a + y * 40) % math.tau) / math.tau - 0.5)
    profile = [(0.0, 0.0), (0.02, 0.0), (0.026, 0.04), (0.024, 0.12), (0.016, 0.2), (0.006, 0.26), (0.0, 0.28)]
    spike = lathe(profile, (0.12, 0.6, 0.13), SPIKE, segments=14, surface='leaf', wobble=spiral, rotation=(0.18, 0, -0.12))
    parts = [spike, tube([(0.1, 0.5, 0.11), (0.11, 0.56, 0.12), (0.12, 0.61, 0.13)], 0.014, STEM, surface='leaf', resolution=3)]
    parts += leaf((-0.12, 0.52, 0.12), (-0.5, 0.6, 0.6), (0, 1, 0.2), 0.13, 0.09, '#6f8d58', shape='heart', lobe=0.12, rows=5, cols=2)
    return parts


def build():
    return pot() + pole() + petioles() + roots() + unfurling()
