import math
import bmesh
import kit
from kit import at, rbox, sphere, tube

BRASS = '#bf9762'
BACK, ART = 0.05, 0.14
PROFILE = [(0.0, 0.05), (0.0, 0.118), (0.02, 0.129), (0.06, 0.134), (0.13, 0.134), (0.16, 0.142), (0.22, 0.148), (0.28, 0.143), (0.31, 0.135),
           (0.36, 0.132), (0.42, 0.129), (0.49, 0.131), (0.55, 0.139), (0.61, 0.152), (0.67, 0.163), (0.73, 0.169), (0.79, 0.168), (0.85, 0.161),
           (0.9, 0.153), (0.94, 0.15), (1.0, 0.149), (1.0, 0.05)]


def sharpen(bm, degrees=38):
    for edge in bm.edges:
        if len(edge.link_faces) == 2 and edge.calc_face_angle(0) > math.radians(degrees):
            edge.smooth = False


def finish(bm, colour, surface, layer, frame=None, degrees=38):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sharpen(bm, degrees)
    obj = kit._mesh_from_bmesh(bm)
    return kit._finish(obj, colour, surface, layer, frame, (0, 0, 0), (0, 0, 0))


def ring(width, height, profile, colour, depth_scale=1.0, surface='wood', layer='paint', frame=None, centre=(0, 0)):
    bm = bmesh.new()
    loops = []
    for inset, z in profile:
        hw, hh = width / 2 - inset, height / 2 - inset
        loops.append([bm.verts.new(at(centre[0] + x, centre[1] + y, z * depth_scale)) for x, y in ((hw, hh), (-hw, hh), (-hw, -hh), (hw, -hh))])
    for a, b in zip(loops, loops[1:] + loops[:1]):
        for k in range(4):
            if a[k] is not b[k]:
                bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    return finish(bm, colour, surface, layer, frame)


def slab(points, z, depth, colour, surface='plain', layer='paint', frame=None):
    bm = bmesh.new()
    front = [bm.verts.new(at(x, y, z + depth)) for x, y in points]
    back = [bm.verts.new(at(x, y, z)) for x, y in points]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(points)
    for k in range(n):
        bm.faces.new((back[k], back[(k + 1) % n], front[(k + 1) % n], front[k]))
    return finish(bm, colour, surface, layer, frame)


def crescent(cx, cy, r, z, colour, tilt=0.0, layer='glow', frame=None):
    tip = math.radians(58)
    shift = r * 0.52
    inner = math.hypot(r * math.cos(tip) - shift, r * math.sin(tip))
    top = math.atan2(r * math.sin(tip), r * math.cos(tip) - shift)
    outline = ellipse(0, 0, r, r, tip, math.tau - tip, 16) + ellipse(shift, 0, inner, inner, math.tau - top, top, 12)[1:-1]
    c, s = math.cos(tilt), math.sin(tilt)
    return slab([(cx + x * c - y * s, cy + x * s + y * c) for x, y in outline], z, 0.006, colour, layer=layer, frame=frame)


def star(cx, cy, r, z, colour, frame=None):
    points = [(cx + math.cos(math.pi / 2 + k * math.pi / 4) * (r if k % 2 == 0 else r * 0.38), cy + math.sin(math.pi / 2 + k * math.pi / 4) * (r if k % 2 == 0 else r * 0.38)) for k in range(8)]
    return slab(points, z, 0.004, colour, layer='glow', frame=frame)


def hill(x0, x1, base, crest, bumps, phase, z, colour, frame=None, steps=18, shore=(False, False)):
    def height(t):
        lift = crest + bumps * math.sin(phase + t * math.pi * 1.7) * math.sin(t * math.pi) ** 0.35
        fade = min(1.0, (t / 0.35) if shore[0] else 1.0, ((1 - t) / 0.35) if shore[1] else 1.0)
        return base + (lift - base) * math.sin(fade * math.pi / 2) ** 0.8
    top = [(x0 + (x1 - x0) * i / steps, height(i / steps)) for i in range(steps + 1)]
    return slab(top + [(x1, base), (x0, base)], z, 0.005, colour, surface='leaf', frame=frame)


def cottage(x, y, z, scale, wall, roof, frame=None):
    s = scale
    parts = [rbox([0.07 * s, 0.05 * s, 0.012], (x, y + 0.025 * s, z + 0.006), wall, bevel=0.003, frame=frame),
             slab([(x - 0.047 * s, y + 0.048 * s), (x + 0.047 * s, y + 0.048 * s), (x, y + 0.088 * s)], z + 0.002, 0.014, roof, frame=frame),
             rbox([0.012 * s, 0.03 * s, 0.01], (x + 0.022 * s, y + 0.085 * s, z + 0.007), roof, bevel=0.002, frame=frame),
             rbox([0.016 * s, 0.028 * s, 0.004], (x - 0.018 * s, y + 0.014 * s, z + 0.013), '#6b4a33', bevel=0.001, frame=frame),
             rbox([0.018 * s, 0.016 * s, 0.004], (x + 0.016 * s, y + 0.028 * s, z + 0.013), '#ffd58a', bevel=0.001, layer='glow', frame=frame)]
    return parts


