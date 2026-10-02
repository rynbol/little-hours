import { gardenGround, gardenCliff, gardenEdge, onGarden } from './garden-ground.js';
import { addBody, hangingRoots } from '../../models/landform.js';
import { placeAsset } from '../../models/assets.js';
import { plantBody } from '../../models/flora.js';
import { gardenGrowth } from '../../core/garden-plants.js';
import { BEDS, BED, bedBody, bedEdge, inBed, markerBody } from './garden-bed.js';

export const RETREAT_SPOTS = BEDS.map(({ x, z }) => [x, z]);
export const RETREAT_LIGHT = {
  day: { sky: '#ffffff', ground: '#a0a7a4', sun: '#fff3d9', fill: .62, key: .95, bulb: ['#ffe7b3', 1.3] },
  dusk: { sky: '#b7b0dc', ground: '#6a6488', sun: '#ffc48a', fill: .6, key: .82, bulb: ['#ff8a3d', 2.8] },
  rain: { sky: '#cfdde6', ground: '#7d8d94', sun: '#dde7ea', fill: .6, key: .6, bulb: ['#ffb866', 1.9] },
};
export const GARDEN_EXIT = [-3.8, .04, -6.1];
export const GARDEN_EXIT_TAG = [-3.8, .45, -4.45];
export const RETREAT_BOUNDS = [{ points: new Float32Array([...gardenGround().positions, ...Array.from({ length: 32 }, (_, i) => [...gardenEdge(i / 32 * Math.PI * 2, .9), -2.2]).flatMap(([x, z, y]) => [x, y, z]), ...Array.from({ length: 32 }, (_, i) => { const a = i / 32 * Math.PI * 2; return [Math.cos(a) * 6.1, -.5, Math.sin(a) * 5.5]; }).flat(), -4.3, 3.1, -3.05, 4.3, 3.1, -3.05, -1.5, 2.6, -4.1, 1.5, 2.6, -4.1, -6.65, -.5, -8.55, -1, -.5, -8.55, -5.8, 2.8, -6.1, -1.8, 2.8, -6.1]) }];
const shades = ['#5f8a3e', '#79a348', '#8fb354', '#4f7a3a'];
export const HEDGE = Object.freeze({ day: shades, dusk: ['#446639', '#577942', '#67844d', '#395a35'], rain: ['#527c3b', '#689344', '#7ba150', '#446e37'] });
function hedged(api, theme) {
  const leaves = HEDGE[theme] || shades, kit = Object.create(api);
  kit.ball = (x, y, z, w, h, d, hex, ...rest) => api.ball(x, y, z, w, h, d, leaves[shades.indexOf(hex)] ?? hex, ...rest);
  return kit;
}
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

