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
  engine.enableScissor = engine.disableScissor = () => {};
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
  const glass = Vector3.TransformCoordinates(new Vector3(-2, 2.24, -8), anchor.getWorldMatrix()), ahead = Float32Array.from([...glass.subtractFromFloats(1, 1, 1).asArray(), ...glass.add(new Vector3(1, 1, 1)).asArray()]);
  assert.equal(windowWorld.render(seat, ahead), false);
  assert.equal(engine.scenes.includes(windowWorld.scene), false);
  await windowWorld.prepare({ theme: 'dusk' });
  assert.equal(windowWorld.ready, true);
  assert.equal(windowWorld.render(seat, ahead), true);
  near(windowWorld.camera.position, new Vector3(-2, 2.24, -2.4));
  near(windowWorld.camera.getTarget(), new Vector3(-2, 2.24, -12.4));
  assert.equal(windowWorld.camera.fov, 1.4);
  assert.deepEqual([windowWorld.camera.minZ, windowWorld.camera.maxZ], [WINDOW_WORLD_DEPTH.near, WINDOW_WORLD_DEPTH.far]);
  assert.ok(windowWorld.scene.meshes.some(mesh => mesh.name === 'world-terrain-0'));
  windowWorld.dispose();
  assert.equal(room.isDisposed, false);
});

test('from the chair the outdoor world shades only the window rectangle at three quarters of the canvas resolution, the room stretches it over the window as it draws, and nothing is drawn when no window is in view', { timeout: 30000 }, async t => {
  const engine = uploadingEngine(), room = new Scene(engine), anchor = new TransformNode('seat-world', room);
  room.useRightHandedSystem = true;
  const seat = new TargetCamera('seat', new Vector3(0, 0, 0), room);
  seat.setTarget(new Vector3(0, 0, -10)); seat.fov = Math.PI / 2;
  const windowWorld = createWindowWorld(engine, anchor, { workers: false });
  t.after(() => windowWorld.scene.isDisposed || windowWorld.dispose());
  await windowWorld.prepare({ theme: 'day' });
  const scissors = [];
  let drawn = 0;
  engine.enableScissor = (...rect) => scissors.push(rect);
  engine.disableScissor = () => scissors.push('off');
  windowWorld.scene.onAfterRenderObservable.add(() => drawn++);
  const draw = (...boxes) => { scissors.length = 0; drawn = 0; windowWorld.render(seat, Float32Array.from(boxes.flat())); room.render(); return { scissors: [...scissors], drawn }; };
  assert.deepEqual(draw([-1.3, -0.7, -5.1, 1.3, 0.7, -4.9]), { scissors: [[161, 77, 62, 38], 'off', [216, 104, 80, 48], 'off'], drawn: 1 }, 'a window straight ahead');
  assert.deepEqual(draw([-1.3, -0.7, -5.1, 1.3, 0.7, -4.9], [3, -0.7, -5.1, 5, 0.7, -4.9]), { scissors: [[161, 77, 136, 38], 'off', [216, 104, 178, 48], 'off'], drawn: 1 }, 'two windows ahead draw their union');
  assert.deepEqual(draw([-1.3, -0.7, 4.9, 1.3, 0.7, 5.1]), { scissors: [], drawn: 0 }, 'a window behind the chair draws nothing');
  assert.deepEqual(draw([-30, -20, -5.1, 30, 20, -4.9]), { scissors: [[0, 0, 384, 192], 'off', [0, 0, 512, 256], 'off'], drawn: 1 }, 'a window wider than the view fills the canvas');
  assert.deepEqual(draw([-1.3, -0.7, -5.1, 1.3, 0.7, 5.1]), { scissors: [[0, 0, 384, 192], 'off', [0, 0, 512, 256], 'off'], drawn: 1 }, 'a window box the chair sits inside fills the canvas');
  assert.deepEqual(draw([2, -0.7, -1, 4, 0.7, 1]), { scissors: [[355, 12, 29, 168], 'off', [475, 18, 37, 220], 'off'], drawn: 1 }, 'a side window beside the chair is cut at the screen edge');
  scissors.length = 0; room.render();
  assert.deepEqual(scissors, [], 'a room frame drawn without a fresh outdoor view stretches nothing');
  assert.deepEqual({ ...windowWorld.camera.outputRenderTarget.getSize() }, { width: 384, height: 192 }, 'the outdoors is shaded into a target three quarters the size of the 512x256 canvas');
  windowWorld.dispose();
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
