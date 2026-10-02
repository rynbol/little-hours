import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGardenRetreat, RETREAT_LIGHT } from './garden-retreat.js';

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
