import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGardenRetreat, buildRoseArch, HEDGE, gardenBlades, gardenGrassy, GARDEN_LAMPS, RETREAT_BOUNDS, RETREAT_LIGHT, RETREAT_SPOTS } from './garden-retreat.js';
import { onGarden, GARDEN_DEPTH } from './garden-ground.js';
import { bladeColors, GRASS_TONES, LANTERN_SPILL } from './house-grass.js';

const rgb = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);

function lights(theme) {
  const lit = [];
  const api = new Proxy({}, { get: (_, name) => (...args) => {
    if (name === 'ball' && args[7] > 1) lit.push({ z: args[2], color: rgb(args[6]).map(value => value * args[7]) });
  } });
  buildGardenRetreat(api, theme);
  return lit;
}

test('the garden lights hang only along the back string, with no lamp posts among the beds', () => {
  const lit = lights('day');
  assert.equal(lit.length, 14);
  assert.ok(lit.every(({ z }) => z === -3.8));
});

test('dusk turns the garden amber: warm low sun, dim lavender sky, glowing bulbs', () => {
  const warmth = hex => { const [r, , b] = rgb(hex); return r - b; };
  assert.ok(warmth(RETREAT_LIGHT.dusk.sun) > warmth(RETREAT_LIGHT.day.sun) + .2);
  assert.ok(RETREAT_LIGHT.dusk.fill < RETREAT_LIGHT.day.fill && RETREAT_LIGHT.dusk.key < RETREAT_LIGHT.day.key);
  for (const { color: [r, g, b] } of lights('dusk')) assert.ok(r > 1.5 && g / r < .6 && b / r < .3, `a dusk bulb reads ${r}, ${g}, ${b}`);
});

test('rain turns the garden grey and dim, cooler than day, with the string lights lit against it', () => {
  const warmth = hex => { const [r, , b] = rgb(hex); return r - b; };
  assert.ok(RETREAT_LIGHT.rain.key < RETREAT_LIGHT.day.key - .25);
  assert.ok(warmth(RETREAT_LIGHT.rain.sun) < 0 && warmth(RETREAT_LIGHT.rain.sky) < 0 && warmth(RETREAT_LIGHT.day.sun) > 0);
  assert.ok(RETREAT_LIGHT.rain.bulb[1] > RETREAT_LIGHT.day.bulb[1]);
});

test('wind grass fills the garden lawn and stays off the beds and out of the air', () => {
  const blades = gardenBlades(), rooted = blades.filter(blade => !blade.drop), fringe = blades.filter(blade => blade.drop);
  assert.ok(rooted.length > 8000 && blades.length < 20000, `${blades.length} blades`);
  assert.deepEqual(blades, gardenBlades());
  for (const { x, z, ground } of rooted) {
    assert.ok(gardenGrassy(x, z) && onGarden(x, z) && ground === 0);
    assert.ok(RETREAT_SPOTS.every(([px, pz]) => Math.hypot(x - px, z - pz) > .5), 'no blade grows in a planting bed');
  }
  assert.ok(fringe.length > 800);
  for (const { x, z, drop } of fringe) assert.ok(drop[1] < 0 && onGarden(x, z, -.05) && !onGarden(x, z, .2));
  assert.ok(!gardenGrassy(40, 0));
});

test('the string lights warm the grass under them at dusk and leave far grass alone', () => {
  assert.equal(GARDEN_LAMPS.length, 6);
  const [lx, lz] = GARDEN_LAMPS[2], blades = [{ x: lx, z: lz + .3, tone: .5, patch: 0 }, { x: lx, z: lz + 6, tone: .5, patch: 0 }];
  const dusk = bladeColors(blades, GRASS_TONES.dusk, LANTERN_SPILL.dusk, GARDEN_LAMPS), unlit = bladeColors(blades, GRASS_TONES.dusk, 0, GARDEN_LAMPS);
  assert.ok(dusk[8] > unlit[8] * 1.5, 'the tip under the lamp is warmer');
  assert.equal(dusk[12 + 8], unlit[12 + 8]);
});

test('the camera frames the garden lawn and the top of its cliff', () => {
  const ys = RETREAT_BOUNDS[0].points.filter((_, i) => i % 3 === 1);
  assert.ok(Math.min(...ys) < -2 && Math.min(...ys) > GARDEN_DEPTH);
});

test('hedges and climbers take the night and rain shade instead of staying daylit', () => {
  const leaves = (build, theme) => { const used = new Set(), api = new Proxy({}, { get: (_, name) => (...args) => { if (name === 'ball' && typeof args[6] === 'string') used.add(args[6]); } }); build(api, theme); return used; };
  for (const build of [buildGardenRetreat, (api, theme) => buildRoseArch(api, theme, 0, 0)]) {
    assert.ok(HEDGE.day.some(hex => leaves(build, 'day').has(hex)));
    for (const theme of ['dusk', 'rain']) {
      const used = leaves(build, theme);
      assert.ok(HEDGE[theme].some(hex => used.has(hex)), `${theme} hedges use the ${theme} shade`);
      assert.ok(HEDGE.day.every(hex => !used.has(hex)), `no daylit hedge is left in ${theme}`);
    }
  }
});
