"""Original Little Hours completion charm, built entirely from primitives.
Run: blender --background --factory-startup --python assets/blender/little-bloom.py
Outputs a transparent PNG and an editable .blend in this repository.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, roughness=.36):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    return mat

cream = material('Oat milk ceramic', (.84, .72, .53))
rose = material('Strawberry petals', (.63, .24, .32))
gold = material('Honey center', (.94, .57, .18))
sage = material('Sage leaves', (.25, .39, .22))
soil = material('Warm earth', (.19, .12, .105), .8)
ink = material('Tiny sleepy eyes', (.18, .11, .12), .5)

def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj

def sphere(name, xyz, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=xyz)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, mat)

def curve(name, points, radius, mat):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    data.bevel_resolution = 4
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for point, xyz in zip(spline.bezier_points, points):
        point.co = xyz
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

# A round ceramic planter with a raised lip.
bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=.43, radius2=.57, depth=.72, location=(0, 0, .46))
pot = finish(bpy.context.object, 'Little ceramic pot', cream)
bevel = pot.modifiers.new('Soft ceramic edges', 'BEVEL')
bevel.width = .09
bevel.segments = 5
bpy.ops.mesh.primitive_torus_add(major_radius=.51, minor_radius=.075, major_segments=64, minor_segments=16, location=(0, 0, .83))
finish(bpy.context.object, 'Rolled rim', cream)
sphere('Earth', (0, 0, .80), (.47, .47, .07), soil)
curve('Growing stem', [(0,0,.83),(-.04,0,1.25),(.1,0,1.78)], .045, sage)
leaf = sphere('Left leaf', (-.22, -.01, 1.20), (.30, .075, .13), sage)
leaf.rotation_euler[1] = .45
leaf = sphere('Right leaf', (.24, 0, 1.42), (.28, .075, .12), sage)
leaf.rotation_euler[1] = -.5
# Five softly rounded petals, facing the camera like a little enamel pin.
for i in range(5):
    angle = 2 * math.pi * i / 5
    petal = sphere('Petal %d' % i, (.10 + math.sin(angle)*.245, -.005, 1.88 + math.cos(angle)*.245), (.19,.12,.27), rose)
    petal.rotation_euler[1] = angle
sphere('Honey heart', (.10,-.125,1.88), (.19,.08,.19), gold)
# Hand-drawn smile, expressed as a curve on the front of the pot.
for x in [-.14, .14]:
    sphere('Sleepy eye', (x,-.482,.51), (.026,.025,.037), ink)
curve('A small smile', [(-.06,-.495,.40),(0,-.50,.375),(.06,-.495,.40)], .012, ink)

world = bpy.context.scene.world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.75,.68,.65,1)
world.node_tree.nodes['Background'].inputs[1].default_value = .4

def area(name, xyz, energy, size):
    bpy.ops.object.light_add(type='AREA', location=xyz)
    light=bpy.context.object
    light.name=name
    light.data.energy=energy
    light.data.shape='DISK'
    light.data.size=size
    light.rotation_euler=(Vector((0,0,1.1))-light.location).to_track_quat('-Z','Y').to_euler()
area('Big softbox', (-3,-4,6), 400, 4)
area('Soft fill', (4,-2,3), 140, 3)
area('Warm rim', (1,3,4), 300, 3)
bpy.ops.object.camera_add(location=(2.5,-7,3.0))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.25))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=2.9
scene=bpy.context.scene
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.resolution_x=384
scene.render.resolution_y=384
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX'
# Relative to the saved .blend, so the editable source is portable.
scene.render.filepath='//../../public/ui/little-bloom.png'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/little-bloom.blend'), compress=True)
bpy.ops.render.render(write_still=True)
