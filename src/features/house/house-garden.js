import { buildGardenPlants, PLANT_SPOTS } from './garden-model.js';
import { placeAsset } from '../../models/assets.js';
import { onIsland, STREAMS } from './house-island.js';
import { inPond, DOCK } from './house-pond.js';
import { pathDistance, PATH_LINES, PATH_WIDTH } from './house-paths.js';
import { groundsKit, lanternPost, stringLights, railFence, gardenBench, barrelPlanter, wildflowers, groundsHash } from './grounds-kit.js';

export const GARDEN_CENTER = [8.9, 0, 0];
export const GARDEN_TAG = [8.2, -.15, -2.2];
const GROUND = -.175, soil = '#8a6a4f';
const lampGlow = theme => theme === 'dusk' ? ['#ffd88f', 3.6] : theme === 'rain' ? ['#f0d9a4', 2.2] : ['#f6e4b8', 1.15];
const hash = n => { const s = Math.sin(n * 57.3 + 9.1) * 43758.5453; return s - Math.floor(s); };
export const ARBOUR = [6.35, 3.2], BENCH = [7.55, 1.05], NEST = [11.55, -2.35];
export const ARCH = [ARBOUR[0] - .4, ARBOUR[1]];

const clear = (x, z) => onIsland(x, z, .55) && !inPond(x, z, .7)
  && !(Math.abs(x - DOCK.x) < .75 && z > DOCK.to - .2)
  && PLANT_SPOTS.every(([px, pz]) => Math.hypot(x - px, z - pz) > 1.05) && pathDistance(x, z) > .75 && Math.hypot(x - BENCH[0], z - BENCH[1]) > .8 && Math.hypot(x - ARBOUR[0], z - ARBOUR[1]) > .8
  && Math.hypot(x - NEST[0], z - NEST[1]) > .5 && Math.hypot(x - 8.95, z - 2.72) > .6 && STREAMS.flat().every(([sx, sz]) => Math.hypot(x - sx, z - sz) > .6) && !(x > -5.9 && x < 5.4 && z > -3.15 && z < 3.2);
const SPOTS = (() => {
  const spots = [];
  for (let i = 0; spots.length < 30 && i < 4000; i++) {
    const garden = i < 2600, x = garden ? 5.8 + hash(i) * 6.8 : -6 + hash(i) * 11.2, z = garden ? -3.9 + hash(i * 1.7 + 3) * 6.4 : -4.3 + hash(i * 1.7 + 3) * 1.6;
    if (clear(x, z) && spots.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > .95)) spots.push([x, z]);
  }
  return spots;
})();
export const treeSpot = index => SPOTS[index % SPOTS.length];

function tree(api, x, z, growth, seed) {
  api.cylinder(x, GROUND + .015, z, .36, .4, .03, soil);
  const blossom = growth >= 1 && seed % 3 === 0, fruit = growth >= 1 && seed % 3 === 1;
  const name = growth < .35 ? 'sapling' : blossom ? ['tree-blossom-a', 'tree-blossom-b'][seed % 2] : fruit ? 'tree-fruit' : ['tree-round-a', 'tree-round-b', 'tree-round-c'][seed % 3];
  const { positions, colors, normals, indices } = placeAsset(name, { x, y: GROUND, z, yaw: seed % 628 / 100, scale: growth < .35 ? .7 + growth * 1.2 : (.45 + .75 * growth) * .62 });
  api.shape(positions, colors, normals, indices);
}

export const LANTERNS = [[-1.1, 4.05, 0], [1.7, 4.12, Math.PI], [4.4, 3.88, 0], [7.85, 3.78, Math.PI], [8.95, 2.6, 0]];
export const BEDS_FENCE = [[5.85, -4.05], [5.85, -3.05], [5.85, -2.12], [5.85, -1.2], [6.4, -1.2], [6.9, -1.2], null, [7.6, -1.2], [8.1, -1.2], [8.75, -1.2], [9.4, -1.2], [10.12, -1.2], [10.12, -2.12], [10.12, -3.05], [10.12, -4.05]];
const PLANTERS = [[5.3, 3.9], [8.6, 3.78]];
const wilds = ['#f4eedb', '#eab0b6', '#f3d27a', '#b9a3dc', '#f6c49a'];

