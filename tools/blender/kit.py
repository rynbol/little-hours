import json
import math
import os
import subprocess
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, kdtree, noise
from mathutils.bvhtree import BVHTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FPS = 30
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDERS = ARGS[ARGS.index('--renders') + 1] if '--renders' in ARGS else None


def tables(module, names):
    code = f"import('./{module}').then(m => console.log(JSON.stringify({{ {', '.join(f'{key}: m.{value}' for key, value in names.items())} }})))"
    return json.loads(subprocess.run(['node', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True).stdout)


def node(code):
    return json.loads(subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True).stdout)


def srgb(code):
    code = code.lstrip('#')
    return tuple(int(code[i:i + 2], 16) / 255 for i in (0, 2, 4))


def to_linear(colour):
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in colour)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def shade(colour, amount):
    return tuple(max(0.0, min(1.0, c * amount)) for c in colour)


noise.seed_set(11)


def wobble(p, scale=1.0, offset=0.0):
    return noise.noise(Vector((p.x * scale + offset, p.y * scale - offset * 0.7, p.z * scale + offset * 1.3)))


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def catmull(points, s):
    count = len(points)
    f = max(0.0, min(0.999999, s)) * (count - 1)
    i = int(f)
    t = f - i
    p0, p1 = points[max(0, i - 1)], points[i]
    p2, p3 = points[min(count - 1, i + 1)], points[min(count - 1, i + 2)]
    t2, t3 = t * t, t * t * t
    return tuple(0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in range(len(p1)))


class Model:
    def __init__(self):
        self.verts, self.colours, self.weights, self.faces, self.materials, self.smooth = [], [], [], [], [], []

    def add(self, piece, colour, weight, material=0, smooth=True):
        verts, faces, attrs = piece
        base = len(self.verts)
        for v, a in zip(verts, attrs):
            self.verts.append(Vector(v))
            self.colours.append(colour(Vector(v), a))
            self.weights.append(weight(Vector(v), a))
        for f in faces:
            self.faces.append(tuple(base + i for i in f))
            self.materials.append(material(f, verts, attrs) if callable(material) else material)
            self.smooth.append(smooth)


