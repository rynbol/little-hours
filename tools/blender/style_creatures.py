import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
FPS = 30
MATERIALS = {}
PARTS = {}
RIG = None
BONES = {}
PALETTES = {
    'cat': {
        'ginger': '#c98546', 'ginger-light': '#dfa25d', 'ginger-shade': '#a86637',
        'cream': '#f4e3bd', 'cream-shade': '#dfc799', 'stripe': '#915634',
        'ear': '#dca49c', 'nose': '#995e62', 'eye-rim': '#a57242',
        'eye-amber': '#8a693d', 'eye-dark': '#302b27', 'catchlight': '#fff5da',
        'mouth': '#715040',
    },
    'warden': {
        'stone': '#92998b', 'stone-light': '#b5b9a4', 'stone-shade': '#788473',
        'stone-warm': '#a49b80', 'moss-dark': '#516b47', 'moss': '#77945d',
        'moss-light': '#9bb772', 'lichen': '#bec18b', 'bark': '#76664d',
        'bark-light': '#a79060', 'heartwood': '#f4bd66', 'heartwood-core': '#ffe2a0',
        'hoof': '#565c50', 'eye-rim': '#5b6250', 'eye-amber': '#bd9952',
        'eye-dark': '#343c32', 'catchlight': '#fff2ce', 'ear': '#b9ae88',
    },
}
CLIPS = {
    'cat': {
        'idle': {'duration': 3.2, 'loop': True},
        'attack': {'duration': 1.0, 'loop': False, 'anticipation': .28, 'hit': .46, 'settle': .86},
        'skill': {'duration': 1.6, 'loop': False, 'anticipation': .30, 'hit': .58, 'settle': .92},
        'recover': {'duration': 1.7, 'loop': False},
    },
    'warden': {
        'idle': {'duration': 4.0, 'loop': True},
        'charge': {'duration': 1.6, 'loop': False, 'anticipation': .34, 'hit': .57, 'settle': .91},
        'sweep': {'duration': 1.7, 'loop': False, 'anticipation': .34, 'hit': .52, 'settle': .91},
        'slam': {'duration': 1.8, 'loop': False, 'anticipation': .35, 'hit': .59, 'settle': .93},
        'roots': {'duration': 2.4, 'loop': False, 'anticipation': .34, 'hit': .56, 'settle': .92},
        'stagger': {'duration': 1.3, 'loop': False},
        'phase': {'duration': 2.8, 'loop': False},
        'defeat': {'duration': 3.0, 'loop': False},
    },
}


def reset(kind):
    global RIG
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATERIALS.clear()
    PARTS.clear()
    BONES.clear()
    RIG = None
    for name, value in PALETTES[kind].items():
        srgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        linear = [c / 12.92 if c < .04045 else ((c + .055) / 1.055) ** 2.4 for c in srgb]
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        material.diffuse_color = (*linear, 1)
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*linear, 1)
        shader.inputs['Roughness'].default_value = .88
        if name.startswith('heartwood'):
            shader.inputs['Emission Color'].default_value = (*linear, 1)
            shader.inputs['Emission Strength'].default_value = .5 if name == 'heartwood' else .8
        MATERIALS[name] = material


def mesh(name, vertices, faces, paint, bone=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATERIALS[paint])
    for face in data.polygons:
        face.use_smooth = smooth
    if bone:
        obj.vertex_groups.new(name=bone).add(list(range(len(vertices))), 1, 'REPLACE')
    PARTS[name] = obj
    return obj


def loft(name, points, radii, paint, bone=None, sides=16, smooth=True, phase=0):
    vertices = []
    for index, point in enumerate(points):
        point = Vector(point)
        direction = Vector(points[min(index + 1, len(points) - 1)]) - Vector(points[max(0, index - 1)])
        direction.normalize()
        u = Vector((1, 0, 0))
        if abs(direction.dot(u)) > .92:
            u = Vector((0, 1, 0))
        u = (u - direction * direction.dot(u)).normalized()
        v = direction.cross(u).normalized()
        rx, rz = radii[index] if isinstance(radii[index], tuple) else (radii[index], radii[index])
        for corner in range(sides):
            angle = corner * math.tau / sides + phase
            vertices.append(point + u * (math.cos(angle) * rx) + v * (math.sin(angle) * rz))
    faces = [tuple(reversed(range(sides)))]
    for ring in range(len(points) - 1):
        for corner in range(sides):
            a = ring * sides + corner
            b = ring * sides + (corner + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple((len(points) - 1) * sides + corner for corner in range(sides)))
    return mesh(name, vertices, faces, paint, bone, smooth)


def shape(name, center, scale, paint, bone=None, sides=20, levels=12, smooth=True):
    points = []
    radii = []
    for level in range(levels + 1):
        angle = -math.pi / 2 + math.pi * level / levels
        points.append((center[0], center[1], center[2] + math.sin(angle) * scale[2]))
        width = max(.002, math.cos(angle))
        radii.append((scale[0] * width, scale[1] * width))
    return loft(name, points, radii, paint, bone, sides, smooth)


def mark(name, points, radius, paint, bone, sides=8):
    return loft(name, points, [radius * .45] + [radius] * (len(points) - 2) + [radius * .45], paint, bone, sides)


