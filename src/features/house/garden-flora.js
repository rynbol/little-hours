import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { createWindPaint } from './house-grass.js';
import { retreatFlora } from './garden-retreat.js';

export function createGardenFlora(scene) {
  const mesh = new Mesh('garden-flora', scene), { material, wind } = createWindPaint(scene, 'garden-flora-paint', 0);
  material.backFaceCulling = true;
  mesh.material = material; mesh.isPickable = false; mesh.receiveShadows = true; mesh.alwaysSelectAsActiveMesh = true; mesh.freezeWorldMatrix(); mesh.setEnabled(false);
  let key = '', blooms = [], planted = false;
  return {
    mesh,
    get blooms() { return blooms; },
    get planted() { return planted; },
    set(plants, theme) {
      const next = JSON.stringify([theme, plants.map(plant => [plant.slot, plant.species, plant.minutes])]);
      if (next === key) return false;
      key = next;
      const body = retreatFlora(plants, theme);
      blooms = body.blooms; planted = body.indices.length > 0;
      if (!planted) return true;
      const data = new VertexData(); Object.assign(data, { positions: body.positions, normals: body.normals, colors: body.colors, indices: body.indices }); data.applyToMesh(mesh, false);
      mesh.setVerticesData('grassBlade', body.sway, false, 3);
      return true;
    },
    animate(seconds) { wind.time = seconds; },
    dispose() { material.dispose(); mesh.dispose(); },
  };
}
