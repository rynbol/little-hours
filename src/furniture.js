import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateBox, CreateSegmentedBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder.js';
import { CreateTube } from '@babylonjs/core/Meshes/Builders/tubeBuilder.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Vector3, Vector4, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { getFurniture } from './catalog.js';

// Hand-built forms, real joinery, small deliberate details. No downloaded models,
// generated pictures or texture files: even the notebook and screen are geometry.
// Every cache belongs to one Babylon Scene; instances share geometry and materials.
const sceneCaches = new WeakMap();
function cacheFor(scene) {
  if (!sceneCaches.has(scene)) {
    sceneCaches.set(scene, { templates: new Map(), materials: new Map(), batches: new Map() });
    scene.onDisposeObservable.addOnce(() => sceneCaches.delete(scene));
  }
  return sceneCaches.get(scene);
}
const C = {
  wood: '#aa7954', edge: '#bc9169', darkWood: '#73533d', cream: '#e7dec7',
  sage: '#83968a', sageLight: '#a0afa0', linen: '#dfd1b2', brass: '#bf9762',
  terracotta: '#bd8469', leaf: '#809362', darkLeaf: '#617853', dark: '#50564c',
  ink: '#697361', paper: '#f2ead5', tan: '#caa26c', skin: '#d6ad87',
};
const bookColors = ['#788e84', '#bb8066', '#d5b77c', '#a4ac8e', '#829da3', '#c7a696'];

// A three-segment bevel keeps broad faces crisp and corners intentionally faceted.
// The helper is shared with the room architecture so its visual language matches.
export function createRoundedBox(name, size, radius, scene) {
  const r = Math.max(0, Math.min(radius, Math.min(...size) * 0.44));
  if (r < 0.001) return CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  const data = CreateSegmentedBoxVertexData({ width: size[0], height: size[1], depth: size[2], segments: 3 });
  for (let i = 0; i < data.positions.length; i += 3) {
    const point = [0, 0, 0], center = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      const half = size[axis] / 2, value = data.positions[i + axis];
      point[axis] = Math.sign(value) * (Math.abs(value) > half * 0.8 ? half : half - r);
      center[axis] = Math.max(-half + r, Math.min(half - r, point[axis]));
    }
    const normal = new Vector3(point[0] - center[0], point[1] - center[1], point[2] - center[2]).normalize();
    for (let axis = 0; axis < 3; axis++) {
      const n = [normal.x, normal.y, normal.z][axis];
      data.positions[i + axis] = center[axis] + n * r;
      data.normals[i + axis] = n;
    }
  }
  const result = new Mesh(name, scene); data.applyToMesh(result); return result;
}
// A soft pool of ambient shade: an even core that fades out over `soft` world
// units in two steps, so small and large shapes share one physical falloff.
// Vertex alpha only; it never casts, receives shadows or takes picks.
export function createContactShadow(name, width, depth, scene, { soft = 0.45, strength = 0.42 } = {}) {
  const cache = cacheFor(scene);
  if (!cache.materials.has('contact-shadow')) {
    const shade = new StandardMaterial('furniture-contact-shadow', scene);
    shade.disableLighting = true; shade.diffuseColor = Color3.White(); shade.specularColor = Color3.Black();
    shade.backFaceCulling = false; shade.disableDepthWrite = true;
    cache.materials.set('contact-shadow', shade);
  }
  const hx = Math.max(0.01, width / 2), hz = Math.max(0.01, depth / 2), steps = 5, tone = [0.10, 0.065, 0.04];
  const rings = [[0, strength], [soft * 0.35, strength * 0.45], [soft, 0]], perRing = 4 * (steps + 1);
  const positions = [0, 0, 0], colors = [...tone, strength], indices = [];
  for (const [offset, alpha] of rings) for (let corner = 0; corner < 4; corner++) for (let step = 0; step <= steps; step++) {
    const angle = (corner + step / steps) * Math.PI / 2;
    positions.push((corner === 0 || corner === 3 ? hx : -hx) + Math.cos(angle) * offset, 0, (corner < 2 ? hz : -hz) + Math.sin(angle) * offset);
    colors.push(...tone, alpha);
  }
  for (let j = 0; j < perRing; j++) indices.push(0, 1 + j, 1 + (j + 1) % perRing);
  for (let ring = 0; ring < rings.length - 1; ring++) for (let j = 0; j < perRing; j++) {
    const a = 1 + ring * perRing + j, b = 1 + ring * perRing + (j + 1) % perRing;
    indices.push(a, a + perRing, b, b, a + perRing, b + perRing);
  }
  const data = new VertexData(); Object.assign(data, { positions, indices, colors, normals: positions.map((_, i) => i % 3 === 1 ? 1 : 0) });
  const result = new Mesh(name, scene); data.applyToMesh(result);
  result.material = cache.materials.get('contact-shadow'); result.hasVertexAlpha = true;
  result.isPickable = false; result.receiveShadows = false; result.metadata = { castShadow: false, effect: 'contact-shadow' };
  return result;
}
function material(scene, color, extra = {}) {
  const cache = cacheFor(scene), key = `${color}:${JSON.stringify(extra)}`;
  if (!cache.materials.has(key)) {
    const result = new StandardMaterial(`furniture-${key}`, scene);
    result.diffuseColor = Color3.FromHexString(color);
    result.specularColor = new Color3(extra.metalness ? 0.32 : 0.045, extra.metalness ? 0.27 : 0.045, extra.metalness ? 0.18 : 0.045);
    result.specularPower = extra.metalness ? 48 : 20;
    result.emissiveColor = extra.emissive ? Color3.FromHexString(extra.emissive).scale(extra.emissiveIntensity ?? 1) : Color3.Black();
    if (extra.alpha) result.alpha = extra.alpha;
    result.metadata = { batchKey: JSON.stringify({ metal: Boolean(extra.metalness), emissive: extra.emissive || null, intensity: extra.emissiveIntensity || 0, ...(extra.accent ? { accent: true } : {}), ...(extra.alpha ? { alpha: extra.alpha } : {}), ...(extra.part ? { part: extra.part } : {}) }) };
    cache.materials.set(key, result);
  }
  return cache.materials.get(key);
}
function mesh(parent, shape, color, position, extra) {
  shape.material = material(parent.getScene(), color, extra);
  shape.position.set(...position); shape.parent = parent;
  shape.receiveShadows = true; shape.isPickable = true; return shape;
}
function box(parent, size, position, color, radius = 0.025) {
  return mesh(parent, createRoundedBox('joinery', size, Math.min(radius, 0.055), parent.getScene()), color, position);
}
function sphere(parent, size, position, color) {
  const result = mesh(parent, CreateSphere('soft-form', { diameter: 2, segments: 6 }, parent.getScene()), color, position);
  result.scaling.set(...size); return result;
}
function cylinder(parent, top, bottom, height, position, color, { segments = 12, ...extra } = {}) {
  return mesh(parent, CreateCylinder('turned-form', { diameterTop: top * 2, diameterBottom: bottom * 2, height, tessellation: segments }, parent.getScene()), color, position, extra);
}
function rod(parent, a, b, radius, color, extra = {}) {
  const start = new Vector3(...a), end = new Vector3(...b), delta = end.subtract(start);
  const result = mesh(parent, CreateCylinder('stem', { diameter: radius * 2, height: delta.length(), tessellation: 8 }, parent.getScene()), color, start.add(end).scale(0.5).asArray(), extra);
  result.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), delta.normalize(), new Quaternion());
  return result;
}
function torus(parent, radius, tube, position, color, arc = Math.PI * 2) {
  const positions = [], normals = [], indices = [], rings = 20, sides = 6;
  for (let i = 0; i <= rings; i++) {
    const u = i / rings * arc;
    for (let j = 0; j <= sides; j++) {
      const v = j / sides * Math.PI * 2;
      positions.push((radius + tube * Math.cos(v)) * Math.cos(u), (radius + tube * Math.cos(v)) * Math.sin(u), tube * Math.sin(v));
      normals.push(Math.cos(v) * Math.cos(u), Math.cos(v) * Math.sin(u), Math.sin(v));
      if (i < rings && j < sides) { const a = i * (sides + 1) + j, b = a + sides + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    }
  }
  const data = new VertexData(); Object.assign(data, { positions, normals, indices });
  const result = new Mesh('piping', parent.getScene()); data.applyToMesh(result);
  return mesh(parent, result, color, position);
}
function group(parent, position = [0, 0, 0]) {
  const result = new TransformNode('detail-group', parent.getScene());
  result.position.set(...position); result.parent = parent; return result;
}

// Bake transforms and colors into shared geometry. Every matte painted or wooden
// part uses the same material, so a colorful shelf still costs one draw call.
function batch(source) {
  const scene = source.getScene(), cache = cacheFor(scene), buckets = new Map();
  for (const part of source.getChildMeshes()) {
    const mat = part.material, key = mat.metadata.batchKey;
    if (!cache.batches.has(key)) {
      const result = new StandardMaterial(`furniture-batch-${key}`, scene);
      // An accent keeps its color on the material too, so its whole light is
      // tinted like the rooms' own glowing parts.
      result.diffuseColor = JSON.parse(key).accent ? mat.diffuseColor.clone() : Color3.White(); result.specularColor = mat.specularColor.clone();
      result.specularPower = mat.specularPower; result.emissiveColor = mat.emissiveColor.clone(); result.alpha = mat.alpha;
      if (JSON.parse(key).accent) result.metadata = { accent: mat.emissiveColor.clone() };
      cache.batches.set(key, result);
    }
    part.computeWorldMatrix(true);
    const data = VertexData.ExtractFromMesh(part, true, true);
    data.transform(part.getWorldMatrix());
    data.uvs = undefined; data.uvs2 = undefined;
    const color = mat.diffuseColor;
    data.colors = [];
    for (let i = 0; i < data.positions.length; i += 3) data.colors.push(color.r, color.g, color.b, 1);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(data);
  }
  const result = new TransformNode('furniture-batch', scene);
  for (const [key, parts] of buckets) {
    const data = parts[0]; if (parts.length > 1) data.merge(parts.slice(1), true);
    const object = new Mesh('handmade-details', scene); data.applyToMesh(object);
    object.material = cache.batches.get(key); object.parent = result;
    object.useVertexColors = true; object.hasVertexAlpha = false;
    object.receiveShadows = true; object.isPickable = true;
    // Glowing accents and see-through water cast no shadows, like the rooms' own.
    // The easel's canvas is never outlined: an outline around it would hide the
    // picture in front of it, which has its own outline.
    if (JSON.parse(key).accent || JSON.parse(key).alpha) object.metadata = { castShadow: false };
    if (JSON.parse(key).part === 'canvas') object.metadata = { outline: false };
  }
  source.dispose(false, false); return result;
}
function mug(parent, x, y, z, scale = 1) {
  const cup = group(parent, [x, y, z]); cup.scaling.setAll(scale);
  cylinder(cup, 0.105, 0.082, 0.19, [0, 0.095, 0], C.cream);
  cylinder(cup, 0.087, 0.087, 0.006, [0, 0.193, 0], '#74543b');
  const handle = torus(cup, 0.067, 0.021, [0.111, 0.105, 0], C.cream); handle.rotation.y = 0.1;
}
function book(parent, width, height, depth, x, y, z, color, angle = 0) {
  const bookGroup = group(parent, [x, y, z]); bookGroup.rotation.y = angle;
  box(bookGroup, [width, height, depth], [0, 0, 0], color, 0.006);
  box(bookGroup, [width - 0.045, height * 0.55, 0.012], [0, 0, depth / 2 + 0.002], C.paper, 0.002);
}
function deskLamp(parent, x, y, z) {
  const lamp = group(parent, [x, y, z]);
  const brass = { metalness: 0.45, roughness: 0.38 };
  cylinder(lamp, 0.16, 0.19, 0.055, [0, 0.03, 0], C.brass, brass);
  rod(lamp, [0, 0.055, 0], [0, 0.53, 0], 0.021, C.brass, brass);
  rod(lamp, [0, 0.53, 0], [-0.14, 0.65, 0], 0.021, C.brass, brass);
  cylinder(lamp, 0.10, 0.24, 0.21, [-0.14, 0.63, 0], '#c99858');
  cylinder(lamp, 0.205, 0.205, 0.013, [-0.14, 0.52, 0], '#f4dba1', { emissive: '#ffbd61', emissiveIntensity: 0.38 });
}
function laptop(parent) {
  const laptopGroup = group(parent, [0, 1.29, -0.43]);
  box(laptopGroup, [0.97, 0.045, 0.62], [0, 0, 0], '#777f72', 0.025);
  box(laptopGroup, [0.68, 0.008, 0.23], [0, 0.028, -0.06], '#485047', 0.012);
  box(laptopGroup, [0.25, 0.007, 0.12], [0, 0.028, 0.19], '#a9ae9e', 0.012);
  const screen = group(laptopGroup, [0, 0.027, -0.26]); screen.rotation.x = -0.12;
  box(screen, [0.97, 0.62, 0.045], [0, 0.3, 0], '#777f72', 0.026);
  box(screen, [0.86, 0.51, 0.009], [0, 0.3, 0.028], '#ced8bd', 0.005);
  box(screen, [0.20, 0.45, 0.009], [-0.29, 0.3, 0.034], '#b0c0a2', 0.004);
  box(screen, [0.52, 0.41, 0.01], [0.12, 0.3, 0.04], '#eee9d3', 0.009);
  box(screen, [0.28, 0.017, 0.008], [0.05, 0.445, 0.049], '#829477', 0.001);
  for (let i = 0; i < 6; i++) box(screen, [i === 5 ? 0.21 : 0.40, 0.009, 0.008], [i === 5 ? 0.025 : 0.12, 0.39 - i * 0.042, 0.049], '#b9c4ab', 0.001);
  for (let i = 0; i < 4; i++) box(screen, [0.12 - i * 0.012, 0.01, 0.008], [-0.29, 0.44 - i * 0.045, 0.046], '#829477', 0.001);
}
function notebook(parent) {
  const notebookGroup = group(parent, [0, 1.293, -0.34]); notebookGroup.rotation.y = -0.10;
  box(notebookGroup, [0.9, 0.035, 0.63], [0, 0, 0], '#789286', 0.018);
  box(notebookGroup, [0.85, 0.016, 0.58], [0, 0.023, 0], C.paper, 0.008);
  box(notebookGroup, [0.012, 0.012, 0.57], [0, 0.034, 0], '#b2a88b', 0.002);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 5; i++) box(notebookGroup, [0.29, 0.004, 0.007], [side * 0.22, 0.034, -0.16 + i * 0.062], '#b7bea4', 0.001);
  }
  rod(notebookGroup, [0.31, 0.054, -0.05], [0.37, 0.054, 0.24], 0.012, '#b98754');
}
function studyStation(parent, writing) {
  const width = writing ? 2.5 : 3;
  const timber = writing ? '#d8ccb1' : C.wood;
  box(parent, [width, 0.14, 1.10], [0, 1.18, -0.47], timber, 0.06);
  [-1, 1].forEach(side => {
    for (const z of [-0.89, -0.05]) rod(parent, [side * (width / 2 - 0.16), 0.012, z], [side * (width / 2 - 0.20), 1.12, z], 0.055, writing ? C.edge : C.darkWood);
  });
  box(parent, [writing ? 0.64 : 0.75, 0.24, 0.84], [-width / 2 + 0.50, 0.99, -0.45], timber, 0.025);
  box(parent, [writing ? 0.54 : 0.64, 0.17, 0.037], [-width / 2 + 0.50, 0.99, -0.01], writing ? '#c3b597' : C.edge, 0.013);
  box(parent, [0.18, 0.025, 0.025], [-width / 2 + 0.50, 1.0, 0.02], C.brass, 0.006);
  const chair = group(parent, [0, 0, 0.52]);
  const cloth = writing ? '#b98770' : C.sage;
  box(chair, [0.88, 0.16, 0.83], [0, 0.63, 0], cloth, 0.085);
  box(chair, [0.86, 0.62, 0.14], [0, 0.97, 0.36], cloth, 0.066);
  for (const x of [-0.32, 0.32]) for (const z of [-0.28, 0.28]) rod(chair, [x * 1.14, 0.012, z * 1.18], [x, 0.58, z], 0.044, C.darkWood);
  for (const x of [-0.42, 0.42]) {
    rod(chair, [x, 0.62, 0.20], [x, 0.96, 0.20], 0.03, C.darkWood);
    box(chair, [0.10, 0.07, 0.5], [x, 0.98, 0], C.wood, 0.02);
  }
  if (writing) {
    notebook(parent);
    cylinder(parent, 0.10, 0.085, 0.19, [-0.91, 1.36, -0.75], C.terracotta);
    for (let i = 0; i < 4; i++) rod(parent, [-0.95 + i * 0.025, 1.35, -0.75], [-0.96 + i * 0.03, 1.61 - (i % 2) * 0.05, -0.74], 0.008, [C.wood, C.sage, C.tan, C.dark][i]);
    deskLamp(parent, 0.91, 1.26, -0.76);
    mug(parent, 0.72, 1.26, -0.06, 0.9);
    book(parent, 0.38, 0.055, 0.30, -0.83, 1.285, -0.12, bookColors[1], 0.15);
  } else {
    laptop(parent); deskLamp(parent, 1.10, 1.26, -0.69); mug(parent, 0.83, 1.26, -0.13);
    for (let i = 0; i < 3; i++) book(parent, 0.48 - i * 0.02, 0.065, 0.35, -1.02, 1.29 + i * 0.068, -0.70, bookColors[i], i === 1 ? 0.13 : -0.045);
    box(parent, [0.42, 0.015, 0.3], [-0.77, 1.265, -0.08], C.paper, 0.008);
    rod(parent, [-0.9, 1.281, -0.14], [-0.64, 1.281, -0.02], 0.01, C.darkWood);
  }
}

