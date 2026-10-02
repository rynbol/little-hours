import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt, createTerrainField } from '../../core/world-terrain.js';
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
  for (const [site, reach, tall] of [[observatory, observatory.drum * 1.6, observatory.drum], [falls, falls.width + 40, falls.height * 0.8], ...LANDMARKS.windmills.map(windmill => [windmill, windmill.height * 0.2, windmill.height * 0.9])]) {
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
  for (const windmill of LANDMARKS.windmills) assert.ok([...hubs.values()].some(([x, z]) => Math.hypot(x - windmill.x, z - windmill.z) < windmill.height * 0.2));
});

test('windmills stand as stout mid-toned towers under a cap, not pale crosses on sticks', () => {
  for (const windmill of LANDMARKS.windmills) {
    const parts = near(windmill, windmill.height * 0.7), ground = heightAt(windmill.x, windmill.z);
    const brightest = Math.max(...parts.map(i => 0.2126 * geometry.colors[i * 4] + 0.7152 * geometry.colors[i * 4 + 1] + 0.0722 * geometry.colors[i * 4 + 2]));
    const foot = Math.max(...parts.filter(i => Math.abs(geometry.positions[i * 3 + 1] - ground) < 4 && geometry.spins[i * 4 + 3] === 0).map(i => Math.hypot(geometry.positions[i * 3] - windmill.x, geometry.positions[i * 3 + 2] - windmill.z)));
    assert.ok(brightest < 0.72, `windmill at ${windmill.x} carries albedo ${brightest.toFixed(2)}`);
    assert.ok(foot > windmill.height * 0.15, `windmill at ${windmill.x} stands on a ${foot.toFixed(1)} m stick`);
  }
});