def ellipse(cx, cy, rx, ry, a0, a1, steps):
    return [(cx + math.cos(a0 + (a1 - a0) * i / steps) * rx, cy + math.sin(a0 + (a1 - a0) * i / steps) * ry) for i in range(steps + 1)]


def crest(top, width, colour, sky, scene, frame=None):
    base, spring, peak = top - 0.06, top + 0.015, top + 0.095
    radius = width / 2
    outline = [(radius, base)] + ellipse(0, spring, radius, peak - spring, 0, math.pi, 22) + [(-radius, base)]
    parts = [slab(outline, 0.168, 0.012, sky, frame=frame)]
    sill = [(-radius + 2 * radius * i / 8, base) for i in range(1, 8)]
    parts.append(tube([(x, y, 0.182) for x, y in outline + sill + [outline[0]]], 0.008, colour, surface='wood', frame=frame, resolution=2))
    back = [(radius + 0.02, base - 0.012)] + ellipse(0, spring, radius + 0.02, peak - spring + 0.018, 0, math.pi, 22) + [(-radius - 0.02, base - 0.012)]
    parts.append(slab(back, 0.13, 0.04, colour, surface='wood', frame=frame))
    for side in (-1, 1):
        cx, cy = radius + 0.042, base + 0.012
        start = math.atan2(0.028, -0.04)
        scroll = [(side * (cx + math.cos(start - t * 6.6) * (0.049 - 0.036 * t)), cy + math.sin(start - t * 6.6) * (0.049 - 0.036 * t)) for t in (i / 18 for i in range(19))]
        parts.append(tube([(x, y, 0.162) for x, y in scroll], 0.01, colour, tip=0.55, surface='wood', frame=frame, resolution=3))
        parts.append(sphere((0.01, 0.01, 0.008), (side * cx, cy, 0.166), BRASS, subdivisions=1, surface='metal', layer='metal', frame=frame))
    for lean in (-0.7, 0, 0.7):
        parts.append(sphere((0.01, 0.022, 0.008), (math.sin(lean) * 0.02, peak + 0.012 + math.cos(lean) * 0.006, 0.172), colour, subdivisions=1, surface='wood', frame=frame, rotation=(0, 0, -lean)))
    parts.append(sphere((0.011, 0.011, 0.009), (0, peak + 0.006, 0.18), BRASS, subdivisions=1, surface='metal', layer='metal', frame=frame))
    parts += scene(-radius + 0.016, radius - 0.016, base + 0.008, spring, peak - 0.008, 0.18, frame)
    return parts


def rosette(x, y, colour, frame=None, size=0.03):
    parts = [sphere((size * 0.38, size * 0.38, size * 0.22), (x, y, 0.162), BRASS, subdivisions=1, surface='metal', layer='metal', frame=frame)]
    for k in range(5):
        a = k / 5 * math.tau + 0.3
        parts.append(sphere((size * 0.26, size * 0.46, size * 0.14), (x + math.cos(a) * size * 0.5, y + math.sin(a) * size * 0.5, 0.158), colour, subdivisions=1, surface='wood', frame=frame, rotation=(0, 0, a - math.pi / 2)))
    return parts


def leaf_spray(x, y, colour, frame=None, span=0.1, vertical=False):
    parts = []
    for side in (-1, 1):
        for k in range(3):
            t = (k + 0.5) / 3
            along = side * span * 0.5 * t
            dx, dy = (0, along) if vertical else (along, 0)
            angle = (0 if vertical else math.pi / 2) + side * (0.5 + t * 0.4) * (1 if not vertical else -1)
            parts.append(sphere((0.008 + 0.006 * (1 - t), 0.022 - 0.008 * t, 0.006), (x + dx, y + dy, 0.166), colour, subdivisions=1, surface='wood', frame=frame, rotation=(0, 0, angle)))
    parts.append(sphere((0.011, 0.011, 0.008), (x, y, 0.168), BRASS, subdivisions=1, surface='metal', layer='metal', frame=frame))
    return parts


def build_frame(outer, picture, colour, sky, scene, crest_width):
    width, height = outer
    border = min((width - picture[0]) / 2, (height - picture[1]) / 2) + 0.012
    profile = [(inset * border, z) for inset, z in PROFILE]
    parts = [ring(width, height, profile, colour)]
    sight = width - 2 * border, height - 2 * border
    bead = [(0.0, 0.146), (0.0, 0.152), (0.002, 0.156), (0.005, 0.158), (0.008, 0.156), (0.01, 0.152), (0.01, 0.146)]
    parts.append(ring(sight[0] + 0.02, sight[1] + 0.02, bead, BRASS, surface='metal', layer='metal'))
    parts.append(rbox([width - 0.04, height - 0.04, 0.012], (0, 0, BACK + 0.008), colour, bevel=0.004, surface='wood'))
    corner = border * 0.52
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts += rosette(sx * (width / 2 - corner), sy * (height / 2 - corner), colour, size=border * 0.62)
    mid = border * 0.52
    parts += leaf_spray(0, -(height / 2 - mid), colour, span=min(0.16, width * 0.2))
    for sx in (-1, 1):
        parts += leaf_spray(sx * (width / 2 - mid), 0, colour, span=min(0.16, height * 0.2), vertical=True)
    parts += crest(height / 2, crest_width, colour, sky, scene)
    return parts
