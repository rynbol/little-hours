import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { TERRAIN_RINGS, terrainRing } from './terrain-mesh.js';
export { buildTerrainRings } from './terrain-mesh.js';
export { buildGrassBlades } from './grass-blades.js';
import { createTerrainPaint } from './terrain-paint.js';
import { createWorldSky } from './sky.js';
import { createWorldClouds } from './clouds.js';
import { createWorldWater } from './water.js';
import { createWorldTrees } from './trees.js';
import { createWorldGrass } from './grass.js';
import { createWorldLandmarks } from './landmarks.js';
import { worldAtmosphere } from './atmosphere.js';

export { WORLD_GLSL } from './world-glsl.js';

export function* buildOutdoorWorld(scene, { theme = 'day', parent = null, still = false, rings = TERRAIN_RINGS.map((_, index) => terrainRing(index)), blades } = {}) {
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
  const context = { root, atmosphere: current, still, rings, blades };
  const layers = [ground, { setTheme: paintSky }];
  for (const create of [createWorldClouds, createWorldWater, createWorldLandmarks, createWorldTrees, createWorldGrass]) { yield; layers.push(create(scene, context)); }
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

export function createOutdoorWorld(scene, options) {
  const steps = buildOutdoorWorld(scene, options);
  for (;;) { const step = steps.next(); if (step.done) return step.value; }
}
