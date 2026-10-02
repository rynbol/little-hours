import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createTerrainPaint, groundGLSL, GROUND_UNIFORMS, GROUND_GLSL, CLOUD_SHADOW, FAR_ROCK } from './terrain-paint.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

test('the default room terrain shader remains unchanged without shallow basin shoreline painting', () => {
  assert.equal(createHash('sha256').update(GROUND_GLSL).digest('hex'), '2c1fb16ec9e63b76ceef0d87b1bb372c45894de416b7d0f4a8d577323bb7679e');
});

test('a shallow lake paints its bank from surface elevation and broad muted sediment instead of the ellipse distance', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const source = groundGLSL(WILDS_WORLD), bank = source.match(/float bank = ([^;]+);/)[1];
  assert.match(bank, /abs\(y - -10\.0+\)/);
  assert.doesNotMatch(bank, /riverOffset|fine/);
  assert.match(source, /mix\(dirt, sand, \.12 \+ worldNoise\(p \/ 6\.\) \* \.12\) \* \.86/);
  const raised = structuredClone(WILDS_WORLD); raised.water[0].level = 7;
  assert.match(groundGLSL(raised).match(/float bank = ([^;]+);/)[1], /abs\(y - 7\.0+\)/);
});

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
  assert.deepEqual(painted('rain'), [0, '#7F9A5A', '#93A865', '#94A274', '#36442A']);
});

test('cloud shadows drift as broad soft patches wider than a hill and darken lit ground by under half', () => {
  assert.deepEqual(CLOUD_SHADOW, { size: 2600, depth: 0.42 });
  assert.ok(GROUND_GLSL.includes(`/ ${CLOUD_SHADOW.size.toFixed(3)} +`));
});

test('rock faces on the middle hills fade toward their grass so they read as soft slopes, not dirty blotches, while the far range keeps its stone', () => {
  assert.deepEqual(FAR_ROCK, { from: 1000, to: 2000, until: 4800, fade: 0.55 });
  assert.ok(GROUND_GLSL.includes(`(1. - ${FAR_ROCK.fade.toFixed(3)} * smoothstep(${FAR_ROCK.from.toFixed(3)}, ${FAR_ROCK.to.toFixed(3)}, dist) * (1. - smoothstep(${(FAR_ROCK.until - 1000).toFixed(3)}, ${FAR_ROCK.until.toFixed(3)}, dist)))`));
});

test('rain darkens the middle hills below its sky, and the far ranges fade toward a haze between them, so the ranges recede in layers; day and dusk leave them alone', () => {
  const { paint, setTheme } = createTerrainPaint(new Scene(new NullEngine()), { still: true });
  const lifted = theme => { setTheme(WORLD_ATMOSPHERES[theme]); return [paint._floats.ridgeLift, paint._colors3.ridgeLight.toHexString().toLowerCase()]; };
  assert.deepEqual(['day', 'dusk', 'rain'].map(lifted), [[0, '#bcd0cc'], [0, '#91928c'], [0.65, '#363d31']]);
  const rain = WORLD_ATMOSPHERES.rain, luma = hex => { const { r, g, b } = Color3.FromHexString(hex); return 0.299 * r + 0.587 * g + 0.114 * b; };
  assert.ok(luma(rain.ridgeLight) < luma(rain.fogFar) * 0.85 && luma(rain.fogFar) < luma(rain.high), 'hill bodies sit darker than the far haze, which sits darker than the sky');
  assert.ok(luma(rain.grassFar) < luma(rain.fogFar), 'far meadows under the rain are darker than the haze they fade into');
  for (const key of ['ridgeLight', 'fogFar', 'grassFar']) { const { r, g, b } = Color3.FromHexString(rain[key]); assert.ok(g > r && r > b, `${key} stays olive`); }
  assert.ok(GROUND_UNIFORMS.includes('ridgeLift') && GROUND_UNIFORMS.includes('ridgeLight'));
});

test('ground paint skips the grass grain, the gust sheen, the rock strata and the rock planes wherever their weight has already faded to nothing', () => {
  const skips = ['if (dist < 400.) {\n    float stroke', '(1. - smoothstep(150., 400., dist))', 'if (dist < 1100.) g = mix(g, mix(grassLight, grassTip, .35) * 1.12, smoothstep(.55, .95, groundGust(p)) * (1. - smoothstep(300., 1100., dist))', 'if (steep > 0.) {\n    float layer', 'if (rocky <= 0.) return n;'];
  assert.deepEqual(skips.filter(part => !GROUND_GLSL.includes(part)), []);
});

