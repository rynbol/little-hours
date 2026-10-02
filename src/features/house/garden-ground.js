import { rgba, ringGrid, strataBody, strataSteps, spire, shadeBody } from '../../models/landform.js';

const origin = [-1.2, -1.4];
const outlines = [[0, .05, 6, 5.4], [-3.4, -4.2, 3.4, 4.4]];
const RINGS = 7, SEGMENTS = 128, TURF = .985;
const lawn = ['#7aa046', '#8cb24e', '#6b9140', '#a3c35c'];
const lip = [[-.1, 1, '#6f9640'], [-.26, 1.004, '#5b7f3a']];
const SPIRES = Object.freeze([[-1.6, -1.2, 1.9, .95], [1.4, .5, 1.5, .8], [-3.4, -3.6, 1.3, .7], [.2, -3, 1.1, .6], [-3.2, .9, 1, .5]].map(Object.freeze));
export const GARDEN_DEPTH = -3.3;
export const TURF_LIGHT = Object.freeze({ day: [1, 1, 1], dusk: [.5, .56, .85], rain: [.68, .78, .9] });

function reach(angle) {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  const distance = Math.max(...outlines.map(([x, z, width, depth]) => {
    const ox = origin[0] - x, oz = origin[1] - z;
    const a = dx * dx / width ** 2 + dz * dz / depth ** 2;
    const b = 2 * (ox * dx / width ** 2 + oz * dz / depth ** 2);
    const c = ox * ox / width ** 2 + oz * oz / depth ** 2 - 1;
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  }));
  return distance * (1 + Math.sin(angle * 7 + 1) * .008 + Math.sin(angle * 11) * .005);
}

export function gardenEdge(angle, scale = 1) {
  const r = reach(angle) * scale;
  return [origin[0] + Math.cos(angle) * r, origin[1] + Math.sin(angle) * r];
}

export function onGarden(x, z, margin = 0) {
  return Math.hypot(x - origin[0], z - origin[1]) <= reach(Math.atan2(z - origin[1], x - origin[0])) - margin;
}

function patch(x, z) {
  const n = Math.sin(x * .9 + z * .4) * .5 + Math.sin(z * 1.7 - x * .3 + 1) * .3 + Math.sin(x * 2.3 + z * 2.1) * .2;
  return rgba(lawn[0]).map((v, i) => v + (rgba(n > .2 ? lawn[3] : n < -.25 ? lawn[2] : lawn[1])[i] - v) * .75);
}

export function gardenGround(theme = 'day') {
  const light = TURF_LIGHT[theme] || TURF_LIGHT.day, lit = color => color.map((value, i) => i < 3 ? value * light[i] : value);
  const ring = (y, scale, color) => Array.from({ length: SEGMENTS }, (_, j) => {
    const [x, z] = gardenEdge(j / SEGMENTS * Math.PI * 2, scale);
    return { p: [x, y, z], c: lit(color ? rgba(color) : patch(x, z)) };
  });
  return ringGrid([...Array.from({ length: RINGS + 1 }, (_, k) => ring(0, k / RINGS * TURF)), ...lip.map(([y, scale, color]) => ring(y, scale, color))]);
}

export function gardenCliff(theme = 'day') {
  const rock = ['#8f8584', '#7a7579', '#8a8388', '#6b686f', '#5d5b63'];
  return [
    strataBody({ edge: a => gardenEdge(a, 1.004), segments: 96, strata: strataSteps(-.28, GARDEN_DEPTH), keel: [origin[0] + .5, origin[1] - .4, GARDEN_DEPTH], seed: 4 }),
    ...SPIRES.map(([x, z, length, radius], i) => spire({ x, z, top: GARDEN_DEPTH * .62, length: length + .9, radius, colors: rock, seed: 5 + i * 2.7 })),
  ].map(body => shadeBody(body, theme));
}
