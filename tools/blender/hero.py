import bpy
import math
import json
import sys
import struct
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT.parent/'wilds-assets'/'progress-shots'/'wilds-three-codex'/'stage5-hero'
OUTPUT.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
FPS=100
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):
    bpy.data.materials.remove(material)


def tone(value):
    return tuple((int(value[i:i+2],16)/255)**2.2 for i in (1,3,5))+(1,)


PALETTE={'Skin':'#d6ad87','Hair':'#674d3b','Top':'#b88770','TopShade':'#a67863','TopTrim':'#cb9b7d','Bottom':'#777e72','BottomTrim':'#a4ac94','Cape':'#577565','Leather':'#675040','Detail':'#ffffff','BladeSteel':'#b7c5c5'}
MATERIALS={}
for name,color in PALETTE.items():
    material=bpy.data.materials.new(name)
    material.use_nodes=True
    shader=material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=tone(color)
    shader.inputs['Roughness'].default_value=.86 if name!='BladeSteel' else .38
    if name=='BladeSteel':
        shader.inputs['Metallic'].default_value=.55
    vertex=material.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name='Col'
    mix=material.node_tree.nodes.new('ShaderNodeMixRGB')
    mix.blend_type='MULTIPLY'
    mix.inputs[0].default_value=1
    mix.inputs[2].default_value=tone(color)
    material.node_tree.links.new(vertex.outputs['Color'],mix.inputs[1])
    material.node_tree.links.new(mix.outputs[0],shader.inputs['Base Color'])
    MATERIALS[name]=material
BUFFERS={}


def part(name,material,vertices,faces,weights,color='#ffffff'):
    key=(name,material)
    buf=BUFFERS.setdefault(key,{'v':[],'f':[],'w':[],'c':[]})
    start=len(buf['v'])
    base=tone(color)
    for point in vertices:
        p=Vector(point)
        buf['v'].append(tuple(p))
        shade=.97+.025*math.sin(p.z*33+p.x*21+p.y*17)
        buf['c'].append(tuple(v*shade for v in base[:3])+(1,))
        raw=weights(p) if callable(weights) else weights
        total=sum(raw.values())
        buf['w'].append({bone:value/total for bone,value in raw.items() if value>0})
    buf['f'].extend(tuple(start+i for i in face) for face in faces)


def loft(name,material,centers,radii,weights,sides=16,color='#ffffff',ridge=0):
    vertices=[]
    for ring,(center,radius) in enumerate(zip(centers,radii)):
        c=Vector(center)
        tangent=Vector(centers[min(ring+1,len(centers)-1)])-Vector(centers[max(0,ring-1)])
        tangent.normalize()
        reference=Vector((1,0,0)) if abs(tangent.x)<.8 else Vector((0,1,0))
        u=(reference-tangent*reference.dot(tangent)).normalized()
        v=tangent.cross(u).normalized()
        for j in range(sides):
            angle=j*math.tau/sides
            fold=1+ridge*math.cos(angle*7+ring*.3)
            vertices.append(c+u*math.cos(angle)*radius[0]*fold+v*math.sin(angle)*radius[1]*fold)
    faces=[]
    for ring in range(len(centers)-1):
        for j in range(sides):
            a=ring*sides+j;b=ring*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple((len(centers)-1)*sides+j for j in range(sides))])
    part(name,material,vertices,faces,weights,color)


def curve(a,b,c,d,count=12):
    a,b,c,d=map(Vector,(a,b,c,d))
    return [a*(1-t)**3+b*3*(1-t)**2*t+c*3*(1-t)*t*t+d*t**3 for t in [i/count for i in range(count+1)]]


def strand(name,material,points,radius,bone,color='#ffffff',sides=8):
    loft(name,material,points,[(radius*(.8+.2*math.sin(i/(len(points)-1)*math.pi)),)*2 for i in range(len(points))],bone if callable(bone) or isinstance(bone,dict) else {bone:1},sides,color)


bones=[('Root',(0,0,0),(0,0,.2),None),('Hips',(0,0,.69),(0,0,.85),'Root'),('Spine',(0,0,.85),(0,0,1.01),'Hips'),('Chest',(0,0,1.01),(0,0,1.15),'Spine'),('Neck',(0,0,1.15),(0,0,1.24),'Chest'),('Head',(0,0,1.24),(0,0,1.45),'Neck'),('EyeL',(.047,.095,1.363),(.047,.095,1.385),'Head'),('EyeR',(-.047,.095,1.363),(-.047,.095,1.385),'Head'),('HairBack',(0,-.045,1.42),(0,-.075,1.23),'Head'),('HairL',(.09,.025,1.44),(.12,.02,1.23),'Head'),('HairR',(-.09,.025,1.44),(-.12,.02,1.23),'Head'),('CapeUpper',(0,-.07,1.13),(0,-.14,.93),'Chest'),('CapeLower',(0,-.14,.93),(0,-.19,.72),'CapeUpper'),('Satchel',(.235,-.005,.82),(.25,-.015,.64),'Hips')]
LEGS={}
ARMS={}
for label,side in [('L',1),('R',-1)]:
    hip=(side*.09,0,.70);knee=(side*.10,.025,.39);ankle=(side*.10,0,.10);toe=(side*.10,.095,.045)
    LEGS[label]=(hip,knee,ankle,toe)
    bones.extend([(label+'Thigh',hip,knee,'Hips'),(label+'Shin',knee,ankle,label+'Thigh'),(label+'Foot',ankle,toe,label+'Shin'),('CTRLFoot'+label,ankle,toe,None)])
    shoulder=(side*.17,0,1.09);elbow=(side*.245,.01,.875);wrist=(side*.29,.035,.695);hand=(side*.29,.08,.65)
    ARMS[label]=(shoulder,elbow,wrist,hand)
    bones.extend([(label+'UpperArm',shoulder,elbow,'Chest'),(label+'Forearm',elbow,wrist,label+'UpperArm'),('Hand'+label,wrist,hand,label+'Forearm'),('CTRLHand'+label,wrist,hand,None)])
