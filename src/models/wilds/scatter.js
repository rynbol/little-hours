import { Color, ConeGeometry, CapsuleGeometry, CylinderGeometry, DodecahedronGeometry, InstancedMesh, Matrix4, OctahedronGeometry, Quaternion, SphereGeometry, Vector3 } from 'three';
import { noise2 } from '../../core/world-terrain.js';
import { VALLEY, WATER, lakeEdge, nearPath, trailDistance, waterAt } from '../../core/wilds/valley.js';
import { part, merge } from './shapes.js';
import { addSway } from './trees.js';

const BLOOMS = Object.freeze(['#fff7ea', '#ffd75e', '#c9a7ff', '#ff9fb6', '#fff7ea', '#9fd0ff']);
const TINT = Object.freeze({ reed: '#7f9a4a', cattail: '#6b4a32', herb: '#4f8a3c', herbLight: '#7fb653', bloom: '#f4f0ff', bloomHeart: '#ffd76a', rock: '#a59a88', rockMoss: '#6f8f45' });
const matrix = new Matrix4(), turn = new Quaternion(), up = new Vector3(0, 1, 0), at = new Vector3(), size = new Vector3(), tint = new Color();

function reedGeometry() {
  return merge([
    ...[[0, 0, 1.5, 0], [0.12, 0.05, 1.25, 0.9], [-0.1, 0.08, 1.35, 2.1], [0.05, -0.12, 1.1, 3.4], [-0.06, -0.08, 1.6, 4.4]].map(([x, z, h, a]) => part(new ConeGeometry(0.035, h, 3), TINT.reed, { position: [x, h / 2, z], rotation: [Math.sin(a) * 0.12, a, Math.cos(a) * 0.12], shade: (_, y) => 0.75 + y * 0.25 })),
    part(new CapsuleGeometry(0.035, 0.18, 2, 5), TINT.cattail, { position: [0.12, 1.3, 0.05] }),
    part(new CapsuleGeometry(0.03, 0.15, 2, 5), TINT.cattail, { position: [-0.06, 1.45, -0.08] }),
  ]);
}

function herbGeometry() {
  return merge([
    ...Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2; return part(new SphereGeometry(0.11, 6, 4), i % 2 ? TINT.herb : TINT.herbLight, { position: [Math.sin(a) * 0.12, 0.08, Math.cos(a) * 0.12], scale: [0.6, 0.25, 1.4], rotation: [0.4, a, 0] }); }),
    part(new CylinderGeometry(0.012, 0.015, 0.32, 4), TINT.herb, { position: [0, 0.16, 0] }),
    ...[[0, 0.34, 0], [0.06, 0.28, 0.04], [-0.05, 0.3, -0.04]].map(([x, y, z]) => part(new SphereGeometry(0.045, 6, 4), TINT.bloom, { position: [x, y, z] })),
    part(new SphereGeometry(0.02, 5, 3), TINT.bloomHeart, { position: [0, 0.37, 0] }),
  ]);
}

function flowerGeometry() {
  const heads = [[0, 0.3, 0], [0.16, 0.22, 0.08], [-0.12, 0.26, 0.12], [0.05, 0.2, -0.16], [-0.14, 0.18, -0.07]];
  return {
    stems: merge([
      ...heads.map(([x, y, z], i) => part(new ConeGeometry(0.012, y, 3), TINT.herb, { position: [x * 0.6, y / 2, z * 0.6], rotation: [z * 0.8, i, -x * 0.8] })),
      ...[0, 1, 2].map(i => part(new SphereGeometry(0.09, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), TINT.herbLight, { position: [Math.sin(i * 2.1) * 0.1, 0, Math.cos(i * 2.1) * 0.1], scale: [1.3, 0.5, 0.7], rotation: [0, i * 2.1, 0] })),
    ]),
    heads: merge(heads.map(([x, y, z]) => part(new OctahedronGeometry(0.055, 0), '#ffffff', { position: [x, y, z], scale: [1, 0.55, 1] }))),
  };
}

export function flowerSpots(ground, trees) {
  const spots = [], tilt = (x, z) => Math.hypot(ground(x + 0.6, z) - ground(x - 0.6, z), ground(x, z + 0.6) - ground(x, z - 0.6)) / 1.2;
  for (let x = -150; x <= 150; x += 2.1) for (let z = -360; z <= 60; z += 2.1) {
    const jx = x + (noise2(x * 1.3, z * 1.1, 181) - 0.5) * 2.4, jz = z + (noise2(z * 1.2, x * 1.4, 182) - 0.5) * 2.4;
    if (noise2(jx / 17, jz / 17, 183) < 0.5 || trailDistance(jx, jz) < 1.8 || lakeEdge(jx, jz) < 4 || waterAt(jx, jz) > ground(jx, jz) - 0.3 || tilt(jx, jz) > 0.45) continue;
    if (Math.hypot(jx - VALLEY.campfires[0].x, jz - VALLEY.campfires[0].z) < 6 || trees.some(tree => Math.abs(tree.x - jx) < 1.2 && Math.abs(tree.z - jz) < 1.2)) continue;
    spots.push([jx, jz, Math.floor(noise2(jx / 9, jz / 9, 184) * BLOOMS.length * 0.999)]);
  }
  return spots;
}

function boulderGeometry() {
  return merge([
    part(new DodecahedronGeometry(1, 1), TINT.rock, { scale: [1.2, 0.7, 1], shade: (x, y, z) => 0.82 + 0.16 * Math.sin(x * 2.3 + z * 1.9) + (y > 0.45 ? 0.08 : 0) }),
    part(new SphereGeometry(0.75, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), TINT.rockMoss, { position: [0.1, 0.42, 0], scale: [1.2, 0.35, 1] }),
  ]);
}

