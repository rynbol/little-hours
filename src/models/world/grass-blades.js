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

export function grassBlades(layers = GRASS.layers) {
  const total = layers.reduce((sum, layer) => sum + layer.blades, 0), random = seeded(29);
  const positions = new Float32Array(total * 15), blade = new Float32Array(total * 20), indices = new Uint32Array(total * 9);
  let b = 0;
  layers.forEach(({ period, blades }, layer) => {
    const spots = Array.from({ length: blades }, () => [random() * period, random() * period, random(), random()]).sort((p, q) => (Math.floor(p[1] / 2) - Math.floor(q[1] / 2)) || (p[0] - q[0]));
    for (const [x, z, rank, seed] of spots) {
      BLADE_ROWS.forEach(([side, t], r) => { positions.set([x, t, z], (b * 5 + r) * 3); blade.set([side, rank, seed, layer], (b * 5 + r) * 4); });
      const v = b * 5; indices.set([v, v + 1, v + 2, v + 2, v + 1, v + 3, v + 2, v + 3, v + 4], b * 9);
      b++;
    }
  });
  return { positions, blade, indices };
}

export function buildGrassBlades({ workers = typeof Worker === 'function' } = {}) {
  return workers ? inWorker({ job: 'grass' }) : Promise.resolve(grassBlades());
}
