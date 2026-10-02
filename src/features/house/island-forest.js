import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { createTreePaint, treeModel, TREE_FORMS, CROWN_TOPS } from '../../models/world/trees.js';
import { WORLD_ATMOSPHERES } from '../../models/world/atmosphere.js';
import { placeAsset } from '../../models/assets.js';
import { ISLAND, FOREST_REACH, edgePoint, forestBulge, ringGrid, addBody, rgba } from './island-landform.js';
import { ISLAND_SUN } from './island-atmosphere.js';

export const FOREST_PATH = Object.freeze([
  [5.47, 2.98], [5.47, 2], [5.45, .6], [5.47, -.8], [5.5, -2.3], [5.55, -3.55], [5.85, -4.6], [6.7, -4.95],
  [7.7, -5.05], [8.7, -5.05], [9.45, -5.05], [10.1, -5.18], [10.55, -5.48], [10.74, -5.92], [10.76, -6.38],
].map(Object.freeze));
export const FOREST_PATH_WIDTH = .78;
export const FENCE_STRIP = Object.freeze({ from: 5.3, to: 10.9, depth: 1.05 });
const TREE_SCALE = .3;
const SWAY_SCALE = .3;
const DISTANT_EYE = 3.7;
const TOP = -.175, LIFT = .006, MOUND = .26, RINGS = 9, ARC = 64;
const { cx: CX, cz: CZ } = ISLAND;
const hash = n => { const s = Math.sin(n * 63.7 + 21.3) * 43758.5453; return s - Math.floor(s); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = t => Math.max(0, Math.min(1, t));
const smooth = (a, b, t) => { const k = clamp01((t - a) / (b - a)); return k * k * (3 - 2 * k); };

function band(x, z) {
  const a = Math.atan2(z - CZ, x - CX), [ex, ez] = edgePoint(a), inner = Math.hypot(ex - CX, ez - CZ), bulge = forestBulge(a);
  return { t: bulge > 0 ? (Math.hypot(x - CX, z - CZ) / inner - 1) / bulge : -1, width: inner * bulge };
}

export function onForest(x, z, margin = 0) {
  const { t, width } = band(x, z);
  return t >= 0 && t <= 1 && t * width >= margin && (1 - t) * width >= margin;
}

const mound = (t, width) => t <= 0 ? TOP + LIFT : t >= 1 ? TOP : TOP + LIFT * (1 - t) + MOUND * Math.min(1, width / 2.5) * Math.sin(Math.PI * t) ** 1.3;
export function forestFloor(x, z) {
  const { t, width } = band(x, z);
  return mound(t, width);
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
const ACROSS = [-FACING[1], FACING[0]];
export const FOREST_TRAILHEAD = Object.freeze({ position: Object.freeze([ex1, forestFloor(ex1, ez1), ez1]), facing: Object.freeze([FACING[0], 0, FACING[1]]) });
const WOODS_WAY = Object.freeze([[10.86, -7.2], [11.75, -7.62], [12.75, -7.78]].map(Object.freeze));
export const FOREST_CLEARING = WOODS_WAY[1];
const HOME_VIEW = [Math.cos(Math.PI / 2.8), Math.sin(Math.PI / 2.8)];
function inView(x, z, [px, pz]) {
  const dx = x - px, dz = z - pz;
  return { along: dx * HOME_VIEW[0] + dz * HOME_VIEW[1], side: Math.abs(dx * HOME_VIEW[1] - dz * HOME_VIEW[0]) };
}
const WAY_IN_VIEW = spline(WOODS_WAY, 3);
export function hidesTheWay(x, z, crown, top) {
  const arch = inView(x, z, [ex1, ez1]);
  if (arch.along > -.6 && arch.along < 4 && arch.side < FOREST_PATH_WIDTH / 2 + .45 + crown * .8) return true;
  return WAY_IN_VIEW.some(point => {
    const { along, side } = inView(x, z, point);
    return along > -crown && along < top * .5 + crown && side < FOREST_PATH_WIDTH / 2 + .2 + crown * .6;
  });
}
const WOODS_TRAIL = spline([...FOREST_PATH, ...WOODS_WAY]);
const [[wx0, wz0], , [wx1, wz1]] = WOODS_WAY, LANE = [wx1 - wx0, wz1 - wz0].map(v => v / Math.hypot(wx1 - wx0, wz1 - wz0)), LANE_SIDE = [-LANE[1], LANE[0]];

export const forestPathDistance = (x, z) => trailDistance(TRAIL, x, z);
export const woodsDistance = (x, z) => trailDistance(WOODS_TRAIL, x, z);
export function behindFence(x, z) {
  const { t, width } = band(x, z);
  return x > FENCE_STRIP.from && x < FENCE_STRIP.to && t * width < FENCE_STRIP.depth;
}

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
const thicket = (x, z) => .5 + .3 * Math.sin(x * 1.9 + z * .7 + 1.1) * Math.cos(z * 1.4 - x * .5) + .2 * Math.sin(x * 4.3 - z * 3.1);

export const ELDERS = Object.freeze([[6.3, -7.3, 1.12, 1.2], [8.4, -8.9, 1.04, 1.12], [9.9, -9.3, 1.1, 1.16]].map(Object.freeze));
const farBack = (x, z) => clamp01((-(x - CX) * HOME_VIEW[0] - (z - CZ) * HOME_VIEW[1] - 3.4) / 4.6);

export const GROVE = Object.freeze((() => {
  const trees = ELDERS.map(([x, z, size, height], i) => Object.freeze({ x, z, form: TREE_FORMS.conifer, size, height, width: .9, crown: CROWN_REACH[TREE_FORMS.conifer] * TREE_SCALE * size * .9 * .62, turn: i * 2.1 }));
  for (let i = 0; trees.length < 70 && i < 14000; i++) {
    const x = 1 + hash(i * 1.37) * 14, z = -3 - hash(i * 2.11 + 5) * 9, { t } = band(x, z);
    if (!onForest(x, z, .3) || behindFence(x, z) || thicket(x, z) < hash(i * 8.3) * .55) continue;
    const back = farBack(x, z), layer = t * .45 + back * .8 + (hash(i * 3.3 + 1) - .5) * .5;
    const form = layer < .3 ? TREE_FORMS.spreading : layer < .64 ? TREE_FORMS.broadleaf : TREE_FORMS.conifer;
    const conifer = form === TREE_FORMS.conifer;
    const size = (conifer ? .36 + hash(i * 4.9) * .3 + back * .3 : .42 + hash(i * 4.9) * .26 + back * .2) * (form === TREE_FORMS.spreading ? .82 : 1);
    const height = conifer ? .74 + hash(i * 7.3) * .56 + back * .1 : .82 + hash(i * 7.3) * .36, width = conifer ? .78 + hash(i * 9.1) * .4 : .85 + hash(i * 9.1) * .4;
    const crown = CROWN_REACH[form] * TREE_SCALE * size * width * .62, top = CROWN_TOPS[form] * TREE_SCALE * size * height;
    if (woodsDistance(x, z) < FOREST_PATH_WIDTH / 2 + crown * .55 || hidesTheWay(x, z, crown, top)) continue;
    if (Math.hypot(x - FOREST_CLEARING[0], z - FOREST_CLEARING[1]) < .95 + crown * .4) continue;
    const spacing = (.4 + hash(i * 5.7) * .3) * (1 - back * .3);
    if (trees.some(other => Math.hypot(other.x - x, other.z - z) < (other.crown + crown) * spacing)) continue;
    trees.push(Object.freeze({ x, z, form, size, height, width, crown, turn: hash(i * 6.1) * Math.PI * 2 }));
  }
  return trees;
})());
export const grove = () => GROVE;

const FLOOR = { moss: '#5f7f3c', deep: '#46632f', litter: '#8a7748', lawn: '#7da347' };
const FLOOR_LIGHT = { day: [1, 1, 1], dusk: [.74, .78, .9], rain: [.88, .9, .9] };
const lightFor = theme => FLOOR_LIGHT[theme] || FLOOR_LIGHT.day;
const lit = (color, light) => [color[0] * light[0], color[1] * light[1], color[2] * light[2], 1];

function floorColor(x, z, t, light) {
  const n = Math.sin(x * 1.3 + z * .7) * .5 + Math.sin(z * 2.1 - x * .9 + 1.3) * .3 + Math.sin(x * 3.7 + z * 2.9) * .2;
  const shade = GROVE.reduce((sum, tree) => sum + Math.max(0, 1 - Math.hypot(x - tree.x, z - tree.z) / (tree.crown * 1.15)), 0);
  let color = mix(rgba(FLOOR.moss), rgba(FLOOR.litter), smooth(.25, .7, n) * .55);
  color = mix(color, rgba(FLOOR.deep), Math.min(.85, shade * .7));
  return lit(mix(rgba(FLOOR.lawn), color, smooth(0, .3, t)), light);
}

function landform(api, light) {
  const { from, to } = FOREST_REACH, rows = [];
  for (let k = 0; k <= RINGS; k++) rows.push(Array.from({ length: ARC + 1 }, (_, j) => {
    const a = from + (to - from) * j / ARC, bulge = forestBulge(a), t = k / RINGS, [ex, ez] = edgePoint(a);
    const [x, z] = edgePoint(a, k ? 1 + bulge * t : .985), width = Math.hypot(ex - CX, ez - CZ) * bulge;
    return { p: [x, k ? mound(t, width) : TOP + LIFT, z], c: floorColor(x, z, t, light) };
  }));
  addBody(api, ringGrid(rows, false));
}

function trail(api, light) {
  const positions = [], colors = [], normals = [];
  const quad = (a, b, c, d, ca, cb, cc, cd) => {
    const vertex = [[a, ca], [b, cb], [c, cc], [d, cd]];
    for (const tri of [[0, 2, 1], [2, 3, 1]]) for (const k of tri) { positions.push(...vertex[k][0]); colors.push(...vertex[k][1]); normals.push(0, 1, 0); }
  };
  const dirt = ['#c2a97c', '#b49a70', '#cbb488'].map(hex => lit(rgba(hex), light)), edge = lit(rgba('#8c7a52'), light);
  const ground = (x, z) => Math.max(TOP + .012, forestFloor(x, z) + .012);
  const inside = WOODS_TRAIL.length - TRAIL.length;
  const rows = WOODS_TRAIL.map(([x, z], i) => {
    const [px, pz] = WOODS_TRAIL[Math.max(0, i - 1)], [nx, nz] = WOODS_TRAIL[Math.min(WOODS_TRAIL.length - 1, i + 1)];
    const tx = nx - px, tz = nz - pz, length = Math.hypot(tx, tz) || 1, ox = -tz / length, oz = tx / length;
    const fade = i >= TRAIL.length ? .35 + .65 * (WOODS_TRAIL.length - 1 - i) / inside : 1, half = FOREST_PATH_WIDTH / 2 * fade * (.92 + hash(i * 1.9) * .16);
    const at = (w, lift = 0) => { const px2 = x + ox * w, pz2 = z + oz * w; return [px2, ground(px2, pz2) + lift, pz2]; };
    const tint = mix(dirt[i % 3], dirt[(i + 1) % 3], hash(i * 3.1));
    const shaded = mix(tint, lit(rgba(FLOOR.deep), light), smooth(.4, 1, 1 - fade) * .6);
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
    if (i % 3 !== 1) return;
    api.cylinder(x + (hash(i * 7) - .5) * .2, ground(x, z) + .008, z + (hash(i * 5) - .5) * .2, .26 + hash(i) * .1, .3 + hash(i) * .1, .03, ['#ddd3bc', '#cfc3a8', '#d6ccb4'][i % 3]);
  });
}

const LANTERN = { day: ['#f6e3b8', 1.05], dusk: ['#ffc76a', 3.6], rain: ['#f3d699', 2] };
const LANTERN_SPOTS = Object.freeze([[3, 1], [14, 1], [26, 1], [44, -1], [58, -1]]);

function lantern(api, x, z, theme, toward) {
  const [glow, strength] = LANTERN[theme] || LANTERN.day, y = Math.max(TOP, forestFloor(x, z));
  const [hx, hz] = [x + toward[0] * .15, z + toward[1] * .15];
  api.box(x, y + .36, z, .05, .72, .05, '#5c4434');
  api.box((x + hx) / 2, y + .72, (z + hz) / 2, .035, .035, .035, '#5c4434');
  api.box(hx, y + .62, hz, .17, .02, .17, '#3f3229');
  api.ball(hx, y + .53, hz, .15, .18, .15, glow, strength);
  api.box(hx, y + .67, hz, .1, .04, .1, '#3f3229');
}

export function lanternSpots() {
  return LANTERN_SPOTS.map(([i, side]) => {
    const [x, z] = TRAIL[i], [nx, nz] = TRAIL[i + 1], l = Math.hypot(nx - x, nz - z), ox = -(nz - z) / l * side, oz = (nx - x) / l * side, reach = FOREST_PATH_WIDTH / 2 + .2;
    return { x: x + ox * reach, z: z + oz * reach, toward: [-ox, -oz] };
  });
}

function fern(api, x, z, s, seed) {
  const y = forestFloor(x, z);
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + seed, r = .13 * s;
    api.ball(x + Math.cos(a) * r, y + .07 * s, z + Math.sin(a) * r, .3 * s, .06 * s, .1 * s, k % 2 ? '#5d8a3e' : '#6f9a46', 1, .5);
  }
}

function undergrowth(api) {
  const asset = (name, at) => { const { positions, colors, normals, indices } = placeAsset(name, at); api.shape(positions, colors, normals, indices); };
  const { from, to } = FOREST_REACH;
  for (let i = 0; i < 150; i++) {
    const a = from + (to - from) * hash(i * 9.7 + 2), t = .05 + hash(i * 4.3 + 8) * .9, [x, z] = edgePoint(a, 1 + forestBulge(a) * t);
    if (!onForest(x, z, .25) || woodsDistance(x, z) < FOREST_PATH_WIDTH / 2 + .15 || GROVE.some(tree => Math.hypot(tree.x - x, tree.z - z) < .28)) continue;
    const kind = hash(i * 2.3), fence = behindFence(x, z);
    if (kind < .5) fern(api, x, z, (fence ? .5 : .7) + hash(i) * .5, i);
    else if (kind < .66) asset(hash(i * 3) > .5 ? 'rock-a' : 'rock-b', { x, y: forestFloor(x, z) - .06, z, yaw: i, scale: .18 + hash(i * 5) * .18, tint: [.82, .92, .78] });
    else if (kind < .84) {
      const y = forestFloor(x, z), warm = ['#d4683f', '#e09a4a', '#c9503f'][i % 3];
      for (let k = 0; k < 3; k++) {
        const mx = x + (hash(i + k * 3.1) - .5) * .2, mz = z + (hash(i + k * 5.3) - .5) * .2, h = .05 + hash(i * k + 2) * .05;
        api.cylinder(mx, y + h / 2, mz, .025, .03, h, '#efe4cc');
        api.ball(mx, y + h, mz, .1 - k * .015, .05, .1 - k * .015, warm);
      }
    } else if (!fence) {
      asset('bush', { x, y: forestFloor(x, z) - .02, z, yaw: i * 1.3, scale: .36 + hash(i * 1.9) * .2, tint: [.78, .9, .76] });
      if (hash(i * 6.1) > .5) for (let k = 0; k < 4; k++) api.ball(x + Math.cos(k * 1.7 + i) * .17, forestFloor(x, z) + .2 + hash(i + k) * .1, z + Math.sin(k * 1.7 + i) * .17, .06, .06, .06, '#d2453e', 1.2);
    }
  }
  const [cx, cz] = FOREST_CLEARING, cy = forestFloor(cx, cz), turn = Math.atan2(LANE[0], LANE[1]) + .2;
  const [lx, lz] = [cx - LANE_SIDE[0] * .78, cz - LANE_SIDE[1] * .78], ly = forestFloor(lx, lz);
  api.box(lx, ly + .1, lz, .2, .2, 1.25, '#7a5c42', [0, turn, 0]);
  api.cylinder(lx + Math.sin(turn) * .63, ly + .1, lz + Math.cos(turn) * .63, .2, .2, .03, '#c9a879');
  for (let k = 0; k < 3; k++) api.ball(lx + Math.sin(turn) * (k - 1) * .35, ly + .2, lz + Math.cos(turn) * (k - 1) * .35, .18, .06, .16, '#6f9a46');
  for (const [k, side] of [[0, -1], [1, 1]]) {
    const gx = cx - LANE_SIDE[0] * .7 * side + LANE[0] * .3 * k, gz = cz - LANE_SIDE[1] * .7 * side + LANE[1] * .3 * k, gy = forestFloor(gx, gz);
    api.ball(gx, gy + .05, gz, .12, .07, .1, '#e6efd2', 1.5);
    api.box(gx, gy + .03, gz, .02, .06, .02, '#efe4cc');
    api.ball(gx + .12, gy + .04, gz + .06 * side, .08, .05, .07, k ? '#cfe6c4' : '#e6efd2', 1.4);
  }
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2, r = .55 + hash(k * 3.3) * .25;
    api.ball(cx + Math.cos(a) * r, cy + .05, cz + Math.sin(a) * r, .07, .07, .07, ['#f2c14e', '#e8894a', '#f4e1a1'][k % 3], 1.15);
  }
}