bones.extend([('BladeBase',(-.29,.176,.695),(-.29,.245,.695),'HandR'),('BladeTip',(-.29,.715,.695),(-.29,.755,.695),'BladeBase')])
arm=bpy.data.armatures.new('HeroRig')
rig=bpy.data.objects.new('Hero',arm)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,head,tail,parent in bones:
    bone=arm.edit_bones.new(name);bone.head=head;bone.tail=tail
    if parent:bone.parent=arm.edit_bones[parent]
    bone.use_deform=not name.startswith('CTRL')
bpy.ops.object.mode_set(mode='OBJECT')
for label in LEGS:
    ik=rig.pose.bones[label+'Shin'].constraints.new('IK');ik.target=rig;ik.subtarget='CTRLFoot'+label;ik.chain_count=2;ik.use_stretch=False;ik.iterations=64
    level=rig.pose.bones[label+'Foot'].constraints.new('COPY_ROTATION');level.target=rig;level.subtarget='CTRLFoot'+label;level.target_space='WORLD';level.owner_space='WORLD'
for label in ARMS:
    ik=rig.pose.bones[label+'Forearm'].constraints.new('IK');ik.target=rig;ik.subtarget='CTRLHand'+label;ik.chain_count=2;ik.use_stretch=False;ik.iterations=64
    level=rig.pose.bones['Hand'+label].constraints.new('COPY_ROTATION');level.target=rig;level.subtarget='CTRLHand'+label;level.target_space='WORLD';level.owner_space='WORLD'


def torso_weights(p):
    t=max(0,min(1,(p.z-.76)/.36))
    return {'Hips':1-t,'Chest':t}


loft('Body','Skin',[(0,0,.68),(0,0,.78),(0,0,.94),(0,0,1.05),(0,0,1.13)],[(.11,.075),(.125,.075),(.13,.083),(.165,.078),(.125,.065)],torso_weights,24)
loft('Body','Skin',[(0,0,1.105),(0,0,1.17),(0,0,1.245)],[(.065,.055),(.055,.05),(.059,.05)],{'Neck':1},20)
head_centers=[];head_radii=[]
for i in range(19):
    t=i/18;z=1.205+t*.285
    width=.015+.100*math.sin(t*math.pi)**.65
    depth=.025+.067*math.sin(t*math.pi)**.65
    head_centers.append((0,.006+math.sin(t*math.pi)*.005,z));head_radii.append((width,depth))
loft('Body','Skin',head_centers,head_radii,{'Head':1},40)
for side in [-1,1]:
    loft('Body','Skin',[(side*.107,.005,1.31),(side*.125,.008,1.34),(side*.112,.008,1.375)],[(.012,.019),(.015,.024),(.008,.012)],{'Head':1},12)
    label='L' if side>0 else 'R';eye='Eye'+label
    x=side*.046;z=1.355
    eyeoutline=[(x-.029,.083,z),(x-.017,.097,z+.015),(x+.017,.097,z+.015),(x+.029,.083,z),(x+.017,.100,z-.015),(x-.017,.100,z-.015),(x,.110,z)]
    part('Face','Detail',eyeoutline,[(6,i,(i+1)%6) for i in range(6)],{eye:1},'#f4eee0')
    loft('Face','Detail',[(x,.111,z),(x,.114,z)],[(.012,.014),(.012,.014)],{eye:1},20,'#584738')
    loft('Face','Detail',[(x,.114,z),(x,.117,z)],[(.006,.009),(.006,.009)],{eye:1},16,'#242829')
    loft('Face','Detail',[(x-side*.004,.119,z+.005),(x-side*.004,.120,z+.005)],[(.003,.003),(.003,.003)],{eye:1},8,'#fff9e7')
    strand('Face','Hair',curve((x-.026,.079,z+.028),(x-.014,.097,z+.036),(x+.017,.098,z+.03),(x+.027,.079,z+.023),8),.004,'Head')
    strand('Face','Detail',curve((x-.029,.085,z),(x-.020,.101,z+.019),(x+.019,.100,z+.019),(x+.029,.085,z),10),.0017,eye,'#67554a',6)
loft('Body','Skin',[(0,.09,1.326),(0,.112,1.318),(0,.12,1.307)],[(.007,.009),(.009,.009),(.012,.007)],{'Head':1},12,'#ebd4c1')
strand('Face','Detail',curve((-.017,.09,1.276),(-.009,.108,1.269),(.01,.108,1.269),(.018,.09,1.276),10),.0016,'Head','#8c5750',6)
for label,(hip,knee,ankle,toe) in LEGS.items():
    loft('Body','Skin',curve(hip,(hip[0],0,.60),(knee[0],.025,.46),knee,10),[(.046-.009*i/10,.049-.011*i/10) for i in range(11)],{label+'Thigh':1},16)
    loft('Body','Skin',curve(knee,(knee[0],.015,.30),(ankle[0],0,.17),ankle,10),[(.037-.011*i/10,.038-.011*i/10) for i in range(11)],{label+'Shin':1},16)
    vertices=[]
    outline=[(math.copysign(abs(math.cos(j*math.tau/20))**.68,math.cos(j*math.tau/20))*.047,.055+math.copysign(abs(math.sin(j*math.tau/20))**.75,math.sin(j*math.tau/20))*.10) for j in range(20)]
    for z,scale in [(.004,.97),(.015,1),(.082,.88)]:
        vertices.extend([(ankle[0]+x*scale,y*scale,z+(max(0,.055-y)*.12 if z>.02 else 0)) for x,y in outline])
    faces=[tuple(reversed(range(20))),tuple(40+i for i in range(20))]+[(ring*20+i,ring*20+(i+1)%20,(ring+1)*20+(i+1)%20,(ring+1)*20+i) for ring in range(2) for i in range(20)]
    part('Boots','Leather',vertices,faces,{label+'Foot':1})
    strand('Boots','Leather',[(ankle[0]+x,y,.019) for x,y in outline+[outline[0]]],.0022,label+'Foot','#c1ad94',6)
    loft('Boots','Leather',[(ankle[0],0,.07),(ankle[0],0,.16),(ankle[0],.012,.255)],[(.046,.040),(.046,.040),(.048,.042)],{label+'Shin':1},16)
    for i in range(5):
        z=.11+i*.025
        strand('Boots','BottomTrim',[(ankle[0]+.05*math.cos(j*math.tau/24),.043*math.sin(j*math.tau/24),z+.008*math.sin(j*math.tau/24)) for j in range(25)],.003,label+'Shin',sides=6)
