import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { heightAt } from '../../core/world-terrain.js';
import { createSeatWorld, valleyMist, butterfliesOut, grassBlades, grassTones, spiritsAloft, moonRise, vistaPalette, windowsLit, FLOCK_SECONDS, SNOW_LINE, SUN_POINT, valleyFloor, VISTA_THEMES, sunRayShape, rainShape, RAIN_SHEETS, MOON_FACE, SEAT_DRAPE, BUTTERFLY_WING } from './seat-world.js';

const setup = () => { const engine = new NullEngine(), scene = new Scene(engine); return { engine, scene, world: createSeatWorld(scene, new TransformNode('room', scene)) }; };
const litWindows = world => {
  const land = world.meshes.find(mesh => mesh.name === 'seat-world-land'), { shape } = land.metadata, colors = land.getVerticesData('color');
  let lit = 0;
  for (let i = 0; i < shape.roles.length; i++) if (shape.roles[i] === 'window' && colors[i * 4] > 0.6) lit++;
  return lit;
};

test('the valley lights up and the moon climbs as a focus session goes on', () => {
  assert.equal(windowsLit('dusk', 0), 0.35);
  assert.equal(windowsLit('dusk', 1), 1);
  assert.equal(windowsLit('day', 1), 0);
  assert.equal(spiritsAloft('dusk', 0), 4);
  assert.equal(spiritsAloft('dusk', 1), 34);
  assert.equal(spiritsAloft('day', 1), 0);
  assert.ok(moonRise(1) > moonRise(0));
  assert.equal(vistaPalette('dusk', 0).zenith.toLowerCase(), VISTA_THEMES.dusk.zenith);
  const rgb = value => [1, 3, 5].map(k => parseInt(value.slice(k, k + 2), 16)), sum = value => rgb(value).reduce((a, b) => a + b);
  for (const progress of [0, 1]) { const [r, g] = rgb(vistaPalette('dusk', progress).zenith); assert.ok(g > r, `dusk zenith at ${progress} is grey-green or night blue, not violet`); }
  assert.ok(sum(vistaPalette('dusk', 1).zenith) < sum(vistaPalette('dusk', 0).zenith) * 0.4, 'the dusk sky deepens into night');
  const rain = rgb(vistaPalette('rain', 1).zenith);
  assert.ok(Math.max(...rain) - Math.min(...rain) < 16, 'the rain sky is an unsaturated olive grey');

  const { engine, world } = setup();
  world.setTheme('dusk'); world.setEnabled(true);
  const early = litWindows(world);
  world.setProgress(1);
  const late = litWindows(world);
  assert.ok(early > 20 && late > early * 2, `${early} windows lit at the start, ${late} at the end`);
  world.setTheme('day');
  assert.equal(litWindows(world), 0);
  engine.dispose();
});

test('the seated room closes its open sides, with a door for every passage, and casts no shadows', () => {
  const { engine, world } = setup();
  world.setShell('retreat', {}, []);
  const bare = world.meshes.find(mesh => mesh.name === 'seat-world-shell').getTotalVertices();
  world.setShell('retreat', { '#c9bba2': '#aabbcc' }, [2.35, -2.05]);
  const shells = world.meshes.filter(mesh => mesh.name === 'seat-world-shell');
  assert.equal(shells.length, 1);
  const [shell] = shells, colors = shell.getVerticesData('color'), roles = shell.metadata.shape.roles;
  assert.ok(shell.getTotalVertices() > bare);
  const wall = roles.indexOf('wall');
  assert.deepEqual([...colors.slice(wall * 4, wall * 4 + 3)].map(v => Math.round(v * 255)), [0xaa, 0xbb, 0xcc]);
  assert.ok(world.meshes.every(mesh => mesh.metadata.castShadow === false));
  engine.dispose();
});

test('the window curtains are gathered drapes, pinched at a brass tie-back, folded front to back, in the one shell mesh', () => {
  const { engine, world } = setup();
  world.setShell('retreat', {}, []);
  const shells = world.meshes.filter(mesh => mesh.name === 'seat-world-shell'), { roles, positions } = shells[0].metadata.shape;
  assert.equal(shells.length, 1);
  const cloth = [];
  roles.forEach((role, i) => { if ((role === 'curtain' || role === 'curtainShade') && positions[i * 3] > 0) cloth.push([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]); });
  assert.ok(cloth.length > 700, `${cloth.length} cloth vertices on one side`);
  const span = (low, high, axis) => { const values = cloth.filter(([, y]) => y >= low && y <= high).map(point => point[axis]); return Math.max(...values) - Math.min(...values); };
  assert.ok(span(SEAT_DRAPE.tie - 0.1, SEAT_DRAPE.tie + 0.1, 0) < span(SEAT_DRAPE.top - 0.2, SEAT_DRAPE.top, 0) * 0.5, 'the drape narrows at the tie-back');
  assert.ok(span(SEAT_DRAPE.tie - 0.1, SEAT_DRAPE.tie + 0.1, 2) > 0.1, 'the folds have depth at the tie-back');
  assert.ok(roles.some((role, i) => role === 'brass' && Math.abs(positions[i * 3 + 1] - SEAT_DRAPE.tie) < 0.05));
  engine.dispose();
});

test('the vista is built ahead of the first sit but shown only when the chair asks for it, and holds still for reduced motion', () => {
  const { engine, world } = setup();
  assert.equal(world.root.isEnabled(false), false);
  assert.equal(world.meshes.length, 0, 'nothing is built before the first sit');
  world.prepare();
  assert.ok(world.meshes.length >= 7 && !world.root.isEnabled(false), 'preparing builds the vista without showing it');
  world.setEnabled(true);
  const flock = world.meshes.find(mesh => mesh.name === 'seat-world-flock').parent;
  world.animate(FLOCK_SECONDS * 0.2, false);
  const moving = flock.rotation.y;
  world.animate(1, false);
  assert.notEqual(flock.rotation.y, moving);
  const still = flock.rotation.y;
  world.animate(5, true);
  assert.equal(flock.rotation.y, still);
  assert.ok(world.meshes.length <= 9, `${world.meshes.length} vista meshes`);
  engine.dispose();
});