test('a serialized route and water body change the shared terrain shader without changing room defaults', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const { groundGLSL } = await import('./terrain-paint.js');
  const scene = new Scene(new NullEngine()), wilds = createTerrainPaint(scene, { definition: WILDS_WORLD }), room = createTerrainPaint(scene);
  assert.equal(groundGLSL(), GROUND_GLSL);
  assert.ok(room.paint.shaderPath.fragmentSource.includes('sin(ahead / 13.) * 3.'));
  assert.ok(wilds.paint.shaderPath.fragmentSource.includes('sin(ahead / 32.000 + 0.000) * 3.800'));
  assert.ok(wilds.paint.shaderPath.fragmentSource.includes('vec2(25.000, -410.000)'));
  assert.ok(!wilds.paint.shaderPath.fragmentSource.includes('sin(ahead / 13.) * 3.'));
  scene.dispose();
});

test('ground contact shading is opt-in and exposes a soft radius instead of a floating decal', () => {
  const scene = new Scene(new NullEngine()), ground = createTerrainPaint(scene);
  assert.deepEqual(ground.paint._vectors4.contactShadow.asArray(), [0, 0, 1, 0]);
  ground.setContactShadow(3, -4, 0.7, 0.28);
  assert.deepEqual(ground.paint._vectors4.contactShadow.asArray(), [3, -4, 0.7, 0.28]);
  assert.ok(ground.paint.shaderPath.fragmentSource.includes('color *= contactShade(vWorld.xz)'));
  assert.equal(scene.meshes.length, 0);
  scene.dispose();
});

test('serialized trail paint uses the same rounded endpoint distances at either end and at different widths', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const smoothstep = (low, high, value) => { const t = Math.max(0, Math.min(1, (value - low) / (high - low))); return t * t * (3 - 2 * t); };
  for (const [width, expected] of [[1.4, [0, 0, 3, 5, 5]], [2.8, [0, 0, 1.5, 2.5, 2.5]]]) {
    const definition = { ...WILDS_WORLD, path: { start: 0, end: 10, offset: 0, drift: 0, width, waves: [] } };
    const body = groundGLSL(definition).match(/float pathOffset\(vec2 p\) \{([^}]+)\}/)[1].replace(/\bfloat\b/g, 'let');
    const evaluate = new Function('p', 'abs', 'sin', 'smoothstep', 'clamp', 'length', 'vec2', body);
    const distances = [[0, 0], [0, -10], [3, -5], [3, 4], [3, -14]].map(([x, z]) => evaluate({ x, y: z }, Math.abs, Math.sin, smoothstep, (value, low, high) => Math.max(low, Math.min(high, value)), values => Math.hypot(...values), (...values) => values));
    assert.deepEqual(distances, expected);
  }
});

test('Wilds hill paint ends the wind sheen before the distant skyline', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const source = groundGLSL(WILDS_WORLD), sheen = source.split('\n').find(line => line.includes('g = mix(g, mix(grassLight, grassTip'));
  const smoothstep = (low, high, value) => { const t = Math.max(0, Math.min(1, (value - low) / (high - low))); return t * t * (3 - 2 * t); };
  const evaluate = new Function('dist', 'canopy', 'gust', 'smoothstep', 'mix', `let g = 0; const grassLight = 1, grassTip = 1, p = 0, groundGust = () => gust; ${sheen} return g;`);
  const contribution = (distance, gust = 1, canopy = 0) => evaluate(distance, canopy, gust, smoothstep, (a, b, t) => a + (b - a) * t);
  for (const distance of [300, 500, 750, 1000]) assert.equal(contribution(distance), 0, `distant gust contribution at ${distance} m`);
  let previous = Infinity;
  for (const distance of [0, 25, 75, 125, 175, 225]) {
    const amount = contribution(distance);
    assert.ok(amount > 0 && amount <= .12, `near gust contribution ${amount} at ${distance} m`);
    assert.ok(amount <= previous, `gust influence increases with distance at ${distance} m`);
    assert.equal(contribution(distance, 0), 0);
    assert.equal(contribution(distance, 1, 1), 0);
    previous = amount;
  }
});
