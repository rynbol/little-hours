import { gardenGrowth } from '../../core/garden-plants.js';
import { plantBody } from '../../models/flora.js';
import { groundsKit, railFence } from './grounds-kit.js';

export const PLANT_SPOTS = [[6.55, -3.3], [8, -3.3], [9.45, -3.3], [6.55, -1.9], [8, -1.9], [9.45, -1.9]];
export const gardenPlotAt = (x, z, spots = PLANT_SPOTS, radius = .6) => spots.findIndex(([px, pz]) => Math.hypot(x - px, z - pz) < radius);

export function buildGardenPlants(api, plants, theme = 'day') {
  const fence = groundsKit();
  railFence(fence, Array.from({ length: 7 }, (_, i) => [6.95 + i * .53, -4.05]), -.175, { seed: 5 });
  fence.flush(api);
  for (const x of [6.65, 10.35]) {
    api.box(x, .6, -4.05, .1, 1.65, .1, '#b89a71');
    for (let i = 0; i < 5; i++) api.ball(x + (i % 2 ? .04 : -.04), .15 + i * .25, -4.01, .23, .22, .19, i % 3 === 0 ? '#dcaab1' : '#829b70');
  }
  for (let i = 0; i < 15; i++) {
    const x = 6.65 + i * .264, y = 1.45 - Math.sin(i / 14 * Math.PI) * .2;
    api.box(x, y, -4.05, .34, .028, .028, '#8b7759');
    if (i % 2) { api.ball(x, y - .08, -4.05, .09, .12, .09, '#ffe6a9', 1.45); api.ball(x, y + .035, -4.08, .25, .13, .15, '#98ad7f'); }
  }
  api.cylinder(10.35, .05, -1.9, .31, .29, .32, '#9cbaaa');
  api.box(10.56, .17, -1.9, .32, .07, .07, '#8ea995', .4);
  api.ball(10.72, .24, -1.9, .13, .07, .13, '#bdc9a8');
  api.box(10.13, .13, -1.9, .05, .3, .04, '#8ea995');
  for (const y of [-.01, .27]) api.box(10.23, y, -1.9, .21, .04, .04, '#8ea995');
  for (const [slot, [x, z]] of PLANT_SPOTS.entries()) {
    api.cylinder(x, -.12, z, 1.12, 1.18, .12, '#d7c5a3');
    api.cylinder(x, .02, z, .91, .78, .26, '#c69377');
    api.cylinder(x, .15, z, .96, .96, .07, '#ddb399');
    api.cylinder(x, .19, z, .8, .8, .025, '#79654d');
    api.box(x + .28, .3, z + .15, .028, .23, .025, '#ba976f');
    api.box(x + .28, .42, z + .15, .17, .13, .04, '#eee0bd');
    const plant = plants.find(item => item.slot === slot);
    if (!plant) continue;
    buildGardenSpecimen(api, plant, x, z, theme);
  }
}

export function buildGardenSpecimen(api, plant, x, z, theme = 'day') {
  const { positions, colors, normals, indices } = plantBody(plant.species, gardenGrowth(plant), { x, z, floor: .2, scale: .52, theme, seed: plant.slot + 1 });
  api.shape(positions, colors, normals, indices);
}
