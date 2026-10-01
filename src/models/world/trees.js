import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration.js';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex.js';
import { WORLD, riverDistance, pathDistance, smooth, noise2 } from '../../core/world-terrain.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';
import { RIDGE_LIFT_GLSL, RIDGE_UNIFORMS, applyRidges } from './terrain-paint.js';

export const TREE_BANDS = Object.freeze([
  Object.freeze({ from: 25, to: 450, spacing: 8, size: 1, clump: 1, spread: 1, lone: 1, behind: 450, gather: 1, fray: 0 }),
  Object.freeze({ from: 450, to: 1300, spacing: 34, size: 1.7, clump: 2.9, spread: 1.7, lone: 0, behind: 200, gather: 0.7, fray: 1 }),
  Object.freeze({ from: 1300, to: 3400, spacing: 46, size: 2.6, clump: 3.6, spread: 1.8, lone: 0, behind: 200, gather: 0.7, fray: 0 }),
]);
export const WINDOW_EYE = Object.freeze({ x: -2, y: 2.24, z: -2.4 });
export const VISTA = Object.freeze({ reach: 320, clearing: 170, bearing: -0.3, halfAngle: 1.25, dip: 0.022 });
export const HERO_TREES = Object.freeze([
  Object.freeze({ bearing: -0.44, distance: 50, size: 1.3, turn: 0.4 }),
  Object.freeze({ bearing: -0.86, distance: 105, size: 1.7, turn: 2.2 }),
  Object.freeze({ bearing: 0.42, distance: 62, size: 1.3, turn: 4.1 }),
].map(hero => Object.freeze({ ...hero, x: WINDOW_EYE.x + Math.sin(hero.bearing) * hero.distance, z: WINDOW_EYE.z - Math.cos(hero.bearing) * hero.distance })));
const HERO_CLEARANCE = 11;
const CROWN_TOP = 10.6;
export const NEAR_TREES = 115;
const LONE_TREE_AREA = 70 * 70;
const RIVER_CLEARANCE = WORLD.river.width * 1.4;
export const PATH_CLEARANCE = 2;
const FRAY_REACH = 50;

const FOLIAGE_COLORS = Object.freeze(['leafTop', 'leafUnder', 'leafBack', 'leafCrown', 'needleTop', 'needleUnder', 'bark']);
const LIGHT_COLORS = ['sunColor', 'skyAmbient', 'groundAmbient', 'shadowTint'];

const PART = Object.freeze({ bark: 0, mass: 0.16, leaf: 0.25, needle: 0.5, farLeaf: 0.75, farNeedle: 1 });

