import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { createFirstPersonView, clampLook, seatFov, seatEye, lookDirection, farFrame, SEAT_SECONDS, SEAT_LOOK } from './first-person.js';

const round = (value, places = 3) => Math.round(value * 10 ** places) / 10 ** places + 0;
const rounded = vector => vector.asArray().map(value => round(value, 2));

function stage() {
  const engine = new NullEngine(), scene = new Scene(engine);
  const room = new ArcRotateCamera('room', Math.atan2(12.4, 10.5), 1.071, 19, new Vector3(0, 2.15, 0), scene);
  room.mode = Camera.ORTHOGRAPHIC_CAMERA;
  scene.activeCamera = room;
  const listeners = {};
  const canvas = { addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: type => { delete listeners[type]; } };
  const changes = [];
  const view = createFirstPersonView(scene, canvas, {
    roomCamera: room,
    seat: () => ({ eye: new Vector3(-2, 2.12, -2.41), forward: new Vector3(0, 0, -1), aspect: 1.6 }),
    roomFrame: () => ({ height: 12, centerX: 0, centerY: 0 }),
    onChange: ({ state, inside }) => changes.push(`${state}${inside ? ' inside' : ''}`),
  });
  const run = (seconds, steps = 20) => { for (let i = 0; i < steps; i++) view.update(seconds / steps, false, 1.6); };
  return { engine, scene, room, view, listeners, changes, run };
}

test('the seat eye sits just behind and above the avatar head, facing the desk', () => {
  assert.deepEqual(rounded(seatEye(new Vector3(-2, 2.07, -2.65), new Vector3(0, 0, -1))), [-2, 2.24, -2.41]);
  assert.deepEqual(rounded(lookDirection(new Vector3(0, 0, -1), 0, 0)), [0, 0, -1]);
  assert.deepEqual(rounded(lookDirection(new Vector3(0, 0, -1), Math.PI / 2, 0)), [-1, 0, 0]);
});

test('looking around turns all the way round but stops at the floor and ceiling', () => {
  assert.deepEqual(clampLook(7, 3), { yaw: 7, pitch: 0.24 });
  assert.deepEqual(clampLook(-7, -3), { yaw: -7, pitch: -0.85 });
  assert.deepEqual(clampLook(0.1, -0.1), { yaw: 0.1, pitch: -0.1 });
});

test('a narrow phone keeps a wide enough view across the desk', () => {
  assert.equal(round(seatFov(16 / 9)), 1.22);
  assert.equal(round(seatFov(390 / 844)), 1.9);
  assert.equal(round(seatFov(1)), 1.5);
});

test('the far frame shows the same room height as the dollhouse camera', () => {
  const { room, engine } = stage();
  const frame = farFrame(room, 12, 0, 0);
  const distance = Vector3.Distance(frame.position, frame.target);
  assert.equal(round(2 * distance * Math.tan(frame.fov / 2)), 12);
  assert.deepEqual(rounded(frame.target), [0, 2.15, 0]);
  engine.dispose();
});

test('focus flies into the chair, hides the body once inside it, and flies back out to the dollhouse', () => {
  const { scene, room, view, changes, run, engine } = stage();
  assert.equal(view.enter(false), true);
  assert.equal(scene.activeCamera, view.camera);
  run(SEAT_SECONDS.enter / 2, 1);
  assert.deepEqual(changes, ['entering']);
  run(SEAT_SECONDS.enter);
  assert.deepEqual(changes, ['entering', 'entering inside', 'seated inside']);
  assert.deepEqual(rounded(view.camera.position), [-2, 2.12, -2.41]);
  assert.equal(round(view.camera.fov), 1.22);

  view.leave();
  run(SEAT_SECONDS.leave + 0.05);
  assert.deepEqual(changes.slice(3), ['leaving inside', 'leaving', 'room']);
  assert.equal(scene.activeCamera, room);
  engine.dispose();
});

test('dragging while seated turns the head a full circle, holds at the ceiling, and turns straight back', () => {
  const { view, listeners, engine } = stage();
  view.enter(true); view.update(0.016, true, 1.6);
  listeners.pointerdown({ pointerId: 1, clientX: 100, clientY: 100 });
  listeners.pointermove({ pointerId: 1, clientX: 100 + Math.round(2 * Math.PI / 0.0042), clientY: 5000 });
  view.update(0.016, true, 1.6);
  assert.deepEqual({ yaw: round(view.look.yaw, 2), pitch: view.look.pitch }, { yaw: 6.58, pitch: 0.24 });
  listeners.pointermove({ pointerId: 1, clientX: 100 + Math.round(2 * Math.PI / 0.0042), clientY: 4900 });
  view.update(0.016, true, 1.6);
  assert.equal(round(view.look.pitch), -0.18);
  listeners.pointerup({ pointerId: 1 });
  listeners.pointermove({ pointerId: 1, clientX: 0, clientY: 0 });
  view.update(0.016, true, 1.6);
  assert.equal(round(view.look.pitch), -0.18);
  engine.dispose();
});

