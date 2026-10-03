import test from 'node:test';
import assert from 'node:assert/strict';
import { RANGER_JOINTS, rangerPose } from './ranger-pose.js';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected}`);

test('the ranger stands still at rest with every joint posed', () => {
  const pose = rangerPose();
  assert.deepEqual(Object.keys(pose).filter(key => key !== 'lift'), RANGER_JOINTS);
  assert.equal(pose.lift, 0);
  near(pose.thighL[0], 0); near(pose.thighR[0], 0);
  near(pose.upperArmL[2], -.16); near(pose.upperArmR[2], .16);
});

test('walking swings the legs against each other and running leans further forward', () => {
  const walk = rangerPose({ action: 'walk', stride: .25 }), run = rangerPose({ action: 'run', stride: .25 });
  near(walk.thighL[0], .5); near(walk.thighR[0], -.5);
  near(run.thighL[0], .85); near(run.thighR[0], -.85);
  near(walk.upperArmL[0], -.4);
  near(walk.chest[0], -.04); near(run.chest[0], -.13);
  const later = rangerPose({ action: 'walk', stride: .75 });
  near(later.thighL[0], -.5); near(later.thighR[0], .5);
});

test('each sword swing winds up one way, cuts across the other and settles back', () => {
  const first = progress => rangerPose({ combat: { kind: 'attack', comboIndex: 0, progress } });
  const windUp = first(180 / 420 * .7), cut = first(180 / 420 * 1.3), settled = first(1);
  near(windUp.chest[1], -.9 * .65); near(cut.chest[1], .65);
  near(windUp.upperArmR[0], 1.35); near(cut.upperArmR[0], 1.45);
  near(settled.chest[1], 0); near(settled.upperArmR[0], 0);
  const overhead = progress => rangerPose({ combat: { kind: 'attack', comboIndex: 2, progress } });
  near(overhead(300 / 620 * .7).upperArmR[0], 3);
  near(overhead(300 / 620 * 1.3).upperArmR[0], .55);
  near(overhead(300 / 620 * 1.3).lift, -.16);
});

test('the dodge is one forward roll that tucks low halfway through', () => {
  const roll = progress => rangerPose({ combat: { kind: 'dodge', progress } });
  near(roll(0).hips[0], 0);
  near(roll(.5).hips[0], -Math.PI);
  near(roll(1).hips[0], -Math.PI * 2);
  near(roll(.5).lift, -.38);
  near(roll(.5).thighL[0], 1.7);
});

test('jumping throws the arms out, landing crouches and combat outranks movement', () => {
  const jump = rangerPose({ action: 'jump' });
  near(jump.upperArmL[2], -1.1); near(jump.upperArmR[2], 1); near(jump.thighL[0], .9);
  near(rangerPose({ action: 'land' }).lift, -.14);
  const swingWhileRunning = rangerPose({ action: 'run', stride: .25, combat: { kind: 'attack', comboIndex: 0, progress: 180 / 420 * 1.3 } });
  near(swingWhileRunning.upperArmR[0], 1.45);
});
