import math, bpy, bmesh
from kit import Frame, _finish, _mesh_from_bmesh, at, babylon_rotation, cylinder, lathe, rbox, sphere, torus
from mathutils import Matrix, Vector
import assets

SAGE, SAGE_LIGHT, DARK, MUSTARD, LINEN, PAPER = '#83968a', '#a0afa0', '#73533d', '#d8b477', '#dfd1b2', '#f2ead5'
BRASS, WELT, BUTTON, MUSTARD_WELT, STRIPE = '#bf9762', '#6f8276', '#65786c', '#c29a5e', '#c7b48e'
EYE = (0.55, 0.5, 1.0)


def sheet(point_at, stops, columns, colour_of, thickness=0.012, surface='cloth'):
    bm = bmesh.new()
    band = bm.faces.layers.int.new('band')
    colours = []
    grid = [[bm.verts.new(point_at(t, j / columns)) for j in range(columns + 1)] for t in stops]
    for i in range(len(stops) - 1):
        for j in range(columns):
            colour = colour_of((stops[i] + stops[i + 1]) / 2, (j + 0.5) / columns)
            if colour not in colours:
                colours.append(colour)
            face = bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
            face[band] = colours.index(colour)
    obj = _mesh_from_bmesh(bm)
    solid = obj.modifiers.new('solid', 'SOLIDIFY')
    solid.thickness, solid.offset = thickness, 0
    assets.apply_all(obj)
    parts = []
    for index, colour in enumerate(colours):
        piece = bmesh.new()
        piece.from_mesh(obj.data)
        layer = piece.faces.layers.int['band']
        bmesh.ops.delete(piece, geom=[f for f in piece.faces if f[layer] != index], context='FACES')
        parts.append(_finish(_mesh_from_bmesh(piece), colour, surface, 'paint', None, (0, 0, 0), (0, 0, 0)))
    bpy.data.objects.remove(obj)
    return parts


