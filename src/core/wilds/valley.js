import { fbm, noise2, ridged, smooth } from './noise.js';

const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export const LAKE_LEVEL = 0;

export const VALLEY = freeze({
  core: { minX: -320, maxX: 320, minZ: -300, maxZ: 420, step: 1 },
  spawn: { x: -6, z: -166, yaw: 0.12 },
  lake: {
    level: LAKE_LEVEL,
    spine: [[-34, 8], [-30, 70], [-14, 140], [8, 210], [30, 280], [34, 330]],
    radius: [40, 58, 66, 62, 48, 30],
    depth: 9,
  },
  stream: {
    points: [[106, 40], [96, 36], [84, 32], [72, 27], [58, 22], [44, 18], [26, 16]],
    width: 4.2,
    from: 2.6,
  },
  waterfall: {
    top: { x: 132, z: 41, y: 63 },
    ledge: { x: 124.5, z: 41, y: 35, radius: 4.6 },
    pool: { x: 108, z: 40, y: 2.6, radius: 8 },
  },
  cliff: { base: 112, top: 66 },
  trail: [
    [-6, -172], [-4, -150], [-2, -128], [1, -106], [3, -90], [10, -74], [21, -60], [33, -47], [43, -35],
    [53, -20], [62, -5], [69, 6], [73, 15], [76.7, 23.6], [78.3, 35.4], [82, 46], [86, 58], [85, 74], [81, 92],
    [77, 112], [77, 132], [80, 150], [86, 166], [91, 180], [93, 192],
  ],
  trailWidth: 1.7,
  camp: { x: -6, z: -170, radius: 13 },
  vista: { x: 3, z: -86, yaw: 0.08 },
  ring: { x: 93, z: 206, radius: 13.5, shoulder: 25, height: 13, stones: 9 },
  oak: { x: 44, z: -16, knoll: 11 },
  shrine: { x: 89, z: 52 },
  bridge: { x: 77.5, z: 29.5, yaw: 0.135, length: 12, width: 2.6 },
  fallenTree: { x: 96, z: 37, yaw: -0.38, length: 18 },
  campfires: [
    { id: 'camp', x: -3, z: -166 },
    { id: 'bridge', x: 92, z: 66 },
    { id: 'shoulder', x: 84, z: 170 },
  ],
  observatory: { x: -380, z: 2350 },
  meadow: { x: -92, z: 158 },
});

const LAKE = VALLEY.lake, STREAM = VALLEY.stream, FALL = VALLEY.waterfall;

function segmentProjection(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length)) : 0;
  return { t, distance: Math.hypot(px - ax - dx * t, pz - az - dz * t) };
}

function polylineNearest(points, x, z) {
  let best = { distance: Infinity, index: 0, t: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1], hit = segmentProjection(x, z, ax, az, bx, bz);
    if (hit.distance < best.distance) best = { distance: hit.distance, index: i, t: hit.t };
  }
  return best;
}

export function lakeEdge(x, z) {
  const near = polylineNearest(LAKE.spine, x, z), radius = LAKE.radius[near.index] + (LAKE.radius[near.index + 1] - LAKE.radius[near.index]) * near.t;
  const wobble = noise2(x / 34, z / 34, 401) * 7 + noise2(x / 11, z / 11, 402) * 1.6;
  return near.distance - radius - wobble;
}

export function streamCourse(x, z) {
  const near = polylineNearest(STREAM.points, x, z), segments = STREAM.points.length - 1;
  return { distance: near.distance + noise2(x / 9, z / 9, 411) * .5, along: (near.index + near.t) / segments };
}

export const streamLevel = along => STREAM.from * (1 - along) ** 1.4 + LAKE_LEVEL + .05;

export function cliffLine(z) {
  return VALLEY.cliff.base + Math.sin(z / 47) * 9 + Math.sin(z / 19 + 1.7) * 3 + fbm(z / 60, 3.1, 3, 431) * 8 - 12 * smooth(260, 360, z);
}

const benches = (height, rise) => { const k = Math.floor(height / rise), f = height / rise - k; return (k + smooth(.32, .68, f)) * rise; };

