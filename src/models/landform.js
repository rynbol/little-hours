import { Color3 } from '@babylonjs/core/Maths/math.color.js';

const hash = n => { const s = Math.sin(n * 78.233 + 12.9898) * 43758.5453; return s - Math.floor(s); };

export const rgba = (hex, shade = 1) => { const c = Color3.FromHexString(hex); return [c.r * shade, c.g * shade, c.b * shade, 1]; };

function smoothNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
    for (const k of [a, b, c]) { normals[k] += nx; normals[k + 1] += ny; normals[k + 2] += nz; }
  }
  for (let k = 0; k < normals.length; k += 3) { const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]) || 1; normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l; }
  return normals;
}

export function ringGrid(rows, closed = true) {
  const positions = [], colors = [], indices = [], width = rows[0].length;
  for (const row of rows) for (const { p, c } of row) { positions.push(...p); colors.push(...c); }
  for (let r = 0; r < rows.length - 1; r++) for (let j = 0; j < width - (closed ? 0 : 1); j++) {
    const a = r * width + j, b = r * width + (j + 1) % width, c = a + width, d = b + width;
    indices.push(a, c, b, b, c, d);
  }
  return { positions, colors, indices };
}

export function strataBody({ edge, segments, strata, keel, seed = 0 }) {
  const rows = strata.map((step, r) => Array.from({ length: segments }, (_, j) => {
    const a = j / segments * Math.PI * 2, rough = step.rough ?? 1;
    const wobble = 1 + rough * (.04 * Math.sin(a * 5 + r * 1.7 + seed) + .025 * Math.sin(a * 11 + r * .9 + seed * 2) + .03 * (hash(j * 7.3 + r * 13.1 + seed) - .5));
    const [ex, ez] = edge(a), pull = step.toward ?? 0, scale = step.scale * wobble;
    const x = keel[0] + (ex - keel[0]) * scale, z = keel[1] + (ez - keel[1]) * scale;
    const sag = rough * (hash(j * 3.1 + r + seed) - .5) * .12 * Math.min(1, r / 3);
    const shade = 1 + rough * ((hash(j * 1.7 + r * 5.3 + seed) - .5) * .14 + .06 * Math.sin(a * 3 + seed));
    return { p: [x, step.y + sag - pull, z], c: rgba(step.color, shade) };
  }));
  rows.push(Array.from({ length: segments }, () => ({ p: [keel[0], keel[2], keel[1]], c: rgba(strata.at(-1).color, .9) })));
  return ringGrid(rows);
}

export function spire({ x, z, top, length, radius, colors, sides = 7, seed = 0 }) {
  const rows = [];
  const bands = colors.length;
  for (let r = 0; r <= bands; r++) {
    const t = r / bands, rad = radius * (1 - t) ** .8, drift = (hash(seed + r) - .5) * radius * .4 * t;
    rows.push(Array.from({ length: sides }, (_, j) => {
      const a = j / sides * Math.PI * 2 + seed, wob = 1 + (hash(seed * 3 + j + r * 7) - .5) * .3;
      return { p: [x + drift + Math.cos(a) * rad * wob, top - length * t, z + Math.sin(a) * rad * wob], c: rgba(colors[Math.min(bands - 1, r)], .92 + hash(seed + j) * .12) };
    }));
  }
  return ringGrid(rows);
}

export const CLIFF_LIGHT = Object.freeze({ day: [1, 1, 1], dusk: [.62, .64, .86], rain: [.82, .86, .9] });
export function shadeBody(body, theme) {
  const light = CLIFF_LIGHT[theme] || CLIFF_LIGHT.day;
  return { ...body, colors: body.colors.map((value, i) => i % 4 < 3 ? value * light[i % 4] : value) };
}

export function addBody(api, { positions, colors, indices }) {
  api.shape(positions, colors, Array.from(smoothNormals(positions, indices)), indices);
}

const LAYERS = Object.freeze([
  [0, 1, '#6b4f37', .3], [.035, .99, '#56402f', .5],
  [.11, .975, '#c4a77f'], [.13, .94, '#9c8064'], [.25, .9, '#8a6f58'],
  [.27, .865, '#cdb391'], [.29, .82, '#a38c74'], [.43, .76, '#85746a'],
  [.45, .72, '#a39486'], [.47, .67, '#8f8584'], [.61, .58, '#7a7579'],
  [.63, .53, '#8a8388'], [.79, .36, '#6b686f'], [.92, .16, '#5d5b63'],
]);

export function strataSteps(top, bottom) {
  return LAYERS.map(([at, scale, color, rough = 1]) => Object.freeze({ y: top + (bottom - top) * at, scale, color, rough }));
}

export function hangingRoots(api, { edge, top, count, seed = 0, open = () => true }) {
  for (let i = 0; i < count; i++) {
    const a = (i + hash(i * 3.7 + seed)) / count * Math.PI * 2, [x, z] = edge(a), kind = hash(i * 5.1 + seed);
    if (kind < .35 || !open(x, z)) continue;
    const length = .25 + hash(i * 2.3 + seed) * .9, lean = (hash(i * 7.9 + seed) - .5) * .25;
    if (kind < .8) api.box(x, top - length / 2, z, .035, length, .035, kind < .6 ? '#4a3a2c' : '#5b4a36', lean);
    else api.ball(x, top + .02 - length * .25, z, .24, length * .55, .2, '#5a7c3a');
  }
}
