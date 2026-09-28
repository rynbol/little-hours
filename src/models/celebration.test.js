import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createMobileCompanion, createFurniture, disposeFurnitureAssets } from './furniture.js';

const pose = { atDesk: false, x: 0, z: 0, yaw: 0, sit: 0, seatHeight: .8, doze: 0, step: 0, moving: false, activity: null };
test('a cheer lifts the avatar’s hands while feet and mesh counts stay grounded', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const model = createMobileCompanion(scene), body = model.root.getChildMeshes().find(mesh => mesh.name === 'companion-articulated-body');
    model.animate(pose, 0, false);
    const before = Array.from(body.getVerticesData('position')), count = scene.meshes.length;
    model.animate({ ...pose, celebration: 1 }, 0, false);
    const after = Array.from(body.getVerticesData('position'));
    assert.ok(after.every(Number.isFinite));
    assert.ok(after.some((value, i) => i % 3 === 1 && value - before[i] > .35));
    for (let i = 0; i < before.length; i += 3) if (before[i + 1] < .4) assert.deepEqual(after.slice(i, i + 3), before.slice(i, i + 3));
    assert.equal(scene.meshes.length, count);
    model.animate({ ...pose, celebration: 1 }, 0, true);
    const still = Array.from(body.getVerticesData('position'));
    model.animate({ ...pose, celebration: 0 }, 100, true);
    assert.deepEqual(Array.from(body.getVerticesData('position')), still);
    model.dispose();
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('desk celebrations move the articulated arms and honor reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const desk = createFurniture('study-desk', scene);
    desk.metadata.avatar.setEnabled(true);
    const upper = desk.getChildMeshes().find(mesh => mesh.name === 'articulated-sweater-and-arms');
    desk.metadata.animate(1, false, false, 0);
    const before = Array.from(upper.getVerticesData('position'));
    desk.metadata.animate(1, false, false, 1);
    const after = Array.from(upper.getVerticesData('position'));
    assert.ok(after.every(Number.isFinite)); assert.notDeepEqual(after, before);
    desk.metadata.animate(1, false, true, 1);
    const still = Array.from(upper.getVerticesData('position'));
    desk.metadata.animate(100, false, true, 0);
    assert.deepEqual(Array.from(upper.getVerticesData('position')), still);
    desk.dispose();
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});
