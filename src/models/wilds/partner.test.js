import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, Bone, Group, NumberKeyframeTrack, Scene } from 'three';
import { createPartner, PARTNER_CLIPS } from './partner.js';
import { heightAt } from '../../core/world-terrain.js';

function fixture(species = 'cat') {
  const scene = new Group(), bone = new Bone(); bone.name = 'Body'; scene.add(bone);
  const durations = { pounce: .8, swipe: .8, spin: .8, dash: .7, knockedOut: 1.2 };
  const gltf = { scene, animations: PARTNER_CLIPS.map((name, index) => new AnimationClip(name, durations[name] || 1, [new NumberKeyframeTrack('Body.rotation[x]', [0, 1], [index, index + 1])])) };
  const pet = { x: 0, z: 2, y: heightAt(0, 2), ground: heightAt(0, 2), heading: 0, health: 100, action: { kind: 'follow', elapsed: 0, serial: 1 } };
  return { actor: createPartner(new Scene(), gltf, { species }), encounter: { pet, impacts: [], respawn: { serial: 0 } }, pet };
}
test('partner follows actual displacement, resets loop kind and freezes hit-stop phase', () => {
  const f = fixture('panda'); f.actor.update(f.encounter, {}, .05);
  f.pet.z -= .06; f.actor.update(f.encounter, {}, .05); assert.equal(f.actor.diagnostics().clip, 'walk'); assert.ok(Math.abs(f.actor.diagnostics().time - .05) < 1e-8);
  f.pet.z -= .15; f.actor.update(f.encounter, {}, .05); assert.equal(f.actor.diagnostics().clip, 'run'); assert.ok(Math.abs(f.actor.diagnostics().time - .05) < 1e-8);
  const before = f.actor.diagnostics(); f.actor.update(f.encounter, {}, 0); assert.deepEqual(f.actor.diagnostics(), before); assert.equal(before.species, 'panda');
  f.pet.swimming = true; f.pet.action.kind = 'swim'; f.actor.update(f.encounter, {}, .05); assert.equal(f.actor.diagnostics().clip, 'swim');
});
test('partner finite contact clocks, single baked pounce lift, collapse hold and camp recovery', () => {
  const f = fixture(); f.pet.action = { kind: 'pounce', elapsed: .3, serial: 2 }; f.pet.y = f.pet.ground + .65;
  f.actor.update(f.encounter, {}, .05); assert.equal(f.actor.diagnostics().time, .3); assert.equal(f.actor.root.position.y, f.pet.ground);
  f.pet.health = 0; f.pet.action = { kind: 'knockedOut', elapsed: 0, serial: 3 };
  for (let i = 0; i < 30; i++) f.actor.update(f.encounter, {}, .05);
  assert.equal(f.actor.diagnostics().clip, 'knockedOut'); assert.equal(f.actor.diagnostics().time, 1.2);
  f.pet.health = 100; f.pet.action.kind = 'idle'; f.encounter.respawn.serial++; f.actor.update(f.encounter, {}, .05);
  assert.equal(f.actor.diagnostics().clip, 'idle'); assert.equal(f.actor.diagnostics().knockedOut, false);
});

