import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { heightAt, noise2, ridged, smooth } from '../../core/world-terrain.js';
import { WIND, RIDGE_LIFT_GLSL, RIDGE_UNIFORMS, applyRidges } from './terrain-paint.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';
import { GROVE_GLSL, GROVE_UNIFORMS } from './grove-light.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';
import { SKY_GLSL, SKY_UNIFORMS, applySkyTheme } from './sky.js';
import { inWorker, sampleTerrainSurface } from './terrain-mesh.js';

const peak = Object.freeze({ x: -4237, z: -6192, summit: 2150, radius: 3000, snowLine: 1300 });

export const LANDMARKS = Object.freeze({
  observatory: Object.freeze({ x: 643, z: -3035, drum: 64, tower: 112 }),
  peak,
  falls: Object.freeze({ x: -611, z: -590, height: 100, width: 42, depth: 30 }),
  windmills: Object.freeze([Object.freeze({ x: -1070, z: -1321, height: 50 }), Object.freeze({ x: 253, z: -1096, height: 50 }), Object.freeze({ x: 403, z: -1050, height: 44 })]),
});

export const PLUME = Object.freeze({ puffs: 40, period: 260, rise: 160, reach: 1500 });
export const MIST = Object.freeze({ puffs: 12, period: 14, rise: 42, spread: 40, small: 16, large: 46 });
export const SAIL_TURN = 0.32;
export const MIST_RIBBONS = Object.freeze([
  Object.freeze({ reach: 2300, low: 140, high: 230, from: -62, to: 48 }),
  Object.freeze({ reach: 1500, low: 30, high: 95, from: -66, to: 50 }),
  Object.freeze({ reach: 1250, low: 15, high: 85, from: -64, to: 50 }),
  Object.freeze({ reach: 950, low: -52, high: 6, from: -72, to: 52 }),
]);
export const RIBBON_SEGMENTS = 64;

const VEIL_KINDS = Object.freeze({ cap: 0, falls: 1, mist: 2, ribbon: 3 });
const THEME_LIGHT = Object.freeze({
  day: Object.freeze({ lampGain: 0.2, sunRim: 0, wet: 0 }),
  dusk: Object.freeze({ lampGain: 1.15, sunRim: 1, wet: 0 }),
  rain: Object.freeze({ lampGain: 0.12, sunRim: 0, wet: 1 }),
});

const PAINT = Object.freeze({
  stone: [0.9, 0.85, 0.74], terrace: [0.6, 0.61, 0.6], paving: [0.66, 0.66, 0.63], verdigris: [0.3, 0.52, 0.49], slit: [0.22, 0.27, 0.31], pane: [0.3, 0.28, 0.25],
  rock: [0.5, 0.55, 0.6], rockDeep: [0.37, 0.42, 0.49],
  bluffBand: [0.66, 0.67, 0.65], turf: [0.42, 0.56, 0.33], moss: [0.33, 0.5, 0.25],
  plaster: [0.7, 0.67, 0.6], plinth: [0.5, 0.48, 0.45], thatch: [0.36, 0.32, 0.29], cloth: [0.66, 0.62, 0.54], spar: [0.33, 0.28, 0.24], hubCap: [0.24, 0.21, 0.19],
});

const SAIL_AXIS = Object.freeze([0, 0, -1]);
const WINDOW_EYE = Object.freeze([-2, -2.4]);
const NO_SPIN = Object.freeze([0, 0, 0, 0]);
const SLIT_HALF = 9;
export const OBSERVATORY_ACCENT = 1;
const glsl = value => value.toFixed(4);
const toward = (x, z) => { const length = Math.hypot(x, z); return [x / length, z / length]; };

function geometry() {
  const positions = [], normals = [], colors = [], marks = [], spins = [], indices = [];
  const vertex = (at, normal, { albedo, lamp = 0, snow = 0, spin = NO_SPIN, accent = 0 }) => {
    positions.push(at[0], at[1], at[2]); normals.push(normal[0], normal[1], normal[2]); colors.push(albedo[0], albedo[1], albedo[2], accent); marks.push(lamp, snow); spins.push(spin[0], spin[1], spin[2], spin[3]);
    return positions.length / 3 - 1;
  };
  function panel(corners, normal, paint) {
    const first = vertex(corners[0], normal, paint);
    for (let i = 1; i < corners.length; i++) vertex(corners[i], normal, paint);
    for (let i = 1; i < corners.length - 1; i++) indices.push(first, first + i, first + i + 1);
  }
  function sheet(rows, columns, point, center) {
    const grid = [], local = [], part = [];
    for (let r = 0; r <= rows; r++) for (let c = 0; c < columns; c++) { const p = point(r, c); grid.push(p); local.push(p.at[0], p.at[1], p.at[2]); }
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) { const a = r * columns + c, b = r * columns + (c + 1) % columns; part.push(a, b, b + columns, a, b + columns, a + columns); }
    const shade = new Float32Array(local.length);
    VertexData.ComputeNormals(local, part, shade);
    let outward = 0;
    grid.forEach(({ at }, i) => { outward += (at[0] - center[0]) * shade[i * 3] + (at[1] - center[1]) * shade[i * 3 + 1] + (at[2] - center[2]) * shade[i * 3 + 2]; });
    const flip = outward < 0 ? -1 : 1, start = positions.length / 3;
    grid.forEach((p, i) => vertex(p.at, [shade[i * 3] * flip, shade[i * 3 + 1] * flip, shade[i * 3 + 2] * flip], p));
    for (const index of part) indices.push(start + index);
  }
  function lathe([x, z], profile, paint, columns = 36) {
    const low = Math.min(...profile.map(([, y]) => y));
    sheet(profile.length - 1, columns, (r, c) => {
      const [radius, y] = profile[r], a = c / columns * Math.PI * 2;
      return { ...paint, at: [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius] };
    }, [x, low - 1, z]);
  }
  return { panel, sheet, lathe, positions, normals, colors, marks, spins, indices };
}

function footing(x, z, radius, groundAt = heightAt) {
  let low = groundAt(x, z);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; low = Math.min(low, groundAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius)); }
  return low;
}

function buildObservatory({ lathe, panel }, { x, z, drum, tower }, groundAt = heightAt) {
  const deck = groundAt(x, z) + 3, root = footing(x, z, drum * 2, groundAt) - 40, [ex, ez] = toward(-x, -z), right = [ez, -ex];
  lathe([x, z], [[drum * 1.5, root], [drum * 1.38, deck - 3], [drum * 1.38, deck]], { albedo: PAINT.terrace, accent: OBSERVATORY_ACCENT }, 44);
  lathe([x, z], [[drum * 1.38, deck], [0, deck]], { albedo: PAINT.paving, accent: OBSERVATORY_ACCENT }, 44);
  const wall = deck + drum * 0.8, rim = wall + 6, dome = drum * 0.98;
  lathe([x, z], [[drum, deck], [drum, wall]], { albedo: PAINT.stone, accent: OBSERVATORY_ACCENT }, 44);
  lathe([x, z], [[drum, wall], [drum * 1.07, wall + 2], [drum * 1.07, rim], [dome, rim]], { albedo: PAINT.terrace, accent: OBSERVATORY_ACCENT }, 44);
  const arc = Array.from({ length: 13 }, (_, i) => { const a = i / 12 * Math.PI / 2; return [Math.cos(a) * dome, rim + Math.sin(a) * dome * 0.94]; });
  lathe([x, z], arc, { albedo: PAINT.verdigris, accent: OBSERVATORY_ACCENT }, 44);
  const crown = rim + dome * 0.94;
  lathe([x, z], [[7, crown - 3], [7, crown + 9], [9, crown + 9], [0, crown + 15]], { albedo: PAINT.verdigris, accent: OBSERVATORY_ACCENT }, 16);
  const slitTurn = 0.45, slitAt = [ex * Math.cos(slitTurn) - ez * Math.sin(slitTurn), ex * Math.sin(slitTurn) + ez * Math.cos(slitTurn)], slitSide = [slitAt[1], -slitAt[0]];
  for (let i = 0; i < 12; i++) {
    const point = (k, side) => { const a = k / 12 * Math.PI / 2, out = Math.cos(a) * (dome + 0.8); return [x + slitAt[0] * out + slitSide[0] * side, rim + Math.sin(a) * (dome + 0.8) * 0.94, z + slitAt[1] * out + slitSide[1] * side]; };
    const a = (i + 0.5) / 12 * Math.PI / 2;
    panel([point(i, -SLIT_HALF), point(i, SLIT_HALF), point(i + 1, SLIT_HALF), point(i + 1, -SLIT_HALF)], [slitAt[0] * Math.cos(a), Math.sin(a), slitAt[1] * Math.cos(a)], { albedo: PAINT.slit, accent: OBSERVATORY_ACCENT });
  }
  const window = (cx, cz, facing, low, high, half, lamp) => {
    const [nx, nz] = facing, side = [nz, -nx];
    panel([[cx - side[0] * half, low, cz - side[1] * half], [cx + side[0] * half, low, cz + side[1] * half], [cx + side[0] * half, high, cz + side[1] * half], [cx - side[0] * half, high, cz - side[1] * half]], [nx, 0, nz], { albedo: PAINT.pane, lamp, accent: OBSERVATORY_ACCENT });
  };
  for (const turn of [-1.1, -0.55, 0, 0.55, 1.1]) {
    const facing = [ex * Math.cos(turn) - ez * Math.sin(turn), ex * Math.sin(turn) + ez * Math.cos(turn)];
    window(x + facing[0] * (drum + 0.8), z + facing[1] * (drum + 0.8), facing, deck + drum * 0.28, deck + drum * 0.56, 5, 1);
  }
  const tx = x + right[0] * drum * 1.1 - ex * drum * 0.2, tz = z + right[1] * drum * 1.1 - ez * drum * 0.2, gallery = deck + tower, facing = Math.atan2(ez, ex), side = [ez, -ex];
  const corner = (half, k, y) => { const a = facing + Math.PI / 4 + k * Math.PI / 2; return [tx + Math.cos(a) * half * Math.SQRT2, y, tz + Math.sin(a) * half * Math.SQRT2]; };
  const block = (half, low, high, albedo) => {
    for (let k = 0; k < 4; k++) { const a = facing + k * Math.PI / 2; panel([corner(half, k - 1, low), corner(half, k, low), corner(half, k, high), corner(half, k - 1, high)], [Math.cos(a), 0, Math.sin(a)], { albedo, accent: OBSERVATORY_ACCENT }); }
    panel([0, 1, 2, 3].map(k => corner(half, k, high)), [0, 1, 0], { albedo, accent: OBSERVATORY_ACCENT });
  };
  block(16, root, gallery, PAINT.stone);
  block(19, gallery, gallery + 3, PAINT.terrace);
  block(15, gallery + 3, gallery + 24, PAINT.stone);
  block(18, gallery + 24, gallery + 26, PAINT.terrace);
  for (let k = 0; k < 4; k++) {
    const a = facing + k * Math.PI / 2, slope = Math.hypot(14, 19);
    panel([corner(19, k - 1, gallery + 26), corner(19, k, gallery + 26), [tx, gallery + 40, tz]], [Math.cos(a) * 14 / slope, 19 / slope, Math.sin(a) * 14 / slope], { albedo: PAINT.verdigris, accent: OBSERVATORY_ACCENT });
  }
  for (const offset of [-5, 5]) window(tx + ex * 15.4 + side[0] * offset, tz + ez * 15.4 + side[1] * offset, [ex, ez], gallery + 8, gallery + 20, 3, 1);
  for (const lift of [0.42, 0.66]) window(tx + ex * 16.4, tz + ez * 16.4, [ex, ez], deck + tower * lift, deck + tower * lift + 11, 2.4, 0.8);
}

