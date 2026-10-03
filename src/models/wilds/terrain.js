import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh } from 'three';
import { fbm, noise2, smooth } from '../../core/world-terrain.js';

const GREENS = Object.freeze({ deep: '#4f7f36', fresh: '#7aa847', sun: '#a3bd5c', dry: '#b2b26a', worn: '#b09a6b', moss: '#3f6a34', rock: '#9a8f7e', shade: '#6f6758' });

export function groundColour(x, z, slope, worn = 0, out = new Color()) {
  const tone = new Color(), patch = smooth(-0.25, 0.35, fbm(x / 11, z / 11, 3, 71)), sun = smooth(0.15, 0.55, fbm(x / 34 + 4, z / 34, 2, 72));
  out.set(GREENS.deep).lerp(tone.set(GREENS.fresh), patch);
  out.lerp(tone.set(GREENS.sun), sun * 0.45);
  out.lerp(tone.set(GREENS.dry), smooth(0.3, 0.7, noise2(x / 23, z / 23, 73)) * 0.22);
  out.lerp(tone.set(GREENS.moss), smooth(0.16, 0.3, slope) * 0.3);
  out.lerp(tone.set(GREENS.rock).lerp(tone.clone().set(GREENS.shade), smooth(0.3, 0.7, noise2(x / 1.7, z / 1.7, 74))), smooth(0.7, 1.15, slope));
  return out.lerp(tone.set(GREENS.worn), worn);
}

export function buildGround(grid, material, { worn = () => 0, paint = (x, z, y, slope, out) => groundColour(x, z, slope, worn(x, z), out) } = {}) {
  const { xs, zs, heights, columns, rows } = grid, count = columns * rows;
  const positions = new Float32Array(count * 3), colours = new Float32Array(count * 3), colour = new Color();
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const k = j * columns + i, x = xs[i], z = zs[j], y = heights[k];
    positions.set([x, y, z], k * 3);
    const dx = (heights[j * columns + Math.min(columns - 1, i + 1)] - heights[j * columns + Math.max(0, i - 1)]) / Math.max(1e-3, xs[Math.min(columns - 1, i + 1)] - xs[Math.max(0, i - 1)]);
    const dz = (heights[Math.min(rows - 1, j + 1) * columns + i] - heights[Math.max(0, j - 1) * columns + i]) / Math.max(1e-3, zs[Math.min(rows - 1, j + 1)] - zs[Math.max(0, j - 1)]);
    paint(x, z, y, Math.hypot(dx, dz), colour);
    colours.set([colour.r, colour.g, colour.b], k * 3);
  }
  const indices = new (count > 65535 ? Uint32Array : Uint16Array)((columns - 1) * (rows - 1) * 6);
  let n = 0;
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns - 1; i++) {
    const a = j * columns + i, b = a + 1, c = a + columns, d = c + 1;
    indices[n++] = a; indices[n++] = d; indices[n++] = b;
    indices[n++] = a; indices[n++] = c; indices[n++] = d;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'wilds-ground';
  return mesh;
}

export function tuftGeometry() {
  const positions = [], colours = [], normals = [], lift = [], base = new Color(0.72, 0.78, 0.7), tip = new Color(1.22, 1.24, 1.02), mixed = new Color();
  const blades = [[0, 0, 0.3, 0.0], [0.05, 0.03, 0.25, 0.9], [-0.05, 0.02, 0.28, 1.8], [0.02, -0.05, 0.22, 2.7], [-0.03, -0.04, 0.24, 3.6], [0.06, -0.02, 0.2, 4.5], [-0.06, 0.05, 0.21, 5.4]];
  for (const [ox, oz, height, turn] of blades) {
    const lean = 0.07 + height * 0.25, dx = Math.cos(turn), dz = Math.sin(turn), wide = 0.028;
    const rows = [[0, 1], [0.55, 0.62], [1, 0]];
    const points = rows.map(([t, w]) => [ox + dx * lean * t * t, height * t, oz + dz * lean * t * t, w * wide, t]);
    for (let r = 0; r < rows.length - 1; r++) {
      const [ax, ay, az, aw, at] = points[r], [bx, by, bz, bw, bt] = points[r + 1];
      const quad = [[ax - dz * aw, ay, az + dx * aw, at], [ax + dz * aw, ay, az - dx * aw, at], [bx - dz * bw, by, bz + dx * bw, bt], [bx + dz * bw, by, bz - dx * bw, bt]];
      for (const index of [0, 1, 2, 1, 3, 2]) {
        const [x, y, z, t] = quad[index];
        positions.push(x, y, z); normals.push(0, 1, 0); lift.push(t);
        mixed.copy(base).lerp(tip, t); colours.push(mixed.r, mixed.g, mixed.b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  geometry.setAttribute('lift', new BufferAttribute(new Float32Array(lift), 1));
  return geometry;
}

export function swayTufts(material, wind, far) {
  material.side = DoubleSide;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = shader => {
    before?.(shader);
    shader.uniforms.windTime = wind;
    shader.uniforms.fadeFar = { value: far };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float lift;\nuniform float windTime;\nuniform float fadeFar;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 rootAt = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float gust = sin(windTime * 1.7 + rootAt.x * 0.31 + rootAt.z * 0.17) * 0.6 + sin(windTime * 3.1 + rootAt.x * 0.9) * 0.25;
transformed += inverse(mat3(instanceMatrix)) * vec3(gust * 0.07, 0.0, gust * 0.035) * lift * lift;
transformed *= 1.0 - smoothstep(fadeFar * 0.6, fadeFar, distance(rootAt.xz, cameraPosition.xz));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
  };
  material.customProgramCacheKey = () => 'wilds-tufts';
}
