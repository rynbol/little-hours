import { fbm, noise2, ridged, smooth } from '../world-terrain.js';

export const WATER = 0;
const freeze = Object.freeze;
const point = (x, z) => freeze({ x, z });
const ring = freeze({ x: 8, z: -322, radius: 13.5, facing: 0, stones: 11, floor: 12 });
const oak = freeze({ x: 58, z: -152, knoll: 12, fork: 24, trunk: 1.7, flare: 3.6 });
const tower = freeze({ x: 124, z: -250, radius: 3.4, rise: 12 });
const pillar = freeze({ x: 24, z: -180, radius: 3, top: 6.5 });
const rocks = freeze([freeze({ x: 1, z: -37, radius: 4.2, top: 44 }), freeze({ x: 40, z: -330, radius: 3.6, top: 18.5 })]);
const islet = freeze({ x: 6, z: -236, radius: 5.5, top: 0.45 });
const spire = freeze({ x: -84, z: -252, radius: 6.5, top: 60, ledge: 52 });
const falls = freeze({ z: -122, upper: -86, ledge: -82, lower: -75, width: 16, pool: freeze({ x: -68, z: -122, radius: 4.5, level: 1.3 }), basin: 24.6, top: 47, shelf: 2.1, recess: freeze({ x: -78.2, half: 1.6 }) });
const stream = freeze([[-160, -110], [-130, -116], [-104, -119], [-86, -122]].map(([x, z]) => freeze([x, z])));
const brook = freeze([[-68, -122], [-56, -124], [-44, -123], [-34, -127], [-22, -131]].map(([x, z]) => freeze([x, z])));
const lake = freeze({ ax: -2, az: -150, bx: 12, bz: -248, radius: 37 });
const camp = freeze({ x: 0, z: 42, floor: 34, flat: 15 });
const hollow = freeze({ root: point(-61, -111.5), crown: point(-57.1, -134.5), radius: 1.9, floor: freeze([5.85, 5.45]) });
const bridge = freeze({ x: -44, from: -112, to: -133.5, width: 2.4, deck: 5.65, end: -128.5, foot: 2.8, gap: freeze([-120.5, -125.5]), log: freeze([-43.6, -119.6, -44.3, -126.4]), rail: 0.75 });
const STEPS = freeze([[-50, 7, -75], [-58, 8, -75], [-66, 7, -75], [-76, 11, -86], [-88, 11, -86]].map(row => freeze(row)));

export const TRAIL = freeze([[0, 36], [3, 18], [-3, -6], [3, -28], [11, -36], [14, -54], [-4, -78], [6, -98], [18, -112], [44, -128], [52, -170], [54, -214], [46, -256], [30, -284], [13, -307]].map(([x, z]) => freeze([x, z])));
export const WEST_TRAIL = freeze([[6, -98], [-20, -106], [-44, -110], [-44, -136], [-44, -170], [-44, -220], [-36, -262], [-14, -286], [2, -307]].map(([x, z]) => freeze([x, z])));

const PLAN = freeze({
  spawn: freeze({ x: 0, z: 35, facing: Math.PI }),
  vista: freeze({ x: 1, z: -37, facing: Math.PI }),
  dummy: point(-11, 31),
  posts: freeze([[-15.5, 27.5], [-8, 25], [-15, 35]].map(row => freeze(row))),
  camp, oak, tower, pillar, islet, spire, falls, lake, stream, brook, rocks,
  updrafts: freeze([freeze({ x: 10, z: -62, radius: 8, lift: 1.6, top: 47 })]),
  ring: freeze({ ...ring, places: freeze(Array.from({ length: 9 }, (_, i) => { const a = (i + 0.5) / 9 * Math.PI * 2; return freeze([ring.x + Math.sin(a) * ring.stones, ring.z + Math.cos(a) * ring.stones]); })) }),
  stone: freeze({ radius: 0.78, height: 3.3 }),
  campfires: freeze([freeze({ id: 'camp', x: -3, z: 44 }), freeze({ id: 'shrine', x: 8, z: -100 }), freeze({ id: 'stones', x: -13, z: -294 })]),
  shrine: point(-4, -103),
  merchant: freeze({ x: 9.5, z: 39, facing: -2.2 }),
  swing: freeze({ x: 62, z: -145.5, facing: 0.9, height: 6.4 }),
  hollow, bridge,
  lookout: point(40, -330),
  observatory: freeze({ x: -60, z: -1460, radius: 26 }),
  bounds: freeze({ x: 0, z: -140, rx: 172, rz: 236 }),
});

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const lerp = (a, b, t) => a + (b - a) * t;