function westHills(x, z) {
  const bumps = [[-175, 40, 85, 44], [-240, 170, 110, 72], [-150, 270, 80, 38], [-300, -30, 120, 86], [-210, -140, 90, 60], [-130, -230, 90, 52], [-330, 330, 140, 96]];
  let height = 0;
  for (const [bx, bz, radius, rise] of bumps) height += rise * Math.exp(-(((x - bx) / radius) ** 2 + ((z - bz) / radius) ** 2));
  return height * (.82 + .3 * fbm(x / 140, z / 140, 3, 441)) + 34 * smooth(-90, -300, x);
}

function southForest(x, z) {
  const rise = 29 * smooth(-14, -98, z + fbm(x / 120, 0, 2, 451) * 16);
  return rise + 9 * smooth(-170, -290, z) + fbm(x / 70, z / 70, 3, 452) * 3 * smooth(-70, -140, z);
}

function eastCliffs(x, z, floor) {
  const line = cliffLine(z), across = x - line;
  const top = VALLEY.cliff.top + fbm(x / 90, z / 90, 3, 461) * 9 + 14 * smooth(30, 160, across);
  const rise = smooth(-3, 9, across + fbm(x / 13, z / 13, 2, 462) * 2.2);
  const layered = benches(rise * (top - floor), 5.5) * .55 + rise * (top - floor) * .45;
  return floor + layered;
}

function ringShoulder(x, z, height) {
  const { x: rx, z: rz, shoulder, height: level } = VALLEY.ring, d = Math.hypot(x - rx, (z - rz) * .85);
  const weight = 1 - smooth(shoulder * .62, shoulder * 1.15, d + noise2(x / 15, z / 15, 471) * 3);
  return height + (level + fbm(x / 22, z / 22, 2, 472) * .35 - height) * weight;
}

function oakKnoll(x, z) {
  const { x: ox, z: oz, knoll } = VALLEY.oak;
  return 4.2 * Math.exp(-(((x - ox) ** 2 + (z - oz) ** 2) / (knoll * knoll)));
}

function waterfallSteps(x, z, height) {
  const { ledge, top } = FALL, d = Math.hypot(x - ledge.x, (z - ledge.z) * .8), shelf = 1 - smooth(ledge.radius, ledge.radius + 2.2, d);
  const shelved = height + (ledge.y - .7 - height) * shelf * smooth(ledge.x - ledge.radius - 3, ledge.x - ledge.radius + .5, x);
  const channel = 1 - smooth(1.4, 3.4, Math.abs(z - top.z + noise2(x / 9, 0, 491) * 1.2));
  return Math.min(shelved, height + (top.y - .7 - height) * channel * smooth(top.x - 1, top.x + .5, x) + 99 * (1 - channel));
}

function shapedHeight(x, z) {
  const floor = 3.2 + fbm(x / 80, z / 80, 3, 421) * 2.2 + fbm(x / 23, z / 23, 2, 422) * .45;
  let height = floor + southForest(x, z) + westHills(x, z) + oakKnoll(x, z);
  if (x > 40) height = Math.max(height, eastCliffs(x, z, height));
  const lake = lakeEdge(x, z);
  if (lake < 18) {
    const bed = LAKE.level - Math.min(LAKE.depth, Math.max(0, -lake) * .17 + Math.max(0, -lake - 18) * .08) - .25;
    const beach = LAKE.level + .35 + Math.max(0, lake) * .32;
    const shore = lake < 0 ? bed : Math.min(height, beach);
    height = height + (shore - height) * (1 - smooth(4, 18, lake));
  }
  height = ringShoulder(x, z, height);
  const stream = streamCourse(x, z);
  if (stream.distance < 14) {
    const bed = streamLevel(stream.along) - .75 * (1 - smooth(STREAM.width * .25, STREAM.width * .6, stream.distance));
    const bank = Math.min(height, streamLevel(stream.along) + .5 + Math.max(0, stream.distance - STREAM.width * .5) * .35);
    height = height + ((stream.distance < STREAM.width * .6 ? bed : bank) - height) * (1 - smooth(STREAM.width * .6, 14, stream.distance));
  }
  const pool = Math.hypot(x - FALL.pool.x, z - FALL.pool.z);
  if (pool < FALL.pool.radius + 10) {
    const bed = FALL.pool.y - 2.4 * (1 - smooth(0, FALL.pool.radius, pool));
    height = height + (Math.min(height, pool < FALL.pool.radius ? bed : FALL.pool.y + .6 + (pool - FALL.pool.radius) * .5) - height) * (1 - smooth(FALL.pool.radius, FALL.pool.radius + 10, pool));
  }
  return waterfallSteps(x, z, height);
}

