export const WORLD = Object.freeze({ seed: 7, size: 12000, valleyFloor: -46, pad: Object.freeze({ halfWidth: 7.4, halfDepth: 6.2 }), river: Object.freeze({ z: -520, sway: 160, width: 34 }), massif: Object.freeze({ x: -4237, z: -6192, spread: 0.3 }),
  ranges: Object.freeze([
    Object.freeze({ crest: 1800, rise: 190, width: 420, bench: 18, seed: 81, creaseSoftness: 0, crestFade: 0 }),
    Object.freeze({ crest: 3000, rise: 470, width: 650, bench: 38, seed: 84, creaseSoftness: 0, crestFade: 0 }),
    Object.freeze({ crest: 5200, rise: 1550, width: 1200, bench: 90, seed: 87, creaseSoftness: 0.002, crestFade: 1 }),
  ]) });

const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (edge0, edge1, x) => { const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t); };

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise2(x, y, seed = WORLD.seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const grad = (gx, gy) => { const a = hash2(gx, gy, seed) * Math.PI * 2; return Math.cos(a) * (x - gx) + Math.sin(a) * (y - gy); };
  const u = fade(fx), v = fade(fy);
  return lerp(lerp(grad(ix, iy), grad(ix + 1, iy), u), lerp(grad(ix, iy + 1), grad(ix + 1, iy + 1), u), v) * 1.42;
}

export function fbm(x, y, octaves = 5, seed = WORLD.seed) {
  let sum = 0, amplitude = 0.5, frequency = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += noise2(x * frequency, y * frequency, seed + i * 17) * amplitude; norm += amplitude; amplitude *= 0.5; frequency *= 2.03; }
  return sum / norm;
}

export function ridged(x, y, octaves = 5, seed = WORLD.seed, creaseSoftness = 0) {
  let sum = 0, amplitude = 0.5, frequency = 1, weight = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = noise2(x * frequency, y * frequency, seed + i * 31), ridge = (1 - Math.sqrt(n * n + creaseSoftness)) ** 2 * weight;
    sum += ridge * amplitude; norm += amplitude; weight = Math.min(1, ridge * 1.6); amplitude *= 0.5; frequency *= 2.1;
  }
  return sum / norm;
}

export const riverCenter = x => WORLD.river.z + Math.sin(x / 410) * WORLD.river.sway + Math.sin(x / 157 + 1.3) * 38;
export const riverDistance = (x, z) => Math.abs(z - riverCenter(x));
export const pathCenter = ahead => -3 - ahead * 0.6 + Math.sin(ahead / 13) * 3 + Math.sin(ahead / 37 + 2) * 3;
export const pathDistance = (x, z) => -z < 5 || -z > 340 ? Infinity : Math.abs(x - pathCenter(-z));

const MASSIF_DISTANCE = Math.hypot(WORLD.massif.x, WORLD.massif.z);
const massifFrame = (x, z, d) => {
  const angle = Math.acos(Math.max(-1, Math.min(1, (x * WORLD.massif.x + z * WORLD.massif.z) / (d * MASSIF_DISTANCE))));
  return 1 - 0.86 * Math.exp(-((angle / WORLD.massif.spread) ** 2)) * (1 - smooth(MASSIF_DISTANCE - 1800, MASSIF_DISTANCE - 600, d));
};

const benches = (h, rise) => { const k = Math.floor(h / rise), f = h / rise - k; return (k + smooth(0.28, 0.72, f)) * rise; };

export const padDistance = (x, z) => Math.hypot(Math.max(0, Math.abs(x) - WORLD.pad.halfWidth), Math.max(0, Math.abs(z) - WORLD.pad.halfDepth));

function rangeHeight({ crest, rise, width, bench, seed, creaseSoftness, crestFade }, x, z, d) {
  const across = (d - crest - fbm(x / 2300, z / 2300, 2, seed) * width * 0.8) / width;
  const profile = Math.exp(-across * across * (across < 0 ? 2.6 : 1.1));
  if (profile < 0.01) return 0;
  const along = 0.4 + 0.6 * smooth(-0.35, 0.45, fbm(x / (width * 2.2), z / (width * 2.2), 3, seed + 1));
  const crag = 0.82 + 0.36 * ridged(x / (width * 0.7), z / (width * 0.7), 3, seed + 2, creaseSoftness);
  const lift = profile * along * crag, h = rise * lift;
  return h + (benches(h, bench) - h) * 0.65 * (1 - crestFade * smooth(0.45, 0.8, lift));
}

