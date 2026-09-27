import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { placeAsset } from '../../models/assets.js';

export const POND = Object.freeze({ x: 10, z: .7, rx: 1.95, rz: 1.45 });
export const DOCK = Object.freeze({ x: 9.55, from: 3, to: 1.35, width: .72 });
export const POND_TAG = [10.45, .1, -.35];
const GROUND = -.175;
export const WATER = GROUND + .012;
const hash = n => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };
const rgba = (hex, shade = 1) => { const c = Color3.FromHexString(hex); return [c.r * shade, c.g * shade, c.b * shade, 1]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const plank = ['#b98d63', '#a97f58', '#c49a6e'];

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

export function buildPond(api) {
  const positions = [], colors = [], normals = [], up = [0, 1, 0], SEG = 64, RINGS = 6, EDGE = .93;
  const deep = rgba('#3f6f80'), mid = rgba('#5f98a2'), shallow = rgba('#98cbc2'), wet = rgba('#8c7a5c'), bank = rgba('#c9b58f'), grass = rgba('#9fb187');
  const ringColor = t => t < .5 ? mix(deep, mid, t / .5) : mix(mid, shallow, (t - .5) / .5);
  const at = (j, scale, y) => { const [x, z] = pondPoint(j / SEG * Math.PI * 2, scale); return [x, y, z]; };
  const band = (j, s0, y0, c0, s1, y1, c1) => {
    const a = at(j, s0, y0), b = at(j + 1, s0, y0), c = at(j, s1, y1), d = at(j + 1, s1, y1);
    positions.push(...a, ...c, ...b, ...b, ...c, ...d); colors.push(...c0, ...c1, ...c0, ...c0, ...c1, ...c1);
    for (let k = 0; k < 6; k++) normals.push(...up);
  };
  for (let k = 0; k < RINGS; k++) for (let j = 0; j < SEG; j++) band(j, k / RINGS * EDGE, WATER, ringColor(k / RINGS), (k + 1) / RINGS * EDGE, WATER, ringColor((k + 1) / RINGS));
  for (let j = 0; j < SEG; j++) {
    const sand = mix(bank, rgba('#d8c7a1'), hash(j) * .5);
    band(j, EDGE, WATER, shallow, EDGE + .03, WATER + .008, mix(shallow, wet, .6));
    band(j, EDGE + .03, WATER + .008, mix(shallow, wet, .6), 1.02, GROUND + .05, wet);
    band(j, 1.02, GROUND + .05, wet, 1.13, GROUND + .035, sand);
    band(j, 1.13, GROUND + .035, sand, 1.28, GROUND + .003, grass);
  }
  api.shape(positions, colors, normals);

  const asset = (name, at) => { const { positions: p, colors: c, normals: n, indices } = placeAsset(name, at); api.shape(p, c, n, indices); };
  const runs = [[-.35, .2], [.72, 1.05], [2.1, 3.0], [3.55, 4.75], [5.2, 5.75]];
  runs.forEach(([from, to], r) => {
    for (let a = from, i = 0; a < to; a += .16 + hash(i * 3 + r) * .12, i++) {
      const [x, z] = pondPoint(a, 1 + (hash(i * 5 + r) - .5) * .08);
      asset(['rock-a', 'rock-b'][(i + r) % 2], { x, y: GROUND - .06, z, yaw: i * 2.1 + r, scale: .2 + hash(i * 7 + r * 3) * .2 });
    }
  });
  for (const [x, z, s] of [[8.3, -.4, .75], [11.7, -.25, .85], [11.35, 1.95, .6]]) {
    asset('rock-b', { x, y: GROUND - .1, z, yaw: x, scale: s });
    asset('rock-a', { x: x + s * .45, y: GROUND - .08, z: z + s * .3, yaw: z, scale: s * .5 });
  }

  const pads = [[9.1, .15, .36], [9.45, -.3, .28], [10.9, .05, .4], [11.1, .55, .26], [10.35, -.25, .3], [8.85, .85, .3], [10.8, 1.35, .33], [9.9, .3, .22]];
  pads.forEach(([x, z, r], i) => {
    api.cylinder(x, WATER + .016, z, r, r, .014, ['#6f9460', '#7fa36a', '#89aa70'][i % 3]);
    api.box(x + r * .22, WATER + .025, z, r * .45, .004, .018, '#5f8455', [0, i * .9, 0]);
    if (i % 3 === 0) {
      for (let p = 0; p < 6; p++) { const a = p / 6 * Math.PI * 2; api.ball(x + Math.cos(a) * .045, WATER + .06, z + Math.sin(a) * .045, .07, .06, .045, p % 2 ? '#f3c7d3' : '#f7dbe2'); }
      api.ball(x, WATER + .075, z, .05, .04, .05, '#f3d98a');
    }
  });

  for (const [a0, count] of [[5.55, 9], [5.95, 7], [3.35, 6]]) for (let i = 0; i < count; i++) {
    const [x, z] = pondPoint(a0 + (hash(i * 2 + a0) - .5) * .5, .98 + hash(i + a0) * .12), tall = .45 + hash(i * 5 + a0) * .45, lean = (hash(i * 9) - .5) * .25;
    api.box(x, GROUND + tall / 2, z, .025, tall, .025, ['#6e8a58', '#7f9a62', '#5f7a4e'][i % 3], [lean, 0, (hash(i * 4) - .5) * .3]);
    if (i % 3 === 0) api.ball(x + lean * tall * .1, GROUND + tall - .06, z, .045, .15, .045, '#8a5f3f');
    else if (i % 3 === 1) api.box(x + .03, GROUND + tall * .35, z, .018, tall * .6, .06, '#86a36a', [.3, 0, .2]);
  }

  const { x, from, to, width } = DOCK;
  for (let z = to; z <= from; z += .17) api.box(x + (hash(z * 13) - .5) * .02, GROUND + .115, z, width + (hash(z * 7) - .5) * .05, .035, .15, plank[Math.round(z * 17) % 3]);
  for (const side of [-1, 1]) {
    api.box(x + side * (width / 2 - .03), GROUND + .075, (from + to) / 2, .05, .04, from - to, '#8d6849');
    for (const z of [to + .05, (from + to) / 2, from - .3]) api.cylinder(x + side * (width / 2 + .02), GROUND + .07, z, .08, .09, .32, '#7a5a42');
  }
  api.box(x + width / 2 + .02, GROUND + .3, to + .05, .05, .38, .05, '#7a5a42');
  api.box(x + width / 2 + .02, GROUND + .5, to + .05, .14, .05, .14, '#5d4636');
  api.ball(x + width / 2 + .02, GROUND + .43, to + .05, .13, .14, .13, '#ffd88f', 2);
  api.box(x - width / 2 + .12, GROUND + .19, to + .25, .22, .12, .16, '#9a7458');
  api.cylinder(x - width / 2 + .12, GROUND + .26, to + .25, .14, .16, .03, '#a3b88a');

  asset('rowboat', { x: 10.55, y: WATER + .08, z: 1.65, yaw: -.35, scale: .44 });
}
