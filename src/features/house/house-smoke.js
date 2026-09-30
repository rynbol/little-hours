import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';

const VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv, uv2; uniform mat4 viewProjection; uniform float time; uniform vec3 origin, right, up, drift;
varying vec2 vUv; varying float vSeed, vFade;
void main() {
  float seed = uv2.x, age = fract(time * .11 + seed), size = .28 + age * 1.35;
  vec3 p = origin + vec3(0., age * 3., 0.) + drift * age * age * 1.6;
  p += vec3(sin(age * 5. + seed * 23.), 0., cos(age * 4. + seed * 17.)) * .1 * age;
  vUv = uv; vSeed = seed; vFade = smoothstep(0., .1, age) * (1. - smoothstep(.35, 1., age));
  gl_Position = viewProjection * vec4(p + (right * uv.x + up * uv.y) * size, 1.);
}`;
const FRAGMENT = `precision highp float;
varying vec2 vUv; varying float vSeed, vFade; uniform float time; uniform vec3 lit, shade;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
void main() {
  float wisp = noise(vUv * 1.8 + vec2(vSeed * 31., time * .2)) * .65 + noise(vUv * 4.3 - vec2(time * .15, vSeed * 13.)) * .35;
  float body = 1. - smoothstep(.15, 1., length(vUv) + (wisp - .5) * .55);
  float sunward = clamp(.55 + .45 * dot(vUv, vec2(-.6, .8)), 0., 1.);
  vec3 rgb = mix(shade, lit, sunward * (.7 + .3 * wisp));
  float a = body * vFade * .62;
  gl_FragColor = vec4(rgb * a, a);
}`;

export const SMOKE_PUFFS = 9;
export const SMOKE_TONES = Object.freeze({
  day: { lit: '#fbf6ee', shade: '#b4bfcc' },
  dusk: { lit: '#ead2bf', shade: '#6d6c8a' },
  rain: { lit: '#e2e8e8', shade: '#8e9ba2' },
});

export function smokeShape() {
  const positions = [], uvs = [], uv2s = [], indices = [];
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const seed = i / SMOKE_PUFFS, start = i * 4;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { positions.push(0, 0, 0); uvs.push(u, v); uv2s.push(seed, 0); }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  return { positions, uvs, uv2s, indices };
}

export function createChimneySmoke(scene, theme) {
  const { positions, uvs, uv2s, indices } = smokeShape(), mesh = new Mesh('cottage-smoke', scene), data = new VertexData();
  Object.assign(data, { positions, uvs, uvs2: uv2s, indices }); data.applyToMesh(mesh);
  const paint = new ShaderMaterial('cottage-smoke-paint', scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, { attributes: ['position', 'uv', 'uv2'], uniforms: ['viewProjection', 'time', 'origin', 'right', 'up', 'drift', 'lit', 'shade'], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF; paint.disableDepthWrite = true;
  paint.setVector3('drift', new Vector3(.94, 0, .34));
  mesh.material = paint; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true;
  const right = new Vector3(1, 0, 0), up = new Vector3(0, 1, 0);
  const smoke = {
    mesh,
    setTheme(next) { const tones = SMOKE_TONES[next] || SMOKE_TONES.day; paint.setColor3('lit', Color3.FromHexString(tones.lit)); paint.setColor3('shade', Color3.FromHexString(tones.shade)); },
    animate(seconds, origin, camera) {
      camera.getDirectionToRef(Vector3.RightReadOnly, right); camera.getDirectionToRef(Vector3.UpReadOnly, up);
      paint.setFloat('time', seconds); paint.setVector3('origin', origin); paint.setVector3('right', right); paint.setVector3('up', up);
    },
    dispose() { paint.dispose(); mesh.dispose(); },
  };
  smoke.setTheme(theme);
  paint.setFloat('time', 0); paint.setVector3('origin', Vector3.Zero()); paint.setVector3('right', right); paint.setVector3('up', up);
  return smoke;
}
