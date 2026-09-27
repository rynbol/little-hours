import { Color3 } from '@babylonjs/core/Maths/math.color.js';

export const ISLAND = Object.freeze({ cx: 2.85, cz: .1, rx: 9.95, rz: 4.65, power: 4.2 });
export const STREAM = Object.freeze([[11.75, 1.3], [12.1, 1.75], [12.5, 2.15], [12.95, 2.5]]);
const TOP = -.175, SEGMENTS = 72, RINGS = 7;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const lawn = ['#a6b68c', '#aebd92', '#9fb187', '#b4c296'];
const rim = '#8ea477', lip = '#7a9368', soil = ['#9b7658', '#86654c'];
const stone = i => ['#d6cab4', '#c8bba3', '#dccfb9'][i % 3];
const rock = ['#c7a98f', '#b39584', '#9c8285', '#83708a', '#6b5d80', '#574d6e'];

export function edgePoint(a, scale = 1) {
  const { cx, cz, rx, rz, power } = ISLAND, c = Math.cos(a), s = Math.sin(a);
  const r = (Math.abs(c / rx) ** power + Math.abs(s / rz) ** power) ** (-1 / power);
  const wobble = 1 + .018 * Math.sin(a * 5 + 1.3) + .012 * Math.sin(a * 9 + .4) + .008 * Math.sin(a * 17 + 2);
  return [cx + c * r * wobble * scale, cz + s * r * wobble * scale];
}
export function onIsland(x, z, margin = 0) {
  const { cx, cz } = ISLAND, a = Math.atan2(z - cz, x - cx), [ex, ez] = edgePoint(a);
  return Math.hypot(x - cx, z - cz) <= Math.hypot(ex - cx, ez - cz) - margin;
}

