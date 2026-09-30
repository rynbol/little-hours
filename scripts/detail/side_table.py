import math
from kit import Frame, cylinder, lathe, sphere, tube
from study_desk import book
from study_desk import mug
from writing_desk import scaled

WOOD, DARK, EDGE, BOOK, LACE = '#aa7954', '#73533d', '#bc9169', '#bb8066', '#efe6d2'
EYE = (0.35, 0.8, 1.0)


def top():
    profile = [(0.0, 0.61), (0.3, 0.61), (0.36, 0.615), (0.385, 0.63), (0.39, 0.655), (0.382, 0.67), (0.392, 0.69), (0.39, 0.705), (0.38, 0.71), (0.3, 0.71), (0.2, 0.71), (0.1, 0.71), (0.0, 0.71)]
    return [lathe(profile, (0, 0, 0), WOOD, segments=40, surface='wood'),
            lathe([(0.0, 0.7102), (0.33, 0.7102), (0.33, 0.7115), (0.0, 0.7115)], (0, 0, 0), EDGE, segments=40, surface='wood'),
            lathe([(0.0, 0.7118), (0.315, 0.7118), (0.315, 0.713), (0.0, 0.713)], (0, 0, 0), WOOD, segments=40, surface='wood'),
            cylinder(0.3, 0.29, 0.05, (0, 0.585, 0), DARK, segments=32, bevel=0.012, surface='wood')]


def pedestal():
    profile = [(0.0, 0.04), (0.1, 0.04), (0.105, 0.06), (0.09, 0.08), (0.075, 0.1), (0.095, 0.16), (0.1, 0.22), (0.09, 0.28), (0.07, 0.33), (0.055, 0.37), (0.06, 0.39), (0.075, 0.405), (0.06, 0.42),
               (0.05, 0.47), (0.058, 0.52), (0.07, 0.535), (0.06, 0.55), (0.07, 0.565), (0.0, 0.565)]
    base = [(0.0, 0.0), (0.27, 0.0), (0.272, 0.012), (0.262, 0.024), (0.24, 0.032), (0.2, 0.04), (0.16, 0.05), (0.13, 0.06), (0.0, 0.06)]
    parts = [lathe(profile, (0, 0, 0), DARK, segments=24, surface='wood'), lathe(base, (0, 0.0, 0), DARK, segments=36, surface='wood')]
    for k in range(3):
        a = k / 3 * math.tau + 0.5
        parts.append(sphere((0.05, 0.028, 0.05), (math.cos(a) * 0.25, 0.026, math.sin(a) * 0.25), DARK, subdivisions=2, surface='wood'))
    return parts


def doily(x, y, z):
    scallop = lambda a, h: 0.06 * abs(math.sin(a * 8))
    parts = [lathe([(0.0, 0.0), (0.11, 0.0), (0.11, 0.003), (0.0, 0.003)], (x, y, z), LACE, segments=64, surface='cloth', wobble=scallop)]
    for k in range(16):
        a = (k + 0.5) / 16 * math.tau
        parts.append(cylinder(0.008, 0.008, 0.002, (x + math.cos(a) * 0.085, y + 0.0035, z + math.sin(a) * 0.085), '#d9ccb0', segments=6))
    return parts


def bud_vase(x, y, z):
    f = Frame((x, y, z))
    parts = [lathe([(0.0, 0.0), (0.035, 0.0), (0.045, 0.03), (0.04, 0.06), (0.018, 0.1), (0.016, 0.13), (0.022, 0.14), (0.0, 0.135)], (0, 0, 0), '#9fb3a6', segments=18, surface='metal', layer='metal', frame=f),
             tube([(0, 0.12, 0), (0.01, 0.2, 0.0), (0.03, 0.27, 0.01)], 0.003, '#617853', frame=f, resolution=4),
             tube([(0, 0.12, 0), (-0.02, 0.18, 0.01), (-0.04, 0.21, 0.02)], 0.0025, '#617853', frame=f, resolution=3),
             sphere((0.018, 0.01, 0.018), (0.03, 0.275, 0.01), '#e0a24e', subdivisions=2, frame=f)]
    for k in range(8):
        a = k / 8 * math.tau
        parts.append(sphere((0.022, 0.004, 0.009), (0.03 + math.cos(a) * 0.025, 0.272, 0.01 + math.sin(a) * 0.025), '#f7f0de', subdivisions=1, surface='cloth', frame=f, rotation=(0, -a, 0.1)))
    parts.append(sphere((0.02, 0.006, 0.01), (-0.04, 0.212, 0.02), '#809362', subdivisions=1, surface='leaf', frame=f, rotation=(0, 0.6, 0.4)))
    return parts


def build():
    parts = top() + pedestal()
    parts += book(0.35, 0.055, 0.27, -0.08, 0.7415, -0.05, BOOK, 0.15)
    parts.append(tube([(-0.2, 0.77, -0.02), (-0.24, 0.76, 0.02), (-0.27, 0.72, 0.05), (-0.275, 0.69, 0.06)], 0.004, '#c9a44f', resolution=3))
    parts += doily(0.18, 0.713, 0.07)
    parts += scaled(mug(0.18, 0.724, 0.07), (0.18, 0.716, 0.07), 0.62)
    parts += scaled(bud_vase(0.14, 0.713, -0.24), (0.14, 0.713, -0.24), 0.8)
    return parts
