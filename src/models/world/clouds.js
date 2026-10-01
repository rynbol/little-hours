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
export const CLOUD_BANKS = Object.freeze([
  Object.freeze({ kind: 'cumulus', count: 30, distance: [1100, 6000], base: [300, 1000], width: [320, 900], tall: [0.24, 0.38], spin: 0.0011 }),
  Object.freeze({ kind: 'wisp', count: 10, distance: [2500, 7000], base: [1300, 1500], width: [900, 2000], tall: [0.08, 0.14], spin: 0.0005 }),
  Object.freeze({ kind: 'mist', count: 24, distance: [260, 1900], base: [-6, -3], width: [160, 420], tall: [0.07, 0.12], spin: 0 }),
]);
const CLOUD_COLORS = ['cloudLit', 'cloudShade', 'cloudRim'];
export const PLUME_COLUMN = Object.freeze({ x: LANDMARKS.peak.x, z: LANDMARKS.peak.z, reach: 0.1, summit: LANDMARKS.peak.summit + PLUME.rise * 0.1 });

export function clearsPlume({ x, y, z, halfWidth, halfHeight }, eye = [0, 0]) {
  const cardX = x - eye[0], cardZ = z - eye[1], plumeX = PLUME_COLUMN.x - eye[0], plumeZ = PLUME_COLUMN.z - eye[1], out = Math.hypot(cardX, cardZ);
  const apart = Math.acos(Math.max(-1, Math.min(1, (cardX * plumeX + cardZ * plumeZ) / (out * Math.hypot(plumeX, plumeZ)))));
  const reach = halfWidth / out + PLUME_COLUMN.reach, above = y / out > PLUME_COLUMN.summit / Math.hypot(plumeX, plumeZ);
  return !above || apart > reach * 1.25 + 0.03;
}

const SUNS = ['day', 'dusk'].map(theme => WORLD_ATMOSPHERES[theme].sun);

export function clearsSuns({ x, y, z, halfWidth, halfHeight }) {
  const out = Math.hypot(x, z), bearing = Math.atan2(x, -z), up = Math.atan2(y, out);
  return SUNS.every(([sunX, sunY, sunZ]) => Math.hypot((bearing - Math.atan2(sunX, -sunZ)) * out / halfWidth, (up - Math.asin(sunY)) * out / halfHeight) > 1.2);
}

const seeded = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const span = ([low, high], t) => low + (high - low) * t;

export function cloudCards(seed = WORLD.seed) {
  const random = seeded(seed * 977 + 13), cards = [];
  for (const bank of CLOUD_BANKS) {
    for (let placed = 0, tries = 0; placed < bank.count && tries < bank.count * 12; tries++) {
      const front = random() < 0.65, bearing = front ? (random() - 0.5) * 2.4 : random() * Math.PI * 2;
      const r = span(bank.distance, random() ** 0.8), x = Math.sin(bearing) * r, z = -Math.cos(bearing) * r;
      const halfWidth = span(bank.width, random()) / 2, halfHeight = halfWidth * span(bank.tall, random()) * 2;
      const ground = Math.max(heightAt(x, z), heightAt(x + halfWidth, z), heightAt(x - halfWidth, z));
      let base = span(bank.base, random());
      if (bank.kind === 'mist') { if (ground > WORLD.valleyFloor + 2) continue; base += ground; }
      else if (base < ground + 120) continue;
      const card = { kind: CLOUD_KINDS[bank.kind], x, y: base + halfHeight * 0.6, z, halfWidth, halfHeight, spin: bank.spin, seed: random() * 97 };
      if (bank.kind !== 'mist' && !(clearsPlume(card) && clearsSuns(card))) continue;
      cards.push(card);
      placed++;
    }
  }
  return cards.sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z));
}

export function cloudShape(cards) {
  const positions = new Float32Array(cards.length * 12), uvs = new Float32Array(cards.length * 8), seeds = new Float32Array(cards.length * 8), sizes = new Float32Array(cards.length * 16), indices = new Uint16Array(cards.length * 6);
  cards.forEach((card, c) => {
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], k) => {
      const i = c * 4 + k;
      positions.set([card.x, card.y, card.z], i * 3); uvs.set([u, v], i * 2); seeds.set([card.seed, card.kind], i * 2);
      sizes.set([card.halfWidth, card.halfHeight, card.spin, 1], i * 4);
    });
    indices.set([0, 1, 2, 0, 2, 3].map(k => c * 4 + k), c * 6);
  });
  return { positions, uvs, uvs2: seeds, colors: sizes, indices };
}