function bookcase(parent) {
  box(parent, [1.77, 3.16, 0.065], [0, 1.65, -0.23], '#64483b', 0.01);
  for (const x of [-0.88, 0.88]) {
    box(parent, [0.11, 3.35, 0.54], [x, 1.675, 0], '#936c4e', 0.02);
    box(parent, [0.025, 3.17, 0.019], [x, 1.68, 0.285], '#c29c68', 0.006);
  }
  for (const y of [0.08, 0.82, 1.58, 2.36, 3.29]) box(parent, [1.85, 0.10, 0.59], [0, y, 0], '#936c4e', 0.023);
  box(parent, [1.88, 0.12, 0.61], [0, 3.36, 0], '#73533f', 0.025);
  box(parent, [1.68, 0.025, 0.025], [0, 3.385, 0.305], '#c6a16b', 0.007);
  for (let level = 0; level < 4; level++) {
    for (let i = 0; i < (level === 1 ? 4 : 7); i++) {
      if (level === 2 && i === 2) continue; // The tipping book, built by tippingBook().
      const h = 0.34 + ((i * 7 + level * 3) % 5) * 0.041;
      const x = -0.71 + i * 0.16, bottom = [0.13, 0.87, 1.63, 2.41][level];
      box(parent, [0.13, h, 0.31], [x, bottom + h / 2, 0.07], bookColors[(i + level) % bookColors.length], 0.006);
      box(parent, [0.088, 0.013, 0.006], [x, bottom + h * 0.78, 0.228], C.paper, 0.002);
    }
  }
  cylinder(parent, 0.14, 0.18, 0.23, [0.43, 0.985, 0.07], '#d4b897');
  cylinder(parent, 0.075, 0.12, 0.18, [0.43, 1.185, 0.07], '#d4b897');
  box(parent, [0.43, 0.23, 0.39], [0.60, 0.245, 0.05], '#b8a17d', 0.024);
  for (let i = 0; i < 4; i++) box(parent, [0.42, 0.012, 0.005], [0.60, 0.17 + i * 0.046, 0.25], '#d4bd94', 0.002);
  book(parent, 0.4, 0.05, 0.28, 0.53, 1.66, 0.06, bookColors[2]);
}
// The third-shelf book, hinged at its bottom front edge so it can tip out.
function tippingBook(parent) {
  box(parent, [0.13, 0.34, 0.31], [0, 0.17, -0.155], bookColors[4], 0.006);
  box(parent, [0.088, 0.013, 0.006], [0, 0.2652, 0.003], C.paper, 0.002);
}
function loungeChair(parent) {
  box(parent, [1.54, 0.32, 1.40], [0, 0.36, -0.03], C.sage, 0.14);
  box(parent, [1.45, 0.94, 0.29], [0, 0.91, -0.53], C.sage, 0.13);
  for (const x of [-0.68, 0.68]) box(parent, [0.27, 0.55, 1.28], [x, 0.70, 0.0], C.sage, 0.11);
  box(parent, [1.02, 0.22, 0.95], [0, 0.61, 0.09], C.sageLight, 0.09);
  for (const x of [-0.56, 0.56]) for (const z of [-0.45, 0.44]) cylinder(parent, 0.045, 0.058, 0.22, [x, 0.11, z], C.darkWood);
  const cushion = box(parent, [0.53, 0.49, 0.18], [0.17, 0.93, -0.28], '#d8b477', 0.085);
  cushion.rotation.z = -0.13; cushion.rotation.x = -0.20;
  box(parent, [0.38, 0.041, 1.1], [-0.39, 0.742, 0.20], C.linen, 0.017);
  box(parent, [0.38, 0.47, 0.045], [-0.39, 0.49, 0.755], C.linen, 0.019);
  for (let i = 0; i < 6; i++) rod(parent, [-0.54 + i * 0.06, 0.26, 0.763], [-0.54 + i * 0.06, 0.20, 0.77], 0.008, C.paper);
}
function sideTable(parent) {
  cylinder(parent, 0.39, 0.39, 0.10, [0, 0.66, 0], C.wood);
  cylinder(parent, 0.06, 0.095, 0.55, [0, 0.315, 0], C.darkWood);
  cylinder(parent, 0.25, 0.27, 0.05, [0, 0.025, 0], C.darkWood);
  book(parent, 0.35, 0.055, 0.27, -0.08, 0.735, -0.05, bookColors[1], 0.15);
  mug(parent, 0.18, 0.71, 0.07, 0.62);
}
function floorLamp(parent) {
  const brass = { metalness: 0.4, roughness: 0.4 };
  cylinder(parent, 0.28, 0.31, 0.055, [0, 0.03, 0], C.brass, brass);
  rod(parent, [0, 0.05, 0], [0, 1.80, 0], 0.026, C.brass, brass);
  cylinder(parent, 0.22, 0.34, 0.45, [0, 1.9, 0], '#e2d2ab');
  cylinder(parent, 0.31, 0.31, 0.012, [0, 1.674, 0], '#f8dfa5', { emissive: '#ffcc77', emissiveIntensity: 0.30 });
  for (let i = 0; i < 20; i++) {
    const angle = i * Math.PI / 10;
    rod(parent, [Math.cos(angle) * 0.337, 1.677, Math.sin(angle) * 0.337], [Math.cos(angle) * 0.218, 2.125, Math.sin(angle) * 0.218], 0.007, '#c9b78f');
  }
  sphere(parent, [0.035, 0.055, 0.035], [0, 2.165, 0], C.brass);
  rod(parent, [0.13, 1.75, 0.02], [0.13, 1.47, 0.02], 0.006, C.brass, brass);
  sphere(parent, [0.02, 0.03, 0.02], [0.13, 1.46, 0.02], C.brass);
}
function plant(parent, canopyOnly = false) {
  if (!canopyOnly) {
    cylinder(parent, 0.23, 0.16, 0.36, [0, 0.18, 0], C.terracotta);
    cylinder(parent, 0.245, 0.245, 0.055, [0, 0.36, 0], C.terracotta);
    cylinder(parent, 0.211, 0.211, 0.013, [0, 0.392, 0], C.darkWood);
  }
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4, h = 0.73 + (i % 3) * 0.16;
    const x = Math.cos(angle) * 0.20, z = Math.sin(angle) * 0.20;
    if (!canopyOnly) rod(parent, [0, 0.39, 0], [x, h, z], 0.012, C.darkLeaf);
    else {
      const leaf = sphere(parent, [0.115, 0.255, 0.035], [x * 1.25, h + 0.07, z * 1.25], i % 2 ? C.leaf : '#95a576');
      leaf.rotation.set(0.34, -angle, -0.50);
      const vein = rod(parent, [x * 1.25, h - 0.06, z * 1.25 + 0.03], [x * 1.25 + 0.08, h + 0.18, z * 1.25 + 0.02], 0.005, '#acb889');
      const sway = { anchorY: h, height: 0.3, phase: i * 0.81 };
      leaf.metadata = { sway }; vein.metadata = { sway };
    }
  }
}
function rug(parent) {
  box(parent, [3.24, 0.03, 2.20], [0, 0.016, 0], '#bca982', 0.08);
  box(parent, [3.08, 0.01, 2.03], [0, 0.035, 0], '#e1d4b3', 0.055);
  box(parent, [2.83, 0.006, 1.77], [0, 0.043, 0], '#c8b28c', 0.04);
  box(parent, [2.70, 0.005, 1.64], [0, 0.049, 0], '#ddcdac', 0.035);
  for (const side of [-1, 1]) for (let i = 0; i < 22; i++) rod(parent, [side * 1.60, 0.022, -0.96 + i * 0.091], [side * 1.74, 0.022, -0.96 + i * 0.091], 0.009, '#d6c49d');
  for (const z of [-0.52, 0.52]) for (let i = 0; i < 5; i++) {
    const diamond = box(parent, [0.083, 0.004, 0.083], [-0.68 + i * 0.34, 0.054, z], '#baa47d', 0.006); diamond.rotation.y = Math.PI / 4;
  }
}
function ottoman(parent) {
  cylinder(parent, 0.44, 0.45, 0.06, [0, 0.03, 0], C.darkWood);
  cylinder(parent, 0.485, 0.505, 0.38, [0, 0.22, 0], '#b3956d');
  cylinder(parent, 0.49, 0.49, 0.11, [0, 0.455, 0], '#c7ad85');
  const seam = torus(parent, 0.489, 0.012, [0, 0.407, 0], '#dfc8a2'); seam.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    rod(parent, [Math.cos(angle) * 0.499, 0.06, Math.sin(angle) * 0.499], [Math.cos(angle) * 0.486, 0.394, Math.sin(angle) * 0.486], 0.004, '#cfb78e');
  }
}
function cabinet(parent) {
  for (const x of [-0.68, 0.68]) for (const z of [-0.22, 0.22]) rod(parent, [x * 1.05, 0.012, z], [x, 0.19, z], 0.038, C.darkWood);
  box(parent, [1.72, 0.64, 0.65], [0, 0.49, 0], C.wood, 0.035);
  box(parent, [1.77, 0.08, 0.68], [0, 0.85, 0], C.edge, 0.03);
  for (const x of [-0.415, 0.415]) {
    box(parent, [0.78, 0.5, 0.04], [x, 0.49, 0.345], '#c29b71', 0.012);
    box(parent, [0.025, 0.16, 0.025], [x + (x < 0 ? 0.25 : -0.25), 0.5, 0.373], C.darkWood, 0.008);
  }
  const player = group(parent, [-0.22, 0.945, -0.01]);
  box(player, [0.90, 0.11, 0.49], [0, 0, 0], '#a07858', 0.03);
  rod(player, [0.28, 0.09, -0.16], [0.2, 0.09, 0.12], 0.013, C.brass);
  rod(player, [0.2, 0.09, 0.12], [0.10, 0.09, 0.14], 0.013, C.brass);
  book(parent, 0.32, 0.06, 0.4, 0.57, 0.92, 0, bookColors[0]);
  book(parent, 0.32, 0.045, 0.4, 0.57, 0.975, 0, bookColors[2]);
}

