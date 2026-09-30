import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';

const VERTEX = `precision highp float;
attribute vec3 position; attribute vec2 uv; uniform mat4 viewProjection; varying vec2 vUv;
void main() { vUv = uv; gl_Position = viewProjection * vec4(position, 1.); }`;
const FRAGMENT = `precision highp float;
varying vec2 vUv; uniform float strength; uniform vec3 tint;
void main() {
  float d = length(vUv * vec2(1., 1.25));
  float a = (1. - smoothstep(0., 1., d)) * (1. - smoothstep(0., 1., d)) * strength;
  gl_FragColor = vec4(tint * a, a * .35);
}`;

export const ROOM_WALLS = Object.freeze({ back: -4.35, side: -5.68, top: 5.3 });
export const LANTERN_GLOW_RADIUS = 1.5;

export function lanternGlowShape(lanterns, walls = ROOM_WALLS, radius = LANTERN_GLOW_RADIUS) {
  const positions = [], uvs = [], indices = [];
  lanterns.forEach(([x, y, z], i) => {
    const onSide = x - walls.side < z - walls.back, lift = .004;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const height = Math.min(v, (walls.top - y) / radius);
      positions.push(onSide ? walls.side + lift : x + u * radius, y + height * radius, onSide ? z + u * radius : walls.back + lift);
      uvs.push(u, height);
    }
    indices.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  return { positions, uvs, indices };
}

export function createLanternGlow(scene, lanterns) {
  const mesh = new Mesh('lantern-wall-glow', scene), data = new VertexData();
  Object.assign(data, lanternGlowShape(lanterns)); data.applyToMesh(mesh);
  const paint = new ShaderMaterial('lantern-wall-glow-paint', scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, { attributes: ['position', 'uv'], uniforms: ['viewProjection', 'strength', 'tint'], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF; paint.disableDepthWrite = true;
  paint.setFloat('strength', 0); paint.setColor3('tint', Color3.White());
  mesh.material = paint; mesh.isPickable = false; mesh.metadata = { castShadow: false }; mesh.freezeWorldMatrix();
  return {
    mesh,
    setLight(hex, strength) { paint.setColor3('tint', Color3.FromHexString(hex)); paint.setFloat('strength', strength); mesh.setEnabled(strength > 0); },
    dispose() { paint.dispose(); mesh.dispose(); },
  };
}
