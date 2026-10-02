import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, SKIES, cloudFrame, planTrip } from './cloud-trip.js';

const SCREEN_CHANGES = [['home', 'island'], ['island', 'garden'], ['garden', 'island'], ['island', 'pond'], ['pond', 'island'], ['island', 'home'], ['garden', 'home'], ['pond', 'home'], ['island', 'forest'], ['forest', 'island'], ['forest', 'home']];

test('every screen change flies through clouds in about a second', () => {
  for (const [from, to] of SCREEN_CHANGES) {
    const plan = planTrip({ from, to, theme: 'day', still: false, seed: .25 });
    assert.equal(plan.kind, 'clouds', `${from} to ${to}`);
    assert.equal(plan.close + plan.part, 1000, `${from} to ${to}`);
    assert.equal(Math.hypot(...plan.heading).toFixed(6), '1.000000', `${from} to ${to}`);
  }
});

test('reduced motion cross-fades quickly with no cloud motion', () => {
  for (const [from, to] of SCREEN_CHANGES) {
    const plan = planTrip({ from, to, theme: 'rain', still: true, seed: .25 });
    assert.deepEqual({ kind: plan.kind, close: plan.close, part: plan.part, heading: plan.heading }, { kind: 'fade', close: 140, part: 200, heading: undefined });
  }
});

test('the clouds travel the way the view moves', () => {
  assert.deepEqual(planTrip({ from: 'home', to: 'island', theme: 'dusk', seed: 0 }).heading, [0, 1]);
  assert.deepEqual(planTrip({ from: 'island', to: 'home', theme: 'dusk', seed: 0 }).heading, [0, -1]);
  const pond = planTrip({ from: 'island', to: 'pond', theme: 'dusk', seed: 0 }).heading, garden = planTrip({ from: 'island', to: 'garden', theme: 'dusk', seed: 0 }).heading;
  assert.ok(pond[0] > 0.8 && garden[0] < -0.8, `${pond} ${garden}`);
  const forest = planTrip({ from: 'island', to: 'forest', theme: 'dusk', seed: 0 }).heading;
  assert.ok(forest[1] > 0.6 && forest[0] > 0, `the forest lies beyond the island, ${forest}`);
  assert.deepEqual(Object.keys(PLACES), ['home', 'island', 'garden', 'pond', 'forest']);
});

test('day, dusk and rain tint the clouds, and an unknown theme falls back to dusk', () => {
  const lit = theme => planTrip({ from: 'home', to: 'island', theme, seed: 0 }).sky.lit;
  assert.deepEqual([lit('day'), lit('dusk'), lit('rain'), lit(undefined)], ['#fffbf3', '#ffdcbc', '#d9e1e1', '#ffdcbc']);
  assert.equal(new Set(Object.values(SKIES).map(sky => sky.shade)).size, 3);
});

test('the clouds close fully before the swap and part to nothing, with no jump between phases', () => {
  const plan = planTrip({ from: 'island', to: 'pond', theme: 'day', seed: .5 });
  assert.equal(cloudFrame(plan, 'closing', 0).cover, 0);
  assert.deepEqual(cloudFrame(plan, 'closing', 1), cloudFrame(plan, 'closed', 0));
  assert.deepEqual(cloudFrame(plan, 'closed', 0), cloudFrame(plan, 'parting', 0));
  assert.equal(cloudFrame(plan, 'closed', 0).cover, 1);
  assert.equal(cloudFrame(plan, 'parting', 1).cover, 0);
  assert.equal(cloudFrame(plan, 'parting', 2).cover, 0);
  const halfway = cloudFrame(plan, 'parting', .5);
  assert.ok(halfway.cover < .5 && halfway.drift[0] > cloudFrame(plan, 'closed', 0).drift[0], JSON.stringify(halfway));
});