const smoothMax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
const PEAK_SUMMITS = Object.freeze([Object.freeze([0, 0, 1, 1]), Object.freeze([-0.25, 0.17, 0.66, 0.45]), Object.freeze([0.22, -0.2, 0.46, 0.4])]);
const PEAK_SAMPLES = new WeakMap();

function buildPeak({ sheet }, parameters, groundAt = heightAt, footRelief = parameters.footRelief ?? 0) {
  const { x, z, summit, radius, summits = PEAK_SUMMITS, warp = 1, snowLine = summit * .7 } = parameters;
  const base = footing(x, z, radius * 0.5, groundAt) - 80, rise = summit - base, scale = radius / 3000, rows = footRelief ? 150 : 60, columns = footRelief ? 300 : 180;
  const sample = (d, a) => {
    const px = x + Math.cos(a) * d * radius, pz = z + Math.sin(a) * d * radius;
    const wx = px + noise2(px / (1500 * scale), pz / (1500 * scale), 83) * 420 * scale * warp, wz = pz + noise2(px / (1500 * scale) + 4, pz / (1500 * scale), 84) * 420 * scale * warp;
    const crest = summits.reduce((high, [dx, dz, tall, spread]) => {
      const reach = Math.min(1, Math.hypot(wx - x - dx * radius, wz - z - dz * radius) / (radius * spread));
      return smoothMax(high, tall * ((1 - reach) ** 2.2 * 0.55 + (1 - reach) * 0.45), 0.08);
    }, 0);
    const gully = ridged(wx / (1000 * scale), wz / (1000 * scale), 4, 81), lift = crest * (1 - 0.3 * (1 - gully) * smooth(0.03, 0.3, d));
    const tone = 0.92 + 0.12 * lift, rock = PAINT.rockDeep.map((deep, k) => (deep + (PAINT.rock[k] - deep) * gully ** 0.7) * tone);
    const seam = Math.sin(px * .38 + pz * .22 + noise2(px / 4, pz / 4, 97) * 2);
    return { px, pz, lift, rock, erosion: footRelief ? noise2(px / 1.4, pz / 1.4, 95) * .55 + seam * .8 : 0, ledge: footRelief ? (Math.abs(noise2(px / 3.2, pz / 1.8, 96)) - .3) * 2.2 : 0 };
  };
  let cached = footRelief && PEAK_SAMPLES.get(parameters);
  if (footRelief) {
    const signature = JSON.stringify([x, z, radius, summits, warp, footRelief]);
    if (!cached || cached.signature !== signature) {
      const grid = [], traces = [];
      for (let r = 0; r <= rows; r++) for (let c = 0; c < columns; c++) grid.push(sample((r / rows) ** 1.35, c / columns * Math.PI * 2));
      for (let k = 0; k < 240; k++) for (let r = 0; r <= rows; r++) traces.push(sample((r / rows) ** 1.35, k / 240 * Math.PI * 2));
      cached = { signature, grid, traces }; PEAK_SAMPLES.set(parameters, cached);
    }
  }
  const point = ({ px, pz, lift, rock, erosion, ledge }) => {
    const y = base + rise * lift, ground = footRelief ? groundAt(px, pz) : 0, clearance = footRelief ? y - ground : 100;
    const worn = erosion * (1 - smooth(2, 16, clearance)), shelf = ledge * (1 - smooth(30, 95, clearance)) * (1 - smooth(snowLine - 20, snowLine, y));
    return { at: [px, y + worn + shelf, pz], albedo: rock, snow: 1, ground };
  };
  sheet(rows, columns, (r, c) => point(cached ? cached.grid[r * columns + c] : sample((r / rows) ** 1.35, c / columns * Math.PI * 2)), [x, base - 1000, z]);
  if (!footRelief) return;
  for (let k = 0; k < 240; k++) {
    const a = k / 240 * Math.PI * 2, samples = [];
    for (let r = 0; r <= rows; r++) {
      const { at: [px, py, pz], ground } = point(cached.traces[k * (rows + 1) + r]);
      samples.push({ px, pz, py, gap: py - ground });
    }
    for (let r = 1; r < samples.length; r++) {
      const inner = samples[r - 1], outer = samples[r];
      if (inner.gap <= 0 || outer.gap > 0) continue;
      const t = inner.gap / (inner.gap - outer.gap), px = inner.px + (outer.px - inner.px) * t, pz = inner.pz + (outer.pz - inner.pz) * t;
      const width = .55 + .5 * (Math.sin(k * 4.2) + 1), depth = .7 + .5 * (Math.cos(k * 2.8) + 1), high = .18 + .09 * (Math.sin(k * 2.3) + 1);
      const levels = [[1, -.16], [1.08, .02], [.66, high], [.12, high * .8], [0, high * .8]];
      sheet(levels.length - 1, 10, (ring, c) => {
        const turn = c / 10 * Math.PI * 2, [reach, up] = levels[ring], across = Math.cos(turn) * width * reach, out = Math.sin(turn) * depth * reach + .45;
        const sx = px - Math.sin(a) * across + Math.cos(a) * out, sz = pz + Math.cos(a) * across + Math.sin(a) * out;
        return { at: [sx, groundAt(sx, sz) + up, sz], albedo: PAINT.rock.map(value => value * (.8 + ring * .025)), snow: 1 };
      }, [px, groundAt(px, pz) - 1, pz]);
    }
  }
}

export const BUTTE_STRATA = Object.freeze([
  Object.freeze({ from: 0, to: 0.8, drop: 0.11, tier: 1, albedo: [0.8, 0.74, 0.63] }),
  Object.freeze({ from: 2.2, to: 2.9, drop: 0.1, tier: 1, albedo: [0.67, 0.67, 0.65] }),
  Object.freeze({ from: 4.3, to: 5, drop: 0.1, tier: 1, albedo: [0.79, 0.68, 0.55] }),
  Object.freeze({ from: 18, to: 18.7, drop: 0.1, tier: -1, albedo: [0.7, 0.69, 0.65] }),
  Object.freeze({ from: 20.4, to: 21.1, drop: 0.1, tier: -1, albedo: [0.81, 0.75, 0.62] }),
  Object.freeze({ from: 22.8, to: 23.5, drop: 0.1, tier: -1, albedo: [0.64, 0.62, 0.58] }),
]);
const BUTTE_STEPS = Object.freeze([-1, -0.6, -0.3, -0.1, ...BUTTE_STRATA.flatMap(({ from, to }) => [from, (from + to) / 2, from + (to - from) * 0.8, to, to + 0.6]), 9, 12, 15, 27, 33, 42, 55, 75].sort((a, b) => a - b));
const tieredBluff = (m, tilt) => BUTTE_STRATA.reduce((sum, { from, to, drop, tier }) => sum + drop * (1 + tier * tilt / 3) * (1 - smooth(from, to, m)), 0) + 0.05 * (1 - smooth(6, 18, m)) + 0.04 * (1 - smooth(23.5, 27, m)) + 0.3 * (1 - smooth(27, 75, m));
const sheerBluff = m => 0.65 * (1 - smooth(0, 8, m)) + 0.35 * (1 - smooth(8, 60, m));

