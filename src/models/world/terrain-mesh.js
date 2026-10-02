import { createTerrainField, WORLD } from '../../core/world-terrain.js';

const square = (radius, step) => Object.freeze({ minX: -radius, maxX: radius, minZ: -radius, maxZ: radius, step });

export const TERRAIN_RINGS = Object.freeze([
  square(160, 2),
  square(640, 8),
  square(2560, 32),
  Object.freeze({ minX: -7680, maxX: 5120, minZ: -8960, maxZ: 3072, step: 64 }),
  square(12800, 256),
]);

const holds = (ring, x, z) => x >= ring.minX && x <= ring.maxX && z >= ring.minZ && z <= ring.maxZ;
export const ringAt = (x, z, rings = TERRAIN_RINGS) => rings.find(ring => holds(ring, x, z)) ?? rings[rings.length - 1];

function edgeHeight(x, z, ring, coarse, height, heightAt) {
  const onX = x === ring.minX || x === ring.maxX, onZ = z === ring.minZ || z === ring.maxZ;
  if (!coarse || !(onX || onZ)) return height;
  const along = onX ? z : x, low = Math.floor(along / coarse) * coarse, t = (along - low) / coarse;
  const at = value => onX ? heightAt(x, value) : heightAt(value, z);
  return t < 1e-6 ? at(low) : at(low) * (1 - t) + at(low + coarse) * t;
}

export function terrainRing(index, rings = TERRAIN_RINGS, definition, center = { x: 0, z: 0 }) {
  const { heightAt, canopyAt, riverDistance } = createTerrainField(definition);
  rings = rings.map(ring => ({ ...ring, minX: ring.minX + center.x, maxX: ring.maxX + center.x, minZ: ring.minZ + center.z, maxZ: ring.maxZ + center.z }));
  const ring = rings[index], { minX, minZ, step } = ring, inner = index ? rings[index - 1] : null, coarse = rings[index + 1]?.step ?? 0;
  const nx = Math.round((ring.maxX - minX) / step) + 1, nz = Math.round((ring.maxZ - minZ) / step) + 1, count = nx * nz;
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), colors = new Float32Array(count * 4), indices = [];
  const wide = nz + 4, heights = new Float64Array((nx + 4) * wide), slopeX = new Float64Array(heights.length), slopeZ = new Float64Array(heights.length), at = (i, j) => (i + 2) * wide + j + 2, h = (i, j) => heights[at(i, j)];
  for (let i = -2; i <= nx + 1; i++) for (let j = -2; j <= nz + 1; j++) heights[at(i, j)] = heightAt(minX + i * step, minZ + j * step);
  for (let i = -1; i <= nx; i++) for (let j = -1; j <= nz; j++) {
    slopeX[at(i, j)] = h(i + 1, j - 1) + 2 * h(i + 1, j) + h(i + 1, j + 1) - h(i - 1, j - 1) - 2 * h(i - 1, j) - h(i - 1, j + 1);
    slopeZ[at(i, j)] = h(i - 1, j + 1) + 2 * h(i, j + 1) + h(i + 1, j + 1) - h(i - 1, j - 1) - 2 * h(i, j - 1) - h(i + 1, j - 1);
  }
  const tent = (field, i, j) => { let sum = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) sum += field[at(i + a, j + b)] * (2 - Math.abs(a)) * (2 - Math.abs(b)); return sum / 16; };
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = minX + i * step, z = minZ + j * step, v = i * nz + j, y = edgeHeight(x, z, ring, coarse, h(i, j), heightAt);
    const dx = tent(slopeX, i, j), dz = tent(slopeZ, i, j), length = Math.hypot(dx, 8 * step, dz);
    positions.set([x, y, z], v * 3); normals.set([-dx / length, 8 * step / length, -dz / length], v * 3);
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

