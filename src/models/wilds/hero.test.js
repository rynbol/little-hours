import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial, NumberKeyframeTrack, Scene, Vector3 } from 'three';
import { createHero, HERO_CLIPS } from './hero.js';
import { heightAt } from '../../core/world-terrain.js';

function fixture(options = {}) {
  const scene = new Group(), bone = new Bone(); bone.name = 'Body'; scene.add(bone);
  for (const name of ['Hair_bun', 'Hair_bob', 'Outfit_cardigan', 'Outfit_hoodie', 'Bottom_trousers', 'Bottom_skirt', 'Accessory_glasses', 'Accessory_blossom', 'Blade']) {
    const material = new MeshStandardMaterial({ color: '#ffffff' }); material.name = name.startsWith('Hair') ? 'Hair' : name === 'Blade' ? 'BladeSteel' : 'Top';
    const mesh = new Mesh(new BoxGeometry(.1, .1, .1), material); mesh.name = name; scene.add(mesh);
  }
  const base = new Bone(), tip = new Bone(); base.name = 'BladeBase'; tip.name = 'BladeTip'; tip.position.set(0, .8, -1.2); scene.add(base, tip);
  const gltf = { scene, animations: HERO_CLIPS.map((name, index) => new AnimationClip(name, name === 'knockedOut' ? 1.6 : name === 'charge' ? .38 : 1, [new NumberKeyframeTrack('Body.rotation[x]', [0, 1], [index, index + 1])])) };
  const actor = createHero(new Scene(), gltf, options), encounter = { status: 'dormant', impacts: [], respawn: { serial: 0 }, victory: 0 };
  const sim = { player: { x: 0, y: heightAt(0, 2), z: 2, heading: 0, vx: 0, vy: 0, vz: 0, grounded: true, mode: 'ground' }, action: { kind: 'idle', elapsed: 0, serial: 1 } };
  return { actor, encounter, sim };
}
test('hero exact action clocks, serial reset, transition and hit-stop sampling', () => {
  const f = fixture(); Object.assign(f.sim.action, { kind: 'light1', elapsed: .18 });
  f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'light1'); assert.equal(f.actor.diagnostics().time, .18);
  f.sim.action.elapsed = .3; const before = f.actor.diagnostics(); f.actor.update(f.encounter, f.sim, 0); assert.deepEqual(f.actor.diagnostics(), before);
  Object.assign(f.sim.action, { elapsed: 0, serial: 2 }); f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().time, 0);
  Object.assign(f.sim.action, { kind: 'charge', elapsed: 1.5 }); f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().time, .38);
});
test('hero avatar variants, source palette and blade endpoints follow selected root pose', () => {
  const f = fixture({ appearance: { style: 'bob', outfit: 'hoodie', bottomStyle: 'skirt', accessory: 'glasses', hair: 'raven' } }); f.actor.update(f.encounter, f.sim, .05);
  const visible = f.actor.diagnostics().visible;
  for (const name of ['Hair_bob', 'Outfit_hoodie', 'Bottom_skirt', 'Accessory_glasses']) assert.ok(visible.includes(name));
  for (const name of ['Hair_bun', 'Outfit_cardigan', 'Bottom_trousers', 'Accessory_blossom']) assert.ok(!visible.includes(name));
  const base = new Vector3(), tip = new Vector3(); assert.equal(f.actor.bladeEndpoints(base, tip), true); assert.ok(tip.distanceTo(base) > 1);
  f.sim.player.x = 5; f.actor.update(f.encounter, f.sim, .05); const moved = new Vector3(); f.actor.bladeEndpoints(base, moved); assert.ok(Math.abs(moved.x - tip.x - 5) < 1e-8);
  const merchant = fixture({ blade: false }); assert.equal(merchant.actor.bladeEndpoints(base, tip), false); assert.ok(!merchant.actor.diagnostics().visible.includes('Blade'));
});
test('hero traversal gaits, physical flat support and honest recovery lifecycle', () => {
  const f = fixture(); f.sim.player.vz = -1.2; f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'walk'); assert.equal(f.actor.diagnostics().time, .05);
  f.sim.player.vz = 0; f.sim.player.vx = 4; f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'strafeRight');
  f.sim.player.y += 5; f.sim.player.vx = 0; f.actor.update(f.encounter, f.sim, .05); assert.ok(new Vector3(0, 1, 0).applyQuaternion(f.actor.root.quaternion).distanceTo(new Vector3(0, 1, 0)) < 1e-8);
  f.encounter.status = 'recovering'; for (let i = 0; i < 35; i++) f.actor.update(f.encounter, f.sim, .05);
  assert.equal(f.actor.diagnostics().clip, 'knockedOut'); assert.equal(f.actor.diagnostics().time, 1.6);
  f.encounter.status = 'dormant'; f.encounter.respawn.serial++; f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'getup');
  for (let i = 0; i < 16; i++) f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'idle');
});

