import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

export function createGardenButterflies(scene) {
  const wings = MeshBuilder.CreateSphere('garden-butterfly-wings', { diameter: 1, segments: 4 }, scene);
  const body = MeshBuilder.CreateSphere('garden-butterfly-bodies', { diameter: 1, segments: 3 }, scene);
  const paint = new StandardMaterial('garden-butterfly-paint', scene), bodyPaint = new StandardMaterial('garden-butterfly-body-paint', scene);
  paint.diffuseColor = Color3.FromHexString('#f3d69c'); paint.emissiveColor.set(.15, .12, .06); paint.specularColor.setAll(0);
  bodyPaint.diffuseColor = Color3.FromHexString('#806e51'); bodyPaint.specularColor.setAll(0);
  wings.material = paint; body.material = bodyPaint;
  const wingMatrices = new Float32Array(6 * 16), bodyMatrices = new Float32Array(3 * 16), matrix = new Matrix(), rotation = new Quaternion(), position = new Vector3(), size = new Vector3();
  wings.thinInstanceSetBuffer('matrix', wingMatrices, 16, false); body.thinInstanceSetBuffer('matrix', bodyMatrices, 16, false);
  for (const mesh of [wings, body]) { mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.setEnabled(false); }
  return {
    animate(seconds, visible) {
      wings.setEnabled(visible); body.setEnabled(visible);
      if (!visible) return;
      for (let i = 0; i < 3; i++) {
        const t = seconds * (.14 + i * .025) + i * 2.1, x = Math.sin(t) * (2 + i * .5), z = Math.cos(t * .7 + i) * 2.4, y = 1.3 + Math.sin(t * 2 + i) * .35;
        const yaw = Math.atan2(Math.cos(t), -Math.sin(t * .7 + i) * .7), flap = .25 + Math.sin(seconds * 12 + i * 2) * .8;
        position.set(x, y, z); size.set(.045, .05, .22); Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, rotation); Matrix.ComposeToRef(size, rotation, position, matrix); matrix.copyToArray(bodyMatrices, i * 16);
        for (const side of [-1, 1]) {
          position.set(x + Math.cos(yaw) * side * .095, y, z - Math.sin(yaw) * side * .095); size.set(.23, .02, .24);
          Quaternion.RotationYawPitchRollToRef(yaw, 0, side * flap, rotation); Matrix.ComposeToRef(size, rotation, position, matrix); matrix.copyToArray(wingMatrices, (i * 2 + (side + 1) / 2) * 16);
        }
      }
      wings.thinInstanceBufferUpdated('matrix'); body.thinInstanceBufferUpdated('matrix');
    },
  };
}
