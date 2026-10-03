import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, Bone, Group, NumberKeyframeTrack, Scene } from 'three';
import { createAnimatedActor } from './actor.js';

function fixture() {
  const scene = new Group(), bone = new Bone(); bone.name = 'Body'; scene.add(bone);
  return { scene, animations: ['idle', 'walk', 'hit'].map((name, index) => new AnimationClip(name, 1, [new NumberKeyframeTrack('Body.rotation[x]', [0, 1], [index, index + 1])])) };
}
test('actor resets loops on kind changes, blends weights, resamples finite clocks and freezes on zero dt', () => {
  const actor = createAnimatedActor(new Scene(), fixture());
  actor.sample({ clip: 'idle', loop: true }, .05);
  actor.sample({ clip: 'idle', loop: true }, .05);
  assert.equal(actor.diagnostics().time, .1);
  actor.sample({ clip: 'walk', loop: true, rate: 2 }, .05);
  assert.equal(actor.diagnostics().time, .1);
  assert.ok(actor.diagnostics().weights.idle > 0 && actor.diagnostics().weights.walk > 0);
  const before = actor.diagnostics();
  actor.sample({ clip: 'walk', loop: true, rate: 2 }, 0);
  assert.deepEqual(actor.diagnostics(), before);
  actor.sample({ clip: 'hit', token: 1, time: .3 }, .05);
  assert.equal(actor.diagnostics().time, .3);
  actor.sample({ clip: 'hit', token: 1, time: .5 }, 0);
  assert.equal(actor.diagnostics().time, .3);
  actor.sample({ clip: 'hit', token: 2, time: 0 }, .05);
  assert.equal(actor.diagnostics().time, 0);
});
test('actor disposal releases animation references and preserves central scene resource ownership', () => {
  const parent = new Scene(), actor = createAnimatedActor(parent, fixture());
  actor.sample({ clip: 'idle', loop: true }, .05); actor.dispose(); actor.dispose();
  assert.equal(actor.root.parent, parent); assert.equal(actor.diagnostics().playing, false); assert.equal(actor.diagnostics().disposed, true);
  actor.sample({ clip: 'walk', loop: true }, .05); assert.equal(actor.diagnostics().clip, 'idle');
});

test('malformed asset stays attached for central error-path resource collection', () => {
  const parent = new Scene(), gltf = fixture();
  assert.throws(() => createAnimatedActor(parent, gltf, { required: ['missing'] }), /missing clips/);
  assert.equal(parent.children.length, 1); assert.equal(parent.children[0].children[0], gltf.scene);
});
