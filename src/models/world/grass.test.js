import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWorldGrass, createGroundGrid, grassBlades, surfaceAt, GRASS } from './grass.js';
import { MEADOW_ROCKS, rockClearings } from './rocks.js';
import { heightAt } from '../../core/world-terrain.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} vs ${expected}`);

test('grass roots sit on the rendered terrain triangles, not the analytic height', () => {
  close(surfaceAt(40, -40), heightAt(40, -40), 'grid vertex');
  close(surfaceAt(41, -39.5), -9.707714352, 'lower triangle');
  const corner = heightAt(40, -40);
  close(surfaceAt(41, -39.5), corner + (heightAt(42, -40) - corner) * 0.5 + (heightAt(40, -38) - corner) * 0.25, 'lower triangle plane');
  assert.ok(Math.abs(surfaceAt(41, -39.5) - heightAt(41, -39.5)) > 1e-4);
  close(surfaceAt(41.5, -38.5), -9.636919943, 'upper triangle');
  assert.equal(surfaceAt(0, 0), 0);
  for (const [x, z] of [[3008, -3008], [-4032, -5056], [4480, 1984]]) close(surfaceAt(x, z), heightAt(x, z), `vertex of the 64 m ring at ${x}, ${z}`);
});

test('the ground grid recentres on the camera and reuses texels it already holds', () => {
  const moved = createGroundGrid({ texels: 5, step: 2 });
  assert.equal(moved.centre(0, 0), true);
  assert.deepEqual(moved.origin, [-4, -4]);
  assert.equal(moved.centre(0.9, 0.9), false);
  assert.equal(moved.centre(30, -52), true);
  assert.deepEqual(moved.origin, [26, -56]);
  assert.equal(moved.centre(33, -52), true);
  const fresh = createGroundGrid({ texels: 5, step: 2 });
  fresh.centre(33, -52);
  assert.deepEqual(moved.origin, fresh.origin);
  assert.deepEqual(moved.data, fresh.data);
  assert.deepEqual(Array.from(fresh.data.slice(0, 4), value => Math.round(value * 1e3) / 1e3), [0.062, 0.994, -0.089, -10.528]);
});

test('three blade layers tile their own periods with five vertices and three triangles each', () => {
  const { positions, blade, indices } = grassBlades();
  assert.equal(positions.length / 3, 440000);
  assert.equal(indices.length, 792000);
  const reach = [0, 0, 0];
  for (let v = 0; v < positions.length / 3; v++) {
    const layer = blade[v * 4 + 3];
    reach[layer] = Math.max(reach[layer], positions[v * 3], positions[v * 3 + 2]);
  }
  assert.deepEqual(reach.map(Math.ceil), [16, 48, 160]);
  assert.deepEqual(Array.from(positions.slice(1, 15).filter((_, i) => i % 3 === 0)), [0, 0, 0.5, 0.5, 1]);
});

test('default window grass retains its original geometry and blade attributes', () => {
  const mesh = grassBlades(), hash = createHash('sha256');
  for (const key of ['positions', 'blade', 'indices']) hash.update(Buffer.from(mesh[key].buffer));
  assert.equal(hash.digest('hex'), 'e43638629a3fab65f1d126e1c7246ccca748199bdc86e5e0384663b679eaa511');
});

test('tuft grass grows in small groups with narrow roots and tapered curved tips', () => {
  const mesh = grassBlades([{ period: 16, blades: 300, tuft: true }]);
  assert.equal(mesh.positions.length / 3, 2100);
  assert.equal(mesh.indices.length / 3, 1500);
  const roots = [];
  for (let v = 0; v < mesh.positions.length / 3; v += 7) {
    roots.push([mesh.positions[v * 3], mesh.positions[v * 3 + 2]]);
    assert.ok(Math.abs(mesh.blade[v * 4]) < Math.abs(mesh.blade[(v + 2) * 4]) / 2);
    assert.ok(Math.abs(mesh.blade[(v + 4) * 4]) < Math.abs(mesh.blade[(v + 2) * 4]) / 2);
    assert.equal(mesh.blade[(v + 6) * 4], 0);
    assert.equal(mesh.positions[(v + 6) * 3 + 1], 1);
  }
  const clustered = roots.filter(([x, z], i) => roots.some(([qx, qz], j) => i !== j && Math.hypot(x - qx, z - qz) < 0.44));
  assert.ok(clustered.length > 285, `${clustered.length}/300 roots have another blade within 44 cm`);
  assert.deepEqual(grassBlades([{ period: 16, blades: 300, tuft: true }]), mesh);
});

