import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, hourAt, msAtHour, segmentAt, skyAt, sunDirection, NAMED_HOURS } from './sky-clock.js';

const elevation = direction => Math.asin(direction[1]) * 180 / Math.PI;

test('one day lasts twelve minutes and lingers longest in golden hour', () => {
  assert.equal(DAY_MS, 12 * 60_000);
  assert.equal(hourAt(0), 5);
  assert.equal(hourAt(DAY_MS), 5);
  for (const hour of [5.5, 9, 14.9, 18.4, 23.5, 27]) assert.ok(Math.abs(hourAt(msAtHour(hour)) - hour) < 1e-9, `${hour}`);
  assert.equal(Math.round(hourAt(msAtHour(3.5))), 28);
  const goldenMs = msAtHour(19.2) - msAtHour(18), sameHourAtNoon = msAtHour(13.2) - msAtHour(12);
  assert.ok(goldenMs > 1.5 * sameHourAtNoon);
});

test('the day passes through every named moment in order', () => {
  const seen = [];
  for (let ms = 0; ms < DAY_MS; ms += 2000) { const name = segmentAt(hourAt(ms)); if (seen.at(-1) !== name) seen.push(name); }
  assert.deepEqual(seen, ['pre-dawn', 'dawn', 'morning', 'afternoon', 'shower', 'afternoon', 'golden', 'sunset', 'blue', 'night']);
});

test('the sun arcs from the east through the south and sets low in the west-northwest', () => {
  const noon = sunDirection(12.6), golden = sunDirection(NAMED_HOURS.golden), dawn = sunDirection(6.2);
  assert.ok(elevation(noon) > 50);
  assert.ok(noon[2] < -.3, 'noon sun stands in the south');
  assert.ok(elevation(golden) > 3 && elevation(golden) < 14, `golden ${elevation(golden).toFixed(1)}`);
  assert.ok(golden[0] < -.8, 'golden sun comes from the west');
  assert.ok(dawn[0] > .6, 'dawn sun comes from the east');
  assert.ok(elevation(sunDirection(23)) < -20);
});

test('the moon takes over the key light at night and shadows follow it', () => {
  const night = skyAt(NAMED_HOURS.night), morning = skyAt(NAMED_HOURS.morning);
  assert.equal(night.keyFrom, 'moon');
  assert.deepEqual(night.key.direction, night.moon);
  assert.ok(night.key.direction[1] > .3);
  assert.equal(morning.keyFrom, 'sun');
  assert.ok(night.stars > .9 && morning.stars === 0);
  assert.ok(night.key.intensity < morning.key.intensity / 2);
});

test('the afternoon shower greys and wets the valley, then clears into a rainbow', () => {
  const shower = skyAt(NAMED_HOURS.shower), before = skyAt(13), after = skyAt(16);
  assert.equal(shower.shower, 1);
  assert.equal(before.shower, 0);
  assert.ok(shower.key.intensity < before.key.intensity * .4);
  assert.equal(after.shower, 0);
  assert.ok(after.rainbow > .9);
  assert.ok(after.wet > .1 && after.wet < 1);
  assert.equal(skyAt(18.4).wet, 0);
});

test('golden hour is warm: the key light is more red than blue', () => {
  const golden = skyAt(NAMED_HOURS.golden);
  assert.ok(golden.golden > .9);
  assert.ok(golden.key.color[0] > golden.key.color[2] * 1.8);
});

test('distant air stays cool blue at golden hour while the sun is warm', () => {
  const golden = skyAt(NAMED_HOURS.golden), night = skyAt(NAMED_HOURS.night);
  assert.ok(golden.far[2] > golden.far[0], `far ${golden.far}`);
  assert.ok(golden.key.color[0] > golden.far[0]);
  assert.ok(night.far.every((value, i) => value < golden.far[i] / 2), 'night air is dark');
});
