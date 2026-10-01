import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { createWorldRocks, meadowRocks, MEADOW_ROCKS } from './rocks.js';
import { heightAt, padDistance, pathCenter, pathDistance } from '../../core/world-terrain.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const PER_ROCK = 240, EYE = [-2, 2.24, -2.41];
const rockVertices = (positions, r) => Array.from({ length: PER_ROCK }, (_, v) => positions.slice((r * PER_ROCK + v) * 3, (r * PER_ROCK + v) * 3 + 3));

test('meadow rocks sit low beside the path, half sunk into the slope and clear of the house', () => {
  const { positions } = meadowRocks();
  assert.equal(positions.length / 3, MEADOW_ROCKS.length * PER_ROCK);
  MEADOW_ROCKS.forEach((rock, r) => {
    const x = pathCenter(rock.ahead) + rock.side, z = -rock.ahead, ground = heightAt(x, z), points = rockVertices(positions, r);
    const fromPath = pathDistance(x, z);
    assert.ok(fromPath > 1.5 && fromPath < 6, `rock ${r} is ${fromPath} m from the path`);
    assert.ok(points.some(([px, py, pz]) => py < heightAt(px, pz) - 0.15), `rock ${r} is buried`);
    assert.ok(Math.max(...points.map(([, py]) => py - ground)) < 1, `rock ${r} stays low`);
    assert.ok(points.every(([px, , pz]) => padDistance(px, pz) > 2), `rock ${r} is off the house pad`);
  });
});

test('the rocks stay below the valley view from the desk, and one has a flat seat', () => {
  const { positions } = meadowRocks();
  const lowest = MEADOW_ROCKS.map((_, r) => Math.min(...rockVertices(positions, r).map(([px, py, pz]) => Math.atan2(EYE[1] - py, Math.hypot(px - EYE[0], pz - EYE[2])) * 180 / Math.PI)));
  assert.ok(lowest.every(angle => angle > 11), lowest.join());
  const seated = MEADOW_ROCKS.map((_, r) => {
    const heights = rockVertices(positions, r).map(([, py]) => py), top = Math.max(...heights);
    return heights.filter(py => py > top - 0.03).length;
  });
  assert.deepEqual(seated, [34, 12, 6, 6, 6, 6, 6]);
  assert.equal(MEADOW_ROCKS.findIndex(rock => rock.seat), 0);
});

test('rock tops carry moss, their lower halves do not, and every vertex is marked as stone', () => {
  const { positions, colors } = meadowRocks(), mean = values => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 1000) / 1000;
  const moss = MEADOW_ROCKS.map((_, r) => {
    const heights = rockVertices(positions, r).map(([, py]) => py), top = Math.max(...heights), foot = Math.min(...heights), span = top - foot;
    const mossAt = v => colors[(r * PER_ROCK + v) * 4 + 2];
    return [mean(heights.flatMap((py, v) => py > top - span * 0.15 ? [mossAt(v)] : [])), mean(heights.flatMap((py, v) => py < foot + span * 0.5 ? [mossAt(v)] : []))];
  });
  assert.deepEqual(moss, [[0.684, 0], [0.91, 0], [1, 0], [0.971, 0], [0.909, 0], [0.914, 0], [0.88, 0]]);
  for (let v = 0; v < colors.length / 4; v++) assert.equal(colors[v * 4 + 3], 0);
});

test('the rocks are one draw on the terrain paint and take the theme', () => {
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene);
  const rocks = createWorldRocks(scene, { root, still: true });
  assert.equal(scene.meshes.length, 1);
  assert.equal(rocks.mesh.parent, root);
  assert.equal(rocks.mesh.getTotalIndices(), MEADOW_ROCKS.length * PER_ROCK);
  assert.equal(rocks.mesh.material._floats.gusts, 0);
  rocks.setTheme(WORLD_ATMOSPHERES.rain);
  assert.equal(rocks.mesh.material._colors3.rock.toHexString().toLowerCase(), WORLD_ATMOSPHERES.rain.rock);
});
