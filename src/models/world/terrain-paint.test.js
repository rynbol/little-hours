import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createTerrainPaint, GROUND_UNIFORMS, GROUND_GLSL, CLOUD_SHADOW, FAR_ROCK } from './terrain-paint.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

test('terrain paint stops wind gusts when still and takes every ground colour from the theme', () => {
  const scene = new Scene(new NullEngine());
  assert.equal(createTerrainPaint(scene).paint._floats.gusts, 1);
  const { paint, setTheme } = createTerrainPaint(scene, { still: true });
  assert.equal(paint._floats.gusts, 0);
  setTheme(WORLD_ATMOSPHERES.rain);
  for (const key of ['grass', 'grassLight', 'grassWarm', 'grassTip', 'grassFar', 'flowerWhite', 'flowerYellow', 'flowerLilac', 'forestFloor', 'rock', 'rockDark', 'dirt', 'sand', 'snow']) {
    assert.ok(GROUND_UNIFORMS.includes(key), key);
    assert.equal(paint._colors3[key].toHexString().toLowerCase(), WORLD_ATMOSPHERES.rain[key], key);
  }
  assert.equal(paint._colors3.rock.toHexString(), '#8A9088');
});

test('dusk rims sun-facing crests in gold on an olive ramp, day barely, rain not at all, and each theme warms its far meadow', () => {
  const { paint, setTheme } = createTerrainPaint(new Scene(new NullEngine()), { still: true });
  const painted = theme => { setTheme(WORLD_ATMOSPHERES[theme]); return [paint._floats.crestGlow, ...['grass', 'grassLight', 'grassTip', 'grassFar'].map(key => paint._colors3[key].toHexString())]; };
  assert.deepEqual(painted('day'), [0.15, '#679A46', '#8BB556', '#C6DBA0', '#E6F848']);
  assert.deepEqual(painted('dusk'), [0.9, '#6E9450', '#A0B468', '#FAE6B0', '#C0C050']);
  assert.deepEqual(painted('rain'), [0, '#7F9A5A', '#93A865', '#94A274', '#7A9050']);
});

test('cloud shadows drift as broad soft patches wider than a hill and darken lit ground by under half', () => {
  assert.deepEqual(CLOUD_SHADOW, { size: 2600, depth: 0.42 });
  assert.ok(GROUND_GLSL.includes(`/ ${CLOUD_SHADOW.size.toFixed(3)} +`));
});

test('rock faces on the middle hills fade toward their grass so they read as soft slopes, not dirty blotches, while the far range keeps its stone', () => {
  assert.deepEqual(FAR_ROCK, { from: 1000, to: 2000, until: 4800, fade: 0.55 });
  assert.ok(GROUND_GLSL.includes(`(1. - ${FAR_ROCK.fade.toFixed(3)} * smoothstep(${FAR_ROCK.from.toFixed(3)}, ${FAR_ROCK.to.toFixed(3)}, dist) * (1. - smoothstep(${(FAR_ROCK.until - 1000).toFixed(3)}, ${FAR_ROCK.until.toFixed(3)}, dist)))`));
});

test('rain lifts the nearer ridges toward a wet light above its sky so they stand off it, day and dusk leave them alone', () => {
  const { paint, setTheme } = createTerrainPaint(new Scene(new NullEngine()), { still: true });
  const lifted = theme => { setTheme(WORLD_ATMOSPHERES[theme]); return [paint._floats.ridgeLift, paint._colors3.ridgeLight.toHexString().toLowerCase()]; };
  assert.deepEqual(['day', 'dusk', 'rain'].map(lifted), [[0, '#bcd0cc'], [0, '#91928c'], [0.45, '#666e5e']]);
  assert.ok(GROUND_UNIFORMS.includes('ridgeLift') && GROUND_UNIFORMS.includes('ridgeLight'));
});

test('ground paint skips the grass grain, the gust sheen, the rock strata and the rock planes wherever their weight has already faded to nothing', () => {
  const skips = ['if (dist < 400.) {\n    float stroke', '(1. - smoothstep(150., 400., dist))', 'if (dist < 1100.) g = mix(g, mix(grassLight, grassTip, .35) * 1.12, smoothstep(.55, .95, groundGust(p)) * (1. - smoothstep(300., 1100., dist))', 'if (steep > 0.) {\n    float layer', 'if (rocky <= 0.) return n;'];
  assert.deepEqual(skips.filter(part => !GROUND_GLSL.includes(part)), []);
});
