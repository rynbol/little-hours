import { smooth } from '../world-terrain.js';
import { VALLEY, lakeEdge, nearSegment, trailDistance, waterAt } from './valley.js';

export const TREE = Object.freeze({
  cell: 6.5, span: Object.freeze([-300, 300, -620, 230]),
  trunk: Object.freeze({ oak: 0.34, beech: 0.3, pine: 0.24, birch: 0.18 }),
  height: Object.freeze({ oak: 9, beech: 11, pine: 14, birch: 9.5 }),
});

const hero = (x, z, kind, scale, lean = 0, turn = 0) => Object.freeze({ x, z, kind, scale, lean, turn, hero: true });
export const HERO_TREES = Object.freeze([
  hero(-14, 53, 'oak', 1.3, 0.05, 0.4), hero(15, 55, 'beech', 1.2, 0.06, 2.1), hero(19, 35, 'oak', 1.15, 0.08, 4), hero(-18, 37, 'beech', 1.25, 0.05, 1.2),
  hero(-7, 61, 'oak', 1.4, 0.03, 3), hero(7, 63, 'beech', 1.1, 0.05, 5.1),
  hero(-6, 23, 'beech', 1.15, 0.1, 0.8), hero(7, 15, 'oak', 1.2, 0.12, 2.6), hero(-8, 6, 'oak', 1.1, 0.09, 4.4), hero(9, -1, 'beech', 1.2, 0.08, 1.7),
  hero(-10, -10, 'beech', 1.1, 0.11, 3.3), hero(8, -16, 'oak', 1.05, 0.14, 5.5), hero(-7, -22, 'oak', 1, 0.16, 0.2),
  hero(-36, -162, 'oak', 1.35, 0.32, 1.57), hero(43, -204, 'beech', 1.2, 0.28, -1.5), hero(-31, -232, 'oak', 1.25, 0.3, 1.3), hero(38, -146, 'beech', 1.15, 0.25, -1.9),
  hero(-11, -109, 'birch', 1.1, 0.05, 0.6), hero(3, -111, 'beech', 1.1, 0.06, 2.4),
  hero(-21, -334, 'oak', 1.3, 0.06, 1), hero(35, -321, 'beech', 1.2, 0.05, 3.7),
]);

export function treeHash(i, j, seed) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const CLEAR = Object.freeze([
  [VALLEY.camp.x, VALLEY.camp.z, 15], [VALLEY.ring.x, VALLEY.ring.z, 27], [VALLEY.oak.x, VALLEY.oak.z, 17], [VALLEY.shrine.x, VALLEY.shrine.z, 9],
  [VALLEY.merchant.x, VALLEY.merchant.z, 6], [VALLEY.dummy.x, VALLEY.dummy.z, 9], [VALLEY.vista.x, VALLEY.vista.z, 11], [VALLEY.tower.x, VALLEY.tower.z, 9], [VALLEY.lookout.x, VALLEY.lookout.z, 7],
  [VALLEY.spire.x, VALLEY.spire.z, 9], ...VALLEY.campfires.map(fire => [fire.x, fire.z, 7]), ...VALLEY.secrets.map(spot => [spot.x, spot.z, 4]),
].map(Object.freeze));

export function forestDensity(x, z, height, slope) {
  const { bounds, camp, hollow, bridge, falls } = VALLEY;
  if (slope > 0.85 || waterAt(x, z) > height - 0.4 || lakeEdge(x, z) < 5 || trailDistance(x, z) < 4.5) return 0;
  for (const [cx, cz, radius] of CLEAR) if (Math.hypot(x - cx, z - cz) < radius) return 0;
  if (nearSegment(x, z, hollow.root.x, hollow.root.z, hollow.crown.x, hollow.crown.z)[0] < 5 || nearSegment(x, z, bridge.x, bridge.from, bridge.x, bridge.to)[0] < 5) return 0;
  if (x < falls.lower + 14 && x > falls.upper - 6 && Math.abs(z - falls.z) < 13) return 0;
  const reach = Math.hypot((x - bounds.x) / bounds.rx, (z - bounds.z) / bounds.rz);
  if (reach > 1.7) return 0;
  const fromCamp = Math.hypot(x - camp.x, z - camp.z);
  let density = 0.1;
  if (fromCamp < 70 && z > -32) density = 0.8;
  else if (z < -36 && z > -112 && Math.abs(x) < 46) density = 0.03;
  else if (x > 50) density = 0.5;
  else if (x < -50) density = 0.3;
  return Math.max(density, 0.95 * smooth(0.8, 0.97, reach));
}

export function treeKind(x, z, height, roll) {
  if (height > 30 || x < -52) return roll < 0.8 ? 'pine' : 'birch';
  if (lakeEdge(x, z) < 14) return roll < 0.5 ? 'birch' : 'beech';
  return roll < 0.45 ? 'oak' : roll < 0.8 ? 'beech' : roll < 0.9 ? 'pine' : 'birch';
}

export function plantValley(ground) {
  const [x0, x1, z0, z1] = TREE.span, trees = [...HERO_TREES.map(tree => ({ ...tree, y: ground(tree.x, tree.z) }))];
  for (let i = Math.floor(x0 / TREE.cell); i <= x1 / TREE.cell; i++) for (let j = Math.floor(z0 / TREE.cell); j <= z1 / TREE.cell; j++) {
    const x = (i + 0.15 + treeHash(i, j, 1) * 0.7) * TREE.cell, z = (j + 0.15 + treeHash(i, j, 2) * 0.7) * TREE.cell, height = ground(x, z);
    const slope = Math.hypot(ground(x + 1.5, z) - ground(x - 1.5, z), ground(x, z + 1.5) - ground(x, z - 1.5)) / 3;
    if (treeHash(i, j, 3) >= forestDensity(x, z, height, slope)) continue;
    if (HERO_TREES.some(tree => Math.hypot(tree.x - x, tree.z - z) < 6)) continue;
    trees.push({ x, z, y: height, kind: treeKind(x, z, height, treeHash(i, j, 4)), scale: 0.75 + treeHash(i, j, 5) * 0.55, lean: treeHash(i, j, 6) * 0.08, turn: treeHash(i, j, 7) * Math.PI * 2, hero: false });
  }
  return trees;
}

export function trunkSolids(trees) {
  const { bounds } = VALLEY;
  return trees.filter(tree => Math.hypot((tree.x - bounds.x) / bounds.rx, (tree.z - bounds.z) / bounds.rz) < 1.05)
    .map(tree => Object.freeze({ x: tree.x, z: tree.z, radius: TREE.trunk[tree.kind] * tree.scale * 1.15, bottom: tree.y - 1, top: tree.y + TREE.height[tree.kind] * tree.scale }));
}
