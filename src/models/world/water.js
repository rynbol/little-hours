import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { heightAt, riverCenter, smooth, WORLD } from '../../core/world-terrain.js';
import { TERRAIN_RINGS } from './terrain-mesh.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';
import { SKY_GLSL, SKY_UNIFORMS, applySkyTheme } from './sky.js';

export const RIVER = Object.freeze({ step: 8, across: 13, halfWidth: 44, bedHalfWidth: 18, depth: 1.6, smoothing: 5, reach: 2400, highest: WORLD.valleyFloor + 30, fade: 160 });

export function terrainMeshHeight(x, z, rings = TERRAIN_RINGS, cache = new Map()) {
  const reach = Math.max(Math.abs(x), Math.abs(z)), { step } = rings.find(ring => reach < ring.radius) ?? rings[rings.length - 1];
  const i = Math.floor(x / step), j = Math.floor(z / step), fx = x / step - i, fz = z / step - j;
  const at = (a, b) => { const key = `${step}:${a}:${b}`; let h = cache.get(key); if (h === undefined) { h = heightAt(a * step, b * step); cache.set(key, h); } return h; };
  if (fx + fz <= 1) { const h = at(i, j); return h + fx * (at(i + 1, j) - h) + fz * (at(i, j + 1) - h); }
  const h = at(i + 1, j + 1); return h + (1 - fx) * (at(i, j + 1) - h) + (1 - fz) * (at(i + 1, j) - h);
}

export function riverLevels(cache = new Map()) {
  const { step, reach, bedHalfWidth, depth, smoothing } = RIVER, rows = [];
  for (let x = -reach; x <= reach; x += step) {
    const center = riverCenter(x); let low = Infinity;
    for (let a = -bedHalfWidth; a <= bedHalfWidth; a += bedHalfWidth / 3) low = Math.min(low, terrainMeshHeight(x, center + a, TERRAIN_RINGS, cache));
    rows.push({ x, center, level: low + depth });
  }
  const levels = rows.map((_, k) => { let sum = 0, n = 0; for (let o = -smoothing; o <= smoothing; o++) { const row = rows[k + o]; if (row) { sum += row.level; n++; } } return sum / n; });
  rows.forEach((row, k) => { row.level = levels[k]; });
  const start = rows.findIndex(row => row.x >= 0);
  let left = start, right = start;
  while (left > 0 && rows[left - 1].level < RIVER.highest) left--;
  while (right < rows.length - 1 && rows[right + 1].level < RIVER.highest) right++;
  return rows.slice(left, right + 1);
}

export function riverShape(rows = riverLevels()) {
  const { across, halfWidth, depth, fade } = RIVER, cache = new Map(), first = rows[0].x, last = rows[rows.length - 1].x;
  const positions = new Float32Array(rows.length * across * 3), uvs = new Float32Array(rows.length * across * 2), indices = new Uint16Array((rows.length - 1) * (across - 1) * 6);
  rows.forEach(({ x, center, level }, r) => {
    const ends = Math.min(smooth(first, first + fade, x), 1 - smooth(last - fade, last, x));
    for (let k = 0; k < across; k++) {
      const a = (k / (across - 1) * 2 - 1) * halfWidth, z = center + a, ground = terrainMeshHeight(x, z, TERRAIN_RINGS, cache);
      const crest = depth + (-0.8 - depth) * smooth(halfWidth * 0.45, halfWidth, Math.abs(a)), y = Math.min(level, ground + crest), v = r * across + k;
      positions.set([x, y, z], v * 3); uvs.set([ends, y - ground], v * 2);
    }
  });
  for (let r = 0, i = 0; r < rows.length - 1; r++) for (let k = 0; k < across - 1; k++, i += 6) {
    const a = r * across + k, b = a + across;
    indices.set([a, b, a + 1, a + 1, b, b + 1], i);
  }
  return { positions, uvs, indices };
}

const WATER_VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv; uniform mat4 world, viewProjection;
varying vec3 vWorld; varying vec2 vWater;
void main() { vec4 p = world * vec4(position, 1.); vWorld = p.xyz; vWater = uv; gl_Position = viewProjection * p; }`;

const WATER_FRAGMENT = `precision highp float;
varying vec3 vWorld; varying vec2 vWater;
uniform vec3 eye, fogNear, water, waterShallow, sunColor, skyAmbient; uniform float time, fogDensity, fogHeight, sunStrength;
${WORLD_GLSL}
${SKY_GLSL}
float wave(vec2 q, float near) { return worldNoise(q * .21 + vec2(time * .11, 0.)) * .5 + worldNoise(q * .57 - vec2(time * .19, time * .05)) * .3 + worldNoise(q * 1.9 + vec2(time * .42, time * .1)) * .2 * near; }
void main() {
  vec3 ray = vWorld - eye; float d = length(ray); vec3 view = ray / d;
  float depth = vWater.y, e = .4, ripple = 1.1 / (1. + d / 260.), near = 1. - smoothstep(20., 120., d);
  vec2 q = vWorld.xz; float h = wave(q, near);
  vec3 n = normalize(vec3((h - wave(q + vec2(e, 0.), near)) * ripple, e, (h - wave(q + vec2(0., e), near)) * ripple));
  vec3 bounce = reflect(view, n); bounce.y = max(bounce.y, .015);
  float fresnel = .03 + .97 * pow(1. - max(dot(-view, n), 0.), 5.), deep = smoothstep(.25, 1.5, depth);
  vec3 body = mix(waterShallow, water, deep) * mix(skyAmbient, sunColor, .5) * (.55 + .45 * sunStrength);
  vec3 color = mix(body, worldSky(bounce) * mix(.62, 1., deep), fresnel);
  float glint = pow(max(dot(bounce, sun), 0.), 320.) * 2.4 + pow(max(dot(bounce, sun), 0.), 30.) * .12 * fresnel;
  color += sunColor * glint * sunStrength * smoothstep(.1, .6, glowStrength) * smoothstep(5., 60., d);
  color = worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight);
  float alpha = smoothstep(0., .45, depth) * vWater.x * mix(.72, 1., max(fresnel, smoothstep(.6, 2.4, depth)));
  gl_FragColor = vec4(color * alpha, alpha);
}`;

const WATER_COLORS = ['water', 'waterShallow', 'sunColor', 'skyAmbient'];

export function createWorldWater(scene, { root, still }) {
  const uniforms = [...new Set(['world', 'viewProjection', 'sunStrength', ...WATER_COLORS, ...SKY_UNIFORMS, ...AIR_UNIFORMS])];
  const paint = new ShaderMaterial('world-water-paint', scene, { vertexSource: WATER_VERTEX, fragmentSource: WATER_FRAGMENT }, { attributes: ['position', 'uv'], uniforms, needAlphaBlending: true });
  paint.backFaceCulling = false; paint.disableDepthWrite = true; paint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF;
  followEye(scene, paint, still);
  const river = new Mesh('world-river', scene);
  Object.assign(new VertexData(), riverShape()).applyToMesh(river);
  river.material = paint; river.parent = root; river.isPickable = false; river.metadata = { castShadow: false, world: true };
  river.freezeWorldMatrix();
  return {
    river,
    setTheme(atmosphere) {
      applySkyTheme(paint, atmosphere); applyAir(paint, atmosphere);
      paint.setFloat('sunStrength', atmosphere.sunStrength);
      for (const key of WATER_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
    },
  };
}
