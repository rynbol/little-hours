import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { WORLD } from '../../core/world-terrain.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';

const GROUND_PALETTE = Object.freeze(['grass', 'grassLight', 'grassWarm', 'grassTip', 'flowerWhite', 'flowerYellow', 'flowerLilac', 'forestFloor', 'rock', 'rockDark', 'dirt', 'sand', 'snow']);
const GROUND_LIGHT = Object.freeze(['sunColor', 'skyAmbient', 'groundAmbient', 'shadowTint']);
export const GROUND_UNIFORMS = Object.freeze([...AIR_UNIFORMS, ...GROUND_PALETTE, ...GROUND_LIGHT, 'sunStrength', 'shadowLift', 'gusts']);
export const WIND = Object.freeze([0.8, -0.6]);

const glslFloat = value => value.toFixed(3);

export const GROUND_GLSL = `${WORLD_GLSL}
uniform vec3 eye, sun, fogNear, fogFar, fogSun, sunColor, skyAmbient, groundAmbient, shadowTint;
uniform vec3 grass, grassLight, grassWarm, grassTip, flowerWhite, flowerYellow, flowerLilac, forestFloor, rock, rockDark, dirt, sand, snow;
uniform float fogDensity, fogHeight, time, sunStrength, shadowLift, gusts;
const vec2 windDir = vec2(${glslFloat(WIND[0])}, ${glslFloat(WIND[1])});
float riverOffset(vec2 p) { return abs(p.y - (${glslFloat(WORLD.river.z)} + sin(p.x / 410.) * ${glslFloat(WORLD.river.sway)} + sin(p.x / 157. + 1.3) * 38.)); }
float pathOffset(vec2 p) {
  float ahead = -p.y;
  return abs(p.x - (-3. - ahead * .6 + sin(ahead / 13.) * 3. + sin(ahead / 37. + 2.) * 3.)) + (1. - smoothstep(5., 8., ahead)) * 99. + smoothstep(140., 200., ahead) * 99.;
}
float groundGust(vec2 p) {
  float phase = dot(p, windDir) * .16 - time * 1.7 + worldNoise(p / 37.) * 4.;
  return gusts * (.5 + .5 * sin(phase) * sin(phase * .37 + 1.3));
}
vec4 groundAlbedo(vec2 p, float y, vec3 n, float canopy, float dist) {
  float near = 1. - smoothstep(30., 240., dist), sharp = 1. - smoothstep(500., 2600., dist);
  float big = worldFbm(p / 150.), warm = worldNoise(p / 320. + vec2(4.3, 9.)), mid = worldNoise(p / 31.), fine = worldNoise(p / 4.3);
  vec3 g = mix(grass * .9, grassLight, smoothstep(.38, .66, big));
  g = mix(g, grassWarm, smoothstep(.6, .78, warm) * .7);
  g *= 1. + (mid - .5) * .22 * (1. - smoothstep(200., 900., dist)) + (fine - .5) * .12 * near;
  float stroke = worldNoise(vec2(dot(p, windDir), dot(p, vec2(-windDir.y, windDir.x)) * 3.) / 2.5);
  float comb = worldNoise(vec2(dot(p, windDir) * .9, dot(p, vec2(-windDir.y, windDir.x)) * 4.) / 1.1);
  g *= 1. + (stroke - .5) * .26 * smoothstep(8., 20., dist) * (1. - smoothstep(150., 400., dist)) + (comb - .5) * .18 * smoothstep(20., 45., dist) * (1. - smoothstep(110., 220., dist));
  g = mix(g, forestFloor, smoothstep(.35, .85, canopy));
  float sheen = smoothstep(.62, .96, groundGust(p)) * (1. - smoothstep(250., 900., dist)) * (1. - canopy);
  g = mix(g, grassLight * 1.14, sheen * .32);
  float steep = smoothstep(.3, .44, 1. - n.y + (mid - .5) * .16);
  float layer = y / 19. + worldNoise(p / 90.) * 1.6 + worldNoise(p / 17.) * .35, band = fract(layer), id = floor(layer);
  vec3 stone = mix(rockDark, rock, mix(.65, smoothstep(.0, .5, band) * .45 + .55 * worldNoise(p / 25. + id), sharp)) * mix(.9, 1.1, worldHash(vec2(id, 3.)));
  stone = mix(stone, stone * vec3(1.12, 1., .84), step(.72, worldHash(vec2(id, 7.))) * .7 * sharp);
  stone *= .93 + (fine - .5) * .14 * near;
  float ledge = smoothstep(.8, .93, band) * smoothstep(.42, .62, n.y) * sharp;
  g = mix(g, mix(stone, g * .92, ledge), steep);
  float bank = (1. - smoothstep(${glslFloat(WORLD.river.width * 0.75)}, ${glslFloat(WORLD.river.width * 1.6)}, riverOffset(p) + (mid - .5) * 14.)) * (1. - steep);
  g = mix(g, mix(dirt, sand, smoothstep(.3, .7, fine * .5 + mid * .5)), bank);
  float trail = 1. - smoothstep(.65, 1.25, pathOffset(p) + (fine - .5) * .6 + (mid - .5) * .4);
  g = mix(g, mix(dirt, sand, .12) * (.76 + .14 * fine), trail * (1. - steep));
  float frost = smoothstep(560., 640., y + (big - .5) * 70.) * smoothstep(.45, .7, n.y);
  return vec4(mix(g, mix(snow, rock * 1.18, smoothstep(2500., 7000., dist)), frost), steep * (1. - frost));
}
vec3 groundLight(vec3 n, float occlusion) {
  float lit = smoothstep(-.12, .14 + .3 * sun.y, dot(n, sun)) * (1. - occlusion);
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .5 + .5);
  vec3 shade = mix(shadowTint, ambient, .5) * (.62 + shadowLift) * vec3(.94, 1.04, .98);
  return mix(shade, max(sunColor * sunStrength + shade * .3, shade * 1.08), lit);
}
vec3 rockPlanes(vec3 n, vec2 p, float y, float rocky) {
  vec2 q = vec2(p.x + p.y, y) / 11.;
  vec3 tilt = vec3(worldNoise(q) - .5, 0., worldNoise(q + 5.3) - .5);
  return normalize(n + tilt * 1.1 * rocky);
}`;

