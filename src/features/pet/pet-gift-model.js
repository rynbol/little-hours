import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';

export function petGiftGeometry(id) {
  const positions = [], normals = [], colors = [], indices = [];
  const sphere = CreateSphereVertexData({ diameter: 2, segments: 10 });
  const cylinder = CreateCylinderVertexData({ diameterTop: 2, diameterBottom: 2, height: 1, tessellation: 20 });
  function add(data, scale, at, hex, rotation = [0, 0, 0]) {
    const offset = positions.length / 3, color = Color3.FromHexString(hex);
    const q = Quaternion.RotationYawPitchRoll(rotation[1], rotation[0], rotation[2]), v = new Vector3(), n = new Vector3();
    for (let i = 0; i < data.positions.length; i += 3) {
      v.set(data.positions[i] * scale[0], data.positions[i + 1] * scale[1], data.positions[i + 2] * scale[2]); v.rotateByQuaternionToRef(q, v);
      positions.push(v.x + at[0], v.y + at[1], v.z + at[2]);
      n.set(data.normals[i] / scale[0], data.normals[i + 1] / scale[1], data.normals[i + 2] / scale[2]); n.normalize().rotateByQuaternionToRef(q, n);
      normals.push(n.x, n.y, n.z); colors.push(color.r, color.g, color.b, 1);
    }
    for (const index of data.indices) indices.push(offset + index);
  }
  if (id === 'daisy') {
    add(sphere, [.095, .1, .095], [0, .1, 0], '#b1b4c8');
    add(cylinder, [.06, .08, .06], [0, .185, 0], '#a2a6bc');
    add(cylinder, [.013, .32, .013], [.015, .35, 0], '#738f66', [0, 0, -.09]);
    add(sphere, [.061, .015, .028], [-.029, .32, 0], '#94aa79', [0, 0, -.6]);
    add(sphere, [.053, .013, .024], [.063, .4, 0], '#718e62', [0, 0, .65]);
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2;
      add(sphere, [.032, .062, .016], [.03 + Math.sin(angle) * .048, .535 + Math.cos(angle) * .048, -.004], i % 2 ? '#fff1d7' : '#f3dfb8', [0, 0, -angle]);
    }
    add(sphere, [.032, .032, .023], [.03, .535, -.02], '#d3a254');
  } else if (id === 'star') {
    add(sphere, [.12, .035, .075], [0, .035, 0], '#c29676');
    add(cylinder, [.009, .2, .009], [0, .13, 0], '#b68d59');
    const data = { positions: [], indices: [], normals: [] };
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, b = (i + 1) / 10 * Math.PI * 2, ra = i % 2 ? .085 : .18, rb = i % 2 ? .18 : .085;
      const start = data.positions.length / 3;
      data.positions.push(0, .35, -.047, Math.sin(a) * ra, .35 + Math.cos(a) * ra, 0, Math.sin(b) * rb, .35 + Math.cos(b) * rb, 0);
      data.indices.push(start, start + 2, start + 1);
    }
    VertexData.ComputeNormals(data.positions, data.indices, data.normals); add(data, [1, 1, 1], [0, 0, 0], '#ddb1b2');
  } else if (id === 'moon') {
    add(sphere, [.16, .04, .105], [0, .04, 0], '#b6a3b7');
    const data = { positions: [], indices: [], normals: [] };
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, angle = Math.PI / 3 + t * Math.PI * 4 / 3;
      const outer = [.19 * Math.cos(angle), .32 + .19 * Math.sin(angle)], inner = [.095 - .135 * Math.sin(t * Math.PI), .32 + .16455 * Math.cos(t * Math.PI)];
      for (const z of [-.04, .04]) data.positions.push(outer[0], outer[1], z, inner[0], inner[1], z);
      if (i < 32) {
        const k = i * 4;
        data.indices.push(k, k + 4, k + 1, k + 1, k + 4, k + 5, k + 2, k + 3, k + 6, k + 3, k + 7, k + 6, k, k + 2, k + 4, k + 2, k + 6, k + 4, k + 1, k + 5, k + 3, k + 3, k + 5, k + 7);
      }
    }
    VertexData.ComputeNormals(data.positions, data.indices, data.normals); add(data, [1, 1, 1], [0, -.1, 0], '#f4d89c');
  }
  return Object.assign(new VertexData(), { positions, normals, colors, indices });
}

export function createPetGift(scene, parent) {
  const mesh = new Mesh('pet-focus-gift', scene), material = new StandardMaterial('pet-gift-ceramic', scene);
  material.diffuseColor = Color3.White(); material.specularColor = new Color3(.08, .07, .06); material.backFaceCulling = false;
  mesh.material = material; mesh.parent = parent; mesh.useVertexColors = true; mesh.isPickable = false; mesh.metadata = { castShadow: false }; mesh.setEnabled(false);
  let selected = null;
  return {
    mesh, get selected() { return selected; },
    select(id) { if (selected === id) return; selected = ['daisy', 'star', 'moon'].includes(id) ? id : null; if (selected) petGiftGeometry(selected).applyToMesh(mesh); mesh.setEnabled(Boolean(selected)); material.emissiveColor = selected === 'moon' ? new Color3(.25, .18, .07) : Color3.Black(); },
    dispose() { mesh.dispose(); material.dispose(); },
  };
}
