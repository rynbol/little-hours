import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT.parent / 'wilds-assets/progress-shots/wilds-three-codex/stage5-pets'
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if '--organic-candidate' in ARGS:
    OUTPUT=OUTPUT/'organic-candidate'
OUTPUT.mkdir(parents=True, exist_ok=True)
FPS = 60
SPECIES = {
    'cat': dict(height=.65, length=.69, width=.145, skull=.155, muzzle=.035, ear=.13, tail=.50, fur='#da8c42', cream='#f6ddb0', dark='#9b522c', iris='#8b984c'),
    'dog': dict(height=.70, length=.74, width=.175, skull=.17, muzzle=.105, ear=.21, tail=.31, fur='#ad7951', cream='#f2dfbb', dark='#71442c', iris='#885f30'),
    'bunny': dict(height=.60, length=.46, width=.18, skull=.15, muzzle=.045, ear=.29, tail=.09, fur='#ab9b87', cream='#f4ead9', dark='#796858', iris='#725547'),
    'fox': dict(height=.65, length=.68, width=.145, skull=.145, muzzle=.115, ear=.16, tail=.58, fur='#d78342', cream='#f7e4c6', dark='#543c34', iris='#9e753b'),
    'panda': dict(height=.65, length=.63, width=.22, skull=.17, muzzle=.055, ear=.10, tail=.58, fur='#b65f36', cream='#f1dfbd', dark='#493a33', iris='#866e39'),
    'wolf': dict(height=.95, length=1.01, width=.21, skull=.20, muzzle=.15, ear=.19, tail=.57, fur='#8b9597', cream='#e4ded0', dark='#58626c', iris='#b0995c')
}
DURATIONS = {'idle':2.4,'walk':.50,'run':.30,'sit':1.8,'sniff':1.5,'pet':1.8,'pounce':.8,'swipe':.8,'spin':.8,'dash':.7,'hit':.38,'knockedOut':1.2,'climb':.65,'swim':.65,'bow':1.8}


def tone(hex):
    return tuple((int(hex[i:i+2],16)/255)**2.2 for i in (1,3,5))+(1,)


def ease(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)