def leaf(name, base, tip, width, paint, bone, facing=(0, -1, 0)):
    start = Vector(base)
    end = Vector(tip)
    axis = end - start
    normal = Vector(facing).normalized()
    lateral = axis.cross(normal).normalized() * width
    midpoint = start + axis * .48
    ridge = midpoint + normal * width * .26
    vertices = [start, midpoint - lateral, end, midpoint + lateral, ridge, midpoint - normal * .018]
    return mesh(name, vertices, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 5, 1), (1, 5, 2), (2, 5, 3), (3, 5, 0)], paint, bone, False)


def moss_plate(name, base, tip, width, paint, bone, facing):
    start = Vector(base)
    end = Vector(tip)
    axis = end - start
    normal = Vector(facing).normalized()
    lateral = axis.cross(normal).normalized() * width
    contour = [(0, 0), (.18, -.73), (.49, -.96), (.73, -.91), (.81, -.59), (1, -.30), (.93, 0), (1.03, .24), (.86, .51), (.77, .84), (.43, 1), (.16, .70)]
    vertices = [start + axis * t + lateral * across for t, across in contour]
    vertices.extend([start + axis * .46 + normal * .034, start + axis * .48 - normal * .017])
    faces = []
    for index in range(len(contour)):
        following = (index + 1) % len(contour)
        faces.extend([(index, following, 12), (following, index, 13)])
    return mesh(name, vertices, faces, paint, bone, False)


def soften(obj, amount):
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new('Rounded edges', 'BEVEL')
    modifier.width = amount
    modifier.segments = 3
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def join_parts(names, name):
    bpy.ops.object.select_all(action='DESELECT')
    objects = [PARTS.pop(key) for key in names]
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    PARTS[name] = obj
    return obj


def fuse(names, name, voxel, smoothing=5):
    obj = join_parts(names, name)
    modifier = obj.modifiers.new('Joined anatomy', 'REMESH')
    modifier.mode = 'VOXEL'
    modifier.voxel_size = voxel
    modifier.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = obj.modifiers.new('Soft anatomy', 'SMOOTH')
    modifier.factor = 1.1
    modifier.iterations = smoothing
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = obj.modifiers.new('Authored silhouette density', 'DECIMATE')
    modifier.ratio = .48
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def rig(kind, body, neck, head, legs, tail):
    global RIG
    specifications = [
        ('body', body, neck, None),
        ('neck', neck, head, 'body'),
        ('head', head, (head[0], head[1] - .12, head[2] + .025), 'neck'),
    ]
    for name, points in legs.items():
        specifications.extend([
            (f'{name}.upper', points[0], points[1], 'body'),
            (f'{name}.lower', points[1], points[2], f'{name}.upper'),
            (f'{name}.paw', points[2], (points[2][0], points[2][1] - .08, points[2][2]), None),
        ])
    for index in range(len(tail) - 1):
        specifications.append((f'tail.{index}', tail[index], tail[index + 1], 'body' if index == 0 else f'tail.{index - 1}'))
    specifications.extend([
        ('ear.L', (head[0] - .1, head[1], head[2] + .07), (head[0] - .2, head[1], head[2] + .2), 'head'),
        ('ear.R', (head[0] + .1, head[1], head[2] + .07), (head[0] + .2, head[1], head[2] + .2), 'head'),
    ])
    bpy.ops.object.armature_add(enter_editmode=True)
    RIG = bpy.context.object
    RIG.name = 'StyleCatRig' if kind == 'cat' else 'StyleWardenRig'
    edit_bones = RIG.data.edit_bones
    edit_bones.remove(edit_bones[0])
    for name, start, end, parent in specifications:
        bone = edit_bones.new(name)
        bone.head = start
        bone.tail = end
        if parent:
            bone.parent = edit_bones[parent]
        BONES[name] = {'start': Vector(start), 'end': Vector(end), 'parent': parent}
    bpy.ops.object.mode_set(mode='OBJECT')
    for bone in RIG.pose.bones:
        bone.rotation_mode = 'QUATERNION'


def skin_loft(obj, points, joint_names):
    groups = {name: obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name) for name in joint_names}
    segments = list(zip([Vector(p) for p in points[:-1]], [Vector(p) for p in points[1:]]))
    for vertex in obj.data.vertices:
        nearest = []
        for index, (a, b) in enumerate(segments):
            direction = b - a
            factor = max(0, min(1, (vertex.co - a).dot(direction) / direction.length_squared))
            distance = (vertex.co - (a + direction * factor)).length
            nearest.append((distance, index))
        nearest.sort()
        nearest = nearest[:2]
        weights = [(1 / max(.025, d) ** 3, i) for d, i in nearest]
        total = sum(w for w, _ in weights)
        for weight, index in weights:
            groups[joint_names[index]].add([vertex.index], weight / total, 'REPLACE')


def skin_body(obj, legs, floor, ceiling):
    obj.vertex_groups.clear()
    body = obj.vertex_groups.new(name='body')
    groups = {}
    for name in legs:
        for segment in ['upper', 'lower', 'paw']:
            key = f'{name}.{segment}'
            groups[key] = obj.vertex_groups.new(name=key)
    for vertex in obj.data.vertices:
        influence = max(0, min(1, (ceiling - vertex.co.z) / (ceiling - floor)))
        if influence < 1:
            body.add([vertex.index], 1 - influence, 'REPLACE')
        if influence == 0:
            continue
        leg = min(legs, key=lambda name: (vertex.co.x - legs[name][0][0]) ** 2 + (vertex.co.y - legs[name][0][1]) ** 2)
        a, b, c = [Vector(point) for point in legs[leg]]
        blend = .035 if ceiling < 1 else .10
        upper = max(0, min(1, (vertex.co.z - b.z + blend) / (blend * 2)))
        foot = max(0, min(1, (c.z + blend - vertex.co.z) / (blend * 2)))
        for segment, weight in [('upper', upper), ('lower', (1 - upper) * (1 - foot)), ('paw', (1 - upper) * foot)]:
            if weight > 0:
                groups[f'{leg}.{segment}'].add([vertex.index], weight * influence, 'REPLACE')


