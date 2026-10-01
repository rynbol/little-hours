import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration.js';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex.js';
import { WORLD, riverDistance, smooth, noise2 } from '../../core/world-terrain.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';

export const TREE_BANDS = Object.freeze([
  Object.freeze({ from: 25, to: 450, spacing: 8, size: 1, behind: 450 }),
  Object.freeze({ from: 450, to: 1300, spacing: 14, size: 1.7, behind: 200 }),
  Object.freeze({ from: 1300, to: 3400, spacing: 24, size: 2.6, behind: 200 }),
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

const FOLIAGE = new Map([
  [WORLD_ATMOSPHERES.day, { leafTop: '#92c840', leafUnder: '#3a6a30', leafBack: '#d8ea78', needleTop: '#4f8a3c', needleUnder: '#24452e', bark: '#76825a' }],
  [WORLD_ATMOSPHERES.dusk, { leafTop: '#8fa04a', leafUnder: '#2f4c38', leafBack: '#e8a050', needleTop: '#667a40', needleUnder: '#2a3a2c', bark: '#544c3c' }],
  [WORLD_ATMOSPHERES.rain, { leafTop: '#64804a', leafUnder: '#3c4c36', leafBack: '#7a8458', needleTop: '#4a6040', needleUnder: '#33402f', bark: '#4a5038' }],
]);
const FOLIAGE_COLORS = Object.keys(FOLIAGE.get(WORLD_ATMOSPHERES.day));
const LIGHT_COLORS = ['sunColor', 'skyAmbient', 'groundAmbient', 'shadowTint'];

const PART = Object.freeze({ bark: 0, leaf: 0.25, needle: 0.5, farLeaf: 0.75, farNeedle: 1 });

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
    const n = Math.round(Math.sqrt(positions.length / 3));
    return { n, radius: -positions[0], step: positions[n * 3] - positions[0], positions, normals, colors };
  });
  const at = { y: 0, cover: 0, up: 1, wet: 0 };
  return (x, z) => {
    let g = null;
    for (const grid of grids) if (Math.abs(x) < grid.radius && Math.abs(z) < grid.radius) { g = grid; break; }
    if (!g) return null;
    const u = (x + g.radius) / g.step, w = (z + g.radius) / g.step, i = Math.min(g.n - 2, Math.floor(u)), j = Math.min(g.n - 2, Math.floor(w)), fu = u - i, fw = w - j, a = i * g.n + j, b = a + g.n;
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
  const plant = (px, pz, at, grow, spin, conifer, tall) => {
    x.push(px); z.push(pz); y.push(at.y - 0.5 * grow); turn.push(spin);
    width.push(grow); height.push(grow * tall); kind.push(conifer ? 1 : 0);
  };
  for (const hero of HERO_TREES) {
    const at = ground(hero.x, hero.z), top = WINDOW_EYE.y - hero.distance * VISTA.dip;
    if (at) plant(hero.x, hero.z, at, Math.max(0.6, Math.min(hero.size, (top - at.y) / (CROWN_TOP - 0.5))), hero.turn, false, 1);
  }
  TREE_BANDS.forEach(({ from, to, spacing, size, behind }, band) => {
    const cells = Math.ceil(to / spacing), lone = spacing * spacing / LONE_TREE_AREA, salt = band * 8;
    for (let gx = -cells; gx < cells; gx++) for (let gz = -cells; gz < Math.ceil(behind / spacing); gz++) {
      const px = (gx + hash(gx, gz, salt + 1)) * spacing, pz = (gz + hash(gx, gz, salt + 2)) * spacing, d = Math.hypot(px, pz);
      if (d < from || d >= to || pz > behind || riverDistance(px, pz) < RIVER_CLEARANCE) continue;
      if (HERO_TREES.some(hero => Math.hypot(px - hero.x, pz - hero.z) < HERO_CLEARANCE * hero.size)) continue;
      const at = ground(px, pz);
      if (!at) continue;
      const grove = smooth(-0.1, 0.3, noise2(px / 150, pz / 150, 91) + 0.35 * noise2(px / 48, pz / 48, 92));
      const meadow = lone * smooth(0.9, 0.96, at.up) * (1 - smooth(0.12, 0.35, at.cover)) * (at.wet > 0 ? 0 : 1);
      const forest = smooth(0.04, 0.3, at.cover) * grove * 1.3, roll = hash(gx, gz, salt + 3);
      if (roll >= forest && roll >= meadow) continue;
      const alone = roll >= forest, stand = smooth(-0.05, 0.35, noise2(px / 90, pz / 90, 93)), conifer = !alone && hash(gx, gz, salt + 4) < (0.85 * smooth(25, 120, at.y) + 0.5 * smooth(0.95, 0.85, at.up)) * stand;
      const grow = size * (0.8 + 0.45 * hash(gx, gz, salt + 5)) * (alone ? 1.3 : 1), tall = 0.88 + 0.28 * hash(gx, gz, salt + 7);
      if (at.y - 0.5 * grow + grow * tall * (conifer ? 14.6 : CROWN_TOP) > sightLine(px, pz)) continue;
      plant(px, pz, at, grow, hash(gx, gz, salt + 6) * Math.PI * 2, conifer, tall);
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
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + rand() * 0.5, d = 2.5 + rand() * 0.7; clumps.push({ c: [Math.cos(a) * d, 5.9 + rand() * 1.1, Math.sin(a) * d], r: 2 + rand() * 0.5 }); }
  const barkColor = p => [0.45 + 0.5 * smooth(-0.5, 6, p[1]), 0.08 * smooth(1, 6, p[1]), PART.bark, 0];
  s.tube([0, -0.8, 0], fork, 0.5, 0.33, 7, barkColor);
  for (const { c } of clumps) s.tube(fork, add(fork, sub(c, fork), 0.8), 0.22, 0.08, 5, barkColor);
  for (const { c, r } of clumps) {
    const normalOf = v => blendNormal(v, canopy, c, 0.45), colorOf = seed => v => {
      const out = sub(v, canopy), depth = Math.min(1, Math.hypot(...out) / 4.8);
      return [Math.min(1, Math.max(0.2, 0.42 + 0.3 * out[1] / (Math.hypot(...out) || 1) + 0.28 * depth)), Math.min(1, (v[1] / 9) ** 1.5), PART.leaf, seed];
    };
    scatterCards(s, rand, c, r, 0.8, 16, 0.62, 0.3, normalOf, colorOf);
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
varying vec3 vWorld, vNormal, vRight; varying vec4 vPart; varying vec2 vUv; varying float vSeed;
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
  vWorld = p.xyz; vPart = color; vUv = uv; vSeed = worldHash(base.xz * .113 + 3.);
  gl_Position = viewProjection * p;
}`;

const TREE_FRAGMENT = `precision highp float;
varying vec3 vWorld, vNormal, vRight; varying vec4 vPart; varying vec2 vUv; varying float vSeed;
uniform vec3 eye, sun, sunColor, skyAmbient, groundAmbient, shadowTint, fogNear, fogFar, fogSun;
uniform vec3 leafTop, leafUnder, leafBack, needleTop, needleUnder, bark;
uniform float sunStrength, shadowLift, fogDensity, fogHeight, time;
${WORLD_GLSL}
float leaves(vec2 uv, float seed) {
  vec2 g = uv * 12. + seed * 31.7, cell = floor(g - .5);
  float best = 0.;
  for (int i = 0; i <= 1; i++) for (int j = 0; j <= 1; j++) {
    vec2 c = cell + vec2(float(i), float(j)), d = g - c - vec2(worldHash(c + 3.1), worldHash(c + 7.7));
    float h = worldHash(c), a = h * 6.283, x = (cos(a) * d.x + sin(a) * d.y) / .66, y = -sin(a) * d.x + cos(a) * d.y;
    best = max(best, step(abs(x), 1.) * step(abs(y), .3 * (1. - x * x)) * (.86 + .14 * h));
  }
  return best;
}
void clump(vec2 c, vec2 centre, float radius, float seed, inout vec4 best) {
  vec2 d = (c - centre - (vec2(worldHash(centre + seed), worldHash(centre.yx + seed)) - .5) * .9) / (radius * (.9 + .25 * worldNoise(c * 1.7 + seed * 19. + centre)));
  float h = 1. - dot(d, d);
  if (h > best.x) best = vec4(h, d, 0.);
}
vec3 foliage(vec3 n, vec3 v, float ao, float needle, float tint, float leaf) {
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .5 + .5), shade = shadowTint * shadowLift + ambient * .35, lit = sunColor * sunStrength;
  float wrap = clamp((dot(n, sun) + .45) / 1.45, 0., 1.), light = wrap * mix(.4, 1., ao);
  vec3 top = mix(leafTop, needleTop, needle), under = mix(leafUnder, needleUnder, needle);
  top = mix(top, top * vec3(1.12, 1.06, .78), tint * (1. - needle) * .6);
  vec3 color = mix(under * (shade * 1.35 + .25), top * lit, light) * mix(.8, 1., clamp(n.y * .5 + .5, 0., 1.)) * mix(.7, 1., ao) * leaf;
  float edge = pow(1. - abs(dot(v, n)), 3.);
  float through = pow(clamp(dot(-v, sun), 0., 1.), 4.) * (.12 + .88 * edge) * (1. - wrap * .5) * .6 * mix(.5, 1., ao);
  float rim = edge * wrap * .25;
  return color + leafBack * sunStrength * (through + rim) * leaf;
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
    vec3 facing = normalize(vNormal), n; float ao, h;
    if (needle > .5) {
      float t = clamp((c.y - 1.8) / 12.4, 0., 1.), tier = fract(-t * 6.5 + seed), w = 3.5 * pow(1. - t, .95) * (.74 + .26 * tier) * (.92 + .16 * worldNoise(c * 2.3 + seed * 11.));
      float nx = c.x / max(w, .05); h = 1. - nx * nx;
      if (c.y < 1.8 || h < 0.) { if (abs(c.x) < .28 && c.y < 3.) { color = bark * shade * 1.3; gl_FragColor = vec4(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), 1.); return; } discard; }
      n = normalize(vRight * nx * .85 + vec3(0., .25 + .45 * (1. - tier), 0.) + facing * sqrt(h));
      ao = clamp(.3 + .45 * sqrt(1. - h) + .25 * t + .2 * (1. - tier), 0., 1.);
    } else {
      vec4 best = vec4(-1.);
      clump(c, vec2(0., 7.9), 2.7, seed, best); clump(c, vec2(-2.9, 6.3), 2.2, seed, best); clump(c, vec2(2.8, 6.5), 2.2, seed, best);
      clump(c, vec2(-1.4, 5.5), 2.3, seed, best); clump(c, vec2(1.5, 5.7), 2.3, seed, best); clump(c, vec2(.4, 9.3), 1.7, seed, best);
      h = best.x;
      if (h < 0.) { if (abs(c.x) < .42 - c.y * .03 && c.y < 4.6) { color = bark * mix(shade * 1.25, lit, .25); gl_FragColor = vec4(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), 1.); return; } discard; }
      vec2 dc = (c - vec2(0., 6.6)) / 5.2;
      vec3 local = normalize(normalize(vec3(dc, sqrt(max(1. - dot(dc, dc), .05)))) * .55 + normalize(vec3(best.yz, sqrt(h))) * .45);
      n = normalize(vRight * local.x + vec3(0., local.y, 0.) + facing * local.z);
      ao = clamp(.16 + .64 * smoothstep(3.5, 9.8, c.y) + .28 * sqrt(h), 0., 1.);
    }
    float mottle = mix(.8 + .4 * worldNoise(c * 2.4 + seed * 7.), 1., smoothstep(350., 1100., dist));
    color = foliage(n, v, ao, needle, vSeed, mottle);
    vec3 field = mix(mix(leafUnder, needleUnder, needle) * (shade * 1.35 + .25), mix(leafTop, needleTop, needle) * lit, .45);
    color = mix(color, field, smoothstep(300., 1500., dist) * .8);
  } else {
    vec2 q = vUv * 2. - 1.; float body = 1. - dot(q, q), seed = vPart.a, leaf;
    if (needle > .5) {
      float tooth = abs(fract(vUv.x * 3. + seed * 7.) - .5) * 2., ragged = worldNoise(vec2(vUv.x * 9., seed * 11.));
      if (vUv.y > .72 + .28 * (1. - tooth) * (.6 + .4 * ragged)) discard;
      leaf = .76 + .24 * worldNoise(vec2(vUv.x * 30., vUv.y * 5. + seed * 3.));
    } else if (dist > mix(75., 110., seed)) {
      if (body + (worldNoise(vUv * 3.5 + seed * 17.) - .5) * .8 + (worldNoise(vUv * 9. + seed * 5.) - .5) * .3 < .3) discard;
      leaf = .92;
    } else {
      leaf = leaves(vUv, seed);
      if (leaf <= 0. && body < .62) discard;
      if (leaf <= 0.) leaf = .8;
    }
    color = foliage(normalize(vNormal), v, vPart.r, needle, vSeed, leaf);
  }
  gl_FragColor = vec4(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), 1.);
}`;

export function createWorldTrees(scene, { root, still, rings }) {
  const planted = plantTrees(rings);
  const paint = new ShaderMaterial('world-trees-paint', scene, { vertexSource: TREE_VERTEX, fragmentSource: TREE_FRAGMENT }, {
    attributes: ['position', 'normal', 'color', 'uv'],
    uniforms: ['world', 'viewProjection', ...AIR_UNIFORMS, 'sunStrength', 'shadowLift', ...LIGHT_COLORS, ...FOLIAGE_COLORS],
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
      applyAir(paint, atmosphere);
      const foliage = FOLIAGE.get(atmosphere) || FOLIAGE.get(WORLD_ATMOSPHERES.day);
      for (const key of FOLIAGE_COLORS) paint.setColor3(key, Color3.FromHexString(foliage[key]));
      for (const key of LIGHT_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
      paint.setFloat('sunStrength', atmosphere.sunStrength); paint.setFloat('shadowLift', atmosphere.shadowLift);
    },
  };
}
