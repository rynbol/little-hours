import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';

export const VISTA_THEMES = Object.freeze({
  dusk: {
    zenith: '#1a1d48', high: '#4a3c78', horizon: '#f2a070', glow: '#ffc27a', haze: '#7a5f8c', below: '#3a3354',
    far: '#5c5082', mid: '#40496c', valley: '#34485a', field: '#3d5462', cliff: '#463f56', grass: '#3a5646', meadow: '#476a4e',
    trunk: '#3b2e33', leaf: '#2c4a40', leafLight: '#4a6a50', walls: ['#c9a58a', '#b98f86', '#a9a3a0', '#d4b894'], roofs: ['#6a3f3a', '#4a3a3a', '#7a4a3a', '#3f4a5a'],
    stone: '#6b6480', water: '#50608e', glint: '#f2d7b0', window: '#ffc978', windowWarm: '#ffa860', windowDark: '#2b2d44', lamp: '#ffdca0',
    star: '#fff4d8', moon: '#fff1d0', cloud: '#f2aa92', cloudShade: '#6a5a8c',
    castle: '#4c4668', castleRoof: '#2e2c4a', rock: '#3a3042', ember: '#ff6a3a', smoke: '#6a5a78', ruin: '#6c6478', moss: '#3f5a48', rune: '#ffb060', bird: '#221c30', spirit: '#d8ffb8', snow: '#cdb8d8',
    light: 0.35, night: { zenith: '#070b24', high: '#171b44', horizon: '#6a4f86', glow: '#b67a8e', haze: '#3a3766', cloud: '#5a4f80', cloudShade: '#35325c' },
  },
  day: {
    zenith: '#2f74c8', high: '#6fa9e0', horizon: '#d9ecef', glow: '#fff4d6', haze: '#a4c4df', below: '#8fb08a',
    far: '#7090c0', mid: '#6c9a86', valley: '#7aa84c', field: '#a0c45a', cliff: '#8c8a7c', grass: '#76a843', meadow: '#8cbf4e',
    trunk: '#5e4634', leaf: '#3a7338', leafLight: '#7ab04a', walls: ['#efe6cf', '#e4d4b4', '#d8d2c4', '#f0dcb0'], roofs: ['#9c5a3c', '#6d4a36', '#b86b44', '#4f6a7a'],
    stone: '#a7a18f', water: '#5fa6d4', glint: '#f4fbff', window: '#44566a', windowWarm: '#44566a', windowDark: '#44566a', lamp: '#f4e2b8',
    star: '#6fa9e0', moon: '#f6f3ea', cloud: '#ffffff', cloudShade: '#c4d3e6',
    castle: '#8d93a6', castleRoof: '#4d6680', rock: '#6e6462', ember: '#c8604a', smoke: '#d0cac6', ruin: '#b4ab98', moss: '#6f9a48', rune: '#8fd8e8', bird: '#3a3a44', spirit: '#e8ffd0', snow: '#f4f6fa',
    light: 0, night: null,
  },
  rain: {
    zenith: '#3f4a5e', high: '#5c6878', horizon: '#9aa2a8', glow: '#b8b4ae', haze: '#7a8590', below: '#4c5864',
    far: '#687684', mid: '#56646f', valley: '#46545a', field: '#50605e', cliff: '#5a5a60', grass: '#4a6452', meadow: '#56705a',
    trunk: '#3e3a3a', leaf: '#3c5448', leafLight: '#4a6454', walls: ['#b8ab9c', '#a8958e', '#9ea0a2', '#bcae90'], roofs: ['#6a4848', '#4a5468', '#5a5068', '#7a5a4a'],
    stone: '#747880', water: '#5a6a7c', glint: '#c8ccd0', window: '#ffc27a', windowWarm: '#ffaa66', windowDark: '#3a4050', lamp: '#ffd49a',
    star: '#5c6878', moon: '#c8ccd0', cloud: '#8a939e', cloudShade: '#6a7480',
    castle: '#5a606c', castleRoof: '#3a4450', rock: '#4a4a50', ember: '#8a5a50', smoke: '#6a707a', ruin: '#6a6e70', moss: '#4a6050', rune: '#a0c8d0', bird: '#2a2e36', spirit: '#c8e0c8', snow: '#b8c0c8',
    light: 0.55, night: null,
  },
});

export const SHELL_PAINT = Object.freeze({
  retreat: { wall: '#c9bba2', wainscot: '#52695c', trim: '#654939', ceiling: '#d6c3a2', beam: '#6b4b37', door: '#8a6446' },
  sakura: { wall: '#e8ddc4', wainscot: '#a77b53', trim: '#8a6444', ceiling: '#eadcbe', beam: '#8a6444', door: '#a77b53' },
  cloud: { wall: '#dcbfcf', wainscot: '#eee1d4', trim: '#d5b9bb', ceiling: '#f1e1e4', beam: '#d5b9bb', door: '#c9a9b4' },
  metro: { wall: '#5b4f5b', wainscot: '#343546', trim: '#262d3f', ceiling: '#3c4256', beam: '#262d3f', door: '#4a3e4a' },
});

export const SEAT_WINDOW = Object.freeze({ x: 0, y: 3.05, width: 4.2, height: 3.1 });
export const FLOCK_SECONDS = 38;
export const CLOUD_SHADOW = Object.freeze({ day: 1, dusk: 0, rain: 0.5 });
const SPIRITS = 34, SPIRIT_SECONDS = 40, SHOOTING_SECONDS = 23;
const ahead = (across, distance) => [across, -distance];
const bearing = (x, z) => Math.atan2(x, -z);
export const CASTLE_AT = Object.freeze(ahead(-22, 100));
const VOLCANO_AT = ahead(-82, 96), TOWER_AT = ahead(13, 56);