function threshold(api, theme) {
  const { position: [x, y, z] } = FOREST_TRAILHEAD, [ax, az] = ACROSS, yaw = Math.atan2(-az, ax);
  const half = FOREST_PATH_WIDTH / 2 + .34, rise = 1.55, segments = 9, [glow, strength] = LANTERN[theme] || LANTERN.day;
  for (const side of [-1, 1]) {
    const px = x + ax * half * side, pz = z + az * half * side;
    api.box(px, y + rise / 2, pz, .17, rise, .17, '#9a7a56', [0, yaw, 0]);
    api.ball(px, y + .07, pz, .36, .16, .3, '#8b8f80');
    api.ball(px + ax * .05 * side, y + rise * .5, pz + az * .05 * side, .17, .36, .17, '#5d8a3e', 1, .2 * side);
    const sx = px + ax * .5 * side, sz = pz + az * .5 * side;
    api.ball(sx, forestFloor(sx, sz) + .1, sz, .42, .28, .36, '#8f9284');
    api.ball(sx, forestFloor(sx, sz) + .24, sz, .3, .08, .26, '#6f9a46');
    api.box(px - FACING[0] * .12, y + rise * .8, pz - FACING[1] * .12, .012, .1, .012, '#3f3a34');
    api.ball(px - FACING[0] * .12, y + rise * .8 - .12, pz - FACING[1] * .12, .19, .23, .19, glow, strength);
  }
  for (let k = 0; k < segments; k++) {
    const theta = Math.PI * (k + .5) / segments, across = Math.cos(theta) * half, up = Math.sin(theta) * half * .75;
    const tangent = Math.atan2(Math.cos(theta) * .75, -Math.sin(theta)), length = half * Math.PI / segments * 1.12;
    api.box(x + ax * across, y + rise + up, z + az * across, length, .15, .18, k % 2 ? '#a3825c' : '#8f6f4d', [0, yaw, tangent]);
    if (hash(k * 4.1) > .35) api.ball(x + ax * across, y + rise + up + .06, z + az * across, .24, .12, .2, k % 2 ? '#6f9a46' : '#5d8a3e');
    if (k % 3 === 1) api.ball(x + ax * across, y + rise + up + .1, z + az * across, .08, .08, .08, '#f2c14e', 1.2);
  }
  api.box(x, y + rise + .08, z, .62, .2, .04, '#b48e62', [0, yaw, 0]);
  api.box(x, y + rise + .08, z, .07, .12, .05, '#6f9a46', [0, yaw, .6]);
}

