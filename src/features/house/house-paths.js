import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { groundsKit } from './grounds-kit.js';

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
export const PATH_LINES = PATHS.map(smooth);

export function pathDistance(x, z) {
  let best = Infinity;
  for (const line of PATH_LINES) for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

export function pathStones() {
  const stones = [];
  PATH_LINES.forEach((line, l) => {
    const lengths = [0];
    for (let i = 1; i < line.length; i++) lengths.push(lengths[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const at = d => {
      const i = Math.max(1, lengths.findIndex(value => value >= d)), t = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
      const [ax, az] = line[i - 1], [bx, bz] = line[i], length = Math.hypot(bx - ax, bz - az) || 1;
      return [ax + (bx - ax) * t, az + (bz - az) * t, -(bz - az) / length, (bx - ax) / length];
    };
    const total = lengths.at(-1);
    for (let row = 0, d = .14; d < total - .1; row++, d += l ? .36 : .27) {
      const [x, z, ox, oz] = at(d), lanes = l ? [0] : row % 2 ? [-.19, .19] : [-.25, 0, .25];
      lanes.forEach((lane, k) => {
        const seed = row * 7 + k * 3 + l * 101;
        if (!l && hash(seed) < .12) return;
        const w = lane + (hash(seed + 1) - .5) * .07, size = l ? .2 + hash(seed + 2) * .05 : (lanes.length === 3 ? .11 : .14) + hash(seed + 2) * .05;
        stones.push({ x: x + ox * w, z: z + oz * w, size, seed, yaw: Math.atan2(oz, ox) + hash(seed + 4) });
      });
    }
  });
  return stones;
}

export function buildPaths(api) {
  const kit = groundsKit();
  const lawn = rgba('#7c9f49'), verge = rgba('#8f9257'), earth = rgba('#b39670'), worn = rgba('#d0b78f'), stones = ['#ddd2b8', '#cfc4aa', '#e7dcc3', '#c6bba1', '#d9c9ab'];
  PATH_LINES.forEach((line, l) => {
    const half = PATH_WIDTH / 2 * (l ? .72 : 1), offsets = [-half - .26, -half - .08, -half * .5, 0, half * .5, half + .08, half + .26];
    const rows = [], tints = [];
    line.forEach(([x, z], i) => {
      const [px, pz] = line[Math.max(0, i - 1)], [nx, nz] = line[Math.min(line.length - 1, i + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1, ox = -(nz - pz) / length, oz = (nx - px) / length;
      const end = l && i === line.length - 1 ? .6 : 1;
      rows.push(offsets.map((w, k) => {
        const ragged = k === 0 || k === 6 ? (hash(i * 3 + k + l * 40) - .5) * .2 : k === 1 || k === 5 ? (hash(i * 5 + k + l * 40) - .5) * .08 : 0;
        const reach = (w + Math.sign(w) * ragged) * end;
        return [x + ox * reach, TOP + (k === 0 || k === 6 ? .002 : k === 3 ? .009 : .007), z + oz * reach];
      }));
      const wear = .55 + hash(i * 1.3 + l) * .45;
      tints.push([lawn, verge, earth, mix(earth, worn, wear), earth, verge, lawn]);
    });
    kit.ribbon(rows, tints);
  });
  for (const { x, z, size, seed, yaw } of pathStones()) kit.slab(x, TOP + .028, z, size, .05, stones[seed % stones.length], { sides: 6 + seed % 2, seed, stretch: 1.25, yaw, light: .98 + hash(seed + 9) * .08 });
  PATH_LINES.forEach((line, l) => line.forEach(([x, z], i) => {
    if (i % 3 !== 1) return;
    const side = hash(i * 11 + l) > .5 ? 1 : -1, [px, pz] = line[Math.max(0, i - 1)], [nx, nz] = line[Math.min(line.length - 1, i + 1)], length = Math.hypot(nx - px, nz - pz) || 1;
    const w = PATH_WIDTH / 2 * (l ? .72 : 1) + .06, s = .07 + hash(i * 13 + l) * .07;
    kit.blob(x - (nz - pz) / length * w * side, TOP + .015, z + (nx - px) / length * w * side, s * 1.5, s * .8, s * 1.2, ['#a49d8a', '#b9ae96', '#8f8a78'][i % 3], 1, { rows: 2, sides: 6, seed: i });
  }));
  kit.flush(api);
}
