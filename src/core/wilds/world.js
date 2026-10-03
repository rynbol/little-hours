import { heightAt } from '../world-terrain.js';
import { clockRandom } from '../test-pins.js';

const point = (x, z, lift = 0) => Object.freeze({ x, y: heightAt(x, z) + lift, z });
export const LANDMARKS = Object.freeze({ camp: point(0, 2), merchant: point(-3, 2), arena: point(0, -24), vista: point(-18, -65), trailCamp: point(-72, -180), oak: point(35, -220), shrine: point(-68, -205), ruins: point(-85, -305), cliff: point(-95, -315, 16), hollow: point(-122, -356), bridge: Object.freeze({x:-121,y:-43.1,z:-360}), shoreCamp: point(-220, -414), lake: point(-160, -400), observatory: point(-230, -430, 28) });
export const CAMPS = Object.freeze([['clearing', 'camp'], ['meadow', 'trailCamp'], ['shore', 'shoreCamp']].map(([id, name]) => Object.freeze({ id, ...LANDMARKS[name] })));
export const TRAIL = Object.freeze([[0,2],[-8,-8],[-16,-28],[-18,-65],[-36,-98],[-55,-134],[-72,-180],[-68,-205],[-78,-254],[-85,-291],[-102,-322],[-123,-350],[-157,-361],[-204,-369],[-225,-399],[-220,-414],[-230,-430]].map(Object.freeze));
const sourceWater=heightAt(-113,-329)+11.03,shelfWater=heightAt(-116,-342)+6.03,footWater=heightAt(-119,-353)+.03;
export const STREAM = Object.freeze([[-111,sourceWater,-327],[-114,sourceWater,-334],[-114,shelfWater,-337],[-119,shelfWater,-351],[-119,footWater,-353],[-122,-44,-359],[-126,-44,-368]].map(Object.freeze));
export const FALLS = Object.freeze([{ x:-114,z:-334,top:sourceWater,bottom:shelfWater,width:3.8,depth:-3 },{ x:-119,z:-351,top:shelfWater,bottom:footWater,width:4.6,depth:-2 }].map(Object.freeze));
export const LAKE = Object.freeze({ height: -44, minX: -218, maxX: -58, minZ: -432, maxZ: -352 });
function footprint(s) {
  const hx=s.halfX,hz=s.halfZ,rounded=s.kind==='rock' || s.id==='oak-trunk',unit=Math.min(hx,hz);
  const [nw,ne,se,sw]=s.id==='oak-trunk' ? Array(4).fill(unit*(2-Math.SQRT2)) : [.45,.6,.35,.55].map(v=>v*unit);
  const vertices=rounded ? [[-hx+nw,-hz],[hx-ne,-hz],[hx,-hz+ne],[hx,hz-se],[hx-se,hz],[-hx+sw,hz],[-hx,hz-sw],[-hx,-hz+nw]] : [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]];
  return Object.freeze(vertices.map(([x,z])=>Object.freeze([s.x+x,s.z+z])));
}
export const solidFootprint = s => s.footprint;
const solid = (id, kind, x, z, halfX, halfZ, height, bottom = heightAt(x, z) - .6) => Object.freeze({ id, kind, x, z, halfX, halfZ, bottom, top: heightAt(x, z) + height, climbable: true });
export const SOLIDS = Object.freeze([
  solid('practice-ledge', 'rock', -13, -12, 2.8, 2.2, 3.5),
  solid('cliff', 'rock', -95, -315, 8, 7, 16),
  solid('cliff-shoulder', 'rock', -109, -315, 6, 12, 10),
  solid('falls-source', 'rock', -113, -329, 7, 5, 11),
  solid('falls-shelf', 'rock', -116, -342, 7, 5, 6),
  Object.freeze({id:'secret-overhang',kind:'rock',x:-119,z:-349,halfX:4,halfZ:2,bottom:heightAt(-119,-350)+3.7,top:shelfWater-.03,climbable:true}),
  solid('ruin-west', 'ruin', -90, -305, .6, 5, 8),
  solid('ruin-east', 'ruin', -80, -305, .6, 5, 6),
  solid('ruin-roof', 'ruin', -87, -305, 3.6, 3.5, 8, heightAt(-85,-305) + 7.5),
  solid('oak-trunk', 'oak', 35, -220, 1.5, 1.5, 18),
  solid('oak-branch', 'oak', 29, -220, 6, 1.1, 18, heightAt(35,-220) + 17.2),
  solid('glide-column', 'rock', -15, -255, .7, .7, 5),
  solid('glide-ledge', 'rock', -15, -255, 5, 5, 8, heightAt(-15,-255) + 5),
  solid('observatory-ridge', 'rock', -230, -430, 13, 10, 28),
  solid('observatory-step', 'rock', -220, -430, 8, 12, 15),
  ...[[-126,3,1.1,'west'],[-116,3,1.1,'east'],[-121,2.1,.4,'log']].map(([x,halfX,halfZ,id])=>Object.freeze({id:`bridge-${id}`,kind:'bridge',x,z:-360,halfX,halfZ,bottom:heightAt(x,-360)-.5,top:-43.1,climbable:true})),
].map(s=>Object.freeze({...s,footprint:footprint(s)})));
const plantedTrees = [
  [-11,8,13,1.0,'oak'],[12,2,14,1.1,'beech'],[-12,-34,15,1.1,'beech'],[12,-45,17,1.2,'oak'],[-33,-53,15,1,'oak'],[4,-65,16,1.2,'beech'],[-42,-103,18,1.3,'oak'],[-79,-175,15,1,'beech'],[35,-220,26,1.6,'oak'],[-147,-360,17,1.1,'oak'],[-220,-389,19,1.3,'beech'],[-241,-415,18,1.2,'oak'],[53,-161,23,1,'pine'],[78,-220,25,1.1,'pine'],[-148,-298,26,1.2,'pine'],[-175,-318,23,.9,'pine'],
].map(([x,z,height,radius,species],i) => Object.freeze({ id: `tree-${i}`, hero:true, x, z, y: heightAt(x,z), height, radius, lean: Object.freeze([Math.sin(i*2.3)*1.8,Math.cos(i*1.7)*1.2]), species }));
export function trailDistance(x,z) {
  let distance=Infinity;
  for(let i=1;i<TRAIL.length;i++) {
    const [ax,az]=TRAIL[i-1],[bx,bz]=TRAIL[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-ax-dx*t,z-az-dz*t));
  }
  return distance;
}
const forestTrees=[];
for(let gx=-5;gx<=3;gx++) for(let gz=-9;gz<=1;gz++) {
  const groveX=gx*58+(clockRandom()-.5)*26,groveZ=gz*58+(clockRandom()-.5)*26,grove=clockRandom();
  if(grove<.2)continue;
  const count=3+Math.floor(grove*5);
  for(let n=0;n<count;n++){
    const angle=clockRandom()*Math.PI*2,radius=n===0?0:7+clockRandom()*12;
    const x=groveX+Math.sin(angle)*radius,z=groveZ+Math.cos(angle)*radius,pick=clockRandom(),y=heightAt(x,z);
    const reveal=z<-45 && z>-355 && Math.abs(x-(-18+(z+65)*.424))<Math.min(30,8+Math.abs(z+65)*.075);
    if(reveal || trailDistance(x,z)<6 || Math.hypot(x,z+24)<21 || y<-43.5 || SOLIDS.some(s=>Math.abs(x-s.x)<s.halfX+7 && Math.abs(z-s.z)<s.halfZ+7) || CAMPS.some(c=>Math.hypot(x-c.x,z-c.z)<8) || plantedTrees.some(t=>Math.hypot(x-t.x,z-t.z)<9) || forestTrees.some(t=>Math.hypot(x-t.x,z-t.z)<5.5))continue;
    forestTrees.push(Object.freeze({id:`forest-${gx}-${gz}-${n}`,hero:false,x,y,z,height:11+pick*15,radius:.5+pick*.45,lean:Object.freeze([Math.sin(gx+gz+n)*1.5,Math.cos(gx-gz+n)*1.5]),species:grove>.7?'pine':pick>.35?'beech':'oak'}));
  }
}
export const HERO_TREES=Object.freeze([...plantedTrees,...forestTrees]);
export const SECRETS = Object.freeze([
  { id: 'root-sword', kind: 'sword', ...point(-122,-356,.35), xp: 45, label: 'The hollow keeper', reward: 'A root-forged sword' },
  { id: 'cliff-seed', kind: 'stamina', ...point(-95,-315,16), xp: 35, label: 'Above the wind', reward: 'A seed of stamina' },
  { id: 'falls-heart', kind: 'heart', ...point(-119,-350,.15), xp: 35, label: 'Under the falling light', reward: 'A seed of heart' },
  { id: 'wind-chest', kind: 'chest', ...point(-15,-255,8), xp: 55, label: 'Where the oak points', reward: 'A copper clasp for your cape' },
  { id: 'pip-cache', kind: 'cache', ...point(-42,-175), xp: 35, label: 'Pip was here', reward: 'A little compass keepsake' },
  { id: 'shrine-charm', kind: 'charm', ...point(-68,-205,.65), xp: 30, label: 'Flowers for a friend', reward: 'A protective flower charm' },
  { id: 'ruin-cape', kind: 'cape', ...point(-87,-305,8), xp: 45, label: 'The skyward room', reward: 'A stitched blue cape' },
  { id: 'shore-trophy', kind: 'trophy', ...point(-196,-390,.1), xp: 30, label: 'A small piece of spring', reward: 'A lake-glass keepsake' },
].map(Object.freeze));
export const HERBS = Object.freeze([[-10,-48],[-34,-99],[-59,-154],[-73,-198],[-82,-270],[-134,-353],[-212,-378],[-228,-411]].map(([x,z], i) => Object.freeze({id:`herb-${i}`,...point(x,z)})));
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const planes=new Map(SOLIDS.map(s=>[s,s.footprint.map((a,i)=>{
  const b=s.footprint[(i+1)%s.footprint.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=dz/length||0,nz=-dx/length||0;
  return {nx,nz,c:nx*a[0]+nz*a[1]};
})]));
const inside = (s,x,z,pad=0) => Math.abs(x-s.x)<=s.halfX+Math.max(0,pad) && Math.abs(z-s.z)<=s.halfZ+Math.max(0,pad) && planes.get(s).every(p=>p.nx*x+p.nz*z<=p.c+pad);
const paddedVertices=new Map(SOLIDS.map(s=>[s,planes.get(s).map((p,i,all)=>{
  const previous=all[(i+all.length-1)%all.length],a=previous.c+.32,b=p.c+.32,det=previous.nx*p.nz-previous.nz*p.nx;
  return [(a*p.nz-previous.nz*b)/det,(previous.nx*b-a*p.nx)/det];
})]));
function interval(s,x,z,dx,dz) {
  let enter=-Infinity,exit=Infinity,face=null;
  for(const p of planes.get(s)) {
    const distance=p.nx*x+p.nz*z-p.c-.32,rate=p.nx*dx+p.nz*dz;
    if(Math.abs(rate)<1e-10){if(distance>1e-8)return null;continue;}
    const t=-distance/rate;
    if(rate<0){if(t>enter){enter=t;face=p;}}else exit=Math.min(exit,t);
    if(enter>exit)return null;
  }
  return {enter,exit,face};
}
const lakeCells = new Set(), cellKey = (x,z) => `${Math.round(x/2)},${Math.round(z/2)}`;
const pending = [[-160,-400]];
while (pending.length) {
  const [x,z] = pending.pop(), key = cellKey(x,z);
  if (lakeCells.has(key) || x<LAKE.minX || x>LAKE.maxX || z<LAKE.minZ || z>LAKE.maxZ || heightAt(x,z)>=LAKE.height) continue;
  lakeCells.add(key); pending.push([x+2,z],[x-2,z],[x,z+2],[x,z-2]);
}

export function createValleyWorld() {
  const floorAt = (x,z,ceilingY=Infinity) => {
    let floor = heightAt(x,z);
    for (const s of SOLIDS) if (inside(s,x,z) && s.top <= ceilingY && s.top > floor) floor = s.top;
    return floor;
  };
  function climbContact(player, moveX, moveZ) {
    let nearest = null, best = Infinity;
    for (const s of SOLIDS) {
      if (!s.climbable || player.y+1.35<s.bottom || player.y>s.top+.1) continue;
      const vertices=paddedVertices.get(s),edges=planes.get(s);
      for(let i=0;i<vertices.length;i++) {
        const a=vertices[i],b=vertices[(i+1)%vertices.length],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((player.x-a[0])*dx+(player.z-a[1])*dz)/(dx*dx+dz*dz),0,1),x=a[0]+dx*t,z=a[1]+dz*t;
        const d=Math.hypot(player.x-x,player.z-z),{nx,nz}=edges[i];
        if(d>.65 || d>=best || moveX*nx+moveZ*nz>-.15)continue;
        best=d;nearest={id:s.id,x,z,normal:[nx,0,nz],bottom:s.bottom,top:s.top};
      }
    }
    return nearest;
  }
  function resolve(player, previous) {
    const bodies=SOLIDS.filter(s=>player.y<s.top-.04 && player.y+1.45>=s.bottom);
    let x=previous.x,z=previous.z,dx=player.x-x,dz=player.z-z;
    for(let pass=0;pass<6 && Math.hypot(dx,dz)>1e-9;pass++) {
      let hit=null;
      for(const s of bodies) {
        if(Math.max(x,x+dx)<s.x-s.halfX-.5 || Math.min(x,x+dx)>s.x+s.halfX+.5 || Math.max(z,z+dz)<s.z-s.halfZ-.5 || Math.min(z,z+dz)>s.z+s.halfZ+.5)continue;
        const crossing=interval(s,x,z,dx,dz);
        if(!crossing || crossing.enter< -1e-8 || crossing.enter>1 || crossing.exit<=Math.max(0,crossing.enter)+1e-9 || !crossing.face)continue;
        if(!hit || crossing.enter<hit.enter)hit=crossing;
      }
      if(!hit){x+=dx;z+=dz;dx=0;dz=0;break;}
      const t=clamp(hit.enter,0,1),{nx,nz}=hit.face;
      x+=dx*t;z+=dz*t;
      dx*=1-t;dz*=1-t;
      const inward=dx*nx+dz*nz;
      if(inward<0){dx-=inward*nx;dz-=inward*nz;}
      const velocity=player.vx*nx+player.vz*nz;
      if(velocity<0){player.vx-=velocity*nx;player.vz-=velocity*nz;}
    }
    player.x=x;player.z=z;
    if(bodies.some(s=>inside(s,x,z,.32-1e-8))) {
      const normals=bodies.filter(s=>inside(s,x,z,.32)).flatMap(s=>planes.get(s).map(p=>[p.nx,p.nz]));
      let escape=null;
      for(const [nx,nz] of normals) {
        const spans=bodies.map(s=>interval(s,x,z,nx,nz)).filter(v=>v && v.exit>=0).sort((a,b)=>a.enter-b.enter);
        let exit=0;
        for(const span of spans){if(span.enter>exit+1e-7)break;exit=Math.max(exit,span.exit);}
        if(!escape || exit<escape.distance)escape={nx,nz,distance:exit};
      }
      if(escape){player.x+=escape.nx*(escape.distance+1e-7);player.z+=escape.nz*(escape.distance+1e-7);const inward=player.vx*escape.nx+player.vz*escape.nz;if(inward<0){player.vx-=inward*escape.nx;player.vz-=inward*escape.nz;}}
    }
    for (const tree of HERO_TREES) {
      if (tree.id==='tree-8' || player.y>tree.y+tree.height*.62) continue;
      const dx=player.x-tree.x,dz=player.z-tree.z,d=Math.hypot(dx,dz),r=tree.radius+.32;
      if (d>=r) continue;
      const nx=d>1e-8?dx/d:1,nz=d>1e-8?dz/d:0;
      player.x=tree.x+nx*r;player.z=tree.z+nz*r;
      const inward=player.vx*nx+player.vz*nz;
      if(inward<0){player.vx-=inward*nx;player.vz-=inward*nz;}
    }
  }
  const waterAt=(x,z)=>lakeCells.has(cellKey(x,z)) && heightAt(x,z)<LAKE.height ? {id:'lake',height:LAKE.height,depth:LAKE.height-heightAt(x,z)} : null;
  return { floorAt, climbContact, resolve, waterAt, cameraFloorAt:floorAt, solids:SOLIDS, trees:HERO_TREES, updraftAt:(x,z)=>Math.hypot(x-10,z+220)<24?2.4:0 };
}
