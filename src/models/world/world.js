import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { TERRAIN_RINGS, terrainRing, sampleTerrainSurface } from './terrain-mesh.js';
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
import { createGroveLight } from './grove-light.js';

export { WORLD_GLSL } from './world-glsl.js';

export function* buildOutdoorWorld(scene, { theme = 'day', parent = null, still = false, rings = TERRAIN_RINGS.map((_, index) => terrainRing(index)), blades, definition, atmosphereFor = worldAtmosphere, lighting = 'legacy' } = {}) {
  const root = new TransformNode('world', scene); if (parent) root.parent = parent;
  let activeRings = rings, current = atmosphereFor(theme);
  const surface = (x, z) => sampleTerrainSurface(activeRings, x, z);
  const grove = lighting === 'painted' && definition ? createGroveLight(scene, { definition, atmosphere: current, surface }) : null;
  if (grove) root.onDisposeObservable.add(() => grove.dispose());
  const ground = createTerrainPaint(scene, { still, definition, grove });
  const makeTerrain = ringData => ringData.map((ring, index) => {
    const mesh = new Mesh(`world-terrain-${index}`, scene);
    Object.assign(new VertexData(), ring).applyToMesh(mesh);
    mesh.material = ground.paint; mesh.parent = root; mesh.isPickable = false; mesh.metadata = { castShadow: false, world: true };
    mesh.freezeWorldMatrix();
    return mesh;
  });
  const terrain = makeTerrain(rings);
  const { sky, setTheme: paintSky } = createWorldSky(scene, root);
  const context = { root, atmosphere: current, still, rings, blades, definition, grove, ...(definition ? { surface } : {}) };
  const layers = [ground, { setTheme: paintSky }];
  let trees = null;
  for (const create of [createWorldClouds, createWorldWater, createWorldLandmarks, createWorldTrees, createWorldGrass]) {
    yield;
    const layer = create(scene, context); layers.push(layer); trees = layer.planted ?? trees;
    if (grove && layer.planted) yield* grove.setTrees(layer.planted);
  }
  function setTheme(next) {
    current = atmosphereFor(next);
    for (const layer of layers) layer.setTheme(current);
    grove?.setTheme(current);
  }
  setTheme(theme);
  return {
    root, terrain, sky, trees, setTheme, layers, surfaceAt: surface, grove,
    setContactShadow(x, z, radius, strength) { for (const layer of layers) layer.setContactShadow?.(x, z, radius, strength); },
    prepareTerrain(nextRings, options) { return Promise.all(layers.map(layer => layer.prepareTerrain?.(nextRings, options))); },
    replaceTerrain(nextRings, prepared = []) {
      const next = makeTerrain(nextRings), previous = terrain.splice(0, terrain.length, ...next);
      activeRings = nextRings;
      for (const mesh of previous) mesh.dispose();
      for (const [index, layer] of layers.entries()) layer.refresh?.(prepared[index]);
      grove?.refresh();
    },
    get atmosphere() { return current; },
    dispose() { root.dispose(false, true); },
  };
}

export function createOutdoorWorld(scene, options) {
  const steps = buildOutdoorWorld(scene, options);
  for (;;) { const step = steps.next(); if (step.done) return step.value; }
}
