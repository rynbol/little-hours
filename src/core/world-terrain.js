export const WORLD = Object.freeze({ seed: 7, size: 12000, valleyFloor: -46, river: Object.freeze({ z: -520, sway: 160, width: 34 }), mountainsFrom: 1400 });

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

export function ridged(x, y, octaves = 5, seed = WORLD.seed) {
  let sum = 0, amplitude = 0.5, frequency = 1, weight = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const ridge = (1 - Math.abs(noise2(x * frequency, y * frequency, seed + i * 31))) ** 2 * weight;
    sum += ridge * amplitude; norm += amplitude; weight = Math.min(1, ridge * 1.6); amplitude *= 0.5; frequency *= 2.1;
  }
  return sum / norm;
}

export const riverCenter = x => WORLD.river.z + Math.sin(x / 410) * WORLD.river.sway + Math.sin(x / 157 + 1.3) * 38;
export const riverDistance = (x, z) => Math.abs(z - riverCenter(x));

export function heightAt(x, z) {
  const d = Math.hypot(x, z), wx = x + fbm(x / 900, z / 900, 3, 3) * 240, wz = z + fbm(x / 900 + 7, z / 900, 3, 4) * 240;
  const hills = fbm(wx / 520, wz / 520, 5, 11) * 46 + fbm(wx / 140, wz / 140, 3, 12) * 7;
  const slope = WORLD.valleyFloor * smooth(30, 260, d) * (1 - smooth(900, 1800, -z));
  const river = riverDistance(x, z), bed = -14 * (1 - smooth(WORLD.river.width * 0.5, WORLD.river.width * 3.2, river));
  const mountains = ridged(wx / 1300, wz / 1300, 6, 21) * 720 * smooth(WORLD.mountainsFrom, WORLD.mountainsFrom + 2400, d);
  const terrace = 6 * smooth(0.25, 0.6, fbm(wx / 300, wz / 300, 2, 5));
  const home = smooth(18, 70, d);
  return (hills + terrace) * home * smooth(60, 420, d) + slope + bed * smooth(120, 260, d) + mountains;
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
