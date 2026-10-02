import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { placeAsset } from '../../models/assets.js';

export const POND = Object.freeze({ x: 10, z: .7, rx: 1.95, rz: 1.45 });
export const DOCK = Object.freeze({ x: 9.55, from: 3, to: 1.35, width: .72 });
export const POND_TAG = [10.45, .1, -.35];
const GROUND = -.175;
export const WATER = GROUND + .012;
const EDGE = .93;
const BOAT = Object.freeze({ x: 10.55, z: 1.65, yaw: -.35, scale: .44, reach: .55 });
const DEEPEST = Object.freeze({ x: 10.15, z: .45 });
const hash = n => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };
const rgba = (hex, shade = 1) => { const c = Color3.FromHexString(hex); return [c.r * shade, c.g * shade, c.b * shade, 1]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function pondRadius(a, scale = 1) {
  const wobble = 1 + .07 * Math.sin(a * 3 + .6) + .045 * Math.sin(a * 5 + 2.1) + .025 * Math.sin(a * 9);
  return [POND.rx * wobble * scale, POND.rz * wobble * scale];
}
export function pondPoint(a, scale = 1) {
  const [rx, rz] = pondRadius(a, scale);
  return [POND.x + Math.cos(a) * rx, POND.z + Math.sin(a) * rz];
}
export function inPond(x, z, margin = 0) {
  const a = Math.atan2((z - POND.z) / POND.rz, (x - POND.x) / POND.rx), [rx, rz] = pondRadius(a);
  return Math.hypot((x - POND.x) / (rx + margin), (z - POND.z) / (rz + margin)) <= 1;
}

const PADS = [[9.05, .1, .29], [9.5, -.38, .23], [10.9, .1, .29], [11.25, .62, .21], [10.3, -.32, .24], [8.75, .78, .24], [9.95, .55, .17], [10.75, .7, .14]];
const REED_CLUMPS = [[5.5, 15, 1], [5.9, 11, .9], [3.3, 12, 1], [3.7, 7, .8], [2.55, 8, .85], [.15, 6, .75]];
const BOULDERS = [[4.55, 1.08, .42, 'rock-b'], [4.75, 1.16, .26, 'rock-a'], [4.95, 1.06, .2, 'rock-a'], [5.95, 1.1, .3, 'rock-a'], [3.05, 1.08, .34, 'rock-b'], [.55, 1.1, .3, 'rock-b'], [.85, 1.16, .2, 'rock-a'], [2.1, 1.12, .22, 'rock-a']];
const ISLAND_ROCKS = [[8.3, -.4, .75], [11.7, -.25, .85], [11.35, 1.95, .6]];
const STEPS = [[.15, .96, .14], [.25, .82, .13], [.35, .69, .12]];

export function pondLayout() {
  const pads = PADS.map(([x, z, r], i) => ({ x, z, r, yaw: hash(i * 13) * Math.PI * 2, bloom: i % 3 === 0 }));
  const reeds = REED_CLUMPS.flatMap(([a0, count, size], c) => Array.from({ length: count }, (_, i) => {
    const [x, z] = pondPoint(a0 + (hash(i * 2 + c * 7) - .5) * .42, .9 + hash(i + c * 5) * .16);
    return { x, z, tall: (.38 + hash(i * 5 + c) * .5) * size, lean: [(hash(i * 9 + c) - .5) * .5, (hash(i * 4 + c) - .5) * .5], cattail: i % 4 === 0 };
  }));
  const boulders = BOULDERS.map(([a, scale, size, name], i) => { const [x, z] = pondPoint(a, scale); return { x, z, size, name, yaw: i * 2.1 }; });
  const pebbles = Array.from({ length: 26 }, (_, i) => {
    const a = 1.05 + i / 26 * 1.25 + (hash(i * 3) - .5) * .05, [x, z] = pondPoint(a, .98 + hash(i * 7) * .14);
    return { x, z, r: .05 + hash(i * 11) * .06 };
  }).filter(({ x }) => Math.abs(x - DOCK.x) > DOCK.width / 2 + .06);
  const steps = STEPS.map(([a, scale, r]) => { const [x, z] = pondPoint(a, scale); return { x, z, r }; });
  const planks = [];
  for (let z = DOCK.to + .08, i = 0; z <= DOCK.from - .06; z += .175, i++) planks.push({ z, depth: .15 - hash(i * 3) * .01, width: DOCK.width + (hash(i * 7) - .5) * .05, shift: (hash(i * 13) - .5) * .025, tone: [0, 2, 1, 3, 2, 0, 3, 1, 2, 0][i % 10] });
  return { pads, reeds, boulders, pebbles, steps, planks, boat: BOAT };
}

function waterColor(x, z, s, j) {
  const deep = rgba('#2b7487'), mid = rgba('#4aa2aa'), shallow = rgba('#88d0c3'), shoal = rgba('#a4d2bd'), sky = rgba('#e3f3ef');
  const a = Math.atan2((z - POND.z) / POND.rz, (x - POND.x) / POND.rx), [rx, rz] = pondRadius(a);
  const offset = Math.hypot((x - DEEPEST.x) / rx, (z - DEEPEST.z) / rz) * 1.08, wobble = (hash(j * 1.7) - .5) * .06;
  const depth = 1 - smooth(0, EDGE, Math.max(offset, s) * .5 + offset * .5 + wobble);
  let color = depth < .1 ? mix(shoal, shallow, depth / .1) : depth < .35 ? mix(shallow, mid, (depth - .1) / .25) : mix(mid, deep, Math.min(1, (depth - .35) / .4));
  const sheen = Math.exp(-(((x - POND.x) * .55 - (z - POND.z) * .8 + .25) ** 2) / .09);
  color = mix(color, sky, sheen * .16 * (.4 + .6 * depth));
  return color;
}

function shoreRing(a) {
  const back = Math.max(0, -Math.sin(a)), beach = smooth(.9, 2.2, a) * (1 - smooth(2.3, 2.6, a));
  return { back, beach, lip: GROUND + .018 + .075 * back * back, crest: GROUND + .028 + .055 * back };
}

function shorelineBands(tris) {
  const SEG = 72, RINGS = 9, wet = rgba('#7d6e52'), sand = rgba('#d8c69c'), earth = rgba('#7b6249'), moss = rgba('#8ea76a'), grass = rgba('#9fb187');
  const at = (j, scale, y) => { const [x, z] = pondPoint(j / SEG * Math.PI * 2, scale); return [x, y, z]; };
  const water = (j, s) => { const p = at(j, s, WATER); return { p, c: waterColor(p[0], p[2], s, j) }; };
  const ring = j => {
    const edge = water(j, EDGE).c;
    const { back, beach, lip, crest } = shoreRing(j / SEG * Math.PI * 2), grain = hash(j) * .35;
    const dry = mix(mix(sand, earth, back * .85), rgba('#e2d3ad'), beach * grain);
    return [
      { s: EDGE, y: WATER, c: edge },
      { s: EDGE + .035, y: WATER + .004, c: mix(edge, wet, .45) },
      { s: 1.005, y: WATER + .012, c: mix(wet, dry, .25) },
      { s: 1.06 + back * .03, y: lip, c: dry },
      { s: 1.14 + back * .04, y: crest, c: mix(dry, moss, .55 + back * .4 - beach * .4) },
      { s: 1.32 + back * .06, y: GROUND + .003, c: grass },
    ];
  };
  const quad = (a, b, c, d, ca, cb, cc, cd) => { tris(a, c, b, ca, cc, cb); tris(b, c, d, cb, cc, cd); };
  for (let j = 0; j < SEG; j++) {
    for (let k = 0; k < RINGS; k++) {
      const s0 = k / RINGS * EDGE, s1 = (k + 1) / RINGS * EDGE, a = water(j, s0), b = water(j + 1, s0), c = water(j, s1), d = water(j + 1, s1);
      quad(a.p, b.p, c.p, d.p, a.c, b.c, c.c, d.c);
    }
    const r0 = ring(j), r1 = ring(j + 1);
    for (let k = 0; k < r0.length - 1; k++) quad(at(j, r0[k].s, r0[k].y), at(j + 1, r1[k].s, r1[k].y), at(j, r0[k + 1].s, r0[k + 1].y), at(j + 1, r1[k + 1].s, r1[k + 1].y), r0[k].c, r1[k].c, r0[k + 1].c, r1[k + 1].c);
  }
}

function geometry() {
  const positions = [], colors = [], normals = [];
  const face = (a, b, c) => {
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
    return n.map(v => v / l);
  };
  const tris = (a, b, c, ca, cb = ca, cc = ca, up = true) => {
    const n = up ? [0, 1, 0] : face(a, b, c);
    positions.push(...a, ...b, ...c); colors.push(...ca, ...cb, ...cc); normals.push(...n, ...n, ...n);
  };
  const both = (a, b, c, ca, cb = ca, cc = ca) => { tris(a, b, c, ca, cb, cc, false); tris(a, c, b, ca, cc, cb, false); };
  return { positions, colors, normals, tris, both };
}

function lilyPad({ x, z, r, yaw }, i, { tris }) {
  const SEG = 14, y = WATER + .01, rim = rgba(['#5f8c4f', '#6a9656', '#77a15c'][i % 3]), heart = rgba(['#8ab86a', '#97c070', '#a1c477'][i % 3]), centre = [x, y + .006, z];
  for (let k = 1; k < SEG; k++) {
    const a0 = yaw + k / SEG * Math.PI * 2, a1 = yaw + (k + 1) / SEG * Math.PI * 2, w0 = 1 + (hash(i * 31 + k) - .5) * .08, w1 = 1 + (hash(i * 31 + k + 1) - .5) * .08;
    tris(centre, [x + Math.cos(a0) * r * w0, y, z + Math.sin(a0) * r * w0], [x + Math.cos(a1) * r * w1, y, z + Math.sin(a1) * r * w1], heart, rim, rim);
  }
}

function lotus({ x, z, r }, i, { both }, api) {
  const y = WATER + .02, pink = rgba('#f4c3d0'), blush = rgba('#e796ad'), cream = rgba('#fbe7ea');
  const fx = x + r * .25, fz = z - r * .15;
  for (const [count, reach, lift, spin, base] of [[7, .1, .05, 0, blush], [5, .07, .085, .6, pink]]) for (let p = 0; p < count; p++) {
    const a = spin + i + p / count * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), wide = .028;
    const tip = [fx + ca * reach, y + lift, fz + sa * reach], left = [fx + ca * reach * .45 - sa * wide, y + lift * .35, fz + sa * reach * .45 + ca * wide], right = [fx + ca * reach * .45 + sa * wide, y + lift * .35, fz + sa * reach * .45 - ca * wide];
    both([fx, y, fz], left, tip, base, pink, cream); both([fx, y, fz], tip, right, base, cream, pink);
  }
  api.ball(fx, y + .03, fz, .035, .03, .035, '#f3d27a');
}