test('reduced motion cuts straight to the chair and straight back', () => {
  const { scene, room, view, changes, engine } = stage();
  view.enter(true); view.update(0.016, true, 1.6);
  assert.equal(view.state, 'seated');
  view.leave({ instant: true });
  assert.deepEqual(changes, ['entering', 'seated inside', 'leaving inside', 'room']);
  assert.equal(scene.activeCamera, room);
  engine.dispose();
});

test('an instant exit during the fly-out lands in the dollhouse at once', () => {
  const { scene, room, view, changes, run, engine } = stage();
  view.enter(false); run(SEAT_SECONDS.enter + 0.05);
  view.leave(); run(0.2, 2);
  assert.equal(view.state, 'leaving');
  view.leave({ instant: true });
  assert.equal(view.state, 'room');
  assert.equal(view.inside, false);
  assert.equal(scene.activeCamera, room);
  assert.equal(view.update(0.016, false, 1.6), false);
  assert.equal(changes.at(-1), 'room');
  engine.dispose();
});

test('focusing again during the fly-out turns back toward the chair from where the camera is', () => {
  const { view, run, engine } = stage();
  view.enter(false); run(SEAT_SECONDS.enter + 0.05);
  view.leave(); run(0.5, 5);
  const midway = view.camera.position.clone();
  view.enter(false);
  assert.equal(view.state, 'entering');
  view.update(0.001, false, 1.6);
  assert.ok(Vector3.Distance(view.camera.position, midway) < 0.05);
  run(SEAT_SECONDS.enter + 0.05);
  assert.equal(view.state, 'seated');
  assert.deepEqual(rounded(view.camera.position), [-2, 2.12, -2.41]);
  engine.dispose();
});

test('leaving before the first frame of the fly-in starts from the dollhouse view', () => {
  const { room, view, run, engine } = stage();
  view.enter(false);
  view.leave();
  view.update(0.001, false, 1.6);
  const far = farFrame(room, 12, 0, 0);
  assert.ok(Vector3.Distance(view.camera.position, far.position) < 0.05);
  run(SEAT_SECONDS.leave + 0.05);
  assert.equal(view.state, 'room');
  engine.dispose();
});

test('preparing the seat shaders also covers hidden effects that appear later, one small step at a time, and leaves the dollhouse camera in charge', () => {
  const { scene, room, view, engine } = stage();
  const rendered = [];
  scene.onBeforeCameraRenderObservable.add(camera => rendered.push(camera.name));
  const sparkles = MeshBuilder.CreatePlane('sparkles', { size: 0.1 }, scene);
  sparkles.material = new StandardMaterial('sparkle-glow', scene);
  sparkles.setEnabled(false);
  const perspectiveSparkles = () => Object.keys(engine._compiledEffects).filter(key => key.includes('#define CAMERA_PERSPECTIVE')).length;
  assert.equal(perspectiveSparkles(), 0);
  const pending = view.prepareShaders();
  assert.equal(perspectiveSparkles(), 0, 'hidden effects wait to be compiled in small steps');
  assert.ok(pending.some(([mesh]) => mesh === sparkles));
  while (view.compileShaders(pending, 0) > 0);
  assert.equal(perspectiveSparkles(), 1);
  assert.deepEqual(rendered, ['seat-camera', 'room']);
  assert.equal(scene.activeCamera, room);
  assert.equal(view.state, 'room');
  engine.dispose();
});

test('disposing the view stops listening to the canvas', () => {
  const { view, listeners, engine } = stage();
  view.dispose();
  assert.deepEqual(Object.keys(listeners), []);
  engine.dispose();
});

test('from the chair the eye sits above the head and looks down, so the laptop drops below the far hills', () => {
  const head = new Vector3(1, 1.4, 2), eye = seatEye(head, new Vector3(0, 0, -1));
  assert.ok(eye.y - head.y >= 0.15, `eye ${(eye.y - head.y).toFixed(2)} above the head`);
  const gaze = lookDirection(new Vector3(0, 0, -1), SEAT_LOOK.restYaw, SEAT_LOOK.restPitch);
  assert.ok(gaze.y < -0.22 && gaze.y > -0.3, `rest gaze dips ${gaze.y.toFixed(2)}`);
});