export function inWorker(job, { signal, createWorker = () => new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' }) } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Terrain generation cancelled', 'AbortError')); return; }
    const worker = createWorker();
    const finish = (callback, value) => { worker.terminate(); signal?.removeEventListener('abort', abort); callback(value); };
    const abort = () => finish(reject, new DOMException('Terrain generation cancelled', 'AbortError'));
    worker.onmessage = ({ data }) => finish(resolve, data);
    worker.onerror = error => finish(reject, error);
    signal?.addEventListener('abort', abort, { once: true });
    worker.postMessage(job);
  });
}

export async function buildTerrainRings({ workers = typeof Worker === 'function', definition, rings = TERRAIN_RINGS, center = { x: 0, z: 0 }, signal } = {}) {
  if (workers) return Promise.all(rings.map((_, index) => inWorker({ job: 'ring', index, rings, definition, center }, { signal })));
  const data = [];
  for (let index = 0; index < rings.length; index++) {
    if (signal?.aborted) throw new DOMException('Terrain generation cancelled', 'AbortError');
    data.push(terrainRing(index, rings, definition, center));
    if (index < rings.length - 1) await new Promise(resolve => setTimeout(resolve, 0));
  }
  return data;
}

const surfaceGrids = new WeakMap();

function surfaceGrid(ring) {
  let grid = surfaceGrids.get(ring);
  if (grid) return grid;
  const { positions, indices } = ring, last = positions.length - 3, minX = positions[0], minZ = positions[2], maxX = positions[last], maxZ = positions[last + 2], step = positions[5] - minZ;
  const nz = Math.round((maxZ - minZ) / step) + 1, nx = positions.length / 3 / nz, cells = new Int32Array((nx - 1) * (nz - 1) * 2).fill(-1);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const i = Math.floor(((positions[a] + positions[b] + positions[c]) / 3 - minX) / step), j = Math.floor(((positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3 - minZ) / step), cell = (i * (nz - 1) + j) * 2;
    cells[cell + (cells[cell] === -1 ? 0 : 1)] = t;
  }
  grid = { minX, minZ, maxX, maxZ, step, nx, nz, cells }; surfaceGrids.set(ring, grid);
  return grid;
}

export function sampleTerrainSurface(ringData, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  for (const ring of ringData) {
    const g = surfaceGrid(ring);
    if (x < g.minX || x > g.maxX || z < g.minZ || z > g.maxZ) continue;
    const i = Math.min(g.nx - 2, Math.floor((x - g.minX) / g.step)), j = Math.min(g.nz - 2, Math.floor((z - g.minZ) / g.step)), cell = (i * (g.nz - 1) + j) * 2;
    for (let side = 0; side < 2; side++) {
      const triangle = g.cells[cell + side];
      if (triangle === -1) continue;
      const [a, b, c] = ring.indices.subarray(triangle, triangle + 3), p = ring.positions;
      const ax = p[a * 3], az = p[a * 3 + 2], bx = p[b * 3] - ax, bz = p[b * 3 + 2] - az, cx = p[c * 3] - ax, cz = p[c * 3 + 2] - az, determinant = bx * cz - bz * cx;
      const wb = ((x - ax) * cz - (z - az) * cx) / determinant, wc = (bx * (z - az) - bz * (x - ax)) / determinant, wa = 1 - wb - wc;
      if (Math.min(wa, wb, wc) < -1e-6) continue;
      const by = p[b * 3 + 1] - p[a * 3 + 1], cy = p[c * 3 + 1] - p[a * 3 + 1], sign = determinant < 0 ? 1 : -1;
      const nx = (by * cz - bz * cy) * sign, ny = -determinant * sign, nz = (bx * cy - by * cx) * sign, length = Math.hypot(nx, ny, nz);
      const cover = ring.colors ? ring.colors[a * 4] * wa + ring.colors[b * 4] * wb + ring.colors[c * 4] * wc : 0;
      const wet = ring.colors ? ring.colors[a * 4 + 1] * wa + ring.colors[b * 4 + 1] * wb + ring.colors[c * 4 + 1] * wc : 0;
      return { height: p[a * 3 + 1] * wa + p[b * 3 + 1] * wb + p[c * 3 + 1] * wc, normal: { x: nx / length, y: ny / length, z: nz / length }, cover, wet };
    }
  }
  return null;
}