test('the fallback valley is calm hills, hamlet, woods and ruins, with no castle, volcano, lava, glyph tower or smoke plume', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const land = world.meshes.find(mesh => mesh.name === 'seat-world-land'), effects = world.meshes.find(mesh => mesh.name === 'seat-world-sky-effects');
  assert.deepEqual([...new Set(land.metadata.shape.roles)].sort(), ['cliff', 'far', 'field', 'glint', 'grass', 'leaf', 'leafLight', 'meadow', 'mid', 'moss', 'roofs0', 'roofs1', 'roofs2', 'roofs3', 'ruin', 'snow', 'stone', 'trunk', 'valley', 'walls0', 'walls1', 'walls2', 'walls3', 'water', 'window', 'windowWarm']);
  const kinds = effects.getVerticesData('uv2').filter((_, k) => k % 2 === 1).map(Math.floor);
  assert.deepEqual([...new Set(kinds)].sort(), [0, 2], 'the sky effects are sunbeams and rain only');
  engine.dispose();
});

test('wind grass grows outside the room, only its tips bend, and it holds still for reduced motion', () => {
  const { positions, uvs } = grassBlades();
  assert.ok(positions.length / 9 > 10000, `${positions.length / 9} blades`);
  for (let v = 0; v < positions.length / 3; v++) {
    const x = positions[v * 3], z = positions[v * 3 + 2];
    if (uvs[v * 2 + 1] > 1.5) continue;
    if (v % 3 < 2) { assert.equal(uvs[v * 2], 0); assert.ok(!(Math.abs(x) < 6.4 && z > -4.9), `blade inside the room at ${x}, ${z}`); } else assert.ok(uvs[v * 2] > 0);
  }
  const { engine, world } = setup();
  world.setEnabled(true);
  const paint = world.meshes.find(mesh => mesh.name === 'seat-world-grass').material;
  world.animate(2, false);
  const swaying = paint._floats.time;
  assert.ok(swaying > 0);
  world.animate(3, true);
  assert.equal(paint._floats.time, swaying);
  engine.dispose();
});

test('cumulus bank up in the view from the chair, and the day sun stays out of the window', () => {
  const { engine, world } = setup();
  world.setTheme('day'); world.setEnabled(true);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-clouds').metadata;
  let inView = 0;
  for (let i = 0; i < shape.roles.length; i++) { const bearing = Math.atan2(shape.positions[i * 3], -shape.positions[i * 3 + 2]); if (bearing > -1.3 && bearing < 0.95) inView++; }
  assert.ok(inView / shape.roles.length > 0.5, `${Math.round(inView / shape.roles.length * 100)}% of cloud in view`);
  const sun = world.meshes.find(mesh => mesh.name === 'seat-world-moon');
  assert.ok(sun.position.y / Math.hypot(sun.position.x, sun.position.z) > 1, 'the day sun rides high above the window');
  engine.dispose();
});

test('the dusk moon rises in open sky just right of the window centre and keeps its bearing through the session', () => {
  const { engine, world } = setup();
  world.setTheme('dusk'); world.setEnabled(true);
  const moon = world.meshes.find(mesh => mesh.name === 'seat-world-moon'), bearing = () => Math.atan2(moon.position.x, -moon.position.z);
  for (const progress of [0, 1]) {
    world.setProgress(progress);
    assert.ok(Math.abs(bearing() - 0.08) < 0.01, `moon bearing ${bearing().toFixed(2)} at progress ${progress}`);
  }
  world.setTheme('day');
  assert.ok(bearing() < -0.5, 'the day sun keeps its heading over the left of the valley');
  engine.dispose();
});

test('wildflowers bloom in drifts on the grass tips, in three colors that dim at dusk', () => {
  const { positions, uvs } = grassBlades(), kinds = new Map();
  let tipY = 0;
  for (let v = 0; v < positions.length / 3; v++) {
    const kind = uvs[v * 2 + 1];
    if (kind < 1.5) { if (v % 3 === 2) tipY = positions[v * 3 + 1]; continue; }
    assert.ok(uvs[v * 2] > 0, 'flowers sway with the blade tips');
    assert.ok(positions[v * 3 + 1] > tipY - 0.2, 'each flower sits at the top of its blade');
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  assert.deepEqual([...kinds.keys()].sort(), [2, 3, 4]);
  assert.ok([...kinds.values()].every(count => count / 6 > 80), `flowers per color ${[...kinds.values()].map(count => count / 6)}`);
  const { engine, world } = setup();
  world.setEnabled(true);
  const paint = world.meshes.find(mesh => mesh.name === 'seat-world-grass').material, lightness = () => paint._colors3.petal.r + paint._colors3.petal.g + paint._colors3.petal.b;
  world.setTheme('day'); const day = lightness();
  world.setTheme('dusk');
  assert.ok(day > 2.8 && lightness() < day * 0.75, `petals ${day.toFixed(2)} by day, ${lightness().toFixed(2)} at dusk`);
  engine.dispose();
});

test('ruined columns stand broken, a shard of stone rising above their moss', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata, at = i => shape.positions.slice(i * 3, i * 3 + 3);
  const moss = [], stone = [];
  shape.roles.forEach((role, i) => { if (role === 'moss') moss.push(at(i)); else if (role === 'ruin') stone.push(at(i)); });
  const broken = stone.filter(([x, y, z]) => moss.some(([mx, my, mz]) => Math.hypot(mx - x, mz - z) < 0.7 && y > my + 0.15));
  assert.ok(broken.length > 300, `${broken.length} stone corners above moss`);
  engine.dispose();
});