function buildFalls({ sheet }, { x, z, height, width, depth }) {
  const ground = heightAt(x, z), root = footing(x, z, width + 60) - 6, top = ground + height, columns = 64, [ex, ez] = toward(-x, -z), face = Math.atan2(ez, ex);
  const plateau = a => (1 + noise2(Math.cos(a) * 1.8, Math.sin(a) * 1.8, 91) * 0.22 + noise2(Math.cos(a) * 5, Math.sin(a) * 5, 93) * 0.09) / Math.hypot(Math.cos(a - face - Math.PI / 2) / width, Math.sin(a - face - Math.PI / 2) / depth);
  const channel = a => Math.exp(-((Math.atan2(Math.sin(a - face), Math.cos(a - face)) / 0.16) ** 2));
  const tiltAt = a => noise2(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 96) * 1.6;
  const level = (m, a) => {
    const open = channel(a), tilt = tiltAt(a), crown = 0.03 * (1 - smooth(-30, 0, m)) + noise2(Math.cos(a) * 4, Math.sin(a) * 4, 94) * 0.04 * (1 - smooth(-4, 2, m));
    return root + (top - root) * (tieredBluff(m, tilt) + (sheerBluff(m) - tieredBluff(m, tilt)) * open + crown) - 6 * open * (1 - smooth(-24, -2, m)) * smooth(-40, -14, m);
  };
  const stratumAt = (y, a) => {
    const tilt = tiltAt(a);
    for (let i = 0; i < BUTTE_STRATA.length; i++) {
      const { from, to } = BUTTE_STRATA[i], high = root + (top - root) * tieredBluff(from, tilt), low = root + (top - root) * tieredBluff(to, tilt);
      if (y <= high + 1 && y >= low - 1) return { stratum: BUTTE_STRATA[i], below: Math.max(0, high - y), fall: Math.min(1, Math.max(0, (high - y) / (high - low))), cap: i === 0 };
    }
    return null;
  };
  sheet(BUTTE_STEPS.length - 1, columns, (r, c) => {
    const a = c / columns * Math.PI * 2, edge = plateau(a), step = BUTTE_STEPS[r], m = step < 0 ? step * edge : step, y = level(m, a);
    const steep = Math.abs(level(m + 0.25, a) - level(m - 0.25, a)) * 2, rocky = smooth(1.4, 3.2, steep);
    const fluted = edge + m + 2.5 * noise2(a * 13, y / 9, 95) * smooth(-3, 0, m) * (1 - smooth(27, 34, m));
    const layer = rocky > 0 ? stratumAt(y, a) : null;
    let stone = PAINT.bluffBand, moss = 0;
    if (layer) {
      const { stratum, below, fall, cap } = layer, drip = cap ? 4 + 7 * Math.max(0, noise2(a * 9, 3, 98)) : 2.5;
      stone = stratum.albedo.map(tone => tone * (1 - 0.5 * smooth(0.7, 1, fall)));
      moss = (cap ? 1 : 0.7) * (1 - smooth(drip * 0.5, drip, below));
    }
    const albedo = stone.map((rock, k) => { const face = PAINT.turf[k] + (rock - PAINT.turf[k]) * rocky; return face + (PAINT.moss[k] - face) * moss; });
    return { at: [x + Math.cos(a) * fluted, y, z + Math.sin(a) * fluted], albedo };
  }, [x, root - 1000, z]);
  const lipOut = plateau(face) - 1;
  return { lip: [x + ex * lipOut, level(-1, face), z + ez * lipOut], foot: level(15, face), out: [ex, ez] };
}

const MILL = Object.freeze({ foot: 0.19, waist: 0.15, neck: 0.11, cap: 0.17, hub: 0.055, stock: 0.5, sailFrom: 0.2, sailWide: 0.21, bars: 4, member: 0.5, reefed: 0.45 });

function buildWindmill({ lathe, panel }, { x, z, height }) {
  const ground = heightAt(x, z), root = footing(x, z, height * MILL.foot) - 4, top = ground + height, plinth = ground + height * 0.08, neck = top - 3, cap = height * MILL.cap;
  lathe([x, z], [[height * MILL.foot, root], [height * MILL.foot * 0.96, plinth]], { albedo: PAINT.plinth }, 14);
  lathe([x, z], [[height * MILL.foot * 0.96, plinth], [height * MILL.waist, ground + height * 0.45], [height * MILL.neck, neck]], { albedo: PAINT.plaster }, 14);
  lathe([x, z], [[height * MILL.neck, neck - 0.5], [cap, neck - 0.5], [cap, neck + 1.2], [cap * 0.86, top + 3], [cap * 0.5, top + 6], [0, top + 7]], { albedo: PAINT.thatch }, 14);
  const hub = [x - SAIL_AXIS[0] * (cap + 1.2), top + 1, z - SAIL_AXIS[2] * (cap + 1.2)], across = [-SAIL_AXIS[2], 0, SAIL_AXIS[0]], length = height * MILL.stock, spin = [...hub, SAIL_TURN], member = MILL.member;
  const at = (dir, side, along, wide, lift) => [0, 1, 2].map(k => hub[k] + dir[k] * along + side[k] * wide + SAIL_AXIS[k] * lift);
  const bar = (dir, side, from, to, low, high, lift, albedo) => panel([at(dir, side, from, low, lift), at(dir, side, to, low, lift), at(dir, side, to, high, lift), at(dir, side, from, high, lift)], SAIL_AXIS, { albedo, spin });
  const boss = height * MILL.hub, rim = Array.from({ length: 10 }, (_, k) => [Math.cos(k / 10 * Math.PI * 2), Math.sin(k / 10 * Math.PI * 2)]);
  panel(rim.map(([c, v]) => at(across, [0, 1, 0], c * boss, v * boss, -1.6)), SAIL_AXIS, { albedo: PAINT.hubCap, spin });
  for (let k = 0; k < 4; k++) {
    const turn = k * Math.PI / 2 + 0.4, dir = [0, 1, 2].map(i => across[i] * Math.cos(turn) + (i === 1 ? Math.sin(turn) : 0)), side = [0, 1, 2].map(i => -across[i] * Math.sin(turn) + (i === 1 ? Math.cos(turn) : 0));
    const inner = length * MILL.sailFrom, outer = length * MILL.sailWide, reef = k % 2 ? inner + (length - inner) * MILL.reefed : length;
    bar(dir, side, -1, length, -member, member, -0.4, PAINT.spar);
    bar(dir, side, inner, reef, member, outer - member, 0.1, PAINT.cloth);
    for (const rail of [member, outer - member]) bar(dir, side, inner, length, rail - member, rail + member, -0.2, PAINT.spar);
    for (let j = 0; j <= MILL.bars; j++) { const along = inner + (length - inner) * j / MILL.bars; bar(dir, side, along - member, along + member, member, outer, -0.2, PAINT.spar); }
  }
}

function buildGate(shape, mark, groundAt) {
  const { x, z, width, height } = mark, base = groundAt(x, z), copper = { albedo: [0.42, 0.57, 0.45] }, stone = { albedo: [0.6, 0.65, 0.49] }, gold = { albedo: [0.75, 0.56, 0.26], lamp: 0.22 };
  for (const sign of [-1, 1]) {
    const cx = x + sign * width * 0.5, foot = groundAt(cx, z);
    shape.sheet(32, 48, (r, c) => {
      const t = r / 32, a = c / 48 * Math.PI * 2, flute = (Math.sin(a * 12 + Math.sin(t * 9) * .24) * .5 + .5) ** 4;
      const radius = (1.55 - t * .7) * (1 + .12 * Math.sin(a * 3 + t * 5)) - flute * .18;
      const shade = 1 - flute * .2, notch = Math.max(0, Math.sin(a * 5 + t * 23) - .65) * .18 * (1 - t);
      return { at: [cx - sign * t * t * .7 + Math.cos(a) * (radius - notch), foot - .6 + t * (base + height * .69 - foot + .6), z + Math.sin(a) * (radius - notch)], albedo: [(.49 + t * .12) * shade, (.55 + t * .12) * shade, (.36 + t * .12) * shade] };
    }, [cx, foot, z]);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + sign, endX = cx + Math.cos(a) * 3.2, endZ = z + Math.sin(a) * 3.2;
      const endY = groundAt(endX, endZ) - 0.15;
      shape.sheet(6, 8, (r, c) => {
        const t = r / 6, turn = c / 8 * Math.PI * 2, thick = 0.52 * (1 - t) + 0.035, level = foot + 1.1 + (endY - foot - 1.1) * t - Math.sin(t * Math.PI) * 0.24;
        return { at: [cx + (endX - cx) * t - Math.sin(a) * Math.cos(turn) * thick, level + Math.sin(turn) * thick * 0.65, z + (endZ - z) * t + Math.cos(a) * Math.cos(turn) * thick], albedo: stone.albedo.map(value => value * (0.9 + t * 0.1)) };
      }, [cx, foot - 1, z]);
    }
    for (const rise of [.22, .48, .64]) shape.sheet(3, 48, (r, c) => {
      const level = base + height * rise + r * .065, t = (level - foot + .6) / (base + height * .69 - foot + .6), a = c / 48 * Math.PI * 2;
      const flute = (Math.sin(a * 12 + Math.sin(t * 9) * .24) * .5 + .5) ** 4, notch = Math.max(0, Math.sin(a * 5 + t * 23) - .65) * .18 * (1 - t);
      const radius = (1.55 - t * .7) * (1 + .12 * Math.sin(a * 3 + t * 5)) - flute * .18 - notch + (r === 0 || r === 3 ? .02 : .05);
      return { at: [cx - sign * t * t * .7 + Math.cos(a) * radius, level, z + Math.sin(a) * radius], ...copper };
    }, [cx, foot, z]);
  }
  shape.sheet(28, 8, (r, c) => {
    const a = r / 28 * Math.PI, t = c / 8 * Math.PI * 2, radius = 0.78 + 0.15 * Math.sin(a * 4), lateral = Math.cos(t) * radius;
    return { at: [x + Math.cos(a) * (width * 0.5 + lateral), base + height * 0.66 + Math.sin(a) * (height * 0.32 + lateral), z + Math.sin(t) * radius], ...stone };
  }, [x, base, z]);
  const roof = base + height * 0.96;
  shape.lathe([x, z], [[0.14, roof - 3.2], [0.14, roof]], gold, 8);
  shape.lathe([x, z], [[1.32, roof - 4.15], [1.4, roof - 3.9], [1.05, roof - 3.68], [0.68, roof - 2.35], [0.3, roof - 2.15], [0.25, roof - 1.95]], gold, 20);
  shape.lathe([x, z], [[0.13, roof - 4.45], [0.26, roof - 4.45], [0.29, roof - 4.22], [0.12, roof - 3.8]], copper, 10);
  for (const side of [-1, 1]) {
    const px = x + side * width * .64, pz = z + 1.4, foot = groundAt(px, pz);
    shape.lathe([px, pz], [[.52, foot - .2], [.52, foot + .14], [.47, foot + .22], [.42, foot + 1.35], [.58, foot + 1.55], [.1, foot + 1.9]], gold, 16);
    for (const facing of [-1, 1]) {
      const normal = [0, 0, facing], at = (across, up) => {
        const radius = .47 - (up - .22) / 1.13 * .05;
        return [px + across, foot + up, pz + facing * (Math.sqrt(radius * radius - across * across) + .008)];
      };
      const rim = [[-.25, .61], [-.25, 1.03], [0, 1.2], [.25, 1.03], [.25, .61], [0, .49]];
      for (let i = 0; i < rim.length; i++) {
        const a = rim[i], b = rim[(i + 1) % rim.length], inner = p => [p[0] * .65, .85 + (p[1] - .85) * .75];
        const ia = inner(a), ib = inner(b);
        shape.panel([at(...a), at(...b), at(...ib), at(...ia)], normal, { albedo: [.25, .37, .3] });
      }
      for (const offset of [-.07, .07]) shape.panel([at(offset - .018, .76), at(offset + .018, .76), at(offset + .018, 1), at(offset - .018, 1)], normal, { albedo: [.25, .37, .3] });
    }
  }
}