for label,(shoulder,elbow,wrist,hand) in ARMS.items():
    loft('Body','Skin',curve(shoulder,(shoulder[0]*1.25,0,1.025),(elbow[0],.005,.91),elbow,10),[(.048-.010*i/10,.046-.012*i/10) for i in range(11)],{label+'UpperArm':1},16)
    loft('Body','Skin',curve(elbow,(elbow[0],.025,.83),(wrist[0],.03,.74),wrist,10),[(.031-.009*i/10,.031-.012*i/10) for i in range(11)],{label+'Forearm':1},16)
    loft('Hands','Skin',[wrist,hand],[(.03,.022),(.033,.025)],{'Hand'+label:1},12)
    for finger in range(4):
        x=wrist[0]-.023+finger*.015
        endz=.616+abs(finger-1.5)*.007
        loft('Hands','Skin',[(x,.073,.651),(x,.084,.638),(x,.081,endz)],[(.007,.008),(.007,.008),(.005,.005)],{'Hand'+label:1},8)
    loft('Hands','Skin',[(wrist[0]+(.035 if label=='L' else -.035),.048,.67),(wrist[0]+(.037 if label=='L' else -.037),.075,.645)],[(.01,.01),(.007,.008)],{'Hand'+label:1},8)
    loft('Gloves','Leather',[(wrist[0],.033,.713),hand],[(.034,.027),(.035,.027)],{'Hand'+label:1},14)
for outfit in ['cardigan','hoodie','overalls','sailor']:
    name='Outfit_'+outfit
    loft(name,'Top',[(0,0,.71),(0,0,.79),(0,0,.91),(0,0,1.045),(0,0,1.105),(0,0,1.157)],[(.150,.100),(.148,.096),(.144,.089),(.178,.089),(.183,.080),(.075,.060)],torso_weights,32,ridge=.03)
    for label,(shoulder,elbow,wrist,hand) in ARMS.items():
        side=1 if label=='L' else -1
        loft(name,'Top',[(side*.105,0,1.12),(side*.145,0,1.111),(side*.178,0,1.096),(side*.204,0,1.075)],[(.035,.035),(.060,.044),(.059,.044),(.047,.041)],lambda p,label=label:{'Chest':1-max(0,min(1,(abs(p.x)-.13)/.065)),label+'UpperArm':max(0,min(1,(abs(p.x)-.13)/.065))},20)
        strand(name,'TopShade',curve((side*.20,-.044,1.083),(side*.225,-.018,1.090),(side*.225,.018,1.090),(side*.20,.044,1.083),10),.0018,label+'UpperArm',sides=6)
        end=Vector(elbow) if outfit=='sailor' else Vector(wrist)+Vector((0,0,.035))
        centers=curve(Vector(shoulder)+Vector((-.02 if label=='L' else .02,0,.035)),Vector(shoulder)+(Vector(elbow)-Vector(shoulder))*.35,Vector(elbow)+(end-Vector(elbow))*.6,end,16)
        loft(name,'Top',centers,[(.062-.018*i/16+.012*math.sin(i/16*math.pi),.060-.021*i/16+.010*math.sin(i/16*math.pi)) for i in range(17)],lambda p,label=label: {label+'UpperArm':max(0,min(1,(p.z-.87)/.07)),label+'Forearm':max(0,min(1,(.94-p.z)/.07))},18,ridge=.025)
        loft(name,'TopTrim',[end+Vector((0,0,.014)),end-Vector((0,0,.009))],[(.047,.040),(.047,.040)],{label+'Forearm':1},18)
    for i in range(9):
        x=-.112+i*.028
        strand(name,'TopTrim',[(x,-.079,.728),(x,-.088,.754),(x,-.089,.778)],.0016,'Hips',sides=5)
    if outfit=='cardigan':
        for side in [-1,1]:
            strand(name,'TopTrim',curve((side*.026,.082,1.12),(side*.036,.097,1.01),(side*.012,.097,.87),(side*.009,.089,.73),14),.009,torso_weights)
        for i in range(5):
            z=.78+i*.061
            loft(name,'Detail',[(.008,.101,z),(.008,.108,z)],[(.007,.007),(.007,.007)],torso_weights,10,'#c6ab72')
    if outfit=='hoodie':
        loft(name,'TopShade',[(0,-.047,1.12),(0,-.052,1.16),(0,-.043,1.18)],[(.11,.073),(.095,.07),(.082,.06)],{'Chest':1},24)
        for side in [-1,1]:
            strand(name,'TopTrim',[(side*.046,.089,1.12),(side*.042,.105,1.04),(side*.048,.102,1.00)],.002,'Chest',sides=6)
        strand(name,'TopShade',curve((-.09,.095,.83),(-.11,.110,.9),(.11,.110,.9),(.09,.095,.83),12),.003,'Hips')
    if outfit=='overalls':
        part(name,'Bottom',[(-.085,.101,.76),(.085,.101,.76),(.08,.101,1.02),(-.08,.101,1.02)],[(0,1,2,3)],torso_weights)
        for side in [-1,1]:
            strand(name,'BottomTrim',curve((side*.07,.105,.98),(side*.09,.097,1.13),(side*.11,-.08,1.12),(side*.10,-.09,.82),15),.014,'Chest')
    if outfit=='sailor':
        part(name,'TopTrim',[(-.12,.05,1.15),(0,.111,1.015),(.12,.05,1.15),(0,-.09,1.16)],[(0,1,3),(1,2,3)],{'Chest':1})
