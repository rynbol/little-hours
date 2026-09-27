export const GARDEN_CENTER = [8.75, 0, 0];
export const GARDEN_TAG = [8.75, -.15, 3.05];
const GROUND = -.175, grass = ['#a9b98f', '#b2c197'], hedge = ['#6f8a62', '#7d9669', '#657f5b'], picket = '#efe4cc';
const stone = ['#cfc3ad', '#bfb29a'], bark = '#7a5a42', soil = '#8a6a4f';
const bloom = ['#eac0b9', '#f5e4bd', '#c8b7d7', '#e6a3a0'];
const lampGlow = theme => theme === 'dusk' ? ['#ffd88f', 2.1] : theme === 'rain' ? ['#e9d6a8', 1.35] : ['#f3e2bd', 1];

const POND = [10.25, 1.85];
const SPOTS = Array.from({ length: 42 }, (_, i) => [6.6 + (i % 7) * .64 + (Math.floor(i / 7) % 2) * .3, -2.35 + Math.floor(i / 7) * .82])
  .filter(([x, z]) => x < 10.75 && Math.hypot(x - POND[0], z - POND[1]) > 1.05 && !(z > 1 && x < 9.6));
export const treeSpot = index => SPOTS[(index * 13) % SPOTS.length];

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

function flowers(api, x0, x1, z, count) {
  for (let i = 0; i < count; i++) {
    const x = x0 + (x1 - x0) * i / (count - 1), y = GROUND + .07 + (i % 3) * .03, dz = Math.sin(i * 2.3) * .09;
    api.box(x, y, z + dz, .025, .16, .025, '#6e855e');
    api.ball(x, y + .1, z + dz, .14, .08, .14, bloom[i % 4]);
    api.ball(x + .06, GROUND + .04, z + dz, .13, .05, .08, '#839d6f');
  }
}

export function buildGarden(api, trees, theme) {
  const [cx] = GARDEN_CENTER, w = 5.3, d = 6.2, left = cx - w / 2, right = cx + w / 2, back = -d / 2, front = d / 2;
  api.box(cx, -.52, 0, w + .2, .48, d + .2, '#63765e');
  for (let i = 0; i < 6; i++) api.box(left + w * (i + .5) / 6, -.25, 0, w / 6, .15, d, grass[i % 2]);

  for (let i = 0; i < 14; i++) api.ball(left + .2 + i * (w - .4) / 13, GROUND + .22, back + .22, .56, .5, .42, hedge[i % 3]);
  for (let i = 1; i < 10; i++) api.ball(right - .2, GROUND + .22, back + .22 + i * (d - 1.6) / 9, .42, .5, .56, hedge[i % 3]);

  const gate = [left + .55, left + 1.25];
  for (let x = left + .12; x < right - .05; x += .3) if (x < gate[0] - .05 || x > gate[1] + .05) api.box(x, GROUND + .17, front - .08, .07, .34, .05, picket);
  for (const y of [.1, .27]) {
    api.box((left + gate[0]) / 2, GROUND + y, front - .08, gate[0] - left - .1, .04, .03, picket);
    api.box((gate[1] + right) / 2, GROUND + y, front - .08, right - gate[1] - .1, .04, .03, picket);
  }
  for (const x of gate) api.box(x, GROUND + .55, front - .08, .08, 1.1, .08, '#e9dcc0');
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * i / 6, x = (gate[0] + gate[1]) / 2 - Math.cos(a) * (gate[1] - gate[0]) / 2, y = GROUND + 1.1 + Math.sin(a) * .28;
    api.box(x, y, front - .08, .12, .06, .08, '#e9dcc0');
    api.ball(x, y + .05, front - .04, .15, .12, .12, i % 2 ? '#e3a9b1' : '#7f9a6a');
  }

  for (let i = 0; i < 9; i++) {
    const t = i / 8, x = gate[0] + .35 + t * 2.6 + Math.sin(t * 5) * .12, z = front - .45 - t * 1.25;
    api.cylinder(x, GROUND + .02, z, .34 - (i % 2) * .05, .36, .04, stone[i % 2]);
  }

  const pond = POND;
  api.cylinder(pond[0], GROUND + .03, pond[1], 1.35, 1.4, .06, stone[1]);
  api.cylinder(pond[0], GROUND + .045, pond[1], 1.12, 1.12, .06, '#7fa6a8');
  for (const [dx, dz] of [[-.2, .1], [.18, -.16], [.05, .26]]) api.cylinder(pond[0] + dx, GROUND + .08, pond[1] + dz, .2, .2, .015, '#7d9a64');
  api.ball(pond[0] + .18, GROUND + .11, pond[1] - .16, .08, .06, .08, '#f1c9d2');
  for (let i = 0; i < 10; i++) { const a = i * .63; api.ball(pond[0] + Math.cos(a) * .7, GROUND + .06, pond[1] + Math.sin(a) * .7, .16, .09, .14, stone[i % 2]); }

  const bench = [cx - .25, front - .55];
  api.box(bench[0], GROUND + .3, bench[1], 1, .06, .3, '#d1ae86');
  api.box(bench[0], GROUND + .5, bench[1] + .13, 1, .22, .04, '#c29c73');
  for (const dx of [-.42, .42]) api.box(bench[0] + dx, GROUND + .15, bench[1], .06, .3, .26, '#8d6d53');

  const [glow, strength] = lampGlow(theme);
  for (const [x, z] of [[gate[0] - .15, front - .3], [right - .35, .55], [right - .35, -2.4]]) {
    api.box(x, GROUND + .35, z, .05, .7, .05, '#76553f');
    api.box(x, GROUND + .72, z, .15, .04, .15, '#76553f');
    api.ball(x, GROUND + .64, z, .13, .15, .13, glow, strength);
  }

  const nest = [right - .4, -1.1];
  api.box(nest[0], GROUND + .45, nest[1], .05, .9, .05, '#8d6d53');
  api.box(nest[0], GROUND + .98, nest[1], .24, .2, .2, '#c98f6b');
  api.prism(nest[0], GROUND + 1.08, nest[1], .32, .14, .26, '#5a746c');
  api.disc(nest[0], GROUND + .98, nest[1] + .11, .07, .02, '#4b3a30');

  flowers(api, left + 1.45, right - 2.1, front - .22, 11);

  trees.forEach((entry, index) => {
    const [x, z] = treeSpot(index), seed = [...entry.date].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) >>> 0;
    tree(api, x + (seed % 7 - 3) * .02, z + (seed % 5 - 2) * .03, entry.growth, seed);
  });
}