def loft(rings, attrs, cap_start=True, cap_end=True):
    sides = len(rings[0])
    verts = [v for ring in rings for v in ring]
    flat_attrs = [a for ring in attrs for a in ring]
    faces = []
    for i in range(len(rings) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    if cap_start:
        centre = sum(rings[0], Vector()) / sides
        verts.append(centre)
        flat_attrs.append(attrs[0][0])
        faces += [(len(verts) - 1, (j + 1) % sides, j) for j in range(sides)]
    if cap_end:
        centre = sum(rings[-1], Vector()) / sides
        verts.append(centre)
        flat_attrs.append(attrs[-1][0])
        last = (len(rings) - 1) * sides
        faces += [(len(verts) - 1, last + j, last + (j + 1) % sides) for j in range(sides)]
    return verts, faces, flat_attrs


def tube(points, radii, sides=8, rough=0.0, seed=0.0, ridges=0, shape=None):
    points = [Vector(p) for p in points]
    tangents = []
    for i in range(len(points)):
        a, b = points[max(0, i - 1)], points[min(len(points) - 1, i + 1)]
        tangents.append((b - a).normalized())
    normal = tangents[0].orthogonal().normalized()
    rings, attrs = [], []
    for i, (p, t) in enumerate(zip(points, tangents)):
        normal = (normal - t * normal.dot(t)).normalized()
        binormal = t.cross(normal)
        u = i / (len(points) - 1)
        ring, ring_attrs = [], []
        for j in range(sides):
            angle = j / sides * math.tau
            out = normal * math.cos(angle) + binormal * math.sin(angle)
            radius = radii[i] * (1.0 + rough * wobble(p + out * 0.3, 7.0, seed) + (0.07 * math.cos(angle * ridges + u * 3.0) if ridges else 0.0)) * (shape(u, angle) if shape else 1.0)
            ring.append(p + out * radius)
            ring_attrs.append((out, u, j / sides))
        rings.append(ring)
        attrs.append(ring_attrs)
    return loft(rings, attrs)


def blob(centre, radii, subdiv=1, rotation=None, rough=0.0, seed=0.0, flat_bottom=None):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    unit = [v.co.copy() for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    rotation = rotation or Matrix.Identity(3)
    verts, attrs = [], []
    for n in unit:
        bump = 1.0 + rough * wobble(n, 2.3, seed)
        local = Vector((n.x * radii[0], n.y * radii[1], n.z * radii[2])) * bump
        if flat_bottom is not None and local.z < -radii[2] * flat_bottom:
            local.z = -radii[2] * flat_bottom
        verts.append(Vector(centre) + rotation @ local)
        attrs.append((rotation @ n, 0.5 + 0.5 * n.z, 0.5 + 0.5 * math.atan2(n.y, n.x) / math.pi))
    return verts, faces, attrs


def orb(shape, rings=18, segments=28):
    verts, attrs, faces = [], [], []
    for i in range(1, rings):
        theta = math.pi * i / rings
        for j in range(segments):
            phi = math.tau * j / segments
            n = Vector((math.sin(theta) * math.cos(phi), math.sin(theta) * math.sin(phi), math.cos(theta)))
            verts.append(shape(n))
            attrs.append((n, i / rings, j / segments))
    top, bottom = len(verts), len(verts) + 1
    verts += [shape(Vector((0, 0, 1))), shape(Vector((0, 0, -1)))]
    attrs += [(Vector((0, 0, 1)), 0.0, 0.0), (Vector((0, 0, -1)), 1.0, 0.0)]
    for i in range(rings - 2):
        for j in range(segments):
            a, b = i * segments + j, i * segments + (j + 1) % segments
            faces.append((a, a + segments, b + segments, b))
    for j in range(segments):
        faces.append((top, j, (j + 1) % segments))
        last = (rings - 2) * segments
        faces.append((bottom, last + (j + 1) % segments, last + j))
    return verts, faces, attrs


def hemisphere(count):
    rays = []
    for i in range(count):
        z = 1.0 - (i + 0.5) / count
        r = math.sqrt(max(0.0, 1.0 - z * z))
        rays.append(Vector((r * math.cos(i * 2.399963), r * math.sin(i * 2.399963), z)))
    return rays


def vertex_normals(model):
    mesh = bpy.data.meshes.new('normals')
    mesh.from_pydata([tuple(v) for v in model.verts], [], model.faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    normals = [v.normal.copy() for v in bm.verts]
    bm.free()
    bpy.data.meshes.remove(mesh)
    return normals


def occlusion(model, occluders, reach, count=20, ignore=lambda colour: False):
    verts, faces = [], []
    for other in occluders:
        faces += [tuple(len(verts) + i for i in f) for f in other.faces if not ignore(other.colours[f[0]])]
        verts += [tuple(v) for v in other.verts]
    tree = BVHTree.FromPolygons(verts, faces)
    rays = hemisphere(count)
    total = sum(d.z for d in rays)
    shade = []
    for p, n in zip(model.verts, vertex_normals(model)):
        if n.length < 0.5:
            shade.append(0.0)
            continue
        t = n.orthogonal().normalized()
        b = n.cross(t)
        start = Vector(p) + n * 0.0015
        hit = 0.0
        for d in rays:
            location, _, _, distance = tree.ray_cast(start, t * d.x + b * d.y + n * d.z, reach)
            if location is not None:
                hit += d.z * (1.0 - distance / reach)
        shade.append(hit / total)
    return shade


def keep_faces(piece, test):
    verts, faces, attrs = piece
    kept = [f for f in faces if test(sum((Vector(verts[i]) for i in f), Vector()) / len(f), [attrs[i] for i in f])]
    used = sorted({i for f in kept for i in f})
    remap = {old: new for new, old in enumerate(used)}
    return [verts[i] for i in used], [tuple(remap[i] for i in f) for f in kept], [attrs[i] for i in used]


def refine(piece, levels=1, thickness=0.0, offset=-1.0, crease=False):
    verts, faces, attrs = piece
    mesh = bpy.data.meshes.new('refine')
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    obj = bpy.data.objects.new('refine', mesh)
    bpy.context.scene.collection.objects.link(obj)
    if thickness:
        solid = obj.modifiers.new('solid', 'SOLIDIFY')
        solid.thickness, solid.offset, solid.use_rim, solid.use_even_offset = thickness, offset, True, True
    if levels:
        sub = obj.modifiers.new('sub', 'SUBSURF')
        sub.levels = sub.render_levels = levels
        sub.boundary_smooth = 'PRESERVE_CORNERS' if crease else 'ALL'
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph).to_mesh()
    out_verts = [v.co.copy() for v in evaluated.vertices]
    out_faces = [tuple(p.vertices) for p in evaluated.polygons]
    obj.evaluated_get(depsgraph).to_mesh_clear()
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(mesh)
    tree = kdtree.KDTree(len(verts))
    for i, v in enumerate(verts):
        tree.insert(Vector(v), i)
    tree.balance()
    return out_verts, out_faces, [attrs[tree.find(v)[1]] for v in out_verts]


def transform(piece, matrix):
    verts, faces, attrs = piece
    return [matrix @ Vector(v) for v in verts], faces, attrs


def facing(normal, along=None):
    z = Vector(normal).normalized()
    x = (Vector(along) if along else Vector((0, 1, 0)))
    x = (x - z * x.dot(z)).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed()


def segment_distance(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length


def frames_along(points):
    points = [Vector(p) for p in points]
    out = []
    normal = None
    for i, p in enumerate(points):
        a, b = points[max(0, i - 1)], points[min(len(points) - 1, i + 1)]
        t = (b - a).normalized()
        if normal is None:
            normal = t.orthogonal().normalized()
        normal = (normal - t * normal.dot(t)).normalized()
        out.append((p, t, normal, t.cross(normal)))
    return out


def track(t, keys):
    keys = sorted(keys, key=lambda k: k[0])
    if t <= keys[0][0]:
        return keys[0][1]
    if t >= keys[-1][0]:
        return keys[-1][1]
    for i in range(len(keys) - 1):
        (ta, va), (tb, vb) = keys[i], keys[i + 1]
        if ta <= t <= tb:
            break
    span = tb - ta
    u = (t - ta) / span
    scalar = not isinstance(va, (tuple, list))
    va_, vb_ = ((va,), (vb,)) if scalar else (va, vb)

    def slope(j):
        if j <= 0 or j >= len(keys) - 1:
            return tuple(0.0 for _ in va_)
        (t0, v0), (t1, v1) = keys[j - 1], keys[j + 1]
        v0, v1 = ((v0,), (v1,)) if scalar else (v0, v1)
        return tuple((v1[k] - v0[k]) / (t1 - t0) for k in range(len(va_)))

    ma, mb = slope(i), slope(i + 1)
    h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
    out = tuple(h00 * va_[k] + h10 * span * ma[k] + h01 * vb_[k] + h11 * span * mb[k] for k in range(len(va_)))
    return out[0] if scalar else out


def reset(rate=FPS):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = rate
    return scene


def make_armature(scene, name, bones):
    data = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, data)
    scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for bone_name, head, tail, parent, connect in bones:
        bone = data.edit_bones.new(bone_name)
        bone.head, bone.tail, bone.roll = head, tail, 0.0
        bone.use_deform = True
    for bone_name, head, tail, parent, connect in bones:
        if parent:
            data.edit_bones[bone_name].parent = data.edit_bones[parent]
            data.edit_bones[bone_name].use_connect = connect
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def make_mesh(scene, name, model, rig, materials, groups):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in model.verts], [], model.faces)
    for material_name in materials:
        material = bpy.data.materials.get(material_name) or bpy.data.materials.new(material_name)
        mesh.materials.append(material)
    mesh.polygons.foreach_set('material_index', model.materials)
    mesh.polygons.foreach_set('use_smooth', model.smooth)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    colours = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    flat = []
    for c in model.colours:
        flat += [*to_linear(c[:3]), c[3] if len(c) > 3 else 1.0]
    colours.data.foreach_set('color', flat)
    mesh.color_attributes.active_color = colours
    mesh.color_attributes.render_color_index = 0
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    vertex_groups = {group: obj.vertex_groups.new(name=group) for group in groups}
    for i, weights in enumerate(model.weights):
        top = sorted(weights.items(), key=lambda item: -item[1])[:4]
        total = sum(w for _, w in top)
        for group, w in top:
            if w / total > 0.002:
                vertex_groups[group].add([i], w / total, 'REPLACE')
    obj.parent = rig
    modifier = obj.modifiers.new('Rig', 'ARMATURE')
    modifier.object = rig
    return obj