const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hex = value => Color3.FromHexString(value);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function createShape() {
  const shape = { positions: [], indices: [], roles: [], shades: [], fogs: [], thresholds: [] };
  shape.vertex = (x, y, z, role, shade = 1, threshold = 0) => {
    shape.positions.push(x, y, z); shape.roles.push(role); shape.shades.push(shade); shape.thresholds.push(threshold);
    shape.fogs.push(smooth(20, 175, Math.hypot(x, z))); return shape.roles.length - 1;
  };
  shape.quad = (a, b, c, d) => shape.indices.push(a, b, c, a, c, d);
  shape.tri = (a, b, c) => shape.indices.push(a, b, c);
  shape.box = (cx, cy, cz, w, h, d, yaw, role, shade = 1) => {
    const cos = Math.cos(yaw), sin = Math.sin(yaw), at = (lx, ly, lz, s) => shape.vertex(cx + lx * cos + lz * sin, cy + ly, cz - lx * sin + lz * cos, role, shade * s);
    const [x, y, z] = [w / 2, h / 2, d / 2];
    const faces = [[[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], 1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], 0.72], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], 0.86], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], 0.8], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], 1.08]];
    for (const [a, b, c, e, s] of faces) shape.quad(at(...a, shape.flat ? 1 : s), at(...b, shape.flat ? 1 : s), at(...c, shape.flat ? 1 : s), at(...e, shape.flat ? 1 : s));
  };
  shape.blob = (cx, cy, cz, rx, ry, rz, role, top, bottom = 0.7, rings = 4, segments = 8) => {
    const start = shape.roles.length;
    for (let ring = 0; ring <= rings; ring++) {
      const v = ring / rings, phi = v * Math.PI, y = Math.cos(phi), r = Math.sin(phi);
      for (let s = 0; s < segments; s++) { const a = s / segments * Math.PI * 2; shape.vertex(cx + Math.cos(a) * r * rx, cy + y * ry, cz + Math.sin(a) * r * rz, y > 0.1 ? top : role, bottom + (1 - bottom) * (y * 0.5 + 0.5)); }
    }
    for (let ring = 0; ring < rings; ring++) for (let s = 0; s < segments; s++) {
      const a = start + ring * segments + s, b = start + ring * segments + (s + 1) % segments;
      shape.quad(a, b, b + segments, a + segments);
    }
  };
  shape.spire = (x, y, z, half, height, role) => {
    const apex = shape.vertex(x, y + height, z, role, 1.1), base = [[-1, 1, 1], [1, 1, 0.92], [1, -1, 0.7], [-1, -1, 0.8]].map(([u, v, s]) => shape.vertex(x + u * half, y, z + v * half, role, s));
    for (let k = 0; k < 4; k++) shape.tri(apex, base[k], base[(k + 1) % 4]);
  };
  return shape;
}

function terrainHeight(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const cliff = -8 * smooth(8.5, 20, r + Math.sin(a * 5) * 1.6);
  const basin = 15 * smooth(24, 112, r);
  const rolling = (Math.sin(x * 0.07) * Math.cos(z * 0.06) * 1.6 + Math.sin(x * 0.029 + 1) * Math.cos(z * 0.034 + 2) * 3.2) * smooth(26, 45, r);
  const mound = 6 * (1 - smooth(9, 26, Math.hypot(x - CASTLE_AT[0], z - CASTLE_AT[1])));
  const crest = (k, phase, power) => (1 - Math.abs(Math.sin(a * k + phase))) ** power;
  const ranges = smooth(108, 150, r) * (20 + crest(5, 0.3, 1.4) * 18 + crest(13, 2, 2) * 9 + crest(29, 1, 2.5) * 3 + Math.max(0, Math.sin(a * 3 + 0.4)) * 16);
  return cliff + basin + rolling + mound + ranges;
}

export const SNOW_LINE = 47;
const SUN_TOWARD = [-0.3, 0.81, -0.49];
function sunFacing(x, z) {
  const step = 1.5, dx = (terrainHeight(x + step, z) - terrainHeight(x - step, z)) / (2 * step), dz = (terrainHeight(x, z + step) - terrainHeight(x, z - step)) / (2 * step);
  const length = Math.hypot(dx, 1, dz), lit = (-dx * SUN_TOWARD[0] + SUN_TOWARD[1] - dz * SUN_TOWARD[2]) / length;
  return 0.62 + Math.max(0, lit) * 0.55;
}

const riverAt = t => { const a = -Math.PI * 1.05 + t * Math.PI * 1.1; const r = 58 + Math.sin(t * 9) * 7; return [Math.cos(a) * r, Math.sin(a) * r]; };
const nearRiver = (x, z) => { let best = Infinity; for (let i = 0; i <= 80; i++) { const [rx, rz] = riverAt(i / 80); best = Math.min(best, Math.hypot(x - rx, z - rz)); } return best; };
export const FLOCK = Object.freeze({ radius: 44, y: 19, center: -Math.PI / 2, span: 1.9, birds: 9 });

function buildSky(shape) {
  const radius = 180, rings = 18, segments = 40;
  const start = shape.roles.length;
  for (let ring = 0; ring <= rings; ring++) {
    const elevation = -0.25 + ring / rings * (Math.PI / 2 + 0.25);
    for (let s = 0; s <= segments; s++) {
      const a = s / segments * Math.PI * 2;
      const id = shape.vertex(Math.cos(a) * Math.cos(elevation) * radius, Math.sin(elevation) * radius, Math.sin(a) * Math.cos(elevation) * radius, 'sky');
      shape.fogs[id] = 0;
    }
  }
  for (let ring = 0; ring < rings; ring++) for (let s = 0; s < segments; s++) {
    const a = start + ring * (segments + 1) + s;
    shape.quad(a, a + segments + 1, a + segments + 2, a + 1);
  }
  const random = seeded(7);
  for (let i = 0; i < 420; i++) {
    const a = random() * Math.PI * 2, elevation = 0.12 + Math.asin(random()) * 1.3, size = 0.18 + random() ** 4 * 0.75;
    const d = 176, cx = Math.cos(a) * Math.cos(elevation) * d, cy = Math.sin(elevation) * d, cz = Math.sin(a) * Math.cos(elevation) * d;
    const side = new Vector3(-Math.sin(a), 0, Math.cos(a)).scale(size), up = new Vector3(-Math.cos(a) * Math.sin(elevation), Math.cos(elevation), -Math.sin(a) * Math.sin(elevation)).scale(size);
    const ids = [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([u, v]) => { const id = shape.vertex(cx + side.x * u + up.x * v, cy + side.y * u + up.y * v, cz + side.z * u + up.z * v, 'star', 0.5 + random() * 0.5, random()); shape.fogs[id] = 0; return id; });
    shape.quad(...ids);
  }
}

