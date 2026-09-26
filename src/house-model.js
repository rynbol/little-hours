import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { boundsPoints } from './house-framing.js';
import { Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { roomDesign, rugStack, standHeight, FLOOR_Y } from './layout.js';
import { getFurniture } from './catalog.js';
import { surfaceChoices } from './surfaces.js';
import { houseFurniture, houseArchitecture } from './house-furniture.js';

// Reuse authored room geometry, batched per room. Only the occupied desk
// keeps its animated rig; window views retain their illustrated materials.
export const HOUSE_POSITIONS = { studio: [-2.55, 0, 0], garden: [2.55, 0, 0], loft: [-2.55, 2.95, -0.45] };
// Pass the previous model to rebuild only the batches whose inputs changed.
// Unchanged batches move to the new model, and the previous dispose() skips them.
export function createHouseModel(scene, house, selectedId, theme = 'day', avatar, previous = null) {
  const meshes = [], buckets = new Map(), live = [], shells = [], framing = [], pieces = new Map(), model = {};
  const shared = previous?.shared || {
    levels: Object.fromEntries(Object.keys(HOUSE_POSITIONS).map(id => [id, new TransformNode(`house-level-${id}`, scene)])),
    material: new StandardMaterial('house-paint', scene),
  };
  shared.owner = model;
  const { levels, material } = shared; let furnitureFloor = .16, rugs = [];
  material.diffuseColor = Color3.White(); material.specularColor.setAll(0); material.emissiveColor.setAll(0.08);
  let bucket = 'grounds', piece = null;
  let origin = [0, 0, 0];
  function batch(id, key, build, slot = id) {
    const old = previous?.pieces.get(id);
    if (old?.key === key) { old.owner = model; pieces.set(id, old); return; }
    bucket = id; origin = [0, 0, 0]; piece = { key, slot, owner: model, live: [], shells: [] }; pieces.set(id, piece);
    build();
  }
  function paint(mesh, hex) {
    const data = VertexData.ExtractFromMesh(mesh);
    mesh.computeWorldMatrix(true); data.transform(mesh.getWorldMatrix()); mesh.dispose();
    data.uvs = null;
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
  const wood = '#a77751', trim = '#654838', cream = '#eee0c3';
  function plant(x, y, z, size = 1, blossom = false) {
    cylinder(x, y + 0.15 * size, z, .38 * size, .25 * size, .3 * size, '#b48265');
    box(x, y + .52 * size, z, .05 * size, .66 * size, .05 * size, trim);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      ball(x + Math.cos(a) * .19 * size, y + (.45 + i * .12) * size, z + Math.sin(a) * .18 * size, .46 * size, .25 * size, .37 * size, blossom ? ['#dcaeb5', '#eed0cc'][i % 2] : ['#718969', '#93a980'][i % 2]);
    }
  }
  function furniture(item) {
    const entry = house.rooms.find(room => room.id === bucket);
    const rug = rugs.find(rug => rug.item.id === item.id);
    const itemFloor = furnitureFloor + ((rug?.y ?? standHeight(item, rugs)) - FLOOR_Y) * .43;
    const result = houseFurniture(scene, item, {
      style: roomDesign(entry.layout).style || 'retreat', origin, floor: itemFloor, rugScale: rug?.scale || 1,
      avatar, occupied: house.activeId === bucket && item.id === entry.layout.activeDeskId,
    });
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(...result.parts);
    if (result.live) { result.live.parent = levels[bucket]; piece.live.push(result.live); }
  }
  batch('grounds', String(house.rooms.length === 3), () => {
  // A landscaped plinth, porch and stepping stones make even one room a home.
  box(0, -.52, 0, 11.8, .48, 6.4, '#63765e'); box(0, -.25, 0, 11.6, .15, 6.2, '#a2af8a');
  box(-2.55, -.12, 2.12, 4.9, .18, .65, wood);
  for (let i = 0; i < 3; i++) box(-2.5, -.13, 2.5 + i * .28, .75, .12, .22, '#cdb995');
  for (const [x, z, s] of [[-5.2, -2.3, 1.5], [5.2, -2.3, 1.8], [5.15, 2.25, 1.1], [-5.15, 1.4, .9]]) plant(x, -.2, z, s, x > 0);
  // A hand-planted border: each flower stays in the static grounds batch.
  for (let i = 0; i < 32; i++) {
    const x = -4.85 + i * .31, z = 2.67 + Math.sin(i * 2.3) * .18;
    if (x > -3.1 && x < -1.9) continue;
    const y = -.1 + (i % 3) * .035;
    box(x, y, z, .025, .2, .025, '#6e855e');
    ball(x, y + .13, z, .16, .09, .16, ['#eac0b9', '#f5e4bd', '#c8b7d7'][i % 3]);
    ball(x + .065, y + .02, z, .14, .05, .075, '#839d6f');
  }
  // A low garden bench and two terracotta pots by the front path.
  box(1.2, .13, 2.66, 1.1, .08, .35, '#d1ae86');
  for (const x of [.8, 1.6]) box(x, -.03, 2.66, .08, .26, .27, '#8d6d53');
  plant(-3.32, -.17, 2.55, .52, true); plant(-1.63, -.17, 2.55, .46);
  for (let i = 0; i < 13; i++) {
    const x = -5.2 + i * .86;
    box(x, .04, -2.86, .1, .58, .1, '#c6b99b');
  }
  box(0, .07, -2.86, 10.7, .07, .08, '#c6b99b'); box(0, .3, -2.86, 10.7, .07, .08, '#c6b99b');
  if (house.rooms.length === 3) {
    // A little exterior stair connects the upper hideaway without taking
    // away any editable floor space inside the player's rooms.
    for (let i = 0; i < 12; i++) {
      const height = (i + 1) * .247;
      box(-5.32, height / 2, 1.85 - i * .25, .64, height, .26, i % 2 ? '#b58a5e' : '#a97c52');
    }
  }
  });
  for (const entry of house.rooms) batch(entry.id, JSON.stringify([entry.layout, theme, entry.id === house.activeId && avatar, house.rooms.length === 1]), () => {
    origin = HOUSE_POSITIONS[entry.id];
    const style = roomDesign(entry.layout).style || 'retreat';
    const walls = surfaceChoices(style, 'walls').find(s => s.id === (entry.layout.walls || ''))?.swatch || ['#80917d', '#c9bba2'];
    const floor = surfaceChoices(style, 'floor').find(s => s.id === (entry.layout.floor || ''))?.swatch || ['#92654a', '#a27352'];
    furnitureFloor = .16;
    if (style !== 'retreat') {
      const shell = houseArchitecture(scene, entry.layout, style, origin, theme, entry.id);
      shell.root.parent = levels[bucket]; piece.shells.push(shell); furnitureFloor = shell.floor;
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push(...shell.parts);
    } else {
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
    }
    rugs = rugStack(entry.layout.items);
    for (const item of [...entry.layout.items].sort((a, b) => (getFurniture(a.type)?.category === 'Rugs' ? -1 : 0) - (getFurniture(b.type)?.category === 'Rugs' ? -1 : 0))) furniture(item);
    // A small rear roof pitch preserves the dollhouse cutaway and silhouette.
    if (entry.id !== 'studio' || house.rooms.length === 1) {
      const roofY = style === 'retreat' ? 2.96 : 2.57;
      box(0, roofY, -2.1, 5.15, .17, .5, '#526b65', -.02);
      box(1.55, roofY + .27, -2, .45, .58, .45, '#ae8b70'); box(1.55, roofY + .6, -2, .56, .12, .56, cream);
    }
  });
  // The selected room's front edge is its own small batch, so choosing a room
  // never rebuilds the rooms themselves.
  if (house.rooms.some(entry => entry.id === selectedId)) batch('selection', selectedId, () => {
    origin = HOUSE_POSITIONS[selectedId];
    box(0, -.04, 2.08, 4.96, .075, .07, '#f0cf91');
  }, selectedId);
  // Only the next extension is a building site. Future space is garden.
  if (house.rooms.length < 3) batch(house.rooms.length === 1 ? 'garden' : 'loft', 'site', () => {
    origin = HOUSE_POSITIONS[bucket];
    if (bucket === 'garden') {
      box(0, -.02, 0, 4.6, .12, 3.65, '#97a18b');
      for (let i = 0; i < 10; i++) for (const z of [-1.82, 1.82]) box(-2.15 + i * .48, .06, z, .26, .035, .04, '#e2d3af');
      for (let i = 0; i < 8; i++) for (const x of [-2.3, 2.3]) box(x, .06, -1.7 + i * .48, .04, .035, .26, '#e2d3af');
      box(0, .5, .1, .09, 1, .09, wood); box(0, 1.02, .1, 1.15, .65, .09, '#d8c4a1');
      box(0, 1.02, .17, .5, .06, .025, trim); box(0, 1.02, .17, .06, .42, .025, trim);
    } else {
      // Put the upstairs plan beside the future stair, grounded in the garden.
      origin = [-5.38, 0, .65];
      box(0, .42, 0, .07, .84, .07, wood); box(0, .93, 0, .7, .48, .08, '#e2cfab');
      for (let i = 0; i < 3; i++) box(-.22 + i * .2, .84 + i * .05, .055, .13, .12 + i * .1, .035, '#8d9e83');
    }
  });
  for (const [id, parts] of buckets) {
    const target = pieces.get(id), slot = target.slot;
    target.framing = { points: boundsPoints(parts), offset: levels[slot]?.position };
    const data = parts.shift(); if (parts.length) data.merge(parts, true);
    const mesh = new Mesh(`house-${id}`, scene); data.applyToMesh(mesh); mesh.material = material;
    mesh.parent = levels[slot] || null; mesh.useVertexColors = true; mesh.metadata = { houseSlot: slot === 'grounds' ? null : slot }; mesh.isPickable = slot !== 'grounds';
    mesh.freezeWorldMatrix(); target.mesh = mesh;
  }
  for (const entry of pieces.values()) { meshes.push(entry.mesh); framing.push(entry.framing); live.push(...entry.live); shells.push(...entry.shells); }
  return Object.assign(model, { meshes, live, shells, framing, levels, shared, pieces,
    setOpenFloors(open, portrait = false) {
      // The upper floor opens like a dollhouse: beside the home on wide screens,
      // above it on a phone. Room layouts and saved positions never change.
      levels.loft.position.set(open * (portrait ? 0 : -5.45), open * (portrait ? 2.7 : -1.95), open * (portrait ? 0 : .45));
      levels.loft.computeWorldMatrix(true);
      for (const mesh of meshes) { mesh.unfreezeWorldMatrix(); mesh.computeWorldMatrix(true); mesh.freezeWorldMatrix(); }
    },
    animate(seconds, focused, reducedMotion) { for (const root of live) root.metadata.animate?.(seconds, focused, reducedMotion); },
    dispose() {
      for (const entry of pieces.values()) if (entry.owner === model) { entry.shells.forEach(shell => shell.dispose()); entry.live.forEach(root => root.dispose(false, false)); entry.mesh.dispose(); }
      if (shared.owner === model) { Object.values(levels).forEach(root => root.dispose()); material.dispose(); }
    } });
}
