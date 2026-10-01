import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { CLASSIC_WINDOW } from './room-sunbeam.js';

const SIDE_WALL_STANDOFF = 0.004;
const VERTEX = `precision highp float;
attribute vec3 position; attribute float reach; uniform mat4 viewProjection; varying float vReach;
void main() { vReach = reach; gl_Position = viewProjection * vec4(position + vec3(${SIDE_WALL_STANDOFF * 2}, 0., 0.), 1.); }`;
const FRAGMENT = `precision highp float;
varying float vReach; uniform vec3 tint; uniform float strength;
void main() { gl_FragColor = vec4(tint * strength * vReach, 1.); }`;

export const SIDE_WALL_SPILL = Object.freeze({
  faces: Object.freeze([Object.freeze({ x: -5.83, bottom: 1.415, top: 5.69 }), Object.freeze({ x: -5.6, bottom: 0.25, top: 1.415 })]),
  back: -4.27, front: 2, glass: -4.5, cells: Object.freeze([30, 12]), samples: Object.freeze([10, 10]),
});

const archTop = (window, x) => window.arch ? window.arch.y + Math.sqrt(Math.max(0, window.arch.radius ** 2 - (x - window.x) ** 2)) : window.y + window.height / 2;

export function windowReach([px, py, pz], window = CLASSIC_WINDOW, glass = SIDE_WALL_SPILL.glass) {
  const [columns, rows] = SIDE_WALL_SPILL.samples, bottom = window.y - window.height / 2, width = window.width / columns;
  let reach = 0;
  for (let column = 0; column < columns; column++) {
    const sx = window.x - window.width / 2 + (column + 0.5) * width, height = (archTop(window, sx) - bottom) / rows;
    for (let row = 0; row < rows; row++) {
      const dx = sx - px, dy = bottom + (row + 0.5) * height - py, dz = glass - pz, squared = dx * dx + dy * dy + dz * dz;
      reach += Math.max(0, dx) * Math.max(0, -dz) / (squared * squared) * width * height / Math.PI;
    }
  }
  return reach;
}

export function sideWallSpillShape(window = CLASSIC_WINDOW) {
  const { faces, back, front, cells: [columns, rows] } = SIDE_WALL_SPILL, positions = [], reach = [], indices = [];
  for (const { x, bottom, top } of faces) {
    const first = positions.length / 3;
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const point = [x - SIDE_WALL_STANDOFF, bottom + (top - bottom) * row / rows, back + (front - back) * (column / columns) ** 1.6];
      positions.push(...point); reach.push(windowReach(point, window));
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const corner = first + row * (columns + 1) + column, above = corner + columns + 1;
      indices.push(corner, above, corner + 1, corner + 1, above, above + 1);
    }
  }
  return { positions, reach, indices };
}

export function createWindowSpill(scene, parent) {
  const mesh = new Mesh('side-wall-window-spill', scene), { positions, reach, indices } = sideWallSpillShape(), data = new VertexData();
  Object.assign(data, { positions, indices }); data.applyToMesh(mesh); mesh.setVerticesData('reach', reach, false, 1);
  const paint = new ShaderMaterial('side-wall-window-spill-paint', scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, { attributes: ['position', 'reach'], uniforms: ['viewProjection', 'tint', 'strength'], needAlphaBlending: true });
  paint.backFaceCulling = false; paint.disableDepthWrite = true; paint.alphaMode = Constants.ALPHA_ONEONE_ONEZERO;
  paint.setColor3('tint', Color3.White()); paint.setFloat('strength', 0);
  mesh.onBeforeDrawObservable.add(() => scene.getEngine().alphaState.setAlphaBlendFunctionParameters(Constants.GL_ALPHA_FUNCTION_DST_COLOR, 1, 0, 1));
  mesh.material = paint; mesh.parent = parent; mesh.isPickable = false; mesh.receiveShadows = false; mesh.metadata = { castShadow: false, effect: 'window-spill' }; mesh.setEnabled(false);
  let strength = 0, presence = 0;
  const show = () => { paint.setFloat('strength', strength * presence); mesh.setEnabled(strength * presence > 0); };
  return {
    mesh,
    setLight([hex, next]) { paint.setColor3('tint', Color3.FromHexString(hex)); strength = next; show(); },
    show(blend) { if (blend !== presence) { presence = blend; show(); } },
    dispose() { paint.dispose(); mesh.dispose(); },
  };
}
