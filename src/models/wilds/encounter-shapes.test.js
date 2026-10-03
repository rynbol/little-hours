import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Matrix4, Scene, Vector3 } from 'three';
import { createEncounterShapes } from './encounter-shapes.js';
import { ARENA, BOSS_ATTACKS, createEncounter, STONES } from '../../core/wilds/encounter.js';
import { createFeelSimulation } from '../../core/wilds/feel.js';
import { heightAt } from '../../core/world-terrain.js';

function fixture() {
  const scene = new Scene(), encounter = createEncounter(), sim = createFeelSimulation();
  const shapes = createEncounterShapes(scene);
  shapes.update(encounter.state, sim.state, 1 / 60, false);
  return { scene, encounter, sim, shapes };
}

test('blockout stag reaches three player heights, nine stones and camp remain grounded within a compact draw budget', () => {
  const { scene, shapes } = fixture();
  const bounds = new Box3().setFromObject(scene.getObjectByName('mossheart-blockout'));
  assert.ok(bounds.max.y - heightAt(ARENA.x, ARENA.z) >= 4.5);
  assert.ok(bounds.max.y - heightAt(ARENA.x, ARENA.z) < 4.9);
  const stones = scene.getObjectByName('standing-stone-ring'), matrix = new Matrix4(), position = new Vector3();
  assert.equal(stones.count, 9);
  STONES.forEach((stone, i) => {
    stones.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    assert.ok(Math.abs(position.y - stone.height / 2 - heightAt(stone.x, stone.z)) < .00001);
    assert.ok(Math.abs(Math.hypot(position.x - ARENA.x, position.z - ARENA.z) - ARENA.radius) < .00001);
  });
  assert.deepEqual(shapes.campPosition, [0, heightAt(0, 2), 2]);
  let draws = 0;
  scene.traverse(object => { if (object.isMesh) draws++; });
  assert.ok(draws < 40, `added draws ${draws}`);
});

test('each threat has grounded anticipation geometry and impact geometry reuses its buffers', () => {
  const { scene, shapes, encounter, sim } = fixture();
  const telegraph = scene.getObjectByName('attack-telegraph'), impact = scene.getObjectByName('attack-impact');
  const telegraphBuffer = telegraph.geometry.attributes.position.array, impactBuffer = impact.geometry.attributes.position.array;
  for (const kind of ['charge', 'sweep', 'stomp', 'roots']) {
    const row = BOSS_ATTACKS[kind];
    Object.assign(encounter.state.boss.action, { kind, elapsed: row.telegraph * .8, duration: row.duration, progress: .2 });
    shapes.update(encounter.state, sim.state, 1 / 60, false);
    assert.equal(telegraph.visible, true, kind);
    assert.ok(telegraph.geometry.drawRange.count > 0);
    for (let i = 0; i < telegraph.geometry.drawRange.count * 3; i += 3) {
      assert.ok(Math.abs(telegraphBuffer[i + 1] - heightAt(telegraphBuffer[i], telegraphBuffer[i + 2]) - .035) < .00001);
    }
    Object.assign(encounter.state.boss.action, { elapsed: row.telegraph + .1 });
    encounter.state.boss.ringRadius = 1; encounter.state.boss.rootLength = 1;
    shapes.update(encounter.state, sim.state, 1 / 60, true);
    assert.equal(telegraph.visible, false);
    if (kind !== 'charge') assert.equal(impact.visible, true, kind);
    assert.equal(telegraph.geometry.attributes.position.array, telegraphBuffer);
    assert.equal(impact.geometry.attributes.position.array, impactBuffer);
  }
});

test('stone stun exposes the heart and materials retain the actual compiled uniforms without accumulating shader graphs', () => {
  const { scene, shapes, encounter, sim } = fixture();
  const heart = scene.getObjectByName('exposed-heart');
  encounter.state.boss.action.kind = 'stunned';
  shapes.update(encounter.state, sim.state, 1 / 60, false);
  assert.equal(heart.scale.x, 1.7);
  assert.ok(heart.position.z < 0);
  const material = heart.material, first = { dfgLUT: { value: {} } }, second = { dfgLUT: { value: {} } };
  material.onBeforeCompile({ uniforms: first, fragmentShader: '#include <opaque_fragment>' });
  material.onBeforeCompile({ uniforms: second, fragmentShader: '#include <opaque_fragment>' });
  assert.equal(material.userData.wildsUniforms.length, 1);
  assert.equal(material.userData.wildsUniforms[0], second);
});

