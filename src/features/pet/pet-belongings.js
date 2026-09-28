import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { PET_BELONGINGS, PET_FOODS } from '../../core/pet-care.js';

function geometry() {
  const positions = [], normals = [], colors = [], indices = [];
  return {
    add(data, scale, at, hex) {
      const offset = positions.length / 3, color = Color3.FromHexString(hex);
      for (let i = 0; i < data.positions.length; i += 3) {
        positions.push(data.positions[i] * scale[0] + at[0], data.positions[i + 1] * scale[1] + at[1], data.positions[i + 2] * scale[2] + at[2]);
        const nx = data.normals[i] / scale[0], ny = data.normals[i + 1] / scale[1], nz = data.normals[i + 2] / scale[2], length = Math.hypot(nx, ny, nz);
        normals.push(nx / length, ny / length, nz / length); colors.push(color.r, color.g, color.b, 1);
      }
      for (const i of data.indices) indices.push(offset + i);
    },
    data() { return Object.assign(new VertexData(), { positions, normals, colors, indices }); },
  };
}
function cloth(fabric) {
  const data = new VertexData(); data.positions = []; data.indices = []; data.colors = []; data.normals = [];
  const base = Color3.FromHexString(fabric.color), light = Color3.Lerp(base, Color3.FromHexString('#fff9eb'), .42);
  for (let x = 0; x < 12; x++) for (let z = 0; z < 10; z++) {
    const color = (x % 3 === 0) !== (z % 3 === 0) ? light : base, first = data.positions.length / 3;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const px = (x + dx) / 12, pz = (z + dz) / 10;
      data.positions.push((px - .5) * .78, .101 + Math.sin(px * Math.PI) * .005 - Math.max(0, pz - .7) * .2 + Math.sin(px * 28) * Math.max(0, pz - .7) * .013, (pz - .5) * .55 + .13);
      data.colors.push(color.r, color.g, color.b, 1);
    }
    data.indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
  }
  VertexData.ComputeNormals(data.positions, data.indices, data.normals);
  return data;
}
export function createPetBelongings(scene, parent) {
  const material = new StandardMaterial('pet-ceramic-and-cloth', scene);
  material.diffuseColor = Color3.White(); material.specularColor = new Color3(.08, .07, .06); material.backFaceCulling = false;
  const make = name => {
    const mesh = new Mesh(name, scene); mesh.parent = parent; mesh.material = material; mesh.useVertexColors = true; mesh.hasVertexAlpha = false; mesh.isPickable = false; mesh.receiveShadows = false;
    mesh.metadata = { castShadow: false }; return mesh;
  };
  const blanket = make('pet-blanket'), bowl = make('pet-bowl'), food = make('pet-meal'), toy = make('pet-play-ball');
  const cylinder = CreateCylinderVertexData({ height: 1, diameterTop: 1, diameterBottom: .8, tessellation: 28 });
  const sphere = CreateSphereVertexData({ diameter: 2, segments: 8 });
  let signature = '', currentFabric = 'linen';
  function setStyle(care, species) {
    const key = `${care.fabric}:${care.food}:${species}`;
    if (key === signature) return; signature = key; currentFabric = care.fabric;
    const fabric = PET_BELONGINGS.find(item => item.id === care.fabric) || PET_BELONGINGS[0], meal = PET_FOODS[species].find(item => item.id === care.food);
    cloth(fabric).applyToMesh(blanket);
    const dish = geometry();
    dish.add(cylinder, [.48, .115, .48], [0, .06, 0], fabric.color);
    dish.add(cylinder, [.45, .019, .45], [0, .125, 0], '#fff0d9');
    dish.add(cylinder, [.37, .02, .37], [0, .13, 0], fabric.dark);
    dish.add(sphere, [.027, .023, .008], [0, .068, .226], '#fff5e5');
    dish.data().applyToMesh(bowl);
    const supper = geometry();
    for (let i = 0; i < 11; i++) {
      const angle = i * 2.4, radius = Math.sqrt(i / 11) * .135;
      supper.add(sphere, [care.food === 'supper' ? .053 : .035, .022, .028], [Math.cos(angle) * radius, .15 + i % 2 * .009, Math.sin(angle) * radius], meal.color);
    }
    supper.data().applyToMesh(food);
    const ball = geometry(); ball.add(sphere, [.105, .105, .105], [0, .105, 0], fabric.dark);
    ball.add(sphere, [.108, .026, .108], [0, .105, 0], fabric.color); ball.data().applyToMesh(toy);
  }
  function update(pose, bed, dining, bedY, floorY, reducedMotion, editing) {
    blanket.setEnabled(Boolean(bed));
    if (bed) { blanket.position.set(bed.x, bedY, bed.z); blanket.rotation.y = bed.rotation * Math.PI / 2; }
    const care = pose.care, at = care?.prop || dining?.prop;
    bowl.setEnabled(Boolean(at) && (!care || care.kind === 'treat') && !editing);
    food.setEnabled(Boolean(care?.kind === 'treat' && care.phase !== 'content') && !editing);
    toy.setEnabled(Boolean(care?.kind === 'play' || care?.kind === 'dance') && !editing);
    if (!at) return;
    bowl.position.set(at.x, floorY, at.z); food.position.copyFrom(bowl.position);
    if (food.isEnabled()) { const amount = care.phase === 'active' ? Math.max(.08, 1 - care.age / 5) : 1; food.scaling.setAll(amount); }
    if (toy.isEnabled()) {
      const active = care.phase === 'active', t = reducedMotion ? 0 : care.age, side = active ? Math.sin(t * 2.4) * .27 : 0;
      toy.position.set(at.x + side, floorY + (active && !reducedMotion ? Math.abs(Math.sin(t * 3.1)) * .08 : 0), at.z);
      toy.rotation.z = -side * 7;
    }
  }
  return { blanket, bowl, food, toy, get fabric() { return currentFabric; }, setStyle, update, dispose() { for (const mesh of [blanket, bowl, food, toy]) mesh.dispose(); material.dispose(); } };
}
