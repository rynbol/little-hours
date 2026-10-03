import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationClip, Bone, Box3, BoxGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, NumberKeyframeTrack, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { heightAt, normalAt } from '../../core/world-terrain.js';
import { BOSS_ATTACKS, createEncounter } from '../../core/wilds/encounter.js';
import { createMossheart, MOSSHEART_CLIPS } from './mossheart.js';

const durations = { idle: 2, walk: 1, trot: .6, ...Object.fromEntries(Object.entries(BOSS_ATTACKS).map(([name, row]) => [name, row.duration])), hit: .35, stunned: 2.8, phase: 1.7, defeat: 3 };
function fixture() {
  const scene = new Scene(), asset = new Group(), geometry = new BoxGeometry(.4, 1, .4), material = new MeshStandardMaterial({ color: '#766c50', roughness: .85, emissive: '#120800' });
  material.name = 'Heartwood';
  let sourceDisposed = 0; material.addEventListener('dispose', () => sourceDisposed++);
  const head = new Bone(); head.name = 'MossHead';
  const mesh = new SkinnedMesh(geometry, material); mesh.add(head); asset.add(mesh);
  const count = geometry.attributes.position.count, weights = new Float32Array(count * 4), indices = new Uint16Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4)); geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
  mesh.bind(new Skeleton([head]));
  const gltf = { scene: asset, animations: MOSSHEART_CLIPS.map((name, index) => new AnimationClip(name, durations[name], [new NumberKeyframeTrack('MossHead.rotation[x]', [0, durations[name]], [index, index + 1])])) };
  const encounter = createEncounter().state, actor = createMossheart(scene, gltf), sim = { elapsed: 0 };
  return { scene, actor, encounter, sim, head, mesh, material, gltf, get sourceDisposed() { return sourceDisposed; } };
}
const sample = (f, seconds = .2, dt = 1 / 60) => { for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += dt) f.actor.update(f.encounter, f.sim, dt, false); };
const setAction = (f, kind, elapsed, serial = 12) => Object.assign(f.encounter.boss.action, { kind, elapsed, duration: durations[kind], serial });

test('stag combat samples baked clips at domain time, resets serials and blends without advancing the action clock', () => {
  const f = fixture(); setAction(f, 'sweep', .95); sample(f);
  const diagnostics = f.actor.diagnostics();
  assert.equal(diagnostics.clip, 'sweep'); assert.equal(diagnostics.time, .95); assert.equal(diagnostics.serial, 12);
  assert.ok(Math.abs(f.head.rotation.x - (4 + .95 / durations.sweep)) < 1e-6);
  setAction(f, 'sweep', 0, 13); f.actor.update(f.encounter, f.sim, 1 / 60, false);
  assert.equal(f.actor.diagnostics().time, 0); assert.equal(f.actor.diagnostics().serial, 13);
  setAction(f, 'stunned', .3, 14); f.actor.update(f.encounter, f.sim, 1 / 60, false);
  const weights = f.actor.diagnostics().weights;
  assert.ok(weights.sweep > 0 && weights.stunned > 0); assert.ok(Math.abs(weights.sweep + weights.stunned - 1) < 1e-8);
  sample(f); assert.equal(f.actor.diagnostics().weights.stunned, 1); assert.equal(f.actor.diagnostics().weights.sweep, 0);
  assert.equal(f.actor.root.position.x, f.encounter.boss.x); assert.equal(f.actor.root.position.y, f.encounter.boss.y);
});

test('zero-delta hit-stop freezes baked time, locomotion and transition weights', () => {
  const f = fixture(); setAction(f, 'charge', 1.2); f.actor.update(f.encounter, f.sim, .02, false);
  const before = f.actor.diagnostics(), pose = f.head.rotation.x;
  for (let frame = 0; frame < 10; frame++) f.actor.update(f.encounter, f.sim, 0, false);
  assert.equal(f.actor.diagnostics().time, before.time); assert.deepEqual(f.actor.diagnostics().weights, before.weights); assert.equal(f.head.rotation.x, pose);
});

