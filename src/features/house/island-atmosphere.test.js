import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_ATMOSPHERES, islandSkyArt, skyIsland, SKY_ISLAND_PAINT } from './island-atmosphere.js';

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

test('the sky art is well-formed SVG so postcards can decode it', () => {
  for (const theme of ['day', 'dusk', 'rain']) for (const tag of islandSkyArt(theme, 1520, 850).match(/<[a-zA-Z][^>]*>/g)) {
    assert.equal(tag.replace(/^<[\w-]+/, '').replace(/\s[\w:-]+="[^"]*"/g, '').replace(/\/?>$/, '').trim(), '', `${theme} ${tag.slice(0, 80)}`);
  }
});

test('only the day sky casts sun rays', () => {
  assert.deepEqual(['day', 'dusk', 'rain'].map(theme => islandSkyArt(theme, 1200, 800).includes('data-sky="rays"')), [true, false, false]);
});

test('each sky island wears a grass cap over banded, side-shaded rock that holds up at dusk and in rain', () => {
  const light = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return .299 * r + .587 * g + .114 * b; };
  for (const theme of ['day', 'dusk', 'rain']) {
    const art = islandSkyArt(theme, 1520, 850), paint = SKY_ISLAND_PAINT[theme];
    assert.equal((art.match(/data-sky-cap/g) || []).length, 4, theme);
    assert.ok(art.includes('id="island-sky-rock"') && art.includes('id="island-sky-side"'), theme);
    assert.ok(new Set(paint.rock).size >= 4, `${theme} rock has no strata`);
    assert.ok(light(paint.lit) - light(paint.rock.at(-1)) > .12, `${theme} grass does not stand off the rock`);
    const opacities = [...art.matchAll(/data-sky-island="\d+" opacity="([\d.]+)"/g)].map(([, o]) => Number(o));
    assert.ok(opacities.every(o => o >= .8), `${theme} islands fade out: ${opacities}`);
  }
});

test('each cloud bank fades out at its base, with no hard cut line across the sky', () => {
  for (const theme of ['day', 'dusk', 'rain']) {
    const art = islandSkyArt(theme, 1440, 1000);
    assert.equal(art.includes('clipPath'), false, `${theme} cuts a cloud on a straight line`);
    assert.equal(art.match(/<mask id="island-bank-\d+"><rect [^>]*fill="url\(#island-bank-fade\)"/g)?.length, 4);
    assert.match(art, /<linearGradient id="island-bank-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="\.62" stop-color="#fff"\/><stop offset="1" stop-color="#000"\/>/);
  }
});
