import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
FPS = 60
MANTLE_MOTION = {
    'reachMs': 120, 'riseMetres': .55, 'liftMs': 247.5,
    'normal': {'durationMs': 450, 'transferMs': 382.5, 'advanceMetres': .46},
    'wide': {'durationMs': 650, 'transferMs': 500, 'advanceMetres': 1.18},
}
CLIPS = {
    'idle': {'frames': 180, 'loop': True, 'speed': 0},
    'walk': {'frames': 32, 'loop': True, 'speed': 4.8, 'stance': .24},
    'run': {'frames': 26, 'loop': True, 'speed': 8.5, 'stance': .20},
    'jump': {'frames': 26, 'loop': False, 'speed': 0},
    'fall': {'frames': 48, 'loop': True, 'speed': 0},
    'land': {'frames': 20, 'loop': False, 'speed': 0},
    'climb': {'frames': 30, 'loop': True, 'speed': 2, 'stance': .52},
    'stop': {'frames': 24, 'loop': False, 'speed': 0},
    'stop-back': {'frames': 24, 'loop': False, 'speed': 0},
    'stop-right': {'frames': 24, 'loop': False, 'speed': 0},
    'stop-right-back': {'frames': 24, 'loop': False, 'speed': 0},
    'mantle': {'frames': round(MANTLE_MOTION['normal']['durationMs'] / 1000 * FPS), 'loop': False, 'speed': 0},
    'mantle-wide': {'frames': round(MANTLE_MOTION['wide']['durationMs'] / 1000 * FPS), 'loop': False, 'speed': 0},
}
VARIANTS = {
    'style': ['bun', 'bob', 'waves', 'crop'],
    'outfit': ['cardigan', 'hoodie', 'overalls', 'sailor'],
    'bottomStyle': ['trousers', 'skirt', 'shorts'],
    'accessory': ['none', 'glasses', 'blossom', 'moon-clips'],
}
PALETTE = {
    'skin': '#d6ad87', 'hair': '#674d3b', 'top': '#b88770',
    'top-shade': '#a67863', 'top-trim': '#cb9b7d', 'bottom': '#777e72',
    'bottom-trim': '#a4ac94', 'leather': '#695043', 'sole': '#453e38',
    'cream': '#f0dfbd', 'ink': '#382d2c', 'gold': '#d4b56e',
    'blush': '#ba7a72', 'petal': '#e5b5bc',
}
PARTS = {}
MATERIALS = {}
RIG = None
SKIRT_RINGS = [(.66, .30, .22), (.70, .285, .20), (.87, .24, .15), (.925, .23, .143)]


def material(name, hex_color):
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c < .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*linear, 1)
    shader.inputs['Roughness'].default_value = .86
    shader.inputs['Metallic'].default_value = .18 if name == 'gold' else 0
    return mat


def finish(obj, group, paint, bone, smooth=True):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(MATERIALS[paint])
    if bone:
        obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    PARTS.setdefault(group, []).append(obj)
    return obj


def oval(group, paint, bone, center, scale, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=center)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, group, paint, bone)


def box(group, paint, bone, center, scale, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new('Tailored edges', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 3
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, group, paint, bone)


def tube(group, paint, bone, points, radii, sides=12):
    vertices = []
    for i, point in enumerate(points):
        p = Vector(point)
        tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(0, i - 1)])
        tangent.normalize()
        u = tangent.cross(Vector((0, 1, 0)))
        if u.length < .01:
            u = tangent.cross(Vector((1, 0, 0)))
        u.normalize()
        v = tangent.cross(u).normalized()
        rx, ry = radii[i] if isinstance(radii[i], tuple) else (radii[i], radii[i])
        for j in range(sides):
            angle = j * math.tau / sides
            vertices.append(p + u * (math.cos(angle) * rx) + v * (math.sin(angle) * ry))
    faces = [tuple(reversed(range(sides)))]
    for i in range(len(points) - 1):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple((len(points) - 1) * sides + j for j in range(sides)))
    mesh = bpy.data.meshes.new('Tailored surface')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Tailored surface', mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, group, paint, bone)


def limb_tube(group, paint, points, radii, upper, lower, joint_z, blend=.055):
    obj = tube(group, paint, None, points, radii, 16)
    first = obj.vertex_groups.new(name=upper)
    second = obj.vertex_groups.new(name=lower)
    ankle = obj.vertex_groups.new(name=lower.replace('shin.', 'foot.')) if lower.startswith('shin.') else None
    for vertex in obj.data.vertices:
        weight = max(0, min(1, (vertex.co.z - joint_z + blend) / (blend * 2)))
        ankle_weight = max(0, min(1, (.40 - vertex.co.z) / .175)) if ankle else 0
        if weight > 0:
            first.add([vertex.index], weight, 'REPLACE')
        if weight < 1:
            second.add([vertex.index], (1 - weight) * (1 - ankle_weight), 'REPLACE')
        if ankle_weight > 0:
            ankle.add([vertex.index], ankle_weight, 'REPLACE')
    return obj