function buildArch(shape, { x, z, width, height }, groundAt) {
  const base = groundAt(x, z), courses = [0, .04, .09, .125, .16, .2, .25, .31, .39, .49, .61, .74, .86, 1];
  const profile = courses.flatMap((t, k) => k === 0 ? [[t, 0]] : [[t - .004, 0], [t, -.52], [t + .004, -.48], [t + .01, 0]]);
  for (const sign of [-1, 1]) {
    const cx = x + sign * width * .5, root = footing(cx, z, width * .21, groundAt) - 2;
    shape.sheet(profile.length - 1, 64, (r, c) => {
      const [t, cut] = profile[r], a = c / 64 * Math.PI * 2;
      const flutes = Math.max(0, Math.sin(a * 11 + t * 2) - .25) * .72 + Math.sin(a * 5 + t * 3.5) * .55;
      const radius = width * (.18 - t * .07) * (1 + .06 * Math.sin(a * 3 + t)) - flutes + cut * (.6 + .4 * Math.sin(a * 3 + t * 17));
      const strata = r === 0 ? 0 : Math.sin(a * 2 + t * 5) * .3 + Math.sin(a * 7) * .1;
      const shade = 1 - Math.abs(cut) * .28, warm = .02 * Math.sin(t * 9);
      return { at: [cx + Math.cos(a) * radius, root + t * (base + height * .66 - root) + strata, z + Math.sin(a) * radius], albedo: r === 0 ? [.74, .49, .32] : [(.71 + warm) * shade, (.465 + warm) * shade, .31 * shade] };
    }, [cx, root, z]);
    for (let k = 0; k < 13; k++) {
      const a = k / 13 * Math.PI * 2 + sign * .32, spread = width * (.22 + .012 * Math.sin(k * 2.3)), px = cx + Math.cos(a) * spread, pz = z + Math.sin(a) * spread;
      const reach = .7 + (Math.sin(k * 3.7) + 1) * .65, high = .32 + (Math.cos(k * 2.7) + 1) * .36;
      const levels = [[.85, -.25], [1, .02], [.94, high * .5], [.64, high], [.18, high * .91], [0, high * .91]];
      shape.sheet(levels.length - 1, 12, (r, c) => {
        const turn = c / 12 * Math.PI * 2, [scale, lift] = levels[r], lobe = 1 + .12 * Math.sin(turn * 3 + k), sx = px + Math.cos(turn) * reach * scale * lobe, sz = pz + Math.sin(turn) * reach * scale * lobe * .72;
        return { at: [sx, groundAt(sx, sz) + lift, sz], albedo: r < 2 ? [.58, .39, .28] : [.7, .48, .32] };
      }, [px, groundAt(px, pz) - 1, pz]);
    }
  }
  shape.sheet(24, 8, (r, c) => {
    const a = r / 24 * Math.PI, b = c / 8 * Math.PI * 2, radius = width * 0.115;
    return { at: [x + Math.cos(a) * (width * 0.5 + Math.cos(b) * radius), base + height * 0.65 + Math.sin(a) * (height * 0.35 + Math.cos(b) * radius), z + Math.sin(b) * radius], albedo: [0.73, 0.46, 0.31] };
  }, [x, base, z]);
}

function buildIslets(shape, { x, z, height }) {
  const islands = [
    { dx: -65, dz: 20, lift: -15, width: 25, drop: 26, stretch: [1.35, 0.56], sweep: [-9, 5], shelves: [[0.07, -1], [0.3, -0.88], [0.48, -0.51], [0.7, -0.39], [0.91, -0.17], [1, -0.08], [0.92, 0], [0, 0.025]] },
    { dx: 0, dz: -22, lift: 18, width: 37, drop: 38, stretch: [1, 0.8], sweep: [3, -7], shelves: [[0.14, -1], [0.42, -0.77], [0.38, -0.62], [0.65, -0.4], [0.8, -0.22], [1, -0.1], [0.94, 0], [0, 0.035]] },
    { dx: 74, dz: 12, lift: -1, width: 22, drop: 24, stretch: [0.78, 1.04], sweep: [7, 3], shelves: [[0.04, -1], [0.26, -0.57], [0.56, -0.5], [0.61, -0.38], [0.85, -0.25], [1, -0.14], [0.86, 0], [0, 0.04]] },
  ];
  islands.forEach(({ dx, dz, lift, width, drop, stretch, sweep, shelves }, k) => {
    const px = x + dx, pz = z + dz, y = height + lift;
    shape.sheet(shelves.length - 1, 24, (r, c) => {
      const a = c / 24 * Math.PI * 2, grain = noise2(k * 4 + Math.cos(a) * 2.3, Math.sin(a) * 2.3, 89), lobe = 1 + grain * 0.19 + Math.sin(a * 3 + k) * 0.06;
      const reach = shelves[r][0] * width * lobe, turn = shelves[r][1] ** 2;
      const albedo = r >= 6 ? [0.56, 0.65, 0.46] : [0.65 + grain * 0.08, 0.68 + grain * 0.07, 0.68 + grain * 0.06];
      return { at: [px + Math.cos(a) * reach * stretch[0] + sweep[0] * turn, y + shelves[r][1] * drop + (r < 6 ? Math.sin(a * 3 + k + r * 0.4) * 1.3 : 0), pz + Math.sin(a) * reach * stretch[1] + sweep[1] * turn], albedo };
    }, [px, y - drop - 4, pz]);
    if (k === 1) for (let p = 0; p < 3; p++) shape.lathe([px + (p - 1) * 12, pz], [[2.4, y], [2, y + 6 + p * 2], [1.8, y + 7 + p * 2]], { albedo: [0.75, 0.78, 0.69] }, 7);
  });
}

function buildHearth(shape, { x, z, radius }, groundAt) {
  const base = groundAt(x, z);
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * Math.PI * 2, px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
    const foot = groundAt(px, pz), width = .31 + (Math.sin(k * 7.3) + 1) * .08, high = .28 + (Math.cos(k * 4.7) + 1) * .11;
    const profile = [[.8, -.16], [1, high * .28], [.83, high * .74], [.5, high], [0, high * .92]];
    shape.sheet(profile.length - 1, 12, (r, c) => {
      const turn = c / 12 * Math.PI * 2, [scale, lift] = profile[r], reach = width * scale * (1 + Math.sin(turn * 3 + k) * .15);
      const dx = Math.cos(turn) * reach * (k % 3 ? 1.25 : .85), dz = Math.sin(turn) * reach;
      return { at: [px + dx * Math.cos(a) - dz * Math.sin(a), foot + lift + Math.sin(turn * 2 + k) * .035 * scale, pz + dx * Math.sin(a) + dz * Math.cos(a)], albedo: (k % 3 ? [.59, .61, .54] : [.7, .65, .53]).map(tone => tone * (.94 + r * .025)) };
    }, [px, foot - 1, pz]);
  }
  shape.lathe([x, z], [[0.9, base + 0.02], [0.75, base + 0.11], [0, base + 0.13]], { albedo: [0.29, 0.3, 0.24] }, 18);
  for (let k = 0; k < 17; k++) {
    const a = k * 2.4, spread = 0.19 + k / 17 * 0.54, px = x + Math.cos(a) * spread, pz = z + Math.sin(a) * spread, reach = 0.08 + (Math.sin(k * 3.4) + 1) * 0.025;
    shape.sheet(3, 9, (r, c) => {
      const turn = c / 9 * Math.PI * 2, wide = [1, 1.1, .5, 0][r], hot = r === 1 && c % 3 === k % 3;
      return { at: [px + Math.cos(turn) * reach * wide, base + [.1, .15, .2, .23][r], pz + Math.sin(turn) * reach * wide], albedo: hot ? [.52, .17, .05] : [.16, .15, .12], lamp: hot ? .74 : .08 };
    }, [px, base, pz]);
  }
  for (let k = 0; k < 3; k++) {
    const turn = k * 1.12 + 0.35;
    const point = (along, a, radius = 1) => {
      const bark = 1 + Math.sin(along * 12 + a * 3) * .045 * (radius > .9 ? 1 : 0);
      const width = Math.sin(a) * (.12 + Math.sin(a * 3) * .015) * radius * bark;
      return [x + Math.cos(turn) * along - Math.sin(turn) * width, base + 0.24 + k * 0.05 + Math.cos(a) * .12 * radius * bark, z + Math.sin(turn) * along + Math.cos(turn) * width];
    };
    shape.sheet(16, 16, (r, c) => {
      const a = c / 16 * Math.PI * 2, fissure = c % 4 === 0;
      return { at: point((r / 16 - .5) * 1.65, a, fissure ? .84 : 1), albedo: fissure ? [.12, .115, .095] : c % 3 ? [.2, .19, .15] : [.29, .27, .22] };
    }, [x, base, z]);
    for (const sign of [-1, 1]) {
      const normal = [Math.cos(turn) * sign, 0, Math.sin(turn) * sign], along = .825 * sign;
      for (let c = 0; c < 10; c++) {
        const a = c / 10 * Math.PI * 2, next = (c + 1) / 10 * Math.PI * 2;
        const rim = [point(along, a), point(along, next), point(along, next, .6), point(along, a, .6)];
        shape.panel(sign < 0 ? rim.reverse() : rim, normal, { albedo: [0.25, 0.24, 0.2] });
      }
      const face = Array.from({ length: 10 }, (_, c) => point(along, c / 10 * Math.PI * 2, .6));
      shape.panel(sign < 0 ? face.reverse() : face, normal, { albedo: [0.36, 0.31, 0.24] });
    }
  }
  const postX = x - radius - .48, postZ = z - .1, ground = groundAt(postX, postZ), copper = { albedo: [.38, .47, .34] };
  shape.lathe([postX, postZ], [[.14, ground - .18], [.13, ground + 1.7], [.085, ground + 2.3]], { albedo: [.27, .23, .16] }, 9);
  shape.sheet(10, 7, (r, c) => {
    const t = r / 10, a = c / 7 * Math.PI * 2, dx = .45, dy = Math.cos(t * Math.PI) * Math.PI * .17, length = Math.hypot(dx, dy), reach = .035;
    return { at: [postX + t * dx - Math.cos(a) * reach * dy / length, ground + 2.1 + Math.sin(t * Math.PI) * .17 + Math.cos(a) * reach * dx / length, postZ + Math.sin(a) * reach], ...copper };
  }, [postX, ground, postZ]);
  const lampX = postX + .43;
  shape.lathe([lampX, postZ], [[.03, ground + 1.82], [.03, ground + 2.14]], copper, 6);
  shape.lathe([lampX, postZ], [[.21, ground + 1.22], [.23, ground + 1.3], [.15, ground + 1.35], [.15, ground + 1.73], [.25, ground + 1.76], [0, ground + 1.95]], copper, 8);
  shape.lathe([lampX, postZ], [[.155, ground + 1.36], [.155, ground + 1.7]], { albedo: [.77, .48, .19], lamp: .35 }, 8);
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2;
    shape.lathe([lampX + Math.cos(a) * .15, postZ + Math.sin(a) * .15], [[.018, ground + 1.3], [.018, ground + 1.78]], copper, 6);
  }
}