export function buildForestEdge(api, theme = 'day') {
  const light = lightFor(theme);
  landform(api, light);
  trail(api, light);
  undergrowth(api);
  for (const { x, z, toward } of lanternSpots()) lantern(api, x, z, theme, toward);
  threshold(api, theme);
}

const FOREST_TINTS = Object.freeze({
  day: { leafTop: '#9cc94a', leafUnder: '#3f7a38', leafCrown: '#a2cc52', leafBack: '#d4e68a', needleTop: '#5a9244', needleUnder: '#2c4e34', bark: '#7a6650' },
  dusk: { sunColor: '#e9dcc4', sunStrength: .82, goldenHour: .25, leafTop: '#7f9a68', leafUnder: '#3a5650', leafMid: '#2e4a48', leafCrown: '#7d966a', leafBack: '#c8c8a0', needleTop: '#56745c', needleUnder: '#263c40', bark: '#8a7c6e', skyAmbient: '#8c94c0', groundAmbient: '#55607a', shadowTint: '#5a6290' },
  rain: { leafTop: '#84a166', leafUnder: '#4f6a44', leafCrown: '#7f9c5c', needleTop: '#5f7c54', needleUnder: '#3a5442', bark: '#5e5a46', sunStrength: .62 },
});

export function forestAtmosphere(theme) {
  const base = WORLD_ATMOSPHERES[theme] || WORLD_ATMOSPHERES.day, [x, y, z] = ISLAND_SUN.direction, l = Math.hypot(x, y, z);
  return { ...base, ...(FOREST_TINTS[theme] || FOREST_TINTS.day), sun: [-x / l, -y / l, -z / l], fogDensity: 0, sunScatter: 0 };
}