def ribbon(group, paint, bone, points, width, depth=.008):
    return tube(group, paint, bone, points, [(width, depth)] * len(points), 8)


def ring(group, paint, bone, center, radius, thickness, axis='Y'):
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=6, location=center, major_radius=radius, minor_radius=thickness)
    obj = bpy.context.object
    if axis == 'Y':
        obj.rotation_euler.x = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return finish(obj, group, paint, bone)


def build_rig():
    global RIG
    bpy.ops.object.armature_add(enter_editmode=True)
    RIG = bpy.context.object
    RIG.name = 'WildsAvatarRig'
    bones = RIG.data.edit_bones
    bones.remove(bones[0])
    specifications = [
        ('pelvis', (0, 0, .86), (0, 0, 1.0), None),
        ('spine', (0, 0, 1.0), (0, 0, 1.25), 'pelvis'),
        ('head', (0, 0, 1.25), (0, 0, 1.60), 'spine'),
    ]
    for side, x in [('L', -.14), ('R', .14)]:
        sign = -1 if side == 'L' else 1
        specifications.extend([
            (f'thigh.{side}', (x, 0, .86), (x, .015, .49), 'pelvis'),
            (f'shin.{side}', (x, .015, .49), (x, 0, .12), f'thigh.{side}'),
            (f'foot.{side}', (x, 0, .12), (x, .19, .12), None),
            (f'arm.{side}', (sign * .255, 0, 1.215), (sign * .335, .005, .985), 'spine'),
            (f'forearm.{side}', (sign * .335, .005, .985), (sign * .34, .025, .765), f'arm.{side}'),
            (f'hand.{side}', (sign * .34, .025, .765), (sign * .34, .04, .68), f'forearm.{side}'),
        ])
    for row, (z, rx, ry) in enumerate(SKIRT_RINGS):
        for index in range(16):
            angle = index * math.tau / 16
            point = (math.cos(angle) * rx, math.sin(angle) * ry, z)
            specifications.append((f'skirt.{row}.{index:02}', point, (point[0], point[1], point[2] + .1), None))
    for name, head, tail, parent in specifications:
        bone = bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for bone in RIG.pose.bones:
        bone.rotation_mode = 'QUATERNION'


def body():
    oval('body', 'skin', 'head', (0, .008, 1.47), (.218, .181, .235), 28, 20)
    oval('body', 'skin', 'head', (0, .008, 1.285), (.088, .081, .102))
    for side, sign in [('L', -1), ('R', 1)]:
        oval('body', 'skin', 'head', (sign * .214, .015, 1.467), (.043, .036, .065))
        oval('body', 'blush', 'head', (sign * .238, .042, 1.467), (.011, .013, .037), 12, 8)
        oval('body', 'ink', 'head', (sign * .076, .172, 1.492), (.018, .012, .028), 16, 12)
        oval('body', 'cream', 'head', (sign * .072, .184, 1.503), (.005, .003, .007), 10, 8)
        oval('body', 'blush', 'head', (sign * .119, .153, 1.446), (.033, .009, .015), 14, 10)
        ribbon('body', 'hair', 'head', [(sign * .050, .169, 1.544), (sign * .077, .166, 1.548), (sign * .099, .156, 1.542)], .010, .005)
        oval('body', 'skin', f'hand.{side}', (sign * .34, .03, .721), (.05, .043, .077))
        oval('body', 'skin', f'hand.{side}', (sign * .303, .05, .735), (.026, .028, .04))
        limb_tube('body', 'skin', [(sign * .14, 0, z) for z in [.70, .64, .57, .53, .49, .45, .41, .30, .12]], [.081, .077, .072, .07, .069, .068, .065, .057, .044], f'thigh.{side}', f'shin.{side}', .49)
        oval('body', 'leather', f'foot.{side}', (sign * .14, .063, .089), (.086, .171, .086), 20, 12)
        box('body', 'sole', f'foot.{side}', (sign * .14, .06, .025), (.177, .332, .05), .021)
        box('body', 'cream', f'foot.{side}', (sign * .14, .07, .142), (.11, .055, .014), .007)
        for y in [.035, .065, .095]:
            box('body', 'cream', f'foot.{side}', (sign * .14, y, .166), (.081, .007, .008), .003)
        tube('body', 'cream', f'foot.{side}', [(sign * .14, 0, .135), (sign * .14, 0, .225)], [.058, .061])
    oval('body', 'skin', 'head', (0, .183, 1.451), (.019, .023, .025), 14, 10)
    ribbon('body', 'ink', 'head', [(-.027, .174, 1.402), (0, .185, 1.396), (.027, .174, 1.402)], .004, .004)


