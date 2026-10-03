import { BackSide, BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, ShaderMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, noise2 } from '../../core/world-terrain.js';
import { CAMPS, FALLS, HERO_TREES, HERBS, LANDMARKS, LAKE, SECRETS, SOLIDS, STREAM, TRAIL, createValleyWorld, solidFootprint } from '../../core/wilds/world.js';
import { ARENA, STONES } from '../../core/wilds/encounter.js';
import { wildsPaint } from './materials.js';
import { createDiscoveries } from './discoveries.js';

const hash = (a, b = 0) => { let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function trailDistance(x, z) {
  let nearest = Infinity;
  for (let i = 1; i < TRAIL.length; i++) {
    const [ax, az] = TRAIL[i - 1], [bx, bz] = TRAIL[i], dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return nearest;
}
function coloured(geometry, base, contrast = .08) {
  const color = new Color(base), colors = new Float32Array(geometry.attributes.position.count * 3), positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const value = 1 + Math.sin(positions.getX(i) * 7.3 + positions.getY(i) * 3.1 + positions.getZ(i) * 5.7) * contrast;
    colors.set([color.r * value, color.g * value, color.b * value], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3)); return geometry;
}
function geometryOf(points, colors = null) {
  const geometry = new BufferGeometry(), array = new Float32Array(points);
  geometry.setAttribute('position', new BufferAttribute(array, 3)); geometry.computeVertexNormals();
  const uv = new Float32Array(array.length / 3 * 2);
  for (let i = 0; i < array.length / 3; i++) { uv[i * 2] = array[i * 3]; uv[i * 2 + 1] = array[i * 3 + 2]; }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  if (colors) geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  return geometry;
}
function merged(parts, material, parent, name, shadow = false) {
  if (!parts.length) return null;
  const converted = parts.map(part => part.index ? part.toNonIndexed() : part), geometry = mergeGeometries(converted);
  for (const part of converted) part.dispose();
  for (const part of parts) part.dispose();
  const mesh = new Mesh(geometry, material); mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function limb(from, to, radius, tip, color) {
  const a = new Vector3(...from), b = new Vector3(...to), delta = b.clone().sub(a);
  const geometry = new CylinderGeometry(tip, radius, delta.length(), 9, 5), positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i), angle = Math.atan2(positions.getZ(i), positions.getX(i)), ridge = 1 + .07 * Math.sin(angle * 9 + y * 2.1);
    positions.setX(i, positions.getX(i) * ridge); positions.setZ(i, positions.getZ(i) * ridge);
  }
  geometry.computeVertexNormals(); geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize())); geometry.translate(...a.add(b).multiplyScalar(.5).toArray());
  return coloured(geometry, color);
}
function leaf(x,y,z,size,yaw,tilt,color) {
  const geometry=geometryOf([0,0,0,-.34,.025,.35,-.30,.055,.68,0,0,0,-.30,.055,.68,0,.11,1,0,0,0,0,.11,1,.30,.055,.68,0,0,0,.30,.055,.68,.34,.025,.35]);
  geometry.scale(size,size,size);geometry.rotateX(tilt);geometry.rotateY(yaw);geometry.translate(x,y,z);return coloured(geometry,color,.035);
}
function leafClump(x,y,z,radius,count,size,seed,color) {
  const parts=[];
  for(let i=0;i<count;i++){
    const angle=i*2.399+seed,depth=Math.cbrt(hash(i+9,seed)),latitude=hash(i+37,seed)*2-1,r=radius*depth*Math.sqrt(1-latitude*latitude)*(1+.10*Math.sin(angle*3+seed)),vertical=latitude*radius*.78*depth;
    const tilt=i%3===0?(hash(i+71,seed)-.5)*2.5:(hash(i+83,seed)-.5)*1.2;
    const leafColor=new Color(color).multiplyScalar(.82+hash(i+5,seed)*.36);
    parts.push(leaf(x+Math.sin(angle)*r,y+vertical,z+Math.cos(angle)*r,size*(.8+hash(i+22,seed)*.4),angle,tilt,leafColor));
  }
  const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());
  const vertices=geometry.attributes.position,normals=geometry.attributes.normal;
  for(let i=0;i<vertices.count;i++){
    const nx=(vertices.getX(i)-x)/radius,ny=(vertices.getY(i)-y)/(radius*.78),nz=(vertices.getZ(i)-z)/radius,length=Math.hypot(nx,ny,nz)||1;
    const ax=nx/length*.78+normals.getX(i)*.22,ay=ny/length*.78+normals.getY(i)*.22,az=nz/length*.78+normals.getZ(i)*.22,magnitude=Math.hypot(ax,ay,az)||1;
    normals.setXYZ(i,ax/magnitude,ay/magnitude,az/magnitude);
  }
  return geometry;
}
function terrainGeometry(minX, maxX, minZ, maxZ, spacing, omit = null) {
  const nx = Math.round((maxX - minX) / spacing), nz = Math.round((maxZ - minZ) / spacing), geometry = new BufferGeometry();
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3), colors = new Float32Array(positions.length), uv = new Float32Array((nx + 1) * (nz + 1) * 2), indices = [];
  const color = new Color(), meadow = new Color('#729548'), shade = new Color('#3d6b48'), earth = new Color('#a79b74'), rock = new Color('#aaa38c');
  for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
    const i = iz * (nx + 1) + ix, x = minX + ix * spacing, z = minZ + iz * spacing, y = heightAt(x, z);
    positions.set([x, y, z], i * 3); uv.set([x * .04, z * .04], i * 2);
    const patch = .5 + noise2(x * .027, z * .027, 25) * .4, slope = Math.hypot(heightAt(x + 1, z) - y, heightAt(x, z + 1) - y);
    color.copy(shade).lerp(meadow, patch); if (slope > .6) color.lerp(rock, clamp((slope - .6) * .5, 0, .8));
    color.lerp(earth, clamp(1 - trailDistance(x, z) / 1.5, 0, .8)); colors.set([color.r, color.g, color.b], i * 3);
    if (ix < nx && iz < nz && !(omit && x >= omit[0] && x < omit[1] && z >= omit[2] && z < omit[3])) {
      const a = i, b = i + 1, c = i + nx + 1, d = c + 1; indices.push(a, c, b, b, c, d);
    }
  }
  geometry.setAttribute('position', new BufferAttribute(positions, 3)); geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometry.setAttribute('uv', new BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function rockGeometry(solid, color) {
  const { x, z, halfX, halfZ, bottom, top } = solid, points = [], colors = [], layers = Math.max(3, Math.ceil((top - bottom) / .8));
  const stone=new Color(color),light=new Color('#c6b99b'),shade=new Color('#756f61'),moss=new Color('#627753'),paint=new Color();
  const push=(vertices,isTop=false)=>{
    for(const p of vertices){
      points.push(...p);
      const strata=.5+.5*Math.sin((p[1]-bottom)*8.1+noise2(p[0]*.16,p[2]*.16)*1.5),patch=.5+noise2(p[0]*.43,p[2]*.43,92)*.5;
      paint.copy(stone).lerp(shade,.18+strata*.18).lerp(light,Math.pow(1-strata,4)*.3);
      if(isTop)paint.lerp(moss,Math.max(0,Math.min(.95,(patch-.28)*2.1)));
      else paint.lerp(moss,Math.max(0,(patch-.64)*1.6)*Math.min(1,(p[1]-bottom)/(top-bottom)));
      colors.push(paint.r,paint.g,paint.b);
    }
  };
  const outline=solidFootprint(solid);
  for(let side=0;side<outline.length;side++){
    const a=outline[side],b=outline[(side+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),normal=[dz/length,-dx/length],divisions=Math.max(2,Math.ceil(length*1.5));
    for(let iy=0;iy<layers;iy++)for(let ix=0;ix<divisions;ix++){
      const l=iy/layers,h=(iy+1)/layers,u=ix/divisions,v=(ix+1)/divisions;
      const point=(t,f)=>{const edge=t===0||t===1||f===0||f===1?0:(.025+Math.sin(t*19+f*41+x)*.035+Math.sin(f*layers*2.4)*.025);return[a[0]+dx*t+normal[0]*edge,bottom+(top-bottom)*f,a[1]+dz*t+normal[1]*edge];};
      push([point(u,l),point(u,h),point(v,l),point(u,h),point(v,h),point(v,l)]);
    }
    const radial=Math.max(2,Math.ceil(Math.max(halfX,halfZ))),across=Math.max(2,Math.ceil(length));
    const topPoint=(t,r)=>[x+(a[0]+dx*t-x)*r,top,z+(a[1]+dz*t-z)*r];
    for(let ring=0;ring<radial;ring++)for(let segment=0;segment<across;segment++){
      const r0=ring/radial,r1=(ring+1)/radial,t0=segment/across,t1=(segment+1)/across;
      push([topPoint(t0,r0),topPoint(t1,r1),topPoint(t0,r1),topPoint(t0,r0),topPoint(t1,r0),topPoint(t1,r1)],true);
    }
  }
  return geometryOf(points,colors);
}

export function createValley(scene, { world = createValleyWorld() } = {}) {
  const group = new Group(); group.name = 'wilds-valley'; scene.add(group);
  const wind = { wildsTime: { value: 0 }, wildsWind: { value: 1 }, wildsPlayer: { value: new Vector3() }, wildsPet: { value: new Vector3() } };
  const groundMaterial = wildsPaint('#ffffff', { vertexColors: true, surface: 'ground' }), rockMaterial = wildsPaint('#ffffff', { vertexColors: true }), barkMaterial = wildsPaint('#ffffff', { vertexColors: true, surface: 'bark' });
  const leafMaterial = wildsPaint('#ffffff', { vertexColors: true, side: DoubleSide, wind, foliage: true }), grassMaterial = wildsPaint('#ffffff', { vertexColors: true, side: DoubleSide, wind, grass: true, foliage: true });
  const clothMaterial = wildsPaint('#d1c2a3', { vertexColors: true, side: DoubleSide, surface: 'cloth' }), ironMaterial = wildsPaint('#585f57'), amberMaterial = wildsPaint('#f0cb80', { emissive: '#bd7227', emissiveIntensity: .65 });
  const terrainNear = new Mesh(terrainGeometry(-64,64,-64,64,1), groundMaterial), terrainValley = new Mesh(terrainGeometry(-320,160,-512,96,2,[-64,64,-64,64]), groundMaterial), terrainFar = new Mesh(terrainGeometry(-3200,3200,-4800,1600,40,[-320,160,-512,96]), groundMaterial);
  terrainNear.name = 'near-terrain'; terrainValley.name = 'valley-terrain'; terrainFar.name = 'far-terrain'; terrainNear.receiveShadow = true; terrainValley.receiveShadow = true; group.add(terrainNear, terrainValley, terrainFar);
  const rockParts = [], ruinParts = [], oakParts = [], mossParts = [];
  for (const solid of SOLIDS) {
    const color = solid.kind === 'oak' || solid.id === 'bridge-log' ? '#786a4b' : solid.kind === 'ruin' ? '#b1aa8a' : '#b6a18a';
    (solid.kind === 'oak' || solid.id === 'bridge-log' ? oakParts : solid.kind === 'ruin' ? ruinParts : rockParts).push(rockGeometry(solid, color));
    if (solid.kind !== 'oak') for(let i=0;i<Math.ceil(solid.halfX*solid.halfZ*.4);i++){
      const x=solid.x+(hash(i,17)-.5)*solid.halfX*1.8,z=solid.z+(hash(i,43)-.5)*solid.halfZ*1.8,r=.16+hash(i,31)*.42;
      if(Math.abs(world.floorAt(x,z,solid.top+.01)-solid.top)>.001)continue;
      mossParts.push(coloured(new SphereGeometry(r,7,4).scale(1,.08,.7).translate(x,solid.top+.012,z),'#7b8c59'));
    }
  }
  merged(rockParts, rockMaterial, group, 'climbable-rock-masses'); merged(ruinParts, rockMaterial, group, 'ruin-masonry'); merged(oakParts, barkMaterial, group, 'climbable-oak-wood'); merged(mossParts, leafMaterial, group, 'ledge-moss');
  const trunksNear = [], trunksFar = [], leavesNear = [], leavesFar = [], treeAnchors = [], forest = [];
  HERO_TREES.forEach((tree, index) => {
    if (tree.hero === false) { forest.push(tree); return; }
    const near = Math.hypot(tree.x, tree.z) < 100, trunks = near ? trunksNear : trunksFar, leaves = near ? leavesNear : leavesFar, y = tree.y ?? heightAt(tree.x, tree.z);
    treeAnchors.push([tree.x,y,tree.z]);
    if(tree.id!=='tree-8'){const x=tree.x,z=tree.z,h=tree.height,l=tree.lean;trunks.push(limb([x,y-.12,z],[x+l[0]*.2,y+h*.25,z+l[1]*.2],tree.radius,tree.radius*.76,'#756c4f'),limb([x+l[0]*.2,y+h*.25,z+l[1]*.2],[x+l[0]*.75,y+h*.45,z+l[1]*.75],tree.radius*.76,tree.radius*.5,'#756c4f'),limb([x+l[0]*.75,y+h*.45,z+l[1]*.75],[x+l[0],y+h*.62,z+l[1]],tree.radius*.5,tree.radius*.27,'#756c4f'));}
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + index * .31, length = tree.radius * (2.2 + hash(i,index));
      const x = tree.x + Math.sin(angle)*length, z = tree.z + Math.cos(angle)*length;
      trunks.push(limb([tree.x,y+.2,tree.z],[x,heightAt(x,z)+.07,z],tree.radius*.24,.045,'#716748'));
    }
    if (tree.species === 'pine') {
      for (let tier = 0; tier < 7; tier++) {
        const h = tree.height * (.25 + tier * .095), spread = tree.height * (.18 - tier * .019);
        for (let arm = 0; arm < 8; arm++) {
          const turn = arm * Math.PI / 4 + tier * .5, bx = tree.x + Math.sin(turn)*spread, bz = tree.z + Math.cos(turn)*spread;
          trunks.push(limb([tree.x,y+h,tree.z],[bx,y+h-.5,bz],.12,.025,'#716e51'));
          for (let j=0;j<12;j++) leaves.push(leaf(bx+(hash(j,tier)-.5)*spread*.6,y+h+hash(j,arm)*.8,bz+(hash(j+9,arm)-.5)*spread*.6,.6+hash(j,index)*.7,turn+j*2.399,1.1,'#547466'));
        }
      }
    } else {
      for(let crown=0;crown<13;crown++) {
        const angle=crown*2.399+index*.7,span=tree.height*(crown<4?.055:.17+hash(crown,index)*.11),cy=y+tree.height*(.44+hash(crown+19,index)*.36),cx=tree.x+tree.lean[0]+Math.sin(angle)*span,cz=tree.z+tree.lean[1]+Math.cos(angle)*span;
        const bx=tree.x+Math.sin(angle)*span*.6,bz=tree.z+Math.cos(angle)*span*.6,by=y+tree.height*(.31+hash(crown+32,index)*.18);
        if(crown<5)trunks.push(limb([tree.x,y+tree.height*(.25+hash(crown+46,index)*.13),tree.z],[bx,by,bz],tree.radius*.31,tree.radius*.13,'#71664e'),limb([bx,by,bz],[cx,cy,cz],tree.radius*.13,.045,'#71664e'));
        const radius=tree.height*(.14+hash(crown+8,index)*.035),color=crown%3===0?'#809748':crown%3===1?'#577945':'#92a653';
        leaves.push(leafClump(cx,cy,cz,radius,500,.35+hash(crown,index)*.15,crown+index*29,color));
      }
    }
  });
  const understory=HERO_TREES.filter((tree,i)=>i%3===0).map((tree,i)=>[tree.x+Math.sin(i*2.399)*4,tree.z+Math.cos(i*2.399)*4]).concat([[-6,4],[6,9],[-7,-5],[7,-12],[9,-29],[-14,-55]]);
  for(let i=0;i<understory.length;i++){
    const [x,z]=understory[i];if(trailDistance(x,z)<2.7||world.waterAt(x,z)||SOLIDS.some(s=>Math.abs(x-s.x)<s.halfX+1&&Math.abs(z-s.z)<s.halfZ+1))continue;
    const parts=Math.hypot(x,z)<100?leavesNear:leavesFar,y=heightAt(x,z);
    for(let clump=0;clump<3;clump++){const a=clump*2.399+i,dx=x+Math.sin(a)*.65,dz=z+Math.cos(a)*.65;parts.push(leafClump(dx,heightAt(dx,dz)+.4+clump*.14,dz,.55+hash(i,clump)*.3,70,.18+hash(clump,i)*.08,i*13+clump,clump%2?'#547a3c':'#769349'));}
  }
  const groundcoverPoints=[],groundcoverColors=[],groundcoverColor=new Color();
  for(let patch=0;patch<3200;patch++){
    const x=-285+hash(patch,52)*390,z=-445+hash(patch,91)*460;
    if(Math.hypot(x,z)<35||trailDistance(x,z)<3||world.waterAt(x,z)||noise2(x*.024,z*.024,9)<-.1||SOLIDS.some(s=>Math.abs(x-s.x)<s.halfX+1&&Math.abs(z-s.z)<s.halfZ+1))continue;
    for(let blade=0;blade<24;blade++){
      const turn=blade*2.399+patch,r=Math.sqrt(hash(blade,patch))*2.1,bx=x+Math.sin(turn)*r,bz=z+Math.cos(turn)*r,y=heightAt(bx,bz),h=.25+hash(blade+32,patch)*.35,width=.018+hash(blade+41,patch)*.022,dx=Math.cos(turn)*width,dz=Math.sin(turn)*width,tx=bx+Math.sin(turn)*.22,tz=bz+Math.cos(turn)*.22;
      groundcoverPoints.push(bx-dx,y,bz-dz,bx+dx,y,bz+dz,tx,y+h,tz);
      groundcoverColor.set(blade%3?'#678b40':'#467241').multiplyScalar(.82+hash(blade,patch)*.33);for(let vertex=0;vertex<3;vertex++)groundcoverColors.push(groundcoverColor.r,groundcoverColor.g,groundcoverColor.b);
    }
  }
  leavesFar.push(geometryOf(groundcoverPoints,groundcoverColors));
  const nearTrunks = merged(trunksNear,barkMaterial,group,'near-branched-trunks',true), nearLeaves = merged(leavesNear,leafMaterial,group,'near-irregular-leaves',true);
  merged(trunksFar,barkMaterial,group,'far-branched-trunks'); merged(leavesFar,leafMaterial,group,'far-irregular-leaves');
  const matrix = new Matrix4(), position = new Vector3(), rotation = new Quaternion(), scale = new Vector3(), up = new Vector3(0,1,0);
  for (let variant = 0; variant < 3; variant++) {
    const list = forest.filter((tree,index)=>index%3===variant), branches = [], canopy = [];
    branches.push(limb([0,0,0],[.015,.24,-.012],.045,.035,'#746a51'),limb([.015,.24,-.012],[.05,.41,.02],.035,.024,'#746a51'),limb([.05,.41,.02],[.03,.60,.025],.024,.013,'#746a51'));
    for(let i=0;i<13;i++) {
      const angle=i*2.399+variant*.71,spread=i<3?.05:.16+hash(i,variant)*.14,cx=Math.sin(angle)*spread,cz=Math.cos(angle)*spread,cy=.43+hash(i+18,variant)*.36;
      if(i<5)branches.push(limb([.015,.25+hash(i+22,variant)*.12,0],[cx*.6,.34+hash(i+32,variant)*.14,cz*.6],.017,.009,'#746a51'),limb([cx*.6,.34+hash(i+32,variant)*.14,cz*.6],[cx,cy,cz],.009,.003,'#746a51'));
      const radius=.145+hash(i,variant)*.025,color=variant===0?'#718b43':variant===1?'#8a9f4e':'#567947';
      canopy.push(leafClump(cx,cy,cz,radius,122,.035+hash(i,variant)*.01,i+variant*17,color));
    }
    const stemGeometry = mergeGeometries(branches.map(g=>g.toNonIndexed())), leafGeometry = mergeGeometries(canopy);
    branches.forEach(g=>g.dispose()); canopy.forEach(g=>g.dispose());
    const stems = new InstancedMesh(stemGeometry,barkMaterial,list.length), crowns = new InstancedMesh(leafGeometry,leafMaterial,list.length);
    stems.name=`forest-trunks-${variant}`; crowns.name=`forest-canopy-${variant}`;
    list.forEach((tree,index)=>{position.set(tree.x,tree.y ?? heightAt(tree.x,tree.z),tree.z);rotation.setFromAxisAngle(up,hash(index,variant)*Math.PI*2);scale.setScalar(tree.height);matrix.compose(position,rotation,scale);stems.setMatrixAt(index,matrix);crowns.setMatrixAt(index,matrix);});
    group.add(stems,crowns);
  }
  const grassParts=[];
  for(let blade=0;blade<8;blade++){
    const angle=blade*2.399,width=.011,h=.17+(blade%5)*.041,points=[];
    for(let j=0;j<2;j++){const a=j/2,b=(j+1)/2,bend=t=>[Math.sin(angle)*(.04+t*t*.16),t*h,Math.cos(angle)*(.04+t*t*.16)],pa=bend(a),pb=bend(b),wa=width*(1-a),wb=width*(1-b);points.push(pa[0]-wa,pa[1],pa[2],pa[0]+wa,pa[1],pa[2],pb[0]-wb,pb[1],pb[2],pb[0]-wb,pb[1],pb[2],pa[0]+wa,pa[1],pa[2],pb[0]+wb,pb[1],pb[2]);}
    grassParts.push(coloured(geometryOf(points),blade%3===0?'#3e703e':blade%3===1?'#679844':'#8aae58',.12));
  }
  const grassGeometry=mergeGeometries(grassParts);grassParts.forEach(g=>g.dispose());
  const nearCount=16000,meadowCount=12000,grassCount=nearCount+meadowCount,grass=new InstancedMesh(grassGeometry,grassMaterial,nearCount);
  grass.name='curved-grass';grass.frustumCulled=false;group.add(grass);
  const meadowGeometry=grassGeometry.clone().scale(3,.65,3),meadowMaterial=wildsPaint('#ffffff',{vertexColors:true,side:DoubleSide,wind,grass:true,foliage:true,grassRange:65,grassFade:18}),meadow=new InstancedMesh(meadowGeometry,meadowMaterial,meadowCount);meadow.name='meadow-grass';meadow.frustumCulled=false;group.add(meadow);
  grass.receiveShadow=true;meadow.receiveShadow=true;
  const grassTint=new Color(),cellsX=new Int32Array(grassCount),cellsZ=new Int32Array(grassCount),desiredX=new Int32Array(grassCount),desiredZ=new Int32Array(grassCount),queued=new Uint8Array(grassCount),visibleCells=new Uint8Array(grassCount),queue=new Int32Array(grassCount);
  cellsX.fill(2147483647);cellsZ.fill(2147483647);
  let queueHead=0,queueTail=0,queueCount=0,grassVisible=0;
  const tiers=[{mesh:grass,offset:0,columns:125,rows:128,spacing:.24,originX:Infinity,originZ:Infinity},{mesh:meadow,offset:nearCount,columns:100,rows:120,spacing:1.3,originX:Infinity,originZ:Infinity}];
  for(const tier of tiers){tier.order=Array.from({length:tier.columns*tier.rows},(_,i)=>i);tier.order.sort((a,b)=>{const ax=a%tier.columns-tier.columns/2,az=Math.floor(a/tier.columns)-tier.rows/2,bx=b%tier.columns-tier.columns/2,bz=Math.floor(b/tier.columns)-tier.rows/2;return ax*ax+az*az-bx*bx-bz*bz;});}
  const wrap=(cell,size)=>(cell%size+size)%size;
  function queueGrassCell(tier,gx,gz){
    const index=tier.offset+wrap(gz,tier.rows)*tier.columns+wrap(gx,tier.columns);desiredX[index]=gx;desiredZ[index]=gz;
    if(cellsX[index]===gx&&cellsZ[index]===gz||queued[index])return;
    queue[queueTail]=index;queueTail=(queueTail+1)%grassCount;queueCount++;queued[index]=1;
  }
  function scheduleGrass(x,z){
    for(const tier of tiers){
      const ox=Math.floor(x/tier.spacing)-Math.floor(tier.columns/2),oz=Math.floor(z/tier.spacing)-Math.floor(tier.rows/2);
      const oldX=tier.originX,oldZ=tier.originZ;if(ox===oldX&&oz===oldZ)continue;tier.originX=ox;tier.originZ=oz;
      if(Math.abs(ox-oldX)>=tier.columns||Math.abs(oz-oldZ)>=tier.rows){for(const logical of tier.order)queueGrassCell(tier,ox+logical%tier.columns,oz+Math.floor(logical/tier.columns));continue;}
      for(let gx=ox;gx<ox+tier.columns;gx++)if(gx<oldX||gx>=oldX+tier.columns)for(let gz=oz;gz<oz+tier.rows;gz++)queueGrassCell(tier,gx,gz);
      for(let gz=oz;gz<oz+tier.rows;gz++)if(gz<oldZ||gz>=oldZ+tier.rows)for(let gx=Math.max(ox,oldX);gx<Math.min(ox+tier.columns,oldX+tier.columns);gx++)queueGrassCell(tier,gx,gz);
    }
  }
  function refillGrass(limit=320){
    let updated=0,nearDirty=false,meadowDirty=false;
    while(queueCount&&updated<limit){
      const index=queue[queueHead];queueHead=(queueHead+1)%grassCount;queueCount--;queued[index]=0;
      const gx=desiredX[index],gz=desiredZ[index];if(cellsX[index]===gx&&cellsZ[index]===gz)continue;
      const near=index<nearCount,tier=tiers[near?0:1],i=index-tier.offset,x=(gx+hash(gx,gz))*tier.spacing,z=(gz+hash(gz,gx+71))*tier.spacing,y=world.floorAt(x,z),water=world.waterAt(x,z),path=trailDistance(x,z);
      const excluded=water||path<1.5||SOLIDS.some(s=>(s.kind==='oak'||s.kind==='bridge')&&Math.abs(x-s.x)<s.halfX+.2&&Math.abs(z-s.z)<s.halfZ+.2)||STONES.some(s=>Math.hypot(x-s.x,z-s.z)<s.radius+.12)||CAMPS.some(c=>Math.hypot(x-c.x+1.4,z-c.z)<.68||Math.abs(x-c.x-1.25)<.48&&Math.abs(z-c.z)<.93);
      position.set(x,excluded?y-2:y+.005,z);rotation.setFromAxisAngle(up,hash(gx,gz+18)*Math.PI*2);const size=excluded?.001:.7+hash(gx+100,gz)*.7;scale.set(size,size*(near?1:1.9),size);matrix.compose(position,rotation,scale);tier.mesh.setMatrixAt(i,matrix);
      const patch=.5+noise2(x*.14,z*.14,18)*.5;grassTint.setRGB(.73+patch*.22,.87+patch*.13,.72+patch*.19);tier.mesh.setColorAt(i,grassTint);
      grassVisible+=Number(!excluded)-visibleCells[index];visibleCells[index]=Number(!excluded);cellsX[index]=gx;cellsZ[index]=gz;updated++;if(near)nearDirty=true;else meadowDirty=true;
    }
    if(nearDirty){grass.instanceMatrix.needsUpdate=true;grass.instanceColor.needsUpdate=true;}if(meadowDirty){meadow.instanceMatrix.needsUpdate=true;meadow.instanceColor.needsUpdate=true;}
  }
  scheduleGrass(0,0);refillGrass(grassCount);
  const waterPoints=[];
  const waterVertex=(x,z)=>[x,LAKE.height,z];
  function clipTriangle(vertices) {
    let clipped=[];
    for(let i=0;i<3;i++){
      const a=vertices[i],b=vertices[(i+1)%3],ha=heightAt(a[0],a[1])-LAKE.height,hb=heightAt(b[0],b[1])-LAKE.height;
      if(ha<0)clipped.push(a);
      if((ha<0)!==(hb<0)){const t=ha/(ha-hb);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }
    for(let i=1;i<clipped.length-1;i++)waterPoints.push(...waterVertex(...clipped[0]),...waterVertex(...clipped[i]),...waterVertex(...clipped[i+1]));
  }
  for(let z=LAKE.minZ;z<LAKE.maxZ;z+=2)for(let x=LAKE.minX;x<LAKE.maxX;x+=2){
    if(!world.waterAt(x+1,z+1)&&!world.waterAt(x,z)&&!world.waterAt(x+2,z+2))continue;
    clipTriangle([[x,z],[x,z+2],[x+2,z]]);clipTriangle([[x+2,z],[x,z+2],[x+2,z+2]]);
  }
  const waterUniforms={time:wind.wildsTime};
  const waterMaterial=new ShaderMaterial({uniforms:waterUniforms,transparent:true,depthWrite:false,side:DoubleSide,vertexShader:'attribute float waterDepth; varying float vDepth; varying vec3 vWorld; void main(){vDepth=waterDepth;vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}',fragmentShader:`varying vec3 vWorld;varying float vDepth;uniform float time;void main(){float wave=sin(vWorld.x*.64+time*1.6)*sin(vWorld.z*.38-time*.9);float streak=pow(max(0.0,sin(vWorld.x*.25+vWorld.z*.8+wave*.3)),24.0);float reflection=.5+.5*sin(vWorld.z*.043+wave*.025);vec3 deep=vec3(.15,.38,.44),sky=vec3(.57,.72,.72);vec3 color=mix(vec3(.43,.61,.49),mix(deep,sky,.22+reflection*.25),smoothstep(.05,2.0,vDepth));color+=vec3(.12,.15,.13)*streak*.3;color=mix(color,sky,1.0-exp(-distance(cameraPosition,vWorld)*.00055));gl_FragColor=vec4(color,.87);}`});
  waterMaterial.userData.wildsUniforms=[waterUniforms];
  const waterGeometry=geometryOf(waterPoints), waterDepths=new Float32Array(waterPoints.length/3);
  for(let i=0;i<waterDepths.length;i++)waterDepths[i]=Math.max(0,LAKE.height-heightAt(waterPoints[i*3],waterPoints[i*3+2]));
  waterGeometry.setAttribute('waterDepth',new BufferAttribute(waterDepths,1));
  const lake=new Mesh(waterGeometry,waterMaterial);lake.name='connected-lake';group.add(lake);
  const streamParts=[],fallParts=[];
  for(let i=1;i<STREAM.length;i++){const a=STREAM[i-1],b=STREAM[i];if(a[1]-b[1]>1)continue;const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),sx=-dz/length*1.2,sz=dx/length*1.2;streamParts.push(coloured(geometryOf([a[0]-sx,a[1]+.03,a[2]-sz,a[0]+sx,a[1]+.03,a[2]+sz,b[0]-sx,b[1]+.03,b[2]-sz,b[0]-sx,b[1]+.03,b[2]-sz,a[0]+sx,a[1]+.03,a[2]+sz,b[0]+sx,b[1]+.03,b[2]+sz]),'#87b9b1'));}
  for(const fall of FALLS){const points=[];for(let lane=0;lane<12;lane++){const x=fall.x+(lane/12-.5)*fall.width,w=fall.width/12*.8;points.push(x,fall.top,fall.z,x+w,fall.top,fall.z,x,fall.bottom,fall.z+fall.depth,x,fall.bottom,fall.z+fall.depth,x+w,fall.top,fall.z,x+w,fall.bottom,fall.z+fall.depth);}fallParts.push(coloured(geometryOf(points),'#cadfd4'));}
  merged(streamParts,leafMaterial,group,'descending-stream');merged(fallParts,leafMaterial,group,'two-step-waterfall');
  const propWood=[],propStone=[],propCloth=[],propIron=[],propGlow=[],propLeaves=[],propFlowers=[],campGlows=[];
  for(let i=0;i<180;i++){
    const a=i*2.399,r=2+Math.sqrt(hash(i,8))*13,x=Math.sin(a)*r,z=2+Math.cos(a)*r,y=world.floorAt(x,z);
    if(trailDistance(x,z)<1.5||world.waterAt(x,z))continue;
    for(let leaflet=0;leaflet<3;leaflet++){const angle=leaflet*Math.PI*2/3,cx=x+Math.sin(angle)*.045,cz=z+Math.cos(angle)*.045,points=[];for(let edge=0;edge<8;edge++){const u=edge*Math.PI/4,v=(edge+1)*Math.PI/4;points.push(cx,y+.025,cz,cx+Math.sin(u)*.035,y+.019,cz+Math.cos(u)*.045,cx+Math.sin(v)*.035,y+.019,cz+Math.cos(v)*.045);}propLeaves.push(coloured(geometryOf(points),'#698543'));}
  }
  for(const camp of CAMPS){
    const campGlow=[];
    for(let i=0;i<9;i++){const angle=i*Math.PI*2/9,x=camp.x-1.4+Math.sin(angle)*.6,z=camp.z+Math.cos(angle)*.6;propStone.push(coloured(new SphereGeometry(.17,7,4).scale(1,.7,1).translate(x,heightAt(x,z)+.12,z),'#aaa18b'));}
    propWood.push(limb([camp.x-1.8,camp.y+.1,camp.z-.2],[camp.x-1,camp.y+.1,camp.z+.2],.08,.08,'#776045'),limb([camp.x-1.8,camp.y+.12,camp.z+.2],[camp.x-1,camp.y+.12,camp.z-.2],.08,.08,'#776045'));
    campGlow.push(coloured(new SphereGeometry(.16,7,5).scale(1,2,1).translate(camp.x-1.4,camp.y+.36,camp.z),'#f6cc80'));
    const bedY=heightAt(camp.x+1.25,camp.z),bedPoints=[];
    const bed=(u,v)=>[camp.x+1.25+(u-.5)*.8,bedY+.065+Math.sin(u*Math.PI)*.052+Math.sin(v*Math.PI)*.015+Math.sin(v*Math.PI*9+u*4)*.024*Math.sin(u*Math.PI),camp.z+(v-.5)*1.7];
    for(let ix=0;ix<12;ix++)for(let iz=0;iz<24;iz++){const u=ix/12,v=iz/24,a=(ix+1)/12,b=(iz+1)/24;bedPoints.push(...bed(u,v),...bed(u,b),...bed(a,v),...bed(a,v),...bed(u,b),...bed(a,b));}
    for(const side of [0,1])for(let iz=0;iz<24;iz++){const a=bed(side,iz/24),b=bed(side,(iz+1)/24),c=[a[0]+(side?.015:-.015),bedY+.018,a[2]],d=[b[0]+(side?.015:-.015),bedY+.018,b[2]];bedPoints.push(...a,...c,...b,...b,...c,...d);}
    for(let segment=0;segment<12;segment++){
      const u=segment/12,v=(segment+1)/12,fold=t=>[camp.x+1.25+(t-.5)*.77,bedY+.17+Math.sin(t*Math.PI*4)*.018,camp.z+.56],a=fold(u),b=fold(v),c=[a[0],bedY+.115,camp.z+.82],d=[b[0],bedY+.115,camp.z+.82];bedPoints.push(...a,...c,...b,...b,...c,...d);
    }
    propCloth.push(coloured(geometryOf(bedPoints),'#aaa886',.025),coloured(new CylinderGeometry(.17,.17,.72,18,4).rotateZ(Math.PI/2).translate(camp.x+1.25,bedY+.19,camp.z-.72),'#c6c6a6'));
    for(const side of [-1,1]){
      propCloth.push(limb([camp.x+1.25+side*.38,bedY+.11,camp.z-.65],[camp.x+1.25+side*.38,bedY+.1,camp.z+.78],.018,.018,'#b9b898'));
      for(let ring=0;ring<3;ring++)propCloth.push(coloured(new TorusGeometry(.045+ring*.037,.008,4,18).rotateY(Math.PI/2).translate(camp.x+1.25+side*.366,bedY+.19,camp.z-.72),'#8e9576'));
    }
    propIron.push(coloured(new TorusGeometry(.22,.024,6,24).rotateX(Math.PI/2).translate(camp.x-1.4,camp.y+.73,camp.z),'#465148'),coloured(new TorusGeometry(.23,.014,5,20,Math.PI).translate(camp.x-1.4,camp.y+.74,camp.z),'#414d46'));
    for(let log=0;log<2;log++)for(let ring=0;ring<3;ring++)propWood.push(coloured(new TorusGeometry(.025+ring*.018,.006,4,12).rotateY(Math.PI/2-.46*(log?1:-1)).translate(camp.x-1.8,camp.y+.1+log*.02,camp.z+(log?.2:-.2)),'#a68e60'));
    for(const offset of [-.5,.5])propIron.push(limb([camp.x-1.4+offset,camp.y+.07,camp.z+.32],[camp.x-1.4,camp.y+1.3,camp.z],.025,.025,'#4e5853'));
    propIron.push(limb([camp.x-1.4,camp.y+.07,camp.z-.54],[camp.x-1.4,camp.y+1.3,camp.z],.025,.025,'#4e5853'),coloured(new SphereGeometry(.23,10,6,0,Math.PI*2,Math.PI/2,Math.PI/2).translate(camp.x-1.4,camp.y+.73,camp.z),'#586158'));
    const lx=camp.x+2.1,lz=camp.z-1.5,ly=heightAt(lx,lz);propWood.push(limb([lx,ly,lz],[lx,ly+1.8,lz],.035,.025,'#776045'));
    propIron.push(coloured(new BoxGeometry(.24,.35,.24).translate(lx,ly+1.5,lz),'#4d6055'));campGlow.push(coloured(new BoxGeometry(.19,.25,.19).translate(lx,ly+1.5,lz),'#ffdea0'));
    const glow=merged(campGlow,amberMaterial,group,`camp-${camp.id}-glow`);glow.visible=camp.id==='clearing';campGlows.push({id:camp.id,mesh:glow});
  }
  const merchant=LANDMARKS.merchant;
  for(const x of [-1.7,1.7])for(const z of [-.8,.8])propWood.push(limb([merchant.x+x,heightAt(merchant.x+x,merchant.z+z),merchant.z+z],[merchant.x+x,merchant.y+2.1,merchant.z+z],.07,.055,'#7c7050'));
  const tarpPoints=[];
  const tarp=(u,v)=>[merchant.x+(u-.5)*3.8,merchant.y+2.55-Math.abs(v)*.45-Math.sin(u*Math.PI)*(.11+Math.abs(v)*.05)+Math.sin(u*Math.PI*14+v*3)*.024*Math.abs(v)+Math.sin(v*Math.PI*7)*.018*Math.sin(u*Math.PI),merchant.z+v];
  for(let segment=0;segment<24;segment++)for(let depth=0;depth<8;depth++)for(const side of [-1,1]){const a=segment/24,b=(segment+1)/24,u=side*depth/8,v=side*(depth+1)/8;tarpPoints.push(...tarp(a,u),...tarp(b,u),...tarp(a,v),...tarp(a,v),...tarp(b,u),...tarp(b,v));}
  for(const side of [-1,1])for(let segment=0;segment<24;segment++){const u=segment/24,v=(segment+1)/24,a=tarp(u,side),b=tarp(v,side),c=[a[0],a[1]-.16-.025*Math.sin(u*Math.PI*8),a[2]+side*.015],d=[b[0],b[1]-.16-.025*Math.sin(v*Math.PI*8),b[2]+side*.015];tarpPoints.push(...a,...c,...b,...b,...c,...d);propCloth.push(limb(c,d,.012,.012,'#e3d1aa'));}
  propCloth.push(coloured(geometryOf(tarpPoints),'#c5b38f',.025));
  for(const side of [-1,1])for(const u of [.05,.95]){const a=tarp(u,side),b=[a[0]+(u<.5?-.7:.7),heightAt(a[0]+(u<.5?-.7:.7),a[2]+side*.7)+.05,a[2]+side*.7];propWood.push(limb(a,b,.012,.012,'#ad9d74'));}

  for(let plank=0;plank<4;plank++){const geometry=new BoxGeometry(2.8,.105,.151,12,1,2),points=geometry.attributes.position;for(let i=0;i<points.count;i++){const x=points.getX(i),z=points.getZ(i);if(points.getY(i)>0)points.setY(i,points.getY(i)+Math.sin(x*7+plank)*.007+Math.sin(x*19+z*9)*.003);if(Math.abs(x)>1.39)points.setX(i,x+Math.sin(z*27+plank)*.009);}geometry.computeVertexNormals();geometry.translate(merchant.x,merchant.y+.8,merchant.z+.11+plank*.162);propWood.push(coloured(geometry,plank%2?'#8b7751':'#a28b61',.045));for(let scratch=0;scratch<3;scratch++){const x=merchant.x-.95+scratch*.8,z=merchant.z+.11+plank*.162;propWood.push(limb([x,merchant.y+.858,z],[x+.35,merchant.y+.858,z+.004],.003,.001,'#63583f'));}}
  for(const x of [-1.1,1.1])propWood.push(limb([merchant.x+x,merchant.y,merchant.z+.35],[merchant.x+x,merchant.y+.8,merchant.z+.35],.075,.065,'#776c4e'));
  for(let i=0;i<4;i++){const x=merchant.x-.85+i*.25,z=merchant.z+.35,h=.22+i%2*.055,color=i%3===0?'#80a193':i%3===1?'#c0b18a':'#8199ad';propCloth.push(coloured(new CylinderGeometry(.061,.075,h,10,3).translate(x,merchant.y+.86+h/2,z),color),coloured(new CylinderGeometry(.023,.036,.11,8).translate(x,merchant.y+.86+h+.045,z),color),coloured(new TorusGeometry(.025,.008,5,12).rotateX(Math.PI/2).translate(x,merchant.y+.86+h+.10,z),'#d5cab0'));}
  propIron.push(coloured(new BoxGeometry(.06,.045,.8).rotateY(.4).translate(merchant.x+.65,merchant.y+.9,merchant.z+.3),'#d0d5bd'));
  propCloth.push(coloured(new CylinderGeometry(.24,.4,.86,9).translate(merchant.x,merchant.y+.5,merchant.z-.45),'#738a7a'),coloured(new SphereGeometry(.21,10,7).translate(merchant.x,merchant.y+1.15,merchant.z-.45),'#bdad88'));
  const bridge=LANDMARKS.bridge;
  for(const side of [-1,1])for(const x of [-128,-125,-117,-114]){propStone.push(coloured(new BoxGeometry(.3,.55,.24).translate(x,bridge.y+.275,bridge.z+side*1),'#b5ad91'));}
  const shrine=LANDMARKS.shrine;
  for(let i=0;i<5;i++)propStone.push(coloured(new SphereGeometry(1,9,5).scale(.48-i*.06,.1,.38-i*.045).translate(shrine.x,shrine.y+.1+i*.18,shrine.z),'#b1b09a'));
  for(let i=0;i<18;i++){const a=i*2.399,x=shrine.x+Math.sin(a)*(.4+hash(i,1)),z=shrine.z+Math.cos(a)*(.4+hash(i,2)),y=heightAt(x,z);propLeaves.push(leaf(x,y+.03,z,.24,a,.4,'#678750'));for(let petal=0;petal<5;petal++){const turn=petal*Math.PI*2/5;propFlowers.push(leaf(x,y+.19,z,.12,turn,.6,i%3?'#e4e0b8':'#b7bdd7'));}}
  const oak=LANDMARKS.oak,seatX=oak.x-6,seatZ=oak.z+2,seatY=heightAt(seatX,seatZ)+.62;
  for(const x of [seatX-.32,seatX+.32])propWood.push(limb([x,seatY+.04,seatZ],[x,oak.y+17.8,seatZ],.018,.018,'#b4aa7f'));
  propWood.push(coloured(new BoxGeometry(.86,.09,.35).translate(seatX,seatY,seatZ),'#aa9467'));
  const hollow=LANDMARKS.hollow,tubePoints=[];
  for(let end=0;end<2;end++)for(let i=0;i<20;i++){
    const a=i*Math.PI/10,b=(i+1)*Math.PI/10,x=hollow.x+(end?6:-6),y=heightAt(x,hollow.z)+1.27;
    const p=(angle,r)=>[x,y+Math.sin(angle)*r,hollow.z+Math.cos(angle)*r];
    tubePoints.push(...p(a,1.6),...p(a,1.18),...p(b,1.6),...p(b,1.6),...p(a,1.18),...p(b,1.18));
    for(const r of [1.18,1.6]){const xx=hollow.x+(end?-6:6),yy=heightAt(xx,hollow.z)+1.27;const q=angle=>[xx,yy+Math.sin(angle)*r,hollow.z+Math.cos(angle)*r];tubePoints.push(...p(a,r),...q(a),...p(b,r),...p(b,r),...q(a),...q(b));}
  }
  propWood.push(coloured(geometryOf(tubePoints),'#897755'));
  const observatory=LANDMARKS.observatory, observatoryY=world.floorAt(observatory.x,observatory.z);
  const domePoints=[];
  for(let i=0;i<22;i++)for(let j=0;j<5;j++){
    if(i>6&&i<12||j===4&&i%3===0)continue;
    const a=i*Math.PI/11,b=(i+1)*Math.PI/11,u=j*Math.PI/12,v=(j+1)*Math.PI/12;
    const p=(angle,h)=>[observatory.x+Math.sin(angle)*Math.cos(h)*5,observatoryY+3+Math.sin(h)*5,observatory.z+Math.cos(angle)*Math.cos(h)*5];
    domePoints.push(...p(a,u),...p(b,u),...p(a,v),...p(a,v),...p(b,u),...p(b,v));
  }
  propStone.push(coloured(geometryOf(domePoints),'#aeb0a5'));
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9,x=observatory.x+Math.sin(a)*4.6,z=observatory.z+Math.cos(a)*4.6;propStone.push(limb([x,observatoryY,z],[x,observatoryY+3,z],.3,.25,'#b4b19e'));}
  merged(propWood,barkMaterial,group,'grounded-camp-and-landmark-wood');merged(propStone,rockMaterial,group,'camp-shrine-observatory-stone');merged(propCloth,clothMaterial,group,'camp-merchant-cloth');merged(propIron,ironMaterial,group,'camp-and-merchant-metal');merged(propGlow,amberMaterial,group,'camp-and-merchant-lights');merged(propLeaves,leafMaterial,group,'shrine-offerings');merged(propFlowers,clothMaterial,group,'shrine-flowers');
  const shoreLeaves=[],shoreStones=[],fieldFlowers=[];
  for(let z=LAKE.minZ;z<=LAKE.maxZ;z+=5)for(let x=LAKE.minX;x<=LAKE.maxX;x+=5){
    const water=world.waterAt(x,z);if(!water||water.depth>.85)continue;
    const y=heightAt(x,z);for(let blade=0;blade<7;blade++)shoreLeaves.push(leaf(x+(hash(blade,x)-.5)*.6,y,z+(hash(blade,z)-.5)*.6,.9+hash(blade,x+z)*.6,blade*2.399,.12,'#769171'));
    shoreStones.push(coloured(new SphereGeometry(.14,7,4).scale(1,.5,1.3).translate(x+.3,y+.05,z-.2),'#bcb9a0'));
  }
  for(let i=2;i<TRAIL.length;i++)for(let patch=0;patch<4;patch++){
    const x=TRAIL[i][0]+(patch%2?1:-1)*(2.2+hash(patch,i)*2),z=TRAIL[i][1]+(hash(i,patch)-.5)*4,y=heightAt(x,z);
    for(let fern=0;fern<7;fern++)shoreLeaves.push(leaf(x,y+.02,z,.48,fern*Math.PI*2/7,.75,'#668952'));
    for(let petal=0;petal<5;petal++)fieldFlowers.push(leaf(x+.25,y+.31,z+.2,.095,petal*Math.PI*2/5,.8,'#e6e6bc'));
  }
  for(let segment=1;segment<TRAIL.length;segment++){
    const [ax,az]=TRAIL[segment-1],[bx,bz]=TRAIL[segment],length=Math.hypot(bx-ax,bz-az),nx=(bz-az)/length,nz=(ax-bx)/length;
    for(let step=0;step<Math.ceil(length*1.8);step++){
      const t=(step+.5)/Math.ceil(length*1.8),offset=(hash(step,segment*7)-.5)*2.4,x=ax+(bx-ax)*t+nx*offset,z=az+(bz-az)*t+nz*offset,r=.025+hash(step+50,segment)*.055;
      if(world.waterAt(x,z))continue;
      shoreStones.push(coloured(new SphereGeometry(r,6,4).scale(1,.3,.8).translate(x,world.floorAt(x,z)+r*.17,z),step%3?'#b2a68b':'#8f9380'));
      if(step%3)continue;
      const side=step%2?1:-1,cx=ax+(bx-ax)*t+nx*(1.7+hash(step+29,segment)*.9)*side,cz=az+(bz-az)*t+nz*(1.7+hash(step+29,segment)*.9)*side,cy=world.floorAt(cx,cz);
      if(world.waterAt(cx,cz))continue;
      for(let clover=0;clover<6;clover++){
        const a=clover*2.399,xx=cx+Math.sin(a)*.17,zz=cz+Math.cos(a)*.17,y=world.floorAt(xx,zz)+.035;
        for(let lobe=0;lobe<3;lobe++)shoreLeaves.push(leaf(xx,y,zz,.08,lobe*Math.PI*2/3+a,.12,clover%2?'#83a558':'#547c48'));
      }
    }
  }
  merged(shoreLeaves,leafMaterial,group,'shore-reeds-and-trail-ferns');merged(shoreStones,rockMaterial,group,'shallow-pebbles');merged(fieldFlowers,clothMaterial,group,'trail-wildflowers');
  const skyUniforms={top:{value:new Color('#88bce0')},horizon:{value:new Color('#c4d8df')},time:wind.wildsTime};
  const skyMaterial=new ShaderMaterial({side:BackSide,depthWrite:false,uniforms:skyUniforms,vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
    varying vec3 vDirection;uniform vec3 top;uniform vec3 horizon;uniform float time;
    float hashCloud(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float noiseCloud(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hashCloud(i),hashCloud(i+vec2(1,0)),f.x),mix(hashCloud(i+vec2(0,1)),hashCloud(i+vec2(1,1)),f.x),f.y);}
    void main(){vec3 direction=normalize(vDirection);float elevation=direction.y;vec3 color=mix(horizon,top,smoothstep(-.05,.65,elevation));vec2 uv=direction.xz/max(.12,elevation+.12)*1.6+vec2(time*.001,0);float large=noiseCloud(uv*2.2);float detail=noiseCloud(uv*6.0)*.25+noiseCloud(uv*16.0)*.1;float cloud=smoothstep(.61,.79,large*.75+detail)*smoothstep(.06,.2,elevation);vec3 shade=mix(vec3(.71,.79,.83),vec3(.97,.98,.95),smoothstep(.5,.88,large+detail));color=mix(color,shade,cloud*.9);gl_FragColor=vec4(color,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `});
  skyMaterial.userData.wildsUniforms=[skyUniforms];const sky=new Mesh(new SphereGeometry(6000,24,14),skyMaterial);sky.name='valley-sky';sky.renderOrder=-10;group.add(sky);
  const discoveries=createDiscoveries(group,{world,material:rockMaterial,glowMaterial:amberMaterial}),herbMeshes=[];
  for(const herb of HERBS){const leaves=[];for(let i=0;i<6;i++)leaves.push(leaf(0,.04,0,.26,i*Math.PI/3,.65,'#719659'));const holder=new Group();holder.position.set(herb.x,herb.y,herb.z);holder.name=`herb-${herb.id}`;merged(leaves,leafMaterial,holder,'herb-leaves');group.add(holder);herbMeshes.push({id:herb.id,holder});}
  const standingParts=[],spiralPoints=[];
  for(const stone of STONES){
    const base=heightAt(stone.x,stone.z),points=[],rings=7,sides=11;
    const stonePoint=(ring,side)=>{const angle=side*Math.PI*2/sides,y=base+stone.height*ring/rings,r=.65-.13*(ring/rings)+Math.sin(angle*3+stone.index)*.017;return[stone.x+Math.sin(angle)*r,y,stone.z+Math.cos(angle)*r];};
    for(let ring=0;ring<rings;ring++)for(let side=0;side<sides;side++)points.push(...stonePoint(ring,side),...stonePoint(ring,side+1),...stonePoint(ring+1,side),...stonePoint(ring,side+1),...stonePoint(ring+1,side+1),...stonePoint(ring+1,side));
    for(let side=0;side<sides;side++)points.push(stone.x,base+stone.height,stone.z,...stonePoint(rings,side),...stonePoint(rings,side+1));
    standingParts.push(coloured(geometryOf(points),'#a9aa91',.13));
    const nx=(ARENA.x-stone.x)/ARENA.radius,nz=(ARENA.z-stone.z)/ARENA.radius,rx=nz,rz=-nx;
    const carved=(t,width)=>{const a=t*Math.PI*5,r=.025+t*.23,u=Math.cos(a)*r+width*Math.cos(a),v=Math.sin(a)*r+width*Math.sin(a),front=Math.sqrt(Math.max(0,.605*.605-u*u));return[stone.x+nx*front+rx*u,base+1.72+v,stone.z+nz*front+rz*u];};
    for(let j=0;j<90;j++){const a=j/90,b=(j+1)/90;spiralPoints.push(...carved(a,-.008),...carved(a,.008),...carved(b,-.008),...carved(b,-.008),...carved(a,.008),...carved(b,.008));}
  }
  const standingStones=merged(standingParts,rockMaterial,group,'valley-standing-stones',true);
  const spiralMaterial=new MeshBasicMaterial({color:'#d3d9a6',side:DoubleSide,transparent:true,opacity:.3});
  const spirals=new Mesh(geometryOf(spiralPoints),spiralMaterial);spirals.name='carved-stone-spirals';group.add(spirals);
  let elapsed=0;
  function update(sim,encounter,exploration={},dt=0,reducedMotion=false){
    for(const camp of campGlows)camp.mesh.visible=(exploration.lit||['clearing']).includes(camp.id);
    elapsed+=dt;spiralMaterial.opacity=encounter.status==='fighting'?.65:.25;wind.wildsTime.value=elapsed;wind.wildsWind.value=reducedMotion?0:1;wind.wildsPlayer.value.set(sim.player.x,sim.player.y,sim.player.z);wind.wildsPet.value.set(encounter.pet.x,encounter.pet.y,encounter.pet.z);
    scheduleGrass(sim.player.x,sim.player.z);if(queueCount)refillGrass();
    const shadowNear=Math.hypot(sim.player.x,sim.player.z)<105;if(nearTrunks)nearTrunks.castShadow=shadowNear;if(nearLeaves)nearLeaves.castShadow=shadowNear;
    discoveries.update(exploration.found);
    for(const herb of herbMeshes)herb.holder.visible=!(exploration.herbs||[]).includes(herb.id);
  }
  return {update,group,skyUniforms,diagnostics:()=>({grassInstances:grassCount,grassVisible,grassPending:queueCount,treeAnchors:treeAnchors.length,forestTrees:forest.length,waterTriangles:waterPoints.length/9})};
}
