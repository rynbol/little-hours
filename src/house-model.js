import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { roomDesign } from './layout.js';
import { getFurniture } from './catalog.js';
import { surfaceChoices } from './surfaces.js';
import { tintsFor } from './tints.js';

// A deliberately small model of the actual saved rooms. Each room, the
// garden, and each building site are batched into one vertex-colored mesh.
// No detailed furniture rigs, textures, particles or shadows run here.
export const HOUSE_POSITIONS = { studio: [-2.55, 0, 0], garden: [2.55, 0, 0], loft: [-2.55, 2.95, -0.45] };
export function createHouseModel(scene, house, selectedId, theme = 'day') {
  const meshes = [], buckets = new Map();
  const material = new StandardMaterial('house-paint', scene);
  material.diffuseColor = Color3.White(); material.specularColor.setAll(0); material.emissiveColor.setAll(0.08);
  let bucket = 'grounds';
  let origin = [0, 0, 0], itemTransform = null;
  function paint(mesh, hex) {
    const data = VertexData.ExtractFromMesh(mesh);
    mesh.computeWorldMatrix(true); data.transform(mesh.getWorldMatrix()); mesh.dispose();
    if (itemTransform) data.transform(itemTransform);
    data.transform(Matrix.Translation(...origin));
    const c = Color3.FromHexString(hex); data.colors = [];
    for (let i = 0; i < data.positions.length / 3; i++) data.colors.push(c.r, c.g, c.b, 1);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(data);
  }
  function box(x, y, z, w, h, d, hex, tilt = 0) {
    const m = MeshBuilder.CreateBox('part', { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z); m.rotation.z = tilt; paint(m, hex);
  }
  function ball(x, y, z, w, h, d, hex) {
    const m = MeshBuilder.CreateSphere('part', { diameter: 1, segments: 4 }, scene);
    m.position.set(x, y, z); m.scaling.set(w, h, d); paint(m, hex);
  }
  function cylinder(x, y, z, top, bottom, h, hex) {
    const m = MeshBuilder.CreateCylinder('part', { diameterTop: top, diameterBottom: bottom, height: h, tessellation: 12 }, scene);
    m.position.set(x, y, z); paint(m, hex);
  }
  const wood = '#a77751', trim = '#654838', cream = '#eee0c3', leaf = '#789469';
  function plant(x, y, z, size = 1, blossom = false) {
    cylinder(x, y + 0.15 * size, z, .38 * size, .25 * size, .3 * size, '#b48265');
    box(x, y + .52 * size, z, .05 * size, .66 * size, .05 * size, trim);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      ball(x + Math.cos(a) * .19 * size, y + (.45 + i * .12) * size, z + Math.sin(a) * .18 * size, .46 * size, .25 * size, .37 * size, blossom ? ['#dcaeb5', '#eed0cc'][i % 2] : ['#718969', '#93a980'][i % 2]);
    }
  }
  function chair(x, z, seat = '#9ca58b') {
    box(x, .54, z, .7, .16, .7, seat); box(x, .91, z + .28, .7, .65, .12, seat);
    for (const dx of [-.26, .26]) for (const dz of [-.25, .25]) box(x + dx, .25, z + dz, .07, .5, .07, trim);
  }
  function furniture(item) {
    const f = getFurniture(item.type); if (!f) return;
    const tint = tintsFor(item.type)?.find(t => t.id === item.tint)?.swatch || f.color;
    if (f.mount === 'wall') {
      const side = item.wall === 'side';
      const x = side ? -2.34 : item.u * .43, z = side ? item.u * .43 : -1.82, y = item.v * .49;
      box(x, y, z, side ? .09 : f.size[0] * .43, f.size[1] * .43, side ? f.size[0] * .43 : .09, tint);
      if (f.opening) box(x + (side ? .06 : 0), y, z + (side ? 0 : .06), side ? .03 : f.size[0] * .33, f.size[1] * .33, side ? f.size[0] * .33 : .03, '#b6d0ca');
      return;
    }
    itemTransform = Matrix.Scaling(.43, .43, .43).multiply(Matrix.RotationY(item.rotation * Math.PI / 2)).multiply(Matrix.Translation(item.x * .43, .16, item.z * .43));
    const type = item.type;
    if (f.category === 'Rugs') {
      box(0, .015, 0, f.footprint[0], .035, f.footprint[1], tint);
      box(0, .035, 0, f.footprint[0] * .84, .015, f.footprint[1] * .78, '#e4d2ad');
    } else if (f.category === 'Study') {
      box(0, 1.28, -.28, 2.5, .16, 1.15, wood);
      for (const x of [-1.05, 1.05]) for (const z of [-.68, .12]) box(x, .66, z, .12, 1.25, .12, trim);
      box(0, 1.65, -.5, .87, .6, .07, '#515a50'); box(0, 1.65, -.45, .72, .46, .025, '#d7deb5');
      box(0, 1.38, -.14, .9, .045, .55, '#68726a'); chair(0, .78);
      cylinder(-.86, 1.72, -.45, .32, .5, .36, '#efcf90'); box(-.86, 1.5, -.45, .04, .35, .04, trim);
      if (house.activeId === bucket && item.id === house.rooms.find(r => r.id === bucket).layout.activeDeskId) {
        box(0, 1.08, .78, .45, .6, .34, '#bb927c'); ball(0, 1.62, .77, .46, .5, .45, '#634837');
      }
    } else if (type === 'bookcase') {
      box(0, 1.55, -.23, 1.8, 3.1, .15, wood);
      for (const x of [-.87, .87]) box(x, 1.55, 0, .12, 3.1, .58, wood);
      for (let row = 0; row < 5; row++) {
        box(0, row * .65 + .1, 0, 1.8, .1, .65, wood);
        for (let i = 0; i < 6 && row < 4; i++) box(-.66 + i * .26, row * .65 + .36, .02, .17, .42 + (i % 2) * .07, .38, ['#b97c66', '#849781', '#d2bc83', '#8398a5'][i % 4]);
      }
    } else if (['plant', 'monstera', 'moon-tree'].includes(type)) {
      plant(0, 0, 0, type === 'moon-tree' ? 2.7 : type === 'monstera' ? 1.75 : 1.2, roomDesign(house.rooms.find(r => r.id === bucket).layout).style === 'sakura');
    } else if (type === 'daybed') {
      box(0, .42, 0, 2.95, .4, 1.4, trim); box(0, .72, 0, 2.8, .25, 1.35, tint); box(0, 1.05, -.57, 2.95, .7, .2, tint);
      for (const x of [-1.38, 1.38]) box(x, .9, 0, .2, .8, 1.45, tint);
      box(-.8, .99, -.24, .6, .35, .55, '#c6bb97'); box(.8, .99, -.24, .6, .35, .55, '#d2a998');
    } else if (type === 'lounge-chair') { chair(0, 0, tint); }
    else if (type === 'fireplace') {
      box(0, 1.23, -.28, 2.45, 2.35, .5, '#ae987e'); box(0, .9, .02, 1.5, 1.5, .13, '#43362f');
      box(0, 2.4, 0, 2.7, .22, 1.0, wood); box(0, .12, 0, 2.7, .22, 1.1, '#cfbea1');
      if (!item.off) for (let i = 0; i < 3; i++) ball((i - 1) * .36, .65, .15, .25, .6 + (i % 2) * .3, .15, '#efb765');
    } else if (type === 'floor-lamp') {
      cylinder(0, .08, 0, .6, .6, .1, trim); box(0, 1, 0, .06, 1.85, .06, '#b4a076'); cylinder(0, 1.95, 0, .46, .72, .5, item.off ? cream : '#f1d6a2');
    } else if (['ottoman', 'bean-bag', 'pet-bed'].includes(type)) {
      ball(0, type === 'pet-bed' ? .12 : .35, 0, f.footprint[0], type === 'pet-bed' ? .24 : .7, f.footprint[1], tint);
      if (type === 'pet-bed' && house.activeId === bucket) ball(0, .32, 0, .68, .3, .45, '#c39b6c');
    } else if (type === 'globe') {
      cylinder(0, .12, 0, .62, .62, .15, trim); box(0, .5, 0, .1, .75, .1, wood); ball(0, 1.06, 0, .76, .76, .76, tint);
    } else if (type === 'fish-tank') {
      box(0, .4, 0, 1.65, .8, .77, wood); box(0, 1.1, 0, 1.6, .7, .74, '#84b8b6'); box(0, 1.48, 0, 1.7, .08, .8, trim);
      for (let i = 0; i < 3; i++) ball(-.5 + i * .45, 1.1, .4, .2, .1, .06, '#e2bd83');
    } else if (type === 'easel') {
      for (const x of [-.35, .35]) box(x, .75, 0, .07, 1.5, .07, wood);
      box(0, 1.5, 0, .88, 1.1, .12, cream); box(0, 1.48, .07, .68, .78, .03, '#8faaa0');
    } else if (type === 'side-table') {
      cylinder(0, .73, 0, .85, .85, .12, wood); box(0, .38, 0, .12, .65, .12, trim); cylinder(0, .87, 0, .16, .14, .17, cream);
    } else {
      box(0, f.height * .35, 0, f.footprint[0] * .85, f.height * .7, f.footprint[1] * .85, tint);
      box(0, f.height * .73, 0, f.footprint[0], .1, f.footprint[1], wood);
    }
    itemTransform = null;
  }
  // A landscaped plinth, porch and stepping stones make even one room a home.
  box(0, -.52, 0, 11.8, .48, 6.4, '#4e6250'); box(0, -.25, 0, 11.6, .15, 6.2, '#839475');
  box(-2.55, -.12, 2.12, 4.9, .18, .65, wood);
  for (let i = 0; i < 3; i++) box(-2.5, -.13, 2.5 + i * .28, .75, .12, .22, '#cdb995');
  for (const [x, z, s] of [[-5.2, -2.3, 1.5], [5.2, -2.3, 1.8], [5.15, 2.25, 1.1], [-5.15, 1.4, .9]]) plant(x, -.2, z, s);
  for (let i = 0; i < 13; i++) {
    const x = -5.2 + i * .86;
    box(x, .04, -2.86, .1, .58, .1, '#c6b99b');
  }
  box(0, .07, -2.86, 10.7, .07, .08, '#c6b99b'); box(0, .3, -2.86, 10.7, .07, .08, '#c6b99b');
  for (const entry of house.rooms) {
    bucket = entry.id; origin = HOUSE_POSITIONS[entry.id];
    const style = roomDesign(entry.layout).style || 'retreat';
    const walls = surfaceChoices(style, 'walls').find(s => s.id === (entry.layout.walls || ''))?.swatch || ['#80917d', '#c9bba2'];
    const floor = surfaceChoices(style, 'floor').find(s => s.id === (entry.layout.floor || ''))?.swatch || ['#92654a', '#a27352'];
    box(0, -.02, 0, 5, .3, 4.1, trim);
    for (let i = 0; i < 12; i++) box(0, .145, -1.76 + i * .32, 4.75, .035, .305, floor[i % 2]);
    // A central framed window; the front and right sides stay cut away.
    box(-1.76, 1.47, -1.92, 1.25, 2.65, .15, walls[0]); box(1.43, 1.47, -1.92, 1.9, 2.65, .15, walls[0]);
    box(-.5, .64, -1.92, 1.3, 1, .15, walls[0]); box(-.5, 2.58, -1.92, 1.3, .43, .15, walls[0]);
    box(-.5, 1.73, -1.99, 1.28, 1.18, .035, theme === 'dusk' ? '#efcf94' : '#a6c1b5');
    for (const x of [-1.17, .17, -.5]) box(x, 1.75, -1.8, .06, 1.35, .09, cream);
    for (const y of [1.08, 1.75, 2.42]) box(-.5, y, -1.8, 1.4, .06, .09, cream);
    box(-.5, 1.03, -1.68, 1.55, .09, .38, wood);
    if (entry.id === 'garden') {
      // A real doorway joins the wing to the studio at the front of the house.
      box(-2.4, 1.47, -.66, .16, 2.65, 2.68, walls[1]);
      box(-2.4, 1.47, 1.82, .16, 2.65, .36, walls[1]);
      box(-2.4, 2.51, 1.16, .16, .57, .97, walls[1]);
      for (const z of [.66, 1.65]) box(-2.29, 1.17, z, .11, 2.06, .1, wood);
      box(-2.29, 2.22, 1.16, .12, .11, 1.1, wood);
    } else box(-2.4, 1.47, 0, .16, 2.65, 4, walls[1]);
    for (const x of [-2.42, 2.42]) box(x, 1.48, -1.86, .14, 2.83, .2, trim);
    box(0, 2.84, -1.9, 4.98, .16, .25, trim); box(-2.4, 2.84, 0, .19, .16, 4, trim);
    box(-2.3, .4, 0, .06, .08, 3.9, cream); box(0, .4, -1.8, 4.65, .08, .06, cream);
    for (const item of [...entry.layout.items].sort((a, b) => (getFurniture(a.type)?.category === 'Rugs' ? -1 : 0) - (getFurniture(b.type)?.category === 'Rugs' ? -1 : 0))) furniture(item);
    // A small rear roof pitch preserves the dollhouse cutaway and silhouette.
    if (entry.id !== 'studio' || house.rooms.length === 1) {
      box(0, 3, -2.1, 5.15, .17, .8, '#526b65', -.02);
      box(1.55, 3.27, -2, .45, .68, .45, '#ae8b70'); box(1.55, 3.63, -2, .56, .12, .56, cream);
    }
    if (entry.id === selectedId) box(0, -.04, 2.08, 4.96, .075, .07, '#f0cf91');
  }
  if (house.rooms.length === 3) {
    bucket = 'loft'; origin = [0, 0, 0];
    // A little exterior stair connects the upper hideaway without taking
    // away any editable floor space inside the player's rooms.
    for (let i = 0; i < 12; i++) {
      const height = (i + 1) * .247;
      box(-5.32, height / 2, 1.85 - i * .25, .64, height, .26, i % 2 ? '#b58a5e' : '#a97c52');
    }
  }
  // Only the next extension is a building site. Future space is garden.
  if (house.rooms.length < 3) {
    bucket = house.rooms.length === 1 ? 'garden' : 'loft'; origin = HOUSE_POSITIONS[bucket];
    if (bucket === 'garden') {
      box(0, -.02, 0, 4.6, .12, 3.65, '#97a18b');
      for (let i = 0; i < 10; i++) for (const z of [-1.82, 1.82]) box(-2.15 + i * .48, .06, z, .26, .035, .04, '#e2d3af');
      for (let i = 0; i < 8; i++) for (const x of [-2.3, 2.3]) box(x, .06, -1.7 + i * .48, .04, .035, .26, '#e2d3af');
      box(0, .5, .1, .09, 1, .09, wood); box(0, 1.02, .1, 1.15, .65, .09, '#d8c4a1');
      box(0, 1.02, .17, .5, .06, .025, trim); box(0, 1.02, .17, .06, .42, .025, trim);
    } else {
      box(0, .05, -.3, 4.75, .13, 3.4, '#7e8e7b');
      box(0, .42, -.3, .08, .7, .08, wood); box(0, .85, -.3, 1.15, .6, .09, '#d8c4a1');
      box(0, .85, -.23, .5, .06, .025, trim); box(0, .85, -.23, .06, .4, .025, trim);
    }
  }
  for (const [id, parts] of buckets) {
    const data = parts.shift(); if (parts.length) data.merge(parts, true);
    const mesh = new Mesh(`house-${id}`, scene); data.applyToMesh(mesh); mesh.material = material;
    mesh.useVertexColors = true; mesh.metadata = { houseSlot: id === 'grounds' ? null : id }; mesh.isPickable = id !== 'grounds';
    mesh.freezeWorldMatrix(); meshes.push(mesh);
  }
  return { meshes, dispose() { meshes.forEach(m => m.dispose()); material.dispose(); } };
}
