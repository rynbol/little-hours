import array, base64, bpy, bmesh, json, math, os, sys
from mathutils import Matrix, Vector, noise

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)
import assets

ROOT = os.path.dirname(SCRIPTS)
OUT = os.path.join(ROOT, 'src', 'models', 'detail')
SURFACES = {'plain': 10, 'wood': 9, 'cloth': 8, 'metal': 7, 'paper': 6, 'leaf': 5, 'ceramic': 4, 'stone': 3}
LAYERS = ('paint', 'metal', 'glow')

hex_rgb = assets.hex_rgb


def reset():
    assets.reset()


def at(x, y, z):
    return Vector((x, z, y))


def babylon_rotation(pitch=0, yaw=0, roll=0):
    swap = Matrix(((1, 0, 0), (0, 0, 1), (0, 1, 0)))
    rx, ry, rz = Matrix.Rotation(pitch, 3, 'X'), Matrix.Rotation(yaw, 3, 'Y'), Matrix.Rotation(roll, 3, 'Z')
    return swap @ (ry @ rx @ rz) @ swap


def place(obj, position, rotation=(0, 0, 0), parent=None):
    local = Matrix.Translation(at(*position)) @ babylon_rotation(*rotation).to_4x4()
    obj.matrix_world = (parent if parent is not None else Matrix.Identity(4)) @ local
    return obj


class Frame:
    def __init__(self, position=(0, 0, 0), rotation=(0, 0, 0), parent=None):
        base = parent.matrix if parent else Matrix.Identity(4)
        self.matrix = base @ Matrix.Translation(at(*position)) @ babylon_rotation(*rotation).to_4x4()


def _finish(obj, colour, surface, layer, frame, position, rotation, shade=None):
    obj.matrix_world = (frame.matrix if frame else Matrix.Identity(4)) @ Matrix.Translation(at(*position)) @ babylon_rotation(*rotation).to_4x4()
    obj['hex'], obj['surface'], obj['layer'] = colour, surface, layer
    if shade:
        obj['shade'] = json.dumps(shade)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def _mesh_from_bmesh(bm, name='part'):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def rbox(size, position, colour, bevel=0.02, surface='plain', layer='paint', frame=None, rotation=(0, 0, 0), segments=3, dice=0):
    w, h, d = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    if dice:
        cuts = lambda span: max(0, int(span / dice) - 1)
        for axis, span in ((0, w), (1, d), (2, h)):
            edges = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co)[axis]) > span * 0.9]
            if cuts(span):
                bmesh.ops.subdivide_edges(bm, edges=edges, cuts=cuts(span), use_grid_fill=True)
    obj = _mesh_from_bmesh(bm)
    b = min(bevel, min(size) * 0.45)
    if b > 0.0005:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width, mod.segments, mod.limit_method, mod.angle_limit = b, segments, 'ANGLE', math.radians(50)
        mod.harden_normals = False
        assets.apply_all(obj)
    return _finish(obj, colour, surface, layer, frame, position, rotation)


def lathe(profile, position, colour, segments=28, surface='plain', layer='paint', frame=None, rotation=(0, 0, 0), wobble=None, caps=True):
    bm = bmesh.new()
    rings = []
    for radius, y in profile:
        ring = []
        for k in range(segments):
            a = k / segments * math.tau
            r = radius * (1 + (wobble(a, y) if wobble else 0))
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, y)))
        rings.append(ring)
    for lower, upper in zip(rings, rings[1:]):
        for k in range(segments):
            bm.faces.new((lower[k], lower[(k + 1) % segments], upper[(k + 1) % segments], upper[k]))
    if caps and profile[0][0] > 0.0005:
        bm.faces.new(list(reversed(rings[0])))
    if caps and profile[-1][0] > 0.0005:
        bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bmesh(bm), colour, surface, layer, frame, position, rotation)


