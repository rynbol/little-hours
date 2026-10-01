import math
import bmesh
import kit
from kit import Frame, at, cylinder, lathe, rbox, rod, sphere, torus, tube

WOOD, EDGE, DARK, TERRACOTTA, LEAF, DARK_LEAF = '#aa7954', '#bc9169', '#73533d', '#bd8469', '#809362', '#617853'
BRASS, CURTAIN, TRIM, PAPER = '#bf9762', '#efdfc4', '#d39a86', '#f2ead5'
BOOKS = ['#6b7a5c', '#9c5f46']
EYE = (0.3, 0.25, 1.0)
AO = 0.55


def puff(radii, position, colour, segments=10, rings=5, surface='cloth', frame=None, rotation=(0, 0, 0)):
    profile = [(math.sin(k / rings * math.pi), -math.cos(k / rings * math.pi)) for k in range(rings + 1)]
    obj = lathe(profile, (0, 0, 0), colour, segments=segments, surface=surface)
    for v in obj.data.vertices:
        v.co.x, v.co.y, v.co.z = v.co.x * radii[0], v.co.y * radii[2], v.co.z * radii[1]
    obj.data.update()
    obj.matrix_world = (frame.matrix if frame else Frame().matrix) @ Frame(position, rotation).matrix
    return obj


