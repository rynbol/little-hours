import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
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

export const DESK_TOP = Object.freeze({ y: 1.254, back: -1.0, front: 0.06 });
export const DESK_POOL = Object.freeze({ at: [0.96, -0.69], radius: 0.8, tint: '#ffd29a' });

export function deskPoolShape(halfWidth, top = DESK_TOP, pool = DESK_POOL) {
  const [cx, cz] = pool.at, x0 = Math.max(-halfWidth, cx - pool.radius), x1 = Math.min(halfWidth, cx + pool.radius), z0 = Math.max(top.back, cz - pool.radius), z1 = Math.min(top.front, cz + pool.radius);
  const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  return { positions: corners.flatMap(([x, z]) => [x, top.y, z]), uvs: corners.flatMap(([x, z]) => [(x - cx) / pool.radius, (z - cz) / pool.radius]), indices: [0, 1, 2, 0, 2, 3] };
}

export function createGlowDecal(scene, name, shape, updatable = false) {
  const mesh = new Mesh(name, scene), data = new VertexData(), corner = new Vector3();
  Object.assign(data, shape); data.applyToMesh(mesh, updatable);
  const paint = new ShaderMaterial(`${name}-paint`, scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, { attributes: ['position', 'uv'], uniforms: ['viewProjection', 'strength', 'tint'], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.alphaMode = Constants.ALPHA_PREMULTIPLIED_PORTERDUFF; paint.disableDepthWrite = true;
  paint.setFloat('strength', 0); paint.setColor3('tint', Color3.White());
  mesh.material = paint; mesh.isPickable = false; mesh.metadata = { castShadow: false };
  const setStrength = strength => { paint.setFloat('strength', strength); mesh.setEnabled(strength > 0); };
  return {
    mesh,
    setStrength,
    setLight(hex, strength) { paint.setColor3('tint', Color3.FromHexString(hex)); setStrength(strength); },
    place({ positions }, matrix) {
      const world = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) { Vector3.TransformCoordinatesFromFloatsToRef(positions[i], positions[i + 1], positions[i + 2], matrix, corner); world[i] = corner.x; world[i + 1] = corner.y; world[i + 2] = corner.z; }
      mesh.updateVerticesData('position', world, true);
    },
    dispose() { paint.dispose(); mesh.dispose(); },
  };
}

export function createLanternGlow(scene, lanterns) {
  const glow = createGlowDecal(scene, 'lantern-wall-glow', lanternGlowShape(lanterns));
  glow.mesh.freezeWorldMatrix();
  return glow;
}
