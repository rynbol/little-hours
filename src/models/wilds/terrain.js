import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
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

export function buildGround(grid, material, { worn = () => 0 } = {}) {
  const { xs, zs, heights, columns, rows } = grid, count = columns * rows;
  const positions = new Float32Array(count * 3), colours = new Float32Array(count * 3), colour = new Color();
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const k = j * columns + i, x = xs[i], z = zs[j], y = heights[k];
    positions.set([x, y, z], k * 3);
    const dx = (heights[j * columns + Math.min(columns - 1, i + 1)] - heights[j * columns + Math.max(0, i - 1)]) / Math.max(1e-3, xs[Math.min(columns - 1, i + 1)] - xs[Math.max(0, i - 1)]);
    const dz = (heights[Math.min(rows - 1, j + 1) * columns + i] - heights[Math.max(0, j - 1) * columns + i]) / Math.max(1e-3, zs[Math.min(rows - 1, j + 1)] - zs[Math.max(0, j - 1)]);
    groundColour(x, z, Math.hypot(dx, dz), worn(x, z), colour);
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

function tuftGeometry() {
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

export function buildTufts(grid, material, { centre, radius, spacing = 0.5, keep = () => true, wind }) {
  const spots = [];
  for (let x = centre[0] - radius; x <= centre[0] + radius; x += spacing) for (let z = centre[1] - radius; z <= centre[1] + radius; z += spacing) {
    const jx = x + (noise2(x * 3.1, z * 3.1, 81) - 0.5) * spacing * 1.6, jz = z + (noise2(x * 2.7, z * 2.9, 82) - 0.5) * spacing * 1.6;
    const fade = 1 - smooth(radius * 0.6, radius, Math.hypot(jx - centre[0], jz - centre[1]));
    if (noise2(jx * 1.7, jz * 1.7, 83) < fade * (0.55 + 0.45 * smooth(-0.2, 0.3, fbm(jx / 9, jz / 9, 2, 84))) && keep(jx, jz)) spots.push([jx, jz]);
  }
  const mesh = new InstancedMesh(tuftGeometry(), material, spots.length), matrix = new Matrix4(), turn = new Quaternion(), up = new Vector3(0, 1, 0), at = new Vector3(), size = new Vector3(), colour = new Color();
  spots.forEach(([x, z], i) => {
    mesh.setColorAt(i, groundColour(x, z, 0, 0, colour));
    const s = 0.75 + noise2(x * 5.3, z * 5.3, 85) * 0.7;
    turn.setFromAxisAngle(up, noise2(x * 4.1, z * 4.7, 86) * Math.PI * 2);
    matrix.compose(at.set(x, grid.at(x, z) - 0.02, z), turn, size.set(s, s * (0.8 + noise2(x * 6.1, z * 6.3, 87) * 0.6), s));
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'wilds-tufts';
  material.side = DoubleSide;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = shader => {
    before?.(shader);
    shader.uniforms.windTime = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float lift;\nuniform float windTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 rootAt = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float gust = sin(windTime * 1.7 + rootAt.x * 0.31 + rootAt.z * 0.17) * 0.6 + sin(windTime * 3.1 + rootAt.x * 0.9) * 0.25;
transformed += inverse(mat3(instanceMatrix)) * vec3(gust * 0.07, 0.0, gust * 0.035) * lift * lift;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
  };
  material.customProgramCacheKey = () => 'wilds-tufts';
  return mesh;
}
