import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createWildsPlayer } from './player.js';

test('placeholder player is a plain 1.7 metre capsule grounded at its root and released on disposal', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const player = createWildsPlayer(scene), body = scene.getMeshByName('wilds-player-placeholder');
    body.computeWorldMatrix(true);
    const bounds = body.getBoundingInfo().boundingBox;
    assert.ok(Math.abs(bounds.minimumWorld.y) < .00001);
    assert.ok(Math.abs(bounds.maximumWorld.y - 1.7) < .00001);
    assert.equal(scene.meshes.length, 1);
    assert.equal(scene.skeletons.length, 0);
    assert.equal(scene.animationGroups.length, 0);
    player.root.position.set(10, 4, -3);
    player.update({ action: 'attack', yaw: 1.2 });
    assert.equal(player.root.rotation.y, 1.2);
    assert.deepEqual(player.root.position.asArray(), [10, 4, -3]);
    assert.equal(player.diagnostics().placeholder, true);
    player.dispose(); player.dispose();
    assert.equal(scene.meshes.length, 0);
    assert.equal(scene.materials.length, 0);
  } finally { scene.dispose(); engine.dispose(); }
});
