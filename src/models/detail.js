import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { SURFACE_KIND } from './storybook.js';
import { LAPTOP } from './furniture.js';

export const DETAIL_SOURCES = Object.freeze({
  'study-desk': () => import('./detail/study-desk.js'),
  'writing-desk': () => import('./detail/writing-desk.js'),
  'bookcase': () => import('./detail/bookcase.js'),
  'lounge-chair': () => import('./detail/lounge-chair.js'),
  'side-table': () => import('./detail/side-table.js'),
  'floor-lamp': () => import('./detail/floor-lamp.js'),
  'plant': () => import('./detail/plant.js'),
  'rug': () => import('./detail/rug.js'),
  'ottoman': () => import('./detail/ottoman.js'),
  'low-cabinet': () => import('./detail/low-cabinet.js'),
  'fireplace': () => import('./detail/fireplace.js'),
  'daybed': () => import('./detail/daybed.js'),
  'moon-tree': () => import('./detail/moon-tree.js'),
  'lantern-cluster': () => import('./detail/lantern-cluster.js'),
  'bean-bag': () => import('./detail/bean-bag.js'),
  'monstera': () => import('./detail/monstera.js'),
  'tea-cart': () => import('./detail/tea-cart.js'),
  'fish-tank': () => import('./detail/fish-tank.js'),
  'globe': () => import('./detail/globe.js'),
  'easel': () => import('./detail/easel.js'),
  'pet-bed': () => import('./detail/pet-bed.js'),
  'seed-bed': () => import('./detail/seed-bed.js'),
  'telescope': () => import('./detail/telescope.js'),
  'moon-rug': () => import('./detail/moon-rug.js'),
  'tall-frame': () => import('./detail/tall-frame.js'),
  'small-frame': () => import('./detail/small-frame.js'),
  'wide-frame': () => import('./detail/wide-frame.js'),
  'moon-clock': () => import('./detail/moon-clock.js'),
  'wall-clock': () => import('./detail/wall-clock.js'),
  'apothecary-shelf': () => import('./detail/apothecary-shelf.js'),
  'wall-shelf': () => import('./detail/wall-shelf.js'),
  'hanging-plant': () => import('./detail/hanging-plant.js'),
  'cloud-shelf': () => import('./detail/cloud-shelf.js'),
  'small-cloud-shelf': () => import('./detail/small-cloud-shelf.js'),
  'wall-scroll': () => import('./detail/wall-scroll.js'),
  'neon-orbit': () => import('./detail/neon-orbit.js'),
  'record-sleeve': () => import('./detail/record-sleeve.js'),
  'felt-rainbow': () => import('./detail/felt-rainbow.js'),
  'cottage-window': () => import('./detail/cottage-window.js'),
  'arched-window': () => import('./detail/arched-window.js'),
  'round-window': () => import('./detail/round-window.js'),
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

export const CLOSE_UP_PAINT = Object.freeze({ woodHues: Object.freeze([36, 60]), woodSaturation: 0.35, kept: Object.freeze({ [LAPTOP.walnut]: '#6b5542' }), drift: Object.freeze({ depth: 0.16, along: 0.9, across: 3.2 }), darkest: 0.26, darkestKept: 0.75, shadowed: Object.freeze({ '#3d2b22': 1.3, '#22170f': 1.25 }) });
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function honeyRatio(hex) {
  const model = Color3.FromHexString(hex), [hue, saturation, value] = model.toHSV().asArray(), [lowest, highest] = CLOSE_UP_PAINT.woodHues;
  if (hue > highest) return [1, 1, 1];
  const shown = CLOSE_UP_PAINT.kept[hex] ? Color3.FromHexString(CLOSE_UP_PAINT.kept[hex]) : Color3.FromHSV(Math.max(hue, lowest), Math.min(saturation, CLOSE_UP_PAINT.woodSaturation), value);
  return [shown.r / Math.max(model.r, 0.01), shown.g / Math.max(model.g, 0.01), shown.b / Math.max(model.b, 0.01)];
}
const lattice = (x, y, z) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); };
const ease = t => t * t * (3 - 2 * t);
function valueNoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = ease(x - ix), fy = ease(y - iy), fz = ease(z - iz);
  const mix = (a, b, t) => a + (b - a) * t, corner = (dx, dy, dz) => lattice(ix + dx, iy + dy, iz + dz);
  const plane = dz => mix(mix(corner(0, 0, dz), corner(1, 0, dz), fx), mix(corner(0, 1, dz), corner(1, 1, dz), fx), fy);
  return mix(plane(0), plane(1), fz);
}
function woodTones(positions, surfaces, slots, palette) {
  const tones = new Float32Array(surfaces.length).fill(1), { depth, along, across } = CLOSE_UP_PAINT.drift, kept = palette.map(hex => Object.hasOwn(CLOSE_UP_PAINT.kept, hex));
  for (let i = 0; i < surfaces.length; i++) if (surfaces[i] === 9 && !kept[slots[i]]) tones[i] = 1 + depth * (valueNoise(positions[i * 3] * along, positions[i * 3 + 1] * across, positions[i * 3 + 2] * across) - 0.5);
  return tones;
}
function closeUp(colors, surfaces, slots, palette, tones) {
  const shown = Float32Array.from(colors), ratios = new Map(), { darkest, darkestKept, shadowed } = CLOSE_UP_PAINT, shade = palette.map(hex => shadowed[hex] ?? 1);
  for (let i = 0; i < slots.length; i++) {
    if (surfaces[i] === 9) {
      if (!ratios.has(slots[i])) ratios.set(slots[i], honeyRatio(palette[slots[i]]));
      const ratio = ratios.get(slots[i]);
      for (let channel = 0; channel < 3; channel++) shown[i * 4 + channel] = Math.min(1, colors[i * 4 + channel] * ratio[channel] * tones[i]);
    }
    const value = luma(shown[i * 4], shown[i * 4 + 1], shown[i * 4 + 2]);
    const lift = (value >= darkest ? 1 : darkest * (darkestKept + (1 - darkestKept) * value / darkest) / Math.max(value, 0.005)) * shade[slots[i]];
    if (lift === 1) continue;
    for (let channel = 0; channel < 3; channel++) shown[i * 4 + channel] = Math.min(1, shown[i * 4 + channel] * lift);
  }
  return shown;
}

