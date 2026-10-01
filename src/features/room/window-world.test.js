import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWindowWorld, WINDOW_WORLD_DEPTH } from './window-world.js';

const near = (actual, expected) => assert.ok(Vector3.Distance(actual, expected) < 1e-4, `${actual} vs ${expected}`);

test('the window world draws nothing until built, then sees the outdoors from where the seat camera sits in the room', async () => {
  const engine = new NullEngine(), room = new Scene(engine), anchor = new TransformNode('seat-world', room);
  anchor.position.set(10, 1, 5); anchor.rotation.y = Math.PI / 2; anchor.computeWorldMatrix(true);
  const seat = new TargetCamera('seat', Vector3.TransformCoordinates(new Vector3(-2, 2.24, -2.4), anchor.getWorldMatrix()), room);
  seat.setTarget(Vector3.TransformCoordinates(new Vector3(-2, 2.24, -12.4), anchor.getWorldMatrix())); seat.fov = 1.4; seat.computeWorldMatrix(true);
  const windowWorld = createWindowWorld(engine, anchor, { workers: false });
  assert.equal(windowWorld.render(seat), false);
  assert.equal(engine.scenes.includes(windowWorld.scene), false);
  await windowWorld.prepare({ theme: 'dusk' });
  assert.equal(windowWorld.ready, true);
  assert.equal(windowWorld.render(seat), true);
  near(windowWorld.camera.position, new Vector3(-2, 2.24, -2.4));
  near(windowWorld.camera.getTarget(), new Vector3(-2, 2.24, -12.4));
  assert.equal(windowWorld.camera.fov, 1.4);
  assert.deepEqual([windowWorld.camera.minZ, windowWorld.camera.maxZ], [WINDOW_WORLD_DEPTH.near, WINDOW_WORLD_DEPTH.far]);
  assert.ok(windowWorld.scene.meshes.some(mesh => mesh.name === 'world-terrain-0'));
  windowWorld.dispose();
  assert.equal(room.isDisposed, false);
});