def limb(name, points, radii, paint, sides=16, smooth=True):
    a, b, c = [Vector(p) for p in points]
    path = [a, a.lerp(b, .34), a.lerp(b, .75), b, b.lerp(c, .22), b.lerp(c, .64), c]
    if paint == 'ginger':
        path[0] = Vector((a.x * .43, a.y, a.z + .035))
        radii = [(radii[0][0] * .67, radii[0][1] * .70), *radii[1:]]
    obj = loft(name, path, radii, paint, sides=sides, smooth=smooth)
    skin_loft(obj, [a, b, c, c + Vector((0, -.08, 0))], [f'{name}.upper', f'{name}.lower', f'{name}.paw'])
    return obj



def fur_patch(name, body, outline, paint, direction, bone='body'):
    vertices = [vertex.co.copy() for vertex in body.data.vertices]
    faces = [tuple(face.vertices) for face in body.data.polygons]
    surface = BVHTree.FromPolygons(vertices, faces, all_triangles=False)
    center = sum((Vector(point) for point in outline), Vector()) / len(outline)
    points = []
    ray = Vector(direction).normalized()
    for ring in range(7):
        factor = .001 + ring / 6 * .999
        for point in outline:
            start = center.lerp(Vector(point), factor)
            hit, normal, face, distance = surface.ray_cast(start, ray, 2)
            points.append(hit + normal * .0045 if hit is not None else start)
    count = len(outline)
    faces = [tuple(reversed(range(count)))]
    for ring in range(6):
        for index in range(count):
            a = ring * count + index
            b = ring * count + (index + 1) % count
            faces.append((a, b, b + count, a + count))
    edge_a = points[faces[1][1]] - points[faces[1][0]]
    edge_b = points[faces[1][2]] - points[faces[1][0]]
    if edge_a.cross(edge_b).dot(-ray) < 0:
        faces = [tuple(reversed(face)) for face in faces]
    return mesh(name, points, faces, paint, bone, True)

