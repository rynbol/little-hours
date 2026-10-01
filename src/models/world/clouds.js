import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector4 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt, WORLD } from '../../core/world-terrain.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';
import { SKY_GLSL, SKY_UNIFORMS, applySkyTheme } from './sky.js';
import { LANDMARKS, PLUME } from './landmarks.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

export const CLOUD_KINDS = Object.freeze({ cumulus: 0, wisp: 1, mist: 2 });
export const HERO_BANKS = Object.freeze([
  Object.freeze({ kind: 'cumulus', bearing: -0.53, distance: 4450, base: 440, width: 2200, tall: 0.11, stretch: 3, spin: 0, seed: 11 }),
  Object.freeze({ kind: 'cumulus', bearing: -0.57, distance: 3900, base: 360, width: 2500, tall: 0.144, stretch: 2, spin: 0, seed: 29 }),
  Object.freeze({ kind: 'cumulus', bearing: -0.68, distance: 3600, base: 300, width: 2600, tall: 0.1, stretch: 3.5, spin: 0, seed: 53 }),
  Object.freeze({ kind: 'cumulus', bearing: -0.95, distance: 3600, base: 900, width: 1100, tall: 0.16, stretch: 1.8, spin: 0.0003, seed: 83 }),
  Object.freeze({ kind: 'cumulus', bearing: -0.25, distance: 3800, base: 880, width: 1400, tall: 0.16, stretch: 1.8, spin: 0.0003, seed: 71 }),
  Object.freeze({ kind: 'cumulus', bearing: 0.3, distance: 2400, base: 960, width: 1200, tall: 0.21, spin: 0.0003, seed: 37 }),
  Object.freeze({ kind: 'wisp', bearing: -0.18, distance: 4400, base: 1260, width: 1700, tall: 0.07, spin: 0.0003, seed: 19 }),
  Object.freeze({ kind: 'wisp', bearing: 0.12, distance: 4200, base: 1330, width: 2200, tall: 0.06, spin: 0.0003, seed: 43 }),
  Object.freeze({ kind: 'cumulus', bearing: 0.271, distance: 4608, base: 796, width: 888, tall: 0.342, spin: 0.0011, seed: 24.96 }),
  Object.freeze({ kind: 'cumulus', bearing: 0.442, distance: 3512, base: 562, width: 2530, tall: 0.3, spin: 0.0011, seed: 52.2 }),
  Object.freeze({ kind: 'cumulus', bearing: 0.473, distance: 3536, base: 536, width: 1972, tall: 0.309, spin: 0.0011, seed: 47.3 }),
  Object.freeze({ kind: 'cumulus', bearing: 0.515, distance: 4713, base: 962, width: 708, tall: 0.356, spin: 0.0011, seed: 39.05 }),
  Object.freeze({ kind: 'cumulus', bearing: 0.586, distance: 3749, base: 567, width: 1682, tall: 0.293, spin: 0.0011, seed: 17.2 }),
  Object.freeze({ kind: 'cumulus', bearing: 0.696, distance: 3760, base: 844, width: 1262, tall: 0.321, spin: 0.0011, seed: 23.1 }),
]);
export const HERO_WEDGE = Object.freeze([-1, 0.8]);
export const CLOUD_BANKS = Object.freeze([
  Object.freeze({ kind: 'cumulus', stream: 0, count: 6, distance: [1600, 6500], base: [360, 1000], width: [700, 2600], tall: [0.27, 0.36], skew: 1.6, spin: 0.0011 }),
  Object.freeze({ kind: 'wisp', stream: 2, count: 5, distance: [4000, 8000], base: [1150, 1450], width: [1800, 3800], tall: [0.05, 0.08], skew: 1, spin: 0.0005 }),
  Object.freeze({ kind: 'mist', stream: 3, count: 24, distance: [260, 1900], base: [-6, -3], width: [160, 420], tall: [0.07, 0.12], skew: 1, front: 0.65, arc: 1.2, spin: 0 }),
]);
const CLOUD_COLORS = ['cloudLit', 'cloudShade', 'cloudRim'];
const CUMULUS_ROWS = Object.freeze([-0.62, 0.8]);
export const PLUME_COLUMN = Object.freeze({ x: LANDMARKS.peak.x, z: LANDMARKS.peak.z, reach: 0.1, summit: LANDMARKS.peak.summit + PLUME.rise * 0.1 });