def hair():
    for style in VARIANTS['style']:
        group = f'variant.style.{style}'
        oval(group, 'hair', 'head', (0, -.025, 1.616), (.230, .192, .153), 24, 16)
        for sign in [-1, 1]:
            oval(group, 'hair', 'head', (sign * .18, -.010, 1.555), (.058, .161, .147), 16, 12)
        for i, x in enumerate([-.147, -.09, -.03, .03, .09, .147]):
            obj = oval(group, 'hair', 'head', (x, .128, 1.599 - .017 * math.cos(i)), (.052, .052, .09), 16, 12)
            obj.rotation_euler.y = -.15 + i * .065
        if style == 'bun':
            oval(group, 'hair', 'head', (.024, -.158, 1.712), (.101, .090, .096), 20, 12)
            ring(group, 'top-trim', 'head', (.024, -.156, 1.673), .069, .012, 'Z')
            for sign in [-1, 1]:
                oval(group, 'hair', 'head', (sign * .197, .012, 1.475), (.03, .04, .079))
        elif style == 'bob':
            for sign in [-1, 1]:
                oval(group, 'hair', 'head', (sign * .198, -.035, 1.453), (.058, .151, .15))
            oval(group, 'hair', 'head', (0, -.146, 1.459), (.208, .063, .16))
        elif style == 'waves':
            for sign in [-1, 1]:
                for i in range(3):
                    oval(group, 'hair', 'head', (sign * (.2 + .025 * math.sin(i * 2)), -.04, 1.48 - i * .10), (.071, .123, .105))
            oval(group, 'hair', 'head', (0, -.16, 1.39), (.195, .062, .22))
        elif style == 'crop':
            oval(group, 'hair', 'head', (-.075, .035, 1.733), (.091, .095, .045))


def sleeves(group, outfit):
    short = outfit in ['overalls', 'sailor']
    for side, sign in [('L', -1), ('R', 1)]:
        if short:
            tube(group, 'top', f'arm.{side}', [(sign * .24, 0, 1.227), (sign * .295, .002, 1.13), (sign * .327, .005, 1.04)], [.101, .093, .079])
            limb_tube(group, 'skin', [(sign * x, y, z) for x, y, z in [(.32, .005, 1.08), (.333, .005, 1.03), (.335, .005, .985), (.338, .012, .94), (.34, .020, .84), (.34, .025, .78)]], [.062, .062, .063, .06, .055, .05], f'arm.{side}', f'forearm.{side}', .985)
            tube(group, 'top-trim', f'arm.{side}', [(sign * .321, .005, 1.075), (sign * .327, .005, 1.04)], [.084, .082])
        else:
            limb_tube(group, 'top', [(sign * x, y, z) for x, y, z in [(.24, 0, 1.227), (.275, .001, 1.19), (.308, .003, 1.12), (.328, .005, 1.05), (.334, .005, 1.02), (.335, .005, .985), (.338, .012, .95), (.34, .019, .90), (.34, .025, .78)]], [.101, .099, .089, .079, .076, .074, .070, .065, .057], f'arm.{side}', f'forearm.{side}', .985)
            tube(group, 'top-trim', f'forearm.{side}', [(sign * .34, .025, .828), (sign * .34, .025, .78)], [.064, .062])
        oval(group, 'top', f'arm.{side}', (sign * .253, 0, 1.201), (.1, .093, .099))


