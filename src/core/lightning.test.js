import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLightning } from './lightning.js';

const sequence = values => { let i = 0; return () => values[i++ % values.length]; };
const FRAME = 1 / 60;

function run(lightning, seconds, { storming = true, still = false, from = 0, each } = {}) {
  const levels = [];
  for (let t = from; t < from + seconds; t += FRAME) { each?.(t); levels.push([t, lightning.update(t, storming, still)]); }
  return levels;
}

function flashTimes(levels) {
  const peaks = [];
  for (let i = 1; i < levels.length - 1; i++) {
    const [t, level] = levels[i];
    if (level > 0.15 && level >= levels[i - 1][1] && level > levels[i + 1][1]) peaks.push(t);
  }
  return peaks;
}

test('in a storm the first strike comes tens of seconds in, brightens in a moment and fades away again', () => {
  const struck = [], lightning = createLightning({ random: () => 0.5, onStrike: shape => struck.push({ ...shape }) });
  const levels = run(lightning, 40);
  const lit = levels.filter(([, level]) => level > 0.05);
  assert.ok(lit.length > 0, 'a strike lit the sky');
  assert.ok(lit[0][0] > 22 && lit[0][0] < 23, `first light at ${lit[0][0].toFixed(2)} s`);
  assert.ok(Math.max(...levels.map(([, level]) => level)) > 0.9, 'the first flash reaches full strength');
  assert.equal(levels.at(-1)[1], 0, 'the sky is dark again afterwards');
  assert.ok(lit.at(-1)[0] - lit[0][0] < 2.5, `the strike lasts ${(lit.at(-1)[0] - lit[0][0]).toFixed(2)} s`);
  assert.equal(struck.length, 1);
  assert.ok(lightning.thunderDelay > 11 && lightning.thunderDelay < 15, `thunder follows ${lightning.thunderDelay.toFixed(1)} s later`);
});

test('nothing strikes outside the storm or under reduced motion, even when asked', () => {
  for (const [storming, still] of [[false, false], [true, true]]) {
    const lightning = createLightning({ random: () => 0 });
    const levels = run(lightning, 120, { storming, still, each: () => lightning.strike() });
    assert.equal(Math.max(...levels.map(([, level]) => level)), 0, `storming ${storming}, still ${still}`);
  }
});

test('flashes never come faster than three a second, even when strikes are asked for every frame', () => {
  const lightning = createLightning({ random: sequence([0.99, 0, 0, 0, 0, 0.5, 0.5, 0.5]) });
  const peaks = flashTimes(run(lightning, 60, { each: () => lightning.strike() }));
  assert.ok(peaks.length >= 15, `${peaks.length} flashes in a minute of asking`);
  for (let i = 0; i + 3 < peaks.length; i++) assert.ok(peaks[i + 3] - peaks[i] > 1, `four flashes within ${(peaks[i + 3] - peaks[i]).toFixed(2)} s at ${peaks[i].toFixed(2)} s`);
  for (let i = 1; i < peaks.length; i++) assert.ok(peaks[i] - peaks[i - 1] >= 0.33, `flashes ${(peaks[i] - peaks[i - 1]).toFixed(2)} s apart`);
});

test('strikes stay rare when left alone: at most a few in ten minutes', () => {
  const lightning = createLightning({ random: sequence([0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4, 0.6]) });
  const struck = [];
  const levels = run(lightning, 600, { each: () => { if (lightning.active && struck.at(-1) !== lightning.shape.start) struck.push(lightning.shape.start); } });
  assert.ok(struck.length >= 6 && struck.length <= 25, `${struck.length} strikes in ten minutes`);
  for (let i = 1; i < struck.length; i++) assert.ok(struck[i] - struck[i - 1] > 24, `strikes ${(struck[i] - struck[i - 1]).toFixed(1)} s apart`);
  assert.ok(levels.filter(([, level]) => level > 0.05).length / levels.length < 0.05, 'the sky is lit for well under a twentieth of the time');
});

test('back from a hidden tab, a strike that was due long ago does not go off; the next one is rescheduled', () => {
  const lightning = createLightning({ random: () => 0.5 });
  lightning.update(0, true, false);
  assert.ok(lightning.nextAt > 20);
  assert.equal(lightning.update(500, true, false), 0);
  assert.equal(lightning.active, false);
  assert.ok(lightning.nextAt > 520, `next strike at ${lightning.nextAt}`);
});

test('a sun break ends a strike at once and starts the rainbow wait', () => {
  const lightning = createLightning({ random: () => 0.5 });
  lightning.update(0, true, false); lightning.strike();
  lightning.update(1, true, false);
  assert.ok(lightning.update(1.04, true, false) > 0.5);
  assert.equal(lightning.update(1.05, false, false), 0);
  assert.equal(lightning.active, false);
  assert.equal(lightning.idleSince, 1.05);
  assert.equal(lightning.nextAt, null);
});
