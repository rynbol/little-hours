import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createValleyWorld,SOLIDS,SECRETS,CAMPS,HERO_TREES,LAKE,trailDistance,solidFootprint} from './world.js';
import {heightAt} from '../world-terrain.js';
import {createFeelSimulation} from './feel.js';
test('rock and ruin tops support feet without snapping a walker onto the cliff',()=>{
  const world=createValleyWorld(),cliff=SOLIDS.find(s=>s.id==='cliff');
  assert.equal(world.floorAt(cliff.x,cliff.z),cliff.top);
  assert.equal(world.floorAt(cliff.x,cliff.z,cliff.bottom),heightAt(cliff.x,cliff.z));
  const before={x:cliff.x+cliff.halfX+1,y:heightAt(cliff.x+cliff.halfX+1,cliff.z),z:cliff.z};
  const player={...before,x:cliff.x+cliff.halfX,vx:-4,vz:0};world.resolve(player,before);
  assert.equal(player.x,cliff.x+cliff.halfX+.32);assert.equal(player.vx,0);assert.equal(player.y,before.y);
  const contact=world.climbContact(player,-1,0);
  assert.equal(contact.id,'cliff');assert.deepEqual(contact.normal,[1,0,0]);assert.equal(contact.top,cliff.top);
  assert.equal(world.climbContact(player,1,0),null);
});
test('climb and glide rewards rest on their physical surfaces and camps rest on terrain',()=>{
  const world=createValleyWorld();
  for(const id of ['cliff-seed','wind-chest','ruin-cape']){const secret=SECRETS.find(s=>s.id===id);assert.ok(Math.abs(world.floorAt(secret.x,secret.z)-secret.y)<.01,id);}
  for(const camp of CAMPS)assert.equal(camp.y,heightAt(camp.x,camp.z));
  assert.equal(trailDistance(0,2),0);
  assert.ok(HERO_TREES.length>150);
});
test('lake is connected to its deep basin and bounded by its actual shore',()=>{
  const world=createValleyWorld(),centre=world.waterAt(-160,-400);
  assert.equal(centre.height,-44);assert.ok(centre.depth>2);
  assert.equal(world.waterAt(0,2),null);
  assert.equal(world.waterAt(-220,-414),null);
  for(let x=LAKE.minX;x<=LAKE.maxX;x+=2){assert.equal(world.waterAt(x,LAKE.minZ),null);assert.equal(world.waterAt(x,LAKE.maxZ),null);}
  for(let z=LAKE.minZ;z<=LAKE.maxZ;z+=2){assert.equal(world.waterAt(LAKE.minX,z),null);assert.equal(world.waterAt(LAKE.maxX,z),null);}
});
test('the oak branch supports a glider launch and warm meadow provides lift only nearby',()=>{
  const world=createValleyWorld(),branch=SOLIDS.find(s=>s.id==='oak-branch');
  assert.equal(world.floorAt(29,-220),branch.top);assert.ok(branch.top-heightAt(29,-220)>17);
  assert.ok(world.updraftAt(10,-220)>0);assert.equal(world.updraftAt(0,2),0);
});