function instanced(geometry, material, spots, name, place) {
  const mesh = new InstancedMesh(geometry, material, spots.length);
  spots.forEach((spot, i) => { place(spot, i); mesh.setMatrixAt(i, matrix); });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

export function reedSpots(ground) {
  const spots = [];
  for (let x = -60; x <= 70; x += 1.3) for (let z = -300; z <= -100; z += 1.3) {
    const jx = x + (noise2(x * 2.1, z * 2.1, 161) - 0.5) * 1.6, jz = z + (noise2(x * 1.9, z * 2.3, 162) - 0.5) * 1.6;
    const edge = lakeEdge(jx, jz), bed = ground(jx, jz), brook = nearPath(jx, jz, VALLEY.brook)[0];
    const shallows = edge > -3 && edge < 0.6 && bed > WATER - 0.7, bank = brook > 2.6 && brook < 4.4 && bed < waterAt(jx, jz) + 0.4;
    if ((shallows || bank) && noise2(jx / 7, jz / 7, 163) > 0.36 && trailDistance(jx, jz) > 3) spots.push([jx, jz]);
  }
  return spots;
}

export function boulderSpots(ground, trees) {
  const spots = [];
  for (let x = -150; x <= 160; x += 9) for (let z = -400; z <= 70; z += 9) {
    const jx = x + (noise2(x, z, 171) - 0.5) * 8, jz = z + (noise2(z, x, 172) - 0.5) * 8;
    if (noise2(jx / 23, jz / 23, 173) < 0.5 || trailDistance(jx, jz) < 4 || lakeEdge(jx, jz) < 2 || waterAt(jx, jz) > ground(jx, jz) - 0.5) continue;
    if (Math.hypot(jx - VALLEY.camp.x, jz - VALLEY.camp.z) < VALLEY.camp.flat + 4 || Math.hypot(jx - VALLEY.ring.x, jz - VALLEY.ring.z) < VALLEY.ring.radius + 4) continue;
    if (trees.some(tree => Math.abs(tree.x - jx) < 2 && Math.abs(tree.z - jz) < 2)) continue;
    spots.push([jx, jz, 0.5 + noise2(jx * 3, jz * 3, 174) * 1.4]);
  }
  return spots;
}

export function buildScatter(sim, painterly, wind) {
  const { ground } = sim, material = painterly.material('#ffffff', { vertexColors: true }), reedMaterial = addSway(painterly.material('#ffffff', { vertexColors: true }), wind, { from: 0.2, amount: 0.05, key: 'wilds-reeds' });
  const reeds = instanced(reedGeometry(), reedMaterial, reedSpots(ground), 'wilds-reeds', ([x, z]) => {
    const s = 0.75 + noise2(x * 4, z * 4, 164) * 0.6;
    turn.setFromAxisAngle(up, noise2(x * 3, z * 5, 165) * 6.3);
    matrix.compose(at.set(x, ground(x, z) - 0.1, z), turn, size.set(s, s * (0.8 + noise2(x * 7, z * 7, 166) * 0.5), s));
  });
  const boulders = instanced(boulderGeometry(), material, boulderSpots(ground, sim.trees), 'wilds-boulders', ([x, z, s]) => {
    turn.setFromAxisAngle(up, noise2(x * 3, z * 3, 175) * 6.3);
    matrix.compose(at.set(x, ground(x, z) - s * 0.25, z), turn, size.set(s, s, s));
  });
  boulders.castShadow = true;
  const meadow = flowerSpots(ground, sim.trees), flower = flowerGeometry(), placeFlower = ([x, z], i) => {
    const s = 0.8 + noise2(x * 5, z * 5, 185) * 0.6;
    turn.setFromAxisAngle(up, i * 2.39);
    matrix.compose(at.set(x, ground(x, z) - 0.02, z), turn, size.setScalar(s));
  };
  const stems = instanced(flower.stems, material, meadow, 'wilds-flower-stems', placeFlower);
  const blooms = instanced(flower.heads, painterly.material('#ffffff', { vertexColors: true, glow: { value: 0.16 }, rim: false }), meadow, 'wilds-flowers', placeFlower);
  const placeHerb = (herb, i) => {
    turn.setFromAxisAngle(up, i * 2.4);
    matrix.compose(at.set(herb.x, herb.y, herb.z), turn, size.setScalar(herb.picked ? 0 : 1.4));
  };
  const herbs = instanced(herbGeometry(), painterly.material('#ffffff', { vertexColors: true, glow: { value: 0.18 } }), sim.herbs, 'wilds-herbs', placeHerb);
  let picked = 0;
  for (let i = 0; i < reeds.count; i++) { reeds.setColorAt(i, tint.setRGB(1, 1, 1).offsetHSL(0, 0, (noise2(i * 0.37, 1, 167) - 0.5) * 0.12)); }
  meadow.forEach(([, , bloom], i) => blooms.setColorAt(i, tint.set(BLOOMS[bloom])));
  return {
    meshes: [reeds, boulders, herbs, stems, blooms],
    flowers: meadow,
    update() {
      const now = sim.herbs.reduce((sum, herb) => sum + (herb.picked ? 1 : 0), 0);
      if (now === picked) return;
      picked = now;
      sim.herbs.forEach((herb, i) => { placeHerb(herb, i); herbs.setMatrixAt(i, matrix); });
      herbs.instanceMatrix.needsUpdate = true;
    },
  };
}
