import { onIsland, STREAM } from './house-island.js';
import { inPond, DOCK } from './house-pond.js';
import { pathDistance } from './house-paths.js';

export const GARDEN_CENTER = [8.9, 0, 0];
export const GARDEN_TAG = [8.2, -.15, -2.2];
const GROUND = -.175, bark = '#7a5a42', soil = '#8a6a4f';
const bloom = ['#eac0b9', '#f5e4bd', '#c8b7d7', '#e6a3a0'];
const lampGlow = theme => theme === 'dusk' ? ['#ffd88f', 2.1] : theme === 'rain' ? ['#e9d6a8', 1.35] : ['#f3e2bd', 1];
const hash = n => { const s = Math.sin(n * 57.3 + 9.1) * 43758.5453; return s - Math.floor(s); };
export const ARBOUR = [6.35, 3.2], BENCH = [7.55, 1.05], NEST = [11.55, -2.35];

const clear = (x, z) => onIsland(x, z, .55) && !inPond(x, z, .7)
  && !(Math.abs(x - DOCK.x) < .75 && z > DOCK.to - .2)
  && pathDistance(x, z) > .75 && Math.hypot(x - BENCH[0], z - BENCH[1]) > .8 && Math.hypot(x - ARBOUR[0], z - ARBOUR[1]) > .8
  && Math.hypot(x - NEST[0], z - NEST[1]) > .5 && Math.hypot(x - 8.95, z - 2.72) > .6 && STREAM.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > .6) && !(x > -5.9 && x < 5.4 && z > -3.15 && z < 3.2);
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
  const tall = .28 + 1.3 * growth, crown = .3 + .5 * growth, top = GROUND + tall;
  api.cylinder(x, GROUND + .015, z, .36, .4, .03, soil);
  api.cylinder(x, GROUND + tall / 2, z, .05 + .05 * growth, .07 + .07 * growth, tall, bark);
  if (growth < .35) {
    api.box(x + .09, GROUND + .2, z, .025, .4, .025, '#c8ab82');
    for (const side of [-1, 1]) api.ball(x + side * .08, top, z, .16, .08, .1, '#8fae76');
    return;
  }
  const blossom = growth >= 1 && seed % 3 === 0, fruit = growth >= 1 && seed % 3 === 1;
  const leaves = blossom ? ['#e3b7bd', '#f0d3cf'] : [['#6f8a62', '#8fa77c'], ['#7c946a', '#a2b584'], ['#5f7d5c', '#86a077']][seed % 3];
  api.ball(x, top + crown * .12, z, crown, crown * .85, crown, leaves[0]);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + seed % 6;
    api.ball(x + Math.cos(a) * crown * .3, top + crown * (.28 + (i % 2) * .12), z + Math.sin(a) * crown * .26, crown * .72, crown * .62, crown * .72, leaves[1]);
  }
  if (fruit) for (let i = 0; i < 5; i++) {
    const a = i * 1.3 + seed % 5;
    api.ball(x + Math.cos(a) * crown * .42, top + crown * (.05 + (i % 3) * .14), z + Math.sin(a) * crown * .4, .09, .09, .09, ['#e38b6d', '#f0b46a'][i % 2]);
  }
}

function lamp(api, x, z, [glow, strength]) {
  api.box(x, GROUND + .35, z, .05, .7, .05, '#76553f');
  api.box(x, GROUND + .72, z, .15, .04, .15, '#76553f');
  api.ball(x, GROUND + .64, z, .13, .15, .13, glow, strength);
}

function clump(api, x, z, count, seed) {
  for (let i = 0; i < count; i++) {
    const a = i * 2.4 + seed, r = .08 + hash(seed + i) * .2, fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r, y = GROUND + .06 + hash(seed * 3 + i) * .07;
    api.box(fx, y, fz, .025, .16, .025, '#6e855e');
    api.ball(fx, y + .1, fz, .13, .08, .13, bloom[(i + seed) % 4]);
  }
  api.ball(x, GROUND + .04, z, .36, .08, .3, '#8fa678');
}

export function buildGarden(api, trees, theme) {
  const [ax, az] = ARBOUR;
  for (const dx of [-.42, .42]) api.box(ax + dx, GROUND + .55, az, .08, 1.1, .08, '#e9dcc0');
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * i / 6, x = ax - Math.cos(a) * .42, y = GROUND + 1.1 + Math.sin(a) * .28;
    api.box(x, y, az, .12, .06, .1, '#e9dcc0');
    api.ball(x, y + .05, az + .04, .17, .13, .15, i % 2 ? '#e3a9b1' : '#7f9a6a');
    if (i % 2 === 0) api.ball(x + .03, y - .08, az - .05, .12, .1, .1, '#f0c9cf');
  }
  for (const dx of [-.42, .42]) for (let k = 0; k < 3; k++) api.ball(ax + dx + (k % 2 ? .04 : -.04), GROUND + .25 + k * .3, az + .05, .13, .16, .1, k % 2 ? '#7f9a6a' : '#8fae76');

  const [bx, bz] = BENCH, turn = [0, -.55, 0];
  const at = (dx, dz) => [bx + dx * Math.cos(.55) + dz * Math.sin(.55), bz - dx * Math.sin(.55) + dz * Math.cos(.55)];
  api.box(bx, GROUND + .3, bz, 1, .06, .3, '#d1ae86', turn);
  const [rx, rz] = at(0, -.13); api.box(rx, GROUND + .5, rz, 1, .22, .04, '#c29c73', turn);
  for (const dx of [-.42, .42]) { const [lx, lz] = at(dx, 0); api.box(lx, GROUND + .15, lz, .06, .3, .26, '#8d6d53', turn); }

  const glow = lampGlow(theme);
  lamp(api, ax + .75, az + .25, glow); lamp(api, bx - .55, bz - .45, glow); lamp(api, 8.95, 2.72, glow);
  for (const [x, z] of [[-1.1, 4.05], [1.7, 4.12], [4.4, 3.88]]) lamp(api, x, z, glow);
  api.box(-3.35, GROUND + .3, 3.55, .05, .6, .05, bark); api.box(-3.35, GROUND + .66, 3.55, .3, .2, .2, '#8fa487'); api.box(-3.35, GROUND + .66, 3.66, .02, .12, .02, '#c46f5c');

  const [nx, nz] = NEST;
  api.box(nx, GROUND + .45, nz, .05, .9, .05, '#8d6d53');
  api.box(nx, GROUND + .98, nz, .24, .2, .2, '#c98f6b');
  api.prism(nx, GROUND + 1.08, nz, .32, .14, .26, '#5a746c');
  api.disc(nx, GROUND + .98, nz + .11, .07, .02, '#4b3a30');

  [[6.9, 2.55], [8.35, 2.7], [7.1, -.4], [8.1, -1.9], [11.95, .9], [11.2, 3.05], [6.2, -1.3], [10.4, -1.55]].forEach(([x, z], i) => clump(api, x, z, 5 + i % 3, i * 7));

  trees.forEach((entry, index) => {
    const [x, z] = treeSpot(index), seed = [...entry.date].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) >>> 0;
    tree(api, x, z, entry.growth, seed);
  });
}