function decode(source) {
  const layers = {}, palette = source.palette.map(hex => hex.toLowerCase());
  for (const [layer, shape] of Object.entries(source.layers)) {
    const positions = Float32Array.from(new Int16Array(bytes(shape.positions)), value => value / source.scale);
    const normals = Float32Array.from(new Int8Array(bytes(shape.normals)), value => value / 127);
    const colors = Float32Array.from(new Uint8Array(bytes(shape.colors)), value => value / 255), surfaces = new Float32Array(colors.length / 4);
    for (let i = 0; i < surfaces.length; i++) { surfaces[i] = Math.round(colors[i * 4 + 3] * 10); colors[i * 4 + 3] = 1; }
    const indices = shape.indices32 ? new Uint32Array(bytes(shape.indices32)) : new Uint16Array(bytes(shape.indices)), slots = new Uint8Array(bytes(shape.slots));
    const tones = woodTones(positions, surfaces, slots, palette);
    layers[layer] = { positions, normals, colors: layer === 'glow' ? colors : closeUp(colors, surfaces, slots, palette, tones), modelColors: colors, surfaces, tones, indices, slots };
  }
  if (layers.glow) {
    const page = palette.map(hex => LAPTOP.page.includes(hex)), [glow, screen] = [false, true].map(wanted => pick(layers.glow, slot => page[slot] === wanted));
    if (screen) { layers['glow-page'] = screen; if (glow) layers.glow = glow; else delete layers.glow; }
  }
  return { palette, layers };
}

function pick(shape, wanted) {
  const kept = new Int32Array(shape.slots.length).fill(-1), indices = [];
  let count = 0;
  for (const index of shape.indices) if (wanted(shape.slots[index])) { if (kept[index] < 0) kept[index] = count++; indices.push(kept[index]); }
  if (!indices.length) return null;
  const take = (values, size) => { const out = new values.constructor(count * size); kept.forEach((to, from) => { if (to >= 0) for (let k = 0; k < size; k++) out[to * size + k] = values[from * size + k]; }); return out; };
  return { positions: take(shape.positions, 3), normals: take(shape.normals, 3), colors: take(shape.colors, 4), modelColors: take(shape.modelColors, 4), surfaces: take(shape.surfaces, 1), tones: take(shape.tones, 1), slots: take(shape.slots, 1), indices: count > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices) };
}

const GLOW_LIT = Color3.FromHexString('#a8a294');
const LAYER_LOOK = {
  paint: material => { material.specularColor = Color3.FromHexString('#1a1612'); material.specularPower = 18; },
  metal: material => { material.specularColor = Color3.FromHexString('#8a7050'); material.specularPower = 42; },
  glow: material => { material.diffuseColor = Color3.Black(); material.specularColor = Color3.Black(); material.emissiveColor = GLOW_LIT.clone(); },
};
LAYER_LOOK['glow-page'] = LAYER_LOOK.glow;

