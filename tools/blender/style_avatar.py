import bpy
import json
import math
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
FPS = 100
PALETTE = {
    'skin': '#d5a27e', 'skin-warm': '#c98a6b', 'cheek': '#ce947c',
    'hair': '#59402f', 'hair-light': '#71503b', 'hair-shadow': '#443226',
    'cardigan': '#b67e63', 'cardigan-shadow': '#95634f', 'cardigan-edge': '#c68f72',
    'shirt': '#ead8b3', 'trousers': '#71816c', 'trousers-seam': '#5c6e59',
    'boot': '#725341', 'boot-toe': '#89674e', 'sole': '#493e33',
    'button': '#d2b58b', 'eye-white': '#f5e9d5', 'eye': '#3c302a', 'pupil': '#241f1c',
    'glint': '#fff7e9', 'mouth': '#82503f',
}
CLIPS = {
    'idle': {'durationMs': 2400, 'loop': True},
    'attack1': {'durationMs': 420, 'hitMs': 180, 'loop': False},
    'attack2': {'durationMs': 460, 'hitMs': 200, 'loop': False},
    'attack3': {'durationMs': 620, 'hitMs': 300, 'loop': False},
    'dodge': {'durationMs': 580, 'loop': False},
    'hit': {'durationMs': 360, 'loop': False},
}
PARTS = {}
MATERIALS = {}
RIG = None
BONES = {}


def material(name, color):
    srgb = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    rgb = [value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4 for value in srgb]
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*rgb, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .88 if name not in ['eye', 'pupil', 'glint'] else .32
    return result


def finish(obj, group, paint, bone=None, smooth=True):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(MATERIALS[paint])
    if bone:
        obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    for face in obj.data.polygons:
        face.use_smooth = smooth
    PARTS.setdefault(group, []).append(obj)
    return obj


def surface(name, paint, vertices, faces, bone=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, paint, bone)