def clothes():
    for outfit in VARIANTS['outfit']:
        group = f'variant.outfit.{outfit}'
        tube(group, 'top', 'spine', [(0, 0, .86), (0, 0, .91), (0, 0, 1.07), (0, 0, 1.21), (0, 0, 1.255)], [(.267, .165), (.26, .166), (.193, .135), (.225, .122), (.135, .08)], 24)
        sleeves(group, outfit)
        tube(group, 'top-trim', 'spine', [(0, 0, .858), (0, 0, .898)], [(.272, .170), (.269, .173)], 24)
        if outfit == 'cardigan':
            box(group, 'cream', 'spine', (0, .129, 1.124), (.126, .023, .234), .024)
            for sign in [-1, 1]:
                ribbon(group, 'top-shade', 'spine', [(sign * .101, .101, 1.256), (sign * .039, .151, 1.109), (sign * .02, .154, .900)], .018, .013)
                box(group, 'top-shade', 'spine', (sign * .145, .125, .98), (.082, .023, .10), .013)
                box(group, 'top-trim', 'spine', (sign * .145, .137, 1.019), (.083, .013, .016), .006)
            for z in [.925, .985, 1.045]:
                oval(group, 'gold', 'spine', (.025, .164, z), (.012, .006, .012), 10, 8)
        elif outfit == 'hoodie':
            oval(group, 'top-shade', 'spine', (0, -.076, 1.26), (.172, .127, .10))
            oval(group, 'cream', 'spine', (0, .035, 1.251), (.106, .083, .037))
            box(group, 'top-shade', 'spine', (0, .144, .985), (.253, .036, .117), .04)
            for sign in [-1, 1]:
                ribbon(group, 'cream', 'spine', [(sign * .049, .099, 1.247), (sign * .065, .142, 1.15), (sign * .055, .15, 1.112)], .006, .006)
                oval(group, 'gold', 'spine', (sign * .055, .15, 1.11), (.009, .008, .015), 10, 8)
        elif outfit == 'overalls':
            box(group, 'bottom', 'spine', (0, .151, 1.048), (.258, .04, .27), .025)
            box(group, 'bottom-trim', 'spine', (0, .175, 1.05), (.12, .02, .10), .012)
        elif outfit == 'sailor':
            for sign in [-1, 1]:
                ribbon(group, 'cream', 'spine', [(sign * .18, -.035, 1.241), (sign * .14, .112, 1.23), (0, .15, 1.13)], .046, .012)
                ribbon(group, 'top-shade', 'spine', [(sign * .174, -.035, 1.253), (sign * .133, .123, 1.24), (0, .165, 1.134)], .010, .008)
            oval(group, 'top-shade', 'spine', (0, .17, 1.115), (.034, .02, .031))
            ribbon(group, 'top-shade', 'spine', [(0, .16, 1.115), (.014, .17, 1.04)], .02, .01)
        if outfit == 'overalls':
            for sign in [-1, 1]:
                ribbon(group, 'bottom', 'spine', [(sign * .105, -.170, .90), (sign * .105, -.143, 1.05), (sign * .112, -.117, 1.18), (sign * .120, -.112, 1.21), (sign * .126, -.077, 1.235), (sign * .132, -.040, 1.253), (sign * .132, .09, 1.256), (sign * .1, .165, 1.118)], .025, .012)
                oval(group, 'gold', 'spine', (sign * .1, .186, 1.129), (.013, .005, .013), 12, 8)
    for style in VARIANTS['bottomStyle']:
        group = f'variant.bottomStyle.{style}'
        if style == 'skirt':
            sides = 32
            vertices = []
            for z, rx, ry in SKIRT_RINGS:
                for i in range(sides):
                    angle = i * math.tau / sides
                    fold = 1 + (.055 if i % 2 else -.035)
                    vertices.append((math.cos(angle) * rx * fold, math.sin(angle) * ry * fold, z))
            faces = [(i * sides + j, i * sides + (j + 1) % sides, (i + 1) * sides + (j + 1) % sides, (i + 1) * sides + j) for i in range(len(SKIRT_RINGS) - 1) for j in range(sides)]
            mesh = bpy.data.meshes.new('Pleated skirt')
            mesh.from_pydata(vertices, [], faces)
            obj = bpy.data.objects.new('Pleated skirt', mesh)
            bpy.context.collection.objects.link(obj)
            finish(obj, group, 'bottom', None)
            obj.data.materials.append(MATERIALS['bottom-trim'])
            for polygon in obj.data.polygons:
                polygon.material_index = 1 if polygon.index < sides else 0
            panels = [[obj.vertex_groups.new(name=f'skirt.{row}.{index:02}') for index in range(16)] for row in range(len(SKIRT_RINGS))]
            for vertex in obj.data.vertices:
                row, index = divmod(vertex.index, sides)
                panel = index // 2
                if index % 2:
                    panels[row][panel].add([vertex.index], .5, 'REPLACE')
                    panels[row][(panel + 1) % 16].add([vertex.index], .5, 'REPLACE')
                else:
                    panels[row][panel].add([vertex.index], 1, 'REPLACE')
        else:
            for side, sign in [('L', -1), ('R', 1)]:
                if style == 'trousers':
                    trouser = limb_tube(group, 'bottom', [(sign * .14, .015 if z > .45 else .003, z) for z in [.89, .76, .60, .55, .52, .49, .46, .43, .39, .30, .255, .205]], [.112, .113, .1, .095, .092, .09, .089, .087, .083, .077, .074, .070], f'thigh.{side}', f'shin.{side}', .49)
                    trouser.data.materials.append(MATERIALS['bottom-trim'])
                    for polygon in trouser.data.polygons:
                        if polygon.center.z < .256:
                            polygon.material_index = 1
                else:
                    tube(group, 'bottom', f'thigh.{side}', [(sign * .14, 0, .89), (sign * .14, .01, .76), (sign * .14, .015, .54)], [.115, .115, .096])
                    tube(group, 'bottom-trim', f'thigh.{side}', [(sign * .14, .015, .537), (sign * .14, .015, .585)], [.105, .107])


