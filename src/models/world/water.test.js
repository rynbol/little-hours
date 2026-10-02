import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { heightAt, riverCenter } from '../../core/world-terrain.js';
import { RIVER, createWorldWater, riverLevels, riverShape, terrainMeshHeight, lakeShape, sampleWaterSurface } from './water.js';
import { ringAt } from './terrain-mesh.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

test('the default room river geometry remains byte-identical without a lake basin option', () => {
  const hash = createHash('sha256');
  for (const data of Object.values(riverShape())) hash.update(Buffer.from(data.buffer));
  assert.equal(hash.digest('hex'), 'b1bd6ddf73ca816c44465a4a44572a60bc709c7efd52d5fae4c7eaf1105d02cd');
});

test('water surface queries use the visible terrain depth and reject dry land, missing triangles and points outside the lake', () => {
  const bodies = [{ x: 0, z: 0, radiusX: 10, radiusZ: 8, level: 3 }], surface = (x, z) => x === 2 ? null : { height: z / 2 + 2.8 };
  assert.ok(Math.abs(sampleWaterSurface(bodies, surface, 0, 0).depth - .2) < 1e-10);
  assert.equal(sampleWaterSurface(bodies, surface, 0, 0).height, 3);
  assert.equal(sampleWaterSurface(bodies, surface, 0, 1), null);
  assert.equal(sampleWaterSurface(bodies, surface, 2, 0), null);
  assert.equal(sampleWaterSurface(bodies, surface, 11, 0), null);
  assert.equal(sampleWaterSurface([...bodies, { ...bodies[0], level: 4 }], surface, 0, 0).height, 4);
});

test('Mirror Fen stays shallow with a dry perimeter on coarse and streamed terrain and water interpolates the actual bed', async () => {
  const { WILDS_WORLD, WILDS_RINGS } = await import('../../core/wilds/world-definition.js');
  const { buildTerrainRings, sampleTerrainSurface } = await import('./terrain-mesh.js');
  for (const center of [{ x: 0, z: 0 }, { x: 32, z: -288 }, { x: 32, z: -416 }]) {
    const rings = await buildTerrainRings({ definition: WILDS_WORLD, rings: WILDS_RINGS, center, workers: false }), surface = (x, z) => sampleTerrainSurface(rings, x, z);
    const mesh = lakeShape(WILDS_WORLD.water, surface), depths = { ...mesh, positions: mesh.positions.slice() };
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      const x = mesh.positions[i * 3], z = mesh.positions[i * 3 + 2];
      assert.equal(x % 2 + 0, 0); assert.equal(z % 2 + 0, 0);
      assert.ok(Math.abs(mesh.uvs[i * 2 + 1] - (-10 - surface(x, z).height)) < 1e-5);
      depths.positions[i * 3 + 1] = mesh.uvs[i * 2 + 1];
      if (mesh.uvs[i * 2]) assert.ok(mesh.uvs[i * 2 + 1] <= .30001);
    }
    for (let angle = 0; angle < 360; angle += 2) {
      const turn = angle * Math.PI / 180, x = 25 + Math.cos(turn) * 123, z = -410 + Math.sin(turn) * 87;
      assert.ok(surface(x, z).height > -10, `dry perimeter at ${angle}, center ${center.z}`);
      assert.equal(sampleWaterSurface(WILDS_WORLD.water, surface, x, z), null);
    }
    for (let x = -80.3; x < 130; x += 13) for (let z = -480.7; z < -340; z += 11) {
      const water = sampleWaterSurface(WILDS_WORLD.water, surface, x, z);
      if (!water) continue;
      assert.ok(water.depth <= .30001);
      assert.ok(Math.abs(sampleTerrainSurface([depths], x, z).height - water.depth) < 1e-5);
    }
  }
});

test('the water reads the terrain mesh height, exact at grid points and linear along an edge', () => {
  assert.equal(terrainMeshHeight(200, -480), heightAt(200, -480));
  assert.ok(Math.abs(terrainMeshHeight(204, -480) - (heightAt(200, -480) + heightAt(208, -480)) / 2) < 1e-9);
  assert.equal(terrainMeshHeight(1024, -480), heightAt(1024, -480));
  assert.equal(ringAt(1028, -480).step, 32);
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

test('defined lakes derive every shoreline depth from the rendered terrain surface', async () => {
  const { lakeShape } = await import('./water.js');
  const lake = lakeShape([{ x: 0, z: 0, radiusX: 8, radiusZ: 8, level: 10 }], (x, z) => ({ height: x + z + 2 }));
  assert.equal(lake.positions.length / 3, 9);
  assert.equal(lake.indices.length, 24);
  assert.deepEqual(Array.from(lake.positions.slice(12, 15)), [0, 10, 0]);
  assert.deepEqual(Array.from(lake.uvs.slice(8, 10)), [1, 8]);
  const missing = lakeShape([{ x: 0, z: 0, radiusX: 8, radiusZ: 8, level: 10 }], () => null);
  assert.ok(missing.uvs.every(value => value === 0));
});

test('a shallow lake uses subdued wave normals and glints while the default river keeps its wave scale', () => {
  const scene = new Scene(new NullEngine()), root = new TransformNode('root', scene);
  const river = createWorldWater(scene, { root, still: true });
  const lake = createWorldWater(scene, { root, still: true, definition: { water: [{ x: 0, z: 0, radiusX: 4, radiusZ: 4, level: 0, basin: { depth: .3 } }] }, surface: () => ({ height: -.3 }) });
  for (const theme of Object.values(WORLD_ATMOSPHERES)) {
    river.setTheme(theme); lake.setTheme(theme);
    assert.equal(river.river.material._floats.rippleScale, 1);
    assert.equal(lake.river.material._floats.rippleScale, .24);
    assert.equal(river.river.material._floats.glintScale, 1);
    assert.equal(lake.river.material._floats.glintScale, .3);
  }
  scene.dispose();
});