def cylinder(radius_top, radius_bottom, height, position, colour, segments=28, bevel=0.0, **kw):
    b = min(bevel, height * 0.4, radius_top * 0.5 or bevel, radius_bottom * 0.5 or bevel)
    if b > 0:
        bottom = [(radius_bottom - b + math.sin(k / 3 * math.pi / 2) * b, -height / 2 + b - math.cos(k / 3 * math.pi / 2) * b) for k in range(4)]
        top = [(radius_top - b + math.cos(k / 3 * math.pi / 2) * b, height / 2 - b + math.sin(k / 3 * math.pi / 2) * b) for k in range(4)]
    else:
        bottom, top = [(radius_bottom, -height / 2)], [(radius_top, height / 2)]
    (r0, y0), (r1, y1) = bottom[-1], top[0]
    rings = max(1, min(8, round((y1 - y0) / 0.08)))
    side = [(r0 + (r1 - r0) * k / rings, y0 + (y1 - y0) * k / rings) for k in range(1, rings)]
    profile = [(0, -height / 2), (bottom[0][0] * 0.5, -height / 2)] + bottom + side + top + [(top[-1][0] * 0.5, height / 2), (0, height / 2)]
    return lathe(profile, position, colour, segments, **kw)


def tube(points, radius, colour, sides=10, tip=1.0, surface='plain', layer='paint', frame=None, resolution=6):
    obj = assets.branch([at(*p) for p in points], radius, tip=tip, resolution=resolution)
    return _finish(obj, colour, surface, layer, frame, (0, 0, 0), (0, 0, 0))


def rod(a, b, radius, colour, sides=12, **kw):
    a, b = Vector(a), Vector(b)
    direction = b - a
    length = direction.length
    obj = cylinder(radius, radius, length, (0, 0, 0), colour, segments=sides, **{k: v for k, v in kw.items() if k != 'frame'})
    frame = kw.get('frame')
    up = Vector((0, 1, 0))
    axis = up.cross(direction.normalized())
    angle = math.acos(max(-1, min(1, up.dot(direction.normalized()))))
    rot = Matrix.Rotation(angle, 4, axis) if axis.length > 1e-6 else (Matrix.Rotation(math.pi, 4, 'X') if direction.y < 0 else Matrix.Identity(4))
    swap = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    middle = (a + b) / 2
    obj.matrix_world = (frame.matrix if frame else Matrix.Identity(4)) @ Matrix.Translation(at(*middle)) @ swap @ rot @ swap
    return obj


def sphere(radii, position, colour, subdivisions=3, **kw):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1)
    bmesh.ops.scale(bm, vec=(radii[0], radii[2], radii[1]), verts=bm.verts)
    return _finish(_mesh_from_bmesh(bm), colour, kw.get('surface', 'plain'), kw.get('layer', 'paint'), kw.get('frame'), position, kw.get('rotation', (0, 0, 0)))