function hash(a, b, salt) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(salt, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function seeded(seed) {
  let n = 0;
  return () => hash(seed, n++, 977);
}

function groundOf(rings) {
  const grids = rings.map(({ positions, normals, colors }) => {
    const last = positions.length - 3, minX = positions[0], minZ = positions[2], step = positions[5] - minZ, nz = Math.round((positions[last + 2] - minZ) / step) + 1;
    return { minX, minZ, maxX: positions[last], maxZ: positions[last + 2], step, nx: positions.length / 3 / nz, nz, positions, normals, colors };
  });
  const at = { y: 0, cover: 0, up: 1, wet: 0 };
  return (x, z) => {
    let g = null;
    for (const grid of grids) if (x > grid.minX && x < grid.maxX && z > grid.minZ && z < grid.maxZ) { g = grid; break; }
    if (!g) return null;
    const u = (x - g.minX) / g.step, w = (z - g.minZ) / g.step, i = Math.min(g.nx - 2, Math.floor(u)), j = Math.min(g.nz - 2, Math.floor(w)), fu = u - i, fw = w - j, a = i * g.nz + j, b = a + g.nz;
    const lower = fu + fw <= 1, p = lower ? a : b + 1, q = lower ? b : a + 1, r = lower ? a + 1 : b;
    const wq = lower ? fu : 1 - fu, wr = lower ? fw : 1 - fw, wp = 1 - wq - wr;
    const blend = (data, stride, offset) => data[p * stride + offset] * wp + data[q * stride + offset] * wq + data[r * stride + offset] * wr;
    at.y = blend(g.positions, 3, 1); at.up = blend(g.normals, 3, 1); at.cover = blend(g.colors, 4, 0); at.wet = blend(g.colors, 4, 1);
    return at;
  };
}

const sightLine = (px, pz) => {
  const dx = px - WINDOW_EYE.x, dz = WINDOW_EYE.z - pz, distance = Math.hypot(dx, dz);
  if (dz <= 0 || distance >= VISTA.reach || Math.abs(Math.atan2(dx, dz) - VISTA.bearing) >= VISTA.halfAngle) return Infinity;
  return distance < VISTA.clearing ? -Infinity : WINDOW_EYE.y - distance * VISTA.dip;
};

export function plantTrees(rings) {
  const ground = groundOf(rings), x = [], y = [], z = [], width = [], height = [], turn = [], kind = [];
  const plant = (px, pz, at, grow, spin, conifer, tall, spread = 1) => {
    x.push(px); z.push(pz); y.push(at.y - 0.5 * grow); turn.push(spin);
    width.push(grow * spread); height.push(grow * tall); kind.push(conifer ? 1 : 0);
  };
  for (const hero of HERO_TREES) {
    const at = ground(hero.x, hero.z), top = WINDOW_EYE.y - hero.distance * VISTA.dip;
    if (at) plant(hero.x, hero.z, at, Math.max(0.6, Math.min(hero.size, (top - at.y) / (CROWN_TOP - 0.5))), hero.turn, false, 1);
  }
  const neighbour = groundOf(rings), coverAt = (x, z) => neighbour(x, z)?.cover ?? 0, heightToward = (x, z, fallback) => neighbour(x, z)?.y ?? fallback;
  TREE_BANDS.forEach(({ from, to, spacing, size, clump, spread, lone: loneShare, behind, gather, fray }, band) => {
    const cells = Math.ceil(to / spacing), lone = loneShare * spacing * spacing / LONE_TREE_AREA, salt = band * 8, scatter = 1 + 0.7 * gather, thicketSize = spacing / TREE_BANDS[0].spacing;
    for (let gx = -cells; gx < cells; gx++) for (let gz = -cells; gz < Math.ceil(behind / spacing); gz++) {
      const px = (gx + 0.5 + (hash(gx, gz, salt + 1) - 0.5) * scatter) * spacing, pz = (gz + 0.5 + (hash(gx, gz, salt + 2) - 0.5) * scatter) * spacing, d = Math.hypot(px, pz);
      if (d < from || d >= to || pz > behind || riverDistance(px, pz) < RIVER_CLEARANCE) continue;
      if (HERO_TREES.some(hero => Math.hypot(px - hero.x, pz - hero.z) < HERO_CLEARANCE * hero.size)) continue;
      const at = ground(px, pz);
      if (!at) continue;
      const grove = smooth(0.02, 0.32, noise2(px / 150, pz / 150, 91) + 0.35 * noise2(px / 48, pz / 48, 92));
      const open = (1 - smooth(0.12, 0.35, at.cover)) * (at.wet > 0 ? 0 : 1), up = at.up;
      const edge = fray && open && up > 0.55 ? Math.max(coverAt(px + FRAY_REACH, pz), coverAt(px - FRAY_REACH, pz), coverAt(px, pz + FRAY_REACH), coverAt(px, pz - FRAY_REACH)) : 0;
      const crest = fray && open && up > 0.85 ? smooth(8, 22, at.y - heightToward(px * (1 - FRAY_REACH / d), pz * (1 - FRAY_REACH / d), at.y)) : 0;
      const frayed = fray * Math.max(smooth(0.3, 0.8, edge) * smooth(0.55, 0.75, up) * 0.8, crest) * smooth(-0.3, 0.3, noise2(px / 70, pz / 70, 96));
      const meadow = Math.max(lone * smooth(0.9, 0.96, up), frayed) * open;
      const thicket = smooth(-0.25, 0.4, noise2(px / (30 * thicketSize), pz / (30 * thicketSize), 94) + 0.45 * noise2(px / (12 * thicketSize), pz / (12 * thicketSize), 95)), gathered = 1 - gather + gather * thicket;
      const forest = smooth(0.04, 0.3, at.cover) * grove * 1.3 * gathered * (1 + gather), roll = hash(gx, gz, salt + 3);
      if (roll >= forest && roll >= meadow) continue;
      const alone = roll >= forest, stand = smooth(-0.05, 0.35, noise2(px / 90, pz / 90, 93)), conifer = !alone && hash(gx, gz, salt + 4) < (0.85 * smooth(25, 120, at.y) + 0.5 * smooth(0.95, 0.85, at.up)) * stand;
      const massed = !alone && !conifer, scale = (0.6 + 0.65 * hash(gx, gz, salt + 5) + 0.35 * smooth(0.4, 0.9, grove)) * (1 - gather * 0.55 + gather * gathered);
      const grow = (massed ? clump : size) * scale * (alone ? 1.3 : 1), tall = 0.88 + 0.28 * hash(gx, gz, salt + 7) + gather * 0.2 * (hash(gx, gz, salt + 8) - 0.5);
      if (at.y - 0.5 * grow + grow * tall * (conifer ? 14.6 : CROWN_TOP) > sightLine(px, pz)) continue;
      if (pathDistance(px, pz) < PATH_CLEARANCE + 5 * grow) continue;
      plant(px, pz, at, grow, hash(gx, gz, salt + 6) * Math.PI * 2, conifer, tall, massed ? spread : 1 + gather * 0.3 * (hash(gx, gz, salt + 9) - 0.5));
    }
  });
  return { count: x.length, x: Float32Array.from(x), y: Float32Array.from(y), z: Float32Array.from(z), width: Float32Array.from(width), height: Float32Array.from(height), turn: Float32Array.from(turn), kind: Uint8Array.from(kind) };
}

const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const blendNormal = (v, outer, inner, weight) => unit(add(unit(sub(v, outer)), unit(sub(v, inner)), weight));
const sphere = rand => { const a = rand() * Math.PI * 2, y = rand() * 2 - 1, r = Math.sqrt(1 - y * y); return [Math.cos(a) * r, y, Math.sin(a) * r]; };

const GOLDEN = (1 + Math.sqrt(5)) / 2;
const ICOSAHEDRON = [[-1, GOLDEN, 0], [1, GOLDEN, 0], [-1, -GOLDEN, 0], [1, -GOLDEN, 0], [0, -1, GOLDEN], [0, 1, GOLDEN], [0, -1, -GOLDEN], [0, 1, -GOLDEN], [GOLDEN, 0, -1], [GOLDEN, 0, 1], [-GOLDEN, 0, -1], [-GOLDEN, 0, 1]].map(unit);
const ICOSAHEDRON_FACES = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];

