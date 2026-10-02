import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';

export function createWildsPlayer(scene) {
  const root = new TransformNode('wilds-player', scene);
  const body = CreateCapsule('wilds-player-placeholder', { height: 1.7, radius: .25, tessellation: 12, subdivisions: 2 }, scene);
  const paint = new StandardMaterial('wilds-player-placeholder-paint', scene);
  paint.diffuseColor.set(.48, .52, .46);
  paint.specularColor.set(0, 0, 0);
  body.material = paint;
  body.parent = root;
  body.position.y = .85;
  body.isPickable = false;
  let disposed = false;
  return {
    root,
    update({ yaw = 0 }) { root.rotation.y = yaw; },
    setAppearance() {},
    reset() {},
    diagnostics: () => ({ loaded: !disposed, placeholder: true, height: 1.7, clip: null }),
    dispose() {
      if (disposed) return;
      disposed = true;
      root.dispose();
      paint.dispose();
    },
  };
}
