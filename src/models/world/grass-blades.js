import { inWorker } from './terrain-mesh.js';

export const GRASS = Object.freeze({
  layers: Object.freeze([
    Object.freeze({ period: 16, blades: 12000, reach: 8, width: 0.022, height: 0.55 }),
    Object.freeze({ period: 48, blades: 20000, reach: 24, width: 0.04, height: 0.52 }),
    Object.freeze({ period: 160, blades: 56000, reach: 80, width: 0.11, height: 0.6 }),
  ]),
  step: 2, texels: 89, recentre: 8,
  clearing: Object.freeze({ halfWidth: 6.6, halfDepth: 5.2 }),
});

function seeded(seed) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BLADE_ROWS = Object.freeze([[-1, 0], [1, 0], [-0.62, 0.5], [0.62, 0.5], [0, 1]]);
const TUFT_ROWS = Object.freeze([[-0.28, 0], [0.28, 0], [-1, 0.3], [1, 0.3], [-0.42, 0.7], [0.42, 0.7], [0, 1]]);

export function grassBlades(layers = GRASS.layers) {
  const vertices = layers.reduce((sum, layer) => sum + layer.blades * (layer.tuft ? 7 : 5), 0), triangles = layers.reduce((sum, layer) => sum + layer.blades * (layer.tuft ? 5 : 3), 0), random = seeded(29);
  const positions = new Float32Array(vertices * 3), blade = new Float32Array(vertices * 4), indices = new Uint32Array(triangles * 3);
  let vertex = 0, index = 0;
  layers.forEach(({ period, blades, tuft }, layer) => {
    const rows = tuft ? TUFT_ROWS : BLADE_ROWS;
    let rootX = 0, rootZ = 0;
    const spots = Array.from({ length: blades }, (_, b) => {
      if (!tuft) return [random() * period, random() * period, random(), random()];
      if (b % 3 === 0) { rootX = random() * period; rootZ = random() * period; }
      const turn = random() * Math.PI * 2, spread = 0.04 + random() * 0.18;
      return [(rootX + Math.cos(turn) * spread + period) % period, (rootZ + Math.sin(turn) * spread + period) % period, random(), random()];
    }).sort((p, q) => (Math.floor(p[1] / 2) - Math.floor(q[1] / 2)) || (p[0] - q[0]));
    for (const [x, z, rank, seed] of spots) {
      rows.forEach(([side, t], r) => { positions.set([x, t, z], (vertex + r) * 3); blade.set([side, rank, seed, layer], (vertex + r) * 4); });
      const v = vertex, faces = tuft ? [v, v + 1, v + 2, v + 2, v + 1, v + 3, v + 2, v + 3, v + 4, v + 4, v + 3, v + 5, v + 4, v + 5, v + 6] : [v, v + 1, v + 2, v + 2, v + 1, v + 3, v + 2, v + 3, v + 4];
      indices.set(faces, index); vertex += rows.length; index += faces.length;
    }
  });
  return { positions, blade, indices };
}

export function buildGrassBlades({ workers = typeof Worker === 'function', layers, signal } = {}) {
  return workers ? inWorker({ job: 'grass', layers }, { signal }) : Promise.resolve(grassBlades(layers));
}
