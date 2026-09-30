import array, base64, bpy, bmesh, json, math, os, random, subprocess, sys
from mathutils import Matrix, Vector, noise

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
    'sage': ('#3d6647', '#9cc466'), 'olive': ('#48683a', '#b6cd5c'), 'deep': ('#33593f', '#86b45e'),
    'blossom': ('#b5798f', '#f8d7da'), 'pine': ('#2e4d3f', '#7fa468'), 'willow': ('#6a8a5a', '#b4c98e'),
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


def foliage(centre, reach, count, seed, low, high, size=.3, faces=3200, soften=.6):
    rng = random.Random(seed)
    sun = Vector((-.4, -.5, .77)).normalized()
    top = high.lerp(hex_rgb('#f4f0a8'), .4)
    parts = []
    for k in range(count):
        z = 1 - (k + .5) / count * 2
        a = k * 2.39996 + rng.uniform(-.2, .2)
        ring = math.sqrt(max(0, 1 - z * z))
        at = centre + Vector((math.cos(a) * ring * reach.x, math.sin(a) * ring * reach.y, z * reach.z * (.8 if z < 0 else 1))) * rng.uniform(.55, .8)
        r = size * rng.uniform(.9, 1.15)
        parts.append(lobe(at, Vector((r, r, r * .85)), seed * 31 + k, 2))
        out = (at - centre).normalized()
        for i in range(11):
            u, w = rng.uniform(-.35, 1), rng.uniform(0, math.tau)
            d = Vector((math.sqrt(1 - u * u) * math.cos(w), math.sqrt(1 - u * u) * math.sin(w), u))
            d = (d + out * .6).normalized()
            q = r * rng.uniform(.3, .42)
            parts.append(lobe(at + d * r * .78, Vector((q, q, q * .85)), seed * 97 + k * 13 + i, 1))
    obj = join(parts, 'canopy')
    fuse(obj, size * .06, faces)
    def colour(co, vertex):
        t = max(0, min(1, (co.z - centre.z + reach.z) / (2 * reach.z)))
        facing = (co - centre).normalized().dot(sun)
        c = low.lerp(high, smoothstep(0, 1, t) * .8 + .2 * max(0, facing)).lerp(top, smoothstep(.2, .9, facing) * t * .7)
        return c * (.96 + .08 * noise.noise(co * 5 + Vector((seed, 0, 0))))
    paint(obj, colour)
    radial_normals(obj, centre, soften)
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
    tips = []
    for k in range(lobes):
        z = 1 - (k + .5) / lobes * 1.7
        a = k * 2.39996 + rng.uniform(-.3, .3)
        ring = math.sqrt(max(0, 1 - z * z))
        at = centre + Vector((math.cos(a) * ring * reach.x, math.sin(a) * ring * reach.y, z * reach.z)) * .62
        tips.append((at, rng.uniform(.36, .48) * size * wide))
    wood = join(parts, 'wood')
    paint(wood, gradient(*BARK, 0, height * 1.4))
    low, high = (hex_rgb(c) for c in LEAVES[leaves])
    canopy = foliage(centre, reach, int(9 + 4 * wide), seed, low, high, .5 * size, 1500, .7)
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
    wood = branch([Vector((0, 0, -.05)), Vector((0, 0, 1.9 * size))], .08 * size, tip=.25)
    paint(wood, gradient(*BARK, 0, .5 * size))
    boughs, tiers = [], 5
    for k in range(tiers):
        t = k / (tiers - 1)
        ring, height, count = (.66 - .5 * t) * size, (.42 + 1.5 * t) * size, int(9 - 4 * t)
        for i in range(count):
            a = (i + .5 * k) / count * math.tau + rng.uniform(-.15, .15)
            out = Vector((math.cos(a), math.sin(a), 0))
            r = (.2 - .08 * t) * size * rng.uniform(.9, 1.1)
            boughs.append(lobe(out * ring * .7 + Vector((0, 0, height)), Vector((r * 1.5, r * 1.5, r * .6)), seed * 17 + k * 11 + i, 2))
            boughs.append(lobe(out * ring + Vector((0, 0, height - .12 * size)), Vector((r * 1.1, r * 1.1, r * .45)), seed * 23 + k * 7 + i, 1))
        boughs.append(lobe(Vector((0, 0, height + .06 * size)), Vector((ring * .55, ring * .55, .18 * size)), seed + k, 2))
    boughs.append(lobe(Vector((0, 0, 2.05 * size)), Vector((.1, .1, .22)) * size, seed + 9, 2))
    needles = join(boughs, 'needles')
    fuse(needles, .05 * size, 1800)
    low, high = (hex_rgb(c) for c in LEAVES['pine'])
    sun, top = Vector((-.4, -.5, .77)).normalized(), high.lerp(hex_rgb('#e4eaa0'), .35)
    def colour(co, vertex):
        t = max(0, min(1, co.z / (2.1 * size)))
        facing = vertex.normal.dot(sun)
        c = low.lerp(high, .25 + .5 * t + .25 * max(0, facing)).lerp(top, smoothstep(.4, .95, facing) * .6)
        return c * (.95 + .1 * noise.noise(co * 6 + Vector((seed, 0, 0))))
    paint(needles, colour)
    radial_normals(needles, Vector((0, 0, 1.1 * size)), .35)
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