test('the landmarks are two draws that take the theme, wet in rain and rimmed at dusk, and stand still under reduced motion', async () => {
  const scene = new Scene(new NullEngine()); new FreeCamera('eye', new Vector3(-2, 60, -2.4), scene);
  const moving = createWorldLandmarks(scene, { root: new TransformNode('root', scene), still: false });
  const resting = createWorldLandmarks(scene, { root: new TransformNode('rest', scene), still: true });
  assert.deepEqual(moving.meshes.map(mesh => mesh.name), ['world-landmarks', 'world-landmark-veils']);
  assert.equal(moving.meshes[1].getTotalIndices(), (PLUME.puffs + MIST.puffs) * 6 + 12 * 6 + 4 * 64 * 6);
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

test('four mist ribbons rise from the valleys into view from the window in the same veil draw, nearest last, tinted by the theme', () => {
  const veil = veilGeometry(geometry.falls), ribbons = [];
  for (let v = 0; v < veil.uvs2.length / 2; v++) if (veil.uvs2[v * 2] === 3) ribbons.push(v);
  assert.equal(ribbons.length, MIST_RIBBONS.length * (RIBBON_SEGMENTS + 1) * 2);
  const reach = v => Math.round(Math.hypot(veil.positions[v * 3] + 2, veil.positions[v * 3 + 2] + 2.4));
  assert.deepEqual([...new Set(ribbons.map(reach))], MIST_RIBBONS.map(ribbon => ribbon.reach));
  assert.deepEqual(MIST_RIBBONS.map(ribbonFit), [[2300, 0.9, 0.7], [1500, 1, 1], [1250, 1, 0.7], [950, 1, 0.7]]);
  const scene = new Scene(new NullEngine()); new FreeCamera('eye', new Vector3(-2, 2, -2.4), scene);
  const landmarks = createWorldLandmarks(scene, { root: new TransformNode('root', scene), still: true }), paint = landmarks.meshes[1].material;
  const misted = theme => { landmarks.setTheme(WORLD_ATMOSPHERES[theme]); return [paint._colors3.mist.toHexString().toLowerCase(), paint._floats.mistStrength]; };
  assert.deepEqual(['day', 'dusk', 'rain'].map(misted), [['#bcd0cc', 0.42], ['#91928c', 0.45], ['#5c6252', 0.6]]);
  scene.dispose();
});

test('each windmill wears a cap that overhangs its tower and a dark hub boss in front of its sails', () => {
  const across = ([px, , pz], { x, z }) => Math.hypot(px - x, pz - z), point = i => [0, 1, 2].map(k => geometry.positions[i * 3 + k]);
  for (const windmill of LANDMARKS.windmills) {
    const top = heightAt(windmill.x, windmill.z) + windmill.height, parts = near(windmill, windmill.height * 0.7);
    const fixed = parts.filter(i => geometry.spins[i * 4 + 3] === 0), reach = (low, high) => Math.max(...fixed.filter(i => geometry.positions[i * 3 + 1] > low && geometry.positions[i * 3 + 1] < high).map(i => across(point(i), windmill)));
    const ground = top - windmill.height, cap = reach(top - 4, top + 8), waist = reach(ground + windmill.height * 0.4, ground + windmill.height * 0.5);
    assert.ok(waist > 0 && cap > waist * 1.1, `cap ${cap.toFixed(1)} m over a ${waist.toFixed(1)} m tower`);
    const sails = parts.filter(i => geometry.spins[i * 4 + 3] > 0), hub = [...geometry.spins.slice(sails[0] * 4, sails[0] * 4 + 3)];
    const boss = sails.filter(i => { const p = point(i); return Math.hypot(p[0] - hub[0], p[1] - hub[1], p[2] - hub[2]) < windmill.height * 0.08 && p[2] - hub[2] > 1; });
    const luma = i => 0.2126 * geometry.colors[i * 4] + 0.7152 * geometry.colors[i * 4 + 1] + 0.0722 * geometry.colors[i * 4 + 2];
    assert.ok(boss.length >= 8 && boss.every(i => luma(i) < 0.25), `${boss.length} hub boss vertices`);
  }
});

test('defined Bellroot geometry has suspended copper bell detail and follows its rendered footing', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const gate = WILDS_WORLD.landmarks.find(mark => mark.kind === 'gate'), definition = { ...WILDS_WORLD, landmarks: [gate], formations: [] };
  const low = landmarkGeometry({ definition, surface: () => ({ height: 10 }) }), high = landmarkGeometry({ definition, surface: () => ({ height: 17 }) });
  assert.ok(low.indices.length > 5000);
  assert.ok(low.uvs.some((value, i) => i % 2 === 0 && Math.abs(value - 0.22) < 1e-6));
  for (let i = 0; i < low.positions.length; i += 3) {
    assert.equal(low.positions[i], high.positions[i]);
    assert.equal(low.positions[i + 2], high.positions[i + 2]);
    assert.ok(Math.abs(high.positions[i + 1] - low.positions[i + 1] - 7) < 0.00001);
  }
  const gateHeights = [];
  for (let i = 0; i < low.positions.length; i += 3) if (Math.abs(low.positions[i + 2] - gate.z) < 3) gateHeights.push(low.positions[i + 1]);
  assert.ok(Math.max(...gateHeights) > 24 && Math.max(...gateHeights) < 26);
});

test('the distant Wilds astrolabe is an open broken ring above a modest ruin and uses local mist bands', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const observatory = WILDS_WORLD.landmarks.find(mark => mark.kind === 'observatory');
  const definition = { ...WILDS_WORLD, landmarks: [observatory], formations: [] }, data = landmarkGeometry({ definition, surface: () => ({ height: 20 }) });
  const high = [];
  for (let i = 0; i < data.positions.length; i += 3) if (data.positions[i + 1] > 60) high.push([data.positions[i], data.positions[i + 1], data.positions[i + 2]]);
  assert.ok(high.length > 250);
  assert.ok(Math.max(...high.map(point => point[1])) < 95);
  assert.ok(high.every(point => Math.abs(point[0] - observatory.x) < 40 && Math.abs(point[2] - observatory.z) < 40));
  assert.ok(high.some(point => point[0] < observatory.x - 20) && high.some(point => point[0] > observatory.x + 20));
  const mist = veilGeometry(undefined, definition);
  assert.equal(mist.indices.length, 3 * RIBBON_SEGMENTS * 6);
  assert.ok(mist.positions.every(Number.isFinite));
  assert.ok(mist.uvs2.filter((_, i) => i % 2 === 0).every(kind => kind === 3));
});