export function buildGardenRetreat(kit, theme) {
  const api = hedged(kit, theme);
  addBody(api, gardenGround(theme));
  for (const body of gardenCliff(theme)) addBody(api, body);
  hangingRoots(api, { edge: angle => gardenEdge(angle, .998), top: -.27, count: 110, seed: 3 });
  const asset = (name, at) => { const { positions, colors, normals, indices } = placeAsset(name, at); api.shape(positions, colors, normals, indices); };
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, x = Math.cos(a) * 5.65, z = .05 + Math.sin(a) * 5;
    if (x < -1.8 && z < -2.8) continue;
    api.ball(x, .09 + i % 3 * .055, z, .62, .32, .6, shades[i % 4]);
    if (i % 2) flowers(api, x * .965, z * .965, i, .8 + i % 3 * .13);
  }
  for (let i = 0; i < 12; i++) {
    const z = 4.65 - i * .54, x = Math.sin(z * .8) * .42;
    stone(api, x, z, .95 + i % 3 * .07, .5, i);
    if (i % 3 === 0) stone(api, x + .34, z + .12, .36, .26, i + 1);
  }
  for (const [i, [x, z]] of [[.52, -1.78], [.68, -2.32], [.46, -2.85], [0, -3.04]].entries()) stone(api, x, z, .58, .43, i);
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) stone(api, side * (.65 + i * .53), .05 + Math.sin(i * .7) * .36, .55, .38, i);
  for (const [i, [x, z]] of [[-4.15, -1.05], [-3.95, -1.6], [-3.7, -2.15], [-3.45, -2.7], [-3.2, -3.25], [-3.25, -3.8], [-3.5, -4.3], [-3.8, -4.75]].entries()) stone(api, x, z, .7, .52, i);
  for (const [slot, bed] of BEDS.entries()) { const { positions, colors, normals } = bedBody(bed, theme, slot); api.shape(positions, colors, normals); }
  for (let i = 0; i < 18; i++) {
    const a = Math.PI + i / 17 * Math.PI, x = Math.cos(a) * 5.25, z = Math.sin(a) * 4.55;
    if (i === 4 || i === 5) continue;
    api.box(x, .45, z, .1, .9, .1, '#dbcead'); api.ball(x, .92, z, .15, .13, .15, '#f0e2bd');
    if (i < 17 && i !== 3) { const b = Math.PI + (i + .5) / 17 * Math.PI; for (const y of [.35, .66]) api.box(Math.cos(b) * 5.25, y, Math.sin(b) * 4.55, .96, .06, .06, '#d6c8a6', [0, -b - Math.PI / 2, 0]); }
  }
  roseArbour(api); pottingCorner(api);
  for (const [i, [x, z]] of [[-6.1, -3.9], [-5.8, -5.1], [-5.05, -6.65], [-3.4, -7.5], [-1.2, -6.1], [-1.7, -4.9]].entries()) flowers(api, x, z, i + 11, 1.4);
  const shade = { dusk: [.72, .74, .92], rain: [.86, .9, .95] }[theme] || [1, 1, 1];
  for (const [i, x] of [-5.2, 4.3].entries()) {
    asset(i ? 'tree-willow' : 'tree-blossom-a', { x, z: -3.05, yaw: i * 2.1 + .4, scale: .92, tint: (i ? [.9, 1.04, .78] : [1.06, .9, .98]).map((value, k) => value * shade[k]) });
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
  const [bulb, glow] = RETREAT_LIGHT[theme].bulb;
  for (let i = 0; i < 28; i++) {
    const step = 9.2 / 27, x = -4.6 + i * step, y = 2.55 - Math.sin(i / 27 * Math.PI) * .62, z = -3.8;
    if (i < 27) { const rise = 2.55 - Math.sin((i + 1) / 27 * Math.PI) * .62 - y; api.box(x + step / 2, y + rise / 2, z, Math.hypot(step, rise), .024, .025, '#97876a', Math.atan2(rise, step)); }
    if (i % 2) api.ball(x, y - .09, z, .125, .155, .125, bulb, glow);
  }
}

export const GARDEN_LAMPS = Object.freeze([[-4.6, -3.8], [-2.3, -3.8], [0, -3.8], [2.3, -3.8], [4.6, -3.8], [GARDEN_EXIT[0] + .65, GARDEN_EXIT[2]]].map(Object.freeze));
const PAVED = Object.freeze([[.52, -1.78], [.68, -2.32], [.46, -2.85], [0, -3.04], [-4.15, -1.05], [-3.95, -1.6], [-3.7, -2.15], [-3.45, -2.7], [-3.2, -3.25], [-3.25, -3.8], [-3.5, -4.3], [-3.8, -4.75], [0, -2.35], [-5.2, -3.05], [4.3, -3.05]].map(Object.freeze));

export function gardenGrassy(x, z) {
  const lobe = x < -1.8 && z < -2.8;
  return onGarden(x, z, .2)
    && (lobe || (x / 5.65) ** 2 + ((z - .05) / 5) ** 2 < .84)
    && !inBed(x, z, .02)
    && !(z > -1.5 && z < 4.95 && Math.abs(x - Math.sin(z * .8) * .42) < .58)
    && !(Math.abs(x) < 4.15 && Math.abs(z - .05) < .6)
    && !(Math.abs(x) < 1.75 && z > -4.35 && z < -2.85)
    && !(Math.abs(x + 4.45) < .72 && Math.abs(z - .7) < .62)
    && !(Math.abs(x - GARDEN_EXIT[0]) < .7 && z < -4.3)
    && PAVED.every(([px, pz]) => Math.hypot(x - px, z - pz) > .42);
}

