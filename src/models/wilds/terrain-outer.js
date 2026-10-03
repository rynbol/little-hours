import { VALLEY, baseHeight, farHeight } from '../../core/wilds/valley.js';
import { fbm, noise2, smooth } from '../../core/wilds/noise.js';

const CENTER = [0, 60];
const hex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
const FOREST = hex('#3d5426'), FOREST_DARK = hex('#2f4520'), MEADOW = hex('#6a8c38'), ROCK = hex('#a08a6e'), ROCK_DARK = hex('#7c6c5a'), SNOW = hex('#eef0f2'), PLAIN = hex('#5d7f30');
const blend = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function outerHeight(x, z) {
  const near = baseHeight(x, z), far = farHeight(x, z) ?? 0;
  const d = Math.hypot(x - CENTER[0], z - CENTER[1]);
  return near + (Math.max(near, far + near * .4) - near) * smooth(420, 900, d);
}

function rectEdge(angle) {
  const { minX, maxX, minZ, maxZ } = VALLEY.core, dx = Math.sin(angle), dz = Math.cos(angle);
  const tx = dx > 0 ? (maxX - CENTER[0]) / dx : dx < 0 ? (minX - CENTER[0]) / dx : Infinity;
  const tz = dz > 0 ? (maxZ - CENTER[1]) / dz : dz < 0 ? (minZ - CENTER[1]) / dz : Infinity;
  return Math.min(tx, tz);
}

export function outerGeometry({ around = 384, rings = 70, reach = 7000 } = {}) {
  const vertices = around * rings, positions = new Float32Array(vertices * 3), colors = new Float32Array(vertices * 4), normals = new Float32Array(vertices * 3);
  for (let i = 0; i < around; i++) {
    const angle = i / around * Math.PI * 2, inner = rectEdge(angle) - 3;
    for (let k = 0; k < rings; k++) {
      const t = k / (rings - 1), r = inner * Math.pow(reach / inner, t ** 1.35);
      const x = CENTER[0] + Math.sin(angle) * r, z = CENTER[1] + Math.cos(angle) * r, v = i * rings + k;
      const y = outerHeight(x, z) - (k === 0 ? 4 : 0);
      positions.set([x, y, z], v * 3);
    }
  }
  for (let i = 0; i < around; i++) for (let k = 0; k < rings; k++) {
    const v = i * rings + k, at = (ii, kk) => ((ii + around) % around) * rings + Math.max(0, Math.min(rings - 1, kk));
    const a = at(i + 1, k) * 3, b = at(i - 1, k) * 3, c = at(i, k + 1) * 3, e = at(i, k - 1) * 3;
    const ux = positions[a] - positions[b], uy = positions[a + 1] - positions[b + 1], uz = positions[a + 2] - positions[b + 2];
    const wx = positions[c] - positions[e], wy = positions[c + 1] - positions[e + 1], wz = positions[c + 2] - positions[e + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const length = Math.hypot(nx, ny, nz) || 1;
    normals.set([nx / length, ny / length, nz / length], v * 3);
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2], steep = 1 - ny / length;
    const patch = fbm(x / 160, z / 160, 3, 701), d = Math.hypot(x - CENTER[0], z - CENTER[1]);
    let color = blend(FOREST, FOREST_DARK, smooth(-.3, .4, patch));
    color = blend(color, PLAIN, smooth(.25, .6, noise2(x / 300, z / 300, 702)) * smooth(30, 8, y));
    color = blend(color, MEADOW, smooth(260, 420, y + patch * 60) * .6);
    color = blend(color, blend(ROCK, ROCK_DARK, smooth(-.2, .4, patch)), Math.max(smooth(.28, .5, steep), smooth(420, 620, y + patch * 80)));
    color = blend(color, SNOW, smooth(640, 760, y + patch * 90 + noise2(x / 90, z / 90, 703) * 40) * smooth(.55, .3, steep) * smooth(1500, 2400, d));
    colors.set([color[0], color[1], color[2], 1], v * 4);
  }
  const indices = new Uint32Array(around * (rings - 1) * 6);
  let k = 0;
  for (let i = 0; i < around; i++) for (let j = 0; j < rings - 1; j++) {
    const a = i * rings + j, b = ((i + 1) % around) * rings + j;
    indices.set([a, b, a + 1, b, b + 1, a + 1], k); k += 6;
  }
  return { positions, normals, colors, indices };
}