const candleGlow = { emissive: '#ffbd61', emissiveIntensity: 0.72 };
function candle(parent, position, height = 0.28, radius = 0.065) {
  const holder = group(parent, position);
  cylinder(holder, radius * 1.45, radius * 1.6, 0.035, [0, 0.018, 0], '#b69760');
  cylinder(holder, radius, radius, height, [0, height / 2 + 0.04, 0], '#ead6aa');
  rod(holder, [0, height + 0.045, 0], [0, height + 0.078, 0], 0.007, '#594c37');
  const flame = cylinder(holder, 0.008, radius * 0.65, 0.145, [0, height + 0.12, 0], '#ffd186', candleGlow);
  flame.rotation.z = -0.14;
}
function fireplace(parent) {
  const stone = '#aa957d', paleStone = '#bca98c', walnut = '#6b4b3b';
  box(parent, [2.64, 0.16, 1.10], [0, 0.08, 0], '#796555', 0.04);
  box(parent, [2.34, 1.85, 0.13], [0, 1.07, -0.405], '#756153', 0.025);
  box(parent, [1.75, 1.41, 0.033], [0, 0.87, -0.321], '#342e2c', 0.01);
  for (const x of [-1, 1]) {
    for (let level = 0; level < 4; level++) box(parent, [0.35, 0.26, 0.69], [x * 0.99, 0.3 + level * 0.28, -0.025], level % 2 ? paleStone : stone, 0.014);
    box(parent, [0.44, 0.115, 0.77], [x * 0.99, 0.215, -0.025], paleStone, 0.016);
  }
  for (let i = 0; i < 11; i++) {
    const angle = i / 10 * Math.PI;
    const brick = box(parent, [0.315, 0.26, 0.70], [Math.cos(angle) * 0.995, 1.09 + Math.sin(angle) * 0.88, -0.025], i % 2 ? paleStone : stone, 0.015);
    brick.rotation.z = angle + Math.PI / 2;
  }
  box(parent, [2.62, 0.14, 0.91], [0, 2.11, -0.025], walnut, 0.025);
  box(parent, [2.7, 0.11, 1.0], [0, 2.23, -0.025], '#8c6547', 0.025);
  box(parent, [2.52, 0.028, 0.025], [0, 2.17, 0.445], '#c5a36d', 0.007);
  for (const x of [-0.99, 0.99]) {
    box(parent, [0.17, 0.21, 0.09], [x, 1.99, 0.4], walnut, 0.012);
    const diamond = box(parent, [0.063, 0.063, 0.012], [x, 2.0, 0.455], '#bd9864', 0.007); diamond.rotation.z = Math.PI / 4;
  }
  for (let i = 0; i < 3; i++) book(parent, 0.54 - i * 0.035, 0.065, 0.35, -0.72, 2.32 + i * 0.068, -0.015, ['#7d8263', '#866574', '#c2a16c'][i], i === 1 ? 0.11 : 0);
  candle(parent, [0.73, 2.288, 0.035], 0.37, 0.074);
  candle(parent, [1.0, 2.288, 0.09], 0.22, 0.056);
  box(parent, [0.61, 0.66, 0.075], [0.03, 2.615, -0.24], '#b89a63', 0.02);
  box(parent, [0.50, 0.54, 0.021], [0.03, 2.615, -0.19], '#4f5d57', 0.008);
  const moon = cylinder(parent, 0.145, 0.145, 0.009, [0.03, 2.65, -0.173], '#dbc494'); moon.rotation.x = Math.PI / 2;
  const moonMask = cylinder(parent, 0.137, 0.137, 0.009, [0.087, 2.685, -0.16], '#4f5d57'); moonMask.rotation.x = Math.PI / 2;
  rod(parent, [-0.58, 0.285, -0.1], [0.53, 0.285, 0.17], 0.09, '#684a37');
  rod(parent, [-0.52, 0.39, 0.18], [0.51, 0.39, -0.1], 0.084, '#77503a');
  for (let i = 0; i < 7; i++) {
    const x = -0.48 + i * 0.155;
    cylinder(parent, 0.045, 0.05, 0.018, [x, 0.2, 0.23], '#e5924f', candleGlow);
  }
  for (const x of [-0.60, -0.30, 0, 0.30, 0.60]) rod(parent, [x, 0.16, 0.395], [x, 0.46, 0.395], 0.019, '#514937');
  rod(parent, [-0.66, 0.37, 0.395], [0.66, 0.37, 0.395], 0.022, '#514937');
}
function daybed(parent) {
  const velvet = '#785965', lightVelvet = '#91707c', walnut = '#654939';
  for (const x of [-1.26, 1.26]) for (const z of [-0.50, 0.50]) {
    cylinder(parent, 0.052, 0.068, 0.23, [x, 0.115, z], walnut);
    cylinder(parent, 0.075, 0.075, 0.044, [x, 0.057, z], '#b18f59');
  }
  box(parent, [2.99, 0.29, 1.4], [0, 0.37, -0.035], velvet, 0.04);
  box(parent, [2.99, 0.80, 0.23], [0, 0.94, -0.64], velvet, 0.045);
  for (const x of [-1.40, 1.40]) {
    box(parent, [0.28, 0.64, 1.42], [x, 0.70, -0.005], velvet, 0.05);
    box(parent, [0.23, 0.04, 1.31], [x, 1.035, -0.005], lightVelvet, 0.017);
  }
  for (const x of [-0.85, 0, 0.85]) {
    box(parent, [0.81, 0.24, 1.04], [x, 0.615, 0.045], lightVelvet, 0.048);
    box(parent, [0.78, 0.015, 0.023], [x, 0.613, 0.576], '#ad8690', 0.006);
  }
  for (const [x, color, angle] of [[-0.88, '#708374', 0.17], [-0.16, '#baa170', -0.10], [0.80, '#78886b', -0.16]]) {
    const pillow = group(parent, [x, 1.0, -0.34]); pillow.rotation.z = angle; pillow.rotation.x = -0.15;
    box(pillow, [0.59, 0.55, 0.22], [0, 0, 0], color, 0.05);
    box(pillow, [0.025, 0.42, 0.012], [0, 0, 0.117], '#d0bc90', 0.004);
    box(pillow, [0.42, 0.025, 0.012], [0, 0, 0.117], '#d0bc90', 0.004);
    sphere(pillow, [0.035, 0.035, 0.018], [0, 0, 0.132], '#dfc99f');
  }
  box(parent, [0.51, 0.035, 1.17], [0.64, 0.756, 0.17], '#bfa471', 0.01);
  box(parent, [0.51, 0.42, 0.045], [0.64, 0.53, 0.772], '#bfa471', 0.012);
  for (let i = 0; i < 7; i++) {
    rod(parent, [0.42 + i * 0.073, 0.31, 0.782], [0.42 + i * 0.073, 0.25, 0.805], 0.008, '#dfcba3');
    box(parent, [0.016, 0.008, 1.10], [0.42 + i * 0.073, 0.779, 0.16], '#ddc89b', 0.003);
  }
}
function leafBlade(parent, start, end, width, color) {
  const direction = new Vector3(...end).subtract(new Vector3(...start));
  const length = direction.length();
  const positions = [0, -0.5, 0, -0.5, -0.13, 0, 0, 0.04, 0.13, 0.5, -0.13, 0, 0, 0.5, 0, 0, 0.04, -0.03];
  const indices = [0, 2, 1, 0, 3, 2, 1, 2, 4, 2, 3, 4, 0, 1, 5, 0, 5, 3, 1, 4, 5, 5, 4, 3];
  const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = [];
  VertexData.ComputeNormals(positions, indices, data.normals);
  const blade = new Mesh('folded-moonleaf', parent.getScene()); data.applyToMesh(blade);
  mesh(parent, blade, color, new Vector3(...start).add(new Vector3(...end)).scale(0.5).asArray());
  blade.scaling.set(width, length, width * 0.55);
  blade.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), new Quaternion());
  return blade;
}
function moonTree(parent, canopyOnly = false) {
  const brass = { metalness: 0.4, roughness: 0.4 };
  if (!canopyOnly) {
    cylinder(parent, 0.35, 0.27, 0.62, [0, 0.31, 0], '#967a50', brass);
    cylinder(parent, 0.366, 0.366, 0.052, [0, 0.62, 0], '#c2a16a', brass);
    cylinder(parent, 0.327, 0.327, 0.02, [0, 0.65, 0], '#4d4938');
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      rod(parent, [Math.cos(angle) * 0.274, 0.08, Math.sin(angle) * 0.274], [Math.cos(angle) * 0.352, 0.59, Math.sin(angle) * 0.352], 0.009, '#b89a63');
    }
    const trunk = [[0, 0.65, 0], [-0.08, 1.2, 0.02], [0.11, 1.85, -0.04], [-0.02, 2.46, 0.02], [0.11, 2.93, -0.06]];
    for (let i = 0; i < trunk.length - 1; i++) rod(parent, trunk[i], trunk[i + 1], 0.06 - i * 0.011, '#775d43');
  }
  for (let tier = 0; tier < 4; tier++) {
    for (let branch = 0; branch < 3; branch++) {
      const angle = tier * 1.2 + branch * Math.PI * 2 / 3;
      const height = 1.34 + tier * 0.43, reach = tier === 3 ? 0.39 : 0.55;
      const end = [Math.cos(angle) * reach, height + 0.24, Math.sin(angle) * reach];
      if (!canopyOnly) rod(parent, [0, height - 0.05, 0], end, 0.020, '#816746');
      else for (let leaf = 0; leaf < 3; leaf++) {
        const leafAngle = angle + (leaf - 1) * 0.74;
        const origin = [end[0] * (0.58 + leaf * 0.14), end[1] - 0.1 + leaf * 0.045, end[2] * (0.58 + leaf * 0.14)];
        const tip = [origin[0] + Math.cos(leafAngle) * 0.25, origin[1] + 0.29 + (leaf % 2) * 0.09, origin[2] + Math.sin(leafAngle) * 0.25];
        const blade = leafBlade(parent, origin, tip, 0.27, ['#6f876b', '#8fa075', '#587565'][(tier + leaf) % 3]);
        blade.metadata = { sway: { anchorY: origin[1], height: tip[1] - origin[1], phase: tier * 0.7 + branch * 1.3 + leaf * 0.4 } };
      }
    }
  }
  if (!canopyOnly) for (const [x, y, z] of [[-0.48, 1.82, 0.2], [0.42, 2.23, 0.27], [-0.15, 2.87, -0.23]]) {
    rod(parent, [x, y, z], [x, y - 0.19, z], 0.005, '#bca36f');
    const charm = box(parent, [0.075, 0.075, 0.023], [x, y - 0.23, z], '#d5bb78', 0.003); charm.rotation.z = Math.PI / 4;
    box(parent, [0.026, 0.14, 0.020], [x, y - 0.23, z], '#d5bb78', 0.003);
  }
}
function lanternCluster(parent) {
  const brass = { metalness: 0.4, roughness: 0.4 };
  for (const [x, z, height, radius] of [[-0.28, 0.03, 0.78, 0.175], [0.23, 0.26, 0.46, 0.15], [0.23, -0.28, 0.61, 0.155]]) {
    const lantern = group(parent, [x, 0, z]);
    cylinder(lantern, radius, radius * 1.04, 0.052, [0, 0.026, 0], '#ab8c52', brass);
    cylinder(lantern, radius, radius, 0.038, [0, height, 0], '#c3a568', brass);
    for (const px of [-1, 1]) for (const pz of [-1, 1]) rod(lantern, [px * radius * 0.62, 0.05, pz * radius * 0.62], [px * radius * 0.62, height, pz * radius * 0.62], 0.012, '#c0a16a', brass);
    cylinder(lantern, radius * 0.28, radius * 1.08, 0.115, [0, height + 0.074, 0], '#927448', brass);
    torus(lantern, radius * 0.37, 0.01, [0, height + 0.175, 0], '#c3a568');
    candle(lantern, [0, 0.055, 0], height * 0.44, radius * 0.31);
    for (const side of [-1, 1]) rod(lantern, [side * radius * 0.62, 0.075, radius * 0.63], [-side * radius * 0.62, height - 0.06, radius * 0.63], 0.006, '#b39157');
  }
}
function moonRug(parent) {
  const disk = (radius, y, color, height = 0.009) => mesh(parent, CreateCylinder('woven-circle', { diameter: radius * 2, height, tessellation: 48 }, parent.getScene()), color, [0, y, 0]);
  disk(1.67, 0.025, '#9c835f', 0.04);
  disk(1.59, 0.049, '#c5aa7c', 0.009);
  disk(1.48, 0.056, '#676777', 0.009);
  disk(1.36, 0.063, '#555a6d', 0.009);
  // Different heights let the crescent and stars layer without flickering.
  cylinder(parent, 0.47, 0.47, 0.006, [-0.09, 0.072, -0.10], '#d7c397');
  cylinder(parent, 0.42, 0.42, 0.006, [0.09, 0.077, -0.16], '#555a6d');
  for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI / 24;
    rod(parent, [Math.cos(angle) * 1.65, 0.025, Math.sin(angle) * 1.65], [Math.cos(angle) * 1.785, 0.025, Math.sin(angle) * 1.785], 0.009, '#d0bb91');
  }
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8;
    const diamond = box(parent, [0.07, 0.006, 0.07], [Math.cos(angle) * 1.425, 0.064, Math.sin(angle) * 1.425], '#d2b987', 0.002); diamond.rotation.y = angle + Math.PI / 4;
  }
  for (const [x, z, size] of [[-0.71, 0.31, 0.12], [0.72, -0.21, 0.1], [0.37, 0.68, 0.13], [-0.35, -0.78, 0.075], [0.67, -0.76, 0.06]]) {
    const star = box(parent, [size, 0.005, size], [x, 0.074, z], '#d9c495', 0.002); star.rotation.y = Math.PI / 4;
    box(parent, [size * 0.2, 0.005, size * 1.9], [x, 0.077, z], '#d9c495', 0.001);
    box(parent, [size * 1.9, 0.005, size * 0.2], [x, 0.077, z], '#d9c495', 0.001);
  }
}

// A little aquarium on an oak stand. The water is see-through and casts no
// shadow; the fish and bubbles are instances of one small mesh each, moved in
// the room's animation loop (see createAquariumLife). The lid lamp switches.
function fishTank(parent) {
  const scene = parent.getScene();
  box(parent, [1.6, 0.66, 0.66], [0, 0.37, 0], C.wood, 0.03);
  box(parent, [1.66, 0.06, 0.72], [0, 0.73, 0], C.edge, 0.02);
  for (const x of [-0.39, 0.39]) {
    box(parent, [0.74, 0.5, 0.03], [x, 0.37, 0.345], '#c29b71', 0.01);
    sphere(parent, [0.022, 0.022, 0.018], [x + (x < 0 ? 0.3 : -0.3), 0.4, 0.37], C.brass);
  }
  for (const x of [-0.72, 0.72]) for (const z of [-0.26, 0.26]) cylinder(parent, 0.035, 0.03, 0.04, [x, 0.02, z], C.darkWood);
  // Sand, pebbles, a stone arch and sea grass.
  box(parent, [1.5, 0.05, 0.58], [0, 0.785, 0], C.darkWood, 0.012);
  box(parent, [1.42, 0.07, 0.5], [0, 0.845, 0], '#dccb9f', 0.012);
  for (const [x, z, size, color] of [[-0.5, 0.12, 0.05, '#9c958a'], [-0.38, -0.1, 0.04, '#b9876a'], [0.18, 0.15, 0.045, '#8f8a82'], [0.46, -0.08, 0.055, '#a7a092'], [0.58, 0.14, 0.035, '#c39a76'], [-0.12, 0.02, 0.03, '#9c958a']]) sphere(parent, [size * 1.3, size * 0.7, size], [x, 0.885, z], color);
  sphere(parent, [0.12, 0.1, 0.09], [0.28, 0.93, -0.12], '#8e8a80'); sphere(parent, [0.09, 0.14, 0.08], [0.4, 0.95, -0.14], '#9a958a');
  for (const [x, z, h, lean, color] of [[-0.58, -0.14, 0.42, 0.12, '#6f8d58'], [-0.5, -0.17, 0.3, -0.18, '#809a62'], [-0.26, -0.18, 0.36, 0.08, '#5f7d4f'], [0.06, -0.16, 0.26, -0.1, '#809a62'], [0.62, -0.1, 0.38, -0.14, '#6f8d58']]) {
    const blade = sphere(parent, [0.028, h / 2, 0.01], [x, 0.88 + h / 2, z], color); blade.rotation.z = lean;
  }
  // The water, and the glass edges and lid around it.
  box(parent, [1.42, 0.6, 0.5], [0, 1.18, 0], '#a7d3cc', 0.006).material = material(scene, '#a7d3cc', { alpha: 0.36 });
  for (const x of [-0.725, 0.725]) for (const z of [-0.265, 0.265]) box(parent, [0.03, 0.66, 0.03], [x, 1.14, z], C.darkWood, 0.008);
  for (const z of [-0.265, 0.265]) box(parent, [1.48, 0.035, 0.035], [0, 1.49, z], C.darkWood, 0.008);
  for (const x of [-0.725, 0.725]) box(parent, [0.035, 0.035, 0.56], [x, 1.49, 0], C.darkWood, 0.008);
  box(parent, [1.54, 0.07, 0.62], [0, 1.545, 0], '#73533d', 0.02);
  box(parent, [1.3, 0.02, 0.06], [0, 1.502, 0.18], '#fff1c9', 0.006).material = material(scene, '#fff1c9', { emissive: '#ffe7ad', emissiveIntensity: 0.8 });
}

// A turned floor globe. The stand and meridian are still; the globe is its
// own mesh, painted with low continents, and spins on a tap.
function globeStand(parent) {
  cylinder(parent, 0.26, 0.3, 0.06, [0, 0.03, 0], C.darkWood);
  cylinder(parent, 0.05, 0.08, 0.1, [0, 0.11, 0], C.darkWood);
  rod(parent, [0, 0.16, 0], [0, 0.66, 0], 0.035, C.wood);
  sphere(parent, [0.06, 0.05, 0.06], [0, 0.7, 0], C.darkWood);
  const axis = group(parent, [0, 1.07, 0]); axis.rotation.z = GLOBE_TILT;
  torus(axis, 0.335, 0.014, [0, 0, 0], C.brass);
  for (const y of [-0.345, 0.345]) sphere(axis, [0.02, 0.02, 0.02], [0, y, 0], C.brass);
}
const GLOBE_TILT = 0.41;