function rgba(hex, shade = 1) { const c = Color3.FromHexString(hex); return [c.r * shade, c.g * shade, c.b * shade, 1]; }
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function buildIsland(api) {
  const positions = [], colors = [], normals = [];
  const tri = (a, b, c, ca, cb = ca, cc = ca, n = [0, 1, 0]) => { positions.push(...a, ...b, ...c); colors.push(...ca, ...cb, ...cc); normals.push(...n, ...n, ...n); };
  const outward = j => { const [x, z] = edgePoint(angle(j + .5)), dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz * 2.1, .5); return [dx / l, .5 / l, dz * 2.1 / l]; };
  const angle = j => j / SEGMENTS * Math.PI * 2;
  const { cx, cz } = ISLAND;

  const lawnAt = (k, j) => {
    const [ex, ez] = edgePoint(angle(j)), t = k / RINGS;
    return [cx + (ex - cx) * t, TOP, cz + (ez - cz) * t];
  };
  const patch = (x, z) => {
    const n = Math.sin(x * .9 + z * .4) * .5 + Math.sin(z * 1.7 - x * .3 + 1) * .3 + Math.sin(x * 2.3 + z * 2.1) * .2;
    return mix(rgba(lawn[0]), rgba(n > .2 ? lawn[3] : n < -.25 ? lawn[2] : lawn[1]), .75);
  };
  for (let k = 0; k < RINGS; k++) for (let j = 0; j < SEGMENTS; j++) {
    const a = lawnAt(k, j), b = lawnAt(k, j + 1), c = lawnAt(k + 1, j), d = lawnAt(k + 1, j + 1);
    const edge = k === RINGS - 1 ? rgba(rim) : null;
    if (k === 0) { tri(a, c, d, patch(a[0], a[2]), patch(c[0], c[2]), patch(d[0], d[2])); continue; }
    tri(a, c, b, patch(a[0], a[2]), edge || patch(c[0], c[2]), patch(b[0], b[2]));
    tri(b, c, d, patch(b[0], b[2]), edge || patch(c[0], c[2]), edge || patch(d[0], d[2]));
  }

  const profile = [
    { y: TOP, scale: 1, color: rim },
    { y: TOP - .16, scale: 1.012, color: lip, drip: .16 },
    { y: -.7, scale: 1, color: soil[0] },
    { y: -1.2, scale: .975, color: soil[1] },
    { y: -1.85, scale: .9, color: rock[0], rough: .05 },
    { y: -2.5, scale: .78, color: rock[1], rough: .07 },
    { y: -3.15, scale: .6, color: rock[2], rough: .09 },
    { y: -3.75, scale: .4, color: rock[3], rough: .1 },
    { y: -4.25, scale: .2, color: rock[4], rough: .08 },
  ];
  const ring = profile.map((step, r) => Array.from({ length: SEGMENTS + 1 }, (_, j) => {
    const jj = j % SEGMENTS, rough = step.rough ? (hash(jj * 7.3 + r * 13.1) - .5) * 2 * step.rough : 0;
    const [x, z] = edgePoint(angle(jj), step.scale * (1 + rough)), forward = ISLAND.rz * (1 - step.scale) * .82;
    const y = step.y - (step.drip ? hash(jj * 3.1) * step.drip : 0) - (step.rough ? hash(jj * 5.7 + r) * .12 : 0);
    return [x, y, z + forward];
  }));
  const tip = [cx + .4, -4.8, cz + ISLAND.rz * .86];
  for (let r = 0; r < profile.length - 1; r++) for (let j = 0; j < SEGMENTS; j++) {
    const u0 = ring[r][j], u1 = ring[r][j + 1], l0 = ring[r + 1][j], l1 = ring[r + 1][j + 1];
    const shade = .92 + hash(j * 1.7 + r * 5.3) * .14, top = rgba(profile[r].color, shade), bottom = rgba(profile[r + 1].color, shade);
    const n = outward(j); tri(u0, l0, u1, top, bottom, top, n); tri(u1, l0, l1, top, bottom, bottom, n);
  }
  const last = profile.length - 1;
  for (let j = 0; j < SEGMENTS; j++) tri(ring[last][j], tip, ring[last][j + 1], rgba(profile[last].color), rgba(rock[5]), rgba(profile[last].color), outward(j));
  api.shape(positions, colors, normals);

  for (const [x, y, z, w] of [[-8.3, -1.1, 2.6, 1.05], [13.9, -2, -1, .85]]) {
    api.cylinder(x, y - .55 * w, z, w * .9, .08, 1.1 * w, rock[3]);
    api.cylinder(x, y + .02, z, w * 1.05, w * .9, .22 * w, soil[0]);
    api.cylinder(x, y + .16 * w, z, w * 1.08, w * 1.05, .08, rim);
    api.ball(x + .1 * w, y + .26 * w, z, .3 * w, .18 * w, .26 * w, lawn[2]);
  }

  for (let i = 0; i < 34; i++) {
    const a = angle(i * 2.13 + hash(i) * 1.5), [x, z] = edgePoint(a, .985), long = .35 + hash(i * 3.3) * 1.05;
    const vine = i % 3 === 0;
    api.cylinder(x, -.55 - long / 2, z, vine ? .05 : .07, .015, long, vine ? '#6f8a5f' : '#6d5443');
    if (vine) for (let k = 0; k < 3; k++) api.ball(x + (k % 2 ? .05 : -.05), -.6 - long * (k + 1) / 3.4, z, .13, .1, .13, k % 2 ? '#86a36f' : '#7a9764');
  }

  for (let i = 0; i < 46; i++) {
    const a = angle(i * 1.57 + hash(i * 9.1) * .9), [x, z] = edgePoint(a, .975), kind = i % 4;
    if (kind === 0) api.ball(x, TOP + .05, z, .24, .1, .2, ['#c7baa5', '#b3a692'][i % 2]);
    else if (kind === 1) { api.box(x, TOP + .08, z, .02, .16, .02, '#6e855e'); api.ball(x, TOP + .17, z, .1, .07, .1, ['#f1d3dc', '#f5e4bd', '#c8b7d7'][i % 3]); }
    else api.ball(x, TOP + .04, z, .22, .09, .18, ['#8fa678', '#98ae7f'][i % 2]);
  }

  STREAM.forEach(([x, z], i) => {
    const next = STREAM[i + 1]; if (!next) return;
    const mx = (x + next[0]) / 2, mz = (z + next[1]) / 2, length = Math.hypot(next[0] - x, next[1] - z) + .12, turn = -Math.atan2(next[1] - z, next[0] - x);
    api.box(mx, TOP + .012, mz, length, .03, .42, '#8fb8bb', [0, turn, 0]);
    api.box(mx, TOP + .02, mz, length, .02, .2, '#b6d5d2', [0, turn, 0]);
    for (const side of [-1, 1]) api.ball(mx + Math.sin(-turn) * side * .3, TOP + .05, mz + Math.cos(turn) * side * .3, .2, .1, .16, ['#c3b7a2', '#a9b88f'][(i + side + 2) % 2]);
  });

  const fall = waterfallPath(), columns = 9, water = ['#9fcfcf', '#d9f0ea', '#b7ddd8', '#eef8f3'];
  const sheet = (i, c) => { const [x, y, z] = fall[i], t = i / (fall.length - 1), a = (c / columns - .5) * Math.PI, w = .34 + t * .26; return [x + Math.cos(a) * w * .45, y, z + Math.sin(a) * w]; };
  for (let i = 0; i < fall.length - 1; i++) for (let c = 0; c < columns; c++) {
    const a = sheet(i, c), b = sheet(i, c + 1), d = sheet(i + 1, c), e = sheet(i + 1, c + 1), shade = rgba(water[(c + (i > 6 ? 1 : 0)) % water.length]);
    const n = [Math.cos((c / columns - .5) * Math.PI) * .7, .5, Math.sin((c / columns - .5) * Math.PI) * .7];
    tri(a, d, b, shade, shade, shade, n); tri(b, d, e, shade, shade, shade, n);
    tri(a, b, d, shade, shade, shade, n); tri(b, e, d, shade, shade, shade, n);
  }
  api.shape(positions.splice(0), colors.splice(0), normals.splice(0));
  const [fx, fy, fz] = fall.at(-1);
  for (let k = 0; k < 7; k++) api.ball(fx - .45 + hash(k * 4.1) * .9, fy - .1 + hash(k * 2.3) * .45, fz - .5 + hash(k * 6.7) * 1, .8 + hash(k) * .5, .5, .7, k % 2 ? '#f3e7ee' : '#e8dbe6');
  api.ball(STREAM.at(-1)[0] + .12, TOP + .03, STREAM.at(-1)[1], .3, .08, .5, '#e8f5f0');

  for (let i = 0; i < 26; i++) {
    const t = i / 25, x = -2.5 + t * 9.5, z = 3.3 + Math.sin(t * Math.PI * 2.2) * .28 + (t > .9 ? (t - .9) * -2.5 : 0);
    api.cylinder(x + (hash(i) - .5) * .08, TOP + .015, z, .3 + hash(i * 2.7) * .1, .34 + hash(i * 2.7) * .1, .03, stone(i));
    if (i % 3 === 1) api.ball(x + .1, TOP + .03, z + (i % 2 ? .3 : -.3), .16, .07, .12, '#93aa7c');
  }

  for (const [x, y, z, s] of [[-6.2, -2.5, 3.7, 1], [4.4, -4, 4.4, 1.15], [10.4, -3.1, 3.4, .8], [-8.9, -.5, -1.6, .6]]) {
    for (const [dx, dy, dz, r] of [[0, .15, 0, 1.25], [-.8, 0, .15, .9], [.85, -.02, -.05, .95], [-1.45, -.12, .05, .6], [1.5, -.1, .1, .62], [.3, .45, -.2, .8]]) api.ball(x + dx * s, y + dy * s, z + dz * s, r * 1.3 * s, r * .75 * s, r * 1.05 * s, dy > .1 ? '#fffafb' : '#f6edf2');
  }
}

export function waterfallPath() {
  const [x, z] = STREAM.at(-1), points = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; points.push([x + .05 + t * .5 - t * t * .15, TOP - .02 - t * 3.1, z + t * .15]); }
  return points;
}
