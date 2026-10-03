import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT.parent / 'wilds-assets' / 'progress-shots' / 'wilds-three-codex' / 'stage4-blender'
OUTPUT.mkdir(parents=True, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
FPS = 60
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):
    bpy.data.materials.remove(data)


def tone(value):
    return tuple((int(value[i:i + 2], 16) / 255) ** 2.2 for i in (1, 3, 5)) + (1,)


def material(name, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    color = nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Col'
    mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    shader.inputs['Roughness'].default_value = .82
    if emission:
        shader.inputs['Emission Color'].default_value = tone('#ffac43')
        shader.inputs['Emission Strength'].default_value = emission
    return mat


MATERIALS = {name: material(name, glow) for name, glow in [('Heartwood', 0), ('LichenStone', 0), ('SpringGrowth', 0), ('AmberHeart', .85)]}
BUFFERS = {name: {'v': [], 'f': [], 'c': [], 'w': []} for name in MATERIALS}


def mesh_part(name, vertices, faces, color, weights, variation=.04):
    buf = BUFFERS[name]
    start = len(buf['v'])
    base = tone(color) if isinstance(color, str) else color
    for i, vertex in enumerate(vertices):
        buf['v'].append(tuple(vertex))
        shade = 1 + math.sin(vertex[0] * 19 + vertex[1] * 23 + vertex[2] * 17) * variation
        if name=='Heartwood':
            shade *= .75 + .15 * math.sin(vertex[1]*27+math.sin(vertex[2]*19)+vertex[0]*17)
        if name=='SpringGrowth' and base[1]>base[0]*1.15:
            shade *= .74
        buf['c'].append(tuple(min(1, max(0, channel * shade)) for channel in base[:3]) + (1,))
        raw = weights(vertex) if callable(weights) else weights
        total = sum(raw.values())
        buf['w'].append({bone: value / total for bone, value in sorted(raw.items(), key=lambda item: -item[1])[:4]})
    buf['f'].extend(tuple(start + index for index in face) for face in faces)


def loft(name, centers, radii, color, weights, sides=16, ridge=.025):
    vertices = []
    for ring, (center, radius) in enumerate(zip(centers, radii)):
        c = Vector(center)
        tangent = Vector(centers[min(ring + 1, len(centers) - 1)]) - Vector(centers[max(0, ring - 1)])
        tangent.normalize()
        reference = Vector((1, 0, 0)) if abs(tangent.x) < .8 else Vector((0, 1, 0))
        u = (reference - tangent * reference.dot(tangent)).normalized()
        v = tangent.cross(u).normalized()
        for side in range(sides):
            angle = side * math.tau / sides
            noise = 1 + ridge * math.sin(angle * 7 + ring * 1.31) + ridge * .6 * math.sin(angle * 11 - ring)
            vertices.append(c + u * math.cos(angle) * radius[0] * noise + v * math.sin(angle) * radius[1] * noise)
    faces = []
    for ring in range(len(centers) - 1):
        for side in range(sides):
            a = ring * sides + side
            b = ring * sides + (side + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(centers) - 1) * sides + i for i in range(sides)))
    mesh_part(name, vertices, faces, color, weights)


def bezier(a, b, c, d, steps=10):
    return [Vector(a) * (1 - t) ** 3 + Vector(b) * 3 * t * (1 - t) ** 2 + Vector(c) * 3 * t * t * (1 - t) + Vector(d) * t ** 3 for t in [i / steps for i in range(steps + 1)]]


def branch(points, radius, bone, color='#796342', sides=9):
    radii = [(max(.012, radius * (1 - i / (len(points) - 1)) + .01),) * 2 for i in range(len(points))]
    loft('Heartwood', points, radii, color, {bone: 1}, sides, .08)


def petal(center, scale, bone, color='#eee8d1', yaw=0):
    c = Vector(center)
    outline = [(0, 0, 0), (-.4, .24, .035), (-.25, .64, .07), (0, 1, .12), (.25, .64, .07), (.4, .24, .035)]
    vertices = [c + Vector((math.cos(yaw) * p[0] - math.sin(yaw) * p[1], math.sin(yaw) * p[0] + math.cos(yaw) * p[1], p[2])) * scale for p in outline]
    mesh_part('SpringGrowth', vertices, [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 5)], color, {bone: 1})


