import json, math, bmesh
from kit import _finish, _mesh_from_bmesh, rbox, rod

BINDING, CREAM_BAND, TAN_BAND, FIELD, DIAMOND, FRINGE = '#bca982', '#e1d4b3', '#c8b28c', '#ddcdac', '#baa47d', '#d6c49d'
ROSE, SAGE = '#b88a72', '#98a38a'
EYE = (0.3, 1.0, 0.9)
AO = 0.5
CELL = 0.03
TOP = 0.0375


def flat_mesh(quads, colour, y, surface='cloth', mottle=0):
    bm = bmesh.new()
    for corners in quads:
        bm.faces.new([bm.verts.new((x, z, y)) for x, z in corners])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00005)
    obj = _finish(_mesh_from_bmesh(bm), colour, surface, 'paint', None, (0, 0, 0), (0, 0, 0))
    if mottle:
        obj['shade'] = json.dumps({'mottle': mottle, 'scale': 22})
    return obj


def weave(half_x, half_z, colour_at, y=TOP, cell=CELL):
    columns, rows = round(half_x * 2 / cell), round(half_z * 2 / cell)
    dx, dz = half_x * 2 / columns, half_z * 2 / rows
    runs = {}
    for j in range(rows):
        z0 = -half_z + j * dz
        start, current = 0, None
        for i in range(columns + 1):
            colour = colour_at(-half_x + (i + 0.5) * dx, z0 + dz / 2) if i < columns else None
            if colour != current:
                if current is not None:
                    x0, x1 = -half_x + start * dx, -half_x + i * dx
                    runs.setdefault(current, []).append(((x0, z0), (x1, z0), (x1, z0 + dz), (x0, z0 + dz)))
                start, current = i, colour
    return [flat_mesh(quads, colour, y) for colour, quads in runs.items()]


def pattern(x, z):
    ax, az = abs(x), abs(z)
    edge = min(1.595 - ax, 1.075 - az)
    if edge < 0.06:
        return BINDING
    if edge < 0.19:
        along = x if 1.595 - ax > 1.075 - az else z
        depth = (edge - 0.06) / 0.13
        tooth = abs(((along / 0.13) % 1) - 0.5) * 2
        if depth < 0.18 or depth > 0.82:
            return TAN_BAND
        return BINDING if tooth < (depth - 0.18) * 1.4 and depth < 0.6 else CREAM_BAND
    if edge < 0.25:
        return TAN_BAND
    medallion = ax / 0.62 + az / 0.42
    if medallion < 1:
        if medallion < 0.22:
            return ROSE
        if medallion < 0.42:
            return CREAM_BAND
        if medallion < 0.56:
            return DIAMOND
        return TAN_BAND if medallion > 0.84 else FIELD
    if 0.96 < medallion < 1.06:
        return DIAMOND
    for cz in (-0.72, 0.72):
        for k in range(5):
            cx = -0.68 + k * 0.34
            d = abs(x - cx) + abs(z - cz)
            if d < 0.07:
                return DIAMOND
            if abs(k - 2) != 2 and 0.1 < d < 0.13:
                return SAGE
    corner = abs(ax - 1.15) + abs(az - 0.7)
    if corner < 0.1:
        return ROSE if corner < 0.04 else DIAMOND
    return FIELD


def fringe(x_edge, count, span, colour, side):
    parts = []
    for k in range(count):
        z = -span + k * span * 2 / (count - 1)
        wave = 0.012 * math.sin(k * 1.7)
        knot = (side * (x_edge + 0.035), 0.017, z)
        tip = (side * (x_edge + 0.15), 0.009, z + wave)
        parts.append(rod((side * (x_edge + 0.022), 0.019, z), (side * (x_edge + 0.045), 0.016, z), 0.011, colour, sides=6, surface='cloth'))
        for strand in (-0.006, 0.006):
            parts.append(rod(knot, (tip[0], tip[1], tip[2] + strand * 1.6), 0.0058, colour, sides=4, surface='cloth'))
    return parts


def build():
    parts = [rbox([3.24, 0.034, 2.20], (0, 0.019, 0), BINDING, bevel=0.016, surface='cloth', segments=3)]
    parts += weave(1.595, 1.075, pattern)
    for side in (-1, 1):
        parts += fringe(1.6, 26, 0.98, FRINGE, side)
    return parts
