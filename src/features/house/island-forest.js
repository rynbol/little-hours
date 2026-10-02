import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { createTreePaint, treeModel, TREE_FORMS, CROWN_TOPS } from '../../models/world/trees.js';
import { WORLD_ATMOSPHERES } from '../../models/world/atmosphere.js';
import { placeAsset } from '../../models/assets.js';
import { onIsland } from './house-island.js';
import { ringGrid, strataBody, strataSteps, addBody, rgba, hangingRoots } from './island-landform.js';
import { ISLAND_SUN } from './island-atmosphere.js';

export const FOREST = Object.freeze({ cx: 7.4, cz: -6.9, rx: 5.6, rz: 3.1, power: 2.4 });
export const FOREST_PATH = Object.freeze([[5.5, -2.95], [5.5, -3.7], [5.55, -4.5], [5.75, -5.2], [6.1, -5.8]].map(Object.freeze));
export const FOREST_PATH_WIDTH = .62;
const TREE_SCALE = .3;
const SWAY_SCALE = .3;
const TOP = -.175, LIFT = .006, MOUND = .22, SEGMENTS = 64, RINGS = 8;
const hash = n => { const s = Math.sin(n * 63.7 + 21.3) * 43758.5453; return s - Math.floor(s); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = t => Math.max(0, Math.min(1, t));
const smooth = (a, b, t) => { const k = clamp01((t - a) / (b - a)); return k * k * (3 - 2 * k); };

export function forestEdgePoint(a, scale = 1) {
  const { cx, cz, rx, rz, power } = FOREST, c = Math.cos(a), s = Math.sin(a);
  const r = (Math.abs(c / rx) ** power + Math.abs(s / rz) ** power) ** (-1 / power);
  const wobble = 1 + .03 * Math.sin(a * 4 + 2.1) + .02 * Math.sin(a * 7 + .7) + .01 * Math.sin(a * 13 + 1.9);
  return [cx + c * r * wobble * scale, cz + s * r * wobble * scale];
}

function reach(x, z) {
  const { cx, cz } = FOREST, a = Math.atan2(z - cz, x - cx), [ex, ez] = forestEdgePoint(a);
  return Math.hypot(x - cx, z - cz) / Math.hypot(ex - cx, ez - cz);
}

export function onForest(x, z, margin = 0) {
  const { cx, cz } = FOREST, a = Math.atan2(z - cz, x - cx), [ex, ez] = forestEdgePoint(a);
  return Math.hypot(x - cx, z - cz) <= Math.hypot(ex - cx, ez - cz) - margin;
}

export function forestFloor(x, z) {
  const t = reach(x, z);
  return TOP + LIFT + (t < 1 ? MOUND * (1 - t * t) ** 2 : 0);
}

function spline(path, steps = 6) {
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[Math.max(0, i - 1)], p1 = path[i], p2 = path[i + 1], p3 = path[Math.min(path.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] + p3[j] - 3 * p2[j]) * t3)));
    }
  }
  out.push(path.at(-1));
  return out;
}
const TRAIL = spline(FOREST_PATH);
const [[ex0, ez0], [ex1, ez1]] = FOREST_PATH.slice(-2), FACING = [ex1 - ex0, ez1 - ez0].map(v => v / Math.hypot(ex1 - ex0, ez1 - ez0));
export const FOREST_TRAILHEAD = Object.freeze({ position: Object.freeze([ex1, forestFloor(ex1, ez1), ez1]), facing: Object.freeze([FACING[0], 0, FACING[1]]) });
const HOME_VIEW = [Math.cos(Math.PI / 2.8), Math.sin(Math.PI / 2.8)];
function inThresholdView(x, z, clearance = 0) {
  const dx = x - ex1, dz = z - ez1, along = dx * HOME_VIEW[0] + dz * HOME_VIEW[1], side = Math.abs(dx * HOME_VIEW[1] - dz * HOME_VIEW[0]);
  return along > -.4 && along < 4 && side < FOREST_PATH_WIDTH / 2 + .45 + clearance;
}
const WOODS_TRAIL = spline([...FOREST_PATH, [ex1 + FACING[0] * 1.2 + .25, ez1 + FACING[1] * 1.2], [ex1 + FACING[0] * 2.5 + .1, ez1 + FACING[1] * 2.5 - .2]]);