def flower(center, size, bone):
    for i in range(5):
        petal(center, size, bone, yaw=i * math.tau / 5)


def plate(center, scales, bone, seed, color='#a0a18a'):
    vertices = []
    sides = 9
    for level in range(5):
        angle_z = (level / 4 - .5) * math.pi
        for side in range(sides):
            a = side * math.tau / sides
            irregular = 1 + .12 * math.sin(a * 3 + seed) + .07 * math.sin(a * 5 - seed)
            vertices.append((center[0] + math.cos(a) * math.cos(angle_z) * scales[0] * irregular, center[1] + math.sin(a) * math.cos(angle_z) * scales[1] * irregular, center[2] + math.sin(angle_z) * scales[2]))
    faces = []
    for level in range(4):
        for side in range(sides):
            a = level * sides + side
            b = level * sides + (side + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    mesh_part('LichenStone', vertices, faces, color, {bone: 1}, .09)
    for i in range(9):
        a = i * 2.399 + seed
        x = center[0] + math.cos(a) * scales[0] * .65
        y = center[1] + math.sin(a) * scales[1] * .65
        z = center[2] + scales[2] * .76
        petal((x, y, z), .07 + (i % 3) * .02, bone, '#71844d', a)


bones = [
    ('root', (0, 0, 0), (0, 0, .4), None),
    ('pelvis', (0, -.65, 2.05), (0, -.25, 2.15), 'root'),
    ('spine', (0, -.25, 2.15), (0, .55, 2.38), 'pelvis'),
    ('chest', (0, .55, 2.38), (0, .83, 2.68), 'spine'),
    ('neck', (0, .83, 2.68), (0, 1.18, 3.07), 'chest'),
    ('head', (0, 1.18, 3.07), (0, 1.78, 3.22), 'neck'),
    ('jaw', (0, 1.40, 3.05), (0, 1.98, 2.96), 'head'),
    ('heart', (0, .89, 2.28), (0, 1.04, 2.28), 'chest'),
    ('rib-L', (.20, .77, 2.20), (.55, 1.02, 2.3), 'chest'),
    ('rib-R', (-.20, .77, 2.20), (-.55, 1.02, 2.3), 'chest'),
    ('tail', (0, -1.03, 2.2), (0, -1.48, 2.03), 'pelvis')]
LEGS = {}
for label, x, y, knee_y in [('Front-L', .54, .68, .79), ('Front-R', -.54, .68, .79), ('Hind-L', .53, -.82, -.54), ('Hind-R', -.53, -.82, -.54)]:
    hip = (x, y, 2.25)
    knee = (x, knee_y, 1.18)
    ankle = (x, y + (.1 if label.startswith('Front') else -.12), .25)
    hoof = (x, ankle[1] + .045, .07)
    LEGS[label] = (hip, knee, ankle, hoof)
    parent = 'chest' if label.startswith('Front') else 'pelvis'
    bones.extend([(label + '-upper', hip, knee, parent), (label + '-lower', knee, ankle, label + '-upper'), (label + '-hoof', ankle, hoof, label + '-lower'), ('CTRL-' + label, ankle, hoof, None)])
for side in [-1, 1]:
    label = 'L' if side > 0 else 'R'
    bones.extend([('ear-' + label, (side * .26, 1.29, 3.27), (side * .69, 1.20, 3.39), 'head'), ('antler-' + label, (side * .23, 1.28, 3.39), (side * .62, 1.05, 4.02), 'head'), ('antler-tip-' + label, (side * 2.14, .86, 4.32), (side * 2.31, .91, 4.43), 'antler-' + label)])
for i in range(12):
    x = math.sin(i * 2.399) * .6
    y = math.cos(i * 2.399) * .9
    bones.append(('blossom-' + str(i), (x, y, 2.45), (x, y, 2.60), 'spine'))

arm_data = bpy.data.armatures.new('MossheartRig')
rig = bpy.data.objects.new('Mossheart', arm_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, head, tail, parent in bones:
    bone = arm_data.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent:
        bone.parent = arm_data.edit_bones[parent]
    if name.startswith('CTRL-'):
        bone.use_deform = False
bpy.ops.object.mode_set(mode='OBJECT')
for label in LEGS:
    constraint = rig.pose.bones[label + '-lower'].constraints.new('IK')
    constraint.target = rig
    constraint.subtarget = 'CTRL-' + label
    constraint.chain_count = 2
    constraint.use_tail = True
    constraint.iterations = 64
    constraint.use_stretch = False
    level = rig.pose.bones[label + '-hoof'].constraints.new('COPY_ROTATION')
    level.target = rig
    level.subtarget = 'CTRL-' + label
    level.target_space = 'WORLD'
    level.owner_space = 'WORLD'


def torso_weights(vertex):
    y = vertex[1]
    if y < -.2:
        t = min(1, max(0, (y + .85) / .65))
        return {'pelvis': 1 - t * .65, 'spine': t * .65}
    t = min(1, max(0, (y + .2) / 1.0))
    return {'spine': 1 - t * .8, 'chest': t * .8}


centers = []
radii = []
for i in range(25):
    t = i / 24
    y = -1.10 + t * 2.04
    width = .18 + math.sin(t * math.pi) ** .65 * .52
    height = .25 + math.sin(t * math.pi) ** .7 * .51
    center_z = 2.03 + .24 * math.exp(-((t - .78) / .21) ** 2)
    centers.append((0, y, center_z))
    radii.append((width, height))
loft('Heartwood', centers, radii, '#716347', torso_weights, 32, .035)
neck_points = bezier((0, .53, 2.43), (0, .88, 2.75), (0, .91, 3.12), (0, 1.20, 3.24), 16)
loft('Heartwood', neck_points, [(.30 - i / 16 * .13, .36 - i / 16 * .14) for i in range(17)], '#716348', lambda v: {'chest': max(0, min(1, (2.95 - v[2]) / .5)), 'neck': max(0, min(1, (v[2] - 2.45) / .5))}, 24, .04)
head_points = [(0, 1.08 + i / 16 * 1.13, 3.27 - i / 16 * .30 + math.sin(i / 16 * math.pi) * .06) for i in range(17)]
loft('Heartwood', head_points, [(.062 + .165 * math.exp(-((i/16-.28)/.25)**2) + .035 * math.exp(-((i/16-.72)/.18)**2), .065 + .17 * math.exp(-((i/16-.30)/.30)**2)) for i in range(17)], '#8a795b', {'head': 1}, 24, .065)
loft('Heartwood', [(0, 1.35, 3.08), (0, 1.58, 3.015), (0, 1.88, 2.97), (0, 2.04, 3.02)], [(.095, .085), (.11, .075), (.075, .065), (.058, .04)], '#615742', {'jaw': 1}, 16)
for side in [-1, 1]:
    label = 'L' if side > 0 else 'R'
    loft('Heartwood', bezier((side * .23, 1.29, 3.27), (side * .41, 1.19, 3.46), (side * .78, 1.08, 3.41), (side * .91, 1.13, 3.23), 8), [(.005 + math.sin(i / 8 * math.pi) * .18, .007 + math.sin(i/8*math.pi)*.03) for i in range(9)], '#8b7858', {'ear-' + label: 1}, 12)
    plate((side * .245, 1.44, 3.30), (.045, .14, .045), 'head', side + 1, '#37413b')
    loft('AmberHeart', [(side * .273, 1.50, 3.292), (side * .284, 1.56, 3.289)], [(.026, .012), (.021, .009)], '#d4bd70', {'head': 1}, 10)

for label, (hip, knee, ankle, hoof) in LEGS.items():
    fore = label.startswith('Front')
    loft('Heartwood', bezier(hip, (hip[0], hip[1] + .06, 1.94), (knee[0], knee[1] - .04, 1.45), knee, 12), [(.105 + math.sin(i / 12 * math.pi) * (.075 if fore else .125) + (1 - i / 12) * .04, .10 + math.sin(i / 12 * math.pi) * .13) for i in range(13)], '#756648', {label + '-upper': 1}, 16, .10)
    loft('Heartwood', bezier(knee, (knee[0], knee[1] - .05, .94), (ankle[0], ankle[1] + .04, .48), ankle, 10), [(.065 + .025 * math.exp(-((i / 10 - .16) / .22) ** 2) + .025 * math.exp(-((i / 10 - .83) / .12) ** 2), .058 + .018 * math.sin(i / 10 * math.pi)) for i in range(11)], '#867555', {label + '-lower': 1}, 14)
    for split in [-1, 1]:
        x = hoof[0] + split * .063
        loft('LichenStone', [(x, hoof[1] -.09, .13), (x, hoof[1], .13), (x, hoof[1] + .18, .115)], [(.055, .105), (.07, .115), (.05, .085)], '#51584b', {label + '-hoof': 1}, 12)
    loft('Heartwood', [(ankle[0], ankle[1], .32), (ankle[0], ankle[1]+.025, .23), (ankle[0], ankle[1]+.04, .15)], [(.063,.056),(.08,.064),(.065,.05)], '#6c5b42', {label+'-hoof':1}, 14)
    plate(knee,(.115,.13,.13),label+'-lower',len(label),'#767c69')
    plate((hip[0], hip[1], hip[2] - .18), (.19, .24, .27), label + '-upper', len(label), '#65715d')

for side in [-1, 1]:
    for i in range(11):
        y=-.93+i*.16+math.sin(i*2.3)*.025
        z=2.10+math.sin(i/10*math.pi)*.34+math.sin(i*1.7)*.13
        bone='pelvis' if y<-.25 else 'spine'
        plate((side*(.44+math.sin(i/10*math.pi)*.13),y,z),(.10+(i%3)*.025,.17+(i%4)*.028,.09+(i%4)*.033),bone,i+side*2,['#5d6957','#737864','#4c5b4d'][i%3])
        if i%2==0:
            branch(bezier((side*.51,y,1.98),(side*.63,y+.07,2.09),(side*.62,y+.03,2.39),(side*.40,y,2.59),8),.026,bone,'#68583b',8)
        for j in range(3):
            petal((side*(.55+math.sin(i/10*math.pi)*.08),y-.10+j*.095,z+.075),.13+(i%3)*.018,bone,'#465d35',side*.7+j*.8)
    label = 'L' if side > 0 else 'R'
    for i in range(5):
        y = .65 + i * .075
        branch(bezier((side * .30, y, 2.58), (side * .59, y + .16, 2.38), (side * .45, y + .19, 2.05), (side * .14, y + .20, 2.01), 10), .053, 'rib-' + label, '#927751', 9)
    branch(bezier((side * .10, .74, 2.04), (side * .31, .92, 1.88), (side * .25, 1.06, 2.20), (side * .15, 1.08, 2.45), 8), .051, 'rib-' + label, '#a38550', 8)
loft('AmberHeart', [(0,1.015,2.09),(0,1.04,2.19),(0,1.065,2.30),(0,1.035,2.41),(0,1.01,2.49)],[(.075,.08),(.15,.12),(.18,.15),(.13,.10),(.045,.05)],'#e9a649',{'heart':1},24,.07)
branch([(.20*math.sin(i*math.tau/24),1.11,2.29+.22*math.cos(i*math.tau/24)) for i in range(25)],.021,'heart','#8b6330',8)
for i in range(8):
    plate((math.sin(i * 2.399) * .18, .99, 2.15 + i * .035), (.07, .035, .09), 'chest', i, '#b5a27b')
branch(bezier((0, -1.04, 2.24), (0, -1.23, 2.18), (.07, -1.44, 2.07), (0, -1.51, 1.95), 9), .1, 'tail')

for side in [-1, 1]:
    label = 'L' if side > 0 else 'R'
    bone = 'antler-' + label
    main=bezier((side*.23,1.28,3.39),(side*.47,1.04,3.84),(side*1.28,.55,4.02),(side*2.25,.89,4.41),22)
    branch(main,.092,bone,'#78684b',12)
    for i in range(1,8):
        a=main[2+i*2]
        direction=1 if i%2 else -1
        tip=(a.x+side*(.10+i*.035),a.y+direction*(.26+i%3*.12),min(4.5,a.z+.24+i%3*.1))
        curve=bezier(a,(a.x+side*.04,a.y+direction*.13,a.z+.1),(tip[0]-side*.07,tip[1],tip[2]-.1),tip,12)
        branch(curve,.052-i*.003,bone,'#8d7955',9)
        if i in (2,4,6):
            fork=curve[6]
            end=(fork.x-side*.08,fork.y-direction*.24,min(4.5,fork.z+.22))
            branch(bezier(fork,(fork.x,fork.y-direction*.08,fork.z+.1),(end[0],end[1],end[2]-.03),end,8),.025,bone,'#95815f',7)
    for i in range(90):
        a = main[(i * 7) % len(main)]
        angle = i * 2.399
        p = (a.x + math.sin(angle) * .1, a.y + math.cos(angle) * .09, a.z + .065)
        petal(p, .06 + (i % 4) * .018, bone, '#4e6e3b', angle)
        if i % 11 == 0:
            flower(p, .058, bone)
    for i in range(12):
        a = main[3 + i]
        branch([a, a + Vector((math.sin(i) * .02, math.cos(i) * .02, -.12))], .012, bone, '#758046', 5)
for side in [-1,1]:
    for i in range(6):
        centers=[]
        for step in range(18):
            y=-.98+step/17*1.43
            t=(y+1.1)/2.04
            width=.18+math.sin(t*math.pi)**.65*.52
            height=.25+math.sin(t*math.pi)**.7*.51
            center_z=2.03+.24*math.exp(-((t-.78)/.21)**2)
            theta=.22+i*.17+math.sin(step*.57+i)*.085
            centers.append((side*math.cos(theta)*width,y,center_z+math.sin(theta)*height))
        loft('Heartwood',centers,[(.012+.005*math.sin(step*.6+i),)*2 for step in range(18)],'#9b8252' if i%3 else '#493e2c',torso_weights,6,.12)
    for i in range(9):
        branch(bezier((side*(.12+i*.012),.79,2.58),(side*.25,1.02,2.90),(side*.19,1.21,3.21),(side*.11,1.53,3.25),16),.018,'neck','#a18a5b' if i%2 else '#5b4e36',6)
    loft('Heartwood',[(side*.075,2.075,3.0),(side*.074,2.15,3.025),(side*.052,2.20,3.03)],[(.027,.023),(.025,.026),(.015,.018)],'#302f26',{'head':1},10)
    branch(bezier((side*.25,1.40,3.34),(side*.27,1.46,3.345),(side*.25,1.53,3.33),(side*.23,1.61,3.29),8),.021,'head','#61563e',7)
loft('Heartwood',[(0,2.11,2.975),(0,2.19,2.95)],[(.011,.02),(.009,.018)],'#302f26',{'jaw':1},8)
for i in range(12):
    bone = 'blossom-' + str(i)
    center = arm_data.bones[bone].head_local
    flower(center, .15, bone)

objects = []
for name, buf in BUFFERS.items():
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(buf['v'], [], buf['f'])
    mesh.update()
    color = mesh.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    for i, value in enumerate(buf['c']):
        color.data[i].color = value
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATERIALS[name])
    for bone in arm_data.bones:
        obj.vertex_groups.new(name=bone.name)
    for i, weights in enumerate(buf['w']):
        for bone, weight in weights.items():
            if weight > 1e-6:
                obj.vertex_groups[bone].add([i], weight, 'REPLACE')
    modifier = obj.modifiers.new('WeightedMossheart', 'ARMATURE')
    modifier.object = rig
    obj.parent = rig
    for polygon in mesh.polygons:
        polygon.use_smooth = name != 'LichenStone'
    objects.append(obj)

DURATIONS = {'idle': 2.4, 'walk': 1.2, 'trot': .7, 'charge': 3.6, 'sweep': 2.55, 'stomp': 4.0, 'roots': 3.7, 'hit': .4, 'stunned': 2.8, 'phase': 1.7, 'defeat': 3.0}
scene = bpy.context.scene
scene.render.fps = FPS
rig.animation_data_create()
for pose in rig.pose.bones:
    pose.rotation_mode = 'XYZ'


def ease(t):
    t = max(0, min(1, t))
    return t * t * (3 - 2 * t)


def rotate(name, x=0, y=0, z=0):
    rig.pose.bones[name].rotation_euler = (x, y, z)


def move(name,x=0,y=0,z=0):
    rig.pose.bones[name].location=arm_data.bones[name].matrix_local.to_3x3().inverted() @ Vector((x,y,z))


for clip, duration in DURATIONS.items():
    frames = round(duration * FPS)
    authored = bpy.data.actions.new(clip + '-authored')
    rig.animation_data.action = authored
    for frame in range(frames + 1):
        t = frame / FPS
        for pose in rig.pose.bones:
            pose.location = (0, 0, 0)
            pose.rotation_euler = (0, 0, 0)
            pose.scale = (1, 1, 1)
        breath = math.sin(t * math.tau / 2.4)
        rotate('neck', .018 * breath)
        rotate('head', -.02 * breath)
        rotate('tail', .02 * breath, .03 * breath)
        rig.pose.bones['spine'].scale = (1 + .009 * breath, 1, 1 + .008 * breath)
        gait_cycle = duration if clip in ('walk','trot') else .28 if clip == 'charge' and 1.05 <= t <= 2.10 else 0
        if gait_cycle:
            ground_speed = 1 if clip == 'walk' else 2.4 if clip == 'trot' else 11
            stance = .6 if clip == 'walk' else .5 if clip == 'trot' else .4
            span = ground_speed * gait_cycle * stance
            for i, label in enumerate(LEGS):
                phase = ((t - (1.05 if clip == 'charge' else 0)) / gait_cycle + (.5 if i in (1,2) else 0)) % 1
                if phase < stance:
                    foot_y = span * (.5 - phase / stance)
                    foot_z = 0
                else:
                    swing = (phase - stance) / (1 - stance)
                    foot_y = span * (-.5 + ease(swing))
                    foot_z = math.sin(math.pi * swing) * (.16 if clip == 'walk' else .25)
                move('CTRL-'+label,y=foot_y,z=foot_z)
            rotate('chest', math.sin(t * math.tau / gait_cycle) * .03)
        if clip == 'charge':
            fold = ease(t / 1.05) if t < 1.05 else 1 if t < 2.1 else 1 - ease((t - 2.1) / .7)
            rotate('neck', -.60 * fold)
            rotate('head', -.12 * fold)
            rotate('chest', -.12 * fold)
            move('root',z=-.08*fold)
        elif clip == 'sweep':
            fold = ease(t / .85) if t < .85 else 1 if t <= 1.15 else 1 - ease((t - 1.15) / .45)
            yaw = -1.45 * ease(t / .85) if t < .85 else -1.45 + 2.9 * ease((t - .85) / .3) if t < 1.15 else 1.45 * (1 - ease((t - 1.15) / .6))
            move('root',z=-.65*fold)
            rotate('root',0,yaw,0)
            rotate('chest', -.25 * fold)
            move('neck',y=.5*fold,z=.13*fold)
            rotate('neck', -1.55 * fold)
            rotate('head', -.18 * fold)
        elif clip == 'stomp':
            rear = ease(t / 1.1) if t < 1.1 else 1 - ease((t - 1.1) / .18)
            rotate('pelvis', .19 * rear)
            rotate('spine', .12 * rear)
            rotate('neck', .16 * rear)
            for label in LEGS:
                if label.startswith('Front'):
                    move('CTRL-'+label,y=-.25*rear,z=.95*rear)
            move('root',z=-.17*math.sin(ease((t-1.1)/.25)*math.pi))
        elif clip == 'roots':
            fold = ease(t / 1.2) if t < 1.2 else 1 - ease((t - 2.3) / .7)
            rotate('neck', -.32 * fold)
            rotate('chest', -.1 * fold)
            move('root',z=-.16*fold)
            rotate('rib-L', 0, -.13 * fold)
            rotate('rib-R', 0, .13 * fold)
        elif clip == 'hit':
            shake = math.sin(t / duration * math.pi) * .13
            rotate('chest', shake)
            rotate('head', -shake * .7)
        elif clip == 'stunned':
            fold = ease(t / .18) * (1 - ease((t - 2.35) / .45))
            move('root',z=-.38*fold)
            rotate('neck', -.60 * fold)
            rotate('head', -.12 * fold)
            rotate('rib-L', 0, -.8 * fold, -.35 * fold)
            rotate('rib-R', 0, .8 * fold, .35 * fold)
            rig.pose.bones['heart'].scale = (1 + .35 * fold,) * 3
        elif clip == 'phase':
            pulse = math.sin(t / duration * math.pi)
            rotate('neck', -.24 * pulse)
            rotate('rib-L', 0, -.28 * pulse)
            rotate('rib-R', 0, .28 * pulse)
            rig.pose.bones['heart'].scale = (1 + .15 * pulse,) * 3
            move('root',z=-.18*pulse)
        elif clip == 'defeat':
            fold = ease(t / 1.25)
            move('root',z=-.88*fold)
            rotate('neck', -.68 * fold)
            rotate('head', -.25 * fold)
            rotate('rib-L', 0, -.6 * fold)
            rotate('rib-R', 0, .6 * fold)
            rig.pose.bones['heart'].scale = (1 - .6 * ease((t - 1) / 2),) * 3
        for i in range(12):
            bloom = rig.pose.bones['blossom-' + str(i)]
            appear = ease((t - .8 - i * .07) / .8) if clip == 'defeat' else 0
            bloom.scale = (.001 + appear,) * 3
            bloom.location.z = appear * (.22 + i * .035)
        for pose in rig.pose.bones:
            pose.keyframe_insert('location', frame=frame + 1)
            pose.keyframe_insert('rotation_euler', frame=frame + 1)
            pose.keyframe_insert('scale', frame=frame + 1)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.nla.bake(frame_start=1, frame_end=frames + 1, step=1, only_selected=False, visual_keying=True, clear_constraints=False, use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    baked = rig.animation_data.action
    bpy.data.actions.remove(authored)
    baked.name = clip
    baked.use_fake_user = True
for pose in rig.pose.bones:
    for constraint in list(pose.constraints):
        pose.constraints.remove(constraint)
rig.animation_data.action = bpy.data.actions['idle']
scene.frame_set(1)

triangles = 0
weights_max = 0
for obj in objects:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
    for vertex in obj.data.vertices:
        groups = [group.weight for group in vertex.groups if group.weight > 1e-6]
        assert 1 <= len(groups) <= 4
        assert abs(sum(groups) - 1) < .0001
        weights_max = max(weights_max, len(groups))
sweep_samples=[]
wood=next(obj for obj in objects if obj.name=='Heartwood')
antler_groups={group.index for group in wood.vertex_groups if group.name.startswith('antler-')}
antler_vertices=[vertex.index for vertex in wood.data.vertices if any(group.group in antler_groups and group.weight>.1 for group in vertex.groups)]
rig.animation_data.action=bpy.data.actions['sweep']
for elapsed in [.85,.925,1.0,1.075,1.15]:
    frame=1+elapsed*FPS;scene.frame_set(int(frame),subframe=frame-int(frame))
    evaluated=wood.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh=evaluated.to_mesh()
    vertices=[mesh.vertices[index].co for index in antler_vertices]
    contact=[v for v in vertices if .2<=v.z<=1.55 and 3.2<=math.hypot(v.x,v.y)<=4.3]
    assert len(contact) > 0 and min(v.z for v in vertices) >= 0
    assert 3.6 <= max(math.hypot(v.x,v.y) for v in vertices) <= 4.1
    sweep_samples.append({'elapsed':elapsed,'contactVertices':len(contact),'minimumHeight':min(v.z for v in vertices),'maximumReach':max(math.hypot(v.x,v.y) for v in vertices),'tips':[list(rig.pose.bones[name].matrix.translation) for name in ['antler-tip-L','antler-tip-R']]})
    evaluated.to_mesh_clear()
hoof_samples=[]
hoof_mesh=next(obj for obj in objects if obj.name=='LichenStone')
hoof_group=hoof_mesh.vertex_groups['Front-L-hoof'].index
hoof_vertices=[vertex.index for vertex in hoof_mesh.data.vertices if any(group.group==hoof_group and group.weight>.9 for group in vertex.groups)]
for clip,cycle,stance,speed,start in [('walk',1.2,.6,1,0),('trot',.7,.5,2.4,0),('charge',.28,.4,11,1.05)]:
    rig.animation_data.action=bpy.data.actions[clip]
    points=[]
    for fraction in [.2,.3,.4]:
        elapsed=start+cycle*stance*fraction
        frame=1+elapsed*FPS;scene.frame_set(int(frame),subframe=frame-int(frame))
        evaluated=hoof_mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        vertices=[mesh.vertices[index].co.copy() for index in hoof_vertices]
        points.append((elapsed,sum(v.y for v in vertices)/len(vertices)+elapsed*speed,min(v.z for v in vertices)))
        evaluated.to_mesh_clear()
    velocity=max(abs((b[1]-a[1])/(b[0]-a[0])) for a,b in zip(points,points[1:]))
    assert velocity < .15 and 0 <= min(p[2] for p in points) <= .05
    hoof_samples.append({'clip':clip,'worldStanceVelocity':velocity,'minimumSoleHeight':min(p[2] for p in points)})
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
summary = {'triangles': triangles, 'bones': len(arm_data.bones), 'weightsMaximum': weights_max, 'clips': DURATIONS, 'forward': '+Y Blender / -Z Three', 'sweepSamples':sweep_samples, 'hoofSamples':hoof_samples, 'gaits': {'walkMetersPerSecond': 1.0, 'trotMetersPerSecond': 2.4, 'chargeMetersPerSecond': 11}}
print('MOSSHEART', json.dumps(summary))
(OUTPUT / 'mossheart-build.json').write_text(json.dumps(summary, indent=2))

if '--export-only' not in ARGS:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.world.color = (.18, .22, .26)
    world = scene.world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.32, .40, .48, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .55
    for name, position, energy, color in [('WarmKey', (-4, 5, 8), 750, (1, .83, .62)), ('CoolFill', (4, 3, 5), 350, (.65, .80, 1)), ('Rim', (0, -4, 6), 650, (1, .92, .71))]:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy = energy
        light.color = color
        light.shape = 'DISK'
        light.size = 5
        obj = bpy.data.objects.new(name, light)
        bpy.context.collection.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (Vector((0, .4, 2)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.04))
    ground = bpy.context.object
    ground.name = 'RenderGround'
    ground_mat = bpy.data.materials.new('RenderGround')
    ground_mat.diffuse_color = (.11, .16, .13, 1)
    ground.data.materials.append(ground_mat)
    camera_data = bpy.data.cameras.new('AssetReview')
    camera = bpy.data.objects.new('AssetReview', camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 5.8
    views = [('front', (0, 10, 4.1), 'idle', 1), ('side', (10, 0, 3.8), 'idle', 1), ('back', (0, -10, 4.1), 'idle', 1), ('threequarter', (7, 9, 5.6), 'idle', 1), ('charge', (7, 9, 5.6), 'charge', 90), ('sweep', (7, 9, 5.6), 'sweep', 61), ('stunned', (5, 9, 4.7), 'stunned', 55), ('stomp', (7, 9, 5.6), 'stomp', 57), ('defeat', (5, 9, 4.7), 'defeat', 159)]
    for name, location, clip, frame in views:
        rig.animation_data.action = bpy.data.actions[clip]
        scene.frame_set(frame)
        camera.location = location
        camera.rotation_euler = (Vector((0, .3, 2.05)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(OUTPUT / (name + '.png'))
        bpy.ops.render.render(write_still=True)
        print('RENDERED', name)

if '--renders-only' not in ARGS:
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for obj in objects:
        obj.select_set(True)
    rig.animation_data.action = bpy.data.actions['idle']
    scene.frame_set(1)
    target = ROOT / 'public' / 'wilds' / 'mossheart.glb'
    target.parent.mkdir(parents=True, exist_ok=True)
    desired = {'filepath': str(target), 'export_format': 'GLB', 'use_selection': True, 'export_animations': True, 'export_animation_mode': 'ACTIONS', 'export_force_sampling': True, 'export_def_bones': True, 'export_apply': False, 'export_yup': True, 'export_anim_slide_to_zero': True}
    accepted = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{key: value for key, value in desired.items() if key in accepted})
    print('EXPORTED', target)