export function groveMatrices(form) {
  const trees = GROVE.filter(tree => tree.form === form), matrices = new Float32Array(trees.length * 16);
  trees.forEach((tree, i) => {
    const s = TREE_SCALE * tree.size, w = s * tree.width, h = s * tree.height, c = Math.cos(tree.turn) * w, n = Math.sin(tree.turn) * w, y = forestFloor(tree.x, tree.z) - .2 * h;
    matrices.set([c, 0, -n, 0, 0, h, 0, 0, n, 0, c, 0, tree.x, y, tree.z, 1], i * 16);
  });
  return matrices;
}

export function groveBounds() {
  const points = [];
  for (const tree of GROVE) {
    const top = forestFloor(tree.x, tree.z) + CROWN_TOPS[tree.form] * TREE_SCALE * tree.size * tree.height, r = tree.crown;
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
  const sun = new Vector3(), eye = new Vector3();
  const distantEye = scene.onBeforeRenderObservable.add(() => {
    const camera = scene.activeCamera;
    if (!camera?.target) return;
    camera.globalPosition.subtractToRef(camera.target, eye).scaleInPlace(DISTANT_EYE).addInPlace(camera.target);
    paint.setVector3('eye', eye);
  });
  function setTheme(next) {
    const atmosphere = forestAtmosphere(next);
    paintTheme(atmosphere); paint.setVector3('sun', sun.fromArray(atmosphere.sun));
  }
  setTheme(theme);
  return {
    meshes, framing: { points: groveBounds() }, setTheme,
    setEnabled(on) { for (const mesh of meshes) mesh.setEnabled(on); },
    animate(seconds) { paint.setFloat('time', seconds); },
    dispose() { scene.onBeforeRenderObservable.remove(distantEye); for (const mesh of meshes) mesh.dispose(); paint.dispose(); },
  };
}
