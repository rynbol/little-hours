import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Vector4 } from '@babylonjs/core/Maths/math.vector.js';
import { WORLD } from '../../core/world-terrain.js';
import { groundGLSL, GROUND_UNIFORMS, applyGround, CLOUD_SHADOW } from '../world/terrain-paint.js';
import { followEye } from '../world/world-glsl.js';
import { SHADOW_GLSL, SHADOW_UNIFORMS, SHADOW_SAMPLERS } from './light.js';

export const TURF = Object.freeze({ root: 0.8, far: 1.06, nearUntil: 30, farFrom: 85 });

const glsl = value => value.toFixed(3);

export const WILDS_GROUND_GLSL = `${groundGLSL()}
${SHADOW_GLSL}
float sward(vec2 p, float y, vec3 n) {
  float edge = worldNoise(p / 1.3) * .7 + worldNoise(p / 4.1) * .5;
  return smoothstep(.76, .86, n.y) * smoothstep(${glsl(WORLD.river.width * 0.8)}, ${glsl(WORLD.river.width * 1.1)}, riverOffset(p)) * (1. - smoothstep(330., 380., y)) * smoothstep(1.05, 1.75, pathOffset(p) + edge - .6);
}
float turfDepth(float dist) { return mix(${glsl(TURF.root)}, ${glsl(TURF.far)}, smoothstep(${glsl(TURF.nearUntil)}, ${glsl(TURF.farFrom)}, dist)); }
vec3 wildsLit(vec3 albedo, vec3 n, vec3 lightNormal, vec3 p, float canopy, float dist, float shadow) {
  float cover = cloudCover(p.xz), shade = smoothstep(.5, .8, cover) * smoothstep(250., 600., dist);
  float baked = smoothstep(.45, .9, canopy) * mix(.7, 0., shadowNear(p) / max(shadowForm.y, .01));
  vec3 color = albedo * groundLight(lightNormal, max(max(shadow, baked), shade * ${glsl(CLOUD_SHADOW.depth)}));
  color *= 1. + smoothstep(.36, .16, cover) * smoothstep(200., 500., dist) * (1. - smoothstep(3000., 6000., dist)) * .2;
  float crest = pow(1. - abs(dot(n, normalize(eye - p))), 2.) * smoothstep(.3, .7, dot(n, sun)) * (1. - shade);
  return color + sunColor * sunStrength * crest * crestGlow * albedo * 1.6;
}`;

const TERRAIN_VERTEX = `precision highp float;
attribute vec3 position, normal; attribute vec4 color; uniform mat4 world, viewProjection;
varying vec3 vWorld, vNormal; varying vec4 vCover;
void main() { vec4 p = world * vec4(position, 1.); vWorld = p.xyz; vNormal = normal; vCover = color; gl_Position = viewProjection * p; }`;

const TERRAIN_FRAGMENT = `precision highp float;
varying vec3 vWorld, vNormal; varying vec4 vCover;
${WILDS_GROUND_GLSL}
void main() {
  vec3 n = normalize(vNormal);
  float dist = distance(vWorld, eye);
  vec4 ground = groundAlbedo(vWorld.xz, vWorld.y, normalize(mix(n, vec3(0., 1., 0.), vCover.b) - vec3(0., (1. - vCover.a) * (1. - vCover.b) * .8, 0.)), vCover.r, dist);
  float turf = sward(vWorld.xz, vWorld.y, n) * (1. - ground.a);
  float worn = (1. - smoothstep(1., 1.9, pathOffset(vWorld.xz))) * (1. - ground.a) * (1. - smoothstep(40., 120., dist));
  vec3 albedo = ground.rgb * mix(vec3(1.), vec3(1.14, 1.06, .88), (1. - vCover.a) * ground.a) * mix(1., turfDepth(dist), turf) * mix(1., .84 + .34 * worldFbm(vWorld.xz * 1.9) - .08 * smoothstep(.6, .82, worldNoise(vWorld.xz * 5.)), worn);
  vec3 color = wildsLit(albedo, n, rockPlanes(n, vWorld.xz, vWorld.y, ground.a), vWorld, vCover.r, dist, sunShadow(vWorld, 2.4)) * contactShade(vWorld.xz);
  gl_FragColor = vec4(liftRidges(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), vWorld.y, dist), 1.);
}`;

export function createWildsTerrainPaint(scene, { still = false } = {}) {
  const paint = new ShaderMaterial('wilds-terrain-paint', scene, { vertexSource: TERRAIN_VERTEX, fragmentSource: TERRAIN_FRAGMENT }, { attributes: ['position', 'normal', 'color'], uniforms: ['world', 'viewProjection', ...GROUND_UNIFORMS, ...SHADOW_UNIFORMS], samplers: [...SHADOW_SAMPLERS] });
  paint.backFaceCulling = false;
  paint.setFloat('gusts', still ? 0 : 1);
  const shadow = new Vector4(0, 0, 1, 0); paint.setVector4('contactShadow', shadow);
  followEye(scene, paint, still);
  return { paint, setTheme: atmosphere => applyGround(paint, atmosphere), setContactShadow(x, z, radius, strength) { shadow.set(x, z, radius, strength); paint.setVector4('contactShadow', shadow); } };
}
