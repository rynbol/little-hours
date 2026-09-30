import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';

export const POND = { x: 0, z: -3.2, rx: 8.6, rz: 7.2 };
export const pondRim = (a, k) => [POND.x + Math.cos(a) * POND.rx * k, POND.z + Math.sin(a) * POND.rz * k];
export const POND_PATH = Array.from({ length: 8 }, (_, i) => { const t = i / 7; return [-.35 - t * 3.6, 5.9 + Math.sin(t * Math.PI) * 1.1 - t * 1.4]; });
const hash = n => { const s = Math.sin(n * 78.233 + 12.9898) * 43758.5453; return s - Math.floor(s); };
const radiusAt = (x, z) => Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
const smooth = t => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

export function meadowTone(x, z) {
  return .5 + Math.sin(x * .47 + Math.sin(z * .29)) * .2 + Math.sin(z * .53 - x * .16) * .16 + Math.sin(x * 1.1 + z * .7) * .035;
}

export const HOUSE_SPOT = { x: 6, z: -13.6, yaw: -.35 };
const HOUSE_ANGLE = Math.atan2((HOUSE_SPOT.z - POND.z) / POND.rz, (HOUSE_SPOT.x - POND.x) / POND.rx);
const EDGE = [[1.006, .12, 0], [1.012, .03, 1], [1.006, -.3, 2], [.99, -.95, 3], [.955, -1.5, 4], [.89, -1.9, 5], [.74, -2.18, 6]];
const EARTH = ['#8f9d6c', '#b9a98a', '#b3a488', '#a6987e', '#978d77', '#8a8570', '#7f7c69'];

export function plotReach(a) {
  const d = Math.atan2(Math.sin(a - HOUSE_ANGLE), Math.cos(a - HOUSE_ANGLE));
  return 1.6 + .72 * Math.exp(-d * d / .5) + Math.sin(a * 3 + .7) * .03 + Math.sin(a * 7 + 2) * .012;
}

export function onPlot(x, z, margin = 0) {
  return radiusAt(x, z) <= plotReach(Math.atan2((z - POND.z) / POND.rz, (x - POND.x) / POND.rx)) - margin;
}

export function underHouse(x, z, margin = 0) {
  const dx = x - HOUSE_SPOT.x, dz = z - HOUSE_SPOT.z, c = Math.cos(HOUSE_SPOT.yaw), s = Math.sin(HOUSE_SPOT.yaw);
  return Math.abs(dx * c - dz * s) < 6 + margin && Math.abs(dx * s + dz * c) < 2.6 + margin;
}

export function createLakeBank(palette) {
  const shore = [.97, 1.015, 1.035, 1.06, 1.085, 1.12], spans = 16, segments = 160;
  const positions = [], colors = [], indices = [], normals = [];
  const grass = Color3.FromHexString(palette.grass), meadow = Color3.FromHexString(palette.meadow), sand = Color3.FromHexString(palette.sand);
  const rings = shore.length + spans + EDGE.length;
  for (let r = 0; r < rings; r++) for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, reach = plotReach(a), ripple = Math.sin(a * 5 + 1) * .014 + Math.sin(a * 9 - .4) * .009;
    let k, y, c;
    if (r < shore.length) {
      k = shore[r] + ripple; y = -.08 + smooth((shore[r] - .97) / .15) * .23;
      const [x, z] = pondRim(a, k);
      c = Color3.Lerp(sand, Color3.Lerp(meadow, grass, meadowTone(x, z)), smooth((shore[r] - 1.018) / .07));
    } else if (r < shore.length + spans) {
      const t = (r - shore.length + 1) / spans;
      k = 1.12 + ripple * (1 - t) + (reach - 1.12) * t; y = .15;
      const [x, z] = pondRim(a, k);
      c = Color3.Lerp(meadow, grass, meadowTone(x, z));
    } else {
      const [scale, level, tone] = EDGE[r - shore.length - spans], fold = level < -.2 ? Math.sin(a * 23 + level * 3) * .012 + Math.sin(a * 41 - level) * .006 : 0;
      k = reach * (scale + fold); y = level;
      c = Color3.FromHexString(EARTH[tone]).scale(level < -.2 ? 1 + Math.sin(a * 11 + level * 2) * .035 : 1);
    }
    const [x, z] = pondRim(a, k);
    positions.push(x, y, z); colors.push(c.r, c.g, c.b, 1);
    if (r) { const n = r * segments + i, m = r * segments + (i + 1) % segments; indices.push(n - segments, n, m - segments, m - segments, n, m); }
  }
  const basin = positions.length / 3, last = (rings - 1) * segments;
  positions.push(POND.x, -.5, POND.z, POND.x, -2.24, POND.z); colors.push(...colors.slice(0, 4), ...colors.slice(-4));
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    indices.push(basin, j, i, basin + 1, last + i, last + j);
  }
  VertexData.ComputeNormals(positions, indices, normals);
  return { positions, colors, indices, normals };
}

