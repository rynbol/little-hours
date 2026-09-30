import bush from './assets/bush.json' with { type: 'json' };
import islandCliff from './assets/island-cliff.json' with { type: 'json' };
import isletA from './assets/islet-a.json' with { type: 'json' };
import isletB from './assets/islet-b.json' with { type: 'json' };
import rockA from './assets/rock-a.json' with { type: 'json' };
import rockB from './assets/rock-b.json' with { type: 'json' };
import rowboat from './assets/rowboat.json' with { type: 'json' };
import sapling from './assets/sapling.json' with { type: 'json' };
import treeBlossomA from './assets/tree-blossom-a.json' with { type: 'json' };
import treeBlossomB from './assets/tree-blossom-b.json' with { type: 'json' };
import treeFruit from './assets/tree-fruit.json' with { type: 'json' };
import treePine from './assets/tree-pine.json' with { type: 'json' };
import treeRoundA from './assets/tree-round-a.json' with { type: 'json' };
import treeRoundB from './assets/tree-round-b.json' with { type: 'json' };
import treeRoundC from './assets/tree-round-c.json' with { type: 'json' };
import treeWillow from './assets/tree-willow.json' with { type: 'json' };

export const ASSETS = Object.freeze({ 'bush': bush, 'island-cliff': islandCliff, 'islet-a': isletA, 'islet-b': isletB, 'rock-a': rockA, 'rock-b': rockB, 'rowboat': rowboat, 'sapling': sapling, 'tree-blossom-a': treeBlossomA, 'tree-blossom-b': treeBlossomB, 'tree-fruit': treeFruit, 'tree-pine': treePine, 'tree-round-a': treeRoundA, 'tree-round-b': treeRoundB, 'tree-round-c': treeRoundC, 'tree-willow': treeWillow });

const bytes = text => Uint8Array.from(atob(text), c => c.charCodeAt(0)).buffer;
const decoded = new Map();
function expand(name) {
  if (decoded.has(name)) return decoded.get(name);
  const source = ASSETS[name], p = new Int16Array(bytes(source.positions)), k = new Uint8Array(bytes(source.colors)), indices = new Uint16Array(bytes(source.indices));
  let shape;
  if (source.flat) {
    const positions = [], normals = [], colors = [];
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]].map(i => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
      const u = b.map((v, i) => v - a[i]), w = c.map((v, i) => v - a[i]), n = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]], l = Math.hypot(...n) || 1;
      for (const i of [indices[t], indices[t + 1], indices[t + 2]]) { positions.push(p[i * 3] / 1000, p[i * 3 + 1] / 1000, p[i * 3 + 2] / 1000); normals.push(n[0] / l, n[1] / l, n[2] / l); colors.push(k[i * 3] / 255, k[i * 3 + 1] / 255, k[i * 3 + 2] / 255); }
    }
    shape = { positions, normals, colors, indices: positions.map((_, i) => i).slice(0, positions.length / 3) };
  } else {
    const n = new Int8Array(bytes(source.normals));
    shape = { positions: Array.from(p, v => v / 1000), normals: Array.from(n, v => v / 127), colors: Array.from(k, v => v / 255), indices: Array.from(indices) };
  }
  decoded.set(name, shape);
  return shape;
}

export function placeAsset(name, { x = 0, y = 0, z = 0, yaw = 0, scale = 1, tint = [1, 1, 1] } = {}) {
  const source = expand(name), count = source.positions.length / 3, c = Math.cos(yaw), s = Math.sin(yaw);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const px = source.positions[i * 3], py = source.positions[i * 3 + 1], pz = source.positions[i * 3 + 2];
    const nx = source.normals[i * 3], ny = source.normals[i * 3 + 1], nz = source.normals[i * 3 + 2];
    positions.set([x + (px * c + pz * s) * scale, y + py * scale, z + (pz * c - px * s) * scale], i * 3);
    normals.set([nx * c + nz * s, ny, nz * c - nx * s], i * 3);
    colors.set([source.colors[i * 3] * tint[0], source.colors[i * 3 + 1] * tint[1], source.colors[i * 3 + 2] * tint[2], 1], i * 4);
  }
  return { positions, normals, colors, indices: source.indices };
}