def build(species,cfg):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    materials={}
    for name,roughness in [('Coat',.85),('Eyes',.24),('Nose',.55)]:
        mat=bpy.data.materials.new(species+'-'+name)
        mat.use_nodes=True
        shader=mat.node_tree.nodes.get('Principled BSDF')
        colors=mat.node_tree.nodes.new('ShaderNodeVertexColor')
        colors.layer_name='Col'
        mat.node_tree.links.new(colors.outputs['Color'],shader.inputs['Base Color'])
        shader.inputs['Roughness'].default_value=roughness
        materials[name]=mat
    buffers={name:dict(v=[],f=[],c=[],w=[]) for name in materials}
    facial_indices=set()
    organic=True
    h=cfg['height']; length=cfg['length']; width=cfg['width']; skull=cfg['skull']
    hipz=h*(.43 if species=='panda' else .45 if species=='bunny' else .55); heady=length*.44; headz=h-skull*.80
    def part(vertices,faces,color,weights,mat='Coat'):
        buf=buffers[mat]; start=len(buf['v'])
        for p in vertices:
            p=Vector(p)
            base=tone(color(p) if callable(color) else color)
            shade=1+.025*math.sin(p.x*69+p.y*53+p.z*41)
            buf['v'].append(tuple(p));buf['c'].append(tuple(v*shade for v in base[:3])+(1,))
            raw=weights(p) if callable(weights) else weights
            raw=dict(sorted(raw.items(),key=lambda pair:-pair[1])[:4]);total=sum(raw.values())
            buf['w'].append({name:weight/total for name,weight in raw.items()})
        buf['f'].extend(tuple(start+i for i in face) for face in faces)
    def loft(points,radii,color,weights,sides=28,mat='Coat',ridge=.0):
        vertices=[]
        for ring,(p,r) in enumerate(zip(points,radii)):
            tangent=(Vector(points[min(ring+1,len(points)-1)])-Vector(points[max(ring-1,0)])).normalized()
            ref=Vector((1,0,0)) if abs(tangent.x)<.8 else Vector((0,1,0))
            u=(ref-tangent*ref.dot(tangent)).normalized();v=tangent.cross(u).normalized()
            for side in range(sides):
                a=side*math.tau/sides
                n=1+ridge*math.sin(a*7+ring*.7)
                vertices.append(Vector(p)+u*math.cos(a)*r[0]*n+v*math.sin(a)*r[1]*n)
        faces=[]
        for ring in range(len(points)-1):
            for side in range(sides):
                a=ring*sides+side;b=ring*sides+(side+1)%sides
                faces.append((a,b,b+sides,a+sides))
        faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+i for i in range(sides))])
        part(vertices,faces,color,weights,mat)
    def oval(center,scale,color,weights,mat='Coat',rings=10,sides=24):
        points=[(center[0],center[1]+math.sin((i/rings-.5)*math.pi)*scale[1],center[2]) for i in range(rings+1)]
        radii=[(max(.0004,math.cos((i/rings-.5)*math.pi))*scale[0],max(.0004,math.cos((i/rings-.5)*math.pi))*scale[2]) for i in range(rings+1)]
        loft(points,radii,color,weights,sides,mat)
    def fur_color(p):
        if p.z<hipz*.83 and species in ('panda','fox','wolf'):
            return cfg['dark'] if species=='panda' else cfg['cream']
        if species=='wolf' and p.z>hipz+.09 and abs(p.x)<width*.65:return cfg['dark']
        if species=='cat' and p.z>hipz and math.sin(p.y*44+abs(p.x)*14)> .67:
            return cfg['dark']
        return cfg['fur']
    def body_weights(p):
        a=max(0,min(1,(p.y+length*.25)/(length*.6)))
        return {'pelvis':1-a,'chest':a}
    bones=[('root',(0,0,0),(0,0,.12),None),('pelvis',(0,-length*.24,hipz),(0,0,hipz),'root'),('chest',(0,0,hipz),(0,length*.30,hipz+.03),'pelvis'),('neck',(0,length*.29,hipz+.03),(0,heady,headz),'chest'),('head',(0,heady-.06,headz),(0,heady+.13,headz),'neck')]
    bones.append(('muzzle',(0,heady+skull*.82+cfg['muzzle'],headz-skull*.20),(0,heady+skull*.82+cfg['muzzle']+.025,headz-skull*.20),'head'))
    legs={}
    for i,(label,x,y) in enumerate([('Front-L',width*.82,length*.27),('Front-R',-width*.82,length*.27),('Hind-L',width*.84,-length*.30),('Hind-R',-width*.84,-length*.30)]):
        fore=label.startswith('Front'); knee_y=y+(-.12 if fore else .14)*(h/.65)
        hip=(x*.66,y,hipz+.035);knee=(x,knee_y,hipz*.52);ankle=(x,y,.07);toe=(x,y+.075,.055)
        legs[label]=(hip,knee,ankle,toe)
        bones.extend([(label+'-upper',hip,knee,'chest' if fore else 'pelvis'),(label+'-lower',knee,ankle,label+'-upper'),(label+'-paw',ankle,toe,label+'-lower'),('CTRL-'+label,ankle,toe,'root')])
    for side in [-1,1]:
        label='L' if side>0 else 'R'
        earbase=(side*skull*.70,heady-.018,headz+skull*.40)
        eartip=(side*skull*.93,heady-.07,headz+skull*.65+cfg['ear'])
        if species=='dog':eartip=(side*skull*1.22,heady+.015,headz-.055)
        bones.append(('ear-'+label,earbase,eartip,'head'))
        bones.append(('blink-'+label,(side*skull*.57,heady+skull*.69,headz+.023),(side*skull*.57,heady+skull*.74,headz+.06),'head'))
    tailpoints=[]
    for i in range(13):
        t=i/12
        tailpoints.append((.035*math.sin(t*math.pi),-length*.43-cfg['tail']*t,hipz+.10+(.22 if species=='cat' else -.13)*t+.10*math.sin(t*math.pi)))
    for i in range(3):
        bones.append(('tail-'+str(i),tailpoints[i*4],tailpoints[(i+1)*4],'pelvis' if i==0 else 'tail-'+str(i-1)))
    data=bpy.data.armatures.new(species+'Rig');rig=bpy.data.objects.new('PartnerRig',data);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for name,head,tail,parent in bones:
        bone=data.edit_bones.new(name);bone.head=head;bone.tail=tail
        if parent:bone.parent=data.edit_bones[parent]
        if name.startswith('CTRL-'):bone.use_deform=False
    bpy.ops.object.mode_set(mode='OBJECT')
    for label in legs:
        ik=rig.pose.bones[label+'-lower'].constraints.new('IK');ik.target=rig;ik.subtarget='CTRL-'+label;ik.chain_count=2;ik.use_tail=True;ik.use_stretch=False;ik.iterations=64
        copy=rig.pose.bones[label+'-paw'].constraints.new('COPY_ROTATION');copy.target=rig;copy.subtarget='CTRL-'+label;copy.target_space='WORLD';copy.owner_space='WORLD'
    points=[];radii=[]
    for i in range(25):
        t=i/24;y=(t-.5)*length
        z=hipz+.025+ .025*math.sin(t*math.pi)+.02*math.exp(-((t-.8)/.2)**2)
        bulge=math.sin(t*math.pi)**.48
        points.append((0,y,z));radii.append((max(.005,width*bulge*((1+.28*(1-t)) if species=='bunny' else (1+.10*math.cos(t*math.tau)))),max(.005,h*(.27 if species in ('bunny','panda') else .235)*bulge)))
    loft(points,radii,fur_color,body_weights,28,ridge=.004)
    loft([(0,length*.19,hipz),(0,length*.29,hipz+.08),(0,heady,headz-.035)],[(width*.82,h*.17),(width*.72,h*.155),(skull*.75,skull*.8)],cfg['fur'],{'neck':.65,'chest':.35},32)
    points=[];radii=[]
    for i in range(23):
        t=i/22
        points.append((0,heady-skull*.67+t*(skull*1.48+cfg['muzzle']),headz-.012*t))
        swell=math.sin(t*math.pi)**.62
        muzzle=math.exp(-((t-.84)/.16)**2)
        radii.append((.003+skull*swell*(1-.35*t)+cfg['muzzle']*.23*muzzle,.003+skull*swell*(.96-.38*t)))
    def head_color(p):
        if species=='panda' and (p.y>heady+.045 and abs(p.x)>skull*.38):return cfg['cream']
        if p.z<headz-skull*.33:return cfg['cream']
        if species=='cat' and p.z>headz+skull*.52 and math.sin(p.x*68+p.y*19)>.5:return cfg['dark']
        return cfg['fur']
    loft(points,radii,head_color,{'head':1},36,ridge=.003)
    if organic and species=='cat':
        oval((0,heady+skull*.77,headz-skull*.27),(.098,.054,.061),cfg['cream'],{'head':1},rings=12,sides=28)
    facial_start=len(buffers['Coat']['v'])
    for side in [-1,1]:
        label='L' if side>0 else 'R';bone='ear-'+label
        base=data.bones[bone].head_local;tip=data.bones[bone].tail_local
        earpoints=[base.lerp(tip,i/10) for i in range(11)]
        if species=='dog':
            ear_radii=[(.025+.056*math.sin(i/10*math.pi),.015+.02*math.sin(i/10*math.pi)) for i in range(11)]
        elif species=='panda':
            ear_radii=[(.006+.065*math.sin(i/10*math.pi),.008+.025*math.sin(i/10*math.pi)) for i in range(11)]
        else:
            ear_radii=[((.008+.034*math.sin(i/10*math.pi)) if species=='bunny' else .015+.055*(1-i/10)**.7,.006+.018*(1-i/10)) for i in range(11)]
        loft(earpoints,ear_radii,cfg['dark'] if species=='dog' else cfg['fur'],{bone:1},20)
        inner=[p+Vector((0,.013,0)) for p in earpoints[2:10]]
        loft(inner,[(r[0]*.55,.005) for r in ear_radii[2:10]],'#d99d8d' if species in ('bunny','cat') else cfg['cream'],{bone:1},12)
        eyex=side*skull*.56;eyey=heady+skull*.72+cfg['muzzle']*.50-.013;eyez=headz+.025
        oval((eyex,eyey-.008,eyez),(.0476,.02125,.05185),cfg['dark'],{'head':1},'Eyes' if organic else 'Coat',sides=18,rings=6)
        oval((eyex,eyey+.006,eyez),(.0357,.0221,.03995),'#f8edce',{'blink-'+label:1},'Eyes',8,18)
        oval((eyex-side*.007,eyey+.029,eyez),(.02295,.01105,.02975),cfg['iris'],{'blink-'+label:1},'Eyes',6,16)
        oval((eyex-side*.007,eyey+.040,eyez+.002),(.01445,.00765,.0221),'#252426',{'blink-'+label:1},'Eyes',6,16)
        oval((eyex-side*.011,eyey+.047,eyez+.016),(.00765,.00425,.00765),'#fff5d5',{'blink-'+label:1},'Eyes',6,12)
        oval((side*skull*.35,heady+skull*.79+cfg['muzzle']*.55,headz-skull*.34),((.054,.030,.035) if species=='cat' else (.061,.044,.041)),cfg['cream'],{'head':1},rings=9,sides=20)
        oval((side*skull*.83,heady+.020,headz-skull*.14),(.034,.077,.051),cfg['fur'],{'head':1},rings=8,sides=16)
        loft([(eyex-side*.041,eyey-.002,eyez+.055),(eyex,eyey+.005,eyez+.065),(eyex+side*.035,eyey-.007,eyez+.06)],[(.009,.008),(.011,.009),(.004,.003)],cfg['dark'],{'head':1},10)
        for j in range(5):
            origin=Vector((side*(skull*.8+j*.006),heady-.03+j*.018,headz-skull*.27))
            vertices=[origin+Vector((0,-.032,.025)),origin+Vector((0,.029,.031)),origin+Vector((side*(.029+j*.002),-.029,-.017)),origin+Vector((side*.015,0,0))]
            part(vertices,[(0,1,3),(1,2,3),(2,0,3)],cfg['cream'] if species in ('fox','wolf','panda') else cfg['fur'],{'head':1})
    facial_indices.update(range(facial_start,len(buffers['Coat']['v'])))
    nosey=heady+skull*.82+cfg['muzzle']
    oval((0,nosey,headz-skull*.20),((.024,.015,.015) if species=='cat' else (.028,.025,.019)),'#9f6860' if species in ('cat','bunny') else '#342b2c',{'head':1},'Nose',8,20)
    for side in [-1,1]:
        loft([(0,nosey+.006,headz-skull*.24),(side*.018,nosey-.007,headz-skull*.31),(side*.032,nosey-.021,headz-skull*.29)],[(.003,.003)]*3,'#714c3d',{'head':1},6,'Nose')
        for j in range(3):
            oval((side*(.034+j*.011),nosey-.034-j*.009,headz-skull*.27+(j%2)*.015),(.0027,.003,.0027),cfg['dark'],{'head':1},'Nose',4,6)
    for label,(hip,knee,ankle,toe) in legs.items():
        fore=label.startswith('Front')
        legcolor=cfg['dark'] if species in ('panda','fox') else cfg['fur']
        p=[];r=[]
        for i in range(25):
            t=i/24
            if t<.5:
                q=t*2;point=Vector(hip).lerp(Vector(knee),q)
                radius=.031+(.025 if fore else .046)*math.sin(math.pi*(.12+q*.64))
            else:
                q=(t-.5)*2;point=Vector(knee).lerp(Vector(ankle),q)
                radius=.046-.011*q
            p.append(point);r.append((radius,radius*.94))
        if fore:
            p=[Vector(hip).lerp(Vector(ankle),i/24)+Vector((0,-.012*math.sin(i/24*math.pi),0)) for i in range(25)]
            r=[(.030+.022*math.sin((.20+i/24*.68)*math.pi),(.030+.018*math.sin((.20+i/24*.68)*math.pi))) for i in range(25)]
        else:
            for smoothing in range(4):
                p=[p[0]]+[(p[i-1]+p[i]*2+p[i+1])/4 for i in range(1,24)]+[p[-1]]
            r=[(.034+(.065 if species=='bunny' else .043)*math.sin((.16+i/24*.74)*math.pi)**1.5, .033+(.052 if species=='bunny' else .035)*math.sin((.16+i/24*.74)*math.pi)**1.5) for i in range(25)]
        p[-1]+=Vector((0,.015,-.018));p[-2]+=Vector((0,.008,-.010))
        def limb_weights(v):
            blend=ease((v.z-knee[2]+.045)/.09)
            return {label+'-upper':blend,label+'-lower':1-blend}
        loft(p,r,legcolor,limb_weights,12)
        pawcolor=cfg['cream'] if species in ('cat','dog','bunny','wolf') else legcolor
        oval((toe[0],toe[1]-.015,.044),(.060,.115,.044) if species=='bunny' and not fore else (.055,.079,.044),pawcolor,{label+'-paw':1},rings=8,sides=16)
        for j in [-1,0,1]:
            oval((toe[0]+j*.025,toe[1]+(.065 if species=='bunny' and not fore else .032),.035),(.021,.035,.034),pawcolor,{label+'-paw':1},rings=5,sides=10)
            if species!='bunny' and not organic:
                loft([(toe[0]+j*.025,toe[1]+.051,.039),(toe[0]+j*.025,toe[1]+.064,.035)],[(.0028,.0028),(.001,.001)],cfg['dark'],{label+'-paw':1},6)
        for offset in [-.013,.013]:
            longer=.025 if species=='bunny' and not fore else 0
            loft([(toe[0]+offset,toe[1]+.034+longer,.071),(toe[0]+offset,toe[1]+.045+longer,.066),(toe[0]+offset,toe[1]+.057+longer,.055)],[(.0013,.0013),(.0012,.0012),(.0003,.0003)],cfg['dark'],{label+'-paw':1},6,'Nose')
    tailrad=.032 if species=='cat' else .09 if species in ('panda','fox','wolf') else .052
    def tailcolor(p):
        t=max(0,min(1,(-p.y-length*.43)/cfg['tail']))
        if species in ('cat','panda') and int(t*9)%2:return cfg['dark']
        return cfg['cream'] if t>.76 and species in ('fox','dog') else cfg['fur']
    def tailweights(p):
        t=max(0,min(2.999,(-p.y-length*.43)/cfg['tail']*3));i=int(t);f=t-i
        return {'tail-'+str(i):1-f,'tail-'+str(min(2,i+1)):f} if i<2 else {'tail-2':1}
    if species=='bunny':
        oval((0,-length*.48,hipz+.06),(.068,.065,.068),cfg['cream'],{'tail-0':1},rings=10,sides=20)
    else:
        loft(tailpoints,[(max(.004,tailrad*(.6+.5*math.sin(i/12*math.pi))*(1-i/12)**.25),)*2 for i in range(13)],tailcolor,tailweights,24,ridge=.03)
    chest_detail_start=len(buffers['Coat']['v'])
    for side in [-1,1]:
        for j in range(3):
            y=length*.31+j*.015;z=hipz-.035-j*.016;x=side*width*.53
            v=[(x,y-.012,z+.018),(x,y+.016,z+.012),(x+side*.013,y+.009,z-.017),(x-side*.009,y,z)]
            part(v,[(0,1,3),(1,2,3),(2,0,3)],cfg['cream'],{'neck':.5,'chest':.5})
    facial_indices.update(range(chest_detail_start,len(buffers['Coat']['v'])))
    if organic:
        original=buffers['Coat']
        separate=[i in facial_indices or all(name.startswith(('ear-','tail-')) for name in weights) for i,weights in enumerate(original['w'])]
        body_faces=[face for face in original['f'] if not any(separate[i] for i in face)]
        separate_faces=[face for face in original['f'] if all(separate[i] for i in face)]
        body_indices=sorted({i for face in body_faces for i in face});mapping={old:i for i,old in enumerate(body_indices)}
        body_mesh=bpy.data.meshes.new('OrganicSurface')
        body_mesh.from_pydata([original['v'][i] for i in body_indices],[],[tuple(mapping[i] for i in face) for face in body_faces]);body_mesh.update()
        surface=bpy.data.objects.new('OrganicSurface',body_mesh);bpy.context.collection.objects.link(surface)
        bpy.ops.object.select_all(action='DESELECT');surface.select_set(True);bpy.context.view_layer.objects.active=surface
        voxel=surface.modifiers.new('UnifiedAnimal','REMESH');voxel.mode='VOXEL';voxel.voxel_size=.008;voxel.use_smooth_shade=True
        bpy.ops.object.modifier_apply(modifier=voxel.name)
        smooth=surface.modifiers.new('SculptedTransitions','SMOOTH');smooth.factor=.65;smooth.iterations=5;bpy.ops.object.modifier_apply(modifier=smooth.name)
        surface.data.calc_loop_triangles()
        reduce=surface.modifiers.new('GameBudget','DECIMATE');reduce.ratio=min(1,12500/max(1,len(surface.data.loop_triangles)));reduce.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=reduce.name)
        tree=KDTree(len(body_indices))
        for i in body_indices:tree.insert(Vector(original['v'][i]),i)
        tree.balance()
        result=dict(v=[],f=[],c=[],w=[])
        for vertex in surface.data.vertices:
            nearby=tree.find_n(vertex.co,4);factors=[1/max(.00015,dist)**2 for pos,index,dist in nearby];total=sum(factors)
            weights={};color=[0,0,0,1]
            for (pos,index,dist),factor in zip(nearby,factors):
                blend=factor/total
                for name,value in original['w'][index].items():weights[name]=weights.get(name,0)+value*blend

            weights=dict(sorted(weights.items(),key=lambda pair:-pair[1])[:4]);total=sum(weights.values());weights={name:value/total for name,value in weights.items()}
            dominant=max(weights,key=weights.get)
            region=fur_color(vertex.co)
            if dominant=='head':
                region=head_color(vertex.co)
                if species=='cat' and vertex.co.y>heady+skull*.66 and vertex.co.z<headz-.015:region=cfg['cream']
            elif dominant.startswith(('Front-','Hind-')):
                if dominant.endswith('-paw') and species in ('cat','dog','bunny','wolf'):region=cfg['cream']
                elif species in ('fox','panda') and vertex.co.z<hipz+.022:region=cfg['dark']
                else:region=cfg['fur']
            elif dominant=='neck':region=cfg['fur']
            color=tone(region)
            grain=1+.025*math.sin(vertex.co.x*211+vertex.co.y*193+vertex.co.z*223)*math.sin(vertex.co.z*137)
            if any(name.endswith('-paw') and value>.55 for name,value in weights.items()):
                for label,(hip,knee,ankle,toe) in legs.items():
                    if vertex.co.y>ankle[1]+.045 and .025<vertex.co.z<.068 and any(abs(vertex.co.x-ankle[0]-offset)<.0025 for offset in [-.013,.013]):grain*=.85
            result['v'].append(tuple(vertex.co));result['c'].append(tuple(c*grain for c in color[:3])+(1,));result['w'].append(weights)
        result['f']=[tuple(face.vertices) for face in surface.data.polygons]
        mapping={}
        for face in separate_faces:
            newface=[]
            for i in face:
                if i not in mapping:
                    mapping[i]=len(result['v']);result['v'].append(original['v'][i]);result['c'].append(original['c'][i]);result['w'].append(original['w'][i])
                newface.append(mapping[i])
            result['f'].append(tuple(newface))
        buffers['Coat']=result
        bpy.data.objects.remove(surface,do_unlink=True)
    objects=[]
    for name,buf in buffers.items():
        mesh=bpy.data.meshes.new(species+'-'+name);mesh.from_pydata(buf['v'],[],buf['f']);mesh.update()
        attr=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
        for i,c in enumerate(buf['c']):attr.data[i].color=c
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(materials[name]);obj.parent=rig
        for bone in data.bones:obj.vertex_groups.new(name=bone.name)
        for i,weights in enumerate(buf['w']):
            for name,w in weights.items():
                if w>1e-6:obj.vertex_groups[name].add([i],w,'REPLACE')
        arm=obj.modifiers.new('Skin','ARMATURE');arm.object=rig
        for face in mesh.polygons:face.use_smooth=True
        objects.append(obj)
    scene=bpy.context.scene;scene.render.fps=FPS;rig.animation_data_create()
    for pose in rig.pose.bones:pose.rotation_mode='XYZ'
    def move(name,x=0,y=0,z=0):rig.pose.bones[name].location=data.bones[name].matrix_local.to_3x3().inverted()@Vector((x,y,z))
    def rotate(name,x=0,y=0,z=0):rig.pose.bones[name].rotation_euler=(x,y,z)
    for clip,duration in DURATIONS.items():
        frames=round(duration*FPS);authored=bpy.data.actions.new(clip+'-authored');rig.animation_data.action=authored
        for frame in range(frames+1):
            t=frame/FPS
            for pose in rig.pose.bones:pose.location=(0,0,0);pose.rotation_euler=(0,0,0);pose.scale=(1,1,1)
            breath=math.sin(t*math.tau/2.4)
            rig.pose.bones['chest'].scale=(1+.012*breath,1,1+.013*breath)
            rotate('head',.018*breath)
            for i in range(3):rotate('tail-'+str(i),.035*breath,.09*math.sin(t*3-i*.65),0)
            for side in ['L','R']:
                rotate('ear-'+side,.04*math.sin(t*2.2),0,.025*math.sin(t*3.1))
                blink=math.exp(-((t-1.35)/.075)**2) if clip not in ('run','walk') else 0
                rig.pose.bones['blink-'+side].scale=(1,1,max(.05,1-blink*.95))
            if clip in ('walk','run','climb','swim','dash'):
                cycle=.50 if clip=='walk' else .30 if clip in ('run','dash') else .65
                speed=1.2 if clip=='walk' else 3
                stance=.57 if clip=='walk' else .48
                span=speed*cycle*stance
                for i,label in enumerate(legs):
                    phase=(t/cycle+(.5 if i in (1,2) else 0))%1
                    if phase<stance:fy=span*(.5-phase/stance);fz=0
                    else:
                        s=(phase-stance)/(1-stance);fy=span*(-.5+ease(s));fz=math.sin(s*math.pi)*(.085 if clip=='walk' else .12)
                    move('CTRL-'+label,y=fy,z=fz+(.07 if clip=='swim' else 0))
                rotate('chest',.018*math.sin(t*math.tau/cycle))
                if clip=='dash':
                    rotate('head',-.10*math.sin(t/duration*math.pi))
                    if species=='bunny':move('neck',y=.075*math.sin(t/duration*math.pi))
            if clip in ('sit','pet','sniff','bow','knockedOut'):
                fold=ease(t/.35)
                if clip in ('sit','pet'):
                    move('pelvis',z=-hipz*.40*fold,y=.06*fold)
                    for label in legs:
                        if label.startswith('Hind'):move('CTRL-'+label,y=.11*fold)
                    rotate('neck',.12*fold)
                    if clip=='pet':rotate('head',.10*math.sin(t*4),0,.13*math.sin(t*3))
                if clip in ('sniff','bow'):
                    dip=(.65 if clip=='bow' else .45)*fold*(1-ease((t-duration+.35)/.35))
                    rotate('neck',-dip);move('head',z=-.04*dip)
                    if clip=='bow':move('chest',z=-.085*dip)
                    else:rotate('head',-.025*math.sin(t*10))
                if clip=='knockedOut':
                    move('pelvis',z=-hipz*.45*fold);move('chest',z=-hipz*.10*fold);rotate('neck',-.40*fold)
                    for label in legs:move('CTRL-'+label,y=.03*fold)
                    for label in ['L','R']:rig.pose.bones['blink-'+label].scale=(1,1,max(.04,1-fold*.96))
            if clip in ('pounce','swipe','spin'):
                anticipation=ease(t/.18)*(1-ease((t-.18)/.12))
                move('root',z=-.06*anticipation)
                strike=ease((t-.18)/.12)*(1-ease((t-.38)/.30))
                rotate('neck',-.13*anticipation+.09*strike)
                if clip=='pounce':
                    arc=math.sin(math.pi*max(0,min(1,(t-.18)/.52)))*.65
                    move('root',z=arc-.06*anticipation)
                    for label in legs:move('CTRL-'+label,y=(.27 if label.startswith('Front') else -.09)*strike,z=.12*strike)
                if clip=='swipe':
                    move('CTRL-Front-L',y=.34*strike,z=.22*strike);rotate('chest',0,0,-.12*strike)
                if clip=='spin':
                    rotate('root',0,(-.5*(1-ease(t/.30)) if t<.30 else math.tau*ease((t-.30)/.50)),0)
                    for label in legs:move('CTRL-'+label,y=.27*strike,z=.035*strike)
            if clip=='hit':rotate('neck',-.18*math.sin(t/duration*math.pi));move('chest',y=-.035*math.sin(t/duration*math.pi))
            for pose in rig.pose.bones:
                pose.keyframe_insert('location',frame=frame+1);pose.keyframe_insert('rotation_euler',frame=frame+1);pose.keyframe_insert('scale',frame=frame+1)
        bpy.context.view_layer.objects.active=rig;bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.ops.object.mode_set(mode='POSE')
        bpy.ops.nla.bake(frame_start=1,frame_end=frames+1,step=1,only_selected=False,visual_keying=True,clear_constraints=False,use_current_action=False,bake_types={'POSE'})
        bpy.ops.object.mode_set(mode='OBJECT');baked=rig.animation_data.action;bpy.data.actions.remove(authored);baked.name=clip;baked.use_fake_user=True
    for pose in rig.pose.bones:
        for constraint in list(pose.constraints):pose.constraints.remove(constraint)
    rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
    tris=0;maxweights=0
    for obj in objects:
        obj.data.calc_loop_triangles();tris+=len(obj.data.loop_triangles)
        for vert in obj.data.vertices:
            weights=[g.weight for g in vert.groups if g.weight>1e-6];maxweights=max(maxweights,len(weights))
            assert 1<=len(weights)<=4 and abs(sum(weights)-1)<.0001
    assert tris<(20000 if organic else 16000), tris
    samples=[]
    for clip,cycle,stance,speed in [('walk',.5,.57,1.2),('run',.3,.48,3)]:
        rig.animation_data.action=bpy.data.actions[clip];points=[]
        for fraction in [.25,.35,.45]:
            elapsed=cycle*stance*fraction;f=1+elapsed*FPS;scene.frame_set(int(f),subframe=f-int(f))
            p=rig.pose.bones['Front-L-paw'].matrix.translation;points.append((elapsed,p.y+elapsed*speed,p.z))
        velocity=max(abs((b[1]-a[1])/(b[0]-a[0])) for a,b in zip(points,points[1:]))
        samples.append(dict(clip=clip,stanceWorldVelocity=velocity,pawBoneHeight=min(p[2] for p in points)))
        assert velocity<.10, (species,clip,velocity,points)
    contact=[]
    coat=objects[0]
    front_groups={coat.vertex_groups[label+'-paw'].index for label in ['Front-L','Front-R']}
    front_indices=[v.index for v in coat.data.vertices if any(g.group in front_groups and g.weight>.9 for g in v.groups)]
    for clip,elapsed in [('pounce',.30),('swipe',.30),('spin',.30),('dash',.22)]:
        rig.animation_data.action=bpy.data.actions[clip];f=1+elapsed*FPS;scene.frame_set(int(f),subframe=f-int(f))
        evaluated=coat.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        verts=[mesh.vertices[i].co for i in front_indices]
        muzzle=rig.pose.bones['muzzle'].matrix.translation
        contact.append(dict(clip=clip,time=elapsed,pawMaximumForward=max(v.y for v in verts),pawMinimumHeight=min(v.z for v in verts),muzzle=list(muzzle)))
        evaluated.to_mesh_clear()
    rig.animation_data.action=bpy.data.actions['pounce'];f=1+.44*FPS;scene.frame_set(int(f),subframe=f-int(f));leap=rig.pose.bones['root'].matrix.translation.z
    assert abs(leap-.65)<.005
    rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
    summary=dict(species=species,triangles=tris,materials=3,bones=len(data.bones),weightsMaximum=maxweights,clips=DURATIONS,gaitReference=dict(walk=1.2,run=3),stance=samples,forward='+Y Blender / -Z Three',ground=0,contact=contact,pounceApex=leap)
    (OUTPUT/(species+'-diagnostics.json')).write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
    for obj in objects:obj.select_set(False)
    rig.select_set(False)
    groundmat=bpy.data.materials.new('RenderGround');groundmat.diffuse_color=(.13,.16,.12,1)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003));ground=bpy.context.object;ground.data.materials.append(groundmat)
    world=scene.world or bpy.data.worlds.new('Studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.38,.32,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    lights=[]
    for pos,power,size in [((-2,3,4),350,3),((3,1,2),180,3),((0,-3,3),280,2)]:
        bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,h*.5))-light.location).to_track_quat('-Z','Y').to_euler();lights.append(light)
    bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=1.7 if species!='wolf' else 2.2
    target=Vector((0,-.06,h*.50))
    views={'front':(0,3,1.0),'side':(3,0,.95),'back':(0,-3,1.0),'three-quarter':(2.3,3,1.7)}
    for name,pos in ([] if '--export-only' in ARGS else views.items()):
        camera.location=pos;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUTPUT/(species+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
    if '--motion-check' in ARGS:
        for clip,elapsed in [('run',.075),('pounce',.30),('swipe',.30),('knockedOut',.8),('sit',1.0)]:
            rig.animation_data.action=bpy.data.actions[clip];frame=1+elapsed*FPS;scene.frame_set(int(frame),subframe=frame-int(frame))
            camera.location=(2.3,3,1.7);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(OUTPUT/(species+'-motion-'+clip+'.png'));bpy.ops.render.render(write_still=True)
        rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
    if '--renders-only' not in ARGS and '--organic-candidate' not in ARGS:
        bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=rig
        bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/wilds'/('partner-'+species+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=False,export_frame_range=False,export_force_sampling=True,export_def_bones=True,export_yup=True,export_materials='EXPORT')


for species,cfg in SPECIES.items():
    if '--species' in ARGS and species!=ARGS[ARGS.index('--species')+1]:continue
    build(species,cfg)