def accessories():
    group = 'variant.accessory.glasses'
    for sign in [-1, 1]:
        ring(group, 'gold', 'head', (sign * .081, .192, 1.493), .052, .006)
        ribbon(group, 'gold', 'head', [(sign * .13, .19, 1.508), (sign * .212, .069, 1.514)], .005, .005)
    ribbon(group, 'gold', 'head', [(-.03, .192, 1.5), (0, .202, 1.508), (.03, .192, 1.5)], .005, .005)
    group = 'variant.accessory.blossom'
    for i in range(5):
        angle = i * math.tau / 5
        oval(group, 'petal', 'head', (-.19 + math.cos(angle) * .032, .113, 1.605 + math.sin(angle) * .032), (.025, .012, .025), 12, 8)
    oval(group, 'gold', 'head', (-.19, .129, 1.605), (.014, .009, .014), 12, 8)
    group = 'variant.accessory.moon-clips'
    for sign in [-1, 1]:
        points = []
        for i in range(13):
            angle = -.7 * math.pi + i / 12 * 1.4 * math.pi
            points.append((sign * .18 + .027 * math.cos(angle), .128, 1.62 + .033 * math.sin(angle)))
        tube(group, 'gold', 'head', points, [.002 + .006 * math.sin(i / 12 * math.pi) for i in range(13)], 8)


def consolidate():
    for name, objects in PARTS.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = name
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        mesh.verts.index_update()
        face_order = {face: index for index, face in enumerate(sorted(mesh.faces, key=lambda face: tuple(vertex.index for vertex in face.verts)))}
        mesh.faces.sort(key=face_order.get)
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.parent = RIG
        modifier = obj.modifiers.new('Wilds skin', 'ARMATURE')
        modifier.object = RIG
        obj['wildsPart'] = name
    bpy.ops.object.select_all(action='DESELECT')
    RIG.select_set(True)
    bpy.context.view_layer.objects.active = RIG


def set_bone(name, head, tail, roll=0):
    bone = RIG.pose.bones[name]
    direction = Vector(tail) - Vector(head)
    rest = RIG.data.bones[name].matrix_local
    rotation = (rest.col[1].xyz.rotation_difference(direction.normalized()) @ rest.to_quaternion()).to_matrix().to_4x4()
    bone.matrix = Matrix.Translation(Vector(head)) @ rotation
    bpy.context.view_layer.update()


def leg(side, hip, ankle, foot_pitch=0, knee_outward=0):
    start = Vector(hip)
    end = Vector(ankle)
    delta = end - start
    length = delta.length
    center = (start + end) / 2
    bend = Vector(((-1 if side == 'L' else 1) * knee_outward, 1, 0))
    perpendicular = bend - delta.normalized() * delta.normalized().dot(bend)
    perpendicular.normalize()
    knee = center + perpendicular * math.sqrt(max(.0002, .37 ** 2 - (length / 2) ** 2))
    set_bone(f'thigh.{side}', start, knee)
    set_bone(f'shin.{side}', knee, end)
    set_bone(f'foot.{side}', end, end + Vector((0, math.cos(foot_pitch) * .19, math.sin(foot_pitch) * .19)))


def arm(side, shoulder, wrist, elbow_y):
    sign = -1 if side == 'L' else 1
    a = Vector(shoulder)
    c = Vector(wrist)
    direction = (c - a).normalized()
    distance = min((c - a).length, .462)
    along = (.244 ** 2 - .221 ** 2 + distance ** 2) / (2 * distance)
    bend = Vector((sign * .15, elbow_y * 8, 0))
    bend = (bend - direction * bend.dot(direction)).normalized()
    b = a + direction * along + bend * math.sqrt(max(.0001, .244 ** 2 - along ** 2))
    set_bone(f'arm.{side}', a, b)
    set_bone(f'forearm.{side}', b, c)
    set_bone(f'hand.{side}', c, c + (c - b).normalized() * .085)


def climb_contact(phase):
    clip = CLIPS['climb']
    stance = clip['stance']
    travel = clip['speed'] * clip['frames'] / FPS * stance
    if phase < stance:
        return travel * (.5 - phase / stance), 0
    swing = (phase - stance) / (1 - stance)
    return travel * (-.5 + (1 - math.cos(math.pi * swing)) / 2), math.sin(math.pi * swing)


def motion_value(phase, points):
    for (start, before), (end, after) in zip(points, points[1:]):
        if phase <= end:
            fraction = max(0, (phase - start) / (end - start))
            return before + (after - before) * fraction * fraction * (3 - 2 * fraction)
    return points[-1][1]


