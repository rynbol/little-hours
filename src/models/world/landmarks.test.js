import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt } from '../../core/world-terrain.js';
import { LANDMARKS, PLUME, MIST, MIST_RIBBONS, RIBBON_SEGMENTS, SAIL_TURN, createWorldLandmarks, landmarkGeometry, veilGeometry } from './landmarks.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const fromWindow = ({ x, z }) => Math.hypot(x + 2, z + 2.4);
const geometry = landmarkGeometry();
const near = ({ x, z }, reach) => {
  const found = [];
  for (let i = 0; i < geometry.positions.length / 3; i++) if (Math.hypot(geometry.positions[i * 3] - x, geometry.positions[i * 3 + 2] - z) < reach) found.push(i);
  return found;
};
const heights = vertices => vertices.map(i => geometry.positions[i * 3 + 1]);

test('an observatory, a snow peak, a waterfall and windmills stand at their distances from the window', () => {
  assert.deepEqual(Object.keys(LANDMARKS), ['observatory', 'peak', 'falls', 'windmills']);
  assert.ok(fromWindow(LANDMARKS.observatory) >= 3000 && fromWindow(LANDMARKS.observatory) <= 4000);
  assert.ok(fromWindow(LANDMARKS.peak) >= 5000 && fromWindow(LANDMARKS.peak) <= 9000);
  assert.ok(fromWindow(LANDMARKS.falls) >= 500 && fromWindow(LANDMARKS.falls) <= 1200);
  assert.ok(LANDMARKS.windmills.length >= 2 && LANDMARKS.windmills.length <= 3);
  for (const windmill of LANDMARKS.windmills) assert.ok(fromWindow(windmill) >= 800 && fromWindow(windmill) <= 1800, `windmill ${fromWindow(windmill).toFixed(0)} m out`);
  assert.equal(PLUME.rise, 160);
});

test('the observatory, waterfall butte and windmills are rooted in the ground and rise above it', () => {
  const { observatory, falls } = LANDMARKS;
  for (const [site, reach, tall] of [[observatory, observatory.drum * 1.6, observatory.drum], [falls, falls.width + 40, falls.height * 0.8], ...LANDMARKS.windmills.map(windmill => [windmill, 6, windmill.height * 0.9])]) {
    const ys = heights(near(site, reach)), ground = heightAt(site.x, site.z);
    assert.ok(Math.min(...ys) <= ground, `${site.x}, ${site.z} floats above the ground`);
    assert.ok(Math.max(...ys) >= ground + tall, `${site.x}, ${site.z} only reaches ${(Math.max(...ys) - ground).toFixed(0)} m`);
  }
  assert.ok(Math.abs(Math.max(...heights(near(LANDMARKS.peak, 400))) - LANDMARKS.peak.summit) < 60);
  assert.ok(geometry.positions.length / 3 < 16000);
});

test('the observatory, windmill hubs and waterfall lip rise clear of the skyline seen from the chair', () => {
  const eye = [-2, 2.24, -2.4];
  const skyline = ({ x, z }, short) => {
    const reach = Math.hypot(x - eye[0], z - eye[2]);
    let steepest = -Infinity;
    for (let t = 30; t < reach - short; t += 10) steepest = Math.max(steepest, (heightAt(eye[0] + (x - eye[0]) * t / reach, eye[2] + (z - eye[2]) * t / reach) - eye[1]) / t);
    return eye[1] + steepest * reach;
  };
  const { observatory, falls } = LANDMARKS;
  const clear = [[observatory, observatory.drum * 2, heightAt(observatory.x, observatory.z) + observatory.tower * 0.6], [falls, falls.width + 20, heightAt(falls.x, falls.z) + falls.height * 0.5], ...LANDMARKS.windmills.map(windmill => [windmill, 15, heightAt(windmill.x, windmill.z) + windmill.height])];
  for (const [site, short, mark] of clear) assert.ok(mark > skyline(site, short), `${site.x}, ${site.z} sits ${(skyline(site, short) - mark).toFixed(0)} m behind the skyline`);
});