function buildLand(shape) {
  const rings = [0, 6, 8.5, 10, 12, 14, 16.5, 19, 22, 26, 31, 36, 42, 50, 60, 72, 86, 100, 112, 124, 136, 142, 148, 154, 160, 166, 172], segments = 240, start = shape.roles.length;
  for (const r of rings) for (let s = 0; s < segments; s++) {
    const a = s / segments * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, y = terrainHeight(x, z) - 0.06;
    const snowy = r > 104 && y > SNOW_LINE;
    const role = r < 9 ? 'meadow' : r < 22 ? (y > -2 ? 'grass' : 'cliff') : r < 104 ? ((s + rings.indexOf(r)) % 3 ? 'valley' : 'field') : snowy ? 'snow' : r < 136 ? 'mid' : 'far';
    const id = shape.vertex(x, y, z, role, r > 104 ? sunFacing(x, z) : 0.86 + ((s * 7 + r) % 5) * 0.04);
    if (r > 104) shape.fogs[id] *= snowy ? 0.5 : 0.78;
  }
  for (let ring = 0; ring < rings.length - 1; ring++) for (let s = 0; s < segments; s++) {
    const a = start + ring * segments + s, b = start + ring * segments + (s + 1) % segments;
    shape.quad(a, a + segments, b + segments, b);
  }
  for (let i = 0; i < 80; i++) {
    const t0 = i / 80, t1 = (i + 1) / 80, [x0, z0] = riverAt(t0), [x1, z1] = riverAt(t1);
    const dx = x1 - x0, dz = z1 - z0, length = Math.hypot(dx, dz), nx = -dz / length * 2.6, nz = dx / length * 2.6, y = terrainHeight(x0, z0) + 0.12;
    shape.quad(shape.vertex(x0 - nx, y, z0 - nz, 'water'), shape.vertex(x0 + nx, y, z0 + nz, 'water'), shape.vertex(x1 + nx, y, z1 + nz, 'water', 1.1), shape.vertex(x1 - nx, y, z1 - nz, 'water', 1.1));
    if (i % 3 === 0) { const g = 0.3 + (i % 5) * 0.12; shape.quad(shape.vertex(x0 - nx * g, y + 0.05, z0 - nz * g, 'glint', 0.7), shape.vertex(x0 + nx * g * 0.4, y + 0.05, z0 + nz * g * 0.4, 'glint', 0.7), shape.vertex(x0 + dx * 0.4 + nx * g * 0.4, y + 0.05, z0 + dz * 0.4 + nz * g * 0.4, 'glint', 0.7), shape.vertex(x0 + dx * 0.4 - nx * g, y + 0.05, z0 + dz * 0.4 - nz * g, 'glint', 0.7)); }
  }
}

function buildHamlet(shape) {
  const random = seeded(31), houses = [];
  for (let i = 0; i < 90 && houses.length < 26; i++) {
    const a = -Math.PI / 2 + 0.3 + (random() + random() - 1) * 0.3, r = 34 + random() * 18, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (nearRiver(x, z) < 5 || houses.some(([hx, hz, s]) => Math.hypot(hx - x, hz - z) < s + 1.4)) continue;
    const size = 1.5 + random() * 1.1; houses.push([x, z, size]);
    const w = size * (1.2 + random() * 0.5), d = size * (0.9 + random() * 0.3), h = size * (0.8 + random() * 0.5), yaw = Math.atan2(x, z) + Math.PI + (random() - 0.5) * 0.6;
    const ground = terrainHeight(x, z), wall = `walls${Math.floor(random() * 4)}`, roof = `roofs${Math.floor(random() * 4)}`;
    shape.box(x, ground + h / 2, z, w, h, d, yaw, wall, 0.9 + random() * 0.15);
    const cos = Math.cos(yaw), sin = Math.sin(yaw), at = (lx, ly, lz, role, s = 1, t = 0) => shape.vertex(x + lx * cos + lz * sin, ground + ly, z - lx * sin + lz * cos, role, s, t);
    const eave = w / 2 + 0.3, ridge = h + size * (0.7 + random() * 0.3), overhang = d / 2 + 0.3;
    shape.quad(at(-eave, h, overhang, roof, 1), at(eave, h, overhang, roof, 1), at(eave, ridge, 0, roof, 1.15), at(-eave, ridge, 0, roof, 1.15));
    shape.quad(at(eave, h, -overhang, roof, 0.7), at(-eave, h, -overhang, roof, 0.7), at(-eave, ridge, 0, roof, 0.85), at(eave, ridge, 0, roof, 0.85));
    shape.tri(at(eave, h, overhang, wall, 0.8), at(eave, h, -overhang, wall, 0.8), at(eave, ridge, 0, wall, 0.8));
    shape.tri(at(-eave, h, -overhang, wall, 0.75), at(-eave, h, overhang, wall, 0.75), at(-eave, ridge, 0, wall, 0.75));
    if (random() < 0.5) shape.box(x + (w * 0.25) * cos, ground + ridge - 0.1, z - (w * 0.25) * sin, 0.3, size * 0.6, 0.3, yaw, 'stone');
    const columns = Math.max(2, Math.round(w / 0.9));
    for (let c = 0; c < columns; c++) {
      const u = -w / 2 + (c + 0.5) * w / columns, v = h * 0.3, ww = 0.42, wh = 0.5, z0 = d / 2 + 0.03, t = random(), role = random() < 0.3 ? 'windowWarm' : 'window';
      shape.quad(at(u - ww / 2, v, z0, role, 1, t), at(u + ww / 2, v, z0, role, 1, t), at(u + ww / 2, v + wh, z0, role, 1, t), at(u - ww / 2, v + wh, z0, role, 1, t));
    }
  }
  const [bx, bz] = riverAt(0.47), bridgeYaw = Math.atan2(bx, bz);
  for (let i = -3; i <= 3; i++) { const cos = Math.cos(bridgeYaw), sin = Math.sin(bridgeYaw); shape.box(bx + i * 1.1 * cos, terrainHeight(bx, bz) + 0.5 + Math.cos(i / 3 * 1.2) * 1.2, bz - i * 1.1 * sin, 1.15, 0.5, 2.2, bridgeYaw, 'stone'); }
}

function buildCastle(shape) {
  const [cx, cz] = CASTLE_AT, g = terrainHeight(cx, cz) - 0.5, random = seeded(43);
  const tower = (x, z, w, h, roof) => { shape.box(cx + x, g + h / 2, cz + z, w, h, w, 0, 'castle'); shape.box(cx + x, g + h + 0.15, cz + z, w * 1.18, 0.3, w * 1.18, 0, 'castle', 1.1); shape.spire(cx + x, g + h + 0.3, cz + z, w * 0.62, roof, 'castleRoof'); };
  const ring = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return [Math.cos(a) * 10, Math.sin(a) * 7.5]; });
  ring.forEach(([x0, z0], i) => {
    const [x1, z1] = ring[(i + 1) % 10], length = Math.hypot(x1 - x0, z1 - z0);
    shape.box(cx + (x0 + x1) / 2, g + 1.7, cz + (z0 + z1) / 2, length + 0.4, 3.4, 0.9, Math.atan2(-(z1 - z0), x1 - x0), 'castle', 0.92);
    if (i % 2 === 0) tower(x0, z0, 1.7, 5 + random() * 1.5, 2.6);
  });
  shape.box(cx, g + 5.5, cz, 7.5, 11, 6, 0, 'castle');
  shape.box(cx, g + 13, cz, 4.6, 4, 4, 0, 'castle', 1.05);
  shape.spire(cx, g + 15, cz, 3, 5.5, 'castleRoof');
  for (const [x, z, w, h, roof] of [[-4.6, 0.6, 2.2, 14, 4.2], [4.6, 0.6, 2.2, 13, 4], [-2.6, -3.8, 1.6, 10, 3.2], [3, -3.4, 1.7, 11.5, 3.4], [0, 3.6, 1.5, 7.5, 2.6]]) tower(x, z, w, h, roof);
  const face = (x, y, z, columns, rows, width) => {
    for (let row = 0; row < rows; row++) for (let c = 0; c < columns; c++) {
      if (random() < 0.15) continue;
      const u = x - width / 2 + (c + 0.5) * width / columns, v = y + row * 1.5, t = random(), role = random() < 0.35 ? 'windowWarm' : 'window';
      shape.quad(shape.vertex(u - 0.22, v, z, role, 1, t), shape.vertex(u + 0.22, v, z, role, 1, t), shape.vertex(u + 0.22, v + 0.6, z, role, 1, t), shape.vertex(u - 0.22, v + 0.6, z, role, 1, t));
    }
  };
  face(cx, g + 3.5, cz + 3.05, 6, 5, 6.6); face(cx, g + 11.8, cz + 2.05, 3, 2, 3.8);
  face(cx - 4.6, g + 6, cz + 1.75, 1, 5, 1.4); face(cx + 4.6, g + 6, cz + 1.75, 1, 5, 1.4);
}

