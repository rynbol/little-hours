import { buildGardenTree } from './garden-trees.js';
import { buildGardenSpecimen } from './garden-model.js';

export const RETREAT_SPOTS = [[-2.35, -1.95], [2.35, -1.95], [-3, .2], [3, .2], [-2.25, 2.35], [2.25, 2.35]];
export const RETREAT_BOUNDS = [{ points: new Float32Array([...Array.from({ length: 32 }, (_, i) => { const a = i / 32 * Math.PI * 2; return [Math.cos(a) * 6.1, -.5, Math.sin(a) * 5.5]; }).flat(), -4.3, 3.1, -3.05, 4.3, 3.1, -3.05, -1.5, 2.6, -4.1, 1.5, 2.6, -4.1]) }];
const shades = ['#819b70', '#95ad7b', '#a4b78b', '#718e68'];
const petals = ['#ecc3b6', '#d5bddb', '#f5e6bb', '#e5acb9'];
const hash = n => { const value = Math.sin(n * 71.3 + 2.1) * 43758.54; return value - Math.floor(value); };

function terrace(api, x, y, z, width, depth, height, color, seed = 0) {
  const positions = [], colors = [], normals = [], count = 48;
  const rgb = [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16) / 255);
  const point = (i, level, scale = 1) => { const a = i / count * Math.PI * 2, edge = 1 + Math.sin(a * 5 + seed) * .022; return [x + Math.cos(a) * width / 2 * edge * scale, level, z + Math.sin(a) * depth / 2 * edge * scale]; };
  const tri = (a, b, c, normal, light = 1) => { positions.push(...a, ...c, ...b); for (let i = 0; i < 3; i++) { colors.push(...rgb.map(value => value * light), 1); normals.push(...normal); } };
  for (let i = 0; i < count; i++) {
    const a = point(i, y), b = point(i + 1, y), c = point(i, y - height, .97), d = point(i + 1, y - height, .97), angle = (i + .5) / count * Math.PI * 2;
    tri([x, y, z], b, a, [0, 1, 0]);
    tri(a, b, c, [Math.cos(angle), 0, Math.sin(angle)], .82); tri(b, d, c, [Math.cos(angle), 0, Math.sin(angle)], .82);
  }
  api.shape(positions, colors, normals);
}

function flowers(api, x, z, seed, scale = 1) {
  api.ball(x, .09, z, .7 * scale, .24 * scale, .58 * scale, shades[seed % 4]);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4 + seed, r = (.13 + hash(i + seed) * .2) * scale, fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r, y = (.2 + hash(seed * 2 + i) * .28) * scale;
    api.cylinder(fx, y / 2, fz, .023, .03, y, '#70875f');
    for (let k = 0; k < 5; k++) { const angle = k * Math.PI * .4; api.ball(fx + Math.cos(angle) * .065 * scale, y + .04, fz + Math.sin(angle) * .065 * scale, .12 * scale, .07 * scale, .12 * scale, petals[seed % 4]); }
    api.ball(fx, y + .075, fz, .065 * scale, .04 * scale, .065 * scale, '#ead598');
  }
}

function stone(api, x, z, width, depth, seed) {
  terrace(api, x, .035, z, width, depth, .045, ['#dfd6bb', '#d8ceb3', '#e7dbc2'][seed % 3], seed);
}