def cat_geometry():
    front_y = -.25
    back_y = .255
    legs = {}
    for side, sign in [('L', -1), ('R', 1)]:
        legs[f'front.{side}'] = [(sign * .122, front_y + .04, .36), (sign * .135, front_y + .032, .195), (sign * .145, front_y - .028, .065)]
        legs[f'hind.{side}'] = [(sign * .137, back_y, .345), (sign * .153, back_y - .06, .22), (sign * .151, back_y + .028, .072)]
    tail = [(0, .285, .38), (.03, .43, .42), (.075, .53, .55), (.14, .57, .64), (.205, .52, .67)]
    rig('cat', (0, .16, .32), (0, -.20, .36), (0, -.34, .49), legs, tail)
    loft('torso', [(0, .36, .31), (0, .32, .33), (0, .22, .32), (0, .06, .30), (0, -.10, .315), (0, -.215, .345), (0, -.27, .375)], [(.055, .055), (.115, .135), (.155, .157), (.152, .147), (.142, .156), (.125, .144), (.073, .09)], 'ginger', 'body', 24)
    shape('chest', (0, -.221, .349), (.137, .119, .161), 'ginger', 'body')
    for name, points in legs.items():
        if name.startswith('hind'):
            limb(name, points, [(.063, .067), (.066, .072), (.054, .06), (.042, .045), (.036, .039), (.030, .032), (.028, .031)], 'ginger')
        else:
            limb(name, points, [(.055, .06), (.050, .056), (.043, .046), (.037, .039), (.032, .034), (.028, .029), (.028, .029)], 'ginger')
        foot = points[2]
        loft(f'{name}.foot', [(foot[0], foot[1] + .026, .043), (foot[0], foot[1] + .01, .047), (foot[0], foot[1] - .033, .042), (foot[0], foot[1] - .073, .031), (foot[0], foot[1] - .083, .030)], [(.019, .025), (.041, .045), (.049, .042), (.041, .027), (.019, .017)], 'cream', f'{name}.paw', 20)
        for index, offset in enumerate([-.023, 0, .023]):
            mark(f'{name}.toe.{index}', [(foot[0] + offset, foot[1] - .080, .023), (foot[0] + offset, foot[1] - .081, .042), (foot[0] + offset, foot[1] - .061, .062)], .0018, 'cream-shade', f'{name}.paw', 6)
    for side, sign in [('L', -1), ('R', 1)]:
        shape(f'cat-shoulder.{side}', (sign * .102, -.21, .327), (.076, .088, .089), 'ginger', 'body')
        shape(f'cat-haunch.{side}', (sign * .115, .242, .279), (.074, .094, .092), 'ginger', 'body')
    torso = fuse(['torso', 'chest', *legs, 'cat-shoulder.L', 'cat-shoulder.R', 'cat-haunch.L', 'cat-haunch.R'], 'cat-body', .007, 16)
    skin_body(torso, legs, .24, .36)
    bib = []
    for index in range(64):
        angle = index * math.tau / 64
        z = .348 + .123 * math.cos(angle)
        width = .108 * (1 + .21 * math.cos(angle))
        bib.append((math.sin(angle) * width, -.7, z))
    fur_patch('cat-bib', torso, bib, 'cream', (0, 1, 0))
    for side, sign in [('L', -1), ('R', 1)]:
        for index, y in enumerate([.14, .23, .30]):
            outline = []
            for corner in range(48):
                angle = corner * math.tau / 48
                z = .403 + .053 * math.cos(angle)
                offset = .009 * math.sin(angle)
                outline.append((sign * .5, y + offset - max(0, .42 - z) * .32, z))
            fur_patch(f'cat-stripe.{side}.{index}', torso, outline, 'ginger-shade', (-sign, 0, 0))
    head_levels = [(.355, .052, .045, -.349), (.375, .114, .076, -.349), (.41, .157, .11, -.351), (.465, .176, .127, -.342), (.525, .174, .118, -.335), (.573, .15, .102, -.328), (.615, .107, .073, -.322), (.634, .042, .03, -.32)]
    head = loft('cat-head', [(0, y, z) for z, x, depth, y in head_levels], [(x, depth) for z, x, depth, y in head_levels], 'ginger', 'head', 32)
    bpy.context.view_layer.objects.active = head
    refinement = head.modifiers.new('Rounded cheek volume', 'SUBSURF')
    refinement.levels = 1
    bpy.ops.object.modifier_apply(modifier=refinement.name)
    for side, sign in [('L', -1), ('R', 1)]:
        vertices = [(sign * .070, -.348, .592), (sign * .166, -.334, .577), (sign * .153, -.308, .729), (sign * .081, -.271, .593), (sign * .16, -.269, .580), (sign * .151, -.274, .722)]
        outer = mesh(f'ear.{side}.outer', vertices, [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], 'ginger', f'ear.{side}')
        soften(outer, .008)
        inner = mesh(f'ear.{side}.inner', [(sign * .098, -.349, .607), (sign * .149, -.337, .602), (sign * .148, -.317, .698), (sign * .132, -.337, .627)], [(0, 1, 3), (1, 2, 3), (2, 0, 3)], 'ear', f'ear.{side}')
        for index in range(3):
            z = .41 + index * .022
            loft(f'cheek-tuft.{side}.{index}', [(sign * .142, -.393, z + .009), (sign * .170, -.389, z), (sign * (.188 - index * .006), -.381, z - .012)], [.017, .012, .002], 'ginger-light', 'head', 12)
        shape(f'eye-rim.{side}', (sign * .084, -.450, .505), (.049, .009, .060), 'eye-rim', 'head', 24, 16)
        shape(f'eye-amber.{side}', (sign * .084, -.459, .505), (.046, .008, .056), 'eye-amber', 'head', 24, 16)
        shape(f'eye-dark.{side}', (sign * .082, -.467, .509), (.042, .008, .052), 'eye-dark', 'head', 24, 16)
        shape(f'eye-glint.{side}', (sign * .082 - .011, -.477, .534), (.011, .004, .014), 'catchlight', 'head', 12, 8)
        shape(f'eye-glint-small.{side}', (sign * .082 + .012, -.478, .488), (.005, .003, .006), 'catchlight', 'head', 10, 6)
        shape(f'muzzle.{side}', (sign * .038, -.470, .426), (.052, .049, .041), 'cream', 'head', 24, 12)
        shape(f'cheek-blush.{side}', (sign * .128, -.444, .45), (.023, .008, .013), 'ear', 'head', 16, 8)
        for index in range(2):
            shape(f'whisker-root.{side}.{index}', (sign * (.055 + .018 * index), -.505 + .008 * index, .435), (.003, .0025, .003), 'cream-shade', 'head', 8, 6)
    shape('cat-chin', (0, -.467, .394), (.040, .035, .024), 'cream', 'head', 24, 12)
    mesh('nose', [(-.019, -.511, .444), (.019, -.511, .444), (0, -.521, .426), (0, -.504, .453)], [(0, 1, 2), (0, 3, 1), (0, 2, 3), (1, 3, 2)], 'nose', 'head')
    mark('smile-left', [(0, -.509, .427), (-.003, -.508, .414), (-.017, -.505, .41), (-.028, -.501, .417)], .0025, 'mouth', 'head')
    mark('smile-right', [(0, -.509, .427), (.003, -.508, .414), (.017, -.505, .41), (.028, -.501, .417)], .0025, 'mouth', 'head')
    for index, x in enumerate([-.048, 0, .048]):
        mark(f'forehead-stripe.{index}', [(x * .92, -.421, .594), (x, -.441, .575), (x * 1.05, -.448, .558)], .005 if index != 1 else .006, 'stripe', 'head')
    tail_points = []
    tail_radii = []
    curve = [Vector(tail[0]), *[Vector(point) for point in tail], Vector(tail[-1])]
    for index in range(len(tail) - 1):
        for step in range(4):
            factor = step / 4
            a, b, c, d = curve[index:index + 4]
            point = .5 * ((2 * b) + (-a + c) * factor + (2 * a - 5 * b + 4 * c - d) * factor ** 2 + (-a + 3 * b - 3 * c + d) * factor ** 3)
            tail_points.append(point)
            tail_radii.append(.036 - (index + factor) * .0072)
    tail_points.append(Vector(tail[-1]))
    tail_radii.append(.005)
    tail_obj = loft('cat-tail', tail_points, tail_radii, 'ginger', sides=16)
    skin_loft(tail_obj, tail, [f'tail.{index}' for index in range(len(tail) - 1)])
    for index in [1, 2, 3]:
        offset = index * 4 - 2
        a, b = tail_points[offset:offset + 2]
        loft(f'tail-stripe.{index}', [a, b], [tail_radii[offset] + .0005, tail_radii[offset + 1] + .0005], 'ginger-shade', f'tail.{index - 1}', 16)
    return legs


