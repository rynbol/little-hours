import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS, placeAsset } from './assets.js';

const bounds = ({ positions }) => {
  const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) { low[i % 3] = Math.min(low[i % 3], positions[i]); high[i % 3] = Math.max(high[i % 3], positions[i]); }
  return { low, high, size: high.map((v, i) => v - low[i]) };
};

test('every asset places as a valid indexed mesh with unit normals and colours', () => {
  for (const name of Object.keys(ASSETS)) {
    const shape = placeAsset(name), count = shape.positions.length / 3;
    assert.equal(shape.normals.length, count * 3, name);
    assert.equal(shape.colors.length, count * 4, name);
    assert.ok(shape.indices.length % 3 === 0 && shape.indices.every(i => i >= 0 && i < count), name);
    for (let i = 0; i < count; i += 97) assert.ok(Math.abs(Math.hypot(shape.normals[i * 3], shape.normals[i * 3 + 1], shape.normals[i * 3 + 2]) - 1) < .02, `${name} normal ${i}`);
  }
});

test('placing moves, turns and scales an asset', () => {
  const boat = bounds(placeAsset('rowboat')), turned = bounds(placeAsset('rowboat', { x: 5, z: -2, yaw: Math.PI / 2, scale: 2 }));
  assert.ok(Math.abs(boat.size[0] - 2.3) < .1 && Math.abs(boat.size[2] - 1) < .1, `boat is ${boat.size}`);
  assert.ok(Math.abs(turned.size[2] - boat.size[0] * 2) < .01 && Math.abs(turned.size[0] - boat.size[2] * 2) < .01);
  assert.ok(Math.abs((turned.low[0] + turned.high[0]) / 2 - 5) < .2 && Math.abs((turned.low[2] + turned.high[2]) / 2 + 2) < 1.2);
});

test('trees stand on the ground and the cliff hangs below the lawn', () => {
  for (const name of ['tree-round-a', 'tree-blossom-a', 'tree-pine', 'tree-willow', 'sapling']) {
    const { low, high } = bounds(placeAsset(name));
    assert.ok(low[1] > -.1 && low[1] < .05 && high[1] > .5, `${name} spans ${low[1]}..${high[1]}`);
  }
  const cliff = bounds(placeAsset('island-cliff'));
  assert.ok(cliff.high[1] < -.175 && cliff.low[1] < -5, `cliff spans ${cliff.low[1]}..${cliff.high[1]}`);
});