function buildVolcano(shape) {
  const [vx, vz] = VOLCANO_AT, base = 10, height = 34, radius = 36, rim = 4.5, rings = 9, segments = 30, start = shape.roles.length;
  const streaks = [0.9, 1.5, 2.3];
  for (let k = 0; k <= rings; k++) {
    const t = k / rings, y = base + height * t ** 1.35;
    for (let s = 0; s < segments; s++) {
      const a = s / segments * Math.PI * 2, jag = 1 + 0.05 * Math.sin(a * 6) + 0.03 * Math.sin(a * 14 + 1), r = (radius * (1 - t) + rim * t) * jag;
      const lava = t > 0.88 || (t > 0.45 && streaks.some(streak => Math.abs(Math.atan2(Math.sin(a - streak), Math.cos(a - streak))) < 0.035 * (1.4 - t)));
      shape.vertex(vx + Math.cos(a) * r, y, vz + Math.sin(a) * r, lava ? 'ember' : 'rock', 0.68 + 0.32 * Math.max(0, Math.cos(a - 2.1)) + (k % 2) * 0.04);
    }
  }
  for (let k = 0; k < rings; k++) for (let s = 0; s < segments; s++) {
    const a = start + k * segments + s, b = start + k * segments + (s + 1) % segments;
    shape.quad(a, a + segments, b + segments, b);
  }
  const top = base + height, crater = shape.vertex(vx, top - 2, vz, 'ember', 1.2), lip = start + rings * segments;
  for (let s = 0; s < segments; s++) shape.tri(crater, lip + s, lip + (s + 1) % segments);
}

function buildWatchtower(shape) {
  const [tx, tz] = TOWER_AT, g = terrainHeight(tx, tz) - 0.3;
  let y = g;
  for (const [w, h, twist] of [[3.4, 3, 0], [2.6, 5, 0.25], [2.1, 4.5, 0.5], [1.7, 3.5, 0.8]]) {
    shape.box(tx, y + h / 2, tz, w, h, w, twist, 'ruin', 0.95); shape.box(tx, y + h, tz, w + 0.3, 0.25, w + 0.3, twist, 'moss');
    y += h;
  }
  shape.box(tx, y + 0.3, tz, 3.2, 0.5, 3.2, 0.8, 'ruin', 1.05);
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]]) shape.box(tx + dx, y + 1.4, tz + dz, 0.3, 1.8, 0.3, 0, 'ruin', 0.9);
  const cy = y + 2.1, c = [shape.vertex(tx, cy + 1.6, tz, 'rune', 1.2), shape.vertex(tx, cy - 1.2, tz, 'rune', 0.8)];
  const ring = [[0.8, 0], [0, 0.8], [-0.8, 0], [0, -0.8]].map(([dx, dz], k) => shape.vertex(tx + dx, cy, tz + dz, 'rune', k % 2 ? 1 : 0.9));
  for (let k = 0; k < 4; k++) { shape.tri(c[0], ring[k], ring[(k + 1) % 4]); shape.tri(c[1], ring[(k + 1) % 4], ring[k]); }
}

function buildRuins(shape) {
  const random = seeded(71);
  for (let site = 0; site < 12; site++) {
    const across = -8 + (random() - 0.5) * 60, distance = 26 + random() * 34, [x, z] = ahead(across, distance);
    if (nearRiver(x, z) < 4) continue;
    const g = terrainHeight(x, z) - 0.2, yaw = random() * Math.PI, cos = Math.cos(yaw), sin = Math.sin(yaw);
    if (site % 4 === 0) {
      for (const side of [-1, 1]) { shape.box(x + side * 2 * cos, g + 2.4, z - side * 2 * sin, 0.9, 4.8, 0.9, yaw, 'ruin'); shape.box(x + side * 2 * cos, g + 4.9, z - side * 2 * sin, 1.1, 0.25, 1.1, yaw, 'moss'); }
      shape.box(x, g + 5.3, z, 5.2, 0.8, 1, yaw, 'ruin', 1.05); shape.box(x, g + 5.75, z, 5.2, 0.15, 1, yaw, 'moss');
      continue;
    }
    for (let k = 0; k < 2 + Math.floor(random() * 3); k++) {
      const px = x + (random() - 0.5) * 5, pz = z + (random() - 0.5) * 5, h = 1 + random() * 3.2, py = terrainHeight(px, pz) - 0.2;
      shape.box(px, py + h / 2, pz, 0.85, h, 0.85, yaw + random(), 'ruin', 0.9 + random() * 0.15); shape.box(px, py + h + 0.07, pz, 0.95, 0.14, 0.95, yaw, 'moss');
    }
    shape.box(x, g + 0.2, z, 4, 0.4, 3, yaw, 'ruin', 0.8);
  }
}

function roundTree(shape, x, z, tall, random) {
  const y = terrainHeight(x, z);
  shape.box(x, y + tall * 0.3, z, 0.3 + tall * 0.04, tall * 0.6, 0.3 + tall * 0.04, random() * 3, 'trunk');
  for (let clump = 0; clump < 3; clump++) {
    const a = random() * Math.PI * 2, off = clump ? tall * 0.18 : 0, size = tall * (clump ? 0.26 : 0.34);
    shape.blob(x + Math.cos(a) * off, y + tall * (0.72 + clump * 0.08), z + Math.sin(a) * off, size, size * 0.85, size, 'leaf', 'leafLight', 0.55, 4, 8);
  }
}