test('the peak is one smooth sheet with shared vertices, not faceted panels', () => {
  const peak = new Set(near(LANDMARKS.peak, LANDMARKS.peak.radius * 0.9));
  let corners = 0;
  for (const index of geometry.indices) if (peak.has(index)) corners++;
  assert.ok(peak.size > 4000);
  assert.ok(corners / peak.size > 5.5, `${(corners / peak.size).toFixed(2)} triangle corners per vertex`);
});

test('the observatory slit is wide enough to read from the window', () => {
  const slit = [];
  for (let i = 0; i < geometry.colors.length / 4; i++) if (Math.abs(geometry.colors[i * 4] - 0.22) < 1e-3 && Math.abs(geometry.colors[i * 4 + 1] - 0.27) < 1e-3 && Math.abs(geometry.colors[i * 4 + 2] - 0.31) < 1e-3) slit.push(i);
  let widest = 0;
  for (const a of slit) for (const b of slit) {
    const [ax, ay, az, bx, by, bz] = [a * 3, a * 3 + 1, a * 3 + 2, b * 3, b * 3 + 1, b * 3 + 2].map(k => geometry.positions[k]);
    if (Math.abs(ay - by) < 0.01) widest = Math.max(widest, Math.hypot(ax - bx, az - bz));
  }
  assert.ok(slit.length > 0);
  assert.ok(widest >= 16, `slit ${widest.toFixed(1)} m wide`);
});

test('the butte ledge steps up and down around its sides instead of a level ring', () => {
  const { x, z } = LANDMARKS.falls, face = Math.atan2(-z, -x), sectors = 24, sides = Array.from({ length: sectors }, () => []);
  const around = near(LANDMARKS.falls, 140).map(i => [Math.atan2(geometry.positions[i * 3 + 2] - z, geometry.positions[i * 3] - x), Math.hypot(geometry.positions[i * 3] - x, geometry.positions[i * 3 + 2] - z), geometry.positions[i * 3 + 1]]);
  const top = Math.max(...around.map(([, , y]) => y));
  for (const [a, r, y] of around) sides[Math.floor((a + Math.PI) / (2 * Math.PI) * sectors) % sectors].push([r, y]);
  const ledges = sides.filter((_, k) => { const a = (k + 0.5) / sectors * 2 * Math.PI - Math.PI - face; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 0.6; }).map(side => {
    const rim = Math.max(...side.filter(([, y]) => y > top - 8).map(([r]) => r));
    return side.reduce((best, point) => Math.abs(point[0] - rim - 12) < Math.abs(best[0] - rim - 12) ? point : best)[1];
  });
  assert.ok(Math.max(...ledges) - Math.min(...ledges) > 12, `ledge varies ${(Math.max(...ledges) - Math.min(...ledges)).toFixed(1)} m`);
});

test('only the windmill sails carry a spin, one hub per windmill', () => {
  const hubs = new Map();
  for (let i = 0; i < geometry.spins.length; i += 4) {
    const rate = geometry.spins[i + 3];
    if (rate === 0) { assert.deepEqual([...geometry.spins.slice(i, i + 3)], [0, 0, 0]); continue; }
    assert.equal(rate, Math.fround(SAIL_TURN));
    hubs.set(geometry.spins.slice(i, i + 3).join(), [geometry.spins[i], geometry.spins[i + 2]]);
  }
  assert.equal(hubs.size, LANDMARKS.windmills.length);
  for (const windmill of LANDMARKS.windmills) assert.ok([...hubs.values()].some(([x, z]) => Math.hypot(x - windmill.x, z - windmill.z) < 6));
});

