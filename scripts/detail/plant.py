import math
import bmesh
from mathutils import Vector
import assets
import kit
from kit import cylinder, displace, lathe, sphere, torus, tube

TERRACOTTA, SOIL, STEM = '#bd8469', '#73533d', '#617853'
CLAY_DARK, CLAY_LIGHT, SAUCER, MOSS, PEBBLE, SPROUT, RIB = '#a86f55', '#d49c7f', '#b27a5f', '#7d8f5a', '#a79c8c', '#95a576', '#b3bf8e'
EYE = (0.3, 0.55, 1.0)


def _basis(direction, facing):
    y = Vector(direction).normalized()
    hint = Vector(facing)
    z = (hint - y * hint.dot(y))
    z = z.normalized() if z.length > 1e-5 else Vector((0, 0, 1))
    x = y.cross(z).normalized()
    return x, y, z


def _half_width(shape, u, width):
    if shape == 'heart':
        return 0.5 * width * math.sin(math.pi * min(1, max(0, u)) ** 0.62) ** 0.7
    if shape == 'grass':
        return 0.5 * width * (1 - u ** 3) * min(1, u * 8 + 0.35)
    return 0.5 * width * math.sin(math.pi * min(1, max(0, u)) ** 0.8) ** 0.9


def leaf(base, direction, facing, length, width, colour, shape='lance', cup=0.25, droop=0.25, fold=0.22, twist=0.0, rib=RIB, rows=7, cols=2, thickness=0.004, lobe=0.0):
    x_axis, y_axis, z_axis = _basis(direction, facing)
    base = Vector(base)

    def point(u, v):
        w = _half_width(shape, u, width)
        turn = twist * u
        across = v * w
        lift = fold * abs(v) * w + cup * v * v * w - droop * length * u * u
        back = lobe * length * abs(v) ** 1.5 * (1 - u) ** 3
        side = x_axis * math.cos(turn) + z_axis * math.sin(turn)
        normal = z_axis * math.cos(turn) - x_axis * math.sin(turn)
        return base + side * across + y_axis * (u * length - back) + normal * lift

    bm = bmesh.new()
    grid = []
    for i in range(rows + 1):
        u = 0.02 + 0.98 * i / rows
        grid.append([bm.verts.new(kit.at(*point(u, j / cols - 1))) for j in range(2 * cols + 1)])
    for i in range(rows):
        for j in range(2 * cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._mesh_from_bmesh(bm, 'leaf')
    solid = obj.modifiers.new('solid', 'SOLIDIFY')
    solid.thickness, solid.offset = thickness, 0
    assets.apply_all(obj)
    parts = [kit._finish(obj, colour, 'leaf', 'paint', None, (0, 0, 0), (0, 0, 0))]
    if rib:
        spine = [tuple(point(u, 0) + z_axis * thickness * 0.6) for u in (0.0, 0.3, 0.6, 0.9)]
        parts.append(tube(spine, max(0.0025, width * 0.028), rib, surface='leaf', tip=0.25, resolution=2))
    return parts


def soil(radius, top, colour, position=(0, 0, 0), lump=0.012, seed=0, segments=28):
    profile = [(0.0, top + lump * 0.5)] + [(radius * k / 5, top + lump * 0.5 * (1 - k / 5)) for k in range(1, 6)] + [(radius, top - 0.03)]
    mound = lathe(profile, position, colour, segments=segments, surface='stone')
    return displace(mound, lump, scale=40, seed=seed)


def pebble(size, position, colour, seed=0, rotation=(0, 0, 0)):
    stone = sphere(size, position, colour, subdivisions=2, surface='stone', rotation=rotation)
    return displace(stone, min(size) * 0.25, scale=9, seed=seed)


def pot():
    wall = [(0.0, 0.05), (0.15, 0.05), (0.16, 0.06), (0.172, 0.1), (0.2, 0.22), (0.222, 0.31), (0.226, 0.33), (0.246, 0.336), (0.252, 0.36), (0.25, 0.385),
            (0.238, 0.392), (0.222, 0.388), (0.214, 0.37), (0.21, 0.345), (0.0, 0.345)]
    parts = [lathe(wall, (0, 0, 0), TERRACOTTA, segments=36, surface='ceramic', wobble=lambda a, y: 0.006 * math.sin(a * 5 + y * 20))]
    parts.append(cylinder(0.165, 0.15, 0.05, (0, 0.035, 0), CLAY_DARK, segments=32, bevel=0.01, surface='ceramic'))
    parts.append(lathe([(0.0, 0.0), (0.2, 0.0), (0.235, 0.008), (0.245, 0.035), (0.236, 0.04), (0.2, 0.018), (0.0, 0.018)], (0, 0, 0), SAUCER, segments=36, surface='ceramic'))
    parts.append(torus(0.214, 0.007, (0, 0.27, 0), CLAY_DARK, rotation=(math.pi / 2, 0, 0), major_segments=36, minor_segments=6, surface='ceramic'))
    for k in range(12):
        a = k / 12 * math.tau
        parts.append(sphere((0.012, 0.012, 0.006), (math.cos(a) * 0.207, 0.235, math.sin(a) * 0.207), CLAY_LIGHT, subdivisions=1, surface='ceramic', rotation=(0, -a + math.pi / 2, 0)))
    parts.append(soil(0.212, 0.366, SOIL, seed=3))
    for k, (r, a, s) in enumerate(((0.15, 0.4, 0.03), (0.17, 2.6, 0.024), (0.12, 4.1, 0.02), (0.18, 5.3, 0.028))):
        parts.append(pebble((s, s * 0.6, s * 0.85), (math.cos(a) * r, 0.372, math.sin(a) * r), PEBBLE if k % 2 else MOSS, seed=k))
    return parts


def stems():
    parts = []
    for i in range(7):
        angle, h = i * 2.4, 0.73 + (i % 3) * 0.16
        x, z = math.cos(angle) * 0.2, math.sin(angle) * 0.2
        path = [(x * t ** 1.7, 0.36 + (h - 0.36) * t, z * t ** 1.7) for t in (0.0, 0.35, 0.7, 1.0)]
        parts.append(tube(path, 0.014, STEM, surface='leaf', tip=0.6, resolution=6))
    return parts


def sprouts():
    parts = []
    for k, a in enumerate((0.9, 3.4)):
        base = (math.cos(a) * 0.09, 0.375, math.sin(a) * 0.09)
        for side in (-1, 1):
            d = (math.cos(a + side * 0.6), 0.9, math.sin(a + side * 0.6))
            parts += leaf(base, d, (0, 1, 0), 0.11, 0.06, SPROUT, droop=0.2, rows=4, cols=1)
        parts.append(tube([(base[0], 0.36, base[2]), (base[0], 0.38, base[2])], 0.005, STEM, surface='leaf', resolution=1))
    return parts


def build():
    return pot() + stems() + sprouts()
