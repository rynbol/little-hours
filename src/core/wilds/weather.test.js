import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weather } from './weather.js';

test('the sky is clear through the morning, golden hour and the night', () => {
  for (const hour of [0, 5, 9, 13, 19.2, 21, 23.5]) assert.deepEqual(weather(hour), { cloud: 0, rain: 0, wet: 0, rainbow: 0 }, `hour ${hour}`);
});

test('a shower passes in the late afternoon and leaves wet ground and a rainbow behind', () => {
  const storm = weather(16.7), after = weather(17.8);
  assert.ok(storm.cloud > 0.95 && storm.rain > 0.95 && storm.wet > 0.95, JSON.stringify(storm));
  assert.equal(storm.rainbow, 0);
  assert.equal(after.rain, 0);
  assert.ok(after.rainbow > 0.95 && after.wet > 0.4 && after.cloud < 0.5, JSON.stringify(after));
});

test('the weather changes gradually and repeats every day', () => {
  let previous = weather(0);
  for (let hour = 0.01; hour < 24; hour += 0.01) {
    const now = weather(hour);
    for (const key of Object.keys(now)) assert.ok(Math.abs(now[key] - previous[key]) < 0.06, `${key} jumps at ${hour.toFixed(2)}`);
    previous = now;
  }
  assert.deepEqual(weather(16.7 + 48), weather(16.7));
  assert.deepEqual(weather(16.7 - 24), weather(16.7));
});