def sapling(seed, size=1.0):
    wood = branch([Vector((0, 0, -.03)), Vector((.02, 0, .3 * size)), Vector((0, .02, .55 * size))], .025 * size, tip=.5, resolution=4)
    paint(wood, gradient('#8a6a52', '#b89a74', 0, .5 * size))
    crown = foliage(Vector((0, 0, .58 * size)), Vector((.2, .2, .16)) * size, 4, seed, hex_rgb('#5f8a4f'), hex_rgb('#bcd48e'), .13 * size, 500)
    return [wood, crown]


def bush(seed, size=1.0, leaves='olive'):
    low, high = (hex_rgb(c) for c in LEAVES[leaves])
    return [foliage(Vector((0, 0, .26 * size)), Vector((.42, .38, .24)) * size, 6, seed, low, high, .24 * size, 900)]


def rock(seed, size=1.0):
    rng = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1)
    obj = bpy.context.object
    offset = Vector((seed * 2.3, seed, 0))
    cuts = []
    for k in range(9):
        z = rng.uniform(-.1, .55) if k else .85
        a = rng.uniform(0, math.tau)
        n = Vector((math.cos(a) * math.sqrt(1 - z * z), math.sin(a) * math.sqrt(1 - z * z), z))
        cuts.append((n, rng.uniform(.62, .8)))
    for v in obj.data.vertices:
        p = v.co.normalized() * (1 + .12 * noise.noise(v.co * 1.6 + offset) + .04 * noise.noise(v.co * 5 + offset))
        for n, depth in cuts:
            over = p.dot(n) - depth
            if over > 0:
                p -= n * over
        v.co = Vector((p.x * .62, p.y * .52, max(-.05, p.z) * .4 + .1)) * size
    stone, light, moss, lichen = hex_rgb('#7d7773'), hex_rgb('#cdc3b3'), hex_rgb('#7f9a5c'), hex_rgb('#b9b58a')
    def colour(co, vertex):
        h = max(0, min(1, co.z / (.5 * size)))
        grain = .5 + .5 * noise.noise(co * 7 + offset)
        base = stone.lerp(light, .25 + .55 * h * grain).lerp(lichen, .25 * smoothstep(.55, .8, noise.noise(co * 3 + offset) * .5 + .5))
        cap = smoothstep(.6, .9, vertex.normal.z) * smoothstep(.15, .3, co.z / size) * smoothstep(-.1, .35, noise.noise(co * 2.6 + offset))
        return base.lerp(moss, .85 * cap)
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
    (-.3, 1.018), (-.65, 1.015), (-1.2, .975), (-1.8, .88), (-2.4, .7),
    (-2.9, .47), (-3.25, .24), (-3.45, .08),
]
STRATA = .42


def strata_band(z):
    return math.floor((-z + .12 * noise.noise(Vector((z * 3, 0, 0)))) / STRATA)


def rock_lobe(at, radius, depth, seed, sides=9):
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=.08, radius2=1, depth=1, rotation=(0, 0, seed))
    lobe = bpy.context.object
    bpy.ops.object.transform_apply(rotation=True)
    for v in lobe.data.vertices:
        t = .5 - v.co.z
        wob = 1 + .28 * noise.noise(Vector((v.co.x * 2, v.co.y * 2, seed)))
        v.co = Vector((v.co.x * radius.x * wob * (1 - .3 * t * t), v.co.y * radius.y * wob * (1 - .3 * t * t), -t * depth))
    lobe.location = at
    bpy.ops.object.transform_apply(location=True)
    return lobe


