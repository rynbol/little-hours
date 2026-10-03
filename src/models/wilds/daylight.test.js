import test from 'node:test';
import assert from 'node:assert/strict';
import { daylight } from './daylight.js';

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