export function clearsPlume({ x, y, z, halfWidth, halfHeight }, eye = [0, 0]) {
  const cardX = x - eye[0], cardZ = z - eye[1], plumeX = PLUME_COLUMN.x - eye[0], plumeZ = PLUME_COLUMN.z - eye[1], out = Math.hypot(cardX, cardZ);
  const apart = Math.acos(Math.max(-1, Math.min(1, (cardX * plumeX + cardZ * plumeZ) / (out * Math.hypot(plumeX, plumeZ)))));
  const reach = halfWidth / out + PLUME_COLUMN.reach, above = y / out > PLUME_COLUMN.summit / Math.hypot(plumeX, plumeZ);
  return !above || apart > reach * 1.25 + 0.03;
}

export function clearsSnowCap({ x, y, z, halfWidth, halfHeight }) {
  const { x: peakX, z: peakZ, summit, snowLine } = LANDMARKS.peak, out = Math.hypot(x, z), far = Math.hypot(peakX, peakZ);
  const apart = Math.acos(Math.max(-1, Math.min(1, (x * peakX + z * peakZ) / (out * far))));
  const top = (y + halfHeight * CUMULUS_ROWS[1]) / out, bottom = (y + halfHeight * CUMULUS_ROWS[0]) / out;
  return out >= far || apart > halfWidth / out + 0.12 || top < (snowLine + summit) / 2 / far || bottom > summit / far;
}

const SUNS = ['day', 'dusk'].map(theme => WORLD_ATMOSPHERES[theme].sun);

export function clearsSuns({ x, y, z, halfWidth, halfHeight }) {
  const out = Math.hypot(x, z), bearing = Math.atan2(x, -z), up = Math.atan2(y, out);
  return SUNS.every(([sunX, sunY, sunZ]) => Math.hypot((bearing - Math.atan2(sunX, -sunZ)) * out / halfWidth, (up - Math.asin(sunY)) * out / halfHeight) > 1.2);
}

export function clearsSkyline({ x, y, z }, height = heightAt) {
  const out = Math.hypot(x, z);
  for (let step = 300; step < out; step += 50) if (height(x * step / out, z * step / out) / step >= y / out) return false;
  return true;
}

const seeded = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const span = ([low, high], t) => low + (high - low) * t;

const fitsSky = (card, height) => clearsPlume(card) && clearsSuns(card) && (card.kind !== CLOUD_KINDS.cumulus || clearsSnowCap(card)) && clearsSkyline(card, height);
const overlapsWedge = ({ x, z, halfWidth }) => { const bearing = Math.atan2(x, -z), reach = halfWidth / Math.hypot(x, z); return bearing + reach > HERO_WEDGE[0] && bearing - reach < HERO_WEDGE[1]; };

function heroCard({ kind, bearing, distance, base, width, tall, stretch = 1, spin, seed }, height) {
  const x = Math.sin(bearing) * distance, z = -Math.cos(bearing) * distance, halfWidth = width / 2, halfHeight = halfWidth * tall * 2;
  const card = { kind: CLOUD_KINDS[kind], x, y: base + halfHeight * 0.6, z, halfWidth, halfHeight, spin, seed, stretch };
  const sideX = Math.cos(bearing) * halfWidth, sideZ = Math.sin(bearing) * halfWidth;
  return base >= Math.max(height(x, z), height(x + sideX, z + sideZ), height(x - sideX, z - sideZ)) + 120 && fitsSky(card, height) ? card : null;
}

