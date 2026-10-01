import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { heightAt, noise2, ridged, smooth } from '../../core/world-terrain.js';
import { WIND, RIDGE_LIFT_GLSL, RIDGE_UNIFORMS, applyRidges } from './terrain-paint.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';
import { SKY_GLSL, SKY_UNIFORMS, applySkyTheme } from './sky.js';

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

function footing(x, z, radius) {
  let low = heightAt(x, z);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; low = Math.min(low, heightAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius)); }
  return low;
}

function buildObservatory({ lathe, panel }, { x, z, drum, tower }) {
  const deck = heightAt(x, z) + 3, root = footing(x, z, drum * 2) - 40, [ex, ez] = toward(-x, -z), right = [ez, -ex];
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

function buildPeak({ sheet }, { x, z, summit, radius }) {
  const base = footing(x, z, radius * 0.5) - 80, rise = summit - base, rows = 60, columns = 180;
  sheet(rows, columns, (r, c) => {
    const d = (r / rows) ** 1.35, a = c / columns * Math.PI * 2, px = x + Math.cos(a) * d * radius, pz = z + Math.sin(a) * d * radius;
    const wx = px + noise2(px / 1500, pz / 1500, 83) * 420, wz = pz + noise2(px / 1500 + 4, pz / 1500, 84) * 420;
    const crest = PEAK_SUMMITS.reduce((high, [dx, dz, tall, spread]) => {
      const reach = Math.min(1, Math.hypot(wx - x - dx * radius, wz - z - dz * radius) / (radius * spread));
      return smoothMax(high, tall * ((1 - reach) ** 2.2 * 0.55 + (1 - reach) * 0.45), 0.08);
    }, 0);
    const gully = ridged(wx / 1000, wz / 1000, 4, 81), lift = crest * (1 - 0.3 * (1 - gully) * smooth(0.03, 0.3, d));
    const tone = 0.92 + 0.12 * lift, rock = PAINT.rockDeep.map((deep, k) => (deep + (PAINT.rock[k] - deep) * gully ** 0.7) * tone);
    return { at: [px, base + rise * lift, pz], albedo: rock, snow: 1 };
  }, [x, base - 1000, z]);
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

export function landmarkGeometry() {
  const shape = geometry();
  buildObservatory(shape, LANDMARKS.observatory);
  buildPeak(shape, LANDMARKS.peak);
  const falls = buildFalls(shape, LANDMARKS.falls);
  for (const windmill of LANDMARKS.windmills) buildWindmill(shape, windmill);
  const { positions, normals, colors, marks, spins, indices } = shape;
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), uvs: new Float32Array(marks), spins: new Float32Array(spins), indices: positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), falls };
}

