import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { heightAt, noise2 } from '../../core/world-terrain.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';

export const LANDMARKS = Object.freeze({
  castle: Object.freeze({ x: 371, z: -3382, spire: 360 }),
  volcano: Object.freeze({ x: -4237, z: -6192, summit: 2150, radius: 3000, crater: 190 }),
  towers: Object.freeze([Object.freeze({ x: 365, z: -1039, height: 112 }), Object.freeze({ x: -390, z: -1658, height: 104 })]),
});

export const PLUME = Object.freeze({ puffs: 44, period: 170, rise: 1100, cap: 900 });

const STONE = Object.freeze({
  castle: [0.56, 0.58, 0.62], castleDark: [0.42, 0.45, 0.5], roof: [0.33, 0.37, 0.45], slab: [0.46, 0.47, 0.5],
  basalt: [0.25, 0.23, 0.24], ash: [0.33, 0.31, 0.31], tower: [0.46, 0.47, 0.5], plinth: [0.48, 0.5, 0.48],
});

function geometry() {
  const positions = [], normals = [], colors = [], glows = [], indices = [];
  const vertex = ([x, y, z], [nx, ny, nz], albedo, ember, rune) => {
    positions.push(x, y, z); normals.push(nx, ny, nz); colors.push(albedo[0], albedo[1], albedo[2], 1); glows.push(ember, rune);
    return positions.length / 3 - 1;
  };
  function face(corners, center, albedo, ember = 0, rune = 0) {
    const [a, b, c] = corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n); if (length < 1e-9) return;
    const mid = corners.reduce((sum, p) => [sum[0] + p[0] / corners.length, sum[1] + p[1] / corners.length, sum[2] + p[2] / corners.length], [0, 0, 0]);
    const outward = (mid[0] - center[0]) * n[0] + (mid[1] - center[1]) * n[1] + (mid[2] - center[2]) * n[2];
    n = n.map(value => value / length * (outward < 0 ? -1 : 1));
    const first = vertex(corners[0], n, albedo, ember, rune);
    for (let i = 1; i < corners.length; i++) vertex(corners[i], n, albedo, ember, rune);
    for (let i = 1; i < corners.length - 1; i++) indices.push(first, first + i, first + i + 1);
  }
  function prism({ x, y, z, rx, rz = rx, top = 1, topZ = top, h, sides = 4, turn = Math.PI / 4, shift = [0, 0], albedo, ember = 0, rune = 0, emberTop = ember, runeTop = rune }) {
    const ring = (radiusX, radiusZ, lift, dx, dz) => Array.from({ length: sides }, (_, i) => {
      const a = turn + i / sides * Math.PI * 2;
      return [x + dx + Math.cos(a) * radiusX, y + lift, z + dz + Math.sin(a) * radiusZ];
    });
    const low = ring(rx, rz, 0, 0, 0), high = ring(rx * top, rz * topZ, h, shift[0], shift[1]), center = [x + shift[0] / 2, y + h * 0.4, z + shift[1] / 2];
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides, side = top && topZ ? [low[i], low[j], high[j], high[i]] : [low[i], low[j], high[i]];
      face(side, center, albedo, ember, rune);
    }
    if (top && topZ) face(high, center, albedo, emberTop, runeTop);
    return y + h;
  }
  function surface(rows, columns, point, glow) {
    const start = positions.length / 3, grid = [];
    for (let r = 0; r <= rows; r++) for (let c = 0; c < columns; c++) { const p = point(r / rows, c / columns); grid.push(p); positions.push(...p.at); normals.push(0, 1, 0); colors.push(...p.albedo, 1); glows.push(glow(r / rows, c / columns), 0); }
    const part = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
      const a = r * columns + c, b = r * columns + (c + 1) % columns;
      part.push(a, b, b + columns, a, b + columns, a + columns);
    }
    const local = new Float32Array(grid.length * 3), shade = new Float32Array(grid.length * 3);
    grid.forEach((p, i) => local.set(p.at, i * 3));
    VertexData.ComputeNormals(local, part, shade);
    const flip = shade[4] < 0 ? -1 : 1;
    for (let i = 0; i < shade.length; i++) normals[start * 3 + i] = shade[i] * flip;
    for (const index of part) indices.push(start + index);
  }
  return { face, prism, surface, positions, normals, colors, glows, indices };
}

