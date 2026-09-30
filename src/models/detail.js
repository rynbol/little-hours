import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { SURFACE_KIND } from './storybook.js';

export const DETAIL_SOURCES = Object.freeze({
  'study-desk': () => import('./detail/study-desk.js'),
});

export const hasDetail = type => Object.hasOwn(DETAIL_SOURCES, type);

const loaded = new Map(), pending = new Map(), templatesByScene = new WeakMap();

export function loadDetails(types) {
  return Promise.all([...new Set(types)].filter(hasDetail).map(type => {
    if (loaded.has(type)) return loaded.get(type);
    if (!pending.has(type)) pending.set(type, DETAIL_SOURCES[type]().then(module => { const source = decode(module.default); loaded.set(type, source); pending.delete(type); return source; }));
    return pending.get(type);
  }));
}

export const isDetailLoaded = type => loaded.has(type);

const bytes = text => { const raw = atob(text), out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out.buffer; };

function decode(source) {
  const layers = {};
  for (const [layer, shape] of Object.entries(source.layers)) {
    const positions = Float32Array.from(new Int16Array(bytes(shape.positions)), value => value / source.scale);
    const normals = Float32Array.from(new Int8Array(bytes(shape.normals)), value => value / 127);
    const colors = Float32Array.from(new Uint8Array(bytes(shape.colors)), value => value / 255), surfaces = new Float32Array(colors.length / 4);
    for (let i = 0; i < surfaces.length; i++) { surfaces[i] = Math.round(colors[i * 4 + 3] * 10); colors[i * 4 + 3] = 1; }
    const indices = shape.indices32 ? new Uint32Array(bytes(shape.indices32)) : new Uint16Array(bytes(shape.indices));
    layers[layer] = { positions, normals, colors, surfaces, indices, slots: new Uint8Array(bytes(shape.slots)) };
  }
  return { palette: source.palette.map(hex => hex.toLowerCase()), layers };
}

const LAYER_LOOK = {
  paint: material => { material.specularColor = Color3.FromHexString('#1a1612'); material.specularPower = 18; },
  metal: material => { material.specularColor = Color3.FromHexString('#8a7050'); material.specularPower = 42; },
  glow: material => { material.diffuseColor = Color3.Black(); material.specularColor = Color3.Black(); material.emissiveColor = Color3.FromHexString('#a8a294'); },
};

function templates(scene) {
  if (!templatesByScene.has(scene)) templatesByScene.set(scene, { materials: new Map(), nodes: new Map() });
  return templatesByScene.get(scene);
}

function layerMaterial(scene, layer) {
  const cache = templates(scene).materials;
  if (!cache.has(layer)) { const material = new StandardMaterial(`detail-${layer}`, scene); material.diffuseColor = Color3.White(); LAYER_LOOK[layer](material); cache.set(layer, material); }
  return cache.get(layer);
}

function template(type, scene) {
  const cache = templates(scene).nodes;
  if (cache.has(type)) return cache.get(type);
  const source = loaded.get(type), root = new TransformNode(`detail-${type}`, scene);
  for (const [layer, shape] of Object.entries(source.layers)) {
    const mesh = new Mesh(`detail-${type}-${layer}`, scene), data = new VertexData();
    Object.assign(data, { positions: shape.positions, normals: shape.normals, colors: shape.colors, indices: shape.indices });
    data.applyToMesh(mesh, true); mesh.setVerticesData(SURFACE_KIND, shape.surfaces, false, 1);
    mesh.material = layerMaterial(scene, layer); mesh.hasVertexAlpha = false; mesh.useVertexColors = true;
    mesh.receiveShadows = layer !== 'glow'; mesh.isPickable = false; mesh.parent = root;
    mesh.metadata = { detail: true, castShadow: layer !== 'glow', slots: shape.slots, palette: source.palette, baseColors: shape.colors };
  }
  root.setEnabled(false);
  cache.set(type, root);
  return root;
}

export function createDetail(type, scene, repaint = []) {
  if (!loaded.has(type)) return null;
  const copy = template(type, scene).clone(`${type}-detail`, null); copy.setEnabled(false);
  if (repaint.length) for (const mesh of copy.getChildMeshes()) repaintDetail(mesh, repaint);
  return copy;
}

function repaintDetail(mesh, repaint) {
  const { slots, palette, baseColors } = mesh.metadata;
  const ratios = palette.map(hex => { const swap = repaint.find(entry => entry.from === hex); if (!swap) return null; const from = Color3.FromHexString(hex), to = Color3.FromHexString(swap.to); return [to.r / Math.max(from.r, 0.01), to.g / Math.max(from.g, 0.01), to.b / Math.max(from.b, 0.01)]; });
  if (!ratios.some(Boolean)) return;
  const colors = Float32Array.from(baseColors);
  for (let i = 0; i < slots.length; i++) {
    const ratio = ratios[slots[i]]; if (!ratio) continue;
    colors[i * 4] = Math.min(1, colors[i * 4] * ratio[0]); colors[i * 4 + 1] = Math.min(1, colors[i * 4 + 1] * ratio[1]); colors[i * 4 + 2] = Math.min(1, colors[i * 4 + 2] * ratio[2]);
  }
  mesh.makeGeometryUnique(); mesh.setVerticesData('color', colors);
}

export function disposeDetails(scene) {
  const cache = templatesByScene.get(scene); if (!cache) return;
  for (const node of cache.nodes.values()) node.dispose(false, false);
  for (const material of cache.materials.values()) material.dispose();
  templatesByScene.delete(scene);
}