test('stationary flurry parry never replaces the real dodge and zero dt freezes its clock', () => {
  const f = fixture(); f.encounter.counts = { perfectDodges: 1 }; f.encounter.flurry = 1.2; Object.assign(f.sim.action, { kind: 'dodge', elapsed: .3 });
  f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'dodge');
  f.sim.action.kind = 'idle'; f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'parry');
  const before = f.actor.diagnostics(); f.actor.update(f.encounter, f.sim, 0); assert.deepEqual(f.actor.diagnostics(), before);
  f.sim.player.vz = -4; f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'run');
});

test('exported hero preserves wardrobe variants, weighted skin and actual blade contact paths', async () => {
  const { readFileSync } = await import('node:fs'), { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'), { AnimationMixer, Box3 } = await import('three'), { ATTACKS } = await import('../../core/wilds/feel.js');
  const bytes = readFileSync(new URL('../../../public/wilds/hero.glb', import.meta.url));
  const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));
  const clips = new Map(gltf.animations.map(clip => [clip.name, clip])), bones = new Map(), meshes = [];
  for (const name of HERO_CLIPS) assert.ok(clips.has(name), `hero clip ${name}`);
  for (const [name, expected] of Object.entries({ ...Object.fromEntries(Object.entries(ATTACKS).map(([name, row]) => [name, row.duration])), dodge: .42, charge: .38, parry: .45, knockedOut: 1.6, getup: .7, victory: 1.6 })) assert.ok(Math.abs(clips.get(name).duration - expected) < .021, `${name} timing ${clips.get(name).duration}`);
  gltf.scene.traverse(object => { if (object.isBone) bones.set(object.name, object); if (object.isSkinnedMesh) meshes.push(object); });
  for (const name of ['Root', 'Hips', 'Spine', 'Chest', 'Neck', 'Head', 'HandL', 'HandR', 'BladeBase', 'BladeTip', 'CapeUpper', 'CapeLower', 'HairBack']) assert.ok(bones.has(name), `hero bone ${name}`);
  for (const [prefix, choices] of Object.entries({ Hair: ['bun', 'bob', 'waves', 'crop'], Outfit: ['cardigan', 'hoodie', 'overalls', 'sailor'], Bottom: ['trousers', 'skirt', 'shorts'], Accessory: ['glasses', 'blossom', 'moon-clips'] })) for (const choice of choices) assert.ok(meshes.some(mesh => mesh.name === `${prefix}_${choice}` || mesh.name.startsWith(`${prefix}_${choice}_`)), `${prefix} ${choice}`);
  for (const mesh of meshes) {
    const weight = mesh.geometry.getAttribute('skinWeight'); assert.equal(weight.itemSize, 4);
    for (let i = 0; i < weight.count; i++) { let sum = 0; for (let j = 0; j < 4; j++) { const value = weight.array[i * 4 + j]; assert.ok(value >= 0 && value <= 1); sum += value; } assert.ok(Math.abs(sum - 1) < 1e-5); }
  }
  const actor = createHero(new Scene(), gltf), sim = { player: { x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 0, grounded: true, mode: 'ground' }, action: { kind: 'idle', elapsed: 0, serial: 1 } }, encounter = { status: 'dormant', impacts: [], victory: 0 };
  actor.update(encounter, sim, .05); const bounds = new Box3(); actor.root.traverse(mesh => { if (mesh.isSkinnedMesh && mesh.visible) { mesh.computeBoundingBox(); bounds.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld)); } });
  assert.ok(bounds.max.y > 1.42 && bounds.max.y < 1.7, `hero height ${bounds.max.y}`); assert.ok(bounds.min.y > -.04, `hero sole ${bounds.min.y}`);
  const point = new Vector3(), base = new Vector3(), tip = new Vector3();
  for (const [name, row] of Object.entries(ATTACKS)) {
    assert.ok(row.blade?.length === 9, `${name} physical table`);
    for (let i = 0; i < 9; i++) {
      sim.action = { kind: name, serial: i + 2, elapsed: row.hitStart + (row.hitEnd - row.hitStart) * i / 8 };
      for (let frame = 0; frame < 4; frame++) actor.update(encounter, sim, .05);
      assert.ok(actor.bladeEndpoints(base, tip)); const expected = row.blade[i];
      assert.ok(Math.hypot(base.x - expected[0], base.z - expected[1]) < .06, `${name} base sample ${i}`);
      assert.ok(Math.hypot(tip.x - expected[2], tip.z - expected[3]) < .06, `${name} tip sample ${i}`);
      let visibleTip = Infinity;
      for (const mesh of meshes) {
        if (!mesh.name.startsWith('Blade')) continue;
        mesh.skeleton.update(); const index = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight');
        for (let vertex = 0; vertex < index.count; vertex++) {
          let tipWeight = 0; for (let slot = 0; slot < 4; slot++) if (mesh.skeleton.bones[index.array[vertex * 4 + slot]]?.name === 'BladeTip') tipWeight += weight.array[vertex * 4 + slot];
          if (tipWeight < .5) continue;
          mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld); visibleTip = Math.min(visibleTip, point.distanceTo(tip));
        }
      }
      assert.ok(visibleTip < .06, `${name}: trail endpoint meets visible steel ${visibleTip}`); assert.ok(tip.y > .3 && tip.y < 1.5, `${name}: contact height ${tip.y}`);
    }
  }
  let lowestRoll = Infinity, bladeLength = null;
  for (let sample = 0; sample <= 48; sample++) {
    sim.action = { kind: 'dodge', serial: 200, elapsed: clips.get('dodge').duration * sample / 48 };
    for (let frame = 0; frame < 4; frame++) actor.update(encounter, sim, .05);
    assert.ok(actor.bladeEndpoints(base, tip));
    if (bladeLength === null) bladeLength = base.distanceTo(tip);
    assert.ok(Math.abs(base.distanceTo(tip) - bladeLength) < .004, `dodge keeps blade rigid at sample ${sample}`);
    for (const mesh of meshes) {
      if (!mesh.visible) continue; mesh.skeleton.update();
      for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) { mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld); lowestRoll = Math.min(lowestRoll, point.y); assert.ok(point.y >= -.035, `full dodge sample ${sample}: ${mesh.name} penetrates ground ${point.y}`); }
    }
  }
  assert.ok(lowestRoll < .12, `dodge stays grounded ${lowestRoll}`);
  actor.dispose();
});