function roseArbour(api) {
  const wood = '#c4af8d', light = '#e4d4b4';
  for (const x of [-1.4, 1.4]) for (const z of [-4.1, -3.15]) {
    api.box(x, 1.18, z, .14, 2.36, .14, wood);
    api.ball(x, 2.38, z, .19, .16, .19, light);
  }
  for (const z of [-4.1, -3.15]) api.box(0, 2.2, z, 3.15, .15, .14, wood);
  for (let i = 0; i < 8; i++) api.box(-1.5 + i * .43, 2.3, -3.63, .1, .11, 1.38, light);
  for (let i = 0; i < 9; i++) api.box(-1.25 + i * .31, 1.15, -4.13, .04, 1.75, .04, '#b8ad8b');
  for (const y of [.4, .78, 1.16, 1.54, 1.92]) api.box(0, y, -4.13, 2.8, .04, .04, '#b8ad8b');
  for (const x of [-1.38, 1.38]) for (let i = 0; i < 8; i++) {
    api.ball(x + Math.sin(i * 2.4) * .13, .3 + i * .25, -3.14, .36, .37, .3, shades[i % 4]);
    if (i % 2) { api.ball(x + .05, .33 + i * .25, -2.97, .21, .19, .2, petals[i % 4]); api.ball(x + .1, .36 + i * .25, -2.86, .11, .1, .09, '#f0d1c4'); }
  }
  for (let i = 0; i < 12; i++) {
    const x = -1.5 + i * .27, y = 2.33 + Math.sin(i * .7) * .09;
    api.ball(x, y, -3.2, .48, .28, .5, shades[i % 4]);
    if (i % 3 !== 0) api.ball(x, y + .09, -2.98, .25, .2, .22, petals[i % 4]);
  }
  for (const x of [-.85, .85]) for (const z of [-3.83, -3.39]) api.box(x, .27, z, .09, .54, .09, '#899780');
  for (let i = 0; i < 4; i++) api.box(0, .57, -3.84 + i * .14, 2.12, .075, .115, '#bdc8a6');
  for (const y of [.86, 1.08]) api.box(0, y, -3.9, 2.1, .13, .065, '#b0bea0');
  for (const x of [-.98, .98]) { api.box(x, .77, -3.6, .06, .42, .48, '#a9b594'); api.box(x, .98, -3.6, .13, .07, .5, '#c4cfad'); }
  api.ball(-.55, .68, -3.6, .64, .14, .43, '#e0b5b3'); api.ball(.58, .68, -3.6, .56, .13, .42, '#e8dab4');
}

function pottingCorner(api) {
  const x = -4.45, z = .7;
  for (const dx of [-.42, .42]) for (const dz of [-.3, .3]) api.box(x + dx, .43, z + dz, .08, .86, .08, '#a98e6d');
  api.box(x, .85, z, 1.08, .1, .85, '#d6bf9a'); api.box(x, .25, z, 1.02, .065, .7, '#bca47e');
  for (let i = 0; i < 3; i++) { api.cylinder(x - .3 + i * .3, 1.03, z + .08, .22, .15, .26, '#cfa18a'); api.cylinder(x - .3 + i * .3, 1.17, z + .08, .23, .23, .025, '#e2bfa5'); }
  api.box(x, .95, z - .21, .45, .08, .2, '#9ead8c');
  for (const dx of [-.28, .26]) api.cylinder(x + dx, .39, z + .06, .28, .21, .26, '#b7876b');
  api.box(x, 1.22, z - .38, 1.08, .15, .06, '#a88b68');
  api.ball(x - .32, 1.19, z + .07, .26, .25, .24, '#89a279');
}

