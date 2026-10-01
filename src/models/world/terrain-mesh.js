import { heightAt, normalAt, canopyAt, riverDistance, WORLD } from '../../core/world-terrain.js';

export const TERRAIN_RINGS = Object.freeze([
  Object.freeze({ radius: 160, step: 2 }),
  Object.freeze({ radius: 640, step: 8 }),
  Object.freeze({ radius: 2560, step: 32 }),
  Object.freeze({ radius: 10240, step: 128 }),
]);

function edgeHeight(x, z, radius, coarse) {
  const onX = Math.abs(Math.abs(x) - radius) < 1e-6, onZ = Math.abs(Math.abs(z) - radius) < 1e-6;
  if (!coarse || !(onX || onZ)) return heightAt(x, z);
  const along = onX ? z : x, low = Math.floor(along / coarse) * coarse, t = (along - low) / coarse;
  const at = value => onX ? heightAt(x, value) : heightAt(value, z);
  return t < 1e-6 ? at(low) : at(low) * (1 - t) + at(low + coarse) * t;
}

export function terrainRing(index, rings = TERRAIN_RINGS) {
  const { radius, step } = rings[index], inner = index ? rings[index - 1].radius : 0, coarse = rings[index + 1]?.step ?? 0;
  const n = Math.round(radius * 2 / step) + 1, positions = new Float32Array(n * n * 3), normals = new Float32Array(n * n * 3), colors = new Float32Array(n * n * 4), indices = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -radius + i * step, z = -radius + j * step, v = i * n + j, y = edgeHeight(x, z, radius, coarse), normal = normalAt(x, z, Math.max(1, step * 1.5));
    positions.set([x, y, z], v * 3); normals.set(normal, v * 3);
    colors.set([canopyAt(x, z), 1 - Math.min(1, riverDistance(x, z) / (WORLD.river.width * 3)), 0, 1], v * 4);
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
    const x0 = -radius + i * step, z0 = -radius + j * step;
    if (inner && x0 >= -inner && x0 + step <= inner && z0 >= -inner && z0 + step <= inner) continue;
    const a = i * n + j, b = a + n;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  return { positions, normals, colors, indices: n * n > 65535 ? new Uint32Array(indices) : new Uint16Array(indices) };
}

export function buildTerrainRings({ workers = typeof Worker === 'function' } = {}) {
  if (!workers) return Promise.resolve(TERRAIN_RINGS.map((_, index) => terrainRing(index)));
  return Promise.all(TERRAIN_RINGS.map((_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { worker.terminate(); resolve(data.ring); };
    worker.onerror = error => { worker.terminate(); reject(error); };
    worker.postMessage({ index });
  })));
}
