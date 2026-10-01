import { heightAt, normalAt, canopyAt, riverDistance, WORLD } from '../../core/world-terrain.js';

const square = (radius, step) => Object.freeze({ minX: -radius, maxX: radius, minZ: -radius, maxZ: radius, step, radius });

export const TERRAIN_RINGS = Object.freeze([
  square(160, 2),
  square(640, 8),
  square(2560, 32),
  Object.freeze({ minX: -7680, maxX: 5120, minZ: -8960, maxZ: 3072, step: 64 }),
  square(12800, 256),
]);

const holds = (ring, x, z) => x >= ring.minX && x <= ring.maxX && z >= ring.minZ && z <= ring.maxZ;
export const ringAt = (x, z, rings = TERRAIN_RINGS) => rings.find(ring => holds(ring, x, z)) ?? rings[rings.length - 1];

function edgeHeight(x, z, ring, coarse) {
  const onX = x === ring.minX || x === ring.maxX, onZ = z === ring.minZ || z === ring.maxZ;
  if (!coarse || !(onX || onZ)) return heightAt(x, z);
  const along = onX ? z : x, low = Math.floor(along / coarse) * coarse, t = (along - low) / coarse;
  const at = value => onX ? heightAt(x, value) : heightAt(value, z);
  return t < 1e-6 ? at(low) : at(low) * (1 - t) + at(low + coarse) * t;
}

export function terrainRing(index, rings = TERRAIN_RINGS) {
  const ring = rings[index], { minX, minZ, step } = ring, inner = index ? rings[index - 1] : null, coarse = rings[index + 1]?.step ?? 0;
  const nx = Math.round((ring.maxX - minX) / step) + 1, nz = Math.round((ring.maxZ - minZ) / step) + 1, count = nx * nz;
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), colors = new Float32Array(count * 4), indices = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = minX + i * step, z = minZ + j * step, v = i * nz + j, y = edgeHeight(x, z, ring, coarse), normal = normalAt(x, z, Math.max(1, step * 1.5));
    positions.set([x, y, z], v * 3); normals.set(normal, v * 3);
    colors.set([canopyAt(x, z), 1 - Math.min(1, riverDistance(x, z) / (WORLD.river.width * 3)), 0, 1], v * 4);
  }
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
    const x0 = minX + i * step, z0 = minZ + j * step;
    if (inner && holds(inner, x0, z0) && holds(inner, x0 + step, z0 + step)) continue;
    const a = i * nz + j, b = a + nz;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  return { positions, normals, colors, indices: count > 65535 ? new Uint32Array(indices) : new Uint16Array(indices) };
}

export function inWorker(job) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { worker.terminate(); resolve(data); };
    worker.onerror = error => { worker.terminate(); reject(error); };
    worker.postMessage(job);
  });
}

export function buildTerrainRings({ workers = typeof Worker === 'function' } = {}) {
  if (!workers) return Promise.resolve(TERRAIN_RINGS.map((_, index) => terrainRing(index)));
  return Promise.all(TERRAIN_RINGS.map((_, index) => inWorker({ job: 'ring', index })));
}
