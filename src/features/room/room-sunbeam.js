import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';

const VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv, uv2; uniform mat4 viewProjection;
varying vec2 vUv; varying float vSlice;
void main() { vUv = uv; vSlice = uv2.x; gl_Position = viewProjection * vec4(position, 1.); }`;
const FRAGMENT = `precision highp float;
varying vec2 vUv; varying float vSlice; uniform float time, strength; uniform vec3 tint;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
void main() {
  float across = pow(sin(3.14159 * vUv.x), 1.6), along = smoothstep(0., .12, vUv.y) * (1. - smoothstep(.55, 1., vUv.y));
  float streak = .55 + .45 * noise(vec2(vSlice * 3.1 + vUv.x * 2., vUv.y * 1.5 - time * .05));
  vec2 dust = vec2(vUv.x * 26. + vSlice * 7.3, vUv.y * 40. - time * .35);
  vec2 cell = floor(dust), spot = fract(dust) - .5 + (vec2(hash(cell + 3.1), hash(cell + 8.7)) - .5) * .5;
  float speck = step(.9, hash(cell)) * (1. - smoothstep(.06, .2, length(spot))) * (.5 + .5 * sin(time * 1.3 + hash(cell + 1.7) * 6.28));
  float a = across * along * (streak + speck * 2.2) * strength;
  gl_FragColor = vec4(tint * a, a);
}`;

export const CLASSIC_WINDOW = Object.freeze({ x: -2.7, y: 3.35, width: 4.2, height: 3.8, z: -4.43, arch: Object.freeze({ y: 3.15, radius: 2.1 }) });
export const BEAM_SLICES = 7;

export function sunbeamShape(window, direction, floor = 0) {
  const [dx, dy, dz] = direction, positions = [], uvs = [], uv2s = [], indices = [];
  const bottom = window.y - window.height / 2, z = window.z ?? -4.43;
  const land = (x, y) => { const t = (y - floor) / -dy; return [x + dx * t, floor, z + dz * t]; };
  for (let i = 0; i < BEAM_SLICES; i++) {
    const x = window.x + ((i + .5) / BEAM_SLICES - .5) * window.width, off = x - window.x;
    const top = window.arch ? window.arch.y + Math.sqrt(Math.max(0, window.arch.radius ** 2 - off ** 2)) : window.y + window.height / 2;
    const start = positions.length / 3;
    positions.push(x, bottom, z, x, top, z, ...land(x, top), ...land(x, bottom));
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1); uv2s.push(i, 0, i, 0, i, 0, i, 0);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  return { positions, uvs, uv2s, indices };
}

export function createSunbeam(scene) {
  const mesh = new Mesh('window-sunbeam', scene);
  const paint = new ShaderMaterial('window-sunbeam-paint', scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, { attributes: ['position', 'uv', 'uv2'], uniforms: ['viewProjection', 'time', 'strength', 'tint'], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF; paint.disableDepthWrite = true;
  paint.setFloat('time', 0); paint.setFloat('strength', 0); paint.setColor3('tint', Color3.White());
  mesh.material = paint; mesh.isPickable = false; mesh.metadata = { castShadow: false }; mesh.alwaysSelectAsActiveMesh = true;
  return {
    mesh,
    shine(window, direction, floor) {
      const { positions, uvs, uv2s, indices } = sunbeamShape(window, direction, floor), data = new VertexData();
      Object.assign(data, { positions, uvs, uvs2: uv2s, indices }); data.applyToMesh(mesh, true);
    },
    setLight(hex, strength) { paint.setColor3('tint', Color3.FromHexString(hex)); paint.setFloat('strength', strength); mesh.setEnabled(strength > 0); },
    animate(seconds) { paint.setFloat('time', seconds); },
    dispose() { paint.dispose(); mesh.dispose(); },
  };
}
