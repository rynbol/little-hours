import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { VALLEY, createHeightGrid } from '../../core/wilds/valley.js';
import { CHUNK, LOD_STEPS, chunkGeometry } from './terrain-data.js';
import { outerGeometry } from './terrain-outer.js';

const LOD_DISTANCES = [0, 110, 230, 460];

function runWorkers(count) {
  const workers = Array.from({ length: count }, () => new Worker(new URL('./terrain.worker.js', import.meta.url), { type: 'module' }));
  const run = (worker, job) => new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => resolve(data);
    worker.onerror = event => reject(new Error(event.message || 'terrain worker failed'));
    worker.postMessage(job.message, job.transfer || []);
  });
  return {
    all: list => Promise.all(list.map((job, i) => run(workers[i % count], job))),
    dispose: () => workers.forEach(worker => worker.terminate()),
  };
}

export async function surveyValley() {
  const { minX, maxX, minZ, maxZ, step } = VALLEY.core;
  const columns = Math.round((maxX - minX) / step) + 1, rows = Math.round((maxZ - minZ) / step) + 1;
  const count = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
  const bands = Array.from({ length: count }, (_, i) => [Math.round(rows * i / count), Math.round(rows * (i + 1) / count)]);
  const pool = runWorkers(count);
  try {
    const heights = new Float32Array(columns * rows);
    for (const part of await pool.all(bands.map(band => ({ message: { kind: 'heights', rows: band } })))) heights.set(part.heights, part.rows[0] * columns);
    const layout = { minX, minZ, step, columns, rows };
    const colors = new Uint8Array(columns * rows * 4), mask = new Uint8Array(columns * rows * 4), tint = new Uint8Array(columns * rows * 4);
    for (const part of await pool.all(bands.map(band => ({ message: { kind: 'survey', rows: band, heights, layout } })))) {
      for (const [target, source] of [[colors, part.colors], [mask, part.mask], [tint, part.tint]]) target.set(source, part.rows[0] * columns * 4);
    }
    return { grid: createHeightGrid(heights, layout), colors, mask, tint };
  } finally { pool.dispose(); }
}

const meshFrom = (name, geometry, scene, material) => {
  const mesh = new Mesh(name, scene), data = new VertexData();
  Object.assign(data, { positions: geometry.positions, normals: geometry.normals, colors: geometry.colors, indices: geometry.indices });
  data.applyToMesh(mesh, false);
  mesh.material = material; mesh.isPickable = false; mesh.receiveShadows = true;
  mesh.freezeWorldMatrix(); mesh.doNotSyncBoundingInfo = true;
  return mesh;
};

export function createTerrain(scene, survey) {
  const material = new StandardMaterial('wilds-ground', scene);
  material.diffuseColor = new Color3(1, 1, 1);
  material.specularColor = new Color3(.035, .035, .03);
  material.specularPower = 18;
  const { grid, colors } = survey, chunks = [];
  const lastX = grid.minX + (grid.columns - 1) * grid.step, lastZ = grid.minZ + (grid.rows - 1) * grid.step;
  for (let z = grid.minZ; z < lastZ; z += CHUNK) for (let x = grid.minX; x < lastX; x += CHUNK) {
    const size = Math.min(CHUNK, lastX - x, lastZ - z);
    const levels = LOD_STEPS.map((step, i) => meshFrom(`wilds-ground-${x}-${z}-${i}`, chunkGeometry(grid, colors, x, z, step, size), scene, material));
    levels.slice(1).forEach((level, i) => { levels[0].addLODLevel(LOD_DISTANCES[i + 1], level); });
    chunks.push(levels[0]);
  }
  const outer = meshFrom('wilds-ground-outer', outerGeometry(), scene, material);
  outer.receiveShadows = false;
  return {
    material, chunks, outer, grid,
    meshes: [...chunks, outer],
    dispose() { chunks.forEach(chunk => chunk.getLODLevels().forEach(level => level.mesh?.dispose())); chunks.forEach(chunk => chunk.dispose()); outer.dispose(); material.dispose(); },
  };
}