for bottom in ['trousers','shorts','skirt']:
    name='Bottom_'+bottom
    loft(name,'Bottom',[(0,0,.65),(0,0,.73),(0,0,.78)],[(.12,.080),(.139,.090),(.13,.085)],{'Hips':1},24)
    if bottom!='skirt':
        strand(name,'BottomTrim',curve((0,.091,.735),(0,.091,.71),(0,.055,.70),(0,.015,.703),12),.0017,'Hips',sides=6)
    if bottom=='skirt':
        loft(name,'Bottom',[(0,0,.74),(0,0,.68),(0,0,.53),(0,.008,.44)],[(.145,.098),(.154,.105),(.177,.119),(.19,.126)],{'Hips':1},40,ridge=.08)
        strand(name,'BottomTrim',[(.19*math.cos(j*math.tau/48),.126*math.sin(j*math.tau/48),.445+.006*math.cos(j*math.tau/48*8)) for j in range(49)],.003,'Hips',sides=6)
    else:
        for label,(hip,knee,ankle,toe) in LEGS.items():
            end=Vector(ankle)+Vector((0,0,.08)) if bottom=='trousers' else Vector(knee)+Vector((0,0,.065))
            centers=curve(hip,Vector(hip)+Vector((0,.008,-.15)),Vector(end)+Vector((0,-.012,.08)),end,18)
            loft(name,'Bottom',centers,[(.082-.022*i/18+.006*math.sin(i/18*math.pi),.085-.024*i/18+.004*math.sin(i/18*math.pi)) for i in range(19)],lambda p,label=label:{label+'Thigh':max(0,min(1,(p.z-.36)/.08)),label+'Shin':max(0,min(1,(.44-p.z)/.08))},20,ridge=.02)
            loft(name,'BottomTrim',[end+Vector((0,0,.023)),end],[(.057,.057),(.057,.057)],{label+'Thigh' if bottom=='shorts' else label+'Shin':1},20)

for style in ['bun','bob','waves','crop']:
    name='Hair_'+style
    centers=[];radii=[]
    for i in range(14):
        t=i/13;angle=t*math.pi*.54
        centers.append((0,-.002,1.49-.15*(1-math.cos(angle))))
        radii.append((.009+.113*math.sin(angle),.008+.093*math.sin(angle)))
    vertices=[]
    for ring,(center,radius) in enumerate(zip(centers,radii)):
        for j in range(36):
            angle=j*math.tau/36
            front=max(0,math.sin(angle))
            z=1.504-(1.49-center[2])*(1-.62*front)
            vertices.append((math.cos(angle)*radius[0],-.002+math.sin(angle)*radius[1],z))
    faces=[(ring*36+j,ring*36+(j+1)%36,(ring+1)*36+(j+1)%36,(ring+1)*36+j) for ring in range(13) for j in range(36)]
    faces.append(tuple(reversed(range(36))))
    part(name,'Hair',vertices,faces,{'Head':1})
    for i in range(8):
        x=-.096+i*.0274
        points=curve((x*.30,.018,1.50),(x*.9,.08,1.49),(x+.009*math.sin(i),.096,1.449),(x+.006*math.sin(i*2),.082,1.414+math.sin(i*1.7)*.023),14)
        loft(name,'Hair',points,[(.0015+.012*math.sin(j/14*math.pi)**.6,.002+.007*math.sin(j/14*math.pi)) for j in range(15)],{'Head':1},10)
    if style=='bun':
        loft(name,'Hair',[(0,-.077,1.395),(0,-.119,1.43),(0,-.157,1.439),(0,-.179,1.421)],[(.048,.038),(.071,.058),(.062,.056),(.022,.025)],{'HairBack':1},24,ridge=.07)
        for i in range(5):
            strand(name,'Hair',[(.07*math.cos(j*math.tau/24+i*.3),-.141+.008*math.sin(j*math.tau/24),1.43+.058*math.sin(j*math.tau/24+i*.3)) for j in range(25)],.006,'HairBack',sides=6)
    if style in ['bob','waves']:
        for i in range(18):
            angle=math.pi*.58+i/17*math.pi*.84
            x=math.cos(angle)*.117;y=math.sin(angle)*.091
            bone='HairL' if x>.045 else 'HairR' if x<-.045 else 'HairBack'
            endz=1.23 if style=='bob' else 1.15+math.sin(i*1.3)*.018
            strand(name,'Hair',curve((x*.7,y*.7,1.475),(x*1.09,y*1.18,1.41),(x*(1.10 if style=='bob' else 1.28),y*1.35,1.31),(x*(.95 if style=='bob' else 1.17),y*1.20,endz),18),.017 if style=='bob' else .015,bone,sides=10)
    if style=='crop':
        for i in range(9):
            x=-.085+i*.021
            strand(name,'Hair',curve((x,-.075,1.45),(x*1.06,-.1,1.40),(x,-.097,1.36),(x*.97,-.092,1.35),8),.009,'Head')

cape_vertices=[]
for row in range(13):
    t=row/12
    for col in range(25):
        u=col/24*2-1
        x=u*(.16+t*.075)+.010*math.sin(u*math.pi)*math.sin(t*math.pi)
        z=1.13-t*.405+.018*math.cos(u*math.pi)*math.sin(t*math.pi)
        y=-.072-t*.14-.028*math.sin(t*math.pi)+.016*math.cos(u*math.pi*(3+t)+t*2)*(t*.8+.2)-.014*(1-u*u)
        cape_vertices.append((x,y,z))
cape_faces=[]
for row in range(12):
    for col in range(24):
        a=row*25+col;cape_faces.append((a,a+1,a+26,a+25))
part('Cape','Cape',cape_vertices,cape_faces,lambda p:{'CapeUpper':max(0,min(1,(p.z-.78)/.23)),'CapeLower':max(0,min(1,(1.01-p.z)/.23))})
cape_weights=lambda p:{'CapeUpper':max(0,min(1,(p.z-.78)/.23)),'CapeLower':max(0,min(1,(1.01-p.z)/.23))}
for col in [0,24]:
    strand('Cape','TopTrim',[Vector(cape_vertices[row*25+col])+Vector((0,-.0008,0)) for row in range(13)],.0027,cape_weights,sides=6)
strand('Cape','TopTrim',[Vector(p)+Vector((0,-.0008,0)) for p in cape_vertices[-25:]],.0027,cape_weights,sides=6)
loft('Cape','Cape',[(0,0,1.135),(0,-.003,1.165),(0,-.006,1.19)],[(.093,.072),(.087,.069),(.077,.061)],{'Chest':1},32,ridge=.04)
loft('Cape','Cape',[(0,-.064,1.145),(0,-.070,1.175),(0,-.071,1.165)],[(.103,.064),(.098,.075),(.091,.077)],{'Chest':1},28,ridge=.07)
for side in [-1,1]:
    strand('Cape','Leather',[(side*.08,.053,1.13),(side*.034,.099,1.105),(side*.008,.107,1.10)],.004,'Chest',sides=6)
