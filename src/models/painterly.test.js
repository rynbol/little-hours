import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import { PAINTERLY_LOOKS, PAINTERLY_SOFTNESS, createPainterly } from './painterly.js';
import { createStorybook } from './storybook.js';
import { ISLAND_ATMOSPHERES, ISLAND_SUN } from '../features/house/island-atmosphere.js';
import { ROOM_LIGHTS } from '../features/room/room-lighting.js';

test('outdoor faces turned from the sun fall below the painterly terminator', () => {
  for (const theme of ['day', 'dusk', 'rain']) {
    const [start, end] = PAINTERLY_LOOKS[theme].band;
    assert.ok(start > ISLAND_ATMOSPHERES[theme].fill, `${theme} fill light alone reads as sunlit`);
    assert.ok(end < ISLAND_ATMOSPHERES[theme].fill + ISLAND_ATMOSPHERES[theme].key, `${theme} sun never fully lights a face`);
  }
});

test('cast shadows fall below the terminator and the cottage front stays sunlit', () => {
  const [x, y, z] = ISLAND_SUN.direction, frontFacing = -z / Math.hypot(x, y, z);
  for (const theme of ['day', 'dusk']) {
    const { fill, key } = ISLAND_ATMOSPHERES[theme], [start, end] = PAINTERLY_LOOKS[theme].band;
    assert.ok(fill + key * ISLAND_SUN.darkness < start, `${theme} shadows read as sunlit`);
    assert.ok(fill + key * frontFacing > end, `${theme} front wall sits on the terminator`);
  }
  assert.ok(ISLAND_ATMOSPHERES.rain.fill + ISLAND_ATMOSPHERES.rain.key * ISLAND_SUN.darkness < PAINTERLY_LOOKS.rain.band[0], 'rain shadows read as sunlit');
});

test('in the room, ambient light alone reads as shade and window sun reads as lit', () => {
  const brightest = hex => Math.max(...[1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255));
  for (const [theme, { ambient, sky, sun, darkness }] of Object.entries(ROOM_LIGHTS)) {
    const [start, end] = PAINTERLY_LOOKS[`room-${theme}`].band, shade = ambient * brightest(sky);
    assert.ok(shade + sun * darkness < start, `${theme} room shade reads as sunlit`);
    assert.ok(shade + sun * .5 > end, `${theme} room sunlight never reads as lit`);
  }
});

test('room furniture darkens where it meets the floor, walls are mottled, and the island is left alone', () => {
  for (const theme of ['day', 'dusk', 'rain']) {
    const [strength, height, mottle] = PAINTERLY_LOOKS[`room-${theme}`].ground;
    assert.ok(mottle > 0.1 && mottle < 0.5, `room-${theme} plaster is gently mottled`);
    assert.ok(strength > 0.3 && strength < 0.8, `room-${theme} contact shade is visible but not black`);
    assert.ok(height >= 1, `room-${theme} contact shade reaches up a sofa side`);
    assert.deepEqual(PAINTERLY_LOOKS[theme].ground, [0, 1, 0], `${theme} island stays unshaded and unmottled`);
  }
});

test('the painterly and storybook looks compile together on one material', async () => {
  const declarations = async dress => {
    const engine = new NullEngine(), scene = new Scene(engine);
    new FreeCamera('eye', new Vector3(0, 1, -4), scene); new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
    dress(scene);
    const box = MeshBuilder.CreateBox('box', {}, scene); box.material = new StandardMaterial('paint', scene);
    for (let tries = 0; tries < 5 && !box.material.isReady(box); tries++) await new Promise(resolve => setTimeout(resolve, 5));
    const count = box.subMeshes[0].effect._fragmentSourceCode.match(/vec3 finalDiffuse\s*=/g).length;
    engine.dispose();
    return count;
  };
  assert.equal(await declarations(scene => { createPainterly(scene, 'room-dusk'); createStorybook(scene); }), await declarations(() => {}));
});

test('light turns to shade over a wide soft ramp, and the dusk room shade stays warm', () => {
  for (const [theme, { band: [start, end] }] of Object.entries(PAINTERLY_LOOKS)) assert.ok(end - start + 2 * PAINTERLY_SOFTNESS >= 0.5, `${theme} terminator is a hard band`);
  const [r, g, b] = PAINTERLY_LOOKS['room-dusk'].shadow;
  assert.ok(r > g && g > b, 'the dusk room shade is amber, not violet');
});