export function buildGardenRetreat(api, theme) {
  terrace(api, 0, -.26, .05, 12.2, 11, .34, '#cbbca1');
  terrace(api, 0, -.09, .05, 12.15, 10.95, .22, '#6f8c62');
  terrace(api, 0, 0, .05, 12, 10.8, .14, '#a0b282');
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, x = Math.cos(a) * 5.65, z = .05 + Math.sin(a) * 5;
    api.ball(x, .09 + i % 3 * .055, z, .62, .32, .6, shades[i % 4]);
    if (i % 2) flowers(api, x * .965, z * .965, i, .8 + i % 3 * .13);
    if (i % 4 === 0) api.ball(x * 1.025, -.17, z * 1.025, .6, .3, .48, '#d1c6a7');
  }
  for (let i = 0; i < 12; i++) {
    const z = 4.65 - i * .54, x = Math.sin(z * .8) * .42;
    stone(api, x, z, .95 + i % 3 * .07, .5, i);
    if (i % 3 === 0) stone(api, x + .34, z + .12, .36, .26, i + 1);
  }
  for (const [i, [x, z]] of [[.52, -1.78], [.68, -2.32], [.46, -2.85], [0, -3.04]].entries()) stone(api, x, z, .58, .43, i);
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) stone(api, side * (.65 + i * .53), .05 + Math.sin(i * .7) * .36, .55, .38, i);
  for (const [slot, [x, z]] of RETREAT_SPOTS.entries()) {
    terrace(api, x, .1, z, 2.08, 1.75, .16, '#baab87', slot);
    terrace(api, x, .12, z, 1.79, 1.46, .04, '#80734f', slot);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; api.ball(x + Math.cos(a) * .99, .13, z + Math.sin(a) * .8, .28, .2, .26, i % 3 ? '#dfcfad' : '#cbbd9d'); }
    api.box(x + .65, .3, z + .54, .035, .38, .035, '#a18561'); api.box(x + .65, .49, z + .54, .27, .19, .045, '#eadbbb', -.1);
    for (let i = 0; i < 5; i++) api.ball(x - .5 + i * .25, .15, z - .43, .16, .035, .12, '#94835f');
  }
  for (let i = 0; i < 18; i++) {
    const a = Math.PI + i / 17 * Math.PI, x = Math.cos(a) * 5.25, z = Math.sin(a) * 4.55;
    api.box(x, .45, z, .1, .9, .1, '#dbcead'); api.ball(x, .92, z, .15, .13, .15, '#f0e2bd');
    if (i < 17) { const b = Math.PI + (i + .5) / 17 * Math.PI; for (const y of [.35, .66]) api.box(Math.cos(b) * 5.25, y, Math.sin(b) * 4.55, .96, .06, .06, '#d6c8a6', [0, -b - Math.PI / 2, 0]); }
  }
  roseArbour(api); pottingCorner(api);
  for (const [i, x] of [-4.2, 4.3].entries()) {
    buildGardenTree(api, i ? 'willow' : 'cherry', x, -3.05, 0, .86);
    flowers(api, x + (i ? -.45 : .45), -3.5, i + 5, 1.5);
  }
  for (const [i, [x, z]] of [[-4.9, 2.4], [4.6, 2.35], [-3.3, 4], [3.55, 3.75], [-2.55, -4.25], [2.8, -4.05]].entries()) flowers(api, x, z, i + 3, 1.4);
  api.cylinder(0, .25, -2.35, .2, .44, .5, '#cfccb0'); api.ball(0, .49, -2.35, .74, .17, .74, '#e4dbc0'); api.cylinder(0, .54, -2.35, .57, .57, .018, '#b1c9ba');
  api.ball(.27, .64, -2.35, .16, .17, .12, '#c5ae91'); api.ball(.24, .74, -2.35, .11, .11, .1, '#d7c2a5');
  api.cylinder(1.04, .23, 1.1, .38, .38, .46, '#8faa97'); api.box(1.32, .42, 1.1, .4, .085, .085, '#8faa97', .4); api.ball(1.53, .5, 1.1, .18, .08, .18, '#b5c2a1');
  for (const y of [.08, .46]) api.box(.75, y, 1.1, .2, .045, .055, '#8faa97'); api.box(.65, .27, 1.1, .05, .41, .055, '#8faa97');
  for (const side of [-1, 1]) {
    api.box(side * .86, .81, 4.2, .15, 1.62, .15, '#d4c4a3'); api.ball(side * .86, 1.65, 4.2, .21, .16, .21, '#eee0bd');
    for (let i = 0; i < 5; i++) api.ball(side * .87, .23 + i * .28, 4.22, .38, .34, .33, shades[i % 4]);
    flowers(api, side * 1.08, 4.3, side + 7, 1.2);
  }
  for (const x of [-4.6, 4.6]) { api.box(x, 1.29, -3.8, .095, 2.58, .095, '#a99571'); api.ball(x, 2.62, -3.8, .15, .13, .15, '#dec9a2'); }
  const glow = theme === 'dusk' ? 1.9 : 1.3;
  for (let i = 0; i < 28; i++) {
    const step = 9.2 / 27, x = -4.6 + i * step, y = 2.55 - Math.sin(i / 27 * Math.PI) * .62, z = -3.8;
    if (i < 27) { const rise = 2.55 - Math.sin((i + 1) / 27 * Math.PI) * .62 - y; api.box(x + step / 2, y + rise / 2, z, Math.hypot(step, rise), .024, .025, '#97876a', Math.atan2(rise, step)); }
    if (i % 2) api.ball(x, y - .09, z, .105, .135, .105, '#ffe7b3', glow);
  }
  for (const [x, z] of [[-1.15, 3.35], [1.15, 3.35], [-1, -1.2], [1, -1.2]]) {
    api.box(x, .28, z, .045, .56, .045, '#8c795b'); api.box(x, .57, z, .2, .06, .2, '#8c795b'); api.ball(x, .48, z, .15, .15, .15, '#ffe7b3', glow);
  }
}

export function buildRetreatFlowers(api, plants) {
  for (const plant of plants) {
    const spot = RETREAT_SPOTS[plant.slot];
    if (spot) buildGardenSpecimen(api, plant, ...spot, { floor: .16, reach: .82, spread: .58, count: 7 });
  }
}