// A painter's easel: an A-frame of oak legs, a ledge and a canvas that shows
// the chosen picture (see createFurniture), a jar of brushes on the ledge. The
// canvas stands well in front of the legs, clear of their outlines.
function easel(parent) {
  for (const side of [-1, 1]) rod(parent, [side * 0.34, 0.012, 0.22], [side * 0.09, 2.08, -0.02], 0.026, C.wood);
  rod(parent, [0, 0.012, -0.44], [0, 1.98, -0.06], 0.024, C.wood);
  rod(parent, [-0.27, 0.8, 0.16], [0.27, 0.8, 0.16], 0.018, C.darkWood);
  const canvas = group(parent, EASEL_CANVAS.position); canvas.rotation.x = EASEL_CANVAS.tilt;
  const scene = parent.getScene(), paint = (part, color) => { part.material = material(scene, color, { part: 'canvas' }); return part; };
  paint(box(canvas, [0.9, 1.14, 0.04], [0, 0, 0], '#f1e6cf', 0.01), '#f1e6cf');
  paint(box(canvas, [0.96, 0.05, 0.14], [0, -0.6, 0.05], C.darkWood, 0.01), C.darkWood);
  paint(box(canvas, [0.14, 0.07, 0.07], [0, 0.6, 0.01], C.darkWood, 0.01), C.darkWood);
  paint(cylinder(canvas, 0.045, 0.04, 0.1, [0.32, -0.525, 0.07], '#b6c0b0'), '#b6c0b0');
  for (const [dx, dz, color] of [[-0.012, 0, '#c77868'], [0.014, 0.01, '#d7b572'], [0, -0.012, '#6f8aa6']]) { paint(rod(canvas, [0.32 + dx, -0.5, 0.07 + dz], [0.32 + dx * 3, -0.33, 0.07 + dz * 3], 0.006, C.darkWood), C.darkWood); paint(sphere(canvas, [0.011, 0.02, 0.011], [0.32 + dx * 3, -0.32, 0.07 + dz * 3], color), color); }
}
const EASEL_CANVAS = { position: [0, 1.46, 0.14], tilt: -0.17 };

// A deep bean bag with a soft seat and a raised back.
function beanBag(parent) {
  sphere(parent, [0.62, 0.34, 0.58], [0, 0.34, 0], '#c9a27e');
  sphere(parent, [0.44, 0.13, 0.4], [0.02, 0.6, 0.06], '#b58f6c');
  sphere(parent, [0.5, 0.3, 0.24], [0, 0.62, -0.3], '#d3ae8a');
  torus(parent, 0.585, 0.012, [0, 0.36, 0], '#b58f6c').rotation.x = Math.PI / 2;
}

// A Swiss cheese plant in a cream pot: stems stay planted, the split leaves
// sway like the other plants' canopies.
function monstera(parent, canopyOnly = false) {
  const leaves = [[0.1, 1.72, 0.05, 0.2, '#5f7d4f'], [2.2, 1.48, 0.1, -0.35, '#6f8d58'], [4.1, 1.62, 0.06, 0.3, '#5f7d4f'], [1.2, 1.2, 0.08, -0.2, '#6f8d58'], [3.2, 1.3, 0.1, 0.25, '#809a62'], [5.2, 1.05, 0.05, -0.3, '#6f8d58']];
  if (!canopyOnly) {
    cylinder(parent, 0.3, 0.23, 0.5, [0, 0.25, 0], '#ded4c1');
    cylinder(parent, 0.315, 0.315, 0.05, [0, 0.5, 0], '#ded4c1');
    cylinder(parent, 0.28, 0.28, 0.012, [0, 0.528, 0], C.darkWood);
    for (const [angle, h] of leaves) rod(parent, [0, 0.53, 0], [Math.cos(angle) * 0.28, h - 0.1, Math.sin(angle) * 0.28], 0.014, C.darkLeaf);
    return;
  }
  for (const [angle, h, tilt, turn, color] of leaves) {
    const x = Math.cos(angle) * 0.4, z = Math.sin(angle) * 0.4, sway = { anchorY: h - 0.1, height: 0.42, phase: angle };
    // A split leaf: a broad blade and two side lobes with a gap between them.
    for (const [dx, dy, sx, sy] of [[0, 0.06, 0.2, 0.22], [-0.2, -0.02, 0.1, 0.16], [0.2, -0.02, 0.1, 0.16]]) {
      const lobe = sphere(parent, [sx, sy, 0.02], [x + dx * Math.cos(-angle), h + dy, z + dx * Math.sin(-angle)], color);
      lobe.rotation.set(0.9 + tilt, -angle + Math.PI / 2, turn); lobe.metadata = { sway };
    }
  }
}

// A brass tea cart: two oak trays on wheels, a teapot and cups on top, books
// and a basket below. A tap puffs steam from the teapot.
function teaCart(parent) {
  for (const x of [-0.5, 0.5]) for (const z of [-0.26, 0.26]) {
    rod(parent, [x, 0.1, z], [x, 0.92, z], 0.018, C.brass, { metalness: 0.4 });
    cylinder(parent, 0.065, 0.065, 0.03, [x, 0.07, z], C.dark, { segments: 16 }).rotation.z = Math.PI / 2;
  }
  for (const y of [0.3, 0.78]) {
    box(parent, [1.08, 0.03, 0.6], [0, y, 0], C.wood, 0.01);
    for (const z of [-0.29, 0.29]) box(parent, [1.08, 0.05, 0.02], [0, y + 0.035, z], C.edge, 0.008);
  }
  rod(parent, [0.5, 0.98, -0.26], [0.5, 0.98, 0.26], 0.02, C.brass, { metalness: 0.4 });
  // The teapot, cups and a plate of biscuits.
  sphere(parent, [0.13, 0.11, 0.13], [-0.22, 0.91, 0], C.cream);
  rod(parent, [-0.13, 0.9, 0], [-0.05, 0.98, 0], 0.018, C.cream);
  sphere(parent, [0.05, 0.025, 0.05], [-0.22, 1.02, 0], C.cream);
  const handle = torus(parent, 0.05, 0.012, [-0.35, 0.92, 0], C.cream); handle.rotation.y = Math.PI / 2;
  mug(parent, 0.12, 0.8, 0.12, 0.6); mug(parent, 0.26, 0.8, -0.1, 0.6);
  cylinder(parent, 0.11, 0.11, 0.012, [0.3, 0.8, 0.14], C.paper);
  for (let i = 0; i < 3; i++) cylinder(parent, 0.028, 0.028, 0.014, [0.27 + i * 0.03, 0.815, 0.12 + (i % 2) * 0.04], '#d7b572');
  book(parent, 0.3, 0.05, 0.22, -0.2, 0.34, 0, bookColors[1], 0.1); book(parent, 0.28, 0.045, 0.2, -0.2, 0.39, 0, bookColors[3], -0.05);
  box(parent, [0.34, 0.16, 0.3], [0.24, 0.395, 0], '#b8a17d', 0.03);
}
// Where the tea cart's steam starts: the teapot spout.
const TEA_CART_SPOUT = [-0.05, 1.0, 0];

// Wall pieces. Each is modeled around the center of its rectangle on the wall,
// with its back on the wall face (z = 0) and z pointing into the room. The
// retreat's frames, clock and potion shelf and the themed rooms' scroll, cloud
// shelves, rainbow, neon sign and records keep their original shapes.
function tube(parent, points, radius, color, extra) {
  return mesh(parent, CreateTube('soft-curve', { path: points.map(point => new Vector3(...point)), radius, tessellation: 6, cap: Mesh.CAP_ALL }, parent.getScene()), color, [0, 0, 0], extra);
}
const pictureSizes = { 'tall-frame': [0.88, 1.23], 'small-frame': [0.60, 0.86], 'wide-frame': [1.32, 0.86], easel: [0.87, 1.11] };
// Each view covers its opening (the frame less OPENING_INSET) with a margin.
const viewSizes = { 'cottage-window': [1.42, 1.62], 'arched-window': [1.02, 2.22], 'round-window': [1.12, 1.12] };
// Behind the thickest wall and its brick facing.
export const WINDOW_VIEW_DEPTH = -0.27;
function frame(parent, size, color) { box(parent, [...size, 0.08], [0, 0, 0.09], color, 0.025); }
function moonClockCase(parent) {
  const brass = { metalness: 0.45 };
  const rim = cylinder(parent, 0.43, 0.43, 0.08, [0, 0.39, 0.04], C.brass, { ...brass, segments: 32 }); rim.rotation.x = Math.PI / 2;
  const face = cylinder(parent, 0.37, 0.37, 0.015, [0, 0.39, 0.09], '#e5d4ac', { segments: 32 }); face.rotation.x = Math.PI / 2;
  box(parent, [0.31, 0.87, 0.065], [0, -0.38, 0.04], '#503d30', 0.035);
  for (let i = 0; i < 12; i++) { const angle = i / 12 * Math.PI * 2; sphere(parent, [0.018, 0.018, 0.008], [Math.cos(angle) * 0.31, 0.39 + Math.sin(angle) * 0.31, 0.107], '#503d30'); }
}
function apothecaryShelf(parent) {
  box(parent, [1.4, 0.11, 0.60], [0, -0.2975, 0.31], '#926747', 0.025);
  const colors = ['#768d77', '#b09572', '#95839d', '#b9795e'];
  for (let i = 0; i < 4; i++) {
    const x = 0.465 - i * 0.31, h = 0.24 + (i % 3) * 0.09, base = -0.1875;
    cylinder(parent, 0.075, 0.11, h, [x, base + h / 2, 0.41], colors[i]); cylinder(parent, 0.04, 0.06, 0.10, [x, base + 0.02 + h, 0.41], colors[i]);
    cylinder(parent, 0.045, 0.045, 0.06, [x, base + 0.09 + h, 0.41], '#ac8357');
  }
}
function wallShelf(parent) {
  const y = 0.18; // Centers the shelf, books and trailing leaves on the wall rectangle.
  box(parent, [1.6, 0.08, 0.40], [0, y - 0.32, 0.21], C.wood, 0.02);
  for (const x of [-0.62, 0.62]) box(parent, [0.05, 0.16, 0.30], [x, y - 0.40, 0.16], C.darkWood, 0.012);
  for (let i = 0; i < 5; i++) { const h = 0.30 + (i * 7 % 5) * 0.025; box(parent, [0.085, h, 0.26], [-0.66 + i * 0.095, y - 0.28 + h / 2, 0.19], bookColors[i], 0.006); }
  const leaning = box(parent, [0.085, 0.34, 0.26], [-0.13, y - 0.12, 0.19], bookColors[5], 0.006); leaning.rotation.z = -0.32;
  cylinder(parent, 0.06, 0.065, 0.18, [0.12, y - 0.19, 0.2], '#ead6aa'); cylinder(parent, 0.008, 0.035, 0.07, [0.12, y - 0.055, 0.2], '#ffd186', candleGlow);
  cylinder(parent, 0.13, 0.10, 0.17, [0.52, y - 0.195, 0.2], C.terracotta);
  for (let i = 0; i < 9; i++) { const t = i / 8; sphere(parent, [0.07, 0.035, 0.05], [0.5 + Math.sin(i * 1.9) * 0.14, y - 0.13 - t * 0.2 + (i % 2) * 0.05, 0.25 + Math.cos(i * 1.3) * 0.08], i % 2 ? C.leaf : '#95a576').rotation.set(0.4, i, i % 2 ? 0.5 : -0.5); }
  for (let i = 0; i < 6; i++) sphere(parent, [0.055, 0.03, 0.045], [0.64 - i * 0.012, y - 0.34 - i * 0.012, 0.36 - i * 0.004], i % 2 ? C.leaf : C.darkLeaf).rotation.set(0.9, i * 0.7, 0.3);
}
function hangingPlant(parent) {
  const brass = { metalness: 0.4 };
  box(parent, [0.16, 0.22, 0.04], [0, 0.52, 0.02], C.brass, 0.012);
  rod(parent, [0, 0.55, 0.03], [0, 0.55, 0.25], 0.014, C.brass, brass);
  for (const angle of [0, 2.1, 4.2]) rod(parent, [0, 0.55, 0.25], [Math.cos(angle) * 0.16, 0.26, 0.25 + Math.sin(angle) * 0.16], 0.006, '#c9b78f');
  cylinder(parent, 0.18, 0.13, 0.22, [0, 0.16, 0.25], C.terracotta); cylinder(parent, 0.19, 0.19, 0.035, [0, 0.27, 0.25], C.terracotta);
  for (let strand = 0; strand < 5; strand++) {
    const angle = strand * 1.26, x0 = Math.cos(angle) * 0.14, z0 = 0.25 + Math.sin(angle) * 0.12;
    for (let i = 0; i < 7; i++) { const t = i / 6; sphere(parent, [0.075, 0.04, 0.055], [x0 + Math.sin(t * 3 + strand) * 0.05, 0.26 - t * (0.62 + strand % 2 * 0.2), z0], (strand + i) % 2 ? C.leaf : '#95a576').rotation.set(0.5, angle + i, (i % 2 ? 0.6 : -0.6)); }
  }
}
function wallScroll(parent) {
  box(parent, [1.28, 2.25, 0.045], [0, -0.005, 0.05], '#faf0da', 0);
  for (const y of [-1.165, 1.165]) rod(parent, [-0.75, y, 0.13], [0.75, y, 0.13], 0.038, '#795e46');
  tube(parent, [[-0.32, -0.975, 0.12], [0.12, -0.225, 0.12], [-0.05, 0.225, 0.12], [0.39, 0.855, 0.12]], 0.023, '#64594e');
  for (let i = 0; i < 9; i++) {
    const x = -0.32 + (i % 3) * 0.25, y = -0.225 + Math.floor(i / 3) * 0.29;
    for (let p = 0; p < 5; p++) sphere(parent, [0.05, 0.06, 0.012], [x + Math.cos(p * 1.257) * 0.065, y + Math.sin(p * 1.257) * 0.065, 0.17], i % 2 ? '#d3979c' : '#e8b3b0');
  }
}
function cloudShelf(parent, width) {
  box(parent, [width, 0.10, 0.48], [0, -0.115, 0.32], '#f5e6d9', 0.04);
  for (let i = 0; i < 5; i++) sphere(parent, [width / 6, 0.20 + (i % 2) * 0.11, 0.09], [-width * 0.37 + i * width * 0.185, -0.065, 0.14], '#f5e6d9');
  for (let i = 0; i < 4; i++) box(parent, [0.12, 0.34 + (i % 2) * 0.08, 0.25], [-0.55 + i * 0.14, 0.125, 0.44], ['#c8a8bd', '#abc8ba', '#e5bb87', '#a4b3ce'][i], 0);
  sphere(parent, [0.13, 0.23, 0.13], [0.48, 0.145, 0.41], '#ce9cba');
}
function feltRainbow(parent) {
  for (let band = 0; band < 3; band++) {
    const radius = 1.1 - band * 0.2;
    tube(parent, Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI; return [-Math.cos(a) * radius, -0.55 + Math.sin(a) * radius, 0.07]; }), 0.07, ['#eabfa1', '#f5d6bf', '#b79bc6'][band]);
  }
}
// The sign's glow follows the time of day like the rooms' accent lights.
const neonGlow = hex => ({ emissive: hex, emissiveIntensity: 0.9, accent: true });
function neonOrbit(parent) {
  box(parent, [1.66, 2.4, 0.065], [0, 0, 0.05], '#282d43', 0.04);
  tube(parent, Array.from({ length: 49 }, (_, i) => [Math.cos(i / 48 * Math.PI * 2) * 0.57, 0.14 + Math.sin(i / 48 * Math.PI * 2) * 0.57, 0.17]), 0.023, '#a997ff', neonGlow('#a997ff'));
  rod(parent, [-0.63, -0.24, 0.2], [0.65, 0.52, 0.2], 0.027, '#ef8bab', neonGlow('#ef8bab'));
  for (let i = 0; i < 3; i++) box(parent, [0.30, 0.042, 0.025], [-0.44 + i * 0.44, -0.85, 0.16], '#c6b5d8', 0);
}
// Windows: a timber frame around a real opening in the wall. The frame, bars
// and corner fillets cast shadows, so the daylight they let in has their shape.
function cottageWindow(parent) {
  for (const y of [0.8, -0.8]) box(parent, [1.5, 0.1, 0.1], [0, y, 0.05], C.wood, 0.012);
  for (const x of [0.7, -0.7]) box(parent, [0.1, 1.5, 0.1], [x, 0, 0.05], C.wood, 0.012);
  box(parent, [0.05, 1.5, 0.06], [0, 0, 0.03], C.edge, 0.006); box(parent, [1.3, 0.05, 0.06], [0, 0.06, 0.03], C.edge, 0.006);
  box(parent, [1.5, 0.07, 0.2], [0, -0.815, 0.1], C.darkWood, 0.012);
  cylinder(parent, 0.07, 0.055, 0.1, [0.44, -0.73, 0.1], C.terracotta);
  for (let i = 0; i < 5; i++) sphere(parent, [0.055, 0.03, 0.04], [0.44 + Math.cos(i * 1.26) * 0.05, -0.64 + (i % 2) * 0.03, 0.1 + Math.sin(i * 1.26) * 0.04], i % 2 ? C.leaf : C.darkLeaf).rotation.set(0.4, i * 1.3, i % 2 ? 0.5 : -0.5);
}
function archedWindow(parent) {
  const spring = 0.6, radius = 0.5;
  for (const x of [0.5, -0.5]) box(parent, [0.1, 1.75 + spring - 0.6, 0.1], [x, (spring - 1.15) / 2, 0.05], C.wood, 0.012);
  box(parent, [1.1, 0.1, 0.1], [0, -1.1, 0.05], C.wood, 0.012);
  tube(parent, Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI; return [Math.cos(a) * radius, spring + Math.sin(a) * radius, 0.05]; }), 0.05, C.wood);
  // Corner fillets fill the frame above the arch, so the opening reads round.
  for (let i = 0; i < 12; i++) {
    const x = -0.55 + (i + 0.5) * 1.1 / 12, bottom = Math.abs(x) >= radius ? spring : spring + Math.sqrt(radius ** 2 - x ** 2);
    box(parent, [1.1 / 12 + 0.004, 1.15 - bottom, 0.04], [x, (1.15 + bottom) / 2, 0.02], C.wood, 0);
  }
  box(parent, [0.04, 1.7 + radius, 0.05], [0, (spring + radius - 1.1) / 2 - 0.05, 0.025], C.edge, 0.005);
  for (const y of [-0.45, 0.15]) box(parent, [0.92, 0.04, 0.05], [0, y, 0.025], C.edge, 0.005);
  box(parent, [1.1, 0.07, 0.2], [0, -1.115, 0.1], C.darkWood, 0.012);
}
function roundWindow(parent) {
  const radius = 0.46;
  // A square timber panel with a round opening, built from narrow strips.
  for (let i = 0; i < 16; i++) {
    const x = -0.6 + (i + 0.5) * 1.2 / 16, dx = Math.abs(x) + 1.2 / 32;
    if (dx >= radius) { box(parent, [1.2 / 16 + 0.004, 1.2, 0.05], [x, 0, 0.025], C.edge, 0); continue; }
    const dy = Math.sqrt(radius ** 2 - dx ** 2);
    for (const side of [1, -1]) box(parent, [1.2 / 16 + 0.004, 0.6 - dy, 0.05], [x, side * (0.6 + dy) / 2, 0.025], C.edge, 0);
  }
  tube(parent, Array.from({ length: 33 }, (_, i) => { const a = i / 32 * Math.PI * 2; return [Math.cos(a) * radius, Math.sin(a) * radius, 0.07]; }), 0.05, C.wood);
  box(parent, [0.9, 0.035, 0.04], [0, 0, 0.04], C.wood, 0.004); box(parent, [0.035, 0.9, 0.04], [0, 0, 0.04], C.wood, 0.004);
}
function recordSleeve(parent) {
  box(parent, [1.22, 1.22, 0.075], [0, 0, 0.0875], '#303447', 0);
  tube(parent, Array.from({ length: 33 }, (_, i) => [Math.cos(i / 32 * Math.PI * 2) * 0.34, Math.sin(i / 32 * Math.PI * 2) * 0.34, 0.1775]), 0.06, '#343c52');
}

