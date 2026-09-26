import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { PRESETS, createLayout } from './layout.js';
import { createCompanionRoutine, navigationObstacles, clearSegment } from './companion.js';
import { interactionFor } from './item-interactions.js';
import { createMobileCompanion } from './furniture.js';

function until(routine, condition, seconds = 30, reduced = false) {
  for (let i = 0; i < seconds * 20 && !condition(); i++) routine.update(.05, reduced);
  assert.ok(condition(), JSON.stringify(routine.diagnostics()));
}
function settled(layout = createLayout('ember-library'), onUse = () => {}) {
  const routine = createCompanionRoutine(() => {}, { onUse });
  routine.setLayout(layout); routine.setIntent('rest');
  until(routine, () => routine.pose.state === 'resting');
  return routine;
}

test('each room supports all four chosen moments without changing layout or switches', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id), before = JSON.stringify(layout);
    for (const kind of ['tea', 'water', 'read', 'rest']) {
      const routine = settled(layout);
      let chosen;
      for (const item of layout.items.filter(item => interactionFor(item.type)?.kind === kind)) {
        const result = routine.requestInteraction(item.id);
        if (result.ok) { chosen = item; break; }
        assert.equal(result.reason, 'blocked');
      }
      assert.ok(chosen, `${preset.id}: ${kind}`);
      const path = routine.diagnostics().path, obstacles = navigationObstacles(layout);
      for (let i = 1; i < path.length; i++) assert.ok(clearSegment(path[i - 1], path[i], obstacles), 'the selected moment has a clear floor route');
      until(routine, () => ['busy', 'resting'].includes(routine.pose.state));
      assert.equal(routine.diagnostics().destination, chosen.id);
      assert.equal(routine.pose.activity, kind === 'rest' ? null : kind);
      assert.equal(routine.requestInteraction(chosen.id).reason, 'already');
      routine.setIntent('working');
      until(routine, () => routine.pose.atDesk && routine.pose.state === 'working');
      assert.equal(routine.diagnostics().requestedItemId, null);
      assert.equal(JSON.stringify(layout), before);
    }
  }
});

test('tea, watering, and shelf reading use the chosen piece once, then return to a seat', () => {
  const layout = createLayout('ember-library');
  for (const type of ['side-table', 'plant', 'bookcase']) {
    const uses = [], routine = settled(layout, event => uses.push(event));
    const item = layout.items.find(item => item.type === type), kind = interactionFor(type).kind;
    assert.equal(routine.requestInteraction(item.id).ok, true);
    until(routine, () => routine.pose.state === 'busy');
    until(routine, () => routine.pose.state === 'resting', 30);
    assert.deepEqual(uses, [{ kind, itemId: item.id }]);
    assert.equal(routine.diagnostics().requestedItemId, null);
    assert.equal(routine.pose.seated, true);
  }
});

test('focus, editing, blocked pieces, and doorway travel cannot be interrupted by an item', () => {
  const layout = createLayout('ember-library'), item = layout.items.find(item => item.type === 'side-table');
  const routine = settled(layout);
  routine.setIntent('working'); until(routine, () => routine.pose.atDesk);
  const focusing = routine.diagnostics();
  assert.equal(routine.requestInteraction(item.id).reason, 'focusing');
  assert.deepEqual(routine.diagnostics(), focusing);
  routine.setIntent('rest'); until(routine, () => routine.pose.state === 'resting');
  routine.setEditing(true); assert.equal(routine.requestInteraction(item.id).reason, 'editing'); routine.setEditing(false);
  until(routine, () => routine.pose.state === 'resting');
  routine.beginAvatarEditing(); assert.equal(routine.requestInteraction(item.id).reason, 'editing'); routine.endAvatarEditing();
  // The room normally moves the wardrobe pose onto clear floor before exit.
  routine.setLayout(layout);
  until(routine, () => routine.pose.state === 'resting');
  assert.equal(routine.walkToDoor({ id: 'garden', built: true, z: 2.35 }, () => {}), true);
  assert.equal(routine.requestInteraction(item.id).reason, 'travelling');
  routine.cancelDoorWalk({ returnToDesk: true });
  assert.equal(routine.requestInteraction('missing').reason, 'unsupported');
  const blocked = { ...item, id: 'blocked-tea', x: 100, z: 100 };
  layout.items.push(blocked); routine.setLayout(layout); until(routine, () => routine.pose.state === 'resting');
  const before = routine.diagnostics();
  assert.equal(routine.requestInteraction(blocked.id).reason, 'blocked');
  assert.deepEqual(routine.diagnostics(), before);
});