test('cloud shadows drift over the ground and the grass by day, soften in rain and stay off at dusk', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const paints = ['seat-world-land', 'seat-world-grass'].map(name => world.meshes.find(mesh => mesh.name === name).material);
  for (const [theme, shadow] of [['day', 1], ['rain', 0.5], ['dusk', 0]]) {
    world.setTheme(theme);
    for (const paint of paints) assert.equal(paint._floats.shadow, shadow, `${paint.name} in ${theme}`);
  }
  world.animate(4, false);
  assert.ok(paints.every(paint => paint._floats.time > 0));
  engine.dispose();
});

test('the far ranges in view wear snow above the snow line and turn sunlit and shaded flanks', () => {
  const { engine, world } = setup();
  world.setEnabled(true); world.setTheme('day');
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata;
  const snow = [], flanks = [];
  for (let i = 0; i < shape.roles.length; i++) {
    const x = shape.positions[i * 3], y = shape.positions[i * 3 + 1], z = shape.positions[i * 3 + 2];
    if (Math.hypot(x, z) < 104 || Math.abs(Math.atan2(x, -z) + 0.3) > 0.8) continue;
    if (shape.roles[i] === 'snow') snow.push(y);
    if (shape.roles[i] === 'far') flanks.push(shape.shades[i]);
  }
  assert.ok(snow.length > 40, `${snow.length} snow vertices in view`);
  assert.ok(snow.every(y => y > SNOW_LINE));
  assert.ok(Math.max(...flanks) - Math.min(...flanks) > 0.3, 'flanks differ in light');
  engine.dispose();
});

test('tree canopies are sunlit on top and deep in shade beneath', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata;
  const canopy = shape.shades.filter((shade, i) => shape.roles[i] === 'leaf' || shape.roles[i] === 'leafLight');
  assert.ok(Math.max(...canopy) / Math.min(...canopy) > 2.5);
  engine.dispose();
});

test('sunbeams fan down from the sun over the valley by day, dim in rain and vanish at dusk', () => {
  const { positions } = sunRayShape(), gap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const rays = Array.from({ length: positions.length / 12 }, (_, i) => [0, 3].map(k => positions.slice(i * 12 + k * 3, i * 12 + k * 3 + 3)));
  const spread = end => Math.max(...rays.flatMap(a => rays.map(b => gap(a[end], b[end]))));
  assert.ok(spread(1) < spread(0) * 0.8, 'tops gather toward the sun');
  assert.ok(rays.every(([bottom, top]) => gap(top, SUN_POINT) < gap(bottom, SUN_POINT) && top[1] > bottom[1] + 30));
  const { engine, world } = setup();
  world.setEnabled(true);
  const rayMesh = world.meshes.find(mesh => mesh.name === 'seat-world-sky-effects');
  for (const [theme, strength] of [['day', 1], ['rain', 0.35], ['dusk', 0]]) {
    world.setTheme(theme);
    assert.equal(rayMesh.material._floats.rays, strength);
  }
  world.setTheme('day'); world.animate(5, true);
  assert.equal(rayMesh.material._floats.time, 0);
  engine.dispose();
});

test('the meadow breaks into warm yellow-green patches warmer than the plain grass tips', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const paint = world.meshes.find(mesh => mesh.name === 'seat-world-grass').material, warmth = color => color.r / color.g;
  for (const theme of ['day', 'dusk', 'rain']) {
    world.setTheme(theme);
    assert.ok(warmth(paint._colors3.warm) > warmth(paint._colors3.tip) + 0.15, theme);
  }
  engine.dispose();
});

test('butterflies flutter over the meadow by day, beating their wings, and hold still for reduced motion', () => {
  assert.deepEqual(['day', 'dusk', 'rain'].map(butterfliesOut), [6, 0, 0]);
  const { engine, world } = setup();
  world.setTheme('day'); world.setEnabled(true);
  const spirits = world.meshes.find(mesh => mesh.name === 'seat-world-spirits');
  const flyers = () => Array.from({ length: 6 }, (_, i) => { const m = spirits._thinInstanceDataStorage.matrixData.slice(i * 16, i * 16 + 16), [x, y, z] = [m[12], m[13], m[14]]; return { y, bearing: Math.atan2(x, -z), wing: Math.hypot(m[0], m[1], m[2]), depth: Math.hypot(m[8], m[9], m[10]) }; });
  world.animate(3, false);
  const first = flyers();
  world.animate(0.05, false);
  const next = flyers();
  for (const { y, bearing } of first) assert.ok(y > 0.5 && y < 2.5 && bearing > -0.7 && bearing < 0.4, `a butterfly at height ${y.toFixed(2)}, bearing ${bearing.toFixed(2)}`);
  assert.ok(first.some((each, i) => Math.abs(each.wing - next[i].wing) > 0.05), 'wings beat from frame to frame');
  world.animate(2, true);
  const held = flyers();
  world.animate(2, true);
  assert.deepEqual(flyers(), held);
  world.setTheme('dusk'); world.animate(0.1, false);
  assert.ok(flyers().every(({ wing, depth }) => Math.abs(wing - depth) < 1e-6), 'no flapping wings at dusk, only round spirits');
  engine.dispose();
});