test('the tall outcrop renders a level summit at the same height as its climb support', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const formation = WILDS_WORLD.formations[0], definition = { ...WILDS_WORLD, landmarks: [] };
  const data = landmarkGeometry({ definition, surface: () => ({ height: 12 }) }), top = 17.5, summit = [];
  for (let i = 0; i < data.positions.length; i += 3) {
    const x = data.positions[i], y = data.positions[i + 1], z = data.positions[i + 2];
    if (Math.hypot(x - formation.x, z - formation.z) < formation.radius * 1.021 && y > 17 && data.normals[i + 1] > .99) summit.push(y);
  }
  assert.ok(summit.length >= 32);
  assert.ok(summit.every(y => y === top));
  assert.equal(formation.height, 5.5);
});

test('Wilds landmark lighting keeps wet faces above an ambient floor and clears mist near the camera', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const scene = new Scene(new NullEngine()); new FreeCamera('eye', new Vector3(-310, 19, -529), scene);
  const custom = createWorldLandmarks(scene, { root: new TransformNode('wilds', scene), still: true, definition: WILDS_WORLD, surface: () => ({ height: 0 }) });
  const standard = createWorldLandmarks(scene, { root: new TransformNode('standard', scene), still: true });
  for (const atmosphere of Object.values(WORLD_ATMOSPHERES)) {
    custom.setTheme(atmosphere); standard.setTheme(atmosphere);
    assert.equal(custom.meshes[0].material._floats.ambientFloor, 1.08);
    assert.equal(custom.meshes[0].material._floats.wetDarkening, 0.1);
    assert.equal(custom.meshes[1].material._floats.mistClearance, 140);
    assert.equal(standard.meshes[0].material._floats.ambientFloor, 0);
    assert.equal(standard.meshes[0].material._floats.wetDarkening, 0.3);
    assert.equal(standard.meshes[1].material._floats.mistClearance, 0);
  }
  scene.dispose();
});

test('each Wilds arch foot is buried across its full width on a sloping bank', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const arch = { id: 'test-arch', kind: 'arch', x: 0, z: 0, width: 70, height: 84 };
  const surface = (x, z) => ({ height: x * 0.5 + z * 0.2 });
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [arch], formations: [] }, surface });
  for (const center of [-35, 35]) {
    const vertices = [];
    for (let i = 0; i < data.positions.length; i += 3) {
      const [x, y, z] = data.positions.slice(i, i + 3);
      if (Math.abs(x - center) < 16 && Math.abs(z) < 16 && Math.abs(data.colors[i / 3 * 4] - 0.74) < 1e-6) vertices.push([x, y, z]);
    }
    const bottom = Math.min(...vertices.map(p => p[1])), foot = vertices.filter(p => p[1] === bottom);
    assert.ok(foot.length >= 12);
    for (const [x, y, z] of foot) assert.ok(y < surface(x, z).height - 0.25, `foot ${x},${z} floats ${y - surface(x, z).height}`);
  }
});

test('outcrop satellite stones use their own ground height on a slope', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const formation = WILDS_WORLD.formations[0], surface = (x, z) => ({ height: x * 0.25 + z * 0.3 });
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [] }, surface });
  const stones = [];
  for (let i = 0; i < data.positions.length / 3; i++) if (Math.abs(data.colors[i * 4] - 0.67) < 1e-6 && Math.abs(data.colors[i * 4 + 1] - 0.69) < 1e-6) stones.push([...data.positions.slice(i * 3, i * 3 + 3)]);
  assert.ok(stones.length > 0);
  for (let k = 0; k < 4; k++) {
    const a = k * 1.57 + 0.4, x = formation.x + Math.cos(a) * formation.radius * 1.28, z = formation.z + Math.sin(a) * formation.radius * 1.28;
    const stone = stones.filter(p => Math.hypot(p[0] - x, p[2] - z) < 0.3), lowest = Math.min(...stone.map(p => p[1]));
    assert.ok(lowest < surface(x, z).height - 0.1);
    assert.ok(Math.max(...stone.map(p => p[1])) < surface(x, z).height + 0.23);
  }
});

