import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWindowWorld, WINDOW_WORLD_DEPTH } from './window-world.js';
import { WORLD_ATMOSPHERES } from '../../models/world/atmosphere.js';

function uploadingEngine() {
  const engine = new NullEngine(), createRawTexture = engine.createRawTexture.bind(engine);
  engine.createRawTexture = (...args) => Object.assign(createRawTexture(...args), { isReady: true });
  return engine;
}
const near = (actual, expected) => assert.ok(Vector3.Distance(actual, expected) < 1e-4, `${actual} vs ${expected}`);

test('the window world draws nothing until built, then sees the outdoors from where the seat camera sits in the room', { timeout: 30000 }, async t => {
  const engine = uploadingEngine(), room = new Scene(engine), anchor = new TransformNode('seat-world', room);
  anchor.position.set(10, 1, 5); anchor.rotation.y = Math.PI / 2; anchor.computeWorldMatrix(true);
  const seat = new TargetCamera('seat', Vector3.TransformCoordinates(new Vector3(-2, 2.24, -2.4), anchor.getWorldMatrix()), room);
  seat.setTarget(Vector3.TransformCoordinates(new Vector3(-2, 2.24, -12.4), anchor.getWorldMatrix())); seat.fov = 1.4; seat.computeWorldMatrix(true);
  const windowWorld = createWindowWorld(engine, anchor, { workers: false });
  t.after(() => windowWorld.scene.isDisposed || windowWorld.dispose());
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

test('the window world builds its terrain, landmarks, trees and grass in separate turns of the event loop, so the dollhouse keeps drawing frames while it builds', { timeout: 30000 }, async t => {
  const engine = uploadingEngine(), room = new Scene(engine), anchor = new TransformNode('seat-world', room);
  const windowWorld = createWindowWorld(engine, anchor, { workers: false });
  t.after(() => windowWorld.scene.isDisposed || windowWorld.dispose());
  const firstTurn = new Map();
  let turn = 0, building = true;
  const look = () => { for (const mesh of windowWorld.scene.meshes) if (!firstTurn.has(mesh.name)) firstTurn.set(mesh.name, turn); turn++; };
  const watch = () => { look(); if (turn === 2) windowWorld.setTheme('dusk'); if (building) setTimeout(watch, 0); };
  setTimeout(watch, 0);
  await windowWorld.prepare({ theme: 'day' });
  building = false; look();
  const turns = ['world-terrain-0', 'world-landmarks', 'world-trees-broadleaf-near', 'world-grass'].map(name => firstTurn.get(name));
  assert.deepEqual(turns.map((at, i) => i === 0 || at > turns[i - 1]), [true, true, true, true], `first seen on turns ${turns.join(', ')}`);
  assert.equal(windowWorld.scene.getMeshByName('world-terrain-0').material._colors3.grass.toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk.grass, 'a theme picked while the world builds still reaches it');
  windowWorld.dispose();
});

test('closing the room while the window world builds stops the build and leaves nothing behind', { timeout: 30000 }, async () => {
  const engine = uploadingEngine(), room = new Scene(engine), anchor = new TransformNode('seat-world', room);
  const windowWorld = createWindowWorld(engine, anchor, { workers: false });
  const building = windowWorld.prepare({ theme: 'day' });
  setTimeout(() => windowWorld.dispose(), 0);
  assert.equal(await building, null);
  assert.equal(windowWorld.ready, false);
  assert.equal(windowWorld.scene.meshes.length, 0);
});