export function nearSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / Math.max(1e-9, dx * dx + dz * dz), 0, 1);
  return [Math.hypot(x - ax - dx * t, z - az - dz * t), t];
}

export function nearPath(x, z, path) {
  let best = Infinity, along = 0, total = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], length = Math.hypot(bx - ax, bz - az), [d, t] = nearSegment(x, z, ax, az, bx, bz);
    if (d < best) { best = d; along = total + t * length; }
    total += length;
  }
  return [best, along / total];
}

function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

export function lakeEdge(x, z) {
  const [d, t] = nearSegment(x, z, lake.ax, lake.az, lake.bx, lake.bz);
  return d - (lake.radius + Math.sin(t * 7.3 + 0.6) * 4 + noise2(x / 34, z / 34, 91) * 6 - smooth(0.85, 1, t) * 6);
}

function cliffs(x, z) {
  const warp = noise2(x / 23, z / 23, 93) * 5 + noise2(x / 7, z / 7, 94) * 1.2, pinch = Math.exp(-(((z - falls.z) / falls.width) ** 2));
  let h = 3;
  for (const [edge, rise, wanted] of STEPS) {
    const at = lerp(edge + warp + Math.sin(z / 37 + edge) * 4, wanted, pinch);
    h += rise * smooth(at + 0.9, at - 0.9, x);
  }
  return h + smooth(-110, -150, x) * fbm(x / 40, z / 40, 2, 95) * 3;
}

function shoulder(x, z) {
  const d = Math.hypot(x - ring.x, z - ring.z);
  return ring.floor * (1 - smooth(17, 42, d)) + 46 * smooth(-336, -396, z + noise2(x / 50, 2, 96) * 16) + 8 * smooth(-300, -330, z) * smooth(70, 30, Math.abs(x - 10));
}

function hills(x, z) {
  const lift = smooth(46, 132, x + noise2(z / 45, 3, 97) * 18) * (0.72 + 0.4 * fbm(x / 70, z / 70, 3, 98));
  const knoll = oak.knoll * (1 - smooth(5, 19, Math.hypot(x - oak.x, z - oak.z)));
  const summit = 10 * (1 - smooth(8, 34, Math.hypot(x - tower.x, z - tower.z)));
  return smax(34 * lift + summit * smooth(60, 100, x), knoll, 5);
}

function hillside(x, z) {
  const brow = -36 + noise2(x / 55, 4, 99) * 7 - smooth(20, 80, Math.abs(x)) * 6;
  return camp.floor * smooth(-118, brow, z) + fbm(x / 28, z / 28, 2, 100) * 1.4 * smooth(-110, -60, z);
}

function ranges(x, z) {
  const dx = x, dz = z + 140, d = Math.hypot(dx, dz), north = smooth(0.1, -0.9, dz / Math.max(1, d));
  if (d < 300) return 0;
  let h = 0;
  for (const [crest, rise, width, seed] of [[520, 70, 120, 101], [820, 140, 180, 103], [1180, 230, 240, 105], [1600, 380, 320, 107]]) {
    const wobble = fbm(x / 600, z / 600, 2, seed) * width, across = (d - crest - wobble) / width;
    h += rise * Math.exp(-across * across * 1.6) * (0.55 + 0.45 * north) * (0.75 + 0.5 * ridged(x / (width * 1.6), z / (width * 1.6), 3, seed + 1));
  }
  const ob = PLAN.observatory, peak = Math.hypot(x - ob.x, z - ob.z);
  return h + 120 * (1 - smooth(40, 260, peak)) + smooth(300, 900, d) * 40;
}

function lakeBed(edge, x, z) {
  return WATER + 0.25 - 1.35 * smooth(0, -6, edge) - 5.4 * smooth(-6, -26, edge) + noise2(x / 6, z / 6, 102) * 0.2;
}

function beach(edge, x, z, land) {
  const gravel = WATER + 0.25 + edge * 0.11 + noise2(x / 9, z / 9, 103) * 0.2;
  return lerp(gravel, Math.max(gravel, land), smooth(3, 3 + lerp(Math.max(15, land * 1.5), 5, smooth(-40, -55, x)), edge));
}

function streamLevel(t) { return lerp(falls.pool.level, WATER + 0.05, t); }

function carveBrook(x, z, h) {
  const [d, t] = nearPath(x, z, brook);
  if (d > 10) return h;
  const water = streamLevel(t), bed = water - 0.75 + noise2(x / 3, z / 3, 104) * 0.1;
  const bench = Math.max(h, water + 3.4 * smooth(0.04, 0.16, t) * smooth(0.9, 0.72, t));
  return lerp(bed, lerp(bench, h, smooth(5.5, 10, d)), smooth(3, 4.4, d));
}