export function lakeWater(rings = 14, segments = 96) {
  const positions = [POND.x, 0, POND.z], indices = [];
  for (let r = 1; r <= rings; r++) for (let i = 0; i < segments; i++) {
    const [x, z] = pondRim(i / segments * Math.PI * 2, r / rings * 1.07);
    positions.push(x, 0, z);
    const n = 1 + (r - 1) * segments + i, m = 1 + (r - 1) * segments + (i + 1) % segments;
    if (r === 1) indices.push(0, m, n);
    else indices.push(n - segments, m, n, n - segments, m - segments, m);
  }
  return { positions, indices };
}

export function lakeGrassSpots() {
  const spots = [];
  for (let row = 0; row < 40; row++) for (let column = 0; column < 46; column++) {
    const seed = row * 47 + column, x = -18 + column * .8 + (hash(seed + 5) - .5) * .6, z = -19 + row * .8 + (hash(seed + 11) - .5) * .6;
    const radius = radiusAt(x, z);
    if (radius < 1.13 || !onPlot(x, z, .12) || hash(seed + 87) > .45 + smooth((meadowTone(x, z) - .4) * 2.5) * .45) continue;
    if (Math.abs(x) < 1.25 && z > .5 && z < 6.8 || underHouse(x, z, .3)) continue;
    if (POND_PATH.some(([px, pz]) => Math.hypot(x - px, z - pz) < .72)) continue;
    if ([[-4.6, 3.9, 1.3], [4.2, 4.6, 1.3], [-6.6, 4.4, 1.2], [7.4, 3.2, 1], [-4.3, -11.5, 3.6]].some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r)) continue;
    spots.push({ x, z, seed });
  }
  return spots;
}

export function createLakeGrass(palette) {
  const positions = [], colors = [], indices = [], normals = [];
  const root = Color3.FromHexString(palette.meadow).scale(.96), tip = Color3.FromHexString(palette.grass).scale(1.08);
  for (const { x, z, seed } of lakeGrassSpots()) for (let blade = 0; blade < 3; blade++) {
    const a = seed * 2.4 + blade * 2.1, dx = Math.cos(a), dz = Math.sin(a), width = .025 + hash(seed + blade * 5) * .018;
    const h = .1 + hash(seed * 3 + blade * 7) * .14, bend = .04 + hash(seed + blade) * .07, offset = (blade - 1) * .055;
    const cx = x + dx * offset, cz = z + dz * offset, y = .148;
    const points = [[cx - dz * width, y, cz + dx * width], [cx + dz * width, y, cz - dx * width], [cx + dx * bend * .3 - dz * width * .6, y + h * .55, cz + dz * bend * .3 + dx * width * .6], [cx + dx * bend * .3 + dz * width * .6, y + h * .55, cz + dz * bend * .3 - dx * width * .6], [cx + dx * bend, y + h, cz + dz * bend]];
    for (const side of [1, -1]) {
      const start = positions.length / 3;
      points.forEach((p, i) => { positions.push(...p); const c = Color3.Lerp(root, tip, i < 2 ? 0 : i < 4 ? .65 : 1); colors.push(c.r, c.g, c.b, 1); });
      for (const tri of [[0, 1, 2], [1, 3, 2], [2, 3, 4]]) indices.push(...(side === 1 ? tri : tri.toReversed()).map(i => i + start));
    }
  }
  VertexData.ComputeNormals(positions, indices, normals);
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i] * .25, z = normals[i + 2] * .25, length = Math.hypot(x, .9, z);
    normals[i] = x / length; normals[i + 1] = .9 / length; normals[i + 2] = z / length;
  }
  return { positions, colors, indices, normals };
}
