import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { WORLD_GLSL } from './world-glsl.js';

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

const TERRAIN_COLORS = ['sunColor', 'skyAmbient', 'groundAmbient', 'shadowTint', 'fogNear', 'fogFar', 'fogSun', 'grass', 'grassLight', 'grassWarm', 'forestFloor', 'rock', 'rockDark', 'dirt', 'sand', 'snow'];

export function createTerrainPaint(scene) {
  const paint = new ShaderMaterial('world-terrain-paint', scene, { vertexSource: TERRAIN_VERTEX, fragmentSource: TERRAIN_FRAGMENT }, { attributes: ['position', 'normal', 'color'], uniforms: ['world', 'viewProjection', 'eye', 'sun', 'sunStrength', 'shadowLift', 'fogDensity', 'fogHeight', ...TERRAIN_COLORS] });
  paint.backFaceCulling = false;
  const eye = new Vector3();
  const watch = scene.onBeforeRenderObservable.add(() => { const camera = scene.activeCamera; if (!camera) return; eye.copyFrom(camera.globalPosition); paint.setVector3('eye', eye); });
  paint.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(watch));
  return {
    paint,
    setTheme(atmosphere) {
      paint.setVector3('sun', Vector3.FromArray(atmosphere.sun));
      for (const key of TERRAIN_COLORS) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
      for (const key of ['sunStrength', 'shadowLift', 'fogDensity', 'fogHeight']) paint.setFloat(key, atmosphere[key]);
    },
  };
}
