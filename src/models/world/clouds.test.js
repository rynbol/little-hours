import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt, WORLD } from '../../core/world-terrain.js';
import { CLOUD_KINDS, PLUME_COLUMN, clearsPlume, clearsSuns, cloudCards, cloudShape, createWorldClouds } from './clouds.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('fewer cumulus banks, at least three times apart in width, with big low banks near the ridges, all above the skyline from the window', () => {
  const cards = cloudCards(), of = kind => cards.filter(card => card.kind === CLOUD_KINDS[kind]), cumulus = of('cumulus');
  assert.ok(cumulus.length >= 12 && cumulus.length <= 20, `${cumulus.length} cumulus`);
  assert.equal(of('wisp').length, 7);
  assert.ok(of('mist').length >= 12 && of('mist').length <= 24);
  const widths = cumulus.map(card => card.halfWidth * 2);
  assert.ok(Math.max(...widths) / Math.min(...widths) >= 3, `width spread ${(Math.max(...widths) / Math.min(...widths)).toFixed(2)}`);
  const lowBanks = cumulus.filter(card => card.halfWidth * 2 >= 1800 && card.y - card.halfHeight * 0.6 <= 450 && Math.hypot(card.x, card.z) >= 3400);
  assert.ok(lowBanks.length >= 3, `${lowBanks.length} big low banks`);
  for (const card of cumulus) {
    const out = Math.hypot(card.x, card.z), base = card.y - card.halfHeight * 0.6;
    assert.ok(out >= 1600 && out <= 6500 && base >= 200 && base <= 1000, `cumulus at ${out.toFixed(0)} m, base ${base.toFixed(0)} m`);
    assert.ok(base >= heightAt(card.x, card.z) + 120);
  }
  for (const card of [...cumulus, ...of('wisp')]) {
    const out = Math.hypot(card.x, card.z);
    for (let step = 300; step < out; step += 100) assert.ok(heightAt(card.x * step / out, card.z * step / out) / step < card.y / out, `card ${out.toFixed(0)} m out hides behind land ${step} m out`);
  }
  for (const card of of('wisp')) assert.ok(card.y >= 1300);
  for (const card of of('mist')) assert.ok(heightAt(card.x, card.z) <= WORLD.valleyFloor + 2);
  const reach = cards.map(card => Math.hypot(card.x, card.z));
  assert.deepEqual(reach, [...reach].sort((a, b) => b - a));
});

test('cumulus quads hug the bank between its feathered base and its top, so the big banks rasterise under three quarters of their card', () => {
  const cards = cloudCards(), { uvs } = cloudShape(cards);
  cards.forEach((card, c) => {
    const rows = [1, 3, 5, 7].map(k => uvs[c * 8 + k]), tall = Math.max(...rows) - Math.min(...rows);
    if (card.kind === CLOUD_KINDS.cumulus) assert.ok(tall <= 1.5 && Math.min(...rows) <= -0.6 && Math.max(...rows) >= 0.78, `cumulus rows ${rows}`);
    else assert.equal(tall, 2);
  });
});

test('no cloud or wisp starts in front of the volcano plume, and the shader keeps it clear as they drift', () => {
  const sky = cloudCards().filter(card => card.kind !== CLOUD_KINDS.mist);
  assert.ok(sky.every(card => clearsPlume(card)));
  assert.equal(clearsPlume({ x: PLUME_COLUMN.x * 0.3, y: 900, z: PLUME_COLUMN.z * 0.3, halfWidth: 300, halfHeight: 100 }), false);
  assert.equal(clearsPlume({ x: PLUME_COLUMN.x * 0.3, y: 200, z: PLUME_COLUMN.z * 0.3, halfWidth: 300, halfHeight: 100 }), true);
  assert.equal(clearsPlume({ x: 2000, y: 900, z: -2000, halfWidth: 300, halfHeight: 100 }), true);
});

test('no cloud is placed over the day or dusk sun, whatever the land beneath it', () => {
  for (const theme of ['day', 'dusk']) {
    const [x, y, z] = WORLD_ATMOSPHERES[theme].sun, out = 3000, flat = Math.hypot(x, z);
    assert.equal(clearsSuns({ x: x / flat * out, y: y / flat * out, z: z / flat * out, halfWidth: 300, halfHeight: 120 }), false, theme);
  }
  assert.equal(clearsSuns({ x: 3000, y: 600, z: 0, halfWidth: 300, halfHeight: 120 }), true);
  assert.ok(cloudCards().filter(card => card.kind !== CLOUD_KINDS.mist).every(card => clearsSuns(card)));
});

test('day cumulus have warm white tops over blue-grey bases, and dusk bases stay cool grey under amber-lit tops', () => {
  const rgb = hex => Color3.FromHexString(hex), value = ({ r, g, b }) => Math.max(r, g, b);
  const day = WORLD_ATMOSPHERES.day, dusk = WORLD_ATMOSPHERES.dusk;
  const top = rgb(day.cloudLit), base = rgb(day.cloudShade), under = rgb(dusk.cloudShade), amber = rgb(dusk.cloudLit);
  assert.ok(value(top) > 0.98 && top.r >= top.g && top.g > top.b, 'day tops are warm white');
  assert.ok(base.b > base.g && base.g > base.r && value(top) - value(base) > 0.2, 'day bases are a darker blue-grey');
  assert.ok(under.b >= under.r && under.b >= under.g && value(under) < 0.62, 'dusk bases are a cool, darker grey');
  assert.ok(amber.r - amber.b > 0.25 && value(amber) - value(under) > 0.35, 'dusk tops are warm and far brighter than the bases');
});

test('every cloud, wisp and mist bank is one draw that takes the theme and drifts unless still', async () => {
  const scene = new Scene(new NullEngine()); new FreeCamera('eye', new Vector3(0, 2, 0), scene);
  const moving = createWorldClouds(scene, { root: new TransformNode('root', scene), still: false });
  const resting = createWorldClouds(scene, { root: new TransformNode('rest', scene), still: true });
  assert.equal(scene.meshes.filter(mesh => mesh.name === 'world-clouds').length, 2);
  assert.equal(moving.clouds.getTotalIndices(), moving.cards.length * 6);
  moving.setTheme(WORLD_ATMOSPHERES.dusk);
  assert.equal(moving.clouds.material._colors3.cloudLit.toHexString().toLowerCase(), '#ffe2b0');
  assert.equal(moving.clouds.material._floats.cloudCover, 0.5);
  scene.render(); await wait(20); scene.render();
  assert.ok(moving.clouds.material._floats.time > 0);
  assert.equal(resting.clouds.material._floats.time, 0);
  assert.equal(resting.clouds.material._vectors3.eye.y, 2);
  assert.equal(resting.clouds.material._vectors4.plume.x, PLUME_COLUMN.x);
  scene.dispose();
});