const TUFTS = 110;
export function gardenBlades() {
  const blades = [], tries = 46000, rim = 1100;
  for (let i = 0; i < tries; i++) {
    const x = -7.3 + hash(i * 1.17 + 3) * 13.6, z = -8.9 + hash(i * 2.31 + 9) * 14.6;
    if (!gardenGrassy(x, z)) continue;
    const patch = Math.sin(x * .8 + z * .35) * .5 + Math.sin(z * 1.6 - x * .45 + 1) * .5;
    blades.push({ x, z, ground: 0, height: (.1 + .13 * (.35 + .65 * hash(i * 3.3))) * (.8 + patch * .2), lean: hash(i * 5.1) * Math.PI * 2, tone: hash(i * 7.7), patch });
  }
  BEDS.forEach((bed, slot) => {
    for (let i = 0; i < TUFTS; i++) {
      const [x, z] = bedEdge(bed, (i + hash(i * 3.1 + slot)) / TUFTS * Math.PI * 2, 1.035 + hash(i * 1.9 + slot * 5) * .09);
      if (!gardenGrassy(x, z)) continue;
      blades.push({ x, z, ground: 0, height: .2 + hash(i * 4.7 + slot) * .16, lean: hash(i * 5.9 + slot) * Math.PI * 2, tone: hash(i * 7.3 + slot), patch: .1 + hash(i * 2.1) * .5 });
    }
  });
  for (let i = 0; i < rim; i++) {
    const a = (i + hash(i * 2.7) * .8) / rim * Math.PI * 2, [rx, rz] = gardenEdge(a), [nx, nz] = gardenEdge(a + .01), along = Math.hypot(nx - rx, nz - rz), dx = (nz - rz) / along, dz = (rx - nx) / along;
    const inset = .015 + hash(i * 4.3) * .06, height = .14 + hash(i * 6.1) * .2;
    blades.push({ x: rx - dx * inset, z: rz - dz * inset, ground: 0, height, lean: Math.atan2(nz - rz, nx - rx), tone: hash(i * 7.9), patch: .2 + hash(i * 1.1) * .5, drop: [dx * height * .7, -height * (.55 + hash(i * 3.9) * .5), dz * height * .7] });
  }
  return blades;
}

export function retreatFlora(plants, theme = 'day') {
  const body = { positions: [], colors: [], normals: [], indices: [], sway: [] }, blooms = [];
  for (const plant of plants) {
    const bed = BEDS[plant.slot];
    if (!bed) continue;
    const growth = gardenGrowth(plant), part = plantBody(plant.species, growth, { x: bed.x, z: bed.z, floor: BED.soil + .1, theme, seed: plant.slot + 1 }), offset = body.positions.length / 3;
    for (const key of ['positions', 'colors', 'normals', 'sway']) for (const value of part[key]) body[key].push(value);
    for (const index of part.indices) body.indices.push(index + offset);
    if (growth >= 1) blooms.push({ slot: plant.slot, species: plant.species, at: part.crown });
  }
  return { ...body, blooms };
}

export function buildRetreatMarkers(api, empty, theme) {
  for (const slot of empty) { const { positions, colors, normals } = markerBody(BEDS[slot], theme); api.shape(positions, colors, normals); }
}

export function buildGardenExit(api, theme) {
  const [x, , z] = GARDEN_EXIT;
  for (let i = 0; i < 7; i++) stone(api, x + Math.sin(i * .5) * .12, -4.65 - i * .52, 1.12, .46, i);
  buildRoseArch(api, theme, x, z);
}

export function buildRoseArch(kit, theme, x, z) {
  const api = hedged(kit, theme);
  for (const side of [-1, 1]) {
    api.box(x + side * 1.03, 1.13, z, .17, 2.26, .17, '#b29c79');
    api.box(x + side * 1.03, 1.13, z - .74, .17, 2.26, .17, '#b29c79');
    for (const y of [.5, .95, 1.4, 1.85]) api.box(x + side * 1.03, y, z - .37, .06, .05, .75, '#c6b390');
    for (let i = 0; i < 7; i++) {
      api.ball(x + side * 1.03 + Math.sin(i * 2) * .1, .2 + i * .32, z + .03, .42, .43, .38, shades[i % 4]);
      if (i % 2) api.ball(x + side * 1.05, .26 + i * .32, z + .23, .21, .19, .19, petals[i % 4]);
    }
    flowers(api, x + side * 1.22, z + .4, side + 6, 1.3);
  }
  for (const depth of [0, -.74]) api.box(x, 2.24, z + depth, 2.55, .15, .16, '#cab594');
  for (let i = 0; i < 7; i++) {
    api.box(x - 1.24 + i * .41, 2.33, z - .38, .09, .09, 1.1, '#dec9a5');
    api.ball(x - 1.15 + i * .38, 2.43, z, .57, .34, .55, shades[i % 4]);
    if (i % 2) api.ball(x - 1.15 + i * .38, 2.48, z + .26, .23, .2, .23, '#e9c7be');
  }
  api.box(x + .65, 1.86, z + .05, .035, .58, .035, '#a58f6b');
  api.box(x + .65, 1.6, z + .05, .24, .07, .24, '#a58f6b');
  api.ball(x + .65, 1.75, z + .05, .18, .23, .18, '#ffe3ae', theme === 'dusk' ? 1.9 : 1.3);
}