test('hero waits for the companion approach before the baked cuddle', () => {
  const adventure = { state: { petting: 2.5, lastEvent: { serial: 1 } }, save: { gear: [], found: [] } }, f = fixture({ adventure });
  f.encounter.pet = { petting: false }; f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'idle');
  f.encounter.pet.petting = true; f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'pet');
  f.sim.player.vz = -4; f.actor.update(f.encounter, f.sim, .05); assert.equal(f.actor.diagnostics().clip, 'run');
});

test('encounter reset clears flinch serial tracking for another same-visit fight', () => {
  const f = fixture(); f.encounter.elapsed = 10; f.encounter.impacts = [{ kind: 'playerHit', serial: 8 }]; f.actor.update(f.encounter, f.sim, .05); f.actor.update(f.encounter, f.sim, .05); assert.ok(f.actor.diagnostics().weights.hit > 0);
  f.encounter.elapsed = 0; f.encounter.impacts = []; f.actor.update(f.encounter, f.sim, .05); assert.ok(!f.actor.diagnostics().weights.hit);
  f.encounter.impacts = [{ kind: 'playerHit', serial: 1 }]; f.actor.update(f.encounter, f.sim, .05); f.actor.update(f.encounter, f.sim, .05); assert.ok(f.actor.diagnostics().weights.hit > 0);
});

test('real simulation contact frame samples its new strike pose before subsequent hit-stop frames freeze', async () => {
  const { createFeelSimulation } = await import('../../core/wilds/feel.js'), simulation = createFeelSimulation(), f = fixture();
  Object.assign(simulation.state.player, { x: 0, z: -3.45, y: heightAt(0, -3.45), heading: 0 });
  function tick(input = {}) { simulation.step(1 / 120, input); f.actor.update(f.encounter, simulation.state, simulation.state.hitStopped ? 0 : 1 / 120); }
  tick({ attackPressed: true, attackHeld: true }); tick({ attackReleased: true });
  let contact = false;
  for (let i = 0; i < 65; i++) { tick(); if (simulation.state.hitStop > 0 && !simulation.state.hitStopped) { contact = true; break; } }
  assert.ok(contact, 'real sword contact begins hit-stop'); assert.equal(f.actor.diagnostics().time, simulation.state.action.elapsed);
  const before = f.actor.diagnostics(); tick(); assert.equal(simulation.state.hitStopped, true); assert.deepEqual(f.actor.diagnostics(), before);
});

