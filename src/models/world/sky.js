import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';

export const SKY_COLORS = Object.freeze(['zenith', 'high', 'horizon', 'horizonAway', 'glow', 'sunGlow', 'fogFar', 'fogSun']);
export const SKY_UNIFORMS = Object.freeze(['sun', 'glowStrength', 'sunGlowStrength', 'goldenHour', ...SKY_COLORS]);

export const SKY_GLSL = `
uniform vec3 sun, zenith, high, horizon, horizonAway, glow, sunGlow, fogFar, fogSun; uniform float glowStrength, sunGlowStrength, goldenHour;
vec3 worldSky(vec3 d) {
  float up = d.y, toward = max(dot(d, sun), 0.), lift = smoothstep(0., .62, up);
  float facing = dot(normalize(d.xz + vec2(1e-4)), normalize(sun.xz + vec2(1e-4))), sunward = facing * .5 + .5;
  vec3 color = mix(mix(horizonAway, horizon, pow(sunward, 6.)), high, smoothstep(0., .3, lift));
  color = mix(color, zenith, smoothstep(.3, 1., lift));
  color *= 1. + pow(toward, 40.) * .3 * glowStrength;
  float near = pow(toward, 12.), top = .24 + .12 * near, band = smoothstep(.5, .98, facing) * (1. - smoothstep(top * .3, top, up));
  color = mix(color, mix(horizon, glow, pow(toward, 48.) * .6), band * goldenHour);
  color = mix(color, sunGlow, pow(toward, 90. + 110. * goldenHour) * sunGlowStrength);
  color = mix(color, glow, clamp(pow(toward, 300.) * .6 * glowStrength, 0., 1.));
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
  float disc = smoothstep(.2, .5, glowStrength), bloom = clamp((pow(toward, 2400.) * .7 * (1. - .7 * goldenHour) + pow(toward, 600.) * .35 + pow(toward, 140.) * .2) * glowStrength, 0., 1.);
  color = 1. - (1. - min(color, vec3(1.))) * (1. - glow * bloom);
  color = mix(color, vec3(1.), smoothstep(.99984, .99994, toward) * disc);
  gl_FragColor = vec4(color, 1.);
}`;

export function applySkyTheme(paint, atmosphere) {
  paint.setVector3('sun', Vector3.FromArray(atmosphere.sun));
  paint.setFloat('glowStrength', atmosphere.glowStrength); paint.setFloat('sunGlowStrength', atmosphere.sunGlowStrength); paint.setFloat('goldenHour', atmosphere.goldenHour);
  for (const key of SKY_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
}

export function createWorldSky(scene, root) {
  const paint = new ShaderMaterial('world-sky-paint', scene, { vertexSource: SKY_VERTEX, fragmentSource: SKY_FRAGMENT }, { attributes: ['position'], uniforms: ['world', 'viewProjection', ...SKY_UNIFORMS] });
  paint.backFaceCulling = false; paint.disableDepthWrite = true;
  const sky = CreateSphere('world-sky', { diameter: 20000, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.material = paint; sky.parent = root; sky.infiniteDistance = true; sky.isPickable = false; sky.metadata = { castShadow: false, world: true };
  return { sky, setTheme: atmosphere => applySkyTheme(paint, atmosphere) };
}