function createSwayingCanopy(parent, type) {
  const scene = parent.getScene(), templates = cacheFor(scene).templates, key = `${type}-canopy`;
  if (!templates.has(key)) {
    const source = new TransformNode('leaf-source', scene);
    if (type === 'plant') plant(source, true); else if (type === 'monstera') monstera(source, true); else moonTree(source, true);
    const ranges = []; let vertexOffset = 0;
    for (const leaf of source.getChildMeshes()) {
      ranges.push({ start: vertexOffset, end: vertexOffset + leaf.getTotalVertices(), ...leaf.metadata.sway });
      vertexOffset += leaf.getTotalVertices();
    }
    const template = batch(source); template.metadata = { ranges }; template.setEnabled(false); templates.set(key, template);
  }
  const template = templates.get(key);
  const canopy = template.getChildMeshes()[0].clone('swaying-leaf-canopy', parent);
  canopy.makeGeometryUnique(); canopy.markVerticesDataAsUpdatable('position', true);
  canopy.metadata = { dynamic: true, effect: 'leaf-sway' }; canopy.isPickable = false;
  const neutral = new Float32Array(canopy.getVerticesData('position')), positions = new Float32Array(neutral);
  const [width, depth] = getFurniture(type).footprint;
  const limitX = width / 2 - 0.002, limitZ = depth / 2 - 0.002;
  const originalBounds = canopy.getBoundingInfo().boundingBox;
  canopy.setBoundingInfo(new BoundingInfo(new Vector3(-width / 2, originalBounds.minimum.y - 0.02, -depth / 2), new Vector3(width / 2, originalBounds.maximum.y + 0.02, depth / 2)));
  const amplitude = type === 'plant' ? 0.075 : type === 'monstera' ? 0.06 : 0.11, phaseOffset = parent.uniqueId * 0.37;
  let resting = true;
  return (seconds, focused, reducedMotion) => {
    if (reducedMotion) {
      if (!resting) { positions.set(neutral); canopy.updateVerticesData('position', positions, false, false); }
      resting = true; return;
    }
    resting = false;
    // A tap rustles the leaves: `rustle` fades from 1 to 0 over a second.
    const rustle = parent.metadata.rustle || 0;
    for (const { start, end, anchorY, height, phase } of template.metadata.ranges) {
      const wind = Math.sin(seconds * 0.82 + phaseOffset + phase * 0.3);
      const flutter = Math.sin(seconds * 1.63 + phaseOffset + phase);
      const shiver = Math.sin(seconds * 19 + phase * 2.3) * rustle;
      const swayX = (wind * 0.82 + flutter * 0.18 + shiver * 1.1) * amplitude;
      const swayZ = (Math.sin(seconds * 0.67 + phaseOffset + phase * 0.4) * 0.45 + shiver * 0.6) * amplitude;
      for (let vertex = start; vertex < end; vertex++) {
        const index = vertex * 3;
        // Only the leaf above its attachment moves. The pot, trunk, branches,
        // and the bottom of each blade keep their exact original position.
        const tip = Math.max(0, Math.min(1, (neutral[index + 1] - anchorY) / height));
        const bend = tip * tip;
        positions[index] = Math.max(-limitX, Math.min(limitX, neutral[index] + swayX * bend));
        positions[index + 1] = neutral[index + 1] + flutter * bend * 0.012;
        positions[index + 2] = Math.max(-limitZ, Math.min(limitZ, neutral[index + 2] + swayZ * bend));
      }
    }
    canopy.updateVerticesData('position', positions, false, false);
  };
}

// The globe's painted sphere, once per scene: seas, low continents and white
// poles in its vertex colors, on the shared white paint.
function globeTemplate(scene) {
  const templates = cacheFor(scene).templates;
  if (!templates.has('globe-sphere')) {
    const globe = CreateSphere('globe-sphere', { diameter: 0.6, segments: 18 }, scene), positions = globe.getVerticesData('position'), colors = [];
    const lands = [[0.3, 0.5, 0.8, 0.55], [-0.6, 0.2, 0.7, 0.62], [0.7, -0.35, -0.2, 0.5], [-0.25, -0.6, -0.7, 0.58], [0.1, 0.85, -0.45, 0.6], [-0.8, -0.3, -0.3, 0.7]].map(([x, y, z, t]) => [new Vector3(x, y, z).normalize(), t]);
    const sea = Color3.FromHexString('#6f96ae'), land = Color3.FromHexString('#a9b887'), ice = Color3.FromHexString('#eef0ea'), direction = new Vector3();
    for (let i = 0; i < positions.length; i += 3) {
      direction.set(positions[i], positions[i + 1], positions[i + 2]).normalize();
      const paint = Math.abs(direction.y) > 0.9 ? ice : lands.some(([center, t]) => Vector3.Dot(direction, center) > t) ? land : sea;
      colors.push(paint.r, paint.g, paint.b, 1);
    }
    globe.setVerticesData('color', colors); globe.material = material(scene, '#ffffff'); globe.receiveShadows = true; globe.isPickable = true;
    globe.setEnabled(false); templates.set('globe-sphere', globe);
  }
  return templates.get('globe-sphere');
}
// Three fish and a string of bubbles, as instances of one small mesh each:
// the fish swim to and fro and turn around, the bubbles rise and start again.
// Both keep still with reduced motion, and the bubbles hide.
function createAquariumLife(parent) {
  const scene = parent.getScene(), templates = cacheFor(scene).templates;
  if (!templates.has('aquarium-fish')) {
    const body = CreateSphere('fish-body', { diameter: 2, segments: 6 }, scene); body.scaling.set(0.07, 0.04, 0.019);
    const tail = CreateSphere('fish-tail', { diameter: 2, segments: 4 }, scene); tail.scaling.set(0.03, 0.036, 0.007); tail.position.x = -0.082;
    const fish = Mesh.MergeMeshes([body, tail], true, true); fish.name = 'aquarium-fish';
    const bubble = CreateSphere('aquarium-bubble', { diameter: 2, segments: 4 }, scene);
    for (const mesh of [fish, bubble]) { mesh.material = material(scene, '#ffffff'); mesh.setEnabled(false); }
    templates.set('aquarium-fish', fish); templates.set('aquarium-bubble', bubble);
  }
  const water = new BoundingInfo(new Vector3(-0.7, 0.88, -0.24), new Vector3(0.7, 1.48, 0.24));
  const school = [{ y: 1.12, z: 0.08, speed: 0.55, phase: 0, reach: 0.48, size: 1, color: '#ec8a4e' }, { y: 1.3, z: -0.07, speed: 0.42, phase: 2.1, reach: 0.4, size: 0.8, color: '#e9bd57' }, { y: 0.99, z: 0.01, speed: 0.68, phase: 4.2, reach: 0.36, size: 0.9, color: '#6c9bd4' }];
  const bubbles = Array.from({ length: 6 }, (_, i) => ({ phase: i / 6, x: 0.5 + (i % 2) * 0.02, z: -0.08, size: 0.012 + (i % 3) * 0.004 }));
  const parts = [['aquarium-fish', school], ['aquarium-bubble', bubbles]].map(([name, seeds]) => {
    const mesh = templates.get(name).clone(name, parent); mesh.setEnabled(true); mesh.isPickable = false; mesh.receiveShadows = false;
    mesh.metadata = { dynamic: true, effect: 'aquarium-life', castShadow: false }; mesh.setBoundingInfo(water);
    const matrices = new Float32Array(seeds.length * 16), colors = new Float32Array(seeds.length * 4);
    seeds.forEach((seed, i) => { const color = Color3.FromHexString(seed.color || '#eaf7f5'); colors.set([color.r, color.g, color.b, 1], i * 4); });
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, false); mesh.thinInstanceSetBuffer('color', colors, 4, true);
    return { mesh, matrices };
  });
  const [fish, bubble] = parts, scratch = new Matrix(), turn = new Quaternion(), scale = new Vector3(), at = new Vector3(), still = Quaternion.Identity();
  function pose(seconds, moving) {
    school.forEach((seed, i) => {
      const s = seconds * seed.speed + seed.phase, heading = Math.max(-1, Math.min(1, Math.cos(s) * 3));
      at.set(Math.sin(s) * seed.reach, seed.y + Math.sin(s * 1.7) * 0.03, seed.z + Math.sin(s * 0.8) * 0.04);
      Quaternion.RotationYawPitchRollToRef((1 - heading) / 2 * Math.PI + (moving ? Math.sin(seconds * 9 + i) * 0.1 : 0), 0, 0, turn);
      Matrix.ComposeToRef(scale.setAll(seed.size), turn, at, scratch); scratch.copyToArray(fish.matrices, i * 16);
    });
    bubbles.forEach((seed, i) => {
      const t = (seconds * 0.35 + seed.phase) % 1;
      Matrix.ComposeToRef(scale.setAll(seed.size), still, at.set(seed.x + Math.sin(t * 12 + i) * 0.012, 0.92 + t * 0.52, seed.z), scratch); scratch.copyToArray(bubble.matrices, i * 16);
    });
    fish.mesh.thinInstanceBufferUpdated('matrix'); bubble.mesh.thinInstanceBufferUpdated('matrix');
  }
  pose(0, false); bubble.mesh.setEnabled(false);
  let resting = true;
  return (seconds, focused, reducedMotion) => {
    if (reducedMotion) { if (!resting) { pose(0, false); bubble.mesh.setEnabled(false); } resting = true; return; }
    if (resting) bubble.mesh.setEnabled(true);
    resting = false; pose(seconds, true);
  };
}
function createSpinningRecord(parent) {
  const scene = parent.getScene(), templates = cacheFor(scene).templates;
  if (!templates.has('spinning-record')) {
    const source = new TransformNode('record-source', scene);
    cylinder(source, 0.18, 0.18, 0.01, [0, 0, 0], '#424b43');
    cylinder(source, 0.055, 0.055, 0.012, [0, 0.008, 0], '#b68a65');
    // A cream label stripe and an off-center highlight make the turn readable
    // at room scale instead of spinning an indistinguishable solid circle.
    mesh(source, CreateBox('record-label', { width: 0.052, height: 0.002, depth: 0.017 }, scene), '#e2d1ac', [0, 0.015, 0.017]);
    mesh(source, CreateBox('record-label-ink', { width: 0.027, height: 0.002, depth: 0.005 }, scene), '#635c4b', [0, 0.017, 0.017]);
    const positions = [], indices = [], normals = [];
    for (let point = 0; point <= 12; point++) {
      const angle = -0.35 + point / 12 * 1.35;
      for (const radius of [0.132, 0.136]) {
        positions.push(Math.cos(angle) * radius, 0.006, Math.sin(angle) * radius); normals.push(0, 1, 0);
      }
      if (point < 12) { const first = point * 2; indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2); }
    }
    const groove = new Mesh('record-groove-highlight', scene), data = new VertexData();
    Object.assign(data, { positions, indices, normals }); data.applyToMesh(groove);
    mesh(source, groove, '#7b8371', [0, 0, 0]);
    const template = batch(source); template.setEnabled(false); templates.set('spinning-record', template);
  }
  const record = templates.get('spinning-record').clone('spinning-vinyl-record', parent); record.setEnabled(true);
  record.position.set(-0.33, 1.006, -0.01); record.metadata = { dynamic: true, effect: 'record-spin' };
  for (const part of record.getChildMeshes()) { part.metadata = { dynamic: true, effect: 'record-spin' }; part.isPickable = false; }
  // Rigid rotation lets every record keep sharing the same geometry and material.
  return (seconds, focused, reducedMotion) => { if (!parent.metadata.off) record.rotation.y = reducedMotion ? 0 : seconds * 1.25 % (Math.PI * 2); };
}