test('the outcrop has broken sloping strata while keeping a continuous level summit', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const mark = WILDS_WORLD.formations[0];
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [] }, surface: () => ({ height: 0 }) });
  const stratum = [];
  for (let i = 0; i < data.positions.length; i += 3) {
    const [x, y, z] = data.positions.slice(i, i + 3), reach = Math.hypot(x - mark.x, z - mark.z);
    if (reach > 2.3 && reach < 2.61 && y > 1 && y < 2.4) stratum.push([reach, y]);
  }
  assert.ok(Math.max(...stratum.map(p => p[0])) - Math.min(...stratum.map(p => p[0])) > 0.13);
  assert.ok(Math.max(...stratum.map(p => p[1])) - Math.min(...stratum.map(p => p[1])) > 0.35);
});

test('each arch foot has low scattered stone at its own terrain contact', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const arch = WILDS_WORLD.landmarks.find(mark => mark.kind === 'arch');
  const surface = (x, z) => ({ height: (x - arch.x) * 0.07 + (z - arch.z) * 0.05 });
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [arch], formations: [] }, surface });
  for (const center of [140, 210]) {
    const stones = [];
    for (let i = 0; i < data.positions.length; i += 3) {
      const [x, y, z] = data.positions.slice(i, i + 3), reach = Math.hypot(x - center, z - arch.z);
      if (reach > 14.5 && reach < 24 && y < surface(x, z).height + 3.5) stones.push([x, y, z]);
    }
    assert.ok(stones.length > 100);
    assert.ok(stones.some(([x, y, z]) => y < surface(x, z).height));
    assert.ok(stones.some(([x, y, z]) => y > surface(x, z).height + 1));
  }
});

test('the hearth holds low coals and crossed logs inside its stone ring', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const hearth = WILDS_WORLD.landmarks.find(mark => mark.kind === 'hearth');
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [hearth], formations: [] }, surface: () => ({ height: 0 }) });
  const coals = [], logs = [];
  for (let i = 0; i < data.positions.length / 3; i++) {
    const p = [...data.positions.slice(i * 3, i * 3 + 3)];
    if (data.uvs[i * 2] > .05 && Math.hypot(p[0] - hearth.x, p[2] - hearth.z) < 1.1) coals.push(p);
    if (Math.abs(data.colors[i * 4] - .2) < 1e-6) logs.push(p);
  }
  assert.ok(coals.length > 180);
  assert.ok(coals.every(p => p[1] <= .25 && Math.hypot(p[0] - hearth.x, p[2] - hearth.z) < 1.1));
  assert.ok(logs.length >= 80);
});

test('all six charred log ends close with a visible inner wood face', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const hearth = WILDS_WORLD.landmarks.find(mark => mark.kind === 'hearth');
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [hearth], formations: [] }, surface: () => ({ height: 0 }) });
  for (let k = 0; k < 3; k++) for (const sign of [-1, 1]) {
    const turn = k * 1.12 + .35, end = [.825 * sign * Math.cos(turn) + hearth.x, .24 + k * .05, .825 * sign * Math.sin(turn) + hearth.z];
    const faces = [];
    for (let i = 0; i < data.positions.length / 3; i++) {
      const p = data.positions.slice(i * 3, i * 3 + 3), n = data.normals.slice(i * 3, i * 3 + 3);
      if (Math.hypot(p[0] - end[0], p[1] - end[1], p[2] - end[2]) < .08 && n[0] * Math.cos(turn) * sign + n[2] * Math.sin(turn) * sign > .99) faces.push(i);
    }
    assert.ok(faces.length >= 10, `log ${k}, end ${sign} must have an inner closing face`);
    assert.ok(faces.some(i => data.colors[i * 4] > .3));
  }
});

test('the three islets have distinct long, broad and upright silhouettes', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const mark = WILDS_WORLD.landmarks.find(item => item.kind === 'islets');
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [mark], formations: [] }, surface: () => ({ height: 0 }) });
  const parent = Array.from({ length: data.positions.length / 3 }, (_, i) => i);
  const root = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < data.indices.length; i += 3) {
    const [a, b, c] = data.indices.slice(i, i + 3);
    parent[root(b)] = root(a); parent[root(c)] = root(a);
  }
  const parts = new Map();
  for (let i = 0; i < parent.length; i++) {
    const key = root(i);
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key).push([...data.positions.slice(i * 3, i * 3 + 3)]);
  }
  const islands = [...parts.values()].filter(points => points.length > 150 && points.every(p => p[1] > 185)).map(points => {
    const xs = points.map(p => p[0]), zs = points.map(p => p[2]);
    return { center: (Math.max(...xs) + Math.min(...xs)) / 2, aspect: (Math.max(...xs) - Math.min(...xs)) / (Math.max(...zs) - Math.min(...zs)) };
  }).sort((a, b) => a.center - b.center);
  assert.equal(islands.length, 3);
  assert.ok(islands[0].aspect > 2);
  assert.ok(islands[1].aspect > 1.1 && islands[1].aspect < 1.6);
  assert.ok(islands[2].aspect < 1);
});

