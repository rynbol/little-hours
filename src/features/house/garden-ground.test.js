import test from 'node:test';
import assert from 'node:assert/strict';
import { gardenGround } from './garden-ground.js';

test('garden ground is a closed, bounded mesh with a flat walkable surface and rounded depth', () => {
  const { positions, indices, normals, colors } = gardenGround();
  assert.ok(positions.length / 3 < 1500);
  assert.equal(colors.length, positions.length / 3 * 4);
  assert.equal(normals.length, positions.length);
  assert.ok([...positions, ...normals, ...colors].every(Number.isFinite));
  const heights = positions.filter((_, i) => i % 3 === 1);
  assert.equal(Math.max(...heights), 0);
  assert.ok(Math.min(...heights) < -2 && Math.min(...heights) > -3);
  const edges = new Map();
  for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = indices[i + j], b = indices[i + (j + 1) % 3];
    assert.ok(a >= 0 && a < positions.length / 3);
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edges.set(key, (edges.get(key) || 0) + 1);
  }
  assert.ok([...edges.values()].every(count => count === 2));
  for (let i = 0; i < normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...normals.slice(i, i + 3)) - 1) < 1e-6);
});