test('defined grass narrows its coarse layers beside the camera and spreads its tip lean', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene), blades = grassBlades([{ period: 16, blades: 3, tuft: true }]);
  const grass = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true, blades, definition: WILDS_WORLD });
  assert.deepEqual(grass.mesh.material._vectors4.bladeForm.asArray(), [0.24, 0.58, 0.3, 0.17]);
  const legacy = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true, blades });
  assert.deepEqual(legacy.mesh.material._vectors4.bladeForm.asArray(), [1, 1, 0.16, 0.34]);
  assert.equal(grass.mesh.getTotalVertices(), 21);
  scene.dispose();
});

test('the defined hearth clears a resting apron and keeps the legacy room grass unchanged', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene), blades = grassBlades([{ period: 16, blades: 3 }]);
  const grass = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true, blades, definition: WILDS_WORLD });
  assert.deepEqual(grass.mesh.material._vectors4.hearthClearing.asArray(), [-5, 3, 3.7, 5.7]);
  const legacy = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true, blades });
  assert.deepEqual(legacy.mesh.material._vectors4.hearthClearing.asArray(), [0, 0, 0, 0]);
  scene.dispose();
});

test('world grass follows the camera in steps, takes the theme and stays still when asked', () => {
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene), camera = new FreeCamera('eye', new Vector3(0, 2, 0), scene);
  const grass = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true });
  assert.equal(grass.mesh.getTotalVertices(), 440000);
  assert.deepEqual(grass.origin, [-88, -88]);
  assert.equal(grass.follow(7, -7), false);
  assert.equal(grass.follow(9, 0), true);
  assert.deepEqual(grass.origin, [-78, -88]);
  const paint = grass.mesh.material;
  assert.equal(paint._floats.gusts, 0);
  assert.equal(paint._floats.goldenHour, 0);
  grass.setTheme(WORLD_ATMOSPHERES.dusk);
  assert.equal(paint._floats.goldenHour, 1);
  for (const key of ['grassLight', 'flowerWhite', 'flowerYellow', 'flowerLilac']) assert.equal(paint._colors3[key].toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk[key], key);
  assert.equal(grass.rocks.material._colors3.rock.toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk.rock);
  camera.position.set(60, 2, -60);
  scene.render();
  assert.deepEqual(grass.origin, [-28, -148]);
  grass.mesh.dispose();
  camera.position.set(200, 2, -60);
  scene.render();
  assert.deepEqual(grass.origin, [-28, -148]);
});

test('world grass draws the blades it is handed, so the window world can build them in a worker', () => {
  const scene = new Scene(new NullEngine()), blades = grassBlades([{ period: 16, blades: 3, reach: 8, width: 0.022, height: 0.55 }]);
  const grass = createWorldGrass(scene, { root: new TransformNode('world', scene), atmosphere: WORLD_ATMOSPHERES.day, still: true, blades });
  assert.equal(grass.mesh.getTotalVertices(), 15);
});

test('the height grid covers the outermost blades however far the camera drifts before it recentres', () => {
  const scene = new Scene(new NullEngine()), grass = createWorldGrass(scene, { root: new TransformNode('world', scene), atmosphere: WORLD_ATMOSPHERES.day, still: true });
  const reach = Math.max(...GRASS.layers.map(layer => layer.reach)), span = (GRASS.texels - 1) * GRASS.step;
  for (const [x, z] of [[GRASS.recentre, 0], [0, -GRASS.recentre], [-GRASS.recentre, GRASS.recentre]]) {
    grass.follow(x, z);
    const [ox, oz] = grass.origin;
    assert.ok(ox <= x - reach && ox + span >= x + reach && oz <= z - reach && oz + span >= z + reach, `grid ${ox}, ${oz} misses blades round ${x}, ${z}`);
  }
});