test('the outcrop base stays buried around its full perimeter on sloping ground', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const formation = { ...WILDS_WORLD.formations[0], x: 0, z: 0 };
  const surface = (x, z) => ({ height: x * 0.45 + z * 0.3 });
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [], formations: [formation] }, surface });
  const bottom = [];
  for (let i = 0; i < data.positions.length; i += 3) {
    const [x, y, z] = data.positions.slice(i, i + 3);
    if (Math.abs(Math.hypot(x, z) - 2.6) < .0001) bottom.push([x, y, z]);
  }
  assert.ok(bottom.length >= 24);
  for (const [x, y, z] of bottom) assert.ok(y < surface(x, z).height - .2, `exposed base at ${x},${z}: ${y - surface(x, z).height}`);
});

test('Bellroot approach markers carry contrasting inset faces above their own ground', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const gate = WILDS_WORLD.landmarks.find(mark => mark.kind === 'gate');
  const surface = (x, z) => ({ height: x * .04 + z * .08 });
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [gate], formations: [] }, surface });
  for (const side of [-1, 1]) {
    const x = gate.x + side * gate.width * .64, z = gate.z + 1.4, ground = surface(x, z).height;
    for (const facing of [-1, 1]) {
      const inlay = [];
      for (let i = 0; i < data.positions.length / 3; i++) {
        const p = data.positions.slice(i * 3, i * 3 + 3), color = data.colors.slice(i * 4, i * 4 + 3);
        if (Math.abs(p[0] - x) < .36 && (p[2] - z) * facing > .38 && (p[2] - z) * facing < .6 && p[1] > ground + .45 && p[1] < ground + 1.3 && color[0] < .35 && color[1] > color[0]) inlay.push(p);
      }
      assert.ok(inlay.length >= 8, `marker ${side} face ${facing} has no readable inset`);
      assert.ok(Math.max(...inlay.map(p => p[1])) - Math.min(...inlay.map(p => p[1])) > .4);
    }
  }
});

test('glacier toe relief follows local ground without reshaping its summit', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const peak = WILDS_WORLD.landmarks.find(mark => mark.kind === 'peak'), field = createTerrainField(WILDS_WORLD);
  const definition = { ...WILDS_WORLD, landmarks: [peak], formations: [] }, surface = (x, z) => ({ height: field.heightAt(x, z) });
  const before = landmarkGeometry({ definition, surface }), contact = [];
  for (let i = 0; i < before.positions.length; i += 3) {
    const [x, y, z] = before.positions.slice(i, i + 3), clearance = y - surface(x, z).height;
    if (Math.hypot(x - peak.x, z - peak.z) < 80 && clearance > 6 && clearance < 12) contact.push([x, y, z]);
  }
  assert.ok(contact.length > 10);
  const after = landmarkGeometry({ definition, surface: (x, z) => ({ height: surface(x, z).height + (Math.hypot(x - peak.x, z - peak.z) < 80 ? 10 : 0) }) });
  const matching = new Map();
  for (let i = 0; i < after.positions.length; i += 3) matching.set(`${after.positions[i]},${after.positions[i + 2]}`, after.positions[i + 1]);
  let changed = 0;
  for (let i = 0; i < before.positions.length; i += 3) {
    const [x, y, z] = before.positions.slice(i, i + 3), candidate = matching.get(`${x},${z}`);
    if (y > peak.snowLine + 20) assert.equal(candidate, y);
    if (candidate === undefined || y - surface(x, z).height < 1) continue;
    const delta = Math.abs(candidate - y);
    assert.ok(delta < 1.8);
    if (delta > .04) changed++;
  }
  assert.ok(changed > 20, `only ${changed} toe vertices respond to local terrain`);
});

