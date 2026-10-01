import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { TERRAIN_RINGS, terrainRing } from './terrain-mesh.js';
export { buildTerrainRings } from './terrain-mesh.js';
import { createTerrainPaint } from './terrain-paint.js';
import { createWorldSky } from './sky.js';
import { createWorldClouds } from './clouds.js';
import { createWorldWater } from './water.js';
import { createWorldTrees } from './trees.js';
import { createWorldGrass } from './grass.js';
import { createWorldLandmarks } from './landmarks.js';
import { worldAtmosphere } from './atmosphere.js';

export { WORLD_GLSL } from './world-glsl.js';

export function createOutdoorWorld(scene, { theme = 'day', parent = null, still = false, rings = TERRAIN_RINGS.map((_, index) => terrainRing(index)) } = {}) {
  const root = new TransformNode('world', scene); if (parent) root.parent = parent;
  const ground = createTerrainPaint(scene, { still });
  const terrain = rings.map((ring, index) => {
    const mesh = new Mesh(`world-terrain-${index}`, scene);
    Object.assign(new VertexData(), ring).applyToMesh(mesh);
    mesh.material = ground.paint; mesh.parent = root; mesh.isPickable = false; mesh.metadata = { castShadow: false, world: true };
    mesh.freezeWorldMatrix();
    return mesh;
  });
  const { sky, setTheme: paintSky } = createWorldSky(scene, root);
  let current = worldAtmosphere(theme);
  const context = { root, atmosphere: current, still, rings };
  const layers = [ground, { setTheme: paintSky }, ...[createWorldClouds, createWorldWater, createWorldLandmarks, createWorldTrees, createWorldGrass].map(create => create(scene, context))];
  function setTheme(next) {
    current = worldAtmosphere(next);
    for (const layer of layers) layer.setTheme(current);
  }
  setTheme(theme);
  return {
    root, terrain, sky, setTheme,
    get atmosphere() { return current; },
    dispose() { root.dispose(false, true); },
  };
}
