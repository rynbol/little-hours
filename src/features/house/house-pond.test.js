import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { buildPond, pondLayout, inPond, DOCK, WATER } from './house-pond.js';
import { placeAsset } from '../../models/assets.js';

const layout = pondLayout();
const apart = (a, b, gap) => Math.hypot(a.x - b.x, a.z - b.z) > gap;
const onDock = ({ x, z }, margin = 0) => Math.abs(x - DOCK.x) < DOCK.width / 2 + margin && z > DOCK.to - margin && z < DOCK.from + margin;

test('a few small lily pads float in open water, clear of each other, the dock and the boat', () => {
  assert.equal(layout.pads.length, 6);
  layout.pads.forEach((pad, i) => {
    assert.ok(pad.r <= .22, `pad ${i} stays small`);
    assert.ok(inPond(pad.x, pad.z, -pad.r), `pad ${i} is afloat`);
    assert.ok(!onDock(pad, pad.r) && apart(pad, layout.boat, pad.r + layout.boat.reach), `pad ${i} is clear of the dock and boat`);
    layout.pads.slice(i + 1).forEach((other, k) => assert.ok(apart(pad, other, pad.r + other.r), `pads ${i} and ${i + k + 1} overlap`));
  });
  assert.equal(layout.pads.filter(pad => pad.bloom).length, 2);
});

test('nothing glows or stands out over open water past the dock', () => {
  const glows = [];
  buildPond({ shape() {}, box() {}, cylinder() {}, ball(x, y, z, w, h, d, hex, strength = 1) { if (strength > 1) glows.push({ x, z }); } });
  assert.deepEqual(glows.filter(({ x, z }) => inPond(x, z) && !onDock({ x, z }, -.03)), []);
});

test('reeds, pebbles and grass tufts sit along the waterline and break up the bank all round', () => {
  for (const { x, z } of [...layout.reeds, ...layout.pebbles, ...layout.tufts]) assert.ok(inPond(x, z, .35) && !inPond(x, z, -.35), `${x.toFixed(2)}, ${z.toFixed(2)} is on the shore`);
  const sides = new Set([...layout.pebbles, ...layout.tufts].map(({ x, z }) => Math.round((Math.atan2(z - .7, x - 10) + Math.PI) / (Math.PI / 2)) % 4));
  assert.deepEqual([...sides].sort(), [0, 1, 2, 3]);
  assert.ok(!layout.pebbles.some(p => onDock(p, .05)) && !layout.tufts.some(t => onDock(t, .05)), 'nothing grows through the dock');
});

test('dock planks span the jetty with a gap between each board', () => {
  const { planks } = layout;
  assert.equal(planks.length, 10);
  assert.ok(planks[0].z - planks[0].depth / 2 < DOCK.to + .05 && planks.at(-1).z + planks.at(-1).depth / 2 > DOCK.from - .2);
  planks.slice(1).forEach((plank, i) => {
    const gap = plank.z - planks[i].z - (plank.depth + planks[i].depth) / 2;
    assert.ok(gap > .006 && gap < .02, `gap ${i} is ${gap.toFixed(3)}`);
  });
});

const waterAt = (theme, x, z) => {
  let best = null;
  buildPond({ shape(p, c) { for (let i = 0; i < p.length / 3; i++) if (Math.abs(p[i * 3 + 1] - WATER) < 1e-6) { const d = Math.hypot(p[i * 3] - x, p[i * 3 + 2] - z); if (!best || d < best.d) best = { d, rgb: [c[i * 4], c[i * 4 + 1], c[i * 4 + 2]] }; } }, box() {}, ball() {}, cylinder() {} }, theme);
  const [r, g, b] = best.rgb;
  return { light: r + g + b, chroma: Math.max(r, g, b) - Math.min(r, g, b) };
};

test('the water deepens gently toward its middle and follows the time of day', () => {
  const middle = waterAt('day', 10.15, .45), shore = waterAt('day', 8.25, .7);
  assert.ok(shore.light - middle.light > .35 && shore.light - middle.light < .8, `a subtle gradient: shore ${shore.light.toFixed(2)}, middle ${middle.light.toFixed(2)}`);
  assert.ok(middle.chroma < .3, `the deep water is not cyan (${middle.chroma.toFixed(2)})`);
  const dusk = waterAt('dusk', 10.15, .45), rain = waterAt('rain', 10.15, .45);
  assert.ok(dusk.light < middle.light - .2, `dusk water is darker (${dusk.light.toFixed(2)})`);
  assert.ok(rain.chroma < middle.chroma - .1, `rain water is greyer (${rain.chroma.toFixed(2)})`);
});

test('the house rebuilds the pond when the time of day changes and keeps it otherwise', () => {
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
    import { Scene } from '@babylonjs/core/scene.js';
    import { freshState } from './src/core/state.js';
    import { createHouseModel } from './src/features/house/house-model.js';
    const context = new Proxy({}, { get: (_, key) => String(key).includes('Gradient') ? () => ({ addColorStop() {} }) : key === 'measureText' ? () => ({ width: 20 }) : () => {} });
    globalThis.document = { addEventListener() {}, removeEventListener() {}, createElement: () => ({ width: 256, height: 256, getContext: () => context }) };
    const engine = new NullEngine(), scene = new Scene(engine), house = freshState().house;
    const day = createHouseModel(scene, house, 'studio', 'day'), dayPond = day.pieces.get('pond').mesh;
    const dusk = createHouseModel(scene, house, 'studio', 'dusk', undefined, day);
    assert.notEqual(dusk.pieces.get('pond').mesh, dayPond, 'dusk repaints the pond');
    const again = createHouseModel(scene, house, 'studio', 'dusk', undefined, dusk);
    assert.equal(again.pieces.get('pond').mesh, dusk.pieces.get('pond').mesh, 'the same time of day keeps the pond batch');
    scene.dispose(); engine.dispose();
  `], { cwd: new URL('../../../', import.meta.url), timeout: 30000, stdio: 'pipe' });
});

test('the boat floats clear of the shore', () => {
  const { x, z, yaw } = layout.boat, hull = placeAsset('rowboat', { x, y: 0, z, yaw, scale: .44 }).positions;
  for (let i = 0; i < hull.length; i += 3) assert.ok(inPond(hull[i], hull[i + 2], -.25), `hull point ${hull[i].toFixed(2)}, ${hull[i + 2].toFixed(2)} is over open water`);
});

test('lily pads take on the dusk and rain light instead of glowing', () => {
  const pads = theme => { const greens = []; buildPond({ shape(p, c) { for (let i = 0; i < p.length / 3; i++) if (Math.abs(p[i * 3 + 1] - (WATER + .016)) < 1e-6) greens.push(c[i * 4 + 1] - Math.max(c[i * 4], c[i * 4 + 2])); }, box() {}, ball() {}, cylinder() {} }, theme); return Math.max(...greens); };
  const day = pads('day');
  for (const theme of ['dusk', 'rain']) assert.ok(pads(theme) < day * .75, `${theme} pads are muted (${pads(theme).toFixed(2)} vs ${day.toFixed(2)})`);
});

test('the pond darkens toward its middle in small even steps, with no hard dark core', () => {
  const lights = [];
  for (let x = 9.45; x <= 11.1; x += .15) lights.push(waterAt('day', x, .4).light);
  for (let i = 1; i < lights.length; i++) assert.ok(Math.abs(lights[i] - lights[i - 1]) < .12, `the water jumps from ${lights[i - 1].toFixed(2)} to ${lights[i].toFixed(2)}`);
});