test('the hearth has an off-axis elevated warm cue that clears its ring from multiple approaches', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const hearth = WILDS_WORLD.landmarks.find(mark => mark.kind === 'hearth');
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [hearth], formations: [] }, surface: () => ({ height: 0 }) });
  const lit = [];
  for (let i = 0; i < data.positions.length / 3; i++) if (data.uvs[i * 2] > .25 && data.positions[i * 3 + 1] > 1.3) lit.push([...data.positions.slice(i * 3, i * 3 + 3)]);
  for (const yaw of [-.4, 0, .4]) {
    const projected = lit.filter(([x, y, z]) => Math.abs((x - hearth.x) * Math.cos(yaw) - (z - hearth.z) * Math.sin(yaw)) > 1 && y > 1.3);
    assert.ok(projected.length >= 12, `approach ${yaw} has no elevated cue outside the central body silhouette`);
  }
});

test('hearth embers have matte charcoal crust around localized luminous cores', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const hearth = WILDS_WORLD.landmarks.find(mark => mark.kind === 'hearth');
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [hearth], formations: [] }, surface: () => ({ height: 0 }) });
  let embers = 0, crust = 0, hot = 0;
  for (let i = 0; i < data.positions.length / 3; i++) {
    const [x, y, z] = data.positions.slice(i * 3, i * 3 + 3), glow = data.uvs[i * 2];
    if (y > .25 || Math.hypot(x - hearth.x, z - hearth.z) > 1.1 || glow <= 0) continue;
    embers++;
    if (glow > .7) hot++;
    if (glow < .15 && data.colors[i * 4] < .2) crust++;
  }
  assert.ok(embers > 300 && crust / embers > .7 && hot / embers > .05 && hot / embers < .2, `embers=${embers}, crust=${crust}, hot=${hot}`);
});

function frontSurfaceAt(data, x, y) {
  let front = -Infinity;
  for (let i = 0; i < data.indices.length; i += 3) {
    const p = [...data.indices.slice(i, i + 3)].map(v => data.positions.slice(v * 3, v * 3 + 3)), [a, b, c] = p;
    const determinant = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(determinant) < 1e-8) continue;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / determinant;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / determinant, w = 1 - u - v;
    if (Math.min(u, v, w) >= -1e-5) front = Math.max(front, u * a[2] + v * b[2] + w * c[2]);
  }
  return front;
}

test('arch rubble leaves the ordinary front approach clear of body-height stone', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const arch = WILDS_WORLD.landmarks.find(mark => mark.kind === 'arch');
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [arch], formations: [] }, surface: () => ({ height: 0 }) });
  const overhead = { ...data, positions: Float32Array.from(data.positions, (value, i) => i % 3 === 1 ? data.positions[i + 1] : i % 3 === 2 ? data.positions[i - 1] : value) };
  for (const [x, z] of [[145, -653], [144.7, -653], [145.3, -653]]) {
    const above = frontSurfaceAt(overhead, x, z);
    assert.ok(above < .5, `approach ${x},${z} enters ${above.toFixed(2)}m of solid scenery`);
  }
});

test('astrolabe rings carry local patina instead of one pristine finish', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const observatory = WILDS_WORLD.landmarks.find(mark => mark.kind === 'observatory');
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [observatory], formations: [] }, surface: () => ({ height: 0 }) });
  const ring = [];
  for (let i = 0; i < data.positions.length / 3; i++) if (data.positions[i * 3 + 1] > 55 && data.colors[i * 4 + 3] === 1 && data.colors[i * 4 + 1] > data.colors[i * 4]) ring.push(data.colors[i * 4]);
  assert.ok(ring.length > 60);
  assert.ok(Math.max(...ring) - Math.min(...ring) > .05);
});