const TERRAIN_VERTEX = `precision highp float;
attribute vec3 position, normal; attribute vec4 color; uniform mat4 world, viewProjection;
varying vec3 vWorld, vNormal; varying vec4 vCover;
void main() { vec4 p = world * vec4(position, 1.); vWorld = p.xyz; vNormal = normal; vCover = color; gl_Position = viewProjection * p; }`;

const TERRAIN_FRAGMENT = `precision highp float;
varying vec3 vWorld, vNormal; varying vec4 vCover;
${GROUND_GLSL}
void main() {
  vec3 n = normalize(vNormal);
  vec4 ground = groundAlbedo(vWorld.xz, vWorld.y, normalize(mix(n, vec3(0., 1., 0.), vCover.b) - vec3(0., (1. - vCover.a) * (1. - vCover.b) * .8, 0.)), vCover.r, distance(vWorld, eye));
  vec3 color = ground.rgb * mix(vec3(1.), vec3(1.14, 1.06, .88), (1. - vCover.a) * ground.a) * groundLight(rockPlanes(n, vWorld.xz, vWorld.y, ground.a), smoothstep(.45, .9, vCover.r) * .7);
  gl_FragColor = vec4(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), 1.);
}`;

export function applyGround(paint, atmosphere) {
  applyAir(paint, atmosphere);
  for (const key of [...GROUND_PALETTE, ...GROUND_LIGHT]) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
  paint.setFloat('sunStrength', atmosphere.sunStrength); paint.setFloat('shadowLift', atmosphere.shadowLift);
}

export function createTerrainPaint(scene, { still = false } = {}) {
  const paint = new ShaderMaterial('world-terrain-paint', scene, { vertexSource: TERRAIN_VERTEX, fragmentSource: TERRAIN_FRAGMENT }, { attributes: ['position', 'normal', 'color'], uniforms: ['world', 'viewProjection', ...GROUND_UNIFORMS] });
  paint.backFaceCulling = false;
  paint.setFloat('gusts', still ? 0 : 1);
  followEye(scene, paint, still);
  return { paint, setTheme: atmosphere => applyGround(paint, atmosphere) };
}