function footing(x, z, radius) {
  let low = heightAt(x, z);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; low = Math.min(low, heightAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius)); }
  return low;
}

function buildCastle(shape, { x, z, spire }) {
  const g = footing(x, z, 160) - 30, deck = heightAt(x, z), { prism } = shape;
  const needle = (px, pz, radius, height, cap, albedo = STONE.castle) => {
    const roof = prism({ x: x + px, y: g, z: z + pz, rx: radius, top: 0.9, h: deck - g + height, sides: 6, turn: 0.3, albedo });
    prism({ x: x + px, y: roof, z: z + pz, rx: radius * 1.3, top: 0, h: cap, sides: 6, turn: 0.3, albedo: STONE.roof });
  };
  const ring = (rx, rz, lift, count, wall, tower) => {
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2, b = (i + 1) / count * Math.PI * 2, ax = Math.cos(a) * rx, az = Math.sin(a) * rz, bx = Math.cos(b) * rx, bz = Math.sin(b) * rz;
      prism({ x: x + (ax + bx) / 2, y: g, z: z + (az + bz) / 2, rx: Math.hypot(bx - ax, bz - az) / 2 + 2, rz: 6, h: deck - g + lift, turn: Math.atan2(bz - az, bx - ax) + Math.PI / 4, albedo: STONE.castleDark });
      if (i % 2 === 0) needle(ax, az, 7, lift + tower + (i % 3) * 8, 22);
    }
  };
  ring(170, 120, 26, 16, 26, 22);
  ring(105, 78, 62, 12, 62, 30);
  for (const [px, pz, rx, rz, h, roof] of [[14, -18, 70, 40, 78, 26], [-6, -30, 44, 30, 118, 30], [48, 6, 30, 22, 100, 24], [-56, 4, 26, 20, 84, 22]]) {
    prism({ x: x + px, y: g, z: z + pz, rx, rz, top: 0.94, h: deck - g + h, albedo: STONE.castle });
    prism({ x: x + px, y: deck + h, z: z + pz, rx: rx * 1.02, rz: rz * 0.9, top: 0.86, topZ: 0, h: roof, albedo: STONE.roof });
  }
  let y = prism({ x, y: g, z: z - 20, rx: 30, top: 0.9, h: deck - g + 180, albedo: STONE.castle });
  y = prism({ x, y, z: z - 20, rx: 21, top: 0.9, h: 44, albedo: STONE.castle });
  y = prism({ x, y, z: z - 20, rx: 12, h: 34, sides: 8, turn: 0, albedo: STONE.castle });
  prism({ x, y, z: z - 20, rx: 15, top: 0, h: spire - (y - deck), sides: 8, turn: 0, albedo: STONE.roof });
  for (const [px, pz, radius, height, cap] of [[-34, -6, 9, 196, 52], [38, -10, 8, 172, 46], [-20, 28, 7, 150, 40], [26, 24, 8, 140, 40], [-62, -34, 7, 124, 36], [66, -30, 6, 128, 34], [-8, -66, 7, 136, 38], [52, 44, 6, 104, 30], [-50, 40, 6, 112, 32]]) needle(px, pz, radius, height, cap);
  for (const [px, pz, w, h, lean, turn] of [[-360, 70, 40, 250, 0.42, 0.15], [-270, -130, 30, 200, 0.3, -0.3], [330, 50, 42, 230, -0.4, -0.1], [410, -160, 30, 170, -0.26, 0.35]]) {
    const ground = footing(x + px, z + pz, 45) - 25;
    prism({ x: x + px, y: ground, z: z + pz, rx: w, rz: 14, top: 0.5, h: h + heightAt(x + px, z + pz) - ground, turn: turn + Math.PI / 4, shift: [Math.sin(lean) * h * Math.cos(turn), -Math.sin(lean) * h * Math.sin(turn)], albedo: STONE.slab });
  }
}

const volcanoRim = (summit, a) => summit + noise2(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 61) * 90 - Math.max(0, Math.cos(a - 0.9)) ** 6 * 140;

const shade = (albedo, k) => [albedo[0] * k, albedo[1] * k, albedo[2] * k];
const flank = (t, crater, radius) => crater + (radius - crater) * ((1 - t) ** 2.3 * 0.75 + (1 - t) * 0.25);