test('all exported companions have bounded skinning, exact finite action clocks and visible paw contacts', async () => {
  const { readFileSync } = await import('node:fs'), { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'), { AnimationMixer, Box3, Vector3 } = await import('three');
  for (const species of ['cat', 'dog', 'bunny', 'fox', 'panda', 'wolf']) {
    const bytes = readFileSync(new URL(`../../../public/wilds/partner-${species}.glb`, import.meta.url));
    const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));
    const clips = new Map(gltf.animations.map(clip => [clip.name, clip]));
    for (const name of PARTNER_CLIPS) assert.ok(clips.has(name), `${species}: ${name}`);
    for (const [name, expected] of Object.entries({ pounce: .8, swipe: .8, spin: .8, dash: .7, knockedOut: 1.2 })) assert.ok(Math.abs(clips.get(name).duration - expected) <= .02, `${species}: ${name} timing`);
    const bones = new Map(), meshes = []; gltf.scene.traverse(object => { if (object.isBone) bones.set(object.name, object); if (object.isSkinnedMesh) meshes.push(object); });
    for (const name of ['root', 'pelvis', 'chest', 'neck', 'head', 'muzzle', 'tail-0', 'tail-1', 'tail-2', 'Front-L-paw', 'Front-R-paw']) assert.ok(bones.has(name), `${species}: ${name} bone`);
    assert.equal(meshes.length, 3); gltf.scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(gltf.scene), size = box.getSize(new Vector3()); assert.ok(size.y > .4 && size.y < 1.4, `${species}: dimensions ${size.y}`); assert.ok(box.min.y > -.04, `${species}: ground origin`);
    for (const mesh of meshes) {
      const weights = mesh.geometry.getAttribute('skinWeight'); assert.equal(weights.itemSize, 4);
      for (let i = 0; i < weights.count; i++) { let sum = 0; for (let j = 0; j < 4; j++) { const weight = weights.array[i * 4 + j]; assert.ok(weight >= 0 && weight <= 1); sum += weight; } assert.ok(Math.abs(sum - 1) < 1e-5); }
    }
    const mixer = new AnimationMixer(gltf.scene), point = new Vector3();
    function sample(name, time) { mixer.stopAllAction(); const action = mixer.clipAction(clips.get(name)); action.play(); action.time = time; mixer.update(0); gltf.scene.updateMatrixWorld(true); }
    for (const name of ['pounce', 'swipe', 'spin']) {
      sample(name, .3); let reach = 0, contacts = 0;
      for (const mesh of meshes) {
        mesh.skeleton.update(); const index = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight');
        for (let i = 0; i < index.count; i++) {
          let paw = 0; for (let j = 0; j < 4; j++) if (/^Front-.*-paw$/.test(mesh.skeleton.bones[index.array[i * 4 + j]]?.name || '')) paw += weight.array[i * 4 + j];
          if (paw < .5) continue;
          mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
          if (point.y >= -.03 && point.y < 1.3) { reach = Math.max(reach, Math.hypot(point.x, point.z)); contacts++; }
        }
      }
      assert.ok(contacts > 4 && reach > .35 && reach < 1.35, `${species}: ${name} visible contact ${reach}`);
    }
    let apex = 0; for (let t = 0; t <= .8; t += .02) { sample('pounce', t); bones.get('root').getWorldPosition(point); apex = Math.max(apex, point.y); }
    assert.ok(apex > .62 && apex < .68, `${species}: one baked pounce lift ${apex}`);
    sample('dash', .22); bones.get('muzzle').getWorldPosition(point); assert.ok(-point.z > .3 && point.y > .15 && point.y < 1.25, `${species}: dash muzzle contact`);
    mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
  }
});

test('a stopped exploration partner sits once, holds the pose and stands on movement or a fight', () => {
  const f = fixture();
  for (let frame = 0; frame < 65; frame++) f.actor.update(f.encounter, {}, .05);
  assert.equal(f.actor.diagnostics().clip, 'sit'); assert.equal(f.actor.diagnostics().time, 1);
  const before = f.actor.diagnostics(); f.actor.update(f.encounter, {}, 0); assert.deepEqual(f.actor.diagnostics(), before);
  f.pet.z -= .15; f.actor.update(f.encounter, {}, .05); assert.equal(f.actor.diagnostics().clip, 'run');
  for (let frame = 0; frame < 30; frame++) f.actor.update(f.encounter, {}, .05); assert.equal(f.actor.diagnostics().clip, 'sit');
  f.encounter.status = 'fighting'; f.actor.update(f.encounter, {}, .05); assert.equal(f.actor.diagnostics().clip, 'idle');
});
