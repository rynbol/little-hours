import assert from 'node:assert/strict';
import test from 'node:test';
import { MeshToonMaterial } from 'three';
import { GRASS, buildGrass, grassSpots } from './grass.js';

const flat = () => 0;
const field = keep => buildGrass(flat, new MeshToonMaterial(), { keep, wind: { value: 0 } });
const keys = grass => grass.root.children.filter(mesh => mesh.count > 0).map(mesh => `${Math.floor(mesh.boundingSphere.center.x / GRASS.chunk)},${Math.floor(mesh.boundingSphere.center.z / GRASS.chunk)}`).sort();

test('grass grows only where the ground allows and the same chunk always grows the same tufts', () => {
  const spots = grassSpots(0, 0, x => x > 8);
  assert.ok(spots.length > 200);
  for (let i = 0; i < spots.length; i += 2) assert.ok(spots[i] > 8);
  assert.deepEqual(grassSpots(3, -2, () => true), grassSpots(3, -2, () => true));
});

test('the grass streams in chunks round the player, thinner at the edge, a couple of chunks per frame', () => {
  const grass = field(() => true), side = GRASS.reach * 2 + 1;
  grass.update(8, 8, Infinity);
  assert.equal(grass.chunks, side * side);
  const near = grass.root.children.find(mesh => mesh.boundingSphere.center.x === 8 && mesh.boundingSphere.center.z === 8);
  const edge = grass.root.children.find(mesh => mesh.boundingSphere.center.x === 8 + GRASS.reach * GRASS.chunk && mesh.boundingSphere.center.z === 8);
  assert.ok(edge.count > 0 && edge.count < near.count * 0.6, `${edge.count} at the edge, ${near.count} in the middle`);
  const before = keys(grass);
  grass.update(8 + GRASS.chunk, 8);
  assert.equal(grass.chunks, side * side - side + GRASS.fills);
  grass.update(8 + GRASS.chunk, 8);
  grass.update(8 + GRASS.chunk, 8);
  const after = keys(grass);
  assert.equal(after.length, side * side);
  assert.equal(after.filter(key => !before.includes(key)).length, side);
  assert.ok(after.includes(`${1 + GRASS.reach},0`) && !after.includes(`${-GRASS.reach},0`));
});