function foldedLeaf(shape, from, to, width, albedo) {
  const dx = to[0] - from[0], dz = to[2] - from[2], length = Math.hypot(dx, dz), across = [-dz / length, dx / length];
  const point = (t, side) => [from[0] + dx * t + across[0] * width * Math.sin(t * Math.PI) * side, from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * width * (side ? 0.14 : 0.48), from[2] + dz * t + across[1] * width * Math.sin(t * Math.PI) * side];
  for (let k = 0; k < 3; k++) for (const side of [-1, 1]) {
    const t = k / 3, next = (k + 1) / 3;
    shape.panel([point(t, 0), point(t, side), point(next, side), point(next, 0)], [-across[0] * side * 0.35, 1, -across[1] * side * 0.35], { albedo: albedo.map(value => value * (side < 0 ? 0.94 : 1.04)) });
  }
}

function buildGroveDetails(shape, definition, groundAt) {
  const path = definition.path, route = ahead => path.offset + ahead * path.drift + path.waves.reduce((sum, wave) => sum + Math.sin(ahead / wave.scale + wave.phase) * wave.amplitude, 0);
  const islands = [];
  if (definition.understory?.banks) {
    for (const [index, bank] of definition.understory.banks.entries()) {
      const dx = bank.to[0] - bank.from[0], dz = bank.to[1] - bank.from[1], steps = Math.ceil(Math.hypot(dx, dz) / bank.spacing);
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, bow = Math.sin(t * Math.PI) * .8;
        islands.push({ x: bank.from[0] + dx * t + bow, z: bank.from[1] + dz * t, spread: bank.spread, scale: bank.scale, seed: 31 + index * 17 + k, plants: 3 });
      }
    }
  } else {
    for (const clearing of definition.clearings ?? []) for (let k = 0; k < 8; k++) {
      const turn = k / 8 * Math.PI * 2 + .22, reach = clearing.radius + 2.1 + Math.sin(k * 2.7) * 1.1;
      islands.push({ x: clearing.x + Math.cos(turn) * reach, z: clearing.z + Math.sin(turn) * reach, spread: 1.4, scale: 1, seed: k + 31 });
    }
    for (const [k, tree] of (definition.trees?.heroes ?? []).entries()) {
      const reach = Math.hypot(tree.x, tree.z) || 1;
      islands.push({ x: tree.x - tree.x / reach * 1.8, z: tree.z - tree.z / reach * 1.8, spread: 1.6, scale: 1.06, seed: k + 53 });
    }
    for (let k = 0; k < 12; k++) {
      const ahead = 18 + k * 7.5 + Math.sin(k * 1.8) * 2.4, side = k % 2 ? -1 : 1;
      islands.push({ x: route(ahead) + side * (6.1 + noise2(k, 3, 723) * 1.3), z: -ahead, spread: 1.45, scale: .92, seed: k + 71 });
    }
  }
  const roomForPlant = (x, z, radius) => {
    const ahead = Math.max(path.start, Math.min(path.end, -z));
    if (Math.hypot(x - route(ahead), -z - ahead) < path.width + radius + .7) return false;
    if ((definition.clearings ?? []).some(clearing => Math.hypot(x - clearing.x, z - clearing.z) < clearing.radius * .72 + radius)) return false;
    if ((definition.rocks ?? []).some(rock => Math.hypot(x - rock.x, z - rock.z) < Math.max(rock.size[0], rock.size[2]) + radius + (rock.climbable ? 1.4 : .45))) return false;
    if ((definition.formations ?? []).some(mark => Math.hypot(x - mark.x, z - mark.z) < mark.radius * 1.32 + radius + 1.4)) return false;
    if (definition.landmarks.some(mark => !mark.distant && Math.hypot(x - mark.x, z - mark.z) < (mark.kind === 'hearth' ? mark.radius + 2.2 : (mark.width ?? 6) * .7 + 1.2) + radius)) return false;
    return !(definition.trees?.heroes ?? []).some(tree => Math.hypot(x - tree.x, z - tree.z) < tree.size * .6);
  };
  for (const island of islands) for (let plant = 0; plant < (island.plants ?? 5); plant++) {
    const seed = island.seed * 5 + plant, turn = seed * 2.39996, spread = plant ? island.spread * (.78 + noise2(seed, 1, 724) * .16) : 0;
    const x = island.x + Math.cos(turn) * spread, z = island.z + Math.sin(turn) * spread, scale = island.scale * (.95 + noise2(seed, 2, 725) * .13), fern = plant === 2 || plant === 4;
    if (!roomForPlant(x, z, scale * 1.2)) continue;
    const y = groundAt(x, z), height = (fern ? .65 : plant ? .84 : 1.17) * scale;
    if (fern) {
      for (let frond = 0; frond < 5; frond++) {
        const angle = turn + frond * Math.PI * .4, dx = Math.cos(angle), dz = Math.sin(angle), reach = scale * (.9 + .12 * Math.sin(seed + frond * 2.3));
        const spine = t => [x + dx * reach * t, y + .035 + height * (Math.sin(t * Math.PI) * .8 + t * .22), z + dz * reach * t];
        for (let part = 0; part < 5; part++) {
          const from = spine(part / 5), to = spine((part + 1) / 5), width = scale * .012;
          shape.panel([[from[0] - dz * width, from[1], from[2] + dx * width], [from[0] + dz * width, from[1], from[2] - dx * width], [to[0] + dz * width, to[1], to[2] - dx * width], [to[0] - dz * width, to[1], to[2] + dx * width]], [0, 1, 0], { albedo: [.39, .51, .2] });
        }
        for (let leaf = 0; leaf < 5; leaf++) {
          const t = .14 + leaf * .17, from = spine(t), fan = scale * .31 * (1 - t * .69), along = scale * .23 * (1 - t * .5);
          for (const side of [-1, 1]) foldedLeaf(shape, from, [from[0] + dx * along - dz * fan * side, from[1] - scale * .035, from[2] + dz * along + dx * fan * side], scale * .104 * (1 - t * .53), [.25 + t * .1, .42 + t * .11, .12 + t * .065]);
        }
      }
      continue;
    }
    for (let branch = 0; branch < 5; branch++) {
      const angle = turn + branch * 2.39996, dx = Math.cos(angle), dz = Math.sin(angle), reach = scale * (branch ? .53 : .12), rise = height * (branch ? .67 + .15 * Math.sin(seed + branch * 2.1) : .94);
      const stem = t => [x + dx * reach * t, y + .025 + rise * t, z + dz * reach * t];
      const root = stem(0), tip = stem(1), width = scale * .014;
      shape.panel([[root[0] - dz * width, root[1], root[2] + dx * width], [root[0] + dz * width, root[1], root[2] - dx * width], [tip[0] + dz * width, tip[1], tip[2] - dx * width], [tip[0] - dz * width, tip[1], tip[2] + dx * width]], [-dz, .2, dx], { albedo: [.3, .36, .17] });
      for (let leaf = 0; leaf < 3; leaf++) {
        const t = .4 + leaf * .23, from = stem(t), fan = scale * (.29 - t * .035), along = scale * (.28 + t * .11), albedo = [.25 + t * .065, .41 + t * .1, .13 + t * .04];
        for (const side of [-1, 1]) foldedLeaf(shape, from, [from[0] + dx * along - dz * fan * side, from[1] + scale * (.14 - t * .13), from[2] + dz * along + dx * fan * side], scale * (.15 + t * .055), albedo);
      }
      foldedLeaf(shape, stem(.91), [tip[0] + dx * scale * .42, tip[1] + scale * .035, tip[2] + dz * scale * .42], scale * .19, [.34, .51, .18]);
    }
  }
}