class Poser:
    def __init__(self, rig):
        self.rig = rig
        self.bones = rig.data.bones
        self.rest = {b.name: b.matrix_local.copy() for b in self.bones}
        self.relative = {}
        for b in self.bones:
            self.relative[b.name] = self.rest[b.parent.name].inverted() @ self.rest[b.name] if b.parent else self.rest[b.name].copy()
        self.length = {b.name: b.length for b in self.bones}
        self.pose, self.basis, self.miss, self.time = {}, {}, (0.0, '', 0.0), 0.0

    def ident(self, name):
        parent = self.bones[name].parent
        return self.pose[parent.name] @ self.relative[name] if parent else self.relative[name].copy()

    def turn(self, name, rotation=(0, 0, 0), offset=(0, 0, 0)):
        start = self.ident(name)
        head = start.translation.copy()
        spin = Euler(rotation, 'XYZ').to_matrix().to_4x4()
        final = Matrix.Translation(head + Vector(offset)) @ spin @ Matrix.Translation(-head) @ start
        self.pose[name], self.basis[name] = final, start.inverted() @ final

    def aim(self, name, direction):
        start = self.ident(name)
        y0 = start.to_3x3().col[1].normalized()
        spin = y0.rotation_difference(Vector(direction).normalized()).to_matrix()
        final = Matrix.Translation(start.translation) @ (spin @ start.to_3x3()).to_4x4()
        self.pose[name], self.basis[name] = final, start.inverted() @ final

    def head(self, name):
        return self.ident(name).translation.copy()