export function heightAt(x, z) {
  const d = Math.hypot(x, z), s = padDistance(x, z);
  if (s <= 0) return 0;
  const wx = x + fbm(x / 900, z / 900, 3, 3) * 240, wz = z + fbm(x / 900 + 7, z / 900, 3, 4) * 240, river = riverDistance(x, z);
  const fall = -56 * (1 - Math.exp(-s / 260)) * smooth(0, 5, s) + fbm(x / 38, z / 38, 2, 13) * 1.4 * smooth(6, 26, s) * (1 - smooth(120, 260, d));
  const swell = fbm(wx / 520, wz / 520, 4, 11) * 34 * smooth(60, 420, d) + fbm(wx / 120, wz / 120, 2, 12) * 5 * smooth(30, 160, d);
  const tiers = smooth(-0.05, 0.25, fbm(wx / 700 + 3, wz / 700, 2, 5)) * smooth(140, 360, d);
  const rolling = swell + (benches(swell + 40, 11) - 40 - swell) * tiers;
  const banks = smooth(WORLD.river.width * 2.4, WORLD.river.width * 5, river);
  const mesas = smooth(0.5, 0.56, fbm(wx / 330, wz / 330, 3, 51)) * (26 + 22 * fbm(x / 210, z / 210, 2, 52)) * smooth(260, 420, d) * (1 - smooth(2200, 3000, d)) * banks;
  const edge = 1050 + fbm(x / 640, 0.5, 3, 61) * 380, scarp = 90 * smooth(edge - 70, edge + 70, -z) * smooth(0.2, 0.6, -z / d);
  const mountains = d > 1000 ? massifFrame(x, z, d) * (WORLD.ranges.reduce((sum, range) => sum + rangeHeight(range, wx, wz, d), 0) + smooth(5400, 7800, d) * 700) : 0;
  const bed = -14 * (1 - smooth(WORLD.river.width * 0.5, WORLD.river.width * 3.2, river)) * smooth(120, 260, d);
  return fall + (rolling + scarp) * (0.35 + 0.65 * banks) + mesas + mountains * (banks + (1 - banks) * smooth(1300, 1700, d)) + bed;
}

export function normalAt(x, z, step = 1) {
  const dx = heightAt(x + step, z) - heightAt(x - step, z), dz = heightAt(x, z + step) - heightAt(x, z - step), length = Math.hypot(dx, 2 * step, dz);
  return [-dx / length, (2 * step) / length, -dz / length];
}

export function canopyAt(x, z) {
  const d = Math.hypot(x, z), [, ny] = normalAt(x, z, 3), h = heightAt(x, z);
  const patch = smooth(-0.15, 0.35, fbm(x / 260, z / 260, 4, 41) + fbm(x / 70, z / 70, 2, 42) * 0.3);
  return patch * smooth(0.82, 0.93, ny) * smooth(22, 60, d) * (1 - smooth(260, 520, h)) * smooth(WORLD.river.width * 0.9, WORLD.river.width * 1.8, riverDistance(x, z));
}

export function scatter({ minX, maxX, minZ, maxZ }, spacing, density, seed = WORLD.seed) {
  const points = [];
  for (let gx = Math.floor(minX / spacing); gx * spacing < maxX; gx++) for (let gz = Math.floor(minZ / spacing); gz * spacing < maxZ; gz++) {
    const x = (gx + hash2(gx, gz, seed)) * spacing, z = (gz + hash2(gx, gz, seed + 1)) * spacing, keep = density(x, z);
    if (keep > 0 && hash2(gx, gz, seed + 2) < keep) points.push({ x, z, y: heightAt(x, z), pick: hash2(gx, gz, seed + 3), turn: hash2(gx, gz, seed + 4) * Math.PI * 2 });
  }
  return points;
}