test('an item moved during its activity is released, and an in-flight request can be cancelled by focus', () => {
  const layout = createLayout('ember-library'), routine = settled(layout);
  const item = layout.items.find(item => item.type === 'side-table');
  routine.requestInteraction(item.id); until(routine, () => routine.pose.state === 'busy');
  const moved = structuredClone(layout); moved.items = moved.items.filter(entry => entry.id !== item.id);
  routine.setLayout(moved); assert.notEqual(routine.pose.activity, 'tea');
  assert.equal(routine.diagnostics().requestedItemId, null);
  until(routine, () => routine.pose.state === 'resting');
  const plant = moved.items.find(item => item.type === 'plant'); routine.requestInteraction(plant.id);
  routine.update(.1, false); routine.setIntent('working');
  until(routine, () => routine.pose.atDesk && routine.pose.state === 'working');
  assert.equal(routine.diagnostics().requestedItemId, null);
});

test('reduced motion keeps chosen moments available as static poses and allows returning to focus', () => {
  const layout = createLayout('ember-library'), routine = settled(layout);
  routine.update(.1, true);
  const tea = layout.items.find(item => item.type === 'side-table');
  assert.equal(routine.requestInteraction(tea.id).ok, true);
  routine.update(.1, true);
  assert.equal(routine.pose.state, 'busy'); assert.equal(routine.pose.activity, 'tea'); assert.equal(routine.pose.moving, false);
  routine.setIntent('working'); routine.update(.1, true);
  assert.equal(routine.pose.state, 'working'); assert.equal(routine.pose.atDesk, true);
});

test('a tea sip reuses a single cup mesh, stays attached to the hand, and rests under reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine), avatar = createMobileCompanion(scene);
  try {
    const pose = { atDesk: false, x: 0, z: 0, yaw: 0, sit: 0, seatHeight: .8, doze: 0, moving: false, step: 0, activity: 'tea', activityTime: 0 };
    const meshCount = scene.meshes.length, body = avatar.root.getChildMeshes().find(mesh => mesh.name === 'companion-articulated-body');
    let initialY;
    for (let frame = 0; frame < 480; frame++) {
      pose.activityTime = frame / 60; avatar.animate(pose, frame / 60, false);
      if (frame === 120) initialY = avatar.cup.position.y;
      if (frame === 288) assert.ok(avatar.cup.position.y > initialY + .25, 'the cup lifts for a sip');
    }
    assert.equal(scene.meshes.length, meshCount, 'no meshes allocated per sip');
    assert.ok(avatar.cup.isEnabled());
    assert.ok(Array.from(body.getVerticesData('position')).every(Number.isFinite));
    const wrist = body.metadata.rig.joints.wristR;
    assert.ok(Math.hypot(avatar.cup.position.x - wrist.x, avatar.cup.position.y - wrist.y, avatar.cup.position.z - wrist.z) < .16);
    avatar.animate(pose, 10, true); const positions = Array.from(body.getVerticesData('position')), cup = avatar.cup.position.asArray();
    pose.activityTime = 4; avatar.animate(pose, 11, true);
    assert.deepEqual(Array.from(body.getVerticesData('position')), positions); assert.deepEqual(avatar.cup.position.asArray(), cup);
    pose.activity = null; avatar.animate(pose, 12, true); assert.equal(avatar.cup.isEnabled(), false);
  } finally { scene.dispose(); engine.dispose(); }
});