const WINDOW_SPILL = Object.freeze({ desks: Object.freeze({ 'study-desk': 3, 'writing-desk': 2.5 }), top: 1.25, back: -1, reach: 0.95, lift: 0.004, cells: Object.freeze([60, 20]), dapple: 7, shafts: 1.4 });
const smooth = (from, to, x) => ease(Math.min(1, Math.max(0, (x - from) / (to - from))));
function spillShape(width) {
  const { top, back, reach, lift, cells: [columns, rows], dapple, shafts } = WINDOW_SPILL, positions = [], colors = [], indices = [];
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const across = column / columns, depth = row / rows, x = (across - 0.5) * width, z = back + depth * reach;
    const leaves = 0.55 + 0.45 * smooth(0.35, 0.65, valueNoise(x * dapple, z * dapple, 0.5)), shaft = 0.7 + 0.3 * valueNoise(x * shafts + z, 3.7, 0.5);
    positions.push(x, top + lift, z); colors.push(1, 1, 1, (1 - depth) ** 1.6 * smooth(0, 0.12, Math.min(across, 1 - across)) * leaves * shaft);
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const corner = row * (columns + 1) + column, next = corner + columns + 1;
    indices.push(corner, corner + 1, next, corner + 1, next + 1, next);
  }
  return { positions, colors, indices };
}

function templates(scene) {
  if (!templatesByScene.has(scene)) templatesByScene.set(scene, { materials: new Map(), nodes: new Map(), page: 1, spill: ['#ffffff', 0] });
  return templatesByScene.get(scene);
}

function layerMaterial(scene, layer) {
  const cache = templates(scene).materials;
  if (!cache.has(layer)) { const material = new StandardMaterial(`detail-${layer}`, scene); material.diffuseColor = Color3.White(); LAYER_LOOK[layer](material); cache.set(layer, material); if (layer === 'glow-page') dimPage(scene, templates(scene).page); }
  return cache.get(layer);
}

function spillMaterial(scene) {
  const cache = templates(scene);
  if (!cache.materials.has('spill')) {
    const material = new StandardMaterial('detail-spill', scene);
    material.disableLighting = true; material.diffuseColor = Color3.Black(); material.specularColor = Color3.Black(); material.disableDepthWrite = true;
    cache.materials.set('spill', material);
  }
  return cache.materials.get('spill');
}

export function spillWindow(scene, level) {
  const cache = templates(scene), paint = cache.materials.get('spill'), [hex, strength] = level;
  cache.spill = level;
  if (!paint) return;
  paint.emissiveColor = Color3.FromHexString(hex); paint.alpha = strength;
  for (const mesh of paint.getBindedMeshes()) mesh.isVisible = strength > 0;
}

export function dimPage(scene, level) {
  const cache = templates(scene), page = cache.materials.get('glow-page');
  cache.page = level;
  if (page) GLOW_LIT.scaleToRef(level, page.emissiveColor);
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
    mesh.receiveShadows = !layer.startsWith('glow'); mesh.isPickable = false; mesh.parent = root;
    mesh.metadata = { detail: true, castShadow: !layer.startsWith('glow'), slots: shape.slots, palette: source.palette, baseColors: shape.modelColors, tones: shape.tones };
  }
  if (WINDOW_SPILL.desks[type]) {
    const spill = new Mesh(`detail-${type}-spill`, scene), data = new VertexData();
    Object.assign(data, spillShape(WINDOW_SPILL.desks[type])); data.applyToMesh(spill, false);
    spill.material = spillMaterial(scene); spill.hasVertexAlpha = true; spill.useVertexColors = true;
    spill.receiveShadows = false; spill.isPickable = false; spill.parent = root; spill.metadata = { detail: true, castShadow: false, spill: true };
    spillWindow(scene, templates(scene).spill);
  }
  root.setEnabled(false);
  cache.set(type, root);
  return root;
}

export function createDetail(type, scene, repaint = []) {
  if (!loaded.has(type)) return null;
  const copy = template(type, scene).clone(`${type}-detail`, null); copy.setEnabled(false);
  if (repaint.length) for (const mesh of copy.getChildMeshes()) if (!mesh.metadata.spill) repaintDetail(mesh, repaint);
  return copy;
}

function repaintDetail(mesh, repaint) {
  const { slots, palette, baseColors, tones } = mesh.metadata;
  const ratios = palette.map(hex => { const swap = repaint.find(entry => entry.from === hex); if (!swap) return null; const from = Color3.FromHexString(hex), to = Color3.FromHexString(swap.to); return [to.r / Math.max(from.r, 0.01), to.g / Math.max(from.g, 0.01), to.b / Math.max(from.b, 0.01)]; });
  if (!ratios.some(Boolean)) return;
  const colors = Float32Array.from(mesh.getVerticesData('color'));
  for (let i = 0; i < slots.length; i++) {
    const ratio = ratios[slots[i]]; if (!ratio) continue;
    for (let channel = 0; channel < 3; channel++) colors[i * 4 + channel] = Math.min(1, baseColors[i * 4 + channel] * ratio[channel] * tones[i]);
  }
  mesh.makeGeometryUnique(); mesh.setVerticesData('color', colors);
}

export function disposeDetails(scene) {
  const cache = templatesByScene.get(scene); if (!cache) return;
  for (const node of cache.nodes.values()) node.dispose(false, false);
  for (const material of cache.materials.values()) material.dispose();
  templatesByScene.delete(scene);
}