def cloth_sheet(shape, cols, rows, colour, thickness=0.012, surface='cloth'):
    bm = bmesh.new()
    grid = [[bm.verts.new(at(*shape(i / cols, j / rows))) for i in range(cols + 1)] for j in range(rows + 1)]
    for j in range(rows):
        for i in range(cols):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bm.normal_update()
    if sum(f.normal.y for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    obj = kit._mesh_from_bmesh(bm, 'cloth')
    kit._finish(obj, colour, surface, 'paint', None, (0, 0, 0), (0, 0, 0))
    solid = obj.modifiers.new('solid', 'SOLIDIFY')
    solid.thickness, solid.offset = thickness, -1
    kit.assets.apply_all(obj)
    return obj


def curtain(outer, inner, top, bottom, z, colour=CURTAIN, folds=4, depth=0.05, tie=None, cols_per_fold=3, rows=10):
    def shape(u, v):
        gather = 1.0
        if tie is not None:
            gather = 1 - 0.68 * math.exp(-((v - tie) / 0.22) ** 2) - (0.25 * (v - tie) / (1 - tie) if v < tie else -0.1 * (v - tie) / (1 - tie))
            gather = max(0.3, min(1.0, gather))
        x = outer + (inner - outer) * u * gather
        wave = 0.5 - 0.5 * math.cos(u * folds * math.tau)
        bulge = 1 + (1 - gather) * 1.4
        y = top + (bottom - top) * v - (0.03 * math.sin(u * math.pi) * v if tie is not None else 0)
        return (x, y, z + depth * wave * bulge * (0.35 + 0.65 * v))
    return cloth_sheet(shape, folds * cols_per_fold, rows, colour)


def valance(left, right, top, bottom, z, colour=CURTAIN, folds=9, scallops=3, depth=0.03):
    def shape(u, v):
        x = left + (right - left) * u
        dip = (bottom - top) * (0.75 + 0.25 * abs(math.sin(u * scallops * math.pi)))
        wave = 0.5 - 0.5 * math.cos(u * folds * math.tau)
        return (x, top + dip * v, z + depth * wave * (0.4 + 0.6 * v))
    body = cloth_sheet(shape, folds * 3, 4, colour)
    def hem(u, v):
        x = left + (right - left) * u
        dip = (bottom - top) * (0.75 + 0.25 * abs(math.sin(u * scallops * math.pi)))
        wave = 0.5 - 0.5 * math.cos(u * folds * math.tau)
        return (x, top + dip + 0.025 * v - 0.012, z + depth * wave + 0.004)
    return [body, cloth_sheet(hem, folds * 3, 1, TRIM, thickness=0.006)]


def curtain_rod(left, right, y, z, rings=()):
    parts = [rod((left, y, z), (right, y, z), 0.014, BRASS, sides=12, surface='metal', layer='metal')]
    for x in (left, right):
        parts.append(sphere((0.03, 0.03, 0.03), (x, y, z), BRASS, subdivisions=2, surface='metal', layer='metal'))
    for x in (left + 0.08, right - 0.08):
        parts.append(rod((x, y, 0.0), (x, y, z), 0.008, BRASS, sides=8, surface='metal', layer='metal'))
        parts.append(cylinder(0.026, 0.026, 0.01, (x, y, 0.005), BRASS, segments=12, surface='metal', layer='metal', rotation=(math.pi / 2, 0, 0)))
    for x in rings:
        parts.append(torus(0.022, 0.005, (x, y, z), BRASS, rotation=(0, math.pi / 2, 0), major_segments=10, minor_segments=4, surface='metal', layer='metal'))
    return parts


def tie_back(x, y, z, width=0.12, colour=TRIM):
    f = Frame((x, y, z))
    parts = [rbox([width, 0.04, 0.03], (0, 0, 0.055), colour, bevel=0.014, surface='cloth', frame=f, segments=2)]
    parts.append(puff((0.03, 0.026, 0.02), (0, 0, 0.08), colour, segments=8, rings=4, frame=f))
    parts.append(tube([(0, -0.01, 0.08), (0.01, -0.06, 0.085), (-0.004, -0.11, 0.08)], 0.008, colour, frame=f, resolution=2))
    parts.append(puff((0.016, 0.03, 0.016), (-0.004, -0.13, 0.08), colour, segments=8, rings=4, frame=f))
    return parts


def hinge(x, y, z, side=1):
    parts = [rod((x, y - 0.05, z), (x, y + 0.05, z), 0.011, BRASS, sides=10, surface='metal', layer='metal')]
    parts.append(rbox([0.05, 0.08, 0.006], (x - side * 0.028, y, z - 0.004), BRASS, bevel=0.002, surface='metal', layer='metal', segments=1))
    for dy in (-0.022, 0.022):
        parts.append(cylinder(0.006, 0.006, 0.006, (x - side * 0.03, y + dy, z), DARK, segments=6, rotation=(math.pi / 2, 0, 0)))
    return parts


def latch(x, y, z, turn=0.35):
    f = Frame((x, y, z))
    parts = [rbox([0.04, 0.09, 0.008], (0, 0, 0), BRASS, bevel=0.003, surface='metal', layer='metal', frame=f, segments=1),
             cylinder(0.012, 0.014, 0.022, (0, 0.02, 0.012), BRASS, segments=10, surface='metal', layer='metal', frame=f, rotation=(math.pi / 2, 0, 0))]
    arm = Frame((0, 0.02, 0.024), (0, 0, turn), f)
    parts.append(rbox([0.1, 0.018, 0.01], (0.04, 0, 0), BRASS, bevel=0.004, surface='metal', layer='metal', frame=arm, segments=2))
    parts.append(sphere((0.012, 0.012, 0.012), (0.09, 0, 0.002), BRASS, subdivisions=1, surface='metal', layer='metal', frame=arm))
    return parts


def potted_plant(x, y, z, scale=1.0):
    f = Frame((x, y, z))
    s = scale
    pot = [(0.0, 0.0), (0.05 * s, 0.0), (0.056 * s, 0.006 * s), (0.068 * s, 0.075 * s), (0.078 * s, 0.078 * s), (0.08 * s, 0.1 * s), (0.074 * s, 0.104 * s), (0.068 * s, 0.09 * s), (0.0, 0.09 * s)]
    parts = [lathe(pot, (0, 0, 0), TERRACOTTA, segments=18, surface='ceramic', frame=f),
             cylinder(0.064 * s, 0.064 * s, 0.006, (0, 0.092 * s, 0), '#5f4637', segments=14, frame=f),
             cylinder(0.07 * s, 0.07 * s, 0.006, (0, -0.002, 0), '#9c6d57', segments=14, surface='ceramic', frame=f)]
    for k in range(8):
        a = k / 8 * math.tau + (k % 2) * 0.3
        lean = 0.5 + (k % 3) * 0.28
        length = (0.07 + (k % 3) * 0.018) * s
        parts.append(puff((0.022 * s, length, 0.008 * s), (math.cos(a) * 0.025 * s, 0.1 * s + length * 0.8, math.sin(a) * 0.025 * s), LEAF if k % 2 else DARK_LEAF,
                          segments=8, rings=4, surface='leaf', frame=f, rotation=(lean, math.pi / 2 - a, 0)))
    return parts


def sill_books(x, y, z):
    parts = []
    for i, colour in enumerate(BOOKS):
        f = Frame((x + i * 0.012, y + 0.018 + i * 0.036, z), (0, 0.25 - i * 0.35, 0))
        parts.append(rbox([0.2, 0.034, 0.14], (0, 0, 0), colour, bevel=0.008, surface='cloth', frame=f, segments=2))
        parts.append(rbox([0.19, 0.024, 0.128], (0.008, 0, 0), PAPER, bevel=0.003, surface='paper', frame=f, segments=1))
    parts.append(rbox([0.014, 0.004, 0.09], (x + 0.02, y + 0.074, z + 0.08), '#c9716a', bevel=0, surface='cloth', rotation=(0.6, 0, 0)))
    return parts


def frame_members(half_w, half_h, bar=0.1, depth=0.1):
    parts = []
    for y in (half_h - bar / 2, -half_h + bar / 2):
        parts.append(rbox([half_w * 2, bar, depth], (0, y, depth / 2), WOOD, bevel=0.018, surface='wood', segments=2))
    for x in (half_w - bar / 2, -half_w + bar / 2):
        parts.append(rbox([bar, half_h * 2 - bar * 2 + 0.01, depth], (x, 0, depth / 2), WOOD, bevel=0.018, surface='wood', segments=2))
    inner_w, inner_h = half_w - bar, half_h - bar
    for y in (inner_h, -inner_h):
        parts.append(rod((-inner_w, y, depth - 0.012), (inner_w, y, depth - 0.012), 0.012, EDGE, sides=8, surface='wood'))
    for x in (inner_w, -inner_w):
        parts.append(rod((x, -inner_h, depth - 0.012), (x, inner_h, depth - 0.012), 0.012, EDGE, sides=8, surface='wood'))
    return parts


def reveal(half_w, half_h, opening=0.06, depth=0.13):
    parts = []
    w, h = half_w - opening + 0.02, half_h - opening + 0.02
    for x in (w - 0.02, -w + 0.02):
        parts.append(rbox([0.04, h * 2, depth], (x, 0, -depth / 2), EDGE, bevel=0.006, surface='wood', segments=1))
    for y in (h - 0.02, -h + 0.02):
        parts.append(rbox([w * 2, 0.04, depth], (0, y, -depth / 2), EDGE, bevel=0.006, surface='wood', segments=1))
    return parts


def sash(left, right, bottom, top, z, bar_y):
    parts = []
    stile = 0.045
    for x in (left + stile / 2, right - stile / 2):
        parts.append(rbox([stile, top - bottom, 0.045], (x, (top + bottom) / 2, z), EDGE, bevel=0.01, surface='wood', segments=2))
    for y in (top - stile / 2, bottom + stile / 2):
        parts.append(rbox([right - left - stile * 2 + 0.01, stile, 0.045], ((left + right) / 2, y, z), EDGE, bevel=0.01, surface='wood', segments=2))
    parts.append(rbox([right - left - stile * 2 + 0.01, 0.03, 0.035], ((left + right) / 2, bar_y, z), EDGE, bevel=0.008, surface='wood', segments=2))
    return parts


def build():
    parts = frame_members(0.75, 0.85)
    parts += reveal(0.75, 0.85)
    parts += sash(-0.65, 0.0, -0.75, 0.75, 0.035, 0.06)
    parts += sash(0.0, 0.65, -0.75, 0.75, 0.035, 0.06)
    for y in (0.5, -0.5):
        parts += hinge(0.64, y, 0.06, 1) + hinge(-0.64, y, 0.06, -1)
    parts += latch(-0.035, -0.02, 0.06)
    parts.append(rbox([1.62, 0.07, 0.24], (0, -0.815, 0.12), DARK, bevel=0.025, surface='wood', segments=2))
    parts.append(rbox([1.44, 0.07, 0.03], (0, -0.88, 0.03), DARK, bevel=0.012, surface='wood', segments=2))
    for x in (-0.62, 0.62):
        parts.append(rbox([0.05, 0.1, 0.14], (x, -0.9, 0.07), DARK, bevel=0.02, surface='wood', segments=2))
        parts.append(sphere((0.024, 0.024, 0.024), (x, -0.96, 0.12), DARK, subdivisions=1, surface='wood'))
    parts += potted_plant(0.44, -0.78, 0.13)
    parts += sill_books(-0.42, -0.78, 0.12)
    parts += curtain_rod(-0.84, 0.84, 0.93, 0.13)
    parts += valance(-0.8, 0.8, 0.93, 0.74, 0.14)
    for side in (-1, 1):
        parts.append(curtain(side * 0.82, side * 0.5, 0.9, -0.74, 0.12, tie=0.6))
        parts += tie_back(side * 0.77, -0.1, 0.12)
    return parts