function createDancingFire(parent) {
  const scene = parent.getScene(), templates = cacheFor(scene).templates;
  if (!templates.has('dancing-fire')) {
    const source = new TransformNode('flame-source', scene), ranges = [];
    let vertexOffset = 0;
    for (let i = 0; i < 7; i++) {
      const height = 0.28 + (i % 3) * 0.11;
      const flame = cylinder(source, 0.005, 0.092, height, [-0.48 + i * 0.155, 0.39 + height / 2, 0.10 - (i % 2) * 0.075], i % 2 ? '#ffb85e' : '#ffd58a', candleGlow);
      flame.rotation.z = (i % 2 ? -1 : 1) * 0.13;
      ranges.push({ start: vertexOffset, end: vertexOffset + flame.getTotalVertices(), height, phase: i * 1.41 });
      vertexOffset += flame.getTotalVertices();
    }
    const template = batch(source); template.metadata = { ranges }; template.setEnabled(false);
    templates.set('dancing-fire', template);
  }
  const template = templates.get('dancing-fire');
  const fire = template.getChildMeshes()[0].clone('dancing-hearth-flames', parent);
  // The material remains shared, while only this tiny vertex buffer is unique.
  fire.makeGeometryUnique(); fire.markVerticesDataAsUpdatable('position', true);
  fire.metadata = { dynamic: true, effect: 'hearth-flames' };
  fire.isPickable = false; fire.receiveShadows = false;
  fire.setBoundingInfo(new BoundingInfo(new Vector3(-0.7, 0.3, -0.14), new Vector3(0.7, 1.1, 0.25)));
  const neutral = new Float32Array(fire.getVerticesData('position'));
  const positions = new Float32Array(neutral);
  let resting = true;
  return (seconds, focused, reducedMotion) => {
    if (parent.metadata.off) return;
    if (reducedMotion) {
      if (!resting) { positions.set(neutral); fire.updateVerticesData('position', positions, false, false); }
      resting = true; return;
    }
    resting = false;
    for (const { start, end, height, phase } of template.metadata.ranges) {
      const stretch = 1 + Math.sin(seconds * 5.3 + phase) * 0.17 + Math.sin(seconds * 8.7 + phase * 0.53) * 0.07;
      const sway = Math.sin(seconds * 3.1 + phase) * 0.05 + Math.sin(seconds * 7.1 + phase) * 0.012;
      const drift = Math.sin(seconds * 4.3 + phase) * 0.017;
      for (let vertex = start; vertex < end; vertex++) {
        const index = vertex * 3, lift = neutral[index + 1] - 0.39;
        const tip = Math.max(0, Math.min(1, lift / height));
        positions[index] = neutral[index] + sway * tip * tip;
        positions[index + 1] = 0.39 + lift * stretch;
        positions[index + 2] = neutral[index + 2] + drift * tip;
      }
    }
    fire.updateVerticesData('position', positions, false, false);
  };
}

function createTeaSteam(parent, origin, scale = 1) {
  const scene = parent.getScene(), cache = cacheFor(scene);
  if (!cache.batches.has('tea-steam')) {
    const steamMaterial = new StandardMaterial('warm-tea-steam', scene);
    steamMaterial.diffuseColor = Color3.White(); steamMaterial.specularColor = Color3.Black();
    steamMaterial.emissiveColor = new Color3(0.17, 0.15, 0.12);
    steamMaterial.backFaceCulling = false;
    cache.batches.set('tea-steam', steamMaterial);
  }
  const segments = 14, ribbons = 2, positions = new Float32Array((segments + 1) * ribbons * 6);
  const colors = new Float32Array((segments + 1) * ribbons * 8), indices = [], normals = new Float32Array(positions.length);
  for (let ribbon = 0; ribbon < ribbons; ribbon++) {
    for (let point = 0; point <= segments; point++) {
      const first = (ribbon * (segments + 1) + point) * 2;
      for (let side = 0; side < 2; side++) { normals[(first + side) * 3] = Math.SQRT1_2; normals[(first + side) * 3 + 2] = Math.SQRT1_2; }
      if (point < segments) indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
  }
  function pose(seconds, puff = 0) {
    for (let ribbon = 0; ribbon < ribbons; ribbon++) {
      for (let point = 0; point <= segments; point++) {
        const height = point / segments, phase = seconds * 1.25 + ribbon * 2.7;
        const curl = Math.sin(height * 8.5 - phase) * (0.008 + height * 0.028);
        const centerX = (ribbon ? 0.023 : -0.023) + curl + Math.sin(phase * 0.6) * height * 0.028;
        const centerZ = Math.cos(height * 6.5 - phase) * height * 0.028;
        const width = (0.009 + Math.sin(height * Math.PI) * 0.010) * scale;
        const opacity = Math.min(1, Math.sin(height * Math.PI) ** 1.3 * (0.23 + 0.11 * Math.sin(height * 6.2 - phase)) * (1 + puff * 0.9));
        for (let side = 0; side < 2; side++) {
          const vertex = (ribbon * (segments + 1) + point) * 2 + side, sign = side ? 1 : -1;
          positions[vertex * 3] = origin[0] + centerX * scale + sign * width * (1 + puff * 0.5);
          positions[vertex * 3 + 1] = origin[1] + height * 0.57 * scale * (1 + puff * 0.7);
          positions[vertex * 3 + 2] = origin[2] + centerZ * scale - sign * width;
          colors[vertex * 4] = 0.91; colors[vertex * 4 + 1] = 0.88; colors[vertex * 4 + 2] = 0.80; colors[vertex * 4 + 3] = opacity;
        }
      }
    }
  }
  pose(0);
  const neutralPositions = new Float32Array(positions), neutralColors = new Float32Array(colors);
  const steam = new Mesh('curling-tea-steam', scene); steam.parent = parent;
  const data = new VertexData(); Object.assign(data, { positions, normals, colors, indices }); data.applyToMesh(steam, true);
  steam.material = cache.batches.get('tea-steam'); steam.useVertexColors = true; steam.hasVertexAlpha = true;
  steam.isPickable = false; steam.receiveShadows = false; steam.metadata = { dynamic: true, effect: 'tea-steam' };
  steam.setBoundingInfo(new BoundingInfo(new Vector3(origin[0] - 0.15 * scale, origin[1], origin[2] - 0.12 * scale), new Vector3(origin[0] + 0.15 * scale, origin[1] + 0.99 * scale, origin[2] + 0.12 * scale)));
  let resting = true;
  return (seconds, focused, reducedMotion) => {
    if (reducedMotion) {
      if (resting) return;
      positions.set(neutralPositions); colors.set(neutralColors); resting = true;
    } else { pose(seconds, parent.metadata.puff || 0); resting = false; }
    steam.updateVerticesData('position', positions, false, false);
    steam.updateVerticesData('color', colors, false, false);
  };
}

function createHearthEmbers(parent) {
  const scene = parent.getScene(), cache = cacheFor(scene), count = 16;
  if (!cache.batches.has('hearth-embers')) {
    const emberMaterial = new StandardMaterial('rising-hearth-embers', scene);
    emberMaterial.diffuseColor = Color3.White(); emberMaterial.specularColor = Color3.Black();
    emberMaterial.emissiveColor = new Color3(1, 0.46, 0.10);
    emberMaterial.disableLighting = true; emberMaterial.backFaceCulling = false;
    cache.batches.set('hearth-embers', emberMaterial);
  }
  const positions = new Float32Array(count * 24), colors = new Float32Array(count * 32);
  const normals = new Float32Array(count * 24), indices = [];
  for (let particle = 0; particle < count; particle++) {
    for (let plane = 0; plane < 2; plane++) {
      const vertex = particle * 8 + plane * 4;
      indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
      for (let corner = 0; corner < 4; corner++) {
        normals[(vertex + corner) * 3] = Math.SQRT1_2;
        normals[(vertex + corner) * 3 + 2] = plane ? -Math.SQRT1_2 : Math.SQRT1_2;
      }
    }
  }
  function pose(seconds) {
    for (let particle = 0; particle < count; particle++) {
      const phase = particle * 2.399963, lifetime = 5.5 + (particle % 4) * 0.55;
      const rise = (seconds / lifetime + particle * 0.618034) % 1;
      const x = Math.sin(phase) * 0.31 + Math.sin(rise * 5.5 + phase) * rise * 0.17;
      const y = 0.75 + rise * 3.0;
      const approach = Math.min(1, rise * 4), drift = approach * approach * (3 - 2 * approach);
      const z = 0.15 + drift * 0.36 + Math.cos(rise * 4.2 + phase) * 0.012;
      const size = (0.017 + (particle % 3) * 0.006) * (1 - rise * 0.3);
      const opacity = Math.min(1, rise / 0.09) * Math.max(0, 1 - rise) ** 1.3 * 0.86;
      // Crossed diamonds keep at least one broad face visible after any quarter
      // turn of the fireplace, without camera-facing updates or extra draw calls.
      for (let plane = 0; plane < 2; plane++) {
        for (let corner = 0; corner < 4; corner++) {
          const across = corner === 0 ? -size : corner === 2 ? size : 0;
          const up = corner === 1 ? size * 1.4 : corner === 3 ? -size * 1.4 : 0;
          const vertex = particle * 8 + plane * 4 + corner;
          positions[vertex * 3] = x + across; positions[vertex * 3 + 1] = y + up;
          positions[vertex * 3 + 2] = z + (plane ? across : -across);
          colors[vertex * 4] = 1; colors[vertex * 4 + 1] = 0.63 + (particle % 3) * 0.08;
          colors[vertex * 4 + 2] = 0.22; colors[vertex * 4 + 3] = opacity;
        }
      }
    }
  }
  pose(0);
  const neutralPositions = new Float32Array(positions), neutralColors = new Float32Array(colors);
  const embers = new Mesh('rising-hearth-embers', scene); embers.parent = parent;
  const data = new VertexData(); Object.assign(data, { positions, colors, indices, normals }); data.applyToMesh(embers, true);
  embers.material = cache.batches.get('hearth-embers'); embers.useVertexColors = true; embers.hasVertexAlpha = true;
  embers.isPickable = false; embers.receiveShadows = false; embers.metadata = { dynamic: true, effect: 'hearth-embers', castShadow: false };
  embers.setBoundingInfo(new BoundingInfo(new Vector3(-0.54, 0.68, 0.1), new Vector3(0.54, 3.85, 0.565)));
  let resting = true;
  return (seconds, focused, reducedMotion) => {
    if (parent.metadata.off) { embers.setEnabled(false); return; }
    if (reducedMotion) {
      embers.setEnabled(false);
      if (resting) return;
      positions.set(neutralPositions); colors.set(neutralColors); resting = true;
    } else {
      embers.setEnabled(true); pose(seconds); resting = false;
    }
    embers.updateVerticesData('position', positions, false, false); embers.updateVerticesData('color', colors, false, false);
  };
}

// Each sleeve uses the same shoulder/elbow/wrist anchors, with rounded joint
// volumes covering the bends. Repose both vertices and normals in one draw call.
function createArticulatedUpperBody(avatar, template) {
  const upper = template.getChildMeshes()[0].clone('articulated-sweater-and-arms', avatar);
  upper.makeGeometryUnique();
  for (const kind of ['position', 'normal']) upper.markVerticesDataAsUpdatable(kind, true);
  const neutral = new Float32Array(upper.getVerticesData('position')), positions = new Float32Array(neutral);
  const neutralNormals = new Float32Array(upper.getVerticesData('normal')), normals = new Float32Array(neutralNormals);
  const joints = [-1, 1].map(side => ({
    shoulder: new Vector3(side * 0.255, 1.43, -0.12),
    elbow: new Vector3(side * 0.37, 1.40, -0.46),
    wrist: new Vector3(side * 0.21, 1.37, -0.87),
  }));
  upper.metadata = { dynamic: true, part: 'avatar-upper-body', rig: { joints, ranges: template.metadata.ranges } };
  const originalBounds = upper.getBoundingInfo().boundingBox;
  upper.setBoundingInfo(new BoundingInfo(originalBounds.minimum.subtract(new Vector3(0.08, 0.12, 0.24)), originalBounds.maximum.add(new Vector3(0.08, 0.12, 0.24))));
  const direction = new Vector3(), radial = new Vector3(), rotated = new Vector3(), normal = new Vector3(), rotation = new Quaternion();
  let resting = true;
  return (lean, roll, breath, hands, reducedMotion) => {
    if (reducedMotion) {
      if (!resting) {
        positions.set(neutral); normals.set(neutralNormals);
        upper.updateVerticesData('position', positions, false, false);
        upper.updateVerticesData('normal', normals, false, false);
      }
      resting = true; return;
    }
    resting = false;
    const cosLean = Math.cos(lean), sinLean = Math.sin(lean), cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
    for (let index = 0; index < joints.length; index++) {
      const side = index ? 1 : -1, hand = hands[index].position, joint = joints[index];
      const y = side * 0.255 * sinRoll + 0.65 * cosRoll;
      joint.shoulder.set(side * 0.255 * cosRoll - 0.65 * sinRoll,
        0.78 + y * cosLean + 0.04 * sinLean + breath, -0.08 + y * sinLean - 0.04 * cosLean);
      // Elbows rest above the desk instead of following the torso through it.
      joint.elbow.set(side * 0.37 + (joint.shoulder.x - side * 0.255) * 0.35 + (hand.x - side * 0.21) * 0.12,
        1.40 + (hand.y - 1.37) * 0.2, -0.46 + (joint.shoulder.z + 0.12) * 0.25);
      joint.wrist.set(hand.x, hand.y, hand.z + 0.07);
    }
    for (const range of template.metadata.ranges) {
      const joint = joints[range.side < 0 ? 0 : 1];
      if (range.arm) {
        const start = range.forearm ? joint.elbow : joint.shoulder, end = range.forearm ? joint.wrist : joint.elbow;
        end.subtractToRef(start, direction);
        const length = direction.length(); direction.scaleInPlace(1 / length);
        Quaternion.FromUnitVectorsToRef(range.direction, direction, rotation);
        for (let vertex = range.start; vertex < range.end; vertex++) {
          const offset = vertex * 3, along = range.weights[vertex - range.start];
          radial.set(neutral[offset] - range.a[0] - range.direction.x * along * range.length,
            neutral[offset + 1] - range.a[1] - range.direction.y * along * range.length,
            neutral[offset + 2] - range.a[2] - range.direction.z * along * range.length);
          radial.rotateByQuaternionToRef(rotation, rotated);
          positions[offset] = start.x + direction.x * along * length + rotated.x;
          positions[offset + 1] = start.y + direction.y * along * length + rotated.y;
          positions[offset + 2] = start.z + direction.z * along * length + rotated.z;
          normal.set(neutralNormals[offset], neutralNormals[offset + 1], neutralNormals[offset + 2]);
          const axial = Vector3.Dot(normal, range.direction) * (range.length / length - 1);
          normal.x += range.direction.x * axial; normal.y += range.direction.y * axial; normal.z += range.direction.z * axial;
          normal.normalize().rotateByQuaternionToRef(rotation, rotated);
          normals[offset] = rotated.x; normals[offset + 1] = rotated.y; normals[offset + 2] = rotated.z;
        }
      } else if (range.joint === 'elbow') {
        for (let vertex = range.start; vertex < range.end; vertex++) {
          const offset = vertex * 3;
          positions[offset] = neutral[offset] + joint.elbow.x - range.center[0];
          positions[offset + 1] = neutral[offset + 1] + joint.elbow.y - range.center[1];
          positions[offset + 2] = neutral[offset + 2] + joint.elbow.z - range.center[2];
        }
      } else {
        for (let vertex = range.start; vertex < range.end; vertex++) {
          const offset = vertex * 3, x = neutral[offset], y = neutral[offset + 1] - 0.78, z = neutral[offset + 2] + 0.08;
          const rolledY = x * sinRoll + y * cosRoll;
          positions[offset] = x * cosRoll - y * sinRoll;
          positions[offset + 1] = 0.78 + rolledY * cosLean - z * sinLean + breath;
          positions[offset + 2] = -0.08 + rolledY * sinLean + z * cosLean;
          const nx = neutralNormals[offset], ny = neutralNormals[offset + 1], nz = neutralNormals[offset + 2];
          const rolledNormalY = nx * sinRoll + ny * cosRoll;
          normals[offset] = nx * cosRoll - ny * sinRoll;
          normals[offset + 1] = rolledNormalY * cosLean - nz * sinLean;
          normals[offset + 2] = rolledNormalY * sinLean + nz * cosLean;
        }
      }
    }
    upper.updateVerticesData('position', positions, false, false);
    upper.updateVerticesData('normal', normals, false, false);
  };
}

function sweater(parent) {
  // Elliptical rings give the knit a soft waist and sloping shoulders, rather
  // than reusing the sharp furniture-box silhouette for a person.
  const profile = [[0.83, 0.20, 0.155], [0.87, 0.245, 0.185], [0.95, 0.27, 0.205],
    [1.22, 0.285, 0.20], [1.39, 0.26, 0.185], [1.49, 0.20, 0.145], [1.51, 0.12, 0.11]];
  const positions = [], indices = [], normals = [], sides = 16;
  for (const [y, width, depth] of profile) for (let side = 0; side < sides; side++) {
    const angle = side / sides * Math.PI * 2;
    positions.push(Math.cos(angle) * width, y, -0.085 + Math.sin(angle) * depth);
  }
  for (let ring = 0; ring < profile.length - 1; ring++) for (let side = 0; side < sides; side++) {
    const a = ring * sides + side, b = ring * sides + (side + 1) % sides, c = a + sides, d = b + sides;
    indices.push(a, b, c, b, d, c);
  }
  for (const [ring, reverse] of [[0, true], [profile.length - 1, false]]) {
    const center = positions.length / 3; positions.push(0, profile[ring][0], -0.085);
    for (let side = 0; side < sides; side++) {
      const a = ring * sides + side, b = ring * sides + (side + 1) % sides;
      indices.push(center, reverse ? b : a, reverse ? a : b);
    }
  }
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData(); Object.assign(data, { positions, indices, normals });
  const shape = new Mesh('soft-knit-sweater', parent.getScene()); data.applyToMesh(shape);
  mesh(parent, shape, '#b88770', [0, 0, 0]);
  const hem = cylinder(parent, 0.238, 0.218, 0.045, [0, 0.859, -0.085], '#a67863'); hem.scaling.z = 0.77;
  const collar = torus(parent, 0.107, 0.025, [0, 1.515, -0.14], '#cb9b7d'); collar.rotation.x = Math.PI / 2;
}

function avatarTemplate(scene) {
  const templates = cacheFor(scene).templates;
  if (templates.has('avatar')) return templates.get('avatar');
  const body = new TransformNode('avatar-part', scene);
  box(body, [0.51, 0.22, 0.43], [0, 0.77, -0.08], '#777e72', 0.08);
  for (const x of [-0.15, 0.15]) {
    rod(body, [x, 0.75, -0.08], [x, 0.65, -0.57], 0.115, '#777e72');
    rod(body, [x, 0.65, -0.57], [x, 0.17, -0.67], 0.08, '#777e72');
    box(body, [0.20, 0.12, 0.34], [x, 0.09, -0.75], C.cream, 0.05);
  }
  const upperSource = new TransformNode('avatar-upper-body-source', scene);
  sweater(upperSource);
  cylinder(upperSource, 0.10, 0.12, 0.14, [0, 1.565, -0.14], C.skin);
  for (const side of [-1, 1]) {
    const shoulder = [side * 0.255, 1.43, -0.12], elbow = [side * 0.37, 1.40, -0.46], wrist = [side * 0.21, 1.37, -0.87];
    sphere(upperSource, [0.10, 0.10, 0.10], shoulder, '#b88770');
    const elbowJoint = sphere(upperSource, [0.086, 0.086, 0.086], elbow, '#b88770');
    elbowJoint.metadata = { joint: 'elbow', side, center: elbow };
    const upperArm = rod(upperSource, shoulder, elbow, 0.092, '#b88770');
    upperArm.metadata = { arm: true, a: shoulder, b: elbow, side, forearm: false };
    const start = new Vector3(...elbow), end = new Vector3(...wrist), direction = end.subtract(start);
    const forearm = mesh(upperSource, CreateCylinder('tapered-sleeve', { diameterTop: 0.104, diameterBottom: 0.156, height: direction.length(), tessellation: 10 }, scene), '#b88770', start.add(end).scale(0.5).asArray());
    forearm.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), new Quaternion());
    forearm.metadata = { arm: true, a: elbow, b: wrist, side, forearm: true };
  }
  const ranges = []; let vertexOffset = 0;
  for (const part of upperSource.getChildMeshes()) {
    const range = { start: vertexOffset, end: vertexOffset + part.getTotalVertices(), ...part.metadata };
    ranges.push(range); vertexOffset += part.getTotalVertices();
  }
  const upper = batch(upperSource), upperPositions = upper.getChildMeshes()[0].getVerticesData('position');
  for (const range of ranges) if (range.arm) {
    const dx = range.b[0] - range.a[0], dy = range.b[1] - range.a[1], dz = range.b[2] - range.a[2], lengthSquared = dx * dx + dy * dy + dz * dz;
    range.length = Math.sqrt(lengthSquared); range.direction = new Vector3(dx, dy, dz).scaleInPlace(1 / range.length);
    range.weights = new Float32Array(range.end - range.start);
    for (let vertex = range.start; vertex < range.end; vertex++) {
      const index = vertex * 3;
      range.weights[vertex - range.start] = Math.max(0, Math.min(1, ((upperPositions[index] - range.a[0]) * dx + (upperPositions[index + 1] - range.a[1]) * dy + (upperPositions[index + 2] - range.a[2]) * dz) / lengthSquared));
    }
  }
  upper.metadata = { ranges };
  const head = new TransformNode('avatar-part', scene);
  sphere(head, [0.232, 0.245, 0.22], [0, 0, 0], C.skin);
  for (const x of [-.072, .072]) sphere(head, [.012, .015, .009], [x, -.025, -.209], '#51443a');
  sphere(head, [.031, .033, .035], [0, -.070, -.215], C.skin);
  sphere(head, [0.24, 0.237, 0.22], [0, 0.061, 0.058], '#674d3b');
  sphere(head, [0.12, 0.12, 0.10], [0, 0.19, 0.20], '#674d3b');
  torus(head, 0.25, 0.026, [0, 0.017, 0.014], C.dark, Math.PI);
  for (const x of [-0.244, 0.244]) sphere(head, [0.044, 0.091, 0.08], [x, 0.022, 0.014], C.sage);
  const hand = new TransformNode('avatar-part', scene); sphere(hand, [0.074, 0.044, 0.10], [0, 0, 0], C.skin);
  const writingHand = new TransformNode('avatar-part', scene);
  sphere(writingHand, [0.074, 0.044, 0.10], [0, 0, 0], C.skin);
  rod(writingHand, [0.015, -0.048, -0.045], [0.075, 0.15, 0.025], 0.009, '#bb9b61');
  rod(writingHand, [0.011, -0.058, -0.049], [0.015, -0.048, -0.045], 0.005, '#514e3b');
  const value = { body: batch(body), upper, head: batch(head), hand: batch(hand), writingHand: batch(writingHand) };
  Object.values(value).forEach(part => part.setEnabled(false));
  templates.set('avatar', value); return value;
}