function carveStream(x, z, h) {
  const [d] = nearPath(x, z, stream);
  if (d > 4) return h;
  return lerp(h - 1.1, h, smooth(1.8, 3.6, d));
}

function waterfall(x, z, h) {
  const pool = Math.hypot(x - falls.pool.x, z - falls.pool.z), ledge = Math.hypot((x - falls.ledge) * 1.3, z - falls.z), across = Math.abs(z - falls.z);
  let out = h;
  if (ledge < 5.5) out = Math.min(out, lerp(falls.basin - 1.2, out, smooth(3.4, 5.5, ledge)));
  const cove = smooth(-75.2, -74.4, x) * smooth(-71, -72.4, x) * smooth(10, 6, across);
  out = lerp(out, Math.min(out, falls.shelf), cove);
  const recess = smooth(falls.recess.x - 0.25, falls.recess.x + 0.25, x) * smooth(-73.8, -74.4, x) * smooth(falls.recess.half + 0.25, falls.recess.half - 0.25, across);
  out = lerp(out, falls.shelf, recess);
  if (pool < falls.pool.radius + 2) out = Math.min(out, lerp(falls.pool.level - 1.9, out, smooth(falls.pool.radius - 1.5, falls.pool.radius + 2, pool)));
  return out;
}

function column(d, radius, top, base, wall = 0.4) {
  return lerp(top, base, smooth(radius, radius + wall, d));
}

export function valleyHeight(x, z) {
  const edge = lakeEdge(x, z);
  const floor = 3 + fbm(x / 45, z / 45, 2, 105) * 1.5;
  let land = smax(smax(floor, hillside(x, z), 8), smax(hills(x, z), shoulder(x, z), 8), 8);
  land = Math.max(land, cliffs(x, z));
  land = carveStream(x, z, land);
  land += ranges(x, z);
  let h = edge < 0 ? Math.min(lakeBed(edge, x, z), WATER + 0.2) : beach(edge, x, z, land);
  h = carveBrook(x, z, waterfall(x, z, h));

  const fromCamp = Math.hypot(x - camp.x, z - camp.z);
  h = lerp(camp.floor + noise2(x / 9, z / 9, 106) * 0.25, h, smooth(camp.flat, camp.flat + 9, fromCamp));
  const fromRing = Math.hypot(x - ring.x, z - ring.z);
  h = lerp(ring.floor, h, smooth(ring.radius + 3, ring.radius + 14, fromRing));

  const fromOak = Math.hypot(x - oak.x, z - oak.z);
  if (fromOak < oak.flare + 0.5) h = Math.max(h, fromOak < oak.trunk + 0.3 ? column(fromOak, oak.trunk, oak.fork, oak.knoll + 1.4, 0.3) : lerp(oak.knoll + 1.4, h, smooth(oak.trunk + 0.3, oak.flare + 0.5, fromOak)));
  const fromTower = Math.hypot(x - tower.x, z - tower.z);
  if (fromTower < tower.radius + 1) h = Math.max(h, column(fromTower, tower.radius, h + tower.rise, h, 0.5));
  const fromPillar = Math.hypot(x - pillar.x, z - pillar.z);
  if (fromPillar < pillar.radius + 1.2) h = Math.max(h, column(fromPillar, pillar.radius, pillar.top + noise2(x, z, 107) * 0.15, h, 0.6));
  const fromIslet = Math.hypot(x - islet.x, z - islet.z);
  if (fromIslet < islet.radius + 4) h = Math.max(h, lerp(WATER + islet.top, h, smooth(islet.radius * 0.6, islet.radius + 4, fromIslet)));
  for (const rock of rocks) {
    const away = Math.hypot(x - rock.x, z - rock.z);
    if (away < rock.radius + 3) h = Math.max(h, column(away, rock.radius, rock.top + noise2(x / 2, z / 2, 108) * 0.2, h, 1.6));
  }
  const fromSpire = Math.hypot(x - spire.x, z - spire.z);
  if (fromSpire < spire.radius + 6) {
    const step = lerp(spire.ledge, spire.top, smooth(spire.radius * 0.55, spire.radius * 0.5, fromSpire));
    h = Math.max(h, column(fromSpire, spire.radius, step, h, 0.9));
  }
  return h;
}

export function waterAt(x, z) {
  if (lakeEdge(x, z) < 1.5) return WATER;
  const [d, t] = nearPath(x, z, brook);
  if (d < 4.2) return streamLevel(t);
  if (Math.hypot(x - falls.pool.x, z - falls.pool.z) < falls.pool.radius + 1) return falls.pool.level;
  if (Math.hypot((x - falls.ledge) * 1.3, z - falls.z) < 4.2) return falls.basin;
  return -Infinity;
}

