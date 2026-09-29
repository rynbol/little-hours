import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuddyFlight, TWIRL_SECONDS, EXIT_SECONDS, ARRIVE_SECONDS } from './buddy-flight.js';

const run = (flight, seconds, target, reduced = false) => { const events = []; for (let t = 0; t < seconds; t += 1 / 60) { const pose = flight.update(1 / 60, target, reduced); if (pose.landed) events.push('landed'); if (pose.gone) events.push('gone'); } return events; };
const near = (pose, point, within = 0.02) => Math.hypot(pose.x - point.x, pose.y - point.y, pose.z - point.z) < within;

test('a new target is reached along a raised arc, not a straight line', () => {
  const flight = createBuddyFlight(), home = { x: 0, y: 1, z: 0 }, lamp = { x: 3, y: 1, z: 0 };
  flight.place(home); flight.update(1 / 60, home); flight.go(lamp);
  let highest = 0;
  for (let t = 0; t < 3; t += 1 / 60) highest = Math.max(highest, flight.update(1 / 60, lamp).y);
  assert.ok(highest > 1.2, `peak ${highest}`);
  assert.ok(near(flight.pose, lamp));
});

test('leaving twirls in place, flies to the exit shrinking, then is gone', () => {
  const flight = createBuddyFlight(), home = { x: 0, y: 1, z: 0 }, exit = { x: -3, y: 3, z: -6 };
  flight.place(home); flight.leave(exit);
  run(flight, TWIRL_SECONDS * 0.9, home);
  assert.equal(flight.mode, 'leaving');
  assert.ok(Math.abs(flight.pose.x) < 0.01 && flight.pose.spin > Math.PI * 2, 'twirls on the spot first');
  assert.deepEqual(run(flight, EXIT_SECONDS + 0.5, home), ['gone']);
  assert.equal(flight.mode, 'away');
  assert.equal(flight.pose.visible, false);
});

test('arriving swoops in from outside, lands once and then follows its target', () => {
  const flight = createBuddyFlight(), head = { x: 1, y: 2, z: 0 };
  flight.arrive({ x: -3, y: 3, z: -6 });
  flight.update(1 / 60, head);
  assert.ok(flight.pose.scale < 0.4 && flight.pose.trail, 'starts small with a sparkle trail');
  assert.deepEqual(run(flight, ARRIVE_SECONDS + 1, head), ['landed']);
  assert.equal(flight.mode, 'here');
  assert.ok(near(flight.pose, head));
});

test('with reduced motion Pip jumps straight to where it goes', () => {
  const flight = createBuddyFlight(), head = { x: 1, y: 2, z: 0 };
  flight.arrive({ x: -3, y: 3, z: -6 });
  assert.equal(flight.update(1 / 60, head, true).landed, true);
  assert.ok(near(flight.pose, head, 1e-9));
  flight.leave({ x: -3, y: 3, z: -6 });
  assert.equal(flight.update(1 / 60, head, true).gone, true);
});
