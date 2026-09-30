import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';

export const VISTA_THEMES = Object.freeze({
  dusk: {
    zenith: '#101637', high: '#2b2d5c', horizon: '#c07c95', glow: '#f4b184', haze: '#5d5282', below: '#2a2a4c',
    far: '#4a4a78', mid: '#343a62', valley: '#27324c', field: '#2e3b52', cliff: '#3a3a52', grass: '#34503f', meadow: '#40604a',
    trunk: '#3b2e33', leaf: '#2e4a40', leafLight: '#3e5d4a', walls: ['#c9a58a', '#b98f86', '#a9a3a0', '#d4b894'], roofs: ['#7b4a4a', '#4f5577', '#6a5a78', '#8a5a44'],
    stone: '#6b6480', water: '#3f4a7c', glint: '#f2d7b0', window: '#ffc978', windowWarm: '#ffa860', windowDark: '#2b2d44', lamp: '#ffdca0',
    star: '#fff4d8', moon: '#fff1d0', cloud: '#8c7ea8', cloudShade: '#5b5484', rail: '#2a2436', train: '#6b3f4a', trainRoof: '#3a2c3c', lantern: '#ffb467',
    light: 0.35, night: { zenith: '#070b24', high: '#171b44', horizon: '#6a4f86', glow: '#b67a8e', haze: '#3a3766', cloud: '#4c4777', cloudShade: '#35325c' },
  },
  day: {
    zenith: '#4f8fcf', high: '#86b9df', horizon: '#f2e3c4', glow: '#fff2cc', haze: '#bcd3dc', below: '#9ab7a4',
    far: '#9ab4c8', mid: '#7fa3a6', valley: '#6f9a6e', field: '#8db27a', cliff: '#a09080', grass: '#6f9e5c', meadow: '#8fba6a',
    trunk: '#6e5040', leaf: '#4f8055', leafLight: '#6f9e62', walls: ['#f2e2c4', '#efc9b4', '#dcd6cc', '#f5dca6'], roofs: ['#c0674f', '#5b7a9c', '#8a6f9e', '#d08a52'],
    stone: '#b8aa98', water: '#6fa8c8', glint: '#fff8e8', window: '#3d5570', windowWarm: '#3d5570', windowDark: '#3d5570', lamp: '#f4e2b8',
    star: '#86b9df', moon: '#f6f3ea', cloud: '#fffaf0', cloudShade: '#dfe4ea', rail: '#6a5a50', train: '#b24a42', trainRoof: '#5a4a48', lantern: '#f7c889',
    light: 0, night: null,
  },
  rain: {
    zenith: '#3f4a5e', high: '#5c6878', horizon: '#9aa2a8', glow: '#b8b4ae', haze: '#7a8590', below: '#4c5864',
    far: '#687684', mid: '#56646f', valley: '#46545a', field: '#50605e', cliff: '#5a5a60', grass: '#4a6452', meadow: '#56705a',
    trunk: '#3e3a3a', leaf: '#3c5448', leafLight: '#4a6454', walls: ['#b8ab9c', '#a8958e', '#9ea0a2', '#bcae90'], roofs: ['#6a4848', '#4a5468', '#5a5068', '#7a5a4a'],
    stone: '#747880', water: '#5a6a7c', glint: '#c8ccd0', window: '#ffc27a', windowWarm: '#ffaa66', windowDark: '#3a4050', lamp: '#ffd49a',
    star: '#5c6878', moon: '#c8ccd0', cloud: '#8a939e', cloudShade: '#6a7480', rail: '#34343c', train: '#6a3c40', trainRoof: '#3a3238', lantern: '#ffb467',
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
export const TRAIN_SECONDS = 46;
const LANTERNS = 26, LANTERN_SECONDS = 70, SHOOTING_SECONDS = 23;

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
  return shape;
}

function terrainHeight(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const cliff = -8 * smooth(8.5, 20, r + Math.sin(a * 5) * 1.6);
  const basin = 17 * smooth(24, 112, r);
  const rolling = Math.sin(x * 0.07) * Math.cos(z * 0.06) * 1.6 * smooth(26, 45, r);
  const ranges = smooth(108, 150, r) * (26 + Math.sin(a * 7) * 9 + Math.sin(a * 17 + 1) * 5 + Math.max(0, Math.sin(a * 3 + 0.4)) * 16);
  return cliff + basin + rolling + ranges;
}

const riverAt = t => { const a = -Math.PI * 1.05 + t * Math.PI * 1.1; const r = 58 + Math.sin(t * 9) * 7; return [Math.cos(a) * r, Math.sin(a) * r]; };
const nearRiver = (x, z) => { let best = Infinity; for (let i = 0; i <= 80; i++) { const [rx, rz] = riverAt(i / 80); best = Math.min(best, Math.hypot(x - rx, z - rz)); } return best; };
export const TRAIN_LINE = Object.freeze({ radius: 70, y: 5.2, center: -Math.PI / 2, span: 1.9, cars: 6, gap: 0.066 });

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
  const rings = [0, 6, 8.5, 10, 12, 14, 16.5, 19, 22, 26, 31, 36, 42, 50, 60, 72, 86, 100, 112, 124, 136, 148, 160, 172], segments = 120, start = shape.roles.length;
  for (const r of rings) for (let s = 0; s < segments; s++) {
    const a = s / segments * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, y = terrainHeight(x, z) - 0.06;
    const role = r < 9 ? 'meadow' : r < 22 ? (y > -2 ? 'grass' : 'cliff') : r < 104 ? ((s + rings.indexOf(r)) % 3 ? 'valley' : 'field') : r < 136 ? 'mid' : 'far';
    shape.vertex(x, y, z, role, 0.86 + ((s * 7 + r) % 5) * 0.04);
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

function buildVillage(shape) {
  const random = seeded(31), clusters = [[-Math.PI / 2, 0.55, 170, 46, 104], [Math.PI, 0.45, 60, 34, 70], [Math.PI / 2, 0.5, 70, 38, 90], [0.1, 0.4, 30, 40, 80]];
  const houses = [];
  for (const [center, spread, count, near, far] of clusters) for (let i = 0; i < count; i++) {
    const a = center + (random() + random() - 1) * spread, r = near + (far - near) * random() ** 0.8, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (nearRiver(x, z) < 5.5 || Math.abs(r - TRAIN_LINE.radius) < 4 || houses.some(([hx, hz, s]) => Math.hypot(hx - x, hz - z) < s + 1.6)) continue;
    const size = 2 + random() * 2.2; houses.push([x, z, size]);
    const w = size * (1.2 + random() * 0.6), d = size * (0.9 + random() * 0.4), h = size * (1 + random() * 0.9), yaw = Math.atan2(x, z) + Math.PI + (random() - 0.5) * 0.5;
    const ground = terrainHeight(x, z), wall = `walls${Math.floor(random() * 4)}`, roof = `roofs${Math.floor(random() * 4)}`;
    shape.box(x, ground + h / 2, z, w, h, d, yaw, wall, 0.9 + random() * 0.15);
    const cos = Math.cos(yaw), sin = Math.sin(yaw), at = (lx, ly, lz, role, s = 1, t = 0) => shape.vertex(x + lx * cos + lz * sin, ground + ly, z - lx * sin + lz * cos, role, s, t);
    const eave = w / 2 + 0.25, ridge = h + size * (0.55 + random() * 0.35), overhang = d / 2 + 0.2;
    shape.quad(at(-eave, h, overhang, roof, 1), at(eave, h, overhang, roof, 1), at(eave, ridge, 0, roof, 1.15), at(-eave, ridge, 0, roof, 1.15));
    shape.quad(at(eave, h, -overhang, roof, 0.7), at(-eave, h, -overhang, roof, 0.7), at(-eave, ridge, 0, roof, 0.85), at(eave, ridge, 0, roof, 0.85));
    shape.tri(at(eave, h, overhang, wall, 0.8), at(eave, h, -overhang, wall, 0.8), at(eave, ridge, 0, wall, 0.8));
    shape.tri(at(-eave, h, -overhang, wall, 0.75), at(-eave, h, overhang, wall, 0.75), at(-eave, ridge, 0, wall, 0.75));
    if (random() < 0.6) shape.box(x + (w * 0.25) * cos, ground + ridge - 0.1, z - (w * 0.25) * sin, 0.35, size * 0.7, 0.35, yaw, 'stone');
    const floors = Math.max(1, Math.floor(h / 1.25)), columns = Math.max(1, Math.round(w / 1.1));
    for (let f = 0; f < floors; f++) for (let c = 0; c < columns; c++) {
      if (random() < 0.18) continue;
      const u = -w / 2 + (c + 0.5) * w / columns, v = f * h / floors + h / floors * 0.3, ww = 0.5, wh = 0.62, z0 = d / 2 + 0.03, t = random(), role = random() < 0.3 ? 'windowWarm' : 'window';
      shape.quad(at(u - ww / 2, v, z0, role, 1, t), at(u + ww / 2, v, z0, role, 1, t), at(u + ww / 2, v + wh, z0, role, 1, t), at(u - ww / 2, v + wh, z0, role, 1, t));
    }
  }
  const lamps = seeded(5);
  for (let i = 0; i < 60; i++) {
    const [x, z] = riverAt(i / 60), side = i % 2 ? 1 : -1, px = x + side * 4.2 * Math.cos(i), pz = z + side * 4.2 * Math.sin(i), y = terrainHeight(px, pz);
    shape.box(px, y + 0.6, pz, 0.08, 1.2, 0.08, 0, 'rail');
    shape.blob(px, y + 1.3, pz, 0.22, 0.22, 0.22, 'lamp', 'lamp', 1, 2, 6);
    if (lamps() < 0.3) shape.box(px, y + 0.02, pz, 1.2, 0.02, 1.2, 0, 'glint', 0.4);
  }
  const [bx, bz] = riverAt(0.47), bridgeYaw = Math.atan2(bx, bz);
  for (let i = -3; i <= 3; i++) { const cos = Math.cos(bridgeYaw), sin = Math.sin(bridgeYaw); shape.box(bx + i * 1.1 * cos, terrainHeight(bx, bz) + 0.5 + Math.cos(i / 3 * 1.2) * 1.2, bz - i * 1.1 * sin, 1.15, 0.5, 2.2, bridgeYaw, 'stone'); }
}

function buildGarden(shape) {
  const random = seeded(11);
  for (let i = 0; i < 46; i++) {
    const a = random() * Math.PI * 2, r = 12 + random() * 14, x = Math.cos(a) * r, z = Math.sin(a) * r, y = terrainHeight(x, z);
    if (Math.abs(x) < 7.6 && Math.abs(z) < 6.4) continue;
    const tall = 3 + random() * 5, round = random() < 0.45;
    shape.box(x, y + tall * 0.3, z, 0.35, tall * 0.6, 0.35, random() * 3, 'trunk');
    if (round) { shape.blob(x, y + tall * 0.75, z, tall * 0.35, tall * 0.32, tall * 0.35, 'leaf', 'leafLight', 0.6); continue; }
    for (let tier = 0; tier < 3; tier++) {
      const ty = y + tall * (0.35 + tier * 0.22), tr = tall * (0.38 - tier * 0.1), apex = shape.vertex(x, ty + tall * 0.42, z, 'leafLight', 1.05), base = [];
      for (let s = 0; s < 7; s++) base.push(shape.vertex(x + Math.cos(s / 7 * Math.PI * 2) * tr, ty, z + Math.sin(s / 7 * Math.PI * 2) * tr, 'leaf', 0.7 + (s % 2) * 0.12));
      for (let s = 0; s < 7; s++) shape.tri(apex, base[(s + 1) % 7], base[s]);
    }
  }
}

function buildViaduct(shape) {
  const { radius, y, center, span } = TRAIN_LINE, steps = 90;
  for (let i = 0; i < steps; i++) {
    const a = center - span / 2 - 0.2 + (span + 0.4) * i / steps, next = a + (span + 0.4) / steps, mid = (a + next) / 2, length = radius * (next - a) + 0.05;
    const x = Math.cos(mid) * radius, z = Math.sin(mid) * radius, yaw = Math.PI / 2 - mid;
    shape.box(x, y - 0.3, z, length, 0.6, 2.4, yaw, 'stone', 0.9);
    for (const side of [-0.5, 0.5]) shape.box(Math.cos(mid) * (radius + side), y + 0.08, Math.sin(mid) * (radius + side), length, 0.12, 0.1, yaw, 'rail');
    const ground = terrainHeight(x, z);
    if (i % 3 === 0 && ground < y - 1) shape.box(x, (ground + y - 0.6) / 2, z, 1.3, y - 0.6 - ground, 1.9, yaw, 'stone', 0.72);
  }
}

function buildTrain(shape) {
  const { radius, cars, gap } = TRAIN_LINE;
  for (let car = 0; car < cars; car++) {
    const a = -car * gap, cx = Math.cos(a) * radius, cz = Math.sin(a) * radius, yaw = Math.PI / 2 - a, loco = car === 0;
    const cos = Math.cos(yaw), sin = Math.sin(yaw), at = (lx, ly, lz, role) => shape.vertex(cx + lx * cos + lz * sin, ly, cz - lx * sin + lz * cos, role);
    shape.box(cx, 0.95, cz, 4, 1.5, 1.8, yaw, 'train');
    shape.box(cx, 1.8, cz, 4.1, 0.25, 1.95, yaw, 'trainRoof');
    if (loco) { shape.box(cx + 1.2 * cos, 2.3, cz - 1.2 * sin, 0.45, 0.8, 0.45, yaw, 'rail'); continue; }
    for (let w = 0; w < 4; w++) for (const side of [1, -1]) {
      const u = -1.5 + w, lz = side * 0.92;
      shape.quad(at(u - 0.3, 1.05, lz, 'window'), at(u + 0.3, 1.05, lz, 'window'), at(u + 0.3, 1.5, lz, 'window'), at(u - 0.3, 1.5, lz, 'window'));
    }
  }
}

function buildClouds(shape) {
  const random = seeded(19);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2 + random() * 0.3, r = 115 + random() * 40, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 22 + random() * 26;
    for (let puff = 0; puff < 5; puff++) { const s = 7 + random() * 7; shape.blob(x + (puff - 2) * s * 0.9 * -Math.sin(a), y + Math.sin(puff) * 1.6, z + (puff - 2) * s * 0.9 * Math.cos(a), s, s * 0.45, s, 'cloudShade', 'cloud', 0.75, 4, 9); }
  }
}

function buildLantern(shape) {
  shape.box(0, 0, 0, 0.55, 0.75, 0.55, 0, 'lantern', 1);
  shape.box(0, -0.42, 0, 0.3, 0.1, 0.3, 0, 'lamp', 1.2);
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
  const fog = ['lamp', 'lantern', 'window', 'windowWarm', 'glint', 'star', 'moon'].includes(role) ? shape.fogs[i] * 0.45 : shape.fogs[i];
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
export const lanternsAloft = (theme, progress) => theme === 'day' ? 0 : Math.round(2 + progress * (LANTERNS - 2));
export const moonRise = progress => 0.14 + progress * 0.36;

export function createSeatWorld(scene, parent) {
  const root = new TransformNode('seat-world', scene); root.parent = parent; root.setEnabled(false);
  const unlit = new StandardMaterial('seat-world-sky', scene); unlit.disableLighting = true; unlit.diffuseColor = Color3.Black(); unlit.emissiveColor = Color3.White(); unlit.specularColor = Color3.Black(); unlit.backFaceCulling = false;
  const lit = new StandardMaterial('seat-world-shell', scene); lit.diffuseColor = Color3.White(); lit.specularColor.set(0.03, 0.03, 0.03);
  const shapes = {};
  const make = (name, build, material = unlit, parentNode = root) => { const shape = createShape(); build(shape); shapes[name] = shape; return toMesh(shape, `seat-world-${name}`, scene, parentNode, material); };
  const lanternMatrices = new Float32Array(LANTERNS * 16);
  let sky = null, land, cloudRoot, clouds, trainRoot, train, moon, shooting, lanterns;
  function build() {
    sky = make('sky', buildSky); land = make('land', shape => { buildLand(shape); buildVillage(shape); buildGarden(shape); buildViaduct(shape); });
    cloudRoot = new TransformNode('seat-world-cloud-drift', scene); cloudRoot.parent = root;
    clouds = make('clouds', buildClouds, unlit, cloudRoot);
    trainRoot = new TransformNode('seat-world-train-run', scene); trainRoot.parent = root; trainRoot.position.y = TRAIN_LINE.y;
    train = make('train', buildTrain, unlit, trainRoot);
    moon = make('moon', buildMoon); shooting = make('shooting', buildShootingStar); lanterns = make('lanterns', buildLantern);
    moon.metadata.glow = lanterns.metadata.glow = true;
    lanterns.thinInstanceSetBuffer('matrix', lanternMatrices, 16, false); lanterns.alwaysSelectAsActiveMesh = true;
  }
  let shell = null, shellKey = '', theme = 'dusk', progress = 0, colorKey = '', seconds = 0;
  const glow = { x: 0, z: -1, lit: 0, stars: 1 };
  const temp = new Color3(), matrix = new Matrix(), scale = new Vector3(1, 1, 1), spot = new Vector3(), turn = new Quaternion();
  const lanternStarts = Array.from({ length: LANTERNS }, (_, i) => { const random = seeded(101 + i); const a = -Math.PI / 2 + (random() - 0.5) * 1.6, r = 36 + random() * 45; return { x: Math.cos(a) * r, z: Math.sin(a) * r, phase: random(), sway: random() * 6 }; });

  function paint(mesh, palette, only = null) {
    const shape = mesh.metadata.shape, colors = mesh.getVerticesData('color');
    for (let i = 0; i < shape.roles.length; i++) {
      if (only && !only.has(shape.roles[i])) continue;
      vistaColor(palette, shape, i, temp, glow); colors[i * 4] = temp.r; colors[i * 4 + 1] = temp.g; colors[i * 4 + 2] = temp.b;
    }
    mesh.updateVerticesData('color', colors);
  }
  function placeMoon() {
    const rise = moonRise(progress), heading = -Math.PI / 2 - 0.55, d = 165;
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
    for (const mesh of [sky, land, clouds, train, moon, shooting, lanterns]) paint(mesh, palette);
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
  function placeLanterns(reduced) {
    const aloft = lanternsAloft(theme, progress);
    for (let i = 0; i < LANTERNS; i++) {
      const start = lanternStarts[i], life = reduced ? start.phase : (seconds / LANTERN_SECONDS + start.phase) % 1;
      const rise = i < aloft ? life : -1, y = -16 + rise * 70;
      spot.set(start.x + Math.sin(life * 6 + start.sway) * 2.5, rise < 0 ? -400 : y, start.z + Math.cos(life * 5 + start.sway) * 2.5);
      scale.setAll(rise < 0 ? 0 : 1.4 - life * 0.5);
      Quaternion.RotationYawPitchRollToRef(life * 2 + start.sway, 0, 0, turn);
      Matrix.ComposeToRef(scale, turn, spot, matrix); matrix.copyToArray(lanternMatrices, i * 16);
    }
    lanterns.thinInstanceBufferUpdated('matrix');
  }
  function animate(delta, reduced) {
    if (!root.isEnabled(false)) return;
    seconds += reduced ? 0 : delta;
    cloudRoot.rotation.y = seconds * 0.004;
    const run = (seconds % TRAIN_SECONDS) / TRAIN_SECONDS * 2;
    trainRoot.rotation.y = -(TRAIN_LINE.center - TRAIN_LINE.span / 2 + (TRAIN_LINE.span + TRAIN_LINE.cars * TRAIN_LINE.gap) * Math.min(1, run));
    train.setEnabled(run < 1 && !reduced);
    const shot = (seconds % SHOOTING_SECONDS) / SHOOTING_SECONDS, streak = theme === 'dusk' && !reduced && shot < 0.05;
    shooting.setEnabled(streak);
    if (streak) { const n = Math.floor(seconds / SHOOTING_SECONDS), a = -Math.PI / 2 + Math.sin(n * 2.3) * 0.9; shooting.position.set(Math.cos(a) * 150 + shot * 400 * Math.sin(a), 70 + Math.cos(n) * 18 - shot * 160, Math.sin(a) * 150 - shot * 400 * Math.cos(a)); shooting.lookAt(Vector3.Zero()); shooting.rotation.z = -0.45; }
    placeLanterns(reduced);
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
    setEnabled(enabled) { if (enabled && !sky) build(); root.setEnabled(enabled); if (enabled) { recolor(); placeLanterns(true); } },
    animate,
    dispose() { root.dispose(false, false); unlit.dispose(); lit.dispose(); },
  };
}