def bake(rig, poser, clips, located=('hips',), scaled=()):
    rig.animation_data_create()
    rate = bpy.context.scene.render.fps
    report = {}
    for name, fn, length in clips:
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        frames = max(2, round(length * rate))
        last = {}
        poser.miss = (0.0, '', 0.0)
        prepare = getattr(poser, 'prepare', None)
        if prepare:
            prepare(fn, length)
        for frame in range(frames + 1):
            poser.time = round(frame / rate, 2)
            basis = poser.evaluate(fn(frame / frames * length))
            for bone, matrix in basis.items():
                pb = rig.pose.bones[bone]
                location, rotation, scale = matrix.decompose()
                if bone in last and last[bone].dot(rotation) < 0:
                    rotation.negate()
                last[bone] = rotation
                pb.rotation_quaternion = rotation
                pb.keyframe_insert('rotation_quaternion', frame=frame, group=bone)
                if bone in located:
                    pb.location = location
                    pb.keyframe_insert('location', frame=frame, group=bone)
                if bone in scaled:
                    pb.scale = scale
                    pb.keyframe_insert('scale', frame=frame, group=bone)
        action.use_frame_range = True
        action.frame_start, action.frame_end = 0, frames
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, action)
        track.mute = True
        rig.animation_data.action = None
        report[name] = {'seconds': round(frames / rate, 3), 'short': [round(poser.miss[0], 3), poser.miss[1], poser.miss[2]]}
        if getattr(poser, 'report', None):
            report[name].update({key: round(value, 3) for key, value in poser.report.items()})
    return report


def export(path, rig, meshes, **options):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig
    settings = dict(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
        export_anim_slide_to_zero=True, export_optimize_animation_size=True, export_def_bones=True,
        export_skins=True, export_influence_nb=4, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
        export_texcoords=False, export_normals=True, export_tangents=False, export_materials='EXPORT',
        export_cameras=False, export_lights=False, export_extras=False, export_morph=False,
    )
    settings.update(options)
    bpy.ops.export_scene.gltf(**settings)


def studio(scene, size=900, lens=50, floor=6):
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'VERTEX'
    scene.display.shading.show_cavity = True
    scene.display.shading.show_shadows = True
    scene.render.resolution_x, scene.render.resolution_y = size, size
    world = bpy.data.worlds.new('grey')
    world.color = (0.62, 0.66, 0.62)
    scene.world = world
    camera = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    camera.data.lens = lens
    scene.collection.objects.link(camera)
    scene.camera = camera
    ground = bpy.data.objects.new('floor', bpy.data.meshes.new('floor'))
    ground.data.from_pydata([(-floor, -floor, 0), (floor, -floor, 0), (floor, floor, 0), (-floor, floor, 0)], [], [(0, 1, 2, 3)])
    scene.collection.objects.link(ground)

    def shoot(folder, name, location, look):
        os.makedirs(folder, exist_ok=True)
        camera.location = location
        camera.rotation_euler = (Vector(look) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(folder, name + '.png')
        bpy.ops.render.render(write_still=True)
    return shoot
