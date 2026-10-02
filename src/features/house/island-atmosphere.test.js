import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_ATMOSPHERES, islandSkyArt, skyIsland } from './island-atmosphere.js';

test('every theme gives the cloud collar a lit top and a shaded belly', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ISLAND_ATMOSPHERES).map(([theme, { cloud, cloudShade }]) => [theme, [cloud, cloudShade]])), {
    dusk: ['#c9c3ec', '#6f6ca3'],
    day: ['#ffffff', '#b9cce4'],
    rain: ['#dfe7ea', '#8ea3b1'],
  });
});

test('distant sky islands float in every theme, clear of the moon and sun', () => {
  for (const theme of ['day', 'dusk', 'rain']) {
    const art = islandSkyArt(theme, 1520, 850);
    const islands = [...art.matchAll(/data-sky-island="\d+"[^>]*>(?:<rect[^>]*\/>)?<path d="M([\d.]+) ([\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)]);
    assert.equal(islands.length, 4, theme);
    for (const [x, y] of islands) assert.ok(x > 1520 * .25 && y < 850 * .45, `${theme} island at ${x}, ${y}`);
  }
});

test('a sky island has a flat crown over a hanging keel', () => {
  const ys = [...skyIsland(500, 200, 1, 5).matchAll(/([\d.]+) ([\d.]+)/g)].map(([, , y]) => Number(y));
  assert.equal(ys.length, 26);
  assert.ok(Math.min(...ys) > 200 - 15 && Math.min(...ys) < 200);
  assert.ok(Math.max(...ys) > 250);
});

test('only the day sky casts sun rays', () => {
  assert.deepEqual(['day', 'dusk', 'rain'].map(theme => islandSkyArt(theme, 1200, 800).includes('data-sky="rays"')), [true, false, false]);
});
