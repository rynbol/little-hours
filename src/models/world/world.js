import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TERRAIN_RINGS, terrainRing } from './terrain-mesh.js';
import { worldAtmosphere } from './atmosphere.js';

export const WORLD_GLSL = `
float worldHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float worldNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(worldHash(i), worldHash(i + vec2(1., 0.)), u.x), mix(worldHash(i + vec2(0., 1.)), worldHash(i + vec2(1., 1.)), u.x), u.y); }
float worldFbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += worldNoise(p) * a; p = p * 2.03 + 17.1; a *= .5; } return s / .9375; }
vec3 worldAir(vec3 color, vec3 world, vec3 eye, vec3 sun, vec3 fogNear, vec3 fogFar, vec3 fogSun, float density, float fogHeight) {
  vec3 ray = world - eye; float d = length(ray); vec3 dir = ray / max(d, 1e-3);
  float heightFade = exp(-max(0., world.y - eye.y * .2) / fogHeight);
  float amount = 1. - exp(-d * density * (.45 + heightFade));
  vec3 air = mix(fogNear, fogFar, smoothstep(200., 4000., d));
  air = mix(air, fogSun, pow(max(dot(dir, sun), 0.), 6.) * .85);
  return mix(color, air, clamp(amount, 0., 1.));
}`;

const TERRAIN_VERTEX = `precision highp float;
attribute vec3 position, normal; attribute vec4 color; uniform mat4 world, viewProjection;
varying vec3 vWorld, vNormal; varying vec4 vCover;
void main() { vec4 p = world * vec4(position, 1.); vWorld = p.xyz; vNormal = normal; vCover = color; gl_Position = viewProjection * p; }`;

const TERRAIN_FRAGMENT = `precision highp float;
varying vec3 vWorld, vNormal; varying vec4 vCover;
uniform vec3 eye, sun, sunColor, skyAmbient, groundAmbient, shadowTint, fogNear, fogFar, fogSun;
uniform vec3 grass, grassLight, grassWarm, forestFloor, rock, rockDark, dirt, sand, snow;
uniform float sunStrength, shadowLift, fogDensity, fogHeight;
${WORLD_GLSL}
void main() {
  vec3 n = normalize(vNormal); vec2 p = vWorld.xz;
  float patches = worldFbm(p / 46.), fine = worldNoise(p / 3.1), brush = worldFbm(p / 11. + n.xz * 2.);
  vec3 ground = mix(grass, grassLight, smoothstep(.3, .8, patches) * .8 + fine * .12);
  ground = mix(ground, grassWarm, smoothstep(.62, .82, worldFbm(p / 130. + 4.)) * .7);
  ground = mix(ground, forestFloor, smoothstep(.15, .7, vCover.r));
  float steep = 1. - smoothstep(.62, .84, n.y + (brush - .5) * .12);
  vec3 stone = mix(rockDark, rock, smoothstep(.3, .75, worldFbm(vec2(p.x + p.y, vWorld.y * 2.) / 9.)));
  ground = mix(ground, stone, steep);
  ground = mix(ground, mix(dirt, sand, fine), smoothstep(.45, .9, vCover.g) * (1. - steep));
  ground = mix(ground, snow, smoothstep(380., 470., vWorld.y + (brush - .5) * 60.) * smoothstep(.5, .75, n.y));
  float lit = clamp((dot(n, sun) + .3) / 1.3, 0., 1.);
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .5 + .5);
  vec3 light = mix(shadowTint * shadowLift + ambient * .35, sunColor * sunStrength, lit) * (1. - vCover.r * .28);
  vec3 color = ground * light;
  gl_FragColor = vec4(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), 1.);
}`;

const SKY_VERTEX = `precision highp float;
attribute vec3 position; uniform mat4 world, viewProjection; varying vec3 vDir;
void main() { vDir = position; gl_Position = viewProjection * world * vec4(position, 1.); }`;