def pose(name, phase):
    for bone in RIG.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bob = .005 * math.sin(phase * math.tau)
    lean = 0
    squat = 0
    forward = 0
    knee_outward = 0
    torso_angle = 0
    stopping = name.startswith('stop')
    if name in ['walk', 'run']:
        bob = (.023 if name == 'walk' else .03) * (1 - math.cos(phase * math.tau * 2))
        squat = .075 if name == 'walk' else .105
        lean = .06 if name == 'walk' else .15 + .012 * math.sin(phase * math.tau)
        forward = .075 if name == 'run' else 0
    if stopping:
        bob = 0
        squat = motion_value(phase, [(0, .15), (.22, .15), (.55, .075), (.78, .065), (1, 0)])
        lean = motion_value(phase, [(0, .085), (.22, .105), (.60, -.015), (.78, .015), (1, 0)])
        forward = motion_value(phase, [(0, -.05), (.25, -.085), (.60, -.03), (1, 0)])
    if name == 'jump':
        bob = 0
        squat = motion_value(phase, [(0, 0), (3 / 26, .16), (5 / 26, 0), (12 / 26, -.02), (1, .04)])
        lean = motion_value(phase, [(0, 0), (3 / 26, .10), (5 / 26, .035), (1, .055)])
    if name == 'fall':
        bob = 0
        squat = .035 + .015 * math.sin(phase * math.tau * 2)
        lean = .065 + .035 * math.sin(phase * math.tau)
        forward = .025 * math.sin(phase * math.tau)
    if name == 'land':
        bob = 0
        squat = motion_value(phase, [(0, .035), (.22, .24), (.58, .025), (.78, .055), (1, 0)])
        lean = motion_value(phase, [(0, .03), (.22, .14), (.60, .035), (.80, .045), (1, 0)])
        forward = .035 * math.sin(math.pi * phase)
    if name == 'climb':
        squat = .06
        lean = .15
        bob = .025 * math.sin(phase * math.tau * 2)
        knee_outward = .9
    if name == 'mantle':
        bob = 0
        rise = motion_value(phase, [(0, 0), (.55, .55), (1, .55)])
        advance = motion_value(phase, [(0, 0), (.55, 0), (.85, .46), (1, .46)])
        squat = motion_value(phase, [(0, .25), (.55, .51), (.82, .10), (1, 0)])
        lean = motion_value(phase, [(0, .16), (.55, .12), (.85, .055), (1, 0)])
        forward = motion_value(phase, [(0, .03), (.55, .13), (1, 0)])
        knee_outward = motion_value(phase, [(0, .9), (.55, .7), (1, 0)])
        torso_angle = motion_value(phase, [(0, .60), (.55, 1.30), (.85, .25), (1, 0)])
    if name == 'mantle-wide':
        bob = 0
        seconds = phase * MANTLE_MOTION['wide']['durationMs'] / 1000
        rise = motion_value(seconds * 1000, [(0, 0), (MANTLE_MOTION['liftMs'], MANTLE_MOTION['riseMetres']), (MANTLE_MOTION['wide']['durationMs'], MANTLE_MOTION['riseMetres'])])
        lift_advance = rise / .55 * .54
        advance = motion_value(seconds, [(0, 0), (.2475, 0), (.50, .64), (.65, .64)])
        squat = motion_value(seconds, [(0, .25), (.2475, .51), (.40, .30), (.50, .20), (.548, .20), (.608, .025), (.65, 0)])
        lean = motion_value(seconds, [(0, .16), (.2475, .18), (.40, .10), (.50, .08), (.548, .13), (.65, 0)])
        forward = motion_value(seconds, [(0, .90), (.2475, .35), (.40, .25), (.50, .02), (.65, 0)])
        knee_outward = motion_value(seconds, [(0, .9), (.2475, .5), (.50, 0), (.65, 0)])
        torso_angle = motion_value(seconds, [(0, .60), (.2475, 1.30), (.40, .95), (.50, .25), (.65, 0)])
    pelvis = Vector((0, forward, .86 + bob - squat))
    torso_axis = Vector((0, math.sin(torso_angle), math.cos(torso_angle)))
    set_bone('pelvis', pelvis, pelvis + torso_axis * .14)
    spine = pelvis + torso_axis * .14
    shoulder_height = pelvis.z + .355 * math.cos(torso_angle)
    shoulder_forward = pelvis.y + .355 * math.sin(torso_angle) if torso_angle else pelvis.y + lean
    set_bone('spine', spine, spine + (torso_axis * .25 if torso_angle else Vector((0, lean, .25))))
    head = spine + (torso_axis * .25 if torso_angle else Vector((0, lean, .25)))
    set_bone('head', head, head + Vector((.007 * math.sin(phase * math.tau) if name == 'idle' else 0, -.015, .35)))
    for side, sign, offset in [('L', -1, 0), ('R', 1, .5)]:
        t = (phase + offset) % 1
        ankle = Vector((sign * .14, 0, .12))
        pitch = 0
        wrist = Vector((sign * .34, .025 + forward + lean, pelvis.z - .095))
        elbow_y = -.035
        if name in ['walk', 'run']:
            clip = CLIPS[name]
            stance = clip['stance']
            travel = clip['speed'] * clip['frames'] / FPS * stance
            if t < stance:
                ankle.y = travel * (.5 - t / stance)
            else:
                swing = (t - stance) / (1 - stance)
                ankle.y = travel * (-.5 + (1 - math.cos(swing * math.pi)) / 2)
                ankle.z += (.19 if name == 'walk' else .30) * math.sin(math.pi * swing)
                pitch = -.45 * math.sin(math.pi * swing)
            wrist.y = forward + lean - (.19 if name == 'walk' else .23) * math.cos(t * math.tau)
            wrist.z += .10 if name == 'walk' else .17
            elbow_y = -.09
        elif name == 'jump':
            airborne = max(0, (phase - 5 / 26) / (21 / 26))
            tuck = math.sin(math.pi * airborne * .9) * .20
            ankle.y = -.08 * math.sin(math.pi * airborne)
            ankle.z += tuck
            pitch = -.25 * math.sin(math.pi * airborne)
            wrist.y = motion_value(phase, [(0, .025), (3 / 26, -.12), (5 / 26, .08), (.60, .22), (1, .10)])
            wrist.z += .17 * math.sin(math.pi * airborne)
        elif name == 'fall':
            ankle.y = -.07 + .035 * math.sin(t * math.tau)
            ankle.z += .09 + .03 * math.sin(t * math.tau)
            pitch = -.15 - .10 * math.cos(t * math.tau)
            wrist.x += sign * (.09 + .04 * math.cos(phase * math.tau))
            wrist.y += .09 + .075 * math.sin(t * math.tau)
            wrist.z += .15 + .055 * math.cos(t * math.tau)
        elif stopping:
            lead = 'R' if 'right' in name else 'L'
            anchor = -.38 if 'back' in name else .38
            if side == lead:
                step = max(0, min(1, (phase - .55) / .40))
                ankle.y = anchor * (1 - step * step * (3 - 2 * step))
                ankle.z += .22 * math.sin(math.pi * step)
                pitch = -.28 * math.sin(math.pi * step)
            else:
                step = max(0, min(1, phase / .40))
                ankle.y = -anchor * (1 - step * step * (3 - 2 * step))
                ankle.z += .23 * math.sin(math.pi * (.35 + .65 * step))
                pitch = -.20 * math.sin(math.pi * step)
            wrist.y += .12 * math.sin(math.pi * phase)
            wrist.z += .10 * math.sin(math.pi * phase)
            elbow_y = -.06
        elif name == 'land':
            wrist.y += .12 * math.sin(math.pi * phase)
            wrist.z += .14 * math.sin(math.pi * phase)
            elbow_y = -.06
        elif name == 'mantle':
            if side == 'L':
                step = max(0, min(1, (phase - .72) / .28))
                ankle.y = .32 - advance + .14 * step * step * (3 - 2 * step)
                ankle.z = .67 - rise + .09 * math.sin(math.pi * step)
            else:
                ankle.y = motion_value(phase, [(0, .22), (.55, .08), (.72, .46), (1, .46)]) - advance
                ankle.z = motion_value(phase, [(0, .12), (.30, .48), (.55, .28), (.72, .12), (1, .12)])
                pitch = motion_value(phase, [(0, math.pi / 2), (.55, 0), (1, 0)])
            release = motion_value(phase, [(0, 0), (.55, 0), (.78, 1), (1, 1)])
            wrist.x = sign * (.26 * (1 - release) + .34 * release)
            wrist.y = (.42 - advance) * (1 - release) + (.025 + forward + lean) * release
            wrist.z = (.59 - rise) * (1 - release) + (pelvis.z - .095) * release
            elbow_y = -.035 - .045 * (1 - phase)
        elif name == 'mantle-wide':
            if side == 'L':
                step = max(0, min(1, (seconds - .40) / .10))
                ankle.y = 1.10 - lift_advance - advance + .08 * step * step * (3 - 2 * step)
                ankle.z = .67 - rise + .15 * math.sin(math.pi * step)
            else:
                ankle.y = motion_value(seconds, [(0, .50), (.2475, .24), (.40, .64), (.65, .64)]) - advance
                ankle.z = motion_value(seconds, [(0, .12), (.14, .48), (.2475, .28), (.40, .12), (.65, .12)])
                pitch = motion_value(seconds, [(0, math.pi / 2), (.2475, 0), (.65, 0)])
            release = motion_value(seconds, [(0, 0), (.2475, 0), (.40, 1), (.65, 1)])
            wrist.x = sign * (.26 * (1 - release) + .34 * release)
            wrist.y = (1.12 - lift_advance - advance) * (1 - release) + (.025 + forward + lean) * release
            wrist.z = (.59 - rise) * (1 - release) + (pelvis.z - .095) * release
            elbow_y = -.035 - .045 * (1 - phase)
        elif name == 'climb':
            height, reach = climb_contact(t)
            ankle.x = sign * .18
            ankle.y = .22 - .08 * reach
            ankle.z = .36 + height
            pitch = math.pi / 2 - .24 * reach
            height, reach = climb_contact((t + .5) % 1)
            wrist.x = sign * .26
            wrist.y = .32 - .05 * reach
            wrist.z = 1.30 + height
            elbow_y = -.10
        elif name == 'idle':
            wrist.x += sign * .004 * math.sin(phase * math.tau)
        leg(side, (sign * .14, pelvis.y, pelvis.z), ankle, pitch, knee_outward)
        arm(side, (sign * .255, shoulder_forward, shoulder_height), wrist, elbow_y)
    for row, (z, rx, ry) in enumerate(SKIRT_RINGS):
        for index in range(16):
            angle = index * math.tau / 16
            rest_point = Vector((math.cos(angle) * rx, math.sin(angle) * ry, z))
            if z > .86:
                target = RIG.pose.bones['pelvis'].matrix @ (RIG.data.bones['pelvis'].matrix_local.inverted() @ rest_point)
            else:
                candidates = [RIG.pose.bones[f'thigh.{side}'].matrix @ (RIG.data.bones[f'thigh.{side}'].matrix_local.inverted() @ rest_point) for side in ['L', 'R']]
                weight = max(0, min(1, .5 + rest_point.x / .40))
                weight = weight * weight * (3 - 2 * weight)
                target = candidates[0].lerp(candidates[1], weight)
            set_bone(f'skirt.{row}.{index:02}', target, target + Vector((0, 0, .1)))
    if name == 'mantle-wide':
        motion = MANTLE_MOTION['wide']
        root_advance = motion_value(seconds * 1000, [(0, 0), (MANTLE_MOTION['liftMs'], 0), (motion['transferMs'], motion['advanceMetres']), (motion['durationMs'], motion['advanceMetres'])])
        shift = Matrix.Translation((0, lift_advance + advance - root_advance, 0))
        for bone in RIG.pose.bones:
            if bone.parent is None:
                bone.matrix = shift @ bone.matrix
    bpy.context.view_layer.update()