def warden_geometry():
    legs = {}
    for side, sign in [('L', -1), ('R', 1)]:
        legs[f'front.{side}'] = [(sign * .34, -.61, 1.62), (sign * .35, -.48, .96), (sign * .34, -.66, .17)]
        legs[f'hind.{side}'] = [(sign * .34, .65, 1.49), (sign * .36, .37, .89), (sign * .35, .77, .17)]
    tail = [(0, .94, 1.55), (0, 1.18, 1.42), (0, 1.24, 1.33)]
    rig('warden', (0, .30, 1.45), (0, -.68, 1.61), (0, -1.02, 2.27), legs, tail)
    loft('warden-body', [(0, 1.03, 1.48), (0, .90, 1.48), (0, .65, 1.50), (0, .30, 1.46), (0, -.12, 1.47), (0, -.48, 1.53), (0, -.70, 1.61), (0, -.81, 1.63)], [(.11, .12), (.29, .30), (.39, .38), (.37, .34), (.355, .37), (.40, .43), (.34, .37), (.18, .23)], 'stone', 'body', 14, False, .12)
    loft('warden-neck', [(0, -.66, 1.39), (0, -.80, 1.64), (0, -.91, 1.88), (0, -1.02, 2.10), (0, -1.035, 2.29)], [(.24, .29), (.265, .25), (.20, .21), (.151, .18), (.13, .14)], 'stone-light', 'neck', 12, False, .1)
    loft('warden-throat', [(0, -.875, 1.48), (0, -1.044, 1.76), (0, -1.146, 2.04)], [(.075, .03), (.12, .025), (.069, .017)], 'stone-warm', 'neck', 12, False)
    loft('warden-head', [(0, -.96, 2.31), (0, -1.10, 2.34), (0, -1.25, 2.29), (0, -1.43, 2.19), (0, -1.54, 2.14), (0, -1.60, 2.14)], [(.12, .13), (.174, .172), (.145, .15), (.100, .113), (.096, .075), (.062, .055)], 'stone-light', 'head', 12, False, .09)
    loft('warden-chin', [(0, -1.19, 2.15), (0, -1.39, 2.085), (0, -1.54, 2.095)], [(.085, .061), (.078, .06), (.054, .031)], 'stone-warm', 'head', 10, False)
    shape('warden-nose', (0, -1.585, 2.151), (.069, .027, .052), 'hoof', 'head', 12, 8, False)
    for side, sign in [('L', -1), ('R', 1)]:
        mark(f'warden-mouth.{side}', [(sign * .061, -1.582, 2.102), (sign * .086, -1.48, 2.087), (sign * .104, -1.392, 2.115)], .006, 'stone-shade', 'head')
        shape(f'warden-nostril.{side}', (sign * .041, -1.609, 2.169), (.012, .005, .009), 'eye-dark', 'head', 12, 8)
        eye = shape(f'warden-eye-rim.{side}', (sign * .139, -1.261, 2.322), (.066, .033, .047), 'eye-rim', 'head', 20, 12)
        center = sum((vertex.co for vertex in eye.data.vertices), Vector()) / len(eye.data.vertices)
        for vertex in eye.data.vertices:
            vertex.co = center + Matrix.Rotation(sign * .7, 4, 'Z') @ (vertex.co - center)
        eye = shape(f'warden-eye-amber.{side}', (sign * .151, -1.278, 2.325), (.049, .025, .032), 'eye-amber', 'head', 20, 12)
        center = sum((vertex.co for vertex in eye.data.vertices), Vector()) / len(eye.data.vertices)
        for vertex in eye.data.vertices:
            vertex.co = center + Matrix.Rotation(sign * .7, 4, 'Z') @ (vertex.co - center)
        eye = shape(f'warden-eye-pupil.{side}', (sign * .158, -1.29, 2.327), (.026, .022, .026), 'eye-dark', 'head', 16, 12)
        shape(f'warden-eye-glint.{side}', (sign * .157 - .007, -1.309, 2.339), (.009, .007, .010), 'catchlight', 'head', 10, 8)
        mark(f'warden-brow.{side}', [(sign * .113, -1.30, 2.372), (sign * .154, -1.262, 2.389), (sign * .182, -1.204, 2.370)], .024, 'stone-warm', 'head', 7)
        leaf(f'warden-ear.{side}', (sign * .111, -.997, 2.378), (sign * .405, -.959, 2.542), .094, 'stone', f'ear.{side}', (0, -1, .3))
        leaf(f'warden-ear-inner.{side}', (sign * .16, -1.014, 2.414), (sign * .374, -.98, 2.524), .051, 'ear', f'ear.{side}', (0, -1, .3))
    for name, points in legs.items():
        hind = name.startswith('hind')
        widths = [(.19, .24), (.18, .23), (.118, .145), (.087, .11), (.065, .083), (.055, .061), (.064, .068)] if hind else [(.14, .18), (.13, .16), (.081, .10), (.073, .09), (.061, .075), (.046, .055), (.06, .064)]
        limb(name, points, widths, 'stone', 10, False)
        a, b, c = [Vector(point) for point in points]
        mark(f'{name}.carved-line', [a + Vector((-.05, -.14, 0)), a.lerp(b, .47) + Vector((-.032, -.13, .035)), b + Vector((-.02, -.07, .07))], .012, 'stone-warm', f'{name}.upper', 6)
        for half, shift in [('inner', -.052), ('outer', .052)]:
            loft(f'{name}.hoof.{half}', [(c.x + shift, c.y - .024, .015), (c.x + shift, c.y - .027, .053), (c.x + shift, c.y - .012, .143), (c.x + shift, c.y, .179)], [(.046, .119), (.054, .128), (.047, .10), (.028, .071)], 'hoof', f'{name}.paw', 8, False)
    anatomy = fuse(['warden-body', *legs], 'warden-anatomy', .024)
    skin_body(anatomy, legs, 1.22, 1.53)
    for face in anatomy.data.polygons:
        face.use_smooth = False
    loft('warden-tail', tail, [(.06, .085), (.057, .08), (.007, .01)], 'stone-warm', 'tail.0', 10, False)
    for side, sign in [('L', -1), ('R', 1)]:
        antler = [(sign * .112, -.99, 2.425), (sign * .185, -.94, 2.57), (sign * .26, -.83, 2.73), (sign * .41, -.76, 2.86), (sign * .55, -.68, 3.015 if sign == -1 else 2.98)]
        loft(f'antler.{side}.main', antler, [.055, .054, .041, .028, .005], 'bark', 'head', 9, False)
        branches = [
            ([antler[1], (sign * .31, -1.025, 2.68), (sign * .39, -1.073, 2.80)], [.038, .022, .004]),
            ([antler[2], (sign * .25, -.67, 2.89), (sign * .30, -.61, 3.025)], [.031, .020, .003]),
            ([antler[3], (sign * .58, -.84, 2.91), (sign * .70, -.85, 2.958)], [.023, .016, .003]),
        ]
        if sign == 1:
            branches[1] = ([antler[2], (.31, -.64, 2.87), (.39, -.57, 2.947)], [.032, .019, .003])
            branches.append(([antler[1], (.16, -.79, 2.685), (.12, -.74, 2.748)], [.024, .015, .003]))
        for index, (points, widths) in enumerate(branches):
            loft(f'antler.{side}.branch.{index}', points, widths, 'bark-light' if index == 1 else 'bark', 'head', 8, False)
        for index, anchor in enumerate([antler[-1], branches[0][0][-1], branches[2][0][-1]]):
            for fan in range(3):
                a = Vector(anchor) - Vector((0, 0, .04))
                angle = -.8 + fan * .8
                end = a + Vector((sign * (.11 + .025 * fan), math.sin(angle) * .10, .075 + .035 * math.cos(angle)))
                leaf(f'antler-leaf.{side}.{index}.{fan}', a, end, .036, ['moss-dark', 'moss', 'moss-light'][fan], 'head', (0, -1, .8))
    for row in range(7):
        y = -.68 + row * .24
        width = .32 if row < 3 else .31 - (row - 3) * .021
        top = [2.04, 2.04, 1.98, 1.94, 1.94, 1.94, 1.90][row]
        for side, sign in [('L', -1), ('R', 1)]:
            for panel in range(3):
                x = sign * (.045 + panel * width / 3)
                fall = panel * .046
                base = (x * .87, y, top - fall)
                tip = (sign * (.15 + panel * .115), y + .23 + .016 * math.sin(row * 2 + panel), top - fall - .075 - .07 * panel)
                moss_plate(f'moss-mantle.{row}.{side}.{panel}', base, tip, .135, ('lichen' if row == 4 and panel == 1 else ['moss', 'moss-dark', 'moss-light'][(row + panel) % 3]), 'body', (sign * .35, 0, 1))
    for sign in [-1, 1]:
        for index in range(4):
            y = -.35 + index * .31
            mark(f'heartwood-seam.{sign}.{index}', [(sign * .345, y + .065, 1.36), (sign * .383, y + .015, 1.53), (sign * .31, y - .018, 1.70), (sign * .25, y + .035, 1.76)], .012, 'heartwood', 'body', 6)
            leaf(f'stone-facet.{sign}.{index}', (sign * .315, y, 1.61), (sign * .34, y + .17, 1.34), .11, 'stone-light' if index % 2 else 'stone-warm', 'body', (sign, 0, .1))
    loft('heartwood-cradle', [(0, .13, 1.75), (0, .17, 1.87), (0, .23, 2.05), (0, .24, 2.08)], [(.16, .14), (.15, .13), (.06, .05), (.01, .015)], 'bark', 'body', 10, False)
    loft('heartwood-seed', [(0, .12, 1.87), (0, .15, 1.99), (0, .19, 2.12), (0, .22, 2.17)], [(.065, .07), (.095, .09), (.055, .048), (.003, .003)], 'heartwood', 'body', 10, False)
    leaf('heartwood-seed-light', (-.04, .067, 1.955), (0, .184, 2.147), .027, 'heartwood-core', 'body', (0, -1, .4))
    for index in range(6):
        x = -.16 + index * .062
        leaf(f'neck-moss.{index}', (x, -.917, 1.76), (x * 1.23, -.998, 1.49 - .05 * math.sin(index)), .067, 'moss-dark' if index % 2 else 'moss', 'neck', (0, -1, .25))
    return legs