test('actual ground displacement chooses gait and scales baked stride to speed', () => {
  const f = fixture(); f.actor.update(f.encounter, f.sim, .02, false);
  f.encounter.boss.x += 1.4 * .05; f.actor.update(f.encounter, f.sim, .05, false);
  assert.equal(f.actor.diagnostics().clip, 'walk'); assert.ok(Math.abs(f.actor.diagnostics().speed - 1.4) < 1e-8);
  assert.ok(Math.abs(f.actor.diagnostics().time - .09) < 1e-8);
  f.encounter.boss.x += 5.5 * .05; f.actor.update(f.encounter, f.sim, .05, false);
  assert.equal(f.actor.diagnostics().clip, 'trot');
  assert.ok(Math.abs(f.actor.diagnostics().time - (.09 + .05 * 5.5 / 2.4)) < 1e-8);
  f.encounter.boss.heading = .9; f.actor.update(f.encounter, f.sim, 0, false);
  const normal = new Vector3(...normalAt(f.encounter.boss.x, f.encounter.boss.z)), localUp = new Vector3(0, 1, 0).applyQuaternion(f.actor.root.quaternion);
  assert.ok(localUp.distanceTo(normal) < 1e-8);
});

test('flinch overlays idle or recovery but never overrides threat telegraphs, and reduced motion suppresses it', () => {
  const f = fixture(); sample(f);
  f.encounter.impacts = [{ kind: 'bossHit', serial: 1 }]; f.actor.update(f.encounter, f.sim, .02, false); f.actor.update(f.encounter, f.sim, .05, false);
  assert.ok(f.actor.diagnostics().weights.hit > 0);
  setAction(f, 'sweep', .4); f.encounter.impacts.push({ kind: 'bossHit', serial: 2 }); sample(f);
  assert.equal(f.actor.diagnostics().weights.hit, 0);
  setAction(f, 'sweep', 1.5); f.encounter.impacts.push({ kind: 'petAttack', serial: 3 }); f.actor.update(f.encounter, f.sim, .02, false); f.actor.update(f.encounter, f.sim, .05, false);
  assert.ok(f.actor.diagnostics().weights.hit > 0);
  f.actor.update(f.encounter, f.sim, .05, true); assert.equal(f.actor.diagnostics().weights.hit, 0);
});

test('paint preserves exported colors and shading, compiles dissolve before defeat and leaves disposal resources attached', () => {
  const f = fixture(), painted = f.mesh.material; let paintedDisposed = 0;
  assert.equal(f.sourceDisposed, 1); assert.notEqual(painted, f.material); assert.equal(painted.color.getHex(), f.material.color.getHex()); assert.equal(painted.roughness, .85); assert.equal(painted.emissive.getHex(), f.material.emissive.getHex());
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <opaque_fragment>' };
  painted.onBeforeCompile(shader); assert.equal(shader.uniforms.wildsStagDissolve.value, 0); assert.ok(shader.fragmentShader.includes('wildsStagDissolve) discard')); assert.ok(painted.customProgramCacheKey().includes('bark')); assert.ok(shader.fragmentShader.includes('vWildsSurface'));
  setAction(f, 'defeat', 2.25); sample(f); assert.equal(f.actor.root.visible, true); assert.equal(shader.uniforms.wildsStagDissolve.value, .5);
  setAction(f, 'defeat', 3); f.actor.update(f.encounter, f.sim, .02, false); assert.equal(f.actor.root.visible, false); assert.equal(f.actor.diagnostics().clip, 'defeat');
  painted.addEventListener('dispose', () => paintedDisposed++); f.actor.dispose(); f.actor.dispose();
  assert.equal(f.actor.root.parent, f.scene); assert.equal(paintedDisposed, 0); assert.equal(f.actor.diagnostics().playing, false); assert.equal(f.actor.diagnostics().disposed, true);
});


