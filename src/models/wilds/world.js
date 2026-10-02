import { buildTerrainRings } from '../world/terrain-mesh.js';
import { buildGrassBlades, GRASS } from '../world/grass-blades.js';
import { buildOutdoorWorld } from '../world/world.js';
import { worldAtmosphere } from '../world/atmosphere.js';
import { sampleWaterSurface } from '../world/water.js';
import { rockCollider } from '../world/rocks.js';
import { treeBranchColliders } from '../world/trees.js';
import { WILDS_WORLD, WILDS_RINGS, WILDS_STREAM } from '../../core/wilds/world-definition.js';

export const WILDS_GRASS = Object.freeze(GRASS.layers.map((layer, index) => Object.freeze({ ...layer, blades: [6000, 12000, 22000][index], tuft: true })));

export function wildsAtmosphere(theme) {
  const original = worldAtmosphere(theme), common = { ...original, theme, fogHeight: 135, fogDensity: theme === 'rain' ? 0.0032 : 0.0022, grassFar: theme === 'day' ? '#849675' : original.grassFar };
  if (theme === 'day') return { ...common, sun: [-0.45, 0.72, -0.528], shadowLift: 0.5, grass: '#647b52', grassLight: '#82976c', grassWarm: '#8f9174', grassTip: '#a5b894', forestFloor: '#617259', leafTop: '#b2cd65', leafCrown: '#9bbb56', leafUnder: '#587c44', leafMid: '#486a45', bark: '#877b58', snow: '#d5e1dc' };
  if (theme === 'rain') return { ...common, zenith: '#697c84', high: '#83999e', horizon: '#a9b4ae', horizonAway: '#9ba9aa', fogNear: '#a0b1b2', fogFar: '#748e9c', fogSun: '#afbbb6', skyAmbient: '#a0afb4', shadowTint: '#70858b', grassFar: '#698260', water: '#739398', waterShallow: '#658176', mist: '#9cafb2', mistStrength: 0.3, cloudLit: '#99adb1', cloudShade: '#738b94', cloudRim: '#c1cccc', rock: '#9ba8a8', rockDark: '#74898d' };
  return { ...common, shadowLift: 0.58, skyAmbient: '#a3a2ad', groundAmbient: '#7d8060', grass: '#7f935b', grassLight: '#a3af74', grassWarm: '#a59f6c', grassTip: '#c8c698', grassFar: '#899562', forestFloor: '#6b7754', leafUnder: '#637e54', leafMid: '#4f7054', bark: '#a39776', mist: '#aea8a0', mistStrength: 0.28 };
}

const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