test('pet attacks keep one grounded root, expose distinct poses and allocate no replacement geometry', () => {
  const { scene, shapes, encounter, sim } = fixture();
  const pet = scene.getObjectByName('ginger-partner-blockout'), body = pet.children[0], geometries = new Set();
  scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); });
  const poses = new Set();
  for (const kind of ['idle', 'pounce', 'swipe', 'spin', 'dash', 'knockedOut']) {
    Object.assign(encounter.state.pet.action, { kind, elapsed: .25, duration: 1, progress: .25 });
    shapes.update(encounter.state, sim.state, 1 / 60, true);
    assert.equal(pet.position.y, heightAt(pet.position.x, pet.position.z));
    poses.add([body.position.y, body.rotation.x, body.rotation.y, body.rotation.z].join(','));
    scene.traverse(object => { if (object.geometry) assert.ok(geometries.has(object.geometry)); });
  }
  assert.equal(poses.size, 6);
});

test('restart anchor remains clear of the grounded camp hearth', () => {
  const { scene, shapes } = fixture(), hearth = scene.getObjectByName('camp-hearth');
  const bounds = new Box3().setFromObject(hearth), position = new Vector3();
  hearth.getWorldPosition(position);
  assert.deepEqual(shapes.campPosition, [0, heightAt(0, 2), 2]);
  assert.equal(position.x, -1.4);
  assert.equal(position.y, heightAt(-1.4, 2));
  assert.ok(bounds.max.x < -.28);
  assert.ok(bounds.min.y >= heightAt(-1.4, 2));
});

test('stag stance and phase roots remain planted on their local terrain samples', () => {
  const { scene, shapes, encounter, sim } = fixture(), matrix = new Matrix4(), position = new Vector3(), scale = new Vector3();
  const hooves = scene.getObjectByName('stag-hooves');
  for (let i = 0; i < 4; i++) {
    hooves.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    assert.ok(Math.abs(position.y - .1 - heightAt(position.x, position.z)) < .00001);
  }
  Object.assign(encounter.state.boss.action, { kind: 'phase', elapsed: .7, duration: 1.7, progress: .7 / 1.7 });
  shapes.update(encounter.state, sim.state, 1 / 60, true);
  const roots = scene.getObjectByName('erupting-roots');
  assert.equal(roots.visible, true);
  for (let i = 0; i < roots.count; i++) {
    roots.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix); scale.setFromMatrixScale(matrix);
    assert.ok(Math.abs(position.y - scale.y / 2 - heightAt(position.x, position.z)) < .00001);
  }
});

test('stun enlarges the heart around its chest anchor instead of scaling its baked position', () => {
  const { scene, shapes, encounter, sim } = fixture(), heart = scene.getObjectByName('exposed-heart'), center = new Vector3();
  const ground = heightAt(encounter.state.boss.x, encounter.state.boss.z);
  for (const kind of ['idle', 'stunned']) {
    encounter.state.boss.action.kind = kind;
    shapes.update(encounter.state, sim.state, 1 / 60, true); scene.updateMatrixWorld(true);
    new Box3().setFromObject(heart).getCenter(center);
    assert.ok(Math.abs(center.y - ground - (kind === 'stunned' ? 1.9 : 2.22)) < .00001);
    assert.equal(heart.position.y, 2.22);
    assert.equal(heart.position.z, kind === 'stunned' ? -1.07 : -.87);
  }
});

test('the crouched antler sweep crosses player height at its authored reach and follows the attack arc', () => {
  const { scene, shapes, encounter, sim } = fixture(), antlers = scene.getObjectByName('stag-antlers'), row = BOSS_ATTACKS.sweep;
  const point = new Vector3(), center = new Vector3(), positions = antlers.geometry.attributes.position, bearings = [];
  const boss = encounter.state.boss;
  for (const activeProgress of [0, .25, .5, .75, 1]) {
    Object.assign(boss.action, { kind: 'sweep', elapsed: row.telegraph + row.active * activeProgress, duration: row.duration, progress: .3 });
    shapes.update(encounter.state, sim.state, 1 / 60, true); scene.updateMatrixWorld(true);
    let contactVertices = 0, reach = 0;
    center.set(0, 0, 0);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(antlers.matrixWorld); center.add(point);
      const height = point.y - heightAt(point.x, point.z), distance = Math.hypot(point.x - boss.x, point.z - boss.z);
      assert.ok(height >= 0, 'antlers remain above terrain');
      reach = Math.max(reach, distance);
      if (height >= .25 && height <= 1.5 && distance >= row.range * .85) contactVertices++;
    }
    center.divideScalar(positions.count);
    bearings.push(Math.atan2(center.x - boss.x, boss.z - center.z));
    assert.ok(contactVertices > 0, `sweep ${activeProgress} visibly crosses player height near its hit range`);
    assert.ok(reach >= row.range * .95 && reach <= row.range + .2);
  }
  const angle = Math.atan2(Math.sin(bearings.at(-1) - bearings[0]), Math.cos(bearings.at(-1) - bearings[0]));
  assert.ok(Math.abs(angle - row.arc) < .00001);
});
