import array, base64, bpy, bmesh, json, math, os, random, subprocess, sys
from mathutils import Vector, noise

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'models', 'assets')


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.device = 'CPU'


def hex_rgb(value):
    value = value.lstrip('#')
    return Vector(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_all(obj):
    active(obj)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name
    return objects[0]


def puff(location, radius, seed, lump=.18, subdivisions=3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location)
    obj = bpy.context.object
    obj.scale = radius
    offset = Vector((seed * 1.7, seed * 3.1, seed * .7))
    for v in obj.data.vertices:
        n = v.co.normalized()
        v.co *= 1 + lump * noise.noise(n * 1.6 + offset) + lump * .45 * noise.noise(n * 3.4 + offset)
    return obj


def branch(points, radius, tip=.35, resolution=6):
    curve = bpy.data.curves.new('branch', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    curve.resolution_u = resolution
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for i, (point, bez) in enumerate(zip(points, spline.bezier_points)):
        bez.co = point
        bez.handle_left_type = bez.handle_right_type = 'AUTO'
        bez.radius = 1 - (1 - tip) * i / (len(points) - 1)
    obj = bpy.data.objects.new('branch', curve)
    bpy.context.collection.objects.link(obj)
    active(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def fuse(obj, voxel, faces):
    remesh = obj.modifiers.new('fuse', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = voxel
    smooth = obj.modifiers.new('soften', 'SMOOTH')
    smooth.iterations = 4
    smooth.factor = .6
    apply_all(obj)
    if len(obj.data.polygons) > faces:
        decimate = obj.modifiers.new('budget', 'DECIMATE')
        decimate.ratio = faces / len(obj.data.polygons)
        apply_all(obj)
    return obj


def paint(obj, colour):
    mesh = obj.data
    layer = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for loop in mesh.loops:
        co = obj.matrix_world @ mesh.vertices[loop.vertex_index].co
        layer.data[loop.index].color = (*colour(co, mesh.vertices[loop.vertex_index]), 1)
    return obj


def radial_normals(obj, hub, amount):
    mesh = obj.data
    for poly in mesh.polygons:
        poly.use_smooth = True
    normals = []
    for loop in mesh.loops:
        vertex = mesh.vertices[loop.vertex_index]
        out = ((obj.matrix_world @ vertex.co) - hub).normalized()
        normals.append((vertex.normal * (1 - amount) + out * amount).normalized())
    mesh.normals_split_custom_set(normals)


def bake_occlusion(objects, strength=.75):
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
    bpy.context.scene.world = world
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
    bpy.ops.object.bake(type='AO')
    for obj in objects:
        mesh = obj.data
        ao, col = mesh.color_attributes['AO'], mesh.color_attributes['Col']
        for i in range(len(mesh.loops)):
            k = 1 - strength * (1 - ao.data[i].color[0])
            c = col.data[i].color
            col.data[i].color = (c[0] * k, c[1] * k, c[2] * k, 1)


def export(objects, name, flat=False):
    positions, normals, colours, indices, seen = [], [], [], [], {}
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        col = mesh.color_attributes['Col']
        corner = mesh.corner_normals
        shared = {}
        if flat:
            for loop in mesh.loops:
                total = shared.setdefault(loop.vertex_index, [0, 0, 0, 0])
                for i in range(3):
                    total[i] += col.data[loop.index].color[i]
                total[3] += 1
        for tri in mesh.loop_triangles:
            for loop in tri.loops:
                p = obj.matrix_world @ mesh.vertices[mesh.loops[loop].vertex_index].co
                n = (obj.matrix_world.to_3x3() @ corner[loop].vector).normalized()
                vertex = mesh.loops[loop].vertex_index
                c = [v / shared[vertex][3] for v in shared[vertex][:3]] if flat else col.data[loop].color
                key = (round(p.x, 3), round(p.z, 3), round(p.y, 3)) + ((0, 0, 0) if flat else (round(n.x, 2), round(n.z, 2), round(n.y, 2))) + (round(c[0], 2), round(c[1], 2), round(c[2], 2))
                if key not in seen:
                    seen[key] = len(seen)
                    positions += key[:3]
                    normals += key[3:6]
                    colours += key[6:]
                indices.append(seen[key])
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        pack = lambda kind, values: base64.b64encode(array.array(kind, values).tobytes()).decode()
        shape = {'flat': flat, 'positions': pack('h', [round(v * 1000) for v in positions]), 'colors': pack('B', [round(min(1, max(0, v)) * 255) for v in colours]), 'indices': pack('H', indices)}
        if not flat:
            shape['normals'] = pack('b', [round(v * 127) for v in normals])
        json.dump(shape, f, separators=(',', ':'))
    print(f'{name}: {len(seen)} vertices, {len(indices) // 3} triangles')


def gradient(low, high, bottom, top, jitter=.04, seed=0):
    low, high = hex_rgb(low), hex_rgb(high)
    def colour(co, vertex):
        t = max(0, min(1, (co.z - bottom) / (top - bottom) + jitter * noise.noise(co * 3 + Vector((seed, 0, 0)))))
        return low.lerp(high, t)
    return colour


LEAVES = {
    'sage': ('#4c6e5a', '#a3c27c'), 'olive': ('#557050', '#b2c877'), 'deep': ('#44634f', '#8fb474'),
    'blossom': ('#b5798f', '#f8d7da'), 'pine': ('#4d6e58', '#9dbb8a'), 'willow': ('#6a8a5a', '#b4c98e'),
}
BARK = ('#5e4535', '#8a6a52')


def lobe(at, radius, seed, subdivisions=3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=at)
    obj = bpy.context.object
    offset = Vector((seed * 1.3, seed * 2.1, seed * .4))
    for v in obj.data.vertices:
        n = v.co.normalized()
        k = 1 + .14 * noise.noise(n * 1.2 + offset) + .06 * noise.noise(n * 2.6 + offset)
        v.co = Vector((n.x * radius.x, n.y * radius.y, n.z * radius.z * (.78 if n.z < 0 else 1))) * k
    return obj


def park_tree(seed, leaves, size=1.0, lobes=8, wide=1.0, tall=1.0, girth=.17):
    rng = random.Random(seed)
    height = .95 * size
    lean = Vector((rng.uniform(-.1, .1), rng.uniform(-.1, .1), 0)) * size
    fork = lean + Vector((0, 0, height))
    centre = fork + Vector((0, 0, .75 * size * tall))
    reach = Vector((.95 * wide, .95 * wide, .85 * tall)) * size
    parts = [branch([Vector((0, 0, -.05)), lean * .4 + Vector((0, 0, height * .5)), fork], girth * size, tip=.55, resolution=5)]
    for k in range(3):
        d = Vector((math.cos(k / 3 * math.tau + seed), math.sin(k / 3 * math.tau + seed), 0))
        parts.append(branch([d * .04 * size + Vector((0, 0, .2 * size)), d * .14 * size + Vector((0, 0, .03 * size)), d * .22 * size + Vector((0, 0, -.04))], .07 * size, tip=.35, resolution=3))
        a = k / 3 * math.tau + seed + .5
        d = Vector((math.cos(a), math.sin(a), 0))
        parts.append(branch([fork, fork + d * .25 * size + Vector((0, 0, .3 * size)), centre + d * .55 * size + Vector((0, 0, -.1 * size))], .07 * size, tip=.4, resolution=4))
    puffs, tips = [lobe(centre, reach * .72, seed, 2)], []
    for k in range(lobes):
        z = 1 - (k + .5) / lobes * 1.7
        a = k * 2.39996 + rng.uniform(-.3, .3)
        ring = math.sqrt(max(0, 1 - z * z))
        at = centre + Vector((math.cos(a) * ring * reach.x, math.sin(a) * ring * reach.y, z * reach.z)) * .62
        radius = rng.uniform(.36, .48) * size * wide
        puffs.append(lobe(at, Vector((1, 1, .85)) * radius, seed + k + 1, 2))
        tips.append((at, radius))
    wood = join(parts, 'wood')
    paint(wood, gradient(*BARK, 0, height * 1.4))
    low, high = (hex_rgb(c) for c in LEAVES[leaves])
    middle, top, sun = low.lerp(high, .55), high.lerp(hex_rgb('#f1f0b8'), .35), Vector((-.4, -.5, .77)).normalized()
    def colour(co, vertex):
        t = max(0, min(1, (co.z - centre.z + reach.z) / (2 * reach.z) + .06 * noise.noise(co * 3)))
        base = low.lerp(middle, min(1, t * 1.6)) if t < .62 else middle.lerp(top, (t - .62) / .38)
        return base.lerp(top, max(0, (co - centre).normalized().dot(sun)) * .25)
    for obj in puffs:
        paint(obj, colour)
    canopy = join(puffs, 'canopy')
    canopy.data.polygons.foreach_set('use_smooth', [False] * len(canopy.data.polygons))
    return wood, canopy, tips, centre.z


def round_tree(seed, leaves, size=1.0, fruit=False):
    wood, canopy, tips, middle = park_tree(seed, leaves, size)
    objects = [wood, canopy]
    if fruit:
        berries = []
        for k, (tip, radius) in enumerate(tips * 4):
            a, z = k * 2.4, (k % 3) * .3 - .15
            at = tip + Vector((math.cos(a) * math.sqrt(1 - z * z), math.sin(a) * math.sqrt(1 - z * z), z * .78)) * radius * .98
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.1 * size, location=at)
            berries.append(bpy.context.object)
        crop = join(berries, 'fruit')
        paint(crop, gradient('#d9664f', '#f3b35e', middle - .6 * size, middle + .3 * size))
        crop.data.polygons.foreach_set('use_smooth', [True] * len(crop.data.polygons))
        objects.append(crop)
    return objects


def blossom_tree(seed, size=1.0):
    wood, canopy, _, _ = park_tree(seed, 'blossom', size, lobes=10, wide=1.15, tall=.85, girth=.15)
    return [wood, canopy]


def pine_tree(seed, size=1.0):
    rng = random.Random(seed)
    wood = branch([Vector((0, 0, -.05)), Vector((0, 0, .5 * size))], .08 * size, tip=.8)
    paint(wood, gradient(*BARK, 0, .5 * size))
    tiers = []
    for k in range(4):
        radius, base = (.62 - k * .13) * size, (.35 + k * .38) * size
        bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=radius, radius2=0, depth=.72 * size, location=(0, 0, base + .36 * size))
        cone = bpy.context.object
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for v in cone.data.vertices:
            if v.co.z < base + .05 * size:
                v.co.z -= .08 * size * (1 + noise.noise(v.co * 4 + Vector((seed + k, 0, 0))))
                v.co.x *= 1 + .08 * noise.noise(v.co * 5)
                v.co.y *= 1 + .08 * noise.noise(v.co * 5 + Vector((3, 0, 0)))
        cone.rotation_euler.z = rng.uniform(0, math.tau)
        tiers.append(cone)
    needles = join(tiers, 'needles')
    apply_all(needles)
    paint(needles, gradient(*LEAVES['pine'], .2 * size, 2 * size, jitter=.06, seed=seed))
    radial_normals(needles, Vector((0, 0, .6 * size)), .45)
    return [wood, needles]


def willow_tree(seed, size=1.0):
    rng = random.Random(seed)
    wood, canopy, tips, middle = park_tree(seed, 'willow', size, lobes=9, wide=1.2, tall=.85, girth=.2)
    drapes = []
    for k in range(13):
        a = k / 13 * math.tau + rng.uniform(-.1, .1)
        ring = rng.uniform(.9, 1.05) * size
        drop = rng.uniform(.38, .55) * size
        drapes.append(lobe(Vector((math.cos(a) * ring, math.sin(a) * ring, middle - drop * .55)), Vector((.22 * size, .22 * size, drop)), seed + 20 + k, 2))
    for obj in drapes:
        paint(obj, gradient('#5f7f52', '#a9c286', middle - 1.4 * size, middle + .2 * size, jitter=.1, seed=seed))
    curtain = join(drapes, 'curtain')
    curtain.data.polygons.foreach_set('use_smooth', [False] * len(curtain.data.polygons))
    return [wood, canopy, curtain]


def cloud(seed, puffs=5):
    rng = random.Random(seed)
    spots = [(0, 0, .3, .95), (rng.uniform(-.35, -.15), .1, .75, .55), (rng.uniform(.2, .4), -.1, .65, .5)]
    for k in range(puffs):
        side = -1 if k % 2 else 1
        r = max(.3, .7 - k // 2 * .18) * rng.uniform(.9, 1.1)
        spots.append((side * (.7 + k // 2 * .5 + rng.uniform(-.08, .08)), rng.uniform(-.2, .2), r * .35, r))
    parts = [lobe(Vector((x, y, z)), Vector((r, r * .9, r * .9)), seed + i, 3) for i, (x, y, z, r) in enumerate(spots)]
    body = join(parts, 'cloud')
    for v in body.data.vertices:
        if v.co.z < 0:
            v.co.z *= .12
    body.data.update()
    top, under = hex_rgb('#fffdfb'), hex_rgb('#d6cbe2')
    paint(body, lambda co, vertex: under.lerp(top, max(0, min(1, co.z / .9)) ** .6))
    body.data.polygons.foreach_set('use_smooth', [True] * len(body.data.polygons))
    return [body]


def sapling(seed, size=1.0):
    wood = branch([Vector((0, 0, -.03)), Vector((.02, 0, .3 * size)), Vector((0, .02, .55 * size))], .025 * size, tip=.5, resolution=4)
    paint(wood, gradient('#8a6a52', '#b89a74', 0, .5 * size))
    leaves = [puff(Vector((0, 0, .6 * size)), Vector((.16, .16, .13)) * size, seed, lump=.12, subdivisions=2)]
    for k in range(3):
        a = k / 3 * math.tau
        leaves.append(puff(Vector((math.cos(a) * .12, math.sin(a) * .12, .5 * size)) * 1, Vector((.11, .11, .08)) * size, seed + k, lump=.12, subdivisions=1))
    for obj in leaves:
        paint(obj, gradient('#7fa06a', '#b8cf92', .4 * size, .75 * size))
    crown = join(leaves, 'crown')
    radial_normals(crown, Vector((0, 0, .5 * size)), .6)
    return [wood, crown]


def bush(seed, size=1.0, leaves='olive'):
    rng = random.Random(seed)
    puffs = [lobe(Vector((0, 0, .2 * size)), Vector((.4, .4, .32)) * size, seed)]
    for k in range(4):
        a = k / 4 * math.tau + rng.uniform(-.4, .4)
        puffs.append(lobe(Vector((math.cos(a) * .3, math.sin(a) * .3, rng.uniform(.1, .2))) * size, Vector((1, 1, .8)) * rng.uniform(.24, .3) * size, seed + k))
    for obj in puffs:
        paint(obj, gradient(*LEAVES[leaves], 0, .55 * size, jitter=.08, seed=seed))
    shrub = join(puffs, 'bush')
    radial_normals(shrub, Vector((0, 0, 0)), .55)
    return [shrub]


def rock(seed, size=1.0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    obj = bpy.context.object
    offset = Vector((seed * 2.3, seed, 0))
    for v in obj.data.vertices:
        n = v.co.normalized()
        v.co = Vector((n.x * .6, n.y * .5, n.z * .34 + .12)) * size * (1 + .22 * noise.noise(n * 1.8 + offset))
    stone, moss = hex_rgb('#8f8483'), hex_rgb('#8ea477')
    light = hex_rgb('#d2c6b8')
    def colour(co, vertex):
        base = stone.lerp(light, max(0, min(1, co.z / (.45 * size))))
        return base.lerp(moss, .75) if vertex.normal.z > .75 and co.z > .3 * size else base
    paint(obj, colour)
    return [obj]


def rowboat(length=2.3, width=.95, depth=.36):
    mesh = bpy.data.meshes.new('hull')
    bm = bmesh.new()
    steps, arc, rows = 16, 8, []
    for i in range(steps + 1):
        u = i / steps * 2 - 1
        half = width / 2 * max(.015, math.cos(max(0, u) * math.pi / 2) ** .75 * (.8 + .2 * math.cos(u * math.pi / 2) if u < 0 else 1))
        keel = depth * (1 - .3 * u * u)
        sheer = .1 * u * u + (.06 * u if u > 0 else 0)
        row = []
        for k in range(arc + 1):
            a = (k / arc - .5) * math.pi
            row.append(bm.verts.new((u * length / 2, math.sin(a) * half, -math.cos(a) * keel + sheer * abs(math.sin(a)))))
        rows.append(row)
    for i in range(steps):
        for k in range(arc):
            bm.faces.new((rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]))
    bm.faces.new([rows[0][k] for k in range(arc + 1)])
    bm.normal_update()
    bm.to_mesh(mesh)
    hull = bpy.data.objects.new('hull', mesh)
    bpy.context.collection.objects.link(hull)
    shell = hull.modifiers.new('shell', 'SOLIDIFY')
    shell.thickness = .045
    shell.offset = 1
    smooth = hull.modifiers.new('round', 'SUBSURF')
    smooth.levels = 1
    apply_all(hull)
    bmesh_hull = bmesh.new()
    bmesh_hull.from_mesh(hull.data)
    bmesh.ops.recalc_face_normals(bmesh_hull, faces=bmesh_hull.faces)
    bottom = [f for f in bmesh_hull.faces if f.calc_center_median().z < -depth * .8]
    if sum(f.normal.z for f in bottom) > 0:
        bmesh.ops.reverse_faces(bmesh_hull, faces=bmesh_hull.faces)
    bmesh_hull.to_mesh(hull.data)
    hull.data.polygons.foreach_set('use_smooth', [True] * len(hull.data.polygons))
    red, cream, wood = hex_rgb('#c46f5c'), hex_rgb('#f1e4cf'), hex_rgb('#b98d63')
    def colour(co, vertex):
        u = max(-1, min(1, 2 * co.x / length))
        if co.z > .1 * u * u + .06 * max(0, u) - .025:
            return cream
        out = Vector((0, co.y, co.z + depth * .4))
        return red if vertex.normal.dot(out) > 0 else wood
    paint(hull, colour)
    seats = []
    for u in (-.4, .15):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(u * length / 2, 0, -depth * .12))
        seat = bpy.context.object
        seat.scale = (.2, width * .8 * math.cos(max(0, u) * math.pi / 2) ** .75, .04)
        bpy.ops.object.transform_apply(scale=True)
        seats.append(seat)
    oar = branch([Vector((-.55, -.2, -.1)), Vector((0, -.22, -.1)), Vector((.5, -.18, -.1))], .025, tip=1, resolution=2)
    plank = join(seats + [oar], 'planks')
    paint(plank, gradient('#9c754f', '#d4b58c', -depth, 0))
    return [hull, plank]


def outline(count):
    script = f"const {{ edgePoint, ISLAND }} = await import('./src/features/house/house-island.js'); console.log(JSON.stringify({{ island: ISLAND, points: Array.from({{ length: {count} }}, (_, j) => edgePoint(j / {count} * Math.PI * 2)) }}))"
    return json.loads(subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, check=True).stdout)


CLIFF_PROFILE = [
    (-.3, 1.018, '#a69777'), (-.65, 1.015, '#b7a486'), (-1.2, .98, '#c1ae94'),
    (-1.9, .88, '#b7aa94'), (-2.7, .73, '#aaa397'), (-3.5, .53, '#9b9a95'),
    (-4.2, .32, '#909393'), (-4.9, .12, '#87908e'), (-5.4, .035, '#808c88'),
]


def island_cliff():
    data = outline(120)
    cx, cz, rz = data['island']['cx'], data['island']['cz'], data['island']['rz']
    mesh = bpy.data.meshes.new('cliff')
    bm = bmesh.new()
    rows = []
    for r, (y, scale, _) in enumerate(CLIFF_PROFILE):
        forward = rz * (1 - min(1, scale)) * .67
        rows.append([bm.verts.new((cx + (x - cx) * scale, cz + (z - cz) * scale + forward, y)) for x, z in data['points']])
    count = len(data['points'])
    for r in range(len(rows) - 1):
        for j in range(count):
            bm.faces.new((rows[r][j], rows[r][(j + 1) % count], rows[r + 1][(j + 1) % count], rows[r + 1][j]))
    tip = bm.verts.new((cx + .2, cz + rz * .67, -5.55))
    for j in range(count):
        bm.faces.new((rows[-1][j], rows[-1][(j + 1) % count], tip))
    bm.normal_update()
    bm.to_mesh(mesh)
    cliff = bpy.data.objects.new('cliff', mesh)
    bpy.context.collection.objects.link(cliff)
    active(cliff)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    fine = cliff.modifiers.new('fine', 'SUBSURF')
    fine.levels = 2
    fine.subdivision_type = 'CATMULL_CLARK'
    apply_all(cliff)
    for v in cliff.data.vertices:
        fixed = max(0, min(1, (-.4 - v.co.z) / .45))
        if fixed:
            radial = Vector((v.co.x - cx, v.co.y - cz, 0)).normalized()
            cells = noise.voronoi(v.co * Vector((.8, .8, 1.3)), distance_metric='DISTANCE')[0]
            push = .22 * noise.noise(v.co * Vector((.35, .35, .6))) + .14 * (.45 - cells[0])
            v.co += radial * push * .6 * fixed
    faces = len(cliff.data.polygons)
    budget = cliff.modifiers.new('facets', 'DECIMATE')
    budget.ratio = 3600 / faces
    apply_all(cliff)
    cliff.data.polygons.foreach_set('use_smooth', [True] * len(cliff.data.polygons))
    bands = [(y, hex_rgb(c)) for y, _, c in CLIFF_PROFILE]
    grass = hex_rgb('#7d986e')
    def colour(co, vertex):
        z = co.z + .08 * noise.noise(co * 2.2)
        for (y0, c0), (y1, c1) in zip(bands, bands[1:]):
            if z >= y1:
                base = c0.lerp(c1, (y0 - z) / (y0 - y1))
                break
        else:
            base = bands[-1][1]
        if z > -.7:
            return grass.lerp(base, max(0, min(1, (-.3 - z) / .4)))
        return base
    paint(cliff, colour)
    rng = random.Random(4)
    roots, vines = [], []
    for i in range(16):
        x, z = data['points'][(i * 37 + rng.randrange(4)) % count]
        out = Vector((x - cx, z - cz, 0)).normalized()
        top = Vector((x, z, -.32)) + out * .06
        long = rng.uniform(.4, 1.2)
        sway = Vector((rng.uniform(-.2, .2), rng.uniform(-.2, .2), 0))
        spine = [top, top + out * .14 + sway * .4 + Vector((0, 0, -long * .45)), top + out * .02 + sway + Vector((0, rz * .04, -long))]
        (vines if i % 3 == 0 else roots).append(branch(spine, .04 if i % 3 else .03, tip=.2, resolution=4))
    for group, low, high in ((roots, '#5a4436', '#7a5c47'), (vines, '#5f7d52', '#95b27a')):
        strand = join(group, 'strands')
        strand.data.polygons.foreach_set('use_smooth', [False] * len(strand.data.polygons))
        paint(strand, gradient(low, high, -2, -.3))
        cliff = join([cliff, strand], 'cliff')
    return [cliff]


def islet(seed, size=1.0):
    rng = random.Random(seed)
    top = puff(Vector((0, 0, 0)), Vector((.62, .55, .14)) * size, seed, lump=.1, subdivisions=3)
    paint(top, gradient('#7a9368', '#a9bd8c', -.05 * size, .12 * size))
    radial_normals(top, Vector((0, 0, -.3 * size)), .5)
    stone = puff(Vector((0, 0, -.45 * size)), Vector((.58, .5, .5)) * size, seed + 3, lump=.2, subdivisions=3)
    for v in stone.data.vertices:
        if v.co.z < -.45 * size:
            k = (-.45 * size - v.co.z) / (.5 * size)
            v.co.x *= 1 - .75 * k
            v.co.y *= 1 - .75 * k
            v.co.z -= k * .5 * size
    paint(stone, gradient('#574d6e', '#b39584', -1.3 * size, -.05 * size, jitter=.1, seed=seed))
    stone.data.polygons.foreach_set('use_smooth', [False] * len(stone.data.polygons))
    return [top, stone]


def preview(path, lift=.42):
    scene = bpy.context.scene
    corners = [obj.matrix_world @ Vector(c) for obj in scene.objects if obj.type == 'MESH' for c in obj.bound_box]
    low = Vector(tuple(min(c[i] for c in corners) for i in range(3)))
    high = Vector(tuple(max(c[i] for c in corners) for i in range(3)))
    middle, reach = (low + high) / 2, (high - low).length
    bpy.ops.object.camera_add(location=middle + Vector((.35, -.75, lift)) * reach * 1.1)
    cam = bpy.context.object
    target = bpy.data.objects.new('target', None)
    bpy.context.collection.objects.link(target)
    target.location = middle
    track = cam.constraints.new('TRACK_TO')
    track.target = target
    scene.camera = cam
    bpy.ops.object.light_add(type='SUN', rotation=(.8, .2, .6))
    bpy.context.object.data.energy = 3
    for obj in scene.objects:
        if obj.type == 'MESH':
            mat = bpy.data.materials.new('show')
            mat.use_nodes = True
            nodes = mat.node_tree.nodes
            attr = nodes.new('ShaderNodeVertexColor')
            attr.layer_name = 'Col'
            gamma = nodes.new('ShaderNodeGamma')
            gamma.inputs['Gamma'].default_value = 2.2
            mat.node_tree.links.new(attr.outputs['Color'], gamma.inputs['Color'])
            mat.node_tree.links.new(gamma.outputs['Color'], nodes['Principled BSDF'].inputs['Base Color'])
            nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
            obj.data.materials.clear()
            obj.data.materials.append(mat)
    scene.view_settings.view_transform = 'Standard'
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.35, .33, .4, 1)
    scene.render.resolution_x = scene.render.resolution_y = 480
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


BUILDS = {
    'tree-round-a': lambda: round_tree(3, 'sage'),
    'tree-round-b': lambda: round_tree(8, 'olive', 1.1),
    'tree-round-c': lambda: round_tree(14, 'deep', .95),
    'tree-fruit': lambda: round_tree(21, 'olive', fruit=True),
    'tree-blossom-a': lambda: blossom_tree(5),
    'tree-blossom-b': lambda: blossom_tree(12, 1.1),
    'tree-pine': lambda: pine_tree(7),
    'tree-willow': lambda: willow_tree(4),
    'sapling': lambda: sapling(2),
    'bush': lambda: bush(9),
    'rock-a': lambda: rock(3),
    'rock-b': lambda: rock(11, 1.3),
    'rowboat': lambda: rowboat(),
    'island-cliff': lambda: island_cliff(),
    'islet-a': lambda: islet(1),
    'islet-b': lambda: islet(6, .8),
    'cloud-a': lambda: cloud(2),
    'cloud-b': lambda: cloud(7, 3),
}

FLAT = {'rock-a', 'rock-b'}

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = [a for a in args if not a.startswith('--preview=')] or list(BUILDS)
    shot = next((a.split('=', 1)[1] for a in args if a.startswith('--preview=')), None)
    for name in names:
        reset()
        objects = BUILDS[name]()
        bake_occlusion(objects, .45 if name.startswith('tree') else .2 if name.startswith('cloud') else .4 if name == 'island-cliff' else .75)
        export(objects, name, flat=name in FLAT)
        if shot:
            preview(os.path.join(shot, name + '.png'), -.2 if 'cliff' in name else .42)
