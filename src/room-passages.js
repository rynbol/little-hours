import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { houseConnections } from './house.js';

// A walkable-looking porch stays outside editable floor space. The doorway
// and stair are real scene geometry and share the room's lights and camera.
export function createRoomPassages(scene, house) {
  const root = new TransformNode('house-passages', scene), meshes = [], doors = [], paint = new StandardMaterial('passage-paint', scene);
  paint.diffuseColor = Color3.White(); paint.specularColor.setAll(.03);
  let parts = [];
  function box(x, y, z, w, h, d, hex) {
    const m = MeshBuilder.CreateBox('porch-part', { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z); m.computeWorldMatrix(true);
    const data = VertexData.ExtractFromMesh(m); data.transform(m.getWorldMatrix()); m.dispose(); data.uvs = null;
    const c = Color3.FromHexString(hex); data.colors = [];
    for (let i = 0; i < data.positions.length / 3; i++) data.colors.push(c.r, c.g, c.b, 1);
    parts.push(data);
  }
  function batch(name, link = null, parent = root) {
    const data = parts.shift(); if (parts.length) data.merge(parts, true); parts = [];
    const mesh = new Mesh(name, scene); data.applyToMesh(mesh); mesh.material = paint; mesh.parent = parent;
    mesh.isPickable = Boolean(link); mesh.receiveShadows = true; mesh.metadata = { houseLink: link, castShadow: false };
    meshes.push(mesh); return mesh;
  }
  // Continuous floorboards connect the study to both destinations.
  box(7.02, -.03, .05, 2.18, .38, 8.65, '#594335');
  for (let i = 0; i < 22; i++) box(7.02, .18, -4.1 + i * .39, 2.14, .07, .375, i % 2 ? '#b38c66' : '#a57d56');
  for (const z of [-4.2, 4.2]) {
    for (const x of [6.12, 7, 7.9]) box(x, .78, z, .09, 1.2, .09, '#d3ba8f');
    box(7, 1.36, z, 1.9, .11, .13, '#b38a5e');
  }
  batch('connected-porch');
  const links = houseConnections(house).map((link, index) => ({ ...link, z: index === 0 ? 2.35 : -2.05 }));
  for (let i = 0; i < links.length; i++) {
    const link = links[i], z = link.z, rise = link.upstairs ? .95 : 0;
    if (rise) for (let n = 0; n < 5; n++) box(6.15 + n * .31, .22 + (n + 1) * .095, z, .34, (n + 1) * .19, 1.55, n % 2 ? '#af845b' : '#be9870');
    for (const dz of [-.91, .91]) {
      box(7.75, 1.62 + rise, z + dz, .23, 2.82, .17, '#b08a60');
      box(7.75, .3 + rise, z + dz, .32, .28, .28, '#e4d3b6');
    }
    box(7.75, 3.1 + rise, z, .27, .19, 2.04, '#d6bc91');
    box(7.75, 3.28 + rise, z, .23, .17, 1.8, '#b08a60');
    box(7.4, .25 + rise, z, .8, .1, 1.66, '#e1cdb1');
    // A warm lantern and a planter make the thresholds feel inhabited.
    box(7.72, 2.64 + rise, z + 1.15, .23, .39, .24, '#e9c890');
    box(7.72, 2.88 + rise, z + 1.15, .29, .06, .29, '#766046');
    box(6.45, .47, z + 1.14, .33, .48, .33, '#b27b5b');
    for (let n = 0; n < 4; n++) box(6.4 + (n % 2) * .15, .81 + n * .08, z + 1.14, .36, .14, .32, n % 2 ? '#8d9d73' : '#6d8560');
    batch(`threshold-${link.id}`, link.id);
    const hinge = new TransformNode(`door-hinge-${link.id}`, scene); hinge.parent = root; hinge.position.set(7.75, .25 + rise, z - .8);
    const color = link.built ? (link.upstairs ? '#a99ab4' : '#8fa18b') : '#756650';
    box(0, 1.32, .8, .12, 2.63, 1.56, color);
    for (const dz of [.12, 1.48]) box(.08, 1.31, dz, .045, 2.48, .06, '#d9c3a1');
    for (const dy of [.13, 1.45, 2.51]) box(.08, dy, .8, .045, .06, 1.43, '#d9c3a1');
    box(.09, 1.96, .8, .035, .88, 1.24, link.built ? '#e0cd99' : '#9b947d');
    box(.15, 1.13, 1.34, .12, .11, .11, '#dcb778');
    if (!link.built) {
      box(.16, 1.1, .8, .065, .47, .62, '#dcc49b');
      box(.2, 1.1, .8, .035, .27, .055, '#806440'); box(.2, 1.1, .8, .035, .055, .27, '#806440');
    }
    batch(`door-${link.id}`, link.id, hinge);
    doors.push({ hinge, link, angle: link.built ? -.18 : 0 });
  }
  return {
    root, meshes, links,
    animate(dt, hovered, reducedMotion) {
      for (const door of doors) {
        const target = door.link.built ? (hovered === door.link.id ? -.82 : -.18) : 0;
        door.angle = reducedMotion ? target : door.angle + (target - door.angle) * Math.min(1, dt * 9);
        door.hinge.rotation.y = door.angle;
      }
    },
    dispose() { root.dispose(false, false); paint.dispose(); },
  };
}
