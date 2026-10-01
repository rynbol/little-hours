import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createWorldSky } from './sky.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';
import { CLOUD_KINDS, cloudCards } from './clouds.js';

const hue = hex => { const { r, g, b } = Color3.FromHexString(hex), max = Math.max(r, g, b), min = Math.min(r, g, b); return ((max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min)) * 60 + 360) % 360; };
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
  const away = Color3.FromHexString(dusk.horizonAway);
  assert.ok(hsv(dusk.horizonAway).s < 0.15 && horizon.r - away.r > 0.2, 'the amber band sits on the sun side only');
  assert.ok(rain.glowStrength < 0.2 && rain.fogDensity > 2 * WORLD_ATMOSPHERES.day.fogDensity);
});

test('far haze is blue-grey in day and dusk, so each ridge steps from green toward blue', () => {
  assert.equal(Math.round(hue(WORLD_ATMOSPHERES.day.fogFar)), 198);
  assert.equal(Math.round(hue(WORLD_ATMOSPHERES.dusk.fogFar)), 209);
  assert.ok(Color3.FromHexString(WORLD_ATMOSPHERES.dusk.fogFar).b < 0.55, 'dusk ridges stay a dark mass');
});

test('the dusk sky above the window is a calm grey-green, not olive beige', () => {
  const high = WORLD_ATMOSPHERES.dusk.high;
  assert.equal(Math.round(hue(high)), 148);
  assert.ok(hsv(high).s < 0.1);
});

test('the day and dusk suns sit low in the window and clear of every cloud at rest', () => {
  const eye = [-2, 2.24, -2.4], clouds = cloudCards().filter(card => card.kind !== CLOUD_KINDS.mist);
  for (const theme of ['day', 'dusk']) {
    const [x, y, z] = WORLD_ATMOSPHERES[theme].sun, heading = Math.atan2(x, -z), elevation = Math.asin(y);
    assert.ok(elevation > 0.15 && elevation < 0.25 && Math.abs(heading) < 0.3, `${theme} sun at ${heading.toFixed(2)}, ${elevation.toFixed(2)}`);
    for (const card of clouds) {
      const out = Math.hypot(card.x - eye[0], card.z - eye[2]), bearing = Math.atan2(card.x - eye[0], -(card.z - eye[2])), up = Math.atan2(card.y - eye[1], out);
      const inside = Math.hypot((bearing - heading) * out / card.halfWidth, (up - elevation) * out / card.halfHeight);
      assert.ok(inside > 1, `${theme} sun behind a cloud ${out.toFixed(0)} m out`);
    }
  }
});

test('the sky dome takes each theme\'s colours and sun', () => {
  const scene = new Scene(new NullEngine()), sky = createWorldSky(scene, new TransformNode('root', scene)), paint = sky.sky.material;
  sky.setTheme(WORLD_ATMOSPHERES.dusk);
  assert.equal(paint._colors3.horizon.toHexString().toLowerCase(), '#fcbe74');
  assert.equal(paint._colors3.zenith.toHexString().toLowerCase(), '#7e8a8c');
  assert.equal(paint._floats.glowStrength, 0.9);
  assert.equal(paint._colors3.horizonAway.toHexString().toLowerCase(), '#a9a496');
  assert.equal(paint._vectors3.sun.y, WORLD_ATMOSPHERES.dusk.sun[1]);
  sky.setTheme(WORLD_ATMOSPHERES.rain);
  assert.equal(paint._colors3.horizon.toHexString().toLowerCase(), '#555c4c');
  assert.equal(sky.sky.infiniteDistance, true);
  scene.dispose();
});