def torus(major, minor, position, colour, rotation=(0, 0, 0), major_segments=28, minor_segments=10, arc=math.tau, **kw):
    bm = bmesh.new()
    rings = []
    closed = arc >= math.tau - 1e-6
    count = major_segments if closed else major_segments + 1
    for i in range(count):
        a = i / major_segments * arc
        centre = Vector((math.cos(a) * major, 0, math.sin(a) * major))
        out = Vector((math.cos(a), 0, math.sin(a)))
        rings.append([bm.verts.new(centre + out * math.cos(b) * minor + Vector((0, math.sin(b) * minor, 0))) for b in (j / minor_segments * math.tau for j in range(minor_segments))])
    for i in range(count if closed else count - 1):
        r0, r1 = rings[i], rings[(i + 1) % count]
        for j in range(minor_segments):
            bm.faces.new((r0[j], r1[j], r1[(j + 1) % minor_segments], r0[(j + 1) % minor_segments]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bmesh(bm), colour, kw.get('surface', 'plain'), kw.get('layer', 'paint'), kw.get('frame'), position, rotation)


def cushion(size, position, colour, puff=0.3, bevel=None, surface='cloth', frame=None, rotation=(0, 0, 0), tufts=(0, 0), button=None, piping=None):
    w, h, d = size
    obj = rbox(size, (0, 0, 0), colour, bevel=bevel if bevel is not None else min(size) * 0.42, surface=surface, segments=4, dice=min(w, d) / 6)
    mesh = obj.data
    for v in mesh.vertices:
        x, z, y = v.co.x / (w / 2), v.co.y / (d / 2), v.co.z / (h / 2)
        swell = max(0, 1 - max(abs(x), abs(z)) ** 3)
        v.co.z += (1 if y > 0 else -1) * swell * puff * h * 0.5 * min(1, abs(y) + 0.2)
        if tufts[0] and tufts[1] and y > 0.3:
            for i in range(tufts[0]):
                for j in range(tufts[1]):
                    tx, tz = (i + 0.5) / tufts[0] * 2 - 1, (j + 0.5) / tufts[1] * 2 - 1
                    dist = math.hypot((x - tx) * tufts[0], (z - tz) * tufts[1])
                    v.co.z -= h * 0.22 * math.exp(-dist * dist * 9) * y
    mesh.update()
    extras = []
    if button and tufts[0] and tufts[1]:
        for i in range(tufts[0]):
            for j in range(tufts[1]):
                tx, tz = ((i + 0.5) / tufts[0] * 2 - 1) * w / 2, ((j + 0.5) / tufts[1] * 2 - 1) * d / 2
                extras.append(sphere((0.022, 0.012, 0.022), (tx, h / 2 + h * puff * 0.5 * 0.5, tz), button, subdivisions=2, surface='cloth'))
    if piping:
        r = bevel if bevel is not None else min(size) * 0.42
        pts = []
        for k in range(49):
            a = k / 48 * math.tau
            cx, cz = math.cos(a), math.sin(a)
            sx = (w / 2 - r * 0.2) * (abs(cx) ** 0.25) * (1 if cx >= 0 else -1)
            sz = (d / 2 - r * 0.2) * (abs(cz) ** 0.25) * (1 if cz >= 0 else -1)
            pts.append((sx, 0, sz))
        extras.append(tube(pts, min(0.012, h * 0.08), piping, surface='cloth', resolution=2))
    parts = [obj] + extras
    for part in parts:
        part.matrix_world = (frame.matrix if frame else Matrix.Identity(4)) @ Matrix.Translation(at(*position)) @ babylon_rotation(*rotation).to_4x4() @ part.matrix_world
    return parts


def displace(obj, amount, scale=6.0, seed=0):
    for v in obj.data.vertices:
        v.co += v.normal * amount * noise.noise(v.co * scale + Vector((seed, seed * 0.3, 0)))
    obj.data.update()
    return obj


def _paint(objects, palette):
    for obj in objects:
        mesh = obj.data
        if 'Col' in mesh.color_attributes:
            mesh.color_attributes.remove(mesh.color_attributes['Col'])
        col = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        base = hex_rgb(obj['hex'])
        code = SURFACES[obj['surface']] / 10
        slot = palette.setdefault(obj['hex'], len(palette))
        obj['slot'] = slot
        shade = json.loads(obj['shade']) if 'shade' in obj else None
        world = obj.matrix_world
        normal_matrix = world.to_3x3()
        for loop in mesh.loops:
            co = world @ mesh.vertices[loop.vertex_index].co
            n = (normal_matrix @ mesh.vertices[loop.vertex_index].normal).normalized()
            k = 0.9 + 0.1 * max(0, n.z) - 0.04 * max(0, -n.z)
            if shade:
                k *= 1 + shade.get('mottle', 0) * noise.noise(co * shade.get('scale', 8))
            col.data[loop.index].color = (base.x * k, base.y * k, base.z * k, code)


def _bake(objects, strength):
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
    bpy.context.scene.world = world
    bpy.context.scene.cycles.samples = 32
    for obj in objects:
        mesh = obj.data
        mesh.color_attributes.new('AO', 'FLOAT_COLOR', 'CORNER')
        mesh.color_attributes.active_color = mesh.color_attributes['AO']
        if not mesh.materials:
            mesh.materials.append(bpy.data.materials.new('bake'))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.context.scene.render.bake.target = 'VERTEX_COLORS'
    bpy.context.scene.world.light_settings.distance = 0.35
    bpy.ops.object.bake(type='AO')
    for obj in objects:
        mesh = obj.data
        ao, col = mesh.color_attributes['AO'], mesh.color_attributes['Col']
        amount = strength if obj['layer'] != 'glow' else 0
        for i in range(len(mesh.loops)):
            k = 1 - amount * (1 - ao.data[i].color[0])
            c = col.data[i].color
            col.data[i].color = (c[0] * k, c[1] * k, c[2] * k, c[3])


def _pack(objects):
    positions, normals, colours, slots, indices, seen = [], [], [], [], [], {}
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        col = mesh.color_attributes['Col']
        corner = mesh.corner_normals
        world, normal_matrix = obj.matrix_world, obj.matrix_world.to_3x3()
        for tri in mesh.loop_triangles:
            for loop in tri.loops:
                p = world @ mesh.vertices[mesh.loops[loop].vertex_index].co
                n = (normal_matrix @ corner[loop].vector).normalized()
                c = col.data[loop].color
                key = (round(p.x, 4), round(p.z, 4), round(p.y, 4), round(n.x, 2), round(n.z, 2), round(n.y, 2), round(c[0], 3), round(c[1], 3), round(c[2], 3), round(c[3], 2), obj['slot'])
                if key not in seen:
                    seen[key] = len(seen)
                    positions += key[:3]
                    normals += key[3:6]
                    colours += key[6:10]
                    slots.append(key[10])
                indices.append(seen[key])
    pack = lambda kind, values: base64.b64encode(array.array(kind, values).tobytes()).decode()
    wide = len(seen) > 65535
    shape = {
        'positions': pack('h', [round(v * 4000) for v in positions]),
        'normals': pack('b', [round(v * 127) for v in normals]),
        'colors': pack('B', [round(min(1, max(0, v)) * 255) for v in colours]),
        'slots': pack('B', slots),
        ('indices32' if wide else 'indices'): pack('I' if wide else 'H', indices),
    }
    return shape, len(seen), len(indices) // 3


def export(name, objects, ao=0.7):
    objects = [o for o in objects if o is not None]
    palette = {}
    _paint(objects, palette)
    _bake([o for o in objects if o['layer'] != 'glow'] or objects, ao)
    out = {'scale': 4000, 'palette': sorted(palette, key=palette.get), 'layers': {}}
    report = []
    for layer in LAYERS:
        members = [o for o in objects if o['layer'] == layer]
        if not members:
            continue
        shape, vertices, triangles = _pack(members)
        out['layers'][layer] = shape
        report.append(f'{layer} {vertices}v/{triangles}t')
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + '.js'), 'w') as f:
        f.write('export default ' + json.dumps(out, separators=(',', ':')) + ';\n')
    print(f'{name}: ' + ', '.join(report))


