import { Color3 } from '@babylonjs/core/Maths/math.color.js';

export const POND = Object.freeze({ x: 10, z: .7, rx: 1.95, rz: 1.45 });
export const DOCK = Object.freeze({ x: 9.55, from: 3, to: 1.35, width: .72 });
export const POND_TAG = [10.2, .1, 1.5];
const GROUND = -.175, WATER = GROUND + .015;
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
  const positions = [], colors = [], normals = [], up = [0, 1, 0], SEG = 64, RINGS = 6;
  const deep = rgba('#5f8f9c'), mid = rgba('#7fb0b3'), shallow = rgba('#b3d8cf'), bank = rgba('#c9b58f'), grass = rgba('#9fb187');
  const ringColor = t => t < .55 ? mix(deep, mid, t / .55) : t < .92 ? mix(mid, shallow, (t - .55) / .37) : shallow;
  const at = (k, j, scale = 1, y = WATER) => { const [x, z] = pondPoint(j / SEG * Math.PI * 2, k / RINGS * scale); return [x, y, z]; };
  for (let k = 0; k < RINGS; k++) for (let j = 0; j < SEG; j++) {
    const a = at(k, j), b = at(k, j + 1), c = at(k + 1, j), d = at(k + 1, j + 1), ca = ringColor(k / RINGS), cc = ringColor((k + 1) / RINGS);
    positions.push(...a, ...c, ...b, ...b, ...c, ...d); colors.push(...ca, ...cc, ...ca, ...ca, ...cc, ...cc);
    for (let n = 0; n < 6; n++) normals.push(...up);
  }
  for (let j = 0; j < SEG; j++) {
    const a = at(RINGS, j), b = at(RINGS, j + 1), c = at(RINGS, j, 1.16, GROUND + .004), d = at(RINGS, j + 1, 1.16, GROUND + .004);
    const e = at(RINGS, j, 1.3, GROUND + .002), f = at(RINGS, j + 1, 1.3, GROUND + .002), sand = mix(bank, rgba('#d8c7a1'), hash(j) * .5);
    positions.push(...a, ...c, ...b, ...b, ...c, ...d, ...c, ...e, ...d, ...d, ...e, ...f);
    colors.push(...shallow, ...sand, ...shallow, ...shallow, ...sand, ...sand, ...sand, ...grass, ...sand, ...sand, ...grass, ...grass);
    for (let n = 0; n < 12; n++) normals.push(...up);
  }
  for (const [a0, length, spread] of [[.4, .9, .5], [2.6, .7, .42], [4.4, .55, .6]]) for (let i = 0; i < 3; i++) {
    const a = a0 + i * .12, [x, z] = pondPoint(a, spread + i * .08), dx = Math.cos(a + Math.PI / 2) * length / 2, dz = Math.sin(a + Math.PI / 2) * length / 2 * .6;
    positions.push(x - dx, WATER + .004, z - dz, x + dx, WATER + .004, z + dz, x + dx * .9, WATER + .004, z + dz + .035);
    positions.push(x - dx, WATER + .004, z - dz, x + dx * .9, WATER + .004, z + dz + .035, x - dx * .9, WATER + .004, z - dz + .035);
    for (let n = 0; n < 6; n++) { colors.push(...rgba('#e6f3ec')); normals.push(...up); }
  }
  api.shape(positions, colors, normals);

  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2 + hash(i) * .12;
    if (a > 1.2 && a < 1.9) continue;
    const [x, z] = pondPoint(a, 1.06 + hash(i * 3) * .08), s = .17 + hash(i * 7) * .16;
    api.ball(x, GROUND + .03, z, s * 1.3, s * .55, s, ['#cfc3ad', '#bfb29a', '#d9cdb6', '#b7ab94'][i % 4]);
    if (i % 4 === 1) api.ball(x + .08, GROUND + .08, z - .03, s * .8, s * .35, s * .6, '#8fa678');
  }
  for (const [x, z, s] of [[8.3, -.4, .42], [11.7, -.25, .5], [11.35, 1.95, .34]]) {
    api.ball(x, GROUND + s * .3, z, s * 1.35, s * .8, s, '#b9ad96');
    api.ball(x + s * .15, GROUND + s * .62, z - s * .1, s * .8, s * .3, s * .6, '#8ea477');
  }

  const pads = [[9.1, .15, .36], [9.45, -.3, .28], [10.9, .05, .4], [11.1, .55, .26], [10.35, -.25, .3], [8.85, .85, .3], [10.8, 1.35, .33], [9.9, .3, .22]];
  pads.forEach(([x, z, r], i) => {
    api.cylinder(x, WATER + .012, z, r, r, .014, ['#6f9460', '#7fa36a', '#89aa70'][i % 3]);
    api.box(x + r * .22, WATER + .021, z, r * .45, .004, .018, '#5f8455', [0, i * .9, 0]);
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

  const boat = [10.55, 1.65];
  for (let i = 0; i < 7; i++) {
    const t = i / 6 - .5, w = .42 * Math.cos(t * 2.4);
    api.box(boat[0] + t * 1, WATER + .07, boat[1], .15, .1, w, i % 2 ? '#c46f5c' : '#b8604f', [0, .35, 0]);
  }
  api.box(boat[0], WATER + .13, boat[1], .95, .03, .34, '#e8d7b8', [0, .35, 0]);
  api.box(boat[0] - .05, WATER + .15, boat[1], .07, .03, .36, '#9a7458', [0, .35, 0]);
  api.box(boat[0] - .02, WATER + .2, boat[1] + .02, .6, .025, .03, '#8d6849', [0, 1.1, .1]);
}
