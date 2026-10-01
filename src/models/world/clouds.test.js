import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt, WORLD } from '../../core/world-terrain.js';
import { CLOUD_KINDS, PLUME_COLUMN, clearsPlume, cloudCards, createWorldClouds } from './clouds.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('cumulus sit 1 to 6 km out and clear the land, wisps ride high and mist stays in the valley', () => {
  const cards = cloudCards(), of = kind => cards.filter(card => card.kind === CLOUD_KINDS[kind]);
  assert.equal(of('cumulus').length, 30);
  assert.equal(of('wisp').length, 10);
  assert.ok(of('mist').length >= 12 && of('mist').length <= 24);
  for (const card of of('cumulus')) {
    const out = Math.hypot(card.x, card.z), base = card.y - card.halfHeight * 0.6;
    assert.ok(out >= 1100 && out <= 6000 && base >= 300 && base <= 1000, `cumulus at ${out.toFixed(0)} m, base ${base.toFixed(0)} m`);
    assert.ok(base >= heightAt(card.x, card.z) + 120);
  }
  for (const card of of('wisp')) assert.ok(card.y >= 1300);
  for (const card of of('mist')) assert.ok(heightAt(card.x, card.z) <= WORLD.valleyFloor + 2);
  const reach = cards.map(card => Math.hypot(card.x, card.z));
  assert.deepEqual(reach, [...reach].sort((a, b) => b - a));
});

test('no cloud or wisp starts in front of the volcano plume, and the shader keeps it clear as they drift', () => {
  const sky = cloudCards().filter(card => card.kind !== CLOUD_KINDS.mist);
  assert.ok(sky.every(card => clearsPlume(card)));
  assert.equal(clearsPlume({ x: PLUME_COLUMN.x * 0.3, y: 900, z: PLUME_COLUMN.z * 0.3, halfWidth: 300, halfHeight: 100 }), false);
  assert.equal(clearsPlume({ x: PLUME_COLUMN.x * 0.3, y: 200, z: PLUME_COLUMN.z * 0.3, halfWidth: 300, halfHeight: 100 }), true);
  assert.equal(clearsPlume({ x: 2000, y: 900, z: -2000, halfWidth: 300, halfHeight: 100 }), true);
});

test('every cloud, wisp and mist bank is one draw that takes the theme and drifts unless still', async () => {
  const scene = new Scene(new NullEngine()); new FreeCamera('eye', new Vector3(0, 2, 0), scene);
  const moving = createWorldClouds(scene, { root: new TransformNode('root', scene), still: false });
  const resting = createWorldClouds(scene, { root: new TransformNode('rest', scene), still: true });
  assert.equal(scene.meshes.filter(mesh => mesh.name === 'world-clouds').length, 2);
  assert.equal(moving.clouds.getTotalIndices(), moving.cards.length * 6);
  moving.setTheme(WORLD_ATMOSPHERES.dusk);
  assert.equal(moving.clouds.material._colors3.cloudLit.toHexString().toLowerCase(), '#ffe2b0');
  assert.equal(moving.clouds.material._floats.cloudCover, 0.5);
  scene.render(); await wait(20); scene.render();
  assert.ok(moving.clouds.material._floats.time > 0);
  assert.equal(resting.clouds.material._floats.time, 0);
  assert.equal(resting.clouds.material._vectors3.eye.y, 2);
  assert.equal(resting.clouds.material._vectors4.plume.x, PLUME_COLUMN.x);
  scene.dispose();
});