test('grass leaves a bare ring round each meadow rock', () => {
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene);
  new FreeCamera('eye', new Vector3(0, 2, 0), scene);
  const paint = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true }).mesh.material;
  assert.equal(paint._vectors4Arrays.stones.length, MEADOW_ROCKS.length * 4);
  assert.deepEqual(paint._vectors4Arrays.stones, rockClearings());
  assert.deepEqual(rockClearings().filter((_, i) => i % 4 === 2).map(radius => Math.round(radius * 100) / 100), [1.2, 0.5, 0.55, 0.69, 0.94, 0.49, 1.11]);
});

test('a supplied rendered surface grounds grass texels and invalidates them when rings change', () => {
  let lift = 9;
  const grid = createGroundGrid({ texels: 3, step: 2, sample: (x, z) => x * 2 + z * 3 + lift });
  grid.centre(0, 0);
  assert.equal(grid.data[19], 9);
  assert.equal(grid.centre(0, 0), false);
  lift = 20;
  assert.equal(grid.centre(0, 0, true), true);
  assert.equal(grid.data[19], 20);
  grid.centre(6, -4);
  assert.equal(grid.data[19], 20);
});

test('defined grass shares its route shader and rendered surface with terrain and rocks', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const { buildGrassBlades } = await import('./grass-blades.js');
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene);
  const blades = await buildGrassBlades({ workers: false, layers: [{ period: 16, blades: 3 }] });
  const grass = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true, blades, definition: WILDS_WORLD, surface: (x, z) => ({ height: 40 + x * 0.01, normal: { x: 0, y: 1, z: 0 } }) });
  assert.equal(grass.mesh.getTotalVertices(), 15);
  assert.ok(grass.mesh.material.shaderPath.vertexSource.includes('sin(ahead / 32.000'));
  assert.ok(!grass.mesh.material.shaderPath.vertexSource.includes('step(abs(base.x), 6.60)'));
  assert.equal(grass.mesh.material._vectors4Arrays.stones[0], 5.5);
  assert.ok(grass.rocks.getVerticesData('position')[1] > 39);
  scene.dispose();
});

test('fen grass growth follows the sampled shore elevation as the water level changes', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene), blades = grassBlades([{ period: 16, blades: 3 }]);
  const smoothstep = (low, high, value) => { const t = Math.max(0, Math.min(1, (value - low) / (high - low))); return t * t * (3 - 2 * t); };
  const scalar = expression => expression.replace(/length\(\((?:base|p) - vec2\(([^)]+)\)\) \/ vec2\(([^)]+)\)\)/g, 'ellipse($1, $2)').replace(/worldNoise\([^)]*\)/g, 'noise');
  const samples = [];
  for (const level of [-10, 7, 23]) {
    const definition = structuredClone(WILDS_WORLD); definition.water[0].level = level;
    const grass = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true, blades, definition });
    const source = grass.mesh.material.shaderPath.vertexSource, body = definition.water[0];
    const line = source.split('\n').find(value => value.includes('grow *= smoothstep(.76'));
    const evaluate = new Function('surface', 'n', 'base', 'noise', 'mix', 'smoothstep', 'ellipse', 'riverOffset', `return ${scalar(line.split('*=')[1])}`);
    const river = new Function('ellipse', 'min', scalar(source.match(/float riverOffset\(vec2 p\) \{([^}]+)\}/)[1]));
    for (const reach of [.5, .97]) for (const noise of [0, .5, 1]) {
      const base = { x: body.x + body.radiusX * reach, y: body.z }, ellipse = (x, z, rx, rz) => Math.hypot((base.x - x) / rx, (base.y - z) / rz);
      const grow = height => evaluate({ w: height }, { y: 1 }, base, noise, (a, b, t) => a + (b - a) * t, smoothstep, ellipse, () => river(ellipse, Math.min));
      assert.equal(grow(level - .2), 0, `underwater growth at water level ${level}, reach ${reach}`);
      assert.equal(grow(level), 0, `growth on the water plane at level ${level}`);
      const shore = grow(level + .4);
      assert.ok(shore > 0 && shore < 1, `shore growth ${shore} at water level ${level}`);
      assert.equal(grow(level + 2), 1, `dry growth at water level ${level}`);
      samples.push(shore);
    }
  }
  for (let i = 6; i < samples.length; i++) close(samples[i], samples[i % 6], 'translated water level retains the same shore gradient');
  scene.dispose();
});
