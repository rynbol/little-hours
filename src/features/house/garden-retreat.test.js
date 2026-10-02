import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGardenRetreat, buildRetreatMarkers, buildRoseArch, HEDGE, gardenBlades, gardenGrassy, GARDEN_LAMPS, RETREAT_BOUNDS, RETREAT_LIGHT, RETREAT_SPOTS, retreatFlora } from './garden-retreat.js';
import { BEDS, bedMarker, inBed } from './garden-bed.js';
import { butterflyPath } from './garden-butterflies.js';
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

test('plants stand in their own beds, and only full-grown ones count as blooms', () => {
  const plants = [{ id: 'a', species: 'cosmos', minutes: 50, slot: 0 }, { id: 'b', species: 'lavender', minutes: 10, slot: 3 }, { id: 'c', species: 'sunflower', minutes: 100, slot: null }];
  const flora = retreatFlora(plants, 'day'), count = flora.positions.length / 3;
  assert.equal(flora.sway.length, count * 3); assert.equal(flora.colors.length, count * 4);
  assert.ok(flora.indices.every(index => index < count) && Math.max(...flora.indices) === count - 1);
  for (let i = 0; i < flora.positions.length; i += 3) assert.ok(inBed(flora.positions[i], flora.positions[i + 2], .35, [BEDS[0], BEDS[3]]), 'a plant stays over its bed');
  assert.deepEqual(flora.blooms.map(({ slot, species }) => [slot, species]), [[0, 'cosmos']]);
  assert.ok(flora.blooms[0].at[0] === BEDS[0].x && flora.blooms[0].at[1] > 1 && flora.blooms[0].at[2] === BEDS[0].z);
  assert.equal(retreatFlora([], 'day').positions.length, 0);
});

test('seed markers go only in the beds that are asked for', () => {
  const shapes = [];
  buildRetreatMarkers({ shape: (...args) => shapes.push(args) }, [1, 4], 'day');
  assert.equal(shapes.length, 2);
  [1, 4].forEach((slot, i) => { const [x, z] = bedMarker(BEDS[slot]); assert.ok(Math.hypot(shapes[i][0][0] - x, shapes[i][0][2] - z) < .2); });
});

test('grass tufts crowd the rim of every bed', () => {
  const blades = gardenBlades().filter(blade => !blade.drop);
  BEDS.forEach((bed, slot) => assert.ok(blades.filter(({ x, z, height }) => height >= .2 && inBed(x, z, .14, [bed])).length > 40, `bed ${slot} has no tufts`));
});

test('butterflies drift over the lawn until something blooms, then circle the blooms in turn', () => {
  const idle = butterflyPath(0, 12), blooms = [{ at: [-2, 1.4, -2] }, { at: [3, 2, .2] }];
  assert.deepEqual(butterflyPath(0, 12, []), idle);
  for (const seconds of [0, 3, 9, 15]) { const at = butterflyPath(0, seconds, blooms); assert.ok(Math.hypot(at.x + 2, at.z + 2) < .4 && at.y > 1.4 && at.y < 1.8, `at ${seconds}s`); }
  const later = butterflyPath(0, 24, blooms);
  assert.ok(Math.hypot(later.x - 3, later.z - .2) < .4 && later.y > 2 && later.y < 2.4);
  const hop = butterflyPath(0, 19, blooms);
  assert.ok(hop.x > -1.6 && hop.x < 2.8 && hop.y > 1.6, 'between blooms it flies across');
  for (const index of [0, 1, 2, 3]) assert.ok(Object.values(butterflyPath(index, 7.3, blooms)).every(Number.isFinite));
});