function buildVolcano(shape, { x, z, summit, radius, crater }) {
  const base = footing(x, z, radius * 0.6) - 60, height = summit - base;
  shape.surface(36, 144, (t, s) => {
    const a = s * Math.PI * 2, wobble = a + noise2(t * 3, s * 6, 62) * 0.05;
    const gully = Math.abs(noise2(Math.cos(wobble) * 5.2 + t * 1.6, Math.sin(wobble) * 5.2, 63)), crest = 1 - Math.abs(noise2(Math.cos(a) * 2.2, Math.sin(a) * 2.2 + t, 64));
    const r = flank(t, crater, radius) * (1 + (gully - 0.3) * 0.22 * (1 - t * 0.5) + (crest - 0.5) * 0.18 * (1 - t));
    const rim = volcanoRim(summit, a), y = Math.min(t < 1 ? base + height * t : rim, rim);
    return { at: [x + Math.cos(a) * r, y, z + Math.sin(a) * r], albedo: shade(t > 0.8 ? STONE.ash : STONE.basalt, 0.8 + gully * 0.5) };
  }, t => Math.max(0, (t - 0.86) / 0.14) ** 3 * 0.45);
  shape.surface(4, 48, (t, s) => {
    const a = s * Math.PI * 2, r = crater * (1 - t * 0.85);
    return { at: [x + Math.cos(a) * r, volcanoRim(summit, a) - t * 140, z + Math.sin(a) * r], albedo: STONE.basalt };
  }, t => 0.5 + t * 1.2);
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2 + noise2(i * 0.7, 3, 65) * 0.12, t = 0.34 + noise2(i * 0.9, 5, 66) * 0.14, ring = flank(t, crater, radius) * (1.02 + noise2(i * 1.7, 4, 69) * 0.08);
    const px = x + Math.cos(a) * ring, pz = z + Math.sin(a) * ring, size = noise2(i * 1.3, 7, 67) * 0.5 + 0.5, rise = 140 + size * size * 560, lean = 0.12 + (noise2(i, 9, 68) * 0.5 + 0.5) * 0.3, turn = a + noise2(i * 2.1, 8, 70) * 1.2;
    shape.prism({ x: px, y: base + height * t - 180, z: pz, rx: 60 + rise * 0.22, rz: 50 + rise * 0.2, top: 0.04, topZ: 0.45 + size * 0.2, h: rise + 180, sides: 4, turn, shift: [Math.cos(a) * rise * lean, Math.sin(a) * rise * lean], albedo: shade(STONE.basalt, 0.82 + size * 0.2) });
  }
}

function buildTower(shape, { x, z, height }) {
  const g = footing(x, z, 16) - 8, ground = heightAt(x, z), { prism, face } = shape;
  prism({ x, y: g - 6, z, rx: 22, rz: 17, top: 0.35, h: ground - g + 18, sides: 7, turn: 0.4, albedo: STONE.plinth });
  const shaft = height * 0.74, width = 4.2, taper = 0.8;
  let y = prism({ x, y: g, z, rx: width * Math.SQRT2, top: taper, h: ground - g + shaft, albedo: STONE.tower });
  const rise = y - g;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, nx = Math.cos(a), nz = Math.sin(a), tx = -nz, tz = nx, at = (t, s) => { const w = width * (1 - (1 - taper) * t) + 0.2; return [x + nx * w + tx * s, g + rise * t, z + nz * w + tz * s]; };
    face([at(0.1, -1.4), at(0.1, 1.4), at(0.98, 1.4), at(0.98, -1.4)], [x, g + rise * 0.5, z], STONE.tower, 0, 0.28);
  }
  prism({ x, y: ground + shaft * 0.45, z, rx: 8, h: 3, sides: 8, turn: 0, albedo: STONE.tower });
  y = prism({ x, y, z, rx: 15, top: 1.05, h: 4, sides: 8, turn: 0, albedo: STONE.tower, runeTop: 0.2 });
  y = prism({ x, y, z, rx: 4.5, top: 0.8, h: 7, albedo: STONE.tower });
  const crown = height - (y - ground);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    prism({ x: x + Math.cos(a) * 9, y, z: z + Math.sin(a) * 9, rx: 1.2, top: 0, h: crown, sides: 4, turn: a, shift: [-Math.cos(a) * 8, -Math.sin(a) * 8], albedo: STONE.tower });
  }
  prism({ x, y: y + crown * 0.42, z, rx: 2.6, top: 0, h: 7, sides: 4, turn: 0, albedo: STONE.tower, rune: 1.2 });
  prism({ x, y: y + crown * 0.42, z, rx: 2.6, top: 0, h: -4, sides: 4, turn: 0, albedo: STONE.tower, rune: 1.2 });
}

