import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { heightAt, riverCenter } from '../../core/world-terrain.js';
import { RIVER, createWorldWater, riverLevels, riverShape, terrainMeshHeight } from './water.js';
import { TERRAIN_RINGS } from './terrain-mesh.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

test('the water reads the terrain mesh height, exact at grid points and linear along an edge', () => {
  assert.equal(terrainMeshHeight(200, -480), heightAt(200, -480));
  assert.ok(Math.abs(terrainMeshHeight(204, -480) - (heightAt(200, -480) + heightAt(208, -480)) / 2) < 1e-9);
  assert.equal(terrainMeshHeight(1024, -480), heightAt(1024, -480));
  assert.equal(TERRAIN_RINGS.find(ring => 1028 < ring.radius).step, 32);
  assert.ok(Math.abs(terrainMeshHeight(1040, -480) - (heightAt(1024, -480) + heightAt(1056, -480)) / 2) < 1e-9);
});

test('the river follows riverCenter across the window view and never rises far above the carved bed', () => {
  const rows = riverLevels();
  assert.ok(rows[0].x <= -600 && rows[rows.length - 1].x >= 600);
  for (const row of rows) {
    assert.equal(row.center, riverCenter(row.x));
    const bed = terrainMeshHeight(row.x, row.center);
    assert.ok(row.level < bed + RIVER.depth * 3, `level ${row.level.toFixed(1)} over bed ${bed.toFixed(1)} at ${row.x}`);
  }
});

test('the river surface stays level or below, is wet down its middle and sinks under its banks', () => {
  const rows = riverLevels(), shape = riverShape(rows);
  rows.forEach((row, r) => {
    let deepest = -Infinity;
    for (let k = 0; k < RIVER.across; k++) {
      const v = r * RIVER.across + k, y = shape.positions[v * 3 + 1], depth = shape.uvs[v * 2 + 1];
      assert.ok(y <= row.level + 1e-3);
      if (k === 0 || k === RIVER.across - 1) assert.ok(depth < 0, `bank at ${row.x} is under the ground`);
      deepest = Math.max(deepest, depth);
    }
    if (Math.abs(row.x) <= 600) assert.ok(deepest > 0.5, `water shows at ${row.x}`);
  });
  assert.ok(shape.indices.length / 3 < 12000);
});

test('the river is one transparent draw that takes the theme', () => {
  const scene = new Scene(new NullEngine()), water = createWorldWater(scene, { root: new TransformNode('root', scene), still: true });
  assert.equal(scene.meshes.filter(mesh => mesh.name === 'world-river').length, 1);
  water.setTheme(WORLD_ATMOSPHERES.rain);
  assert.equal(water.river.material._colors3.water.toHexString().toLowerCase(), '#4a5448');
  assert.equal(water.river.material._colors3.horizon.toHexString().toLowerCase(), '#555c4c');
  assert.equal(water.river.material._floats.fogDensity, WORLD_ATMOSPHERES.rain.fogDensity);
  assert.equal(water.river.material.needAlphaBlending(), true);
  scene.dispose();
});