function reed({ x, z, tall, lean }, { both }) {
  const root = rgba('#4d6b42'), body = rgba('#6f8d52'), tip = rgba('#b8bf74'), y = GROUND - .01, w = .022;
  const side = [Math.cos(lean[0] * 3 + x), 0, Math.sin(lean[0] * 3 + x)];
  const pt = (t, width) => { const bend = t * t; return [[x + lean[0] * tall * bend - side[0] * width, y + tall * t, z + lean[1] * tall * bend - side[2] * width], [x + lean[0] * tall * bend + side[0] * width, y + tall * t, z + lean[1] * tall * bend + side[2] * width]]; };
  const [a0, a1] = pt(0, w), [b0, b1] = pt(.55, w * .7), top = pt(1, 0)[0];
  both(a0, a1, b0, root, root, body); both(a1, b1, b0, root, body, body); both(b0, b1, top, body, body, tip);
}

function stone({ x, z, r }, i, { tris }, y, hex = '#a7a395') {
  const SEG = 7, top = rgba(hex, 1.06), side = rgba(hex, .82), h = r * (.38 + hash(i * 3) * .2), ring = [];
  for (let k = 0; k <= SEG; k++) { const a = k / SEG * Math.PI * 2 + i, w = 1 + (hash(i * 17 + k % SEG) - .5) * .3; ring.push([x + Math.cos(a) * r * w, y, z + Math.sin(a) * r * w * .85]); }
  const crown = [x, y + h, z], shoulder = ring.map(([px, , pz]) => [x + (px - x) * .65, y + h * .78, z + (pz - z) * .65]);
  for (let k = 0; k < SEG; k++) {
    tris(crown, shoulder[k], shoulder[k + 1], top, top, top, false);
    tris(shoulder[k], ring[k], shoulder[k + 1], top, side, top, false); tris(shoulder[k + 1], ring[k], ring[k + 1], top, side, side, false);
  }
}