export async function createWildsWorld(scene, { theme = 'day', still = false, workers = typeof Worker === 'function', signal, lighting = 'painted' } = {}) {
  const controller = new AbortController(), cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const loading = scene.onDisposeObservable.add(cancel);
  if (signal?.aborted || scene.isDisposed) controller.abort();
  let outdoor;
  try {
    const [rings, blades] = await Promise.all([
      buildTerrainRings({ definition: WILDS_WORLD, rings: WILDS_RINGS, workers, signal: controller.signal }),
      buildGrassBlades({ workers, layers: WILDS_GRASS, signal: controller.signal }),
    ]);
    const build = buildOutdoorWorld(scene, { theme, still, definition: WILDS_WORLD, rings, blades, atmosphereFor: wildsAtmosphere, lighting });
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
  let center = { x: 0, z: 0 }, wanted = center, pending = null, disposed = false, builds = 1, failures = 0;
  const forest = outdoor.layers.find(layer => layer.planted), trees = forest?.planted;
  const allObstacles = WILDS_WORLD.rocks.map((rock, index) => ({ id: `trail-rock-${index}`, x: rock.x, z: rock.z, ...rockCollider(rock, index), baseY: outdoor.surfaceAt(rock.x, rock.z).height, climbable: !!rock.climbable }));
  for (let i = 0; trees && i < trees.count; i++) allObstacles.push({ id: `grove-tree-${i}`, treeIndex: i, x: trees.x[i], z: trees.z[i], radius: trees.width[i] * 0.48, height: trees.height[i] * 5, baseY: outdoor.surfaceAt(trees.x[i], trees.z[i]).height, climbable: false });
  for (const formation of WILDS_WORLD.formations) allObstacles.push({ ...formation, cameraRadius: formation.radius * 1.04, baseY: outdoor.surfaceAt(formation.x, formation.z).height });
  const gate = WILDS_WORLD.landmarks.find(mark => mark.kind === 'gate');
  for (const side of [-1, 1]) allObstacles.push({ id: `bellroot-root-${side}`, x: gate.x + side * gate.width * 0.5, z: gate.z, radius: 1.5, height: gate.height * 0.7, baseY: outdoor.surfaceAt(gate.x + side * gate.width * 0.5, gate.z).height, climbable: false });
  const obstacles = [], nearby = { x: Infinity, z: Infinity };
  const branchShapes = [0, 1, 2].map(kind => treeBranchColliders(kind, WILDS_WORLD.trees.style)), branchGroups = new Map();
  function branchesFor(tree) {
    if (!branchGroups.has(tree.id)) {
      const i = tree.treeIndex, width = trees.width[i], height = trees.height[i], cosine = Math.cos(trees.turn[i]), sine = Math.sin(trees.turn[i]);
      branchGroups.set(tree.id, branchShapes[trees.kind[i]].map((branch, index) => ({
        id: `grove-branch-${i}-${index}`, x: tree.x + width * (cosine * branch.x + sine * branch.z), z: tree.z + width * (-sine * branch.x + cosine * branch.z),
        radius: branch.radius * width, height: branch.height * height, offsetY: branch.baseY * height - width * .5,
        baseY: tree.baseY + branch.baseY * height - width * .5, climbable: false,
      })));
    }
    return branchGroups.get(tree.id);
  }
  function refreshObstacles(position) {
    if (disposed) return;
    if (Math.hypot(position.x - nearby.x, position.z - nearby.z) < 12) return;
    nearby.x = position.x; nearby.z = position.z; obstacles.length = 0;
    for (const obstacle of allObstacles) {
      const distance = (obstacle.x - position.x) ** 2 + (obstacle.z - position.z) ** 2;
      if (distance < 96 * 96) obstacles.push(obstacle);
      if (obstacle.treeIndex !== undefined && distance < (24 + trees.width[obstacle.treeIndex] * 8) ** 2) obstacles.push(...branchesFor(obstacle));
    }
  }
  refreshObstacles(WILDS_WORLD.spawn);
  const spawn = { ...WILDS_WORLD.spawn, y: outdoor.surfaceAt(WILDS_WORLD.spawn.x, WILDS_WORLD.spawn.z).height };
  const landmarks = WILDS_WORLD.landmarks.map(mark => ({ ...mark, y: outdoor.surfaceAt(mark.x, mark.z)?.height ?? 0 }));
  function stream() {
    if (pending || disposed || (wanted.x === center.x && wanted.z === center.z)) return;
    const nextCenter = { ...wanted };
    pending = buildTerrainRings({ definition: WILDS_WORLD, rings: WILDS_RINGS, center: nextCenter, workers, signal: controller.signal }).then(async rings => {
      if (disposed || controller.signal.aborted) return;
      const prepared = await outdoor.prepareTerrain(rings, { workers, signal: controller.signal });
      if (disposed || controller.signal.aborted) return;
      outdoor.replaceTerrain(rings, prepared); center = nextCenter; builds++;
      for (const obstacle of allObstacles) {
        obstacle.baseY = outdoor.surfaceAt(obstacle.x, obstacle.z)?.height ?? obstacle.baseY;
        for (const branch of branchGroups.get(obstacle.id) ?? []) branch.baseY = obstacle.baseY + branch.offsetY;
      }
      for (const mark of landmarks) mark.y = outdoor.surfaceAt(mark.x, mark.z)?.height ?? mark.y;
    }).catch(error => { if (error.name !== 'AbortError') failures++; }).finally(() => { pending = null; });
  }
  return {
    root: outdoor.root, spawn, obstacles, landmarks, bounds: WILDS_WORLD.bounds, refreshObstacles,
    get atmosphere() { return outdoor.atmosphere; },
    surfaceAt: outdoor.surfaceAt,
    waterAt: (x, z) => sampleWaterSurface(WILDS_WORLD.water, outdoor.surfaceAt, x, z),
    setTheme: outdoor.setTheme,
    update({ position }) {
      if (disposed || !position) return;
      refreshObstacles(position);
      outdoor.grove?.follow(position.x, position.z);
      const support = outdoor.surfaceAt(position.x, position.z), feetY = position.y ?? support?.height ?? 0;
      forest?.setViewTarget(position.x, feetY + 1, position.z, 1.35);
      let supportHeight = support?.height ?? 0;
      for (const obstacle of obstacles) {
        const top = obstacle.baseY + obstacle.height;
        if (top > supportHeight && top <= feetY + 0.001 && (position.x - obstacle.x) ** 2 + (position.z - obstacle.z) ** 2 < obstacle.radius ** 2) supportHeight = top;
      }
      const above = Math.max(0, feetY - supportHeight);
      outdoor.setContactShadow(position.x, position.z, 0.58 + above * 0.18, support ? 0.29 / (1 + above * 0.8) : 0);
      if (Math.hypot(position.x - center.x, position.z - center.z) < WILDS_STREAM.distance) return;
      wanted = { x: Math.round(position.x / WILDS_STREAM.snap) * WILDS_STREAM.snap, z: Math.round(position.z / WILDS_STREAM.snap) * WILDS_STREAM.snap };
      stream();
    },
    diagnostics() { return { lighting: outdoor.grove?.diagnostics() ?? null, center: { ...center }, pending: !!pending, builds, failures, terrainTriangles: outdoor.terrain.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0), trees: trees?.count ?? 0, grassBlades: WILDS_GRASS.reduce((sum, layer) => sum + layer.blades, 0), landmarks: landmarks.length, obstacles: obstacles.length, totalObstacles: allObstacles.length, disposed }; },
    dispose() {
      if (disposed) return;
      disposed = true; controller.abort(); scene.onDisposeObservable.remove(loading); signal?.removeEventListener('abort', cancel); outdoor.dispose();
    },
  };
}
