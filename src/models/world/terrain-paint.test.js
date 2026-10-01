import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createTerrainPaint, GROUND_UNIFORMS } from './terrain-paint.js';
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
  assert.deepEqual(painted('dusk'), [0.9, '#7A9058', '#ACB474', '#FAE6B0', '#D2BC52']);
  assert.deepEqual(painted('rain'), [0, '#7F9A5A', '#93A865', '#94A274', '#7A9050']);
});
