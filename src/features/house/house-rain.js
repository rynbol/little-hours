import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';

const VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv; uniform float time, aspect;
varying float vAlpha;
void main() {
  float near = position.y, fall = fract(position.z + time * (.75 + near * .7));
  float length = .07 + near * .09, along = uv.y;
  vec2 head = vec2(position.x * 2.6 - 1.2 - fall * .22 / aspect, 1.2 - fall * 2.4);
  vec2 slope = vec2(.09 / aspect, 1.);
  vec2 at = head + slope * along * length + vec2(uv.x * (.0011 + near * .0009), 0.);
  vAlpha = (.1 + near * .2) * along;
  gl_Position = vec4(at, 0., 1.);
}`;
const FRAGMENT = `precision highp float;
varying float vAlpha; uniform vec3 tone;
void main() { gl_FragColor = vec4(tone * vAlpha, vAlpha); }`;

export const RAIN_STREAKS = 210;
export const RAIN_TONE = '#e3edf3';
const hash = n => { const s = Math.sin(n * 91.7 + 4.1) * 43758.5453; return s - Math.floor(s); };

export function rainShape() {
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i < RAIN_STREAKS; i++) {
    const across = (i + hash(i * 1.3)) / RAIN_STREAKS, near = hash(i * 2.9) ** 2, phase = hash(i * 5.3), start = i * 4;
    for (const [side, along] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { positions.push(across, near, phase); uvs.push(side, along); }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  return { positions, uvs, indices };
}

export const rains = theme => theme === 'rain';

export function createIslandRain(scene, theme) {
  const mesh = new Mesh('island-rain', scene), data = new VertexData();
  Object.assign(data, rainShape()); data.applyToMesh(mesh);
  const paint = new ShaderMaterial('island-rain-paint', scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, { attributes: ['position', 'uv'], uniforms: ['time', 'aspect', 'tone'], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF; paint.disableDepthWrite = true; paint.depthFunction = Constants.ALWAYS;
  paint.setColor3('tone', Color3.FromHexString(RAIN_TONE)); paint.setFloat('time', 0); paint.setFloat('aspect', 1.44);
  mesh.material = paint; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.alphaIndex = 1000; mesh.metadata = { castShadow: false };
  const rain = {
    mesh,
    setTheme(next) { mesh.setEnabled(rains(next)); },
    animate(seconds, aspect) { paint.setFloat('time', seconds); paint.setFloat('aspect', aspect); },
    dispose() { paint.dispose(); mesh.dispose(); },
  };
  rain.setTheme(theme);
  return rain;
}