test('outcrop relief stays within two centimetres of every radial climbing approach', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const mark = { ...WILDS_WORLD.formations[0], x: 0, z: 0 };
  const data = landmarkGeometry({ definition: { ...WILDS_WORLD, landmarks: [], formations: [mark] }, surface: () => ({ height: 0 }) });
  const contacts = [
    [2.518019, 2.480939, 2.567719, 2.55], [2.495955, 2.52502, 2.549104, 2.55], [2.510269, 2.55017, 2.54031, 2.55],
    [2.541841, 2.51851, 2.563036, 2.55], [2.520032, 2.483894, 2.568144, 2.55], [2.488403, 2.489903, 2.549258, 2.55],
    [2.476716, 2.5239, 2.542282, 2.55], [2.535974, 2.516886, 2.562605, 2.55], [2.532113, 2.501619, 2.571187, 2.55],
    [2.496125, 2.52581, 2.5491, 2.55], [2.484598, 2.530071, 2.541894, 2.55], [2.493787, 2.505203, 2.560183, 2.55],
  ];
  let recessed = 0;
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    const positions = Float32Array.from(data.positions, (value, i) => i % 3 === 0 ? value * Math.cos(a) - data.positions[i + 2] * Math.sin(a) : i % 3 === 2 ? value * Math.cos(a) + data.positions[i - 2] * Math.sin(a) : value);
    for (const [index, y] of [1, 2.7, 4.8, 5.5].entries()) {
      const delta = contacts[k][index] - frontSurfaceAt({ ...data, positions }, 0, y);
      assert.ok(delta >= -.00001 && delta < .02, `radial approach ${k}, height ${y} moved ${delta}m`);
      if (y === 5.5) assert.ok(Math.abs(delta) < .00001, `summit edge moved on approach ${k}`);
      if (delta > .001) recessed++;
    }
  }
  assert.ok(recessed >= 20, `only ${recessed} near faces have shallow weathered relief`);
});

test('unchanged landmark terrain keeps its existing GPU buffers across refreshes', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const scene = new Scene(new NullEngine());
  let distantHeight = 0;
  const surface = (x, z) => ({ height: x > 2000 ? distantHeight : x * .01 + z * .02 });
  const layer = createWorldLandmarks(scene, { root: new TransformNode('root', scene), still: true, definition: WILDS_WORLD, surface });
  const solid = layer.meshes[0], kinds = ['position', 'normal', 'color', 'uv', 'spin'], buffers = kinds.map(kind => solid.getVertexBuffer(kind)), indices = solid.geometry.getIndexBuffer();
  for (let i = 0; i < 3; i++) {
    distantHeight += 10;
    layer.refresh();
    assert.ok(kinds.every((kind, index) => solid.getVertexBuffer(kind) === buffers[index]), 'unchanged terrain replaced landmark vertex buffers');
    assert.ok(solid.geometry.getIndexBuffer() === indices, 'unchanged terrain replaced landmark indices');
  }
  scene.dispose();
});

test('landmark refresh invalidates changed sampled ground and mutable shape definitions', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const definition = structuredClone(WILDS_WORLD), field = createTerrainField(WILDS_WORLD);
  const peak = definition.landmarks.find(mark => mark.kind === 'peak');
  let raised = false;
  const surface = (x, z) => ({ height: field.heightAt(x, z) + (raised && Math.hypot(x - peak.x, z - peak.z) < 80 ? 10 : 0) });
  const scene = new Scene(new NullEngine()), layer = createWorldLandmarks(scene, { root: new TransformNode('root', scene), still: true, definition, surface });
  const solid = layer.meshes[0], before = Float32Array.from(solid.getVerticesData('position'));
  const matchesFreshBuild = () => {
    const fresh = landmarkGeometry({ definition: structuredClone(definition), surface });
    for (const [kind, key] of [['position', 'positions'], ['normal', 'normals'], ['color', 'colors'], ['uv', 'uvs'], ['spin', 'spins']]) assert.deepEqual(solid.getVerticesData(kind), fresh[key], kind);
    assert.deepEqual(solid.getIndices(), fresh.indices);
  };
  raised = true; layer.refresh(); matchesFreshBuild();
  assert.notDeepEqual(solid.getVerticesData('position'), before);
  definition.landmarks.find(mark => mark.kind === 'gate').height += 2;
  definition.formations[0].radius += .2;
  definition.path.offset += 3;
  layer.refresh(); matchesFreshBuild();
  definition.landmarks = definition.landmarks.filter(mark => mark.kind !== 'arch');
  layer.refresh(); matchesFreshBuild();
  raised = false; layer.refresh(); matchesFreshBuild();
  scene.dispose();
});