function buildForest(shape) {
  const random = seeded(11);
  for (let i = 0; i < 40; i++) {
    const a = random() * Math.PI * 2, r = 12 + random() * 14, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if ((Math.abs(x) < 7.6 && Math.abs(z) < 6.4) || (bearing(x, z) > -0.9 && bearing(x, z) < 0.35)) continue;
    roundTree(shape, x, z, 3.5 + random() * 4.5, random);
  }
  for (const [across, distance, spread, count] of [[-34, 44, 9, 16], [-6, 40, 6, 9], [26, 34, 7, 12], [48, 72, 12, 18], [-52, 78, 12, 18], [8, 64, 8, 10], [36, 90, 10, 12]]) {
    for (let i = 0; i < count; i++) {
      const [x, z] = ahead(across + (random() - 0.5) * spread * 2, distance + (random() - 0.5) * spread * 1.4);
      if (nearRiver(x, z) < 4 || Math.hypot(x - CASTLE_AT[0], z - CASTLE_AT[1]) < 13) continue;
      if (random() < 0.25) {
        const y = terrainHeight(x, z), tall = 4 + random() * 3;
        shape.box(x, y + tall * 0.2, z, 0.3, tall * 0.4, 0.3, 0, 'trunk');
        for (let tier = 0; tier < 3; tier++) {
          const ty = y + tall * (0.3 + tier * 0.22), tr = tall * (0.34 - tier * 0.09), apex = shape.vertex(x, ty + tall * 0.4, z, 'leafLight', 1.05), base = [];
          for (let s = 0; s < 6; s++) base.push(shape.vertex(x + Math.cos(s / 6 * Math.PI * 2) * tr, ty, z + Math.sin(s / 6 * Math.PI * 2) * tr, 'leaf', 0.7 + (s % 2) * 0.12));
          for (let s = 0; s < 6; s++) shape.tri(apex, base[(s + 1) % 6], base[s]);
        }
      } else roundTree(shape, x, z, 3 + random() * 3, random);
    }
  }
}

function buildBirds(shape) {
  const { radius, birds } = FLOCK;
  for (let i = 0; i < birds; i++) {
    const side = (i - (birds - 1) / 2) * 1.6, back = -Math.abs(side) * 0.9, x = radius + side, y = Math.sin(i * 1.7) * 0.3, z = back, span = 0.75;
    const body = shape.vertex(x, y, z + 0.25, 'bird'), tail = shape.vertex(x, y, z - 0.2, 'bird');
    shape.tri(body, shape.vertex(x - span, y + 0.28, z - 0.12, 'bird'), tail);
    shape.tri(body, tail, shape.vertex(x + span, y + 0.28, z - 0.12, 'bird'));
  }
}

function buildClouds(shape) {
  const random = seeded(19);
  const bearings = [-1.25, -0.95, -0.62, -0.3, 0.02, 0.3, 0.55, 0.9, 1.6, 2.3, 3, -2.2, -3];
  for (const b of bearings) {
    const a = b + (random() - 0.5) * 0.12, r = 120 + random() * 38, x = Math.sin(a) * r, z = -Math.cos(a) * r, y = 19 + random() * 11, size = 6 + random() * 4;
    const along = [Math.cos(a), Math.sin(a)], puff = (u, lift, s, stretch = 1) => shape.blob(x + along[0] * u, y + lift, z + along[1] * u, s * stretch, s * 0.62, s * 0.8, 'cloudShade', 'cloud', 0.7, 5, 10);
    for (let k = -2; k <= 2; k++) puff(k * size * 0.9, 0, size * (0.9 + random() * 0.3), 1.35);
    for (let k = -1; k <= 1; k++) puff(k * size * 0.95 + (random() - 0.5) * 2, size * 0.75, size * (1 + random() * 0.35));
    puff((random() - 0.5) * size, size * 1.45, size * (0.8 + random() * 0.3));
  }
}

function buildSpirit(shape) {
  const top = shape.vertex(0, 0.45, 0, 'spirit', 1.2), bottom = shape.vertex(0, -0.45, 0, 'spirit', 1);
  const ring = [[0.28, 0], [0, 0.28], [-0.28, 0], [0, -0.28]].map(([x, z]) => shape.vertex(x, 0, z, 'spirit', 1.1));
  for (let k = 0; k < 4; k++) { shape.tri(top, ring[k], ring[(k + 1) % 4]); shape.tri(bottom, ring[(k + 1) % 4], ring[k]); }
}

function buildMoon(shape) {
  const center = shape.vertex(0, 0, 0, 'moon', 1.05);
  const ring = []; for (let s = 0; s < 28; s++) { const a = s / 28 * Math.PI * 2; ring.push(shape.vertex(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 0, 'moon', 0.92)); }
  for (let s = 0; s < 28; s++) shape.tri(center, ring[s], ring[(s + 1) % 28]);
  for (const [x, y, r] of [[-1.8, 1.4, 1.3], [2, -1.2, 1.6], [0.8, 2.6, 0.8]]) {
    const c = shape.vertex(x, y, 0.05, 'moon', 0.8), rim = []; for (let s = 0; s < 10; s++) { const a = s / 10 * Math.PI * 2; rim.push(shape.vertex(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.05, 'moon', 0.84)); }
    for (let s = 0; s < 10; s++) shape.tri(c, rim[s], rim[(s + 1) % 10]);
  }
}

function buildShootingStar(shape) {
  shape.quad(shape.vertex(0, -0.12, 0, 'star', 1), shape.vertex(0, 0.12, 0, 'star', 1), shape.vertex(-14, 0.02, 0, 'haze', 0.6), shape.vertex(-14, -0.02, 0, 'haze', 0.6));
}

