import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { buildPaths } from './house-paths.js';
import { placeAsset } from '../../models/assets.js';
import { buildForestEdge } from './island-forest.js';
import { ISLAND, edgePoint, landmassEdge, onIsland, strataBody, strataSteps, spire, addBody, hangingRoots } from './island-landform.js';

export { ISLAND, edgePoint, onIsland };

export const STREAMS = Object.freeze([
  [[11.75, 1.3], [12.1, 1.75], [12.5, 2.15], [12.95, 2.5]],
  [[-3.85, 3.5], [-4.15, 3.9], [-4.45, 4.25], [-4.8, 4.62]],
  [[10.55, -2.7], [11, -2.88], [11.45, -3.05], [12.25, -3.42]],
]);
const TOP = -.175, SEGMENTS = 72, RINGS = 7, EDGE = 120;
export const ISLAND_DEPTH = -5.4;
const SPIRES = Object.freeze([[-1.5, -.4, 2.4, .9], [4.2, 1.1, 2.9, 1.1], [8.4, -.6, 2, .8], [1.4, -1.7, 1.6, .7], [-4.3, .9, 1.4, .6], [10.7, .8, 1.3, .55]].map(Object.freeze));
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const lawn = ['#7aa046', '#8cb24e', '#6b9140', '#a3c35c'];
const rim = '#6f9640', lip = '#5b7f3a';
export const RIM_LIGHT = Object.freeze({ day: [1, 1, 1], dusk: [.6, .68, .88], rain: [.78, .84, .86] });