export const forestPathDistance = (x, z) => trailDistance(TRAIL, x, z);
const woodsDistance = (x, z) => trailDistance(WOODS_TRAIL, x, z);

function trailDistance(trail, x, z) {
  let best = Infinity;
  for (let i = 0; i < trail.length - 1; i++) {
    const [ax, az] = trail[i], [bx, bz] = trail[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

const CROWN_REACH = [5.4, 3.6, 7.2];

let planted = null;
export const grove = () => planted ??= Object.freeze((() => {
  const trees = [], { cx, cz, rx, rz } = FOREST;
  for (let i = 0; trees.length < 48 && i < 2400; i++) {
    const x = cx + (hash(i * 1.37) * 2 - 1) * rx, z = cz + (hash(i * 2.11 + 5) * 2 - 1) * rz;
    if (!onForest(x, z, .4) || onIsland(x, z, -.25)) continue;
    const back = clamp01((-z - 5) / 4.6), layer = back * 1.15 + (hash(i * 3.3 + 1) - .5) * .5;
    const form = layer < .28 ? TREE_FORMS.spreading : layer < .72 ? TREE_FORMS.broadleaf : TREE_FORMS.conifer;
    const size = (.5 + hash(i * 4.9) * .25 + back * .6) * (form === TREE_FORMS.spreading ? .85 : 1);
    const crown = CROWN_REACH[form] * TREE_SCALE * size * .62;
    if (woodsDistance(x, z) < FOREST_PATH_WIDTH / 2 + crown * .6 || inThresholdView(x, z, crown * .8)) continue;
    if (trees.some(t => Math.hypot(t.x - x, t.z - z) < (t.crown + crown) * .62)) continue;
    trees.push(Object.freeze({ x, z, form, size, crown, turn: hash(i * 6.1) * Math.PI * 2 }));
  }
  return trees;
})());

const FLOOR = { moss: '#5f7f3c', deep: '#46632f', litter: '#8a7748', lawn: '#7da347' };
const RIM = Object.freeze([
  { y: TOP + LIFT, scale: 1, color: '#6f9640' },
  { y: TOP - .1, scale: 1.025, color: '#6f9640' },
  { y: TOP - .26, scale: 1.02, color: '#5a7c3a', tongue: .2 },
]);
const FOREST_DEPTH = -4.3;

function floorColor(x, z, t) {
  const n = Math.sin(x * 1.3 + z * .7) * .5 + Math.sin(z * 2.1 - x * .9 + 1.3) * .3 + Math.sin(x * 3.7 + z * 2.9) * .2;
  const shade = grove().reduce((sum, tree) => sum + Math.max(0, 1 - Math.hypot(x - tree.x, z - tree.z) / (tree.crown * 1.15)), 0);
  let color = mix(rgba(FLOOR.moss), rgba(FLOOR.litter), smooth(.25, .7, n) * .55);
  color = mix(color, rgba(FLOOR.deep), Math.min(.85, shade * .7));
  return mix(color, rgba(FLOOR.lawn), smooth(.7, 1, t) * (onIsland(x, z, -.05) ? 1 : .35));
}

function landform(api) {
  const { cx, cz } = FOREST, angle = j => j / SEGMENTS * Math.PI * 2;
  const top = [];
  for (let k = 0; k <= RINGS; k++) top.push(Array.from({ length: SEGMENTS }, (_, j) => {
    const t = Math.max(.001, k / RINGS), [ex, ez] = forestEdgePoint(angle(j)), x = cx + (ex - cx) * t, z = cz + (ez - cz) * t;
    return { p: [x, forestFloor(x, z), z], c: floorColor(x, z, t) };
  }));
  addBody(api, ringGrid(top));
  const rim = RIM.map(step => Array.from({ length: SEGMENTS }, (_, j) => {
    const [x, z] = forestEdgePoint(angle(j), step.scale);
    const scallop = step.tongue ? Math.max(0, Math.sin(j * Math.PI / 3 + hash(Math.floor(j / 6)) * 2)) ** 2 * step.tongue * (.5 + hash(j * 2.9) * .5) : 0;
    return { p: [x, step.y - scallop, z], c: rgba(step.color) };
  }));
  addBody(api, ringGrid(rim));
  hangingRoots(api, { edge: a => forestEdgePoint(a, 1.01), top: TOP - .3, count: 70, seed: 9, open: (x, z) => !onIsland(x, z, -.1) });
  addBody(api, strataBody({ edge: a => forestEdgePoint(a, 1.005), segments: SEGMENTS, strata: strataSteps(TOP - .3, FOREST_DEPTH), keel: [cx + .4, cz - .3, FOREST_DEPTH], seed: 3 }));
}

function trail(api) {
  const positions = [], colors = [], normals = [];
  const quad = (a, b, c, d, ca, cb, cc, cd) => {
    const vertex = [[a, ca], [b, cb], [c, cc], [d, cd]];
    for (const tri of [[0, 2, 1], [2, 3, 1]]) for (const k of tri) { positions.push(...vertex[k][0]); colors.push(...vertex[k][1]); normals.push(0, 1, 0); }
  };
  const dirt = [rgba('#b49a70'), rgba('#a88d64'), rgba('#bfa77d')], edge = rgba('#8c7a52');
  const ground = (x, z) => Math.max(TOP + .012, forestFloor(x, z) + .012);
  const inside = WOODS_TRAIL.length - TRAIL.length;
  const rows = WOODS_TRAIL.map(([x, z], i) => {
    const [px, pz] = WOODS_TRAIL[Math.max(0, i - 1)], [nx, nz] = WOODS_TRAIL[Math.min(WOODS_TRAIL.length - 1, i + 1)];
    const tx = nx - px, tz = nz - pz, length = Math.hypot(tx, tz) || 1, ox = -tz / length, oz = tx / length;
    const fade = i >= TRAIL.length ? .3 + .7 * (WOODS_TRAIL.length - 1 - i) / inside : 1, half = FOREST_PATH_WIDTH / 2 * fade * (.9 + hash(i * 1.9) * .2);
    const at = (w, lift = 0) => { const px2 = x + ox * w, pz2 = z + oz * w; return [px2, ground(px2, pz2) + lift, pz2]; };
    const tint = mix(dirt[i % 3], dirt[(i + 1) % 3], hash(i * 3.1));
    const shaded = mix(tint, rgba(FLOOR.deep), smooth(.4, 1, 1 - fade) * .6);
    return { core: [at(-half), at(half)], lip: [at(-half - .12, -.004), at(half + .12, -.004)], tint: shaded };
  });
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    quad(a.core[0], a.core[1], b.core[0], b.core[1], a.tint, a.tint, b.tint, b.tint);
    quad(a.lip[0], a.core[0], b.lip[0], b.core[0], edge, a.tint, edge, b.tint);
    quad(a.core[1], a.lip[1], b.core[1], b.lip[1], a.tint, edge, b.tint, edge);
  }
  api.shape(positions, colors, normals);
  TRAIL.forEach(([x, z], i) => {
    if (i % 4 !== 2) return;
    const [nx, nz] = TRAIL[Math.min(TRAIL.length - 1, i + 1)], spin = Math.atan2(nz - z, nx - x);
    api.cylinder(x + (hash(i * 7) - .5) * .14, ground(x, z) + .008, z + (hash(i * 5) - .5) * .14, .24 + hash(i) * .08, .28 + hash(i) * .08, .03, ['#d9cfb8', '#cfc3a8'][i % 2]);
    api.ball(x + Math.sin(spin) * .42, ground(x, z) + .02, z - Math.cos(spin) * .42, .16, .08, .12, '#9da58c');
  });
}

function undergrowth(api) {
  const asset = (name, at) => { const { positions, colors, normals, indices } = placeAsset(name, at); api.shape(positions, colors, normals, indices); };
  const fern = (x, z, s, seed) => {
    const y = forestFloor(x, z);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + seed, r = .13 * s;
      api.ball(x + Math.cos(a) * r, y + .07 * s, z + Math.sin(a) * r, .3 * s, .06 * s, .1 * s, k % 2 ? '#5d8a3e' : '#6f9a46', 1, .5);
    }
  };
  for (let i = 0; i < 120; i++) {
    const { cx, cz, rx, rz } = FOREST, x = cx + (hash(i * 9.7 + 2) * 2 - 1) * rx, z = cz + (hash(i * 4.3 + 8) * 2 - 1) * rz;
    if (!onForest(x, z, .35) || woodsDistance(x, z) < FOREST_PATH_WIDTH / 2 + .12 || grove().some(t => Math.hypot(t.x - x, t.z - z) < .28)) continue;
    if (onIsland(x, z, .2)) continue;
    const kind = hash(i * 2.3);
    if (kind < .55) fern(x, z, .7 + hash(i) * .6, i);
    else if (kind < .75) asset(hash(i * 3) > .5 ? 'rock-a' : 'rock-b', { x, y: forestFloor(x, z) - .06, z, yaw: i, scale: .2 + hash(i * 5) * .18, tint: [.82, .92, .78] });
    else if (kind < .9) {
      const y = forestFloor(x, z);
      api.cylinder(x, y + .04, z, .03, .035, .08, '#efe4cc');
      api.ball(x, y + .09, z, .1, .055, .1, hash(i * 7) > .5 ? '#c96a52' : '#d9b48a');
    } else asset('bush', { x, y: forestFloor(x, z) - .02, z, yaw: i * 1.3, scale: .42 + hash(i * 1.9) * .2, tint: [.78, .9, .76] });
  }
  for (let x = 2.2; x < 12.6; x += .42) {
    let z = -3.2;
    while (onIsland(x, z) && z > -9) z -= .05;
    const hx = x + (hash(x * 3.1) - .5) * .2, hz = z - .18 - hash(x * 5.3) * .2;
    if (!onForest(hx, hz, .5) || woodsDistance(hx, hz) < FOREST_PATH_WIDTH / 2 + .35 || inThresholdView(hx, hz, .2)) continue;
    asset('bush', { x: hx, y: forestFloor(hx, hz) - .03, z: hz, yaw: x * 2.1, scale: .34 + hash(x * 7.7) * .2, tint: [.66, .82, .66] });
    fern(hx + .22, hz + .12, .8, x);
  }
  const { position: [tx, , tz], facing: [fx, , fz] } = FOREST_TRAILHEAD, [ax, az] = [-fz, fx];
  const [lx, lz] = [tx + ax * 1.05 + fx * .35, tz + az * 1.05 + fz * .35];
  api.box(lx, forestFloor(lx, lz) + .09, lz, .18, .18, 1.1, '#7a5c42', [0, Math.atan2(fx, fz) + .5, 0]);
  for (const [k, side] of [[0, -1], [1, 1]]) {
    const gx = tx - ax * 1 * side - fx * .3, gz = tz - az * 1 * side - fz * .3, gy = forestFloor(gx, gz);
    api.ball(gx, gy + .05, gz, .12, .07, .1, '#e6efd2', 1.5);
    api.box(gx, gy + .03, gz, .02, .06, .02, '#efe4cc');
    api.ball(gx + .12, gy + .04, gz + .06 * side, .08, .05, .07, k ? '#cfe6c4' : '#e6efd2', 1.4);
  }
  threshold(api);
}

function threshold(api) {
  const { position: [x, y, z], facing: [fx, , fz] } = FOREST_TRAILHEAD, [ax, az] = [-fz, fx], yaw = Math.atan2(-az, ax);
  const half = FOREST_PATH_WIDTH / 2 + .3, rise = 1.35, segments = 7;
  for (const side of [-1, 1]) {
    const px = x + ax * half * side, pz = z + az * half * side;
    api.box(px, y + rise / 2, pz, .15, rise, .15, '#a08462', [0, yaw, 0]);
    api.ball(px, y + .06, pz, .3, .14, .26, '#8b8f80');
    api.ball(px + ax * .04 * side, y + rise * .55, pz + az * .04 * side, .15, .3, .15, '#5d8a3e', 1, .2 * side);
  }
  for (let k = 0; k < segments; k++) {
    const theta = Math.PI * (k + .5) / segments, across = Math.cos(theta) * half, up = Math.sin(theta) * half * .8;
    const tangent = Math.atan2(Math.cos(theta) * .8, -Math.sin(theta)), length = half * Math.PI / segments * 1.12;
    api.box(x + ax * across, y + rise + up, z + az * across, length, .13, .16, k % 2 ? '#9a7a56' : '#8a6a4a', [0, yaw, tangent]);
    if (hash(k * 4.1) > .45) api.ball(x + ax * across, y + rise + up + .05, z + az * across, .2, .1, .17, k % 2 ? '#6f9a46' : '#5d8a3e');
  }
  const top = y + rise + half * .8;
  api.box(x, top - .14, z, .015, .2, .015, '#3f3a34');
  api.ball(x, top - .3, z, .17, .2, .17, '#ffe2a6', 2);
  api.box(x, top - .2, z, .16, .03, .16, '#5a4636', [0, yaw, 0]);
}

export function buildForestEdge(api) {
  landform(api);
  trail(api);
  undergrowth(api);
}

const FOREST_TINTS = Object.freeze({
  day: { leafTop: '#9cc94a', leafUnder: '#3f7a38', leafCrown: '#a2cc52', leafBack: '#d4e68a', needleTop: '#5a9244', needleUnder: '#2c4e34', bark: '#7a6650' },
  dusk: { sunColor: '#e9dcc4', sunStrength: .82, goldenHour: .25, leafTop: '#7f9a68', leafUnder: '#3a5650', leafMid: '#2e4a48', leafCrown: '#7d966a', leafBack: '#c8c8a0', needleTop: '#56745c', needleUnder: '#263c40', bark: '#8a7c6e', skyAmbient: '#8c94c0', groundAmbient: '#55607a', shadowTint: '#5a6290' },
  rain: { leafTop: '#76935a', leafUnder: '#465e3a', leafCrown: '#71904f', needleTop: '#4f6a46', bark: '#5e5a46', sunStrength: .55 },
});

export function forestAtmosphere(theme) {
  const base = WORLD_ATMOSPHERES[theme] || WORLD_ATMOSPHERES.day, [x, y, z] = ISLAND_SUN.direction, l = Math.hypot(x, y, z);
  return { ...base, ...(FOREST_TINTS[theme] || FOREST_TINTS.day), sun: [-x / l, -y / l, -z / l], fogDensity: 0, sunScatter: 0 };
}

export function groveMatrices(form) {
  const trees = grove().filter(tree => tree.form === form), matrices = new Float32Array(trees.length * 16);
  trees.forEach((tree, i) => {
    const s = TREE_SCALE * tree.size, c = Math.cos(tree.turn) * s, n = Math.sin(tree.turn) * s, y = forestFloor(tree.x, tree.z) - .2 * s;
    matrices.set([c, 0, -n, 0, 0, s, 0, 0, n, 0, c, 0, tree.x, y, tree.z, 1], i * 16);
  });
  return matrices;
}

export function groveBounds() {
  const points = [];
  for (const tree of grove()) {
    const s = TREE_SCALE * tree.size, top = forestFloor(tree.x, tree.z) + CROWN_TOPS[tree.form] * s, r = tree.crown;
    for (const dx of [-r, r]) for (const dz of [-r, r]) points.push(tree.x + dx, top, tree.z + dz);
  }
  return new Float32Array(points);
}

export function createIslandForest(scene, theme = 'day') {
  const { paint, setTheme: paintTheme } = createTreePaint(scene, { name: 'island-forest-paint', still: true });
  const meshes = Object.values(TREE_FORMS).map(form => {
    const matrices = groveMatrices(form);
    if (!matrices.length) return null;
    const model = treeModel(form);
    for (let v = 1; v < model.colors.length; v += 4) model.colors[v] *= SWAY_SCALE;
    const mesh = new Mesh(`island-forest-${form}`, scene);
    Object.assign(new VertexData(), model).applyToMesh(mesh);
    mesh.material = paint; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.metadata = { castShadow: false };
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
    mesh.freezeWorldMatrix();
    return mesh;
  }).filter(Boolean);
  const sun = new Vector3();
  function setTheme(next) {
    const atmosphere = forestAtmosphere(next);
    paintTheme(atmosphere); paint.setVector3('sun', sun.fromArray(atmosphere.sun));
  }
  setTheme(theme);
  return {
    meshes, framing: { points: groveBounds() }, setTheme,
    setEnabled(on) { for (const mesh of meshes) mesh.setEnabled(on); },
    animate(seconds) { paint.setFloat('time', seconds); },
    dispose() { for (const mesh of meshes) mesh.dispose(); paint.dispose(); },
  };
}
