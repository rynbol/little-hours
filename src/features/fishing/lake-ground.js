import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { strataBody, strataSteps, spire, shadeBody } from '../../models/landform.js';

export const POND = { x: 0, z: -3.2, rx: 8.6, rz: 7.2 };
export const pondRim = (a, k) => [POND.x + Math.cos(a) * POND.rx * k, POND.z + Math.sin(a) * POND.rz * k];
const EXIT_ANGLE = 1.08;
export const POND_EXIT = (() => { const [x, z] = pondRim(EXIT_ANGLE, 1.42); return { x, z, yaw: Math.atan2(-Math.cos(EXIT_ANGLE) / POND.rx, -Math.sin(EXIT_ANGLE) / POND.rz) }; })();
export const POND_PATH = Array.from({ length: 12 }, (_, i) => pondRim(EXIT_ANGLE + .5 * (i / 11) ** 1.25, 1.24 + .23 * (1 - i / 11) ** 3));
const hash = n => { const s = Math.sin(n * 78.233 + 12.9898) * 43758.5453; return s - Math.floor(s); };
const radiusAt = (x, z) => Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
const smooth = t => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

export function meadowTone(x, z) {
  return .5 + Math.sin(x * .47 + Math.sin(z * .29)) * .2 + Math.sin(z * .53 - x * .16) * .16 + Math.sin(x * 1.1 + z * .7) * .035;
}

const LIP = [[1.006, .12, .94], [1.012, .02, .86], [1.008, -.17, .68]];
const SPIRES = [[-5.2, -5.4, 3.2, 1.5], [3.4, -1.6, 3.8, 1.8], [8.6, -5.8, 2.6, 1.3], [-.6, -8.2, 2.4, 1.2], [-9.4, -1.2, 2.2, 1.1], [1.2, 2.6, 2, 1], [-3.8, 1.4, 1.7, .9]];
export const LAKE_DEPTH = -6.4;
export const LAKE_POSTS = Object.freeze([[-.72, 1.02], [-.72, 5.2], [.72, 5.2], pondRim(1.45, 1.16), pondRim(1.18, 1.15)].map(Object.freeze));

export function plotReach(a) {
  return 1.6 + Math.sin(a * 3 + .7) * .03 + Math.sin(a * 7 + 2) * .012;
}

export function onPlot(x, z, margin = 0) {
  return radiusAt(x, z) <= plotReach(Math.atan2((z - POND.z) / POND.rz, (x - POND.x) / POND.rx)) - margin;
}

export function createLakeBank(palette) {
  const shore = [.97, 1.015, 1.035, 1.06, 1.085, 1.12], spans = 16, segments = 160;
  const positions = [], colors = [], indices = [], normals = [];
  const grass = Color3.FromHexString(palette.grass), meadow = Color3.FromHexString(palette.meadow), sand = Color3.FromHexString(palette.sand);
  const rings = shore.length + spans + LIP.length;
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
      const [scale, level, shade] = LIP[r - shore.length - spans], [x, z] = pondRim(a, reach);
      k = reach * scale; y = level - (level < 0 ? Math.max(0, Math.sin(i * Math.PI / 4 + hash(Math.floor(i / 8)) * 2)) ** 2 * .16 * (.5 + hash(i * 2.9) * .5) : 0);
      c = Color3.Lerp(meadow, grass, meadowTone(x, z)).scale(shade);
    }
    const [x, z] = pondRim(a, k);
    positions.push(x, y, z); colors.push(c.r, c.g, c.b, 1);
    if (r) { const n = r * segments + i, m = r * segments + (i + 1) % segments; indices.push(n - segments, n, m - segments, m - segments, n, m); }
  }
  const basin = positions.length / 3;
  positions.push(POND.x, -.5, POND.z); colors.push(...colors.slice(0, 4));
  for (let i = 0; i < segments; i++) indices.push(basin, (i + 1) % segments, i);
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

export function lakeCliff(theme = 'day') {
  const rock = ['#8f8584', '#7a7579', '#8a8388', '#6b686f', '#5d5b63'];
  return [
    strataBody({ edge: a => pondRim(a, plotReach(a) * .992), segments: 144, strata: strataSteps(-.2, LAKE_DEPTH).map(step => ({ ...step, scale: step.scale ** .4 })), keel: [POND.x + .8, POND.z - .6, LAKE_DEPTH], seed: 7 }),
    ...SPIRES.map(([x, z, length, radius], i) => spire({ x, z, top: LAKE_DEPTH * .6, length: length + 1, radius, colors: rock, seed: i * 3.1 + 1 })),
  ].map(body => shadeBody(body, theme));
}

export function lakeFrame() {
  return Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 2, [x, z] = pondRim(a, plotReach(a) * .8); return [x, -3.6, z]; }).flat();
}

const CLEARINGS = [[2.39, 4.61, 1.2], [POND_EXIT.x, POND_EXIT.z, 1.2], [-4.3, -11.5, 3.6]];
export function lakeGrassy(x, z) {
  return radiusAt(x, z) > 1.135 && onPlot(x, z, .03)
    && !(Math.abs(x) < 1 && z > .5 && z < 6.4)
    && POND_PATH.every(([px, pz]) => Math.hypot(x - px, z - pz) > .36)
    && CLEARINGS.every(([px, pz, r]) => Math.hypot(x - px, z - pz) > r);
}

export const LAKE_GRASS = Object.freeze({ tries: 78000, rim: 1500, ground: .148 });
export function lakeBlades() {
  const blades = [], { tries, rim, ground } = LAKE_GRASS;
  for (let i = 0; i < tries; i++) {
    const x = -14.6 + hash(i * 1.07 + 3) * 29.2, z = -15.4 + hash(i * 2.31 + 9) * 24.4;
    if (!lakeGrassy(x, z)) continue;
    const patch = (meadowTone(x, z) - .5) * 2.2;
    blades.push({ x, z, ground, height: (.13 + .17 * hash(i * 3.3)) * (.85 + patch * .15), lean: hash(i * 5.1) * Math.PI * 2, tone: hash(i * 7.7), patch });
  }
  for (let i = 0; i < rim; i++) {
    const a = (i + hash(i * 2.7) * .8) / rim * Math.PI * 2, reach = plotReach(a), [x, z] = pondRim(a, reach * (1.004 - hash(i * 4.3) * .004)), [ox, oz] = pondRim(a, reach * 1.03), height = .16 + hash(i * 6.1) * .22;
    const out = Math.hypot(ox - x, oz - z), dx = (ox - x) / out, dz = (oz - z) / out;
    blades.push({ x, z, ground: .1, height, lean: Math.atan2(dx, -dz), tone: hash(i * 7.9), patch: .2 + hash(i * 1.1) * .5, drop: [dx * height * .7, -height * (.55 + hash(i * 3.9) * .5), dz * height * .7] });
  }
  return blades;
}