def consolidate(kind):
    obj = join_parts(list(PARTS), f'style-{kind}')
    obj.parent = RIG
    modifier = obj.modifiers.new('Creature skeleton', 'ARMATURE')
    modifier.object = RIG
    obj['authoredInBlender'] = True
    obj['creature'] = kind
    return obj


def smooth_value(phase, keys):
    for (a, start), (b, end) in zip(keys, keys[1:]):
        if phase <= b:
            t = max(0, min(1, (phase - a) / (b - a)))
            return start + (end - start) * t * t * (3 - 2 * t)
    return keys[-1][1]


def rotate(name, axis, angle):
    RIG.pose.bones[name].rotation_quaternion = Quaternion(axis, angle)


def limb_pose(name, upper_delta, bend):
    rotate(f'{name}.upper', (1, 0, 0), upper_delta)
    rotate(f'{name}.lower', (1, 0, 0), bend)


def pose(kind, clip, phase):
    for bone in RIG.pose.bones:
        bone.location = (0, 0, 0)
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.scale = (1, 1, 1)
    wave = math.sin(phase * math.tau)
    gentle = .018 if kind == 'cat' else .009
    rotate('neck', (1, 0, 0), gentle * wave)
    rotate('head', (0, 0, 1), gentle * .8 * wave)
    rotate('ear.L', (0, 1, 0), gentle * 1.3 * wave)
    rotate('ear.R', (0, 1, 0), -gentle * wave)
    for index in range(4 if kind == 'cat' else 2):
        rotate(f'tail.{index}', (0, 1, 0), gentle * (3 if kind == 'cat' else 1.5) * math.sin(phase * math.tau + index * .5))
    if clip == 'idle':
        RIG.pose.bones['body'].scale = (1 + .009 * wave, 1, 1 + .012 * wave)
    elif kind == 'cat':
        if clip == 'attack':
            preparation = smooth_value(phase, [(0, 0), (.28, -.17), (.46, .32), (.63, -.08), (.86, 0), (1, 0)])
            rotate('neck', (1, 0, 0), preparation * -.4)
            rotate('head', (1, 0, 0), preparation * -.25)
            limb_pose('front.R', preparation * 2.5, -preparation * 2.0)
            RIG.pose.bones['front.R.paw'].location = (0, preparation * -.22, max(0, preparation) * .32)
            rotate('tail.0', (0, 0, 1), preparation)
        elif clip == 'skill':
            preparation = smooth_value(phase, [(0, 0), (.30, -.13), (.58, .28), (.72, .13), (.92, 0), (1, 0)])
            rotate('neck', (1, 0, 0), preparation)
            rotate('head', (1, 0, 0), -preparation * .7)
            for side in ['L', 'R']:
                limb_pose(f'front.{side}', preparation, -preparation * 1.2)
                RIG.pose.bones[f'front.{side}.paw'].location = (0, 0, max(0, preparation) * .12)
            rotate('tail.1', (1, 0, 0), preparation * -1.6)
        elif clip == 'recover':
            amount = smooth_value(phase, [(0, .30), (.22, .36), (.64, .06), (1, 0)])
            rotate('neck', (1, 0, 0), amount)
            rotate('head', (0, 0, 1), amount * .6)
            for side in ['L', 'R']:
                limb_pose(f'front.{side}', amount * .30, -amount * .5)
                rotate(f'ear.{side}', (0, 1, 0), amount * (1 if side == 'L' else -1))
    else:
        if clip in ['charge', 'sweep', 'slam', 'roots']:
            anticipation = CLIPS[kind][clip]['anticipation']
            hit = CLIPS[kind][clip]['hit']
            strength = smooth_value(phase, [(0, 0), (anticipation, -.32), (hit, .50), (.72, .24), (CLIPS[kind][clip]['settle'], 0), (1, 0)])
            rotate('neck', (1, 0, 0), strength * (.9 if clip == 'charge' else -.6))
            rotate('head', (1, 0, 0), strength * .4)
            if clip == 'sweep':
                rotate('neck', (0, 0, 1), strength * 1.5)
                rotate('head', (0, 0, 1), strength * .5)
            if clip == 'slam':
                for side in ['L', 'R']:
                    limb_pose(f'front.{side}', strength * -.45, strength * .75)
                    RIG.pose.bones[f'front.{side}.paw'].location = (0, 0, max(0, -strength) * .75)
            if clip == 'charge':
                for side, sign in [('L', -1), ('R', 1)]:
                    limb_pose(f'front.{side}', strength * sign * .32, strength * sign * -.4)
                    limb_pose(f'hind.{side}', strength * -sign * .28, strength * sign * .35)
            if clip == 'roots':
                rotate('tail.0', (1, 0, 0), strength * .8)
                RIG.pose.bones['body'].scale = (1 + strength * .035, 1, 1 + strength * .024)
        elif clip == 'stagger':
            strength = smooth_value(phase, [(0, 0), (.17, .38), (.36, -.23), (.62, .10), (1, 0)])
            rotate('neck', (0, 0, 1), strength)
            rotate('head', (1, 0, 0), strength * .7)
            for side in ['L', 'R']:
                limb_pose(f'front.{side}', strength * .18, strength * -.21)
        elif clip == 'phase':
            strength = smooth_value(phase, [(0, 0), (.25, -.22), (.53, .38), (.75, .25), (1, 0)])
            rotate('neck', (1, 0, 0), -strength)
            rotate('head', (1, 0, 0), -strength * .6)
            for side, sign in [('L', -1), ('R', 1)]:
                rotate(f'ear.{side}', (0, 1, 0), strength * sign)
            rotate('tail.0', (1, 0, 0), strength)
        elif clip == 'defeat':
            strength = smooth_value(phase, [(0, 0), (.20, .07), (.62, .8), (1, 1)])
            rotate('neck', (1, 0, 0), strength * .65)
            rotate('head', (1, 0, 0), strength * .28)
            for side, sign in [('L', -1), ('R', 1)]:
                limb_pose(f'front.{side}', strength * -.48, strength * .64)
                limb_pose(f'hind.{side}', strength * .38, strength * -.5)
                rotate(f'ear.{side}', (0, 1, 0), strength * sign * -.2)
    bpy.context.view_layer.update()


