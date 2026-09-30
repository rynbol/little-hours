import math
from kit import lathe, rod, sphere, torus
from lounge_chair import sheet

DARK, HIDE, TOP, SEAM, STITCH = '#73533d', '#b3956d', '#c7ad85', '#dfc8a2', '#cfb78e'
BUTTON, KNIT, RIB = '#a4855f', '#a3b19c', '#94a38e'
EYE = (0.45, 0.7, 1.0)
LOBES = 8


def body():
    bulge = lambda y: math.sin(math.pi * min(1, max(0, (y - 0.06) / 0.34)))
    channel = lambda a, y: 0.035 * abs(math.sin(a * LOBES / 2)) * (0.35 + 0.65 * bulge(y))
    profile = [(0.47, 0.055), (0.482, 0.07), (0.49, 0.1), (0.495, 0.16), (0.497, 0.23), (0.495, 0.3), (0.49, 0.36), (0.482, 0.39), (0.47, 0.405)]
    parts = [lathe(profile, (0, 0, 0), HIDE, segments=64, surface='cloth', wobble=channel)]
    for k in range(LOBES):
        a = k / LOBES * math.tau
        points = [(r * math.cos(a), y, r * math.sin(a)) for r, y in profile[1:-1]]
        for p, q in zip(points, points[1:]):
            parts.append(rod(p, q, 0.005, STITCH, sides=4, surface='cloth'))
    return parts


def top():
    profile = [(0.0, 0.512), (0.12, 0.508), (0.25, 0.497), (0.36, 0.478), (0.44, 0.455), (0.482, 0.43), (0.49, 0.41), (0.482, 0.398), (0.0, 0.398)]
    dome = lathe(profile, (0, 0, 0), TOP, segments=64, surface='cloth')
    mesh = dome.data
    for v in mesh.vertices:
        r = math.hypot(v.co.x, v.co.y)
        if v.co.z > 0.42 and r > 0.001:
            a = math.atan2(v.co.y, v.co.x)
            spoke = math.exp(-(math.sin(a * LOBES / 2) * r / 0.05) ** 2)
            v.co.z -= 0.016 * spoke * min(1, r / 0.1) * min(1, (0.49 - r) / 0.08) + 0.018 * math.exp(-(r / 0.07) ** 2)
    mesh.update()
    return [dome, sphere((0.03, 0.016, 0.03), (0, 0.497, 0), BUTTON, subdivisions=2, surface='cloth'),
            torus(0.493, 0.011, (0, 0.405, 0), SEAM, rotation=(math.pi / 2, 0, 0), major_segments=64, minor_segments=6, surface='cloth'),
            torus(0.476, 0.009, (0, 0.062, 0), SEAM, rotation=(math.pi / 2, 0, 0), major_segments=64, minor_segments=5, surface='cloth')]


def plinth():
    profile = [(0.0, 0.0), (0.42, 0.0), (0.44, 0.006), (0.448, 0.02), (0.44, 0.032), (0.452, 0.046), (0.458, 0.058), (0.0, 0.058)]
    parts = [lathe(profile, (0, 0, 0), DARK, segments=48, surface='wood')]
    return parts


def dome_height(r):
    return 0.512 - 0.06 * (r / 0.49) ** 2.2


def blanket():
    half, drop, radius = 0.2, 0.2, 0.535
    def point(t, s):
        x = -half + 2 * half * s
        rim = math.sqrt(radius ** 2 - x ** 2)
        wave = 0.016 * math.sin(s * math.tau * 2.5 + 0.4) * max(0, t - 0.5) * 2
        if t < 0.55:
            z = 0.08 + (rim - 0.08 - 0.08) * t / 0.55
            return (x, z, dome_height(math.hypot(x, z)) + 0.012)
        k = (t - 0.55) / 0.45
        bend = min(1, k * 3)
        z = rim - 0.08 + 0.08 * bend + wave
        y = dome_height(rim - 0.08) + 0.012 - (0.05 * bend) - (drop + 0.08) * max(0, k - 0.15)
        return (x, z, y)
    stops = [k / 30 for k in range(31)]
    colour_of = lambda t, s: RIB if round(s * 16 - 0.5) % 2 else KNIT
    fold = rod((-half - 0.004, dome_height(0.1) + 0.016, 0.08), (half + 0.004, dome_height(0.1) + 0.016, 0.08), 0.014, KNIT, sides=10, surface='cloth')
    return sheet(point, stops, 16, colour_of, thickness=0.016) + [fold]


def build():
    return plinth() + body() + top() + blanket()