test('rain spirits stay small pinpricks behind the wet glass while dusk spirits keep their full glow', () => {
  const { engine, world } = setup();
  world.setProgress(1); world.setEnabled(true);
  const spirits = world.meshes.find(mesh => mesh.name === 'seat-world-spirits');
  const largest = theme => {
    world.setTheme(theme);
    let size = 0;
    for (let step = 0; step < 40; step++) {
      world.animate(1, false);
      const m = spirits._thinInstanceDataStorage.matrixData;
      for (let i = 0; i < 34; i++) size = Math.max(size, Math.hypot(m[i * 16 + 8], m[i * 16 + 9], m[i * 16 + 10]));
    }
    return size;
  };
  assert.ok(largest('dusk') > 0.85, 'dusk spirits swell to their full size');
  const rain = largest('rain');
  assert.ok(rain > 0.3 && rain <= 0.4 + 1e-6, `rain spirits peak at ${rain.toFixed(2)}, not a lens-dust blob`);
  engine.dispose();
});

test('dusk spirits are soft round motes turned toward the chair, and day butterflies flap two lobed wings, all in one blended draw', () => {
  const { engine, world } = setup();
  world.setTheme('dusk'); world.setProgress(1); world.setEnabled(true);
  const spirits = world.meshes.find(mesh => mesh.name === 'seat-world-spirits'), { shape } = spirits.metadata;
  assert.equal(world.meshes.filter(mesh => mesh.name === 'seat-world-spirits').length, 1);
  assert.equal(spirits.thinInstanceCount, 34);
  assert.ok(spirits.hasVertexAlpha && spirits.material.disableDepthWrite && spirits.material.needAlphaBlendingForMesh(spirits), 'motes blend softly instead of cutting hard edges');
  const points = () => { const colors = spirits.getVerticesData('color'); return shape.roles.map((_, i) => ({ x: shape.positions[i * 3], y: shape.positions[i * 3 + 1], z: shape.positions[i * 3 + 2], alpha: colors[i * 4 + 3], wing: shape.wings[i] })); };
  const radius = ({ x, y }) => Math.hypot(x, y);
  const mote = points().filter(point => !point.wing), rim = Math.max(...mote.map(radius));
  assert.ok(points().every(({ wing, alpha }) => !wing || alpha === 0), 'no wings after dark');
  assert.ok(mote.every(({ z }) => z === 0), 'the mote is one flat disc');
  assert.equal(mote.find(point => radius(point) === 0).alpha, 1, 'a bright centre');
  const edge = mote.filter(point => Math.abs(radius(point) - rim) < 1e-6);
  assert.ok(edge.length >= 12 && edge.every(({ alpha }) => alpha === 0), 'a round rim of at least 12 points where the glow falls off to nothing');
  const halo = mote.filter(point => radius(point) > 0 && radius(point) < rim - 1e-6);
  assert.ok(halo.length >= 12 && halo.every(({ alpha }) => alpha > 0.2 && alpha < 0.7), 'a halo between the core and the rim');
  world.animate(5, false);
  const matrices = spirits._thinInstanceDataStorage.matrixData;
  let facing = 0;
  for (let i = 6; i < 34; i++) {
    const m = matrices.slice(i * 16, i * 16 + 16), size = Math.hypot(m[8], m[9], m[10]), far = Math.hypot(m[12], m[13], m[14]);
    if (size < 0.05 || m[13] < -100) continue;
    assert.ok(Math.abs((m[8] * m[12] + m[9] * m[13] + m[10] * m[14]) / size / far) > 0.999, `spirit ${i} turns its disc to the chair`);
    facing++;
  }
  assert.ok(facing > 20);
  world.setTheme('day');
  assert.ok(points().every(({ wing, alpha }) => wing ? alpha > 0.9 : alpha === 0), 'only solid wings by day');
  const wings = points().filter(({ wing }) => wing);
  for (const side of [-1, 1]) {
    const wing = wings.filter(({ x }) => x * side > 1e-6);
    assert.ok(wing.every(({ x, y }) => Math.abs(Math.abs(x) - y) < 1e-6), 'each wing hinges on the body and lifts as one surface');
    const reach = wing.map(({ x, z }) => [Math.atan2(Math.abs(x), z), Math.hypot(x, z)]).sort((a, b) => a[0] - b[0]).map(([, r]) => r);
    const peaks = reach.filter((r, k) => k > 0 && k < reach.length - 1 && r > reach[k - 1] && r > reach[k + 1]);
    assert.equal(peaks.length, 2, 'a forewing and a hindwing lobe');
    assert.ok(peaks[0] > peaks[1], 'the forewing is the larger lobe');
  }
  assert.ok(wings.filter(({ x }) => x < -1e-6).length === wings.filter(({ x }) => x > 1e-6).length, 'two matching wings');
  const flap = () => { const m = spirits._thinInstanceDataStorage.matrixData; return Array.from({ length: 6 }, (_, i) => [Math.hypot(m[i * 16], m[i * 16 + 1], m[i * 16 + 2]), Math.hypot(m[i * 16 + 4], m[i * 16 + 5], m[i * 16 + 6])]); };
  const angles = [];
  for (let k = 0; k < 8; k++) {
    world.animate(0.03, false);
    for (const [span, lift] of flap()) { assert.ok(Math.abs(Math.hypot(span, lift) - BUTTERFLY_WING) < 1e-6, 'the wings swing about the hinge instead of stretching'); angles.push(Math.atan2(lift, span)); }
  }
  assert.ok(Math.max(...angles) - Math.min(...angles) > 0.8, 'the wings sweep well up and back down');
  world.animate(1, true);
  assert.ok(flap().every(([span, lift]) => lift < span * 0.2), 'reduced motion rests the wings open and flat');
  engine.dispose();
});

