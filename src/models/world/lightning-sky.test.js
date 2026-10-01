import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { boltShape, createWorldLightning, skylineAt, LIGHTNING_SKY } from './lightning-sky.js';

test('a bolt falls from the cloud deck to the hills in one jagged channel with a few side branches', () => {
  const { positions, uvs, indices } = boltShape(11, { top: 2000, bottom: 0, width: 10, branchWidth: 6 });
  const ys = [], xs = [];
  for (let i = 0; i < positions.length; i += 3) { xs.push(positions[i]); ys.push(positions[i + 1]); }
  assert.ok(Math.max(...ys) >= 1995 && Math.min(...ys) <= 5, `spans ${Math.min(...ys).toFixed(0)} to ${Math.max(...ys).toFixed(0)}`);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 1200, `stays narrow: ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)} wide`);
  const quads = indices.length / 6;
  assert.ok(quads >= 16 + 2 * 4 && quads <= 16 + 3 * 6, `${quads} segments: a trunk of 16 and two or three branches`);
  assert.ok(uvs.every((value, i) => i % 2 ? value >= -0.05 && value <= 1.0001 : Math.abs(value) === 1), 'every vertex knows its edge and its height');
  assert.notDeepEqual(boltShape(3).positions, boltShape(23).positions);
});

test('the channel is one unbroken soft strip several pixels wide at its distance, so it never breaks into beads', () => {
  const { positions, indices } = boltShape(11);
  for (let quad = 0; quad < 15; quad++) assert.deepEqual(indices.slice(quad * 6 + 6, quad * 6 + 8), [indices[quad * 6 + 2], indices[quad * 6 + 2] + 1], `trunk piece ${quad} shares its edge with the next`);
  for (let point = 0; point <= 16; point++) {
    const i = point * 6, across = Math.hypot(positions[i + 3] - positions[i], positions[i + 4] - positions[i + 1]);
    assert.ok(across > LIGHTNING_SKY.width * 0.85, `trunk ${across.toFixed(0)} m across at point ${point}`);
  }
});

test('the foot of a bolt sits on the skyline seen from the window, where the far ridge hides it', () => {
  const ridge = (x, z) => Math.hypot(x, z) > 5100 && Math.hypot(x, z) < 5300 ? 1000 : 0;
  assert.ok(Math.abs(skylineAt(0.3, 6000, ridge) - 1000 / 5100 * 6000) < 30, `foot at ${skylineAt(0.3, 6000, ridge).toFixed(0)} m`);
  assert.equal(skylineAt(0.3, 6000, () => 0), 0);
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const sky = createWorldLightning(scene);
    sky.show(0.8, { bolt: 0, bearing: -0.1, distance: 4400 });
    assert.equal(sky.bolts[0].material._floats.ground, skylineAt(-0.1, 4400));
    assert.ok(skylineAt(-0.1, 4400) > 300, `the far ridge rises to ${skylineAt(-0.1, 4400).toFixed(0)} m behind the valley`);
  } finally { scene.dispose(); engine.dispose(); }
});

test('the flash and the bolt draw only while lit, and the bolt faces the window from its bearing', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  const sky = createWorldLightning(scene), enabled = () => scene.meshes.filter(mesh => mesh.isEnabled(false)).map(mesh => mesh.name);
  try {
    assert.deepEqual(enabled(), []);
    const shape = { bolt: 1, bearing: 0.5, distance: 6000 };
    sky.show(0.8, shape);
    assert.deepEqual(enabled(), ['world-lightning-glow', 'world-lightning-bolt-1']);
    const strong = sky.glow.material._floats.strength;
    sky.show(0.4, shape);
    assert.ok(Math.abs(sky.glow.material._floats.strength - strong / 2) < 1e-9, 'the glow follows the flash level');
    const bolt = sky.bolts[1].computeWorldMatrix(true), facing = Vector3.TransformNormal(new Vector3(0, 0, 1), bolt), toWindow = sky.bolts[1].position.scale(-1).normalize();
    assert.ok(Vector3.Dot(facing, toWindow) > 0.999, `bolt faces the window: ${Vector3.Dot(facing, toWindow).toFixed(4)}`);
    assert.ok(Math.abs(sky.bolts[1].position.length() - 6000) < 1e-6);
    const cloud = new Mesh('cloud', scene); cloud.setEnabled(false);
    assert.ok(sky.bolts.every(mesh => mesh.alphaIndex > cloud.alphaIndex), 'the bolt draws after the cloud deck, so a low overcast does not swallow it');
    sky.show(0.8, { ...shape, bolt: -1 });
    assert.deepEqual(enabled(), ['world-lightning-glow']);
    sky.show(0, shape);
    assert.deepEqual(enabled(), []);
  } finally { scene.dispose(); engine.dispose(); }
});
