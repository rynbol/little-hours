import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createWorldSky } from './sky.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const hsv = hex => { const { r, g, b } = Color3.FromHexString(hex), max = Math.max(r, g, b), min = Math.min(r, g, b); return { s: max ? (max - min) / max : 0, v: max }; };

test('the day sky is pale and low in saturation, as BotW measures it', () => {
  for (const key of ['zenith', 'high', 'horizon']) {
    const { s, v } = hsv(WORLD_ATMOSPHERES.day[key]);
    assert.ok(s < 0.3 && v > 0.7, `${key} s${s.toFixed(2)} v${v.toFixed(2)}`);
  }
});

test('dusk is amber at the horizon over a grey-green zenith, and rain is a dim olive grey', () => {
  const dusk = WORLD_ATMOSPHERES.dusk, rain = WORLD_ATMOSPHERES.rain;
  const zenith = Color3.FromHexString(dusk.zenith), horizon = Color3.FromHexString(dusk.horizon);
  assert.ok(horizon.r > horizon.g && horizon.g > horizon.b && horizon.r - horizon.b > 0.3);
  assert.ok(hsv(dusk.zenith).s < 0.12 && zenith.g >= zenith.r);
  for (const key of ['zenith', 'horizon', 'fogFar']) {
    const { r, g, b } = Color3.FromHexString(rain[key]);
    assert.ok(g > r && r > b && g < 0.4, `${key} olive and dim`);
  }
  assert.ok(rain.glowStrength < 0.2 && rain.fogDensity > 2.5 * WORLD_ATMOSPHERES.day.fogDensity);
});

test('the sky dome takes each theme\'s colours and sun', () => {
  const scene = new Scene(new NullEngine()), sky = createWorldSky(scene, new TransformNode('root', scene)), paint = sky.sky.material;
  sky.setTheme(WORLD_ATMOSPHERES.dusk);
  assert.equal(paint._colors3.horizon.toHexString().toLowerCase(), '#fcbe74');
  assert.equal(paint._colors3.zenith.toHexString().toLowerCase(), '#7e8a8c');
  assert.equal(paint._floats.glowStrength, 0.9);
  assert.equal(paint._vectors3.sun.y, WORLD_ATMOSPHERES.dusk.sun[1]);
  sky.setTheme(WORLD_ATMOSPHERES.rain);
  assert.equal(paint._colors3.horizon.toHexString().toLowerCase(), '#555c4c');
  assert.equal(sky.sky.infiniteDistance, true);
  scene.dispose();
});
