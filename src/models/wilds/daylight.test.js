import test from 'node:test';
import assert from 'node:assert/strict';
import { DAWN, DUSK, daylight } from './daylight.js';

test('morning light comes from the east, high enough to cast short shadows, with no stars', () => {
  const light = daylight(9);
  assert.ok(light.toward.x > 0.5 && light.toward.y > 0.35, `toward ${light.toward.toArray()}`);
  assert.equal(light.night, 0);
  assert.ok(light.strength > 2.4);
});

test('golden hour is low warm light from the west', () => {
  const light = daylight(19.3);
  assert.ok(light.toward.x < -0.8 && light.toward.y > 0.1 && light.toward.y < 0.35, `toward ${light.toward.toArray()}`);
  assert.ok(light.light.r > light.light.b * 1.6, 'warm key light');
  assert.ok(light.night < 0.05);
});

test('night is blue moonlight from above, dimmer than noon but bright enough to fight by', () => {
  const light = daylight(23), noon = daylight(13);
  assert.equal(light.night, 1);
  assert.ok(light.toward.y > 0.4, `moon ${light.toward.toArray()}`);
  assert.ok(light.light.b > light.light.r && light.strength < noon.strength * 0.5);
  assert.ok(light.fill > 1 && light.sky.b > 0.5, `fill ${light.fill}, sky ${light.sky.getHexString()}`);
});

test('the day wraps smoothly across midnight', () => {
  const before = daylight(23.99), after = daylight(0.01);
  assert.ok(Math.abs(before.strength - after.strength) < 0.01);
  assert.ok(Math.abs(before.zenith.b - after.zenith.b) < 0.01 && Math.abs(before.exposure - after.exposure) < 0.01);
});

test('the sun rises at dawn, arcs overhead and sets at dusk, and the moon keys the night', () => {
  for (let hour = 0; hour < 24; hour += 0.25) {
    const light = daylight(hour), up = light.sun.y > 0;
    if (hour > DAWN + 0.05 && hour < DUSK - 0.05) assert.ok(up, `sun below the horizon at ${hour}`);
    if (hour < DAWN - 0.05 || hour > DUSK + 0.05) assert.ok(!up, `sun above the horizon at ${hour}`);
  }
  assert.ok(daylight((DAWN + DUSK) / 2).sun.y > 0.8);
  assert.ok(daylight(1).toward.dot(daylight(1).moon) > 0.99 && daylight(13).toward.dot(daylight(13).sun) > 0.99);
});

test('the afternoon shower greys the sky, softens the sun and thickens the haze', () => {
  const storm = daylight(16.7), clear = daylight(15), saturation = colour => colour.getHSL({}).s;
  assert.ok(storm.rain > 0.95 && clear.rain === 0);
  assert.ok(storm.strength < clear.strength * 0.4, `sun ${storm.strength} vs ${clear.strength}`);
  assert.ok(saturation(storm.zenith) < saturation(clear.zenith) * 0.5);
  assert.ok(storm.haze > clear.haze * 1.6 && storm.fill > clear.fill);
});