test('the whole stag root follows the arena support normal and keeps planar hooves close to real terrain', () => {
  const f = fixture(), boss = f.encounter.boss;
  Object.assign(boss, { x: -5.8, z: -19.3, y: heightAt(-5.8, -19.3), heading: 1.2 });
  f.actor.update(f.encounter, f.sim, .02, false);
  const up = new Vector3(0, 1, 0).applyQuaternion(f.actor.root.quaternion), normal = new Vector3(...normalAt(boss.x, boss.z));
  assert.ok(up.distanceTo(normal) < 1e-8);
  for (const [x, z] of [[-.43,-.58],[.43,-.58],[-.43,.8],[.43,.8]]) {
    const foot = new Vector3(x, 0, z).applyMatrix4(f.actor.root.matrixWorld);
    assert.ok(Math.abs(foot.y - heightAt(foot.x, foot.z)) < .06);
  }
});

const assetPath = new URL('../../../public/wilds/mossheart.glb', import.meta.url);
test('exported stag has all exact combat clocks, bounded skin weights and sane animated sweep contacts', async () => {
  const data = readFileSync(assetPath), gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '', resolve, reject));
  const clips = new Map(gltf.animations.map(clip => [clip.name, clip]));
  for (const name of MOSSHEART_CLIPS) assert.ok(clips.has(name), name);
  for (const [name, row] of Object.entries(BOSS_ATTACKS)) assert.ok(Math.abs(clips.get(name).duration - row.duration) < .02, name);
  let skinned = 0, amber = null;
  gltf.scene.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { if (material.name === 'AmberHeart') amber = material; assert.equal(material.map, null, 'textureless exported material'); }
    skinned++; const weights = mesh.geometry.getAttribute('skinWeight'), indices = mesh.geometry.getAttribute('skinIndex');
    assert.ok(weights.itemSize <= 4); assert.equal(weights.count, mesh.geometry.attributes.position.count);
    for (let vertex = 0; vertex < weights.count; vertex++) {
      let sum = 0;
      for (let lane = 0; lane < weights.itemSize; lane++) { const weight = weights.array[vertex * weights.itemSize + lane]; assert.ok(Number.isFinite(weight) && weight >= 0); sum += weight; assert.ok(indices.array[vertex * indices.itemSize + lane] < mesh.skeleton.bones.length); }
      assert.ok(Math.abs(sum - 1) < .001);
    }
  });
  assert.ok(skinned > 0); assert.ok(amber, 'exported AmberHeart material');
  assert.ok(amber.emissive.r > amber.emissive.g * 1.1 && amber.emissive.g > amber.emissive.b * 1.2, `warm amber emission ${amber.emissive.toArray()}`);
  const scene = new Scene(), actor = createMossheart(scene, gltf), encounter = createEncounter().state;
  Object.assign(encounter.boss, { x: 0, y: 0, z: 0, heading: 0 });
  Object.assign(encounter.boss.action, { kind: 'idle', elapsed: 0, duration: 2, serial: 1 }); actor.update(encounter, {}, .05, false);
  const bounds = new Box3().setFromObject(actor.root, true), size = bounds.getSize(new Vector3());
  assert.ok(size.y > 4 && size.y < 5.5, `height ${size.y}`); assert.ok(size.x < 5 && size.z < 5); assert.ok(bounds.min.y > -.3);
  const hooves = [], footVertex = new Vector3();
  actor.root.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
      mesh.getVertexPosition(index, footVertex).applyMatrix4(mesh.matrixWorld);
      if (footVertex.y >= -.03 && footVertex.y < .1) hooves.push({ mesh, index });
    }
  });
  assert.ok(hooves.length > 4, 'visible hoof geometry starts at the ground origin');
  Object.assign(encounter.boss, { x: -5.8, y: heightAt(-5.8, -19.3), z: -19.3, heading: 1.2 }); actor.update(encounter, {}, 0, false);
  for (const { mesh, index } of hooves) {
    mesh.getVertexPosition(index, footVertex).applyMatrix4(mesh.matrixWorld);
    assert.ok(Math.abs(footVertex.y - heightAt(footVertex.x, footVertex.z)) < .16, 'actual skinned hooves follow the arena plane');
  }
  Object.assign(encounter.boss, { x: 0, y: 0, z: 0, heading: 0 });
  const antlers = [];
  actor.root.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const joints = new Set(mesh.skeleton.bones.map((bone, index) => /antler/i.test(bone.name) ? index : -1).filter(index => index >= 0));
    const indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight'), vertices = [];
    for (let index = 0; index < indices.count; index++) {
      let antlerWeight = 0;
      for (let lane = 0; lane < indices.itemSize; lane++) if (joints.has(indices.array[index * indices.itemSize + lane])) antlerWeight += weights.array[index * weights.itemSize + lane];
      if (antlerWeight > .5) vertices.push(index);
    }
    if (vertices.length) antlers.push({ mesh, vertices });
  });
  assert.ok(antlers.length > 0, 'visible antler vertices have identifiable deform weights');
  const bearings = [], vertex = new Vector3(), row = BOSS_ATTACKS.sweep;
  for (const fraction of [0, .25, .5, .75, 1]) {
    Object.assign(encounter.boss.action, { kind: 'sweep', elapsed: row.telegraph + row.active * fraction, duration: row.duration, serial: 2 });
    for (let frame = 0; frame < 10; frame++) actor.update(encounter, {}, .02, false);
    const contacts = [], animatedBounds = new Box3().setFromObject(actor.root, true);
    assert.ok(animatedBounds.max.y < 6 && animatedBounds.min.y > -.3, `sweep bounds at ${fraction}`);
    for (const { mesh, vertices } of antlers) for (const index of vertices) {
      mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld);
      assert.ok(vertex.y >= -.06, `antler beneath ground at ${fraction}: ${vertex.y}`);
      const reach = Math.hypot(vertex.x, vertex.z);
      if (vertex.y >= .2 && vertex.y <= 1.55 && reach >= 3.2 && reach <= 4.3) contacts.push(vertex.clone());
    }
    assert.ok(contacts.length > 0, `visible sweep contact at ${fraction}`);
    const centroid = contacts.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(1 / contacts.length);
    const bearing = Math.atan2(centroid.x, -centroid.z);
    bearings.push(bearing);
  }
  const arc = Math.atan2(Math.sin(bearings.at(-1) - bearings[0]), Math.cos(bearings.at(-1) - bearings[0]));
  assert.ok(Math.abs(Math.abs(arc) - row.arc) < .3, `visible sweep arc ${arc}`);
  const direction = Math.sign(arc);
  for (let index = 1; index < bearings.length; index++) assert.ok(direction * Math.atan2(Math.sin(bearings[index] - bearings[index - 1]), Math.cos(bearings[index] - bearings[index - 1])) > .25, `sweep direction at ${index}`);
  actor.dispose();
});


test('a same-visit camp reset restarts impact serials and restores guardian flinches', () => {
  const f = fixture(); setAction(f, 'idle', .1, 30); sample(f);
  f.encounter.impacts = [{kind:'bossHit',serial:80}]; f.actor.update(f.encounter,f.sim,.02); f.actor.update(f.encounter,f.sim,.05);
  assert.ok(f.actor.diagnostics().weights.hit>0);
  setAction(f,'idle',0,1); f.encounter.impacts=[]; sample(f,.6);
  f.encounter.impacts=[{kind:'bossHit',serial:1}]; f.actor.update(f.encounter,f.sim,.02); f.actor.update(f.encounter,f.sim,.05);
  assert.ok(f.actor.diagnostics().weights.hit>0);
});
