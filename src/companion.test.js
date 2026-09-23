import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { PRESETS, createLayout } from './layout.js';
import { createMobileCompanion, disposeFurnitureAssets } from './furniture.js';
import { companionIntent, planCompanionTrip, navigationObstacles, walkable, clearSegment, createCompanionRoutine, DOZE_AFTER } from './companion.js';

const advance = (routine, seconds, reduced = false) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) routine.update(1 / 60, reduced); };
test('companion intent distinguishes new visits, working, paused and completed sessions', () => {
  assert.equal(companionIntent({ running: false, remaining: 1500, duration: 1500 }), 'idle');
  assert.equal(companionIntent({ running: true, remaining: 1300, duration: 1500 }), 'working');
  assert.equal(companionIntent({ running: false, remaining: 1300, duration: 1500 }), 'break');
  // A finished session is a short break, then an idle desk again.
  const finished = { running: false, remaining: 0, duration: 1500, completedAt: 10_000 };
  assert.equal(companionIntent(finished, 10_000 + 60_000), 'break');
  assert.equal(companionIntent(finished, 10_000 + 16 * 60_000), 'idle', 'yesterday\'s finished session no longer keeps the companion on a break');
  assert.equal(companionIntent({ running: false, remaining: 0, duration: 1500 }), 'idle', 'an old save without a finish time reads as idle');
});
test('every preset has a sofa route with clearance around solids and the sleeping cat', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id), before = JSON.stringify(layout), trip = planCompanionTrip(layout, null, false);
    assert.ok(trip, preset.id); assert.equal(layout.items.find(i => i.id === trip.end.itemId).type, 'daybed');
    const obstacles = navigationObstacles(layout);
    for (let i = 1; i < trip.path.length; i++) {
      const a = trip.path[i - 1], b = trip.path[i];
      for (let t = 0; t <= 1; t += .002) assert.ok(walkable({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, obstacles), `${preset.id} never clips a corner`);
    }
    assert.ok(planCompanionTrip(layout, trip.end, true), 'a seated companion can get back to the desk');
    assert.equal(JSON.stringify(layout), before, 'planning never moves furniture');
  }
  assert.equal(clearSegment({ x: -1, z: 0 }, { x: 1, z: 0 }, [{ minX: -.01, maxX: .01, minZ: -.01, maxZ: .01 }]), false, 'thin obstacles cannot fall between samples');
});
test('breaks walk to a seat, settle, doze, and resume working at the original desk', () => {
  const changes = [], routine = createCompanionRoutine(value => changes.push(value.state));
  routine.setLayout(createLayout('writers-loft')); routine.setIntent('working');
  assert.equal(routine.pose.state, 'working'); assert.equal(routine.pose.atDesk, true);
  routine.setIntent('break'); assert.equal(routine.pose.state, 'walking');
  const first = { x: routine.pose.x, z: routine.pose.z }; advance(routine, 2);
  assert.notDeepEqual({ x: routine.pose.x, z: routine.pose.z }, first);
  advance(routine, 18); assert.equal(routine.pose.state, 'resting'); assert.equal(routine.pose.atDesk, false); assert.equal(routine.pose.sit, 1);
  advance(routine, DOZE_AFTER + 2); assert.equal(routine.pose.state, 'sleeping'); assert.equal(routine.pose.doze, 1);
  routine.setIntent('working'); assert.equal(routine.pose.state, 'returning');
  advance(routine, 20); assert.equal(routine.pose.state, 'working'); assert.equal(routine.pose.atDesk, true);
  assert.deepEqual(changes, ['working', 'walking', 'resting', 'sleeping', 'returning', 'working']);
});
test('resuming mid-walk replans from the current position and repeated intent does not restart trips', () => {
  const routine = createCompanionRoutine(); routine.setLayout(createLayout()); routine.setIntent('break'); advance(routine, 3);
  const before = { x: routine.pose.x, z: routine.pose.z };
  routine.setIntent('break'); assert.deepEqual({ x: routine.pose.x, z: routine.pose.z }, before);
  routine.setIntent('working'); assert.deepEqual({ x: routine.pose.x, z: routine.pose.z }, before, 'changing intent does not teleport');
  advance(routine, 20); assert.equal(routine.pose.state, 'working');
  routine.setIntent('break'); advance(routine, 2); routine.setIntent('working'); advance(routine, 1); routine.setIntent('break'); advance(routine, 20);
  assert.equal(routine.pose.state, 'resting');
});
test('missing or blocked seating rests at the desk, and a missing sofa cannot strand the avatar', () => {
  const layout = createLayout(), desk = layout.items.find(i => i.id === layout.activeDeskId), routine = createCompanionRoutine();
  routine.setLayout({ ...layout, items: [desk] }); routine.setIntent('break'); advance(routine, 10);
  assert.equal(routine.pose.state, 'resting-at-desk'); assert.equal(routine.pose.atDesk, true);
  const blocked = { ...layout, items: [...layout.items, { id: 'block-exit', type: 'daybed', x: desk.x, z: desk.z + 1.6, rotation: 0 }] };
  assert.equal(planCompanionTrip(blocked, null, false), null, 'an obstructed chair exit never starts a trip');
  routine.setLayout(layout); advance(routine, 20); assert.equal(routine.pose.atDesk, false);
  routine.setLayout({ ...layout, items: [desk] }); assert.equal(routine.pose.atDesk, true);
  routine.setIntent('working'); assert.equal(routine.pose.state, 'working');
});
test('editing and reduced motion settle deterministically without changing timer or layout data', () => {
  const layout = createLayout(), routine = createCompanionRoutine(); routine.setLayout(layout); routine.setIntent('break'); advance(routine, 2);
  routine.setEditing(true); assert.equal(routine.pose.atDesk, true); const editPose = { ...routine.pose }; advance(routine, 10); assert.deepEqual(routine.pose, editPose);
  routine.setEditing(false); routine.update(0, true); assert.equal(routine.pose.state, 'resting');
  const rest = { ...routine.pose }; advance(routine, 80, true); assert.deepEqual(routine.pose, rest);
  routine.setIntent('working'); routine.update(0, true); assert.equal(routine.pose.state, 'working'); assert.equal(routine.pose.atDesk, true);
});
test('walking and seated poses reuse two body/head meshes with grounded feet and finite normals', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const avatar = createMobileCompanion(scene), body = scene.getMeshByName('companion-articulated-body');
    const meshes = scene.meshes.length, materials = scene.materials.length, geometry = body.geometry;
    assert.equal(avatar.root.getChildMeshes().length, 3, 'body, head and one small sleep-letter batch');
    const pose = { atDesk: false, x: 0, z: 0, yaw: 0, sit: 0, seatHeight: .80, doze: 0, step: 0, moving: true };
    for (let i = 0; i < 150; i++) {
      pose.step = i * .1; pose.sit = i < 70 ? 0 : Math.min(1, (i - 70) / 30); pose.doze = i > 100 ? 1 : 0;
      avatar.animate(pose, i / 60, false);
      const positions = body.getVerticesData('position'), normals = body.getVerticesData('normal');
      for (let j = 0; j < positions.length; j++) assert.ok(Number.isFinite(positions[j]) && Number.isFinite(normals[j]));
      for (let j = 1; j < positions.length; j += 3) assert.ok(positions[j] >= -.0001, 'feet remain above the floor');
    }
    assert.equal(body.geometry, geometry); assert.equal(scene.meshes.length, meshes); assert.equal(scene.materials.length, materials);
    assert.ok(avatar.root.getChildMeshes().every(mesh => !mesh.isPickable && !mesh.receiveShadows && mesh.metadata.castShadow === false));
    avatar.animate(pose, 5, true); const still = Array.from(body.getVerticesData('position'));
    avatar.animate(pose, 25, true); assert.deepEqual(Array.from(body.getVerticesData('position')), still);
    pose.atDesk = true; avatar.animate(pose, 26, false); assert.equal(avatar.root.isEnabled(), false); assert.equal(avatar.contact.isEnabled(), false);
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('a layout change elsewhere leaves a resting companion on its seat', () => {
  const layout = createLayout('ember-library'), routine = createCompanionRoutine();
  routine.setLayout(layout); routine.setIntent('break'); advance(routine, 40);
  const rested = { ...routine.pose }, seatId = routine.diagnostics().destination;
  assert.equal(rested.atDesk, false); assert.ok(['resting', 'sleeping'].includes(rested.state));
  // Move the piece farthest from the seat, as another tab might.
  const moved = structuredClone(layout), seat = moved.items.find(item => item.id === seatId);
  const far = moved.items.filter(item => item.id !== seatId && item.id !== moved.activeDeskId).sort((a, b) => Math.hypot(b.x - seat.x, b.z - seat.z) - Math.hypot(a.x - seat.x, a.z - seat.z))[0];
  far.x += far.x > 0 ? -0.25 : 0.25;
  routine.setLayout(moved);
  assert.equal(routine.pose.atDesk, false, 'no jump back to the desk');
  assert.deepEqual([routine.pose.x, routine.pose.z, routine.pose.state], [rested.x, rested.z, rested.state], 'the companion keeps its seat, pose and doze');
  // Moving the seat itself still sends the companion back to settle again.
  const seatMoved = structuredClone(moved); seatMoved.items.find(item => item.id === seatId).x += 0.5;
  routine.setLayout(seatMoved);
  assert.notDeepEqual([routine.pose.x, routine.pose.z], [rested.x, rested.z]);
});