export function edgeFlowers() {
  const spots = [];
  PATH_LINES.forEach((line, l) => {
    for (let i = 1; i < line.length - 1; i++) {
      const [x, z] = line[i], [px, pz] = line[i - 1], [nx, nz] = line[i + 1], length = Math.hypot(nx - px, nz - pz) || 1;
      const side = (i + l) % 2 ? 1 : -1, reach = PATH_WIDTH / 2 + .3 + groundsHash(i * 3 + l) * .18;
      const fx = x - (nz - pz) / length * reach * side, fz = z + (nx - px) / length * reach * side;
      if (!onIsland(fx, fz, .35) || inPond(fx, fz, .25) || pathDistance(fx, fz) < PATH_WIDTH / 2 + .18) continue;
      if (fx > -5.9 && fx < 5.4 && fz < 3.25) continue;
      if ([...LANTERNS, ...PLANTERS, ARCH, BENCH].some(([px2, pz2]) => Math.hypot(fx - px2, fz - pz2) < .42)) continue;
      if (STREAMS.flat().some(([sx, sz]) => Math.hypot(fx - sx, fz - sz) < .45) || (Math.abs(fx - DOCK.x) < .6 && fz > DOCK.to - .3)) continue;
      spots.push([fx, fz, i * 7 + l * 31]);
    }
  });
  return spots;
}

function arbour(kit, [ax, az]) {
  const wood = '#b39470', light = '#c9ad86', leaf = ['#5f7f48', '#6f8f52', '#7c9b5a'], rose = ['#e59aa6', '#f2c2c8', '#d9707f'];
  for (const dz of [-.56, .56]) for (const dx of [-.17, .17]) kit.post(ax + dx, GROUND, az + dz, 1.22, .055, wood, { sides: 5, taper: .85, seed: dx + dz });
  for (const dx of [-.17, .17]) {
    let previous = null;
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * i / 8, point = [ax + dx, GROUND + 1.2 + Math.sin(a) * .3, az - Math.cos(a) * .6];
      if (previous) kit.beam(previous, point, .06, .07, light);
      previous = point;
    }
  }
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (i + .5) / 7.5, y = GROUND + 1.24 + Math.sin(a) * .3, z = az - Math.cos(a) * .6;
    kit.beam([ax - .27, y, z], [ax + .27, y, z], .04, .04, wood);
  }
  for (const y of [.35, .7]) kit.beam([ax - .17, GROUND + y, az - .56], [ax + .17, GROUND + y, az - .56], .03, .03, wood);
  for (let i = 0; i < 26; i++) {
    const t = i / 25, a = Math.PI * t, side = i % 2 ? .2 : -.2, climb = t < .2 || t > .8;
    const y = climb ? GROUND + .25 + (t < .5 ? t : 1 - t) * 5 : GROUND + 1.28 + Math.sin(a) * .3, z = climb ? az + (t < .5 ? -.58 : .58) : az - Math.cos(a) * .6;
    const reach = climb ? 1.2 + groundsHash(i) * .35 : .7 + groundsHash(i) * .5;
    kit.blob(ax + side * reach, y, z, climb ? .17 : .24, .2, .18, leaf[i % 3], 1, { rows: 2, sides: 6, seed: i });
    if (i % 2) kit.blob(ax + side * (reach + .15), y + .06, z + (groundsHash(i * 3) - .5) * .12, .1, .09, .1, rose[i % 3], 1.08, { rows: 2, sides: 5, seed: i });
  }
}