const CLOUD_VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv, uv2; attribute vec4 color;
uniform mat4 world, viewProjection; uniform vec3 eye; uniform vec4 plume; uniform float time;
varying vec3 vWorld; varying vec2 vUv, vSeed; varying float vAspect, vClear;
void main() {
  float spin = time * color.z, s = sin(spin), c = cos(spin);
  vec3 center = (world * vec4(c * position.x - s * position.z, position.y, s * position.x + c * position.z, 1.)).xyz;
  vec3 view = center - eye; vec3 side = normalize(vec3(-view.z, 0., view.x));
  vWorld = center + side * uv.x * color.x + vec3(0., uv.y * color.y, 0.);
  vec2 toCard = center.xz - eye.xz, toPlume = plume.xy - eye.xz; float range = length(toCard);
  float apart = acos(clamp(dot(toCard / range, normalize(toPlume)), -1., 1.)), reach = color.x / range + plume.z;
  float above = step(plume.w / length(toPlume), (center.y - eye.y) / range);
  vClear = uv2.y > 1.5 ? 1. : 1. - above * (1. - smoothstep(reach, reach * 1.25 + .03, apart));
  vAspect = color.x / color.y; vUv = vec2(uv.x * vAspect, uv.y); vSeed = uv2;
  gl_Position = viewProjection * vec4(vWorld, 1.);
}`;

const CLOUD_FRAGMENT = `precision highp float;
varying vec3 vWorld; varying vec2 vUv, vSeed; varying float vAspect, vClear;
uniform vec3 eye, fogNear, cloudLit, cloudShade, cloudRim;
uniform float time, fogDensity, fogHeight, cloudCover, sunStrength;
${WORLD_GLSL}
${SKY_GLSL}
void main() {
  vec2 p = vUv; float seed = vSeed.x, kind = vSeed.y, a;
  float toward = pow(max(dot(normalize(vWorld - eye), sun), 0.), 6.);
  vec2 q = p + fract(seed * .618) * 13. + vec2(time * .012, 0.);
  float n = worldNoise(q * 2.2) * .5 + worldNoise(q * 5.1 + 3.1) * .3 + worldNoise(q * 11.3 - vec2(time * .02, 0.)) * .2;
  vec3 color;
  if (kind < .5) {
    float x = p.x / vAspect, span = max(1. - x * x / .8, 0.), centre = (worldHash(vec2(seed, 1.)) - .5) * .5, heap = max(1. - (x - centre) * (x - centre) / .3, 0.);
    float big = p.x * 1.15 + seed, small = p.x * 2.7 - seed, fine = p.x * 5.3 + seed * 2., bigArc = fract(big) * 2. - 1., smallArc = fract(small) * 2. - 1., fineArc = fract(fine) * 2. - 1.;
    float scallop = sqrt(max(1. - bigArc * bigArc, 0.)) * (.1 + worldHash(vec2(floor(big), seed)) * .16) + sqrt(max(1. - smallArc * smallArc, 0.)) * (.04 + worldHash(vec2(floor(small), seed)) * .08) + sqrt(max(1. - fineArc * fineArc, 0.)) * .035;
    float base = -.6 + (worldNoise(vec2(p.x * .8, seed)) - .5) * .05;
    float top = base + span * .18 + sqrt(heap) * (.65 + worldHash(vec2(seed, 2.)) * .25) + scallop * sqrt(span) + (cloudCover - .55) * .3;
    float fringe = (n - .5) * .15, depth = top - p.y + fringe, rise = p.y - base + fringe * .5;
    a = smoothstep(0., .12, depth) * smoothstep(0., .16, rise) * smoothstep(0., .1, span) * .97;
    float lit = smoothstep(0., .5, rise + (n - .5) * .1) * (1. - .18 * smoothstep(.06, .4, depth));
    color = mix(cloudShade, cloudLit, lit);
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
  color = kind > 1.5 ? worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight) : mix(color, worldSky(normalize(ray)), (1. - exp(-length(ray) * fogDensity * .3)) * .5);
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
