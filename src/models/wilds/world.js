import { buildTerrainRings, buildOutdoorWorld } from '../world/world.js';
import { TERRAIN_RINGS } from '../world/terrain-mesh.js';
import { grassBlades } from '../world/grass-blades.js';
import { wildsAtmosphere } from './atmosphere.js';
import { createWildsTerrainPaint } from './ground.js';
import { createWildsGrass } from './grass.js';
import { createWildsShadows } from './light.js';
import { createWildsPost } from './post.js';
import { LANDMARKS } from '../world/landmarks.js';
import { WARDEN_ARENA } from '../../core/wilds/combat.js';

export { wildsAtmosphere } from './atmosphere.js';
const FOREST_START = Object.freeze({ x: -106.5, z: -180, yaw: .6 });

const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

export async function createWildsWorld(scene, { theme = 'day', still = false, workers = typeof Worker === 'function', signal } = {}) {
  const controller = new AbortController(), cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const loading = scene.onDisposeObservable.add(cancel);
  if (signal?.aborted || scene.isDisposed) controller.abort();
  let outdoor;
  try {
    const rings = await buildTerrainRings({ workers, signal: controller.signal });
    const build = buildOutdoorWorld(scene, { theme, still, rings, blades: grassBlades([{ period: 16, blades: 1 }]), atmosphereFor: wildsAtmosphere });
    for (;;) {
      if (controller.signal.aborted) throw new DOMException('World creation cancelled', 'AbortError');
      const step = build.next();
      if (step.done) { outdoor = step.value; break; }
      await nextFrame();
    }
  } catch (error) {
    controller.abort();
    scene.getTransformNodeByName('world')?.dispose(false, true);
    scene.onDisposeObservable.remove(loading); signal?.removeEventListener('abort', cancel);
    throw error;
  }
  let disposed = false;
  scene.getMeshByName('world-grass').setEnabled(false);
  const ground = createWildsTerrainPaint(scene, { still });
  outdoor.terrain[0].material.dispose();
  for (const mesh of outdoor.terrain) mesh.material = ground.paint;
  const grass = createWildsGrass(scene, { root: outdoor.root, atmosphere: outdoor.atmosphere, still, surface: outdoor.surfaceAt });
  ground.setTheme(outdoor.atmosphere);
  const shadows = createWildsShadows(scene, { atmosphere: outdoor.atmosphere, paints: [ground.paint, grass.mesh.material] });
  const post = createWildsPost(scene, { atmosphere: outdoor.atmosphere });
  const forest = outdoor.layers.find(layer => layer.planted), trees = outdoor.trees;
  const allObstacles = Array.from({ length: trees.count }, (_, index) => ({
    id: `forest-tree-${index}`, x: trees.x[index], z: trees.z[index],
    radius: trees.width[index] * .5, height: trees.height[index] * 5,
    baseY: outdoor.surfaceAt(trees.x[index], trees.z[index]).height, climbable: false,
  }));
  for (const stone of WARDEN_ARENA.stones) allObstacles.push({ ...stone, baseY: outdoor.surfaceAt(stone.x, stone.z).height, climbable: false });
  const obstacles = [], nearby = { x: Infinity, z: Infinity };
  function refreshObstacles(position) {
    if (disposed || Math.hypot(position.x - nearby.x, position.z - nearby.z) < 12) return;
    nearby.x = position.x; nearby.z = position.z; obstacles.length = 0;
    for (const obstacle of allObstacles) if ((obstacle.x - position.x) ** 2 + (obstacle.z - position.z) ** 2 < 96 ** 2) obstacles.push(obstacle);
  }
  const spawn = { ...FOREST_START, y: outdoor.surfaceAt(FOREST_START.x, FOREST_START.z).height };
  const landmarks = Object.entries(LANDMARKS).flatMap(([id, value]) => (Array.isArray(value) ? value : [value]).map((mark, index) => ({ ...mark, id: `${id}-${index}`, y: outdoor.surfaceAt(mark.x, mark.z)?.height ?? 0 })));
  refreshObstacles(spawn);
  return {
    root: outdoor.root, spawn, obstacles, landmarks, bounds: TERRAIN_RINGS.at(-1), refreshObstacles,
    get atmosphere() { return outdoor.atmosphere; },
    surfaceAt: outdoor.surfaceAt,
    setTheme(next) { outdoor.setTheme(next); ground.setTheme(outdoor.atmosphere); grass.setTheme(outdoor.atmosphere); shadows.setTheme(outdoor.atmosphere); post.setTheme(outdoor.atmosphere); },
    update({ position }) {
      if (disposed || !position) return;
      refreshObstacles(position);
      const support = outdoor.surfaceAt(position.x, position.z), feetY = position.y ?? support?.height ?? 0;
      forest.setViewTarget(position.x, feetY + 1, position.z, 1.35);
      let supportHeight = support?.height ?? 0;
      for (const obstacle of obstacles) {
        const top = obstacle.baseY + obstacle.height;
        if (top > supportHeight && top <= feetY + 0.001 && (position.x - obstacle.x) ** 2 + (position.z - obstacle.z) ** 2 < obstacle.radius ** 2) supportHeight = top;
      }
      const above = Math.max(0, feetY - supportHeight);
      const radius = 0.58 + above * 0.18, strength = support ? 0.29 / (1 + above * 0.8) : 0;
      outdoor.setContactShadow(position.x, position.z, radius, strength);
      ground.setContactShadow(position.x, position.z, radius, strength); grass.setContactShadow(position.x, position.z, radius, strength);
      grass.setWalker(position.x, feetY, position.z, 1);
      shadows.follow(position.x, feetY, position.z);
    },
    diagnostics() {
      return {
        location: 'Forest trail', scenery: 'forest', lighting: null, center: { x: 0, z: 0 }, pending: false, builds: 1, failures: 0,
        terrainTriangles: outdoor.terrain.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0),
        trees: trees.count, grassBlades: grass.blades, shadowCasters: shadows.casters(), postCameras: post.cameras(),
        landmarks: landmarks.length, obstacles: obstacles.length, totalObstacles: allObstacles.length, disposed,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true; controller.abort(); scene.onDisposeObservable.remove(loading); signal?.removeEventListener('abort', cancel); post.dispose(); shadows.dispose(); outdoor.dispose();
    },
  };
}
