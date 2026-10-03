import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';

export function createStandIn(scene) {
  const root = new TransformNode('wilds-stand-in', scene), material = new StandardMaterial('wilds-stand-in', scene);
  material.diffuseColor = new Color3(.78, .42, .3); material.specularColor = new Color3(.05, .05, .05);
  const body = MeshBuilder.CreateCapsule('wilds-stand-in-body', { height: 1.5, radius: .3, tessellation: 12 }, scene);
  const nose = MeshBuilder.CreateBox('wilds-stand-in-nose', { width: .18, height: .12, depth: .3 }, scene);
  body.position.y = .75; nose.position.set(0, 1.2, .3);
  for (const mesh of [body, nose]) { mesh.parent = root; mesh.material = material; mesh.isPickable = false; }
  return {
    root, meshes: [body, nose],
    update(state) { root.position.set(state.x, state.y, state.z); root.rotation.y = state.yaw; },
    dispose() { root.dispose(false, true); },
  };
}
