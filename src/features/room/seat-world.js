import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { heightAt } from '../../core/world-terrain.js';

export const VISTA_THEMES = Object.freeze({
  dusk: {
    zenith: '#74868c', high: '#94a49c', horizon: '#c4c2a8', glow: '#fcbe74', glowStrength: 1, haze: '#8a96a0', hazeSun: '#b0a294', mist: '#a4a8a0', mistStrength: 0.4, below: '#5a5a4e',
    far: '#5f7080', mid: '#5c6670', valley: '#6c8048', field: '#7a8a58', cliff: '#6a6670', grass: '#768a46', meadow: '#909c4a', meadowWarm: '#c8964c', petal: '#b0a088',
    trunk: '#46423a', leaf: '#3e5238', leafLight: '#7a8e52', walls: ['#d8b890', '#c8a088', '#b0a8a0', '#e0c49a'], roofs: ['#6a3f3a', '#4a3a3a', '#7a4a3a', '#3f4a5a'],
    stone: '#7a7672', water: '#6a7a88', glint: '#ffe0b0', window: '#ffc978', windowWarm: '#ffa860', windowDark: '#3a3c40', lamp: '#ffdca0',
    star: '#fff4d8', moon: '#ffe6b4', cloud: '#ffe2b0', cloudShade: '#8c8a96', cloudFog: 0.14,
    ruin: '#7a7670', moss: '#5a6440', bird: '#2a2a2c', spirit: '#d8ffb8', snow: '#f0d8c0',
    light: 0.35, night: { zenith: '#141c2a', high: '#26323c', horizon: '#7a6450', glow: '#c89a70', haze: '#3c4650', hazeSun: '#6a5a4c', mist: '#3a424a', cloud: '#4c5258', cloudShade: '#2a3038' },
  },
  day: {
    zenith: '#8fb3c4', high: '#a5c2c8', horizon: '#cfdcd2', glow: '#f4f2dc', glowStrength: 0.6, haze: '#a8c2c6', hazeSun: '#dfe8d0', mist: '#c8dcc4', mistStrength: 0.38, below: '#a0b8b0',
    far: '#6a8e9c', mid: '#6a8a84', valley: '#80b050', field: '#94b862', cliff: '#7c8f96', grass: '#7eb24d', meadow: '#8cbf57', meadowWarm: '#c8cf5a', petal: '#fffaf0',
    trunk: '#5c6440', leaf: '#4a7436', leafLight: '#86b448', walls: ['#efe6cf', '#e4d4b4', '#d8d2c4', '#f0dcb0'], roofs: ['#9c5a3c', '#6d4a36', '#b86b44', '#4f6a7a'],
    stone: '#a7a698', water: '#6aa8c4', glint: '#f4fbff', window: '#44566a', windowWarm: '#44566a', windowDark: '#44566a', lamp: '#f4e2b8',
    star: '#a5c2c8', moon: '#fffbea', cloud: '#f6f2e0', cloudShade: '#b2c6ce', cloudFog: 0.16,
    ruin: '#c4b08e', moss: '#7fa848', bird: '#3a3a44', spirit: '#f4c64e', snow: '#f4f6fa',
    aerial: 1.12, light: 0, night: null,
  },
  rain: {
    zenith: '#3e443c', high: '#474d42', horizon: '#555c4c', glow: '#6a6e5e', glowStrength: 0.15, haze: '#555c4c', hazeSun: '#6a6e5e', mist: '#5c6252', mistStrength: 0.55, below: '#4a5044',
    far: '#4c5446', mid: '#4e5648', valley: '#4e5c3a', field: '#535c45', cliff: '#575c56', grass: '#515f3b', meadow: '#56663c', meadowWarm: '#787040', petal: '#a8aca0',
    trunk: '#3a3c32', leaf: '#3d4c2d', leafLight: '#4a5a36', walls: ['#a8a08e', '#9a8c80', '#909290', '#aca284'], roofs: ['#5a4440', '#444c54', '#504a54', '#6a5040'],
    stone: '#666a62', water: '#4e5a58', glint: '#a8aca0', window: '#ffc27a', windowWarm: '#ffaa66', windowDark: '#3a3e38', lamp: '#ffd49a',
    star: '#474d42', moon: '#a8aca0', cloud: '#5a6052', cloudShade: '#3e443a', cloudFog: 0.6,
    ruin: '#62665e', moss: '#4a5a3c', bird: '#262a26', spirit: '#c8e0c8', snow: '#a8b0a8',
    aerial: 1.1, light: 0.55, night: null,
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
export const SUN_RAY_STRENGTH = Object.freeze({ day: 1, dusk: 0, rain: 0.35 });
const SUN_RAYS = [[-44, 72, 10, 80], [-20, 84, 7, 90], [2, 66, 11, 75], [22, 92, 8, 95], [-64, 98, 12, 90], [40, 78, 6, 70]];
const SPIRITS = 34, SPIRIT_SECONDS = 40, SHOOTING_SECONDS = 23;
const ahead = (across, distance) => [across, -distance];
const bearing = (x, z) => Math.atan2(x, -z);

const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hex = value => Color3.FromHexString(value);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const aerial = distance => Math.min(1, 1 - Math.exp(-Math.max(0, distance - 12) / 72));
export const valleyFloor = distance => -8 * smooth(8.5, 20, distance) + 4.5 * smooth(30, 150, distance);
export const valleyMist = (x, y, z) => { const d = Math.hypot(x, z); return Math.exp(-Math.max(0, y - valleyFloor(d) - 1) * 0.3) * smooth(14, 60, d) * (1 - smooth(112, 150, d)); };

function createShape() {
  const shape = { positions: [], indices: [], roles: [], shades: [], fogs: [], mists: [], thresholds: [] };
  shape.vertex = (x, y, z, role, shade = 1, threshold = 0) => {
    shape.positions.push(x, y, z); shape.roles.push(role); shape.shades.push(shade); shape.thresholds.push(threshold);
    shape.fogs.push(aerial(Math.hypot(x, z))); shape.mists.push(valleyMist(x, y, z)); return shape.roles.length - 1;
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
  const basin = 4.5 * smooth(30, 150, r);
  const rolling = (Math.sin(x * 0.07) * Math.cos(z * 0.06) * 1.4 + Math.sin(x * 0.029 + 1) * Math.cos(z * 0.034 + 2) * 2.6 + Math.sin(x * 0.16 + z * 0.12) * 0.5) * smooth(26, 45, r);
  const crest = (k, phase, power) => (1 - Math.abs(Math.sin(a * k + phase))) ** power;
  const ridge = smooth(92, 112, r) * (1 - smooth(122, 140, r)) * (1.5 + crest(7, 1.1, 2) * 4 + crest(17, 0.4, 2) * 1.5);
  const ranges = smooth(136, 166, r) * (3 + crest(5, 0.3, 1.4) * 9 + crest(13, 2, 2) * 5 + crest(29, 1, 2.5) * 2 + Math.max(0, Math.sin(a * 3 + 0.4)) * 9);
  return cliff + basin + rolling + ridge + ranges;
}

export const SNOW_LINE = 10.5;
const SUN_TOWARD = [-0.3, 0.81, -0.49];
function sunFacing(x, z) {
  const step = 1.5, dx = (terrainHeight(x + step, z) - terrainHeight(x - step, z)) / (2 * step), dz = (terrainHeight(x, z + step) - terrainHeight(x, z - step)) / (2 * step);
  const length = Math.hypot(dx, 1, dz), lit = (-dx * SUN_TOWARD[0] + SUN_TOWARD[1] - dz * SUN_TOWARD[2]) / length;
  return 0.64 + smooth(0.48, 0.64, lit) * 0.5;
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
  const rings = [0, 6, 8.5, 10, 12, 14, 16.5, 19, 22, 26, 31, 36, 42, 50, 60, 72, 86, 96, 104, 112, 120, 128, 136, 142, 148, 154, 160, 166, 172], segments = 240, start = shape.roles.length;
  for (const r of rings) for (let s = 0; s < segments; s++) {
    const a = s / segments * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, y = terrainHeight(x, z) - 0.06;
    const snowy = r > 140 && y > SNOW_LINE;
    const role = r < 9 ? 'meadow' : r < 22 ? (y > -2 ? 'grass' : 'cliff') : r < 112 ? ((s + rings.indexOf(r)) % 3 ? 'valley' : 'field') : snowy ? 'snow' : r < 142 ? 'mid' : 'far';
    const id = shape.vertex(x, y, z, role, r > 112 ? sunFacing(x, z) : 0.86 + ((s * 7 + r) % 5) * 0.04);
    if (r > 112) shape.fogs[id] *= snowy ? 0.5 : 0.78;
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
    for (const [side, low, high] of [[1, 0.92, 1.22], [-1, 0.58, 0.76]]) {
      const slope = (t, lift = 0) => [h + (ridge - h) * t + lift, side * overhang * (1 - t)];
      shape.quad(at(-eave * side, h, side * overhang, roof, low), at(eave * side, h, side * overhang, roof, low), at(eave * side, ridge, 0, roof, high), at(-eave * side, ridge, 0, roof, high));
      for (const t of [0.18, 0.38, 0.58, 0.78]) {
        const [y0, z0] = slope(t, 0.02), [y1, z1] = slope(t + 0.06, 0.02);
        shape.quad(at(-eave * side, y0, z0, roof, low * 0.8), at(eave * side, y0, z0, roof, low * 0.8), at(eave * side, y1, z1, roof, low * 0.8), at(-eave * side, y1, z1, roof, low * 0.8));
      }
      shape.quad(at(-eave * side, h - 0.22, side * overhang, roof, 0.42), at(eave * side, h - 0.22, side * overhang, roof, 0.42), at(eave * side, h, side * overhang, roof, 0.42), at(-eave * side, h, side * overhang, roof, 0.42));
    }
    shape.box(x, ground + ridge, z, w + 0.7, 0.18, 0.26, yaw, roof, 0.5);
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

function shardTop(shape, x, y, z, radius, rise) {
  const tip = shape.vertex(x + radius * 0.4, y + rise, z, 'ruin', 1.05);
  const foot = [0, 1, 2].map(k => { const a = k / 3 * Math.PI * 2 + 0.3; return shape.vertex(x + Math.cos(a) * radius, y, z + Math.sin(a) * radius, 'ruin', 0.82 + k * 0.08); });
  for (let k = 0; k < 3; k++) shape.tri(tip, foot[k], foot[(k + 1) % 3]);
}

function buildRuins(shape) {
  const random = seeded(71);
  for (let site = 0; site < 12; site++) {
    const across = -8 + (random() - 0.5) * 60, distance = 26 + random() * 34, [x, z] = ahead(across, distance);
    if (nearRiver(x, z) < 4) continue;
    const g = terrainHeight(x, z) - 0.2, yaw = random() * Math.PI, cos = Math.cos(yaw), sin = Math.sin(yaw);
    if (site % 4 === 0) {
      shape.box(x + 2 * cos, g + 1.5, z - 2 * sin, 1.2, 3.4, 1.2, yaw, 'ruin'); shape.box(x + 2 * cos, g + 3.25, z - 2 * sin, 1.35, 0.2, 1.35, yaw, 'moss');
      shape.box(x - 2 * cos, g + 0.9, z + 2 * sin, 1.2, 2.2, 1.2, yaw, 'ruin', 0.92); shardTop(shape, x - 2 * cos, g + 2, z + 2 * sin, 0.5, 0.9);
      shape.box(x + 0.6 * cos, g + 3.6, z - 0.6 * sin, 3.6, 0.8, 1.1, yaw, 'ruin', 1.05); shape.box(x + 0.6 * cos, g + 4.05, z - 0.6 * sin, 3.6, 0.15, 1.1, yaw, 'moss');
    }
    for (let k = 0; k < 2 + Math.floor(random() * 3); k++) {
      const px = x + (random() - 0.5) * 6, pz = z + (random() - 0.5) * 6, w = 1 + random() * 0.25, h = 0.7 + random() * 1.4, py = terrainHeight(px, pz) - 0.45;
      const turn = yaw + random(), tone = 0.9 + random() * 0.15;
      for (const offset of [0, Math.PI / 4]) shape.box(px, py + h / 2, pz, w, h, w, turn + offset, 'ruin', tone - offset * 0.08);
      shape.box(px, py + 0.4, pz, w + 0.3, 0.24, w + 0.3, turn, 'ruin', tone * 0.85);
      shape.box(px + 0.12, py + h + 0.18, pz - 0.08, w * 0.55, 0.36, w * 0.5, turn + 0.4, 'ruin', tone * 1.05); shape.box(px - 0.1, py + h + 0.04, pz + 0.1, w * 1.05, 0.22, w * 1.0, turn, 'moss'); shape.box(px, py + 0.55, pz, w + 0.4, 0.12, w + 0.4, turn, 'moss', 0.9);
      shardTop(shape, px + 0.15, py + h, pz - 0.1, w * 0.4, 0.35 + random() * 0.4);
      const drape = Math.max(0.7, h * (0.45 + random() * 0.35));
      shape.box(px + Math.sin(turn) * w * 0.52, py + h - drape / 2, pz + Math.cos(turn) * w * 0.52, 0.52, drape, 0.08, turn, 'moss', 0.85);
    }
    const fallen = yaw + 0.7, fx = x + Math.cos(yaw) * 1.6, fz = z - Math.sin(yaw) * 1.6, fg = terrainHeight(fx, fz);
    shape.box(fx, fg + 0.25, fz, 0.75, 0.75, 3.2, fallen, 'ruin', 0.85); shape.box(fx, fg + 0.66, fz, 0.5, 0.08, 2.4, fallen, 'moss');
    shape.box(x, g + 0.2, z, 4, 0.4, 3, yaw, 'ruin', 0.8);
  }
}

export const FOREST = Object.freeze({ trees: 620 });
export const forestField = (x, z) => Math.sin(x * 0.07 + 0.5) * Math.sin(z * 0.06 - 1.2) + Math.sin(x * 0.023 - z * 0.019 + 2) * 0.8 + Math.sin(x * 0.19 + z * 0.17) * 0.25;

function roundTree(shape, x, z, tall, random, clumps = 5, rings = 5, segments = 9) {
  const y = terrainHeight(x, z);
  shape.box(x, y + tall * 0.25, z, 0.3 + tall * 0.05, tall * 0.5, 0.3 + tall * 0.05, random() * 3, 'trunk');
  for (let clump = 0; clump < clumps; clump++) {
    const a = random() * Math.PI * 2, off = clump ? tall * (0.16 + random() * 0.08) : 0, size = tall * (clump ? 0.22 + random() * 0.06 : 0.32);
    const cx = x + Math.cos(a) * off, cy = y + tall * (clump ? 0.58 + random() * 0.22 : 0.7), cz = z + Math.sin(a) * off, start = shape.roles.length;
    shape.blob(cx, cy, cz, size, size * 0.85, size, 'leaf', 'leafLight', 0.5, rings, segments);
    for (let i = start; i < shape.roles.length; i++) {
      const nx = shape.positions[i * 3] - cx, ny = shape.positions[i * 3 + 1] - cy, nz = shape.positions[i * 3 + 2] - cz;
      shape.shades[i] *= 0.8 + 0.4 * Math.max(0, (nx * SUN_TOWARD[0] + ny * SUN_TOWARD[1] + nz * SUN_TOWARD[2]) / Math.hypot(nx, ny, nz));
    }
  }
}

function buildForest(shape) {
  const random = seeded(11);
  for (let i = 0; i < 40; i++) {
    const a = random() * Math.PI * 2, r = 12 + random() * 14, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if ((Math.abs(x) < 7.6 && Math.abs(z) < 6.4) || (bearing(x, z) > -0.9 && bearing(x, z) < 0.35)) continue;
    roundTree(shape, x, z, 3.5 + random() * 4.5, random);
  }
  for (let placed = 0, tries = 0; placed < FOREST.trees && tries < FOREST.trees * 12; tries++) {
    const a = (random() - 0.5) * 3.3, r = 24 + random() ** 0.8 * 112, x = Math.sin(a) * r, z = -Math.cos(a) * r;
    if (forestField(x, z) < 0.15 || nearRiver(x, z) < 4) continue;
    const tall = 3.2 + random() * 2.6;
    if (r < 55) roundTree(shape, x, z, tall, random, 3, 4, 8);
    else if (r < 90) roundTree(shape, x, z, tall, random, 2, 3, 7);
    else roundTree(shape, x, z, tall * 1.1, random, 1, 3, 6);
    placed++;
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

export const CLOUD_WAIST = -0.3;
export const CLOUD_BANKS = Object.freeze([
  { count: 7, distance: [160, 170], height: [16, 24], width: [30, 44], tall: [14, 20], kind: 0 },
  { count: 9, distance: [138, 158], height: [34, 50], width: [26, 38], tall: [20, 28], kind: 0 },
  { count: 5, distance: [150, 165], height: [62, 84], width: [56, 80], tall: [6, 9], kind: 1 },
]);
function buildClouds(shape) {
  const random = seeded(19);
  shape.uvs = []; shape.seeds = [];
  CLOUD_BANKS.forEach(({ count, distance, height, width, tall, kind }, bank) => {
    for (let k = 0; k < count; k++) {
      const a = -1.45 + (k + 0.2 + random() * 0.6) / count * 2.7 + bank * 0.17;
      const span = (range, t) => range[0] + (range[1] - range[0]) * t, r = span(distance, random()), y = span(height, random()), w = span(width, random()) / 2, h = span(tall, random()) / 2, seed = random() * 97;
      const x = Math.sin(a) * r, z = -Math.cos(a) * r, sx = Math.cos(a), sz = Math.sin(a);
      const [base, waist, crown] = [-1, CLOUD_WAIST, 1].map(v => [-1, 1].map(u => {
        const id = shape.vertex(x + sx * w * u, y + h * v, z + sz * w * u, v === -1 ? 'cloudShade' : 'cloud', 1, v === -1 ? 0 : 1);
        shape.uvs.push(u * w / h, v); shape.seeds.push(kind ? -seed : seed, w / h); return id;
      }));
      shape.quad(base[0], base[1], waist[1], waist[0]); shape.quad(waist[0], waist[1], crown[1], crown[0]);
    }
  });
}

export const SPIRIT_MOTE = Object.freeze({ rim: 12, core: 0.3, halo: 0.4, wing: 12 });
function buildSpirit(shape) {
  shape.fades = []; shape.wings = [];
  const point = (x, y, z, fade, wing, shade) => { shape.fades.push(fade); shape.wings.push(wing); return shape.vertex(x, y, z, 'spirit', shade); };
  const ring = (radius, fade, shade) => Array.from({ length: SPIRIT_MOTE.rim }, (_, s) => { const a = s / SPIRIT_MOTE.rim * Math.PI * 2; return point(Math.cos(a) * radius, Math.sin(a) * radius, 0, fade, false, shade); });
  const center = point(0, 0, 0, 1, false, 1.25), core = ring(SPIRIT_MOTE.core, SPIRIT_MOTE.halo, 1.1), edge = ring(1, 0, 1);
  for (let s = 0; s < SPIRIT_MOTE.rim; s++) { const next = (s + 1) % SPIRIT_MOTE.rim; shape.tri(center, core[s], core[next]); shape.quad(core[s], edge[s], edge[next], core[next]); }
  for (const side of [-1, 1]) {
    const hinge = point(0, 0, 0, 1, true, 0.8);
    const outline = Array.from({ length: SPIRIT_MOTE.wing + 1 }, (_, s) => {
      const a = s / SPIRIT_MOTE.wing * Math.PI, reach = (0.55 + 0.45 * Math.abs(Math.sin(a * 2)) ** 0.7) * (a < Math.PI / 2 ? 1 : 0.8);
      const out = Math.sin(a) * reach;
      return point(side * out, out, Math.cos(a) * reach * 0.7, 1, true, 1.05);
    });
    for (let s = 0; s < SPIRIT_MOTE.wing; s++) shape.tri(hinge, outline[s], outline[s + 1]);
  }
}

export const MOON_FACE = Object.freeze({ radius: 6.5, center: 1.05, limb: 0.92 });
function buildMoon(shape) {
  const disc = (x, y) => MOON_FACE.center - (MOON_FACE.center - MOON_FACE.limb) * Math.hypot(x, y) / MOON_FACE.radius;
  const center = shape.vertex(0, 0, 0, 'moon', MOON_FACE.center);
  const ring = []; for (let s = 0; s < 28; s++) { const a = s / 28 * Math.PI * 2; ring.push(shape.vertex(Math.cos(a) * MOON_FACE.radius, Math.sin(a) * MOON_FACE.radius, 0, 'moon', MOON_FACE.limb)); }
  for (let s = 0; s < 28; s++) shape.tri(center, ring[s], ring[(s + 1) % 28]);
  for (const [x, y, r] of [[-1.8, 1.4, 1.7], [2, -1.2, 2], [-0.6, -2.8, 1.3]]) {
    const c = shape.vertex(x, y, 0.05, 'moon', disc(x, y) - 0.08), rim = [];
    for (let s = 0; s < 14; s++) { const a = s / 14 * Math.PI * 2, wobble = 1 + 0.2 * Math.sin(a * 3 + x), px = x + Math.cos(a) * r * wobble, py = y + Math.sin(a) * r * wobble * 0.85; rim.push(shape.vertex(px, py, 0.05, 'moon', disc(px, py))); }
    for (let s = 0; s < 14; s++) shape.tri(c, rim[s], rim[(s + 1) % 14]);
  }
}

function buildShootingStar(shape) {
  shape.quad(shape.vertex(0, -0.12, 0, 'star', 1), shape.vertex(0, 0.12, 0, 'star', 1), shape.vertex(-14, 0.02, 0, 'haze', 0.6), shape.vertex(-14, -0.02, 0, 'haze', 0.6));
}

export const SEAT_DRAPE = Object.freeze({ top: 5, tie: 2.3, hem: 1.25, back: 4.42, folds: 4, across: 28, rows: 30 });
function drapePanel(shape, side) {
  const W = SEAT_WINDOW, D = SEAT_DRAPE, outer = W.x + side * (W.width / 2 + 0.78), start = shape.roles.length;
  const innerAt = y => {
    if (y >= D.tie) return outer - side * (0.24 + 0.44 * (1 - Math.pow((D.top - y) / (D.top - D.tie), 1.6)));
    return outer - side * (0.24 + 0.14 * Math.sqrt((D.tie - y) / (D.tie - D.hem)));
  };
  for (let row = 0; row <= D.rows; row++) {
    const y = D.top - (D.top - D.hem) * row / D.rows, inner = innerAt(y), width = Math.abs(outer - inner);
    const gather = 1 - (width - 0.24) / 0.44, depth = 0.03 + 0.06 * gather + 0.05 * Math.exp(-(((y - D.tie) / 0.35) ** 2)), hem = y < D.hem + 0.09;
    const [from, to] = side < 0 ? [outer, inner] : [inner, outer];
    for (let i = 0; i <= D.across; i++) {
      const u = i / D.across, fold = 0.5 + 0.5 * Math.cos(u * Math.PI * 2 * D.folds);
      const z = D.back - depth * fold - 0.025 * Math.sin(u * Math.PI) - (hem ? 0.018 : 0);
      shape.vertex(from + (to - from) * u, y - (hem ? 0.012 * fold : 0), z, hem || fold < 0.22 ? 'curtainShade' : 'curtain', 0.8 + 0.2 * fold);
    }
  }
  const at = (row, i) => start + row * (D.across + 1) + i;
  for (let row = 0; row < D.rows; row++) for (let i = 0; i < D.across; i++) shape.quad(at(row, i + 1), at(row, i), at(row + 1, i), at(row + 1, i + 1));
  const tieIn = innerAt(D.tie), middle = (outer + tieIn) / 2, half = Math.abs(outer - tieIn) / 2 + 0.025, band = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI * k / 16;
    for (const dy of [-0.035, 0.035]) band.push(shape.vertex(middle + Math.cos(a) * half, D.tie + dy, D.back + 0.01 - Math.sin(a) * (0.17), 'brass', 0.9 + 0.2 * Math.sin(a)));
  }
  for (let k = 0; k < 16; k++) shape.quad(band[k * 2 + 1], band[k * 2 + 3], band[k * 2 + 2], band[k * 2]);
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
  for (const [y, h] of [[0.275, 0.16], [1.36, 0.11]]) { wall(0.08, y, 4.5, 12.1, h, 0.16, 'trim'); wall(5.9, y, 0, 0.16, h, 9.1, 'trim'); }
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
  for (const side of [-1, 1]) drapePanel(shape, side);
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
const CLOUD_VERTEX = `precision highp float;
attribute vec3 position; attribute vec4 color; attribute vec2 uv, uv2; uniform mat4 world, viewProjection;
varying vec3 vColor; varying vec2 vUv, vSeed;
void main() { vColor = color.rgb; vUv = uv; vSeed = uv2; gl_Position = viewProjection * world * vec4(position, 1.); }`;
const CLOUD_FRAGMENT = `precision highp float;
varying vec3 vColor; varying vec2 vUv, vSeed; uniform float time;
${CLOUD_SHADE}
float fbm(vec2 q) { return noise(q) * .5 + noise(q * 2.1 + 1.7) * .3 + noise(q * 4.3 + 3.1) * .2; }
void main() {
  vec2 p = vUv;
  float n = fbm(p * vec2(2.4, 3.) + vSeed.x * 9.7 + vec2(time * .01, 0.)), a;
  if (vSeed.x < 0.) {
    float streak = fbm(vec2(p.x * 1.6 + vSeed.x, p.y * 7.) + vec2(time * .006, 0.));
    a = smoothstep(.45, .75, streak) * (1. - smoothstep(.55, 1., abs(p.x) / vSeed.y)) * (1. - smoothstep(.2, 1., abs(p.y))) * .55;
  } else {
    float lump = -1.;
    for (int i = 0; i < 6; i++) {
      float f = float(i) / 5., h = hash(vec2(vSeed.x, float(i))), k = hash(vec2(float(i), vSeed.x + 3.)), middle = 1. - abs(f - .5) * 2.;
      vec2 c = vec2((f - .5) * 2. * (vSeed.y - .45), -.55 + middle * (.45 + k * .3));
      float radius = .32 + middle * .28 + h * .12;
      lump = max(lump, 1. - length(p - c) / radius);
    }
    float body = lump + (n - .5) * .5, base = smoothstep(-.82, -.6, p.y + (n - .5) * .1);
    a = smoothstep(0., .28, body) * base * .97;
  }
  vec3 c = vColor * (.93 + .14 * smoothstep(-.4, .7, p.y + (n - .5) * .6));
  gl_FragColor = vec4(c * a, a);
}`;
const LAND_FRAGMENT = `precision highp float;
varying vec3 vColor; varying float vCloud;
void main() { gl_FragColor = vec4(vColor * (1. - vCloud * .4), 1.); }`;
const SKY_EFFECT_VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv, uv2; uniform mat4 world, viewProjection; uniform float rain; varying vec2 vUv, vKind;
void main() { vUv = uv; vKind = uv2; gl_Position = uv2.y > 1.5 && rain < .01 ? vec4(0.) : viewProjection * world * vec4(position, 1.); }`;
const SKY_EFFECT_FRAGMENT = `precision highp float;
varying vec2 vUv, vKind; uniform float time, rays, rain; uniform vec3 tint, haze;
${CLOUD_SHADE}
void main() {
  if (vKind.y > 1.5) {
    float column = vUv.x * vKind.x + vUv.y * vKind.x * .012, h = hash(vec2(floor(column), vKind.x));
    float fall = fract(vUv.y * (5. + h * 4.) + time * (1.4 + h * .8) + h * 9.), dash = smoothstep(0., .06, fall) * (1. - smoothstep(.06, .3, fall));
    float thin = 1. - smoothstep(.04, .12, abs(fract(column) - .5)), mist = (1. - smoothstep(0., .45, vUv.y)) * .35 * (1. - smoothstep(.8, 1., abs(vUv.x * 2. - 1.)));
    float a = (dash * thin * step(.35, h) * .45 + mist) * (vKind.y - 2.) * rain;
    gl_FragColor = vec4(mix(haze, vec3(1.), .3) * a, a);
    return;
  }
  float across = 1. - smoothstep(0., 1., abs(vUv.x)), along = smoothstep(0., .08, vUv.y) * (1. - smoothstep(.4, .95, vUv.y));
  float breathe = .7 + .3 * sin(time * .23 + vUv.y * 2. + vKind.x);
  float a = across * across * along * breathe * rays * .32;
  gl_FragColor = vec4(tint * a, a);
}`;
export const SUN_POINT = Object.freeze([-50, 134, -81]);
export function sunRayShape() {
  const positions = [], uvs = [], uv2s = [], indices = [];
  SUN_RAYS.forEach(([across, distance, width, length], i) => {
    const [x, z] = ahead(across, distance), y = terrainHeight(x, z), up = new Vector3(SUN_POINT[0] - x, SUN_POINT[1] - y, SUN_POINT[2] - z).normalize(), side = up.cross(new Vector3(x, 0, z)).normalize();
    for (const [u, v] of [[-0.55, 0], [0.55, 0], [1, 1], [-1, 1]]) positions.push(x + up.x * length * v + side.x * width * u, y + up.y * length * v + side.y * width * u, z + up.z * length * v + side.z * width * u), uvs.push(Math.sign(u), v), uv2s.push(i * 1.7, 0);
    indices.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  return { positions, uvs, uvs2: uv2s, indices };
}
export const RAIN_SHEETS = Object.freeze([{ radius: 6.5, arc: 1.1, low: -1, high: 12, columns: 90, alpha: 0.4 }, { radius: 17, arc: 1.3, low: -2, high: 24, columns: 260, alpha: 0.3 }, { radius: 42, arc: 1.3, low: -3, high: 40, columns: 620, alpha: 0.24 }]);
const RAIN_CENTER = [0, -3.5], RAIN_STEPS = 10;
export function rainShape() {
  const positions = [], uvs = [], uv2s = [], indices = [];
  for (const { radius, arc, low, high, columns, alpha } of RAIN_SHEETS) {
    const start = positions.length / 3;
    for (let k = 0; k <= RAIN_STEPS; k++) {
      const u = k / RAIN_STEPS, a = (u * 2 - 1) * arc, x = RAIN_CENTER[0] + Math.sin(a) * radius, z = RAIN_CENTER[1] - Math.cos(a) * radius;
      for (const [y, v] of [[low, 0], [high, 1]]) positions.push(x, y, z), uvs.push(u, v), uv2s.push(columns, 2 + alpha);
      if (k) indices.push(start + k * 2 - 2, start + k * 2 - 1, start + k * 2 + 1, start + k * 2 - 2, start + k * 2 + 1, start + k * 2);
    }
  }
  return { positions, uvs, uvs2: uv2s, indices };
}
function skyEffectShape() {
  const parts = [sunRayShape(), rainShape()], merged = { positions: [], uvs: [], uvs2: [], indices: [] };
  for (const part of parts) {
    const offset = merged.positions.length / 3;
    merged.positions.push(...part.positions); merged.uvs.push(...part.uvs); merged.uvs2.push(...part.uvs2); merged.indices.push(...part.indices.map(i => i + offset));
  }
  return merged;
}
const GRASS_VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv; uniform mat4 world, viewProjection; uniform float time;
uniform float shadow; uniform vec3 petal; varying float vTip, vFog, vGust, vShade, vCloud, vWarm, vDeep, vFlower; varying vec3 vPetal;
${CLOUD_SHADE}
void main() {
  vec4 p = world * vec4(position, 1.);
  vCloud = cloudShade(p.xz, time) * shadow;
  vWarm = smoothstep(.38, .62, noise(position.xz * .13 + 11.)); vDeep = smoothstep(.55, .85, noise(position.xz * .09 + 37.)) * (1. - vWarm);
  float wave = sin(p.x * .045 + p.z * .03 - time * .9) * .5 + .5 + sin(p.x * .11 - p.z * .07 - time * 1.7) * .15;
  float gust = smoothstep(.55, 1., wave), sway = sin(time * 2.1 + p.x * .35 + p.z * .25 + uv.y * 6.28) * .22 + gust * .9;
  p.xz += vec2(.92, .38) * sway * uv.x * .55; p.y -= uv.x * gust * .18;
  vTip = step(.001, uv.x); vGust = gust * vTip; vFlower = step(1.5, uv.y); vPetal = petal * (uv.y < 2.5 ? vec3(1.) : uv.y < 3.5 ? vec3(1., .88, .3) : vec3(.86, .74, 1.)); vShade = .9 + .2 * min(uv.y, 1.);
  vFog = smoothstep(20., 175., length(p.xz)) * .82;
  gl_Position = viewProjection * p;
}`;
const GRASS_FRAGMENT = `precision highp float;
varying float vTip, vFog, vGust, vShade, vCloud, vWarm, vDeep, vFlower; varying vec3 vPetal; uniform vec3 root, tip, shine, haze, warm;
void main() {
  vec3 top = mix(mix(tip, warm, vWarm), root * 1.15, vDeep * .35);
  vec3 c = mix(mix(root, top, vTip * vTip), top * .94, smoothstep(.04, .3, vFog)) * vShade;
  c = mix(c, vPetal, vFlower);
  c = mix(c, shine, vGust * .42 * (1. - vCloud));
  c *= 1. - vCloud * .45;
  gl_FragColor = vec4(mix(c, haze, vFog), 1.);
}`;

const flowerField = (x, z) => Math.sin(x * 0.31 + 1.3) * Math.sin(z * 0.27 - 0.7) + Math.sin(x * 0.12 - z * 0.15) * 0.6;

export function grassTones(palette) {
  const blade = (key, scale) => hex(palette[key]).scale(scale), tip = Color3.Lerp(blade('meadow', 1.14), hex(palette.glow), 0.12);
  return { root: Color3.Lerp(blade('grass', 0.74), tip, 0.65), tip, shine: Color3.Lerp(blade('meadow', 1.28), hex(palette.glow), 0.3), haze: hex(palette.haze), warm: blade('meadowWarm', 1), petal: blade('petal', 1) };
}

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
      if (flowerField(x, z) > 0.75 && random() < 0.55) {
        const size = width * 0.34, tip = y + h + size * 0.6, face = Math.atan2(x, z), sx = Math.cos(face) * size, sz = -Math.sin(face) * size, px = x + lean, pz = z + lean * 0.5, kind = 2 + ((Math.floor(x / 11) + Math.floor(z / 11)) % 3 + 3) % 3, first = positions.length / 3;
        positions.push(px - sx, tip, pz - sz, px, tip + size, pz, px + sx, tip, pz + sz, px + sx, tip, pz + sz, px, tip - size, pz, px - sx, tip, pz - sz);
        for (let v = 0; v < 6; v++) uvs.push(h, kind);
        indices.push(first, first + 1, first + 2, first + 3, first + 4, first + 5);
      }
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

const tones = new Map(), air = new Color3();
const tone = value => { let color = tones.get(value); if (!color) { color = hex(value); tones.set(value, color); } return color; };

export function vistaColor(palette, shape, i, out, glow) {
  const role = shape.roles[i], shade = shape.shades[i];
  let color;
  if (role === 'sky') {
    const y = shape.positions[i * 3 + 1] / 180, x = shape.positions[i * 3] / 180, z = shape.positions[i * 3 + 2] / 180;
    const low = tone(palette.horizon), mid = tone(palette.high), high = tone(palette.zenith), below = tone(palette.below);
    color = y < 0 ? Color3.Lerp(low, below, smooth(0, -0.2, y)) : y < 0.35 ? Color3.Lerp(low, mid, smooth(0, 0.35, y)) : Color3.Lerp(mid, high, smooth(0.35, 0.95, y));
    const toward = Math.max(0, (x * glow.x + z * glow.z) / Math.max(0.001, Math.hypot(x, z)));
    color = Color3.Lerp(color, tone(palette.glow), toward ** 3 * (1 - smooth(0, 0.7, y) * 0.75) * (palette.glowStrength ?? 0.7));
  } else if (role === 'window' || role === 'windowWarm') {
    const lit = shape.thresholds[i] < glow.lit;
    color = tone(lit ? palette[role] : palette.windowDark);
  } else if (role === 'cloud' || role === 'cloudShade') {
    color = Color3.Lerp(tone(palette.cloudShade), tone(palette.cloud), shape.thresholds[i]).scale(shade);
  } else if (role === 'star') {
    color = Color3.Lerp(tone(palette.high), tone(palette.star), shape.thresholds[i] < glow.stars ? shade : 0);
  } else {
    const key = role.replace(/\d$/, ''), index = Number(role.slice(-1));
    const value = Array.isArray(palette[key]) ? palette[key][index] : palette[role] ?? SHELL_ROLES[role] ?? palette.stone;
    color = tone(value).scale(shade);
  }
  const glowing = ['lamp', 'spirit', 'window', 'windowWarm', 'glint', 'star', 'moon'].includes(role), ground = !glowing && !role.startsWith('cloud');
  const fog = glowing ? shape.fogs[i] * 0.45 : role.startsWith('cloud') ? shape.fogs[i] * palette.cloudFog : shape.fogs[i] * (palette.aerial ?? 1);
  if (ground && palette.mist) Color3.LerpToRef(color, tone(palette.mist), (shape.mists?.[i] ?? 0) * palette.mistStrength, color);
  const x = shape.positions[i * 3], z = shape.positions[i * 3 + 2], sunward = Math.max(0, (x * glow.x + z * glow.z) / Math.max(0.001, Math.hypot(x, z))) ** 16;
  const amount = Math.min(1, fog * 0.82);
  Color3.LerpToRef(tone(palette.haze), tone(palette.hazeSun ?? palette.haze), sunward, air);
  Color3.LerpToRef(color, air, amount, out);
  if (ground) { const grey = 0.2126 * out.r + 0.7152 * out.g + 0.0722 * out.b; air.set(grey, grey, grey); Color3.LerpToRef(out, air, amount * 0.2, out); }
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
export const BUTTERFLIES = 6, BUTTERFLY_WING = 0.16;
export const butterfliesOut = theme => theme === 'day' ? BUTTERFLIES : 0;
export const MOON_BEARING = 0.08;
export const moonRise = progress => 0.3 + progress * 0.3;

export function createSeatWorld(scene, parent) {
  const root = new TransformNode('seat-world', scene); root.parent = parent; root.setEnabled(false);
  const unlit = new StandardMaterial('seat-world-sky', scene); unlit.disableLighting = true; unlit.diffuseColor = Color3.Black(); unlit.emissiveColor = Color3.White(); unlit.specularColor = Color3.Black(); unlit.backFaceCulling = false; unlit.imageProcessingConfiguration = new ImageProcessingConfiguration();
  const lit = new StandardMaterial('seat-world-shell', scene); lit.diffuseColor = Color3.White(); lit.specularColor.set(0.03, 0.03, 0.03);
  const shapes = {};
  const make = (name, build, material = unlit, parentNode = root) => { const shape = createShape(); build(shape); shapes[name] = shape; return toMesh(shape, `seat-world-${name}`, scene, parentNode, material); };
  const spiritMatrices = new Float32Array(SPIRITS * 16);
  const spiritPaint = new StandardMaterial('seat-world-spirit', scene); spiritPaint.disableLighting = true; spiritPaint.diffuseColor = Color3.Black(); spiritPaint.emissiveColor = Color3.White(); spiritPaint.specularColor = Color3.Black(); spiritPaint.backFaceCulling = false; spiritPaint.disableDepthWrite = true; spiritPaint.imageProcessingConfiguration = unlit.imageProcessingConfiguration;
  const grassPaint = new ShaderMaterial('seat-world-grass-paint', scene, { vertexSource: GRASS_VERTEX, fragmentSource: GRASS_FRAGMENT }, { attributes: ['position', 'uv'], uniforms: ['world', 'viewProjection', 'time', 'shadow', 'root', 'tip', 'shine', 'haze', 'warm', 'petal'] });
  const landPaint = new ShaderMaterial('seat-world-land-paint', scene, { vertexSource: LAND_VERTEX, fragmentSource: LAND_FRAGMENT }, { attributes: ['position', 'color'], uniforms: ['world', 'viewProjection', 'time', 'shadow'] });
  landPaint.backFaceCulling = false; landPaint.setFloat('time', 0); landPaint.setFloat('shadow', 0);
  grassPaint.backFaceCulling = false; grassPaint.setFloat('time', 0); grassPaint.setFloat('shadow', 0);
  const skyEffectPaint = new ShaderMaterial('seat-world-sky-effects-paint', scene, { vertexSource: SKY_EFFECT_VERTEX, fragmentSource: SKY_EFFECT_FRAGMENT }, { attributes: ['position', 'uv', 'uv2'], uniforms: ['world', 'viewProjection', 'time', 'rays', 'rain', 'tint', 'haze'], needAlphaBlending: true });
  const cloudPaint = new ShaderMaterial('seat-world-cloud-paint', scene, { vertexSource: CLOUD_VERTEX, fragmentSource: CLOUD_FRAGMENT }, { attributes: ['position', 'color', 'uv', 'uv2'], uniforms: ['world', 'viewProjection', 'time'], needAlphaBlending: true });
  cloudPaint.backFaceCulling = false; cloudPaint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF; cloudPaint.disableDepthWrite = true; cloudPaint.setFloat('time', 0);
  skyEffectPaint.backFaceCulling = false; skyEffectPaint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF; skyEffectPaint.disableDepthWrite = true; skyEffectPaint.setFloat('time', 0); skyEffectPaint.setFloat('rays', 0);
  let built = false, sky = null, land, grass, skyEffects, cloudRoot, clouds, flockRoot, flock, moon, shooting, spirits;
  function buildBackdrop() {
    sky = make('sky', buildSky); land = make('land', shape => { buildLand(shape); buildHamlet(shape); buildForest(shape); buildRuins(shape); }, landPaint);
    grass = new Mesh('seat-world-grass', scene); Object.assign(new VertexData(), grassBlades()).applyToMesh(grass); grass.material = grassPaint; grass.parent = root; grass.isPickable = false; grass.metadata = { castShadow: false, seatWorld: true };
    cloudRoot = new TransformNode('seat-world-cloud-drift', scene); cloudRoot.parent = root;
    clouds = make('clouds', buildClouds, cloudPaint, cloudRoot); clouds.setVerticesData('uv', clouds.metadata.shape.uvs); clouds.setVerticesData('uv2', clouds.metadata.shape.seeds);
    colorKey = '';
  }
  function build() {
    built = true;
    if (backdrop) buildBackdrop();
    skyEffects = new Mesh('seat-world-sky-effects', scene); Object.assign(new VertexData(), skyEffectShape()).applyToMesh(skyEffects); skyEffects.material = skyEffectPaint; skyEffects.parent = root; skyEffects.isPickable = false; skyEffects.metadata = { castShadow: false, seatWorld: true };
    flockRoot = new TransformNode('seat-world-flock-flight', scene); flockRoot.parent = root; flockRoot.position.y = FLOCK.y;
    flock = make('flock', buildBirds, unlit, flockRoot);
    moon = make('moon', buildMoon); shooting = make('shooting', buildShootingStar); spirits = make('spirits', buildSpirit, spiritPaint);
    spirits.hasVertexAlpha = true;
    spirits.thinInstanceSetBuffer('matrix', spiritMatrices, 16, false); spirits.alwaysSelectAsActiveMesh = true;
  }
  let shell = null, shellKey = '', theme = 'dusk', progress = 0, colorKey = '', seconds = 0, backdrop = true;
  function showBackdrop() { for (const mesh of [sky, land, grass, clouds]) mesh?.setEnabled(backdrop); skyEffectPaint.setFloat('rays', sunRays()); if (moon) placeMoon(); }
  const sunRays = () => backdrop ? SUN_RAY_STRENGTH[theme] ?? 0 : 0;
  const glow = { x: 0, z: -1, lit: 0, stars: 1 };
  const temp = new Color3(), matrix = new Matrix(), scale = new Vector3(1, 1, 1), spot = new Vector3(), turn = new Quaternion();
  const spiritStarts = Array.from({ length: SPIRITS }, (_, i) => { const random = seeded(101 + i); const [x, z] = ahead(-10 + (random() - 0.5) * 56, 13 + random() * 40); return { x, z, ground: terrainHeight(x, z), outdoors: heightAt(x, z), phase: random(), sway: random() * 6 }; });
  const butterflyStarts = Array.from({ length: BUTTERFLIES }, (_, i) => { const random = seeded(211 + i); const [x, z] = ahead(-6 + (random() - 0.5) * 12, 9 + random() * 6); return { x, z, sway: random() * 6 }; });

  function paint(mesh, palette, only = null) {
    const shape = mesh.metadata.shape, colors = mesh.getVerticesData('color');
    for (let i = 0; i < shape.roles.length; i++) {
      if (only && !only.has(shape.roles[i])) continue;
      vistaColor(palette, shape, i, temp, glow); colors[i * 4] = temp.r; colors[i * 4 + 1] = temp.g; colors[i * 4 + 2] = temp.b;
    }
    mesh.updateVerticesData('color', colors);
  }
  function placeMoon() {
    const rise = theme === 'day' ? 0.95 : moonRise(progress), sun = -Math.PI / 2 - 0.55, heading = theme === 'day' ? sun : MOON_BEARING - Math.PI / 2, d = 165;
    glow.x = Math.cos(sun); glow.z = Math.sin(sun);
    moon.position.set(Math.cos(heading) * Math.cos(rise) * d, Math.sin(rise) * d, Math.sin(heading) * Math.cos(rise) * d);
    moon.lookAt(Vector3.Zero()); moon.scaling.setAll(theme === 'day' ? 0.8 : 1.6);
    moon.setEnabled(theme !== 'rain' && backdrop);
  }
  function recolor() {
    if (!built) return;
    const key = `${theme}:${Math.round(progress * 60)}`; if (key === colorKey) return; colorKey = key;
    const palette = vistaPalette(theme, progress);
    glow.lit = windowsLit(theme, progress); glow.stars = theme === 'dusk' ? 0.55 + progress * 0.45 : 0;
    placeMoon();
    for (const mesh of [sky, land, clouds, flock, moon, shooting, spirits]) if (mesh) paint(mesh, palette);
    fadeSpirits();
    const tones = grassTones(palette);
    for (const [name, value] of Object.entries(tones)) grassPaint.setColor3(name, value); for (const each of [grassPaint, landPaint]) each.setFloat('shadow', CLOUD_SHADOW[theme] ?? 0);
    skyEffectPaint.setFloat('rays', sunRays()); skyEffectPaint.setColor3('tint', Color3.Lerp(Color3.White(), hex(palette.glow), 0.6));
    skyEffectPaint.setColor3('haze', hex(palette.haze)); skyEffectPaint.setFloat('rain', theme === 'rain' ? 1 : 0);
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
  function fadeSpirits() {
    const { shape } = spirits.metadata, colors = spirits.getVerticesData('color'), day = theme === 'day';
    shape.fades.forEach((fade, i) => { colors[i * 4 + 3] = shape.wings[i] === day ? fade : 0; });
    spirits.updateVerticesData('color', colors);
  }
  function placeSpirits(reduced) {
    const aloft = spiritsAloft(theme, progress), fluttering = butterfliesOut(theme);
    for (let i = 0; i < SPIRITS; i++) {
      if (i < fluttering) {
        const { x, z, sway } = butterflyStarts[i], t = reduced ? 0 : seconds, wander = t * 0.35 + sway, beat = reduced ? 1 : Math.abs(Math.sin(t * 13 + sway * 5));
        spot.set(x + Math.sin(wander) * 2.2 + Math.sin(wander * 2.3) * 0.8, 0.6 + (sway % 1.5) + Math.sin(t * 2.4 + sway) * 0.3, z + Math.cos(wander * 0.8) * 1.6);
        const lift = 0.15 + (1 - beat) * 1.1;
        scale.set(BUTTERFLY_WING * Math.cos(lift), BUTTERFLY_WING * Math.sin(lift), BUTTERFLY_WING);
        Quaternion.RotationYawPitchRollToRef(Math.atan2(Math.cos(wander) * 2.2, -Math.sin(wander * 0.8) * 1.3), 0, 0, turn);
        Matrix.ComposeToRef(scale, turn, spot, matrix); matrix.copyToArray(spiritMatrices, i * 16);
        continue;
      }
      const start = spiritStarts[i], life = reduced ? start.phase : (seconds / SPIRIT_SECONDS + start.phase) % 1;
      const rise = i < aloft ? life : -1;
      spot.set(start.x + Math.sin(life * 9 + start.sway) * 1.6, rise < 0 ? -400 : (backdrop ? start.ground : start.outdoors) + 0.8 + rise * 12, start.z + Math.cos(life * 7 + start.sway) * 1.6);
      scale.setAll(rise < 0 ? 0 : Math.sin(Math.PI * life) * 0.9);
      Quaternion.RotationYawPitchRollToRef(Math.atan2(spot.x, spot.z), -Math.atan2(spot.y, Math.hypot(spot.x, spot.z)), 0, turn);
      Matrix.ComposeToRef(scale, turn, spot, matrix); matrix.copyToArray(spiritMatrices, i * 16);
    }
    spirits.thinInstanceBufferUpdated('matrix');
  }
  function animate(delta, reduced) {
    if (!root.isEnabled(false)) return;
    seconds += reduced ? 0 : delta;
    if (cloudRoot) cloudRoot.rotation.y = seconds * 0.004;
    grassPaint.setFloat('time', seconds); landPaint.setFloat('time', seconds); cloudPaint.setFloat('time', seconds); skyEffectPaint.setFloat('time', seconds);
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
    prepare() { if (!built) { build(); recolor(); showBackdrop(); } },
    get backdrop() { return backdrop; },
    setBackdrop(next) { backdrop = Boolean(next); if (backdrop && built && !sky) { buildBackdrop(); recolor(); } showBackdrop(); },
    setEnabled(enabled) { if (enabled && !built) { build(); showBackdrop(); } root.setEnabled(enabled); if (enabled) { recolor(); placeSpirits(true); } },
    animate,
    dispose() { root.dispose(false, false); unlit.dispose(); lit.dispose(); grassPaint.dispose(); landPaint.dispose(); skyEffectPaint.dispose(); spiritPaint.dispose(); },
  };
}