function stumpTable(kit, x, z, glow) {
  kit.post(x, GROUND, z, .32, .17, '#7b5a40', { sides: 8, taper: .94, seed: 2 });
  kit.slab(x, GROUND + .345, z, .19, .03, '#d8bf93', { sides: 9, seed: 3 });
  for (let i = 0; i < 3; i++) kit.slab(x, GROUND + .33 - i * .001, z, .11 - i * .035, .002, '#b99a6f', { sides: 9, seed: 5 + i });
  kit.blob(x - .05, GROUND + .4, z + .02, .12, .1, .12, '#f0e6d2', 1, { rows: 3, sides: 7 });
  kit.beam([x + .01, GROUND + .41, z + .02], [x + .08, GROUND + .44, z + .02], .02, .02, '#f0e6d2');
  kit.blob(x + .08, GROUND + .37, z - .06, .07, .05, .07, '#e9ddc8', 1, { rows: 2, sides: 6 });
  kit.blob(x + .05, GROUND + .44, z + .08, .06, .09, .06, glow[0], glow[1], { rows: 2, sides: 5 });
}

function signpost(kit, x, z) {
  kit.post(x, GROUND, z, .78, .04, '#76563e', { sides: 5, taper: .85, seed: 4 });
  kit.beam([x - .05, GROUND + .66, z + .03], [x + .32, GROUND + .69, z + .03], .14, .035, '#c9a879');
  kit.beam([x + .05, GROUND + .5, z + .03], [x - .28, GROUND + .47, z + .03], .12, .035, '#b8946a');
  kit.blob(x + .02, GROUND + .8, z, .1, .06, .1, '#8fa487', 1, { rows: 2, sides: 5 });
}

export function buildGarden(api, trees, theme, plants = []) {
  const kit = groundsKit(), glow = lampGlow(theme);
  arbour(kit, ARCH);
  const [bx, bz] = BENCH;
  gardenBench(kit, bx, GROUND, bz, -.62);
  stumpTable(kit, bx - .66, bz + .46, glow);
  for (const [x, z, yaw] of LANTERNS) lanternPost(kit, x, GROUND, z, glow, { yaw, seed: x * 3, height: 1.2 });
  const [ax, az] = ARCH;
  stringLights(kit, [[LANTERNS[2][0], GROUND + 1.15, LANTERNS[2][1]], [ax, GROUND + 1.2, az + .62], [LANTERNS[3][0], GROUND + 1.15, LANTERNS[3][1]]], glow, { sag: .16 });
  stringLights(kit, [[LANTERNS[0][0], GROUND + 1.15, LANTERNS[0][1]], [LANTERNS[1][0], GROUND + 1.15, LANTERNS[1][1]], [LANTERNS[2][0], GROUND + 1.15, LANTERNS[2][1]]], glow, { sag: .2 });
  railFence(kit, BEDS_FENCE.slice(0, 6), GROUND, { seed: 1 });
  railFence(kit, BEDS_FENCE.slice(7), GROUND, { seed: 9 });
  for (const [x, z] of [BEDS_FENCE[5], BEDS_FENCE[7]]) kit.post(x, GROUND, z, .66, .06, '#7a5b40', { sides: 5, taper: .9, seed: x });
  PLANTERS.forEach(([x, z], i) => barrelPlanter(kit, x, GROUND, z, { seed: i * 3 }));
  signpost(kit, -3.35, 3.55);
  for (const [x, z, seed] of edgeFlowers()) wildflowers(kit, x, GROUND, z, seed, { palette: wilds, count: 5 + seed % 3, height: .34 });
  [[6.9, 2.55], [8.35, 2.7], [7.1, -.4], [11.95, .9], [11.2, 3.05], [6.2, -.55], [10.4, -.85]].forEach(([x, z], i) => wildflowers(kit, x, GROUND, z, i * 7, { palette: wilds, count: 8, spread: .26, height: .36 }));
  kit.flush(api);

  const [nx, nz] = NEST;
  api.box(nx, GROUND + .45, nz, .05, .9, .05, '#8d6d53');
  api.box(nx, GROUND + .98, nz, .24, .2, .2, '#c98f6b');
  api.prism(nx, GROUND + 1.08, nz, .32, .14, .26, '#5a746c');
  api.disc(nx, GROUND + .98, nz + .11, .07, .02, '#4b3a30');

  buildGardenPlants(api, plants);

  trees.forEach((entry, index) => {
    const [x, z] = treeSpot(index), seed = [...entry.date].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) >>> 0;
    tree(api, x, z, entry.growth, seed);
  });
}
