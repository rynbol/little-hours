import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIFF_LIGHT, shadeBody, spire, strataBody, strataSteps } from './landform.js';

test('a cliff keeps its day colours by day and turns darker and bluer at dusk, with rain in between', () => {
  const body = spire({ x: 0, z: 0, top: -1, length: 2, radius: 1, colors: ['#8f8584', '#7a7579', '#6b686f'] });
  assert.deepEqual(shadeBody(body, 'day').colors, body.colors);
  assert.deepEqual(shadeBody(body, 'unknown').colors, body.colors);
  const dusk = shadeBody(body, 'dusk'), rain = shadeBody(body, 'rain');
  assert.equal(dusk.positions, body.positions);
  for (let i = 0; i < body.colors.length; i += 4) {
    assert.ok(Math.abs(dusk.colors[i] - body.colors[i] * CLIFF_LIGHT.dusk[0]) < 1e-9 && Math.abs(dusk.colors[i + 2] - body.colors[i + 2] * CLIFF_LIGHT.dusk[2]) < 1e-9);
    assert.ok(dusk.colors[i] < rain.colors[i] && rain.colors[i] < body.colors[i]);
    assert.ok(dusk.colors[i + 2] / dusk.colors[i] > body.colors[i + 2] / body.colors[i] * 1.3, 'dusk leans blue');
    assert.equal(dusk.colors[i + 3], 1);
  }
});

test('a strata body narrows ring by ring from its edge down to a single keel point', () => {
  const body = strataBody({ edge: a => [Math.cos(a) * 5, Math.sin(a) * 5], segments: 24, strata: strataSteps(-.2, -4), keel: [0, 0, -4] });
  const rows = body.positions.length / 3 / 24, reach = row => Math.max(...Array.from({ length: 24 }, (_, j) => Math.hypot(body.positions[(row * 24 + j) * 3], body.positions[(row * 24 + j) * 3 + 2])));
  assert.ok(reach(0) > 4.8 && reach(0) < 5.2);
  assert.ok(reach(rows - 2) < reach(Math.floor(rows / 2)) && reach(Math.floor(rows / 2)) < reach(0));
  assert.equal(reach(rows - 1), 0);
  assert.equal(body.positions[(rows - 1) * 24 * 3 + 1], -4);
});