test('the landmarks are two draws that take the theme, wet in rain and rimmed at dusk, and stand still under reduced motion', async () => {
  const scene = new Scene(new NullEngine()); new FreeCamera('eye', new Vector3(-2, 60, -2.4), scene);
  const moving = createWorldLandmarks(scene, { root: new TransformNode('root', scene), still: false });
  const resting = createWorldLandmarks(scene, { root: new TransformNode('rest', scene), still: true });
  assert.deepEqual(moving.meshes.map(mesh => mesh.name), ['world-landmarks', 'world-landmark-veils']);
  assert.equal(moving.meshes[1].getTotalIndices(), (PLUME.puffs + MIST.puffs) * 6 + 12 * 6 + 3 * 64 * 6);
  const [solid, veil] = moving.meshes.map(mesh => mesh.material);
  moving.setTheme(WORLD_ATMOSPHERES.day);
  const dayGlow = solid._floats.lampGain;
  moving.setTheme(WORLD_ATMOSPHERES.dusk);
  assert.equal(solid._colors3.sunColor.toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk.sunColor);
  assert.equal(veil._colors3.sunColor.toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk.sunColor);
  assert.equal(solid._colors3.snow.toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk.snow);
  assert.ok(solid._floats.lampGain > dayGlow * 3);
  assert.equal(solid._floats.sunRim, 1);
  moving.setTheme(WORLD_ATMOSPHERES.rain);
  assert.deepEqual([solid._floats.wet, veil._floats.wet, solid._floats.sunRim], [1, 1, 0]);
  assert.ok(solid._floats.lampGain < dayGlow, 'the observatory windows stay unlit in the rain instead of floating in the grey');
  moving.setTheme(WORLD_ATMOSPHERES.day);
  assert.deepEqual([solid._floats.wet, veil._floats.wet, solid._floats.sunRim], [0, 0, 0]);
  moving.setTheme(WORLD_ATMOSPHERES.dusk);
  scene.render(); await wait(20); scene.render();
  assert.ok(solid._floats.time > 0 && veil._floats.time > 0);
  for (const mesh of resting.meshes) assert.equal(mesh.material._floats.time, 0);
  assert.equal(resting.meshes[0].material._vectors3.eye.y, 60);
  scene.dispose();
});

function ribbonFit({ reach, low, high }) {
  const eye = [-2, 2.24, -2.4];
  let shows = 0, touches = 0, bearings = 0;
  for (let bearing = -45; bearing <= 35; bearing += 2.5) {
    const a = bearing * Math.PI / 180, along = r => heightAt(eye[0] + Math.sin(a) * r, eye[2] - Math.cos(a) * r);
    let steepest = -1;
    for (let r = 20; r < reach; r += 10) steepest = Math.max(steepest, (along(r) - eye[1]) / r);
    const seenFrom = Math.max(eye[1] + steepest * reach, along(reach));
    bearings++; if (high > seenFrom + 10) shows++; if (low < seenFrom) touches++;
  }
  return [reach, Math.round(shows / bearings * 10) / 10, Math.round(touches / bearings * 10) / 10];
}

test('three mist ribbons rise from the valleys into view from the window in the same veil draw, nearest last, tinted by the theme', () => {
  const veil = veilGeometry(geometry.falls), ribbons = [];
  for (let v = 0; v < veil.uvs2.length / 2; v++) if (veil.uvs2[v * 2] === 3) ribbons.push(v);
  assert.equal(ribbons.length, MIST_RIBBONS.length * (RIBBON_SEGMENTS + 1) * 2);
  const reach = v => Math.round(Math.hypot(veil.positions[v * 3] + 2, veil.positions[v * 3 + 2] + 2.4));
  assert.deepEqual([...new Set(ribbons.map(reach))], MIST_RIBBONS.map(ribbon => ribbon.reach));
  assert.deepEqual(MIST_RIBBONS.map(ribbonFit), [[2300, 0.9, 0.7], [1500, 1, 1], [950, 1, 0.7]]);
  const scene = new Scene(new NullEngine()); new FreeCamera('eye', new Vector3(-2, 2, -2.4), scene);
  const landmarks = createWorldLandmarks(scene, { root: new TransformNode('root', scene), still: true }), paint = landmarks.meshes[1].material;
  const misted = theme => { landmarks.setTheme(WORLD_ATMOSPHERES[theme]); return [paint._colors3.mist.toHexString().toLowerCase(), paint._floats.mistStrength]; };
  assert.deepEqual(['day', 'dusk', 'rain'].map(misted), [['#bcd0cc', 0.42], ['#91928c', 0.45], ['#5c6252', 0.6]]);
  scene.dispose();
});