function shape() {
  const s = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
  s.vertex = (p, n, color, uv) => { s.positions.push(...p); s.normals.push(...n); s.colors.push(...color); s.uvs.push(...uv); return s.positions.length / 3 - 1; };
  s.card = (centre, e1, e2, normalOf, colorOf) => {
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => add(add(centre, e1, u), e2, v));
    const base = corners.map((p, k) => s.vertex(p, normalOf(p), colorOf(p), [k === 1 || k === 2 ? 1 : 0, k > 1 ? 1 : 0]))[0];
    s.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  s.tube = (from, to, r0, r1, sides, colorOf) => {
    const axis = unit(sub(to, from)), side = unit(cross(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), other = cross(axis, side), start = s.positions.length / 3;
    for (let k = 0; k <= sides; k++) {
      const a = k / sides * Math.PI * 2, n = add([side[0] * Math.cos(a), side[1] * Math.cos(a), side[2] * Math.cos(a)], other, Math.sin(a));
      s.vertex(add(from, n, r0), n, colorOf(from), [k / sides, 0]); s.vertex(add(to, n, r1), n, colorOf(to), [k / sides, 1]);
    }
    for (let k = 0; k < sides; k++) { const a = start + k * 2; s.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  };
  s.ball = (centre, radius, squash, normalOf, colorOf) => {
    const start = s.positions.length / 3;
    for (const corner of ICOSAHEDRON) {
      const p = add(centre, [corner[0] * radius, corner[1] * radius * squash, corner[2] * radius]);
      s.vertex(p, normalOf(p), colorOf(p), [0.5, 0.5]);
    }
    for (const face of ICOSAHEDRON_FACES) s.indices.push(start + face[0], start + face[1], start + face[2]);
  };
  s.data = () => ({ positions: new Float32Array(s.positions), normals: new Float32Array(s.normals), colors: new Float32Array(s.colors), uvs: new Float32Array(s.uvs), indices: new Uint16Array(s.indices) });
  return s;
}

function scatterCards(s, rand, centre, radius, squash, cards, half, lean, normalOf, colorOf) {
  for (let k = 0; k < cards; k++) {
    const dir = sphere(rand), spot = add(centre, [dir[0] * radius, dir[1] * radius * squash, dir[2] * radius], 0.3 + 0.5 * Math.sqrt(rand()));
    const facing = unit(add(add(dir, sphere(rand), 0.7), [0, 1, 0], lean)), e1 = unit(cross(facing, Math.abs(facing[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(facing, e1);
    const spin = rand() * Math.PI * 2, size = radius * half * (0.8 + 0.4 * rand());
    const a = add([e1[0] * Math.cos(spin), e1[1] * Math.cos(spin), e1[2] * Math.cos(spin)], e2, Math.sin(spin)), b = cross(facing, a);
    s.card(spot, [a[0] * size, a[1] * size, a[2] * size], [b[0] * size, b[1] * size, b[2] * size], normalOf, colorOf(rand()));
  }
}

function broadleaf() {
  const s = shape(), rand = seeded(11), canopy = [0, 6.5, 0], fork = [0.2, 3.4, 0.1];
  const clumps = [{ c: [0, 7.9, 0], r: 2.7 }];
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + rand() * 0.5, d = 2.8 + rand() * 0.7; clumps.push({ c: [Math.cos(a) * d, 5.7 + rand() * 1.4, Math.sin(a) * d], r: 2 + rand() * 0.5 }); }
  const barkColor = p => [0.45 + 0.5 * smooth(-0.5, 6, p[1]), 0.08 * smooth(1, 6, p[1]), PART.bark, 0];
  s.tube([0, -0.8, 0], fork, 0.5, 0.33, 7, barkColor);
  for (const { c } of clumps) s.tube(fork, add(fork, sub(c, fork), 0.8), 0.22, 0.08, 5, barkColor);
  for (const { c, r } of clumps) {
    const normalOf = v => blendNormal(v, canopy, c, 1.3), light = v => {
      const out = sub(v, canopy), depth = Math.min(1, Math.hypot(...out) / 4.8);
      return 0.36 + 0.22 * out[1] / (Math.hypot(...out) || 1) + 0.2 * depth + 0.38 * (v[1] - c[1]) / r;
    };
    const sway = v => Math.min(1, (v[1] / 9) ** 1.5), seed = rand();
    s.ball(c, r * 0.8, 0.78, normalOf, v => [Math.min(0.75, Math.max(0.12, light(v) - 0.12)), sway(v), PART.mass, seed]);
    scatterCards(s, rand, c, r, 0.8, 16, 0.62, 0.3, normalOf, leafSeed => v => [Math.min(1, Math.max(0.16, light(v))), sway(v), PART.leaf, leafSeed]);
  }
  return s.data();
}

function conifer() {
  const s = shape(), rand = seeded(31), tiers = 9, segments = 12;
  s.tube([0, -0.8, 0], [0, 13.6, 0], 0.34, 0.06, 6, p => [0.4 + 0.5 * smooth(0, 12, p[1]), 0.1 * smooth(2, 13, p[1]), PART.bark, 0]);
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1), y = 2.4 + t * 10.6, r = 3.3 * (1 - t * 0.86) + 0.35, droop = r * (0.55 + 0.15 * rand()), turn = rand() * Math.PI * 2, seed = rand();
    const start = s.positions.length / 3;
    for (let j = 0; j <= segments; j++) {
      const a = turn + j / segments * Math.PI * 2, out = [Math.cos(a), 0, Math.sin(a)], reach = r * (0.88 + 0.24 * rand());
      const n = unit(add([out[0] * 0.7, 0.75, out[2] * 0.7], unit([out[0] * reach, y - 6.5, out[2] * reach]), 0.5));
      s.vertex([out[0] * 0.15, y + 0.5, out[2] * 0.15], n, [0.3 + 0.25 * t, Math.min(1, (y / 13) ** 1.5) * 0.6, PART.needle, seed], [j, 0]);
      s.vertex([out[0] * reach, y - droop, out[2] * reach], n, [Math.min(1, 0.85 + 0.15 * t), Math.min(1, (y / 13) ** 1.5) * 0.6, PART.needle, seed], [j, 1]);
    }
    for (let j = 0; j < segments; j++) { const a = start + j * 2; s.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return s.data();
}

function impostor(halfWidth, top, part) {
  const s = shape(), normal = [0, 0, 1];
  s.card([0, (top - 0.8) / 2, 0], [halfWidth, 0, 0], [0, (top + 0.8) / 2, 0], () => normal, p => [1, 0, part, 0]);
  const data = s.data();
  for (let v = 0; v < 4; v++) { data.uvs[v * 2] = data.positions[v * 3]; data.uvs[v * 2 + 1] = data.positions[v * 3 + 1]; }
  return data;
}

const TREE_KINDS = Object.freeze([
  Object.freeze({ name: 'broadleaf', near: broadleaf, far: () => impostor(5.8, 10.8, PART.farLeaf) }),
  Object.freeze({ name: 'conifer', near: conifer, far: () => impostor(3.8, 14.6, PART.farNeedle) }),
]);

const TREE_VERTEX = `precision highp float;
attribute vec3 position, normal; attribute vec4 color; attribute vec2 uv;
uniform mat4 viewProjection; uniform float time; uniform vec3 eye;
#include<instancesDeclaration>
varying vec3 vWorld, vNormal, vRight; varying vec4 vPart; varying vec2 vUv; varying float vSeed, vSpread;
${WORLD_GLSL}
void main() {
#include<instancesVertex>
  vec3 base = finalWorld[3].xyz;
  float phase = worldHash(base.xz * .071) * 6.283, sway = color.g, leaf = step(.1, color.b) * (1. - step(.62, color.b));
  vec2 gust = vec2(sin(time * .8 + phase), cos(time * .63 + phase * 1.7)) * .16 + vec2(.22, .1) * (sin(time * .31 + base.x * .004 + base.z * .003) * .5 + .5);
  vec4 p;
  if (color.b > .62) {
    vec2 facing = normalize(eye.xz - base.xz + 1e-4);
    vRight = vec3(facing.y, 0., -facing.x); vNormal = vec3(facing.x, 0., facing.y);
    p = vec4(base + vRight * position.x * length(finalWorld[0].xyz) + vec3(0., position.y * length(finalWorld[1].xyz), 0.), 1.);
    p.xz += gust * max(position.y, 0.) * .025;
  } else {
    p = finalWorld * vec4(position, 1.);
    p.xz += gust * sway;
    p.xyz += leaf * sway * .07 * vec3(sin(time * 2.3 + color.a * 40.), sin(time * 1.9 + color.a * 31.), cos(time * 2.1 + color.a * 23.));
    vNormal = mat3(finalWorld) * normal; vRight = vec3(1., 0., 0.);
  }
  vWorld = p.xyz; vPart = color; vUv = uv; vSeed = worldHash(base.xz * .113 + 3.); vSpread = length(finalWorld[0].xyz) / length(finalWorld[1].xyz);
  gl_Position = viewProjection * p;
}`;

const TREE_FRAGMENT = `precision highp float;
varying vec3 vWorld, vNormal, vRight; varying vec4 vPart; varying vec2 vUv; varying float vSeed, vSpread;
uniform vec3 eye, sun, sunColor, skyAmbient, groundAmbient, shadowTint, fogNear, fogFar, fogSun;
uniform vec3 leafTop, leafUnder, leafBack, leafCrown, needleTop, needleUnder, bark;
uniform float sunStrength, shadowLift, fogDensity, fogHeight, time, goldenHour;
${WORLD_GLSL}
${RIDGE_LIFT_GLSL}
vec3 treeAir(vec3 color) { return liftRidges(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), vWorld.y, distance(eye, vWorld)); }
float leaves(vec2 uv, float seed) {
  vec2 g = uv * 7. + seed * 31.7, cell = floor(g - .5);
  float best = 0.;
  for (int i = 0; i <= 1; i++) for (int j = 0; j <= 1; j++) {
    vec2 c = cell + vec2(float(i), float(j)), centre = c + vec2(worldHash(c + 3.1), worldHash(c + 7.7)), d = g - centre, q = (centre - seed * 31.7) / 3.5 - 1.;
    float h = worldHash(c), a = h * 6.283, x = (cos(a) * d.x + sin(a) * d.y) / .8, y = -sin(a) * d.x + cos(a) * d.y;
    best = max(best, step(dot(q, q), .7) * step(x * x + y * y * 2.2, .55 + .25 * h) * (.88 + .12 * h));
  }
  return best;
}
void clump(vec2 c, vec2 centre, float radius, float seed, inout vec4 best) {
  float reach = radius * (.9 + .25) * sqrt(1. - max(best.x, 0.));
  if (length(c - centre) >= reach + length(vec2(.45))) return;
  vec2 off = c - centre - (vec2(worldHash(centre + seed), worldHash(centre.yx + seed)) - .5) * .9;
  if (dot(off, off) >= reach * reach) return;
  vec2 d = off / (radius * (.9 + .25 * worldNoise(c * 1.7 + seed * 19. + centre)));
  float h = 1. - dot(d, d);
  if (h > best.x) best = vec4(h, d, 0.);
}
vec3 foliage(vec3 n, vec3 v, float ao, float needle, float tint, float leaf) {
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .5 + .5), shade = shadowTint * shadowLift + ambient * .35, lit = sunColor * sunStrength;
  float soft = .45 - .3 * goldenHour, wrap = clamp((dot(n, sun) + soft) / (1. + soft), 0., 1.), light = wrap * mix(.4, 1., ao);
  vec3 top = mix(leafTop, needleTop, needle), under = mix(leafUnder, needleUnder, needle);
  top = mix(top, top * vec3(1.12, 1.06, .78), tint * (1. - needle) * .6);
  top = mix(top, top * vec3(.8, .92, 1.04), smoothstep(.5, 1., fract(tint * 7.31)) * (1. - needle) * .8);
  top = mix(top, leafBack, goldenHour * light * sqrt(light) * (1. - needle * .5) * .75);
  vec3 color = mix(under * (shade * 1.5 + .32), top * lit, light) * mix(.84, 1., clamp(n.y * .5 + .5, 0., 1.)) * mix(.78, 1., ao) * leaf;
  vec3 crown = mix(leafCrown, top * lit, needle * .5) * (top / max(mix(leafTop, needleTop, needle), vec3(.01)));
  color = mix(color, crown * leaf, smoothstep(.12, .75, n.y) * mix(.5, 1., ao) * (1. - light * (.6 + .3 * goldenHour)) * .9);
  float edge = pow(1. - abs(dot(v, n)), 3.);
  float through = pow(clamp(dot(-v, sun), 0., 1.), 4.) * (.3 + .7 * edge) * (1. - wrap * .5) * .6 * mix(.5, 1., ao);
  float rim = pow(1. - abs(dot(v, n)), 1.6) * smoothstep(.4, .9, dot(n, normalize(sun + vec3(0., 1., 0.)))) * .8;
  color = mix(color, leafBack * lit * leaf, rim) + leafBack * sunStrength * through * leaf;
  return mix(color, leafBack * lit * leaf, goldenHour * clamp(through * edge * 3., 0., .7));
}
void main() {
  float part = vPart.b, needle = step(.37, part) * (1. - step(.62, part)) + step(.87, part);
  vec3 toEye = eye - vWorld; float dist = length(toEye); vec3 v = toEye / dist;
  vec3 ambient = mix(groundAmbient, skyAmbient, .6), shade = shadowTint * shadowLift + ambient * .35, lit = sunColor * sunStrength;
  vec3 color;
  if (part < .12) {
    vec3 n = normalize(vNormal);
    color = bark * mix(shade * 1.25, lit, clamp(dot(n, sun) * .5 + .5, 0., 1.) * vPart.r) * (.7 + .3 * vPart.r);
  } else if (part > .62) {
    vec2 c = vUv; float seed = vSeed * 7.31;
    vec3 facing = normalize(vNormal), n; float ao, h, underside = 1.;
    if (needle > .5) {
      float t = clamp((c.y - 1.8) / 12.4, 0., 1.), tier = fract(-t * 6.5 + seed), w = 3.5 * pow(1. - t, .95) * (.74 + .26 * tier) * (.92 + .16 * worldNoise(c * 2.3 + seed * 11.));
      float nx = c.x / max(w, .05); h = 1. - nx * nx;
      if (c.y < 1.8 || h < 0.) { if (abs(c.x) < .28 && c.y < 3.) { color = bark * shade * 1.3; gl_FragColor = vec4(treeAir(color), 1.); return; } discard; }
      n = normalize(vRight * nx * .85 + vec3(0., .25 + .45 * (1. - tier), 0.) + facing * sqrt(h));
      ao = clamp(.3 + .45 * sqrt(1. - h) + .25 * t + .2 * (1. - tier), 0., 1.);
    } else {
      vec4 best = vec4(-1.);
      float flip = fract(seed * .53) < .5 ? -1. : 1.; vec2 m = vec2(c.x * flip, c.y);
      if (vSpread > 1.2) {
        clump(m, vec2(-3.4, 6.), 2.1 * (.75 + .5 * fract(seed * 1.7)), seed, best); clump(m, vec2(-.9, 7.4), 2.6 * (.75 + .5 * fract(seed * 2.3)), seed, best); clump(m, vec2(2.1, 6.6), 2.4 * (.75 + .5 * fract(seed * 3.1)), seed, best); clump(m, vec2(3.9, 4.9), 1.5 * (.6 + .8 * fract(seed * 4.3)), seed, best);
        clump(m, vec2(-2.5, 3.), 2.6 * (.8 + .4 * fract(seed * 5.9)), seed, best); clump(m, vec2(1., 3.2), 2.9 * (.8 + .4 * fract(seed * 6.7)), seed, best); clump(m, vec2(3.6, 2.6), 1.8 * (.7 + .6 * fract(seed * 7.9)), seed, best);
        if (best.x < 0.) discard;
      } else {
        clump(m, vec2(0., 7.9), 2.7 * (.8 + .4 * fract(seed * 1.7)), seed, best); clump(m, vec2(-2.9, 6.3), 2.2 * (.7 + .6 * fract(seed * 2.3)), seed, best); clump(m, vec2(2.8, 6.5), 2.2 * (.7 + .6 * fract(seed * 3.1)), seed, best);
        clump(m, vec2(-1.4, 5.5), 2.3 * (.75 + .5 * fract(seed * 4.3)), seed, best); clump(m, vec2(1.5, 5.7), 2.3 * (.75 + .5 * fract(seed * 5.9)), seed, best); clump(m, vec2(.4, 9.3), 1.7 * (.5 + fract(seed * 6.7)), seed, best);
      }
      h = best.x; best.y *= flip; underside = smoothstep(0., 2.6, c.y - (vSpread > 1.2 ? .6 : 3.2) + best.z * 1.2);
      if (h < 0.) { if (abs(c.x) < .42 - c.y * .03 && c.y < 4.6) { color = bark * mix(shade * 1.25, lit, .25); gl_FragColor = vec4(treeAir(color), 1.); return; } discard; }
      vec2 dc = (c - vec2(0., 6.6)) / 5.2;
      vec3 local = normalize(normalize(vec3(dc, sqrt(max(1. - dot(dc, dc), .05)))) * .55 + normalize(vec3(best.yz, sqrt(h))) * .45);
      n = normalize(vRight * local.x + vec3(0., local.y, 0.) + facing * local.z);
      ao = clamp(.16 + .64 * smoothstep(3.5, 9.8, c.y) + .28 * sqrt(h), 0., 1.);
    }
    vec2 turned = mat2(.8, -.6, .6, .8) * c;
    float mottle = dist < 1100. ? mix(.86 + .2 * worldNoise(turned * 1.7 + seed * 7.) + .1 * worldNoise(turned * 4.1 - seed * 3.), 1., smoothstep(350., 1100., dist)) : 1.;
    color = foliage(n, v, ao, needle, vSeed, mottle);
    float back = pow(clamp(dot(-v, sun), 0., 1.), 2.), band = smoothstep(40., 180., dist) * (1. - smoothstep(900., 1600., dist));
    color = mix(color, leafBack * lit, back * band * .7 * (1. - sqrt(max(h, 0.))) * clamp(n.y + .4, 0., 1.));
    color *= mix(.6, 1., underside);
    vec3 field = mix(mix(leafUnder, needleUnder, needle) * (shade * 1.35 + .25), mix(leafCrown, needleTop * lit, needle), .32);
    color = mix(color, field, smoothstep(300., 1500., dist) * .8);
    color = mix(color, leafBack * lit, goldenHour * back * smoothstep(.2, .9, n.y) * (1. - sqrt(max(h, 0.))) * .9);
  } else {
    vec2 q = vUv * 2. - 1.; float body = 1. - dot(q, q), seed = vPart.a, leaf;
    if (needle > .5) {
      float tooth = abs(fract(vUv.x * 3. + seed * 7.) - .5) * 2., ragged = worldNoise(vec2(vUv.x * 9., seed * 11.));
      if (vUv.y > .72 + .28 * (1. - tooth) * (.6 + .4 * ragged)) discard;
      leaf = .76 + .24 * worldNoise(vec2(vUv.x * 30., vUv.y * 5. + seed * 3.));
    } else if (part < .2) {
      leaf = .72 + .2 * worldNoise(vWorld.xz * 1.1 + vWorld.y * .7);
    } else if (dist > mix(75., 110., seed)) {
      if (body + (worldNoise(vUv * 3.5 + seed * 17.) - .5) * .8 + (worldNoise(vUv * 9. + seed * 5.) - .5) * .3 < .3) discard;
      leaf = .92;
    } else {
      leaf = leaves(vUv, seed);
      if (leaf <= 0. && body < .62) discard;
      if (leaf <= 0.) leaf = .84;
    }
    color = foliage(normalize(vNormal), v, vPart.r, needle, vSeed, leaf);
  }
  gl_FragColor = vec4(treeAir(color), 1.);
}`;

export function createWorldTrees(scene, { root, still, rings }) {
  const planted = plantTrees(rings);
  const paint = new ShaderMaterial('world-trees-paint', scene, { vertexSource: TREE_VERTEX, fragmentSource: TREE_FRAGMENT }, {
    attributes: ['position', 'normal', 'color', 'uv'],
    uniforms: ['world', 'viewProjection', ...AIR_UNIFORMS, ...RIDGE_UNIFORMS, 'sunStrength', 'shadowLift', 'goldenHour', ...LIGHT_COLORS, ...FOLIAGE_COLORS],
  });
  paint.backFaceCulling = false;
  followEye(scene, paint, still);
  const matrices = new Float32Array(planted.count * 16);
  for (let i = 0; i < planted.count; i++) {
    const w = planted.width[i], c = Math.cos(planted.turn[i]) * w, s = Math.sin(planted.turn[i]) * w;
    matrices.set([c, 0, -s, 0, 0, planted.height[i], 0, 0, s, 0, c, 0, planted.x[i], planted.y[i], planted.z[i], 1], i * 16);
  }
  const tiers = TREE_KINDS.flatMap(({ name }, kind) => {
    const total = planted.kind.reduce((sum, k) => sum + (k === kind ? 1 : 0), 0);
    return ['near', 'far'].map(tier => {
      const mesh = new Mesh(`world-trees-${name}-${tier}`, scene);
      Object.assign(new VertexData(), TREE_KINDS[kind][tier]()).applyToMesh(mesh);
      mesh.material = paint; mesh.parent = root; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.metadata = { castShadow: false, world: true };
      const buffer = new Float32Array(Math.max(1, total) * 16);
      mesh.thinInstanceSetBuffer('matrix', buffer, 16, false);
      return { mesh, buffer, count: 0 };
    });
  });
  const centre = new Vector3(Infinity, 0, Infinity), local = new Vector3(), inverse = new Matrix();
  function sortAround(x, z) {
    centre.set(x, 0, z);
    for (const tier of tiers) tier.count = 0;
    for (let i = 0; i < planted.count; i++) {
      const near = (planted.x[i] - x) ** 2 + (planted.z[i] - z) ** 2 < NEAR_TREES * NEAR_TREES, tier = tiers[planted.kind[i] * 2 + (near ? 0 : 1)];
      for (let k = 0; k < 16; k++) tier.buffer[tier.count * 16 + k] = matrices[i * 16 + k];
      tier.count++;
    }
    for (const tier of tiers) {
      tier.mesh.thinInstanceCount = tier.count; tier.mesh.setEnabled(tier.count > 0);
      if (tier.count) tier.mesh.thinInstanceBufferUpdated('matrix');
    }
  }
  const watch = scene.onBeforeRenderObservable.add(() => {
    const camera = scene.activeCamera; if (!camera) return;
    root.computeWorldMatrix().invertToRef(inverse); Vector3.TransformCoordinatesToRef(camera.globalPosition, inverse, local);
    if ((local.x - centre.x) ** 2 + (local.z - centre.z) ** 2 > 15 * 15) sortAround(local.x, local.z);
  });
  paint.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(watch));
  sortAround(0, 0);
  return {
    planted, paint, meshes: tiers.map(tier => tier.mesh),
    setTheme(atmosphere) {
      applyAir(paint, atmosphere); applyRidges(paint, atmosphere);
      for (const key of [...FOLIAGE_COLORS, ...LIGHT_COLORS]) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
      paint.setFloat('sunStrength', atmosphere.sunStrength); paint.setFloat('shadowLift', atmosphere.shadowLift); paint.setFloat('goldenHour', atmosphere.goldenHour);
    },
  };
}