const SKY_FRAGMENT = `precision highp float;
varying vec3 vDir; uniform vec3 sun, zenith, horizon, glow, fogFar;
void main() {
  vec3 d = normalize(vDir); float up = max(d.y, 0.), toward = max(dot(d, sun), 0.);
  vec3 color = mix(horizon, zenith, pow(up, .55));
  color = mix(color, glow, pow(toward, 5.) * .55 * (1. - up * .6));
  color += glow * (pow(toward, 48.) * .55 + smoothstep(.9994, .9997, toward) * 1.6);
  color = mix(fogFar, color, smoothstep(-.08, .03, d.y));
  gl_FragColor = vec4(color, 1.);
}`;

const TERRAIN_COLORS = ['sunColor', 'skyAmbient', 'groundAmbient', 'shadowTint', 'fogNear', 'fogFar', 'fogSun', 'grass', 'grassLight', 'grassWarm', 'forestFloor', 'rock', 'rockDark', 'dirt', 'sand', 'snow'];

export function createOutdoorWorld(scene, { theme = 'day', parent = null } = {}) {
  const root = new TransformNode('world', scene); if (parent) root.parent = parent;
  const terrainPaint = new ShaderMaterial('world-terrain-paint', scene, { vertexSource: TERRAIN_VERTEX, fragmentSource: TERRAIN_FRAGMENT }, { attributes: ['position', 'normal', 'color'], uniforms: ['world', 'viewProjection', 'eye', 'sun', 'sunStrength', 'shadowLift', 'fogDensity', 'fogHeight', ...TERRAIN_COLORS] });
  terrainPaint.backFaceCulling = false;
  const skyPaint = new ShaderMaterial('world-sky-paint', scene, { vertexSource: SKY_VERTEX, fragmentSource: SKY_FRAGMENT }, { attributes: ['position'], uniforms: ['world', 'viewProjection', 'sun', 'zenith', 'horizon', 'glow', 'fogFar'] });
  skyPaint.backFaceCulling = false; skyPaint.disableDepthWrite = true;
  const terrain = TERRAIN_RINGS.map((_, index) => {
    const mesh = new Mesh(`world-terrain-${index}`, scene);
    Object.assign(new VertexData(), terrainRing(index)).applyToMesh(mesh);
    mesh.material = terrainPaint; mesh.parent = root; mesh.isPickable = false; mesh.metadata = { castShadow: false, world: true };
    mesh.freezeWorldMatrix();
    return mesh;
  });
  const sky = CreateSphere('world-sky', { diameter: 20000, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.material = skyPaint; sky.parent = root; sky.infiniteDistance = true; sky.isPickable = false; sky.renderingGroupId = 0; sky.applyFog = false; sky.metadata = { castShadow: false, world: true };
  const eye = new Vector3();
  let current = null;
  function setTheme(next) {
    current = worldAtmosphere(next);
    const sun = Vector3.FromArray(current.sun);
    terrainPaint.setVector3('sun', sun); skyPaint.setVector3('sun', sun);
    for (const key of TERRAIN_COLORS) terrainPaint.setColor3(key, Color3.FromHexString(current[key]));
    for (const [key, value] of [['sunStrength', current.sunStrength], ['shadowLift', current.shadowLift], ['fogDensity', current.fogDensity], ['fogHeight', current.fogHeight]]) terrainPaint.setFloat(key, value);
    for (const key of ['zenith', 'horizon', 'glow', 'fogFar']) skyPaint.setColor3(key, Color3.FromHexString(current[key]));
  }
  setTheme(theme);
  scene.onBeforeRenderObservable.add(() => { const camera = scene.activeCamera; if (!camera) return; eye.copyFrom(camera.globalPosition); terrainPaint.setVector3('eye', eye); });
  return {
    root, terrain, sky, setTheme,
    get atmosphere() { return current; },
    dispose() { root.dispose(false, true); },
  };
}