function ripple(x, z, r, { tris }) {
  const SEG = 20, y = WATER + .004, c = rgba('#a9dcd2');
  for (let k = 0; k < SEG; k++) {
    if (k % 5 === 4) continue;
    const a0 = k / SEG * Math.PI * 2, a1 = (k + 1) / SEG * Math.PI * 2, at = (a, rr) => [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr * .8];
    tris(at(a0, r), at(a0, r + .018), at(a1, r), c); tris(at(a1, r), at(a0, r + .018), at(a1, r + .018), c);
  }
}

function rope(points, { both }) {
  const c = rgba('#d8c296'), t = .008;
  for (let k = 0; k < points.length - 1; k++) { const [a, b] = [points[k], points[k + 1]]; both([a[0], a[1] - t, a[2]], [b[0], b[1] - t, b[2]], [a[0], a[1] + t, a[2]], c); both([b[0], b[1] - t, b[2]], [b[0], b[1] + t, b[2]], [a[0], a[1] + t, a[2]], c); }
}

function dock(planks, api) {
  const { x, from, to, width } = DOCK, deck = GROUND + .115, tones = ['#b39674', '#a88b6c', '#bfa27f', '#9d8466'];
  for (const { z, depth, width: w, shift, tone } of planks) api.box(x + shift, deck, z, w, .032, depth, tones[tone]);
  for (const side of [-1, 1]) {
    api.box(x + side * (width / 2 - .08), deck - .045, (from + to) / 2, .06, .06, from - to, '#8a7058');
    for (const z of [to + .04, (from + to) / 2 - .2, from - .35]) api.cylinder(x + side * (width / 2 + .015), deck - .09, z, .085, .095, .36, '#6a5443');
    api.cylinder(x + side * (width / 2 + .015), deck + .1, to + .04, .085, .085, .2, '#6a5443');
    api.cylinder(x + side * (width / 2 + .015), deck + .1, to + .04, .095, .095, .05, '#d8c296');
  }
  for (const side of [-1, 1]) api.box(x - .12 + side * .1, deck - .06, to - .03, .025, .2, .025, '#7d6650');
  for (const y of [-.02, -.09]) api.box(x - .12, deck + y, to - .03, .22, .02, .02, '#7d6650');
  api.box(x - width / 2 - .015, deck + .3, to + .04, .045, .42, .045, '#6a5443');
  api.box(x - width / 2 - .015, deck + .55, to + .04, .13, .05, .13, '#4f4034');
  api.ball(x - width / 2 - .015, deck + .48, to + .04, .11, .12, .11, '#ffd88f', 2);
  api.box(x - width / 2 + .14, deck + .07, from - .25, .2, .11, .15, '#8e7258', [0, .2, 0]);
  api.cylinder(x - width / 2 + .14, deck + .14, from - .25, .13, .15, .025, '#a3b88a');
  api.cylinder(x + .1, deck + .05, from - .62, .1, .08, .08, '#5f7f8c');
}

