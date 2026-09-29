import { gardenSpecies, gardenGrowth } from '../../core/garden-plants.js';

export const PLANT_SPOTS = [[6.55, -3.3], [8, -3.3], [9.45, -3.3], [6.55, -1.9], [8, -1.9], [9.45, -1.9]];
export const gardenPlotAt = (x, z) => PLANT_SPOTS.findIndex(([px, pz]) => Math.hypot(x - px, z - pz) < .6);
export const gardenBounds = [{ points: new Float32Array([5.8, -.25, -4.1, 10.25, -.25, -4.1, 5.8, 1.7, -1.3, 10.25, 1.7, -1.3, 5.8, 1.7, -4.1, 10.25, 1.7, -4.1, 5.8, -.25, -1.3, 10.25, -.25, -1.3]) }];

export function buildGardenPlants(api, plants) {
  for (let i = 0; i < 9; i++) {
    const x = 5.8 + i * .57;
    api.box(x, .12, -4.05, .075, .65, .075, '#d7c6a2');
    api.ball(x, .47, -4.05, .12, .11, .12, '#eee0bc');
  }
  for (const y of [.02, .28]) api.box(8.08, y, -4.05, 4.63, .065, .045, '#e1d2af');
  for (const x of [5.8, 10.35]) {
    api.box(x, .6, -4.05, .1, 1.65, .1, '#b89a71');
    for (let i = 0; i < 5; i++) api.ball(x + (i % 2 ? .04 : -.04), .15 + i * .25, -4.01, .23, .22, .19, i % 3 === 0 ? '#dcaab1' : '#829b70');
  }
  for (let i = 0; i < 15; i++) {
    const x = 5.8 + i * .325, y = 1.45 - Math.sin(i / 14 * Math.PI) * .2;
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
    const species = gardenSpecies(plant.species), growth = gardenGrowth(plant);
    if (!growth) { api.ball(x, .225, z, .14, .06, .09, '#c6a276'); continue; }
    const height = .16 + .76 * growth, stems = growth >= .5 ? 3 : 1;
    for (let i = 0; i < stems; i++) {
      const fx = x + (i === 0 ? 0 : i === 1 ? .22 : -.23), fz = z + (i === 0 ? 0 : i === 1 ? .1 : .13), h = height * (i === 0 ? 1 : i === 1 ? .78 : .62), top = .22 + h;
      api.cylinder(fx, .22 + h / 2, fz, .028, .042, h, species.leaf);
      for (let j = 0; j < 2; j++) {
        const side = j % 2 ? 1 : -1;
        api.ball(fx + side * .12, .28 + h * (.3 + j * .3), fz, .34, .13, .17, species.leaf, 1, side * .45);
      }
      if (growth < .75) continue;
      if (growth < 1) { api.ball(fx, top, fz, .14, .2, .14, species.color); continue; }
      if (species.id === 'lavender') {
        for (let k = 0; k < 7; k++) api.ball(fx + (k % 2 ? .04 : -.04), top - .03 + k * .035, fz, .13 - k * .007, .08, .13 - k * .007, k % 2 ? species.color : species.center);
      } else {
        const petals = species.id === 'sunflower' ? 12 : 8, radius = i === 0 ? .17 : .13;
        api.ball(fx, top, fz, radius * 2.4, radius * 2.4, .1, species.color);
        for (let k = 0; k < petals; k++) {
          const a = k * Math.PI * 2 / petals;
          api.ball(fx + Math.cos(a) * radius, top + Math.sin(a) * radius, fz + .025, radius * 1.05, radius * 1.65, .13, species.color, 1.12, a - Math.PI / 2);
        }
        api.ball(fx, top, fz + .045, radius * 1.1, radius * 1.1, .16, species.center, 1.4);
      }
    }
  }
}
