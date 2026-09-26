import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { createHouseMotion, roomMotionPose } from './house-motion.js';

function fixture(t) {
  const engine = new NullEngine(), scene = new Scene(engine);
  const level = new TransformNode('loft', scene);
  const mesh = MeshBuilder.CreateBox('room', { size: 2 }, scene);
  mesh.position.set(-2.55, 2.95, -.45); mesh.parent = level;
  mesh.freezeWorldMatrix();
  const motion = createHouseMotion({ loft: [-2.55, 2.95, -.45] });
  motion.bind({ levels: { loft: level }, meshes: [mesh] });
  t.after(() => { motion.dispose(); scene.dispose(); engine.dispose(); });
  const frame = (now, reduced) => { motion.restore(); return motion.update(now, reduced); };
  return { level, mesh, motion, frame };
}

test('every room spring is bounded and settles exactly', () => {
  for (const kind of ['arrive', 'select', 'design', 'build']) {
    for (let i = 0; i <= 1000; i++) {
      const pose = roomMotionPose(kind, i / 1000);
      assert.ok(pose.scale >= .66 - 1e-12 && pose.scale <= 1.06, `${kind}: ${pose.scale}`);
      assert.ok(pose.lift >= 0 && pose.lift <= .281);
    }
    assert.deepEqual(roomMotionPose(kind, 1), { lift: 0, scale: 1 });
  }
});

test('a room scales about its own origin, including frozen geometry', t => {
  const { mesh, motion, frame } = fixture(t);
  motion.trigger('loft', 'build', 0); frame(0);
  const center = mesh.getBoundingInfo().boundingBox.centerWorld;
  assert.ok(Math.abs(center.x + 2.55) < .00001);
  assert.ok(Math.abs(center.y - 2.95) < .00001);
  assert.ok(Math.abs(mesh.getBoundingInfo().boundingBox.extendSizeWorld.x - .66) < .00001);
  assert.equal(frame(1200), false);
  assert.ok(Math.abs(mesh.getBoundingInfo().boundingBox.extendSizeWorld.x - 1) < .00001);
});

test('opening floors during a bounce preserves the new floor position', t => {
  const { level, motion, frame } = fixture(t);
  level.position.set(-5.45, -1.95, .45);
  motion.trigger('loft', 'select', 0); frame(340);
  assert.ok(level.position.y > -1.8);
  motion.restore(); // presentation changes restore the old feedback first
  level.position.set(0, 2.7, 0); // resize to portrait while bouncing
  frame(450); frame(700);
  assert.ok(Math.abs(level.position.y - 2.7) < 1e-12);
  assert.deepEqual(level.scaling.asArray(), [1, 1, 1]);
});

test('rapid replacement and repeated frames never accumulate room transforms', t => {
  const { level, motion, frame } = fixture(t);
  level.position.y = -1.95;
  for (let i = 0; i < 30; i++) {
    motion.trigger('loft', i % 2 ? 'select' : 'design', i * 40);
    frame(i * 40 + 25);
    assert.ok(level.position.y < -1.65);
  }
  frame(3000);
  assert.ok(Math.abs(level.position.y + 1.95) < 1e-12);
  assert.equal(motion.activeCount, 0);
});

test('reduced motion cancels active and delayed feedback immediately', t => {
  const { level, motion, frame } = fixture(t);
  motion.trigger('loft', 'build', 0); frame(300);
  assert.notEqual(level.position.y, 0);
  frame(301, true);
  assert.equal(level.position.y, 0);
  assert.deepEqual(level.scaling.asArray(), [1, 1, 1]);
  motion.trigger('loft', 'arrive', 400, 110);
  frame(450, true);
  assert.equal(motion.activeCount, 0);
});