export function cloudCards(seed = WORLD.seed, height = heightAt) {
  const cards = HERO_BANKS.map(bank => heroCard(bank, height)).filter(Boolean);
  for (const bank of CLOUD_BANKS) {
    for (let placed = 0, tries = 0; placed < bank.count && tries < bank.count * 40; tries++) {
      const random = seeded((seed * 977 + 13) ^ Math.imul(bank.stream + 1, 0x9e3779b1) ^ Math.imul(tries + 1, 0x85ebca77));
      const front = random() < (bank.front ?? 0), bearing = front ? (random() - 0.5) * 2 * bank.arc : random() * Math.PI * 2;
      const r = span(bank.distance, random() ** 0.8), x = Math.sin(bearing) * r, z = -Math.cos(bearing) * r;
      const halfWidth = span(bank.width, random() ** bank.skew) / 2, halfHeight = halfWidth * span(bank.tall, random()) * 2;
      const ground = Math.max(height(x, z), height(x + halfWidth, z), height(x - halfWidth, z));
      let base = span(bank.base, random());
      if (bank.kind === 'mist') { if (ground > WORLD.valleyFloor + 2) continue; base += ground; }
      else if (base < ground + 120) continue;
      const card = { kind: CLOUD_KINDS[bank.kind], x, y: base + halfHeight * 0.6, z, halfWidth, halfHeight, spin: bank.spin, seed: random() * 97, stretch: 1 };
      if (bank.kind !== 'mist' && (overlapsWedge(card) || !fitsSky(card, height))) continue;
      cards.push(card);
      placed++;
    }
  }
  return cards.sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z));
}

export function cloudShape(cards) {
  const positions = new Float32Array(cards.length * 12), uvs = new Float32Array(cards.length * 8), seeds = new Float32Array(cards.length * 8), sizes = new Float32Array(cards.length * 16), indices = new Uint16Array(cards.length * 6);
  cards.forEach((card, c) => {
    const [low, high] = card.kind === CLOUD_KINDS.cumulus ? CUMULUS_ROWS : [-1, 1];
    [[-1, low], [1, low], [1, high], [-1, high]].forEach(([u, v], k) => {
      const i = c * 4 + k;
      positions.set([card.x, card.y, card.z], i * 3); uvs.set([u, v], i * 2); seeds.set([card.seed, card.kind], i * 2);
      sizes.set([card.halfWidth, card.halfHeight, card.spin, card.stretch], i * 4);
    });
    indices.set([0, 1, 2, 0, 2, 3].map(k => c * 4 + k), c * 6);
  });
  return { positions, uvs, uvs2: seeds, colors: sizes, indices };
}

