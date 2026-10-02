import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt, WORLD } from '../../core/world-terrain.js';
import { CLOUD_KINDS, PLUME_COLUMN, clearsPlume, clearsSkyline, clearsSnowCap, clearsSuns, cloudCards, cloudShape, createWorldClouds } from './clouds.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';
import { LANDMARKS } from './landmarks.js';

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

test('each card hands the shader its seed as a coarse part and an exact rest, so a software rasterizer that interpolates the coarse part a few ulps off still hashes the exact seed instead of speckling the cloud', () => {
  const cards = cloudCards(), { uvs2, uvs3 } = cloudShape(cards), f = Math.fround;
  const shaderSeed = (coarse, rest) => f(f(Math.floor(f(coarse * 256) + 0.5)) / 256 + rest);
  const reached = cards.flatMap((card, c) => [-8, -1, 0, 1, 8].map(ulps => shaderSeed(f(uvs2[c * 8] * (1 + ulps * 2 ** -23)), uvs3[c * 8]) === f(card.seed)));
  assert.deepEqual([...new Set(reached)], [true]);
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

test('cloud tops are warm white below the clip line over blue-grey day bases, and the sun-side warmth never clips either', () => {
  const rgb = hex => Color3.FromHexString(hex), value = ({ r, g, b }) => Math.max(r, g, b), luma = ({ r, g, b }) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const day = WORLD_ATMOSPHERES.day, dusk = WORLD_ATMOSPHERES.dusk;
  const top = rgb(day.cloudLit), base = rgb(day.cloudShade), under = rgb(dusk.cloudShade), amber = rgb(dusk.cloudLit), warm = rgb(dusk.cloudRim);
  assert.ok(luma(top) > 0.9 && luma(top) < 0.97 && top.r >= top.g && top.g > top.b, `day tops are warm white at luma ${luma(top).toFixed(3)}`);
  assert.ok(base.b > base.g && base.g > base.r && value(top) - value(base) > 0.15, 'day bases are a darker blue-grey');
  assert.ok(under.b >= under.r && under.b >= under.g && value(under) < 0.62, 'dusk bases are a cool, darker grey');
  assert.ok(amber.r - amber.b > 0.25 && value(amber) - value(under) > 0.35, 'dusk tops are warm and far brighter than the bases');
  assert.ok(warm.r - warm.b > amber.r - amber.b, 'the dusk sun side is warmer than the dusk tops');
  for (const theme of ['day', 'dusk', 'rain']) assert.ok(luma(rgb(WORLD_ATMOSPHERES[theme].cloudRim)) < 0.98, `${theme} sun-side warmth stays below the clip line`);
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

test('a thin ridge just in front of the window hides a cloud behind it on every bearing', () => {
  const ridge = (x, z) => { const r = Math.hypot(x, z); return r >= 380 && r <= 420 ? r * 0.3 : 0; };
  for (let bearing = 0; bearing < Math.PI * 2; bearing += Math.PI / 8) {
    const card = { x: Math.sin(bearing) * 2000, y: 500, z: -Math.cos(bearing) * 2000 };
    assert.equal(clearsSkyline(card, ridge), false, `bearing ${bearing.toFixed(2)}`);
    assert.equal(clearsSkyline(card, () => 0), true);
  }
});

test('raising the land under one cloud removes that cloud and leaves every other cloud where it was', () => {
  const before = cloudCards(), gone = before.find(card => card.kind === CLOUD_KINDS.cumulus);
  const hill = (x, z) => Math.hypot(x - gone.x, z - gone.z) < 30 ? 5000 : heightAt(x, z);
  const after = cloudCards(WORLD.seed, hill), at = card => `${card.x.toFixed(3)},${card.z.toFixed(3)}`, kept = new Set(after.map(at));
  assert.equal(kept.has(at(gone)), false);
  assert.deepEqual(before.filter(card => card !== gone && !kept.has(at(card))).map(at), []);
});

test('no cumulus stands in front of the snow cap, though banks may gather around its lower slopes', () => {
  assert.ok(cloudCards().filter(card => card.kind === CLOUD_KINDS.cumulus).every(card => clearsSnowCap(card)));
  const toward = (out, y, halfWidth, halfHeight) => ({ x: -4237 / 7503 * out, y, z: -6192 / 7503 * out, halfWidth, halfHeight });
  assert.equal(clearsSnowCap(toward(4000, 1100, 900, 300)), false);
  assert.equal(clearsSnowCap(toward(4000, 450, 900, 300)), true);
  assert.equal(clearsSnowCap({ x: 3000, y: 1100, z: -3000, halfWidth: 900, halfHeight: 300 }), true);
});

const bearingOf = card => Math.atan2(card.x, -card.z);

test('a long, flat collar of layered banks hugs the snow peak below its snow line, anchored in front of its foot, with no puffy bank above it', () => {
  const { x, z, radius, summit, snowLine } = LANDMARKS.peak, far = Math.hypot(x, z), peak = Math.atan2(x, -z), foot = radius * 0.5 / far;
  const silhouette = card => { const out = Math.hypot(card.x, card.z), reach = card.halfWidth / out, nearest = Math.min(Math.max(peak, bearingOf(card) - reach), bearingOf(card) + reach); return summit / far * Math.max(0, 1 - Math.abs(nearest - peak) / foot); };
  const ahead = cloudCards().filter(card => card.kind === CLOUD_KINDS.cumulus && Math.hypot(card.x, card.z) < far && (card.y - card.halfHeight * 0.62) / Math.hypot(card.x, card.z) < silhouette(card));
  const collar = ahead.filter(card => Math.hypot(card.x, card.z) <= far - radius * 0.5);
  assert.ok(collar.length >= 2, `${collar.length} collar layers`);
  for (const card of ahead) {
    const out = Math.hypot(card.x, card.z), top = card.y + card.halfHeight * 0.8, flat = card.halfWidth * 2 / (card.halfHeight * 1.42);
    assert.ok(flat >= 4.5, `bank ${out.toFixed(0)} m out is only ${flat.toFixed(1)} times wider than tall`);
    assert.ok(top < snowLine, `bank ${out.toFixed(0)} m out tops out at ${top.toFixed(0)} m, above the ${snowLine} m snow line`);
    assert.equal(card.spin, 0, `bank ${out.toFixed(0)} m out drifts off the mountain`);
  }
  const left = Math.min(...collar.map(card => bearingOf(card) - card.halfWidth / Math.hypot(card.x, card.z))), right = Math.max(...collar.map(card => bearingOf(card) + card.halfWidth / Math.hypot(card.x, card.z)));
  assert.ok(left < peak - foot && right > peak + foot, `collar spans ${left.toFixed(2)} to ${right.toFixed(2)} around the foot at ${peak.toFixed(2)}`);
});

test('the sky framed by the window is authored, so a new world seed leaves every bank and wisp in it where it was', () => {
  const framed = seed => cloudCards(seed).filter(card => card.kind !== CLOUD_KINDS.mist && bearingOf(card) > -0.9 && bearingOf(card) < 0.55).map(card => [card.x, card.y, card.z, card.halfWidth].map(value => value.toFixed(1)).join(',')).sort();
  const composed = framed(WORLD.seed);
  assert.ok(composed.length >= 8, `${composed.length} banks framed`);
  assert.deepEqual(framed(WORLD.seed + 1), composed);
  assert.deepEqual(framed(WORLD.seed * 7 + 3), composed);
});