def island_cliff():
    data = outline(160)
    cx, cz, rx, rz = data['island']['cx'], data['island']['cz'], data['island']['rx'], data['island']['rz']
    mesh = bpy.data.meshes.new('rim')
    bm = bmesh.new()
    rows = []
    for y, scale in ((-.3, 1.018), (-.65, 1.015), (-1.3, .96), (-1.7, .82)):
        forward = rz * (1 - min(1, scale)) * .67
        rows.append([bm.verts.new((cx + (x - cx) * scale, cz + (z - cz) * scale + forward, y)) for x, z in data['points']])
    count = len(data['points'])
    for r in range(len(rows) - 1):
        for j in range(count):
            bm.faces.new((rows[r][j], rows[r][(j + 1) % count], rows[r + 1][(j + 1) % count], rows[r + 1][j]))
    bm.to_mesh(mesh)
    rim = bpy.data.objects.new('rim', mesh)
    bpy.context.collection.objects.link(rim)
    active(rim)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    fine = rim.modifiers.new('fine', 'SUBSURF')
    fine.levels = 2
    apply_all(rim)
    rng = random.Random(9)
    front = cz + rz * .12
    lobes = [rock_lobe(Vector((cx, front, -1.25)), Vector((rx * .97, rz * .97, 1)), 3.9, 0, 18)]
    for k in range(7):
        a = k / 7 * math.tau + rng.uniform(-.25, .25)
        reach = rng.uniform(.35, .7)
        at = Vector((cx + math.cos(a) * rx * reach * .7, front + rz * .2 + math.sin(a) * rz * reach * .55, -1.6))
        size = rng.uniform(2.4, 3.8) * (1.2 - reach * .5)
        lobes.append(rock_lobe(at, Vector((size, size * .8, 1)), min(3.9, rng.uniform(3, 4.6) * (1.2 - reach * .5)), k + 1))
    mass = join(lobes, 'mass')
    fuse(mass, .11, 400000)
    insets = [rng.uniform(0, .3) for _ in range(24)]
    for v in mass.data.vertices:
        radial = Vector((v.co.x - cx, (v.co.y - front) * 1.6, 0))
        radial = radial.normalized() if radial.length > .01 else Vector((0, 0, 0))
        z = v.co.z + .12 * noise.noise(Vector((v.co.x * .6, v.co.y * .6, 0)))
        band = max(0, min(23, strata_band(z)))
        within = ((-z) / STRATA) % 1
        angle = math.atan2(v.co.y - front, v.co.x - cx)
        ledge = insets[band] * (.5 + .5 * noise.noise(Vector((angle * 2.2, band * 1.7, 0)))) + .12 * smoothstep(.75, 1, within)
        dist, _ = noise.voronoi(Vector((v.co.x * 1.1, v.co.y * 1.1, band * 3.7)), distance_metric='DISTANCE')
        column = .22 * smoothstep(.0, .3, dist[1] - dist[0]) - .11
        side = max(0, min(1, 1 - abs(v.normal.z) * 1.2))
        v.co += radial * (column + .05 * noise.noise(v.co * Vector((.5, .5, .9))) - ledge) * side
    budget = mass.modifiers.new('facets', 'DECIMATE')
    budget.ratio = min(1, 9000 / len(mass.data.polygons))
    apply_all(mass)
    cliff = join([rim, mass], 'cliff')
    cliff.data.polygons.foreach_set('use_smooth', [True] * len(cliff.data.polygons))
    warm, pale, cool, deep = hex_rgb('#9a8b74'), hex_rgb('#c2b597'), hex_rgb('#7f8594'), hex_rgb('#5d6577')
    moss, lawn, soil = hex_rgb('#6d8f3f'), hex_rgb('#7aa046'), hex_rgb('#6e5842')
    def colour(co, vertex):
        z = co.z + .12 * noise.noise(Vector((co.x * .6, co.y * .6, 0)))
        band = strata_band(z)
        depth = max(0, min(1, (-z - .6) / 4.4))
        base = (warm if band % 2 else pale).lerp(cool, depth * .8).lerp(deep, max(0, depth - .55) * 1.4)
        base = base * (.94 + .1 * noise.noise(co * Vector((.8, .8, 3))))
        ground = Vector((co.x * 1.3, co.y * 1.3, 0))
        grass = -.42 - .38 * max(0, noise.noise(ground)) - .12 * max(0, noise.noise(ground * 3.1))
        earth = grass - .18 - .22 * (.5 + .5 * noise.noise(ground * 1.7 + Vector((5, 0, 0))))
        if z > grass:
            return lawn.lerp(moss, min(1, (-.42 - z) / .4) * .7) * (.95 + .08 * noise.noise(co * 4))
        if z > earth:
            outcrop = smoothstep(.25, .55, noise.noise(co * Vector((2.2, 2.2, 4))))
            return soil.lerp(moss * .8, max(0, (z - earth) / (grass - earth)) ** 3 * .6).lerp(pale, outcrop * .7) * (.92 + .1 * noise.noise(co * 6))
        if vertex.normal.z > .45 and depth < .75:
            return base.lerp(moss, min(1, (vertex.normal.z - .45) * 3) * (1 - depth))
        return base
    paint(cliff, colour)
    roots, vines = [], []
    for i in range(34):
        x, z = data['points'][(i * 47 + rng.randrange(5)) % count]
        out = Vector((x - cx, z - cz, 0)).normalized()
        top = Vector((x, z, -.4)) + out * .08
        long = rng.uniform(.35, 1.4)
        sway = Vector((rng.uniform(-.15, .15), rng.uniform(-.15, .15), 0))
        spine = [top, top + out * .1 + sway * .4 + Vector((0, 0, -long * .45)), top + out * .03 + sway + Vector((0, rz * .03, -long))]
        (vines if i % 3 else roots).append(branch(spine, .05 if i % 3 else .045, tip=.2, resolution=4))
    for group, low, high in ((roots, '#4f3d31', '#6f5543'), (vines, '#4f6f37', '#8fb25a')):
        strand = join(group, 'strands')
        strand.data.polygons.foreach_set('use_smooth', [False] * len(strand.data.polygons))
        paint(strand, gradient(low, high, -1.8, -.4))
        cliff = join([cliff, strand], 'cliff')
    return [cliff]