// One independently posed body buffer plus the shared head. The same sweater,
// palette and proportions carry the desk companion through walks and breaks.
export function createMobileCompanion(scene) {
  const root = new TransformNode('Walking companion', scene), source = new TransformNode('companion-rig-source', scene);
  sweater(source); cylinder(source, .10, .12, .14, [0, 1.565, -.14], C.skin);
  box(source, [.51, .22, .43], [0, .77, -.08], '#777e72', .08);
  source.getChildMeshes().forEach(part => { part.metadata = { bone: 'torso' }; });
  const joints = {}, bones = {};
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'L' : 'R';
    const anchors = { shoulder: [side * .255, 1.43, -.12], elbow: [side * .34, 1.10, -.14], wrist: [side * .30, .89, -.18], hip: [side * .15, .76, -.08], knee: [side * .15, .65, -.57], ankle: [side * .15, .17, -.67] };
    for (const [name, point] of Object.entries(anchors)) joints[name + key] = new Vector3(...point);
    for (const [name, a, b, radius, tint] of [['upperArm', 'shoulder', 'elbow', .092, '#b88770'], ['forearm', 'elbow', 'wrist', .075, '#b88770'], ['thigh', 'hip', 'knee', .108, '#777e72'], ['shin', 'knee', 'ankle', .078, '#777e72']]) {
      const bone = name + key, part = rod(source, anchors[a], anchors[b], radius, tint);
      part.metadata = { bone }; bones[bone] = { a: a + key, b: b + key, start: new Vector3(...anchors[a]), end: new Vector3(...anchors[b]) };
      const joint = sphere(source, [radius, radius, radius], anchors[a], tint); joint.metadata = { joint: a + key };
    }
    const hand = sphere(source, [.074, .082, .066], anchors.wrist, C.skin); hand.metadata = { joint: 'wrist' + key };
    const shoe = box(source, [.20, .12, .34], [side * .15, .09, -.75], C.cream, .05); shoe.metadata = { joint: 'ankle' + key };
  }
  const ranges = []; let vertex = 0;
  for (const part of source.getChildMeshes()) { ranges.push({ start: vertex, end: vertex + part.getTotalVertices(), ...part.metadata }); vertex += part.getTotalVertices(); }
  const bodyGroup = batch(source); bodyGroup.parent = root;
  const body = bodyGroup.getChildMeshes()[0]; body.name = 'companion-articulated-body';
  for (const kind of ['position', 'normal']) body.markVerticesDataAsUpdatable(kind, true);
  const neutral = Float32Array.from(body.getVerticesData('position')), positions = new Float32Array(neutral);
  const neutralNormals = Float32Array.from(body.getVerticesData('normal')), normals = new Float32Array(neutralNormals);
  for (const bone of Object.values(bones)) { bone.direction = bone.end.subtract(bone.start); bone.length = bone.direction.length(); bone.direction.scaleInPlace(1 / bone.length); }
  for (const range of ranges) {
    if (range.joint) range.center = joints[range.joint].clone();
    if (!bones[range.bone]) continue;
    const bone = bones[range.bone]; range.weights = new Float32Array(range.end - range.start);
    for (let i = range.start; i < range.end; i++) range.weights[i - range.start] = Math.max(0, Math.min(1, ((neutral[i * 3] - bone.start.x) * bone.direction.x + (neutral[i * 3 + 1] - bone.start.y) * bone.direction.y + (neutral[i * 3 + 2] - bone.start.z) * bone.direction.z) / bone.length));
  }
  body.metadata = { dynamic: true, castShadow: false, companion: true, rig: { joints } };
  body.setBoundingInfo(new BoundingInfo(new Vector3(-.6, 0, -.95), new Vector3(.6, 2.1, .65)));
  const head = avatarTemplate(scene).head.clone('companion-head', root); head.setEnabled(true);
  const sleepLetters = CreateLineSystem('companion-sleep-letters', { lines: [0, 1].map(i => {
    const x = i * .19, y = i * .22, size = i ? .10 : .14;
    return [new Vector3(x, y + size, 0), new Vector3(x + size, y + size, 0), new Vector3(x, y, 0), new Vector3(x + size, y, 0)];
  }) }, scene);
  sleepLetters.parent = root; sleepLetters.billboardMode = Mesh.BILLBOARDMODE_ALL; sleepLetters.color = Color3.FromHexString('#eadac3'); sleepLetters.setEnabled(false);
  root.getChildMeshes().forEach(part => { part.isPickable = false; part.receiveShadows = false; part.metadata = { ...part.metadata, castShadow: false, companion: true }; });
  // The same soft pool as the furniture, raised above the thickest rug.
  const contact = createContactShadow('companion-contact-shadow', .26, .26, scene, { soft: .30, strength: .36 });
  contact.metadata = { ...contact.metadata, companion: true }; contact.position.y = .30;
  const direction = new Vector3(), radial = new Vector3(), rotated = new Vector3(), normal = new Vector3(), rotation = new Quaternion();
  const torsoPoint = (x, y, z, hip, lean, roll, out) => {
    const ry = x * Math.sin(roll) + y * Math.cos(roll);
    out.set(x * Math.cos(roll) - y * Math.sin(roll), hip + ry * Math.cos(lean) - z * Math.sin(lean), -.08 + ry * Math.sin(lean) + z * Math.cos(lean));
  };
  return {
    root, contact,
    animate(pose, seconds, reducedMotion) {
      const visible = !pose.atDesk;
      root.setEnabled(visible); contact.setEnabled(visible);
      if (!visible) return;
      root.position.set(pose.x, .22, pose.z); root.rotation.y = pose.yaw;
      sleepLetters.setEnabled(pose.doze > .25 && !reducedMotion);
      if (sleepLetters.isEnabled()) { const drift = seconds / 3 % 1; sleepLetters.position.set(.12, 2.08 + drift * .20, 0); sleepLetters.alpha = Math.sin(drift * Math.PI) * .70; }
      contact.position.x = pose.x; contact.position.z = pose.z;
      const sit = pose.sit, phase = pose.moving && !reducedMotion ? pose.step : 0;
      const breath = reducedMotion ? 0 : Math.sin(seconds * (pose.doze > 0 ? 1.05 : 1.4)) * .007;
      const hip = 1.10 * (1 - sit) + pose.seatHeight * sit + (pose.moving && !reducedMotion ? Math.cos(phase * 2) * .016 : 0);
      const lean = sit * (.08 + pose.doze * .11), roll = reducedMotion ? 0 : Math.sin(phase) * .025 * (1 - sit);
      for (const side of [-1, 1]) {
        const key = side < 0 ? 'L' : 'R', stride = Math.sin(phase + (side < 0 ? 0 : Math.PI)), lift = pose.moving && !reducedMotion ? Math.max(0, Math.cos(phase + (side < 0 ? 0 : Math.PI))) * .10 : 0;
        torsoPoint(side * .255, .65, -.04, hip + breath, lean, roll, joints['shoulder' + key]);
        joints['elbow' + key].set(side * (.32 + sit * .01), hip + .31 + sit * .06, -.10 + stride * .12 * (1 - sit));
        joints['wrist' + key].set(side * (.30 - sit * .10), hip + .08 + sit * .13, -.16 - sit * .25 + stride * .22 * (1 - sit));
        joints['hip' + key].set(side * .15, hip - .02, -.08);
        joints['knee' + key].set(side * .15, .56 * (1 - sit) + (pose.seatHeight - .13) * sit, -.57 * sit - .06 + stride * .14 * (1 - sit));
        joints['ankle' + key].set(side * .15, .17 * sit + .15 * (1 - sit) + lift * (1 - sit), -.67 * sit - stride * .29 * (1 - sit));
      }
      for (const range of ranges) {
        const bone = bones[range.bone];
        let length = 1, start;
        if (bone) { start = joints[bone.a]; joints[bone.b].subtractToRef(start, direction); length = direction.length(); direction.scaleInPlace(1 / length); Quaternion.FromUnitVectorsToRef(bone.direction, direction, rotation); }
        for (let vertex = range.start; vertex < range.end; vertex++) {
          const i = vertex * 3;
          if (bone) {
            const along = range.weights[vertex - range.start];
            radial.set(neutral[i] - bone.start.x - bone.direction.x * along * bone.length, neutral[i + 1] - bone.start.y - bone.direction.y * along * bone.length, neutral[i + 2] - bone.start.z - bone.direction.z * along * bone.length);
            radial.rotateByQuaternionToRef(rotation, rotated);
            positions[i] = start.x + direction.x * along * length + rotated.x; positions[i + 1] = start.y + direction.y * along * length + rotated.y; positions[i + 2] = start.z + direction.z * along * length + rotated.z;
            normal.set(neutralNormals[i], neutralNormals[i + 1], neutralNormals[i + 2]);
            const axial = Vector3.Dot(normal, bone.direction) * (bone.length / length - 1);
            normal.addInPlaceFromFloats(bone.direction.x * axial, bone.direction.y * axial, bone.direction.z * axial).normalize().rotateByQuaternionToRef(rotation, rotated);
            normals[i] = rotated.x; normals[i + 1] = rotated.y; normals[i + 2] = rotated.z;
          } else if (range.joint) {
            const joint = joints[range.joint];
            positions[i] = neutral[i] + joint.x - range.center.x; positions[i + 1] = neutral[i + 1] + joint.y - range.center.y; positions[i + 2] = neutral[i + 2] + joint.z - range.center.z;
          } else {
            torsoPoint(neutral[i], neutral[i + 1] - .78, neutral[i + 2] + .08, hip + breath, lean, roll, rotated);
            positions[i] = rotated.x; positions[i + 1] = rotated.y; positions[i + 2] = rotated.z;
            torsoPoint(neutralNormals[i], neutralNormals[i + 1], neutralNormals[i + 2], 0, lean, roll, rotated);
            normals[i] = rotated.x; normals[i + 1] = rotated.y; normals[i + 2] = rotated.z + .08;
          }
        }
      }
      body.updateVerticesData('position', positions, false, false); body.updateVerticesData('normal', normals, false, false);
      torsoPoint(0, 1.02, -.09, hip + breath, lean, roll, head.position);
      head.rotation.set(lean - pose.doze * .36, reducedMotion ? 0 : Math.sin(seconds * .45) * .055 * sit, roll + pose.doze * .09);
    },
  };
}

