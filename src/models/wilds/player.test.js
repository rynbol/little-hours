import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createWildsPlayer, RANGER_PAINT } from './player.js';
import { RANGER_JOINTS } from './ranger-pose.js';

function settle(player) {
  player.root.computeWorldMatrix(true);
  for (const name of RANGER_JOINTS) player.joints[name].computeWorldMatrix(true);
}

test('the ranger is one skinned mesh on sixteen bones, grounded at the root and released on disposal', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const player = createWildsPlayer(scene), body = scene.getMeshByName('wilds-ranger');
    assert.equal(scene.meshes.length, 1);
    assert.equal(scene.skeletons.length, 1);
    assert.equal(body.skeleton.bones.length, 16);
    assert.equal(body.material.name, 'wilds-ranger-paint');
    body.computeWorldMatrix(true); body.refreshBoundingInfo();
    const bounds = body.getBoundingInfo().boundingBox;
    assert.ok(Math.abs(bounds.minimumWorld.y) < .001, `feet at ${bounds.minimumWorld.y}`);
    assert.ok(bounds.maximumWorld.y > 1.68 && bounds.maximumWorld.y < 1.76, `hood top at ${bounds.maximumWorld.y}`);
    player.root.position.set(10, 4, -3);
    player.update({ action: 'idle', yaw: 1.2 });
    assert.equal(player.root.rotation.y, 1.2);
    assert.deepEqual(player.root.position.asArray(), [10, 4, -3]);
    player.dispose(); player.dispose();
    assert.equal(scene.meshes.length, 0);
    assert.equal(scene.materials.length, 0);
    assert.equal(scene.skeletons.length, 0);
    assert.equal(scene.transformNodes.length, 0);
  } finally { scene.dispose(); engine.dispose(); }
});

test('the sword hangs from the right hand, which is +x for a ranger facing -z, and points at the ground', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    createWildsPlayer(scene);
    const body = scene.getMeshByName('wilds-ranger'), steel = Color3.FromHexString(RANGER_PAINT.steel);
    const positions = body.getVerticesData(VertexBuffer.PositionKind), colors = body.getVerticesData(VertexBuffer.ColorKind);
    const blade = [];
    for (let i = 0; i < colors.length / 4; i++) if (Math.abs(colors[i * 4] - steel.r) < 1e-6 && Math.abs(colors[i * 4 + 1] - steel.g) < 1e-6) blade.push(positions.slice(i * 3, i * 3 + 3));
    assert.ok(blade.length > 0);
    assert.ok(blade.every(([x]) => x > .14 && x < .24));
    assert.ok(Math.min(...blade.map(([, y]) => y)) < .15);
  } finally { scene.dispose(); engine.dispose(); }
});

test('walking strides the legs and a sword swing lifts the sword hand to chest height', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const player = createWildsPlayer(scene);
    settle(player);
    const restHand = player.joints.handR.getAbsolutePosition().y;
    player.update({ action: 'walk', speed: 1.5, deltaMs: 250 });
    settle(player);
    assert.ok(Math.abs(player.diagnostics().stride - .25) < 1e-9);
    assert.ok(player.joints.footL.getAbsolutePosition().z < player.joints.footR.getAbsolutePosition().z - .3);
    player.update({ action: 'idle', elapsedMs: 1300, combatAction: { kind: 'attack', comboIndex: 0, startedAt: 1300 - 180 * 1.3, durationMs: 420 } });
    settle(player);
    const swungHand = player.joints.handR.getAbsolutePosition().y;
    assert.ok(restHand < .9 && swungHand > 1.15, `hand ${restHand} -> ${swungHand}`);
    player.update({ action: 'idle', elapsedMs: 5000, combatAction: { kind: 'attack', comboIndex: 0, startedAt: 1300, durationMs: 420 } });
    settle(player);
    assert.ok(Math.abs(player.joints.handR.getAbsolutePosition().y - restHand) < .05);
  } finally { scene.dispose(); engine.dispose(); }
});