export const REFINE = freeze({
  x: freeze([freeze([oak.x - 3, oak.x + 3, 0.4]), freeze([pillar.x - 4.2, pillar.x + 4.2, 0.6])]),
  z: freeze([freeze([oak.z - 3, oak.z + 3, 0.4]), freeze([pillar.z - 4.2, pillar.z + 4.2, 0.6])]),
});

const deck = (ax, az, ay, bx, bz, by, width) => freeze({ ax, az, ay, bx, bz, by, width });
const [logAx, logAz, logBx, logBz] = bridge.log;
export const DECKS = freeze([
  deck(bridge.x, bridge.from, 5.45, bridge.x, bridge.gap[0], bridge.deck, bridge.width),
  deck(bridge.x, bridge.gap[1], bridge.deck, bridge.x, bridge.end, bridge.deck, bridge.width),
  deck(bridge.x, bridge.end, bridge.deck, bridge.x, bridge.to, bridge.foot, bridge.width),
  deck(logAx, logAz, bridge.deck + 0.15, logBx, logBz, bridge.deck + 0.15, 0.75),
  deck(hollow.root.x, hollow.root.z, hollow.floor[0], hollow.crown.x, hollow.crown.z, hollow.floor[1], 2.2),
]);

function wall(ax, az, bx, bz, side, radius, bottom, top) {
  const length = Math.hypot(bx - ax, bz - az), nx = (bz - az) / length * side, nz = -(bx - ax) / length * side, count = Math.max(1, Math.round(length / (radius * 1.2)));
  return Array.from({ length: count + 1 }, (_, i) => freeze({ x: ax + (bx - ax) * i / count + nx, z: az + (bz - az) * i / count + nz, radius, bottom, top }));
}

const rail = bridge.width / 2 + 0.12, inside = 1.42;
export const WALLS = freeze([
  ...[-1, 1].flatMap(side => [
    ...wall(bridge.x, bridge.from, bridge.x, bridge.gap[0], side * rail, 0.2, 0, bridge.deck + bridge.rail),
    ...wall(bridge.x, bridge.gap[1], bridge.x, bridge.to + 0.6, side * rail, 0.2, 0, bridge.deck + bridge.rail),
    ...wall(hollow.root.x, hollow.root.z, hollow.crown.x, hollow.crown.z, side * inside, 0.32, hollow.floor[1] - 1.6, hollow.floor[0] + 3.6),
  ]),
]);

const spot = (id, x, z, extra = {}) => freeze({ id, x, z, ...extra });
export const SECRET_SPOTS = freeze([
  spot('root-sword', -60.8, -113.2, { deck: true }),
  spot('stamina-seed', spire.x, spire.z),
  spot('heart-seed', -77.3, falls.z),
  spot('glide-chest', pillar.x, pillar.z),
  spot('buried-find', -14, -92, { buried: true }),
  spot('lake-pearl', islet.x + 0.6, islet.z - 0.4),
  spot('kestrel-feather', rocks[1].x, rocks[1].z),
  spot('spyglass', tower.x, tower.z),
]);

function resample(path, every) {
  const out = [];
  let next = 0, walked = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], length = Math.hypot(bx - ax, bz - az);
    for (; next <= walked + length; next += every) { const t = (next - walked) / length; out.push([ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / length, (bz - az) / length]); }
    walked += length;
  }
  return out;
}

export const HERB_SPOTS = freeze([...resample(TRAIL.slice(1), 21), ...resample(WEST_TRAIL.slice(1), 24)].map(([x, z, dx, dz], i) => {
  const side = i % 2 ? 2.6 : -2.6;
  return point(Math.round((x - dz * side) * 10) / 10, Math.round((z + dx * side) * 10) / 10);
}).filter(({ x, z }) => !(waterAt(x, z) > valleyHeight(x, z) - 0.3) && Math.hypot(x - camp.x, z - camp.z) > camp.flat));

export const GRID = freeze({ centre: freeze([0, -140]), half: freeze([180, 245]), step: 1.25, far: 2400, rings: 22, refine: REFINE });

export function trailDistance(x, z) {
  return Math.min(nearPath(x, z, TRAIL)[0], nearPath(x, z, WEST_TRAIL)[0]);
}

export const VALLEY = freeze({ ...PLAN, decks: DECKS, walls: WALLS, water: waterAt, secrets: SECRET_SPOTS, herbs: HERB_SPOTS, grid: GRID, trails: freeze([TRAIL, WEST_TRAIL]) });
