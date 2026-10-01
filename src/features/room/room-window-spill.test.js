import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { windowReach, sideWallSpillShape, createWindowSpill, SIDE_WALL_SPILL } from './room-window-spill.js';
import { CLASSIC_WINDOW } from './room-sunbeam.js';
import { ROOM_LIGHTS } from './room-lighting.js';

const wall = SIDE_WALL_SPILL.faces[0].x;

test('window light on the side wall is strongest beside the window and fades into the room', () => {
  const near = windowReach([wall, 3, -3.5]), middle = windowReach([wall, 3, -1]), far = windowReach([wall, 3, 1.5]);
  assert.ok(near > 0.12, `beside the window the wall sees ${near.toFixed(3)} of the sky`);
  assert.ok(near > middle * 1.6 && middle > far * 2, `reach falls ${near.toFixed(3)} > ${middle.toFixed(3)} > ${far.toFixed(3)}`);
  assert.ok(windowReach([wall, 0.6, -3.5]) < near * 0.6, 'the wainscot under the sill gets less of the window than the wall at its height');
  assert.equal(windowReach([wall, 3, -4.7]), 0, 'nothing behind the glass is lit by it');
});

test('the spill covers the cream wall and the wainscot from the back corner forward', () => {
  const { positions, reach, indices } = sideWallSpillShape(CLASSIC_WINDOW), xs = new Set(), zs = [];
  for (let i = 0; i < positions.length; i += 3) { xs.add(positions[i]); zs.push(positions[i + 2]); }
  assert.deepEqual([...xs].map(x => Number(x.toFixed(3))).sort((a, b) => a - b), [-5.834, -5.604]);
  assert.equal(Math.min(...zs), SIDE_WALL_SPILL.back);
  assert.equal(reach.length, positions.length / 3);
  assert.ok(indices.length > 0 && Math.max(...indices) < reach.length);
});

test('the spill brightens what is under it by multiplying, so the wood keeps its colour, and shows only in the chair', () => {
  const engine = new NullEngine(), scene = new Scene(engine), spill = createWindowSpill(scene, new TransformNode('room', scene));
  try {
    spill.setLight(ROOM_LIGHTS.day.wallSpill);
    assert.equal(spill.mesh.isEnabled(false), false, 'the dollhouse view has no spill');
    spill.show(0.5);
    assert.ok(spill.mesh.isEnabled(false));
    assert.equal(spill.mesh.material._floats.strength, ROOM_LIGHTS.day.wallSpill[1] * 0.5);
    spill.mesh.onBeforeDrawObservable.notifyObservers(spill.mesh);
    assert.deepEqual(engine.alphaState._blendFunctionParameters.slice(0, 2), [Constants.GL_ALPHA_FUNCTION_DST_COLOR, 1], 'destination times (1 + light)');
    spill.show(0);
    assert.equal(spill.mesh.isEnabled(false), false);
  } finally { spill.dispose(); scene.dispose(); engine.dispose(); }
});

test('looking at the lit wall from the chair still finds the wall, not the light laid over it', () => {
  const engine = new NullEngine(), scene = new Scene(engine), room = new TransformNode('room', scene);
  const plaster = MeshBuilder.CreateBox('retreat-side-wall', { width: 0.22, height: 5.6, depth: 9.2 }, scene), spill = createWindowSpill(scene, room);
  plaster.position.set(-5.94, 3.01, 0); plaster.computeWorldMatrix(true);
  try {
    spill.setLight(ROOM_LIGHTS.day.wallSpill); spill.show(1);
    const hits = [[3, -3.5], [2.5, -1], [4.5, 0.5]].map(([y, z]) => scene.pickWithRay(new Ray(new Vector3(-2, 2.2, -2.4), new Vector3(-3.83, y - 2.2, z + 2.4).normalize(), 20), mesh => mesh.isEnabled() && mesh.isVisible)?.pickedMesh?.name);
    assert.deepEqual(hits, ['retreat-side-wall', 'retreat-side-wall', 'retreat-side-wall']);
  } finally { spill.dispose(); scene.dispose(); engine.dispose(); }
});