export function veilGeometry(falls) {
  const positions = [], colors = [], uvs = [], kinds = [], indices = [];
  const corner = (at, seed, uv, kind) => { positions.push(...at); colors.push(...seed); uvs.push(...uv); kinds.push(kind, 0); };
  const puff = (at, seed, kind) => {
    const first = positions.length / 3;
    for (const uv of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corner(at, seed, uv, kind);
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
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
  MIST_RIBBONS.forEach(({ reach, low, high, from, to }, k) => {
    const first = positions.length / 3;
    for (let s = 0; s <= RIBBON_SEGMENTS; s++) {
      const u = s / RIBBON_SEGMENTS, bearing = (from + (to - from) * u) * Math.PI / 180, x = WINDOW_EYE[0] + Math.sin(bearing) * reach, z = WINDOW_EYE[1] - Math.cos(bearing) * reach;
      for (const [y, t] of [[low, 0], [high, 1]]) corner([x, y, z], [u, 0, 0, k / MIST_RIBBONS.length], [bearing * reach / 400, t], VEIL_KINDS.ribbon);
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

const SOLID_FRAGMENT = `precision highp float;
varying vec3 vWorld, vNormal, vAlbedo; varying vec2 vMarks; varying float vSail, vAccent;
uniform vec3 eye, sun, sunColor, skyAmbient, groundAmbient, shadowTint, fogNear, fogFar, fogSun, lamp, snow;
uniform float sunStrength, shadowLift, fogDensity, fogHeight, lampGain, sunRim, wet;
${WORLD_GLSL}
${RIDGE_LIFT_GLSL}
void main() {
  vec3 n = normalize(vNormal), toEye = normalize(eye - vWorld);
  float snowy = 0.;
  if (vMarks.y > 0.) snowy = smoothstep(-90., 90., vWorld.y - ${glsl(LANDMARKS.peak.snowLine)} + (worldFbm(vWorld.xz / 260.) - .5) * 420.) * smoothstep(.05, .35, n.y);
  vec3 albedo = mix(vAlbedo, snow, snowy) * (1. - .3 * wet * (1. - snowy));
  float lit = clamp((dot(n, sun) + .3) / 1.3, 0., 1.);
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .5 + .5);
  vec3 color = albedo * mix(shadowTint * shadowLift + ambient * (.55 + .9 * snowy), sunColor * sunStrength, lit);
  float rim = pow(1. - clamp(dot(n, toEye), 0., 1.), 3.) * clamp(dot(-toEye, sun) * 1.5, 0., 1.) * (.2 + .8 * snowy + 1.6 * vAccent);
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
uniform float time, sunStrength, shadowLift, fogDensity, fogHeight, wet, mistStrength;
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

export const themeLight = atmosphere => THEME_LIGHT[Object.keys(WORLD_ATMOSPHERES).find(name => WORLD_ATMOSPHERES[name] === atmosphere)] ?? THEME_LIGHT.day;

function landmarkMesh(name, scene, root, data, material) {
  const mesh = new Mesh(name, scene);
  Object.assign(new VertexData(), data).applyToMesh(mesh);
  mesh.material = material; mesh.parent = root; mesh.isPickable = false; mesh.metadata = { castShadow: false, world: true };
  mesh.freezeWorldMatrix();
  return mesh;
}

export function createWorldLandmarks(scene, { root, still }) {
  const uniforms = ['world', 'view', 'viewProjection', ...AIR_UNIFORMS, ...LIGHT_COLORS, ...LIGHT_FLOATS];
  const solidPaint = new ShaderMaterial('world-landmark-paint', scene, { vertexSource: SOLID_VERTEX, fragmentSource: SOLID_FRAGMENT }, { attributes: ['position', 'normal', 'color', 'uv', 'spin'], uniforms: [...uniforms, 'lamp', 'snow', ...RIDGE_UNIFORMS, ...THEME_FLOATS] });
  const veilPaint = new ShaderMaterial('world-landmark-veil-paint', scene, { vertexSource: VEIL_VERTEX, fragmentSource: VEIL_FRAGMENT }, { attributes: ['position', 'color', 'uv', 'uv2'], uniforms: [...new Set([...uniforms, ...CLOUD_COLORS, ...SKY_UNIFORMS, 'wet', 'mist', 'mistStrength'])], needAlphaBlending: true });
  solidPaint.backFaceCulling = false; veilPaint.backFaceCulling = false; veilPaint.disableDepthWrite = true;
  const paints = [solidPaint, veilPaint];
  for (const paint of paints) followEye(scene, paint, still);
  solidPaint.setColor3('lamp', Color3.FromHexString(LAMP));
  const { spins, falls, ...solidData } = landmarkGeometry();
  const solids = landmarkMesh('world-landmarks', scene, root, solidData, solidPaint);
  solids.setVerticesData('spin', spins, false, 4);
  const veils = landmarkMesh('world-landmark-veils', scene, root, veilGeometry(falls), veilPaint);
  veils.alwaysSelectAsActiveMesh = true;
  return {
    meshes: [solids, veils],
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
