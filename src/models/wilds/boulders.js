import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateIcoSphereVertexData } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';

export const WILDS_BOULDERS = Object.freeze({
  center: Object.freeze({ x: -112, z: -192 }), radius: 105, cell: 7, chance: .34,
  pathClearance: 3.2, spawnClearance: 9, treeClearance: .9, arenaClearance: 26, maxSlope: .3,
  stone: '#aaac9e', stoneDark: '#7d8278', moss: '#7d9c44', mossLight: '#9cb856',
});

const hash = (x, z, salt) => { const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453; return value - Math.floor(value); };

export function trailOffset(x, z) {
  const ahead = -z, center = -3 - ahead * .6 + Math.sin(ahead / 13) * 3 + Math.sin(ahead / 37 + 2) * 3;
  return Math.abs(x - center) + (ahead < 8 || ahead > 260 ? 99 : 0);
}

export function placeWildsBoulders({ surfaceAt, trees = { count: 0 }, spawn, arena, settings = WILDS_BOULDERS }) {
  const { center, radius, cell } = settings, boulders = [];
  for (let gx = Math.floor((center.x - radius) / cell); gx <= Math.ceil((center.x + radius) / cell); gx++) {
    for (let gz = Math.floor((center.z - radius) / cell); gz <= Math.ceil((center.z + radius) / cell); gz++) {
      if (hash(gx, gz, 1) > settings.chance) continue;
      const x = (gx + .15 + hash(gx, gz, 2) * .7) * cell, z = (gz + .15 + hash(gx, gz, 3) * .7) * cell;
      if ((x - center.x) ** 2 + (z - center.z) ** 2 > radius ** 2) continue;
      const size = .8 + hash(gx, gz, 4) ** 2 * 1.8;
      if (trailOffset(x, z) < settings.pathClearance + size) continue;
      if (spawn && Math.hypot(x - spawn.x, z - spawn.z) < settings.spawnClearance) continue;
      if (arena && Math.hypot(x - arena.center.x, z - arena.center.z) < settings.arenaClearance) continue;
      let crowded = false;
      for (let i = 0; i < trees.count && !crowded; i++) crowded = Math.hypot(x - trees.x[i], z - trees.z[i]) < trees.width[i] * .5 + size + settings.treeClearance;
      if (crowded) continue;
      const ground = surfaceAt(x, z);
      if (!ground || ground.normal.y < 1 - settings.maxSlope) continue;
      const height = size * (.78 + hash(gx, gz, 5) * .32);
      boulders.push({ x, z, y: ground.height - height * .2, yaw: hash(gx, gz, 6) * Math.PI * 2, radius: size, height, stretch: .8 + hash(gx, gz, 7) * .45 });
    }
  }
  return boulders;
}

function boulderGeometry(settings) {
  const shape = CreateIcoSphereVertexData({ radius: 1, subdivisions: 3, flat: false });
  const positions = Array.from(shape.positions), colors = [];
  const stone = Color3.FromHexString(settings.stone), dark = Color3.FromHexString(settings.stoneDark), moss = Color3.FromHexString(settings.moss), mossLight = Color3.FromHexString(settings.mossLight);
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = positions.slice(i, i + 3);
    const lump = 1 + .13 * Math.sin(x * 3.1 + z * 1.7) * Math.cos(y * 2.3 - x) + .07 * Math.sin(z * 6.3 + y * 4.1);
    const flatBase = y < -.35 ? .35 / -y * .6 + .4 : 1;
    positions[i] = x * lump; positions[i + 1] = y * lump * flatBase; positions[i + 2] = z * lump;
  }
  const normals = [];
  VertexData.ComputeNormals(positions, shape.indices, normals);
  for (let i = 0; i < positions.length; i += 3) {
    const up = normals[i + 1], speckle = .5 + .5 * Math.sin(positions[i] * 9.7 + positions[i + 2] * 7.3);
    const rock = Color3.Lerp(dark, stone, Math.min(1, Math.max(0, .45 + up * .6)));
    const grown = Math.min(1, Math.max(0, (up - .62) / .22 + (speckle - .5) * .6));
    const color = Color3.Lerp(rock, Color3.Lerp(moss, mossLight, speckle), grown);
    colors.push(color.r, color.g, color.b, 1);
  }
  return Object.assign(new VertexData(), { positions, normals, indices: shape.indices, colors });
}

export function createWildsBoulders(scene, { root, boulders, settings = WILDS_BOULDERS }) {
  const paint = new StandardMaterial('wilds-boulder-paint', scene);
  paint.specularColor.set(0, 0, 0);
  paint.emissiveColor.set(.16, .17, .2);
  const mesh = new Mesh('wilds-boulders', scene);
  mesh.material = paint;
  boulderGeometry(settings).applyToMesh(mesh);
  mesh.parent = root;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  const matrices = new Float32Array(boulders.length * 16), matrix = new Matrix(), turn = new Quaternion();
  boulders.forEach((boulder, index) => {
    Quaternion.FromEulerAnglesToRef(0, boulder.yaw, 0, turn);
    Matrix.ComposeToRef(new Vector3(boulder.radius * boulder.stretch, boulder.height, boulder.radius), turn, new Vector3(boulder.x, boulder.y, boulder.z), matrix);
    matrix.copyToArray(matrices, index * 16);
  });
  mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
  mesh.alwaysSelectAsActiveMesh = true;
  return {
    mesh, placed: boulders, count: boulders.length,
    dispose() { mesh.dispose(); paint.dispose(); },
  };
}