test('the moon carries faint maria rather than dark cartoon craters', () => {
  const { engine, world } = setup();
  world.setTheme('dusk'); world.setEnabled(true);
  const moon = world.meshes.find(mesh => mesh.name === 'seat-world-moon'), colors = moon.getVerticesData('color'), light = [];
  for (let i = 0; i < colors.length / 4; i++) light.push(colors[i * 4] + colors[i * 4 + 1] + colors[i * 4 + 2]);
  assert.ok(Math.min(...light) > Math.max(...light) * 0.85, `darkest ${Math.min(...light).toFixed(2)} of brightest ${Math.max(...light).toFixed(2)}`);
  engine.dispose();
});

test('the valley fades into haze with distance, so the mid-field woods sit well back from the sill', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata;
  const fogAt = (low, high) => { const list = []; for (let i = 0; i < shape.roles.length; i++) { const d = Math.hypot(shape.positions[i * 3], shape.positions[i * 3 + 2]); if (d > low && d < high) list.push(shape.fogs[i]); } return list.reduce((a, b) => a + b, 0) / list.length; };
  const near = fogAt(12, 22), middle = fogAt(50, 62), far = fogAt(140, 175);
  assert.ok(near < 0.12, `near haze ${near.toFixed(2)}`);
  assert.ok(middle > 0.35, `haze in the middle distance ${middle.toFixed(2)}`);
  assert.ok(far > middle && far < 1, 'haze keeps building toward the ranges');
  engine.dispose();
});

function landBoxes(shape) {
  const boxes = [];
  for (let start = 0, i = 1; i <= shape.roles.length; i++) {
    if (i < shape.roles.length && shape.roles[i] === shape.roles[start]) continue;
    if ((i - start) % 20 === 0) for (let b = start; b < i; b += 20) {
      const xs = [], ys = [], zs = [];
      for (let v = b; v < b + 20; v++) { xs.push(shape.positions[v * 3]); ys.push(shape.positions[v * 3 + 1]); zs.push(shape.positions[v * 3 + 2]); }
      const span = list => Math.max(...list) - Math.min(...list), mid = list => (Math.max(...list) + Math.min(...list)) / 2;
      boxes.push({ role: shape.roles[b], tall: span(ys), long: Math.max(span(xs), span(zs)), x: mid(xs), z: mid(zs) });
    }
    start = i;
  }
  return boxes;
}

test('the meadow ruins are weathered: moss drapes down the columns and a column lies toppled at each site', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata, boxes = landBoxes(shape);
  const drapes = boxes.filter(box => box.role === 'moss' && box.tall > 0.6 && box.long < 0.7), toppled = boxes.filter(box => box.role === 'ruin' && box.long > 2.4 && box.tall < 0.9 && box.tall > 0.6);
  assert.ok(drapes.length >= 10, `${drapes.length} moss drapes`);
  assert.ok(toppled.length >= 6, `${toppled.length} toppled columns`);
  engine.dispose();
});

test('the meadow ruins stay low and broad, a broken arch among stumps rather than a skyline of towers', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata;
  const stones = landBoxes(shape).filter(box => box.role === 'ruin' && box.tall > box.long);
  assert.ok(stones.length >= 20, `${stones.length} upright ruin stones`);
  for (const stone of stones) assert.ok(stone.tall <= stone.long * 3 && stone.tall < 3.6, `a ruin stone ${stone.tall.toFixed(2)} tall and ${stone.long.toFixed(2)} wide`);
  const lintels = landBoxes(shape).filter(box => box.role === 'ruin' && box.long > 3.2 && box.tall > 0.7 && box.tall < 0.9);
  assert.ok(lintels.length >= 3, `${lintels.length} arch lintels`);
  engine.dispose();
});

test('the far ranges split into a sunlit band and a shaded band', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata;
  const ranges = shape.roles.map((role, i) => role === 'mid' || role === 'far' ? shape.shades[i] : null).filter(shade => shade !== null);
  const share = test => ranges.filter(test).length / ranges.length;
  assert.ok(share(shade => shade > 0.75 && shade < 1.05) < 0.2, 'few range faces sit between light and shade');
  assert.ok(share(shade => shade <= 0.75) > 0.08 && share(shade => shade >= 1.05) > 0.4, 'both bands carry the ranges');
  engine.dispose();
});

test('the dusk moon glows warm cream through the haze, not grey', () => {
  const { engine, world } = setup();
  world.setTheme('dusk'); world.setEnabled(true);
  const colors = world.meshes.find(mesh => mesh.name === 'seat-world-moon').getVerticesData('color');
  for (let i = 0; i < colors.length / 4; i++) {
    const [r, g, b] = colors.slice(i * 4, i * 4 + 3);
    assert.ok(r > 0.8 && r - b > 0.22 && g - b > 0.12, `moon vertex ${[r, g, b].map(v => v.toFixed(2))}`);
  }
  engine.dispose();
});

test('the meadow ruin stumps wear thick moss caps as wide as the stone, in warm sandstone by day', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata;
  const caps = landBoxes(shape).filter(box => box.role === 'moss' && box.tall > 0.18 && box.tall < 0.26 && box.long >= 1);
  assert.ok(caps.length >= 20, `${caps.length} thick moss caps`);
  const ruin = VISTA_THEMES.day.ruin, [r, , b] = [1, 3, 5].map(k => parseInt(ruin.slice(k, k + 2), 16));
  assert.ok(r - b > 40, `day ruin ${ruin} reads warm`);
  engine.dispose();
});

