import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { WILDS_BOULDERS, createWildsBoulders, placeWildsBoulders, trailOffset } from './boulders.js';

const flat = () => ({ height: 2, normal: { x: 0, y: 1, z: 0 } });
const spawn = { x: -106.5, z: -180 }, arena = { center: { x: -132, z: -215 } };

test('the trail offset is zero on the Forest path centre at the spawn and grows across it', () => {
  assert.ok(trailOffset(-106.5, -180) < .2);
  assert.ok(trailOffset(-96.5, -180) > 9.5);
  assert.equal(trailOffset(-3, 0) >= 99, true);
});

test('boulders are scattered the same way every time, off the trail, away from trees, the spawn and the arena, and sunk into the ground', () => {
  const trees = { count: 1, x: [-90], z: [-170], width: [6] };
  const boulders = placeWildsBoulders({ surfaceAt: flat, trees, spawn, arena });
  assert.deepEqual(placeWildsBoulders({ surfaceAt: flat, trees, spawn, arena }), boulders);
  assert.ok(boulders.length > 60 && boulders.length < 260, `${boulders.length} boulders`);
  for (const boulder of boulders) {
    assert.ok(trailOffset(boulder.x, boulder.z) >= WILDS_BOULDERS.pathClearance + boulder.radius);
    assert.ok(Math.hypot(boulder.x - spawn.x, boulder.z - spawn.z) >= WILDS_BOULDERS.spawnClearance);
    assert.ok(Math.hypot(boulder.x - arena.center.x, boulder.z - arena.center.z) >= WILDS_BOULDERS.arenaClearance);
    assert.ok(Math.hypot(boulder.x - -90, boulder.z - -170) >= 3 + boulder.radius + WILDS_BOULDERS.treeClearance);
    assert.ok(Math.abs(boulder.y - (2 - boulder.height * .2)) < 1e-9);
    assert.ok(boulder.radius >= .8 && boulder.radius <= 2.6);
  }
  assert.ok(boulders.some(boulder => boulder.radius > 1.8));
});

test('steep slopes and missing ground get no boulders', () => {
  assert.deepEqual(placeWildsBoulders({ surfaceAt: () => null, spawn, arena }), []);
  assert.deepEqual(placeWildsBoulders({ surfaceAt: () => ({ height: 0, normal: { x: .8, y: .6, z: 0 } }), spawn, arena }), []);
});

test('all boulders draw as one shadowed mesh that is released on disposal', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const placed = placeWildsBoulders({ surfaceAt: flat, spawn, arena });
    const boulders = createWildsBoulders(scene, { root: null, boulders: placed });
    assert.equal(scene.meshes.length, 1);
    assert.equal(boulders.mesh.thinInstanceCount, placed.length);
    assert.equal(boulders.mesh.receiveShadows, true);
    boulders.dispose();
    assert.equal(scene.meshes.length, 0);
    assert.equal(scene.materials.length, 0);
  } finally { scene.dispose(); engine.dispose(); }
});