test('shared immutable footprints retain center faces but release chamfered rock corners',()=>{
  const world=createValleyWorld(),rock=SOLIDS.find(s=>s.id==='practice-ledge');
  const vertices=solidFootprint(rock);
  assert.equal(vertices,solidFootprint(rock));assert.equal(Object.isFrozen(vertices),true);
  assert.ok(vertices.every(Object.isFrozen));assert.equal(vertices.length,8);
  assert.equal(Math.max(...vertices.map(v=>v[0])),rock.x+rock.halfX);
  assert.equal(Math.min(...vertices.map(v=>v[1])),rock.z-rock.halfZ);
  const x=rock.x+rock.halfX-.05,z=rock.z-rock.halfZ+.05;
  assert.equal(world.floorAt(x,z),heightAt(x,z));
  const previous={x:x-.2,y:heightAt(x,z),z},player={...previous,x,vx:4,vz:0};
  world.resolve(player,previous);assert.equal(player.x,x);assert.equal(player.z,z);assert.equal(player.vx,4);
  assert.equal(solidFootprint(SOLIDS.find(s=>s.id==='oak-trunk')).length,8);
  for(const id of ['ruin-roof','oak-branch','bridge-log'])assert.equal(solidFootprint(SOLIDS.find(s=>s.id===id)).length,4);
});
test('diagonal climb contact follows the padded bevel and exposes its outward normal',()=>{
  const world=createValleyWorld(),rock=SOLIDS.find(s=>s.id==='practice-ledge'),vertices=solidFootprint(rock),a=vertices[1],b=vertices[2];
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=dz/length,nz=-dx/length,x=(a[0]+b[0])/2+nx*.32,z=(a[1]+b[1])/2+nz*.32;
  const player={x:x+nx*.2,z:z+nz*.2,y:heightAt(x,z)},contact=world.climbContact(player,-nx,-nz);
  assert.equal(contact.id,rock.id);assert.ok(Math.abs(contact.x-x)<1e-8);assert.ok(Math.abs(contact.z-z)<1e-8);
  assert.ok(Math.abs(contact.normal[0]-nx)<1e-8);assert.ok(Math.abs(contact.normal[2]-nz)<1e-8);
  assert.equal(world.climbContact(player,nx,nz),null);
  assert.equal(world.floorAt(contact.x-nx*.7,contact.z-nz*.7),rock.top);
});
test('swept bevel collision preserves tangential motion without changing feet height',()=>{
  const world=createValleyWorld(),rock=SOLIDS.find(s=>s.id==='practice-ledge'),v=solidFootprint(rock),a=v[1],b=v[2],nx=Math.SQRT1_2,nz=-Math.SQRT1_2;
  const cx=(a[0]+b[0])/2+nx*.32,cz=(a[1]+b[1])/2+nz*.32;
  const before={x:cx+nx*.5,z:cz+nz*.5,y:heightAt(cx,cz)},player={x:before.x-nx+.15,z:before.z-nz+.15,y:before.y,vx:-nx*4+1,vz:-nz*4+1};
  world.resolve(player,before);
  assert.ok(Math.abs(player.x-(cx+.15))<1e-8);assert.ok(Math.abs(player.z-(cz+.15))<1e-8);
  assert.ok(Math.abs(player.vx-1)<1e-8);assert.ok(Math.abs(player.vz-1)<1e-8);assert.equal(player.y,before.y);
});
test('swept resolution blocks crossing a complete solid and escapes an overlapping interior',()=>{
  const world=createValleyWorld(),rock=SOLIDS.find(s=>s.id==='practice-ledge');
  const before={x:rock.x-rock.halfX-2,z:rock.z,y:heightAt(rock.x,rock.z)},player={...before,x:rock.x+rock.halfX+2,vx:40,vz:0};
  world.resolve(player,before);assert.ok(Math.abs(player.x-(rock.x-rock.halfX-.32))<1e-8);assert.equal(player.vx,0);assert.equal(player.y,before.y);
  const inside={x:-103,z:-315,y:heightAt(-103,-315),vx:1,vz:-1},previous={...inside};
  world.resolve(inside,previous);
  assert.equal(inside.y,previous.y);
  for(const s of SOLIDS){if(inside.y>=s.top-.04 || inside.y+1.45<s.bottom)continue;const v=solidFootprint(s);assert.ok(v.some((a,i)=>{const b=v[(i+1)%v.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);return (inside.x-a[0])*dz/length-(inside.z-a[1])*dx/length>=.32-1e-8;}),s.id);}
});

test('real movement climbs and mantles a diagonal rock face with the same base stamina and support rules',()=>{
  const world=createValleyWorld(),rock=SOLIDS.find(s=>s.id==='practice-ledge'),v=solidFootprint(rock),a=v[1],b=v[2],nx=Math.SQRT1_2,nz=-Math.SQRT1_2;
  const x=(a[0]+b[0])/2+nx*.5,z=(a[1]+b[1])/2+nz*.5,simulation=createFeelSimulation({world,posts:[],bounds:null,target:()=>null});
  simulation.reset({x,z});simulation.step(1/120,{moveX:-nx,moveZ:-nz});
  assert.equal(simulation.state.player.mode,'climb');
  assert.ok(Math.abs(simulation.state.player.normal[0]-nx)<1e-8);assert.ok(Math.abs(simulation.state.player.normal[2]-nz)<1e-8);
  for(let frame=0;frame<600&&!simulation.state.player.grounded;frame++)simulation.step(1/120,{moveX:-nx,moveZ:-nz});
  assert.equal(simulation.state.player.grounded,true);assert.equal(simulation.state.player.y,rock.top);
  assert.equal(world.floorAt(simulation.state.player.x,simulation.state.player.z),rock.top);assert.ok(simulation.state.player.stamina>80);
});
