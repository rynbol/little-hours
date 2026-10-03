import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SECRETS } from '../../core/wilds/world.js';

function paint(geometry, colour) {
  geometry.deleteAttribute('uv');
  const base=new Color(colour),position=geometry.attributes.position,colours=[];
  for(let i=0;i<position.count;i++){
    const variation=.88+.12*Math.sin(position.getX(i)*23+position.getY(i)*31+position.getZ(i)*17);
    colours.push(base.r*variation,base.g*variation,base.b*variation);
  }
  geometry.setAttribute('color',new BufferAttribute(new Float32Array(colours),3));
  return geometry.index?geometry.toNonIndexed():geometry;
}
function plank(x,y,z,width,height,depth,colour) {
  const vertices=[],h=height*.5,w=width*.5,d=depth*.5,cut=Math.min(w,d)*.15;
  const outline=[[-w+cut,-d],[w-cut,-d],[w,-d+cut],[w,d-cut],[w-cut,d],[-w+cut,d],[-w,d-cut],[-w,-d+cut]];
  const point=(p,v)=>[p[0]+x,y+v,p[1]+z];
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];
    vertices.push(...point(a,-h),...point(a,h),...point(b,-h),...point(a,h),...point(b,h),...point(b,-h),x,y+h,z,...point(b,h),...point(a,h),x,y-h,z,...point(a,-h),...point(b,-h));
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));geometry.computeVertexNormals();return paint(geometry,colour);
}
function sphere(x,y,z,rx,ry,rz,colour){return paint(new SphereGeometry(1,12,8).scale(rx,ry,rz).translate(x,y,z),colour);}
function ring(x,y,z,r,t,colour,axis='z'){
  const geometry=new TorusGeometry(r,t,5,22);if(axis==='y')geometry.rotateX(Math.PI*.5);return paint(geometry.translate(x,y,z),colour);
}
function stem(x,y,z,r,height,colour){return paint(new CylinderGeometry(r*.78,r,height,9).translate(x,y,z),colour);}
function pod(x,y,z,colour){
  const geometry=new SphereGeometry(.11,12,9),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const v=positions.getY(i)/.11,taper=.62+.38*(1-v)*.5;
    positions.setXYZ(i,positions.getX(i)*taper+x,y+positions.getY(i)*1.7,positions.getZ(i)*taper+z);
  }
  geometry.computeVertexNormals();return paint(geometry,colour);
}
function sword(parts){
  const blade=new BufferGeometry(),v=[-.055,.16,0,.055,.16,0,0,.08,0,-.055,.16,0,-.075,.86,0,.075,.86,0,-.055,.16,0,.075,.86,0,.055,.16,0];
  const positions=[];for(const side of [-1,1])for(let triangle=0;triangle<v.length;triangle+=9)for(const order of side<0?[0,3,6]:[6,3,0]){const i=triangle+order;positions.push(v[i],v[i+1],side*(order===6?.027:.016));}
  blade.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));blade.computeVertexNormals();parts.push(paint(blade,'#cbd6c2'));
  parts.push(plank(0,.88,0,.35,.055,.065,'#bc9760'),stem(0,1,0,.031,.22,'#604a39'),sphere(0,1.13,0,.047,.042,.04,'#b6a278'));
  for(let i=0;i<7;i++)parts.push(ring(0,.925+i*.024,0,.033,.005,'#99815d','y'));
  for(let i=0;i<5;i++){const angle=i*2.399;parts.push(sphere(Math.sin(angle)*.21,.015,Math.cos(angle)*.16,.14,.04,.06,'#746544'));}
}
function chest(parts){
  for(let i=0;i<5;i++)parts.push(plank(0,.09+i*.068,0,.68,.064,.43,i%2?'#8d7350':'#a1845a'));
  for(let i=0;i<9;i++){
    const angle=(i+.5)/9*Math.PI,geometry=plank(0,.36+Math.sin(angle)*.12,Math.cos(angle)*.2,.69,.055,.075,'#ac8e62');parts.push(geometry);
  }
  for(const x of [-.22,.22]){parts.push(plank(x,.23,-.224,.035,.31,.012,'#74684e'),plank(x,.23,.224,.035,.31,.012,'#74684e'));for(let i=0;i<11;i++){const angle=i/10*Math.PI;parts.push(sphere(x,.368+Math.sin(angle)*.13,Math.cos(angle)*.216,.023,.009,.016,'#b9a16b'));}}
  parts.push(plank(0,.31,.236,.085,.11,.027,'#d0b77b'),sphere(0,.3,.259,.014,.025,.008,'#4c5447'));
}
function clothRoll(parts,colour){
  const geometry=new CylinderGeometry(.125,.13,.46,16,5);geometry.rotateZ(Math.PI*.5);parts.push(paint(geometry.translate(0,.14,0),colour));
  parts.push(plank(0,.035,.14,.5,.045,.34,colour));
  for(const x of [-.14,.14])parts.push(paint(new TorusGeometry(.133,.014,5,22).rotateY(Math.PI*.5).translate(x,.14,0),'#9a815d'));
  for(let i=0;i<10;i++)parts.push(sphere(-.2+i*.045,.059,.31,.007,.005,.008,'#d6c5a0'));
}
export function createDiscoveries(parent,{world,material,glowMaterial}){
  const items=[];
  for(const secret of SECRETS){
    const holder=new Group();holder.name=`secret-${secret.id}`;holder.position.set(secret.x,world.floorAt(secret.x,secret.z,secret.y+.01),secret.z);parent.add(holder);
    const parts=[],lights=[];
    if(secret.kind==='sword')sword(parts);
    else if(secret.kind==='chest')chest(parts);
    else if(secret.kind==='cape')clothRoll(parts,'#718fa1');
    else if(secret.kind==='stamina'||secret.kind==='heart'){
      parts.push(stem(0,.11,0,.016,.22,'#758554'));
      for(let i=0;i<5;i++){const a=i*2.399;parts.push(sphere(Math.sin(a)*.1,.07+i*.012,Math.cos(a)*.1,.08,.018,.035,i%2?'#7d9453':'#a4b571'));}
      lights.push(pod(0,.28,0,secret.kind==='heart'?'#e8ae80':'#d6dd90'));
    }else if(secret.kind==='cache'){
      parts.push(sphere(0,.04,0,.3,.085,.25,'#928260'),plank(0,.1,0,.29,.025,.22,'#baa883'),sphere(0,.16,0,.14,.055,.12,'#b39768'),ring(0,.207,0,.069,.012,'#d8c08d','y'));
      lights.push(plank(0,.213,0,.025,.007,.1,'#d9e5c2'));
    }else if(secret.kind==='charm'){
      holder.position.x+=.7;parts.push(ring(0,.035,0,.12,.013,'#b1a58a','y'));
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;parts.push(sphere(Math.sin(a)*.12,.035,Math.cos(a)*.12,.034,.02,.027,i%2?'#e6d7c2':'#cbaea8'));}
      lights.push(sphere(0,.03,0,.057,.03,.057,'#bfcee0'));
    }else{
      parts.push(plank(0,.04,0,.3,.08,.24,'#9b936c'));
      lights.push(pod(0,.25,0,'#96c6c5'),pod(-.08,.16,.02,'#b9d9ce'),pod(.07,.17,-.02,'#93b5c0'));
    }
    for(const [geometries,paintMaterial,name]of[[parts,material,'discovery-crafted'],[lights,glowMaterial,'discovery-light']]){
      if(!geometries.length)continue;
      const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const mesh=new Mesh(geometry,paintMaterial);mesh.name=`${name}-${secret.id}`;mesh.castShadow=true;mesh.receiveShadow=true;holder.add(mesh);
    }
    items.push({id:secret.id,holder});
  }
  return {update(found=[]){for(const item of items)item.holder.visible=!found.includes(item.id);},items};
}
