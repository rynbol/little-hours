import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VALLEY, valleyHeight, waterAt, trail, farHeight, createHeightGrid, bakeCore, bridgeDeck } from './valley.js';

const slope = (x, z) => Math.hypot(valleyHeight(x + .5, z) - valleyHeight(x - .5, z), valleyHeight(x, z + .5) - valleyHeight(x, z - .5));

test('the worn trail runs from camp to the ring without a step steeper than a hill path', () => {
  const { samples } = trail();
  assert.ok(samples.length > 400);
  assert.deepEqual([samples[0].x, samples[0].z], VALLEY.trail[0]);
  assert.deepEqual([samples.at(-1).x, samples.at(-1).z], VALLEY.trail.at(-1));
  let steepest = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    steepest = Math.max(steepest, Math.abs(b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z));
  }
  assert.ok(steepest < .5, `steepest trail grade ${steepest.toFixed(2)}`);
});

test('camp, vista, oak, shrine, ring and every campfire stand on dry, level ground', () => {
  const places = [VALLEY.camp, VALLEY.vista, VALLEY.shrine, VALLEY.ring, ...VALLEY.campfires];
  for (const { x, z } of places) {
    assert.equal(waterAt(x, z), null, `${x},${z} is dry`);
    assert.ok(slope(x, z) < .2, `${x},${z} slope ${slope(x, z).toFixed(2)}`);
  }
  assert.ok(valleyHeight(VALLEY.oak.x, VALLEY.oak.z) > valleyHeight(VALLEY.oak.x + 16, VALLEY.oak.z + 10) + 2, 'the oak sits on a knoll');
});

test('the camp sits on a forest plateau that looks down over the lake from the vista', () => {
  const camp = valleyHeight(VALLEY.camp.x, VALLEY.camp.z), vista = valleyHeight(VALLEY.vista.x, VALLEY.vista.z);
  assert.ok(camp > 30 && vista > 25 && vista < camp);
  const lake = waterAt(-20, 140);
  assert.equal(lake.kind, 'lake');
  assert.equal(lake.height, 0);
  assert.ok(valleyHeight(-20, 140) < -5, 'deep blue centre');
  assert.ok(valleyHeight(VALLEY.ring.x, VALLEY.ring.z) > 10, 'the ring shoulder stands above the lake');
});

test('the stream falls in two steps from the cliff top to the plunge pool, and the trail crosses it by the bridge', () => {
  const { top, ledge, pool } = VALLEY.waterfall;
  const lip = valleyHeight(top.x + 2, top.z), shelf = valleyHeight(ledge.x, ledge.z), basin = valleyHeight(pool.x, pool.z);
  assert.ok(lip > shelf + 20, `lip ${lip.toFixed(1)} over ledge ${shelf.toFixed(1)}`);
  assert.ok(shelf > basin + 25, `ledge ${shelf.toFixed(1)} over pool ${basin.toFixed(1)}`);
  assert.equal(waterAt(pool.x, pool.z).kind, 'pool');
  assert.equal(waterAt(VALLEY.bridge.x, VALLEY.bridge.z).kind, 'stream');
  assert.ok(valleyHeight(VALLEY.bridge.x, VALLEY.bridge.z) < waterAt(VALLEY.bridge.x, VALLEY.bridge.z).height, 'the stream bed stays carved under the bridge');
  assert.ok(bridgeDeck() > waterAt(VALLEY.bridge.x, VALLEY.bridge.z).height + 1.2);
});

test('the east cliffs rise sheer from the valley floor while the west rolls into hills', () => {
  assert.ok(valleyHeight(140, 120) - valleyHeight(100, 120) > 50);
  assert.ok(valleyHeight(-200, 100) > 40);
  assert.ok(slope(-200, 100) < 1.2);
});

test('far ranges fill the north horizon and the observatory ridge is the highest point', () => {
  assert.equal(farHeight(0, 300), null);
  assert.ok(farHeight(0, 1500) > 150);
  const observatory = farHeight(VALLEY.observatory.x, VALLEY.observatory.z);
  for (const [x, z] of [[0, 1000], [600, 1600], [-900, 1900], [400, 2600]]) assert.ok(observatory > farHeight(x, z), `${x},${z}`);
});

test('the baked height grid reproduces the valley at its nodes and blends between them', () => {
  const region = { minX: 0, maxX: 8, minZ: -100, maxZ: -92, step: 2 };
  const grid = createHeightGrid(bakeCore(region).heights, { ...region, columns: 5, rows: 5 });
  assert.equal(grid.heightAt(4, -96), Math.fround(valleyHeight(4, -96)));
  const between = grid.heightAt(5, -96);
  assert.ok(between >= Math.min(grid.heightAt(4, -96), grid.heightAt(6, -96)) - 1e-6);
  assert.ok(between <= Math.max(grid.heightAt(4, -96), grid.heightAt(6, -96)) + 1e-6);
  assert.equal(grid.heightAt(-1, -96), null);
  assert.ok(grid.normalAt(4, -96).y > .5);
});