const FLATS = [
  { ...VALLEY.camp, radius: VALLEY.camp.radius },
  { ...VALLEY.vista, radius: 6 },
  { ...VALLEY.shrine, radius: 4 },
  ...VALLEY.campfires.slice(1).map(fire => ({ ...fire, radius: 4 })),
];
let flatLevels = null;
function levelled(x, z, height) {
  flatLevels ??= FLATS.map(flat => shapedHeight(flat.x, flat.z));
  for (let i = 0; i < FLATS.length; i++) {
    const { x: fx, z: fz, radius } = FLATS[i], d = Math.hypot(x - fx, z - fz);
    if (d < radius * 1.6) height += (flatLevels[i] - height) * (1 - smooth(radius * .75, radius * 1.6, d));
  }
  return height;
}

export const baseHeight = (x, z) => levelled(x, z, shapedHeight(x, z));

export const bridgeDeck = () => streamLevel(streamCourse(VALLEY.bridge.x, VALLEY.bridge.z).along) + 1.7;

const TRAIL_SAMPLE = 1, TRAIL_GRADE = .3;

function gradeLimited(ground, rise) {
  const cut = ground.slice(), fill = ground.slice();
  for (let i = 1; i < cut.length; i++) { cut[i] = Math.min(cut[i], cut[i - 1] + rise); fill[i] = Math.max(fill[i], fill[i - 1] - rise); }
  for (let i = cut.length - 2; i >= 0; i--) { cut[i] = Math.min(cut[i], cut[i + 1] + rise); fill[i] = Math.max(fill[i], fill[i + 1] - rise); }
  return cut.map((value, i) => (value + fill[i]) / 2);
}

function trailSamples() {
  const samples = [];
  const points = VALLEY.trail;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1], length = Math.hypot(bx - ax, bz - az), count = Math.ceil(length / TRAIL_SAMPLE);
    for (let k = 0; k < count; k++) {
      const t = k / count, p0 = points[Math.max(0, i - 1)], p3 = points[Math.min(points.length - 1, i + 2)];
      const t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      samples.push({ x: cr(p0[0], ax, bx, p3[0]), z: cr(p0[1], az, bz, p3[1]) });
    }
  }
  samples.push({ x: points.at(-1)[0], z: points.at(-1)[1] });
  const deck = bridgeDeck(), { x: bx, z: bz, length } = VALLEY.bridge;
  for (const sample of samples) sample.ground = Math.hypot(sample.x - bx, sample.z - bz) < length / 2 + 1 ? deck : baseHeight(sample.x, sample.z);
  const graded = gradeLimited(samples.map(sample => sample.ground), TRAIL_GRADE * TRAIL_SAMPLE);
  const smoothed = samples.map((sample, i) => {
    let sum = 0, weight = 0;
    for (let k = -4; k <= 4; k++) { const w = 1 - Math.abs(k) / 5; sum += graded[Math.max(0, Math.min(samples.length - 1, i + k))] * w; weight += w; }
    return { ...sample, y: sum / weight };
  });
  smoothed.forEach((sample, i) => {
    const before = smoothed[Math.max(0, i - 1)], after = smoothed[Math.min(smoothed.length - 1, i + 1)];
    const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx, dz) || 1;
    sample.dx = dx / length; sample.dz = dz / length; sample.along = i;
  });
  return smoothed;
}

let trailCache = null;
const NONE = [], cellKey = (cx, cz) => (cx + 2048) * 4096 + cz + 2048;
export function trail() {
  if (!trailCache) {
    const samples = trailSamples(), cell = 8, grid = new Map();
    samples.forEach((sample, index) => {
      const key = cellKey(Math.floor(sample.x / cell), Math.floor(sample.z / cell));
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(index);
    });
    trailCache = { samples, cell, grid };
  }
  return trailCache;
}