export function landmarkGeometry() {
  const shape = geometry();
  buildCastle(shape, LANDMARKS.castle);
  buildVolcano(shape, LANDMARKS.volcano);
  for (const tower of LANDMARKS.towers) buildTower(shape, tower);
  const { positions, normals, colors, glows, indices } = shape;
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), uvs: new Float32Array(glows), indices: positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices) };
}

const LIGHT_UNIFORMS = 'uniform vec3 eye, sun, sunColor, skyAmbient, groundAmbient, shadowTint, fogNear, fogFar, fogSun, ember, rune; uniform float sunStrength, shadowLift, fogDensity, fogHeight, glowGain;';

const SOLID_VERTEX = `precision highp float;
attribute vec3 position, normal; attribute vec4 color; attribute vec2 uv; uniform mat4 world, viewProjection;
varying vec3 vWorld, vNormal, vAlbedo; varying vec2 vGlow;
void main() { vec4 p = world * vec4(position, 1.); vWorld = p.xyz; vNormal = normal; vAlbedo = color.rgb; vGlow = uv; gl_Position = viewProjection * p; }`;

const SOLID_FRAGMENT = `precision highp float;
varying vec3 vWorld, vNormal, vAlbedo; varying vec2 vGlow;
${LIGHT_UNIFORMS}
${WORLD_GLSL}
void main() {
  vec3 n = normalize(vNormal);
  float lit = clamp((dot(n, sun) + .3) / 1.3, 0., 1.);
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .5 + .5);
  vec3 color = vAlbedo * mix(shadowTint * shadowLift + ambient * .35, sunColor * sunStrength, lit);
  color += (ember * vGlow.x + rune * vGlow.y) * glowGain;
  gl_FragColor = vec4(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), 1.);
}`;

const PLUME_VERTEX = `precision highp float;
attribute vec3 position; attribute vec4 color; attribute vec2 uv; uniform mat4 world, view, viewProjection; uniform float time, rise, cap, period;
varying vec3 vWorld, vRight, vUp; varying vec2 vCorner; varying float vAge, vAlpha, vSeed;
void main() {
  float age = fract(color.x + time / period), spread = smoothstep(.35, .9, age), a = color.y * 6.2832;
  vec3 c = (world * vec4(position, 1.)).xyz;
  c.y += rise * (1. - pow(1. - age, 2.));
  c.xz += vec2(cos(a), sin(a)) * (40. + spread * cap * color.z) + vec2(1., -.35) * age * age * 240.;
  float size = mix(190., 540., sqrt(age)) * (.75 + .5 * color.w);
  vRight = vec3(view[0][0], view[1][0], view[2][0]); vUp = vec3(view[0][1], view[1][1], view[2][1]);
  vec3 p = c + (vRight * uv.x + vUp * uv.y * mix(1., .62, spread)) * size;
  vWorld = p; vCorner = uv; vAge = age; vSeed = color.w * 13.;
  vAlpha = smoothstep(0., .04, age) * (1. - smoothstep(.78, 1., age));
  gl_Position = viewProjection * vec4(p, 1.);
}`;

