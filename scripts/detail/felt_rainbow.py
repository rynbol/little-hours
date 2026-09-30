import math
from kit import Frame, cylinder, lathe, rbox, rod, sphere, torus, tube

BANDS = ['#eabfa1', '#f5d6bf', '#b79bc6']
THREADS = ['#c98f73', '#d9ae8f', '#8f76a3']
CLOUD, CLOUD_THREAD, TWINE, PIN = '#fbf3ea', '#d8c3b4', '#c7ab86', '#bf9762'
CENTRE_Y = -0.55
EYE = (0.12, 0.2, 1.0)
AO = 0.3


def felt_band(radius, width, thickness, z, colour):
    band = torus(radius, 0.01, (0, CENTRE_Y, z), colour, arc=math.pi, major_segments=56, minor_segments=8, surface='cloth')
    for v in band.data.vertices:
        flat = math.hypot(v.co.x, v.co.z)
        ox, oz = v.co.x / flat, v.co.z / flat
        across, depth = max(-1, min(1, (flat - radius) / 0.01)), max(-1, min(1, v.co.y / 0.01))
        sx = math.copysign(abs(across) ** 0.55, across) * width / 2
        sy = math.copysign(abs(depth) ** 0.55, depth) * thickness / 2
        v.co.x, v.co.z, v.co.y = ox * (radius + sx), oz * (radius + sx), sy
    band.data.update()
    return band


def running_stitch(radius, z, colour, spacing=0.085):
    parts = []
    count = int(radius * math.pi / spacing)
    for k in range(count):
        a = (k + 0.5) / count * math.pi
        parts.append(rbox([0.036, 0.01, 0.008], (math.cos(a) * radius, CENTRE_Y + math.sin(a) * radius, z), colour, bevel=0, surface='cloth', rotation=(0, 0, a + math.pi / 2)))
    return parts


def puff(radii, position, colour, segments=12, rings=6):
    profile = [(math.sin(k / rings * math.pi), -math.cos(k / rings * math.pi)) for k in range(rings + 1)]
    obj = lathe(profile, position, colour, segments=segments, surface='cloth')
    for v in obj.data.vertices:
        v.co.x, v.co.y, v.co.z = v.co.x * radii[0], v.co.y * radii[2], v.co.z * radii[1]
    obj.data.update()
    return obj


def felt_cloud(x, mirror):
    parts = []
    for dx, dy, rx, ry in ((0.0, 0.03, 0.16, 0.13), (-0.15, -0.03, 0.12, 0.09), (0.15, -0.04, 0.13, 0.09)):
        parts.append(puff((rx, ry, 0.035), (x + dx * mirror, CENTRE_Y + dy, 0.13), CLOUD))
    parts.append(rbox([0.5, 0.08, 0.05], (x, CENTRE_Y - 0.08, 0.13), CLOUD, bevel=0.024, surface='cloth'))
    for k in range(7):
        a = 0.3 + k / 6 * (math.pi - 0.6)
        parts.append(rbox([0.03, 0.009, 0.008], (x + math.cos(a) * 0.14 * mirror, CENTRE_Y + 0.03 + math.sin(a) * 0.11, 0.166), CLOUD_THREAD, bevel=0, surface='cloth', rotation=(0, 0, (a + math.pi / 2) * mirror)))
    parts.append(sphere((0.012, 0.012, 0.006), (x - 0.04 * mirror, CENTRE_Y + 0.02, 0.166), '#6d5a52', subdivisions=1))
    parts.append(sphere((0.012, 0.012, 0.006), (x + 0.04 * mirror, CENTRE_Y + 0.02, 0.166), '#6d5a52', subdivisions=1))
    parts.append(torus(0.022, 0.004, (x, CENTRE_Y - 0.005, 0.166), '#6d5a52', rotation=(0, 0, math.pi), arc=math.pi, major_segments=8, minor_segments=4))
    parts.append(puff((0.022, 0.014, 0.004), (x - 0.075 * mirror, CENTRE_Y - 0.01, 0.166), '#eeb3a8', segments=8, rings=4))
    return parts


def hanger():
    top = 0.66
    parts = [cylinder(0.022, 0.022, 0.03, (0, top, 0.02), PIN, segments=12, surface='metal', layer='metal', rotation=(math.pi / 2, 0, 0)),
             sphere((0.03, 0.03, 0.018), (0, top, 0.045), PIN, subdivisions=2, surface='metal', layer='metal')]
    for side in (-1, 1):
        parts.append(tube([(0, top, 0.03), (side * 0.25, 0.63, 0.03), (side * 0.52, 0.47, 0.03)], 0.006, TWINE, resolution=4))
    return parts


def build():
    parts = []
    for band, colour in enumerate(BANDS):
        radius, z = 1.1 - band * 0.2, 0.06 + band * 0.012
        parts.append(felt_band(radius, 0.175, 0.06, z, colour))
        parts += running_stitch(radius + 0.05, z + 0.031, THREADS[band])
    for side in (-1, 1):
        parts += felt_cloud(side * 0.9, side)
    parts += hanger()
    return parts
