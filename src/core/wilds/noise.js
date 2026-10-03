const GRADIENTS = new Float64Array(512);
for (let i = 0; i < 256; i++) { const a = i / 256 * Math.PI * 2 + .37; GRADIENTS[i * 2] = Math.cos(a); GRADIENTS[i * 2 + 1] = Math.sin(a); }

const hash = (ix, iy, seed) => {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) & 255) << 1;
};

export const smooth = (edge0, edge1, x) => { const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t); };

export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  const ga = GRADIENTS[a] * fx + GRADIENTS[a + 1] * fy, gb = GRADIENTS[b] * (fx - 1) + GRADIENTS[b + 1] * fy;
  const gc = GRADIENTS[c] * fx + GRADIENTS[c + 1] * (fy - 1), gd = GRADIENTS[d] * (fx - 1) + GRADIENTS[d + 1] * (fy - 1);
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const top = ga + (gb - ga) * u, bottom = gc + (gd - gc) * u;
  return (top + (bottom - top) * v) * 1.42;
}

export function fbm(x, y, octaves = 4, seed = 0) {
  let sum = 0, amplitude = .5, frequency = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += noise2(x * frequency, y * frequency, seed + i * 17) * amplitude; norm += amplitude; amplitude *= .5; frequency *= 2.03; }
  return sum / norm;
}

export function ridged(x, y, octaves = 4, seed = 0) {
  let sum = 0, amplitude = .5, frequency = 1, weight = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = noise2(x * frequency, y * frequency, seed + i * 31), ridge = (1 - Math.abs(n)) ** 2 * weight;
    sum += ridge * amplitude; norm += amplitude; weight = Math.min(1, ridge * 1.6); amplitude *= .5; frequency *= 2.1;
  }
  return sum / norm;
}

export function random(seed) {
  let state = seed >>> 0 || 1;
  return () => { state = Math.imul(state ^ (state >>> 15), 2246822519) + 0x6d2b79f5 >>> 0; state ^= state >>> 13; return (state >>> 0) / 4294967296; };
}