test('cached peak samples invalidate each authored shape parameter without retaining stale terrain', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const mark = structuredClone(WILDS_WORLD.landmarks.find(mark => mark.kind === 'peak'));
  const definition = { ...WILDS_WORLD, landmarks: [mark], formations: [] }, field = createTerrainField(WILDS_WORLD);
  const surface = (x, z) => ({ height: field.heightAt(x, z) });
  const before = landmarkGeometry({ definition, surface });
  for (const change of [() => mark.x += 3, () => mark.z -= 4, () => mark.radius += 8, () => mark.warp += .09, () => mark.summits[0][2] -= .08, () => mark.summit += 7, () => mark.snowLine -= 18]) {
    change();
    const cached = landmarkGeometry({ definition, surface }), fresh = landmarkGeometry({ definition: structuredClone(definition), surface });
    for (const key of ['positions', 'normals', 'colors', 'uvs', 'spins', 'indices']) assert.deepEqual(cached[key], fresh[key], key);
    assert.notDeepEqual(cached.positions, before.positions);
  }
});

test('grove planting forms layered clearing-edge foliage while leaving the walking route open', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const definition = { ...WILDS_WORLD, landmarks: [], formations: [] }, field = createTerrainField(definition);
  const data = landmarkGeometry({ definition, surface: () => ({ height: 0 }) });
  let tall = 0, middle = 0;
  for (let i = 0; i < data.positions.length; i += 3) {
    const [x, y, z] = data.positions.slice(i, i + 3);
    assert.ok(field.pathDistance(x, z) > 1.8, `plant enters the route at ${x},${z}`);
    if (Math.hypot(x, z) < 18) { if (y > .9) tall++; if (y > .3 && y < .7) middle++; }
    assert.ok(y >= 0 && y < 1.4);
  }
  assert.ok(tall > 100 && middle > 1000);
  assert.ok(data.indices.length / 3 < 69302);
});

test('cached grove planting follows changed banks, clearings and nearby hero trees', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const definition = structuredClone({ ...WILDS_WORLD, landmarks: [], formations: [] }), surface = () => ({ height: 0 });
  const scene = new Scene(new NullEngine()), layer = createWorldLandmarks(scene, { root: new TransformNode('root', scene), definition, surface, still: true });
  try {
    let before = Float32Array.from(layer.meshes[0].getVerticesData('position'));
    for (const change of [() => definition.understory.banks[0].from[0] -= 5, () => definition.clearings[0].radius += 10, () => { definition.trees.heroes[0].x = -10; definition.trees.heroes[0].z = -14; definition.trees.heroes[0].size = 6; }]) {
      change(); layer.refresh();
      const next = layer.meshes[0].getVerticesData('position'), fresh = landmarkGeometry({ definition, surface });
      assert.notDeepEqual(next, before);
      assert.deepEqual(next, fresh.positions);
      before = Float32Array.from(next);
    }
  } finally { scene.dispose(); }
});


test('authored understory banks fill continuous side strips without entering the hearth or route', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const hearth = WILDS_WORLD.landmarks.find(mark => mark.kind === 'hearth');
  const definition = { ...WILDS_WORLD, landmarks: [], formations: [] }, field = createTerrainField(definition);
  const data = landmarkGeometry({ definition, surface: () => ({ height: 0 }) });
  const filled = new Set();
  for (let i = 0; i < data.positions.length; i += 3) {
    const x = data.positions[i], z = data.positions[i + 2];
    if (z > -10 && z < 14) filled.add(`${x < 0 ? 'left' : 'right'}-${Math.floor((z + 10) / 4)}`);
    assert.ok(field.pathDistance(x, z) > 1.8);
    assert.ok(Math.hypot(x - hearth.x, z - hearth.z) > 3.7);
  }
  assert.deepEqual([...filled].sort(), ['left-0', 'left-1', 'left-2', 'left-3', 'left-4', 'left-5', 'right-0', 'right-1', 'right-2', 'right-3', 'right-4', 'right-5']);
  assert.ok(data.indices.length / 3 < 69302);
});
