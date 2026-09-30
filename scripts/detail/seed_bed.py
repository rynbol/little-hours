import math
from mathutils import noise, Vector
from kit import Frame, cylinder, rbox, rod, sphere, tube
from plant import leaf, pebble

WOOD, DARK, SOIL, EDGE = '#aa7954', '#73533d', '#6b4a36', '#bc9169'
PLANK_DARK, RIVET, STICK, SPROUT, SPROUT_DARK, STEEL, TAGS = '#9c6e4c', '#bf9762', '#e2c99a', '#95a576', '#809362', '#9aa09a', ['#c77868', '#d7b572', '#6f8aa6']
EYE = (0.45, 0.75, 1.0)
SOIL_TOP = 0.715


def box():
    parts = []
    for x in (-0.845, 0.845):
        for z in (-0.345, 0.345):
            parts.append(rbox([0.11, 0.72, 0.11], (x, 0.36, z), DARK, bevel=0.02, surface='wood'))
            parts.append(rbox([0.13, 0.03, 0.13], (x, 0.015, z), DARK, bevel=0.01, surface='wood'))
    for k, y in enumerate((0.325, 0.47, 0.615)):
        timber = WOOD if k != 1 else PLANK_DARK
        for z in (-0.385, 0.385):
            parts.append(rbox([1.6, 0.138, 0.04], (0, y, z), timber, bevel=0.012, surface='wood'))
            for x in (-0.765, 0.765):
                for dy in (-0.035, 0.035):
                    parts.append(sphere((0.008, 0.008, 0.004), (x, y + dy, z * 1.054), DARK, subdivisions=1, surface='metal', layer='metal'))
        for x in (-0.885, 0.885):
            parts.append(rbox([0.04, 0.138, 0.6], (x, y, 0), timber, bevel=0.012, surface='wood'))
    for y in (0.4, 0.55):
        for z in (-0.41, 0.41):
            parts.append(rbox([1.82, 0.03, 0.014], (0, y, z), DARK, bevel=0.004, surface='metal', layer='metal'))
            for x in (-0.6, -0.2, 0.2, 0.6):
                parts.append(sphere((0.011, 0.011, 0.006), (x, y, z * 1.017), RIVET, subdivisions=1, surface='metal', layer='metal'))
        for x in (-0.91, 0.91):
            parts.append(rbox([0.014, 0.03, 0.84], (x, y, 0), DARK, bevel=0.004, surface='metal', layer='metal'))
    for z in (-0.37, 0.37):
        parts.append(rbox([1.86, 0.05, 0.1], (0, 0.715, z), EDGE, bevel=0.018, surface='wood'))
    for x in (-0.895, 0.895):
        parts.append(rbox([0.1, 0.05, 0.64], (x, 0.715, 0), EDGE, bevel=0.018, surface='wood'))
    for x in (-0.845, 0.845):
        for z in (-0.345, 0.345):
            parts.append(cylinder(0.022, 0.024, 0.012, (x, 0.743, z), RIVET, segments=12, bevel=0.004, surface='metal', layer='metal'))
    return parts


def bed():
    earth = rbox([1.7, 0.06, 0.66], (0, SOIL_TOP - 0.03, 0), SOIL, bevel=0.01, surface='stone', dice=0.045)
    for v in earth.data.vertices:
        if v.co.z > 0.02:
            x, z = v.co.x, v.co.y
            rows = sum(math.exp(-((abs(x) - centre) / 0.055) ** 2) for centre in (0.56, 0.74))
            v.co.z += 0.022 * rows - 0.006 + 0.005 * noise.noise(Vector((x * 30, z * 30, 0)))
    earth.data.update()
    return [earth]


def seedlings():
    parts = []
    for side in (-1, 1):
        for row in range(3):
            z = -0.22 + row * 0.22
            for col in range(2):
                x = side * (0.56 + col * 0.18)
                base = (x, SOIL_TOP + 0.01, z)
                parts.append(tube([base, (x, SOIL_TOP + 0.03, z), (x + 0.004, SOIL_TOP + 0.05, z)], 0.005, SPROUT_DARK, surface='leaf', resolution=2))
                turn = row * 0.9 + col * 1.7
                for flip in (-1, 1):
                    d = (math.cos(turn) * flip, 0.45, math.sin(turn) * flip)
                    parts += leaf((x + 0.004, SOIL_TOP + 0.05, z), d, (0, 1, 0), 0.05, 0.034, SPROUT, rows=3, cols=1, droop=0.1, rib=None, thickness=0.003)
    return parts


def markers():
    parts = []
    for k, (x, z) in enumerate(((-0.46, 0.25), (0.47, -0.24), (0.47, 0.25))):
        f = Frame((x, SOIL_TOP, z), (0.08 * (k - 1), 0.3 * k, 0.1))
        parts.append(rbox([0.035, 0.15, 0.008], (0, 0.055, 0), STICK, bevel=0.003, surface='wood', frame=f))
        parts.append(rbox([0.036, 0.035, 0.009], (0, 0.11, 0), TAGS[k], bevel=0.003, frame=f))
    return parts


def trowel():
    f = Frame((0.5, 0.748, 0.37), (0, 0.06, 0))
    parts = [rbox([0.1, 0.012, 0.075], (0.06, 0.004, 0), STEEL, bevel=0.005, surface='metal', layer='metal', frame=f)]
    parts.append(rod((0.0, 0.006, 0), (-0.05, 0.02, 0), 0.006, STEEL, sides=8, surface='metal', layer='metal', frame=f))
    parts.append(cylinder(0.014, 0.012, 0.11, (-0.1, 0.022, 0), '#c77868', segments=12, bevel=0.005, surface='wood', frame=f, rotation=(0, 0, math.pi / 2)))
    return parts


def stones():
    return [pebble((0.03, 0.018, 0.024), (-0.3, SOIL_TOP + 0.005, -0.22), '#a79c8c', seed=1),
            pebble((0.022, 0.014, 0.02), (0.33, SOIL_TOP + 0.004, 0.2), '#9c958a', seed=2),
            pebble((0.026, 0.015, 0.02), (-0.36, SOIL_TOP + 0.004, 0.16), '#b9876a', seed=3)]


def build():
    return box() + bed() + seedlings() + markers() + trowel() + stones()
