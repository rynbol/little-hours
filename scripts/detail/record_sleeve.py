import math
from kit import lathe, rbox, sphere, torus
from picture_frame import ring

FRAME, VINYL, BRASS = '#303447', '#343c52', '#bf9762'
FACING = (math.pi / 2, 0, 0)
EYE = (0.3, 0.3, 1.0)
AO = 0.55


def display_frame():
    profile = [(0.0, 0.05), (0.0, 0.14), (0.004, 0.152), (0.012, 0.16), (0.024, 0.163), (0.036, 0.16), (0.044, 0.152), (0.052, 0.156),
               (0.062, 0.166), (0.072, 0.168), (0.08, 0.164), (0.086, 0.158), (0.09, 0.155), (0.09, 0.05)]
    parts = [ring(1.22, 1.22, profile, FRAME), rbox([1.18, 1.18, 0.05], (0, 0, 0.08), FRAME, bevel=0.01, surface='wood')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(rbox([0.07, 0.016, 0.006], (sx * 0.56, sy * 0.6, 0.166), BRASS, bevel=0.003, segments=1, surface='metal', layer='metal'))
            parts.append(rbox([0.016, 0.07, 0.006], (sx * 0.6, sy * 0.56, 0.166), BRASS, bevel=0.003, segments=1, surface='metal', layer='metal'))
            parts.append(sphere((0.008, 0.008, 0.005), (sx * 0.585, sy * 0.585, 0.17), BRASS, subdivisions=1, surface='metal', layer='metal'))
    return parts


def vinyl():
    grooves = [(0.4, 0.11), (0.402, 0.165), (0.398, 0.173), (0.39, 0.176)]
    r = 0.385
    while r > 0.3:
        grooves += [(r, 0.1765), (r - 0.006, 0.1745)]
        r -= 0.012
    grooves += [(0.292, 0.176), (0.284, 0.172), (0.28, 0.163), (0.28, 0.11), (0.0, 0.11)]
    parts = [lathe(grooves[::-1], (0, 0, 0), VINYL, segments=64, surface='plain', rotation=FACING)]
    for radius in (0.3, 0.335, 0.37):
        parts.append(torus(radius, 0.0022, (0, 0, 0.1768), '#262c3e', major_segments=48, minor_segments=3))
    for start in (0.35, math.pi + 0.35):
        for radius, width in ((0.318, 0.9), (0.352, 0.7), (0.386, 0.5)):
            parts.append(torus(radius, 0.003, (0, 0, 0.1772), '#56607e', major_segments=10, minor_segments=3, arc=width, rotation=(0, 0, start)))
    return parts


def build():
    return display_frame() + vinyl()
