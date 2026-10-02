import test from 'node:test';
import assert from 'node:assert/strict';
import { groundsKit, lanternPost, stringLights, railFence } from './grounds-kit.js';

const recorder = () => { const shapes = []; return { shapes, api: { shape: (positions, colors, normals) => shapes.push({ positions, colors, normals }) } }; };

function facesFront({ positions, normals }) {
  for (let i = 0; i < positions.length; i += 9) {
    const p = k => positions.slice(i + k * 3, i + k * 3 + 3), [a, b, c] = [p(0), p(1), p(2)];
    const u = b.map((v, k) => v - a[k]), v = c.map((value, k) => value - a[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...n) < 1e-9) continue;
    if (n[0] * normals[i] + n[1] * normals[i + 1] + n[2] * normals[i + 2] > 0) return false;
  }
  return true;
}

test('every part is wound so its lit face points the way its normal does', () => {
  const kit = groundsKit(), { shapes, api } = recorder();
  kit.slab(0, 0, 0, .2, .05, '#c0b8a0', { seed: 3 });
  kit.post(1, 0, 0, 1, .05, '#6e4e37', { lean: [.05, 0] });
  kit.beam([0, 1, 0], [1, 1.2, .3], .04, .05, '#9b7a58');
  kit.blob(2, .2, 0, .3, .2, .3, '#7d9a55');
  kit.ribbon([[[0, 0, 0], [1, 0, 0]], [[0, 0, 1], [1, 0, 1]]], [[[1, 0, 0, 1], [1, 0, 0, 1]], [[1, 0, 0, 1], [1, 0, 0, 1]]]);
  kit.flush(api);
  assert.equal(shapes.length, 1);
  const [shape] = shapes;
  assert.equal(shape.positions.length, shape.normals.length);
  assert.equal(shape.colors.length, shape.positions.length / 3 * 4);
  assert.ok(facesFront(shape), 'a triangle faces away from its normal');
  assert.equal(kit.vertices, 0, 'flushing empties the kit');
});

test('a slab is a flat stone whose top sits at the given height', () => {
  const kit = groundsKit();
  kit.slab(0, .3, 0, .2, .05, '#c0b8a0', { seed: 1 });
  const { positions, normals } = kit.data, heights = positions.filter((_, i) => i % 3 === 1);
  assert.equal(Math.max(...heights), .3);
  assert.equal(Math.min(...heights), .25);
  const up = normals.filter((_, i) => i % 3 === 1 && normals[i] > .99).length;
  assert.ok(up >= 21, `only ${up} upward vertices`);
});

test('string lights hang below their anchors and carry a glowing bulb every spacing', () => {
  const kit = groundsKit();
  const bulbs = stringLights(kit, [[0, 1, 0], [2.6, 1, 0]], ['#ffd88f', 2], { sag: .2, spacing: .26 });
  assert.equal(bulbs.length, 9);
  assert.ok(bulbs.every(([, y]) => y < 1 - .08));
  const lowest = Math.min(...bulbs.map(([, y]) => y));
  assert.ok(lowest < .76 && lowest > .6, `the middle bulb sags to ${lowest}`);
  const bright = kit.data.colors.filter((value, i) => i % 4 === 0 && value > 1.5).length;
  assert.ok(bright > 0, 'dusk bulbs glow past full white');
});

test('a lantern post stands its glass beside the post, not on top of it', () => {
  const kit = groundsKit();
  lanternPost(kit, 0, 0, 0, ['#ffd88f', 2.1], { yaw: 0 });
  const { positions, colors } = kit.data, lit = [];
  for (let i = 0; i < colors.length; i += 4) if (colors[i] > 1.5) lit.push(positions.slice(i / 4 * 3, i / 4 * 3 + 3));
  assert.ok(lit.length > 10);
  assert.ok(lit.every(([x, y]) => x > .22 && x < .4 && y > .6 && y < 1), JSON.stringify(lit[0]));
  assert.ok(Math.max(...positions.filter((_, i) => i % 3 === 1)) < 1.15);
});

test('a rail fence spans its posts with two rails', () => {
  const kit = groundsKit();
  railFence(kit, [[0, 0], [1, 0], [2, 0]], 0, { height: .5 });
  const xs = kit.data.positions.filter((_, i) => i % 3 === 0), ys = kit.data.positions.filter((_, i) => i % 3 === 1);
  assert.ok(Math.min(...xs) < -.03 && Math.max(...xs) > 2.03);
  assert.ok(Math.max(...ys) < .6 && Math.min(...ys) < 0);
});
