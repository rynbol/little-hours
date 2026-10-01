import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateIcoSphereVertexData } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder.pure.js';
import { heightAt, noise2, pathCenter, smooth } from '../../core/world-terrain.js';
import { createTerrainPaint } from './terrain-paint.js';

export const MEADOW_ROCKS = Object.freeze([
  Object.freeze({ ahead: 21, side: -3.6, size: [1.5, 0.62, 0.72], seat: true }),
  Object.freeze({ ahead: 9, side: 2.1, size: [0.45, 0.3, 0.42] }),
  Object.freeze({ ahead: 23, side: -5.4, size: [0.5, 0.34, 0.45] }),
  Object.freeze({ ahead: 27, side: 2.6, size: [0.65, 0.42, 0.55] }),
  Object.freeze({ ahead: 38, side: -3, size: [0.9, 0.55, 0.75] }),
  Object.freeze({ ahead: 40, side: -4.9, size: [0.45, 0.3, 0.4] }),
  Object.freeze({ ahead: 52, side: 3.2, size: [1.1, 0.65, 0.85] }),
]);

const SINK = 0.3;

function rockPlace({ ahead, side }) {
  const z = -ahead, x = pathCenter(ahead) + side, run = pathCenter(ahead + 1) - pathCenter(ahead - 1), along = Math.hypot(run, 2);
  return { x, z, ground: heightAt(x, z), cos: run / along, sin: -2 / along };
}

export const rockClearings = (rocks = MEADOW_ROCKS) => rocks.flatMap(rock => {
  const { x, z } = rockPlace(rock);
  return [x, z, Math.sqrt(rock.size[0] * rock.size[2]) * 1.15, 0];
});

export function meadowRocks(rocks = MEADOW_ROCKS) {
  const shape = CreateIcoSphereVertexData({ radius: 1, subdivisions: 2 }), count = shape.positions.length / 3;
  const positions = new Float32Array(rocks.length * count * 3), colors = new Float32Array(rocks.length * count * 4), indices = [];
  rocks.forEach(({ ahead, side, size: [sx, sy, sz], seat }, r) => {
    const { x, z, ground, cos, sin } = rockPlace({ ahead, side });
    for (let v = 0; v < count; v++) {
      const ux = shape.positions[v * 3], uy = shape.positions[v * 3 + 1], uz = shape.positions[v * 3 + 2];
      const lump = 1 + 0.2 * noise2(ux * 1.6 + r * 7, uz * 1.6 + uy, 81) + 0.07 * noise2(ux * 4.1 + uy * 3, uz * 4.1 + r, 82);
      const lift = seat ? Math.min(uy, 0.55 + (uy - 0.55) * 0.15) : uy;
      const lx = ux * sx * lump, above = (lift * lump + 1 - 2 * SINK) * sy, lz = uz * sz * lump, at = (r * count + v) * 3;
      positions[at] = x + lx * cos - lz * sin; positions[at + 1] = ground + above; positions[at + 2] = z + lx * sin + lz * cos;
      colors.set([Math.max(0.6, 0.9 * (1 - smooth(0, 0.3, above))), 0, smooth(0.45, 0.8, uy + 0.35 * noise2(ux * 2 + r, uz * 2, 83)), 0], (r * count + v) * 4);
    }
    for (const index of shape.indices) indices.push(r * count + index);
  });
  const normals = new Float32Array(positions.length);
  VertexData.ComputeNormals(positions, indices, normals);
  return { positions, normals, colors, indices: new Uint32Array(indices) };
}

export function createWorldRocks(scene, { root, still }) {
  const { paint, setTheme } = createTerrainPaint(scene, { still });
  const mesh = new Mesh('world-rocks', scene);
  Object.assign(new VertexData(), meadowRocks()).applyToMesh(mesh);
  mesh.material = paint; mesh.parent = root; mesh.isPickable = false; mesh.metadata = { castShadow: false, world: true };
  mesh.freezeWorldMatrix();
  return { mesh, setTheme };
}
