import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { heightAt, WORLD } from '../../core/world-terrain.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';

export const CLOUD_KINDS = Object.freeze({ cumulus: 0, wisp: 1, mist: 2 });
export const CLOUD_BANKS = Object.freeze([
  Object.freeze({ kind: 'cumulus', count: 30, distance: [1100, 6000], base: [300, 1000], width: [320, 900], tall: [0.24, 0.38], spin: 0.0011 }),
  Object.freeze({ kind: 'wisp', count: 10, distance: [2500, 7000], base: [1300, 1500], width: [900, 2000], tall: [0.08, 0.14], spin: 0.0005 }),
  Object.freeze({ kind: 'mist', count: 24, distance: [260, 1900], base: [-6, -3], width: [160, 420], tall: [0.07, 0.12], spin: 0 }),
]);
const CLOUD_COLORS = ['cloudLit', 'cloudShade', 'cloudRim'];

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
      cards.push({ kind: CLOUD_KINDS[bank.kind], x, y: base + halfHeight * 0.6, z, halfWidth, halfHeight, spin: bank.spin, seed: random() * 97 });
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
uniform mat4 world, viewProjection; uniform vec3 eye; uniform float time;
varying vec3 vWorld; varying vec2 vUv, vSeed; varying float vAspect;
void main() {
  float spin = time * color.z, s = sin(spin), c = cos(spin);
  vec3 center = (world * vec4(c * position.x - s * position.z, position.y, s * position.x + c * position.z, 1.)).xyz;
  vec3 view = center - eye; vec3 side = normalize(vec3(-view.z, 0., view.x));
  vWorld = center + side * uv.x * color.x + vec3(0., uv.y * color.y, 0.);
  vAspect = color.x / color.y; vUv = vec2(uv.x * vAspect, uv.y); vSeed = uv2;
  gl_Position = viewProjection * vec4(vWorld, 1.);
}`;

const CLOUD_FRAGMENT = `precision highp float;
varying vec3 vWorld; varying vec2 vUv, vSeed; varying float vAspect;
uniform vec3 eye, sun, fogNear, fogFar, fogSun, cloudLit, cloudShade, cloudRim;
uniform float time, fogDensity, fogHeight, cloudCover, sunStrength;
${WORLD_GLSL}
void main() {
  vec2 p = vUv; float seed = vSeed.x, kind = vSeed.y, a;
  float toward = pow(max(dot(normalize(vWorld - eye), sun), 0.), 6.);
  vec2 q = p + seed * 9.7 + vec2(time * .012, 0.);
  float n = worldNoise(q * 2.2) * .5 + worldNoise(q * 5.1 + 3.1) * .3 + worldNoise(q * 11.3 - vec2(time * .02, 0.)) * .2;
  vec3 color;
  if (kind < .5) {
    float lump = -1.;
    for (int i = 0; i < 6; i++) {
      float f = float(i) / 5., h = worldHash(vec2(seed, float(i))), k = worldHash(vec2(float(i), seed + 3.)), middle = 1. - abs(f - .5) * 2.;
      vec2 c = vec2((f - .5) * 2. * (vAspect - .5), -.5 + middle * (.4 + k * .32));
      lump = max(lump, 1. - length(p - c) / (.3 + middle * .3 + h * .14));
    }
    float body = lump + (n - .5) * .6 + (cloudCover - .55) * .5;
    a = smoothstep(0., .5, body) * smoothstep(-.9, -.55, p.y + (n - .5) * .2) * .96;
    float lit = smoothstep(-.55, .55, p.y + (n - .5) * .8 + lump * .25);
    color = mix(cloudShade, cloudLit, lit);
    color = mix(color, cloudLit, toward * .5 * (1. - lit));
    color = mix(color, cloudShade, toward * .3 * smoothstep(.1, .6, body));
    color += cloudRim * smoothstep(0., .12, body) * pow(1. - smoothstep(0., .5, body), 2.) * pow(toward, 4.) * sunStrength * .6;
  } else if (kind < 1.5) {
    float streak = worldNoise(vec2(p.x * 1.3 + seed, p.y * 5. + time * .004)) * .6 + worldNoise(vec2(p.x * 3.2 - seed, p.y * 12.)) * .4;
    a = smoothstep(.45, .8, streak + (cloudCover - .55) * .3) * (1. - smoothstep(.45, 1., abs(p.x) / vAspect)) * (1. - smoothstep(.1, 1., abs(p.y))) * .55;
    color = mix(cloudLit, cloudShade, .2) + cloudRim * toward * .4 * sunStrength;
  } else {
    float veil = worldNoise(vec2(p.x * .35, p.y * .8) + seed + vec2(time * .01, 0.)) * .7 + n * .3;
    a = smoothstep(.25, .8, veil) * (1. - smoothstep(.3, 1., abs(p.x) / vAspect)) * smoothstep(-1., -.4, p.y) * (1. - smoothstep(-.3, 1., p.y)) * clamp(fogDensity * 1100., .25, .6);
    color = mix(fogNear, fogSun, toward * .6) * (.92 + .16 * smoothstep(-.5, .8, p.y));
  }
  color = mix(color, worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), kind > 1.5 ? 1. : .6);
  gl_FragColor = vec4(color * a, a);
}`;

export function createWorldClouds(scene, { root, still }) {
  const paint = new ShaderMaterial('world-cloud-paint', scene, { vertexSource: CLOUD_VERTEX, fragmentSource: CLOUD_FRAGMENT }, { attributes: ['position', 'uv', 'uv2', 'color'], uniforms: ['world', 'viewProjection', 'cloudCover', 'sunStrength', ...CLOUD_COLORS, ...AIR_UNIFORMS], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.disableDepthWrite = true; paint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF;
  followEye(scene, paint, still);
  const cards = cloudCards(), clouds = new Mesh('world-clouds', scene);
  Object.assign(new VertexData(), cloudShape(cards)).applyToMesh(clouds);
  clouds.material = paint; clouds.parent = root; clouds.isPickable = false; clouds.alwaysSelectAsActiveMesh = true; clouds.metadata = { castShadow: false, world: true };
  return {
    clouds, cards,
    setTheme(atmosphere) {
      applyAir(paint, atmosphere);
      paint.setFloat('cloudCover', atmosphere.cloudCover); paint.setFloat('sunStrength', atmosphere.sunStrength);
      for (const key of CLOUD_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
    },
  };
}