const cloudCards = world => {
  const mesh = world.meshes.find(mesh => mesh.name === 'seat-world-clouds'), { shape } = mesh.metadata, seeds = mesh.getVerticesData('uv2'), cards = [];
  for (let c = 0; c < shape.roles.length / 6; c++) {
    const corners = [0, 1, 2, 3, 4, 5].map(k => { const i = c * 6 + k; return { x: shape.positions[i * 3], y: shape.positions[i * 3 + 1], z: shape.positions[i * 3 + 2], role: shape.roles[i] }; });
    const x = (corners[0].x + corners[1].x) / 2, z = (corners[0].z + corners[1].z) / 2;
    cards.push({ corners, x, z, distance: Math.hypot(x, z), bearing: Math.atan2(x, -z), low: Math.min(...corners.map(p => p.y)), high: Math.max(...corners.map(p => p.y)), across: Math.hypot(corners[1].x - corners[0].x, corners[1].z - corners[0].z), wisp: seeds[c * 12] < 0 });
  }
  return cards;
};

test('the sky carries low banks, tall cumulus and high wisps on cards that face the seat, sunlit down past the middle and shaded along the base', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const cards = cloudCards(world), cumulus = cards.filter(card => !card.wisp), wisps = cards.filter(card => card.wisp);
  assert.ok(cumulus.length >= 12 && wisps.length >= 3, `${cumulus.length} cumulus and ${wisps.length} wisps`);
  for (const { corners, x, z } of cards) {
    const ax = corners[1].x - corners[0].x, az = corners[1].z - corners[0].z;
    assert.ok(Math.abs(ax * x + az * z) / Math.hypot(ax, az) / Math.hypot(x, z) < 0.01, 'the card turns square to the seat');
    const base = Math.min(...corners.map(p => p.y)), high = Math.max(...corners.map(p => p.y));
    assert.ok(corners.every(p => p.role === (p.y === base ? 'cloudShade' : 'cloud')), 'the shade sits only along the base');
    assert.ok(corners.filter(p => p.role === 'cloud').every(p => p.y < base + (high - base) * 0.4 || p.y === high), 'the sunlit colour reaches down past the middle');
  }
  assert.ok(Math.min(...wisps.map(card => card.low)) > Math.max(...cumulus.map(card => card.high)) - 10, 'the wisps ride above the cumulus');
  assert.ok(cumulus.some(card => card.high - card.low > card.across * 0.6), 'some cumulus tower tall rather than lie flat');
  assert.ok(Math.min(...cumulus.map(card => card.low)) < 12, 'the lowest bank sinks behind the ranges');
  engine.dispose();
});

test('the daytime field reads as soft bright gold-green, with blade roots within a fifth of the tip brightness', () => {
  const luma = color => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b, day = grassTones(vistaPalette('day'));
  assert.ok(luma(day.root) > 0.5);
  assert.ok(luma(day.tip) < luma(day.root) * 1.2);
  for (const theme of Object.keys(VISTA_THEMES)) assert.ok(luma(grassTones(vistaPalette(theme)).root) < luma(grassTones(vistaPalette(theme)).tip), theme);
});

test('by day the clouds stay warm white on their sunlit side and cool blue-grey underneath through the distance haze', () => {
  const { engine, world } = setup();
  world.setEnabled(true); world.setTheme('day');
  const mesh = world.meshes.find(mesh => mesh.name === 'seat-world-clouds'), { shape } = mesh.metadata, colors = mesh.getVerticesData('color');
  const mean = role => { const sum = [0, 0, 0]; let n = 0; shape.roles.forEach((r, i) => { if (r === role) { n++; for (let c = 0; c < 3; c++) sum[c] += colors[i * 4 + c]; } }); return sum.map(v => v / n); };
  const [lr, lg, lb] = mean('cloud'), [sr, sg, sb] = mean('cloudShade');
  assert.ok(lr >= lb && lr > 0.85, `sunlit ${[lr, lg, lb].map(v => v.toFixed(2))}`);
  assert.ok(sb > sr + 0.05 && sb >= sg && sr < lr - 0.15, `shade ${[sr, sg, sb].map(v => v.toFixed(2))}`);
  engine.dispose();
});

test('rain clouds melt into the overcast haze instead of floating as hard dark lumps', () => {
  const { engine, world } = setup();
  world.setEnabled(true); world.setTheme('rain');
  const mesh = world.meshes.find(mesh => mesh.name === 'seat-world-clouds'), { shape } = mesh.metadata, colors = mesh.getVerticesData('color'), haze = vistaPalette('rain').haze;
  const sky = [1, 3, 5].map(k => parseInt(haze.slice(k, k + 2), 16) / 255);
  let gap = 0;
  shape.roles.forEach((_, i) => { gap += Math.max(...sky.map((v, c) => Math.abs(colors[i * 4 + c] - v))) / shape.roles.length; });
  assert.ok(gap < 0.065, `rain clouds sit ${gap.toFixed(3)} from the haze`);
  engine.dispose();
});

test('the seated room baseboards sit on the floor so no wall shows beneath them', () => {
  const { engine, world } = setup();
  world.setShell('retreat', {}, []);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-shell').metadata, low = { front: Infinity, side: Infinity };
  shape.roles.forEach((role, i) => {
    if (role !== 'trim') return;
    const [x, y, z] = shape.positions.slice(i * 3, i * 3 + 3);
    if (z > 4.4 && x < 5.8) low.front = Math.min(low.front, y);
    if (x > 5.8 && z < 4.4) low.side = Math.min(low.side, y);
  });
  assert.ok(low.front <= 0.2 && low.side <= 0.2, `baseboards reach down to ${low.front.toFixed(3)} and ${low.side.toFixed(3)}`);
  engine.dispose();
});