loft('Cape','Detail',[(0,.102,1.103),(0,.111,1.103)],[(.012,.013),(.012,.013)],{'Chest':1},12,'#bba66c')
loft('Satchel','Leather',[(.244,-.017,.642),(.252,-.012,.665),(.26,-.013,.753),(.243,-.014,.798)],[(.038,.057),(.06,.069),(.062,.067),(.038,.057)],{'Satchel':1},20,ridge=.025)
part('Satchel','Leather',[(.282,-.086,.776),(.295,-.075,.707),(.295,.042,.707),(.282,.06,.776)],[(0,1,2,3)],{'Satchel':1},'#d7c5a8')
for i in range(12):
    y=-.066+i*.01
    strand('Satchel','Detail',[(.297,y,.716),(.298,y+.004,.716)],.0009,'Satchel','#d1b786',5)
strand('Satchel','Leather',curve((.25,.021,.77),(.09,.105,.92),(-.135,.097,1.12),(-.16,-.047,1.09),24),.011,lambda p:{'Satchel':1} if p.x>.20 and p.z<.85 else torso_weights(p))
strand('Satchel','Leather',curve((-.16,-.05,1.09),(-.1,-.115,.98),(.12,-.105,.88),(.245,-.03,.80),24),.011,lambda p:{'Satchel':1} if p.x>.20 and p.z<.85 else torso_weights(p))
for i in range(24):
    u=-.94+i/23*1.88
    x=u*.235;y=-.212+.016*math.cos(u*math.pi*4+2)-.014*(1-u*u)
    strand('Cape','TopTrim',[(x,y,.742),(x+.003,y,.742)],.0008,'CapeLower',sides=5)
for name in ['glasses','blossom','moon-clips']:
    mesh='Accessory_'+name
    if name=='glasses':
        for side in [-1,1]:
            strand(mesh,'Detail',[(side*.047+.035*math.cos(j*math.tau/32),.119,1.357+.026*math.sin(j*math.tau/32)) for j in range(33)],.002,'Head','#584d43',6)
        strand(mesh,'Detail',[(-.014,.119,1.362),(0,.125,1.365),(.014,.119,1.362)],.002,'Head','#584d43',6)
    else:
        for side in ([1] if name=='blossom' else [-1,1]):
            for i in range(5 if name=='blossom' else 7):
                a=i*math.tau/(5 if name=='blossom' else 10)
                loft(mesh,'Detail',[(side*.095+math.cos(a)*.012,.095,1.425+math.sin(a)*.012),(side*.095+math.cos(a)*.023,.10,1.425+math.sin(a)*.023)],[(.007,.004),(.004,.003)],{'Head':1},8,'#e9bdbe' if name=='blossom' else '#d3c499')

loft('Blade','Leather',[(-.29,.067,.695),(-.29,.157,.695)],[(.019,.020),(.019,.020)],{'BladeBase':1},12)
loft('Blade','Detail',[(-.36,.161,.695),(-.29,.163,.695),(-.22,.161,.695)],[(.008,.009),(.009,.010),(.008,.009)],{'BladeBase':1},10,'#b9a470')
blade_vertices=[]
for y,width in [(.176,.028),(.20,.027),(.645,.02),(.715,0)]:
    blade_vertices.extend([(-.29-width,y,.695),(-.29,y,.705),(-.29+width,y,.695),(-.29,y,.685)])
blade_faces=[]
for ring in range(3):
    for j in range(4):
        a=ring*4+j;b=ring*4+(j+1)%4;blade_faces.append((a,b,b+4,a+4))
part('Blade','BladeSteel',blade_vertices,blade_faces,lambda p:{'BladeTip':1} if p.y>.69 else {'BladeBase':1})