def preview(path, eye=(0.35, 0.45, 1.0), size=720):
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == 'MESH']
    corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    low = Vector(tuple(min(c[i] for c in corners) for i in range(3)))
    high = Vector(tuple(max(c[i] for c in corners) for i in range(3)))
    middle, reach = (low + high) / 2, (high - low).length
    bpy.ops.object.camera_add(location=middle + at(*eye).normalized() * reach * 1.05)
    cam = bpy.context.object
    target = bpy.data.objects.new('target', None)
    bpy.context.collection.objects.link(target)
    target.location = middle
    cam.constraints.new('TRACK_TO').target = target
    scene.camera = cam
    bpy.ops.object.light_add(type='SUN', rotation=(0.7, 0.2, 0.9))
    bpy.context.object.data.energy = 3.5
    for obj in meshes:
        mat = bpy.data.materials.new('show')
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        attr = nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Col'
        gamma = nodes.new('ShaderNodeGamma')
        gamma.inputs['Gamma'].default_value = 2.2
        mat.node_tree.links.new(attr.outputs['Color'], gamma.inputs['Color'])
        bsdf = nodes['Principled BSDF']
        mat.node_tree.links.new(gamma.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.8
        if obj['layer'] == 'glow':
            mat.node_tree.links.new(gamma.outputs['Color'], bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = 1.5
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    scene.view_settings.view_transform = 'Standard'
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.3, 0.28, 0.36, 1)
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
