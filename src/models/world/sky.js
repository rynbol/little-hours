import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';

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

export function createWorldSky(scene, root) {
  const paint = new ShaderMaterial('world-sky-paint', scene, { vertexSource: SKY_VERTEX, fragmentSource: SKY_FRAGMENT }, { attributes: ['position'], uniforms: ['world', 'viewProjection', 'sun', 'zenith', 'horizon', 'glow', 'fogFar'] });
  paint.backFaceCulling = false; paint.disableDepthWrite = true;
  const sky = CreateSphere('world-sky', { diameter: 20000, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.material = paint; sky.parent = root; sky.infiniteDistance = true; sky.isPickable = false; sky.metadata = { castShadow: false, world: true };
  return {
    sky,
    setTheme(atmosphere) {
      paint.setVector3('sun', Vector3.FromArray(atmosphere.sun));
      for (const key of ['zenith', 'horizon', 'glow', 'fogFar']) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
    },
  };
}
