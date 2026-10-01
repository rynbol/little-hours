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
  for (const key of ['grass', 'grassLight', 'grassWarm', 'forestFloor', 'rock', 'rockDark', 'dirt', 'sand', 'snow']) {
    assert.ok(GROUND_UNIFORMS.includes(key), key);
    assert.equal(paint._colors3[key].toHexString().toLowerCase(), WORLD_ATMOSPHERES.rain[key], key);
  }
  assert.equal(paint._colors3.rock.toHexString(), '#8A9088');
});