export function trailNearest(x, z, reach = 12) {
  const { samples, cell, grid } = trail(), span = Math.ceil(reach / cell);
  const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
  let best = null, bestDistance = reach;
  for (let i = -span; i <= span; i++) for (let k = -span; k <= span; k++) {
    for (const index of grid.get(cellKey(cx + i, cz + k)) || NONE) {
      const sample = samples[index], next = samples[Math.min(samples.length - 1, index + 1)];
      const hit = segmentProjection(x, z, sample.x, sample.z, next.x, next.z);
      if (hit.distance < bestDistance) { bestDistance = hit.distance; best = { distance: hit.distance, y: sample.y + (next.y - sample.y) * hit.t, along: index + hit.t, sample }; }
    }
  }
  return best || { distance: Infinity, y: 0, along: -1, sample: null };
}

export function valleyHeight(x, z) {
  let height = shapedHeight(x, z);
  const path = trailNearest(x, z, 9);
  if (path.sample) {
    const channel = streamCourse(x, z).distance, blend = (1 - smooth(VALLEY.trailWidth * .9, 8.5, path.distance)) * smooth(STREAM.width * .7, STREAM.width * 1.6, channel);
    height += (path.y - .08 * (1 - smooth(0, VALLEY.trailWidth, path.distance)) - height) * blend;
  }
  return levelled(x, z, height);
}

export function farHeight(x, z) {
  const d = Math.hypot(x, z - 300);
  if (d < 380) return null;
  const north = smooth(-.2, .5, (z - 300) / d);
  const ranges = [[720, 140, 220, 501], [1250, 290, 320, 502], [2050, 520, 420, 503], [2700, 760, 520, 504]];
  let height = 0;
  for (const [crest, rise, width, seed] of ranges) {
    const across = (d - crest - fbm(x / 900, z / 900, 2, seed) * width * .9) / width;
    const profile = Math.exp(-across * across * (across < 0 ? 2.2 : 1.1));
    const crag = .62 + .55 * ridged(x / (width * 1.3), z / (width * 1.3), 4, seed + 7);
    height += rise * profile * crag * (.45 + .55 * north + .35 * smooth(.3, .9, Math.abs(x) / d));
  }
  const { x: ox, z: oz } = VALLEY.observatory, peak = Math.exp(-(((x - ox) / 340) ** 2 + ((z - oz) / 300) ** 2));
  return height + peak * 260 + 30 * fbm(x / 400, z / 400, 3, 509) * smooth(400, 900, d);
}

export function waterAt(x, z) {
  if (lakeEdge(x, z) < 0) return { height: LAKE.level, kind: 'lake' };
  const pool = Math.hypot(x - FALL.pool.x, z - FALL.pool.z);
  if (pool < FALL.pool.radius) return { height: FALL.pool.y, kind: 'pool' };
  const stream = streamCourse(x, z);
  if (stream.distance < STREAM.width * .5) return { height: streamLevel(stream.along), kind: 'stream', along: stream.along };
  return null;
}

export function createHeightGrid(heights, { minX, minZ, step, columns, rows }) {
  const at = (column, row) => heights[Math.max(0, Math.min(rows - 1, row)) * columns + Math.max(0, Math.min(columns - 1, column))];
  const heightAt = (x, z) => {
    const gx = (x - minX) / step, gz = (z - minZ) / step;
    if (gx < 0 || gz < 0 || gx > columns - 1 || gz > rows - 1) return null;
    const c = Math.floor(gx), r = Math.floor(gz), fx = gx - c, fz = gz - r;
    const a = at(c, r), b = at(c + 1, r), d = at(c, r + 1), e = at(c + 1, r + 1);
    return fx + fz <= 1 ? a + (b - a) * fx + (d - a) * fz : e + (d - e) * (1 - fx) + (b - e) * (1 - fz);
  };
  const normalAt = (x, z) => {
    const s = step, dx = (heightAt(x + s, z) ?? 0) - (heightAt(x - s, z) ?? 0), dz = (heightAt(x, z + s) ?? 0) - (heightAt(x, z - s) ?? 0), length = Math.hypot(dx, 2 * s, dz);
    return { x: -dx / length, y: 2 * s / length, z: -dz / length };
  };
  return { heights, minX, minZ, step, columns, rows, heightAt, normalAt };
}

export function bakeCore(region = VALLEY.core) {
  const { minX, maxX, minZ, maxZ, step } = region;
  const columns = Math.round((maxX - minX) / step) + 1, rows = Math.round((maxZ - minZ) / step) + 1;
  const heights = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) heights[r * columns + c] = valleyHeight(minX + c * step, minZ + r * step);
  return { heights, minX, minZ, step, columns, rows };
}