def animate():
    bpy.context.scene.render.fps = FPS
    RIG.animation_data_create()
    for name, clip in CLIPS.items():
        action = bpy.data.actions.new(name)
        RIG.animation_data.action = action
        for frame in range(clip['frames'] + 1):
            pose(name, frame / clip['frames'])
            for bone in RIG.pose.bones:
                bone.keyframe_insert('location', frame=frame)
                bone.keyframe_insert('rotation_quaternion', frame=frame)
                bone.keyframe_insert('scale', frame=frame)
        track = RIG.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, action)
        strip.action_frame_start = 0
        strip.action_frame_end = clip['frames']
        track.mute = True
        RIG.animation_data.action = None
    pose('idle', 0)
    bpy.context.scene.frame_set(0)


def preview(path, clip='idle', phase=0, appearance=None):
    RIG.animation_data.action = None
    for track in RIG.animation_data.nla_tracks:
        track.mute = True
    pose(clip, phase)
    for part in PARTS:
        if part.startswith('variant.'):
            field, option = part.split('.')[1:]
            selected = {'style': 'bun', 'outfit': 'cardigan', 'bottomStyle': 'trousers', 'accessory': 'none', **(appearance or {})}
            bpy.data.objects[part].hide_render = selected[field] != option
    bpy.ops.object.camera_add(location=(3.0, 5.5, 2.6))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, .90)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.3
    scene = bpy.context.scene
    scene.camera = camera
    for location, energy, size in [((3, 4, 6), 500, 5), ((-3, 1, 3), 300, 4), ((0, -4, 4), 450, 3)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = 'DISK'
        light.data.size = size
        light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.world.color = (.22, .25, .29)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def build_avatar():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    PARTS.clear()
    MATERIALS.clear()
    MATERIALS.update({name: material(name, color) for name, color in PALETTE.items()})
    build_rig()
    body()
    hair()
    clothes()
    accessories()
    consolidate()
    animate()
    output = ROOT / 'public' / 'wilds'
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(output / 'avatar.glb'), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_range=False, export_force_sampling=True, export_skins=True, export_yup=True, export_extras=True, export_texcoords=False, export_materials='EXPORT')
    manifest = {
        'version': 1, 'generator': 'tools/blender/avatar.py', 'asset': 'avatar.glb',
        'forward': '-Z', 'up': '+Y', 'feetY': 0, 'heightMetres': 1.81,
        'clips': {name: {'durationMs': round(clip['frames'] / FPS * 1000, 6), 'loop': clip['loop'], 'speedMetresPerSecond': clip['speed'], **({'stanceFraction': clip['stance']} if 'stance' in clip else {})} for name, clip in CLIPS.items()},
        'variants': VARIANTS, 'materialSlots': list(PALETTE), 'mantleMotion': MANTLE_MOTION,
    }
    (output / 'avatar-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (ROOT / 'src' / 'core' / 'wilds' / 'mantle-motion.json').write_text(json.dumps(MANTLE_MOTION, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    import sys
    build_avatar()
    if '--preview' in sys.argv:
        clip = sys.argv[sys.argv.index('--clip') + 1] if '--clip' in sys.argv else 'idle'
        phase = float(sys.argv[sys.argv.index('--phase') + 1]) if '--phase' in sys.argv else 0
        appearance = json.loads(sys.argv[sys.argv.index('--appearance') + 1]) if '--appearance' in sys.argv else None
        preview(Path(sys.argv[sys.argv.index('--preview') + 1]), clip, phase, appearance)