const CLOUD_VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv, uv2; attribute vec4 color;
uniform mat4 world, viewProjection; uniform vec3 eye; uniform vec4 plume; uniform float time;
varying vec3 vWorld; varying vec2 vUv, vSeed; varying float vAspect, vClear, vStretch;
void main() {
  float spin = time * color.z, s = sin(spin), c = cos(spin);
  vec3 center = (world * vec4(c * position.x - s * position.z, position.y, s * position.x + c * position.z, 1.)).xyz;
  vec3 view = center - eye; vec3 side = normalize(vec3(-view.z, 0., view.x));
  vWorld = center + side * uv.x * color.x + vec3(0., uv.y * color.y, 0.);
  vec2 toCard = center.xz - eye.xz, toPlume = plume.xy - eye.xz; float range = length(toCard);
  float apart = acos(clamp(dot(toCard / range, normalize(toPlume)), -1., 1.)), reach = color.x / range + plume.z;
  float above = step(plume.w / length(toPlume), (center.y - eye.y) / range);
  vClear = uv2.y > 1.5 ? 1. : 1. - above * (1. - smoothstep(reach, reach * 1.25 + .03, apart));
  vAspect = color.x / color.y; vUv = vec2(uv.x * vAspect, uv.y); vSeed = uv2; vStretch = color.w;
  gl_Position = viewProjection * vec4(vWorld, 1.);
}`;

const CLOUD_FRAGMENT = `precision highp float;
varying vec3 vWorld; varying vec2 vUv, vSeed; varying float vAspect, vClear, vStretch;
uniform vec3 eye, fogNear, cloudLit, cloudShade, cloudRim;
uniform float time, fogDensity, fogHeight, cloudCover, sunStrength;
${WORLD_GLSL}
${SKY_GLSL}
float cloudField(vec2 p, float seed, float aspect, out float top) {
  vec2 core = vec2(p.x / (aspect * .82), (p.y + .32) / .3);
  float f = max(1. - dot(core, core), 0.); f *= f * .9;
  top = -.02;
  for (int i = 0; i < 9; i++) {
    float fi = float(i) * 4., r = .2 + worldHash(vec2(seed, fi + 1.)) * .3;
    float u = (worldHash(vec2(seed, fi + 2.)) - .5) * 2. * max(aspect - 1.15 * r - .25, 0.), edge = abs(u) / aspect;
    r *= 1.1 - .55 * edge;
    vec2 at = vec2(u, -.34 + r * .6 + worldHash(vec2(seed, fi + 3.)) * .3 * (1. - edge)), d = (p - at) / vec2(r * 1.15, r);
    float blob = max(1. - dot(d, d), 0.); f += blob * blob;
    top = max(top, at.y + r * .85);
  }
  return f;
}
float bankField(vec2 p, float seed, float aspect, float stretch, out float top) {
  float x = p.x / aspect, k = p.x / stretch;
  float swell = worldNoise(vec2(k * .5 + seed, seed * 1.7)) * .5 + worldNoise(vec2(k * 1.4 - seed, seed)) * .3 + worldNoise(vec2(k * 3.6 + seed * 2., seed * .3)) * .2;
  float billow = smoothstep(.3, .85, worldNoise(vec2(k * 2.4 + seed, 7.))) * .6 + smoothstep(.4, .9, worldNoise(vec2(k * 5.3 - seed, 3.))) * .4;
  float crest = (.05 + (.55 * swell + .35 * billow) / sqrt(stretch)) * (1. - .6 * x * x);
  top = crest;
  return smoothstep(-.7, -.3, p.y) * (1. - smoothstep(crest - .35, crest + .05, p.y)) * (1. - smoothstep(.4, 1., abs(x) + (swell - .5) * .4)) * 1.2;
}
void main() {
  vec2 p = vUv; float seed = vSeed.x, kind = vSeed.y, a;
  float x = p.x / vAspect, lean = worldHash(vec2(seed, 31.)) * .7 - .15;
  vec2 s = vec2(p.x - lean * (p.y + .1) * .45, p.y);
  float top = 1., banked = step(1.01, vStretch), f = kind > .5 ? 1. : banked > .5 ? bankField(s, seed, vAspect, vStretch, top) : cloudField(s, seed, vAspect, top);
  if (f < .02) discard;
  float sunSide = dot(sun, normalize(vec3(-(vWorld.z - eye.z), 0., vWorld.x - eye.x))), toward = pow(max(dot(normalize(vWorld - eye), sun), 0.), 6.);
  vec2 q = p + fract(seed * .618) * 13. + vec2(time * .012, 0.);
  float n = worldNoise(q * 2.2) * .625 + worldNoise(q * 5.1 + 3.1) * .375;
  vec3 color;
  if (kind < .5) {
    float wet = smoothstep(.6, .9, cloudCover) * banked, base = mix(-.38, -.66, banked) + .2 * x * x, frayed = n * .7 + worldNoise(q * 11.3 - vec2(time * .02, 0.)) * .3, feather = f + (frayed - .5) * .5 * (1. - smoothstep(.15, .6, f)) + (cloudCover - .55) * .3;
    float fade = smoothstep(-.15, .3, p.y - base + (n - .5) * .9) * (1. - smoothstep(.85, 1., abs(x)));
    a = smoothstep(.08, .34, feather) * fade * .97;
    float rise = (p.y + .38 + x * sunSide * .1 + (n - .5) * .08) / (top + .38), height = rise / .85, lit = 1. - min((height + sqrt(height * height + .01)) * .5, 1.);
    float forward = toward * smoothstep(.15, .9, rise), facing = x * clamp(sunSide * 6., -1., 1.), shaded = .3 * (1. + goldenHour) * clamp(-facing * 1.5, 0., 1.) * smoothstep(.1, .6, rise);
    float grade = (.1 + .9 * (1. - lit * lit)) * smoothstep(-.12, .12, rise) * (1. - shaded);
    color = mix(cloudShade, cloudLit, grade) + cloudRim * forward * (.05 + .12 * sunScatter);
    color = mix(color, cloudRim, smoothstep(0., 1., facing * 1.2 + forward * .4) * smoothstep(.05, .5, rise) * sunStrength * .45);
    float underside = max(smoothstep(1.5, 3., vStretch), wet) * (1. - smoothstep(0., .75, rise));
    color = mix(color, fogNear, underside * .6); a *= 1. - underside * .45;
  } else if (kind < 1.5) {
    float streak = worldNoise(vec2(p.x * .7 + seed, p.y * 1.8 + p.x * .35 + time * .004)) * .65 + worldNoise(vec2(p.x * 1.6 - seed, p.y * 3.6)) * .35;
    a = smoothstep(.42, .9, streak + (cloudCover - .55) * .3) * (1. - smoothstep(.3, 1., abs(p.x) / vAspect)) * (1. - smoothstep(0., 1., abs(p.y))) * .55;
    color = mix(cloudLit, cloudShade, .15) + cloudRim * toward * .25 * sunStrength;
  } else {
    float veil = worldNoise(vec2(p.x * .35, p.y * .8) + seed + vec2(time * .01, 0.)) * .7 + n * .3;
    a = smoothstep(.25, .8, veil) * (1. - smoothstep(.3, 1., abs(p.x) / vAspect)) * smoothstep(-1., -.4, p.y) * (1. - smoothstep(-.3, 1., p.y)) * clamp(fogDensity * 1100., .25, .6);
    color = mix(fogNear, fogSun, toward * .6) * (.92 + .16 * smoothstep(-.5, .8, p.y));
  }
  vec3 ray = vWorld - eye;
  color = kind > 1.5 ? worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight) : mix(color, worldSky(normalize(ray)), (1. - exp(-length(ray) * fogDensity * .3)) * (kind < .5 ? .25 : .5));
  a *= vClear;
  gl_FragColor = vec4(color * a, a);
}`;

export function createWorldClouds(scene, { root, still }) {
  const paint = new ShaderMaterial('world-cloud-paint', scene, { vertexSource: CLOUD_VERTEX, fragmentSource: CLOUD_FRAGMENT }, { attributes: ['position', 'uv', 'uv2', 'color'], uniforms: [...new Set(['world', 'viewProjection', 'plume', 'cloudCover', 'sunStrength', ...CLOUD_COLORS, ...SKY_UNIFORMS, ...AIR_UNIFORMS])], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.disableDepthWrite = true; paint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF;
  followEye(scene, paint, still);
  paint.setVector4('plume', new Vector4(PLUME_COLUMN.x, PLUME_COLUMN.z, PLUME_COLUMN.reach, PLUME_COLUMN.summit));
  const cards = cloudCards(), clouds = new Mesh('world-clouds', scene);
  Object.assign(new VertexData(), cloudShape(cards)).applyToMesh(clouds);
  clouds.material = paint; clouds.parent = root; clouds.isPickable = false; clouds.alwaysSelectAsActiveMesh = true; clouds.metadata = { castShadow: false, world: true };
  return {
    clouds, cards,
    setTheme(atmosphere) {
      applySkyTheme(paint, atmosphere); applyAir(paint, atmosphere);
      paint.setFloat('cloudCover', atmosphere.cloudCover); paint.setFloat('sunStrength', atmosphere.sunStrength);
      for (const key of CLOUD_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
    },
  };
}
