import { Color3 } from '@babylonjs/core/Maths/math.color.js';

export const PATHS = Object.freeze([
  [[-2.5, 3.05], [-1.2, 3.5], [.6, 3.62], [2.6, 3.46], [4.4, 3.3], [5.6, 3.3], [6.35, 3.2], [7, 3.3], [8.2, 3.25], [9.25, 3.1], [9.55, 2.9]],
  [[8.3, 3.2], [8.1, 2.4], [7.85, 1.75]],
]);
export const PATH_WIDTH = .78;
const TOP = -.175, STEPS = 7;
const hash = n => { const s = Math.sin(n * 41.7 + 3.1) * 43758.5453; return s - Math.floor(s); };
const rgba = hex => { const c = Color3.FromHexString(hex); return [c.r, c.g, c.b, 1]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function smooth(path) {
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[Math.max(0, i - 1)], p1 = path[i], p2 = path[i + 1], p3 = path[Math.min(path.length - 1, i + 2)];
    for (let k = 0; k < STEPS; k++) {
      const t = k / STEPS, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] + p3[j] - 3 * p2[j]) * t3)));
    }
  }
  out.push(path.at(-1));
  return out;
}
const LINES = PATHS.map(smooth);

export function pathDistance(x, z) {
  let best = Infinity;
  for (const line of LINES) for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

export function buildPaths(api) {
  const positions = [], colors = [], normals = [];
  const quad = (a, b, c, d, ca, cb, cc, cd) => {
    const vertex = [[a, ca], [b, cb], [c, cc], [d, cd]];
    for (const tri of [[0, 1, 2], [2, 1, 3], [0, 2, 1], [2, 3, 1]]) for (const k of tri) { positions.push(...vertex[k][0]); colors.push(...vertex[k][1]); normals.push(0, 1, 0); }
  };
  const sand = [rgba('#dcc59d'), rgba('#d2b98f'), rgba('#e2cfaa')], edge = rgba('#b69c76'), grass = rgba('#9fb187');
  LINES.forEach((line, l) => {
    const rows = line.map(([x, z], i) => {
      const [px, pz] = line[Math.max(0, i - 1)], [nx, nz] = line[Math.min(line.length - 1, i + 1)];
      const tx = nx - px, tz = nz - pz, length = Math.hypot(tx, tz) || 1, ox = -tz / length, oz = tx / length;
      const taper = l && i > line.length - 4 ? .75 : 1, half = PATH_WIDTH / 2 * taper * (.92 + hash(i + l * 50) * .16);
      const at = (w, y) => [x + ox * w, y, z + oz * w];
      return { core: [at(-half, TOP + .01), at(half, TOP + .01)], lip: [at(-half - .1, TOP + .005), at(half + .1, TOP + .005)], fade: [at(-half - .2, TOP + .002), at(half + .2, TOP + .002)], tint: mix(sand[i % 3], sand[(i + 1) % 3], hash(i * 3 + l)) };
    });
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      quad(a.core[0], a.core[1], b.core[0], b.core[1], a.tint, a.tint, b.tint, b.tint);
      for (const side of [0, 1]) {
        quad(a.lip[side], a.core[side], b.lip[side], b.core[side], edge, a.tint, edge, b.tint);
        quad(a.fade[side], a.lip[side], b.fade[side], b.lip[side], grass, edge, grass, edge);
      }
    }
    line.forEach(([x, z], i) => {
      if (i % 3 === 1) api.cylinder(x + (hash(i * 7 + l) - .5) * .2, TOP + .02, z + (hash(i * 5 + l) - .5) * .18, .26 + hash(i) * .12, .3 + hash(i) * .12, .025, ['#ebe1cc', '#e0d4bb'][i % 2]);
      if (i % 2 === 0) {
        const side = hash(i * 11 + l) > .5 ? 1 : -1, [px, pz] = line[Math.max(0, i - 1)], [nx, nz] = line[Math.min(line.length - 1, i + 1)], length = Math.hypot(nx - px, nz - pz) || 1;
        const w = PATH_WIDTH / 2 + .12, s = .09 + hash(i * 13) * .08;
        api.ball(x - (nz - pz) / length * w * side, TOP + .03, z + (nx - px) / length * w * side, s * 1.4, s * .7, s, ['#c9bca4', '#b7aa92', '#d8ccb4'][i % 3]);
      }
    });
  });
  api.shape(positions, colors, normals);
}