export function createFurniture(type, scene) {
  const definition = getFurniture(type);
  if (!definition) throw new Error(`Unknown furniture type: ${type}`);
  if (!scene) throw new Error('createFurniture requires a Babylon Scene.');
  const templates = cacheFor(scene).templates;
  if (!templates.has(type)) {
    const source = new TransformNode('furniture-source', scene);
    const builders = {
      'study-desk': parent => studyStation(parent, false), 'writing-desk': parent => studyStation(parent, true),
      bookcase, 'lounge-chair': loungeChair, 'side-table': sideTable, 'floor-lamp': floorLamp,
      plant, rug, ottoman, 'low-cabinet': cabinet,
      fireplace, daybed, 'moon-tree': moonTree, 'lantern-cluster': lanternCluster, 'moon-rug': moonRug,
      'tall-frame': parent => frame(parent, [1.04, 1.4], '#503d30'), 'small-frame': parent => frame(parent, [0.74, 1.02], '#ac8357'), 'wide-frame': parent => frame(parent, [1.5, 1.04], '#6b4b3b'),
      'moon-clock': moonClockCase, 'apothecary-shelf': apothecaryShelf, 'wall-shelf': wallShelf, 'hanging-plant': hangingPlant,
      'cloud-shelf': parent => cloudShelf(parent, 2.5), 'small-cloud-shelf': parent => cloudShelf(parent, 2.1),
      'wall-scroll': wallScroll, 'neon-orbit': neonOrbit, 'record-sleeve': recordSleeve, 'felt-rainbow': feltRainbow,
      'cottage-window': cottageWindow, 'arched-window': archedWindow, 'round-window': roundWindow,
      'fish-tank': fishTank, globe: globeStand, easel, 'bean-bag': beanBag, monstera: parent => monstera(parent), 'tea-cart': teaCart,
    };
    builders[type](source);
    const template = batch(source); template.setEnabled(false); templates.set(type, template);
  }
  const result = new TransformNode(definition.name, scene);
  result.position.y = 0.22; result.metadata = { type, sharedAssets: true };
  const animations = [];
  const staticParts = templates.get(type).clone(`${type}-details`, result); staticParts.setEnabled(true);
  result.metadata.body = staticParts;
  if (definition.category === 'Study') {
    const parts = avatarTemplate(scene);
    const avatar = group(result, [0, 0, 0.52]); avatar.metadata = { dynamic: true }; avatar.name = 'Study companion';
    const body = parts.body.clone('grounded-trousers-and-shoes', avatar); body.setEnabled(true);
    const articulateUpper = createArticulatedUpperBody(avatar, parts.upper);
    const head = parts.head.clone('headphones', avatar); head.position.set(0, 1.80, -0.17); head.setEnabled(true);
    const writing = type === 'writing-desk';
    const hands = [-1, 1].map(side => {
      const template = writing && side === 1 ? parts.writingHand : parts.hand;
      const hand = template.clone('typing-hand', avatar); hand.position.set(side * 0.21, 1.37, -0.94); hand.setEnabled(true); return hand;
    });
    result.metadata.study = true; result.metadata.avatar = avatar;
    let workStartedAt = null;
    animations.push((seconds, focused, reducedMotion) => {
      // An inactive desk keeps its companion hidden; its separate cup can still steam.
      if (!avatar.isEnabled()) { workStartedAt = null; return; }
      if (!focused || reducedMotion) workStartedAt = null;
      else if (workStartedAt === null || seconds < workStartedAt) workStartedAt = seconds - 0.15;
      head.position.set(0, 1.80, -0.17); head.rotation.set(0, 0, 0);
      for (let index = 0; index < hands.length; index++) {
        hands[index].position.set(index ? 0.21 : -0.21, 1.37, -0.94); hands[index].rotation.set(0, 0, 0);
      }
      if (reducedMotion) { articulateUpper(0, 0, 0, hands, true); return; }
      // Start each focus session with work, rather than landing in an arbitrary
      // thinking pause from the page clock. A short ramp settles into the desk.
      const cycle = focused ? (seconds - workStartedAt) % 10.5 : 0;
      const rampIn = Math.max(0, Math.min(1, cycle / 0.6)), rampOut = Math.max(0, Math.min(1, (6.7 - cycle) / 0.7));
      const work = focused ? rampIn * rampIn * (3 - 2 * rampIn) * rampOut * rampOut * (3 - 2 * rampOut) : 0;
      const lean = focused ? 0.028 - work * (writing ? 0.17 : 0.215) : Math.sin(seconds * 0.65) * 0.009;
      const roll = Math.sin(seconds * 0.91) * (focused ? 0.020 : 0.004);
      const breath = Math.sin(seconds * 1.15) * 0.009;
      const cosLean = Math.cos(lean), sinLean = Math.sin(lean), cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
      head.position.x = -1.02 * sinRoll;
      head.position.y = 0.78 + 1.02 * cosRoll * cosLean + 0.09 * sinLean + breath;
      head.position.z = -0.08 + 1.02 * cosRoll * sinLean - 0.09 * cosLean;
      head.rotation.x = lean - work * 0.045 + Math.sin(seconds * 0.7) * 0.025;
      head.rotation.y = focused ? (1 - work) * Math.sin(seconds * 0.55) * 0.27 : Math.sin(seconds * 0.38) * 0.075;
      head.rotation.z = roll + Math.sin(seconds * 0.41) * 0.016;
      if (work > 0 && writing) {
        hands[1].position.x += Math.sin(seconds * 3.9) * 0.055;
        hands[1].position.x = 0.21 + (hands[1].position.x - 0.21) * work;
        hands[1].position.z += Math.sin(seconds * 5.2) * 0.045 * work;
        hands[1].position.y += (0.5 + Math.sin(seconds * 5.2) * 0.5) * 0.012 * work;
        hands[1].rotation.y = Math.sin(seconds * 3.9) * 0.12 * work;
      } else if (work > 0) {
        for (let i = 0; i < hands.length; i++) {
          const rhythm = seconds * 10.4 + i * Math.PI;
          hands[i].position.y += (0.5 + Math.sin(rhythm) * 0.5) * 0.024 * work;
          hands[i].position.x += Math.sin(rhythm * 0.37) * 0.024 * work;
          hands[i].position.z += Math.cos(rhythm * 0.71) * 0.027 * work;
          hands[i].rotation.x = Math.sin(rhythm) * 0.12 * work;
        }
        // Occasionally slide the right hand from the keys to the trackpad.
        const trackpad = cycle > 4.3 && cycle < 5.9 ? Math.sin((cycle - 4.3) / 1.6 * Math.PI) ** 2 : 0;
        hands[1].position.x += (0.025 - hands[1].position.x) * trackpad;
        hands[1].position.z += (-0.76 - hands[1].position.z) * trackpad;
        hands[1].position.y += (1.37 - hands[1].position.y) * trackpad;
      }
      articulateUpper(lean, roll, breath, hands, false);
    });
    animations.push(createTeaSteam(result, writing ? [0.72, 1.445, -0.06] : [0.83, 1.465, -0.13], writing ? 0.9 : 1));
  }
  if (type === 'side-table') animations.push(createTeaSteam(result, [0.18, 0.846, 0.07], 0.72));
  // A frame's picture and a record's sleeve are separate small meshes, so the
  // room can give each one its chosen art.
  if (pictureSizes[type] || type === 'record-sleeve') {
    const [width, height] = pictureSizes[type] || [1.06, 1.06];
    // A sleeve and the easel's canvas are thin boxes, so their outline has a rim.
    // The canvas face shows the picture the right way up; its thin sides and back take its edge.
    const canvasFaces = [new Vector4(0, 1, 1, 0), ...Array(5).fill(new Vector4(0, 0, 0.02, 1))];
    const picture = type === 'record-sleeve' ? CreateBox('record-sleeve-art', { width, height, depth: 0.03 }, scene) : type === 'easel' ? CreateBox('easel-picture', { width, height, depth: 0.012, faceUV: canvasFaces }, scene) : CreatePlane('framed-picture', { width, height }, scene);
    picture.parent = result; picture.position.z = type === 'record-sleeve' ? 0.1375 : 0.14;
    picture.material = material(scene, type === 'record-sleeve' ? '#b4aecb' : C.paper); picture.receiveShadows = type === 'record-sleeve';
    picture.metadata = { picture: true, castShadow: type === 'record-sleeve' };
    // The easel's picture lies on its tilted canvas.
    if (type === 'easel') { const holder = group(result, EASEL_CANVAS.position); holder.rotation.x = EASEL_CANVAS.tilt; picture.parent = holder; picture.position.set(0, 0, 0.027); }
    result.metadata.picture = picture;
  }
  // A window's view sits behind its wall, inside the opening; the room gives
  // it the room's own view. It never casts a shadow into its own daylight.
  if (viewSizes[type]) {
    const [width, height] = viewSizes[type], view = CreatePlane('window-view', { width, height }, scene);
    view.parent = result; view.position.z = WINDOW_VIEW_DEPTH; view.material = material(scene, C.paper);
    view.metadata = { castShadow: false, size: [width, height], uvs: Array.from(view.getVerticesData('uv')) };
    result.metadata.view = view;
  }
  if (type === 'moon-clock') {
    // The hands keep the real local time; the room clock supplies seconds.
    const hands = group(result, [0, 0.39, 0.04]); hands.name = 'clock-movement';
    const hand = (name, points, radius, color) => { const node = group(hands); node.name = name; const part = rod(node, ...points, radius, color); part.metadata = { dynamic: true }; return node; };
    const hour = hand('clock-hour-hand', [[0, 0, 0.065], [0.13, 0.18, 0.065]], 0.014, '#503d30');
    const minute = hand('clock-minute-hand', [[0, 0, 0.075], [-0.25, 0.045, 0.075]], 0.012, '#503d30');
    const second = hand('clock-second-hand', [[0, -0.055, 0.085], [0, 0.30, 0.085]], 0.008, '#c8884d');
    const pendulum = group(hands, [0, -0.25, 0.07]); pendulum.name = 'clock-pendulum';
    rod(pendulum, [0, 0, 0], [0, -0.67, 0], 0.017, C.brass, { metalness: 0.45 }).metadata = { dynamic: true };
    const bob = cylinder(pendulum, 0.13, 0.13, 0.052, [0, -0.69, 0], C.brass, { metalness: 0.45, segments: 20 }); bob.rotation.x = Math.PI / 2; bob.metadata = { dynamic: true };
    // Rest angles, clockwise from twelve, of the hands as they are modeled.
    const rest = { hour: Math.atan2(0.13, 0.18), minute: Math.atan2(-0.25, 0.045), second: 0 };
    const localOffset = -new Date().getTimezoneOffset() * 60 + Date.now() / 1000 - performance.now() / 1000;
    animations.push((seconds, focused, reducedMotion) => {
      if (reducedMotion) { for (const node of [hour, minute, second, pendulum]) node.rotation.z = 0; return; }
      const time = (seconds + localOffset) % 43200, turn = Math.PI * 2;
      hour.rotation.z = -(time / 43200 * turn - rest.hour); minute.rotation.z = -(time % 3600 / 3600 * turn - rest.minute);
      second.rotation.z = -(Math.floor(time % 60) / 60 * turn - rest.second); pendulum.rotation.z = Math.sin(seconds * 2.8) * 0.17;
    });
  }
  if (type === 'bookcase') {
    if (!templates.has('tipping-book')) {
      const source = new TransformNode('book-source', scene); tippingBook(source);
      const template = batch(source); template.setEnabled(false); templates.set('tipping-book', template);
    }
    const hinge = group(result, [-0.39, 1.63, 0.225]); hinge.name = 'book-hinge';
    templates.get('tipping-book').clone('tipping-book', hinge).setEnabled(true);
    result.metadata.book = hinge;
  }
  if (type === 'fireplace') { animations.push(createDancingFire(result)); animations.push(createHearthEmbers(result)); }
  if (type === 'plant' || type === 'moon-tree' || type === 'monstera') animations.push(createSwayingCanopy(result, type));
  if (type === 'fish-tank') animations.push(createAquariumLife(result));
  if (type === 'tea-cart') animations.push(createTeaSteam(result, TEA_CART_SPOUT, 0.8));
  if (type === 'globe') {
    // The globe turns about its tilted axis; a tap spins it once.
    const axis = group(result, [0, 1.07, 0]); axis.rotation.z = GLOBE_TILT; axis.name = 'globe-axis';
    const globe = globeTemplate(scene).clone('painted-globe', axis); globe.setEnabled(true); globe.metadata = { dynamic: true };
    result.metadata.globe = globe;
  }
  if (type === 'low-cabinet') animations.push(createSpinningRecord(result));
  if (animations.length) result.metadata.animate = (seconds, focused, reducedMotion) => {
    for (const animate of animations) animate(seconds, focused, reducedMotion);
  };
  return result;
}

// Babylon reference-counts the cloned geometry. Ordinary instance.dispose() is
// safe; scene.dispose() releases every instance, cached template and material.
export function disposeFurnitureAssets(scene) {
  const cache = sceneCaches.get(scene);
  if (!cache) return;
  for (const value of cache.templates.values()) {
    if (value instanceof TransformNode) value.dispose(false, false);
    else Object.values(value).forEach(node => node.dispose(false, false));
  }
  for (const mat of [...cache.materials.values(), ...cache.batches.values()]) mat.dispose();
  sceneCaches.delete(scene);
}
