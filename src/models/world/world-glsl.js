import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { WORLD } from '../../core/world-terrain.js';
import { clockNow } from '../../core/test-pins.js';

const VALLEY_AIR = (WORLD.valleyFloor + 4).toFixed(1);

export const WORLD_GLSL = `
float worldHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float worldNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(worldHash(i), worldHash(i + vec2(1., 0.)), u.x), mix(worldHash(i + vec2(0., 1.)), worldHash(i + vec2(1., 1.)), u.x), u.y); }
float worldFbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += worldNoise(p) * a; p = p * 2.03 + 17.1; a *= .5; } return s / .9375; }
vec3 worldAir(vec3 color, vec3 world, vec3 eye, vec3 sun, vec3 fogNear, vec3 fogFar, vec3 fogSun, float density, float fogHeight) {
  vec3 ray = world - eye; float d = length(ray); vec3 dir = ray / max(d, 1e-3);
  float from = max(eye.y - ${VALLEY_AIR}, 0.), to = max(world.y - ${VALLEY_AIR}, 0.), rise = to - from;
  float column = abs(rise) < 1. ? exp(-to / fogHeight) : fogHeight * (exp(-from / fogHeight) - exp(-to / fogHeight)) / rise;
  float far = clamp(1. - exp(-d * density * (.35 + .65 * column)), 0., 1.);
  float glare = pow(max(dot(dir, sun), 0.), 8.);
  float mist = exp(-to / 24.) * (1. - exp(-d * .0022)) * clamp(density * 1100., 0., .8);
  color = mix(color, mix(fogNear, fogSun, glare * .5), mist);
  color = mix(color, vec3(dot(color, vec3(.299, .587, .114))), far * .3);
  return mix(color, mix(fogFar, fogSun, glare * .9), far);
}`;

export const AIR_COLORS = Object.freeze(['fogNear', 'fogFar', 'fogSun']);
export const AIR_UNIFORMS = Object.freeze(['eye', 'sun', 'fogDensity', 'fogHeight', 'time', ...AIR_COLORS]);

export function applyAir(paint, atmosphere) {
  paint.setVector3('sun', Vector3.FromArray(atmosphere.sun));
  paint.setFloat('fogDensity', atmosphere.fogDensity); paint.setFloat('fogHeight', atmosphere.fogHeight);
  for (const key of AIR_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
}

export function followEye(scene, paint, still) {
  const eye = new Vector3(), start = clockNow();
  paint.setFloat('time', 0);
  const watch = scene.onBeforeRenderObservable.add(() => {
    const camera = scene.activeCamera; if (!camera) return;
    eye.copyFrom(camera.globalPosition); paint.setVector3('eye', eye);
    if (!still) paint.setFloat('time', (clockNow() - start) / 1000);
  });
  paint.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(watch));
}
