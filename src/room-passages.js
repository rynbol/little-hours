import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { houseConnections } from './house.js';

// A walkable-looking porch stays outside editable floor space. The doorway
// and stair are real scene geometry and share the room's lights and camera.
export function createRoomPassages(scene, house) {
  const root = new TransformNode('house-passages', scene), meshes = [], doors = [], paint = new StandardMaterial('passage-paint', scene);
  paint.diffuseColor = Color3.White(); paint.specularColor.setAll(.03);
  let parts = [];
  function collect(m, hex) {
    m.computeWorldMatrix(true);
    const data = VertexData.ExtractFromMesh(m); data.transform(m.getWorldMatrix()); m.dispose(); data.uvs = null;
    const c = Color3.FromHexString(hex); data.colors = [];
    for (let i = 0; i < data.positions.length / 3; i++) data.colors.push(c.r, c.g, c.b, 1);
    parts.push(data);
  }
  function box(x, y, z, w, h, d, hex) {
    const m = MeshBuilder.CreateBox('porch-part', { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z); collect(m, hex);
  }
  function pebble(x, y, z, w, h, d, hex) {
    const m = MeshBuilder.CreateSphere('porch-soft-detail', { diameter: 2, segments: 10 }, scene);
    m.position.set(x, y, z); m.scaling.set(w, h, d); collect(m, hex);
  }
  function arch(x, y, z, radius, hex) {
    const path = Array.from({ length: 25 }, (_, i) => new Vector3(x, y + Math.sin(i / 24 * Math.PI) * radius, z + Math.cos(i / 24 * Math.PI) * radius));
    collect(MeshBuilder.CreateTube('door-arch', { path, radius: .075, tessellation: 10 }, scene), hex);
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
      box(7.75, 1.47 + rise, z + dz, .23, 2.52, .17, '#cfb58f');
      box(7.75, .3 + rise, z + dz, .32, .28, .28, '#e4d3b6');
    }
    arch(7.75, 2.72 + rise, z, .91, '#dfcbb0');
    arch(7.75, 2.72 + rise, z, .79, '#a98366');
    // A fanlight gives each destination a recognizable miniature silhouette.
    for (const dz of [-.43, 0, .43]) pebble(7.75, 3.04 + rise, z + dz, .04, .19, .15, link.upstairs ? '#c5b4d8' : '#b4c7ac');
    box(7.4, .25 + rise, z, .8, .1, 1.66, '#e1cdb1');
    box(6.95, .275 + rise, z + .15, .66, .025, 1.12, link.upstairs ? '#9c849c' : '#79927c');
    for (const dz of [-.31, .61]) box(6.95, .29 + rise, z + dz, .56, .012, .025, '#e1d1b1');
    // A warm lantern and a planter make the thresholds feel inhabited.
    box(7.72, 2.64 + rise, z + 1.15, .23, .39, .24, '#e9c890');
    box(7.72, 2.88 + rise, z + 1.15, .29, .06, .29, '#766046');
    box(6.45, .47, z + 1.14, .33, .48, .33, '#b27b5b');
    for (let n = 0; n < 5; n++) {
      pebble(6.42 + Math.sin(n * 2.4) * .14, .8 + n * .07, z + 1.14 + Math.cos(n * 2.4) * .13, .16, .11, .12, n % 2 ? '#9bae85' : '#738c6d');
      if (n > 2) pebble(6.42 + Math.sin(n * 2.4) * .14, .91 + n * .07, z + 1.14, .045, .05, .045, link.upstairs ? '#b5a0cb' : '#dfb5b0');
    }
    batch(`threshold-${link.id}`, link.id);
    const hinge = new TransformNode(`door-hinge-${link.id}`, scene); hinge.parent = root; hinge.position.set(7.75, .25 + rise, z - .8);
    const color = link.built ? (link.upstairs ? '#aa95b3' : '#91a78c') : '#a99a83';
    box(0, 1.32, .8, .12, 2.63, 1.56, color);
    // Dress both faces: the porch camera sees the inside of an open door.
    for (const face of [-1, 1]) {
      for (const dz of [.12, 1.48]) box(face * .08, 1.31, dz, .045, 2.48, .06, '#e4d3b7');
      for (const dy of [.13, 1.45, 2.51]) box(face * .08, dy, .8, .045, .06, 1.43, '#e4d3b7');
      box(face * .09, 1.96, .8, .035, .88, 1.24, link.built ? '#e9d5a9' : '#c1b49a');
      box(face * .115, 1.96, .8, .015, .88, .04, '#dfc498');
      box(face * .115, 1.96, .8, .015, .04, 1.24, '#dfc498');
      pebble(face * .15, 1.13, 1.34, .075, .052, .052, '#dcb778');
      box(face * .095, .78, .8, .025, .84, 1.06, link.upstairs ? '#918099' : '#7a9178');
      for (let petal = 0; petal < 5; petal++) {
        const a = petal / 5 * Math.PI * 2;
        pebble(face * .12, 1.97 + Math.sin(a) * .16, .8 + Math.cos(a) * .16, .018, .1, .07, link.upstairs ? '#b6a6c4' : '#a8b397');
      }
      pebble(face * .145, 1.97, .8, .025, .055, .055, '#f4e7c6');
    }
    if (!link.built) {
      box(.16, 1.1, .8, .065, .47, .62, '#dcc49b');
      box(.2, 1.1, .8, .035, .27, .055, '#806440'); box(.2, 1.1, .8, .035, .055, .27, '#806440');
    }
    batch(`door-${link.id}`, link.id, hinge);
    doors.push({ hinge, link, angle: link.built ? -.18 : 0 });
  }
  return {
    root, meshes, links,
    animate(dt, hovered, reducedMotion, lockedDoor, openingDoor) {
      for (const door of doors) {
        const avatarOpened = openingDoor === door.link.id;
        const pointerOpened = lockedDoor !== door.link.id && hovered === door.link.id;
        const target = door.link.built ? (avatarOpened ? -1.38 : pointerOpened ? -.62 : -.18) : 0;
        door.angle = reducedMotion ? target : door.angle + (target - door.angle) * Math.min(1, dt * 9);
        door.hinge.rotation.y = door.angle;
      }
    },
    dispose() { root.dispose(false, false); paint.dispose(); },
  };
}