loft('Cape','Cape',[(0,-.132,1.128),(0,-.137,1.15),(0,-.129,1.178)],[(.077,.020),(.098,.023),(.073,.018)],{'Chest':1},28)
objects=[]
for (name,material),buf in BUFFERS.items():
    mesh=bpy.data.meshes.new(name+'_'+material);mesh.from_pydata(buf['v'],[],buf['f']);mesh.update()
    colors=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
    for i,color in enumerate(buf['c']):colors.data[i].color=color
    obj=bpy.data.objects.new(name+'_'+material,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(MATERIALS[material])
    for bone in arm.bones:obj.vertex_groups.new(name=bone.name)
    for i,weights in enumerate(buf['w']):
        for bone,weight in weights.items():obj.vertex_groups[bone].add([i],weight,'REPLACE')
    modifier=obj.modifiers.new('WeightedHero','ARMATURE');modifier.object=rig
    for polygon in mesh.polygons:polygon.use_smooth=True
    objects.append(obj)

for obj in objects:
    if obj.name=='Body_Skin':
        for vertex in obj.data.vertices:
            if abs(vertex.co.z-.68)<.00001:vertex.co.z+=.045*math.exp(-(vertex.co.x/.05)**2)
    if obj.name not in ['Bottom_trousers_Bottom','Bottom_shorts_Bottom']:
        continue
    for vertex in obj.data.vertices:
        if abs(vertex.co.z-.65)<.00001:
            vertex.co.z+=.055*math.exp(-(vertex.co.x/.048)**2)
    for modifier in list(obj.modifiers):obj.modifiers.remove(modifier)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    remesh=obj.modifiers.new('ContinuousCloth','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.008;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=obj.modifiers.new('SoftSeams','SMOOTH');smooth.factor=.45;smooth.iterations=3
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate=obj.modifiers.new('ClothBudget','DECIMATE');decimate.ratio=.28
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for group in list(obj.vertex_groups):obj.vertex_groups.remove(group)
    for bone in arm.bones:obj.vertex_groups.new(name=bone.name)
    for attribute in list(obj.data.color_attributes):obj.data.color_attributes.remove(attribute)
    colors=obj.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
    for vertex in obj.data.vertices:
        p=vertex.co;label='L' if p.x>=0 else 'R'
        hip=max(0,min(1,(p.z-.585)/.12))
        shin=max(0,min(1,(.46-p.z)/.13))
        weights={'Hips':hip,label+'Thigh':(1-hip)*(1-shin),label+'Shin':(1-hip)*shin}
        for bone,weight in weights.items():
            if weight>0:obj.vertex_groups[bone].add([vertex.index],weight,'REPLACE')
        shade=.97+.025*math.sin(p.z*33+p.x*21+p.y*17);colors.data[vertex.index].color=(shade,shade,shade,1)
    for polygon in obj.data.polygons:polygon.use_smooth=True
    modifier=obj.modifiers.new('WeightedHero','ARMATURE');modifier.object=rig
bpy.context.view_layer.objects.active=rig

DURATIONS={'idle':2,'walk':1,'run':.5,'sprint':.38,'strafeLeft':.5,'strafeRight':.5,'backpedal':.5,'jump':.36,'fall':1,'land':.12,'dodge':.42,'charge':.38,'light1':.42,'light2':.46,'light3':.58,'heavy':.82,'climb':1,'climbLeap':.35,'glide':1.6,'swim':1,'hit':.3,'knockedOut':1.6,'getup':.7,'victory':1.6,'pet':1,'whistle':1,'parry':.45,'knockback':.5}
ATTACKS={'light1':(.12,.23,2.3),'light2':(.14,.26,2.6),'light3':(.20,.34,2.8),'heavy':(.25,.43,2.5)}
scene=bpy.context.scene;scene.render.fps=FPS
rig.animation_data_create()
for pose in rig.pose.bones:pose.rotation_mode='XYZ'


def ease(t):
    t=max(0,min(1,t));return t*t*(3-2*t)


def rotate(name,x=0,y=0,z=0):
    rig.pose.bones[name].rotation_euler=(x,y,z)


def move(name,x=0,y=0,z=0):
    rig.pose.bones[name].location=arm.bones[name].matrix_local.to_3x3().inverted()@Vector((x,y,z))


def world_turn(name,axis,angle):
    local=arm.bones[name].matrix_local.to_3x3().inverted()@Vector(axis)
    rig.pose.bones[name].rotation_euler=Quaternion(local,angle).to_euler()


def hand_target(label,point):
    wrist=Vector(ARMS[label][2]);delta=Vector(point)-wrist;move('CTRLHand'+label,*delta)


for clip,duration in DURATIONS.items():
    frames=round(duration*FPS)
    rig.animation_data.action=bpy.data.actions.new(clip+'-authored')
    for frame in range(frames+1):
        t=frame/FPS
        for pose in rig.pose.bones:pose.location=(0,0,0);pose.rotation_euler=(0,0,0);pose.scale=(1,1,1)
        world_turn('CTRLHandR',(1,0,0),-.9)
        breath=math.sin(t*math.tau/2)
        rotate('Chest',.01*breath)
        rotate('Head',-.015*breath)
        blink=1-.96*math.exp(-((t%2-1.68)/.04)**2)
        rig.pose.bones['EyeL'].scale.y=blink;rig.pose.bones['EyeR'].scale.y=blink
        rotate('CapeUpper',.035*breath);rotate('CapeLower',.055*breath)
        rotate('HairBack',.016*breath);rotate('HairL',.012*breath);rotate('HairR',-.012*breath)
        gait=clip in ['walk','run','sprint','strafeLeft','strafeRight','backpedal']
        if gait:
            speed=1.2 if clip=='walk' else 7 if clip=='sprint' else 4
            duty=.6 if clip=='walk' else .27 if clip=='sprint' else .35
            span=speed*duration*duty
            axis=Vector((-1,0,0)) if clip=='strafeLeft' else Vector((1,0,0)) if clip=='strafeRight' else Vector((0,-1,0)) if clip=='backpedal' else Vector((0,1,0))
            for i,label in enumerate(LEGS):
                phase=(t/duration+i*.5)%1
                if phase<duty:
                    offset=span*(.5-phase/duty);lift=0
                else:
                    u=(phase-duty)/(1-duty);offset=span*(-.5+ease(u));lift=.09*math.sin(u*math.pi)
                delta=axis*offset;move('CTRLFoot'+label,delta.x,delta.y,lift)
                hand_target(label,Vector(ARMS[label][2])+Vector((0,-delta.y*.32,0)))
            half=(t/duration)% .5
            flight=(half-duty)/(.5-duty) if clip!='walk' and half>duty else 0
            airborne=.065*math.sin(flight*math.pi) if flight else 0
            move('Root',z=-.10+airborne)
            rotate('Chest',-.10 if clip!='walk' else -.025)
            rotate('CapeUpper',-.15+.07*math.sin(t/duration*math.tau));rotate('CapeLower',-.14+.11*math.sin(t/duration*math.tau-.5))
            rotate('Satchel',.06*math.sin(t/duration*math.tau))
        elif clip in ATTACKS:
            start,end,arc=ATTACKS[clip]
            swing=-arc/2*ease(t/start) if t<start else -arc/2+arc*ease((t-start)/(end-start)) if t<end else arc/2*(1-ease((t-end)/(duration-end)))
            if clip=='light2':swing=-swing
            reach=.49 if clip!='heavy' else .54
            target=Vector((-math.sin(swing)*reach,math.cos(swing)*reach,1.00 if clip!='light3' else 1.08))
            hand_target('R',target)
            hand_target('L',(.19,.13,.93))
            rotate('Chest',-.15*math.sin(t/duration*math.pi),swing*.16,0)
            move('Root',y=.07*math.sin(t/duration*math.pi),z=-.055*math.sin(t/duration*math.pi))
            world_turn('CTRLHandR',(0,0,1),swing)
            rotate('CapeUpper',.09*math.sin(swing));rotate('CapeLower',.15*math.sin(swing-.4))
        elif clip in ['jump','fall','land','climbLeap']:
            fold=math.sin(t/duration*math.pi) if clip in ['jump','land','climbLeap'] else .45
            move('Root',z=-.08*fold if clip=='land' else 0)
            for label in LEGS:move('CTRLFoot'+label,y=-.05*fold,z=.12*fold if clip!='land' else 0)
            hand_target('L',(.23,.13,1.05));hand_target('R',(-.23,.13,1.05))
        elif clip=='dodge':
            roll=ease(t/duration);angle=-math.tau*roll;fold=math.sin(roll*math.pi)
            root_y=-.69*math.sin(math.tau*roll);root_z=.69-.24*fold-.69*math.cos(angle)
            rotate('Root',angle);move('Root',y=root_y,z=root_z);rotate('Chest',-.95*fold);rotate('Neck',-.80*fold);rotate('Head',-.30*fold)
            def roll_point(point):
                p=Vector(point);return Vector((p.x,math.cos(angle)*p.y-math.sin(angle)*p.z+root_y,math.sin(angle)*p.y+math.cos(angle)*p.z+root_z))
            for label in LEGS:
                point=roll_point(Vector(LEGS[label][2])+Vector((0,.10*fold,.32*fold)))
                delta=point-Vector(LEGS[label][2]);move('CTRLFoot'+label,*delta);world_turn('CTRLFoot'+label,(1,0,0),angle)
            for label in ARMS:
                hand_target(label,roll_point(Vector(ARMS[label][2])+Vector((0,.15*fold,.18*fold))))
                world_turn('CTRLHand'+label,(1,0,0),angle-(.9 if label=='R' else 0))
        elif clip=='charge':
            fold=ease(t/duration)
            hand_target('R',(-.30,-.13,1.14));hand_target('L',(.14,.19,1.05))
            rotate('Chest',.12*fold,0,-.20*fold);move('Root',z=-.06*fold)
        elif clip=='parry':
            fold=math.sin(t/duration*math.pi)
            hand_target('R',(-.16,.29,1.07));hand_target('L',(.16,.16,.95));rotate('Chest',.12*fold)
        elif clip in ['hit','knockback','knockedOut','getup']:
            fold=ease(t/.5) if clip=='knockedOut' else 1-ease(t/duration) if clip=='getup' else math.sin(t/duration*math.pi)
            rotate('Root',-.6*fold if clip in ['knockedOut','getup'] else .16*fold)
            move('Root',z=-.38*fold if clip in ['knockedOut','getup'] else -.04*fold)
            rotate('Head',.18*fold);hand_target('L',(.19,.12,.87));hand_target('R',(-.19,.12,.87))
        elif clip=='climb':
            move('Root',y=.09);rotate('Chest',-.06)
            for i,label in enumerate(LEGS):
                wave=math.sin(t*math.tau+i*math.pi)
                move('CTRLFoot'+label,y=.16,z=.20+wave*.11)
                hand_target(label,(ARMS[label][0][0],.27,1.16+wave*.09))
        elif clip in ['glide','swim']:
            if clip=='swim':rotate('Root',-1.05);move('Root',y=-.2,z=.22)
            for i,label in enumerate(LEGS):
                move('CTRLFoot'+label,y=-.10,z=.09+.08*math.sin(t*math.tau+i*math.pi) if clip=='swim' else .12)
                hand_target(label,((1 if label=='L' else -1)*.32,.21,1.17 if clip=='glide' else .94+.08*math.sin(t*math.tau+i*math.pi)))
            rotate('CapeUpper',-.24);rotate('CapeLower',-.3)
        elif clip=='victory':
            hand_target('R',(-.17,.08,1.43));hand_target('L',(.16,.12,.9));rotate('Head',-.10)
        elif clip=='pet':
            fold=.85+.1*math.sin(t*math.tau);rotate('Chest',-.62*fold);move('Root',y=.15,z=-.30)
            hand_target('L',(.11,.58,.48+.025*math.sin(t*math.tau)));hand_target('R',(-.17,.15,.77))
        elif clip=='whistle':
            hand_target('L',(.06,.14,1.28));rotate('Head',-.06)
        if clip=='dodge':
            bpy.context.view_layer.update()
            lowest=0
            for obj in objects:
                evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
                lowest=min(lowest,min(v.co.z for v in mesh.vertices));evaluated.to_mesh_clear()
            correction=max(0,.004-lowest)
            for name in ['Root']+[bone.name for bone in rig.pose.bones if bone.name.startswith('CTRL')]:
                rig.pose.bones[name].location+=arm.bones[name].matrix_local.to_3x3().inverted()@Vector((0,0,correction))
        for pose in rig.pose.bones:
            pose.keyframe_insert('location',frame=frame+1);pose.keyframe_insert('rotation_euler',frame=frame+1);pose.keyframe_insert('scale',frame=frame+1)
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.ops.object.mode_set(mode='POSE')
    authored=rig.animation_data.action
    bpy.ops.nla.bake(frame_start=1,frame_end=frames+1,step=1,only_selected=False,visual_keying=True,clear_constraints=False,use_current_action=False,bake_types={'POSE'})
    baked=rig.animation_data.action;baked.name=clip;baked.use_fake_user=True
    bpy.ops.object.mode_set(mode='OBJECT');bpy.data.actions.remove(authored)
for pose in rig.pose.bones:
    for constraint in list(pose.constraints):pose.constraints.remove(constraint)
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)

triangles=0
for obj in objects:
    obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    for vertex in obj.data.vertices:
        weights=[g.weight for g in vertex.groups if g.weight>1e-6]
        assert len(weights)<=4 and abs(sum(weights)-1)<.0001
blade=next(obj for obj in objects if obj.name=='Blade_BladeSteel')
blade_indices=[vertex.index for vertex in blade.data.vertices if any(blade.vertex_groups[g.group].name=='BladeTip' and g.weight>.9 for g in vertex.groups)]
contacts={}
for clip,(start,end,arc) in ATTACKS.items():
    rig.animation_data.action=bpy.data.actions[clip]
    rows=[]
    for fraction in [i/16 for i in range(17)]:
        elapsed=start+(end-start)*fraction;frame=1+elapsed*FPS;scene.frame_set(int(frame),subframe=frame-int(frame))
        evaluated=blade.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();vertices=[mesh.vertices[i].co.copy() for i in blade_indices]
        rows.append({'elapsed':elapsed,'reach':max(math.hypot(v.x,v.y) for v in vertices),'height':sum(v.z for v in vertices)/len(vertices),'tip':list(sum(vertices,Vector())/len(vertices)),'tipThree':[vertices[0].x,vertices[0].z,-vertices[0].y],'baseThree':[rig.pose.bones['BladeBase'].matrix.translation.x,rig.pose.bones['BladeBase'].matrix.translation.z,-rig.pose.bones['BladeBase'].matrix.translation.y]})
        evaluated.to_mesh_clear()
    contacts[clip]=rows
gait_samples=[]
boot=next(obj for obj in objects if obj.name=='Boots_Leather')
foot_group=boot.vertex_groups['LFoot'].index
foot_indices=[v.index for v in boot.data.vertices if any(g.group==foot_group and g.weight>.99 for g in v.groups)]
for clip,cycle,duty,speed,axis in [('walk',1,.6,1.2,(0,1)),('run',.5,.35,4,(0,1)),('sprint',.38,.27,7,(0,1)),('strafeLeft',.5,.35,4,(-1,0)),('strafeRight',.5,.35,4,(1,0)),('backpedal',.5,.35,4,(0,-1))]:
    rig.animation_data.action=bpy.data.actions[clip];points=[]
    for fraction in [.15,.3,.45,.6,.75]:
        elapsed=cycle*duty*fraction;frame=1+elapsed*FPS;scene.frame_set(int(frame),subframe=frame-int(frame))
        evaluated=boot.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();vertices=[mesh.vertices[i].co.copy() for i in foot_indices]
        center=sum(vertices,Vector())/len(vertices)
        points.append((elapsed,center.x+elapsed*speed*axis[0],center.y+elapsed*speed*axis[1],min(v.z for v in vertices)))
        evaluated.to_mesh_clear()
    drift=max(math.hypot(b[1]-a[1],b[2]-a[2])/(b[0]-a[0]) for a,b in zip(points,points[1:]))
    assert drift<.25 and min(p[3] for p in points)>-.015
    gait_samples.append({'clip':clip,'worldStanceVelocity':drift,'soleMinimum':min(p[3] for p in points),'soleMaximum':max(p[3] for p in points)})
rig.animation_data.action=bpy.data.actions['pet'];scene.frame_set(40)
hand=next(obj for obj in objects if obj.name=='Hands_Skin');group=hand.vertex_groups['HandL'].index
hand_indices=[v.index for v in hand.data.vertices if any(g.group==group and g.weight>.9 for g in v.groups)]
evaluated=hand.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();vertices=[mesh.vertices[i].co.copy() for i in hand_indices]
pet_hand={'forwardReach':max(v.y for v in vertices),'height':sum(v.z for v in vertices)/len(vertices)}
evaluated.to_mesh_clear()
roll_samples=[]
rig.animation_data.action=bpy.data.actions['dodge']
for frame in range(1,round(DURATIONS['dodge']*FPS)+2):
    scene.frame_set(frame);lowest=100
    for obj in objects:
        evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        lowest=min(lowest,min(v.co.z for v in mesh.vertices));evaluated.to_mesh_clear()
    assert lowest>=-.001,(frame,lowest)
    roll_samples.append({'elapsed':(frame-1)/FPS,'minimumHeight':lowest})
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
summary={'trianglesAllVariants':triangles,'bones':len(arm.bones),'clips':DURATIONS,'attackContacts':contacts,'rollSamples':roll_samples,'gaitSamples':gait_samples,'petHand':pet_hand,'gaitReferences':{'walk':1.2,'run':4,'sprint':7},'forward':'+Y Blender / -Z Three'}
print('HERO',json.dumps(summary));(OUTPUT/'hero-build.json').write_text(json.dumps(summary,indent=2))

if '--export-only' not in ARGS:
    defaults=['Hair_bun','Outfit_cardigan','Bottom_trousers']
    for obj in objects:
        variant=obj.name.startswith(('Hair_','Outfit_','Bottom_','Accessory_'))
        obj.hide_render=variant and not any(obj.name.startswith(name+'_') for name in defaults)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));ground=bpy.context.object;ground.name='ReviewGround'
    ground_material=bpy.data.materials.new('ReviewGroundMaterial');ground_material.diffuse_color=(.29,.32,.32,1);ground.data.materials.append(ground_material)
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    world=bpy.data.worlds.new('ReviewWorld');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.42,.49,.55,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55;scene.world=world
    for name,position,power,color,size in [('Key',(3,4,5),450,(1,.86,.69),4),('Fill',(-3,2,3),200,(.70,.84,1),3),('Rim',(0,-3,4),400,(.82,.94,1),3)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size;obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector((0,0,.8))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera_data=bpy.data.cameras.new('ReviewCamera');camera=bpy.data.objects.new('ReviewCamera',camera_data);bpy.context.collection.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=1.9
    views=[('front',(0,5,2.0),'idle',1),('side',(5,0,1.7),'idle',1),('back',(0,-5,2.0),'idle',1),('threequarter',(4,5,2.5),'idle',1),('light1',(4,5,2.5),'light1',18),('heavy',(4,5,2.5),'heavy',35),('run',(4,5,2.5),'run',12),('glide',(4,5,2.5),'glide',40),('pet',(4,5,2.5),'pet',40),('dodge-quarter',(4,5,2.5),'dodge',12),('dodge-mid',(4,5,2.5),'dodge',22),('dodge-threequarter',(4,5,2.5),'dodge',32),('climb',(4,5,2.5),'climb',40),('swim',(4,5,2.5),'swim',40)]
    if '--review-four' in ARGS:views=views[:4]
    if '--review-roll' in ARGS:views=[view for view in views if view[0].startswith('dodge')]
    for name,position,clip,frame in views:
        rig.animation_data.action=bpy.data.actions[clip];scene.frame_set(frame);camera.location=position;camera.rotation_euler=(Vector((0,0,.78))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUTPUT/(name+'.png'));bpy.ops.render.render(write_still=True)
    rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
if '--renders-only' not in ARGS:
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for obj in objects:obj.hide_set(False);obj.select_set(True)
    target=ROOT/'public'/'wilds'/'hero.glb';target.parent.mkdir(parents=True,exist_ok=True)
    valid=set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    options={'filepath':str(target),'export_format':'GLB','use_selection':True,'export_animations':True,'export_animation_mode':'ACTIONS','export_force_sampling':True,'export_def_bones':True,'export_apply':False,'export_yup':True,'export_anim_slide_to_zero':True}
    bpy.ops.export_scene.gltf(**{k:v for k,v in options.items() if k in valid})
    data=target.read_bytes();length,kind=struct.unpack('<II',data[12:20]);document=json.loads(data[20:20+length])
    for material in document['materials']:
        material.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=list(tone(PALETTE[material['name']]))
    payload=json.dumps(document,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
    tail=data[20+length:];target.write_bytes(struct.pack('<III',0x46546c67,2,20+len(payload)+len(tail))+struct.pack('<II',len(payload),kind)+payload+tail)
    print('EXPORTED',target)
