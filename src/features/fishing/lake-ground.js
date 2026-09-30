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

export function createLakeBank(palette) {
  const radii = [.97, 1.015, 1.035, 1.06, 1.085, 1.12, ...Array.from({ length: 17 }, (_, i) => 1.2 + i * .125), 3.5, 4, 5, 6, 8], segments = 160;
  const positions = [], colors = [], indices = [], normals = [];
  const grass = Color3.FromHexString(palette.grass), meadow = Color3.FromHexString(palette.meadow), sand = Color3.FromHexString(palette.sand);
  for (let r = 0; r < radii.length; r++) for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, k = radii[r];
    const shore = Math.sin(a * 5 + 1) * .014 + Math.sin(a * 9 - .4) * .009;
    const [x, z] = pondRim(a, k + shore * (1 - smooth((k - 1.12) / .3)));
    const y = -.08 + smooth((k - .97) / .15) * .23;
    const turf = Color3.Lerp(meadow, grass, meadowTone(x, z)), c = Color3.Lerp(sand, turf, smooth((k - 1.018) / .07));
    positions.push(x, y, z); colors.push(c.r, c.g, c.b, 1);
    if (r) { const n = r * segments + i, m = r * segments + (i + 1) % segments; indices.push(n - segments, n, m - segments, m - segments, n, m); }
  }
  VertexData.ComputeNormals(positions, indices, normals);
  return { positions, colors, indices, normals };
}

export function lakeGrassSpots() {
  const spots = [];
  for (let row = 0; row < 40; row++) for (let column = 0; column < 46; column++) {
    const seed = row * 47 + column, x = -18 + column * .8 + (hash(seed + 5) - .5) * .6, z = -19 + row * .8 + (hash(seed + 11) - .5) * .6;
    const radius = radiusAt(x, z);
    if (radius < 1.13 || radius > 2.45 || hash(seed + 87) > .08 + smooth((meadowTone(x, z) - .4) * 2.5) * .28) continue;
    if (Math.abs(x) < 1.25 && z > .5 && z < 6.8 || x > 1.5 && x < 10.5 && z > -19.5 && z < -12) continue;
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