test('charge damage overlays baked knockback, other threats overlay hit without teleporting root', () => {
  const f = fixture(); f.actor.update(f.encounter, f.sim, .05); const position = f.actor.root.position.clone();
  f.encounter.impacts = [{ kind: 'playerHit', serial: 1, attack: 'charge' }]; f.actor.update(f.encounter, f.sim, .05); f.actor.update(f.encounter, f.sim, .05);
  assert.ok(f.actor.diagnostics().weights.knockback > 0); assert.ok(!f.actor.diagnostics().weights.hit); assert.ok(f.actor.root.position.equals(position));
  const before = f.actor.diagnostics(); f.actor.update(f.encounter, f.sim, 0); assert.deepEqual(f.actor.diagnostics(), before);
  f.encounter.impacts = [{ kind: 'playerHit', serial: 2, attack: 'sweep' }]; f.actor.update(f.encounter, f.sim, .05); f.actor.update(f.encounter, f.sim, .05);
  assert.ok(f.actor.diagnostics().weights.hit > 0); assert.ok(!f.actor.diagnostics().weights.knockback);
});

test('deliberate sword input cancels victory and getup gestures without resuming them afterward',()=>{
  for(const lifecycle of ['victory','getup']){
    const f=fixture();if(lifecycle==='victory')f.encounter.victory=1;else f.encounter.respawn.serial=1;
    f.actor.update(f.encounter,f.sim,.05);assert.equal(f.actor.diagnostics().clip,lifecycle);
    Object.assign(f.sim.action,{kind:'charge',elapsed:.1,serial:2});f.actor.update(f.encounter,f.sim,.05);assert.equal(f.actor.diagnostics().clip,'charge');
    Object.assign(f.sim.action,{kind:'light1',elapsed:.16,serial:3});f.actor.update(f.encounter,f.sim,.05);assert.equal(f.actor.diagnostics().clip,'light1');
    Object.assign(f.sim.action,{kind:'idle',elapsed:0,serial:4});f.actor.update(f.encounter,f.sim,.05);assert.equal(f.actor.diagnostics().clip,'idle');
  }
});

test('actual swimming hero keeps its head above the lake and torso at the surface without changing logical height',async()=>{
  const {readFileSync}=await import('node:fs'),{GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
  const bytes=readFileSync(new URL('../../../public/wilds/hero.glb',import.meta.url));
  const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));
  let floor=-4;const actor=createHero(new Scene(),gltf,{world:{floorAt:()=>floor}}),sim={player:{x:0,y:-.45,z:0,heading:0,vx:0,vz:-2.2,vy:0,grounded:false,mode:'swim'},action:{kind:'swim',elapsed:0,serial:1}},encounter={status:'dormant',impacts:[],victory:0},bones=new Map(),point=new Vector3();
  gltf.scene.traverse(object=>{if(object.isBone)bones.set(object.name,object);});const before=structuredClone(sim);
  const headVertices=[];gltf.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh || mesh.material.name!=='Skin')return;const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;for(let i=0;i<indices.count;i++){let head=0;for(let j=0;j<4;j++)if(mesh.skeleton.bones[indices.array[i*4+j]]?.name==='Head')head+=weights.array[i*4+j];if(head>.9)headVertices.push([mesh,i]);}});assert.ok(headVertices.length>20);
  let minHead=Infinity,maxHead=-Infinity;const phases=new Set();
  for(let frame=0;frame<40;frame++){
    actor.update(encounter,sim,.05);phases.add(actor.diagnostics().time.toFixed(2));bones.get('Head').getWorldPosition(point);
    assert.ok(point.y>=.05 && point.y<=.30,`head above water ${point.y}`);
    bones.get('Chest').getWorldPosition(point);assert.ok(Math.abs(point.y)<.08,`torso at surface ${point.y}`);
    for(const [mesh,vertex] of headVertices){mesh.skeleton.update();mesh.getVertexPosition(vertex,point).applyMatrix4(mesh.matrixWorld);minHead=Math.min(minHead,point.y);maxHead=Math.max(maxHead,point.y);assert.ok(point.y>=.05 && point.y<=.30,`visible head clearance ${point.y}`);}
    bones.get('Hips').getWorldPosition(point);assert.ok(point.y>-.2 && point.y<-.08,`hips submerged ${point.y}`);
  }
  assert.ok(maxHead-minHead>.15,'the test covers the visible head height');assert.ok(phases.size>=19,'the test covers the authored paddling cycle');assert.deepEqual(sim,before);assert.equal(actor.root.position.y,-.7);assert.ok(maxHead+.25>.30,'the original placement exposes the head above its intended envelope');
  floor=-.56;
  for(let frame=0;frame<20;frame++){actor.update(encounter,sim,.05);gltf.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh || !mesh.visible)return;mesh.skeleton.update();for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){mesh.getVertexPosition(vertex,point).applyMatrix4(mesh.matrixWorld);assert.ok(point.y>=floor,`shallow swim clears lakebed ${point.y}`);}});}
  assert.deepEqual(sim,before);actor.dispose();
});