function buildShell(shape, doors) {
  shape.flat = true;
  const W = SEAT_WINDOW, left = W.x - W.width / 2, right = W.x + W.width / 2, bottom = W.y - W.height / 2, top = W.y + W.height / 2;
  const wall = (cx, cy, cz, w, h, d, role, shade = 1) => shape.box(cx, cy, cz, w, h, d, 0, role, shade);
  wall(0.08, (0.2 + bottom) / 2, 4.71, 12.3, bottom - 0.2, 0.22, 'wall');
  wall(0.08, (5.8 + top) / 2, 4.71, 12.3, 5.8 - top, 0.22, 'wall');
  wall((left - 6.07) / 2, W.y, 4.71, left + 6.07, W.height, 0.22, 'wall');
  wall((right + 6.23) / 2, W.y, 4.71, 6.23 - right, W.height, 0.22, 'wall');
  wall(6.11, 3.0, 0, 0.22, 5.6, 9.42, 'wall');
  wall(0.08, 0.8, 4.56, 12.1, 1.1, 0.08, 'wainscot'); wall(5.96, 0.8, 0, 0.08, 1.1, 9.1, 'wainscot');
  for (let i = 0; i < 14; i++) wall(-5.5 + i * 0.83, 0.8, 4.51, 0.035, 0.94, 0.045, 'trim');
  for (let i = 0; i < 10; i++) wall(5.91, 0.8, -4.05 + i * 0.9, 0.045, 0.94, 0.035, 'trim');
  for (const y of [0.3, 1.36]) { wall(0.08, y, 4.5, 12.1, 0.11, 0.16, 'trim'); wall(5.9, y, 0, 0.16, 0.11, 9.1, 'trim'); }
  wall(0.08, 5.72, 4.52, 12.1, 0.18, 0.2, 'trim'); wall(5.92, 5.72, 0, 0.2, 0.18, 9.1, 'trim');
  wall(0.08, 5.9, 0.05, 12.35, 0.12, 9.55, 'ceiling', 0.9);
  for (let i = 0; i < 16; i++) wall(-5.6 + i * 0.75, 5.83, 0.05, 0.02, 0.02, 9.4, 'beam', 0.8);
  for (const x of [-4.2, -1.4, 1.4, 4.2]) wall(x, 5.62, 0.05, 0.3, 0.36, 9.4, 'beam');
  wall(0.08, 5.66, -2.3, 12.2, 0.26, 0.24, 'beam', 0.92); wall(0.08, 5.66, 2.3, 12.2, 0.26, 0.24, 'beam', 0.92);
  wall(W.x, bottom - 0.06, 4.5, W.width + 0.5, 0.14, 0.5, 'trim', 1.1);
  for (const x of [left - 0.07, right + 0.07]) wall(x, W.y, 4.56, 0.16, W.height + 0.1, 0.2, 'trim');
  wall(W.x, top + 0.07, 4.56, W.width + 0.3, 0.16, 0.2, 'trim');
  wall(W.x, W.y, 4.62, 0.07, W.height, 0.08, 'trim', 1.15);
  for (const y of [bottom + W.height / 3, bottom + W.height * 2 / 3]) wall(W.x, y, 4.62, W.width, 0.06, 0.08, 'trim', 1.15);
  for (const side of [-1, 1]) for (let fold = 0; fold < 4; fold++) {
    const x = W.x + side * (W.width / 2 + 0.25 + fold * 0.13);
    shape.blob(x, 3.25, 4.34 - (fold % 2) * 0.05, 0.12, 2.3, 0.1, fold % 2 ? 'curtainShade' : 'curtain', fold % 2 ? 'curtainShade' : 'curtain', 0.8, 5, 8);
  }
  wall(W.x, top + 0.45, 4.4, W.width + 1.6, 0.05, 0.05, 'brass');
  for (const z of doors) {
    wall(5.9, 1.52, z, 0.14, 2.64, 1.62, 'trim');
    wall(5.84, 1.5, z, 0.1, 2.5, 1.4, 'door');
    for (const dz of [-0.35, 0.35]) for (const [dy, h] of [[0.85, 1.05], [2.1, 0.9]]) wall(5.78, dy, z + dz, 0.03, h, 0.5, 'door', 0.85);
    shape.blob(5.76, 1.35, z + 0.55, 0.05, 0.05, 0.05, 'brass', 'brass', 0.9, 3, 8);
  }
}