function buildOutcrop(shape, { x, z, radius, height }, groundAt) {
  const y = groundAt(x, z), profile = [[1.04, -0.5], [1.015, 0.6], [0.985, height * 0.3], [1.025, height * 0.37], [0.985, height * 0.62], [1.025, height * 0.71], [1.02, height], [0, height]];
  const original = (r, c) => {
    const [radiusScale, level] = profile[r], a = c / 24 * Math.PI * 2, grain = noise2(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 529);
    const variation = r > 0 && r < 6 ? Math.sin(a * 3 + r * 1.8) * .014 : 0;
    const reach = radius * (radiusScale + variation), lift = r > 0 && r < 6 ? Math.sin(a * 2 + .7) * .2 + grain * .12 : 0;
    const px = x + Math.cos(a) * reach, pz = z + Math.sin(a) * reach;
    return [px, r === 0 ? Math.min(y + level, groundAt(px, pz) - .28) : y + level + lift, pz];
  };
  const rings = Array.from({ length: 29 }, (_, r) => r / 4);
  shape.sheet(rings.length - 1, 96, (r, c) => {
    const row = Math.min(profile.length - 2, Math.floor(rings[r])), along = rings[r] - row, column = Math.floor(c / 4), across = c / 4 - column;
    const corners = [original(row, column), original(row, (column + 1) % 24), original(row + 1, column), original(row + 1, (column + 1) % 24)];
    const weights = along <= across ? [1 - across, across - along, 0, along] : [1 - along, 0, along - across, across];
    const at = [0, 1, 2].map(k => corners.reduce((sum, corner, index) => sum + corner[k] * weights[index], 0));
    const a = c / 96 * Math.PI * 2, level = (at[1] - y) / height;
    const exposed = smooth(0, .15, level) * (1 - smooth(.88, 1, level)), seam = Math.max(0, Math.sin(a * 9 + level * 2.5) - .3) * .08;
    const chip = Math.min(.018, seam * .23 + Math.max(0, Math.sin(level * 24 + a * 1.7) - .45) * .018) * exposed;
    at[0] -= Math.cos(a) * chip; at[2] -= Math.sin(a) * chip;
    const grain = noise2(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 529), tone = .98 + grain * .1 - chip * 8;
    return { at, albedo: (rings[r] >= 6 ? [.48, .59, .37] : [.61, .66, .60]).map(value => value * tone) };
  }, [x, y - 1, z]);
  for (let k = 0; k < 4; k++) {
    const a = k * 1.57 + 0.4, px = x + Math.cos(a) * radius * 1.28, pz = z + Math.sin(a) * radius * 1.28, foot = groundAt(px, pz);
    shape.lathe([px, pz], [[0.25, foot - 0.12], [0.26, foot + 0.07], [0.19, foot + 0.16], [0, foot + 0.22]], { albedo: [0.67, 0.69, 0.54] }, 7);
  }
}

function buildAstrolabe(shape, { x, z, drum, tower }, groundAt) {
  const base = groundAt(x, z), deck = base + 4, stone = { albedo: [0.66, 0.7, 0.66] }, copper = { albedo: [0.38, 0.58, 0.53], accent: OBSERVATORY_ACCENT }, bronze = { albedo: [0.69, 0.55, 0.33], accent: OBSERVATORY_ACCENT };
  const root = footing(x, z, drum * 1.42, groundAt) - 2;
  shape.lathe([x, z], [[drum * 1.42, root], [drum * 1.42, base + 0.3], [drum * 1.36, base + 0.3], [drum * 1.36, base + 1.2], [drum * 1.31, base + 1.2], [drum * 1.31, base + 2.1], [drum * 1.26, base + 2.1], [drum * 1.26, base + 3], [drum * 1.21, base + 3], [drum * 1.21, deck], [0, deck]], stone, 48);
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, length = k % 3 ? 0.8 : 1.8, width = k % 3 ? 0.06 : 0.12, radius = drum * 1.12;
    const point = (r, side) => [x + Math.cos(a) * r - Math.sin(a) * side, deck + 0.018, z + Math.sin(a) * r + Math.cos(a) * side];
    shape.panel([point(radius - length, -width), point(radius, -width), point(radius, width), point(radius - length, width)], [0, 1, 0], bronze);
  }
  for (const side of [-1, 1]) {
    const px = x + side * drum * .9, crown = deck + tower * (side > 0 ? .7 : .75), levels = [[4.2, base - 8], [3.8, deck + .2], [3.65, deck + .5], [3.7, deck + 1.1], [3.65, deck + 1.4], [3.2, deck + 11], [3.24, deck + 11.2], [3.1, deck + 11.45], [2.9, crown - 1.4], [2.6, crown], [0, crown - .3]];
    shape.sheet(levels.length - 1, 28, (r, c) => {
      const a = c / 28 * Math.PI * 2, [wide, level] = levels[r], flute = Math.max(0, Math.cos(a * 7) - .6) * .22, chipped = r >= 8 ? Math.max(0, Math.cos(a - side * .7)) * 1.35 : 0;
      return { at: [px + Math.cos(a) * (wide - flute), level - chipped, z + Math.sin(a) * (wide - flute)], albedo: stone.albedo.map(value => value * (.94 + .045 * Math.sin(a * 3 + r))) };
    }, [px, base - 9, z]);
    for (const level of [deck + 2.1, deck + 10.7, crown - 2.6]) {
      const course = levels.findIndex(([, y]) => y > level), [ra, ya] = levels[course - 1], [rb, yb] = levels[course], wide = ra + (rb - ra) * (level - ya) / (yb - ya);
      shape.lathe([px, z], [[wide + .01, level], [wide + .04, level + .07], [wide + .04, level + .16], [wide + .01, level + .23]], copper, 28);
    }
  }
  for (let ring = 0; ring < 2; ring++) {
    const radius = drum * (ring ? 1.04 : 1.35), cy = deck + tower * 0.7, turn = ring ? 0.95 : -0.24;
    shape.sheet(44, 8, (r, c) => {
      const a = 0.72 + r / 44 * 5.06, b = c / 8 * Math.PI * 2, reach = radius + Math.cos(b) * 1.4, dx = Math.cos(a) * reach;
      const patina = .5 + .5 * Math.sin(a * 7 + Math.sin(b * 3) * .6), weathered = ring ? [.39, .49, .36] : [.26, .42, .39], finish = ring ? bronze : copper;
      return { at: [x + dx * Math.cos(turn) - Math.sin(b) * 1.4 * Math.sin(turn), cy + Math.sin(a) * reach, z + dx * Math.sin(turn) + Math.sin(b) * 1.4 * Math.cos(turn)], ...finish, albedo: finish.albedo.map((tone, k) => tone + (weathered[k] - tone) * patina * .6) };
    }, [x, cy, z]);
  }
  shape.lathe([x, z], [[0.7, deck + 11], [0.7, deck + tower * 1.1]], bronze, 8);
  shape.lathe([x, z], [[0.6, deck + 9], [4.5, deck + 14], [0.6, deck + 19]], { ...bronze, lamp: 0.3 }, 10);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    const px = x + Math.cos(a) * drum * 1.2, pz = z + Math.sin(a) * drum * 1.2, high = [3.8, 1.7, 4.4, 2.9, 2.1, 3.3, 1.2, 4.8][k];
    const levels = [[1.55, 0], [1.59, .18], [1.38, .34], [1.35, high - .35], [1.22, high], [0, high - .12]];
    shape.sheet(levels.length - 1, 20, (r, c) => {
      const b = c / 20 * Math.PI * 2, [wide, lift] = levels[r], groove = Math.max(0, Math.cos(b * 5) - .65) * .5, broken = r > 2 ? Math.max(0, Math.cos(b + k)) * .52 : 0;
      return { at: [px + Math.cos(b) * (wide - groove), deck + lift - broken, pz + Math.sin(b) * (wide - groove)], albedo: stone.albedo.map(value => value * (r >= 4 ? .83 : .96 - groove)) };
    }, [px, deck - 1, pz]);
  }
}

const DEFINITION_BUILDERS = { gate: buildGate, hearth: buildHearth, arch: buildArch, islets: buildIslets, observatory: buildAstrolabe, peak: (shape, mark, groundAt) => buildPeak(shape, mark, groundAt, 1) };

function definitionParts(definition) {
  const parts = definition.landmarks.filter(mark => DEFINITION_BUILDERS[mark.kind]).map(mark => ({ signature: JSON.stringify(mark), build: (shape, groundAt) => DEFINITION_BUILDERS[mark.kind](shape, mark, groundAt) }));
  for (const mark of definition.formations ?? []) parts.push({ signature: JSON.stringify(mark), build: (shape, groundAt) => buildOutcrop(shape, mark, groundAt) });
  parts.push({ signature: JSON.stringify([definition.path, definition.clearings, definition.trees?.heroes, definition.rocks, definition.formations, definition.landmarks, definition.understory]), build: (shape, groundAt) => buildGroveDetails(shape, definition, groundAt) });
  return parts;
}

function definitionData(shape) {
  const { positions, normals, colors, marks, spins, indices } = shape;
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), uvs: new Float32Array(marks), spins: new Float32Array(spins), indices: new Uint32Array(indices) };
}

function definitionLandmarks(definition, surface) {
  const shape = geometry(), groundAt = (x, z) => surface(x, z)?.height ?? 0;
  for (const part of definitionParts(definition)) part.build(shape, groundAt);
  return definitionData(shape);
}

function cachedDefinitionLandmarks(definition, surface) {
  let previous = [], combined;
  return () => {
    const parts = definitionParts(definition), groundAt = (x, z) => surface(x, z)?.height ?? 0;
    let changed = parts.length !== previous.length;
    const next = parts.map(({ signature, build }, index) => {
      const stored = previous[index];
      if (stored?.signature === signature) {
        let same = true;
        for (let i = 0; i < stored.probes.length; i += 3) if (groundAt(stored.probes[i], stored.probes[i + 1]) !== stored.probes[i + 2]) { same = false; break; }
        if (same) return stored;
      }
      changed = true;
      const shape = geometry(), probes = [];
      build(shape, (x, z) => { const y = groundAt(x, z); probes.push(x, z, y); return y; });
      return { signature, probes, data: definitionData(shape) };
    });
    if (!changed) return combined;
    combined = {};
    for (const key of ['positions', 'normals', 'colors', 'uvs', 'spins', 'indices']) {
      const size = next.reduce((sum, part) => sum + part.data[key].length, 0), array = key === 'indices' ? new Uint32Array(size) : new Float32Array(size);
      let offset = 0, vertices = 0;
      for (const { data } of next) {
        if (key === 'indices') for (let i = 0; i < data.indices.length; i++) array[offset + i] = data.indices[i] + vertices;
        else array.set(data[key], offset);
        offset += data[key].length; vertices += data.positions.length / 3;
      }
      combined[key] = array;
    }
    previous = next;
    return combined;
  };
}

