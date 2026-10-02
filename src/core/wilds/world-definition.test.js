import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WILDS_WORLD, WILDS_RINGS, WILDS_STREAM } from './world-definition.js';
import { createTerrainField, heightAt, canopyAt, pathDistance } from '../world-terrain.js';

test('the Wilds definition survives worker serialization and reserves a continuous 1800 metre map', () => {
  const definition = JSON.parse(JSON.stringify(WILDS_WORLD));
  assert.deepEqual(definition, WILDS_WORLD);
  assert.deepEqual(definition.spawn, { x: 0, z: 0, yaw: 0 });
  assert.equal(definition.bounds.maxX - definition.bounds.minX, 1800);
  assert.equal(definition.bounds.maxZ - definition.bounds.minZ, 1800);
  assert.equal(definition.regions[0].exit, 90);
  assert.equal(definition.regions[0].blend, 80);
  assert.equal(definition.landmarks.find(mark => mark.id === 'first-vista').z, -145);
  assert.deepEqual(definition.landmarks.filter(mark => mark.distant).map(mark => mark.kind), ['lake', 'peak', 'arch', 'islets', 'observatory']);
  assert.equal(new Set(definition.landmarks.map(mark => mark.id)).size, 8);
  assert.ok(Object.isFrozen(WILDS_WORLD.terrain.hills));
  for (const ring of WILDS_RINGS) for (const edge of ['minX', 'maxX', 'minZ', 'maxZ']) assert.equal(Math.abs(ring[edge] % WILDS_STREAM.snap), 0);
});

test('the clearing starts level and its path climbs a gentle forest slope into an open meadow', () => {
  const field = createTerrainField(WILDS_WORLD);
  assert.equal(field.heightAt(0, 0), 0);
  assert.deepEqual(field.normalAt(0, 0).map(value => value + 0), [0, 1, 0]);
  assert.equal(field.pathCenter(0), 0);
  assert.equal(field.pathDistance(field.pathCenter(145), -145), 0);
  assert.equal(field.canopyAt(0, 0), 0);
  assert.equal(field.canopyAt(35, -10), 1);
  assert.equal(field.canopyAt(35, -145), 0);
  assert.equal(field.canopyAt(35, -90), 0.5);
  for (let ahead = 0; ahead <= 240; ahead += 1) assert.ok(field.normalAt(field.pathCenter(ahead), -ahead)[1] > 0.83, `walkable route at ${ahead}`);
  assert.ok(field.heightAt(0, -145) > 12);
  assert.ok(field.heightAt(25, -410) < WILDS_WORLD.water[0].level);
});

test('requesting the shared room field preserves the original functions and output', () => {
  const field = createTerrainField();
  assert.equal(field.heightAt, heightAt);
  assert.equal(field.canopyAt, canopyAt);
  assert.equal(field.pathDistance, pathDistance);
  assert.equal(field.heightAt(0, 0), 0);
  assert.equal(Math.round(field.heightAt(300, -500) * 1000), -54964);
});

test('Mirror Fen is an ankle-deep basin with a dry walkable approach instead of an elevated water sheet', () => {
  const field = createTerrainField(WILDS_WORLD), water = WILDS_WORLD.water[0];
  assert.equal(water.basin.depth, .3);
  assert.ok(field.heightAt(25, -317) > -10);
  for (let z = -490; z <= -280; z++) {
    const ground = field.heightAt(25, z);
    if (z >= -497 && z <= -323) assert.ok(ground >= -10.3 - 1e-9);
    assert.ok(field.normalAt(25, z)[1] > .8, `walkable fen approach at ${z}`);
  }
  for (let angle = 0; angle < 360; angle += 3) {
    const turn = angle * Math.PI / 180;
    assert.ok(field.heightAt(25 + Math.cos(turn) * 123, -410 + Math.sin(turn) * 87) > -10);
  }
});


test('the first forest rise stays below eighteen degrees while retaining an elevated first vista', () => {
  const field = createTerrainField(WILDS_WORLD);
  for (let ahead = 10; ahead <= 70; ahead++) {
    const x = field.pathCenter(ahead);
    assert.ok(Math.acos(field.normalAt(x, -ahead)[1]) < Math.PI / 10, `first approach at ${ahead}m must not become a wall`);
  }
  assert.ok(field.heightAt(field.pathCenter(60), -60) < 8);
  assert.ok(field.heightAt(-2, -145) > 12);
});


test('the sheltered tree groups leave the original route and the hearth approach walkable', () => {
  const field = createTerrainField(WILDS_WORLD), hearth = WILDS_WORLD.landmarks.find(mark => mark.kind === 'hearth');
  for (const tree of WILDS_WORLD.trees.heroes) {
    assert.ok(field.pathDistance(tree.x, tree.z) > WILDS_WORLD.path.width + tree.size * 3.3);
    assert.ok(Math.hypot(tree.x - hearth.x, tree.z - hearth.z) > hearth.restingRadius + tree.size * 3.3);
  }
  assert.equal(field.heightAt(hearth.x, hearth.z), 0);
  assert.equal(field.pathCenter(0), 0);
  assert.ok(field.pathCenter(40) > 4 && field.pathCenter(40) < 4.1);
});
