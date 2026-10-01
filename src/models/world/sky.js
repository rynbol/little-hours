import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';

export const SKY_COLORS = Object.freeze(['zenith', 'high', 'horizon', 'horizonAway', 'glow', 'fogFar', 'fogSun']);
export const SKY_UNIFORMS = Object.freeze(['sun', 'glowStrength', ...SKY_COLORS]);

export const SKY_GLSL = `
uniform vec3 sun, zenith, high, horizon, horizonAway, glow, fogFar, fogSun; uniform float glowStrength;
vec3 worldSky(vec3 d) {
  float up = d.y, toward = max(dot(d, sun), 0.), lift = smoothstep(0., .62, up);
  float sunward = dot(normalize(d.xz + vec2(1e-4)), normalize(sun.xz + vec2(1e-4))) * .5 + .5;
  vec3 color = mix(mix(horizonAway, horizon, sunward * sunward), high, smoothstep(0., .3, lift));
  color = mix(color, zenith, smoothstep(.3, 1., lift));
  color = mix(color, horizon, clamp(pow(toward, 10.) * .5 * glowStrength * (1. - .5 * lift), 0., 1.));
  color = mix(color, glow, clamp(pow(toward, 56.) * .6 * glowStrength, 0., 1.));
  vec3 air = mix(fogFar, fogSun, pow(toward, 8.) * .9);
  return mix(air, color, smoothstep(-.025, .09, up));
}`;

const SKY_VERTEX = `precision highp float;
attribute vec3 position; uniform mat4 world, viewProjection; varying vec3 vDir;
void main() { vDir = position; gl_Position = viewProjection * world * vec4(position, 1.); }`;

const SKY_FRAGMENT = `precision highp float;
varying vec3 vDir;
${SKY_GLSL}
void main() {
  vec3 d = normalize(vDir); float toward = max(dot(d, sun), 0.);
  vec3 color = worldSky(d);
  color += glow * (pow(toward, 220.) * .4 + pow(toward, 2400.) * .8) * glowStrength;
  color = mix(min(color, vec3(1.)), vec3(1.), smoothstep(.99988, .99993, toward) * smoothstep(.2, .5, glowStrength));
  gl_FragColor = vec4(color, 1.);
}`;

export function applySkyTheme(paint, atmosphere) {
  paint.setVector3('sun', Vector3.FromArray(atmosphere.sun));
  paint.setFloat('glowStrength', atmosphere.glowStrength);
  for (const key of SKY_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
}

export function createWorldSky(scene, root) {
  const paint = new ShaderMaterial('world-sky-paint', scene, { vertexSource: SKY_VERTEX, fragmentSource: SKY_FRAGMENT }, { attributes: ['position'], uniforms: ['world', 'viewProjection', ...SKY_UNIFORMS] });
  paint.backFaceCulling = false; paint.disableDepthWrite = true;
  const sky = CreateSphere('world-sky', { diameter: 20000, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.material = paint; sky.parent = root; sky.infiniteDistance = true; sky.isPickable = false; sky.metadata = { castShadow: false, world: true };
  return { sky, setTheme: atmosphere => applySkyTheme(paint, atmosphere) };
}
