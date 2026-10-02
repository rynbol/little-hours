import { buildTerrainRings, buildGrassBlades, buildOutdoorWorld } from '../world/world.js';
import { TERRAIN_RINGS } from '../world/terrain-mesh.js';
import { GRASS } from '../world/grass-blades.js';
import { worldAtmosphere } from '../world/atmosphere.js';
import { LANDMARKS } from '../world/landmarks.js';
import { WARDEN_ARENA } from '../../core/wilds/combat.js';

export const wildsAtmosphere = worldAtmosphere;
const FOREST_START = Object.freeze({ x: -106.5, z: -180, yaw: .6 });

const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

export async function createWildsWorld(scene, { theme = 'day', still = false, workers = typeof Worker === 'function', signal } = {}) {
  const controller = new AbortController(), cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const loading = scene.onDisposeObservable.add(cancel);
  if (signal?.aborted || scene.isDisposed) controller.abort();
  let outdoor;
  try {
    const [rings, blades] = await Promise.all([
      buildTerrainRings({ workers, signal: controller.signal }),
      buildGrassBlades({ workers, signal: controller.signal }),
    ]);
    const build = buildOutdoorWorld(scene, { theme, still, rings, blades });
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
    setTheme: outdoor.setTheme,
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
      outdoor.setContactShadow(position.x, position.z, 0.58 + above * 0.18, support ? 0.29 / (1 + above * 0.8) : 0);
    },
    diagnostics() {
      return {
        location: 'Forest trail', scenery: 'forest', lighting: null, center: { x: 0, z: 0 }, pending: false, builds: 1, failures: 0,
        terrainTriangles: outdoor.terrain.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0),
        trees: trees.count, grassBlades: GRASS.layers.reduce((sum, layer) => sum + layer.blades, 0),
        landmarks: landmarks.length, obstacles: obstacles.length, totalObstacles: allObstacles.length, disposed,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true; controller.abort(); scene.onDisposeObservable.remove(loading); signal?.removeEventListener('abort', cancel); outdoor.dispose();
    },
  };
}