test('hamlet roofs read as tiled gables, with a lit and a shaded slope, courses and a dark ridge and fascia', () => {
  const { engine, world } = setup();
  world.setTheme('day'); world.setEnabled(true);
  const land = world.meshes.find(mesh => mesh.name === 'seat-world-land'), { shape } = land.metadata, shades = [];
  shape.roles.forEach((role, i) => { if (role.startsWith('roofs')) shades.push(shape.shades[i]); });
  const max = Math.max(...shades), min = Math.min(...shades);
  assert.ok(max >= 1.2 && min <= 0.45, `roof shades run ${min.toFixed(2)} to ${max.toFixed(2)}`);
  assert.ok(new Set(shades.map(shade => shade.toFixed(2))).size >= 6, 'slopes, courses, ridge and fascia each have their own value');
  engine.dispose();
});

test('rain falls in sheets at three depths outside the room, denser and fainter with distance, and only in rain', () => {
  const { positions, uvs2 } = rainShape(), sheets = new Map();
  for (let v = 0; v < positions.length / 3; v++) {
    const x = positions[v * 3], z = positions[v * 3 + 2], [columns, kind] = [uvs2[v * 2], uvs2[v * 2 + 1]];
    assert.ok(kind > 2 && kind < 3, 'every rain vertex is marked as rain');
    assert.ok(z < -4.9 || Math.abs(x) > 6.4, `rain at ${x.toFixed(1)}, ${z.toFixed(1)} stays outside the room`);
    sheets.set(columns, Math.max(sheets.get(columns) ?? 0, Math.hypot(x, z + 3.5)));
  }
  const reach = [...sheets.entries()].sort((a, b) => a[1] - b[1]);
  assert.equal(reach.length, 3);
  assert.ok(reach[2][1] > reach[0][1] * 4, 'the far sheet hangs well beyond the near one');
  assert.ok(reach.every(([columns], i) => i === 0 || columns > reach[i - 1][0]), 'farther sheets carry more, finer streaks');
  assert.ok(RAIN_SHEETS.every((sheet, i) => i === 0 || sheet.alpha < RAIN_SHEETS[i - 1].alpha), 'farther sheets are fainter');
  const { engine, world } = setup();
  world.setEnabled(true);
  const paint = world.meshes.find(mesh => mesh.name === 'seat-world-sky-effects').material;
  for (const [theme, rain] of [['rain', 1], ['day', 0], ['dusk', 0]]) { world.setTheme(theme); assert.equal(paint._floats.rain, rain, theme); }
  engine.dispose();
});

test('rain streaks lean 10 to 15 degrees with the wind, falling toward the side the grass bends to', () => {
  const { positions, uvs } = rainShape(), leans = [];
  for (let v = 0; v < positions.length / 3; v += 2) {
    assert.deepEqual([uvs[v * 2 + 1], uvs[v * 2 + 3]], [0, 1], 'each streak column runs from a foot vertex to a head vertex');
    const across = positions[v * 3] - positions[v * 3 + 3], drop = positions[v * 3 + 4] - positions[v * 3 + 1];
    assert.equal(positions[v * 3 + 2], positions[v * 3 + 5], 'the wind leans streaks sideways, the same way wherever the sheet curves');
    assert.ok(across > 0, 'the foot of each streak lies downwind of its head');
    leans.push(Math.atan2(across, drop) * 180 / Math.PI);
  }
  assert.equal(leans.length, 33);
  assert.ok(leans.every(lean => lean >= 10 && lean <= 15), `streaks lean ${Math.min(...leans).toFixed(1)} to ${Math.max(...leans).toFixed(1)} degrees`);
});

test('the moon maria fade into the face with no hard rim', () => {
  const { engine, world } = setup();
  world.setTheme('dusk'); world.setEnabled(true);
  const { shape } = world.meshes.find(mesh => mesh.name === 'seat-world-moon').metadata;
  const face = (x, y) => MOON_FACE.center - (MOON_FACE.center - MOON_FACE.limb) * Math.hypot(x, y) / MOON_FACE.radius;
  const maria = shape.roles.flatMap((_, i) => shape.positions[i * 3 + 2] > 0.01 ? [i] : []);
  const edges = maria.filter(i => shape.shades[i] > face(shape.positions[i * 3], shape.positions[i * 3 + 1]) - 0.02);
  assert.ok(maria.length > 20 && edges.length >= maria.length * 0.8, `${edges.length} of ${maria.length} mare vertices match the face beneath them`);
  for (const i of edges) assert.ok(Math.abs(shape.shades[i] - face(shape.positions[i * 3], shape.positions[i * 3 + 1])) < 0.01, 'a mare rim meets the face at its shade');
  engine.dispose();
});

test('mist pools in the low valley in the middle distance, and the haze warms toward the sun', () => {
  assert.ok(valleyMist(0, valleyFloor(50) + 0.5, -50) > 0.6, 'the valley floor 50 out sits in mist');
  assert.ok(valleyMist(0, valleyFloor(50) + 10, -50) < 0.1, 'a hilltop 10 above it rises clear');
  assert.ok(valleyMist(0, -8, -10) < 0.01, 'the near meadow stays clear');
  const { engine, world } = setup();
  world.setEnabled(true); world.setTheme('dusk');
  const mesh = world.meshes.find(mesh => mesh.name === 'seat-world-land'), { shape } = mesh.metadata, colors = mesh.getVerticesData('color'), sun = -Math.PI / 2 - 0.55;
  const warmth = test => { const ids = shape.roles.flatMap((role, i) => (role === 'mid' || role === 'far') && test(Math.atan2(shape.positions[i * 3 + 2], shape.positions[i * 3])) ? [i] : []); return ids.reduce((sum, i) => sum + colors[i * 4] - colors[i * 4 + 2], 0) / ids.length; };
  const off = a => Math.abs(Math.atan2(Math.sin(a - sun), Math.cos(a - sun)));
  assert.ok(warmth(a => off(a) < 0.15) > warmth(a => off(a) > 1) + 0.04, 'ranges toward the sun take warmer haze than ranges away from it');
  engine.dispose();
});