def oval(group, paint, bone, center, radii, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.scale = radii
    return finish(obj, group, paint, bone)


def soft_box(group, paint, bone, center, size, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new('Soft constructed edge', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 3
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, group, paint, bone)


def tube(group, paint, bone, points, radii, sides=16):
    if len(points) > 2:
        smooth_points = []
        smooth_radii = []
        vectors = [Vector(point) for point in points]
        sizes = [Vector(radius if isinstance(radius, tuple) else (radius, radius)) for radius in radii]
        for index in range(len(points) - 1):
            a, b, c, d = [vectors[min(len(points) - 1, max(0, offset))] for offset in [index - 1, index, index + 1, index + 2]]
            for step in range(4):
                t = step / 4
                smooth_points.append((b * 2 + (c - a) * t + (a * 2 - b * 5 + c * 4 - d) * t * t + (-a + b * 3 - c * 3 + d) * t * t * t) * .5)
                smooth_radii.append(tuple(sizes[index].lerp(sizes[index + 1], t)))
        points = smooth_points + [vectors[-1]]
        radii = smooth_radii + [tuple(sizes[-1])]
    vertices = []
    for index, point in enumerate(points):
        tangent = (Vector(points[min(len(points) - 1, index + 1)]) - Vector(points[max(0, index - 1)])).normalized()
        cross = tangent.cross(Vector((0, 1, 0)))
        if cross.length < .001:
            cross = tangent.cross(Vector((1, 0, 0)))
        cross.normalize()
        depth = tangent.cross(cross).normalized()
        rx, ry = radii[index] if isinstance(radii[index], tuple) else (radii[index], radii[index])
        for side in range(sides):
            angle = math.tau * side / sides
            vertices.append(Vector(point) + cross * math.cos(angle) * rx + depth * math.sin(angle) * ry)
    faces = [tuple(reversed(range(sides)))]
    for ring in range(len(points) - 1):
        for side in range(sides):
            start = ring * sides + side
            next_side = ring * sides + (side + 1) % sides
            faces.append((start, next_side, next_side + sides, start + sides))
    faces.append(tuple(range((len(points) - 1) * sides, len(points) * sides)))
    return surface(group, paint, vertices, faces, bone)


def profile(group, paint, bone, rings, sides=32):
    vertices = []
    for z, x, y, width, depth in rings:
        for index in range(sides):
            angle = math.tau * index / sides
            vertices.append((x + width * math.cos(angle), y + depth * math.sin(angle), z))
    faces = [tuple(reversed(range(sides)))]
    for ring in range(len(rings) - 1):
        for index in range(sides):
            start = ring * sides + index
            adjacent = ring * sides + (index + 1) % sides
            faces.append((start, adjacent, adjacent + sides, start + sides))
    faces.append(tuple(range((len(rings) - 1) * sides, len(rings) * sides)))
    if rings[-1][0] < rings[0][0]:
        faces = [tuple(reversed(face)) for face in faces]
    return surface(group, paint, vertices, faces, bone)


def line(group, paint, bone, points, radius=.003):
    return tube(group, paint, bone, points, [radius] * len(points), 8)


def weighted(obj, lower, upper, joint, blend=.075):
    low = obj.vertex_groups.new(name=lower)
    high = obj.vertex_groups.new(name=upper)
    for vertex in obj.data.vertices:
        z = (obj.matrix_world @ vertex.co).z
        amount = max(0, min(1, (z - joint + blend) / (blend * 2)))
        low.add([vertex.index], 1 - amount, 'REPLACE')
        high.add([vertex.index], amount, 'REPLACE')


def build_rig():
    global RIG, BONES
    BONES = {
        'pelvis': ((.018, .005, .795), (.018, .005, .975), None),
        'spine': ((.018, .005, .975), (0, 0, 1.282), 'pelvis'),
        'neck': ((0, 0, 1.282), (0, 0, 1.389), 'spine'),
        'head': ((0, 0, 1.389), (0, 0, 1.71), 'neck'),
    }
    for side, sign in [('L', -1), ('R', 1)]:
        ankle = (sign * .105, .026 if sign < 0 else -.018, .155)
        knee = (sign * .112, -.037 if sign < 0 else -.058, .475)
        hip = (sign * .105 + .018, .005, .795)
        shoulder = (sign * .207, 0, 1.245)
        elbow = (sign * .281, .003 if sign < 0 else .028, 1.046)
        wrist = (sign * .29, -.066 if sign < 0 else -.038, .86)
        BONES.update({
            f'thigh.{side}': (hip, knee, 'pelvis'),
            f'shin.{side}': (knee, ankle, f'thigh.{side}'),
            f'foot.{side}': (ankle, (ankle[0], ankle[1] - .18, .155), None),
            f'arm.{side}': (shoulder, elbow, 'spine'),
            f'forearm.{side}': (elbow, wrist, f'arm.{side}'),
            f'hand.{side}': (wrist, (wrist[0], wrist[1] - .023, .772), f'forearm.{side}'),
        })
    bpy.ops.object.armature_add(enter_editmode=True)
    RIG = bpy.context.object
    RIG.name = 'StorybookAvatarRig'
    bones = RIG.data.edit_bones
    bones.remove(bones[0])
    for name, (head, tail, parent) in BONES.items():
        bone = bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for bone in RIG.pose.bones:
        bone.rotation_mode = 'QUATERNION'


def face():
    profile('face', 'skin', 'head', [
        (1.361, 0, -.004, .044, .044),
        (1.372, 0, -.010, .071, .066),
        (1.391, 0, -.009, .102, .090),
        (1.427, 0, -.003, .135, .111),
        (1.467, 0, .003, .165, .132),
        (1.502, 0, .007, .175, .145),
        (1.539, 0, .010, .173, .151),
        (1.581, 0, .014, .169, .146),
        (1.627, 0, .018, .154, .133),
        (1.675, 0, .022, .122, .105),
        (1.704, 0, .023, .075, .064),
        (1.716, 0, .023, .018, .017),
    ], 48)
    profile('neck', 'skin', 'neck', [
        (1.266, 0, .009, .068, .060),
        (1.311, 0, .008, .059, .056),
        (1.361, 0, .006, .061, .056),
        (1.398, 0, .003, .075, .066),
    ])
    for sign in [-1, 1]:
        oval('ears', 'skin', 'head', (sign * .169, .010, 1.49), (.033, .027, .054))
        oval('ears', 'skin-warm', 'head', (sign * .187, -.006, 1.49), (.013, .015, .032))
        oval('eyes', 'eye-white', 'head', (sign * .068, -.131, 1.526), (.025, .014, .033))
        oval('eyes', 'eye', 'head', (sign * .069, -.143, 1.524), (.020, .008, .028))
        oval('eyes', 'pupil', 'head', (sign * .070, -.149, 1.525), (.011, .005, .020))
        oval('eyes', 'glint', 'head', (sign * .069 - .006, -.154, 1.536), (.006, .003, .008), 12, 8)
        oval('eyes', 'glint', 'head', (sign * .069 + .006, -.153, 1.514), (.0025, .002, .003), 10, 8)
        line('eyelids', 'hair-shadow', 'head', [(sign * x, y, z) for x, y, z in [(.042, -.137, 1.533), (.05, -.143, 1.552), (.066, -.144, 1.559), (.082, -.139, 1.551), (.092, -.131, 1.533)]], .003)
        line('brows', 'hair', 'head', [(sign * .04, -.133, 1.575), (sign * .056, -.137, 1.582), (sign * .077, -.134, 1.583), (sign * .097, -.124, 1.575)], .006)
        cheek_vertices = []
        for ring in [0, .33, .66, 1]:
            for index in range(24):
                theta = math.tau * index / 24
                x = sign * .108 + .028 * ring * math.cos(theta)
                z = 1.477 + .012 * ring * math.sin(theta)
                y = .004 - .136 * math.sqrt(max(0, 1 - (x / .168) ** 2)) - .0015
                cheek_vertices.append((x, y, z))
        cheek_faces = [(ring * 24 + index, ring * 24 + (index + 1) % 24, (ring + 1) * 24 + (index + 1) % 24, (ring + 1) * 24 + index) for ring in range(3) for index in range(24)]
        surface('cheeks', 'cheek', cheek_vertices, [tuple(reversed(face)) for face in cheek_faces], 'head')
    oval('nose', 'skin', 'head', (0, -.138, 1.509), (.013, .011, .030))
    oval('nose', 'skin', 'head', (0, -.154, 1.486), (.023, .027, .022))
    oval('nose', 'skin-warm', 'head', (0, -.172, 1.477), (.011, .004, .004), 16, 8)
    line('smile', 'mouth', 'head', [(-.027, -.112, 1.437), (-.017, -.120, 1.428), (0, -.124, 1.425), (.017, -.120, 1.428), (.027, -.112, 1.437)], .0032)
    line('smile', 'skin-warm', 'head', [(-.014, -.120, 1.416), (0, -.121, 1.413), (.014, -.120, 1.416)], .0025)


def soften_skin():
    objects = PARTS.pop('face') + PARTS.pop('neck')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    skin = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    remesh = skin.modifiers.new('Continuous jaw and neck', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = .004
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = skin.modifiers.new('Soft cheeks and chin', 'SMOOTH')
    smooth.factor = .55
    smooth.iterations = 3
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    simplify = skin.modifiers.new('Efficient skin topology', 'DECIMATE')
    simplify.ratio = .18
    simplify.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=simplify.name)
    skin.vertex_groups.clear()
    head = skin.vertex_groups.new(name='head')
    neck = skin.vertex_groups.new(name='neck')
    for vertex in skin.data.vertices:
        amount = max(0, min(1, (vertex.co.z - 1.315) / .074))
        amount = amount * amount * (3 - 2 * amount)
        if amount:
            head.add([vertex.index], amount, 'REPLACE')
        if amount < 1:
            neck.add([vertex.index], 1 - amount, 'REPLACE')
    PARTS['face'] = [skin]


def hair():
    vertices = []
    count = 64
    rings = 26
    center = Vector((0, .012, 1.53))
    for ring in range(rings):
        fraction = (ring + .02) / (rings - .98)
        for index in range(count):
            theta = math.tau * index / count
            front = max(0, -math.sin(theta))
            edge = 1.425 + .192 * front ** 3 + .027 * math.cos(theta) * front + .035 * max(0, math.sin(theta)) ** 2
            phi = math.acos((edge - center.z) / .220) * min(1, fraction)
            point = center + Vector((.199 * math.sin(phi) * math.cos(theta), .183 * math.sin(phi) * math.sin(theta), .220 * math.cos(phi)))
            vertices.append(point)
    faces = [tuple(reversed(range(count)))]
    for ring in range(rings - 1):
        for index in range(count):
            a = ring * count + index
            b = ring * count + (index + 1) % count
            faces.append((a + count, b + count, b, a))
    surface('hair-cap', 'hair', vertices, faces, 'head')
    for index in range(3):
        x = -.08 + index * .061
        points = [(x - .033, -.105, 1.709 - index * .007), (x + .014, -.151, 1.67 - index * .009), (x + .044, -.169, 1.626 - index * .011), (x + .056, -.162, 1.606 - index * .012)]
        points = [(px, .012 - .183 * math.sqrt(max(.001, 1 - (px / .199) ** 2 - ((pz - 1.53) / .220) ** 2)) - .002, pz) for px, py, pz in points]
        tube('hair-fringe', 'hair', 'head', points, [(.002, .001), (.023, .004), (.018, .005), (.001, .001)], 16)
    for sign in [-1, 1]:
        tube('hair-temples', 'hair', 'head', [(sign * .173, -.066, 1.592), (sign * .186, -.052, 1.543), (sign * .183, -.039, 1.485), (sign * .170, -.044, 1.458)], [(.026, .018), (.026, .016), (.017, .013), (.003, .003)], 16)
        for offset in [0, .025]:
            line('hair-strands', 'hair-light', 'head', [(sign * (.025 + offset), .059, 1.740 - offset * .3), (sign * (.083 + offset), .113, 1.700), (sign * (.114 + offset), .143, 1.625), (sign * (.127 + offset), .146, 1.550)], .0028)
    oval('hair-bun', 'hair', 'head', (.007, .143, 1.66), (.082, .069, .080), 28, 20)
    for offset in [-.035, 0, .035]:
        line('hair-bun', 'hair-light', 'head', [(offset, .172, 1.728 - abs(offset) * .4), (offset + .012, .206, 1.686), (offset + .009, .202, 1.632), (offset, .175, 1.598 + abs(offset) * .4)], .0035)
    tube('hair-tie', 'cardigan-edge', 'head', [(-.049, .172, 1.611), (0, .185, 1.602), (.055, .171, 1.613)], [.006, .006, .006], 12)


def torso():
    cardigan = profile('cardigan', 'cardigan', None, [
        (.766, .018, .007, .142, .090), (.784, .018, .005, .169, .109),
        (.81, .019, .004, .177, .113), (.856, .020, .003, .178, .115),
        (.930, .022, .002, .167, .106), (1.03, .017, .001, .170, .111),
        (1.13, .008, .001, .189, .120), (1.22, 0, .003, .203, .113),
        (1.267, 0, .003, .203, .087), (1.294, 0, .009, .147, .069),
        (1.318, 0, .010, .070, .055),
    ], 40)
    weighted(cardigan, 'pelvis', 'spine', .975, .18)
    profile('cardigan-hem', 'cardigan-shadow', 'pelvis', [(.786, .018, .003, .168, .109), (.792, .018, .003, .174, .115), (.817, .019, .003, .179, .116), (.824, .019, .003, .177, .114)], 40)
    shirt_rows = [(1.313, .059, .092, .058, .010), (1.290, .079, .158, .075, .008), (1.267, .076, .203, .087, .003), (1.220, .052, .203, .113, .003), (1.170, .022, .195, .119, .002), (1.143, .002, .190, .120, .001)]
    shirt_vertices = []
    for z, width, torso_width, depth, y in shirt_rows:
        for index in range(9):
            x = width * (index / 4 - 1)
            shirt_vertices.append((x, y - depth * math.sqrt(1 - (x / torso_width) ** 2) - .0025, z))
    shirt_faces = [(row * 9 + index, row * 9 + index + 1, (row + 1) * 9 + index + 1, (row + 1) * 9 + index) for row in range(len(shirt_rows) - 1) for index in range(8)]
    surface('shirt-inset', 'shirt', shirt_vertices, [tuple(reversed(face)) for face in shirt_faces], 'spine')
    for sign in [-1, 1]:
        points = [(sign * .066, -.044, 1.312), (sign * .092, -.080, 1.272), (sign * .065, -.114, 1.222), (sign * .028, -.129, 1.168), (.004, -.129, 1.137)]
        tube('collar', 'cardigan-edge', 'spine', points, [(.013, .007), (.021, .008), (.019, .008), (.017, .007), (.011, .005)], 12)
    placket = tube('cardigan-placket', 'cardigan-edge', None, [(.012, -.116, .804), (.022, -.108, .93), (.017, -.115, 1.037), (.005, -.127, 1.14)], [(.012, .004)] * 4, 10)
    weighted(placket, 'pelvis', 'spine', .975, .18)
    for z, x, y in [(.858, .02, -.122), (.942, .021, -.116), (1.025, .015, -.125), (1.108, .006, -.133)]:
        bone = 'pelvis' if z < .96 else 'spine'
        oval('buttons', 'button', bone, (x, y, z), (.008, .004, .009), 16, 10)
        for sign in [-1, 1]:
            oval('buttons', 'cardigan-shadow', bone, (x + sign * .0023, y - .004, z), (.0008, .0007, .0012), 8, 6)
    for sign in [-1, 1]:
        x = sign * .104 + .018
        pocket = soft_box('pockets', 'cardigan-edge', 'pelvis', (x, -.098, .886), (.070, .012, .079), .012)
        pocket.rotation_euler.z = sign * -.15
        line('pocket-welts', 'cardigan-shadow', 'pelvis', [(x - .029, -.108, .917), (x, -.114, .921), (x + .029, -.108, .917)], .003)
        line('cardigan-seams', 'cardigan-shadow', 'spine', [(sign * .151, -.074, 1.267), (sign * .160, -.083, 1.224), (sign * .168, -.080, 1.19)], .0018)
    for index in range(19):
        theta = math.pi + index * math.pi / 18
        x = .018 + .176 * math.cos(theta)
        y = .003 + .116 * math.sin(theta)
        line('hem-knit', 'cardigan-edge', 'pelvis', [(x, y, .794), (x, y - .0007, .814)], .0015)


def limbs():
    for side, sign in [('L', -1), ('R', 1)]:
        hip, knee = [Vector(point) for point in BONES[f'thigh.{side}'][:2]]
        ankle = Vector(BONES[f'shin.{side}'][1])
        leg = tube('trousers', 'trousers', None, [hip + Vector((0, 0, .042)), hip, hip.lerp(knee, .30), hip.lerp(knee, .70), hip.lerp(knee, .92), knee, knee.lerp(ankle, .12), knee.lerp(ankle, .32), knee.lerp(ankle, .72), ankle + Vector((0, 0, .02))], [(.095, .094), (.097, .096), (.088, .084), (.077, .074), (.074, .072), (.074, .072), (.073, .070), (.070, .065), (.060, .055), (.055, .050)], 28)
        weighted(leg, f'shin.{side}', f'thigh.{side}', knee.z, .105)
        cuff = tube('trouser-cuffs', 'trousers-seam', f'shin.{side}', [ankle + Vector((0, 0, .017)), ankle + Vector((0, 0, .048))], [(.057, .052), (.058, .054)], 20)
        seam_points = [point + Vector((sign * radius, 0, 0)) for point, radius in [(hip, .094), (hip.lerp(knee, .5), .083), (knee, .068), (knee.lerp(ankle, .6), .062), (ankle + Vector((0, 0, .045)), .056)]]
        seam = line('trouser-seams', 'trousers-seam', None, seam_points, .0023)
        weighted(seam, f'shin.{side}', f'thigh.{side}', knee.z, .07)
        shoulder, elbow = [Vector(point) for point in BONES[f'arm.{side}'][:2]]
        wrist = Vector(BONES[f'forearm.{side}'][1])
        sleeve = tube('sleeves', 'cardigan', None, [shoulder + Vector((-sign * .064, 0, .006)), shoulder + Vector((-sign * .008, 0, -.023)), shoulder.lerp(elbow, .26), shoulder.lerp(elbow, .66), elbow, elbow.lerp(wrist, .30), elbow.lerp(wrist, .68), wrist + Vector((0, 0, .01))], [(.043, .060), (.066, .071), (.073, .071), (.067, .063), (.062, .059), (.060, .057), (.053, .051), (.046, .043)], 28)
        weighted(sleeve, f'forearm.{side}', f'arm.{side}', elbow.z, .065)
        tube('sleeve-cuffs', 'cardigan-edge', f'forearm.{side}', [wrist + Vector((0, 0, -.013)), wrist + Vector((0, 0, -.004)), wrist + Vector((0, 0, .019)), wrist + Vector((0, 0, .037))], [(.041, .037), (.044, .040), (.048, .044), (.049, .045)], 28)
        for angle in [-.8, -.4, 0, .4, .8]:
            x = wrist.x + math.sin(angle) * .047
            y = wrist.y - math.cos(angle) * .042
            line('cuff-knit', 'cardigan-shadow', f'forearm.{side}', [(x, y, wrist.z + .002), (x, y, wrist.z + .029)], .0015)
        palm = wrist + Vector((0, -.010, -.048))
        profile('hands', 'skin', f'hand.{side}', [
            (wrist.z + .020, wrist.x, wrist.y, .039, .035),
            (wrist.z - .008, wrist.x, wrist.y - .004, .037, .031),
            (palm.z + .025, palm.x, palm.y, .039, .031),
            (palm.z, palm.x, palm.y - .001, .043, .028),
            (palm.z - .035, palm.x + sign * .002, palm.y - .008, .035, .024),
            (palm.z - .052, palm.x + sign * .005, palm.y - .012, .022, .017),
            (palm.z - .057, palm.x + sign * .005, palm.y - .012, .013, .009),
        ], 28)
        tube('thumbs', 'skin', f'hand.{side}', [palm + Vector((-sign * .023, -.013, .022)), palm + Vector((-sign * .041, -.025, .004)), palm + Vector((-sign * .040, -.031, -.015))], [.015, .016, .009], 16)
        for offset in [-.016, 0, .016]:
            line('finger-folds', 'skin-warm', f'hand.{side}', [palm + Vector((offset, -.027, -.020)), palm + Vector((offset + sign * .003, -.029, -.039))], .0014)
        foot(side, ankle)
    profile('trouser-hips', 'trousers', 'pelvis', [(.733, .018, .005, .159, .089), (.781, .018, .005, .166, .100), (.820, .018, .005, .153, .090)], 32)


def foot(side, ankle):
    x, y, z = ankle
    boot = profile('boots', 'boot', f'foot.{side}', [
        (.027, x, y - .060, .076, .129), (.045, x, y - .060, .077, .132),
        (.066, x, y - .061, .076, .128), (.096, x, y - .055, .073, .120),
        (.124, x, y - .032, .066, .096), (.160, x, y - .001, .056, .052),
        (.201, x, y + .003, .055, .050), (.216, x, y + .003, .053, .048),
    ], 28)
    profile('soles', 'sole', f'foot.{side}', [(0, x, y - .059, .071, .123), (.008, x, y - .059, .079, .133), (.028, x, y - .059, .080, .134), (.038, x, y - .059, .076, .129)], 28)
    line('boot-welts', 'button', f'foot.{side}', [(x + .077 * math.cos(index * math.tau / 32), y - .059 + .131 * math.sin(index * math.tau / 32), .039) for index in range(33)], .0028)
    line('boot-toe-seams', 'boot-toe', f'foot.{side}', [(x - .066, y - .11, .093), (x - .044, y - .134, .110), (x, y - .143, .117), (x + .044, y - .134, .110), (x + .066, y - .11, .093)], .003)
    for index in range(3):
        line('boot-laces', 'button', f'foot.{side}', [(x - .025, y - .048 - index * .020, .171 - index * .017), (x + .025, y - .046 - index * .020, .171 - index * .017)], .0026)
    soft_box('boot-pull', 'boot-toe', f'foot.{side}', (x, y + .049, .209), (.022, .013, .035), .003)


def sew_cardigan():
    objects = PARTS.pop('cardigan') + PARTS.pop('sleeves')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    garment = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    remesh = garment.modifiers.new('Continuous tailored fabric', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = .006
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = garment.modifiers.new('Relaxed fabric surface', 'SMOOTH')
    smooth.factor = .65
    smooth.iterations = 4
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    simplify = garment.modifiers.new('Efficient fabric topology', 'DECIMATE')
    simplify.ratio = .22
    simplify.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=simplify.name)
    garment.vertex_groups.clear()
    groups = {name: garment.vertex_groups.new(name=name) for name in ['pelvis', 'spine', 'arm.L', 'forearm.L', 'arm.R', 'forearm.R']}
    for vertex in garment.data.vertices:
        point = vertex.co
        shoulder_blend = max(0, min(1, (point.z - 1.16) / .12))
        sleeve = max(0, min(1, (abs(point.x) - (.205 - .070 * shoulder_blend)) / .035))
        sleeve = sleeve * sleeve * (3 - 2 * sleeve)
        side = 'L' if point.x < 0 else 'R'
        upper = max(0, min(1, (point.z - 1.046 + .065) / .13))
        torso = max(0, min(1, (point.z - .975 + .18) / .36))
        weights = {'pelvis': (1 - sleeve) * (1 - torso), 'spine': (1 - sleeve) * torso, f'arm.{side}': sleeve * upper, f'forearm.{side}': sleeve * (1 - upper)}
        for name, weight in weights.items():
            if weight > 0:
                groups[name].add([vertex.index], weight, 'REPLACE')
    PARTS['cardigan'] = [garment]


def combine():
    for name, objects in PARTS.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = name
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.parent = RIG
        modifier = obj.modifiers.new('Storybook skin', 'ARMATURE')
        modifier.object = RIG
        obj['stylePart'] = name
    bpy.ops.object.select_all(action='DESELECT')
    RIG.select_set(True)
    bpy.context.view_layer.objects.active = RIG


def curve(phase, points):
    for (start, a), (end, b) in zip(points, points[1:]):
        if phase <= end:
            t = max(0, (phase - start) / (end - start))
            return a + (b - a) * t * t * (3 - 2 * t)
    return points[-1][1]


def set_bone(name, head, tail, twist=0):
    direction = (Vector(tail) - Vector(head)).normalized()
    rest = RIG.data.bones[name].matrix_local
    rotation = (rest.col[1].xyz.rotation_difference(direction) @ rest.to_quaternion()).to_matrix().to_4x4()
    if twist:
        from mathutils import Quaternion
        rotation = Quaternion(direction, twist).to_matrix().to_4x4() @ rotation
    RIG.pose.bones[name].matrix = Matrix.Translation(Vector(head)) @ rotation
    bpy.context.view_layer.update()


def two_bone(side, upper_name, lower_name, start, end, bend):
    a = Vector(start)
    c = Vector(end)
    rest_a, rest_b = map(Vector, BONES[f'{upper_name}.{side}'][:2])
    rest_c = Vector(BONES[f'{lower_name}.{side}'][1])
    first = (rest_b - rest_a).length
    second = (rest_c - rest_b).length
    delta = c - a
    distance = min(delta.length, (first + second) * .998)
    direction = delta.normalized()
    along = (first * first - second * second + distance * distance) / (2 * distance)
    across = Vector(bend)
    across = (across - direction * across.dot(direction)).normalized()
    middle = a + direction * along + across * math.sqrt(max(.00001, first * first - along * along))
    set_bone(f'{upper_name}.{side}', a, middle)
    set_bone(f'{lower_name}.{side}', middle, c)
    return middle


def pose(name, phase):
    for bone in RIG.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    breathing = math.sin(phase * math.tau) if name == 'idle' else 0
    torso_shift = Vector((.002 * breathing, -.0015 * breathing, .0015 * breathing))
    twist = .012 * breathing
    lean = 0
    attack = name.startswith('attack')
    strength = 0
    anticipation = 0
    if attack:
        hit = CLIPS[name]['hitMs'] / CLIPS[name]['durationMs']
        anticipation = curve(phase, [(0, 0), (hit * .68, 1), (hit, 0), (1, 0)])
        strength = curve(phase, [(0, 0), (hit * .68, 0), (hit, 1), (hit + (1 - hit) * .36, .7), (1, 0)])
        direction = -1 if name == 'attack2' else 1
        twist = direction * (.24 * anticipation - .31 * strength)
        lean = .042 * strength - .024 * anticipation
        torso_shift += Vector((direction * .025 * strength, -lean, -.015 * strength))
    if name == 'hit':
        strength = curve(phase, [(0, 0), (.26, 1), (.62, .32), (1, 0)])
        torso_shift += Vector((-.024 * strength, .060 * strength, -.02 * strength))
        lean = -.07 * strength
    if name == 'dodge':
        strength = math.sin(math.pi * phase) ** 2
        torso_shift += Vector((-.12 * strength, .055 * strength, -.15 * strength))
        lean = .10 * strength
        twist = -.22 * strength
    pelvis_head = Vector(BONES['pelvis'][0]) + torso_shift
    pelvis_tail = Vector(BONES['pelvis'][1]) + torso_shift
    set_bone('pelvis', pelvis_head, pelvis_tail, twist * .3)
    spine_tail = Vector(BONES['spine'][1]) + torso_shift + Vector((0, -lean, .002 * breathing))
    set_bone('spine', pelvis_tail, spine_tail, twist)
    neck_tail = spine_tail + Vector((0, 0, .107))
    set_bone('neck', spine_tail, neck_tail)
    set_bone('head', neck_tail, neck_tail + Vector((-.005 * breathing, .008 * breathing, .321)), twist * -.25)
    for side, sign in [('L', -1), ('R', 1)]:
        hip = Vector(BONES[f'thigh.{side}'][0]) + torso_shift
        ankle = Vector(BONES[f'shin.{side}'][1])
        two_bone(side, 'thigh', 'shin', hip, ankle, (sign * .05, -1, 0))
        set_bone(f'foot.{side}', ankle, Vector(BONES[f'foot.{side}'][1]))
        shoulder = Vector(BONES[f'arm.{side}'][0]) + torso_shift + Vector((0, -lean, 0))
        shoulder.y += sign * .17 * twist
        wrist = Vector(BONES[f'forearm.{side}'][1]) + torso_shift + Vector((sign * .002 * breathing, 0, 0))
        if attack:
            active = side == ('L' if name == 'attack2' else 'R') or name == 'attack3'
            if active:
                wrist += Vector((sign * (-.11 * strength + .04 * anticipation), -.31 * strength + .09 * anticipation, .19 * strength + (.17 if name == 'attack3' else .06) * anticipation))
            else:
                wrist += Vector((-sign * .06 * strength, -.08 * strength, .12 * strength))
        if name == 'hit':
            wrist += Vector((sign * .04 * strength, -.06 * strength, .10 * strength))
        if name == 'dodge':
            wrist += Vector((-sign * .055 * strength, -.08 * strength, .14 * strength))
        elbow = two_bone(side, 'arm', 'forearm', shoulder, wrist, (sign * .30, .45, 0))
        set_bone(f'hand.{side}', wrist, wrist + (wrist - elbow).normalized() * .091)
    bpy.context.view_layer.update()


def animate():
    bpy.context.scene.render.fps = FPS
    RIG.animation_data_create()
    for name, clip in CLIPS.items():
        frames = round(clip['durationMs'] * FPS / 1000)
        action = bpy.data.actions.new(name)
        RIG.animation_data.action = action
        for frame in range(frames + 1):
            pose(name, frame / frames)
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
    for bone in RIG.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.scene.frame_set(0)


def preview(path, clip=None, phase=0):
    if clip:
        pose(clip, phase)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 1300
    scene.render.resolution_percentage = 100
    scene.world.color = (.18, .18, .18)
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.mesh.primitive_plane_add(size=200)
    ground = bpy.context.object
    ground_mat = material('Preview ground', '#e0d5bf')
    ground.data.materials.append(ground_mat)
    bpy.ops.object.camera_add(location=(2.8, -6.5, 2.45))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, .90)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.10
    scene.camera = camera
    for location, power, size in [((-3, -4, 6), 480, 4.0), ((3, -2, 3), 220, 3.0), ((1, 3, 4), 320, 3.0)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        lamp = bpy.context.object
        lamp.data.energy = power
        lamp.data.shape = 'DISK'
        lamp.data.size = size
        lamp.rotation_euler = (Vector((0, 0, .8)) - lamp.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def build_style_avatar(output_dir=None):
    global PARTS, MATERIALS
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for datablocks in [bpy.data.materials, bpy.data.meshes, bpy.data.armatures]:
        for old_data in list(datablocks):
            datablocks.remove(old_data)
    PARTS = {}
    MATERIALS = {name: material(name, color) for name, color in PALETTE.items()}
    build_rig()
    face()
    soften_skin()
    hair()
    torso()
    limbs()
    sew_cardigan()
    combine()
    animate()
    output = Path(output_dir) if output_dir else ROOT / 'public' / 'wilds'
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(output / 'style-avatar.glb'), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_range=False, export_force_sampling=True, export_skins=True, export_yup=True, export_extras=True, export_texcoords=False, export_materials='EXPORT')
    vertices = [obj.matrix_world @ vertex.co for obj in bpy.context.scene.objects if obj.type == 'MESH' for vertex in obj.data.vertices]
    minimum = [min(point[axis] for point in vertices) for axis in range(3)]
    maximum = [max(point[axis] for point in vertices) for axis in range(3)]
    manifest = {
        'version': 1, 'generator': 'tools/blender/style_avatar.py', 'asset': 'style-avatar.glb',
        'forward': '+Z', 'up': '+Y', 'feetY': 0, 'heightMetres': round(maximum[2] - minimum[2], 6),
        'headHeightMetres': .389, 'headCount': round((maximum[2] - minimum[2]) / .389, 3),
        'bounds': {'min': [minimum[0], minimum[2], -maximum[1]], 'max': [maximum[0], maximum[2], -minimum[1]]},
        'clips': CLIPS, 'materialSlots': list(PALETTE), 'palette': PALETTE, 'joints': list(BONES),
        'meshGroups': list(PARTS), 'style': {'skin': 'warm', 'hair': 'chestnut bun', 'top': 'clay cardigan', 'bottom': 'sage trousers', 'shoes': 'brown lace-up boots'},
        'defaultClip': 'idle', 'defaultFrame': 0,
        'footContacts': {'L': {'bone': 'foot.L', 'position': [-.105, 0, .033]}, 'R': {'bone': 'foot.R', 'position': [.105, 0, .077]}},
        'scope': 'single styleframe, original Blender geometry',
    }
    (output / 'style-avatar-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    import sys
    build_style_avatar()
    if '--preview' in sys.argv:
        target = Path(sys.argv[sys.argv.index('--preview') + 1])
        clip = sys.argv[sys.argv.index('--clip') + 1] if '--clip' in sys.argv else None
        phase = float(sys.argv[sys.argv.index('--phase') + 1]) if '--phase' in sys.argv else 0
        preview(target, clip, phase)