def smoothstep(a, b, x):
    t = max(0, min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def islet(seed, size=1.0):
    rng = random.Random(seed)
    top = puff(Vector((0, 0, 0)), Vector((.7, .6, .12)) * size, seed, lump=.08, subdivisions=3)
    for v in top.data.vertices:
        if v.co.z < 0:
            v.co.z *= .3
    paint(top, gradient('#6d9440', '#9fc452', -.03 * size, .1 * size, jitter=.1, seed=seed))
    mass = [rock_lobe(Vector((0, 0, -.02 * size)), Vector((.66, .56, 1)) * size, 1.1 * size, seed, 11)]
    for k in range(3):
        a = k / 3 * math.tau + rng.uniform(0, 1)
        mass.append(rock_lobe(Vector((math.cos(a) * .3, math.sin(a) * .26, -.2)) * size, Vector((.3, .26, 1)) * size, rng.uniform(.9, 1.5) * size, seed + k + 1, 8))
    stone = join(mass, 'stone')
    fuse(stone, .04 * size, 3000)
    warm, pale, cool = hex_rgb('#9a8b74'), hex_rgb('#c2b597'), hex_rgb('#6f7789')
    def colour(co, vertex):
        band = math.floor((-co.z + .04 * noise.noise(co * 4)) / (.16 * size))
        depth = max(0, min(1, -co.z / (1.4 * size)))
        return (warm if band % 2 else pale).lerp(cool, depth) * (.94 + .1 * noise.noise(co * 6))
    paint(stone, colour)
    stone.data.polygons.foreach_set('use_smooth', [True] * len(stone.data.polygons))
    tuft = foliage(Vector((.12, .05, .2)) * size, Vector((.2, .18, .14)) * size, 5, seed + 9, hex_rgb('#4c6e3a'), hex_rgb('#a6c65a'), .13 * size, 500)
    return [top, stone, tuft]


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
}

FLAT = {'rock-a', 'rock-b'}

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = [a for a in args if not a.startswith('--preview=')] or list(BUILDS)
    shot = next((a.split('=', 1)[1] for a in args if a.startswith('--preview=')), None)
    for name in names:
        reset()
        objects = BUILDS[name]()
        bake_occlusion(objects, .45 if name.startswith('tree') or name in ('bush', 'sapling') else .4 if name == 'island-cliff' else .3 if name.startswith('islet') else .75)
        export(objects, name, flat=name in FLAT)
        if shot:
            preview(os.path.join(shot, name + '.png'), -.2 if 'cliff' in name else .42)