def welt(half_w, half_d, inset, colour, radius=0.011, points=40, sides=5):
    bm = bmesh.new()
    rings = []
    for k in range(points):
        a = k / points * math.tau
        cx, cz = math.cos(a), math.sin(a)
        x = (half_w - inset) * abs(cx) ** 0.25 * (1 if cx >= 0 else -1)
        z = (half_d - inset) * abs(cz) ** 0.25 * (1 if cz >= 0 else -1)
        nx, nz = abs(cx) ** 0.75 * (1 if cx >= 0 else -1) / max(half_w, 1e-6), abs(cz) ** 0.75 * (1 if cz >= 0 else -1) / max(half_d, 1e-6)
        length = math.hypot(nx, nz) or 1
        nx, nz = nx / length, nz / length
        rings.append([bm.verts.new((x + nx * math.cos(b) * radius, z + nz * math.cos(b) * radius, math.sin(b) * radius)) for b in (j / sides * math.tau for j in range(sides))])
    for k in range(points):
        r0, r1 = rings[k], rings[(k + 1) % points]
        for j in range(sides):
            bm.faces.new((r0[j], r1[j], r1[(j + 1) % sides], r0[(j + 1) % sides]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bmesh(bm), colour, 'cloth', 'paint', None, (0, 0, 0), (0, 0, 0))


def plump(size, position, colour, puff=0.3, tufts=(0, 0), button=None, piping=None, frame=None, rotation=(0, 0, 0), dice=None, segments=3, depth=0.22):
    w, h, d = size
    obj = rbox(size, (0, 0, 0), colour, bevel=min(size) * 0.42, surface='cloth', segments=segments, dice=dice or min(w, d) / 4)
    for v in obj.data.vertices:
        x, z, y = v.co.x / (w / 2), v.co.y / (d / 2), v.co.z / (h / 2)
        swell = max(0, 1 - max(abs(x), abs(z)) ** 3)
        v.co.z += (1 if y > 0 else -1) * swell * puff * h * 0.5 * min(1, abs(y) + 0.2)
        if tufts[0] and tufts[1] and y > 0.3:
            for i in range(tufts[0]):
                for j in range(tufts[1]):
                    tx, tz = (i + 0.5) / tufts[0] * 2 - 1, (j + 0.5) / tufts[1] * 2 - 1
                    v.co.z -= h * depth * math.exp(-((x - tx) * tufts[0]) ** 2 * 9 - ((z - tz) * tufts[1]) ** 2 * 9) * y
    obj.data.update()
    parts = [obj]
    if button:
        for i in range(tufts[0]):
            for j in range(tufts[1]):
                tx, tz = (i + 0.5) / tufts[0] * 2 - 1, (j + 0.5) / tufts[1] * 2 - 1
                hit, point, *_ = obj.ray_cast(Vector((tx * w / 2, tz * d / 2, h * 2)), Vector((0, 0, -1)))
                top = point.z if hit else h / 2
                parts.append(sphere((0.022, 0.012, 0.022), (tx * w / 2, top + 0.003, tz * d / 2), button, subdivisions=2, surface='cloth'))
    if piping:
        parts.append(welt(w / 2, d / 2, min(size) * 0.42 * 0.2, piping))
    place = (frame.matrix if frame else Matrix.Identity(4)) @ Matrix.Translation(at(*position)) @ babylon_rotation(*rotation).to_4x4()
    for part in parts:
        part.matrix_world = place @ part.matrix_world
    return parts


def resample(path):
    lengths = [0.0]
    for a, b in zip(path, path[1:]):
        lengths.append(lengths[-1] + math.dist(a, b))
    def at(t):
        d = t * lengths[-1]
        for k in range(len(path) - 1):
            if d <= lengths[k + 1] or k == len(path) - 2:
                f = (d - lengths[k]) / max(1e-9, lengths[k + 1] - lengths[k])
                return tuple(path[k][n] + (path[k + 1][n] - path[k][n]) * f for n in range(2))
    return at


def drape(path, x0, x1, colour_of, fold, edges=(), columns=14, hang_from=0.5):
    along = resample(path)
    def point(t, s):
        y, z = along(t)
        y2, z2 = along(min(1, t + 0.01)) if t < 1 else along(t)
        y1, z1 = along(max(0, t - 0.01))
        ty, tz = y2 - y1, z2 - z1
        norm = math.hypot(ty, tz) or 1
        ny, nz = -tz / norm, ty / norm
        weight = max(0.0, (t - hang_from) / (1 - hang_from))
        wave = math.sin(s * math.tau * 2.3 + 0.6) * fold * (0.25 + weight * 1.1) + math.sin(s * math.tau * 5.1) * fold * 0.2
        flare = (s - 0.5) * weight * weight * 0.05
        x = x0 + (x1 - x0) * s + flare
        return (x, z + nz * wave, y + ny * wave)
    stops = sorted({round(k / 8 * hang_from, 4) for k in range(9)} | {round(hang_from + k / 25 * (1 - hang_from), 4) for k in range(26)} | set(edges))
    return sheet(point, stops, columns, colour_of), lambda s: point(1, s)


def tassels(hem, count, colour, length=0.065):
    parts = []
    shape = [(0.0, -length), (0.011, -length + 0.004), (0.013, -length * 0.6), (0.008, -length * 0.46), (0.011, -length * 0.36), (0.004, 0.004), (0.0, 0.004)]
    for k in range(count):
        x, z, y = hem((k + 0.5) / count)
        parts.append(lathe(shape, (x, y, z + 0.006), colour, segments=7, surface='cloth', rotation=(0.08, 0, 0.05 * math.sin(k * 2.1))))
    return parts


def leg(x, z):
    profile = [(0.0, 0.0), (0.034, 0.0), (0.038, 0.004), (0.038, 0.026), (0.036, 0.03), (0.0, 0.03)]
    wood = [(0.0, 0.028), (0.04, 0.028), (0.046, 0.05), (0.052, 0.09), (0.056, 0.13), (0.06, 0.16), (0.066, 0.18), (0.07, 0.2), (0.0, 0.2)]
    return [lathe(profile, (x, 0.0, z), BRASS, segments=16, surface='metal', layer='metal'),
            lathe(wood, (x, 0.0, z), DARK, segments=16, surface='wood')]


def arm(side):
    x = side * 0.675
    parts = [rbox([0.25, 0.44, 1.26], (x, 0.64, -0.02), SAGE, bevel=0.07, surface='cloth', segments=3),
             cylinder(0.14, 0.14, 1.3, (x + side * 0.012, 0.835, -0.02), SAGE, segments=24, bevel=0.05, surface='cloth', rotation=(math.pi / 2, 0, 0))]
    face = Frame((x + side * 0.012, 0.835, 0.63))
    parts.append(cylinder(0.125, 0.125, 0.03, (0, 0, 0), SAGE, segments=24, bevel=0.012, surface='cloth', frame=face, rotation=(math.pi / 2, 0, 0)))
    parts.append(torus(0.126, 0.009, (0, 0, 0.016), WELT, major_segments=28, minor_segments=6, surface='cloth', frame=face))
    parts.append(sphere((0.024, 0.024, 0.014), (0, 0, 0.03), BUTTON, subdivisions=2, surface='cloth', frame=face))
    return parts


def throw():
    path = [(0.745, -0.3), (0.752, 0.1), (0.748, 0.45), (0.735, 0.59), (0.705, 0.665), (0.655, 0.705), (0.56, 0.722), (0.4, 0.73), (0.26, 0.745)]
    bands = [(0.0, 0.8, LINEN), (0.8, 0.84, STRIPE), (0.84, 0.88, LINEN), (0.88, 0.92, STRIPE), (0.92, 1.0, LINEN)]
    colour_of = lambda t, s: next(colour for start, end, colour in bands if start <= t < end)
    parts, hem = drape(path, -0.57, -0.2, colour_of, fold=0.014, edges=[edge for band in bands for edge in band[:2]])
    return parts + tassels(hem, 7, PAPER)


def pillow():
    tilt = Frame((0.17, 0.96, -0.13), (0, 0.12, -0.13))
    return plump([0.53, 0.18, 0.47], (0, 0, 0), MUSTARD, puff=0.55, frame=tilt, rotation=(math.pi / 2 - 0.22, 0, 0), tufts=(1, 1), button=MUSTARD_WELT)


def build():
    parts = []
    for x in (-0.56, 0.56):
        for z in (-0.45, 0.44):
            parts += leg(x, z)
    parts.append(rbox([1.54, 0.32, 1.4], (0, 0.36, -0.03), SAGE, bevel=0.09, surface='cloth', segments=4))
    parts.append(rbox([1.45, 0.94, 0.24], (0, 0.91, -0.585), SAGE, bevel=0.11, surface='cloth', segments=4))
    parts += plump([1.08, 0.28, 0.8], (0, 0.93, -0.37), SAGE, puff=0.5, rotation=(math.pi / 2 - 0.12, 0, 0), tufts=(4, 3), button=BUTTON, dice=0.07, depth=0.3)
    for side in (-1, 1):
        parts += arm(side)
    parts += plump([1.06, 0.2, 1.04], (0, 0.61, 0.13), SAGE_LIGHT, puff=0.35, piping=WELT)
    parts += pillow()
    parts += throw()
    return parts