def animate(kind):
    bpy.context.scene.render.fps = FPS
    RIG.animation_data_create()
    for name, definition in CLIPS[kind].items():
        frames = round(definition['duration'] * FPS)
        action = bpy.data.actions.new(name)
        RIG.animation_data.action = action
        for frame in range(frames + 1):
            pose(kind, name, frame / frames)
            for bone in RIG.pose.bones:
                bone.keyframe_insert('location', frame=frame)
                bone.keyframe_insert('rotation_quaternion', frame=frame)
                bone.keyframe_insert('scale', frame=frame)
        track = RIG.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, action)
        strip.action_frame_start = 0
        strip.action_frame_end = frames
        track.mute = True
        RIG.animation_data.action = None
    pose(kind, 'idle', 0)
    for bone in RIG.pose.bones:
        bone.rotation_quaternion = (1, 0, 0, 0)
    bpy.context.scene.frame_set(0)


def export(kind, obj, legs):
    output = ROOT / 'public' / 'wilds'
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(output / f'style-{kind}.glb'), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_range=False, export_force_sampling=True, export_skins=True, export_yup=True, export_extras=True, export_texcoords=False, export_materials='EXPORT')
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    minimum = [min(point[axis] for point in points) for axis in range(3)]
    maximum = [max(point[axis] for point in points) for axis in range(3)]
    obj.data.calc_loop_triangles()
    manifest = {
        'version': 1, 'generator': 'tools/blender/style_creatures.py', 'asset': f'style-{kind}.glb',
        'forward': '+Z', 'up': '+Y', 'feetY': round(minimum[2], 6),
        'bounds': {'min': [round(minimum[0], 6), round(minimum[2], 6), round(-maximum[1], 6)], 'max': [round(maximum[0], 6), round(maximum[2], 6), round(-minimum[1], 6)]},
        'heightMetres': round(maximum[2] - minimum[2], 6),
        'vertices': len(obj.data.vertices), 'triangles': len(obj.data.loop_triangles), 'joints': list(BONES),
        'clips': {name: {'durationMs': round(round(definition['duration'] * FPS) / FPS * 1000, 6), 'loop': definition['loop'], **{f'{key}Fraction': value for key, value in definition.items() if key not in ['duration', 'loop']}} for name, definition in CLIPS[kind].items()},
        'materialSlots': list(PALETTES[kind]), 'palette': PALETTES[kind],
        'contacts': {name: [point[2][0], 0, -point[2][1]] for name, point in legs.items()},
    }
    (output / f'style-{kind}-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def preview(kind, path):
    scene = bpy.context.scene
    target = Vector((0, -.08 if kind == 'cat' else -.16, .34 if kind == 'cat' else 1.45))
    bpy.ops.object.camera_add(location=(1.35, -2.3, 1.15) if kind == 'cat' else (4.5, -6.5, 3.5))
    camera = bpy.context.object
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 1.45 if kind == 'cat' else 3.85
    scene.camera = camera
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.006))
    floor = bpy.context.object
    material = bpy.data.materials.new('Preview floor')
    material.diffuse_color = (.21, .25, .20, 1)
    floor.data.materials.append(material)
    for location, energy, size in [((-3, -4, 7), 750, 5), ((4, -1, 5), 450, 4), ((-1, 5, 6), 950, 4)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = 'DISK'
        light.data.size = size
        light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.world = bpy.data.worlds.new('Preview air')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.35, .40, .42, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.view_settings.view_transform = 'AgX'
    scene.render.resolution_x = 960
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def build_style_creatures():
    manifests = {}
    for kind, generator in [('cat', cat_geometry), ('warden', warden_geometry)]:
        reset(kind)
        legs = generator()
        obj = consolidate(kind)
        base = min(vertex.co.z for vertex in obj.data.vertices)
        for vertex in obj.data.vertices:
            if vertex.co.z < (.10 if kind == 'cat' else .19):
                vertex.co.z -= base
        animate(kind)
        manifests[kind] = export(kind, obj, legs)
        if '--preview-dir' in sys.argv:
            directory = Path(sys.argv[sys.argv.index('--preview-dir') + 1])
            directory.mkdir(parents=True, exist_ok=True)
            preview(kind, directory / f'style-{kind}.png')
    return manifests


if __name__ == '__main__':
    build_style_creatures()