export function landmarkGeometry({ definition, surface } = {}) {
  if (definition) return definitionLandmarks(definition, surface);
  const shape = geometry();
  buildObservatory(shape, LANDMARKS.observatory);
  buildPeak(shape, LANDMARKS.peak);
  const falls = buildFalls(shape, LANDMARKS.falls);
  for (const windmill of LANDMARKS.windmills) buildWindmill(shape, windmill);
  const { positions, normals, colors, marks, spins, indices } = shape;
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), uvs: new Float32Array(marks), spins: new Float32Array(spins), indices: positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), falls };
}

export function veilGeometry(falls, definition) {
  const positions = [], colors = [], uvs = [], kinds = [], indices = [];
  const corner = (at, seed, uv, kind) => { positions.push(...at); colors.push(...seed); uvs.push(...uv); kinds.push(kind, 0); };
  const puff = (at, seed, kind) => {
    const first = positions.length / 3;
    for (const uv of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corner(at, seed, uv, kind);
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
  if (!definition) {
  const summit = [LANDMARKS.peak.x, LANDMARKS.peak.summit, LANDMARKS.peak.z];
  for (let i = 0; i < PLUME.puffs; i++) puff(summit, [i / PLUME.puffs, noise2(i * 0.77, 1, 71) * 0.5 + 0.5, noise2(i * 0.91, 2, 72) * 0.5 + 0.5, noise2(i * 1.13, 3, 73) * 0.5 + 0.5], VEIL_KINDS.cap);
  const { lip, foot, out } = falls, side = [out[1], -out[0]], steps = 12, ribbon = positions.length / 3;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, y = lip[1] + (foot - lip[1]) * t, reach = 2 + 12 * Math.sqrt(t), half = 4 + 4 * t;
    for (const u of [-1, 1]) corner([lip[0] + out[0] * reach + side[0] * half * u, y, lip[2] + out[1] * reach + side[1] * half * u], [0, 0, 0, 0.4], [u, t], VEIL_KINDS.falls);
    if (s < steps) indices.push(ribbon + s * 2, ribbon + s * 2 + 1, ribbon + s * 2 + 3, ribbon + s * 2, ribbon + s * 2 + 3, ribbon + s * 2 + 2);
  }
  const splash = [lip[0] + out[0] * 16, foot + 4, lip[2] + out[1] * 16];
  for (let i = 0; i < MIST.puffs; i++) puff(splash, [i / MIST.puffs, noise2(i * 1.7, 4, 74) * 0.5 + 0.5, noise2(i * 1.3, 5, 75) * 0.5 + 0.5, noise2(i * 0.6, 6, 76) * 0.5 + 0.5], VEIL_KINDS.mist);
  }
  (definition?.mist ?? MIST_RIBBONS).forEach(({ reach, low, high, from, to }, k) => {
    const first = positions.length / 3;
    for (let s = 0; s <= RIBBON_SEGMENTS; s++) {
      const u = s / RIBBON_SEGMENTS, bearing = (from + (to - from) * u) * Math.PI / 180, x = WINDOW_EYE[0] + Math.sin(bearing) * reach, z = WINDOW_EYE[1] - Math.cos(bearing) * reach;
      for (const [y, t] of [[low, 0], [high, 1]]) corner([x, y, z], [u, 0, 0, k / (definition?.mist ?? MIST_RIBBONS).length], [bearing * reach / 400, t], VEIL_KINDS.ribbon);
      if (s < RIBBON_SEGMENTS) { const a = first + s * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  });
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), uvs: new Float32Array(uvs), uvs2: new Float32Array(kinds), indices: new Uint16Array(indices) };
}

const SOLID_VERTEX = `precision highp float;
attribute vec3 position, normal; attribute vec4 color, spin; attribute vec2 uv; uniform mat4 world, viewProjection; uniform vec3 eye; uniform float time;
varying vec3 vWorld, vNormal, vAlbedo; varying vec2 vMarks; varying float vSail, vAccent;
const vec3 sailAxis = vec3(${glsl(SAIL_AXIS[0])}, 0., ${glsl(SAIL_AXIS[2])});
vec3 turned(vec3 v, float a) { float c = cos(a), s = sin(a); return v * c + cross(sailAxis, v) * s + sailAxis * dot(sailAxis, v) * (1. - c); }
void main() {
  float a = spin.w * (time + spin.x * .05);
  vec4 p = world * vec4(spin.xyz + turned(position - spin.xyz, a), 1.);
  vec3 n = turned(normal, a);
  if (spin.w > 0. && dot(n, eye - p.xyz) < 0.) n = -n;
  vWorld = p.xyz; vNormal = n; vAlbedo = color.rgb; vAccent = color.a; vMarks = uv; vSail = step(.001, spin.w); gl_Position = viewProjection * p;
}`;

const solidFragment = (definition, grove) => `precision highp float;
varying vec3 vWorld, vNormal, vAlbedo; varying vec2 vMarks; varying float vSail, vAccent;
uniform vec3 eye, sun, sunColor, skyAmbient, groundAmbient, shadowTint, fogNear, fogFar, fogSun, lamp, snow;
uniform float sunStrength, shadowLift, fogDensity, fogHeight, lampGain, sunRim, wet, ambientFloor, wetDarkening, surfaceDetail;
${WORLD_GLSL}
${RIDGE_LIFT_GLSL}
${grove ? GROVE_GLSL : ''}
void main() {
  vec3 n = normalize(vNormal), toEye = normalize(eye - vWorld);
  float snowy = 0.;
  if (vMarks.y > 0.) snowy = smoothstep(${definition ? '-20., 20.' : '-90., 90.'}, vWorld.y - ${glsl(definition?.landmarks.find(mark => mark.kind === 'peak')?.snowLine ?? LANDMARKS.peak.snowLine)} + (worldFbm(vWorld.xz / ${definition ? '60.' : '260.'}) - .5) * ${definition ? '45.' : '420.'}) * smoothstep(.05, .35, n.y);
  vec3 albedo = mix(vAlbedo, snow, snowy) * (1. - wetDarkening * wet * (1. - snowy));
  if (surfaceDetail > 0. && vMarks.x < .2 && vAccent < .5) {
    float stone = 1. - smoothstep(.08, .14, vAlbedo.g - vAlbedo.r);
    vec2 plane = vec2(vWorld.x + vWorld.z * .7, vWorld.y + .12 * vWorld.x);
    float grain = worldNoise(plane * 21.), mottle = worldNoise(plane * 2.7);
    float closeDetail = 1. - smoothstep(12., 40., distance(eye, vWorld));
    albedo *= 1. + surfaceDetail * stone * ((mottle - .5) * .07 + (grain - .5) * .035 * closeDetail) * (1. - snowy);
  }
  float lit = clamp((dot(n, sun) + .3) / 1.3, 0., 1.);
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .5 + .5);
  vec3 shade = shadowTint * shadowLift + ambient * (.55 + .9 * snowy);
  vec3 color = albedo * mix(shade, max(sunColor * sunStrength, shade * ambientFloor), lit);
  ${grove ? 'vec4 grove = groveAt(vWorld.xz, 0.); grove.g = 1.; color = mix(color, groveLight(albedo, n, grove), 1. - snowy);' : ''}
  float rim = pow(1. - clamp(dot(n, toEye), 0., 1.), 3.) * clamp(dot(-toEye, sun) * 1.5, 0., 1.) * (.2 + .8 * snowy + ${definition ? '.12' : '1.6'} * vAccent);
  color += sunColor * sunStrength * (rim * .55 + albedo * vSail * pow(max(dot(-toEye, sun), 0.), 2.) * .25);
  color = liftRidges(worldAir(color, mix(vWorld, eye, .5 * snowy + .3 * vAccent - .7 * wet), eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), vWorld.y, distance(eye, vWorld));
  vec3 view = normalize(vec3(toEye.x, 0., toEye.z)), sunFlat = vec3(sun.x, 0., sun.z), sunAcross = normalize(sunFlat - view * dot(sunFlat, view) + vec3(0., 1e-4, 0.));
  float sunSide = (.5 + .5 * smoothstep(.05, .55, dot(n, sunAcross))) * (.6 + .4 * pow(1. - clamp(dot(n, toEye), 0., 1.), 1.2));
  color = mix(color, mix(sunColor, vec3(1.), .4), snowy * sunRim * sunSide * .7);
  color += lamp * vMarks.x * lampGain * mix(.35, 1., exp(-distance(eye, vWorld) * fogDensity * .5));
  gl_FragColor = vec4(color, 1.);
}`;

const windAlong = toward(WIND[0], WIND[1]);

const VEIL_VERTEX = `precision highp float;
attribute vec3 position; attribute vec4 color; attribute vec2 uv, uv2; uniform mat4 world, view, viewProjection; uniform float time;
varying vec3 vWorld, vRight, vUp; varying vec2 vCorner; varying float vAlpha, vSeed, vKind;
const vec2 windDir = vec2(${glsl(windAlong[0])}, ${glsl(windAlong[1])}), across = vec2(${glsl(-windAlong[1])}, ${glsl(windAlong[0])});
void main() {
  vec3 c = (world * vec4(position, 1.)).xyz;
  vRight = vec3(view[0][0], view[1][0], view[2][0]); vUp = vec3(view[0][1], view[1][1], view[2][1]);
  vCorner = uv; vSeed = color.w * 13.; vKind = uv2.x; vAlpha = 1.;
  if (uv2.x > .5 && uv2.x < 1.5) { vWorld = c; gl_Position = viewProjection * vec4(c, 1.); return; }
  if (uv2.x > 2.5) { vAlpha = smoothstep(0., .14, color.x) * (1. - smoothstep(.86, 1., color.x)); vWorld = c; gl_Position = viewProjection * vec4(c, 1.); return; }
  float size;
  if (uv2.x < .5) {
    float age = fract(color.x + time / ${glsl(PLUME.period)});
    c.xz += windDir * (age * ${glsl(PLUME.reach)} - 120.) + across * (color.y - .5) * (160. + age * 520.);
    c.y += ${glsl(PLUME.rise)} * color.z - 150. - age * age * 300.;
    size = mix(160., 420., sqrt(age)) * (.7 + .6 * color.w);
    vAlpha = smoothstep(0., .12, age) * (1. - smoothstep(.55, 1., age));
  } else {
    float age = fract(color.x + time / ${glsl(MIST.period)});
    c.xz += windDir * age * 26. + (color.yz - .5) * ${glsl(MIST.spread)};
    c.y += age * ${glsl(MIST.rise)};
    size = mix(${glsl(MIST.small)}, ${glsl(MIST.large)}, sqrt(age)) * (.7 + .6 * color.w);
    vAlpha = sin(3.1416 * age) * .85;
  }
  vec3 p = c + (vRight * uv.x + vUp * uv.y * .7) * size;
  vWorld = p; gl_Position = viewProjection * vec4(p, 1.);
}`;

const VEIL_FRAGMENT = `precision highp float;
varying vec3 vWorld, vRight, vUp; varying vec2 vCorner; varying float vAlpha, vSeed, vKind;
uniform vec3 eye, sunColor, skyAmbient, shadowTint, fogNear, cloudLit, cloudShade, cloudRim, mist;
uniform float time, sunStrength, shadowLift, fogDensity, fogHeight, wet, mistStrength, mistClearance;
${WORLD_GLSL}
${SKY_GLSL}
void main() {
  if (vKind > .5 && vKind < 1.5) {
    float streak = worldNoise(vec2(vCorner.x * 1.6 + 3., vCorner.y * 22. - time * 1.4)), fine = worldNoise(vec2(vCorner.x * 5. + 9., vCorner.y * 60. - time * 3.2));
    float strand = worldNoise(vec2(vCorner.x * 7.5 + 21., vCorner.y * 7. - time * .9)), foam = smoothstep(.72, 1., vCorner.y) + .6 * (1. - smoothstep(0., .12, vCorner.y));
    float edge = 1. - smoothstep(.35, 1., abs(vCorner.x) * (1. - .25 * foam) + (streak - .5) * .5);
    float alpha = edge * (.35 + .3 * streak + .15 * fine + .35 * smoothstep(.35, .7, strand) + .3 * foam) * smoothstep(0., .04, vCorner.y) * (1. - .4 * smoothstep(.85, 1., vCorner.y));
    vec3 water = mix(vec3(.74, .84, .88), vec3(1.), .55 * foam + .3 * smoothstep(.5, .8, strand)) * mix(shadowTint * shadowLift + skyAmbient * (.55 + .6 * wet), sunColor * sunStrength, .45 + .4 * streak);
    gl_FragColor = vec4(worldAir(water, mix(vWorld, eye, .45 * wet), eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), min(alpha * (1. + .5 * wet), 1.));
    return;
  }
  if (vKind > 2.5) {
    float along = vCorner.x + time * .01, body = worldNoise(vec2(along * 2.2, vSeed)) * .6 + worldNoise(vec2(along * 7.3 + 4.1, vSeed + vCorner.y * 1.7)) * .4;
    float t = vCorner.y + (body - .5) * .5;
    float alpha = smoothstep(0., .3, t) * (1. - smoothstep(.38, 1., t)) * smoothstep(.2, .62, body) * vAlpha * mistStrength * 1.6;
    if (mistClearance > 0.) alpha *= smoothstep(mistClearance * .15, mistClearance, distance(vWorld, eye));
    gl_FragColor = vec4(worldAir(mist, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), alpha);
    return;
  }
  float d = length(vCorner), lumpy = worldNoise(vCorner * 2.6 + vSeed) - .5;
  float soft = 1. - smoothstep(.35, 1., d + lumpy * .45);
  if (soft <= 0.) discard;
  vec3 toEye = normalize(eye - vWorld), n = normalize(vRight * vCorner.x + vUp * vCorner.y + toEye * sqrt(max(0., 1. - d * d)));
  float lit = clamp(dot(n, sun) * .5 + .55, 0., 1.), glow = pow(max(dot(-toEye, sun), 0.), 4.) * (1. - soft);
  vec3 color = mix(cloudShade, cloudLit, .45 + .55 * lit) + cloudRim * glow * sunStrength * .6, ray = vWorld - eye;
  color = vKind < .5 ? mix(color, worldSky(normalize(ray)), (1. - exp(-length(ray) * fogDensity * .3)) * .7) : worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight);
  gl_FragColor = vec4(color, soft * vAlpha * .75);
}`;

const LIGHT_COLORS = ['sunColor', 'skyAmbient', 'groundAmbient', 'shadowTint'];
const LIGHT_FLOATS = ['sunStrength', 'shadowLift'];
const THEME_FLOATS = Object.keys(THEME_LIGHT.day);
const CLOUD_COLORS = ['cloudLit', 'cloudShade', 'cloudRim'];
const LAMP = '#ffbf6e';

export const themeLight = atmosphere => THEME_LIGHT[atmosphere.theme] ?? THEME_LIGHT[Object.keys(WORLD_ATMOSPHERES).find(name => WORLD_ATMOSPHERES[name] === atmosphere)] ?? THEME_LIGHT.day;

function landmarkMesh(name, scene, root, data, material) {
  const mesh = new Mesh(name, scene);
  Object.assign(new VertexData(), data).applyToMesh(mesh);
  mesh.material = material; mesh.parent = root; mesh.isPickable = false; mesh.metadata = { castShadow: false, world: true };
  mesh.freezeWorldMatrix();
  return mesh;
}

export function createWorldLandmarks(scene, { root, still, definition, surface, grove }) {
  const uniforms = ['world', 'view', 'viewProjection', ...AIR_UNIFORMS, ...LIGHT_COLORS, ...LIGHT_FLOATS];
  const solidPaint = new ShaderMaterial('world-landmark-paint', scene, { vertexSource: SOLID_VERTEX, fragmentSource: solidFragment(definition, !!grove) }, { attributes: ['position', 'normal', 'color', 'uv', 'spin'], uniforms: [...uniforms, 'lamp', 'snow', 'ambientFloor', 'wetDarkening', 'surfaceDetail', ...RIDGE_UNIFORMS, ...THEME_FLOATS, ...(grove ? GROVE_UNIFORMS : [])], samplers: grove ? ['groveField'] : [] });
  const veilPaint = new ShaderMaterial('world-landmark-veil-paint', scene, { vertexSource: VEIL_VERTEX, fragmentSource: VEIL_FRAGMENT }, { attributes: ['position', 'color', 'uv', 'uv2'], uniforms: [...new Set([...uniforms, ...CLOUD_COLORS, ...SKY_UNIFORMS, 'wet', 'mist', 'mistStrength', 'mistClearance'])], needAlphaBlending: true });
  grove?.bind(solidPaint);
  solidPaint.setFloat('ambientFloor', definition ? 1.08 : 0);
  solidPaint.setFloat('wetDarkening', definition ? 0.1 : 0.3);
  solidPaint.setFloat('surfaceDetail', definition ? 1 : 0);
  veilPaint.setFloat('mistClearance', definition ? 140 : 0);
  solidPaint.backFaceCulling = false; veilPaint.backFaceCulling = false; veilPaint.disableDepthWrite = true;
  const paints = [solidPaint, veilPaint];
  for (const paint of paints) followEye(scene, paint, still);
  solidPaint.setColor3('lamp', Color3.FromHexString(LAMP));
  const nextGeometry = definition ? cachedDefinitionLandmarks(definition, surface) : () => landmarkGeometry();
  let currentGeometry = nextGeometry();
  const { spins, falls, ...solidData } = currentGeometry;
  const solids = landmarkMesh('world-landmarks', scene, root, solidData, solidPaint);
  solids.setVerticesData('spin', spins, false, 4);
  const veils = landmarkMesh('world-landmark-veils', scene, root, veilGeometry(falls, definition), veilPaint);
  veils.alwaysSelectAsActiveMesh = true;
  return {
    meshes: [solids, veils],
    async prepareTerrain(rings, { workers = typeof Worker === 'function', signal } = {}) {
      if (!definition) return;
      if (workers) return inWorker({ definition, rings }, { signal, createWorker: () => new Worker(new URL('./landmark-worker.js', import.meta.url), { type: 'module' }) });
      if (signal?.aborted) throw new DOMException('Landmark preparation cancelled', 'AbortError');
      return landmarkGeometry({ definition, surface: (x, z) => sampleTerrainSurface(rings, x, z) });
    },
    refresh(prepared) {
      if (!definition) return;
      const next = prepared ?? nextGeometry();
      if (next === currentGeometry) return;
      currentGeometry = next;
      const { spins, falls, ...data } = next;
      Object.assign(new VertexData(), data).applyToMesh(solids); solids.setVerticesData('spin', spins, false, 4);
    },
    setTheme(atmosphere) {
      for (const paint of paints) {
        applyAir(paint, atmosphere);
        for (const key of LIGHT_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
        for (const key of LIGHT_FLOATS) paint.setFloat(key, atmosphere[key]);
      }
      applySkyTheme(veilPaint, atmosphere);
      for (const key of CLOUD_COLORS) veilPaint.setColor3(key, Color3.FromHexString(atmosphere[key]));
      solidPaint.setColor3('snow', Color3.FromHexString(atmosphere.snow));
      applyRidges(solidPaint, atmosphere);
      const light = themeLight(atmosphere);
      for (const key of THEME_FLOATS) solidPaint.setFloat(key, light[key]);
      veilPaint.setFloat('wet', light.wet);
      veilPaint.setColor3('mist', Color3.FromHexString(atmosphere.mist)); veilPaint.setFloat('mistStrength', atmosphere.mistStrength);
    },
  };
}