const CLOUD_SHADE = `float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float cloudShade(vec2 at, float time) { vec2 drift = at * .05 + time * vec2(.018, .007); return smoothstep(.42, .6, noise(drift) * .65 + noise(drift * 2.3 + 4.1) * .35); }`;
const LAND_VERTEX = `precision highp float;
attribute vec3 position; attribute vec4 color; uniform mat4 world, viewProjection; uniform float time, shadow;
varying vec3 vColor; varying float vCloud;
${CLOUD_SHADE}
void main() { vec4 p = world * vec4(position, 1.); vColor = color.rgb; vCloud = cloudShade(p.xz, time) * shadow * (1. - smoothstep(60., 110., length(p.xz))); gl_Position = viewProjection * p; }`;
const LAND_FRAGMENT = `precision highp float;
varying vec3 vColor; varying float vCloud;
void main() { gl_FragColor = vec4(vColor * (1. - vCloud * .4), 1.); }`;
const GRASS_VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv; uniform mat4 world, viewProjection; uniform float time;
uniform float shadow; varying float vTip, vFog, vGust, vShade, vCloud;
${CLOUD_SHADE}
void main() {
  vec4 p = world * vec4(position, 1.);
  vCloud = cloudShade(p.xz, time) * shadow;
  float wave = sin(p.x * .045 + p.z * .03 - time * .9) * .5 + .5 + sin(p.x * .11 - p.z * .07 - time * 1.7) * .15;
  float gust = smoothstep(.55, 1., wave), sway = sin(time * 2.1 + p.x * .35 + p.z * .25 + uv.y * 6.28) * .22 + gust * .9;
  p.xz += vec2(.92, .38) * sway * uv.x * .55; p.y -= uv.x * gust * .18;
  vTip = step(.001, uv.x); vGust = gust * vTip; vShade = .82 + .36 * uv.y;
  vFog = smoothstep(20., 175., length(p.xz)) * .82;
  gl_Position = viewProjection * p;
}`;
const GRASS_FRAGMENT = `precision highp float;
varying float vTip, vFog, vGust, vShade, vCloud; uniform vec3 root, tip, shine, haze;
void main() {
  vec3 c = mix(root, tip, vTip * vTip) * vShade;
  c = mix(c, shine, vGust * .42 * (1. - vCloud));
  c *= 1. - vCloud * .45;
  gl_FragColor = vec4(mix(c, haze, vFog), 1.);
}`;

export function grassBlades() {
  const positions = [], uvs = [], indices = [], random = seeded(83);
  const patch = (count, near, far, width, height) => {
    for (let i = 0; i < count; i++) {
      const b = -1.15 + random() * 1.8, r = near + (far - near) * Math.sqrt(random()), x = Math.sin(b) * r, z = -Math.cos(b) * r;
      if (Math.abs(x) < 6.4 + width && z > -4.9 - width) continue;
      if (nearRiver(x, z) < 3.2) continue;
      const y = terrainHeight(x, z) - 0.04, h = height * (0.6 + random() * 0.8), turn = random() * Math.PI, dx = Math.cos(turn) * width / 2, dz = Math.sin(turn) * width / 2, lean = (random() - 0.5) * h * 0.4, shade = random(), start = positions.length / 3;
      positions.push(x - dx, y, z - dz, x + dx, y, z + dz, x + lean, y + h, z + lean * 0.5);
      uvs.push(0, shade, 0, shade, h, shade);
      indices.push(start, start + 1, start + 2);
    }
  };
  patch(3200, 4.9, 11, 0.12, 0.55);
  patch(3000, 11, 26, 0.3, 0.9);
  patch(7000, 26, 64, 0.6, 1.35);
  return { positions, uvs, indices };
}

const SHELL_ROLES = { curtain: '#a88380', curtainShade: '#8c686d', brass: '#bf9762' };

function toMesh(shape, name, scene, parent, material) {
  const mesh = new Mesh(name, scene), data = new VertexData();
  data.positions = shape.positions; data.indices = shape.indices;
  const normals = []; VertexData.ComputeNormals(shape.positions, shape.indices, normals); data.normals = normals;
  data.colors = new Float32Array(shape.roles.length * 4).fill(1);
  data.applyToMesh(mesh, true);
  mesh.material = material; mesh.parent = parent; mesh.isPickable = false; mesh.useVertexColors = true; mesh.hasVertexAlpha = false;
  mesh.metadata = { castShadow: false, seatWorld: true, shape };
  return mesh;
}

export function vistaColor(palette, shape, i, out, glow) {
  const role = shape.roles[i], shade = shape.shades[i];
  let color;
  if (role === 'sky') {
    const y = shape.positions[i * 3 + 1] / 180, x = shape.positions[i * 3] / 180, z = shape.positions[i * 3 + 2] / 180;
    const low = hex(palette.horizon), mid = hex(palette.high), high = hex(palette.zenith), below = hex(palette.below);
    color = y < 0 ? Color3.Lerp(low, below, smooth(0, -0.2, y)) : y < 0.35 ? Color3.Lerp(low, mid, smooth(0, 0.35, y)) : Color3.Lerp(mid, high, smooth(0.35, 0.95, y));
    const toward = Math.max(0, (x * glow.x + z * glow.z) / Math.max(0.001, Math.hypot(x, z)));
    color = Color3.Lerp(color, hex(palette.glow), toward ** 5 * (1 - smooth(0, 0.45, y)) * 0.75);
  } else if (role === 'window' || role === 'windowWarm') {
    const lit = shape.thresholds[i] < glow.lit;
    color = hex(lit ? palette[role] : palette.windowDark);
  } else if (role === 'star') {
    color = Color3.Lerp(hex(palette.high), hex(palette.star), shape.thresholds[i] < glow.stars ? shade : 0);
  } else {
    const key = role.replace(/\d$/, ''), index = Number(role.slice(-1));
    const value = Array.isArray(palette[key]) ? palette[key][index] : palette[role] ?? SHELL_ROLES[role] ?? palette.stone;
    color = hex(value).scale(shade);
  }
  const fog = ['lamp', 'spirit', 'window', 'windowWarm', 'glint', 'star', 'moon', 'ember', 'rune'].includes(role) ? shape.fogs[i] * 0.45 : shape.fogs[i];
  Color3.LerpToRef(color, hex(palette.haze), fog * 0.82, out);
  return out;
}

export function vistaPalette(theme, progress) {
  const base = VISTA_THEMES[theme] || VISTA_THEMES.dusk;
  if (!base.night) return base;
  const deeper = smooth(0.15, 1, progress), mixed = { ...base };
  for (const [key, value] of Object.entries(base.night)) mixed[key] = Color3.Lerp(hex(base[key]), hex(value), deeper).toHexString();
  return mixed;
}

export const windowsLit = (theme, progress) => theme === 'day' ? 0 : Math.min(1, (VISTA_THEMES[theme] || VISTA_THEMES.dusk).light + progress * 0.7);
export const spiritsAloft = (theme, progress) => theme === 'day' ? 0 : Math.round(4 + progress * (SPIRITS - 4));
export const moonRise = progress => 0.14 + progress * 0.36;

export function createSeatWorld(scene, parent) {
  const root = new TransformNode('seat-world', scene); root.parent = parent; root.setEnabled(false);
  const unlit = new StandardMaterial('seat-world-sky', scene); unlit.disableLighting = true; unlit.diffuseColor = Color3.Black(); unlit.emissiveColor = Color3.White(); unlit.specularColor = Color3.Black(); unlit.backFaceCulling = false;
  const lit = new StandardMaterial('seat-world-shell', scene); lit.diffuseColor = Color3.White(); lit.specularColor.set(0.03, 0.03, 0.03);
  const shapes = {};
  const make = (name, build, material = unlit, parentNode = root) => { const shape = createShape(); build(shape); shapes[name] = shape; return toMesh(shape, `seat-world-${name}`, scene, parentNode, material); };
  const spiritMatrices = new Float32Array(SPIRITS * 16);
  const grassPaint = new ShaderMaterial('seat-world-grass-paint', scene, { vertexSource: GRASS_VERTEX, fragmentSource: GRASS_FRAGMENT }, { attributes: ['position', 'uv'], uniforms: ['world', 'viewProjection', 'time', 'shadow', 'root', 'tip', 'shine', 'haze'] });
  const landPaint = new ShaderMaterial('seat-world-land-paint', scene, { vertexSource: LAND_VERTEX, fragmentSource: LAND_FRAGMENT }, { attributes: ['position', 'color'], uniforms: ['world', 'viewProjection', 'time', 'shadow'] });
  landPaint.backFaceCulling = false; landPaint.setFloat('time', 0); landPaint.setFloat('shadow', 0);
  grassPaint.backFaceCulling = false; grassPaint.setFloat('time', 0); grassPaint.setFloat('shadow', 0);
  let sky = null, land, grass, cloudRoot, clouds, flockRoot, flock, moon, shooting, spirits;
  function build() {
    sky = make('sky', buildSky); land = make('land', shape => { buildLand(shape); buildHamlet(shape); buildForest(shape); buildRuins(shape); buildCastle(shape); buildWatchtower(shape); buildVolcano(shape); }, landPaint);
    grass = new Mesh('seat-world-grass', scene); Object.assign(new VertexData(), grassBlades()).applyToMesh(grass); grass.material = grassPaint; grass.parent = root; grass.isPickable = false; grass.metadata = { castShadow: false, seatWorld: true };
    cloudRoot = new TransformNode('seat-world-cloud-drift', scene); cloudRoot.parent = root;
    clouds = make('clouds', buildClouds, unlit, cloudRoot);
    flockRoot = new TransformNode('seat-world-flock-flight', scene); flockRoot.parent = root; flockRoot.position.y = FLOCK.y;
    flock = make('flock', buildBirds, unlit, flockRoot);
    moon = make('moon', buildMoon); shooting = make('shooting', buildShootingStar); spirits = make('spirits', buildSpirit);
    moon.metadata.glow = spirits.metadata.glow = true;
    spirits.thinInstanceSetBuffer('matrix', spiritMatrices, 16, false); spirits.alwaysSelectAsActiveMesh = true;
  }
  let shell = null, shellKey = '', theme = 'dusk', progress = 0, colorKey = '', seconds = 0;
  const glow = { x: 0, z: -1, lit: 0, stars: 1 };
  const temp = new Color3(), matrix = new Matrix(), scale = new Vector3(1, 1, 1), spot = new Vector3(), turn = new Quaternion();
  const spiritStarts = Array.from({ length: SPIRITS }, (_, i) => { const random = seeded(101 + i); const [x, z] = ahead(-10 + (random() - 0.5) * 56, 13 + random() * 40); return { x, z, ground: terrainHeight(x, z), phase: random(), sway: random() * 6 }; });

  function paint(mesh, palette, only = null) {
    const shape = mesh.metadata.shape, colors = mesh.getVerticesData('color');
    for (let i = 0; i < shape.roles.length; i++) {
      if (only && !only.has(shape.roles[i])) continue;
      vistaColor(palette, shape, i, temp, glow); colors[i * 4] = temp.r; colors[i * 4 + 1] = temp.g; colors[i * 4 + 2] = temp.b;
    }
    mesh.updateVerticesData('color', colors);
  }
  function placeMoon() {
    const rise = theme === 'day' ? 0.95 : moonRise(progress), heading = -Math.PI / 2 - 0.55, d = 165;
    glow.x = Math.cos(heading); glow.z = Math.sin(heading);
    moon.position.set(Math.cos(heading) * Math.cos(rise) * d, Math.sin(rise) * d, Math.sin(heading) * Math.cos(rise) * d);
    moon.lookAt(Vector3.Zero()); moon.scaling.setAll(theme === 'day' ? 0.8 : 1.2);
    moon.setEnabled(theme !== 'rain');
  }
  function recolor() {
    if (!sky) return;
    const key = `${theme}:${Math.round(progress * 60)}`; if (key === colorKey) return; colorKey = key;
    const palette = vistaPalette(theme, progress);
    glow.lit = windowsLit(theme, progress); glow.stars = theme === 'dusk' ? 0.55 + progress * 0.45 : 0;
    placeMoon();
    for (const mesh of [sky, land, clouds, flock, moon, shooting, spirits]) paint(mesh, palette);
    const blade = (key, scale) => hex(palette[key]).scale(scale);
    grassPaint.setColor3('root', blade('grass', 0.62)); grassPaint.setColor3('tip', Color3.Lerp(blade('meadow', 1.08), hex(palette.glow), 0.12)); grassPaint.setColor3('shine', Color3.Lerp(blade('meadow', 1.28), hex(palette.glow), 0.3)); grassPaint.setColor3('haze', hex(palette.haze)); for (const each of [grassPaint, landPaint]) each.setFloat('shadow', CLOUD_SHADOW[theme] ?? 0);
  }
  function setShell(style, wallPaint = {}, doors = []) {
    const base = SHELL_PAINT[style] || SHELL_PAINT.retreat, key = JSON.stringify([style, wallPaint, doors]);
    if (key === shellKey) return; shellKey = key;
    shell?.dispose(); shell = make('shell', shape => buildShell(shape, doors), lit);
    shell.receiveShadows = true;
    const palette = Object.fromEntries(Object.entries(base).map(([role, value]) => [role, wallPaint[value] || value]));
    const colors = shell.getVerticesData('color'), shape = shell.metadata.shape;
    for (let i = 0; i < shape.roles.length; i++) { const c = hex(palette[shape.roles[i]] || SHELL_ROLES[shape.roles[i]] || base.wall).scale(shape.shades[i]); colors.set([c.r, c.g, c.b, 1], i * 4); }
    shell.updateVerticesData('color', colors);
  }
  function placeSpirits(reduced) {
    const aloft = spiritsAloft(theme, progress);
    for (let i = 0; i < SPIRITS; i++) {
      const start = spiritStarts[i], life = reduced ? start.phase : (seconds / SPIRIT_SECONDS + start.phase) % 1;
      const rise = i < aloft ? life : -1;
      spot.set(start.x + Math.sin(life * 9 + start.sway) * 1.6, rise < 0 ? -400 : start.ground + 0.8 + rise * 12, start.z + Math.cos(life * 7 + start.sway) * 1.6);
      scale.setAll(rise < 0 ? 0 : Math.sin(Math.PI * life) * 0.9);
      Quaternion.RotationYawPitchRollToRef(life * 4 + start.sway, 0, 0, turn);
      Matrix.ComposeToRef(scale, turn, spot, matrix); matrix.copyToArray(spiritMatrices, i * 16);
    }
    spirits.thinInstanceBufferUpdated('matrix');
  }
  function animate(delta, reduced) {
    if (!root.isEnabled(false)) return;
    seconds += reduced ? 0 : delta;
    cloudRoot.rotation.y = seconds * 0.004;
    grassPaint.setFloat('time', seconds); landPaint.setFloat('time', seconds);
    const run = (seconds % FLOCK_SECONDS) / FLOCK_SECONDS * 2;
    flockRoot.rotation.y = -(FLOCK.center - FLOCK.span / 2 + FLOCK.span * Math.min(1, run));
    flockRoot.position.y = FLOCK.y + Math.sin(seconds * 0.7) * 0.9;
    flock.setEnabled(run < 1 && !reduced);
    const shot = (seconds % SHOOTING_SECONDS) / SHOOTING_SECONDS, streak = theme === 'dusk' && !reduced && shot < 0.05;
    shooting.setEnabled(streak);
    if (streak) { const n = Math.floor(seconds / SHOOTING_SECONDS), a = -Math.PI / 2 + Math.sin(n * 2.3) * 0.9; shooting.position.set(Math.cos(a) * 150 + shot * 400 * Math.sin(a), 70 + Math.cos(n) * 18 - shot * 160, Math.sin(a) * 150 - shot * 400 * Math.cos(a)); shooting.lookAt(Vector3.Zero()); shooting.rotation.z = -0.45; }
    placeSpirits(reduced);
  }
  return {
    root,
    get meshes() { return root.getChildMeshes(); },
    get theme() { return theme; },
    get progress() { return progress; },
    setTheme(next) { theme = VISTA_THEMES[next] ? next : 'dusk'; recolor(); },
    setProgress(next) { progress = Math.min(1, Math.max(0, Number(next) || 0)); recolor(); },
    setShell,
    prepare() { if (!sky) { build(); recolor(); } },
    setEnabled(enabled) { if (enabled && !sky) build(); root.setEnabled(enabled); if (enabled) { recolor(); placeSpirits(true); } },
    animate,
    dispose() { root.dispose(false, false); unlit.dispose(); lit.dispose(); grassPaint.dispose(); landPaint.dispose(); },
  };
}