function rgba(hex, shade = 1) { const c = Color3.FromHexString(hex); return [c.r * shade, c.g * shade, c.b * shade, 1]; }
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function buildIsland(api, theme = 'day') {
  const positions = [], colors = [], normals = [];
  const tri = (a, b, c, ca, cb = ca, cc = ca, n = [0, 1, 0]) => { positions.push(...a, ...b, ...c); colors.push(...ca, ...cb, ...cc); normals.push(...n, ...n, ...n); };
  const outward = j => { const [ax, az] = landmassEdge(edgeAngle(j)), [bx, bz] = landmassEdge(edgeAngle(j + 1)), along = Math.hypot(bx - ax, bz - az), dx = (bz - az) / along, dz = (ax - bx) / along * 2.1, l = Math.hypot(dx, dz, .5); return [dx / l, .5 / l, dz / l]; };
  const angle = j => j / SEGMENTS * Math.PI * 2, edgeAngle = j => j / EDGE * Math.PI * 2;
  const { cx, cz } = ISLAND, light = RIM_LIGHT[theme] || RIM_LIGHT.day, toned = (hex, shade = 1) => rgba(hex, shade).map((v, i) => i < 3 ? v * light[i] : v);

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
    const edge = k === RINGS - 1 ? toned(rim) : null;
    if (k === 0) { tri(a, c, d, patch(a[0], a[2]), patch(c[0], c[2]), patch(d[0], d[2])); continue; }
    tri(a, c, b, patch(a[0], a[2]), edge || patch(c[0], c[2]), patch(b[0], b[2]));
    tri(b, c, d, patch(b[0], b[2]), edge || patch(c[0], c[2]), edge || patch(d[0], d[2]));
  }

  const profile = [
    { y: TOP, scale: 1, color: rim },
    { y: TOP - .1, scale: 1.02, color: rim },
    { y: TOP - .25, scale: 1.018, color: lip, tongue: .22 },
  ];
  const ring = profile.map((step, r) => Array.from({ length: EDGE + 1 }, (_, j) => {
    const jj = j % EDGE, [x, z] = landmassEdge(edgeAngle(jj), step.scale);
    const scallop = step.tongue ? Math.max(0, Math.sin(jj * Math.PI / 3 + hash(Math.floor(jj / 6)) * 2)) ** 2 * step.tongue * (.5 + hash(jj * 2.9) * .5) : 0;
    return [x, step.y - scallop, z];
  }));
  for (let r = 0; r < profile.length - 1; r++) for (let j = 0; j < EDGE; j++) {
    const u0 = ring[r][j], u1 = ring[r][j + 1], l0 = ring[r + 1][j], l1 = ring[r + 1][j + 1];
    const shade = .93 + hash(j * 1.7 + r * 5.3) * .12, top = toned(profile[r].color, shade), bottom = toned(profile[r + 1].color, shade);
    const n = outward(j); tri(u0, l0, u1, top, bottom, top, n); tri(u1, l0, l1, top, bottom, bottom, n);
  }
  api.shape(positions.splice(0), colors.splice(0), normals.splice(0));
  const asset = (name, at) => { const { positions: p, colors: c, normals: n, indices } = placeAsset(name, at); api.shape(p, c, n, indices); };
  for (const body of islandCliff()) addBody(api, body);
  hangingRoots(api, { edge: a => landmassEdge(a, .998), top: TOP - .26, count: 150 });
  asset('islet-a', { x: -8.3, y: -1, z: 2.6, yaw: .4, scale: 1.1 });
  asset('islet-b', { x: 13.9, y: -1.9, z: -1, yaw: 2, scale: 1 });

  for (let i = 0; i < 14; i++) {
    const [x, z] = edgePoint(angle(i * 5.3 + hash(i * 3.7) * 2), .96);
    if (!onIsland(x, z, .2) || Math.abs(z) < 3.3 && x > -6 && x < 5.5) continue;
    asset('bush', { x, y: TOP - .02, z, yaw: i * 1.9, scale: .55 + hash(i * 2.1) * .35, tint: light });
  }

  STREAMS.forEach((course, s) => {
    course.forEach(([x, z], i) => {
      const next = course[i + 1]; if (!next) return;
      const dx = next[0] - x, dz = next[1] - z, length = Math.hypot(dx, dz), mx = (x + next[0]) / 2, mz = (z + next[1]) / 2;
      api.box(mx, TOP + .004, mz, length + .12, .02, .5, '#6f8f84', [0, -Math.atan2(dz, dx), 0]);
      for (const side of [-1, 1]) asset(['rock-a', 'rock-b'][(i + side + 2) % 2], { x: mx - dz / length * side * .33, y: TOP - .05, z: mz + dx / length * side * .33, yaw: i * 2 + side, scale: .22 + hash(i * 3 + s * 7 + side) * .12 });
    });
    if (s) {
      const [x, z] = course[0];
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + s; asset(k % 2 ? 'rock-a' : 'rock-b', { x: x + Math.cos(a) * .5, y: TOP - .05, z: z + Math.sin(a) * .4, yaw: k, scale: .26 + hash(k + s * 5) * .16 }); }
      asset('bush', { x: x - .55, y: TOP, z: z - .45, yaw: s, scale: .5, tint: light });
    }
  });

  buildPaths(api);
  buildForestEdge(api, theme);
}

export function islandCliff() {
  const { cx, cz } = ISLAND, rock = ['#8f8584', '#7a7579', '#8a8388', '#6b686f', '#5d5b63'];
  return [
    strataBody({ edge: a => landmassEdge(a, 1.004), segments: EDGE, strata: strataSteps(TOP - .28, ISLAND_DEPTH), keel: [cx + .9, cz - .9, ISLAND_DEPTH] }),
    ...SPIRES.map(([x, z, length, radius], i) => spire({ x, z, top: ISLAND_DEPTH * .62, length: length + 1.2, radius, colors: rock, seed: i * 2.7 })),
  ];
}

export function waterfalls(drop = 4.4) {
  return STREAMS.map(course => {
    const points = course.map(([x, z]) => [x, TOP + .016, z]), [x, z] = course.at(-1), [px, pz] = course.at(-2), l = Math.hypot(x - px, z - pz), dx = (x - px) / l, dz = (z - pz) / l;
    for (let i = 1; i <= 10; i++) { const t = i / 10, out = .75 * t ** .35 + .3 * t; points.push([x + dx * out, TOP - drop * t, z + dz * out]); }
    return { points, rim: course.length - 1 };
  });
}