export function buildPond(api) {
  const g = geometry(), layout = pondLayout();
  shorelineBands(g.tris);
  layout.pads.forEach((pad, i) => { lilyPad(pad, i, g); if (pad.bloom) lotus(pad, i, g, api); });
  [...layout.pads.filter((_, i) => i % 2 === 0).map(({ x, z, r }) => [x, z, r + .07]), [BOAT.x, BOAT.z, .5], [DOCK.x, DOCK.to - .02, .22]].forEach(([x, z, r]) => ripple(x, z, r, g));
  layout.reeds.forEach(stem => reed(stem, g));
  layout.pebbles.forEach((p, i) => stone(p, i, g, GROUND + .01, ['#b9b2a0', '#a29c8b', '#c7bfa9'][i % 3]));
  layout.steps.forEach((p, i) => stone(p, i + 40, g, WATER - .01, '#9c9a8c'));
  const { x, to, width } = DOCK, post = x + width / 2 + .015;
  rope([[post, GROUND + .2, to + .04], [(post + BOAT.x) / 2, WATER + .05, (to + BOAT.z) / 2 - .05], [BOAT.x - .35, WATER + .1, BOAT.z - .15]], g);
  api.shape(g.positions, g.colors, g.normals);

  const asset = (name, at) => { const { positions: p, colors: c, normals: n, indices } = placeAsset(name, at); api.shape(p, c, n, indices); };
  for (const { x: bx, z, size, name, yaw } of layout.boulders) {
    asset(name, { x: bx, y: GROUND - .06, z, yaw, scale: size, tint: [.95, .98, .92] });
    api.ball(bx + size * .08, GROUND + size * .5, z - size * .05, size * .5, size * .1, size * .42, '#8fae6a');
  }
  for (const [rx, rz, s] of ISLAND_ROCKS) {
    asset('rock-b', { x: rx, y: GROUND - .1, z: rz, yaw: rx, scale: s });
    asset('rock-a', { x: rx + s * .45, y: GROUND - .08, z: rz + s * .3, yaw: rz, scale: s * .5 });
  }
  for (const { x: cx, z, tall, lean, cattail } of layout.reeds) if (cattail) api.ball(cx + lean[0] * tall * .7, GROUND + tall * .82, z + lean[1] * tall * .7, .04, .13, .04, '#7d5338');
  dock(layout.planks, api);
  asset('rowboat', { x: BOAT.x, y: WATER + .08, z: BOAT.z, yaw: BOAT.yaw, scale: BOAT.scale });
}