test('the painted sky, clouds and moon skip the room tone curve, so they match the land and stay brighter than it', () => {
  const { engine, scene, world } = setup();
  scene.imageProcessingConfiguration.toneMappingEnabled = true; scene.imageProcessingConfiguration.exposure = 1.08;
  world.setEnabled(true);
  assert.equal(world.meshes.find(mesh => mesh.name === 'seat-world-clouds').material.imageProcessingConfiguration, undefined, 'the cloud shader writes its colours straight out');
  for (const name of ['seat-world-sky', 'seat-world-moon']) {
    const material = world.meshes.find(mesh => mesh.name === name).material;
    assert.equal(material.imageProcessingConfiguration.toneMappingEnabled, false, name);
    assert.equal(material.imageProcessingConfiguration.exposure, 1, name);
  }
  engine.dispose();
});

test('from the desk chair the valley falls away below the eye, and the ranges sit small in the distance', () => {
  const { engine, world } = setup();
  world.setEnabled(true);
  const { positions, roles } = world.meshes.find(mesh => mesh.name === 'seat-world-land').metadata.shape, eye = [-2, 2.24, -2.41];
  const rise = i => Math.atan2(positions[i * 3 + 1] - eye[1], Math.hypot(positions[i * 3] - eye[0], positions[i * 3 + 2] - eye[2])) * 180 / Math.PI;
  const highest = (test, reach = Infinity) => { let top = -90; for (let i = 0; i < roles.length; i++) { const x = positions[i * 3], z = positions[i * 3 + 2]; if (Math.abs(Math.atan2(x, -z) + 0.2) < 0.9 && test(roles[i], Math.hypot(x, z), x, z) && Math.hypot(x, z) < reach) top = Math.max(top, rise(i)); } return top; };
  assert.ok(highest((role, r) => ['valley', 'field', 'mid'].includes(role) && r > 20, 140) < 0.5, 'the valley floor and the ridge in front of the ranges stay under the eye');
  assert.ok(highest(role => role === 'far' || role === 'snow') < 6, 'the far ranges rise only a few degrees above the horizon');
  engine.dispose();
});

test('when the outdoor world shows through the window, the painted backdrop, its sun rays and its moon step aside but the house shell, birds and motes stay', () => {
  const { world } = setup();
  world.setTheme('day'); world.setEnabled(true);
  const shown = () => Object.fromEntries(world.meshes.map(mesh => [mesh.name.replace('seat-world-', ''), mesh.isEnabled(false)]));
  assert.equal(world.backdrop, true);
  assert.equal(shown().land, true);
  world.setBackdrop(false);
  const day = shown();
  assert.deepEqual([day.sky, day.land, day.grass, day.clouds, day.moon], [false, false, false, false, false]);
  assert.deepEqual([day.spirits, day.flock, day['sky-effects']], [true, true, true]);
  const effects = world.meshes.find(mesh => mesh.name === 'seat-world-sky-effects').material;
  assert.equal(effects._floats.rays, 0);
  world.setTheme('dusk');
  assert.equal(shown().moon, false);
  world.setTheme('day'); world.setBackdrop(true);
  assert.equal(shown().land, true);
  assert.equal(effects._floats.rays, 1);
  world.setTheme('dusk');
  assert.equal(shown().moon, true);
});

test('with the outdoor world at the window, preparing and recoloring build no painted backdrop, and bringing it back builds it in the current light with the dusk moon up', () => {
  const { engine, world } = setup(), reference = setup();
  const names = () => world.meshes.map(mesh => mesh.name.replace('seat-world-', '')).sort();
  const colors = (each, name) => Array.from(each.meshes.find(mesh => mesh.name === name).getVerticesData('color'));
  world.setBackdrop(false); world.prepare(); world.setTheme('dusk'); world.setProgress(0.6); world.setEnabled(true); world.animate(0.5, false);
  assert.deepEqual(names(), ['flock', 'moon', 'shooting', 'sky-effects', 'spirits']);
  world.setBackdrop(true);
  assert.deepEqual(names(), ['clouds', 'flock', 'grass', 'land', 'moon', 'shooting', 'sky', 'sky-effects', 'spirits']);
  reference.world.setTheme('dusk'); reference.world.setProgress(0.6); reference.world.setEnabled(true);
  for (const name of ['seat-world-sky', 'seat-world-land', 'seat-world-clouds']) assert.deepEqual(colors(world, name), colors(reference.world, name), `${name} is painted in the dusk light`);
  assert.equal(world.meshes.find(mesh => mesh.name === 'seat-world-moon').isEnabled(false), true);
  engine.dispose(); reference.engine.dispose();
});

test('with the outdoor world behind the window, focus spirits rise from its real ground instead of the painted hills', () => {
  const { engine, world } = setup();
  world.setTheme('dusk'); world.setProgress(1); world.setEnabled(true); world.setBackdrop(false);
  world.animate(0, true);
  const spirits = world.meshes.find(mesh => mesh.name === 'seat-world-spirits'), data = spirits._thinInstanceDataStorage.matrixData;
  const aloft = Array.from({ length: spiritsAloft('dusk', 1) }, (_, i) => data.slice(i * 16, i * 16 + 16)).filter(m => m[13] > -100);
  assert.equal(aloft.length, 34);
  for (const m of aloft) {
    const above = m[13] - heightAt(m[12], m[14]);
    assert.ok(above > 0 && above < 14, `a spirit ${above.toFixed(1)} m above the real ground at ${m[12].toFixed(0)}, ${m[14].toFixed(0)}`);
  }
  engine.dispose();
});