const PLUME_FRAGMENT = `precision highp float;
varying vec3 vWorld, vRight, vUp; varying vec2 vCorner; varying float vAge, vAlpha, vSeed;
${LIGHT_UNIFORMS}
${WORLD_GLSL}
void main() {
  float d = length(vCorner), lumpy = worldNoise(vCorner * 2.6 + vSeed) - .5;
  float soft = 1. - smoothstep(.35, 1., d + lumpy * .45);
  if (soft <= 0.) discard;
  vec3 toEye = normalize(eye - vWorld), n = normalize(vRight * vCorner.x + vUp * vCorner.y + toEye * sqrt(max(0., 1. - d * d)));
  float lit = clamp(dot(n, sun) * .5 + .55, 0., 1.);
  vec3 color = vec3(.66, .62, .6) * mix(shadowTint * shadowLift + skyAmbient * .3, sunColor * sunStrength * 1.45, lit);
  color += ember * glowGain * .35 * pow(1. - vAge, 4.) * (1. - vCorner.y * .5);
  float clear = smoothstep(.03, .3, exp(-distance(eye, vWorld) * fogDensity * .35));
  gl_FragColor = vec4(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity * .55, fogHeight), soft * vAlpha * .92 * clear);
}`;

const LIGHT_COLORS = ['sunColor', 'skyAmbient', 'groundAmbient', 'shadowTint'];
const LIGHT_FLOATS = ['sunStrength', 'shadowLift'];
const GLOW = Object.freeze({ ember: '#ff6a2c', rune: '#5fd2ff' });

function plumeGeometry({ x, z }, summit) {
  const count = PLUME.puffs, positions = new Float32Array(count * 12), colors = new Float32Array(count * 16), uvs = new Float32Array(count * 8), indices = new Uint16Array(count * 6);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 4; k++) {
      positions.set([x, summit - 40, z], (i * 4 + k) * 3);
      colors.set([i / count, noise2(i * 0.77, 1, 71) * 0.5 + 0.5, 0.35 + (noise2(i * 0.91, 2, 72) * 0.5 + 0.5) * 0.65, noise2(i * 1.13, 3, 73) * 0.5 + 0.5], (i * 4 + k) * 4);
      uvs.set([k === 1 || k === 2 ? 1 : -1, k >= 2 ? 1 : -1], (i * 4 + k) * 2);
    }
    indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  return { positions, colors, uvs, indices };
}

function landmarkMesh(name, scene, root, data, material) {
  const mesh = new Mesh(name, scene);
  Object.assign(new VertexData(), data).applyToMesh(mesh);
  mesh.material = material; mesh.parent = root; mesh.isPickable = false; mesh.metadata = { castShadow: false, world: true };
  mesh.freezeWorldMatrix();
  return mesh;
}

export function createWorldLandmarks(scene, { root, still }) {
  const uniforms = ['world', 'view', 'viewProjection', 'ember', 'rune', 'glowGain', ...AIR_UNIFORMS, ...LIGHT_COLORS, ...LIGHT_FLOATS];
  const solidPaint = new ShaderMaterial('world-landmark-paint', scene, { vertexSource: SOLID_VERTEX, fragmentSource: SOLID_FRAGMENT }, { attributes: ['position', 'normal', 'color', 'uv'], uniforms });
  const plumePaint = new ShaderMaterial('world-plume-paint', scene, { vertexSource: PLUME_VERTEX, fragmentSource: PLUME_FRAGMENT }, { attributes: ['position', 'color', 'uv'], uniforms: [...uniforms, 'rise', 'cap', 'period'], needAlphaBlending: true });
  solidPaint.backFaceCulling = false; plumePaint.backFaceCulling = false; plumePaint.disableDepthWrite = true;
  const paints = [solidPaint, plumePaint];
  for (const paint of paints) { followEye(scene, paint, still); for (const [key, hex] of Object.entries(GLOW)) paint.setColor3(key, Color3.FromHexString(hex)); }
  plumePaint.setFloat('rise', PLUME.rise); plumePaint.setFloat('cap', PLUME.cap); plumePaint.setFloat('period', PLUME.period);
  const solids = landmarkMesh('world-landmarks', scene, root, landmarkGeometry(), solidPaint);
  const plume = landmarkMesh('world-volcano-plume', scene, root, plumeGeometry(LANDMARKS.volcano, LANDMARKS.volcano.summit), plumePaint);
  plume.alwaysSelectAsActiveMesh = true;
  return {
    meshes: [solids, plume],
    setTheme(atmosphere) {
      for (const paint of paints) {
        applyAir(paint, atmosphere);
        for (const key of LIGHT_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
        for (const key of LIGHT_FLOATS) paint.setFloat(key, atmosphere[key]);
        paint.setFloat('glowGain', 0.55 + (1 - atmosphere.sun[1]) * 0.9);
      }
    },
  };
}
